import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  ExternalLink,
  Headphones,
  Inbox,
  Layers,
  ListCheck,
  Loader2,
  MessageSquareReply,
  Mic,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { AUTH_SYNC_EVENT } from '../../services/authService';
import { GuideModuleId } from '../../services/moduleOnboardingService';
import {
  SafeDiagnosticsSnapshot,
  SMART_CARE_SYNC_EVENT,
  SmartCareChatTurn,
  SmartCareLogEntry,
  SmartCareService,
} from '../../services/smartCareService';
import { ZERO_TRUST_SYNC_EVENT, ZeroTrustService } from '../../services/zeroTrustService';
import { LegalNoticeModal, LegalTab } from '../common/LegalNoticeModal';
import { SmartCareAdminTriagePanel } from './SmartCareAdminTriagePanel';
import { SmartCareModuleGuidesPanel } from './SmartCareModuleGuidesPanel';

interface BantuanViewProps {
  onBackToWarga: () => void;
  showNotification: (msg: string) => void;
}

type SmartCareViewTab = 'lapor' | 'tiket' | 'panduan' | 'admin_triage';

const USER_DRAFT_STORAGE_KEY = 'wargaqu_smartcare_user_draft_v1';

interface SavedUserDraft {
  text: string;
  entryId: string | null;
}

function loadUserDraft(): SavedUserDraft {
  try {
    const raw = localStorage.getItem(USER_DRAFT_STORAGE_KEY);
    if (!raw) return { text: '', entryId: null };
    const parsed = JSON.parse(raw) as Partial<SavedUserDraft>;
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      entryId: typeof parsed.entryId === 'string' ? parsed.entryId : null,
    };
  } catch {
    return { text: '', entryId: null };
  }
}

