import React, { useState, useEffect } from 'react';
import {
  Headphones,
  Eye,
  EyeOff,
  ChevronRight,
  Home,
  Siren,
  ShoppingBag,
  MapPin,
  HeartHandshake,
  MessageSquare,
  UserCheck,
  Info,
  Mic,
  GitFork,
  LogIn,
  Wallet
} from 'lucide-react';
import { PWAInstallBanner } from '../pwa/PWAInstallBanner';
import { WargaQuLogoIcon } from '../common/WargaQuLogo';
import { AUTH_SYNC_EVENT, AuthAccount, AuthService } from '../../services/authService';
import { RT_SYNC_EVENT, RtSiagaStorage, PaguyubanProfile } from '../../services/rtSiagaStorage';
import { DOMPETQU_SYNC_EVENT, DompetQuStorage, DompetWallet } from '../../services/dompetQuStorage';
import {
  DEVICE_PAIRING_SYNC_EVENT,
  DevicePairingService,
  PairedHostSession,
} from '../../services/devicePairingService';
import { DompetSmartVoiceModal } from '../dompetqu/DompetSmartVoiceModal';

interface WargaDashboardProps {
  onOpenDompetQu: () => void;
  onOpenLeluhurQu: () => void;
  onOpenRtQu: (tab?: 'ringkasan' | 'forum' | 'keuangan' | 'iuran' | 'pengurus') => void;
  onOpenSiagaQu: () => void;
  onOpenUsahaQu: (mode?: 'resto' | 'modular') => void;
  onOpenModularQu?: () => void;
  onOpenBantuan: () => void;
  onOpenChatQu: (tab?: 'community' | 'chats' | 'announcements' | 'emergency') => void;
  onOpenMuamalahQu: () => void;
  onOpenAreaQu: (tab?: 'jelajah' | 'lapak' | 'aktivitas' | 'identitas') => void;
  onOpenEmptyModule: (moduleId: string) => void;
  onOpenLogin?: (reason?: string) => void;
  activeOrderCount?: number;
}

function getLiveUnreadChatCount(): number {
  try {
    const raw = localStorage.getItem('wargaqu_chat_rooms_v1');
    if (!raw) return 0;
    const rooms = JSON.parse(raw) as Array<{ unreadCount?: number }>;
    if (!Array.isArray(rooms)) return 0;
    return rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0);
  } catch {
    return 0;
  }
}

