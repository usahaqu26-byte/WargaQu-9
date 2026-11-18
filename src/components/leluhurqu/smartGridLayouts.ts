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
  ConnectorLineStyle,
  MergedCardMember,
} from './InteractiveGridCanvasView';

export type SmartPresetId =
  | 'kotak_9_baris'
  | 'kotak_9_baris_g45_gabung'
  | 'orbit_elips_1_5'
  | 'orbit_elips_gabung'
  | 'modular_g3_I'
  | 'modular_g3_L'
  | 'hierarchy_grid_fill'
  | 'subtree_vertical'
  | 'subtree_horizontal'
  | 'family_cluster'
  | 'heritage_showcase';

export type GuideOverlayMode = 'gen_bands' | 'grid_9_rows' | 'orbit_rings';

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
  if (displayMode === 'photo_only') {
    return {
      w: Math.round((p.w + 8) * scale),
      h: Math.round((p.h + 8) * scale),
    };
  }
  if (displayMode === 'photo_name') {
    return {
      w: Math.round(Math.max(106, p.w + 16) * scale),
      h: Math.round((p.h + 30) * scale),
    };
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
  const pDim = BASE_PHOTO_DIMS[photoSize] || BASE_PHOTO_DIMS['3x4'];
  // Jarak sub-card rapat 1–2mm (~6px)
  const gap = Math.max(4, Math.round(6 * cardScale));
  const padX = Math.max(4, Math.round(6 * cardScale));
  const padY = Math.max(4, Math.round(6 * cardScale));

  let cellW: number;
  let cellH: number;
  let headerH: number;
  if (displayMode === 'photo_only') {
    cellW = Math.max(28, Math.round((pDim.w + 6) * cardScale));
    cellH = Math.max(28, Math.round((pDim.h + 6) * cardScale));
    headerH = 0;
  } else if (displayMode === 'photo_name') {
    cellW = Math.max(64, Math.round(Math.max(82, pDim.w + 16) * cardScale));
    cellH = Math.max(48, Math.round((pDim.h + 28) * cardScale));
    headerH = Math.max(16, Math.round(20 * cardScale));
  } else if (displayMode === 'name_only') {
    cellW = Math.max(76, Math.round(114 * cardScale));
    cellH = Math.max(26, Math.round(32 * cardScale));
    headerH = Math.max(16, Math.round(20 * cardScale));
  } else {
    cellW = Math.max(76, Math.round(Math.max(100, pDim.w + 26) * cardScale));
    cellH = Math.max(58, Math.round((pDim.h + 46) * cardScale));
    headerH = Math.max(18, Math.round(22 * cardScale));
  }

  if (modularSubLayout === 'I' && membersMeta && membersMeta.length >= 2) {
    // Pola I: Kepala (depth 0 + pasangannya) di baris atas, lalu generasi di bawah tersusun berbaris ke bawah
    const depthBuckets = new Map<number, number>();
    membersMeta.forEach((mm) => {
      const d = mm.depthInModule ?? 0;
      depthBuckets.set(d, (depthBuckets.get(d) || 0) + 1);
    });
    const maxRowCount = Math.max(
      1,
      ...Array.from(depthBuckets.values()).map((cnt) => Math.min(customCols || 3, cnt))
    );
    let totalSubRows = 0;
    depthBuckets.forEach((cnt) => {
      totalSubRows += Math.max(1, Math.ceil(cnt / maxRowCount));
    });
    return {
      cols: maxRowCount,
      rows: totalSubRows,
      cellW,
      cellH,
      gap,
      padX,
      padY,
      headerH,
      w: maxRowCount * cellW + Math.max(0, maxRowCount - 1) * gap + padX * 2,
      h: headerH + totalSubRows * cellH + Math.max(0, totalSubRows - 1) * gap + padY * 2 + 4,
    };
  }

  if (modularSubLayout === 'L' && membersMeta && membersMeta.length >= 2) {
    // Pola L: Kepala di kiri-atas, lengan kanan menampung cabang atas, lengan bawah menampung keturunan turun membentuk siku L
    const headCount = Math.max(1, membersMeta.filter((m) => (m.depthInModule ?? 0) === 0).length);
    const restCount = Math.max(0, membersMeta.length - headCount);
    const rightArmCols = Math.min(3, Math.max(1, Math.ceil(restCount / 2)));
    const totalCols = Math.max(headCount + 1, Math.min(4, headCount + rightArmCols));
    const downCount = Math.max(1, restCount - rightArmCols);
    const totalRows = 1 + Math.ceil(downCount / Math.min(2, totalCols));
    return {
      cols: totalCols,
      rows: totalRows,
      cellW,
      cellH,
      gap,
      padX,
      padY,
      headerH,
      w: totalCols * cellW + Math.max(0, totalCols - 1) * gap + padX * 2,
      h: headerH + totalRows * cellH + Math.max(0, totalRows - 1) * gap + padY * 2 + 4,
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
    cols,
    rows,
    cellW,
    cellH,
    gap,
    padX,
    padY,
    headerH,
    w: cols * cellW + (cols - 1) * gap + padX * 2,
    h: headerH + rows * cellH + (rows - 1) * gap + padY * 2,
  };
}

// Hitung skala ukuran kartu & foto paling ideal agar kertas pilihan (mis. A3) terisi pas: tidak terlalu kosong & tidak menumpuk
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

  // Batas vertikal minimal per generasi (untuk konsep 9 baris, pastikan muat 9 baris simetris)
  const effectiveBandCount =
    presetId === 'kotak_9_baris'
      ? Math.max(genCount, 9)
      : presetId === 'kotak_9_baris_g45_gabung'
      ? Math.max(genCount, 6)
      : presetId === 'orbit_elips_1_5' || presetId === 'orbit_elips_gabung'
      ? Math.max(genCount, 7)
      : genCount;

  const bandGap =
    presetId === 'kotak_9_baris' || presetId === 'orbit_elips_1_5' ? 16 : 28;
  const maxVertScale =
    (usableH - Math.max(1, effectiveBandCount) * bandGap) /
    Math.max(1, effectiveBandCount * base1.h);

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
    id: 'modular_g3_I',
    title: 'Modular Card G3 Pola I (G1–G2 Besar)',
    subtitle: 'G1–G2 Besar di Atas/Tengah • Card G3 Bungkus Anak–Cucu Vertikal (1.5mm)',
    badge: 'Modular I',
    category: 'modular',
    description:
      'Menampilkan G1–G2 berukuran lebih besar di atas/tengah, sementara tiap G3 menjadi Card Modular yang merangkum sub-card anak & cucu tersusun lurus ke bawah berjarak 1–2mm sesuai garis keturunan.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'pcb90',
    recommendedGuideMode: 'gen_bands',
    recommendedGenGradient: 'royal_emerald',
  },
  {
    id: 'modular_g3_L',
    title: 'Modular Card G3 Pola L (Siku Anak–Cucu)',
    subtitle: 'G1–G2 Besar • Card G3 Membentuk Siku L Anak–Cucu Menempel (1.5mm)',
    badge: 'Modular L',
    category: 'modular',
    description:
      'G1–G2 tampil lebih besar sebagai pusat trah, lalu setiap cabang G3 menjadi Card Modular berbentuk siku L yang menyatukan sub-card anak & cucu berjarak 1–2mm dengan pasangan menempel.',
    recommendedTheme: 'dark',
    recommendedBg: '',
    recommendedOrientation: 'landscape',
    recommendedCardMode: 'full',
    recommendedPhotoSize: '2x3',
    recommendedLineStyle: 'pcb45',
    recommendedGuideMode: 'gen_bands',
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
  }
): { nodes: InteractiveNode[]; edges: InteractiveEdge[] } {
  if (!members || members.length === 0) {
    return { nodes: [], edges: [] };
  }

  const displayMode: CardDisplayMode = options?.displayMode ?? 'full';
  const photoSize: PhotoFrameSize = options?.photoSize ?? '3x4';
  const cardScale: number = options?.cardScale ?? 1;
  const cardGapMm: number = Math.max(1, Math.min(5, options?.cardGapMm ?? 2.5));
  const modularG12Position: 'top' | 'center' = options?.modularG12Position ?? 'top';

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

      // Jika semua anak adalah daun (tidak punya cucu) dan jumlahnya banyak, susun rapi jadi grid 2..4 kolom tepat di bawah orang tua agar jarak tetap pendek!
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

      const kidsTotalW =
        measuredKids.length > 0
          ? measuredKids.reduce((s, ch) => s + ch.blockW, 0) +
            (measuredKids.length - 1) * kidGapX
          : 0;
      const kidsMaxH =
        measuredKids.length > 0 ? Math.max(...measuredKids.map((ch) => ch.blockH)) : 0;

      const blockW = Math.max(unitW, kidsTotalW);
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

      if (block.isLeafGrid) {
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

    return fitNodesInsideBoard(nodes, edges, boardWidth, boardHeight, cardW, cardH, leftLabelMargin);
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

    return fitNodesInsideBoard(nodes, edges, boardWidth, boardHeight, cardW, cardH, 24);
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

    return fitNodesInsideBoard(nodes, edges, boardWidth, boardHeight, cardW, cardH, 24);
  }

  // -------------------------------------------------------------------------
  // MODE MODULAR G3 POLA I / L (G1–G2 BESAR DI ATAS/TENGAH + CARD G3 BUNGKUS ANAK–CUCU)
  // -------------------------------------------------------------------------
  if (presetId === 'modular_g3_I' || presetId === 'modular_g3_L') {
    const modularLayout: 'I' | 'L' = presetId === 'modular_g3_L' ? 'L' : 'I';
    const bigScaleMult = 1.32;
    const bigW = Math.round(cardW * bigScaleMult);
    const bigH = Math.round(cardH * bigScaleMult);
    const leftM = 28;
    const rightM = 28;
    const usableW = Math.max(320, boardWidth - leftM - rightM);

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

    // Kumpulkan G1, G2, dan kepala G3 (depth === 2 atau anak terakhir sebelum cabang)
    const g1List: ModNode[] = [];
    const g2List: { node: ModNode; parentId: string | null }[] = [];
    const g3Heads: { node: ModNode; parentId: string | null }[] = [];

    const walkTop = (mn: ModNode, parentId: string | null) => {
      if (mn.depth === 0) {
        g1List.push(mn);
        mn.children.forEach((c) => walkTop(c, mn.member.id));
      } else if (mn.depth === 1) {
        g2List.push({ node: mn, parentId });
        mn.children.forEach((c) => walkTop(c, mn.member.id));
      } else if (mn.depth === 2) {
        g3Heads.push({ node: mn, parentId });
      } else {
        g3Heads.push({ node: mn, parentId });
      }
    };
    modRoots.forEach((r) => walkTop(r, null));

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

    const g3Boxes = g3Heads.map(({ node: head, parentId }) => {
      const sub = collectModularSubtree(head);
      if (sub.members.length >= 2) {
        const metrics = computeMergedCardMetrics(
          sub.members.length,
          displayMode,
          photoSize,
          cardScale,
          undefined,
          modularLayout,
          sub.members
        );
        return {
          isMerged: true,
          head,
          parentId,
          members: sub.members,
          snapshotEdges: sub.snapshotEdges,
          w: metrics.w,
          h: metrics.h,
        };
      }
      return {
        isMerged: false,
        head,
        parentId,
        members: sub.members,
        snapshotEdges: sub.snapshotEdges,
        w: cardW,
        h: cardH,
      };
    });

    const moduleGapX = Math.max(unmarriedGapPx, Math.round(cardGapMm * MM_TO_PX));
    const bandGapY = Math.max(24, Math.round(cardGapMm * MM_TO_PX * 2.4));

    const placeBigUnit = (m: FamilyMember, centerX: number, topY: number, parentNodeId: string | null, depth: number) => {
      const spCount = m.spouses?.length || 0;
      const totalUnitW = bigW + spCount * bigW;
      let startX = centerX - totalUnitW / 2;
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
        scaleMultiplier: bigScaleMult,
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
          x: Math.round(startX + (sIdx + 1) * bigW),
          y: Math.round(topY),
          photo: '',
          wafat: sp.status === 'cerai_mati',
          gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
          genLevel: m.generationLevel ?? depth,
          scaleMultiplier: bigScaleMult,
        });
        edges.push({ from: primaryId, to: spId, type: 'couple' });
      });
      return primaryId;
    };

    const g1RowH = g1List.length > 0 ? bigH : 0;
    const g2RowH = g2List.length > 0 ? bigH : 0;

    // Bagi g3Boxes ke 1 baris (mode Atas) atau 2 sayap atas+bawah (mode Tengah)
    const placeG3Row = (boxes: typeof g3Boxes, startY: number) => {
      if (boxes.length === 0) return startY;
      // Wrap jika lebar melebihi usableW
      const rowsG3: typeof g3Boxes[] = [];
      let curR: typeof g3Boxes = [];
      let curW = 0;
      boxes.forEach((bx) => {
        const addW = curR.length === 0 ? bx.w : curW + moduleGapX + bx.w;
        if (curR.length > 0 && addW > usableW) {
          rowsG3.push(curR);
          curR = [bx];
          curW = bx.w;
        } else {
          curR.push(bx);
          curW = addW;
        }
      });
      if (curR.length > 0) rowsG3.push(curR);

      let curY = startY;
      rowsG3.forEach((rowItems) => {
        const totalRowW =
          rowItems.reduce((s, it) => s + it.w, 0) +
          Math.max(0, rowItems.length - 1) * moduleGapX;
        let curX = leftM + Math.max(0, (usableW - totalRowW) / 2);
        const maxRowH = Math.max(...rowItems.map((it) => it.h));

        rowItems.forEach((item) => {
          const m = item.head.member;
          const pNodeId = item.parentId ? `n_${item.parentId}` : null;
          if (item.isMerged) {
            const modId = `mod_g3_${m.id}`;
            nodes.push({
              id: modId,
              name: `Cabang ${m.name}`,
              sub: `G3 Modular (${item.members.length} Org)`,
              x: Math.round(curX),
              y: Math.round(curY),
              photo: m.photoUrl || '',
              wafat: item.members.every((x) => x.wafat),
              genLevel: m.generationLevel ?? 2,
              mergedMembers: item.members,
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
              x: Math.round(curX),
              y: Math.round(curY),
              photo: m.photoUrl || '',
              wafat: m.isDeceased,
              gender: m.gender,
              memberId: m.id,
              genLevel: m.generationLevel ?? 2,
            });
            if (pNodeId) {
              edges.push({ from: pNodeId, to: cid, type: 'child' });
            }
          }
          curX += item.w + moduleGapX;
        });
        curY += maxRowH + bandGapY;
      });
      return curY;
    };

    const g1UnitsW =
      g1List.reduce((s, r) => s + (1 + (r.member.spouses?.length || 0)) * bigW, 0) +
      Math.max(0, g1List.length - 1) * 24;
    const g2UnitsW =
      g2List.reduce((s, r) => s + (1 + (r.node.member.spouses?.length || 0)) * bigW, 0) +
      Math.max(0, g2List.length - 1) * 18;

    if (modularG12Position === 'center' && g3Boxes.length >= 2) {
      const splitIdx = Math.ceil(g3Boxes.length / 2);
      const upperG3 = g3Boxes.slice(0, splitIdx);
      const lowerG3 = g3Boxes.slice(splitIdx);
      let cursorY = topSafeY;
      cursorY = placeG3Row(upperG3, cursorY);

      if (g1List.length > 0) {
        let gx = leftM + Math.max(0, (usableW - g1UnitsW) / 2);
        g1List.forEach((g1) => {
          const uw = (1 + (g1.member.spouses?.length || 0)) * bigW;
          placeBigUnit(g1.member, gx + uw / 2, cursorY, null, 0);
          gx += uw + 24;
        });
        cursorY += g1RowH + bandGapY;
      }
      if (g2List.length > 0) {
        let gx = leftM + Math.max(0, (usableW - g2UnitsW) / 2);
        g2List.forEach(({ node: g2, parentId }) => {
          const uw = (1 + (g2.member.spouses?.length || 0)) * bigW;
          placeBigUnit(g2.member, gx + uw / 2, cursorY, parentId ? `n_${parentId}` : null, 1);
          gx += uw + 18;
        });
        cursorY += g2RowH + bandGapY;
      }
      placeG3Row(lowerG3, cursorY);
    } else {
      let cursorY = topSafeY;
      if (g1List.length > 0) {
        let gx = leftM + Math.max(0, (usableW - g1UnitsW) / 2);
        g1List.forEach((g1) => {
          const uw = (1 + (g1.member.spouses?.length || 0)) * bigW;
          placeBigUnit(g1.member, gx + uw / 2, cursorY, null, 0);
          gx += uw + 24;
        });
        cursorY += g1RowH + bandGapY;
      }
      if (g2List.length > 0) {
        let gx = leftM + Math.max(0, (usableW - g2UnitsW) / 2);
        g2List.forEach(({ node: g2, parentId }) => {
          const uw = (1 + (g2.member.spouses?.length || 0)) * bigW;
          placeBigUnit(g2.member, gx + uw / 2, cursorY, parentId ? `n_${parentId}` : null, 1);
          gx += uw + 18;
        });
        cursorY += g2RowH + bandGapY;
      }
      placeG3Row(g3Boxes, cursorY);
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

    return {
      nodes: allPlaced.map((p) => p.node),
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

    // Resolusi tabrakan ringan agar setiap kartu tetap di posisi sudut terdekatnya tanpa saling bertumpuk
    const minBX = 20;
    const minBY = 66;
    for (let pass = 0; pass < 16; pass++) {
      let moved = false;
      for (let i = 0; i < placedBoxes.length; i++) {
        for (let j = i + 1; j < placedBoxes.length; j++) {
          const a = placedBoxes[i];
          const b = placedBoxes[j];
          const pad = 10;
          const overlapX =
            Math.min(a.node.x + a.w + pad, b.node.x + b.w) -
            Math.max(a.node.x, b.node.x - pad);
          const overlapY =
            Math.min(a.node.y + a.h + pad, b.node.y + b.h) -
            Math.max(a.node.y, b.node.y - pad);
          if (overlapX > 0 && overlapY > 0) {
            const aCx = a.node.x + a.w / 2;
            const aCy = a.node.y + a.h / 2;
            const bCx = b.node.x + b.w / 2;
            const bCy = b.node.y + b.h / 2;
            let dx = bCx - aCx;
            let dy = bCy - aCy;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
              dx = Math.cos(b.angle || 0.5) * 14;
              dy = Math.sin(b.angle || 0.5) * 14;
            }
            const dist = Math.hypot(dx, dy) || 1;
            const push = Math.min(overlapX, overlapY) * 0.55 + 2;
            const px = (dx / dist) * push;
            const py = (dy / dist) * push;

            // Pertahankan node pusat (orbit 0) tetap stabil di tengah bila memungkinkan
            if (a.orbitRing === 0) {
              b.node.x += px * 1.4;
              b.node.y += py * 1.4;
            } else if (b.orbitRing === 0) {
              a.node.x -= px * 1.4;
              a.node.y -= py * 1.4;
            } else {
              a.node.x -= px;
              a.node.y -= py;
              b.node.x += px;
              b.node.y += py;
            }
            moved = true;
          }
        }
      }
      placedBoxes.forEach((p) => {
        p.node.x = Math.round(
          Math.max(minBX, Math.min(boardWidth - p.w - 20, p.node.x))
        );
        p.node.y = Math.round(
          Math.max(minBY, Math.min(boardHeight - p.h - 24, p.node.y))
        );
      });
      if (!moved) break;
    }

    return {
      nodes: placedBoxes.map((p) => p.node),
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

  return fitNodesInsideBoard(nodes, edges, boardWidth, boardHeight, cardW, cardH, 24);
}

// Menjaga seluruh pohon tetap di dalam batas kertas secara proporsional tanpa menggeser kartu jadi tumpang tindih!
function fitNodesInsideBoard(
  nodes: InteractiveNode[],
  edges: InteractiveEdge[],
  boardWidth: number,
  boardHeight: number,
  cardW: number,
  cardH: number,
  minLeftX = 20
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

  // Kompres proporsional seluruh posisi X jika lebar total melebihi kertas (sehingga tidak ada kartu bertumpuk di tepi kanan)
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

  return { nodes: adjusted, edges };
}
