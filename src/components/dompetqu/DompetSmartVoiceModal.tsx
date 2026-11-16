import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  DOMPET_EXPENSE_CATEGORIES,
  DOMPET_INCOME_CATEGORIES,
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

export const DompetSmartVoiceModal: React.FC<DompetSmartVoiceModalProps> = ({
  open,
  onClose,
  showNotification,
  onSaved,
  startEmptyManual = false,
}) => {
  const [wallets, setWallets] = useState<DompetWallet[]>(() => DompetQuStorage.getWallets());
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [usedAi, setUsedAi] = useState<boolean>(false);
  const [draftItems, setDraftItems] = useState<DompetParsedDraftItem[]>([]);
  const [txDate, setTxDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

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
    setTxDate(new Date().toISOString().slice(0, 10));

    if (startEmptyManual) {
      setStep('review');
      setUsedAi(false);
      setDraftItems([
        {
          localId: `manual-${Date.now()}`,
          type: 'keluar',
          category: 'Belanja Harian',
          title: '',
          amount: 0,
          walletId: freshWallets[0]?.id || 'wallet-cash',
          note: '',
        },
      ]);
    } else {
      setStep('input');
      setDraftItems([]);
    }
    return () => stopMic();
  }, [open, startEmptyManual]);

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
      showNotification('Browser belum mendukung mikrofon langsung. Silakan ketik atau tempel catatan di kolom teks.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'id-ID';
      rec.continuous = true;
      rec.interimResults = true;
      baseTextBeforeMicRef.current = transcript.trim();

      rec.onstart = () => {
        setIsListening(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (event: any) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i += 1) {
          combined += event.results[i][0].transcript + ' ';
        }
        const prefix = baseTextBeforeMicRef.current;
        setTranscript(prefix ? `${prefix}, ${combined.trim()}` : combined.trim());
      };

      rec.onerror = () => {
        setIsListening(false);
        showNotification('Rekam suara berhenti. Periksa izin mikrofon atau ketik manual.');
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
      showNotification('Gagal memulai mikrofon. Gunakan kolom teks di bawah.');
    }
  };

  const handleAnalyzeText = async () => {
    stopMic();
    const clean = transcript.trim();
    if (!clean) {
      showNotification('Rekam suara atau ketik catatan dulu (misal: belanja 50rb, jajan bocah 20rb).');
      return;
    }
    setIsParsing(true);
    try {
      const res = await DompetQuStorage.parseSpeechSmart(clean, wallets);
      setUsedAi(res.usedAi);
      if (res.items.length === 0) {
        setDraftItems([
          {
            localId: `draft-${Date.now()}`,
            type: 'keluar',
            category: 'Pengeluaran Lainnya',
            title: clean.slice(0, 40),
            amount: 0,
            walletId: wallets[0]?.id || 'wallet-cash',
            note: clean,
          },
        ]);
      } else {
        setDraftItems(res.items);
      }
      setStep('review');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddRow = () => {
    setDraftItems(prev => [
      ...prev,
      {
        localId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'keluar',
        category: 'Belanja Harian',
        title: '',
        amount: 0,
        walletId: wallets[0]?.id || 'wallet-cash',
        note: '',
      },
    ]);
  };

  const handleUpdateRow = (localId: string, patch: Partial<DompetParsedDraftItem>) => {
    setDraftItems(prev =>
      prev.map(row => {
        if (row.localId !== localId) return row;
        const next = { ...row, ...patch };
        if (patch.type && patch.type !== row.type) {
          next.category = patch.type === 'masuk' ? 'Gaji' : 'Belanja Harian';
        }
        return next;
      })
    );
  };

  const handleRemoveRow = (localId: string) => {
    setDraftItems(prev => prev.filter(r => r.localId !== localId));
  };

  const handleSaveAll = () => {
    const valid = draftItems.filter(r => r.title.trim() && r.amount > 0);
    if (valid.length === 0) {
      showNotification('Isi minimal 1 baris dengan keterangan dan nominal lebih dari 0.');
      return;
    }
    const count = DompetQuStorage.addTransactionsBatch(
      valid.map(v => ({
        type: v.type,
        category: v.category,
        title: v.title,
        amount: v.amount,
        walletId: v.walletId,
        note: v.note,
        date: txDate,
        source: startEmptyManual ? 'manual' : 'voice',
      }))
    );
    showNotification(`${count} catatan pribadi berhasil disimpan ke DompetQu!`);
    if (onSaved) onSaved(count);
    onClose();
  };

  const totalMasuk = draftItems
    .filter(r => r.type === 'masuk')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalKeluar = draftItems
    .filter(r => r.type === 'keluar')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 shadow-2xl">
        {/* Top Modal Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-slate-900 truncate">
              {step === 'input'
                ? 'Catat Suara Cerdas · DompetQu'
                : 'Revisi & Simpan Catatan DompetQu'}
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              Terisolasi khusus akun Anda · Cash, ATM &amp; E-Wallet
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === 'input' ? (
            <>
              {/* Big Thumb-Friendly Voice Trigger */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center space-y-3">
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center transition active:scale-95 shadow-lg ${
                    isListening
                      ? 'bg-rose-600 text-white ring-4 ring-rose-200'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white ring-4 ring-emerald-200'
                  }`}
                >
                  {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    {isListening
                      ? 'Sedang Mendengarkan... Ketuk untuk Berhenti'
                      : 'Ketuk Mikrofon & Sebutkan Sekaligus'}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Contoh: &ldquo;Gaji 5 juta masuk ATM, belanja 120rb cash, listrik rumah 300rb,
                    jajan bocah 25rb, ongkos kerja 30rb, makan 35rb&rdquo;
                  </p>
                </div>
              </div>

              {/* Live Editable Transcript */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Hasil Ucapan / Ketik Manual (Bisa Diedit)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setTranscript(
                        'Gaji 5 juta masuk atm, belanja sayur 85rb cash, tagihan rumah 450rb dari atm, jajan bocah 25rb, ongkos kerja 30rb, makan siang 40rb'
                      )
                    }
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    Isi Contoh Kalimat
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder="Contoh: gaji 4,5 juta masuk bank, belanja harian 100rb, jajan bocah 20rb, ongkos kerja 25rb, makan 35rb..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-700 leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopMic();
                    setDraftItems([
                      {
                        localId: `manual-${Date.now()}`,
                        type: 'keluar',
                        category: 'Belanja Harian',
                        title: '',
                        amount: 0,
                        walletId: wallets[0]?.id || 'wallet-cash',
                        note: '',
                      },
                    ]);
                    setStep('review');
                  }}
                  className="min-h-[44px] px-3.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shrink-0"
                >
                  Tabel Kosong
                </button>
                <button
                  type="button"
                  disabled={isParsing}
                  onClick={() => void handleAnalyzeText()}
                  className="flex-1 min-h-[44px] px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {isParsing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Mengurai Catatan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analisa &amp; Buat Tabel Edit</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="text-slate-600">
                  {usedAi ? 'Hasil urai AI siap direvisi' : 'Tabel edit catatan pribadi'} ·{' '}
                  <strong className="text-slate-900">{draftItems.length} baris</strong>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-800"
                  />
                  {!startEmptyManual && (
                    <button
                      type="button"
                      onClick={() => setStep('input')}
                      className="text-[11px] font-bold text-emerald-700 hover:underline whitespace-nowrap"
                    >
                      Ulang Suara
                    </button>
                  )}
                </div>
              </div>

              {/* Editable Spreadsheet Rows */}
              <div className="space-y-2.5">
                {draftItems.map((row, idx) => {
                  const categoryOptions =
                    row.type === 'masuk' ? DOMPET_INCOME_CATEGORIES : DOMPET_EXPENSE_CATEGORIES;
                  return (
                    <div
                      key={row.localId}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-slate-400">#{idx + 1}</span>
                          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.localId, { type: 'keluar' })}
                              className={`px-2.5 py-1 rounded-md transition ${
                                row.type === 'keluar'
                                  ? 'bg-rose-600 text-white'
                                  : 'text-slate-600'
                              }`}
                            >
                              Keluar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.localId, { type: 'masuk' })}
                              className={`px-2.5 py-1 rounded-md transition ${
                                row.type === 'masuk'
                                  ? 'bg-emerald-700 text-white'
                                  : 'text-slate-600'
                              }`}
                            >
                              Masuk
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.localId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={row.title}
                          onChange={e => handleUpdateRow(row.localId, { title: e.target.value })}
                          placeholder="Keterangan (mis: Jajan Bocah)"
                          className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 text-xs text-slate-900"
                        />
                        <input
                          type="number"
                          min={0}
                          value={row.amount || ''}
                          onChange={e =>
                            handleUpdateRow(row.localId, {
                              amount: Math.max(0, Math.round(Number(e.target.value) || 0)),
                            })
                          }
                          placeholder="Nominal Rp"
                          className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-mono tabular-nums font-bold text-slate-900"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={row.category}
                          onChange={e => handleUpdateRow(row.localId, { category: e.target.value })}
                          className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2 text-[11px] text-slate-800"
                        >
                          {categoryOptions.map(cat => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                        <select
                          value={row.walletId}
                          onChange={e => handleUpdateRow(row.localId, { walletId: e.target.value })}
                          className="w-full min-h-[38px] bg-white border border-slate-300 rounded-lg px-2 text-[11px] text-slate-800"
                        >
                          {wallets.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                className="w-full min-h-[40px] border border-dashed border-emerald-400 text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Baris Manual</span>
              </button>
            </>
          )}
        </div>

        {/* Sticky Footer on Review Step */}
        {step === 'review' && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-emerald-700 font-bold">
                +Rp {totalMasuk.toLocaleString('id-ID')} Masuk
              </span>
              <span className="text-rose-700 font-bold">
                -Rp {totalKeluar.toLocaleString('id-ID')} Keluar
              </span>
            </div>
            <button
              type="button"
              onClick={handleSaveAll}
              className="w-full min-h-[46px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan ke DompetQu</span>
              <Wallet className="w-4 h-4 opacity-80" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
