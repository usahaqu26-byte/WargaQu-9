import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AndroidFrame } from './components/AndroidFrame';
import { WargaDashboard } from './components/warga/WargaDashboard';
import { EmptyModuleView } from './components/warga/EmptyModuleView';
import { UsahaQuView } from './components/usahaqu/UsahaQuView';
import { RtQuView } from './components/rtqu/RtQuView';
import { SiagaQuView } from './components/siagaqu/SiagaQuView';
import { ChatQuView } from './components/chatqu/ChatQuView';
import { MuamalahQuView } from './components/muamalahqu/MuamalahQuView';
import { AreaQuView } from './components/areaqu/AreaQuView';
import { BantuanView } from './components/bantuan/BantuanView';
import { LeluhurQuView } from './components/leluhurqu/LeluhurQuView';
import { DompetQuView } from './components/dompetqu/DompetQuView';
import { LoginModal } from './components/auth/LoginModal';
import { AccountView } from './components/auth/AccountView';
import { AdminZeroTrustView } from './components/admin/AdminZeroTrustView';
import { StorePreviewView, PreviewTargetScreen } from './components/store/StorePreviewView';
import { ModuleGuideModal } from './components/common/ModuleGuideModal';
import {
  GuideModuleId,
  ModuleOnboardingService,
  OPEN_MODULE_GUIDE_EVENT,
} from './services/moduleOnboardingService';

import {
  TableItem,
  MenuItem,
  Order,
  Ingredient,
  RestaurantProfile,
  PrinterConfig
} from './types';
import { StorageService } from './services/storage';
import { AUTH_SYNC_EVENT, AuthAccount, AuthService } from './services/authService';
import { RtSiagaStorage } from './services/rtSiagaStorage';
import { ZeroTrustService, DeviceTrustStatus } from './services/zeroTrustService';
import { MonetizationService, ModuleMonetizationRule } from './services/monetizationService';
import { SmartCareLogEntry, SmartCareService } from './services/smartCareService';
import {
  ACCOUNT_GOV_SYNC_EVENT,
  AccountGovernanceService,
} from './services/accountGovernanceService';
import {
  REALTIME_RELAY_EVENT,
  RelayIncomingEvent,
  RealtimeRelayService,
  getAccountSessionChannel,
} from './services/realtimeRelayService';
import { FirebaseSyncService } from './services/firebaseSyncService';
import { AutoBackupService } from './services/autoBackupService';
import {
  DEVICE_PAIRING_SYNC_EVENT,
  DevicePairingService,
  PENDING_PAIR_TOKEN_KEY,
  PairingSyncEventDetail,
} from './services/devicePairingService';

type AppScreen = 'warga' | 'store' | 'dompetqu' | 'akun' | 'admin_zero_trust' | 'leluhurqu' | 'rtqu' | 'siagaqu' | 'chatqu' | 'muamalahqu' | 'areaqu' | 'usahaqu' | 'modularqu' | 'bantuan' | 'empty_module';

function isStorePreviewUrlRequested(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const preview = (params.get('preview') || '').trim().toLowerCase();
    const store = (params.get('store') || '').trim().toLowerCase();
    const hash = (window.location.hash || '').trim().toLowerCase();
    return (
      preview === 'store' ||
      preview === 'play' ||
      store === '1' ||
      store === 'true' ||
      hash === '#store' ||
      hash.startsWith('#store?') ||
      window.location.pathname.toLowerCase().endsWith('/store') ||
      window.location.pathname.toLowerCase().endsWith('/store/') ||
      window.location.pathname.toLowerCase().endsWith('/store.html')
    );
  } catch {
    return false;
  }
}

