import { AuthAccount, AuthService } from './authService';
import { InviteRelayService, parseInviteInput } from './inviteRelayService';

export type OrgType = 'RT' | 'Paguyuban' | 'Organisasi' | 'Sosial';
export type SiagaActivationStatus = 'pending' | 'active' | 'suspended';

export interface PaguyubanProfile {
  id?: string;
  orgType: OrgType;
  customBrandName?: string;
  orgName: string;
  areaName: string;
  monthlyDuesAmount: number;
  duesBreakdown: {
    keamanan: number;
    sampah: number;
    kas: number;
  };
  year: number;
  pengurusPin: string;
  inviteCode?: string;
  creatorName?: string;
  createdAt?: string;
  termStartDate?: string;
  termEndDate?: string;
  gracePeriodDays?: number;
  skNumber?: string;
}

export interface RtOfficerAccount {
  id: string;
  name: string;
  role: string;
  division: string;
  email: string;
  phone: string;
  canVerifySiaga: boolean;
  appointedAt: string;
  claimCode?: string;
  claimStatus?: ClaimStatus;
  claimedAt?: string;
}

export type RtTermHealthStatus =
  | 'active'
  | 'warning_90'
  | 'warning_30'
  | 'grace'
  | 'expired';

export interface RtTermHealth {
  status: RtTermHealthStatus;
  daysRemaining: number;
  graceDaysRemaining: number;
  termStartDate: string;
  termEndDate: string;
  gracePeriodDays: number;
  periodLabel: string;
  isReadOnlyLocked: boolean;
  isSertijabOnly: boolean;
  headline: string;
  detail: string;
}

export interface RtHandoverRecord {
  id: string;
  handoverDate: string;
  periodLabel: string;
  outgoingOfficerEmails: string[];
  incomingOfficerEmails: string[];
  incomingOfficers: RtOfficerAccount[];
  closingBalance: number;
  memberCount: number;
  skNumber: string;
  note: string;
  approvedByEmails: string[];
}

export type RtGovernanceActionType =
  | 'update_officers'
  | 'extend_term'
  | 'sertijab'
  | 'collective_recovery';

export type RtGovernanceActionStatus =
  | 'pending'
  | 'approved'
  | 'executed'
  | 'rejected';

export interface RtGovernanceAction {
  id: string;
  actionType: RtGovernanceActionType;
  status: RtGovernanceActionStatus;
  title: string;
  note: string;
  proposedByEmail: string;
  proposedOfficers: RtOfficerAccount[];
  proposedTermStartDate: string;
  proposedTermEndDate: string;
  proposedGracePeriodDays: number;
  proposedSkNumber: string;
  approverEmails: string[];
  createdAt: string;
}

export interface CoordinatorMember {
  id: string;
  role: string;
  division: string;
  name: string;
  phone: string;
  canVerifySiaga: boolean;
}

export interface MonthlyPaymentRecord {
  paid: boolean;
  paidAt?: string;
  method?: string;
  amount: number;
}

export type ClaimStatus = 'unclaimed' | 'invited' | 'claimed';

export interface WargaMember {
  id: string;
  wargaId: string;
  name: string;
  block: string;
  email?: string;
  phone: string;
  deviceId?: string; // hidden device token
  residentType: 'Tetap' | 'Kontrak';
  isCurrentUser?: boolean;
  claimStatus?: ClaimStatus;
  claimCode?: string;
  invitedAt?: string;
  claimedAt?: string;
  priorArrears?: number;
  priorArrearsNote?: string;
  siagaStatus: SiagaActivationStatus;
  siagaRequested?: boolean;
  siagaVerifiedBy?: string;
  siagaVerifiedAt?: string;
  suspendReason?: string;
  falseAlarmCount: number;
  monthlyPayments: Record<string, MonthlyPaymentRecord>;
}

export interface HistoricalArchiveYear {
  id: string;
  year: number;
  totalIncome: number;
  totalExpense: number;
  endingBalance: number;
  note: string;
  source: 'Manual' | 'Impor Excel';
}

export type InvitationEventType =
  | 'Rapat Warga'
  | 'Kerja Bakti'
  | 'Acara Lingkungan'
  | 'Rapat Pengurus';

export type InvitationRsvpStatus = 'hadir' | 'wakil' | 'izin';

export interface InvitationRsvpEntry {
  memberId: string;
  name: string;
  block: string;
  status: InvitationRsvpStatus;
  note?: string;
}

export interface CommunityInvitation {
  id: string;
  eventType: InvitationEventType;
  title: string;
  dateTime: string;
  location: string;
  targetAudience: string;
  agenda: string;
  senderName: string;
  createdAt: string;
  rsvps: Record<string, InvitationRsvpEntry>;
}

export type KasCategory =
  | 'Iuran Warga'
  | 'Donasi / Kas'
  | 'Gaji Keamanan'
  | 'Petugas Sampah'
  | 'Listrik & Pos Ronda'
  | 'Perbaikan Fasilitas';

export interface KasTransaction {
  id: string;
  type: 'masuk' | 'keluar';
  category: KasCategory;
  title: string;
  amount: number;
  date: string;
  recordedBy: string;
  recordedByEmail?: string;
  isCorrection?: boolean;
  correctsTxId?: string;
}

export interface SiagaAuditLog {
  id: string;
  timestamp: string;
  date: string;
  category: string;
  mode: 'Simulasi' | 'REAL';
  scope?: 'umum_rt' | 'pribadi_hp' | 'keluarga' | 'perusahaan';
  reporterId: string;
  reporterName: string;
  reporterBlock: string;
  reporterEmail?: string;
  reporterPhone?: string;
  reporterDeviceId?: string; // hidden internal device token
  location: string;
  transcript: string;
  auditStatus: 'pending' | 'valid' | 'prank';
}

export type ForumCategory = 'jadwal' | 'aspirasi' | 'polling' | 'info';
export type AspirationStatus = 'Menunggu' | 'Diproses' | 'Selesai';

export interface ForumComment {
  id: string;
  author: string;
  authorBlock: string;
  text: string;
  time: string;
}

export interface ForumPollOption {
  id: string;
  label: string;
  voterIds: string[];
}

export interface ForumPost {
  id: string;
  category: ForumCategory;
  title: string;
  content: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  scheduleDate?: string;
  scheduleLocation?: string;
  attendeeIds?: string[];
  aspirationStatus?: AspirationStatus;
  upvoterIds: string[];
  pollOptions?: ForumPollOption[];
  comments: ForumComment[];
}

export interface GuestReport {
  id: string;
  hostName: string;
  hostBlock: string;
  guestName: string;
  relation: string;
  duration: string;
  createdAt: string;
}

export interface RtCommunityWorkspace {
  id: string;
  joinedVia: 'owner_seed' | 'created' | 'invited';
  invitedBy?: string;
  joinedAt: string;
  profile: PaguyubanProfile;
  coordinators: CoordinatorMember[];
  officers?: RtOfficerAccount[];
  members: WargaMember[];
  transactions: KasTransaction[];
  auditLogs: SiagaAuditLog[];
  forumPosts: ForumPost[];
  guestReports: GuestReport[];
  archives: HistoricalArchiveYear[];
  invitations: CommunityInvitation[];
  handovers?: RtHandoverRecord[];
  governanceActions?: RtGovernanceAction[];
  lastGovernanceActionId?: string;
  cloudSyncedAt?: string;
}

export const MONTHS_12: Array<{ key: string; short: string; full: string }> = [
  { key: '01', short: 'Jan', full: 'Januari' },
  { key: '02', short: 'Feb', full: 'Februari' },
  { key: '03', short: 'Mar', full: 'Maret' },
  { key: '04', short: 'Apr', full: 'April' },
  { key: '05', short: 'Mei', full: 'Mei' },
  { key: '06', short: 'Jun', full: 'Juni' },
  { key: '07', short: 'Jul', full: 'Juli' },
  { key: '08', short: 'Agu', full: 'Agustus' },
  { key: '09', short: 'Sep', full: 'September' },
  { key: '10', short: 'Okt', full: 'Oktober' },
  { key: '11', short: 'Nov', full: 'November' },
  { key: '12', short: 'Des', full: 'Desember' },
];

export const RT_SYNC_EVENT = 'wargaqu-rt-siaga-sync';
export const PENDING_RT_INVITE_KEY = 'wargaqu_pending_rt_invite_v1';
export const CARRYOVER_RT_INVITE_KEY = 'wargaqu_carryover_rt_invite_v1';

const OWNER_EMAILS = ['usahaqu2026@gmail.com', 'usahaqu26@gmail.com'];

const LEGACY_KEYS = {
  PROFILE: 'wargaqu_rt_profile_v2',
  COORDINATORS: 'wargaqu_rt_coordinators_v2',
  MEMBERS: 'wargaqu_rt_members_v2',
  TRANSACTIONS: 'wargaqu_rt_kas_v2',
  AUDIT_LOGS: 'wargaqu_rt_siaga_audit_v2',
  FORUM_POSTS: 'wargaqu_rt_forum_v1',
  GUEST_REPORTS: 'wargaqu_rt_guests_v1',
  ARCHIVES: 'wargaqu_rt_archives_v1',
  INVITATIONS: 'wargaqu_rt_invitations_v1',
};

function getCurrentAccountScope() {
  const acc = AuthService.getAccount();
  const email = (acc?.email || '').trim().toLowerCase();
  const scopeKey = email ? email.replace(/[^a-z0-9@._-]/g, '_') : 'guest';
  const isOwner = OWNER_EMAILS.includes(email);
  return { acc, email, scopeKey, isOwner };
}

function getScopedWorkspacesKey(scopeKey: string): string {
  return `wargaqu_rt_workspaces_v3_${scopeKey}`;
}

function getScopedActiveIdKey(scopeKey: string): string {
  return `wargaqu_rt_active_id_v3_${scopeKey}`;
}

// Data komunitas RT/Paguyuban mulai bersih ([]), terisi hanya dari input pengurus/warga atau undangan komunitas.

function buildInitialPayments(paidThroughMonth: number, amount: number): Record<string, MonthlyPaymentRecord> {
  const map: Record<string, MonthlyPaymentRecord> = {};
  MONTHS_12.forEach((m, index) => {
    const monthNum = index + 1;
    if (monthNum <= paidThroughMonth) {
      map[m.key] = {
        paid: true,
        paidAt: `05 ${m.short} 2026`,
        method: 'QRIS RT-Pay',
        amount,
      };
    } else {
      map[m.key] = {
        paid: false,
        amount,
      };
    }
  });
  return map;
}

function buildPaymentsFromMonths(
  paidMonths: number[] | undefined,
  paidCountFallback: number,
  amount: number,
  year: number
): Record<string, MonthlyPaymentRecord> {
  const monthSet = new Set<number>(
    Array.isArray(paidMonths) && paidMonths.length > 0
      ? paidMonths.filter(n => n >= 1 && n <= 12)
      : Array.from({ length: Math.max(0, Math.min(12, paidCountFallback || 0)) }, (_, i) => i + 1)
  );
  const map: Record<string, MonthlyPaymentRecord> = {};
  MONTHS_12.forEach((m, idx) => {
    const monthNum = idx + 1;
    if (monthSet.has(monthNum)) {
      map[m.key] = {
        paid: true,
        paidAt: `05 ${m.short} ${year}`,
        method: 'Impor Dokumen',
        amount,
      };
    } else {
      map[m.key] = {
        paid: false,
        amount,
      };
    }
  });
  return map;
}

