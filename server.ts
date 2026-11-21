import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type } from '@google/genai';

/**
 * Stateless Pass-Through Real-Time Relay Server (Port 3000)
 * - TIDAK menyimpan data warga, riwayat chat, atau database ke disk/DB.
 * - Server hanya meneruskan paket antar perangkat yang sedang online di channel yang sama.
 */

interface RelayEnvelope {
  type:
    | 'relay:join'
    | 'relay:publish'
    | 'relay:ping'
    | 'relay:pong'
    | 'relay:joined'
    | 'relay:event';
  eventId?: string;
  channel?: string;
  channels?: string[];
  eventName?: string;
  payload?: unknown;
  senderDeviceHash?: string;
  sentAt?: string;
}

interface ConnectedClient {
  ws: WebSocket;
  channels: Set<string>;
  clientId: string;
  accountKey?: string;
}

const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseGeminiJsonObject<T = Record<string, unknown>>(rawText: string): T {
  const cleaned = rawText
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced) as T;
      } catch {
        // Fall through to descriptive error below
      }
    }
    throw new Error(
      'Format hasil baca dokumen dari AI terpotong atau tidak lengkap. Coba kirim foto lebih jelas atau 1–3 halaman per proses.'
    );
  }
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxAttempts = 3
) {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err || '');
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED');
      if (!isTransient || attempt >= maxAttempts) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1200));
    }
  }
  throw lastErr;
}

function formatFriendlyGeminiError(err: unknown, fallback: string): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const lower = rawMsg.toLowerCase();
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return {
      status: 503,
      message: 'Layanan AI sedang padat sesaat. Silakan ketuk Analisa kembali dalam beberapa detik.',
    };
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      message: 'Batas permintaan AI sementara tercapai. Tunggu sebentar lalu coba lagi.',
    };
  }
  if (lower.includes('unexpected token')) {
    return {
      status: 502,
      message:
        'Format pembacaan dokumen dari AI terganggu. Coba unggah foto lebih jelas atau kurangi jumlah file sekaligus.',
    };
  }
  return {
    status: 500,
    message: rawMsg || fallback,
  };
}

