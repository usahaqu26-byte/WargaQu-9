export interface SpouseInfo {
  id: string;
  name: string;
  orderIndex: number;
  status: 'menikah' | 'cerai_hidup' | 'cerai_mati';
  marriageYear?: string;
  divorceYear?: string;
  photoUrl?: string;
  notes?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  callName?: string;
  birthYear?: string;
  deathYear?: string;
  city?: string;
  isDeceased: boolean;
  photoUrl?: string;
  gender: 'L' | 'P';
  notes?: string;
  parentId?: string | null;
  generationLevel: number;
  orderIndex?: number;
  spouses?: SpouseInfo[];
  claimedByEmail?: string;
  claimedByName?: string;
  claimedAt?: string;
  /** Referensi sinkronisasi otomatis ke Hub Keluarga Inti Terpusat */
  coreRefId?: string;
}

export type LineageSide =
  | 'ayah_user'
  | 'ibu_user'
  | 'kakek_ayah_user'
  | 'nenek_ayah_user'
  | 'kakek_ibu_user'
  | 'nenek_ibu_user'
  | 'ayah_pasangan'
  | 'ibu_pasangan'
  | 'kakek_ayah_pasangan'
  | 'nenek_ayah_pasangan'
  | 'kakek_ibu_pasangan'
  | 'nenek_ibu_pasangan'
  | 'umum';

export type TrahAccessRole = 'admin' | 'member' | 'viewer';

export interface TrahInvitePolicy {
  version: number;
  role: TrahAccessRole;
  expiryHours: number; // 0 = permanen
}

export interface TrahCategory {
  id: string;
  name: string;
  description: string;
  members: FamilyMember[];
  lineageSide?: LineageSide;
  linkedSpouseName?: string;
  creatorEmail?: string;
  userRole?: TrahAccessRole;
  invitePolicy?: TrahInvitePolicy;
  dataVersion?: number;
  lastSyncedAt?: string;
  lastApprovedAt?: string;
  lastApprovedBy?: string;
}

export interface LineageOptionMeta {
  value: LineageSide;
  label: string;
  shortTag: string;
  icon: string;
  side: 'user' | 'spouse' | 'general';
  darkBadgeClass: string;
  lightBadgeClass: string;
  feedActiveClass: string;
}

