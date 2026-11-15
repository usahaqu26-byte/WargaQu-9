import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  ShieldAlert,
  Lock,
  Unlock,
  BarChart3,
  SlidersHorizontal,
  QrCode,
  Smartphone,
  ShieldCheck,
  Upload,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  KeyRound,
  AlertTriangle,
  Headphones,
  Users,
} from 'lucide-react';
import { AuthService } from '../../services/authService';
import { RtSiagaStorage } from '../../services/rtSiagaStorage';
import { SiagaCircleService } from '../../services/siagaCircleService';
import {
  ZERO_TRUST_SYNC_EVENT,
  ZeroTrustService,
  ZeroTrustPolicy,
  DeviceTrustRecord,
  RecoveryRequest,
  ZeroTrustAuditEntry,
} from '../../services/zeroTrustService';
import {
  MONETIZATION_SYNC_EVENT,
  MonetizationService,
  ModuleMonetizationRule,
  DeveloperQrisConfig,
  MonetizationLedgerEntry,
  DeveloperSettlement,
  FeeMode,
} from '../../services/monetizationService';
import { SMART_CARE_SYNC_EVENT, SmartCareService } from '../../services/smartCareService';
import { SmartCareAdminTriagePanel } from '../bantuan/SmartCareAdminTriagePanel';
import {
  ACCOUNT_GOV_SYNC_EVENT,
  AccountGovernanceService,
} from '../../services/accountGovernanceService';
import { AccountGovernancePanel } from './AccountGovernancePanel';

interface AdminZeroTrustViewProps {
  onBack: () => void;
  showNotification: (msg: string) => void;
}

type AdminTab =
  | 'statistik'
  | 'akun_modul'
  | 'smart_care'
  | 'monetisasi'
  | 'qris_dev'
  | 'hp_hilang'
  | 'zero_trust';