async function startServer() {
  const app = express();

  // CORS for /api/* so Capacitor Android APK (https://localhost, capacitor://localhost)
  // and static PWA hosts (*.github.io, *.pages.dev, *.web.app) share the same live relay & AI APIs.
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Stateless Gemini Multimodal Smart Import for RTQu / PaguyubanQu / Komunitas
  // Registered BEFORE global 256kb parser so multi-photo/PDF base64 payloads work cleanly.
  app.post('/api/rtqu/smart-import', express.json({ limit: '25mb' }), async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'Layanan Smart Import AI belum dikonfigurasi (GEMINI_API_KEY tidak tersedia di server).',
      });
      return;
    }

    const body = req.body as {
      files?: Array<{ name?: string; mimeType?: string; base64?: string }>;
      textTables?: Array<{ fileName?: string; sheetName?: string; csvText?: string }>;
      orgTypeHint?: string;
      yearHint?: number;
    };

    const incomingFiles = Array.isArray(body?.files) ? body.files.slice(0, 12) : [];
    const textTables = Array.isArray(body?.textTables) ? body.textTables.slice(0, 12) : [];

    if (incomingFiles.length === 0 && textTables.length === 0) {
      res.status(400).json({ error: 'Unggah minimal 1 file (Excel, Foto/Screenshot, atau PDF).' });
      return;
    }

    const allowedMime = (m: string) =>
      m.startsWith('image/') || m === 'application/pdf' || m === 'text/plain' || m === 'text/csv';

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    const orgHintText = body?.orgTypeHint ? `Petunjuk kategori awal dari pengguna: "${body.orgTypeHint}".` : '';
    const yearHintNumber =
      typeof body?.yearHint === 'number' && body.yearHint >= 2020 && body.yearHint <= 2035
        ? body.yearHint
        : new Date().getFullYear();

    const promptText = `Anda adalah asisten ekstraksi data administrasi komunitas warga Indonesia (RT, RW, Paguyuban Cluster/Perumahan, Organisasi, atau Sosial/DKM).
Tugas Anda: membaca seluruh gambar/foto/screenshot/PDF/tabel Excel yang diunggah lalu mengekstraknya menjadi data terstruktur lengkap agar siap ditinjau dalam tabel Excel.

${orgHintText}
Tahun acuan default jika tidak tertulis jelas: ${yearHintNumber}.

ATURAN EKSTRAKSI PENTING:
1. PROFIL KOMUNITAS:
   - Deteksi nama paguyuban / RT / RW / komunitas (contoh: "RT 03 / RW 05", "Paguyuban Cluster Harmoni", "DKM Al-Ikhlas").
   - Tentukan orgType paling sesuai: "RT", "Paguyuban", "Organisasi", atau "Sosial".
   - Deteksi areaName (kelurahan/perumahan/wilayah), nominal iuran bulanan default (monthlyDuesAmount dalam Rupiah integer, 0 jika tidak ditemukan/sukarela), tahun buku (year), dan openingBalance (saldo awal / saldo akhir pindahan jika tertulis).
2. PENGURUS:
   - Ekstrak semua nama pengurus beserta jabatannya (Ketua RT, Wakil Ketua, Sekretaris, Bendahara, Keamanan, Kebersihan, Koordinator, dll) ke array officers.
   - Isi division yang relevan (misal: "Pimpinan & Pengesahan", "Administrasi & Surat Warga", "Iuran & Transparansi Kas", "Keamanan & SiagaQu").
   - Sertakan phone / email bila tertera.
3. DAFTAR WARGA & STATUS IURAN:
   - Ekstrak daftar nama warga/KK/anggota ke array members.
   - Sertakan block (blok/no rumah/unit/alamat singkat), phone, residentType ("Tetap" atau "Kontrak").
   - Jika ada tanda centang (v/✓/Lunas/nominal) per bulan (Jan=1 .. Des=12), isi paidMonths sebagai array angka bulan 1..12 yang sudah dibayar, dan paidMonthsCount sebagai jumlah bulan lunas (0..12). Jika hanya ada jumlah bulan lunas (misal "Lunas 8 bln"), isi paidMonthsCount=8 dan paidMonths=[1..8].
   - Sertakan priorArrears (nominal tunggakan Rp jika ada) dan priorArrearsNote.
4. PEMASUKAN & PENGELUARAN KAS:
   - Ekstrak seluruh mutasi pemasukan dan pengeluaran kas yang terlihat (misal: iuran terkumpul, sumbangan, gaji satpam/keamanan, petugas sampah, listrik pos, perbaikan lampu/jalan, konsumsi rapat, dll).
   - Untuk setiap transaksi tentukan:
     - date: tanggal ringkas (misal "05 Okt 2026" atau sesuai catatan)
     - type: "masuk" atau "keluar"
     - category: pilih TEPAT SATU dari: "Iuran Warga" | "Donasi / Kas" | "Gaji Keamanan" | "Petugas Sampah" | "Listrik & Pos Ronda" | "Perbaikan Fasilitas"
     - title: keterangan jelas transaksi
     - amount: nominal Rupiah integer positif (>0)
     - recordedBy: nama pencatat/bendahara jika tertera, atau "Impor Dokumen"
5. ARSIP TAHUNAN (opsional):
   - Jika dokumen memuat rekap tahun-tahun sebelumnya (misal rekap total tahun 2023/2024/2025), masukkan ringkasannya ke archives.
6. JANGAN mengarang data warga atau transaksi fiktif yang tidak ada di dokumen. Jika suatu kolom tidak tercantum (misal nomor HP), isi string kosong "" atau "-" sesuai tipe. Nominal Rupiah tulis angka integer murni tanpa titik/koma.`;

    parts.push({ text: promptText });

    for (const f of incomingFiles) {
      const mimeType = typeof f.mimeType === 'string' ? f.mimeType.trim() : '';
      const rawB64 = typeof f.base64 === 'string' ? f.base64.trim() : '';
      if (!mimeType || !rawB64 || !allowedMime(mimeType)) continue;
      const cleanB64 = rawB64.includes('base64,') ? rawB64.split('base64,')[1] || '' : rawB64;
      if (!cleanB64) continue;
      parts.push({ text: `Dokumen terlampir: ${f.name || 'lampiran'}` });
      parts.push({
        inlineData: {
          mimeType,
          data: cleanB64,
        },
      });
    }

    for (const tbl of textTables) {
      if (typeof tbl?.csvText === 'string' && tbl.csvText.trim()) {
        parts.push({
          text: `Tabel Excel (${tbl.fileName || 'excel.xlsx'} - Sheet "${tbl.sheetName || 'Sheet1'}"):\n${tbl.csvText.slice(0, 35000)}`,
        });
      }
    }

    if (parts.length <= 1) {
      res.status(400).json({ error: 'Tidak ada isi dokumen valid untuk diproses.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await generateContentWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              profile: {
                type: Type.OBJECT,
                properties: {
                  orgType: { type: Type.STRING },
                  customBrandName: { type: Type.STRING },
                  orgName: { type: Type.STRING },
                  areaName: { type: Type.STRING },
                  monthlyDuesAmount: { type: Type.INTEGER },
                  year: { type: Type.INTEGER },
                  openingBalance: { type: Type.INTEGER },
                  openingBalanceNote: { type: Type.STRING },
                },
                required: ['orgType', 'orgName', 'areaName', 'monthlyDuesAmount', 'year'],
              },
              officers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    role: { type: Type.STRING },
                    division: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    email: { type: Type.STRING },
                  },
                  required: ['name', 'role'],
                },
              },
              members: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    block: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    residentType: { type: Type.STRING },
                    paidMonthsCount: { type: Type.INTEGER },
                    paidMonths: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                    },
                    priorArrears: { type: Type.INTEGER },
                    priorArrearsNote: { type: Type.STRING },
                  },
                  required: ['name'],
                },
              },
              transactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    type: { type: Type.STRING },
                    category: { type: Type.STRING },
                    title: { type: Type.STRING },
                    amount: { type: Type.INTEGER },
                    recordedBy: { type: Type.STRING },
                  },
                  required: ['type', 'category', 'title', 'amount'],
                },
              },
              archives: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    year: { type: Type.INTEGER },
                    totalIncome: { type: Type.INTEGER },
                    totalExpense: { type: Type.INTEGER },
                    endingBalance: { type: Type.INTEGER },
                    note: { type: Type.STRING },
                  },
                  required: ['year', 'endingBalance'],
                },
              },
              summaryNotes: { type: Type.STRING },
            },
            required: ['profile', 'officers', 'members', 'transactions'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'Respons AI kosong saat membaca dokumen.' });
        return;
      }
      const parsed = parseGeminiJsonObject<Record<string, unknown>>(rawText);
      res.json({ ok: true, draft: parsed });
    } catch (err) {
      console.error('[WargaQu SmartImport] Gemini error:', err);
      const friendly = formatFriendlyGeminiError(err, 'Terjadi kesalahan saat menganalisa dokumen.');
      res.status(friendly.status).json({
        error: `Gagal menganalisa dokumen: ${friendly.message}`,
      });
    }
  });

  // Stateless Gemini Natural-Language / Speech-to-Text Parser for DompetQu
  app.post('/api/dompetqu/parse-speech', express.json({ limit: '1mb' }), async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error: 'Layanan Smart Voice DompetQu belum dikonfigurasi (GEMINI_API_KEY tidak tersedia).',
      });
      return;
    }

    const body = req.body as {
      transcript?: string;
      wallets?: Array<{ id?: string; name?: string; kind?: string }>;
    };

    const transcript = typeof body?.transcript === 'string' ? body.transcript.trim() : '';
    if (!transcript || transcript.length < 3) {
      res.status(400).json({ error: 'Teks atau hasil rekaman suara masih kosong.' });
      return;
    }

    const walletList = Array.isArray(body?.wallets) ? body.wallets.slice(0, 12) : [];
    const walletContext =
      walletList.length > 0
        ? walletList
            .map(w => `- id="${w.id || ''}" nama="${w.name || ''}" jenis="${w.kind || 'cash'}"`)
            .join('\n')
        : `- id="cash" nama="Dompet Cash" jenis="cash"\n- id="bank" nama="Tabungan ATM / Bank" jenis="bank"\n- id="ewallet" nama="E-Wallet" jenis="ewallet"`;

    const prompt = `Anda adalah asisten pencatat keuangan pribadi Indonesia untuk modul DompetQu.
Tugas Anda: memecah kalimat ucapan sehari-hari (bisa banyak item sekaligus, dipisah koma atau kata sambung) menjadi daftar transaksi keuangan yang rapi agar pengguna tinggal mengecek dan mengedit sebelum disimpan.

Daftar kantong saldo milik pengguna:
${walletContext}

Teks ucapan pengguna:
"${transcript.slice(0, 4000)}"

ATURAN EKSTRAKSI:
1. Pecah setiap item pemasukan atau pengeluaran menjadi objek terpisah (meskipun tanpa tanda koma, hanya dipisah spasi).
   Contoh input 1: "masuk 100000 bensin 20000 makan 15000" -> [{type:"masuk", title:"Pemasukan", amount:100000}, {type:"keluar", title:"Bensin", amount:20000}, {type:"keluar", title:"Makan", amount:15000}]
   Contoh input 2: "gaji 5 juta masuk atm, belanja sayur 75rb, cicilan rumah 1,5 juta, jajan bocah 20rb, ongkos kerja 35rb, makan siang 40rb"
2. Tentukan "type": "masuk" (masuk, pemasukan, gaji, bonus, komisi, dapat uang, jual, transfer masuk, dll) atau "keluar" (belanja, bensin, makan, rumah, listrik, sewa, jajan bocah, ongkos kerja, parkir, kopi, obat, dll).
3. Pilih "category" TEPAT SATU dari daftar berikut:
   - Pemasukan: "Gaji", "Bonus & Lembur", "Usaha & Sampingan", "Pemasukan Lainnya"
   - Pengeluaran: "Belanja Harian", "Rumah & Tagihan", "Jajan Bocah", "Ongkos Kerja", "Makan & Minum", "Kesehatan & Obat", "Keluarga & Sosial", "Pengeluaran Lainnya"
4. Konversi angka bahasa Indonesia sehari-hari ke Rupiah integer murni:
   - "rb" / "ribu" = x1000 ("75rb" -> 75000, "dua puluh lima ribu" -> 25000)
   - "jt" / "juta" = x1000000 ("5jt" -> 5000000, "1,5 juta" / "satu setengah juta" -> 1500000)
   - "setengah juta" -> 500000, "gocap" -> 50000, "ceban" -> 10000, "noban" -> 20000, "goban" -> 50000, "seceng" -> 1000, "cepek" -> 100000
5. Tentukan "walletId" yang paling cocok dari daftar kantong pengguna:
   - Jika disebut "atm", "bank", "rekening", "transfer", atau gaji bulanan tanpa keterangan -> pilih kantong jenis "bank".
   - Jika disebut "gopay", "ovo", "dana", "shopeepay", "qris", "ewallet" -> pilih kantong jenis "ewallet".
   - Jika disebut "cash", "tunai", "dompet", "uang saku" atau pengeluaran kecil harian tanpa sebut rekening -> pilih kantong jenis "cash".
   - Jika ragu, gunakan id kantong pertama yang tersedia.
6. "title": ringkas dan persis seperti item yang diucapkan (misal "Pemasukan", "Bensin", "Makan", "Jajan Bocah", "Ongkos Kerja", "Belanja Sayur").
7. Jangan mengarang transaksi yang tidak disebutkan. Jika nominal tidak disebut sama sekali pada satu item, isi amount = 0 agar pengguna mengisinya di struk edit.`;

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await generateContentWithRetry(ai, {
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    category: { type: Type.STRING },
                    title: { type: Type.STRING },
                    amount: { type: Type.INTEGER },
                    walletId: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                  required: ['type', 'category', 'title', 'amount', 'walletId'],
                },
              },
            },
            required: ['items'],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.status(502).json({ error: 'Respons AI kosong saat memproses ucapan.' });
        return;
      }
      const parsed = parseGeminiJsonObject<{ items?: unknown[] }>(rawText);
      res.json({ ok: true, items: Array.isArray(parsed?.items) ? parsed.items : [] });
    } catch (err) {
      console.error('[WargaQu DompetQu ParseSpeech] Gemini error:', err);
      const friendly = formatFriendlyGeminiError(
        err,
        'Terjadi kesalahan saat memproses catatan suara.'
      );
      res.status(friendly.status).json({
        error: `Gagal memproses suara: ${friendly.message}`,
      });
    }
  });

  // Volatile RAM pairing & live-sync mailboxes (zero DB / zero disk / auto-pruned)
  const pairJsonParser = express.json({ limit: '15mb' });
  const volatilePairSessions = new Map<
    string,
    { sessionId: string; pubJwk: unknown; expiresAt: number }
  >();
  const volatilePairPayloads = new Map<
    string,
    {
      linkId: string;
      encrypted: unknown;
      senderPubJwk?: unknown;
      createdAt: number;
      ack?: { linkId: string; deviceName: string; browserInfo: string; restoredKeys: number };
      expiresAt: number;
    }
  >();
  const volatilePairLiveRooms = new Map<
    string,
    {
      linkId: string;
      seq: number;
      senderDeviceId: string;
      encrypted: unknown;
      updatedAt: number;
      expiresAt: number;
    }
  >();
  const PAIR_SESSION_TTL_MS = 5 * 60 * 1000;
  const PAIR_LIVE_TTL_MS = 24 * 60 * 60 * 1000;
  const ACCOUNT_SYNC_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const PWA_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

  const volatileAccountSync = new Map<
    string,
    {
      accountHash: string;
      salt: string;
      iv: string;
      ct: string;
      keyCount: number;
      source: string;
      updatedAt: number;
      expiresAt: number;
    }
  >();

  const volatilePwaHandoffs = new Map<
    string,
    {
      code: string;
      iv: string;
      ct: string;
      keyCount: number;
      createdAt: number;
      expiresAt: number;
    }
  >();

  const SESSION_REGISTRY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const LELUHUR_META_TTL_MS = 14 * 24 * 60 * 60 * 1000;

  const volatileActiveSessions = new Map<
    string,
    {
      accountKey: string;
      sessionNonce: string;
      container: 'apk' | 'pwa';
      deviceIdHash: string;
      issuedAt: string;
      updatedAt: number;
      expiresAt: number;
    }
  >();

  const volatileTrahVersions = new Map<
    string,
    {
      slug: string;
      trahId: string;
      title: string;
      dataVersion: number;
      memberCount: number;
      approvedBy: string;
      summary: string;
      updatedAt: number;
      expiresAt: number;
    }
  >();

  const volatileTrahProposals = new Map<
    string,
    Array<{
      id: string;
      trahId: string;
      trahSlug: string;
      trahName: string;
      actionType: string;
      proposerName: string;
      proposerEmail?: string;
      targetName?: string;
      summary: string;
      details?: string;
      baseVersion: number;
      createdAt: string;
      status: 'pending' | 'approved' | 'rejected';
      reviewedAt?: string;
      reviewedBy?: string;
      operations: unknown[];
      expiresAt: number;
    }>
  >();

  // Ephemeral /tmp transit cache (ONLY SHA-256 session tokens, E2EE ciphertext, & Trah version headers)
  // Survives Cloud Run / dev-server restarts without storing any unencrypted citizen database or photos.
  const TRANSIT_CACHE_PATH = '/tmp/wargaqu-relay-transit-v1.json';
  let transitSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function loadVolatileTransitCache() {
    try {
      if (!fs.existsSync(TRANSIT_CACHE_PATH)) return;
      const raw = fs.readFileSync(TRANSIT_CACHE_PATH, 'utf8');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        sessions?: Array<[string, any]>;
        accountSync?: Array<[string, any]>;
        trahVersions?: Array<[string, any]>;
        trahProposals?: Array<[string, any]>;
      };
      const now = Date.now();
      if (Array.isArray(parsed.sessions)) {
        for (const [k, v] of parsed.sessions) {
          if (k && v && typeof v.expiresAt === 'number' && v.expiresAt > now) {
            volatileActiveSessions.set(k, v);
          }
        }
      }
      if (Array.isArray(parsed.accountSync)) {
        for (const [k, v] of parsed.accountSync) {
          if (k && v && typeof v.expiresAt === 'number' && v.expiresAt > now) {
            volatileAccountSync.set(k, v);
          }
        }
      }
      if (Array.isArray(parsed.trahVersions)) {
        for (const [k, v] of parsed.trahVersions) {
          if (k && v && typeof v.expiresAt === 'number' && v.expiresAt > now) {
            volatileTrahVersions.set(k, v);
          }
        }
      }
      if (Array.isArray(parsed.trahProposals)) {
        for (const [k, v] of parsed.trahProposals) {
          if (k && Array.isArray(v)) {
            const active = v.filter(p => p && typeof p.expiresAt === 'number' && p.expiresAt > now);
            if (active.length > 0) volatileTrahProposals.set(k, active);
          }
        }
      }
    } catch {
      // ignore corrupted ephemeral cache
    }
  }

  function scheduleSaveVolatileTransitCache() {
    if (transitSaveTimer) return;
    transitSaveTimer = setTimeout(() => {
      transitSaveTimer = null;
      try {
        const snapshot = {
          sessions: Array.from(volatileActiveSessions.entries()).slice(0, 1500),
          accountSync: Array.from(volatileAccountSync.entries()).slice(0, 300),
          trahVersions: Array.from(volatileTrahVersions.entries()).slice(0, 400),
          trahProposals: Array.from(volatileTrahProposals.entries()).slice(0, 300),
        };
        fs.writeFileSync(TRANSIT_CACHE_PATH, JSON.stringify(snapshot), 'utf8');
      } catch {
        // ignore ephemeral disk errors
      }
    }, 350);
  }

  loadVolatileTransitCache();

  function pruneExpiredPairData() {
    const now = Date.now();
    for (const [k, v] of volatilePairSessions.entries()) {
      if (v.expiresAt <= now) volatilePairSessions.delete(k);
    }
    for (const [k, v] of volatilePairPayloads.entries()) {
      if (v.expiresAt <= now) volatilePairPayloads.delete(k);
    }
    for (const [k, v] of volatilePairLiveRooms.entries()) {
      if (v.expiresAt <= now) volatilePairLiveRooms.delete(k);
    }
    for (const [k, v] of volatileAccountSync.entries()) {
      if (v.expiresAt <= now) volatileAccountSync.delete(k);
    }
    for (const [k, v] of volatilePwaHandoffs.entries()) {
      if (v.expiresAt <= now) volatilePwaHandoffs.delete(k);
    }
    for (const [k, v] of volatileActiveSessions.entries()) {
      if (v.expiresAt <= now) volatileActiveSessions.delete(k);
    }
    for (const [k, v] of volatileTrahVersions.entries()) {
      if (v.expiresAt <= now) volatileTrahVersions.delete(k);
    }
    for (const [slug, arr] of volatileTrahProposals.entries()) {
      const active = arr.filter(p => p.expiresAt > now);
      if (active.length === 0) volatileTrahProposals.delete(slug);
      else if (active.length !== arr.length) volatileTrahProposals.set(slug, active);
    }
    while (volatilePairSessions.size > 300) {
      const oldest = volatilePairSessions.keys().next().value;
      if (!oldest) break;
      volatilePairSessions.delete(oldest);
    }
    while (volatilePairPayloads.size > 300) {
      const oldest = volatilePairPayloads.keys().next().value;
      if (!oldest) break;
      volatilePairPayloads.delete(oldest);
    }
    while (volatilePairLiveRooms.size > 300) {
      const oldest = volatilePairLiveRooms.keys().next().value;
      if (!oldest) break;
      volatilePairLiveRooms.delete(oldest);
    }
    while (volatileAccountSync.size > 400) {
      const oldest = volatileAccountSync.keys().next().value;
      if (!oldest) break;
      volatileAccountSync.delete(oldest);
    }
    while (volatilePwaHandoffs.size > 400) {
      const oldest = volatilePwaHandoffs.keys().next().value;
      if (!oldest) break;
      volatilePwaHandoffs.delete(oldest);
    }
    while (volatileActiveSessions.size > 2000) {
      const oldest = volatileActiveSessions.keys().next().value;
      if (!oldest) break;
      volatileActiveSessions.delete(oldest);
    }
    while (volatileTrahVersions.size > 500) {
      const oldest = volatileTrahVersions.keys().next().value;
      if (!oldest) break;
      volatileTrahVersions.delete(oldest);
    }
    while (volatileTrahProposals.size > 400) {
      const oldest = volatileTrahProposals.keys().next().value;
      if (!oldest) break;
      volatileTrahProposals.delete(oldest);
    }
  }

  // Laptop registers ephemeral ECDH public key so 6-char short session code works too
  app.post('/api/pair-session', pairJsonParser, (req, res) => {
    pruneExpiredPairData();
    const body = req.body as { sessionId?: unknown; pubJwk?: unknown };
    const sessionId = String(body?.sessionId || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (sessionId.length !== 6 || !body?.pubJwk || typeof body.pubJwk !== 'object') {
      res.status(400).json({ error: 'Invalid pairing session' });
      return;
    }
    volatilePairSessions.set(sessionId, {
      sessionId,
      pubJwk: body.pubJwk,
      expiresAt: Date.now() + PAIR_SESSION_TTL_MS,
    });
    res.json({ ok: true, sessionId });
  });

  app.get('/api/pair-session/:sessionId', (req, res) => {
    pruneExpiredPairData();
    const sessionId = String(req.params.sessionId || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const entry = volatilePairSessions.get(sessionId);
    if (!entry) {
      res.status(404).json({ error: 'Kode sesi tidak ditemukan atau sudah kedaluwarsa.' });
      return;
    }
    res.json({ found: true, sessionId: entry.sessionId, pubJwk: entry.pubJwk });
  });

  // Phone posts encrypted pairing payload (HTTP dual-transport alongside WebSocket)
  app.post('/api/pair-relay/:sessionId', pairJsonParser, (req, res) => {
    pruneExpiredPairData();
    const sessionId = String(req.params.sessionId || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const body = req.body as { linkId?: unknown; encrypted?: unknown; senderPubJwk?: unknown };
    const linkId = String(body?.linkId || '').trim();
    if (sessionId.length !== 6 || !linkId || !body?.encrypted || typeof body.encrypted !== 'object') {
      res.status(400).json({ error: 'Invalid pairing payload' });
      return;
    }
    volatilePairPayloads.set(sessionId, {
      linkId,
      encrypted: body.encrypted,
      senderPubJwk: body.senderPubJwk,
      createdAt: Date.now(),
      expiresAt: Date.now() + PAIR_SESSION_TTL_MS,
    });
    res.json({ ok: true });
  });

  // Laptop polls encrypted pairing payload
  app.get('/api/pair-relay/:sessionId', (req, res) => {
    pruneExpiredPairData();
    const sessionId = String(req.params.sessionId || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const entry = volatilePairPayloads.get(sessionId);
    if (!entry) {
      res.json({ found: false });
      return;
    }
    res.json({
      found: true,
      linkId: entry.linkId,
      encrypted: entry.encrypted,
      senderPubJwk: entry.senderPubJwk,
      createdAt: entry.createdAt,
    });
  });

  // Laptop confirms receipt back to Phone
  app.post('/api/pair-relay/:sessionId/ack', pairJsonParser, (req, res) => {
    pruneExpiredPairData();
    const sessionId = String(req.params.sessionId || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const body = req.body as {
      linkId?: unknown;
      deviceName?: unknown;
      browserInfo?: unknown;
      restoredKeys?: unknown;
    };
    const ack = {
      linkId: String(body?.linkId || '').trim(),
      deviceName: String(body?.deviceName || 'Laptop / PC Browser').slice(0, 80),
      browserInfo: String(body?.browserInfo || '').slice(0, 100),
      restoredKeys: Number(body?.restoredKeys || 0),
    };
    const existing = volatilePairPayloads.get(sessionId);
    if (existing) {
      existing.ack = ack;
      existing.expiresAt = Date.now() + 60 * 1000;
    } else {
      volatilePairPayloads.set(sessionId, {
        linkId: ack.linkId,
        encrypted: null,
        createdAt: Date.now(),
        ack,
        expiresAt: Date.now() + 60 * 1000,
      });
    }
    res.json({ ok: true });
  });

  app.get('/api/pair-relay/:sessionId/ack', (req, res) => {
    pruneExpiredPairData();
    const sessionId = String(req.params.sessionId || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const entry = volatilePairPayloads.get(sessionId);
    if (!entry?.ack) {
      res.json({ acked: false });
      return;
    }
    res.json({ acked: true, ...entry.ack });
  });

  // Bidirectional HP <-> Laptop live-sync mailbox (works even across sleep/reconnects)
  app.post('/api/pair-live/:linkId', pairJsonParser, (req, res) => {
    pruneExpiredPairData();
    const linkId = String(req.params.linkId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    const body = req.body as { senderDeviceId?: unknown; encrypted?: unknown };
    const senderDeviceId = String(body?.senderDeviceId || '').trim().slice(0, 80);
    if (!linkId || !senderDeviceId || !body?.encrypted || typeof body.encrypted !== 'object') {
      res.status(400).json({ error: 'Invalid live sync payload' });
      return;
    }
    const prev = volatilePairLiveRooms.get(linkId);
    const seq = (prev?.seq || 0) + 1;
    const updatedAt = Date.now();
    volatilePairLiveRooms.set(linkId, {
      linkId,
      seq,
      senderDeviceId,
      encrypted: body.encrypted,
      updatedAt,
      expiresAt: updatedAt + PAIR_LIVE_TTL_MS,
    });
    res.json({ ok: true, seq, updatedAt });
  });

  app.get('/api/pair-live/:linkId', (req, res) => {
    pruneExpiredPairData();
    const linkId = String(req.params.linkId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    const sinceSeq = Number(req.query.sinceSeq || 0);
    const deviceId = String(req.query.deviceId || '').trim();
    const entry = volatilePairLiveRooms.get(linkId);
    if (!entry || entry.seq <= sinceSeq || (deviceId && entry.senderDeviceId === deviceId)) {
      res.json({ hasUpdate: false, seq: entry?.seq || sinceSeq });
      return;
    }
    res.json({
      hasUpdate: true,
      seq: entry.seq,
      senderDeviceId: entry.senderDeviceId,
      encrypted: entry.encrypted,
      updatedAt: entry.updatedAt,
    });
  });

  // Zero-Knowledge Encrypted Account Sync (PWA <-> Native APK auto-restore via Email+HP key)
  app.post('/api/account-sync', pairJsonParser, (req, res) => {
    pruneExpiredPairData();
    const body = req.body as {
      accountHash?: unknown;
      salt?: unknown;
      iv?: unknown;
      ct?: unknown;
      keyCount?: unknown;
      source?: unknown;
    };
    const accountHash = String(body?.accountHash || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-f0-9]/g, '');
    const salt = typeof body?.salt === 'string' ? body.salt.trim() : '';
    const iv = typeof body?.iv === 'string' ? body.iv.trim() : '';
    const ct = typeof body?.ct === 'string' ? body.ct.trim() : '';
    const keyCount = Math.max(0, Number(body?.keyCount || 0));
    const source = String(body?.source || 'pwa').slice(0, 24);

    if (accountHash.length < 32 || !salt || !iv || !ct) {
      res.status(400).json({ error: 'Invalid encrypted account sync payload' });
      return;
    }

    const updatedAt = Date.now();
    volatileAccountSync.set(accountHash, {
      accountHash,
      salt,
      iv,
      ct,
      keyCount,
      source,
      updatedAt,
      expiresAt: updatedAt + ACCOUNT_SYNC_TTL_MS,
    });
    scheduleSaveVolatileTransitCache();
    res.json({ ok: true, updatedAt, keyCount });
  });

  app.get('/api/account-sync/:accountHash', (req, res) => {
    pruneExpiredPairData();
    const accountHash = String(req.params.accountHash || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-f0-9]/g, '');
    const entry = volatileAccountSync.get(accountHash);
    if (!entry) {
      res.json({ found: false });
      return;
    }
    res.json({
      found: true,
      salt: entry.salt,
      iv: entry.iv,
      ct: entry.ct,
      keyCount: entry.keyCount,
      source: entry.source,
      updatedAt: entry.updatedAt,
    });
  });

  // 1-Tap Same-Phone PWA -> APK Encrypted Handoff (works even in Guest Mode without login)
  app.post('/api/pwa-handoff', pairJsonParser, (req, res) => {
    pruneExpiredPairData();
    const body = req.body as { iv?: unknown; ct?: unknown; keyCount?: unknown };
    const iv = typeof body?.iv === 'string' ? body.iv.trim() : '';
    const ct = typeof body?.ct === 'string' ? body.ct.trim() : '';
    const keyCount = Math.max(0, Number(body?.keyCount || 0));

    if (!iv || !ct) {
      res.status(400).json({ error: 'Invalid PWA handoff payload' });
      return;
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += chars[crypto.randomInt(0, chars.length)];
    }

    const createdAt = Date.now();
    const expiresAt = createdAt + PWA_HANDOFF_TTL_MS;
    volatilePwaHandoffs.set(code, {
      code,
      iv,
      ct,
      keyCount,
      createdAt,
      expiresAt,
    });

    res.json({ ok: true, code, keyCount, createdAt, expiresAt });
  });

  app.get('/api/pwa-handoff/:code', (req, res) => {
    pruneExpiredPairData();
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const entry = volatilePwaHandoffs.get(code);
    if (!entry) {
      res.status(404).json({ found: false, error: 'Kode transfer PWA kedaluwarsa atau tidak ditemukan.' });
      return;
    }
    res.json({
      found: true,
      code: entry.code,
      iv: entry.iv,
      ct: entry.ct,
      keyCount: entry.keyCount,
      createdAt: entry.createdAt,
    });
  });

  app.use(express.json({ limit: '256kb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Volatile RAM routing tables ONLY (no persistent database / zero citizen storage)
  const clients = new Set<ConnectedClient>();
  const channelSubscribers = new Map<string, Set<ConnectedClient>>();
  let volatileMonetizeRules: unknown = null;
  let volatileAccountPolicies: unknown = null;
  const volatileFrozenDeviceMasks = new Set<string>();
  const volatileInviteTickets = new Map<string, { payload: string; expiresAt: number }>();
  const volatileInviteRooms = new Map<
    string,
    {
      kind: 'trah' | 'rt';
      slug: string;
      title: string;
      inviter: string;
      snapshot: string;
      updatedAt: number;
      expiresAt: number;
    }
  >();
  const volatilePresenceMap = new Map<
    string,
    { data: Record<string, unknown>; lastSeenMs: number }
  >();
  const volatileQuizRooms = new Map<
    string,
    { trahSlug: string; rounds: unknown[]; updatedAt: number; expiresAt: number }
  >();
  const TICKET_TTL_MS = 72 * 60 * 60 * 1000;
  const PRESENCE_TTL_MS = 24 * 60 * 60 * 1000;
  const MAX_VOLATILE_TICKETS = 500;
  const MAX_VOLATILE_PRESENCE = 1000;
  const serverStartedAtMs = Date.now();

  function pruneExpiredPresence() {
    const now = Date.now();
    for (const [k, v] of volatilePresenceMap.entries()) {
      if (now - v.lastSeenMs > PRESENCE_TTL_MS) {
        volatilePresenceMap.delete(k);
      }
    }
    while (volatilePresenceMap.size > MAX_VOLATILE_PRESENCE) {
      const oldestKey = volatilePresenceMap.keys().next().value;
      if (!oldestKey) break;
      volatilePresenceMap.delete(oldestKey);
    }
  }

  function pruneExpiredTickets() {
    const now = Date.now();
    for (const [k, v] of volatileInviteTickets.entries()) {
      if (v.expiresAt <= now) {
        volatileInviteTickets.delete(k);
      }
    }
    while (volatileInviteTickets.size > MAX_VOLATILE_TICKETS) {
      const oldestKey = volatileInviteTickets.keys().next().value;
      if (!oldestKey) break;
      volatileInviteTickets.delete(oldestKey);
    }
    for (const [k, v] of volatileInviteRooms.entries()) {
      if (v.expiresAt <= now) {
        volatileInviteRooms.delete(k);
      }
    }
    while (volatileInviteRooms.size > MAX_VOLATILE_TICKETS) {
      const oldestKey = volatileInviteRooms.keys().next().value;
      if (!oldestKey) break;
      volatileInviteRooms.delete(oldestKey);
    }
    for (const [k, v] of volatileQuizRooms.entries()) {
      if (v.expiresAt <= now) {
        volatileQuizRooms.delete(k);
      }
    }
    while (volatileQuizRooms.size > 200) {
      const oldestKey = volatileQuizRooms.keys().next().value;
      if (!oldestKey) break;
      volatileQuizRooms.delete(oldestKey);
    }
  }

  function subscribeClient(client: ConnectedClient, channel: string) {
    const clean = channel.trim();
    if (!clean) return;
    client.channels.add(clean);
    let set = channelSubscribers.get(clean);
    if (!set) {
      set = new Set<ConnectedClient>();
      channelSubscribers.set(clean, set);
    }
    set.add(client);
  }

  function removeClientFromAll(client: ConnectedClient) {
    for (const ch of client.channels) {
      const set = channelSubscribers.get(ch);
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          channelSubscribers.delete(ch);
        }
      }
    }
    client.channels.clear();
    clients.delete(client);
    broadcastAdminTelemetry();
  }

  function broadcastToChannel(channel: string, data: string, excludeClient?: ConnectedClient) {
    const set = channelSubscribers.get(channel);
    if (!set) return;
    for (const sub of set) {
      if (sub === excludeClient) continue;
      if (sub.ws.readyState === WebSocket.OPEN) {
        sub.ws.send(data);
      }
    }
  }

  function buildTelemetryPayload() {
    pruneExpiredPresence();
    pruneExpiredTickets();
    return {
      connectedClients: clients.size,
      activeChannels: channelSubscribers.size,
      activePresenceRamCount: volatilePresenceMap.size,
      activeQuizRooms: volatileQuizRooms.size,
      activeTransitTickets: volatileInviteTickets.size + volatileInviteRooms.size,
      uptimeSec: Math.max(0, Math.floor((Date.now() - serverStartedAtMs) / 1000)),
      sentAt: new Date().toISOString(),
    };
  }

  function broadcastAdminTelemetry(excludeClient?: ConnectedClient) {
    const frame = JSON.stringify({
      type: 'relay:event',
      eventId: `telemetry-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      channel: 'admin:policy',
      eventName: 'admin:telemetry',
      payload: buildTelemetryPayload(),
      sentAt: new Date().toISOString(),
    });
    broadcastToChannel('admin:policy', frame, excludeClient);
  }

  wss.on('connection', (ws) => {
    const client: ConnectedClient = {
      ws,
      channels: new Set<string>(),
      clientId: `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    };
    clients.add(client);
    subscribeClient(client, 'admin:policy');
    broadcastAdminTelemetry(client);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as RelayEnvelope;

        if (msg.type === 'relay:ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'relay:pong', sentAt: new Date().toISOString() }));
          }
          return;
        }

        if (msg.type === 'relay:join' && Array.isArray(msg.channels)) {
          for (const ch of msg.channels) {
            if (typeof ch === 'string') {
              subscribeClient(client, ch);
            }
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'relay:joined',
                channels: Array.from(client.channels),
                sentAt: new Date().toISOString(),
              })
            );
            ws.send(
              JSON.stringify({
                type: 'relay:event',
                eventId: `telemetry-init-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                channel: 'admin:policy',
                eventName: 'admin:telemetry',
                payload: buildTelemetryPayload(),
                sentAt: new Date().toISOString(),
              })
            );
            // Send lightweight volatile admin policy / frozen-device blocklist on join
            if (volatileMonetizeRules) {
              ws.send(
                JSON.stringify({
                  type: 'relay:event',
                  eventId: `policy-init-${Date.now()}`,
                  channel: 'admin:policy',
                  eventName: 'admin:monetize_rules',
                  payload: volatileMonetizeRules,
                  sentAt: new Date().toISOString(),
                })
              );
            }
            if (volatileAccountPolicies) {
              ws.send(
                JSON.stringify({
                  type: 'relay:event',
                  eventId: `accgov-init-${Date.now()}`,
                  channel: 'admin:policy',
                  eventName: 'admin:account_policies',
                  payload: volatileAccountPolicies,
                  sentAt: new Date().toISOString(),
                })
              );
            }
            if (volatileFrozenDeviceMasks.size > 0) {
              ws.send(
                JSON.stringify({
                  type: 'relay:event',
                  eventId: `zt-init-${Date.now()}`,
                  channel: 'admin:policy',
                  eventName: 'zt:frozen_list',
                  payload: Array.from(volatileFrozenDeviceMasks),
                  sentAt: new Date().toISOString(),
                })
              );
            }
          }
          broadcastAdminTelemetry(client);
          return;
        }

        if (msg.type === 'relay:publish' && msg.channel && msg.eventName) {
          // Keep ONLY ephemeral admin rules / device freeze list / active presence in RAM; zero DB/disk
          if (msg.eventName === 'admin:monetize_rules' && msg.payload) {
            volatileMonetizeRules = msg.payload;
          } else if (msg.eventName === 'admin:account_policies' && msg.payload) {
            volatileAccountPolicies = msg.payload;
          } else if (
            msg.eventName === 'presence:heartbeat' &&
            msg.payload &&
            typeof msg.payload === 'object'
          ) {
            const p = msg.payload as Record<string, unknown>;
            const key = typeof p.accountKey === 'string' ? p.accountKey.trim() : '';
            if (key) {
              client.accountKey = key;
              pruneExpiredPresence();
              volatilePresenceMap.set(key, { data: p, lastSeenMs: Date.now() });
              broadcastAdminTelemetry();
            }
          } else if (
            msg.eventName === 'zt:device_freeze' &&
            msg.payload &&
            typeof msg.payload === 'object'
          ) {
            const p = msg.payload as { deviceId?: string; status?: string };
            if (p.deviceId && p.status === 'frozen_lost') {
              volatileFrozenDeviceMasks.add(p.deviceId);
            } else if (p.deviceId && p.status === 'trusted') {
              volatileFrozenDeviceMasks.delete(p.deviceId);
            }
          }

          const outbound = JSON.stringify({
            type: 'relay:event',
            eventId:
              msg.eventId ||
              `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            channel: msg.channel,
            eventName: msg.eventName,
            payload: msg.payload,
            senderDeviceHash: msg.senderDeviceHash,
            sentAt: msg.sentAt || new Date().toISOString(),
          });

          broadcastToChannel(msg.channel, outbound, client);
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on('close', () => {
      removeClientFromAll(client);
    });

    ws.on('error', () => {
      removeClientFromAll(client);
    });
  });

  // Ephemeral RAM-only Invite Link Transit (zero disk / zero DB, purely for short 1-2 line URLs)
  app.post('/api/relay-ticket', (req, res) => {
    const body = req.body as { payload?: unknown; prefix?: unknown };
    const payload = typeof body?.payload === 'string' ? body.payload.trim() : '';
    const rawPrefix = typeof body?.prefix === 'string' ? body.prefix.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() : 'T';
    const prefix = rawPrefix === 'Q' || rawPrefix === 'R' ? rawPrefix : 'T';
    if (!payload || payload.length > 220000) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }
    pruneExpiredTickets();
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const code = `${prefix}${suffix}`;
    volatileInviteTickets.set(code, {
      payload,
      expiresAt: Date.now() + TICKET_TTL_MS,
    });
    res.json({ code });
  });

  app.get('/api/relay-ticket/:code', (req, res) => {
    pruneExpiredTickets();
    const code = String(req.params.code || '').trim();
    const entry = volatileInviteTickets.get(code);
    if (!entry) {
      res.status(404).json({ error: 'Ticket expired or not found' });
      return;
    }
    res.json({ payload: entry.payload });
  });

  // Ephemeral RAM-only Title Room Transit (sync on entry via readable title slug, zero DB/disk)
  app.post('/api/invite-room', (req, res) => {
    const body = req.body as {
      kind?: unknown;
      slug?: unknown;
      title?: unknown;
      inviter?: unknown;
      snapshot?: unknown;
    };
    const kind = body?.kind === 'rt' ? 'rt' : body?.kind === 'trah' ? 'trah' : null;
    const rawSlug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const canonicalSlug = rawSlug.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : canonicalSlug;
    const inviter = typeof body?.inviter === 'string' ? body.inviter.trim().slice(0, 80) : 'WargaQu';
    const snapshot = typeof body?.snapshot === 'string' ? body.snapshot.trim() : '';

    if (!kind || !canonicalSlug || !snapshot || snapshot.length > 220000) {
      res.status(400).json({ error: 'Invalid room snapshot' });
      return;
    }

    pruneExpiredTickets();
    const roomKey = `${kind}:${canonicalSlug}`;
    const updatedAt = Date.now();
    volatileInviteRooms.set(roomKey, {
      kind,
      slug: canonicalSlug,
      title,
      inviter,
      snapshot,
      updatedAt,
      expiresAt: updatedAt + TICKET_TTL_MS,
    });
    res.json({ ok: true, roomKey, slug: canonicalSlug, updatedAt });
  });

  app.get('/api/invite-room/:kind/:slug', (req, res) => {
    pruneExpiredTickets();
    const kind = req.params.kind === 'rt' ? 'rt' : req.params.kind === 'trah' ? 'trah' : null;
    const canonicalSlug = String(req.params.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    if (!kind || !canonicalSlug) {
      res.status(400).json({ error: 'Invalid room key' });
      return;
    }
    const entry = volatileInviteRooms.get(`${kind}:${canonicalSlug}`);
    if (!entry) {
      res.status(404).json({ error: 'Room snapshot not active yet' });
      return;
    }
    res.json({
      found: true,
      kind: entry.kind,
      slug: entry.slug,
      title: entry.title,
      inviter: entry.inviter,
      snapshot: entry.snapshot,
      updatedAt: entry.updatedAt,
    });
  });

  // Single Active Session Registry (APK vs PWA cross-container invalidation without storing user DB)
  app.post('/api/session/register', (req, res) => {
    pruneExpiredPairData();
    const body = req.body as {
      accountKey?: unknown;
      sessionNonce?: unknown;
      container?: unknown;
      deviceIdHash?: unknown;
      issuedAt?: unknown;
      isCompanionLaptop?: unknown;
    };
    const accountKey = String(body?.accountKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-f0-9_-]/g, '')
      .slice(0, 80);
    const sessionNonce = String(body?.sessionNonce || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    const container: 'apk' | 'pwa' = body?.container === 'apk' ? 'apk' : 'pwa';
    const deviceIdHash = String(body?.deviceIdHash || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 80);
    const issuedAt = String(body?.issuedAt || new Date().toISOString()).slice(0, 48);

    if (body?.isCompanionLaptop === true) {
      res.json({ ok: true, skippedCompanion: true });
      return;
    }
    if (accountKey.length < 16 || !sessionNonce) {
      res.status(400).json({ error: 'Invalid session registration payload' });
      return;
    }

    const updatedAt = Date.now();
    volatileActiveSessions.set(accountKey, {
      accountKey,
      sessionNonce,
      container,
      deviceIdHash,
      issuedAt,
      updatedAt,
      expiresAt: updatedAt + SESSION_REGISTRY_TTL_MS,
    });
    scheduleSaveVolatileTransitCache();
    res.json({ ok: true, activeContainer: container, updatedAt });
  });

  app.get('/api/session/validate', (req, res) => {
    pruneExpiredPairData();
    if (req.query.isCompanionLaptop === '1' || req.query.isCompanionLaptop === 'true') {
      res.json({ valid: true, reason: 'companion' });
      return;
    }
    const accountKey = String(req.query.accountKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-f0-9_-]/g, '')
      .slice(0, 80);
    const sessionNonce = String(req.query.sessionNonce || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);

    if (accountKey.length < 16 || !sessionNonce) {
      res.status(400).json({ valid: true, reason: 'invalid_query' });
      return;
    }

    const active = volatileActiveSessions.get(accountKey);
    if (!active) {
      res.json({ valid: true, reason: 'unregistered' });
      return;
    }
    if (active.sessionNonce !== sessionNonce) {
      res.json({
        valid: false,
        reason: 'superseded',
        activeContainer: active.container,
        updatedAt: active.updatedAt,
      });
      return;
    }
    res.json({
      valid: true,
      reason: 'active',
      activeContainer: active.container,
      updatedAt: active.updatedAt,
    });
  });

  app.post('/api/session/logout', (req, res) => {
    pruneExpiredPairData();
    const body = req.body as { accountKey?: unknown; sessionNonce?: unknown };
    const accountKey = String(body?.accountKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-f0-9_-]/g, '')
      .slice(0, 80);
    const sessionNonce = String(body?.sessionNonce || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    const active = volatileActiveSessions.get(accountKey);
    if (active && (!sessionNonce || active.sessionNonce === sessionNonce)) {
      volatileActiveSessions.delete(accountKey);
      scheduleSaveVolatileTransitCache();
    }
    res.json({ ok: true });
  });

  // LeluhurQu Lightweight Reference Version Header & Staged Member Proposals (zero big DB)
  function sanitizeLeluhurSlug(raw: unknown): string {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  app.get('/api/leluhur/room/:slug/meta', (req, res) => {
    pruneExpiredPairData();
    const slug = sanitizeLeluhurSlug(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: 'Invalid trah slug' });
      return;
    }
    const header = volatileTrahVersions.get(slug) || null;
    const proposals = volatileTrahProposals.get(slug) || [];
    const pendingCount = proposals.filter(p => p.status === 'pending').length;
    res.json({
      found: Boolean(header),
      slug,
      header,
      pendingCount,
    });
  });

  app.post('/api/leluhur/room/:slug/release', (req, res) => {
    pruneExpiredPairData();
    const slug = sanitizeLeluhurSlug(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: 'Invalid trah slug' });
      return;
    }
    const body = req.body as {
      trahId?: unknown;
      title?: unknown;
      dataVersion?: unknown;
      memberCount?: unknown;
      approvedBy?: unknown;
      summary?: unknown;
    };
    const prev = volatileTrahVersions.get(slug);
    const reqVersion = Math.max(1, Math.floor(Number(body?.dataVersion || 1)));
    const nextVersion = prev ? Math.max(reqVersion, prev.dataVersion) : reqVersion;
    const now = Date.now();
    const header = {
      slug,
      trahId: String(body?.trahId || prev?.trahId || slug).slice(0, 80),
      title: String(body?.title || prev?.title || slug).slice(0, 120),
      dataVersion: nextVersion,
      memberCount: Math.max(0, Math.floor(Number(body?.memberCount ?? prev?.memberCount ?? 0))),
      approvedBy: String(body?.approvedBy || 'Pengurus Trah').slice(0, 80),
      summary: String(body?.summary || 'Pembaruan resmi Trah').slice(0, 180),
      updatedAt: now,
      expiresAt: now + LELUHUR_META_TTL_MS,
    };
    volatileTrahVersions.set(slug, header);
    scheduleSaveVolatileTransitCache();
    res.json({ ok: true, header });
  });

  app.get('/api/leluhur/room/:slug/proposals', (req, res) => {
    pruneExpiredPairData();
    const slug = sanitizeLeluhurSlug(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: 'Invalid trah slug' });
      return;
    }
    const proposals = volatileTrahProposals.get(slug) || [];
    res.json({
      found: proposals.length > 0,
      slug,
      proposals,
      pendingCount: proposals.filter(p => p.status === 'pending').length,
    });
  });

  app.post('/api/leluhur/room/:slug/proposals', pairJsonParser, (req, res) => {
    pruneExpiredPairData();
    const slug = sanitizeLeluhurSlug(req.params.slug);
    if (!slug) {
      res.status(400).json({ error: 'Invalid trah slug' });
      return;
    }
    const body = req.body as {
      id?: unknown;
      trahId?: unknown;
      trahName?: unknown;
      actionType?: unknown;
      proposerName?: unknown;
      proposerEmail?: unknown;
      targetName?: unknown;
      summary?: unknown;
      details?: unknown;
      baseVersion?: unknown;
      createdAt?: unknown;
      operations?: unknown;
    };
    const id = String(body?.id || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    const summary = String(body?.summary || '').trim().slice(0, 220);
    const operations = Array.isArray(body?.operations) ? body.operations.slice(0, 20) : [];

    if (!id || !summary || operations.length === 0) {
      res.status(400).json({ error: 'Invalid proposal payload' });
      return;
    }

    const now = Date.now();
    const entry = {
      id,
      trahId: String(body?.trahId || slug).slice(0, 80),
      trahSlug: slug,
      trahName: String(body?.trahName || slug).slice(0, 120),
      actionType: String(body?.actionType || 'member_update').slice(0, 32),
      proposerName: String(body?.proposerName || 'Anggota Keluarga').slice(0, 80),
      proposerEmail: body?.proposerEmail ? String(body.proposerEmail).slice(0, 120) : undefined,
      targetName: body?.targetName ? String(body.targetName).slice(0, 100) : undefined,
      summary,
      details: body?.details ? String(body.details).slice(0, 240) : undefined,
      baseVersion: Math.max(1, Math.floor(Number(body?.baseVersion || 1))),
      createdAt: String(body?.createdAt || new Date().toISOString()).slice(0, 48),
      status: 'pending' as const,
      operations,
      expiresAt: now + LELUHUR_META_TTL_MS,
    };

    const existing = volatileTrahProposals.get(slug) || [];
    const deduped = existing.filter(p => p.id !== id);
    const nextList = [entry, ...deduped].slice(0, 50);
    volatileTrahProposals.set(slug, nextList);
    scheduleSaveVolatileTransitCache();
    res.json({
      ok: true,
      proposal: entry,
      pendingCount: nextList.filter(p => p.status === 'pending').length,
    });
  });

  app.post('/api/leluhur/room/:slug/proposals/:proposalId/resolve', (req, res) => {
    pruneExpiredPairData();
    const slug = sanitizeLeluhurSlug(req.params.slug);
    const proposalId = String(req.params.proposalId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    if (!slug || !proposalId) {
      res.status(400).json({ error: 'Invalid proposal resolution request' });
      return;
    }
    const body = req.body as {
      decision?: unknown;
      reviewedBy?: unknown;
    };
    const decision: 'approved' | 'rejected' =
      body?.decision === 'rejected' ? 'rejected' : 'approved';
    const reviewedBy = String(body?.reviewedBy || 'Pengurus Trah').slice(0, 80);
    const reviewedAt = new Date().toISOString();

    const list = volatileTrahProposals.get(slug) || [];
    const updated = list.map(item =>
      item.id === proposalId
        ? {
            ...item,
            status: decision,
            reviewedBy,
            reviewedAt,
          }
        : item
    );
    volatileTrahProposals.set(slug, updated);
    res.json({
      ok: true,
      proposalId,
      decision,
      pendingCount: updated.filter(p => p.status === 'pending').length,
    });
  });

  // Ephemeral RAM-only active presence snapshot for Admin Zero Trust live monitoring
  app.get('/api/relay-presence', (_req, res) => {
    pruneExpiredPresence();
    res.json({
      mode: 'volatile-ram-only',
      connectedClients: clients.size,
      entries: Array.from(volatilePresenceMap.values()).map(v => v.data),
    });
  });

  app.post('/api/relay-presence', (req, res) => {
    const p = req.body as Record<string, unknown>;
    const key = typeof p?.accountKey === 'string' ? p.accountKey.trim() : '';
    if (!key) {
      res.status(400).json({ error: 'Invalid accountKey' });
      return;
    }
    pruneExpiredPresence();
    volatilePresenceMap.set(key, { data: p, lastSeenMs: Date.now() });
    broadcastAdminTelemetry();
    res.json({ ok: true });
  });

  // Ephemeral RAM-only Quiz Trah Rooms (sinkron ronde, sponsor, & skor lintas perangkat)
  app.get('/api/quiz-rounds/:trahSlug', (req, res) => {
    pruneExpiredTickets();
    const trahSlug = String(req.params.trahSlug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    if (!trahSlug) {
      res.status(400).json({ error: 'Invalid trahSlug' });
      return;
    }
    const entry = volatileQuizRooms.get(trahSlug);
    if (!entry) {
      res.json({ found: false, rounds: [] });
      return;
    }
    res.json({ found: true, trahSlug: entry.trahSlug, rounds: entry.rounds, updatedAt: entry.updatedAt });
  });

  app.post('/api/quiz-rounds/:trahSlug', pairJsonParser, (req, res) => {
    pruneExpiredTickets();
    const trahSlug = String(req.params.trahSlug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    const body = req.body as { rounds?: unknown };
    if (!trahSlug || !Array.isArray(body?.rounds)) {
      res.status(400).json({ error: 'Invalid quiz rounds payload' });
      return;
    }
    const updatedAt = Date.now();
    const trimmedRounds = body.rounds.slice(0, 40);
    if (trimmedRounds.length === 0) {
      volatileQuizRooms.delete(trahSlug);
    } else {
      volatileQuizRooms.set(trahSlug, {
        trahSlug,
        rounds: trimmedRounds,
        updatedAt,
        expiresAt: updatedAt + TICKET_TTL_MS,
      });
    }
    broadcastAdminTelemetry();
    res.json({ ok: true, trahSlug, count: trimmedRounds.length, updatedAt });
  });

  app.get('/api/relay-policy', (_req, res) => {
    res.json({
      accountPolicies: volatileAccountPolicies,
      monetizeRules: volatileMonetizeRules,
      frozenDeviceMasks: Array.from(volatileFrozenDeviceMasks),
    });
  });

  app.post('/api/relay-policy', (req, res) => {
    const body = req.body as { accountPolicies?: unknown };
    if (body?.accountPolicies && typeof body.accountPolicies === 'object') {
      volatileAccountPolicies = body.accountPolicies;
    }
    res.json({ ok: true });
  });

  const volatileDeviceBindingGuards = new Map<
    string,
    { accountHash: string; switchCount: number; windowStartMs: number; lastSeenMs: number }
  >();
  const DEVICE_SWITCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  const MAX_SERVER_DEVICE_SWITCHES = 2;

  app.post('/api/relay-device-binding', (req, res) => {
    const body = req.body as {
      deviceId?: string;
      emailHashHint?: string;
      action?: 'bind' | 'switch' | 'phone_change';
    };
    const rawDeviceId = String(body?.deviceId || '').trim();
    const rawEmail = String(body?.emailHashHint || '').trim().toLowerCase();
    if (!rawDeviceId || !rawEmail) {
      res.status(400).json({ error: 'Invalid device binding check payload' });
      return;
    }

    const deviceHash = crypto.createHash('sha256').update(`dev:${rawDeviceId}`).digest('hex').slice(0, 32);
    const accountHash = crypto.createHash('sha256').update(`acc:${rawEmail}`).digest('hex').slice(0, 32);
    const now = Date.now();

    const prev = volatileDeviceBindingGuards.get(deviceHash);
    let switchCount = 0;
    let windowStartMs = now;
    if (prev && now - prev.windowStartMs < DEVICE_SWITCH_WINDOW_MS) {
      switchCount = prev.switchCount;
      windowStartMs = prev.windowStartMs;
    }

    if (body?.action === 'switch' || (prev && prev.accountHash !== accountHash && body?.action === 'bind')) {
      switchCount += 1;
    }

    volatileDeviceBindingGuards.set(deviceHash, {
      accountHash,
      switchCount,
      windowStartMs,
      lastSeenMs: now,
    });

    const allowed = switchCount <= MAX_SERVER_DEVICE_SWITCHES;
    res.json({
      ok: true,
      allowed,
      switchCount,
      maxSwitches: MAX_SERVER_DEVICE_SWITCHES,
    });
  });

  // Lightweight App Version & GitHub Release Discovery Endpoint (no private data)
  const SERVER_APP_VERSION = '1.5.8';
  const SERVER_APP_VERSION_CODE = 3;
  const cachedGithubReleases = new Map<
    string,
    {
      fetchedAt: number;
      tag: string;
      apkDownloadUrl: string;
      releasePageUrl: string;
      notes: string;
    }
  >();

  app.get('/api/app-version', async (req, res) => {
    const rawRepo = String(req.query.repo || process.env.VITE_GITHUB_REPO || process.env.GITHUB_REPO || '').trim();
    const validRepo = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(rawRepo) ? rawRepo : '';

    let latestVersion = SERVER_APP_VERSION;
    let latestVersionCode = SERVER_APP_VERSION_CODE;
    let apkDownloadUrl = String(process.env.WARGAQU_APK_URL || '').trim();
    let releasePageUrl = validRepo ? `https://github.com/${validRepo}/releases/latest` : '';
    const changelog = [
      'Kontrol Sesi Tunggal APK vs PWA & sinkronisasi akun otomatis lintas wadah',
      'Deteksi pembaruan APK otomatis & pasang timpa langsung tanpa uninstall',
      'Penanda rilis v1.5.8 (Build 3) terlihat di beranda, akun, dan toko',
    ];

    if (validRepo) {
      const cached = cachedGithubReleases.get(validRepo);
      const now = Date.now();
      if (cached && now - cached.fetchedAt < 60 * 1000) {
        if (cached.tag) latestVersion = cached.tag.replace(/^v/i, '');
        if (cached.apkDownloadUrl) apkDownloadUrl = cached.apkDownloadUrl;
        if (cached.releasePageUrl) releasePageUrl = cached.releasePageUrl;
      } else {
        try {
          const ghRes = await fetch(`https://api.github.com/repos/${validRepo}/releases/latest`, {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'WargaQu-Relay/1.5.8',
            },
          });
          if (ghRes.ok) {
            const ghData = (await ghRes.json()) as {
              tag_name?: string;
              html_url?: string;
              body?: string;
              assets?: Array<{ name?: string; browser_download_url?: string }>;
            };
            const tag = String(ghData.tag_name || '').trim();
            const apkAsset =
              ghData.assets?.find(a => (a.name || '').toLowerCase() === 'wargaqu-latest.apk') ||
              ghData.assets?.find(a => (a.name || '').toLowerCase().endsWith('.apk'));
            const dlUrl =
              apkAsset?.browser_download_url ||
              `https://github.com/${validRepo}/releases/latest/download/WargaQu-latest.apk`;
            cachedGithubReleases.set(validRepo, {
              fetchedAt: now,
              tag,
              apkDownloadUrl: dlUrl,
              releasePageUrl: ghData.html_url || releasePageUrl,
              notes: String(ghData.body || '').slice(0, 200),
            });
            if (tag) latestVersion = tag.replace(/^v/i, '');
            apkDownloadUrl = dlUrl;
            if (ghData.html_url) releasePageUrl = ghData.html_url;
          }
        } catch {
          // keep bundle defaults when offline
        }
      }
      if (!apkDownloadUrl) {
        apkDownloadUrl = `https://github.com/${validRepo}/releases/latest/download/WargaQu-latest.apk`;
      }
    }

    res.json({
      appId: 'com.wargaqu.app',
      version: latestVersion,
      versionCode: latestVersionCode,
      githubRepo: validRepo,
      apkDownloadUrl,
      releasePageUrl,
      changelog,
      checkedAt: new Date().toISOString(),
    });
  });

  // Lightweight health endpoint (zero citizen PII)
  app.get('/api/relay-health', (_req, res) => {
    const telemetry = buildTelemetryPayload();
    res.json({
      status: 'ok',
      version: SERVER_APP_VERSION,
      versionCode: SERVER_APP_VERSION_CODE,
      mode: 'stateless-pass-through',
      citizenDatabaseStorage: 'none',
      ...telemetry,
    });
  });

  // Always return clean JSON errors for /api/* instead of Express HTML error pages
  app.use(
    '/api',
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (!err) {
        next();
        return;
      }
      const e = err as {
        status?: number;
        statusCode?: number;
        type?: string;
        message?: string;
      };
      if (e.type === 'entity.too.large' || e.status === 413 || e.statusCode === 413) {
        res.status(413).json({
          error:
            'Ukuran foto atau PDF terlalu besar dalam sekali kirim. Unggah 1–3 foto per proses atau kecilkan resolusi gambar.',
        });
        return;
      }
      if (err instanceof SyntaxError || e.type === 'entity.parse.failed') {
        res.status(400).json({
          error: 'Format paket dokumen tidak valid saat dikirim ke server.',
        });
        return;
      }
      res.status(e.status || e.statusCode || 500).json({
        error: e.message || 'Terjadi kesalahan pada layanan server.',
      });
    }
  );

  const isProd = process.env.NODE_ENV === 'production';

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '/', 'http://localhost').pathname;
      if (pathname === '/ws-relay') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
        return;
      }
      if (isProd) {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: {
          server,
        },
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[WargaQu Relay] Running stateless HTTP+WS server on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[WargaQu Relay] Failed to start server:', err);
  process.exit(1);
});