function saveUserDraft(draft: SavedUserDraft | null) {
  try {
    if (!draft || (!draft.text.trim() && !draft.entryId)) {
      localStorage.removeItem(USER_DRAFT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(USER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage quota errors
  }
}

function checkIsAdmin(): boolean {
  return (
    ZeroTrustService.isCurrentUserAdminAccount() ||
    SmartCareService.isDeveloperOrAdmin()
  );
}

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildWhatsAppHref(ticket: SmartCareLogEntry): string {
  const lines = [
    '*LAPORAN BANTUAN TEKNIS — WARGAQU SMART CARE*',
    `No. Tiket: ${ticket.id}`,
    `Pelapor: ${ticket.reporterName}`,
    `Perangkat: ${ticket.device}`,
    `Modul: ${ticket.module}`,
    `Tingkat: ${ticket.severity}`,
    `Kendala: "${ticket.complaint}"`,
    ticket.aiSummary ? `Ringkasan AI: ${ticket.aiSummary}` : '',
    '------------------------------------',
    'Mohon bantuan tim CS / Developer. Terima kasih!',
  ].filter(Boolean);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(lines.join('\n'))}`;
}

export const BantuanView: React.FC<BantuanViewProps> = ({
  onBackToWarga,
  showNotification,
}) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => checkIsAdmin());
  const [activeViewTab, setActiveViewTab] = useState<SmartCareViewTab>('lapor');
  const [focusedGuideId, setFocusedGuideId] = useState<GuideModuleId>('leluhurqu');
  const [legalModal, setLegalModal] = useState<{ open: boolean; tab: LegalTab }>({
    open: false,
    tab: 'privasi',
  });

  // Safe Read-Only Device & Session Diagnostics
  const [diagnostics, setDiagnostics] = useState<SafeDiagnosticsSnapshot>(() =>
    SmartCareService.collectSafeDiagnostics()
  );
  const [showDiagDetails, setShowDiagDetails] = useState<boolean>(false);

  // Conversational Gemini AI Assistant
  const [chatTurns, setChatTurns] = useState<SmartCareChatTurn[]>([]);
  const [isAskingAi, setIsAskingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Voice & Editable Input States
  const initialDraft = !checkIsAdmin() ? loadUserDraft() : { text: '', entryId: null };
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [voiceText, setVoiceText] = useState<string>(initialDraft.text);
  const [interimVoiceText, setInterimVoiceText] = useState<string>('');
  const [voiceStatus, setVoiceStatus] = useState<string>(
    initialDraft.text
      ? 'Draft keluhan tersimpan dimuat. Tanya AI atau langsung Kirim ke Admin.'
      : 'Tanya AI dengan mengetik atau rekam suara, atau kirim tiket ke Admin'
  );
  const [editingEntryId, setEditingEntryId] = useState<string | null>(initialDraft.entryId);
  const [lastSentTicketInfo, setLastSentTicketInfo] = useState<{
    id: string;
    sentAt: string;
  } | null>(null);

  // Synced Tickets & Admin Workbench
  const [logs, setLogs] = useState<SmartCareLogEntry[]>(() => SmartCareService.getLogs());
  const [myTickets, setMyTickets] = useState<SmartCareLogEntry[]>(() =>
    SmartCareService.getMyTickets()
  );
  const [isSyncingTickets, setIsSyncingTickets] = useState<boolean>(false);
  const [selectedLogId, setSelectedLogId] = useState<string>(
    () => SmartCareService.getLogs()[0]?.id || ''
  );
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Admin ticket detail fields
  const [selectedComplaintEdit, setSelectedComplaintEdit] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [adminReplyInput, setAdminReplyInput] = useState<string>('');
  const [isDraftingAdminAi, setIsDraftingAdminAi] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const finalVoiceBufferRef = useRef<string>(initialDraft.text);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const refreshDiagnostics = () => {
    setDiagnostics(SmartCareService.collectSafeDiagnostics());
  };

  useEffect(() => {
    const syncAuth = () => {
      const nextAdmin = checkIsAdmin();
      setIsAdmin(nextAdmin);
      if (!nextAdmin) {
        setActiveViewTab((prev) => (prev === 'admin_triage' ? 'lapor' : prev));
      }
      refreshDiagnostics();
      setMyTickets(SmartCareService.getMyTickets());
    };
    const syncLogs = () => {
      const next = SmartCareService.getLogs();
      setLogs(next);
      setMyTickets(SmartCareService.getMyTickets());
      if (next.length > 0 && !next.some((l) => l.id === selectedLogId)) {
        setSelectedLogId(next[0].id);
      }
    };
    window.addEventListener(AUTH_SYNC_EVENT, syncAuth);
    window.addEventListener(ZERO_TRUST_SYNC_EVENT, syncAuth);
    window.addEventListener(SMART_CARE_SYNC_EVENT, syncLogs);
    window.addEventListener('focus', syncLogs);
    window.addEventListener('focus', syncAuth);
    window.addEventListener('online', refreshDiagnostics);
    window.addEventListener('offline', refreshDiagnostics);

    // Pull latest tickets/replies once on open
    void SmartCareService.syncTicketsFromRelay(checkIsAdmin()).then((res) => {
      if (res.newReplies > 0) {
        showNotification(`${res.newReplies} balasan baru dari Admin Smart Care tersedia di Tiket Saya.`);
      }
    });

    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, syncAuth);
      window.removeEventListener(ZERO_TRUST_SYNC_EVENT, syncAuth);
      window.removeEventListener(SMART_CARE_SYNC_EVENT, syncLogs);
      window.removeEventListener('focus', syncLogs);
      window.removeEventListener('focus', syncAuth);
      window.removeEventListener('online', refreshDiagnostics);
      window.removeEventListener('offline', refreshDiagnostics);
    };
  }, [selectedLogId]);

  const selectedTicket = logs.find((l) => l.id === selectedLogId) || logs[0] || null;

  useEffect(() => {
    if (selectedTicket) {
      setSelectedComplaintEdit(selectedTicket.complaint);
      setCustomPrompt(selectedTicket.autoPrompt);
      setAdminReplyInput(selectedTicket.adminReply || '');
    }
  }, [
    selectedTicket?.id,
    selectedTicket?.complaint,
    selectedTicket?.autoPrompt,
    selectedTicket?.adminReply,
  ]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechReg =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechReg) {
      try {
        const recognition = new SpeechReg();
        recognition.lang = 'id-ID';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (e: any) => {
          let finalAddition = '';
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const transcript = e.results[i][0].transcript;
            if (e.results[i].isFinal) {
              finalAddition += `${transcript} `;
            } else {
              interim += transcript;
            }
          }
          if (finalAddition.trim()) {
            const base = finalVoiceBufferRef.current.trim();
            const merged = base ? `${base} ${finalAddition.trim()}` : finalAddition.trim();
            finalVoiceBufferRef.current = merged;
            setVoiceText(merged);
          }
          setInterimVoiceText(interim.trim());
        };

        recognition.onerror = () => {
          setIsRecording(false);
          setInterimVoiceText('');
          setVoiceStatus(
            'Koneksi mikrofon berhenti. Hasil rekaman tetap bisa Anda edit sebelum dikirim.'
          );
        };

        recognition.onend = () => {
          setIsRecording(false);
          setInterimVoiceText('');
        };

        recognitionRef.current = recognition;
      } catch {
        // ignore speech init failure
      }
    }
  }, []);

  useEffect(() => {
    if (chatTurns.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatTurns, isAskingAi]);

  // Handle back button
  useEffect(() => {
    window.history.replaceState({ screen: 'bantuan' }, '', '#bantuan');
    const handleBackButton = () => onBackToWarga();
    window.addEventListener('popstate', handleBackButton);

    let capHandle: any = null;
    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        CapApp.addListener('backButton', () => handleBackButton())
          .then((h) => {
            capHandle = h;
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('popstate', handleBackButton);
      if (capHandle?.remove) capHandle.remove();
    };
  }, [onBackToWarga]);

  const handleVoiceTextChange = (nextVal: string) => {
    setVoiceText(nextVal);
    finalVoiceBufferRef.current = nextVal;
  };

  const stopRecordingIfNeeded = () => {
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
      setInterimVoiceText('');
    }
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      showNotification('Perangkat/browser ini tidak mendukung dikte suara. Silakan ketik manual.');
      return;
    }

    if (!isRecording) {
      try {
        finalVoiceBufferRef.current = voiceText;
        recognitionRef.current.start();
        setIsRecording(true);
        setVoiceStatus('Mendengarkan suara Anda... Ketuk lagi untuk berhenti.');
      } catch {
        showNotification('Gagal memulai mikrofon. Periksa izin mic atau ketik manual.');
      }
    } else {
      stopRecordingIfNeeded();
      setVoiceStatus('Rekaman selesai! Silakan ketuk Tanya AI atau Kirim ke Admin.');
    }
  };

  const clearVoiceText = () => {
    setVoiceText('');
    setInterimVoiceText('');
    finalVoiceBufferRef.current = '';
    setEditingEntryId(null);
    setLastSentTicketInfo(null);
    setAiError(null);
    if (!isAdmin) {
      saveUserDraft(null);
    }
    setVoiceStatus('Kotak input direset. Tulis pertanyaan atau rekam kendala baru.');
  };

  const handleAskSmartCareAi = async (overrideText?: string) => {
    const query = (
      overrideText !== undefined
        ? overrideText
        : [voiceText.trim(), interimVoiceText.trim()].filter(Boolean).join(' ')
    ).trim();

    if (!query) {
      showNotification('Tuliskan pertanyaan atau kendala terlebih dahulu.');
      return;
    }

    stopRecordingIfNeeded();
    setAiError(null);

    const userTurn: SmartCareChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: nowTimeLabel(),
    };

    const nextHistory = [...chatTurns, userTurn];
    setChatTurns(nextHistory);
    if (overrideText === undefined) {
      setVoiceText('');
      finalVoiceBufferRef.current = '';
      if (!isAdmin) saveUserDraft(null);
    }

    setIsAskingAi(true);
    const freshDiag = SmartCareService.collectSafeDiagnostics();
    setDiagnostics(freshDiag);

    try {
      const aiResult = await SmartCareService.askGeminiSmartCare({
        messages: nextHistory.map((t) => ({ role: t.role, text: t.text })),
        diagnostics: freshDiag,
      });

      const assistantTurn: SmartCareChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: aiResult.reply,
        timestamp: nowTimeLabel(),
        aiMeta: aiResult,
      };
      setChatTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal menghubungi asisten Smart Care AI.';
      setAiError(msg);
      showNotification(msg);
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleEscalateFromAi = (turn: SmartCareChatTurn) => {
    const relatedUserTurn = [...chatTurns]
      .reverse()
      .find((t) => t.role === 'user');
    const complaintText =
      relatedUserTurn?.text ||
      turn.aiMeta?.escalatedSummary ||
      'Laporan kendala dari percakapan Smart Care AI';

    const saved = SmartCareService.submitUserReport({
      complaint: complaintText,
      module: turn.aiMeta?.detectedModule,
      detectedError: turn.aiMeta?.escalatedSummary || 'Eskalasi Asisten AI',
      severity: turn.aiMeta?.severity || 'Medium',
      autoPrompt: turn.aiMeta?.suggestedFixPrompt || undefined,
      aiSummary: turn.aiMeta?.escalatedSummary || turn.text.slice(0, 260),
      aiQuickSteps: turn.aiMeta?.quickSteps,
      diagnosticsSnapshot: diagnostics,
      sendToAdmin: true,
    });

    setLastSentTicketInfo({
      id: saved.id,
      sentAt: saved.sentToAdminAt || saved.updatedAt,
    });
    showNotification(`Tiket ${saved.id} berhasil dikirim ke Admin & masuk ke tab Tiket Saya!`);
  };

  const handleSaveOrSendReport = (sendToAdmin: boolean) => {
    const combinedText = [voiceText.trim(), interimVoiceText.trim()]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!combinedText) {
      showNotification('Silakan rekam atau ketik keluhan teknis terlebih dahulu.');
      return;
    }

    stopRecordingIfNeeded();

    const lastAiTurn = [...chatTurns]
      .reverse()
      .find((t) => t.role === 'assistant' && t.aiMeta);

    const saved = SmartCareService.submitUserReport({
      complaint: combinedText,
      module: lastAiTurn?.aiMeta?.detectedModule,
      autoPrompt: lastAiTurn?.aiMeta?.suggestedFixPrompt || undefined,
      aiSummary: lastAiTurn?.aiMeta?.escalatedSummary,
      aiQuickSteps: lastAiTurn?.aiMeta?.quickSteps,
      diagnosticsSnapshot: diagnostics,
      sendToAdmin,
      existingId: editingEntryId || undefined,
    });

    if (!isAdmin) {
      if (sendToAdmin) {
        saveUserDraft(null);
        setVoiceText('');
        finalVoiceBufferRef.current = '';
        setEditingEntryId(null);
        setLastSentTicketInfo({
          id: saved.id,
          sentAt: saved.sentToAdminAt || saved.updatedAt,
        });
        setVoiceStatus(
          `Tiket ${saved.id} terkirim ke Admin. Pantau balasan Admin di tab Tiket Saya.`
        );
        showNotification(`Tiket ${saved.id} berhasil dikirim ke Admin!`);
      } else {
        saveUserDraft({ text: combinedText, entryId: saved.id });
        setVoiceText(combinedText);
        finalVoiceBufferRef.current = combinedText;
        setEditingEntryId(saved.id);
        setLastSentTicketInfo(null);
        setVoiceStatus(
          `Draft keluhan tersimpan (${saved.id}). Edit kapan saja lalu kirim ke Admin.`
        );
        showNotification(`Draft keluhan disimpan (${saved.id}).`);
      }
      return;
    }

    const similarity = SmartCareService.analyzeSimilarity(saved);
    setSelectedLogId(saved.id);
    setCustomPrompt(saved.autoPrompt);
    setVoiceText('');
    finalVoiceBufferRef.current = '';
    setEditingEntryId(null);
    setVoiceStatus(
      sendToAdmin
        ? `Laporan ${saved.id} terkirim & Auto-Prompt siap.`
        : `Draft laporan ${saved.id} disimpan (${similarity.label}).`
    );

    showNotification(
      sendToAdmin
        ? `Terkirim ke Log Admin (${saved.id}) & Auto-Prompt dibuat!`
        : `Keluhan ${saved.id} disimpan!`
    );
  };

  const handleSyncTickets = async () => {
    setIsSyncingTickets(true);
    const res = await SmartCareService.syncTicketsFromRelay(isAdmin);
    setIsSyncingTickets(false);
    setMyTickets(SmartCareService.getMyTickets());
    setLogs(SmartCareService.getLogs());
    if (res.newReplies > 0) {
      showNotification(`${res.newReplies} balasan baru dari Admin diterima!`);
    } else if (res.pulled > 0) {
      showNotification(`${res.pulled} tiket disinkronkan dari relay.`);
    } else {
      showNotification('Status tiket sudah paling baru.');
    }
  };

  const handleSaveSelectedTicketEdits = (sendToAdmin: boolean) => {
    if (!selectedTicket) return;
    const cleanComplaint = selectedComplaintEdit.trim();
    if (!cleanComplaint) {
      showNotification('Isi keluhan tidak boleh kosong.');
      return;
    }
    const updated = SmartCareService.submitUserReport({
      complaint: cleanComplaint,
      autoPrompt: customPrompt.trim() || undefined,
      existingId: selectedTicket.id,
      sendToAdmin,
    });
    showNotification(
      sendToAdmin
        ? `Hasil edit ${updated.id} disimpan & dikirim ke Log Admin!`
        : `Hasil edit ${updated.id} & Auto-Prompt disimpan.`
    );
  };

  const copyPrompt = () => {
    if (!customPrompt) return;
    navigator.clipboard
      .writeText(customPrompt)
      .then(() => {
        setIsCopied(true);
        showNotification('Auto-Prompt perbaikan berhasil disalin!');
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(() => {
        showNotification('Auto-Prompt siap disalin.');
      });
  };

  const offlineMatches = useMemo(() => {
    const q = voiceText.trim() || chatTurns[chatTurns.length - 1]?.text || '';
    if (q.length < 4) return [];
    return SmartCareService.findOfflineModuleFaq(q);
  }, [voiceText, chatTurns]);

  const filteredLogs = logs.filter((t) => {
    if (t.triageStatus === 'merged') return false;
    if (activeFilter === 'open') return t.triageStatus !== 'resolved' && t.triageStatus !== 'skipped';
    if (activeFilter === 'resolved') return t.triageStatus === 'resolved';
    return true;
  });

  const newIncomingCount = logs.filter((l) => l.triageStatus === 'new').length;
  const repliedTicketsCount = myTickets.filter((t) => Boolean(t.adminReply)).length;
  const liveSimilarityPreview =
    isAdmin && voiceText.trim().length >= 8
      ? SmartCareService.analyzeSimilarity(voiceText.trim(), editingEntryId || undefined)
      : null;

  return (
    <div className="w-full h-full bg-slate-900 text-slate-100 flex flex-col justify-between overflow-hidden relative select-none font-sans">
      {/* HEADER */}
      <header className="bg-slate-800 border-b border-slate-700 px-3.5 py-2.5 sticky top-0 z-30 shrink-0 shadow-md space-y-2">
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBackToWarga}
              className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center active:scale-95 transition shrink-0"
              title="Kembali ke Beranda WargaQu"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
            </button>
            <div className="bg-emerald-500 text-slate-950 p-2 rounded-xl font-bold flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <Headphones className="w-4 h-4 text-slate-950" />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-sm leading-tight text-white truncate">
                WargaQu Smart Care
              </h1>
              <p className="text-[10px] text-slate-400 truncate">
                {isAdmin
                  ? 'Asisten AI, Balasan Tiket & Auto-Fix Developer'
                  : 'Asisten AI Terpadu, Diagnostik & Tiket Bantuan'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setLegalModal({ open: true, tab: 'privasi' })}
              className="bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-[10px] px-2.5 py-1 rounded-full font-bold border border-slate-600 flex items-center gap-1 transition active:scale-95"
              title="Kebijakan Privasi, Disclaimer & Hak Cipta WargaQu"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Legal</span>
            </button>
            <span
              className={`text-[10px] px-2.5 py-1 rounded-full font-mono border flex items-center gap-1 ${
                diagnostics.online
                  ? 'bg-emerald-900/60 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-950/70 text-amber-300 border-amber-500/30'
              }`}
              title={
                diagnostics.online
                  ? 'Terhubung ke Gemini Smart Care AI'
                  : 'Sedang offline — mode panduan lokal aktif'
              }
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="font-bold">{diagnostics.online ? 'Gemini AI' : 'Offline'}</span>
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-xl text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setActiveViewTab('lapor')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 whitespace-nowrap ${
              activeViewTab === 'lapor'
                ? 'bg-emerald-600 text-slate-950 font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Tanya AI</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveViewTab('tiket');
              void handleSyncTickets();
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 whitespace-nowrap ${
              activeViewTab === 'tiket'
                ? 'bg-indigo-500 text-slate-950 font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Inbox className="w-3.5 h-3.5 shrink-0" />
            <span>
              Tiket Saya
              {repliedTicketsCount > 0
                ? ` (${repliedTicketsCount})`
                : myTickets.length > 0
                ? ` (${myTickets.length})`
                : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('panduan')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 whitespace-nowrap ${
              activeViewTab === 'panduan'
                ? 'bg-sky-500 text-slate-950 font-extrabold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span>Panduan</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveViewTab('admin_triage')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 whitespace-nowrap ${
                activeViewTab === 'admin_triage'
                  ? 'bg-amber-400 text-slate-950 font-extrabold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>
                Triage
                {newIncomingCount > 0 ? ` (${newIncomingCount})` : ''}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-3.5 pb-16">
        {isAdmin && activeViewTab === 'admin_triage' ? (
          <SmartCareAdminTriagePanel showNotification={showNotification} />
        ) : activeViewTab === 'panduan' ? (
          <SmartCareModuleGuidesPanel
            showNotification={showNotification}
            initialModuleId={focusedGuideId}
          />
        ) : activeViewTab === 'tiket' ? (
          /* TAB 2: TIKET SAYA (2-WAY TICKET HISTORY & ADMIN REPLIES) */
          <section className="space-y-3">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-indigo-400" />
                  <span>Status Tiket &amp; Balasan Admin</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Menampilkan laporan yang Anda kirim dari perangkat/akun ini beserta balasan Admin.
                </p>
              </div>
              <button
                type="button"
                disabled={isSyncingTickets}
                onClick={() => void handleSyncTickets()}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 flex items-center gap-1.5 shrink-0 active:scale-95 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncingTickets ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {myTickets.length === 0 ? (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-2.5">
                <p className="text-xs text-slate-300 font-semibold">
                  Belum ada tiket bantuan yang Anda kirim.
                </p>
                <p className="text-[11px] text-slate-400">
                  Coba tanya Asisten AI terlebih dahulu di tab Tanya AI, atau kirim tiket jika butuh bantuan Admin.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveViewTab('lapor')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Buka Tanya AI</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myTickets.map((ticket) => (
                  <article
                    key={ticket.id}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-extrabold text-xs text-emerald-400">
                          {ticket.id}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            ticket.triageStatus === 'resolved'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : ticket.adminReply || ticket.triageStatus === 'queued'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {ticket.triageStatus === 'resolved'
                            ? 'Selesai'
                            : ticket.adminReply || ticket.triageStatus === 'queued'
                            ? 'Ditangani'
                            : 'Menunggu Admin'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {ticket.sentToAdminAt || ticket.updatedAt}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-white leading-relaxed">
                      &ldquo;{ticket.complaint}&rdquo;
                    </p>

                    <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Modul: {ticket.module}</span>
                      <span>Perangkat: {ticket.device}</span>
                    </div>

                    {ticket.aiQuickSteps && ticket.aiQuickSteps.length > 0 && (
                      <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 space-y-1">
                        <div className="text-[10px] font-bold text-sky-300">
                          Saran Awal Smart Care AI:
                        </div>
                        <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-0.5">
                          {ticket.aiQuickSteps.map((step, sIdx) => (
                            <li key={sIdx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {ticket.adminReply ? (
                      <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-xl p-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
                          <span className="flex items-center gap-1">
                            <MessageSquareReply className="w-3.5 h-3.5" />
                            <span>Balasan {ticket.adminRepliedBy || 'Admin WargaQu'}</span>
                          </span>
                          <span>{ticket.adminReplyAt || ticket.updatedAt}</span>
                        </div>
                        <p className="text-xs text-emerald-100 leading-relaxed whitespace-pre-line">
                          {ticket.adminReply}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">
                        Belum ada balasan tertulis dari Admin. Ketuk Refresh untuk cek pembaruan.
                      </div>
                    )}

                    <div className="flex justify-end pt-0.5">
                      <a
                        href={buildWhatsAppHref(ticket)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-emerald-300 inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Teruskan ke WhatsApp CS</span>
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          /* TAB 1: TANYA AI + DIAGNOSTIK + ESCALATION */
          <>
            {/* DIAGNOSTIK OTOMATIS PERANGKAT & AKUN */}
            <section className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 space-y-2">
              <button
                type="button"
                onClick={() => setShowDiagDetails((v) => !v)}
                className="w-full flex items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Wrench className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-white flex flex-wrap items-center gap-1.5">
                      <span>Diagnostik:</span>
                      <span className="text-emerald-400 uppercase">
                        {diagnostics.container} v{diagnostics.appVersion}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span
                        className={
                          diagnostics.relayStatus === 'connected'
                            ? 'text-emerald-400'
                            : 'text-amber-300'
                        }
                      >
                        Relay {diagnostics.relayStatus === 'connected' ? 'Terhubung' : diagnostics.relayStatus}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span
                        className={
                          diagnostics.storagePct >= 80 ? 'text-rose-400' : 'text-slate-300'
                        }
                      >
                        Memori {diagnostics.storagePct}%
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-slate-400 shrink-0">
                  {showDiagDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>

              {diagnostics.warnings.length > 0 && !showDiagDetails && (
                <div className="text-[11px] text-amber-300 flex items-start gap-1.5 pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="line-clamp-1">{diagnostics.warnings[0]}</span>
                </div>
              )}

              {showDiagDetails && (
                <div className="pt-2 border-t border-slate-700/70 space-y-2 text-[11px]">
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Status Akun</div>
                      <div className="font-bold text-white">
                        {diagnostics.hasLoggedInAccount
                          ? `Login (${diagnostics.accountRoleLabel})`
                          : 'Mode Tamu Lokal'}
                      </div>
                    </div>
                    <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-700/60">
                      <div className="text-[10px] text-slate-400">Penyimpanan Lokal</div>
                      <div className="font-bold text-white">
                        {diagnostics.storageUsedKb} KB / {diagnostics.storageLimitKb} KB ({diagnostics.storagePct}%)
                      </div>
                    </div>
                  </div>
                  {diagnostics.warnings.length > 0 ? (
                    <ul className="space-y-1 text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-xl p-2.5">
                      {diagnostics.warnings.map((w, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Semua kondisi perangkat &amp; relay terlihat sehat.</span>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        refreshDiagnostics();
                        showNotification('Snapshot diagnostik perangkat diperbarui.');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-[10px] font-bold text-slate-200 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3 text-emerald-400" />
                      <span>Cek Ulang</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* AI CHAT CONVERSATION + COMPOSER */}
            <section className="bg-slate-800 border border-slate-700 rounded-2xl p-3.5 shadow-lg space-y-3">
              <div className="flex justify-between items-center gap-2">
                <h2 className="font-bold text-slate-200 text-xs flex items-center gap-2 uppercase tracking-wider">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span>
                    {isAdmin && editingEntryId
                      ? `Edit Keluhan (${editingEntryId})`
                      : 'Asisten AI Smart Care'}
                  </span>
                </h2>
                <div className="flex items-center gap-1.5">
                  {liveSimilarityPreview && liveSimilarityPreview.matchedEntry && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        liveSimilarityPreview.level === 'sama'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {liveSimilarityPreview.label} dgn {liveSimilarityPreview.matchedEntry.id}
                    </span>
                  )}
                  {chatTurns.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setChatTurns([]);
                        setAiError(null);
                      }}
                      className="text-[10px] text-slate-400 hover:text-white font-semibold"
                    >
                      Chat Baru
                    </button>
                  )}
                </div>
              </div>

              {/* Conversation History */}
              {chatTurns.length === 0 ? (
                <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Halo! Saya <strong>WargaQu Smart Care AI</strong>. Tanyakan kendala cetak grid NasabQu, sinkronisasi akun APK &amp; PWA, kasir UsahaQu, RTQu, atau fitur lainnya — saya baca juga kondisi perangkat Anda.
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                    {[
                      {
                        label: 'NasabQu Grid & Cetak Warna',
                        text: 'Bagaimana cara cetak grid NasabQu full warna dan apakah foto otomatis HD saat diunduh?',
                      },
                      {
                        label: 'Sinkron APK & PWA',
                        text: 'Bagaimana cara agar akun dan data NasabQu sinkron antara PWA web dan APK Android tanpa login ganda?',
                      },
                      {
                        label: '3 Mode Card NasabQu',
                        text: 'Apa saja pilihan tampilan Mode Card di Kanvas Grid NasabQu?',
                      },
                      {
                        label: 'Printer Nota UsahaQu',
                        text: 'Printer Bluetooth UsahaQu terputus saat mau cetak struk 58mm, solusinya apa?',
                      },
                      {
                        label: 'Cara Tombol SOS SiagaQu',
                        text: 'Kenapa tombol SOS SiagaQu tidak langsung bunyi saat tersentuh dan bagaimana cara ujinya?',
                      },
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={isAskingAi}
                        onClick={() => void handleAskSmartCareAi(chip.text)}
                        className="text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/25 px-2.5 py-1.5 rounded-lg whitespace-nowrap active:scale-95 transition"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1 no-scrollbar">
                  {chatTurns.map((turn) => {
                    if (turn.role === 'user') {
                      return (
                        <div key={turn.id} className="flex justify-end">
                          <div className="max-w-[88%] bg-emerald-600 text-slate-950 rounded-2xl rounded-tr-sm px-3 py-2 text-xs font-semibold shadow-xs">
                            <p className="leading-relaxed whitespace-pre-line">{turn.text}</p>
                            <div className="text-[9px] text-emerald-950/75 text-right mt-1">
                              {turn.timestamp}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const meta = turn.aiMeta;
                    return (
                      <div key={turn.id} className="flex justify-start">
                        <div className="max-w-[94%] bg-slate-900 border border-slate-700 rounded-2xl rounded-tl-sm p-3 text-xs space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="text-[10px] font-extrabold text-emerald-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              <span>Smart Care AI · {meta?.detectedModule || 'Umum'}</span>
                            </span>
                            <span className="text-[9px] text-slate-400">{turn.timestamp}</span>
                          </div>

                          <p className="text-slate-100 leading-relaxed whitespace-pre-line">
                            {turn.text}
                          </p>

                          {meta?.quickSteps && meta.quickSteps.length > 0 && (
                            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-1">
                              <div className="text-[10px] font-bold text-sky-300">
                                Langkah Cepat:
                              </div>
                              <ol className="list-decimal list-inside text-[11px] text-slate-200 space-y-1 leading-relaxed">
                                {meta.quickSteps.map((step, idx) => (
                                  <li key={idx}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {meta?.recommendedGuideId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFocusedGuideId(meta.recommendedGuideId as GuideModuleId);
                                  setActiveViewTab('panduan');
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-bold flex items-center gap-1"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>Buka Panduan Modul</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleEscalateFromAi(turn)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                                meta?.needsAdminEscalation
                                  ? 'bg-amber-500 text-slate-950 font-extrabold'
                                  : 'bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700'
                              }`}
                            >
                              <Send className="w-3 h-3" />
                              <span>
                                {meta?.needsAdminEscalation
                                  ? 'Eskalasi & Kirim Tiket ke Admin'
                                  : 'Kirim Tiket ke Admin'}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isAskingAi && (
                    <div className="flex justify-start">
                      <div className="bg-slate-900 border border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-300 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        <span>Smart Care AI sedang menganalisa pertanyaan &amp; diagnostik...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* Honest Error Banner if AI failed */}
              {aiError && (
                <div className="bg-rose-950/60 border border-rose-500/40 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{aiError}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const lastUser = [...chatTurns]
                          .reverse()
                          .find((t) => t.role === 'user');
                        if (lastUser) void handleAskSmartCareAi(lastUser.text);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-100 text-[11px] font-bold"
                    >
                      Coba Tanya Lagi
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewTab('panduan')}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-sky-300 text-[11px] font-bold"
                    >
                      Buka Panduan Offline
                    </button>
                  </div>
                </div>
              )}

              {/* Offline Guide Instant Matches */}
              {offlineMatches.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-2.5 space-y-1.5">
                  <div className="text-[10px] font-bold text-sky-400 flex items-center justify-between">
                    <span>Referensi Panduan Modul (Offline)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedGuideId(offlineMatches[0].moduleId);
                        setActiveViewTab('panduan');
                      }}
                      className="underline"
                    >
                      Lihat Lengkap
                    </button>
                  </div>
                  {offlineMatches.map((m, idx) => (
                    <div key={idx} className="text-[11px] text-slate-300 leading-snug">
                      <span className="font-bold text-white">{m.moduleName}:</span> {m.answer}
                    </div>
                  ))}
                </div>
              )}

              {/* Voice + Text Input Box */}
              <div className="flex items-start gap-3 bg-slate-900 p-3 rounded-xl border border-slate-700/80">
                <button
                  id="btnVoice"
                  type="button"
                  onClick={toggleVoice}
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-white transition shrink-0 active:scale-95 shadow-md mt-1 ${
                    isRecording
                      ? 'bg-rose-600 mic-pulse shadow-rose-600/40'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }`}
                  title="Tekan untuk rekam / stop suara"
                >
                  <Mic className="w-5 h-5" />
                </button>

                <div className="grow min-w-0 space-y-1.5">
                  <p className="text-[11px] text-slate-400 leading-tight">{voiceStatus}</p>
                  <textarea
                    rows={2}
                    value={voiceText}
                    onChange={(e) => handleVoiceTextChange(e.target.value)}
                    placeholder={
                      isRecording
                        ? 'Sedang mendengarkan... Anda juga bisa langsung edit teks.'
                        : 'Tulis pertanyaan atau keluhan Anda di sini...'
                    }
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-xs font-medium text-emerald-300 placeholder:text-slate-500 focus:outline-none leading-relaxed"
                  />
                  {interimVoiceText && (
                    <div className="text-[11px] text-amber-300/90 italic">
                      Mendengar: &ldquo;{interimVoiceText}...&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isAskingAi}
                  onClick={() => void handleAskSmartCareAi()}
                  className="grow bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-emerald-600/20 transition"
                >
                  {isAskingAi ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Tanya AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOrSendReport(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Tiket</span>
                </button>
                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleSaveOrSendReport(false)}
                    className="px-3 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                    title="Simpan Draft Keluhan"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Draft</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearVoiceText}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 px-3 rounded-xl text-xs active:scale-95 transition"
                  title="Reset Kotak Input"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {lastSentTicketInfo && (
                <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Tiket <strong>{lastSentTicketInfo.id}</strong> terkirim ke Admin ({lastSentTicketInfo.sentAt}).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveViewTab('tiket');
                      void handleSyncTickets();
                    }}
                    className="text-[11px] font-bold text-sky-300 hover:underline shrink-0"
                  >
                    Lihat Tiket Saya
                  </button>
                </div>
              )}
            </section>

            {/* ADMIN QUICK TICKET & REPLY WORKBENCH */}
            {isAdmin && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {/* LEFT: DAFTAR TIKET KELUHAN */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <ListCheck className="w-4 h-4 text-sky-400" />
                      <span>Riwayat Keluhan Masuk</span>
                    </h2>
                    <button
                      type="button"
                      disabled={isSyncingTickets}
                      onClick={() => void handleSyncTickets()}
                      className="bg-slate-700 hover:bg-slate-600 text-[10px] text-slate-200 px-2.5 py-1 rounded-full font-bold flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingTickets ? 'animate-spin' : ''}`} />
                      <span>{filteredLogs.length} Laporan</span>
                    </button>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex gap-1 bg-slate-900 p-1 rounded-xl text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setActiveFilter('all')}
                      className={`flex-1 py-1 rounded-lg transition ${
                        activeFilter === 'all'
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Semua ({logs.filter((l) => l.triageStatus !== 'merged').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('open')}
                      className={`flex-1 py-1 rounded-lg transition ${
                        activeFilter === 'open'
                          ? 'bg-emerald-600 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Aktif (
                      {
                        logs.filter(
                          (t) =>
                            t.triageStatus !== 'merged' &&
                            t.triageStatus !== 'resolved' &&
                            t.triageStatus !== 'skipped'
                        ).length
                      }
                      )
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('resolved')}
                      className={`flex-1 py-1 rounded-lg transition ${
                        activeFilter === 'resolved'
                          ? 'bg-slate-700 text-emerald-400'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Selesai ({logs.filter((t) => t.triageStatus === 'resolved').length})
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
                    {filteredLogs.length === 0 ? (
                      <div className="bg-slate-900 p-6 text-center text-slate-500 text-xs rounded-xl italic">
                        Belum ada laporan dalam kategori ini.
                      </div>
                    ) : (
                      filteredLogs.map((ticket) => {
                        const isSelected = selectedTicket?.id === ticket.id;
                        const sim = SmartCareService.analyzeSimilarity(ticket);
                        return (
                          <div
                            key={ticket.id}
                            onClick={() => setSelectedLogId(ticket.id)}
                            className={`p-3 rounded-xl cursor-pointer transition-all border ${
                              isSelected
                                ? 'bg-slate-900 border-emerald-500/70 shadow-md shadow-emerald-500/10'
                                : 'bg-slate-900/80 border-slate-700/80 hover:bg-slate-750'
                            }`}
                          >
                            <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-emerald-400 font-bold">
                                  {ticket.id}
                                </span>
                                {sim.matchedEntry && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                                    {sim.label} {sim.matchedEntry.id}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {ticket.adminReply && (
                                  <span className="bg-sky-950 text-sky-300 border border-sky-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                    Dibalas
                                  </span>
                                )}
                                {ticket.triageStatus === 'resolved' && (
                                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                    Selesai
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500">
                                  {ticket.updatedAt}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-200 font-medium line-clamp-2 leading-relaxed">
                              &ldquo;{ticket.complaint}&rdquo;
                            </p>
                            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Smartphone className="w-3 h-3 text-slate-400" />
                                <span>
                                  {ticket.reporterName} · {ticket.device}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEntryId(ticket.id);
                                  handleVoiceTextChange(ticket.complaint);
                                  setVoiceStatus(
                                    `Mengedit ${ticket.id} — ubah teks lalu klik Simpan atau Kirim.`
                                  );
                                }}
                                className="text-[10px] text-sky-300 hover:underline font-bold flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* RIGHT: DETAIL TIKET, BALASAN ADMIN & AUTO-FIX PROMPT */}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-md space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <h2 className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Balasan Pelapor &amp; Auto-Fix Prompt</span>
                      </h2>
                      {selectedTicket && (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {selectedTicket.id}
                        </span>
                      )}
                    </div>

                    {selectedTicket && (
                      <>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-400 space-y-1">
                          <div>
                            Modul:{' '}
                            <span className="text-sky-300 font-bold">{selectedTicket.module}</span>
                          </div>
                          <div>
                            Diagnosa:{' '}
                            <span className="text-rose-400 font-bold">
                              {selectedTicket.detectedError}
                            </span>
                          </div>
                        </div>

                        {/* Balas ke Pelapor */}
                        <div className="bg-slate-900/90 border border-sky-500/30 rounded-xl p-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[10px] text-sky-300 uppercase font-bold flex items-center gap-1">
                              <MessageSquareReply className="w-3.5 h-3.5" />
                              <span>Balas ke {selectedTicket.reporterName}</span>
                            </label>
                            <button
                              type="button"
                              disabled={isDraftingAdminAi}
                              onClick={async () => {
                                setIsDraftingAdminAi(true);
                                try {
                                  const res =
                                    await SmartCareService.draftAdminReplyWithAi(selectedTicket);
                                  setAdminReplyInput(res.reply);
                                  showNotification('Draf balasan AI siap dikirim.');
                                } catch (err) {
                                  showNotification(
                                    err instanceof Error
                                      ? err.message
                                      : 'Gagal menyusun draf AI.'
                                  );
                                } finally {
                                  setIsDraftingAdminAi(false);
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                              {isDraftingAdminAi ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              <span>Draf Balasan AI</span>
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={adminReplyInput}
                            onChange={(e) => setAdminReplyInput(e.target.value)}
                            placeholder="Tulis balasan solusi yang muncul di tab Tiket Saya pelapor..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (!adminReplyInput.trim()) {
                                  showNotification('Tuliskan isi balasan terlebih dahulu.');
                                  return;
                                }
                                SmartCareService.replyToTicket({
                                  entryId: selectedTicket.id,
                                  replyText: adminReplyInput,
                                  markResolved: true,
                                });
                                showNotification(
                                  `Balasan terkirim ke pelapor & tiket ${selectedTicket.id} selesai!`
                                );
                              }}
                              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
                              <span>Kirim Balasan &amp; Selesai</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1">
                            Teks Keluhan (Bisa Diedit):
                          </label>
                          <textarea
                            rows={2}
                            value={selectedComplaintEdit}
                            onChange={(e) => setSelectedComplaintEdit(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] text-slate-400 uppercase font-semibold">
                              Prompt Perbaikan Developer (Bisa Diedit):
                            </label>
                            <span className="text-[9px] text-slate-500 font-mono">Editable</span>
                          </div>
                          <textarea
                            rows={5}
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {selectedTicket && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveSelectedTicketEdits(false)}
                          className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Simpan Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveSelectedTicketEdits(true)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Kirim ke Log</span>
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={copyPrompt}
                          className="grow bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{isCopied ? 'Tersalin!' : 'Salin Prompt'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextStatus =
                              selectedTicket.triageStatus === 'resolved' ? 'new' : 'resolved';
                            SmartCareService.setTriageStatus(selectedTicket.id, nextStatus);
                            showNotification(
                              nextStatus === 'resolved'
                                ? `Tiket ${selectedTicket.id} ditandai Selesai.`
                                : `Tiket ${selectedTicket.id} dibuka kembali.`
                            );
                          }}
                          className="bg-slate-700 hover:bg-slate-600 text-amber-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {selectedTicket.triageStatus === 'resolved'
                              ? 'Buka Lagi'
                              : 'Tandai Selesai'}
                          </span>
                        </button>
                      </div>

                      <a
                        href={buildWhatsAppHref(selectedTicket)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                        <span>Kirim Laporan via WhatsApp ke Tim Developer</span>
                      </a>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <LegalNoticeModal
        isOpen={legalModal.open}
        onClose={() => setLegalModal((prev) => ({ ...prev, open: false }))}
        initialTab={legalModal.tab}
      />
    </div>
  );
};
