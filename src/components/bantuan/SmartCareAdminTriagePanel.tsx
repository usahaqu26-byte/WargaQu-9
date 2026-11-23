import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Edit3,
  GitMerge,
  Loader2,
  MessageSquareReply,
  Plus,
  RefreshCw,
  Scissors,
  Send,
  SkipForward,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {
  SMART_CARE_SYNC_EVENT,
  SmartCareLogEntry,
  SmartCareService,
} from '../../services/smartCareService';

interface SmartCareAdminTriagePanelProps {
  showNotification: (msg: string) => void;
  lightTheme?: boolean;
}

type TriageFilter = 'new' | 'queued' | 'all' | 'done';

export const SmartCareAdminTriagePanel: React.FC<SmartCareAdminTriagePanelProps> = ({
  showNotification,
  lightTheme = false,
}) => {
  const [logs, setLogs] = useState<SmartCareLogEntry[]>(() => SmartCareService.getLogs());
  const [filter, setFilter] = useState<TriageFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComplaint, setEditComplaint] = useState<string>('');
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [masterPromptOverride, setMasterPromptOverride] = useState<string | null>(null);
  const [copiedMode, setCopiedMode] = useState<'copy' | 'cut' | null>(null);
  const [showPasteBox, setShowPasteBox] = useState<boolean>(false);
  const [pasteInput, setPasteInput] = useState<string>('');
  const [mergePickerSourceId, setMergePickerSourceId] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraftText, setReplyDraftText] = useState<string>('');
  const [isDraftingReplyAi, setIsDraftingReplyAi] = useState<boolean>(false);
  const [isSyncingRelay, setIsSyncingRelay] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => setLogs(SmartCareService.getLogs());
    window.addEventListener(SMART_CARE_SYNC_EVENT, sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(SMART_CARE_SYNC_EVENT, sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const queuedEntries = useMemo(
    () => logs.filter((l) => l.triageStatus === 'queued'),
    [logs]
  );
  const newEntries = useMemo(
    () => logs.filter((l) => l.triageStatus === 'new'),
    [logs]
  );

  const generatedMasterPrompt = useMemo(
    () => SmartCareService.buildCombinedMasterPrompt(queuedEntries),
    [queuedEntries]
  );

  useEffect(() => {
    setMasterPromptOverride(null);
  }, [generatedMasterPrompt]);

  const masterPromptValue =
    masterPromptOverride !== null ? masterPromptOverride : generatedMasterPrompt;

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (filter === 'new') return l.triageStatus === 'new';
      if (filter === 'queued') return l.triageStatus === 'queued';
      if (filter === 'done') {
        return (
          l.triageStatus === 'resolved' ||
          l.triageStatus === 'skipped' ||
          l.triageStatus === 'merged'
        );
      }
      return l.triageStatus !== 'merged';
    });
  }, [logs, filter]);

  const activeMergeTargets = useMemo(
    () => logs.filter((l) => l.triageStatus === 'queued' || l.triageStatus === 'new'),
    [logs]
  );

  const handleCopyMaster = async (mode: 'copy' | 'cut') => {
    if (!masterPromptValue.trim()) {
      showNotification('Belum ada prompt di antrean. Klik "+ Tambahkan" pada log keluhan.');
      return;
    }
    try {
      await navigator.clipboard.writeText(masterPromptValue);
    } catch {
      // ignore clipboard fallback
    }
    if (mode === 'cut') {
      const cutCount = SmartCareService.cutQueuedToResolved();
      setMasterPromptOverride(null);
      setCopiedMode('cut');
      showNotification(
        `Master Prompt di-CUT ke clipboard & ${cutCount} tiket ditandai Selesai!`
      );
    } else {
      setCopiedMode('copy');
      showNotification('Master Prompt disalin ke clipboard (siap paste ke AI/Editor).');
    }
    setTimeout(() => setCopiedMode(null), 2200);
  };

  const handleImportExternalLog = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = pasteInput.trim();
    if (!raw) return;
    // Extract "Kendala:" if pasted from WhatsApp report, otherwise use raw text
    const match = raw.match(/Kendala:\s*"?([^\n"]+)"?/i);
    const complaintText = match ? match[1].trim() : raw;
    const entry = SmartCareService.submitUserReport({
      complaint: complaintText,
      sendToAdmin: false,
    });
    const sim = SmartCareService.analyzeSimilarity(entry);
    setPasteInput('');
    setShowPasteBox(false);
    setFilter('new');
    showNotification(
      sim.matchedEntry
        ? `Log ${entry.id} masuk (${sim.label} dgn ${sim.matchedEntry.id}).`
        : `Log baru ${entry.id} ditambahkan & siap ditinjau.`
    );
  };

  const cardBg = lightTheme
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-slate-800 border-slate-700 text-slate-100';
  const subCardBg = lightTheme
    ? 'bg-slate-50 border-slate-200 text-slate-800'
    : 'bg-slate-900 border-slate-700/80 text-slate-100';
  const mutedText = lightTheme ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className="space-y-3 text-xs">
      {/* Top Batch Action & Import Strip */}
      <div className={`rounded-2xl border p-3 space-y-2.5 ${cardBg}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Log &amp; Triage Smart Care Developer</span>
            </h3>
            <p className={`text-[10px] mt-0.5 ${mutedText}`}>
              Deteksi otomatis keluhan Baru / Mirip / Sama Persis untuk digabung, ditambahkan, atau dilewatkan sebelum Copy/Cut.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isSyncingRelay}
              onClick={async () => {
                setIsSyncingRelay(true);
                const res = await SmartCareService.syncTicketsFromRelay(true);
                setIsSyncingRelay(false);
                showNotification(
                  res.pulled > 0
                    ? `${res.pulled} tiket baru ditarik dari relay.`
                    : 'Daftar tiket sudah mutakhir.'
                );
              }}
              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                lightTheme
                  ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                  : 'border-slate-600 bg-slate-900 hover:bg-slate-700 text-slate-200'
              }`}
              title="Tarik laporan warga terbaru dari relay"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingRelay ? 'animate-spin' : ''}`} />
              <span>Tarik</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPasteBox((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                lightTheme
                  ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                  : 'border-slate-600 bg-slate-900 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Tempel WA</span>
            </button>
          </div>
        </div>

        {showPasteBox && (
          <form onSubmit={handleImportExternalLog} className="space-y-2 pt-1">
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              rows={3}
              placeholder="Tempel laporan WA / keluhan teknis dari HP user lain..."
              className={`w-full rounded-xl border p-2.5 text-xs focus:outline-none ${
                lightTheme
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-slate-950 border-slate-700 text-slate-100'
              }`}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteBox(false)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold"
              >
                Analisa &amp; Masukkan Log
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              const merged = SmartCareService.autoMergeSimilarNewEntries();
              showNotification(
                merged > 0
                  ? `${merged} laporan mirip/sama otomatis digabung ke induknya!`
                  : 'Tidak ada laporan baru yang mirip/sama untuk digabung.'
              );
            }}
            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-500 hover:bg-amber-500/25 font-bold text-[11px] flex items-center justify-center gap-1.5"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>Gabung Otomatis Mirip</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const added = SmartCareService.queueAllNewEntries();
              showNotification(
                added > 0
                  ? `${added} laporan baru ditambahkan ke Antrean Prompt!`
                  : 'Semua laporan baru sudah diproses.'
              );
            }}
            className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambahkan Semua Baru ({newEntries.length})</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div
          className={`flex gap-1 p-1 rounded-xl text-[10px] font-bold ${
            lightTheme ? 'bg-slate-100' : 'bg-slate-900'
          }`}
        >
          {[
            { id: 'all' as const, label: `Aktif (${logs.filter((l) => l.triageStatus !== 'merged').length})` },
            { id: 'new' as const, label: `Baru (${newEntries.length})` },
            { id: 'queued' as const, label: `Antrean (${queuedEntries.length})` },
            { id: 'done' as const, label: 'Selesai / Lewat' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex-1 py-1.5 rounded-lg transition ${
                filter === tab.id
                  ? lightTheme
                    ? 'bg-slate-900 text-white'
                    : 'bg-emerald-600 text-slate-950 font-extrabold'
                  : mutedText
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log Entries List */}
      <div className="space-y-2.5 max-h-[360px] overflow-y-auto no-scrollbar pr-0.5">
        {filteredLogs.length === 0 ? (
          <div className={`rounded-2xl border p-5 text-center italic ${subCardBg} ${mutedText}`}>
            Belum ada log Smart Care pada kategori ini.
          </div>
        ) : (
          filteredLogs.map((item) => {
            const sim = SmartCareService.analyzeSimilarity(item);
            const isEditing = editingId === item.id;
            const isMergePicking = mergePickerSourceId === item.id;

            return (
              <div key={item.id} className={`rounded-2xl border p-3 space-y-2 ${subCardBg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono font-extrabold text-emerald-500">{item.id}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                        sim.level === 'sama'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
                          : sim.level === 'mirip'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                          : 'bg-sky-500/15 text-sky-400 border-sky-500/40'
                      }`}
                    >
                      {sim.matchedEntry
                        ? `${sim.label} ${Math.round(sim.score * 100)}% dgn ${sim.matchedEntry.id}`
                        : 'Baru'}
                    </span>
                    {item.occurrenceCount > 1 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
                        <Users className="w-2.5 h-2.5" />
                        <span>{item.occurrenceCount}x laporan</span>
                      </span>
                    )}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        item.triageStatus === 'queued'
                          ? 'bg-emerald-600 text-white'
                          : item.triageStatus === 'resolved'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : item.triageStatus === 'skipped'
                          ? 'bg-slate-600/30 text-slate-400'
                          : item.triageStatus === 'merged'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-indigo-500/20 text-indigo-300'
                      }`}
                    >
                      {item.triageStatus === 'queued'
                        ? 'Di Antrean'
                        : item.triageStatus === 'skipped'
                        ? 'Dilewatkan'
                        : item.triageStatus === 'merged'
                        ? `Digabung -> ${item.mergedIntoId}`
                        : item.triageStatus === 'resolved'
                        ? 'Selesai'
                        : 'Baru Masuk'}
                    </span>
                  </div>
                  <span className={`text-[10px] shrink-0 ${mutedText}`}>{item.updatedAt}</span>
                </div>

                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className={`text-[10px] font-bold block mb-1 ${mutedText}`}>
                        Edit Keluhan User:
                      </label>
                      <textarea
                        rows={2}
                        value={editComplaint}
                        onChange={(e) => setEditComplaint(e.target.value)}
                        className={`w-full rounded-lg border p-2 text-xs ${
                          lightTheme
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-slate-950 border-slate-700 text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-[10px] font-bold block mb-1 ${mutedText}`}>
                        Edit Auto-Prompt:
                      </label>
                      <textarea
                        rows={4}
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className={`w-full rounded-lg border p-2 text-[11px] font-mono ${
                          lightTheme
                            ? 'bg-white border-slate-300 text-slate-900'
                            : 'bg-slate-950 border-slate-700 text-emerald-300'
                        }`}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-400"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          SmartCareService.updateEntryPromptAndComplaint(item.id, {
                            complaint: editComplaint.trim() || item.complaint,
                            autoPrompt: editPrompt.trim() || item.autoPrompt,
                          });
                          setEditingId(null);
                          showNotification(`Log ${item.id} berhasil diperbarui.`);
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold"
                      >
                        Simpan Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold leading-snug">"{item.complaint}"</p>
                    <div className={`text-[10px] flex flex-wrap gap-x-3 gap-y-0.5 ${mutedText}`}>
                      <span>Pelapor: {item.reporterName}</span>
                      <span>Modul: {item.module}</span>
                    </div>
                    {item.reporters.length > 1 && (
                      <div
                        className={`rounded-lg p-2 border text-[10px] space-y-0.5 ${
                          lightTheme
                            ? 'bg-white border-slate-200 text-slate-600'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="font-bold text-amber-500">
                          Gabungan {item.reporters.length} Laporan User:
                        </div>
                        {item.reporters.map((rep, rIdx) => (
                          <div key={rIdx} className="truncate">
                            • {rep.name} ({rep.time}): "{rep.complaint}"
                          </div>
                        ))}
                      </div>
                    )}
                    {item.adminReply && (
                      <div
                        className={`rounded-xl p-2 border text-[11px] space-y-0.5 ${
                          lightTheme
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-emerald-950/50 border-emerald-500/30 text-emerald-200'
                        }`}
                      >
                        <div className="text-[10px] font-bold text-emerald-400">
                          Balasan Terkirim ({item.adminReplyAt || item.updatedAt}):
                        </div>
                        <p className="leading-snug">{item.adminReply}</p>
                      </div>
                    )}
                  </>
                )}

                {/* Triage Actions */}
                {!isEditing && item.triageStatus !== 'merged' && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {sim.matchedEntry && item.triageStatus !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => {
                          SmartCareService.mergeEntries(item.id, sim.matchedEntry!.id);
                          showNotification(
                            `${item.id} digabung ke ${sim.matchedEntry!.id}!`
                          );
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-[10px] flex items-center gap-1"
                      >
                        <GitMerge className="w-3 h-3" />
                        <span>Gabung ke {sim.matchedEntry.id}</span>
                      </button>
                    )}

                    {item.triageStatus !== 'queued' ? (
                      <button
                        type="button"
                        onClick={() => {
                          SmartCareService.setTriageStatus(item.id, 'queued');
                          showNotification(`${item.id} ditambahkan ke Antrean Prompt.`);
                        }}
                        className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tambahkan</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          SmartCareService.setTriageStatus(item.id, 'new');
                          showNotification(`${item.id} dikeluarkan dari antrean.`);
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-500/40 text-[10px] font-bold"
                      >
                        Keluarkan dari Antrean
                      </button>
                    )}

                    {activeMergeTargets.filter((t) => t.id !== item.id).length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMergePickerSourceId(isMergePicking ? null : item.id)
                        }
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                          lightTheme
                            ? 'border-slate-300 text-slate-700'
                            : 'border-slate-600 text-slate-300'
                        }`}
                      >
                        <GitMerge className="w-3 h-3" />
                        <span>Gabung Manual</span>
                      </button>
                    )}

                    {item.triageStatus !== 'skipped' && item.triageStatus !== 'resolved' && (
                      <button
                        type="button"
                        onClick={() => {
                          SmartCareService.setTriageStatus(item.id, 'skipped');
                          showNotification(`${item.id} dilewatkan.`);
                        }}
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                          lightTheme
                            ? 'border-slate-300 text-slate-500'
                            : 'border-slate-600 text-slate-400'
                        }`}
                      >
                        <SkipForward className="w-3 h-3" />
                        <span>Lewatkan</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditComplaint(item.complaint);
                        setEditPrompt(item.autoPrompt);
                      }}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
                        lightTheme
                          ? 'border-slate-300 text-slate-700'
                          : 'border-slate-600 text-slate-300'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (replyingId === item.id) {
                          setReplyingId(null);
                        } else {
                          setReplyingId(item.id);
                          setReplyDraftText(item.adminReply || '');
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-400 font-bold text-[10px] flex items-center gap-1"
                    >
                      <MessageSquareReply className="w-3 h-3" />
                      <span>{item.adminReply ? 'Ubah Balasan' : 'Balas User'}</span>
                    </button>
                  </div>
                )}

                {replyingId === item.id && (
                  <div className="pt-2 border-t border-slate-700/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-sky-400">
                        Balas ke {item.reporterName}:
                      </span>
                      <button
                        type="button"
                        disabled={isDraftingReplyAi}
                        onClick={async () => {
                          setIsDraftingReplyAi(true);
                          try {
                            const draft = await SmartCareService.draftAdminReplyWithAi(item);
                            setReplyDraftText(draft.reply);
                            showNotification('Draf balasan AI siap ditinjau sebelum dikirim.');
                          } catch (err) {
                            showNotification(
                              err instanceof Error ? err.message : 'Gagal membuat draf AI.'
                            );
                          } finally {
                            setIsDraftingReplyAi(false);
                          }
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                      >
                        {isDraftingReplyAi ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>Draf AI</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={replyDraftText}
                      onChange={(e) => setReplyDraftText(e.target.value)}
                      placeholder="Tulis balasan solusi yang dikirim ke tab Tiket Saya milik pelapor..."
                      className={`w-full rounded-xl border p-2 text-xs focus:outline-none ${
                        lightTheme
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-slate-950 border-slate-700 text-slate-100'
                      }`}
                    />
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setReplyingId(null)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!replyDraftText.trim()) return;
                          SmartCareService.replyToTicket({
                            entryId: item.id,
                            replyText: replyDraftText,
                            markResolved: false,
                          });
                          setReplyingId(null);
                          showNotification(`Balasan terkirim ke pelapor tiket ${item.id}.`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-bold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Kirim Balasan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!replyDraftText.trim()) return;
                          SmartCareService.replyToTicket({
                            entryId: item.id,
                            replyText: replyDraftText,
                            markResolved: true,
                          });
                          setReplyingId(null);
                          showNotification(`Balasan terkirim & tiket ${item.id} ditandai Selesai.`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Kirim &amp; Selesai</span>
                      </button>
                    </div>
                  </div>
                )}

                {isMergePicking && (
                  <div className="pt-1.5 border-t border-slate-700/40 space-y-1">
                    <div className="text-[10px] font-bold text-amber-500">
                      Pilih tiket tujuan penggabungan:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {activeMergeTargets
                        .filter((t) => t.id !== item.id)
                        .map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => {
                              SmartCareService.mergeEntries(item.id, target.id);
                              setMergePickerSourceId(null);
                              showNotification(`${item.id} digabung ke ${target.id}.`);
                            }}
                            className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-bold"
                          >
                            {target.id}: {target.complaint.slice(0, 28)}...
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Master Combined Prompt Queue for Developer Copy / Cut */}
      <div className={`rounded-2xl border p-3.5 space-y-2.5 ${cardBg}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Antrean Master Prompt ({queuedEntries.length} Isu)</span>
            </h3>
            <p className={`text-[10px] ${mutedText}`}>
              Bisa langsung diedit, lalu Salin atau Cut (salin + tandai selesai otomatis).
            </p>
          </div>
          {queuedEntries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                queuedEntries.forEach((q) =>
                  SmartCareService.setTriageStatus(q.id, 'new')
                );
                showNotification('Antrean prompt dikosongkan ke status Baru.');
              }}
              className="text-[10px] font-bold text-rose-400 flex items-center gap-0.5"
            >
              <Trash2 className="w-3 h-3" />
              <span>Kosongkan</span>
            </button>
          )}
        </div>

        <textarea
          rows={6}
          value={masterPromptValue}
          onChange={(e) => setMasterPromptOverride(e.target.value)}
          placeholder="Klik '+ Tambahkan' atau 'Gabung' pada log keluhan user di atas untuk menyusun Master Auto-Prompt perbaikan..."
          className={`w-full rounded-xl border p-2.5 text-[11px] font-mono leading-relaxed focus:outline-none ${
            lightTheme
              ? 'bg-slate-50 border-slate-300 text-slate-900'
              : 'bg-slate-950 border-slate-700 text-emerald-300'
          }`}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!masterPromptValue.trim()}
            onClick={() => void handleCopyMaster('copy')}
            className="min-h-[40px] rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5"
          >
            {copiedMode === 'copy' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span>{copiedMode === 'copy' ? 'Tersalin!' : 'Salin Prompt'}</span>
          </button>
          <button
            type="button"
            disabled={!masterPromptValue.trim()}
            onClick={() => void handleCopyMaster('cut')}
            className="min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
          >
            <Scissors className="w-4 h-4" />
            <span>
              {copiedMode === 'cut' ? 'Di-Cut!' : 'Cut & Tandai Selesai'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