export const LINEAGE_OPTIONS: LineageOptionMeta[] = [
  {
    value: 'ayah_user',
    label: 'Pilar 1: Trah Ayah (Saya)',
    shortTag: 'Ayah',
    icon: '👨',
    side: 'user',
    darkBadgeClass: 'bg-sky-950 text-sky-300 border-sky-700',
    lightBadgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    feedActiveClass: 'bg-sky-600 text-white shadow-xs',
  },
  {
    value: 'ibu_user',
    label: 'Pilar 2: Trah Ibu (Saya)',
    shortTag: 'Ibu',
    icon: '👩',
    side: 'user',
    darkBadgeClass: 'bg-rose-950 text-rose-300 border-rose-700',
    lightBadgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    feedActiveClass: 'bg-rose-600 text-white shadow-xs',
  },
  {
    value: 'kakek_ayah_user',
    label: 'Pilar 1A: Kakek dari Ayah (Saya)',
    shortTag: 'Kakek Ayah',
    icon: '👴',
    side: 'user',
    darkBadgeClass: 'bg-cyan-950 text-cyan-300 border-cyan-700',
    lightBadgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    feedActiveClass: 'bg-cyan-700 text-white shadow-xs',
  },
  {
    value: 'nenek_ayah_user',
    label: 'Pilar 1B: Nenek dari Ayah (Saya)',
    shortTag: 'Nenek Ayah',
    icon: '👵',
    side: 'user',
    darkBadgeClass: 'bg-teal-950 text-teal-300 border-teal-700',
    lightBadgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    feedActiveClass: 'bg-teal-700 text-white shadow-xs',
  },
  {
    value: 'kakek_ibu_user',
    label: 'Pilar 2A: Kakek dari Ibu (Saya)',
    shortTag: 'Kakek Ibu',
    icon: '🧔',
    side: 'user',
    darkBadgeClass: 'bg-indigo-950 text-indigo-300 border-indigo-700',
    lightBadgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    feedActiveClass: 'bg-indigo-700 text-white shadow-xs',
  },
  {
    value: 'nenek_ibu_user',
    label: 'Pilar 2B: Nenek dari Ibu (Saya)',
    shortTag: 'Nenek Ibu',
    icon: '🧕',
    side: 'user',
    darkBadgeClass: 'bg-pink-950 text-pink-300 border-pink-700',
    lightBadgeClass: 'bg-pink-100 text-pink-800 border-pink-300',
    feedActiveClass: 'bg-pink-700 text-white shadow-xs',
  },
  {
    value: 'ayah_pasangan',
    label: 'Pilar 3: Trah Ayah Pasangan (Besan)',
    shortTag: 'Ayah Besan',
    icon: '💍👨',
    side: 'spouse',
    darkBadgeClass: 'bg-amber-950 text-amber-300 border-amber-700',
    lightBadgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    feedActiveClass: 'bg-amber-600 text-white shadow-xs',
  },
  {
    value: 'ibu_pasangan',
    label: 'Pilar 4: Trah Ibu Pasangan (Besan)',
    shortTag: 'Ibu Besan',
    icon: '💍👩',
    side: 'spouse',
    darkBadgeClass: 'bg-purple-950 text-purple-300 border-purple-700',
    lightBadgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    feedActiveClass: 'bg-purple-600 text-white shadow-xs',
  },
  {
    value: 'kakek_ayah_pasangan',
    label: 'Pilar 3A: Kakek Ayah Pasangan',
    shortTag: 'Kakek Besan (A)',
    icon: '💍👴',
    side: 'spouse',
    darkBadgeClass: 'bg-orange-950 text-orange-300 border-orange-700',
    lightBadgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    feedActiveClass: 'bg-orange-700 text-white shadow-xs',
  },
  {
    value: 'nenek_ayah_pasangan',
    label: 'Pilar 3B: Nenek Ayah Pasangan',
    shortTag: 'Nenek Besan (A)',
    icon: '💍👵',
    side: 'spouse',
    darkBadgeClass: 'bg-yellow-950 text-yellow-300 border-yellow-700',
    lightBadgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    feedActiveClass: 'bg-yellow-700 text-white shadow-xs',
  },
  {
    value: 'kakek_ibu_pasangan',
    label: 'Pilar 4A: Kakek Ibu Pasangan',
    shortTag: 'Kakek Besan (I)',
    icon: '💍🧔',
    side: 'spouse',
    darkBadgeClass: 'bg-violet-950 text-violet-300 border-violet-700',
    lightBadgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    feedActiveClass: 'bg-violet-700 text-white shadow-xs',
  },
  {
    value: 'nenek_ibu_pasangan',
    label: 'Pilar 4B: Nenek Ibu Pasangan',
    shortTag: 'Nenek Besan (I)',
    icon: '💍🧕',
    side: 'spouse',
    darkBadgeClass: 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-700',
    lightBadgeClass: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
    feedActiveClass: 'bg-fuchsia-700 text-white shadow-xs',
  },
  {
    value: 'umum',
    label: 'Trah Keluarga Modular / Tambahan',
    shortTag: 'Modular',
    icon: '🌳',
    side: 'general',
    darkBadgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-700',
    lightBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    feedActiveClass: 'bg-emerald-600 text-white shadow-xs',
  },
];

export function getLineageBadgeMeta(side?: LineageSide): LineageOptionMeta {
  return (
    LINEAGE_OPTIONS.find((opt) => opt.value === side) ||
    LINEAGE_OPTIONS[LINEAGE_OPTIONS.length - 1]
  );
}

// =====================================================================
// KONTROL HAK AKSES, KUNCI KLAIM & PENCEGAHAN PERUBAHAN SEPIHAK
// =====================================================================

