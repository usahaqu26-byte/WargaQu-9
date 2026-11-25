import { FamilyMember } from './LeluhurQuView';
import type { NasabAiBlueprint } from '../../services/nasabAiDesignerService';
import type {
  InteractiveNode,
  InteractiveEdge,
  GridPaperSize,
  GridPaperOrientation,
  CardDisplayMode,
  PhotoFrameSize,
  CanvasTheme,
  CanvasBackground,
  ConnectorLineStyle,
  MergedCardMember,
} from './InteractiveGridCanvasView';

export type SmartPresetId =
  | 'kotak_9_baris'
  | 'kotak_9_baris_g45_gabung'
  | 'orbit_elips_1_5'
  | 'orbit_elips_gabung'
  | 'teratai_mekar'
  | 'sarang_lebah_turun'
  | 'sarang_lebah_pusat'
  | 'molekul_organik'
  | 'modular_g3_I'
  | 'modular_g3_L'
  | 'hierarchy_grid_fill'
  | 'subtree_vertical'
  | 'pohon_hayat_besar'
  | 'subtree_horizontal'
  | 'family_cluster'
  | 'heritage_showcase';

export type GuideOverlayMode =
  | 'gen_bands'
  | 'grid_9_rows'
  | 'orbit_rings'
  | 'modular_center';

export const MM_TO_PX = 3.78; // 1mm pada 96 DPI ≈ 3.78px

export function formatMemberLifeSubtitle(m: FamilyMember): string {
  const yearPart =
    m.birthYear && m.deathYear
      ? `${m.birthYear}–${m.deathYear}`
      : m.birthYear && m.isDeceased
      ? `${m.birthYear}–Wafat`
      : m.birthYear
      ? `L. ${m.birthYear}`
      : m.isDeceased
      ? 'Wafat'
      : '';
  let cityPart = (m.city || '').trim();
  if (!cityPart && m.notes) {
    const match = m.notes.match(/(?:kota|domisili|asal|tinggal)\s*[:\-]\s*([^,;\n]+)/i);
    if (match?.[1]) cityPart = match[1].trim();
  }
  if (yearPart && cityPart) return `${yearPart} • ${cityPart}`;
  if (yearPart) return yearPart;
  if (cityPart) return cityPart;
  return m.callName || `Gen ${(m.generationLevel ?? 0) + 1}`;
}

export interface SmartLayoutPreset {
  id: SmartPresetId;
  title: string;
  subtitle: string;
  badge: string;
  category: 'kotak9' | 'orbit' | 'modular' | 'klasik';
  description: string;
  recommendedTheme: CanvasTheme;
  recommendedBg: CanvasBackground;
  recommendedOrientation: GridPaperOrientation;
  recommendedCardMode: CardDisplayMode;
  recommendedPhotoSize: PhotoFrameSize;
  recommendedLineStyle?: ConnectorLineStyle;
  recommendedLineThicknessMode?: 'uniform' | 'tree_taper';
  recommendedGuideMode?: GuideOverlayMode;
  recommendedGenGradient?: string;
}

export interface SmartAnalysisSummary {
  totalPeopleWithSpouses: number;
  generationCount: number;
  recommendedPaper: GridPaperSize;
  topPresetId: SmartPresetId;
  reason: string;
}

const BASE_PHOTO_DIMS: Record<PhotoFrameSize, { w: number; h: number }> = {
  kotak: { w: 58, h: 58 },
  bulat: { w: 56, h: 56 },
  '2x3': { w: 56, h: 84 },
  '3x4': { w: 66, h: 88 },
  '4x6': { w: 80, h: 120 },
};

export function getBaseCardSizeForScale(
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  scale = 1
): { w: number; h: number } {
  const p = BASE_PHOTO_DIMS[photoSize] || BASE_PHOTO_DIMS['3x4'];
  if (displayMode === 'photo_name') {
    return {
      w: Math.round(Math.max(106, p.w + 16) * scale),
      h: Math.round((p.h + 30) * scale),
    };
  }
  if (displayMode === 'photo_name_unified') {
    const w = Math.max(54, Math.round(Math.max(p.w + 16, 74) * scale));
    const h = Math.max(60, Math.round((p.h + 18) * scale));
    return { w, h };
  }
  if (displayMode === 'name_only') {
    return {
      w: Math.round(138 * scale),
      h: Math.round(42 * scale),
    };
  }
  // 'full': jarak card-ke-foto 1mm (~4px) + nama + tahun lahir/wafat - kota
  return {
    w: Math.round(Math.max(142, p.w + 26) * scale),
    h: Math.round((p.h + 50) * scale),
  };
}

export function getUniformSubCardSize(
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1
): { w: number; h: number; photoW: number; photoH: number; badgeH: number } {
  const pDim = BASE_PHOTO_DIMS[photoSize] || BASE_PHOTO_DIMS['2x3'];
  const aspect = pDim.h / Math.max(1, pDim.w);

  if (displayMode === 'photo_name') {
    const photoW = Math.max(20, Math.round(pDim.w * cardScale));
    const photoH = Math.max(20, Math.round(photoW * aspect));
    const badgeH = Math.max(14, Math.round(21 * cardScale));
    const w = Math.max(photoW + 6, Math.round((pDim.w + 14) * cardScale));
    const h = photoH + badgeH + 6;
    return { w, h, photoW, photoH, badgeH };
  }

  if (displayMode === 'photo_name_unified') {
    const photoW = Math.max(24, Math.round(pDim.w * cardScale));
    const photoH = Math.max(24, Math.round(photoW * aspect));
    const badgeH = Math.max(14, Math.round(20 * cardScale));
    const w = Math.max(photoW + 10, Math.round(Math.max(pDim.w + 16, 74) * cardScale));
    const h = Math.max(photoH + 14, Math.round((pDim.h + 18) * cardScale));
    return { w, h, photoW, photoH, badgeH };
  }

  if (displayMode === 'name_only') {
    const w = Math.max(54, Math.round(108 * cardScale));
    const h = Math.max(22, Math.round(30 * cardScale));
    return { w, h, photoW: 0, photoH: 0, badgeH: h - 4 };
  }

  // 'full': Foto + Badge Lengkap (Nama, Tahun Lahir/Wafat - Kota)
  const photoW = Math.max(22, Math.round(pDim.w * cardScale));
  const photoH = Math.max(22, Math.round(photoW * aspect));
  const badgeH = Math.max(28, Math.round(42 * cardScale));
  const w = Math.max(photoW + 10, Math.round(Math.max(106, pDim.w + 26) * cardScale));
  const h = photoH + badgeH + 8;
  return { w, h, photoW, photoH, badgeH };
}

export interface ModularNuclearGroup {
  id: string;
  headDepth: number;
  couple: MergedCardMember[];
  childrenRows: MergedCardMember[][];
  cols: number;
  w: number;
  h: number;
}

export interface ModularContainerPlan {
  layout: 'grid' | 'I' | 'L';
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  photoW: number;
  photoH: number;
  badgeH: number;
  gap: number;
  tightGap: number;
  looseGap: number;
  padX: number;
  padY: number;
  headerH: number;
  groups: ModularNuclearGroup[];
  lRightGroups: ModularNuclearGroup[];
  lDownGroups: ModularNuclearGroup[];
  iSubCols: number;
  w: number;
  h: number;
}

function buildNuclearFamilyGroups(
  membersMeta: MergedCardMember[],
  cellW: number,
  cellH: number,
  tightGap: number,
  maxLeafCols: number
): ModularNuclearGroup[] {
  if (!membersMeta || membersMeta.length === 0) return [];

  const byMemberId = new Map<string, MergedCardMember>();
  const spousesOf = new Map<string, MergedCardMember[]>();
  const childrenOf = new Map<string, MergedCardMember[]>();

  membersMeta.forEach((mm) => {
    if (mm.memberId && !mm.isSpouseOf) {
      byMemberId.set(mm.memberId, mm);
    }
    if (mm.isSpouseOf) {
      if (!spousesOf.has(mm.isSpouseOf)) spousesOf.set(mm.isSpouseOf, []);
      spousesOf.get(mm.isSpouseOf)!.push(mm);
    } else if (mm.parentMemberId) {
      if (!childrenOf.has(mm.parentMemberId)) childrenOf.set(mm.parentMemberId, []);
      childrenOf.get(mm.parentMemberId)!.push(mm);
    }
  });

  const rootsInMod = membersMeta.filter(
    (mm) => !mm.isSpouseOf && (!mm.parentMemberId || !byMemberId.has(mm.parentMemberId))
  );
  const entryRoots =
    rootsInMod.length > 0
      ? rootsInMod
      : membersMeta.filter((mm) => !mm.isSpouseOf).slice(0, 1);

  const groups: ModularNuclearGroup[] = [];
  const usedIds = new Set<string>();

  const hasOwnFamily = (mm: MergedCardMember): boolean => {
    if (!mm.memberId) return false;
    const spCount = spousesOf.get(mm.memberId)?.length || 0;
    const chCount = childrenOf.get(mm.memberId)?.length || 0;
    return spCount > 0 || chCount > 0;
  };

  const makeGroup = (head: MergedCardMember) => {
    if (usedIds.has(head.originalNodeId)) return;
    usedIds.add(head.originalNodeId);
    const spList = head.memberId ? spousesOf.get(head.memberId) || [] : [];
    const couple: MergedCardMember[] = [head, ...spList];
    spList.forEach((sp) => usedIds.add(sp.originalNodeId));

    const rawKids = head.memberId ? childrenOf.get(head.memberId) || [] : [];
    const singleLeafKids: MergedCardMember[] = [];
    const nestedHeads: MergedCardMember[] = [];

    rawKids.forEach((kid) => {
      if (hasOwnFamily(kid)) {
        nestedHeads.push(kid);
      } else {
        usedIds.add(kid.originalNodeId);
        singleLeafKids.push(kid);
      }
    });

    const cols = Math.max(
      couple.length,
      Math.min(maxLeafCols, Math.max(1, singleLeafKids.length))
    );
    const childrenRows: MergedCardMember[][] = [];
    for (let i = 0; i < singleLeafKids.length; i += cols) {
      childrenRows.push(singleLeafKids.slice(i, i + cols));
    }

    const coupleW = couple.length * cellW; // Pasangan 0mm menempel rapat!
    const maxChildRowLen = childrenRows.reduce((mx, r) => Math.max(mx, r.length), 0);
    const childrenW =
      maxChildRowLen > 0
        ? maxChildRowLen * cellW + Math.max(0, maxChildRowLen - 1) * tightGap
        : 0;
    const groupPad = 2;
    const w = Math.max(coupleW, childrenW) + groupPad * 2;
    const h =
      groupPad * 2 +
      cellH +
      (childrenRows.length > 0
        ? childrenRows.length * (tightGap + cellH)
        : 0);

    groups.push({
      id: `nf_${head.originalNodeId}`,
      headDepth: head.depthInModule ?? 0,
      couple,
      childrenRows,
      cols,
      w,
      h,
    });

    nestedHeads.forEach((nh) => makeGroup(nh));
  };

  entryRoots.forEach((er) => makeGroup(er));

  // Tangkap anggota yatim jika ada
  const leftovers = membersMeta.filter((mm) => !usedIds.has(mm.originalNodeId));
  if (leftovers.length > 0) {
    const cols = Math.min(maxLeafCols, leftovers.length);
    const rows: MergedCardMember[][] = [];
    for (let i = 0; i < leftovers.length; i += cols) {
      rows.push(leftovers.slice(i, i + cols));
    }
    const maxR = rows.reduce((mx, r) => Math.max(mx, r.length), 0);
    groups.push({
      id: `nf_rest`,
      headDepth: leftovers[0].depthInModule ?? 1,
      couple: rows[0] || [],
      childrenRows: rows.slice(1),
      cols,
      w: maxR * cellW + Math.max(0, maxR - 1) * tightGap + 4,
      h: rows.length * cellH + Math.max(0, rows.length - 1) * tightGap + 4,
    });
  }

  return groups;
}

export function computeModularContainerPlan(
  membersCount: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1,
  customCols?: number,
  modularSubLayout: 'grid' | 'I' | 'L' = 'grid',
  membersMeta?: MergedCardMember[]
): ModularContainerPlan {
  const unit = getUniformSubCardSize(displayMode, photoSize, cardScale);
  const cellW = unit.w;
  const cellH = unit.h;
  const clampedScale = Math.max(0.55, Math.min(1.15, cardScale));

  // Jarak internal keluarga inti 1–2mm, jarak antar keluarga inti 3–5mm
  const tightGap = Math.max(3, Math.round(1.5 * MM_TO_PX * clampedScale));
  const looseGap = Math.max(
    tightGap + 6,
    Math.round(4 * MM_TO_PX * clampedScale)
  );
  const padX = Math.max(5, Math.round(looseGap * 0.55));
  const padY = Math.max(5, Math.round(looseGap * 0.5));
  const headerH = Math.max(15, Math.round(19 * Math.max(0.65, cardScale)));

  if (
    (modularSubLayout === 'I' || modularSubLayout === 'L') &&
    membersMeta &&
    membersMeta.length >= 2
  ) {
    const maxLeafCols = Math.max(2, Math.min(5, customCols || 3));
    const groups = buildNuclearFamilyGroups(
      membersMeta,
      cellW,
      cellH,
      tightGap,
      maxLeafCols
    );

    if (modularSubLayout === 'I') {
      const headGroup = groups[0];
      const childGroups = groups.slice(1);
      const iSubCols =
        childGroups.length === 0
          ? 1
          : Math.max(
              1,
              Math.min(
                childGroups.length,
                customCols || (childGroups.length >= 4 ? 2 : 1)
              )
            );

      // Hitung lebar & tinggi blok childGroups per baris
      let subRowsW = 0;
      let subRowsH = 0;
      for (let i = 0; i < childGroups.length; i += iSubCols) {
        const slice = childGroups.slice(i, i + iSubCols);
        const rw =
          slice.reduce((s, g) => s + g.w, 0) +
          Math.max(0, slice.length - 1) * looseGap;
        const rh = Math.max(...slice.map((g) => g.h));
        subRowsW = Math.max(subRowsW, rw);
        subRowsH += (i > 0 ? looseGap : 0) + rh;
      }

      const bodyW = Math.max(headGroup ? headGroup.w : cellW, subRowsW);
      const bodyH =
        (headGroup ? headGroup.h : 0) +
        (childGroups.length > 0 ? looseGap + subRowsH : 0);

      return {
        layout: 'I',
        cols: maxLeafCols,
        rows: Math.max(1, groups.length),
        cellW,
        cellH,
        photoW: unit.photoW,
        photoH: unit.photoH,
        badgeH: unit.badgeH,
        gap: tightGap,
        tightGap,
        looseGap,
        padX,
        padY,
        headerH,
        groups,
        lRightGroups: [],
        lDownGroups: [],
        iSubCols,
        w: bodyW + padX * 2,
        h: headerH + (headerH > 0 ? 4 : 0) + bodyH + padY * 2,
      };
    }

    // Pola L: Kepala di kiri-atas, cabang pertama ke kanan (lengan atas L), cabang lanjut ke bawah (lengan turun L)
    const headGroup = groups[0];
    const restGroups = groups.slice(1);

    // Jika hanya 1 keluarga inti di modul (G3 + anak lajang), buat formasi siku L dari anak-anak di dalam grup!
    if (restGroups.length === 0 && headGroup) {
      const coupleCount = headGroup.couple.length;
      const flatKids = headGroup.childrenRows.flat();
      if (flatKids.length >= 2) {
        const rightKidCount = Math.min(2, Math.ceil(flatKids.length / 2));
        const rightKids = flatKids.slice(0, rightKidCount);
        const downKids = flatKids.slice(rightKidCount);
        const topRowW =
          coupleCount * cellW +
          tightGap +
          rightKids.length * cellW +
          Math.max(0, rightKids.length - 1) * tightGap;
        const downCols = Math.min(2, Math.max(1, downKids.length));
        const downRows = Math.ceil(downKids.length / downCols);
        const downW =
          downCols * cellW + Math.max(0, downCols - 1) * tightGap;
        const bodyW = Math.max(topRowW, downW) + 4;
        const bodyH =
          cellH +
          (downRows > 0
            ? tightGap + downRows * cellH + Math.max(0, downRows - 1) * tightGap
            : 0) +
          4;
        return {
          layout: 'L',
          cols: coupleCount + rightKidCount,
          rows: 1 + downRows,
          cellW,
          cellH,
          photoW: unit.photoW,
          photoH: unit.photoH,
          badgeH: unit.badgeH,
          gap: tightGap,
          tightGap,
          looseGap,
          padX,
          padY,
          headerH,
          groups,
          lRightGroups: [],
          lDownGroups: [],
          iSubCols: 1,
          w: bodyW + padX * 2,
          h: headerH + (headerH > 0 ? 4 : 0) + bodyH + padY * 2,
        };
      }
    }

    const rightCount =
      restGroups.length > 0
        ? Math.min(customCols && customCols >= 3 ? 2 : 1, Math.ceil(restGroups.length / 3))
        : 0;
    const lRightGroups = restGroups.slice(0, rightCount);
    const lDownGroups = restGroups.slice(rightCount);

    const topArmW =
      (headGroup ? headGroup.w : 0) +
      lRightGroups.reduce((s, g) => s + looseGap + g.w, 0);
    const topArmH = Math.max(
      headGroup ? headGroup.h : 0,
      ...lRightGroups.map((g) => g.h),
      0
    );

    const downCols = lDownGroups.length >= 4 ? 2 : 1;
    let downArmW = 0;
    let downArmH = 0;
    for (let i = 0; i < lDownGroups.length; i += downCols) {
      const slice = lDownGroups.slice(i, i + downCols);
      const rw =
        slice.reduce((s, g) => s + g.w, 0) +
        Math.max(0, slice.length - 1) * looseGap;
      const rh = Math.max(...slice.map((g) => g.h));
      downArmW = Math.max(downArmW, rw);
      downArmH += (i > 0 ? looseGap : 0) + rh;
    }

    const bodyW = Math.max(topArmW, downArmW);
    const bodyH = topArmH + (downArmH > 0 ? looseGap + downArmH : 0);

    return {
      layout: 'L',
      cols: Math.max(2, customCols || 3),
      rows: Math.max(1, 1 + lDownGroups.length),
      cellW,
      cellH,
      photoW: unit.photoW,
      photoH: unit.photoH,
      badgeH: unit.badgeH,
      gap: tightGap,
      tightGap,
      looseGap,
      padX,
      padY,
      headerH,
      groups,
      lRightGroups,
      lDownGroups,
      iSubCols: downCols,
      w: bodyW + padX * 2,
      h: headerH + (headerH > 0 ? 4 : 0) + bodyH + padY * 2,
    };
  }

  const defaultCols =
    membersCount <= 2
      ? 2
      : membersCount === 3
      ? 3
      : membersCount === 4
      ? 2
      : membersCount <= 6
      ? 3
      : 4;
  const cols = Math.max(1, Math.min(membersCount, customCols || defaultCols));
  const rows = Math.max(1, Math.ceil(membersCount / cols));

  return {
    layout: 'grid',
    cols,
    rows,
    cellW,
    cellH,
    photoW: unit.photoW,
    photoH: unit.photoH,
    badgeH: unit.badgeH,
    gap: tightGap,
    tightGap,
    looseGap,
    padX,
    padY,
    headerH,
    groups: [],
    lRightGroups: [],
    lDownGroups: [],
    iSubCols: 1,
    w: cols * cellW + (cols - 1) * tightGap + padX * 2,
    h: headerH + (headerH > 0 ? 4 : 0) + rows * cellH + (rows - 1) * tightGap + padY * 2,
  };
}

export function computeMergedCardMetrics(
  membersCount: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1,
  customCols?: number,
  modularSubLayout: 'grid' | 'I' | 'L' = 'grid',
  membersMeta?: MergedCardMember[]
): {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  gap: number;
  padX: number;
  padY: number;
  headerH: number;
  w: number;
  h: number;
} {
  const plan = computeModularContainerPlan(
    membersCount,
    displayMode,
    photoSize,
    cardScale,
    customCols,
    modularSubLayout,
    membersMeta
  );
  return {
    cols: plan.cols,
    rows: plan.rows,
    cellW: plan.cellW,
    cellH: plan.cellH,
    gap: plan.gap,
    padX: plan.padX,
    padY: plan.padY,
    headerH: plan.headerH,
    w: plan.w,
    h: plan.h,
  };
}

export interface SmartLayoutQuality {
  overlapCount: number;
  outOfBoundsCount: number;
  coveragePct: number;
  usedWidthPct: number;
  usedHeightPct: number;
}

export interface SmartGalleryOption {
  preset: SmartLayoutPreset;
  optimalScale: number;
  quality: SmartLayoutQuality;
  recommendedPaper: GridPaperSize;
  score: number;
  isTopPick: boolean;
}

export function estimateSmartNodeBoxSize(
  node: InteractiveNode,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1
): { w: number; h: number } {
  const effScale = cardScale * (node.scaleMultiplier ?? 1);

  if (node.mergedMembers && node.mergedMembers.length >= 2) {
    const m = computeMergedCardMetrics(
      node.mergedMembers.length,
      displayMode,
      photoSize,
      effScale,
      node.mergedCols,
      node.modularSubLayout || 'grid',
      node.mergedMembers
    );
    return { w: m.w, h: m.h };
  }

  const pDim = BASE_PHOTO_DIMS[photoSize] || BASE_PHOTO_DIMS['3x4'];

  if (displayMode === 'photo_name_unified') {
    if (node.cardShape === 'hex') {
      const w = Math.max(54, Math.round(Math.max(pDim.w + 18, 74) * effScale));
      const h = Math.max(62, Math.round(w * 1.14));
      return { w, h };
    }
    const u = getUniformSubCardSize(displayMode, photoSize, effScale);
    return { w: u.w, h: u.h };
  }

  if (
    node.modularSubLayout === 'I' ||
    node.modularSubLayout === 'L' ||
    (node.scaleMultiplier ?? 1) > 1.05
  ) {
    const u = getUniformSubCardSize(displayMode, photoSize, effScale);
    return { w: u.w, h: u.h };
  }

  if (displayMode === 'photo_name') {
    const u = getUniformSubCardSize(displayMode, photoSize, effScale);
    return { w: u.w, h: u.h };
  }

  if (displayMode === 'name_only') {
    const nameLen = node.name.trim().length;
    const estW = Math.max(104, Math.min(200, nameLen * 7.5 + 24));
    const estLines = nameLen > 24 ? 2 : 1;
    return {
      w: Math.round(estW * effScale),
      h: Math.max(26, Math.round((estLines > 1 ? 48 : 38) * effScale)),
    };
  }
  return {
    w: Math.round(Math.max(142, pDim.w + 26) * effScale),
    h: Math.round((pDim.h + 50) * effScale),
  };
}

export function evaluateSmartLayoutQuality(
  nodes: InteractiveNode[],
  _edges: InteractiveEdge[],
  boardWidth: number,
  boardHeight: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale: number
): SmartLayoutQuality {
  if (nodes.length === 0) {
    return {
      overlapCount: 0,
      outOfBoundsCount: 0,
      coveragePct: 0,
      usedWidthPct: 0,
      usedHeightPct: 0,
    };
  }

  const boxes = nodes.map((n) => {
    const sz = estimateSmartNodeBoxSize(n, displayMode, photoSize, cardScale);
    return { id: n.id, x: n.x, y: n.y, w: sz.w, h: sz.h };
  });

  let overlapCount = 0;
  let outOfBoundsCount = 0;
  let totalArea = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    totalArea += a.w * a.h;
    minX = Math.min(minX, a.x);
    maxX = Math.max(maxX, a.x + a.w);
    minY = Math.min(minY, a.y);
    maxY = Math.max(maxY, a.y + a.h);

    if (a.x < 8 || a.y < 36 || a.x + a.w > boardWidth - 8 || a.y + a.h > boardHeight - 10) {
      outOfBoundsCount++;
    }

    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 3 && oy > 3) {
        overlapCount++;
      }
    }
  }

  const boardArea = Math.max(1, boardWidth * boardHeight);
  return {
    overlapCount,
    outOfBoundsCount,
    coveragePct: Math.min(100, Math.round((totalArea / boardArea) * 100)),
    usedWidthPct: Math.min(100, Math.round(((maxX - minX) / Math.max(1, boardWidth)) * 100)),
    usedHeightPct: Math.min(100, Math.round(((maxY - minY) / Math.max(1, boardHeight)) * 100)),
  };
}

