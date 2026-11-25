import { FamilyMember } from '../components/leluhurqu/LeluhurQuView';
import type {
  GridPaperOrientation,
  GridPaperSize,
} from '../components/leluhurqu/InteractiveGridCanvasView';

export type NasabAiArchetype =
  | 'tree_organic'
  | 'lotus_mandala'
  | 'honeycomb_tier'
  | 'honeycomb_radial'
  | 'molecule_cluster';

export type NasabAiTreeShape =
  | 'banyan_arch'
  | 'pine_tiered'
  | 'royal_canopy';

export type NasabAiLeafVariant = 'pointed' | 'banyan' | 'sakura';

export interface NasabAiGenColorStop {
  bg: string;
  border: string;
  line: string;
}

export interface NasabAiBlueprint {
  blueprintId: string;
  archetype: NasabAiArchetype;
  themeTitle: string;
  designRationale: string;
  treeShape: NasabAiTreeShape;
  curveTension: number;
  trunkCurve: number;
  rootSpread: number;
  balanceLeftIds: string[];
  balanceRightIds: string[];
  cardShape: 'leaf' | 'petal' | 'hex' | 'rect';
  leafVariant: NasabAiLeafVariant;
  spouseMode: 'compact_beside' | 'vertical_pair';
  connectorStyle: 'curved' | 'straight';
  canvasBgColor: string;
  barkOuterColor: string;
  barkInnerColor: string;
  genColors: NasabAiGenColorStop[];
  signature: string;
  createdAt: number;
  fromCache?: boolean;
}

export interface CompactSkeletonNode {
  id: string;
  g: number;
  pid: string | null;
  sp: number;
  kids: number;
  desc: number;
  nLen: number;
}

export interface CompactTreeSkeleton {
  paper: string;
  totalMembers: number;
  totalWithSpouses: number;
  genCounts: Record<string, number>;
  nodes: CompactSkeletonNode[];
}

export interface AiDesignerQuotaInfo {
  usedToday: number;
  maxPerDay: number;
  remainingToday: number;
  cooldownRemainingSec: number;
}

const BLUEPRINT_CACHE_KEY = 'nasabqu_ai_blueprint_cache_v1';
const QUOTA_STORAGE_KEY = 'nasabqu_ai_blueprint_quota_v1';
const MAX_DAILY_FRESH_GENERATIONS = 6;
const FRESH_COOLDOWN_MS = 10_000;
const MAX_CACHED_BLUEPRINTS = 24;

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getAiDesignerQuotaInfo(): AiDesignerQuotaInfo {
  const today = getTodayDateKey();
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) {
      return {
        usedToday: 0,
        maxPerDay: MAX_DAILY_FRESH_GENERATIONS,
        remainingToday: MAX_DAILY_FRESH_GENERATIONS,
        cooldownRemainingSec: 0,
      };
    }
    const parsed = JSON.parse(raw) as {
      dateKey?: string;
      count?: number;
      lastFreshAt?: number;
    };
    const count = parsed.dateKey === today ? Math.max(0, Number(parsed.count || 0)) : 0;
    const lastAt = Number(parsed.lastFreshAt || 0);
    const elapsed = Date.now() - lastAt;
    const cooldownRemainingSec =
      lastAt > 0 && elapsed < FRESH_COOLDOWN_MS
        ? Math.ceil((FRESH_COOLDOWN_MS - elapsed) / 1000)
        : 0;
    return {
      usedToday: count,
      maxPerDay: MAX_DAILY_FRESH_GENERATIONS,
      remainingToday: Math.max(0, MAX_DAILY_FRESH_GENERATIONS - count),
      cooldownRemainingSec,
    };
  } catch {
    return {
      usedToday: 0,
      maxPerDay: MAX_DAILY_FRESH_GENERATIONS,
      remainingToday: MAX_DAILY_FRESH_GENERATIONS,
      cooldownRemainingSec: 0,
    };
  }
}

function recordFreshGenerationQuota(): void {
  const today = getTodayDateKey();
  const info = getAiDesignerQuotaInfo();
  try {
    localStorage.setItem(
      QUOTA_STORAGE_KEY,
      JSON.stringify({
        dateKey: today,
        count: info.usedToday + 1,
        lastFreshAt: Date.now(),
      })
    );
  } catch {
    // ignore storage errors
  }
}