export default function App() {
  // Screen Navigation State
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(() =>
    isStorePreviewUrlRequested() ? 'store' : 'warga'
  );
  const [selectedEmptyModule, setSelectedEmptyModule] = useState<string>('areaqu');
  const [usahaQuMode, setUsahaQuMode] = useState<'resto' | 'modular'>('resto');
  const [rtQuInitialTab, setRtQuInitialTab] = useState<'ringkasan' | 'forum' | 'keuangan' | 'iuran' | 'pengurus'>('ringkasan');
  const [areaQuInitialTab, setAreaQuInitialTab] = useState<'jelajah' | 'lapak' | 'aktivitas' | 'identitas'>('jelajah');
  const [chatQuInitialTab, setChatQuInitialTab] = useState<'community' | 'chats' | 'announcements' | 'emergency'>('chats');

  // Core POS Data States (Persisted for UsahaQu / Bakso Qu)
  const [tables, setTables] = useState<TableItem[]>([]);
  const [menuList, setMenuList] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [history, setHistory] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Record<string, Order>>({});
  const [profile, setProfile] = useState<RestaurantProfile>(StorageService.getProfile());
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(StorageService.getPrinterConfig());

  // Global Auth Identity (Email, Phone, Hidden Device ID)
  const [authAccount, setAuthAccount] = useState<AuthAccount | null>(() => AuthService.getAccount());
  const [loginModal, setLoginModal] = useState<{ open: boolean; reason?: string }>({ open: false });

  // Dynamic Account Governance State (Normal / Free / Warning / Banned)
  const [accountAccess, setAccountAccess] = useState(() =>
    AccountGovernanceService.evaluateCurrentAccountAccess()
  );
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Module 1x First-Visit & On-Demand Guide Modal State
  const [moduleGuideState, setModuleGuideState] = useState<{
    open: boolean;
    moduleId: GuideModuleId | null;
    isFirstVisit: boolean;
  }>({ open: false, moduleId: null, isFirstVisit: false });

  // Global Toast Notification State
  const [notification, setNotification] = useState<string | null>(null);
  const lastBroadcastSessionNonceRef = useRef<string>('');

  // Initial Data Load & Hidden Device ID Init
  useEffect(() => {
    const extractInviteFromLocation = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash || '';
        const tIdx = hash.search(/(?:trah|t)=/);
        const hp = tIdx !== -1 ? new URLSearchParams(hash.slice(tIdx)) : null;

        const trahVal = (params.get('trah') || hp?.get('trah') || '').trim();
        const fromQuery = (
          params.get('t') ||
          params.get('trahInvite') ||
          hp?.get('t') ||
          hp?.get('trahInvite') ||
          ''
        ).trim();

        if (trahVal && fromQuery) {
          return `?trah=${encodeURIComponent(trahVal)}&t=${encodeURIComponent(fromQuery)}`;
        }
        if (trahVal) return `?trah=${encodeURIComponent(trahVal)}`;
        if (fromQuery) return fromQuery;

        const pathMatch = window.location.pathname.match(/\/trah\/([^/?#]+)/i);
        if (pathMatch?.[1]) return `?trah=${encodeURIComponent(decodeURIComponent(pathMatch[1]).trim())}`;
      } catch {
        // ignore URL errors
      }
      return '';
    };

    const extractRtInviteFromLocation = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const pagVal = params.get('paguyuban');
        if (pagVal && pagVal.trim()) return `?paguyuban=${pagVal.trim()}`;
        const grupVal = params.get('grup') || params.get('organisasi') || params.get('sosial');
        if (grupVal && grupVal.trim()) return `?grup=${grupVal.trim()}`;
        const rtVal = params.get('rt') || params.get('rtInvite');
        if (rtVal && rtVal.trim()) {
          const v = rtVal.trim();
          return v.startsWith('WQR') || /^R[A-Za-z0-9]{5,12}$/.test(v) ? v : `?rt=${v}`;
        }
        const pathMatch = window.location.pathname.match(/\/(rt|paguyuban|grup)\/([^/?#]+)/i);
        if (pathMatch?.[2]) {
          return `?${pathMatch[1].toLowerCase()}=${decodeURIComponent(pathMatch[2]).trim()}`;
        }
        const hash = window.location.hash || '';
        const rtIdx = hash.search(/(?:rt|paguyuban|grup)=/);
        if (rtIdx !== -1) {
          const hp = new URLSearchParams(hash.slice(rtIdx));
          if (hp.get('paguyuban')?.trim()) return `?paguyuban=${hp.get('paguyuban')!.trim()}`;
          if (hp.get('grup')?.trim()) return `?grup=${hp.get('grup')!.trim()}`;
          const fromHash = hp.get('rt') || hp.get('rtInvite');
          if (fromHash && fromHash.trim()) {
            const v = fromHash.trim();
            return v.startsWith('WQR') || /^R[A-Za-z0-9]{5,12}$/.test(v) ? v : `?rt=${v}`;
          }
        }
      } catch {
        // ignore URL errors
      }
      return '';
    };

    const extractPairFromLocation = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const pairQuery = (params.get('pair') || '').trim();
        if (pairQuery) return `?pair=${encodeURIComponent(pairQuery)}`;
        const hash = window.location.hash || '';
        const pIdx = hash.search(/pair=/);
        if (pIdx !== -1) {
          const hp = new URLSearchParams(hash.slice(pIdx));
          const pairHash = (hp.get('pair') || '').trim();
          if (pairHash) return `?pair=${encodeURIComponent(pairHash)}`;
        }
      } catch {
        // ignore URL errors
      }
      return '';
    };

    try {
      const pairToken = extractPairFromLocation();
      const trahInvite = extractInviteFromLocation();
      const rtInvite = extractRtInviteFromLocation();
      if (pairToken) {
        localStorage.setItem(PENDING_PAIR_TOKEN_KEY, pairToken);
        setCurrentScreen('akun');
        window.history.replaceState({ screen: 'akun' }, '', '#akun');
      } else if (trahInvite) {
        localStorage.setItem('wargaqu_pending_trah_invite_v1', trahInvite);
        setCurrentScreen('leluhurqu');
        window.history.replaceState({ screen: 'leluhurqu' }, '', '#leluhurqu');
      } else if (rtInvite) {
        localStorage.setItem('wargaqu_pending_rt_invite_v1', rtInvite);
        setCurrentScreen('rtqu');
        window.history.replaceState({ screen: 'rtqu' }, '', '#rtqu');
      } else if (isStorePreviewUrlRequested()) {
        setCurrentScreen('store');
      }
    } catch {
      // ignore URL/storage errors
    }

    const onHashInviteCheck = () => {
      if (isStorePreviewUrlRequested()) {
        setCurrentScreen('store');
        return;
      }
      const pairToken = extractPairFromLocation();
      if (pairToken) {
        try {
          localStorage.setItem(PENDING_PAIR_TOKEN_KEY, pairToken);
        } catch {
          // ignore
        }
        setCurrentScreen('akun');
        window.dispatchEvent(new CustomEvent('wargaqu-pair-invite-arrived'));
        return;
      }
      const trahInvite = extractInviteFromLocation();
      if (trahInvite) {
        try {
          localStorage.setItem('wargaqu_pending_trah_invite_v1', trahInvite);
        } catch {
          // ignore
        }
        setCurrentScreen('leluhurqu');
        window.dispatchEvent(new CustomEvent('wargaqu-trah-invite-arrived'));
        return;
      }
      const rtInvite = extractRtInviteFromLocation();
      if (rtInvite) {
        try {
          localStorage.setItem('wargaqu_pending_rt_invite_v1', rtInvite);
        } catch {
          // ignore
        }
        setCurrentScreen('rtqu');
        window.dispatchEvent(new CustomEvent('wargaqu-rt-invite-arrived'));
      }
    };
    window.addEventListener('hashchange', onHashInviteCheck);

    const broadcastActiveSessionIfNeeded = (acc: AuthAccount | null) => {
      if (!acc || !acc.email || !acc.sessionNonce) return;
      // Laptop hasil scan QR pairing sengaja berbagi sesi dengan HP host -> jangan tendang HP host
      if (DevicePairingService.getPairedHost()) return;
      if (lastBroadcastSessionNonceRef.current === acc.sessionNonce) return;
      lastBroadcastSessionNonceRef.current = acc.sessionNonce;
      RealtimeRelayService.joinCurrentChannels();
      RealtimeRelayService.publish(
        getAccountSessionChannel(acc.email),
        'auth:session_active',
        {
          email: acc.email.trim().toLowerCase(),
          deviceId: acc.deviceId,
          sessionNonce: acc.sessionNonce,
          issuedAt: acc.loggedInAt,
        }
      );
    };

    AuthService.getHiddenDeviceId(); // ensure persistent hidden device token exists
    const currentAcc = AuthService.getAccount();
    if (currentAcc) {
      RtSiagaStorage.syncAuthAccount(currentAcc);
      ZeroTrustService.registerOrTouchCurrentDevice(currentAcc.email, currentAcc.phone);
    }

    const refreshGovernanceState = () => {
      const nextEval = AccountGovernanceService.evaluateCurrentAccountAccess();
      setAccountAccess(prev => {
        if (prev.warningNote !== nextEval.warningNote || prev.status !== nextEval.status) {
          setWarningDismissed(false);
        }
        return nextEval;
      });
    };

    const handleAuthSync = () => {
      const nextAcc = AuthService.getAccount();
      setAuthAccount(nextAcc);
      if (nextAcc) {
        RtSiagaStorage.syncAuthAccount(nextAcc);
        ZeroTrustService.registerOrTouchCurrentDevice(nextAcc.email, nextAcc.phone);
        setProfile(prev => {
          const updated = { ...prev, phone: nextAcc.phone };
          StorageService.saveProfile(updated);
          return updated;
        });
        broadcastActiveSessionIfNeeded(nextAcc);
      } else {
        lastBroadcastSessionNonceRef.current = '';
        setTables(StorageService.getTables());
        setMenuList(StorageService.getMenu());
        setIngredients(StorageService.getIngredients());
        setHistory(StorageService.getHistory());
        setActiveOrders(StorageService.getActiveOrders());
        setProfile(StorageService.getProfile());
        setPrinterConfig(StorageService.getPrinterConfig());
      }
      if (!ZeroTrustService.isAdminEmail(nextAcc?.email) && currentScreenRef.current === 'admin_zero_trust') {
        ZeroTrustService.lockAdminSession();
        setCurrentScreen('warga');
        window.history.replaceState({ screen: 'warga' }, '', '#warga');
      }
      refreshGovernanceState();
      AccountGovernanceService.publishCurrentPresence(currentScreenRef.current);
    };

    const handlePairingSync = (ev: Event) => {
      const detail = (ev as CustomEvent<PairingSyncEventDetail>).detail;
      if (!detail?.remoteApplied) return;
      setTables(StorageService.getTables());
      setMenuList(StorageService.getMenu());
      setIngredients(StorageService.getIngredients());
      setHistory(StorageService.getHistory());
      setActiveOrders(StorageService.getActiveOrders());
      const latestAcc = AuthService.getAccount();
      setAuthAccount(latestAcc);
      const latestProf = StorageService.getProfile();
      setProfile(latestAcc ? { ...latestProf, phone: latestAcc.phone } : latestProf);
      setPrinterConfig(StorageService.getPrinterConfig());
      refreshGovernanceState();
    };

    window.addEventListener(AUTH_SYNC_EVENT, handleAuthSync);
    window.addEventListener(ACCOUNT_GOV_SYNC_EVENT, refreshGovernanceState);
    window.addEventListener(DEVICE_PAIRING_SYNC_EVENT, handlePairingSync);

    RealtimeRelayService.start();
    DevicePairingService.startLiveSync(showNotification);
    FirebaseSyncService.init();
    AutoBackupService.startAutoBackupMonitor();
    if (currentAcc) {
      broadcastActiveSessionIfNeeded(currentAcc);
    }
    void AccountGovernanceService.syncPolicyFromServer();
    AccountGovernanceService.publishCurrentPresence(currentScreenRef.current);
    const presenceInterval = window.setInterval(() => {
      AccountGovernanceService.publishCurrentPresence(currentScreenRef.current);
    }, 60000);

    const handleGlobalRelay = (evt: Event) => {
      const detail = (evt as CustomEvent<RelayIncomingEvent>).detail;
      if (!detail) return;

      if (detail.eventName === 'admin:monetize_rules' && Array.isArray(detail.payload)) {
        MonetizationService.applyRemoteRules(detail.payload as ModuleMonetizationRule[]);
      } else if (detail.eventName === 'admin:account_policies' && detail.payload) {
        AccountGovernanceService.applyRemotePolicies(detail.payload);
      } else if (detail.eventName === 'presence:heartbeat' && detail.payload) {
        AccountGovernanceService.ingestRemotePresence(detail.payload);
      } else if (detail.eventName === 'zt:device_freeze' && detail.payload && typeof detail.payload === 'object') {
        const p = detail.payload as { deviceId?: string; status?: DeviceTrustStatus; reason?: string };
        if (p.deviceId && p.status) {
          ZeroTrustService.applyRemoteFreeze(p.deviceId, p.status, p.reason);
          if (p.deviceId === AuthService.getHiddenDeviceId() && p.status === 'frozen_lost') {
            showNotification('PERHATIAN: Perangkat ini dibekukan oleh Zero Trust (HP Hilang).');
          }
        }
      } else if (detail.eventName === 'zt:frozen_list' && Array.isArray(detail.payload)) {
        const currentDev = AuthService.getHiddenDeviceId();
        if (detail.payload.includes(currentDev)) {
          ZeroTrustService.applyRemoteFreeze(currentDev, 'frozen_lost', 'Sinkronisasi daftar beku Zero Trust');
        }
      } else if (detail.eventName === 'rt:siaga_status' && detail.payload && typeof detail.payload === 'object') {
        const p = detail.payload as {
          email?: string;
          phone?: string;
          status?: 'active' | 'pending' | 'suspended';
          verifiedBy?: string;
          reason?: string;
        };
        const current = RtSiagaStorage.getCurrentMember();
        const acc = AuthService.getAccount();
        const matchesMe =
          (p.email && acc?.email && p.email.toLowerCase() === acc.email.toLowerCase()) ||
          (p.phone && acc?.phone && p.phone.replace(/\D/g, '') === acc.phone.replace(/\D/g, ''));
        if (matchesMe && p.status) {
          RtSiagaStorage.setMemberSiagaStatus(current.id, p.status, p.verifiedBy || 'Pengurus RT', p.reason);
          showNotification(
            p.status === 'active'
              ? 'SiagaQu Umum Anda telah DIAKTIFKAN oleh Pengurus RT!'
              : 'Status SiagaQu Umum Anda diperbarui oleh Pengurus RT.'
          );
        }
      } else if (detail.eventName === 'siaga:alert' && detail.payload && typeof detail.payload === 'object') {
        const p = detail.payload as { category?: string; senderName?: string; scopeLabel?: string };
        showNotification(
          `DARURAT SIAGAQU (${p.scopeLabel || 'Warga'}): ${p.category || 'Darurat'} dari ${p.senderName || 'Warga'}`
        );
      } else if (detail.eventName === 'order:areaqu' && detail.payload && typeof detail.payload === 'object') {
        const p = detail.payload as { lapakName?: string; consumerName?: string };
        showNotification(`Pesanan AreaQu baru untuk ${p.lapakName || 'Lapak'} dari ${p.consumerName || 'Warga'}`);
      } else if (detail.eventName === 'order:muamalahqu' && detail.payload && typeof detail.payload === 'object') {
        const p = detail.payload as { buyerName?: string; total?: number };
        showNotification(
          `Order MuamalahQu baru dari ${p.buyerName || 'Warga'} (Rp ${(p.total || 0).toLocaleString('id-ID')})`
        );
      } else if (detail.eventName === 'auth:session_active' && detail.payload && typeof detail.payload === 'object') {
        const p = detail.payload as {
          email?: string;
          deviceId?: string;
          sessionNonce?: string;
        };
        const activeAcc = AuthService.getAccount();
        const isCompanionLaptop = Boolean(DevicePairingService.getPairedHost());
        if (
          activeAcc &&
          !isCompanionLaptop &&
          p.email &&
          p.email.trim().toLowerCase() === activeAcc.email.trim().toLowerCase() &&
          p.deviceId &&
          p.deviceId !== activeAcc.deviceId &&
          p.sessionNonce &&
          p.sessionNonce !== activeAcc.sessionNonce
        ) {
          AuthService.logout();
          ZeroTrustService.appendAudit(
            activeAcc.email,
            'Sesi Tunggal Ditutup (Login di Perangkat Lain)',
            'Sesi di perangkat ini otomatis ditutup karena akun masuk dari perangkat lain',
            'info'
          );
          showNotification(
            'Akun Anda baru saja masuk di perangkat lain. Sesi di HP ini ditutup otomatis (Sesi Tunggal ala WhatsApp).'
          );
        }
      } else if (detail.eventName === 'smartcare:ticket' && detail.payload && typeof detail.payload === 'object') {
        if (SmartCareService.isDeveloperOrAdmin() || ZeroTrustService.isAdminSessionActive()) {
          const entry = detail.payload as SmartCareLogEntry;
          SmartCareService.ingestRemoteReport(entry);
          showNotification(
            `Laporan Smart Care baru (${entry.id}) dari ${entry.reporterName}: "${entry.complaint.slice(0, 45)}..."`
          );
        }
      }
    };
    window.addEventListener(REALTIME_RELAY_EVENT, handleGlobalRelay);

    setTables(StorageService.getTables());
    setMenuList(StorageService.getMenu());
    setIngredients(StorageService.getIngredients());
    setHistory(StorageService.getHistory());
    setActiveOrders(StorageService.getActiveOrders());
    const loadedProfile = StorageService.getProfile();
    setProfile(currentAcc ? { ...loadedProfile, phone: currentAcc.phone } : loadedProfile);
    if (currentAcc && loadedProfile.phone !== currentAcc.phone) {
      StorageService.saveProfile({ ...loadedProfile, phone: currentAcc.phone });
    }
    setPrinterConfig(StorageService.getPrinterConfig());

    return () => {
      window.clearInterval(presenceInterval);
      window.removeEventListener('hashchange', onHashInviteCheck);
      window.removeEventListener(AUTH_SYNC_EVENT, handleAuthSync);
      window.removeEventListener(ACCOUNT_GOV_SYNC_EVENT, refreshGovernanceState);
      window.removeEventListener(DEVICE_PAIRING_SYNC_EVENT, handlePairingSync);
      window.removeEventListener(REALTIME_RELAY_EVENT, handleGlobalRelay);
    };
  }, []);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  const currentScreenRef = useRef(currentScreen);
  const lastBackPressRef = useRef(0);

  useEffect(() => {
    currentScreenRef.current = currentScreen;
    AccountGovernanceService.publishCurrentPresence(currentScreen);

    if (accountAccess.status === 'banned' && !accountAccess.isAdminProtected) {
      return;
    }

    const screenToGuideMap: Partial<Record<AppScreen, GuideModuleId>> = {
      dompetqu: 'dompetqu',
      leluhurqu: 'leluhurqu',
      rtqu: 'rtqu',
      areaqu: 'areaqu',
      siagaqu: 'siagaqu',
      muamalahqu: 'muamalahqu',
      usahaqu: 'usahaqu',
      modularqu: 'usahaqu',
      chatqu: 'chatqu',
    };
    const guideId = screenToGuideMap[currentScreen];
    if (guideId && !ModuleOnboardingService.hasSeen(guideId)) {
      setModuleGuideState({ open: true, moduleId: guideId, isFirstVisit: true });
    }
  }, [currentScreen, accountAccess.status, accountAccess.isAdminProtected]);

  useEffect(() => {
    const onOpenGuide = (ev: Event) => {
      const customEv = ev as CustomEvent<{ moduleId?: GuideModuleId }>;
      const modId = customEv.detail?.moduleId;
      if (modId) {
        setModuleGuideState({ open: true, moduleId: modId, isFirstVisit: false });
      }
    };
    window.addEventListener(OPEN_MODULE_GUIDE_EVENT, onOpenGuide);
    return () => window.removeEventListener(OPEN_MODULE_GUIDE_EVENT, onOpenGuide);
  }, []);

  // Tangani tombol Back HP / Browser di tingkat aplikasi
  useEffect(() => {
    const hasPendingInvite = Boolean(
      localStorage.getItem('wargaqu_pending_trah_invite_v1') ||
        localStorage.getItem('wargaqu_pending_rt_invite_v1') ||
        localStorage.getItem(PENDING_PAIR_TOKEN_KEY)
    );
    if (!hasPendingInvite && !isStorePreviewUrlRequested()) {
      window.history.replaceState({ screen: 'warga' }, '', '#warga');
    }

    const handleGlobalBack = () => {
      // Jika sedang berada di sub-screen selain warga, kembalikan ke beranda warga
      if (currentScreenRef.current !== 'warga') {
        setCurrentScreen('warga');
        window.history.pushState({ screen: 'warga' }, '', '#warga');
        return;
      }

      // Jika di layar utama (warga), cegah langsung keluar aplikasi secara tidak sengaja
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        showNotification('Sampai jumpa!');
      } else {
        lastBackPressRef.current = now;
        showNotification('Tekan sekali lagi untuk keluar aplikasi');
        // Push state kembali agar tombol back berikutnya tetap tertangkap
        window.history.pushState({ screen: 'warga' }, '', '#warga');
      }
    };

    const onPopState = () => {
      handleGlobalBack();
    };

    window.addEventListener('popstate', onPopState);

    let capListener: any = null;
    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        CapApp.addListener('backButton', () => {
          handleGlobalBack();
        })
          .then((l) => {
            capListener = l;
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('popstate', onPopState);
      if (capListener?.remove) {
        capListener.remove();
      }
    };
  }, []);

  const handleOpenDompetQu = () => {
    setCurrentScreen('dompetqu');
    window.history.pushState({ screen: 'dompetqu' }, '', '#dompetqu');
  };

  const handleOpenLeluhurQu = () => {
    setCurrentScreen('leluhurqu');
    window.history.pushState({ screen: 'leluhurqu' }, '', '#leluhurqu');
    showNotification('Membuka LeluhurQu: Silsilah Trah Keluarga');
  };

  const handleOpenRtQu = (tab?: 'ringkasan' | 'forum' | 'keuangan' | 'iuran' | 'pengurus') => {
    const targetTab = typeof tab === 'string' ? tab : 'ringkasan';
    setRtQuInitialTab(targetTab);
    setCurrentScreen('rtqu');
    window.history.pushState({ screen: 'rtqu', tab: targetTab }, '', '#rtqu');
  };

  const handleOpenSiagaQu = () => {
    setCurrentScreen('siagaqu');
    window.history.pushState({ screen: 'siagaqu' }, '', '#siagaqu');
  };

  const handleOpenUsahaQu = (mode: 'resto' | 'modular' = 'resto') => {
    setUsahaQuMode(mode);
    setCurrentScreen('usahaqu');
    window.history.pushState({ screen: 'usahaqu', mode }, '', '#usahaqu-' + mode);
    showNotification(
      mode === 'modular'
        ? 'Membuka UsahaQu: Mode POS Modular Voice AI ⚡'
        : 'Membuka UsahaQu: Mode Restoran Resto Qu 🍲'
    );
  };

  const handleOpenModularQu = () => {
    handleOpenUsahaQu('modular');
  };

  const handleOpenBantuan = () => {
    setCurrentScreen('bantuan');
    window.history.pushState({ screen: 'bantuan' }, '', '#bantuan');
    showNotification('Membuka UsahaQu Smart Care & Pusat Bantuan');
  };

  const handleOpenChatQu = (tab?: 'community' | 'chats' | 'announcements' | 'emergency') => {
    const targetTab = typeof tab === 'string' ? tab : 'chats';
    setChatQuInitialTab(targetTab);
    setCurrentScreen('chatqu');
    window.history.pushState({ screen: 'chatqu', tab: targetTab }, '', '#chatqu');
  };

  const handleOpenMuamalahQu = () => {
    setCurrentScreen('muamalahqu');
    window.history.pushState({ screen: 'muamalahqu' }, '', '#muamalahqu');
  };

  const handleOpenAreaQu = (tab?: 'jelajah' | 'lapak' | 'aktivitas' | 'identitas') => {
    const targetTab = typeof tab === 'string' ? tab : 'jelajah';
    setAreaQuInitialTab(targetTab);
    setCurrentScreen('areaqu');
    window.history.pushState({ screen: 'areaqu', tab: targetTab }, '', '#areaqu');
  };

  const handleOpenAdminZeroTrust = () => {
    if (!ZeroTrustService.isCurrentUserAdminAccount()) {
      showNotification('Panel Admin hanya tersedia untuk akun Admin terdaftar.');
      return;
    }
    setCurrentScreen('admin_zero_trust');
    window.history.pushState({ screen: 'admin_zero_trust' }, '', '#admin-zero-trust');
  };

  const handleOpenEmptyModule = (moduleId: string) => {
    if (moduleId === 'akun' || moduleId === 'setting') {
      setCurrentScreen('akun');
      window.history.pushState({ screen: 'akun' }, '', '#akun');
      return;
    }
    if (moduleId === 'admin_zero_trust') {
      handleOpenAdminZeroTrust();
      return;
    }
    if (moduleId === 'dompetqu') {
      handleOpenDompetQu();
      return;
    }
    if (moduleId === 'leluhurqu') {
      handleOpenLeluhurQu();
      return;
    }
    if (moduleId === 'chatqu') {
      handleOpenChatQu();
      return;
    }
    if (moduleId === 'muamalahqu') {
      handleOpenMuamalahQu();
      return;
    }
    if (moduleId === 'areaqu') {
      handleOpenAreaQu();
      return;
    }
    setSelectedEmptyModule(moduleId);
    setCurrentScreen('empty_module');
    window.history.pushState({ screen: 'empty_module', moduleId }, '', '#' + moduleId);
  };

  const handleOpenLogin = (reason?: string) => {
    setLoginModal({ open: true, reason });
  };

  const handleBackToWarga = () => {
    setCurrentScreen('warga');
    window.history.pushState({ screen: 'warga' }, '', '#warga');
  };

  const handleOpenStorePreview = () => {
    setCurrentScreen('store');
    window.history.pushState({ screen: 'store' }, '', '#store');
  };

  const handleEnterAppFromStore = (targetScreen: PreviewTargetScreen = 'warga') => {
    if (typeof window !== 'undefined') {
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('preview');
        cleanUrl.searchParams.delete('store');
        cleanUrl.hash = targetScreen === 'warga' ? '#warga' : `#${targetScreen}`;
        window.history.pushState({ screen: targetScreen }, '', cleanUrl.toString());
      } catch {
        // ignore URL cleanup
      }
    }
    if (targetScreen === 'usahaqu') {
      handleOpenUsahaQu('resto');
      return;
    }
    if (targetScreen === 'rtqu') {
      handleOpenRtQu();
      return;
    }
    if (targetScreen === 'areaqu') {
      handleOpenAreaQu();
      return;
    }
    if (targetScreen === 'leluhurqu') {
      handleOpenLeluhurQu();
      return;
    }
    if (targetScreen === 'siagaqu') {
      handleOpenSiagaQu();
      return;
    }
    if (targetScreen === 'dompetqu') {
      handleOpenDompetQu();
      return;
    }
    if (targetScreen === 'muamalahqu') {
      handleOpenMuamalahQu();
      return;
    }
    setCurrentScreen('warga');
  };

  const activeOrderCount = Object.keys(activeOrders).length;

  if (currentScreen === 'store') {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-white relative">
        {notification && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-50 bg-emerald-950/95 text-[#5eead4] px-4 py-2 rounded-2xl shadow-xl border border-emerald-500/40 text-xs font-semibold flex items-center justify-between">
            <span>{notification}</span>
          </div>
        )}
        <StorePreviewView
          onEnterApp={handleEnterAppFromStore}
          showNotification={showNotification}
        />
      </div>
    );
  }

  return (
    <AndroidFrame>
      {/* Dynamic Admin Warning Banner */}
      {accountAccess.status === 'warning' && !warningDismissed && !accountAccess.isAdminProtected && (
        <div className="bg-amber-50 border-b border-amber-300 px-3.5 py-2.5 text-amber-950 flex items-start justify-between gap-2 shrink-0 z-40">
          <div className="text-[11px] leading-snug">
            <span className="font-extrabold uppercase tracking-wide text-amber-800 block">
              Peringatan Resmi Admin
            </span>
            <span>{accountAccess.warningNote}</span>
          </div>
          <button
            type="button"
            onClick={() => setWarningDismissed(true)}
            className="px-2 py-1 text-[10px] font-bold bg-amber-200/80 hover:bg-amber-300 rounded-lg shrink-0"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Dynamic Admin Banned Blocking Overlay */}
      {accountAccess.status === 'banned' && !accountAccess.isAdminProtected && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 font-black text-xl">
              !
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Akun Dibatasi (Banned)</h2>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {accountAccess.banReason ||
                  'Akses akun ini dinonaktifkan sementara oleh Admin Zero Trust.'}
              </p>
            </div>
            <div className="text-[11px] text-slate-400 bg-slate-950/80 border border-slate-800 rounded-xl p-3">
              Email: <span className="font-mono text-slate-200">{authAccount?.email || '-'}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                AuthService.logout();
                setAccountAccess(AccountGovernanceService.evaluateCurrentAccountAccess());
                setCurrentScreen('warga');
                showNotification('Keluar dari akun yang dibatasi.');
              }}
              className="w-full min-h-[42px] bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
            >
              Keluar / Ganti Akun
            </button>
          </div>
        </div>
      )}

      {/* Pop-up Notification Toast across views */}
      {notification && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-50 bg-emerald-950/95 text-[#5eead4] px-4 py-2 rounded-2xl shadow-xl border border-emerald-500/40 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top duration-200">
          <span>{notification}</span>
        </div>
      )}

      {/* Screen 1: WargaQu Mobile App Dashboard */}
      {currentScreen === 'warga' && (
        <WargaDashboard
          onOpenDompetQu={handleOpenDompetQu}
          onOpenLeluhurQu={handleOpenLeluhurQu}
          onOpenRtQu={handleOpenRtQu}
          onOpenSiagaQu={handleOpenSiagaQu}
          onOpenUsahaQu={handleOpenUsahaQu}
          onOpenModularQu={handleOpenModularQu}
          onOpenBantuan={handleOpenBantuan}
          onOpenChatQu={handleOpenChatQu}
          onOpenMuamalahQu={handleOpenMuamalahQu}
          onOpenAreaQu={handleOpenAreaQu}
          onOpenEmptyModule={handleOpenEmptyModule}
          onOpenLogin={handleOpenLogin}
          onOpenStorePreview={handleOpenStorePreview}
          activeOrderCount={activeOrderCount}
        />
      )}

      {/* Screen DompetQu: Keuangan Pribadi Terisolasi */}
      {currentScreen === 'dompetqu' && (
        <DompetQuView
          onBackToWarga={handleBackToWarga}
          showNotification={showNotification}
        />
      )}

      {/* Screen Akun & Setting Terpadu */}
      {currentScreen === 'akun' && (
        <AccountView
          onBack={handleBackToWarga}
          onOpenRtQu={handleOpenRtQu}
          onOpenSiagaQu={handleOpenSiagaQu}
          onOpenAdminZeroTrust={handleOpenAdminZeroTrust}
          onOpenStorePreview={handleOpenStorePreview}
          showNotification={showNotification}
        />
      )}

      {/* Screen Panel Admin Zero Trust, Monetisasi & HP Hilang/Rusak (Hanya Akun Admin) */}
      {currentScreen === 'admin_zero_trust' && ZeroTrustService.isCurrentUserAdminAccount() && (
        <AdminZeroTrustView
          onBack={handleBackToWarga}
          showNotification={showNotification}
        />
      )}

      {/* Screen LeluhurQu: Modul LeluhurQu (Silsilah Trah Keluarga) */}
      {currentScreen === 'leluhurqu' && (
        <LeluhurQuView
          onBackToWarga={handleBackToWarga}
          showNotification={showNotification}
          onOpenChatQu={handleOpenChatQu}
        />
      )}

      {/* Screen 2: Modul RtQu (Pengurusan RT 03 / RW 05 & PaguyubanQu) */}
      {currentScreen === 'rtqu' && (
        <RtQuView
          onBackToMain={handleBackToWarga}
          onOpenUsahaQu={handleOpenUsahaQu}
          onOpenSiagaQu={handleOpenSiagaQu}
          showNotification={showNotification}
          initialTab={rtQuInitialTab}
        />
      )}

      {/* Screen 3: Modul SiagaQu (Panic Button & Radar Darurat) */}
      {currentScreen === 'siagaqu' && (
        <SiagaQuView
          onBackToMain={handleBackToWarga}
          showNotification={showNotification}
          onOpenChatQu={handleOpenChatQu}
          onOpenRtQu={() => handleOpenRtQu('pengurus')}
          onOpenLogin={handleOpenLogin}
        />
      )}

      {/* Screen 4: Modul ChatQu (WhatsApp-style citizen coordination) */}
      {currentScreen === 'chatqu' && (
        <ChatQuView
          onBackToMain={handleBackToWarga}
          showNotification={showNotification}
          onOpenLogin={handleOpenLogin}
          initialTab={chatQuInitialTab}
        />
      )}

      {/* Screen 5: Modul MuamalahQu (Marketplace Warga Shopee-style) */}
      {currentScreen === 'muamalahqu' && (
        <MuamalahQuView
          onBackToMain={handleBackToWarga}
          menuList={menuList}
          setMenuList={setMenuList}
          showNotification={showNotification}
          onOpenChatQu={handleOpenChatQu}
        />
      )}

      {/* Screen 6: Modul AreaQu (Peta OSM & Radar Kawasan Grab Driver-style) */}
      {currentScreen === 'areaqu' && (
        <AreaQuView
          onBackToMain={handleBackToWarga}
          onOpenSiagaQu={handleOpenSiagaQu}
          onOpenChatQu={handleOpenChatQu}
          onOpenUsahaQu={handleOpenUsahaQu}
          menuList={menuList}
          showNotification={showNotification}
          initialTab={areaQuInitialTab}
        />
      )}

      {/* Screen 7: UsahaQu (Unified 2-in-1 POS: Resto Qu & Modular Voice AI) */}
      {currentScreen === 'usahaqu' && (
        <UsahaQuView
          onBackToWarga={handleBackToWarga}
          onOpenModularQu={handleOpenModularQu}
          onOpenBantuan={handleOpenBantuan}
          initialMode={usahaQuMode}
          tables={tables}
          setTables={setTables}
          menuList={menuList}
          setMenuList={setMenuList}
          ingredients={ingredients}
          setIngredients={setIngredients}
          history={history}
          setHistory={setHistory}
          activeOrders={activeOrders}
          setActiveOrders={setActiveOrders}
          profile={profile}
          setProfile={setProfile}
          printerConfig={printerConfig}
          setPrinterConfig={setPrinterConfig}
          showNotification={showNotification}
        />
      )}

      {/* Screen 8: Alias modularqu -> UsahaQu in Modular Mode */}
      {currentScreen === 'modularqu' && (
        <UsahaQuView
          onBackToWarga={handleBackToWarga}
          onOpenModularQu={handleOpenModularQu}
          onOpenBantuan={handleOpenBantuan}
          initialMode="modular"
          tables={tables}
          setTables={setTables}
          menuList={menuList}
          setMenuList={setMenuList}
          ingredients={ingredients}
          setIngredients={setIngredients}
          history={history}
          setHistory={setHistory}
          activeOrders={activeOrders}
          setActiveOrders={setActiveOrders}
          profile={profile}
          setProfile={setProfile}
          printerConfig={printerConfig}
          setPrinterConfig={setPrinterConfig}
          showNotification={showNotification}
        />
      )}

      {/* Screen 9: UsahaQu Smart Care & Pusat Bantuan */}
      {currentScreen === 'bantuan' && (
        <BantuanView
          onBackToWarga={handleBackToWarga}
          showNotification={showNotification}
        />
      )}

      {/* Screen 10: Empty Modules (QRIS, Aktivitas, etc.) */}
      {currentScreen === 'empty_module' && (
        <EmptyModuleView
          moduleId={selectedEmptyModule}
          onBack={handleBackToWarga}
          onOpenUsahaQu={handleOpenUsahaQu}
        />
      )}

      {/* Global Login Modal (Email + No HP + Hidden Device ID) */}
      <LoginModal
        isOpen={loginModal.open}
        reasonMessage={loginModal.reason}
        onClose={() => setLoginModal({ open: false })}
        onSuccess={() => setLoginModal({ open: false })}
        showNotification={showNotification}
      />

      {/* Global 1x First-Visit / On-Demand Module Guide Modal */}
      <ModuleGuideModal
        isOpen={moduleGuideState.open}
        moduleId={moduleGuideState.moduleId}
        isFirstVisit={moduleGuideState.isFirstVisit}
        onClose={() =>
          setModuleGuideState((prev) => ({ ...prev, open: false }))
        }
        showNotification={showNotification}
      />
    </AndroidFrame>
  );
}
