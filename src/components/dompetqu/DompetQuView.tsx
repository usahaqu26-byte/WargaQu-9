import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Building2,
  Download,
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  Mic,
  Pencil,
  PieChart,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlock,
  Wallet,
  X,
} from 'lucide-react';
import {
  DOMPET_ALL_CATEGORIES,
  DOMPET_EXPENSE_CATEGORIES,
  DOMPETQU_SYNC_EVENT,
  DompetBudget,
  DompetPrivacySettings,
  DompetQuStorage,
  DompetTransaction,
  DompetWallet,
  DompetWalletKind,
} from '../../services/dompetQuStorage';
import { ModuleOnboardingService } from '../../services/moduleOnboardingService';
import { DompetSmartVoiceModal } from './DompetSmartVoiceModal';

type DompetTab = 'ringkasan' | 'mutasi' | 'pos' | 'keamanan';

interface DompetQuViewProps {
  onBackToWarga: () => void;
  showNotification: (msg: string) => void;
  initialOpenVoice?: boolean;
}

const WALLET_KIND_LABEL: Record<DompetWalletKind, string> = {
  cash: 'Tunai / Cash',
  bank: 'ATM / Bank',
  ewallet: 'E-Wallet / QRIS',
  tabungan: 'Tabungan Khusus',
};

