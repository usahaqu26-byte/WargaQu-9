import { FamilyMember } from './LeluhurQuView';
import type {
  InteractiveNode,
  InteractiveEdge,
  GridPaperSize,
  GridPaperOrientation,
  CardDisplayMode,
  PhotoFrameSize,
  CanvasTheme,
  CanvasBackground,
} from './InteractiveGridCanvasView';

export type SmartPresetId =
  | 'hierarchy_grid_fill'
  | 'subtree_vertical'
  | 'subtree_horizontal'
  | 'family_cluster'
  | 'heritage_showcase';

export interface SmartLayoutPreset {
  id: SmartPresetId;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  recommendedTheme: CanvasTheme;
  recommendedBg: CanvasBackground;
  recommendedOrientation: GridPaperOrientation;
  recommendedCardMode: CardDisplayMode;
  recommendedPhotoSize: PhotoFrameSize;
}

export interface SmartAnalysisSummary {
  totalPeopleWithSpouses: number;
  generationCount: number;
  recommendedPaper: GridPaperSize;
  topPresetId: SmartPresetId;
  reason: string;
}

const BASE_PHOTO_DIMS: Record<PhotoFrameSize, { w: number; h: number }> = {
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
  const p = BASE_PHOTO_DIMS[photoSize];
  if (displayMode === 'photo_only') {
    return {
      w: Math.round((p.w + 10) * scale),
      h: Math.round((p.h + 10) * scale),
    };
  }
  if (displayMode === 'name_only') {
    return {
      w: Math.round(126 * scale),
      h: Math.round(38 * scale),
    };
  }
  return {
    w: Math.round(Math.max(145, p.w + 36) * scale),
    h: Math.round((p.h + 52) * scale),
  };
}

// Hitung skala ukuran kartu & foto paling ideal agar kertas pilihan (mis. A3) terisi pas: tidak terlalu kosong & tidak menumpuk
export function computeOptimalCardScale(
  members: FamilyMember[],
  boardWidth: number,
  boardHeight: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize
): number {
  const spouseCount = members.reduce(
    (sum, m) => sum + (m.spouses ? m.spouses.length : 0),
    0
  );
  const totalCards = Math.max(1, members.length + spouseCount);
  const genCounts = new Map<number, number>();
  members.forEach((m) => {
    const g = m.generationLevel ?? 0;
    genCounts.set(g, (genCounts.get(g) ?? 0) + 1 + (m.spouses ? m.spouses.length : 0));
  });
  const genCount = Math.max(1, genCounts.size);

  const base1 = getBaseCardSizeForScale(displayMode, photoSize, 1);
  const usableW = Math.max(320, boardWidth - 116);
  const usableH = Math.max(260, boardHeight - 160);

  const minAllowedScale = totalCards > 40 ? 0.38 : totalCards > 24 ? 0.45 : 0.55;

  // Target total area kartu + celah garis sekitar 58% dari bidang usable agar tetap bersih & penuh proporsional
  const targetCoverage = totalCards <= 10 ? 0.48 : 0.58;
  const cellAreaAt1 = (base1.w + 26) * (base1.h + 40);
  const rawScale = Math.sqrt((usableW * usableH * targetCoverage) / (totalCards * cellAreaAt1));

  // Estimasi jumlah sub-baris nyata (termasuk pembungkusan generasi padat) agar semua baris muat vertikal tanpa saling menumpuk
  let candidate = Math.max(minAllowedScale, Math.min(1.45, rawScale));
  for (let iter = 0; iter < 6; iter++) {
    const cW = Math.max(46, base1.w * candidate);
    const cH = Math.max(24, base1.h * candidate);
    const gapX = Math.max(10, cW * 0.14);
    const maxCols = Math.max(1, Math.floor((usableW + gapX) / (cW + gapX)));
    let estSubRows = 0;
    genCounts.forEach((cnt) => {
      estSubRows += Math.max(1, Math.ceil(cnt / maxCols));
    });
    const minRowGap = Math.max(14, cH * 0.22);
    const neededH = estSubRows * cH + Math.max(0, estSubRows - 1) * minRowGap;
    if (neededH <= usableH || candidate <= minAllowedScale) {
      break;
    }
    candidate = Math.max(minAllowedScale, candidate * 0.9);
  }

  // Batas vertikal minimal per generasi
  const maxVertScale =
    (usableH - Math.max(1, genCount) * 28) / Math.max(1, genCount * base1.h);

  const bounded = Math.min(candidate, Math.max(minAllowedScale, maxVertScale));
  const clamped = Math.max(minAllowedScale, Math.min(1.45, bounded));
  return Math.round(clamped * 20) / 20; // kelipatan 5% (0.05)
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
  let reason = `${totalPeopleWithSpouses} kartu dalam ${generationCount} generasi siap ditata penuh ke kertas A3/pilihan dengan pita generasi & garis hirarki tanpa menyisakan ruang kosong.`;

  if (totalPeopleWithSpouses <= 16 && generationCount <= 4) {
    topPresetId = 'subtree_vertical';
    reason = `Cocok untuk ${totalPeopleWithSpouses} kartu (${generationCount} generasi) agar garis keturunan lurus tegak dan foto besar mengisi kertas.`;
  } else if (generationCount >= 6 && totalPeopleWithSpouses <= 28) {
    topPresetId = 'subtree_horizontal';
    reason = `${generationCount} tingkatan generasi rapi mengalir kiri ke kanan; atau pilih "Isi Penuh Kertas" agar padat seimbang di A3.`;
  }

  return {
    totalPeopleWithSpouses,
    generationCount,
    recommendedPaper,
    topPresetId,
    reason,
  };
}

