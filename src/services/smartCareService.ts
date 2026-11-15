import { AuthService } from './authService';
import { RealtimeRelayService } from './realtimeRelayService';

export type SmartCareTriageStatus =
  | 'new'
  | 'queued'
  | 'merged'
  | 'skipped'
  | 'resolved';

export type SmartCareSeverity = 'High Severity' | 'Medium' | 'Low' | 'Auto Analyzed';

export interface SmartCareReporterNote {
  name: string;
  email?: string;
  phone?: string;
  device: string;
  complaint: string;
  time: string;
}

export interface SmartCareLogEntry {
  id: string;
  complaint: string;
  module: string;
  detectedError: string;
  severity: SmartCareSeverity;
  autoPrompt: string;
  device: string;
  reporterName: string;
  reporterEmail?: string;
  reporterPhone?: string;
  hiddenDeviceId?: string;
  createdAt: string;
  updatedAt: string;
  triageStatus: SmartCareTriageStatus;
  occurrenceCount: number;
  reporters: SmartCareReporterNote[];
  mergedIntoId?: string;
  sentToAdminAt?: string;
}

export interface SimilarityAnalysis {
  level: 'sama' | 'mirip' | 'baru';
  label: 'Sama Persis' | 'Mirip' | 'Baru';
  score: number; // 0..1
  matchedEntry?: SmartCareLogEntry;
}

export const SMART_CARE_SYNC_EVENT = 'wargaqu-smartcare-sync';
const STORAGE_KEY = 'wargaqu_smartcare_logs_v1';
const OWNER_EMAILS = ['usahaqu2026@gmail.com', 'usahaqu26@gmail.com'];

const STOP_WORDS = new Set([
  'di',
  'ke',
  'dari',
  'yang',
  'dan',
  'atau',
  'pas',
  'saat',
  'waktu',
  'ketika',
  'kalau',
  'jika',
  'bila',
  'untuk',
  'pada',
  'dengan',
  'ada',
  'tidak',
  'gak',
  'nggak',
  'ga',
  'kok',
  'tadi',
  'ini',
  'itu',
  'saya',
  'aku',
  'min',
  'admin',
  'tolong',
  'mohon',
  'sempat',
  'sudah',
  'belum',
  'bisa',
  'mau',
  'jadi',
  'nya',
  'di',
]);

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function nowLabel(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function detectDeviceSummary(): string {
  if (typeof navigator === 'undefined') return 'User Device';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android Browser / PWA';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS Safari / PWA';
  return 'Desktop / Web Browser';
}

const SEED_LOGS: SmartCareLogEntry[] = [
  {
    id: '#SC-8921',
    complaint:
      'Tombol bayar di kasir sempat mental keluar sendiri pas mau ngeprint struk thermal ukuran 58 milimeter.',
    module: 'services/printer.ts -> printReceipt()',
    detectedError: 'TypeError / Null Bluetooth Handle',
    severity: 'High Severity',
    autoPrompt: `[AI AUTO-FIX PROMPT]
Keluhan User: "Tombol bayar di kasir sempat mental keluar sendiri pas mau ngeprint struk thermal ukuran 58 milimeter."
Target Module: services/printer.ts -> printReceipt()
Diagnosa: TypeError / Null Bluetooth Handle

Instruksi Perbaikan:
1. Tambahkan try-catch block dan null-check pada handle printer Bluetooth 58mm.
2. Pastikan transaksi tetap tersimpan di localStorage sebelum proses cetak struk dijalankan.
3. Tampilkan fallback notifikasi ramah jika koneksi printer terputus.`,
    device: 'Android Browser / PWA',
    reporterName: 'Kasir Bakso Qu',
    createdAt: 'Hari ini · 09:15',
    updatedAt: 'Hari ini · 09:15',
    triageStatus: 'queued',
    occurrenceCount: 1,
    reporters: [
      {
        name: 'Kasir Bakso Qu',
        device: 'Android Browser / PWA',
        complaint:
          'Tombol bayar di kasir sempat mental keluar sendiri pas mau ngeprint struk thermal ukuran 58 milimeter.',
        time: 'Hari ini · 09:15',
      },
    ],
    sentToAdminAt: 'Hari ini · 09:15',
  },
  {
    id: '#SC-8920',
    complaint:
      'Stok produk sembako tidak otomatis berkurang waktu transaksi tempo lunas.',
    module: 'components/modularqu -> handleSettleDebt()',
    detectedError: 'Event Emission Logic / State Mismatch',
    severity: 'Medium',
    autoPrompt: `[AI AUTO-FIX PROMPT]
Keluhan User: "Stok produk sembako tidak otomatis berkurang waktu transaksi tempo lunas."
Target Module: components/modularqu -> handleSettleDebt()
Diagnosa: Event Emission Logic / State Mismatch

Instruksi Perbaikan:
1. Pastikan pelunasan transaksi Tempo/Utang memicu pembaruan stok produk secara atomik.
2. Hindari double-deduction bila stok sudah dikurangi saat nota tempo awal dibuat.`,
    device: 'Samsung A14 (Android)',
    reporterName: 'Toko Sembako Warga',
    createdAt: 'Hari ini · 08:40',
    updatedAt: 'Hari ini · 08:40',
    triageStatus: 'new',
    occurrenceCount: 1,
    reporters: [
      {
        name: 'Toko Sembako Warga',
        device: 'Samsung A14 (Android)',
        complaint:
          'Stok produk sembako tidak otomatis berkurang waktu transaksi tempo lunas.',
        time: 'Hari ini · 08:40',
      },
    ],
    sentToAdminAt: 'Hari ini · 08:40',
  },
];

function loadLogs(): SmartCareLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return SEED_LOGS;
}