const DEFAULT_OFFICERS: RtOfficerAccount[] = [];

const EMPTY_NEUTRAL_PROFILE: PaguyubanProfile = {
  orgType: 'RT',
  orgName: 'Belum Gabung Komunitas',
  areaName: 'Gabung via undangan atau buat komunitas baru',
  monthlyDuesAmount: 0,
  duesBreakdown: {
    keamanan: 0,
    sampah: 0,
    kas: 0,
  },
  year: 2026,
  pengurusPin: '0000',
};


function emitSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RT_SYNC_EVENT));
  }
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // ignore storage parse failure
  }
  return fallback;
}

function normalizeMembersList(raw: WargaMember[], orgName: string): WargaMember[] {
  return (raw || []).map((m, idx) => ({
    ...m,
    claimStatus: m.claimStatus || 'claimed',
    claimCode:
      m.claimCode ||
      `WQ-${orgName.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'RT'}-${String(idx + 1).padStart(2, '0')}-${m.phone.replace(/\D/g, '').slice(-4) || '0000'}`,
  }));
}

function migrateLegacyWorkspace(): RtCommunityWorkspace | null {
  const legacyProfile = safeRead<PaguyubanProfile | null>(LEGACY_KEYS.PROFILE, null);
  if (!legacyProfile) return null;
  const profile: PaguyubanProfile = {
    ...EMPTY_NEUTRAL_PROFILE,
    ...legacyProfile,
    id: legacyProfile.id || `comm-${Date.now()}`,
  };
  const coordinators = safeRead<CoordinatorMember[]>(LEGACY_KEYS.COORDINATORS, []);
  const members = normalizeMembersList(
    safeRead<WargaMember[]>(LEGACY_KEYS.MEMBERS, []),
    profile.orgName
  );
  const transactions = safeRead<KasTransaction[]>(LEGACY_KEYS.TRANSACTIONS, []);
  const auditLogs = safeRead<SiagaAuditLog[]>(LEGACY_KEYS.AUDIT_LOGS, []);
  const forumPosts = safeRead<ForumPost[]>(LEGACY_KEYS.FORUM_POSTS, []);
  const guestReports = safeRead(LEGACY_KEYS.GUEST_REPORTS, []);
  const archives = safeRead<HistoricalArchiveYear[]>(LEGACY_KEYS.ARCHIVES, []);
  const invitations = safeRead<CommunityInvitation[]>(LEGACY_KEYS.INVITATIONS, []);

  return {
    id: profile.id || `comm-${Date.now()}`,
    joinedVia: 'created',
    joinedAt: new Date().toISOString(),
    profile,
    coordinators,
    officers: [...DEFAULT_OFFICERS],
    members,
    transactions,
    auditLogs,
    forumPosts,
    guestReports,
    archives,
    invitations,
    handovers: [],
    governanceActions: [],
  };
}

function loadScopedWorkspaces(): RtCommunityWorkspace[] {
  const { scopeKey, isOwner } = getCurrentAccountScope();
  const key = getScopedWorkspacesKey(scopeKey);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as RtCommunityWorkspace[];
      }
    }
  } catch {
    // ignore
  }

  if (isOwner) {
    try {
      const legacy = migrateLegacyWorkspace();
      if (legacy) {
        const migrated = [legacy];
        localStorage.setItem(key, JSON.stringify(migrated));
        localStorage.setItem(getScopedActiveIdKey(scopeKey), migrated[0].id);
        return migrated;
      }
    } catch {
      // ignore
    }
  }

  return [];
}

function saveScopedWorkspaces(list: RtCommunityWorkspace[], activeId?: string) {
  const { scopeKey } = getCurrentAccountScope();
  try {
    localStorage.setItem(getScopedWorkspacesKey(scopeKey), JSON.stringify(list));
    if (activeId !== undefined) {
      localStorage.setItem(getScopedActiveIdKey(scopeKey), activeId);
    }
  } catch {
    // ignore storage write failure
  }
  emitSync();
}

function updateActiveWorkspace(
  updater: (ws: RtCommunityWorkspace) => RtCommunityWorkspace
) {
  const list = loadScopedWorkspaces();
  if (list.length === 0) return;
  const active = getActiveFromList(list);
  if (!active) return;
  const nextList = list.map(ws => (ws.id === active.id ? updater(ws) : ws));
  saveScopedWorkspaces(nextList, active.id);
}

function getActiveFromList(list: RtCommunityWorkspace[]): RtCommunityWorkspace | null {
  if (list.length === 0) return null;
  const { scopeKey } = getCurrentAccountScope();
  try {
    const savedId = localStorage.getItem(getScopedActiveIdKey(scopeKey));
    if (savedId) {
      const matched = list.find(w => w.id === savedId);
      if (matched) return matched;
    }
  } catch {
    // ignore
  }
  return list[0];
}

function buildGuestFallbackMember(acc: AuthAccount | null): WargaMember {
  const name = acc ? AuthService.getDisplayName(acc) : 'Warga Baru';
  return {
    id: 'warga-guest-fallback',
    wargaId: 'WQ-BELUM-GABUNG',
    name,
    block: 'Belum Terdaftar di RT/Komunitas',
    email: acc?.email,
    phone: acc?.phone || '-',
    deviceId: acc?.deviceId,
    residentType: 'Tetap',
    isCurrentUser: true,
    claimStatus: 'unclaimed',
    siagaStatus: 'pending',
    siagaRequested: false,
    falseAlarmCount: 0,
    monthlyPayments: buildInitialPayments(0, 0),
  };
}

// ============================================================================
// INVITE LINK & COMPACT CODEC (WQR2_ DEFLATE-RAW + WQR1: FALLBACK, ZERO SERVER DB)
// ============================================================================

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64u: string): Uint8Array<ArrayBuffer> {
  const norm = b64u.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export interface DecodedRtInvitePayload {
  communityId: string;
  inviterName: string;
  profile: PaguyubanProfile;
  coordinators: CoordinatorMember[];
  officers?: RtOfficerAccount[];
  members?: WargaMember[];
  transactions?: KasTransaction[];
  archives?: HistoricalArchiveYear[];
  targetMember?: WargaMember;
  recentPosts?: ForumPost[];
  recentInvitations?: CommunityInvitation[];
}

function sanitizeMembersForInvite(members: WargaMember[] | undefined): WargaMember[] | undefined {
  if (!Array.isArray(members) || members.length === 0) return undefined;
  return members.slice(0, 180).map(m => ({
    ...m,
    isCurrentUser: false,
  }));
}

export function encodeRtInviteToken(
  ws: RtCommunityWorkspace,
  inviterName: string,
  targetMember?: WargaMember
): string {
  const payload: DecodedRtInvitePayload = {
    communityId: ws.id,
    inviterName: inviterName || 'Pengurus',
    profile: { ...ws.profile, id: ws.id },
    coordinators: (ws.coordinators || []).slice(0, 12),
    officers: (ws.officers || []).slice(0, 12),
    members: targetMember ? undefined : sanitizeMembersForInvite(ws.members),
    transactions: targetMember ? undefined : (ws.transactions || []).slice(0, 120),
    archives: targetMember ? undefined : (ws.archives || []).slice(0, 12),
    targetMember: targetMember
      ? {
          ...targetMember,
          isCurrentUser: false,
        }
      : undefined,
    recentPosts: (ws.forumPosts || []).slice(0, 4),
    recentInvitations: (ws.invitations || []).slice(0, 3),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return `WQR1:${toBase64Url(bytes)}`;
}

export async function encodeRtInviteTokenCompact(
  ws: RtCommunityWorkspace,
  inviterName: string,
  targetMember?: WargaMember
): Promise<string> {
  const payload: DecodedRtInvitePayload = {
    communityId: ws.id,
    inviterName: inviterName || 'Pengurus',
    profile: { ...ws.profile, id: ws.id },
    coordinators: (ws.coordinators || []).slice(0, 12),
    officers: (ws.officers || []).slice(0, 12),
    members: targetMember ? undefined : sanitizeMembersForInvite(ws.members),
    transactions: targetMember ? undefined : (ws.transactions || []).slice(0, 120),
    archives: targetMember ? undefined : (ws.archives || []).slice(0, 12),
    targetMember: targetMember ? { ...targetMember, isCurrentUser: false } : undefined,
    recentPosts: (ws.forumPosts || []).slice(0, 3),
    recentInvitations: (ws.invitations || []).slice(0, 2),
  };
  const rawBytes = new TextEncoder().encode(JSON.stringify(payload));
  try {
    if (typeof CompressionStream !== 'undefined') {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(rawBytes);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return `WQR2_${toBase64Url(new Uint8Array(buf))}`;
    }
  } catch {
    // fallback to WQR1
  }
  return encodeRtInviteToken(ws, inviterName, targetMember);
}

function extractRtRawToken(rawInput: string): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('rt=') || trimmed.includes('rtInvite=')) {
    try {
      const qIdx = trimmed.indexOf('?');
      const hIdx = trimmed.indexOf('#');
      const sliceFrom =
        qIdx >= 0 ? trimmed.slice(qIdx) : hIdx >= 0 ? `?${trimmed.slice(hIdx + 1)}` : `?${trimmed}`;
      const params = new URLSearchParams(sliceFrom.split('#')[0]);
      const extracted = params.get('rt') || params.get('rtInvite');
      if (extracted) return extracted.trim();
      if (trimmed.includes('rt=')) {
        const after = trimmed.split('rt=')[1]?.split('&')[0]?.split('#')[0];
        if (after) return decodeURIComponent(after).trim();
      }
    } catch {
      // keep raw
    }
  }
  return trimmed;
}

export async function decodeRtInviteInputAsync(
  rawInput: string
): Promise<DecodedRtInvitePayload | null> {
  const parsedHint = parseInviteInput(rawInput, 'rt');
  let resolved = rawInput;
  if (parsedHint?.mode === 'short_code') {
    resolved = await InviteRelayService.resolveInviteTokenIfShort(rawInput);
  } else if (parsedHint?.mode === 'room_slug') {
    const syncRes = await InviteRelayService.syncRoomOnEntry({
      kind: 'rt',
      slugOrTitle: parsedHint.canonicalSlug,
    });
    if (syncRes.ok && syncRes.snapshot) {
      resolved = syncRes.snapshot;
    } else {
      return null;
    }
  } else {
    resolved = await InviteRelayService.resolveInviteTokenIfShort(rawInput);
  }

  const token = extractRtRawToken(resolved);
  if (!token) return null;

  if (token.startsWith('WQR2_')) {
    try {
      const compressed = fromBase64Url(token.slice(5));
      if (typeof DecompressionStream === 'undefined') return null;
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressed);
      writer.close();
      const buf = await new Response(ds.readable).arrayBuffer();
      const parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(buf))) as DecodedRtInvitePayload;
      if (parsed?.communityId && parsed?.profile?.orgName) return parsed;
    } catch {
      return null;
    }
  }

  if (token.startsWith('WQR1:')) {
    try {
      const bytes = fromBase64Url(token.slice(5));
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as DecodedRtInvitePayload;
      if (parsed?.communityId && parsed?.profile?.orgName) return parsed;
    } catch {
      return null;
    }
  }

  return null;
}

