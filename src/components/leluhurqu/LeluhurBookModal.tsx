import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  FileText,
  Layers,
  LayoutGrid,
  Loader2,
  ScrollText,
  X,
  ZoomIn,
  ZoomOut,
  Check,
} from 'lucide-react';
import {
  FamilyMember,
  TrahCategory,
  getAncestryPath,
  getKinshipLabel,
  getSpouseStatusBadge,
  sortMembersHierarchically,
} from './LeluhurQuView';
import { LeluhurAccountProfile } from './LeluhurSettingsView';
import { getLineageBadgeMeta } from '../../services/leluhurCoreSyncService';
import { WargaQuLogoIcon } from '../common/WargaQuLogo';
import { MonetizationService } from '../../services/monetizationService';
import { ModularFeeSheet } from '../monetization/ModularFeeSheet';

export type BookPaperSize = 'A4' | 'A5' | 'A6';

interface PaperSpec {
  id: BookPaperSize;
  label: string;
  mmWidth: number;
  mmHeight: number;
  previewScale: number;
  caption: string;
}

const PAPER_SPECS: Record<BookPaperSize, PaperSpec> = {
  A4: {
    id: 'A4',
    label: 'A4',
    mmWidth: 210,
    mmHeight: 297,
    previewScale: 0.74,
    caption: '210 × 297 mm • Standar',
  },
  A5: {
    id: 'A5',
    label: 'A5',
    mmWidth: 148,
    mmHeight: 210,
    previewScale: 0.56,
    caption: '148 × 210 mm • Sedang',
  },
  A6: {
    id: 'A6',
    label: 'A6',
    mmWidth: 105,
    mmHeight: 148,
    previewScale: 0.42,
    caption: '105 × 148 mm • Saku',
  },
};

// Dimensi kanvas halaman kanonik (rasio exact ISO 216 1 : √2 = 794 × 1123 px)
// Sehingga isi 100% identik untuk opsi A4, A5, dan A6
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const MEMBERS_PER_PAGE = 3;

interface BookPageData {
  id: string;
  pageNumber: number;
  type: 'cover' | 'toc' | 'generation' | 'lineage_chart';
  title: string;
  generationLevel?: number;
  isContinuation?: boolean;
  members?: FamilyMember[];
}

interface LeluhurBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTrah: TrahCategory;
  accountProfile: LeluhurAccountProfile;
  showNotification: (msg: string) => void;
}

function getLineagePillarTitle(side?: TrahCategory['lineageSide']): string {
  if (!side || side === 'umum') return 'Arsip Silsilah Trah';
  const meta = getLineageBadgeMeta(side);
  return meta.label.replace(/^Pilar \d+[AB]?:\s*/i, 'Pilar ');
}