function saveLogs(logs: SmartCareLogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SMART_CARE_SYNC_EVENT));
  }
}

export const SmartCareService = {
  isDeveloperOrAdmin(): boolean {
    const acc = AuthService.getAccount();
    const email = (acc?.email || '').trim().toLowerCase();
    return OWNER_EMAILS.includes(email);
  },

  analyzeComplaint(rawComplaint: string): {
    module: string;
    detectedError: string;
    severity: SmartCareSeverity;
    autoPrompt: string;
  } {
    const text = rawComplaint.trim();
    const lower = text.toLowerCase();

    let module = 'src/App.tsx -> generalWorkflow()';
    let detectedError = 'Runtime Logic Exception / User Reported Issue';
    let severity: SmartCareSeverity = 'Auto Analyzed';
    let specificSteps = [
      'Analisa alur komponen terkait sesuai deskripsi keluhan user di atas.',
      'Tambahkan validasi input, null-check, dan error boundary agar tidak terjadi crash atau data hilang.',
      'Pastikan state tersimpan aman di localStorage dan tampil responsif di semua ukuran layar HP.',
    ];

    if (
      lower.includes('cetak') ||
      lower.includes('print') ||
      lower.includes('thermal') ||
      lower.includes('bluetooth') ||
      lower.includes('struk') ||
      lower.includes('nota')
    ) {
      module = 'services/printer.ts -> printReceipt()';
      detectedError = 'Bluetooth Connection Drop / Null Pointer Exception';
      severity = 'High Severity';
      specificSteps = [
        'Tambahkan try-catch dan pengecekan koneksi printer Bluetooth sebelum mengirim ESC/POS buffer.',
        'Simpan transaksi lebih dulu ke localStorage agar nota tidak hilang bila printer gagal cetak.',
        'Sediakan fallback cetak PDF / browser print bila Web Bluetooth terputus.',
      ];
    } else if (lower.includes('trah') || lower.includes('leluhur') || lower.includes('silsilah') || lower.includes('grid')) {
      module = 'components/leluhurqu/LeluhurQuView.tsx -> silsilahEngine()';
      detectedError = 'Trah Sync / Layout Canvas / Invite Token Issue';
      severity = 'Medium';
      specificSteps = [
        'Periksa sinkronisasi penyimpanan per-akun, urutan anak (orderIndex), serta render semua node pada InteractiveGridCanvasView.',
        'Pastikan link undangan pendek (?t=Q...) terdecode dan otomatis tersimpan ke akun penerima.',
        'Catat perubahan ke log aktivitas Trah.',
      ];
    } else if (
      lower.includes('rt') ||
      lower.includes('paguyuban') ||
      lower.includes('iuran') ||
      lower.includes('ronda') ||
      lower.includes('warga') ||
      lower.includes('surat')
    ) {
      module = 'components/rtqu/RtQuView.tsx & rtSiagaStorage.ts';
      detectedError = 'Community Workspace Isolation / Payment State Mismatch';
      severity = 'Medium';
      specificSteps = [
        'Verifikasi isolasi workspace RTQu/PaguyubanQu/Organisasi/Sosial per akun (invite-only).',
        'Pastikan pembayaran iuran atau kas tercatat real-time ke buku transparansi komunitas aktif.',
      ];
    } else if (lower.includes('siaga') || lower.includes('darurat') || lower.includes('sos') || lower.includes('panic')) {
      module = 'components/siagaqu/SiagaQuView.tsx -> dispatchEmergencyAlert()';
      detectedError = 'Realtime Relay / GPS Coordinate Dispatch Delay';
      severity = 'High Severity';
      specificSteps = [
        'Periksa pengiriman sinyal darurat WebSocket relay dan fallback antrean offline.',
        'Pastikan circle keluarga/RT tujuan terverifikasi dan koordinat lokasi terkirim akurat.',
      ];
    } else if (
      lower.includes('tampilan') ||
      lower.includes('layar') ||
      lower.includes('hp') ||
      lower.includes('lebar') ||
      lower.includes('kecil') ||
      lower.includes('potong')
    ) {
      module = 'components/AndroidFrame.tsx & Responsive Layout';
      detectedError = 'Mobile Viewport / Desktop-Site Scaling Mismatch';
      severity = 'Medium';
      specificSteps = [
        'Periksa deteksi layar sentuh/mobile dan auto-scaling rem font-size pada AndroidFrame.tsx.',
        'Pastikan kontainer bersifat full-bleed tanpa margin abu-abu berlebih di HP lain.',
      ];
    } else if (lower.includes('stok') || lower.includes('habis') || lower.includes('bahan') || lower.includes('tempo')) {
      module = 'services/storage.ts & ModularQuView.tsx -> updateStock()';
      detectedError = 'Inventory Deduct Mismatch / Asynchronous State Delay';
      severity = 'Medium';
      specificSteps = [
        'Sinkronkan pengurangan stok bahan/produk untuk transaksi tunai, QRIS, maupun pelunasan tempo.',
        'Cegah stok minus atau double-deduct saat edit transaksi.',
      ];
    } else if (lower.includes('qris') || lower.includes('bayar') || lower.includes('kasir') || lower.includes('meja')) {
      module = 'components/usahaqu & kasir -> handleCheckout()';
      detectedError = 'Payment Flow / Order State Transition Lock';
      severity = 'High Severity';
      specificSteps = [
        'Validasi nominal bayar, status meja, serta pencatatan ledger sebelum menutup modal pembayaran.',
      ];
    } else if (lower.includes('login') || lower.includes('akun') || lower.includes('backup') || lower.includes('enkripsi')) {
      module = 'services/authService.ts & encryptedBackupService.ts';
      detectedError = 'Account Scoping / Encrypted Backup Validation';
      severity = 'High Severity';
      specificSteps = [
        'Pastikan scoping data per akun dan pemulihan file .wqbak berjalan konsisten setelah ganti akun.',
      ];
    }

    const autoPrompt = `[AI AUTO-FIX PROMPT FOR DEVELOPER]
Keluhan User: "${text}"
Target Module: ${module}
Diagnosa: ${detectedError}
Tingkat Prioritas: ${severity}

Instruksi Perbaikan:
${specificSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

    return { module, detectedError, severity, autoPrompt };
  },

  getLogs(): SmartCareLogEntry[] {
    return loadLogs();
  },

  analyzeSimilarity(
    entryOrComplaint: SmartCareLogEntry | string,
    targetIdToExclude?: string
  ): SimilarityAnalysis {
    const logs = loadLogs();
    const text =
      typeof entryOrComplaint === 'string'
        ? entryOrComplaint
        : entryOrComplaint.complaint;
    const mod = typeof entryOrComplaint === 'string' ? '' : entryOrComplaint.module;
    const excludeId =
      targetIdToExclude ||
      (typeof entryOrComplaint === 'string' ? undefined : entryOrComplaint.id);

    const aTokens = new Set(normalizeTokens(text));
    if (aTokens.size === 0) {
      return { level: 'baru', label: 'Baru', score: 0 };
    }

    let bestScore = 0;
    let bestMatch: SmartCareLogEntry | undefined;

    for (const candidate of logs) {
      if (candidate.id === excludeId) continue;
      if (candidate.triageStatus === 'merged' || candidate.triageStatus === 'skipped') continue;

      const bTokens = new Set(normalizeTokens(candidate.complaint));
      if (bTokens.size === 0) continue;

      let intersection = 0;
      aTokens.forEach((tok) => {
        if (bTokens.has(tok)) intersection += 1;
      });
      const union = new Set([...aTokens, ...bTokens]).size;
      let jaccard = union > 0 ? intersection / union : 0;

      // Boost slightly when target module is identical and at least 2 meaningful keywords overlap
      if (mod && candidate.module === mod && intersection >= 2) {
        jaccard = Math.min(1, jaccard + 0.16);
      }

      if (jaccard > bestScore) {
        bestScore = jaccard;
        bestMatch = candidate;
      }
    }

    if (bestMatch && bestScore >= 0.72) {
      return {
        level: 'sama',
        label: 'Sama Persis',
        score: bestScore,
        matchedEntry: bestMatch,
      };
    }
    if (bestMatch && bestScore >= 0.32) {
      return {
        level: 'mirip',
        label: 'Mirip',
        score: bestScore,
        matchedEntry: bestMatch,
      };
    }
    return { level: 'baru', label: 'Baru', score: bestScore };
  },

  submitUserReport(params: {
    complaint: string;
    autoPrompt?: string;
    module?: string;
    detectedError?: string;
    severity?: SmartCareSeverity;
    sendToAdmin?: boolean;
    existingId?: string;
  }): SmartCareLogEntry {
    const logs = loadLogs();
    const acc = AuthService.getAccount();
    const analysis = this.analyzeComplaint(params.complaint);
    const stamp = nowLabel();
    const reporterName = acc ? AuthService.getDisplayName(acc) : 'Warga Tamu';
    const device = detectDeviceSummary();

    if (params.existingId) {
      const existing = logs.find((l) => l.id === params.existingId);
      if (existing) {
        const updated: SmartCareLogEntry = {
          ...existing,
          complaint: params.complaint.trim(),
          module: params.module || analysis.module,
          detectedError: params.detectedError || analysis.detectedError,
          severity: params.severity || analysis.severity,
          autoPrompt: params.autoPrompt?.trim() || analysis.autoPrompt,
          updatedAt: stamp,
          sentToAdminAt: params.sendToAdmin ? stamp : existing.sentToAdminAt,
          reporters: existing.reporters.map((r, idx) =>
            idx === 0 ? { ...r, complaint: params.complaint.trim(), time: stamp } : r
          ),
        };
        saveLogs(logs.map((l) => (l.id === existing.id ? updated : l)));
        if (params.sendToAdmin) {
          RealtimeRelayService.publish('admin:policy', 'smartcare:ticket', updated);
        }
        return updated;
      }
    }

    const newEntry: SmartCareLogEntry = {
      id: `#SC-${Math.floor(1000 + Math.random() * 9000)}`,
      complaint: params.complaint.trim(),
      module: params.module || analysis.module,
      detectedError: params.detectedError || analysis.detectedError,
      severity: params.severity || analysis.severity,
      autoPrompt: params.autoPrompt?.trim() || analysis.autoPrompt,
      device,
      reporterName,
      reporterEmail: acc?.email,
      reporterPhone: acc?.phone,
      hiddenDeviceId: acc?.deviceId || AuthService.getHiddenDeviceId(),
      createdAt: stamp,
      updatedAt: stamp,
      triageStatus: 'new',
      occurrenceCount: 1,
      reporters: [
        {
          name: reporterName,
          email: acc?.email,
          phone: acc?.phone,
          device,
          complaint: params.complaint.trim(),
          time: stamp,
        },
      ],
      sentToAdminAt: params.sendToAdmin ? stamp : undefined,
    };

    saveLogs([newEntry, ...logs]);
    if (params.sendToAdmin) {
      RealtimeRelayService.publish('admin:policy', 'smartcare:ticket', newEntry);
    }
    return newEntry;
  },

  ingestRemoteReport(incoming: SmartCareLogEntry) {
    if (!incoming?.id || !incoming?.complaint) return;
    const logs = loadLogs();
    const idx = logs.findIndex((l) => l.id === incoming.id);
    if (idx !== -1) {
      const next = logs.map((l, i) => (i === idx ? { ...l, ...incoming } : l));
      saveLogs(next);
    } else {
      saveLogs([{ ...incoming, triageStatus: incoming.triageStatus || 'new' }, ...logs]);
    }
  },

  updateEntryPromptAndComplaint(
    entryId: string,
    patch: Partial<Pick<SmartCareLogEntry, 'complaint' | 'autoPrompt' | 'triageStatus'>>
  ) {
    const logs = loadLogs();
    const stamp = nowLabel();
    saveLogs(
      logs.map((l) => (l.id === entryId ? { ...l, ...patch, updatedAt: stamp } : l))
    );
  },

  mergeEntries(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const logs = loadLogs();
    const source = logs.find((l) => l.id === sourceId);
    const target = logs.find((l) => l.id === targetId);
    if (!source || !target) return;

    const stamp = nowLabel();
    const extraPromptLine = `\n- Laporan Tambahan (${source.id} - ${source.reporterName}): "${source.complaint}"`;
    const mergedPrompt = target.autoPrompt.includes(source.complaint)
      ? target.autoPrompt
      : `${target.autoPrompt}${extraPromptLine}`;

    const next = logs.map((l) => {
      if (l.id === target.id) {
        return {
          ...l,
          occurrenceCount: (l.occurrenceCount || 1) + (source.occurrenceCount || 1),
          reporters: [...l.reporters, ...source.reporters],
          autoPrompt: mergedPrompt,
          triageStatus: l.triageStatus === 'new' ? ('queued' as const) : l.triageStatus,
          updatedAt: stamp,
        };
      }
      if (l.id === source.id) {
        return {
          ...l,
          triageStatus: 'merged' as const,
          mergedIntoId: target.id,
          updatedAt: stamp,
        };
      }
      return l;
    });

    saveLogs(next);
  },

  setTriageStatus(entryId: string, triageStatus: SmartCareTriageStatus) {
    const logs = loadLogs();
    const stamp = nowLabel();
    saveLogs(
      logs.map((l) => (l.id === entryId ? { ...l, triageStatus, updatedAt: stamp } : l))
    );
  },

  queueAllNewEntries(): number {
    const logs = loadLogs();
    let count = 0;
    const stamp = nowLabel();
    const next = logs.map((l) => {
      if (l.triageStatus === 'new') {
        count += 1;
        return { ...l, triageStatus: 'queued' as const, updatedAt: stamp };
      }
      return l;
    });
    if (count > 0) saveLogs(next);
    return count;
  },

  autoMergeSimilarNewEntries(): number {
    let mergedCount = 0;
    const snapshot = loadLogs().filter((l) => l.triageStatus === 'new');
    for (const item of snapshot) {
      const sim = this.analyzeSimilarity(item);
      if ((sim.level === 'sama' || sim.level === 'mirip') && sim.matchedEntry) {
        this.mergeEntries(item.id, sim.matchedEntry.id);
        mergedCount += 1;
      }
    }
    return mergedCount;
  },

  buildCombinedMasterPrompt(entries?: SmartCareLogEntry[]): string {
    const queued =
      entries || loadLogs().filter((l) => l.triageStatus === 'queued');
    if (queued.length === 0) return '';

    const header = `[MASTER AUTO-FIX PROMPT - WARGAQU SMART CARE]
Total Isu Digabung: ${queued.length} topik (${queued.reduce(
      (s, e) => s + (e.occurrenceCount || 1),
      0
    )} laporan user)
Tanggal Kompilasi: ${nowLabel()}
==================================================`;

    const body = queued
      .map((item, idx) => {
        const extraReporters =
          item.reporters.length > 1
            ? `\nPelapor (${item.occurrenceCount}x): ${item.reporters
                .map((r) => r.name)
                .join(', ')}`
            : `\nPelapor: ${item.reporterName} (${item.device})`;
        return `\n### BUG #${idx + 1} [${item.id}] · ${item.severity}${extraReporters}
Modul: ${item.module}
Diagnosa: ${item.detectedError}
Keluhan Utama: "${item.complaint}"

Prompt Detail:
${item.autoPrompt}`;
      })
      .join('\n\n--------------------------------------------------');

    return `${header}\n${body}\n\n==================================================\nInstruksi Eksekusi Developer/AI:\nPerbaiki semua poin di atas secara berurutan, jaga kompatibilitas localStorage zero-DB, lalu verifikasi build (npm run build & tsc --noEmit).`;
  },

  cutQueuedToResolved(): number {
    const logs = loadLogs();
    let count = 0;
    const stamp = nowLabel();
    const next = logs.map((l) => {
      if (l.triageStatus === 'queued') {
        count += 1;
        return { ...l, triageStatus: 'resolved' as const, updatedAt: stamp };
      }
      return l;
    });
    if (count > 0) saveLogs(next);
    return count;
  },
};
