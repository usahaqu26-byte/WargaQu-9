import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  QrCode,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  PhoneCall,
  Plus,
  X,
  Send,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Megaphone,
  Store,
  Share2,
  ThumbsUp,
  MessageSquare,
  UserPlus,
  FileSpreadsheet,
  KeyRound,
  Download,
  MailOpen,
  Archive,
  Link2,
  Copy,
  Users,
  LogOut,
  Sparkles,
  Trash2,
  Building2,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { ModuleOnboardingService } from '../../services/moduleOnboardingService';
import {
  RtSiagaStorage,
  RT_SYNC_EVENT,
  PENDING_RT_INVITE_KEY,
  CARRYOVER_RT_INVITE_KEY,
  MONTHS_12,
  OrgType,
  RtCommunityWorkspace,
  PaguyubanProfile,
  CoordinatorMember,
  WargaMember,
  KasTransaction,
  KasCategory,
  SiagaAuditLog,
  ForumPost,
  ForumCategory,
  AspirationStatus,
  GuestReport,
  HistoricalArchiveYear,
  CommunityInvitation,
  InvitationEventType,
  InvitationRsvpStatus,
  RtOfficerAccount,
  RtHandoverRecord,
  RtGovernanceAction
} from '../../services/rtSiagaStorage';
import { AuthService, AUTH_SYNC_EVENT } from '../../services/authService';
import { RtExcelService } from '../../services/rtExcelService';
import { RtExcelAndClaimSheet, ExtraSheetType } from './RtExcelAndClaimSheet';
import { RtGovernanceManager, RtTenureBanner } from './RtGovernancePanel';
import { RtGovernanceCloudService } from '../../services/rtGovernanceCloudService';
import { FIREBASE_AUTH_SYNC_EVENT, FirebaseSyncService } from '../../services/firebaseSyncService';
import { MonetizationService } from '../../services/monetizationService';
import { EncryptedBackupPanel } from '../common/EncryptedBackupPanel';
import { RealtimeRelayService } from '../../services/realtimeRelayService';
import {
  getSyncChannelName,
  InviteRelayService,
  parseInviteInput,
  REALTIME_RELAY_EVENT_NAME,
  RELAY_REGISTER_CHANNELS_EVENT,
} from '../../services/inviteRelayService';

interface RtQuViewProps {
  onBackToMain: () => void;
  onOpenUsahaQu: () => void;
  onOpenSiagaQu?: () => void;
  showNotification: (msg: string) => void;
  initialTab?: MainTab;
}

type MainTab = 'ringkasan' | 'forum' | 'keuangan' | 'iuran' | 'pengurus';
type PengurusSubTab = 'koordinator' | 'warga' | 'audit' | 'pengaturan';
type SheetModalType =
  | 'bayar'
  | 'surat'
  | 'buat_surat'
  | 'ronda'
  | 'tamu'
  | 'buat_post'
  | 'catat_kas'
  | 'koreksi_kas'
  | 'pin_pengurus'
  | 'buat_komunitas'
  | 'undang_komunitas'
  | ExtraSheetType
  | null;