export const SMART_LAYOUT_PRESETS: SmartLayoutPreset[] = [
  {
    id: 'hierarchy_grid_fill',
    title: 'Isi Penuh Kertas (Anti-Kosong & Garis Generasi)',
    subtitle: 'Muat penuh di A3/pilihan • Baris rapi + jalur garis & label Gen',
    badge: 'Pas Kertas',
    description:
      'Membungkus cabang ke beberapa baris di dalam kertas pilihan (misal A3) agar tidak ada ruang kosong terbuang, sambil menandai jalur generasi dan garis hirarki nasab secara jelas.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '3x4',
  },
  {
    id: 'subtree_vertical',
    title: 'Pohon Ranting Vertikal (Anti-Silang)',
    subtitle: 'Garis keturunan tegak lurus • Orang tua di tengah atas anak',
    badge: 'Paling Lurus',
    description:
      'Menghitung lebar setiap cabang keluarga secara otomatis dari data Tabel sehingga anak selalu berada di bawah orang tuanya tanpa garis yang bersilangan.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '3x4',
  },
  {
    id: 'subtree_horizontal',
    title: 'Alur Cabang Kiri ➔ Kanan',
    subtitle: 'Cocok untuk banyak generasi • Mengisi lebar kertas',
    badge: 'Lanskap Luas',
    description:
      'Menempatkan leluhur di sisi kiri dan keturunan mengalir ke kanan dengan pasangan menempel rapat sesuai lebar kertas aktif.',
    recommendedTheme: 'light',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '2x3',
  },
  {
    id: 'family_cluster',
    title: 'Klaster Keluarga Inti (Berdekatan)',
    subtitle: 'Pas untuk banyak anggota di A3 • Garis pendek & padat',
    badge: 'Hemat Kertas',
    description:
      'Mengelompokkan setiap pasangan orang tua dan anak-anaknya dalam blok berdekatan di koridor kertas sehingga tidak ada ruang kosong terbuang.',
    recommendedTheme: 'light',
    recommendedBg: '',
    recommendedOrientation: 'portrait',
    recommendedCardMode: 'name_only',
    recommendedPhotoSize: '2x3',
  },
  {
    id: 'heritage_showcase',
    title: 'Poster Silsilah Showcase',
    subtitle: 'Tampilan cetak bingkai • Latar Pohon Keluarga',
    badge: 'Siap Cetak',
    description:
      'Tata letak simetris bernuansa pohon keluarga dengan jarak seimbang untuk dicetak atau dibagikan, tetap bebas digeser jika ingin penyesuaian.',
    recommendedTheme: 'dark',
    recommendedBg: 'bg-pohon',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '3x4',
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
// GENERATOR LAYOUT PINTAR BERBASIS DATA TABEL (PARENT-CHILD + SPOUSE)
// ============================================================================
export function generateSmartLayoutFromTable(
  members: FamilyMember[],
  presetId: SmartPresetId,
  boardWidth: number,
  boardHeight: number,
  cardSize: { w: number; h: number }
): { nodes: InteractiveNode[]; edges: InteractiveEdge[] } {
  if (!members || members.length === 0) {
    return { nodes: [], edges: [] };
  }

  const { roots, childrenMap } = buildHierarchyFromMembers(members);
  const nodes: InteractiveNode[] = [];
  const edges: InteractiveEdge[] = [];

  const cardW = Math.max(54, cardSize.w);
  const cardH = Math.max(26, cardSize.h);
  const topSafeY = 72;
  const bottomSafeMargin = 88; // sisakan ruang untuk caption bar bawah
  const usableH = Math.max(240, boardHeight - topSafeY - bottomSafeMargin);

  // -------------------------------------------------------------------------
  // MODE 0: ISI PENUH KERTAS (ANTI-KOSONG & PENUNJUK GENERASI/HIRARKI)
  // -------------------------------------------------------------------------
  if (presetId === 'hierarchy_grid_fill') {
    const leftLabelMargin = 82; // ruang label GEN 1, GEN 2 di sisi kiri kertas
    const rightMargin = 34;
    const usableW = Math.max(320, boardWidth - leftLabelMargin - rightMargin);
    const coupleGap = Math.max(6, Math.round(cardW * 0.08));
    const minUnitGap = Math.max(14, Math.round(cardW * 0.16));

    interface GenUnit {
      member: FamilyMember;
      gen: number;
      dfsOrder: number;
      unitW: number;
      spouses: NonNullable<FamilyMember['spouses']>;
    }

    const unitsByGen = new Map<number, GenUnit[]>();
    const visited = new Set<string>();
    let dfsCounter = 0;

    const visit = (m: FamilyMember, depth: number) => {
      if (visited.has(m.id)) return;
      visited.add(m.id);
      const gen = Math.max(depth, m.generationLevel ?? depth);
      const spouses = m.spouses || [];
      const unitW = cardW + spouses.length * (cardW + coupleGap);

      if (!unitsByGen.has(gen)) unitsByGen.set(gen, []);
      unitsByGen.get(gen)!.push({
        member: m,
        gen,
        dfsOrder: dfsCounter++,
        unitW,
        spouses,
      });

      const kids = childrenMap.get(m.id) || [];
      kids.forEach((c) => visit(c, gen + 1));
    };

    roots.forEach((r) => visit(r, r.generationLevel ?? 0));
    members.forEach((m) => {
      if (!visited.has(m.id)) visit(m, m.generationLevel ?? 0);
    });

    const sortedGens = Array.from(unitsByGen.keys()).sort((a, b) => a - b);

    // Bagi setiap generasi ke dalam sub-baris seimbang agar pas lebar kertas tanpa meluber ke A2
    const packGenIntoSubRows = (units: GenUnit[]): GenUnit[][] => {
      if (units.length === 0) return [];
      const rows: GenUnit[][] = [];
      let currentRow: GenUnit[] = [];
      let currentW = 0;

      units.forEach((u) => {
        const nextW = currentRow.length === 0 ? u.unitW : currentW + minUnitGap + u.unitW;
        if (currentRow.length > 0 && nextW > usableW) {
          rows.push(currentRow);
          currentRow = [u];
          currentW = u.unitW;
        } else {
          currentRow.push(u);
          currentW = nextW;
        }
      });
      if (currentRow.length > 0) rows.push(currentRow);

      // Seimbangkan jumlah item jika baris terakhir terlalu jomplang
      if (rows.length === 2 && rows[0].length > rows[1].length + 2) {
        const merged = [...rows[0], ...rows[1]];
        const splitIdx = Math.ceil(merged.length / 2);
        const firstHalf = merged.slice(0, splitIdx);
        const secondHalf = merged.slice(splitIdx);
        const sumW = (arr: GenUnit[]) =>
          arr.reduce((s, x) => s + x.unitW, 0) + Math.max(0, arr.length - 1) * minUnitGap;
        if (sumW(firstHalf) <= usableW && sumW(secondHalf) <= usableW) {
          return [firstHalf, secondHalf];
        }
      }
      return rows;
    };

    interface PlannedSubRow {
      gen: number;
      genIndex: number;
      isFirstInGen: boolean;
      units: GenUnit[];
    }

    const memberNodePosX = new Map<string, number>();
    const memberNodeIdMap = new Map<string, string>();
    const allSubRows: PlannedSubRow[] = [];

    sortedGens.forEach((genVal, gIdx) => {
      const genUnits = [...(unitsByGen.get(genVal) || [])];
      // Urutkan berdasarkan posisi X orang tua agar garis ke anak tetap dekat dan minim silang
      genUnits.sort((a, b) => {
        const pxA = a.member.parentId ? memberNodePosX.get(a.member.parentId) : undefined;
        const pxB = b.member.parentId ? memberNodePosX.get(b.member.parentId) : undefined;
        if (pxA !== undefined && pxB !== undefined && pxA !== pxB) {
          return pxA - pxB;
        }
        return a.dfsOrder - b.dfsOrder;
      });

      const subRows = packGenIntoSubRows(genUnits);
      subRows.forEach((sr, srIdx) => {
        allSubRows.push({
          gen: genVal,
          genIndex: gIdx,
          isFirstInGen: srIdx === 0,
          units: sr,
        });
      });

      // Simpan estimasi X sementara untuk pengurutan generasi berikutnya
      subRows.forEach((sr) => {
        const unitsSumW = sr.reduce((s, u) => s + u.unitW, 0);
        const extraSpace = Math.max(0, usableW - unitsSumW);
        const dynamicGap =
          sr.length > 1
            ? Math.min(Math.max(minUnitGap, Math.round(cardW * 0.65)), Math.floor(extraSpace / (sr.length - 1)))
            : minUnitGap;
        const rowContentW = unitsSumW + Math.max(0, sr.length - 1) * dynamicGap;
        let cx = leftLabelMargin + Math.max(0, (usableW - rowContentW) / 2);
        sr.forEach((u) => {
          memberNodePosX.set(u.member.id, cx + u.unitW / 2);
          cx += u.unitW + dynamicGap;
        });
      });
    });

    const totalSubRows = Math.max(1, allSubRows.length);
    const totalCardsHeight = totalSubRows * cardH;
    const rawAvailableGapTotal = Math.max(0, usableH - totalCardsHeight);

    // Hitung bobot celah: celah antar-generasi sedikit lebih lega daripada sub-baris dalam 1 generasi
    const gapWeights = allSubRows.slice(1).map((sr) => (sr.isFirstInGen ? 1.45 : 1.0));
    const sumWeights = gapWeights.reduce((s, w) => s + w, 0) || 1;

    const desiredMinGap = Math.max(18, Math.round(cardH * 0.24));
    const maxUniformGap = Math.max(desiredMinGap + 24, Math.round(cardH * 0.95));
    // Jika banyak baris sehingga celah standar berisiko meluap ke bawah kertas, kompres celah secara proporsional agar semua baris muat tanpa menumpuk!
    const adaptiveMinGap =
      allSubRows.length > 1
        ? Math.max(8, Math.min(desiredMinGap, Math.floor(rawAvailableGapTotal / sumWeights)))
        : desiredMinGap;

    const effectiveGapTotal = Math.min(
      rawAvailableGapTotal,
      Math.max(sumWeights * adaptiveMinGap, sumWeights * maxUniformGap)
    );
    const unitGapWeightPx = sumWeights > 0 ? effectiveGapTotal / sumWeights : 0;

    const totalLayoutH = totalCardsHeight + (allSubRows.length > 1 ? effectiveGapTotal : 0);
    let curY = topSafeY + Math.max(0, (usableH - totalLayoutH) / 2);

    allSubRows.forEach((sr, idx) => {
      if (idx > 0) {
        const w = sr.isFirstInGen ? 1.45 : 1.0;
        curY += Math.max(adaptiveMinGap, Math.round(unitGapWeightPx * w));
      }

      const srUnits = sr.units;
      const unitsSumW = srUnits.reduce((s, u) => s + u.unitW, 0);
      const extraSpace = Math.max(0, usableW - unitsSumW);

      // Sebar unit dalam baris agar memenuhi lebar kertas dengan proporsional (namun pasangan tetap nempel rapat!)
      const dynamicUnitGap =
        srUnits.length > 1
          ? Math.min(
              Math.max(minUnitGap, Math.round(usableW / Math.max(srUnits.length, 4) * 0.35)),
              Math.floor(extraSpace / (srUnits.length - 1))
            )
          : minUnitGap;

      const rowContentW = unitsSumW + Math.max(0, srUnits.length - 1) * dynamicUnitGap;
      let curX = leftLabelMargin + Math.max(0, (usableW - rowContentW) / 2);

      srUnits.forEach((u) => {
        const m = u.member;
        const primaryId = `n_${m.id}`;
        memberNodeIdMap.set(m.id, primaryId);

        nodes.push({
          id: primaryId,
          name: m.name,
          sub: m.callName || (sr.genIndex === 0 ? 'Leluhur Utama' : `Generasi ${sr.genIndex + 1}`),
          x: Math.round(curX),
          y: Math.round(curY),
          photo: m.photoUrl || '',
          wafat: m.isDeceased,
          gender: m.gender,
          memberId: m.id,
          genLevel: sr.genIndex,
        });

        u.spouses.forEach((sp, sIdx) => {
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
            x: Math.round(curX + (sIdx + 1) * (cardW + coupleGap)),
            y: Math.round(curY),
            photo: '',
            wafat: sp.status === 'cerai_mati',
            gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
            genLevel: sr.genIndex,
          });
          edges.push({ from: primaryId, to: spId, type: 'couple' });
        });

        curX += u.unitW + dynamicUnitGap;
      });

      curY += cardH;
    });

    // Sambungkan seluruh garis keturunan orang tua -> anak
    members.forEach((m) => {
      if (m.parentId && memberNodeIdMap.has(m.parentId) && memberNodeIdMap.has(m.id)) {
        edges.push({
          from: memberNodeIdMap.get(m.parentId)!,
          to: memberNodeIdMap.get(m.id)!,
          type: 'child',
        });
      }
    });

    return clampNodesSafe(nodes, edges, boardWidth, boardHeight, cardW, cardH);
  }

  // -------------------------------------------------------------------------
  // MODE 1 & 4: SUBTREE VERTIKAL ANTI-SILANG (Top-Down)
  // -------------------------------------------------------------------------
  if (presetId === 'subtree_vertical' || presetId === 'heritage_showcase') {
    const coupleGap = Math.max(6, Math.round(cardW * 0.08));
    const siblingGap = Math.max(16, Math.round(cardW * 0.22));

    interface MeasuredBranch {
      member: FamilyMember;
      unitW: number;
      childrenTotalW: number;
      subtreeW: number;
      depth: number;
      children: MeasuredBranch[];
    }

    let maxTreeDepth = 0;
    const seen = new Set<string>();
    const measure = (m: FamilyMember, depth: number): MeasuredBranch => {
      seen.add(m.id);
      maxTreeDepth = Math.max(maxTreeDepth, depth);
      const spCount = m.spouses ? m.spouses.length : 0;
      const unitW = cardW + spCount * (cardW + coupleGap);

      const rawChildren = (childrenMap.get(m.id) || []).filter(
        (c) => !seen.has(c.id)
      );
      const measuredChildren = rawChildren.map((c) => measure(c, depth + 1));

      const childrenTotalW =
        measuredChildren.length > 0
          ? measuredChildren.reduce((sum, ch) => sum + ch.subtreeW, 0) +
            (measuredChildren.length - 1) * siblingGap
          : 0;

      const subtreeW = Math.max(unitW, childrenTotalW);
      return {
        member: m,
        unitW,
        childrenTotalW,
        subtreeW,
        depth,
        children: measuredChildren,
      };
    };

    const measuredRoots = roots
      .filter((r) => !seen.has(r.id))
      .map((r) => measure(r, 0));

    // Hitung tinggi baris adaptif agar generasi mengisi tinggi kertas secara seimbang
    const numLevels = maxTreeDepth + 1;
    const idealRowStep =
      numLevels > 1
        ? Math.min(
            cardH + 135,
            Math.max(cardH + 46, Math.floor((usableH - cardH) / (numLevels - 1)))
          )
        : cardH + 75;

    const forestTotalW =
      measuredRoots.reduce((s, r) => s + r.subtreeW, 0) +
      Math.max(0, measuredRoots.length - 1) * 48;

    const scaleCompression =
      forestTotalW > boardWidth - 80
        ? Math.max(0.56, (boardWidth - 80) / forestTotalW)
        : 1;

    const place = (
      branch: MeasuredBranch,
      leftX: number,
      topY: number,
      parentPrimaryNodeId: string | null,
      depth: number
    ) => {
      const m = branch.member;
      const effectiveSubtreeW = branch.subtreeW * scaleCompression;
      const unitStartX = leftX + (effectiveSubtreeW - branch.unitW) / 2;

      const primaryId = `n_${m.id}`;
      nodes.push({
        id: primaryId,
        name: m.name,
        sub:
          m.callName ||
          (depth === 0 ? 'Leluhur Utama' : `Generasi ${depth + 1}`),
        x: Math.round(unitStartX),
        y: Math.round(topY),
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        memberId: m.id,
        genLevel: depth,
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
          x: Math.round(unitStartX + (sIdx + 1) * (cardW + coupleGap)),
          y: Math.round(topY),
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: depth,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      if (branch.children.length > 0) {
        const effChildrenTotalW = branch.childrenTotalW * scaleCompression;
        let childX =
          leftX + Math.max(0, (effectiveSubtreeW - effChildrenTotalW) / 2);
        const childY = topY + idealRowStep;

        branch.children.forEach((ch) => {
          place(ch, childX, childY, primaryId, depth + 1);
          childX += (ch.subtreeW + siblingGap) * scaleCompression;
        });
      }
    };

    const totalRenderW = forestTotalW * scaleCompression;
    let curRootX = Math.max(36, (boardWidth - totalRenderW) / 2);
    const totalTreeH = numLevels > 1 ? (numLevels - 1) * idealRowStep + cardH : cardH;
    const startY = topSafeY + Math.max(0, (usableH - totalTreeH) / 2);

    measuredRoots.forEach((rb) => {
      place(rb, curRootX, startY, null, 0);
      curRootX += (rb.subtreeW + 48) * scaleCompression;
    });

    return clampAndCenterNodes(nodes, edges, boardWidth, boardHeight, cardW, cardH);
  }

  // -------------------------------------------------------------------------
  // MODE 2: CABANG HORIZONTAL KIRI -> KANAN
  // -------------------------------------------------------------------------
  if (presetId === 'subtree_horizontal') {
    const spouseGapY = Math.max(6, Math.round(cardH * 0.08));
    const siblingGapY = Math.max(14, Math.round(cardH * 0.16));

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

    const numLevels = maxTreeDepth + 1;
    const usableW = Math.max(320, boardWidth - 100);
    const colGap =
      numLevels > 1
        ? Math.min(
            cardW + 150,
            Math.max(cardW + 46, Math.floor((usableW - cardW) / (numLevels - 1)))
          )
        : cardW + 90;

    const totalH =
      measuredRoots.reduce((s, r) => s + r.subtreeH, 0) +
      Math.max(0, measuredRoots.length - 1) * 32;
    const scaleY = totalH > usableH ? Math.max(0.55, usableH / totalH) : 1;

    const placeH = (
      branch: HBranch,
      leftX: number,
      topY: number,
      parentPrimaryNodeId: string | null,
      depth: number
    ) => {
      const m = branch.member;
      const effSubtreeH = branch.subtreeH * scaleY;
      const unitStartY = topY + (effSubtreeH - branch.unitH) / 2;

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
        genLevel: depth,
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
          genLevel: depth,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });

      if (branch.children.length > 0) {
        const effChildrenH = branch.childrenTotalH * scaleY;
        let childY = topY + Math.max(0, (effSubtreeH - effChildrenH) / 2);
        const childX = leftX + colGap;
        branch.children.forEach((ch) => {
          placeH(ch, childX, childY, primaryId, depth + 1);
          childY += (ch.subtreeH + siblingGapY) * scaleY;
        });
      }
    };

    const totalTreeW = numLevels > 1 ? (numLevels - 1) * colGap + cardW : cardW;
    const startX = Math.max(40, (boardWidth - totalTreeW) / 2);
    let curY = topSafeY + Math.max(0, (usableH - totalH * scaleY) / 2);

    measuredRoots.forEach((rb) => {
      placeH(rb, startX, curY, null, 0);
      curY += (rb.subtreeH + 32) * scaleY;
    });

    return clampAndCenterNodes(nodes, edges, boardWidth, boardHeight, cardW, cardH);
  }

  // -------------------------------------------------------------------------
  // MODE 3: KLASTER KELUARGA INTI (GARIS PENDEK & BERDEKATAN)
  // -------------------------------------------------------------------------
  const sortedByGen = [...members].sort(
    (a, b) =>
      (a.generationLevel || 0) - (b.generationLevel || 0) ||
      (a.orderIndex || 0) - (b.orderIndex || 0)
  );

  const parentGroups = sortedByGen.filter(
    (m) => (childrenMap.get(m.id) || []).length > 0
  );
  const placedMemberIds = new Set<string>();
  const coupleGap = Math.max(6, Math.round(cardW * 0.08));
  const childGap = Math.max(10, Math.round(cardW * 0.1));
  const clusterPaddingX = Math.max(24, Math.round(cardW * 0.24));
  const clusterGapY = Math.max(36, Math.round(cardH * 0.35));

  let cursorX = 44;
  let cursorY = 78;
  let rowMaxH = 0;

  const memberNodeIdMap = new Map<string, string>();

  parentGroups.forEach((parent) => {
    const kids = (childrenMap.get(parent.id) || []).filter(
      (k) => !placedMemberIds.has(k.id)
    );

    const parentUnitCount = 1 + (parent.spouses ? parent.spouses.length : 0);
    const parentRowW = parentUnitCount * cardW + (parentUnitCount - 1) * coupleGap;

    const kidsRowW =
      kids.length > 0
        ? kids.length * cardW + (kids.length - 1) * childGap
        : 0;

    const clusterW = Math.max(parentRowW, kidsRowW);
    const clusterH = kids.length > 0 ? cardH * 2 + 50 : cardH;

    if (cursorX + clusterW > boardWidth - 40 && cursorX > 44) {
      cursorX = 44;
      cursorY += rowMaxH + clusterGapY;
      rowMaxH = 0;
    }

    const parentGen = parent.generationLevel || 0;
    let parentNodeId = memberNodeIdMap.get(parent.id);
    if (!parentNodeId) {
      parentNodeId = `n_${parent.id}`;
      memberNodeIdMap.set(parent.id, parentNodeId);
      placedMemberIds.add(parent.id);

      const parentStartX = cursorX + (clusterW - parentRowW) / 2;
      nodes.push({
        id: parentNodeId,
        name: parent.name,
        sub: parent.callName || `Generasi ${parentGen + 1}`,
        x: Math.round(parentStartX),
        y: Math.round(cursorY),
        photo: parent.photoUrl || '',
        wafat: parent.isDeceased,
        gender: parent.gender,
        memberId: parent.id,
        genLevel: parentGen,
      });

      (parent.spouses || []).forEach((sp, sIdx) => {
        const spId = `n_${parent.id}_sp_${sIdx + 1}`;
        nodes.push({
          id: spId,
          name: sp.name,
          sub: 'Pasangan',
          x: Math.round(parentStartX + (sIdx + 1) * (cardW + coupleGap)),
          y: Math.round(cursorY),
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: parent.gender === 'L' ? 'P' : parent.gender === 'P' ? 'L' : undefined,
          genLevel: parentGen,
        });
        edges.push({ from: parentNodeId!, to: spId, type: 'couple' });
      });
    }

    if (kids.length > 0) {
      const parentNodeObj = nodes.find((n) => n.id === parentNodeId);
      const kidsY = parentNodeObj ? parentNodeObj.y + cardH + 46 : cursorY + cardH + 46;
      const kidsStartX = cursorX + (clusterW - kidsRowW) / 2;

      kids.forEach((kid, kIdx) => {
        const kidId = `n_${kid.id}`;
        const kidGen = kid.generationLevel ?? parentGen + 1;
        memberNodeIdMap.set(kid.id, kidId);
        placedMemberIds.add(kid.id);

        const kx = kidsStartX + kIdx * (cardW + childGap);
        nodes.push({
          id: kidId,
          name: kid.name,
          sub: kid.callName || `Generasi ${kidGen + 1}`,
          x: Math.round(kx),
          y: Math.round(kidsY),
          photo: kid.photoUrl || '',
          wafat: kid.isDeceased,
          gender: kid.gender,
          memberId: kid.id,
          genLevel: kidGen,
        });
        edges.push({ from: parentNodeId!, to: kidId, type: 'child' });
      });
    }

    cursorX += clusterW + clusterPaddingX;
    rowMaxH = Math.max(rowMaxH, clusterH);
  });

  sortedByGen.forEach((m) => {
    if (placedMemberIds.has(m.id)) return;
    if (cursorX + cardW > boardWidth - 40 && cursorX > 44) {
      cursorX = 44;
      cursorY += rowMaxH + clusterGapY;
      rowMaxH = 0;
    }
    const id = `n_${m.id}`;
    const gen = m.generationLevel || 0;
    memberNodeIdMap.set(m.id, id);
    placedMemberIds.add(m.id);
    nodes.push({
      id,
      name: m.name,
      sub: m.callName || `Generasi ${gen + 1}`,
      x: Math.round(cursorX),
      y: Math.round(cursorY),
      photo: m.photoUrl || '',
      wafat: m.isDeceased,
      gender: m.gender,
      memberId: m.id,
      genLevel: gen,
    });
    if (m.parentId && memberNodeIdMap.has(m.parentId)) {
      edges.push({
        from: memberNodeIdMap.get(m.parentId)!,
        to: id,
        type: 'child',
      });
    }
    cursorX += cardW + 18;
    rowMaxH = Math.max(rowMaxH, cardH);
  });

  return clampAndCenterNodes(nodes, edges, boardWidth, boardHeight, cardW, cardH);
}