export function getEffectiveTrahRole(
  trah: Pick<TrahCategory, 'userRole' | 'creatorEmail'> | null | undefined,
  currentEmail?: string,
  isOwner = false
): TrahAccessRole {
  if (isOwner || !trah) return 'admin';
  const normCurrent = (currentEmail || '').trim().toLowerCase();
  const normCreator = (trah.creatorEmail || '').trim().toLowerCase();
  if (normCreator && normCurrent && normCreator === normCurrent) {
    return 'admin';
  }
  return trah.userRole || 'admin';
}

export function getTrahRoleMeta(role: TrahAccessRole): {
  label: string;
  shortLabel: string;
  badgeClass: string;
  description: string;
} {
  switch (role) {
    case 'viewer':
      return {
        label: 'Lihat Saja (Baca)',
        shortLabel: 'Lihat Saja',
        badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
        description: 'Bisa melihat pohon, tabel, buku PDF & medsos, tanpa mengubah data.',
      };
    case 'member':
      return {
        label: 'Anggota Keluarga',
        shortLabel: 'Anggota',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
        description: 'Bisa klaim profil sendiri, ubah profil sendiri, & tambah anak/cabang baru.',
      };
    default:
      return {
        label: 'Pengurus Trah (Admin)',
        shortLabel: 'Pengurus',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        description: 'Akses penuh: atur anggota, rapikan nasab, hapus cabang & putar ulang QR.',
      };
  }
}

export function canManageTrahAdmin(
  trah: Pick<TrahCategory, 'userRole' | 'creatorEmail'> | null | undefined,
  currentEmail?: string,
  isOwner = false
): boolean {
  return getEffectiveTrahRole(trah, currentEmail, isOwner) === 'admin';
}

export function canEditTrahMember(
  trah: Pick<TrahCategory, 'userRole' | 'creatorEmail'> | null | undefined,
  member: Pick<FamilyMember, 'name' | 'claimedByEmail' | 'claimedByName'>,
  currentEmail?: string,
  isOwner = false
): { ok: boolean; reason?: string } {
  const role = getEffectiveTrahRole(trah, currentEmail, isOwner);
  if (role === 'viewer') {
    return {
      ok: false,
      reason:
        'Akses Anda di Trah ini adalah "Lihat Saja". Hubungi Pengurus Trah untuk izin mengubah data.',
    };
  }

  if (role === 'admin') {
    return { ok: true };
  }

  // Role 'member': profil yang sudah diklaim orang lain terkunci dari edit sepihak
  const claimedEmail = (member.claimedByEmail || '').trim().toLowerCase();
  const normCurrent = (currentEmail || '').trim().toLowerCase();
  if (claimedEmail && (!normCurrent || claimedEmail !== normCurrent)) {
    return {
      ok: false,
      reason: `Profil "${member.name}" terkunci karena sudah diklaim oleh ${
        member.claimedByName || member.claimedByEmail
      }. Hanya pemilik profil atau Pengurus Trah yang dapat mengubahnya.`,
    };
  }

  return { ok: true };
}

export function canDeleteTrahMember(
  trah: Pick<TrahCategory, 'userRole' | 'creatorEmail'> | null | undefined,
  member: FamilyMember,
  allMembers: FamilyMember[],
  currentEmail?: string,
  isOwner = false
): { ok: boolean; reason?: string } {
  const editCheck = canEditTrahMember(trah, member, currentEmail, isOwner);
  if (!editCheck.ok) return editCheck;

  const role = getEffectiveTrahRole(trah, currentEmail, isOwner);
  if (role === 'admin') return { ok: true };

  // Anggota non-admin tidak boleh menghapus cabang yang punya keturunan atau node ter-klaim orang lain
  const directChildren = allMembers.filter((m) => m.parentId === member.id);
  if (directChildren.length > 0) {
    return {
      ok: false,
      reason: `Cabang "${member.name}" memiliki ${directChildren.length} anak/keturunan. Hanya Pengurus Trah yang berhak menghapus satu cabang.`,
    };
  }

  return { ok: true };
}