// Hitung skala ukuran kartu & foto paling ideal lewat simulasi tata letak nyata: bebas tumpuk & penuh proporsional!
export function computeOptimalCardScale(
  members: FamilyMember[],
  boardWidth: number,
  boardHeight: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  presetId?: SmartPresetId
): number {
  const spouseCount = members.reduce(
    (sum, m) => sum + (m.spouses ? m.spouses.length : 0),
    0
  );
  const totalCards = Math.max(1, members.length + spouseCount);

  // Untuk Modular Card I / L di A3 (kapasitas 100+ anggota), simulasikan packing langsung agar skala terbesar muat tanpa dead space!
  if (presetId === 'modular_g3_I' || presetId === 'modular_g3_L') {
    const minModScale =
      totalCards >= 120 ? 0.32 : totalCards >= 95 ? 0.36 : totalCards >= 70 ? 0.42 : 0.5;
    const maxModScale = totalCards <= 20 ? 1.15 : totalCards <= 50 ? 0.95 : 0.85;
    let bestScale = minModScale;
    for (let s = maxModScale; s >= minModScale; s = +(s - 0.05).toFixed(2)) {
      const unit = getUniformSubCardSize(displayMode, photoSize, s);
      const res = generateSmartLayoutFromTable(
        members,
        presetId,
        boardWidth,
        boardHeight,
        { w: unit.w, h: unit.h },
        {
          displayMode,
          photoSize,
          cardScale: s,
          cardGapMm: 3.5,
          modularG12Position: 'center',
        }
      );
      let maxBottom = 0;
      let maxRight = 0;
      res.nodes.forEach((n) => {
        if (n.mergedMembers && n.mergedMembers.length >= 2) {
          const pl = computeModularContainerPlan(
            n.mergedMembers.length,
            displayMode,
            photoSize,
            s * (n.scaleMultiplier ?? 1),
            n.mergedCols,
            n.modularSubLayout || 'grid',
            n.mergedMembers
          );
          maxBottom = Math.max(maxBottom, n.y + pl.h);
          maxRight = Math.max(maxRight, n.x + pl.w);
        } else {
          const mult =
            n.modularSubLayout === 'I' || n.modularSubLayout === 'L'
              ? 1
              : n.scaleMultiplier ?? 1;
          const nw =
            mult === 1
              ? unit.w
              : getUniformSubCardSize(displayMode, photoSize, s * mult).w;
          const nh =
            mult === 1
              ? unit.h
              : getUniformSubCardSize(displayMode, photoSize, s * mult).h;
          maxBottom = Math.max(maxBottom, n.y + nh);
          maxRight = Math.max(maxRight, n.x + nw);
        }
      });
      if (maxBottom <= boardHeight - 40 && maxRight <= boardWidth - 18) {
        bestScale = s;
        break;
      }
    }
    return bestScale;
  }

  // Simulasi nyata untuk semua preset lain (9 Baris, Orbit, Pohon, Klaster)
  // Memastikan G4 & G5 tidak terjepit sampai menumpuk sebelum disusun!
  const effPreset: SmartPresetId =
    presetId || (totalCards > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical');
  const minAllowedScale =
    totalCards >= 85 ? 0.35 : totalCards >= 45 ? 0.42 : totalCards >= 24 ? 0.48 : 0.55;
  const maxAllowedScale = totalCards <= 10 ? 1.35 : totalCards <= 24 ? 1.15 : 0.95;

  const scaleCandidates: number[] = [];
  for (let s = maxAllowedScale; s >= minAllowedScale - 0.001; s = +(s - 0.1).toFixed(2)) {
    scaleCandidates.push(Math.max(minAllowedScale, s));
  }

  let bestCleanScale = 0;
  let fallbackBestScale = minAllowedScale;
  let fallbackMinIssues = Infinity;

  for (const s of scaleCandidates) {
    const dim = getBaseCardSizeForScale(displayMode, photoSize, s);
    const sim = generateSmartLayoutFromTable(
      members,
      effPreset,
      boardWidth,
      boardHeight,
      dim,
      {
        displayMode,
        photoSize,
        cardScale: s,
        cardGapMm: 3,
      }
    );
    const q = evaluateSmartLayoutQuality(
      sim.nodes,
      sim.edges,
      boardWidth,
      boardHeight,
      displayMode,
      photoSize,
      s
    );
    const issues = q.overlapCount * 10 + q.outOfBoundsCount;
    if (issues < fallbackMinIssues) {
      fallbackMinIssues = issues;
      fallbackBestScale = s;
    }
    if (q.overlapCount === 0 && q.outOfBoundsCount === 0) {
      bestCleanScale = s;
      // Coba 1 tingkat +0.05 di atasnya bila masih bebas tumpuk
      const higher = Math.min(maxAllowedScale, +(s + 0.05).toFixed(2));
      if (higher > s) {
        const hiDim = getBaseCardSizeForScale(displayMode, photoSize, higher);
        const hiSim = generateSmartLayoutFromTable(
          members,
          effPreset,
          boardWidth,
          boardHeight,
          hiDim,
          { displayMode, photoSize, cardScale: higher, cardGapMm: 3 }
        );
        const hiQ = evaluateSmartLayoutQuality(
          hiSim.nodes,
          hiSim.edges,
          boardWidth,
          boardHeight,
          displayMode,
          photoSize,
          higher
        );
        if (hiQ.overlapCount === 0 && hiQ.outOfBoundsCount === 0) {
          bestCleanScale = higher;
        }
      }
      break;
    }
  }

  const chosen = bestCleanScale > 0 ? bestCleanScale : fallbackBestScale;
  return Math.round(Math.max(minAllowedScale, Math.min(1.45, chosen)) * 20) / 20;
}

// Analisis cerdas dari data Tabel Trah untuk merekomendasikan ukuran kertas & tata letak terbaik
export function analyzeTrahForSmartLayout(
  members: FamilyMember[]
): SmartAnalysisSummary {
  const spouseCount = members.reduce(
    (sum, m) => sum + (m.spouses ? m.spouses.length : 0),
    0
  );
  const totalPeopleWithSpouses = members.length + spouseCount;
  const genLevels = new Set(members.map((m) => m.generationLevel ?? 0));
  const generationCount = Math.max(1, genLevels.size);

  let recommendedPaper: GridPaperSize = 'a3';
  if (totalPeopleWithSpouses <= 10) recommendedPaper = 'a4';
  else if (totalPeopleWithSpouses <= 34) recommendedPaper = 'a3';
  else if (totalPeopleWithSpouses <= 64) recommendedPaper = 'a2';
  else if (totalPeopleWithSpouses <= 105) recommendedPaper = 'a1';
  else recommendedPaper = 'a0';

  let topPresetId: SmartPresetId = 'hierarchy_grid_fill';
  let reason = `${totalPeopleWithSpouses} kartu dalam ${generationCount} generasi siap ditata otomatis bebas tumpukan dengan solver 4-arah di kertas ${recommendedPaper.toUpperCase()}.`;

  if (totalPeopleWithSpouses >= 32) {
    topPresetId = 'modular_g3_I';
    reason = `Trah besar (${totalPeopleWithSpouses} orang, ${generationCount} generasi): Modular Poros Tengah atau Kotak 9 Baris Gabung sangat rapi tanpa edit manual.`;
  } else if (totalPeopleWithSpouses <= 16 && generationCount <= 4) {
    topPresetId = 'subtree_vertical';
    reason = `Cocok untuk ${totalPeopleWithSpouses} kartu (${generationCount} generasi) agar garis keturunan lurus tegak dan foto besar mengisi kertas.`;
  } else if (generationCount >= 6 && totalPeopleWithSpouses <= 28) {
    topPresetId = 'subtree_horizontal';
    reason = `${generationCount} tingkatan generasi rapi mengalir kiri ke kanan; atau pilih Kotak 9 Baris / Modular agar padat seimbang.`;
  }

  return {
    totalPeopleWithSpouses,
    generationCount,
    recommendedPaper,
    topPresetId,
    reason,
  };
}

// Bangun daftar pilihan galeri Smart terbaik yang sudah diuji nol-tumpukan untuk kanvas aktif
export function buildSmartGalleryOptions(
  members: FamilyMember[],
  boardWidth: number,
  boardHeight: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardGapMm = 3.5
): SmartGalleryOption[] {
  if (!members || members.length === 0) return [];
  const summary = analyzeTrahForSmartLayout(members);
  const isDense = summary.totalPeopleWithSpouses >= 24;

  const candidateIds: SmartPresetId[] = isDense
    ? [
        'sarang_lebah_turun',
        'sarang_lebah_pusat',
        'teratai_mekar',
        'modular_g3_I',
        'modular_g3_L',
        'kotak_9_baris_g45_gabung',
        'kotak_9_baris',
        'orbit_elips_gabung',
        'hierarchy_grid_fill',
        'pohon_hayat_besar',
      ]
    : [
        'sarang_lebah_turun',
        'sarang_lebah_pusat',
        'teratai_mekar',
        'subtree_vertical',
        'kotak_9_baris',
        'orbit_elips_1_5',
        'modular_g3_I',
        'hierarchy_grid_fill',
        'subtree_horizontal',
        'pohon_hayat_besar',
      ];

  const evaluated: SmartGalleryOption[] = candidateIds
    .map((pid) => {
      const preset = SMART_LAYOUT_PRESETS.find((p) => p.id === pid);
      if (!preset) return null;
      const effMode: CardDisplayMode =
        pid === 'sarang_lebah_turun' ||
        pid === 'sarang_lebah_pusat' ||
        pid === 'teratai_mekar'
          ? 'photo_name_unified'
          : displayMode;
      const effPhoto = photoSize;
      const optScale = computeOptimalCardScale(
        members,
        boardWidth,
        boardHeight,
        effMode,
        effPhoto,
        pid
      );
      const isMod = pid === 'modular_g3_I' || pid === 'modular_g3_L';
      const dim = isMod
        ? getUniformSubCardSize(effMode, effPhoto, optScale)
        : getBaseCardSizeForScale(effMode, effPhoto, optScale);

      const sim = generateSmartLayoutFromTable(
        members,
        pid,
        boardWidth,
        boardHeight,
        dim,
        {
          displayMode: effMode,
          photoSize: effPhoto,
          cardScale: optScale,
          cardGapMm,
          modularG12Position: 'center',
        }
      );
      const quality = evaluateSmartLayoutQuality(
        sim.nodes,
        sim.edges,
        boardWidth,
        boardHeight,
        effMode,
        effPhoto,
        optScale
      );

      // Skor lebih tinggi untuk nol-tumpuk + skala kartu besar + area kertas terisi baik
      const cleanBonus = quality.overlapCount === 0 && quality.outOfBoundsCount === 0 ? 1000 : 0;
      const overlapPenalty = quality.overlapCount * 140 + quality.outOfBoundsCount * 60;
      const scaleScore = Math.round(optScale * 180);
      const balanceScore =
        quality.coveragePct >= 18 && quality.coveragePct <= 72 ? 80 : 30;
      const presetBonus = pid === summary.topPresetId ? 65 : 0;
      const score = cleanBonus - overlapPenalty + scaleScore + balanceScore + presetBonus;

      return {
        preset,
        optimalScale: optScale,
        quality,
        recommendedPaper: summary.recommendedPaper,
        score,
        isTopPick: false,
      };
    })
    .filter((x): x is SmartGalleryOption => Boolean(x));

  evaluated.sort((a, b) => b.score - a.score);
  if (evaluated.length > 0) {
    evaluated[0].isTopPick = true;
  }
  return evaluated;
}

export const SMART_LAYOUT_PRESETS: SmartLayoutPreset[] = [
  {
    id: 'modular_g3_I',
    title: 'Modular Card I (Poros Tengah • Tanpa Garis)',
    subtitle: 'G1–G2 Besar di Tengah • G3+ Foto 2×3 + Badge • Keluarga Inti 3–5mm • Kapasitas 100+ A3',
    badge: 'Modular I',
    category: 'modular',
    description:
      'Desain A3 berkapasitas 100+ anggota tanpa garis konektor: G1–G2 besar di poros tengah, kontainer keluarga inti G3 (jarak 1–2mm internal, 3–5mm antar kelompok, pasangan 0mm) dengan foto seragam 2×3 + badge ringkas dan gradasi warna tua ➔ muda.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'none',
    recommendedGuideMode: 'modular_center',
    recommendedGenGradient: 'royal_emerald',
  },
  {
    id: 'modular_g3_L',
    title: 'Modular Card L (Poros Tengah • Tanpa Garis)',
    subtitle: 'G1–G2 Besar di Tengah • Siku L Keluarga Inti • Foto 2×3 Seragam • Kapasitas 100+ A3',
    badge: 'Modular L',
    category: 'modular',
    description:
      'Tata letak A3 kompak tanpa garis konektor: G1–G2 besar di tengah kanvas, setiap modul G3 tersusun siku L yang memisahkan kelompok keluarga inti 3–5mm (internal 1–2mm, pasangan 0mm) dengan foto seragam 2×3 + gradasi warna tua ➔ muda.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'none',
    recommendedGuideMode: 'modular_center',
    recommendedGenGradient: 'ocean_blue',
  },
  {
    id: 'kotak_9_baris',
    title: 'Kotak 9 Baris Simetris (Gradasi G1➔G5)',
    subtitle: 'Baris 5 = G1–G2 • Baris 4 & 6 = G3 • Baris 3 & 7 = G4 • Baris 1,2,8,9 = G5',
    badge: '9 Baris',
    category: 'kotak9',
    description:
      'Konsep kotak 9 baris dengan gradasi warna tua di G1–G2 ke muda di G5+: pasangan menempel, saudara belum menikah berjarak 1–2mm, dan garis keturunan mengikuti arah cabang.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'pcb45',
    recommendedGuideMode: 'grid_9_rows',
    recommendedGenGradient: 'royal_emerald',
  },
  {
    id: 'kotak_9_baris_g45_gabung',
    title: 'Kotak 9 Baris + Gabung G4–G5 (Klaster Nasab)',
    subtitle: 'G1–G2 Baris 5 • G3 Baris 4 & 6 • G4–G5 Digabung / Berdekatan per Keturunan',
    badge: '9 Baris Gabung',
    category: 'kotak9',
    description:
      'Mempertahankan pusat 9 baris bergradasi warna (G1 tua ➔ G5 muda), lalu menggabungkan kartu G4 dan keturunan G5-nya jadi Card Besar berdekatan dengan 1 garis saja agar cabang luar rapi.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'pcb45',
    recommendedGuideMode: 'grid_9_rows',
    recommendedGenGradient: 'amber_earth',
  },
  {
    id: 'orbit_elips_1_5',
    title: 'Orbit Bulat / Elips 1–5 (Gradasi Pusat➔Luar)',
    subtitle: 'Orbit 1 = G1–G2 Tua • Orbit 2 = G3 • Orbit 3–4 = G4 • Orbit 5 = G5 Cerah',
    badge: 'Orbit 1–5',
    category: 'orbit',
    description:
      'Tata letak lingkaran/elips memancar dari pusat warna tua (G1–G2) ke orbit luar cerah (G5+): pasangan menempel, jarak 1–5mm, setiap cabang ditempatkan di sudut terdekat induknya.',
    recommendedTheme: 'dark',
    recommendedBg: 'bg-galaksi',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: 'bulat',
    recommendedLineStyle: 'straight',
    recommendedGuideMode: 'orbit_rings',
    recommendedGenGradient: 'ocean_blue',
  },
  {
    id: 'orbit_elips_gabung',
    title: 'Orbit Elips 1–5 + Gabung G4–G5 (Lingkaran Ringkas)',
    subtitle: 'Orbit 1–2 Pusat G1–G3 • Orbit 3–5 Luar Gabungan G4–G5 per Keturunan',
    badge: 'Orbit Gabung',
    category: 'orbit',
    description:
      'Lingkaran/elips terpusat bergradasi warna (G1–G2 tua di Orbit 1, G3 Orbit 2) dengan cabang G4–G5 terluar digabung jadi 1 Card Besar per garis keturunan di Orbit 3–5.',
    recommendedTheme: 'dark',
    recommendedBg: 'bg-galaksi',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: 'bulat',
    recommendedLineStyle: 'curved',
    recommendedGuideMode: 'orbit_rings',
    recommendedGenGradient: 'violet_dusk',
  },
  {
    id: 'sarang_lebah_turun',
    title: 'Sarang Lebah Bertingkat (Pembatas Warna · Tanpa Garis)',
    subtitle: 'Segi Enam Mengunci · Batas Warna G2 ⊃ G3 ⊃ G4 ⊃ G5 · Foto+Nama Menyatu',
    badge: 'Lebah Turun',
    category: 'modular',
    description:
      'Susunan sarang lebah segi enam mengalir rapi dari puncak G1 ke bawah tanpa garis penghubung: pembatas warna bertingkat G2 melingkupi G3, G3 melingkupi G4 dan G5 dengan foto serta nama menyatu utuh di dalam sel.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name_unified',
    recommendedPhotoSize: 'bulat',
    recommendedLineStyle: 'none',
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'none',
  },
  {
    id: 'sarang_lebah_pusat',
    title: 'Sarang Lebah Ratu Pusat (6 Sisi Mekar · Tanpa Garis)',
    subtitle: 'G1 Pusat · 6 Sektor Klan · Pembatas Warna G2 ⊃ G3 ⊃ G4 ⊃ G5 · Menyatu',
    badge: 'Lebah Pusat',
    category: 'orbit',
    description:
      'Konsep Ratu Lebah di pusat segi enam: G2 mengelilingi pusat dan mekar ke G3–G5 pada sektor masing-masing, lengkap dengan wadah pembatas warna bertingkat pengganti garis serta kartu menyatu foto dan nama.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name_unified',
    recommendedPhotoSize: 'bulat',
    recommendedLineStyle: 'none',
    recommendedGuideMode: 'orbit_rings',
    recommendedGenGradient: 'none',
  },
  {
    id: 'teratai_mekar',
    title: 'Kolam Teratai Mekar (Bunga Terpisah G1–G3 · Kelopak G4–G5)',
    subtitle: 'G1–G3 Bunga Terpisah (Pasangan di Bunga) · G4–G5 Kelopak Kelilingi G3',
    badge: 'Teratai Kolam',
    category: 'orbit',
    description:
      'G1, G2, dan G3 menjadi kuntum bunga teratai terpisah dengan pasangan menempel di pusat bunga dan garis tangkai cukup antar bunga (G1→G2→G3); sementara G4–G5 mekar merata menjadi kelopak yang mengelilingi bunga G3-nya.',
    recommendedTheme: 'dark',
    recommendedBg: 'bg-galaksi',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name_unified',
    recommendedPhotoSize: 'bulat',
    recommendedLineStyle: 'curved',
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'lotus_blossom',
  },
  {
    id: 'hierarchy_grid_fill',
    title: 'Isi Penuh Kertas (Anti-Kosong & Garis Generasi)',
    subtitle: 'Muat penuh di A3/pilihan • Baris rapi + jalur garis & label Gen',
    badge: 'Pas Kertas',
    category: 'klasik',
    description:
      'Membungkus cabang ke beberapa baris di dalam kertas pilihan (misal A3) agar tidak ada ruang kosong terbuang, sambil menandai jalur generasi dan garis hirarki nasab secara jelas.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '3x4',
    recommendedLineStyle: 'pcb45',
    recommendedGuideMode: 'gen_bands',
  },
  {
    id: 'subtree_vertical',
    title: 'Pohon Ranting Vertikal (Anti-Silang)',
    subtitle: 'Garis keturunan tegak lurus • Orang tua di tengah atas anak',
    badge: 'Paling Lurus',
    category: 'klasik',
    description:
      'Menghitung lebar setiap cabang keluarga secara otomatis dari data Tabel sehingga anak selalu berada di bawah orang tuanya tanpa garis yang bersilangan.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '3x4',
    recommendedLineStyle: 'pcb45',
    recommendedGuideMode: 'gen_bands',
  },
  {
    id: 'pohon_hayat_besar',
    title: 'Pohon Cemara Bertingkat · Terkunci',
    subtitle: 'Dikunci sementara sesuai arahan · Batang 75% ➔ Dahan Zigzag ➔ Daun',
    badge: 'Pohon Besar',
    category: 'klasik',
    description:
      'Mode Pohon Hayat Besar dikunci sementara menjaga tata letak yang ada: batang tengah 75% tinggi kertas, dahan naik untuk G3, ranting untuk G4, dan daun G5 dekat G4.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'straight',
    recommendedLineThicknessMode: 'tree_taper',
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'wood_leaf',
  },
  {
    id: 'subtree_horizontal',
    title: 'Alur Cabang Kiri ➔ Kanan',
    subtitle: 'Cocok untuk banyak generasi • Mengisi lebar kertas',
    badge: 'Lanskap Luas',
    category: 'klasik',
    description:
      'Menempatkan leluhur di sisi kiri dan keturunan mengalir ke kanan dengan pasangan menempel rapat sesuai lebar kertas aktif.',
    recommendedTheme: 'light',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'pcb45',
    recommendedGuideMode: 'gen_bands',
  },
  {
    id: 'family_cluster',
    title: 'Klaster Keluarga Inti (Berdekatan)',
    subtitle: 'Pas untuk banyak anggota di A3 • Garis pendek & padat',
    badge: 'Hemat Kertas',
    category: 'klasik',
    description:
      'Mengelompokkan setiap pasangan orang tua dan anak-anaknya dalam blok berdekatan di koridor kertas sehingga tidak ada ruang kosong terbuang.',
    recommendedTheme: 'light',
    recommendedBg: '',
    recommendedOrientation: 'portrait',
    recommendedCardMode: 'name_only',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'pcb45',
    recommendedGuideMode: 'gen_bands',
  },
  {
    id: 'heritage_showcase',
    title: 'Poster Silsilah Showcase',
    subtitle: 'Tampilan cetak bingkai • Latar Pohon Keluarga',
    badge: 'Siap Cetak',
    category: 'klasik',
    description:
      'Tata letak simetris bernuansa pohon keluarga dengan jarak seimbang untuk dicetak atau dibagikan, tetap bebas digeser jika ingin penyesuaian.',
    recommendedTheme: 'dark',
    recommendedBg: 'bg-pohon',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '3x4',
    recommendedLineStyle: 'pcb45',
    recommendedGuideMode: 'gen_bands',
  },
];

// Helper membangun peta anak yang terurut berdasarkan orderIndex
function buildHierarchyFromMembers(members: FamilyMember[]) {
  const idSet = new Set(members.map((m) => m.id));
  const childrenMap = new Map<string, FamilyMember[]>();

  members.forEach((m) => {
    if (m.parentId && idSet.has(m.parentId)) {
      if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, []);
      childrenMap.get(m.parentId)!.push(m);
    }
  });

  childrenMap.forEach((arr) =>
    arr.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
  );

  // Cari semua root (parentId null atau parentId tidak ditemukan)
  let roots = members
    .filter((m) => !m.parentId || !idSet.has(m.parentId))
    .sort(
      (a, b) =>
        (a.generationLevel || 0) - (b.generationLevel || 0) ||
        (a.orderIndex || 0) - (b.orderIndex || 0)
    );

  const visited = new Set<string>();
  const walk = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    (childrenMap.get(id) || []).forEach((c) => walk(c.id));
  };
  roots.forEach((r) => walk(r.id));

  const unreached = members.filter((m) => !visited.has(m.id));
  if (unreached.length > 0) {
    roots = [...roots, ...unreached];
  }

  return { roots, childrenMap };
}

