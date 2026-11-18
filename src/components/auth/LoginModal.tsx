import React, { useState } from 'react';
import {
  Mail,
  Phone,
  ShieldCheck,
  X,
  KeyRound,
  Smartphone,
  AlertTriangle,
  Cloud,
  QrCode,
} from 'lucide-react';
import { AuthAccount, AuthService } from '../../services/authService';
import { RtSiagaStorage } from '../../services/rtSiagaStorage';
import { ZeroTrustService } from '../../services/zeroTrustService';
import { FirebaseSyncService } from '../../services/firebaseSyncService';
import { LaptopQrWaitCard } from './DevicePairingPanel';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: AuthAccount) => void;
  showNotification: (msg: string) => void;
  reasonMessage?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showNotification,
  reasonMessage,
}) => {
  const existing = AuthService.getAccount();
  const [mode, setMode] = useState<'login' | 'qr' | 'recover'>('login');
  const [email, setEmail] = useState<string>(existing?.email || '');
  const [phone, setPhone] = useState<string>(existing?.phone || '');
  const [recoveryReason, setRecoveryReason] = useState<'hp_hilang' | 'hp_rusak'>('hp_rusak');
  const [recoveryCode, setRecoveryCode] = useState<string>('');
  const [guardianContact, setGuardianContact] = useState<string>('');
  const [recoveryNote, setRecoveryNote] = useState<string>('');
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const isCurrentFrozen = ZeroTrustService.isCurrentDeviceFrozen();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      showNotification('Masukkan alamat Email yang valid.');
      return;
    }
    if (cleanPhone.replace(/\D/g, '').length < 8) {
      showNotification('Masukkan nomor HP / WhatsApp yang valid.');
      return;
    }

    if (isCurrentFrozen) {
      showNotification(
        'Perangkat ini dibekukan (status HP Hilang). Hubungi Admin Zero Trust untuk membuka blokir.'
      );
      return;
    }

    const account = AuthService.login(cleanEmail, cleanPhone);
    RtSiagaStorage.syncAuthAccount(account);
    ZeroTrustService.registerOrTouchCurrentDevice(account.email, account.phone);
    showNotification(`Masuk sebagai ${account.email}`);
    onSuccess(account);
  };

  const handleGoogleLogin = async () => {
    if (isCurrentFrozen) {
      showNotification(
        'Perangkat ini dibekukan (status HP Hilang). Hubungi pengurus atau Admin untuk membuka blokir.'
      );
      return;
    }
    setGoogleLoading(true);
    try {
      const user = await FirebaseSyncService.signInWithGoogle(phone);
      const acc = AuthService.getAccount();
      if (acc) {
        RtSiagaStorage.syncAuthAccount(acc);
        ZeroTrustService.registerOrTouchCurrentDevice(acc.email, acc.phone);
        onSuccess(acc);
      }
      showNotification(`Terhubung Google Cloud: ${user.email || 'Berhasil'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        showNotification('Gagal masuk dengan Google. Coba lagi atau gunakan form manual.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRecoverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    if (!cleanEmail.includes('@') || cleanPhone.replace(/\D/g, '').length < 8) {
      showNotification('Isi Email & No HP akun yang ingin dipulihkan.');
      return;
    }

    if (recoveryCode.trim()) {
      const res = ZeroTrustService.recoverWithCode(
        cleanEmail,
        cleanPhone,
        recoveryCode,
        recoveryReason
      );
      if (!res.ok) {
        showNotification(res.message);
        return;
      }
      const acc = AuthService.getAccount();
      if (acc) {
        RtSiagaStorage.syncAuthAccount(acc);
        onSuccess(acc);
      }
      showNotification(res.message);
      setRecoveryCode('');
      setMode('login');
      return;
    }

    // Tanpa kode cadangan (mis. HP mati mendadak) -> kirim ke antrean Admin Zero Trust + Wali
    if (!guardianContact.trim()) {
      showNotification('Isi Kode Pemulihan atau kontak Wali Terpercaya (Email/HP) untuk verifikasi.');
      return;
    }
    ZeroTrustService.submitRecoveryRequest({
      email: cleanEmail,
      phone: cleanPhone,
      reason: recoveryReason,
      guardianContact,
      note: recoveryNote || 'HP lama tidak bisa diakses, mohon rotasi perangkat baru.',
    });
    showNotification(
      'Permohonan pemulihan dikirim ke Admin Zero Trust & Wali Terpercaya.'
    );
    setMode('login');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/65 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-200 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {mode === 'login'
                  ? 'Masuk Akun WargaQu'
                  : mode === 'qr'
                  ? 'Buka dari HP (Scan Barcode QR)'
                  : 'Pemulihan HP Hilang / Rusak'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {mode === 'login'
                  ? 'Satu identitas Email & No HP untuk seluruh modul'
                  : mode === 'qr'
                  ? 'Tautkan Laptop / PC seperti WhatsApp Web'
                  : 'Rotasi aman perangkat baru & bekukan perangkat lama'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {mode !== 'recover' && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`min-h-[36px] rounded-lg font-bold transition ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Masuk Akun
              </button>
              <button
                type="button"
                onClick={() => setMode('qr')}
                className={`min-h-[36px] rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                  mode === 'qr'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan QR Laptop</span>
              </button>
            </div>
          )}
        </div>

        <div className="overflow-y-auto">
        {mode === 'qr' ? (
          <div className="p-4">
            <LaptopQrWaitCard
              compact
              showNotification={showNotification}
              onPairedSuccess={() => {
                const syncedAcc = AuthService.getAccount();
                if (syncedAcc) {
                  onSuccess(syncedAcc);
                } else {
                  onClose();
                }
              }}
            />
          </div>
        ) : mode === 'login' ? (
          <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
            {isCurrentFrozen && (
              <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Perangkat ini berstatus <strong>Dibekukan (HP Hilang)</strong> oleh Zero Trust.
                </span>
              </div>
            )}

            {reasonMessage && (
              <div className="py-2 border-b border-slate-200 text-[11px] text-emerald-800 font-medium">
                {reasonMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full min-h-[44px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              <Cloud className="w-4 h-4 text-emerald-700" />
              <span>
                {googleLoading ? 'Menghubungkan Google...' : 'Masuk dengan Google (Sync Cloud)'}
              </span>
            </button>

            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <div className="h-px flex-1 bg-slate-200" />
              <span>atau isi manual (mode lokal)</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full min-h-[44px] border border-slate-300 rounded-xl pl-9 pr-3 text-xs focus:outline-none focus:border-emerald-700"
                  autoFocus
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
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0812-3456-7890"
                  className="w-full min-h-[44px] border border-slate-300 rounded-xl pl-9 pr-3 text-xs font-mono focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Semua modul langsung aktif setelah masuk. Khusus{' '}
                <strong>SiagaQu Radius Warga (500m–3km)</strong> tetap memerlukan aktivasi pengurus RT
                di modul RTQu.
              </span>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition"
            >
              Masuk &amp; Sinkronkan Modul
            </button>

            <button
              type="button"
              onClick={() => setMode('recover')}
              className="w-full py-2 text-[11px] font-bold text-slate-600 hover:text-emerald-700 flex items-center justify-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>HP Lama Hilang / Rusak? Pulihkan &amp; Pindahkan Akun</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleRecoverSubmit} className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setRecoveryReason('hp_rusak')}
                className={`py-2 rounded-lg text-[11px] font-bold ${
                  recoveryReason === 'hp_rusak'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                HP Rusak / Mati
              </button>
              <button
                type="button"
                onClick={() => setRecoveryReason('hp_hilang')}
                className={`py-2 rounded-lg text-[11px] font-bold ${
                  recoveryReason === 'hp_hilang'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                HP Hilang / Dicuri
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Akun</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-2.5"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">No. HP Akun</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0812..."
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-2.5 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Kode Pemulihan (Isi untuk Pindah Instan)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
                  placeholder="WQ-XXXX-XXXX (kosongkan jika lupa)"
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl pl-9 pr-3 font-mono uppercase"
                />
              </div>
            </div>

            {!recoveryCode.trim() && (
              <div className="space-y-2 border-t border-slate-200 pt-2">
                <div className="text-[11px] text-slate-500">
                  Tidak sempat mencatat Kode Pemulihan? Ajukan verifikasi ke Admin Zero Trust &amp;
                  Wali Terpercaya:
                </div>
                <input
                  type="text"
                  value={guardianContact}
                  onChange={e => setGuardianContact(e.target.value)}
                  placeholder="Email / No HP Wali Terpercaya (Keluarga / RT)"
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3"
                />
                <input
                  type="text"
                  value={recoveryNote}
                  onChange={e => setRecoveryNote(e.target.value)}
                  placeholder="Kronologi singkat (contoh: Layar pecah total)"
                  className="w-full min-h-[40px] border border-slate-300 rounded-xl px-3"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="min-h-[42px] border border-slate-300 rounded-xl font-bold text-slate-700"
              >
                Kembali Login
              </button>
              <button
                type="submit"
                className="min-h-[42px] bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold"
              >
                {recoveryCode.trim() ? 'Pulihkan Instan' : 'Kirim Permohonan'}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
};
