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
  LineRoutingTopology,
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
  | 'tetris_silsilah'
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
  isLocked?: boolean;
  description: string;
  recommendedTheme: CanvasTheme;
  recommendedBg: CanvasBackground;
  recommendedOrientation: GridPaperOrientation;
  recommendedCardMode: CardDisplayMode;
  recommendedPhotoSize: PhotoFrameSize;
  recommendedLineStyle?: ConnectorLineStyle;
  recommendedLineThicknessMode?: 'uniform' | 'tree_taper';
  recommendedRoutingTopology?: LineRoutingTopology;
  recommendedShowArrows?: boolean;
  recommendedShowEndpointDots?: boolean;
  recommendedShowLineDots?: boolean;
  recommendedShowGenGuides?: boolean;
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

  if (node.cardShape === 'hex') {
    if (displayMode === 'photo_name_unified') {
      const w = Math.max(54, Math.round(Math.max(pDim.w + 18, 74) * effScale));
      const h = Math.max(62, Math.round(w * 1.15));
      return { w, h };
    }
    if (displayMode === 'name_only') {
      const w = Math.max(66, Math.round(88 * effScale));
      const h = Math.max(76, Math.round(w * 1.15));
      return { w, h };
    }
    const u = getUniformSubCardSize(displayMode, photoSize, effScale);
    return { w: u.w, h: Math.max(u.h, Math.round(u.w * 1.15)) };
  }

  if (displayMode === 'photo_name_unified') {
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
    effPreset === 'tetris_silsilah'
      ? totalCards >= 95
        ? 0.32
        : totalCards >= 60
        ? 0.36
        : totalCards >= 32
        ? 0.42
        : 0.5
      : totalCards >= 85
      ? 0.35
      : totalCards >= 45
      ? 0.42
      : totalCards >= 24
      ? 0.48
      : 0.55;
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
        'tetris_silsilah',
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
        'tetris_silsilah',
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
          : pid === 'tetris_silsilah'
          ? 'photo_name'
          : displayMode;
      const effPhoto = pid === 'tetris_silsilah' ? 'kotak' : photoSize;
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
      const lockedPenalty = preset.isLocked ? -100000 : 0;
      const score =
        cleanBonus - overlapPenalty + scaleScore + balanceScore + presetBonus + lockedPenalty;

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
  const firstUnlocked = evaluated.find((item) => !item.preset.isLocked);
  if (firstUnlocked) {
    firstUnlocked.isTopPick = true;
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'direct',
    recommendedShowArrows: false,
    recommendedShowEndpointDots: false,
    recommendedShowLineDots: false,
    recommendedShowGenGuides: true,
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'direct',
    recommendedShowArrows: false,
    recommendedShowEndpointDots: false,
    recommendedShowLineDots: false,
    recommendedShowGenGuides: true,
    recommendedGuideMode: 'modular_center',
    recommendedGenGradient: 'ocean_blue',
  },
  {
    id: 'tetris_silsilah',
    title: 'Tetris Silsilah (Blok Keluarga Inti · Tanpa Garis)',
    subtitle: 'G1–G2 1 Warna Gradasi • G3–G5 Warna Sama per Cabang • Blok Keluarga 1–4+ Kartu',
    badge: 'Tetris',
    category: 'modular',
    isLocked: true,
    description:
      'Setiap keluarga inti (orang tua, pasangan, dan anak) membentuk blok Tetris rapat tersendiri (1 kartu tunggal hingga 4+ kartu berdempetan). G1–G2 memakai satu gradasi hangat, sedangkan tiap cabang G3–G5 memakai satu warna khas yang berbeda antar cabang G3.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name',
    recommendedPhotoSize: 'kotak',
    recommendedLineStyle: 'none',
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'direct',
    recommendedShowArrows: false,
    recommendedShowEndpointDots: false,
    recommendedShowLineDots: false,
    recommendedShowGenGuides: false,
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'none',
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
    recommendedGuideMode: 'orbit_rings',
    recommendedGenGradient: 'violet_dusk',
  },
  {
    id: 'sarang_lebah_turun',
    title: 'Sarang Lebah Bertingkat (Kisi Sejati · Pembatas Celah)',
    subtitle: 'Segi Enam Kisi Rata · Ruang Kosong G1–G2 · Celah Terhubung & Sekat G4–G5',
    badge: 'Lebah Turun',
    category: 'modular',
    description:
      'Kisi sarang lebah segi enam seragam dari G1 ke bawah tanpa garis penghubung: G1 dan G2 dikelilingi ruang kosong polos, terhubung jalur warna celah hingga kelompok G3 yang memisahkan tiap sub-keluarga G4–G5 dengan warna berbeda.',
    recommendedTheme: 'light',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name_unified',
    recommendedPhotoSize: 'bulat',
    recommendedLineStyle: 'none',
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'direct',
    recommendedShowArrows: false,
    recommendedShowEndpointDots: false,
    recommendedShowLineDots: false,
    recommendedShowGenGuides: false,
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'none',
  },
  {
    id: 'sarang_lebah_pusat',
    title: 'Sarang Lebah Ratu Pusat (Kisi 360° · Pembatas Celah)',
    subtitle: 'G1 Pusat · Ruang Kosong G1–G2 · Celah Terhubung & Sekat G4–G5',
    badge: 'Lebah Pusat',
    category: 'orbit',
    description:
      'G1 di pusat kisi segi enam seragam dikelilingi ruang kosong polos, memancar ke G2 dan kelompok G3 dengan jalur warna celah terhubung serta pembatas warna berbeda untuk tiap kelompok G4–G5.',
    recommendedTheme: 'light',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name_unified',
    recommendedPhotoSize: 'bulat',
    recommendedLineStyle: 'none',
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'direct',
    recommendedShowArrows: false,
    recommendedShowEndpointDots: false,
    recommendedShowLineDots: false,
    recommendedShowGenGuides: false,
    recommendedGuideMode: 'orbit_rings',
    recommendedGenGradient: 'none',
  },
  {
    id: 'teratai_mekar',
    title: 'Kolam Teratai Mekar (Mandala 360° · Daun G4–G5)',
    subtitle: 'G1–G2 Mahkota Pusat · G3 Cincin Bunga 2 Lapis · Daun Bulat G4–G5',
    badge: 'Teratai Kolam',
    category: 'orbit',
    description:
      'Mandala kolam teratai 360°: G1–G2 mekar emas di pusat riak air, G3 membentuk dua cincin bunga berwarna merata di sekelilingnya dengan garis halus antar bunga, sementara G4–G5 menjadi daun teratai bulat menempel mengelilingi bunganya.',
    recommendedTheme: 'light',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name_unified',
    recommendedPhotoSize: 'bulat',
    recommendedLineStyle: 'curved',
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'direct',
    recommendedShowArrows: false,
    recommendedShowEndpointDots: false,
    recommendedShowLineDots: false,
    recommendedShowGenGuides: false,
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'none',
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'none',
  },
  {
    id: 'pohon_hayat_besar',
    title: 'Pohon Besar Petai (Kokoh · Daun Menyirip)',
    subtitle: 'G1–G2 Kakak Bawah➔Bungsu Atas • Dahan G3 Ganjil Kiri/Genap Kanan • Ranting G4–G5 Menyirip',
    badge: 'Pohon Petai',
    category: 'klasik',
    isLocked: true,
    description:
      'Pohon besar berbatang & berakar kokoh seperti pohon petai: G2 tersusun dari kakak (bawah) ke bungsu (atas), dahan G3 bercabang ganjil ke kiri & genap ke kanan (kakak dekat G2, bungsu di ujung), serta ranting kecil G4–G5 bersirip ganjil bawah & genap atas.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'photo_name',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'curved',
    recommendedLineThicknessMode: 'tree_taper',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: false,
    recommendedShowLineDots: false,
    recommendedShowGenGuides: false,
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'none',
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'none',
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
    recommendedLineThicknessMode: 'uniform',
    recommendedRoutingTopology: 'sibling_chain_all',
    recommendedShowArrows: true,
    recommendedShowEndpointDots: true,
    recommendedShowLineDots: true,
    recommendedShowGenGuides: true,
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'none',
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
          photo: sp.photoUrl || '',
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
  // MODE POHON BESAR PETAI (KOKOH · DAUN MENYIRIP INDIGOFERA)
  // - G1 di pangkal batang & akar kokoh; G2 di batang: Kakak (bawah) ➔ Bungsu (atas)
  // - Dahan G3 dari setiap G2: Ganjil (1,3,5) Kiri & Genap (2,4,6) Kanan; Kakak dekat G2 ➔ Bungsu ke ujung dahan
  // - Ranting kecil G4 & daun G5+ menyirip (petai/indigofera): G4 Ganjil sisi BAWAH dahan & Genap sisi ATAS dahan
  // -------------------------------------------------------------------------
  if (presetId === 'pohon_hayat_besar') {
    const trunkX = Math.round(boardWidth / 2);
    const minLeftBound = 22;
    const maxRightBound = Math.max(minLeftBound + 40, boardWidth - 22 - cardW);
    const minTopBound = 64;
    const rootFootMargin = Math.max(50, Math.min(76, Math.round(boardHeight * 0.068)));
    const trunkBaseY = boardHeight - rootFootMargin;
    const trunkHeight = Math.max(250, Math.round(boardHeight * 0.77));
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
        Math.min(boardHeight - 22 - cardH, Math.round(y))
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
        cardShape:
          optsNode?.cardShape ??
          (gen >= 2
            ? aiBlueprint?.cardShape && aiBlueprint.cardShape !== 'hex'
              ? aiBlueprint.cardShape
              : 'leaf'
            : 'rect'),
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
          photo: sp.photoUrl || '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? gen,
          cardShape:
            optsNode?.cardShape ??
            (gen >= 2
              ? aiBlueprint?.cardShape && aiBlueprint.cardShape !== 'hex'
                ? aiBlueprint.cardShape
                : 'leaf'
              : 'rect'),
          leafAngleDeg:
            optsNode?.leafAngleDeg !== undefined
              ? optsNode.leafAngleDeg + (spDir > 0 ? 10 : -10)
              : undefined,
          leafTone: optsNode?.leafTone,
          customBgColor: bpStop0?.bg,
          customBorderColor: bpStop0?.border,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      return primaryId;
    };

    // 1. G1 di pangkal bawah batang & akar kokoh
    const primaryRoots = roots.length > 0 ? roots : members.slice(0, 1);
    const g1Y = Math.max(minTopBound + 150, trunkBaseY - cardH - 12);
    const rootSpreadStep = Math.max(cardW * 2.2, Math.round(boardWidth * 0.24));
    const trunkSwayFactor = aiBlueprint?.trunkCurve ?? 0.05;
    const trunkTopOffsetX = Math.round(boardWidth * 0.04 * trunkSwayFactor);
    const trunkTopX = Math.max(
      minLeftBound + cardW,
      Math.min(maxRightBound, trunkX + trunkTopOffsetX)
    );
    const trunkSpineAtY = (targetY: number) => {
      const f = Math.max(0, Math.min(1, (trunkBaseY - targetY) / Math.max(1, trunkHeight)));
      return Math.round(
        trunkX +
          Math.sin(f * Math.PI) * (-trunkTopOffsetX * 0.65) +
          f * trunkTopOffsetX
      );
    };

    primaryRoots.forEach((rootM, rIdx) => {
      const offsetMul =
        rIdx === 0 ? 0 : (rIdx % 2 === 1 ? -1 : 1) * Math.ceil(rIdx / 2);
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

    // 2. G2 menempel sepanjang Batang Kokoh: KAKAK di BAWAH (idx 0) ➔ BUNGSU di ATAS (idx akhir)
    interface TrunkEntry {
      member: FamilyMember;
      nodeId: string;
      x: number;
      y: number;
      cy: number;
      wingClearanceX: number;
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

    const g2BottomY = g1Y - cardH - Math.max(18, Math.round(cardH * 0.28));
    const g2TopLimitY = Math.max(
      minTopBound + Math.round(cardH * 1.15),
      trunkTopY + Math.round(trunkHeight * 0.1)
    );
    const g2SpanH = Math.max(cardH + 14, g2BottomY - g2TopLimitY);
    const g2Count = g2All.length;
    const g2StepY =
      g2Count <= 1
        ? 0
        : Math.max(cardH + 14, g2SpanH / Math.max(1, g2Count - 1));

    g2All.forEach(({ member: g2M, parentNodeId }, idx) => {
      // Kakak (idx=0) di bawah (g2BottomY), Bungsu (idx=g2Count-1) di atas (g2TopLimitY)
      const yPos =
        g2Count <= 1
          ? Math.round((g2BottomY + g2TopLimitY) / 2)
          : Math.round(g2BottomY - idx * g2StepY);
      const safeY = Math.max(g2TopLimitY, Math.min(g2BottomY, yPos));
      const swayX = trunkSpineAtY(safeY);
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
      const spCount = g2M.spouses?.length || 0;
      const wingClear = Math.max(
        cardW * 0.72 + 26,
        cardW * (0.65 + spCount) + 22
      );
      if (pos) {
        g2Entries.push({
          member: g2M,
          nodeId: g2Id,
          x: pos.x,
          y: pos.y,
          cy: pos.y + cardH / 2,
          wingClearanceX: wingClear,
        });
      }
    });

    // 3. Dahan Kokoh Pohon Petai dari setiap G2:
    // - Anak G3 GANJIL (ke-1, 3, 5 = g3Idx % 2 === 0) ke KIRI (wing = -1)
    // - Anak G3 GENAP (ke-2, 4, 6 = g3Idx % 2 === 1) ke KANAN (wing = +1)
    // - Urutan sepanjang dahan: KAKAK paling dekat dengan G2, BUNGSU makin ke ujung dahan
    interface PlacedPetaiBough {
      g3: FamilyMember;
      g3NodeId: string;
      wing: -1 | 1;
      originX: number;
      originY: number;
      boughEndX: number;
      boughEndY: number;
      segStartFrac: number;
      segEndFrac: number;
      g3CenterX: number;
      g3CenterY: number;
      tierFrac: number;
    }

    const placedPetaiBoughs: PlacedPetaiBough[] = [];
    const maxSideReach = Math.max(
      170,
      boardWidth * 0.5 - Math.max(cardW * 0.8, 34)
    );
    const canopyBottomY = Math.min(g1Y - cardH * 0.52, g2BottomY + cardH * 0.45);
    const canopyTopY = Math.max(minTopBound + Math.round(cardH * 0.9), trunkTopY - 8);
    const canopySpanY = Math.max(120, canopyBottomY - canopyTopY);

    g2Entries.forEach((g2e, g2OrderIdx) => {
      const g3Kids = (childrenMap.get(g2e.member.id) || []).filter(
        (k) => !placedMemberIds.has(k.id)
      );
      if (g3Kids.length === 0) return;

      const leftG3s: FamilyMember[] = [];
      const rightG3s: FamilyMember[] = [];
      g3Kids.forEach((k, kIdx) => {
        if (kIdx % 2 === 0) leftG3s.push(k); // ke-1, ke-3, ke-5 (Ganjil) -> Kiri
        else rightG3s.push(k); // ke-2, ke-4, ke-6 (Genap) -> Kanan
      });

      const baseTierFrac =
        g2Entries.length <= 1 ? 0.35 : g2OrderIdx / (g2Entries.length - 1);
      const originY = Math.max(
        trunkTopY + 26,
        Math.min(trunkBaseY - 46, Math.round(g2e.cy))
      );
      const originX = trunkSpineAtY(originY);

      const processG2Wing = (wingG3s: FamilyMember[], wing: -1 | 1) => {
        if (wingG3s.length === 0) return;

        // Dahan petai membentang lebar & naik anggun seimbang tanpa menabrak dahan G2 di atas/bawah
        const wingVertSpread = Math.min(
          Math.round(canopySpanY / Math.max(1.8, g2Entries.length * 1.1)),
          Math.max(36, Math.round(cardH * 0.85))
        );
        const startDist = Math.max(
          g2e.wingClearanceX + cardW * 0.45,
          Math.round(maxSideReach * 0.24)
        );
        const totalSubWeight = wingG3s.reduce(
          (acc, g3) => acc + countSubtreeSize(g3),
          0
        );
        const targetOuterReach = Math.min(
          maxSideReach,
          Math.max(
            startDist + cardW * (1.2 + wingG3s.length * 1.15),
            Math.round(maxSideReach * (wingG3s.length >= 2 || totalSubWeight >= 8 ? 0.94 : 0.72))
          )
        );

        const riseOffset =
          Math.round(wingVertSpread * (0.55 + baseTierFrac * 0.35)) +
          (wing === -1 ? 4 : -4);
        const boughEndX = Math.max(
          minLeftBound + cardW * 0.55,
          Math.min(
            boardWidth - 22 - cardW * 0.55,
            Math.round(originX + wing * targetOuterReach)
          )
        );
        const boughEndY = Math.max(
          canopyTopY,
          Math.min(canopyBottomY, Math.round(originY - riseOffset))
        );

        const boughDx = boughEndX - originX;
        const boughDy = boughEndY - originY;
        const boughAngleDeg = (Math.atan2(boughDy, boughDx) * 180) / Math.PI;
        const nWing = wingG3s.length;

        wingG3s.forEach((g3, wIdx) => {
          // Kakak (wIdx=0) terdekat dari G2 di batang, Bungsu (wIdx=nWing-1) di ujung dahan!
          const minFrac = Math.min(
            0.46,
            Math.max(0.24, startDist / Math.max(80, Math.abs(boughDx)))
          );
          const maxFrac = 0.86;
          const frac =
            nWing === 1
              ? Math.min(0.62, Math.max(minFrac + 0.08, 0.48))
              : minFrac + (wIdx / (nWing - 1)) * (maxFrac - minFrac);

          const g3Cx = originX + boughDx * frac;
          const g3Cy =
            originY +
            boughDy * frac -
            Math.round(Math.sin(frac * Math.PI) * 8);

          const segEndFrac =
            nWing === 1
              ? 1.0
              : Math.min(1.0, frac + (maxFrac - minFrac) / Math.max(1, nWing - 1) * 0.82);

          const g3LeafAngle =
            wing * Math.max(24, Math.min(68, Math.round(Math.abs(boughAngleDeg) + 34)));

          const g3Id = addMemberUnit(
            g3,
            g3Cx - cardW / 2,
            g3Cy - cardH / 2,
            g3.generationLevel ?? 2,
            g2e.nodeId,
            {
              spouseDir: wing,
              cardShape:
                aiBlueprint?.cardShape && aiBlueprint.cardShape !== 'hex'
                  ? aiBlueprint.cardShape
                  : 'leaf',
              leafAngleDeg: g3LeafAngle,
              leafTone: 'dark',
              lockUnit: true,
              treeOriginX: originX,
              treeOriginY: originY,
              treeTipX: boughEndX,
              treeTipY: boughEndY,
              treeWing: wing,
            }
          );

          const placedPos = nodePosByMember.get(g3.id);
          placedPetaiBoughs.push({
            g3,
            g3NodeId: g3Id,
            wing,
            originX,
            originY,
            boughEndX,
            boughEndY,
            segStartFrac: frac,
            segEndFrac,
            g3CenterX: (placedPos?.x ?? g3Cx - cardW / 2) + cardW / 2,
            g3CenterY: (placedPos?.y ?? g3Cy - cardH / 2) + cardH / 2,
            tierFrac: baseTierFrac,
          });
        });
      };

      processG2Wing(leftG3s, -1);
      processG2Wing(rightG3s, 1);
    });

    // 4. Ranting Kecil G4 (Ganjil di BAWAH dahan · Genap di ATAS dahan)
    //    & Daun Majemuk Menyirip G5+ (Petai / Indigofera) berjajar rapi di sepanjang ranting G4
    interface PlacedG4Twig {
      g4: FamilyMember;
      g4NodeId: string;
      wing: -1 | 1;
      twOriginX: number;
      twOriginY: number;
      twTipX: number;
      twTipY: number;
      g4Cx: number;
      g4Cy: number;
      twigAngleRad: number;
      verticalSide: -1 | 1;
    }
    const placedG4Twigs: PlacedG4Twig[] = [];

    const maxTwigLen = Math.max(
      cardH * 1.15,
      Math.min(Math.round(boardHeight * 0.145), Math.round(cardH * 1.65))
    );

    placedPetaiBoughs.forEach((bough) => {
      const g4Kids = (childrenMap.get(bough.g3.id) || []).filter(
        (k) => !placedMemberIds.has(k.id)
      );
      if (g4Kids.length === 0) return;

      const bdx = bough.boughEndX - bough.originX;
      const bdy = bough.boughEndY - bough.originY;

      g4Kids.forEach((g4k, g4Idx) => {
        // Pangkal ranting kecil menyusur keluar dari G3 menuju ujung segmen dahan
        const spanFrac = Math.max(0.14, bough.segEndFrac - bough.segStartFrac);
        const fAlong =
          g4Kids.length === 1
            ? Math.min(0.95, bough.segStartFrac + spanFrac * 0.42)
            : Math.min(
                0.96,
                bough.segStartFrac +
                  0.04 +
                  (g4Idx / Math.max(1, g4Kids.length - 1)) * (spanFrac * 0.84)
              );

        const twOriginX = Math.round(bough.originX + bdx * fAlong);
        const twOriginY = Math.round(bough.originY + bdy * fAlong);

        // G4 Ganjil (ke-1, 3, 5 -> g4Idx % 2 === 0) di BAWAH dahan (+1)
        // G4 Genap  (ke-2, 4, 6 -> g4Idx % 2 === 1) di ATAS dahan (-1)
        const verticalSide: -1 | 1 = g4Idx % 2 === 0 ? 1 : -1;
        const outwardSlope = bough.wing * 0.42;
        const twigAngleRad = Math.atan2(verticalSide * 0.9, outwardSlope);

        const g5Count = (childrenMap.get(g4k.id) || []).length;
        const twigLen = Math.round(
          maxTwigLen * (g5Count > 0 ? 1.12 : 0.88)
        );

        const twTipX = Math.max(
          minLeftBound + cardW * 0.4,
          Math.min(
            boardWidth - 22 - cardW * 0.4,
            Math.round(twOriginX + Math.cos(twigAngleRad) * twigLen)
          )
        );
        const twTipY = Math.max(
          minTopBound + 20,
          Math.min(
            boardHeight - 28 - cardH * 0.4,
            Math.round(twOriginY + Math.sin(twigAngleRad) * twigLen)
          )
        );

        const g4PosFrac = g5Count > 0 ? 0.46 : 0.62;
        const g4Cx = twOriginX + (twTipX - twOriginX) * g4PosFrac;
        const g4Cy = twOriginY + (twTipY - twOriginY) * g4PosFrac;
        const g4LeafAngle = bough.wing * (verticalSide === 1 ? 114 : 38);

        const g4Id = addMemberUnit(
          g4k,
          g4Cx - cardW / 2,
          g4Cy - cardH / 2,
          g4k.generationLevel ?? 3,
          bough.g3NodeId,
          {
            spouseDir: bough.wing,
            cardShape: 'leaf',
            leafAngleDeg: g4LeafAngle,
            leafTone: 'medium',
            treeOriginX: twOriginX,
            treeOriginY: twOriginY,
            treeTipX: twTipX,
            treeTipY: twTipY,
            treeWing: bough.wing,
          }
        );

        const g4Pos = nodePosByMember.get(g4k.id);
        placedG4Twigs.push({
          g4: g4k,
          g4NodeId: g4Id,
          wing: bough.wing,
          twOriginX,
          twOriginY,
          twTipX,
          twTipY,
          g4Cx: (g4Pos?.x ?? g4Cx - cardW / 2) + cardW / 2,
          g4Cy: (g4Pos?.y ?? g4Cy - cardH / 2) + cardH / 2,
          twigAngleRad,
          verticalSide,
        });
      });
    });

    // 5. Daun Majemuk Menyirip G5+ (Petai / Indigofera) berpasang kiri/kanan sepanjang ranting kecil G4
    const placePetaiLeaflets = (
      parentM: FamilyMember,
      parentNodeId: string,
      anchorCx: number,
      anchorCy: number,
      axisAngleRad: number,
      wing: -1 | 1,
      verticalSide: -1 | 1,
      depth: number
    ) => {
      const kids = (childrenMap.get(parentM.id) || []).filter(
        (k) => !placedMemberIds.has(k.id)
      );
      if (kids.length === 0) return;

      const cosA = Math.cos(axisAngleRad);
      const sinA = Math.sin(axisAngleRad);
      const perpX = -sinA;
      const perpY = cosA;
      const rachisStep = Math.max(cardH * 0.72, Math.round(boardHeight * 0.048));
      const pinnaLateral = Math.max(cardW * 0.62, Math.round(boardWidth * 0.042));

      kids.forEach((kid, idx) => {
        // Berpasang menyirip sepanjang tangkai anak ranting: ganjil (idx genap 0,2,4) vs genap (idx ganjil 1,3,5)
        const pairRank = Math.floor(idx / 2);
        const side: -1 | 1 = idx % 2 === 0 ? -1 : 1;
        const alongDist = (0.75 + pairRank * 0.85) * rachisStep;
        const latDist = side * pinnaLateral;

        const kx = anchorCx + cosA * alongDist + perpX * latDist;
        const ky = anchorCy + sinA * alongDist + perpY * latDist;

        const leafDeg = wing * (verticalSide === 1 ? 105 + side * 22 : 34 + side * 20);

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
            leafTone: 'light',
            treeOriginX: Math.round(anchorCx),
            treeOriginY: Math.round(anchorCy),
            treeTipX: Math.round(kx),
            treeTipY: Math.round(ky),
            treeWing: wing,
          }
        );

        const kPos = nodePosByMember.get(kid.id);
        placePetaiLeaflets(
          kid,
          kidId,
          (kPos?.x ?? kx - cardW / 2) + cardW / 2,
          (kPos?.y ?? ky - cardH / 2) + cardH / 2,
          axisAngleRad,
          wing,
          verticalSide,
          depth + 1
        );
      });
    };

    placedG4Twigs.forEach((g4t) => {
      placePetaiLeaflets(
        g4t.g4,
        g4t.g4NodeId,
        g4t.g4Cx,
        g4t.g4Cy,
        g4t.twigAngleRad,
        g4t.wing,
        g4t.verticalSide,
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
        leafAngleDeg: gen >= 2 ? wing * (36 + (idx % 4) * 24) : undefined,
        leafTone: gen <= 2 ? 'dark' : gen === 3 ? 'medium' : 'light',
        treeWing: wing,
      });
    });

    // Solver anti-tumpuk ringan: kunci G1, G2, & G3 agar batang & dahan petai tetap tegas,
    // geser G4/G5 seperlunya agar bebas tumpukan
    const treePadX = Math.max(8, Math.round(cardW * 0.1));
    const treePadY = Math.max(8, Math.round(cardH * 0.1));
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
          photo: sp.photoUrl || '',
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
            photo: sp.photoUrl || '',
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
          photo: sp.photoUrl || '',
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
          photo: sp.photoUrl || '',
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
            photo: sp.photoUrl || '',
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
            photo: sp.photoUrl || '',
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
            photo: sp.photoUrl || '',
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
  // MODE BARU 4: KOLAM TERATAI MEKAR (MANDALA 360° & RIAK AIR KOLAM)
  // - G1 bunga emas tepat di pusat mandala, G2 mahkota bunga emas mengelilingi G1
  // - G3 bunga berwarna terpisah di 2 cincin konsentris merata per sektor G2
  // - G4 daun teratai bulat hijau mengorbit langsung di sekitar bunga G3-nya
  // - G5+ kuncup daun bulat kecil menempel di sisi luar daun G4 induknya
  // -------------------------------------------------------------------------
  if (presetId === 'teratai_mekar') {
    interface LotusPondMeta {
      member: FamilyMember;
      depth: number;
      children: LotusPondMeta[];
      g4Count: number;
      g5Count: number;
      bloomRadius: number;
      branchColor: string;
    }

    const LOTUS_G3_FLOWER_COLORS = [
      '#f43f5e',
      '#a855f7',
      '#0ea5e9',
      '#f97316',
      '#ec4899',
      '#8b5cf6',
      '#14b8a6',
      '#e11d48',
    ];

    const seenLotus = new Set<string>();
    const buildPondMeta = (
      m: FamilyMember,
      depth: number,
      g2BranchIdx: number
    ): LotusPondMeta => {
      seenLotus.add(m.id);
      const rawKids = (childrenMap.get(m.id) || []).filter(
        (k) => !seenLotus.has(k.id)
      );
      const kids = rawKids.map((k, idx) =>
        buildPondMeta(k, depth + 1, depth === 0 ? idx : g2BranchIdx)
      );

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

      const g3Box = estimateSmartNodeBoxSize(
        {
          id: `tmp_g3_${m.id}`,
          name: m.name,
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: m.isDeceased,
          scaleMultiplier: 1.02,
          cardShape: 'petal',
        },
        displayMode,
        photoSize,
        cardScale
      );
      const g4Box = estimateSmartNodeBoxSize(
        {
          id: `tmp_g4_${m.id}`,
          name: 'Daun G4',
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: false,
          scaleMultiplier: 0.84,
          cardShape: 'petal',
        },
        displayMode,
        photoSize,
        cardScale
      );
      const g5Box = estimateSmartNodeBoxSize(
        {
          id: `tmp_g5_${m.id}`,
          name: 'Kuncup G5',
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: false,
          scaleMultiplier: 0.68,
          cardShape: 'petal',
        },
        displayMode,
        photoSize,
        cardScale
      );

      const spLen = m.spouses?.length || 0;
      const coreHalfW = (g3Box.w * (1 + spLen)) / 2;
      let bloomRadius = Math.max(coreHalfW + 14, g3Box.h * 0.65);
      if (depth === 2 && (g4Count > 0 || g5Count > 0)) {
        const ring1Circum =
          Math.max(1, g4Count) * Math.max(g4Box.w, g4Box.h) * 1.18;
        const r1 = Math.max(
          coreHalfW + g4Box.h * 0.86,
          ring1Circum / (Math.PI * 2)
        );
        const hasG5 = kids.some((k) => k.children.length > 0);
        bloomRadius = hasG5
          ? r1 + g4Box.h * 0.6 + g5Box.h * 0.92
          : r1 + g4Box.h * 0.62;
      }

      const branchColor =
        LOTUS_G3_FLOWER_COLORS[
          Math.abs(g2BranchIdx) % LOTUS_G3_FLOWER_COLORS.length
        ];

      return {
        member: m,
        depth,
        children: kids,
        g4Count,
        g5Count,
        bloomRadius,
        branchColor,
      };
    };

    const lotusRoots: LotusPondMeta[] = [];
    roots.forEach((r, idx) => {
      if (!seenLotus.has(r.id)) {
        lotusRoots.push(
          buildPondMeta(r, Math.max(0, r.generationLevel ?? 0), idx)
        );
      }
    });
    members.forEach((m, idx) => {
      if (!seenLotus.has(m.id)) {
        lotusRoots.push(
          buildPondMeta(m, Math.max(0, m.generationLevel ?? 0), idx)
        );
      }
    });

    const placedLotusNodes: InteractiveNode[] = [];
    const flowerZones: Array<{
      id: string;
      cx: number;
      cy: number;
      r: number;
      meta: LotusPondMeta;
      parentG2Id: string;
      targetAngle: number;
    }> = [];

    const getLotusPaletteStyle = (depth: number, branchColor: string) => {
      if (depth <= 0) {
        return { bg: '#fef3c7', border: '#f59e0b', scale: 1.16 };
      }
      if (depth === 1) {
        return { bg: '#fffbeb', border: '#f59e0b', scale: 0.98 };
      }
      if (depth === 2) {
        return { bg: '#ffffff', border: branchColor, scale: 1.02 };
      }
      if (depth === 3) {
        return { bg: '#6ee7b7', border: '#059669', scale: 0.84 };
      }
      return { bg: '#a7f3d0', border: '#10b981', scale: 0.68 };
    };

    const spawnLotusCardUnit = (
      m: FamilyMember,
      centerX: number,
      centerY: number,
      depth: number,
      parentNodeId: string | null,
      lotusRole: InteractiveNode['lotusRole'],
      attachCoupleInCenter: boolean,
      tangentAngleRad: number,
      branchColor: string
    ): string => {
      const styleInfo = getLotusPaletteStyle(depth, branchColor);
      const scaleMult = styleInfo.scale;

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
        leafAngleDeg: 0,
        customBgColor: styleInfo.bg,
        customBorderColor: styleInfo.border,
      });

      if (parentNodeId) {
        edges.push({ from: parentNodeId, to: primaryId, type: 'child' });
      }

      spouses.forEach((sp, sIdx) => {
        const spScale = attachCoupleInCenter
          ? scaleMult * 0.94
          : scaleMult * 0.92;
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
          photo: sp.photoUrl || '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? depth,
          scaleMultiplier: spScale,
          cardShape: lotusShape,
          lotusRole,
          leafAngleDeg: 0,
          customBgColor: styleInfo.bg,
          customBorderColor: styleInfo.border,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      return primaryId;
    };

    const pondCx = Math.round(boardWidth / 2);
    const pondCy = Math.round(topSafeY + usableH / 2);
    const availRx = Math.max(180, boardWidth / 2 - 26);
    const availRy = Math.max(150, usableH / 2 - 22);
    const pondMaxR = Math.min(availRx, availRy);

    const g1Dim = estimateSmartNodeBoxSize(
      {
        id: 'tmp_pond_g1',
        name: 'G1',
        sub: '',
        x: 0,
        y: 0,
        photo: '',
        wafat: false,
        scaleMultiplier: 1.16,
        cardShape: 'petal',
      },
      displayMode,
      photoSize,
      cardScale
    );
    const g2Dim = estimateSmartNodeBoxSize(
      {
        id: 'tmp_pond_g2',
        name: 'G2',
        sub: '',
        x: 0,
        y: 0,
        photo: '',
        wafat: false,
        scaleMultiplier: 0.98,
        cardShape: 'petal',
      },
      displayMode,
      photoSize,
      cardScale
    );

    const g1NodeIds: string[] = [];
    const g2Entries: Array<{
      meta: LotusPondMeta;
      parentG1Id: string;
      weight: number;
    }> = [];

    // 1. Pusat Mandala: Bunga Emas G1 tepat di tengah kolam
    lotusRoots.forEach((g1, idx) => {
      const gx =
        lotusRoots.length === 1
          ? pondCx
          : Math.round(
              pondCx +
                (idx - (lotusRoots.length - 1) / 2) * (g1Dim.w * 1.45 + 16)
            );
      const g1Id = spawnLotusCardUnit(
        g1.member,
        gx,
        pondCy,
        0,
        null,
        'flower_center',
        true,
        0,
        '#f59e0b'
      );
      g1NodeIds.push(g1Id);
      g1.children.forEach((g2) => {
        const g3W =
          g2.children.reduce(
            (s, c) => s + Math.max(58, c.bloomRadius * 1.4),
            0
          ) || 72;
        g2Entries.push({
          meta: g2,
          parentG1Id: g1Id,
          weight: Math.max(72, g3W),
        });
      });
    });

    // 2. Cincin Mahkota G2 Emas mengelilingi G1 (360°)
    const g2NodeIds: string[] = [];
    const g1MaxSpan = lotusRoots.reduce(
      (mx, g1) => Math.max(mx, g1Dim.w * (1 + (g1.member.spouses?.length || 0))),
      g1Dim.w
    );
    const minCircumG2 = g2Entries.length * (g2Dim.w * 1.42 + 12);
    const rG2 = Math.max(
      g1MaxSpan * 0.68 + g2Dim.w * 0.72 + 16,
      Math.min(pondMaxR * 0.34, minCircumG2 / (Math.PI * 2))
    );

    const totalG2W = g2Entries.reduce((s, e) => s + e.weight, 0) || 1;
    let curAng = -Math.PI / 2;

    const allG3Raw = g2Entries.flatMap((e) => e.meta.children);
    const maxZoneR =
      allG3Raw.length > 0
        ? Math.max(...allG3Raw.map((g) => g.bloomRadius), 55)
        : 55;
    const rG3Outer = Math.max(
      rG2 + g2Dim.h * 1.7 + 26,
      pondMaxR - Math.min(maxZoneR * 0.85, pondMaxR * 0.24) - 10
    );
    const rG3Inner = Math.max(
      rG2 + g2Dim.h * 1.3 + 18,
      rG2 + (rG3Outer - rG2) * 0.5
    );

    const stretchX = availRx / Math.max(1, pondMaxR);
    const stretchY = availRy / Math.max(1, pondMaxR);

    g2Entries.forEach((entry) => {
      const equalShare = (Math.PI * 2) / Math.max(1, g2Entries.length);
      const wShare = (Math.PI * 2 * entry.weight) / totalG2W;
      const sectorSpan = equalShare * 0.35 + wShare * 0.65;
      const midAng = curAng + sectorSpan / 2;

      const g2x = Math.round(pondCx + Math.cos(midAng) * rG2 * Math.min(1.18, stretchX));
      const g2y = Math.round(pondCy + Math.sin(midAng) * rG2 * Math.min(1.12, stretchY));

      const g2Id = spawnLotusCardUnit(
        entry.meta.member,
        g2x,
        g2y,
        1,
        entry.parentG1Id,
        'flower_center',
        true,
        midAng + Math.PI / 2,
        '#f59e0b'
      );
      g2NodeIds.push(g2Id);

      // 3. Sebarkan bunga G3 dalam 2 cincin konsentris merata di sektor G2
      const g3Kids = entry.meta.children;
      if (g3Kids.length > 0) {
        const g3Weights = g3Kids.map((c) => Math.max(55, c.bloomRadius));
        const sumG3W = g3Weights.reduce((s, w) => s + w, 0) || 1;
        let g3CurA = curAng + Math.min(0.05, sectorSpan * 0.06);
        const effSector = Math.max(0.18, sectorSpan - Math.min(0.1, sectorSpan * 0.12));

        g3Kids.forEach((g3, cIdx) => {
          const g3Span =
            (effSector / g3Kids.length) * 0.35 +
            ((effSector * g3Weights[cIdx]) / sumG3W) * 0.65;
          const g3Ang = g3CurA + g3Span / 2;
          const ringDist =
            g3Kids.length === 1
              ? (rG3Inner + rG3Outer) * 0.52
              : cIdx % 2 === 0
              ? rG3Inner
              : rG3Outer;

          const fx = Math.round(
            pondCx + Math.cos(g3Ang) * ringDist * Math.min(1.24, stretchX)
          );
          const fy = Math.round(
            pondCy + Math.sin(g3Ang) * ringDist * Math.min(1.1, stretchY)
          );

          flowerZones.push({
            id: g3.member.id,
            cx: fx,
            cy: fy,
            r: g3.bloomRadius,
            meta: g3,
            parentG2Id: g2Id,
            targetAngle: g3Ang,
          });
          g3CurA += g3Span;
        });
      }

      curAng += sectorSpan;
    });

    // 4. Pisahkan zona kuntum bunga G3 (2D separation) sambil menjaga jarak aman dari mahkota G1–G2
    const coreSafeRadius = rG2 + Math.max(g2Dim.w, g2Dim.h) * 0.92;
    for (let iter = 0; iter < 52; iter++) {
      let moved = false;
      for (let i = 0; i < flowerZones.length; i++) {
        const a = flowerZones[i];
        // Tolak menjauh dari inti mahkota G1–G2
        const cdx = a.cx - pondCx;
        const cdy = a.cy - pondCy;
        const cDist = Math.hypot(cdx, cdy) || 0.01;
        const minCoreDist = coreSafeRadius + a.r * 0.72;
        if (cDist < minCoreDist) {
          const pushCore = minCoreDist - cDist;
          a.cx += (cdx / cDist) * pushCore;
          a.cy += (cdy / cDist) * pushCore;
          moved = true;
        }

        for (let j = i + 1; j < flowerZones.length; j++) {
          const b = flowerZones[j];
          const minDist = (a.r + b.r) * 0.92 + 12;
          const dx = b.cx - a.cx;
          const dy = b.cy - a.cy;
          const dist = Math.hypot(dx, dy) || 0.01;
          if (dist < minDist) {
            const push = (minDist - dist) * 0.5;
            const ux = dx / dist;
            const uy = dy / dist;
            a.cx -= ux * push;
            a.cy -= uy * push;
            b.cx += ux * push;
            b.cy += uy * push;
            moved = true;
          }
        }
      }
      for (const f of flowerZones) {
        const padR = Math.min(f.r * 0.74, boardWidth * 0.16);
        f.cx = Math.max(20 + padR, Math.min(boardWidth - 20 - padR, f.cx));
        f.cy = Math.max(66 + padR, Math.min(boardHeight - 22 - padR, f.cy));
      }
      if (!moved) break;
    }

    // 5. Spawn bunga G3 (pasangan di bunga) + daun teratai bulat G4 & kuncup G5+ di luar daun G4!
    const g3CenterNodeIds: string[] = [];
    const g4BaseBox = estimateSmartNodeBoxSize(
      {
        id: 'tmp_pond_g4_sz',
        name: 'G4',
        sub: '',
        x: 0,
        y: 0,
        photo: '',
        wafat: false,
        scaleMultiplier: 0.84,
        cardShape: 'petal',
      },
      displayMode,
      photoSize,
      cardScale
    );
    const g5BaseBox = estimateSmartNodeBoxSize(
      {
        id: 'tmp_pond_g5_sz',
        name: 'G5',
        sub: '',
        x: 0,
        y: 0,
        photo: '',
        wafat: false,
        scaleMultiplier: 0.68,
        cardShape: 'petal',
      },
      displayMode,
      photoSize,
      cardScale
    );

    flowerZones.forEach((fz) => {
      const g3Meta = fz.meta;
      const fx = Math.round(fz.cx);
      const fy = Math.round(fz.cy);

      const g3NodeId = spawnLotusCardUnit(
        g3Meta.member,
        fx,
        fy,
        2,
        fz.parentG2Id,
        'flower_center',
        true,
        fz.targetAngle + Math.PI / 2,
        g3Meta.branchColor
      );
      g3CenterNodeIds.push(g3NodeId);

      const g4Kids = g3Meta.children;
      if (g4Kids.length === 0) return;

      const spCenterCount = g3Meta.member.spouses?.length || 0;
      const g3Box = estimateSmartNodeBoxSize(
        {
          id: `tmp_g3_c_${g3Meta.member.id}`,
          name: g3Meta.member.name,
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: false,
          scaleMultiplier: 1.02,
          cardShape: 'petal',
        },
        displayMode,
        photoSize,
        cardScale
      );
      const centerHalfW = (g3Box.w * (1 + spCenterCount)) / 2;
      const ring1R = Math.max(
        centerHalfW + g4BaseBox.h * 0.86,
        (g4Kids.length * Math.max(g4BaseBox.w, g4BaseBox.h) * 1.18) /
          (Math.PI * 2)
      );

      const g4Weights = g4Kids.map((g4) => 1 + g4.children.length * 0.55);
      const totalG4W = g4Weights.reduce((s, w) => s + w, 0) || 1;
      let sectorStart = fz.targetAngle - Math.PI;

      g4Kids.forEach((g4, g4Idx) => {
        const equalShare = (Math.PI * 2) / g4Kids.length;
        const wShare = (Math.PI * 2 * g4Weights[g4Idx]) / totalG4W;
        const sectorSpan = equalShare * 0.45 + wShare * 0.55;
        const midAng = sectorStart + sectorSpan / 2;

        const g4x = fx + Math.cos(midAng) * ring1R;
        const g4y = fy + Math.sin(midAng) * ring1R;

        const g4Id = spawnLotusCardUnit(
          g4.member,
          g4x,
          g4y,
          3,
          g3NodeId,
          'petal_inner',
          false,
          midAng + Math.PI / 2,
          g3Meta.branchColor
        );

        // Kuncup daun bulat G5+ menempel berkelompok di tepi luar daun G4 induknya!
        const g5Flat: Array<{ meta: LotusPondMeta; parentNodeId: string }> = [];
        g4.children.forEach((g5) => {
          g5Flat.push({ meta: g5, parentNodeId: g4Id });
          g5.children.forEach((g6) => {
            g5Flat.push({ meta: g6, parentNodeId: `n_${g5.member.id}` });
          });
        });

        if (g5Flat.length > 0) {
          const clusterBaseR = g4BaseBox.w * 0.56 + g5BaseBox.w * 0.44 + 4;
          const fanArc = Math.min(
            Math.PI * 0.88,
            Math.max(0.45, (g5Flat.length - 1) * 0.56)
          );
          const startFan = midAng - fanArc / 2;
          g5Flat.forEach((g5Item, g5Idx) => {
            const frac =
              g5Flat.length === 1 ? 0.5 : g5Idx / (g5Flat.length - 1);
            const budAng = startFan + frac * fanArc;
            const layerOffset =
              g5Flat.length >= 5 && g5Idx % 2 === 1 ? g5BaseBox.w * 0.72 : 0;
            const distFromG4 = clusterBaseR + layerOffset;
            const p5x = g4x + Math.cos(budAng) * distFromG4;
            const p5y = g4y + Math.sin(budAng) * distFromG4;

            spawnLotusCardUnit(
              g5Item.meta.member,
              p5x,
              p5y,
              Math.max(4, g5Item.meta.depth),
              g5Item.parentNodeId,
              'petal_outer',
              false,
              budAng + Math.PI / 2,
              g3Meta.branchColor
            );
          });
        }

        sectorStart += sectorSpan;
      });
    });

    const lockedLotusIds = new Set<string>([
      ...g1NodeIds,
      ...g2NodeIds,
      ...g3CenterNodeIds,
    ]);
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
        padX: Math.max(6, Math.round(compactSiblingGap * 0.55)),
        padY: Math.max(6, Math.round(g4BaseBox.h * 0.08)),
        anchorMaxGen: 2,
        lockedNodeIds: lockedLotusIds,
        radialCenter: { x: pondCx, y: pondCy },
      }
    );

    return {
      nodes: solvedPondNodes.map((n) => ({ ...n, leafAngleDeg: 0 })),
      edges,
    };
  }

  // -------------------------------------------------------------------------
  // MODE BARU: TETRIS SILSILAH (BLOK POLIOMINO KELUARGA INTI 1–4+ KARTU)
  // - G1–G2 memakai 1 warna gradasi hangat (G1 amber tua ➔ G2 amber cerah)
  // - G3–G5 memakai warna seragam per cabang G3 (berbeda dengan cabang G3 lain)
  // - Tiap keluarga inti (orang tua + pasangan + anak daun langsung) membentuk blok Tetris
  //   rapat tersendiri (1 tunggal, 2×1, L, T, O 2×2, atau 4–8+ poliomino) dengan celah antar blok jelas
  // -------------------------------------------------------------------------
  if (presetId === 'tetris_silsilah') {
    const TETRIS_G1_COLOR = { bg: '#fde68a', border: '#b45309' };
    const TETRIS_G2_COLOR = { bg: '#fef3c7', border: '#d97706' };
    const TETRIS_G3_PALETTES: Array<{ bg: string; border: string; accent: string }> = [
      { bg: '#e0f2fe', border: '#0284c7', accent: '#0ea5e9' },
      { bg: '#d1fae5', border: '#059669', accent: '#10b981' },
      { bg: '#ede9fe', border: '#7c3aed', accent: '#8b5cf6' },
      { bg: '#ffe4e6', border: '#e11d48', accent: '#f43f5e' },
      { bg: '#ccfbf1', border: '#0d9488', accent: '#14b8a6' },
      { bg: '#ffedd5', border: '#ea580c', accent: '#f97316' },
      { bg: '#e0e7ff', border: '#4f46e5', accent: '#6366f1' },
      { bg: '#ecfccb', border: '#65a30d', accent: '#84cc16' },
      { bg: '#fae8ff', border: '#c026d3', accent: '#d946ef' },
      { bg: '#dbeafe', border: '#2563eb', accent: '#3b82f6' },
    ];

    const unitDim = getBaseCardSizeForScale(displayMode, photoSize, cardScale);
    const uw = Math.max(54, unitDim.w);
    const uh = Math.max(30, unitDim.h);
    const innerCellGap = 2; // rapat di dalam satu blok keluarga inti
    const cellStepX = uw + innerCellGap;
    const cellStepY = uh + innerCellGap;
    const blockGap = Math.max(10, Math.round(compactSiblingGap * 1.1));
    const marginX = 22;
    const marginTop = 64;
    const usableW = Math.max(320, boardWidth - marginX * 2);

    interface TetrisCellItem {
      id: string;
      name: string;
      sub: string;
      photo: string;
      wafat: boolean;
      gender?: 'L' | 'P';
      memberId?: string;
      genLevel: number;
      parentNodeId?: string | null;
      coupleOfNodeId?: string;
      relCol: number;
      relRow: number;
      bg: string;
      border: string;
    }

    interface TetrisFamilyBlock {
      blockId: string;
      g3BranchId?: string;
      g3AccentColor?: string;
      g2BranchId?: string;
      isHubBlock: boolean;
      cells: TetrisCellItem[];
      cols: number;
      rows: number;
      w: number;
      h: number;
      x: number;
      y: number;
    }

    const tetrisSeen = new Set<string>();
    const g12Blocks: TetrisFamilyBlock[] = [];
    const g3BranchGroups = new Map<
      string,
      { branchId: string; palIdx: number; blocks: TetrisFamilyBlock[] }
    >();
    let g3PaletteCounter = 0;

    // Pilih bentuk poliomino Tetris sesuai jumlah kartu (1, 2, 3, 4, atau >4)
    const getPolyominoCoords = (
      total: number,
      spouseCount: number,
      variantSeed: number
    ): Array<[number, number]> => {
      if (total <= 1) return [[0, 0]];
      if (total === 2) return [[0, 0], [1, 0]];
      if (total === 3) {
        if (spouseCount >= 2) return [[0, 0], [1, 0], [2, 0]];
        return variantSeed % 2 === 0
          ? [[0, 0], [1, 0], [0, 1]] // L-triomino
          : [[0, 0], [1, 0], [1, 1]]; // J-triomino
      }
      if (total === 4 && spouseCount <= 1) {
        const shapes4: Array<Array<[number, number]>> = [
          [[0, 0], [1, 0], [0, 1], [1, 1]], // O 2×2
          [[0, 0], [1, 0], [2, 0], [1, 1]], // T
          [[0, 0], [1, 0], [0, 1], [0, 2]], // L
          [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
        ];
        return shapes4[variantSeed % shapes4.length];
      }
      // 4+ (atau pasangan + banyak anak): baris atas untuk orang tua + pasangan, anak tersusun tangga/grid rapat di bawah
      const coords: Array<[number, number]> = [];
      const parentSlots = Math.min(3, 1 + spouseCount);
      for (let i = 0; i < 1 + spouseCount; i++) {
        coords.push([i % parentSlots, Math.floor(i / parentSlots)]);
      }
      const remaining = total - (1 + spouseCount);
      const kidCols = total >= 7 ? 3 : Math.max(2, Math.min(3, parentSlots + 1));
      const startRow = Math.max(1, Math.ceil((1 + spouseCount) / parentSlots));
      const stagger = variantSeed % 2 === 1 && remaining >= 2 ? 1 : 0;
      for (let i = 0; i < remaining; i++) {
        const r = startRow + Math.floor(i / kidCols);
        const c = (i % kidCols) + (r === startRow && kidCols === 2 ? stagger * 0 : 0);
        coords.push([c, r]);
      }
      return coords;
    };

    const buildNuclearBlock = (
      head: FamilyMember,
      depth: number,
      parentNodeId: string | null,
      g3BranchId?: string,
      g3PalIdx = 0,
      g2BranchId?: string,
      variantSeed = 0
    ): { block: TetrisFamilyBlock; branchEligibleKids: FamilyMember[] } => {
      tetrisSeen.add(head.id);
      const rawKids = (childrenMap.get(head.id) || []).filter(
        (k) => !tetrisSeen.has(k.id)
      );

      // Anak yang belum berkeluarga & tidak punya keturunan masuk langsung dalam blok keluarga inti ini
      // Khusus G1 (depth 0): G2 berdiri sebagai blok cabang sendiri agar gradasi G1 -> G2 terlihat jelas
      const absorbedLeafKids: FamilyMember[] = [];
      const branchKids: FamilyMember[] = [];
      rawKids.forEach((k) => {
        const kHasSpouse = (k.spouses?.length || 0) > 0;
        const kHasKids = (childrenMap.get(k.id)?.length || 0) > 0;
        if (depth >= 1 && !kHasSpouse && !kHasKids) {
          tetrisSeen.add(k.id);
          absorbedLeafKids.push(k);
        } else {
          branchKids.push(k);
        }
      });

      const spouses = head.spouses || [];
      const totalCardsInBlock = 1 + spouses.length + absorbedLeafKids.length;
      const coords = getPolyominoCoords(
        totalCardsInBlock,
        spouses.length,
        variantSeed
      );

      const g3Pal = TETRIS_G3_PALETTES[g3PalIdx % TETRIS_G3_PALETTES.length];
      const getUnitColors = (gen: number) => {
        if (gen <= 0) return TETRIS_G1_COLOR;
        if (gen === 1) return TETRIS_G2_COLOR;
        return { bg: g3Pal.bg, border: g3Pal.border };
      };

      const items: TetrisCellItem[] = [];
      let cursor = 0;
      const headCols = getUnitColors(head.generationLevel ?? depth);
      const headNodeId = `n_${head.id}`;
      items.push({
        id: headNodeId,
        name: head.name,
        sub: formatMemberLifeSubtitle(head),
        photo: head.photoUrl || '',
        wafat: head.isDeceased,
        gender: head.gender,
        memberId: head.id,
        genLevel: head.generationLevel ?? depth,
        parentNodeId,
        relCol: coords[cursor]?.[0] ?? 0,
        relRow: coords[cursor]?.[1] ?? 0,
        bg: headCols.bg,
        border: headCols.border,
      });
      cursor++;

      spouses.forEach((sp, sIdx) => {
        const cPos = coords[cursor] ?? [cursor, 0];
        items.push({
          id: `n_${head.id}_sp_${sIdx + 1}`,
          name: sp.name,
          sub: `Pasangan (${
            sp.status === 'cerai_mati'
              ? 'Wafat'
              : sp.status === 'cerai_hidup'
              ? 'Cerai'
              : 'Menikah'
          })`,
          photo: sp.photoUrl || '',
          wafat: sp.status === 'cerai_mati',
          gender: head.gender === 'L' ? 'P' : head.gender === 'P' ? 'L' : undefined,
          genLevel: head.generationLevel ?? depth,
          coupleOfNodeId: headNodeId,
          relCol: cPos[0],
          relRow: cPos[1],
          bg: headCols.bg,
          border: headCols.border,
        });
        cursor++;
      });

      absorbedLeafKids.forEach((ck) => {
        const cPos = coords[cursor] ?? [cursor % 3, Math.floor(cursor / 3) + 1];
        const cCols = getUnitColors(ck.generationLevel ?? depth + 1);
        items.push({
          id: `n_${ck.id}`,
          name: ck.name,
          sub: formatMemberLifeSubtitle(ck),
          photo: ck.photoUrl || '',
          wafat: ck.isDeceased,
          gender: ck.gender,
          memberId: ck.id,
          genLevel: ck.generationLevel ?? depth + 1,
          parentNodeId: headNodeId,
          relCol: cPos[0],
          relRow: cPos[1],
          bg: cCols.bg,
          border: cCols.border,
        });
        cursor++;
      });

      const cols = Math.max(1, ...items.map((it) => it.relCol + 1));
      const rows = Math.max(1, ...items.map((it) => it.relRow + 1));

      return {
        block: {
          blockId: `tetris_fam_${head.id}`,
          g3BranchId,
          g3AccentColor: g3BranchId ? g3Pal.accent : undefined,
          g2BranchId,
          isHubBlock: depth <= 1,
          cells: items,
          cols,
          rows,
          w: cols * uw + (cols - 1) * innerCellGap,
          h: rows * uh + (rows - 1) * innerCellGap,
          x: 0,
          y: 0,
        },
        branchEligibleKids: branchKids,
      };
    };

    const walkTetrisTree = (
      m: FamilyMember,
      depth: number,
      parentNodeId: string | null,
      ctx: { g2Id?: string; g3Id?: string; g3PalIdx: number; seed: number }
    ) => {
      if (tetrisSeen.has(m.id)) return;
      let nextG2Id = ctx.g2Id;
      let nextG3Id = ctx.g3Id;
      let nextPalIdx = ctx.g3PalIdx;

      if (depth === 1) {
        nextG2Id = m.id;
      } else if (depth >= 2 && !nextG3Id) {
        nextG3Id = m.id;
        nextPalIdx = g3PaletteCounter++;
      }

      const built = buildNuclearBlock(
        m,
        depth,
        parentNodeId,
        nextG3Id,
        nextPalIdx,
        nextG2Id,
        ctx.seed
      );
      if (depth <= 1) {
        g12Blocks.push(built.block);
      } else {
        const bKey = nextG3Id || `root_g3_${m.id}`;
        if (!g3BranchGroups.has(bKey)) {
          g3BranchGroups.set(bKey, {
            branchId: bKey,
            palIdx: nextPalIdx,
            blocks: [],
          });
        }
        g3BranchGroups.get(bKey)!.blocks.push(built.block);
      }

      built.branchEligibleKids.forEach((kid, idx) => {
        walkTetrisTree(kid, depth + 1, `n_${m.id}`, {
          g2Id: nextG2Id,
          g3Id: nextG3Id,
          g3PalIdx: nextPalIdx,
          seed: ctx.seed + idx + 1,
        });
      });
    };

    roots.forEach((r, idx) => {
      walkTetrisTree(r, r.generationLevel ?? 0, null, {
        g3PalIdx: idx,
        seed: idx,
      });
    });
    members.forEach((m, idx) => {
      if (!tetrisSeen.has(m.id)) {
        const d = m.generationLevel ?? 2;
        walkTetrisTree(m, d, m.parentId ? `n_${m.parentId}` : null, {
          g3PalIdx: idx,
          seed: idx,
        });
      }
    });

    // Packing blok Tetris ke baris-baris rapi (skyline/shelf packing bebas tumpang tindih)
    const packTetrisBlocksIntoArea = (
      blocks: TetrisFamilyBlock[],
      areaX: number,
      areaY: number,
      areaW: number,
      centerRows = true
    ): { totalH: number } => {
      if (blocks.length === 0) return { totalH: 0 };
      const rows: Array<{ items: TetrisFamilyBlock[]; w: number; h: number }> = [];
      let curRow: TetrisFamilyBlock[] = [];
      let curW = 0;
      let curH = 0;

      blocks.forEach((bx) => {
        const nextW = curRow.length === 0 ? bx.w : curW + blockGap + bx.w;
        if (curRow.length > 0 && nextW > areaW) {
          rows.push({ items: curRow, w: curW, h: curH });
          curRow = [bx];
          curW = bx.w;
          curH = bx.h;
        } else {
          curRow.push(bx);
          curW = nextW;
          curH = Math.max(curH, bx.h);
        }
      });
      if (curRow.length > 0) rows.push({ items: curRow, w: curW, h: curH });

      let yCursor = areaY;
      rows.forEach((rw) => {
        let xCursor = centerRows
          ? areaX + Math.max(0, Math.round((areaW - rw.w) / 2))
          : areaX;
        rw.items.forEach((bx) => {
          bx.x = Math.round(xCursor);
          bx.y = Math.round(yCursor + Math.max(0, (rw.h - bx.h) / 2));
          xCursor += bx.w + blockGap;
        });
        yCursor += rw.h + blockGap;
      });
      return { totalH: Math.max(0, yCursor - areaY - blockGap) };
    };

    // 1. Posisikan pita atas G1–G2 (1 gradasi hangat)
    let curSectionY = marginTop;
    if (g12Blocks.length > 0) {
      const g12Res = packTetrisBlocksIntoArea(
        g12Blocks,
        marginX,
        curSectionY,
        usableW,
        true
      );
      curSectionY += g12Res.totalH + Math.max(blockGap * 1.4, 16);
    }

    // 2. Susun kelompok tiap cabang G3 (masing-masing punya zona warna khas G3–G5)
    const branchList = Array.from(g3BranchGroups.values());
    const zoneGap = Math.max(blockGap + 6, 18);
    // Hitung lebar ideal tiap zona cabang G3 agar bisa sejajar berdampingan bila cukup ruang
    interface BranchZonePlan {
      branchId: string;
      blocks: TetrisFamilyBlock[];
      zoneW: number;
      zoneH: number;
    }
    const maxColsTarget =
      branchList.length >= 4
        ? 3
        : branchList.length >= 2
        ? branchList.length
        : 1;
    const defaultColW = Math.floor(
      (usableW - Math.max(0, maxColsTarget - 1) * zoneGap) / maxColsTarget
    );

    const branchPlans: BranchZonePlan[] = branchList.map((bg) => {
      const maxSingleBlockW = Math.max(...bg.blocks.map((b) => b.w));
      const zoneW = Math.min(usableW, Math.max(defaultColW, maxSingleBlockW));
      const sim = packTetrisBlocksIntoArea(bg.blocks, 0, 0, zoneW, true);
      return {
        branchId: bg.branchId,
        blocks: bg.blocks,
        zoneW,
        zoneH: sim.totalH,
      };
    });

    // Susun zona-zona cabang G3 dalam baris grid yang pas di kertas
    const branchRows: Array<{ zones: BranchZonePlan[]; totalW: number; maxH: number }> = [];
    let curZRow: BranchZonePlan[] = [];
    let curZW = 0;
    let curZH = 0;
    branchPlans.forEach((zp) => {
      const nextW = curZRow.length === 0 ? zp.zoneW : curZW + zoneGap + zp.zoneW;
      if (curZRow.length > 0 && nextW > usableW) {
        branchRows.push({ zones: curZRow, totalW: curZW, maxH: curZH });
        curZRow = [zp];
        curZW = zp.zoneW;
        curZH = zp.zoneH;
      } else {
        curZRow.push(zp);
        curZW = nextW;
        curZH = Math.max(curZH, zp.zoneH);
      }
    });
    if (curZRow.length > 0) {
      branchRows.push({ zones: curZRow, totalW: curZW, maxH: curZH });
    }

    branchRows.forEach((br) => {
      let zx = marginX + Math.max(0, Math.round((usableW - br.totalW) / 2));
      br.zones.forEach((zp) => {
        packTetrisBlocksIntoArea(zp.blocks, zx, curSectionY, zp.zoneW, true);
        zx += zp.zoneW + zoneGap;
      });
      curSectionY += br.maxH + zoneGap;
    });

    const emitTetrisBlock = (bx: TetrisFamilyBlock) => {
      bx.cells.forEach((cell) => {
        nodes.push({
          id: cell.id,
          name: cell.name,
          sub: cell.sub,
          x: Math.round(bx.x + cell.relCol * cellStepX),
          y: Math.round(bx.y + cell.relRow * cellStepY),
          photo: cell.photo,
          wafat: cell.wafat,
          gender: cell.gender,
          memberId: cell.memberId,
          genLevel: cell.genLevel,
          groupId: bx.blockId,
          cardShape: 'rect',
          lineageG2Id: bx.g2BranchId,
          lineageG3Id: bx.g3BranchId,
          lineageG3Color: bx.g3AccentColor,
          lineageG4Id: bx.blockId,
          lineageG4Color: cell.border,
          hexCol: cell.relCol,
          hexRow: cell.relRow,
          hexGap: innerCellGap,
          customBgColor: cell.bg,
          customBorderColor: cell.border,
        });
        if (cell.parentNodeId) {
          edges.push({ from: cell.parentNodeId, to: cell.id, type: 'child' });
        }
        if (cell.coupleOfNodeId) {
          edges.push({ from: cell.coupleOfNodeId, to: cell.id, type: 'couple' });
        }
      });
    };

    g12Blocks.forEach(emitTetrisBlock);
    branchList.forEach((bg) => bg.blocks.forEach(emitTetrisBlock));

    return { nodes, edges };
  }

  // -------------------------------------------------------------------------
  // MODE BARU 5: SARANG LEBAH KISI SEJATI (DUAL MODE: BERTINGKAT & RATU PUSAT)
  // - Semua kartu heksagon terkunci pada kisi odd-r ukuran seragam
  // - G1 dan G2 dikelilingi sel kosong polos (spacer ring)
  // - Pembatas celah warna terhubung: G1 -> G2 -> G3, serta pembatas warna berbeda per kelompok G4–G5 di dalam G3
  // - Pasangan menempel pada sel heksagon bersebelahan dalam warna kelompok sama
  // -------------------------------------------------------------------------
  if (
    presetId === 'sarang_lebah_turun' ||
    presetId === 'sarang_lebah_pusat' ||
    presetId === 'molekul_organik'
  ) {
    const isRadialHive =
      presetId === 'sarang_lebah_pusat' || presetId === 'molekul_organik';

    const HONEYCOMB_G2_PALETTES = [
      { g2: '#0ea5e9', g3: '#0284c7' },
      { g2: '#10b981', g3: '#059669' },
      { g2: '#8b5cf6', g3: '#7c3aed' },
      { g2: '#f43f5e', g3: '#e11d48' },
      { g2: '#f97316', g3: '#ea580c' },
      { g2: '#14b8a6', g3: '#0d9488' },
      { g2: '#6366f1', g3: '#4f46e5' },
      { g2: '#eab308', g3: '#ca8a04' },
    ];

    const G4_SUBFAMILY_COLORS = [
      '#ec4899',
      '#8b5cf6',
      '#0ea5e9',
      '#f97316',
      '#14b8a6',
      '#ef4444',
      '#6366f1',
      '#eab308',
    ];

    const HIVE_GEN_GRADIENT: Array<{ bg: string; border: string }> = [
      { bg: '#fef3c7', border: '#d97706' }, // G1: Emas Hangat
      { bg: '#d1fae5', border: '#059669' }, // G2: Zamrud
      { bg: '#ccfbf1', border: '#0d9488' }, // G3: Toska
      { bg: '#e0f2fe', border: '#0284c7' }, // G4: Biru Langit
      { bg: '#f0f9ff', border: '#38bdf8' }, // G5+: Biru Lembut
    ];

    interface HiveMeta {
      member: FamilyMember;
      depth: number;
      children: HiveMeta[];
      weight: number;
      cellCount: number;
      g2Idx: number;
      lineageG2Id?: string;
      lineageG2Color?: string;
      lineageG3Id?: string;
      lineageG3Color?: string;
      lineageG4Id?: string;
      lineageG4Color?: string;
    }

    const seenHive = new Set<string>();
    const g4GlobalCounter = { n: 0 };

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
      const myG2Idx = ctx.g2Idx;

      const pal =
        HONEYCOMB_G2_PALETTES[
          Math.abs(myG2Idx) % HONEYCOMB_G2_PALETTES.length
        ];
      if (depth === 1) {
        nextG2Id = m.id;
        nextG2Col = pal.g2;
      } else if (depth === 2) {
        const g3ShiftIdx =
          (Math.abs(myG2Idx) + ctx.g3Counter.n++) %
          HONEYCOMB_G2_PALETTES.length;
        nextG3Id = m.id;
        nextG3Col = HONEYCOMB_G2_PALETTES[g3ShiftIdx].g2;
      } else if (depth === 3) {
        nextG4Id = m.id;
        nextG4Col =
          G4_SUBFAMILY_COLORS[g4GlobalCounter.n++ % G4_SUBFAMILY_COLORS.length];
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

      const selfCells = 1 + (m.spouses?.length || 0);
      const cellCount =
        selfCells + kids.reduce((sum, c) => sum + c.cellCount, 0);

      return {
        member: m,
        depth,
        children: kids,
        weight: Math.max(1, cellCount),
        cellCount,
        g2Idx: myG2Idx,
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
        scaleMultiplier: 1,
        cardShape: 'hex',
      },
      displayMode,
      photoSize,
      cardScale
    );
    const hexW = hexSampleDim.w;
    const hexH = hexSampleDim.h;
    const hexGap = Math.max(8, Math.round(hexW * 0.14));
    const stepX = hexW + hexGap;
    const stepY = stepX * 0.8660254;

    const cellKey = (c: number, r: number) => `${c},${r}`;
    const cellToCenter = (c: number, r: number) => ({
      cx: c * stepX + ((r & 1) !== 0 ? stepX * 0.5 : 0),
      cy: r * stepY,
    });
    const getHexNeighbors = (c: number, r: number): Array<[number, number]> => {
      const odd = (r & 1) !== 0 ? 1 : 0;
      return [
        [c + 1, r],
        [c + odd, r + 1],
        [c - 1 + odd, r + 1],
        [c - 1, r],
        [c - 1 + odd, r - 1],
        [c + odd, r - 1],
      ];
    };

    const occupied = new Set<string>();
    const reservedPolos = new Set<string>();
    const isCellFree = (c: number, r: number, allowPolos = false) => {
      const k = cellKey(c, r);
      if (occupied.has(k)) return false;
      if (!allowPolos && reservedPolos.has(k)) return false;
      return true;
    };
    const reservePolosRing = (cells: Array<[number, number]>) => {
      cells.forEach(([c, r]) => {
        getHexNeighbors(c, r).forEach(([nc, nr]) => {
          const nk = cellKey(nc, nr);
          if (!occupied.has(nk)) reservedPolos.add(nk);
        });
      });
    };

    const placedHiveNodes: InteractiveNode[] = [];

    const spawnHexUnitAt = (
      hm: HiveMeta,
      c: number,
      r: number,
      parentNodeId: string | null,
      spouseHintX = 1,
      spouseHintY = 0
    ): {
      primaryId: string;
      cells: Array<[number, number]>;
    } => {
      const m = hm.member;
      occupied.add(cellKey(c, r));
      const usedCells: Array<[number, number]> = [[c, r]];
      const center = cellToCenter(c, r);

      const hexTier: InteractiveNode['hexTier'] =
        hm.depth <= 0
          ? 'g1'
          : hm.depth === 1
          ? 'g2'
          : hm.depth === 2
          ? 'g3'
          : 'g4plus';

      const genPalette =
        HIVE_GEN_GRADIENT[
          Math.max(0, Math.min(HIVE_GEN_GRADIENT.length - 1, hm.depth))
        ];
      const activeBorder = genPalette.border;
      const activeBg = genPalette.bg;

      const primaryId = `n_${m.id}`;
      placedHiveNodes.push({
        id: primaryId,
        name: m.name,
        sub: formatMemberLifeSubtitle(m),
        x: Math.round(center.cx - hexW / 2),
        y: Math.round(center.cy - hexH / 2),
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: m.generationLevel ?? hm.depth,
        scaleMultiplier: 1,
        cardShape: 'hex',
        hexCol: c,
        hexRow: r,
        hexGap,
        hexTier,
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

      const spouses = m.spouses || [];
      spouses.forEach((sp, sIdx) => {
        // Cari sel bersebelahan untuk pasangan (dalam warna kelompok yang sama)
        let spCell: [number, number] | null = null;
        const anchorPt = cellToCenter(c, r);
        const candidates = getHexNeighbors(c, r)
          .filter(([nc, nr]) => isCellFree(nc, nr, false))
          .sort((a, b) => {
            const pa = cellToCenter(a[0], a[1]);
            const pb = cellToCenter(b[0], b[1]);
            const da =
              (pa.cx - anchorPt.cx) * spouseHintX +
              (pa.cy - anchorPt.cy) * spouseHintY;
            const db =
              (pb.cx - anchorPt.cx) * spouseHintX +
              (pb.cy - anchorPt.cy) * spouseHintY;
            return db - da;
          });

        if (candidates.length > 0) {
          spCell = candidates[0];
        } else {
          // BFS fallback ke sel terdekat yang bebas
          const q: Array<[number, number]> = [[c, r]];
          const vis = new Set<string>([cellKey(c, r)]);
          while (q.length > 0 && !spCell) {
            const [qc, qr] = q.shift()!;
            for (const [nc, nr] of getHexNeighbors(qc, qr)) {
              const nk = cellKey(nc, nr);
              if (vis.has(nk)) continue;
              vis.add(nk);
              if (isCellFree(nc, nr, false)) {
                spCell = [nc, nr];
                break;
              }
              q.push([nc, nr]);
            }
          }
        }

        if (spCell) {
          const [sc, sr] = spCell;
          occupied.add(cellKey(sc, sr));
          usedCells.push([sc, sr]);
          const spCenter = cellToCenter(sc, sr);
          const spId = `n_${m.id}_sp_${sIdx + 1}`;
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
            x: Math.round(spCenter.cx - hexW / 2),
            y: Math.round(spCenter.cy - hexH / 2),
            photo: sp.photoUrl || '',
            wafat: sp.status === 'cerai_mati',
            gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
            genLevel: m.generationLevel ?? hm.depth,
            scaleMultiplier: 1,
            cardShape: 'hex',
            hexCol: sc,
            hexRow: sr,
            hexGap,
            hexTier,
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
        }
      });

      return { primaryId, cells: usedCells };
    };

    // Cari sel bebas terdekat ke koordinat target (px, py)
    const findNearestFreeCell = (
      targetX: number,
      targetY: number,
      minRow = -60
    ): [number, number] => {
      const approxR = Math.max(minRow, Math.round(targetY / stepY));
      const rowShift = (approxR & 1) !== 0 ? stepX * 0.5 : 0;
      const approxC = Math.round((targetX - rowShift) / stepX);
      if (isCellFree(approxC, approxR, false) && approxR >= minRow) {
        return [approxC, approxR];
      }
      let best: [number, number] | null = null;
      let bestDist = Infinity;
      for (let rad = 1; rad <= 26; rad++) {
        for (let dr = -rad; dr <= rad; dr++) {
          const r = approxR + dr;
          if (r < minRow) continue;
          for (let dc = -rad; dc <= rad; dc++) {
            const c = approxC + dc;
            if (!isCellFree(c, r, false)) continue;
            const p = cellToCenter(c, r);
            const d = Math.hypot(p.cx - targetX, p.cy - targetY);
            if (d < bestDist) {
              bestDist = d;
              best = [c, r];
            }
          }
        }
        if (best) return best;
      }
      return [approxC, approxR];
    };

    // Cari sel bebas yang BERSEBELAHAN langsung dengan daftar sel klaster (menjaga klaster G3 & sub-kelompok G4+G5 menyatu!)
    const findContiguousClusterCell = (
      anchorCells: Array<[number, number]>,
      preferX: number,
      preferY: number,
      minRow = -60
    ): [number, number] => {
      let best: [number, number] | null = null;
      let bestScore = Infinity;
      const seenCand = new Set<string>();

      for (const [ac, ar] of anchorCells) {
        for (const [nc, nr] of getHexNeighbors(ac, ar)) {
          if (nr < minRow) continue;
          const nk = cellKey(nc, nr);
          if (seenCand.has(nk) || !isCellFree(nc, nr, false)) continue;
          seenCand.add(nk);
          const pt = cellToCenter(nc, nr);
          const dist = Math.hypot(pt.cx - preferX, pt.cy - preferY);
          if (dist < bestScore) {
            bestScore = dist;
            best = [nc, nr];
          }
        }
      }
      if (best) return best;
      const fallbackRef = anchorCells[anchorCells.length - 1] || [0, 0];
      const refPt = cellToCenter(fallbackRef[0], fallbackRef[1]);
      return findNearestFreeCell(
        (refPt.cx + preferX) * 0.5,
        (refPt.cy + preferY) * 0.5,
        minRow
      );
    };

    // Kemas G4 dan seluruh keturunan G5+ dalam satu sub-kelompok kontigu yang menempel di klaster G3!
    const packG4SubFamily = (
      g4Meta: HiveMeta,
      g3ClusterCells: Array<[number, number]>,
      g3ParentId: string,
      preferX: number,
      preferY: number,
      minRow: number
    ) => {
      const g4Seed = findContiguousClusterCell(
        g3ClusterCells,
        preferX,
        preferY,
        minRow
      );
      const g4Unit = spawnHexUnitAt(
        g4Meta,
        g4Seed[0],
        g4Seed[1],
        g3ParentId,
        preferX >= 0 ? 1 : -1,
        0
      );
      const subFamilyCells: Array<[number, number]> = [...g4Unit.cells];
      g3ClusterCells.push(...g4Unit.cells);

      // Tempatkan semua anak G5+ menempel langsung pada sel sub-keluarga G4 ini!
      const placeDescendantContiguous = (
        parentMeta: HiveMeta,
        parentId: string
      ) => {
        parentMeta.children.forEach((child) => {
          const anchorCell =
            subFamilyCells[subFamilyCells.length - 1] || g4Seed;
          const anchorPt = cellToCenter(anchorCell[0], anchorCell[1]);
          const nextCell = findContiguousClusterCell(
            subFamilyCells,
            (anchorPt.cx + preferX) * 0.5,
            (anchorPt.cy + preferY) * 0.5,
            minRow
          );
          const chUnit = spawnHexUnitAt(
            child,
            nextCell[0],
            nextCell[1],
            parentId,
            preferX >= 0 ? 1 : -1,
            0
          );
          subFamilyCells.push(...chUnit.cells);
          g3ClusterCells.push(...chUnit.cells);
          placeDescendantContiguous(child, chUnit.primaryId);
        });
      };

      placeDescendantContiguous(g4Meta, g4Unit.primaryId);
    };

    if (isRadialHive) {
      // ---------------------------------------------------------------------
      // SARANG LEBAH RATU PUSAT (KISI 360°)
      // ---------------------------------------------------------------------
      const g1Meta = hiveRoots[0];
      const g1PlacedRoots: Array<{ meta: HiveMeta; id: string }> = [];

      if (g1Meta) {
        const g1Unit = spawnHexUnitAt(g1Meta, 0, 0, null, 1, 0);
        reservePolosRing(g1Unit.cells);
        g1PlacedRoots.push({ meta: g1Meta, id: g1Unit.primaryId });
      }
      // Jika ada akar tambahan (jarang), letakkan di dekat pusat
      hiveRoots.slice(1).forEach((extraR, idx) => {
        const extraPos = findNearestFreeCell((idx + 1) * stepX * 2.5, 0);
        const u = spawnHexUnitAt(extraR, extraPos[0], extraPos[1], null, 1, 0);
        reservePolosRing(u.cells);
        g1PlacedRoots.push({ meta: extraR, id: u.primaryId });
      });

      const g2Branches: Array<{ meta: HiveMeta; parentId: string }> = [];
      g1PlacedRoots.forEach((r) => {
        r.meta.children.forEach((g2) => {
          g2Branches.push({ meta: g2, parentId: r.id });
        });
      });

      const totalBranchW =
        g2Branches.reduce((s, b) => s + b.meta.weight, 0) || 1;
      let curA = -Math.PI / 2;

      // Radius G2: cukup di luar ring polos G1 (jarak 2 sel = ~2.05 * stepX)
      const g2Radius = Math.max(
        stepX * 2.1,
        (g2Branches.length * stepX * 2.35) / (Math.PI * 2)
      );

      interface RadialG2Plan {
        meta: HiveMeta;
        g2Id: string;
        g2Center: { cx: number; cy: number };
        sectorStart: number;
        sectorEnd: number;
      }
      const g2Plans: RadialG2Plan[] = [];

      // Tahap 1: Tempatkan semua G2 dan cadangkan ring polos di sekitar masing-masing G2!
      g2Branches.forEach((br) => {
        const eqShare = (Math.PI * 2) / Math.max(1, g2Branches.length);
        const wShare = (Math.PI * 2 * br.meta.weight) / totalBranchW;
        const sectorSpan = eqShare * 0.42 + wShare * 0.58;
        const midAng = curA + sectorSpan / 2;

        const targetX = Math.cos(midAng) * g2Radius;
        const targetY = Math.sin(midAng) * g2Radius;
        const [c2, r2] = findNearestFreeCell(targetX, targetY);
        const g2Unit = spawnHexUnitAt(
          br.meta,
          c2,
          r2,
          br.parentId,
          Math.cos(midAng) >= 0 ? 1 : -1,
          Math.sin(midAng)
        );
        reservePolosRing(g2Unit.cells);

        g2Plans.push({
          meta: br.meta,
          g2Id: g2Unit.primaryId,
          g2Center: cellToCenter(c2, r2),
          sectorStart: curA,
          sectorEnd: curA + sectorSpan,
        });
        curA += sectorSpan;
      });

      // Tahap 2: Tempatkan tiap klaster G3 (melingkupi kelompok G4–G5) di luar ring polos G2!
      const g3BaseRadius = g2Radius + stepX * 2.45;
      g2Plans.forEach((plan) => {
        const g3Kids = plan.meta.children;
        if (g3Kids.length === 0) return;

        const totalG3W = g3Kids.reduce((s, c) => s + c.weight, 0) || 1;
        let g3CurA = plan.sectorStart;
        const sectorTotal = plan.sectorEnd - plan.sectorStart;

        g3Kids.forEach((g3, g3Idx) => {
          const eqG3 = sectorTotal / g3Kids.length;
          const wG3 = (sectorTotal * g3.weight) / totalG3W;
          const g3Span = eqG3 * 0.35 + wG3 * 0.65;
          const g3MidA = g3CurA + g3Span / 2;

          const radialBoost =
            g3Kids.length >= 3 && g3Idx % 2 === 1 ? stepX * 1.15 : 0;
          const g3TargetR = g3BaseRadius + radialBoost;
          const g3TargetX = Math.cos(g3MidA) * g3TargetR;
          const g3TargetY = Math.sin(g3MidA) * g3TargetR;

          const [c3, r3] = findNearestFreeCell(g3TargetX, g3TargetY);
          const g3Unit = spawnHexUnitAt(
            g3,
            c3,
            r3,
            plan.g2Id,
            Math.cos(g3MidA) >= 0 ? 1 : -1,
            Math.sin(g3MidA)
          );
          const g3ClusterCells: Array<[number, number]> = [...g3Unit.cells];

          const g4Kids = g3.children;
          const g4Count = g4Kids.length;
          g4Kids.forEach((g4, g4Idx) => {
            const subFrac =
              g4Count <= 1 ? 0 : (g4Idx / (g4Count - 1) - 0.5) * 0.8;
            const g4Ang = g3MidA + subFrac * Math.min(g3Span, 0.9);
            const g4PrefX = Math.cos(g4Ang) * (g3TargetR + stepX * 1.9);
            const g4PrefY = Math.sin(g4Ang) * (g3TargetR + stepX * 1.9);
            packG4SubFamily(
              g4,
              g3ClusterCells,
              g3Unit.primaryId,
              g4PrefX,
              g4PrefY,
              -60
            );
          });

          g3CurA += g3Span;
        });
      });
    } else {
      // ---------------------------------------------------------------------
      // SARANG LEBAH BERTINGKAT (TURUN TOP-DOWN PADA KISI SEJATI)
      // - Baris 0: G1 (+ pasangan) dikelilingi ring sel kosong polos
      // - Baris 2: G2 (+ pasangan) dikelilingi ring sel kosong polos
      // - Baris 4+: Klaster G3 dan sub-keluarga G4–G5 mengalir ke bawah
      // ---------------------------------------------------------------------
      const g1Meta = hiveRoots[0];
      const g1IdMap: Array<{ meta: HiveMeta; id: string }> = [];

      if (g1Meta) {
        const u = spawnHexUnitAt(g1Meta, 0, 0, null, 1, 0);
        reservePolosRing(u.cells);
        g1IdMap.push({ meta: g1Meta, id: u.primaryId });
      }
      hiveRoots.slice(1).forEach((extraR, idx) => {
        const pos = findNearestFreeCell((idx + 1) * stepX * 3, 0, 0);
        const u = spawnHexUnitAt(extraR, pos[0], pos[1], null, 1, 0);
        reservePolosRing(u.cells);
        g1IdMap.push({ meta: extraR, id: u.primaryId });
      });

      const g2Branches: Array<{ meta: HiveMeta; parentId: string }> = [];
      g1IdMap.forEach((r) => {
        r.meta.children.forEach((g2) => {
          g2Branches.push({ meta: g2, parentId: r.id });
        });
      });

      const estimateBranchWidthCols = (hm: HiveMeta): number => {
        if (hm.children.length === 0) return 3;
        const totalDesc = hm.cellCount;
        return Math.max(4, Math.ceil(Math.sqrt(totalDesc) * 2.1));
      };

      const branchColWidths = g2Branches.map((b) =>
        estimateBranchWidthCols(b.meta)
      );
      const totalCols =
        branchColWidths.reduce((s, w) => s + w, 0) +
        Math.max(0, g2Branches.length - 1) * 1.5;

      let cursorCol = -totalCols / 2;
      const g2Plans: Array<{
        meta: HiveMeta;
        g2Id: string;
        spanStartCol: number;
        spanEndCol: number;
      }> = [];

      // Tahap 1: Tempatkan G2 di baris 2 dan cadangkan ring polosnya
      g2Branches.forEach((br, idx) => {
        const spanW = branchColWidths[idx];
        const midCol = cursorCol + spanW / 2;
        const [c2, r2] = findNearestFreeCell(midCol * stepX, 2 * stepY, 2);
        const g2Unit = spawnHexUnitAt(br.meta, c2, r2, br.parentId, 1, 0);
        reservePolosRing(g2Unit.cells);

        g2Plans.push({
          meta: br.meta,
          g2Id: g2Unit.primaryId,
          spanStartCol: cursorCol,
          spanEndCol: cursorCol + spanW,
        });
        cursorCol += spanW + 1.5;
      });

      // Tahap 2: Tempatkan tiap klaster G3 dan sub-keluarga G4–G5 di bawah baris kosong G2 (baris >= 4)
      g2Plans.forEach((plan) => {
        const g3Kids = plan.meta.children;
        if (g3Kids.length === 0) return;

        const g3Weights = g3Kids.map((c) => Math.max(2, c.cellCount));
        const totalW = g3Weights.reduce((s, w) => s + w, 0) || 1;
        const availCols = Math.max(3, plan.spanEndCol - plan.spanStartCol);
        let g3ColCursor = plan.spanStartCol;

        g3Kids.forEach((g3, g3Idx) => {
          const g3Span = (availCols * g3Weights[g3Idx]) / totalW;
          const g3MidCol = g3ColCursor + g3Span / 2;
          const startRow = g3Kids.length >= 4 && g3Idx % 2 === 1 ? 5 : 4;
          const [c3, r3] = findNearestFreeCell(
            g3MidCol * stepX,
            startRow * stepY,
            4
          );

          const g3Unit = spawnHexUnitAt(g3, c3, r3, plan.g2Id, 1, 0);
          const g3ClusterCells: Array<[number, number]> = [...g3Unit.cells];

          const g4Kids = g3.children;
          if (g4Kids.length > 0) {
            let g4Cursor = g3ColCursor;
            const g4Weights = g4Kids.map((g4) => Math.max(1, g4.cellCount));
            const sumG4W = g4Weights.reduce((s, w) => s + w, 0) || 1;

            g4Kids.forEach((g4, g4Idx) => {
              const g4Span = (g3Span * g4Weights[g4Idx]) / sumG4W;
              const g4MidCol = g4Cursor + g4Span / 2;
              packG4SubFamily(
                g4,
                g3ClusterCells,
                g3Unit.primaryId,
                g4MidCol * stepX,
                (startRow + 2.5) * stepY,
                4
              );
              g4Cursor += g4Span;
            });
          }

          g3ColCursor += g3Span;
        });
      });
    }

    // Translasi seragam (rigid translate) agar kisi segi enam tidak pernah terdistorsi!
    if (placedHiveNodes.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      placedHiveNodes.forEach((n) => {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x + hexW);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y + hexH);
      });
      const spanW = maxX - minX;
      const spanH = maxY - minY;
      const dx = Math.round((boardWidth - spanW) / 2 - minX);
      const dy = Math.round(64 + Math.max(0, (boardHeight - 84 - spanH) / 2) - minY);
      return {
        nodes: placedHiveNodes.map((n) => ({
          ...n,
          x: n.x + dx,
          y: n.y + dy,
        })),
        edges,
      };
    }

    return { nodes: placedHiveNodes, edges };
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
      if (
        n.name !== sp.name ||
        n.photo !== (sp.photoUrl || '') ||
        n.wafat !== (sp.status === 'cerai_mati')
      ) {
        updatedCount++;
      }
      survivingIds.add(n.id);
      nextNodes.push({
        ...n,
        name: sp.name,
        photo: sp.photoUrl || '',
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
        photo: sp.photoUrl || '',
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
      groupId: presetId === 'tetris_silsilah' ? `tetris_fam_${m.id}` : undefined,
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
        photo: sp.photoUrl || '',
        wafat: sp.status === 'cerai_mati',
        gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
        genLevel: m.generationLevel ?? gen,
        scaleMultiplier: scaleMult,
        cardShape,
        leafAngleDeg: leafDeg,
        leafTone: newNode.leafTone,
        groupId: newNode.groupId,
        lineageG2Id: newNode.lineageG2Id,
        lineageG2Color: newNode.lineageG2Color,
        lineageG3Id: newNode.lineageG3Id,
        lineageG3Color: newNode.lineageG3Color,
        lineageG4Id: newNode.lineageG4Id,
        lineageG4Color: newNode.lineageG4Color,
        customBgColor: bpStop?.bg || newNode.customBgColor,
        customBorderColor: bpStop?.border || newNode.customBorderColor,
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