function clampNodesSafe(
  nodes: InteractiveNode[],
  edges: InteractiveEdge[],
  boardWidth: number,
  boardHeight: number,
  cardW: number,
  cardH: number
): { nodes: InteractiveNode[]; edges: InteractiveEdge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const minBoundX = 16;
  const maxBoundX = Math.max(minBoundX + 10, boardWidth - cardW - 16);
  const minBoundY = 66;
  const maxBoundY = Math.max(minBoundY + 10, boardHeight - cardH - 16);

  const curMinY = Math.min(...nodes.map((n) => n.y));
  const curMaxY = Math.max(...nodes.map((n) => n.y));
  const curSpanY = curMaxY - curMinY;
  const availSpanY = maxBoundY - minBoundY;

  // Jika baris paling bawah melampaui batas kertas, kompres Y secara proporsional agar TIDAK ada baris yang tergencet menumpuk di dasar kertas
  const needYCompress = curMaxY > maxBoundY && curSpanY > availSpanY && curSpanY > 0;

  const adjusted = nodes.map((n) => {
    const rawY = needYCompress
      ? minBoundY + ((n.y - curMinY) / curSpanY) * availSpanY
      : n.y;
    return {
      ...n,
      x: Math.max(minBoundX, Math.min(maxBoundX, Math.round(n.x))),
      y: Math.max(minBoundY, Math.min(maxBoundY, Math.round(rawY))),
    };
  });
  return { nodes: adjusted, edges };
}

