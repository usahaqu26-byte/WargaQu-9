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
} from 'lucide-react';
import { AUTH_SYNC_EVENT, AuthAccount, AuthService } from '../../services/authService';
import { RT_SYNC_EVENT, RtSiagaStorage, WargaMember } from '../../services/rtSiagaStorage';
import { ZERO_TRUST_SYNC_EVENT, ZeroTrustService } from '../../services/zeroTrustService';
import { EncryptedBackupPanel } from '../common/EncryptedBackupPanel';

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

  const [emailInput, setEmailInput] = useState<string>(account?.email || '');
  const [phoneInput, setPhoneInput] = useState<string>(account?.phone || '');
  const [isFrozen, setIsFrozen] = useState<boolean>(() => ZeroTrustService.isCurrentDeviceFrozen());
  const [recoveryCfg, setRecoveryCfg] = useState<{ code: string; guardianContact: string }>(() =>
    account
      ? ZeroTrustService.getRecoveryConfig(account.email)
      : { code: '', guardianContact: '' }
  );
  const [guardianInput, setGuardianInput] = useState<string>(recoveryCfg.guardianContact || '');

  useEffect(() => {
    const sync = () => {
      const acc = AuthService.getAccount();
      setAccount(acc);
      setRtMember(RtSiagaStorage.getCurrentMember());
      setIsFrozen(ZeroTrustService.isCurrentDeviceFrozen());
      if (acc) {
        setEmailInput(acc.email);
        setPhoneInput(acc.phone);
        const cfg = ZeroTrustService.getRecoveryConfig(acc.email);
        setRecoveryCfg(cfg);
        setGuardianInput(cfg.guardianContact || '');
      }
    };
    window.addEventListener(AUTH_SYNC_EVENT, sync);
    window.addEventListener(RT_SYNC_EVENT, sync);
    window.addEventListener(ZERO_TRUST_SYNC_EVENT, sync);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, sync);
      window.removeEventListener(RT_SYNC_EVENT, sync);
      window.removeEventListener(ZERO_TRUST_SYNC_EVENT, sync);
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
    showNotification('Akun utama diperbarui & disinkronkan ke seluruh modul.');
  };

  const handleLogout = () => {
    AuthService.logout();
    setEmailInput('');
    setPhoneInput('');
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
      <header className="bg-white border-b border-slate-200 px-4 pt-4 pb-3 flex items-center justify-between shrink-0">
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
              Identitas tunggal Email &amp; No HP untuk semua modul
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
      </header>

      <main className="flex-1 overflow-y-auto divide-y divide-slate-200">
        {/* Form Login / Edit Akun */}
        <section className="p-4 space-y-3">
          {isFrozen && (
            <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-[11px] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Perangkat ini sedang dibekukan oleh kebijakan Zero Trust (status HP Hilang). Buka lewat
                Panel Admin Zero Trust jika ini perangkat sah Anda.
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

        {/* Cadangan Terenkripsi Offline (bisa dipakai juga untuk pulihkan di HP baru) */}
        <section className="p-4">
          <EncryptedBackupPanel
            scope="all"
            title="Cadangan Terenkripsi Semua Data (.wqbak)"
            description="Enkripsi seluruh data WargaQu (LeluhurQu, RTQu, SiagaQu & Akun) dengan kata sandi untuk disimpan ke Google Drive atau dipulihkan di HP pengganti."
            showNotification={showNotification}
          />
        </section>

        {/* Panel Admin Zero Trust */}
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
      </main>
    </div>
  );
};