export function buildCompactTreeSkeleton(
  members: FamilyMember[],
  paperSize: GridPaperSize,
  paperOrientation: GridPaperOrientation
): CompactTreeSkeleton {
  const childrenCountMap = new Map<string, number>();
  const childrenIdsMap = new Map<string, string[]>();
  members.forEach((m) => {
    if (m.parentId) {
      childrenCountMap.set(m.parentId, (childrenCountMap.get(m.parentId) || 0) + 1);
      const arr = childrenIdsMap.get(m.parentId) || [];
      arr.push(m.id);
      childrenIdsMap.set(m.parentId, arr);
    }
  });

  const descCache = new Map<string, number>();
  const countDesc = (id: string, guard = new Set<string>()): number => {
    if (descCache.has(id)) return descCache.get(id)!;
    if (guard.has(id)) return 0;
    guard.add(id);
    const kids = childrenIdsMap.get(id) || [];
    const total = kids.reduce((s, kidId) => s + 1 + countDesc(kidId, guard), 0);
    descCache.set(id, total);
    return total;
  };

  const genCounts: Record<string, number> = {};
  let totalSpouses = 0;

  // Sort by generation then orderIndex so root & main branches appear first within 180-node cap
  const sorted = [...members].sort(
    (a, b) =>
      (a.generationLevel ?? 0) - (b.generationLevel ?? 0) ||
      (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  );

  const nodes: CompactSkeletonNode[] = [];
  for (const m of sorted) {
    const g = Math.max(0, m.generationLevel ?? 0);
    const sp = m.spouses?.length || 0;
    totalSpouses += sp;
    const gKey = `G${g + 1}`;
    genCounts[gKey] = (genCounts[gKey] || 0) + 1;

    if (nodes.length < 180) {
      nodes.push({
        id: m.id,
        g,
        pid: m.parentId || null,
        sp,
        kids: childrenCountMap.get(m.id) || 0,
        desc: countDesc(m.id),
        nLen: Math.min(40, (m.name || '').trim().length),
      });
    }
  }

  return {
    paper: `${paperSize} ${paperOrientation}`,
    totalMembers: members.length,
    totalWithSpouses: members.length + totalSpouses,
    genCounts,
    nodes,
  };
}

function stableHashStr(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function computeAiDesignSignature(
  members: FamilyMember[],
  archetypeHint: NasabAiArchetype | 'auto',
  stylePrompt: string,
  paperSize: GridPaperSize,
  paperOrientation: GridPaperOrientation
): string {
  const topologyStr = [...members]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (m) =>
        `${m.id}:${m.parentId || ''}:${m.generationLevel ?? 0}:${m.spouses?.length || 0}:${m.orderIndex ?? 0}`
    )
    .join('|');
  const normPrompt = stylePrompt.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 140);
  return `sig_${stableHashStr(`${archetypeHint}::${paperSize}_${paperOrientation}::${normPrompt}::${topologyStr}`)}`;
}

function readBlueprintCache(): Record<string, NasabAiBlueprint> {
  try {
    const raw = localStorage.getItem(BLUEPRINT_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, NasabAiBlueprint>) : {};
  } catch {
    return {};
  }
}

function writeBlueprintCache(bp: NasabAiBlueprint): void {
  try {
    const map = readBlueprintCache();
    map[bp.signature] = bp;
    const entries = Object.entries(map).sort(
      (a, b) => (b[1]?.createdAt || 0) - (a[1]?.createdAt || 0)
    );
    const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHED_BLUEPRINTS));
    localStorage.setItem(BLUEPRINT_CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore storage errors
  }
}

export function getCachedAiBlueprint(signature: string): NasabAiBlueprint | null {
  const map = readBlueprintCache();
  const hit = map[signature];
  if (!hit) return null;
  return { ...hit, fromCache: true };
}

export async function requestNasabAiBlueprint(params: {
  members: FamilyMember[];
  archetypeHint: NasabAiArchetype | 'auto';
  stylePrompt: string;
  paperSize: GridPaperSize;
  paperOrientation: GridPaperOrientation;
  bypassCache?: boolean;
}): Promise<NasabAiBlueprint> {
  const {
    members,
    archetypeHint,
    stylePrompt,
    paperSize,
    paperOrientation,
    bypassCache = false,
  } = params;

  if (!members || members.length === 0) {
    throw new Error('Isi minimal 1 anggota keluarga di Tabel sebelum meracik desain AI.');
  }

  const signature = computeAiDesignSignature(
    members,
    archetypeHint,
    stylePrompt,
    paperSize,
    paperOrientation
  );

  if (!bypassCache) {
    const cached = getCachedAiBlueprint(signature);
    if (cached) {
      return cached;
    }
  }

  const quota = getAiDesignerQuotaInfo();
  if (quota.remainingToday <= 0) {
    throw new Error(
      `Jatah racik AI baru hari ini (${quota.maxPerDay}×/hari) sudah terpakai. Preset Smart bawaan & desain tersimpan tetap gratis tanpa batas.`
    );
  }
  if (quota.cooldownRemainingSec > 0) {
    throw new Error(
      `Mohon tunggu ${quota.cooldownRemainingSec} detik sebelum meracik desain AI baru (menghemat token).`
    );
  }

  const skeleton = buildCompactTreeSkeleton(members, paperSize, paperOrientation);

  const response = await fetch('/api/nasabqu/ai-design', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature,
      archetypeHint,
      stylePrompt: stylePrompt.trim().slice(0, 220),
      skeleton,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; blueprint?: NasabAiBlueprint; error?: string; serverCached?: boolean }
    | null;

  if (!response.ok || !payload?.blueprint) {
    throw new Error(
      payload?.error || 'Gagal menghubungi layanan Desain AI NasabQu.'
    );
  }

  const bp: NasabAiBlueprint = {
    ...payload.blueprint,
    signature,
    createdAt: Date.now(),
    fromCache: Boolean(payload.serverCached),
  };

  if (!payload.serverCached) {
    recordFreshGenerationQuota();
  }
  writeBlueprintCache(bp);
  return bp;
}
