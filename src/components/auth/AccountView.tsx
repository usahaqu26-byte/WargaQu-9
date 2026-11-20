import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  ChevronRight,
  KeyRound,
  Copy,
  RefreshCw,
  ShieldAlert,
  Lock,
  Smartphone,
  Cloud,
  Monitor,
  FileText,
  Copyright,
} from 'lucide-react';
import { AUTH_SYNC_EVENT, AuthAccount, AuthService } from '../../services/authService';
import { RT_SYNC_EVENT, RtSiagaStorage, WargaMember } from '../../services/rtSiagaStorage';
import { ZERO_TRUST_SYNC_EVENT, ZeroTrustService } from '../../services/zeroTrustService';
import {
  FIREBASE_AUTH_SYNC_EVENT,
  FirebaseSyncService,
} from '../../services/firebaseSyncService';
import { EncryptedBackupPanel } from '../common/EncryptedBackupPanel';
import { AutoBackupResetPanel } from '../common/AutoBackupResetPanel';
import { LegalNoticeModal, LegalTab } from '../common/LegalNoticeModal';
import { LinkedDevicesSection } from './DevicePairingPanel';
import { DevicePairingService } from '../../services/devicePairingService';
import {
  DesktopViewportMode,
  VIEWPORT_MODE_SYNC_EVENT,
  ViewportLayoutService,
} from '../../services/viewportLayoutService';