// ============================================================================
// GENERATOR LAYOUT PINTAR BERBASIS DATA TABEL (RAPAT, DEKAT INDUK, ANTI-SILANG)
// ============================================================================
export function generateSmartLayoutFromTable(
  members: FamilyMember[],
  presetId: SmartPresetId,
  boardWidth: number,
  boardHeight: number,
  cardSize: { w: number; h: number },
  options?: {
    displayMode?: CardDisplayMode;
    photoSize?: PhotoFrameSize;
    cardScale?: number;
    cardGapMm?: number;
    modularG12Position?: 'top' | 'center';
    aiBlueprint?: NasabAiBlueprint | null;
  }
): { nodes: InteractiveNode[]; edges: InteractiveEdge[] } {
  if (!members || members.length === 0) {
    return { nodes: [], edges: [] };
  }

  const displayMode: CardDisplayMode = options?.displayMode ?? 'full';
  const photoSize: PhotoFrameSize = options?.photoSize ?? '3x4';
  const cardScale: number = options?.cardScale ?? 1;
  const cardGapMm: number = Math.max(1, Math.min(5, options?.cardGapMm ?? 3.5));
  const modularG12Position: 'top' | 'center' = options?.modularG12Position ?? 'center';
  const aiBlueprint: NasabAiBlueprint | null = options?.aiBlueprint ?? null;
  const getBpStop = (gen: number) => {
    if (!aiBlueprint?.genColors || aiBlueprint.genColors.length === 0) return undefined;
    const idx = Math.max(0, Math.min(aiBlueprint.genColors.length - 1, Math.floor(gen)));
    return aiBlueprint.genColors[idx];
  };

  const { roots, childrenMap } = buildHierarchyFromMembers(members);
  const nodes: InteractiveNode[] = [];
  const edges: InteractiveEdge[] = [];

  const cardW = Math.max(54, cardSize.w);
  const cardH = Math.max(26, cardSize.h);
  const topSafeY = 72;
  const bottomSafeMargin = 88;
  const usableH = Math.max(240, boardHeight - topSafeY - bottomSafeMargin);

  // Pasangan menempel rapat (0mm), saudara belum menikah 1.5mm (~6px), umum 1–5mm
  const coupleGap = 0;
  const unmarriedGapPx = Math.max(4, Math.round(1.5 * MM_TO_PX));
  const compactSiblingGap = Math.max(4, Math.round(cardGapMm * MM_TO_PX));
  const compactRowGap = Math.max(26, Math.min(64, Math.round(cardH * 0.34)));

  // -------------------------------------------------------------------------
  // HELPER BERSAMA: POHON RANTING KOMPAK (PARENT TERPUSAT TEPAT DI ATAS ANAK)
  // Mendukung pembungkusan rapi anak-daun agar lebar pohon tidak melebihi kertas
  // -------------------------------------------------------------------------
  const runCompactTreeLayout = (opts: {
    wrapLeafSiblingsMaxCols: number;
    leftMargin: number;
    rightMargin: number;
    rowStepY: number;
    rootGapX: number;
  }) => {
    interface TreeBlock {
      member: FamilyMember;
      unitW: number;
      spouses: NonNullable<FamilyMember['spouses']>;
      depth: number;
      children: TreeBlock[];
      isLeafGrid: boolean;
      leafCols: number;
      leafRows: number;
      blockW: number;
      blockH: number;
    }

    const seen = new Set<string>();
    const measureBlock = (m: FamilyMember, depth: number): TreeBlock => {
      seen.add(m.id);
      const spouses = m.spouses || [];
      const unitW = cardW + spouses.length * (cardW + coupleGap);

      const rawKids = (childrenMap.get(m.id) || []).filter((k) => !seen.has(k.id));
      const measuredKids = rawKids.map((k) => measureBlock(k, depth + 1));

      // Lipat saudara daun (tanpa anak) secara cerdas!
      // 1) Jika semua anak adalah daun dan jumlah > maxCols -> susun grid rapi di bawah induk.
      // 2) Jika cabang campuran (sebagian G4 punya G5, sebagian G4 tidak punya anak) dan berjumlah banyak ->
      //    susun anak-daun dalam kelompok ringkas atau bagi 2 baris bertingkat (staggered) agar tidak meluber!
      const allKidsAreSingleLeaves =
        measuredKids.length > opts.wrapLeafSiblingsMaxCols &&
        measuredKids.every((k) => k.children.length === 0);
      const anyKidHasSpouse = measuredKids.some((k) => k.spouses.length > 0);
      const kidGapX = anyKidHasSpouse ? compactSiblingGap : unmarriedGapPx;

      if (allKidsAreSingleLeaves) {
        const leafCols = Math.max(2, Math.min(opts.wrapLeafSiblingsMaxCols, measuredKids.length));
        const leafRows = Math.ceil(measuredKids.length / leafCols);
        const maxChildUnitW = Math.max(...measuredKids.map((k) => k.unitW));
        const gridW = leafCols * maxChildUnitW + (leafCols - 1) * kidGapX;
        const gridH = leafRows * cardH + (leafRows - 1) * Math.max(12, unmarriedGapPx + 4);
        const blockW = Math.max(unitW, gridW);
        const blockH = cardH + opts.rowStepY + gridH;
        return {
          member: m,
          unitW,
          spouses,
          depth,
          children: measuredKids,
          isLeafGrid: true,
          leafCols,
          leafRows,
          blockW,
          blockH,
        };
      }

      // Cabang campuran (misal 1 G4 punya anak G5, 4 saudara G4 lainnya tidak): lipat anak-anak menjadi 2 baris bertingkat bila lebar berlebih
      const rawKidsTotalW =
        measuredKids.length > 0
          ? measuredKids.reduce((s, ch) => s + ch.blockW, 0) +
            (measuredKids.length - 1) * kidGapX
          : 0;
      const maxAllowBranchW = Math.max(
        cardW * 3,
        boardWidth - opts.leftMargin - opts.rightMargin - 20
      );
      const shouldStaggerMixedRow =
        measuredKids.length >= 4 && rawKidsTotalW > maxAllowBranchW * 0.92;

      if (shouldStaggerMixedRow) {
        const half = Math.ceil(measuredKids.length / 2);
        const topSlice = measuredKids.slice(0, half);
        const botSlice = measuredKids.slice(half);
        const topW =
          topSlice.reduce((s, ch) => s + ch.blockW, 0) +
          Math.max(0, topSlice.length - 1) * kidGapX;
        const botW =
          botSlice.reduce((s, ch) => s + ch.blockW, 0) +
          Math.max(0, botSlice.length - 1) * kidGapX;
        const topH = Math.max(...topSlice.map((ch) => ch.blockH));
        const botH = botSlice.length > 0 ? Math.max(...botSlice.map((ch) => ch.blockH)) : 0;
        const tierGap = Math.max(18, Math.round(cardH * 0.22));
        const blockW = Math.max(unitW, topW, botW);
        const blockH = cardH + opts.rowStepY + topH + (botH > 0 ? tierGap + botH : 0);
        return {
          member: m,
          unitW,
          spouses,
          depth,
          children: measuredKids,
          isLeafGrid: true,
          leafCols: -half, // penanda khusus: 2 baris cabang campuran bertingkat
          leafRows: 2,
          blockW,
          blockH,
        };
      }

      const kidsMaxH =
        measuredKids.length > 0 ? Math.max(...measuredKids.map((ch) => ch.blockH)) : 0;

      const blockW = Math.max(unitW, rawKidsTotalW);
      const blockH = measuredKids.length > 0 ? cardH + opts.rowStepY + kidsMaxH : cardH;

      return {
        member: m,
        unitW,
        spouses,
        depth,
        children: measuredKids,
        isLeafGrid: false,
        leafCols: 0,
        leafRows: 0,
        blockW,
        blockH,
      };
    };

    const rootBlocks = roots
      .filter((r) => !seen.has(r.id))
      .map((r) => measureBlock(r, r.generationLevel ?? 0));
    members.forEach((m) => {
      if (!seen.has(m.id)) {
        rootBlocks.push(measureBlock(m, m.generationLevel ?? 0));
      }
    });

    const usableW = Math.max(320, boardWidth - opts.leftMargin - opts.rightMargin);

    // Susun rootBlocks ke dalam baris-baris yang muat di lebar kertas (jika ada >1 trah/cabang akar)
    const rootRows: TreeBlock[][] = [];
    let curRow: TreeBlock[] = [];
    let curRowW = 0;
    rootBlocks.forEach((rb) => {
      const nextW = curRow.length === 0 ? rb.blockW : curRowW + opts.rootGapX + rb.blockW;
      if (curRow.length > 0 && nextW > usableW) {
        rootRows.push(curRow);
        curRow = [rb];
        curRowW = rb.blockW;
      } else {
        curRow.push(rb);
        curRowW = nextW;
      }
    });
    if (curRow.length > 0) rootRows.push(curRow);

    const placeBlock = (
      block: TreeBlock,
      leftX: number,
      topY: number,
      parentNodeId: string | null
    ) => {
      const m = block.member;
      const unitStartX = leftX + (block.blockW - block.unitW) / 2;
      const primaryId = `n_${m.id}`;

      nodes.push({
        id: primaryId,
        name: m.name,
        sub: formatMemberLifeSubtitle(m),
        x: Math.round(unitStartX),
        y: Math.round(topY),
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: m.generationLevel ?? block.depth,
      });

      if (parentNodeId) {
        edges.push({ from: parentNodeId, to: primaryId, type: 'child' });
      }

      block.spouses.forEach((sp, sIdx) => {
        const spId = `n_${m.id}_sp_${sIdx + 1}`;
        nodes.push({
          id: spId,
          name: sp.name,
          sub: `Pasangan (${
            sp.status === 'cerai_mati'
              ? 'Wafat'
              : sp.status === 'cerai_hidup'
              ? 'Cerai'
              : 'Menikah'
          })`,
          x: Math.round(unitStartX + (sIdx + 1) * (cardW + coupleGap)),
          y: Math.round(topY),
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? block.depth,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      if (block.children.length === 0) return;

      const childTopY = topY + cardH + opts.rowStepY;

      const anyKidHasSpouse = block.children.some((k) => k.spouses.length > 0);
      const kidGapX = anyKidHasSpouse ? compactSiblingGap : unmarriedGapPx;

      if (block.isLeafGrid && block.leafCols < 0) {
        // 2 baris bertingkat untuk cabang campuran (G4 punya G5 + saudara G4 lain)
        const half = Math.abs(block.leafCols);
        const topSlice = block.children.slice(0, half);
        const botSlice = block.children.slice(half);
        const topW =
          topSlice.reduce((s, ch) => s + ch.blockW, 0) +
          Math.max(0, topSlice.length - 1) * kidGapX;
        const botW =
          botSlice.reduce((s, ch) => s + ch.blockW, 0) +
          Math.max(0, botSlice.length - 1) * kidGapX;
        const topH = Math.max(...topSlice.map((ch) => ch.blockH));
        const tierGap = Math.max(18, Math.round(cardH * 0.22));

        let cx1 = leftX + (block.blockW - topW) / 2;
        topSlice.forEach((ch) => {
          placeBlock(ch, cx1, childTopY, primaryId);
          cx1 += ch.blockW + kidGapX;
        });

        let cx2 = leftX + (block.blockW - botW) / 2;
        const botY = childTopY + topH + tierGap;
        botSlice.forEach((ch) => {
          placeBlock(ch, cx2, botY, primaryId);
          cx2 += ch.blockW + kidGapX;
        });
      } else if (block.isLeafGrid) {
        const maxChildUnitW = Math.max(...block.children.map((k) => k.unitW));
        const gridTotalW =
          block.leafCols * maxChildUnitW + (block.leafCols - 1) * kidGapX;
        const gridStartX = leftX + (block.blockW - gridTotalW) / 2;
        const subRowStepY = cardH + Math.max(12, unmarriedGapPx + 4);

        block.children.forEach((ch, idx) => {
          const col = idx % block.leafCols;
          const r = Math.floor(idx / block.leafCols);
          const cellLeftX = gridStartX + col * (maxChildUnitW + kidGapX);
          const cellCenteredX = cellLeftX + (maxChildUnitW - ch.unitW) / 2;
          placeBlock(ch, cellCenteredX, childTopY + r * subRowStepY, primaryId);
        });
      } else {
        const kidsTotalW =
          block.children.reduce((s, ch) => s + ch.blockW, 0) +
          (block.children.length - 1) * kidGapX;
        let childX = leftX + (block.blockW - kidsTotalW) / 2;
        block.children.forEach((ch) => {
          placeBlock(ch, childX, childTopY, primaryId);
          childX += ch.blockW + kidGapX;
        });
      }
    };

    const rowHeights = rootRows.map((rr) => Math.max(...rr.map((rb) => rb.blockH)));
    const totalTreeH =
      rowHeights.reduce((s, h) => s + h, 0) + Math.max(0, rootRows.length - 1) * 44;

    let curY = topSafeY + Math.max(0, (usableH - totalTreeH) / 2);

    rootRows.forEach((rr, rIdx) => {
      const rowW =
        rr.reduce((s, rb) => s + rb.blockW, 0) +
        Math.max(0, rr.length - 1) * opts.rootGapX;
      let curX = opts.leftMargin + Math.max(0, (usableW - rowW) / 2);
      rr.forEach((rb) => {
        placeBlock(rb, curX, curY, null);
        curX += rb.blockW + opts.rootGapX;
      });
      curY += rowHeights[rIdx] + 44;
    });
  };

  const solverCommonOpts = {
    displayMode,
    photoSize,
    cardScale,
    padX: Math.max(6, Math.round(compactSiblingGap * 0.7)),
    padY: Math.max(8, Math.round(cardH * 0.14)),
  };

  // -------------------------------------------------------------------------
  // MODE 0: ISI PENUH KERTAS (RAPAT, DEKAT INDUK & PITA GENERASI)
  // -------------------------------------------------------------------------
  if (presetId === 'hierarchy_grid_fill') {
    const leftLabelMargin = 78;
    const rightMargin = 28;
    const usableW = Math.max(320, boardWidth - leftLabelMargin - rightMargin);
    const maxLeafCols = Math.max(2, Math.min(4, Math.floor((usableW + compactSiblingGap) / (cardW + compactSiblingGap))));

    runCompactTreeLayout({
      wrapLeafSiblingsMaxCols: maxLeafCols,
      leftMargin: leftLabelMargin,
      rightMargin,
      rowStepY: compactRowGap,
      rootGapX: Math.max(24, Math.round(cardW * 0.25)),
    });

    return fitNodesInsideBoard(
      nodes,
      edges,
      boardWidth,
      boardHeight,
      cardW,
      cardH,
      leftLabelMargin,
      solverCommonOpts
    );
  }

  // -------------------------------------------------------------------------
  // MODE POHON BESAR DIPISAH TEGAS:
  // Batang 75% tinggi (100->50px) + Dahan Zigzag Naik 3-4 lapis (70->40px)
  // + Ranting (45->20px) + G3-G5 Daun Mirror (G3 tua -> G4 sedang -> G5 muda)
  // -------------------------------------------------------------------------
  if (presetId === 'pohon_hayat_besar') {
    const trunkX = Math.round(boardWidth / 2);
    const minLeftBound = 24;
    const maxRightBound = Math.max(minLeftBound + 40, boardWidth - 24 - cardW);
    const minTopBound = 66;
    const rootFootMargin = Math.max(46, Math.min(72, Math.round(boardHeight * 0.062)));
    const trunkBaseY = boardHeight - rootFootMargin;
    const trunkHeight = Math.max(240, Math.round(boardHeight * 0.75));
    const trunkTopY = Math.max(minTopBound + 18, trunkBaseY - trunkHeight);

    const placedMemberIds = new Set<string>();
    const lockedTreeIds = new Set<string>();
    const nodePosByMember = new Map<
      string,
      { id: string; x: number; y: number; gen: number }
    >();

    const countSubtreeSize = (
      m: FamilyMember,
      guard = new Set<string>()
    ): number => {
      if (guard.has(m.id)) return 0;
      guard.add(m.id);
      const kids = childrenMap.get(m.id) || [];
      return 1 + kids.reduce((s, k) => s + countSubtreeSize(k, guard), 0);
    };

    const addMemberUnit = (
      m: FamilyMember,
      x: number,
      y: number,
      gen: number,
      parentNodeId: string | null,
      optsNode?: {
        spouseDir?: 1 | -1;
        cardShape?: 'rect' | 'leaf' | 'petal';
        leafAngleDeg?: number;
        leafTone?: 'dark' | 'medium' | 'light';
        lockUnit?: boolean;
        treeOriginX?: number;
        treeOriginY?: number;
        treeTipX?: number;
        treeTipY?: number;
        treeWing?: -1 | 1;
      }
    ): string => {
      if (placedMemberIds.has(m.id)) {
        return nodePosByMember.get(m.id)?.id || `n_${m.id}`;
      }
      placedMemberIds.add(m.id);

      const clampedX = Math.max(
        minLeftBound,
        Math.min(maxRightBound, Math.round(x))
      );
      const clampedY = Math.max(
        minTopBound,
        Math.min(boardHeight - 24 - cardH, Math.round(y))
      );
      const primaryId = `n_${m.id}`;

    const bpStop0 = getBpStop(gen);
      nodes.push({
        id: primaryId,
        name: m.name,
        sub: formatMemberLifeSubtitle(m),
        x: clampedX,
        y: clampedY,
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: m.generationLevel ?? gen,
        cardShape: optsNode?.cardShape ?? (gen >= 2 ? (aiBlueprint?.cardShape && aiBlueprint.cardShape !== 'hex' ? aiBlueprint.cardShape : 'leaf') : 'rect'),
        leafAngleDeg: optsNode?.leafAngleDeg,
        leafTone: optsNode?.leafTone,
        customBgColor: bpStop0?.bg,
        customBorderColor: bpStop0?.border,
        treeOriginX: optsNode?.treeOriginX,
        treeOriginY: optsNode?.treeOriginY,
        treeTipX: optsNode?.treeTipX,
        treeTipY: optsNode?.treeTipY,
        treeWing: optsNode?.treeWing,
      });

      if (optsNode?.lockUnit) {
        lockedTreeIds.add(primaryId);
      }
      nodePosByMember.set(m.id, {
        id: primaryId,
        x: clampedX,
        y: clampedY,
        gen,
      });

      if (parentNodeId) {
        edges.push({ from: parentNodeId, to: primaryId, type: 'child' });
      }

      const spDir = optsNode?.spouseDir ?? 1;
      (m.spouses || []).forEach((sp, sIdx) => {
        const spId = `n_${m.id}_sp_${sIdx + 1}`;
        const spX = Math.max(
          minLeftBound,
          Math.min(
            maxRightBound,
            clampedX + spDir * (sIdx + 1) * (cardW + coupleGap)
          )
        );
        nodes.push({
          id: spId,
          name: sp.name,
          sub: `Pasangan (${
            sp.status === 'cerai_mati'
              ? 'Wafat'
              : sp.status === 'cerai_hidup'
              ? 'Cerai'
              : 'Menikah'
          })`,
          x: spX,
          y: clampedY,
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? gen,
          cardShape: optsNode?.cardShape ?? (gen >= 2 ? (aiBlueprint?.cardShape && aiBlueprint.cardShape !== 'hex' ? aiBlueprint.cardShape : 'leaf') : 'rect'),
          leafAngleDeg:
            optsNode?.leafAngleDeg !== undefined
              ? optsNode.leafAngleDeg + (spDir > 0 ? 12 : -12)
              : undefined,
          leafTone: optsNode?.leafTone,
          customBgColor: bpStop0?.bg,
          customBorderColor: bpStop0?.border,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      return primaryId;
    };

    // 1. G1 di pangkal bawah Batang (dengan sedikit offset S-curve alami bila di-blueprint)
    const primaryRoots = roots.length > 0 ? roots : members.slice(0, 1);
    const g1Y = Math.max(minTopBound + 140, trunkBaseY - cardH - 12);
    const rootSpreadStep = Math.max(cardW * 2.2, Math.round(boardWidth * 0.24));
    const trunkSwayFactor = aiBlueprint?.trunkCurve ?? 0.08;
    const trunkTopOffsetX = Math.round(boardWidth * 0.055 * trunkSwayFactor);
    const trunkTopX = Math.max(minLeftBound + cardW, Math.min(maxRightBound, trunkX + trunkTopOffsetX));

    primaryRoots.forEach((rootM, rIdx) => {
      const offsetMul =
        rIdx === 0
          ? 0
          : (rIdx % 2 === 1 ? -1 : 1) * Math.ceil(rIdx / 2);
      const rx = trunkX - cardW / 2 + offsetMul * rootSpreadStep;
      addMemberUnit(rootM, rx, g1Y, rootM.generationLevel ?? 0, null, {
        spouseDir: offsetMul < 0 ? -1 : 1,
        cardShape: 'rect',
        lockUnit: true,
        treeOriginX: trunkX,
        treeOriginY: trunkBaseY,
        treeTipX: trunkTopX,
        treeTipY: trunkTopY,
      });
    });

    // 2. G2 menempel sepanjang Batang Utama yang melengkung lembut
    interface TrunkEntry {
      member: FamilyMember;
      nodeId: string;
      x: number;
      y: number;
    }
    const g2Entries: TrunkEntry[] = [];
    const g2All: Array<{ member: FamilyMember; parentNodeId: string }> = [];
    primaryRoots.forEach((rootM) => {
      const pNodeId = nodePosByMember.get(rootM.id)?.id || `n_${rootM.id}`;
      (childrenMap.get(rootM.id) || []).forEach((k) => {
        if (!placedMemberIds.has(k.id)) {
          g2All.push({ member: k, parentNodeId: pNodeId });
        }
      });
    });

    const g2BottomY = g1Y - cardH - Math.max(14, Math.round(cardH * 0.22));
    const g2TopLimitY = Math.max(
      minTopBound + 34,
      trunkTopY + Math.round(trunkHeight * 0.14)
    );
    const g2SpanH = Math.max(cardH + 10, g2BottomY - g2TopLimitY);
    const g2Count = g2All.length;
    const g2StepY =
      g2Count <= 1
        ? 0
        : Math.max(
            cardH + 10,
            Math.min(g2SpanH / Math.max(1, g2Count - 1), cardH + 38)
          );

    g2All.forEach(({ member: g2M, parentNodeId }, idx) => {
      const revIdx = g2Count - 1 - idx;
      const yPos =
        g2Count <= 1
          ? Math.round((g2BottomY + g2TopLimitY) / 2)
          : Math.round(g2BottomY - revIdx * g2StepY);
      const safeY = Math.max(minTopBound + 24, Math.min(g2BottomY, yPos));
      const spineFrac = Math.max(0, Math.min(1, (trunkBaseY - safeY) / Math.max(1, trunkHeight)));
      const swayX = Math.round(
        trunkX + Math.sin(spineFrac * Math.PI) * (-trunkTopOffsetX * 0.7) + spineFrac * trunkTopOffsetX
      );
      const spDir: 1 | -1 = idx % 2 === 0 ? 1 : -1;
      const g2Id = addMemberUnit(
        g2M,
        swayX - cardW / 2,
        safeY,
        g2M.generationLevel ?? 1,
        parentNodeId,
        {
          spouseDir: spDir,
          cardShape: 'rect',
          lockUnit: true,
        }
      );
      const pos = nodePosByMember.get(g2M.id);
      if (pos) {
        g2Entries.push({
          member: g2M,
          nodeId: g2Id,
          x: pos.x,
          y: pos.y,
        });
      }
    });

    // 3. Dahan Organik Melengkung (mendukung preferensi keseimbangan AI & bentuk siluet banyan/cemara/kanopi)
    interface PlacedBough {
      member: FamilyMember;
      nodeId: string;
      wing: -1 | 1;
      originX: number;
      originY: number;
      tipX: number;
      tipY: number;
      tierFrac: number;
    }
    const leftG3Queue: Array<{ child: FamilyMember; parent: TrunkEntry }> = [];
    const rightG3Queue: Array<{ child: FamilyMember; parent: TrunkEntry }> = [];
    let leftWt = 0;
    let rightWt = 0;
    const aiLeftSet = new Set(aiBlueprint?.balanceLeftIds || []);
    const aiRightSet = new Set(aiBlueprint?.balanceRightIds || []);

    g2Entries.forEach((g2e) => {
      const g3Kids = (childrenMap.get(g2e.member.id) || []).filter(
        (k) => !placedMemberIds.has(k.id)
      );
      g3Kids.forEach((g3k) => {
        const w = countSubtreeSize(g3k);
        const forceLeft = aiLeftSet.has(g3k.id);
        const forceRight = aiRightSet.has(g3k.id);
        if (forceLeft || (!forceRight && leftWt <= rightWt)) {
          leftG3Queue.push({ child: g3k, parent: g2e });
          leftWt += w;
        } else {
          rightG3Queue.push({ child: g3k, parent: g2e });
          rightWt += w;
        }
      });
    });

    const treeShape = aiBlueprint?.treeShape ?? 'banyan_arch';
    const maxSideReach = Math.max(150, boardWidth * 0.5 - Math.max(cardW * 1.15, 92));
    const boughMaxLen =
      treeShape === 'pine_tiered'
        ? Math.min(boardWidth * 0.38, maxSideReach)
        : Math.min(boardWidth * 0.43, maxSideReach * 1.04);
    const boughMinLen =
      treeShape === 'banyan_arch'
        ? Math.min(boardWidth * 0.27, boughMaxLen * 0.68)
        : Math.min(boardWidth * 0.21, boughMaxLen * 0.52);

    const boughBandBottomY = Math.min(
      g1Y - cardH * 0.55,
      trunkTopY + Math.round(trunkHeight * 0.84)
    );
    const boughBandTopY = Math.max(
      minTopBound + Math.round(cardH * 1.05),
      trunkTopY + Math.round(trunkHeight * 0.08)
    );
    const boughBandSpan = Math.max(80, boughBandBottomY - boughBandTopY);

    const placedBoughs: PlacedBough[] = [];

    const buildWingBoughs = (
      queue: Array<{ child: FamilyMember; parent: TrunkEntry }>,
      wing: -1 | 1
    ) => {
      const n = queue.length;
      if (n === 0) return;
      queue.forEach((item, idx) => {
        const tierFrac = n === 1 ? 0.38 : idx / (n - 1);
        const zigzagShift =
          (wing === 1 ? -1 : 1) *
          Math.round(boughBandSpan / Math.max(6, n * 3.0));
        const originY = Math.max(
          boughBandTopY,
          Math.min(
            boughBandBottomY,
            Math.round(
              boughBandBottomY - tierFrac * boughBandSpan + zigzagShift
            )
          )
        );
        const spineFrac = Math.max(0, Math.min(1, (trunkBaseY - originY) / Math.max(1, trunkHeight)));
        const originX = Math.round(
          trunkX + Math.sin(spineFrac * Math.PI) * (-trunkTopOffsetX * 0.7) + spineFrac * trunkTopOffsetX
        );

        const boughLen = Math.round(
          boughMaxLen - tierFrac * (boughMaxLen - boughMinLen)
        );
        // Banyan arch lifts gracefully upward toward upper canopy; pine rises cleanly
        const riseDeg =
          treeShape === 'banyan_arch'
            ? 16 + tierFrac * 20
            : treeShape === 'royal_canopy'
            ? 14 + tierFrac * 16
            : 12 + tierFrac * 11;
        const riseAngleRad = (riseDeg * Math.PI) / 180;
        const tipX = Math.max(
          minLeftBound + cardW * 0.48,
          Math.min(
            boardWidth - 24 - cardW * 0.48,
            Math.round(originX + wing * Math.cos(riseAngleRad) * boughLen)
          )
        );
        const tipY = Math.max(
          minTopBound + 18,
          Math.round(originY - Math.sin(riseAngleRad) * boughLen)
        );

        const midX = originX + (tipX - originX) * 0.56;
        const midY = originY + (tipY - originY) * 0.52 - Math.round(12 * (1 - tierFrac * 0.4));

        const g3LeafAngle = wing * (46 + Math.round(tierFrac * 14));

        const g3Id = addMemberUnit(
          item.child,
          midX - cardW / 2,
          midY - cardH / 2,
          item.child.generationLevel ?? 2,
          item.parent.nodeId,
          {
            spouseDir: wing,
            cardShape: aiBlueprint?.cardShape && aiBlueprint.cardShape !== 'hex' ? aiBlueprint.cardShape : 'leaf',
            leafAngleDeg: g3LeafAngle,
            leafTone: 'dark',
            lockUnit: true,
            treeOriginX: originX,
            treeOriginY: originY,
            treeTipX: tipX,
            treeTipY: tipY,
            treeWing: wing,
          }
        );

        placedBoughs.push({
          member: item.child,
          nodeId: g3Id,
          wing,
          originX,
          originY,
          tipX,
          tipY,
          tierFrac,
        });
      });
    };

    buildWingBoughs(leftG3Queue, -1);
    buildWingBoughs(rightG3Queue, 1);

    // 4. Ranting Lurus/Tajam (45px->20px, panjang ~10cm->5cm disesuaikan kertas) sesuai jumlah G4
    // Kartu G4 menempel di TENGAH Ranting (Hijau Sedang) + G5 daun acak mendekati G4 (Hijau Paling Muda)
    const placedG4List: Array<{
      member: FamilyMember;
      nodeId: string;
      cx: number;
      cy: number;
      wing: -1 | 1;
      mirrorSide: -1 | 1;
      twigAngleRad: number;
    }> = [];

    const maxTwigPx = Math.min(
      Math.round(10 * MM_TO_PX * 10 * 0.48), // proporsional ~180px max di A3
      Math.round(boardWidth * 0.145)
    );
    const minTwigPx = Math.min(
      Math.round(5 * MM_TO_PX * 10 * 0.45),
      Math.round(maxTwigPx * 0.58)
    );

    placedBoughs.forEach((bough) => {
      const g4Kids = (childrenMap.get(bough.member.id) || []).filter(
        (k) => !placedMemberIds.has(k.id)
      );
      if (g4Kids.length === 0) return;

      const bdx = bough.tipX - bough.originX;
      const bdy = bough.tipY - bough.originY;
      const boughBaseAngle = Math.atan2(bdy, bdx);

      const baseTwigLen = Math.round(
        maxTwigPx - bough.tierFrac * (maxTwigPx - minTwigPx)
      );

      g4Kids.forEach((g4k, g4Idx) => {
        // Bercabang sepanjang dahan dari pangkal-luar ke ujung dahan (0.58 .. 0.94),
        // berselang-seling mirror sisi ATAS (-1) dan sisi BAWAH (+1) dahan!
        const fracAlongBough =
          g4Kids.length === 1
            ? 0.8
            : 0.58 + (g4Idx / Math.max(1, g4Kids.length - 1)) * 0.36;
        const twOriginX = Math.round(bough.originX + bdx * fracAlongBough);
        const twOriginY = Math.round(bough.originY + bdy * fracAlongBough);

        // Mirror sisi atas vs sisi bawah dahan (simetris antara sayap kiri & kanan!)
        const mirrorSide: -1 | 1 = g4Idx % 2 === 0 ? -1 : 1; // -1 = atas dahan, +1 = bawah/samping dahan
        const branchOffsetAngle =
          bough.wing === 1
            ? mirrorSide * (0.72 + (g4Idx % 3) * 0.12)
            : -mirrorSide * (0.72 + (g4Idx % 3) * 0.12);
        const twigAngleRad = boughBaseAngle + branchOffsetAngle;
        const twigLen = Math.round(
          baseTwigLen * (g4Idx % 2 === 0 ? 1.0 : 0.86)
        );

        const twTipX = Math.max(
          minLeftBound + cardW * 0.35,
          Math.min(
            boardWidth - 24 - cardW * 0.35,
            Math.round(twOriginX + Math.cos(twigAngleRad) * twigLen)
          )
        );
        const twTipY = Math.max(
          minTopBound + 16,
          Math.min(
            boardHeight - 30 - cardH * 0.35,
            Math.round(twOriginY + Math.sin(twigAngleRad) * twigLen)
          )
        );

        // Kartu G4 menempel di TENGAH Ranting
        const twMidX = (twOriginX + twTipX) / 2;
        const twMidY = (twOriginY + twTipY) / 2;

        // Daun G4 MIRROR: sisi atas ranting condong naik-keluar (±38°), sisi bawah ranting condong miring-keluar (±116°)
        const g4LeafAngle =
          bough.wing * (mirrorSide === -1 ? 38 : 116);

        const g4Id = addMemberUnit(
          g4k,
          twMidX - cardW / 2,
          twMidY - cardH / 2,
          g4k.generationLevel ?? 3,
          bough.nodeId,
          {
            spouseDir: bough.wing,
            cardShape: 'leaf',
            leafAngleDeg: g4LeafAngle,
            leafTone: 'medium', // G4: Hijau sedang
            treeOriginX: twOriginX,
            treeOriginY: twOriginY,
            treeTipX: twTipX,
            treeTipY: twTipY,
            treeWing: bough.wing,
          }
        );

        const g4Pos = nodePosByMember.get(g4k.id);
        placedG4List.push({
          member: g4k,
          nodeId: g4Id,
          cx: (g4Pos?.x ?? twMidX - cardW / 2) + cardW / 2,
          cy: (g4Pos?.y ?? twMidY - cardH / 2) + cardH / 2,
          wing: bough.wing,
          mirrorSide,
          twigAngleRad,
        });
      });
    });

    // 5. Daun G5+ acak organik mendekati G4 (posisi mirror kiri/kanan + Hijau paling muda)
    const placeG5Cluster = (
      parentM: FamilyMember,
      parentNodeId: string,
      parentCx: number,
      parentCy: number,
      wing: -1 | 1,
      baseAngleRad: number,
      depth: number
    ) => {
      const kids = (childrenMap.get(parentM.id) || []).filter(
        (k) => !placedMemberIds.has(k.id)
      );
      if (kids.length === 0) return;

      const clusterDist = Math.max(
        cardW * 0.92,
        Math.min(cardH * 1.12, Math.round(boardWidth * 0.085))
      );

      kids.forEach((kid, idx) => {
        // Sudut acak deterministik tapi tetap MIRROR antara kiri vs kanan
        const fanOffsets = [0, -0.78, 0.78, -1.45, 1.45, 2.15, -2.15];
        const mirroredOffset =
          wing * fanOffsets[idx % fanOffsets.length];
        const a = baseAngleRad + mirroredOffset;
        const r = clusterDist * (0.88 + (idx % 3) * 0.22);

        const kx = parentCx + Math.cos(a) * r;
        const ky = parentCy + Math.sin(a) * r;

        // Arah daun G5 segala arah (kanan, kiri, atas, bawah) tetap mirror kiri vs kanan
        const mirrorLeafAngles = [24, 72, -32, 128, 160, -82, 48];
        const leafDeg =
          wing * mirrorLeafAngles[idx % mirrorLeafAngles.length];

        const kidId = addMemberUnit(
          kid,
          kx - cardW / 2,
          ky - cardH / 2,
          kid.generationLevel ?? depth,
          parentNodeId,
          {
            spouseDir: wing,
            cardShape: 'leaf',
            leafAngleDeg: leafDeg,
            leafTone: 'light', // G5: Hijau paling muda
            treeWing: wing,
          }
        );

        const kPos = nodePosByMember.get(kid.id);
        placeG5Cluster(
          kid,
          kidId,
          (kPos?.x ?? kx - cardW / 2) + cardW / 2,
          (kPos?.y ?? ky - cardH / 2) + cardH / 2,
          wing,
          a,
          depth + 1
        );
      });
    };

    placedG4List.forEach((g4) => {
      placeG5Cluster(
        g4.member,
        g4.nodeId,
        g4.cx,
        g4.cy,
        g4.wing,
        g4.twigAngleRad,
        4
      );
    });

    // Tangkap anggota tersisa jika ada struktur lompat generasi
    members.forEach((m, idx) => {
      if (placedMemberIds.has(m.id)) return;
      const pPos = m.parentId ? nodePosByMember.get(m.parentId) : undefined;
      const wing: -1 | 1 = idx % 2 === 0 ? -1 : 1;
      const fx = pPos
        ? pPos.x + wing * (cardW + 18)
        : trunkX + wing * (cardW * 1.4);
      const fy = pPos
        ? pPos.y - cardH - 12
        : minTopBound + 80 + (idx % 4) * (cardH + 14);
      const gen = m.generationLevel ?? (pPos ? pPos.gen + 1 : 3);
      addMemberUnit(m, fx, fy, gen, pPos?.id || null, {
        spouseDir: wing,
        cardShape: gen >= 2 ? 'leaf' : 'rect',
        leafAngleDeg: gen >= 2 ? wing * (35 + (idx % 4) * 28) : undefined,
        leafTone: gen <= 2 ? 'dark' : gen === 3 ? 'medium' : 'light',
        treeWing: wing,
      });
    });

    // Solver anti-tumpuk ringan: kunci G1, G2, & G3 agar batang & dahan tetap kaku,
    // hanya geser G4/G5 seperlunya supaya foto & badge tidak pernah bertabrakan!
    const treePadX = Math.max(10, Math.round(cardW * 0.12));
    const treePadY = Math.max(10, Math.round(cardH * 0.12));
    const cleanTreeNodes = resolveCollisionsNearParents4Dir(
      nodes,
      edges,
      boardWidth,
      boardHeight,
      displayMode,
      photoSize,
      cardScale,
      {
        minLeftX: 20,
        rightMargin: 20,
        minTopY: 64,
        bottomMargin: 22,
        padX: treePadX,
        padY: treePadY,
        anchorMaxGen: 3,
        lockedNodeIds: lockedTreeIds,
        radialCenter: { x: trunkX, y: Math.round((trunkTopY + trunkBaseY) / 2) },
      }
    );
    return { nodes: cleanTreeNodes, edges };
  }

  // -------------------------------------------------------------------------
  // MODE 1 & 4: POHON RANTING VERTIKAL ANTI-SILANG (KOMPAK & LURUS)
  // -------------------------------------------------------------------------
  if (presetId === 'subtree_vertical' || presetId === 'heritage_showcase') {
    const maxLeafCols = Math.max(3, Math.min(5, Math.floor((boardWidth - 80) / (cardW + compactSiblingGap))));
    runCompactTreeLayout({
      wrapLeafSiblingsMaxCols: maxLeafCols,
      leftMargin: 32,
      rightMargin: 32,
      rowStepY: compactRowGap,
      rootGapX: Math.max(26, Math.round(cardW * 0.28)),
    });

    return fitNodesInsideBoard(
      nodes,
      edges,
      boardWidth,
      boardHeight,
      cardW,
      cardH,
      24,
      solverCommonOpts
    );
  }

  // -------------------------------------------------------------------------
  // MODE 2: ALUR CABANG KIRI -> KANAN (KOMPAK & DEKAT INDUK)
  // -------------------------------------------------------------------------
  if (presetId === 'subtree_horizontal') {
    const spouseGapY = Math.max(6, Math.round(cardH * 0.08));
    const siblingGapY = Math.max(12, Math.round(cardH * 0.14));

    interface HBranch {
      member: FamilyMember;
      unitH: number;
      childrenTotalH: number;
      subtreeH: number;
      children: HBranch[];
    }

    let maxTreeDepth = 0;
    const seen = new Set<string>();
    const measureH = (m: FamilyMember, depth: number): HBranch => {
      seen.add(m.id);
      maxTreeDepth = Math.max(maxTreeDepth, depth);
      const spCount = m.spouses ? m.spouses.length : 0;
      const unitH = cardH + spCount * (cardH + spouseGapY);

      const rawChildren = (childrenMap.get(m.id) || []).filter(
        (c) => !seen.has(c.id)
      );
      const measuredChildren = rawChildren.map((c) => measureH(c, depth + 1));

      const childrenTotalH =
        measuredChildren.length > 0
          ? measuredChildren.reduce((s, ch) => s + ch.subtreeH, 0) +
            (measuredChildren.length - 1) * siblingGapY
          : 0;

      const subtreeH = Math.max(unitH, childrenTotalH);
      return {
        member: m,
        unitH,
        childrenTotalH,
        subtreeH,
        children: measuredChildren,
      };
    };

    const measuredRoots = roots
      .filter((r) => !seen.has(r.id))
      .map((r) => measureH(r, 0));
    members.forEach((m) => {
      if (!seen.has(m.id)) measuredRoots.push(measureH(m, 0));
    });

    const numLevels = maxTreeDepth + 1;
    const usableW = Math.max(320, boardWidth - 80);
    // Jarak kolom dibuat rapat agar garis horizontal pendek & mudah dibaca
    const colGap =
      numLevels > 1
        ? Math.min(
            cardW + 68,
            Math.max(cardW + 38, Math.floor((usableW - cardW) / (numLevels - 1)))
          )
        : cardW + 60;

    const totalH =
      measuredRoots.reduce((s, r) => s + r.subtreeH, 0) +
      Math.max(0, measuredRoots.length - 1) * 24;

    const placeH = (
      branch: HBranch,
      leftX: number,
      topY: number,
      parentPrimaryNodeId: string | null,
      depth: number
    ) => {
      const m = branch.member;
      const unitStartY = topY + (branch.subtreeH - branch.unitH) / 2;

      const primaryId = `n_${m.id}`;
      nodes.push({
        id: primaryId,
        name: m.name,
        sub:
          m.callName ||
          (depth === 0 ? 'Leluhur Utama' : `Generasi ${depth + 1}`),
        x: Math.round(leftX),
        y: Math.round(unitStartY),
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: m.generationLevel ?? depth,
      });

      if (parentPrimaryNodeId) {
        edges.push({ from: parentPrimaryNodeId, to: primaryId, type: 'child' });
      }

      (m.spouses || []).forEach((sp, sIdx) => {
        const spId = `n_${m.id}_sp_${sIdx + 1}`;
        nodes.push({
          id: spId,
          name: sp.name,
          sub: `Pasangan (${
            sp.status === 'cerai_mati'
              ? 'Wafat'
              : sp.status === 'cerai_hidup'
              ? 'Cerai'
              : 'Menikah'
          })`,
          x: Math.round(leftX),
          y: Math.round(unitStartY + (sIdx + 1) * (cardH + spouseGapY)),
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? depth,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      if (branch.children.length > 0) {
        let childY = topY + Math.max(0, (branch.subtreeH - branch.childrenTotalH) / 2);
        const childX = leftX + colGap;
        branch.children.forEach((ch) => {
          placeH(ch, childX, childY, primaryId, depth + 1);
          childY += ch.subtreeH + siblingGapY;
        });
      }
    };

    const totalTreeW = numLevels > 1 ? (numLevels - 1) * colGap + cardW : cardW;
    const startX = Math.max(36, (boardWidth - totalTreeW) / 2);
    let curY = topSafeY + Math.max(0, (usableH - totalH) / 2);

    measuredRoots.forEach((rb) => {
      placeH(rb, startX, curY, null, 0);
      curY += rb.subtreeH + 24;
    });

    return fitNodesInsideBoard(
      nodes,
      edges,
      boardWidth,
      boardHeight,
      cardW,
      cardH,
      24,
      solverCommonOpts
    );
  }

  // -------------------------------------------------------------------------
  // MODE MODULAR G3 POLA I / L (POROS TENGAH G1–G2 + PACKING A3 100+ ANTI DEAD-SPACE)
  // -------------------------------------------------------------------------
  if (presetId === 'modular_g3_I' || presetId === 'modular_g3_L') {
    const modularLayout: 'I' | 'L' = presetId === 'modular_g3_L' ? 'L' : 'I';
    const subUnit = getUniformSubCardSize(displayMode, photoSize, cardScale);

    // Kartu utama G1 dan G2 dibuat lebih besar sebagai pusat gravitasi
    const totalPeopleCount = members.reduce(
      (s, m) => s + 1 + (m.spouses?.length || 0),
      0
    );
    const g1ScaleMult = totalPeopleCount >= 90 ? 1.45 : 1.55;
    const g2ScaleMult = totalPeopleCount >= 90 ? 1.25 : 1.32;
    const g1Dim = getUniformSubCardSize(displayMode, photoSize, cardScale * g1ScaleMult);
    const g2Dim = getUniformSubCardSize(displayMode, photoSize, cardScale * g2ScaleMult);

    const outerMarginX = 20;
    const topMarginY = 42;
    const bottomMarginY = 54;
    const usableW = Math.max(320, boardWidth - outerMarginX * 2);
    const usableH = Math.max(260, boardHeight - topMarginY - bottomMarginY);

    interface ModNode {
      member: FamilyMember;
      depth: number;
      children: ModNode[];
    }
    const seen = new Set<string>();
    const buildMod = (m: FamilyMember, depth: number): ModNode => {
      seen.add(m.id);
      const kids = (childrenMap.get(m.id) || [])
        .filter((k) => !seen.has(k.id))
        .map((k) => buildMod(k, depth + 1));
      return { member: m, depth, children: kids };
    };

    const modRoots: ModNode[] = [];
    roots.forEach((r) => {
      if (!seen.has(r.id)) modRoots.push(buildMod(r, r.generationLevel ?? 0));
    });
    members.forEach((m) => {
      if (!seen.has(m.id)) modRoots.push(buildMod(m, m.generationLevel ?? 0));
    });

    const g1List: ModNode[] = [];
    const g2List: { node: ModNode; parentId: string | null }[] = [];
    const g3Heads: { node: ModNode; parentId: string | null; g2Index: number }[] = [];

    const walkTop = (mn: ModNode, parentId: string | null, activeG2Idx: number) => {
      if (mn.depth === 0) {
        g1List.push(mn);
        mn.children.forEach((c) => walkTop(c, mn.member.id, activeG2Idx));
      } else if (mn.depth === 1) {
        const myG2Idx = g2List.length;
        g2List.push({ node: mn, parentId });
        mn.children.forEach((c) => walkTop(c, mn.member.id, myG2Idx));
      } else {
        g3Heads.push({ node: mn, parentId, g2Index: activeG2Idx });
      }
    };
    modRoots.forEach((r) => walkTop(r, null, 0));

    const collectModularSubtree = (head: ModNode): {
      members: MergedCardMember[];
      snapshotEdges: InteractiveEdge[];
    } => {
      const list: MergedCardMember[] = [];
      const snapEdges: InteractiveEdge[] = [];
      const walkSub = (cur: ModNode, subDepth: number, parentRef: string | null) => {
        const cm = cur.member;
        const cid = `n_${cm.id}`;
        list.push({
          originalNodeId: cid,
          memberId: cm.id,
          name: cm.name,
          sub: formatMemberLifeSubtitle(cm),
          photo: cm.photoUrl || '',
          wafat: cm.isDeceased,
          gender: cm.gender,
          genLevel: cur.depth,
          parentMemberId: parentRef || undefined,
          depthInModule: subDepth,
          relX: 0,
          relY: 0,
        });
        if (parentRef) {
          snapEdges.push({ from: `n_${parentRef}`, to: cid, type: 'child' });
        }
        (cm.spouses || []).forEach((sp, sIdx) => {
          const spId = `n_${cm.id}_sp_${sIdx + 1}`;
          list.push({
            originalNodeId: spId,
            name: sp.name,
            sub: sp.status === 'cerai_mati' ? 'Pasangan (Wafat)' : 'Pasangan',
            photo: '',
            wafat: sp.status === 'cerai_mati',
            gender: cm.gender === 'L' ? 'P' : cm.gender === 'P' ? 'L' : undefined,
            genLevel: cur.depth,
            isSpouseOf: cm.id,
            depthInModule: subDepth,
            relX: 0,
            relY: 0,
          });
          snapEdges.push({ from: cid, to: spId, type: 'couple' });
        });
        cur.children.forEach((ch) => walkSub(ch, subDepth + 1, cm.id));
      };
      walkSub(head, 0, null);
      return { members: list, snapshotEdges: snapEdges };
    };

    // Jarak antar modul G3 / kelompok luar 3–5mm (diperkecil proporsional bila skala padat)
    const moduleGapPx = Math.max(
      10,
      Math.round(Math.max(3, Math.min(5, cardGapMm)) * MM_TO_PX * Math.max(0.65, Math.min(1.1, cardScale)))
    );
    const internalTightPx = Math.max(4, Math.round(1.5 * MM_TO_PX * Math.max(0.65, cardScale)));

    interface G3Box {
      isMerged: boolean;
      head: ModNode;
      parentId: string | null;
      g2Index: number;
      orderPos: number;
      members: MergedCardMember[];
      snapshotEdges: InteractiveEdge[];
      customCols?: number;
      w: number;
      h: number;
      x: number;
      y: number;
    }

    const g3Boxes: G3Box[] = g3Heads.map(({ node: head, parentId, g2Index }, idx) => {
      const sub = collectModularSubtree(head);
      if (sub.members.length >= 2) {
        // Pilih jumlah kolom internal paling efisien agar modul tidak terlalu tinggi/kurus di A3
        const candCols = sub.members.length >= 18 ? 4 : sub.members.length >= 9 ? 3 : 2;
        const plan = computeModularContainerPlan(
          sub.members.length,
          displayMode,
          photoSize,
          cardScale,
          candCols,
          modularLayout,
          sub.members
        );
        return {
          isMerged: true,
          head,
          parentId,
          g2Index,
          orderPos: idx,
          members: sub.members,
          snapshotEdges: sub.snapshotEdges,
          customCols: candCols,
          w: plan.w,
          h: plan.h,
          x: 0,
          y: 0,
        };
      }
      return {
        isMerged: false,
        head,
        parentId,
        g2Index,
        orderPos: idx,
        members: sub.members,
        snapshotEdges: sub.snapshotEdges,
        w: subUnit.w,
        h: subUnit.h,
        x: 0,
        y: 0,
      };
    });

    // Helper susun Central Hub (G1 + G2) di poros tengah atau atas
    const g1UnitGap = Math.max(8, Math.round(2.5 * MM_TO_PX * cardScale));
    const g2UnitGap = Math.max(6, Math.round(2 * MM_TO_PX * cardScale));

    const buildG1RowW = () =>
      g1List.reduce((s, r) => s + (1 + (r.member.spouses?.length || 0)) * g1Dim.w, 0) +
      Math.max(0, g1List.length - 1) * g1UnitGap;

    const g2UnitWidths = g2List.map(
      ({ node }) => (1 + (node.member.spouses?.length || 0)) * g2Dim.w
    );
    const maxHubAllowedW = Math.min(usableW, Math.round(usableW * 0.72));
    const g2Rows: Array<typeof g2List> = [];
    {
      let curRow: typeof g2List = [];
      let curW = 0;
      g2List.forEach((item, idx) => {
        const uw = g2UnitWidths[idx];
        const nextW = curRow.length === 0 ? uw : curW + g2UnitGap + uw;
        if (curRow.length > 0 && nextW > maxHubAllowedW) {
          g2Rows.push(curRow);
          curRow = [item];
          curW = uw;
        } else {
          curRow.push(item);
          curW = nextW;
        }
      });
      if (curRow.length > 0) g2Rows.push(curRow);
    }
    const g2MaxRowW = g2Rows.reduce((mx, row) => {
      const rw =
        row.reduce(
          (s, r) => s + (1 + (r.node.member.spouses?.length || 0)) * g2Dim.w,
          0
        ) +
        Math.max(0, row.length - 1) * g2UnitGap;
      return Math.max(mx, rw);
    }, 0);

    const g1RowH = g1List.length > 0 ? g1Dim.h : 0;
    const g2BlockH =
      g2Rows.length > 0
        ? g2Rows.length * g2Dim.h + Math.max(0, g2Rows.length - 1) * internalTightPx
        : 0;
    const hubW = Math.max(buildG1RowW(), g2MaxRowW);
    const hubH =
      g1RowH + (g1RowH > 0 && g2BlockH > 0 ? internalTightPx + 4 : 0) + g2BlockH;

    const placeBigUnit = (
      m: FamilyMember,
      startX: number,
      topY: number,
      unitDim: { w: number; h: number },
      scaleMult: number,
      parentNodeId: string | null,
      depth: number
    ) => {
      const primaryId = `n_${m.id}`;
      nodes.push({
        id: primaryId,
        name: m.name,
        sub: formatMemberLifeSubtitle(m),
        x: Math.round(startX),
        y: Math.round(topY),
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: m.generationLevel ?? depth,
        scaleMultiplier: scaleMult,
      });
      if (parentNodeId) {
        edges.push({ from: parentNodeId, to: primaryId, type: 'child' });
      }
      (m.spouses || []).forEach((sp, sIdx) => {
        const spId = `n_${m.id}_sp_${sIdx + 1}`;
        nodes.push({
          id: spId,
          name: sp.name,
          sub: sp.status === 'cerai_mati' ? 'Pasangan (Wafat)' : 'Pasangan',
          x: Math.round(startX + (sIdx + 1) * unitDim.w), // 0mm menempel rapat!
          y: Math.round(topY),
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? depth,
          scaleMultiplier: scaleMult,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });
      return primaryId;
    };

    const placeHubAt = (hubLeftX: number, hubTopY: number) => {
      let curY = hubTopY;
      if (g1List.length > 0) {
        const g1W = buildG1RowW();
        let gx = hubLeftX + (hubW - g1W) / 2;
        g1List.forEach((g1) => {
          const uw = (1 + (g1.member.spouses?.length || 0)) * g1Dim.w;
          placeBigUnit(g1.member, gx, curY, g1Dim, g1ScaleMult, null, 0);
          gx += uw + g1UnitGap;
        });
        curY += g1Dim.h + internalTightPx + 4;
      }
      g2Rows.forEach((row) => {
        const rowW =
          row.reduce(
            (s, r) => s + (1 + (r.node.member.spouses?.length || 0)) * g2Dim.w,
            0
          ) +
          Math.max(0, row.length - 1) * g2UnitGap;
        let gx = hubLeftX + (hubW - rowW) / 2;
        row.forEach(({ node: g2, parentId }) => {
          const uw = (1 + (g2.member.spouses?.length || 0)) * g2Dim.w;
          placeBigUnit(
            g2.member,
            gx,
            curY,
            g2Dim,
            g2ScaleMult,
            parentId ? `n_${parentId}` : null,
            1
          );
          gx += uw + g2UnitGap;
        });
        curY += g2Dim.h + internalTightPx;
      });
    };

    // Shelf / 2D Compact Packer untuk menata kontainer G3 tanpa ruang kosong terbuang (zero dead space)
    const packShelfZone = (
      boxes: G3Box[],
      zoneX: number,
      zoneY: number,
      zoneW: number,
      centerRowsHoriz = true
    ): { totalH: number; maxRight: number } => {
      if (boxes.length === 0) return { totalH: 0, maxRight: zoneX };
      const shelves: { items: G3Box[]; w: number; h: number }[] = [];

      // First-Fit Decreasing / Proximity-aware shelf fill untuk minimalkan ruang kosong di ujung baris
      boxes.forEach((bx) => {
        // Coba masukkan ke shelf yang sudah ada jika muat lebar & selisih tingginya cocok (<=45px) agar zero dead space
        let placedShelf: (typeof shelves)[number] | undefined;
        let bestWaste = Infinity;
        for (const sh of shelves) {
          const nextW = sh.w + moduleGapPx + bx.w;
          if (nextW <= zoneW) {
            const heightPenalty = Math.abs(sh.h - bx.h) * 2;
            const waste = zoneW - nextW + heightPenalty;
            if (waste < bestWaste) {
              bestWaste = waste;
              placedShelf = sh;
            }
          }
        }
        if (placedShelf) {
          placedShelf.items.push(bx);
          placedShelf.w += moduleGapPx + bx.w;
          placedShelf.h = Math.max(placedShelf.h, bx.h);
        } else {
          shelves.push({ items: [bx], w: bx.w, h: bx.h });
        }
      });

      let curY = zoneY;
      let maxRight = zoneX;
      shelves.forEach((sh) => {
        const startX = centerRowsHoriz
          ? zoneX + Math.max(0, (zoneW - sh.w) / 2)
          : zoneX;
        let curX = startX;
        sh.items.forEach((it) => {
          it.x = Math.round(curX);
          // Sejajarkan vertikal di tengah shelf agar simetris rapi
          it.y = Math.round(curY + Math.max(0, (sh.h - it.h) / 2));
          curX += it.w + moduleGapPx;
          maxRight = Math.max(maxRight, it.x + it.w);
        });
        curY += sh.h + moduleGapPx;
      });

      return {
        totalH: curY - zoneY - moduleGapPx,
        maxRight,
      };
    };

    const commitG3Boxes = (boxes: G3Box[]) => {
      boxes.forEach((item) => {
        const m = item.head.member;
        const pNodeId = item.parentId ? `n_${item.parentId}` : null;
        if (item.isMerged) {
          const modId = `mod_g3_${m.id}`;
          nodes.push({
            id: modId,
            name: m.name,
            sub: `${item.members.length} Org`,
            x: item.x,
            y: item.y,
            photo: m.photoUrl || '',
            wafat: item.members.every((x) => x.wafat),
            genLevel: m.generationLevel ?? 2,
            mergedMembers: item.members,
            mergedCols: item.customCols,
            mergedEdgesSnapshot: item.snapshotEdges,
            modularSubLayout: modularLayout,
            modularHeadMemberId: m.id,
          });
          if (pNodeId) {
            edges.push({ from: pNodeId, to: modId, type: 'child' });
          }
        } else {
          const cid = `n_${m.id}`;
          nodes.push({
            id: cid,
            name: m.name,
            sub: formatMemberLifeSubtitle(m),
            x: item.x,
            y: item.y,
            photo: m.photoUrl || '',
            wafat: m.isDeceased,
            gender: m.gender,
            memberId: m.id,
            genLevel: m.generationLevel ?? 2,
            modularSubLayout: modularLayout,
          });
          if (pNodeId) {
            edges.push({ from: pNodeId, to: cid, type: 'child' });
          }
        }
      });
    };

    if (modularG12Position === 'center' && g3Boxes.length >= 1) {
      // Bagi kontainer G3 secara seimbang ke segala arah di sekitar Poros Tengah G1–G2:
      // 1) Jika kiri & kanan Poros Tengah punya ruang cukup, isi sayap kiri/kanan agar tidak ada dead space
      const minBoxW = Math.min(...g3Boxes.map((b) => b.w));
      const sideSpaceEach = Math.floor((usableW - hubW - moduleGapPx * 2) / 2);
      const canUseSideWings = sideSpaceEach >= minBoxW + 4 && g3Boxes.length >= 4;

      const leftWing: G3Box[] = [];
      const rightWing: G3Box[] = [];
      const topPool: G3Box[] = [];
      const bottomPool: G3Box[] = [];

      // Distribusikan berdasarkan kedekatan G2 (kiri/kanan) & keseimbangan luas (area) atas vs bawah
      const remaining = [...g3Boxes];

      if (canUseSideWings) {
        // Ambil 1-2 modul yang pas masuk ke sayap kiri (dari G2 kiri) & sayap kanan (dari G2 kanan)
        let leftAccH = 0;
        let rightAccH = 0;
        const maxWingH = Math.max(hubH + 40, usableH * 0.42);
        const picked = new Set<number>();

        for (let i = 0; i < remaining.length; i++) {
          const bx = remaining[i];
          if (bx.w <= sideSpaceEach && leftAccH + bx.h <= maxWingH && leftWing.length < 2) {
            leftWing.push(bx);
            leftAccH += bx.h + moduleGapPx;
            picked.add(bx.orderPos);
            break;
          }
        }
        for (let i = remaining.length - 1; i >= 0; i--) {
          const bx = remaining[i];
          if (
            !picked.has(bx.orderPos) &&
            bx.w <= sideSpaceEach &&
            rightAccH + bx.h <= maxWingH &&
            rightWing.length < 2
          ) {
            rightWing.push(bx);
            rightAccH += bx.h + moduleGapPx;
            picked.add(bx.orderPos);
            break;
          }
        }
        const restForTopBottom = remaining.filter((b) => !picked.has(b.orderPos));
        let topArea = 0;
        let botArea = 0;
        restForTopBottom.forEach((bx) => {
          const area = (bx.w + moduleGapPx) * (bx.h + moduleGapPx);
          if (topArea <= botArea) {
            topPool.push(bx);
            topArea += area;
          } else {
            bottomPool.push(bx);
            botArea += area;
          }
        });
      } else {
        // Bagi simetris ke Atas & Bawah G1–G2 berdasarkan luas area
        let topArea = 0;
        let botArea = 0;
        remaining.forEach((bx) => {
          const area = (bx.w + moduleGapPx) * (bx.h + moduleGapPx);
          if (topArea <= botArea) {
            topPool.push(bx);
            topArea += area;
          } else {
            bottomPool.push(bx);
            botArea += area;
          }
        });
      }

      // Hitung tinggi nyata zona atas, sayap tengah & bawah agar G1–G2 benar-benar menjadi poros gravitasi di tengah tanpa tabrakan vertikal
      const hubX = Math.round(outerMarginX + Math.max(0, (usableW - hubW) / 2));
      const topPacked = packShelfZone(topPool, outerMarginX, topMarginY, usableW, true);
      const botPacked = packShelfZone(bottomPool, outerMarginX, topMarginY, usableW, true);
      const lwAvailW = Math.max(100, hubX - outerMarginX - moduleGapPx);
      const rwX = hubX + hubW + moduleGapPx;
      const rwAvailW = Math.max(100, boardWidth - outerMarginX - rwX);
      const lwPre = leftWing.length > 0 ? packShelfZone(leftWing, outerMarginX, topMarginY, lwAvailW, true) : { totalH: 0, maxRight: 0 };
      const rwPre = rightWing.length > 0 ? packShelfZone(rightWing, rwX, topMarginY, rwAvailW, true) : { totalH: 0, maxRight: 0 };

      const midBandH = Math.max(hubH, lwPre.totalH, rwPre.totalH);
      const topNeedH = topPool.length > 0 ? topPacked.totalH + moduleGapPx : 0;
      const botNeedH = bottomPool.length > 0 ? botPacked.totalH + moduleGapPx : 0;
      const totalContentH = topNeedH + midBandH + botNeedH;

      // Letakkan pita tengah (Poros G1–G2 + sayap) di antara zona atas & zona bawah (atau tepat tengah kanvas jika muat)
      const idealMidBandY = topMarginY + Math.max(0, (usableH - midBandH) / 2);
      const minMidBandY = topMarginY + topNeedH;
      const maxMidBandY = Math.max(minMidBandY, topMarginY + usableH - botNeedH - midBandH);
      const midBandY =
        totalContentH <= usableH
          ? Math.max(minMidBandY, Math.min(maxMidBandY, Math.round(idealMidBandY)))
          : Math.round(topMarginY + topNeedH);
      const hubY = Math.round(midBandY + Math.max(0, (midBandH - hubH) / 2));

      // Reposisikan zona Atas tepat di atas pita tengah, zona Bawah tepat di bawah pita tengah
      const topStartY =
        topPool.length > 0
          ? Math.max(topMarginY, midBandY - moduleGapPx - topPacked.totalH)
          : topMarginY;
      packShelfZone(topPool, outerMarginX, topStartY, usableW, true);

      const botStartY = midBandY + midBandH + moduleGapPx;
      packShelfZone(bottomPool, outerMarginX, botStartY, usableW, true);

      // Posisikan Sayap Kiri & Kanan sejajar vertikal di tengah pita tengah
      if (leftWing.length > 0) {
        const lwStartY = Math.round(midBandY + Math.max(0, (midBandH - lwPre.totalH) / 2));
        packShelfZone(leftWing, outerMarginX, lwStartY, lwAvailW, true);
      }
      if (rightWing.length > 0) {
        const rwStartY = Math.round(midBandY + Math.max(0, (midBandH - rwPre.totalH) / 2));
        packShelfZone(rightWing, rwX, rwStartY, rwAvailW, true);
      }

      placeHubAt(hubX, hubY);
      commitG3Boxes([...topPool, ...leftWing, ...rightWing, ...bottomPool]);
    } else {
      // Mode Atas (jika user memilih "Atas" manual)
      const hubX = Math.round(outerMarginX + Math.max(0, (usableW - hubW) / 2));
      placeHubAt(hubX, topMarginY);
      packShelfZone(
        g3Boxes,
        outerMarginX,
        topMarginY + (hubH > 0 ? hubH + moduleGapPx : 0),
        usableW,
        true
      );
      commitG3Boxes(g3Boxes);
    }

    return { nodes, edges };
  }

  // -------------------------------------------------------------------------
  // MODE BARU 1 & 2: KONSEP KOTAK 9 BARIS (SIMETRIS & OPSIONAL GABUNG G4–G5)
  // Row 5 = G1 & G2; Row 4 = G3 (1..4); Row 6 = G3 (5..8);
  // Row 3 & 7 = G4; Row 1,2 & 8,9 = G5 (sesuai garis keturunan induk)
  // -------------------------------------------------------------------------
  if (presetId === 'kotak_9_baris' || presetId === 'kotak_9_baris_g45_gabung') {
    const mergeG45 = presetId === 'kotak_9_baris_g45_gabung';
    const leftMargin = 92;
    const rightMargin = 28;
    const usableW = Math.max(320, boardWidth - leftMargin - rightMargin);
    const minY = 74;
    const maxY = Math.max(minY + 120, boardHeight - cardH - 36);
    const rowStepY = (maxY - minY) / 8;
    const rowY = (row1To9: number) =>
      Math.round(minY + Math.max(0, Math.min(8, row1To9 - 1)) * rowStepY);

    // Bangun depth ter-normalisasi per anggota (0=G1, 1=G2, 2=G3, 3=G4, 4=G5+)
    interface TreeMeta {
      member: FamilyMember;
      depth: number; // 0..N
      parentId: string | null;
      children: TreeMeta[];
      weight: number;
      wing: 'center' | 'up' | 'down';
      rowNum: number; // 1..9
      desiredX: number;
    }

    const metaMap = new Map<string, TreeMeta>();
    const seen = new Set<string>();

    const buildMeta = (
      m: FamilyMember,
      depth: number,
      parentId: string | null
    ): TreeMeta => {
      seen.add(m.id);
      const kidsRaw = (childrenMap.get(m.id) || []).filter((c) => !seen.has(c.id));
      const kids = kidsRaw.map((k) => buildMeta(k, depth + 1, m.id));
      const weight =
        kids.length > 0
          ? kids.reduce((s, k) => s + k.weight, 0)
          : 1 + (m.spouses?.length || 0) * 0.6;
      const meta: TreeMeta = {
        member: m,
        depth,
        parentId,
        children: kids,
        weight: Math.max(1, weight),
        wing: 'center',
        rowNum: 5,
        desiredX: leftMargin + usableW / 2,
      };
      metaMap.set(m.id, meta);
      return meta;
    };

    const rootMetas: TreeMeta[] = [];
    roots.forEach((r) => {
      if (!seen.has(r.id)) {
        const startDepth = Math.max(0, Math.min(4, r.generationLevel ?? 0));
        rootMetas.push(buildMeta(r, startDepth, null));
      }
    });
    members.forEach((m) => {
      if (!seen.has(m.id)) {
        const startDepth = Math.max(0, Math.min(4, m.generationLevel ?? 0));
        rootMetas.push(buildMeta(m, startDepth, null));
      }
    });

    // Kumpulkan semua G3 secara berurutan sesuai garis keturunan
    const orderedG3: TreeMeta[] = [];
    const walkCollect = (tm: TreeMeta) => {
      if (tm.depth === 2) orderedG3.push(tm);
      tm.children.forEach(walkCollect);
    };
    rootMetas.forEach(walkCollect);

    // Tetapkan sayap & nomor baris 1..9:
    // G1 & G2 -> Baris 5
    // G3 anak 1-4 -> Baris 4 (up), anak 5-8 -> Baris 6 (down), >8 bergantian 4 & 6
    orderedG3.forEach((g3, idx) => {
      const goUp = idx < 4 ? true : idx < 8 ? false : idx % 2 === 0;
      g3.wing = goUp ? 'up' : 'down';
      g3.rowNum = goUp ? 4 : 6;
    });

    const assignDescendantsAndX = (
      tm: TreeMeta,
      spanStartX: number,
      spanEndX: number,
      inheritedWing: 'center' | 'up' | 'down',
      siblingIdxAmongSameWing: number
    ) => {
      const midX = (spanStartX + spanEndX) / 2;
      tm.desiredX = midX;

      if (tm.depth <= 1) {
        tm.wing = 'center';
        tm.rowNum = 5;
      } else if (tm.depth === 2) {
        // sudah diatur di orderedG3
      } else {
        const effWing =
          inheritedWing === 'center'
            ? siblingIdxAmongSameWing % 2 === 0
              ? 'up'
              : 'down'
            : inheritedWing;
        tm.wing = effWing;
        if (tm.depth === 3) {
          tm.rowNum = effWing === 'up' ? 3 : 7;
        } else {
          // G5+ -> Baris 2 lalu 1 untuk atas, Baris 8 lalu 9 untuk bawah
          if (effWing === 'up') {
            tm.rowNum = siblingIdxAmongSameWing % 2 === 0 ? 2 : 1;
          } else {
            tm.rowNum = siblingIdxAmongSameWing % 2 === 0 ? 8 : 9;
          }
        }
      }

      if (tm.children.length > 0) {
        const totalW = tm.children.reduce((s, c) => s + c.weight, 0) || 1;
        let cur = spanStartX;
        let upCount = 0;
        let downCount = 0;
        tm.children.forEach((ch) => {
          const slice = ((spanEndX - spanStartX) * ch.weight) / totalW;
          const nextWing = ch.depth === 2 ? ch.wing : tm.wing;
          const idxForRow = nextWing === 'up' ? upCount++ : downCount++;
          assignDescendantsAndX(ch, cur, cur + slice, nextWing, idxForRow);
          cur += slice;
        });
      }
    };

    const totalRootWeight = rootMetas.reduce((s, r) => s + r.weight, 0) || 1;
    let rootCursorX = leftMargin;
    rootMetas.forEach((rm) => {
      const span = (usableW * rm.weight) / totalRootWeight;
      assignDescendantsAndX(rm, rootCursorX, rootCursorX + span, 'center', 0);
      rootCursorX += span;
    });

    // Helper pembantu untuk membuat node pasangan & node utama di kanvas
    interface PlacedBox {
      node: InteractiveNode;
      w: number;
      h: number;
      rowHint: number;
      desiredCenterX: number;
    }
    const rowBuckets = new Map<number, PlacedBox[]>();
    for (let r = 1; r <= 9; r++) rowBuckets.set(r, []);

    const createIndividualCardAndSpouses = (
      tm: TreeMeta,
      rowHint: number,
      parentNodeId: string | null
    ): string => {
      const m = tm.member;
      const primaryId = `n_${m.id}`;
      const labelGen =
        tm.depth === 0 ? 'Leluhur G1' : `Generasi ${tm.depth + 1}`;
      const primaryNode: InteractiveNode = {
        id: primaryId,
        name: m.name,
        sub: formatMemberLifeSubtitle(m),
        x: Math.round(tm.desiredX - cardW / 2),
        y: rowY(rowHint),
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: tm.depth,
      };

      if (parentNodeId) {
        edges.push({ from: parentNodeId, to: primaryId, type: 'child' });
      }

      const unitList: InteractiveNode[] = [primaryNode];
      (m.spouses || []).forEach((sp, sIdx) => {
        const spId = `n_${m.id}_sp_${sIdx + 1}`;
        unitList.push({
          id: spId,
          name: sp.name,
          sub: `Pasangan (${
            sp.status === 'cerai_mati'
              ? 'Wafat'
              : sp.status === 'cerai_hidup'
              ? 'Cerai'
              : 'Menikah'
          })`,
          x: Math.round(primaryNode.x + (sIdx + 1) * (cardW + coupleGap)),
          y: primaryNode.y,
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: tm.depth,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      unitList.forEach((un, idx) => {
        rowBuckets.get(rowHint)!.push({
          node: un,
          w: cardW,
          h: cardH,
          rowHint,
          desiredCenterX: tm.desiredX + idx * (cardW + coupleGap),
        });
      });

      return primaryId;
    };

    const collectSubtreeFlat = (
      tm: TreeMeta,
      parentRefId: string
    ): {
      members: MergedCardMember[];
      snapshotEdges: InteractiveEdge[];
    } => {
      const list: MergedCardMember[] = [];
      const snapEdges: InteractiveEdge[] = [];

      const pushPersonAndSpouses = (cur: TreeMeta, parentIdForCur: string) => {
        const cm = cur.member;
        const cid = `n_${cm.id}`;
        list.push({
          originalNodeId: cid,
          memberId: cm.id,
          name: cm.name,
          sub: formatMemberLifeSubtitle(cm),
          photo: cm.photoUrl || '',
          wafat: cm.isDeceased,
          gender: cm.gender,
          genLevel: cur.depth,
          relX: 0,
          relY: 0,
        });
        snapEdges.push({ from: parentIdForCur, to: cid, type: 'child' });

        (cm.spouses || []).forEach((sp, sIdx) => {
          const spId = `n_${cm.id}_sp_${sIdx + 1}`;
          list.push({
            originalNodeId: spId,
            name: sp.name,
            sub: `Pasangan`,
            photo: '',
            wafat: sp.status === 'cerai_mati',
            gender: cm.gender === 'L' ? 'P' : cm.gender === 'P' ? 'L' : undefined,
            genLevel: cur.depth,
            relX: 0,
            relY: 0,
          });
          snapEdges.push({ from: cid, to: spId, type: 'couple' });
        });

        cur.children.forEach((kid) => pushPersonAndSpouses(kid, cid));
      };

      pushPersonAndSpouses(tm, parentRefId);
      return { members: list, snapshotEdges: snapEdges };
    };

    const placeNodeRecursive = (tm: TreeMeta, parentNodeId: string | null) => {
      // Pada mode Gabung G4–G5: setiap G4 beserta keturunan G5+ digabung jadi 1 Card Besar sesuai garis keturunan!
      if (mergeG45 && tm.depth === 3 && parentNodeId) {
        const collected = collectSubtreeFlat(tm, parentNodeId);
        if (collected.members.length >= 2) {
          const mergedId = `merged_g45_${tm.member.id}`;
          const mMetrics = computeMergedCardMetrics(
            collected.members.length,
            displayMode,
            photoSize,
            cardScale
          );
          const targetRow = tm.wing === 'up' ? 2 : 8;
          const mNode: InteractiveNode = {
            id: mergedId,
            name: `Cabang ${tm.member.name}`,
            sub: `G4–G5 (${collected.members.length} Orang)`,
            x: Math.round(tm.desiredX - mMetrics.w / 2),
            y: rowY(targetRow) - Math.round((mMetrics.h - cardH) / 2),
            photo: tm.member.photoUrl || '',
            wafat: collected.members.every((x) => x.wafat),
            genLevel: 3,
            mergedMembers: collected.members,
            mergedEdgesSnapshot: collected.snapshotEdges,
          };
          edges.push({ from: parentNodeId, to: mergedId, type: 'child' });
          rowBuckets.get(targetRow)!.push({
            node: mNode,
            w: mMetrics.w,
            h: mMetrics.h,
            rowHint: targetRow,
            desiredCenterX: tm.desiredX,
          });
          return;
        }
      }

      const myNodeId = createIndividualCardAndSpouses(tm, tm.rowNum, parentNodeId);

      // Jika mode Gabung G4–G5 dan G3 ini punya >=2 anak G4 tanpa cucu, gabungkan semua G4 saudaranya jadi 1 blok rapat
      if (
        mergeG45 &&
        tm.depth === 2 &&
        tm.children.length >= 2 &&
        tm.children.every((g4) => g4.children.length === 0 && (g4.member.spouses?.length || 0) === 0)
      ) {
        const mergedId = `merged_g4sibs_${tm.member.id}`;
        const combined: MergedCardMember[] = [];
        const snapEdges: InteractiveEdge[] = [];
        tm.children.forEach((g4) => {
          const cid = `n_${g4.member.id}`;
          combined.push({
            originalNodeId: cid,
            memberId: g4.member.id,
            name: g4.member.name,
            sub: formatMemberLifeSubtitle(g4.member),
            photo: g4.member.photoUrl || '',
            wafat: g4.member.isDeceased,
            gender: g4.member.gender,
            genLevel: 3,
            relX: 0,
            relY: 0,
          });
          snapEdges.push({ from: myNodeId, to: cid, type: 'child' });
        });
        const mMetrics = computeMergedCardMetrics(
          combined.length,
          displayMode,
          photoSize,
          cardScale
        );
        const targetRow = tm.wing === 'up' ? 3 : 7;
        const mNode: InteractiveNode = {
          id: mergedId,
          name: `Keturunan ${tm.member.name}`,
          sub: `Gabungan G4 (${combined.length})`,
          x: Math.round(tm.desiredX - mMetrics.w / 2),
          y: rowY(targetRow),
          photo: combined[0]?.photo || '',
          wafat: combined.every((x) => x.wafat),
          genLevel: 3,
          mergedMembers: combined,
          mergedEdgesSnapshot: snapEdges,
        };
        edges.push({ from: myNodeId, to: mergedId, type: 'child' });
        rowBuckets.get(targetRow)!.push({
          node: mNode,
          w: mMetrics.w,
          h: mMetrics.h,
          rowHint: targetRow,
          desiredCenterX: tm.desiredX,
        });
        return;
      }

      tm.children.forEach((ch) => placeNodeRecursive(ch, myNodeId));
    };

    rootMetas.forEach((rm) => placeNodeRecursive(rm, null));

    // Jika baris 2 atau baris 8 penuh melebihi lebar kertas, limpahkan ke baris terluar (1 / 9) agar tidak bertabrakan!
    const spillOverflowRow = (innerRow: number, outerRow: number) => {
      const inner = rowBuckets.get(innerRow) || [];
      const outer = rowBuckets.get(outerRow) || [];
      const rowGap = 12;
      const totalNeed = inner.reduce((s, it) => s + it.w + rowGap, 0);
      if (totalNeed > usableW && inner.length > 2) {
        const sorted = [...inner].sort((a, b) => a.desiredCenterX - b.desiredCenterX);
        const kept: PlacedBox[] = [];
        sorted.forEach((it, i) => {
          if (i % 2 === 0) kept.push(it);
          else {
            it.rowHint = outerRow;
            it.node.y = rowY(outerRow);
            outer.push(it);
          }
        });
        rowBuckets.set(innerRow, kept);
        rowBuckets.set(outerRow, outer);
      }
    };
    if (!mergeG45) {
      spillOverflowRow(2, 1);
      spillOverflowRow(8, 9);
    }

    // Relaksasi horizontal per baris 1..9 agar tiap baris bebas tabrakan namun tetap mendekati desiredCenterX induk
    const allPlaced: PlacedBox[] = [];
    for (let r = 1; r <= 9; r++) {
      const list = (rowBuckets.get(r) || []).sort(
        (a, b) => a.desiredCenterX - b.desiredCenterX
      );
      if (list.length === 0) continue;

      const hasAnySpousesInRow = list.some((it) => it.node.id.includes('_sp_'));
      const minGap = hasAnySpousesInRow ? compactSiblingGap : unmarriedGapPx;
      const totalWidths = list.reduce((s, it) => s + it.w, 0);
      const maxAllowSpan = usableW;
      const effGap =
        list.length > 1
          ? Math.max(
              4,
              Math.min(
                minGap,
                Math.floor((maxAllowSpan - totalWidths) / (list.length - 1))
              )
            )
          : minGap;

      // Mulai dari posisi ideal lalu dorong maju/mundur supaya tidak saling menimpa; pasangan tetap menempel (0mm)
      const xs = list.map((it) =>
        Math.max(leftMargin, Math.min(boardWidth - rightMargin - it.w, it.desiredCenterX - it.w / 2))
      );
      for (let i = 1; i < list.length; i++) {
        const isGluedSpouse = list[i].node.id.startsWith(`${list[i - 1].node.id}_sp_`);
        const pairGap = isGluedSpouse ? 0 : effGap;
        const minNext = xs[i - 1] + list[i - 1].w + pairGap;
        if (xs[i] < minNext) xs[i] = minNext;
      }
      const rightEdge = xs[list.length - 1] + list[list.length - 1].w;
      const maxRight = boardWidth - rightMargin;
      if (rightEdge > maxRight) {
        let shift = rightEdge - maxRight;
        xs[list.length - 1] -= shift;
        for (let i = list.length - 2; i >= 0; i--) {
          const isGluedSpouse = list[i + 1].node.id.startsWith(`${list[i].node.id}_sp_`);
          const pairGap = isGluedSpouse ? 0 : effGap;
          const maxCur = xs[i + 1] - pairGap - list[i].w;
          if (xs[i] > maxCur) xs[i] = maxCur;
          if (xs[i] < leftMargin) xs[i] = leftMargin;
        }
      }

      list.forEach((it, idx) => {
        it.node.x = Math.round(
          Math.max(leftMargin, Math.min(boardWidth - rightMargin - it.w, xs[idx]))
        );
        it.node.y = Math.round(Math.max(66, Math.min(boardHeight - it.h - 22, it.node.y)));
        allPlaced.push(it);
      });
    }

    // Pastikan jika ada kartu besar gabungan di baris 2/8 tidak menimpa baris 3/7/4/6
    if (mergeG45) {
      for (let pass = 0; pass < 6; pass++) {
        let moved = false;
        for (let i = 0; i < allPlaced.length; i++) {
          for (let j = i + 1; j < allPlaced.length; j++) {
            const a = allPlaced[i];
            const b = allPlaced[j];
            const overlapX = Math.min(a.node.x + a.w + 10, b.node.x + b.w) - Math.max(a.node.x, b.node.x - 10);
            const overlapY = Math.min(a.node.y + a.h + 10, b.node.y + b.h) - Math.max(a.node.y, b.node.y - 10);
            if (overlapX > 0 && overlapY > 0) {
              // Geser kartu luar (G4-G5 merged) menjauh sedikit secara vertikal atau horizontal
              const target = a.node.mergedMembers ? a : b;
              const anchor = target === a ? b : a;
              if (target.node.y <= boardHeight / 2) {
                target.node.y = Math.max(66, anchor.node.y - target.h - 14);
              } else {
                target.node.y = Math.min(boardHeight - target.h - 22, anchor.node.y + anchor.h + 14);
              }
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
    }

    // Jalankan Solver Ruang Kosong 4-Arah Berjangkar Induk untuk G4/G5 & kartu besar agar 0 tumpukan!
    const solved9Rows = resolveCollisionsNearParents4Dir(
      allPlaced.map((p) => p.node),
      edges,
      boardWidth,
      boardHeight,
      displayMode,
      photoSize,
      cardScale,
      {
        minLeftX: leftMargin,
        rightMargin,
        minTopY: 64,
        bottomMargin: 22,
        padX: Math.max(6, Math.round(compactSiblingGap * 0.65)),
        padY: Math.max(8, Math.round(cardH * 0.12)),
        anchorMaxGen: 2, // G1–G3 tetap jangkar stabil di baris tengah 4,5,6
      }
    );

    return {
      nodes: solved9Rows,
      edges,
    };
  }

  // -------------------------------------------------------------------------
  // MODE BARU 3 & 4: KONSEP BULAT / ELIPS / ORBIT 1–5 (PUSAT KE LUAR)
  // Orbit 1 = G1–G2, Orbit 2 = G3, Orbit 3–4 = G4, Orbit 5 = G5+
  // -------------------------------------------------------------------------
  if (presetId === 'orbit_elips_1_5' || presetId === 'orbit_elips_gabung') {
    const mergeG45 = presetId === 'orbit_elips_gabung';
    const cx = boardWidth / 2;
    const cy = topSafeY + usableH / 2;
    const maxRx = Math.max(180, boardWidth / 2 - cardW * 0.65 - 32);
    const maxRy = Math.max(140, usableH / 2 - cardH * 0.65 - 24);

    // Rasio radius 5 orbit dari pusat ke luar
    const orbitRadii = (orbitNum: number): { rx: number; ry: number } => {
      const ratios: Record<number, number> = {
        0: 0, // pusat mutlak
        1: 0.22,
        2: 0.44,
        3: 0.63,
        4: 0.81,
        5: 0.98,
      };
      const factor = ratios[orbitNum] ?? Math.min(1.06, 0.98 + (orbitNum - 5) * 0.08);
      return { rx: maxRx * factor, ry: maxRy * factor };
    };

    interface OrbitMeta {
      member: FamilyMember;
      depth: number;
      children: OrbitMeta[];
      weight: number;
      angle: number;
      orbitRing: number;
    }

    const seen = new Set<string>();
    const buildOrbitMeta = (m: FamilyMember, depth: number): OrbitMeta => {
      seen.add(m.id);
      const kids = (childrenMap.get(m.id) || [])
        .filter((k) => !seen.has(k.id))
        .map((k) => buildOrbitMeta(k, depth + 1));
      const weight =
        kids.length > 0
          ? kids.reduce((s, k) => s + k.weight, 0)
          : 1 + (m.spouses?.length || 0) * 0.4;
      return {
        member: m,
        depth,
        children: kids,
        weight: Math.max(1, weight),
        angle: -Math.PI / 2,
        orbitRing: 1,
      };
    };

    const rootMetas: OrbitMeta[] = [];
    roots.forEach((r) => {
      if (!seen.has(r.id)) {
        rootMetas.push(buildOrbitMeta(r, Math.max(0, r.generationLevel ?? 0)));
      }
    });
    members.forEach((m) => {
      if (!seen.has(m.id)) {
        rootMetas.push(buildOrbitMeta(m, Math.max(0, m.generationLevel ?? 0)));
      }
    });

    interface PlacedOrbitBox {
      node: InteractiveNode;
      w: number;
      h: number;
      angle: number;
      orbitRing: number;
    }
    const placedBoxes: PlacedOrbitBox[] = [];

    const collectOrbitMergedDesc = (
      om: OrbitMeta,
      parentNodeId: string
    ): { members: MergedCardMember[]; snapshotEdges: InteractiveEdge[] } => {
      const list: MergedCardMember[] = [];
      const snapEdges: InteractiveEdge[] = [];
      const walk = (cur: OrbitMeta, pId: string) => {
        const cm = cur.member;
        const cid = `n_${cm.id}`;
        list.push({
          originalNodeId: cid,
          memberId: cm.id,
          name: cm.name,
          sub: cm.callName || `Gen ${cur.depth + 1}`,
          photo: cm.photoUrl || '',
          wafat: cm.isDeceased,
          gender: cm.gender,
          genLevel: cur.depth,
          relX: 0,
          relY: 0,
        });
        snapEdges.push({ from: pId, to: cid, type: 'child' });
        (cm.spouses || []).forEach((sp, sIdx) => {
          const spId = `n_${cm.id}_sp_${sIdx + 1}`;
          list.push({
            originalNodeId: spId,
            name: sp.name,
            sub: 'Pasangan',
            photo: '',
            wafat: sp.status === 'cerai_mati',
            gender: cm.gender === 'L' ? 'P' : cm.gender === 'P' ? 'L' : undefined,
            genLevel: cur.depth,
            relX: 0,
            relY: 0,
          });
          snapEdges.push({ from: cid, to: spId, type: 'couple' });
        });
        cur.children.forEach((k) => walk(k, cid));
      };
      walk(om, parentNodeId);
      return { members: list, snapshotEdges: snapEdges };
    };

    const placeRadial = (
      om: OrbitMeta,
      startAngle: number,
      endAngle: number,
      parentNodeId: string | null,
      siblingIndex: number
    ) => {
      const midAngle = (startAngle + endAngle) / 2;
      om.angle = midAngle;

      // Tentukan Orbit ke 1..5 sesuai aturan:
      // G1 (pusat) & G2 -> Orbit 1; G3 -> Orbit 2; G4 -> Orbit 3–4; G5+ -> Orbit 5
      let ring = 1;
      if (om.depth === 0) {
        ring = rootMetas.length === 1 && om.children.length > 0 ? 0 : 1;
      } else if (om.depth === 1) {
        ring = 1;
      } else if (om.depth === 2) {
        ring = 2;
      } else if (om.depth === 3) {
        ring = siblingIndex % 2 === 0 ? 3 : 4;
      } else {
        ring = 5;
      }
      om.orbitRing = ring;

      // Mode Orbit Gabung G4–G5: gabungkan setiap cabang G4+G5 menjadi 1 Card Besar di Orbit 3–4/5 terdekat induk
      if (mergeG45 && om.depth === 3 && parentNodeId) {
        const collected = collectOrbitMergedDesc(om, parentNodeId);
        if (collected.members.length >= 2) {
          const mergedId = `merged_orb_${om.member.id}`;
          const mMetrics = computeMergedCardMetrics(
            collected.members.length,
            displayMode,
            photoSize,
            cardScale
          );
          const { rx, ry } = orbitRadii(4);
          const x = Math.round(cx + rx * Math.cos(midAngle) - mMetrics.w / 2);
          const y = Math.round(cy + ry * Math.sin(midAngle) - mMetrics.h / 2);
          edges.push({ from: parentNodeId, to: mergedId, type: 'child' });
          placedBoxes.push({
            node: {
              id: mergedId,
              name: `Cabang ${om.member.name}`,
              sub: `G4–G5 (${collected.members.length} Orang)`,
              x,
              y,
              photo: om.member.photoUrl || '',
              wafat: collected.members.every((c) => c.wafat),
              genLevel: 3,
              mergedMembers: collected.members,
              mergedEdgesSnapshot: collected.snapshotEdges,
            },
            w: mMetrics.w,
            h: mMetrics.h,
            angle: midAngle,
            orbitRing: 4,
          });
          return;
        }
      }

      const { rx, ry } = orbitRadii(ring);
      const m = om.member;
      const spouses = m.spouses || [];
      const centerPxX =
        ring === 0 && rootMetas.length === 1
          ? cx - (spouses.length > 0 ? (cardW + coupleGap) / 2 : 0)
          : cx + rx * Math.cos(midAngle);
      const centerPxY = ring === 0 && rootMetas.length === 1 ? cy : cy + ry * Math.sin(midAngle);

      const primaryId = `n_${m.id}`;
      const primaryNode: InteractiveNode = {
        id: primaryId,
        name: m.name,
        sub: m.callName || (om.depth === 0 ? 'Pusat Trah G1' : `Generasi ${om.depth + 1}`),
        x: Math.round(centerPxX - cardW / 2),
        y: Math.round(centerPxY - cardH / 2),
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: om.depth,
      };
      placedBoxes.push({
        node: primaryNode,
        w: cardW,
        h: cardH,
        angle: midAngle,
        orbitRing: ring,
      });

      if (parentNodeId) {
        edges.push({ from: parentNodeId, to: primaryId, type: 'child' });
      }

      // Tempatkan pasangan menempel rapi ke sisi tangensial / sebelah kanan agar garis pasangan pendek
      spouses.forEach((sp, sIdx) => {
        const spId = `n_${m.id}_sp_${sIdx + 1}`;
        const spOffset = (sIdx + 1) * (cardW + coupleGap);
        const dirSign = Math.cos(midAngle) >= -0.25 || ring === 0 ? 1 : -1;
        placedBoxes.push({
          node: {
            id: spId,
            name: sp.name,
            sub: `Pasangan`,
            x: Math.round(primaryNode.x + dirSign * spOffset),
            y: primaryNode.y,
            photo: '',
            wafat: sp.status === 'cerai_mati',
            gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
            genLevel: om.depth,
          },
          w: cardW,
          h: cardH,
          angle: midAngle,
          orbitRing: ring,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      if (om.children.length > 0) {
        const totalChildWeight = om.children.reduce((s, c) => s + c.weight, 0) || 1;
        let curAng = startAngle;
        om.children.forEach((ch, idx) => {
          const span = ((endAngle - startAngle) * ch.weight) / totalChildWeight;
          placeRadial(ch, curAng, curAng + span, primaryId, idx);
          curAng += span;
        });
      }
    };

    const totalRootW = rootMetas.reduce((s, r) => s + r.weight, 0) || 1;
    let angleCursor = -Math.PI / 2;
    rootMetas.forEach((rm, idx) => {
      const span = (Math.PI * 2 * rm.weight) / totalRootW;
      placeRadial(rm, angleCursor, angleCursor + span, null, idx);
      angleCursor += span;
    });

    // Resolusi tabrakan 4-arah berjangkar induk: G1 pusat stabil, G4 & G5 geser ke ruang kosong terdekat (kanan/kiri/atas/bawah)
    const centerLockedIds = new Set<string>(
      placedBoxes.filter((p) => p.orbitRing === 0).map((p) => p.node.id)
    );
    const solvedOrbitNodes = resolveCollisionsNearParents4Dir(
      placedBoxes.map((p) => p.node),
      edges,
      boardWidth,
      boardHeight,
      displayMode,
      photoSize,
      cardScale,
      {
        minLeftX: 20,
        rightMargin: 20,
        minTopY: 64,
        bottomMargin: 24,
        padX: Math.max(8, Math.round(compactSiblingGap * 0.7)),
        padY: Math.max(10, Math.round(cardH * 0.14)),
        anchorMaxGen: 1,
        lockedNodeIds: centerLockedIds,
        radialCenter: { x: cx, y: cy },
      }
    );

    return {
      nodes: solvedOrbitNodes,
      edges,
    };
  }

  // -------------------------------------------------------------------------
  // MODE BARU 4B: TERATAI MEKAR (MANDALA PUTIK EMAS & KELOPAK MEMANCAR)
  // - G1 Putik Emas Mahkota Besar di Pusat Mandala
  // -------------------------------------------------------------------------
  // MODE BARU 4: KOLAM TERATAI MEKAR (MULTI-LOTUS POND)
  // - G1, G2, G3 masing-masing menjadi BUNGA TERATAI TERPISAH
  // - Pasangan G1/G2/G3 menempel di pusat bunga (putik tengah)
  // - Garis konektor CUKUP antar bunga (G1 -> G2 -> G3)
  // - G4 (kelopak dalam) & G5+ (kelopak luar) mengelilingi bunga G3-nya!
  // -------------------------------------------------------------------------
  if (presetId === 'teratai_mekar') {
    interface LotusPondMeta {
      member: FamilyMember;
      depth: number;
      children: LotusPondMeta[];
      g4Count: number;
      g5Count: number;
      bloomRadius: number;
    }

    const seenLotus = new Set<string>();
    const buildPondMeta = (m: FamilyMember, depth: number): LotusPondMeta => {
      seenLotus.add(m.id);
      const kids = (childrenMap.get(m.id) || [])
        .filter((k) => !seenLotus.has(k.id))
        .map((k) => buildPondMeta(k, depth + 1));

      let g4Count = 0;
      let g5Count = 0;
      if (depth === 2) {
        g4Count = kids.length;
        kids.forEach((g4) => {
          g5Count += g4.children.length;
          g4.children.forEach((g5) => {
            g5Count += g5.children.length;
          });
        });
      }

      const spLen = m.spouses?.length || 0;
      const coreHalfW = (cardW * (1 + spLen)) / 2;
      let bloomRadius = Math.max(coreHalfW + 14, cardH * 0.72);
      if (depth === 2 && (g4Count > 0 || g5Count > 0)) {
        const ring1Circum = Math.max(1, g4Count) * Math.max(cardW, cardH) * 0.94;
        const r1 = Math.max(coreHalfW + cardH * 0.96, ring1Circum / (Math.PI * 2));
        if (g5Count > 0) {
          const ring2Circum = g5Count * Math.max(cardW, cardH) * 0.88;
          const r2 = Math.max(r1 + cardH * 1.04, ring2Circum / (Math.PI * 2));
          bloomRadius = r2 + cardH * 0.68;
        } else {
          bloomRadius = r1 + cardH * 0.68;
        }
      }

      return {
        member: m,
        depth,
        children: kids,
        g4Count,
        g5Count,
        bloomRadius,
      };
    };

    const lotusRoots: LotusPondMeta[] = [];
    roots.forEach((r) => {
      if (!seenLotus.has(r.id)) {
        lotusRoots.push(buildPondMeta(r, Math.max(0, r.generationLevel ?? 0)));
      }
    });
    members.forEach((m) => {
      if (!seenLotus.has(m.id)) {
        lotusRoots.push(buildPondMeta(m, Math.max(0, m.generationLevel ?? 0)));
      }
    });

    const placedLotusNodes: InteractiveNode[] = [];
    const flowerZones: Array<{
      id: string;
      cx: number;
      cy: number;
      r: number;
      meta: LotusPondMeta;
    }> = [];

    const spawnLotusCardUnit = (
      m: FamilyMember,
      centerX: number,
      centerY: number,
      depth: number,
      parentNodeId: string | null,
      lotusRole: InteractiveNode['lotusRole'],
      petalAngleDeg: number,
      attachCoupleInCenter: boolean,
      tangentAngleRad = 0
    ): string => {
      const scaleMult =
        depth === 0
          ? 1.2
          : depth === 1
          ? 1.08
          : depth === 2
          ? 1.0
          : depth === 3
          ? 0.9
          : 0.84;

      const unitDim = estimateSmartNodeBoxSize(
        {
          id: `tmp_pond_${m.id}`,
          name: m.name,
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: m.isDeceased,
          scaleMultiplier: scaleMult,
          cardShape: 'petal',
        },
        displayMode,
        photoSize,
        cardScale
      );

      const spouses = m.spouses || [];
      const coupleTightGap = attachCoupleInCenter ? 2 : 3;
      const totalCenterW =
        attachCoupleInCenter && spouses.length > 0
          ? unitDim.w * (1 + spouses.length) + coupleTightGap * spouses.length
          : unitDim.w;

      const primaryX = attachCoupleInCenter
        ? Math.round(centerX - totalCenterW / 2)
        : Math.round(centerX - unitDim.w / 2);
      const primaryY = Math.round(centerY - unitDim.h / 2);

      const primaryId = `n_${m.id}`;
      const lotusStop = getBpStop(depth);
      const lotusShape: InteractiveNode['cardShape'] =
        aiBlueprint?.cardShape && aiBlueprint.cardShape !== 'hex'
          ? aiBlueprint.cardShape
          : 'petal';

      placedLotusNodes.push({
        id: primaryId,
        name: m.name,
        sub: formatMemberLifeSubtitle(m),
        x: Math.max(18, Math.min(boardWidth - 18 - unitDim.w, primaryX)),
        y: Math.max(64, Math.min(boardHeight - 20 - unitDim.h, primaryY)),
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: m.generationLevel ?? depth,
        scaleMultiplier: scaleMult,
        cardShape: lotusShape,
        lotusRole,
        leafAngleDeg: lotusRole === 'flower_center' ? 0 : petalAngleDeg,
        customBgColor: lotusStop?.bg,
        customBorderColor: lotusStop?.border,
      });

      if (parentNodeId) {
        edges.push({ from: parentNodeId, to: primaryId, type: 'child' });
      }

      spouses.forEach((sp, sIdx) => {
        const spScale = attachCoupleInCenter ? scaleMult * 0.98 : scaleMult * 0.94;
        const spDim = estimateSmartNodeBoxSize(
          {
            id: `tmp_pond_sp_${m.id}`,
            name: sp.name,
            sub: '',
            x: 0,
            y: 0,
            photo: '',
            wafat: sp.status === 'cerai_mati',
            scaleMultiplier: spScale,
            cardShape: 'petal',
          },
          displayMode,
          photoSize,
          cardScale
        );
        const spId = `n_${m.id}_sp_${sIdx + 1}`;
        let spX: number;
        let spY: number;
        if (attachCoupleInCenter) {
          spX = primaryX + (sIdx + 1) * (unitDim.w + coupleTightGap);
          spY = Math.round(primaryY + (unitDim.h - spDim.h) / 2);
        } else {
          // Pasangan kelopak G4/G5 menempel di sisi tangen cincin bunga
          const stepDist = (sIdx + 1) * (unitDim.w * 0.88 + 4);
          spX = Math.round(
            centerX + Math.cos(tangentAngleRad) * stepDist - spDim.w / 2
          );
          spY = Math.round(
            centerY + Math.sin(tangentAngleRad) * stepDist - spDim.h / 2
          );
        }
        placedLotusNodes.push({
          id: spId,
          name: sp.name,
          sub: `Pasangan (${
            sp.status === 'cerai_mati'
              ? 'Wafat'
              : sp.status === 'cerai_hidup'
              ? 'Cerai'
              : 'Menikah'
          })`,
          x: Math.max(18, Math.min(boardWidth - 18 - spDim.w, spX)),
          y: Math.max(64, Math.min(boardHeight - 20 - spDim.h, spY)),
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? depth,
          scaleMultiplier: spScale,
          cardShape: lotusShape,
          lotusRole,
          leafAngleDeg: lotusRole === 'flower_center' ? 0 : petalAngleDeg + 8,
          customBgColor: lotusStop?.bg,
          customBorderColor: lotusStop?.border,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      return primaryId;
    };

    // Kumpulkan seluruh bunga G1, G2, G3 untuk ditata merata di kolam
    const g1List = lotusRoots;
    const g2List: Array<{ meta: LotusPondMeta; parentIdx: number }> = [];
    const g3List: Array<{
      meta: LotusPondMeta;
      g2Idx: number;
      parentG2Id: string;
    }> = [];

    const availW = Math.max(320, boardWidth - 56);
    const g1Y = Math.round(topSafeY + usableH * 0.11);
    const g2Y = Math.round(topSafeY + usableH * 0.34);
    const g3BaseY = Math.round(topSafeY + usableH * 0.72);

    // 1. Tempatkan Bunga Induk G1 (menempel pasangan di pusat bunga)
    const g1NodeIds: string[] = [];
    g1List.forEach((g1, idx) => {
      const gx = Math.round(
        boardWidth / 2 +
          (idx - (g1List.length - 1) / 2) * Math.min(260, availW / Math.max(1, g1List.length))
      );
      const gy = g1List.length === 1 && g1.children.length === 0
        ? Math.round(topSafeY + usableH * 0.48)
        : g1Y;
      const g1Id = spawnLotusCardUnit(
        g1.member,
        gx,
        gy,
        0,
        null,
        'flower_center',
        0,
        true
      );
      g1NodeIds.push(g1Id);
      g1.children.forEach((g2) => {
        g2List.push({ meta: g2, parentIdx: idx });
      });
    });

    // Hitung bobot lebar kolam tiap G2 dari total diameter bunga G3 anaknya
    const getG2PoolWidth = (g2Meta: LotusPondMeta): number => {
      if (g2Meta.children.length === 0) return Math.max(cardW * 2.1, 130);
      return g2Meta.children.reduce(
        (sum, g3) => sum + Math.max(cardW * 2.1, g3.bloomRadius * 2 + 24),
        0
      );
    };

    const g2Pools = g2List.map((item) => getG2PoolWidth(item.meta));
    const totalPoolW = g2Pools.reduce((s, w) => s + w, 0) || 1;
    let cursorX = 28;

    const g2Positions: Array<{ x: number; y: number; nodeId: string; spanW: number }> = [];

    // 2. Tempatkan Bunga Utama G2 + Kuntum Bunga G3 terpisah di kolam bawahnya
    g2List.forEach((item, g2Idx) => {
      const shareW = (availW * g2Pools[g2Idx]) / totalPoolW;
      const g2Cx = Math.round(cursorX + shareW / 2);
      const g2ArcOffset =
        g2List.length >= 3
          ? Math.round(
              Math.sin((g2Idx / Math.max(1, g2List.length - 1)) * Math.PI) *
                Math.min(34, usableH * 0.05)
            )
          : 0;
      const g2Cy = g2Y - g2ArcOffset;
      const parentG1Id = g1NodeIds[item.parentIdx] || null;

      const g2Id = spawnLotusCardUnit(
        item.meta.member,
        g2Cx,
        g2Cy,
        1,
        parentG1Id,
        'flower_center',
        0,
        true
      );
      g2Positions.push({ x: g2Cx, y: g2Cy, nodeId: g2Id, spanW: shareW });

      const g3Children = item.meta.children;
      if (g3Children.length > 0) {
        const g3Radii = g3Children.map((c) => Math.max(70, c.bloomRadius));
        const totalR = g3Radii.reduce((s, r) => s + r * 2, 0) || 1;
        let g3CursorX = cursorX + 6;
        const g3AvailW = Math.max(80, shareW - 12);

        g3Children.forEach((g3, cIdx) => {
          const g3Span = (g3AvailW * g3Radii[cIdx] * 2) / totalR;
          const fx = Math.round(g3CursorX + g3Span / 2);
          const staggerY =
            g3Children.length >= 2
              ? cIdx % 2 === 0
                ? -Math.round(usableH * 0.09)
                : Math.round(usableH * 0.09)
              : 0;
          const fy = Math.max(
            g2Cy + cardH * 1.45,
            Math.min(boardHeight - 50 - g3.bloomRadius * 0.55, g3BaseY + staggerY)
          );
          g3List.push({ meta: g3, g2Idx, parentG2Id: g2Id });
          flowerZones.push({
            id: g3.member.id,
            cx: fx,
            cy: fy,
            r: g3.bloomRadius,
            meta: g3,
          });
          g3CursorX += g3Span;
        });
      }
      cursorX += shareW;
    });

    // 3. Pisahkan zona bunga G3 (2D circle separation) agar antar kuntum teratai G3+G4+G5 tidak pernah tabrakan!
    for (let iter = 0; iter < 40; iter++) {
      let moved = false;
      for (let i = 0; i < flowerZones.length; i++) {
        for (let j = i + 1; j < flowerZones.length; j++) {
          const a = flowerZones[i];
          const b = flowerZones[j];
          const minDist = (a.r + b.r) * 0.88 + 16;
          const dx = b.cx - a.cx;
          const dy = b.cy - a.cy;
          const dist = Math.hypot(dx, dy) || 0.01;
          if (dist < minDist) {
            const push = (minDist - dist) * 0.52;
            const ux = dx / dist;
            const uy = dy / dist;
            a.cx -= ux * push;
            a.cy -= uy * push * 0.8;
            b.cx += ux * push;
            b.cy += uy * push * 0.8;
            moved = true;
          }
        }
      }
      for (const f of flowerZones) {
        const padR = Math.min(f.r * 0.72, boardWidth * 0.18);
        f.cx = Math.max(24 + padR, Math.min(boardWidth - 24 - padR, f.cx));
        f.cy = Math.max(g2Y + cardH * 1.3, Math.min(boardHeight - 36 - padR, f.cy));
      }
      if (!moved) break;
    }

    // 4. Spawn pusat bunga G3 (pasangan menempel di pusat bunga) + G4 & G5 kelopak mengelilingi G3!
    const g3CenterNodeIds: string[] = [];
    const g3PetalIds = new Set<string>();
    flowerZones.forEach((fz, zIdx) => {
      const g3Entry = g3List[zIdx];
      const g3Meta = fz.meta;
      const fx = Math.round(fz.cx);
      const fy = Math.round(fz.cy);

      const g3NodeId = spawnLotusCardUnit(
        g3Meta.member,
        fx,
        fy,
        2,
        g3Entry.parentG2Id,
        'flower_center',
        0,
        true
      );
      g3CenterNodeIds.push(g3NodeId);

      const g4Kids = g3Meta.children;
      if (g4Kids.length === 0) return;

      const spCenterCount = g3Meta.member.spouses?.length || 0;
      const centerHalfW = (cardW * (1 + spCenterCount)) / 2;
      const hasG5 = g4Kids.some((g4) => g4.children.length > 0);
      const ring1R = Math.max(
        centerHalfW + cardH * 0.92,
        (g4Kids.length * Math.max(cardW, cardH) * 0.95) / (Math.PI * 2)
      );
      const ring2R = ring1R + cardH * 1.05;

      // Bagi 360° di sekeliling pusat bunga G3 berdasar jumlah G5 tiap G4 (tetap seimbang merata)
      const g4Weights = g4Kids.map((g4) => 1 + g4.children.length * 0.75);
      const totalG4W = g4Weights.reduce((s, w) => s + w, 0) || 1;
      let sectorStart = -Math.PI / 2;

      g4Kids.forEach((g4, g4Idx) => {
        const equalShare = (Math.PI * 2) / g4Kids.length;
        const wShare = (Math.PI * 2 * g4Weights[g4Idx]) / totalG4W;
        const sectorSpan = equalShare * 0.45 + wShare * 0.55;
        const midAng = sectorStart + sectorSpan / 2;

        const p4x = fx + Math.cos(midAng) * ring1R;
        const p4y = fy + Math.sin(midAng) * ring1R;
        const deg4 = Math.round((((midAng * 180) / Math.PI + 90) % 360) * 10) / 10;

        const g4Id = spawnLotusCardUnit(
          g4.member,
          p4x,
          p4y,
          3,
          g3NodeId,
          'petal_inner',
          deg4,
          false,
          midAng + Math.PI / 2
        );
        g3PetalIds.add(g4Id);

        // Kelopak G5+ mengelilingi tepat di cincin luar sektor induk G4-nya!
        const g5Flat: Array<{ meta: LotusPondMeta; parentNodeId: string }> = [];
        g4.children.forEach((g5) => {
          g5Flat.push({ meta: g5, parentNodeId: g4Id });
          g5.children.forEach((g6) => {
            g5Flat.push({ meta: g6, parentNodeId: `n_${g5.member.id}` });
          });
        });

        if (g5Flat.length > 0) {
          const arcSpan = Math.max(sectorSpan * 0.92, g5Flat.length * 0.36);
          const startA = midAng - arcSpan / 2;
          g5Flat.forEach((g5Item, g5Idx) => {
            const frac =
              g5Flat.length === 1 ? 0.5 : (g5Idx + 0.5) / g5Flat.length;
            const ang5 = startA + frac * arcSpan;
            const rLayer =
              ring2R + (g5Flat.length >= 4 && g5Idx % 2 === 1 ? cardH * 0.32 : 0);
            const p5x = fx + Math.cos(ang5) * rLayer;
            const p5y = fy + Math.sin(ang5) * rLayer;
            const deg5 =
              Math.round((((ang5 * 180) / Math.PI + 90) % 360) * 10) / 10;
            const g5Id = spawnLotusCardUnit(
              g5Item.meta.member,
              p5x,
              p5y,
              Math.max(4, g5Item.meta.depth),
              g5Item.parentNodeId,
              'petal_outer',
              deg5,
              false,
              ang5 + Math.PI / 2
            );
            g3PetalIds.add(g5Id);
          });
        }

        sectorStart += sectorSpan;
      });
    });

    const lockedLotusIds = new Set<string>([...g1NodeIds, ...g3CenterNodeIds]);
    const solvedPondNodes = resolveCollisionsNearParents4Dir(
      placedLotusNodes,
      edges,
      boardWidth,
      boardHeight,
      displayMode,
      photoSize,
      cardScale,
      {
        minLeftX: 16,
        rightMargin: 16,
        minTopY: 62,
        bottomMargin: 20,
        padX: Math.max(8, Math.round(compactSiblingGap * 0.7)),
        padY: Math.max(8, Math.round(cardH * 0.12)),
        anchorMaxGen: 2,
        lockedNodeIds: lockedLotusIds,
      }
    );

    // Orientasikan kembali kelopak G4 & G5 ke pusat bunga G3-nya masing-masing
    const nodeMapPond = new Map(solvedPondNodes.map((n) => [n.id, n]));
    const parentG3CenterOf = new Map<string, { x: number; y: number }>();
    flowerZones.forEach((_, idx) => {
      const cId = g3CenterNodeIds[idx];
      const cNode = nodeMapPond.get(cId);
      if (!cNode) return;
      const cSz = estimateSmartNodeBoxSize(cNode, displayMode, photoSize, cardScale);
      const centerPt = { x: cNode.x + cSz.w / 2, y: cNode.y + cSz.h / 2 };
      const g3Meta = flowerZones[idx].meta;
      g3Meta.children.forEach((g4) => {
        parentG3CenterOf.set(`n_${g4.member.id}`, centerPt);
        g4.children.forEach((g5) => {
          parentG3CenterOf.set(`n_${g5.member.id}`, centerPt);
          g5.children.forEach((g6) => {
            parentG3CenterOf.set(`n_${g6.member.id}`, centerPt);
          });
        });
      });
    });

    const finalPondNodes = solvedPondNodes.map((n) => {
      if (n.lotusRole === 'flower_center' || (n.genLevel ?? 0) <= 2) {
        return { ...n, leafAngleDeg: 0 };
      }
      const flowerCenter = parentG3CenterOf.get(n.id);
      if (!flowerCenter) return n;
      const sz = estimateSmartNodeBoxSize(n, displayMode, photoSize, cardScale);
      const ncx = n.x + sz.w / 2;
      const ncy = n.y + sz.h / 2;
      const deg =
        Math.round(
          (((Math.atan2(ncy - flowerCenter.y, ncx - flowerCenter.x) * 180) /
            Math.PI +
            90) %
            360) *
            10
        ) / 10;
      return { ...n, leafAngleDeg: deg };
    });

    return {
      nodes: finalPondNodes,
      edges,
    };
  }

  // -------------------------------------------------------------------------
  // MODE BARU 5: SARANG LEBAH (DUAL MODE: BERTINGKAT & RATU PUSAT)
  // - Segi enam mengunci rapat, Foto + Nama Menyatu di dalam sel
  // - Pembatas Warna Bertingkat Pengganti Line: G2 ⊃ G3 ⊃ G4 ⊃ G5
  // - Tanpa Garis (lineStyle: 'none') secara default
  // -------------------------------------------------------------------------
  if (
    presetId === 'sarang_lebah_turun' ||
    presetId === 'sarang_lebah_pusat' ||
    presetId === 'molekul_organik'
  ) {
    const isRadialHive =
      presetId === 'sarang_lebah_pusat' || presetId === 'molekul_organik';

    const HONEYCOMB_G2_PALETTES = [
      {
        g2: '#f59e0b',
        g3List: ['#fde047', '#fb923c', '#a3e635', '#fcd34d'],
        g4: '#fffbeb',
      },
      {
        g2: '#10b981',
        g3List: ['#6ee7b7', '#2dd4bf', '#a3e635', '#34d399'],
        g4: '#ecfdf5',
      },
      {
        g2: '#38bdf8',
        g3List: ['#93c5fd', '#22d3ee', '#818cf8', '#7dd3fc'],
        g4: '#eff6ff',
      },
      {
        g2: '#f43f5e',
        g3List: ['#fda4af', '#fb923c', '#f472b6', '#fb7185'],
        g4: '#fff1f2',
      },
      {
        g2: '#a855f7',
        g3List: ['#d8b4fe', '#f472b6', '#818cf8', '#c084fc'],
        g4: '#faf5ff',
      },
      {
        g2: '#14b8a6',
        g3List: ['#5eead4', '#38bdf8', '#6ee7b7', '#2dd4bf'],
        g4: '#f0fdfa',
      },
      {
        g2: '#f97316',
        g3List: ['#fdba74', '#facc15', '#fb7185', '#fb923c'],
        g4: '#fff7ed',
      },
      {
        g2: '#6366f1',
        g3List: ['#a5b4fc', '#c084fc', '#60a5fa', '#818cf8'],
        g4: '#eef2ff',
      },
    ];

    interface HiveMeta {
      member: FamilyMember;
      depth: number;
      children: HiveMeta[];
      weight: number;
      g2Idx: number;
      g3Idx: number;
      lineageG2Id?: string;
      lineageG2Color?: string;
      lineageG3Id?: string;
      lineageG3Color?: string;
      lineageG4Id?: string;
      lineageG4Color?: string;
    }

    const seenHive = new Set<string>();
    const buildHiveMeta = (
      m: FamilyMember,
      depth: number,
      ctx: {
        g2Idx: number;
        g3Counter: { n: number };
        g2Id?: string;
        g2Color?: string;
        g3Id?: string;
        g3Color?: string;
        g4Id?: string;
        g4Color?: string;
      }
    ): HiveMeta => {
      seenHive.add(m.id);
      let nextG2Id = ctx.g2Id;
      let nextG2Col = ctx.g2Color;
      let nextG3Id = ctx.g3Id;
      let nextG3Col = ctx.g3Color;
      let nextG4Id = ctx.g4Id;
      let nextG4Col = ctx.g4Color;
      let myG2Idx = ctx.g2Idx;
      let myG3Idx = 0;

      const pal =
        HONEYCOMB_G2_PALETTES[Math.abs(myG2Idx) % HONEYCOMB_G2_PALETTES.length];
      if (depth === 1) {
        nextG2Id = m.id;
        nextG2Col = pal.g2;
      } else if (depth === 2) {
        myG3Idx = ctx.g3Counter.n++;
        nextG3Id = m.id;
        nextG3Col = pal.g3List[myG3Idx % pal.g3List.length];
      } else if (depth === 3) {
        nextG4Id = m.id;
        nextG4Col = pal.g4;
      }

      const rawKids = (childrenMap.get(m.id) || []).filter(
        (k) => !seenHive.has(k.id)
      );
      const kids = rawKids.map((k, kIdx) => {
        if (depth === 0) {
          const branchPal =
            HONEYCOMB_G2_PALETTES[kIdx % HONEYCOMB_G2_PALETTES.length];
          return buildHiveMeta(k, depth + 1, {
            g2Idx: kIdx,
            g3Counter: { n: 0 },
            g2Id: k.id,
            g2Color: branchPal.g2,
          });
        }
        return buildHiveMeta(k, depth + 1, {
          g2Idx: myG2Idx,
          g3Counter: ctx.g3Counter,
          g2Id: nextG2Id,
          g2Color: nextG2Col,
          g3Id: nextG3Id,
          g3Color: nextG3Col,
          g4Id: nextG4Id,
          g4Color: nextG4Col,
        });
      });

      const weight =
        kids.length > 0
          ? kids.reduce((s, c) => s + c.weight, 0) + 0.55
          : 1 + (m.spouses?.length || 0) * 0.45;

      return {
        member: m,
        depth,
        children: kids,
        weight: Math.max(1, weight),
        g2Idx: myG2Idx,
        g3Idx: myG3Idx,
        lineageG2Id: nextG2Id,
        lineageG2Color: nextG2Col,
        lineageG3Id: nextG3Id,
        lineageG3Color: nextG3Col,
        lineageG4Id: nextG4Id,
        lineageG4Color: nextG4Col,
      };
    };

    const hiveRoots: HiveMeta[] = [];
    roots.forEach((r, rIdx) => {
      if (!seenHive.has(r.id)) {
        const startDepth = Math.max(0, r.generationLevel ?? 0);
        const pal = HONEYCOMB_G2_PALETTES[rIdx % HONEYCOMB_G2_PALETTES.length];
        hiveRoots.push(
          buildHiveMeta(r, startDepth, {
            g2Idx: rIdx,
            g3Counter: { n: 0 },
            g2Id: startDepth >= 1 ? r.id : undefined,
            g2Color: startDepth >= 1 ? pal.g2 : undefined,
          })
        );
      }
    });
    members.forEach((m, mIdx) => {
      if (!seenHive.has(m.id)) {
        const startDepth = Math.max(0, m.generationLevel ?? 0);
        const pal = HONEYCOMB_G2_PALETTES[mIdx % HONEYCOMB_G2_PALETTES.length];
        hiveRoots.push(
          buildHiveMeta(m, startDepth, {
            g2Idx: mIdx,
            g3Counter: { n: 0 },
            g2Id: startDepth >= 1 ? m.id : undefined,
            g2Color: startDepth >= 1 ? pal.g2 : undefined,
          })
        );
      }
    });

    const hexSampleDim = estimateSmartNodeBoxSize(
      {
        id: 'tmp_hex',
        name: 'Nama Anggota',
        sub: '',
        x: 0,
        y: 0,
        photo: '',
        wafat: false,
        cardShape: 'hex',
      },
      displayMode,
      photoSize,
      cardScale
    );
    const hexW = hexSampleDim.w;
    const hexH = hexSampleDim.h;
    const cellMortar = Math.max(10, Math.round(compactSiblingGap * 1.1));
    const coupleHexGap = 2;

    const placedHiveNodes: InteractiveNode[] = [];
    const spawnHiveCell = (
      hm: HiveMeta,
      cx: number,
      cy: number,
      parentNodeId: string | null,
      spouseSide: 1 | -1 = 1
    ): string => {
      const m = hm.member;
      const scaleMult =
        hm.depth === 0 ? 1.18 : hm.depth === 1 ? 1.05 : hm.depth >= 4 ? 0.94 : 1.0;
      const dim = estimateSmartNodeBoxSize(
        {
          id: `tmp_h_${m.id}`,
          name: m.name,
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: m.isDeceased,
          scaleMultiplier: scaleMult,
          cardShape: 'hex',
        },
        displayMode,
        photoSize,
        cardScale
      );
      const spouses = m.spouses || [];
      const totalPairW =
        spouses.length > 0 && hm.depth === 0
          ? dim.w * (1 + spouses.length) + coupleHexGap * spouses.length
          : dim.w;
      const primaryX =
        hm.depth === 0 && spouses.length > 0
          ? Math.round(cx - totalPairW / 2)
          : Math.round(cx - dim.w / 2);
      const primaryY = Math.round(cy - dim.h / 2);

      const primaryId = `n_${m.id}`;
      const bpStop = getBpStop(hm.depth);
      const activeBorder =
        bpStop?.border ||
        hm.lineageG3Color ||
        hm.lineageG2Color ||
        (hm.depth === 0 ? '#fbbf24' : '#38bdf8');
      const activeBg =
        bpStop?.bg || (hm.depth === 0 ? '#451a03' : '#0f172a');

      placedHiveNodes.push({
        id: primaryId,
        name: m.name,
        sub: formatMemberLifeSubtitle(m),
        x: primaryX,
        y: primaryY,
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: m.generationLevel ?? hm.depth,
        scaleMultiplier: scaleMult,
        cardShape: 'hex',
        lineageG2Id: hm.lineageG2Id,
        lineageG2Color: hm.lineageG2Color,
        lineageG3Id: hm.lineageG3Id,
        lineageG3Color: hm.lineageG3Color,
        lineageG4Id: hm.lineageG4Id,
        lineageG4Color: hm.lineageG4Color,
        customBgColor: activeBg,
        customBorderColor: activeBorder,
      });

      if (parentNodeId) {
        edges.push({ from: parentNodeId, to: primaryId, type: 'child' });
      }

      spouses.forEach((sp, sIdx) => {
        const spId = `n_${m.id}_sp_${sIdx + 1}`;
        const spDir = hm.depth === 0 ? 1 : spouseSide;
        const spX = primaryX + spDir * (sIdx + 1) * (dim.w + coupleHexGap);
        placedHiveNodes.push({
          id: spId,
          name: sp.name,
          sub: `Pasangan (${
            sp.status === 'cerai_mati'
              ? 'Wafat'
              : sp.status === 'cerai_hidup'
              ? 'Cerai'
              : 'Menikah'
          })`,
          x: spX,
          y: primaryY,
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? hm.depth,
          scaleMultiplier: scaleMult,
          cardShape: 'hex',
          lineageG2Id: hm.lineageG2Id,
          lineageG2Color: hm.lineageG2Color,
          lineageG3Id: hm.lineageG3Id,
          lineageG3Color: hm.lineageG3Color,
          lineageG4Id: hm.lineageG4Id,
          lineageG4Color: hm.lineageG4Color,
          customBgColor: activeBg,
          customBorderColor: activeBorder,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      return primaryId;
    };

    if (!isRadialHive) {
      // ---------------------------------------------------------------------
      // SARANG LEBAH BERTINGKAT (TOP-DOWN HONEYCOMB):
      // Kamar G2 -> Kamar G3 -> Kantong G4 -> Baris Sarang Lebah G5 (0 tumpang)
      // ---------------------------------------------------------------------
      interface HiveTierBox {
        meta: HiveMeta;
        w: number;
        h: number;
        unitW: number;
        children: HiveTierBox[];
        g5Cols: number;
      }

      const pitchX = hexW + cellMortar;
      const g4PocketGap = Math.max(20, cellMortar + 8);
      const g3ChamberGap = Math.max(30, cellMortar * 2 + 8);
      const g2ChamberGap = Math.max(42, Math.round(hexW * 0.52));
      const rowStepY = Math.round(hexH * 0.84 + Math.max(20, cellMortar * 1.25));

      const measureHiveBox = (hm: HiveMeta): HiveTierBox => {
        const spCnt = hm.member.spouses?.length || 0;
        const unitW = hexW * (1 + spCnt) + Math.max(0, spCnt) * coupleHexGap;
        const kids = hm.children.map((ch) => measureHiveBox(ch));

        if (kids.length === 0) {
          return { meta: hm, w: unitW, h: hexH, unitW, children: [], g5Cols: 1 };
        }

        // Di tingkat G4 (depth === 3): kemas anak G5 sebagai baris sarang lebah rapat di bawah G4!
        if (hm.depth >= 3 && kids.every((k) => k.children.length === 0)) {
          const g5Cols = Math.min(3, Math.max(2, kids.length));
          const rows = Math.ceil(kids.length / g5Cols);
          const maxUnitW = Math.max(...kids.map((k) => k.unitW));
          const gridW =
            g5Cols * maxUnitW +
            (g5Cols - 1) * cellMortar +
            (rows > 1 ? Math.round(pitchX * 0.48) : 0);
          return {
            meta: hm,
            w: Math.max(unitW, gridW),
            h: hexH + rows * rowStepY,
            unitW,
            children: kids,
            g5Cols,
          };
        }

        const gap =
          hm.depth === 0
            ? g2ChamberGap
            : hm.depth === 1
            ? g3ChamberGap
            : g4PocketGap;
        const childrenW =
          kids.reduce((s, c) => s + c.w, 0) + Math.max(0, kids.length - 1) * gap;
        const maxChildH = Math.max(...kids.map((c) => c.h));

        return {
          meta: hm,
          w: Math.max(unitW, childrenW),
          h: hexH + rowStepY + maxChildH,
          unitW,
          children: kids,
          g5Cols: 1,
        };
      };

      const rootBoxes = hiveRoots.map((r) => measureHiveBox(r));
      const totalSpanW =
        rootBoxes.reduce((s, b) => s + b.w, 0) +
        Math.max(0, rootBoxes.length - 1) * g2ChamberGap;

      const placeHiveBox = (
        box: HiveTierBox,
        boxLeftX: number,
        topY: number,
        parentNodeId: string | null
      ) => {
        const spCnt = box.meta.member.spouses?.length || 0;
        const centerClusterX = boxLeftX + box.w / 2;
        const primaryCenterX =
          box.meta.depth === 0 || spCnt === 0
            ? centerClusterX
            : centerClusterX - ((box.unitW - hexW) / 2);

        const myId = spawnHiveCell(
          box.meta,
          primaryCenterX,
          topY + hexH / 2,
          parentNodeId,
          1
        );

        if (box.children.length === 0) return;

        // Baris G5+ sarang lebah bertingkat (staggered 0.48 * pitchX per baris)
        if (
          box.meta.depth >= 3 &&
          box.children.every((k) => k.children.length === 0)
        ) {
          const maxUnitW = Math.max(...box.children.map((k) => k.unitW));
          const cols = box.g5Cols;
          const rowStepX = maxUnitW + cellMortar;
          const totalRowW = cols * maxUnitW + (cols - 1) * cellMortar;
          const baseStartX = centerClusterX - totalRowW / 2;

          box.children.forEach((ch, idx) => {
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            const staggerShift = r % 2 === 1 ? Math.round(pitchX * 0.42) : 0;
            const cx = baseStartX + c * rowStepX + ch.unitW / 2 + staggerShift;
            const cy = topY + (r + 1) * rowStepY + hexH / 2;
            spawnHiveCell(ch.meta, cx, cy, myId, 1);
          });
          return;
        }

        const gap =
          box.meta.depth === 0
            ? g2ChamberGap
            : box.meta.depth === 1
            ? g3ChamberGap
            : g4PocketGap;
        const childrenTotalW =
          box.children.reduce((s, c) => s + c.w, 0) +
          Math.max(0, box.children.length - 1) * gap;
        let childCursorX = centerClusterX - childrenTotalW / 2;
        const nextY = topY + rowStepY;

        box.children.forEach((ch) => {
          placeHiveBox(ch, childCursorX, nextY, myId);
          childCursorX += ch.w + gap;
        });
      };

      let rootCursorX = Math.round((boardWidth - totalSpanW) / 2);
      const startTopY = topSafeY + 26;
      rootBoxes.forEach((rb) => {
        placeHiveBox(rb, rootCursorX, startTopY, null);
        rootCursorX += rb.w + g2ChamberGap;
      });

      return fitNodesInsideBoard(
        placedHiveNodes,
        edges,
        boardWidth,
        boardHeight,
        hexW,
        hexH,
        24,
        {
          displayMode,
          photoSize,
          cardScale,
          padX: Math.max(10, cellMortar),
          padY: Math.max(12, cellMortar),
        }
      );
    }

    // -----------------------------------------------------------------------
    // SARANG LEBAH RATU PUSAT (RADIAL HONEYCOMB):
    // G1 di Pusat Segi Enam -> G2 di 6 Sisi -> G3-G5 Mekar di Sektor Klan
    // -----------------------------------------------------------------------
    const cx = Math.round(boardWidth / 2);
    const cy = Math.round(topSafeY + usableH / 2);
    const maxRx = Math.max(190, boardWidth / 2 - hexW * 0.9 - 28);
    const maxRy = Math.max(150, usableH / 2 - hexH * 0.9 - 26);
    const aspectY = maxRy / Math.max(1, maxRx);
    const lockedHiveIds = new Set<string>();

    const placeRadialHiveBranch = (
      hm: HiveMeta,
      parentNodeId: string | null,
      anchorX: number,
      anchorY: number,
      sectorStart: number,
      sectorEnd: number,
      isQueenCenter: boolean
    ) => {
      const midAng = (sectorStart + sectorEnd) / 2;
      const spouseDir: 1 | -1 = Math.cos(midAng) >= -0.2 ? 1 : -1;

      const ringR =
        hm.depth === 1
          ? Math.max(hexW * 1.95, maxRx * 0.29)
          : hm.depth === 2
          ? Math.max(hexW * 1.45, maxRx * 0.25)
          : hm.depth === 3
          ? Math.max(hexW * 1.25, maxRx * 0.21)
          : Math.max(hexW * 1.12, hexH * 1.05);

      const nx = isQueenCenter ? cx : anchorX + Math.cos(midAng) * ringR;
      const ny = isQueenCenter
        ? cy
        : anchorY + Math.sin(midAng) * ringR * Math.max(0.76, aspectY);

      const myId = spawnHiveCell(hm, nx, ny, parentNodeId, spouseDir);
      if (isQueenCenter || hm.depth <= 1) lockedHiveIds.add(myId);

      if (hm.children.length === 0) return;

      const totalW = hm.children.reduce((s, c) => s + c.weight, 0) || 1;
      const span = sectorEnd - sectorStart;
      const effSpan =
        hm.depth >= 2
          ? Math.min(Math.PI * 0.78, Math.max(span, hm.children.length * 0.34))
          : span;
      let cursorA = hm.depth === 0 ? sectorStart : midAng - effSpan / 2;
      const eqShare = effSpan / hm.children.length;
      const blend = hm.depth === 0 ? 0.42 : 0.32;

      hm.children.forEach((ch) => {
        const wShare = (effSpan * ch.weight) / totalW;
        const share = eqShare * blend + wShare * (1 - blend);
        const pad = Math.min(share * 0.08, 0.06);
        placeRadialHiveBranch(
          ch,
          myId,
          nx,
          ny,
          cursorA + pad,
          cursorA + share - pad,
          false
        );
        cursorA += share;
      });
    };

    if (hiveRoots.length === 1) {
      placeRadialHiveBranch(
        hiveRoots[0],
        null,
        cx,
        cy,
        -Math.PI / 2,
        Math.PI * 1.5,
        true
      );
    } else {
      const totR = hiveRoots.reduce((s, r) => s + r.weight, 0) || 1;
      let cur = -Math.PI / 2;
      hiveRoots.forEach((rm) => {
        const sp = (Math.PI * 2 * rm.weight) / totR;
        placeRadialHiveBranch(rm, null, cx, cy, cur, cur + sp, false);
        cur += sp;
      });
    }

    const solvedHiveNodes = resolveCollisionsNearParents4Dir(
      placedHiveNodes,
      edges,
      boardWidth,
      boardHeight,
      displayMode,
      photoSize,
      cardScale,
      {
        minLeftX: 22,
        rightMargin: 22,
        minTopY: 64,
        bottomMargin: 24,
        padX: Math.max(14, cellMortar + 2),
        padY: Math.max(14, cellMortar + 2),
        anchorMaxGen: 2,
        lockedNodeIds: lockedHiveIds,
        radialCenter: { x: cx, y: cy },
      }
    );

    return {
      nodes: solvedHiveNodes,
      edges,
    };
  }

  // -------------------------------------------------------------------------
  // MODE 3: KLASTER KELUARGA INTI (GARIS PENDEK, PADAT 2 KOLOM ANAK)
  // -------------------------------------------------------------------------
  runCompactTreeLayout({
    wrapLeafSiblingsMaxCols: 2,
    leftMargin: 32,
    rightMargin: 32,
    rowStepY: Math.max(32, Math.round(cardH * 0.34)),
    rootGapX: Math.max(20, Math.round(cardW * 0.2)),
  });

  return fitNodesInsideBoard(
    nodes,
    edges,
    boardWidth,
    boardHeight,
    cardW,
    cardH,
    24,
    solverCommonOpts
  );
}

// ============================================================================
// SOLVER ANTI-TUMPUK 4 ARAH BERJANGKAR INDUK (KHUSUSNYA G4 & G5 AGAR DEKAT INDUK)
// Mengelompokkan pasangan sebagai 1 unit utuh lalu memindai ruang kosong terdekat
// (kanan, kiri, bawah, atas, diagonal bertingkat) di sekitar induknya.
// ============================================================================
function resolveCollisionsNearParents4Dir(
  nodes: InteractiveNode[],
  edges: InteractiveEdge[],
  boardWidth: number,
  boardHeight: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale: number,
  opts: {
    minLeftX?: number;
    rightMargin?: number;
    minTopY?: number;
    bottomMargin?: number;
    padX?: number;
    padY?: number;
    anchorMaxGen?: number;
    lockedNodeIds?: Set<string>;
    radialCenter?: { x: number; y: number };
  }
): InteractiveNode[] {
  if (nodes.length <= 1) return nodes;

  const minLeftX = opts.minLeftX ?? 20;
  const rightMargin = opts.rightMargin ?? 20;
  const minTopY = opts.minTopY ?? 64;
  const bottomMargin = opts.bottomMargin ?? 22;
  const padX = opts.padX ?? 8;
  const padY = opts.padY ?? 10;
  const anchorMaxGen = opts.anchorMaxGen ?? 2;

  const cloned = nodes.map((n) => ({ ...n }));
  const byId = new Map<string, InteractiveNode>();
  cloned.forEach((n) => byId.set(n.id, n));

  // Bangun peta pasangan (_sp_ atau edge 'couple') agar suami-istri selalu digeser sebagai 1 blok kaku
  const couplePrimaryOf = new Map<string, string>();
  const spousesByPrimary = new Map<string, InteractiveNode[]>();

  edges.forEach((e) => {
    if (e.type === 'couple' && byId.has(e.from) && byId.has(e.to)) {
      const target = byId.get(e.to)!;
      if (target.id.includes('_sp_') || !couplePrimaryOf.has(e.from)) {
        couplePrimaryOf.set(e.to, e.from);
      }
    }
  });
  cloned.forEach((n) => {
    const spMatch = n.id.match(/^(.+)_sp_\d+$/);
    if (spMatch && byId.has(spMatch[1])) {
      couplePrimaryOf.set(n.id, spMatch[1]);
    }
  });
  cloned.forEach((n) => {
    const pId = couplePrimaryOf.get(n.id);
    if (pId) {
      if (!spousesByPrimary.has(pId)) spousesByPrimary.set(pId, []);
      spousesByPrimary.get(pId)!.push(n);
    }
  });

  // Peta induk anak -> orang tua (untuk menjaga G4/G5 sedekat mungkin dengan induknya)
  const parentOf = new Map<string, string>();
  edges.forEach((e) => {
    if (e.type === 'child' && byId.has(e.from) && byId.has(e.to)) {
      parentOf.set(e.to, e.from);
    }
  });

  interface RigidUnit {
    primary: InteractiveNode;
    members: { node: InteractiveNode; dx: number; dy: number; w: number; h: number }[];
    x: number;
    y: number;
    w: number;
    h: number;
    idealX: number;
    idealY: number;
    gen: number;
    locked: boolean;
  }

  const units: RigidUnit[] = [];
  cloned.forEach((n) => {
    if (couplePrimaryOf.has(n.id)) return;
    const spList = spousesByPrimary.get(n.id) || [];
    const groupNodes = [n, ...spList];
    const sized = groupNodes.map((gn) => {
      const sz = estimateSmartNodeBoxSize(gn, displayMode, photoSize, cardScale);
      return { node: gn, x: gn.x, y: gn.y, w: sz.w, h: sz.h };
    });

    const minX = Math.min(...sized.map((s) => s.x));
    const minY = Math.min(...sized.map((s) => s.y));
    const maxX = Math.max(...sized.map((s) => s.x + s.w));
    const maxY = Math.max(...sized.map((s) => s.y + s.h));

    const unitW = maxX - minX;
    const unitH = maxY - minY;
    const clampedX = Math.max(minLeftX, Math.min(boardWidth - rightMargin - unitW, minX));
    const clampedY = Math.max(minTopY, Math.min(boardHeight - bottomMargin - unitH, minY));

    const gen = n.genLevel ?? 0;
    const isLocked = Boolean(opts.lockedNodeIds?.has(n.id));

    units.push({
      primary: n,
      members: sized.map((s) => ({
        node: s.node,
        dx: s.x - minX,
        dy: s.y - minY,
        w: s.w,
        h: s.h,
      })),
      x: clampedX,
      y: clampedY,
      w: unitW,
      h: unitH,
      idealX: clampedX,
      idealY: clampedY,
      gen,
      locked: isLocked,
    });
  });

  // Urutkan penempatan: terkunci -> generasi awal (G1..G3) -> generasi luar (G4, G5+)
  units.sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? -1 : 1;
    if (a.gen !== b.gen) return a.gen - b.gen;
    return a.idealY - b.idealY || a.idealX - b.idealX;
  });

  const placedUnits: RigidUnit[] = [];

  const getOverlapAreaAgainstPlaced = (
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    pPadX: number,
    pPadY: number
  ): number => {
    let area = 0;
    for (let i = 0; i < placedUnits.length; i++) {
      const pu = placedUnits[i];
      const ox =
        Math.min(cx + cw + pPadX, pu.x + pu.w) - Math.max(cx - pPadX, pu.x);
      if (ox <= 0) continue;
      const oy =
        Math.min(cy + ch + pPadY, pu.y + pu.h) - Math.max(cy - pPadY, pu.y);
      if (oy > 0) {
        area += ox * oy;
      }
    }
    return area;
  };

  for (const unit of units) {
    const maxAllowedX = Math.max(minLeftX, boardWidth - rightMargin - unit.w);
    const maxAllowedY = Math.max(minTopY, boardHeight - bottomMargin - unit.h);

    if (unit.locked) {
      placedUnits.push(unit);
      continue;
    }

    const initialOverlap = getOverlapAreaAgainstPlaced(
      unit.x,
      unit.y,
      unit.w,
      unit.h,
      padX,
      padY
    );

    if (initialOverlap <= 0) {
      placedUnits.push(unit);
      continue;
    }

    // Tentukan jangkar induk bila ada agar G4/G5 yang digeser tetap dekat induknya
    const parentId = parentOf.get(unit.primary.id);
    const parentNode = parentId ? byId.get(parentId) : undefined;
    const parentSz = parentNode
      ? estimateSmartNodeBoxSize(parentNode, displayMode, photoSize, cardScale)
      : undefined;
    const anchorX =
      parentNode && parentSz
        ? parentNode.x + parentSz.w / 2 - unit.w / 2
        : unit.idealX;
    const anchorY =
      parentNode && parentSz
        ? parentNode.y + parentSz.h / 2 - unit.h / 2
        : unit.idealY;

    const stepX = Math.max(18, Math.round(Math.min(unit.w, 120) * 0.34));
    const stepY = Math.max(16, Math.round(Math.min(unit.h, 120) * 0.42));

    let bestX = unit.x;
    let bestY = unit.y;
    let foundClean = false;
    let bestCleanScore = Infinity;
    let bestFallbackOverlap = initialOverlap;
    let bestFallbackScore = Infinity;

    // Pindai 4 arah & cincin spiral di sekitar posisi ideal + posisi induk (bawah, kanan, kiri, atas, diagonal)
    const seeds: Array<{ sx: number; sy: number }> = [{ sx: unit.idealX, sy: unit.idealY }];
    if (Math.hypot(anchorX - unit.idealX, anchorY - unit.idealY) > 24) {
      seeds.push({
        sx: Math.round((unit.idealX + anchorX) / 2),
        sy: Math.round((unit.idealY + anchorY) / 2),
      });
    }

    const maxRing = unit.gen > anchorMaxGen ? 12 : 7;
    for (const seed of seeds) {
      for (let ring = 1; ring <= maxRing; ring++) {
        const offsets: Array<[number, number]> = [];
        for (let r = -ring; r <= ring; r++) {
          for (let c = -ring; c <= ring; c++) {
            if (Math.max(Math.abs(r), Math.abs(c)) !== ring) continue;
            offsets.push([c * stepX, r * stepY]);
          }
        }
        // Tambahkan geseran tepat seukuran tinggi/lebar kartu untuk menukar posisi langsung di ruang kosong sebelah
        if (ring === 1) {
          offsets.push(
            [unit.w + padX, 0],
            [-(unit.w + padX), 0],
            [0, unit.h + padY],
            [0, -(unit.h + padY)],
            [Math.round(unit.w * 0.6), unit.h + padY],
            [-Math.round(unit.w * 0.6), unit.h + padY],
            [Math.round(unit.w * 0.6), -(unit.h + padY)],
            [-Math.round(unit.w * 0.6), -(unit.h + padY)]
          );
        }

        for (const [ox, oy] of offsets) {
          const cx = Math.max(minLeftX, Math.min(maxAllowedX, Math.round(seed.sx + ox)));
          const cy = Math.max(minTopY, Math.min(maxAllowedY, Math.round(seed.sy + oy)));

          const overlapArea = getOverlapAreaAgainstPlaced(
            cx,
            cy,
            unit.w,
            unit.h,
            padX,
            padY
          );

          const distIdeal = Math.hypot(cx - unit.idealX, cy - unit.idealY);
          const distParent = Math.hypot(cx - anchorX, cy - anchorY);
          const distRadial = opts.radialCenter
            ? Math.abs(
                Math.hypot(cx + unit.w / 2 - opts.radialCenter.x, cy + unit.h / 2 - opts.radialCenter.y) -
                  Math.hypot(
                    unit.idealX + unit.w / 2 - opts.radialCenter.x,
                    unit.idealY + unit.h / 2 - opts.radialCenter.y
                  )
              ) * 0.3
            : 0;
          const score = distIdeal + 0.45 * distParent + distRadial;

          if (overlapArea <= 0) {
            if (!foundClean || score < bestCleanScore) {
              foundClean = true;
              bestCleanScore = score;
              bestX = cx;
              bestY = cy;
            }
          } else if (!foundClean) {
            if (
              overlapArea < bestFallbackOverlap * 0.96 ||
              (Math.abs(overlapArea - bestFallbackOverlap) < 12 && score < bestFallbackScore)
            ) {
              bestFallbackOverlap = overlapArea;
              bestFallbackScore = score;
              bestX = cx;
              bestY = cy;
            }
          }
        }
        if (foundClean && ring >= 2) break;
      }
      if (foundClean) break;
    }

    unit.x = bestX;
    unit.y = bestY;
    placedUnits.push(unit);
  }

  // Sentuhan akhir ringan bila kanvas sangat padat: dorong pasangan yang masih bersinggungan halus
  for (let pass = 0; pass < 6; pass++) {
    let anyMoved = false;
    for (let i = 0; i < placedUnits.length; i++) {
      for (let j = i + 1; j < placedUnits.length; j++) {
        const a = placedUnits[i];
        const b = placedUnits[j];
        const ox = Math.min(a.x + a.w + 4, b.x + b.w) - Math.max(a.x, b.x - 4);
        const oy = Math.min(a.y + a.h + 4, b.y + b.h) - Math.max(a.y, b.y - 4);
        if (ox > 0 && oy > 0) {
          const mover = b.locked ? a : b;
          const anchor = mover === b ? a : b;
          if (mover.locked) continue;
          const maxMX = Math.max(minLeftX, boardWidth - rightMargin - mover.w);
          const maxMY = Math.max(minTopY, boardHeight - bottomMargin - mover.h);
          if (ox < oy) {
            const dir = mover.x + mover.w / 2 >= anchor.x + anchor.w / 2 ? 1 : -1;
            mover.x = Math.max(minLeftX, Math.min(maxMX, Math.round(mover.x + dir * (ox * 0.7 + 3))));
          } else {
            const dir = mover.y + mover.h / 2 >= anchor.y + anchor.h / 2 ? 1 : -1;
            mover.y = Math.max(minTopY, Math.min(maxMY, Math.round(mover.y + dir * (oy * 0.7 + 3))));
          }
          anyMoved = true;
        }
      }
    }
    if (!anyMoved) break;
  }

  // Terapkan koordinat final tiap unit kembali ke semua node anggotanya (suami-istri tetap menempel presisi!)
  placedUnits.forEach((u) => {
    u.members.forEach((m) => {
      m.node.x = Math.round(u.x + m.dx);
      m.node.y = Math.round(u.y + m.dy);
    });
  });

  return cloned;
}

// Menjaga seluruh pohon tetap di dalam batas kertas lalu menyelaraskan tabrakan 4-arah agar G4/G5 tidak menumpuk!
function fitNodesInsideBoard(
  nodes: InteractiveNode[],
  edges: InteractiveEdge[],
  boardWidth: number,
  boardHeight: number,
  cardW: number,
  cardH: number,
  minLeftX = 20,
  solverOpts?: {
    displayMode: CardDisplayMode;
    photoSize: PhotoFrameSize;
    cardScale: number;
    padX?: number;
    padY?: number;
  }
): { nodes: InteractiveNode[]; edges: InteractiveEdge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const minBoundX = minLeftX;
  const maxBoundX = Math.max(minBoundX + 10, boardWidth - cardW - 20);
  const minBoundY = 66;
  const maxBoundY = Math.max(minBoundY + 10, boardHeight - cardH - 22);

  const curMinX = Math.min(...nodes.map((n) => n.x));
  const curMaxX = Math.max(...nodes.map((n) => n.x));
  const curMinY = Math.min(...nodes.map((n) => n.y));
  const curMaxY = Math.max(...nodes.map((n) => n.y));

  const curSpanX = curMaxX - curMinX;
  const curSpanY = curMaxY - curMinY;
  const availSpanX = Math.max(10, maxBoundX - minBoundX);
  const availSpanY = Math.max(10, maxBoundY - minBoundY);

  // Kompres halus bila melebihi kertas (maksimal batas lembut, lalu rapikan benturan dengan solver 4-arah!)
  const scaleX = curSpanX > availSpanX && curSpanX > 0 ? availSpanX / curSpanX : 1;
  const scaleY = curSpanY > availSpanY && curSpanY > 0 ? availSpanY / curSpanY : 1;

  const renderedSpanX = curSpanX * scaleX + cardW;
  const centerOffsetX =
    scaleX === 1 && renderedSpanX < boardWidth - minLeftX - 24
      ? Math.max(minBoundX, (boardWidth - renderedSpanX) / 2)
      : minBoundX;

  const adjusted = nodes.map((n) => {
    const mappedX =
      scaleX === 1
        ? centerOffsetX + (n.x - curMinX)
        : minBoundX + (n.x - curMinX) * scaleX;
    const mappedY =
      scaleY === 1
        ? Math.max(minBoundY, Math.min(maxBoundY, n.y))
        : minBoundY + (n.y - curMinY) * scaleY;

    return {
      ...n,
      x: Math.max(minBoundX, Math.min(maxBoundX, Math.round(mappedX))),
      y: Math.max(minBoundY, Math.min(maxBoundY, Math.round(mappedY))),
    };
  });

  if (solverOpts) {
    const cleanNodes = resolveCollisionsNearParents4Dir(
      adjusted,
      edges,
      boardWidth,
      boardHeight,
      solverOpts.displayMode,
      solverOpts.photoSize,
      solverOpts.cardScale,
      {
        minLeftX,
        rightMargin: 20,
        minTopY: 64,
        bottomMargin: 22,
        padX: solverOpts.padX ?? 8,
        padY: solverOpts.padY ?? 10,
        anchorMaxGen: 2,
      }
    );
    return { nodes: cleanNodes, edges };
  }

  return { nodes: adjusted, edges };
}

/**
 * Pertumbuhan Cabang Inkremental (0 Token AI):
 * Saat pengguna menambah/mengedit anggota di 1 cabang (mis. G3–G5) setelah desain terbentuk,
 * posisi semua kartu lain yang sudah rapi/diedit TIDAK diacak ulang — hanya node baru yang
 * ditumbuhkan menempel rapi di dekat induknya mengikuti gaya preset aktif.
 */
export function applyIncrementalBranchUpdate(params: {
  existingNodes: InteractiveNode[];
  existingEdges: InteractiveEdge[];
  members: FamilyMember[];
  presetId?: SmartPresetId;
  boardWidth: number;
  boardHeight: number;
  displayMode: CardDisplayMode;
  photoSize: PhotoFrameSize;
  cardScale: number;
  aiBlueprint?: NasabAiBlueprint | null;
}): {
  nodes: InteractiveNode[];
  edges: InteractiveEdge[];
  addedCount: number;
  updatedCount: number;
} {
  const {
    existingNodes,
    existingEdges,
    members,
    presetId,
    boardWidth,
    boardHeight,
    displayMode,
    photoSize,
    cardScale,
    aiBlueprint,
  } = params;

  const memberById = new Map<string, FamilyMember>();
  members.forEach((m) => memberById.set(m.id, m));

  const spouseKey = (memberId: string, spIdx: number) => `n_${memberId}_sp_${spIdx + 1}`;
  const altSpouseKey = (memberId: string, spIdx: number) => `node_${memberId}_sp_${spIdx}`;

  // 1. Update text/photo/metadata of surviving nodes without touching their (x, y) or rotation
  let updatedCount = 0;
  const survivingIds = new Set<string>();
  const nextNodes: InteractiveNode[] = [];

  existingNodes.forEach((n) => {
    // Handle merged modular containers defensively by keeping intact if head exists
    if (n.mergedMembers && n.mergedMembers.length >= 2) {
      nextNodes.push({ ...n });
      survivingIds.add(n.id);
      return;
    }

    if (n.memberId) {
      const m = memberById.get(n.memberId);
      if (!m) return; // removed from table
      survivingIds.add(n.id);
      const nextSub = formatMemberLifeSubtitle(m);
      if (
        n.name !== m.name ||
        n.sub !== nextSub ||
        n.photo !== (m.photoUrl || '') ||
        n.wafat !== m.isDeceased ||
        n.gender !== m.gender
      ) {
        updatedCount++;
      }
      nextNodes.push({
        ...n,
        name: m.name,
        sub: nextSub,
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        genLevel: m.generationLevel ?? n.genLevel,
      });
      return;
    }

    const spMatch = n.id.match(/^(?:n|node)_(.+)_sp_(\d+)$/);
    if (spMatch) {
      const primaryMemberId = spMatch[1];
      const spRawNum = Number(spMatch[2]);
      const m = memberById.get(primaryMemberId);
      if (!m) return;
      const spIdx = n.id.startsWith('n_') ? spRawNum - 1 : spRawNum;
      const sp = m.spouses?.[spIdx];
      if (!sp) return;
      survivingIds.add(n.id);
      nextNodes.push({
        ...n,
        name: sp.name,
        wafat: sp.status === 'cerai_mati',
        gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : n.gender,
        genLevel: m.generationLevel ?? n.genLevel,
      });
      return;
    }

    // Manual custom node not tied to table member -> keep
    survivingIds.add(n.id);
    nextNodes.push({ ...n });
  });

  const nextEdges: InteractiveEdge[] = existingEdges
    .filter((e) => survivingIds.has(e.from) && survivingIds.has(e.to))
    .map((e) => ({ ...e }));

  const presentMemberIds = new Set<string>();
  nextNodes.forEach((n) => {
    if (n.memberId) presentMemberIds.add(n.memberId);
    n.mergedMembers?.forEach((mm) => {
      if (mm.memberId) presentMemberIds.add(mm.memberId);
    });
  });

  const nodeByMemberId = new Map<string, InteractiveNode>();
  nextNodes.forEach((n) => {
    if (n.memberId) nodeByMemberId.set(n.memberId, n);
  });

  const occupied: Array<{ x: number; y: number; w: number; h: number }> = nextNodes.map((n) => {
    const sz = estimateSmartNodeBoxSize(n, displayMode, photoSize, cardScale);
    return { x: n.x, y: n.y, w: sz.w, h: sz.h };
  });

  const overlapsAny = (x: number, y: number, w: number, h: number, pad = 10): boolean => {
    if (x < 16 || y < 56 || x + w > boardWidth - 16 || y + h > boardHeight - 16) return true;
    for (let i = 0; i < occupied.length; i++) {
      const o = occupied[i];
      if (
        x < o.x + o.w + pad &&
        x + w + pad > o.x &&
        y < o.y + o.h + pad &&
        y + h + pad > o.y
      ) {
        return true;
      }
    }
    return false;
  };

  const findNearestBranchSpot = (
    prefX: number,
    prefY: number,
    w: number,
    h: number,
    outDirX: number,
    outDirY: number
  ): { x: number; y: number } => {
    const clampX = (v: number) => Math.max(18, Math.min(boardWidth - 18 - w, Math.round(v)));
    const clampY = (v: number) => Math.max(60, Math.min(boardHeight - 18 - h, Math.round(v)));
    const baseX = clampX(prefX);
    const baseY = clampY(prefY);
    if (!overlapsAny(baseX, baseY, w, h, 8)) return { x: baseX, y: baseY };

    const stepX = Math.max(24, Math.round(w * 0.52));
    const stepY = Math.max(24, Math.round(h * 0.52));
    let best = { x: baseX, y: baseY };
    let bestScore = Infinity;

    for (let ring = 1; ring <= 9; ring++) {
      for (let rx = -ring; rx <= ring; rx++) {
        for (let ry = -ring; ry <= ring; ry++) {
          if (Math.max(Math.abs(rx), Math.abs(ry)) !== ring) continue;
          const cx = clampX(baseX + rx * stepX);
          const cy = clampY(baseY + ry * stepY);
          if (!overlapsAny(cx, cy, w, h, 8)) {
            const dx = cx - baseX;
            const dy = cy - baseY;
            const alignmentPenalty = dx * outDirX + dy * outDirY < 0 ? 35 : 0;
            const score = Math.hypot(dx, dy) + alignmentPenalty;
            if (score < bestScore) {
              bestScore = score;
              best = { x: cx, y: cy };
            }
          }
        }
      }
      if (bestScore < Infinity) return best;
    }
    return best;
  };

  const getBpStop = (gen: number) => {
    if (!aiBlueprint?.genColors || aiBlueprint.genColors.length === 0) return undefined;
    const idx = Math.max(0, Math.min(aiBlueprint.genColors.length - 1, Math.floor(gen)));
    return aiBlueprint.genColors[idx];
  };

  // Check missing spouses on existing members too
  let addedCount = 0;
  const existingIdSet = new Set(nextNodes.map((n) => n.id));
  members.forEach((m) => {
    const primary = nodeByMemberId.get(m.id);
    if (!primary || !m.spouses?.length) return;
    const pDim = estimateSmartNodeBoxSize(primary, displayMode, photoSize, cardScale);
    m.spouses.forEach((sp, sIdx) => {
      const k1 = spouseKey(m.id, sIdx);
      const k2 = altSpouseKey(m.id, sIdx);
      if (existingIdSet.has(k1) || existingIdSet.has(k2)) return;
      const spot = findNearestBranchSpot(
        primary.x + (sIdx + 1) * (pDim.w + 2),
        primary.y,
        pDim.w,
        pDim.h,
        1,
        0
      );
      const spNode: InteractiveNode = {
        id: k1,
        name: sp.name,
        sub: `Pasangan (${sp.status === 'cerai_mati' ? 'Wafat' : sp.status === 'cerai_hidup' ? 'Cerai' : 'Menikah'})`,
        x: spot.x,
        y: spot.y,
        photo: '',
        wafat: sp.status === 'cerai_mati',
        gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
        genLevel: m.generationLevel ?? primary.genLevel,
        scaleMultiplier: primary.scaleMultiplier,
        cardShape: primary.cardShape,
        leafAngleDeg: primary.leafAngleDeg,
        leafTone: primary.leafTone,
        customBgColor: primary.customBgColor,
        customBorderColor: primary.customBorderColor,
      };
      nextNodes.push(spNode);
      existingIdSet.add(k1);
      occupied.push({ x: spot.x, y: spot.y, w: pDim.w, h: pDim.h });
      nextEdges.push({ from: primary.id, to: k1, type: 'couple' });
      addedCount++;
    });
  });

  // 2. Grow newly added members near their parent node on the active branch
  const missingMembers = members
    .filter((m) => !presentMemberIds.has(m.id))
    .sort(
      (a, b) =>
        (a.generationLevel ?? 0) - (b.generationLevel ?? 0) ||
        (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
    );

  const boardCx = boardWidth / 2;
  const boardCy = boardHeight / 2;

  missingMembers.forEach((m, mIdx) => {
    const gen = m.generationLevel ?? 0;
    const pNode = m.parentId ? nodeByMemberId.get(m.parentId) : undefined;
    const bpStop = getBpStop(gen);

    const cardShape: InteractiveNode['cardShape'] =
      aiBlueprint?.cardShape ||
      (presetId === 'teratai_mekar'
        ? 'petal'
        : presetId === 'sarang_lebah_turun' ||
          presetId === 'sarang_lebah_pusat' ||
          presetId === 'molekul_organik'
        ? 'hex'
        : presetId === 'pohon_hayat_besar' && gen >= 2
        ? 'leaf'
        : 'rect');

    const scaleMult =
      presetId === 'teratai_mekar' ||
      presetId === 'sarang_lebah_turun' ||
      presetId === 'sarang_lebah_pusat' ||
      presetId === 'molekul_organik'
        ? gen === 0
          ? 1.18
          : gen === 1
          ? 1.06
          : gen >= 4
          ? 0.9
          : 1
        : 1;

    const estNode: InteractiveNode = {
      id: `n_${m.id}`,
      name: m.name,
      sub: formatMemberLifeSubtitle(m),
      x: 0,
      y: 0,
      photo: m.photoUrl || '',
      wafat: m.isDeceased,
      scaleMultiplier: scaleMult,
      cardShape,
    };
    const dim = estimateSmartNodeBoxSize(estNode, displayMode, photoSize, cardScale);

    // Count existing siblings under the same parent to stagger outward fan cleanly
    const siblingCount = pNode
      ? nextEdges.filter((e) => e.from === pNode.id && e.type === 'child').length
      : mIdx;

    let prefX = boardCx - dim.w / 2;
    let prefY = 80 + gen * (dim.h + 44);
    let outX = 0;
    let outY = 1;
    let leafDeg: number | undefined;
    let lotusRole: InteractiveNode['lotusRole'];

    if (pNode) {
      const pDim = estimateSmartNodeBoxSize(pNode, displayMode, photoSize, cardScale);
      const pcx = pNode.x + pDim.w / 2;
      const pcy = pNode.y + pDim.h / 2;

      if (presetId === 'pohon_hayat_besar') {
        const wing: -1 | 1 = pNode.treeWing ?? (pcx >= boardCx ? 1 : -1);
        const fan = (siblingCount % 5) - 2;
        const baseAng = wing === 1 ? -0.35 + fan * 0.42 : Math.PI + 0.35 - fan * 0.42;
        const dist = Math.max(dim.w * 1.12, dim.h * 1.15);
        outX = Math.cos(baseAng);
        outY = Math.sin(baseAng);
        prefX = pcx + outX * dist - dim.w / 2;
        prefY = pcy + outY * dist - dim.h / 2;
        leafDeg = wing * (32 + ((siblingCount * 29) % 85));
      } else if (
        presetId === 'teratai_mekar' ||
        presetId === 'sarang_lebah_pusat' ||
        presetId === 'molekul_organik'
      ) {
        const radialAng = Math.atan2(pcy - boardCy, pcx - boardCx);
        const fanOffset = ((siblingCount % 2 === 0 ? 1 : -1) * Math.ceil(siblingCount / 2)) * 0.38;
        const ang = (Math.hypot(pcx - boardCx, pcy - boardCy) < 20 ? -Math.PI / 2 : radialAng) + fanOffset;
        const dist = Math.max(dim.w * 1.15, dim.h * 1.15);
        outX = Math.cos(ang);
        outY = Math.sin(ang);
        prefX = pcx + outX * dist - dim.w / 2;
        prefY = pcy + outY * dist - dim.h / 2;
        if (presetId === 'teratai_mekar') {
          lotusRole = gen <= 2 ? 'flower_center' : gen === 3 ? 'petal_inner' : 'petal_outer';
          leafDeg =
            lotusRole === 'flower_center'
              ? 0
              : Math.round((((ang * 180) / Math.PI + 90) % 360) * 10) / 10;
        }
      } else {
        // Sarang lebah turun & pohon vertikal: tempatkan rapi di bawah induk dengan selisih comb
        const colShift = (siblingCount % 3) - 1;
        prefX =
          pNode.x +
          colShift * (dim.w + 14) +
          (presetId === 'sarang_lebah_turun' && siblingCount % 2 === 1
            ? Math.round(dim.w * 0.48)
            : 0);
        prefY = pNode.y + pDim.h + (presetId === 'sarang_lebah_turun' ? 18 : 44);
      }
    }

    const spot = findNearestBranchSpot(prefX, prefY, dim.w, dim.h, outX, outY);
    const newId = `n_${m.id}`;
    const newNode: InteractiveNode = {
      id: newId,
      memberId: m.id,
      name: m.name,
      sub: formatMemberLifeSubtitle(m),
      x: spot.x,
      y: spot.y,
      photo: m.photoUrl || '',
      wafat: m.isDeceased,
      gender: m.gender,
      genLevel: m.generationLevel ?? gen,
      scaleMultiplier: scaleMult,
      cardShape,
      lotusRole,
      lineageG2Id: pNode?.lineageG2Id || (gen === 1 ? m.id : undefined),
      lineageG2Color: pNode?.lineageG2Color,
      lineageG3Id: pNode?.lineageG3Id || (gen === 2 ? m.id : undefined),
      lineageG3Color: pNode?.lineageG3Color,
      lineageG4Id: pNode?.lineageG4Id || (gen === 3 ? m.id : undefined),
      lineageG4Color: pNode?.lineageG4Color,
      leafAngleDeg: leafDeg,
      leafTone:
        presetId === 'pohon_hayat_besar'
          ? gen <= 2
            ? 'dark'
            : gen === 3
            ? 'medium'
            : 'light'
          : undefined,
      treeWing:
        presetId === 'pohon_hayat_besar'
          ? pNode?.treeWing ?? (spot.x + dim.w / 2 >= boardCx ? 1 : -1)
          : undefined,
      customBgColor: bpStop?.bg || pNode?.customBgColor,
      customBorderColor: bpStop?.border || pNode?.customBorderColor,
    };

    nextNodes.push(newNode);
    nodeByMemberId.set(m.id, newNode);
    existingIdSet.add(newId);
    occupied.push({ x: spot.x, y: spot.y, w: dim.w, h: dim.h });
    addedCount++;

    if (pNode) {
      nextEdges.push({ from: pNode.id, to: newId, type: 'child' });
    }

    (m.spouses || []).forEach((sp, sIdx) => {
      const spId = spouseKey(m.id, sIdx);
      const spSpot = findNearestBranchSpot(
        spot.x + (sIdx + 1) * (dim.w + 2),
        spot.y,
        dim.w,
        dim.h,
        1,
        0
      );
      nextNodes.push({
        id: spId,
        name: sp.name,
        sub: `Pasangan (${sp.status === 'cerai_mati' ? 'Wafat' : sp.status === 'cerai_hidup' ? 'Cerai' : 'Menikah'})`,
        x: spSpot.x,
        y: spSpot.y,
        photo: '',
        wafat: sp.status === 'cerai_mati',
        gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
        genLevel: m.generationLevel ?? gen,
        scaleMultiplier: scaleMult,
        cardShape,
        leafAngleDeg: leafDeg,
        leafTone: newNode.leafTone,
        customBgColor: bpStop?.bg,
        customBorderColor: bpStop?.border,
      });
      existingIdSet.add(spId);
      occupied.push({ x: spSpot.x, y: spSpot.y, w: dim.w, h: dim.h });
      nextEdges.push({ from: newId, to: spId, type: 'couple' });
      addedCount++;
    });
  });

  return {
    nodes: nextNodes,
    edges: nextEdges,
    addedCount,
    updatedCount,
  };
}