export const WargaDashboard: React.FC<WargaDashboardProps> = ({
  onOpenDompetQu,
  onOpenLeluhurQu,
  onOpenRtQu,
  onOpenSiagaQu,
  onOpenUsahaQu,
  onOpenBantuan,
  onOpenChatQu,
  onOpenMuamalahQu,
  onOpenAreaQu,
  onOpenEmptyModule,
  onOpenLogin,
  activeOrderCount = 0,
}) => {
  // Default mata tertutup agar saldo pribadi tidak terlihat orang di sekitar
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(
    () => DompetQuStorage.getPrivacySettings().hideBalanceByDefault !== false
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authAccount, setAuthAccount] = useState<AuthAccount | null>(() => AuthService.getAccount());
  const [rtProfile, setRtProfile] = useState<PaguyubanProfile>(() => RtSiagaStorage.getProfile());
  const [hasRtCommunity, setHasRtCommunity] = useState<boolean>(() => RtSiagaStorage.hasCommunities());
  const [dompetWallets, setDompetWallets] = useState<DompetWallet[]>(() =>
    DompetQuStorage.getWallets()
  );
  const [dompetTotal, setDompetTotal] = useState<number>(() =>
    DompetQuStorage.getTotalCombinedBalance()
  );
  const [smartVoiceOpen, setSmartVoiceOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(() => getLiveUnreadChatCount());
  const [pairedHost, setPairedHost] = useState<PairedHostSession | null>(() =>
    DevicePairingService.getPairedHost()
  );

  useEffect(() => {
    const syncAll = () => {
      setAuthAccount(AuthService.getAccount());
      setRtProfile(RtSiagaStorage.getProfile());
      setHasRtCommunity(RtSiagaStorage.hasCommunities());
      setDompetWallets(DompetQuStorage.getWallets());
      setDompetTotal(DompetQuStorage.getTotalCombinedBalance());
      setUnreadChatCount(getLiveUnreadChatCount());
      setPairedHost(DevicePairingService.getPairedHost());
    };
    window.addEventListener(AUTH_SYNC_EVENT, syncAll);
    window.addEventListener(RT_SYNC_EVENT, syncAll);
    window.addEventListener(DOMPETQU_SYNC_EVENT, syncAll);
    window.addEventListener(DEVICE_PAIRING_SYNC_EVENT, syncAll);
    window.addEventListener('focus', syncAll);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, syncAll);
      window.removeEventListener(RT_SYNC_EVENT, syncAll);
      window.removeEventListener(DOMPETQU_SYNC_EVENT, syncAll);
      window.removeEventListener(DEVICE_PAIRING_SYNC_EVENT, syncAll);
      window.removeEventListener('focus', syncAll);
    };
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 2500);
  };

  const maskedBalance = '••••••••';

  return (
    <div className="w-full h-full bg-[#f0fdf4] overflow-hidden flex flex-col relative no-scrollbar select-none">
      {/* TOP APP BAR & HEADER CONTAINER (Emerald Green #047857 to #059669) */}
      <div className="bg-gradient-to-b from-[#047857] via-[#059669] to-[#059669] pt-5 px-5 lg:px-8 pb-16 lg:pb-14 rounded-b-[32px] lg:rounded-b-none relative text-white shrink-0 shadow-md">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-3 lg:mb-2 gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <WargaQuLogoIcon uid="dashboard_hdr" className="w-10 h-10 drop-shadow-md shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-2xl font-extrabold italic tracking-tight text-white leading-none whitespace-nowrap">
                  warga<span className="text-[#5eead4] font-black drop-shadow-xs">Qu</span>
                </span>
                <span className="text-[10px] lg:text-xs text-emerald-100/90 font-medium tracking-wide truncate mt-1">
                  Smart Citizen System · {hasRtCommunity ? rtProfile.orgName : 'Mandiri'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Desktop quick actions (Mobile menggunakan bottom nav bar di bawah; zero duplikat) */}
              <button
                type="button"
                onClick={() => setSmartVoiceOpen(true)}
                className="hidden lg:inline-flex px-3.5 py-2 min-h-[40px] rounded-xl bg-emerald-800/80 hover:bg-emerald-900 border border-emerald-400/40 text-white font-bold text-xs items-center gap-1.5 transition whitespace-nowrap"
                title="Catat Suara Cerdas ke DompetQu"
              >
                <Mic className="w-4 h-4 text-[#5eead4]" />
                <span>Catat Suara</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenEmptyModule('akun')}
                className="hidden lg:inline-flex px-3.5 py-2 min-h-[40px] rounded-xl bg-emerald-800/60 hover:bg-emerald-900 border border-emerald-300/30 text-white font-bold text-xs items-center gap-1.5 transition whitespace-nowrap"
                title="Akun Saya, Pengaturan & Tautkan Laptop"
              >
                <UserCheck className="w-4 h-4 text-[#5eead4]" />
                <span>Akun Saya</span>
              </button>

              {!authAccount && onOpenLogin && (
                <button
                  type="button"
                  onClick={() => onOpenLogin()}
                  className="px-3.5 py-2 min-h-[40px] rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-extrabold text-xs flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 transition whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk</span>
                </button>
              )}
            </div>
          </div>

          {/* Greeting User + Synced Account Strip */}
          <div className="mt-1 mb-1 min-w-0 lg:flex lg:items-baseline lg:justify-between lg:gap-4">
            <div className="min-w-0">
              <p className="text-xs text-emerald-200 tracking-wider font-medium lg:inline lg:mr-2">
                Halo,
              </p>
              <h1 className="text-lg lg:text-xl font-bold text-white tracking-wide truncate lg:inline">
                {authAccount
                  ? AuthService.getDisplayName(authAccount).toUpperCase()
                  : 'TAMU WARGAQU'}
              </h1>
            </div>
            <p className="text-[11px] lg:text-xs text-emerald-100/90 truncate">
              {authAccount
                ? `${authAccount.email} · ${authAccount.phone}${pairedHost ? ' · Sinkron Live HP ↔ Laptop' : ''}`
                : pairedHost
                ? `Tersambung ke ${pairedHost.hostLabel} · Sinkronisasi Live Aktif`
                : 'Masuk Email & No HP atau Scan QR dari HP untuk sinkronisasi'}
            </p>
          </div>
        </div>
      </div>

      {/* SCROLLABLE MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 lg:px-8 -mt-12 lg:-mt-9 pb-24 lg:pb-10">
        <div className="max-w-6xl mx-auto space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
          {/* KOLOM KIRI DI DESKTOP: PWA BANNER & DOMPETQU */}
          <div className="space-y-4 lg:col-span-5">
            <PWAInstallBanner showToast={showToast} />

            {/* DOMPETQU: SATU-SATUNYA WADAH RINGKASAN & AKSES DOMPET PRIBADI */}
            <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm border border-emerald-100/90 relative overflow-hidden">
          <div className="flex justify-between items-center pb-2.5 border-b border-emerald-50 gap-2">
            <div className="inline-flex items-center gap-1.5 text-emerald-800 text-xs font-bold min-w-0">
              <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="truncate">DompetQu Pribadi · Terisolasi</span>
            </div>
            <button
              type="button"
              onClick={onOpenDompetQu}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 whitespace-nowrap shrink-0"
            >
              <span>Buka DompetQu</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-3">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                Sisa Dompet Gabungan (Cash &amp; ATM)
              </span>
              <button
                type="button"
                onClick={() => setIsBalanceHidden((prev) => !prev)}
                className="min-w-[44px] min-h-[44px] -my-2 -mr-2 flex items-center justify-center rounded-xl text-emerald-700 hover:bg-emerald-50 transition active:scale-95"
                title={isBalanceHidden ? 'Tampilkan Saldo' : 'Tutup Saldo (Privasi)'}
              >
                {isBalanceHidden ? (
                  <EyeOff className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Eye className="w-4 h-4 text-emerald-700" />
                )}
              </button>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-emerald-700">Rp</span>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums">
                {isBalanceHidden ? maskedBalance : dompetTotal.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-mono tabular-nums truncate">
              {dompetWallets.map((w, idx) => (
                <React.Fragment key={w.id}>
                  {idx > 0 && <span className="mx-1.5 text-slate-300">·</span>}
                  <span>
                    {w.kind === 'cash' ? 'Cash' : w.kind === 'bank' ? 'ATM' : 'E-Wallet'}{' '}
                    {isBalanceHidden ? '••••' : `Rp ${w.balance.toLocaleString('id-ID')}`}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
          </div>
          </div>

        {/* MENU UTAMA (8 MODUL INTI — TANPA DUPLIKAT & TANPA SUB-MENU GANDA) */}
        <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm border border-emerald-100/90 relative z-10 lg:col-span-7">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-sm lg:text-base">Menu Utama</h3>
            <span className="text-[11px] text-slate-400 font-medium">8 Modul Inti</span>
          </div>

          <div className="grid grid-cols-4 gap-y-5 gap-x-2 lg:gap-4">
            {/* 1. LeluhurQu */}
            <button
              type="button"
              onClick={onOpenLeluhurQu}
              className="flex flex-col items-center group relative active:scale-95 transition min-h-[44px]"
              title="LeluhurQu · Silsilah Trah Keluarga"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <GitFork className="w-6 h-6 rotate-180 text-emerald-700" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                LeluhurQu
              </span>
            </button>

            {/* 2. RtQu (Mewakili Ringkasan, Iuran/QRIS, Kas RT, Forum & Pengurus) */}
            <button
              type="button"
              onClick={() => onOpenRtQu('ringkasan')}
              className="flex flex-col items-center group active:scale-95 transition min-h-[44px]"
              title="RtQu · Paguyuban, Iuran, Kas & Forum Warga"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <Home className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                RtQu
              </span>
            </button>

            {/* 3. ChatQu */}
            <button
              type="button"
              onClick={() => onOpenChatQu('chats')}
              className="flex flex-col items-center group relative active:scale-95 transition min-h-[44px]"
              title="ChatQu · Komunikasi & Pengumuman Warga"
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 group-hover:scale-105 transition shadow-xs">
                <MessageSquare className="w-6 h-6" />
              </div>
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 rounded-full">
                  {unreadChatCount}
                </span>
              )}
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                ChatQu
              </span>
            </button>

            {/* 4. SiagaQu */}
            <button
              type="button"
              onClick={onOpenSiagaQu}
              className="flex flex-col items-center group relative active:scale-95 transition min-h-[44px]"
              title="SiagaQu · Panic Button & Radar Darurat"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 group-hover:scale-105 transition shadow-xs">
                <Siren className="w-6 h-6" />
              </div>
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold px-1 rounded-full">
                SOS
              </span>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                SiagaQu
              </span>
            </button>

            {/* 5. MuamalahQu */}
            <button
              type="button"
              onClick={onOpenMuamalahQu}
              className="flex flex-col items-center group active:scale-95 transition min-h-[44px]"
              title="MuamalahQu · Marketplace Warga"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                MuamalahQu
              </span>
            </button>

            {/* 6. AreaQu (Mewakili Jelajah, Lapak, Aktivitas & Identitas) */}
            <button
              type="button"
              onClick={() => onOpenAreaQu('jelajah')}
              className="flex flex-col items-center group active:scale-95 transition min-h-[44px]"
              title="AreaQu · Peta Kawasan, Lapak & Aktivitas"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 group-hover:scale-105 transition shadow-xs">
                <MapPin className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                AreaQu
              </span>
            </button>

            {/* 7. UsahaQu (Mewakili Resto Qu & POS Modular Voice AI) */}
            <button
              type="button"
              onClick={() => onOpenUsahaQu('resto')}
              className="flex flex-col items-center group relative active:scale-95 transition min-h-[44px]"
              title="UsahaQu · POS Kasir Resto & Modular Voice AI"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <ShoppingBag className="w-6 h-6 text-emerald-700" />
              </div>
              {activeOrderCount > 0 && (
                <span className="absolute -top-1 right-1 bg-rose-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {activeOrderCount}
                </span>
              )}
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                UsahaQu
              </span>
            </button>

            {/* 8. Smart Care (Satu-satunya pintu Bantuan & CS) */}
            <button
              type="button"
              onClick={onOpenBantuan}
              className="flex flex-col items-center group active:scale-95 transition min-h-[44px]"
              title="Smart Care · Pusat Bantuan & Konsol CS"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:scale-105 transition shadow-xs">
                <Headphones className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                Smart Care
              </span>
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION BAR (KHUSUS HP / TABLET KECIL — TERSEMBUNYI DI DESKTOP) */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-emerald-100 px-6 py-2 grid grid-cols-3 items-end z-40 shadow-lg">
        {/* Beranda */}
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 text-emerald-700 active:scale-95 transition min-h-[44px]"
          onClick={() => showToast('Anda sedang di Beranda WargaQu')}
        >
          <Home className="w-5 h-5 text-emerald-700" />
          <span className="text-[10px] font-bold whitespace-nowrap">Beranda</span>
        </button>

        {/* Center Floating Catat Suara DompetQu */}
        <div className="relative -top-5 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setSmartVoiceOpen(true)}
            className="w-14 h-14 bg-gradient-to-tr from-[#047857] via-[#059669] to-[#14b8a6] rounded-full p-0.5 shadow-lg shadow-emerald-700/30 flex items-center justify-center text-white border-4 border-[#f0fdf4] active:scale-95 transition"
            title="Catat Suara Cerdas ke DompetQu"
          >
            <Mic className="w-6 h-6 text-white" />
          </button>
          <span className="text-[10px] font-extrabold text-emerald-700 mt-0.5 whitespace-nowrap">
            Catat Suara
          </span>
        </div>

        {/* Akun Saya (Mewakili Profil, Pengaturan & Pengelola Akun) */}
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-emerald-700 active:scale-95 transition min-h-[44px]"
          onClick={() => onOpenEmptyModule('akun')}
        >
          <UserCheck className="w-5 h-5" />
          <span className="text-[10px] font-medium whitespace-nowrap">Akun Saya</span>
        </button>
      </div>

      {/* SMART VOICE TO TABLE MODAL (LANGSUNG DARI HALAMAN UTAMA) */}
      <DompetSmartVoiceModal
        open={smartVoiceOpen}
        onClose={() => setSmartVoiceOpen(false)}
        showNotification={showToast}
      />

      {/* TOAST NOTIFICATION CONTAINER */}
      <div
        className={`absolute top-10 left-1/2 -translate-x-1/2 bg-emerald-950/95 text-[#5eead4] border border-emerald-500/50 px-4 py-2 rounded-full text-xs font-semibold backdrop-blur-md shadow-xl z-50 flex items-center gap-2 transition-all duration-300 pointer-events-none ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        }`}
      >
        <Info className="w-4 h-4 text-[#5eead4] shrink-0" />
        <span className="whitespace-nowrap">{toastMessage}</span>
      </div>
    </div>
  );
};
