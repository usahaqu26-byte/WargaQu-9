import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DompetParsedDraftItem,
  DompetQuStorage,
  DompetWallet,
} from '../../services/dompetQuStorage';

interface DompetSmartVoiceModalProps {
  open: boolean;
  onClose: () => void;
  showNotification: (msg: string) => void;
  onSaved?: (savedCount: number) => void;
  startEmptyManual?: boolean;
}

function formatReadableDateId(ymd: string): string {
  if (!ymd) return '-';
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const DompetSmartVoiceModal: React.FC<DompetSmartVoiceModalProps> = ({
  open,
  onClose,
  showNotification,
  onSaved,
  startEmptyManual = false,
}) => {
  const [wallets, setWallets] = useState<DompetWallet[]>(() => DompetQuStorage.getWallets());
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isRefiningAi, setIsRefiningAi] = useState<boolean>(false);
  const [draftItems, setDraftItems] = useState<DompetParsedDraftItem[]>([]);
  const [txDate, setTxDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [defaultWalletId, setDefaultWalletId] = useState<string>(
    () => DompetQuStorage.getWallets()[0]?.id || 'wallet-cash'
  );
  const [aiLockedEdit, setAiLockedEdit] = useState<boolean>(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const baseTextBeforeMicRef = useRef<string>('');

  const stopMic = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (!open) {
      stopMic();
      return;
    }
    const freshWallets = DompetQuStorage.getWallets();
    setWallets(freshWallets);
    const firstWalletId = freshWallets[0]?.id || 'wallet-cash';
    setDefaultWalletId(firstWalletId);
    setTxDate(new Date().toISOString().slice(0, 10));
    setTranscript('');
    setAiLockedEdit(false);

    if (startEmptyManual) {
      setDraftItems([
        {
          localId: `manual-${Date.now()}`,
          type: 'keluar',
          category: 'Pengeluaran Lainnya',
          title: '',
          amount: 0,
          walletId: firstWalletId,
          note: '',
        },
      ]);
    } else {
      setDraftItems([]);
    }
    return () => stopMic();
  }, [open, startEmptyManual]);

  // Auto-live modular receipt parsing whenever voice/text changes
  useEffect(() => {
    if (!open || startEmptyManual || aiLockedEdit) return;
    const clean = transcript.trim();
    if (!clean) {
      setDraftItems([]);
      return;
    }
    const parsed = DompetQuStorage.parseSpeechLocalFallback(clean, wallets).map(item => ({
      ...item,
      walletId:
        /\b(atm|bank|rekening|bca|bri|bni|mandiri|bsi|gopay|ovo|dana|shopeepay|qris|cash|tunai)\b/i.test(
          item.note
        )
          ? item.walletId
          : defaultWalletId,
    }));
    setDraftItems(parsed);
  }, [transcript, open, startEmptyManual, aiLockedEdit, wallets, defaultWalletId]);

  const incomeItems = useMemo(() => draftItems.filter(i => i.type === 'masuk'), [draftItems]);
  const expenseItems = useMemo(() => draftItems.filter(i => i.type === 'keluar'), [draftItems]);

  const totalMasuk = useMemo(
    () => incomeItems.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [incomeItems]
  );
  const totalKeluar = useMemo(
    () => expenseItems.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [expenseItems]
  );
  const netSisa = totalMasuk - totalKeluar;

  if (!open) return null;

  const toggleVoiceRecording = () => {
    if (isListening) {
      stopMic();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      showNotification('Browser belum mendukung mikrofon. Ketik langsung di kolom cepat.');
      return;
    }

    try {
      setAiLockedEdit(false);
      const rec = new SpeechRec();
      rec.lang = 'id-ID';
      rec.continuous = true;
      rec.interimResults = true;
      baseTextBeforeMicRef.current = transcript.trim();

      rec.onstart = () => setIsListening(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i += 1) {
          combined += event.results[i][0].transcript + ' ';
        }
        const prefix = baseTextBeforeMicRef.current;
        setTranscript(prefix ? `${prefix} ${combined.trim()}` : combined.trim());
      };

      rec.onerror = () => {
        setIsListening(false);
        showNotification('Rekam suara berhenti. Anda bisa edit teks atau langsung ubah struk.');
      };

      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
      showNotification('Gagal membuka mikrofon. Ketik langsung di kolom cepat.');
    }
  };

  const handleRefineWithAi = async () => {
    stopMic();
    const clean = transcript.trim();
    if (!clean) {
      showNotification('Sebutkan atau ketik catatan dulu.');
      return;
    }
    setIsRefiningAi(true);
    try {
      const res = await DompetQuStorage.parseSpeechSmart(clean, wallets);
      if (res.items.length > 0) {
        setAiLockedEdit(true);
        setDraftItems(res.items);
        showNotification(
          res.usedAi
            ? 'Struk dirapikan otomatis oleh AI. Silakan cek & simpan.'
            : 'Struk diperbarui otomatis.'
        );
      }
    } finally {
      setIsRefiningAi(false);
    }
  };

  const handleUpdateRow = (localId: string, patch: Partial<DompetParsedDraftItem>) => {
    setAiLockedEdit(true);
    setDraftItems(prev =>
      prev.map(row => {
        if (row.localId !== localId) return row;
        const next = { ...row, ...patch };
        if (patch.type && patch.type !== row.type) {
          next.category = patch.type === 'masuk' ? 'Pemasukan Lainnya' : 'Pengeluaran Lainnya';
        }
        return next;
      })
    );
  };

  const handleCycleWallet = (localId: string, currentWalletId: string) => {
    if (wallets.length <= 1) return;
    const idx = wallets.findIndex(w => w.id === currentWalletId);
    const nextW = wallets[(idx + 1) % wallets.length];
    if (nextW) handleUpdateRow(localId, { walletId: nextW.id });
  };

  const handleRemoveRow = (localId: string) => {
    setAiLockedEdit(true);
    setDraftItems(prev => prev.filter(r => r.localId !== localId));
  };

  const handleAddRow = (type: 'masuk' | 'keluar') => {
    setAiLockedEdit(true);
    setDraftItems(prev => [
      ...prev,
      {
        localId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type,
        category: type === 'masuk' ? 'Pemasukan Lainnya' : 'Pengeluaran Lainnya',
        title: '',
        amount: 0,
        walletId: defaultWalletId,
        note: '',
      },
    ]);
  };

  const handleSaveReceipt = () => {
    stopMic();
    const valid = draftItems.filter(r => (r.title.trim() || r.amount > 0) && r.amount > 0);
    if (valid.length === 0) {
      showNotification('Belum ada item dengan nominal lebih dari 0.');
      return;
    }
    const count = DompetQuStorage.addTransactionsBatch(
      valid.map(v => ({
        type: v.type,
        category: v.category,
        title: v.title.trim() || (v.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran'),
        amount: v.amount,
        walletId: v.walletId,
        note: v.note,
        date: txDate,
        source: startEmptyManual ? 'manual' : 'voice',
      }))
    );
    showNotification(`${count} item tersimpan ke DompetQu (${formatReadableDateId(txDate)})`);
    if (onSaved) onSaved(count);
    onClose();
  };

  const renderReceiptRow = (row: DompetParsedDraftItem) => {
    const walletName = wallets.find(w => w.id === row.walletId)?.name || 'Cash';
    const shortWallet = walletName.includes('Cash')
      ? 'Cash'
      : walletName.includes('ATM') || walletName.includes('Bank')
      ? 'ATM'
      : walletName.split(' ')[0];

    return (
      <div
        key={row.localId}
        className="py-2 flex items-center gap-2 border-b border-slate-100 last:border-b-0"
      >
        {/* Tap + / - to switch Pemasukan <-> Pengeluaran */}
        <button
          type="button"
          onClick={() =>
            handleUpdateRow(row.localId, { type: row.type === 'masuk' ? 'keluar' : 'masuk' })
          }
          title="Ketuk untuk ubah Masuk / Keluar"
          className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 transition ${
            row.type === 'masuk'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-700'
          }`}
        >
          {row.type === 'masuk' ? '+' : '-'}
        </button>

        {/* Inline borderless item name */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={row.title}
            onChange={e => handleUpdateRow(row.localId, { title: e.target.value })}
            placeholder={row.type === 'masuk' ? 'Nama pemasukan...' : 'Nama pengeluaran...'}
            className="w-full text-xs font-semibold text-slate-900 bg-transparent border-b border-transparent focus:border-emerald-600 focus:outline-none py-0.5"
          />
          <button
            type="button"
            onClick={() => handleCycleWallet(row.localId, row.walletId)}
            className="text-[10px] text-slate-400 hover:text-emerald-700 block leading-tight"
          >
            {shortWallet} · ketuk ubah kantong
          </button>
        </div>

        {/* Inline right-aligned tabular nominal */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] font-mono text-slate-400">Rp</span>
          <input
            type="number"
            min={0}
            value={row.amount || ''}
            onChange={e =>
              handleUpdateRow(row.localId, {
                amount: Math.max(0, Math.round(Number(e.target.value) || 0)),
              })
            }
            placeholder="0"
            className={`w-24 text-right text-xs font-mono tabular-nums font-extrabold bg-slate-50 border border-slate-200 focus:border-emerald-700 focus:bg-white rounded-lg px-2 py-1 focus:outline-none ${
              row.type === 'masuk' ? 'text-emerald-700' : 'text-slate-900'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={() => handleRemoveRow(row.localId)}
          className="p-1.5 text-slate-300 hover:text-rose-600 shrink-0"
          title="Hapus baris"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
        {/* Compact Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 truncate">
              Catat Suara · Struk DompetQu
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {formatReadableDateId(txDate)} · Auto pisah Masuk &amp; Keluar
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopMic();
              onClose();
            }}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Date & Default Wallet Strip */}
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <input
              type="date"
              value={txDate}
              onChange={e => setTxDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1.5 font-mono text-slate-700 bg-slate-50"
            />
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {wallets.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setDefaultWalletId(w.id)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition ${
                    defaultWalletId === w.id
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {w.kind === 'cash' ? 'Cash' : w.kind === 'bank' ? 'ATM' : w.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Voice + Live Input Bar (Always on top for instant results) */}
          {!startEmptyManual && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition active:scale-95 shadow-sm ${
                    isListening
                      ? 'bg-rose-600 text-white ring-4 ring-rose-200'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  }`}
                  title={isListening ? 'Berhenti Rekam' : 'Mulai Rekam Suara'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <textarea
                  rows={2}
                  value={transcript}
                  onChange={e => {
                    setAiLockedEdit(false);
                    setTranscript(e.target.value);
                  }}
                  placeholder='Ucapkan / ketik: "masuk 100000 bensin 20000 makan 15000"'
                  className="flex-1 bg-white rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-700 resize-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setAiLockedEdit(false);
                    setTranscript('masuk 100000 bensin 20000 makan 15000');
                  }}
                  className="font-bold text-emerald-800 hover:underline"
                >
                  Contoh: masuk 100000 bensin 20000 makan 15000
                </button>
                <button
                  type="button"
                  disabled={isRefiningAi || !transcript.trim()}
                  onClick={() => void handleRefineWithAi()}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 font-bold flex items-center gap-1 shrink-0"
                >
                  {isRefiningAi ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>Rapikan AI</span>
                </button>
              </div>
            </div>
          )}

          {/* Minimalist Modular Receipt View (Auto-Separated Masuk & Keluar) */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-dashed border-slate-300 flex items-center justify-between text-[11px] font-bold text-slate-600">
              <span>STRUK CATATAN · {formatReadableDateId(txDate)}</span>
              <span>{draftItems.length} item</span>
            </div>

            {draftItems.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Struk otomatis muncul begitu Anda mengucapkan atau mengetik catatan.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAddRow('masuk')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold"
                  >
                    + Pemasukan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddRow('keluar')}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-bold"
                  >
                    + Pengeluaran
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3.5 py-2 space-y-2.5">
                {incomeItems.length > 0 && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 pb-1">
                      Pemasukan ({incomeItems.length})
                    </div>
                    {incomeItems.map(renderReceiptRow)}
                  </div>
                )}

                {expenseItems.length > 0 && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 pb-1">
                      Pengeluaran ({expenseItems.length})
                    </div>
                    {expenseItems.map(renderReceiptRow)}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1 border-t border-slate-100 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => handleAddRow('masuk')}
                    className="text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Masuk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddRow('keluar')}
                    className="text-rose-700 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Keluar</span>
                  </button>
                </div>
              </div>
            )}

            {/* Receipt Total Summary */}
            {draftItems.length > 0 && (
              <div className="px-3.5 py-3 bg-slate-50 border-t border-dashed border-slate-300 space-y-1 text-xs font-mono tabular-nums">
                <div className="flex justify-between text-emerald-700">
                  <span>Total Masuk</span>
                  <span className="font-bold">+Rp {totalMasuk.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Total Keluar</span>
                  <span className="font-bold">-Rp {totalKeluar.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 text-slate-900">
                  <span className="font-sans font-extrabold text-xs">Total Jumlah / Sisa</span>
                  <span
                    className={`text-base font-black ${
                      netSisa >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {netSisa < 0 ? '-' : ''}Rp {Math.abs(netSisa).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Save CTA */}
        <div className="p-4 border-t border-slate-200 bg-white shrink-0">
          <button
            type="button"
            onClick={handleSaveReceipt}
            disabled={draftItems.filter(r => r.amount > 0).length === 0}
            className="w-full min-h-[46px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Simpan Struk ({draftItems.filter(r => r.amount > 0).length} item)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