export const RtSiagaStorage = {
  isOwnerAccount(): boolean {
    return getCurrentAccountScope().isOwner;
  },

  getCommunities(): RtCommunityWorkspace[] {
    return loadScopedWorkspaces();
  },

  hasCommunities(): boolean {
    return loadScopedWorkspaces().length > 0;
  },

  getActiveCommunity(): RtCommunityWorkspace | null {
    return getActiveFromList(loadScopedWorkspaces());
  },

  getActiveCommunityId(): string | null {
    return this.getActiveCommunity()?.id || null;
  },

  setActiveCommunityId(communityId: string) {
    const list = loadScopedWorkspaces();
    if (!list.some(w => w.id === communityId)) return;
    saveScopedWorkspaces(list, communityId);
  },

  createCommunity(params: {
    orgType: OrgType;
    customBrandName?: string;
    orgName: string;
    areaName: string;
    monthlyDuesAmount: number;
    duesBreakdown?: { keamanan: number; sampah: number; kas: number };
    year?: number;
    pengurusPin: string;
    creatorName: string;
    creatorBlock: string;
    creatorPhone?: string;
    creatorRole?: string;
    termStartDate?: string;
    termEndDate?: string;
    gracePeriodDays?: number;
    skNumber?: string;
    coOfficers?: Array<{ name: string; role: string; email: string; phone?: string }>;
  }): RtCommunityWorkspace {
    const { acc } = getCurrentAccountScope();
    const cleanOrg = params.orgName.trim() || 'Komunitas Baru';
    const year = params.year || new Date().getFullYear();
    const id = `comm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const inviteCode = `WQR-${cleanOrg.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'WRG'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const creatorName = params.creatorName.trim() || (acc ? AuthService.getDisplayName(acc) : 'Pengurus Utama');
    const creatorPhone = params.creatorPhone?.trim() || acc?.phone || '0812-0000-0000';
    const creatorBlock = params.creatorBlock.trim() || 'Pengurus / Inti';
    const monthlyAmount = Math.max(0, params.monthlyDuesAmount || 0);
    const breakdown = params.duesBreakdown || {
      keamanan: Math.round(monthlyAmount * 0.5),
      sampah: Math.round(monthlyAmount * 0.3),
      kas: Math.max(0, monthlyAmount - Math.round(monthlyAmount * 0.5) - Math.round(monthlyAmount * 0.3)),
    };

    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultEndDate = new Date();
    defaultEndDate.setFullYear(defaultEndDate.getFullYear() + 3);
    const termStartDate = params.termStartDate?.trim() || todayIso;
    const termEndDate = params.termEndDate?.trim() || defaultEndDate.toISOString().slice(0, 10);
    const gracePeriodDays =
      typeof params.gracePeriodDays === 'number'
        ? Math.min(60, Math.max(0, params.gracePeriodDays))
        : 14;

    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const prefixTag = cleanOrg.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'WQ';
    const creatorMember: WargaMember = {
      id: `warga-creator-${Date.now()}`,
      wargaId: `WQ-${prefixTag}-001`,
      name: creatorName,
      block: creatorBlock,
      email: acc?.email,
      phone: creatorPhone,
      deviceId: acc?.deviceId,
      residentType: 'Tetap',
      isCurrentUser: true,
      claimStatus: 'claimed',
      claimCode: `${prefixTag}-001-${creatorPhone.replace(/\D/g, '').slice(-4) || '0001'}`,
      claimedAt: todayLabel,
      siagaStatus: 'active',
      siagaVerifiedBy: 'Pendiri Komunitas',
      siagaVerifiedAt: todayLabel,
      falseAlarmCount: 0,
      monthlyPayments: buildInitialPayments(0, monthlyAmount),
    };

    const roleLabel =
      params.creatorRole?.trim() ||
      (params.orgType === 'RT'
        ? 'Ketua RT'
        : params.orgType === 'Paguyuban'
        ? 'Ketua Paguyuban'
        : params.orgType === 'Sosial'
        ? 'Ketua DKM / Yayasan'
        : 'Ketua Organisasi');

    const creatorEmail = (acc?.email || '').trim().toLowerCase();
    const primaryOfficer: RtOfficerAccount = {
      id: `off-${Date.now()}-1`,
      name: creatorName,
      role: roleLabel,
      division: 'Pimpinan & Pengesahan',
      email: creatorEmail,
      phone: creatorPhone,
      canVerifySiaga: true,
      appointedAt: termStartDate,
    };

    const extraOfficers: RtOfficerAccount[] = (params.coOfficers || [])
      .filter(co => co.email.trim().includes('@') && co.email.trim().toLowerCase() !== creatorEmail)
      .slice(0, 8)
      .map((co, idx) => ({
        id: `off-${Date.now()}-${idx + 2}`,
        name: co.name.trim() || co.email.split('@')[0],
        role: co.role.trim() || (idx === 0 ? 'Sekretaris' : 'Bendahara'),
        division: idx === 0 ? 'Administrasi & Surat Warga' : 'Iuran & Transparansi Kas',
        email: co.email.trim().toLowerCase(),
        phone: co.phone?.trim() || '-',
        canVerifySiaga: true,
        appointedAt: termStartDate,
      }));

    const officers = [primaryOfficer, ...extraOfficers];

    const coordinators: CoordinatorMember[] = officers.map(o => ({
      id: o.id,
      role: o.role,
      division: o.division,
      name: o.name,
      phone: o.phone,
      canVerifySiaga: o.canVerifySiaga,
    }));

    const welcomePost: ForumPost = {
      id: `post-init-${Date.now()}`,
      category: 'info',
      title: `Selamat Datang di ${params.customBrandName?.trim() || cleanOrg}`,
      content: `Komunitas ${cleanOrg} (${params.areaName.trim() || 'Wilayah Warga'}) telah resmi dibuka untuk masa bakti ${termStartDate} s.d. ${termEndDate}. Gunakan menu Bagikan Link Undangan untuk mengundang warga/anggota bergabung.`,
      authorName: creatorName,
      authorRole: roleLabel,
      createdAt: 'Baru saja',
      upvoterIds: [creatorMember.id],
      comments: [],
    };

    const workspace: RtCommunityWorkspace = {
      id,
      joinedVia: 'created',
      joinedAt: new Date().toISOString(),
      profile: {
        id,
        orgType: params.orgType,
        customBrandName: params.customBrandName?.trim() || undefined,
        orgName: cleanOrg,
        areaName: params.areaName.trim() || 'Lingkungan Warga',
        monthlyDuesAmount: monthlyAmount,
        duesBreakdown: breakdown,
        year,
        pengurusPin: params.pengurusPin.trim() || '1234',
        inviteCode,
        creatorName,
        createdAt: todayLabel,
        termStartDate,
        termEndDate,
        gracePeriodDays,
        skNumber: params.skNumber?.trim() || '',
      },
      coordinators,
      officers,
      members: [creatorMember],
      transactions: [],
      auditLogs: [],
      forumPosts: [welcomePost],
      guestReports: [],
      archives: [],
      invitations: [],
      handovers: [],
      governanceActions: [],
    };

    const current = loadScopedWorkspaces();
    const nextList = [workspace, ...current];
    saveScopedWorkspaces(nextList, workspace.id);
    return workspace;
  },

  async acceptCommunityInvite(rawInput: string): Promise<{
    ok: boolean;
    message: string;
    community?: RtCommunityWorkspace;
    inviter?: string;
    needsClaim?: boolean;
    pendingSync?: { title: string; canonicalSlug: string; rawInput: string };
  }> {
    const parsedHint = parseInviteInput(rawInput, 'rt');
    const decoded = await decodeRtInviteInputAsync(rawInput);
    const { acc } = getCurrentAccountScope();
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    if (!decoded) {
      if (parsedHint?.mode === 'room_slug') {
        return {
          ok: false,
          message: `Ruang "${parsedHint.titleGuess}" belum merespons sinkronisasi. Pastikan HP pengurus sedang membuka WargaQu atau tekan Sinkronkan Ulang.`,
          pendingSync: {
            title: parsedHint.titleGuess,
            canonicalSlug: parsedHint.canonicalSlug,
            rawInput,
          },
        };
      }
      return {
        ok: false,
        message: 'Link judul atau kode undangan komunitas tidak valid.',
      };
    }

    const list = loadScopedWorkspaces();
    const existingIdx = list.findIndex(w => w.id === decoded.communityId);

    const accountName = acc ? AuthService.getDisplayName(acc) : 'Warga Terundang';
    const accountEmail = acc?.email?.trim().toLowerCase();
    const accountPhone = acc?.phone?.trim() || '0812-0000-0000';

    if (existingIdx !== -1) {
      const existing = list[existingIdx];
      let updatedMembers = existing.members;
      if (decoded.targetMember && !existing.members.some(m => m.id === decoded.targetMember!.id)) {
        updatedMembers = [
          ...existing.members.map(m => ({ ...m, isCurrentUser: false })),
          {
            ...decoded.targetMember,
            isCurrentUser: true,
            email: accountEmail || decoded.targetMember.email,
            phone: acc?.phone || decoded.targetMember.phone,
            deviceId: acc?.deviceId,
            claimStatus: 'claimed' as const,
            claimedAt: todayLabel,
          },
        ];
      } else if (decoded.members && decoded.members.length > 0 && existing.members.length <= 1) {
        const existingCur = existing.members.find(m => m.isCurrentUser);
        const mergedList: WargaMember[] = decoded.members.map(m => ({ ...m, isCurrentUser: false }));
        if (existingCur && !mergedList.some(m => m.id === existingCur.id)) {
          mergedList.unshift({ ...existingCur, isCurrentUser: true });
        } else if (mergedList.length > 0) {
          mergedList[0] = { ...mergedList[0], isCurrentUser: true };
        }
        updatedMembers = mergedList;
      }

      const txMap = new Map<string, KasTransaction>();
      (decoded.transactions || []).forEach(t => txMap.set(t.id, t));
      (existing.transactions || []).forEach(t => {
        if (!txMap.has(t.id)) txMap.set(t.id, t);
      });

      const merged: RtCommunityWorkspace = {
        ...existing,
        profile: { ...decoded.profile, id: decoded.communityId },
        coordinators: decoded.coordinators.length > 0 ? decoded.coordinators : existing.coordinators,
        officers: decoded.officers && decoded.officers.length > 0 ? decoded.officers : existing.officers,
        members: updatedMembers,
        transactions: Array.from(txMap.values()),
        archives: decoded.archives && decoded.archives.length > 0 ? decoded.archives : existing.archives,
      };
      const nextList = list.map((w, i) => (i === existingIdx ? merged : w));
      saveScopedWorkspaces(nextList, merged.id);
      return {
        ok: true,
        message: `Berhasil membuka undangan komunitas "${merged.profile.orgName}"!`,
        community: merged,
        inviter: decoded.inviterName,
        needsClaim: false,
      };
    }

    const prefixTag = decoded.profile.orgName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'WQ';
    const joinedMember: WargaMember = decoded.targetMember
      ? {
          ...decoded.targetMember,
          isCurrentUser: true,
          email: accountEmail || decoded.targetMember.email,
          phone: acc?.phone || decoded.targetMember.phone,
          deviceId: acc?.deviceId,
          claimStatus: 'claimed',
          claimedAt: todayLabel,
        }
      : {
          id: `warga-inv-${Date.now()}`,
          wargaId: `WQ-${prefixTag}-${String(Math.floor(100 + Math.random() * 899))}`,
          name: accountName,
          block: 'Anggota Terundang',
          email: accountEmail,
          phone: accountPhone,
          deviceId: acc?.deviceId,
          residentType: 'Tetap',
          isCurrentUser: true,
          claimStatus: 'claimed',
          claimCode: `${prefixTag}-${accountPhone.replace(/\D/g, '').slice(-4) || '0000'}`,
          claimedAt: todayLabel,
          siagaStatus: 'pending',
          siagaRequested: false,
          falseAlarmCount: 0,
          monthlyPayments: buildInitialPayments(0, decoded.profile.monthlyDuesAmount || 0),
        };

    const syncedMembers: WargaMember[] = decoded.targetMember
      ? [joinedMember]
      : decoded.members && decoded.members.length > 0
      ? (() => {
          const emailMatchIdx = accountEmail
            ? decoded.members.findIndex(m => (m.email || '').trim().toLowerCase() === accountEmail)
            : -1;
          if (emailMatchIdx >= 0) {
            return decoded.members.map((m, i) =>
              i === emailMatchIdx
                ? {
                    ...m,
                    isCurrentUser: true,
                    claimStatus: 'claimed' as const,
                    claimedAt: m.claimedAt || todayLabel,
                  }
                : { ...m, isCurrentUser: false }
            );
          }
          return [joinedMember, ...decoded.members.map(m => ({ ...m, isCurrentUser: false }))];
        })()
      : [joinedMember];

    const syncedOfficers: RtOfficerAccount[] | undefined =
      decoded.officers && decoded.officers.length > 0
        ? decoded.officers.map(o =>
            accountEmail && o.email.trim().toLowerCase() === accountEmail
              ? { ...o, claimStatus: 'claimed' as const, claimedAt: o.claimedAt || todayLabel }
              : o
          )
        : undefined;

    const newWorkspace: RtCommunityWorkspace = {
      id: decoded.communityId,
      joinedVia: 'invited',
      invitedBy: decoded.inviterName,
      joinedAt: new Date().toISOString(),
      profile: { ...decoded.profile, id: decoded.communityId },
      coordinators: decoded.coordinators || [],
      officers: syncedOfficers,
      members: syncedMembers,
      transactions: decoded.transactions || [],
      auditLogs: [],
      forumPosts: decoded.recentPosts || [],
      guestReports: [],
      archives: decoded.archives || [],
      invitations: decoded.recentInvitations || [],
    };

    const nextList = [newWorkspace, ...list];
    saveScopedWorkspaces(nextList, newWorkspace.id);

    return {
      ok: true,
      message: `Otomatis masuk ke ${newWorkspace.profile.orgName} atas undangan ${decoded.inviterName}!`,
      community: newWorkspace,
      inviter: decoded.inviterName,
      needsClaim: Boolean(!decoded.targetMember),
    };
  },

  leaveOrDeleteCommunity(communityId: string) {
    const list = loadScopedWorkspaces();
    const remaining = list.filter(w => w.id !== communityId);
    const nextActive = remaining[0]?.id || '';
    saveScopedWorkspaces(remaining, nextActive);
  },

  encodeCommunityInvite(ws: RtCommunityWorkspace, inviterName: string, targetMember?: WargaMember): string {
    return encodeRtInviteToken(ws, inviterName, targetMember);
  },

  encodeCommunityInviteCompact(
    ws: RtCommunityWorkspace,
    inviterName: string,
    targetMember?: WargaMember
  ): Promise<string> {
    return encodeRtInviteTokenCompact(ws, inviterName, targetMember);
  },

  async publishCommunitySnapshot(ws: RtCommunityWorkspace, inviterName: string): Promise<void> {
    try {
      const snapshot = await encodeRtInviteTokenCompact(ws, inviterName);
      await InviteRelayService.publishRoomSnapshot({
        kind: 'rt',
        title: ws.profile.orgName,
        inviter: inviterName || ws.profile.creatorName || 'Pengurus',
        snapshot,
      });
    } catch {
      // ignore background publish errors
    }
  },

  getProfile(): PaguyubanProfile {
    const active = this.getActiveCommunity();
    if (!active) return EMPTY_NEUTRAL_PROFILE;
    return active.profile;
  },

  saveProfile(profile: PaguyubanProfile) {
    updateActiveWorkspace(ws => ({
      ...ws,
      profile: { ...ws.profile, ...profile, id: ws.id },
    }));
  },

  getCoordinators(): CoordinatorMember[] {
    return this.getActiveCommunity()?.coordinators || [];
  },

  saveCoordinators(coords: CoordinatorMember[]) {
    updateActiveWorkspace(ws => ({ ...ws, coordinators: coords }));
  },

  getMembers(): WargaMember[] {
    const active = this.getActiveCommunity();
    if (!active) return [];
    return normalizeMembersList(active.members, active.profile.orgName);
  },

  saveMembers(members: WargaMember[]) {
    updateActiveWorkspace(ws => ({ ...ws, members }));
  },

  getCurrentMember(): WargaMember {
    const members = this.getMembers();
    if (members.length === 0) {
      return buildGuestFallbackMember(AuthService.getAccount());
    }
    return members.find(m => m.isCurrentUser) || members[0];
  },

  switchCurrentUser(memberId: string) {
    const members = this.getMembers();
    if (members.length === 0) return;
    const updated = members.map(m => ({
      ...m,
      isCurrentUser: m.id === memberId,
    }));
    this.saveMembers(updated);
  },

  syncAuthAccount(account: AuthAccount | null) {
    if (!account) {
      emitSync();
      return;
    }
    const list = loadScopedWorkspaces();
    if (list.length === 0) {
      emitSync();
      return;
    }

    const cleanEmail = account.email.trim().toLowerCase();
    const cleanPhoneDigits = account.phone.replace(/\D/g, '');
    const active = getActiveFromList(list);

    const updatedWorkspaces = list.map(ws => {
      const members = ws.members || [];
      if (members.length === 0) return ws;

      const matchedByCred = members.find(m => {
        const mEmail = (m.email || '').trim().toLowerCase();
        const mDigits = m.phone.replace(/\D/g, '');
        const emailMatches = mEmail && mEmail === cleanEmail;
        const phoneMatches =
          cleanPhoneDigits.length >= 6 &&
          mDigits.length >= 6 &&
          mDigits.slice(-8) === cleanPhoneDigits.slice(-8);
        return Boolean(emailMatches || phoneMatches);
      });

      const targetId = matchedByCred?.id || (members.find(m => m.isCurrentUser) || members[0])?.id;
      const updatedMembers = members.map(m => {
        if (m.id !== targetId) {
          return { ...m, isCurrentUser: false };
        }
        return {
          ...m,
          isCurrentUser: true,
          email: cleanEmail,
          phone: account.phone.trim(),
          deviceId: account.deviceId,
          claimStatus: m.claimStatus || ('claimed' as const),
        };
      });

      return { ...ws, members: updatedMembers };
    });

    saveScopedWorkspaces(updatedWorkspaces, active?.id || '');
  },

  getTransactions(): KasTransaction[] {
    return this.getActiveCommunity()?.transactions || [];
  },

  saveTransactions(txs: KasTransaction[]) {
    updateActiveWorkspace(ws => ({ ...ws, transactions: txs }));
  },

  getAuditLogs(): SiagaAuditLog[] {
    return this.getActiveCommunity()?.auditLogs || [];
  },

  saveAuditLogs(logs: SiagaAuditLog[]) {
    updateActiveWorkspace(ws => ({ ...ws, auditLogs: logs }));
  },

  payMemberMonth(memberId: string, monthKey: string, method: string = 'QRIS RT-Pay') {
    const profile = this.getProfile();
    const members = this.getMembers();
    const target = members.find(m => m.id === memberId);
    if (!target) return;

    const monthLabel = MONTHS_12.find(m => m.key === monthKey)?.short || monthKey;
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const updatedMembers = members.map(m => {
      if (m.id !== memberId) return m;
      return {
        ...m,
        monthlyPayments: {
          ...m.monthlyPayments,
          [monthKey]: {
            paid: true,
            paidAt: todayLabel,
            method,
            amount: profile.monthlyDuesAmount,
          },
        },
      };
    });

    const newTx: KasTransaction = {
      id: `kas-${Date.now()}`,
      type: 'masuk',
      category: 'Iuran Warga',
      title: `Iuran ${monthLabel} ${profile.year} - ${target.name} (${target.block})`,
      amount: profile.monthlyDuesAmount,
      date: todayLabel,
      recordedBy: method,
    };

    updateActiveWorkspace(ws => ({
      ...ws,
      members: updatedMembers,
      transactions: [newTx, ...(ws.transactions || [])],
    }));
  },

  payMemberMultipleMonths(memberId: string, monthKeys: string[], method: string = 'QRIS RT-Pay') {
    const profile = this.getProfile();
    const members = this.getMembers();
    const target = members.find(m => m.id === memberId);
    if (!target || monthKeys.length === 0) return;

    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const updatedMembers = members.map(m => {
      if (m.id !== memberId) return m;
      const nextPayments = { ...m.monthlyPayments };
      monthKeys.forEach(mk => {
        nextPayments[mk] = {
          paid: true,
          paidAt: todayLabel,
          method,
          amount: profile.monthlyDuesAmount,
        };
      });
      return { ...m, monthlyPayments: nextPayments };
    });

    const monthNames = monthKeys
      .map(mk => MONTHS_12.find(m => m.key === mk)?.short || mk)
      .join(', ');
    const totalAmount = profile.monthlyDuesAmount * monthKeys.length;

    const newTx: KasTransaction = {
      id: `kas-${Date.now()}`,
      type: 'masuk',
      category: 'Iuran Warga',
      title: `Iuran (${monthNames}) ${profile.year} - ${target.name} (${target.block})`,
      amount: totalAmount,
      date: todayLabel,
      recordedBy: method,
    };

    updateActiveWorkspace(ws => ({
      ...ws,
      members: updatedMembers,
      transactions: [newTx, ...(ws.transactions || [])],
    }));
  },

  getForumPosts(): ForumPost[] {
    return this.getActiveCommunity()?.forumPosts || [];
  },
  saveForumPosts(posts: ForumPost[]) {
    updateActiveWorkspace(ws => ({ ...ws, forumPosts: posts }));
  },
  addForumPost(post: Omit<ForumPost, 'id' | 'createdAt' | 'upvoterIds' | 'comments'>) {
    const newPost: ForumPost = {
      ...post,
      id: `post-${Date.now()}`,
      createdAt: 'Baru saja',
      upvoterIds: [],
      comments: [],
    };
    this.saveForumPosts([newPost, ...this.getForumPosts()]);
  },
  toggleForumUpvote(postId: string, memberId: string) {
    const updated = this.getForumPosts().map(p => {
      if (p.id !== postId) return p;
      const exists = p.upvoterIds.includes(memberId);
      return {
        ...p,
        upvoterIds: exists
          ? p.upvoterIds.filter(id => id !== memberId)
          : [...p.upvoterIds, memberId],
      };
    });
    this.saveForumPosts(updated);
  },
  toggleForumAttendance(postId: string, memberId: string) {
    const updated = this.getForumPosts().map(p => {
      if (p.id !== postId) return p;
      const current = p.attendeeIds || [];
      const exists = current.includes(memberId);
      return {
        ...p,
        attendeeIds: exists
          ? current.filter(id => id !== memberId)
          : [...current, memberId],
      };
    });
    this.saveForumPosts(updated);
  },
  voteForumPoll(postId: string, optionId: string, memberId: string) {
    const updated = this.getForumPosts().map(p => {
      if (p.id !== postId || !p.pollOptions) return p;
      return {
        ...p,
        pollOptions: p.pollOptions.map(opt => {
          const cleaned = opt.voterIds.filter(id => id !== memberId);
          return opt.id === optionId
            ? { ...opt, voterIds: [...cleaned, memberId] }
            : { ...opt, voterIds: cleaned };
        }),
      };
    });
    this.saveForumPosts(updated);
  },
  addForumComment(postId: string, comment: Omit<ForumComment, 'id' | 'time'>) {
    const updated = this.getForumPosts().map(p => {
      if (p.id !== postId) return p;
      const newComment: ForumComment = {
        ...comment,
        id: `c-${Date.now()}`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      return { ...p, comments: [...p.comments, newComment] };
    });
    this.saveForumPosts(updated);
  },
  updateAspirationStatus(postId: string, status: AspirationStatus) {
    const updated = this.getForumPosts().map(p =>
      p.id === postId ? { ...p, aspirationStatus: status } : p
    );
    this.saveForumPosts(updated);
  },

  getGuestReports(): GuestReport[] {
    return this.getActiveCommunity()?.guestReports || [];
  },
  addGuestReport(report: Omit<GuestReport, 'id' | 'createdAt'>) {
    const next: GuestReport = {
      ...report,
      id: `gst-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    updateActiveWorkspace(ws => ({
      ...ws,
      guestReports: [next, ...(ws.guestReports || [])],
    }));
  },

  requestSiagaActivation(memberId: string) {
    const members = this.getMembers();
    const updated = members.map(m =>
      m.id === memberId ? { ...m, siagaRequested: true } : m
    );
    this.saveMembers(updated);
  },

  setMemberSiagaStatus(
    memberId: string,
    status: SiagaActivationStatus,
    verifierName: string,
    reason?: string
  ) {
    const members = this.getMembers();
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const updated = members.map(m => {
      if (m.id !== memberId) return m;
      return {
        ...m,
        siagaStatus: status,
        siagaRequested: false,
        siagaVerifiedBy: status === 'active' ? verifierName : m.siagaVerifiedBy,
        siagaVerifiedAt: status === 'active' ? todayLabel : m.siagaVerifiedAt,
        suspendReason: status === 'suspended' ? reason || 'Penyalahgunaan / laporan palsu' : undefined,
        falseAlarmCount: status === 'suspended' ? m.falseAlarmCount + 1 : m.falseAlarmCount,
      };
    });
    this.saveMembers(updated);
  },

  addTransaction(tx: Omit<KasTransaction, 'id'>): KasTransaction {
    const newTx: KasTransaction = {
      ...tx,
      id: `kas-${Date.now()}`,
    };
    updateActiveWorkspace(ws => ({
      ...ws,
      transactions: [newTx, ...(ws.transactions || [])],
    }));
    return newTx;
  },

  addCorrectionTransaction(
    originalTx: KasTransaction,
    reason: string,
    actorName: string,
    actorEmail?: string
  ): KasTransaction {
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const oppositeType: 'masuk' | 'keluar' = originalTx.type === 'masuk' ? 'keluar' : 'masuk';
    const cleanReason = reason.trim() || 'Koreksi kesalahan pencatatan';
    return this.addTransaction({
      type: oppositeType,
      category: originalTx.category,
      title: `[Koreksi] ${originalTx.title} — ${cleanReason}`,
      amount: originalTx.amount,
      date: todayLabel,
      recordedBy: actorName,
      recordedByEmail: actorEmail,
      isCorrection: true,
      correctsTxId: originalTx.id,
    });
  },

  addSiagaAuditLog(log: Omit<SiagaAuditLog, 'auditStatus'>) {
    const nextLog: SiagaAuditLog = {
      ...log,
      auditStatus: log.mode === 'REAL' ? 'pending' : 'valid',
    };
    updateActiveWorkspace(ws => ({
      ...ws,
      auditLogs: [nextLog, ...(ws.auditLogs || [])],
    }));
  },

  markAuditLogAsPrank(logId: string, verifierName: string) {
    const logs = this.getAuditLogs();
    const targetLog = logs.find(l => l.id === logId);
    const updatedLogs = logs.map(l =>
      l.id === logId ? { ...l, auditStatus: 'prank' as const } : l
    );
    this.saveAuditLogs(updatedLogs);

    if (targetLog?.reporterId) {
      this.setMemberSiagaStatus(
        targetLog.reporterId,
        'suspended',
        verifierName,
        `Alarm palsu (${targetLog.category}, ${targetLog.date} ${targetLog.timestamp})`
      );
    }
  },

  // --- Historical Archives ---
  getArchives(): HistoricalArchiveYear[] {
    return [...(this.getActiveCommunity()?.archives || [])].sort((a, b) => b.year - a.year);
  },
  saveArchives(archives: HistoricalArchiveYear[]) {
    updateActiveWorkspace(ws => ({ ...ws, archives }));
  },
  addArchive(archive: Omit<HistoricalArchiveYear, 'id'>) {
    const next: HistoricalArchiveYear = {
      ...archive,
      id: `arc-${archive.year}-${Date.now()}`,
    };
    const existing = this.getArchives().filter(a => a.year !== archive.year);
    this.saveArchives([next, ...existing]);
  },
  deleteArchive(id: string) {
    this.saveArchives(this.getArchives().filter(a => a.id !== id));
  },

  // --- Invitations & RSVP ---
  getInvitations(): CommunityInvitation[] {
    return this.getActiveCommunity()?.invitations || [];
  },
  saveInvitations(invs: CommunityInvitation[]) {
    updateActiveWorkspace(ws => ({ ...ws, invitations: invs }));
  },
  addInvitation(inv: Omit<CommunityInvitation, 'id' | 'createdAt' | 'rsvps'>) {
    const next: CommunityInvitation = {
      ...inv,
      id: `inv-${Date.now()}`,
      createdAt: 'Baru saja',
      rsvps: {},
    };
    this.saveInvitations([next, ...this.getInvitations()]);
  },
  setInvitationRsvp(
    invitationId: string,
    member: WargaMember,
    status: InvitationRsvpStatus,
    note?: string
  ) {
    const updated = this.getInvitations().map(inv => {
      if (inv.id !== invitationId) return inv;
      return {
        ...inv,
        rsvps: {
          ...inv.rsvps,
          [member.id]: {
            memberId: member.id,
            name: member.name,
            block: member.block,
            status,
            note,
          },
        },
      };
    });
    this.saveInvitations(updated);
  },

  // --- Pre-registered Warga Invite & Claim System ---
  generateClaimCode(orgName: string, block: string, phone: string): string {
    const orgPrefix = orgName.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'WQ';
    const blockCode = block.replace(/[^A-Za-z0-9]/g, '').slice(-3).toUpperCase() || 'WRG';
    const phoneDigits = phone.replace(/\D/g, '').slice(-4) || String(Math.floor(1000 + Math.random() * 9000));
    return `${orgPrefix}-${blockCode}-${phoneDigits}`;
  },

  markMemberInvited(memberId: string) {
    const profile = this.getProfile();
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const updated = this.getMembers().map(m => {
      if (m.id !== memberId) return m;
      return {
        ...m,
        claimCode: m.claimCode || this.generateClaimCode(profile.orgName, m.block, m.phone),
        claimStatus: m.claimStatus === 'claimed' ? ('claimed' as const) : ('invited' as const),
        invitedAt: todayLabel,
      };
    });
    this.saveMembers(updated);
  },

  claimMemberProfile(
    claimCodeInput: string,
    phoneLast4Input: string
  ): { ok: boolean; message: string; member?: WargaMember } {
    const normalizedCode = claimCodeInput.trim().toUpperCase();
    const normalizedDigits = phoneLast4Input.replace(/\D/g, '');
    if (!normalizedCode) {
      return { ok: false, message: 'Masukkan Kode Klaim dari undangan pengurus.' };
    }

    const allWorkspaces = loadScopedWorkspaces();
    let matchedWorkspace: RtCommunityWorkspace | undefined;
    let matchedMember: WargaMember | undefined;

    for (const ws of allWorkspaces) {
      const m = ws.members.find(x => (x.claimCode || '').toUpperCase() === normalizedCode);
      if (m) {
        matchedWorkspace = ws;
        matchedMember = m;
        break;
      }
    }

    if (!matchedWorkspace || !matchedMember) {
      return {
        ok: false,
        message: 'Kode Klaim tidak ditemukan di komunitas Anda. Gunakan Link Undangan (?rt=...) dari pengurus.',
      };
    }

    const memberPhoneDigits = matchedMember.phone.replace(/\D/g, '');
    if (memberPhoneDigits.length >= 4) {
      const expectedLast4 = memberPhoneDigits.slice(-4);
      if (normalizedDigits !== expectedLast4) {
        return {
          ok: false,
          message: '4 digit terakhir No HP tidak cocok dengan data yang didaftarkan pengurus.',
        };
      }
    }

    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const nextWorkspaces = allWorkspaces.map(ws => {
      if (ws.id !== matchedWorkspace!.id) return ws;
      return {
        ...ws,
        members: ws.members.map(m => ({
          ...m,
          isCurrentUser: m.id === matchedMember!.id,
          claimStatus: m.id === matchedMember!.id ? ('claimed' as const) : m.claimStatus,
          claimedAt: m.id === matchedMember!.id ? todayLabel : m.claimedAt,
        })),
      };
    });

    saveScopedWorkspaces(nextWorkspaces, matchedWorkspace.id);
    const updatedWs = nextWorkspaces.find(w => w.id === matchedWorkspace!.id);
    const claimedMember = updatedWs?.members.find(m => m.id === matchedMember!.id);
    return {
      ok: true,
      message: `Selamat datang ${matchedMember.name} (${matchedMember.block})! Profil berhasil diklaim.`,
      member: claimedMember,
    };
  },

  claimOfficerAccount(
    officerIdOrCode: string,
    verifyInput: string
  ): { ok: boolean; message: string; officer?: RtOfficerAccount } {
    const active = this.getActiveCommunity();
    if (!active) {
      return { ok: false, message: 'Belum ada komunitas aktif.' };
    }
    const cleanTarget = officerIdOrCode.trim().toLowerCase();
    const cleanVerify = verifyInput.trim();
    const cleanVerifyDigits = cleanVerify.replace(/\D/g, '');
    const officers = this.getOfficers(active);
    const target = officers.find(
      o =>
        o.id.toLowerCase() === cleanTarget ||
        (o.claimCode || '').toLowerCase() === cleanTarget
    );
    if (!target) {
      return { ok: false, message: 'Nama / kode klaim pengurus tidak ditemukan.' };
    }

    const phoneDigits = (target.phone || '').replace(/\D/g, '');
    const last4 = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : '';
    const pinOk = Boolean(active.profile.pengurusPin && cleanVerify === active.profile.pengurusPin);
    const last4Ok = Boolean(last4 && cleanVerifyDigits === last4);
    const { acc, email } = getCurrentAccountScope();
    const emailOk = Boolean(
      email && target.email && target.email.trim().toLowerCase() === email
    );

    if (!pinOk && !last4Ok && !emailOk && (last4 || active.profile.pengurusPin)) {
      return {
        ok: false,
        message: last4
          ? 'Verifikasi tidak cocok. Masukkan 4 digit terakhir No HP pengurus atau PIN komunitas.'
          : 'PIN pengurus tidak cocok.',
      };
    }

    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const nextOfficers = officers.map(o => {
      if (o.id !== target.id) return o;
      return {
        ...o,
        email: email || o.email,
        phone: acc?.phone?.trim() || o.phone,
        claimStatus: 'claimed' as const,
        claimedAt: todayLabel,
      };
    });
    const nextCoordinators: CoordinatorMember[] = nextOfficers.map(o => ({
      id: o.id,
      role: o.role,
      division: o.division,
      name: o.name,
      phone: o.phone,
      canVerifySiaga: o.canVerifySiaga,
    }));

    updateActiveWorkspace(ws => ({
      ...ws,
      officers: nextOfficers,
      coordinators: nextCoordinators,
    }));

    const claimed = nextOfficers.find(o => o.id === target.id);
    return {
      ok: true,
      message: `Jabatan "${target.role}" (${target.name}) berhasil diklaim ke akun Anda!`,
      officer: claimed,
    };
  },

  // --- Full Smart Import (Create Community OR Populate Active Community) ---
  applyFullSmartCommunityImport(params: {
    targetMode: 'create_new' | 'merge_active' | 'replace_active';
    creatorKind: 'pengurus' | 'warga_perintis';
    creatorName: string;
    creatorBlock: string;
    creatorPhone: string;
    creatorRole?: string;
    pengurusPin?: string;
    draft: {
      profile: {
        orgType: OrgType;
        customBrandName?: string;
        orgName: string;
        areaName: string;
        monthlyDuesAmount: number;
        year: number;
        openingBalance: number;
        openingBalanceNote: string;
      };
      officers: Array<{
        name: string;
        role: string;
        division: string;
        phone: string;
        email: string;
      }>;
      members: Array<{
        name: string;
        block: string;
        phone: string;
        residentType: 'Tetap' | 'Kontrak';
        paidMonthsCount: number;
        paidMonths?: number[];
        priorArrears?: number;
        priorArrearsNote?: string;
      }>;
      transactions: Array<{
        date: string;
        type: 'masuk' | 'keluar';
        category: KasCategory;
        title: string;
        amount: number;
        recordedBy: string;
      }>;
      archives?: Array<{
        year: number;
        totalIncome: number;
        totalExpense: number;
        endingBalance: number;
        note: string;
      }>;
    };
  }): RtCommunityWorkspace {
    const { acc, email } = getCurrentAccountScope();
    const d = params.draft;
    const cleanOrg = d.profile.orgName.trim() || 'Komunitas Baru';
    const year = d.profile.year || new Date().getFullYear();
    const monthlyAmount = Math.max(0, Math.round(d.profile.monthlyDuesAmount || 0));
    const breakdown = {
      keamanan: Math.round(monthlyAmount * 0.5),
      sampah: Math.round(monthlyAmount * 0.3),
      kas: Math.max(0, monthlyAmount - Math.round(monthlyAmount * 0.5) - Math.round(monthlyAmount * 0.3)),
    };

    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultEnd = new Date();
    defaultEnd.setFullYear(defaultEnd.getFullYear() + 3);
    const termEndIso = defaultEnd.toISOString().slice(0, 10);
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const prefixTag = cleanOrg.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'WQ';
    const creatorName =
      params.creatorName.trim() || (acc ? AuthService.getDisplayName(acc) : 'Perintis Warga');
    const creatorPhone = params.creatorPhone.trim() || acc?.phone || '-';
    const creatorBlock = params.creatorBlock.trim() || 'Warga';

    // Build Officers list (ready for claim!)
    const stamp = Date.now();
    const mappedOfficers: RtOfficerAccount[] = (d.officers || [])
      .filter(o => o.name.trim())
      .map((o, idx) => {
        const cleanOfficerName = o.name.trim();
        const isCreatorOfficer =
          params.creatorKind === 'pengurus' &&
          (cleanOfficerName.toLowerCase() === creatorName.toLowerCase() ||
            (email && o.email.trim().toLowerCase() === email));
        const phoneStr = o.phone?.trim() || (isCreatorOfficer ? creatorPhone : '-');
        const phoneLast4 = phoneStr.replace(/\D/g, '').slice(-4) || String(1000 + idx);
        return {
          id: `off-imp-${stamp}-${idx + 1}`,
          name: cleanOfficerName,
          role: o.role.trim() || 'Pengurus',
          division: o.division?.trim() || 'Pengurus Inti',
          email: isCreatorOfficer ? email || o.email.trim().toLowerCase() : o.email.trim().toLowerCase(),
          phone: phoneStr,
          canVerifySiaga: true,
          appointedAt: todayIso,
          claimCode: `PGR-${prefixTag}-${String(idx + 1).padStart(2, '0')}-${phoneLast4}`,
          claimStatus: isCreatorOfficer ? ('claimed' as const) : ('unclaimed' as const),
          claimedAt: isCreatorOfficer ? todayLabel : undefined,
        };
      });

    if (params.creatorKind === 'pengurus' && !mappedOfficers.some(o => email && o.email === email)) {
      const roleLabel =
        params.creatorRole?.trim() ||
        (d.profile.orgType === 'Paguyuban'
          ? 'Ketua Paguyuban'
          : d.profile.orgType === 'Sosial'
          ? 'Ketua Yayasan / DKM'
          : d.profile.orgType === 'Organisasi'
          ? 'Ketua Organisasi'
          : 'Ketua RT');
      const phoneLast4 = creatorPhone.replace(/\D/g, '').slice(-4) || '0001';
      mappedOfficers.unshift({
        id: `off-imp-${stamp}-creator`,
        name: creatorName,
        role: roleLabel,
        division: 'Pimpinan & Pengesahan',
        email: email || '',
        phone: creatorPhone,
        canVerifySiaga: true,
        appointedAt: todayIso,
        claimCode: `PGR-${prefixTag}-00-${phoneLast4}`,
        claimStatus: 'claimed',
        claimedAt: todayLabel,
      });
    }

    const mappedCoordinators: CoordinatorMember[] = mappedOfficers.map(o => ({
      id: o.id,
      role: o.role,
      division: o.division,
      name: o.name,
      phone: o.phone,
      canVerifySiaga: o.canVerifySiaga,
    }));

    // Build Warga list + exact paid months
    const importedMembersList: WargaMember[] = (d.members || [])
      .filter(m => m.name.trim())
      .map((row, idx) => {
        const phoneClean = row.phone?.trim() || '-';
        const blockClean = row.block?.trim() || `Unit ${idx + 1}`;
        const isCreatorMatch =
          row.name.trim().toLowerCase() === creatorName.toLowerCase();
        return {
          id: `warga-imp-${stamp}-${idx}`,
          wargaId: `WQ-${year}-${String(idx + 1).padStart(3, '0')}`,
          name: row.name.trim(),
          block: blockClean,
          email: isCreatorMatch ? acc?.email : undefined,
          phone: isCreatorMatch && creatorPhone !== '-' ? creatorPhone : phoneClean,
          deviceId: isCreatorMatch ? acc?.deviceId : undefined,
          residentType: row.residentType === 'Kontrak' ? 'Kontrak' : 'Tetap',
          isCurrentUser: isCreatorMatch,
          claimStatus: isCreatorMatch ? ('claimed' as const) : ('unclaimed' as const),
          claimCode: this.generateClaimCode(cleanOrg, blockClean, phoneClean),
          claimedAt: isCreatorMatch ? todayLabel : undefined,
          priorArrears: Math.max(0, row.priorArrears || 0),
          priorArrearsNote: row.priorArrearsNote?.trim() || undefined,
          siagaStatus: isCreatorMatch ? 'active' : 'pending',
          siagaRequested: false,
          falseAlarmCount: 0,
          monthlyPayments: buildPaymentsFromMonths(
            row.paidMonths,
            row.paidMonthsCount,
            monthlyAmount,
            year
          ),
        };
      });

    if (!importedMembersList.some(m => m.isCurrentUser)) {
      importedMembersList.unshift({
        id: `warga-pioneer-${stamp}`,
        wargaId: `WQ-${prefixTag}-001`,
        name: creatorName,
        block: creatorBlock,
        email: acc?.email,
        phone: creatorPhone,
        deviceId: acc?.deviceId,
        residentType: 'Tetap',
        isCurrentUser: true,
        claimStatus: 'claimed',
        claimCode: this.generateClaimCode(cleanOrg, creatorBlock, creatorPhone),
        claimedAt: todayLabel,
        siagaStatus: 'active',
        siagaVerifiedBy:
          params.creatorKind === 'pengurus' ? 'Pengurus Pendiri' : 'Perintis Ruang Warga',
        siagaVerifiedAt: todayLabel,
        falseAlarmCount: 0,
        monthlyPayments: buildInitialPayments(0, monthlyAmount),
      });
    }

    // Build Transactions (Pemasukan & Pengeluaran + Saldo Awal)
    const importedTxs: KasTransaction[] = (d.transactions || [])
      .filter(t => t.title.trim() && t.amount > 0)
      .map((t, idx) => ({
        id: `kas-imp-${stamp}-${idx}`,
        type: t.type === 'keluar' ? 'keluar' : 'masuk',
        category: t.category || (t.type === 'keluar' ? 'Perbaikan Fasilitas' : 'Iuran Warga'),
        title: t.title.trim(),
        amount: Math.round(t.amount),
        date: t.date?.trim() || todayLabel,
        recordedBy: t.recordedBy?.trim() || 'Smart Import Dokumen',
      }));

    if (d.profile.openingBalance > 0) {
      importedTxs.push({
        id: `kas-open-${stamp}`,
        type: 'masuk',
        category: 'Donasi / Kas',
        title: d.profile.openingBalanceNote?.trim() || `Saldo Awal Buku ${year}`,
        amount: Math.round(d.profile.openingBalance),
        date: `01 Jan ${year}`,
        recordedBy: 'Saldo Awal (Smart Import)',
      });
    }

    const importedArchives: HistoricalArchiveYear[] = (d.archives || []).map((a, idx) => ({
      id: `arc-imp-${a.year}-${idx}`,
      year: a.year,
      totalIncome: Math.max(0, Math.round(a.totalIncome || 0)),
      totalExpense: Math.max(0, Math.round(a.totalExpense || 0)),
      endingBalance: Math.max(0, Math.round(a.endingBalance || 0)),
      note: a.note?.trim() || `Rekap impor tahun ${a.year}`,
      source: 'Impor Excel',
    }));

    if (params.targetMode !== 'create_new') {
      const existing = this.getActiveCommunity();
      if (existing) {
        const isReplace = params.targetMode === 'replace_active';
        const nextMembers = isReplace
          ? importedMembersList
          : (() => {
              const keys = new Set(
                existing.members.map(m => `${m.name.toLowerCase()}::${m.block.toLowerCase()}`)
              );
              const extras = importedMembersList.filter(
                m => !m.isCurrentUser && !keys.has(`${m.name.toLowerCase()}::${m.block.toLowerCase()}`)
              );
              return [...existing.members, ...extras];
            })();
        const nextOfficers = isReplace
          ? mappedOfficers
          : (() => {
              const cur = this.getOfficers(existing);
              const keys = new Set(cur.map(o => `${o.name.toLowerCase()}::${o.role.toLowerCase()}`));
              const extras = mappedOfficers.filter(
                o => !keys.has(`${o.name.toLowerCase()}::${o.role.toLowerCase()}`)
              );
              return [...cur, ...extras];
            })();
        const nextCoords: CoordinatorMember[] = nextOfficers.map(o => ({
          id: o.id,
          role: o.role,
          division: o.division,
          name: o.name,
          phone: o.phone,
          canVerifySiaga: o.canVerifySiaga,
        }));
        const nextTxs = isReplace ? importedTxs : [...importedTxs, ...(existing.transactions || [])];
        const nextArchives = isReplace
          ? importedArchives
          : (() => {
              const map = new Map<number, HistoricalArchiveYear>();
              (existing.archives || []).forEach(a => map.set(a.year, a));
              importedArchives.forEach(a => map.set(a.year, a));
              return Array.from(map.values());
            })();

        const updatedWs: RtCommunityWorkspace = {
          ...existing,
          profile: {
            ...existing.profile,
            orgType: d.profile.orgType || existing.profile.orgType,
            customBrandName: d.profile.customBrandName?.trim() || existing.profile.customBrandName,
            orgName: d.profile.orgName.trim() || existing.profile.orgName,
            areaName: d.profile.areaName.trim() || existing.profile.areaName,
            monthlyDuesAmount: monthlyAmount || existing.profile.monthlyDuesAmount,
            year,
          },
          officers: nextOfficers,
          coordinators: nextCoords,
          members: nextMembers,
          transactions: nextTxs,
          archives: nextArchives,
        };
        const list = loadScopedWorkspaces();
        saveScopedWorkspaces(
          list.map(w => (w.id === existing.id ? updatedWs : w)),
          updatedWs.id
        );
        return updatedWs;
      }
    }

    // Create brand-new community from Smart Import
    const commId = `comm_${stamp}_${Math.random().toString(36).slice(2, 6)}`;
    const inviteCode = `WQR-${prefixTag}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const welcomePost: ForumPost = {
      id: `post-smart-${stamp}`,
      category: 'info',
      title: `Data ${cleanOrg} Berhasil Diimpor (${importedMembersList.length} Warga & ${importedTxs.length} Kas)`,
      content: `Ruang ${cleanOrg} (${d.profile.areaName.trim() || 'Lingkungan Warga'}) disiapkan oleh ${creatorName} (${params.creatorKind === 'pengurus' ? 'Pengurus' : 'Warga Perintis'}) via Smart Import. Pengurus & warga silakan buka menu Klaim Akun / Profil untuk menghubungkan nama masing-masing.`,
      authorName: creatorName,
      authorRole: params.creatorKind === 'pengurus' ? 'Pengurus Pendiri' : 'Warga Perintis',
      createdAt: 'Baru saja',
      upvoterIds: [],
      comments: [],
    };

    const newWorkspace: RtCommunityWorkspace = {
      id: commId,
      joinedVia: 'created',
      joinedAt: new Date().toISOString(),
      profile: {
        id: commId,
        orgType: d.profile.orgType,
        customBrandName: d.profile.customBrandName?.trim() || undefined,
        orgName: cleanOrg,
        areaName: d.profile.areaName.trim() || 'Lingkungan Warga',
        monthlyDuesAmount: monthlyAmount,
        duesBreakdown: breakdown,
        year,
        pengurusPin: params.pengurusPin?.trim() || '1234',
        inviteCode,
        creatorName,
        createdAt: todayLabel,
        termStartDate: todayIso,
        termEndDate: termEndIso,
        gracePeriodDays: 14,
        skNumber: '',
      },
      coordinators: mappedCoordinators,
      officers: mappedOfficers,
      members: importedMembersList,
      transactions: importedTxs,
      auditLogs: [],
      forumPosts: [welcomePost],
      guestReports: [],
      archives: importedArchives,
      invitations: [],
      handovers: [],
      governanceActions: [],
    };

    const current = loadScopedWorkspaces();
    saveScopedWorkspaces([newWorkspace, ...current], newWorkspace.id);
    return newWorkspace;
  },

  // --- Smart Excel Import & Lembaran Baru ---
  applySmartExcelImport(params: {
    mode: 'merge' | 'fresh_2026';
    openingBalance?: number;
    openingBalanceNote?: string;
    importedMembers: Array<{
      name: string;
      block: string;
      phone: string;
      residentType: 'Tetap' | 'Kontrak';
      paidMonthsCount: number;
      priorArrears?: number;
      priorArrearsNote?: string;
    }>;
    importedArchives?: Array<{
      year: number;
      totalIncome: number;
      totalExpense: number;
      endingBalance: number;
      note: string;
    }>;
  }) {
    const profile = this.getProfile();
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const existingMembers = this.getMembers();
    const currentActive = existingMembers.find(m => m.isCurrentUser) || existingMembers[0];

    const newMembers: WargaMember[] = params.importedMembers.map((row, idx) => {
      const seq = existingMembers.length + idx + 1;
      const phoneClean = row.phone.trim() || '-';
      return {
        id: `warga-xls-${Date.now()}-${idx}`,
        wargaId: `WQ-${profile.year}-${String(seq).padStart(3, '0')}`,
        name: row.name.trim(),
        block: row.block.trim() || `Unit ${seq}`,
        phone: phoneClean,
        residentType: row.residentType,
        isCurrentUser: false,
        claimStatus: 'unclaimed',
        claimCode: this.generateClaimCode(profile.orgName, row.block || String(seq), phoneClean),
        priorArrears: row.priorArrears || 0,
        priorArrearsNote: row.priorArrearsNote,
        siagaStatus: 'pending',
        siagaRequested: false,
        falseAlarmCount: 0,
        monthlyPayments: buildInitialPayments(
          Math.max(0, Math.min(12, row.paidMonthsCount || 0)),
          profile.monthlyDuesAmount
        ),
      };
    });

    if (params.mode === 'fresh_2026' && currentActive) {
      const keptCurrent: WargaMember = {
        ...currentActive,
        isCurrentUser: true,
        claimStatus: 'claimed',
        monthlyPayments: buildInitialPayments(0, profile.monthlyDuesAmount),
      };
      this.saveMembers([keptCurrent, ...newMembers]);

      const openingTx: KasTransaction = {
        id: `kas-open-${Date.now()}`,
        type: 'masuk',
        category: 'Donasi / Kas',
        title: params.openingBalanceNote?.trim() || `Saldo Awal Lembaran Baru ${profile.year}`,
        amount: Math.max(0, params.openingBalance || 0),
        date: todayLabel,
        recordedBy: 'Tutup Buku / Impor Excel',
      };
      this.saveTransactions(openingTx.amount > 0 ? [openingTx] : []);
    } else {
      const existingKeys = new Set(
        existingMembers.map(m => `${m.name.toLowerCase()}::${m.block.toLowerCase()}`)
      );
      const uniqueNew = newMembers.filter(
        m => !existingKeys.has(`${m.name.toLowerCase()}::${m.block.toLowerCase()}`)
      );
      this.saveMembers([...existingMembers, ...uniqueNew]);

      if (params.openingBalance && params.openingBalance > 0) {
        const tx: KasTransaction = {
          id: `kas-imp-${Date.now()}`,
          type: 'masuk',
          category: 'Donasi / Kas',
          title: params.openingBalanceNote?.trim() || 'Penyesuaian Saldo dari Impor Excel',
          amount: params.openingBalance,
          date: todayLabel,
          recordedBy: 'Impor Excel Pengurus',
        };
        this.saveTransactions([tx, ...this.getTransactions()]);
      }
    }

    if (params.importedArchives && params.importedArchives.length > 0) {
      const currentArchives = params.mode === 'fresh_2026' ? [] : this.getArchives();
      const mapByYear = new Map<number, HistoricalArchiveYear>();
      currentArchives.forEach(a => mapByYear.set(a.year, a));
      params.importedArchives.forEach(a => {
        mapByYear.set(a.year, {
          id: `arc-xls-${a.year}`,
          year: a.year,
          totalIncome: a.totalIncome,
          totalExpense: a.totalExpense,
          endingBalance: a.endingBalance,
          note: a.note || `Rekap impor Excel tahun ${a.year}`,
          source: 'Impor Excel',
        });
      });
      this.saveArchives(Array.from(mapByYear.values()));
    }
  },

  startFreshYear2026(openingBalance: number, note: string) {
    const profile = this.getProfile();
    const todayLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const resetMembers = this.getMembers().map(m => ({
      ...m,
      monthlyPayments: buildInitialPayments(0, profile.monthlyDuesAmount),
    }));
    this.saveMembers(resetMembers);

    const txs: KasTransaction[] =
      openingBalance > 0
        ? [
            {
              id: `kas-fresh-${Date.now()}`,
              type: 'masuk',
              category: 'Donasi / Kas',
              title: note.trim() || `Saldo Awal Pindahan ke Lembaran Baru ${profile.year}`,
              amount: openingBalance,
              date: todayLabel,
              recordedBy: 'Pengurus (Tutup Buku)',
            },
          ]
        : [];
    this.saveTransactions(txs);
  },

  // --- Governance: Tenure Health, Multi-Officer (>2), Quorum & Sertijab ---
  getTermHealth(profile: PaguyubanProfile, nowMs = Date.now()): RtTermHealth {
    const defaultStart = `${profile.year || new Date().getFullYear()}-01-01`;
    const defaultEnd = `${(profile.year || new Date().getFullYear()) + 2}-12-31`;
    const termStartDate = profile.termStartDate || defaultStart;
    const termEndDate = profile.termEndDate || defaultEnd;
    const gracePeriodDays =
      typeof profile.gracePeriodDays === 'number' ? Math.max(0, profile.gracePeriodDays) : 14;

    const endTs = new Date(`${termEndDate}T23:59:59`).getTime();
    const safeEndTs = Number.isFinite(endTs) ? endTs : nowMs + 365 * 86400000;
    const graceEndTs = safeEndTs + gracePeriodDays * 86400000;

    const dayMs = 86400000;
    const daysRemaining = Math.ceil((safeEndTs - nowMs) / dayMs);
    const graceDaysRemaining = Math.max(0, Math.ceil((graceEndTs - nowMs) / dayMs));
    const periodLabel = `${termStartDate.slice(0, 4)}–${termEndDate.slice(0, 4)}`;

    if (nowMs > graceEndTs) {
      return {
        status: 'expired',
        daysRemaining,
        graceDaysRemaining: 0,
        termStartDate,
        termEndDate,
        gracePeriodDays,
        periodLabel,
        isReadOnlyLocked: true,
        isSertijabOnly: false,
        headline: 'Masa Bakti Berakhir · Terkunci Read-Only',
        detail: `Masa bakti ${periodLabel} & masa tenggang ${gracePeriodDays} hari telah lewat. Segera lakukan Serah Terima Jabatan (Sertijab) atau Pemulihan Kolektif.`,
      };
    }

    if (nowMs > safeEndTs) {
      return {
        status: 'grace',
        daysRemaining,
        graceDaysRemaining,
        termStartDate,
        termEndDate,
        gracePeriodDays,
        periodLabel,
        isReadOnlyLocked: true,
        isSertijabOnly: true,
        headline: `Masa Demisioner · Sisa Tenggang Sertijab ${graceDaysRemaining} Hari`,
        detail: `Periode ${periodLabel} berakhir pada ${termEndDate}. Input kas rutin dikunci otomatis—silakan selesaikan pemilihan & Sertijab pengurus baru.`,
      };
    }

    if (daysRemaining <= 30) {
      return {
        status: 'warning_30',
        daysRemaining,
        graceDaysRemaining,
        termStartDate,
        termEndDate,
        gracePeriodDays,
        periodLabel,
        isReadOnlyLocked: false,
        isSertijabOnly: false,
        headline: `Pemilihan Pengurus Baru · Sisa ${daysRemaining} Hari`,
        detail: `Masa jabatan berakhir ${termEndDate}. Segera jadwalkan musyawarah pemilihan, tutup buku kas, dan siapkan Berita Acara Sertijab.`,
      };
    }

    if (daysRemaining <= 90) {
      return {
        status: 'warning_90',
        daysRemaining,
        graceDaysRemaining,
        termStartDate,
        termEndDate,
        gracePeriodDays,
        periodLabel,
        isReadOnlyLocked: false,
        isSertijabOnly: false,
        headline: `Menjelang Akhir Masa Bakti (${daysRemaining} Hari Lagi)`,
        detail: `Periode ${periodLabel} berakhir ${termEndDate}. Mulai siapkan panitia pemilihan & undangan rapat warga.`,
      };
    }

    return {
      status: 'active',
      daysRemaining,
      graceDaysRemaining,
      termStartDate,
      termEndDate,
      gracePeriodDays,
      periodLabel,
      isReadOnlyLocked: false,
      isSertijabOnly: false,
      headline: `Masa Bakti Aktif · ${periodLabel}`,
      detail: `Berlaku hingga ${termEndDate} (${daysRemaining} hari tersisa).`,
    };
  },

  getOfficers(ws?: RtCommunityWorkspace | null): RtOfficerAccount[] {
    const target = ws ?? this.getActiveCommunity();
    if (!target) return [];
    if (target.officers && target.officers.length > 0) {
      return target.officers;
    }
    // Derive fallback from legacy coordinators without fabricating fake emails
    return (target.coordinators || []).map((c, idx) => ({
      id: c.id || `off-legacy-${idx}`,
      name: c.name,
      role: c.role,
      division: c.division,
      email:
        idx === 0
          ? AuthService.getAccount()?.email?.toLowerCase() || ''
          : '',
      phone: c.phone,
      canVerifySiaga: c.canVerifySiaga,
      appointedAt: target.profile.termStartDate || '2024-01-01',
    }));
  },

  isCurrentUserOfficer(ws?: RtCommunityWorkspace | null): boolean {
    const { email } = getCurrentAccountScope();
    if (!email) return false;
    const officers = this.getOfficers(ws);
    return officers.some(o => o.email.trim().toLowerCase() === email);
  },

  getHandovers(): RtHandoverRecord[] {
    return this.getActiveCommunity()?.handovers || [];
  },

  getGovernanceActions(): RtGovernanceAction[] {
    return this.getActiveCommunity()?.governanceActions || [];
  },

  saveOfficersDirectSetup(officers: RtOfficerAccount[]) {
    const coordinators: CoordinatorMember[] = officers.map(o => ({
      id: o.id,
      role: o.role,
      division: o.division,
      name: o.name,
      phone: o.phone,
      canVerifySiaga: o.canVerifySiaga,
    }));
    updateActiveWorkspace(ws => ({
      ...ws,
      officers,
      coordinators,
    }));
  },

  upsertLocalGovernanceAction(communityId: string, action: RtGovernanceAction) {
    const list = loadScopedWorkspaces();
    const nextList = list.map(ws => {
      if (ws.id !== communityId) return ws;
      const prev = ws.governanceActions || [];
      const exists = prev.some(a => a.id === action.id);
      const nextActions = exists
        ? prev.map(a => (a.id === action.id ? action : a))
        : [action, ...prev];
      return {
        ...ws,
        governanceActions: nextActions.slice(0, 20),
      };
    });
    saveScopedWorkspaces(nextList);
  },

  applyGovernanceExecution(
    communityId: string,
    params: {
      officers: RtOfficerAccount[];
      termStartDate: string;
      termEndDate: string;
      gracePeriodDays: number;
      skNumber: string;
      actionId: string;
      handover?: RtHandoverRecord;
    }
  ) {
    const list = loadScopedWorkspaces();
    const coordinators: CoordinatorMember[] = params.officers.map(o => ({
      id: o.id,
      role: o.role,
      division: o.division,
      name: o.name,
      phone: o.phone,
      canVerifySiaga: o.canVerifySiaga,
    }));

    const nextList = list.map(ws => {
      if (ws.id !== communityId) return ws;
      const nextHandovers = params.handover
        ? [params.handover, ...(ws.handovers || [])].slice(0, 20)
        : ws.handovers || [];
      const nextActions = (ws.governanceActions || []).map(a =>
        a.id === params.actionId ? { ...a, status: 'executed' as const } : a
      );

      // Lock previous period kas into archives on Sertijab handover
      let nextArchives = ws.archives || [];
      if (params.handover) {
        const masuk = (ws.transactions || [])
          .filter(t => t.type === 'masuk')
          .reduce((s, t) => s + t.amount, 0);
        const keluar = (ws.transactions || [])
          .filter(t => t.type === 'keluar')
          .reduce((s, t) => s + t.amount, 0);
        const lockYear = parseInt(params.handover.periodLabel.slice(-4), 10) || ws.profile.year;
        const lockEntry: HistoricalArchiveYear = {
          id: `arc-sertijab-${params.handover.id}`,
          year: lockYear,
          totalIncome: masuk,
          totalExpense: keluar,
          endingBalance: params.handover.closingBalance,
          note: `[Terkunci Sertijab ${params.handover.handoverDate}] ${params.handover.note}`,
          source: 'Manual',
        };
        nextArchives = [lockEntry, ...nextArchives.filter(a => a.id !== lockEntry.id)];
      }

      return {
        ...ws,
        profile: {
          ...ws.profile,
          termStartDate: params.termStartDate,
          termEndDate: params.termEndDate,
          gracePeriodDays: params.gracePeriodDays,
          skNumber: params.skNumber,
        },
        officers: params.officers,
        coordinators,
        handovers: nextHandovers,
        governanceActions: nextActions,
        archives: nextArchives,
        lastGovernanceActionId: params.actionId,
      };
    });
    saveScopedWorkspaces(nextList);
  },

  mergeCloudCommunityRecord(cloudData: {
    communityId: string;
    orgType: OrgType;
    customBrandName?: string;
    orgName: string;
    areaName: string;
    monthlyDuesAmount: number;
    year: number;
    inviteCode: string;
    termStartDate: string;
    termEndDate: string;
    gracePeriodDays: number;
    skNumber: string;
    officers: RtOfficerAccount[];
    recentTransactions?: KasTransaction[];
    handoverHistory?: RtHandoverRecord[];
    governanceActions?: RtGovernanceAction[];
    lastGovernanceActionId?: string;
    cloudSyncedAt: string;
  }) {
    const list = loadScopedWorkspaces();
    const idx = list.findIndex(w => w.id === cloudData.communityId);
    const coordinators: CoordinatorMember[] = (cloudData.officers || []).map(o => ({
      id: o.id,
      role: o.role,
      division: o.division,
      name: o.name,
      phone: o.phone,
      canVerifySiaga: o.canVerifySiaga,
    }));

    if (idx === -1) {
      const { acc } = getCurrentAccountScope();
      const memberName = acc ? AuthService.getDisplayName(acc) : 'Pengurus';
      const selfMember: WargaMember = {
        id: `warga-cloud-${Date.now()}`,
        wargaId: `WQ-SRV-001`,
        name: memberName,
        block: 'Pengurus / Warga Terdaftar',
        email: acc?.email,
        phone: acc?.phone || '-',
        deviceId: acc?.deviceId,
        residentType: 'Tetap',
        isCurrentUser: true,
        claimStatus: 'claimed',
        siagaStatus: 'active',
        falseAlarmCount: 0,
        monthlyPayments: buildInitialPayments(0, cloudData.monthlyDuesAmount || 0),
      };

      const newWs: RtCommunityWorkspace = {
        id: cloudData.communityId,
        joinedVia: 'invited',
        invitedBy: 'Server Cloud RTQu',
        joinedAt: cloudData.cloudSyncedAt,
        profile: {
          id: cloudData.communityId,
          orgType: cloudData.orgType,
          customBrandName: cloudData.customBrandName || undefined,
          orgName: cloudData.orgName,
          areaName: cloudData.areaName,
          monthlyDuesAmount: cloudData.monthlyDuesAmount,
          duesBreakdown: {
            keamanan: Math.round((cloudData.monthlyDuesAmount || 0) * 0.5),
            sampah: Math.round((cloudData.monthlyDuesAmount || 0) * 0.3),
            kas: Math.max(
              0,
              (cloudData.monthlyDuesAmount || 0) -
                Math.round((cloudData.monthlyDuesAmount || 0) * 0.5) -
                Math.round((cloudData.monthlyDuesAmount || 0) * 0.3)
            ),
          },
          year: cloudData.year,
          pengurusPin: '0000',
          inviteCode: cloudData.inviteCode,
          termStartDate: cloudData.termStartDate,
          termEndDate: cloudData.termEndDate,
          gracePeriodDays: cloudData.gracePeriodDays,
          skNumber: cloudData.skNumber,
        },
        coordinators,
        officers: cloudData.officers,
        members: [selfMember],
        transactions: cloudData.recentTransactions || [],
        auditLogs: [],
        forumPosts: [],
        guestReports: [],
        archives: [],
        invitations: [],
        handovers: cloudData.handoverHistory || [],
        governanceActions: cloudData.governanceActions || [],
        lastGovernanceActionId: cloudData.lastGovernanceActionId,
        cloudSyncedAt: cloudData.cloudSyncedAt,
      };
      saveScopedWorkspaces([newWs, ...list]);
      return;
    }

    const existing = list[idx];
    // Merge transactions by ID preserving local + cloud
    const txMap = new Map<string, KasTransaction>();
    (cloudData.recentTransactions || []).forEach(t => txMap.set(t.id, t));
    (existing.transactions || []).forEach(t => {
      if (!txMap.has(t.id)) txMap.set(t.id, t);
    });

    const updatedWs: RtCommunityWorkspace = {
      ...existing,
      profile: {
        ...existing.profile,
        orgType: cloudData.orgType,
        customBrandName: cloudData.customBrandName || existing.profile.customBrandName,
        orgName: cloudData.orgName,
        areaName: cloudData.areaName,
        monthlyDuesAmount: cloudData.monthlyDuesAmount,
        year: cloudData.year,
        inviteCode: cloudData.inviteCode || existing.profile.inviteCode,
        termStartDate: cloudData.termStartDate,
        termEndDate: cloudData.termEndDate,
        gracePeriodDays: cloudData.gracePeriodDays,
        skNumber: cloudData.skNumber,
      },
      coordinators: coordinators.length > 0 ? coordinators : existing.coordinators,
      officers: cloudData.officers.length > 0 ? cloudData.officers : existing.officers,
      transactions: Array.from(txMap.values()),
      handovers:
        cloudData.handoverHistory && cloudData.handoverHistory.length > 0
          ? cloudData.handoverHistory
          : existing.handovers,
      governanceActions:
        cloudData.governanceActions !== undefined
          ? cloudData.governanceActions
          : existing.governanceActions,
      lastGovernanceActionId: cloudData.lastGovernanceActionId || existing.lastGovernanceActionId,
      cloudSyncedAt: cloudData.cloudSyncedAt,
    };
    const nextList = list.map((w, i) => (i === idx ? updatedWs : w));
    saveScopedWorkspaces(nextList);
  },
};