export const RtQuView: React.FC<RtQuViewProps> = ({
  onBackToMain,
  onOpenUsahaQu,
  onOpenSiagaQu,
  showNotification,
  initialTab = 'ringkasan',
}) => {
  // Shared synced state (per-account isolated & invite-only)
  const [communities, setCommunities] = useState<RtCommunityWorkspace[]>(() =>
    RtSiagaStorage.getCommunities()
  );
  const [activeCommunity, setActiveCommunity] = useState<RtCommunityWorkspace | null>(() =>
    RtSiagaStorage.getActiveCommunity()
  );
  const [isOwner, setIsOwner] = useState<boolean>(() => RtSiagaStorage.isOwnerAccount());
  const [profile, setProfile] = useState<PaguyubanProfile>(() => RtSiagaStorage.getProfile());
  const [coordinators, setCoordinators] = useState<CoordinatorMember[]>(() => RtSiagaStorage.getCoordinators());
  const [members, setMembers] = useState<WargaMember[]>(() => RtSiagaStorage.getMembers());
  const [transactions, setTransactions] = useState<KasTransaction[]>(() => RtSiagaStorage.getTransactions());
  const [auditLogs, setAuditLogs] = useState<SiagaAuditLog[]>(() => RtSiagaStorage.getAuditLogs());
  const [forumPosts, setForumPosts] = useState<ForumPost[]>(() => RtSiagaStorage.getForumPosts());
  const [guestReports, setGuestReports] = useState<GuestReport[]>(() => RtSiagaStorage.getGuestReports());
  const [archives, setArchives] = useState<HistoricalArchiveYear[]>(() => RtSiagaStorage.getArchives());
  const [invitations, setInvitations] = useState<CommunityInvitation[]>(() => RtSiagaStorage.getInvitations());
  const [officers, setOfficers] = useState<RtOfficerAccount[]>(() => RtSiagaStorage.getOfficers());
  const [handovers, setHandovers] = useState<RtHandoverRecord[]>(() => RtSiagaStorage.getHandovers());
  const [governanceActions, setGovernanceActions] = useState<RtGovernanceAction[]>(() =>
    RtSiagaStorage.getGovernanceActions()
  );
  const [invitationPrefill, setInvitationPrefill] = useState<{
    eventType?: InvitationEventType;
    title?: string;
    agenda?: string;
  } | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<KasTransaction | null>(null);
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // Invite link & create community states
  const [inviteJoinInput, setInviteJoinInput] = useState<string>('');
  const [isJoiningInvite, setIsJoiningInvite] = useState<boolean>(false);
  const [autoJoinedBanner, setAutoJoinedBanner] = useState<{
    communityName: string;
    inviter: string;
    orgType: OrgType;
  } | null>(null);
  const [pendingRtSync, setPendingRtSync] = useState<{
    title: string;
    canonicalSlug: string;
    rawInput: string;
    isSyncing: boolean;
  } | null>(null);
  const [compactInviteToken, setCompactInviteToken] = useState<string>('');
  const [shortInviteUrl, setShortInviteUrl] = useState<string>('');
  const [createCommForm, setCreateCommForm] = useState<{
    orgType: OrgType;
    customBrandName: string;
    orgName: string;
    areaName: string;
    monthlyDuesAmount: string;
    creatorName: string;
    creatorBlock: string;
    creatorPhone: string;
    creatorRole: string;
    pengurusPin: string;
    termEndDate: string;
    sekretarisEmail: string;
    bendaharaEmail: string;
  }>(() => {
    const acc = AuthService.getAccount();
    const defaultEnd = new Date();
    defaultEnd.setFullYear(defaultEnd.getFullYear() + 3);
    return {
      orgType: 'RT',
      customBrandName: '',
      orgName: '',
      areaName: '',
      monthlyDuesAmount: '50000',
      creatorName: acc ? AuthService.getDisplayName(acc) : '',
      creatorBlock: '',
      creatorPhone: acc?.phone || '',
      creatorRole: '',
      pengurusPin: '1234',
      termEndDate: defaultEnd.toISOString().slice(0, 10),
      sekretarisEmail: '',
      bendaharaEmail: '',
    };
  });

  useEffect(() => {
    const syncAll = () => {
      setCommunities(RtSiagaStorage.getCommunities());
      setActiveCommunity(RtSiagaStorage.getActiveCommunity());
      setIsOwner(RtSiagaStorage.isOwnerAccount());
      setProfile(RtSiagaStorage.getProfile());
      setCoordinators(RtSiagaStorage.getCoordinators());
      setMembers(RtSiagaStorage.getMembers());
      setTransactions(RtSiagaStorage.getTransactions());
      setAuditLogs(RtSiagaStorage.getAuditLogs());
      setForumPosts(RtSiagaStorage.getForumPosts());
      setGuestReports(RtSiagaStorage.getGuestReports());
      setArchives(RtSiagaStorage.getArchives());
      setInvitations(RtSiagaStorage.getInvitations());
      setOfficers(RtSiagaStorage.getOfficers());
      setHandovers(RtSiagaStorage.getHandovers());
      setGovernanceActions(RtSiagaStorage.getGovernanceActions());
    };
    window.addEventListener(RT_SYNC_EVENT, syncAll);
    window.addEventListener(AUTH_SYNC_EVENT, syncAll);
    window.addEventListener(FIREBASE_AUTH_SYNC_EVENT, syncAll);
    window.addEventListener('focus', syncAll);
    return () => {
      window.removeEventListener(RT_SYNC_EVENT, syncAll);
      window.removeEventListener(AUTH_SYNC_EVENT, syncAll);
      window.removeEventListener(FIREBASE_AUTH_SYNC_EVENT, syncAll);
      window.removeEventListener('focus', syncAll);
    };
  }, []);

  // Pull & subscribe Firestore community data when signed in with Google
  useEffect(() => {
    if (!FirebaseSyncService.isCloudSignedIn()) return;
    void RtGovernanceCloudService.fetchMyOfficerCommunities();
    if (!activeCommunity?.id) return;
    return RtGovernanceCloudService.subscribeActiveCommunity(activeCommunity.id);
  }, [activeCommunity?.id]);

  const currentUser = useMemo(
    () => members.find(m => m.isCurrentUser) || members[0] || RtSiagaStorage.getCurrentMember(),
    [members]
  );

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<MainTab>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [forumFilter, setForumFilter] = useState<'semua' | 'undangan' | ForumCategory>('semua');
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [kasFilter, setKasFilter] = useState<'semua' | 'masuk' | 'keluar'>('semua');
  const [pengurusSubTab, setPengurusSubTab] = useState<PengurusSubTab>('koordinator');
  const [wargaFilter, setWargaFilter] = useState<'semua' | 'unclaimed' | 'claimed'>('semua');
  const [isSaldoHidden, setIsSaldoHidden] = useState<boolean>(false);

  // Pengurus / Koordinator Auth
  const [isPengurusMode, setIsPengurusMode] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');

  // Modal / Sheet States
  const [activeSheet, setActiveSheet] = useState<SheetModalType>(null);
  const [selectedPayMonths, setSelectedPayMonths] = useState<string[]>(['10']);

  // Surat, Tamu & Forum Create States
  const [suratForm, setSuratForm] = useState({
    jenis: 'Surat Pengantar Pembuatan KTP / KK',
    keperluan: '',
  });
  const [riwayatSurat, setRiwayatSurat] = useState([
    {
      id: 'SRT-01',
      jenis: 'Surat Pengantar Domisili Tinggal',
      tanggal: '28 Okt 2026',
      status: 'Diproses',
      nomor: 'Menunggu Persetujuan Ketua',
    },
    {
      id: 'SRT-02',
      jenis: 'Surat Keterangan Usaha (UMKM)',
      tanggal: '15 Sep 2026',
      status: 'Selesai',
      nomor: '470/03/RT-03/IX/2026',
    },
  ]);

  const [guestForm, setGuestForm] = useState({
    guestName: '',
    relation: 'Keluarga / Kerabat',
    duration: '2 Hari',
  });

  const [postForm, setPostForm] = useState<{
    category: ForumCategory;
    title: string;
    content: string;
    scheduleDate: string;
    scheduleLocation: string;
    pollOption1: string;
    pollOption2: string;
  }>({
    category: 'aspirasi',
    title: '',
    content: '',
    scheduleDate: '',
    scheduleLocation: '',
    pollOption1: 'Setuju',
    pollOption2: 'Tidak Setuju',
  });

  // Add Kas Transaction Form (Pengurus Mode)
  const [kasForm, setKasForm] = useState<{
    type: 'masuk' | 'keluar';
    category: KasCategory;
    title: string;
    amount: string;
  }>({
    type: 'keluar',
    category: 'Gaji Keamanan',
    title: '',
    amount: '',
  });

  // Org Settings Draft (Pengurus Mode)
  const [orgDraft, setOrgDraft] = useState<PaguyubanProfile>(profile);
  useEffect(() => {
    setOrgDraft(profile);
  }, [profile]);

  // Financial Metrics (Derived live from transactions)
  const financialSummary = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    let keamananKeluar = 0;
    let sampahKeluar = 0;
    let operasionalKeluar = 0;

    transactions.forEach(tx => {
      if (tx.type === 'masuk') {
        masuk += tx.amount;
      } else {
        keluar += tx.amount;
        if (tx.category === 'Gaji Keamanan') keamananKeluar += tx.amount;
        else if (tx.category === 'Petugas Sampah') sampahKeluar += tx.amount;
        else operasionalKeluar += tx.amount;
      }
    });

    return {
      saldo: masuk - keluar,
      masuk,
      keluar,
      keamananKeluar,
      sampahKeluar,
      operasionalKeluar,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (kasFilter === 'semua') return transactions;
    return transactions.filter(t => t.type === kasFilter);
  }, [transactions, kasFilter]);

  const filteredForumPosts = useMemo(() => {
    if (forumFilter === 'undangan') return [];
    if (forumFilter === 'semua') return forumPosts;
    return forumPosts.filter(p => p.category === forumFilter);
  }, [forumPosts, forumFilter]);

  const filteredMembers = useMemo(() => {
    if (wargaFilter === 'unclaimed') {
      return members.filter(m => m.claimStatus !== 'claimed');
    }
    if (wargaFilter === 'claimed') {
      return members.filter(m => m.claimStatus === 'claimed');
    }
    return members;
  }, [members, wargaFilter]);

  const unclaimedCount = useMemo(
    () => members.filter(m => m.claimStatus !== 'claimed').length,
    [members]
  );

  const paidMonthsCount = useMemo(() => {
    return Object.values(currentUser.monthlyPayments).filter(p => p.paid).length;
  }, [currentUser]);

  const unpaidMonthKeys = useMemo(() => {
    return MONTHS_12.filter(m => !currentUser.monthlyPayments[m.key]?.paid).map(m => m.key);
  }, [currentUser]);

  const currentMonthKey = '10'; // Oktober 2026
  const isCurrentMonthPaid = Boolean(currentUser.monthlyPayments[currentMonthKey]?.paid);

  const termHealth = useMemo(() => RtSiagaStorage.getTermHealth(profile), [profile]);
  const isAccountOfficer = useMemo(
    () => RtSiagaStorage.isCurrentUserOfficer(activeCommunity),
    [activeCommunity, officers]
  );

  const openElectionInviteModal = () => {
    setInvitationPrefill({
      eventType: 'Rapat Warga',
      title: `Musyawarah Pemilihan Pengurus Baru ${profile.orgName}`,
      agenda: `1. Laporan Pertanggungjawaban & Kas Akhir Periode ${termHealth.periodLabel}\n2. Pembentukan Panitia & Pemilihan Pengurus Baru (>2 Pengurus Inti)\n3. Penetapan Jadwal Serah Terima Jabatan (Sertijab)`,
    });
    setActiveSheet('buat_undangan');
  };

  const openElectionPollModal = () => {
    setPostForm({
      category: 'polling',
      title: `Jadwal Musyawarah Pemilihan Pengurus ${profile.orgName}`,
      content: `Masa bakti pengurus periode ${termHealth.periodLabel} akan berakhir pada ${termHealth.termEndDate}. Mari tentukan jadwal musyawarah pemilihan pengurus baru.`,
      scheduleDate: '',
      scheduleLocation: 'Balai Warga',
      pollOption1: 'Sabtu Malam Pekan Ini (19:30 WIB)',
      pollOption2: 'Minggu Pagi Pekan Depan (09:00 WIB)',
    });
    setActiveSheet('buat_post');
  };

  const brandTitle =
    profile.orgType === 'Organisasi'
      ? profile.customBrandName?.trim() || 'OrganisasiQu'
      : profile.orgType === 'Sosial'
      ? profile.customBrandName?.trim() || 'SosialQu'
      : profile.orgType === 'Paguyuban'
      ? 'PaguyubanQu'
      : 'RTQu';

  // Auto-process incoming invite (?rt=RT-03-... / ?paguyuban=... / ?grup=...) & carryover on auth login
  useEffect(() => {
    let cancelled = false;
    const processPendingInvite = async () => {
      let token = '';
      let fromCarryover = false;
      try {
        const pending = localStorage.getItem(PENDING_RT_INVITE_KEY);
        if (pending) {
          token = pending;
          localStorage.removeItem(PENDING_RT_INVITE_KEY);
          if (!AuthService.getAccount()) {
            sessionStorage.setItem(CARRYOVER_RT_INVITE_KEY, pending);
          }
        } else if (AuthService.getAccount()) {
          const carry = sessionStorage.getItem(CARRYOVER_RT_INVITE_KEY);
          if (carry) {
            token = carry;
            fromCarryover = true;
            sessionStorage.removeItem(CARRYOVER_RT_INVITE_KEY);
          }
        }
      } catch {
        // ignore
      }
      if (!token) return;

      const parsedHint = parseInviteInput(token, 'rt');
      if (parsedHint?.mode === 'room_slug') {
        setPendingRtSync({
          title: parsedHint.titleGuess,
          canonicalSlug: parsedHint.canonicalSlug,
          rawInput: token,
          isSyncing: true,
        });
      }

      const res = await RtSiagaStorage.acceptCommunityInvite(token);
      if (cancelled) return;
      if (res.ok && res.community) {
        setPendingRtSync(null);
        if (RtGovernanceCloudService.isCloudReady()) {
          void RtGovernanceCloudService.ensureUidMemberLink(
            res.community.id,
            res.community.profile.inviteCode || ''
          );
        }
        setAutoJoinedBanner({
          communityName: res.community.profile.orgName,
          inviter: res.inviter || 'Pengurus',
          orgType: res.community.profile.orgType,
        });
        setActiveTab('ringkasan');
        setIsPengurusMode(false);
        if (!fromCarryover) {
          showNotification(res.message);
        }
      } else if (res.pendingSync) {
        setPendingRtSync({
          title: res.pendingSync.title,
          canonicalSlug: res.pendingSync.canonicalSlug,
          rawInput: res.pendingSync.rawInput,
          isSyncing: false,
        });
        if (!fromCarryover) {
          showNotification(res.message);
        }
      } else if (!fromCarryover) {
        setPendingRtSync(null);
        showNotification(res.message);
      }
    };

    void processPendingInvite();
    const onInviteArrived = () => {
      void processPendingInvite();
    };
    window.addEventListener('wargaqu-rt-invite-arrived', onInviteArrived);
    window.addEventListener(AUTH_SYNC_EVENT, onInviteArrived);
    return () => {
      cancelled = true;
      window.removeEventListener('wargaqu-rt-invite-arrived', onInviteArrived);
      window.removeEventListener(AUTH_SYNC_EVENT, onInviteArrived);
    };
  }, [showNotification]);

  // Listen for live P2P snapshot when waiting for sync
  useEffect(() => {
    if (!pendingRtSync) return;
    const ch = getSyncChannelName('rt', pendingRtSync.canonicalSlug);
    window.dispatchEvent(
      new CustomEvent(RELAY_REGISTER_CHANNELS_EVENT, { detail: { channels: [ch] } })
    );
    const onRelay = (ev: Event) => {
      const d = (ev as CustomEvent<{
        channel?: string;
        eventName?: string;
        payload?: { snapshot?: string };
      }>).detail;
      if (!d || d.channel !== ch || d.eventName !== 'sync:snapshot' || !d.payload?.snapshot) return;
      void RtSiagaStorage.acceptCommunityInvite(d.payload.snapshot).then((res) => {
        if (res.ok && res.community) {
          setPendingRtSync(null);
          setAutoJoinedBanner({
            communityName: res.community.profile.orgName,
            inviter: res.inviter || 'Pengurus',
            orgType: res.community.profile.orgType,
          });
          setActiveTab('ringkasan');
          setIsPengurusMode(false);
          showNotification(res.message);
        }
      });
    };
    window.addEventListener(REALTIME_RELAY_EVENT_NAME, onRelay as EventListener);
    return () => window.removeEventListener(REALTIME_RELAY_EVENT_NAME, onRelay as EventListener);
  }, [pendingRtSync, showNotification]);

  // Background publish active community snapshot so title link stays ready even if host closes app
  useEffect(() => {
    if (!activeCommunity) return;
    const timer = window.setTimeout(() => {
      void RtSiagaStorage.publishCommunitySnapshot(activeCommunity, currentUser.name);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [activeCommunity, currentUser.name]);

  // Generate title-only invite link immediately & publish snapshot for sync on entry
  useEffect(() => {
    let cancelled = false;
    if (activeSheet === 'undang_komunitas' && activeCommunity) {
      const { url } = InviteRelayService.buildTitleInviteUrl(
        'rt',
        activeCommunity.profile.orgName,
        activeCommunity.profile.orgType
      );
      setShortInviteUrl(url);

      RtSiagaStorage.encodeCommunityInviteCompact(activeCommunity, currentUser.name)
        .then(async tok => {
          if (cancelled) return;
          setCompactInviteToken(tok);
          await InviteRelayService.publishRoomSnapshot({
            kind: 'rt',
            title: activeCommunity.profile.orgName,
            inviter: currentUser.name || activeCommunity.profile.creatorName || 'Pengurus',
            snapshot: tok,
          });
        })
        .catch(async () => {
          if (cancelled) return;
          const fallback = RtSiagaStorage.encodeCommunityInvite(
            activeCommunity,
            currentUser.name
          );
          setCompactInviteToken(fallback);
          await InviteRelayService.publishRoomSnapshot({
            kind: 'rt',
            title: activeCommunity.profile.orgName,
            inviter: currentUser.name || activeCommunity.profile.creatorName || 'Pengurus',
            snapshot: fallback,
          });
        });
    } else {
      setCompactInviteToken('');
      setShortInviteUrl('');
    }
    return () => {
      cancelled = true;
    };
  }, [activeSheet, activeCommunity, currentUser.name]);

  // Handlers
  const handleConfirmPaySelectedMonths = (method: string) => {
    if (selectedPayMonths.length === 0) return;
    const baseAmount = selectedPayMonths.length * profile.monthlyDuesAmount;
    RtSiagaStorage.payMemberMultipleMonths(currentUser.id, selectedPayMonths, method);
    const feeEntry = MonetizationService.recordCharge({
      moduleId: 'rtqu_iuran',
      actionLabel: `Bayar Iuran ${brandTitle} (${selectedPayMonths.length} bln)`,
      grossAmount: baseAmount,
    });
    const monthNames = selectedPayMonths
      .map(mk => MONTHS_12.find(m => m.key === mk)?.short || mk)
      .join(', ');
    showNotification(
      feeEntry
        ? `Iuran (${monthNames}) lunas! Akumulasi platform Rp ${feeEntry.feeAmount.toLocaleString('id-ID')} tercatat.`
        : `Iuran (${monthNames}) ${profile.year} lunas & tercatat di Kas ${brandTitle}!`
    );
    setSelectedPayMonths([]);
    setActiveSheet(null);
  };

  const toggleMonthSelection = (monthKey: string) => {
    setSelectedPayMonths(prev =>
      prev.includes(monthKey) ? prev.filter(k => k !== monthKey) : [...prev, monthKey]
    );
  };

  const handleRequestSiagaActivation = () => {
    RtSiagaStorage.requestSiagaActivation(currentUser.id);
    showNotification('Permohonan aktivasi SiagaQu dikirim ke Koordinator Keamanan.');
  };

  const handleUnlockPengurus = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAccountOfficer || pinInput.trim() === profile.pengurusPin) {
      setIsPengurusMode(true);
      setPinInput('');
      setActiveSheet(null);
      setActiveTab('pengurus');
      showNotification('Mode Pengurus / Koordinator aktif.');
    } else {
      showNotification('PIN salah atau akun Anda belum terdaftar di daftar pengurus.');
    }
  };

  const handleAddKasTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (termHealth.isReadOnlyLocked) {
      showNotification('Masa bakti berakhir — pencatatan kas dikunci. Lakukan Sertijab terlebih dahulu.');
      return;
    }
    const numericAmount = parseInt(kasForm.amount.replace(/\D/g, ''), 10) || 0;
    if (!kasForm.title.trim() || numericAmount <= 0) {
      showNotification('Isi keterangan dan nominal kas dengan benar.');
      return;
    }
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const actorEmail =
      FirebaseSyncService.getCurrentUser()?.email || AuthService.getAccount()?.email || undefined;
    const newTx = RtSiagaStorage.addTransaction({
      type: kasForm.type,
      category: kasForm.category,
      title: kasForm.title.trim(),
      amount: numericAmount,
      date: todayLabel,
      recordedBy: `${currentUser.name} (Pengurus)`,
      recordedByEmail: actorEmail,
    });
    setKasForm({ type: 'keluar', category: 'Gaji Keamanan', title: '', amount: '' });
    setActiveSheet(null);
    if (activeCommunity && RtGovernanceCloudService.isCloudReady()) {
      const latestWs = RtSiagaStorage.getActiveCommunity();
      if (latestWs) {
        const res = await RtGovernanceCloudService.recordAppendOnlyTransaction(latestWs, newTx);
        showNotification(res.message);
        return;
      }
    }
    showNotification('Catatan kas berhasil disimpan ke buku transparansi.');
  };

  const handleSubmitCorrectionKas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionTarget) return;
    if (termHealth.isReadOnlyLocked) {
      showNotification('Masa bakti berakhir — koreksi kas dikunci.');
      return;
    }
    const actorEmail =
      FirebaseSyncService.getCurrentUser()?.email || AuthService.getAccount()?.email || undefined;
    const corrTx = RtSiagaStorage.addCorrectionTransaction(
      correctionTarget,
      correctionReason,
      `${currentUser.name} (Pengurus)`,
      actorEmail
    );
    setCorrectionTarget(null);
    setCorrectionReason('');
    setActiveSheet(null);
    if (activeCommunity && RtGovernanceCloudService.isCloudReady()) {
      const latestWs = RtSiagaStorage.getActiveCommunity();
      if (latestWs) {
        const res = await RtGovernanceCloudService.recordAppendOnlyTransaction(latestWs, corrTx);
        showNotification(res.message);
        return;
      }
    }
    showNotification('Entri koreksi append-only ditambahkan tanpa menghapus riwayat lama.');
  };

  const handleShareKasSummary = async () => {
    const summaryText = `Laporan Transparansi Kas ${brandTitle} (${profile.orgName})\nSaldo Kas: Rp ${financialSummary.saldo.toLocaleString('id-ID')}\nTotal Pemasukan: +Rp ${financialSummary.masuk.toLocaleString('id-ID')}\nTotal Pengeluaran: -Rp ${financialSummary.keluar.toLocaleString('id-ID')}\n- Gaji Keamanan: Rp ${financialSummary.keamananKeluar.toLocaleString('id-ID')}\n- Petugas Sampah: Rp ${financialSummary.sampahKeluar.toLocaleString('id-ID')}\n- Operasional Lain: Rp ${financialSummary.operasionalKeluar.toLocaleString('id-ID')}`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(summaryText);
        showNotification('Ringkasan kas disalin! Siap dibagikan ke grup warga / ChatQu.');
        return;
      } catch {
        // fallback below
      }
    }
    showNotification('Ringkasan kas siap dibagikan.');
  };

  const handleShareForumPost = async (post: ForumPost) => {
    const scheduleLine = post.scheduleDate
      ? `\nWaktu: ${post.scheduleDate}${post.scheduleLocation ? ` · Lokasi: ${post.scheduleLocation}` : ''}`
      : '';
    const text = `[${brandTitle} - ${profile.orgName}]\n${post.title}${scheduleLine}\n${post.content}\nOleh: ${post.authorName} (${post.authorRole})`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        showNotification('Info jadwal / pengumuman disalin! Siap dibagikan ke WhatsApp atau ChatQu.');
        return;
      } catch {
        // fallback below
      }
    }
    showNotification('Info berhasil disiapkan untuk dibagikan.');
  };

  const handleSubmitForumPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.title.trim() || !postForm.content.trim()) {
      showNotification('Judul dan isi postingan wajib diisi.');
      return;
    }

    RtSiagaStorage.addForumPost({
      category: postForm.category,
      title: postForm.title.trim(),
      content: postForm.content.trim(),
      authorName: currentUser.name,
      authorRole: isPengurusMode ? `Pengurus ${profile.orgName}` : `Warga ${currentUser.block}`,
      scheduleDate: postForm.category === 'jadwal' ? postForm.scheduleDate.trim() || 'Sesuai pengumuman' : undefined,
      scheduleLocation: postForm.category === 'jadwal' ? postForm.scheduleLocation.trim() || profile.orgName : undefined,
      attendeeIds: postForm.category === 'jadwal' ? [currentUser.id] : undefined,
      aspirationStatus: postForm.category === 'aspirasi' ? 'Menunggu' : undefined,
      pollOptions:
        postForm.category === 'polling'
          ? [
              { id: 'opt-1', label: postForm.pollOption1.trim() || 'Setuju', voterIds: [] },
              { id: 'opt-2', label: postForm.pollOption2.trim() || 'Tidak Setuju', voterIds: [] },
            ]
          : undefined,
    });

    setPostForm({
      category: 'aspirasi',
      title: '',
      content: '',
      scheduleDate: '',
      scheduleLocation: '',
      pollOption1: 'Setuju',
      pollOption2: 'Tidak Setuju',
    });
    setActiveSheet(null);
    setActiveTab('forum');
    showNotification('Postingan berhasil diterbitkan di Forum Warga!');
  };

  const handleAddComment = (postId: string) => {
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;
    RtSiagaStorage.addForumComment(postId, {
      author: currentUser.name,
      authorBlock: currentUser.block,
      text,
    });
    setCommentDrafts(prev => ({ ...prev, [postId]: '' }));
  };

  const handleSubmitGuestReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestForm.guestName.trim()) {
      showNotification('Nama tamu / penghuni baru wajib diisi.');
      return;
    }
    RtSiagaStorage.addGuestReport({
      hostName: currentUser.name,
      hostBlock: currentUser.block,
      guestName: guestForm.guestName.trim(),
      relation: guestForm.relation,
      duration: guestForm.duration,
    });
    setGuestForm({ guestName: '', relation: 'Keluarga / Kerabat', duration: '2 Hari' });
    setActiveSheet(null);
    showNotification('Laporan tamu 1×24 jam dikirim ke Koordinator Keamanan.');
  };

  const handleAjukanSurat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suratForm.keperluan.trim()) {
      showNotification('Harap isi keperluan pengajuan surat.');
      return;
    }
    const newSurat = {
      id: `SRT-${Date.now().toString().slice(-3)}`,
      jenis: suratForm.jenis,
      tanggal: 'Hari ini',
      status: 'Diproses',
      nomor: 'Menunggu Validasi Pengurus',
    };
    setRiwayatSurat([newSurat, ...riwayatSurat]);
    setSuratForm({ jenis: 'Surat Pengantar Pembuatan KTP / KK', keperluan: '' });
    showNotification('Pengajuan surat dikirim ke Pengurus.');
    setActiveSheet('surat');
  };

  const handleSaveOrgSettings = (e: React.FormEvent) => {
    e.preventDefault();
    RtSiagaStorage.saveProfile(orgDraft);
    showNotification('Pengaturan komunitas berhasil diperbarui.');
  };

  const handleInviteMemberWA = async (member: WargaMember) => {
    RtSiagaStorage.markMemberInvited(member.id);
    const updatedMember = RtSiagaStorage.getMembers().find(m => m.id === member.id) || member;
    const code = updatedMember.claimCode || '-';
    const last4 = updatedMember.phone.replace(/\D/g, '').slice(-4) || '0000';
    let shareUrlLine = '';
    if (activeCommunity) {
      const { url } = InviteRelayService.buildTitleInviteUrl(
        'rt',
        activeCommunity.profile.orgName,
        activeCommunity.profile.orgType
      );
      shareUrlLine = `\n👉 Klik Link Judul (Sinkronisasi saat masuk):\n${url}\n`;
      void RtSiagaStorage.publishCommunitySnapshot(activeCommunity, currentUser.name);
    }
    const inviteText = `Halo Bpk/Ibu ${updatedMember.name} (${updatedMember.block}),\nAnda diundang bergabung di ${brandTitle} (${profile.orgName}) tahun ${profile.year}.\n${shareUrlLine}\nUntuk klaim profil Anda:\n• Kode Klaim: ${code}\n• Verifikasi 4 digit terakhir No HP: ${last4}\n\nTerima kasih,\n${profile.orgName}`;

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(inviteText);
        showNotification(`Link judul & undangan WA untuk ${updatedMember.name} disalin!`);
        return;
      } catch {
        // fallback notification
      }
    }
    showNotification(`Status ${updatedMember.name} ditandai Terundang (Kode: ${code}).`);
  };

  const handleJoinByInviteInput = async (e?: React.FormEvent, overrideRaw?: string) => {
    if (e) e.preventDefault();
    const rawToUse = (overrideRaw ?? inviteJoinInput).trim();
    if (!rawToUse) {
      showNotification('Tempel link judul (?rt=... / ?paguyuban=...) atau judul komunitas.');
      return;
    }
    setIsJoiningInvite(true);
    const parsedHint = parseInviteInput(rawToUse, 'rt');
    if (parsedHint?.mode === 'room_slug') {
      setPendingRtSync({
        title: parsedHint.titleGuess,
        canonicalSlug: parsedHint.canonicalSlug,
        rawInput: rawToUse,
        isSyncing: true,
      });
    }
    try {
      const res = await RtSiagaStorage.acceptCommunityInvite(rawToUse);
      if (res.ok && res.community) {
        setPendingRtSync(null);
        if (RtGovernanceCloudService.isCloudReady()) {
          void RtGovernanceCloudService.ensureUidMemberLink(
            res.community.id,
            res.community.profile.inviteCode || ''
          );
        }
        setInviteJoinInput('');
        setAutoJoinedBanner({
          communityName: res.community.profile.orgName,
          inviter: res.inviter || 'Pengurus',
          orgType: res.community.profile.orgType,
        });
        setActiveTab('ringkasan');
        setIsPengurusMode(false);
        showNotification(res.message);
      } else if (res.pendingSync) {
        setPendingRtSync({
          title: res.pendingSync.title,
          canonicalSlug: res.pendingSync.canonicalSlug,
          rawInput: res.pendingSync.rawInput,
          isSyncing: false,
        });
        showNotification(res.message);
      } else {
        setPendingRtSync(null);
        showNotification(res.message);
      }
    } finally {
      setIsJoiningInvite(false);
    }
  };

  const handleCreateCommunitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createCommForm.orgName.trim()) {
      showNotification('Masukkan nama RT / Paguyuban / Organisasi / Sosial.');
      return;
    }
    const dues = Math.max(0, parseInt(createCommForm.monthlyDuesAmount.replace(/\D/g, ''), 10) || 0);
    const coOfficers: Array<{ name: string; role: string; email: string }> = [];
    if (createCommForm.sekretarisEmail.trim().includes('@')) {
      coOfficers.push({
        name: createCommForm.sekretarisEmail.trim().split('@')[0],
        role: 'Sekretaris',
        email: createCommForm.sekretarisEmail.trim().toLowerCase(),
      });
    }
    if (createCommForm.bendaharaEmail.trim().includes('@')) {
      coOfficers.push({
        name: createCommForm.bendaharaEmail.trim().split('@')[0],
        role: 'Bendahara',
        email: createCommForm.bendaharaEmail.trim().toLowerCase(),
      });
    }

    const created = RtSiagaStorage.createCommunity({
      orgType: createCommForm.orgType,
      customBrandName: createCommForm.customBrandName,
      orgName: createCommForm.orgName,
      areaName: createCommForm.areaName,
      monthlyDuesAmount: dues,
      pengurusPin: createCommForm.pengurusPin,
      creatorName: createCommForm.creatorName,
      creatorBlock: createCommForm.creatorBlock,
      creatorPhone: createCommForm.creatorPhone,
      creatorRole: createCommForm.creatorRole,
      termEndDate: createCommForm.termEndDate || undefined,
      coOfficers,
    });
    if (RtGovernanceCloudService.isCloudReady()) {
      void RtGovernanceCloudService.syncWorkspaceToCloud(created, 'Pembuatan komunitas baru');
    }
    setActiveSheet(null);
    setActiveTab('ringkasan');
    setIsPengurusMode(true);
    setAutoJoinedBanner(null);
    setCreateCommForm(prev => ({
      ...prev,
      customBrandName: '',
      orgName: '',
      areaName: '',
      creatorRole: '',
      sekretarisEmail: '',
      bendaharaEmail: '',
    }));
    showNotification(
      `Komunitas "${created.profile.orgName}" berhasil dibuat! Bagikan link undangan ke warga/anggota.`
    );
  };

  const handleLeaveActiveCommunity = () => {
    if (!activeCommunity) return;
    const removedName = activeCommunity.profile.orgName;
    RtSiagaStorage.leaveOrDeleteCommunity(activeCommunity.id);
    setIsPengurusMode(false);
    setActiveTab('ringkasan');
    setAutoJoinedBanner(null);
    showNotification(`Keluar dari komunitas "${removedName}".`);
  };

  const handleShareEventInvitation = async (inv: CommunityInvitation) => {
    const text = `UNDANGAN RESMI ${brandTitle.toUpperCase()} (${profile.orgName})\nAcara: ${inv.title} (${inv.eventType})\nWaktu: ${inv.dateTime}\nLokasi: ${inv.location}\nKepada: ${inv.targetAudience}\nAgenda: ${inv.agenda}\n\nSilakan konfirmasi kehadiran (RSVP) langsung di aplikasi WargaQu.\nHormat kami,\n${inv.senderName}`;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        showNotification('Teks undangan acara disalin! Siap dibagikan ke grup WA / ChatQu.');
        return;
      } catch {
        // fallback
      }
    }
    showNotification('Undangan acara siap dibagikan.');
  };

  const communityInviteUrl =
    shortInviteUrl ||
    (activeCommunity
      ? InviteRelayService.buildTitleInviteUrl(
          'rt',
          activeCommunity.profile.orgName,
          activeCommunity.profile.orgType
        ).url
      : '');

  return (
    <div className="w-full h-full bg-white overflow-hidden flex flex-col relative select-none text-slate-800">
      {/* ===================================================================== */}
      {/* 1. MINIMALIST HEADER WITH HAIRLINE BOTTOM DIVIDER                     */}
      {/* ===================================================================== */}
      <header className="bg-white border-b border-slate-200 px-4 pt-4 pb-3 shrink-0 z-20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={onBackToMain}
              className="w-10 h-10 -ml-1 rounded-full hover:bg-slate-100 active:scale-95 flex items-center justify-center text-slate-700 transition shrink-0"
              title="Kembali ke Beranda WargaQu"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              {activeCommunity ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-base font-extrabold tracking-tight text-slate-900 truncate">
                      {brandTitle}
                    </h1>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-semibold text-emerald-700 truncate">
                      {profile.orgName}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveSheet('klaim_profil')}
                    className="text-[11px] text-slate-500 hover:text-emerald-700 truncate flex items-center gap-1 text-left"
                    title="Klaim Profil Warga atau Ganti Akun"
                  >
                    <span className="truncate">
                      {currentUser.name} · {currentUser.block} · {currentUser.wargaId}
                    </span>
                    <span className="text-emerald-700 font-bold shrink-0">· Klaim/Ganti</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-base font-extrabold tracking-tight text-slate-900 truncate">
                      RTQu & Komunitas
                    </h1>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Khusus Undangan Warga atau Buat Komunitas Baru
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => ModuleOnboardingService.openGuide('rtqu')}
              className="w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition"
              title="Panduan & Manfaat RTQu / PaguyubanQu"
              aria-label="Panduan RTQu"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            {activeCommunity ? (
              <button
                onClick={() => {
                  if (isPengurusMode) {
                    setIsPengurusMode(false);
                    showNotification('Keluar dari Mode Pengurus');
                  } else if (isAccountOfficer) {
                    setIsPengurusMode(true);
                    setActiveTab('pengurus');
                    showNotification('Mode Pengurus aktif via akun pengurus terdaftar.');
                  } else {
                    setActiveSheet('pin_pengurus');
                  }
                }}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition shrink-0 ${
                  isPengurusMode
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isPengurusMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{isPengurusMode ? 'Pengurus' : 'Mode Pengurus'}</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveSheet('buat_komunitas')}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Komunitas Paralel Bar (RTQu / PaguyubanQu / Organisasi / Sosial) */}
        {communities.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {communities.map(comm => {
              const isActive = activeCommunity?.id === comm.id;
              const typeBadge =
                comm.profile.orgType === 'Paguyuban'
                  ? 'Paguyuban'
                  : comm.profile.orgType === 'Organisasi'
                  ? comm.profile.customBrandName?.trim() || 'Org'
                  : comm.profile.orgType === 'Sosial'
                  ? comm.profile.customBrandName?.trim() || 'Sosial'
                  : 'RT';
              return (
                <button
                  key={comm.id}
                  onClick={() => {
                    RtSiagaStorage.setActiveCommunityId(comm.id);
                    setIsPengurusMode(false);
                    setAutoJoinedBanner(null);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 shrink-0 transition ${
                    isActive
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {typeBadge}
                  </span>
                  <span className="max-w-[140px] truncate">{comm.profile.orgName}</span>
                </button>
              );
            })}
            <button
              onClick={() => setActiveSheet('undang_komunitas')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-emerald-600 text-emerald-700 bg-emerald-50 text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0"
              title="Bagikan Link Undangan Warga"
            >
              <Link2 className="w-3 h-3" />
              <span>Undang</span>
            </button>
            <button
              onClick={() => setActiveSheet('buat_komunitas')}
              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-[11px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0"
              title="Buat Komunitas RT / Paguyuban / Organisasi / Sosial Baru"
            >
              <Plus className="w-3 h-3" />
              <span>Baru</span>
            </button>
          </div>
        )}
      </header>

      {/* ===================================================================== */}
      {/* 2. MAIN CONTENT BY TAB (MINIMALIST LIST VIEW + HAIRLINE DIVIDERS)     */}
      {/* ===================================================================== */}
      <main className="flex-1 overflow-y-auto no-scrollbar bg-white">
        {pendingRtSync && (
          <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCw
                className={`w-4 h-4 text-amber-800 shrink-0 ${
                  pendingRtSync.isSyncing ? 'animate-spin' : ''
                }`}
              />
              <div className="text-xs text-slate-900 min-w-0">
                <div className="font-bold truncate">
                  {pendingRtSync.isSyncing
                    ? `Menyinkronkan "${pendingRtSync.title}"...`
                    : `Menunggu Sinkronisasi "${pendingRtSync.title}"`}
                </div>
                <p className="text-[11px] text-slate-600">
                  {pendingRtSync.isSyncing
                    ? 'Mengambil data komunitas terbaru saat masuk.'
                    : 'Otomatis masuk saat perangkat pengurus membuka WargaQu, atau tekan Sinkronkan Ulang.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!pendingRtSync.isSyncing && (
                <button
                  type="button"
                  onClick={() => {
                    void handleJoinByInviteInput(undefined, pendingRtSync.rawInput);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold whitespace-nowrap"
                >
                  Sinkronkan Ulang
                </button>
              )}
              <button
                type="button"
                onClick={() => setPendingRtSync(null)}
                className="p-1 text-slate-500 hover:text-slate-800"
                title="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {autoJoinedBanner && (
          <div className="mx-4 mt-3 px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 flex items-start justify-between gap-2">
            <div className="text-xs text-emerald-950 space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Sinkronisasi &amp; Masuk {autoJoinedBanner.communityName}</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Diundang oleh <strong>{autoJoinedBanner.inviter}</strong> ({autoJoinedBanner.orgType}). Data komunitas ini tersinkron &amp; tersimpan aman di HP Anda.
              </p>
            </div>
            <button
              onClick={() => setAutoJoinedBanner(null)}
              className="p-1 text-emerald-700 hover:text-emerald-900"
              title="Tutup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* EMPTY / INVITE-ONLY ONBOARDING STATE (0 COMMUNITIES) */}
        {communities.length === 0 ? (
          <div className="p-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <h2 className="text-sm font-extrabold tracking-tight text-slate-900">
                  Komunitas Warga Khusus Undangan
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Akun Anda belum terhubung ke RT, Paguyuban, Organisasi, atau Sosial manapun. Demi privasi &amp; tata kelola multi-pengurus bermasa jabatan, data warga hanya tampil jika Anda <strong>menerima undangan resmi</strong> atau <strong>membuat komunitas baru</strong>.
              </p>
            </div>

            {/* Option 1: Join via Invite Link / Token */}
            <form
              onSubmit={handleJoinByInviteInput}
              className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-emerald-700" />
                    <span>Punya Undangan dari Pengurus?</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tempel link judul (?rt=..., ?paguyuban=...), ketik nama RT/Paguyuban, atau kode offline.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteJoinInput}
                  onChange={e => setInviteJoinInput(e.target.value)}
                  placeholder="Contoh: ?rt=RT-03-Melati atau ?paguyuban=..."
                  className="flex-1 min-h-[42px] border border-slate-300 rounded-xl px-3 text-xs focus:outline-none focus:border-emerald-700"
                />
                <button
                  type="submit"
                  disabled={isJoiningInvite}
                  className="min-h-[42px] px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl text-xs font-bold shrink-0"
                >
                  {isJoiningInvite ? 'Memproses...' : 'Gabung'}
                </button>
              </div>
            </form>

            {/* Option 2: Create New Community */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>Belum Ada yang Mengurus di Lingkungan Anda?</span>
                </h3>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Buat ruang digital sendiri untuk <strong>RTQu</strong>, <strong>PaguyubanQu</strong> (cluster/perumahan yang RT-nya belum aktif), <strong>Organisasi</strong> (partai/ormas/komunitas), atau <strong>Sosial</strong> (DKM/panti/yayasan) — gratis & langsung bisa undang warga via WA.
                </p>
              </div>
              <button
                onClick={() => setActiveSheet('buat_komunitas')}
                className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Buat RT / Paguyuban / Organisasi Baru</span>
              </button>
            </div>

            {isOwner && (
              <div className="pt-2 border-t border-slate-200 text-center">
                <button
                  onClick={() => {
                    RtSiagaStorage.reloadOwnerDefaultCommunity();
                    showNotification('Workspace contoh RT 03 / RW 05 dimuat kembali.');
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 underline"
                >
                  Muat Ulang Data Contoh Owner (RT 03 / RW 05)
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
        {/* TAB 1: RINGKASAN */}
        {activeTab === 'ringkasan' && (
          <div className="divide-y divide-slate-200">
            <RtTenureBanner
              termHealth={termHealth}
              officersCount={officers.length}
              isCurrentOfficer={isAccountOfficer || isPengurusMode}
              onCreateElectionInvite={openElectionInviteModal}
              onCreateElectionPoll={openElectionPollModal}
              onOpenGovernanceTab={() => {
                setPengurusSubTab('koordinator');
                setActiveTab('pengurus');
              }}
            />

            {/* Kas Balance Strip */}
            <section className="px-4 py-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Saldo Kas {profile.orgName}</span>
                <button
                  onClick={() => setIsSaldoHidden(!isSaldoHidden)}
                  className="p-1 text-slate-500 hover:text-slate-800"
                  title="Tampilkan / Sembunyikan Saldo"
                >
                  {isSaldoHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xs font-bold text-slate-400">IDR</span>
                <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
                  {isSaldoHidden ? '••••••••' : financialSummary.saldo.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-4 text-xs">
                <span className="text-slate-600">
                  Masuk:{' '}
                  <strong className="text-emerald-700 font-mono tabular-nums">
                    +Rp {financialSummary.masuk.toLocaleString('id-ID')}
                  </strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600">
                  Keluar:{' '}
                  <strong className="text-rose-700 font-mono tabular-nums">
                    -Rp {financialSummary.keluar.toLocaleString('id-ID')}
                  </strong>
                </span>
              </div>
            </section>

            {/* Minimalist Action List */}
            <div className="divide-y divide-slate-200">
              {/* Row: Tagihan Iuran Bulan Ini */}
              <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900">
                    Iuran Bulan Oktober {profile.year}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {isCurrentMonthPaid
                      ? `Lunas · Kartu Tahun ${paidMonthsCount}/12 bulan`
                      : `Belum Bayar · Rp ${profile.monthlyDuesAmount.toLocaleString('id-ID')} (Sampah & Keamanan)`}
                  </div>
                </div>
                {isCurrentMonthPaid ? (
                  <button
                    onClick={() => setActiveTab('iuran')}
                    className="min-h-[38px] px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
                  >
                    Lihat Kartu
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedPayMonths([currentMonthKey]);
                      setActiveSheet('bayar');
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shrink-0"
                  >
                    Bayar Iuran
                  </button>
                )}
              </div>

              {/* Row: Aktivasi SiagaQu */}
              <div className="px-4 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {currentUser.siagaStatus === 'active' ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : currentUser.siagaStatus === 'suspended' ? (
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-900">
                      Aktivasi SiagaQu (Mode Darurat)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {currentUser.siagaStatus === 'active'
                      ? `Aktif terverifikasi oleh ${currentUser.siagaVerifiedBy || 'Pengurus'}`
                      : currentUser.siagaStatus === 'suspended'
                      ? `Dibekukan: ${currentUser.suspendReason || 'Hubungi Koordinator Keamanan'}`
                      : currentUser.siagaRequested
                      ? 'Menunggu persetujuan Koordinator Keamanan di menu Pengurus'
                      : 'Wajib aktivasi pengurus agar tombol darurat tidak disalahgunakan'}
                  </p>
                </div>

                {currentUser.siagaStatus === 'active' ? (
                  <button
                    onClick={() => (onOpenSiagaQu ? onOpenSiagaQu() : showNotification('SiagaQu aktif'))}
                    className="min-h-[38px] px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0"
                  >
                    Buka SiagaQu
                  </button>
                ) : currentUser.siagaStatus === 'pending' && !currentUser.siagaRequested ? (
                  <button
                    onClick={handleRequestSiagaActivation}
                    className="min-h-[38px] px-3 py-1.5 border border-emerald-700 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold shrink-0"
                  >
                    Ajukan
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setPengurusSubTab('warga');
                      setActiveTab('pengurus');
                    }}
                    className="min-h-[38px] px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shrink-0"
                  >
                    Cek Status
                  </button>
                )}
              </div>
            </div>

            {/* Minimalist Menu Layanan List */}
            <div className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Layanan & Interaksi Warga
              </div>

              <button
                onClick={() => {
                  setForumFilter('undangan');
                  setActiveTab('forum');
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MailOpen className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">Undangan Acara & Rapat Warga</div>
                    <div className="text-[11px] text-slate-500">
                      {invitations.length} undangan aktif · Konfirmasi hadir (RSVP) & share
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => setActiveSheet('klaim_profil')}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <KeyRound className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">
                      Klaim Profil Warga (Dari Data Excel)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {unclaimedCount > 0
                        ? `${unclaimedCount} warga pra-terdaftar menunggu klaim kode undangan`
                        : 'Semua warga terdaftar sudah terhubung'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => {
                  setForumFilter('semua');
                  setActiveTab('forum');
                }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Megaphone className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">Forum, Aspirasi & Jadwal Warga</div>
                    <div className="text-[11px] text-slate-500">
                      {forumPosts.length} kiriman · Share jadwal ronda, kerja bakti & polling
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => setActiveSheet('tamu')}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserPlus className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">Lapor Tamu Menginap (1×24 Jam)</div>
                    <div className="text-[11px] text-slate-500">
                      {guestReports.length} laporan tamu tercatat ke Koordinator Keamanan
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => setActiveSheet('surat')}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">Surat Pengantar Online</div>
                    <div className="text-[11px] text-slate-500">
                      {riwayatSurat.length} pengajuan surat warga
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={() => setActiveSheet('ronda')}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">Jadwal Ronda & Kerja Bakti</div>
                    <div className="text-[11px] text-slate-500">
                      Gotong royong Minggu 07:30 · Siskamling Blok A-C
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                onClick={onOpenUsahaQu}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 text-left transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Store className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">UsahaQu POS (UMKM Warga)</div>
                    <div className="text-[11px] text-slate-500">
                      Kasir, stok bahan & laporan usaha warga
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: FORUM WARGA (ASPIRASI, SHARE JADWAL RONDA/KERJA BAKTI, POLLING) */}
        {activeTab === 'forum' && (
          <div className="divide-y divide-slate-200">
            {/* Top Bar + Filter */}
            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-slate-900">Forum & Undangan Warga</h2>
                <p className="text-[11px] text-slate-500">
                  Undangan acara, aspirasi, jadwal ronda & musyawarah
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setActiveSheet('buat_undangan')}
                  className="min-h-[36px] px-2.5 py-1.5 border border-emerald-700 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <MailOpen className="w-3.5 h-3.5" />
                  <span>Undangan</span>
                </button>
                <button
                  onClick={() => setActiveSheet('buat_post')}
                  className="min-h-[36px] px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tulis</span>
                </button>
              </div>
            </div>

            <div className="flex border-b border-slate-200 px-4 gap-4 overflow-x-auto no-scrollbar">
              {[
                { id: 'semua', label: 'Semua' },
                { id: 'undangan', label: `Undangan (${invitations.length})` },
                { id: 'jadwal', label: 'Jadwal & Ronda' },
                { id: 'aspirasi', label: 'Aspirasi' },
                { id: 'polling', label: 'Polling' },
                { id: 'info', label: 'Kabar' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setForumFilter(f.id as 'semua' | 'undangan' | ForumCategory)}
                  className={`py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                    forumFilter === f.id
                      ? 'border-emerald-700 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Minimalist Invitations List (shown in Undangan tab or top of Semua) */}
            {(forumFilter === 'undangan' || forumFilter === 'semua') && invitations.length > 0 && (
              <div className="divide-y divide-slate-200">
                {forumFilter === 'semua' && (
                  <div className="px-4 py-2 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Undangan Resmi ({invitations.length})
                  </div>
                )}
                {invitations.map(inv => {
                  const rsvpList = Object.values(inv.rsvps);
                  const hadirCount = rsvpList.filter(r => r.status === 'hadir').length;
                  const wakilCount = rsvpList.filter(r => r.status === 'wakil').length;
                  const myRsvp = inv.rsvps[currentUser.id]?.status;

                  return (
                    <article key={inv.id} className="px-4 py-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-emerald-700">{inv.eventType}</span>
                        <span className="text-slate-500">{inv.createdAt}</span>
                      </div>
                      <div>
                        <h3 className="text-xs font-extrabold text-slate-900">{inv.title}</h3>
                        <div className="text-[11px] text-slate-700 mt-1 space-y-0.5 border-y border-slate-100 py-1.5">
                          <div>Waktu: {inv.dateTime}</div>
                          <div>Lokasi: {inv.location}</div>
                          <div>Kepada: {inv.targetAudience}</div>
                        </div>
                        <p className="text-xs text-slate-600 mt-1.5">{inv.agenda}</p>
                        <p className="text-[11px] text-slate-400 mt-1">Pengundang: {inv.senderName}</p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          {(
                            [
                              { id: 'hadir', label: 'Hadir' },
                              { id: 'wakil', label: 'Diwakilkan' },
                              { id: 'izin', label: 'Izin' },
                            ] as Array<{ id: InvitationRsvpStatus; label: string }>
                          ).map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => {
                                RtSiagaStorage.setInvitationRsvp(inv.id, currentUser, opt.id);
                                showNotification(`Konfirmasi kehadiran: ${opt.label}`);
                              }}
                              className={`min-h-[32px] px-2.5 rounded-lg border text-[11px] font-bold transition ${
                                myRsvp === opt.id
                                  ? 'bg-emerald-700 text-white border-emerald-700'
                                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => handleShareEventInvitation(inv)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-emerald-700 shrink-0"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share</span>
                        </button>
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Konfirmasi: <strong className="text-slate-800">{hadirCount}</strong> hadir ·{' '}
                        <strong className="text-slate-800">{wakilCount}</strong> diwakilkan
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Minimalist Post Feed with Hairline Dividers */}
            <div className="divide-y divide-slate-200">
              {filteredForumPosts.map(post => {
                const isUpvoted = post.upvoterIds.includes(currentUser.id);
                const isAttending = Boolean(post.attendeeIds?.includes(currentUser.id));
                const isCommentsOpen = expandedCommentsPostId === post.id;
                const totalPollVotes = (post.pollOptions || []).reduce(
                  (sum, o) => sum + o.voterIds.length,
                  0
                );

                return (
                  <article key={post.id} className="px-4 py-4 space-y-2.5">
                    {/* Metadata line (unboxed text) */}
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-500 truncate">
                        <strong className="text-slate-800">{post.authorName}</strong> · {post.authorRole} ·{' '}
                        {post.createdAt}
                      </span>
                      <span
                        className={`font-bold shrink-0 ${
                          post.category === 'jadwal'
                            ? 'text-emerald-700'
                            : post.category === 'aspirasi'
                            ? 'text-amber-700'
                            : post.category === 'polling'
                            ? 'text-sky-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {post.category === 'jadwal'
                          ? 'Jadwal'
                          : post.category === 'aspirasi'
                          ? `Aspirasi · ${post.aspirationStatus || 'Menunggu'}`
                          : post.category === 'polling'
                          ? 'Polling'
                          : 'Kabar'}
                      </span>
                    </div>

                    {/* Title & Content */}
                    <div className="space-y-1">
                      <h3 className="text-xs font-extrabold text-slate-900 leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{post.content}</p>
                    </div>

                    {/* Schedule Line */}
                    {post.category === 'jadwal' && post.scheduleDate && (
                      <div className="text-[11px] text-slate-700 border-y border-slate-100 py-1.5 space-y-0.5">
                        <div>Waktu: {post.scheduleDate}</div>
                        {post.scheduleLocation && <div>Lokasi: {post.scheduleLocation}</div>}
                      </div>
                    )}

                    {/* Poll Options */}
                    {post.category === 'polling' && post.pollOptions && (
                      <div className="space-y-1.5 pt-1">
                        {post.pollOptions.map(opt => {
                          const hasVoted = opt.voterIds.includes(currentUser.id);
                          const pct =
                            totalPollVotes > 0
                              ? Math.round((opt.voterIds.length / totalPollVotes) * 100)
                              : 0;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => RtSiagaStorage.voteForumPoll(post.id, opt.id, currentUser.id)}
                              className={`w-full px-3 py-2 rounded-lg border text-left text-xs flex items-center justify-between gap-2 transition ${
                                hasVoted
                                  ? 'border-emerald-700 bg-emerald-50/50 text-emerald-900 font-bold'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="truncate">{opt.label}</span>
                              <span className="font-mono tabular-nums text-[11px] shrink-0">
                                {opt.voterIds.length} ({pct}%)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Pengurus Status Control for Aspirations */}
                    {post.category === 'aspirasi' && isPengurusMode && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                        <span className="text-slate-500">Status Pengurus:</span>
                        {(['Menunggu', 'Diproses', 'Selesai'] as AspirationStatus[]).map(st => (
                          <button
                            key={st}
                            onClick={() => {
                              RtSiagaStorage.updateAspirationStatus(post.id, st);
                              showNotification(`Status aspirasi diubah ke: ${st}`);
                            }}
                            className={`px-2 py-1 rounded border font-semibold ${
                              post.aspirationStatus === st
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Action Row (Minimalist Text Buttons) */}
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => RtSiagaStorage.toggleForumUpvote(post.id, currentUser.id)}
                          className={`flex items-center gap-1 font-semibold ${
                            isUpvoted ? 'text-emerald-700' : 'hover:text-slate-900'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span className="font-mono tabular-nums">
                            Dukung ({post.upvoterIds.length})
                          </span>
                        </button>

                        {post.category === 'jadwal' && (
                          <button
                            onClick={() => RtSiagaStorage.toggleForumAttendance(post.id, currentUser.id)}
                            className={`flex items-center gap-1 font-semibold ${
                              isAttending ? 'text-emerald-700' : 'hover:text-slate-900'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span className="font-mono tabular-nums">
                              {isAttending ? 'Hadir' : 'Ikut'} ({post.attendeeIds?.length || 0})
                            </span>
                          </button>
                        )}

                        <button
                          onClick={() =>
                            setExpandedCommentsPostId(isCommentsOpen ? null : post.id)
                          }
                          className="flex items-center gap-1 font-semibold hover:text-slate-900"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="font-mono tabular-nums">
                            Balas ({post.comments.length})
                          </span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleShareForumPost(post)}
                        className="flex items-center gap-1 font-semibold text-slate-600 hover:text-emerald-700"
                        title="Bagikan info ini"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share</span>
                      </button>
                    </div>

                    {/* Inline Comments Thread */}
                    {isCommentsOpen && (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        {post.comments.length === 0 ? (
                          <p className="text-[11px] text-slate-400">Belum ada tanggapan warga.</p>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {post.comments.map(c => (
                              <div key={c.id} className="py-1.5 text-[11px]">
                                <div className="flex justify-between text-slate-500">
                                  <strong className="text-slate-800">
                                    {c.author} ({c.authorBlock})
                                  </strong>
                                  <span>{c.time}</span>
                                </div>
                                <p className="text-slate-700 mt-0.5">{c.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={commentDrafts[post.id] || ''}
                            onChange={e =>
                              setCommentDrafts(prev => ({ ...prev, [post.id]: e.target.value }))
                            }
                            onKeyDown={e => e.key === 'Enter' && handleAddComment(post.id)}
                            placeholder="Tulis tanggapan singkat..."
                            className="flex-1 min-h-[36px] border border-slate-300 rounded-lg px-2.5 text-xs"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            className="min-h-[36px] px-3 bg-emerald-700 text-white rounded-lg text-xs font-bold"
                          >
                            Kirim
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: KEUANGAN (TRANSPARANSI PENDAPATAN & PENGELUARAN) */}
        {activeTab === 'keuangan' && (
          <div className="divide-y divide-slate-200">
            <section className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500">Transparansi Kas {profile.orgName}</div>
                  <div className="text-xl font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                    Rp {financialSummary.saldo.toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      RtExcelService.exportRtQuExcel(profile, members, transactions, archives);
                      showNotification('File Excel (.xlsx) Laporan Kas & Kartu Iuran berhasil diunduh!');
                    }}
                    className="min-h-[38px] px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
                    title="Ekspor Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={handleShareKasSummary}
                    className="min-h-[38px] px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Bagikan</span>
                  </button>
                  {isPengurusMode && !termHealth.isReadOnlyLocked && (
                    <button
                      onClick={() => setActiveSheet('catat_kas')}
                      className="min-h-[38px] px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Catat</span>
                    </button>
                  )}
                </div>
              </div>

              {termHealth.isReadOnlyLocked && (
                <div className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-[11px] text-rose-800 font-semibold">
                  Buku kas periode {termHealth.periodLabel} terkunci otomatis karena masa bakti
                  berakhir. Lakukan Serah Terima Jabatan (Sertijab) di tab Pengurus.
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-200 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500">Gaji Keamanan</div>
                  <div className="font-bold text-slate-900 font-mono tabular-nums">
                    Rp {financialSummary.keamananKeluar.toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Petugas Sampah</div>
                  <div className="font-bold text-slate-900 font-mono tabular-nums">
                    Rp {financialSummary.sampahKeluar.toLocaleString('id-ID')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Operasional Lain</div>
                  <div className="font-bold text-slate-900 font-mono tabular-nums">
                    Rp {financialSummary.operasionalKeluar.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            </section>

            {/* Underline Filter Bar */}
            <div className="flex border-b border-slate-200 px-4 gap-5">
              {[
                { id: 'semua', label: 'Semua' },
                { id: 'masuk', label: 'Pendapatan' },
                { id: 'keluar', label: 'Pengeluaran' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setKasFilter(tab.id as 'semua' | 'masuk' | 'keluar')}
                  className={`py-2.5 text-xs font-bold border-b-2 transition-colors ${
                    kasFilter === tab.id
                      ? 'border-emerald-700 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Minimalist Mutasi List (Append-Only Audit Trail) */}
            <div className="divide-y divide-slate-200">
              {filteredTransactions.map(tx => (
                <div key={tx.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 leading-snug">{tx.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {tx.date} · {tx.category} · {tx.recordedBy}
                      {tx.recordedByEmail ? ` (${tx.recordedByEmail})` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div
                      className={`text-xs font-extrabold font-mono tabular-nums ${
                        tx.type === 'masuk' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {tx.type === 'masuk' ? '+' : '-'}Rp {tx.amount.toLocaleString('id-ID')}
                    </div>
                    {isPengurusMode && !termHealth.isReadOnlyLocked && !tx.isCorrection && (
                      <button
                        type="button"
                        onClick={() => {
                          setCorrectionTarget(tx);
                          setCorrectionReason('');
                          setActiveSheet('koreksi_kas');
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:text-rose-700 underline"
                      >
                        Koreksi Entri
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Arsip Ringkas Tahun Sebelumnya (2020-2025 Cut-Off) */}
            <section className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Archive className="w-3.5 h-3.5 text-slate-500" />
                  <span>Arsip Ringkas Tahun Sebelumnya</span>
                </div>
                {isPengurusMode && (
                  <button
                    onClick={() => setActiveSheet('arsip_tahunan')}
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    + Arsip / Tutup Buku {profile.year}
                  </button>
                )}
              </div>
              {archives.length === 0 ? (
                <div className="px-4 py-3 text-[11px] text-slate-500">
                  Belum ada arsip ringkas tahun lalu. Fokus lembaran baru {profile.year}.
                </div>
              ) : (
                archives.map(arc => (
                  <div key={arc.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900">
                        Tahun {arc.year} ·{' '}
                        <span className="font-normal text-slate-500">{arc.source}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Masuk: Rp {arc.totalIncome.toLocaleString('id-ID')} · Keluar: Rp{' '}
                        {arc.totalExpense.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{arc.note}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">Saldo Akhir</div>
                      <div className="text-xs font-extrabold font-mono tabular-nums text-emerald-700">
                        Rp {arc.endingBalance.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {/* TAB 4: KARTU IURAN 1 TAHUN (12 BULAN + MULTI-MONTH PAY) */}
        {activeTab === 'iuran' && (
          <div className="divide-y divide-slate-200">
            <section className="px-4 py-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Kartu Iuran Tahun {profile.year}
                </h2>
                <span className="text-xs font-bold font-mono tabular-nums text-emerald-700">
                  {paidMonthsCount}/12 Lunas
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {currentUser.name} · {currentUser.block} · Rp{' '}
                <span className="font-mono tabular-nums">
                  {profile.monthlyDuesAmount.toLocaleString('id-ID')}
                </span>
                /bln
              </p>
              <p className="text-[11px] text-slate-500">
                Alokasi: Keamanan Rp {profile.duesBreakdown.keamanan.toLocaleString('id-ID')} · Sampah Rp{' '}
                {profile.duesBreakdown.sampah.toLocaleString('id-ID')} · Kas Rp{' '}
                {profile.duesBreakdown.kas.toLocaleString('id-ID')}
              </p>
              {unpaidMonthKeys.length > 1 && (
                <div className="pt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    Centang beberapa bulan atau bayar langsung:
                  </span>
                  <button
                    onClick={() => {
                      setSelectedPayMonths(unpaidMonthKeys);
                      setActiveSheet('bayar');
                    }}
                    className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0"
                  >
                    Lunasi Semua ({unpaidMonthKeys.length} bln)
                  </button>
                </div>
              )}
            </section>

            {/* 12-Month Minimalist List View */}
            <div className="divide-y divide-slate-200">
              {MONTHS_12.map(m => {
                const record = currentUser.monthlyPayments[m.key];
                const isPaid = Boolean(record?.paid);
                const isChecked = selectedPayMonths.includes(m.key);
                return (
                  <div key={m.key} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {!isPaid && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleMonthSelection(m.key)}
                          className="w-4 h-4 accent-emerald-700 rounded shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900">
                          {m.key}. {m.full} {profile.year}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {isPaid
                            ? `Lunas · ${record.paidAt || '-'} · ${record.method || 'QRIS'}`
                            : `Belum bayar · Rp ${profile.monthlyDuesAmount.toLocaleString('id-ID')}`}
                        </div>
                      </div>
                    </div>

                    {isPaid ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Lunas</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedPayMonths([m.key]);
                          setActiveSheet('bayar');
                        }}
                        className="min-h-[36px] px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shrink-0"
                      >
                        Bayar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedPayMonths.length > 0 && unpaidMonthKeys.length > 0 && (
              <div className="p-4 bg-slate-50 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <div className="font-bold text-slate-900">
                    {selectedPayMonths.length} bulan dipilih
                  </div>
                  <div className="text-[11px] text-emerald-700 font-mono tabular-nums font-bold">
                    Total Rp {(selectedPayMonths.length * profile.monthlyDuesAmount).toLocaleString('id-ID')}
                  </div>
                </div>
                <button
                  onClick={() => setActiveSheet('bayar')}
                  className="min-h-[40px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold"
                >
                  Bayar Terpilih
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PENGURUS / KOORDINATOR & KONTROL SIAGAQU */}
        {activeTab === 'pengurus' && (
          <div className="divide-y divide-slate-200">
            <div className="flex border-b border-slate-200 px-4 gap-4 overflow-x-auto no-scrollbar">
              {[
                { id: 'koordinator', label: 'Koordinator' },
                { id: 'warga', label: 'Warga & SiagaQu' },
                { id: 'audit', label: `Audit (${auditLogs.length})` },
                { id: 'pengaturan', label: 'Organisasi' },
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setPengurusSubTab(sub.id as PengurusSubTab)}
                  className={`py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                    pengurusSubTab === sub.id
                      ? 'border-emerald-700 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {!isPengurusMode && (
              <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                <span>
                  {isAccountOfficer
                    ? 'Akun Anda terdaftar sebagai pengurus — ketuk untuk mengaktifkan Mode Pengurus.'
                    : 'Masuk Mode Pengurus via akun Google terdaftar atau PIN internal pengurus.'}
                </span>
                <button
                  onClick={() => {
                    if (isAccountOfficer) {
                      setIsPengurusMode(true);
                      showNotification('Mode Pengurus aktif via akun pengurus terdaftar.');
                    } else {
                      setActiveSheet('pin_pengurus');
                    }
                  }}
                  className="font-bold text-emerald-700 hover:underline shrink-0"
                >
                  {isAccountOfficer ? 'Aktifkan Pengurus' : 'Buka Akses'}
                </button>
              </div>
            )}

            {/* Sub-Tab 1: Jajaran Pengurus / Koordinator + Masa Jabatan & Sertijab */}
            {pengurusSubTab === 'koordinator' && (
              <div className="divide-y divide-slate-200">
                {activeCommunity && (
                  <RtTenureBanner
                    termHealth={termHealth}
                    officersCount={officers.length}
                    isCurrentOfficer={isAccountOfficer || isPengurusMode}
                    onCreateElectionInvite={openElectionInviteModal}
                    onCreateElectionPoll={openElectionPollModal}
                    onOpenGovernanceTab={() => setPengurusSubTab('koordinator')}
                  />
                )}

                {coordinators.map(coord => (
                  <div key={coord.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-emerald-700">
                        {coord.role}
                        {coord.canVerifySiaga ? ' · Otoritas SiagaQu' : ''}
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">{coord.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {coord.division} · {coord.phone}
                      </div>
                    </div>
                    <button
                      onClick={() => showNotification(`Menghubungi ${coord.name} (${coord.phone})`)}
                      className="min-h-[38px] min-w-[38px] border border-slate-300 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 shrink-0"
                      title="Hubungi Pengurus"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {activeCommunity && (
                  <RtGovernanceManager
                    workspace={activeCommunity}
                    termHealth={termHealth}
                    officers={officers}
                    handovers={handovers}
                    governanceActions={governanceActions}
                    kasBalance={financialSummary.saldo}
                    isPengurusMode={isPengurusMode}
                    showNotification={showNotification}
                    onCreateElectionInvite={openElectionInviteModal}
                    onCreateElectionPoll={openElectionPollModal}
                  />
                )}
              </div>
            )}

            {/* Sub-Tab 2: Daftar Warga, Undangan Klaim, Impor Excel & Aktivasi SiagaQu */}
            {pengurusSubTab === 'warga' && (
              <div className="divide-y divide-slate-200">
                {/* Excel & Filter Action Bar */}
                <div className="px-4 py-3 space-y-2.5 bg-slate-50/70">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setActiveSheet('import_excel')}
                      className="min-h-[36px] px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Impor Excel</span>
                    </button>
                    <button
                      onClick={() => {
                        RtExcelService.exportRtQuExcel(profile, members, transactions, archives);
                        showNotification('File Excel (.xlsx) berhasil diekspor.');
                      }}
                      className="min-h-[36px] px-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-bold flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Ekspor .xlsx</span>
                    </button>
                    <button
                      onClick={() => {
                        RtExcelService.downloadTemplateExcel(profile);
                        showNotification('Template Excel resmi diunduh.');
                      }}
                      className="min-h-[36px] px-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-[11px] font-semibold"
                    >
                      Template
                    </button>
                  </div>

                  <div className="flex items-center gap-4 border-t border-slate-200 pt-2 text-[11px]">
                    {[
                      { id: 'semua', label: `Semua (${members.length})` },
                      { id: 'unclaimed', label: `Belum Klaim (${unclaimedCount})` },
                      { id: 'claimed', label: `Aktif (${members.length - unclaimedCount})` },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setWargaFilter(f.id as 'semua' | 'unclaimed' | 'claimed')}
                        className={`font-bold ${
                          wargaFilter === f.id
                            ? 'text-emerald-700 underline underline-offset-4'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredMembers.map(member => {
                  const paidCount = Object.values(member.monthlyPayments).filter(p => p.paid).length;
                  const claimState = member.claimStatus || 'claimed';
                  return (
                    <div key={member.id} className="px-4 py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900">
                            {member.name} {member.isCurrentUser ? '(Anda)' : ''}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {member.block} · {member.wargaId} · Iuran {paidCount}/12 bln
                            {member.email ? ` · ${member.email}` : ''}
                          </div>
                          <div
                            className={`text-[11px] font-semibold mt-0.5 ${
                              claimState === 'claimed'
                                ? 'text-slate-600'
                                : claimState === 'invited'
                                ? 'text-sky-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {claimState === 'claimed'
                              ? `Akun Terklaim${member.claimedAt ? ` · ${member.claimedAt}` : ''}`
                              : claimState === 'invited'
                              ? `Terundang (${member.invitedAt || 'Baru'}) · Kode: ${member.claimCode}`
                              : `Belum Klaim (Dari Excel) · Kode: ${member.claimCode}`}
                          </div>
                          {member.priorArrears && member.priorArrears > 0 ? (
                            <div className="text-[11px] text-rose-700 font-semibold">
                              Tunggakan Lalu: Rp {member.priorArrears.toLocaleString('id-ID')}
                              {member.priorArrearsNote ? ` (${member.priorArrearsNote})` : ''}
                            </div>
                          ) : null}
                          <div
                            className={`text-[11px] font-semibold mt-0.5 ${
                              member.siagaStatus === 'active'
                                ? 'text-emerald-700'
                                : member.siagaStatus === 'suspended'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }`}
                          >
                            SiagaQu:{' '}
                            {member.siagaStatus === 'active'
                              ? `Aktif (${member.siagaVerifiedBy || 'Pengurus'})`
                              : member.siagaStatus === 'suspended'
                              ? `Dibekukan (${member.suspendReason || 'Sanksi'})`
                              : member.siagaRequested
                              ? 'Mengajukan Aktivasi'
                              : 'Belum Diaktivasi'}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {claimState !== 'claimed' && (
                            <button
                              onClick={() => handleInviteMemberWA(member)}
                              className="min-h-[34px] px-2.5 border border-emerald-700 text-emerald-700 hover:bg-emerald-50 rounded-lg text-[11px] font-bold flex items-center gap-1"
                            >
                              <Share2 className="w-3 h-3" />
                              <span>{claimState === 'invited' ? 'Kirim Ulang WA' : 'Undang WA'}</span>
                            </button>
                          )}

                          {isPengurusMode && member.siagaStatus !== 'active' && (
                            <button
                              onClick={() => {
                                RtSiagaStorage.setMemberSiagaStatus(
                                  member.id,
                                  'active',
                                  'Koordinator Keamanan'
                                );
                                RealtimeRelayService.publish(
                                  RealtimeRelayService.getRtChannel(),
                                  'rt:siaga_status',
                                  {
                                    email: member.email,
                                    phone: member.phone,
                                    status: 'active',
                                    verifiedBy: 'Koordinator Keamanan',
                                  }
                                );
                                showNotification(`SiagaQu untuk ${member.name} berhasil diaktifkan.`);
                              }}
                              className="min-h-[34px] px-2.5 bg-emerald-700 text-white rounded-lg text-[11px] font-bold"
                            >
                              Aktifkan SiagaQu
                            </button>
                          )}
                          {isPengurusMode && member.siagaStatus === 'active' && (
                            <button
                              onClick={() => {
                                RtSiagaStorage.setMemberSiagaStatus(
                                  member.id,
                                  'suspended',
                                  'Koordinator Keamanan',
                                  'Dibekukan oleh Koordinator Keamanan'
                                );
                                RealtimeRelayService.publish(
                                  RealtimeRelayService.getRtChannel(),
                                  'rt:siaga_status',
                                  {
                                    email: member.email,
                                    phone: member.phone,
                                    status: 'suspended',
                                    verifiedBy: 'Koordinator Keamanan',
                                    reason: 'Dibekukan oleh Koordinator Keamanan',
                                  }
                                );
                                showNotification(`Akses SiagaQu ${member.name} dibekukan.`);
                              }}
                              className="min-h-[34px] px-2.5 border border-rose-300 text-rose-700 rounded-lg text-[11px] font-bold"
                            >
                              Bekukan
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-Tab 3: Audit Log SiagaQu + Tamu */}
            {pengurusSubTab === 'audit' && (
              <div className="divide-y divide-slate-200">
                {guestReports.length > 0 && (
                  <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-600">
                    Laporan Tamu Terbaru ({guestReports.length})
                  </div>
                )}
                {guestReports.map(g => (
                  <div key={g.id} className="px-4 py-3 text-xs flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900">Tamu: {g.guestName} ({g.duration})</div>
                      <div className="text-[11px] text-slate-500">
                        Tuan rumah: {g.hostName} · {g.hostBlock} · {g.relation}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{g.createdAt}</span>
                  </div>
                ))}

                <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-600">
                  Log Sinyal Darurat SiagaQu ({auditLogs.length})
                </div>
                {auditLogs.map(log => (
                  <div key={log.id} className="px-4 py-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">
                        {log.reporterName} · {log.reporterBlock}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          log.auditStatus === 'prank'
                            ? 'text-rose-700'
                            : log.mode === 'REAL'
                            ? 'text-amber-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {log.mode} · {log.auditStatus === 'prank' ? 'Alarm Palsu' : log.date}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      {log.category} — {log.transcript}
                    </p>
                    {isPengurusMode && log.auditStatus !== 'prank' && (
                      <div className="pt-1">
                        <button
                          onClick={() => {
                            RtSiagaStorage.markAuditLogAsPrank(log.id, 'Koordinator Keamanan');
                            showNotification(
                              `Log ditandai alarm palsu. Akses SiagaQu ${log.reporterName} dibekukan.`
                            );
                          }}
                          className="min-h-[34px] px-3 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-bold"
                        >
                          Tandai Alarm Palsu & Bekukan Akses
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sub-Tab 4: Pengaturan RTQu / PaguyubanQu / Organisasi / Sosial */}
            {pengurusSubTab === 'pengaturan' && (
              <form onSubmit={handleSaveOrgSettings} className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Jenis Komunitas / Organisasi
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOrgDraft(prev => ({ ...prev, orgType: 'RT' }))}
                      className={`min-h-[40px] rounded-lg border text-xs font-bold ${
                        orgDraft.orgType === 'RT'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      RTQu
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrgDraft(prev => ({ ...prev, orgType: 'Paguyuban' }))}
                      className={`min-h-[40px] rounded-lg border text-xs font-bold ${
                        orgDraft.orgType === 'Paguyuban'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      PaguyubanQu
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrgDraft(prev => ({ ...prev, orgType: 'Organisasi' }))}
                      className={`min-h-[40px] rounded-lg border text-xs font-bold ${
                        orgDraft.orgType === 'Organisasi'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Organisasi / Ormas
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrgDraft(prev => ({ ...prev, orgType: 'Sosial' }))}
                      className={`min-h-[40px] rounded-lg border text-xs font-bold ${
                        orgDraft.orgType === 'Sosial'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Sosial (DKM / Panti)
                    </button>
                  </div>
                </div>

                {(orgDraft.orgType === 'Organisasi' || orgDraft.orgType === 'Sosial') && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nama Modul / Lembaga Kustom
                    </label>
                    <input
                      type="text"
                      value={orgDraft.customBrandName || ''}
                      onChange={e =>
                        setOrgDraft(prev => ({ ...prev, customBrandName: e.target.value }))
                      }
                      placeholder={
                        orgDraft.orgType === 'Sosial'
                          ? 'Contoh: DKM Al-Ikhlas / Panti Asuhan Harapan'
                          : 'Contoh: Karang Taruna / Ikatan Alumni / Ormas'
                      }
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Wilayah / Sub-Nama Komunitas
                  </label>
                  <input
                    type="text"
                    value={orgDraft.orgName}
                    onChange={e => setOrgDraft(prev => ({ ...prev, orgName: e.target.value }))}
                    placeholder="Contoh: RT 03 / RW 05 atau Cluster Harmoni"
                    className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Iuran Rutin per Bulan (Rp, isi 0 jika donasi sukarela)
                  </label>
                  <input
                    type="number"
                    value={orgDraft.monthlyDuesAmount}
                    onChange={e =>
                      setOrgDraft(prev => ({
                        ...prev,
                        monthlyDuesAmount: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 text-xs font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[42px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold"
                >
                  Simpan Pengaturan
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveSheet('undang_komunitas')}
                    className="min-h-[40px] border border-emerald-700 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Bagikan Undangan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLeaveActiveCommunity}
                    className="min-h-[40px] border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Keluar / Hapus</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <EncryptedBackupPanel
                    scope="rtqu"
                    title={`Cadangan Kas & Data ${brandTitle} Terenkripsi (.wqbak)`}
                    description="Enkripsi buku kas, iuran warga, surat & arsip dengan kata sandi agar aman disimpan ke Google Drive jika HP bendahara rusak."
                    showNotification={showNotification}
                  />
                </div>
              </form>
            )}
          </div>
        )}
          </>
        )}
      </main>

      {/* ===================================================================== */}
      {/* 3. MINIMALIST BOTTOM TAB BAR (5 TABS)                                 */}
      {/* ===================================================================== */}
      {communities.length > 0 && (
        <nav className="bg-white border-t border-slate-200 grid grid-cols-5 h-14 shrink-0 z-20">
          {[
            { id: 'ringkasan', label: 'Ringkasan' },
            { id: 'forum', label: 'Forum' },
            { id: 'keuangan', label: 'Keuangan' },
            { id: 'iuran', label: 'Kartu' },
            { id: 'pengurus', label: 'Pengurus' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as MainTab)}
              className={`text-[11px] font-bold border-t-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-700 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {/* ===================================================================== */}
      {/* 4. MINIMALIST SHEETS / MODALS                                         */}
      {/* ===================================================================== */}
      {activeSheet && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl border-t border-slate-200 max-h-[85vh] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-slate-900">
                {activeSheet === 'bayar' && 'Bayar Iuran Bulanan'}
                {activeSheet === 'buat_post' && 'Tulis di Forum Warga'}
                {activeSheet === 'tamu' && 'Lapor Tamu Menginap 1×24 Jam'}
                {activeSheet === 'surat' && 'Surat Pengantar Warga'}
                {activeSheet === 'buat_surat' && 'Ajukan Surat Pengantar'}
                {activeSheet === 'ronda' && 'Jadwal Ronda & Kerja Bakti'}
                {activeSheet === 'catat_kas' && 'Catat Pemasukan / Pengeluaran Kas'}
                {activeSheet === 'koreksi_kas' && 'Koreksi Entri Kas (Append-Only)'}
                {activeSheet === 'pin_pengurus' && 'Verifikasi Akses Pengurus'}
                {activeSheet === 'buat_komunitas' && 'Buat Komunitas Baru (RT / Paguyuban / Org / Sosial)'}
                {activeSheet === 'undang_komunitas' && `Undang Warga ke ${profile.orgName}`}
                {activeSheet === 'import_excel' && 'Smart Impor Excel (Poin Penting)'}
                {activeSheet === 'klaim_profil' && 'Klaim Profil Warga (Kode Undangan)'}
                {activeSheet === 'buat_undangan' && 'Buat Undangan Acara & RSVP'}
                {activeSheet === 'arsip_tahunan' && `Arsip Tahunan & Lembaran Baru ${profile.year}`}
              </h3>
              <button
                onClick={() => {
                  setActiveSheet(null);
                  setInvitationPrefill(null);
                }}
                className="p-1.5 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {(activeSheet === 'import_excel' ||
                activeSheet === 'klaim_profil' ||
                activeSheet === 'buat_undangan' ||
                activeSheet === 'arsip_tahunan') && (
                <RtExcelAndClaimSheet
                  sheetType={activeSheet}
                  profile={profile}
                  brandTitle={brandTitle}
                  currentUser={currentUser}
                  members={members}
                  initialInvitationPrefill={invitationPrefill}
                  onClose={() => {
                    setActiveSheet(null);
                    setInvitationPrefill(null);
                  }}
                  showNotification={showNotification}
                />
              )}
              {/* SHEET: BAYAR IURAN QRIS */}
              {activeSheet === 'bayar' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl p-4 text-center space-y-2">
                    <div className="text-xs font-bold text-slate-800">
                      QRIS {brandTitle} · {profile.orgName}
                    </div>
                    <QrCode className="w-28 h-28 text-slate-900 mx-auto" />
                    <div className="text-lg font-extrabold text-emerald-700 font-mono tabular-nums">
                      Rp {(selectedPayMonths.length * profile.monthlyDuesAmount).toLocaleString('id-ID')}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Bulan:{' '}
                      {selectedPayMonths
                        .map(mk => MONTHS_12.find(m => m.key === mk)?.short || mk)
                        .join(', ')}{' '}
                      {profile.year} · {currentUser.name} ({currentUser.block})
                    </div>
                    {(() => {
                      const base = selectedPayMonths.length * profile.monthlyDuesAmount;
                      const fee = MonetizationService.calculateFee('rtqu_iuran', base);
                      if (!fee.enabled || fee.feeAmount <= 0) return null;
                      return (
                        <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex items-center justify-between font-mono tabular-nums">
                          <span>{fee.label}</span>
                          <span className="font-bold text-slate-900">
                            +Rp {fee.feeAmount.toLocaleString('id-ID')}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleConfirmPaySelectedMonths('QRIS RT-Pay')}
                      className="min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold"
                    >
                      Bayar via QRIS
                    </button>
                    <button
                      onClick={() => handleConfirmPaySelectedMonths('Tunai Bendahara')}
                      className="min-h-[44px] border border-slate-300 text-slate-800 hover:bg-slate-50 rounded-xl font-bold"
                    >
                      Catat Bayar Tunai
                    </button>
                  </div>
                </div>
              )}

              {/* SHEET: BUAT POSTINGAN FORUM WARGA */}
              {activeSheet === 'buat_post' && (
                <form onSubmit={handleSubmitForumPost} className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Jenis Kiriman</label>
                    <select
                      value={postForm.category}
                      onChange={e =>
                        setPostForm(prev => ({ ...prev, category: e.target.value as ForumCategory }))
                      }
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-2.5"
                    >
                      <option value="aspirasi">Aspirasi / Aduan Lingkungan</option>
                      <option value="jadwal">Share Jadwal Ronda / Kerja Bakti</option>
                      <option value="polling">Buat Polling / Musyawarah</option>
                      <option value="info">Kabar Warga / Info Umum</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Judul</label>
                    <input
                      type="text"
                      required
                      value={postForm.title}
                      onChange={e => setPostForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder={
                        postForm.category === 'jadwal'
                          ? 'Contoh: Jadwal Kerja Bakti Minggu Ini'
                          : 'Contoh: Lampu gang Blok A berkedip'
                      }
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                    />
                  </div>

                  {postForm.category === 'jadwal' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Waktu</label>
                        <input
                          type="text"
                          value={postForm.scheduleDate}
                          onChange={e =>
                            setPostForm(prev => ({ ...prev, scheduleDate: e.target.value }))
                          }
                          placeholder="Minggu, 07:30 WIB"
                          className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Lokasi</label>
                        <input
                          type="text"
                          value={postForm.scheduleLocation}
                          onChange={e =>
                            setPostForm(prev => ({ ...prev, scheduleLocation: e.target.value }))
                          }
                          placeholder="Balai Warga / Pos"
                          className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                        />
                      </div>
                    </div>
                  )}

                  {postForm.category === 'polling' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Opsi 1</label>
                        <input
                          type="text"
                          value={postForm.pollOption1}
                          onChange={e =>
                            setPostForm(prev => ({ ...prev, pollOption1: e.target.value }))
                          }
                          className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Opsi 2</label>
                        <input
                          type="text"
                          value={postForm.pollOption2}
                          onChange={e =>
                            setPostForm(prev => ({ ...prev, pollOption2: e.target.value }))
                          }
                          className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Keterangan Lengkap</label>
                    <textarea
                      rows={3}
                      required
                      value={postForm.content}
                      onChange={e => setPostForm(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Tuliskan detail aspirasi, jadwal, atau informasi warga..."
                      className="w-full border border-slate-300 rounded-lg p-3"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    <span>Terbitkan ke Forum Warga</span>
                  </button>
                </form>
              )}

              {/* SHEET: LAPOR TAMU 1X24 JAM */}
              {activeSheet === 'tamu' && (
                <form onSubmit={handleSubmitGuestReport} className="space-y-3">
                  <p className="text-[11px] text-slate-600">
                    Data tamu otomatis diteruskan ke Koordinator Keamanan {profile.orgName} untuk mendukung ketertiban & SiagaQu.
                  </p>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nama Tamu / Penghuni Baru</label>
                    <input
                      type="text"
                      required
                      value={guestForm.guestName}
                      onChange={e => setGuestForm(prev => ({ ...prev, guestName: e.target.value }))}
                      placeholder="Nama lengkap tamu"
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Hubungan</label>
                      <input
                        type="text"
                        value={guestForm.relation}
                        onChange={e => setGuestForm(prev => ({ ...prev, relation: e.target.value }))}
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Lama Menginap</label>
                      <input
                        type="text"
                        value={guestForm.duration}
                        onChange={e => setGuestForm(prev => ({ ...prev, duration: e.target.value }))}
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-emerald-700 text-white rounded-xl font-bold"
                  >
                    Kirim Laporan Tamu
                  </button>
                </form>
              )}

              {/* SHEET: PIN PENGURUS */}
              {activeSheet === 'pin_pengurus' && (
                <form onSubmit={handleUnlockPengurus} className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Masukkan PIN internal pengurus untuk akses offline, atau login dengan akun Google
                    pengurus yang terdaftar di tab Koordinator.
                  </p>
                  <input
                    type="password"
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    placeholder="Masukkan PIN pengurus..."
                    className="w-full min-h-[44px] border border-slate-300 rounded-xl px-3 text-sm font-mono tracking-widest"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-emerald-700 text-white rounded-xl font-bold"
                  >
                    Buka Mode Pengurus
                  </button>
                </form>
              )}

              {/* SHEET: KOREKSI KAS APPEND-ONLY */}
              {activeSheet === 'koreksi_kas' && correctionTarget && (
                <form onSubmit={handleSubmitCorrectionKas} className="space-y-3">
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="text-xs font-bold text-slate-900">
                      Transaksi Asli: {correctionTarget.title}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Nominal: Rp {correctionTarget.amount.toLocaleString('id-ID')} (
                      {correctionTarget.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}) ·{' '}
                      {correctionTarget.date}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Demi transparansi anti-manipulasi, entri lama tidak dihapus. Sistem akan membuat
                    entri pembalik otomatis disertai catatan alasan dan identitas akun Anda.
                  </p>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Alasan Koreksi *</label>
                    <input
                      type="text"
                      required
                      value={correctionReason}
                      onChange={e => setCorrectionReason(e.target.value)}
                      placeholder="Contoh: Salah ketik nominal / transaksi batal"
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-rose-700 hover:bg-rose-800 text-white rounded-xl font-bold"
                  >
                    Catat Entri Koreksi Permanen
                  </button>
                </form>
              )}

              {/* SHEET: CATAT KAS (PENGURUS) */}
              {activeSheet === 'catat_kas' && (
                <form onSubmit={handleAddKasTransaction} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setKasForm(prev => ({ ...prev, type: 'keluar', category: 'Gaji Keamanan' }))
                      }
                      className={`min-h-[40px] rounded-lg border font-bold ${
                        kasForm.type === 'keluar'
                          ? 'bg-rose-700 text-white border-rose-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Pengeluaran
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setKasForm(prev => ({ ...prev, type: 'masuk', category: 'Donasi / Kas' }))
                      }
                      className={`min-h-[40px] rounded-lg border font-bold ${
                        kasForm.type === 'masuk'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Pemasukan
                    </button>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Kategori Pos</label>
                    <select
                      value={kasForm.category}
                      onChange={e =>
                        setKasForm(prev => ({ ...prev, category: e.target.value as KasCategory }))
                      }
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-2.5"
                    >
                      <option value="Gaji Keamanan">Gaji Keamanan</option>
                      <option value="Petugas Sampah">Petugas Sampah</option>
                      <option value="Listrik & Pos Ronda">Listrik & Pos Ronda</option>
                      <option value="Perbaikan Fasilitas">Perbaikan Fasilitas</option>
                      <option value="Iuran Warga">Iuran Warga</option>
                      <option value="Donasi / Kas">Donasi / Kas</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Keterangan</label>
                    <input
                      type="text"
                      required
                      value={kasForm.title}
                      onChange={e => setKasForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Contoh: Gaji Satpam Malam Minggu ke-2"
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nominal (Rp)</label>
                    <input
                      type="number"
                      required
                      value={kasForm.amount}
                      onChange={e => setKasForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="500000"
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-emerald-700 text-white rounded-xl font-bold"
                  >
                    Simpan ke Buku Kas
                  </button>
                </form>
              )}

              {/* SHEET: SURAT */}
              {activeSheet === 'surat' && (
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveSheet('buat_surat')}
                    className="w-full min-h-[42px] bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Surat Pengantar Baru</span>
                  </button>
                  <div className="divide-y divide-slate-200 border-t border-slate-200">
                    {riwayatSurat.map(surat => (
                      <div key={surat.id} className="py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900">{surat.jenis}</div>
                          <div className="text-[11px] text-slate-500">
                            {surat.tanggal} · {surat.nomor}
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-bold shrink-0 ${
                            surat.status === 'Diproses' ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {surat.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SHEET: BUAT SURAT */}
              {activeSheet === 'buat_surat' && (
                <form onSubmit={handleAjukanSurat} className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Jenis Surat</label>
                    <select
                      value={suratForm.jenis}
                      onChange={e => setSuratForm({ ...suratForm, jenis: e.target.value })}
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-2.5"
                    >
                      <option>Surat Pengantar Pembuatan KTP / KK</option>
                      <option>Surat Pengantar Domisili Tinggal</option>
                      <option>Surat Keterangan Usaha Warga (UMKM)</option>
                      <option>Surat Keterangan Catatan Kepolisian (SKCK)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Keperluan</label>
                    <input
                      type="text"
                      required
                      value={suratForm.keperluan}
                      onChange={e => setSuratForm({ ...suratForm, keperluan: e.target.value })}
                      placeholder="Contoh: Perpanjangan KTP elektronik"
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-emerald-700 text-white rounded-xl font-bold"
                  >
                    Kirim Pengajuan
                  </button>
                </form>
              )}

              {/* SHEET: RONDA & AGENDA */}
              {activeSheet === 'ronda' && (
                <div className="space-y-3">
                  <div className="divide-y divide-slate-200">
                    {[
                      { hari: 'Senin (22:00 - 04:00)', petugas: 'Bpk. Bambang, Hendriana', status: 'Malam Ini' },
                      { hari: 'Selasa (22:00 - 04:00)', petugas: 'Bpk. Dedi, Joko, Anton', status: 'Terjadwal' },
                      { hari: 'Rabu (22:00 - 04:00)', petugas: 'Bpk. Agus, Wawan, Rudi', status: 'Terjadwal' },
                      { hari: 'Minggu (07:30 WIB)', petugas: 'Gotong Royong Saluran Air Blok A-C', status: 'Kerja Bakti' },
                    ].map((item, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">{item.hari}</div>
                          <div className="text-[11px] text-slate-500">{item.petugas}</div>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 shrink-0">{item.status}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setActiveSheet(null);
                      setActiveTab('forum');
                      setForumFilter('jadwal');
                    }}
                    className="w-full min-h-[42px] border border-emerald-700 text-emerald-700 rounded-xl font-bold"
                  >
                    Bagikan & Konfirmasi Kehadiran di Forum
                  </button>
                </div>
              )}

              {/* SHEET: BUAT KOMUNITAS BARU */}
              {activeSheet === 'buat_komunitas' && (
                <form onSubmit={handleCreateCommunitySubmit} className="space-y-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1.5">
                      Pilih Kategori Komunitas
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'RT' as OrgType, label: 'RTQu (Rukun Tetangga)', desc: 'RT resmi / wilayah' },
                        { id: 'Paguyuban' as OrgType, label: 'PaguyubanQu', desc: 'Cluster / perumahan / warga' },
                        { id: 'Organisasi' as OrgType, label: 'Organisasi', desc: 'Ormas / partai / alumni' },
                        { id: 'Sosial' as OrgType, label: 'Sosial / DKM', desc: 'Masjid / panti / yayasan' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCreateCommForm(prev => ({ ...prev, orgType: opt.id }))}
                          className={`p-2 rounded-xl border text-left transition ${
                            createCommForm.orgType === opt.id
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-[11px] font-extrabold">{opt.label}</div>
                          <div
                            className={`text-[10px] ${
                              createCommForm.orgType === opt.id ? 'text-emerald-100' : 'text-slate-500'
                            }`}
                          >
                            {opt.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {(createCommForm.orgType === 'Organisasi' || createCommForm.orgType === 'Sosial') && (
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Nama Singkat Modul
                      </label>
                      <input
                        type="text"
                        value={createCommForm.customBrandName}
                        onChange={e =>
                          setCreateCommForm(prev => ({ ...prev, customBrandName: e.target.value }))
                        }
                        placeholder={
                          createCommForm.orgType === 'Sosial'
                            ? 'Misal: DKM Al-Ikhlas / Panti Harapan'
                            : 'Misal: Karang Taruna / Komunitas Maju'
                        }
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                    </div>
                  )}

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Nama Komunitas / Wilayah *
                    </label>
                    <input
                      type="text"
                      required
                      value={createCommForm.orgName}
                      onChange={e =>
                        setCreateCommForm(prev => ({ ...prev, orgName: e.target.value }))
                      }
                      placeholder={
                        createCommForm.orgType === 'RT'
                          ? 'Contoh: RT 04 / RW 08'
                          : createCommForm.orgType === 'Paguyuban'
                          ? 'Contoh: Paguyuban Cluster Harmoni'
                          : 'Contoh: DKM Masjid Al-Barokah'
                      }
                      className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Area / Kelurahan
                      </label>
                      <input
                        type="text"
                        value={createCommForm.areaName}
                        onChange={e =>
                          setCreateCommForm(prev => ({ ...prev, areaName: e.target.value }))
                        }
                        placeholder="Kel. Sukamaju"
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Iuran/Bln (Rp, 0=Sukarela)
                      </label>
                      <input
                        type="number"
                        value={createCommForm.monthlyDuesAmount}
                        onChange={e =>
                          setCreateCommForm(prev => ({
                            ...prev,
                            monthlyDuesAmount: e.target.value,
                          }))
                        }
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="text-[11px] font-extrabold text-slate-700">
                      Profil Pendiri / Pengurus Utama
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={createCommForm.creatorName}
                        onChange={e =>
                          setCreateCommForm(prev => ({ ...prev, creatorName: e.target.value }))
                        }
                        placeholder="Nama Lengkap Anda *"
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                      <input
                        type="text"
                        value={createCommForm.creatorBlock}
                        onChange={e =>
                          setCreateCommForm(prev => ({ ...prev, creatorBlock: e.target.value }))
                        }
                        placeholder="Blok / Jabatan (Misal: Blok A1)"
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={createCommForm.creatorPhone}
                        onChange={e =>
                          setCreateCommForm(prev => ({ ...prev, creatorPhone: e.target.value }))
                        }
                        placeholder="No HP / WA"
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                      <input
                        type="date"
                        value={createCommForm.termEndDate}
                        onChange={e =>
                          setCreateCommForm(prev => ({ ...prev, termEndDate: e.target.value }))
                        }
                        title="Masa Bakti Berakhir"
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="email"
                        value={createCommForm.sekretarisEmail}
                        onChange={e =>
                          setCreateCommForm(prev => ({ ...prev, sekretarisEmail: e.target.value }))
                        }
                        placeholder="Email Sekretaris (Anti-Monopoli)"
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                      <input
                        type="email"
                        value={createCommForm.bendaharaEmail}
                        onChange={e =>
                          setCreateCommForm(prev => ({ ...prev, bendaharaEmail: e.target.value }))
                        }
                        placeholder="Email Bendahara (Anti-Monopoli)"
                        className="w-full min-h-[40px] border border-slate-300 rounded-lg px-3"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold"
                  >
                    Simpan & Aktifkan Komunitas Baru
                  </button>
                </form>
              )}

              {/* SHEET: BAGIKAN LINK JUDUL KOMUNITAS (SINKRONISASI SAAT MASUK) */}
              {activeSheet === 'undang_komunitas' && activeCommunity && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                    <div className="font-extrabold text-emerald-900 text-xs">
                      Link Judul Komunitas (Sinkronisasi Saat Masuk)
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Link hanya memuat judul <strong>{profile.orgName}</strong> agar ringkas dan mudah dibaca. Saat warga mengklik link, data komunitas otomatis disinkronkan ke HP masing-masing (tanpa DB server).
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">
                      Link Judul ({brandTitle})
                    </label>
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-800 break-all">
                      {communityInviteUrl}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      disabled={!communityInviteUrl}
                      onClick={async () => {
                        if (!communityInviteUrl) return;
                        try {
                          await navigator.clipboard.writeText(communityInviteUrl);
                          showNotification('Link judul komunitas disalin!');
                        } catch {
                          showNotification('Gagal menyalin link.');
                        }
                      }}
                      className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Salin Link Judul</span>
                    </button>

                    <button
                      type="button"
                      disabled={!communityInviteUrl}
                      onClick={async () => {
                        if (!communityInviteUrl) return;
                        const waText = `Halo Bpk/Ibu/Rekan,\nMari bergabung ke grup digital *${profile.orgName}* (${brandTitle}) di aplikasi WargaQu untuk info warga, forum, iuran transparan & keamanan SiagaQu.\n\n👉 Klik link judul (sinkronisasi saat masuk):\n${communityInviteUrl}\n\nSalam,\n${currentUser.name}`;
                        try {
                          await navigator.clipboard.writeText(waText);
                          showNotification('Pesan undangan WhatsApp disalin!');
                        } catch {
                          showNotification('Gagal menyalin pesan WA.');
                        }
                      }}
                      className="w-full min-h-[44px] border border-emerald-700 text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Salin Pesan Undangan Grup WA</span>
                    </button>

                    {compactInviteToken && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(compactInviteToken);
                            showNotification('Kode cadangan offline disalin!');
                          } catch {
                            showNotification('Gagal menyalin kode.');
                          }
                        }}
                        className="w-full min-h-[40px] border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-[11px]"
                      >
                        Salin Kode Offline Saja (Jika Tanpa Jaringan)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