// =====================================================================
// MASA BERLAKU & REVOCATION QR / LINK UNDANGAN
// =====================================================================

const GLOBAL_REVOKED_INVITES_KEY = 'wargaqu_leluhur_revoked_invites_global_v1';

export function getRevokedInvitesScopeKey(scopeKey: string): string {
  return `wargaqu_leluhur_revoked_invites_v1_${scopeKey}`;
}

export function loadRevokedInviteVersions(scopeKey: string): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const key of [GLOBAL_REVOKED_INVITES_KEY, getRevokedInvitesScopeKey(scopeKey)]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Record<string, number>;
      if (parsed && typeof parsed === 'object') {
        for (const [tId, ver] of Object.entries(parsed)) {
          if (typeof ver === 'number' && ver > (merged[tId] || 0)) {
            merged[tId] = ver;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return merged;
}

export function markInviteVersionRevoked(
  scopeKey: string,
  trahId: string,
  minValidVersion: number
): void {
  for (const key of [GLOBAL_REVOKED_INVITES_KEY, getRevokedInvitesScopeKey(scopeKey)]) {
    try {
      const raw = localStorage.getItem(key);
      const map: Record<string, number> = raw ? JSON.parse(raw) : {};
      map[trahId] = Math.max(map[trahId] || 1, minValidVersion);
      localStorage.setItem(key, JSON.stringify(map));
    } catch {
      // ignore
    }
  }
}

export const INVITE_EXPIRY_OPTIONS = [
  { hours: 24, label: '24 Jam (1 Hari)', short: '1 Hari' },
  { hours: 168, label: '7 Hari (1 Pekan)', short: '7 Hari' },
  { hours: 720, label: '30 Hari (1 Bulan)', short: '30 Hari' },
  { hours: 0, label: 'Permanen (Tanpa Expired)', short: 'Permanen' },
];

export function formatInviteExpiryLabel(expiryHours: number): string {
  if (!expiryHours || expiryHours <= 0) return 'Permanen';
  if (expiryHours <= 24) return 'Berlaku 24 Jam';
  if (expiryHours <= 168) return 'Berlaku 7 Hari';
  return 'Berlaku 30 Hari';
}

// =====================================================================
// HUB KELUARGA INTI TERPUSAT (ISI 1x, SINKRON OTOMATIS KE 4-8+ TRAH)
// =====================================================================

export interface NuclearSpouseItem {
  id: string;
  name: string;
  callName?: string;
  birthYear?: string;
  city?: string;
  isDeceased?: boolean;
  photoUrl?: string;
  status: 'menikah' | 'cerai_hidup' | 'cerai_mati';
}

export interface NuclearChildItem {
  id: string;
  name: string;
  callName?: string;
  gender: 'L' | 'P';
  birthYear?: string;
  city?: string;
  isDeceased?: boolean;
  photoUrl?: string;
  orderIndex: number;
  spouseName?: string;
}

export interface NuclearFamilyHubData {
  updatedAt: string;
  self: {
    name: string;
    callName?: string;
    gender: 'L' | 'P';
    birthYear?: string;
    city?: string;
    isDeceased?: boolean;
    photoUrl?: string;
  };
  spouses: NuclearSpouseItem[];
  children: NuclearChildItem[];
}

export function getNuclearHubStorageKey(scopeKey: string): string {
  return `wargaqu_leluhur_core_family_v1_${scopeKey}`;
}

export function createDefaultNuclearFamilyHub(fallback?: {
  name?: string;
  city?: string;
  photoUrl?: string;
}): NuclearFamilyHubData {
  return {
    updatedAt: new Date().toISOString(),
    self: {
      name: (fallback?.name || '').trim(),
      callName: '',
      gender: 'L',
      birthYear: '',
      city: (fallback?.city || '').trim(),
      isDeceased: false,
      photoUrl: fallback?.photoUrl || '',
    },
    spouses: [],
    children: [],
  };
}

export function loadNuclearFamilyHub(
  scopeKey: string,
  fallback?: { name?: string; city?: string; photoUrl?: string }
): NuclearFamilyHubData {
  try {
    const raw = localStorage.getItem(getNuclearHubStorageKey(scopeKey));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NuclearFamilyHubData>;
      if (parsed && parsed.self) {
        return {
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          self: {
            name: parsed.self.name || fallback?.name || '',
            callName: parsed.self.callName || '',
            gender: parsed.self.gender === 'P' ? 'P' : 'L',
            birthYear: parsed.self.birthYear || '',
            city: parsed.self.city || fallback?.city || '',
            isDeceased: Boolean(parsed.self.isDeceased),
            photoUrl: parsed.self.photoUrl || fallback?.photoUrl || '',
          },
          spouses: Array.isArray(parsed.spouses) ? parsed.spouses : [],
          children: Array.isArray(parsed.children) ? parsed.children : [],
        };
      }
    }
  } catch {
    // ignore
  }
  return createDefaultNuclearFamilyHub(fallback);
}

export function saveNuclearFamilyHub(scopeKey: string, hub: NuclearFamilyHubData): void {
  try {
    localStorage.setItem(getNuclearHubStorageKey(scopeKey), JSON.stringify(hub));
  } catch {
    // ignore
  }
}

export function isSpouseLineageSide(side?: LineageSide): boolean {
  return Boolean(
    side &&
      (side === 'ayah_pasangan' ||
        side === 'ibu_pasangan' ||
        side === 'kakek_ayah_pasangan' ||
        side === 'nenek_ayah_pasangan' ||
        side === 'kakek_ibu_pasangan' ||
        side === 'nenek_ibu_pasangan')
  );
}

export function getTrahCoreLinkStatus(trah: TrahCategory): {
  linked: boolean;
  orientation: 'self_branch' | 'spouse_branch' | null;
  anchorMember?: FamilyMember;
  childrenSyncedCount: number;
} {
  const selfNode = trah.members.find((m) => m.coreRefId === 'core_self');
  const spouseNode = trah.members.find((m) => m.coreRefId?.startsWith('core_sp_'));
  const anchorMember = selfNode || spouseNode;
  if (!anchorMember) {
    return { linked: false, orientation: null, childrenSyncedCount: 0 };
  }
  const childrenSyncedCount = trah.members.filter(
    (m) => m.parentId === anchorMember.id || m.coreRefId?.startsWith('core_ch_')
  ).length;
  return {
    linked: true,
    orientation: selfNode ? 'self_branch' : 'spouse_branch',
    anchorMember,
    childrenSyncedCount,
  };
}

function buildSpouseInfosFromHub(spouses: NuclearSpouseItem[]): SpouseInfo[] {
  return spouses
    .filter((sp) => sp.name.trim().length > 0)
    .map((sp, idx) => ({
      id: `sp_hub_${sp.id}`,
      name: sp.name.trim(),
      orderIndex: idx + 1,
      status: sp.status || 'menikah',
      photoUrl: sp.photoUrl || undefined,
      notes: sp.city ? `Domisili: ${sp.city}` : undefined,
    }));
}

/**
 * Menempelkan atau memperbarui Hub Keluarga Inti ke satu Trah tertentu
 * sambil menjaga parentId & struktur leluhur di atasnya tetap utuh.
 */
export function graftNuclearFamilyToTrah(
  trah: TrahCategory,
  hub: NuclearFamilyHubData,
  options: {
    parentMemberId: string | null;
    attachMode: 'self_branch' | 'spouse_branch';
    spouseIndex?: number;
    ownerEmail?: string;
    ownerName?: string;
  }
): { updatedTrah: TrahCategory; anchorId: string } {
  const members = [...trah.members];
  const now = Date.now();
  const isSpouseMode = options.attachMode === 'spouse_branch';
  const targetSpouse =
    hub.spouses[options.spouseIndex || 0] ||
    ({
      id: 'sp_default',
      name: trah.linkedSpouseName || 'Pasangan',
      status: 'menikah',
    } as NuclearSpouseItem);

  const anchorCoreRef = isSpouseMode ? `core_sp_${targetSpouse.id}` : 'core_self';
  const anchorName = (isSpouseMode ? targetSpouse.name : hub.self.name).trim() || 'Saya';
  const anchorGender: 'L' | 'P' = isSpouseMode
    ? hub.self.gender === 'L'
      ? 'P'
      : 'L'
    : hub.self.gender;

  const parentNode = options.parentMemberId
    ? members.find((m) => m.id === options.parentMemberId)
    : null;
  const parentGen = parentNode ? parentNode.generationLevel : -1;

  // Cek apakah sudah pernah ditempel sebelumnya
  let existingAnchorIdx = members.findIndex((m) => m.coreRefId === anchorCoreRef);
  if (existingAnchorIdx === -1) {
    existingAnchorIdx = members.findIndex(
      (m) =>
        (m.parentId || null) === (options.parentMemberId || null) &&
        m.name.trim().toLowerCase() === anchorName.toLowerCase()
    );
  }

  let anchorId: string;
  const anchorSpouses: SpouseInfo[] = isSpouseMode
    ? hub.self.name.trim()
      ? [
          {
            id: `sp_self_${now}`,
            name: hub.self.name.trim(),
            orderIndex: 1,
            status: targetSpouse.status || 'menikah',
          },
        ]
      : []
    : buildSpouseInfosFromHub(hub.spouses);

  if (existingAnchorIdx >= 0) {
    const prev = members[existingAnchorIdx];
    anchorId = prev.id;
    members[existingAnchorIdx] = {
      ...prev,
      name: anchorName,
      callName: (isSpouseMode ? targetSpouse.callName : hub.self.callName)?.trim() || prev.callName,
      gender: anchorGender,
      birthYear: (isSpouseMode ? targetSpouse.birthYear : hub.self.birthYear)?.trim() || prev.birthYear,
      city: (isSpouseMode ? targetSpouse.city : hub.self.city)?.trim() || prev.city,
      isDeceased: isSpouseMode
        ? Boolean(targetSpouse.isDeceased)
        : Boolean(hub.self.isDeceased),
      photoUrl:
        (isSpouseMode ? targetSpouse.photoUrl : hub.self.photoUrl)?.trim() || prev.photoUrl,
      parentId: options.parentMemberId,
      generationLevel: parentGen + 1,
      spouses: anchorSpouses.length > 0 ? anchorSpouses : prev.spouses,
      coreRefId: anchorCoreRef,
      claimedByEmail:
        !isSpouseMode && !prev.claimedByEmail && options.ownerEmail
          ? options.ownerEmail
          : prev.claimedByEmail,
      claimedByName:
        !isSpouseMode && !prev.claimedByName && options.ownerName
          ? options.ownerName
          : prev.claimedByName,
      claimedAt:
        !isSpouseMode && !prev.claimedAt && options.ownerEmail
          ? new Date().toISOString()
          : prev.claimedAt,
    };
  } else {
    anchorId = `m_core_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const siblingCount = members.filter(
      (m) => (m.parentId || null) === (options.parentMemberId || null)
    ).length;
    members.push({
      id: anchorId,
      name: anchorName,
      callName: (isSpouseMode ? targetSpouse.callName : hub.self.callName)?.trim() || undefined,
      gender: anchorGender,
      birthYear: (isSpouseMode ? targetSpouse.birthYear : hub.self.birthYear)?.trim() || undefined,
      city: (isSpouseMode ? targetSpouse.city : hub.self.city)?.trim() || undefined,
      isDeceased: isSpouseMode ? Boolean(targetSpouse.isDeceased) : Boolean(hub.self.isDeceased),
      photoUrl: (isSpouseMode ? targetSpouse.photoUrl : hub.self.photoUrl)?.trim() || undefined,
      parentId: options.parentMemberId,
      generationLevel: parentGen + 1,
      orderIndex: siblingCount + 1,
      spouses: anchorSpouses,
      coreRefId: anchorCoreRef,
      notes: 'Tersinkron otomatis dari Hub Keluarga Inti',
      claimedByEmail: !isSpouseMode && options.ownerEmail ? options.ownerEmail : undefined,
      claimedByName: !isSpouseMode && options.ownerName ? options.ownerName : undefined,
      claimedAt: !isSpouseMode && options.ownerEmail ? new Date().toISOString() : undefined,
    });
  }

  // Tempel / update seluruh anak dari Hub di bawah anchorId
  hub.children.forEach((child, cIdx) => {
    const cName = child.name.trim();
    if (!cName) return;
    const childCoreRef = `core_ch_${child.id}`;
    const existingChildIdx = members.findIndex(
      (m) =>
        m.coreRefId === childCoreRef ||
        (m.parentId === anchorId && m.name.trim().toLowerCase() === cName.toLowerCase())
    );

    const childSpouses: SpouseInfo[] = child.spouseName?.trim()
      ? [
          {
            id: `sp_ch_${child.id}`,
            name: child.spouseName.trim(),
            orderIndex: 1,
            status: 'menikah',
          },
        ]
      : [];

    if (existingChildIdx >= 0) {
      const prevC = members[existingChildIdx];
      members[existingChildIdx] = {
        ...prevC,
        name: cName,
        callName: child.callName?.trim() || prevC.callName,
        gender: child.gender,
        birthYear: child.birthYear?.trim() || prevC.birthYear,
        city: child.city?.trim() || prevC.city,
        isDeceased: Boolean(child.isDeceased),
        photoUrl: child.photoUrl?.trim() || prevC.photoUrl,
        parentId: anchorId,
        generationLevel: parentGen + 2,
        orderIndex: child.orderIndex || cIdx + 1,
        spouses: childSpouses.length > 0 ? childSpouses : prevC.spouses,
        coreRefId: childCoreRef,
      };
    } else {
      members.push({
        id: `m_ch_core_${now}_${cIdx}_${Math.random().toString(36).slice(2, 5)}`,
        name: cName,
        callName: child.callName?.trim() || undefined,
        gender: child.gender,
        birthYear: child.birthYear?.trim() || undefined,
        city: child.city?.trim() || undefined,
        isDeceased: Boolean(child.isDeceased),
        photoUrl: child.photoUrl?.trim() || undefined,
        parentId: anchorId,
        generationLevel: parentGen + 2,
        orderIndex: child.orderIndex || cIdx + 1,
        spouses: childSpouses,
        coreRefId: childCoreRef,
        notes: 'Anak tersinkron dari Hub Keluarga Inti',
      });
    }
  });

  return {
    updatedTrah: { ...trah, members },
    anchorId,
  };
}

/**
 * Menyinkronkan perubahan Hub Keluarga Inti ke seluruh Trah yang sudah tertaut.
 */
export function syncHubAcrossTrahList(
  trahList: TrahCategory[],
  hub: NuclearFamilyHubData,
  currentEmail?: string,
  isOwner = false
): {
  updatedTrahList: TrahCategory[];
  syncedTrahCount: number;
  syncedMemberCount: number;
} {
  let syncedTrahCount = 0;
  let syncedMemberCount = 0;

  const updatedTrahList = trahList.map((trah) => {
    const linkStatus = getTrahCoreLinkStatus(trah);
    if (!linkStatus.linked || !linkStatus.anchorMember) {
      return trah;
    }
    if (!canManageTrahAdmin(trah, currentEmail, isOwner) && trah.userRole === 'viewer') {
      return trah;
    }

    let spouseIdx = 0;
    if (linkStatus.orientation === 'spouse_branch' && linkStatus.anchorMember.coreRefId) {
      const targetSpId = linkStatus.anchorMember.coreRefId.slice('core_sp_'.length);
      const foundIdx = hub.spouses.findIndex((s) => s.id === targetSpId);
      if (foundIdx >= 0) spouseIdx = foundIdx;
    }

    const beforeLen = trah.members.length;
    const { updatedTrah } = graftNuclearFamilyToTrah(trah, hub, {
      parentMemberId: linkStatus.anchorMember.parentId || null,
      attachMode: linkStatus.orientation || 'self_branch',
      spouseIndex: spouseIdx,
      ownerEmail: currentEmail,
    });
    syncedTrahCount++;
    syncedMemberCount += Math.max(1, updatedTrah.members.length - beforeLen + 1 + hub.children.length);
    return updatedTrah;
  });

  return { updatedTrahList, syncedTrahCount, syncedMemberCount };
}

/**
 * Jika pengguna mengedit langsung anggota di Grid/Tabel yang memiliki coreRefId,
 * tarik perubahannya balik ke Hub Keluarga Inti agar semua Trah lain ikut terupdate.
 */
export function applyMemberEditToHub(
  hub: NuclearFamilyHubData,
  edited: FamilyMember
): { updatedHub: NuclearFamilyHubData; changed: boolean } {
  if (!edited.coreRefId) return { updatedHub: hub, changed: false };

  if (edited.coreRefId === 'core_self') {
    const updatedHub: NuclearFamilyHubData = {
      ...hub,
      updatedAt: new Date().toISOString(),
      self: {
        name: edited.name,
        callName: edited.callName || '',
        gender: edited.gender,
        birthYear: edited.birthYear || '',
        city: edited.city || '',
        isDeceased: edited.isDeceased,
        photoUrl: edited.photoUrl || hub.self.photoUrl || '',
      },
      spouses:
        edited.spouses && edited.spouses.length > 0
          ? edited.spouses.map((sp, i) => ({
              id: hub.spouses[i]?.id || `sp_${i + 1}`,
              name: sp.name,
              status: sp.status,
              city: hub.spouses[i]?.city,
              birthYear: hub.spouses[i]?.birthYear,
              callName: hub.spouses[i]?.callName,
              photoUrl: sp.photoUrl || hub.spouses[i]?.photoUrl,
              isDeceased: sp.status === 'cerai_mati',
            }))
          : hub.spouses,
    };
    return { updatedHub, changed: true };
  }

  if (edited.coreRefId.startsWith('core_sp_')) {
    const spId = edited.coreRefId.slice('core_sp_'.length);
    let touched = false;
    const nextSpouses = hub.spouses.map((sp) => {
      if (sp.id !== spId) return sp;
      touched = true;
      return {
        ...sp,
        name: edited.name,
        callName: edited.callName || sp.callName,
        birthYear: edited.birthYear || sp.birthYear,
        city: edited.city || sp.city,
        isDeceased: edited.isDeceased,
        photoUrl: edited.photoUrl || sp.photoUrl,
      };
    });
    if (!touched) return { updatedHub: hub, changed: false };
    return {
      updatedHub: { ...hub, updatedAt: new Date().toISOString(), spouses: nextSpouses },
      changed: true,
    };
  }

  if (edited.coreRefId.startsWith('core_ch_')) {
    const chId = edited.coreRefId.slice('core_ch_'.length);
    let touched = false;
    const nextChildren = hub.children.map((ch) => {
      if (ch.id !== chId) return ch;
      touched = true;
      return {
        ...ch,
        name: edited.name,
        callName: edited.callName || ch.callName,
        gender: edited.gender,
        birthYear: edited.birthYear || ch.birthYear,
        city: edited.city || ch.city,
        isDeceased: edited.isDeceased,
        photoUrl: edited.photoUrl || ch.photoUrl,
        spouseName: edited.spouses?.[0]?.name || ch.spouseName,
      };
    });
    if (!touched) return { updatedHub: hub, changed: false };
    return {
      updatedHub: { ...hub, updatedAt: new Date().toISOString(), children: nextChildren },
      changed: true,
    };
  }

  return { updatedHub: hub, changed: false };
}
