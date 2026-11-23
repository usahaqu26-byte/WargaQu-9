import { APP_VERSION } from '../config/appVersion';
import { buildApiUrl, isNativeCapacitorApk } from './appOriginService';
import { AuthService } from './authService';
import { GuideModuleId, MODULE_GUIDES } from './moduleOnboardingService';
import {
  getAccountSessionChannel,
  RealtimeRelayService,
  RelayConnectionState,
} from './realtimeRelayService';

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

export interface SafeDiagnosticsSnapshot {
  container: 'apk' | 'pwa';
  appVersion: string;
  online: boolean;
  relayStatus: RelayConnectionState;
  storageUsedKb: number;
  storageLimitKb: number;
  storagePct: number;
  hasLoggedInAccount: boolean;
  accountRoleLabel: string;
  collectedAt: string;
  warnings: string[];
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
  reporterKey?: string;
  hiddenDeviceId?: string;
  createdAt: string;
  updatedAt: string;
  triageStatus: SmartCareTriageStatus;
  occurrenceCount: number;
  reporters: SmartCareReporterNote[];
  mergedIntoId?: string;
  sentToAdminAt?: string;
  aiSummary?: string;
  aiQuickSteps?: string[];
  adminReply?: string;
  adminReplyAt?: string;
  adminRepliedBy?: string;
  diagnosticsSnapshot?: SafeDiagnosticsSnapshot;
}

export interface SimilarityAnalysis {
  level: 'sama' | 'mirip' | 'baru';
  label: 'Sama Persis' | 'Mirip' | 'Baru';
  score: number; // 0..1
  matchedEntry?: SmartCareLogEntry;
}

export interface SmartCareAiChatResult {
  reply: string;
  detectedModule: string;
  severity: 'High Severity' | 'Medium' | 'Low';
  quickSteps: string[];
  recommendedTarget: 'panduan' | 'akun' | 'escalate' | 'none';
  recommendedGuideId?: GuideModuleId | '';
  needsAdminEscalation: boolean;
  escalatedSummary: string;
  suggestedFixPrompt: string;
}

export interface SmartCareChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  aiMeta?: SmartCareAiChatResult;
}

export interface OfflineGuideMatch {
  moduleId: GuideModuleId;
  moduleName: string;
  questionOrTitle: string;
  answer: string;
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
  const containerLabel = isNativeCapacitorApk() ? 'APK Android' : 'Web / PWA';
  if (typeof navigator === 'undefined') return containerLabel;
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return `${containerLabel} (Android v${APP_VERSION})`;
  if (/iPhone|iPad|iPod/i.test(ua)) return `${containerLabel} (iOS v${APP_VERSION})`;
  return `${containerLabel} (Desktop v${APP_VERSION})`;
}