export const DompetQuView: React.FC<DompetQuViewProps> = ({
  onBackToWarga,
  showNotification,
  initialOpenVoice = false,
}) => {
  const [wallets, setWallets] = useState<DompetWallet[]>(() => DompetQuStorage.getWallets());
  const [transactions, setTransactions] = useState<DompetTransaction[]>(() =>
    DompetQuStorage.getTransactions()
  );
  const [budgets, setBudgets] = useState<DompetBudget[]>(() => DompetQuStorage.getBudgets());
  const [privacy, setPrivacy] = useState<DompetPrivacySettings>(() =>
    DompetQuStorage.getPrivacySettings()
  );

  // Eye Closed by default so nobody peeking sees balances
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(
    () => DompetQuStorage.getPrivacySettings().hideBalanceByDefault !== false
  );

  // Optional PIN lock gate
  const [isPinUnlocked, setIsPinUnlocked] = useState<boolean>(
    () => !DompetQuStorage.getPrivacySettings().pinEnabled
  );
  const [pinEntry, setPinEntry] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const [activeTab, setActiveTab] = useState<DompetTab>('ringkasan');

  // Modals / Sheets
  const [voiceModalOpen, setVoiceModalOpen] = useState<boolean>(initialOpenVoice);
  const [voiceManualOnly, setVoiceManualOnly] = useState<boolean>(false);

  const [transferOpen, setTransferOpen] = useState<boolean>(false);
  const [transferForm, setTransferForm] = useState<{
    fromId: string;
    toId: string;
    amount: string;
    note: string;
  }>({
    fromId: wallets[1]?.id || wallets[0]?.id || '',
    toId: wallets[0]?.id || '',
    amount: '',
    note: 'Tarik Tunai ATM ke Dompet Cash',
  });

  const [walletFormOpen, setWalletFormOpen] = useState<boolean>(false);
  const [editingWallet, setEditingWallet] = useState<DompetWallet | null>(null);
  const [walletDraft, setWalletDraft] = useState<{
    name: string;
    kind: DompetWalletKind;
    balance: string;
    bankOrProvider: string;
  }>({
    name: '',
    kind: 'bank',
    balance: '0',
    bankOrProvider: '',
  });

  // Mutasi filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterWalletId, setFilterWalletId] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'masuk' | 'keluar' | 'transfer'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // PIN config form in Keamanan tab
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => {
      setWallets(DompetQuStorage.getWallets());
      setTransactions(DompetQuStorage.getTransactions());
      setBudgets(DompetQuStorage.getBudgets());
      setPrivacy(DompetQuStorage.getPrivacySettings());
    };
    window.addEventListener(DOMPETQU_SYNC_EVENT, sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(DOMPETQU_SYNC_EVENT, sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const totalCombined = useMemo(
    () => wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0),
    [wallets]
  );

  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM

  const monthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCategory = new Map<string, number>();

    transactions.forEach(tx => {
      if (!tx.date.startsWith(currentMonthPrefix)) return;
      if (tx.type === 'masuk') {
        income += tx.amount;
      } else if (tx.type === 'keluar') {
        expense += tx.amount;
        byCategory.set(tx.category, (byCategory.get(tx.category) || 0) + tx.amount);
      }
    });
    return { income, expense, byCategory };
  }, [transactions, currentMonthPrefix]);

  const walletMap = useMemo(() => {
    const map = new Map<string, DompetWallet>();
    wallets.forEach(w => map.set(w.id, w));
    return map;
  }, [wallets]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter(tx => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (
        filterWalletId !== 'all' &&
        tx.walletId !== filterWalletId &&
        tx.toWalletId !== filterWalletId
      ) {
        return false;
      }
      if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
      if (q) {
        const hay = `${tx.title} ${tx.category} ${tx.note || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, searchQuery, filterWalletId, filterType, filterCategory]);

  const formatNominal = (val: number): string => {
    if (isBalanceHidden) return '••••••••';
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  const handleUnlockPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (DompetQuStorage.verifyPin(pinEntry)) {
      setIsPinUnlocked(true);
      setPinError('');
      setPinEntry('');
    } else {
      setPinError('PIN salah. Coba periksa kembali.');
    }
  };

  const openAddWalletModal = () => {
    setEditingWallet(null);
    setWalletDraft({ name: '', kind: 'bank', balance: '0', bankOrProvider: '' });
    setWalletFormOpen(true);
  };

  const openEditWalletModal = (w: DompetWallet) => {
    setEditingWallet(w);
    setWalletDraft({
      name: w.name,
      kind: w.kind,
      balance: String(w.balance),
      bankOrProvider: w.bankOrProvider || '',
    });
    setWalletFormOpen(true);
  };

  const handleSaveWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletDraft.name.trim()) {
      showNotification('Nama kantong saldo wajib diisi.');
      return;
    }
    const numBal = Math.round(Number(walletDraft.balance) || 0);
    if (editingWallet) {
      DompetQuStorage.updateWallet(editingWallet.id, {
        name: walletDraft.name,
        kind: walletDraft.kind,
        balance: numBal,
        bankOrProvider: walletDraft.bankOrProvider,
      });
      showNotification(`Kantong "${walletDraft.name}" diperbarui.`);
    } else {
      DompetQuStorage.addWallet({
        name: walletDraft.name,
        kind: walletDraft.kind,
        initialBalance: numBal,
        bankOrProvider: walletDraft.bankOrProvider,
      });
      showNotification(`Kantong "${walletDraft.name}" ditambahkan.`);
    }
    setWalletFormOpen(false);
  };

  const handleSubmitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(Number(transferForm.amount) || 0);
    if (amt <= 0) {
      showNotification('Masukkan nominal pindah saldo lebih dari 0.');
      return;
    }
    if (transferForm.fromId === transferForm.toId) {
      showNotification('Pilih kantong asal dan tujuan yang berbeda.');
      return;
    }
    const ok = DompetQuStorage.transferBetweenWallets(
      transferForm.fromId,
      transferForm.toId,
      amt,
      transferForm.note
    );
    if (ok) {
      showNotification('Pindah saldo antar kantong berhasil dicatat.');
      setTransferOpen(false);
      setTransferForm(prev => ({ ...prev, amount: '' }));
    }
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPinInput.trim();
    if (clean.length < 4 || clean.length > 6 || !/^\d+$/.test(clean)) {
      showNotification('PIN harus 4 hingga 6 digit angka.');
      return;
    }
    DompetQuStorage.updatePrivacySettings({ newPin: clean });
    setNewPinInput('');
    showNotification('PIN Kunci DompetQu diaktifkan.');
  };

  const renderWalletIcon = (kind: DompetWalletKind) => {
    if (kind === 'bank' || kind === 'tabungan') return <Building2 className="w-4 h-4" />;
    if (kind === 'ewallet') return <Smartphone className="w-4 h-4" />;
    return <Wallet className="w-4 h-4" />;
  };

  // Optional PIN Gate Screen
  if (!isPinUnlocked) {
    return (
      <div className="w-full h-full bg-slate-50 flex flex-col">
        <header className="bg-emerald-800 text-white px-4 py-3.5 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onBackToWarga}
            className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-xl hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-extrabold">DompetQu Terkunci</span>
          <div className="w-10" />
        </header>

        <div className="flex-1 flex items-center justify-center p-5">
          <form
            onSubmit={handleUnlockPin}
            className="w-full max-w-xs bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Masukkan PIN DompetQu</h2>
              <p className="text-[11px] text-slate-500 mt-1">
                Keuangan pribadi terisolasi dan hanya bisa dibuka oleh Anda.
              </p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinEntry}
              onChange={e => {
                setPinEntry(e.target.value.replace(/\D/g, ''));
                setPinError('');
              }}
              placeholder="••••"
              className="w-full min-h-[46px] text-center tracking-[0.4em] font-mono text-lg border border-slate-300 rounded-xl px-3 focus:outline-none focus:border-emerald-700"
              autoFocus
            />
            {pinError && <p className="text-[11px] text-rose-600 font-semibold">{pinError}</p>}
            <button
              type="submit"
              className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
            >
              Buka DompetQu
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col relative overflow-hidden">
      {/* Compact Top App Bar (<= 56px) */}
      <header className="bg-emerald-800 text-white px-4 py-2.5 flex items-center justify-between gap-2 shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBackToWarga}
            className="min-w-[40px] min-h-[40px] -ml-1.5 flex items-center justify-center rounded-xl hover:bg-white/10 shrink-0"
            title="Kembali ke Beranda"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold tracking-tight truncate">DompetQu</h1>
            <p className="text-[10px] text-emerald-200 truncate">
              Privasi Akun Terisolasi · Hanya Anda
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsBalanceHidden(prev => !prev)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-white/10"
            title={isBalanceHidden ? 'Tampilkan Saldo' : 'Sembunyikan Saldo'}
          >
            {isBalanceHidden ? <EyeOff className="w-4 h-4 text-emerald-200" /> : <Eye className="w-4 h-4 text-white" />}
          </button>
          <button
            type="button"
            onClick={() => ModuleOnboardingService.openGuide('dompetqu')}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-white/10"
            title="Panduan DompetQu"
          >
            <HelpCircle className="w-4 h-4 text-emerald-200" />
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {/* TAB 1: RINGKASAN */}
        {activeTab === 'ringkasan' && (
          <>
            {/* Combined Wallet Balance Card */}
            <section className="rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-700 text-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-emerald-100">
                  Sisa Dompet Gabungan (Cash + ATM + E-Wallet)
                </span>
                <button
                  type="button"
                  onClick={() => setIsBalanceHidden(prev => !prev)}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold flex items-center gap-1"
                >
                  {isBalanceHidden ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Lihat</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Tutup</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-2xl font-black font-mono tabular-nums tracking-tight">
                {formatNominal(totalCombined)}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/15 text-[11px]">
                <div>
                  <div className="text-emerald-200">Masuk Bulan Ini</div>
                  <div className="font-bold font-mono tabular-nums mt-0.5">
                    {isBalanceHidden ? '••••••' : `+Rp ${monthStats.income.toLocaleString('id-ID')}`}
                  </div>
                </div>
                <div>
                  <div className="text-emerald-200">Keluar Bulan Ini</div>
                  <div className="font-bold font-mono tabular-nums mt-0.5">
                    {isBalanceHidden ? '••••••' : `-Rp ${monthStats.expense.toLocaleString('id-ID')}`}
                  </div>
                </div>
              </div>
            </section>

            {/* Primary Thumb Actions */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setVoiceManualOnly(false);
                  setVoiceModalOpen(true);
                }}
                className="min-h-[48px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 text-[11px] font-bold shadow-xs"
              >
                <Mic className="w-4 h-4" />
                <span>Catat Suara</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVoiceManualOnly(true);
                  setVoiceModalOpen(true);
                }}
                className="min-h-[48px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 text-[11px] font-bold"
              >
                <Plus className="w-4 h-4 text-emerald-700" />
                <span>Catat Manual</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransferForm({
                    fromId: wallets[1]?.id || wallets[0]?.id || '',
                    toId: wallets[0]?.id || '',
                    amount: '',
                    note: 'Tarik Tunai / Pindah Kantong',
                  });
                  setTransferOpen(true);
                }}
                className="min-h-[48px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 text-[11px] font-bold"
              >
                <ArrowLeftRight className="w-4 h-4 text-teal-700" />
                <span>Pindah Saldo</span>
              </button>
            </div>

            {/* Wallets List */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-900">
                  Kantong Dana Anda ({wallets.length})
                </h2>
                <button
                  type="button"
                  onClick={openAddWalletModal}
                  className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Kantong</span>
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {wallets.map(w => (
                  <div
                    key={w.id}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        {renderWalletIcon(w.kind)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{w.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {WALLET_KIND_LABEL[w.kind]}
                          {w.bankOrProvider ? ` · ${w.bankOrProvider}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-extrabold font-mono tabular-nums text-slate-900">
                        {formatNominal(w.balance)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditWalletModal(w)}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 rounded-lg"
                        title="Atur Saldo / Nama"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent 5 Transactions */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-900">Catatan Terbaru</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('mutasi')}
                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  Lihat Semua
                </button>
              </div>
              {transactions.length === 0 ? (
                <div className="p-5 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Belum ada catatan keuangan pribadi. Ketuk <strong>Catat Suara</strong> dan
                    sebutkan pemasukan atau pengeluaran Anda.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {transactions.slice(0, 5).map(tx => {
                    const wName = walletMap.get(tx.walletId)?.name || 'Dompet';
                    return (
                      <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">{tx.title}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {tx.date} · {tx.category} · {wName}
                          </div>
                        </div>
                        <div
                          className={`text-xs font-extrabold font-mono tabular-nums shrink-0 ${
                            tx.type === 'masuk'
                              ? 'text-emerald-700'
                              : tx.type === 'keluar'
                              ? 'text-rose-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {isBalanceHidden
                            ? '••••••'
                            : `${tx.type === 'masuk' ? '+' : tx.type === 'keluar' ? '-' : ''}Rp ${tx.amount.toLocaleString('id-ID')}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB 2: MUTASI & FILTER */}
        {activeTab === 'mutasi' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari gaji, belanja, jajan bocah, ongkos..."
                  className="w-full min-h-[40px] pl-9 pr-3 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={filterType}
                  onChange={e =>
                    setFilterType(e.target.value as 'all' | 'masuk' | 'keluar' | 'transfer')
                  }
                  className="min-h-[38px] border border-slate-300 rounded-lg px-2 text-[11px] bg-white text-slate-800"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="masuk">Pemasukan</option>
                  <option value="keluar">Pengeluaran</option>
                  <option value="transfer">Pindah Saldo</option>
                </select>
                <select
                  value={filterWalletId}
                  onChange={e => setFilterWalletId(e.target.value)}
                  className="min-h-[38px] border border-slate-300 rounded-lg px-2 text-[11px] bg-white text-slate-800"
                >
                  <option value="all">Semua Kantong</option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="min-h-[38px] border border-slate-300 rounded-lg px-2 text-[11px] bg-white text-slate-800"
                >
                  <option value="all">Semua Pos</option>
                  {DOMPET_ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Menampilkan <strong>{filteredTransactions.length}</strong> catatan
                </span>
                <button
                  type="button"
                  onClick={() => DompetQuStorage.exportTransactionsCsv()}
                  className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor Excel CSV</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Tidak ada catatan yang cocok dengan filter.
                </div>
              ) : (
                filteredTransactions.map(tx => {
                  const wName = walletMap.get(tx.walletId)?.name || 'Dompet';
                  return (
                    <div key={tx.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900">{tx.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {tx.date} {tx.time} · {tx.category} · {wName}
                        </div>
                        {tx.note && tx.note !== tx.title && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {tx.note}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-extrabold font-mono tabular-nums ${
                            tx.type === 'masuk'
                              ? 'text-emerald-700'
                              : tx.type === 'keluar'
                              ? 'text-rose-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {isBalanceHidden
                            ? '••••••'
                            : `${tx.type === 'masuk' ? '+' : tx.type === 'keluar' ? '-' : ''}Rp ${tx.amount.toLocaleString('id-ID')}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            DompetQuStorage.deleteTransaction(tx.id);
                            showNotification('Catatan dihapus & saldo kantong disesuaikan.');
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                          title="Hapus catatan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: POS ANGGARAN BULANAN */}
        {activeTab === 'pos' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1">
              <h2 className="text-xs font-extrabold text-slate-900">
                Jatah &amp; Realisasi Bulan {currentMonthPrefix}
              </h2>
              <p className="text-[11px] text-slate-500">
                Atur batas bulanan per pos (Belanja, Rumah, Jajan Bocah, Ongkos Kerja, Makan) agar
                pengeluaran terkontrol. Isi 0 jika tidak dibatasi.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              {DOMPET_EXPENSE_CATEGORIES.map(category => {
                const spent = monthStats.byCategory.get(category) || 0;
                const budgetObj = budgets.find(b => b.category === category);
                const limit = budgetObj?.monthlyLimit || 0;
                const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
                const isOver = limit > 0 && spent > limit;

                return (
                  <div key={category} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{category}</div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          Terpakai: {isBalanceHidden ? '••••••' : `Rp ${spent.toLocaleString('id-ID')}`}
                          {limit > 0 &&
                            ` / ${isBalanceHidden ? '••••' : `Rp ${limit.toLocaleString('id-ID')}`}`}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={limit || ''}
                        onChange={e =>
                          DompetQuStorage.saveBudget(
                            category,
                            Math.max(0, Math.round(Number(e.target.value) || 0))
                          )
                        }
                        placeholder="Batas Rp"
                        className="w-28 min-h-[36px] border border-slate-300 rounded-lg px-2 text-xs font-mono tabular-nums text-right"
                      />
                    </div>
                    {limit > 0 && (
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOver ? 'bg-rose-600' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: PRIVASI, PIN & KELOLA KANTONG */}
        {activeTab === 'keamanan' && (
          <div className="space-y-3">
            {/* Strict Isolation Info */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Isolasi Privasi Ketat Per Akun</span>
              </div>
              <p className="text-[11px] text-emerald-900/85 leading-relaxed">
                Seluruh isi DompetQu disimpan terisolasi khusus untuk akun{' '}
                <strong>{DompetQuStorage.getOwnerLabel()}</strong> di perangkat ini. Tidak dibagikan
                ke RTQu, pengurus, atau pengguna lain.
              </p>
            </div>

            {/* Eye Default Privacy */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Ikon Mata Tertutup Saat Dibuka
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Saldo otomatis disamarkan (••••••••) setiap membuka aplikasi agar aman dari
                  intipan orang di sebelah Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !privacy.hideBalanceByDefault;
                  DompetQuStorage.updatePrivacySettings({ hideBalanceByDefault: next });
                  setIsBalanceHidden(next);
                  showNotification(
                    next
                      ? 'Saldo otomatis tertutup saat dibuka.'
                      : 'Mode saldo tampil langsung diaktifkan.'
                  );
                }}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-bold shrink-0 ${
                  privacy.hideBalanceByDefault
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                {privacy.hideBalanceByDefault ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>

            {/* Optional PIN Lock */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {privacy.pinEnabled ? (
                    <Lock className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <Unlock className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-xs font-bold text-slate-900">
                    Kunci PIN DompetQu ({privacy.pinEnabled ? 'Aktif' : 'Belum Dipasang'})
                  </span>
                </div>
                {privacy.pinEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      DompetQuStorage.updatePrivacySettings({ newPin: null });
                      showNotification('Kunci PIN DompetQu dinonaktifkan.');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:underline"
                  >
                    Hapus PIN
                  </button>
                )}
              </div>

              <form onSubmit={handleSavePin} className="flex gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder={privacy.pinEnabled ? 'Ganti PIN baru (4-6 digit)' : 'Pasang PIN (4-6 digit)'}
                  className="flex-1 min-h-[40px] border border-slate-300 rounded-xl px-3 text-xs font-mono"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shrink-0"
                >
                  Simpan PIN
                </button>
              </form>
            </div>

            {/* Manage Wallets */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Kelola Kantong Saldo</span>
                <button
                  type="button"
                  onClick={openAddWalletModal}
                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  + Kantong Baru
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {wallets.map(w => (
                  <div key={w.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{w.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {WALLET_KIND_LABEL[w.kind]} · {formatNominal(w.balance)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditWalletModal(w)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-700"
                      >
                        Ubah
                      </button>
                      {wallets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            DompetQuStorage.deleteWallet(w.id);
                            showNotification(`Kantong "${w.name}" dihapus.`);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                          title="Hapus Kantong"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reset Data Pribadi */}
            <div className="bg-white rounded-2xl border border-rose-200 p-4 space-y-2">
              <div className="text-xs font-bold text-rose-800">Bersihkan Catatan DompetQu</div>
              <p className="text-[11px] text-slate-600">
                Menghapus seluruh catatan transaksi dan mengembalikan saldo kantong ke Rp 0 khusus
                pada akun ini.
              </p>
              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="min-h-[38px] px-3 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold"
                >
                  Reset Data DompetQu
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      DompetQuStorage.resetAllData();
                      setConfirmReset(false);
                      showNotification('Data DompetQu berhasil direset bersih.');
                    }}
                    className="min-h-[38px] px-3 bg-rose-600 text-white rounded-xl text-xs font-bold"
                  >
                    Ya, Hapus Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="min-h-[38px] px-3 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation (Compact <= 64px) */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 grid grid-cols-4 items-center z-20">
        {[
          { id: 'ringkasan' as DompetTab, label: 'Ringkasan', icon: Wallet },
          { id: 'mutasi' as DompetTab, label: 'Mutasi', icon: Receipt },
          { id: 'pos' as DompetTab, label: 'Anggaran', icon: PieChart },
          { id: 'keamanan' as DompetTab, label: 'Privasi', icon: ShieldCheck },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition ${
                active ? 'text-emerald-700 font-extrabold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal: Smart Voice / Manual Transaction Entry */}
      <DompetSmartVoiceModal
        open={voiceModalOpen}
        startEmptyManual={voiceManualOnly}
        onClose={() => setVoiceModalOpen(false)}
        showNotification={showNotification}
      />

      {/* Modal: Transfer Between Wallets */}
      {transferOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSubmitTransfer}
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-4 space-y-3 border border-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Pindah Saldo Antar Kantong</h3>
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Dari Kantong</label>
                <select
                  value={transferForm.fromId}
                  onChange={e => setTransferForm(prev => ({ ...prev, fromId: e.target.value }))}
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-2.5 bg-white"
                >
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Ke Kantong</label>
                <select
                  value={transferForm.toId}
                  onChange={e => setTransferForm(prev => ({ ...prev, toId: e.target.value }))}
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-2.5 bg-white"
                >
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nominal (Rp)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={transferForm.amount}
                  onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="Contoh: 500000"
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Catatan</label>
                <input
                  type="text"
                  value={transferForm.note}
                  onChange={e => setTransferForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Misal: Tarik tunai ATM"
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
            >
              Catat Pindah Saldo
            </button>
          </form>
        </div>
      )}

      {/* Modal: Add / Edit Wallet */}
      {walletFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleSaveWallet}
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-4 space-y-3 border border-slate-200 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingWallet ? 'Edit Kantong Saldo' : 'Tambah Kantong Saldo'}
              </h3>
              <button
                type="button"
                onClick={() => setWalletFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Kantong</label>
                <input
                  type="text"
                  required
                  value={walletDraft.name}
                  onChange={e => setWalletDraft(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Misal: BCA Pribadi / Dompet Cash"
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Jenis</label>
                  <select
                    value={walletDraft.kind}
                    onChange={e =>
                      setWalletDraft(prev => ({
                        ...prev,
                        kind: e.target.value as DompetWalletKind,
                      }))
                    }
                    className="w-full min-h-[40px] border border-slate-300 rounded-xl px-2 bg-white"
                  >
                    <option value="cash">Tunai / Cash</option>
                    <option value="bank">ATM / Bank</option>
                    <option value="ewallet">E-Wallet / QRIS</option>
                    <option value="tabungan">Tabungan Khusus</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Saldo Saat Ini (Rp)</label>
                  <input
                    type="number"
                    value={walletDraft.balance}
                    onChange={e => setWalletDraft(prev => ({ ...prev, balance: e.target.value }))}
                    className="w-full min-h-[40px] border border-slate-300 rounded-xl px-2.5 font-mono tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Keterangan Bank / E-Wallet</label>
                <input
                  type="text"
                  value={walletDraft.bankOrProvider}
                  onChange={e =>
                    setWalletDraft(prev => ({ ...prev, bankOrProvider: e.target.value }))
                  }
                  placeholder="Opsional (misal: BRI Simpedes / GoPay)"
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
            >
              Simpan Kantong
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