function getInitials(name: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Logo Aplikasi WargaQu (vector SVG presisi tinggi dari icon.svg)
 * Menggunakan ID gradient unik per instance agar aman di multi-halaman & ekspor PDF.
 */
const WargaQuLogoBadge: React.FC<{
  uid: string;
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
}> = ({ uid, size = 'md', subtitle = 'NasabQu • Arsip Silsilah Keluarga' }) => {
  const iconBoxClass =
    size === 'lg' ? 'w-14 h-14' : size === 'sm' ? 'w-6 h-6' : 'w-9 h-9';
  const titleClass =
    size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-base';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <WargaQuLogoIcon uid={uid} className={`${iconBoxClass} drop-shadow-xs`} />

      <div className="flex flex-col text-left leading-none">
        <div className={`${titleClass} font-extrabold italic tracking-tight text-emerald-950`}>
          warga<span className="text-emerald-700 font-black">Qu</span>
        </div>
        {subtitle && (
          <span
            className={`${
              size === 'lg' ? 'text-[11px] mt-1' : 'text-[9px] mt-0.5'
            } font-semibold text-stone-500 tracking-wide`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Komponen SVG Murni untuk Halaman Terakhir:
 * Bagan Garis Keturunan Penuh Sederhana (Hanya Nama) agar 100% muat dalam 1 halaman
 * dan anti-pecah saat dirender ke PDF.
 */
const SimpleNameLineageSvg: React.FC<{ members: FamilyMember[] }> = ({ members }) => {
  const layout = useMemo(() => {
    if (!members || members.length === 0) {
      return null;
    }

    const idSet = new Set(members.map((m) => m.id));
    const childrenMap = new Map<string, FamilyMember[]>();
    members.forEach((m) => {
      if (m.parentId && idSet.has(m.parentId)) {
        if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, []);
        childrenMap.get(m.parentId)!.push(m);
      }
    });
    childrenMap.forEach((list) =>
      list.sort(
        (a, b) =>
          (a.orderIndex || 0) - (b.orderIndex || 0) ||
          a.name.localeCompare(b.name)
      )
    );

    const roots = members
      .filter((m) => !m.parentId || !idSet.has(m.parentId))
      .sort(
        (a, b) =>
          (a.generationLevel || 0) - (b.generationLevel || 0) ||
          (a.orderIndex || 0) - (b.orderIndex || 0)
      );

    interface TreeNode {
      member: FamilyMember;
      depth: number;
      children: TreeNode[];
      leafUnits: number;
      x: number;
      y: number;
    }

    const visited = new Set<string>();
    const buildTree = (m: FamilyMember, depth: number): TreeNode => {
      visited.add(m.id);
      const rawChildren = childrenMap.get(m.id) || [];
      const childNodes = rawChildren
        .filter((c) => !visited.has(c.id))
        .map((c) => buildTree(c, depth + 1));
      const leafUnits =
        childNodes.length === 0
          ? 1
          : childNodes.reduce((sum, ch) => sum + ch.leafUnits, 0);
      return {
        member: m,
        depth,
        children: childNodes,
        leafUnits,
        x: 0,
        y: 0,
      };
    };

    const forest = roots.map((r) => buildTree(r, 0));
    // Tambahkan anggota terputus jika ada agar tidak hilang
    members.forEach((m) => {
      if (!visited.has(m.id)) {
        forest.push(buildTree(m, m.generationLevel || 0));
      }
    });

    const totalLeafUnits = Math.max(
      1,
      forest.reduce((sum, n) => sum + n.leafUnits, 0)
    );

    let maxDepth = 0;
    const findMaxDepth = (n: TreeNode) => {
      if (n.depth > maxDepth) maxDepth = n.depth;
      n.children.forEach(findMaxDepth);
    };
    forest.forEach(findMaxDepth);

    // Hitung ukuran kotak nama proporsional agar seluruh pohon muat rapi di area diagram (714 x 860)
    const boxW =
      totalLeafUnits <= 5
        ? 132
        : totalLeafUnits <= 9
        ? 112
        : totalLeafUnits <= 14
        ? 92
        : 76;
    const hGap = totalLeafUnits <= 8 ? 22 : totalLeafUnits <= 14 ? 14 : 10;
    const unitWidth = boxW + hGap;

    const boxH = maxDepth <= 4 ? 42 : maxDepth <= 6 ? 36 : 30;
    const vGap = maxDepth <= 3 ? 62 : maxDepth <= 5 ? 46 : 34;
    const levelHeight = boxH + vGap;

    const marginX = 28;
    const marginY = 26;

    const placedNodes: TreeNode[] = [];
    const edges: Array<{ from: TreeNode; to: TreeNode }> = [];

    const assignCoords = (node: TreeNode, startUnit: number) => {
      const centerUnit = startUnit + node.leafUnits / 2;
      node.x = marginX + centerUnit * unitWidth - boxW / 2;
      node.y = marginY + node.depth * levelHeight;
      placedNodes.push(node);

      let cursor = startUnit;
      node.children.forEach((ch) => {
        assignCoords(ch, cursor);
        edges.push({ from: node, to: ch });
        cursor += ch.leafUnits;
      });
    };

    let rootCursor = 0;
    forest.forEach((root) => {
      assignCoords(root, rootCursor);
      rootCursor += root.leafUnits;
    });

    const contentW = Math.max(420, marginX * 2 + totalLeafUnits * unitWidth);
    const contentH = Math.max(260, marginY * 2 + (maxDepth + 1) * levelHeight - vGap);

    return { placedNodes, edges, boxW, boxH, contentW, contentH, maxDepth };
  }, [members]);

  if (!layout) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400 text-xs italic border border-dashed border-stone-300 rounded-xl">
        Belum ada anggota dalam Trah ini.
      </div>
    );
  }

  const { placedNodes, edges, boxW, boxH, contentW, contentH } = layout;

  return (
    <svg
      viewBox={`0 0 ${contentW} ${contentH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
    >
      {/* Garis Silsilah Orthogonal Rapi */}
      <g fill="none" stroke="#065f46" strokeWidth={contentW > 950 ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        {edges.map(({ from, to }, idx) => {
          const x1 = from.x + boxW / 2;
          const y1 = from.y + boxH;
          const x2 = to.x + boxW / 2;
          const y2 = to.y;
          const midY = y1 + (y2 - y1) / 2;
          return (
            <path
              key={`${from.member.id}-${to.member.id}-${idx}`}
              d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
            />
          );
        })}
      </g>

      {/* Kotak Sederhana Hanya Nama */}
      {placedNodes.map((node) => {
        const { member, x, y, depth } = node;
        const isRoot = depth === 0;
        const isFemale = member.gender === 'P';
        const fill = isRoot ? '#064e3b' : isFemale ? '#fff7f8' : '#ffffff';
        const stroke = isRoot ? '#064e3b' : isFemale ? '#be123c' : '#047857';
        const textFill = isRoot ? '#ffffff' : '#1c1917';
        const subFill = isRoot ? '#a7f3d0' : '#78716c';

        const displayName =
          member.name.length > 16
            ? `${member.name.slice(0, 15)}…`
            : member.name;
        const fontSize = boxW >= 112 ? 12 : boxW >= 90 ? 10.5 : 9.5;
        const genShort = isRoot
          ? 'UYUT'
          : `GEN ${depth}${member.orderIndex ? ` · #${member.orderIndex}` : ''}`;

        return (
          <g key={member.id} transform={`translate(${x}, ${y})`}>
            <rect
              width={boxW}
              height={boxH}
              rx={7}
              fill={fill}
              stroke={stroke}
              strokeWidth={isRoot ? 2 : 1.4}
            />
            <text
              x={boxW / 2}
              y={boxH * 0.48}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={textFill}
              fontSize={fontSize}
              fontWeight={700}
              fontFamily="Georgia, 'Times New Roman', serif"
            >
              {displayName}
            </text>
            <text
              x={boxW / 2}
              y={boxH * 0.8}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={subFill}
              fontSize={Math.max(7, fontSize - 3.5)}
              fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {genShort}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Mengonversi URL gambar eksternal (jika bisa di-CORS) menjadi Data URL sebelum ekspor PDF
 * agar html-to-image tidak gagal atau kosong akibat tainted canvas.
 */
async function resolvePhotosForPdf(members: FamilyMember[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const externalUrls = Array.from(
    new Set(
      members
        .map((m) => m.photoUrl)
        .filter((u): u is string => Boolean(u && /^https?:\/\//i.test(u)))
    )
  );

  await Promise.all(
    externalUrls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, { mode: 'cors', signal: controller.signal });
        window.clearTimeout(timer);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('read error'));
          reader.readAsDataURL(blob);
        });
        if (dataUrl) map[url] = dataUrl;
      } catch {
        // Jika CORS memblokir, biarkan fallback avatar inisial saat render PDF
      }
    })
  );

  return map;
}

export const LeluhurBookModal: React.FC<LeluhurBookModalProps> = ({
  isOpen,
  onClose,
  activeTrah,
  accountProfile,
  showNotification,
}) => {
  const [paperSize, setPaperSize] = useState<BookPaperSize>('A4');
  const [previewMode, setPreviewMode] = useState<'single' | 'all'>('single');
  const [currentPageIdx, setCurrentPageIdx] = useState<number>(0);
  const [userZoomOffset, setUserZoomOffset] = useState<number>(1);
  const [isEditingForeword, setIsEditingForeword] = useState<boolean>(false);
  const [customForeword, setCustomForeword] = useState<string>(
    `Puji syukur ke hadirat Tuhan Yang Maha Esa, buku silsilah keluarga besar ${activeTrah.name} ini disusun sebagai dokumentasi sejarah keluarga agar setiap generasi senantiasa mengenal leluhur, menjaga tali silaturahmi, dan mewariskan nilai kekeluargaan kepada anak cucu.`
  );
  const [customSubtitle, setCustomSubtitle] = useState<string>(
    activeTrah.description || 'Dokumentasi Garis Keturunan & Biografi Lintas Generasi'
  );
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [pdfPhotoMap, setPdfPhotoMap] = useState<Record<string, string>>({});
  const [failedPhotoIds, setFailedPhotoIds] = useState<Record<string, boolean>>({});
  const [previewAreaWidth, setPreviewAreaWidth] = useState<number>(900);
  const [showExportFeeModal, setShowExportFeeModal] = useState<boolean>(false);

  // Refs untuk seluruh halaman tersembunyi 1:1 (skala 100% 794x1123) khusus ekspor PDF presisi
  const exportPageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCustomForeword(
      `Puji syukur ke hadirat Tuhan Yang Maha Esa, buku silsilah keluarga besar ${activeTrah.name} ini disusun sebagai dokumentasi sejarah keluarga agar setiap generasi senantiasa mengenal leluhur, menjaga tali silaturahmi, dan mewariskan nilai kekeluargaan kepada anak cucu.`
    );
    setCustomSubtitle(
      activeTrah.description || 'Dokumentasi Garis Keturunan & Biografi Lintas Generasi'
    );
    setCurrentPageIdx(0);
    setFailedPhotoIds({});
  }, [activeTrah.id, activeTrah.name, activeTrah.description]);

  useEffect(() => {
    if (!isOpen) return;
    const el = previewContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      setPreviewAreaWidth(Math.max(280, el.clientWidth - 32));
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isOpen]);

  const membersMap = useMemo(
    () => new Map(activeTrah.members.map((m) => [m.id, m])),
    [activeTrah.members]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, FamilyMember[]>();
    activeTrah.members.forEach((m) => {
      if (m.parentId) {
        if (!map.has(m.parentId)) map.set(m.parentId, []);
        map.get(m.parentId)!.push(m);
      }
    });
    map.forEach((arr) =>
      arr.sort(
        (a, b) =>
          (a.orderIndex || 0) - (b.orderIndex || 0) ||
          a.name.localeCompare(b.name)
      )
    );
    return map;
  }, [activeTrah.members]);

  // Susun halaman buku secara otomatis (sama persis isinya untuk A4 / A5 / A6)
  const { pages, tocEntries, stats } = useMemo(() => {
    const orderedAll = sortMembersHierarchically(activeTrah.members);
    const levelsMap = new Map<number, FamilyMember[]>();

    orderedAll.forEach((m) => {
      const lvl = m.generationLevel ?? 0;
      if (!levelsMap.has(lvl)) levelsMap.set(lvl, []);
      levelsMap.get(lvl)!.push(m);
    });

    const sortedLevels = Array.from(levelsMap.keys()).sort((a, b) => a - b);

    const builtPages: BookPageData[] = [
      {
        id: 'page-cover',
        pageNumber: 1,
        type: 'cover',
        title: 'Sampul Buku',
      },
      {
        id: 'page-toc',
        pageNumber: 2,
        type: 'toc',
        title: 'Kata Pengantar & Daftar Isi',
      },
    ];

    const toc: Array<{
      label: string;
      sublabel: string;
      startPage: number;
      endPage: number;
      count: number;
    }> = [];

    sortedLevels.forEach((lvl) => {
      const genMembers = levelsMap.get(lvl) || [];
      const startPage = builtPages.length + 1;
      for (let i = 0; i < genMembers.length; i += MEMBERS_PER_PAGE) {
        const chunk = genMembers.slice(i, i + MEMBERS_PER_PAGE);
        const pageNum = builtPages.length + 1;
        builtPages.push({
          id: `page-gen-${lvl}-${i}`,
          pageNumber: pageNum,
          type: 'generation',
          generationLevel: lvl,
          isContinuation: i > 0,
          title: `Generasi ${lvl} — ${getKinshipLabel(lvl)}`,
          members: chunk,
        });
      }
      const endPage = builtPages.length;
      toc.push({
        label: `Generasi ${lvl} · ${getKinshipLabel(lvl)}`,
        sublabel: genMembers.map((m) => m.name).slice(0, 4).join(', ') + (genMembers.length > 4 ? ', …' : ''),
        startPage,
        endPage,
        count: genMembers.length,
      });
    });

    // Halaman terakhir: Full Garis Keturunan Simple Hanya Nama
    const chartPageNumber = builtPages.length + 1;
    builtPages.push({
      id: 'page-lineage-chart',
      pageNumber: chartPageNumber,
      type: 'lineage_chart',
      title: 'Bagan Garis Keturunan Lengkap',
    });

    const years = activeTrah.members
      .map((m) => parseInt(m.birthYear || '', 10))
      .filter((n) => !Number.isNaN(n) && n > 1700 && n < 2100);
    const earliestYear = years.length > 0 ? Math.min(...years) : null;

    return {
      pages: builtPages,
      tocEntries: toc,
      stats: {
        totalMembers: activeTrah.members.length,
        totalGenerations: sortedLevels.length,
        earliestYear,
        livingCount: activeTrah.members.filter((m) => !m.isDeceased).length,
      },
    };
  }, [activeTrah]);

  if (!isOpen) return null;

  const activeSpec = PAPER_SPECS[paperSize];
  const maxFitScale = Math.max(0.28, previewAreaWidth / PAGE_WIDTH);
  const effectivePreviewScale = Math.min(
    maxFitScale,
    1.15,
    Math.max(0.28, activeSpec.previewScale * userZoomOffset)
  );
  const safePageIdx = Math.min(currentPageIdx, Math.max(0, pages.length - 1));
  const currentPage = pages[safePageIdx];

  const executePdfExport = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setExportProgress({ current: 0, total: pages.length });

    try {
      const [{ jsPDF }, { toJpeg }, resolvedMap] = await Promise.all([
        import('jspdf'),
        import('html-to-image'),
        resolvePhotosForPdf(activeTrah.members),
      ]);
      setPdfPhotoMap(resolvedMap);
      // Tunggu 1 frame render agar src foto terpasang
      await new Promise((r) => window.setTimeout(r, 150));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: paperSize.toLowerCase() as 'a4' | 'a5' | 'a6',
        compress: true,
      });

      const pixelRatio = paperSize === 'A4' ? 2 : paperSize === 'A5' ? 1.8 : 1.5;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        setExportProgress({ current: i + 1, total: pages.length });
        const el = exportPageRefs.current[page.id];
        if (!el) continue;

        const imgData = await toJpeg(el, {
          quality: 0.94,
          pixelRatio,
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          backgroundColor: '#FBF9F5',
          skipFonts: true,
        });

        if (i > 0) {
          pdf.addPage(paperSize.toLowerCase() as 'a4' | 'a5' | 'a6', 'portrait');
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, activeSpec.mmWidth, activeSpec.mmHeight);
      }

      const safeFileName = activeTrah.name
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      pdf.save(`Buku_Leluhur_${safeFileName || 'Trah'}_${paperSize}.pdf`);
      showNotification(
        `Buku Leluhur (${paperSize}, ${pages.length} halaman) berhasil diunduh!`
      );
    } catch (err) {
      console.error('Gagal membuat PDF Buku Leluhur:', err);
      showNotification(
        'Gagal mengekspor PDF otomatis. Silakan gunakan tombol Cetak sebagai cadangan.'
      );
    } finally {
      setIsExportingPdf(false);
      setExportProgress(null);
    }
  };

  const handleDownloadPdf = async () => {
    const rule = MonetizationService.getRule('leluhurqu_export');
    if (rule.enabled && !MonetizationService.hasActiveUnlock('leluhurqu_export')) {
      setShowExportFeeModal(true);
      return;
    }
    await executePdfExport();
  };

  /**
   * Merender isi satu halaman buku berukuran tepat 794 × 1123 px
   * Digunakan baik untuk Pratinjau Interaktif maupun Tangkap PDF 1:1.
   */
  const renderBookPageContent = (page: BookPageData, isExportSurface = false) => {
    const uid = `${page.id}_${isExportSurface ? 'exp' : 'prev'}`;
    const compilerName = accountProfile.displayName || 'Penyusun Keluarga';
    const publishYear =
      accountProfile.defaultPosterYear || String(new Date().getFullYear());

    // 1. HALAMAN SAMPUL (COVER)
    if (page.type === 'cover') {
      return (
        <div
          className="w-full h-full bg-[#FBF9F5] text-stone-900 relative flex flex-col justify-between p-12 select-none"
          style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        >
          {/* Bingkai Arsip Ganda */}
          <div className="absolute inset-6 border border-emerald-900/25 pointer-events-none" />
          <div className="absolute inset-8 border-2 border-emerald-900/70 pointer-events-none" />

          {/* Atas: Stempel Aplikasi WargaQu & Kategori Pilar */}
          <div className="relative z-10 flex items-center justify-between pt-3 px-4 border-b border-stone-300/80 pb-5">
            <WargaQuLogoBadge
              uid={uid}
              size="md"
              subtitle="Modul NasabQu · Arsip Silsilah"
            />
            <div className="text-right">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-900">
                {getLineagePillarTitle(activeTrah.lineageSide)}
              </div>
              <div className="text-[11px] text-stone-500 font-medium mt-0.5 tabular-nums">
                Edisi {publishYear} · Kertas {paperSize}
              </div>
            </div>
          </div>

          {/* Tengah: Judul Buku Editorial */}
          <div className="relative z-10 flex flex-col items-center text-center px-8 my-auto space-y-6">
            <div className="text-xs font-bold uppercase tracking-[0.28em] text-amber-800">
              Buku Dokumentasi &amp; Biografi Keluarga
            </div>

            <div className="w-24 h-px bg-amber-700/60" />

            <h1
              className="text-5xl font-bold text-stone-900 leading-tight tracking-tight"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Buku Silsilah Leluhur
            </h1>

            <div
              className="text-3xl font-bold text-emerald-900 leading-snug max-w-xl"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {activeTrah.name}
            </div>

            <p className="text-sm text-stone-600 max-w-lg leading-relaxed">
              {customSubtitle}
            </p>

            {/* Ringkasan Statistik Arsip (Tanpa Kotak Berlebihan, Editorial Hairline) */}
            <div className="w-full max-w-lg pt-6 mt-4 border-t border-b border-stone-300 py-5 grid grid-cols-3 gap-4">
              <div>
                <div
                  className="text-2xl font-bold text-emerald-900 tabular-nums"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {stats.totalMembers}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold mt-1">
                  Anggota Tercatat
                </div>
              </div>
              <div className="border-x border-stone-300/80">
                <div
                  className="text-2xl font-bold text-emerald-900 tabular-nums"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {stats.totalGenerations}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold mt-1">
                  Generasi Nasab
                </div>
              </div>
              <div>
                <div
                  className="text-2xl font-bold text-emerald-900 tabular-nums"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                >
                  {stats.earliestYear || publishYear}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold mt-1">
                  {stats.earliestYear ? 'Jejak Terawal' : 'Tahun Terbit'}
                </div>
              </div>
            </div>
          </div>

          {/* Bawah: Penyusun & Logo WargaQu */}
          <div className="relative z-10 px-4 pb-3 border-t border-stone-300/80 pt-5 flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-stone-500 font-semibold">
                Disusun &amp; Dihimpun Oleh
              </div>
              <div
                className="text-base font-bold text-stone-900 mt-1"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {compilerName}
              </div>
              {accountProfile.domicile && (
                <div className="text-xs text-stone-500 mt-0.5">
                  {accountProfile.domicile}
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.14em] text-stone-400 font-semibold">
                Dicetak Dengan
              </div>
              <div className="mt-1">
                <WargaQuLogoBadge uid={`${uid}_ft`} size="sm" subtitle="" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Header & Footer standar halaman isi (Halaman 2 .. N)
    const renderRunningHeader = (chapterLabel: string) => (
      <div className="flex items-center justify-between border-b border-stone-300 pb-3 mb-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-900">
          {activeTrah.name}
        </div>
        <div className="text-[11px] font-medium text-stone-500">
          {chapterLabel}
        </div>
      </div>
    );

    const renderRunningFooter = (pageNum: number) => (
      <div className="flex items-center justify-between border-t border-stone-300 pt-3 mt-auto">
        <WargaQuLogoBadge uid={`${uid}_runft`} size="sm" subtitle="NasabQu" />
        <div className="text-[11px] font-semibold text-stone-600 tabular-nums">
          Halaman {pageNum} dari {pages.length} · Ukuran {paperSize}
        </div>
      </div>
    );

    // 2. HALAMAN KATA PENGANTAR & DAFTAR ISI
    if (page.type === 'toc') {
      return (
        <div
          className="w-full h-full bg-[#FBF9F5] text-stone-900 flex flex-col px-12 py-10 select-none"
          style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        >
          {renderRunningHeader('Kata Pengantar & Daftar Isi')}

          {/* Seksi Kata Pengantar */}
          <div className="mb-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800 mb-1.5">
              Pembuka
            </div>
            <h2
              className="text-2xl font-bold text-stone-900 mb-3"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Kata Pengantar Keluarga
            </h2>
            <p className="text-sm text-stone-700 leading-[1.8] whitespace-pre-line">
              {customForeword}
            </p>
            <div className="mt-4 text-xs text-stone-500 italic">
              — {compilerName}, {publishYear}
            </div>
          </div>

          <div className="h-px bg-stone-300 my-2" />

          {/* Seksi Daftar Isi */}
          <div className="flex-1 mt-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800 mb-1">
              Navigasi Bab
            </div>
            <h3
              className="text-xl font-bold text-stone-900 mb-4"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Daftar Isi Silsilah
            </h3>

            <div className="divide-y divide-stone-200 border-t border-b border-stone-300">
              <div className="py-2.5 flex items-baseline justify-between gap-4 text-sm">
                <div>
                  <span className="font-semibold text-stone-900">
                    Sampul Buku &amp; Identitas Trah
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-900 tabular-nums shrink-0">
                  Hal. 1
                </span>
              </div>

              <div className="py-2.5 flex items-baseline justify-between gap-4 text-sm">
                <div>
                  <span className="font-semibold text-stone-900">
                    Kata Pengantar &amp; Daftar Isi
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-900 tabular-nums shrink-0">
                  Hal. 2
                </span>
              </div>

              {tocEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="py-2.5 flex items-baseline justify-between gap-4 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-900">
                      {entry.label}{' '}
                      <span className="text-xs font-normal text-stone-500">
                        · {entry.count} anggota
                      </span>
                    </div>
                    {entry.sublabel && (
                      <div className="text-xs text-stone-500 truncate mt-0.5">
                        {entry.sublabel}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-900 tabular-nums shrink-0">
                    {entry.startPage === entry.endPage
                      ? `Hal. ${entry.startPage}`
                      : `Hal. ${entry.startPage}–${entry.endPage}`}
                  </span>
                </div>
              ))}

              <div className="py-2.5 flex items-baseline justify-between gap-4 text-sm bg-emerald-50/50 px-2 -mx-2">
                <div>
                  <span className="font-bold text-emerald-950">
                    Bagan Garis Keturunan Penuh (Hanya Nama)
                  </span>
                  <div className="text-xs text-stone-500 mt-0.5">
                    Peta silsilah ringkas seluruh anggota dalam satu halaman
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-900 tabular-nums shrink-0">
                  Hal. {pages.length}
                </span>
              </div>
            </div>
          </div>

          {renderRunningFooter(page.pageNumber)}
        </div>
      );
    }

    // 3. HALAMAN BAB GENERASI & KETERANGAN LENGKAP
    if (page.type === 'generation') {
      const genLevel = page.generationLevel ?? 0;
      const pageMembers = page.members || [];

      return (
        <div
          className="w-full h-full bg-[#FBF9F5] text-stone-900 flex flex-col px-12 py-10 select-none"
          style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        >
          {renderRunningHeader(
            `Generasi ${genLevel} (${getKinshipLabel(genLevel)})`
          )}

          {/* Judul Bab Generasi */}
          <div className="mb-5 pb-3 border-b-2 border-emerald-900/80 flex items-end justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800">
                Bab Generasi {genLevel}
              </div>
              <h2
                className="text-2xl font-bold text-stone-900 mt-0.5"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                Tingkat {getKinshipLabel(genLevel)}
                {page.isContinuation ? ' (Lanjutan)' : ''}
              </h2>
            </div>
            <div className="text-xs text-stone-500 font-medium tabular-nums">
              {pageMembers.length} Profil Lengkap
            </div>
          </div>

          {/* Daftar Kartu Profil Lengkap Anggota */}
          <div className="flex-1 flex flex-col gap-5">
            {pageMembers.map((member) => {
              const parent = member.parentId
                ? membersMap.get(member.parentId)
                : null;
              const children = childrenByParent.get(member.id) || [];
              const ancestryPath = getAncestryPath(member, activeTrah.members);
              const resolvedSrc = member.photoUrl
                ? pdfPhotoMap[member.photoUrl] || member.photoUrl
                : '';
              const showPhoto = Boolean(resolvedSrc && !failedPhotoIds[member.id]);

              return (
                <article
                  key={member.id}
                  className="bg-white border border-stone-200 rounded-xl p-4 flex gap-4 shadow-2xs"
                >
                  {/* Kolom Foto Profil */}
                  <div className="w-24 shrink-0 flex flex-col items-center">
                    <div className="w-22 h-26 rounded-lg overflow-hidden border border-stone-300 bg-stone-100 flex items-center justify-center">
                      {showPhoto ? (
                        <img
                          src={resolvedSrc}
                          alt={member.name}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedPhotoIds((prev) => ({
                              ...prev,
                              [member.id]: true,
                            }))
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-emerald-950 text-amber-200 flex items-center justify-center font-bold text-xl">
                          {getInitials(member.name)}
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 text-[10px] font-semibold text-stone-500 text-center tabular-nums">
                      {member.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                      {member.orderIndex ? ` · Anak #${member.orderIndex}` : ''}
                    </div>
                  </div>

                  {/* Kolom Biodata & Silsilah Lengkap */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2">
                    <div>
                      {/* Baris Nama + Status */}
                      <div className="flex items-start justify-between gap-2 border-b border-stone-200 pb-1.5">
                        <div className="min-w-0">
                          <h3
                            className="text-lg font-bold text-stone-900 leading-tight truncate"
                            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                          >
                            {member.name}
                            {member.callName && (
                              <span className="text-sm font-normal text-stone-500 ml-1.5">
                                ({member.callName})
                              </span>
                            )}
                          </h3>
                          <div className="text-xs text-stone-600 mt-0.5 tabular-nums">
                            {getKinshipLabel(member.generationLevel)} ·{' '}
                            {member.birthYear || '?'} –{' '}
                            {member.deathYear ||
                              (member.isDeceased ? 'Wafat' : 'Masih Hidup')}
                          </div>
                        </div>

                        <div className="text-[11px] font-semibold text-emerald-900 shrink-0">
                          {member.isDeceased ? 'Almarhum' : 'Hidup'}
                        </div>
                      </div>

                      {/* Rincian Garis Nasab, Orang Tua, Pasangan & Anak */}
                      <div className="grid grid-cols-1 gap-1.5 mt-2 text-xs text-stone-700">
                        <div>
                          <span className="font-semibold text-stone-900">
                            Garis Nasab:{' '}
                          </span>
                          <span className="text-stone-700">
                            {ancestryPath.map((step) => step.name).join(' ➔ ')}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="font-semibold text-stone-900">
                              Orang Tua:{' '}
                            </span>
                            <span>
                              {parent ? parent.name : 'Leluhur Utama (Uyut)'}
                            </span>
                          </div>
                          <div>
                            <span className="font-semibold text-stone-900">
                              Pasangan:{' '}
                            </span>
                            <span>
                              {member.spouses && member.spouses.length > 0
                                ? member.spouses
                                    .map(
                                      (sp) =>
                                        `${sp.name} (${
                                          getSpouseStatusBadge(sp.status).label
                                        })`
                                    )
                                    .join(', ')
                                : '—'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="font-semibold text-stone-900">
                            Daftar Anak ({children.length}):{' '}
                          </span>
                          <span>
                            {children.length > 0
                              ? children
                                  .map((c, idx) => `${idx + 1}. ${c.name}`)
                                  .join(', ')
                              : 'Belum ada data anak tercatat'}
                          </span>
                        </div>

                        {member.notes && (
                          <div className="text-[11px] text-stone-600 italic bg-stone-50 border border-stone-200/80 rounded-md px-2.5 py-1.5 mt-0.5">
                            Catatan: {member.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {renderRunningFooter(page.pageNumber)}
        </div>
      );
    }

    // 4. HALAMAN TERAKHIR: BAGAN GARIS KETURUNAN PENUH (HANYA NAMA)
    return (
      <div
        className="w-full h-full bg-[#FBF9F5] text-stone-900 flex flex-col px-10 py-9 select-none"
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
      >
        {renderRunningHeader('Halaman Penutup · Bagan Garis Keturunan Penuh')}

        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-800">
              Peta Silsilah Ringkas
            </div>
            <h2
              className="text-2xl font-bold text-stone-900 mt-0.5"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Garis Keturunan Lengkap — {activeTrah.name}
            </h2>
          </div>
          <div className="text-right text-[11px] text-stone-600 tabular-nums">
            Total {stats.totalMembers} Nama · {stats.totalGenerations} Generasi
          </div>
        </div>

        {/* Kanvas Diagram Bagan Nama Saja */}
        <div className="flex-1 bg-white border border-stone-300 rounded-xl p-4 flex items-center justify-center overflow-hidden">
          <SimpleNameLineageSvg members={activeTrah.members} />
        </div>

        {/* Legenda Ringkas & Stempel WargaQu */}
        <div className="flex items-center justify-between text-[11px] text-stone-600 mt-3 mb-2 px-1">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#064e3b] inline-block" />
              Leluhur Utama
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-white border border-[#047857] inline-block" />
              Laki-laki
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-[#fff7f8] border border-[#be123c] inline-block" />
              Perempuan
            </span>
          </div>
          <span className="italic text-stone-500">
            Disimpan melalui WargaQu · NasabQu
          </span>
        </div>

        {renderRunningFooter(page.pageNumber)}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex flex-col animate-in fade-in duration-150">
      {/* ========================================================= */}
      {/* TOOLBAR ATAS: PILIHAN UKURAN A4/A5/A6, MODE PREVIEW, DOWNLOAD PDF */}
      {/* ========================================================= */}
      <header className="bg-stone-900 border-b border-stone-800 text-white px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-800/80 border border-emerald-500/40 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-amber-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-white truncate leading-tight">
              Pratinjau Buku Leluhur · {activeTrah.name}
            </h2>
            <p className="text-[11px] text-stone-400 truncate">
              {pages.length} halaman · {stats.totalMembers} anggota · Opsi kertas {activeSpec.label} ({activeSpec.caption})
            </p>
          </div>
        </div>

        {/* Kontrol Pilihan Ukuran Kertas A4 / A5 / A6 (Tanpa Mengubah Isi) */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700"
            title="Ukuran kertas tidak mengubah isi buku"
          >
            {(['A4', 'A5', 'A6'] as BookPaperSize[]).map((size) => {
              const active = paperSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPaperSize(size)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    active
                      ? 'bg-amber-400 text-stone-950 shadow-xs'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>

          {/* Toggle Preview 1 Halaman vs Semua Halaman */}
          <div className="flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700">
            <button
              type="button"
              onClick={() => setPreviewMode('single')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition whitespace-nowrap ${
                previewMode === 'single'
                  ? 'bg-emerald-700 text-white'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Per Halaman</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition whitespace-nowrap ${
                previewMode === 'all'
                  ? 'bg-emerald-700 text-white'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Semua ({pages.length})</span>
            </button>
          </div>

          {/* Zoom Pratinjau */}
          <div className="hidden md:flex items-center gap-1 bg-stone-800 px-2 py-1 rounded-xl border border-stone-700">
            <button
              type="button"
              onClick={() => setUserZoomOffset((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}
              className="p-1 text-stone-300 hover:text-white"
              title="Perkecil Pratinjau"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-stone-200 w-10 text-center tabular-nums">
              {Math.round(effectivePreviewScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setUserZoomOffset((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}
              className="p-1 text-stone-300 hover:text-white"
              title="Perbesar Pratinjau"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingForeword((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition whitespace-nowrap ${
              isEditingForeword
                ? 'bg-emerald-800 border-emerald-500 text-white'
                : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-300" />
            <span>Edit Pengantar</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-60 text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition whitespace-nowrap"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  PDF {exportProgress ? `${exportProgress.current}/${exportProgress.total}` : '...'}
                </span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Unduh PDF ({paperSize})</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition"
            title="Tutup Pratinjau Buku"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Panel Opsional Edit Kata Pengantar & Subjudul Sampul */}
      {isEditingForeword && (
        <div className="bg-stone-900/95 border-b border-stone-800 px-4 py-3 text-white shrink-0">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-stone-300 block mb-1">
                Subjudul Sampul Buku
              </label>
              <input
                type="text"
                value={customSubtitle}
                onChange={(e) => setCustomSubtitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-stone-950 border border-stone-700 rounded-xl text-white outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-stone-300 block mb-1">
                Kata Pengantar (Halaman 2)
              </label>
              <textarea
                rows={2}
                value={customForeword}
                onChange={(e) => setCustomForeword(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-stone-950 border border-stone-700 rounded-xl text-white outline-hidden focus:border-emerald-500 resize-none"
              />
            </div>
          </div>
          <div className="max-w-4xl mx-auto flex justify-end mt-2">
            <button
              type="button"
              onClick={() => setIsEditingForeword(false)}
              className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Terapkan ke Pratinjau</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* AREA UTAMA PRATINJAU PDF & NAVIGASI HALAMAN              */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Daftar Halaman (Desktop) */}
        <aside className="hidden lg:flex w-64 bg-stone-900/90 border-r border-stone-800 flex-col p-3 overflow-y-auto shrink-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2.5 flex items-center gap-1.5 px-1">
            <ScrollText className="w-3.5 h-3.5 text-amber-400" />
            <span>Daftar Halaman ({pages.length})</span>
          </div>
          <div className="space-y-1">
            {pages.map((p, idx) => {
              const isSel = idx === safePageIdx;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPreviewMode('single');
                    setCurrentPageIdx(idx);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between gap-2 ${
                    isSel && previewMode === 'single'
                      ? 'bg-emerald-800/80 text-white font-bold border border-emerald-500/50'
                      : 'text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-[10px] font-mono text-stone-400 shrink-0 tabular-nums">
                    {p.pageNumber}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-stone-800 text-[11px] text-stone-400 space-y-1 px-1">
            <div className="flex items-center gap-1.5 font-semibold text-stone-300">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ukuran Dipilih: {activeSpec.label}</span>
            </div>
            <p className="leading-relaxed text-[10px] text-stone-400">
              Isi buku &amp; susunan halaman tetap sama untuk A4, A5, dan A6 — skala kertas menyesuaikan ukuran fisik PDF.
            </p>
          </div>
        </aside>

        {/* Viewport Kanvas Kertas Pratinjau */}
        <div
          ref={previewContainerRef}
          className="flex-1 overflow-auto bg-stone-800/95 p-4 sm:p-8 flex flex-col items-center"
        >
          {previewMode === 'single' ? (
            <div className="flex flex-col items-center gap-4 my-auto">
              {/* Kontainer Kertas Berskala */}
              <div
                className="relative shadow-2xl rounded-xs overflow-hidden ring-1 ring-black/30 bg-[#FBF9F5] transition-all duration-150"
                style={{
                  width: Math.round(PAGE_WIDTH * effectivePreviewScale),
                  height: Math.round(PAGE_HEIGHT * effectivePreviewScale),
                }}
              >
                <div
                  style={{
                    width: PAGE_WIDTH,
                    height: PAGE_HEIGHT,
                    transform: `scale(${effectivePreviewScale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {renderBookPageContent(currentPage, false)}
                </div>
              </div>

              {/* Kontrol Navigasi Bawah Pratinjau */}
              <div className="flex items-center gap-2 bg-stone-900/95 border border-stone-700 px-3 py-1.5 rounded-2xl shadow-xl text-white">
                <button
                  type="button"
                  disabled={safePageIdx <= 0}
                  onClick={() => setCurrentPageIdx((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-xl hover:bg-stone-800 disabled:opacity-35 transition"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <select
                  value={safePageIdx}
                  onChange={(e) => setCurrentPageIdx(Number(e.target.value))}
                  className="bg-stone-950 border border-stone-700 rounded-xl px-2.5 py-1 text-xs font-semibold text-white outline-hidden max-w-[200px]"
                >
                  {pages.map((p, idx) => (
                    <option key={p.id} value={idx}>
                      Hal. {p.pageNumber} — {p.title}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={safePageIdx >= pages.length - 1}
                  onClick={() =>
                    setCurrentPageIdx((p) => Math.min(pages.length - 1, p + 1))
                  }
                  className="p-1.5 rounded-xl hover:bg-stone-800 disabled:opacity-35 transition"
                  title="Halaman Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 pb-10">
              {pages.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1.5">
                  <div className="text-[11px] font-semibold text-stone-300 tabular-nums">
                    Halaman {p.pageNumber} · {p.title} ({paperSize})
                  </div>
                  <div
                    className="relative shadow-2xl rounded-xs overflow-hidden ring-1 ring-black/30 bg-[#FBF9F5]"
                    style={{
                      width: Math.round(PAGE_WIDTH * effectivePreviewScale),
                      height: Math.round(PAGE_HEIGHT * effectivePreviewScale),
                    }}
                  >
                    <div
                      style={{
                        width: PAGE_WIDTH,
                        height: PAGE_HEIGHT,
                        transform: `scale(${effectivePreviewScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      {renderBookPageContent(p, false)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Kontainer Tersembunyi Skala 1:1 (794 × 1123 px) untuk Ekspor PDF Bersih & Presisi */}
      <div
        aria-hidden="true"
        className="fixed left-[-99999px] top-0 pointer-events-none opacity-100"
      >
        {pages.map((p) => (
          <div
            key={`export_${p.id}`}
            ref={(el) => {
              exportPageRefs.current[p.id] = el;
            }}
            style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
          >
            {renderBookPageContent(p, true)}
          </div>
        ))}
      </div>
      <ModularFeeSheet
        isOpen={showExportFeeModal}
        moduleId="leluhurqu_export"
        actionLabel={`Download Buku Silsilah PDF (${paperSize})`}
        unlockModule={true}
        onClose={() => setShowExportFeeModal(false)}
        onPaid={() => {
          setShowExportFeeModal(false);
          void executePdfExport();
        }}
        showNotification={showNotification}
      />
    </div>
  );
};