interface AccountViewProps {
  onBack: () => void;
  onOpenRtQu: () => void;
  onOpenSiagaQu: () => void;
  onOpenAdminZeroTrust: () => void;
  showNotification: (msg: string) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  onBack,
  onOpenRtQu,
  onOpenSiagaQu,
  onOpenAdminZeroTrust,
  showNotification,
}) => {
  const [account, setAccount] = useState<AuthAccount | null>(() => AuthService.getAccount());
  const [rtMember, setRtMember] = useState<WargaMember>(() => RtSiagaStorage.getCurrentMember());
  const isAdminAccount = ZeroTrustService.isAdminEmail(account?.email);

  const [emailInput, setEmailInput] = useState<string>(account?.email || '');
  const [phoneInput, setPhoneInput] = useState<string>(account?.phone || '');
  const [isFrozen, setIsFrozen] = useState<boolean>(() => ZeroTrustService.isCurrentDeviceFrozen());
  const [recoveryCfg, setRecoveryCfg] = useState<{ code: string; guardianContact: string }>(() =>
    account
      ? ZeroTrustService.getRecoveryConfig(account.email)
      : { code: '', guardianContact: '' }
  );
  const [guardianInput, setGuardianInput] = useState<string>(recoveryCfg.guardianContact || '');
  const [cloudEmail, setCloudEmail] = useState<string>(
    () => FirebaseSyncService.getCurrentUser()?.email || ''
  );
  const [cloudConnecting, setCloudConnecting] = useState<boolean>(false);
  const [pendingPairToken, setPendingPairToken] = useState<string>(() =>
    DevicePairingService.getPendingPairToken()
  );
  const [viewportMode, setViewportMode] = useState<DesktopViewportMode>(() =>
    ViewportLayoutService.getMode()
  );
  const [legalModal, setLegalModal] = useState<{ open: boolean; tab: LegalTab }>({
    open: false,
    tab: 'privasi',
  });

  useEffect(() => {
    const sync = () => {
      const acc = AuthService.getAccount();
      setAccount(acc);
      setRtMember(RtSiagaStorage.getCurrentMember());
      setIsFrozen(ZeroTrustService.isCurrentDeviceFrozen());
      setCloudEmail(FirebaseSyncService.getCurrentUser()?.email || '');
      if (acc) {
        setEmailInput(acc.email);
        setPhoneInput(acc.phone);
        const cfg = ZeroTrustService.getRecoveryConfig(acc.email);
        setRecoveryCfg(cfg);
        setGuardianInput(cfg.guardianContact || '');
      }
    };
    const onPairArrived = () => {
      setPendingPairToken(DevicePairingService.getPendingPairToken());
    };
    const onViewportSync = () => {
      setViewportMode(ViewportLayoutService.getMode());
    };
    window.addEventListener(AUTH_SYNC_EVENT, sync);
    window.addEventListener(RT_SYNC_EVENT, sync);
    window.addEventListener(ZERO_TRUST_SYNC_EVENT, sync);
    window.addEventListener(FIREBASE_AUTH_SYNC_EVENT, sync);
    window.addEventListener('wargaqu-pair-invite-arrived', onPairArrived);
    window.addEventListener(VIEWPORT_MODE_SYNC_EVENT, onViewportSync);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, sync);
      window.removeEventListener(RT_SYNC_EVENT, sync);
      window.removeEventListener(ZERO_TRUST_SYNC_EVENT, sync);
      window.removeEventListener(FIREBASE_AUTH_SYNC_EVENT, sync);
      window.removeEventListener('wargaqu-pair-invite-arrived', onPairArrived);
      window.removeEventListener(VIEWPORT_MODE_SYNC_EVENT, onViewportSync);
    };
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFrozen) {
      showNotification('Perangkat ini sedang dibekukan. Hubungi Admin Zero Trust.');
      return;
    }
    if (!emailInput.trim().includes('@')) {
      showNotification('Masukkan alamat Email yang valid.');
      return;
    }
    if (phoneInput.replace(/\D/g, '').length < 8) {
      showNotification('Masukkan No. HP / WhatsApp minimal 8 digit.');
      return;
    }
    const saved = AuthService.login(emailInput, phoneInput);
    RtSiagaStorage.syncAuthAccount(saved);
    ZeroTrustService.registerOrTouchCurrentDevice(saved.email, saved.phone);
    if (FirebaseSyncService.isCloudSignedIn()) {
      void FirebaseSyncService.syncMyAccountRegistry('akun', true);
    }
    showNotification('Akun utama diperbarui & disinkronkan ke seluruh modul.');
  };

  const handleConnectGoogleCloud = async () => {
    setCloudConnecting(true);
    try {
      const user = await FirebaseSyncService.signInWithGoogle(phoneInput);
      setCloudEmail(user.email || '');
      showNotification(`Cloud Firebase terhubung (${user.email}).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        showNotification('Gagal menghubungkan akun Google Cloud.');
      }
    } finally {
      setCloudConnecting(false);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    void FirebaseSyncService.signOutCloud().catch(() => {});
    setEmailInput('');
    setPhoneInput('');
    setCloudEmail('');
    showNotification('Anda telah keluar dari akun.');
  };

  const handleCopyRecoveryCode = async () => {
    if (!recoveryCfg.code) return;
    try {
      await navigator.clipboard.writeText(recoveryCfg.code);
      showNotification('Kode Pemulihan disalin! Simpan di tempat aman selain HP ini.');
    } catch {
      showNotification(`Kode Pemulihan Anda: ${recoveryCfg.code}`);
    }
  };

  const handleSaveGuardian = () => {
    if (!account) return;
    ZeroTrustService.setGuardianContact(account.email, guardianInput);
    showNotification('Kontak Wali Terpercaya disimpan untuk pemulihan HP rusak.');
  };

  const handleFreezeLostPhone = () => {
    if (!account) return;
    const lockedCount = ZeroTrustService.freezeAccountDevicesAsLost(
      account.email,
      'Pengguna mengaktifkan Mode Darurat HP Hilang'
    );
    showNotification(
      `${lockedCount} perangkat dibekukan (Remote Lock Zero Trust aktif).`
    );
  };

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden text-slate-800">
      <header className="bg-white border-b border-slate-200 px-4 lg:px-6 pt-4 pb-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="w-10 h-10 -ml-1 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-extrabold text-slate-900">Akun &amp; Pengaturan</h1>
              <p className="text-[11px] text-slate-500">
                Identitas tunggal Email, No HP &amp; Tautan Laptop/PC
              </p>
            </div>
          </div>

          {account && (
            <button
              onClick={handleLogout}
              className="min-h-[36px] px-2.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-bold flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto divide-y divide-slate-200 lg:divide-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:p-6">
          <div className="divide-y divide-slate-200 lg:border lg:border-slate-200 lg:rounded-2xl lg:overflow-hidden lg:bg-white lg:self-start">
        {/* Form Login / Edit Akun */}
        <section className="p-4 space-y-3">
          {isFrozen && (
            <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-[11px] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Perangkat ini sedang dibekukan oleh kebijakan keamanan (status HP Hilang).{' '}
                {isAdminAccount
                  ? 'Buka lewat Panel Admin Zero Trust jika ini perangkat sah Anda.'
                  : 'Hubungi pengurus komunitas atau dukungan warga jika ini perangkat sah Anda.'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900">
              {account ? `Masuk sebagai ${AuthService.getDisplayName(account)}` : 'Belum Masuk Akun'}
            </span>
            <span
              className={`text-[11px] font-bold ${
                account ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {account ? 'Terhubung' : 'Mode Tamu'}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full min-h-[42px] border border-slate-300 rounded-xl pl-9 pr-3"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">No. HP / WhatsApp</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  placeholder="0812-3456-7890"
                  className="w-full min-h-[42px] border border-slate-300 rounded-xl pl-9 pr-3 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold"
            >
              {account ? 'Simpan & Sinkronkan Modul' : 'Masuk Sekarang'}
            </button>
          </form>

          {/* Hybrid Cloud Sync Strip */}
          <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-start gap-2 min-w-0">
              <Cloud
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  cloudEmail ? 'text-emerald-700' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">
                  {cloudEmail ? `Cloud Aktif: ${cloudEmail}` : 'Sinkronisasi Cloud Firebase'}
                </div>
                <div className="text-[10px] text-slate-500">
                  {cloudEmail
                    ? 'Metadata akun & status akses tersimpan ringan di Firestore.'
                    : 'Hubungkan Google agar status akun & akses lintas perangkat tersinkron.'}
                </div>
              </div>
            </div>
            {!cloudEmail && (
              <button
                type="button"
                onClick={handleConnectGoogleCloud}
                disabled={cloudConnecting}
                className="min-h-[34px] px-2.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-800 shrink-0 disabled:opacity-60"
              >
                {cloudConnecting ? '...' : 'Hubungkan'}
              </button>
            )}
          </div>
        </section>

        {/* Keamanan & Solusi HP Hilang / Rusak */}
        {account && (
          <section className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-700" />
                <span className="font-extrabold text-slate-900">
                  Perlindungan HP Hilang / Rusak
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700">Zero Trust Aktif</span>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Kode Pemulihan (Simpan di Luar HP)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextCode = ZeroTrustService.regenerateRecoveryCode(account.email);
                    setRecoveryCfg(prev => ({ ...prev, code: nextCode }));
                    showNotification('Kode Pemulihan baru dibuat.');
                  }}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rotasi</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-extrabold tracking-wider text-slate-900">
                  {recoveryCfg.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyRecoveryCode}
                  className="min-h-[34px] px-2.5 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Wali Terpercaya (Jika HP Rusak Total &amp; Lupa Kode)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guardianInput}
                  onChange={e => setGuardianInput(e.target.value)}
                  placeholder="Email / No HP Pasangan atau Pengurus RT"
                  className="flex-1 min-h-[40px] border border-slate-300 rounded-xl px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveGuardian}
                  className="min-h-[40px] px-3 border border-slate-300 rounded-xl font-bold text-slate-800 hover:bg-slate-50 shrink-0"
                >
                  Simpan
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFreezeLostPhone}
              className="w-full min-h-[40px] border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Mode Darurat: Bekukan Perangkat Ini (HP Hilang)</span>
            </button>
          </section>
        )}

        {/* Buka di Laptop / PC via Barcode QR (WhatsApp Web Style) */}
        <LinkedDevicesSection
          showNotification={showNotification}
          initialPendingPairToken={pendingPairToken}
        />

        {/* Preferensi Tampilan Layar Laptop / PC */}
        <section className="p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-700" />
              <span className="font-extrabold text-slate-900">
                Tampilan Layar di Laptop / PC
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Responsif</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'auto', label: 'Otomatis' },
                { id: 'desktop', label: 'Layar Lebar' },
                { id: 'mobile', label: 'Bingkai HP' },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  ViewportLayoutService.setMode(opt.id);
                  setViewportMode(opt.id);
                  showNotification(`Mode tampilan diatur: ${opt.label}`);
                }}
                className={`min-h-[36px] rounded-lg font-bold text-[11px] transition ${
                  viewportMode === opt.id
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Otomatis melebar di monitor Laptop/PC agar Kanvas LeluhurQu, RtQu &amp; UsahaQu lebih
            lega, dan tetap ringkas saat dibuka di HP.
          </p>
        </section>
        </div>

        <div className="divide-y divide-slate-200 lg:border lg:border-slate-200 lg:rounded-2xl lg:overflow-hidden lg:bg-white lg:self-start">
        {/* Auto-Backup HP & Google Drive (Sistem Timpa) + Safe Reset */}
        <section className="p-4 space-y-3 bg-slate-50/40">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Auto-Backup, Restore &amp; Reset Aman
          </div>
          <AutoBackupResetPanel showNotification={showNotification} />
          <EncryptedBackupPanel
            scope="all"
            title="Ekspor / Pulihkan Manual File Terenkripsi (.wqbak)"
            description="Opsi manual: enkripsi seluruh data WargaQu dengan kata sandi untuk disimpan ke perangkat atau dipulihkan manual kapan saja."
            showNotification={showNotification}
          />
        </section>

        {/* Panel Admin Zero Trust — Hanya tampil pada akun Admin */}
        {isAdminAccount && (
          <section className="divide-y divide-slate-200">
            <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Konsol Developer &amp; Keamanan
            </div>
            <button
              onClick={onOpenAdminZeroTrust}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <ShieldAlert className="w-4 h-4 mt-0.5 text-slate-900 shrink-0" />
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Panel Admin Zero Trust
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Kontrol Keamanan Perangkat, Akses Akun, Smart Care &amp; Pemulihan HP
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </section>
        )}

        {/* Status SiagaQu & Otoritas RTQu */}
        <section className="divide-y divide-slate-200">
          <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Status Integrasi Modul
          </div>

          <button
            onClick={onOpenRtQu}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldCheck
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  rtMember.siagaStatus === 'active' ? 'text-emerald-700' : 'text-amber-600'
                }`}
              />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  SiagaQu Umum (Radius 500m – 3km)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {rtMember.siagaStatus === 'active'
                    ? `Teraktivasi oleh RT (${rtMember.siagaVerifiedBy || 'Pengurus'})`
                    : 'Wajib aktivasi pengurus di RTQu agar sinyal warga umum tidak disalahgunakan'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            onClick={onOpenSiagaQu}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <CheckCircle2
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  account ? 'text-emerald-700' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  SiagaQu Pribadi &amp; Komunitas Terundang
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {account
                    ? 'Aktif (Cari HP Hilang, Keluarga & Perusahaan via Invite)'
                    : 'Masuk Email & No HP untuk mengaktifkan pelacakan & komunitas pribadi'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {[
            { name: 'AreaQu', desc: 'Identitas pedagang & konsumen otomatis dari Email & No HP' },
            { name: 'MuamalahQu & UsahaQu', desc: 'Profil pemilik & kontak toko tersinkron' },
            { name: 'LeluhurQu, ChatQu & Bantuan', desc: 'Identitas pengirim, silsilah & tiket tersambung' },
          ].map(mod => (
            <div key={mod.name} className="px-4 py-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-900">{mod.name}</div>
                <div className="text-[11px] text-slate-500">{mod.desc}</div>
              </div>
              <span
                className={`text-[11px] font-bold shrink-0 ${
                  account ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {account ? 'Sinkron' : 'Menunggu Login'}
              </span>
            </div>
          ))}
        </section>

        {/* TENTANG APLIKASI, PRIVASI & HAK CIPTA */}
        <section className="divide-y divide-slate-200 border-t border-slate-200">
          <div className="px-4 py-3 flex items-center justify-between gap-2 bg-slate-50/70">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Tentang Aplikasi, Privasi &amp; Hak Cipta
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Kebijakan privasi, disclaimer darurat SiagaQu &amp; status rilis WargaQu v1.5.7
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 shrink-0">v1.5.7</span>
          </div>

          <button
            type="button"
            onClick={() => setLegalModal({ open: true, tab: 'privasi' })}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
              <div>
                <div className="text-xs font-bold text-slate-900">Kebijakan Privasi &amp; Data Warga</div>
                <div className="text-[11px] text-slate-500">
                  Transparansi GPS AreaQu, enkripsi backup &amp; sinkronisasi perangkat
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setLegalModal({ open: true, tab: 'ketentuan' })}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <FileText className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Syarat, Ketentuan &amp; Disclaimer SiagaQu
                </div>
                <div className="text-[11px] text-slate-500">
                  Bukan pengganti layanan darurat resmi 110 / 112 / 118 / 119 / 113
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setLegalModal({ open: true, tab: 'hakcipta' })}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Copyright className="w-4 h-4 mt-0.5 shrink-0 text-slate-700" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Hak Cipta &amp; Orisinalitas Karya WargaQu
                </div>
                <div className="text-[11px] text-slate-500">
                  © 2026 WargaQu · Ekosistem Cerdas Warga, Keluarga &amp; UMKM
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </section>
        </div>
        </div>
      </main>

      <LegalNoticeModal
        isOpen={legalModal.open}
        onClose={() => setLegalModal((prev) => ({ ...prev, open: false }))}
        initialTab={legalModal.tab}
      />
    </div>
  );
};
