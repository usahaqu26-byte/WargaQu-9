import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Headphones,
  Bot,
  Mic,
  RotateCcw,
  Zap,
  CheckCircle2,
  Copy,
  Smartphone,
  Send,
  Sparkles,
  ListCheck,
  Check,
  Save,
  Edit3,
  Layers,
  BookOpen,
} from 'lucide-react';
import {
  SMART_CARE_SYNC_EVENT,
  SmartCareLogEntry,
  SmartCareService,
} from '../../services/smartCareService';
import { AUTH_SYNC_EVENT } from '../../services/authService';
import { ZERO_TRUST_SYNC_EVENT, ZeroTrustService } from '../../services/zeroTrustService';
import { SmartCareAdminTriagePanel } from './SmartCareAdminTriagePanel';
import { SmartCareModuleGuidesPanel } from './SmartCareModuleGuidesPanel';

interface BantuanViewProps {
  onBackToWarga: () => void;
  showNotification: (msg: string) => void;
}

type SmartCareViewTab = 'lapor' | 'panduan' | 'admin_triage';

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

export const BantuanView: React.FC<BantuanViewProps> = ({
  onBackToWarga,
  showNotification,
}) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => checkIsAdmin());
  const [activeViewTab, setActiveViewTab] = useState<SmartCareViewTab>('lapor');

  // Voice & Editable Entry States
  const initialDraft = !checkIsAdmin() ? loadUserDraft() : { text: '', entryId: null };
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [voiceText, setVoiceText] = useState<string>(initialDraft.text);
  const [interimVoiceText, setInterimVoiceText] = useState<string>('');
  const [voiceStatus, setVoiceStatus] = useState<string>(
    initialDraft.text
      ? 'Draft keluhan tersimpan dimuat. Edit bila perlu lalu klik Simpan atau Kirim.'
      : 'Tekan mic untuk rekam suara atau ketik/edit langsung kendala teknis Anda'
  );
  const [editingEntryId, setEditingEntryId] = useState<string | null>(initialDraft.entryId);
  const [lastSentTicketInfo, setLastSentTicketInfo] = useState<{
    id: string;
    sentAt: string;
  } | null>(null);

  // Synced Smart Care logs (admin-only visibility)
  const [logs, setLogs] = useState<SmartCareLogEntry[]>(() => SmartCareService.getLogs());
  const [selectedLogId, setSelectedLogId] = useState<string>(
    () => SmartCareService.getLogs()[0]?.id || ''
  );
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Editable details of selected log
  const [selectedComplaintEdit, setSelectedComplaintEdit] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const finalVoiceBufferRef = useRef<string>(initialDraft.text);

  useEffect(() => {
    const syncAuth = () => {
      const nextAdmin = checkIsAdmin();
      setIsAdmin(nextAdmin);
      if (!nextAdmin) {
        setActiveViewTab((prev) => (prev === 'admin_triage' ? 'lapor' : prev));
      }
    };
    const syncLogs = () => {
      const next = SmartCareService.getLogs();
      setLogs(next);
      if (next.length > 0 && !next.some((l) => l.id === selectedLogId)) {
        setSelectedLogId(next[0].id);
      }
    };
    window.addEventListener(AUTH_SYNC_EVENT, syncAuth);
    window.addEventListener(ZERO_TRUST_SYNC_EVENT, syncAuth);
    window.addEventListener(SMART_CARE_SYNC_EVENT, syncLogs);
    window.addEventListener('focus', syncLogs);
    window.addEventListener('focus', syncAuth);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, syncAuth);
      window.removeEventListener(ZERO_TRUST_SYNC_EVENT, syncAuth);
      window.removeEventListener(SMART_CARE_SYNC_EVENT, syncLogs);
      window.removeEventListener('focus', syncLogs);
      window.removeEventListener('focus', syncAuth);
    };
  }, [selectedLogId]);

  const selectedTicket =
    logs.find((l) => l.id === selectedLogId) || logs[0] || null;

  useEffect(() => {
    if (selectedTicket) {
      setSelectedComplaintEdit(selectedTicket.complaint);
      setCustomPrompt(selectedTicket.autoPrompt);
    }
  }, [selectedTicket?.id, selectedTicket?.complaint, selectedTicket?.autoPrompt]);

  // Speech Recognition Setup (editable cumulative transcript)
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
            'Koneksi mikrofon berhenti. Hasil rekaman tetap bisa Anda edit manual di kotak di bawah.'
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

  // Keep buffer synced when user manually edits voiceText
  const handleVoiceTextChange = (nextVal: string) => {
    setVoiceText(nextVal);
    finalVoiceBufferRef.current = nextVal;
  };

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

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      showNotification('Browser tidak mendukung rekam suara. Silakan ketik langsung di kotak keluhan.');
      return;
    }

    if (!isRecording) {
      try {
        finalVoiceBufferRef.current = voiceText;
        recognitionRef.current.start();
        setIsRecording(true);
        setVoiceStatus('Mendengarkan keluhan... Setelah stop, teks tetap bisa diedit sebelum simpan/kirim.');
      } catch {
        showNotification('Gagal memulai mikrofon. Periksa izin mic atau ketik manual.');
      }
    } else {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
      setInterimVoiceText('');
      setVoiceStatus('Rekaman selesai! Silakan edit teks jika perlu lalu klik Simpan / Kirim.');
    }
  };

  const clearVoiceText = () => {
    setVoiceText('');
    setInterimVoiceText('');
    finalVoiceBufferRef.current = '';
    setEditingEntryId(null);
    setLastSentTicketInfo(null);
    if (!isAdmin) {
      saveUserDraft(null);
    }
    setVoiceStatus('Kotak keluhan direset. Silakan rekam ulang atau ketik kendala Anda.');
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

    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
      setInterimVoiceText('');
    }

    const saved = SmartCareService.submitUserReport({
      complaint: combinedText,
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
          `Laporan ${saved.id} berhasil dikirim ke Admin. Anda dapat merekam keluhan baru bila diperlukan.`
        );
        showNotification(`Keluhan ${saved.id} berhasil dikirim ke Admin!`);
      } else {
        saveUserDraft({ text: combinedText, entryId: saved.id });
        setVoiceText(combinedText);
        finalVoiceBufferRef.current = combinedText;
        setEditingEntryId(saved.id);
        setLastSentTicketInfo(null);
        setVoiceStatus(
          `Draft keluhan tersimpan (${saved.id}). Edit kapan saja lalu klik Kirim ke Admin.`
        );
        showNotification(`Draft keluhan disimpan (${saved.id}). Klik Kirim saat sudah siap.`);
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
        ? `Laporan ${saved.id} terkirim ke Developer/Admin & Auto-Prompt siap!`
        : `Draft laporan ${saved.id} disimpan (${similarity.label}).`
    );

    showNotification(
      sendToAdmin
        ? `Terkirim ke Log Admin (${saved.id}) & Auto-Prompt dibuat!`
        : `Keluhan ${saved.id} disimpan & Auto-Prompt siap!`
    );
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

  const handleSendWhatsApp = (ticket: SmartCareLogEntry) => {
    let msg = `*LAPORAN BANTUAN TEKNIS - USAHAQU / WARGAQU*\n`;
    msg += `No. Tiket: ${ticket.id}\n`;
    msg += `Pelapor: ${ticket.reporterName}\n`;
    msg += `Perangkat: ${ticket.device}\n`;
    msg += `Tingkat: ${ticket.severity}\n`;
    msg += `Kendala: "${ticket.complaint}"\n`;
    msg += `Modul Terdeteksi: ${ticket.module}\n`;
    msg += `------------------------------------\n`;
    msg += `Mohon bantuan tim CS / Developer. Terima kasih!`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const filteredLogs = logs.filter((t) => {
    if (t.triageStatus === 'merged') return false;
    if (activeFilter === 'open') return t.triageStatus !== 'resolved' && t.triageStatus !== 'skipped';
    if (activeFilter === 'resolved') return t.triageStatus === 'resolved';
    return true;
  });

  const newIncomingCount = logs.filter((l) => l.triageStatus === 'new').length;
  const liveSimilarityPreview =
    voiceText.trim().length >= 8
      ? SmartCareService.analyzeSimilarity(voiceText.trim(), editingEntryId || undefined)
      : null;

  return (
    <div className="w-full h-full bg-slate-900 text-slate-100 flex flex-col justify-between overflow-hidden relative select-none font-sans">
      {/* HEADER */}
      <header className="bg-slate-800 border-b border-slate-700 px-3.5 py-2.5 sticky top-0 z-30 shrink-0 shadow-md space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBackToWarga}
              className="w-8 h-8 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center active:scale-95 transition"
              title="Kembali ke Beranda WargaQu"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
            </button>
            <div className="bg-emerald-500 text-slate-950 p-2 rounded-xl font-bold flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Headphones className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm leading-tight text-white">
                UsahaQu Smart Care
              </h1>
              <p className="text-[10px] text-slate-400">
                {isAdmin
                  ? 'Rekam/Edit Keluhan & Auto-Fix Prompt Developer'
                  : 'Rekam, Simpan & Kirim Keluhan serta Panduan Modul'}
              </p>
            </div>
          </div>

          <span className="bg-emerald-900/60 text-emerald-400 text-[10px] px-2.5 py-1 rounded-full font-mono border border-emerald-500/30 flex items-center gap-1 shrink-0">
            <Bot className="w-3.5 h-3.5" />
            <span className="font-bold">AI Active</span>
          </span>
        </div>

        {/* Mode Tabs: User hanya Entry/Rekam-Simpan-Kirim & Panduan Modul; Log & Prompt khusus Admin */}
        <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setActiveViewTab('lapor')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1 whitespace-nowrap ${
              activeViewTab === 'lapor'
                ? 'bg-emerald-600 text-slate-950 font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span>{isAdmin ? 'Entry Keluhan' : 'Rekam & Kirim'}</span>
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
            <span>Panduan Modul</span>
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
                Log &amp; Triage
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
          <SmartCareModuleGuidesPanel showNotification={showNotification} />
        ) : (
          <>
            {/* VOICE + EDITABLE ENTRY CARD */}
            <section className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-lg space-y-3">
              <div className="flex justify-between items-center gap-2">
                <h2 className="font-bold text-slate-200 text-xs flex items-center gap-2 uppercase tracking-wider">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span>
                    {isAdmin && editingEntryId
                      ? `Edit Keluhan (${editingEntryId})`
                      : 'Rekam / Ketik Keluhan Teknis'}
                  </span>
                </h2>
                {isAdmin && liveSimilarityPreview && liveSimilarityPreview.matchedEntry && (
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
              </div>

              <div className="flex items-start gap-3 bg-slate-900 p-3 rounded-xl border border-slate-700/80">
                <button
                  id="btnVoice"
                  type="button"
                  onClick={toggleVoice}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition shrink-0 active:scale-95 shadow-md mt-1 ${
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
                    rows={3}
                    value={voiceText}
                    onChange={(e) => handleVoiceTextChange(e.target.value)}
                    placeholder={
                      isRecording
                        ? 'Sedang mendengarkan... Anda juga bisa langsung edit teks di sini.'
                        : 'Ketik atau rekam suara keluhan teknis (hasil rekaman bisa langsung diedit di sini)...'
                    }
                    className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl p-2.5 text-xs font-medium text-emerald-300 placeholder:text-slate-500 focus:outline-none leading-relaxed"
                  />
                  {interimVoiceText && (
                    <div className="text-[11px] text-amber-300/90 italic">
                      Mendengar: "{interimVoiceText}..."
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                {[
                  {
                    label: '+ Crash Nota 58mm',
                    text: 'Tombol bayar crash pas cetak nota 58mm',
                  },
                  {
                    label: '+ Tampilan HP Lebar/Kecil',
                    text: 'Tampilan layar di HP lain tidak penuh atau terlalu kecil',
                  },
                  {
                    label: '+ Link Undangan Trah',
                    text: 'Link undangan trah LeluhurQu perlu diringkas dan auto masuk',
                  },
                  {
                    label: '+ Iuran RT QRIS',
                    text: 'Total iuran warga RT tidak terupdate setelah scan QRIS',
                  },
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleVoiceTextChange(chip.text);
                      setVoiceStatus('Sampel keluhan dimuat. Silakan edit bila perlu lalu Simpan / Kirim.');
                    }}
                    className="text-[10px] bg-slate-900 hover:bg-slate-750 text-emerald-400/90 border border-emerald-500/20 px-2.5 py-1 rounded-lg whitespace-nowrap active:scale-95"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons: Simpan Draft / Simpan & Kirim ke Admin / Reset */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSaveOrSendReport(false)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Simpan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOrSendReport(true)}
                  className="grow bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-emerald-600/20 transition"
                >
                  {isAdmin ? <Zap className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span>
                    {isAdmin ? 'Simpan, Analisa AI & Kirim ke Admin' : 'Kirim ke Admin'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={clearVoiceText}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 px-3 rounded-xl text-xs active:scale-95 transition"
                  title="Reset Kotak Keluhan"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {!isAdmin && lastSentTicketInfo && (
                <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Laporan <strong>{lastSentTicketInfo.id}</strong> terkirim ke Admin ({lastSentTicketInfo.sentAt}).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveViewTab('panduan')}
                    className="text-[11px] font-bold text-sky-300 hover:underline shrink-0"
                  >
                    Buka Panduan
                  </button>
                </div>
              )}
            </section>

            {/* TICKET LIST & EDITABLE AUTO-FIX OUTPUT (HANYA AKUN ADMIN) */}
            {isAdmin && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {/* LEFT: DAFTAR TIKET KELUHAN */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <ListCheck className="w-4 h-4 text-sky-400" />
                    <span>Riwayat Keluhan Smart Care</span>
                  </h2>
                  <span className="bg-slate-700 text-[10px] text-slate-300 px-2 py-0.5 rounded-full font-mono font-bold">
                    {filteredLogs.length} Laporan
                  </span>
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
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                                  {sim.label} {sim.matchedEntry.id}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {ticket.sentToAdminAt && (
                                <span className="bg-sky-950 text-sky-300 border border-sky-500/30 text-[9px] px-1.5 py-0.2 rounded font-bold">
                                  Terkirim
                                </span>
                              )}
                              {ticket.triageStatus === 'resolved' && (
                                <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.2 rounded font-bold">
                                  Selesai
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500">
                                {ticket.updatedAt}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-200 font-medium line-clamp-2 leading-relaxed">
                            "{ticket.complaint}"
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-slate-400" />
                              <span>{ticket.device}</span>
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
                              <span>Muat ke Kotak Edit</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: EDITABLE DETAIL & AUTO-FIX OUTPUT PANEL */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-col justify-between shadow-md space-y-3">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <h2 className="font-bold text-slate-200 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Hasil Keluhan &amp; Auto-Fix Prompt</span>
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
                          Modul Terdeteksi:{' '}
                          <span className="text-sky-300 font-bold">{selectedTicket.module}</span>
                        </div>
                        <div>
                          Diagnosa:{' '}
                          <span className="text-rose-400 font-bold">
                            {selectedTicket.detectedError}
                          </span>
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
                            Prompt Perbaikan AI (Bisa Diedit):
                          </label>
                          <span className="text-[9px] text-slate-500 font-mono">Editable</span>
                        </div>
                        <textarea
                          rows={6}
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
                        <span>Kirim ke Log Admin</span>
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

                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(selectedTicket)}
                      className="w-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3 h-3 text-emerald-400" />
                      <span>Kirim Laporan via WhatsApp ke Tim Developer</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};