function loadLogs(): SmartCareLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (l: SmartCareLogEntry) =>
            !(l?.id === '#SC-8921' && l?.reporterName === 'Kasir Bakso Qu') &&
            !(l?.id === '#SC-8920' && l?.reporterName === 'Toko Sembako Warga')
        );
      }
    }
  } catch {
    // ignore
  }
  return [];
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

  getReporterKey(): string {
    const acc = AuthService.getAccount();
    if (acc?.email) {
      return `email:${acc.email.trim().toLowerCase()}`;
    }
    return `dev:${AuthService.getHiddenDeviceId()}`;
  },

  collectSafeDiagnostics(): SafeDiagnosticsSnapshot {
    const container: 'apk' | 'pwa' = isNativeCapacitorApk() ? 'apk' : 'pwa';
    const online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
    const relayStatus = RealtimeRelayService.getStatus();
    const acc = AuthService.getAccount();
    const hasLoggedInAccount = Boolean(acc?.email);

    let totalBytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = localStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2;
      }
    } catch {
      // ignore storage read issues
    }

    const storageLimitKb = 5120;
    const storageUsedKb = Math.round(totalBytes / 1024);
    const storagePct = Math.min(100, Math.round((storageUsedKb / storageLimitKb) * 100));

    const warnings: string[] = [];
    if (!online) {
      warnings.push('Perangkat sedang offline — asisten AI & sinkronisasi relay menunggu internet.');
    } else if (relayStatus === 'offline') {
      warnings.push('Koneksi Relay Real-Time sedang terputus; coba muat ulang jika sinkronisasi tertunda.');
    }
    if (storagePct >= 80) {
      warnings.push(
        `Penyimpanan lokal terpakai ${storagePct}%. Disarankan ekspor cadangan .wqbak & bersihkan cache tidak terpakai.`
      );
    }
    if (!hasLoggedInAccount) {
      warnings.push(
        'Akun berjalan dalam Mode Tamu — login Email + No HP untuk mengaktifkan sinkronisasi sesi tunggal & backup APK/PWA.'
      );
    }

    return {
      container,
      appVersion: APP_VERSION,
      online,
      relayStatus,
      storageUsedKb,
      storageLimitKb,
      storagePct,
      hasLoggedInAccount,
      accountRoleLabel: hasLoggedInAccount
        ? this.isDeveloperOrAdmin()
          ? 'Admin / Developer'
          : 'Anggota Terverifikasi'
        : 'Tamu Lokal',
      collectedAt: nowLabel(),
      warnings,
    };
  },

  findOfflineModuleFaq(query: string): OfflineGuideMatch[] {
    const tokens = normalizeTokens(query);
    if (tokens.length === 0) return [];

    const scored: Array<{ score: number; match: OfflineGuideMatch }> = [];

    for (const guide of MODULE_GUIDES) {
      for (const faq of guide.faq) {
        const hay = `${guide.name} ${faq.q} ${faq.a}`.toLowerCase();
        const hits = tokens.filter((t) => hay.includes(t)).length;
        if (hits > 0) {
          scored.push({
            score: hits + 0.5,
            match: {
              moduleId: guide.id,
              moduleName: guide.name,
              questionOrTitle: faq.q,
              answer: faq.a,
            },
          });
        }
      }
      for (const step of guide.steps) {
        const hay = `${guide.name} ${step.title} ${step.desc}`.toLowerCase();
        const hits = tokens.filter((t) => hay.includes(t)).length;
        if (hits >= 2) {
          scored.push({
            score: hits,
            match: {
              moduleId: guide.id,
              moduleName: guide.name,
              questionOrTitle: step.title,
              answer: step.desc,
            },
          });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((s) => s.match);
  },

  async askGeminiSmartCare(params: {
    messages: Array<{ role: 'user' | 'assistant'; text: string }>;
    diagnostics?: SafeDiagnosticsSnapshot;
  }): Promise<SmartCareAiChatResult> {
    const diagnostics = params.diagnostics || this.collectSafeDiagnostics();
    const res = await fetch(buildApiUrl('/api/smartcare/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'user_assist',
        messages: params.messages.slice(-10),
        diagnostics,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      result?: SmartCareAiChatResult;
    };

    if (!res.ok || !data?.ok || !data?.result) {
      throw new Error(
        data?.error ||
          `Gagal menghubungi WargaQu Smart Care AI (HTTP ${res.status || 500}).`
      );
    }

    return data.result;
  },

  async draftAdminReplyWithAi(ticket: SmartCareLogEntry): Promise<SmartCareAiChatResult> {
    const res = await fetch(buildApiUrl('/api/smartcare/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'admin_reply_draft',
        ticketContext: {
          ticketId: ticket.id,
          reporterName: ticket.reporterName,
          module: ticket.module,
          detectedError: ticket.detectedError,
          complaint: ticket.complaint,
        },
        diagnostics: ticket.diagnosticsSnapshot || this.collectSafeDiagnostics(),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      result?: SmartCareAiChatResult;
    };

    if (!res.ok || !data?.ok || !data?.result) {
      throw new Error(
        data?.error ||
          `Gagal menyusun draf balasan AI (HTTP ${res.status || 500}).`
      );
    }

    return data.result;
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
    let detectedError = 'User Reported Issue / Workflow Inquiry';
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
      if (
        lower.includes('trah') ||
        lower.includes('nasab') ||
        lower.includes('leluhur') ||
        lower.includes('grid') ||
        lower.includes('silsilah')
      ) {
        module = 'components/leluhurqu/InteractiveGridCanvasView.tsx -> printGridPdf()';
        detectedError = 'NasabQu Grid Print / Card Export Layout';
        severity = 'Medium';
        specificSteps = [
          'Periksa aturan print CSS full-color (print-color-adjust: exact) serta scaling kertas A0–A4 di InteractiveGridCanvasView.',
          'Pastikan auto-upscale foto anggota berjalan sebelum ekspor PNG/PDF.',
        ];
      } else {
        module = 'services/printer.ts -> printReceipt()';
        detectedError = 'Bluetooth Connection Drop / Print Fallback';
        severity = 'High Severity';
        specificSteps = [
          'Tambahkan try-catch dan pengecekan koneksi printer Bluetooth sebelum mengirim ESC/POS buffer.',
          'Simpan transaksi lebih dulu ke localStorage agar nota tidak hilang bila printer gagal cetak.',
          'Sediakan fallback cetak PDF / browser print bila Web Bluetooth terputus.',
        ];
      }
    } else if (
      lower.includes('trah') ||
      lower.includes('nasab') ||
      lower.includes('leluhur') ||
      lower.includes('silsilah') ||
      lower.includes('grid') ||
      lower.includes('card') ||
      lower.includes('upscale')
    ) {
      module = 'components/leluhurqu/LeluhurQuView.tsx -> silsilahEngine()';
      detectedError = 'Trah Sync / Layout Canvas / Invite Token Issue';
      severity = 'Medium';
      specificSteps = [
        'Periksa sinkronisasi penyimpanan per-akun, urutan anak (orderIndex), serta 3 mode card pada InteractiveGridCanvasView.',
        'Pastikan alur 3 langkah (Ajukan -> Approve -> Tarik Pembaruan) memperbarui penanda waktu dan nomor versi modul.',
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
      lower.includes('dompet') ||
      lower.includes('saldo') ||
      lower.includes('pin') ||
      lower.includes('suara')
    ) {
      module = 'components/dompetqu/DompetQuView.tsx & dompetQuService.ts';
      detectedError = 'DompetQu Voice Parse / Private Ledger Isolation';
      severity = 'Medium';
      specificSteps = [
        'Pastikan endpoint /api/dompetqu/parse-speech menerima daftar kantong saldo aktif dan mengisolasi data per akun.',
      ];
    } else if (
      lower.includes('apk') ||
      lower.includes('pwa') ||
      lower.includes('login') ||
      lower.includes('akun') ||
      lower.includes('backup') ||
      lower.includes('enkripsi') ||
      lower.includes('sesi')
    ) {
      module = 'services/authService.ts & accountSyncService.ts';
      detectedError = 'APK/PWA Single-Session / Encrypted Backup Sync';
      severity = 'High Severity';
      specificSteps = [
        'Pastikan validasi sesi tunggal APK vs PWA berjalan terpisah dari sinkronisasi modul, dan auto-restore E2EE/.wqbak berjalan lancar.',
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

  getMyTickets(): SmartCareLogEntry[] {
    const acc = AuthService.getAccount();
    const myEmail = acc?.email?.trim().toLowerCase() || '';
    const myKey = this.getReporterKey();
    const myDeviceId = acc?.deviceId || AuthService.getHiddenDeviceId();

    return loadLogs().filter((l) => {
      if (l.triageStatus === 'merged') return false;
      if (l.reporterKey && l.reporterKey === myKey) return true;
      if (myEmail && l.reporterEmail?.trim().toLowerCase() === myEmail) return true;
      if (l.hiddenDeviceId && l.hiddenDeviceId === myDeviceId) return true;
      return false;
    });
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
    aiSummary?: string;
    aiQuickSteps?: string[];
    diagnosticsSnapshot?: SafeDiagnosticsSnapshot;
    sendToAdmin?: boolean;
    existingId?: string;
  }): SmartCareLogEntry {
    const logs = loadLogs();
    const acc = AuthService.getAccount();
    const analysis = this.analyzeComplaint(params.complaint);
    const stamp = nowLabel();
    const reporterName = acc ? AuthService.getDisplayName(acc) : 'Warga Tamu';
    const reporterKey = this.getReporterKey();
    const device = detectDeviceSummary();
    const diagnostics = params.diagnosticsSnapshot || this.collectSafeDiagnostics();

    const syncToRelayMailbox = (entry: SmartCareLogEntry) => {
      RealtimeRelayService.publish('admin:policy', 'smartcare:ticket', entry);
      if (typeof fetch !== 'undefined') {
        void fetch(buildApiUrl('/api/smartcare/tickets'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: entry.id,
            reporterKey: entry.reporterKey || reporterKey,
            reporterName: entry.reporterName,
            device: entry.device,
            module: entry.module,
            detectedError: entry.detectedError,
            severity: entry.severity,
            complaint: entry.complaint,
            autoPrompt: entry.autoPrompt,
            aiSummary: entry.aiSummary,
            aiQuickSteps: entry.aiQuickSteps,
            triageStatus: entry.triageStatus,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            sentToAdminAt: entry.sentToAdminAt,
          }),
        }).catch(() => {});
      }
    };

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
          aiSummary: params.aiSummary || existing.aiSummary,
          aiQuickSteps: params.aiQuickSteps || existing.aiQuickSteps,
          reporterKey: existing.reporterKey || reporterKey,
          diagnosticsSnapshot: diagnostics,
          updatedAt: stamp,
          sentToAdminAt: params.sendToAdmin ? stamp : existing.sentToAdminAt,
          reporters: existing.reporters.map((r, idx) =>
            idx === 0 ? { ...r, complaint: params.complaint.trim(), time: stamp } : r
          ),
        };
        saveLogs(logs.map((l) => (l.id === existing.id ? updated : l)));
        if (params.sendToAdmin) {
          syncToRelayMailbox(updated);
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
      aiSummary: params.aiSummary,
      aiQuickSteps: params.aiQuickSteps,
      device,
      reporterName,
      reporterEmail: acc?.email,
      reporterPhone: acc?.phone,
      reporterKey,
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
      diagnosticsSnapshot: diagnostics,
    };

    saveLogs([newEntry, ...logs]);
    if (params.sendToAdmin) {
      syncToRelayMailbox(newEntry);
    }
    return newEntry;
  },

  replyToTicket(params: {
    entryId: string;
    replyText: string;
    markResolved?: boolean;
  }): SmartCareLogEntry | null {
    const cleanReply = params.replyText.trim();
    if (!cleanReply) return null;

    const acc = AuthService.getAccount();
    const logs = loadLogs();
    const target = logs.find((l) => l.id === params.entryId);
    if (!target) return null;

    const stamp = nowLabel();
    const adminName = acc ? AuthService.getDisplayName(acc) : 'Admin WargaQu';
    const nextStatus: SmartCareTriageStatus = params.markResolved
      ? 'resolved'
      : target.triageStatus === 'new'
      ? 'queued'
      : target.triageStatus;

    const updated: SmartCareLogEntry = {
      ...target,
      adminReply: cleanReply,
      adminReplyAt: stamp,
      adminRepliedBy: adminName,
      triageStatus: nextStatus,
      updatedAt: stamp,
    };

    saveLogs(logs.map((l) => (l.id === target.id ? updated : l)));

    const replyPayload = {
      id: target.id,
      reporterKey: target.reporterKey,
      reporterEmail: target.reporterEmail,
      hiddenDeviceId: target.hiddenDeviceId,
      adminReply: cleanReply,
      adminReplyAt: stamp,
      adminRepliedBy: adminName,
      triageStatus: nextStatus,
    };

    RealtimeRelayService.publish('admin:policy', 'smartcare:reply', replyPayload);
    if (target.reporterEmail) {
      RealtimeRelayService.publish(
        getAccountSessionChannel(target.reporterEmail),
        'smartcare:reply',
        replyPayload
      );
    }

    if (typeof fetch !== 'undefined' && acc?.email) {
      void fetch(
        buildApiUrl(`/api/smartcare/tickets/${encodeURIComponent(target.id)}/reply`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminEmail: acc.email,
            adminReply: cleanReply,
            adminRepliedBy: adminName,
            triageStatus: nextStatus,
          }),
        }
      ).catch(() => {});
    }

    return updated;
  },

  ingestRemoteReport(incoming: SmartCareLogEntry) {
    if (!incoming?.id || !incoming?.complaint) return;
    const logs = loadLogs();
    const idx = logs.findIndex((l) => l.id === incoming.id);
    if (idx !== -1) {
      const merged: SmartCareLogEntry = {
        ...logs[idx],
        ...incoming,
        adminReply: incoming.adminReply || logs[idx].adminReply,
        adminReplyAt: incoming.adminReplyAt || logs[idx].adminReplyAt,
        adminRepliedBy: incoming.adminRepliedBy || logs[idx].adminRepliedBy,
      };
      const next = logs.map((l, i) => (i === idx ? merged : l));
      saveLogs(next);
    } else {
      saveLogs([{ ...incoming, triageStatus: incoming.triageStatus || 'new' }, ...logs]);
    }
  },

  ingestRemoteReply(payload: {
    id?: string;
    adminReply?: string;
    adminReplyAt?: string;
    adminRepliedBy?: string;
    triageStatus?: SmartCareTriageStatus;
  }): boolean {
    if (!payload?.id || !payload?.adminReply) return false;
    const logs = loadLogs();
    const idx = logs.findIndex((l) => l.id === payload.id);
    if (idx === -1) return false;
    const current = logs[idx];
    const nextEntry: SmartCareLogEntry = {
      ...current,
      adminReply: payload.adminReply,
      adminReplyAt: payload.adminReplyAt || nowLabel(),
      adminRepliedBy: payload.adminRepliedBy || 'Admin WargaQu',
      triageStatus: payload.triageStatus || current.triageStatus,
      updatedAt: payload.adminReplyAt || nowLabel(),
    };
    saveLogs(logs.map((l, i) => (i === idx ? nextEntry : l)));
    return true;
  },

  async syncTicketsFromRelay(isAdmin: boolean): Promise<{ pulled: number; newReplies: number }> {
    if (typeof fetch === 'undefined') return { pulled: 0, newReplies: 0 };
    const acc = AuthService.getAccount();
    const reporterKey = this.getReporterKey();
    const query =
      isAdmin && acc?.email
        ? `adminEmail=${encodeURIComponent(acc.email)}`
        : `reporterKey=${encodeURIComponent(reporterKey)}`;

    try {
      const res = await fetch(buildApiUrl(`/api/smartcare/tickets?${query}`), {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return { pulled: 0, newReplies: 0 };
      const data = (await res.json()) as { tickets?: SmartCareLogEntry[] };
      const remoteList = Array.isArray(data?.tickets) ? data.tickets : [];
      if (remoteList.length === 0) return { pulled: 0, newReplies: 0 };

      const logs = loadLogs();
      const map = new Map<string, SmartCareLogEntry>();
      logs.forEach((l) => map.set(l.id, l));

      let pulled = 0;
      let newReplies = 0;

      for (const rt of remoteList) {
        if (!rt?.id || !rt?.complaint) continue;
        const local = map.get(rt.id);
        if (!local) {
          map.set(rt.id, {
            ...rt,
            triageStatus: (rt.triageStatus as SmartCareTriageStatus) || 'new',
            occurrenceCount: rt.occurrenceCount || 1,
            reporters: Array.isArray(rt.reporters) && rt.reporters.length > 0
              ? rt.reporters
              : [
                  {
                    name: rt.reporterName || 'Warga',
                    device: rt.device || 'Perangkat WargaQu',
                    complaint: rt.complaint,
                    time: rt.createdAt || nowLabel(),
                  },
                ],
          });
          pulled += 1;
          if (rt.adminReply) newReplies += 1;
        } else if (rt.adminReply && rt.adminReply !== local.adminReply) {
          map.set(rt.id, {
            ...local,
            adminReply: rt.adminReply,
            adminReplyAt: rt.adminReplyAt || nowLabel(),
            adminRepliedBy: rt.adminRepliedBy || 'Admin WargaQu',
            triageStatus:
              (rt.triageStatus as SmartCareTriageStatus) || local.triageStatus,
            updatedAt: rt.updatedAt || local.updatedAt,
          });
          newReplies += 1;
        }
      }

      if (pulled > 0 || newReplies > 0) {
        saveLogs(Array.from(map.values()));
      }
      return { pulled, newReplies };
    } catch {
      return { pulled: 0, newReplies: 0 };
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