// Menjaga seluruh posisi berada rapi di dalam margin kertas dan terpusat
function clampAndCenterNodes(
  nodes: InteractiveNode[],
  edges: InteractiveEdge[],
  boardWidth: number,
  boardHeight: number,
  cardW: number,
  cardH: number
): { nodes: InteractiveNode[]; edges: InteractiveEdge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const minX = Math.min(...nodes.map((n) => n.x));
  const maxX = Math.max(...nodes.map((n) => n.x + cardW));
  const treeW = maxX - minX;

  let shiftX = 0;
  if (treeW < boardWidth - 60) {
    const desiredLeft = (boardWidth - treeW) / 2;
    shiftX = desiredLeft - minX;
  } else if (minX < 24) {
    shiftX = 24 - minX;
  }

  const minBoundX = 16;
  const maxBoundX = Math.max(minBoundX + 10, boardWidth - cardW - 16);
  const minBoundY = 66;
  const maxBoundY = Math.max(minBoundY + 10, boardHeight - cardH - 16);

  const curMinY = Math.min(...nodes.map((n) => n.y));
  const curMaxY = Math.max(...nodes.map((n) => n.y));
  const curSpanY = curMaxY - curMinY;
  const availSpanY = maxBoundY - minBoundY;
  const needYCompress = curMaxY > maxBoundY && curSpanY > availSpanY && curSpanY > 0;

  const adjusted = nodes.map((n) => {
    const rawY = needYCompress
      ? minBoundY + ((n.y - curMinY) / curSpanY) * availSpanY
      : n.y;
    return {
      ...n,
      x: Math.max(minBoundX, Math.min(maxBoundX, Math.round(n.x + shiftX))),
      y: Math.max(minBoundY, Math.min(maxBoundY, Math.round(rawY))),
    };
  });

  return { nodes: adjusted, edges };
}
