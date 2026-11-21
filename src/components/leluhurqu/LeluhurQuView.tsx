import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Menu,
  Printer,
  Plus,
  Users,
  UserPlus,
  Trash2,
  Edit3,
  Eye,
  Download,
  Calendar,
  Sparkles,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  FolderPlus,
  Layers,
  Heart,
  Info,
  Zap,
  Table,
  FileSpreadsheet,
  Filter,
  Check,
  ListOrdered,
  RotateCcw,
  SlidersHorizontal,
  Move,
  Palette,
  Sun,
  FileText,
  Camera,
  Upload,
  Image,
  RefreshCw,
  AlertCircle,
  Share2,
  MessageCircle,
  Link2,
  Copy,
  Send,
  Mail,
  UserCheck,
  HeartHandshake,
  QrCode,
  ThumbsUp,
  MessageSquareText,
  SmilePlus,
  ImagePlus,
  Globe,
  Lock,
  Bookmark,
  Compass,
  Settings,
  BookOpen,
  History,
  HelpCircle,
  ScanLine,
  Trophy,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { ModuleOnboardingService } from '../../services/moduleOnboardingService';
import { InteractiveGridCanvasView } from './InteractiveGridCanvasView';
import { LeluhurQuizView } from './LeluhurQuizView';
import { loadQuizRounds, isAlertHandledForRound } from '../../services/leluhurQuiz/quizStorageAndSync';
import { getRoundTimingSnapshot } from '../../services/leluhurQuiz/quizSchedulerService';
import {
  LeluhurSettingsView,
  LeluhurAccountProfile,
  LeluhurAppPreferences,
  SettingsSectionTab,
} from './LeluhurSettingsView';
import { AUTH_SYNC_EVENT, AuthService } from '../../services/authService';
import {
  DEVICE_PAIRING_SYNC_EVENT,
  PairingSyncEventDetail,
} from '../../services/devicePairingService';
import { LeluhurBookModal } from './LeluhurBookModal';
import { TrahQrCodeCard, TrahQrScannerModal } from './TrahInviteQrModal';
import { NuclearFamilyHubModal } from './NuclearFamilyHubModal';
import { MonetizationService } from '../../services/monetizationService';
import { ModularFeeSheet } from '../monetization/ModularFeeSheet';
import {
  canonicalInviteSlug,
  getCustomPublicBaseUrl,
  getSyncChannelName,
  InviteRelayService,
  isPrivateDevHost,
  parseInviteInput,
  REALTIME_RELAY_EVENT_NAME,
  RELAY_REGISTER_CHANNELS_EVENT,
  setCustomPublicBaseUrl,
} from '../../services/inviteRelayService';
import {
  applyMemberEditToHub,
  canDeleteTrahMember,
  canEditTrahMember,
  canManageTrahAdmin,
  FamilyMember,
  formatInviteExpiryLabel,
  getEffectiveTrahRole,
  getLineageBadgeMeta,
  getTrahCoreLinkStatus,
  getTrahRoleMeta,
  graftNuclearFamilyToTrah,
  INVITE_EXPIRY_OPTIONS,
  LINEAGE_OPTIONS,
  LineageSide,
  loadNuclearFamilyHub,
  loadRevokedInviteVersions,
  markInviteVersionRevoked,
  NuclearFamilyHubData,
  saveNuclearFamilyHub,
  SpouseInfo,
  syncHubAcrossTrahList,
  TrahAccessRole,
  TrahCategory,
  TrahInvitePolicy,
} from '../../services/leluhurCoreSyncService';
import {
  applyProposalOpsToTrah,
  formatSyncTimestamp,
  LELUHUR_SYNC_EVENT,
  LeluhurChangeProposal,
  LeluhurProposalActionType,
  LeluhurProposalOp,
  LeluhurVersionSyncService,
  loadProposalsForScope,
  saveProposalsForScope,
  TrahSyncCheckResult,
} from '../../services/leluhurVersionSyncService';

export type {
  SpouseInfo,
  FamilyMember,
  LineageSide,
  TrahAccessRole,
  TrahInvitePolicy,
  TrahCategory,
};

export type LeluhurLogActionType =
  | 'claim'
  | 'unclaim'
  | 'invite_join'
  | 'invite_share'
  | 'trah_create'
  | 'trah_update'
  | 'trah_delete'
  | 'member_add'
  | 'member_update'
  | 'member_delete'
  | 'backup';

export interface LeluhurActivityLog {
  id: string;
  trahId: string;
  trahName: string;
  actionType: LeluhurLogActionType;
  actorName: string;
  actorEmail?: string;
  targetName?: string;
  summary: string;
  details?: string;
  createdAt: string;
}

export interface TrahComment {
  id: string;
  authorName: string;
  authorAvatar?: string;
  authorKinship?: string;
  text: string;
  timestamp: string;
}

export interface TrahPost {
  id: string;
  trahId: string;
  trahName?: string;
  lineageSide: LineageSide;
  authorName: string;
  authorKinship: string;
  authorAvatar?: string;
  content: string;
  imageUrl?: string;
  category: 'kabar_gembira' | 'silaturahmi' | 'sejarah' | 'lelayu';
  likesCount: number;
  likedByMe: boolean;
  comments: TrahComment[];
  timestamp: string;
  isPinned?: boolean;
}

export type PhotoShape = 'circle' | 'square' | 'hexagon';

interface LeluhurQuViewProps {
  onBackToWarga: () => void;
  showNotification: (msg: string) => void;
  onOpenChatQu?: () => void;
}

// Kunci penyimpanan localStorage per-akun agar privasi tiap akun terpisah (user baru tidak melihat data contoh/akun lain)
const STORAGE_KEYS = [
  'wargaqu_leluhur_trah_v4',
  'wargaqu_leluhur_trah_v3',
  'wargaqu_leluhur_trah_v2',
  'wargaqu_leluhur_trah'
];
const ACTIVE_STORAGE_KEY = 'wargaqu_leluhur_trah_v4';
const TRAH_POSTS_STORAGE_KEY = 'wargaqu_leluhur_posts_v1';
const PENDING_INVITE_KEY = 'wargaqu_pending_trah_invite_v1';
const CARRYOVER_INVITE_KEY = 'wargaqu_carryover_trah_invite_v1';
const OWNER_EMAILS = ['usahaqu2026@gmail.com', 'usahaqu26@gmail.com'];

const PHOTO_SHAPE_KEY = 'wargaqu_leluhur_photo_shape';
const ACCOUNT_PROFILE_KEY = 'wargaqu_leluhur_account_v1';
const APP_PREFS_KEY = 'wargaqu_leluhur_prefs_v1';

const EMPTY_TRAH_PLACEHOLDER: TrahCategory = {
  id: '__empty__',
  name: 'Belum Ada Trah',
  description: 'Buat Trah baru atau gabung lewat undangan keluarga',
  lineageSide: 'umum',
  members: [],
};

function getCurrentAccountScope() {
  const acc = AuthService.getAccount();
  const email = (acc?.email || '').trim().toLowerCase();
  const scopeKey = email ? email.replace(/[^a-z0-9@._-]/g, '_') : 'guest';
  const isOwner = OWNER_EMAILS.includes(email);
  return { email, scopeKey, isOwner };
}

function getScopedTrahStorageKey(scopeKey: string): string {
  return `wargaqu_leluhur_trah_v5_${scopeKey}`;
}

function getScopedPostsStorageKey(scopeKey: string): string {
  return `wargaqu_leluhur_posts_v2_${scopeKey}`;
}

function getScopedLogsStorageKey(scopeKey: string): string {
  return `wargaqu_leluhur_logs_v1_${scopeKey}`;
}

function loadActivityLogsForScope(scopeKey: string): LeluhurActivityLog[] {
  try {
    const raw = localStorage.getItem(getScopedLogsStorageKey(scopeKey));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

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

type CompactMemberTuple = [
  string, // id
  string, // name
  'L' | 'P', // gender
  number, // parent index in array (-1 if root)
  number, // generationLevel
  number, // orderIndex
  number, // isDeceased (0/1)
  string?, // callName
  string?, // birthYear
  string?, // deathYear
  Array<[string, number]>? // spouses [name, statusIdx 0=menikah,1=cerai_hidup,2=cerai_mati]
];

const SPOUSE_STATUS_LIST: Array<'menikah' | 'cerai_hidup' | 'cerai_mati'> = [
  'menikah',
  'cerai_hidup',
  'cerai_mati',
];

function stripPhotosForInvite(members: FamilyMember[]): FamilyMember[] {
  return (members || []).map((m) => ({
    ...m,
    photoUrl: undefined,
  }));
}

interface CompactInviteMeta {
  r?: TrahAccessRole;
  exp?: number;
  v?: number;
  ce?: string;
  dv?: number;
}

type DecodedTrahInviteResult =
  | { status: 'ok'; trah: TrahCategory; inviter: string }
  | { status: 'expired' | 'revoked'; trahName?: string }
  | null;

function buildCompactInviteMeta(
  trah: TrahCategory,
  overridePolicy?: Partial<TrahInvitePolicy>,
  fallbackCreatorEmail?: string
): CompactInviteMeta {
  const role = overridePolicy?.role || trah.invitePolicy?.role || 'member';
  const expiryHours = overridePolicy?.expiryHours ?? trah.invitePolicy?.expiryHours ?? 0;
  const version = overridePolicy?.version || trah.invitePolicy?.version || 1;
  const exp = expiryHours > 0 ? Date.now() + expiryHours * 3600 * 1000 : 0;
  const creatorEmail = (trah.creatorEmail || fallbackCreatorEmail || '').trim().toLowerCase();
  const dataVersion = Math.max(1, trah.dataVersion || 1);
  return {
    r: role,
    exp,
    v: version,
    dv: dataVersion,
    ...(creatorEmail ? { ce: creatorEmail } : {}),
  };
}

function encodeTrahInviteToken(
  trah: TrahCategory,
  inviterName: string,
  overridePolicy?: Partial<TrahInvitePolicy>,
  fallbackCreatorEmail?: string
): string {
  const meta = buildCompactInviteMeta(trah, overridePolicy, fallbackCreatorEmail);
  const compactPayload = {
    v: 1,
    inviter: inviterName || 'Keluarga',
    meta,
    trah: {
      id: trah.id,
      name: trah.name,
      description: trah.description,
      lineageSide: trah.lineageSide || 'umum',
      members: stripPhotosForInvite(trah.members || []),
    },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(compactPayload));
  return `LQH1:${toBase64Url(bytes)}`;
}

async function encodeTrahInviteTokenCompact(
  trah: TrahCategory,
  inviterName: string,
  overridePolicy?: Partial<TrahInvitePolicy>,
  fallbackCreatorEmail?: string
): Promise<string> {
  const members = trah.members || [];
  const idxById = new Map<string, number>();
  members.forEach((m, i) => idxById.set(m.id, i));

  const tuples: CompactMemberTuple[] = members.map((m) => {
    const pIdx = m.parentId && idxById.has(m.parentId) ? idxById.get(m.parentId)! : -1;
    const spList =
      m.spouses && m.spouses.length > 0
        ? m.spouses.map((sp): [string, number] => [
            sp.name,
            Math.max(0, SPOUSE_STATUS_LIST.indexOf(sp.status)),
          ])
        : undefined;
    const tuple: CompactMemberTuple = [
      m.id,
      m.name,
      m.gender,
      pIdx,
      m.generationLevel ?? 0,
      m.orderIndex ?? 1,
      m.isDeceased ? 1 : 0,
    ];
    if (m.callName || m.birthYear || m.deathYear || spList) {
      tuple.push(m.callName || '');
      tuple.push(m.birthYear || '');
      tuple.push(m.deathYear || '');
      if (spList) tuple.push(spList);
    }
    return tuple;
  });

  const meta = buildCompactInviteMeta(trah, overridePolicy, fallbackCreatorEmail);
  const packed = [
    2,
    inviterName || 'Keluarga',
    trah.id,
    trah.name,
    trah.description || '',
    trah.lineageSide || 'umum',
    tuples,
    meta,
  ];
  const rawBytes = new TextEncoder().encode(JSON.stringify(packed));

  try {
    if (typeof CompressionStream !== 'undefined') {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(rawBytes);
      writer.close();
      const compressedBuf = await new Response(cs.readable).arrayBuffer();
      return `LQH2_${toBase64Url(new Uint8Array(compressedBuf))}`;
    }
  } catch {
    // fallback below
  }

  return encodeTrahInviteToken(trah, inviterName, overridePolicy, fallbackCreatorEmail);
}

function extractRawTokenFromInput(rawInput: string): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('t=') || trimmed.includes('trah=') || trimmed.includes('trahInvite=')) {
    try {
      const qIdx = trimmed.indexOf('?');
      const hIdx = trimmed.indexOf('#');
      const sliceFrom = qIdx >= 0 ? trimmed.slice(qIdx) : hIdx >= 0 ? `?${trimmed.slice(hIdx + 1)}` : `?${trimmed}`;
      const params = new URLSearchParams(sliceFrom.split('#')[0]);
      const extracted = params.get('t') || params.get('trah') || params.get('trahInvite');
      if (extracted) return extracted.trim();
      if (trimmed.includes('t=')) {
        const afterT = trimmed.split('t=')[1]?.split('&')[0]?.split('#')[0];
        if (afterT) return decodeURIComponent(afterT).trim();
      }
    } catch {
      // keep raw
    }
  }
  return trimmed;
}

function validateInviteMeta(
  trahId: string,
  trahName: string,
  meta: CompactInviteMeta | undefined,
  scopeKey: string
): { ok: true; role: TrahAccessRole; version: number; dataVersion: number; creatorEmail?: string } | { ok: false; status: 'expired' | 'revoked'; trahName: string } {
  const exp = meta?.exp || 0;
  if (exp > 0 && Date.now() > exp) {
    return { ok: false, status: 'expired', trahName };
  }
  const version = meta?.v || 1;
  const dataVersion = Math.max(1, meta?.dv || 1);
  const revokedMap = loadRevokedInviteVersions(scopeKey);
  if (revokedMap[trahId] && version < revokedMap[trahId]) {
    return { ok: false, status: 'revoked', trahName };
  }
  return {
    ok: true,
    role: meta?.r || 'member',
    version,
    dataVersion,
    creatorEmail: meta?.ce,
  };
}

async function decodeTrahInviteInputAsync(
  rawInput: string,
  scopeKey = 'guest'
): Promise<DecodedTrahInviteResult> {
  const parsedHint = parseInviteInput(rawInput, 'trah');
  let resolvedInput = rawInput;
  if (parsedHint?.mode === 'short_code') {
    resolvedInput = await InviteRelayService.resolveInviteTokenIfShort(rawInput);
    if (resolvedInput === rawInput && parsedHint.fallbackSlug) {
      const syncRes = await InviteRelayService.syncRoomOnEntry({
        kind: 'trah',
        slugOrTitle: parsedHint.fallbackSlug,
      });
      if (syncRes.ok && syncRes.snapshot) {
        resolvedInput = syncRes.snapshot;
      }
    }
  } else if (parsedHint?.mode === 'room_slug') {
    // Jika link membawa token mandiri (?trah=...&t=LQH2_...), coba sinkron cepat lalu fallback otomatis ke token mandiri
    const syncRes = await InviteRelayService.syncRoomOnEntry({
      kind: 'trah',
      slugOrTitle: parsedHint.canonicalSlug,
      timeoutMs: parsedHint.embeddedToken ? 900 : 1700,
    });
    if (syncRes.ok && syncRes.snapshot) {
      resolvedInput = syncRes.snapshot;
    } else if (parsedHint.embeddedToken) {
      resolvedInput = parsedHint.embeddedToken;
    } else {
      return null;
    }
  } else {
    resolvedInput = await InviteRelayService.resolveInviteTokenIfShort(rawInput);
  }
  const token = extractRawTokenFromInput(resolvedInput);
  if (!token) return null;

  if (token.startsWith('LQH2_')) {
    try {
      const compressedBytes = fromBase64Url(token.slice(5));
      if (typeof DecompressionStream === 'undefined') return null;
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressedBytes);
      writer.close();
      const decompressedBuf = await new Response(ds.readable).arrayBuffer();
      const json = new TextDecoder().decode(new Uint8Array(decompressedBuf));
      const arr = JSON.parse(json) as [
        number,
        string,
        string,
        string,
        string,
        LineageSide,
        CompactMemberTuple[],
        CompactInviteMeta?
      ];
      if (!Array.isArray(arr) || arr.length < 7) return null;
      const [, inviter, trahId, trahName, trahDesc, lineageSide, tuples, meta] = arr;
      if (!trahId || !trahName || !Array.isArray(tuples)) return null;

      const check = validateInviteMeta(trahId, trahName, meta, scopeKey);
      if (!check.ok) {
        return { status: check.status, trahName: check.trahName };
      }

      const members: FamilyMember[] = tuples.map((tp) => {
        const pIdx = tp[3];
        const parentId = pIdx >= 0 && tuples[pIdx] ? tuples[pIdx][0] : null;
        const spTuples = tp[10] || [];
        const spouses: SpouseInfo[] = spTuples.map((sp, spIdx) => ({
          id: `sp_${tp[0]}_${spIdx + 1}`,
          name: sp[0],
          orderIndex: spIdx + 1,
          status: SPOUSE_STATUS_LIST[sp[1]] || 'menikah',
        }));
        return {
          id: tp[0],
          name: tp[1],
          gender: tp[2] === 'P' ? 'P' : 'L',
          parentId,
          generationLevel: tp[4] ?? 0,
          orderIndex: tp[5] ?? 1,
          isDeceased: tp[6] === 1,
          callName: tp[7] || undefined,
          birthYear: tp[8] || undefined,
          deathYear: tp[9] || undefined,
          spouses,
        };
      });

      return {
        status: 'ok',
        inviter: inviter || 'Keluarga',
        trah: {
          id: trahId,
          name: trahName,
          description: trahDesc || 'Trah Undangan Keluarga',
          lineageSide: lineageSide || 'umum',
          members,
          userRole: check.role,
          creatorEmail: check.creatorEmail,
          dataVersion: check.dataVersion,
          lastSyncedAt: new Date().toISOString(),
          invitePolicy: { version: check.version, role: check.role, expiryHours: 0 },
        },
      };
    } catch {
      return null;
    }
  }

  if (token.startsWith('LQH1:')) {
    try {
      const bytes = fromBase64Url(token.slice(5));
      const json = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(json) as {
        v?: number;
        inviter?: string;
        meta?: CompactInviteMeta;
        trah?: Partial<TrahCategory>;
      };
      if (!parsed.trah || !parsed.trah.id || !parsed.trah.name) return null;
      const check = validateInviteMeta(parsed.trah.id, parsed.trah.name, parsed.meta, scopeKey);
      if (!check.ok) {
        return { status: check.status, trahName: check.trahName };
      }
      const rawMembers = Array.isArray(parsed.trah.members) ? parsed.trah.members : [];
      return {
        status: 'ok',
        inviter: parsed.inviter || 'Keluarga',
        trah: {
          id: parsed.trah.id,
          name: parsed.trah.name,
          description: parsed.trah.description || 'Trah Undangan Keluarga',
          lineageSide: parsed.trah.lineageSide || 'umum',
          members: rawMembers,
          userRole: check.role,
          creatorEmail: check.creatorEmail,
          dataVersion: check.dataVersion,
          lastSyncedAt: new Date().toISOString(),
          invitePolicy: { version: check.version, role: check.role, expiryHours: 0 },
        },
      };
    } catch {
      return null;
    }
  }

  return null;
}

const DEFAULT_ACCOUNT_PROFILE: LeluhurAccountProfile = {
  displayName: '',
  fullName: '',
  email: '',
  phone: '',
  domicile: '',
  kinshipRole: '',
  bio: '',
  avatarUrl: '',
  defaultPosterYear: String(new Date().getFullYear()),
};

const DEFAULT_APP_PREFERENCES: LeluhurAppPreferences = {
  defaultStartMenu: 'grid',
  photoShape: 'hexagon',
  showPillarBar: true,
};

export function parseCommaChildren(
  input: string
): Array<{ name: string; gender: 'L' | 'P'; orderIndex: number; explicitGender?: boolean }> {
  if (!input.trim()) return [];
  // Ganti konjungsi kata sambung bahasa Indonesia dengan pemisah koma
  const sanitized = input
    .replace(/\s+(?:dan|serta|dg|dgn)\s+/gi, ', ')
    .replace(/[\r\n]+/g, ', ');

  const rawList = sanitized
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return rawList.map((raw, index) => {
    let name = raw;
    let gender: 'L' | 'P' = 'L';
    let explicitGender = false;
    // Hapus nomor urut seperti '1. ', '1) ', '1 - ', '-', '• ', '* '
    name = name.replace(/^(\d+[\.\)\-:\s]+|[\-\•\*\>\s]+)/, '').trim();

    // Deteksi jenis kelamin dari kurung seperti (P), (Pr), (Perempuan), (Wanita), (L), (Lk), (Pria)
    if (/\((P|Pr|Perempuan|Wanita|Perp|Cewek|F)\)/i.test(name)) {
      gender = 'P';
      explicitGender = true;
      name = name.replace(/\((P|Pr|Perempuan|Wanita|Perp|Cewek|F)\)/i, '').trim();
    } else if (/\((L|Lk|Laki|Laki-laki|Pria|Cowok|M)\)/i.test(name)) {
      gender = 'L';
      explicitGender = true;
      name = name.replace(/\((L|Lk|Laki|Laki-laki|Pria|Cowok|M)\)/i, '').trim();
    }

    return { name, gender, orderIndex: index + 1, explicitGender };
  });
}

function serializeQuickChildren(
  items: Array<{ name: string; gender: 'L' | 'P'; explicitGender?: boolean }>
): string {
  return items
    .map((item) => {
      if (item.gender === 'P') return `${item.name} (P)`;
      if (item.explicitGender) return `${item.name} (L)`;
      return item.name;
    })
    .join(', ');
}

export function getKinshipLabel(level: number): string {
  switch (level) {
    case 0:
      return 'Uyut';
    case 1:
      return 'Abah / Kakek';
    case 2:
      return 'Bapak / Ayah';
    case 3:
      return 'Anak';
    case 4:
      return 'Cucu';
    case 5:
      return 'Cicit';
    default:
      return `Gen ${level}`;
  }
}

export function getAncestryPath(member: FamilyMember, allMembers: FamilyMember[]) {
  const chain: FamilyMember[] = [];
  let curr: FamilyMember | undefined = member;
  const visited = new Set<string>();

  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    chain.unshift(curr);
    if (!curr.parentId) break;
    curr = allMembers.find((m) => m.id === curr?.parentId);
  }
  return chain;
}

export function getDescendantIds(memberId: string, allMembers: FamilyMember[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [memberId];
  while (queue.length > 0) {
    const currId = queue.shift()!;
    allMembers.forEach((m) => {
      if (m.parentId === currId && !descendants.has(m.id)) {
        descendants.add(m.id);
        queue.push(m.id);
      }
    });
  }
  return descendants;
}

export function normalizeTrahMembers(
  rawMembers: FamilyMember[],
  _legacyFlag = false
): { members: FamilyMember[]; repairedCount: number } {
  if (!Array.isArray(rawMembers) || rawMembers.length === 0) {
    return { members: [], repairedCount: 0 };
  }

  let repairedCount = 0;
  const seenIds = new Set<string>();
  const members: FamilyMember[] = [];

  rawMembers.forEach((raw, idx) => {
    if (!raw || !raw.name) return;
    const id = (raw.id || `m_norm_${idx}`).trim();
    if (seenIds.has(id)) return;
    seenIds.add(id);

    const rawParent = typeof raw.parentId === 'string' ? raw.parentId.trim() : raw.parentId;
    const cleanParentId = !rawParent || rawParent === id ? null : rawParent;
    if (raw.parentId !== cleanParentId) repairedCount++;

    const rawGenderStr = String((raw as { gender?: string }).gender || '').trim();
    const normGender: 'L' | 'P' = /^(P|PR|PEREMPUAN|WANITA|PERP|CEWEK|F)$/i.test(rawGenderStr) ? 'P' : 'L';
    if (raw.gender !== normGender) repairedCount++;

    members.push({
      ...raw,
      id,
      name: raw.name.trim(),
      gender: normGender,
      parentId: cleanParentId,
      generationLevel: typeof raw.generationLevel === 'number' ? raw.generationLevel : 0,
      orderIndex: typeof raw.orderIndex === 'number' && raw.orderIndex > 0 ? raw.orderIndex : idx + 1,
      spouses: Array.isArray(raw.spouses) ? raw.spouses : [],
    });
  });

  const idMap = new Map(members.map((m) => [m.id, m]));

  // Bersihkan sisa parentId yang menunjuk ID yang sudah terhapus (dangling)
  members.forEach((m) => {
    if (m.parentId && !idMap.has(m.parentId)) {
      m.parentId = null;
      repairedCount++;
    }
  });

  // Hitung ulang generationLevel akurat berdasarkan rantai parentId (aman terhadap siklus)
  const computedDepth = new Map<string, number>();
  const resolveDepth = (id: string, stack = new Set<string>()): number => {
    if (computedDepth.has(id)) return computedDepth.get(id)!;
    const node = idMap.get(id);
    if (!node || !node.parentId) {
      computedDepth.set(id, 0);
      return 0;
    }
    if (stack.has(id)) {
      // Putus siklus jika ada
      node.parentId = null;
      repairedCount++;
      computedDepth.set(id, 0);
      return 0;
    }
    stack.add(id);
    const parentDepth = resolveDepth(node.parentId, stack);
    const depth = parentDepth + 1;
    computedDepth.set(id, depth);
    return depth;
  };

  members.forEach((m) => {
    const depth = resolveDepth(m.id);
    if (m.generationLevel !== depth) {
      m.generationLevel = depth;
      repairedCount++;
    }
  });

  return { members, repairedCount };
}

export function sortMembersHierarchically(members: FamilyMember[]): FamilyMember[] {
  if (!members || members.length === 0) return [];
  const idSet = new Set(members.map((m) => m.id));
  const childrenMap = new Map<string, FamilyMember[]>();

  members.forEach((m) => {
    if (m.parentId && idSet.has(m.parentId)) {
      if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, []);
      childrenMap.get(m.parentId)!.push(m);
    }
  });

  childrenMap.forEach((arr) =>
    arr.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0) || a.name.localeCompare(b.name))
  );

  const roots = members
    .filter((m) => !m.parentId || !idSet.has(m.parentId))
    .sort((a, b) => (a.generationLevel || 0) - (b.generationLevel || 0) || (a.orderIndex || 0) - (b.orderIndex || 0));

  const ordered: FamilyMember[] = [];
  const visited = new Set<string>();

  const walk = (node: FamilyMember) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    ordered.push(node);
    const children = childrenMap.get(node.id) || [];
    children.forEach(walk);
  };

  roots.forEach(walk);
  members.forEach((m) => {
    if (!visited.has(m.id)) ordered.push(m);
  });

  return ordered;
}