export const AdminZeroTrustView: React.FC<AdminZeroTrustViewProps> = ({
  onBack,
  showNotification,
}) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() =>
    ZeroTrustService.isAdminSessionActive()
  );
  const [activeTab, setActiveTab] = useState<AdminTab>('statistik');

  // Challenge form state
  const currentAuth = AuthService.getAccount();
  const [policy, setPolicy] = useState<ZeroTrustPolicy>(() => ZeroTrustService.getPolicy());
  const [challengeEmail, setChallengeEmail] = useState<string>(
    currentAuth?.email || policy.adminEmail
  );
  const [challengePin, setChallengePin] = useState<string>('');
  const [challengeError, setChallengeError] = useState<string>('');

  // Synced states
  const [rules, setRules] = useState<ModuleMonetizationRule[]>(() => MonetizationService.getRules());
  const [qrisConfig, setQrisConfig] = useState<DeveloperQrisConfig>(() =>
    MonetizationService.getQrisConfig()
  );
  const [ledger, setLedger] = useState<MonetizationLedgerEntry[]>(() =>
    MonetizationService.getLedger()
  );
  const [settlements, setSettlements] = useState<DeveloperSettlement[]>(() =>
    MonetizationService.getSettlements()
  );
  const [devices, setDevices] = useState<DeviceTrustRecord[]>(() => ZeroTrustService.getDevices());
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequest[]>(() =>
    ZeroTrustService.getRecoveryRequests()
  );
  const [auditLogs, setAuditLogs] = useState<ZeroTrustAuditEntry[]>(() =>
    ZeroTrustService.getAuditLogs()
  );
  const [newSmartCareCount, setNewSmartCareCount] = useState<number>(
    () => SmartCareService.getLogs().filter(l => l.triageStatus === 'new').length
  );
  const [govTick, setGovTick] = useState<number>(0);

  // Local editing states
  const [settlementRefInput, setSettlementRefInput] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState<string>(policy.adminEmail);
  const [newAdminPin, setNewAdminPin] = useState<string>(policy.adminPin);
  const qrisFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refreshAll = () => {
      setIsUnlocked(ZeroTrustService.isAdminSessionActive());
      const latestPolicy = ZeroTrustService.getPolicy();
      setPolicy(latestPolicy);
      setRules(MonetizationService.getRules());
      setQrisConfig(MonetizationService.getQrisConfig());
      setLedger(MonetizationService.getLedger());
      setSettlements(MonetizationService.getSettlements());
      setDevices(ZeroTrustService.getDevices());
      setRecoveryRequests(ZeroTrustService.getRecoveryRequests());
      setAuditLogs(ZeroTrustService.getAuditLogs());
      setNewSmartCareCount(
        SmartCareService.getLogs().filter(l => l.triageStatus === 'new').length
      );
      setGovTick(t => t + 1);
    };
    window.addEventListener(ZERO_TRUST_SYNC_EVENT, refreshAll);
    window.addEventListener(MONETIZATION_SYNC_EVENT, refreshAll);
    window.addEventListener(SMART_CARE_SYNC_EVENT, refreshAll);
    window.addEventListener(ACCOUNT_GOV_SYNC_EVENT, refreshAll);
    return () => {
      window.removeEventListener(ZERO_TRUST_SYNC_EVENT, refreshAll);
      window.removeEventListener(MONETIZATION_SYNC_EVENT, refreshAll);
      window.removeEventListener(SMART_CARE_SYNC_EVENT, refreshAll);
      window.removeEventListener(ACCOUNT_GOV_SYNC_EVENT, refreshAll);
    };
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      AccountGovernanceService.fetchVolatileServerPresence().catch(() => {});
    }
  }, [isUnlocked]);

  const summary = useMemo(() => MonetizationService.getSummary(), [ledger, rules]);
  const rtMembers = useMemo(() => RtSiagaStorage.getMembers(), [isUnlocked]);
  const rtLogs = useMemo(() => RtSiagaStorage.getAuditLogs(), [isUnlocked]);
  const siagaCircles = useMemo(() => SiagaCircleService.getCircles(), [isUnlocked]);
  const knownAccounts = useMemo(
    () => AccountGovernanceService.getCombinedKnownAccounts(),
    [isUnlocked, govTick]
  );
  const moduleAccountStats = useMemo(
    () => AccountGovernanceService.getModuleAccountStats(),
    [knownAccounts]
  );

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = ZeroTrustService.verifyAdminAccess(challengeEmail, challengePin);
    if (!res.ok) {
      setChallengeError(res.message);
      return;
    }
    setChallengeError('');
    setChallengePin('');
    setIsUnlocked(true);
    showNotification('Panel Admin Zero Trust dibuka.');
  };

  const handleLockNow = () => {
    ZeroTrustService.lockAdminSession();
    setIsUnlocked(false);
    showNotification('Sesi Admin Zero Trust dikunci.');
  };

  const handleUploadQrisImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl) {
        const updated = MonetizationService.updateQrisConfig({ qrisImageDataUrl: dataUrl });
        setQrisConfig(updated);
        showNotification('Gambar QRIS Developer berhasil dipasang.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSettleDeveloper = () => {
    const settled = MonetizationService.settlePendingToDeveloper(settlementRefInput);
    if (!settled) {
      showNotification('Belum ada saldo akumulasi tertunda untuk disetor.');
      return;
    }
    setSettlementRefInput('');
    showNotification(
      `Setoran Rp ${settled.totalAmount.toLocaleString('id-ID')} dicatat (${settled.qrisReference}).`
    );
  };

  const handleExportStatistikCsv = () => {
    const rows = [
      ['ID', 'Tanggal', 'Modul', 'Aksi', 'Nominal Transaksi', 'Biaya Platform', 'Jenis Tarif', 'Email', 'Status'],
      ...ledger.map(item => [
        item.id,
        item.createdAt,
        `"${item.moduleName}"`,
        `"${item.actionLabel}"`,
        item.grossAmount,
        item.feeAmount,
        `"${item.feeTypeLabel}"`,
        item.userEmail,
        item.status,
      ]),
    ];
    const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WargaQu_Statistik_Monetisasi_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Laporan Statistik & Akumulasi (.csv) diunduh.');
  };

  // ===========================================================================
  // ZERO TRUST GATE SCREEN
  // ===========================================================================
  if (!isUnlocked) {
    return (
      <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
        <header className="px-4 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="w-10 h-10 -ml-1 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-300"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-white">Admin Zero Trust</h1>
              <p className="text-[11px] text-slate-400">Verifikasi berlapis sebelum akses sistem</p>
            </div>
          </div>
          <Lock className="w-4 h-4 text-amber-400" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 flex flex-col justify-center">
          <div className="border border-slate-800 bg-slate-900 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Verifikasi Identitas &amp; Perangkat</h2>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Hanya Super Admin terdaftar yang diizinkan membuka kontrol monetisasi, QRIS developer,
                  statistik, dan pemulihan HP hilang/rusak.
                </p>
              </div>
            </div>

            <form onSubmit={handleUnlockSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Email Super Admin</label>
                <input
                  type="email"
                  required
                  value={challengeEmail}
                  onChange={e => setChallengeEmail(e.target.value)}
                  placeholder="usahaqu2026@gmail.com"
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">PIN Zero Trust (6 Digit)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  value={challengePin}
                  onChange={e => setChallengePin(e.target.value)}
                  placeholder="Masukkan PIN Admin"
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl px-3 text-white font-mono tracking-widest focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  PIN bawaan demo: <span className="font-mono text-slate-300">202600</span> (ubah di tab Zero Trust).
                </p>
              </div>

              {challengeError && (
                <div className="p-2.5 rounded-lg border border-rose-800 bg-rose-950/60 text-rose-300 text-[11px]">
                  {challengeError}
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Verifikasi &amp; Buka Konsol</span>
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // ===========================================================================
  // AUTHENTICATED ADMIN ZERO TRUST CONSOLE
  // ===========================================================================
  const pendingRecoveryCount = recoveryRequests.filter(r => r.status === 'pending').length;
  const frozenDeviceCount = devices.filter(d => d.status === 'frozen_lost').length;
  const trustedDeviceCount = devices.filter(d => d.status === 'trusted').length;
  const maxBarValue = Math.max(1, ...summary.byModule.map(m => m.totalFee));

  return (
    <div className="w-full h-full bg-white text-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="w-10 h-10 -ml-1 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 shrink-0"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-slate-900 truncate">
              Admin Zero Trust &amp; Monetisasi
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              {policy.adminEmail} · Sesi otomatis terkunci {policy.autoLockMinutes} mnt
            </p>
          </div>
        </div>

        <button
          onClick={handleLockNow}
          className="min-h-[36px] px-2.5 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shrink-0 whitespace-nowrap"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Kunci</span>
        </button>
      </header>

      {/* Segmented Navigation Tabs */}
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
        {(
          [
            { id: 'statistik', label: 'Statistik', icon: BarChart3 },
            {
              id: 'akun_modul',
              label: `Akun & Akses (${knownAccounts.length})`,
              icon: Users,
            },
            {
              id: 'smart_care',
              label:
                newSmartCareCount > 0
                  ? `Smart Care (${newSmartCareCount})`
                  : 'Smart Care',
              icon: Headphones,
            },
            { id: 'monetisasi', label: 'Monetisasi', icon: SlidersHorizontal },
            { id: 'qris_dev', label: 'QRIS Dev', icon: QrCode },
            {
              id: 'hp_hilang',
              label:
                pendingRecoveryCount > 0
                  ? `HP Hilang (${pendingRecoveryCount})`
                  : 'HP Hilang',
              icon: Smartphone,
            },
            { id: 'zero_trust', label: 'Zero Trust', icon: ShieldCheck },
          ] as Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }>
        ).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto divide-y divide-slate-200">
        {/* ===================================================================== */}
        {/* TAB 1: STATISTIK                                                      */}
        {/* ===================================================================== */}
        {activeTab === 'statistik' && (
          <div className="divide-y divide-slate-200">
            <section className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-extrabold text-slate-900">Ringkasan Pendapatan &amp; Sistem</h2>
                  <p className="text-[11px] text-slate-500">Data langsung dari transaksi &amp; perangkat aktif</p>
                </div>
                <button
                  onClick={handleExportStatistikCsv}
                  className="min-h-[34px] px-2.5 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="border border-slate-200 rounded-xl p-3">
                  <div className="text-[11px] text-slate-500">Akumulasi Belum Setor</div>
                  <div className="text-base font-extrabold text-amber-700 font-mono tabular-nums mt-0.5">
                    Rp {summary.pendingTotal.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {summary.pendingCount} transaksi tertunda
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3">
                  <div className="text-[11px] text-slate-500">Total Sudah Disetor</div>
                  <div className="text-base font-extrabold text-emerald-700 font-mono tabular-nums mt-0.5">
                    Rp {summary.settledTotal.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {settlements.length} kali transfer QRIS
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3">
                  <div className="text-[11px] text-slate-500">Perputaran Bruto Warga</div>
                  <div className="text-sm font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                    Rp {summary.grossTotal.toLocaleString('id-ID')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {summary.totalCount} total log biaya
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3">
                  <div className="text-[11px] text-slate-500">Keamanan &amp; Warga</div>
                  <div className="text-sm font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                    {trustedDeviceCount} Aman / {frozenDeviceCount} Beku
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                    {rtMembers.length} warga · {siagaCircles.length} circle · {rtLogs.length} log RT
                  </div>
                </div>
              </div>
            </section>

            {/* Per-Module Active/Registered Account Summary */}
            <section className="p-4 space-y-2.5 bg-slate-50/50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">
                    Akun Terdaftar / Aktif Per Modul
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {knownAccounts.length} akun terpantau ·{' '}
                    {knownAccounts.filter(a => a.isOnlineNow).length} live online
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('akun_modul')}
                  className="min-h-[30px] px-2.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold shrink-0"
                >
                  Atur Free / Warning / Ban →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {moduleAccountStats.map(st => (
                  <div
                    key={st.moduleId}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between gap-1.5"
                  >
                    <span className="text-[11px] font-bold text-slate-800 truncate">
                      {st.label}
                    </span>
                    <span className="text-[11px] font-extrabold font-mono text-emerald-700 shrink-0">
                      {st.registeredCount}
                      {st.onlineNowCount > 0 ? ` (${st.onlineNowCount} live)` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Per-Module Breakdown Chart */}
            <section className="p-4 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-900">
                Akumulasi &amp; Kontribusi Per Modul
              </h3>

              <div className="space-y-3">
                {summary.byModule.map(mod => {
                  const pctWidth = Math.round((mod.totalFee / maxBarValue) * 100);
                  return (
                    <div key={mod.moduleId} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800 truncate pr-2">
                          {mod.moduleName}
                        </span>
                        <span className="font-mono tabular-nums font-bold text-slate-900 shrink-0">
                          Rp {mod.totalFee.toLocaleString('id-ID')} ({mod.count}×)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            mod.enabled ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                          style={{ width: `${Math.max(mod.totalFee > 0 ? 6 : 0, pctWidth)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono tabular-nums">
                        <span>Status: {mod.enabled ? 'ON' : 'OFF'}</span>
                        <span>
                          Pending Rp {mod.pending.toLocaleString('id-ID')} · Cair Rp{' '}
                          {mod.settled.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Recent Ledger */}
            <section className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-600">
                Riwayat Biaya Masuk Terbaru
              </div>
              {ledger.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">
                  Belum ada transaksi monetisasi. Aktifkan tarif di tab Monetisasi lalu coba sewa lapak
                  AreaQu, cetak LeluhurQu, bayar iuran RTQu, atau checkout MuamalahQu.
                </div>
              ) : (
                ledger.slice(0, 10).map(item => (
                  <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {item.actionLabel}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.moduleName} · {item.userEmail}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold font-mono tabular-nums text-emerald-700">
                        +Rp {item.feeAmount.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.status === 'settled' ? 'Sudah Setor' : 'Akumulasi'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: MONETISASI MODULAR ON/OFF                                      */}
        {/* ===================================================================== */}
        {activeTab === 'monetisasi' && (
          <div className="divide-y divide-slate-200">
            <div className="p-4 bg-slate-50 text-[11px] text-slate-600 leading-relaxed space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-slate-900">
                  Status Global:{' '}
                  {MonetizationService.isAnyRuleEnabled() ? (
                    <span className="text-emerald-700">AKTIF (Tampil di Modul Terpilih)</span>
                  ) : (
                    <span className="text-slate-600">HIDDEN / NONAKTIF (Tersembunyi dari Semua User)</span>
                  )}
                </span>
              </div>
              <div>
                Aktifkan atau matikan monetisasi per modul secara independen. Saat OFF, semua
                biaya &amp; popup monetisasi otomatis disembunyikan dari warga. Tarif flat berkisar antara{' '}
                <span className="font-bold text-slate-900 font-mono">Rp 2.000 – Rp 30.000</span> atau{' '}
                <span className="font-bold text-slate-900">1% akumulasi transaksi</span>.
              </div>
              <div className="font-semibold text-emerald-800">
                Kebijakan Keselamatan: SiagaQu Darurat Nyawa (Umum RT 500m–3km, Cari HP Hilang &amp;
                Keluarga) dikecualikan &amp; selalu GRATIS permanen.
              </div>
            </div>

            {rules.map(rule => (
              <section key={rule.moduleId} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-900">{rule.moduleName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{rule.description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      MonetizationService.updateRule(rule.moduleId, { enabled: !rule.enabled });
                      showNotification(
                        `${rule.moduleName} di-${!rule.enabled ? 'AKTIFKAN' : 'NONAKTIFKAN'}`
                      );
                    }}
                    className={`min-h-[34px] px-3 rounded-lg text-[11px] font-extrabold shrink-0 transition ${
                      rule.enabled
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {rule.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Mode selector */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'flat', label: 'Flat Rp 2rb-30rb' },
                      { id: 'percent_1', label: '1% Akumulasi' },
                      { id: 'hybrid', label: 'Flat + 1%' },
                    ] as Array<{ id: FeeMode; label: string }>
                  ).map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => MonetizationService.updateRule(rule.moduleId, { feeMode: mode.id })}
                      className={`py-2 px-2 rounded-lg text-[11px] font-bold border transition ${
                        rule.feeMode === mode.id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Flat fee slider (2.000 - 30.000) */}
                {(rule.feeMode === 'flat' || rule.feeMode === 'hybrid') && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-semibold">Tarif Modular</span>
                      <span className="font-mono tabular-nums font-extrabold text-emerald-700">
                        Rp {rule.flatFee.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2000}
                      max={30000}
                      step={500}
                      value={rule.flatFee}
                      onChange={e =>
                        MonetizationService.updateRule(rule.moduleId, {
                          flatFee: Number(e.target.value),
                        })
                      }
                      className="w-full accent-emerald-700"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Rp 2.000</span>
                      <span>Rp 15.000</span>
                      <span>Rp 30.000</span>
                    </div>
                  </div>
                )}

                {(rule.moduleId === 'areaqu_lapak' || rule.moduleId === 'leluhurqu_export') && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                    <span>
                      Status Akses Akun Ini:{' '}
                      <strong className="text-slate-800">
                        {MonetizationService.hasActiveUnlock(rule.moduleId)
                          ? 'Terbuka'
                          : 'Terkunci (Butuh Bayar)'}
                      </strong>
                    </span>
                    {MonetizationService.hasActiveUnlock(rule.moduleId) && rule.enabled && (
                      <button
                        type="button"
                        onClick={() => {
                          MonetizationService.revokeUnlock(rule.moduleId);
                          showNotification('Simulasi kunci modul direset untuk uji bayar.');
                        }}
                        className="text-amber-700 font-bold hover:underline"
                      >
                        Reset Kunci Uji
                      </button>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: TF QRCODE DEVELOPER & AKUMULASI                                */}
        {/* ===================================================================== */}
        {activeTab === 'qris_dev' && (
          <div className="divide-y divide-slate-200">
            <section className="p-4 space-y-3">
              <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500">
                    Saldo Akumulasi Siap Setor (Developer)
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Min. Rp {qrisConfig.minSettlementAmount.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-700">
                  Rp {summary.pendingTotal.toLocaleString('id-ID')}
                </div>
                <p className="text-[11px] text-slate-500">
                  {summary.pendingTotal >= qrisConfig.minSettlementAmount
                    ? 'Sudah melewati ambang minimum settlement dan siap ditransfer ke QRIS Developer.'
                    : 'Akumulasi biaya 1% & flat modular otomatis dikumpulkan hingga siap transfer kolektif.'}
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <label className="font-bold text-slate-700 block">Referensi / Bukti TF QRIS Developer</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settlementRefInput}
                    onChange={e => setSettlementRefInput(e.target.value)}
                    placeholder="Contoh: RRN-QRIS-992817"
                    className="flex-1 min-h-[42px] border border-slate-300 rounded-xl px-3 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSettleDeveloper}
                    className="min-h-[42px] px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shrink-0"
                  >
                    Catat Setor
                  </button>
                </div>
              </div>
            </section>

            {/* Upload / Konfigurasi QRIS Developer */}
            <section className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900">QRCode Developer (Menyusul / Resmi)</h3>
                  <p className="text-[11px] text-slate-500">
                    Pasang gambar QRIS resmi Anda saat sudah terbit dari bank/payment gateway.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => qrisFileInputRef.current?.click()}
                  className="min-h-[36px] px-3 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload QR</span>
                </button>
                <input
                  ref={qrisFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadQrisImage}
                  className="hidden"
                />
              </div>

              <div className="border border-slate-200 rounded-xl p-4 text-center space-y-2">
                {qrisConfig.qrisImageDataUrl ? (
                  <div className="space-y-2">
                    <img
                      src={qrisConfig.qrisImageDataUrl}
                      alt="QRIS Developer"
                      referrerPolicy="no-referrer"
                      className="w-44 h-44 object-contain mx-auto border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => MonetizationService.updateQrisConfig({ qrisImageDataUrl: '' })}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Hapus &amp; Kembalikan ke Mode Menyusul
                    </button>
                  </div>
                ) : (
                  <div className="py-2 space-y-1.5">
                    <QrCode className="w-20 h-20 text-slate-800 mx-auto" />
                    <div className="text-xs font-bold text-amber-700">
                      Status: QRCode Developer Menyusul
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Sistem tetap menghitung akumulasi 1% dan tarif modular ke saldo siap setor di atas.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nama Merchant Developer</label>
                  <input
                    type="text"
                    value={qrisConfig.merchantName}
                    onChange={e =>
                      MonetizationService.updateQrisConfig({ merchantName: e.target.value })
                    }
                    className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">NMID / ID Merchant</label>
                    <input
                      type="text"
                      value={qrisConfig.nmid}
                      onChange={e => MonetizationService.updateQrisConfig({ nmid: e.target.value })}
                      className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Min. Setor (Rp)</label>
                    <input
                      type="number"
                      min={2000}
                      step={5000}
                      value={qrisConfig.minSettlementAmount}
                      onChange={e =>
                        MonetizationService.updateQrisConfig({
                          minSettlementAmount: Math.max(2000, Number(e.target.value) || 2000),
                        })
                      }
                      className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3 font-mono"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Settlement History */}
            <section className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-600">
                Riwayat Penyetoran QRIS Developer ({settlements.length})
              </div>
              {settlements.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">Belum ada riwayat settlement QRIS.</div>
              ) : (
                settlements.map(s => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{s.qrisReference}</div>
                      <div className="text-[11px] text-slate-500">
                        {s.destinationName} · {s.entriesCount} transaksi ·{' '}
                        {new Date(s.settledAt).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                    <div className="text-xs font-extrabold font-mono tabular-nums text-emerald-700">
                      Rp {s.totalAmount.toLocaleString('id-ID')}
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: SOLUSI HP HILANG / RUSAK                                       */}
        {/* ===================================================================== */}
        {activeTab === 'hp_hilang' && (
          <div className="divide-y divide-slate-200">
            {/* Antrian Permintaan Pemulihan Tanpa Kode */}
            <section className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">
                  Permohonan Pemulihan HP Hilang / Rusak ({recoveryRequests.length})
                </span>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              </div>

              {recoveryRequests.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 leading-relaxed">
                  Belum ada pengajuan pemulihan perangkat. Warga yang HP-nya rusak/hilang tanpa sempat
                  menyimpan Kode Pemulihan akan muncul di sini untuk disetujui Admin Zero Trust &amp; Wali.
                </div>
              ) : (
                recoveryRequests.map(req => (
                  <div key={req.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">
                          {req.email} · {req.phone}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Alasan: {req.reason === 'hp_hilang' ? 'HP Hilang / Dicuri' : 'HP Rusak Total'} ·
                          Perangkat Baru: <span className="font-mono">{req.newDeviceMask}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Wali Terpercaya: <span className="font-semibold">{req.guardianContact || '-'}</span>
                        </div>
                        {req.note && (
                          <div className="text-[11px] text-slate-500 mt-0.5">Catatan: {req.note}</div>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-bold shrink-0 ${
                          req.status === 'approved'
                            ? 'text-emerald-700'
                            : req.status === 'rejected'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {req.status === 'approved'
                          ? 'Disetujui'
                          : req.status === 'rejected'
                          ? 'Ditolak'
                          : 'Menunggu'}
                      </span>
                    </div>

                    {req.status === 'pending' && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            ZeroTrustService.resolveRecoveryRequest(req.id, true);
                            showNotification('Pemulihan disetujui & perangkat lama dibekukan.');
                          }}
                          className="min-h-[38px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Setujui &amp; Migrasi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            ZeroTrustService.resolveRecoveryRequest(req.id, false);
                            showNotification('Permohonan pemulihan ditolak.');
                          }}
                          className="min-h-[38px] border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg font-bold flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            {/* Daftar Perangkat Terdaftar (Device Trust Registry) */}
            <section className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-700">
                Daftar Perangkat Terikat ({devices.length})
              </div>

              {devices.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">Belum ada perangkat tercatat.</div>
              ) : (
                devices.map(dev => (
                  <div key={dev.deviceId} className="p-4 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">
                          {dev.email || 'Tanpa Email'} · {dev.phone || '-'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {dev.maskedFingerprint} · {dev.label}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-bold shrink-0 ${
                          dev.status === 'trusted'
                            ? 'text-emerald-700'
                            : dev.status === 'frozen_lost'
                            ? 'text-rose-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {dev.status === 'trusted'
                          ? 'Terpercaya'
                          : dev.status === 'frozen_lost'
                          ? 'Beku (Hilang)'
                          : 'Pensiun (Rusak)'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {dev.status !== 'frozen_lost' && (
                        <button
                          type="button"
                          onClick={() => {
                            ZeroTrustService.setDeviceStatus(
                              dev.deviceId,
                              'frozen_lost',
                              'Dibekukan Admin Zero Trust'
                            );
                            showNotification(`Perangkat ${dev.maskedFingerprint} dibekukan.`);
                          }}
                          className="min-h-[34px] px-3 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-bold"
                        >
                          Bekukan (HP Hilang)
                        </button>
                      )}
                      {dev.status !== 'retired_broken' && (
                        <button
                          type="button"
                          onClick={() => {
                            ZeroTrustService.setDeviceStatus(
                              dev.deviceId,
                              'retired_broken',
                              'Dinonaktifkan (HP Rusak)'
                            );
                            showNotification(`Perangkat ${dev.maskedFingerprint} ditandai rusak.`);
                          }}
                          className="min-h-[34px] px-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-[11px] font-bold"
                        >
                          Tandai Rusak
                        </button>
                      )}
                      {dev.status !== 'trusted' && (
                        <button
                          type="button"
                          onClick={() => {
                            ZeroTrustService.setDeviceStatus(
                              dev.deviceId,
                              'trusted',
                              'Dipulihkan Admin Zero Trust'
                            );
                            showNotification(`Perangkat ${dev.maskedFingerprint} diaktifkan lagi.`);
                          }}
                          className="min-h-[34px] px-3 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg text-[11px] font-bold flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Aktifkan Lagi</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: KEBIJAKAN ZERO TRUST & AUDIT LOG                               */}
        {/* ===================================================================== */}
        {activeTab === 'zero_trust' && (
          <div className="divide-y divide-slate-200">
            <section className="p-4 space-y-3 text-xs">
              <h3 className="font-extrabold text-slate-900">Kebijakan Zero Trust</h3>

              {[
                {
                  key: 'strictDeviceBinding' as const,
                  title: 'Pengikatan Perangkat Ketat (Device Binding)',
                  desc: 'Setiap akun diikat ke hidden device token; perangkat dibekukan otomatis tertolak.',
                },
                {
                  key: 'requireGuardianForBrokenPhone' as const,
                  title: 'Wajib Wali / Admin untuk Pemulihan Tanpa Kode',
                  desc: 'Pemulihan HP rusak tanpa kode cadangan wajib verifikasi Wali + Admin Zero Trust.',
                },
                {
                  key: 'blockUnknownDeviceActions' as const,
                  title: 'Blokir Aksi Sensitif pada Perangkat Tidak Dikenal',
                  desc: 'Mencegah penyalahgunaan SiagaQu Umum & setoran QRIS dari sesi tak dikenal.',
                },
              ].map(item => (
                <div key={item.key} className="flex items-start justify-between gap-3 py-1">
                  <div>
                    <div className="font-bold text-slate-900">{item.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      ZeroTrustService.updatePolicy({ [item.key]: !policy[item.key] })
                    }
                    className={`min-h-[32px] px-3 rounded-lg text-[11px] font-bold shrink-0 ${
                      policy[item.key]
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {policy[item.key] ? 'ON' : 'OFF'}
                  </button>
                </div>
              ))}

              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                  <span>Kredensial Super Admin Zero Trust</span>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Super Admin</label>
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={e => setNewAdminEmail(e.target.value)}
                    className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">PIN Zero Trust</label>
                    <input
                      type="text"
                      value={newAdminPin}
                      onChange={e => setNewAdminPin(e.target.value)}
                      className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Auto-Lock (Menit)</label>
                    <select
                      value={policy.autoLockMinutes}
                      onChange={e =>
                        ZeroTrustService.updatePolicy({
                          autoLockMinutes: Number(e.target.value) || 15,
                        })
                      }
                      className="w-full min-h-[40px] border border-slate-300 rounded-xl px-2.5"
                    >
                      <option value={5}>5 menit</option>
                      <option value={15}>15 menit</option>
                      <option value={30}>30 menit</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newAdminEmail.includes('@') || newAdminPin.trim().length < 4) {
                      showNotification('Email harus valid dan PIN minimal 4 karakter.');
                      return;
                    }
                    ZeroTrustService.updatePolicy({
                      adminEmail: newAdminEmail.trim().toLowerCase(),
                      adminPin: newAdminPin.trim(),
                    });
                    showNotification('Kredensial Super Admin Zero Trust diperbarui.');
                  }}
                  className="w-full min-h-[42px] bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold"
                >
                  Simpan Kredensial Admin
                </button>
              </div>
            </section>

            {/* Audit Log */}
            <section className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-600">
                Log Audit Keamanan Zero Trust ({auditLogs.length})
              </div>
              {auditLogs.length === 0 ? (
                <div className="p-4 text-xs text-slate-500">Belum ada aktivitas keamanan tercatat.</div>
              ) : (
                auditLogs.slice(0, 20).map(log => (
                  <div key={log.id} className="px-4 py-3 text-xs space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{log.action}</span>
                      <span
                        className={`text-[10px] font-bold ${
                          log.severity === 'critical'
                            ? 'text-rose-700'
                            : log.severity === 'warning'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">{log.detail}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {log.actor} · {log.deviceMask}
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {/* TAB: AKUN & AKSES MODULAR (FREE / WARNING / BANNED & KOMUNITAS) */}
        {activeTab === 'akun_modul' && (
          <AccountGovernancePanel showNotification={showNotification} />
        )}

        {/* TAB: SMART CARE LOG & PROMPT TRIAGE */}
        {activeTab === 'smart_care' && (
          <div className="p-4">
            <SmartCareAdminTriagePanel showNotification={showNotification} lightTheme />
          </div>
        )}
      </main>
    </div>
  );
};
