import React, { useState, useEffect } from 'react';
import {
  Bell,
  Headphones,
  User,
  Eye,
  EyeOff,
  Receipt,
  ChevronRight,
  Sparkles,
  Home,
  Siren,
  ShoppingBag,
  MapPin,
  HeartHandshake,
  MessageSquare,
  Settings,
  QrCode,
  Newspaper,
  History,
  UserCheck,
  SlidersHorizontal,
  Info,
  Mic,
  GitFork,
  LogIn,
  Wallet
} from 'lucide-react';
import { PWAInstallBanner } from '../pwa/PWAInstallBanner';
import { WargaQuLogoIcon } from '../common/WargaQuLogo';
import { AUTH_SYNC_EVENT, AuthAccount, AuthService } from '../../services/authService';
import { RT_SYNC_EVENT, RtSiagaStorage, WargaMember, PaguyubanProfile } from '../../services/rtSiagaStorage';
import { DOMPETQU_SYNC_EVENT, DompetQuStorage, DompetWallet } from '../../services/dompetQuStorage';
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
    if (!raw) return 5;
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
  onOpenModularQu,
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
  const [rtMember, setRtMember] = useState<WargaMember>(() => RtSiagaStorage.getCurrentMember());
  const [hasRtCommunity, setHasRtCommunity] = useState<boolean>(() => RtSiagaStorage.hasCommunities());
  const [dompetWallets, setDompetWallets] = useState<DompetWallet[]>(() =>
    DompetQuStorage.getWallets()
  );
  const [dompetTotal, setDompetTotal] = useState<number>(() =>
    DompetQuStorage.getTotalCombinedBalance()
  );
  const [smartVoiceOpen, setSmartVoiceOpen] = useState<boolean>(false);
  const [unreadChatCount, setUnreadChatCount] = useState<number>(() => getLiveUnreadChatCount());

  useEffect(() => {
    const syncAll = () => {
      setAuthAccount(AuthService.getAccount());
      setRtProfile(RtSiagaStorage.getProfile());
      setRtMember(RtSiagaStorage.getCurrentMember());
      setHasRtCommunity(RtSiagaStorage.hasCommunities());
      setDompetWallets(DompetQuStorage.getWallets());
      setDompetTotal(DompetQuStorage.getTotalCombinedBalance());
      setUnreadChatCount(getLiveUnreadChatCount());
    };
    window.addEventListener(AUTH_SYNC_EVENT, syncAll);
    window.addEventListener(RT_SYNC_EVENT, syncAll);
    window.addEventListener(DOMPETQU_SYNC_EVENT, syncAll);
    window.addEventListener('focus', syncAll);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, syncAll);
      window.removeEventListener(RT_SYNC_EVENT, syncAll);
      window.removeEventListener(DOMPETQU_SYNC_EVENT, syncAll);
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
      <div className="bg-gradient-to-b from-[#047857] via-[#059669] to-[#059669] pt-5 px-5 pb-16 rounded-b-[32px] relative text-white shrink-0 shadow-md">
        {/* Top Header Row */}
        <div className="flex justify-between items-center mb-3">
          {/* Logo / Title with Mint Accent & Official Origami 7-Facet W Logo */}
          <div className="flex items-center gap-2.5">
            <WargaQuLogoIcon uid="dashboard_hdr" className="w-10 h-10 drop-shadow-md" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-extrabold italic tracking-tight text-white leading-none">
                  warga<span className="text-[#5eead4] font-black drop-shadow-xs">Qu</span>
                </span>
                <span className="text-[10px] bg-emerald-950/40 border border-emerald-300/40 px-2 py-0.5 rounded-full font-bold text-[#5eead4] max-w-[110px] truncate">
                  {hasRtCommunity ? rtProfile.orgName : 'Mandiri'}
                </span>
              </div>
              <span className="text-[9px] text-emerald-200/90 font-medium tracking-wide flex items-center gap-1 mt-0.5">
                <span>Smart Citizen System</span>
              </span>
            </div>
          </div>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              className="relative p-2 rounded-full hover:bg-white/10 active:scale-95 transition"
              onClick={() => showToast('Notifikasi: Tidak ada pesan baru')}
              title="Notifikasi"
            >
              <Bell className="w-5 h-5 text-white" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-300 rounded-full ring-2 ring-emerald-800"></span>
            </button>
            <button
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition"
              onClick={onOpenBantuan}
              title="Pusat Bantuan UsahaQu & WargaQu"
            >
              <Headphones className="w-5 h-5 text-[#5eead4]" />
            </button>
            <button
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition"
              onClick={() => onOpenEmptyModule('akun')}
              title="Pengaturan Profil"
            >
              <User className="w-5 h-5 text-emerald-100" />
            </button>
          </div>
        </div>

        {/* Greeting User + Synced Account Strip */}
        <div className="mt-1 mb-1 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-emerald-200 tracking-wider uppercase font-medium">Halo,</p>
            <h1 className="text-lg font-bold text-white tracking-wide truncate">
              {authAccount ? AuthService.getDisplayName(authAccount).toUpperCase() : 'TAMU WARGAQU'}
            </h1>
            <p className="text-[10px] text-emerald-100/90 truncate">
              {authAccount
                ? `${authAccount.email} · ${authAccount.phone}`
                : 'Masuk Email & No HP untuk sinkronisasi semua modul'}
            </p>
          </div>
          {!authAccount && onOpenLogin && (
            <button
              onClick={() => onOpenLogin()}
              className="px-3 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-extrabold text-[11px] flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk</span>
            </button>
          )}
        </div>
      </div>

      {/* SCROLLABLE MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 -mt-12 pb-24 space-y-3.5">
        {/* PWA Direct Mobile Install Banner */}
        <PWAInstallBanner showToast={showToast} />

        {/* MAIN CARD WIDGET: SISA DOMPET GABUNGAN (TERISOLASI & PRIVASI MATA TERTUTUP) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100/90 relative overflow-hidden">
          {/* Top Status Row: DompetQu Privacy + RTQu Shortcut */}
          <div className="flex justify-between items-center pb-2.5 border-b border-emerald-50 gap-2">
            <button
              type="button"
              onClick={onOpenDompetQu}
              className="inline-flex items-center gap-1.5 text-emerald-800 text-xs font-bold min-w-0 hover:underline"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">DompetQu Pribadi · Terisolasi</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenRtQu(hasRtCommunity ? 'iuran' : 'ringkasan')}
              className="text-[11px] text-slate-500 hover:text-emerald-700 font-medium truncate"
            >
              {hasRtCommunity ? `${rtProfile.orgName} · ${rtMember.block}` : 'Ruang RTQu'}
            </button>
          </div>

          {/* Primary Metric Display: Combined Cash + ATM + E-Wallet */}
          <div className="pt-3 pb-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                Sisa Dompet Gabungan (Cash &amp; ATM)
              </span>
              <button
                type="button"
                onClick={() => setIsBalanceHidden(prev => !prev)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50 transition active:scale-95"
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
            <div className="mt-1.5 text-[11px] text-slate-500 font-mono tabular-nums truncate">
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

          {/* Card Footer Actions */}
          <div className="pt-2.5 border-t border-emerald-50 flex justify-between items-center gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSmartVoiceOpen(true)}
              className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 hover:underline active:opacity-80"
            >
              <Mic className="w-4 h-4 text-emerald-700" />
              <span>Catat Suara Cepat</span>
            </button>
            <button
              type="button"
              onClick={onOpenDompetQu}
              className="flex items-center gap-1 text-slate-700 hover:text-emerald-700 font-bold"
            >
              <span>Buka DompetQu</span>
              <ChevronRight className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        </div>

        {/* MENU UTAMA (MODULE GRID) */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100/90 relative z-10">
          {/* Section Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Menu Utama</h3>
            <button
              onClick={() => showToast('Mode Atur Menu Utama')}
              className="text-xs font-bold text-emerald-700 flex items-center gap-1 hover:underline"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Atur
            </button>
          </div>

          {/* Grid Items (Menu Utama - 12 Modul Simetris 4x3) */}
          <div className="grid grid-cols-4 gap-y-4 gap-x-2">
            {/* 1. DompetQu */}
            <button
              onClick={onOpenDompetQu}
              className="flex flex-col items-center group relative active:scale-95 transition"
              title="Buka DompetQu (Keuangan Pribadi Terisolasi)"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <Wallet className="w-6 h-6 text-emerald-700" />
              </div>
              <span className="text-[11px] font-bold text-emerald-900 mt-1.5 text-center leading-tight">
                DompetQu
              </span>
            </button>

            {/* 2. LeluhurQu (Silsilah Trah Keluarga) */}
            <button
              onClick={onOpenLeluhurQu}
              className="flex flex-col items-center group relative active:scale-95 transition"
              title="Buka Modul LeluhurQu (Silsilah Trah Keluarga)"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <GitFork className="w-6 h-6 rotate-180 text-emerald-700" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                LeluhurQu
              </span>
            </button>

            {/* 3. RtQu */}
            <button
              onClick={() => onOpenRtQu('ringkasan')}
              className="flex flex-col items-center group active:scale-95 transition"
              title="Buka Modul RtQu"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <Home className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                RtQu
              </span>
            </button>

            {/* 4. MuamalahQu */}
            <button
              onClick={onOpenMuamalahQu}
              className="flex flex-col items-center group active:scale-95 transition"
              title="Buka Modul MuamalahQu"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                MuamalahQu
              </span>
            </button>

            {/* 5. AreaQu */}
            <button
              onClick={() => onOpenAreaQu('jelajah')}
              className="flex flex-col items-center group active:scale-95 transition"
              title="Buka Modul AreaQu"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 group-hover:scale-105 transition shadow-xs">
                <MapPin className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                AreaQu
              </span>
            </button>

            {/* 6. SiagaQu (Panic Button) */}
            <button
              onClick={onOpenSiagaQu}
              className="flex flex-col items-center group relative active:scale-95 transition"
              title="Buka Modul SiagaQu (Panic Button)"
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

            {/* 7. UsahaQu (2-in-1 POS: Resto & Modular AI) */}
            <button
              onClick={() => onOpenUsahaQu('resto')}
              className="flex flex-col items-center group relative active:scale-95 transition"
              title="Buka UsahaQu (Resto Qu & Modular Voice AI)"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 via-teal-100 to-emerald-200 border-2 border-emerald-500 flex items-center justify-center text-emerald-800 group-hover:scale-105 transition shadow-md shadow-emerald-200/50">
                <ShoppingBag className="w-6 h-6 text-emerald-700" />
              </div>
              <span className="absolute -top-1.5 -right-1 bg-emerald-700 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full shadow-xs uppercase tracking-tight">
                2-in-1
              </span>
              {activeOrderCount > 0 && (
                <span className="absolute -top-1.5 -left-1 bg-rose-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {activeOrderCount}
                </span>
              )}
              <span className="text-[11px] font-bold text-emerald-900 mt-1.5 text-center leading-tight flex items-center gap-0.5">
                UsahaQu
              </span>
            </button>

            {/* 8. ChatQu */}
            <button
              onClick={() => onOpenChatQu('chats')}
              className="flex flex-col items-center group relative active:scale-95 transition"
              title="Buka ChatQu Forum Warga"
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 group-hover:scale-105 transition shadow-xs">
                <MessageSquare className="w-6 h-6" />
              </div>
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1 rounded-full">
                  {unreadChatCount}
                </span>
              )}
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                ChatQu
              </span>
            </button>

            {/* 9. Bayar / QRIS RTQu */}
            <button
              onClick={() => onOpenRtQu('iuran')}
              className="flex flex-col items-center group active:scale-95 transition"
              title="Bayar Iuran & QRIS RTQu"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 group-hover:scale-105 transition shadow-xs">
                <QrCode className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                Bayar QRIS
              </span>
            </button>

            {/* 10. Riwayat Iuran RT */}
            <button
              onClick={() => onOpenRtQu('keuangan')}
              className="flex flex-col items-center group active:scale-95 transition"
              title="Laporan Kas RTQu"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:scale-105 transition shadow-xs">
                <Receipt className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                Kas RT
              </span>
            </button>

            {/* 11. Smart Care */}
            <button
              onClick={onOpenBantuan}
              className="flex flex-col items-center group active:scale-95 transition"
              title="UsahaQu Smart Care & Bantuan"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:scale-105 transition shadow-xs">
                <Headphones className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                Smart Care
              </span>
            </button>

            {/* 12. Setting */}
            <button
              onClick={() => onOpenEmptyModule('setting')}
              className="flex flex-col items-center group active:scale-95 transition"
              title="Pengaturan Aplikasi"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 group-hover:scale-105 transition shadow-xs">
                <Settings className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-medium text-slate-700 mt-1.5 text-center leading-tight">
                Setting
              </span>
            </button>
          </div>
        </div>

        {/* FOKUS USAHAQU: SPOTLIGHT CARD (BAKSO QU + MODULARQU) */}
        <div className="bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#065f46] rounded-2xl p-3.5 text-white shadow-md border border-emerald-400/30 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                Fokus UsahaQu • POS Kasir Cerdas
              </span>
            </div>
            <span className="text-[9px] bg-emerald-500/20 text-[#5eead4] border border-emerald-400/40 px-2 py-0.5 rounded-full font-bold">
              Resto & Multi-Usaha
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 1. Bakso Qu Resto Card */}
            <button
              onClick={() => onOpenUsahaQu('resto')}
              className="bg-emerald-950/70 hover:bg-emerald-950/90 border border-emerald-500/30 rounded-xl p-2.5 text-left flex flex-col justify-between active:scale-98 transition group shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                    <ShoppingBag className="w-4 h-4 text-emerald-300" />
                  </div>
                  <span className="text-[8px] bg-emerald-500 text-zinc-950 font-black px-1.5 py-0.5 rounded uppercase">
                    Meja
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                  Bakso Qu Resto
                </h4>
                <p className="text-[10px] text-emerald-200/80 leading-tight mt-0.5">
                  POS Dine-in, denah meja & dapur
                </p>
              </div>
              <div className="mt-2 text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                <span>Buka Resto</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>

            {/* 2. POS ModularQu Card */}
            <button
              onClick={() => onOpenUsahaQu('modular')}
              className="bg-emerald-950/70 hover:bg-emerald-950/90 border border-teal-400/40 rounded-xl p-2.5 text-left flex flex-col justify-between active:scale-98 transition group relative shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                    <Mic className="w-4 h-4 text-teal-300" />
                  </div>
                  <span className="text-[8px] bg-teal-400 text-zinc-950 font-black px-1.5 py-0.5 rounded uppercase">
                    Voice AI
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition">
                  POS ModularQu
                </h4>
                <p className="text-[10px] text-emerald-200/80 leading-tight mt-0.5">
                  Voice Kasir, 4 format struk & omset
                </p>
              </div>
              <div className="mt-2 text-[10px] font-bold text-teal-300 flex items-center gap-1">
                <span>Buka Modular</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          </div>
        </div>

        {/* ANNOUNCEMENT / BANNER CAROUSEL */}
        {hasRtCommunity ? (
          <div
            onClick={() => onOpenRtQu('forum')}
            className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-xl p-3.5 text-white shadow-sm flex items-center justify-between cursor-pointer hover:opacity-95 active:scale-[0.99] transition border border-emerald-500/30"
          >
            <div className="space-y-0.5 min-w-0 pr-2">
              <div className="inline-block bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                Kegiatan {rtProfile.orgName}
              </div>
              <h4 className="text-xs font-bold leading-tight truncate">
                {RtSiagaStorage.getForumPosts()[0]?.title || 'Gotong Royong & Rapat Warga'}
              </h4>
              <p className="text-[11px] text-emerald-100">Lihat Jadwal &amp; RSVP di Forum &gt;</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
          </div>
        ) : (
          <div
            onClick={() => onOpenRtQu('ringkasan')}
            className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 rounded-xl p-3.5 text-white shadow-sm flex items-center justify-between cursor-pointer hover:opacity-95 active:scale-[0.99] transition border border-emerald-500/30"
          >
            <div className="space-y-0.5 min-w-0 pr-2">
              <div className="inline-block bg-amber-400 text-slate-900 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                Khusus Undangan &amp; Mandiri
              </div>
              <h4 className="text-xs font-bold leading-tight">
                Buat RT / Paguyuban / DKM Baru atau Gabung Undangan
              </h4>
              <p className="text-[11px] text-emerald-100">
                Data tersimpan aman di HP Anda tanpa database pusat &gt;
              </p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
          </div>
        )}

        {/* EXTRA FEATURE STRIP (NFC / QUICK BAYAR BANNER) */}
        <div
          onClick={() => onOpenRtQu(hasRtCommunity ? 'iuran' : 'ringkasan')}
          className="bg-white rounded-xl p-3 border border-emerald-100/90 flex items-center justify-between shadow-xs cursor-pointer hover:bg-emerald-50/50 active:scale-[0.99] transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center text-emerald-700">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-slate-800">
                {hasRtCommunity ? 'Bayar Iuran via WargaPay' : 'Kelola Iuran & Kas Komunitas'}
              </h5>
              <p className="text-[10px] text-slate-500">
                {hasRtCommunity
                  ? 'Scan QRIS atau Transfer Otomatis'
                  : 'Aktif otomatis setelah gabung atau buat komunitas RTQu'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-600" />
        </div>

        {/* PUSAT BANTUAN & AUTO-FIX CS STRIP */}
        <div
          onClick={onOpenBantuan}
          className="bg-slate-900 rounded-xl p-3 border border-slate-700/80 flex items-center justify-between shadow-sm cursor-pointer hover:bg-slate-800 active:scale-[0.99] transition text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 text-slate-950 rounded-lg flex items-center justify-center font-bold shadow-md shadow-emerald-500/30">
              <Headphones className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h5 className="text-xs font-bold text-white">UsahaQu Smart Care</h5>
                <span className="bg-emerald-900/80 text-emerald-300 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border border-emerald-500/30">
                  AI Auto-Fix
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Pusat Bantuan &amp; Prompt Engine Konsol CS</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400" />
        </div>

        {/* LATEST NEWS / COMMUNITY INFO (ONLY IF JOINED) */}
        {hasRtCommunity && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100/90 space-y-3">
            <h3 className="font-bold text-emerald-900 text-xs uppercase tracking-wider">
              Kabar {rtProfile.orgName}
            </h3>
            <div
              onClick={() => onOpenRtQu('forum')}
              className="flex gap-3 items-center cursor-pointer hover:opacity-85 transition"
            >
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-lg shrink-0 flex items-center justify-center text-emerald-700">
                <Newspaper className="w-6 h-6" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                  {RtSiagaStorage.getForumPosts()[0]?.title ||
                    `Pembaruan Info & Agenda ${rtProfile.orgName}`}
                </p>
                <p className="text-[10px] text-slate-400">
                  {RtSiagaStorage.getForumPosts()[0]?.createdAt || 'Terbaru'} • Buka Forum &gt;
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION BAR WITH FLOATING QRIS BUTTON */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-emerald-100 px-3 py-2 flex justify-around items-end z-40 shadow-lg">
        {/* Beranda */}
        <button
          className="flex flex-col items-center gap-0.5 text-emerald-700 active:scale-95 transition"
          onClick={() => showToast('Anda sedang di Beranda WargaQu')}
        >
          <Home className="w-5 h-5 text-emerald-700" />
          <span className="text-[10px] font-bold">Beranda</span>
        </button>

        {/* Aktivitas */}
        <button
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-700 active:scale-95 transition"
          onClick={() => onOpenAreaQu('aktivitas')}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-medium">Aktivitas</span>
        </button>

        {/* CENTER FLOATING SMART VOICE CATAT DOMPETQU BUTTON */}
        <div className="relative -top-5 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setSmartVoiceOpen(true)}
            className="w-14 h-14 bg-gradient-to-tr from-[#047857] via-[#059669] to-[#14b8a6] rounded-full p-0.5 shadow-lg shadow-emerald-700/30 flex items-center justify-center text-white border-4 border-[#f0fdf4] active:scale-95 transition"
            title="Catat Suara Cerdas ke DompetQu"
          >
            <div className="w-full h-full rounded-full flex flex-col items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
          </button>
          <span className="text-[10px] font-extrabold text-emerald-700 mt-0.5">Catat Suara</span>
        </div>

        {/* DompetQu */}
        <button
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-700 relative active:scale-95 transition"
          onClick={onOpenDompetQu}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-medium">DompetQu</span>
        </button>

        {/* Akun Saya */}
        <button
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-emerald-700 active:scale-95 transition"
          onClick={() => onOpenEmptyModule('akun')}
        >
          <UserCheck className="w-5 h-5" />
          <span className="text-[10px] font-medium">Akun Saya</span>
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