export function getSpouseStatusBadge(status: 'menikah' | 'cerai_hidup' | 'cerai_mati') {
  switch (status) {
    case 'menikah':
      return { label: 'Menikah', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'cerai_hidup':
      return { label: 'Cerai Hidup', className: 'bg-amber-100 text-amber-900 border-amber-300' };
    case 'cerai_mati':
      return { label: 'Cerai Mati / Wafat', className: 'bg-stone-200 text-stone-700 border-stone-300' };
  }
}

/**
 * Otomatis kompres foto saat diunggah:
 * - Menjaga dimensi ideal portrait/avatar (maksimal 400x400 px)
 * - Menggunakan kompresi JPEG kualitas 0.82
 * - Ukuran file menyusut hingga < 40-70 KB sehingga aman di localStorage dan tidak bikin berat rendering pohon silsilah
 */
export async function compressImageFile(file: File, maxDimension = 400, quality = 0.82): Promise<{ dataUrl: string; originalSizeKb: number; compressedSizeKb: number }> {
  const originalSizeKb = Math.round(file.size / 1024);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file foto'));
    reader.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: e.target?.result as string, originalSizeKb, compressedSizeKb: originalSizeKb });
          return;
        }

        // Bicubic smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const compressedSizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
        resolve({ dataUrl, originalSizeKb, compressedSizeKb });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const LeluhurQuView: React.FC<LeluhurQuViewProps> = ({
  onBackToWarga,
  showNotification,
  onOpenChatQu
}) => {
  const [accountScope, setAccountScope] = useState(() => getCurrentAccountScope());

  const loadTrahListForScope = (scope: { email: string; scopeKey: string; isOwner: boolean }): TrahCategory[] => {
    const scopedKey = getScopedTrahStorageKey(scope.scopeKey);
    try {
      const scopedRaw = localStorage.getItem(scopedKey);
      if (scopedRaw !== null) {
        const parsed = JSON.parse(scopedRaw);
        if (Array.isArray(parsed)) {
          return parsed.map((t: TrahCategory) => ({
            ...t,
            members: normalizeTrahMembers(t.members || []).members,
          }));
        }
      }
    } catch (e) {
      console.warn('Gagal membaca scoped trah key:', scopedKey, e);
    }

    if (scope.isOwner) {
      for (const key of STORAGE_KEYS) {
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const normalized = parsed.map((t: TrahCategory) => ({
                ...t,
                members: normalizeTrahMembers(t.members || []).members,
              }));
              localStorage.setItem(scopedKey, JSON.stringify(normalized));
              return normalized;
            }
          }
        } catch (e) {
          console.warn('Gagal membaca storage key:', key, e);
        }
      }
    }

    try {
      localStorage.setItem(scopedKey, JSON.stringify([]));
    } catch {
      // ignore
    }
    return [];
  };

  const loadPostsForScope = (scope: { email: string; scopeKey: string; isOwner: boolean }): TrahPost[] => {
    const scopedPostsKey = getScopedPostsStorageKey(scope.scopeKey);
    try {
      const savedScoped = localStorage.getItem(scopedPostsKey);
      if (savedScoped !== null) {
        const parsed = JSON.parse(savedScoped);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Gagal membaca scoped posts:', e);
    }

    if (scope.isOwner) {
      try {
        const legacy = localStorage.getItem(TRAH_POSTS_STORAGE_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Gagal membaca trah posts:', e);
      }
    }

    return [];
  };

  const [trahList, setTrahList] = useState<TrahCategory[]>(() => loadTrahListForScope(accountScope));

  const [activeTrahId, setActiveTrahId] = useState<string>(() => {
    const initial = loadTrahListForScope(getCurrentAccountScope());
    return initial[0]?.id || '';
  });
  const [inviteJoinInput, setInviteJoinInput] = useState<string>('');
  const [exportFeeModal, setExportFeeModal] = useState<{
    open: boolean;
    actionLabel: string;
    onPaidCallback: (() => void) | null;
  }>({ open: false, actionLabel: '', onPaidCallback: null });

  // Akun Profil & Preferensi Aplikasi (tersimpan otomatis di localStorage)
  const [accountProfile, setAccountProfile] = useState<LeluhurAccountProfile>(() => {
    const authAcc = AuthService.getAccount();
    const baseProfile: LeluhurAccountProfile = {
      ...DEFAULT_ACCOUNT_PROFILE,
      displayName: authAcc ? AuthService.getDisplayName(authAcc) : '',
      fullName: authAcc ? AuthService.getDisplayName(authAcc) : '',
      email: authAcc?.email || '',
      phone: authAcc?.phone || '',
    };
    try {
      const saved = localStorage.getItem(ACCOUNT_PROFILE_KEY);
      if (saved) {
        return { ...baseProfile, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Gagal membaca profil akun:', e);
    }
    return baseProfile;
  });

  const [appPreferences, setAppPreferences] = useState<LeluhurAppPreferences>(() => {
    const legacyShape = (localStorage.getItem(PHOTO_SHAPE_KEY) as PhotoShape) || 'hexagon';
    try {
      const saved = localStorage.getItem(APP_PREFS_KEY);
      if (saved) {
        return { ...DEFAULT_APP_PREFERENCES, photoShape: legacyShape, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Gagal membaca preferensi:', e);
    }
    return { ...DEFAULT_APP_PREFERENCES, photoShape: legacyShape };
  });

  // Mode Tampilan: 'grid' | 'excel' | 'feed' | 'kuis' | 'settings'
  const [viewMode, setViewMode] = useState<'grid' | 'excel' | 'feed' | 'kuis' | 'settings'>(() => {
    return appPreferences.defaultStartMenu || 'grid';
  });

  // State Postingan Medsos TrahBook (terisolasi per-akun)
  const [trahPosts, setTrahPosts] = useState<TrahPost[]>(() => loadPostsForScope(accountScope));

  // Filter Tab Medsos ('all' atau trahId tertentu agar semua Trah modular otomatis terhubung)
  const [feedPillarFilter, setFeedPillarFilter] = useState<string>('all');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [newPostCategory, setNewPostCategory] = useState<'kabar_gembira' | 'silaturahmi' | 'sejarah' | 'lelayu'>('silaturahmi');
  const [newPostImageUrl, setNewPostImageUrl] = useState<string>('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Bentuk Foto di Modal Biodata: 'circle' | 'square' | 'hexagon'
  const photoShape = appPreferences.photoShape;

  // Sidebar Kiri Hidden Drawer
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);

  // Excel Table Filters
  const [excelGenFilter, setExcelGenFilter] = useState<string>('all');
  const [excelParentFilter, setExcelParentFilter] = useState<string>('all');
  const [excelStatusFilter, setExcelStatusFilter] = useState<string>('all');
  const [excelSpouseFilter, setExcelSpouseFilter] = useState<string>('all');
  const [excelGenderFilter, setExcelGenderFilter] = useState<'all' | 'L' | 'P'>('all');
  const [excelSortMode, setExcelSortMode] = useState<'tree' | 'generation'>('tree');

  // Modals state
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Standard Form Add/Edit
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<'add_root' | 'add_child' | 'edit'>('add_root');
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formMemberId, setFormMemberId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>('');
  const [callNameInput, setCallNameInput] = useState<string>('');
  const [birthYearInput, setBirthYearInput] = useState<string>('');
  const [deathYearInput, setDeathYearInput] = useState<string>('');
  const [cityInput, setCityInput] = useState<string>('');
  const [isDeceasedInput, setIsDeceasedInput] = useState<boolean>(false);
  const [photoUrlInput, setPhotoUrlInput] = useState<string>('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [photoCompressionInfo, setPhotoCompressionInfo] = useState<{ orig: number; comp: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [genderInput, setGenderInput] = useState<'L' | 'P'>('L');
  const [notesInput, setNotesInput] = useState<string>('');
  const [orderIndexInput, setOrderIndexInput] = useState<number>(1);
  const [formSpouses, setFormSpouses] = useState<SpouseInfo[]>([]);

  // Quick Batch Modal
  const [isQuickBatchOpen, setIsQuickBatchOpen] = useState<boolean>(false);
  const [quickParentId, setQuickParentId] = useState<string>('');
  const [quickCommaInput, setQuickCommaInput] = useState<string>('');
  const [quickBatchMode, setQuickBatchMode] = useState<'append' | 'replace'>('append');
  const [quickParsedChildren, setQuickParsedChildren] = useState<Array<{ name: string; gender: 'L' | 'P'; orderIndex: number; explicitGender?: boolean }>>([]);
  const [quickShowAddParent, setQuickShowAddParent] = useState<boolean>(false);
  const [quickNewRootName, setQuickNewRootName] = useState<string>('');

  // Add Trah Modal (Modular Trah + Silsilah Awal + Sinkron Lintas Submenu)
  const [isAddTrahModalOpen, setIsAddTrahModalOpen] = useState<boolean>(false);
  const [newTrahName, setNewTrahName] = useState<string>('');
  const [newTrahDesc, setNewTrahDesc] = useState<string>('');
  const [newTrahLineage, setNewTrahLineage] = useState<LineageSide>('ayah_user');
  const [newTrahRootName, setNewTrahRootName] = useState<string>('');
  const [newTrahRootGender, setNewTrahRootGender] = useState<'L' | 'P'>('L');
  const [newTrahRootDeceased, setNewTrahRootDeceased] = useState<boolean>(false);
  const [newTrahRootSpouse, setNewTrahRootSpouse] = useState<string>('');
  const [newTrahChildrenInput, setNewTrahChildrenInput] = useState<string>('');
  const [newTrahCreateIntroPost, setNewTrahCreateIntroPost] = useState<boolean>(true);
  const [newTrahTargetView, setNewTrahTargetView] = useState<'stay' | 'grid' | 'excel' | 'feed'>('grid');

  // Modal Undangan Silsilah Trah Medsos (WA / ChatQu / Salin Link / Barcode QR)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteTrahTarget, setInviteTrahTarget] = useState<TrahCategory | null>(null);
  const [inviteAccessRole, setInviteAccessRole] = useState<TrahAccessRole>('member');
  const [inviteExpiryHours, setInviteExpiryHours] = useState<number>(168);
  const [compactInviteToken, setCompactInviteToken] = useState<string>('');
  const [shortInviteUrl, setShortInviteUrl] = useState<string>('');
  const [inviteShareTab, setInviteShareTab] = useState<'barcode' | 'link'>('barcode');
  const [inviteLinkMode, setInviteLinkMode] = useState<'self_contained' | 'title_sync'>('self_contained');
  const [customPublicBaseInput, setCustomPublicBaseInput] = useState<string>(() => getCustomPublicBaseUrl());
  const [showDomainConfig, setShowDomainConfig] = useState<boolean>(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState<boolean>(false);
  const [autoJoinedBanner, setAutoJoinedBanner] = useState<{
    trahId: string;
    trahName: string;
    inviter: string;
    memberCount: number;
  } | null>(null);
  const [pendingTrahSync, setPendingTrahSync] = useState<{
    title: string;
    canonicalSlug: string;
    rawInput: string;
    isSyncing: boolean;
  } | null>(null);

  // Hub Keluarga Inti Terpusat (Isi 1x, Sinkron ke 4-8+ Trah)
  const [nuclearHub, setNuclearHub] = useState<NuclearFamilyHubData>(() =>
    loadNuclearFamilyHub(accountScope.scopeKey, {
      name: accountProfile.fullName || accountProfile.displayName,
      city: accountProfile.domicile,
      photoUrl: accountProfile.avatarUrl,
    })
  );
  const [isNuclearHubOpen, setIsNuclearHubOpen] = useState<boolean>(false);
  const [nuclearHubPreselect, setNuclearHubPreselect] = useState<{
    trahId: string;
    parentId: string | null;
  } | null>(null);

  // Log Aktivitas, Antrean Proposal 3-Langkah & Status Sinkronisasi Versi
  const [activityLogs, setActivityLogs] = useState<LeluhurActivityLog[]>(() =>
    loadActivityLogsForScope(accountScope.scopeKey)
  );
  const [changeProposals, setChangeProposals] = useState<LeluhurChangeProposal[]>(() =>
    loadProposalsForScope(accountScope.scopeKey)
  );
  const [syncCheckStatus, setSyncCheckStatus] = useState<TrahSyncCheckResult | null>(null);
  const [isCheckingOrPulling, setIsCheckingOrPulling] = useState<boolean>(false);
  const [uiReloadKey, setUiReloadKey] = useState<number>(0);
  const [settingsSectionTrigger, setSettingsSectionTrigger] = useState<{
    tab: SettingsSectionTab;
    key: number;
  }>({ tab: 'account', key: 0 });

  // Modal Tautkan Trah Pasangan (4–8+ Pilar: User + Pasangan & Kakek/Nenek)
  const [isSpouseModalOpen, setIsSpouseModalOpen] = useState<boolean>(false);
  const [spouseNameInput, setSpouseNameInput] = useState<string>('');
  const [spouseAyahNameInput, setSpouseAyahNameInput] = useState<string>('');
  const [spouseIbuNameInput, setSpouseIbuNameInput] = useState<string>('');
  const [spouseGrandparentsExpanded, setSpouseGrandparentsExpanded] = useState<boolean>(false);
  const [spouseKakekAyahInput, setSpouseKakekAyahInput] = useState<string>('');
  const [spouseNenekAyahInput, setSpouseNenekAyahInput] = useState<string>('');
  const [spouseKakekIbuInput, setSpouseKakekIbuInput] = useState<string>('');
  const [spouseNenekIbuInput, setSpouseNenekIbuInput] = useState<string>('');

  // Modal Buku Leluhur PDF (Pratinjau A4/A5/A6 + Unduh PDF + Bagan Akhir Nama)
  const [isBookModalOpen, setIsBookModalOpen] = useState<boolean>(false);

  const activeTrahStorageKey = getScopedTrahStorageKey(accountScope.scopeKey);
  const activePostsStorageKey = getScopedPostsStorageKey(accountScope.scopeKey);
  const activeLogsStorageKey = getScopedLogsStorageKey(accountScope.scopeKey);

  // Simpan data & preferensi otomatis per-akun
  useEffect(() => {
    try {
      localStorage.setItem(activeTrahStorageKey, JSON.stringify(trahList));
      if (accountScope.isOwner) {
        localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(trahList));
      }
    } catch (e) {
      console.error('Failed to save trah list', e);
    }
  }, [trahList, activeTrahStorageKey, accountScope.isOwner]);

  useEffect(() => {
    try {
      localStorage.setItem(activePostsStorageKey, JSON.stringify(trahPosts));
      if (accountScope.isOwner) {
        localStorage.setItem(TRAH_POSTS_STORAGE_KEY, JSON.stringify(trahPosts));
      }
    } catch (e) {
      console.error('Failed to save trah posts', e);
    }
  }, [trahPosts, activePostsStorageKey, accountScope.isOwner]);

  useEffect(() => {
    try {
      localStorage.setItem(activeLogsStorageKey, JSON.stringify(activityLogs));
    } catch (e) {
      console.warn('Gagal menyimpan log aktivitas', e);
    }
  }, [activityLogs, activeLogsStorageKey]);

  useEffect(() => {
    saveProposalsForScope(accountScope.scopeKey, changeProposals);
  }, [changeProposals, accountScope.scopeKey]);

  useEffect(() => {
    try {
      localStorage.setItem(ACCOUNT_PROFILE_KEY, JSON.stringify(accountProfile));
    } catch (e) {
      console.warn('Gagal menyimpan profil akun', e);
    }
  }, [accountProfile]);

  const appendActivityLog = (entry: {
    trahId: string;
    trahName: string;
    actionType: LeluhurLogActionType;
    summary: string;
    targetName?: string;
    details?: string;
  }) => {
    const newLog: LeluhurActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      trahId: entry.trahId,
      trahName: entry.trahName,
      actionType: entry.actionType,
      actorName: accountProfile.displayName || accountProfile.fullName || 'Pengguna',
      actorEmail: accountScope.email || accountProfile.email || undefined,
      targetName: entry.targetName,
      summary: entry.summary,
      details: entry.details,
      createdAt: new Date().toISOString(),
    };
    setActivityLogs((prev) => [newLog, ...prev].slice(0, 250));
  };

  const openSettingsTab = (tab: SettingsSectionTab) => {
    setSettingsSectionTrigger((prev) => ({ tab, key: prev.key + 1 }));
    setViewMode('settings');
  };

  const handleClaimMember = (member: FamilyMember) => {
    const effRole = getEffectiveTrahRole(activeTrah, accountScope.email, accountScope.isOwner);
    if (effRole === 'viewer') {
      showNotification('Akses Anda di Trah ini adalah "Lihat Saja". Hubungi Pengurus Trah untuk izin klaim profil.');
      return;
    }

    const claimerName = accountProfile.displayName || accountProfile.fullName || 'Anggota Keluarga';
    const claimerEmail = accountScope.email || accountProfile.email || `akun-${accountScope.scopeKey}`;
    if (
      member.claimedByEmail &&
      member.claimedByEmail.toLowerCase() !== claimerEmail.toLowerCase()
    ) {
      showNotification(
        `Profil "${member.name}" sudah diklaim oleh ${member.claimedByName || member.claimedByEmail}. Minta Pengurus Trah melepas klaim lebih dulu jika keliru.`
      );
      return;
    }
    const claimedAt = new Date().toISOString();

    setTrahList((prev) =>
      prev.map((t) =>
        t.id === activeTrah.id
          ? {
              ...t,
              members: t.members.map((m) =>
                m.id === member.id
                  ? {
                      ...m,
                      claimedByEmail: claimerEmail,
                      claimedByName: claimerName,
                      claimedAt,
                    }
                  : m
              ),
            }
          : t
      )
    );

    if (selectedMember?.id === member.id) {
      setSelectedMember({
        ...member,
        claimedByEmail: claimerEmail,
        claimedByName: claimerName,
        claimedAt,
      });
    }

    appendActivityLog({
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      actionType: 'claim',
      targetName: member.name,
      summary: `${claimerName} mengklaim profil "${member.name}" sebagai dirinya`,
      details: `Terverifikasi atas akun ${claimerEmail}`,
    });

    showNotification(`Profil "${member.name}" berhasil diklaim atas nama ${claimerName}! ✅`);
  };

  const handleUnclaimMember = (member: FamilyMember) => {
    const currentIdentity = accountScope.email || accountProfile.email || `akun-${accountScope.scopeKey}`;
    const isSelfClaim =
      (member.claimedByEmail || '').toLowerCase() === currentIdentity.toLowerCase();
    const isAdmin = canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner);
    if (!isSelfClaim && !isAdmin) {
      showNotification('Hanya pemilik klaim atau Pengurus Trah yang dapat melepas klaim profil ini.');
      return;
    }

    setTrahList((prev) =>
      prev.map((t) =>
        t.id === activeTrah.id
          ? {
              ...t,
              members: t.members.map((m) =>
                m.id === member.id
                  ? {
                      ...m,
                      claimedByEmail: undefined,
                      claimedByName: undefined,
                      claimedAt: undefined,
                    }
                  : m
              ),
            }
          : t
      )
    );

    if (selectedMember?.id === member.id) {
      setSelectedMember({
        ...member,
        claimedByEmail: undefined,
        claimedByName: undefined,
        claimedAt: undefined,
      });
    }

    appendActivityLog({
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      actionType: 'unclaim',
      targetName: member.name,
      summary: `Klaim profil "${member.name}" dilepaskan`,
      details: `Sebelumnya diklaim oleh ${member.claimedByName || member.claimedByEmail || 'pengguna'}.`,
    });

    showNotification(`Klaim pada profil "${member.name}" telah dilepas.`);
  };

  useEffect(() => {
    const syncFromAuth = () => {
      const nextScope = getCurrentAccountScope();
      setAccountScope((prevScope) => {
        if (prevScope.scopeKey !== nextScope.scopeKey) {
          const nextTrahs = loadTrahListForScope(nextScope);
          const nextPosts = loadPostsForScope(nextScope);
          const nextLogs = loadActivityLogsForScope(nextScope.scopeKey);
          const nextProposals = loadProposalsForScope(nextScope.scopeKey);
          const accNow = AuthService.getAccount();
          const nextHub = loadNuclearFamilyHub(nextScope.scopeKey, {
            name: accNow ? AuthService.getDisplayName(accNow) : '',
          });
          setTrahList(nextTrahs);
          setTrahPosts(nextPosts);
          setActivityLogs(nextLogs);
          setChangeProposals(nextProposals);
          setSyncCheckStatus(null);
          setNuclearHub(nextHub);
          setActiveTrahId(nextTrahs[0]?.id || '');
          setFeedPillarFilter('all');
          setUiReloadKey((k) => k + 1);
        }
        return nextScope;
      });

      const acc = AuthService.getAccount();
      if (!acc) return;
      const displayName = AuthService.getDisplayName(acc);
      setAccountProfile(prev => ({
        ...prev,
        email: acc.email,
        phone: acc.phone,
        displayName:
          prev.displayName && prev.displayName !== DEFAULT_ACCOUNT_PROFILE.displayName
            ? prev.displayName
            : displayName,
        fullName:
          prev.fullName && prev.fullName !== DEFAULT_ACCOUNT_PROFILE.fullName
            ? prev.fullName
            : displayName,
      }));
    };
    const reloadLeluhurScopedState = () => {
      const nextScope = getCurrentAccountScope();
      setAccountScope(nextScope);
      const nextTrahs = loadTrahListForScope(nextScope);
      const nextPosts = loadPostsForScope(nextScope);
      const nextLogs = loadActivityLogsForScope(nextScope.scopeKey);
      const nextProposals = loadProposalsForScope(nextScope.scopeKey);
      const nextHub = loadNuclearFamilyHub(nextScope.scopeKey);
      setTrahList(nextTrahs);
      setTrahPosts(nextPosts);
      setActivityLogs(nextLogs);
      setChangeProposals(nextProposals);
      setNuclearHub(nextHub);
      setActiveTrahId((prevId) =>
        nextTrahs.some((t) => t.id === prevId) ? prevId : nextTrahs[0]?.id || ''
      );
      setUiReloadKey((k) => k + 1);
      try {
        const savedPref = localStorage.getItem(APP_PREFS_KEY);
        if (savedPref) {
          setAppPreferences((prev) => ({ ...prev, ...JSON.parse(savedPref) }));
        }
      } catch {
        // ignore
      }
    };
    const handleRemotePairingSync = (ev: Event) => {
      const detail = (ev as CustomEvent<PairingSyncEventDetail>).detail;
      if (!detail?.remoteApplied) return;
      reloadLeluhurScopedState();
    };
    const handleLeluhurModuleSync = () => {
      reloadLeluhurScopedState();
    };
    syncFromAuth();
    window.addEventListener(AUTH_SYNC_EVENT, syncFromAuth);
    window.addEventListener(DEVICE_PAIRING_SYNC_EVENT, handleRemotePairingSync);
    window.addEventListener(LELUHUR_SYNC_EVENT, handleLeluhurModuleSync);
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, syncFromAuth);
      window.removeEventListener(DEVICE_PAIRING_SYNC_EVENT, handleRemotePairingSync);
      window.removeEventListener(LELUHUR_SYNC_EVENT, handleLeluhurModuleSync);
    };
  }, []);

  const handleAcceptTrahInvite = async (
    rawTokenOrUrl: string,
    autoFromLink = false
  ): Promise<boolean> => {
    const parsedHint = parseInviteInput(rawTokenOrUrl, 'trah');
    if (parsedHint?.mode === 'room_slug') {
      setPendingTrahSync({
        title: parsedHint.titleGuess,
        canonicalSlug: parsedHint.canonicalSlug,
        rawInput: rawTokenOrUrl,
        isSyncing: true,
      });
    }

    const targetScope = getCurrentAccountScope();
    const decoded = await decodeTrahInviteInputAsync(rawTokenOrUrl, targetScope.scopeKey);
    if (!decoded || decoded.status !== 'ok') {
      setPendingTrahSync(null);
      if (decoded && decoded.status === 'expired') {
        showNotification(
          `Undangan${decoded.trahName ? ` "${decoded.trahName}"` : ''} sudah kedaluwarsa (expired). Minta Pengurus Trah membuat Barcode/Link baru.`
        );
        return false;
      }
      if (decoded && decoded.status === 'revoked') {
        showNotification(
          `QR / Link undangan lama${decoded.trahName ? ` "${decoded.trahName}"` : ''} sudah dimatikan oleh Pengurus Trah.`
        );
        return false;
      }
      if (parsedHint?.mode === 'room_slug') {
        setPendingTrahSync({
          title: parsedHint.titleGuess,
          canonicalSlug: parsedHint.canonicalSlug,
          rawInput: rawTokenOrUrl,
          isSyncing: false,
        });
        showNotification(
          `Menunggu sinkronisasi "${parsedHint.titleGuess}". Pastikan perangkat keluarga sedang membuka WargaQu lalu tekan Sinkronkan Ulang.`
        );
      } else {
        showNotification('Kode atau link undangan Trah tidak valid.');
      }
      return false;
    }

    setPendingTrahSync(null);
    const { trah: rawInvited, inviter } = decoded;
    const nowIso = new Date().toISOString();
    const normalizedInvited: TrahCategory = {
      ...rawInvited,
      dataVersion: Math.max(1, rawInvited.dataVersion || 1),
      lastSyncedAt: nowIso,
      members: normalizeTrahMembers(rawInvited.members || [], false).members,
    };

    const targetKey = getScopedTrahStorageKey(targetScope.scopeKey);

    setTrahList((prev) => {
      const existsIdx = prev.findIndex((t) => t.id === normalizedInvited.id);
      const nextList =
        existsIdx !== -1
          ? prev.map((t, i) => {
              if (i !== existsIdx) return t;
              // Pertahankan hak akses admin jika user memang pembuat/owner Trah ini
              const preserveAdmin =
                targetScope.isOwner ||
                t.userRole === 'admin' ||
                (t.creatorEmail &&
                  targetScope.email &&
                  t.creatorEmail.toLowerCase() === targetScope.email.toLowerCase());
              return {
                ...normalizedInvited,
                userRole: preserveAdmin ? 'admin' : normalizedInvited.userRole,
                creatorEmail: t.creatorEmail || normalizedInvited.creatorEmail,
                invitePolicy: t.invitePolicy || normalizedInvited.invitePolicy,
                dataVersion: Math.max(normalizedInvited.dataVersion || 1, t.dataVersion || 1),
                lastSyncedAt: nowIso,
              };
            })
          : [normalizedInvited, ...prev];
      try {
        localStorage.setItem(targetKey, JSON.stringify(nextList));
      } catch {
        // ignore
      }
      return nextList;
    });
    setActiveTrahId(normalizedInvited.id);
    setInviteJoinInput('');
    setViewMode('grid');
    if (autoFromLink) {
      setAutoJoinedBanner({
        trahId: normalizedInvited.id,
        trahName: normalizedInvited.name,
        inviter,
        memberCount: normalizedInvited.members.length,
      });
    }

    if (targetScope.scopeKey === 'guest') {
      try {
        sessionStorage.setItem(CARRYOVER_INVITE_KEY, rawTokenOrUrl);
      } catch {
        // ignore
      }
    }

    const joinedRoleMeta = getTrahRoleMeta(normalizedInvited.userRole || 'member');
    appendActivityLog({
      trahId: normalizedInvited.id,
      trahName: normalizedInvited.name,
      actionType: 'invite_join',
      targetName: normalizedInvited.name,
      summary: `Sinkronisasi & masuk Trah "${normalizedInvited.name}" via undangan ${inviter} (${joinedRoleMeta.shortLabel})`,
      details: `${normalizedInvited.members.length} anggota silsilah dimuat ke akun ${targetScope.email || 'tamu'}.`,
    });

    showNotification(
      `Masuk Trah "${normalizedInvited.name}" (${normalizedInvited.members.length} anggota • Akses: ${joinedRoleMeta.shortLabel}).`
    );
    return true;
  };

  // Proses otomatis undangan Trah yang masuk lewat URL (?trah=Nama-Trah / ?t=...)
  useEffect(() => {
    const checkAndProcessInvite = async () => {
      try {
        const pending = localStorage.getItem(PENDING_INVITE_KEY);
        if (pending && pending.trim()) {
          localStorage.removeItem(PENDING_INVITE_KEY);
          await handleAcceptTrahInvite(pending, true);
          return;
        }
        // Jika baru saja login setelah klik link undangan saat masih Guest, bawa otomatis Trah undangan ke akun baru
        if (accountScope.scopeKey !== 'guest') {
          const carryover = sessionStorage.getItem(CARRYOVER_INVITE_KEY);
          if (carryover && carryover.trim()) {
            sessionStorage.removeItem(CARRYOVER_INVITE_KEY);
            await handleAcceptTrahInvite(carryover, true);
          }
        }
      } catch {
        // ignore
      }
    };

    checkAndProcessInvite();
    window.addEventListener('wargaqu-trah-invite-arrived', checkAndProcessInvite);
    return () => window.removeEventListener('wargaqu-trah-invite-arrived', checkAndProcessInvite);
  }, [accountScope.scopeKey]);

  // Daftarkan channel sinkronisasi untuk semua Trah milik akun ini & jawab event spesifik per-Trah
  useEffect(() => {
    if (trahList.length === 0 && !pendingTrahSync) return;
    const channels = trahList.map((t) => getSyncChannelName('trah', t.name));
    if (pendingTrahSync) {
      channels.push(getSyncChannelName('trah', pendingTrahSync.canonicalSlug));
    }
    window.dispatchEvent(
      new CustomEvent(RELAY_REGISTER_CHANNELS_EVENT, { detail: { channels } })
    );

    const onRelaySync = (ev: Event) => {
      const detail = (ev as CustomEvent<{
        channel?: string;
        eventName?: string;
        payload?: any;
      }>).detail;
      if (!detail || !detail.channel?.startsWith('sync:trah:')) return;
      const requestedSlug = detail.channel.slice('sync:trah:'.length);

      if (detail.eventName === 'sync:request') {
        const match = trahList.find((t) => canonicalInviteSlug(t.name) === requestedSlug);
        if (!match) return;
        void encodeTrahInviteTokenCompact(
          match,
          accountProfile.displayName || 'Keluarga',
          match.invitePolicy,
          accountScope.email
        ).then((snapshot) => {
          void InviteRelayService.publishRoomSnapshot({
            kind: 'trah',
            title: match.name,
            inviter: accountProfile.displayName || 'Keluarga',
            snapshot,
          });
        });
      } else if (
        detail.eventName === 'sync:snapshot' &&
        pendingTrahSync &&
        pendingTrahSync.canonicalSlug === requestedSlug &&
        detail.payload?.snapshot
      ) {
        void handleAcceptTrahInvite(detail.payload.snapshot, true);
      } else if (detail.eventName === 'trah:version_updated' && detail.payload) {
        const header = detail.payload;
        const activeTarget = trahList.find((t) => t.id === activeTrahId) || trahList[0];
        if (!activeTarget || canonicalInviteSlug(activeTarget.name) !== requestedSlug) return;
        const localVer = Math.max(1, activeTarget.dataVersion || 1);
        const remoteVer = Math.max(1, Number(header.dataVersion || 1));
        const outdated =
          remoteVer > localVer ||
          (remoteVer === localVer &&
            Number(header.memberCount || 0) !== activeTarget.members.length &&
            Number(header.updatedAt || 0) >
              (activeTarget.lastSyncedAt ? new Date(activeTarget.lastSyncedAt).getTime() : 0));
        setSyncCheckStatus((prev) => ({
          slug: requestedSlug,
          remoteHeader: header,
          localVersion: localVer,
          localMemberCount: activeTarget.members.length,
          isOutdated: outdated,
          pendingProposals: prev?.pendingProposals || [],
          pendingCount: prev?.pendingCount || 0,
        }));
      } else if (detail.eventName === 'trah:proposal_submitted' && detail.payload?.proposal) {
        const incoming = detail.payload.proposal as LeluhurChangeProposal;
        setChangeProposals((prev) => [incoming, ...prev.filter((p) => p.id !== incoming.id)]);
      } else if (detail.eventName === 'trah:proposal_resolved' && detail.payload?.proposalId) {
        const { proposalId, decision, reviewedBy } = detail.payload as {
          proposalId: string;
          decision: 'approved' | 'rejected';
          reviewedBy?: string;
        };
        setChangeProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId
              ? {
                  ...p,
                  status: decision,
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: reviewedBy || p.reviewedBy,
                }
              : p
          )
        );
      }
    };

    window.addEventListener(REALTIME_RELAY_EVENT_NAME, onRelaySync as EventListener);
    return () => {
      window.removeEventListener(REALTIME_RELAY_EVENT_NAME, onRelaySync as EventListener);
    };
  }, [trahList, activeTrahId, pendingTrahSync, accountProfile.displayName, accountScope.email]);

  // Pemantau Jadwal Kuis Trah Terjadwal (tanpa polling 2 detik: hitung timer tepat ke ronde terdekat)
  useEffect(() => {
    if (trahList.length === 0 || viewMode === 'kuis') return;
    const active = trahList.find((t) => t.id === activeTrahId) || trahList[0];
    if (!active) return;

    const rounds = loadQuizRounds(accountScope.scopeKey, active.id);
    const now = Date.now();
    const dueRound = rounds.find((r) => {
      const snap = getRoundTimingSnapshot(r, now);
      return snap.phase === 'live' && !isAlertHandledForRound(r.id);
    });
    if (dueRound) {
      setViewMode('kuis');
      showNotification(`Waktunya Kuis Trah "${dueRound.title}"! Alert SiagaQu aktif.`);
      return;
    }

    const upcomingDelays = rounds
      .map((r) => new Date(r.scheduledStartAt).getTime() - now)
      .filter((ms) => Number.isFinite(ms) && ms > 0);
    if (upcomingDelays.length === 0) return;

    const nextMs = Math.min(...upcomingDelays, 2147483000);
    const timer = window.setTimeout(() => {
      const latestRounds = loadQuizRounds(accountScope.scopeKey, active.id);
      const fireRound = latestRounds.find((r) => {
        const snap = getRoundTimingSnapshot(r, Date.now());
        return snap.phase === 'live' && !isAlertHandledForRound(r.id);
      });
      if (fireRound) {
        setViewMode('kuis');
        showNotification(`Waktunya Kuis Trah "${fireRound.title}"! Alert SiagaQu aktif.`);
      }
    }, Math.max(500, nextMs + 250));
    return () => window.clearTimeout(timer);
  }, [trahList, activeTrahId, viewMode, accountScope.scopeKey, showNotification]);

  // Hasilkan link judul (?trah=Nama-Trah) instan & token bermuatan kebijakan akses + kedaluwarsa + versi
  useEffect(() => {
    if (!isInviteModalOpen || trahList.length === 0) return;
    let cancelled = false;
    const target = inviteTrahTarget || activeTrah;
    const { url } = InviteRelayService.buildTitleInviteUrl('trah', target.name);
    setShortInviteUrl(url);

    const policy: Partial<TrahInvitePolicy> = {
      role: inviteAccessRole,
      expiryHours: inviteExpiryHours,
      version: target.invitePolicy?.version || 1,
    };

    encodeTrahInviteTokenCompact(
      target,
      accountProfile.displayName || 'Keluarga',
      policy,
      accountScope.email
    ).then(async (tok) => {
      if (cancelled) return;
      setCompactInviteToken(tok);
      await InviteRelayService.publishRoomSnapshot({
        kind: 'trah',
        title: target.name,
        inviter: accountProfile.displayName || 'Keluarga',
        snapshot: tok,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    isInviteModalOpen,
    inviteTrahTarget,
    trahList,
    accountProfile.displayName,
    inviteAccessRole,
    inviteExpiryHours,
    accountScope.email,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(APP_PREFS_KEY, JSON.stringify(appPreferences));
      localStorage.setItem(PHOTO_SHAPE_KEY, appPreferences.photoShape);
    } catch (e) {
      console.warn('Gagal menyimpan preferensi', e);
    }
  }, [appPreferences]);

  useEffect(() => {
    setQuickParsedChildren(parseCommaChildren(quickCommaInput));
  }, [quickCommaInput]);

  const activeTrah = useMemo(() => {
    if (trahList.length === 0) return EMPTY_TRAH_PLACEHOLDER;
    const found = trahList.find((t) => t.id === activeTrahId);
    if (found) return found;
    if (activeTrahId === 'trah-santa') {
      const ayah = trahList.find((t) => t.id === 'trah-ayah-user' || t.lineageSide === 'ayah_user');
      if (ayah) return ayah;
    }
    const fallbackAyah = trahList.find((t) => t.lineageSide === 'ayah_user');
    if (fallbackAyah) return fallbackAyah;
    return trahList[0];
  }, [trahList, activeTrahId]);

  useEffect(() => {
    setExcelGenFilter('all');
    setExcelParentFilter('all');
    setExcelGenderFilter('all');
  }, [activeTrah.id]);

  const actorDisplayName =
    accountProfile.displayName || accountProfile.fullName || 'Pengguna';

  const pendingProposalsForActiveTrah = useMemo(() => {
    if (!activeTrah?.id) return [];
    const activeSlug = canonicalInviteSlug(activeTrah.name);
    return changeProposals.filter(
      (p) =>
        p.status === 'pending' &&
        (p.trahId === activeTrah.id || p.trahSlug === activeSlug)
    );
  }, [changeProposals, activeTrah.id, activeTrah.name]);

  const releaseApprovedTrahUpdate = async (
    updatedTrah: TrahCategory,
    summary: string
  ) => {
    if (!updatedTrah?.id || updatedTrah.id === EMPTY_TRAH_PLACEHOLDER.id) return;
    try {
      const snapshotToken = await encodeTrahInviteTokenCompact(
        updatedTrah,
        actorDisplayName,
        updatedTrah.invitePolicy,
        accountScope.email
      );
      const res = await LeluhurVersionSyncService.publishApprovedRelease({
        trah: updatedTrah,
        snapshotToken,
        approvedBy: actorDisplayName,
        summary,
      });
      if (updatedTrah.id === activeTrah.id) {
        setSyncCheckStatus({
          slug: res.header.slug,
          remoteHeader: res.header,
          localVersion: Math.max(1, updatedTrah.dataVersion || 1),
          localMemberCount: updatedTrah.members.length,
          isOutdated: false,
          pendingProposals: pendingProposalsForActiveTrah,
          pendingCount: pendingProposalsForActiveTrah.length,
        });
      }
    } catch {
      // tetap aman secara lokal
    }
  };

  const stageMemberChangeProposal = async (params: {
    trah: TrahCategory;
    actionType: LeluhurProposalActionType;
    targetName?: string;
    summary: string;
    details?: string;
    operations: LeluhurProposalOp[];
  }) => {
    const nowIso = new Date().toISOString();
    const res = await LeluhurVersionSyncService.submitMemberProposal({
      scopeKey: accountScope.scopeKey,
      trah: params.trah,
      proposal: {
        id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trahId: params.trah.id,
        trahName: params.trah.name,
        actionType: params.actionType,
        proposerName: actorDisplayName,
        proposerEmail: accountScope.email || accountProfile.email || undefined,
        targetName: params.targetName,
        summary: params.summary,
        details: params.details,
        baseVersion: Math.max(1, params.trah.dataVersion || 1),
        createdAt: nowIso,
        operations: params.operations,
      },
    });

    setChangeProposals((prev) => [
      res.proposal,
      ...prev.filter((p) => p.id !== res.proposal.id),
    ]);

    const logAction: LeluhurLogActionType =
      params.actionType === 'member_delete'
        ? 'member_delete'
        : params.actionType === 'member_update' || params.actionType === 'batch_replace'
        ? 'member_update'
        : 'member_add';

    appendActivityLog({
      trahId: params.trah.id,
      trahName: params.trah.name,
      actionType: logAction,
      targetName: params.targetName,
      summary: `[Ajuan Menunggu Approve] ${params.summary}`,
      details:
        (params.details ? `${params.details} • ` : '') +
        `Versi dasar v${res.proposal.baseVersion} (${formatSyncTimestamp(nowIso)})`,
    });

    showNotification(
      `Ajuan "${params.summary}" dicatat ke Log & menunggu Approve Admin.`
    );
  };

  const checkActiveTrahVersion = async (targetTrah: TrahCategory) => {
    if (!targetTrah?.id || targetTrah.id === EMPTY_TRAH_PLACEHOLDER.id) return;
    const isAdmin = canManageTrahAdmin(
      targetTrah,
      accountScope.email,
      accountScope.isOwner
    );
    const result = await LeluhurVersionSyncService.checkTrahVersionAndProposals(
      targetTrah,
      isAdmin
    );
    setSyncCheckStatus(result);

    if (isAdmin && result.pendingProposals.length > 0) {
      setChangeProposals((prev) => {
        const merged = [...prev];
        for (const remoteProp of result.pendingProposals) {
          const idx = merged.findIndex((p) => p.id === remoteProp.id);
          if (idx === -1) {
            merged.unshift(remoteProp);
          } else if (merged[idx].status === 'pending' && remoteProp.status !== 'pending') {
            merged[idx] = remoteProp;
          }
        }
        return merged;
      });
    }
  };

  const handleManualRefreshTrah = async () => {
    if (!activeTrah?.id || activeTrah.id === EMPTY_TRAH_PLACEHOLDER.id) return;
    setIsCheckingOrPulling(true);
    try {
      const isAdmin = canManageTrahAdmin(
        activeTrah,
        accountScope.email,
        accountScope.isOwner
      );
      const checkRes = await LeluhurVersionSyncService.checkTrahVersionAndProposals(
        activeTrah,
        isAdmin
      );

      if (isAdmin && checkRes.pendingProposals.length > 0) {
        setChangeProposals((prev) => {
          const merged = [...prev];
          for (const remoteProp of checkRes.pendingProposals) {
            if (!merged.some((p) => p.id === remoteProp.id)) {
              merged.unshift(remoteProp);
            }
          }
          return merged;
        });
      }

      const nowIso = new Date().toISOString();
      const shouldPullSnapshot = Boolean(
        checkRes.isOutdated ||
          (checkRes.remoteHeader &&
            checkRes.remoteHeader.dataVersion >= Math.max(1, activeTrah.dataVersion || 1))
      );

      if (shouldPullSnapshot) {
        const pullRes = await LeluhurVersionSyncService.pullLatestTrahSnapshot(activeTrah.name);
        if (pullRes.ok && pullRes.snapshot) {
          const decoded = await decodeTrahInviteInputAsync(
            pullRes.snapshot,
            accountScope.scopeKey
          );
          if (decoded && decoded.status === 'ok') {
            const nextVersion = Math.max(
              decoded.trah.dataVersion || 1,
              checkRes.remoteHeader?.dataVersion || 1,
              activeTrah.dataVersion || 1
            );
            const isSanta =
              activeTrah.id === 'trah-ayah-user' ||
              activeTrah.name.toUpperCase().includes('SANTA');
            const normalizedMembers = normalizeTrahMembers(
              decoded.trah.members || [],
              isSanta
            ).members;

            const updatedList = trahList.map((t) => {
              if (t.id !== activeTrah.id) return t;
              const preserveAdmin =
                accountScope.isOwner ||
                t.userRole === 'admin' ||
                (t.creatorEmail &&
                  accountScope.email &&
                  t.creatorEmail.toLowerCase() === accountScope.email.toLowerCase());
              return {
                ...t,
                name: decoded.trah.name || t.name,
                description: decoded.trah.description || t.description,
                members: normalizedMembers,
                userRole: preserveAdmin ? 'admin' : t.userRole,
                dataVersion: nextVersion,
                lastSyncedAt: nowIso,
                lastApprovedAt:
                  checkRes.remoteHeader?.updatedAt
                    ? new Date(checkRes.remoteHeader.updatedAt).toISOString()
                    : t.lastApprovedAt,
                lastApprovedBy: checkRes.remoteHeader?.approvedBy || t.lastApprovedBy,
              };
            });

            setTrahList(updatedList);
            flushTrahListToStorage(updatedList);
            setSyncCheckStatus({
              ...checkRes,
              localVersion: nextVersion,
              localMemberCount: normalizedMembers.length,
              isOutdated: false,
            });
            setUiReloadKey((k) => k + 1);
            showNotification(
              `Tarik update v${nextVersion} (${normalizedMembers.length} anggota) berhasil & tampilan dimuat ulang! Sync: ${formatSyncTimestamp(nowIso)}`
            );
            return;
          }
        }
      }

      // Tidak ada versi lebih baru: perbarui timestamp cek & reload UI lokal
      const stampedList = trahList.map((t) =>
        t.id === activeTrah.id ? { ...t, lastSyncedAt: nowIso } : t
      );
      setTrahList(stampedList);
      flushTrahListToStorage(stampedList);
      setSyncCheckStatus({ ...checkRes, isOutdated: false });
      setUiReloadKey((k) => k + 1);
      showNotification(
        `${activeTrah.name} sudah versi terbaru v${Math.max(1, activeTrah.dataVersion || 1)} (${activeTrah.members.length} anggota) • ${formatSyncTimestamp(nowIso)}`
      );
    } finally {
      setIsCheckingOrPulling(false);
    }
  };

  const handleApproveProposal = (proposal: LeluhurChangeProposal) => {
    const targetTrah = trahList.find(
      (t) =>
        t.id === proposal.trahId ||
        canonicalInviteSlug(t.name) === proposal.trahSlug
    );
    if (!targetTrah) {
      showNotification('Trah tujuan tidak ditemukan di daftar Anda.');
      return;
    }
    if (!canManageTrahAdmin(targetTrah, accountScope.email, accountScope.isOwner)) {
      showNotification('Hanya Admin / Pengurus Trah yang berhak melakukan Approve.');
      return;
    }

    const nowIso = new Date().toISOString();
    const patchedTrah = applyProposalOpsToTrah(targetTrah, proposal);
    const isSanta =
      patchedTrah.id === 'trah-ayah-user' ||
      patchedTrah.name.toUpperCase().includes('SANTA');
    const normalizedMembers = normalizeTrahMembers(patchedTrah.members, isSanta).members;
    const nextVersion = Math.max(1, targetTrah.dataVersion || 1) + 1;

    const approvedTrah: TrahCategory = {
      ...patchedTrah,
      members: normalizedMembers,
      dataVersion: nextVersion,
      lastApprovedAt: nowIso,
      lastApprovedBy: actorDisplayName,
      lastSyncedAt: nowIso,
    };

    const nextList = trahList.map((t) => (t.id === targetTrah.id ? approvedTrah : t));
    setTrahList(nextList);
    flushTrahListToStorage(nextList);
    setUiReloadKey((k) => k + 1);

    setChangeProposals((prev) =>
      prev.map((p) =>
        p.id === proposal.id
          ? {
              ...p,
              status: 'approved',
              reviewedAt: nowIso,
              reviewedBy: actorDisplayName,
            }
          : p
      )
    );

    void LeluhurVersionSyncService.resolveProposalOnServer({
      trahName: approvedTrah.name,
      proposalId: proposal.id,
      decision: 'approved',
      reviewedBy: actorDisplayName,
    });
    void releaseApprovedTrahUpdate(
      approvedTrah,
      `Approve v${nextVersion}: ${proposal.summary}`
    );

    appendActivityLog({
      trahId: approvedTrah.id,
      trahName: approvedTrah.name,
      actionType: 'member_update',
      targetName: proposal.targetName,
      summary: `Approve v${nextVersion} (${normalizedMembers.length} anggota): ${proposal.summary}`,
      details: `Diajukan oleh ${proposal.proposerName} • Disetujui ${actorDisplayName}`,
    });

    showNotification(
      `Approve berhasil! Rujukan ${approvedTrah.name} naik ke v${nextVersion} (${normalizedMembers.length} anggota).`
    );
  };

  const handleRejectProposal = (proposal: LeluhurChangeProposal) => {
    const targetTrah = trahList.find(
      (t) =>
        t.id === proposal.trahId ||
        canonicalInviteSlug(t.name) === proposal.trahSlug
    );
    if (
      targetTrah &&
      !canManageTrahAdmin(targetTrah, accountScope.email, accountScope.isOwner)
    ) {
      showNotification('Hanya Admin / Pengurus Trah yang berhak menolak ajuan.');
      return;
    }

    const nowIso = new Date().toISOString();
    setChangeProposals((prev) =>
      prev.map((p) =>
        p.id === proposal.id
          ? {
              ...p,
              status: 'rejected',
              reviewedAt: nowIso,
              reviewedBy: actorDisplayName,
            }
          : p
      )
    );

    void LeluhurVersionSyncService.resolveProposalOnServer({
      trahName: targetTrah?.name || proposal.trahName,
      proposalId: proposal.id,
      decision: 'rejected',
      reviewedBy: actorDisplayName,
    });

    appendActivityLog({
      trahId: proposal.trahId,
      trahName: proposal.trahName,
      actionType: 'member_update',
      targetName: proposal.targetName,
      summary: `Menolak ajuan: ${proposal.summary}`,
      details: `Diajukan oleh ${proposal.proposerName}`,
    });

    showNotification(`Ajuan "${proposal.summary}" ditolak.`);
  };

  // Refresh otomatis TERARAH: hanya saat pertama kali buka / pindah Trah aktif / kembali aktif (visibilitychange & focus)
  useEffect(() => {
    if (!activeTrah?.id || activeTrah.id === EMPTY_TRAH_PLACEHOLDER.id) return;
    void checkActiveTrahVersion(activeTrah);

    const onWakeCheck = () => {
      if (document.visibilityState === 'hidden') return;
      void checkActiveTrahVersion(activeTrah);
    };
    window.addEventListener('focus', onWakeCheck);
    document.addEventListener('visibilitychange', onWakeCheck);
    return () => {
      window.removeEventListener('focus', onWakeCheck);
      document.removeEventListener('visibilitychange', onWakeCheck);
    };
  }, [activeTrah.id, activeTrah.name, activeTrah.dataVersion, accountScope.email, accountScope.isOwner]);

  // Bentuk foto helper
  const getShapeClass = (shape: PhotoShape) => {
    switch (shape) {
      case 'circle':
        return 'rounded-full';
      case 'square':
        return 'rounded-lg';
      case 'hexagon':
        return '[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]';
    }
  };

  const getGenerationMeta = (level: number) => {
    switch (level) {
      case 0:
        return {
          title: 'Uyut (Leluhur Utama)',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
          cardBg: 'bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-300',
          dotColor: 'bg-amber-500'
        };
      case 1:
        return {
          title: 'Abah / Kakek / Nenek',
          badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          cardBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-300',
          dotColor: 'bg-emerald-500'
        };
      case 2:
        return {
          title: 'Bapak / Ayah / Ibu',
          badgeBg: 'bg-sky-100 text-sky-900 border-sky-300',
          cardBg: 'bg-gradient-to-br from-sky-50 to-sky-100/60 border-sky-300',
          dotColor: 'bg-sky-500'
        };
      case 3:
        return {
          title: 'Anak (Kakak & Adik)',
          badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          cardBg: 'bg-gradient-to-br from-indigo-50 to-indigo-100/60 border-indigo-300',
          dotColor: 'bg-indigo-500'
        };
      default:
        return {
          title: `Keturunan (Gen ${level})`,
          badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
          cardBg: 'bg-gradient-to-br from-purple-50 to-purple-100/60 border-purple-300',
          dotColor: 'bg-purple-500'
        };
    }
  };

  // Handlers
  const handleOpenQuickBatch = (targetParent?: FamilyMember) => {
    const effRole = getEffectiveTrahRole(activeTrah, accountScope.email, accountScope.isOwner);
    if (effRole === 'viewer') {
      showNotification('Akses Anda di Trah ini adalah "Lihat Saja". Tidak dapat menambah/mengubah anggota.');
      return;
    }
    let defaultParentId = '';
    if (targetParent) {
      defaultParentId = targetParent.id;
    } else if (activeTrah.members.length > 0) {
      const rootMember = activeTrah.members.find((m) => !m.parentId) || activeTrah.members[0];
      defaultParentId = rootMember.id;
    }
    setQuickParentId(defaultParentId);
    setQuickCommaInput('');
    setQuickBatchMode('append');
    setQuickShowAddParent(activeTrah.members.length === 0);
    setQuickNewRootName('');
    setIsQuickBatchOpen(true);
  };

  const handleSelectQuickParent = (parentId: string) => {
    setQuickParentId(parentId);
    const existingChildren = activeTrah.members
      .filter((m) => m.parentId === parentId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    if (quickBatchMode === 'replace') {
      setQuickCommaInput(
        existingChildren
          .map((c) => `${c.name} (${c.gender === 'P' ? 'P' : 'L'})`)
          .join(', ')
      );
    }
  };

  const handleSwitchToEditExistingChildren = () => {
    const existingChildren = activeTrah.members
      .filter((m) => m.parentId === quickParentId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    setQuickBatchMode('replace');
    setQuickCommaInput(
      existingChildren
        .map((c) => `${c.name} (${c.gender === 'P' ? 'P' : 'L'})`)
        .join(', ')
    );
  };

  const handleCreateQuickRoot = () => {
    const effRole = getEffectiveTrahRole(activeTrah, accountScope.email, accountScope.isOwner);
    if (effRole === 'viewer') {
      showNotification('Akses Anda di Trah ini adalah "Lihat Saja".');
      return;
    }
    if (!quickNewRootName.trim()) {
      showNotification('Nama Ayah/Leluhur Utama tidak boleh kosong!');
      return;
    }

    const newRoot: FamilyMember = {
      id: `m_root_${Date.now()}`,
      name: quickNewRootName.trim(),
      callName: `Uyut ${quickNewRootName.trim().split(' ')[0]}`,
      isDeceased: true,
      gender: 'L',
      notes: 'Leluhur Utama Silsilah (Uyut)',
      parentId: null,
      generationLevel: 0,
      orderIndex: 1,
      spouses: []
    };

    if (!canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner)) {
      void stageMemberChangeProposal({
        trah: activeTrah,
        actionType: 'member_add',
        targetName: newRoot.name,
        summary: `Ajukan Leluhur Utama "${newRoot.name}" di ${activeTrah.name}`,
        operations: [{ op: 'upsert_member', member: newRoot }],
      });
      setQuickShowAddParent(false);
      setQuickNewRootName('');
      return;
    }

    const nowIso = new Date().toISOString();
    let approvedTrahRef: TrahCategory | null = null;
    const updatedTrahList = trahList.map((t) => {
      if (t.id !== activeTrah.id) return t;
      const nextTrah: TrahCategory = {
        ...t,
        members: [newRoot, ...t.members],
        dataVersion: Math.max(1, t.dataVersion || 1) + 1,
        lastApprovedAt: nowIso,
        lastApprovedBy: actorDisplayName,
        lastSyncedAt: nowIso,
      };
      approvedTrahRef = nextTrah;
      return nextTrah;
    });

    setTrahList(updatedTrahList);
    flushTrahListToStorage(updatedTrahList);

    setQuickParentId(newRoot.id);
    setQuickShowAddParent(false);
    setQuickNewRootName('');
    appendActivityLog({
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      actionType: 'member_add',
      targetName: newRoot.name,
      summary: `Membuat Leluhur Utama "${newRoot.name}" di ${activeTrah.name}`,
    });
    if (approvedTrahRef) {
      void releaseApprovedTrahUpdate(
        approvedTrahRef,
        `Membuat Leluhur Utama "${newRoot.name}"`
      );
    }
    showNotification(`Ayah/Leluhur Utama "${newRoot.name}" berhasil dibuat! Silakan isi anak.`);
  };

  const handleSaveQuickBatch = (e?: React.FormEvent, closeModal: boolean = true) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const currentTrah = trahList.find((t) => t.id === activeTrahId) || activeTrah;
    const effRole = getEffectiveTrahRole(currentTrah, accountScope.email, accountScope.isOwner);
    if (effRole === 'viewer') {
      showNotification('Akses Anda di Trah ini adalah "Lihat Saja".');
      return;
    }
    let updatedTrahMembers = [...currentTrah.members];
    const isAdmin = canManageTrahAdmin(currentTrah, accountScope.email, accountScope.isOwner);

    // Jika belum ada parent yang dipilih atau parentId tidak cocok
    let parent = updatedTrahMembers.find((m) => m.id === quickParentId);
    let autoCreatedRoot: FamilyMember | null = null;

    // Otomatis tangani jika trah masih kosong atau parent belum terpilih
    if (!parent) {
      if (updatedTrahMembers.length > 0) {
        parent = updatedTrahMembers[0];
        setQuickParentId(parent.id);
      } else {
        // Trah masih kosong, otomatis buat root ancestor
        const rootName = quickNewRootName.trim() || (currentTrah.name.toUpperCase().includes('SANTA') ? 'Santa' : 'Uyut Santa');
        const newRoot: FamilyMember = {
          id: `m_root_${Date.now()}`,
          name: rootName,
          callName: `Uyut ${rootName.split(' ')[0]}`,
          isDeceased: true,
          gender: 'L',
          notes: 'Leluhur Utama Silsilah (Uyut)',
          parentId: null,
          generationLevel: 0,
          orderIndex: 1,
          spouses: []
        };
        updatedTrahMembers = [newRoot, ...updatedTrahMembers];
        parent = newRoot;
        autoCreatedRoot = newRoot;
      }
    }

    const parsedList = quickParsedChildren.length > 0
      ? quickParsedChildren
      : parseCommaChildren(quickCommaInput);

    if (parsedList.length === 0) {
      showNotification('Ketik minimal 1 nama anak dipisahkan koma (contoh: maman, Ian, Hendri)!');
      return;
    }

    const parentGen = parent.generationLevel;
    const existingChildren = updatedTrahMembers
      .filter((m) => m.parentId === parent.id)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    if (quickBatchMode === 'replace') {
      // Pertahankan ID, foto, pasangan, dan keturunan anak lama bila namanya cocok atau posisinya sama
      const usedOldIds = new Set<string>();
      const matchedPairs: Array<{ parsed: { name: string; gender: 'L' | 'P'; orderIndex: number; explicitGender?: boolean }; existing?: FamilyMember }> =
        parsedList.map((item) => {
          const byName = existingChildren.find(
            (c) => !usedOldIds.has(c.id) && c.name.trim().toLowerCase() === item.name.trim().toLowerCase()
          );
          if (byName) {
            usedOldIds.add(byName.id);
            return { parsed: item, existing: byName };
          }
          return { parsed: item, existing: undefined };
        });

      const remainingOld = existingChildren.filter((c) => !usedOldIds.has(c.id));
      let remainingIdx = 0;
      matchedPairs.forEach((pair) => {
        if (!pair.existing && remainingIdx < remainingOld.length) {
          const fallbackOld = remainingOld[remainingIdx++];
          usedOldIds.add(fallbackOld.id);
          pair.existing = fallbackOld;
        }
      });

      const deletedIds = new Set(
        existingChildren.filter((c) => !usedOldIds.has(c.id)).map((c) => c.id)
      );
      if (!isAdmin) {
        const blockedClaimed = existingChildren.find((c) => {
          const check = canEditTrahMember(currentTrah, c, accountScope.email, accountScope.isOwner);
          return !check.ok && deletedIds.has(c.id);
        });
        if (blockedClaimed) {
          showNotification(
            `Tidak bisa menghapus/mengganti "${blockedClaimed.name}" karena profilnya sudah diklaim pihak lain.`
          );
          return;
        }
      }
      const oldChildIds = new Set(existingChildren.map((c) => c.id));
      const baseMembers = updatedTrahMembers.filter((m) => !oldChildIds.has(m.id));

      const rebuiltChildren: FamilyMember[] = matchedPairs.map(({ parsed, existing }, idx) => {
        if (existing) {
          const nextOrder = idx + 1;
          const nextNotes =
            existing.notes && /^Anak ke-\d+ dari /.test(existing.notes)
              ? `Anak ke-${nextOrder} dari ${parent.name}`
              : existing.notes;
          return {
            ...existing,
            name: parsed.name,
            callName: existing.callName || parsed.name.split(' ')[0],
            gender: parsed.explicitGender ? parsed.gender : existing.gender,
            parentId: parent.id,
            generationLevel: parentGen + 1,
            orderIndex: nextOrder,
            notes: nextNotes,
          };
        }
        return {
          id: `m_ch_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          name: parsed.name,
          callName: parsed.name.split(' ')[0],
          gender: parsed.gender,
          isDeceased: false,
          parentId: parent.id,
          generationLevel: parentGen + 1,
          orderIndex: idx + 1,
          notes: `Anak ke-${idx + 1} dari ${parent.name}`,
          spouses: []
        };
      });

      if (!isAdmin) {
        void stageMemberChangeProposal({
          trah: currentTrah,
          actionType: 'batch_replace',
          targetName: parent.name,
          summary: `Ajukan pembaruan daftar ${rebuiltChildren.length} anak untuk ${parent.name}`,
          details: parsedList.map((p) => p.name).join(', '),
          operations: [
            {
              op: 'upsert_members',
              members: autoCreatedRoot ? [autoCreatedRoot, ...rebuiltChildren] : rebuiltChildren,
              replaceParentId: parent.id,
              removedIds: Array.from(deletedIds),
            },
          ],
        });
        setQuickCommaInput('');
        setQuickBatchMode('append');
        if (closeModal) setIsQuickBatchOpen(false);
        return;
      }

      // Jika ada anak lama yg benar-benar dihapus, re-tautkan cucunya ke root/parent agar tidak jadi yatim rusak
      const patchedBase = baseMembers.map((m) =>
        m.parentId && deletedIds.has(m.parentId) ? { ...m, parentId: parent.id } : m
      );

      const isSanta =
        currentTrah.id === 'trah-ayah-user' ||
        currentTrah.name.toUpperCase().includes('SANTA');
      updatedTrahMembers = normalizeTrahMembers([...patchedBase, ...rebuiltChildren], isSanta).members;
      showNotification(`Berhasil memperbarui urutan & data ${rebuiltChildren.length} anak untuk ${parent.name}; semua keturunan otomatis menyesuaikan! ✨`);
    } else {
      const startOrder = existingChildren.length;
      const newChildren: FamilyMember[] = parsedList.map((item, idx) => ({
        id: `m_ch_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        name: item.name,
        callName: item.name.split(' ')[0],
        gender: item.gender,
        isDeceased: false,
        parentId: parent.id,
        generationLevel: parentGen + 1,
        orderIndex: startOrder + idx + 1,
        notes: `Anak ke-${startOrder + idx + 1} dari ${parent.name}`,
        spouses: []
      }));

      if (!isAdmin) {
        void stageMemberChangeProposal({
          trah: currentTrah,
          actionType: 'batch_add',
          targetName: parent.name,
          summary: `Ajukan tambah ${newChildren.length} anak untuk ${parent.name}`,
          details: parsedList.map((p) => p.name).join(', '),
          operations: [
            {
              op: 'upsert_members',
              members: autoCreatedRoot ? [autoCreatedRoot, ...newChildren] : newChildren,
            },
          ],
        });
        setQuickCommaInput('');
        setQuickBatchMode('append');
        if (closeModal) setIsQuickBatchOpen(false);
        return;
      }

      updatedTrahMembers = [...updatedTrahMembers, ...newChildren];
      showNotification(`Berhasil menambahkan ${newChildren.length} anak untuk ${parent.name}! ✨`);
    }

    const nowIso = new Date().toISOString();
    let approvedTrahRef: TrahCategory | null = null;
    const updatedTrahList = trahList.map((t) => {
      if (t.id !== currentTrah.id) return t;
      const nextTrah: TrahCategory = {
        ...t,
        members: updatedTrahMembers,
        dataVersion: Math.max(1, t.dataVersion || 1) + 1,
        lastApprovedAt: nowIso,
        lastApprovedBy: actorDisplayName,
        lastSyncedAt: nowIso,
      };
      approvedTrahRef = nextTrah;
      return nextTrah;
    });

    setTrahList(updatedTrahList);
    setActiveTrahId(currentTrah.id);
    flushTrahListToStorage(updatedTrahList);

    setQuickCommaInput('');
    setQuickBatchMode('append');

    const batchSummary =
      quickBatchMode === 'replace'
        ? `Memperbarui daftar ${parsedList.length} anak untuk ${parent.name}`
        : `Menambahkan ${parsedList.length} anak baru untuk ${parent.name}`;

    appendActivityLog({
      trahId: currentTrah.id,
      trahName: currentTrah.name,
      actionType: quickBatchMode === 'replace' ? 'member_update' : 'member_add',
      targetName: parent.name,
      summary: batchSummary,
      details: parsedList.map((p) => p.name).join(', '),
    });

    if (approvedTrahRef) {
      void releaseApprovedTrahUpdate(approvedTrahRef, batchSummary);
    }

    if (closeModal) {
      setIsQuickBatchOpen(false);
    }
  };


  const handleToggleParsedGender = (index: number) => {
    const baseList =
      quickParsedChildren.length > 0
        ? quickParsedChildren
        : parseCommaChildren(quickCommaInput);
    const nextList = baseList.map((item, idx) =>
      idx === index
        ? {
            ...item,
            gender: (item.gender === 'L' ? 'P' : 'L') as 'L' | 'P',
            explicitGender: true,
          }
        : item
    );
    setQuickParsedChildren(nextList);
    setQuickCommaInput(serializeQuickChildren(nextList));
  };

  const handleMoveQuickParsedChild = (index: number, direction: 'up' | 'down') => {
    const baseList =
      quickParsedChildren.length > 0
        ? quickParsedChildren
        : parseCommaChildren(quickCommaInput);
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= baseList.length) return;
    const nextList = [...baseList];
    const temp = nextList[index];
    nextList[index] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    const reindexed = nextList.map((item, i) => ({ ...item, orderIndex: i + 1 }));
    setQuickParsedChildren(reindexed);
    setQuickCommaInput(serializeQuickChildren(reindexed));
  };

  // Standard Form Add/Edit
  const handleOpenAddRoot = () => {
    const effRole = getEffectiveTrahRole(activeTrah, accountScope.email, accountScope.isOwner);
    if (effRole === 'viewer') {
      showNotification('Akses Anda di Trah ini adalah "Lihat Saja".');
      return;
    }
    setFormMode('add_root');
    setFormParentId(null);
    setFormMemberId(null);
    setNameInput('');
    setCallNameInput('');
    setBirthYearInput('');
    setDeathYearInput('');
    setCityInput('');
    setIsDeceasedInput(true);
    setPhotoUrlInput('');
    setPhotoCompressionInfo(null);
    setGenderInput('L');
    setNotesInput('');
    setOrderIndexInput(1);
    setFormSpouses([]);
    setIsFormModalOpen(true);
  };

  const handleOpenAddChild = (parent: FamilyMember) => {
    const effRole = getEffectiveTrahRole(activeTrah, accountScope.email, accountScope.isOwner);
    if (effRole === 'viewer') {
      showNotification('Akses Anda di Trah ini adalah "Lihat Saja".');
      return;
    }
    setFormMode('add_child');
    setFormParentId(parent.id);
    setFormMemberId(null);
    setNameInput('');
    setCallNameInput('');
    setBirthYearInput('');
    setDeathYearInput('');
    setCityInput('');
    setIsDeceasedInput(false);
    setPhotoUrlInput('');
    setPhotoCompressionInfo(null);
    setGenderInput('L');
    setNotesInput('');
    setFormSpouses([]);
    const currentChildren = activeTrah.members.filter((m) => m.parentId === parent.id);
    setOrderIndexInput(currentChildren.length + 1);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (m: FamilyMember) => {
    const editPerm = canEditTrahMember(activeTrah, m, accountScope.email, accountScope.isOwner);
    if (!editPerm.ok) {
      showNotification(editPerm.reason || 'Profil ini terkunci.');
      return;
    }
    setFormMode('edit');
    setFormParentId(m.parentId || null);
    setFormMemberId(m.id);
    setNameInput(m.name);
    setCallNameInput(m.callName || '');
    setBirthYearInput(m.birthYear || '');
    setDeathYearInput(m.deathYear || '');
    setCityInput(m.city || '');
    setIsDeceasedInput(m.isDeceased);
    setPhotoUrlInput(m.photoUrl || '');
    setPhotoCompressionInfo(null);
    setGenderInput(m.gender);
    setNotesInput(m.notes || '');
    setOrderIndexInput(m.orderIndex || 1);
    setFormSpouses(m.spouses ? [...m.spouses] : []);
    setIsFormModalOpen(true);
  };

  const handlePhotoUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Pilih file gambar (JPG, PNG, WebP)!');
      return;
    }

    try {
      setIsCompressingPhoto(true);
      const res = await compressImageFile(file, 400, 0.82);
      setPhotoUrlInput(res.dataUrl);
      setPhotoCompressionInfo({ orig: res.originalSizeKb, comp: res.compressedSizeKb });
      showNotification(`Foto berhasil dikompres otomatis: ${res.originalSizeKb} KB ➔ ${res.compressedSizeKb} KB ⚡`);
    } catch (err: any) {
      console.error(err);
      showNotification('Gagal memproses foto: ' + (err.message || 'Error'));
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrlInput('');
    setPhotoCompressionInfo(null);
    showNotification('Foto dihapus (akan menggunakan inisial nama).');
  };

  const handleAddFormSpouse = () => {
    const nextOrder = formSpouses.length + 1;
    const newSpouse: SpouseInfo = {
      id: `sp_${Date.now()}_${nextOrder}`,
      name: '',
      orderIndex: nextOrder,
      status: 'menikah',
      notes: ''
    };
    setFormSpouses([...formSpouses, newSpouse]);
  };

  const handleUpdateFormSpouse = (index: number, field: keyof SpouseInfo, val: any) => {
    setFormSpouses((prev) =>
      prev.map((sp, idx) => (idx === index ? { ...sp, [field]: val } : sp))
    );
  };

  const handleRemoveFormSpouse = (index: number) => {
    setFormSpouses((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((sp, idx) => ({ ...sp, orderIndex: idx + 1 }))
    );
  };

  const flushTrahListToStorage = (nextList: TrahCategory[]) => {
    try {
      localStorage.setItem(activeTrahStorageKey, JSON.stringify(nextList));
      if (accountScope.isOwner) {
        localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(nextList));
      }
    } catch (err) {
      console.warn('Storage sync err:', err);
    }
  };

  const propagateCoreMemberEdit = (
    editedMember: FamilyMember | undefined,
    baseTrahList: TrahCategory[]
  ): TrahCategory[] => {
    if (!editedMember?.coreRefId) return baseTrahList;
    const { updatedHub, changed } = applyMemberEditToHub(nuclearHub, editedMember);
    if (!changed) return baseTrahList;
    setNuclearHub(updatedHub);
    saveNuclearFamilyHub(accountScope.scopeKey, updatedHub);
    const { updatedTrahList, syncedTrahCount } = syncHubAcrossTrahList(
      baseTrahList,
      updatedHub,
      accountScope.email,
      accountScope.isOwner
    );
    if (syncedTrahCount > 1) {
      showNotification(
        `Perubahan "${editedMember.name}" otomatis disinkronkan ke ${syncedTrahCount} Trah tertaut! 🔗`
      );
    }
    return updatedTrahList;
  };

  const handleSaveAndSyncNuclearHubAll = (nextHub: NuclearFamilyHubData) => {
    setNuclearHub(nextHub);
    saveNuclearFamilyHub(accountScope.scopeKey, nextHub);
    const { updatedTrahList } = syncHubAcrossTrahList(
      trahList,
      nextHub,
      accountScope.email,
      accountScope.isOwner
    );

    const nowIso = new Date().toISOString();
    const adminSyncedTrahs: TrahCategory[] = [];
    let memberProposalCount = 0;

    const nextList = trahList.map((origTrah) => {
      const candidate = updatedTrahList.find((x) => x.id === origTrah.id) || origTrah;
      if (JSON.stringify(candidate.members) === JSON.stringify(origTrah.members)) {
        return origTrah;
      }

      if (!canManageTrahAdmin(origTrah, accountScope.email, accountScope.isOwner)) {
        const origById = new Map(origTrah.members.map((m) => [m.id, m]));
        const changedMembers = candidate.members.filter(
          (m) => JSON.stringify(origById.get(m.id)) !== JSON.stringify(m)
        );
        if (changedMembers.length > 0) {
          memberProposalCount++;
          void stageMemberChangeProposal({
            trah: origTrah,
            actionType: 'hub_graft',
            targetName: nextHub.self.name,
            summary: `Ajukan sinkron Keluarga Inti (${changedMembers.length} anggota)`,
            operations: [{ op: 'upsert_members', members: changedMembers }],
          });
        }
        return origTrah;
      }

      const bumped: TrahCategory = {
        ...candidate,
        members: normalizeTrahMembers(candidate.members, false).members,
        dataVersion: Math.max(1, origTrah.dataVersion || 1) + 1,
        lastApprovedAt: nowIso,
        lastApprovedBy: actorDisplayName,
        lastSyncedAt: nowIso,
      };
      adminSyncedTrahs.push(bumped);
      return bumped;
    });

    setTrahList(nextList);
    flushTrahListToStorage(nextList);

    if (adminSyncedTrahs.length > 0) {
      appendActivityLog({
        trahId: activeTrah.id || 'all',
        trahName: activeTrah.name || 'Semua Trah',
        actionType: 'member_update',
        targetName: nextHub.self.name,
        summary: `Menyinkronkan Hub Keluarga Inti ke ${adminSyncedTrahs.length} Trah`,
        details: `${nextHub.children.length} anak • ${nextHub.spouses.length} pasangan`,
      });
      for (const releasedTrah of adminSyncedTrahs) {
        void releaseApprovedTrahUpdate(
          releasedTrah,
          `Sinkron Hub Keluarga Inti (${nextHub.self.name})`
        );
      }
    }

    if (adminSyncedTrahs.length > 0 && memberProposalCount > 0) {
      showNotification(
        `Hub disinkronkan ke ${adminSyncedTrahs.length} Trah Admin & diajukan ke ${memberProposalCount} Trah lain (menunggu Approve)!`
      );
    } else if (adminSyncedTrahs.length > 0) {
      showNotification(
        `Hub Keluarga Inti disimpan & disinkronkan ke ${adminSyncedTrahs.length} Trah sekaligus! ✨`
      );
    } else if (memberProposalCount > 0) {
      showNotification(
        `Data Keluarga Inti disimpan & ${memberProposalCount} ajuan sinkron menunggu Approve Admin.`
      );
    } else {
      showNotification(
        'Data Keluarga Inti tersimpan! Pilih "Tempel ke Trah" untuk menyambungkan ke silsilah manapun.'
      );
    }
  };

  const handleGraftNuclearHubToSingleTrah = (
    nextHub: NuclearFamilyHubData,
    trahId: string,
    parentMemberId: string | null,
    attachMode: 'self_branch' | 'spouse_branch'
  ) => {
    const targetTrah = trahList.find((t) => t.id === trahId);
    if (!targetTrah) return;
    if (getEffectiveTrahRole(targetTrah, accountScope.email, accountScope.isOwner) === 'viewer') {
      showNotification('Akses Anda di Trah ini adalah "Lihat Saja".');
      return;
    }

    setNuclearHub(nextHub);
    saveNuclearFamilyHub(accountScope.scopeKey, nextHub);

    const { updatedTrah } = graftNuclearFamilyToTrah(targetTrah, nextHub, {
      parentMemberId,
      attachMode,
      ownerEmail: accountScope.email,
      ownerName: accountProfile.displayName || accountProfile.fullName,
    });
    const normalizedMembers = normalizeTrahMembers(updatedTrah.members, false).members;

    if (!canManageTrahAdmin(targetTrah, accountScope.email, accountScope.isOwner)) {
      const origById = new Map(targetTrah.members.map((m) => [m.id, m]));
      const deltaMembers = normalizedMembers.filter(
        (m) => JSON.stringify(origById.get(m.id)) !== JSON.stringify(m)
      );
      void stageMemberChangeProposal({
        trah: targetTrah,
        actionType: 'hub_graft',
        targetName: nextHub.self.name,
        summary: `Ajukan tempel Keluarga Inti (${attachMode === 'spouse_branch' ? 'Jalur Pasangan' : 'Jalur Saya'}) ke ${targetTrah.name}`,
        details: `${deltaMembers.length} anggota silsilah`,
        operations: [{ op: 'upsert_members', members: deltaMembers }],
      });
      setActiveTrahId(trahId);
      return;
    }

    const nowIso = new Date().toISOString();
    const approvedTarget: TrahCategory = {
      ...updatedTrah,
      members: normalizedMembers,
      dataVersion: Math.max(1, targetTrah.dataVersion || 1) + 1,
      lastApprovedAt: nowIso,
      lastApprovedBy: actorDisplayName,
      lastSyncedAt: nowIso,
    };
    const finalList = trahList.map((t) => (t.id === trahId ? approvedTarget : t));
    setTrahList(finalList);
    flushTrahListToStorage(finalList);
    setActiveTrahId(trahId);

    const summary = `Menempelkan Hub Keluarga Inti (${attachMode === 'spouse_branch' ? 'Jalur Pasangan' : 'Jalur Saya'}) ke ${targetTrah.name}`;
    appendActivityLog({
      trahId,
      trahName: targetTrah.name,
      actionType: 'member_add',
      targetName: nextHub.self.name,
      summary,
      details: `${nextHub.children.length} anak ikut tertempel & tersinkron otomatis.`,
    });
    void releaseApprovedTrahUpdate(approvedTarget, summary);
    showNotification(
      `Keluarga Inti berhasil ditempel & disinkronkan ke "${targetTrah.name}"! 🔗✨`
    );
  };

  const handleQuickToggleMemberGender = (member: FamilyMember) => {
    const editPerm = canEditTrahMember(activeTrah, member, accountScope.email, accountScope.isOwner);
    if (!editPerm.ok) {
      showNotification(editPerm.reason || 'Profil ini terkunci.');
      return;
    }
    const nextGender: 'L' | 'P' = member.gender === 'P' ? 'L' : 'P';
    const updatedMemberObj: FamilyMember = { ...member, gender: nextGender };

    if (!canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner)) {
      void stageMemberChangeProposal({
        trah: activeTrah,
        actionType: 'member_update',
        targetName: member.name,
        summary: `Ajukan ubah gender "${member.name}" ke ${nextGender === 'P' ? 'Wanita (P)' : 'Pria (L)'}`,
        operations: [{ op: 'upsert_member', member: updatedMemberObj }],
      });
      return;
    }

    const nowIso = new Date().toISOString();
    let updatedTarget: FamilyMember | undefined = updatedMemberObj;
    const nextList = trahList.map((t) => {
      if (t.id !== activeTrah.id) return t;
      return {
        ...t,
        dataVersion: Math.max(1, t.dataVersion || 1) + 1,
        lastApprovedAt: nowIso,
        lastApprovedBy: actorDisplayName,
        lastSyncedAt: nowIso,
        members: t.members.map((m) => (m.id === member.id ? updatedMemberObj : m)),
      };
    });
    const finalList = propagateCoreMemberEdit(updatedTarget, nextList);
    setTrahList(finalList);
    flushTrahListToStorage(finalList);
    if (selectedMember?.id === member.id) {
      setSelectedMember(updatedMemberObj);
    }
    if (formMemberId === member.id) {
      setGenderInput(nextGender);
    }
    if (isQuickBatchOpen && quickBatchMode === 'replace' && member.parentId === quickParentId) {
      const updatedParentChildren = (
        finalList.find((t) => t.id === activeTrah.id)?.members || []
      )
        .filter((m) => m.parentId === quickParentId)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setQuickCommaInput(
        updatedParentChildren
          .map((c) => `${c.name} (${c.gender === 'P' ? 'P' : 'L'})`)
          .join(', ')
      );
    }
    const summary = `Mengubah gender "${member.name}" menjadi ${nextGender === 'P' ? 'Wanita (P)' : 'Pria (L)'}`;
    appendActivityLog({
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      actionType: 'member_update',
      targetName: member.name,
      summary,
    });
    const approvedTrah = finalList.find((t) => t.id === activeTrah.id);
    if (approvedTrah) void releaseApprovedTrahUpdate(approvedTrah, summary);
    showNotification(
      `Gender "${member.name}" disimpan sebagai ${nextGender === 'P' ? '👩 Perempuan' : '👨 Laki-laki'} & disinkronkan ke Grid/Buku.`
    );
  };

  const handleMoveSiblingOrder = (memberId: string, direction: 'up' | 'down') => {
    const targetMember = activeTrah.members.find((m) => m.id === memberId);
    if (!targetMember) return;
    const editPerm = canEditTrahMember(
      activeTrah,
      targetMember,
      accountScope.email,
      accountScope.isOwner
    );
    if (!editPerm.ok) {
      showNotification(editPerm.reason || 'Urutan profil ini terkunci.');
      return;
    }
    const parentKey = targetMember.parentId || null;
    const parentObj = parentKey
      ? activeTrah.members.find((m) => m.id === parentKey)
      : null;

    const siblings = activeTrah.members
      .filter((m) => (m.parentId || null) === parentKey)
      .sort(
        (a, b) =>
          (a.orderIndex || 0) - (b.orderIndex || 0) ||
          a.name.localeCompare(b.name)
      );

    const curIdx = siblings.findIndex((s) => s.id === memberId);
    const swapIdx = direction === 'up' ? curIdx - 1 : curIdx + 1;
    if (curIdx === -1 || swapIdx < 0 || swapIdx >= siblings.length) return;

    const swappedWith = siblings[swapIdx];
    const reorderedSiblings = [...siblings];
    reorderedSiblings[curIdx] = swappedWith;
    reorderedSiblings[swapIdx] = targetMember;

    const newOrderById = new Map<string, number>();
    reorderedSiblings.forEach((s, idx) => newOrderById.set(s.id, idx + 1));

    const updatedSiblingsList = reorderedSiblings.map((m) => {
      const nextOrder = newOrderById.get(m.id) || m.orderIndex;
      const nextNotes =
        parentObj && m.notes && /^Anak ke-\d+ dari /.test(m.notes)
          ? `Anak ke-${nextOrder} dari ${parentObj.name}`
          : m.notes;
      return { ...m, orderIndex: nextOrder, notes: nextNotes };
    });

    const newPos = newOrderById.get(memberId) || 1;
    const descCount = getDescendantIds(memberId, activeTrah.members).size;

    if (!canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner)) {
      void stageMemberChangeProposal({
        trah: activeTrah,
        actionType: 'member_update',
        targetName: targetMember.name,
        summary: `Ajukan ubah urutan "${targetMember.name}" menjadi Anak ke-${newPos}`,
        operations: [{ op: 'upsert_members', members: updatedSiblingsList }],
      });
      return;
    }

    const nowIso = new Date().toISOString();
    let updatedSelected: FamilyMember | undefined;
    let approvedTrahRef: TrahCategory | null = null;
    const updatedMap = new Map(updatedSiblingsList.map((m) => [m.id, m]));
    const nextList = trahList.map((t) => {
      if (t.id !== activeTrah.id) return t;
      const nextTrah: TrahCategory = {
        ...t,
        dataVersion: Math.max(1, t.dataVersion || 1) + 1,
        lastApprovedAt: nowIso,
        lastApprovedBy: actorDisplayName,
        lastSyncedAt: nowIso,
        members: t.members.map((m) => {
          const nextMember = updatedMap.get(m.id);
          if (!nextMember) return m;
          if (selectedMember?.id === m.id) {
            updatedSelected = nextMember;
          }
          return nextMember;
        }),
      };
      approvedTrahRef = nextTrah;
      return nextTrah;
    });

    setTrahList(nextList);
    flushTrahListToStorage(nextList);
    if (updatedSelected) {
      setSelectedMember(updatedSelected);
    }
    if (formMemberId === memberId) {
      setOrderIndexInput(newPos);
    }
    if (
      isQuickBatchOpen &&
      quickBatchMode === 'replace' &&
      (targetMember.parentId || '') === quickParentId
    ) {
      setQuickCommaInput(
        reorderedSiblings
          .map((c) => `${c.name} (${c.gender === 'P' ? 'P' : 'L'})`)
          .join(', ')
      );
    }

    const summary = `Mengubah urutan "${targetMember.name}" menjadi Anak ke-${newPos}`;
    appendActivityLog({
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      actionType: 'member_update',
      targetName: targetMember.name,
      summary,
      details:
        descCount > 0
          ? `${descCount} keturunan otomatis ikut menyesuaikan posisi.`
          : undefined,
    });
    if (approvedTrahRef) void releaseApprovedTrahUpdate(approvedTrahRef, summary);
    showNotification(
      `"${targetMember.name}" kini urutan ke-${newPos}${
        descCount > 0 ? ` (${descCount} keturunannya otomatis ikut pindah!)` : ' ✨'
      }`
    );
  };

  const handleSyncMemberFromGrid = (
    memberId: string,
    patch: {
      name?: string;
      gender?: 'L' | 'P';
      isDeceased?: boolean;
      photoUrl?: string;
      birthYear?: string;
      deathYear?: string;
      city?: string;
    }
  ) => {
    const existing = activeTrah.members.find((m) => m.id === memberId);
    if (!existing) return;
    const editPerm = canEditTrahMember(activeTrah, existing, accountScope.email, accountScope.isOwner);
    if (!editPerm.ok) {
      showNotification(editPerm.reason || 'Profil ini terkunci.');
      return;
    }

    const syncedMemberObj: FamilyMember = {
      ...existing,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
      ...(patch.isDeceased !== undefined ? { isDeceased: patch.isDeceased } : {}),
      ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
      ...(patch.birthYear !== undefined ? { birthYear: patch.birthYear || undefined } : {}),
      ...(patch.deathYear !== undefined ? { deathYear: patch.deathYear || undefined } : {}),
      ...(patch.city !== undefined ? { city: patch.city || undefined } : {}),
    };

    if (!canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner)) {
      void stageMemberChangeProposal({
        trah: activeTrah,
        actionType: 'member_update',
        targetName: syncedMemberObj.name,
        summary: `Ajukan edit cepat Grid "${syncedMemberObj.name}"`,
        operations: [{ op: 'upsert_member', member: syncedMemberObj }],
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const nextList = trahList.map((t) => {
      if (t.id !== activeTrah.id) return t;
      return {
        ...t,
        dataVersion: Math.max(1, t.dataVersion || 1) + 1,
        lastApprovedAt: nowIso,
        lastApprovedBy: actorDisplayName,
        lastSyncedAt: nowIso,
        members: t.members.map((m) => (m.id === memberId ? syncedMemberObj : m)),
      };
    });
    const finalList = propagateCoreMemberEdit(syncedMemberObj, nextList);
    setTrahList(finalList);
    flushTrahListToStorage(finalList);
    if (selectedMember?.id === memberId) {
      setSelectedMember(syncedMemberObj);
    }
    const approvedTrah = finalList.find((t) => t.id === activeTrah.id);
    if (approvedTrah) {
      void releaseApprovedTrahUpdate(
        approvedTrah,
        `Memperbarui "${syncedMemberObj.name}" lewat Grid`
      );
    }
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      showNotification('Nama lengkap tidak boleh kosong!');
      return;
    }

    if (
      (formMode === 'add_root' || formMode === 'add_child') &&
      getEffectiveTrahRole(activeTrah, accountScope.email, accountScope.isOwner) === 'viewer'
    ) {
      showNotification('Akses Anda di Trah ini adalah "Lihat Saja".');
      return;
    }

    const isAdmin = canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner);
    const nowIso = new Date().toISOString();

    const cleanSpouses = formSpouses
      .filter((sp) => sp.name.trim().length > 0)
      .map((sp, idx) => ({ ...sp, orderIndex: idx + 1 }));

    if (formMode === 'add_root') {
      const newMember: FamilyMember = {
        id: `m_${Date.now()}`,
        name: nameInput.trim(),
        callName: callNameInput.trim() || undefined,
        birthYear: birthYearInput.trim() || undefined,
        deathYear: isDeceasedInput ? deathYearInput.trim() || undefined : undefined,
        city: cityInput.trim() || undefined,
        isDeceased: isDeceasedInput,
        photoUrl: photoUrlInput.trim() || undefined,
        gender: genderInput,
        notes: notesInput.trim() || undefined,
        parentId: null,
        generationLevel: 0,
        orderIndex: orderIndexInput || 1,
        spouses: cleanSpouses
      };

      if (!isAdmin) {
        void stageMemberChangeProposal({
          trah: activeTrah,
          actionType: 'member_add',
          targetName: newMember.name,
          summary: `Ajukan Leluhur Utama "${newMember.name}"`,
          operations: [{ op: 'upsert_member', member: newMember }],
        });
        setIsFormModalOpen(false);
        return;
      }

      let approvedRef: TrahCategory | null = null;
      const nextList = trahList.map((t) => {
        if (t.id !== activeTrah.id) return t;
        const nextTrah: TrahCategory = {
          ...t,
          members: [newMember, ...t.members],
          dataVersion: Math.max(1, t.dataVersion || 1) + 1,
          lastApprovedAt: nowIso,
          lastApprovedBy: actorDisplayName,
          lastSyncedAt: nowIso,
        };
        approvedRef = nextTrah;
        return nextTrah;
      });
      setTrahList(nextList);
      flushTrahListToStorage(nextList);
      showNotification(`Uyut / Leluhur Utama "${newMember.name}" berhasil ditambahkan.`);
      appendActivityLog({
        trahId: activeTrah.id,
        trahName: activeTrah.name,
        actionType: 'member_add',
        targetName: newMember.name,
        summary: `Menambah Leluhur Utama "${newMember.name}"`,
      });
      if (approvedRef) void releaseApprovedTrahUpdate(approvedRef, `Menambah "${newMember.name}"`);
    } else if (formMode === 'add_child') {
      const parent = activeTrah.members.find((m) => m.id === formParentId);
      const parentGen = parent ? parent.generationLevel : 0;

      const newMember: FamilyMember = {
        id: `m_${Date.now()}`,
        name: nameInput.trim(),
        callName: callNameInput.trim() || undefined,
        birthYear: birthYearInput.trim() || undefined,
        deathYear: isDeceasedInput ? deathYearInput.trim() || undefined : undefined,
        city: cityInput.trim() || undefined,
        isDeceased: isDeceasedInput,
        photoUrl: photoUrlInput.trim() || undefined,
        gender: genderInput,
        notes: notesInput.trim() || undefined,
        parentId: formParentId,
        generationLevel: parentGen + 1,
        orderIndex: orderIndexInput || 1,
        spouses: cleanSpouses
      };

      const summary = `Menambah anggota "${newMember.name}"${parent ? ` (anak dari ${parent.name})` : ''}`;

      if (!isAdmin) {
        void stageMemberChangeProposal({
          trah: activeTrah,
          actionType: 'member_add',
          targetName: newMember.name,
          summary,
          operations: [{ op: 'upsert_member', member: newMember }],
        });
        setIsFormModalOpen(false);
        return;
      }

      let approvedRef: TrahCategory | null = null;
      const nextList = trahList.map((t) => {
        if (t.id !== activeTrah.id) return t;
        const nextTrah: TrahCategory = {
          ...t,
          members: [...t.members, newMember],
          dataVersion: Math.max(1, t.dataVersion || 1) + 1,
          lastApprovedAt: nowIso,
          lastApprovedBy: actorDisplayName,
          lastSyncedAt: nowIso,
        };
        approvedRef = nextTrah;
        return nextTrah;
      });
      setTrahList(nextList);
      flushTrahListToStorage(nextList);
      showNotification(`Anak/Keturunan "${newMember.name}" berhasil ditambahkan.`);
      appendActivityLog({
        trahId: activeTrah.id,
        trahName: activeTrah.name,
        actionType: 'member_add',
        targetName: newMember.name,
        summary,
      });
      if (approvedRef) void releaseApprovedTrahUpdate(approvedRef, summary);
    } else if (formMode === 'edit') {
      const targetBefore = activeTrah.members.find((m) => m.id === formMemberId);
      if (targetBefore) {
        const editPerm = canEditTrahMember(
          activeTrah,
          targetBefore,
          accountScope.email,
          accountScope.isOwner
        );
        if (!editPerm.ok) {
          showNotification(editPerm.reason || 'Profil ini terkunci.');
          return;
        }
      }

      const patchedMember: FamilyMember = {
        ...(targetBefore || {
          id: formMemberId || `m_${Date.now()}`,
          generationLevel: 0,
        }),
        name: nameInput.trim(),
        callName: callNameInput.trim() || undefined,
        birthYear: birthYearInput.trim() || undefined,
        deathYear: isDeceasedInput ? deathYearInput.trim() || undefined : undefined,
        city: cityInput.trim() || undefined,
        isDeceased: isDeceasedInput,
        photoUrl: photoUrlInput.trim() || undefined,
        gender: genderInput,
        notes: notesInput.trim() || undefined,
        parentId: formParentId && formParentId !== formMemberId ? formParentId : null,
        orderIndex: Math.max(1, orderIndexInput || 1),
        spouses: cleanSpouses,
      };

      const editSummary = `Memperbarui biodata / gender (${genderInput === 'P' ? 'Wanita' : 'Pria'}) / nasab "${nameInput.trim()}"`;

      if (!isAdmin) {
        void stageMemberChangeProposal({
          trah: activeTrah,
          actionType: 'member_update',
          targetName: nameInput.trim(),
          summary: editSummary,
          details: cleanSpouses.length > 0 ? `${cleanSpouses.length} pasangan tercatat` : undefined,
          operations: [{ op: 'upsert_member', member: patchedMember }],
        });
        setIsFormModalOpen(false);
        return;
      }

      const isSanta =
        activeTrah.id === 'trah-ayah-user' ||
        activeTrah.name.toUpperCase().includes('SANTA');

      let updatedTargetMember: FamilyMember | undefined;
      const nextList = trahList.map((t) => {
        if (t.id !== activeTrah.id) return t;
        const updatedMembers = t.members.map((m) =>
          m.id === formMemberId ? patchedMember : m
        );
        const normalizedMembers = normalizeTrahMembers(updatedMembers, isSanta).members;
        updatedTargetMember = normalizedMembers.find((m) => m.id === formMemberId);
        return {
          ...t,
          members: normalizedMembers,
          dataVersion: Math.max(1, t.dataVersion || 1) + 1,
          lastApprovedAt: nowIso,
          lastApprovedBy: actorDisplayName,
          lastSyncedAt: nowIso,
        };
      });

      const finalList = propagateCoreMemberEdit(updatedTargetMember, nextList);
      setTrahList(finalList);
      flushTrahListToStorage(finalList);
      if (updatedTargetMember && selectedMember?.id === formMemberId) {
        setSelectedMember(updatedTargetMember);
      }

      showNotification(
        `Data "${nameInput.trim()}" (${genderInput === 'P' ? 'Wanita' : 'Pria'}) tersimpan & terintegrasi ke seluruh tampilan.`
      );
      appendActivityLog({
        trahId: activeTrah.id,
        trahName: activeTrah.name,
        actionType: 'member_update',
        targetName: nameInput.trim(),
        summary: editSummary,
        details: cleanSpouses.length > 0 ? `${cleanSpouses.length} pasangan tercatat` : undefined,
      });
      const approvedTrah = finalList.find((t) => t.id === activeTrah.id);
      if (approvedTrah) void releaseApprovedTrahUpdate(approvedTrah, editSummary);
    }

    setIsFormModalOpen(false);
  };

  const handleRepairActiveTrahLineage = () => {
    if (!canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner)) {
      showNotification('Hanya Pengurus Trah yang berhak menjalankan perbaikan garis nasab.');
      return;
    }
    const isSanta =
      activeTrah.id === 'trah-ayah-user' ||
      activeTrah.name.toUpperCase().includes('SANTA');
    const { members: normalized, repairedCount } = normalizeTrahMembers(activeTrah.members, isSanta);

    const nowIso = new Date().toISOString();
    let approvedRef: TrahCategory | null = null;
    const nextList = trahList.map((t) => {
      if (t.id !== activeTrah.id) return t;
      const nextTrah: TrahCategory = {
        ...t,
        members: normalized,
        dataVersion: repairedCount > 0 ? Math.max(1, t.dataVersion || 1) + 1 : t.dataVersion || 1,
        lastApprovedAt: repairedCount > 0 ? nowIso : t.lastApprovedAt,
        lastApprovedBy: repairedCount > 0 ? actorDisplayName : t.lastApprovedBy,
        lastSyncedAt: nowIso,
      };
      approvedRef = nextTrah;
      return nextTrah;
    });
    setTrahList(nextList);
    flushTrahListToStorage(nextList);

    if (repairedCount > 0) {
      const summary = `Merapikan & menyambungkan ${repairedCount} tautan garis nasab`;
      appendActivityLog({
        trahId: activeTrah.id,
        trahName: activeTrah.name,
        actionType: 'member_update',
        summary,
      });
      if (approvedRef) void releaseApprovedTrahUpdate(approvedRef, summary);
      showNotification(`Berhasil merapikan & menyambungkan ${repairedCount} tautan garis nasab pada ${activeTrah.name}! ✨`);
    } else {
      showNotification(`Susunan garis nasab ${activeTrah.name} sudah rapi & sinkron.`);
    }
  };

  const handleDeleteMember = (member: FamilyMember) => {
    const delPerm = canDeleteTrahMember(
      activeTrah,
      member,
      activeTrah.members,
      accountScope.email,
      accountScope.isOwner
    );
    if (!delPerm.ok) {
      showNotification(delPerm.reason || 'Anggota ini tidak dapat dihapus.');
      return;
    }

    const toDeleteIds = new Set<string>();
    const collectDescendants = (id: string) => {
      toDeleteIds.add(id);
      activeTrah.members
        .filter((m) => m.parentId === id)
        .forEach((child) => collectDescendants(child.id));
    };
    collectDescendants(member.id);

    const isAdmin = canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner);
    // Lindungi node ter-klaim di dalam cabang agar non-owner tidak menghapusnya tanpa sadar
    if (!isAdmin) {
      const claimedDesc = activeTrah.members.find(
        (m) =>
          toDeleteIds.has(m.id) &&
          m.claimedByEmail &&
          m.claimedByEmail.toLowerCase() !== accountScope.email.toLowerCase()
      );
      if (claimedDesc) {
        showNotification(
          `Cabang ini memuat profil ter-klaim "${claimedDesc.name}". Hanya Pengurus Trah yang dapat menghapusnya.`
        );
        return;
      }

      if (
        !window.confirm(
          `Ajukan penghapusan "${member.name}" beserta cabang (${toDeleteIds.size} anggota) ke Pengurus/Admin Trah?`
        )
      ) {
        return;
      }

      void stageMemberChangeProposal({
        trah: activeTrah,
        actionType: 'member_delete',
        targetName: member.name,
        summary: `Ajukan hapus "${member.name}" (${toDeleteIds.size} anggota)`,
        operations: [{ op: 'delete_members', memberIds: Array.from(toDeleteIds) }],
      });
      if (selectedMember?.id === member.id) {
        setIsDetailModalOpen(false);
        setSelectedMember(null);
      }
      return;
    }

    if (
      !window.confirm(
        `Yakin ingin menghapus "${member.name}" beserta seluruh cabang keturunannya (${toDeleteIds.size} anggota) dari silsilah? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    const nowIso = new Date().toISOString();
    let approvedRef: TrahCategory | null = null;
    const nextList = trahList.map((t) => {
      if (t.id !== activeTrah.id) return t;
      const nextTrah: TrahCategory = {
        ...t,
        members: t.members.filter((m) => !toDeleteIds.has(m.id)),
        dataVersion: Math.max(1, t.dataVersion || 1) + 1,
        lastApprovedAt: nowIso,
        lastApprovedBy: actorDisplayName,
        lastSyncedAt: nowIso,
      };
      approvedRef = nextTrah;
      return nextTrah;
    });
    setTrahList(nextList);
    flushTrahListToStorage(nextList);

    if (selectedMember?.id === member.id) {
      setIsDetailModalOpen(false);
      setSelectedMember(null);
    }

    const delSummary = `Menghapus "${member.name}" beserta cabang (${toDeleteIds.size} anggota)`;
    appendActivityLog({
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      actionType: 'member_delete',
      targetName: member.name,
      summary: delSummary,
    });
    if (approvedRef) void releaseApprovedTrahUpdate(approvedRef, delSummary);

    showNotification(`${toDeleteIds.size} anggota silsilah berhasil dihapus.`);
  };

  const handleSaveTrah = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTrahName.trim()) {
      showNotification('Nama trah harus diisi!');
      return;
    }

    const nowTs = Date.now();
    const formattedTrahName = newTrahName.trim().toUpperCase();
    const descText = newTrahDesc.trim() || 'Keluarga Besar Silsilah Trah';
    const rootNameTrim = newTrahRootName.trim();
    const parsedChildren = parseCommaChildren(newTrahChildrenInput);
    const hasInitialTree = rootNameTrim.length > 0 || parsedChildren.length > 0;

    const initialMembers: FamilyMember[] = [];
    if (hasInitialTree) {
      const rootId = `m_${nowTs}_0`;
      const spouseNameTrim = newTrahRootSpouse.trim();
      const rootMember: FamilyMember = {
        id: rootId,
        name: rootNameTrim || `Leluhur ${formattedTrahName}`,
        callName: rootNameTrim ? undefined : formattedTrahName,
        isDeceased: newTrahRootDeceased,
        gender: newTrahRootGender,
        parentId: null,
        generationLevel: 0,
        orderIndex: 1,
        notes: `Leluhur Utama ${formattedTrahName}`,
        spouses: spouseNameTrim
          ? [
              {
                id: `sp_${nowTs}_0`,
                name: spouseNameTrim,
                orderIndex: 1,
                status: 'menikah',
              },
            ]
          : [],
      };
      initialMembers.push(rootMember);

      parsedChildren.forEach((child, idx) => {
        initialMembers.push({
          id: `m_${nowTs}_${idx + 1}`,
          name: child.name,
          isDeceased: false,
          gender: child.gender,
          parentId: rootId,
          generationLevel: 1,
          orderIndex: child.orderIndex,
          spouses: [],
        });
      });
    }

    const nowIso = new Date().toISOString();
    const newTrah: TrahCategory = {
      id: `trah_${nowTs}`,
      name: formattedTrahName,
      description: descText,
      lineageSide: newTrahLineage,
      members: initialMembers,
      creatorEmail: accountScope.email || accountProfile.email || undefined,
      userRole: 'admin',
      dataVersion: 1,
      lastApprovedAt: nowIso,
      lastApprovedBy: actorDisplayName,
      lastSyncedAt: nowIso,
      invitePolicy: { version: 1, role: 'member', expiryHours: 168 },
    };

    const nextList = [...trahList, newTrah];
    setTrahList(nextList);
    flushTrahListToStorage(nextList);
    setActiveTrahId(newTrah.id);
    void releaseApprovedTrahUpdate(
      newTrah,
      `Membuat Trah "${newTrah.name}" (${initialMembers.length} anggota)`
    );

    if (newTrahCreateIntroPost) {
      const introLines = [
        `🌳 Trah baru "${newTrah.name}" resmi dibuat di LeluhurQu.`,
        descText !== 'Keluarga Besar Silsilah Trah' ? `Catatan: ${descText}` : '',
        initialMembers.length > 0
          ? `Tercatat ${initialMembers.length} anggota awal (${initialMembers[0].name}${parsedChildren.length > 0 ? ` + ${parsedChildren.length} keturunan langsung` : ''}).`
          : 'Silakan lengkapi silsilah anggota melalui Grid atau Tabel Excel.',
      ].filter(Boolean);

      const introPost: TrahPost = {
        id: `post_trah_${nowTs}`,
        trahId: newTrah.id,
        trahName: newTrah.name,
        lineageSide: newTrahLineage,
        authorName: accountProfile.displayName || accountProfile.fullName || 'Anggota Keluarga',
        authorKinship: `${accountProfile.kinshipRole ? accountProfile.kinshipRole + ' • ' : ''}Pendiri ${newTrah.name}`,
        authorAvatar: accountProfile.avatarUrl || undefined,
        content: introLines.join('\n'),
        category: 'silaturahmi',
        likesCount: 1,
        likedByMe: true,
        comments: [],
        timestamp: 'Baru saja',
      };
      setTrahPosts((prev) => [introPost, ...prev]);
    }

    const targetAfterSave = newTrahTargetView;
    if (targetAfterSave !== 'stay') {
      setViewMode(targetAfterSave);
      if (targetAfterSave === 'feed') {
        setFeedPillarFilter(newTrah.id);
      }
    }

    setIsAddTrahModalOpen(false);
    setNewTrahName('');
    setNewTrahDesc('');
    setNewTrahLineage('ayah_user');
    setNewTrahRootName('');
    setNewTrahRootGender('L');
    setNewTrahRootDeceased(false);
    setNewTrahRootSpouse('');
    setNewTrahChildrenInput('');
    setNewTrahCreateIntroPost(true);
    setNewTrahTargetView('grid');

    appendActivityLog({
      trahId: newTrah.id,
      trahName: newTrah.name,
      actionType: 'trah_create',
      targetName: newTrah.name,
      summary: `Membuat Trah modular baru "${newTrah.name}"`,
      details: `${initialMembers.length} anggota awal tercatat.`,
    });

    showNotification(
      initialMembers.length > 0
        ? `Trah "${newTrah.name}" (${initialMembers.length} anggota) tersimpan & tersambung ke Grid, Excel, Medsos & Buku PDF!`
        : `Trah "${newTrah.name}" tersimpan & tersambung ke semua submenu!`
    );
  };

  const handleSaveSpouseLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!spouseNameInput.trim()) {
      showNotification('Nama pasangan harus diisi!');
      return;
    }

    const sName = spouseNameInput.trim();
    const ayahName = spouseAyahNameInput.trim() || `Ayah Mertua (${sName})`;
    const ibuName = spouseIbuNameInput.trim() || `Ibu Mertua (${sName})`;

    // Cari apakah trah pasangan sudah ada atau perlu dibuat
    const existingAyahPasangan = trahList.find((t) => t.lineageSide === 'ayah_pasangan');
    const existingIbuPasangan = trahList.find((t) => t.lineageSide === 'ibu_pasangan');

    const nowBase = Date.now();
    let updatedList = [...trahList];
    let addedCount = 0;

    if (!existingAyahPasangan) {
      addedCount++;
      updatedList.push({
        id: `trah_ap_${nowBase}`,
        name: `TRAH AYAH PASANGAN (${ayahName})`,
        description: `Garis Silsilah Ayah Mertua dari ${sName}`,
        lineageSide: 'ayah_pasangan',
        linkedSpouseName: sName,
        creatorEmail: accountScope.email || undefined,
        userRole: 'admin',
        invitePolicy: { version: 1, role: 'member', expiryHours: 168 },
        members: [
          {
            id: `map_${nowBase}_1`,
            name: ayahName,
            callName: `Bapak Mertua (${ayahName.split(' ')[0]})`,
            gender: 'L',
            isDeceased: false,
            parentId: null,
            generationLevel: 0,
            orderIndex: 1,
            notes: `Ayah kandung dari ${sName}`,
          },
        ],
      });
    }

    if (!existingIbuPasangan) {
      addedCount++;
      updatedList.push({
        id: `trah_ip_${nowBase + 1}`,
        name: `TRAH IBU PASANGAN (${ibuName})`,
        description: `Garis Silsilah Ibu Mertua dari ${sName}`,
        lineageSide: 'ibu_pasangan',
        linkedSpouseName: sName,
        creatorEmail: accountScope.email || undefined,
        userRole: 'admin',
        invitePolicy: { version: 1, role: 'member', expiryHours: 168 },
        members: [
          {
            id: `mip_${nowBase}_2`,
            name: ibuName,
            callName: `Ibu Mertua (${ibuName.split(' ')[0]})`,
            gender: 'P',
            isDeceased: false,
            parentId: null,
            generationLevel: 0,
            orderIndex: 1,
            notes: `Ibunda kandung dari ${sName}`,
          },
        ],
      });
    }

    // Tambahan opsional 4 jalur Kakek/Nenek Pasangan (Total 8+ Pilar Trah)
    const grandparentSpecs: Array<{
      side: LineageSide;
      input: string;
      gender: 'L' | 'P';
      titlePrefix: string;
      desc: string;
    }> = [
      {
        side: 'kakek_ayah_pasangan',
        input: spouseKakekAyahInput,
        gender: 'L',
        titlePrefix: 'TRAH KAKEK AYAH PASANGAN',
        desc: `Kakek dari pihak Ayah ${sName}`,
      },
      {
        side: 'nenek_ayah_pasangan',
        input: spouseNenekAyahInput,
        gender: 'P',
        titlePrefix: 'TRAH NENEK AYAH PASANGAN',
        desc: `Nenek dari pihak Ayah ${sName}`,
      },
      {
        side: 'kakek_ibu_pasangan',
        input: spouseKakekIbuInput,
        gender: 'L',
        titlePrefix: 'TRAH KAKEK IBU PASANGAN',
        desc: `Kakek dari pihak Ibu ${sName}`,
      },
      {
        side: 'nenek_ibu_pasangan',
        input: spouseNenekIbuInput,
        gender: 'P',
        titlePrefix: 'TRAH NENEK IBU PASANGAN',
        desc: `Nenek dari pihak Ibu ${sName}`,
      },
    ];

    grandparentSpecs.forEach((spec, idx) => {
      const cleanName = spec.input.trim();
      if (!cleanName) return;
      if (updatedList.some((t) => t.lineageSide === spec.side)) return;
      addedCount++;
      updatedList.push({
        id: `trah_gp_${nowBase}_${idx + 3}`,
        name: `${spec.titlePrefix} (${cleanName})`,
        description: spec.desc,
        lineageSide: spec.side,
        linkedSpouseName: sName,
        creatorEmail: accountScope.email || undefined,
        userRole: 'admin',
        invitePolicy: { version: 1, role: 'member', expiryHours: 168 },
        members: [
          {
            id: `mgp_${nowBase}_${idx + 3}`,
            name: cleanName,
            gender: spec.gender,
            isDeceased: true,
            parentId: null,
            generationLevel: 0,
            orderIndex: 1,
            notes: spec.desc,
          },
        ],
      });
    });

    // Pastikan nama pasangan juga tercatat di Hub Keluarga Inti jika belum ada
    if (!nuclearHub.spouses.some((sp) => sp.name.trim().toLowerCase() === sName.toLowerCase())) {
      const nextHub: NuclearFamilyHubData = {
        ...nuclearHub,
        updatedAt: new Date().toISOString(),
        spouses: [
          ...nuclearHub.spouses,
          { id: `sp_${nowBase}`, name: sName, status: 'menikah' },
        ],
      };
      setNuclearHub(nextHub);
      saveNuclearFamilyHub(accountScope.scopeKey, nextHub);
    }

    setTrahList(updatedList);
    flushTrahListToStorage(updatedList);

    setIsSpouseModalOpen(false);
    setSpouseGrandparentsExpanded(false);
    setSpouseKakekAyahInput('');
    setSpouseNenekAyahInput('');
    setSpouseKakekIbuInput('');
    setSpouseNenekIbuInput('');
    showNotification(
      addedCount > 0
        ? `${updatedList.length} Pilar Trah aktif & terhubung dengan keluarga ${sName}! 💍✨`
        : `Trah pasangan ${sName} sudah terhubung (${updatedList.length} Trah).`
    );
  };

  // Handlers untuk Medsos TrahBook
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) {
      showNotification('Tuliskan kabar atau cerita keluarga terlebih dahulu!');
      return;
    }

    const currentLineage = activeTrah.lineageSide || 'ayah_user';
    const lineageMeta = getLineageBadgeMeta(currentLineage);
    const authorKinship =
      currentLineage === 'umum'
        ? `Keluarga ${activeTrah.name}`
        : `Keluarga ${lineageMeta.shortTag}`;

    const newPost: TrahPost = {
      id: `post_${Date.now()}`,
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      lineageSide: currentLineage,
      authorName: accountProfile.displayName || accountProfile.fullName || 'Anggota Keluarga',
      authorKinship: `${accountProfile.kinshipRole ? accountProfile.kinshipRole + ' • ' : ''}${authorKinship}`,
      authorAvatar: accountProfile.avatarUrl || undefined,
      content: newPostContent.trim(),
      imageUrl: newPostImageUrl.trim() || undefined,
      category: newPostCategory,
      likesCount: 1,
      likedByMe: true,
      comments: [],
      timestamp: 'Baru saja'
    };

    setTrahPosts([newPost, ...trahPosts]);
    setNewPostContent('');
    setNewPostImageUrl('');
    showNotification(`Kabar berhasil dibagikan di Medsos ${activeTrah.name}! 💬`);
  };

  const handleLikePost = (postId: string) => {
    setTrahPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const newLiked = !p.likedByMe;
        return {
          ...p,
          likedByMe: newLiked,
          likesCount: newLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
        };
      })
    );
  };

  const handleAddComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const newComment: TrahComment = {
      id: `c_${Date.now()}`,
      authorName: accountProfile.displayName || accountProfile.fullName || 'Anggota Keluarga',
      authorKinship: accountProfile.kinshipRole || 'Keluarga',
      text,
      timestamp: 'Baru saja'
    };

    setTrahPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          comments: [...p.comments, newComment]
        };
      })
    );

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    showNotification('Komentar berhasil dikirim! 💬');
  };

  const handleMoveActiveTrahToAyah = () => {
    if (!canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner)) {
      showNotification('Hanya Pengurus Trah yang berhak memindahkan pilar Trah.');
      return;
    }
    const updated = trahList.map((t) => {
      if (t.id === activeTrah.id) {
        return {
          ...t,
          lineageSide: 'ayah_user' as LineageSide,
          name: t.name.includes('(Ayah)') ? t.name : `${t.name.split('(')[0].trim()} (Ayah)`
        };
      }
      if (t.id !== activeTrah.id && t.lineageSide === 'ayah_user' && !t.name.toUpperCase().includes('SANTA')) {
        return {
          ...t,
          lineageSide: 'umum' as LineageSide
        };
      }
      return t;
    });
    setTrahList(updated);
    try {
      localStorage.setItem(activeTrahStorageKey, JSON.stringify(updated));
    } catch (err) {
      console.warn(err);
    }
    appendActivityLog({
      trahId: activeTrah.id,
      trahName: activeTrah.name,
      actionType: 'trah_update',
      targetName: activeTrah.name,
      summary: `Memindahkan "${activeTrah.name}" ke Pilar Trah Ayah`,
    });
    showNotification(`Trah "${activeTrah.name}" berhasil dipindahkan ke Pilar Trah Ayah! 👨✨`);
  };

  const handleUpdateTrah = (
    trahId: string,
    updates: Partial<Pick<TrahCategory, 'name' | 'description' | 'lineageSide'>>
  ) => {
    const targetBefore = trahList.find((t) => t.id === trahId);
    if (targetBefore && !canManageTrahAdmin(targetBefore, accountScope.email, accountScope.isOwner)) {
      showNotification('Hanya Pengurus Trah yang berhak mengubah info Trah ini.');
      return;
    }
    const nowIso = new Date().toISOString();
    let updatedRef: TrahCategory | null = null;
    const nextList = trahList.map((t) => {
      if (t.id !== trahId) return t;
      const nextTrah: TrahCategory = {
        ...t,
        ...updates,
        dataVersion: Math.max(1, t.dataVersion || 1) + 1,
        lastApprovedAt: nowIso,
        lastApprovedBy: actorDisplayName,
        lastSyncedAt: nowIso,
      };
      updatedRef = nextTrah;
      return nextTrah;
    });
    setTrahList(nextList);
    flushTrahListToStorage(nextList);
    if (updates.name || updates.lineageSide) {
      setTrahPosts((prev) =>
        prev.map((p) =>
          p.trahId === trahId
            ? {
                ...p,
                trahName: updates.name ?? p.trahName,
                lineageSide: updates.lineageSide ?? p.lineageSide,
              }
            : p
        )
      );
    }
    if (targetBefore) {
      const summary = `Memperbarui info Trah "${updates.name ?? targetBefore.name}"`;
      appendActivityLog({
        trahId,
        trahName: updates.name ?? targetBefore.name,
        actionType: 'trah_update',
        targetName: updates.name ?? targetBefore.name,
        summary,
      });
      if (updatedRef) void releaseApprovedTrahUpdate(updatedRef, summary);
    }
  };

  const handleDeleteTrah = (trahId: string) => {
    const target = trahList.find((t) => t.id === trahId);
    const remaining = trahList.filter((t) => t.id !== trahId);
    setTrahList(remaining);
    if (activeTrahId === trahId) {
      setActiveTrahId(remaining[0]?.id || '');
    }
    if (feedPillarFilter === trahId) {
      setFeedPillarFilter('all');
    }
    if (target) {
      appendActivityLog({
        trahId,
        trahName: target.name,
        actionType: 'trah_delete',
        targetName: target.name,
        summary: `Menghapus Trah "${target.name}" (${target.members.length} anggota)`,
      });
    }
    showNotification(`Trah "${target?.name || ''}" berhasil dihapus.`);
  };

  const countSavedGridDesigns = useMemo(() => {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('leluhurqu_grid_designs_v2_')) {
          const parsed = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(parsed)) total += parsed.length;
        }
      }
    } catch {
      // abaikan
    }
    return total;
  }, [trahList, viewMode]);

  const handleExportFullBackupJSON = () => {
    const gridDesignsMap: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('leluhurqu_grid_')) {
          gridDesignsMap[key] = localStorage.getItem(key);
        }
      }
    } catch (err) {
      console.warn(err);
    }

    const payload = {
      app: 'LeluhurQu',
      version: 2,
      exportedAt: new Date().toISOString(),
      accountProfile,
      appPreferences,
      nuclearHub,
      trahList,
      trahPosts,
      activityLogs,
      gridDesignsMap,
    };

    const triggerJsonDownload = () => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStamp = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `LeluhurQu_Cadangan_${dateStamp}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      appendActivityLog({
        trahId: activeTrah.id || 'all',
        trahName: activeTrah.name || 'Semua Trah',
        actionType: 'backup',
        summary: `Mengekspor cadangan lengkap JSON (${trahList.length} Trah)`,
      });
      showNotification('File cadangan lengkap (.json) berhasil diunduh!');
    };

    const rule = MonetizationService.getRule('leluhurqu_export');
    if (rule.enabled && !MonetizationService.hasActiveUnlock('leluhurqu_export')) {
      setExportFeeModal({
        open: true,
        actionLabel: 'Download Cadangan Data Silsilah (.json)',
        onPaidCallback: triggerJsonDownload,
      });
      return;
    }
    triggerJsonDownload();
  };

  const handleImportFullBackupJSON = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.trahList) || parsed.trahList.length === 0) {
        showNotification('Format file cadangan tidak valid atau data Trah kosong.');
        return;
      }

      const normalizedImported = (parsed.trahList as TrahCategory[]).map((t) => {
        const isSanta =
          t.id === 'trah-ayah-user' ||
          t.id === 'trah-santa' ||
          (t.name || '').toUpperCase().includes('SANTA');
        return {
          ...t,
          members: normalizeTrahMembers(t.members || [], isSanta).members,
        };
      });

      setTrahList(normalizedImported);
      setActiveTrahId(normalizedImported[0].id);

      if (parsed.nuclearHub && typeof parsed.nuclearHub === 'object' && parsed.nuclearHub.self) {
        setNuclearHub(parsed.nuclearHub);
        saveNuclearFamilyHub(accountScope.scopeKey, parsed.nuclearHub);
      }
      if (Array.isArray(parsed.trahPosts)) {
        setTrahPosts(parsed.trahPosts);
      }
      if (Array.isArray(parsed.activityLogs)) {
        setActivityLogs(parsed.activityLogs);
      }
      if (parsed.accountProfile && typeof parsed.accountProfile === 'object') {
        setAccountProfile({ ...DEFAULT_ACCOUNT_PROFILE, ...parsed.accountProfile });
      }
      if (parsed.appPreferences && typeof parsed.appPreferences === 'object') {
        setAppPreferences({ ...DEFAULT_APP_PREFERENCES, ...parsed.appPreferences });
      }
      if (parsed.gridDesignsMap && typeof parsed.gridDesignsMap === 'object') {
        Object.entries(parsed.gridDesignsMap).forEach(([k, v]) => {
          if (k.startsWith('leluhurqu_grid_') && typeof v === 'string') {
            try {
              localStorage.setItem(k, v);
            } catch (e) {
              console.warn(e);
            }
          }
        });
      }

      appendActivityLog({
        trahId: normalizedImported[0].id,
        trahName: normalizedImported[0].name,
        actionType: 'backup',
        summary: `Memulihkan cadangan JSON (${parsed.trahList.length} Trah)`,
      });
      showNotification(`Berhasil memulihkan ${parsed.trahList.length} Trah dari file cadangan!`);
    } catch {
      showNotification('Gagal membaca file cadangan JSON. Pastikan file tidak rusak.');
    }
  };

  const handleExportCSV = () => {
    if (activeTrah.members.length === 0) {
      showNotification('Belum ada data untuk diekspor!');
      return;
    }

    const headers = [
      'No',
      'Tingkatan',
      'Nama Lengkap',
      'Nama Panggilan',
      'Gender',
      'Urutan Anak',
      'Garis Nasab Silsilah',
      'Orang Tua Langsung',
      'Pasangan / Istri (Status Cerai/Menikah)',
      'Daftar Anak (Koma)',
      'Tahun Lahir',
      'Tahun Wafat',
      'Status',
      'Catatan'
    ];

    const sortedForCsv = sortMembersHierarchically(activeTrah.members);
    const rows = sortedForCsv.map((m, idx) => {
      const parent = m.parentId ? activeTrah.members.find((p) => p.id === m.parentId) : null;
      const path = getAncestryPath(m, activeTrah.members);
      const nasabString = path.map((step) => `${getKinshipLabel(step.generationLevel)}: ${step.name}`).join(' ➔ ');
      const children = activeTrah.members
        .filter((c) => c.parentId === m.id)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      const childrenComma = children.map((c) => c.name).join(', ');

      const spousesString = (m.spouses || [])
        .map((sp) => `${sp.name} [Istri ke-${sp.orderIndex} • ${getSpouseStatusBadge(sp.status).label}]`)
        .join('; ');

      return [
        idx + 1,
        getKinshipLabel(m.generationLevel),
        `"${m.name.replace(/"/g, '""')}"`,
        `"${(m.callName || '').replace(/"/g, '""')}"`,
        m.gender === 'L' ? 'Laki-laki' : 'Perempuan',
        m.orderIndex ? `Anak ke-${m.orderIndex}` : '-',
        `"${nasabString.replace(/"/g, '""')}"`,
        `"${(parent ? parent.name : 'Uyut Utama').replace(/"/g, '""')}"`,
        `"${spousesString.replace(/"/g, '""')}"`,
        `"${childrenComma.replace(/"/g, '""')}"`,
        m.birthYear || '-',
        m.deathYear || '-',
        m.isDeceased ? 'Almarhum/Wafat' : 'Masih Hidup',
        `"${(m.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const triggerCsvDownload = () => {
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Silsilah_Excel_${activeTrah.name.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      appendActivityLog({
        trahId: activeTrah.id,
        trahName: activeTrah.name,
        actionType: 'backup',
        summary: `Mengekspor Excel CSV "${activeTrah.name}" (${activeTrah.members.length} anggota)`,
      });
      showNotification('File CSV Excel berhasil diunduh!');
    };

    const rule = MonetizationService.getRule('leluhurqu_export');
    if (rule.enabled && !MonetizationService.hasActiveUnlock('leluhurqu_export')) {
      setExportFeeModal({
        open: true,
        actionLabel: 'Download Silsilah Excel (.csv)',
        onPaidCallback: triggerCsvDownload,
      });
      return;
    }
    triggerCsvDownload();
  };

  const availableGenLevels = useMemo(() => {
    const levels = new Set<number>(activeTrah.members.map((m) => m.generationLevel ?? 0));
    return Array.from(levels).sort((a, b) => a - b);
  }, [activeTrah.members]);

  const excelParentOptions = useMemo(() => {
    const ordered = sortMembersHierarchically(activeTrah.members);
    return ordered
      .map((m) => ({
        member: m,
        childCount: activeTrah.members.filter((c) => c.parentId === m.id).length,
      }))
      .filter((item) => item.childCount > 0);
  }, [activeTrah.members]);

  const excelLineageHealth = useMemo(() => {
    const idSet = new Set(activeTrah.members.map((m) => m.id));
    const brokenParents = activeTrah.members.filter((m) => m.parentId && !idSet.has(m.parentId));
    const rootsCount = activeTrah.members.filter((m) => !m.parentId).length;
    return {
      brokenParents,
      rootsCount,
      needsAttention: brokenParents.length > 0 || (rootsCount > 1 && activeTrah.members.length > 1),
    };
  }, [activeTrah]);

  const excelFilteredMembers = useMemo(() => {
    const baseSorted =
      excelSortMode === 'tree'
        ? sortMembersHierarchically(activeTrah.members)
        : [...activeTrah.members].sort(
            (a, b) =>
              (a.generationLevel || 0) - (b.generationLevel || 0) ||
              (a.orderIndex || 0) - (b.orderIndex || 0)
          );

    return baseSorted.filter((m) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSpouse = (m.spouses || []).some((sp) => sp.name.toLowerCase().includes(q));
        const matchChildren = activeTrah.members.some(
          (c) => c.parentId === m.id && c.name.toLowerCase().includes(q)
        );
        const match =
          m.name.toLowerCase().includes(q) ||
          (m.callName && m.callName.toLowerCase().includes(q)) ||
          (m.notes && m.notes.toLowerCase().includes(q)) ||
          matchSpouse ||
          matchChildren;
        if (!match) return false;
      }
      if (excelGenFilter !== 'all') {
        if (m.generationLevel.toString() !== excelGenFilter) return false;
      }
      if (excelParentFilter !== 'all') {
        if (excelParentFilter === 'root' && m.parentId !== null) return false;
        if (excelParentFilter !== 'root' && m.parentId !== excelParentFilter) return false;
      }
      if (excelStatusFilter !== 'all') {
        const isDeceased = excelStatusFilter === 'deceased';
        if (m.isDeceased !== isDeceased) return false;
      }
      if (excelSpouseFilter !== 'all') {
        if (excelSpouseFilter === 'has_spouse' && (!m.spouses || m.spouses.length === 0)) return false;
        if (excelSpouseFilter === 'multi_spouse' && (!m.spouses || m.spouses.length <= 1)) return false;
        if (excelSpouseFilter === 'divorced' && (!m.spouses || !m.spouses.some((s) => s.status === 'cerai_hidup'))) return false;
      }
      if (excelGenderFilter !== 'all') {
        if (m.gender !== excelGenderFilter) return false;
      }
      return true;
    });
  }, [activeTrah.members, searchQuery, excelGenFilter, excelParentFilter, excelStatusFilter, excelSpouseFilter, excelGenderFilter, excelSortMode]);

  const selectedMemberChildren = selectedMember
    ? activeTrah.members
        .filter((m) => m.parentId === selectedMember.id)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];

  const currentQuickParent = activeTrah.members.find((m) => m.id === quickParentId);
  const currentQuickAncestry = currentQuickParent
    ? getAncestryPath(currentQuickParent, activeTrah.members)
    : [];
  const currentQuickExistingChildren = currentQuickParent
    ? activeTrah.members
        .filter((m) => m.parentId === currentQuickParent.id)
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    : [];

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-stone-100 select-none font-sans text-stone-800">
      {/* ========================================================= */}
      {/* 1. HEADER BAR BERSIH & MINIMALIS */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* 1. HEADER BAR: HANYA MENAMPILKAN IKON DAN NAMA MENU / SUBMENU */}
      {/* ========================================================= */}
      <header className="bg-gradient-to-r from-[#047857] via-[#059669] to-[#047857] text-white px-3 py-2 flex items-center justify-between shrink-0 shadow-md border-b border-emerald-800 z-30">
        {/* Tombol Kembali ke WargaQu */}
        <button
          onClick={onBackToWarga}
          className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition flex items-center justify-center text-emerald-100 hover:text-white shrink-0"
          title="Kembali ke Beranda WargaQu"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Tengah: Ikon & Nama Menu / Submenu Aktif */}
        <div className="flex items-center gap-2 max-w-[70%] truncate text-center">
          <div className="w-7 h-7 rounded-lg bg-emerald-950/40 border border-emerald-400/40 flex items-center justify-center shrink-0 text-amber-300 shadow-2xs">
            {viewMode === 'grid' && <Move className="w-4 h-4 text-amber-300" />}
            {viewMode === 'excel' && <FileSpreadsheet className="w-4 h-4" />}
            {viewMode === 'feed' && <MessageSquareText className="w-4 h-4 text-blue-300" />}
            {viewMode === 'kuis' && <Trophy className="w-4 h-4 text-amber-300" />}
            {viewMode === 'settings' && <Settings className="w-4 h-4 text-emerald-200" />}
          </div>
          <div className="flex flex-col text-left truncate">
            <h2 className="text-xs font-black text-white truncate leading-tight">
              {viewMode === 'grid' && 'Grid Manual / Auto'}
              {viewMode === 'excel' && 'Tabel Data (Excel)'}
              {viewMode === 'feed' && `Medsos TrahBook (${trahList.length} Trah)`}
              {viewMode === 'kuis' && 'Kuis Trah Silsilah'}
              {viewMode === 'settings' && 'Pengaturan & Akun'}
            </h2>
            <span className="text-[10px] text-emerald-200 font-bold truncate leading-none mt-0.5">
              {viewMode === 'settings'
                ? accountProfile.displayName
                : trahList.length === 0
                ? 'Belum Ada Trah (0)'
                : activeTrah.name}
            </span>
          </div>
        </div>

        {/* Kanan: Tombol Panduan (?) & Hidden Sidebar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => ModuleOnboardingService.openGuide('leluhurqu')}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition flex items-center justify-center text-emerald-100 hover:text-white"
            title="Panduan & Manfaat LeluhurQu"
            aria-label="Panduan LeluhurQu"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition flex items-center justify-center text-emerald-100 hover:text-white"
            title="Buka Sidebar Menu & Aksi Cepat"
          >
            <Menu className="w-4 h-4 text-[#5eead4]" />
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. BAR PILAR TRAH (4–8+ JALUR: USER, PASANGAN & MODULAR)  */}
      {/* ========================================================= */}
      {appPreferences.showPillarBar && (
      <div className="bg-emerald-950/90 text-white px-3 py-1.5 border-b border-emerald-900 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0 text-xs">
        <div className="flex items-center gap-1.5 shrink-0 font-bold text-[11px] text-emerald-300">
          <Layers className="w-3.5 h-3.5 text-amber-300" />
          <span>Pilar Trah ({trahList.length}):</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {trahList.map((t) => {
            const isActive = t.id === activeTrah.id;
            const linMeta = getLineageBadgeMeta(t.lineageSide);
            let label = t.name;
            if (t.lineageSide === 'ibu_user' && t.name.includes('ROHANI')) {
              label = 'Trah Rohani (Ibu)';
            } else if (t.lineageSide === 'ayah_user' && t.name.toUpperCase().includes('SANTA')) {
              label = 'Trah Santa (Ayah)';
            } else if (t.lineageSide !== 'umum' && t.name.includes('(')) {
              label = t.name.split('(')[0].trim() || t.name;
            }
            const coreLinked = getTrahCoreLinkStatus(t).linked;

            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTrahId(t.id);
                  showNotification(`Beralih ke ${t.name}`);
                }}
                className={`py-1 px-3 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition ${
                  isActive
                    ? 'bg-amber-400 text-stone-950 shadow-sm ring-1 ring-amber-300'
                    : 'bg-emerald-900/60 hover:bg-emerald-900 text-emerald-100 hover:text-white border border-emerald-800'
                }`}
              >
                <span>{linMeta.icon}</span>
                <span className="whitespace-nowrap font-black">{label}</span>
                {coreLinked && (
                  <span title="Tersinkron Hub Keluarga Inti" className="text-[9px]">
                    🔗
                  </span>
                )}
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? 'bg-stone-900 text-amber-300' : 'bg-emerald-950 text-emerald-300'}`}>
                  {linMeta.shortTag} • {t.members.length}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => {
              setNuclearHubPreselect(null);
              setIsNuclearHubOpen(true);
            }}
            className="py-1 px-2.5 rounded-xl bg-teal-500/90 hover:bg-teal-400 text-stone-950 text-[11px] font-extrabold flex items-center gap-1 shrink-0 shadow-2xs"
            title="Isi 1x Data Keluarga Inti (Anda, Pasangan & Anak) lalu Sinkron Otomatis ke Semua Trah"
          >
            <Users className="w-3 h-3" />
            <span>Keluarga Inti</span>
            {trahList.some((t) => getTrahCoreLinkStatus(t).linked) && (
              <span className="text-[9px] bg-stone-950 text-teal-300 px-1 rounded-full font-black">
                {trahList.filter((t) => getTrahCoreLinkStatus(t).linked).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsAddTrahModalOpen(true)}
            className="py-1 px-2.5 rounded-xl bg-amber-400/90 hover:bg-amber-300 text-stone-950 text-[11px] font-extrabold flex items-center gap-1 shrink-0 shadow-2xs"
            title="Buat Trah Modular Baru & Sinkronkan ke Semua Submenu"
          >
            <FolderPlus className="w-3 h-3" />
            <span>Trah Baru</span>
          </button>

          <button
            onClick={() => setIsSpouseModalOpen(true)}
            className="py-1 px-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 border border-emerald-700 shrink-0"
            title="Kelola Pasangan & Hubungkan 4–8+ Pilar Trah"
          >
            <Plus className="w-3 h-3 text-amber-300" />
            <span>Taut Pasangan</span>
          </button>

          <button
            onClick={() => setIsQrScannerOpen(true)}
            className="py-1 px-2 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 border border-emerald-700 shrink-0"
            title="Scan Barcode QR atau Tempel Link Undangan Trah Lain"
          >
            <QrCode className="w-3 h-3 text-amber-300" />
            <span>Scan / Gabung</span>
          </button>
        </div>
      </div>
      )}

      {/* ========================================================= */}
      {/* 3. SUB-TOOLBAR KANVAS AKTIF                               */}
      {/* ========================================================= */}
      <div className="bg-white border-b border-stone-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === 'grid' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-extrabold">
              <Move className="w-3.5 h-3.5 text-amber-600" />
              <span>Kanvas Grid Interaktif (Manual / Auto)</span>
            </div>
          )}
          {viewMode === 'excel' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Tabel Filter Excel Silsilah</span>
            </div>
          )}
          {viewMode === 'feed' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-extrabold">
              <MessageSquareText className="w-3.5 h-3.5 text-blue-600" />
              <span>Medsos TrahBook ({trahList.length} Trah)</span>
            </div>
          )}
          {viewMode === 'kuis' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-extrabold">
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Kuis Silsilah · Jadwal, Sponsor, Latihan &amp; Rekap</span>
            </div>
          )}
          {viewMode === 'settings' && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-stone-100 border border-stone-300 text-stone-800 text-[11px] font-extrabold">
              <Settings className="w-3.5 h-3.5 text-emerald-700" />
              <span>Pengaturan Akun, Pilar Trah (4–8+) & Cadangan Data</span>
            </div>
          )}

          {trahList.length > 0 && viewMode !== 'settings' && (() => {
            const effRole = getEffectiveTrahRole(activeTrah, accountScope.email, accountScope.isOwner);
            const roleMeta = getTrahRoleMeta(effRole);
            return (
              <span
                title={roleMeta.description}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-extrabold ${roleMeta.badgeClass}`}
              >
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>Akses: {roleMeta.shortLabel}</span>
              </span>
            );
          })()}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {trahList.length > 0 && viewMode !== 'settings' && (
            <span
              title={`Versi rujukan v${activeTrah.dataVersion || 1} • Terakhir sync: ${formatSyncTimestamp(
                activeTrah.lastSyncedAt || activeTrah.lastApprovedAt
              )}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-bold"
            >
              <Clock className="w-3 h-3 text-emerald-700 shrink-0" />
              <span>v{activeTrah.dataVersion || 1}</span>
              <span className="hidden md:inline text-emerald-700">
                • {formatSyncTimestamp(activeTrah.lastSyncedAt || activeTrah.lastApprovedAt)}
              </span>
            </span>
          )}

          {trahList.length > 0 && (
            <button
              type="button"
              onClick={() => void handleManualRefreshTrah()}
              disabled={isCheckingOrPulling}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap disabled:opacity-60 ${
                syncCheckStatus?.isOutdated
                  ? 'bg-amber-400 hover:bg-amber-300 text-stone-950 border-amber-500 shadow-xs'
                  : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-300'
              }`}
              title="Tarik pembaruan versi terbaru Trah & muat ulang tampilan"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isCheckingOrPulling ? 'animate-spin' : ''} ${
                  syncCheckStatus?.isOutdated ? 'text-stone-950' : 'text-emerald-700'
                }`}
              />
              <span>{syncCheckStatus?.isOutdated ? 'Tarik Update' : 'Refresh'}</span>
            </button>
          )}

          {viewMode !== 'settings' && (
            <button
              type="button"
              onClick={() => openSettingsTab('logs')}
              className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap"
              title="Pantau riwayat perubahan data, ajuan & approve Admin"
            >
              <History className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Log Aktivitas</span>
              {pendingProposalsForActiveTrah.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 text-[9px] font-black">
                  {pendingProposalsForActiveTrah.length} Ajuan
                </span>
              )}
              {activityLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-700 text-white text-[9px] font-extrabold">
                  {activityLogs.length}
                </span>
              )}
            </button>
          )}

          {(viewMode === 'grid' || viewMode === 'excel') && trahList.length > 0 && (
            <button
              type="button"
              onClick={() => setIsBookModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1.5 shadow-2xs transition active:scale-95 whitespace-nowrap shrink-0"
              title="Pratinjau & Unduh Buku Leluhur (A4 / A5 / A6 PDF)"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-300" />
              <span>Buku Leluhur (PDF)</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAHAP 3: BANNER VERSI RUJUKAN BARU TERSEDIA (TARIK & RELOAD) */}
      {/* ========================================================= */}
      {trahList.length > 0 && syncCheckStatus?.isOutdated && syncCheckStatus.remoteHeader && (
        <div className="bg-amber-50 text-stone-900 px-3 py-2 border-b border-amber-300 flex flex-wrap items-center justify-between gap-2 text-xs z-20 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-xs truncate">
                Pembaruan Rujukan Tersedia: v{syncCheckStatus.remoteHeader.dataVersion} ({syncCheckStatus.remoteHeader.memberCount} Anggota)
              </p>
              <p className="text-[10px] text-stone-700 truncate">
                Lokal saat ini v{syncCheckStatus.localVersion} ({syncCheckStatus.localMemberCount} anggota) • Disetujui {syncCheckStatus.remoteHeader.approvedBy} ({formatSyncTimestamp(syncCheckStatus.remoteHeader.updatedAt)})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleManualRefreshTrah()}
            disabled={isCheckingOrPulling}
            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] flex items-center gap-1.5 transition shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingOrPulling ? 'animate-spin' : ''}`} />
            <span>Tarik Update &amp; Muat Ulang</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAHAP 2: BANNER ANTREAN APPROVE UNTUK ADMIN TRAH         */}
      {/* ========================================================= */}
      {trahList.length > 0 &&
        viewMode !== 'settings' &&
        canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner) &&
        pendingProposalsForActiveTrah.length > 0 && (
          <div className="bg-emerald-50 text-emerald-950 px-3 py-2 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs z-20 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <p className="text-[11px] font-bold truncate">
                Ada <strong>{pendingProposalsForActiveTrah.length}</strong> ajuan perubahan data anggota di {activeTrah.name} menunggu <strong>Approve Admin</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openSettingsTab('logs')}
              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] shrink-0 transition"
            >
              Tinjau &amp; Approve
            </button>
          </div>
        )}

      {/* ========================================================= */}
      {/* BANNER PROSES / TUNGGU SINKRONISASI SAAT MASUK VIA LINK   */}
      {/* ========================================================= */}
      {pendingTrahSync && (
        <div className="bg-amber-50 text-stone-900 px-3 py-2.5 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs z-20 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <RefreshCw className={`w-4 h-4 ${pendingTrahSync.isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-xs truncate">
                {pendingTrahSync.isSyncing
                  ? `Menyinkronkan "${pendingTrahSync.title}"...`
                  : `Menunggu Sinkronisasi "${pendingTrahSync.title}"`}
              </p>
              <p className="text-[10px] text-stone-600 truncate">
                {pendingTrahSync.isSyncing
                  ? 'Mengambil data silsilah terbaru saat masuk.'
                  : 'Otomatis masuk begitu perangkat keluarga membuka WargaQu, atau tekan Sinkronkan Ulang.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!pendingTrahSync.isSyncing && (
              <button
                type="button"
                onClick={() => {
                  void handleAcceptTrahInvite(pendingTrahSync.rawInput, true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sinkronkan Ulang</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setPendingTrahSync(null)}
              className="p-1 rounded-lg hover:bg-amber-200/60 text-stone-600"
              title="Tutup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BANNER SELAMAT DATANG AUTO-MASUK VIA LINK UNDANGAN        */}
      {/* ========================================================= */}
      {autoJoinedBanner && trahList.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white px-3 py-2 border-b border-emerald-950 flex flex-wrap items-center justify-between gap-2 text-xs z-20 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-400 text-stone-950 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-xs truncate">
                Sinkronisasi &amp; Masuk Trah &ldquo;{autoJoinedBanner.trahName}&rdquo;
              </p>
              <p className="text-[10px] text-emerald-100 truncate">
                Undangan dari {autoJoinedBanner.inviter} • {autoJoinedBanner.memberCount} anggota silsilah siap diklaim.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTrahId(autoJoinedBanner.trahId);
                setViewMode('excel');
                setSearchQuery('');
                setExcelGenFilter('all');
                setExcelParentFilter('all');
                setAutoJoinedBanner(null);
                showNotification('Klik nama Anda di tabel lalu pilih "Klaim Nama Ini Sebagai Saya".');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold text-[11px] flex items-center gap-1 shadow-2xs transition"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Klaim Nama Saya</span>
            </button>
            <button
              type="button"
              onClick={() => setAutoJoinedBanner(null)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              title="Tutup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. KANVAS UTAMA: GRID INTERAKTIF, TABEL EXCEL & MEDSOS    */}
      {/* ========================================================= */}
      <main
        className={`flex-1 relative ${
          viewMode === 'grid' && trahList.length > 0
            ? 'p-2 flex flex-col overflow-hidden'
            : 'p-4 overflow-y-auto overflow-x-auto block touch-pan-y'
        }`}
        style={{
          touchAction: 'auto',
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      >
        {trahList.length === 0 && viewMode !== 'settings' ? (
          <div className="max-w-lg mx-auto my-6 bg-white rounded-3xl border border-stone-200 shadow-lg p-5 sm:p-6 space-y-5 text-center select-text">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-2xs">
              <Users className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-stone-900">
                Belum Ada Trah Keluarga di Akun Ini
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Demi privasi, akun baru hanya menampilkan <strong>Trah dari undangan keluarga</strong> atau <strong>Trah baru yang Anda buat sendiri</strong> — contoh 4 Trah milik akun lain tidak ditampilkan otomatis.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 text-left">
              <button
                type="button"
                onClick={() => setIsAddTrahModalOpen(true)}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition"
              >
                <FolderPlus className="w-4 h-4 text-amber-300" />
                <span>Buat Trah Keluarga Baru</span>
              </button>

              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-extrabold text-stone-800 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Punya Barcode / Link Undangan dari Saudara?</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQrScannerOpen(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition"
                >
                  <QrCode className="w-4 h-4 text-amber-300" />
                  <span>Scan Kamera / Unggah Gambar Barcode QR</span>
                </button>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={inviteJoinInput}
                    onChange={(e) => setInviteJoinInput(e.target.value)}
                    placeholder="Atau tempel link (?trah=... / ?t=LQH2_...) atau kode..."
                    className="flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:border-emerald-600 outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleAcceptTrahInvite(inviteJoinInput);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 font-extrabold text-xs shrink-0 transition"
                  >
                    Gabung
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : activeTrah.members.length === 0 && viewMode !== 'grid' && viewMode !== 'settings' && viewMode !== 'kuis' ? (
          <div className="flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-dashed border-stone-300 max-w-md mx-auto my-auto shadow-sm">
            <Users className="w-10 h-10 text-emerald-600 mb-2" />
            <h3 className="font-bold text-sm text-stone-800">Silsilah Masih Kosong</h3>
            <p className="text-xs text-stone-500 mt-1">Gunakan tombol Isi Cepat untuk mengisi silsilah secara instan.</p>
            <button
              onClick={() => handleOpenQuickBatch()}
              className="mt-3 bg-amber-400 hover:bg-amber-500 text-stone-900 font-bold text-xs py-2 px-3 rounded-xl shadow flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4 fill-stone-900" />
              <span>⚡ Isi Cepat (Koma)</span>
            </button>
          </div>
        ) : viewMode === 'excel' ? (
          /* ========================================================= */
          /* TABEL FILTER EXCEL DENGAN KOLOM LENGKAP & EKSPOR */
          /* ========================================================= */
          <div
            key={`excel_${activeTrah.id}_${uiReloadKey}`}
            className="w-full max-w-6xl space-y-3.5 pb-20 mx-auto select-text"
          >
            <div className="bg-emerald-900 text-white p-3 rounded-2xl shadow-sm border border-emerald-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-white leading-tight">
                    Tabel Filter Excel Silsilah • {activeTrah.name}
                  </h3>
                  <p className="text-[10px] text-emerald-200">
                    Menampilkan {excelFilteredMembers.length} dari {activeTrah.members.length} anggota • Garis nasab &amp; anak otomatis terhubung
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <select
                  value={excelGenFilter}
                  onChange={(e) => setExcelGenFilter(e.target.value)}
                  className="bg-emerald-950/80 text-white border border-emerald-400/40 rounded-xl px-2 py-1 text-[11px] font-bold outline-hidden"
                >
                  <option value="all">🔍 Semua Tingkat</option>
                  {availableGenLevels.map((lvl) => (
                    <option key={lvl} value={String(lvl)}>
                      {getKinshipLabel(lvl)} (Gen {lvl})
                    </option>
                  ))}
                </select>

                <select
                  value={excelParentFilter}
                  onChange={(e) => setExcelParentFilter(e.target.value)}
                  className="bg-emerald-950/80 text-white border border-emerald-400/40 rounded-xl px-2 py-1 text-[11px] font-bold outline-hidden max-w-[170px]"
                >
                  <option value="all">👪 Semua Induk / Cabang</option>
                  <option value="root">👑 Leluhur Utama (Gen 0)</option>
                  {excelParentOptions.map(({ member, childCount }) => (
                    <option key={member.id} value={member.id}>
                      ↳ Anak {member.name} ({childCount})
                    </option>
                  ))}
                </select>

                <select
                  value={excelSpouseFilter}
                  onChange={(e) => setExcelSpouseFilter(e.target.value)}
                  className="bg-emerald-950/80 text-white border border-emerald-400/40 rounded-xl px-2 py-1 text-[11px] font-bold outline-hidden"
                >
                  <option value="all">💍 Semua Pasangan</option>
                  <option value="has_spouse">Memiliki Pasangan</option>
                  <option value="multi_spouse">Istri &gt; 1</option>
                  <option value="divorced">Pernah Cerai</option>
                </select>

                <select
                  value={excelGenderFilter}
                  onChange={(e) => setExcelGenderFilter(e.target.value as 'all' | 'L' | 'P')}
                  className="bg-emerald-950/80 text-white border border-emerald-400/40 rounded-xl px-2 py-1 text-[11px] font-bold outline-hidden"
                >
                  <option value="all">⚥ Semua Gender</option>
                  <option value="L">👨 Pria (L)</option>
                  <option value="P">👩 Wanita (P)</option>
                </select>

                <button
                  type="button"
                  onClick={() => setExcelSortMode((m) => (m === 'tree' ? 'generation' : 'tree'))}
                  className="bg-emerald-950/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-400/40 font-bold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 transition"
                  title="Ubah urutan baris tabel"
                >
                  <ListOrdered className="w-3 h-3 text-amber-300" />
                  <span>{excelSortMode === 'tree' ? 'Urut: Jalur Nasab' : 'Urut: Generasi'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRepairActiveTrahLineage}
                  className="bg-emerald-800 hover:bg-emerald-700 text-white border border-emerald-500/50 font-bold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 transition active:scale-95"
                  title="Sinkronkan & perbaiki garis nasab serta tingkat generasi"
                >
                  <RefreshCw className="w-3 h-3 text-amber-300" />
                  <span>Rapikan Nasab</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="bg-amber-400 hover:bg-amber-300 text-stone-900 font-extrabold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 shadow-sm transition active:scale-95"
                >
                  <Download className="w-3 h-3" />
                  <span>Ekspor CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(true)}
                  className="bg-white hover:bg-amber-50 text-emerald-950 font-extrabold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 shadow-sm transition active:scale-95"
                  title="Buat & Pratinjau Buku Leluhur PDF (A4/A5/A6)"
                >
                  <BookOpen className="w-3 h-3 text-emerald-700" />
                  <span>Buku PDF</span>
                </button>

                <button
                  onClick={() => {
                    setViewMode('grid');
                    showNotification('Beralih ke Kanvas Grid (Manual / Auto) ✋');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 shadow-sm transition active:scale-95"
                  title="Buka Data Silsilah di Kanvas Grid Interaktif"
                >
                  <Move className="w-3 h-3 text-amber-300" />
                  <span>Buka Kanvas Grid</span>
                </button>
              </div>
            </div>

            {excelLineageHealth.needsAttention && (
              <div className="bg-amber-50 border border-amber-300 text-amber-950 px-3.5 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Terdeteksi beberapa anggota belum tertaut ke orang tua / induknya (sehingga garis nasab &amp; daftar anak terputus).
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRepairActiveTrahLineage}
                    className="bg-amber-400 hover:bg-amber-500 text-stone-950 font-extrabold px-3 py-1 rounded-xl text-[11px] shadow-2xs transition"
                  >
                    ⚡ Tautkan &amp; Perbaiki Otomatis
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700 border-collapse">
                  <thead className="bg-stone-100 border-b border-stone-200 text-[11px] text-stone-600 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3 w-32">Tingkat</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Nama Anggota</th>
                      <th className="py-2.5 px-3 min-w-[230px]">Garis Nasab &amp; Induk</th>
                      <th className="py-2.5 px-3 min-w-[170px]">Pasangan / Istri (Status)</th>
                      <th className="py-2.5 px-3 min-w-[210px]">Daftar Anak (Urut)</th>
                      <th className="py-2.5 px-3 w-20">Status</th>
                      <th className="py-2.5 px-3 w-28 text-center">Aksi Cepat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {excelFilteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-stone-500 text-xs">
                          Tidak ada anggota yang cocok dengan filter aktif.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setExcelGenFilter('all');
                              setExcelParentFilter('all');
                              setExcelStatusFilter('all');
                              setExcelSpouseFilter('all');
                              setExcelGenderFilter('all');
                              setSearchQuery('');
                            }}
                            className="text-emerald-700 font-bold underline ml-1"
                          >
                            Reset Semua Filter
                          </button>
                        </td>
                      </tr>
                    ) : (
                      excelFilteredMembers.map((m, idx) => {
                        const path = getAncestryPath(m, activeTrah.members);
                        const directParent = m.parentId
                          ? activeTrah.members.find((p) => p.id === m.parentId)
                          : null;
                        const hasBrokenParent = Boolean(m.parentId && !directParent);
                        const siblings = activeTrah.members
                          .filter((s) => (s.parentId || null) === (m.parentId || null))
                          .sort(
                            (a, b) =>
                              (a.orderIndex || 0) - (b.orderIndex || 0) ||
                              a.name.localeCompare(b.name)
                          );
                        const siblingIdx = siblings.findIndex((s) => s.id === m.id);
                        const children = activeTrah.members
                          .filter((c) => c.parentId === m.id)
                          .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
                        const totalDescendants = getDescendantIds(m.id, activeTrah.members).size;
                        const meta = getGenerationMeta(m.generationLevel);

                        return (
                          <tr key={m.id} className="hover:bg-emerald-50/50 transition-colors align-top">
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-stone-400">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col items-start gap-1">
                                <span className={`inline-flex text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${meta.badgeBg}`}>
                                  {getKinshipLabel(m.generationLevel)}
                                </span>
                                {(directParent || siblings.length > 1) && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[10px] text-stone-600 font-semibold">
                                      {directParent ? `Anak ke-${siblingIdx + 1}` : `Urut #${siblingIdx + 1}`}
                                    </span>
                                    {siblings.length > 1 && (
                                      <span className="inline-flex items-center gap-0.5">
                                        <button
                                          type="button"
                                          disabled={siblingIdx <= 0}
                                          onClick={() => handleMoveSiblingOrder(m.id, 'up')}
                                          title="Geser naik jadi lebih tua (Kakak) — keturunan otomatis ikut"
                                          className="px-1 py-0.2 rounded bg-stone-100 hover:bg-amber-200 disabled:opacity-30 border border-stone-300 text-stone-800 text-[10px] font-black leading-none transition"
                                        >
                                          ↑
                                        </button>
                                        <button
                                          type="button"
                                          disabled={siblingIdx >= siblings.length - 1}
                                          onClick={() => handleMoveSiblingOrder(m.id, 'down')}
                                          title="Geser turun jadi lebih muda (Adik) — keturunan otomatis ikut"
                                          className="px-1 py-0.2 rounded bg-stone-100 hover:bg-amber-200 disabled:opacity-30 border border-stone-300 text-stone-800 text-[10px] font-black leading-none transition"
                                        >
                                          ↓
                                        </button>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-start gap-1.5">
                                {excelSortMode === 'tree' && m.generationLevel > 0 && (
                                  <span
                                    className="text-stone-400 font-mono text-[10px] shrink-0 mt-0.5"
                                    style={{ paddingLeft: `${Math.min(m.generationLevel - 1, 4) * 8}px` }}
                                  >
                                    └─
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickToggleMemberGender(m);
                                  }}
                                  title="Klik untuk ganti Pria (L) / Wanita (P)"
                                  className={`shrink-0 px-1.5 py-0.5 rounded-md border text-[11px] font-bold transition active:scale-95 ${
                                    m.gender === 'P'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                      : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                                  }`}
                                >
                                  {m.gender === 'P' ? '👩 P' : '👨 L'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMember(m);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="text-left group min-w-0"
                                >
                                  <div className="font-bold text-stone-900 group-hover:text-emerald-700 underline-offset-2 group-hover:underline">
                                    {m.name}
                                  </div>
                                  {m.callName && m.callName !== m.name && (
                                    <div className="text-[10px] text-stone-500">
                                      &ldquo;{m.callName}&rdquo;
                                    </div>
                                  )}
                                  {(m.claimedByName || m.coreRefId) && (
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                      {m.claimedByName && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[9px] font-bold">
                                          ✓ Diklaim: {m.claimedByName}
                                        </span>
                                      )}
                                      {m.coreRefId && (
                                        <span
                                          title="Tersinkron otomatis dengan Hub Keluarga Inti"
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[9px] font-bold"
                                        >
                                          🔗 Inti
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              {hasBrokenParent ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(m)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300 px-2 py-0.5 rounded-lg hover:bg-rose-100"
                                >
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Induk terputus — Klik tautkan</span>
                                </button>
                              ) : path.length <= 1 ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">
                                    👑 Leluhur Utama (Induk Awal): {m.name}
                                  </span>
                                  {totalDescendants > 0 && (
                                    <div className="text-[10px] text-stone-500">
                                      Menurunkan {totalDescendants} keturunan ({children.length} anak langsung)
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-1 text-stone-600 leading-snug">
                                    {path.map((step, sIdx) => (
                                      <React.Fragment key={step.id}>
                                        {sIdx > 0 && <span className="text-emerald-600 font-bold">➔</span>}
                                        <span
                                          className={
                                            step.id === m.id
                                              ? 'font-extrabold text-emerald-900 bg-emerald-100/80 px-1.5 py-0.2 rounded'
                                              : 'font-medium text-stone-700'
                                          }
                                        >
                                          {step.name}
                                        </span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                  {directParent && (
                                    <div className="text-[10px] text-stone-500">
                                      Induk: <strong className="text-stone-700">{directParent.name}</strong>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {m.spouses && m.spouses.length > 0 ? (
                                <div className="space-y-0.5">
                                  {m.spouses.map((sp) => {
                                    const badge = getSpouseStatusBadge(sp.status);
                                    return (
                                      <div key={sp.id} className="text-[11px] flex items-center justify-between gap-1">
                                        <span>{sp.name}</span>
                                        <span className={`px-1 rounded text-[8px] font-bold border ${badge.className}`}>{badge.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-stone-400 italic">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              {children.length > 0 ? (
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1">
                                    {children.map((c, cIdx) => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedMember(c);
                                          setIsDetailModalOpen(true);
                                        }}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-semibold text-[10px] transition ${
                                          c.gender === 'P'
                                            ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900'
                                            : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900'
                                        }`}
                                        title={`Lihat detail ${c.name}`}
                                      >
                                        <span className="font-mono opacity-60 text-[9px]">{cIdx + 1}.</span>
                                        <span>{c.gender === 'P' ? '👩' : '👨'}</span>
                                        <span>{c.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                  <div className="text-[10px] text-stone-500">
                                    {children.length} anak{totalDescendants > children.length ? ` • ${totalDescendants} total keturunan` : ''}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-stone-400">
                                  <span className="italic">Belum ada anak</span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickBatch(m)}
                                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-md transition"
                                  >
                                    + Anak
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[10px]">
                              <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${m.isDeceased ? 'bg-stone-200 text-stone-700' : 'bg-emerald-100 text-emerald-800'}`}>
                                {m.isDeceased ? 'Wafat' : 'Hidup'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {(() => {
                                const rowEditPerm = canEditTrahMember(
                                  activeTrah,
                                  m,
                                  accountScope.email,
                                  accountScope.isOwner
                                );
                                const rowDeletePerm = canDeleteTrahMember(
                                  activeTrah,
                                  m,
                                  activeTrah.members,
                                  accountScope.email,
                                  accountScope.isOwner
                                );
                                return (
                                  <div className="flex justify-center gap-1">
                                    <button
                                      onClick={() => {
                                        setViewMode('grid');
                                        showNotification(`Beralih ke Kanvas Grid untuk ${m.name} ✋`);
                                      }}
                                      className="p-1 hover:bg-amber-100 rounded text-amber-700"
                                      title="Lihat di Kanvas Grid"
                                    >
                                      <Move className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleOpenQuickBatch(m)} className="p-1 hover:bg-amber-100 rounded text-amber-700" title="Isi Cepat Anak">
                                      <Zap className="w-3 h-3 fill-amber-500" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEdit(m)}
                                      className={`p-1 rounded ${
                                        rowEditPerm.ok
                                          ? 'hover:bg-stone-200 text-stone-700'
                                          : 'text-stone-400 hover:bg-stone-100 opacity-70'
                                      }`}
                                      title={rowEditPerm.ok ? 'Edit Data & Orang Tua' : rowEditPerm.reason}
                                    >
                                      {rowEditPerm.ok ? <Edit3 className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMember(m)}
                                      className={`p-1 rounded ${
                                        rowDeletePerm.ok
                                          ? 'hover:bg-rose-100 text-rose-700'
                                          : 'text-stone-400 hover:bg-stone-100 opacity-60'
                                      }`}
                                      title={rowDeletePerm.ok ? 'Hapus' : rowDeletePerm.reason}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : viewMode === 'feed' ? (
          /* ========================================================= */
          /* MEDSOS KHUSUS 4 TRAH (FACEBOOK-STYLE TRAHBOOK KELUARGA) */
          /* ========================================================= */
          <div
            key={`feed_${activeTrah.id}_${uiReloadKey}`}
            className="w-full max-w-3xl pb-24 mx-auto space-y-4 select-text"
          >
            {/* Header Medsos TrahBook */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-4 rounded-3xl shadow-sm border border-blue-600 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white text-blue-700 flex items-center justify-center font-black text-lg shadow-sm">
                  f
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm sm:text-base text-white leading-tight">
                      Medsos TrahBook ({trahList.length} Trah)
                    </h3>
                    <span className="text-[10px] font-bold bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full">
                      Modular Keluarga
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    Ruang silaturahmi, kabar gembira, foto kenangan & lelayu terhubung ke semua Trah
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddTrahModalOpen(true)}
                  className="py-1.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold text-xs flex items-center gap-1 shadow-xs transition"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>+ Trah</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInviteTrahTarget(activeTrah);
                    setIsInviteModalOpen(true);
                  }}
                  className="py-1.5 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 backdrop-blur-xs transition"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Undang Saudara</span>
                </button>
              </div>
            </div>

            {/* Filter Tab Dinamis Berdasarkan Semua Trah Modular */}
            <div className="bg-white p-2 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
              <button
                onClick={() => setFeedPillarFilter('all')}
                className={`py-1.5 px-3 rounded-xl font-bold flex items-center gap-1 shrink-0 transition ${
                  feedPillarFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Semua Trah ({trahPosts.length})</span>
              </button>

              {trahList.map((t) => {
                const isSelected = feedPillarFilter === t.id;
                const linMeta = getLineageBadgeMeta(t.lineageSide);

                const countForTrah = trahPosts.filter(
                  (p) => p.trahId === t.id || (!trahList.some((x) => x.id === p.trahId) && p.lineageSide === t.lineageSide)
                ).length;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setFeedPillarFilter(t.id);
                      setActiveTrahId(t.id);
                    }}
                    className={`py-1.5 px-3 rounded-xl font-bold flex items-center gap-1 shrink-0 transition ${
                      isSelected ? linMeta.feedActiveClass : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <span>{linMeta.icon}</span>
                    <span className="max-w-[140px] truncate">{t.name.split('(')[0].trim()}</span>
                    <span className="text-[10px] opacity-80">({countForTrah})</span>
                  </button>
                );
              })}
            </div>

            {/* Kotak Buat Postingan Baru (Facebook-style Status Box) */}
            <form onSubmit={handleCreatePost} className="bg-white p-4 rounded-3xl border border-stone-200 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                {accountProfile.avatarUrl ? (
                  <img
                    src={accountProfile.avatarUrl}
                    alt={accountProfile.displayName}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-blue-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 border border-blue-200">
                    {(accountProfile.displayName || 'IA').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-xs text-stone-900">{accountProfile.displayName}</div>
                  <div className="text-[10px] text-stone-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span>Mengeposkan ke:</span>
                    <select
                      value={activeTrah.id}
                      onChange={(e) => {
                        setActiveTrahId(e.target.value);
                        if (feedPillarFilter !== 'all') {
                          setFeedPillarFilter(e.target.value);
                        }
                      }}
                      className="bg-blue-50 text-blue-800 border border-blue-200 rounded-lg px-2 py-0.5 text-[10px] font-extrabold outline-hidden max-w-[200px]"
                    >
                      {trahList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <textarea
                rows={3}
                required
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={`Apa kabar terbaru atau cerita kenangan di ${activeTrah.name}? Ketik di sini...`}
                className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-200 rounded-2xl focus:border-blue-500 focus:bg-white outline-hidden resize-none font-medium placeholder-stone-400"
              />

              {/* Kategori Postingan & Link Foto */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={newPostCategory}
                    onChange={(e: any) => setNewPostCategory(e.target.value)}
                    className="bg-stone-100 border border-stone-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-stone-700 outline-hidden"
                  >
                    <option value="silaturahmi">🤝 Silaturahmi & Arisan</option>
                    <option value="kabar_gembira">🎉 Kabar Gembira / Syukuran</option>
                    <option value="sejarah">📜 Sejarah & Foto Kenangan</option>
                    <option value="lelayu">🕊️ Berita Duka / Lelayu</option>
                  </select>

                  <div className="relative flex items-center">
                    <ImagePlus className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
                    <input
                      type="url"
                      value={newPostImageUrl}
                      onChange={(e) => setNewPostImageUrl(e.target.value)}
                      placeholder="Link Foto (Opsional)..."
                      className="pl-8 pr-2 py-1 bg-stone-50 border border-stone-200 rounded-xl text-[11px] w-36 sm:w-48 outline-hidden"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="py-1.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs shadow-xs transition flex items-center gap-1.5"
                >
                  <Send className="w-3 h-3" />
                  <span>Kirim Kabar</span>
                </button>
              </div>
            </form>

            {/* Daftar Postingan Feed Medsos */}
            <div className="space-y-4">
              {trahPosts
                .filter((p) => {
                  if (feedPillarFilter === 'all') return true;
                  const selectedT = trahList.find((x) => x.id === feedPillarFilter);
                  if (p.trahId === feedPillarFilter) return true;
                  if (selectedT && !trahList.some((x) => x.id === p.trahId) && p.lineageSide === selectedT.lineageSide) {
                    return true;
                  }
                  return false;
                })
                .map((post) => {
                  const matchedTrah = trahList.find((t) => t.id === post.trahId);
                  const displayTrahLabel = post.trahName || matchedTrah?.name;
                  const linMeta = getLineageBadgeMeta(post.lineageSide);
                  const badgePillar = {
                    label: displayTrahLabel || linMeta.label,
                    bg: linMeta.lightBadgeClass,
                  };

                  let catLabel = '🤝 Silaturahmi';
                  if (post.category === 'kabar_gembira') catLabel = '🎉 Kabar Gembira';
                  else if (post.category === 'sejarah') catLabel = '📜 Sejarah & Nostalgia';
                  else if (post.category === 'lelayu') catLabel = '🕊️ Berita Lelayu';

                  return (
                    <article key={post.id} className="bg-white rounded-3xl border border-stone-200 shadow-xs overflow-hidden">
                      {/* Header Post */}
                      <div className="p-4 pb-2.5 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {post.authorAvatar ? (
                            <img
                              src={post.authorAvatar}
                              alt={post.authorName}
                              className="w-10 h-10 rounded-full object-cover border border-stone-200 shadow-2xs"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-sm flex items-center justify-center border border-emerald-300">
                              {post.authorName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-extrabold text-xs text-stone-900">{post.authorName}</h4>
                              <span className="text-[10px] text-stone-400">•</span>
                              <span className="text-[10px] text-stone-500 font-medium">{post.authorKinship}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] text-stone-400 font-mono">{post.timestamp}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${badgePillar.bg}`}>
                                {badgePillar.label}
                              </span>
                              <span className="text-[9px] text-stone-500 bg-stone-100 px-1.5 rounded">
                                {catLabel}
                              </span>
                            </div>
                          </div>
                        </div>

                        {post.isPinned && (
                          <span className="text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <Bookmark className="w-2.5 h-2.5 fill-amber-700" />
                            <span>Semat</span>
                          </span>
                        )}
                      </div>

                      {/* Isi Konten Post */}
                      <div className="px-4 py-2 text-xs text-stone-800 leading-relaxed font-sans whitespace-pre-line">
                        {post.content}
                      </div>

                      {/* Gambar Postingan Jika Ada */}
                      {post.imageUrl && (
                        <div className="mt-2 bg-stone-100 border-y border-stone-200 max-h-80 overflow-hidden flex items-center justify-center">
                          <img
                            src={post.imageUrl}
                            alt="Foto postingan"
                            className="w-full object-cover max-h-80 hover:scale-102 transition duration-300"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Tombol Interaksi (Suka & Komentar) */}
                      <div className="px-4 py-2.5 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
                        <div className="flex items-center gap-1 text-[11px] text-stone-500">
                          <ThumbsUp className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />
                          <span>{post.likesCount} Suka</span>
                          <span>•</span>
                          <span>{post.comments.length} Komentar</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleLikePost(post.id)}
                            className={`py-1 px-3 rounded-xl font-bold flex items-center gap-1 transition ${
                              post.likedByMe
                                ? 'bg-blue-50 text-blue-600 font-extrabold'
                                : 'hover:bg-stone-100 text-stone-600'
                            }`}
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 ${post.likedByMe ? 'fill-blue-600' : ''}`} />
                            <span>Suka</span>
                          </button>

                          <button
                            onClick={() => {
                              const input = document.getElementById(`comment-input-${post.id}`);
                              input?.focus();
                            }}
                            className="py-1 px-3 rounded-xl hover:bg-stone-100 text-stone-600 font-bold flex items-center gap-1 transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Komentar</span>
                          </button>
                        </div>
                      </div>

                      {/* Kolom Komentar Facebook-style */}
                      <div className="bg-stone-50/70 p-3.5 border-t border-stone-100 space-y-2.5">
                        {post.comments.length > 0 && (
                          <div className="space-y-2">
                            {post.comments.map((c) => (
                              <div key={c.id} className="flex items-start gap-2 text-xs">
                                <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {c.authorName.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-2xs flex-1">
                                  <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className="font-extrabold text-[11px] text-stone-900">{c.authorName}</span>
                                    <span className="text-[9px] text-stone-400 font-mono">{c.timestamp}</span>
                                  </div>
                                  <p className="text-stone-700 text-[11px] leading-relaxed">{c.text}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Input Komentar Baru */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            id={`comment-input-${post.id}`}
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddComment(post.id);
                            }}
                            placeholder="Tulis komentar keluarga..."
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:border-blue-500 outline-hidden font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddComment(post.id)}
                            className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition active:scale-95"
                            title="Kirim Komentar"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>
        ) : viewMode === 'kuis' ? (
          /* ========================================================= */
          /* SUBMENU KUIS TRAH SILSILAH (MOBILE-FIRST & MODULAR)       */
          /* ========================================================= */
          <LeluhurQuizView
            activeTrah={activeTrah}
            trahList={trahList}
            userName={accountProfile.displayName || 'Keluarga'}
            userKinship={accountProfile.kinshipRole || 'Keluarga Trah'}
            onOpenPrintBook={() => setIsBookModalOpen(true)}
            showNotification={showNotification}
          />
        ) : viewMode === 'settings' ? (
          /* ========================================================= */
          /* MENU SETTING / PENGATURAN: AKUN, TRAH, BACKUP, PREFERENSI */
          /* ========================================================= */
          <LeluhurSettingsView
            accountProfile={accountProfile}
            onUpdateAccountProfile={setAccountProfile}
            preferences={appPreferences}
            onUpdatePreferences={setAppPreferences}
            trahList={trahList}
            activeTrahId={activeTrah.id}
            onSelectTrah={setActiveTrahId}
            onUpdateTrah={handleUpdateTrah}
            onDeleteTrah={handleDeleteTrah}
            onOpenAddTrah={() => setIsAddTrahModalOpen(true)}
            onOpenSpouseLink={() => setIsSpouseModalOpen(true)}
            onMoveActiveTrahToAyah={handleMoveActiveTrahToAyah}
            onExportCSV={handleExportCSV}
            onExportFullBackupJSON={handleExportFullBackupJSON}
            onImportFullBackupJSON={handleImportFullBackupJSON}
            trahPostsCount={trahPosts.length}
            savedDesignsCount={countSavedGridDesigns}
            activityLogs={activityLogs}
            onClearActivityLogs={() => {
              const hasAnyAdmin =
                accountScope.isOwner ||
                trahList.some((t) => canManageTrahAdmin(t, accountScope.email, accountScope.isOwner));
              if (!hasAnyAdmin) {
                showNotification('Log aktivitas dikunci anti-hapus untuk akun Anggota/Lihat Saja.');
                return;
              }
              setActivityLogs([]);
              showNotification('Log aktivitas silsilah telah dibersihkan.');
            }}
            changeProposals={changeProposals}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
            onRefreshActiveTrah={() => void handleManualRefreshTrah()}
            isRefreshingTrah={isCheckingOrPulling}
            currentEmail={accountScope.email}
            isOwner={accountScope.isOwner}
            initialSectionTab={settingsSectionTrigger.tab}
            sectionTriggerKey={settingsSectionTrigger.key}
            showNotification={showNotification}
          />
        ) : (
          /* ========================================================= */
          /* KANVAS GRID INTERAKTIF (MANUAL / AUTO ALA LUCIDCHART)     */
          /* ========================================================= */
          <InteractiveGridCanvasView
            key={`grid_${activeTrah.id}_${uiReloadKey}`}
            activeTrah={activeTrah}
            onOpenTable={() => {
              setViewMode('excel');
              showNotification('Beralih ke Tabel Filter Excel Silsilah 📑');
            }}
            onSyncMember={handleSyncMemberFromGrid}
            showNotification={showNotification}
            defaultCuratorName={accountProfile.displayName}
            defaultCreatedYear={accountProfile.defaultPosterYear}
            defaultPhotoShape={
              appPreferences.photoShape === 'circle'
                ? 'bulat'
                : appPreferences.photoShape === 'square'
                ? 'kotak'
                : 'segi6'
            }
          />
        )}
      </main>

      {/* ========================================================= */}
      {/* 4. NAVBAR BAWAH: GRID, TABEL, MEDSOS, KUIS, SETTING       */}
      {/* Tampilan: Ikon Besar di Atas, Nama Kecil di Bawahnya      */}
      {/* ========================================================= */}
      <nav className="bg-stone-900/95 backdrop-blur-md border-t border-stone-800 text-stone-300 px-2 py-1.5 shrink-0 z-30 shadow-2xl">
        <div className="max-w-lg mx-auto grid grid-cols-5 gap-1">
          {/* 1. Grid Manual / Auto */}
          <button
            type="button"
            onClick={() => {
              setViewMode('grid');
              showNotification('Beralih ke Kanvas Grid (Manual / Auto) ✋');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-95 ${
              viewMode === 'grid'
                ? 'text-amber-400 font-black'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 font-medium'
            }`}
          >
            <div
              className={`w-9 h-8 flex items-center justify-center rounded-xl transition-all ${
                viewMode === 'grid' ? 'bg-amber-500/20 text-amber-400 scale-110 shadow-xs ring-1 ring-amber-500/30' : ''
              }`}
            >
              <Move className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-1 leading-none font-bold">Grid</span>
          </button>

          {/* 2. Tabel Excel */}
          <button
            type="button"
            onClick={() => {
              setViewMode('excel');
              showNotification('Beralih ke Tabel Filter Excel 📑');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-95 ${
              viewMode === 'excel'
                ? 'text-emerald-400 font-black'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 font-medium'
            }`}
          >
            <div
              className={`w-9 h-8 flex items-center justify-center rounded-xl transition-all ${
                viewMode === 'excel' ? 'bg-emerald-500/20 text-emerald-400 scale-110 shadow-xs ring-1 ring-emerald-500/30' : ''
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-1 leading-none font-bold">Tabel</span>
          </button>

          {/* 3. Medsos TrahBook */}
          <button
            type="button"
            onClick={() => {
              setViewMode('feed');
              showNotification('Beralih ke Medsos TrahBook 💬');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-95 relative ${
              viewMode === 'feed'
                ? 'text-blue-400 font-black'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 font-medium'
            }`}
          >
            <div
              className={`w-9 h-8 flex items-center justify-center rounded-xl transition-all ${
                viewMode === 'feed' ? 'bg-blue-500/20 text-blue-400 scale-110 shadow-xs ring-1 ring-blue-500/30' : ''
              }`}
            >
              <MessageSquareText className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-1 leading-none font-bold">Medsos</span>
            {trahPosts.length > 0 && (
              <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-stone-900" />
            )}
          </button>

          {/* 4. Kuis Trah Silsilah */}
          <button
            type="button"
            onClick={() => {
              setViewMode('kuis');
              showNotification('Membuka Submenu Kuis Trah Silsilah 🏆');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-95 ${
              viewMode === 'kuis'
                ? 'text-amber-300 font-black'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 font-medium'
            }`}
          >
            <div
              className={`w-9 h-8 flex items-center justify-center rounded-xl transition-all ${
                viewMode === 'kuis' ? 'bg-amber-400/20 text-amber-300 scale-110 shadow-xs ring-1 ring-amber-400/30' : ''
              }`}
            >
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-1 leading-none font-bold">Kuis</span>
          </button>

          {/* 5. Pengaturan & Akun */}
          <button
            type="button"
            onClick={() => {
              setViewMode('settings');
              showNotification('Membuka Pengaturan & Profil Akun ⚙️');
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all duration-150 active:scale-95 ${
              viewMode === 'settings'
                ? 'text-teal-300 font-black'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50 font-medium'
            }`}
          >
            <div
              className={`w-9 h-8 flex items-center justify-center rounded-xl transition-all ${
                viewMode === 'settings' ? 'bg-teal-500/20 text-teal-300 scale-110 shadow-xs ring-1 ring-teal-400/30' : ''
              }`}
            >
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-1 leading-none font-bold">Setting</span>
          </button>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* 5. SIDEBAR KIRI (HIDDEN DRAWER) - LENGKAP DENGAN SETTING GARIS & KERTAS A0-A4 */}
      {/* ========================================================= */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />

          <div className="relative w-[85%] max-w-sm h-full bg-stone-900 text-stone-100 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200 border-r border-stone-800">
            {/* Header Drawer + Kartu Akun Mini */}
            <div className="p-4 bg-gradient-to-br from-emerald-900 via-stone-900 to-stone-950 border-b border-emerald-800/40 relative">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-stone-400 hover:text-white bg-black/30"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 pr-7">
                {accountProfile.avatarUrl ? (
                  <img
                    src={accountProfile.avatarUrl}
                    alt={accountProfile.displayName}
                    className="w-10 h-10 rounded-xl object-cover border border-emerald-400/60 shadow shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#5eead4] text-emerald-950 flex items-center justify-center font-black text-sm shadow shrink-0">
                    {(accountProfile.displayName || 'LQ').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-white truncate">{accountProfile.displayName}</h3>
                  <p className="text-[10px] text-emerald-300 truncate">
                    {accountProfile.email || accountProfile.kinshipRole || 'LeluhurQu'}
                  </p>
                </div>
              </div>
            </div>

            {/* Scrollable Drawer Body: Fokus Aksi Harian & Pindah Cepat Trah */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
              {/* Seksi 1: Pencarian & Aksi Cepat Harian */}
              <div className="space-y-2.5 bg-stone-800/90 p-3 rounded-2xl border border-stone-700/80 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>Aksi Cepat Silsilah</span>
                  </span>
                  <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/30">
                    Harian
                  </span>
                </div>

                {/* Pencarian Anggota Silsilah */}
                <div className="space-y-1">
                  <label className="text-[10px] text-stone-400 font-bold block">
                    Cari Anggota / Pasangan:
                  </label>
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ketik nama atau pasangan..."
                      className="w-full pl-8 pr-7 py-1.5 bg-stone-950 text-white placeholder-stone-500 border border-stone-700 rounded-xl text-xs outline-hidden focus:border-emerald-500 transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 text-stone-400 hover:text-white"
                        title="Hapus pencarian"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <p className="text-[10px] text-emerald-400 font-medium">
                      Filter aktif untuk &ldquo;{searchQuery}&rdquo;
                    </p>
                  )}
                </div>

                {/* Tombol Aksi Cepat */}
                <div className="space-y-1.5 pt-1 border-t border-stone-700/60">
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setNuclearHubPreselect(null);
                      setIsNuclearHubOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-stone-950 font-black text-xs flex items-center justify-between shadow-xs active:scale-95 transition"
                    title="Isi 1x Data Keluarga Inti lalu sinkronkan ke semua 4–8+ Trah tanpa ketik ulang"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-stone-950" />
                      <span>Keluarga Inti (Isi 1×)</span>
                    </span>
                    <span className="text-[9px] bg-stone-950/20 px-1.5 py-0.5 rounded font-bold">
                      {trahList.filter((t) => getTrahCoreLinkStatus(t).linked).length} Trah
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      if (trahList.length === 0) {
                        setIsAddTrahModalOpen(true);
                        showNotification('Buat Trah keluarga pertama Anda terlebih dahulu!');
                        return;
                      }
                      handleOpenQuickBatch();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black text-xs flex items-center justify-between shadow-xs active:scale-95 transition"
                    title="Isi Cepat Anak pakai Koma (kakak, adik, dst)"
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 fill-stone-950 text-stone-950" />
                      <span>Isi Cepat Anak (Koma)</span>
                    </span>
                    <span className="text-[9px] bg-stone-950/20 px-1.5 py-0.5 rounded font-bold">Input</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setIsSpouseModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-between border border-emerald-600/60 shadow-xs active:scale-95 transition"
                    title="Tautkan Pasangan (Aktifkan 4–8+ Pilar Trah: Ayah, Ibu & Kakek/Nenek User + Pasangan)"
                  >
                    <span className="flex items-center gap-2">
                      <HeartHandshake className="w-3.5 h-3.5 text-rose-300" />
                      <span>Tautkan Pasangan (4–8+ Trah)</span>
                    </span>
                    <span className="text-[9px] bg-emerald-950/50 text-emerald-200 px-1.5 py-0.5 rounded font-bold">Besan</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      if (trahList.length === 0) {
                        showNotification('Buat Trah baru terlebih dahulu sebelum mengundang keluarga.');
                        return;
                      }
                      setInviteTrahTarget(activeTrah);
                      setIsInviteModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-between border border-stone-700 shadow-xs active:scale-95 transition"
                    title="Bagikan Barcode QR & Undangan Medsos (WhatsApp, ChatQu, dll)"
                  >
                    <span className="flex items-center gap-2">
                      <Share2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Undangan Barcode &amp; Link</span>
                    </span>
                    <span className="text-[9px] bg-stone-900 text-amber-300 px-1.5 py-0.5 rounded font-bold">QR / WA</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setIsQrScannerOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-between border border-stone-700 shadow-xs active:scale-95 transition"
                    title="Scan Barcode QR atau Tempel Link Undangan Trah Saudara"
                  >
                    <span className="flex items-center gap-2">
                      <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Gabung / Scan Barcode Trah</span>
                    </span>
                    <span className="text-[9px] bg-emerald-950/70 text-emerald-300 px-1.5 py-0.5 rounded font-bold">Scan QR</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      if (trahList.length === 0) {
                        showNotification('Buat Trah baru terlebih dahulu untuk membuat Buku Leluhur.');
                        return;
                      }
                      setIsBookModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-900/90 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-between border border-emerald-600/60 shadow-xs active:scale-95 transition"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                      <span>Buat Buku Leluhur (PDF)</span>
                    </span>
                    <span className="text-[9px] bg-emerald-950/60 text-amber-300 px-1.5 py-0.5 rounded font-bold">A4/A5/A6</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      setViewMode('kuis');
                      showNotification('Membuka Kuis Trah Silsilah 🏆');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-xs flex items-center justify-between border border-amber-400/40 shadow-xs active:scale-95 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-amber-300" />
                      <span>Kuis Trah Silsilah</span>
                    </span>
                    <span className="text-[9px] bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded font-bold">Kuis</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      openSettingsTab('logs');
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-between border border-stone-700 shadow-xs active:scale-95 transition"
                  >
                    <span className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Log Aktivitas &amp; Klaim</span>
                    </span>
                    <span className="text-[9px] bg-emerald-950/70 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                      {activityLogs.length}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSidebarOpen(false);
                      window.print();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-between border border-stone-700 shadow-xs active:scale-95 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Printer className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cetak Silsilah (Print)</span>
                    </span>
                    <span className="text-[9px] bg-stone-900 text-stone-400 px-1.5 py-0.5 rounded font-bold">Kertas</span>
                  </button>
                </div>
              </div>

              {/* Seksi 2: Pindah Cepat Pilar Trah Aktif */}
              <div className="space-y-2 bg-stone-800/70 p-3 rounded-2xl border border-stone-700/80">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pilih Trah Aktif</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSidebarOpen(false);
                        setIsAddTrahModalOpen(true);
                      }}
                      className="text-[10px] font-extrabold text-amber-300 hover:text-amber-200"
                    >
                      + Baru
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSidebarOpen(false);
                        setViewMode('settings');
                      }}
                      className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200"
                    >
                      Kelola
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {trahList.length === 0 && (
                    <div className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-700 text-[11px] text-stone-400 text-center">
                      Belum ada Trah — klik <strong className="text-amber-300">+ Baru</strong> atau tempel undangan keluarga.
                    </div>
                  )}
                  {trahList.map((t) => {
                    const isCurrent = t.id === activeTrah.id;
                    const linMeta = getLineageBadgeMeta(t.lineageSide);
                    const effRole = getEffectiveTrahRole(t, accountScope.email, accountScope.isOwner);
                    const roleMeta = getTrahRoleMeta(effRole);
                    const coreLinked = getTrahCoreLinkStatus(t).linked;

                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setActiveTrahId(t.id);
                          setIsSidebarOpen(false);
                          showNotification(`Beralih ke ${t.name}`);
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-2 text-left transition ${
                          isCurrent
                            ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-xs'
                            : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span>{linMeta.icon}</span>
                            <span className="font-extrabold text-xs block truncate">{t.name}</span>
                            {coreLinked && (
                              <span title="Tersinkron Hub Keluarga Inti" className="text-[10px]">
                                🔗
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className={`text-[9px] font-bold px-1.5 rounded border ${linMeta.darkBadgeClass}`}>
                              {linMeta.shortTag}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                              {roleMeta.shortLabel}
                            </span>
                            <span className="text-[10px] text-stone-400 font-mono">
                              {t.members.length} Anggota
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Drawer: Akses Cepat ke Menu Setting / Pengaturan */}
            <div className="p-3 border-t border-stone-800 bg-stone-950/60">
              <button
                type="button"
                onClick={() => {
                  setIsSidebarOpen(false);
                  setViewMode('settings');
                }}
                className="w-full py-2.5 px-3 bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-xs"
              >
                <Settings className="w-4 h-4 text-teal-200" />
                <span>Pengaturan, Akun & Cadangan Data</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL ISI CEPAT (KOMMA SEPARATED & AUTO TAMPIL NASAB) */}
      {/* ========================================================= */}
      {isQuickBatchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl border border-stone-200 relative text-stone-800 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsQuickBatchOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-stone-900 flex items-center justify-center font-black">
                  <Zap className="w-4 h-4 fill-stone-900" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900">⚡ Isi Cepat Silsilah (Pakai Koma ,)</h3>
                  <p className="text-[11px] text-stone-500">Ketik nama anak berpemisah koma untuk mendaftarkan kakak/adik sekaligus</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 block">1. Pilih Ayah / Induk Garis Keturunan:</label>
                {activeTrah.members.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuickShowAddParent(!quickShowAddParent)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                  >
                    {quickShowAddParent ? 'Batal' : '+ Tambah Uyut/Ayah Baru'}
                  </button>
                )}
              </div>

              {activeTrah.members.length === 0 || quickShowAddParent ? (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-start gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      {activeTrah.members.length === 0
                        ? `Trah ${activeTrah.name} belum memiliki Leluhur Utama. Masukkan nama Ayah/Uyut (misal: Santa), lalu ketik anak-anaknya di bawah:`
                        : 'Masukkan nama Leluhur Utama (Uyut/Ayah) baru:'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={quickNewRootName}
                      onChange={(e) => setQuickNewRootName(e.target.value)}
                      placeholder={activeTrah.name.toUpperCase().includes('SANTA') ? "Nama Ayah/Uyut (Contoh: Santa)" : "Nama Ayah/Uyut (Contoh: Uyut Santa)"}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-emerald-400 rounded-xl focus:border-emerald-600 outline-hidden font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleCreateQuickRoot}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition shrink-0"
                    >
                      Buat Induk
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={quickParentId || (currentQuickParent ? currentQuickParent.id : '')}
                    onChange={(e) => handleSelectQuickParent(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:border-emerald-500 font-bold outline-hidden"
                  >
                    <option value="" disabled>-- Pilih Ayah / Induk --</option>
                    {activeTrah.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{getKinshipLabel(m.generationLevel)}] {m.name} {m.callName ? `("${m.callName}")` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Tombol Chip Cepat Pilih Ayah / Induk */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-stone-500 font-bold">Pilih Cepat:</span>
                    {sortMembersHierarchically(activeTrah.members).slice(0, 12).map((m) => {
                      const isSelected = (quickParentId || (currentQuickParent ? currentQuickParent.id : '')) === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectQuickParent(m.id)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg font-bold border transition ${
                            isSelected
                              ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs ring-1 ring-emerald-500'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {m.gender === 'P' ? '👩' : '👨'} {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {currentQuickParent && (
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/60 p-3.5 rounded-2xl border border-emerald-300 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Auto Tampil Garis Nasab Vertikal:</span>
                  </span>
                  <span className="text-[10px] bg-emerald-800 text-white font-bold px-2 py-0.5 rounded-full">Tersimpan</span>
                </div>

                <div className="bg-white/90 p-3 rounded-xl border border-emerald-200/80 space-y-1.5 text-xs shadow-2xs font-sans">
                  {currentQuickAncestry.map((step) => (
                    <div key={step.id} className="flex items-center justify-between border-b border-black/5 pb-1 last:border-b-0 last:pb-0">
                      <span className="font-bold text-stone-500 w-28">{getKinshipLabel(step.generationLevel)} :</span>
                      <span className={`flex-1 font-bold ${step.id === currentQuickParent.id ? 'text-emerald-900 text-sm' : 'text-stone-800'}`}>
                        {step.name} {step.callName ? `("${step.callName}")` : ''}
                      </span>
                    </div>
                  ))}

                  {currentQuickParent.spouses && currentQuickParent.spouses.length > 0 && (
                    <div className="flex items-start justify-between border-b border-black/5 pb-1">
                      <span className="font-bold text-stone-500 w-28">Pasangan ({currentQuickParent.spouses.length}) :</span>
                      <div className="flex-1 flex flex-wrap gap-1">
                        {currentQuickParent.spouses.map((sp) => {
                          const badge = getSpouseStatusBadge(sp.status);
                          return (
                            <span key={sp.id} className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.className}`}>
                              {sp.name} ({badge.label})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="pt-1.5 border-t border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-indigo-800 text-[11px]">
                        Anak ({currentQuickExistingChildren.length}) — Ubah Gender &amp; Posisi Kakak/Adik Langsung:
                      </span>
                    </div>
                    {currentQuickExistingChildren.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                        {currentQuickExistingChildren.map((c, cIdx) => {
                          const descCount = getDescendantIds(c.id, activeTrah.members).size;
                          return (
                            <div
                              key={c.id}
                              className="flex items-center justify-between gap-1.5 bg-white border border-indigo-200/80 px-2 py-1 rounded-xl text-[11px] shadow-2xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {cIdx + 1}
                                </span>
                                <span className="font-bold text-stone-900 truncate">{c.name}</span>
                                {descCount > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold shrink-0">
                                    +{descCount} keturunan
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleQuickToggleMemberGender(c)}
                                  title="Klik untuk ubah Pria (L) / Wanita (P)"
                                  className={`px-1.5 py-0.5 rounded-md border text-[10px] font-black transition ${
                                    c.gender === 'P'
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : 'bg-sky-100 text-sky-800 border-sky-300'
                                  }`}
                                >
                                  {c.gender === 'P' ? '👩 P' : '👨 L'}
                                </button>
                                <button
                                  type="button"
                                  disabled={cIdx <= 0}
                                  onClick={() => handleMoveSiblingOrder(c.id, 'up')}
                                  title="Geser ke atas (Kakak) — keturunan ikut otomatis"
                                  className="px-1.5 py-0.5 rounded-md bg-stone-100 hover:bg-amber-200 disabled:opacity-30 border border-stone-300 text-stone-800 font-black text-[10px] transition"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={cIdx >= currentQuickExistingChildren.length - 1}
                                  onClick={() => handleMoveSiblingOrder(c.id, 'down')}
                                  title="Geser ke bawah (Adik) — keturunan ikut otomatis"
                                  className="px-1.5 py-0.5 rounded-md bg-stone-100 hover:bg-amber-200 disabled:opacity-30 border border-stone-300 text-stone-800 font-black text-[10px] transition"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-emerald-900/80 leading-snug pt-0.5">
                          💡 Tekan <strong>↑ / ↓</strong> untuk tukar posisi Kakak–Adik langsung. Semua anak &amp; cucu yang sudah dibuat otomatis ikut tanpa perlu buat ulang.
                        </p>
                      </div>
                    ) : (
                      <span className="text-stone-400 italic text-[11px]">Belum ada anak tercatat</span>
                    )}
                  </div>
                </div>

                {currentQuickExistingChildren.length > 0 && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-stone-600 font-medium">Pilihan Aksi:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickBatchMode('append');
                          setQuickCommaInput('');
                        }}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                          quickBatchMode === 'append' ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-white text-stone-600 border-stone-200'
                        }`}
                      >
                        + Tambah Anak Baru
                      </button>
                      <button
                        type="button"
                        onClick={handleSwitchToEditExistingChildren}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                          quickBatchMode === 'replace' ? 'bg-amber-400 text-stone-900 border-amber-500' : 'bg-white text-stone-600 border-stone-200'
                        }`}
                      >
                        ✏️ Edit Daftar Anak Saat Ini
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveQuickBatch(e, true);
              }}
              className="space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700 block">2. Ketik Nama Anak Dipisahkan Koma (,):</label>
                  <span className="text-[10px] text-stone-500 font-mono">
                    {quickParsedChildren.length > 0 ? `${quickParsedChildren.length} anak terdeteksi` : 'Gunakan pemisah koma / enter'}
                  </span>
                </div>

                <textarea
                  rows={2}
                  value={quickCommaInput}
                  onChange={(e) => setQuickCommaInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSaveQuickBatch(undefined, true);
                    }
                  }}
                  placeholder="Contoh: maman, Ian, Hendri (bisa juga pakai dan, enter, atau titik koma)"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:border-emerald-600 focus:bg-white outline-hidden font-medium resize-none"
                />
              </div>

              {quickParsedChildren.length > 0 && (
                <div className="p-3 bg-stone-100 rounded-xl space-y-2 border border-stone-200">
                  <div className="text-[10px] font-bold uppercase text-stone-600 tracking-wider">
                    Pratinjau Urutan Kakak & Adik (Klik L/P untuk gender, ↑/↓ untuk tukar urutan):
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto">
                    {quickParsedChildren.map((child, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs shadow-2xs">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-full bg-stone-200 flex items-center justify-center font-mono font-bold text-[10px] text-stone-700 shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-stone-900 block truncate">{child.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleParsedGender(idx)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black border transition ${
                              child.gender === 'L' ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-rose-100 text-rose-800 border-rose-300'
                            }`}
                          >
                            {child.gender === 'L' ? '👨 L' : '👩 P'}
                          </button>
                          <button
                            type="button"
                            disabled={idx <= 0}
                            onClick={() => handleMoveQuickParsedChild(idx, 'up')}
                            title="Naikkan jadi Kakak"
                            className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-amber-200 disabled:opacity-30 border border-stone-300 text-stone-800 font-black text-[10px]"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={idx >= quickParsedChildren.length - 1}
                            onClick={() => handleMoveQuickParsedChild(idx, 'down')}
                            title="Turunkan jadi Adik"
                            className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-amber-200 disabled:opacity-30 border border-stone-300 text-stone-800 font-black text-[10px]"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  disabled={quickParsedChildren.length === 0 && !quickCommaInput.trim()}
                  onClick={(e) => handleSaveQuickBatch(e, true)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>💾 Simpan & Tampilkan {quickParsedChildren.length > 0 ? `(${quickParsedChildren.length})` : ''}</span>
                </button>
                <button
                  type="button"
                  disabled={quickParsedChildren.length === 0 && !quickCommaInput.trim()}
                  onClick={(e) => handleSaveQuickBatch(e, false)}
                  className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-stone-900 font-extrabold text-xs shadow-xs transition active:scale-98 flex items-center justify-center gap-1"
                  title="Simpan data ke silsilah dan lanjutkan mengetik anak lainnya"
                >
                  <Zap className="w-3.5 h-3.5 fill-stone-900" />
                  <span>Simpan & Lanjut</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQuickBatchOpen(false)}
                  className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition"
                >
                  Tutup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL FORM STANDARD ADD / EDIT */}
      {/* ========================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveMember}
            className="bg-white rounded-3xl max-w-md w-full p-5 space-y-3.5 shadow-2xl border border-stone-200 relative text-stone-800 max-h-[92vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="font-bold text-sm text-stone-900">
                {formMode === 'add_root' && 'Tambah Uyut (Leluhur Utama)'}
                {formMode === 'add_child' && 'Tambah Anak / Keturunan'}
                {formMode === 'edit' && 'Edit Data Anggota & Pasangan'}
              </h3>
              <p className="text-[10px] text-stone-500">Lengkapi biodata, urutan anak, dan daftar pasangan/istri di {activeTrah.name}</p>
            </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Nama Lengkap & Gelar *</label>
                <input
                  type="text"
                  required
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Contoh: Samud"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden font-medium"
                />
              </div>

              {(formMode === 'edit' || formMode === 'add_child') && (
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1.5">
                  <label className="text-[11px] font-bold text-emerald-950 block">
                    🌳 Orang Tua / Induk Garis Nasab
                  </label>
                  <select
                    value={formParentId || ''}
                    onChange={(e) => setFormParentId(e.target.value ? e.target.value : null)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-emerald-300 rounded-xl focus:border-emerald-600 font-bold outline-hidden"
                  >
                    <option value="">👑 Tidak Ada / Leluhur Utama (Uyut Gen 0)</option>
                    {(() => {
                      const excluded = new Set<string>();
                      if (formMemberId) {
                        excluded.add(formMemberId);
                        getDescendantIds(formMemberId, activeTrah.members).forEach((d) => excluded.add(d));
                      }
                      return sortMembersHierarchically(activeTrah.members)
                        .filter((cand) => !excluded.has(cand.id))
                        .map((cand) => (
                          <option key={cand.id} value={cand.id}>
                            [{getKinshipLabel(cand.generationLevel)}] {cand.name}
                            {cand.callName && cand.callName !== cand.name ? ` ("${cand.callName}")` : ''}
                          </option>
                        ));
                    })()}
                  </select>
                  {formParentId && (() => {
                    const selectedParent = activeTrah.members.find((p) => p.id === formParentId);
                    if (!selectedParent) return null;
                    const parentPath = getAncestryPath(selectedParent, activeTrah.members);
                    return (
                      <div className="text-[10px] text-emerald-800 font-medium leading-snug">
                        Pratinjau Nasab: {parentPath.map((s) => s.name).join(' ➔ ')} ➔ <strong>{nameInput.trim() || '(Anggota ini)'}</strong>
                      </div>
                    );
                  })()}
                </div>
              )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Nama Panggilan</label>
                <input
                  type="text"
                  value={callNameInput}
                  onChange={(e) => setCallNameInput(e.target.value)}
                  placeholder="Bapak Samud"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Urutan (Anak ke-)</label>
                <input
                  type="number"
                  min={1}
                  value={orderIndexInput}
                  onChange={(e) => setOrderIndexInput(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Jenis Kelamin</label>
                <select
                  value={genderInput}
                  onChange={(e) => setGenderInput(e.target.value as 'L' | 'P')}
                  className="w-full px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden font-medium"
                >
                  <option value="L">👨 Laki-laki</option>
                  <option value="P">👩 Perempuan</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Status Keberadaan</label>
                <label className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDeceasedInput}
                    onChange={(e) => setIsDeceasedInput(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span>Telah Wafat</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Tahun Lahir</label>
                <input
                  type="text"
                  maxLength={4}
                  value={birthYearInput}
                  onChange={(e) => setBirthYearInput(e.target.value)}
                  placeholder="1968"
                  className="w-full px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Tahun Wafat</label>
                <input
                  type="text"
                  maxLength={4}
                  disabled={!isDeceasedInput}
                  value={deathYearInput}
                  onChange={(e) => setDeathYearInput(e.target.value)}
                  placeholder={isDeceasedInput ? '2020' : '-'}
                  className="w-full px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Kota / Asal</label>
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder="Yogyakarta"
                  className="w-full px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500"
                />
              </div>
            </div>

            {/* SEKSI FOTO ANGGOTA (GANTI FOTO, AUTO-KOMPRES & AUTO-UPSCALE SAAT CETAK) */}
            <div className="p-3 bg-gradient-to-br from-stone-50 to-emerald-50/40 rounded-2xl border border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-700" />
                  <span>Foto Silsilah (Auto-Kompres & Upscale Cetak)</span>
                </label>
                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                  ⚡ Auto-Kompres Aktif
                </span>
              </div>

              {/* Input File Tersembunyi */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUploadFile}
                className="hidden"
                id="photo-file-upload"
              />

              <div className="flex items-center gap-3">
                {/* Preview Foto Thumbnail */}
                <div className="relative shrink-0">
                  {photoUrlInput ? (
                    <img
                      src={photoUrlInput}
                      alt="Pratinjau"
                      className={`w-14 h-14 object-cover border-2 border-emerald-500 shadow-sm ${getShapeClass(photoShape)}`}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className={`w-14 h-14 bg-stone-100 text-stone-400 border-2 border-dashed border-stone-300 flex flex-col items-center justify-center font-bold text-xs ${getShapeClass(
                        photoShape
                      )}`}
                    >
                      <Image className="w-5 h-5 text-stone-400 mb-0.5" />
                      <span className="text-[9px] font-mono">Kosong</span>
                    </div>
                  )}

                  {photoUrlInput && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-700 text-white p-0.5 rounded-full shadow-xs"
                      title="Hapus Foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Tombol Unggah & Keterangan */}
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap gap-1.5">
                    <label
                      htmlFor="photo-file-upload"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-[11px] rounded-xl cursor-pointer shadow-xs transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{photoUrlInput ? 'Ganti Foto' : 'Pilih Foto Galeri/Kamera'}</span>
                    </label>

                    {photoUrlInput && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[10px] rounded-xl transition"
                      >
                        Hapus
                      </button>
                    )}
                  </div>

                  {isCompressingPhoto && (
                    <div className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Mengompres foto otomatis...</span>
                    </div>
                  )}

                  {photoCompressionInfo && (
                    <div className="text-[10px] text-emerald-800 font-mono bg-emerald-100/70 px-2 py-0.5 rounded-lg w-fit">
                      Terkoreksi: {photoCompressionInfo.orig} KB ➔ {photoCompressionInfo.comp} KB (Hemat 
                      {' ' + Math.round((1 - photoCompressionInfo.comp / photoCompressionInfo.orig) * 100)}%)
                    </div>
                  )}

                  <p className="text-[9px] text-stone-500 leading-tight">
                    💡 Foto otomatis dikompres ke format ringan saat simpan agar tidak memberatkan memori, dan otomatis di-upscale tajam (high-res filter) saat dicetak/download poster A0-A4.
                  </p>
                </div>
              </div>

              {/* Opsi masukkan URL manual jika punya link online */}
              <div className="pt-1.5 border-t border-stone-200">
                <details className="text-[10px] text-stone-600">
                  <summary className="cursor-pointer font-bold hover:text-stone-900">
                    Atau gunakan Link / URL Foto Web (Opsional)
                  </summary>
                  <div className="mt-1.5 flex gap-1">
                    <input
                      type="url"
                      value={photoUrlInput.startsWith('data:') ? '' : photoUrlInput}
                      onChange={(e) => {
                        setPhotoUrlInput(e.target.value);
                        setPhotoCompressionInfo(null);
                      }}
                      placeholder="https://contoh.com/foto.jpg"
                      className="flex-1 px-2.5 py-1 text-xs bg-white border border-stone-300 rounded-lg outline-hidden"
                    />
                  </div>
                </details>
              </div>
            </div>

            {/* Kelola Pasangan / Istri > 1 */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800">💍 Pasangan / Istri (Bisa &gt; 1 &amp; Cerai):</label>
                <button
                  type="button"
                  onClick={handleAddFormSpouse}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-300 px-2 py-0.5 rounded-lg shadow-2xs"
                >
                  + Tambah Pasangan
                </button>
              </div>

              {formSpouses.map((sp, sIdx) => (
                <div key={sp.id} className="p-2.5 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-stone-600">Pasangan ke-{sIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFormSpouse(sIdx)}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold"
                    >
                      Hapus
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      required
                      value={sp.name}
                      onChange={(e) => handleUpdateFormSpouse(sIdx, 'name', e.target.value)}
                      placeholder="Nama Pasangan (Contoh: Ibu Rohani)"
                      className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg outline-hidden font-medium"
                    />
                    <select
                      value={sp.status}
                      onChange={(e) => handleUpdateFormSpouse(sIdx, 'status', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg outline-hidden font-bold"
                    >
                      <option value="menikah">💍 Menikah (Masih bersama)</option>
                      <option value="cerai_hidup">💔 Cerai Hidup</option>
                      <option value="cerai_mati">🕊️ Cerai Mati / Wafat</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">Catatan / Keterangan</label>
              <textarea
                rows={2}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Catatan profesi atau sejarah..."
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-200">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition active:scale-98"
              >
                Simpan ke Silsilah
              </button>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. MODAL DETAIL ANGGOTA & GANTI FOTO CEPAT */}
      {/* ========================================================= */}
      {isDetailModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-stone-200 relative text-stone-800">
            <button
              onClick={() => {
                setIsDetailModalOpen(false);
                setSelectedMember(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Profil & Foto */}
            <div className="flex flex-col items-center text-center pt-2">
              <div className="relative group">
                {selectedMember.photoUrl ? (
                  <img
                    src={selectedMember.photoUrl}
                    alt={selectedMember.name}
                    className={`w-20 h-20 object-cover shadow-md border-2 border-emerald-500 ${getShapeClass(photoShape)}`}
                  />
                ) : (
                  <div
                    className={`w-20 h-20 bg-emerald-100 text-emerald-800 font-black text-xl flex items-center justify-center border-2 border-emerald-300 shadow-md ${getShapeClass(
                      photoShape
                    )}`}
                  >
                    {selectedMember.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => {
                    handleOpenEdit(selectedMember);
                    setIsDetailModalOpen(false);
                  }}
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-700 text-white shadow hover:bg-emerald-800 active:scale-95 transition"
                  title="Ganti Foto Anggota"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <h3 className="font-extrabold text-base text-stone-900 mt-2">{selectedMember.name}</h3>
              {selectedMember.callName && (
                <p className="text-xs text-stone-500 font-medium font-sans">"{selectedMember.callName}"</p>
              )}

              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getGenerationMeta(selectedMember.generationLevel).badgeBg}`}>
                  {getKinshipLabel(selectedMember.generationLevel)}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    selectedMember.isDeceased ? 'bg-stone-200 text-stone-700' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedMember.isDeceased ? '🕊️ Almarhum' : '🌿 Hidup'}
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickToggleMemberGender(selectedMember)}
                  title="Klik untuk mengubah Pria / Wanita"
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition active:scale-95 ${
                    selectedMember.gender === 'P'
                      ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                  }`}
                >
                  {selectedMember.gender === 'L' ? '👨 Laki-laki' : '👩 Perempuan'}
                </button>
              </div>
            </div>

            {/* Info Nasab & Biodata */}
            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-1.5 text-xs">
              <div className="flex justify-between border-b border-stone-200/60 pb-1">
                <span className="text-stone-500">Tahun Lahir - Wafat:</span>
                <span className="font-mono font-bold text-stone-800">
                  {selectedMember.birthYear || '?'} - {selectedMember.deathYear || (selectedMember.isDeceased ? 'Wafat' : 'Sekarang')}
                </span>
              </div>

              {selectedMember.spouses && selectedMember.spouses.length > 0 && (
                <div className="border-b border-stone-200/60 pb-1">
                  <span className="text-stone-500 block mb-1">💍 Pasangan / Istri:</span>
                  <div className="space-y-1">
                    {selectedMember.spouses.map((sp) => {
                      const badge = getSpouseStatusBadge(sp.status);
                      return (
                        <div key={sp.id} className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-stone-200 text-[11px]">
                          <span className="font-bold text-stone-800">
                            {sp.orderIndex > 1 ? `Istri ke-${sp.orderIndex}: ` : ''}
                            {sp.name}
                          </span>
                          <span className={`px-1 rounded text-[8px] font-bold border ${badge.className}`}>{badge.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedMemberChildren.length > 0 && (
                <div className="pt-0.5">
                  <span className="text-stone-500 block mb-1">👶 Anak / Keturunan ({selectedMemberChildren.length}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMemberChildren.map((c, cIdx) => (
                      <div key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-stone-200 text-[11px] font-bold text-stone-800">
                        <span>{cIdx + 1}.</span>
                        <span>{c.gender === 'P' ? '👩' : '👨'}</span>
                        <span>{c.name}</span>
                        {selectedMemberChildren.length > 1 && (
                          <span className="inline-flex items-center gap-0.5 ml-0.5">
                            <button
                              type="button"
                              disabled={cIdx <= 0}
                              onClick={() => handleMoveSiblingOrder(c.id, 'up')}
                              className="px-1 rounded bg-stone-100 hover:bg-amber-200 disabled:opacity-30 text-[9px] font-black border border-stone-300"
                              title="Naikkan urutan (Kakak)"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={cIdx >= selectedMemberChildren.length - 1}
                              onClick={() => handleMoveSiblingOrder(c.id, 'down')}
                              className="px-1 rounded bg-stone-100 hover:bg-amber-200 disabled:opacity-30 text-[9px] font-black border border-stone-300"
                              title="Turunkan urutan (Adik)"
                            >
                              ↓
                            </button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedMember.notes && (
                <div className="pt-1 border-t border-stone-200/60 text-stone-600 text-[11px] italic">
                  "{selectedMember.notes}"
                </div>
              )}
            </div>

            {/* Klaim Identitas Diri & Sinkron Hub Keluarga Inti */}
            {selectedMember.coreRefId && (
              <div className="px-3 py-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-bold flex items-center justify-between gap-2">
                <span>🔗 Terhubung ke Hub Keluarga Inti (Edit otomatis sinkron lintas Trah)</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setNuclearHubPreselect(null);
                    setIsNuclearHubOpen(true);
                  }}
                  className="px-2 py-0.5 rounded-lg bg-teal-700 text-white text-[10px] font-extrabold shrink-0"
                >
                  Buka Hub
                </button>
              </div>
            )}

            <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 space-y-2">
              {selectedMember.claimedByName ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="truncate">Diklaim oleh: {selectedMember.claimedByName}</span>
                    </p>
                    <p className="text-[10px] text-emerald-700 truncate">
                      {selectedMember.claimedByEmail || 'Akun Terverifikasi'}
                    </p>
                  </div>
                  {(selectedMember.claimedByEmail === (accountScope.email || accountProfile.email || `akun-${accountScope.scopeKey}`) ||
                    canManageTrahAdmin(activeTrah, accountScope.email, accountScope.isOwner)) && (
                    <button
                      type="button"
                      onClick={() => handleUnclaimMember(selectedMember)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold shrink-0 transition"
                    >
                      Lepas Klaim
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-stone-800">Apakah ini profil Anda?</p>
                    <p className="text-[10px] text-stone-500">Tandai sebagai akun Anda &amp; kunci edit dari akun non-pengurus.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleClaimMember(selectedMember)}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] flex items-center gap-1 shrink-0 shadow-2xs transition active:scale-95"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Klaim Saya</span>
                  </button>
                </div>
              )}
            </div>

            {/* Aksi */}
            {(() => {
              const detailEditPerm = canEditTrahMember(
                activeTrah,
                selectedMember,
                accountScope.email,
                accountScope.isOwner
              );
              const detailRole = getEffectiveTrahRole(
                activeTrah,
                accountScope.email,
                accountScope.isOwner
              );
              return (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleOpenEdit(selectedMember);
                        if (detailEditPerm.ok) setIsDetailModalOpen(false);
                      }}
                      title={detailEditPerm.ok ? 'Ubah foto atau biodata' : detailEditPerm.reason}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        detailEditPerm.ok
                          ? 'bg-amber-400 hover:bg-amber-500 text-stone-950'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {detailEditPerm.ok ? <Edit3 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{detailEditPerm.ok ? 'Ganti Foto / Edit Data' : 'Edit Terkunci'}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleOpenQuickBatch(selectedMember);
                        if (detailRole !== 'viewer') setIsDetailModalOpen(false);
                      }}
                      className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition active:scale-95 ${
                        detailRole === 'viewer'
                          ? 'bg-stone-200 text-stone-500'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>+ Anak</span>
                    </button>
                  </div>

                  {detailRole !== 'viewer' && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        setNuclearHubPreselect({ trahId: activeTrah.id, parentId: selectedMember.id });
                        setIsNuclearHubOpen(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition"
                    >
                      <Users className="w-3.5 h-3.5 text-teal-700" />
                      <span>Tempel Keluarga Inti Saya sebagai Anak dari {selectedMember.name}</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. MODAL UNDANGAN MEDSOS (BARCODE QR, WHATSAPP, SALIN LINK) */}
      {/* ========================================================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-3.5 shadow-2xl border border-stone-200 relative text-stone-800 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsInviteModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                  Undangan Silsilah &amp; Barcode QR
                </h3>
                <p className="text-[11px] text-stone-500">
                  Bagikan Barcode QR (anti-gagal / offline) atau Link ke saudara
                </p>
              </div>
            </div>

            {/* Peringatan jika dibuka dari URL Developer Privat (ais-dev-*) */}
            {isPrivateDevHost() && !customPublicBaseInput && (
              <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold">Kenapa link tidak bisa diakses orang lain?</span>{' '}
                    Domain saat ini adalah URL preview privat (<code className="font-mono text-[10px]">ais-dev-...</code>) yang terkunci akun developer.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDomainConfig((v) => !v)}
                  className="text-[10px] font-extrabold text-emerald-800 underline"
                >
                  {showDomainConfig ? 'Tutup Pengaturan URL Publik' : 'Atur URL Publik Aplikasi (ais-pre / GitHub Pages)'}
                </button>
              </div>
            )}

            {(showDomainConfig || customPublicBaseInput) && (
              <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold text-stone-700 uppercase">
                    URL Publik Tujuan Undangan
                  </span>
                  {customPublicBaseInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPublicBaseUrl('');
                        setCustomPublicBaseInput('');
                        const target = inviteTrahTarget || activeTrah;
                        setShortInviteUrl(InviteRelayService.buildTitleInviteUrl('trah', target.name).url);
                        showNotification('URL publik dikembalikan ke alamat browser saat ini.');
                      }}
                      className="text-[10px] font-bold text-rose-600 hover:underline"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={customPublicBaseInput}
                    onChange={(e) => setCustomPublicBaseInput(e.target.value)}
                    placeholder="Contoh: https://ais-pre-...run.app/ atau https://user.github.io/WargaQu/"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] bg-white border border-stone-300 rounded-xl outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const saved = setCustomPublicBaseUrl(customPublicBaseInput);
                      setCustomPublicBaseInput(saved);
                      const target = inviteTrahTarget || activeTrah;
                      setShortInviteUrl(InviteRelayService.buildTitleInviteUrl('trah', target.name).url);
                      if (saved) {
                        setShowDomainConfig(false);
                        showNotification(`URL publik disetel ke ${saved}`);
                      } else {
                        showNotification('Masukkan URL lengkap diawali https://');
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-700 text-white text-[10px] font-extrabold shrink-0"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}

            {/* Pilihan Trah Yang Ingin Diundang */}
            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1.5">
                Pilih Trah yang Diundang:
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                {trahList.map((t) => {
                  const isSel = (inviteTrahTarget || activeTrah)?.id === t.id;
                  const linMeta = getLineageBadgeMeta(t.lineageSide);

                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setInviteTrahTarget(t);
                        setInviteAccessRole(t.invitePolicy?.role || 'member');
                        setInviteExpiryHours(t.invitePolicy?.expiryHours ?? 168);
                      }}
                      className={`p-2 rounded-xl border text-left transition ${
                        isSel
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-extrabold ring-1 ring-emerald-500'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-1 text-xs">
                        <span>{linMeta.icon}</span>
                        <span className="truncate">{t.name.split('(')[0]}</span>
                      </div>
                      <span className="text-[9px] text-stone-500 block truncate">
                        {linMeta.shortTag} • {t.members.length} anggota
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kontrol Keamanan Undangan: Hak Akses, Masa Berlaku & Putar Versi QR */}
            {(() => {
              const target = inviteTrahTarget || activeTrah;
              const isTargetAdmin = canManageTrahAdmin(target, accountScope.email, accountScope.isOwner);
              const currentVersion = target.invitePolicy?.version || 1;
              return (
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold text-stone-800 uppercase tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Hak Akses &amp; Masa Berlaku Undangan</span>
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-200 text-stone-700">
                      Versi QR v{currentVersion}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {(['viewer', 'member', 'admin'] as TrahAccessRole[]).map((roleKey) => {
                      const rm = getTrahRoleMeta(roleKey);
                      const isPicked = inviteAccessRole === roleKey;
                      return (
                        <button
                          key={roleKey}
                          type="button"
                          disabled={!isTargetAdmin}
                          onClick={() => setInviteAccessRole(roleKey)}
                          className={`py-1.5 px-2 rounded-xl border text-center transition disabled:opacity-60 ${
                            isPicked
                              ? 'bg-emerald-700 text-white border-emerald-700 font-extrabold shadow-2xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 font-semibold'
                          }`}
                        >
                          <div className="text-[10px] leading-tight">{rm.shortLabel}</div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-stone-500 leading-snug">
                    {getTrahRoleMeta(inviteAccessRole).description}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <div className="flex items-center gap-1 flex-1 min-w-[150px]">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <select
                        disabled={!isTargetAdmin}
                        value={inviteExpiryHours}
                        onChange={(e) => setInviteExpiryHours(Number(e.target.value))}
                        className="w-full px-2 py-1 text-[11px] bg-white border border-stone-300 rounded-xl font-bold text-stone-800 outline-hidden disabled:opacity-60"
                      >
                        {INVITE_EXPIRY_OPTIONS.map((opt) => (
                          <option key={opt.hours} value={opt.hours}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isTargetAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextVer = currentVersion + 1;
                          markInviteVersionRevoked(accountScope.scopeKey, target.id, nextVer);
                          const updatedPolicy: TrahInvitePolicy = {
                            role: inviteAccessRole,
                            expiryHours: inviteExpiryHours,
                            version: nextVer,
                          };
                          const nextList = trahList.map((item) =>
                            item.id === target.id ? { ...item, invitePolicy: updatedPolicy } : item
                          );
                          setTrahList(nextList);
                          flushTrahListToStorage(nextList);
                          const updatedTarget = nextList.find((item) => item.id === target.id) || target;
                          setInviteTrahTarget(updatedTarget);
                          appendActivityLog({
                            trahId: target.id,
                            trahName: target.name,
                            actionType: 'invite_share',
                            targetName: `QR v${nextVer}`,
                            summary: `Mematikan QR/Link lama & memutar kode undangan ke v${nextVer}`,
                            details: `Semua undangan sebelum versi v${nextVer} ditolak otomatis.`,
                          });
                          showNotification(`QR & Link lama dimatikan! Kode undangan baru v${nextVer} aktif. 🔄`);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-extrabold flex items-center gap-1 shrink-0 transition"
                        title="Batalkan semua QR/link yang sebelumnya dibagikan"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Matikan QR Lama &amp; Putar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Tab Pilihan: Barcode QR vs Link Undangan */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 rounded-2xl border border-stone-200">
              <button
                type="button"
                onClick={() => setInviteShareTab('barcode')}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  inviteShareTab === 'barcode'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Barcode / QR Code</span>
              </button>
              <button
                type="button"
                onClick={() => setInviteShareTab('link')}
                className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  inviteShareTab === 'link'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Link &amp; Pesan WA</span>
              </button>
            </div>

            {(() => {
              const target = inviteTrahTarget || activeTrah;
              const inviteMetaPolicy: Partial<TrahInvitePolicy> = {
                role: inviteAccessRole,
                expiryHours: inviteExpiryHours,
                version: target.invitePolicy?.version || 1,
              };
              const fallbackToken = encodeTrahInviteToken(
                target,
                accountProfile.displayName || 'Keluarga',
                inviteMetaPolicy,
                accountScope.email
              );
              const activeToken = compactInviteToken || fallbackToken;
              const titleLinkObj = InviteRelayService.buildTitleInviteUrl('trah', target.name);
              const titleSyncLink = shortInviteUrl || titleLinkObj.url;
              const selfContainedLink = InviteRelayService.buildSelfContainedTrahUrl(
                target.name,
                activeToken
              );
              const inviteLink =
                inviteLinkMode === 'self_contained' ? selfContainedLink : titleSyncLink;

              // Untuk QR: pakai URL mandiri jika muat (<= 1950 char), atau token langsung jika <= 2200 char, selain itu link sinkronisasi
              const qrPayload =
                selfContainedLink.length <= 1950
                  ? selfContainedLink
                  : activeToken.length <= 2200
                  ? activeToken
                  : titleSyncLink;
              const isQrSelfContained =
                selfContainedLink.length <= 1950 || activeToken.length <= 2200;

              const roleLabelText = getTrahRoleMeta(inviteAccessRole).shortLabel;
              const expiryLabelText = formatInviteExpiryLabel(inviteExpiryHours);
              const inviteText = `Undangan Silsilah *${target.name}* (${target.members.length} anggota) di LeluhurQu.\nHak Akses: ${roleLabelText} • ${expiryLabelText}\nKlik link berikut untuk langsung membuka silsilah:\n${inviteLink}`;

              const recordShareLog = (channel: string) => {
                appendActivityLog({
                  trahId: target.id,
                  trahName: target.name,
                  actionType: 'invite_share',
                  targetName: channel,
                  summary: `Membagikan undangan Trah "${target.name}" (${roleLabelText}, ${expiryLabelText}) via ${channel}`,
                  details: `${target.members.length} anggota • QR v${target.invitePolicy?.version || 1}.`,
                });
              };

              return (
                <>
                  {inviteShareTab === 'barcode' ? (
                    <TrahQrCodeCard
                      trahName={target.name}
                      memberCount={target.members.length}
                      qrPayload={qrPayload}
                      isSelfContained={isQrSelfContained}
                      roleLabel={roleLabelText}
                      expiryLabel={expiryLabelText}
                      onNotify={showNotification}
                      onAfterDownload={() => recordShareLog('Barcode QR PNG')}
                    />
                  ) : (
                    <>
                      {/* Pemilih Jenis Link */}
                      <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                            <Link2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Pilih Format Link Undangan</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(activeToken);
                              recordShareLog('Salin Kode Offline');
                              showNotification('Kode offline lengkap disalin!');
                            }}
                            className="text-[10px] font-bold text-emerald-800 hover:underline"
                          >
                            Salin Kode Offline
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInviteLinkMode('self_contained')}
                            className={`px-2 py-1.5 rounded-xl text-[10px] font-extrabold border text-left transition ${
                              inviteLinkMode === 'self_contained'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-stone-700 border-emerald-200'
                            }`}
                          >
                            <div>Link Mandiri (Anti-Gagal)</div>
                            <div className="text-[9px] font-normal opacity-85">
                              Bisa dibuka meski host offline / beda server
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInviteLinkMode('title_sync')}
                            className={`px-2 py-1.5 rounded-xl text-[10px] font-extrabold border text-left transition ${
                              inviteLinkMode === 'title_sync'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-stone-700 border-emerald-200'
                            }`}
                          >
                            <div>Link Judul Ringkas</div>
                            <div className="text-[9px] font-normal opacity-85">
                              URL pendek (?trah=...), butuh host/relay aktif
                            </div>
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            readOnly
                            value={inviteLink}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] font-mono bg-white border border-emerald-300 rounded-xl text-stone-700 outline-hidden select-all"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(inviteLink);
                              recordShareLog('Salin Link');
                              showNotification('Link undangan Trah disalin!');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] shrink-0 transition"
                          >
                            Salin Link
                          </button>
                        </div>
                      </div>

                      {/* Preview Pesan WhatsApp */}
                      <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-1.5">
                        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                          Pratinjau Pesan Siap Kirim:
                        </span>
                        <div className="bg-white p-2.5 rounded-xl border border-stone-200 text-xs text-stone-700 leading-relaxed font-sans shadow-2xs whitespace-pre-wrap select-text max-h-24 overflow-y-auto">
                          {inviteText}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Tombol Bagikan ke WhatsApp, ChatQu Warga, dan Salin Pesan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        recordShareLog('WhatsApp');
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(inviteText)}`, '_blank');
                        showNotification('Membuka WhatsApp untuk mengirim undangan trah! 💬');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
                    >
                      <MessageCircle className="w-4 h-4 fill-white" />
                      <span>Kirim WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteText);
                        recordShareLog('ChatQu Warga');
                        if (onOpenChatQu) {
                          setIsInviteModalOpen(false);
                          onOpenChatQu();
                          showNotification('Link undangan disalin & membuka ChatQu Warga! 📢');
                        } else {
                          showNotification('Link undangan disalin. Buka ChatQu melalui menu utama WargaQu');
                        }
                      }}
                      className="py-2.5 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>ChatQu Warga</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteText);
                        recordShareLog('Salin Pesan');
                        showNotification('Pesan & link berhasil disalin! 📋');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition border border-stone-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Pesan</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. MODAL TAUTKAN PASANGAN (4 HINGGA 8+ PILAR TRAH)        */}
      {/* ========================================================= */}
      {isSpouseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveSpouseLink}
            className="bg-white rounded-3xl max-w-md w-full p-5 space-y-3.5 shadow-2xl border border-stone-200 relative text-stone-800 max-h-[92vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setIsSpouseModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 text-white flex items-center justify-center shadow">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900">
                  Tautkan Silsilah Pasangan (4–8+ Trah)
                </h3>
                <p className="text-[11px] text-stone-500">
                  Menghubungkan Trah Ayah &amp; Ibu Pasangan hingga jalur Kakek/Nenek (Total 8+ Pilar)
                </p>
              </div>
            </div>

            <div className="p-3 bg-gradient-to-br from-amber-50 to-rose-50 rounded-2xl border border-amber-200 space-y-1.5 text-xs">
              <span className="font-bold text-amber-950 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Struktur Pilar Silsilah (4 Utama + Opsional 4 Kakek/Nenek):</span>
              </span>
              <ul className="list-disc pl-4 space-y-0.5 text-stone-700 text-[11px]">
                <li><strong className="text-sky-800">Pilar 1–2:</strong> Trah Ayah &amp; Ibu Anda (termasuk jalur Kakek/Nenek User)</li>
                <li><strong className="text-amber-800">Pilar 3:</strong> Trah Ayah Pasangan (Mertua Laki-laki)</li>
                <li><strong className="text-purple-800">Pilar 4:</strong> Trah Ibu Pasangan (Mertua Perempuan)</li>
                <li><strong className="text-teal-800">Pilar 5–8+:</strong> Jalur Kakek/Nenek dari Ayah &amp; Ibu Pasangan</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Nama Pasangan (Suami / Istri) *
                </label>
                <input
                  type="text"
                  required
                  value={spouseNameInput}
                  onChange={(e) => setSpouseNameInput(e.target.value)}
                  placeholder="Contoh: Ibu Rohani / Neng Sari"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Nama Ayah dari Pasangan (Mertua Laki-laki)
                </label>
                <input
                  type="text"
                  value={spouseAyahNameInput}
                  onChange={(e) => setSpouseAyahNameInput(e.target.value)}
                  placeholder="Contoh: Bapak Suwandi"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Nama Ibu dari Pasangan (Mertua Perempuan)
                </label>
                <input
                  type="text"
                  value={spouseIbuNameInput}
                  onChange={(e) => setSpouseIbuNameInput(e.target.value)}
                  placeholder="Contoh: Ibu Nurhayati"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden"
                />
              </div>

              {/* Ekspansi Opsional 4 Jalur Kakek/Nenek Pasangan (Total 8 Trah) */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-2.5 space-y-2">
                <button
                  type="button"
                  onClick={() => setSpouseGrandparentsExpanded((v) => !v)}
                  className="w-full flex items-center justify-between text-[11px] font-extrabold text-emerald-900"
                >
                  <span>💍 Tambah 4 Jalur Kakek &amp; Nenek Pasangan (Opsional → 8 Trah)</span>
                  {spouseGrandparentsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {spouseGrandparentsExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-200">
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-0.5">Kakek dari Ayah Pasangan</label>
                      <input
                        type="text"
                        value={spouseKakekAyahInput}
                        onChange={(e) => setSpouseKakekAyahInput(e.target.value)}
                        placeholder="Opsional: Mbah ... "
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-xl outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-0.5">Nenek dari Ayah Pasangan</label>
                      <input
                        type="text"
                        value={spouseNenekAyahInput}
                        onChange={(e) => setSpouseNenekAyahInput(e.target.value)}
                        placeholder="Opsional: Nyai ... "
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-xl outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-0.5">Kakek dari Ibu Pasangan</label>
                      <input
                        type="text"
                        value={spouseKakekIbuInput}
                        onChange={(e) => setSpouseKakekIbuInput(e.target.value)}
                        placeholder="Opsional: Mbah ... "
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-xl outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-stone-600 block mb-0.5">Nenek dari Ibu Pasangan</label>
                      <input
                        type="text"
                        value={spouseNenekIbuInput}
                        onChange={(e) => setSpouseNenekIbuInput(e.target.value)}
                        placeholder="Opsional: Nyai ... "
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-200 rounded-xl outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-200">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-extrabold text-xs shadow-md transition active:scale-98 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Simpan &amp; Aktifkan Pilar Trah</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSpouseModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* 10. MODAL TAMBAH TRAH MODULAR (TERINTEGRASI LINTAS SUBMENU) */}
      {/* ========================================================= */}
      {isAddTrahModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveTrah}
            className="bg-white rounded-3xl max-w-md w-full p-5 space-y-3.5 shadow-2xl border border-stone-200 relative text-stone-800 max-h-[92vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setIsAddTrahModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 pr-7">
              <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-stone-900">Buat Trah Modular Baru</h3>
                <p className="text-[10px] text-stone-500">
                  Isi sekali — otomatis terhubung ke Kanvas Grid, Tabel Excel, Medsos TrahBook &amp; Buku PDF
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Nama Trah *</label>
                <input
                  type="text"
                  required
                  value={newTrahName}
                  onChange={(e) => setNewTrahName(e.target.value)}
                  placeholder="Contoh: TRAH KASAN (IBU)"
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">Kategori Garis Pilar</label>
                <select
                  value={newTrahLineage}
                  onChange={(e) => setNewTrahLineage(e.target.value as LineageSide)}
                  className="w-full px-2.5 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 font-bold outline-hidden"
                >
                  {LINEAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">Deskripsi Trah</label>
              <textarea
                rows={2}
                value={newTrahDesc}
                onChange={(e) => setNewTrahDesc(e.target.value)}
                placeholder="Garis leluhur dari kakek nenek pihak ibu..."
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 focus:bg-white outline-hidden resize-none"
              />
            </div>

            {/* Isi Cepat Silsilah Awal (Opsional) */}
            <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Isi Cepat Silsilah Awal (Opsional)</span>
                </span>
                <span className="text-[9px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                  Sync Grid &amp; Excel
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold text-stone-600 block mb-0.5">
                    Leluhur Utama / Uyut (Gen 0)
                  </label>
                  <input
                    type="text"
                    value={newTrahRootName}
                    onChange={(e) => setNewTrahRootName(e.target.value)}
                    placeholder="Contoh: Buyut Kasan"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-200 rounded-xl focus:border-emerald-500 outline-hidden font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-600 block mb-0.5">Gender</label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setNewTrahRootGender('L')}
                      className={`py-1.5 rounded-xl text-[11px] font-bold border ${
                        newTrahRootGender === 'L'
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      L
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTrahRootGender('P')}
                      className={`py-1.5 rounded-xl text-[11px] font-bold border ${
                        newTrahRootGender === 'P'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-stone-600 border-stone-200'
                      }`}
                    >
                      P
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                <div>
                  <label className="text-[10px] font-bold text-stone-600 block mb-0.5">
                    Pasangan Leluhur Utama
                  </label>
                  <input
                    type="text"
                    value={newTrahRootSpouse}
                    onChange={(e) => setNewTrahRootSpouse(e.target.value)}
                    placeholder="Contoh: Nyai Siti"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-200 rounded-xl focus:border-emerald-500 outline-hidden"
                  />
                </div>
                <label className="flex items-center gap-2 text-[11px] font-semibold text-stone-700 pt-3 sm:pt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTrahRootDeceased}
                    onChange={(e) => setNewTrahRootDeceased(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-700"
                  />
                  <span>Sudah Almarhum / Wafat</span>
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] font-bold text-stone-600">
                    Daftar Anak / Gen 1 (pisahkan koma, pakai (P)/(L))
                  </label>
                  {newTrahChildrenInput.trim() && (
                    <span className="text-[9px] font-bold text-emerald-700">
                      {parseCommaChildren(newTrahChildrenInput).length} anak terdeteksi
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={newTrahChildrenInput}
                  onChange={(e) => setNewTrahChildrenInput(e.target.value)}
                  placeholder="Contoh: Sari (P), Budi (L), Rohani (P)"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-200 rounded-xl focus:border-emerald-500 outline-hidden"
                />
              </div>
            </div>

            {/* Integrasi Submenu Tujuan */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newTrahCreateIntroPost}
                  onChange={(e) => setNewTrahCreateIntroPost(e.target.checked)}
                  className="rounded border-stone-300 text-blue-600"
                />
                <span>Otomatis buat pengumuman pembuka di Medsos TrahBook</span>
              </label>

              <div>
                <label className="text-[10px] font-bold text-stone-500 block mb-1">
                  Setelah simpan, langsung buka submenu:
                </label>
                <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
                  {[
                    { id: 'grid', label: '🎨 Grid' },
                    { id: 'excel', label: '📑 Excel' },
                    { id: 'feed', label: '💬 Medsos' },
                    { id: 'stay', label: 'Tetap' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewTrahTargetView(opt.id as 'stay' | 'grid' | 'excel' | 'feed')}
                      className={`py-1.5 px-1 rounded-xl border transition ${
                        newTrahTargetView === opt.id
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-stone-200">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md transition active:scale-98"
              >
                Simpan &amp; Sinkron Semua Submenu
              </button>
              <button
                type="button"
                onClick={() => setIsAddTrahModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* 11. MODAL BUKU LELUHUR (PRATINJAU & EKSPOR PDF A4/A5/A6)  */}
      {/* ========================================================= */}
      <LeluhurBookModal
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        activeTrah={activeTrah}
        accountProfile={accountProfile}
        showNotification={showNotification}
      />

      <NuclearFamilyHubModal
        isOpen={isNuclearHubOpen}
        onClose={() => {
          setIsNuclearHubOpen(false);
          setNuclearHubPreselect(null);
        }}
        hub={nuclearHub}
        trahList={trahList}
        currentEmail={accountScope.email}
        isOwner={accountScope.isOwner}
        preselectTarget={nuclearHubPreselect}
        onCompressPhoto={(file) => compressImageFile(file, 400, 0.82)}
        onSaveAndSyncAll={handleSaveAndSyncNuclearHubAll}
        onGraftToSingleTrah={handleGraftNuclearHubToSingleTrah}
        showNotification={showNotification}
      />

      <TrahQrScannerModal
        open={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onDetectedPayload={(rawPayload) => handleAcceptTrahInvite(rawPayload, true)}
        onNotify={showNotification}
      />

      <ModularFeeSheet
        isOpen={exportFeeModal.open}
        moduleId="leluhurqu_export"
        actionLabel={exportFeeModal.actionLabel}
        unlockModule={true}
        onClose={() => setExportFeeModal({ open: false, actionLabel: '', onPaidCallback: null })}
        onPaid={() => {
          const cb = exportFeeModal.onPaidCallback;
          setExportFeeModal({ open: false, actionLabel: '', onPaidCallback: null });
          if (cb) cb();
        }}
        showNotification={showNotification}
      />
    </div>
  );
};

