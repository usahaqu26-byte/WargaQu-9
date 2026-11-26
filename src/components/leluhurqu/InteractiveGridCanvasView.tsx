import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  LayoutGrid,
  Move,
  Sun,
  Moon,
  Plus,
  Link2,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  SlidersHorizontal,
  Trash2,
  Unlink,
  Save,
  Upload,
  Check,
  X,
  Grid,
  Group,
  Ungroup,
  FolderPlus,
  CheckSquare,
  FileText,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  Palette,
  Calendar,
  Info,
  Minimize2,
  Hand,
  Smartphone,
  Lock,
  Unlock,
  Layers,
  Split,
  Undo2,
  Rows3,
  CircleDot,
  Disc,
  GitBranch,
  ArrowRightLeft,
  Users,
  Download,
  Loader2,
  Image as ImageIcon,
  Eye,
  EyeOff,
  RotateCw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trees,
  Leaf,
  Square,
  Type,
  ArrowUpRight,
  GitFork,
  Zap,
} from 'lucide-react';
import { FamilyMember, TrahCategory } from './LeluhurQuView';
import { MonetizationService } from '../../services/monetizationService';
import { isNativeCapacitorApk } from '../../services/appOriginService';
import {
  applyStudioScreenOrientation,
  StudioScreenMode,
} from '../../services/screenStudioService';
import {
  upscaleImageToHdDataUrl,
  upscalePhotoMap,
  dataUrlToBlob,
  saveOrShareFileBlob,
} from '../../utils/imageUpscale';
import {
  DEVICE_PAIRING_SYNC_EVENT,
  PairingSyncEventDetail,
} from '../../services/devicePairingService';
import { PhotoCropGuideModal, CropGuideShape } from './PhotoCropGuideModal';
import { ModularFeeSheet } from '../monetization/ModularFeeSheet';
import { GridCardItem } from './GridCardItem';
import {
  GridHybridSnapshotCanvas,
  GridMiniNavigator,
  ComputedCanvasEdgeItem,
  TreeSkeletonData,
  LineageHullItem,
  LotusHaloItem,
} from './GridHybridCanvasLayer';
import {
  SMART_LAYOUT_PRESETS,
  SmartPresetId,
  GuideOverlayMode,
  analyzeTrahForSmartLayout,
  buildSmartGalleryOptions,
  computeOptimalCardScale,
  computeMergedCardMetrics,
  evaluateSmartLayoutQuality,
  getUniformSubCardSize,
  formatMemberLifeSubtitle,
  generateSmartLayoutFromTable,
  applyIncrementalBranchUpdate,
} from './smartGridLayouts';
import {
  NasabAiBlueprint,
  NasabAiArchetype,
  AiDesignerQuotaInfo,
  getAiDesignerQuotaInfo,
  requestNasabAiBlueprint,
} from '../../services/nasabAiDesignerService';

export type GridLayoutMode = 'auto' | 'manual';
export type CanvasTheme = 'dark' | 'light';
export type CanvasBackground = '' | 'bg-gunung' | 'bg-pohon' | 'bg-galaksi';
export type GridPaperSize = 'a4' | 'a3' | 'a2' | 'a1' | 'a0';
export type GridPaperOrientation = 'landscape' | 'portrait';
export type CardDisplayMode = 'name_only' | 'photo_name' | 'photo_name_unified' | 'full';

function normalizeCardDisplayMode(mode?: string): CardDisplayMode {
  if (
    mode === 'name_only' ||
    mode === 'photo_name' ||
    mode === 'photo_name_unified' ||
    mode === 'full'
  ) {
    return mode;
  }
  if (mode === 'photo_only') {
    return 'photo_name';
  }
  return 'full';
}
export type PhotoFrameSize = 'kotak' | 'bulat' | '2x3' | '3x4' | '4x6';
export type GridPhotoShape = 'kotak' | 'bulat' | 'segi6';
export type GenGradientPaletteId =
  | 'none'
  | 'royal_emerald'
  | 'ocean_blue'
  | 'amber_earth'
  | 'violet_dusk'
  | 'wood_leaf'
  | 'lotus_blossom';
export type ConnectorLineStyle = 'pcb90' | 'pcb45' | 'straight' | 'curved' | 'none';
export type LineRoutingTopology = 'direct' | 'sibling_chain_all' | 'sibling_chain_g3plus';
export type LineThicknessMode = 'uniform' | 'tree_taper';
export type CardFrameMode = 'auto' | 'rect' | 'leaf' | 'hex' | 'petal';
export type EdgePortSide = 'auto' | 'top' | 'bottom' | 'left' | 'right';
export type CaptionPosition =
  | 'bottom-bar'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center';

export interface CanvasCaptionInfo {
  show: boolean;
  position: CaptionPosition;
  familyTitle: string;
  subtitleNote: string;
  createdYear: string;
  createdByApp: string;
  curatorName: string;
  showLineLegend: boolean;
}

export interface MergedCardMember {
  originalNodeId: string;
  memberId?: string;
  name: string;
  sub: string;
  photo: string;
  wafat: boolean;
  gender?: 'L' | 'P';
  genLevel?: number;
  parentMemberId?: string;
  depthInModule?: number;
  isSpouseOf?: string;
  customBgColor?: string;
  customBorderColor?: string;
  relX: number;
  relY: number;
}

export interface InteractiveNode {
  id: string;
  name: string;
  sub: string;
  x: number;
  y: number;
  photo: string;
  wafat: boolean;
  gender?: 'L' | 'P';
  memberId?: string;
  groupId?: string;
  customBgColor?: string;
  customBorderColor?: string;
  genLevel?: number;
  scaleMultiplier?: number;
  cardShape?: 'rect' | 'leaf' | 'hex' | 'petal';
  lotusRole?: 'flower_center' | 'petal_inner' | 'petal_outer';
  hexCol?: number;
  hexRow?: number;
  hexGap?: number;
  hexTier?: 'g1' | 'g2' | 'g3' | 'g4plus';
  lineageG2Id?: string;
  lineageG2Color?: string;
  lineageG3Id?: string;
  lineageG3Color?: string;
  lineageG4Id?: string;
  lineageG4Color?: string;
  leafAngleDeg?: number;
  leafTone?: 'dark' | 'medium' | 'light';
  treeOriginX?: number;
  treeOriginY?: number;
  treeTipX?: number;
  treeTipY?: number;
  treeWing?: -1 | 1;
  modularSubLayout?: 'grid' | 'I' | 'L';
  modularHeadMemberId?: string;
  mergedMembers?: MergedCardMember[];
  mergedCols?: number;
  mergedEdgesSnapshot?: InteractiveEdge[];
}

export interface InteractiveEdge {
  from: string;
  to: string;
  type: 'couple' | 'child';
  offsetX?: number;
  offsetY?: number;
  dotPos?: number;
  hideDot?: boolean;
  fromPort?: EdgePortSide;
  toPort?: EdgePortSide;
}

export interface SavedGridDesign {
  id: string;
  name: string;
  updatedAt: number;
  nodes: InteractiveNode[];
  edges: InteractiveEdge[];
  quickText: string;
  paperSize: GridPaperSize;
  paperOrientation: GridPaperOrientation;
  cardDisplayMode: CardDisplayMode;
  photoFrameSize: PhotoFrameSize;
  photoShape?: GridPhotoShape;
  cardScale?: number;
  showGenGuides?: boolean;
  guideOverlayMode?: GuideOverlayMode;
  linesOnTop?: boolean;
  showLineDots?: boolean;
  showEndpointDots?: boolean;
  genGradientPalette?: GenGradientPaletteId;
  cardGapMm?: number;
  modularG12Position?: 'top' | 'center';
  focalRootMemberId?: string;
  maxVisibleDepth?: number;
  theme: CanvasTheme;
  bgStyle: CanvasBackground;
  lineStyle?: ConnectorLineStyle;
  lineRoutingTopology?: LineRoutingTopology;
  lineThicknessMode?: LineThicknessMode;
  cardFrameMode?: CardFrameMode;
  showLineArrows?: boolean;
  lineThickness?: number;
  childLineColor?: string;
  coupleLineColor?: string;
  siblingLineColor?: string;
  cardBgColor?: string;
  cardBorderColor?: string;
  captionInfo?: CanvasCaptionInfo;
  activePresetId?: SmartPresetId;
  aiBlueprint?: NasabAiBlueprint | null;
  structureSig?: string;
}

export interface InteractiveGridCanvasViewProps {
  activeTrah: TrahCategory;
  onOpenTable?: () => void;
  onSyncMember?: (
    memberId: string,
    patch: {
      name?: string;
      gender?: 'L' | 'P';
      isDeceased?: boolean;
      photoUrl?: string;
      birthYear?: string;
      deathYear?: string;
      city?: string;
      spouseIndex?: number;
      spousePhotoUrl?: string;
    }
  ) => void;
  showNotification: (msg: string) => void;
  defaultCuratorName?: string;
  defaultCreatedYear?: string;
  defaultPhotoShape?: GridPhotoShape;
  enterStudioTrigger?: number;
}

// Ukuran Kertas Standar A0 - A4 pada skala 96 DPI (proporsional cetak)
const GRID_PAPER_MAP: Record<
  GridPaperSize,
  { label: string; wMm: number; hMm: number; pxW: number; pxH: number }
> = {
  a4: { label: 'A4', wMm: 297, hMm: 210, pxW: 1123, pxH: 794 },
  a3: { label: 'A3', wMm: 420, hMm: 297, pxW: 1587, pxH: 1123 },
  a2: { label: 'A2', wMm: 594, hMm: 420, pxW: 2245, pxH: 1587 },
  a1: { label: 'A1', wMm: 841, hMm: 594, pxW: 3179, pxH: 2245 },
  a0: { label: 'A0', wMm: 1189, hMm: 841, pxW: 4494, pxH: 3179 },
};

const PHOTO_DIMENSIONS: Record<PhotoFrameSize, { w: number; h: number; label: string }> = {
  kotak: { w: 58, h: 58, label: 'Kotak 1:1' },
  bulat: { w: 56, h: 56, label: 'Bulat 1:1' },
  '2x3': { w: 56, h: 84, label: '2×3' },
  '3x4': { w: 66, h: 88, label: '3×4' },
  '4x6': { w: 80, h: 120, label: '4×6' },
};

const HEXAGON_CLIP_PATH = 'polygon(50% 0%, 96% 25%, 96% 75%, 50% 100%, 4% 75%, 4% 25%)';

// Palet Gradasi Generasi: G1 paling Tua/Gelap -> G2, G3 -> G5+ makin Muda/Cerah
const GEN_GRADIENT_PALETTES: Record<
  Exclude<GenGradientPaletteId, 'none'>,
  {
    label: string;
    stops: Array<{ bg: string; border: string; line: string }>;
  }
> = {
  royal_emerald: {
    label: 'Zamrud Tua ➔ Mint Cerah',
    stops: [
      { bg: '#022c22', border: '#10b981', line: '#065f46' }, // G1 paling gelap
      { bg: '#064e3b', border: '#34d399', line: '#059669' }, // G2
      { bg: '#047857', border: '#6ee7b7', line: '#10b981' }, // G3
      { bg: '#34d399', border: '#065f46', line: '#34d399' }, // G4 cerah
      { bg: '#a7f3d0', border: '#047857', line: '#6ee7b7' }, // G5 muda
      { bg: '#ecfdf5', border: '#10b981', line: '#a7f3d0' }, // G6+ paling cerah
    ],
  },
  ocean_blue: {
    label: 'Biru Samudra ➔ Langit Cerah',
    stops: [
      { bg: '#0f172a', border: '#38bdf8', line: '#1e3a8a' },
      { bg: '#1e3a8a', border: '#60a5fa', line: '#1d4ed8' },
      { bg: '#1d4ed8', border: '#93c5fd', line: '#3b82f6' },
      { bg: '#60a5fa', border: '#1e3a8a', line: '#60a5fa' },
      { bg: '#bfdbfe', border: '#2563eb', line: '#93c5fd' },
      { bg: '#eff6ff', border: '#3b82f6', line: '#bfdbfe' },
    ],
  },
  amber_earth: {
    label: 'Coklat Emas ➔ Krem Cerah',
    stops: [
      { bg: '#451a03', border: '#f59e0b', line: '#78350f' },
      { bg: '#78350f', border: '#fbbf24', line: '#b45309' },
      { bg: '#b45309', border: '#fcd34d', line: '#d97706' },
      { bg: '#fbbf24', border: '#78350f', line: '#f59e0b' },
      { bg: '#fde68a', border: '#b45309', line: '#fcd34d' },
      { bg: '#fffbeb', border: '#d97706', line: '#fde68a' },
    ],
  },
  violet_dusk: {
    label: 'Ungu Tua ➔ Lavender Cerah',
    stops: [
      { bg: '#2e1065', border: '#c084fc', line: '#581c87' },
      { bg: '#4c1d95', border: '#d8b4fe', line: '#7e22ce' },
      { bg: '#6d28d9', border: '#e9d5ff', line: '#9333ea' },
      { bg: '#a855f7', border: '#4c1d95', line: '#c084fc' },
      { bg: '#e9d5ff', border: '#7e22ce', line: '#d8b4fe' },
      { bg: '#faf5ff', border: '#9333ea', line: '#e9d5ff' },
    ],
  },
  wood_leaf: {
    label: 'Coklat Kayu (G1) ➔ Hijau Daun (G5+)',
    stops: [
      { bg: '#3f1d0b', border: '#b45309', line: '#78350f' },
      { bg: '#6b3410', border: '#d97706', line: '#92400e' },
      { bg: '#4d5e18', border: '#84cc16', line: '#65a30d' },
      { bg: '#166534', border: '#22c55e', line: '#22c55e' },
      { bg: '#15803d', border: '#4ade80', line: '#4ade80' },
      { bg: '#86efac', border: '#16a34a', line: '#86efac' },
    ],
  },
  lotus_blossom: {
    label: 'Putik Emas (G1) ➔ Kelopak Teratai (G5+)',
    stops: [
      { bg: '#451a03', border: '#fbbf24', line: '#f59e0b' },
      { bg: '#831843', border: '#f472b6', line: '#ec4899' },
      { bg: '#be185d', border: '#f9a8d4', line: '#f472b6' },
      { bg: '#f472b6', border: '#9d174d', line: '#f9a8d4' },
      { bg: '#fbcfe8', border: '#db2777', line: '#fbcfe8' },
      { bg: '#fdf2f8', border: '#ec4899', line: '#f9a8d4' },
    ],
  },
};

function getGenGradientStyle(
  paletteId: GenGradientPaletteId,
  genLevel = 0
): { bg: string; border: string; line: string } | null {
  if (paletteId === 'none') return null;
  const pal = GEN_GRADIENT_PALETTES[paletteId];
  if (!pal) return null;
  const idx = Math.max(0, Math.min(pal.stops.length - 1, Math.floor(genLevel)));
  return pal.stops[idx];
}

// Saring anggota berdasarkan Jendela Fokus Cabang & Kedalaman Generasi (Solusi G1 s/d G20+ anti-kecil)
function buildWindowedMembers(
  allMembers: FamilyMember[],
  focalRootId: string,
  maxVisibleDepth: number
): {
  members: FamilyMember[];
  focalMember: FamilyMember | null;
  maxRawGen: number;
} {
  const maxRawGen = allMembers.reduce(
    (mx, m) => Math.max(mx, m.generationLevel ?? 0),
    0
  );
  if (!allMembers || allMembers.length === 0) {
    return { members: [], focalMember: null, maxRawGen: 0 };
  }

  let scoped = allMembers;
  let focalMember: FamilyMember | null = null;
  let baseDepth = 0;

  if (focalRootId && focalRootId !== 'all') {
    const target = allMembers.find((m) => m.id === focalRootId);
    if (target) {
      focalMember = target;
      baseDepth = target.generationLevel ?? 0;
      const childrenByParent = new Map<string, FamilyMember[]>();
      allMembers.forEach((m) => {
        if (m.parentId) {
          if (!childrenByParent.has(m.parentId)) childrenByParent.set(m.parentId, []);
          childrenByParent.get(m.parentId)!.push(m);
        }
      });
      const subtree: FamilyMember[] = [];
      const visited = new Set<string>();
      const walk = (m: FamilyMember, relDepth: number) => {
        if (visited.has(m.id)) return;
        if (maxVisibleDepth > 0 && relDepth >= maxVisibleDepth) return;
        visited.add(m.id);
        subtree.push({
          ...m,
          parentId: m.id === target.id ? null : m.parentId,
          generationLevel: relDepth,
        });
        (childrenByParent.get(m.id) || []).forEach((ch) => walk(ch, relDepth + 1));
      };
      walk(target, 0);
      scoped = subtree;
      return { members: scoped, focalMember, maxRawGen };
    }
  }

  if (maxVisibleDepth > 0) {
    const minGen = allMembers.reduce(
      (mn, m) => Math.min(mn, m.generationLevel ?? 0),
      Infinity
    );
    const startGen = Number.isFinite(minGen) ? minGen : baseDepth;
    scoped = allMembers
      .filter((m) => (m.generationLevel ?? 0) - startGen < maxVisibleDepth)
      .map((m) => ({
        ...m,
        generationLevel: Math.max(0, (m.generationLevel ?? 0) - startGen),
      }));
  }

  return { members: scoped, focalMember, maxRawGen };
}

const SNAP_SIZE = 20;
const DESIGNS_STORAGE_PREFIX = 'leluhurqu_grid_designs_v2_';
const ACTIVE_DESIGN_ID_PREFIX = 'leluhurqu_grid_active_id_v2_';

const LINE_COLOR_SWATCHES = [
  { label: 'Auto', color: '' },
  { label: 'Biru PCB', color: '#38bdf8' },
  { label: 'Hijau PCB', color: '#22c55e' },
  { label: 'Emas', color: '#f59e0b' },
  { label: 'Merah', color: '#f43f5e' },
  { label: 'Ungu', color: '#a855f7' },
  { label: 'Putih', color: '#f8fafc' },
  { label: 'Hitam', color: '#0f172a' },
];

const CARD_BG_SWATCHES = [
  { label: 'Auto', color: '' },
  { label: 'Slate', color: '#1e293b' },
  { label: 'Hijau PCB', color: '#064e3b' },
  { label: 'Navy', color: '#172554' },
  { label: 'Marun', color: '#4c0519' },
  { label: 'Putih', color: '#ffffff' },
  { label: 'Krem', color: '#fef3c7' },
  { label: 'Mint', color: '#dcfce7' },
];

const CARD_BORDER_SWATCHES = [
  { label: 'Auto', color: '' },
  { label: 'Emas', color: '#f59e0b' },
  { label: 'Biru PCB', color: '#38bdf8' },
  { label: 'Hijau PCB', color: '#22c55e' },
  { label: 'Slate', color: '#475569' },
  { label: 'Coklat', color: '#92400e' },
  { label: 'Putih', color: '#e2e8f0' },
  { label: 'Hitam', color: '#0f172a' },
];

function isLightHexColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

function getDefaultCaptionInfo(
  trahName: string,
  curatorName = '',
  createdYear = ''
): CanvasCaptionInfo {
  return {
    show: true,
    position: 'bottom-bar',
    familyTitle: `Keluarga Besar ${trahName}`,
    subtitleNote: 'Bagan Silsilah & Jejak Nasab Lintas Generasi',
    createdYear: createdYear || String(new Date().getFullYear()),
    createdByApp: 'NasabQu',
    curatorName,
    showLineLegend: true,
  };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getScaledPhotoDim(
  photoSize: PhotoFrameSize,
  cardScale = 1
): { w: number; h: number } {
  const base = PHOTO_DIMENSIONS[photoSize] || PHOTO_DIMENSIONS['3x4'];
  const aspect = base.h / Math.max(1, base.w);
  const w = Math.max(18, Math.round(base.w * cardScale));
  const h = Math.max(18, Math.round(w * aspect));
  return { w, h };
}

// Hitung dimensi aktual kartu agar garis konektor & tata letak presisi 100%
function getNodeSize(
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

  const pDim = PHOTO_DIMENSIONS[photoSize] || PHOTO_DIMENSIONS['3x4'];

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

  if (displayMode === 'photo_name_unified') {
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

  // 'full' (jarak card-ke-foto 1mm (~4px) + nama + tahun lahir/wafat - kota)
  const cardW = Math.round(Math.max(142, pDim.w + 26) * effScale);
  const cardH = Math.round((pDim.h + 50) * effScale);
  return { w: cardW, h: cardH };
}

function buildQuickTextFromTrah(members: FamilyMember[]): string {
  if (!members || members.length === 0) {
    return `Buyut Ahmad + Buyut Siti\nKakek Budi + Nenek Ratna, Paman Danu + Bibi Ina\nAyah Anton + Ibu Sari, Bibi Maya\nAnda + Istri, Kakak Lisa, Adik Doni + Rina`;
  }

  const byGen = new Map<number, FamilyMember[]>();
  members.forEach((m) => {
    const lvl = m.generationLevel ?? 0;
    if (!byGen.has(lvl)) byGen.set(lvl, []);
    byGen.get(lvl)!.push(m);
  });

  const sortedGens = Array.from(byGen.keys()).sort((a, b) => a - b);
  return sortedGens
    .map((lvl) => {
      const list = (byGen.get(lvl) || []).sort(
        (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)
      );
      return list
        .map((m) => {
          const primaryLabel = m.gender === 'P' ? `${m.name} (P)` : m.name;
          const spNames = (m.spouses || []).map((s) => s.name).filter(Boolean);
          return [primaryLabel, ...spNames].join(' + ');
        })
        .join(', ');
    })
    .join('\n');
}

function buildCanvasFromTrah(
  members: FamilyMember[],
  boardWidth: number
): { nodes: InteractiveNode[]; edges: InteractiveEdge[] } {
  if (!members || members.length === 0) {
    return { nodes: [], edges: [] };
  }

  const byGen = new Map<number, FamilyMember[]>();
  members.forEach((m) => {
    const lvl = m.generationLevel ?? 0;
    if (!byGen.has(lvl)) byGen.set(lvl, []);
    byGen.get(lvl)!.push(m);
  });

  const sortedGens = Array.from(byGen.keys()).sort((a, b) => a - b);
  const nodes: InteractiveNode[] = [];
  const edges: InteractiveEdge[] = [];
  const memberToNodeId = new Map<string, string>();

  const maxCols = Math.max(4, Math.floor((boardWidth - 80) / 175));
  const startY = 70;
  const rowHeight = 220;

  sortedGens.forEach((lvl, rowIdx) => {
    const list = (byGen.get(lvl) || []).sort(
      (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)
    );

    const totalItems = list.reduce(
      (acc, m) => acc + 1 + (m.spouses ? m.spouses.length : 0),
      0
    );

    let itemIndex = 0;

    list.forEach((m) => {
      const coupleList = [
        {
          name: m.name,
          sub:
            m.callName ||
            (rowIdx === 0 ? 'Leluhur Inti' : `Generasi ${rowIdx + 1}`),
          photo: m.photoUrl || '',
          wafat: m.isDeceased,
          gender: m.gender as 'L' | 'P' | undefined,
        },
        ...(m.spouses || []).map((sp) => ({
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
          gender: (m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined) as 'L' | 'P' | undefined,
        })),
      ];

      let primaryNodeId = '';

      coupleList.forEach((person, pIdx) => {
        const nodeId = pIdx === 0 ? `n_${m.id}` : `n_${m.id}_sp_${pIdx}`;
        if (pIdx === 0) {
          primaryNodeId = nodeId;
          memberToNodeId.set(m.id, nodeId);
        }

        const colIdx = itemIndex % maxCols;
        const actualRowOffset = Math.floor(itemIndex / maxCols);
        const totalColsInSubRow = Math.min(
          maxCols,
          totalItems - actualRowOffset * maxCols
        );
        const availableWidth = totalColsInSubRow * 175;
        const startX = Math.max(40, (boardWidth - availableWidth) / 2);

        const posX = startX + colIdx * 175;
        const posY = startY + rowIdx * rowHeight + actualRowOffset * 130;

        nodes.push({
          id: nodeId,
          name: person.name,
          sub: person.sub,
          x: posX,
          y: posY,
          photo: person.photo,
          wafat: person.wafat,
          gender: person.gender,
          memberId: pIdx === 0 ? m.id : undefined,
        });

        if (pIdx > 0 && primaryNodeId) {
          edges.push({ from: primaryNodeId, to: nodeId, type: 'couple' });
        }
        itemIndex++;
      });
    });
  });

  members.forEach((m) => {
    if (m.parentId) {
      const fromId = memberToNodeId.get(m.parentId);
      const toId = memberToNodeId.get(m.id);
      if (fromId && toId) {
        edges.push({ from: fromId, to: toId, type: 'child' });
      }
    }
  });

  return { nodes, edges };
}

interface DisplayCanvasEdge {
  origIdx: number;
  edge: InteractiveEdge;
  edgeKind: 'couple' | 'child' | 'sibling';
}

function segmentCrossesBoxApprox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  box: { x: number; y: number; w: number; h: number },
  pad = 4
): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (
    maxX < box.x - pad ||
    minX > box.x + box.w + pad ||
    maxY < box.y - pad ||
    minY > box.y + box.h + pad
  ) {
    return false;
  }
  for (let s = 1; s <= 5; s++) {
    const t = s / 6;
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    if (
      px >= box.x - pad &&
      px <= box.x + box.w + pad &&
      py >= box.y - pad &&
      py <= box.y + box.h + pad
    ) {
      return true;
    }
  }
  return false;
}

function buildDisplayEdgesWithSiblingChain(
  nodes: InteractiveNode[],
  edges: InteractiveEdge[],
  topology: LineRoutingTopology,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale: number,
  isTreePreset = false,
  isMoleculePreset = false
): DisplayCanvasEdge[] {
  if (topology === 'direct' || edges.length === 0) {
    return edges.map((edge, origIdx) => ({
      origIdx,
      edge,
      edgeKind: edge.type === 'couple' ? 'couple' : 'child',
    }));
  }

  const nodeMapLocal = new Map<string, InteractiveNode>();
  const boxMap = new Map<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>();
  nodes.forEach((n) => {
    nodeMapLocal.set(n.id, n);
    const sz = getNodeSize(n, displayMode, photoSize, cardScale);
    boxMap.set(n.id, {
      x: n.x,
      y: n.y,
      w: sz.w,
      h: sz.h,
      cx: n.x + sz.w / 2,
      cy: n.y + sz.h / 2,
    });
  });

  const result: DisplayCanvasEdge[] = [];
  const childGroups = new Map<string, { origIdx: number; edge: InteractiveEdge; child: InteractiveNode }[]>();

  edges.forEach((edge, origIdx) => {
    if (edge.type === 'couple') {
      result.push({ origIdx, edge, edgeKind: 'couple' });
      return;
    }
    const parentNode = nodeMapLocal.get(edge.from);
    const childNode = nodeMapLocal.get(edge.to);
    if (!parentNode || !childNode) return;
    if (!childGroups.has(edge.from)) childGroups.set(edge.from, []);
    childGroups.get(edge.from)!.push({ origIdx, edge, child: childNode });
  });

  const allBoxes = Array.from(boxMap.entries()).map(([id, b]) => ({ id, ...b }));

  childGroups.forEach((group, parentId) => {
    const parentNode = nodeMapLocal.get(parentId);
    const parentBox = boxMap.get(parentId);
    if (!parentNode || !parentBox || group.length <= 1) {
      group.forEach((g) =>
        result.push({ origIdx: g.origIdx, edge: g.edge, edgeKind: 'child' })
      );
      return;
    }

    // Mode Pohon Besar: G2 berantai ke atas, G3 langsung kanan/kiri, G4 berantai kanan/kiri, G5 langsung!
    if (isTreePreset) {
      const parentGen = parentNode.genLevel ?? 0;
      const minChildGen = Math.min(
        ...group.map((g) => g.child.genLevel ?? parentGen + 1)
      );
      if (minChildGen === 2 || minChildGen >= 4) {
        group.forEach((g) =>
          result.push({ origIdx: g.origIdx, edge: g.edge, edgeKind: 'child' })
        );
        return;
      }
    }

    // Mode Molekul Organik: G2-G4 pakai rantai beradik, sedangkan G5+ langsung ke ortu (menempel)!
    if (isMoleculePreset) {
      const parentGen = parentNode.genLevel ?? 0;
      const minChildGen = Math.min(
        ...group.map((g) => g.child.genLevel ?? parentGen + 1)
      );
      if (minChildGen >= 4) {
        group.forEach((g) =>
          result.push({ origIdx: g.origIdx, edge: g.edge, edgeKind: 'child' })
        );
        return;
      }
    }

    // Mode Hibrid: G1-G2 (anak dari G1, genLevel <= 1) tetap langsung ke ortu agar struktur inti super tegas
    if (topology === 'sibling_chain_g3plus') {
      const parentGen = parentNode.genLevel ?? 0;
      const minChildGen = Math.min(
        ...group.map((g) => g.child.genLevel ?? parentGen + 1)
      );
      if (minChildGen < 2) {
        group.forEach((g) =>
          result.push({ origIdx: g.origIdx, edge: g.edge, edgeKind: 'child' })
        );
        return;
      }
    }

    // 1. Pilih 1 anak pintu masuk paling dekat dengan orang tua
    let anchorIdx = 0;
    let bestAnchorDist = Infinity;
    group.forEach((g, idx) => {
      const cb = boxMap.get(g.child.id);
      if (!cb) return;
      let dist = Math.hypot(cb.cx - parentBox.cx, cb.cy - parentBox.cy);
      const blocked = allBoxes.some(
        (ob) =>
          ob.id !== parentId &&
          ob.id !== g.child.id &&
          segmentCrossesBoxApprox(parentBox.cx, parentBox.cy, cb.cx, cb.cy, ob, 2)
      );
      if (blocked) dist += 180;
      if (dist < bestAnchorDist) {
        bestAnchorDist = dist;
        anchorIdx = idx;
      }
    });

    const anchor = group[anchorIdx];
    result.push({ origIdx: anchor.origIdx, edge: anchor.edge, edgeKind: 'child' });

    // 2. Hubungkan sisa saudara sekandung dengan Nearest-Neighbor Spanning Tree (jarak terdekat)
    const connected = [anchor];
    const remaining = group.filter((_, idx) => idx !== anchorIdx);

    while (remaining.length > 0) {
      let bestU = connected[0];
      let bestRemIdx = 0;
      let bestScore = Infinity;

      for (let ci = 0; ci < connected.length; ci++) {
        const u = connected[ci];
        const ub = boxMap.get(u.child.id);
        if (!ub) continue;

        for (let ri = 0; ri < remaining.length; ri++) {
          const v = remaining[ri];
          const vb = boxMap.get(v.child.id);
          if (!vb) continue;

          const dx = Math.abs(ub.cx - vb.cx);
          const dy = Math.abs(ub.cy - vb.cy);
          // Jarak tepi-ke-tepi perkiraan + sedikit bonus keselarasan baris/kolom
          const gapX = Math.max(0, dx - (ub.w + vb.w) / 2);
          const gapY = Math.max(0, dy - (ub.h + vb.h) / 2);
          let score = Math.hypot(gapX, gapY) + Math.hypot(dx, dy) * 0.25;

          const crossesObstacle = allBoxes.some(
            (ob) =>
              ob.id !== u.child.id &&
              ob.id !== v.child.id &&
              segmentCrossesBoxApprox(ub.cx, ub.cy, vb.cx, vb.cy, ob, 2)
          );
          if (crossesObstacle) score += 320;

          if (score < bestScore) {
            bestScore = score;
            bestU = u;
            bestRemIdx = ri;
          }
        }
      }

      const nextSib = remaining.splice(bestRemIdx, 1)[0];
      result.push({
        origIdx: nextSib.origIdx,
        edge: {
          ...nextSib.edge,
          from: bestU.child.id,
          to: nextSib.child.id,
          type: 'child',
          fromPort: undefined,
          toPort: undefined,
        },
        edgeKind: 'sibling',
      });
      connected.push(nextSib);
    }
  });

  return result;
}

function getSmartPorts(
  n1: InteractiveNode,
  n2: InteractiveNode,
  edgeType: 'couple' | 'child' | 'sibling',
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1,
  fromPortOverride?: EdgePortSide,
  toPortOverride?: EdgePortSide,
  obstacles?: NodeObstacleBox[]
) {
  const s1 = getNodeSize(n1, displayMode, photoSize, cardScale);
  const s2 = getNodeSize(n2, displayMode, photoSize, cardScale);

  const p1 = {
    top: { x: n1.x + s1.w / 2, y: n1.y },
    bottom: { x: n1.x + s1.w / 2, y: n1.y + s1.h },
    left: { x: n1.x, y: n1.y + s1.h / 2 },
    right: { x: n1.x + s1.w, y: n1.y + s1.h / 2 },
  };
  const p2 = {
    top: { x: n2.x + s2.w / 2, y: n2.y },
    bottom: { x: n2.x + s2.w / 2, y: n2.y + s2.h },
    left: { x: n2.x, y: n2.y + s2.h / 2 },
    right: { x: n2.x + s2.w, y: n2.y + s2.h / 2 },
  };

  type PortKey = keyof typeof p1;

  const cy1 = n1.y + s1.h / 2;
  const cy2 = n2.y + s2.h / 2;

  let autoPair: {
    a: { x: number; y: number };
    b: { x: number; y: number };
    dir1: PortKey;
    dir2: PortKey;
  };

  // Pasangan di baris sejajar selalu tersambung rapi kiri-kanan
  if (
    edgeType === 'couple' &&
    Math.abs(cy1 - cy2) < Math.max(s1.h, s2.h) * 0.75
  ) {
    if (n2.x >= n1.x) {
      autoPair = { a: p1.right, b: p2.left, dir1: 'right', dir2: 'left' };
    } else {
      autoPair = { a: p1.left, b: p2.right, dir1: 'left', dir2: 'right' };
    }
  } else if (edgeType === 'sibling') {
    // Rantai Saudara: pilih sisi terdekat yang bebas menabrak kartu pasangan / kartu tengah
    const otherObs = (obstacles || []).filter((ob) => ob.id !== n1.id && ob.id !== n2.id);
    const sameRow = Math.abs(cy1 - cy2) < Math.max(s1.h, s2.h) * 0.75;
    const sameCol =
      Math.abs(n1.x + s1.w / 2 - (n2.x + s2.w / 2)) < Math.max(s1.w, s2.w) * 0.75;

    let minScore = Infinity;
    autoPair = { a: p1.right, b: p2.left, dir1: 'right', dir2: 'left' };

    (Object.keys(p1) as PortKey[]).forEach((k1) => {
      (Object.keys(p2) as PortKey[]).forEach((k2) => {
        const pt1 = p1[k1];
        const pt2 = p2[k2];
        let score = Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);

        if (otherObs.length > 0) {
          const blocked = otherObs.some((ob) =>
            segmentCrossesBoxApprox(pt1.x, pt1.y, pt2.x, pt2.y, ob, 3)
          );
          if (blocked) score += 220;
        }
        if (sameRow && k1 === 'bottom' && k2 === 'bottom') score -= 12;
        if (sameRow && k1 === 'top' && k2 === 'top') score -= 8;
        if (sameCol && k1 === 'right' && k2 === 'right') score -= 8;

        if (score < minScore) {
          minScore = score;
          autoPair = { a: pt1, b: pt2, dir1: k1, dir2: k2 };
        }
      });
    });
  } else if (edgeType === 'child' && n2.y >= n1.y + s1.h * 0.6) {
    // Keturunan ke bawah -> jalur PCB keluar dari port bawah ke port atas anak
    autoPair = { a: p1.bottom, b: p2.top, dir1: 'bottom', dir2: 'top' };
  } else if (edgeType === 'child' && n2.y + s2.h <= n1.y + s1.h * 0.4) {
    // Keturunan ke atas (Pohon Besar G1 bawah -> G5 kanopi atas)
    autoPair = { a: p1.top, b: p2.bottom, dir1: 'top', dir2: 'bottom' };
  } else if (
    edgeType === 'child' &&
    n2.x >= n1.x + s1.w * 0.75 &&
    Math.abs(cy1 - cy2) < 200
  ) {
    // Keturunan cabang horizontal kiri ke kanan
    autoPair = { a: p1.right, b: p2.left, dir1: 'right', dir2: 'left' };
  } else if (
    edgeType === 'child' &&
    n2.x + s2.w * 0.75 <= n1.x &&
    Math.abs(cy1 - cy2) < 200
  ) {
    // Keturunan cabang horizontal kanan ke kiri
    autoPair = { a: p1.left, b: p2.right, dir1: 'left', dir2: 'right' };
  } else {
    let minDist = Infinity;
    autoPair = { a: p1.bottom, b: p2.top, dir1: 'bottom', dir2: 'top' };
    (Object.keys(p1) as PortKey[]).forEach((k1) => {
      (Object.keys(p2) as PortKey[]).forEach((k2) => {
        const dx = p1[k1].x - p2[k2].x;
        const dy = p1[k1].y - p2[k2].y;
        const dist = Math.hypot(dx, dy);
        if (dist < minDist) {
          minDist = dist;
          autoPair = { a: p1[k1], b: p2[k2], dir1: k1, dir2: k2 };
        }
      });
    });
  }

  const finalDir1 =
    fromPortOverride && fromPortOverride !== 'auto' ? fromPortOverride : autoPair.dir1;
  const finalDir2 =
    toPortOverride && toPortOverride !== 'auto' ? toPortOverride : autoPair.dir2;

  return {
    a: p1[finalDir1],
    b: p2[finalDir2],
    dir1: finalDir1,
    dir2: finalDir2,
  };
}

interface NodeObstacleBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function segmentIntersectsHoriz(
  y: number,
  x1: number,
  x2: number,
  box: NodeObstacleBox,
  pad = 5
): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  return (
    y >= box.y - pad &&
    y <= box.y + box.h + pad &&
    maxX >= box.x - pad &&
    minX <= box.x + box.w + pad
  );
}

function segmentIntersectsVert(
  x: number,
  y1: number,
  y2: number,
  box: NodeObstacleBox,
  pad = 5
): boolean {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return (
    x >= box.x - pad &&
    x <= box.x + box.w + pad &&
    maxY >= box.y - pad &&
    minY <= box.y + box.h + pad
  );
}

function buildConnectorRoute(
  pts: ReturnType<typeof getSmartPorts>,
  lineStyle: ConnectorLineStyle,
  edge: InteractiveEdge,
  obstacles: NodeObstacleBox[]
): { d: string; handle: { x: number; y: number }; isCustomOffset: boolean } {
  const { a, b, dir1, dir2 } = pts;
  const ax = Math.round(a.x * 10) / 10;
  const ay = Math.round(a.y * 10) / 10;
  const bx = Math.round(b.x * 10) / 10;
  const by = Math.round(b.y * 10) / 10;
  const dotT = Math.max(0.15, Math.min(0.85, edge.dotPos ?? 0.5));
  const midX = Math.round((ax + (bx - ax) * dotT) * 10) / 10;
  const midY = Math.round((ay + (by - ay) * dotT) * 10) / 10;

  const ox = edge.offsetX ?? 0;
  const oy = edge.offsetY ?? 0;
  const isCustomOffset = Math.abs(ox) >= 2 || Math.abs(oy) >= 2 || Math.abs(dotT - 0.5) >= 0.03;
  const otherBoxes = obstacles.filter((ob) => ob.id !== edge.from && ob.id !== edge.to);

  if (lineStyle === 'straight') {
    const hx = Math.round((midX + ox) * 10) / 10;
    const hy = Math.round((midY + oy) * 10) / 10;
    if (Math.abs(ox) < 2 && Math.abs(oy) < 2) {
      return {
        d: `M ${ax} ${ay} L ${bx} ${by}`,
        handle: { x: midX, y: midY },
        isCustomOffset: Math.abs(dotT - 0.5) >= 0.03,
      };
    }
    return {
      d: `M ${ax} ${ay} L ${hx} ${hy} L ${bx} ${by}`,
      handle: { x: hx, y: hy },
      isCustomOffset: true,
    };
  }

  if (lineStyle === 'curved') {
    const hx = Math.round((midX + ox) * 10) / 10;
    const hy = Math.round((midY + oy) * 10) / 10;
    if (Math.abs(ox) < 2 && Math.abs(oy) < 2) {
      const halfY = Math.round(((ay + by) / 2) * 10) / 10;
      const halfX = Math.round(((ax + bx) / 2) * 10) / 10;
      const d =
        dir1 === 'top' || dir1 === 'bottom'
          ? `M ${ax} ${ay} C ${ax} ${halfY}, ${bx} ${halfY}, ${bx} ${by}`
          : `M ${ax} ${ay} C ${halfX} ${ay}, ${halfX} ${by}, ${bx} ${by}`;
      return {
        d,
        handle: { x: midX, y: midY },
        isCustomOffset: Math.abs(dotT - 0.5) >= 0.03,
      };
    }
    // Kurva kuadratik yang persis melewati titik dot (hx, hy)
    const cx = Math.round((2 * hx - (ax + bx) / 2) * 10) / 10;
    const cy = Math.round((2 * hy - (ay + by) / 2) * 10) / 10;
    return {
      d: `M ${ax} ${ay} Q ${cx} ${cy}, ${bx} ${by}`,
      handle: { x: hx, y: hy },
      isCustomOffset: true,
    };
  }

  const isVert1 = dir1 === 'top' || dir1 === 'bottom';
  const isVert2 = dir2 === 'top' || dir2 === 'bottom';
  const dx = bx - ax;
  const dy = by - ay;
  const sx = dx >= 0 ? 1 : -1;
  const sy = dy >= 0 ? 1 : -1;

  // Jalur vertikal Parent -> Child (Paling umum)
  if (isVert1 && isVert2) {
    if (dir1 === dir2) {
      const baseOutY = dir1 === 'bottom' ? Math.max(ay, by) + 26 : Math.min(ay, by) - 26;
      const outY = Math.round((baseOutY + oy) * 10) / 10;
      const hx = Math.round((midX + ox) * 10) / 10;
      if (lineStyle === 'pcb90') {
        return {
          d: `M ${ax} ${ay} L ${ax} ${outY} L ${bx} ${outY} L ${bx} ${by}`,
          handle: { x: hx, y: outY },
          isCustomOffset,
        };
      }
      const c = Math.min(16, Math.abs(dx) / 3, Math.abs(outY - ay));
      const sy1 = outY >= ay ? 1 : -1;
      const sy2 = by >= outY ? 1 : -1;
      return {
        d: `M ${ax} ${ay} L ${ax} ${outY - sy1 * c} L ${ax + sx * c} ${outY} L ${bx - sx * c} ${outY} L ${bx} ${outY + sy2 * c} L ${bx} ${by}`,
        handle: { x: hx, y: outY },
        isCustomOffset,
      };
    }

    // Hitung rel horizontal dasar + penghindaran kartu otomatis (auto-avoid)
    let baseRailY =
      Math.abs(dy) > 190 && dir1 === 'bottom' && dir2 === 'top'
        ? Math.round((by - 20) * 10) / 10
        : midY;
    let autoDetourX: number | null = null;

    if (!isCustomOffset && otherBoxes.length > 0) {
      const railHits = otherBoxes.some((ob) => segmentIntersectsHoriz(baseRailY, ax, bx, ob, 5));
      if (railHits) {
        const candidates = [
          by - 20,
          ay + 20,
          baseRailY - 26,
          baseRailY + 26,
          baseRailY - 52,
          baseRailY + 52,
        ];
        for (const candY of candidates) {
          if (!otherBoxes.some((ob) => segmentIntersectsHoriz(candY, ax, bx, ob, 5))) {
            baseRailY = Math.round(candY * 10) / 10;
            break;
          }
        }
      }

      // Cek apakah penurunan vertikal di ax menabrak kartu lain
      const blockingBox = otherBoxes.find((ob) =>
        segmentIntersectsVert(ax, ay + (dir1 === 'bottom' ? 14 : -14), baseRailY, ob, 4)
      );
      if (blockingBox) {
        const leftClear = blockingBox.x - 14;
        const rightClear = blockingBox.x + blockingBox.w + 14;
        autoDetourX = Math.abs(leftClear - ax) <= Math.abs(rightClear - ax) ? leftClear : rightClear;
      }
    }

    const railY = Math.round((baseRailY + oy) * 10) / 10;
    const hasHorizDetour = Math.abs(ox) >= 6 || autoDetourX !== null;

    if (!hasHorizDetour) {
      if (Math.abs(dx) < 1.5 && Math.abs(oy) < 2) {
        return {
          d: `M ${ax} ${ay} L ${bx} ${by}`,
          handle: { x: midX, y: railY },
          isCustomOffset,
        };
      }
      if (lineStyle === 'pcb90') {
        return {
          d: `M ${ax} ${ay} L ${ax} ${railY} L ${bx} ${railY} L ${bx} ${by}`,
          handle: { x: midX, y: railY },
          isCustomOffset,
        };
      }
      const c = Math.min(20, Math.abs(dx) / 2, Math.abs(railY - ay), Math.abs(by - railY));
      return {
        d: `M ${ax} ${ay} L ${ax} ${railY - sy * c} L ${ax + sx * c} ${railY} L ${bx - sx * c} ${railY} L ${bx} ${railY + sy * c} L ${bx} ${by}`,
        handle: { x: midX, y: railY },
        isCustomOffset,
      };
    }

    // Rute belokan 5 segmen melalui trunkX (geser kiri/kanan bebas menghindari kartu!)
    const trunkX = Math.round((Math.abs(ox) >= 6 ? midX + ox : autoDetourX!) * 10) / 10;
    const exitY = Math.round((ay + (dir1 === 'bottom' ? 14 : -14)) * 10) / 10;

    if (lineStyle === 'pcb90') {
      return {
        d: `M ${ax} ${ay} L ${ax} ${exitY} L ${trunkX} ${exitY} L ${trunkX} ${railY} L ${bx} ${railY} L ${bx} ${by}`,
        handle: { x: trunkX, y: railY },
        isCustomOffset,
      };
    }

    const sxA = trunkX >= ax ? 1 : -1;
    const sxB = bx >= trunkX ? 1 : -1;
    const syMid = railY >= exitY ? 1 : -1;
    const syEnd = by >= railY ? 1 : -1;
    const c1 = Math.min(10, Math.abs(trunkX - ax) / 2, Math.abs(exitY - ay) / 2);
    const c2 = Math.min(10, Math.abs(trunkX - ax) / 2, Math.abs(railY - exitY) / 2);
    const c3 = Math.min(10, Math.abs(bx - trunkX) / 2, Math.abs(railY - exitY) / 2);
    const c4 = Math.min(10, Math.abs(bx - trunkX) / 2, Math.abs(by - railY) / 2);
    const syExit = exitY >= ay ? 1 : -1;
    return {
      d: `M ${ax} ${ay} L ${ax} ${exitY - syExit * c1} L ${ax + sxA * c1} ${exitY} L ${trunkX - sxA * c2} ${exitY} L ${trunkX} ${exitY + syMid * c2} L ${trunkX} ${railY - syMid * c3} L ${trunkX + sxB * c3} ${railY} L ${bx - sxB * c4} ${railY} L ${bx} ${railY + syEnd * c4} L ${bx} ${by}`,
      handle: { x: trunkX, y: railY },
      isCustomOffset,
    };
  }

  // Jalur horizontal (Pasangan / Cabang kiri->kanan)
  if (!isVert1 && !isVert2) {
    if (dir1 === dir2) {
      const baseOutX = dir1 === 'right' ? Math.max(ax, bx) + 26 : Math.min(ax, bx) - 26;
      const outX = Math.round((baseOutX + ox) * 10) / 10;
      const hy = Math.round((midY + oy) * 10) / 10;
      return {
        d: `M ${ax} ${ay} L ${outX} ${ay} L ${outX} ${by} L ${bx} ${by}`,
        handle: { x: outX, y: hy },
        isCustomOffset,
      };
    }

    const railX = Math.round((midX + ox) * 10) / 10;
    const trunkY = Math.round((midY + oy) * 10) / 10;

    if (Math.abs(oy) < 6) {
      if (Math.abs(dy) < 1.5 && Math.abs(ox) < 2) {
        return {
          d: `M ${ax} ${ay} L ${bx} ${by}`,
          handle: { x: railX, y: midY },
          isCustomOffset,
        };
      }
      if (lineStyle === 'pcb90') {
        return {
          d: `M ${ax} ${ay} L ${railX} ${ay} L ${railX} ${by} L ${bx} ${by}`,
          handle: { x: railX, y: midY },
          isCustomOffset,
        };
      }
      const c = Math.min(20, Math.abs(railX - ax), Math.abs(bx - railX), Math.abs(dy) / 2);
      return {
        d: `M ${ax} ${ay} L ${railX - sx * c} ${ay} L ${railX} ${ay + sy * c} L ${railX} ${by - sy * c} L ${railX + sx * c} ${by} L ${bx} ${by}`,
        handle: { x: railX, y: midY },
        isCustomOffset,
      };
    }

    const exitX = Math.round((ax + (dir1 === 'right' ? 14 : -14)) * 10) / 10;
    return {
      d: `M ${ax} ${ay} L ${exitX} ${ay} L ${exitX} ${trunkY} L ${railX} ${trunkY} L ${railX} ${by} L ${bx} ${by}`,
      handle: { x: railX, y: trunkY },
      isCustomOffset,
    };
  }

  // Siku L antara sisi vertikal & horizontal
  const hx = Math.round(((isVert1 ? ax : bx) + ox) * 10) / 10;
  const hy = Math.round(((isVert1 ? by : ay) + oy) * 10) / 10;
  if (!isCustomOffset) {
    const c = lineStyle === 'pcb90' ? 0 : Math.min(18, Math.abs(dx), Math.abs(dy));
    if (isVert1 && !isVert2) {
      const d =
        c === 0
          ? `M ${ax} ${ay} L ${ax} ${by} L ${bx} ${by}`
          : `M ${ax} ${ay} L ${ax} ${by - sy * c} L ${ax + sx * c} ${by} L ${bx} ${by}`;
      return { d, handle: { x: ax, y: by }, isCustomOffset: false };
    }
    const d =
      c === 0
        ? `M ${ax} ${ay} L ${bx} ${ay} L ${bx} ${by}`
        : `M ${ax} ${ay} L ${bx - sx * c} ${ay} L ${bx} ${ay + sy * c} L ${bx} ${by}`;
    return { d, handle: { x: bx, y: ay }, isCustomOffset: false };
  }

  return {
    d: isVert1
      ? `M ${ax} ${ay} L ${ax} ${hy} L ${hx} ${hy} L ${hx} ${by} L ${bx} ${by}`
      : `M ${ax} ${ay} L ${hx} ${ay} L ${hx} ${hy} L ${bx} ${hy} L ${bx} ${by}`,
    handle: { x: hx, y: hy },
    isCustomOffset: true,
  };
}

function findNonOverlappingSlot(
  preferredX: number,
  preferredY: number,
  cardW: number,
  cardH: number,
  boardW: number,
  boardH: number,
  occupied: Array<{ x: number; y: number; w: number; h: number }>
): { x: number; y: number } {
  const minX = 24;
  const maxX = Math.max(minX, boardW - cardW - 24);
  const minY = 72;
  const maxY = Math.max(minY, boardH - cardH - 72);
  const padX = 12;
  const padY = 14;

  const overlapsAny = (cx: number, cy: number) =>
    occupied.some(
      (b) =>
        cx < b.x + b.w + padX &&
        cx + cardW + padX > b.x &&
        cy < b.y + b.h + padY &&
        cy + cardH + padY > b.y
    );

  const clampedPrefX = Math.max(minX, Math.min(maxX, Math.round(preferredX / SNAP_SIZE) * SNAP_SIZE));
  const clampedPrefY = Math.max(minY, Math.min(maxY, Math.round(preferredY / SNAP_SIZE) * SNAP_SIZE));
  if (!overlapsAny(clampedPrefX, clampedPrefY)) {
    return { x: clampedPrefX, y: clampedPrefY };
  }

  const stepX = Math.max(SNAP_SIZE, cardW + padX);
  const stepY = Math.max(SNAP_SIZE, cardH + padY);

  // Cari di sekitar baris preferredY terlebih dahulu (ke kanan / kiri), lalu geser ke baris bawah/atas
  for (let rowOffset = 0; rowOffset <= 12; rowOffset++) {
    const candidateYs =
      rowOffset === 0
        ? [clampedPrefY]
        : [clampedPrefY + rowOffset * stepY, clampedPrefY - rowOffset * stepY];
    for (const rawY of candidateYs) {
      if (rawY < minY || rawY > maxY) continue;
      for (let x = minX; x <= maxX; x += stepX) {
        const sx = Math.round(x / SNAP_SIZE) * SNAP_SIZE;
        const sy = Math.round(rawY / SNAP_SIZE) * SNAP_SIZE;
        if (!overlapsAny(sx, sy)) {
          return { x: sx, y: sy };
        }
      }
    }
  }

  // Fallback penuh seluruh kertas agar tidak pernah menumpuk di pojok yang sama
  for (let y = minY; y <= maxY; y += stepY) {
    for (let x = minX; x <= maxX; x += stepX) {
      const sx = Math.round(x / SNAP_SIZE) * SNAP_SIZE;
      const sy = Math.round(y / SNAP_SIZE) * SNAP_SIZE;
      if (!overlapsAny(sx, sy)) {
        return { x: sx, y: sy };
      }
    }
  }

  return { x: clampedPrefX, y: clampedPrefY };
}

function reconcileCanvasWithMembers(
  currentNodes: InteractiveNode[],
  currentEdges: InteractiveEdge[],
  members: FamilyMember[],
  boardW: number,
  boardH: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  currentScale: number,
  forceAutoReflow: boolean
): {
  nodes: InteractiveNode[];
  edges: InteractiveEdge[];
  nextScale: number;
  changed: boolean;
  reflowed: boolean;
} {
  if (!members || members.length === 0) {
    return {
      nodes: currentNodes,
      edges: currentEdges,
      nextScale: currentScale,
      changed: false,
      reflowed: false,
    };
  }

  const memberMap = new Map<string, FamilyMember>(members.map((m) => [m.id, m]));
  let changed = false;

  // 1. Perbarui metadata node yang terhubung (termasuk anggota dalam Card Besar Gabungan)
  let updatedNodes: InteractiveNode[] = currentNodes
    .filter((n) => {
      if (n.memberId && !memberMap.has(n.memberId)) {
        changed = true;
        return false;
      }
      return true;
    })
    .map((n) => {
      if (n.mergedMembers && n.mergedMembers.length > 0) {
        let subChanged = false;
        const syncedMerged = n.mergedMembers
          .filter((mm) => {
            if (mm.memberId && !memberMap.has(mm.memberId)) {
              subChanged = true;
              return false;
            }
            return true;
          })
          .map((mm) => {
            if (!mm.memberId) return mm;
            const m = memberMap.get(mm.memberId);
            if (!m) return mm;
            const nextSub = formatMemberLifeSubtitle(m);
            const nextPhoto = m.photoUrl || mm.photo;
            if (
              mm.name !== m.name ||
              mm.sub !== nextSub ||
              mm.photo !== nextPhoto ||
              mm.wafat !== m.isDeceased ||
              mm.gender !== m.gender ||
              mm.genLevel !== m.generationLevel
            ) {
              subChanged = true;
              return {
                ...mm,
                name: m.name,
                sub: nextSub,
                photo: nextPhoto,
                wafat: m.isDeceased,
                gender: m.gender,
                genLevel: m.generationLevel,
              };
            }
            return mm;
          });

        // Pastikan urutan sibling di dalam Card Gabungan mengikuti orderIndex terbaru
        const sortedMerged = [...syncedMerged].sort((a, b) => {
          const ma = a.memberId ? memberMap.get(a.memberId) : undefined;
          const mb = b.memberId ? memberMap.get(b.memberId) : undefined;
          if (ma && mb && (ma.parentId || null) === (mb.parentId || null)) {
            return (ma.orderIndex || 0) - (mb.orderIndex || 0);
          }
          return 0;
        });
        const orderChangedInMerged = sortedMerged.some(
          (item, idx) => item !== syncedMerged[idx]
        );
        if (orderChangedInMerged) subChanged = true;

        if (subChanged) {
          changed = true;
          if (sortedMerged.length === 1) {
            const lone = sortedMerged[0];
            return {
              id: lone.originalNodeId || n.id,
              memberId: lone.memberId,
              name: lone.name,
              sub: lone.sub,
              x: n.x,
              y: n.y,
              photo: lone.photo,
              wafat: lone.wafat,
              gender: lone.gender,
              genLevel: lone.genLevel,
              customBgColor: lone.customBgColor || n.customBgColor,
              customBorderColor: lone.customBorderColor || n.customBorderColor,
            };
          }
          return {
            ...n,
            mergedMembers: sortedMerged.map((mm) => {
              const member = mm.memberId ? memberMap.get(mm.memberId) : undefined;
              return member
                ? { ...mm, parentMemberId: member.parentId ?? mm.parentMemberId }
                : mm;
            }),
          };
        }
        return n;
      }

      if (!n.memberId) {
        // Sinkronkan nama, status & foto pasangan langsung dari tabel
        const spMatch = n.id.match(/^n_(.+)_sp_(\d+)$/);
        if (spMatch) {
          const primaryM = memberMap.get(spMatch[1]);
          const spIdx = Math.max(0, Number(spMatch[2]) - 1);
          const sp = primaryM?.spouses?.[spIdx];
          if (primaryM && sp) {
            const nextSub = `Pasangan (${
              sp.status === 'cerai_mati'
                ? 'Wafat'
                : sp.status === 'cerai_hidup'
                ? 'Cerai'
                : 'Menikah'
            })`;
            const nextPhoto = sp.photoUrl || '';
            const nextWafat = sp.status === 'cerai_mati';
            const nextGender: 'L' | 'P' | undefined =
              primaryM.gender === 'L' ? 'P' : primaryM.gender === 'P' ? 'L' : n.gender;
            if (
              n.name !== sp.name ||
              n.sub !== nextSub ||
              n.photo !== nextPhoto ||
              n.wafat !== nextWafat ||
              n.gender !== nextGender
            ) {
              changed = true;
              return {
                ...n,
                name: sp.name,
                sub: nextSub,
                photo: nextPhoto,
                wafat: nextWafat,
                gender: nextGender,
              };
            }
          }
        }
        return n;
      }
      const m = memberMap.get(n.memberId);
      if (!m) return n;
      const nextSub = formatMemberLifeSubtitle(m);
      const nextPhoto = m.photoUrl ?? n.photo;
      if (
        n.name !== m.name ||
        n.sub !== nextSub ||
        n.photo !== nextPhoto ||
        n.wafat !== m.isDeceased ||
        n.gender !== m.gender ||
        n.genLevel !== m.generationLevel
      ) {
        changed = true;
        return {
          ...n,
          name: m.name,
          sub: nextSub,
          photo: nextPhoto,
          wafat: m.isDeceased,
          gender: m.gender,
          genLevel: m.generationLevel,
        };
      }
      return n;
    });

  // Sinkronkan gender kartu pasangan (tanpa memberId) agar tetap berlawanan dengan pasangan utamanya
  const primaryGenderByNodeId = new Map<string, 'L' | 'P'>();
  updatedNodes.forEach((n) => {
    if (n.memberId && n.gender) {
      primaryGenderByNodeId.set(n.id, n.gender);
    }
  });
  const spouseInferredGenderByNodeId = new Map<string, 'L' | 'P'>();
  currentEdges.forEach((e) => {
    if (e.type !== 'couple') return;
    const gFrom = primaryGenderByNodeId.get(e.from);
    const gTo = primaryGenderByNodeId.get(e.to);
    if (gFrom && !gTo) {
      spouseInferredGenderByNodeId.set(e.to, gFrom === 'L' ? 'P' : 'L');
    } else if (gTo && !gFrom) {
      spouseInferredGenderByNodeId.set(e.from, gTo === 'L' ? 'P' : 'L');
    }
  });
  updatedNodes.forEach((n, idx) => {
    if (n.memberId) return;
    const expectedSpouseGender = spouseInferredGenderByNodeId.get(n.id);
    if (expectedSpouseGender && n.gender !== expectedSpouseGender) {
      changed = true;
      updatedNodes[idx] = { ...n, gender: expectedSpouseGender };
    }
  });

  const survivingIds = new Set(updatedNodes.map((n) => n.id));
  const updatedEdges: InteractiveEdge[] = currentEdges.filter((e) => {
    const keep = survivingIds.has(e.from) && survivingIds.has(e.to);
    if (!keep) changed = true;
    return keep;
  });

  const presentMemberIds = new Set<string>();
  updatedNodes.forEach((n) => {
    if (n.memberId) presentMemberIds.add(n.memberId);
    if (n.mergedMembers) {
      n.mergedMembers.forEach((mm) => {
        if (mm.memberId) presentMemberIds.add(mm.memberId);
      });
    }
  });
  const missingMembers = members.filter((m) => !presentMemberIds.has(m.id));

  // Deteksi apakah kartu yang tersimpan mengalami penumpukan parah (mis. koordinat hampir sama)
  let stackedPairs = 0;
  if (updatedNodes.length >= 6) {
    const coordBuckets = new Set<string>();
    updatedNodes.forEach((n) => {
      const bucket = `${Math.round(n.x / 18)}_${Math.round(n.y / 18)}`;
      if (coordBuckets.has(bucket)) stackedPairs++;
      else coordBuckets.add(bucket);
    });
  }
  const hasSevereStacking =
    updatedNodes.length >= 6 && stackedPairs >= Math.max(3, Math.floor(updatedNodes.length * 0.2));

  const optScale = computeOptimalCardScale(
    members,
    boardW,
    boardH,
    displayMode,
    photoSize
  );

  // Jika kanvas masih kosong, ada penambahan massal (>= 3 anggota baru, mis. Excel/Isi Cepat),
  // mode auto aktif, skala saat ini terlalu besar untuk jumlah anggota baru, atau terdeteksi penumpukan -> tata ulang penuh rapi anti-tumpuk!
  const shouldReflowAll =
    updatedNodes.length === 0 ||
    missingMembers.length >= 3 ||
    hasSevereStacking ||
    (missingMembers.length > 0 && (forceAutoReflow || currentScale > optScale + 0.1));

  if (shouldReflowAll) {
    const sampleDim = getNodeSize(
      { id: 'tmp', name: 'Anggota Keluarga', sub: '', x: 0, y: 0, photo: '', wafat: false },
      displayMode,
      photoSize,
      optScale
    );
    const rebuilt = generateSmartLayoutFromTable(
      members,
      members.length > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical',
      boardW,
      boardH,
      sampleDim
    );
    return {
      nodes: rebuilt.nodes,
      edges: rebuilt.edges,
      nextScale: optScale,
      changed: true,
      reflowed: true,
    };
  }

  // Penambahan ringan (1–2 anggota di Mode Manual): sisipkan ke slot kosong bebas-tabrakan
  if (missingMembers.length > 0) {
    changed = true;
    const sampleDim = getNodeSize(
      { id: 'tmp', name: 'Anggota Keluarga', sub: '', x: 0, y: 0, photo: '', wafat: false },
      displayMode,
      photoSize,
      currentScale
    );
    const occupied = updatedNodes.map((n) => {
      const sz = getNodeSize(n, displayMode, photoSize, currentScale);
      return { x: n.x, y: n.y, w: sz.w, h: sz.h };
    });

    // Urutkan berdasarkan generationLevel agar orang tua selalu dibuat sebelum anaknya
    const orderedMissing = [...missingMembers].sort(
      (a, b) => (a.generationLevel || 0) - (b.generationLevel || 0) || (a.orderIndex || 0) - (b.orderIndex || 0)
    );
    const siblingOffsetByParent = new Map<string, number>();

    orderedMissing.forEach((m, idx) => {
      const parentNode = m.parentId
        ? updatedNodes.find((n) => n.memberId === m.parentId || n.id === m.parentId)
        : undefined;
      const pKey = m.parentId || '__root__';
      const sibIdx = siblingOffsetByParent.get(pKey) ?? 0;
      siblingOffsetByParent.set(pKey, sibIdx + 1);

      const prefX = parentNode
        ? parentNode.x + sibIdx * (sampleDim.w + 22)
        : 60 + idx * (sampleDim.w + 24);
      const prefY = parentNode
        ? parentNode.y + sampleDim.h + 48
        : 80 + (m.generationLevel || 0) * (sampleDim.h + 48);

      const spot = findNonOverlappingSlot(
        prefX,
        prefY,
        sampleDim.w,
        sampleDim.h,
        boardW,
        boardH,
        occupied
      );

      const nodeId = `node_${m.id}`;
      const newNode: InteractiveNode = {
        id: nodeId,
        memberId: m.id,
        name: m.name,
        sub: formatMemberLifeSubtitle(m),
        x: spot.x,
        y: spot.y,
        photo: m.photoUrl || '',
        wafat: m.isDeceased,
        gender: m.gender,
        genLevel: m.generationLevel,
      };
      updatedNodes.push(newNode);
      occupied.push({ x: spot.x, y: spot.y, w: sampleDim.w, h: sampleDim.h });

      if (parentNode) {
        updatedEdges.push({ from: parentNode.id, to: nodeId, type: 'child' });
      }

      if (m.spouses && m.spouses.length > 0) {
        m.spouses.forEach((sp, spIdx) => {
          const spSpot = findNonOverlappingSlot(
            spot.x + (spIdx + 1) * (sampleDim.w + 14),
            spot.y,
            sampleDim.w,
            sampleDim.h,
            boardW,
            boardH,
            occupied
          );
          const spNodeId = `node_${m.id}_sp_${spIdx}`;
          updatedNodes.push({
            id: spNodeId,
            name: sp.name,
            sub: 'Pasangan',
            x: spSpot.x,
            y: spSpot.y,
            photo: sp.photoUrl || '',
            wafat: sp.status === 'cerai_mati',
            gender: m.gender === 'L' ? 'P' : m.gender === 'P' ? 'L' : undefined,
            genLevel: m.generationLevel,
          });
          occupied.push({ x: spSpot.x, y: spSpot.y, w: sampleDim.w, h: sampleDim.h });
          updatedEdges.push({ from: nodeId, to: spNodeId, type: 'couple' });
        });
      }
    });
  }

  return {
    nodes: updatedNodes,
    edges: updatedEdges,
    nextScale: currentScale,
    changed,
    reflowed: false,
  };
}

export const InteractiveGridCanvasView: React.FC<
  InteractiveGridCanvasViewProps
> = ({
  activeTrah,
  onOpenTable,
  onSyncMember,
  showNotification,
  defaultCuratorName = '',
  defaultCreatedYear = '',
  defaultPhotoShape = 'kotak',
  enterStudioTrigger = 0,
}) => {
  // Mode Ruang Kerja ('smart' bebas alat edit vs 'edit' manual opsional) & Interaksi
  const [studioWorkspaceMode, setStudioWorkspaceMode] = useState<'smart' | 'edit'>('smart');
  const [isSmartGalleryOpen, setIsSmartGalleryOpen] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<GridLayoutMode>('manual');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showPrintFeeModal, setShowPrintFeeModal] = useState<boolean>(false);
  const [pendingExportAction, setPendingExportAction] = useState<'print' | 'png' | 'pdf'>('print');
  const [isExportingPoster, setIsExportingPoster] = useState<boolean>(false);
  const [exportPhotoMap, setExportPhotoMap] = useState<Record<string, string> | null>(null);
  const [posterPreviewModal, setPosterPreviewModal] = useState<{
    dataUrl: string;
    filename: string;
    width: number;
    height: number;
    upscaledCount: number;
  } | null>(null);

  // Kertas A0 - A4 & Orientasi
  const [paperSize, setPaperSize] = useState<GridPaperSize>('a3');
  const [paperOrientation, setPaperOrientation] =
    useState<GridPaperOrientation>('landscape');

  // Gaya Card & Foto (Lengkap / Foto+Nama / Nama / Foto + Kotak/Bulat/Segi6 + Skala + Jarak mm)
  const [cardDisplayMode, setCardDisplayMode] =
    useState<CardDisplayMode>('full');
  const [photoFrameSize, setPhotoFrameSize] =
    useState<PhotoFrameSize>('3x4');
  const [photoShape, setPhotoShape] = useState<GridPhotoShape>(defaultPhotoShape);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [cardScale, setCardScale] = useState<number>(1);
  const [cardGapMm, setCardGapMm] = useState<number>(3.5);
  const [modularG12Position, setModularG12Position] = useState<'top' | 'center'>('center');
  const [showGenGuides, setShowGenGuides] = useState<boolean>(true);
  const [guideOverlayMode, setGuideOverlayMode] = useState<GuideOverlayMode>('gen_bands');
  const [smartCategoryFilter, setSmartCategoryFilter] = useState<
    'all' | 'kotak9' | 'orbit' | 'modular' | 'klasik'
  >('all');

  // Jendela Fokus Cabang & Kedalaman Generasi (Solusi Skalabilitas s/d G20+)
  const [focalRootMemberId, setFocalRootMemberId] = useState<string>('all');
  const [maxVisibleDepth, setMaxVisibleDepth] = useState<number>(0);

  // Tema, Gradasi Generasi & Background
  const [theme, setTheme] = useState<CanvasTheme>('dark');
  const [bgStyle, setBgStyle] = useState<CanvasBackground>('');
  const [genGradientPalette, setGenGradientPalette] =
    useState<GenGradientPaletteId>('none');

  // Gaya Garis PCB / Dot Jalur & Ujung / Warna Garis & Card / Keterangan Poster
  const [lineStyle, setLineStyle] = useState<ConnectorLineStyle>('pcb90');
  const [lineRoutingTopology, setLineRoutingTopology] =
    useState<LineRoutingTopology>('sibling_chain_all');
  const [lineThicknessMode, setLineThicknessMode] =
    useState<LineThicknessMode>('uniform');
  const [cardFrameMode, setCardFrameMode] = useState<CardFrameMode>('auto');
  const [showLineArrows, setShowLineArrows] = useState<boolean>(true);
  const [lineThickness, setLineThickness] = useState<number>(2.5);
  const [childLineColor, setChildLineColor] = useState<string>('');
  const [coupleLineColor, setCoupleLineColor] = useState<string>('#f59e0b');
  const [siblingLineColor, setSiblingLineColor] = useState<string>('');
  const [linesOnTop, setLinesOnTop] = useState<boolean>(false);
  const [showLineDots, setShowLineDots] = useState<boolean>(true);
  const [showEndpointDots, setShowEndpointDots] = useState<boolean>(true);
  const [cardBgColor, setCardBgColor] = useState<string>('');
  const [cardBorderColor, setCardBorderColor] = useState<string>('');
  const [captionInfo, setCaptionInfo] = useState<CanvasCaptionInfo>(() =>
    getDefaultCaptionInfo(activeTrah.name, defaultCuratorName, defaultCreatedYear)
  );

  // Kunci Geser Aman (Hold 2 detik atau tombol Pindah untuk buka popup panah ▲▼◀▶ & geser kartu)
  const [safeHoldMove, setSafeHoldMove] = useState<boolean>(true);
  const [holdingNodeId, setHoldingNodeId] = useState<string | null>(null);
  const [moveUnlockedIds, setMoveUnlockedIds] = useState<string[]>([]);
  const [moveAnchorId, setMoveAnchorId] = useState<string | null>(null);
  const [moveStepPx, setMoveStepPx] = useState<5 | 20 | 40>(20);
  const [activeEdgeIdx, setActiveEdgeIdx] = useState<number | null>(null);

  // Panel Edit Kiri & Tab Panel ('edit' | 'designs' | 'smart' | 'style')
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [panelTab, setPanelTab] = useState<'edit' | 'designs' | 'smart' | 'style'>('smart');
  const [lockSelectedPaper, setLockSelectedPaper] = useState<boolean>(true);
  const [applyRecommendedStyle, setApplyRecommendedStyle] = useState<boolean>(true);

  // Data Kanvas
  const [nodes, setNodes] = useState<InteractiveNode[]>([]);
  const [edges, setEdges] = useState<InteractiveEdge[]>([]);
  const [quickText, setQuickText] = useState<string>(() =>
    buildQuickTextFromTrah(activeTrah.members)
  );

  // Multi-Select & Connect
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [connectType, setConnectType] = useState<'child' | 'couple'>('child');
  const [zoom, setZoom] = useState<number>(0.56);

  // Marquee Selection Box (seret kotak di area kosong untuk pilih banyak kartu)
  const [marqueeBox, setMarqueeBox] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const marqueeRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
  }>({ active: false, startX: 0, startY: 0 });

  // Mode Studio Fullscreen (Otomatis aktif saat buka tab Grid) + Layar Miring ala Game + Hybrid Render
  const [isFocusMode, setIsFocusMode] = useState<boolean>(true);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [studioScreenMode, setStudioScreenMode] =
    useState<StudioScreenMode>('portrait');
  const [nativeLandscapeActive, setNativeLandscapeActive] =
    useState<boolean>(false);
  const [windowSize, setWindowSize] = useState<{ w: number; h: number }>(() =>
    typeof window !== 'undefined'
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 390, h: 844 }
  );
  const [isHudHidden, setIsHudHidden] = useState<boolean>(false);
  const [isMiniNavOpen, setIsMiniNavOpen] = useState<boolean>(false);
  const [renderQualityMode, setRenderQualityMode] = useState<
    'auto' | 'hd' | 'snapshot'
  >('auto');
  const [isDraggingCards, setIsDraggingCards] = useState<boolean>(false);

  // Undo History Stack (maksimal 35 langkah)
  const MAX_UNDO_STEPS = 35;
  const undoStackRef = useRef<
    Array<{
      nodes: InteractiveNode[];
      edges: InteractiveEdge[];
      quickText: string;
      guideOverlayMode: GuideOverlayMode;
      cardScale: number;
      label: string;
    }>
  >([]);
  const [undoCount, setUndoCount] = useState<number>(0);
  const lastEditUndoTimeRef = useRef<number>(0);
  const lastTouchTimeRef = useRef<number>(0);

  // Ref untuk Timer Hold 2 Detik, Repeat Panah, dan Geser Dot Jalur Garis
  const holdTimerRef = useRef<{
    active: boolean;
    nodeId: string;
    startClientX: number;
    startClientY: number;
    intervalId: number | null;
  }>({ active: false, nodeId: '', startClientX: 0, startClientY: 0, intervalId: null });

  const nudgeIntervalRef = useRef<number | null>(null);

  const edgeDragRef = useRef<{
    active: boolean;
    edgeIdx: number;
    startPointerX: number;
    startPointerY: number;
    initOffsetX: number;
    initOffsetY: number;
    preDragEdges?: InteractiveEdge[];
  }>({
    active: false,
    edgeIdx: -1,
    startPointerX: 0,
    startPointerY: 0,
    initOffsetX: 0,
    initOffsetY: 0,
  });

  // Manajemen Desain Tersimpan & Blueprint Desain AI (0 token saat edit/ganti kertas/download)
  const [savedDesigns, setSavedDesigns] = useState<SavedGridDesign[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string>('');
  const [activePresetId, setActivePresetId] = useState<SmartPresetId | undefined>(undefined);
  const [aiBlueprint, setAiBlueprint] = useState<NasabAiBlueprint | null>(null);
  const [isAiDesignModalOpen, setIsAiDesignModalOpen] = useState<boolean>(false);
  const [aiDesignArchetype, setAiDesignArchetype] = useState<NasabAiArchetype | 'auto'>('auto');
  const [aiDesignPrompt, setAiDesignPrompt] = useState<string>('');
  const [isAiDesigning, setIsAiDesigning] = useState<boolean>(false);
  const [aiDesignError, setAiDesignError] = useState<string | null>(null);
  const [aiQuotaInfo, setAiQuotaInfo] = useState<AiDesignerQuotaInfo>(() =>
    getAiDesignerQuotaInfo()
  );
  const [designNameInput, setDesignNameInput] = useState<string>('');

  const boardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageTransformRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const miniNavViewportElRef = useRef<HTMLDivElement | null>(null);
  const nodeDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRubberSvgRef = useRef<SVGSVGElement | null>(null);
  const loadedTrahIdRef = useRef<string>('');
  const lastMemberSigRef = useRef<string>('');
  const lastStructureSigRef = useRef<string>('');

  // GPU Artboard Transform Ref (0 React re-render saat pan / pinch-zoom!)
  const viewTransformRef = useRef<{ panX: number; panY: number; zoom: number }>({
    panX: 24,
    panY: 24,
    zoom: 0.56,
  });
  const stageRafRef = useRef<number | null>(null);
  const zoomSyncTimerRef = useRef<number | null>(null);
  const pendingFocusCenterRef = useRef<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);

  // Pinch-to-Zoom 2 Jari & Pan Hand Ref
  const pinchRef = useRef<{
    active: boolean;
    startDist: number;
    startZoom: number;
    midX: number;
    midY: number;
    startPanX: number;
    startPanY: number;
  }>({
    active: false,
    startDist: 0,
    startZoom: 1,
    midX: 0,
    midY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  const panDragRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  }>({
    active: false,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // Drag State Ref (Direct-DOM GPU translate3d tanpa setNodes tiap frame!)
  const dragStateRef = useRef<{
    active: boolean;
    movingIds: string[];
    startPointerX: number;
    startPointerY: number;
    initialPositions: Record<string, { x: number; y: number }>;
    lastDx: number;
    lastDy: number;
    preDragNodes?: InteractiveNode[];
  }>({
    active: false,
    movingIds: [],
    startPointerX: 0,
    startPointerY: 0,
    initialPositions: {},
    lastDx: 0,
    lastDy: 0,
  });

  // Dimensi Kertas Aktif (A0 - A4)
  const paperDim = GRID_PAPER_MAP[paperSize];
  const boardWidth =
    paperOrientation === 'landscape' ? paperDim.pxW : paperDim.pxH;
  const boardHeight =
    paperOrientation === 'landscape' ? paperDim.pxH : paperDim.pxW;
  const printPaperWmm =
    paperOrientation === 'landscape' ? paperDim.wMm : paperDim.hMm;
  const printPaperHmm =
    paperOrientation === 'landscape' ? paperDim.hMm : paperDim.wMm;

  const collectBoardPhotoUrls = useCallback((): string[] => {
    const urls: string[] = [];
    nodes.forEach((n) => {
      if (n.photo) urls.push(n.photo);
      if (n.mergedMembers) {
        n.mergedMembers.forEach((mm) => {
          if (mm.photo) urls.push(mm.photo);
        });
      }
    });
    return Array.from(new Set(urls.filter(Boolean)));
  }, [nodes]);

  const injectDynamicPrintPageStyle = useCallback(() => {
    const styleId = 'leluhur-grid-print-page-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @page {
        size: ${printPaperWmm}mm ${printPaperHmm}mm;
        margin: 0;
      }
      @media print {
        #grid-gpu-stage {
          transform: none !important;
          position: static !important;
        }
        #printable-pcb-preview {
          width: ${boardWidth}px !important;
          height: ${boardHeight}px !important;
          transform: scale(1) !important;
          transform-origin: top left !important;
        }
      }
    `;
  }, [printPaperWmm, printPaperHmm, boardWidth, boardHeight]);

  const executeGridPrint = useCallback(async () => {
    if (isExportingPoster) return;
    setIsExportingPoster(true);
    try {
      injectDynamicPrintPageStyle();
      const photoUrls = collectBoardPhotoUrls();
      if (photoUrls.length > 0) {
        showNotification(`Menyiapkan cetak ${paperDim.label} & Auto-Upscale ${photoUrls.length} foto...`);
        const upscaledMap = await upscalePhotoMap(photoUrls, {
          scaleFactor: 2.5,
          minDimension: 840,
          maxDimension: 1280,
          outputMime: 'image/jpeg',
          quality: 0.94,
        });
        setExportPhotoMap(upscaledMap);
        await new Promise((r) => window.setTimeout(r, 140));
      }
      const cleanupAfterPrint = () => {
        setExportPhotoMap(null);
        window.removeEventListener('afterprint', cleanupAfterPrint);
      };
      window.addEventListener('afterprint', cleanupAfterPrint);
      window.print();
      window.setTimeout(cleanupAfterPrint, 4500);
      if (isNativeCapacitorApk()) {
        showNotification(
          `Jika dialog cetak Android tidak muncul di APK, gunakan tombol "PNG HD" atau "PDF" di sebelahnya!`
        );
      }
    } finally {
      setIsExportingPoster(false);
    }
  }, [
    isExportingPoster,
    injectDynamicPrintPageStyle,
    collectBoardPhotoUrls,
    paperDim.label,
    showNotification,
  ]);

  const executeGridPosterExport = useCallback(
    async (format: 'draft' | 'png' | 'pdf') => {
      if (isExportingPoster || !boardRef.current) return;
      setIsExportingPoster(true);
      try {
        const isDraft = format === 'draft';
        const photoUrls = isDraft ? [] : collectBoardPhotoUrls();
        showNotification(
          isDraft
            ? `Merender Draft Ringan ${paperDim.label} (cepat & hemat kuota, tanpa upscale)...`
            : photoUrls.length > 0
            ? `Auto-Upscale ${photoUrls.length} foto & merender poster ${paperDim.label} penuh warna...`
            : `Merender poster ${paperDim.label} penuh warna...`
        );

        const upscaledMap =
          !isDraft && photoUrls.length > 0
            ? await upscalePhotoMap(photoUrls, {
                scaleFactor: 2.5,
                minDimension: 880,
                maxDimension: 1360,
                outputMime: 'image/jpeg',
                quality: 0.94,
              })
            : {};

        if (!isDraft && photoUrls.length > 0) {
          setExportPhotoMap(upscaledMap);
          await new Promise((r) => window.setTimeout(r, 160));
        }

        const pixelRatioByPaper: Record<GridPaperSize, number> = {
          a4: 2.5,
          a3: 2.0,
          a2: 1.5,
          a1: 1.25,
          a0: 1.0,
        };
        const pixelRatio = isDraft ? 1.0 : pixelRatioByPaper[paperSize] || 1.8;
        const captureOptions = {
          width: boardWidth,
          height: boardHeight,
          pixelRatio,
          skipFonts: true,
          cacheBust: false,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left',
            margin: '0',
            borderRadius: '0',
            boxShadow: 'none',
            border: 'none',
          },
          filter: (domNode: HTMLElement) => {
            if (domNode && domNode.classList && domNode.classList.contains('print:hidden')) {
              return false;
            }
            return true;
          },
        };

        const safeTrah = (designNameInput || activeTrah.name || 'Silsilah_Trah')
          .replace(/[^a-zA-Z0-9\s_-]/g, '')
          .trim()
          .replace(/\s+/g, '_');

        const { toPng, toJpeg } = await import('html-to-image');

        if (format === 'draft') {
          const dataUrl = await toJpeg(boardRef.current, {
            ...captureOptions,
            quality: 0.84,
          });
          const filename = `${safeTrah || 'Poster_Silsilah'}_${paperDim.label}_Draft.jpg`;
          const blob = dataUrlToBlob(dataUrl);
          const method = await saveOrShareFileBlob(
            blob,
            filename,
            `Draft Silsilah ${activeTrah.name} (${paperDim.label})`
          );
          if (isNativeCapacitorApk() || method === 'downloaded') {
            setPosterPreviewModal({
              dataUrl,
              filename,
              width: Math.round(boardWidth * pixelRatio),
              height: Math.round(boardHeight * pixelRatio),
              upscaledCount: 0,
            });
          }
          showNotification(
            `Draft cepat ${paperDim.label} selesai (ukuran file ringan, siap koreksi keluarga)!`
          );
        } else if (format === 'png') {
          const dataUrl = await toPng(boardRef.current, captureOptions);
          const filename = `${safeTrah || 'Poster_Silsilah'}_${paperDim.label}_HD.png`;
          const blob = dataUrlToBlob(dataUrl);
          const method = await saveOrShareFileBlob(
            blob,
            filename,
            `Poster Silsilah ${activeTrah.name} (${paperDim.label})`
          );
          if (isNativeCapacitorApk() || method === 'downloaded') {
            setPosterPreviewModal({
              dataUrl,
              filename,
              width: Math.round(boardWidth * pixelRatio),
              height: Math.round(boardHeight * pixelRatio),
              upscaledCount: photoUrls.length,
            });
          }
          showNotification(
            `Poster ${paperDim.label} HD penuh warna selesai (${photoUrls.length} foto auto-upscale)!`
          );
        } else {
          const [{ jsPDF }, imgData] = await Promise.all([
            import('jspdf'),
            toJpeg(boardRef.current, { ...captureOptions, quality: 0.95 }),
          ]);
          const pdf = new jsPDF({
            orientation: paperOrientation,
            unit: 'mm',
            format: [printPaperWmm, printPaperHmm],
            compress: true,
          });
          pdf.addImage(imgData, 'JPEG', 0, 0, printPaperWmm, printPaperHmm);
          const pdfBlob = pdf.output('blob');
          const filename = `${safeTrah || 'Poster_Silsilah'}_${paperDim.label}.pdf`;
          await saveOrShareFileBlob(
            pdfBlob,
            filename,
            `Poster PDF ${activeTrah.name} (${paperDim.label})`
          );
          showNotification(
            `PDF ${paperDim.label} penuh warna berhasil dibuat (${photoUrls.length} foto auto-upscale)!`
          );
        }
      } catch (err) {
        console.error('Gagal ekspor poster Grid:', err);
        showNotification('Gagal mengekspor poster. Silakan coba tombol Cetak atau ukuran kertas lebih kecil.');
      } finally {
        setExportPhotoMap(null);
        setIsExportingPoster(false);
      }
    },
    [
      isExportingPoster,
      collectBoardPhotoUrls,
      paperDim.label,
      paperSize,
      boardWidth,
      boardHeight,
      designNameInput,
      activeTrah.name,
      paperOrientation,
      printPaperWmm,
      printPaperHmm,
      showNotification,
    ]
  );

  const handleTriggerGridExportAction = useCallback(
    (action: 'print' | 'png' | 'pdf' | 'draft') => {
      if (action === 'draft') {
        void executeGridPosterExport('draft');
        return;
      }
      const rule = MonetizationService.getRule('leluhurqu_export');
      if (rule.enabled && !MonetizationService.hasActiveUnlock('leluhurqu_export')) {
        setPendingExportAction(action);
        setShowPrintFeeModal(true);
        return;
      }
      if (action === 'print') {
        void executeGridPrint();
      } else {
        void executeGridPosterExport(action);
      }
    },
    [executeGridPrint, executeGridPosterExport]
  );

  useEffect(() => {
    const onSidebarPrint = () => {
      handleTriggerGridExportAction('print');
    };
    window.addEventListener('leluhurqu:trigger-grid-print', onSidebarPrint);
    return () => {
      window.removeEventListener('leluhurqu:trigger-grid-print', onSidebarPrint);
    };
  }, [handleTriggerGridExportAction]);

  const designsStorageKey = `${DESIGNS_STORAGE_PREFIX}${activeTrah.id}`;
  const activeDesignIdKey = `${ACTIVE_DESIGN_ID_PREFIX}${activeTrah.id}`;

  const getMemberSig = (members: FamilyMember[]) =>
    members
      .map(
        (m) =>
          `${m.id}:${m.name}:${m.gender}:${m.orderIndex || 0}:${m.callName || ''}:${m.birthYear || ''}:${m.deathYear || ''}:${m.isDeceased ? 1 : 0}:${m.photoUrl || ''}:${m.parentId || ''}:${m.generationLevel}:${m.notes || ''}:${(m.spouses || []).map((s) => `${s.name}:${s.status}:${s.photoUrl || ''}`).join('|')}`
      )
      .join(';');

  const getStructureSig = (members: FamilyMember[]) =>
    [...members]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((m) => `${m.id}:${m.parentId || ''}:${m.orderIndex || 0}:${(m.spouses || []).length}`)
      .join(';');

  const windowedData = useMemo(
    () => buildWindowedMembers(activeTrah.members, focalRootMemberId, maxVisibleDepth),
    [activeTrah.members, focalRootMemberId, maxVisibleDepth]
  );
  const windowedMembers = windowedData.members;

  // Helper menyusun ulang preset aktif sambil mempertahankan foto/warna kustom saat urutan adik-kakak berubah
  const rebuildSmartLayoutPreservingVisuals = useCallback(
    (
      members: FamilyMember[],
      presetId: SmartPresetId,
      prevNodes: InteractiveNode[],
      pW: number,
      pH: number,
      cMode: CardDisplayMode,
      phSize: PhotoFrameSize,
      cScale: number,
      gapMm = cardGapMm,
      modPos = modularG12Position,
      overrideBp?: NasabAiBlueprint | null
    ) => {
      const sampleDim = getNodeSize(
        {
          id: 'tmp',
          name: 'Nama Anggota',
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: false,
          modularSubLayout:
            presetId === 'modular_g3_L'
              ? 'L'
              : presetId === 'modular_g3_I'
              ? 'I'
              : undefined,
        },
        cMode,
        phSize,
        cScale
      );
      const effectiveBp = overrideBp !== undefined ? overrideBp : aiBlueprint;
      const rebuilt = generateSmartLayoutFromTable(
        members,
        presetId,
        pW,
        pH,
        sampleDim,
        {
          displayMode: cMode,
          photoSize: phSize,
          cardScale: cScale,
          cardGapMm: gapMm,
          modularG12Position: modPos,
          aiBlueprint: effectiveBp,
        }
      );
      const oldStyleByMemberId = new Map<
        string,
        { photo?: string; customBgColor?: string; customBorderColor?: string }
      >();
      prevNodes.forEach((n) => {
        if (n.memberId) {
          oldStyleByMemberId.set(n.memberId, {
            photo: n.photo,
            customBgColor: n.customBgColor,
            customBorderColor: n.customBorderColor,
          });
        }
        if (n.mergedMembers) {
          n.mergedMembers.forEach((mm) => {
            if (mm.memberId) {
              oldStyleByMemberId.set(mm.memberId, {
                photo: mm.photo,
                customBgColor: mm.customBgColor,
                customBorderColor: mm.customBorderColor,
              });
            }
          });
        }
      });

      const hydratedNodes = rebuilt.nodes.map((n) => {
        if (n.mergedMembers) {
          return {
            ...n,
            mergedMembers: n.mergedMembers.map((mm) => {
              const saved = mm.memberId ? oldStyleByMemberId.get(mm.memberId) : undefined;
              return saved
                ? {
                    ...mm,
                    photo: mm.photo || saved.photo || '',
                    customBgColor: saved.customBgColor ?? mm.customBgColor,
                    customBorderColor: saved.customBorderColor ?? mm.customBorderColor,
                  }
                : mm;
            }),
          };
        }
        const saved = n.memberId ? oldStyleByMemberId.get(n.memberId) : undefined;
        return saved
          ? {
              ...n,
              photo: n.photo || saved.photo || '',
              customBgColor: saved.customBgColor ?? n.customBgColor,
              customBorderColor: saved.customBorderColor ?? n.customBorderColor,
            }
          : n;
      });
      return { nodes: hydratedNodes, edges: rebuilt.edges };
    },
    [cardGapMm, modularG12Position, aiBlueprint]
  );

  // Muat daftar desain tersimpan saat berganti Trah
  useEffect(() => {
    let loadedDesigns: SavedGridDesign[] = [];
    let storedActiveId = '';
    try {
      const raw = localStorage.getItem(designsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) loadedDesigns = parsed;
      }
      storedActiveId = localStorage.getItem(activeDesignIdKey) || '';
    } catch (e) {
      console.warn('Gagal muat daftar desain:', e);
    }

    const currentStructSig = getStructureSig(activeTrah.members);

    if (loadedDesigns.length > 0) {
      let target =
        loadedDesigns.find((d) => d.id === storedActiveId) || loadedDesigns[0];
      let nextDesigns = loadedDesigns;
      const inferredPreset: SmartPresetId =
        target.activePresetId ||
        (activeTrah.members.length > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical');

      const targetFocal = target.focalRootMemberId || 'all';
      const targetDepth = target.maxVisibleDepth ?? 0;
      const targetMembers = buildWindowedMembers(
        activeTrah.members,
        targetFocal,
        targetDepth
      ).members;

      // Sinkronkan desain tersimpan dengan data anggota terbaru (termasuk perubahan gender & posisi adik-kakak dari Excel / Isi Cepat!)
      if (targetMembers.length > 0) {
        const pKey = target.paperSize || 'a3';
        const pDim = GRID_PAPER_MAP[pKey];
        const pW = (target.paperOrientation || 'landscape') === 'landscape' ? pDim.pxW : pDim.pxH;
        const pH = (target.paperOrientation || 'landscape') === 'landscape' ? pDim.pxH : pDim.pxW;
        const cMode = normalizeCardDisplayMode(target.cardDisplayMode);
        const phSize = target.photoFrameSize || '3x4';
        const curScale = target.cardScale ?? 1;

        const structChanged = Boolean(
          target.structureSig && target.structureSig !== currentStructSig
        );
        const hasManualOnlyMerge =
          target.nodes.some((n) => n.mergedMembers && n.mergedMembers.length >= 2) &&
          inferredPreset !== 'kotak_9_baris_g45_gabung' &&
          inferredPreset !== 'orbit_elips_gabung' &&
          inferredPreset !== 'modular_g3_I' &&
          inferredPreset !== 'modular_g3_L';

        if (structChanged && !hasManualOnlyMerge) {
          const existingMemberIds = new Set<string>();
          target.nodes.forEach((n) => {
            if (n.memberId) existingMemberIds.add(n.memberId);
          });
          const nextMemberIds = new Set(targetMembers.map((m) => m.id));
          const deltaAdded = targetMembers.filter((m) => !existingMemberIds.has(m.id)).length;
          let deltaRemoved = 0;
          existingMemberIds.forEach((id) => {
            if (!nextMemberIds.has(id)) deltaRemoved++;
          });
          const useIncremental =
            target.nodes.length > 0 &&
            !target.nodes.some((n) => n.mergedMembers && n.mergedMembers.length >= 2) &&
            deltaAdded + deltaRemoved > 0 &&
            deltaAdded + deltaRemoved <= 6;

          if (useIncremental) {
            const grown = applyIncrementalBranchUpdate({
              existingNodes: target.nodes,
              existingEdges: target.edges,
              members: targetMembers,
              presetId: inferredPreset,
              boardWidth: pW,
              boardHeight: pH,
              displayMode: cMode,
              photoSize: phSize,
              cardScale: curScale,
              aiBlueprint: target.aiBlueprint ?? null,
            });
            target = {
              ...target,
              nodes: grown.nodes,
              edges: grown.edges,
              quickText: buildQuickTextFromTrah(targetMembers),
              activePresetId: inferredPreset,
              structureSig: currentStructSig,
              updatedAt: Date.now(),
            };
          } else {
            const optScale = computeOptimalCardScale(
              targetMembers,
              pW,
              pH,
              cMode,
              phSize,
              inferredPreset
            );
            const rebuilt = rebuildSmartLayoutPreservingVisuals(
              targetMembers,
              inferredPreset,
              target.nodes,
              pW,
              pH,
              cMode,
              phSize,
              target.cardScale ?? optScale,
              target.cardGapMm ?? 3.5,
              target.modularG12Position ?? 'center',
              target.aiBlueprint ?? null
            );
            target = {
              ...target,
              nodes: rebuilt.nodes,
              edges: rebuilt.edges,
              quickText: buildQuickTextFromTrah(targetMembers),
              activePresetId: inferredPreset,
              structureSig: currentStructSig,
              updatedAt: Date.now(),
            };
          }
          nextDesigns = loadedDesigns.map((d) => (d.id === target.id ? target : d));
          try {
            localStorage.setItem(designsStorageKey, JSON.stringify(nextDesigns));
          } catch (err) {
            console.warn(err);
          }
        } else {
          const reconciled = reconcileCanvasWithMembers(
            target.nodes,
            target.edges,
            targetMembers,
            pW,
            pH,
            cMode,
            phSize,
            curScale,
            false
          );

          if (reconciled.changed || !target.structureSig || structChanged) {
            target = {
              ...target,
              nodes: reconciled.nodes,
              edges: reconciled.edges,
              quickText: buildQuickTextFromTrah(targetMembers),
              cardScale: reconciled.nextScale,
              activePresetId: target.activePresetId || inferredPreset,
              structureSig: currentStructSig,
              updatedAt: Date.now(),
            };
            nextDesigns = loadedDesigns.map((d) => (d.id === target.id ? target : d));
            try {
              localStorage.setItem(designsStorageKey, JSON.stringify(nextDesigns));
            } catch (err) {
              console.warn(err);
            }
          }
        }
      }

      setSavedDesigns(nextDesigns);
      setActiveDesignId(target.id);
      setActivePresetId(target.activePresetId || inferredPreset);
      setAiBlueprint(target.aiBlueprint ?? null);
      setDesignNameInput(target.name);
      setNodes(target.nodes);
      setEdges(target.edges);
      setQuickText(target.quickText);
      setPaperSize(target.paperSize || 'a3');
      setPaperOrientation(target.paperOrientation || 'landscape');
      setCardDisplayMode(normalizeCardDisplayMode(target.cardDisplayMode));
      setPhotoFrameSize(target.photoFrameSize || '3x4');
      setPhotoShape(target.photoShape || defaultPhotoShape);
      setCardScale(target.cardScale ?? 1);
      setCardGapMm(target.cardGapMm ?? 3.5);
      setModularG12Position(target.modularG12Position ?? 'center');
      setFocalRootMemberId(target.focalRootMemberId || 'all');
      setMaxVisibleDepth(target.maxVisibleDepth ?? 0);
      setShowGenGuides(target.showGenGuides ?? true);
      setGuideOverlayMode(target.guideOverlayMode || 'gen_bands');
      setLinesOnTop(target.linesOnTop ?? false);
      setShowLineDots(target.showLineDots ?? true);
      setShowEndpointDots(target.showEndpointDots ?? true);
      setGenGradientPalette(target.genGradientPalette || 'none');
      setTheme(target.theme || 'dark');
      setBgStyle(target.bgStyle || '');
      setLineStyle(target.lineStyle || 'pcb90');
      setLineRoutingTopology(target.lineRoutingTopology || 'sibling_chain_all');
      setLineThicknessMode(target.lineThicknessMode || 'uniform');
      setCardFrameMode(target.cardFrameMode || 'auto');
      setShowLineArrows(target.showLineArrows ?? true);
      setLineThickness(target.lineThickness || 2.5);
      setChildLineColor(target.childLineColor ?? '');
      setCoupleLineColor(target.coupleLineColor ?? '#f59e0b');
      setSiblingLineColor(target.siblingLineColor ?? '');
      setCardBgColor(target.cardBgColor ?? '');
      setCardBorderColor(target.cardBorderColor ?? '');
      setCaptionInfo(
        target.captionInfo || getDefaultCaptionInfo(activeTrah.name)
      );
      setSelectedIds([]);
      setMoveUnlockedIds([]);
      setMoveAnchorId(null);
      undoStackRef.current = [];
      setUndoCount(0);
      loadedTrahIdRef.current = activeTrah.id;
      lastMemberSigRef.current = getMemberSig(activeTrah.members);
      lastStructureSigRef.current = currentStructSig;
      return;
    }

    // Buat desain awal otomatis di kertas A3 memakai skala kartu/foto optimal
    const defaultPresetId: SmartPresetId =
      activeTrah.members.length > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical';
    const defaultPaperDim = GRID_PAPER_MAP.a3;
    const initScale = computeOptimalCardScale(
      activeTrah.members,
      defaultPaperDim.pxW,
      defaultPaperDim.pxH,
      'full',
      '3x4'
    );
    const defaultCardDim = getNodeSize(
      { id: 'tmp', name: 'Anggota Keluarga', sub: '', x: 0, y: 0, photo: '', wafat: false },
      'full',
      '3x4',
      initScale
    );
    const built = generateSmartLayoutFromTable(
      activeTrah.members,
      defaultPresetId,
      defaultPaperDim.pxW,
      defaultPaperDim.pxH,
      defaultCardDim
    );
    const text = buildQuickTextFromTrah(activeTrah.members);
    const defaultCap = getDefaultCaptionInfo(
      activeTrah.name,
      defaultCuratorName,
      defaultCreatedYear
    );
    const initialDesign: SavedGridDesign = {
      id: `design_${activeTrah.id}_1`,
      name: `Desain Utama (${activeTrah.name})`,
      updatedAt: Date.now(),
      nodes: built.nodes,
      edges: built.edges,
      quickText: text,
      paperSize: 'a3',
      paperOrientation: 'landscape',
      cardDisplayMode: 'full',
      photoFrameSize: '3x4',
      photoShape: defaultPhotoShape,
      cardScale: initScale,
      cardGapMm: 3.5,
      modularG12Position: 'center',
      focalRootMemberId: 'all',
      maxVisibleDepth: 0,
      showGenGuides: true,
      guideOverlayMode: 'gen_bands',
      showLineDots: true,
      showEndpointDots: true,
      genGradientPalette: 'none',
      theme: 'dark',
      bgStyle: '',
      lineStyle: 'pcb90',
      lineRoutingTopology: 'sibling_chain_all',
      lineThicknessMode: 'uniform',
      cardFrameMode: 'auto',
      showLineArrows: true,
      lineThickness: 2.5,
      childLineColor: '',
      coupleLineColor: '#f59e0b',
      siblingLineColor: '',
      cardBgColor: '',
      cardBorderColor: '',
      captionInfo: defaultCap,
      activePresetId: defaultPresetId,
      structureSig: currentStructSig,
    };
    setPhotoShape(defaultPhotoShape);
    setCardScale(initScale);
    setCardGapMm(3.5);
    setModularG12Position('center');
    setFocalRootMemberId('all');
    setMaxVisibleDepth(0);
    setShowLineDots(true);
    setShowEndpointDots(true);
    setGenGradientPalette('none');
    setShowGenGuides(true);
    setGuideOverlayMode('gen_bands');
    setSavedDesigns([initialDesign]);
    setActiveDesignId(initialDesign.id);
    setActivePresetId(defaultPresetId);
    setAiBlueprint(null);
    setDesignNameInput(initialDesign.name);
    setNodes(initialDesign.nodes);
    setEdges(initialDesign.edges);
    setQuickText(initialDesign.quickText);
    setLineStyle('pcb90');
    setLineRoutingTopology('sibling_chain_all');
    setLineThicknessMode('uniform');
    setShowLineArrows(true);
    setLineThickness(2.5);
    setChildLineColor('');
    setCoupleLineColor('#f59e0b');
    setSiblingLineColor('');
    setCardBgColor('');
    setCardBorderColor('');
    setCaptionInfo(defaultCap);
    setSelectedIds([]);
    undoStackRef.current = [];
    setUndoCount(0);
    loadedTrahIdRef.current = activeTrah.id;
    lastMemberSigRef.current = getMemberSig(activeTrah.members);
    lastStructureSigRef.current = currentStructSig;
    try {
      localStorage.setItem(designsStorageKey, JSON.stringify([initialDesign]));
      localStorage.setItem(activeDesignIdKey, initialDesign.id);
    } catch (e) {
      console.warn(e);
    }
  }, [activeTrah.id, activeTrah.name, designsStorageKey, activeDesignIdKey]);

  // Reload kanvas otomatis jika ada perubahan desain dari HP/Laptop tertaut
  useEffect(() => {
    const onRemoteGridSync = (ev: Event) => {
      const detail = (ev as CustomEvent<PairingSyncEventDetail>).detail;
      if (!detail?.remoteApplied) return;
      if (
        detail.changedKeys &&
        detail.changedKeys.length > 0 &&
        !detail.changedKeys.some(
          (k) => k === designsStorageKey || k === activeDesignIdKey
        )
      ) {
        return;
      }
      try {
        const raw = localStorage.getItem(designsStorageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return;
        const storedId = localStorage.getItem(activeDesignIdKey) || '';
        const target =
          (parsed as SavedGridDesign[]).find((d) => d.id === storedId) ||
          (parsed as SavedGridDesign[])[0];
        if (!target) return;
        setSavedDesigns(parsed as SavedGridDesign[]);
        setActiveDesignId(target.id);
        setAiBlueprint(target.aiBlueprint ?? null);
        setDesignNameInput(target.name);
        setNodes(target.nodes || []);
        setEdges(target.edges || []);
        if (target.quickText) setQuickText(target.quickText);
        if (target.paperSize) setPaperSize(target.paperSize);
        if (target.paperOrientation) setPaperOrientation(target.paperOrientation);
        if (target.cardDisplayMode) {
          setCardDisplayMode(normalizeCardDisplayMode(target.cardDisplayMode));
        }
        if (target.photoFrameSize) setPhotoFrameSize(target.photoFrameSize);
        if (target.photoShape) setPhotoShape(target.photoShape);
        if (typeof target.cardScale === 'number') setCardScale(target.cardScale);
        if (typeof target.cardGapMm === 'number') setCardGapMm(target.cardGapMm);
        if (target.modularG12Position) setModularG12Position(target.modularG12Position);
        if (target.focalRootMemberId) setFocalRootMemberId(target.focalRootMemberId);
        if (typeof target.maxVisibleDepth === 'number')
          setMaxVisibleDepth(target.maxVisibleDepth);
        if (target.genGradientPalette) setGenGradientPalette(target.genGradientPalette);
      } catch {
        // ignore parse errors
      }
    };
    window.addEventListener(DEVICE_PAIRING_SYNC_EVENT, onRemoteGridSync);
    return () => window.removeEventListener(DEVICE_PAIRING_SYNC_EVENT, onRemoteGridSync);
  }, [designsStorageKey, activeDesignIdKey]);

  // Persist perubahan pada desain aktif secara otomatis
  const persistCurrentDesign = useCallback(
    (
      overrideNodes?: InteractiveNode[],
      overrideEdges?: InteractiveEdge[],
      overrideQuickText?: string,
      overrideCardScale?: number,
      overridePresetId?: SmartPresetId,
      overrideAiBlueprint?: NasabAiBlueprint | null
    ) => {
      if (!activeDesignId) return;
      const curStructSig = getStructureSig(activeTrah.members);
      const nextBp = overrideAiBlueprint !== undefined ? overrideAiBlueprint : aiBlueprint;
      setSavedDesigns((prev) => {
        const nextList = prev.map((d) =>
          d.id === activeDesignId
            ? {
                ...d,
                updatedAt: Date.now(),
                nodes: overrideNodes ?? nodes,
                edges: overrideEdges ?? edges,
                quickText: overrideQuickText ?? quickText,
                paperSize,
                paperOrientation,
                cardDisplayMode,
                photoFrameSize,
                photoShape,
                cardScale: overrideCardScale ?? cardScale,
                cardGapMm,
                modularG12Position,
                focalRootMemberId,
                maxVisibleDepth,
                showGenGuides,
                guideOverlayMode,
                linesOnTop,
                showLineDots,
                showEndpointDots,
                genGradientPalette,
                theme,
                bgStyle,
                lineStyle,
                lineRoutingTopology,
                lineThicknessMode,
                cardFrameMode,
                showLineArrows,
                lineThickness,
                childLineColor,
                coupleLineColor,
                siblingLineColor,
                cardBgColor,
                cardBorderColor,
                captionInfo,
                activePresetId: overridePresetId ?? activePresetId ?? d.activePresetId,
                aiBlueprint: nextBp,
                structureSig: curStructSig,
              }
            : d
        );
        try {
          localStorage.setItem(designsStorageKey, JSON.stringify(nextList));
        } catch (e) {
          console.warn('Gagal menyimpan otomatis:', e);
        }
        return nextList;
      });
    },
    [
      activeDesignId,
      activePresetId,
      aiBlueprint,
      activeTrah.members,
      nodes,
      edges,
      quickText,
      paperSize,
      paperOrientation,
      cardDisplayMode,
      photoFrameSize,
      photoShape,
      cardScale,
      cardGapMm,
      modularG12Position,
      focalRootMemberId,
      maxVisibleDepth,
      showGenGuides,
      guideOverlayMode,
      linesOnTop,
      showLineDots,
      showEndpointDots,
      genGradientPalette,
      theme,
      bgStyle,
      lineStyle,
      lineRoutingTopology,
      lineThicknessMode,
      cardFrameMode,
      showLineArrows,
      lineThickness,
      childLineColor,
      coupleLineColor,
      siblingLineColor,
      cardBgColor,
      cardBorderColor,
      captionInfo,
      designsStorageKey,
    ]
  );

  // =========================================================================
  // UNDO MULTI-LANGKAH (SIMPAN & KEMBALIKAN SNAPSHOT KANVAS)
  // =========================================================================
  const cloneNodesForHistory = useCallback((list: InteractiveNode[]): InteractiveNode[] => {
    return list.map((n) => ({
      ...n,
      mergedMembers: n.mergedMembers
        ? n.mergedMembers.map((m) => ({ ...m }))
        : undefined,
      mergedEdgesSnapshot: n.mergedEdgesSnapshot
        ? n.mergedEdgesSnapshot.map((e) => ({ ...e }))
        : undefined,
    }));
  }, []);

  const latestUndoStateRef = useRef({
    nodes,
    edges,
    quickText,
    guideOverlayMode,
    cardScale,
  });
  latestUndoStateRef.current = {
    nodes,
    edges,
    quickText,
    guideOverlayMode,
    cardScale,
  };

  const pushUndoSnapshot = useCallback(
    (
      label = 'Perubahan',
      overrideNodes?: InteractiveNode[],
      overrideEdges?: InteractiveEdge[]
    ) => {
      const cur = latestUndoStateRef.current;
      const snap = {
        nodes: cloneNodesForHistory(overrideNodes ?? cur.nodes),
        edges: (overrideEdges ?? cur.edges).map((e) => ({ ...e })),
        quickText: cur.quickText,
        guideOverlayMode: cur.guideOverlayMode,
        cardScale: cur.cardScale,
        label,
      };
      const nextStack = [...undoStackRef.current, snap].slice(-MAX_UNDO_STEPS);
      undoStackRef.current = nextStack;
      setUndoCount(nextStack.length);
    },
    [cloneNodesForHistory]
  );

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) {
      showNotification('Belum ada perubahan untuk di-Undo.');
      return;
    }
    const prev = stack[stack.length - 1];
    const nextStack = stack.slice(0, -1);
    undoStackRef.current = nextStack;
    setUndoCount(nextStack.length);

    setNodes(prev.nodes);
    setEdges(prev.edges);
    setQuickText(prev.quickText);
    setGuideOverlayMode(prev.guideOverlayMode);
    setCardScale(prev.cardScale);
    setSelectedIds((cur) =>
      cur.filter((id) => prev.nodes.some((n) => n.id === id))
    );
    setMoveUnlockedIds([]);
    setMoveAnchorId(null);
    persistCurrentDesign(prev.nodes, prev.edges, prev.quickText, prev.cardScale);
    showNotification(`Undo: ${prev.label}`);
  }, [persistCurrentDesign, showNotification]);

  // Sinkronisasi preferensi kertas/card/garis/warna/keterangan ke desain aktif
  useEffect(() => {
    if (!activeDesignId) return;
    persistCurrentDesign();
  }, [
    paperSize,
    paperOrientation,
    cardDisplayMode,
    photoFrameSize,
    photoShape,
    cardScale,
    cardGapMm,
    modularG12Position,
    focalRootMemberId,
    maxVisibleDepth,
    showGenGuides,
    guideOverlayMode,
    linesOnTop,
    showLineDots,
    showEndpointDots,
    genGradientPalette,
    theme,
    bgStyle,
    lineStyle,
    lineRoutingTopology,
    lineThicknessMode,
    cardFrameMode,
    showLineArrows,
    lineThickness,
    childLineColor,
    coupleLineColor,
    siblingLineColor,
    cardBgColor,
    cardBorderColor,
    captionInfo,
  ]);

  // Sinkronisasi otomatis perubahan anggota (gender, nama, urutan adik-kakak) dari Tabel Excel / Isi Cepat / Edit ke Kanvas Grid aktif
  useEffect(() => {
    if (!activeDesignId || loadedTrahIdRef.current !== activeTrah.id) return;
    const nextSig = getMemberSig(activeTrah.members);
    if (nextSig === lastMemberSigRef.current) return;
    lastMemberSigRef.current = nextSig;

    const nextStructSig = getStructureSig(activeTrah.members);
    const structChanged = Boolean(
      lastStructureSigRef.current && nextStructSig !== lastStructureSigRef.current
    );
    lastStructureSigRef.current = nextStructSig;

    const refreshedQuickText = buildQuickTextFromTrah(windowedMembers);
    const presetToUse: SmartPresetId =
      activePresetId ||
      (windowedMembers.length > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical');
    const hasManualOnlyMerge =
      nodes.some((n) => n.mergedMembers && n.mergedMembers.length >= 2) &&
      presetToUse !== 'kotak_9_baris_g45_gabung' &&
      presetToUse !== 'orbit_elips_gabung' &&
      presetToUse !== 'modular_g3_I' &&
      presetToUse !== 'modular_g3_L';

    if (structChanged && !hasManualOnlyMerge && windowedMembers.length > 0) {
      const existingMemberIds = new Set<string>();
      nodes.forEach((n) => {
        if (n.memberId) existingMemberIds.add(n.memberId);
        n.mergedMembers?.forEach((mm) => {
          if (mm.memberId) existingMemberIds.add(mm.memberId);
        });
      });
      const nextMemberIds = new Set(windowedMembers.map((m) => m.id));
      const deltaAdded = windowedMembers.filter((m) => !existingMemberIds.has(m.id)).length;
      let deltaRemoved = 0;
      existingMemberIds.forEach((id) => {
        if (!nextMemberIds.has(id)) deltaRemoved++;
      });

      const canGrowIncrementally =
        nodes.length > 0 &&
        !nodes.some((n) => n.mergedMembers && n.mergedMembers.length >= 2) &&
        deltaAdded + deltaRemoved > 0 &&
        deltaAdded + deltaRemoved <= 6;

      if (canGrowIncrementally) {
        const grown = applyIncrementalBranchUpdate({
          existingNodes: nodes,
          existingEdges: edges,
          members: windowedMembers,
          presetId: presetToUse,
          boardWidth,
          boardHeight,
          displayMode: cardDisplayMode,
          photoSize: photoFrameSize,
          cardScale,
          aiBlueprint,
        });
        setNodes(grown.nodes);
        setEdges(grown.edges);
        setQuickText(refreshedQuickText);
        persistCurrentDesign(
          grown.nodes,
          grown.edges,
          refreshedQuickText,
          cardScale,
          presetToUse
        );
        if (grown.addedCount > 0) {
          showNotification(
            `+${grown.addedCount} kartu cabang baru ditumbuhkan rapi tanpa mengacak posisi kartu lain (0 token AI)!`
          );
        }
        return;
      }

      const rebuilt = rebuildSmartLayoutPreservingVisuals(
        windowedMembers,
        presetToUse,
        nodes,
        boardWidth,
        boardHeight,
        cardDisplayMode,
        photoFrameSize,
        cardScale
      );
      setNodes(rebuilt.nodes);
      setEdges(rebuilt.edges);
      setQuickText(refreshedQuickText);
      persistCurrentDesign(
        rebuilt.nodes,
        rebuilt.edges,
        refreshedQuickText,
        cardScale,
        presetToUse
      );
      return;
    }

    const reconciled = reconcileCanvasWithMembers(
      nodes,
      edges,
      windowedMembers,
      boardWidth,
      boardHeight,
      cardDisplayMode,
      photoFrameSize,
      cardScale,
      layoutMode === 'auto'
    );

    if (reconciled.nextScale !== cardScale) {
      setCardScale(reconciled.nextScale);
    }
    setNodes(reconciled.nodes);
    setEdges(reconciled.edges);
    setQuickText(refreshedQuickText);
    persistCurrentDesign(
      reconciled.nodes,
      reconciled.edges,
      refreshedQuickText,
      reconciled.nextScale
    );
  }, [activeTrah.id, activeTrah.members, windowedMembers, activeDesignId, activePresetId]);

  const isCssLandscapeActive =
    isFocusMode &&
    studioScreenMode === 'landscape' &&
    !nativeLandscapeActive &&
    windowSize.h > windowSize.w;

  const getViewportMetrics = useCallback(() => {
    if (isCssLandscapeActive) {
      return { w: Math.max(240, windowSize.h), h: Math.max(200, windowSize.w) };
    }
    const vp = viewportRef.current;
    if (vp && vp.clientWidth > 60 && vp.clientHeight > 60) {
      return { w: vp.clientWidth, h: vp.clientHeight };
    }
    return { w: Math.max(240, windowSize.w), h: Math.max(200, windowSize.h) };
  }, [isCssLandscapeActive, windowSize.h, windowSize.w]);

  const getViewportLocalPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (isCssLandscapeActive) {
        return { x: clientY, y: windowSize.w - clientX };
      }
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: clientX, y: clientY };
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [isCssLandscapeActive, windowSize.w]
  );

  const getBoardPoint = useCallback(
    (clientX: number, clientY: number) => {
      const vpPt = getViewportLocalPoint(clientX, clientY);
      const vt = viewTransformRef.current;
      return {
        x: (vpPt.x - vt.panX) / vt.zoom,
        y: (vpPt.y - vt.panY) / vt.zoom,
      };
    },
    [getViewportLocalPoint]
  );

  const applyStageTransformNow = useCallback(() => {
    const vt = viewTransformRef.current;
    if (stageTransformRef.current) {
      stageTransformRef.current.style.transform = `translate3d(${vt.panX}px, ${vt.panY}px, 0) scale(${vt.zoom})`;
    }
    if (zoomLabelRef.current) {
      zoomLabelRef.current.textContent = `${Math.round(vt.zoom * 100)}%`;
    }
    if (miniNavViewportElRef.current) {
      const { w: vpW, h: vpH } = getViewportMetrics();
      const maxW = 122;
      const maxH = 84;
      const mapScale = Math.min(maxW / boardWidth, maxH / boardHeight);
      const visX = (-vt.panX / vt.zoom) * mapScale;
      const visY = (-vt.panY / vt.zoom) * mapScale;
      const visW = (vpW / vt.zoom) * mapScale;
      const visH = (vpH / vt.zoom) * mapScale;
      const mapW = Math.max(56, Math.round(boardWidth * mapScale));
      const mapH = Math.max(40, Math.round(boardHeight * mapScale));
      const clampedL = Math.max(0, Math.min(mapW - 8, visX));
      const clampedT = Math.max(0, Math.min(mapH - 8, visY));
      miniNavViewportElRef.current.style.left = `${clampedL}px`;
      miniNavViewportElRef.current.style.top = `${clampedT}px`;
      miniNavViewportElRef.current.style.width = `${Math.max(
        10,
        Math.min(mapW - clampedL, visW)
      )}px`;
      miniNavViewportElRef.current.style.height = `${Math.max(
        10,
        Math.min(mapH - clampedT, visH)
      )}px`;
    }
  }, [boardHeight, boardWidth, getViewportMetrics]);

  const scheduleStageRender = useCallback(() => {
    if (stageRafRef.current !== null) return;
    stageRafRef.current = window.requestAnimationFrame(() => {
      stageRafRef.current = null;
      applyStageTransformNow();
    });
  }, [applyStageTransformNow]);

  const commitStageTransform = useCallback(
    (
      nextPanX: number,
      nextPanY: number,
      nextZoom: number,
      syncReactImmediately = false
    ) => {
      const clampedZoom = Math.max(0.12, Math.min(2.6, nextZoom));
      viewTransformRef.current = {
        panX: nextPanX,
        panY: nextPanY,
        zoom: clampedZoom,
      };
      scheduleStageRender();

      if (zoomSyncTimerRef.current !== null) {
        window.clearTimeout(zoomSyncTimerRef.current);
        zoomSyncTimerRef.current = null;
      }
      if (syncReactImmediately) {
        setZoom(+clampedZoom.toFixed(3));
      } else {
        zoomSyncTimerRef.current = window.setTimeout(() => {
          zoomSyncTimerRef.current = null;
          setZoom(+viewTransformRef.current.zoom.toFixed(3));
        }, 140);
      }
    },
    [scheduleStageRender]
  );

  // Auto-Fit kanvas kertas A0-A4 ke tengah viewport GPU Stage
  const handleFitScreen = useCallback(
    (silent = false) => {
      const { w: vpW, h: vpH } = getViewportMetrics();
      const pad = isFocusMode ? 28 : 44;
      const availW = Math.max(160, vpW - pad);
      const availH = Math.max(160, vpH - pad);
      const fit = Math.max(
        0.12,
        Math.min(1.35, +Math.min(availW / boardWidth, availH / boardHeight).toFixed(3))
      );
      const panX = Math.round((vpW - boardWidth * fit) / 2);
      const panY = Math.round((vpH - boardHeight * fit) / 2);
      commitStageTransform(panX, panY, fit, true);
      if (!silent) {
        showNotification(
          `Kertas ${paperDim.label} (${paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}) pas layar (${Math.round(
            fit * 100
          )}%)`
        );
      }
    },
    [
      boardHeight,
      boardWidth,
      commitStageTransform,
      getViewportMetrics,
      isFocusMode,
      paperDim.label,
      paperOrientation,
      showNotification,
    ]
  );

  const handleZoomByStep = useCallback(
    (delta: number) => {
      const { w: vpW, h: vpH } = getViewportMetrics();
      const vt = viewTransformRef.current;
      const nextZoom = Math.max(0.12, Math.min(2.6, +(vt.zoom + delta).toFixed(3)));
      const midX = vpW / 2;
      const midY = vpH / 2;
      const worldX = (midX - vt.panX) / vt.zoom;
      const worldY = (midY - vt.panY) / vt.zoom;
      const nextPanX = midX - worldX * nextZoom;
      const nextPanY = midY - worldY * nextZoom;
      commitStageTransform(nextPanX, nextPanY, nextZoom, true);
    },
    [commitStageTransform, getViewportMetrics]
  );

  const handleJumpToBoardPoint = useCallback(
    (boardX: number, boardY: number, overrideZoom?: number) => {
      const { w: vpW, h: vpH } = getViewportMetrics();
      const targetZoom = overrideZoom ?? viewTransformRef.current.zoom;
      const nextPanX = vpW / 2 - boardX * targetZoom;
      const nextPanY = vpH / 2 - boardY * targetZoom;
      commitStageTransform(nextPanX, nextPanY, targetZoom, overrideZoom !== undefined);
    },
    [commitStageTransform, getViewportMetrics]
  );

  // Putar Layar HP (Potret <-> Lanskap ala Game) TANPA mengubah orientasi/isi kertas!
  const handleToggleStudioScreenMode = useCallback(async () => {
    const nextMode: StudioScreenMode =
      studioScreenMode === 'landscape' ? 'portrait' : 'landscape';

    // Simpan titik tengah kertas yang sedang dilihat agar setelah layar miring posisi tetap sama!
    const { w: vpW, h: vpH } = getViewportMetrics();
    const vt = viewTransformRef.current;
    pendingFocusCenterRef.current = {
      x: (vpW / 2 - vt.panX) / vt.zoom,
      y: (vpH / 2 - vt.panY) / vt.zoom,
      zoom: vt.zoom,
    };

    const result = await applyStudioScreenOrientation(
      nextMode,
      isFocusMode && nextMode === 'landscape'
    );
    setStudioScreenMode(nextMode);
    setNativeLandscapeActive(result.nativeLandscape);
    showNotification(
      nextMode === 'landscape'
        ? 'Mode Layar Miring (Lanskap Studio) aktif — posisi & ukuran kertas tetap utuh!'
        : 'Kembali ke Mode Layar Berdiri (Potret)'
    );
  }, [getViewportMetrics, isFocusMode, showNotification, studioScreenMode]);

  const handleExitFullscreenStudio = useCallback(async () => {
    const { w: vpW, h: vpH } = getViewportMetrics();
    const vt = viewTransformRef.current;
    pendingFocusCenterRef.current = {
      x: (vpW / 2 - vt.panX) / vt.zoom,
      y: (vpH / 2 - vt.panY) / vt.zoom,
      zoom: vt.zoom,
    };
    setIsFocusMode(false);
    setStudioScreenMode('portrait');
    setNativeLandscapeActive(false);
    setIsHudHidden(false);
    await applyStudioScreenOrientation('auto', false);
  }, [getViewportMetrics]);

  // Sinkronkan ukuran jendela layar saat rotate / resize
  useEffect(() => {
    const onResize = () => {
      setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Masuk ulang ke Mode Studio Full-Layar saat user mengetuk tab Grid lagi
  useEffect(() => {
    if (enterStudioTrigger > 0) {
      setIsFocusMode(true);
      setIsHudHidden(false);
    }
  }, [enterStudioTrigger]);

  // Pertahankan posisi fokus kertas saat orientasi layar HP berubah (Potret <-> Lanskap)
  useEffect(() => {
    const pending = pendingFocusCenterRef.current;
    if (!pending) return;
    const t = window.setTimeout(() => {
      const p = pendingFocusCenterRef.current;
      if (!p) return;
      pendingFocusCenterRef.current = null;
      const { w: vpW, h: vpH } = getViewportMetrics();
      const panX = Math.round(vpW / 2 - p.x * p.zoom);
      const panY = Math.round(vpH / 2 - p.y * p.zoom);
      commitStageTransform(panX, panY, p.zoom, true);
    }, 80);
    return () => window.clearTimeout(t);
  }, [
    windowSize.w,
    windowSize.h,
    studioScreenMode,
    nativeLandscapeActive,
    isFocusMode,
    getViewportMetrics,
    commitStageTransform,
  ]);

  // Auto-Fit saat pertama buka, ganti desain, atau ganti ukuran/orientasi kertas
  useEffect(() => {
    const t = window.setTimeout(() => {
      handleFitScreen(true);
    }, 70);
    return () => window.clearTimeout(t);
  }, [paperSize, paperOrientation, activeDesignId, boardWidth, boardHeight, handleFitScreen]);

  // Kembalikan orientasi layar normal saat keluar dari kanvas Grid
  useEffect(() => {
    return () => {
      if (stageRafRef.current !== null) {
        window.cancelAnimationFrame(stageRafRef.current);
      }
      if (zoomSyncTimerRef.current !== null) {
        window.clearTimeout(zoomSyncTimerRef.current);
      }
      void applyStudioScreenOrientation('auto', false);
    };
  }, []);

  // Re-apply stage transform saat Mini-Navigator dibuka agar kotak viewport langsung muncul
  useEffect(() => {
    if (isMiniNavOpen) {
      applyStageTransformNow();
    }
  }, [isMiniNavOpen, applyStageTransformNow]);

  // Shortcut Keyboard: Ctrl+Z / Cmd+Z (Undo) & ESC keluar dari Mode Leluasa
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const activeEl = document.activeElement as HTMLElement | null;
        const tag = activeEl?.tagName?.toLowerCase();
        if (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          activeEl?.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFocusMode, handleUndo]);

  // =========================================================================
  // SIMPAN DESAIN, EDIT KEMBALI, & BUAT DESAIN BARU
  // =========================================================================
  const handleSaveNamedDesign = () => {
    const cleanName =
      designNameInput.trim() || `Desain ${savedDesigns.length + 1}`;
    const existing = savedDesigns.find((d) => d.id === activeDesignId);
    let nextList: SavedGridDesign[];
    if (existing) {
      nextList = savedDesigns.map((d) =>
        d.id === activeDesignId
          ? {
              ...d,
              name: cleanName,
              updatedAt: Date.now(),
              nodes,
              edges,
              quickText,
              paperSize,
              paperOrientation,
              cardDisplayMode,
              photoFrameSize,
              photoShape,
              cardScale,
              cardGapMm,
              modularG12Position,
              focalRootMemberId,
              maxVisibleDepth,
              showGenGuides,
              guideOverlayMode,
              linesOnTop,
              showLineDots,
              showEndpointDots,
              genGradientPalette,
              theme,
              bgStyle,
              lineStyle,
              lineRoutingTopology,
              lineThicknessMode,
              cardFrameMode,
              showLineArrows,
              lineThickness,
              childLineColor,
              coupleLineColor,
              siblingLineColor,
              cardBgColor,
              cardBorderColor,
              captionInfo,
              activePresetId,
              aiBlueprint,
            }
          : d
      );
    } else {
      const created: SavedGridDesign = {
        id: `design_${Date.now()}`,
        name: cleanName,
        updatedAt: Date.now(),
        nodes,
        edges,
        quickText,
        paperSize,
        paperOrientation,
        cardDisplayMode,
        photoFrameSize,
        photoShape,
        cardScale,
        cardGapMm,
        modularG12Position,
        focalRootMemberId,
        maxVisibleDepth,
        showGenGuides,
        guideOverlayMode,
        linesOnTop,
        showLineDots,
        showEndpointDots,
        genGradientPalette,
        theme,
        bgStyle,
        lineStyle,
        lineRoutingTopology,
        lineThicknessMode,
        cardFrameMode,
        showLineArrows,
        lineThickness,
        childLineColor,
        coupleLineColor,
        siblingLineColor,
        cardBgColor,
        cardBorderColor,
        captionInfo,
        activePresetId,
        aiBlueprint,
      };
      nextList = [created, ...savedDesigns];
      setActiveDesignId(created.id);
      localStorage.setItem(activeDesignIdKey, created.id);
    }
    setSavedDesigns(nextList);
    try {
      localStorage.setItem(designsStorageKey, JSON.stringify(nextList));
    } catch (e) {
      console.warn(e);
    }
    showNotification(`Desain "${cleanName}" tersimpan dan siap diedit kembali!`);
  };

  const handleCreateNewDesign = (mode: 'from_trah' | 'blank') => {
    const newId = `design_${Date.now()}`;
    const newName =
      mode === 'blank'
        ? `Desain Baru Kosong #${savedDesigns.length + 1}`
        : `Desain Baru (${activeTrah.name}) #${savedDesigns.length + 1}`;

    const built =
      mode === 'blank'
        ? { nodes: [], edges: [] }
        : buildCanvasFromTrah(windowedMembers, boardWidth);
    const text = mode === 'blank' ? '' : buildQuickTextFromTrah(windowedMembers);

    const freshDesign: SavedGridDesign = {
      id: newId,
      name: newName,
      updatedAt: Date.now(),
      nodes: built.nodes,
      edges: built.edges,
      quickText: text,
      paperSize,
      paperOrientation,
      cardDisplayMode,
      photoFrameSize,
      photoShape,
      cardScale,
      cardGapMm,
      modularG12Position,
      focalRootMemberId,
      maxVisibleDepth,
      showGenGuides,
      guideOverlayMode,
      linesOnTop,
      showLineDots,
      showEndpointDots,
      genGradientPalette,
      theme,
      bgStyle,
      lineStyle,
      lineRoutingTopology,
      lineThicknessMode,
      cardFrameMode,
      showLineArrows,
      lineThickness,
      childLineColor,
      coupleLineColor,
      siblingLineColor,
      cardBgColor,
      cardBorderColor,
      captionInfo,
      activePresetId,
      aiBlueprint: null,
    };

    const nextList = [freshDesign, ...savedDesigns];
    setSavedDesigns(nextList);
    setActiveDesignId(newId);
    setAiBlueprint(null);
    setDesignNameInput(newName);
    setNodes(freshDesign.nodes);
    setEdges(freshDesign.edges);
    setQuickText(freshDesign.quickText);
    setSelectedIds([]);
    undoStackRef.current = [];
    setUndoCount(0);
    try {
      localStorage.setItem(designsStorageKey, JSON.stringify(nextList));
      localStorage.setItem(activeDesignIdKey, newId);
    } catch (e) {
      console.warn(e);
    }
    showNotification(`Desain baru "${newName}" dibuat!`);
  };

  const handleLoadDesign = (design: SavedGridDesign) => {
    setActiveDesignId(design.id);
    setActivePresetId(design.activePresetId);
    setAiBlueprint(design.aiBlueprint ?? null);
    setDesignNameInput(design.name);
    setNodes(design.nodes);
    setEdges(design.edges);
    setQuickText(design.quickText);
    setPaperSize(design.paperSize || 'a3');
    setPaperOrientation(design.paperOrientation || 'landscape');
    setCardDisplayMode(normalizeCardDisplayMode(design.cardDisplayMode));
    setPhotoFrameSize(design.photoFrameSize || '3x4');
    setPhotoShape(design.photoShape || defaultPhotoShape);
    setCardScale(design.cardScale ?? 1);
    setCardGapMm(design.cardGapMm ?? 3.5);
    setModularG12Position(design.modularG12Position ?? 'center');
    setFocalRootMemberId(design.focalRootMemberId || 'all');
    setMaxVisibleDepth(design.maxVisibleDepth ?? 0);
    setShowGenGuides(design.showGenGuides ?? true);
    setGuideOverlayMode(design.guideOverlayMode || 'gen_bands');
    setLinesOnTop(design.linesOnTop ?? false);
    setShowLineDots(design.showLineDots ?? true);
    setShowEndpointDots(design.showEndpointDots ?? true);
    setGenGradientPalette(design.genGradientPalette || 'none');
    setTheme(design.theme || 'dark');
    setBgStyle(design.bgStyle || '');
    setLineStyle(design.lineStyle || 'pcb90');
    setLineRoutingTopology(design.lineRoutingTopology || 'sibling_chain_all');
    setLineThicknessMode(design.lineThicknessMode || 'uniform');
    setCardFrameMode(design.cardFrameMode || 'auto');
    setShowLineArrows(design.showLineArrows ?? true);
    setLineThickness(design.lineThickness || 2.5);
    setChildLineColor(design.childLineColor ?? '');
    setCoupleLineColor(design.coupleLineColor ?? '#f59e0b');
    setSiblingLineColor(design.siblingLineColor ?? '');
    setCardBgColor(design.cardBgColor ?? '');
    setCardBorderColor(design.cardBorderColor ?? '');
    setCaptionInfo(
      design.captionInfo || getDefaultCaptionInfo(activeTrah.name)
    );
    setSelectedIds([]);
    setMoveUnlockedIds([]);
    setMoveAnchorId(null);
    undoStackRef.current = [];
    setUndoCount(0);
    lastStructureSigRef.current = getStructureSig(activeTrah.members);
    try {
      localStorage.setItem(activeDesignIdKey, design.id);
    } catch (e) {
      console.warn(e);
    }
    showNotification(`Desain "${design.name}" dimuat untuk diedit!`);
  };

  const handleDeleteDesign = (id: string) => {
    if (savedDesigns.length <= 1) {
      showNotification('Minimal harus ada 1 desain aktif!');
      return;
    }
    const nextList = savedDesigns.filter((d) => d.id !== id);
    setSavedDesigns(nextList);
    try {
      localStorage.setItem(designsStorageKey, JSON.stringify(nextList));
    } catch (e) {
      console.warn(e);
    }
    if (activeDesignId === id && nextList[0]) {
      handleLoadDesign(nextList[0]);
    }
    showNotification('Desain dihapus dari daftar.');
  };

  // =========================================================================
  // AUTO-GRID DARI QUICKTEXT
  // =========================================================================
  const generateFromQuickText = useCallback(
    (sourceText?: string) => {
      const raw = (sourceText !== undefined ? sourceText : quickText).trim();
      if (!raw) return;
      pushUndoSnapshot('Teks Auto-Grid');

      const prevByName = new Map<
        string,
        { sub?: string; photo?: string; wafat?: boolean; gender?: 'L' | 'P'; memberId?: string }
      >();
      nodes.forEach((n) => {
        prevByName.set(n.name.trim().toLowerCase(), n);
        if (n.mergedMembers) {
          n.mergedMembers.forEach((mm) => {
            prevByName.set(mm.name.trim().toLowerCase(), mm);
          });
        }
      });
      const trahMemberByName = new Map<string, FamilyMember>();
      activeTrah.members.forEach((m) => {
        const key = m.name.trim().toLowerCase();
        if (!trahMemberByName.has(key)) trahMemberByName.set(key, m);
      });
      const pendingMemberGenderSyncs: Array<{ memberId: string; gender: 'L' | 'P' }> = [];

      const nextNodes: InteractiveNode[] = [];
      const nextEdges: InteractiveEdge[] = [];
      let idCounter = 1;
      const lines = raw.split('\n').filter((l) => l.trim() !== '');

      let prevGenMainId: string | null = null;
      const maxCols = Math.max(4, Math.floor((boardWidth - 80) / 175));
      const startY = 80;
      const rowHeight = 220;

      lines.forEach((line, rowIdx) => {
        const cleanLine = line.replace(/\[.*?\]/g, '').trim();
        const groups = cleanLine
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean);

        const totalItems = groups.reduce(
          (acc, g) => acc + g.split('+').filter((x) => x.trim()).length,
          0
        );

        let currentGenMainId: string | null = null;
        let itemIndex = 0;

        groups.forEach((grp) => {
          const couple = grp
            .split('+')
            .map((p) => p.trim())
            .filter(Boolean);
          let firstInGroup: string | null = null;

          couple.forEach((rawPersonName, pIdx) => {
            const id = 'n_' + idCounter++;
            if (pIdx === 0) firstInGroup = id;
            if (itemIndex === 0 && pIdx === 0) currentGenMainId = id;

            let cleanName = rawPersonName;
            let parsedGender: 'L' | 'P' | undefined;
            if (/\((P|Pr|Perempuan|Wanita|Perp|Cewek|F)\)/i.test(cleanName)) {
              parsedGender = 'P';
              cleanName = cleanName.replace(/\((P|Pr|Perempuan|Wanita|Perp|Cewek|F)\)/i, '').trim();
            } else if (/\((L|Lk|Laki|Laki-laki|Pria|Cowok|M)\)/i.test(cleanName)) {
              parsedGender = 'L';
              cleanName = cleanName.replace(/\((L|Lk|Laki|Laki-laki|Pria|Cowok|M)\)/i, '').trim();
            }

            const colIdx = itemIndex % maxCols;
            const actualRowOffset = Math.floor(itemIndex / maxCols);
            const totalColsInSubRow = Math.min(
              maxCols,
              totalItems - actualRowOffset * maxCols
            );
            const availableWidth = totalColsInSubRow * 175;
            const startX = Math.max(40, (boardWidth - availableWidth) / 2);

            const posX = startX + colIdx * 175;
            const posY = startY + rowIdx * rowHeight + actualRowOffset * 130;

            const prev = prevByName.get(cleanName.toLowerCase());
            const matchedTrahMember =
              (prev?.memberId
                ? activeTrah.members.find((m) => m.id === prev.memberId)
                : undefined) || trahMemberByName.get(cleanName.toLowerCase());

            const resolvedGender =
              parsedGender ?? matchedTrahMember?.gender ?? prev?.gender;
            if (
              matchedTrahMember &&
              parsedGender &&
              matchedTrahMember.gender !== parsedGender
            ) {
              pendingMemberGenderSyncs.push({
                memberId: matchedTrahMember.id,
                gender: parsedGender,
              });
            }

            nextNodes.push({
              id,
              name: cleanName,
              sub:
                prev?.sub ||
                (matchedTrahMember
                  ? formatMemberLifeSubtitle(matchedTrahMember)
                  : rowIdx === 0
                  ? 'Leluhur Inti'
                  : `Generasi ${rowIdx + 1}`),
              x: posX,
              y: posY,
              photo: prev?.photo || matchedTrahMember?.photoUrl || '',
              wafat: prev?.wafat ?? matchedTrahMember?.isDeceased ?? false,
              gender: resolvedGender,
              memberId: matchedTrahMember?.id ?? prev?.memberId,
            });

            if (pIdx > 0 && firstInGroup) {
              nextEdges.push({ from: firstInGroup, to: id, type: 'couple' });
            }
            itemIndex++;
          });
        });

        if (rowIdx > 0 && prevGenMainId && currentGenMainId) {
          nextEdges.push({
            from: prevGenMainId,
            to: currentGenMainId,
            type: 'child',
          });
        }
        if (currentGenMainId) prevGenMainId = currentGenMainId;
      });

      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedIds([]);
      persistCurrentDesign(nextNodes, nextEdges, raw);
      if (onSyncMember && pendingMemberGenderSyncs.length > 0) {
        pendingMemberGenderSyncs.forEach(({ memberId, gender }) =>
          onSyncMember(memberId, { gender })
        );
      }
      showNotification(
        `Auto-Grid menata ${nextNodes.length} kartu ke kertas ${paperDim.label}!`
      );
    },
    [quickText, nodes, activeTrah.members, boardWidth, paperDim.label, persistCurrentDesign, pushUndoSnapshot, onSyncMember, showNotification]
  );

  // =========================================================================
  // SMART REKOMENDASI TATA LETAK BERBASIS DATA TABEL (ANTI-SILANG & 4-ARAH)
  // =========================================================================
  const smartAnalysis = useMemo(
    () => analyzeTrahForSmartLayout(windowedMembers),
    [windowedMembers]
  );

  const smartGalleryOptions = useMemo(
    () =>
      buildSmartGalleryOptions(
        windowedMembers,
        boardWidth,
        boardHeight,
        cardDisplayMode,
        photoFrameSize,
        cardGapMm
      ),
    [windowedMembers, boardWidth, boardHeight, cardDisplayMode, photoFrameSize, cardGapMm]
  );

  const currentLayoutQuality = useMemo(
    () =>
      evaluateSmartLayoutQuality(
        nodes,
        edges,
        boardWidth,
        boardHeight,
        cardDisplayMode,
        photoFrameSize,
        cardScale
      ),
    [nodes, edges, boardWidth, boardHeight, cardDisplayMode, photoFrameSize, cardScale]
  );

  const switchWorkspaceMode = useCallback(
    (nextMode: 'smart' | 'edit') => {
      setStudioWorkspaceMode(nextMode);
      if (nextMode === 'smart') {
        setSelectedIds([]);
        setMoveUnlockedIds([]);
        setMoveAnchorId(null);
        setIsMultiSelectMode(false);
        setConnectFromId(null);
        setActiveEdgeIdx(null);
        setIsPanelOpen(false);
        setIsSmartGalleryOpen(true);
        showNotification('Mode Smart aktif: pilih tata letak siap cetak tanpa alat edit!');
      } else {
        setLayoutMode('manual');
        showNotification('Mode Edit Manual aktif: bebas geser, tambah & atur detail kartu.');
      }
    },
    [showNotification]
  );

  const handleApplySmartPreset = useCallback(
    (
      presetId: SmartPresetId,
      overrideLockPaper?: boolean,
      overrideMembers?: FamilyMember[],
      overrideGapMm?: number,
      overrideModPos?: 'top' | 'center',
      preserveCardAppearance?: boolean
    ) => {
      const preset = SMART_LAYOUT_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      if (preset.isLocked) {
        showNotification(`Tata letak "${preset.title}" sedang dikunci.`);
        return;
      }
      pushUndoSnapshot(`Smart: ${preset.title}`);

      const sourceMembers = overrideMembers ?? windowedMembers;
      const isModularPreset =
        presetId === 'modular_g3_I' || presetId === 'modular_g3_L';
      let effGapMm = overrideGapMm ?? cardGapMm;
      const effModPos = overrideModPos ?? (isModularPreset ? modularG12Position : 'center');

      if (isModularPreset && overrideGapMm === undefined) {
        effGapMm = Math.max(3, Math.min(5, cardGapMm < 3 ? 3.5 : cardGapMm));
        setCardGapMm(effGapMm);
      }

      const keepCurrentPaper =
        overrideLockPaper !== undefined ? overrideLockPaper : lockSelectedPaper;

      let nextPaper = paperSize;
      let nextOrient = paperOrientation;
      let nextCardMode = cardDisplayMode;
      let nextPhotoSize = photoFrameSize;

      if (!keepCurrentPaper) {
        nextPaper = isModularPreset
          ? 'a3'
          : analyzeTrahForSmartLayout(sourceMembers).recommendedPaper;
        setPaperSize(nextPaper);
      }

      const shouldApplyPresetProfile =
        applyRecommendedStyle && !preserveCardAppearance;

      if (shouldApplyPresetProfile) {
        if (!keepCurrentPaper) {
          nextOrient = preset.recommendedOrientation;
          setPaperOrientation(nextOrient);
        }
        nextCardMode = preset.recommendedCardMode;
        nextPhotoSize = preset.recommendedPhotoSize;
        setCardDisplayMode(nextCardMode);
        setPhotoFrameSize(nextPhotoSize);
        setTheme(preset.recommendedTheme);
        setBgStyle(preset.recommendedBg);
        setCardFrameMode('auto');
        setLinesOnTop(false);
        setLineStyle(preset.recommendedLineStyle || 'pcb45');
        setLineThicknessMode(preset.recommendedLineThicknessMode || 'uniform');
        setLineRoutingTopology(
          preset.recommendedRoutingTopology || 'sibling_chain_all'
        );
        setShowLineArrows(preset.recommendedShowArrows ?? true);
        setShowEndpointDots(preset.recommendedShowEndpointDots ?? true);
        setShowLineDots(preset.recommendedShowLineDots ?? true);
        setGenGradientPalette(
          (preset.recommendedGenGradient || 'none') as GenGradientPaletteId
        );
      } else {
        // Saat mode preserveCardAppearance (mis. ganti posisi G1-G2 / fokus cabang):
        // tetap pulihkan karakter garis milik preset jika diperlukan tanpa merusak tampilan kartu pengguna
        setCardFrameMode('auto');
        setLineThicknessMode(preset.recommendedLineThicknessMode || 'uniform');
        if (preset.recommendedLineStyle) {
          setLineStyle(preset.recommendedLineStyle);
        }
        if (preset.recommendedRoutingTopology) {
          setLineRoutingTopology(preset.recommendedRoutingTopology);
        }
        if (preset.recommendedShowArrows !== undefined) {
          setShowLineArrows(preset.recommendedShowArrows);
        }
        if (preset.recommendedShowEndpointDots !== undefined) {
          setShowEndpointDots(preset.recommendedShowEndpointDots);
        }
        if (preset.recommendedShowLineDots !== undefined) {
          setShowLineDots(preset.recommendedShowLineDots);
        }
      }

      const targetPaperObj = GRID_PAPER_MAP[nextPaper];
      const targetW =
        nextOrient === 'landscape' ? targetPaperObj.pxW : targetPaperObj.pxH;
      const targetH =
        nextOrient === 'landscape' ? targetPaperObj.pxH : targetPaperObj.pxW;

      // Hitung skala kartu/foto otomatis lewat simulasi nyata agar bebas tumpuk & penuh proporsional
      const nextScale =
        applyRecommendedStyle || preserveCardAppearance
          ? computeOptimalCardScale(
              sourceMembers,
              targetW,
              targetH,
              nextCardMode,
              nextPhotoSize,
              presetId
            )
          : cardScale;

      if (applyRecommendedStyle || preserveCardAppearance) {
        setCardScale(nextScale);
      }

      const sampleDim = getNodeSize(
        {
          id: 's',
          name: 'Nama Anggota',
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: false,
          modularSubLayout: isModularPreset
            ? presetId === 'modular_g3_L'
              ? 'L'
              : 'I'
            : undefined,
        },
        nextCardMode,
        nextPhotoSize,
        nextScale
      );

      const result = generateSmartLayoutFromTable(
        sourceMembers,
        presetId,
        targetW,
        targetH,
        sampleDim,
        {
          displayMode: nextCardMode,
          photoSize: nextPhotoSize,
          cardScale: nextScale,
          cardGapMm: effGapMm,
          modularG12Position: effModPos,
        }
      );

      const nextGuideMode: GuideOverlayMode =
        preset.recommendedGuideMode || 'gen_bands';
      setGuideOverlayMode(nextGuideMode);
      if (preset.recommendedShowGenGuides !== undefined) {
        setShowGenGuides(preset.recommendedShowGenGuides);
      } else if (
        presetId === 'hierarchy_grid_fill' ||
        nextGuideMode === 'grid_9_rows' ||
        nextGuideMode === 'orbit_rings' ||
        nextGuideMode === 'modular_center'
      ) {
        setShowGenGuides(true);
      }

      const refreshedText = buildQuickTextFromTrah(sourceMembers);
      setActivePresetId(presetId);
      setAiBlueprint(null);
      setNodes(result.nodes);
      setEdges(result.edges);
      setQuickText(refreshedText);
      setSelectedIds([]);
      setLayoutMode('manual');
      persistCurrentDesign(result.nodes, result.edges, refreshedText, nextScale, presetId, null);

      showNotification(
        `Tata letak "${preset.badge}" ditata pas di ${targetPaperObj.label} (Skala ${Math.round(
          nextScale * 100
        )}%)!`
      );
    },
    [
      windowedMembers,
      cardGapMm,
      modularG12Position,
      lockSelectedPaper,
      applyRecommendedStyle,
      paperSize,
      paperOrientation,
      cardDisplayMode,
      photoFrameSize,
      cardScale,
      persistCurrentDesign,
      pushUndoSnapshot,
      showNotification,
    ]
  );

  // Racik Blueprint Desain AI (ringan: hanya kirim struktur ID & generasi, tanpa foto/nama pribadi)
  const handleRunAiBlueprintDesigner = useCallback(async () => {
    if (isAiDesigning || windowedMembers.length === 0) return;
    setAiDesignError(null);
    setIsAiDesigning(true);
    try {
      const bp = await requestNasabAiBlueprint({
        members: windowedMembers,
        archetypeHint: aiDesignArchetype,
        stylePrompt: aiDesignPrompt,
        paperSize,
        paperOrientation,
      });
      setAiQuotaInfo(getAiDesignerQuotaInfo());

      const targetPresetId: SmartPresetId =
        bp.archetype === 'tree_organic'
          ? 'subtree_vertical'
          : bp.archetype === 'lotus_mandala'
          ? 'teratai_mekar'
          : bp.archetype === 'honeycomb_tier'
          ? 'sarang_lebah_turun'
          : 'sarang_lebah_pusat';

      pushUndoSnapshot(`Racik AI: ${bp.themeTitle}`);

      const isHoneycombTarget =
        targetPresetId === 'sarang_lebah_turun' ||
        targetPresetId === 'sarang_lebah_pusat';
      const nextCardMode: CardDisplayMode =
        isHoneycombTarget || targetPresetId === 'teratai_mekar'
          ? 'photo_name_unified'
          : cardDisplayMode === 'name_only'
          ? 'photo_name'
          : cardDisplayMode;
      const isTreeTarget = targetPresetId === 'subtree_vertical';
      const nextPhotoSize: PhotoFrameSize =
        isTreeTarget ? photoFrameSize : 'bulat';

      setCardFrameMode('auto');
      setLineStyle(isHoneycombTarget ? 'none' : bp.connectorStyle);
      setLineThicknessMode('uniform');
      setLineRoutingTopology(
        targetPresetId === 'teratai_mekar' || isHoneycombTarget
          ? 'direct'
          : 'sibling_chain_all'
      );
      setShowLineArrows(isTreeTarget);
      setShowEndpointDots(!isHoneycombTarget);
      setLinesOnTop(false);
      setBgStyle('');
      setChildLineColor(bp.genColors?.[0]?.line || '');
      setCoupleLineColor('#f59e0b');
      setSiblingLineColor(bp.genColors?.[2]?.line || '');
      if (targetPresetId === 'teratai_mekar') {
        setGenGradientPalette('lotus_blossom');
      } else {
        setGenGradientPalette('none');
      }

      const nextScale = computeOptimalCardScale(
        windowedMembers,
        boardWidth,
        boardHeight,
        nextCardMode,
        nextPhotoSize,
        targetPresetId
      );
      setCardScale(nextScale);
      setPhotoFrameSize(nextPhotoSize);
      setCardDisplayMode(nextCardMode);

      const sampleDim = getNodeSize(
        {
          id: 'ai_sample',
          name: 'Nama Anggota',
          sub: '',
          x: 0,
          y: 0,
          photo: '',
          wafat: false,
        },
        nextCardMode,
        nextPhotoSize,
        nextScale
      );
      const built = generateSmartLayoutFromTable(
        windowedMembers,
        targetPresetId,
        boardWidth,
        boardHeight,
        sampleDim,
        {
          displayMode: nextCardMode,
          photoSize: nextPhotoSize,
          cardScale: nextScale,
          cardGapMm,
          modularG12Position,
          aiBlueprint: bp,
        }
      );

      const refreshedText = buildQuickTextFromTrah(windowedMembers);
      setAiBlueprint(bp);
      setActivePresetId(targetPresetId);
      setNodes(built.nodes);
      setEdges(built.edges);
      setQuickText(refreshedText);
      setSelectedIds([]);
      setLayoutMode('manual');
      persistCurrentDesign(
        built.nodes,
        built.edges,
        refreshedText,
        nextScale,
        targetPresetId,
        bp
      );
      setIsAiDesignModalOpen(false);
      showNotification(
        `${bp.themeTitle} diterapkan (${bp.fromCache ? '⚡ Cache 0 token' : '✨ Blueprint AI Baru'})!`
      );
    } catch (err) {
      setAiDesignError(
        err instanceof Error ? err.message : 'Gagal meracik blueprint desain AI.'
      );
      setAiQuotaInfo(getAiDesignerQuotaInfo());
    } finally {
      setIsAiDesigning(false);
    }
  }, [
    isAiDesigning,
    windowedMembers,
    aiDesignArchetype,
    aiDesignPrompt,
    paperSize,
    theme,
    cardDisplayMode,
    photoFrameSize,
    boardWidth,
    boardHeight,
    cardGapMm,
    modularG12Position,
    pushUndoSnapshot,
    persistCurrentDesign,
    showNotification,
  ]);

  // Saat pengguna mengubah Kertas / Orientasi / Mode Card di Mode Smart, otomatis tata ulang dengan skala bebas-tumpuk
  const applySmartLiveSetting = useCallback(
    (patch: {
      paper?: GridPaperSize;
      orient?: GridPaperOrientation;
      cardMode?: CardDisplayMode;
      photoSize?: PhotoFrameSize;
    }) => {
      const nextPaper = patch.paper ?? paperSize;
      const nextOrient = patch.orient ?? paperOrientation;
      const nextMode = patch.cardMode ?? cardDisplayMode;
      const nextPhoto = patch.photoSize ?? photoFrameSize;

      if (patch.paper) setPaperSize(nextPaper);
      if (patch.orient) setPaperOrientation(nextOrient);
      if (patch.cardMode) setCardDisplayMode(nextMode);
      if (patch.photoSize) setPhotoFrameSize(nextPhoto);

      if (studioWorkspaceMode !== 'smart' || windowedMembers.length === 0) return;

      const presetId: SmartPresetId =
        activePresetId || smartAnalysis.topPresetId || 'hierarchy_grid_fill';
      const pObj = GRID_PAPER_MAP[nextPaper];
      const tW = nextOrient === 'landscape' ? pObj.pxW : pObj.pxH;
      const tH = nextOrient === 'landscape' ? pObj.pxH : pObj.pxW;
      const optScale = computeOptimalCardScale(
        windowedMembers,
        tW,
        tH,
        nextMode,
        nextPhoto,
        presetId
      );
      setCardScale(optScale);
      const rebuilt = rebuildSmartLayoutPreservingVisuals(
        windowedMembers,
        presetId,
        nodes,
        tW,
        tH,
        nextMode,
        nextPhoto,
        optScale,
        cardGapMm,
        modularG12Position,
        aiBlueprint
      );
      setNodes(rebuilt.nodes);
      setEdges(rebuilt.edges);
      persistCurrentDesign(rebuilt.nodes, rebuilt.edges, undefined, optScale, presetId);
    },
    [
      paperSize,
      paperOrientation,
      cardDisplayMode,
      photoFrameSize,
      studioWorkspaceMode,
      windowedMembers,
      activePresetId,
      smartAnalysis.topPresetId,
      nodes,
      cardGapMm,
      modularG12Position,
      aiBlueprint,
      rebuildSmartLayoutPreservingVisuals,
      persistCurrentDesign,
    ]
  );

  // Tombol cepat: sesuaikan skala kartu & foto otomatis agar kertas aktif terisi seimbang
  const handleAutoFitCardScale = useCallback(() => {
    pushUndoSnapshot('Pas-kan Skala Kertas');
    const chosenPreset: SmartPresetId =
      activePresetId ||
      (windowedMembers.length > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical');
    const optimal = computeOptimalCardScale(
      windowedMembers,
      boardWidth,
      boardHeight,
      cardDisplayMode,
      photoFrameSize,
      chosenPreset
    );
    setCardScale(optimal);
    if (windowedMembers.length > 0) {
      const rebuilt = rebuildSmartLayoutPreservingVisuals(
        windowedMembers,
        chosenPreset,
        nodes,
        boardWidth,
        boardHeight,
        cardDisplayMode,
        photoFrameSize,
        optimal,
        cardGapMm,
        modularG12Position,
        aiBlueprint
      );
      setNodes(rebuilt.nodes);
      setEdges(rebuilt.edges);
      persistCurrentDesign(rebuilt.nodes, rebuilt.edges, undefined, optimal, chosenPreset);
    }
    showNotification(
      `Skala kartu & foto disesuaikan ke ${Math.round(optimal * 100)}% agar pas isi ${paperDim.label}!`
    );
  }, [
    activePresetId,
    windowedMembers,
    nodes,
    boardWidth,
    boardHeight,
    cardDisplayMode,
    photoFrameSize,
    cardGapMm,
    modularG12Position,
    aiBlueprint,
    paperDim.label,
    rebuildSmartLayoutPreservingVisuals,
    persistCurrentDesign,
    pushUndoSnapshot,
    showNotification,
  ]);

  // Terapkan jarak antar card (1-5mm), pasangan menempel (0mm), dan anak lajang (1.5mm)
  const handleApplyCardGap = useCallback(
    (nextGapMm: number) => {
      const clamped = Math.max(1, Math.min(5, nextGapMm));
      setCardGapMm(clamped);
      if (windowedMembers.length === 0) return;
      pushUndoSnapshot(`Ubah Jarak Card (${clamped}mm)`);
      const chosenPreset: SmartPresetId =
        activePresetId ||
        (windowedMembers.length > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical');
      const rebuilt = rebuildSmartLayoutPreservingVisuals(
        windowedMembers,
        chosenPreset,
        nodes,
        boardWidth,
        boardHeight,
        cardDisplayMode,
        photoFrameSize,
        cardScale,
        clamped,
        modularG12Position,
        aiBlueprint
      );
      setNodes(rebuilt.nodes);
      setEdges(rebuilt.edges);
      persistCurrentDesign(rebuilt.nodes, rebuilt.edges);
      showNotification(
        `Jarak kartu diatur ${clamped}mm (Pasangan menempel 0mm • Lajang 1.5mm)!`
      );
    },
    [
      windowedMembers,
      activePresetId,
      nodes,
      boardWidth,
      boardHeight,
      cardDisplayMode,
      photoFrameSize,
      cardScale,
      modularG12Position,
      aiBlueprint,
      rebuildSmartLayoutPreservingVisuals,
      persistCurrentDesign,
      pushUndoSnapshot,
      showNotification,
    ]
  );

  // Terapkan Jendela Fokus Cabang & Kedalaman Generasi (Solusi G20+ Anti-Kecil)
  const handleApplyFocalBranch = useCallback(
    (nextFocalId: string, nextDepth: number) => {
      setFocalRootMemberId(nextFocalId);
      setMaxVisibleDepth(nextDepth);
      const nextWin = buildWindowedMembers(activeTrah.members, nextFocalId, nextDepth);
      if (nextWin.members.length === 0) return;
      const chosenPreset: SmartPresetId =
        activePresetId ||
        (nextWin.members.length > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical');
      handleApplySmartPreset(chosenPreset, true, nextWin.members);
    },
    [activeTrah.members, activePresetId, handleApplySmartPreset]
  );

  // =========================================================================
  // FITUR GROUP / UNGROUP (GABUNGKAN BEBERAPA KARTU)
  // =========================================================================
  const handleGroupSelected = () => {
    if (selectedIds.length < 2) {
      showNotification('Pilih minimal 2 kartu untuk digabungkan ke dalam Group!');
      return;
    }
    pushUndoSnapshot('Group Kartu');
    const newGroupId = `grp_${Date.now().toString().slice(-4)}`;
    const selSet = new Set(selectedIds);
    const nextNodes = nodes.map((n) =>
      selSet.has(n.id) ? { ...n, groupId: newGroupId } : n
    );
    setNodes(nextNodes);
    persistCurrentDesign(nextNodes, edges);
    showNotification(`${selectedIds.length} kartu digabung menjadi 1 Group!`);
  };

  const handleUngroupSelected = () => {
    if (selectedIds.length === 0) return;
    pushUndoSnapshot('Lepas Group');
    const selSet = new Set(selectedIds);
    const selectedGroups = new Set(
      nodes
        .filter((n) => selSet.has(n.id) && n.groupId)
        .map((n) => n.groupId!)
    );

    const nextNodes = nodes.map((n) =>
      selSet.has(n.id) || (n.groupId && selectedGroups.has(n.groupId))
        ? { ...n, groupId: undefined }
        : n
    );
    setNodes(nextNodes);
    persistCurrentDesign(nextNodes, edges);
    showNotification('Ikatan Group berhasil dilepas.');
  };

  // =========================================================================
  // GABUNG JADI 1 CARD BESAR (GARIS DIRINGKAS JADI 1 • KARTU LAIN TETAP DI POSISI)
  // =========================================================================
  const handleMergeSelectedIntoBigCard = () => {
    if (selectedIds.length < 2) {
      showNotification('Pilih minimal 2 foto/card untuk digabung menjadi 1 Card Besar!');
      return;
    }

    const selSet = new Set(selectedIds);
    const selectedNodes = nodes
      .filter((n) => selSet.has(n.id))
      .sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x));

    if (selectedNodes.length < 2) return;
    pushUndoSnapshot('Gabung Card Besar');

    const minX = Math.min(...selectedNodes.map((n) => n.x));
    const minY = Math.min(...selectedNodes.map((n) => n.y));
    const maxX = Math.max(
      ...selectedNodes.map((n) => {
        const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
        return n.x + sz.w;
      })
    );

    const flatMembers: MergedCardMember[] = [];
    const inheritedSnapshots: InteractiveEdge[] = [];

    selectedNodes.forEach((n) => {
      if (n.mergedMembers && n.mergedMembers.length > 0) {
        n.mergedMembers.forEach((mm) => {
          flatMembers.push({
            ...mm,
            relX: Math.round(n.x - minX + mm.relX),
            relY: Math.round(n.y - minY + mm.relY),
          });
        });
        if (n.mergedEdgesSnapshot) {
          inheritedSnapshots.push(...n.mergedEdgesSnapshot);
        }
      } else {
        flatMembers.push({
          originalNodeId: n.id,
          memberId: n.memberId,
          name: n.name,
          sub: n.sub,
          photo: n.photo,
          wafat: n.wafat,
          gender: n.gender,
          genLevel: n.genLevel,
          customBgColor: n.customBgColor,
          customBorderColor: n.customBorderColor,
          relX: Math.round(n.x - minX),
          relY: Math.round(n.y - minY),
        });
      }
    });

    const snapshotEdges = [
      ...inheritedSnapshots,
      ...edges.filter((e) => selSet.has(e.from) || selSet.has(e.to)),
    ];

    const mergedId = `merged_${Date.now().toString().slice(-5)}`;
    const firstNames = flatMembers.slice(0, 2).map((m) => m.name.split(' ')[0]);
    const combinedTitle =
      flatMembers.length === 2
        ? `${flatMembers[0].name} & ${flatMembers[1].name}`
        : `${firstNames.join(', ')} (+${flatMembers.length - 2})`;

    const minGenLevel = selectedNodes.reduce<number | undefined>((acc, n) => {
      if (n.genLevel === undefined) return acc;
      return acc === undefined ? n.genLevel : Math.min(acc, n.genLevel);
    }, undefined);

    const draftMergedNode: InteractiveNode = {
      id: mergedId,
      name: combinedTitle,
      sub: `Gabungan ${flatMembers.length} Kartu`,
      x: minX,
      y: minY,
      photo: flatMembers[0]?.photo || '',
      wafat: flatMembers.every((m) => m.wafat),
      genLevel: minGenLevel,
      customBgColor: selectedNodes.find((n) => n.customBgColor)?.customBgColor,
      customBorderColor: selectedNodes.find((n) => n.customBorderColor)?.customBorderColor,
      mergedMembers: flatMembers,
      mergedEdgesSnapshot: snapshotEdges,
    };

    const mergedSize = getNodeSize(
      draftMergedNode,
      cardDisplayMode,
      photoFrameSize,
      cardScale
    );

    // Tetap tempatkan Card Besar di posisi area kartu terpilih (kartu lain tidak ikut digeser)
    const selCenterX = (minX + maxX) / 2;
    const targetX = Math.max(
      16,
      Math.min(
        Math.max(16, boardWidth - mergedSize.w - 16),
        Math.round(selCenterX - mergedSize.w / 2)
      )
    );
    const targetY = Math.max(
      58,
      Math.min(Math.max(58, boardHeight - mergedSize.h - 24), Math.round(minY))
    );

    const mergedNode: InteractiveNode = {
      ...draftMergedNode,
      x: targetX,
      y: targetY,
    };

    // Ringkas garis: hapus garis internal antar-kartu yg digabung & gabungkan garis luar jadi 1 jalur per pasangan kartu
    let touchedBeforeCount = 0;
    const edgePairMap = new Map<string, InteractiveEdge>();
    edges.forEach((ed) => {
      const fromIn = selSet.has(ed.from);
      const toIn = selSet.has(ed.to);
      if (fromIn || toIn) touchedBeforeCount++;
      if (fromIn && toIn) return; // Garis internal antar kartu yang digabung dihapus

      const nextFrom = fromIn ? mergedId : ed.from;
      const nextTo = toIn ? mergedId : ed.to;
      if (nextFrom === nextTo) return;

      const pairKey = [nextFrom, nextTo].sort().join('::');
      const existing = edgePairMap.get(pairKey);
      const cleanEdge: InteractiveEdge =
        fromIn || toIn
          ? { from: nextFrom, to: nextTo, type: ed.type }
          : { ...ed };

      if (!existing) {
        edgePairMap.set(pairKey, cleanEdge);
      } else if (existing.type === 'couple' && cleanEdge.type === 'child') {
        // Prioritaskan garis keturunan bila bentrok pasangan & keturunan pada simpul gabungan
        edgePairMap.set(pairKey, cleanEdge);
      }
    });

    const consolidatedEdges = Array.from(edgePairMap.values());
    const mergedExternalEdgesCount = consolidatedEdges.filter(
      (e) => e.from === mergedId || e.to === mergedId
    ).length;

    // Pertahankan posisi semua kartu lain tetap diam di tempatnya
    const otherNodes = nodes.filter((n) => !selSet.has(n.id));
    const nextNodes = [...otherNodes, mergedNode];
    setNodes(nextNodes);
    setEdges(consolidatedEdges);
    setSelectedIds([mergedId]);
    setMoveUnlockedIds([]);
    setMoveAnchorId(null);
    setLayoutMode('manual');
    persistCurrentDesign(nextNodes, consolidatedEdges);

    showNotification(
      `${flatMembers.length} kartu digabung jadi 1 Card Besar (${touchedBeforeCount} → ${mergedExternalEdgesCount} garis)! Kartu lain tetap di posisinya.`
    );
  };

  const handleUnmergeSelectedCard = (explicitId?: string) => {
    const targetId =
      explicitId || (selectedIds.length === 1 ? selectedIds[0] : '');
    if (!targetId) return;

    const mergedNode = nodes.find((n) => n.id === targetId);
    if (!mergedNode?.mergedMembers || mergedNode.mergedMembers.length < 2) return;
    pushUndoSnapshot('Pisah Card Besar');

    const remainingNodes = nodes.filter((n) => n.id !== targetId);
    const mergedSize = getNodeSize(
      mergedNode,
      cardDisplayMode,
      photoFrameSize,
      cardScale
    );
    const mergedCenterX = mergedNode.x + mergedSize.w / 2;

    const restoredNodes: InteractiveNode[] = [];
    const usedIds = new Set(remainingNodes.map((n) => n.id));
    const gapX = 14;
    const gapY = 22;
    const gm = computeMergedCardMetrics(
      mergedNode.mergedMembers.length,
      cardDisplayMode,
      photoFrameSize,
      cardScale * (mergedNode.scaleMultiplier ?? 1),
      mergedNode.mergedCols,
      mergedNode.modularSubLayout || 'grid',
      mergedNode.mergedMembers
    );
    const cols = gm.cols;

    const rawRestored = mergedNode.mergedMembers.map((mm, idx) => {
      let nodeId = mm.originalNodeId || `n_unmerged_${Date.now()}_${idx}`;
      if (usedIds.has(nodeId)) {
        nodeId = `${nodeId}_${idx}`;
      }
      usedIds.add(nodeId);

      const candidate: InteractiveNode = {
        id: nodeId,
        memberId: mm.memberId,
        name: mm.name,
        sub: mm.sub,
        x: mergedNode.x,
        y: mergedNode.y,
        photo: mm.photo,
        wafat: mm.wafat,
        gender: mm.gender,
        genLevel: mm.genLevel ?? mergedNode.genLevel,
        customBgColor: mm.customBgColor,
        customBorderColor: mm.customBorderColor,
      };
      const sz = getNodeSize(candidate, cardDisplayMode, photoFrameSize, cardScale);
      return { candidate, sz };
    });

    const rowsCount = Math.ceil(rawRestored.length / cols);
    let curRowY = Math.max(58, mergedNode.y);

    for (let r = 0; r < rowsCount; r++) {
      const rowItems = rawRestored.slice(r * cols, (r + 1) * cols);
      const rowTotalW =
        rowItems.reduce((s, it) => s + it.sz.w, 0) +
        Math.max(0, rowItems.length - 1) * gapX;
      const rowMaxH = Math.max(...rowItems.map((it) => it.sz.h));
      let curX = Math.max(
        16,
        Math.min(
          Math.max(16, boardWidth - rowTotalW - 16),
          Math.round(mergedCenterX - rowTotalW / 2)
        )
      );
      const clampedRowY = Math.max(
        58,
        Math.min(Math.max(58, boardHeight - rowMaxH - 24), Math.round(curRowY))
      );

      rowItems.forEach(({ candidate, sz }) => {
        candidate.x = Math.round(curX);
        candidate.y = clampedRowY;
        restoredNodes.push(candidate);
        curX += sz.w + gapX;
      });

      curRowY = clampedRowY + rowMaxH + gapY;
    }

    const allValidIds = new Set([
      ...remainingNodes.map((n) => n.id),
      ...restoredNodes.map((n) => n.id),
    ]);

    const nextEdgeMap = new Map<string, InteractiveEdge>();
    const addUniqueEdge = (ed: InteractiveEdge) => {
      if (!allValidIds.has(ed.from) || !allValidIds.has(ed.to) || ed.from === ed.to) {
        return;
      }
      const key = `${ed.from}->${ed.to}:${ed.type}`;
      if (!nextEdgeMap.has(key)) nextEdgeMap.set(key, { ...ed });
    };

    edges.forEach((ed) => {
      if (ed.from !== targetId && ed.to !== targetId) {
        addUniqueEdge(ed);
      }
    });

    (mergedNode.mergedEdgesSnapshot || []).forEach(addUniqueEdge);

    if (restoredNodes[0]) {
      edges.forEach((ed) => {
        if (ed.from === targetId || ed.to === targetId) {
          const mappedFrom = ed.from === targetId ? restoredNodes[0].id : ed.from;
          const mappedTo = ed.to === targetId ? restoredNodes[0].id : ed.to;
          const existsToRestored = Array.from(nextEdgeMap.values()).some(
            (x) =>
              (x.from === mappedFrom || restoredNodes.some((r) => r.id === x.from)) &&
              (x.to === mappedTo || restoredNodes.some((r) => r.id === x.to)) &&
              (x.from === ed.from || x.to === ed.to || x.from === mappedFrom || x.to === mappedTo)
          );
          if (!existsToRestored) {
            addUniqueEdge({ from: mappedFrom, to: mappedTo, type: ed.type });
          }
        }
      });
    }

    // Kartu lain tetap di posisinya tanpa digeser
    const nextNodes = [...remainingNodes, ...restoredNodes];
    const nextEdges = Array.from(nextEdgeMap.values());
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedIds(restoredNodes.map((n) => n.id));
    persistCurrentDesign(nextNodes, nextEdges);
    showNotification(
      `Card Besar dipisah menjadi ${restoredNodes.length} kartu di posisi saat ini (kartu lain tetap di posisinya)!`
    );
  };

  const handleUpdateMergedCols = (nodeId: string, colsValue?: number) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target?.mergedMembers || target.mergedMembers.length < 2) return;
    pushUndoSnapshot('Ubah Kolom Gabungan');

    const updatedTarget: InteractiveNode = {
      ...target,
      mergedCols: colsValue,
    };
    const nextSize = getNodeSize(
      updatedTarget,
      cardDisplayMode,
      photoFrameSize,
      cardScale
    );
    const clampedX = Math.max(
      16,
      Math.min(Math.max(16, boardWidth - nextSize.w - 16), updatedTarget.x)
    );
    const clampedY = Math.max(
      58,
      Math.min(Math.max(58, boardHeight - nextSize.h - 24), updatedTarget.y)
    );
    updatedTarget.x = clampedX;
    updatedTarget.y = clampedY;

    const others = nodes.filter((n) => n.id !== nodeId);
    const nextNodes = [...others, updatedTarget];
    setNodes(nextNodes);
    persistCurrentDesign(nextNodes, edges);
  };

  const handleUpdateModularSubLayout = (
    nodeId: string,
    subLayout: 'grid' | 'I' | 'L'
  ) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target?.mergedMembers || target.mergedMembers.length < 2) return;
    pushUndoSnapshot(`Ubah Pola Card Modular (${subLayout})`);
    const updatedTarget: InteractiveNode = {
      ...target,
      modularSubLayout: subLayout,
    };
    const nextSize = getNodeSize(
      updatedTarget,
      cardDisplayMode,
      photoFrameSize,
      cardScale
    );
    updatedTarget.x = Math.max(
      16,
      Math.min(Math.max(16, boardWidth - nextSize.w - 16), updatedTarget.x)
    );
    updatedTarget.y = Math.max(
      58,
      Math.min(Math.max(58, boardHeight - nextSize.h - 24), updatedTarget.y)
    );
    const nextNodes = nodes.map((n) => (n.id === nodeId ? updatedTarget : n));
    setNodes(nextNodes);
    persistCurrentDesign(nextNodes, edges);
    showNotification(`Pola dalam card diubah ke tata letak ${subLayout}!`);
  };

  // Hitung kotak pembatas (bounding box) setiap Group agar terlihat jelas di kanvas
  const groupBoxes = useMemo(() => {
    const groups = new Map<string, InteractiveNode[]>();
    nodes.forEach((n) => {
      if (n.groupId) {
        if (!groups.has(n.groupId)) groups.set(n.groupId, []);
        groups.get(n.groupId)!.push(n);
      }
    });

    const boxes: Array<{
      groupId: string;
      x: number;
      y: number;
      w: number;
      h: number;
      count: number;
    }> = [];

    groups.forEach((members, groupId) => {
      if (members.length < 2) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      members.forEach((m) => {
        const s = getNodeSize(m, cardDisplayMode, photoFrameSize, cardScale);
        minX = Math.min(minX, m.x);
        minY = Math.min(minY, m.y);
        maxX = Math.max(maxX, m.x + s.w);
        maxY = Math.max(maxY, m.y + s.h);
      });

      boxes.push({
        groupId,
        x: minX - 12,
        y: minY - 18,
        w: maxX - minX + 24,
        h: maxY - minY + 30,
        count: members.length,
      });
    });

    return boxes;
  }, [nodes, cardDisplayMode, photoFrameSize, cardScale]);

  // Pita & Garis Penunjuk Generasi (membantu baca hirarki saat kertas A3 diisi penuh)
  const generationGuideBands = useMemo(() => {
    if (!showGenGuides || nodes.length === 0) return [];
    const memberGenLookup = new Map<string, number>();
    activeTrah.members.forEach((m) => {
      memberGenLookup.set(m.id, m.generationLevel ?? 0);
    });

    const bands = new Map<number, { minY: number; maxY: number }>();
    nodes.forEach((n) => {
      const gen =
        n.genLevel !== undefined
          ? n.genLevel
          : n.memberId && memberGenLookup.has(n.memberId)
          ? memberGenLookup.get(n.memberId)!
          : undefined;
      if (gen === undefined) return;
      const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
      const cur = bands.get(gen);
      if (!cur) {
        bands.set(gen, { minY: n.y, maxY: n.y + sz.h });
      } else {
        cur.minY = Math.min(cur.minY, n.y);
        cur.maxY = Math.max(cur.maxY, n.y + sz.h);
      }
    });

    return Array.from(bands.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([gen, b]) => ({
        gen,
        label: `GEN ${gen + 1}`,
        top: Math.max(54, b.minY - 8),
        height: Math.max(26, b.maxY - b.minY + 16),
      }));
  }, [showGenGuides, nodes, activeTrah.members, cardDisplayMode, photoFrameSize, cardScale]);

  // =========================================================================
  // INTERAKSI DRAG KARTU GPU (0 RE-RENDER) / HOLD 2 DETIK / PINCH & PAN GPU
  // =========================================================================
  const cancelHoldTimer = useCallback(() => {
    if (holdTimerRef.current.intervalId !== null) {
      window.clearTimeout(holdTimerRef.current.intervalId);
      holdTimerRef.current.intervalId = null;
    }
    holdTimerRef.current.active = false;
    setHoldingNodeId(null);
  }, []);

  const stopNudgeRepeat = useCallback(() => {
    if (nudgeIntervalRef.current !== null) {
      window.clearInterval(nudgeIntervalRef.current);
      nudgeIntervalRef.current = null;
    }
  }, []);

  const nudgeNodesBy = useCallback(
    (targetIds: string[], dx: number, dy: number) => {
      if (targetIds.length === 0) return;
      const tSet = new Set(targetIds);
      setNodes((prev) => {
        const next = prev.map((n) => {
          if (!tSet.has(n.id)) return n;
          const size = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
          return {
            ...n,
            x: Math.max(0, Math.min(boardWidth - size.w, Math.round(n.x + dx))),
            y: Math.max(0, Math.min(boardHeight - size.h, Math.round(n.y + dy))),
          };
        });
        persistCurrentDesign(next, edges);
        return next;
      });
    },
    [boardWidth, boardHeight, cardDisplayMode, photoFrameSize, cardScale, edges, persistCurrentDesign]
  );

  const startNudgeRepeat = (targetIds: string[], dx: number, dy: number) => {
    stopNudgeRepeat();
    pushUndoSnapshot('Geser Kartu');
    nudgeNodesBy(targetIds, dx, dy);
    nudgeIntervalRef.current = window.setInterval(() => {
      nudgeNodesBy(targetIds, dx, dy);
    }, 110);
  };

  useEffect(() => {
    return () => {
      cancelHoldTimer();
      stopNudgeRepeat();
    };
  }, [cancelHoldTimer, stopNudgeRepeat]);

  const startEdgeDotDrag = (
    e: React.MouseEvent | React.TouchEvent,
    edgeIdx: number
  ) => {
    e.stopPropagation();
    if ('cancelable' in e && e.cancelable) e.preventDefault();

    const ed = edges[edgeIdx];
    if (!ed) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const pt = getBoardPoint(clientX, clientY);

    setActiveEdgeIdx(edgeIdx);
    edgeDragRef.current = {
      active: true,
      edgeIdx,
      startPointerX: pt.x,
      startPointerY: pt.y,
      initOffsetX: ed.offsetX ?? 0,
      initOffsetY: ed.offsetY ?? 0,
      preDragEdges: edges.map((item) => ({ ...item })),
    };
  };

  const resetEdgeOffset = (edgeIdx: number) => {
    pushUndoSnapshot('Reset Jalur Garis');
    const nextEdges = edges.map((ed, i) =>
      i === edgeIdx
        ? {
            ...ed,
            offsetX: undefined,
            offsetY: undefined,
            dotPos: undefined,
            fromPort: undefined,
            toPort: undefined,
            hideDot: undefined,
          }
        : ed
    );
    setEdges(nextEdges);
    persistCurrentDesign(nodes, nextEdges);
    showNotification('Jalur garis dikembalikan ke Auto!');
  };

  const resetAllEdgeOffsets = () => {
    pushUndoSnapshot('Reset Semua Garis');
    const nextEdges = edges.map((ed) => ({
      ...ed,
      offsetX: undefined,
      offsetY: undefined,
      dotPos: undefined,
      fromPort: undefined,
      toPort: undefined,
      hideDot: undefined,
    }));
    setEdges(nextEdges);
    setActiveEdgeIdx(null);
    persistCurrentDesign(nodes, nextEdges);
    showNotification('Semua jalur garis & dot direset ke Auto!');
  };

  const handleUpdateActiveEdgeDot = (patch: Partial<InteractiveEdge>) => {
    if (activeEdgeIdx === null) return;
    pushUndoSnapshot('Ubah Posisi/Dot Garis');
    const nextEdges = edges.map((ed, i) =>
      i === activeEdgeIdx ? { ...ed, ...patch } : ed
    );
    setEdges(nextEdges);
    persistCurrentDesign(nodes, nextEdges);
  };

  const handleDeleteActiveEdge = () => {
    if (activeEdgeIdx === null) return;
    pushUndoSnapshot('Hapus Garis Konektor');
    const nextEdges = edges.filter((_, i) => i !== activeEdgeIdx);
    setEdges(nextEdges);
    setActiveEdgeIdx(null);
    persistCurrentDesign(nodes, nextEdges);
    showNotification('Garis konektor dihapus.');
  };

  const handleToggleAllEdgeDots = (visible: boolean) => {
    pushUndoSnapshot(visible ? 'Tampilkan Semua Dot' : 'Hapus Semua Dot');
    setShowLineDots(visible);
    setShowEndpointDots(visible);
    const nextEdges = edges.map((ed) => ({ ...ed, hideDot: !visible }));
    setEdges(nextEdges);
    persistCurrentDesign(nodes, nextEdges);
    showNotification(
      visible ? 'Semua dot garis ditampilkan.' : 'Semua dot garis disembunyikan/dihapus.'
    );
  };

  const hitTestNodeAtBoardPoint = useCallback(
    (bx: number, by: number): InteractiveNode | null => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
        if (bx >= n.x && bx <= n.x + sz.w && by >= n.y && by <= n.y + sz.h) {
          return n;
        }
      }
      return null;
    },
    [nodes, cardDisplayMode, photoFrameSize, cardScale]
  );

  const startNodeInteraction = (
    e: React.MouseEvent | React.TouchEvent,
    id: string
  ) => {
    if ('touches' in e) {
      lastTouchTimeRef.current = Date.now();
      if (e.touches.length >= 2) {
        dragStateRef.current.active = false;
        setIsDraggingCards(false);
        cancelHoldTimer();
        return;
      }
    } else if (Date.now() - lastTouchTimeRef.current < 500) {
      return;
    }

    if (isPanMode || studioWorkspaceMode === 'smart') {
      return;
    }
    e.stopPropagation();

    // 1. Mode Hubungkan Garis
    if (connectFromId) {
      if (connectFromId !== id) {
        const exists = edges.some(
          (ed) =>
            (ed.from === connectFromId && ed.to === id) ||
            (ed.from === id && ed.to === connectFromId)
        );
        if (!exists) {
          pushUndoSnapshot('Sambung Garis');
          const updatedEdges: InteractiveEdge[] = [
            ...edges,
            { from: connectFromId, to: id, type: connectType },
          ];
          setEdges(updatedEdges);
          persistCurrentDesign(nodes, updatedEdges);
          showNotification('Garis koneksi berhasil disambungkan!');
        }
      }
      setConnectFromId(null);
      return;
    }

    const clickedNode = nodes.find((n) => n.id === id);
    if (!clickedNode) return;

    const isModifierPressed =
      ('shiftKey' in e && e.shiftKey) ||
      ('ctrlKey' in e && e.ctrlKey) ||
      ('metaKey' in e && e.metaKey);

    // 2. Mode Checklist Pilih Banyak
    if (isMultiSelectMode || isModifierPressed) {
      cancelHoldTimer();
      const nextSelection = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      setSelectedIds(nextSelection);
      return;
    }

    let activeSelection = selectedIds;
    if (!selectedIds.includes(id)) {
      if (clickedNode.groupId) {
        activeSelection = nodes
          .filter((n) => n.groupId === clickedNode.groupId)
          .map((n) => n.id);
      } else {
        activeSelection = [id];
      }
      setSelectedIds(activeSelection);
    }

    if (layoutMode !== 'manual') return;

    const movingSet = new Set<string>(activeSelection);
    activeSelection.forEach((selId) => {
      const n = nodes.find((x) => x.id === selId);
      if (n?.groupId) {
        nodes
          .filter((x) => x.groupId === n.groupId)
          .forEach((x) => movingSet.add(x.id));
      }
    });
    const movingArr = Array.from(movingSet);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startPt = getBoardPoint(clientX, clientY);

    const initialPositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      if (movingSet.has(n.id)) {
        initialPositions[n.id] = { x: n.x, y: n.y };
      }
    });

    const alreadyUnlocked = moveUnlockedIds.includes(id);

    if (!safeHoldMove || alreadyUnlocked) {
      if (alreadyUnlocked) {
        setMoveAnchorId(id);
      }
      dragStateRef.current = {
        active: true,
        movingIds: movingArr,
        startPointerX: startPt.x,
        startPointerY: startPt.y,
        initialPositions,
        lastDx: 0,
        lastDy: 0,
        preDragNodes: cloneNodesForHistory(nodes),
      };
      setIsDraggingCards(true);
      return;
    }

    // Kunci Aman Aktif: 1 timer tunggal (CSS animasi, 0 React re-render selama 2 detik!)
    if (!moveUnlockedIds.includes(id)) {
      setMoveUnlockedIds([]);
      setMoveAnchorId(null);
    }
    cancelHoldTimer();
    const HOLD_DURATION_MS = 1800;

    setHoldingNodeId(id);
    const timeoutId = window.setTimeout(() => {
      holdTimerRef.current.intervalId = null;
      holdTimerRef.current.active = false;
      setHoldingNodeId(null);
      setMoveUnlockedIds(movingArr);
      setMoveAnchorId(id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35);
      }
      dragStateRef.current = {
        active: true,
        movingIds: movingArr,
        startPointerX: startPt.x,
        startPointerY: startPt.y,
        initialPositions,
        lastDx: 0,
        lastDy: 0,
        preDragNodes: cloneNodesForHistory(latestUndoStateRef.current.nodes),
      };
      setIsDraggingCards(true);
      showNotification(
        'Kartu terbuka! Gunakan popup panah ▲▼◀▶ atau seret kartu untuk memindahkan.'
      );
    }, HOLD_DURATION_MS);

    holdTimerRef.current = {
      active: true,
      nodeId: id,
      startClientX: clientX,
      startClientY: clientY,
      intervalId: timeoutId,
    };
  };

  // Pinch-to-Zoom 2 Jari & 1-Jari Pan Kanvas pada Viewport (GPU Stage)
  const tapCandidateRef = useRef<{
    active: boolean;
    clientX: number;
    clientY: number;
    moved: boolean;
  }>({ active: false, clientX: 0, clientY: 0, moved: false });

  const handleViewportTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      dragStateRef.current.active = false;
      setIsDraggingCards(false);
      edgeDragRef.current.active = false;
      marqueeRef.current.active = false;
      panDragRef.current.active = false;
      tapCandidateRef.current.active = false;
      cancelHoldTimer();

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midPt = getViewportLocalPoint(
        (t1.clientX + t2.clientX) / 2,
        (t1.clientY + t2.clientY) / 2
      );
      const vt = viewTransformRef.current;

      pinchRef.current = {
        active: true,
        startDist: Math.max(10, dist),
        startZoom: vt.zoom,
        midX: midPt.x,
        midY: midPt.y,
        startPanX: vt.panX,
        startPanY: vt.panY,
      };
      return;
    }

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const vt = viewTransformRef.current;
      // 1 jari di Mode Smart, mode Geser Kanvas, ATAU area kosong kanvas langsung menggeser kanvas dengan halus!
      if (
        studioWorkspaceMode === 'smart' ||
        isPanMode ||
        e.target === viewportRef.current ||
        e.target === boardRef.current ||
        (e.target as HTMLElement)?.dataset?.stageBg === 'true'
      ) {
        panDragRef.current = {
          active: true,
          startClientX: t.clientX,
          startClientY: t.clientY,
          startPanX: vt.panX,
          startPanY: vt.panY,
        };
        tapCandidateRef.current = {
          active: true,
          clientX: t.clientX,
          clientY: t.clientY,
          moved: false,
        };
      }
    }
  };

  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const vpPt = getViewportLocalPoint(e.clientX, e.clientY);
      const vt = viewTransformRef.current;
      const factor = e.deltaY < 0 ? 1.09 : 0.92;
      const nextZoom = Math.max(0.12, Math.min(2.6, +(vt.zoom * factor).toFixed(3)));
      const worldX = (vpPt.x - vt.panX) / vt.zoom;
      const worldY = (vpPt.y - vt.panY) / vt.zoom;
      const nextPanX = vpPt.x - worldX * nextZoom;
      const nextPanY = vpPt.y - worldY * nextZoom;
      commitStageTransform(nextPanX, nextPanY, nextZoom, false);
    }
  };

  const useSnapshotOverview =
    !isExportingPoster &&
    (renderQualityMode === 'snapshot' ||
      (renderQualityMode === 'auto' && nodes.length >= 35 && zoom < 0.42));
  const lodLite = nodes.length >= 25 && zoom < 0.55;

  // Mulai seret kotak seleksi (Marquee) atau Pan di area kanvas kosong (Mouse)
  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTimeRef.current < 500) return;

    setMoveUnlockedIds([]);
    setMoveAnchorId(null);
    setActiveEdgeIdx(null);

    const vt = viewTransformRef.current;
    if (studioWorkspaceMode === 'smart' || isPanMode || e.button === 1 || e.button === 2) {
      e.preventDefault();
      panDragRef.current = {
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: vt.panX,
        startPanY: vt.panY,
      };
      return;
    }

    if (e.button !== 0) return;

    const pt = getBoardPoint(e.clientX, e.clientY);

    // Jika sedang mode Hybrid Snapshot Overview, klik langsung memilih kartu di titik tersebut!
    if (useSnapshotOverview) {
      const hit = hitTestNodeAtBoardPoint(pt.x, pt.y);
      if (hit) {
        setSelectedIds((prev) =>
          e.shiftKey || isMultiSelectMode
            ? prev.includes(hit.id)
              ? prev.filter((x) => x !== hit.id)
              : [...prev, hit.id]
            : [hit.id]
        );
        return;
      }
    }

    marqueeRef.current = { active: true, startX: pt.x, startY: pt.y };
    setMarqueeBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
    if (!e.shiftKey && !isMultiSelectMode) {
      setSelectedIds([]);
    }
  };

  // Ref terbaru agar window event listener tidak pernah teardown/rebind saat zoom/drag!
  const interactionLatestRef = useRef({
    nodes,
    edges,
    snapToGrid,
    boardWidth,
    boardHeight,
    cardDisplayMode,
    photoFrameSize,
    cardScale,
    isMultiSelectMode,
    useSnapshotOverview,
    getViewportLocalPoint,
    getBoardPoint,
    commitStageTransform,
    cancelHoldTimer,
    stopNudgeRepeat,
    persistCurrentDesign,
    pushUndoSnapshot,
    hitTestNodeAtBoardPoint,
  });
  interactionLatestRef.current = {
    nodes,
    edges,
    snapToGrid,
    boardWidth,
    boardHeight,
    cardDisplayMode,
    photoFrameSize,
    cardScale,
    isMultiSelectMode,
    useSnapshotOverview,
    getViewportLocalPoint,
    getBoardPoint,
    commitStageTransform,
    cancelHoldTimer,
    stopNudgeRepeat,
    persistCurrentDesign,
    pushUndoSnapshot,
    hitTestNodeAtBoardPoint,
  };

  const dragFrameRafRef = useRef<number | null>(null);

  useEffect(() => {
    const updateDragRubberOverlay = (
      movingSet: Set<string>,
      dxById: Map<string, { dx: number; dy: number }>
    ) => {
      const svg = dragRubberSvgRef.current;
      if (!svg) return;
      const latest = interactionLatestRef.current;
      const nMap = new Map(latest.nodes.map((n) => [n.id, n]));
      let html = '';
      latest.edges.forEach((ed) => {
        if (!movingSet.has(ed.from) && !movingSet.has(ed.to)) return;
        const n1 = nMap.get(ed.from);
        const n2 = nMap.get(ed.to);
        if (!n1 || !n2) return;
        const s1 = getNodeSize(
          n1,
          latest.cardDisplayMode,
          latest.photoFrameSize,
          latest.cardScale
        );
        const s2 = getNodeSize(
          n2,
          latest.cardDisplayMode,
          latest.photoFrameSize,
          latest.cardScale
        );
        const d1 = dxById.get(n1.id) || { dx: 0, dy: 0 };
        const d2 = dxById.get(n2.id) || { dx: 0, dy: 0 };
        const x1 = n1.x + d1.dx + s1.w / 2;
        const y1 = n1.y + d1.dy + s1.h / 2;
        const x2 = n2.x + d2.dx + s2.w / 2;
        const y2 = n2.y + d2.dy + s2.h / 2;
        const col = ed.type === 'couple' ? '#f59e0b' : '#38bdf8';
        html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="2" stroke-dasharray="5,4" stroke-opacity="0.85" />`;
      });
      svg.innerHTML = html;
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const latest = interactionLatestRef.current;

      // 0A. Pinch-to-Zoom 2 Jari (GPU 0 React re-render!)
      if ('touches' in e && e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        dragStateRef.current.active = false;
        edgeDragRef.current.active = false;
        marqueeRef.current.active = false;
        panDragRef.current.active = false;
        tapCandidateRef.current.active = false;
        latest.cancelHoldTimer();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currDist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY
        );
        const currMid = latest.getViewportLocalPoint(
          (t1.clientX + t2.clientX) / 2,
          (t1.clientY + t2.clientY) / 2
        );

        if (!pinchRef.current.active) {
          const vt = viewTransformRef.current;
          pinchRef.current = {
            active: true,
            startDist: Math.max(10, currDist),
            startZoom: vt.zoom,
            midX: currMid.x,
            midY: currMid.y,
            startPanX: vt.panX,
            startPanY: vt.panY,
          };
          return;
        }

        const { startDist, startZoom, midX, midY, startPanX, startPanY } =
          pinchRef.current;
        const scaleRatio = currDist / startDist;
        const nextZoom = Math.max(
          0.12,
          Math.min(2.6, startZoom * scaleRatio)
        );
        const worldX = (midX - startPanX) / startZoom;
        const worldY = (midY - startPanY) / startZoom;
        const nextPanX = currMid.x - worldX * nextZoom;
        const nextPanY = currMid.y - worldY * nextZoom;

        latest.commitStageTransform(nextPanX, nextPanY, nextZoom, false);
        return;
      }

      // 0B. Geser Kanvas (GPU Pan 0 React re-render!)
      if (panDragRef.current.active) {
        if (e.cancelable) e.preventDefault();
        const clientX =
          'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY =
          'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const startPt = latest.getViewportLocalPoint(
          panDragRef.current.startClientX,
          panDragRef.current.startClientY
        );
        const currPt = latest.getViewportLocalPoint(clientX, clientY);
        const dx = currPt.x - startPt.x;
        const dy = currPt.y - startPt.y;
        if (tapCandidateRef.current.active && Math.hypot(dx, dy) > 8) {
          tapCandidateRef.current.moved = true;
        }
        const nextPanX = panDragRef.current.startPanX + dx;
        const nextPanY = panDragRef.current.startPanY + dy;
        latest.commitStageTransform(
          nextPanX,
          nextPanY,
          viewTransformRef.current.zoom,
          false
        );
        return;
      }

      // Batalkan timer hold 2 detik jika pengguna menggeser jari > 12px
      if (holdTimerRef.current.active) {
        const cx =
          'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const cy =
          'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        if (
          Math.hypot(
            cx - holdTimerRef.current.startClientX,
            cy - holdTimerRef.current.startClientY
          ) > 12
        ) {
          latest.cancelHoldTimer();
        }
      }

      const clientX =
        'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY =
        'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const currPt = latest.getBoardPoint(clientX, clientY);

      // 1A. Geser Titik Dot Jalur Garis
      if (edgeDragRef.current.active) {
        if (e.cancelable) e.preventDefault();
        const {
          edgeIdx,
          startPointerX,
          startPointerY,
          initOffsetX,
          initOffsetY,
        } = edgeDragRef.current;
        const nextOx = Math.round(initOffsetX + (currPt.x - startPointerX));
        const nextOy = Math.round(initOffsetY + (currPt.y - startPointerY));
        setEdges((prev) =>
          prev.map((ed, idx) =>
            idx === edgeIdx ? { ...ed, offsetX: nextOx, offsetY: nextOy } : ed
          )
        );
        return;
      }

      // 1B. Direct-DOM GPU Dragging Kartu / Group (0 setNodes per frame!)
      if (dragStateRef.current.active) {
        if (e.cancelable) e.preventDefault();
        const {
          movingIds,
          startPointerX,
          startPointerY,
          initialPositions,
        } = dragStateRef.current;

        const rawDx = currPt.x - startPointerX;
        const rawDy = currPt.y - startPointerY;
        dragStateRef.current.lastDx = rawDx;
        dragStateRef.current.lastDy = rawDy;

        if (dragFrameRafRef.current !== null) return;
        dragFrameRafRef.current = window.requestAnimationFrame(() => {
          dragFrameRafRef.current = null;
          const ds = dragStateRef.current;
          if (!ds.active) return;
          const movingSet = new Set(movingIds);
          const dxById = new Map<string, { dx: number; dy: number }>();

          latest.nodes.forEach((n) => {
            if (!movingSet.has(n.id)) return;
            const orig = initialPositions[n.id];
            if (!orig) return;
            let nx = orig.x + ds.lastDx;
            let ny = orig.y + ds.lastDy;
            if (latest.snapToGrid) {
              nx = Math.round(nx / SNAP_SIZE) * SNAP_SIZE;
              ny = Math.round(ny / SNAP_SIZE) * SNAP_SIZE;
            }
            const size = getNodeSize(
              n,
              latest.cardDisplayMode,
              latest.photoFrameSize,
              latest.cardScale
            );
            nx = Math.max(0, Math.min(latest.boardWidth - size.w, nx));
            ny = Math.max(0, Math.min(latest.boardHeight - size.h, ny));
            const appliedDx = nx - orig.x;
            const appliedDy = ny - orig.y;
            dxById.set(n.id, { dx: appliedDx, dy: appliedDy });
            const el = nodeDomRefs.current.get(n.id);
            if (el) {
              el.style.transform = `translate3d(${appliedDx}px, ${appliedDy}px, 0)`;
            }
          });

          updateDragRubberOverlay(movingSet, dxById);
        });
        return;
      }

      // 2. Marquee Selection Rectangle
      if (marqueeRef.current.active) {
        const { startX, startY } = marqueeRef.current;
        const rx = Math.min(startX, currPt.x);
        const ry = Math.min(startY, currPt.y);
        const rw = Math.abs(currPt.x - startX);
        const rh = Math.abs(currPt.y - startY);
        setMarqueeBox({ x: rx, y: ry, w: rw, h: rh });
      }
    };

    const handleEnd = (e?: MouseEvent | TouchEvent) => {
      const latest = interactionLatestRef.current;

      if (pinchRef.current.active) {
        if (!e || !('touches' in e) || e.touches.length < 2) {
          pinchRef.current.active = false;
          setZoom(+viewTransformRef.current.zoom.toFixed(3));
        }
      }

      if (panDragRef.current.active) {
        panDragRef.current.active = false;
        if (tapCandidateRef.current.active && !tapCandidateRef.current.moved) {
          const pt = latest.getBoardPoint(
            tapCandidateRef.current.clientX,
            tapCandidateRef.current.clientY
          );
          if (latest.useSnapshotOverview) {
            const hit = latest.hitTestNodeAtBoardPoint(pt.x, pt.y);
            if (hit) {
              setSelectedIds([hit.id]);
            } else {
              setSelectedIds([]);
            }
          } else {
            setSelectedIds([]);
          }
          setMoveUnlockedIds([]);
          setMoveAnchorId(null);
          setActiveEdgeIdx(null);
        }
        tapCandidateRef.current.active = false;
      }

      latest.stopNudgeRepeat();

      if (holdTimerRef.current.active) {
        latest.cancelHoldTimer();
      }

      if (edgeDragRef.current.active) {
        edgeDragRef.current.active = false;
        const { edgeIdx, initOffsetX, initOffsetY, preDragEdges } =
          edgeDragRef.current;
        setEdges((currentEdges) => {
          const movedEdge = currentEdges[edgeIdx];
          if (
            movedEdge &&
            preDragEdges &&
            ((movedEdge.offsetX ?? 0) !== initOffsetX ||
              (movedEdge.offsetY ?? 0) !== initOffsetY)
          ) {
            latest.pushUndoSnapshot('Geser Jalur Garis', undefined, preDragEdges);
          }
          latest.persistCurrentDesign(latest.nodes, currentEdges);
          return currentEdges;
        });
      }

      if (dragStateRef.current.active) {
        dragStateRef.current.active = false;
        if (dragFrameRafRef.current !== null) {
          window.cancelAnimationFrame(dragFrameRafRef.current);
          dragFrameRafRef.current = null;
        }
        const {
          movingIds,
          initialPositions,
          lastDx,
          lastDy,
          preDragNodes,
        } = dragStateRef.current;

        // Bersihkan transform sementara di DOM & rubber-band SVG
        movingIds.forEach((mId) => {
          const el = nodeDomRefs.current.get(mId);
          if (el) el.style.transform = '';
        });
        if (dragRubberSvgRef.current) {
          dragRubberSvgRef.current.innerHTML = '';
        }
        setIsDraggingCards(false);

        const movingSet = new Set(movingIds);
        setNodes((currentNodes) => {
          let movedAny = false;
          const nextNodes = currentNodes.map((n) => {
            if (!movingSet.has(n.id)) return n;
            const orig = initialPositions[n.id];
            if (!orig) return n;
            let nx = orig.x + lastDx;
            let ny = orig.y + lastDy;
            if (latest.snapToGrid) {
              nx = Math.round(nx / SNAP_SIZE) * SNAP_SIZE;
              ny = Math.round(ny / SNAP_SIZE) * SNAP_SIZE;
            }
            const size = getNodeSize(
              n,
              latest.cardDisplayMode,
              latest.photoFrameSize,
              latest.cardScale
            );
            nx = Math.max(0, Math.min(latest.boardWidth - size.w, nx));
            ny = Math.max(0, Math.min(latest.boardHeight - size.h, ny));
            if (nx !== orig.x || ny !== orig.y) {
              movedAny = true;
            }
            return { ...n, x: nx, y: ny };
          });

          if (movedAny && preDragNodes) {
            latest.pushUndoSnapshot('Geser Kartu', preDragNodes);
          }
          latest.persistCurrentDesign(nextNodes, latest.edges);
          return nextNodes;
        });
      }

      if (marqueeRef.current.active) {
        marqueeRef.current.active = false;
        setMarqueeBox((box) => {
          if (box && (box.w > 12 || box.h > 12)) {
            const insideIds = latest.nodes
              .filter((n) => {
                const s = getNodeSize(
                  n,
                  latest.cardDisplayMode,
                  latest.photoFrameSize,
                  latest.cardScale
                );
                const overlapX = n.x < box.x + box.w && n.x + s.w > box.x;
                const overlapY = n.y < box.y + box.h && n.y + s.h > box.y;
                return overlapX && overlapY;
              })
              .map((n) => n.id);

            if (insideIds.length > 0) {
              setSelectedIds((prev) =>
                latest.isMultiSelectMode
                  ? Array.from(new Set([...prev, ...insideIds]))
                  : insideIds
              );
            }
          }
          return null;
        });
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
      if (dragFrameRafRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRafRef.current);
      }
    };
  }, []);

  // Tambah kartu baru
  const addNewNode = () => {
    pushUndoSnapshot('Tambah Kartu');
    const id = 'n_' + Date.now();
    const newNode: InteractiveNode = {
      id,
      name: 'Anggota Baru',
      sub: 'Ket. Tahun / Kota',
      x: 180 + Math.round(Math.random() * 180),
      y: 180 + Math.round(Math.random() * 160),
      photo: '',
      wafat: false,
    };
    const nextNodes = [...nodes, newNode];
    setNodes(nextNodes);
    setSelectedIds([id]);
    setLayoutMode('manual');
    setStudioWorkspaceMode('edit');
    setPanelTab('edit');
    setIsPanelOpen(true);
    persistCurrentDesign(nextNodes, edges);
    showNotification('Kartu baru ditambahkan ke kanvas!');
  };

  const startConnectMode = () => {
    if (selectedIds.length === 0) {
      showNotification('Klik dulu 1 kartu awal yang mau dihubungkan!');
      return;
    }
    if (connectFromId) {
      setConnectFromId(null);
      return;
    }
    setConnectFromId(selectedIds[0]);
    showNotification('Sekarang klik kartu tujuan untuk menyambung garis!');
  };

  const primarySelectedNode = useMemo(
    () =>
      selectedIds.length === 1
        ? nodes.find((n) => n.id === selectedIds[0]) || null
        : null,
    [nodes, selectedIds]
  );

  const updateSelectedField = (patch: Partial<InteractiveNode>) => {
    if (selectedIds.length === 0) return;
    const now = Date.now();
    if (now - lastEditUndoTimeRef.current > 800) {
      pushUndoSnapshot('Edit Kartu');
      lastEditUndoTimeRef.current = now;
    }
    const selSet = new Set(selectedIds);
    const syncedMemberIds: string[] = [];
    const syncedSpouseTargets: Array<{ memberId: string; spouseIndex: number }> = [];
    const linkedSpouseUpdates = new Map<string, 'L' | 'P'>();
    if (patch.gender) {
      edges.forEach((e) => {
        if (e.type !== 'couple') return;
        if (selSet.has(e.from) && !selSet.has(e.to)) {
          linkedSpouseUpdates.set(e.to, patch.gender === 'L' ? 'P' : 'L');
        } else if (selSet.has(e.to) && !selSet.has(e.from)) {
          linkedSpouseUpdates.set(e.from, patch.gender === 'L' ? 'P' : 'L');
        }
      });
    }

    const nextNodes = nodes.map((n) => {
      if (selSet.has(n.id)) {
        if (n.memberId) {
          syncedMemberIds.push(n.memberId);
        } else {
          const spMatch = n.id.match(/^(?:n|node)_(.+)_sp_(\d+)$/);
          if (spMatch) {
            const rawIdx = Number(spMatch[2]);
            const spouseIndex = n.id.startsWith('n_') ? rawIdx - 1 : rawIdx;
            if (spouseIndex >= 0) {
              syncedSpouseTargets.push({ memberId: spMatch[1], spouseIndex });
            }
          }
        }
        return { ...n, ...patch };
      }
      if (!n.memberId && linkedSpouseUpdates.has(n.id)) {
        return { ...n, gender: linkedSpouseUpdates.get(n.id) };
      }
      return n;
    });
    setNodes(nextNodes);
    persistCurrentDesign(nextNodes, edges);

    if (
      onSyncMember &&
      syncedMemberIds.length > 0 &&
      (patch.name !== undefined ||
        patch.gender !== undefined ||
        patch.wafat !== undefined ||
        patch.photo !== undefined)
    ) {
      const memberPatch: {
        name?: string;
        gender?: 'L' | 'P';
        isDeceased?: boolean;
        photoUrl?: string;
      } = {};
      if (patch.name !== undefined) memberPatch.name = patch.name;
      if (patch.gender !== undefined) memberPatch.gender = patch.gender;
      if (patch.wafat !== undefined) memberPatch.isDeceased = patch.wafat;
      if (patch.photo !== undefined) memberPatch.photoUrl = patch.photo;
      syncedMemberIds.forEach((mId) => onSyncMember(mId, memberPatch));
    }

    if (onSyncMember && syncedSpouseTargets.length > 0 && patch.photo !== undefined) {
      syncedSpouseTargets.forEach((spTarget) =>
        onSyncMember(spTarget.memberId, {
          spouseIndex: spTarget.spouseIndex,
          spousePhotoUrl: patch.photo,
        })
      );
    }
  };

  const handleToggleMergedMemberGender = (mergedNodeId: string, mmIndex: number) => {
    pushUndoSnapshot('Ubah Gender Anggota Gabungan');
    let syncedMemberId: string | undefined;
    let nextGender: 'L' | 'P' = 'L';
    const nextNodes = nodes.map((n) => {
      if (n.id !== mergedNodeId || !n.mergedMembers) return n;
      const updatedMerged = n.mergedMembers.map((mm, idx) => {
        if (idx !== mmIndex) return mm;
        nextGender = mm.gender === 'P' ? 'L' : 'P';
        syncedMemberId = mm.memberId;
        return { ...mm, gender: nextGender };
      });
      return { ...n, mergedMembers: updatedMerged };
    });
    setNodes(nextNodes);
    persistCurrentDesign(nextNodes, edges);
    if (syncedMemberId && onSyncMember) {
      onSyncMember(syncedMemberId, { gender: nextGender });
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !primarySelectedNode) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Pilih file gambar (JPG, PNG, WebP)!');
      return;
    }
    setPendingCropFile(file);
  };

  const removeConnectionsOfSelected = () => {
    if (selectedIds.length === 0) return;
    pushUndoSnapshot('Putus Garis');
    const selSet = new Set(selectedIds);
    const nextEdges = edges.filter(
      (e) => !selSet.has(e.from) && !selSet.has(e.to)
    );
    setEdges(nextEdges);
    persistCurrentDesign(nodes, nextEdges);
    showNotification('Garis pada kartu terpilih diputus.');
  };

  const deleteSelectedNodes = () => {
    if (selectedIds.length === 0) return;
    pushUndoSnapshot('Hapus Kartu');
    const selSet = new Set(selectedIds);
    const nextNodes = nodes.filter((n) => !selSet.has(n.id));
    const nextEdges = edges.filter(
      (e) => !selSet.has(e.from) && !selSet.has(e.to)
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedIds([]);
    persistCurrentDesign(nextNodes, nextEdges);
    showNotification(`${selSet.size} kartu dihapus.`);
  };

  const nodeMap = useMemo(() => {
    const m = new Map<string, InteractiveNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const registerNodeEl = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) {
        nodeDomRefs.current.set(id, el);
      } else {
        nodeDomRefs.current.delete(id);
      }
    },
    []
  );

  const stableHandlersRef = useRef({
    startNodeInteraction,
  });
  stableHandlersRef.current = {
    startNodeInteraction,
  };

  const stableStartCardInteraction = useCallback(
    (e: React.MouseEvent | React.TouchEvent, id: string) => {
      stableHandlersRef.current.startNodeInteraction(e, id);
    },
    []
  );

  // Peta urutan lahir anak (Kakak rank kecil -> Adik rank besar) agar panah Adik -> Kakak selalu akurat
  const memberBirthRankMap = useMemo(() => {
    const rank = new Map<string, number>();
    const byParent = new Map<string, FamilyMember[]>();
    windowedMembers.forEach((m) => {
      const pid = m.parentId || '__root__';
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(m);
    });
    byParent.forEach((list) => {
      const sorted = [...list].sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
      );
      sorted.forEach((m, i) => rank.set(m.id, i));
    });
    return rank;
  }, [windowedMembers]);

  // Memoized Rute Garis Silsilah (mendukung Rantai Saudara Terdekat, Batang Pohon 20->1px, & Panah Arah)
  const computedEdges = useMemo<ComputedCanvasEdgeItem[]>(() => {
    // Dipisah Tegas: Mode Pohon Besar menggunakan Kerangka Kayu 2-Lapis (Batang->Dahan->Ranting) tanpa garis dobel
    if (lineStyle === 'none' || activePresetId === 'pohon_hayat_besar') return [];
    const obstacleBoxes: NodeObstacleBox[] = nodes.map((n) => {
      const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
      return { id: n.id, x: n.x, y: n.y, w: sz.w, h: sz.h };
    });

    const isHoneycombPreset =
      activePresetId === 'sarang_lebah_turun' ||
      activePresetId === 'sarang_lebah_pusat' ||
      activePresetId === 'molekul_organik';
    const isLotusPondPreset = activePresetId === 'teratai_mekar';
    const sourceEdgesForPreset = isLotusPondPreset
      ? edges.filter((e) => {
          if (e.type === 'couple') return false;
          const fn = nodeMap.get(e.from);
          const tn = nodeMap.get(e.to);
          if (!fn || !tn) return false;
          // Di Kolam Teratai: garis konektor HANYA antar pusat bunga (G1 -> G2 -> G3).
          return (fn.genLevel ?? 0) <= 1 && (tn.genLevel ?? 0) <= 2;
        })
      : edges;
    const displayEdges = buildDisplayEdgesWithSiblingChain(
      nodes,
      sourceEdgesForPreset,
      lineRoutingTopology,
      cardDisplayMode,
      photoFrameSize,
      cardScale,
      false,
      isHoneycombPreset
    );

    const taperScale = Math.max(0.45, Math.min(1.05, cardScale));
    const TREE_GEN_WIDTHS = [50, 45, 40, 30, 20].map(
      (w) => Math.round(w * taperScale * 10) / 10
    );

    const sampleRoutePts = (
      dStr: string
    ): Array<{ x: number; y: number }> => {
      const cubicMatch = dStr.match(
        /^M\s*([-\d.]+)\s+([-\d.]+)\s+C\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+)/
      );
      if (cubicMatch) {
        const x0 = parseFloat(cubicMatch[1]);
        const y0 = parseFloat(cubicMatch[2]);
        const c1x = parseFloat(cubicMatch[3]);
        const c1y = parseFloat(cubicMatch[4]);
        const c2x = parseFloat(cubicMatch[5]);
        const c2y = parseFloat(cubicMatch[6]);
        const x3 = parseFloat(cubicMatch[7]);
        const y3 = parseFloat(cubicMatch[8]);
        const ptsOut: Array<{ x: number; y: number }> = [];
        const steps = 14;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const mt = 1 - t;
          const px =
            mt * mt * mt * x0 +
            3 * mt * mt * t * c1x +
            3 * mt * t * t * c2x +
            t * t * t * x3;
          const py =
            mt * mt * mt * y0 +
            3 * mt * mt * t * c1y +
            3 * mt * t * t * c2y +
            t * t * t * y3;
          ptsOut.push({ x: px, y: py });
        }
        return ptsOut;
      }

      const quadMatch = dStr.match(
        /^M\s*([-\d.]+)\s+([-\d.]+)\s+Q\s*([-\d.]+)\s+([-\d.]+),\s*([-\d.]+)\s+([-\d.]+)/
      );
      if (quadMatch) {
        const x0 = parseFloat(quadMatch[1]);
        const y0 = parseFloat(quadMatch[2]);
        const cx = parseFloat(quadMatch[3]);
        const cy = parseFloat(quadMatch[4]);
        const x2 = parseFloat(quadMatch[5]);
        const y2 = parseFloat(quadMatch[6]);
        const ptsOut: Array<{ x: number; y: number }> = [];
        const steps = 12;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const mt = 1 - t;
          ptsOut.push({
            x: mt * mt * x0 + 2 * mt * t * cx + t * t * x2,
            y: mt * mt * y0 + 2 * mt * t * cy + t * t * y2,
          });
        }
        return ptsOut;
      }

      const nums = dStr.match(/-?\d+(?:\.\d+)?/g);
      const ptsOut: Array<{ x: number; y: number }> = [];
      if (nums && nums.length >= 4) {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          ptsOut.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
        }
      }
      return ptsOut;
    };

    const buildTaperedBranchPath = (
      routePts: Array<{ x: number; y: number }>,
      startW: number,
      endW: number
    ): string | undefined => {
      if (routePts.length < 2) return undefined;
      const leftPts: string[] = [];
      const rightPts: string[] = [];
      const total = routePts.length - 1;
      for (let i = 0; i <= total; i++) {
        const t = i / Math.max(1, total);
        const hw = (startW + (endW - startW) * t) / 2;
        const prev = routePts[Math.max(0, i - 1)];
        const next = routePts[Math.min(total, i + 1)];
        let tx = next.x - prev.x;
        let ty = next.y - prev.y;
        const len = Math.hypot(tx, ty);
        if (len < 1e-4) {
          tx = 0;
          ty = 1;
        } else {
          tx /= len;
          ty /= len;
        }
        const nx = -ty;
        const ny = tx;
        const p = routePts[i];
        leftPts.push(
          `${Math.round((p.x + nx * hw) * 10) / 10} ${
            Math.round((p.y + ny * hw) * 10) / 10
          }`
        );
        rightPts.unshift(
          `${Math.round((p.x - nx * hw) * 10) / 10} ${
            Math.round((p.y - ny * hw) * 10) / 10
          }`
        );
      }
      return `M ${leftPts[0]} ${leftPts
        .slice(1)
        .map((pt) => `L ${pt}`)
        .join(' ')} ${rightPts.map((pt) => `L ${pt}`).join(' ')} Z`;
    };

    return displayEdges
      .map(({ origIdx, edge, edgeKind }) => {
        const n1 = nodeMap.get(edge.from);
        const n2 = nodeMap.get(edge.to);
        if (!n1 || !n2) return null;

        let pts = getSmartPorts(
          n1,
          n2,
          edgeKind,
          cardDisplayMode,
          photoFrameSize,
          cardScale,
          edge.fromPort,
          edge.toPort,
          edgeKind === 'sibling' ? obstacleBoxes : undefined
        );

        const isLotusPreset = activePresetId === 'teratai_mekar';
        // Mode Sarang Lebah & Teratai: jalur langsung pusat-ke-pusat menempel tepi segi-enam/bunga
        if (
          (isHoneycombPreset || isLotusPreset) &&
          (!edge.fromPort || edge.fromPort === 'auto') &&
          (!edge.toPort || edge.toPort === 'auto')
        ) {
          const s1 = getNodeSize(n1, cardDisplayMode, photoFrameSize, cardScale);
          const s2 = getNodeSize(n2, cardDisplayMode, photoFrameSize, cardScale);
          const c1x = n1.x + s1.w / 2;
          const c1y = n1.y + s1.h / 2;
          const c2x = n2.x + s2.w / 2;
          const c2y = n2.y + s2.h / 2;
          const vx = c2x - c1x;
          const vy = c2y - c1y;
          const len = Math.hypot(vx, vy);
          if (len > 4) {
            const clipOrganicEdge = (
              cx: number,
              cy: number,
              w: number,
              h: number,
              dx: number,
              dy: number
            ) => {
              if (isLotusPreset) {
                const rx = Math.max(8, w * 0.45);
                const ry = Math.max(8, h * 0.45);
                const denom = Math.hypot(dx / rx, dy / ry) || 1;
                return {
                  x: Math.round((cx + dx / denom) * 10) / 10,
                  y: Math.round((cy + dy / denom) * 10) / 10,
                };
              }
              const hw = w * 0.49 + 1;
              const hh = h * 0.49 + 1;
              const tx = Math.abs(dx) > 1e-4 ? hw / Math.abs(dx) : Infinity;
              const ty = Math.abs(dy) > 1e-4 ? hh / Math.abs(dy) : Infinity;
              const t = Math.min(tx, ty);
              return {
                x: Math.round((cx + dx * t) * 10) / 10,
                y: Math.round((cy + dy * t) * 10) / 10,
              };
            };
            const ux = vx / len;
            const uy = vy / len;
            const aPt = clipOrganicEdge(c1x, c1y, s1.w, s1.h, ux, uy);
            const bPt = clipOrganicEdge(c2x, c2y, s2.w, s2.h, -ux, -uy);
            const absX = Math.abs(vx);
            const absY = Math.abs(vy);
            pts = {
              a: aPt,
              b: bPt,
              dir1: absX >= absY ? (vx >= 0 ? 'right' : 'left') : vy >= 0 ? 'bottom' : 'top',
              dir2: absX >= absY ? (vx >= 0 ? 'left' : 'right') : vy >= 0 ? 'top' : 'bottom',
            };
          }
        }

        const route = buildConnectorRoute(
          pts,
          lineStyle,
          edge,
          obstacleBoxes
        );
        const g1Style = getGenGradientStyle(
          genGradientPalette,
          n1.genLevel ?? 0
        );
        const g2Style = getGenGradientStyle(
          genGradientPalette,
          n2.genLevel ?? (n1.genLevel ?? 0) + 1
        );
        const resolvedChildColor =
          childLineColor ||
          g1Style?.line ||
          (theme === 'dark' || bgStyle !== '' ? '#38bdf8' : '#0284c7');
        const resolvedCoupleColor = coupleLineColor || '#f59e0b';
        const resolvedSiblingColor =
          siblingLineColor ||
          (theme === 'dark' || bgStyle !== '' ? '#a78bfa' : '#7c3aed');
        const lineColor =
          edgeKind === 'couple'
            ? resolvedCoupleColor
            : edgeKind === 'sibling'
            ? resolvedSiblingColor
            : resolvedChildColor;
        const canUseGrad =
          edgeKind === 'child' &&
          genGradientPalette !== 'none' &&
          !childLineColor &&
          !!g1Style &&
          !!g2Style &&
          (Math.abs(pts.a.x - pts.b.x) > 1 ||
            Math.abs(pts.a.y - pts.b.y) > 1);
        const gradId = `edge-grad-${origIdx}`;

        // Ketebalan garis bertingkat ala Batang Pohon (50 -> 45 -> 40 -> 30 -> 20px) vs seragam / Molekul
        const g1Idx = Math.max(0, Math.min(4, Math.floor(n1.genLevel ?? 0)));
        const g2Idx = Math.max(
          0,
          Math.min(4, Math.floor(n2.genLevel ?? g1Idx + 1))
        );
        const MOL_BOND_WIDTHS = [3.8, 3.1, 2.5, 2.0, 1.6];
        let startW =
          isHoneycombPreset && lineThicknessMode === 'uniform'
            ? edgeKind === 'couple'
              ? 2.8
              : edgeKind === 'sibling'
              ? Math.max(1.5, MOL_BOND_WIDTHS[g2Idx] * 0.88)
              : MOL_BOND_WIDTHS[g1Idx]
            : edgeKind === 'sibling'
            ? Math.max(1.3, lineThickness * 0.85)
            : lineThickness;
        let endW =
          isHoneycombPreset && lineThicknessMode === 'uniform' && edgeKind === 'child'
            ? MOL_BOND_WIDTHS[g2Idx]
            : startW;

        if (lineThicknessMode === 'tree_taper' && edgeKind !== 'couple') {
          if (edgeKind === 'child') {
            startW = TREE_GEN_WIDTHS[g1Idx];
            endW = TREE_GEN_WIDTHS[g2Idx];
          } else {
            // G2 berantai naik (45px) dan G4 berantai kanan/kiri (30px) tetap proporsional sebagai dahan/ranting
            const sibRatio = g2Idx <= 1 ? 0.88 : 0.68;
            const sibW = Math.max(
              2,
              Math.round(TREE_GEN_WIDTHS[g2Idx] * sibRatio * 10) / 10
            );
            startW = sibW;
            endW = sibW;
          }
        }
        if (activePresetId === 'teratai_mekar') {
          startW = Math.min(startW, 1.5);
          endW = Math.min(endW, 1.5);
        }
        const avgStrokeWidth = Math.round(((startW + endW) / 2) * 10) / 10;

        const routePts =
          (lineThicknessMode === 'tree_taper' && edgeKind === 'child') ||
          (showLineArrows && edgeKind !== 'couple')
            ? sampleRoutePts(route.d)
            : [];

        const taperedPathD =
          lineThicknessMode === 'tree_taper' &&
          edgeKind === 'child' &&
          Math.abs(startW - endW) >= 0.5 &&
          routePts.length >= 2
            ? buildTaperedBranchPath(routePts, startW, endW)
            : undefined;

        // Panah Arah: Ortu -> Anak (di ujung anak) & Adik -> Kakak (di ujung kakak sesuai orderIndex)
        let arrowMeta: ComputedCanvasEdgeItem['arrowMeta'] = undefined;
        if (showLineArrows && edgeKind !== 'couple' && routePts.length >= 2) {
          let pointToEnd = true;
          if (edgeKind === 'sibling') {
            const rFrom = n1.memberId
              ? memberBirthRankMap.get(n1.memberId) ?? 0
              : 0;
            const rTo = n2.memberId
              ? memberBirthRankMap.get(n2.memberId) ?? 0
              : 0;
            pointToEnd = rTo <= rFrom;
          }
          const tipPt = pointToEnd
            ? routePts[routePts.length - 1]
            : routePts[0];
          const prevPt = pointToEnd
            ? routePts[routePts.length - 2]
            : routePts[1];
          let vx = tipPt.x - prevPt.x;
          let vy = tipPt.y - prevPt.y;
          if (Math.hypot(vx, vy) < 0.5) {
            const side = pointToEnd ? pts.dir2 : pts.dir1;
            vx = side === 'left' ? 1 : side === 'right' ? -1 : 0;
            vy = side === 'top' ? 1 : side === 'bottom' ? -1 : 0;
          }
          const angleRad = Math.atan2(vy, vx);
          const tipW = pointToEnd ? endW : startW;
          const arrowSize =
            lineThicknessMode === 'tree_taper'
              ? Math.max(7, Math.min(24, Math.round((tipW * 0.48 + 5) * 10) / 10))
              : Math.max(6.5, Math.min(12, Math.round((tipW * 1.6 + 3) * 10) / 10));
          const baseArrowColor =
            edgeKind === 'sibling'
              ? resolvedSiblingColor
              : canUseGrad
              ? pointToEnd
                ? g2Style?.line || lineColor
                : g1Style?.line || lineColor
              : lineColor;
          const arrowColor =
            lineThicknessMode === 'tree_taper' && tipW >= 16
              ? edgeKind === 'sibling'
                ? '#fde047'
                : '#bef264'
              : baseArrowColor;
          arrowMeta = {
            tipX: tipPt.x,
            tipY: tipPt.y,
            angleRad,
            size: arrowSize,
            color: arrowColor,
            kind: edgeKind,
          };
        }

        return {
          idx: origIdx,
          edge,
          pts,
          route,
          edgeKind,
          strokeWidth: avgStrokeWidth,
          taperedPathD,
          arrowMeta,
          lineColor,
          gradFrom: g1Style?.line || lineColor,
          gradTo: g2Style?.line || lineColor,
          canUseGrad,
          gradId,
        };
      })
      .filter(Boolean) as ComputedCanvasEdgeItem[];
  }, [
    nodes,
    edges,
    nodeMap,
    memberBirthRankMap,
    activePresetId,
    lineStyle,
    lineRoutingTopology,
    lineThicknessMode,
    showLineArrows,
    lineThickness,
    cardDisplayMode,
    photoFrameSize,
    cardScale,
    genGradientPalette,
    childLineColor,
    coupleLineColor,
    siblingLineColor,
    theme,
    bgStyle,
  ]);

  // Pembatas Warna Celah Terhubung Sarang Lebah (Kisi Voronoi G1->G2->G3 & Sekat G4–G5)
  const lineageHullsMemo = useMemo<LineageHullItem[]>(() => {
    const isHive =
      activePresetId === 'sarang_lebah_turun' ||
      activePresetId === 'sarang_lebah_pusat' ||
      activePresetId === 'molekul_organik';
    if (
      !isHive &&
      activePresetId !== 'tetris_silsilah' &&
      !nodes.some((n) => n.lineageG2Id)
    )
      return [];

    const isDarkCanvas = theme === 'dark' || bgStyle !== '';
    const hexLatticeNodes = nodes.filter(
      (n) =>
        n.cardShape === 'hex' &&
        typeof n.hexCol === 'number' &&
        typeof n.hexRow === 'number'
    );

    if (isHive && hexLatticeNodes.length > 0) {
      const refNode = hexLatticeNodes[0];
      const refSz = getNodeSize(refNode, cardDisplayMode, photoFrameSize, cardScale);
      const hexW = refSz.w;
      const hexGap = refNode.hexGap ?? Math.max(8, Math.round(hexW * 0.14));
      const stepX = hexW + hexGap;
      const stepY = stepX * 0.8660254;
      const rx = stepX * 0.5;
      const ry = stepX / 1.7320508;

      const refCx = refNode.x + refSz.w / 2;
      const refCy = refNode.y + refSz.h / 2;
      const originX =
        refCx -
        (refNode.hexCol! * stepX + ((refNode.hexRow! & 1) !== 0 ? stepX * 0.5 : 0));
      const originY = refCy - refNode.hexRow! * stepY;

      const cellKey = (c: number, r: number) => `${c},${r}`;
      const vKey = (u: number, v: number) => `${u},${v}`;
      const vToPx = (u: number, v: number) => ({
        x: Math.round((originX + u * rx) * 10) / 10,
        y: Math.round((originY + v * (ry * 0.5)) * 10) / 10,
      });
      const getCellVerts = (c: number, r: number): Array<[number, number]> => {
        const u = 2 * c + (r & 1);
        const v = 3 * r;
        return [
          [u, v - 2],
          [u + 1, v - 1],
          [u + 1, v + 1],
          [u, v + 2],
          [u - 1, v + 1],
          [u - 1, v - 1],
        ];
      };
      const getNeighborCell = (
        c: number,
        r: number,
        edgeIdx: number
      ): [number, number] => {
        const odd = (r & 1) !== 0 ? 1 : 0;
        switch (edgeIdx) {
          case 0:
            return [c + odd, r - 1];
          case 1:
            return [c + 1, r];
          case 2:
            return [c + odd, r + 1];
          case 3:
            return [c - 1 + odd, r + 1];
          case 4:
            return [c - 1, r];
          default:
            return [c - 1 + odd, r - 1];
        }
      };

      const occupiedCellSet = new Set<string>();
      const cellToCoord = new Map<string, [number, number]>();
      let minC = Infinity;
      let maxC = -Infinity;
      let minR = Infinity;
      let maxR = -Infinity;

      const g1Cells = new Set<string>();
      const g2AnchorMap = new Map<string, { color: string; cells: Set<string> }>();
      const g2DescMap = new Map<string, { color: string; cells: Set<string> }>();
      const g3Map = new Map<
        string,
        { color: string; g2Id?: string; cells: Set<string> }
      >();
      const cellToG4Meta = new Map<
        string,
        {
          g4Id: string;
          color: string;
          cx: number;
          cy: number;
          verts: Array<{ x: number; y: number }>;
        }
      >();
      const g4Groups = new Map<
        string,
        { color: string; cells: Set<string> }
      >();

      const HEX_NORM_VERTS: ReadonlyArray<[number, number]> = [
        [60 / 120, 2 / 138],
        [117 / 120, 35.5 / 138],
        [117 / 120, 102.5 / 138],
        [60 / 120, 136 / 138],
        [3 / 120, 102.5 / 138],
        [3 / 120, 35.5 / 138],
      ];

      hexLatticeNodes.forEach((n) => {
        const c = n.hexCol!;
        const r = n.hexRow!;
        const ck = cellKey(c, r);
        occupiedCellSet.add(ck);
        cellToCoord.set(ck, [c, r]);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);

        const tier =
          n.hexTier ??
          ((n.genLevel ?? 0) <= 0
            ? 'g1'
            : (n.genLevel ?? 0) === 1
            ? 'g2'
            : (n.genLevel ?? 0) === 2
            ? 'g3'
            : 'g4plus');

        if (tier === 'g1') {
          g1Cells.add(ck);
        }
        if (tier === 'g2' && n.lineageG2Id && n.lineageG2Color) {
          if (!g2AnchorMap.has(n.lineageG2Id)) {
            g2AnchorMap.set(n.lineageG2Id, {
              color: n.lineageG2Color,
              cells: new Set(),
            });
          }
          g2AnchorMap.get(n.lineageG2Id)!.cells.add(ck);
        }
        if (
          (tier === 'g3' || tier === 'g4plus') &&
          n.lineageG2Id &&
          n.lineageG2Color
        ) {
          if (!g2DescMap.has(n.lineageG2Id)) {
            g2DescMap.set(n.lineageG2Id, {
              color: n.lineageG2Color,
              cells: new Set(),
            });
          }
          g2DescMap.get(n.lineageG2Id)!.cells.add(ck);
        }
        if (
          (tier === 'g3' || tier === 'g4plus') &&
          n.lineageG3Id &&
          n.lineageG3Color
        ) {
          if (!g3Map.has(n.lineageG3Id)) {
            g3Map.set(n.lineageG3Id, {
              color: n.lineageG3Color,
              g2Id: n.lineageG2Id,
              cells: new Set(),
            });
          }
          g3Map.get(n.lineageG3Id)!.cells.add(ck);
        }

        // Kelompok keluarga inti: pasangan G1/G2/G3 serta blok keluarga inti G4+pasangan+G5
        let nuclearFamId: string | null = null;
        let nuclearColor = '#0ea5e9';
        if (tier === 'g4plus' && n.lineageG4Id) {
          nuclearFamId = `g4:${n.lineageG4Id}`;
          nuclearColor =
            n.lineageG4Color || n.lineageG3Color || n.lineageG2Color || '#0ea5e9';
        } else if (tier === 'g3' && n.lineageG3Id) {
          nuclearFamId = `g3:${n.lineageG3Id}`;
          nuclearColor = n.lineageG3Color || n.lineageG2Color || '#0ea5e9';
        } else if (tier === 'g2' && n.lineageG2Id) {
          nuclearFamId = `g2:${n.lineageG2Id}`;
          nuclearColor = n.lineageG2Color || '#10b981';
        } else if (tier === 'g1') {
          nuclearFamId = 'g1:core';
          nuclearColor = '#f59e0b';
        }

        if (nuclearFamId) {
          const nSz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
          const verts = HEX_NORM_VERTS.map(([nx, ny]) => ({
            x: Math.round((n.x + nx * nSz.w) * 10) / 10,
            y: Math.round((n.y + ny * nSz.h) * 10) / 10,
          }));
          cellToG4Meta.set(ck, {
            g4Id: nuclearFamId,
            color: nuclearColor,
            cx: n.x + nSz.w / 2,
            cy: n.y + nSz.h / 2,
            verts,
          });
          if (!g4Groups.has(nuclearFamId)) {
            g4Groups.set(nuclearFamId, { color: nuclearColor, cells: new Set() });
          }
          g4Groups.get(nuclearFamId)!.cells.add(ck);
        }
      });

      const buildPerimeterFromCells = (
        cells: Set<string>,
        onlyIfNeighborOutsideOrDiff?: (ncKey: string) => boolean
      ): { d: string | null; verts: Set<string> } => {
        const adj = new Map<string, string[]>();
        const verts = new Set<string>();
        const vCoordMap = new Map<string, [number, number]>();

        cells.forEach((ck) => {
          const coord = cellToCoord.get(ck);
          if (!coord) return;
          const [c, r] = coord;
          const cv = getCellVerts(c, r);
          for (let k = 0; k < 6; k++) {
            const [nc, nr] = getNeighborCell(c, r, k);
            const nck = cellKey(nc, nr);
            const includeEdge = onlyIfNeighborOutsideOrDiff
              ? onlyIfNeighborOutsideOrDiff(nck)
              : !cells.has(nck);
            if (!includeEdge) continue;
            const [u1, v1] = cv[k];
            const [u2, v2] = cv[(k + 1) % 6];
            const k1 = vKey(u1, v1);
            const k2 = vKey(u2, v2);
            vCoordMap.set(k1, [u1, v1]);
            vCoordMap.set(k2, [u2, v2]);
            verts.add(k1);
            verts.add(k2);
            if (!adj.has(k1)) adj.set(k1, []);
            adj.get(k1)!.push(k2);
          }
        });

        const pathParts: string[] = [];
        adj.forEach((_, startKey) => {
          while ((adj.get(startKey)?.length || 0) > 0) {
            const chain: string[] = [startKey];
            let cur = startKey;
            let guard = 0;
            while (guard++ < 4000) {
              const list = adj.get(cur);
              if (!list || list.length === 0) break;
              const nxt = list.pop()!;
              chain.push(nxt);
              cur = nxt;
              if (cur === startKey) break;
            }
            if (chain.length >= 2) {
              const closed = chain[chain.length - 1] === chain[0];
              const pts = (closed ? chain.slice(0, -1) : chain).map((vk) => {
                const [u, v] = vCoordMap.get(vk)!;
                return vToPx(u, v);
              });
              if (pts.length >= 2) {
                pathParts.push(
                  `M ${pts[0].x} ${pts[0].y} ` +
                    pts
                      .slice(1)
                      .map((p) => `L ${p.x} ${p.y}`)
                      .join(' ') +
                    (closed ? ' Z' : '')
                );
              }
            }
          }
        });

        return {
          d: pathParts.length > 0 ? pathParts.join(' ') : null,
          verts,
        };
      };

      // Bangun graf celah Voronoi untuk menghubungkan warna pembatas melintasi ruang kosong G1 -> G2 -> G3
      const vorGraph = new Map<string, Array<{ to: string; cost: number }>>();
      const vorCoords = new Map<string, [number, number]>();
      const seenUndirEdge = new Set<string>();
      for (let r = minR - 2; r <= maxR + 2; r++) {
        for (let c = minC - 2; c <= maxC + 2; c++) {
          const cv = getCellVerts(c, r);
          const occA = occupiedCellSet.has(cellKey(c, r));
          for (let k = 0; k < 6; k++) {
            const [nc, nr] = getNeighborCell(c, r, k);
            const occB = occupiedCellSet.has(cellKey(nc, nr));
            const [u1, v1] = cv[k];
            const [u2, v2] = cv[(k + 1) % 6];
            const k1 = vKey(u1, v1);
            const k2 = vKey(u2, v2);
            const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
            if (seenUndirEdge.has(ek)) continue;
            seenUndirEdge.add(ek);
            vorCoords.set(k1, [u1, v1]);
            vorCoords.set(k2, [u2, v2]);
            const cost = !occA && !occB ? 1 : !occA || !occB ? 3 : 8;
            if (!vorGraph.has(k1)) vorGraph.set(k1, []);
            if (!vorGraph.has(k2)) vorGraph.set(k2, []);
            vorGraph.get(k1)!.push({ to: k2, cost });
            vorGraph.get(k2)!.push({ to: k1, cost });
          }
        }
      }

      const findVoronoiBridgePath = (
        srcVerts: Set<string>,
        dstVerts: Set<string>
      ): string | null => {
        if (srcVerts.size === 0 || dstVerts.size === 0) return null;
        for (const sv of srcVerts) {
          if (dstVerts.has(sv)) return null;
        }
        const dist = new Map<string, number>();
        const prev = new Map<string, string>();
        const queue: Array<{ k: string; d: number }> = [];
        srcVerts.forEach((sv) => {
          if (vorGraph.has(sv)) {
            dist.set(sv, 0);
            queue.push({ k: sv, d: 0 });
          }
        });

        let targetHit: string | null = null;
        let guard = 0;
        while (queue.length > 0 && guard++ < 6000) {
          let bestIdx = 0;
          for (let i = 1; i < queue.length; i++) {
            if (queue[i].d < queue[bestIdx].d) bestIdx = i;
          }
          const cur = queue.splice(bestIdx, 1)[0];
          if (cur.d > (dist.get(cur.k) ?? Infinity)) continue;
          if (dstVerts.has(cur.k)) {
            targetHit = cur.k;
            break;
          }
          const nbrs = vorGraph.get(cur.k);
          if (!nbrs) continue;
          for (const edge of nbrs) {
            const nd = cur.d + edge.cost;
            if (nd < (dist.get(edge.to) ?? Infinity)) {
              dist.set(edge.to, nd);
              prev.set(edge.to, cur.k);
              queue.push({ k: edge.to, d: nd });
            }
          }
        }

        if (!targetHit) return null;
        const revKeys: string[] = [];
        let trace: string | undefined = targetHit;
        while (trace) {
          revKeys.push(trace);
          if (srcVerts.has(trace)) break;
          trace = prev.get(trace);
        }
        if (revKeys.length < 2) return null;
        revKeys.reverse();
        const pts = revKeys.map((vk) => {
          const [u, v] = vorCoords.get(vk)!;
          return vToPx(u, v);
        });
        return (
          `M ${pts[0].x} ${pts[0].y} ` +
          pts
            .slice(1)
            .map((p) => `L ${p.x} ${p.y}`)
            .join(' ')
        );
      };

      const out: LineageHullItem[] = [];

      // 1. Pembatas luar cabang G2 melingkupi klaster G3–G5
      g2DescMap.forEach((entry, id) => {
        const res = buildPerimeterFromCells(entry.cells);
        if (!res.d) return;
        out.push({
          id: `hull-g2-desc-${id}`,
          d: res.d,
          fill: 'none',
          stroke: hexWithAlpha(entry.color, isDarkCanvas ? 0.84 : 0.78),
          strokeWidth: 3.4,
          level: 2,
        });
      });

      // 2. Pembatas kelompok G3 melingkupi G4 dan G5 di dalamnya
      const g3PerimMap = new Map<
        string,
        { verts: Set<string>; g2Id?: string; color: string }
      >();
      g3Map.forEach((entry, id) => {
        const res = buildPerimeterFromCells(entry.cells);
        g3PerimMap.set(id, {
          verts: res.verts,
          g2Id: entry.g2Id,
          color: entry.color,
        });
        if (!res.d) return;
        out.push({
          id: `hull-g3-${id}`,
          d: res.d,
          fill: 'none',
          stroke: hexWithAlpha(entry.color, isDarkCanvas ? 0.92 : 0.88),
          strokeWidth: 2.8,
          level: 3,
        });
      });

      // 3. Isi celah tebal menempel ke kartu di DALAM satu keluarga inti (sama g4Id):
      //    mengisi persegi panjang miring tepat di antara tepi dua kartu + segitiga simpul Y 3-arah,
      //    sedangkan celah antar keluarga inti berbeda tetap kosong polos!
      const g4FlushChannelByFamily = new Map<
        string,
        { color: string; parts: string[] }
      >();
      const vVertexMembers = new Map<
        string,
        Array<{ famId: string; color: string; ptIn: { x: number; y: number } }>
      >();
      const tuckPx = 2.4;

      cellToG4Meta.forEach((meta, ck) => {
        const coord = cellToCoord.get(ck);
        if (!coord) return;
        const [c, r] = coord;
        const cv = getCellVerts(c, r);

        for (let vi = 0; vi < 6; vi++) {
          const vk = vKey(cv[vi][0], cv[vi][1]);
          const pt = meta.verts[vi];
          const dxC = meta.cx - pt.x;
          const dyC = meta.cy - pt.y;
          const lenC = Math.hypot(dxC, dyC) || 1;
          const ptIn = {
            x: Math.round((pt.x + (dxC / lenC) * tuckPx) * 10) / 10,
            y: Math.round((pt.y + (dyC / lenC) * tuckPx) * 10) / 10,
          };
          if (!vVertexMembers.has(vk)) vVertexMembers.set(vk, []);
          vVertexMembers.get(vk)!.push({ famId: meta.g4Id, color: meta.color, ptIn });
        }

        for (let k = 0; k < 6; k++) {
          const [nc, nr] = getNeighborCell(c, r, k);
          const nck = cellKey(nc, nr);
          if (ck >= nck) continue;
          const nbrMeta = cellToG4Meta.get(nck);
          if (!nbrMeta || nbrMeta.g4Id !== meta.g4Id) continue;

          const a0 = meta.verts[k];
          const a1 = meta.verts[(k + 1) % 6];
          const b1 = nbrMeta.verts[(k + 3) % 6];
          const b0 = nbrMeta.verts[(k + 4) % 6];

          const edx = a1.x - a0.x;
          const edy = a1.y - a0.y;
          const elen = Math.hypot(edx, edy) || 1;
          const nx = edy / elen;
          const ny = -edx / elen;

          const pA0x = Math.round((a0.x - nx * tuckPx) * 10) / 10;
          const pA0y = Math.round((a0.y - ny * tuckPx) * 10) / 10;
          const pA1x = Math.round((a1.x - nx * tuckPx) * 10) / 10;
          const pA1y = Math.round((a1.y - ny * tuckPx) * 10) / 10;
          const pB1x = Math.round((b1.x + nx * tuckPx) * 10) / 10;
          const pB1y = Math.round((b1.y + ny * tuckPx) * 10) / 10;
          const pB0x = Math.round((b0.x + nx * tuckPx) * 10) / 10;
          const pB0y = Math.round((b0.y + ny * tuckPx) * 10) / 10;

          if (!g4FlushChannelByFamily.has(meta.g4Id)) {
            g4FlushChannelByFamily.set(meta.g4Id, {
              color: meta.color,
              parts: [],
            });
          }
          g4FlushChannelByFamily
            .get(meta.g4Id)!
            .parts.push(
              `M ${pA0x} ${pA0y} L ${pA1x} ${pA1y} L ${pB1x} ${pB1y} L ${pB0x} ${pB0y} Z`
            );
        }
      });

      // Isi simpul segitiga Y 3-arah jika 3 sel dalam satu keluarga inti bertemu di 1 simpul
      vVertexMembers.forEach((items) => {
        if (items.length !== 3) return;
        const famId = items[0].famId;
        if (!items.every((it) => it.famId === famId)) return;
        if (!g4FlushChannelByFamily.has(famId)) {
          g4FlushChannelByFamily.set(famId, {
            color: items[0].color,
            parts: [],
          });
        }
        g4FlushChannelByFamily
          .get(famId)!
          .parts.push(
            `M ${items[0].ptIn.x} ${items[0].ptIn.y} L ${items[1].ptIn.x} ${items[1].ptIn.y} L ${items[2].ptIn.x} ${items[2].ptIn.y} Z`
          );
      });

      g4FlushChannelByFamily.forEach((entry, famId) => {
        if (entry.parts.length === 0) return;
        const fillCol = hexWithAlpha(entry.color, isDarkCanvas ? 0.88 : 0.9);
        out.push({
          id: `hull-g4-intraseam-${famId}`,
          d: entry.parts.join(' '),
          fill: fillCol,
          stroke: fillCol,
          strokeWidth: 0.9,
          level: 4,
        });
      });

      // Jika keluarga inti G4–G5 punya >1 komponen terpisah (mis. ada 1 celah kosong di dalamnya),
      // hubungkan hanya antar komponen milik keluarga inti yang sama tanpa menyentuh keluarga lain
      g4Groups.forEach((grp, g4Id) => {
        if (!g4Id.startsWith('g4:')) return;
        if (grp.cells.size < 2) return;
        const unvisited = new Set(grp.cells);
        const components: Array<Set<string>> = [];
        while (unvisited.size > 0) {
          const seed = unvisited.values().next().value as string;
          const comp = new Set<string>([seed]);
          unvisited.delete(seed);
          const q = [seed];
          while (q.length > 0) {
            const cur = q.shift()!;
            const coord = cellToCoord.get(cur);
            if (!coord) continue;
            const [cc, cr] = coord;
            for (let k = 0; k < 6; k++) {
              const [nc, nr] = getNeighborCell(cc, cr, k);
              const nck = cellKey(nc, nr);
              if (unvisited.has(nck)) {
                unvisited.delete(nck);
                comp.add(nck);
                q.push(nck);
              }
            }
          }
          components.push(comp);
        }
        if (components.length > 1) {
          const baseVerts = buildPerimeterFromCells(components[0]).verts;
          for (let i = 1; i < components.length; i++) {
            const nextVerts = buildPerimeterFromCells(components[i]).verts;
            const intraBridge = findVoronoiBridgePath(baseVerts, nextVerts);
            if (intraBridge) {
              out.push({
                id: `hull-g4-intrabridge-${g4Id}-${i}`,
                d: intraBridge,
                fill: 'none',
                stroke: hexWithAlpha(grp.color, isDarkCanvas ? 0.82 : 0.84),
                strokeWidth: Math.max(8, Math.round(hexGap * 0.72)),
                level: 4,
              });
            }
          }
        }
      });

      // 4. Bingkai emas G1 dan pembatas G2 jangkar
      const g1Perim = buildPerimeterFromCells(g1Cells);
      if (g1Perim.d) {
        out.push({
          id: 'hull-g1-core',
          d: g1Perim.d,
          fill: 'none',
          stroke: hexWithAlpha('#f59e0b', 0.95),
          strokeWidth: 3.8,
          level: 1,
        });
      }

      const g2AnchorVertMap = new Map<string, Set<string>>();
      g2AnchorMap.forEach((entry, id) => {
        const res = buildPerimeterFromCells(entry.cells);
        g2AnchorVertMap.set(id, res.verts);
        if (res.d) {
          out.push({
            id: `hull-g2-anchor-${id}`,
            d: res.d,
            fill: 'none',
            stroke: hexWithAlpha(entry.color, 0.92),
            strokeWidth: 3.4,
            level: 2,
          });
        }
      });

      // 5. Jalur celah terhubung melintasi ruang kosong polos: G1 -> G2 dan G2 -> G3
      g2AnchorMap.forEach((entry, g2Id) => {
        const g2Verts = g2AnchorVertMap.get(g2Id);
        if (g1Perim.verts.size > 0 && g2Verts && g2Verts.size > 0) {
          const bridge12 = findVoronoiBridgePath(g1Perim.verts, g2Verts);
          if (bridge12) {
            out.push({
              id: `hull-bridge-g1-g2-${g2Id}`,
              d: bridge12,
              fill: 'none',
              stroke: hexWithAlpha(entry.color, isDarkCanvas ? 0.88 : 0.85),
              strokeWidth: 3.0,
              level: 2,
            });
          }
        }
      });

      g3PerimMap.forEach((g3Entry, g3Id) => {
        if (!g3Entry.g2Id) return;
        const g2Verts = g2AnchorVertMap.get(g3Entry.g2Id);
        if (!g2Verts || g2Verts.size === 0 || g3Entry.verts.size === 0) return;
        const bridge23 = findVoronoiBridgePath(g2Verts, g3Entry.verts);
        if (bridge23) {
          out.push({
            id: `hull-bridge-g2-g3-${g3Id}`,
            d: bridge23,
            fill: 'none',
            stroke: hexWithAlpha(g3Entry.color, isDarkCanvas ? 0.88 : 0.84),
            strokeWidth: 2.6,
            level: 3,
          });
        }
      });

      return out;
    }

    const buildSmoothHullPath = (
      groupNodes: InteractiveNode[],
      pad: number
    ): string | null => {
      if (groupNodes.length === 0) return null;
      const pts: Array<{ x: number; y: number }> = [];
      groupNodes.forEach((n) => {
        const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
        const cx = n.x + sz.w / 2;
        const cy = n.y + sz.h / 2;
        const hw = sz.w * 0.54 + pad;
        const hh = sz.h * 0.54 + pad;
        pts.push(
          { x: cx, y: cy - hh },
          { x: cx + hw, y: cy - hh * 0.52 },
          { x: cx + hw, y: cy + hh * 0.52 },
          { x: cx, y: cy + hh },
          { x: cx - hw, y: cy + hh * 0.52 },
          { x: cx - hw, y: cy - hh * 0.52 }
        );
      });
      if (pts.length < 3) return null;

      pts.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
      const cross = (
        o: { x: number; y: number },
        a: { x: number; y: number },
        b: { x: number; y: number }
      ) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

      const lower: Array<{ x: number; y: number }> = [];
      for (const p of pts) {
        while (
          lower.length >= 2 &&
          cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
        ) {
          lower.pop();
        }
        lower.push(p);
      }
      const upper: Array<{ x: number; y: number }> = [];
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        while (
          upper.length >= 2 &&
          cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
        ) {
          upper.pop();
        }
        upper.push(p);
      }
      const rawHull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
      const cleanHull: Array<{ x: number; y: number }> = [];
      rawHull.forEach((p) => {
        const prev = cleanHull[cleanHull.length - 1];
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 4) {
          cleanHull.push(p);
        }
      });
      if (cleanHull.length < 3) return null;

      const mids = cleanHull.map((p, i) => {
        const nxt = cleanHull[(i + 1) % cleanHull.length];
        return {
          x: Math.round(((p.x + nxt.x) / 2) * 10) / 10,
          y: Math.round(((p.y + nxt.y) / 2) * 10) / 10,
        };
      });
      const lastMid = mids[mids.length - 1];
      const segs = [`M ${lastMid.x} ${lastMid.y}`];
      cleanHull.forEach((p, i) => {
        segs.push(
          `Q ${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}, ${mids[i].x} ${mids[i].y}`
        );
      });
      segs.push('Z');
      return segs.join(' ');
    };

    if (activePresetId === 'tetris_silsilah') {
      const tetrisGroups = new Map<
        string,
        { borderColor: string; bgColor: string; items: InteractiveNode[] }
      >();
      nodes.forEach((n) => {
        if (!n.groupId) return;
        if (!tetrisGroups.has(n.groupId)) {
          tetrisGroups.set(n.groupId, {
            borderColor: n.customBorderColor || n.lineageG3Color || '#38bdf8',
            bgColor: n.customBgColor || '#e0f2fe',
            items: [],
          });
        }
        tetrisGroups.get(n.groupId)!.items.push(n);
      });

      const outTetris: LineageHullItem[] = [];
      tetrisGroups.forEach((grp, gid) => {
        if (grp.items.length < 2) return;
        const hasGridCoords = grp.items.every(
          (n) => typeof n.hexCol === 'number' && typeof n.hexRow === 'number'
        );
        if (!hasGridCoords) return;

        const first = grp.items[0];
        const sz = getNodeSize(first, cardDisplayMode, photoFrameSize, cardScale);
        const gap = first.hexGap ?? 2;
        const stepX = sz.w + gap;
        const stepY = sz.h + gap;
        const originX = first.x - (first.hexCol || 0) * stepX;
        const originY = first.y - (first.hexRow || 0) * stepY;

        const cellSet = new Set<string>(
          grp.items.map((n) => `${n.hexCol},${n.hexRow}`)
        );
        const pad = 3;
        const segs: string[] = [];

        grp.items.forEach((n) => {
          const c = n.hexCol || 0;
          const r = n.hexRow || 0;
          const x0 = originX + c * stepX - pad;
          const y0 = originY + r * stepY - pad;
          const x1 = originX + c * stepX + sz.w + pad;
          const y1 = originY + r * stepY + sz.h + pad;

          if (!cellSet.has(`${c},${r - 1}`)) {
            segs.push(`M ${Math.round(x0)} ${Math.round(y0)} L ${Math.round(x1)} ${Math.round(y0)}`);
          }
          if (!cellSet.has(`${c},${r + 1}`)) {
            segs.push(`M ${Math.round(x0)} ${Math.round(y1)} L ${Math.round(x1)} ${Math.round(y1)}`);
          }
          if (!cellSet.has(`${c - 1},${r}`)) {
            segs.push(`M ${Math.round(x0)} ${Math.round(y0)} L ${Math.round(x0)} ${Math.round(y1)}`);
          }
          if (!cellSet.has(`${c + 1},${r}`)) {
            segs.push(`M ${Math.round(x1)} ${Math.round(y0)} L ${Math.round(x1)} ${Math.round(y1)}`);
          }
        });

        if (segs.length > 0) {
          outTetris.push({
            id: `hull-tetris-${gid}`,
            d: segs.join(' '),
            fill: 'none',
            stroke: hexWithAlpha(grp.borderColor, isDarkCanvas ? 0.9 : 0.85),
            strokeWidth: 2.2,
            level: 3,
          });
        }
      });
      return outTetris;
    }

    const g2Map = new Map<string, { color: string; nodes: InteractiveNode[] }>();
    const g3Map = new Map<string, { color: string; nodes: InteractiveNode[] }>();
    const g4Map = new Map<string, { color: string; nodes: InteractiveNode[] }>();

    nodes.forEach((n) => {
      if (n.lineageG2Id && n.lineageG2Color) {
        if (!g2Map.has(n.lineageG2Id)) {
          g2Map.set(n.lineageG2Id, { color: n.lineageG2Color, nodes: [] });
        }
        g2Map.get(n.lineageG2Id)!.nodes.push(n);
      }
      if (n.lineageG3Id && n.lineageG3Color) {
        if (!g3Map.has(n.lineageG3Id)) {
          g3Map.set(n.lineageG3Id, { color: n.lineageG3Color, nodes: [] });
        }
        g3Map.get(n.lineageG3Id)!.nodes.push(n);
      }
      if (n.lineageG4Id && n.lineageG4Color) {
        if (!g4Map.has(n.lineageG4Id)) {
          g4Map.set(n.lineageG4Id, { color: n.lineageG4Color, nodes: [] });
        }
        g4Map.get(n.lineageG4Id)!.nodes.push(n);
      }
    });

    const out: LineageHullItem[] = [];

    g2Map.forEach((entry, id) => {
      if (entry.nodes.length < 2) return;
      const d = buildSmoothHullPath(entry.nodes, 24);
      if (!d) return;
      out.push({
        id: `hull-g2-${id}`,
        d,
        fill: hexWithAlpha(entry.color, isDarkCanvas ? 0.08 : 0.09),
        stroke: hexWithAlpha(entry.color, 0.78),
        strokeWidth: 3.2,
        level: 2,
      });
    });

    g3Map.forEach((entry, id) => {
      if (entry.nodes.length < 2) return;
      const d = buildSmoothHullPath(entry.nodes, 13);
      if (!d) return;
      out.push({
        id: `hull-g3-${id}`,
        d,
        fill: hexWithAlpha(entry.color, isDarkCanvas ? 0.11 : 0.12),
        stroke: hexWithAlpha(entry.color, 0.88),
        strokeWidth: 2.2,
        level: 3,
      });
    });

    g4Map.forEach((entry, id) => {
      if (entry.nodes.length < 2) return;
      const d = buildSmoothHullPath(entry.nodes, 5);
      if (!d) return;
      out.push({
        id: `hull-g4-${id}`,
        d,
        fill: hexWithAlpha(entry.color, isDarkCanvas ? 0.09 : 0.1),
        stroke: hexWithAlpha(entry.color, 0.76),
        strokeWidth: 1.5,
        dash: '5 3',
        level: 4,
      });
    });

    return out;
  }, [
    activePresetId,
    nodes,
    cardDisplayMode,
    photoFrameSize,
    cardScale,
    theme,
    bgStyle,
  ]);

  // Riak Air Kolam Mandala & Aura Bunga Teratai (G1–G2 pusat & klaster G3+G4+G5)
  const lotusHalosMemo = useMemo<LotusHaloItem[]>(() => {
    if (activePresetId !== 'teratai_mekar' || nodes.length === 0) return [];
    const childIdsByParent = new Map<string, string[]>();
    edges.forEach((e) => {
      if (e.type === 'child') {
        if (!childIdsByParent.has(e.from)) childIdsByParent.set(e.from, []);
        childIdsByParent.get(e.from)!.push(e.to);
      }
    });

    const isDarkCanvas = theme === 'dark' || bgStyle !== '';
    const halos: LotusHaloItem[] = [];

    // 1. Cincin riak air konsentris lembut di seluruh kolam berpusat pada bunga G1
    const g1Nodes = nodes.filter(
      (n) => (n.genLevel ?? 0) === 0 && !n.id.includes('_sp_')
    );
    if (g1Nodes.length > 0) {
      let sumX = 0;
      let sumY = 0;
      g1Nodes.forEach((g1) => {
        const sz = getNodeSize(g1, cardDisplayMode, photoFrameSize, cardScale);
        sumX += g1.x + sz.w / 2;
        sumY += g1.y + sz.h / 2;
      });
      const pondCx = Math.round(sumX / g1Nodes.length);
      const pondCy = Math.round(sumY / g1Nodes.length);

      let sumG2R = 0;
      let countG2 = 0;
      let maxOuterR = 0;
      nodes.forEach((n) => {
        const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
        const cx = n.x + sz.w / 2;
        const cy = n.y + sz.h / 2;
        const d = Math.hypot(cx - pondCx, cy - pondCy);
        if ((n.genLevel ?? 0) === 1 && !n.id.includes('_sp_')) {
          sumG2R += d;
          countG2++;
        }
        maxOuterR = Math.max(maxOuterR, d + Math.max(sz.w, sz.h) * 0.55);
      });

      const rG2 = countG2 > 0 ? Math.round(sumG2R / countG2) : 110;
      const rOuter = Math.max(rG2 + 120, Math.round(maxOuterR + 18));
      const rippleRadii = [
        rG2,
        Math.round(rG2 + (rOuter - rG2) * 0.34),
        Math.round(rG2 + (rOuter - rG2) * 0.68),
        rOuter,
      ];
      rippleRadii.forEach((rr, idx) => {
        halos.push({
          id: `pond-ripple-${idx}`,
          cx: pondCx,
          cy: pondCy,
          rx: rr,
          ry: rr,
          stroke: hexWithAlpha('#0d9488', isDarkCanvas ? 0.18 : 0.14),
          fill: 'transparent',
          strokeWidth: 1.1,
          solid: true,
        });
      });
    }

    // 2. Aura lembut mengelilingi kuntum bunga G3 beserta daun G4–G5
    nodes.forEach((n) => {
      if (n.id.includes('_sp_')) return;
      const gen = n.genLevel ?? 0;
      if (gen !== 2 || n.lotusRole !== 'flower_center') return;

      const clusterNodes: InteractiveNode[] = [n];
      nodes.forEach((sp) => {
        if (sp.id.startsWith(`${n.id}_sp_`)) clusterNodes.push(sp);
      });

      const g4Ids = childIdsByParent.get(n.id) || [];
      g4Ids.forEach((g4Id) => {
        const g4n = nodeMap.get(g4Id);
        if (g4n) {
          clusterNodes.push(g4n);
          nodes.forEach((sp) => {
            if (sp.id.startsWith(`${g4Id}_sp_`)) clusterNodes.push(sp);
          });
        }
        const g5Ids = childIdsByParent.get(g4Id) || [];
        g5Ids.forEach((g5Id) => {
          const g5n = nodeMap.get(g5Id);
          if (g5n) clusterNodes.push(g5n);
          (childIdsByParent.get(g5Id) || []).forEach((g6Id) => {
            const g6n = nodeMap.get(g6Id);
            if (g6n) clusterNodes.push(g6n);
          });
        });
      });

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      clusterNodes.forEach((cn) => {
        const sz = getNodeSize(cn, cardDisplayMode, photoFrameSize, cardScale);
        minX = Math.min(minX, cn.x);
        minY = Math.min(minY, cn.y);
        maxX = Math.max(maxX, cn.x + sz.w);
        maxY = Math.max(maxY, cn.y + sz.h);
      });
      if (!Number.isFinite(minX)) return;
      const pad = 16;
      const cx = Math.round((minX + maxX) / 2);
      const cy = Math.round((minY + maxY) / 2);
      const rx = Math.round((maxX - minX) / 2 + pad);
      const ry = Math.round((maxY - minY) / 2 + pad);
      const col = n.customBorderColor || '#14b8a6';

      halos.push({
        id: `lotus-halo-${n.id}`,
        cx,
        cy,
        rx,
        ry,
        stroke: hexWithAlpha(col, isDarkCanvas ? 0.28 : 0.24),
        fill: hexWithAlpha(col, isDarkCanvas ? 0.04 : 0.03),
        strokeWidth: 1.2,
        solid: false,
      });
    });

    return halos;
  }, [
    activePresetId,
    nodes,
    edges,
    nodeMap,
    cardDisplayMode,
    photoFrameSize,
    cardScale,
    theme,
    bgStyle,
  ]);

  // Kerangka Pohon Natal Bertingkat (Dipisah Tegas):
  // Batang 75% tinggi (100->50px) + Dahan Zigzag 3-4 lapis (70->40px) + Ranting (45->20px) + Bayangan + Daun Aksen
  const treeSkeletonMemo = useMemo<TreeSkeletonData | null>(() => {
    const isTreeMode =
      activePresetId === 'pohon_hayat_besar' ||
      lineThicknessMode === 'tree_taper';
    if (!isTreeMode || nodes.length < 2) return null;

    const g1Nodes = nodes.filter(
      (n) => (n.genLevel ?? 0) === 0 && !n.id.includes('_sp_')
    );
    const g2Nodes = nodes
      .filter((n) => (n.genLevel ?? 0) === 1 && !n.id.includes('_sp_'))
      .sort((a, b) => b.y - a.y); // bawah -> atas

    if (g1Nodes.length === 0) return null;
    // Pastikan orientasi memang pohon bawah-ke-atas (G1 lebih bawah dari rata-rata G3+)
    const upperNodes = nodes.filter((n) => (n.genLevel ?? 0) >= 2);
    if (upperNodes.length > 0) {
      const avgUpperY =
        upperNodes.reduce((s, n) => s + n.y, 0) / upperNodes.length;
      if (avgUpperY >= g1Nodes[0].y - 10) return null;
    }

    const boxCenter = (n: InteractiveNode) => {
      const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
      return { x: n.x + sz.w / 2, y: n.y + sz.h / 2, w: sz.w, h: sz.h };
    };

    const woodScale = Math.max(
      0.55,
      Math.min(1.0, Math.min(boardWidth / 1450, boardHeight / 980))
    );

    const buildTaperPoly = (
      pts: Array<{ x: number; y: number }>,
      wStart: number,
      wEnd: number
    ): string => {
      if (pts.length < 2) return '';
      const lPts: string[] = [];
      const rPts: string[] = [];
      const last = pts.length - 1;
      for (let i = 0; i <= last; i++) {
        const t = i / Math.max(1, last);
        const hw = (wStart + (wEnd - wStart) * t) / 2;
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[Math.min(last, i + 1)];
        let tx = p1.x - p0.x;
        let ty = p1.y - p0.y;
        const len = Math.hypot(tx, ty) || 1;
        tx /= len;
        ty /= len;
        const nx = -ty;
        const ny = tx;
        lPts.push(
          `${Math.round((pts[i].x + nx * hw) * 10) / 10} ${
            Math.round((pts[i].y + ny * hw) * 10) / 10
          }`
        );
        rPts.unshift(
          `${Math.round((pts[i].x - nx * hw) * 10) / 10} ${
            Math.round((pts[i].y - ny * hw) * 10) / 10
          }`
        );
      }
      return `M ${lPts[0]} ${lPts
        .slice(1)
        .map((s) => `L ${s}`)
        .join(' ')} ${rPts.map((s) => `L ${s}`).join(' ')} Z`;
    };

    const sampleQuad = (
      p0: { x: number; y: number },
      c: { x: number; y: number },
      p1: { x: number; y: number },
      steps = 10
    ) => {
      const out: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        out.push({
          x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
          y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
        });
      }
      return out;
    };

    const sampleCubic = (
      p0: { x: number; y: number },
      c1: { x: number; y: number },
      c2: { x: number; y: number },
      p1: { x: number; y: number },
      steps = 14
    ) => {
      const out: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const mt = 1 - t;
        out.push({
          x:
            mt * mt * mt * p0.x +
            3 * mt * mt * t * c1.x +
            3 * mt * t * t * c2.x +
            t * t * t * p1.x,
          y:
            mt * mt * mt * p0.y +
            3 * mt * mt * t * c1.y +
            3 * mt * t * t * c2.y +
            t * t * t * p1.y,
        });
      }
      return out;
    };

    const rootPaths: TreeSkeletonData['rootPaths'] = [];
    const trunkOuterPaths: TreeSkeletonData['trunkOuterPaths'] = [];
    const trunkInnerPaths: TreeSkeletonData['trunkInnerPaths'] = [];
    const boughPaths: TreeSkeletonData['boughPaths'] = [];
    const twigPaths: TreeSkeletonData['twigPaths'] = [];
    const accentLeaves: TreeSkeletonData['accentLeaves'] = [];
    const arrowChevrons: TreeSkeletonData['arrowChevrons'] = [];

    const activeTreeBp =
      aiBlueprint?.archetype === 'tree_organic' ? aiBlueprint : null;
    const trunkCurveVal = activeTreeBp?.trunkCurve ?? 0.08;
    const rootSpreadVal = activeTreeBp?.rootSpread ?? 1.08;
    const curveTensionVal = activeTreeBp?.curveTension ?? 0.34;
    const barkOuterCol = activeTreeBp?.barkOuterColor || '#5c2408';
    const barkInnerCol = activeTreeBp?.barkInnerColor || '#b45309';
    const rootFillCol = activeTreeBp?.barkOuterColor || '#451a03';
    const accentLeafPrimary =
      activeTreeBp?.genColors?.[2]?.bg ||
      activeTreeBp?.genColors?.[1]?.border ||
      '#15803d';
    const accentLeafSecondary =
      activeTreeBp?.genColors?.[3]?.bg ||
      activeTreeBp?.genColors?.[2]?.border ||
      '#22c55e';

    const mainRoot = g1Nodes[0];
    const rc = boxCenter(mainRoot);
    const trunkX = mainRoot.treeOriginX ?? rc.x;
    const trunkBaseY =
      mainRoot.treeOriginY ??
      Math.min(boardHeight - 40, Math.round(rc.y + rc.h * 0.42));
    const trunkTopY =
      mainRoot.treeTipY ??
      Math.max(44, trunkBaseY - Math.max(220, Math.round(boardHeight * 0.75)));

    // 1. Akar Kokoh & Bercabang Organik di bawah pangkal batang
    const rootSpanX = Math.max(150, Math.round(boardWidth * 0.148 * rootSpreadVal));
    const rootSpanY = Math.max(
      28,
      Math.min(boardHeight - trunkBaseY - 8, Math.round(58 * woodScale))
    );
    const rootSpecs = [
      { dx: -rootSpanX * 1.15, dy: rootSpanY * 0.88, c1x: -rootSpanX * 0.34, c1y: rootSpanY * 0.32, c2x: -rootSpanX * 0.78, c2y: rootSpanY * 0.96, w0: 36 * woodScale },
      { dx: -rootSpanX * 0.56, dy: rootSpanY * 1.0, c1x: -rootSpanX * 0.16, c1y: rootSpanY * 0.42, c2x: -rootSpanX * 0.36, c2y: rootSpanY * 0.92, w0: 25 * woodScale },
      { dx: 4 * Math.sign(trunkCurveVal || 1), dy: rootSpanY * 1.05, c1x: -10, c1y: rootSpanY * 0.45, c2x: 8, c2y: rootSpanY * 0.85, w0: 27 * woodScale },
      { dx: rootSpanX * 0.56, dy: rootSpanY * 1.0, c1x: rootSpanX * 0.16, c1y: rootSpanY * 0.42, c2x: rootSpanX * 0.36, c2y: rootSpanY * 0.92, w0: 25 * woodScale },
      { dx: rootSpanX * 1.15, dy: rootSpanY * 0.88, c1x: rootSpanX * 0.34, c1y: rootSpanY * 0.32, c2x: rootSpanX * 0.78, c2y: rootSpanY * 0.96, w0: 36 * woodScale },
    ];
    rootSpecs.forEach((rs, rIdx) => {
      const startPt = {
        x: trunkX + (rIdx === 2 ? 0 : rs.dx > 0 ? 14 * woodScale : -14 * woodScale),
        y: trunkBaseY - 10,
      };
      const endPt = {
        x: trunkX + rs.dx,
        y: Math.min(boardHeight - 8, trunkBaseY + rs.dy),
      };
      const pts = sampleCubic(
        startPt,
        { x: trunkX + rs.c1x, y: trunkBaseY + rs.c1y },
        { x: trunkX + rs.c2x, y: trunkBaseY + rs.c2y },
        endPt,
        12
      );
      const d = buildTaperPoly(pts, rs.w0, 4 * woodScale);
      if (d) {
        rootPaths.push({ d, color: rootFillCol, strokeColor: '#290f02' });
      }
      // Cabang akar sekunder kiri-kanan untuk akar utama terluar
      if (rIdx === 0 || rIdx === 4) {
        const forkBase = pts[Math.floor(pts.length * 0.52)] || startPt;
        const forkDir = rs.dx > 0 ? 1 : -1;
        const forkPts = sampleQuad(
          forkBase,
          { x: forkBase.x + forkDir * rootSpanX * 0.16, y: forkBase.y - 6 },
          {
            x: forkBase.x + forkDir * rootSpanX * 0.32,
            y: Math.min(boardHeight - 8, forkBase.y + 18 * woodScale),
          },
          8
        );
        const forkD = buildTaperPoly(forkPts, 14 * woodScale, 3 * woodScale);
        if (forkD) {
          rootPaths.push({ d: forkD, color: rootFillCol, strokeColor: '#290f02' });
        }
      }
    });

    // 2. Batang Utama Melengkung Organik (S-curve natural + pangkal melebar)
    const swayAmp = Math.round(boardWidth * 0.048 * trunkCurveVal);
    const trunkMidY = (trunkBaseY + trunkTopY) / 2;
    const trunkPts = sampleCubic(
      { x: trunkX, y: trunkBaseY + 6 },
      { x: trunkX - swayAmp, y: trunkBaseY - (trunkBaseY - trunkMidY) * 0.54 },
      { x: trunkX + swayAmp, y: trunkTopY + (trunkMidY - trunkTopY) * 0.46 },
      { x: trunkX + Math.round(swayAmp * 0.18), y: trunkTopY },
      16
    );
    const trunkSpineXAtY = (targetY: number) => {
      if (trunkPts.length === 0) return trunkX;
      let bestPt = trunkPts[0];
      let bestDist = Infinity;
      for (let i = 0; i < trunkPts.length; i++) {
        const dist = Math.abs(trunkPts[i].y - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          bestPt = trunkPts[i];
        }
      }
      return bestPt.x;
    };

    const trunkD = buildTaperPoly(
      trunkPts,
      118 * woodScale,
      50 * woodScale
    );
    const trunkInnerD = buildTaperPoly(
      trunkPts,
      58 * woodScale,
      22 * woodScale
    );
    if (trunkD) {
      trunkOuterPaths.push({
        d: trunkD,
        color: barkOuterCol,
        strokeColor: '#290f02',
      });
    }
    if (trunkInnerD) {
      trunkInnerPaths.push({ d: trunkInnerD, color: barkInnerCol });
    }

    // Panah arah halus di batang (G1 -> G2 -> Puncak) bila aktif
    if (showLineArrows) {
      const spineCenters = [rc, ...g2Nodes.map((g2) => boxCenter(g2))];
      for (let i = 0; i < spineCenters.length - 1; i++) {
        const yMid = (spineCenters[i].y + spineCenters[i + 1].y) / 2;
        arrowChevrons.push({
          x: trunkSpineXAtY(yMid),
          y: yMid,
          angleDeg: -90,
          size: Math.max(7, 10 * woodScale),
          color: '#fde047',
        });
      }
      arrowChevrons.push({
        x: trunkSpineXAtY(trunkTopY + Math.max(18, 28 * woodScale)),
        y: trunkTopY + Math.max(18, 28 * woodScale),
        angleDeg: -90,
        size: Math.max(7, 10 * woodScale),
        color: '#fde047',
      });
    }

    // Pucuk daun mahkota di ujung atas batang melengkung
    const topCrownX = trunkPts[trunkPts.length - 1]?.x ?? trunkX;
    accentLeaves.push(
      {
        cx: topCrownX,
        cy: trunkTopY - 16 * woodScale,
        w: 24 * woodScale,
        h: 38 * woodScale,
        angleDeg: 0,
        fill: accentLeafPrimary,
        stroke: '#4ade80',
      },
      {
        cx: topCrownX - 18 * woodScale,
        cy: trunkTopY - 6 * woodScale,
        w: 18 * woodScale,
        h: 30 * woodScale,
        angleDeg: -38,
        fill: accentLeafSecondary,
        stroke: '#86efac',
      },
      {
        cx: topCrownX + 18 * woodScale,
        cy: trunkTopY - 6 * woodScale,
        w: 18 * woodScale,
        h: 30 * woodScale,
        angleDeg: 38,
        fill: accentLeafSecondary,
        stroke: '#86efac',
      }
    );

    // 3. Dahan Utama Kokoh Pohon Petai per Sayap (1 dahan kokoh per pasangan induk G2 + kiri/kanan)
    const parentEdgeOf = new Map<string, string>();
    edges.forEach((e) => {
      if (e.type === 'child') parentEdgeOf.set(e.to, e.from);
    });

    const g3Nodes = nodes.filter(
      (n) => (n.genLevel ?? 0) === 2 && !n.id.includes('_sp_')
    );
    const trunkSpanY = Math.max(120, trunkBaseY - trunkTopY);

    const wingBoughGroups = new Map<
      string,
      { originX: number; originY: number; tipX: number; tipY: number; wing: -1 | 1; members: InteractiveNode[] }
    >();
    g3Nodes.forEach((g3) => {
      const g3c = boxCenter(g3);
      const wing: -1 | 1 = g3.treeWing ?? (g3c.x >= trunkX ? 1 : -1);
      const parentId = parentEdgeOf.get(g3.id) || 'root';
      const key = `${parentId}__${wing}`;
      const originY =
        g3.treeOriginY ??
        Math.max(
          trunkTopY + 28,
          Math.min(trunkBaseY - 38, g3c.y + 32)
        );
      const originX = trunkSpineXAtY(originY);
      const candTipX =
        g3.treeTipX ?? Math.round(originX + (g3c.x - originX) * 1.32);
      const candTipY =
        g3.treeTipY ??
        Math.round(originY + (g3c.y - originY) * 1.32 - 8 * woodScale);
      const existing = wingBoughGroups.get(key);
      if (!existing) {
        wingBoughGroups.set(key, {
          originX,
          originY,
          tipX: candTipX,
          tipY: candTipY,
          wing,
          members: [g3],
        });
      } else {
        existing.members.push(g3);
        if (Math.abs(candTipX - originX) > Math.abs(existing.tipX - existing.originX)) {
          existing.tipX = candTipX;
          existing.tipY = candTipY;
        }
      }
    });

    Array.from(wingBoughGroups.values()).forEach((grp, bIdx) => {
      const { originX, originY, tipX, tipY, wing } = grp;
      const tierFrac = Math.max(
        0,
        Math.min(1, (trunkBaseY - originY) / trunkSpanY)
      );
      const wStart = (70 - tierFrac * 10) * woodScale;
      const wEnd = (28 - tierFrac * 4) * woodScale;

      const spanX = tipX - originX;
      const spanY = tipY - originY;
      const lift = Math.max(12, Math.abs(spanX) * 0.1 * curveTensionVal);
      const boughPts = sampleCubic(
        { x: originX, y: originY },
        { x: originX + spanX * 0.34, y: originY + spanY * 0.16 - lift * 0.4 },
        { x: originX + spanX * 0.68, y: originY + spanY * 0.84 + lift * 0.35 },
        { x: tipX, y: tipY },
        14
      );
      const outerD = buildTaperPoly(boughPts, wStart, wEnd);
      const innerD = buildTaperPoly(
        boughPts,
        30 * woodScale,
        12 * woodScale
      );

      if (outerD) {
        boughPaths.push({
          d: outerD,
          color: barkOuterCol,
          strokeColor: '#290f02',
          innerD: innerD || undefined,
          innerColor: barkInnerCol,
        });
      }

      const bAngleDeg =
        (Math.atan2(tipY - originY, tipX - originX) * 180) / Math.PI;
      if (showLineArrows) {
        const arrPt = boughPts[Math.floor(boughPts.length * 0.55)] || boughPts[0];
        if (arrPt) {
          arrowChevrons.push({
            x: arrPt.x,
            y: arrPt.y,
            angleDeg: bAngleDeg,
            size: Math.max(6.5, 9 * woodScale),
            color: '#bef264',
          });
        }
      }

      accentLeaves.push({
        cx: tipX + wing * 12 * woodScale,
        cy: tipY - 6 * woodScale,
        w: 20 * woodScale,
        h: 32 * woodScale,
        angleDeg: wing * (48 + (bIdx % 2) * 12),
        fill: accentLeafPrimary,
        stroke: '#4ade80',
      });
    });

    // 4. Ranting Kecil G4 & Tangkai Daun Menyirip Petai G5+
    const twigNodes = nodes
      .filter((n) => (n.genLevel ?? 0) >= 3 && !n.id.includes('_sp_'))
      .sort((a, b) => (a.genLevel ?? 0) - (b.genLevel ?? 0));
    twigNodes.forEach((tn, tIdx) => {
      const tnc = boxCenter(tn);
      const pNode = parentEdgeOf.get(tn.id)
        ? nodeMap.get(parentEdgeOf.get(tn.id)!)
        : undefined;
      const pc = pNode ? boxCenter(pNode) : rc;
      const gen = tn.genLevel ?? 3;

      const hasExplicitTwig =
        typeof tn.treeOriginX === 'number' &&
        typeof tn.treeOriginY === 'number' &&
        typeof tn.treeTipX === 'number' &&
        typeof tn.treeTipY === 'number';

      const originX = hasExplicitTwig ? tn.treeOriginX! : pc.x;
      const originY = hasExplicitTwig ? tn.treeOriginY! : pc.y;
      const tipX = hasExplicitTwig ? tn.treeTipX! : tnc.x;
      const tipY = hasExplicitTwig ? tn.treeTipY! : tnc.y;
      const dx = tipX - originX;
      const dy = tipY - originY;

      const arch =
        gen === 3
          ? (tIdx % 2 === 0 ? 1 : -1) * Math.max(4, Math.hypot(dx, dy) * 0.05)
          : (tIdx % 2 === 0 ? 1 : -1) * Math.max(4, Math.hypot(dx, dy) * 0.08 * curveTensionVal);
      const perpX = -dy / (Math.hypot(dx, dy) || 1);
      const perpY = dx / (Math.hypot(dx, dy) || 1);

      const twigPts = sampleCubic(
        { x: originX, y: originY },
        {
          x: originX + dx * 0.36 + perpX * arch,
          y: originY + dy * 0.36 + perpY * arch,
        },
        {
          x: originX + dx * 0.72 - perpX * arch * 0.5,
          y: originY + dy * 0.72 - perpY * arch * 0.5,
        },
        { x: tipX, y: tipY },
        10
      );
      const startW = (gen >= 4 ? 14 : 30) * woodScale;
      const endW = (gen >= 4 ? 5 : 12) * woodScale;
      const outerD = buildTaperPoly(twigPts, startW, endW);
      const innerD = buildTaperPoly(twigPts, startW * 0.38, endW * 0.36);
      if (outerD) {
        twigPaths.push({
          d: outerD,
          color: gen >= 4 ? '#78350f' : '#6b3410',
          strokeColor: '#290f02',
          innerD: innerD || undefined,
          innerColor: gen >= 4 ? '#a16207' : '#d97706',
        });
      }

      const tAngleRad = Math.atan2(tipY - originY, tipX - originX);
      const tAngleDeg = (tAngleRad * 180) / Math.PI;
      if (showLineArrows && gen === 3) {
        const arrPt = twigPts[Math.floor(twigPts.length * 0.68)] || tnc;
        arrowChevrons.push({
          x: arrPt.x,
          y: arrPt.y,
          angleDeg: tAngleDeg,
          size: Math.max(5.5, 7.5 * woodScale),
          color: '#bef264',
        });
      }

      const wing: -1 | 1 = tn.treeWing ?? (tipX >= trunkX ? 1 : -1);
      accentLeaves.push({
        cx: tipX + Math.cos(tAngleRad) * 8 * woodScale,
        cy: tipY + Math.sin(tAngleRad) * 8 * woodScale,
        w: (gen >= 4 ? 12 : 15) * woodScale,
        h: (gen >= 4 ? 20 : 24) * woodScale,
        angleDeg: wing * (36 + (tIdx % 3) * 16),
        fill: tIdx % 2 === 0 ? accentLeafSecondary : '#84cc16',
        stroke: '#bef264',
      });
    });

    return {
      rootPaths,
      trunkOuterPaths,
      trunkInnerPaths,
      boughPaths,
      twigPaths,
      accentLeaves,
      arrowChevrons,
    };
  }, [
    activePresetId,
    lineThicknessMode,
    showLineArrows,
    nodes,
    edges,
    nodeMap,
    cardDisplayMode,
    photoFrameSize,
    cardScale,
    boardWidth,
    boardHeight,
    aiBlueprint,
  ]);

  const getBoardBackgroundStyle = (): React.CSSProperties => {
    if (bgStyle === 'bg-gunung') {
      return {
        background:
          'linear-gradient(180deg, #1e3a8a 0%, #3b82f6 35%, #10b981 75%, #064e3b 100%)',
      };
    }
    if (bgStyle === 'bg-pohon') {
      return {
        background:
          'radial-gradient(circle at 50% 85%, #78350f 0%, #14532d 45%, #052e16 100%)',
      };
    }
    if (bgStyle === 'bg-galaksi') {
      return {
        background:
          'radial-gradient(ellipse at center, #311042 0%, #0f172a 65%, #020617 100%)',
      };
    }
    if (aiBlueprint?.canvasBgColor) {
      return {
        backgroundColor: aiBlueprint.canvasBgColor,
        backgroundImage: `radial-gradient(circle at 50% 45%, rgba(255,255,255,0.06) 0%, transparent 70%)`,
      };
    }
    return {
      backgroundColor: theme === 'dark' ? '#0b1120' : '#f8fafc',
      backgroundImage:
        theme === 'dark'
          ? 'radial-gradient(#1e293b 1.2px, transparent 1.2px)'
          : 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)',
      backgroundSize: '20px 20px',
    };
  };

  const isDark = theme === 'dark';
  const hasGroupInSelection = selectedIds.some(
    (id) => nodeMap.get(id)?.groupId
  );
  const isLandscapeHud =
    isFocusMode && (studioScreenMode === 'landscape' || windowSize.w > windowSize.h);

  return (
    <div
      style={
        isCssLandscapeActive
          ? {
              position: 'fixed',
              left: `${windowSize.w}px`,
              top: 0,
              width: `${windowSize.h}px`,
              height: `${windowSize.w}px`,
              transform: 'rotate(90deg)',
              transformOrigin: 'top left',
            }
          : undefined
      }
      className={
        isFocusMode
          ? `fixed ${isCssLandscapeActive ? '' : 'inset-0'} z-50 flex flex-col overflow-hidden print-flow-unlock ${
              isDark
                ? 'bg-[#0b1120] text-slate-100'
                : 'bg-[#e2e8f0] text-slate-900'
            }`
          : `flex-1 flex flex-col overflow-hidden rounded-2xl border shadow-lg print-flow-unlock relative ${
              isDark
                ? 'bg-[#0f172a] border-slate-800 text-slate-100'
                : 'bg-[#f1f5f9] border-stone-300 text-slate-900'
            }`
      }
    >
      {/* ========================================================= */}
      {/* TOOLBAR TUNGGAL RINGKAS (HILANG SAAT MODE LELUASA AKTIF)  */}
      {/* ========================================================= */}
      {!isFocusMode && (
      <div
        className={`px-3 py-1.5 border-b flex flex-wrap items-center justify-between gap-1.5 shrink-0 z-20 print:hidden ${
          isDark
            ? 'bg-[#1e293b] border-slate-700'
            : 'bg-white border-stone-200'
        }`}
      >
        {/* Kiri: Pemisah Tegas Mode Smart (Bersih) vs Edit Manual (Opsional) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className={`p-0.5 rounded-xl border flex items-center gap-0.5 ${
              isDark
                ? 'bg-slate-900 border-slate-700'
                : 'bg-stone-100 border-stone-200'
            }`}
          >
            <button
              type="button"
              onClick={() => switchWorkspaceMode('smart')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                studioWorkspaceMode === 'smart'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Mode Smart Instan: pilih tata letak otomatis bebas tumpukan tanpa alat edit"
            >
              <Sparkles className="w-3 h-3" />
              <span>Mode Smart</span>
            </button>
            <button
              type="button"
              onClick={() => switchWorkspaceMode('edit')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                studioWorkspaceMode === 'edit'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Mode Edit Manual: buka semua alat geser, tambah kartu & sambung garis"
            >
              <Move className="w-3 h-3" />
              <span>Edit Manual</span>
            </button>
          </div>

          {studioWorkspaceMode === 'smart' ? (
            <>
              <div
                className={`p-0.5 rounded-xl border flex items-center gap-0.5 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700'
                    : 'bg-stone-100 border-stone-200'
                }`}
              >
                {(
                  [
                    { id: 'name_only' as const, label: 'Nama' },
                    { id: 'photo_name' as const, label: 'Foto+Nama' },
                    { id: 'photo_name_unified' as const, label: 'Menyatu' },
                    { id: 'full' as const, label: 'Lengkap' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => applySmartLiveSetting({ cardMode: m.id })}
                    className={`px-2 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition ${
                      cardDisplayMode === m.id
                        ? 'bg-amber-400 text-slate-950'
                        : isDark
                        ? 'text-slate-300 hover:text-white'
                        : 'text-stone-700 hover:bg-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsSmartGalleryOpen((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap transition ${
                  isSmartGalleryOpen
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Pilihan Smart ({smartGalleryOptions.length})</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  const next = !isMultiSelectMode;
                  setIsMultiSelectMode(next);
                  if (next) {
                    cancelHoldTimer();
                    showNotification('Mode Pilih Checklist aktif: ketuk langsung kartu untuk memilih banyak!');
                  }
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 whitespace-nowrap transition ${
                  isMultiSelectMode
                    ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xs'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-sky-400'
                    : 'bg-stone-100 border-stone-300 text-stone-700'
                }`}
                title="Ketuk untuk memilih beberapa kartu langsung tanpa menekan lama"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Pilih {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={handleUndo}
                disabled={undoCount === 0}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 whitespace-nowrap transition ${
                  undoCount === 0
                    ? isDark
                      ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed'
                    : isDark
                    ? 'bg-slate-800 border-amber-500/40 text-amber-300 hover:border-amber-400'
                    : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                }`}
                title="Batalkan perubahan terakhir (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo{undoCount > 0 ? ` (${undoCount})` : ''}</span>
              </button>

              <button
                type="button"
                onClick={addNewNode}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-emerald-300 hover:border-emerald-400'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                }`}
                title="Tambah Kartu Anggota Baru"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kartu</span>
              </button>

              <button
                type="button"
                onClick={startConnectMode}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 whitespace-nowrap ${
                  connectFromId
                    ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                    : isDark
                    ? 'bg-slate-800 border-slate-700 text-sky-300'
                    : 'bg-sky-50 border-sky-300 text-sky-800'
                }`}
                title="Hubungkan garis antara 2 kartu"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{connectFromId ? 'Klik Tujuan...' : 'Garis'}</span>
              </button>
            </>
          )}
        </div>

        {/* Kanan: Kertas A0-A4, Laci Edit (khusus Mode Edit), Studio Penuh, Cetak */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div
            className={`flex items-center rounded-lg border p-0.5 gap-0.5 ${
              isDark
                ? 'bg-slate-900 border-slate-700'
                : 'bg-stone-100 border-stone-300'
            }`}
          >
            <FileText className="w-3 h-3 text-amber-400 ml-1" />
            <select
              value={paperSize}
              onChange={(e) => applySmartLiveSetting({ paper: e.target.value as GridPaperSize })}
              className={`px-1 py-0.5 rounded text-[11px] font-bold outline-hidden cursor-pointer ${
                isDark ? 'bg-slate-900 text-amber-300' : 'bg-stone-100 text-stone-800'
              }`}
              title="Pilih Ukuran Kertas (A0 sampai A4)"
            >
              <option value="a4">A4</option>
              <option value="a3">A3</option>
              <option value="a2">A2</option>
              <option value="a1">A1</option>
              <option value="a0">A0</option>
            </select>
            <button
              type="button"
              onClick={() =>
                applySmartLiveSetting({
                  orient: paperOrientation === 'landscape' ? 'portrait' : 'landscape',
                })
              }
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isDark
                  ? 'bg-slate-800 text-emerald-300 hover:bg-slate-700'
                  : 'bg-white text-emerald-800 border border-stone-200'
              }`}
              title="Ubah Orientasi Kertas Lanskap / Potret"
            >
              {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}
            </button>
          </div>

          {studioWorkspaceMode === 'edit' && (
            <button
              type="button"
              onClick={() => setIsPanelOpen((v) => !v)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1 transition shadow-xs ${
                isPanelOpen
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/50 text-white'
              }`}
              title="Buka panel Gaya Kartu/Garis PCB, Edit & Simpan Desain"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Atur &amp; Desain ({savedDesigns.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFocusMode(true)}
            className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-emerald-300 hover:border-emerald-400'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
            title="Masuk Studio Penuh (Kanvas Layar Penuh + Tombol Melayang)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Studio Penuh</span>
          </button>

          <button
            type="button"
            disabled={isExportingPoster}
            onClick={() => handleTriggerGridExportAction('draft')}
            className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-60 border border-amber-400/45 text-amber-300 text-[11px] font-black flex items-center gap-1"
            title={`Unduh Draft Ringan ${paperDim.label} (Cepat & hemat kuota tanpa upscale foto)`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Draft</span>
          </button>

          <button
            type="button"
            disabled={isExportingPoster}
            onClick={() => handleTriggerGridExportAction('png')}
            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-[11px] font-black flex items-center gap-1"
            title={`Unduh Gambar PNG HD ${paperDim.label} (Full Color + Foto Auto-Upscale)`}
          >
            {isExportingPoster ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>PNG HD</span>
          </button>

          <button
            type="button"
            disabled={isExportingPoster}
            onClick={() => handleTriggerGridExportAction('pdf')}
            className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-[11px] font-black flex items-center gap-1"
            title={`Unduh PDF ${paperDim.label} Siap Cetak (Full Color + Auto-Upscale)`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            disabled={isExportingPoster}
            onClick={() => handleTriggerGridExportAction('print')}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-[11px] font-black flex items-center gap-1"
            title={`Cetak langsung ukuran ${paperDim.label} penuh warna`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak {paperDim.label}</span>
          </button>
        </div>
      </div>
      )}

      {/* ========================================================= */}
      {/* WORKSPACE: SIDEBAR EDIT / DESAIN + KANVAS A0-A4           */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden relative print-flow-unlock">
        {studioWorkspaceMode === 'edit' && isPanelOpen && (
          <aside
            className={`absolute ${
              isLandscapeHud
                ? 'left-16 top-2 bottom-2 w-[300px] sm:w-[320px]'
                : isFocusMode
                ? 'left-2 top-14 bottom-16 w-[290px] sm:w-[320px]'
                : 'left-2 top-2 bottom-2 w-[290px] sm:w-[320px]'
            } rounded-2xl border shadow-2xl z-45 p-3.5 flex flex-col gap-3 overflow-y-auto print:hidden ${
              isDark
                ? 'bg-[#1e293b]/95 backdrop-blur-md border-slate-700 text-slate-100'
                : 'bg-white/95 backdrop-blur-md border-stone-200 text-stone-800'
            }`}
          >
            {/* Tab Switcher di Panel Kiri */}
            <div className="flex items-center justify-between gap-1 border-b pb-2 border-slate-700/40">
              <div className="flex gap-0.5 bg-black/20 p-0.5 rounded-lg flex-wrap">
                <button
                  type="button"
                  onClick={() => setPanelTab('smart')}
                  className={`px-2 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1 ${
                    panelTab === 'smart'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Smart</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('style')}
                  className={`px-2 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1 ${
                    panelTab === 'style'
                      ? 'bg-sky-500 text-slate-950'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  <Palette className="w-3 h-3" />
                  <span>Gaya</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('edit')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                    panelTab === 'edit'
                      ? 'bg-amber-500 text-slate-950'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab('designs')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                    panelTab === 'designs'
                      ? 'bg-amber-500 text-slate-950'
                      : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  Desain ({savedDesigns.length})
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsPanelOpen(false)}
                className="p-1 rounded-lg hover:bg-black/10 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {panelTab === 'style' ? (
              /* TAB GAYA KARTU, PAS FOTO, JALUR PCB, WARNA & KETERANGAN POSTER */
              <div className="space-y-3.5 text-xs">
                {/* 0. Tampilan Card, Ukuran Pas Foto, Tema & Latar */}
                <div className="space-y-2">
                  <div className="font-extrabold text-[11px] text-amber-400">
                    0. Card, Pas Foto, Latar &amp; Layar
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] opacity-75 block mb-0.5">Mode Card:</label>
                      <select
                        value={cardDisplayMode}
                        onChange={(e) => setCardDisplayMode(e.target.value as CardDisplayMode)}
                        className={`w-full px-2 py-1 rounded-lg text-[11px] font-bold border outline-hidden cursor-pointer ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-white'
                            : 'bg-stone-50 border-stone-300 text-stone-900'
                        }`}
                      >
                        <option value="name_only">1. Nama Lengkap Saja</option>
                        <option value="photo_name">2. Foto + Badge Nama</option>
                        <option value="photo_name_unified">3. Foto + Nama Menyatu (Dalam Bentuk)</option>
                        <option value="full">4. Foto + Badge Lengkap (Nama, Lahir/Wafat, Kota)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] opacity-75 block mb-0.5">Rasio / Ukuran Foto:</label>
                      <select
                        value={photoFrameSize}
                        disabled={cardDisplayMode === 'name_only'}
                        onChange={(e) => setPhotoFrameSize(e.target.value as PhotoFrameSize)}
                        className={`w-full px-2 py-1 rounded-lg text-[11px] font-bold border outline-hidden cursor-pointer disabled:opacity-45 ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-emerald-300'
                            : 'bg-stone-50 border-stone-300 text-emerald-900'
                        }`}
                      >
                        <option value="kotak">Kotak 1:1</option>
                        <option value="bulat">Bulat 1:1</option>
                        <option value="2x3">Pas Foto 2×3</option>
                        <option value="3x4">Pas Foto 3×4</option>
                        <option value="4x6">Pas Foto 4×6</option>
                      </select>
                    </div>
                  </div>

                  {/* Bentuk Bingkai Foto: Kotak, Bulat, Segi 6 (Jarak ke tepi card 1mm) */}
                  {cardDisplayMode !== 'name_only' && (
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] opacity-80 font-semibold shrink-0">
                        Bentuk Foto (1mm):
                      </span>
                      <div className="grid grid-cols-3 gap-1 flex-1">
                        {(
                          [
                            { id: 'kotak' as const, label: 'Kotak' },
                            { id: 'bulat' as const, label: 'Bulat' },
                            { id: 'segi6' as const, label: 'Segi 6' },
                          ] as const
                        ).map((sh) => (
                          <button
                            key={sh.id}
                            type="button"
                            onClick={() => setPhotoShape(sh.id)}
                            className={`py-1 px-1.5 rounded-lg border text-[10px] font-bold transition ${
                              photoShape === sh.id
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : isDark
                                ? 'bg-[#0f172a] border-slate-700 text-slate-300 hover:border-amber-400'
                                : 'bg-stone-50 border-stone-300 text-stone-700'
                            }`}
                          >
                            {sh.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pengatur Ukuran / Skala Foto & Kartu agar tidak kosong atau menumpuk */}
                  <div className="p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10.5px] font-extrabold text-emerald-300">
                        Ukuran Foto &amp; Kartu ({Math.round(cardScale * 100)}%)
                      </span>
                      <button
                        type="button"
                        onClick={handleAutoFitCardScale}
                        className="px-2 py-0.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[9.5px]"
                        title={`Otomatis perbesar/perkecil foto & kartu agar pas mengisi ${paperDim.label}`}
                      >
                        Pas-kan {paperDim.label}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCardScale((s) => Math.max(0.55, +(s - 0.1).toFixed(2)))}
                        className="px-1.5 py-0.5 rounded border border-slate-600 text-[10px] font-bold hover:border-amber-400"
                        title="Perkecil Kartu & Foto"
                      >
                        −
                      </button>
                      <input
                        type="range"
                        min={55}
                        max={155}
                        step={5}
                        value={Math.round(cardScale * 100)}
                        onChange={(e) => setCardScale(Number(e.target.value) / 100)}
                        className="flex-1 accent-emerald-400 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => setCardScale((s) => Math.min(1.55, +(s + 0.1).toFixed(2)))}
                        className="px-1.5 py-0.5 rounded border border-slate-600 text-[10px] font-bold hover:border-amber-400"
                        title="Perbesar Kartu & Foto"
                      >
                        +
                      </button>
                    </div>

                    {/* Jarak Antar Card Presisi mm */}
                    <div className="pt-1.5 border-t border-emerald-500/20 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-amber-300">
                          Jarak Antar Card: {cardGapMm} mm
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApplyCardGap(cardGapMm)}
                          className="px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[9.5px]"
                        >
                          Terapkan Jarak
                        </button>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={0.5}
                        value={cardGapMm}
                        onChange={(e) => setCardGapMm(Number(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                      />
                      <p className="text-[9px] opacity-80 leading-tight">
                        Pasangan menempel (0mm) • Anak/Cucu lajang rapat 1–2mm • Jarak umum {cardGapMm}mm.
                      </p>
                    </div>
                  </div>

                  {/* Gradasi Warna Generasi: Tua/Gelap (G1) -> Muda/Cerah (G5+) */}
                  <div className="p-2 rounded-xl border border-sky-500/30 bg-sky-500/10 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10.5px] font-extrabold text-sky-300">
                        Gradasi Warna Generasi (Card &amp; Garis)
                      </span>
                    </div>
                    <select
                      value={genGradientPalette}
                      onChange={(e) =>
                        setGenGradientPalette(e.target.value as GenGradientPaletteId)
                      }
                      className={`w-full px-2 py-1 rounded-lg text-[11px] font-bold border outline-hidden cursor-pointer ${
                        isDark
                          ? 'bg-[#0f172a] border-slate-700 text-white'
                          : 'bg-stone-50 border-stone-300 text-stone-900'
                      }`}
                    >
                      <option value="none">Polos / Ikuti Tema Kanvas</option>
                      <option value="lotus_blossom">Putik Emas (G1) ➔ Kelopak Teratai (G5+)</option>
                      <option value="wood_leaf">Coklat Kayu (G1) ➔ Hijau Daun (G5+)</option>
                      <option value="royal_emerald">Zamrud Tua (G1) ➔ Mint Cerah (G5+)</option>
                      <option value="ocean_blue">Biru Samudra (G1) ➔ Langit Cerah (G5+)</option>
                      <option value="amber_earth">Coklat Emas (G1) ➔ Krem Cerah (G5+)</option>
                      <option value="violet_dusk">Ungu Tua (G1) ➔ Lavender Cerah (G5+)</option>
                    </select>
                    {genGradientPalette !== 'none' && (
                      <div className="flex items-center gap-1 pt-0.5">
                        {GEN_GRADIENT_PALETTES[genGradientPalette].stops.map((st, gIdx) => (
                          <div
                            key={`grad-prev-${gIdx}`}
                            className="flex-1 h-4 rounded border flex items-center justify-center text-[8px] font-black"
                            style={{
                              backgroundColor: st.bg,
                              borderColor: st.border,
                              color: isLightHexColor(st.bg) ? '#0f172a' : '#f8fafc',
                            }}
                          >
                            G{gIdx + 1}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] opacity-75 block mb-0.5">Latar Belakang:</label>
                      <select
                        value={bgStyle}
                        onChange={(e) => setBgStyle(e.target.value as CanvasBackground)}
                        className={`w-full px-2 py-1 rounded-lg text-[11px] font-bold border outline-hidden cursor-pointer ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-white'
                            : 'bg-stone-50 border-stone-300 text-stone-900'
                        }`}
                      >
                        <option value="">Titik Grid</option>
                        <option value="bg-gunung">Gunung</option>
                        <option value="bg-pohon">Pohon</option>
                        <option value="bg-galaksi">Galaksi</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] opacity-75 block mb-0.5">Tema Kanvas:</label>
                      <button
                        type="button"
                        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                        className={`w-full px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-amber-300'
                            : 'bg-stone-50 border-stone-300 text-stone-900'
                        }`}
                      >
                        {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        <span>{isDark ? 'Mode Gelap' : 'Mode Terang'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                      <input
                        type="checkbox"
                        checked={safeHoldMove}
                        onChange={(e) => {
                          setSafeHoldMove(e.target.checked);
                          setMoveUnlockedIds([]);
                          setMoveAnchorId(null);
                        }}
                        className="accent-amber-500"
                      />
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Kunci Geser Aman (Tahan kartu 2 detik agar tak sengaja pindah)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                      <input
                        type="checkbox"
                        checked={showGenGuides}
                        onChange={(e) => setShowGenGuides(e.target.checked)}
                        className="accent-amber-500"
                      />
                      <span className="text-amber-300 font-bold">G1</span>
                      <span>Tampilkan Jalur &amp; Garis Penunjuk Generasi</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                      <input
                        type="checkbox"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                        className="accent-emerald-500"
                      />
                      <Grid className="w-3 h-3 text-emerald-400" />
                      <span>Tempel Rapi ke Grid 20px (Snap)</span>
                    </label>
                    <div className="pt-1 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleToggleStudioScreenMode()}
                        className={`w-full py-1.5 px-2.5 rounded-xl border text-[10.5px] font-bold flex items-center justify-between transition ${
                          studioScreenMode === 'landscape'
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : isDark
                            ? 'bg-slate-900 border-slate-700 text-sky-300 hover:border-sky-400'
                            : 'bg-stone-100 border-stone-300 text-sky-900'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>
                            {studioScreenMode === 'landscape'
                              ? 'Layar Miring (Lanskap Studio) Aktif'
                              : 'Putar Layar HP Miring (Ala Game)'}
                          </span>
                        </span>
                        <RotateCw className="w-3.5 h-3.5 shrink-0" />
                      </button>
                      <p className="text-[9.5px] opacity-70 leading-snug">
                        Memutar tampilan HP ke Lanskap tanpa mengubah orientasi &amp; ukuran kertas ({paperDim.label}{' '}
                        {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}).
                      </p>
                    </div>
                  </div>
                </div>

                {/* 1. Gaya Garis Konektor */}
                <div className="space-y-2 border-t pt-2.5 border-slate-700/40">
                  <div className="font-extrabold text-[11px] text-sky-400 flex items-center justify-between">
                    <span>1. Gaya Garis Konektor</span>
                    <span className="text-[9px] font-mono opacity-75">
                      {lineThickness}px
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        {
                          id: 'pcb90',
                          label: 'Siku 90° (PCB)',
                          path: 'M 4 4 L 4 12 L 24 12 L 24 20',
                        },
                        {
                          id: 'pcb45',
                          label: 'Jalur PCB 45°',
                          path: 'M 4 4 L 4 9 L 9 12 L 19 12 L 24 15 L 24 20',
                        },
                        {
                          id: 'straight',
                          label: 'Garis Lurus',
                          path: 'M 4 4 L 24 20',
                        },
                        {
                          id: 'curved',
                          label: 'Lengkung',
                          path: 'M 4 4 C 4 14, 24 10, 24 20',
                        },
                        {
                          id: 'none',
                          label: 'Tanpa Garis (Line Connector Off)',
                          path: '',
                        },
                      ] as const
                    ).map((opt) => {
                      const active = lineStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setLineStyle(opt.id)}
                          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                            opt.id === 'none' ? 'col-span-2' : ''
                          } ${
                            active
                              ? opt.id === 'none'
                                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-xs'
                                : 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-xs'
                              : isDark
                              ? 'bg-slate-900/70 border-slate-700 hover:border-sky-400'
                              : 'bg-stone-50 border-stone-200 hover:border-sky-500'
                          }`}
                        >
                          {opt.id === 'none' ? (
                            <svg width="28" height="24" className="shrink-0">
                              <line x1="4" y1="20" x2="24" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
                              <circle cx="6" cy="6" r="2.5" fill="currentColor" opacity="0.55" />
                              <circle cx="22" cy="18" r="2.5" fill="currentColor" opacity="0.55" />
                            </svg>
                          ) : (
                            <svg width="28" height="24" className="shrink-0">
                              <path
                                d={opt.path}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                              />
                              <circle cx="4" cy="4" r="2.2" fill="currentColor" />
                              <circle cx="24" cy="20" r="2.2" fill="currentColor" />
                            </svg>
                          )}
                          <span className="text-[10.5px] font-bold leading-tight">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Topologi Sambungan Garis Pintar (Anti-Silang) */}
                  {lineStyle !== 'none' && (
                    <div className="p-2 rounded-xl border border-violet-500/35 bg-violet-500/10 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-extrabold text-violet-300">
                          Sambungan Saudara (Anti-Silang):
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            {
                              id: 'sibling_chain_all' as const,
                              label: 'Rantai G1–G5',
                              desc: 'Ortu ke 1 anak, saudara sambung terdekat',
                            },
                            {
                              id: 'sibling_chain_g3plus' as const,
                              label: 'Hibrid G3–G5',
                              desc: 'G1–G2 langsung ortu, G3–G5 rantai',
                            },
                            {
                              id: 'direct' as const,
                              label: 'Langsung Ortu',
                              desc: 'Semua anak tarik garis ke ortu',
                            },
                          ] as const
                        ).map((tp) => {
                          const active = lineRoutingTopology === tp.id;
                          return (
                            <button
                              key={tp.id}
                              type="button"
                              onClick={() => setLineRoutingTopology(tp.id)}
                              title={tp.desc}
                              className={`px-1.5 py-1.5 rounded-lg border text-[9.5px] font-bold transition whitespace-nowrap ${
                                active
                                  ? 'bg-violet-500 text-slate-950 border-violet-300 shadow-xs'
                                  : isDark
                                  ? 'bg-slate-900/70 border-slate-700 text-slate-200 hover:border-violet-400'
                                  : 'bg-white border-stone-300 text-slate-800 hover:border-violet-500'
                              }`}
                            >
                              {tp.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[9.5px] opacity-80 leading-snug">
                        {lineRoutingTopology === 'sibling_chain_all'
                          ? 'Ortu hanya terhubung ke 1 anak terdekat; adik-kakak menyambung berantai warna beda agar bebas garis silang.'
                          : lineRoutingTopology === 'sibling_chain_g3plus'
                          ? 'G1–G2 langsung ke ortu agar hierarki utama tegas, lalu G3–G5 padat disambung antar saudara terdekat.'
                          : 'Mode klasik: setiap anak menarik garis langsung ke kartu orang tuanya.'}
                      </p>
                    </div>
                  )}

                  {lineStyle === 'none' && (
                    <div className="p-2 rounded-xl border border-amber-500/35 bg-amber-500/10 text-[10px] leading-snug text-amber-200">
                      <b>Tanpa Garis (Off):</b> Garis penghubung &amp; panah disembunyikan. Hierarki dibaca lewat gradasi warna (tua ➔ muda) &amp; kedekatan posisi kelompok keluarga inti.
                    </div>
                  )}

                  {/* Ketebalan Garis */}
                  {lineStyle !== 'none' && (
                    <>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] opacity-75">Tebal Garis:</span>
                        {[1.8, 2.5, 3.5].map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => {
                              setLineThicknessMode('uniform');
                              setLineThickness(w);
                            }}
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                              lineThicknessMode === 'uniform' && lineThickness === w
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : 'border-slate-600 opacity-75'
                            }`}
                          >
                            {w === 1.8 ? 'Tipis' : w === 2.5 ? 'Standar' : 'Tebal'}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setLineThicknessMode('tree_taper')}
                          title="Batang Pohon Bertingkat: Batang 100→50px • Dahan 70→40px • Ranting 45→20px"
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                            lineThicknessMode === 'tree_taper'
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'border-slate-600 opacity-75'
                          }`}
                        >
                          Batang Pohon (100➔20px)
                        </button>
                      </div>

                      {/* Anti-Tertutup Kartu & Panah & Titik Dot Geser Garis */}
                      <div className="p-2 rounded-xl border border-sky-500/30 bg-sky-500/10 space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                          <input
                            type="checkbox"
                            checked={showLineArrows}
                            onChange={(e) => setShowLineArrows(e.target.checked)}
                            className="accent-emerald-400"
                          />
                          <span className="font-bold text-emerald-300">
                            Panah arah silsilah (Ortu ➔ Anak &amp; Adik ➔ Kakak)
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                          <input
                            type="checkbox"
                            checked={linesOnTop}
                            onChange={(e) => setLinesOnTop(e.target.checked)}
                            className="accent-sky-400"
                          />
                          <span className="font-bold text-sky-300">
                            Tampilkan garis di atas kartu (anti-tertutup)
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                          <input
                            type="checkbox"
                            checked={showLineDots}
                            onChange={(e) => {
                              const v = e.target.checked;
                              setShowLineDots(v);
                              if (v) {
                                setEdges((prev) => prev.map((ed) => ({ ...ed, hideDot: false })));
                              }
                            }}
                            className="accent-amber-400"
                          />
                          <span>
                            Tampilkan dot tengah (geser posisi &amp; jalur 4 arah)
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                          <input
                            type="checkbox"
                            checked={showEndpointDots}
                            onChange={(e) => setShowEndpointDots(e.target.checked)}
                            className="accent-emerald-400"
                          />
                          <span>
                            Tampilkan dot ujung sambungan di tepi card
                          </span>
                        </label>
                        <div className="flex items-center justify-between gap-1.5 pt-0.5 flex-wrap">
                          <span className="text-[9px] opacity-75">
                            Ketuk garis / dot untuk pindah posisi dot atau hapus dot
                          </span>
                          <div className="flex items-center gap-1 ml-auto">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleAllEdgeDots(!(showLineDots || showEndpointDots))
                              }
                              className="px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-[9.5px] font-bold text-rose-200 shrink-0"
                            >
                              {showLineDots || showEndpointDots ? 'Hapus Semua Dot' : 'Munculkan Dot'}
                            </button>
                            <button
                              type="button"
                              onClick={resetAllEdgeOffsets}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[9.5px] font-bold text-sky-300 shrink-0"
                            >
                              Reset Garis
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. Pilihan Warna Garis */}
                <div className="space-y-2 border-t pt-2.5 border-slate-700/40">
                  <div className="font-extrabold text-[11px] text-amber-400">
                    2. Warna Garis Silsilah
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] opacity-80 font-semibold">
                        Garis Keturunan:
                      </span>
                      <input
                        type="color"
                        value={childLineColor || (isDark ? '#38bdf8' : '#0284c7')}
                        onChange={(e) => setChildLineColor(e.target.value)}
                        className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                        title="Pilih Warna Kustom Garis Keturunan"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {LINE_COLOR_SWATCHES.map((sw) => {
                        const isAct = childLineColor === sw.color;
                        return (
                          <button
                            key={`cl-${sw.label}`}
                            type="button"
                            onClick={() => setChildLineColor(sw.color)}
                            title={sw.label}
                            className={`h-5 px-1.5 rounded-md border text-[9px] font-bold flex items-center gap-1 ${
                              isAct
                                ? 'border-amber-400 ring-1 ring-amber-400'
                                : 'border-slate-600/60'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30"
                              style={{
                                backgroundColor:
                                  sw.color || (isDark ? '#38bdf8' : '#0284c7'),
                              }}
                            />
                            {sw.color === '' && <span>Auto</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] opacity-80 font-semibold">
                        Garis Pasangan:
                      </span>
                      <input
                        type="color"
                        value={coupleLineColor || '#f59e0b'}
                        onChange={(e) => setCoupleLineColor(e.target.value)}
                        className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                        title="Pilih Warna Kustom Garis Pasangan"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {LINE_COLOR_SWATCHES.filter((s) => s.color !== '').map((sw) => {
                        const isAct = coupleLineColor === sw.color;
                        return (
                          <button
                            key={`cp-${sw.label}`}
                            type="button"
                            onClick={() => setCoupleLineColor(sw.color)}
                            title={sw.label}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                              isAct
                                ? 'border-amber-400 ring-1 ring-amber-400'
                                : 'border-slate-600/60'
                            }`}
                            style={{ backgroundColor: sw.color }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {lineRoutingTopology !== 'direct' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] opacity-80 font-semibold text-violet-300">
                          Garis Saudara (Kakak–Adik):
                        </span>
                        <input
                          type="color"
                          value={siblingLineColor || (isDark ? '#a78bfa' : '#7c3aed')}
                          onChange={(e) => setSiblingLineColor(e.target.value)}
                          className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                          title="Pilih Warna Kustom Garis Saudara"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {LINE_COLOR_SWATCHES.map((sw) => {
                          const isAct = siblingLineColor === sw.color;
                          return (
                            <button
                              key={`sb-${sw.label}`}
                              type="button"
                              onClick={() => setSiblingLineColor(sw.color)}
                              title={sw.label}
                              className={`h-5 px-1.5 rounded-md border text-[9px] font-bold flex items-center gap-1 ${
                                isAct
                                  ? 'border-violet-400 ring-1 ring-violet-400'
                                  : 'border-slate-600/60'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/30"
                                style={{
                                  backgroundColor:
                                    sw.color || (isDark ? '#a78bfa' : '#7c3aed'),
                                }}
                              />
                              {sw.color === '' && <span>Auto</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Pilihan Warna Card / Kartu */}
                <div className="space-y-2 border-t pt-2.5 border-slate-700/40">
                  <div className="font-extrabold text-[11px] text-emerald-400">
                    3. Warna Card / Kartu Anggota
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] opacity-80 font-semibold">
                        Warna Latar Card (Semua):
                      </span>
                      <input
                        type="color"
                        value={cardBgColor || (isDark ? '#1e293b' : '#ffffff')}
                        onChange={(e) => setCardBgColor(e.target.value)}
                        className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                        title="Pilih Warna Kustom Latar Card"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {CARD_BG_SWATCHES.map((sw) => {
                        const isAct = cardBgColor === sw.color;
                        return (
                          <button
                            key={`cbg-${sw.label}`}
                            type="button"
                            onClick={() => setCardBgColor(sw.color)}
                            title={sw.label}
                            className={`h-5 px-1.5 rounded-md border text-[9px] font-bold flex items-center gap-1 ${
                              isAct
                                ? 'border-amber-400 ring-1 ring-amber-400'
                                : 'border-slate-600/60'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-sm border border-white/40"
                              style={{
                                backgroundColor:
                                  sw.color || (isDark ? '#1e293b' : '#ffffff'),
                              }}
                            />
                            {sw.color === '' && <span>Auto</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] opacity-80 font-semibold">
                        Warna Garis Tepi Card:
                      </span>
                      <input
                        type="color"
                        value={cardBorderColor || (isDark ? '#475569' : '#d6d3d1')}
                        onChange={(e) => setCardBorderColor(e.target.value)}
                        className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                        title="Pilih Warna Kustom Garis Tepi Card"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {CARD_BORDER_SWATCHES.map((sw) => {
                        const isAct = cardBorderColor === sw.color;
                        return (
                          <button
                            key={`cbd-${sw.label}`}
                            type="button"
                            onClick={() => setCardBorderColor(sw.color)}
                            title={sw.label}
                            className={`h-5 px-1.5 rounded-md border text-[9px] font-bold flex items-center gap-1 ${
                              isAct
                                ? 'border-amber-400 ring-1 ring-amber-400'
                                : 'border-slate-600/60'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30"
                              style={{
                                backgroundColor:
                                  sw.color || (isDark ? '#475569' : '#d6d3d1'),
                              }}
                            />
                            {sw.color === '' && <span>Auto</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedIds.length > 0 && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                      <div className="text-[10px] font-bold text-amber-300">
                        Warna Khusus ({selectedIds.length} Kartu Terpilih):
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[9.5px] flex items-center gap-1">
                          <span>Latar:</span>
                          <input
                            type="color"
                            value={
                              nodeMap.get(selectedIds[0])?.customBgColor ||
                              cardBgColor ||
                              (isDark ? '#1e293b' : '#ffffff')
                            }
                            onChange={(e) =>
                              updateSelectedField({ customBgColor: e.target.value })
                            }
                            className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>
                        <label className="text-[9.5px] flex items-center gap-1">
                          <span>Tepi:</span>
                          <input
                            type="color"
                            value={
                              nodeMap.get(selectedIds[0])?.customBorderColor ||
                              cardBorderColor ||
                              '#f59e0b'
                            }
                            onChange={(e) =>
                              updateSelectedField({
                                customBorderColor: e.target.value,
                              })
                            }
                            className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedField({
                              customBgColor: undefined,
                              customBorderColor: undefined,
                            })
                          }
                          className="ml-auto px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-[9px] text-white"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Keterangan Poster Silsilah */}
                <div className="space-y-2 border-t pt-2.5 border-slate-700/40">
                  <div className="font-extrabold text-[11px] text-amber-400 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>4. Keterangan Keluarga & Tahun</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px]">
                      <input
                        type="checkbox"
                        checked={captionInfo.show}
                        onChange={(e) =>
                          setCaptionInfo((c) => ({ ...c, show: e.target.checked }))
                        }
                        className="accent-amber-500"
                      />
                      <span>Tampilkan di Kanvas</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px]">
                      <input
                        type="checkbox"
                        checked={captionInfo.showLineLegend}
                        onChange={(e) =>
                          setCaptionInfo((c) => ({
                            ...c,
                            showLineLegend: e.target.checked,
                          }))
                        }
                        className="accent-sky-500"
                      />
                      <span>Legenda Garis</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-[10px] opacity-75 block mb-0.5">
                      Posisi Keterangan:
                    </label>
                    <select
                      value={captionInfo.position}
                      onChange={(e) =>
                        setCaptionInfo((c) => ({
                          ...c,
                          position: e.target.value as CaptionPosition,
                        }))
                      }
                      className={`w-full px-2 py-1 rounded-lg border text-[11px] font-bold outline-hidden ${
                        isDark
                          ? 'bg-[#0f172a] border-slate-700 text-white'
                          : 'bg-stone-50 border-stone-300 text-stone-900'
                      }`}
                    >
                      <option value="bottom-bar">Bawah Penuh (Title Block)</option>
                      <option value="bottom-right">Pojok Kanan Bawah</option>
                      <option value="bottom-left">Pojok Kiri Bawah</option>
                      <option value="top-center">Atas Tengah (Header Poster)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] opacity-75 block mb-0.5">
                      Nama Keluarga Besar:
                    </label>
                    <input
                      type="text"
                      value={captionInfo.familyTitle}
                      onChange={(e) =>
                        setCaptionInfo((c) => ({
                          ...c,
                          familyTitle: e.target.value,
                        }))
                      }
                      placeholder="Contoh: Keluarga Besar Bani Hasan"
                      className={`w-full px-2 py-1 rounded-lg border text-[11px] font-bold outline-hidden ${
                        isDark
                          ? 'bg-[#0f172a] border-slate-700 text-white'
                          : 'bg-stone-50 border-stone-300 text-stone-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] opacity-75 block mb-0.5">
                      Catatan / Motto / Daerah Asal:
                    </label>
                    <input
                      type="text"
                      value={captionInfo.subtitleNote}
                      onChange={(e) =>
                        setCaptionInfo((c) => ({
                          ...c,
                          subtitleNote: e.target.value,
                        }))
                      }
                      placeholder="Contoh: Bagan Silsilah Resmi • Yogyakarta"
                      className={`w-full px-2 py-1 rounded-lg border text-[11px] outline-hidden ${
                        isDark
                          ? 'bg-[#0f172a] border-slate-700 text-white'
                          : 'bg-stone-50 border-stone-300 text-stone-900'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] opacity-75 block mb-0.5">
                        Tahun Dibuat:
                      </label>
                      <input
                        type="text"
                        value={captionInfo.createdYear}
                        onChange={(e) =>
                          setCaptionInfo((c) => ({
                            ...c,
                            createdYear: e.target.value,
                          }))
                        }
                        placeholder="2026"
                        className={`w-full px-2 py-1 rounded-lg border text-[11px] font-mono outline-hidden ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-white'
                            : 'bg-stone-50 border-stone-300 text-stone-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] opacity-75 block mb-0.5">
                        Dibuat Oleh App:
                      </label>
                      <input
                        type="text"
                        value={captionInfo.createdByApp}
                        onChange={(e) =>
                          setCaptionInfo((c) => ({
                            ...c,
                            createdByApp: e.target.value,
                          }))
                        }
                        placeholder="NasabQu"
                        className={`w-full px-2 py-1 rounded-lg border text-[11px] font-bold outline-hidden ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-white'
                            : 'bg-stone-50 border-stone-300 text-stone-900'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] opacity-75 block mb-0.5">
                      Penyusun / Editor (Opsional):
                    </label>
                    <input
                      type="text"
                      value={captionInfo.curatorName}
                      onChange={(e) =>
                        setCaptionInfo((c) => ({
                          ...c,
                          curatorName: e.target.value,
                        }))
                      }
                      placeholder="Contoh: Disusun oleh H. Ahmad"
                      className={`w-full px-2 py-1 rounded-lg border text-[11px] outline-hidden ${
                        isDark
                          ? 'bg-[#0f172a] border-slate-700 text-white'
                          : 'bg-stone-50 border-stone-300 text-stone-900'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ) : panelTab === 'smart' ? (
              /* TAB SMART REKOMENDASI TATA LETAK DARI MENU TABEL */
              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-emerald-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Analisis Data Tabel Aktif</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-100 font-bold">
                      {smartAnalysis.recommendedPaper.toUpperCase()} Ideal
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-200 leading-relaxed">
                    {smartAnalysis.reason}
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApplySmartPreset(smartAnalysis.topPresetId)}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1 shadow-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Terapkan #1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAiQuotaInfo(getAiDesignerQuotaInfo());
                        setAiDesignError(null);
                        setIsAiDesignModalOpen(true);
                      }}
                      className="py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-black text-[11px] flex items-center gap-1 shadow-xs"
                      title="Racik Blueprint Desain AI (ringan: hanya struktur pohon/teratai/molekul tanpa kirim foto)"
                    >
                      <Sparkles className="w-3 h-3 text-amber-200" />
                      <span>Racik AI</span>
                    </button>
                    {onOpenTable && (
                      <button
                        type="button"
                        onClick={onOpenTable}
                        className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-emerald-300 font-bold text-[10px] flex items-center gap-1"
                        title="Lihat / ubah sumber data di Tabel Excel"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        <span>Tabel</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Kunci Kertas Pilihan (mis. A3) vs Kertas Ideal + Skala Foto Otomatis */}
                <div className="p-2 rounded-xl border border-slate-700/60 bg-black/15 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10.5px] font-bold">Target Kertas Smart:</span>
                    <div className="flex rounded-lg overflow-hidden border border-slate-600 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setLockSelectedPaper(true)}
                        className={`px-2 py-0.5 ${
                          lockSelectedPaper
                            ? 'bg-emerald-500 text-slate-950'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        title={`Tetap gunakan kertas ${paperDim.label} dan isi ruang kosongnya`}
                      >
                        Tetap {paperDim.label}
                      </button>
                      <button
                        type="button"
                        onClick={() => setLockSelectedPaper(false)}
                        className={`px-2 py-0.5 ${
                          !lockSelectedPaper
                            ? 'bg-amber-400 text-slate-950'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        title={`Ubah otomatis ke kertas ideal (${smartAnalysis.recommendedPaper.toUpperCase()})`}
                      >
                        Ideal ({smartAnalysis.recommendedPaper.toUpperCase()})
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                    <input
                      type="checkbox"
                      checked={applyRecommendedStyle}
                      onChange={(e) => setApplyRecommendedStyle(e.target.checked)}
                      className="accent-emerald-500"
                    />
                    <span>
                      Auto-skala ukuran foto &amp; kartu agar pas isi kertas (anti-kosong &amp; anti-tumpuk)
                    </span>
                  </label>

                  <div className="pt-1 border-t border-slate-700/40 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-emerald-300">
                        Skala Foto &amp; Kartu: {Math.round(cardScale * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={handleAutoFitCardScale}
                        className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9.5px]"
                      >
                        Pas-kan {paperDim.label}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={55}
                      max={155}
                      step={5}
                      value={Math.round(cardScale * 100)}
                      onChange={(e) => setCardScale(Number(e.target.value) / 100)}
                      className="w-full accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Jendela Fokus Cabang & Kedalaman Generasi (Solusi G1 s/d G20+ Anti-Kecil) */}
                <div className="p-2 rounded-xl border border-amber-500/35 bg-amber-500/10 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10.5px] font-extrabold text-amber-300">
                      Fokus Cabang &amp; Generasi (s/d G20+)
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/30 text-amber-200">
                      Total: {windowedData.maxRawGen + 1} Gen
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[9.5px] opacity-75 block mb-0.5">Fokus Dari Tokoh:</label>
                      <select
                        value={focalRootMemberId}
                        onChange={(e) => handleApplyFocalBranch(e.target.value, maxVisibleDepth)}
                        className={`w-full px-1.5 py-1 rounded-lg text-[10.5px] font-bold border outline-hidden cursor-pointer ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-white'
                            : 'bg-stone-50 border-stone-300 text-stone-900'
                        }`}
                      >
                        <option value="all">Semua (Dari G1)</option>
                        {[...activeTrah.members]
                          .sort(
                            (a, b) =>
                              (a.generationLevel ?? 0) - (b.generationLevel ?? 0) ||
                              (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
                          )
                          .map((m) => (
                            <option key={`focal-${m.id}`} value={m.id}>
                              G{(m.generationLevel ?? 0) + 1} • {m.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9.5px] opacity-75 block mb-0.5">Kedalaman Tampil:</label>
                      <select
                        value={maxVisibleDepth}
                        onChange={(e) =>
                          handleApplyFocalBranch(focalRootMemberId, Number(e.target.value))
                        }
                        className={`w-full px-1.5 py-1 rounded-lg text-[10.5px] font-bold border outline-hidden cursor-pointer ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-emerald-300'
                            : 'bg-stone-50 border-stone-300 text-emerald-900'
                        }`}
                      >
                        <option value={0}>Semua Generasi</option>
                        <option value={4}>4 Generasi (Besar)</option>
                        <option value={5}>5 Generasi (Ideal)</option>
                        <option value={6}>6 Generasi</option>
                      </select>
                    </div>
                  </div>
                  {(focalRootMemberId !== 'all' || maxVisibleDepth > 0) && (
                    <div className="flex items-center justify-between gap-1 text-[9.5px] text-emerald-300">
                      <span className="truncate">
                        Tampil {windowedMembers.length} dari {activeTrah.members.length} anggota
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplyFocalBranch('all', 0)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-white font-bold shrink-0"
                      >
                        Tampilkan Semua
                      </button>
                    </div>
                  )}
                  <p className="text-[9px] opacity-75 leading-snug">
                    Agar kartu tidak mengecil saat trah mencapai G10–G20, fokuskan 4–5 generasi dari tokoh cabang (data asli tabel &amp; buku tetap utuh).
                  </p>
                </div>

                {/* Filter Kategori Pilihan Tata Letak Smart */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-black/25 border border-slate-700/60">
                    {[
                      { id: 'all' as const, label: `Semua (${SMART_LAYOUT_PRESETS.length})` },
                      { id: 'kotak9' as const, label: 'Kotak 9' },
                      { id: 'orbit' as const, label: 'Orbit 1–5' },
                      { id: 'modular' as const, label: 'Modular I/L' },
                      { id: 'klasik' as const, label: 'Klasik' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSmartCategoryFilter(tab.id)}
                        className={`flex-1 py-1 px-1.5 rounded-lg text-[9.5px] font-extrabold whitespace-nowrap transition ${
                          smartCategoryFilter === tab.id
                            ? 'bg-emerald-500 text-slate-950 shadow-xs'
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Opsi Posisi G1-G2 untuk Mode Modular */}
                  {(smartCategoryFilter === 'modular' ||
                    activePresetId === 'modular_g3_I' ||
                    activePresetId === 'modular_g3_L') && (
                    <div className="p-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-emerald-300">
                        Posisi G1–G2 Besar:
                      </span>
                      <div className="flex rounded-lg overflow-hidden border border-slate-600 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setModularG12Position('top');
                            if (
                              activePresetId === 'modular_g3_I' ||
                              activePresetId === 'modular_g3_L'
                            ) {
                              handleApplySmartPreset(
                                activePresetId,
                                true,
                                undefined,
                                undefined,
                                'top'
                              );
                            }
                          }}
                          className={`px-2 py-0.5 ${
                            modularG12Position === 'top'
                              ? 'bg-amber-400 text-slate-950'
                              : 'opacity-75'
                          }`}
                        >
                          Atas
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModularG12Position('center');
                            if (
                              activePresetId === 'modular_g3_I' ||
                              activePresetId === 'modular_g3_L'
                            ) {
                              handleApplySmartPreset(
                                activePresetId,
                                true,
                                undefined,
                                undefined,
                                'center'
                              );
                            }
                          }}
                          className={`px-2 py-0.5 ${
                            modularG12Position === 'center'
                              ? 'bg-amber-400 text-slate-950'
                              : 'opacity-75'
                          }`}
                        >
                          Tengah
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {SMART_LAYOUT_PRESETS.filter(
                      (p) => smartCategoryFilter === 'all' || p.category === smartCategoryFilter
                    ).map((preset) => {
                      const isTop = preset.id === smartAnalysis.topPresetId;
                      const PresetIcon =
                        preset.id === 'kotak_9_baris'
                          ? Rows3
                          : preset.id === 'kotak_9_baris_g45_gabung'
                          ? Layers
                          : preset.id === 'orbit_elips_1_5'
                          ? CircleDot
                          : preset.id === 'orbit_elips_gabung'
                          ? Disc
                          : preset.id === 'teratai_mekar'
                          ? Sparkles
                          : preset.id === 'sarang_lebah_turun'
                          ? LayoutGrid
                          : preset.id === 'sarang_lebah_pusat' || preset.id === 'molekul_organik'
                          ? CircleDot
                          : preset.id === 'modular_g3_I' || preset.id === 'modular_g3_L'
                          ? Layers
                          : preset.id === 'tetris_silsilah'
                          ? LayoutGrid
                          : preset.id === 'hierarchy_grid_fill'
                          ? LayoutGrid
                          : preset.id === 'subtree_vertical'
                          ? GitBranch
                          : preset.id === 'subtree_horizontal'
                          ? ArrowRightLeft
                          : preset.id === 'family_cluster'
                          ? Users
                          : Sparkles;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          disabled={Boolean(preset.isLocked)}
                          onClick={() => handleApplySmartPreset(preset.id)}
                          className={`w-full text-left p-2 rounded-xl border transition flex items-center gap-2.5 group ${
                            preset.isLocked
                              ? isDark
                                ? 'bg-slate-900/40 border-slate-800 opacity-55 cursor-not-allowed'
                                : 'bg-stone-100 border-stone-200 opacity-60 cursor-not-allowed'
                              : isTop
                              ? isDark
                                ? 'bg-emerald-950/45 border-emerald-500/70 hover:border-amber-400'
                                : 'bg-emerald-50 border-emerald-400 hover:border-amber-500'
                              : isDark
                              ? 'bg-slate-900/75 border-slate-700/80 hover:border-amber-400 hover:bg-slate-800/90'
                              : 'bg-stone-50 border-stone-200 hover:border-amber-500 hover:bg-amber-50/40'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                              preset.isLocked
                                ? 'bg-stone-700/30 border-stone-600/40 text-stone-400'
                                : preset.category === 'orbit'
                                ? 'bg-sky-500/15 border-sky-400/40 text-sky-400'
                                : preset.category === 'kotak9'
                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-400'
                                : preset.category === 'modular'
                                ? 'bg-purple-500/15 border-purple-400/40 text-purple-300'
                                : 'bg-amber-500/15 border-amber-400/40 text-amber-400'
                            }`}
                          >
                            {preset.isLocked ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <PresetIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-[11px] leading-tight truncate">
                                {preset.title}
                              </span>
                              <span
                                className={`text-[8.5px] px-1.5 py-0.5 rounded font-black shrink-0 ${
                                  preset.isLocked
                                    ? 'bg-stone-700/80 text-stone-300'
                                    : isTop
                                    ? 'bg-amber-400 text-slate-950'
                                    : preset.category === 'orbit'
                                    ? 'bg-sky-500/20 text-sky-300'
                                    : preset.category === 'kotak9'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : preset.category === 'modular'
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'bg-slate-700/60 text-slate-300'
                                }`}
                              >
                                {preset.isLocked ? '🔒 Terkunci' : isTop ? '★' : preset.badge}
                              </span>
                            </div>
                            <div className="text-[9.5px] opacity-75 truncate mt-0.5">
                              {preset.subtitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[9.5px] opacity-65 leading-snug border-t pt-2 border-slate-700/40">
                  Ketuk salah satu tata letak di atas untuk langsung menata &amp; bebas geser manual (gunakan <b>Undo</b> jika ingin kembali).
                </p>

                {/* Opsi Lanjutan: Teks Manual Cepat */}
                <details className="border-t pt-2 border-slate-700/40">
                  <summary className="cursor-pointer text-[10.5px] font-bold opacity-80 hover:opacity-100">
                    ⚙️ Mode Teks Manual (Lanjutan)
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      value={quickText}
                      onChange={(e) => setQuickText(e.target.value)}
                      rows={4}
                      placeholder="Baris = Generasi, Koma = Saudara, + = Pasangan"
                      className={`w-full rounded-xl p-2 text-xs font-mono border outline-hidden ${
                        isDark
                          ? 'bg-[#0f172a] border-slate-700 text-emerald-100 focus:border-amber-400'
                          : 'bg-stone-50 border-stone-300 text-stone-900 focus:border-amber-500'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => generateFromQuickText()}
                      className="w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shadow-xs"
                    >
                      Terapkan Teks Manual ke Kanvas ({paperDim.label})
                    </button>
                  </div>
                </details>
              </div>
            ) : panelTab === 'designs' ? (
              /* TAB MANAJEMEN DESAIN: SIMPAN, EDIT KEMBALI, BUAT BARU */
              <div className="space-y-3 text-xs">
                <div className="space-y-1.5 bg-black/20 p-2.5 rounded-xl border border-slate-700/50">
                  <label className="text-[10px] font-bold text-amber-400 uppercase block">
                    Nama Desain Aktif:
                  </label>
                  <input
                    type="text"
                    value={designNameInput}
                    onChange={(e) => setDesignNameInput(e.target.value)}
                    placeholder="Contoh: Desain A3 Keluarga Besar"
                    className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold outline-hidden ${
                      isDark
                        ? 'bg-[#0f172a] border-slate-700 text-white'
                        : 'bg-white border-stone-300 text-stone-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleSaveNamedDesign}
                    className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan Desain Ini</span>
                  </button>
                </div>

                {/* Buat Desain Baru */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold opacity-75 uppercase block">
                    Buat Desain Baru (Tanpa Menimpa Lama):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCreateNewDesign('from_trah')}
                      className="py-2 px-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Dari Data Trah</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCreateNewDesign('blank')}
                      className={`py-2 px-2 rounded-xl border font-bold text-[11px] flex items-center justify-center gap-1 ${
                        isDark
                          ? 'bg-slate-800 border-slate-600 text-white hover:border-amber-400'
                          : 'bg-stone-100 border-stone-300 text-stone-800'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Kanvas Kosong</span>
                    </button>
                  </div>
                </div>

                {/* Daftar Desain Tersimpan (Edit Kembali) */}
                <div className="space-y-1.5 pt-2 border-t border-slate-700/40">
                  <span className="text-[10px] font-bold opacity-75 uppercase block">
                    Daftar Desain Tersimpan (Klik untuk Edit Kembali):
                  </span>
                  <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                    {savedDesigns.map((d) => {
                      const isCurrent = d.id === activeDesignId;
                      return (
                        <div
                          key={d.id}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition ${
                            isCurrent
                              ? 'bg-emerald-950/60 border-emerald-500 text-white'
                              : isDark
                              ? 'bg-slate-900/70 border-slate-700 hover:border-amber-400'
                              : 'bg-stone-50 border-stone-200 hover:border-amber-500'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleLoadDesign(d)}
                            className="flex-1 text-left min-w-0"
                          >
                            <div className="font-extrabold text-xs truncate">
                              {d.name}
                            </div>
                            <div className="text-[10px] opacity-70 font-mono">
                              {d.paperSize.toUpperCase()} {d.paperOrientation} •{' '}
                              {d.nodes.length} Kartu
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDesign(d.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20"
                            title="Hapus Desain"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* TAB EDIT KARTU TERPILIH */
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-amber-500">
                    ✏️ Edit Kartu Terpilih ({selectedIds.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === nodes.length ? [] : nodes.map((n) => n.id)
                      )
                    }
                    className="text-[10px] font-bold text-sky-400 hover:underline"
                  >
                    {selectedIds.length === nodes.length && nodes.length > 0
                      ? 'Batal Semua'
                      : 'Pilih Semua'}
                  </button>
                </div>

                {selectedIds.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed border-slate-600/60 space-y-1.5 text-[11px] opacity-80 leading-relaxed">
                    <p>
                      Ketuk <b>1 kartu</b> di kanvas untuk mengubah nama, keterangan, foto, atau menandai wafat.
                    </p>
                    <p>
                      Ketuk tombol <b>Pilih</b> (atau seret kotak di area kosong) untuk memilih <b>beberapa kartu</b> sekaligus, lalu gabungkan ke <b>1 Card Besar</b> atau <b>Group</b>.
                    </p>
                  </div>
                ) : selectedIds.length > 1 ? (
                  <div className="space-y-2.5 text-xs">
                    <p className="text-[11px] text-emerald-400 font-bold">
                      {selectedIds.length} kartu sedang dipilih!
                    </p>
                    <button
                      type="button"
                      onClick={handleMergeSelectedIntoBigCard}
                      className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:brightness-110 text-slate-950 font-black text-[11.5px] flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Gabung Jadi 1 Card Besar (1 Garis)</span>
                    </button>
                    <p className="text-[10px] opacity-75 leading-snug">
                      Foto/kartu bergabung jadi 1 frame besar, garis penghubung diringkas jadi 1, dan kartu lain tetap di posisinya.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-700/40">
                      <button
                        type="button"
                        onClick={handleGroupSelected}
                        className="py-1.5 px-2 rounded-lg bg-purple-600 text-white font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <Group className="w-3.5 h-3.5" />
                        <span>Group Drag</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleUngroupSelected}
                        className="py-1.5 px-2 rounded-lg border border-slate-600 text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Ungroup className="w-3.5 h-3.5" />
                        <span>Lepas Group</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={deleteSelectedNodes}
                      className="w-full py-1.5 rounded-lg border border-rose-500 text-rose-400 font-bold text-[11px]"
                    >
                      Hapus {selectedIds.length} Kartu Terpilih
                    </button>
                  </div>
                ) : primarySelectedNode?.mergedMembers &&
                  primarySelectedNode.mergedMembers.length >= 2 ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="p-2 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-1">
                      <div className="font-extrabold text-[11px] text-amber-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Card Besar Gabungan ({primarySelectedNode.mergedMembers.length} Foto)</span>
                      </div>
                      <p className="text-[10px] opacity-80">
                        Menyatukan beberapa anggota dalam 1 card dengan garis tunggal.
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold opacity-75 block mb-1">
                        Judul Kartu Gabungan
                      </label>
                      <input
                        type="text"
                        value={primarySelectedNode.name}
                        onChange={(e) =>
                          updateSelectedField({ name: e.target.value })
                        }
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold outline-hidden ${
                          isDark
                            ? 'bg-[#0f172a] border-slate-700 text-white'
                            : 'bg-stone-50 border-stone-300 text-stone-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold opacity-75 block mb-1">
                        Pola Tata Letak Dalam Card (Modular)
                      </label>
                      <div className="grid grid-cols-3 gap-1 mb-2">
                        {(
                          [
                            { id: 'grid' as const, label: 'Grid Rapi' },
                            { id: 'I' as const, label: 'Pola I (Turun)' },
                            { id: 'L' as const, label: 'Pola L (Siku)' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              handleUpdateModularSubLayout(primarySelectedNode.id, opt.id)
                            }
                            className={`py-1 rounded-lg border text-[10px] font-bold ${
                              (primarySelectedNode.modularSubLayout || 'grid') === opt.id
                                ? 'bg-purple-500 text-white border-purple-400'
                                : 'border-slate-600 opacity-80'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <label className="text-[10px] font-bold opacity-75 block mb-1">
                        Susunan Kolom Foto di Dalam Card
                      </label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { label: 'Auto', val: undefined },
                          { label: '2 Kol', val: 2 },
                          { label: '3 Kol', val: 3 },
                          { label: '4 Kol', val: 4 },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() =>
                              handleUpdateMergedCols(primarySelectedNode.id, opt.val)
                            }
                            className={`py-1 rounded-lg border text-[10px] font-bold ${
                              primarySelectedNode.mergedCols === opt.val
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'border-slate-600 opacity-80'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold opacity-75 block">
                        Anggota Tergabung (Klik L/P untuk ubah gender &amp; sinkronkan):
                      </span>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {primarySelectedNode.mergedMembers.map((mm, mIdx) => (
                          <div
                            key={`${mm.originalNodeId}_${mIdx}`}
                            className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-black/20 border border-slate-700/50 text-[10.5px]"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-amber-400 font-bold shrink-0">
                                {mIdx + 1}.
                              </span>
                              <span className="truncate font-semibold">{mm.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleMergedMemberGender(primarySelectedNode.id, mIdx)
                              }
                              title="Klik untuk ubah Pria (L) / Wanita (P)"
                              className={`shrink-0 px-1.5 py-0.5 rounded border text-[9.5px] font-black transition ${
                                mm.gender === 'P'
                                  ? 'bg-rose-500/90 text-white border-rose-400'
                                  : 'bg-sky-500/90 text-slate-950 border-sky-400'
                              }`}
                            >
                              {mm.gender === 'P' ? '👩 P' : '👨 L'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnmergeSelectedCard(primarySelectedNode.id)}
                      className="w-full py-2 px-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[11px] flex items-center justify-center gap-1.5"
                    >
                      <Split className="w-3.5 h-3.5" />
                      <span>
                        Pisah Kembali ke {primarySelectedNode.mergedMembers.length} Card
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={removeConnectionsOfSelected}
                        className="py-1.5 px-2 rounded-lg border border-slate-600 hover:border-amber-400 text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Putus Garis</span>
                      </button>
                      <button
                        type="button"
                        onClick={deleteSelectedNodes}
                        className="py-1.5 px-2 rounded-lg border border-rose-500 text-rose-500 hover:bg-rose-500/10 text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Hapus Card</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  primarySelectedNode && (
                    <div className="space-y-2.5 text-xs">
                      {primarySelectedNode.memberId && (
                        <button
                          type="button"
                          onClick={() =>
                            handleApplyFocalBranch(
                              primarySelectedNode.memberId!,
                              maxVisibleDepth || 5
                            )
                          }
                          className="w-full py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-300 font-extrabold text-[11px] flex items-center justify-center gap-1.5"
                          title="Jadikan tokoh ini puncak G1 tampilan kanvas agar cabang keturunannya tampil besar & jelas"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Fokuskan Cabang Ini ke Kanvas</span>
                        </button>
                      )}
                      <div>
                        <label className="text-[10px] font-bold opacity-75 block mb-1">
                          Nama Lengkap
                        </label>
                        <input
                          type="text"
                          value={primarySelectedNode.name}
                          onChange={(e) =>
                            updateSelectedField({ name: e.target.value })
                          }
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold outline-hidden ${
                            isDark
                              ? 'bg-[#0f172a] border-slate-700 text-white'
                              : 'bg-stone-50 border-stone-300 text-stone-900'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold opacity-75 block mb-1">
                          Jenis Kelamin
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateSelectedField({ gender: 'L' })}
                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                              (primarySelectedNode.gender || 'L') === 'L'
                                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-xs'
                                : isDark
                                ? 'bg-[#0f172a] border-slate-700 text-slate-300'
                                : 'bg-stone-50 border-stone-300 text-stone-700'
                            }`}
                          >
                            <span>👨</span>
                            <span>Pria (L)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSelectedField({ gender: 'P' })}
                            className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                              primarySelectedNode.gender === 'P'
                                ? 'bg-rose-500 text-white border-rose-400 shadow-xs'
                                : isDark
                                ? 'bg-[#0f172a] border-slate-700 text-slate-300'
                                : 'bg-stone-50 border-stone-300 text-stone-700'
                            }`}
                          >
                            <span>👩</span>
                            <span>Wanita (P)</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold opacity-75 block mb-1">
                          Keterangan (Tahun / Kota)
                        </label>
                        <input
                          type="text"
                          value={primarySelectedNode.sub}
                          placeholder="Contoh: 1950-2020 | Bogor"
                          onChange={(e) =>
                            updateSelectedField({ sub: e.target.value })
                          }
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-hidden ${
                            isDark
                              ? 'bg-[#0f172a] border-slate-700 text-white'
                              : 'bg-stone-50 border-stone-300 text-stone-900'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold opacity-75 block mb-1">
                          Upload Foto (Auto-Kompres Ringan)
                        </label>
                        <label className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded-lg border border-dashed border-amber-500/60 hover:bg-amber-500/10 cursor-pointer text-[11px] font-bold">
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pilih Foto dari Perangkat</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                        {primarySelectedNode.photo && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                showNotification('Meng-upscale foto ke HD (2.5× tajam & penuh warna)...');
                                const hdUrl = await upscaleImageToHdDataUrl(
                                  primarySelectedNode.photo,
                                  {
                                    scaleFactor: 2.5,
                                    minDimension: 960,
                                    maxDimension: 1440,
                                    outputMime: 'image/png',
                                  }
                                );
                                const safeName = (primarySelectedNode.name || 'Anggota')
                                  .replace(/[^a-zA-Z0-9\s_-]/g, '')
                                  .trim()
                                  .replace(/\s+/g, '_');
                                await saveOrShareFileBlob(
                                  dataUrlToBlob(hdUrl),
                                  `${safeName || 'Foto'}_HD_Upscale.png`,
                                  `Foto HD ${primarySelectedNode.name}`
                                );
                                showNotification('Foto HD hasil auto-upscale berhasil diunduh!');
                              } catch {
                                showNotification('Gagal mengunduh foto HD.');
                              }
                            }}
                            className="mt-1.5 w-full py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[10.5px] font-bold flex items-center justify-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh Foto HD (Auto-Upscale 2.5×)</span>
                          </button>
                        )}
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium">
                        <input
                          type="checkbox"
                          checked={primarySelectedNode.wafat}
                          onChange={(e) =>
                            updateSelectedField({ wafat: e.target.checked })
                          }
                          className="accent-amber-500"
                        />
                        <span>Tandai Sudah Wafat (Garis Putus-putus)</span>
                      </label>

                      <div className="pt-1">
                        <label className="text-[10px] font-bold opacity-75 block mb-1">
                          Tipe Garis saat Hubungkan:
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConnectType('child')}
                            className={`py-1 rounded-lg border text-[10px] font-bold ${
                              connectType === 'child'
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : 'border-slate-600 opacity-75'
                            }`}
                          >
                            Keturunan
                          </button>
                          <button
                            type="button"
                            onClick={() => setConnectType('couple')}
                            className={`py-1 rounded-lg border text-[10px] font-bold ${
                              connectType === 'couple'
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'border-slate-600 opacity-75'
                            }`}
                          >
                            Pasangan
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={removeConnectionsOfSelected}
                          className="py-1.5 px-2 rounded-lg border border-slate-600 hover:border-amber-400 text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Unlink className="w-3 h-3" />
                          <span>Putus Garis</span>
                        </button>
                        <button
                          type="button"
                          onClick={deleteSelectedNodes}
                          className="py-1.5 px-2 rounded-lg border border-rose-500 text-rose-500 hover:bg-rose-500/10 text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus Kartu</span>
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </aside>
        )}

        {/* Viewport GPU Artboard Kertas A0 - A4 (Pan & Pinch-Zoom 0 Re-Render) */}
        <div
          ref={viewportRef}
          onTouchStart={handleViewportTouchStart}
          onWheel={handleViewportWheel}
          style={{ touchAction: 'none' }}
          className={`flex-1 relative overflow-hidden touch-none select-none print-flow-unlock ${
            isPanMode || studioWorkspaceMode === 'smart'
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-default'
          }`}
        >
          <div
            id="grid-gpu-stage"
            ref={stageTransformRef}
            style={{
              transformOrigin: 'top left',
              willChange: 'transform',
            }}
            className="absolute top-0 left-0 print:static print:transform-none"
          >
            <div
              id="printable-pcb-preview"
              ref={boardRef}
              onMouseDown={handleBoardMouseDown}
              style={{
                width: `${boardWidth}px`,
                height: `${boardHeight}px`,
                ...getBoardBackgroundStyle(),
              }}
              className={`relative rounded-xl border-2 shadow-2xl overflow-hidden print:shadow-none print:border-none ${
                isDark ? 'border-slate-700' : 'border-stone-300'
              }`}
            >
              {/* Watermark Info Kertas & Desain Aktif (Khusus Layar) */}
              <div className="absolute top-3 left-4 z-10 flex items-center gap-2 pointer-events-none opacity-85 print:hidden">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/50 text-amber-300 border border-amber-400/30 backdrop-blur-xs">
                  {paperDim.label} {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'} ({printPaperWmm}×{printPaperHmm}mm)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/40 text-white/85">
                  {(() => {
                    const tableCount = activeTrah.members.length;
                    const spCount = activeTrah.members.reduce(
                      (s, m) => s + (m.spouses?.length || 0),
                      0
                    );
                    const memberLabel =
                      windowedMembers.length < tableCount
                        ? `${windowedMembers.length}/${tableCount} Anggota`
                        : `${tableCount} Anggota${spCount > 0 ? ` (+${spCount} Pasangan)` : ''}`;
                    return `${designNameInput || activeTrah.name} • ${memberLabel} • ${nodes.length} Kartu`;
                  })()}
                </span>
              </div>

              {/* Pita & Garis Penunjuk Generasi / 9 Baris Simetris / Orbit 1-5 */}
              {showGenGuides && guideOverlayMode === 'grid_9_rows' && (
                (() => {
                  const rowLabels = [
                    'BARIS 1 · G5 (Atas)',
                    'BARIS 2 · G5 (Atas)',
                    'BARIS 3 · G4 (Atas)',
                    'BARIS 4 · G3 (1–4)',
                    'BARIS 5 · G1–G2 (Pusat)',
                    'BARIS 6 · G3 (5–8)',
                    'BARIS 7 · G4 (Bawah)',
                    'BARIS 8 · G5 (Bawah)',
                    'BARIS 9 · G5 (Bawah)',
                  ];
                  const minY = 66;
                  const bandH = Math.max(36, (boardHeight - minY - 26) / 9);
                  return rowLabels.map((lbl, rIdx) => {
                    const isCenterRow = rIdx === 4;
                    return (
                      <div
                        key={`row9-band-${rIdx}`}
                        style={{
                          top: `${Math.round(minY + rIdx * bandH)}px`,
                          height: `${Math.round(bandH)}px`,
                        }}
                        className={`absolute left-0 right-0 pointer-events-none z-[1] border-t border-dashed flex items-center ${
                          isCenterRow
                            ? isDark || bgStyle !== ''
                              ? 'border-amber-400/45 bg-amber-500/[0.05]'
                              : 'border-amber-600/40 bg-amber-500/[0.06]'
                            : isDark || bgStyle !== ''
                            ? 'border-emerald-400/20 bg-white/[0.015]'
                            : 'border-emerald-600/15 bg-emerald-500/[0.02]'
                        }`}
                      >
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded text-[8.5px] font-black tracking-wide border ${
                            isCenterRow
                              ? isDark || bgStyle !== ''
                                ? 'bg-amber-950/90 border-amber-400/60 text-amber-200'
                                : 'bg-amber-100 border-amber-500 text-amber-900'
                              : isDark || bgStyle !== ''
                              ? 'bg-slate-900/80 border-slate-700 text-emerald-300'
                              : 'bg-white/85 border-emerald-300 text-emerald-800'
                          }`}
                        >
                          {lbl}
                        </span>
                      </div>
                    );
                  });
                })()
              )}

              {showGenGuides && guideOverlayMode === 'orbit_rings' && (
                <svg
                  width={boardWidth}
                  height={boardHeight}
                  className="absolute inset-0 pointer-events-none z-[1]"
                >
                  {(() => {
                    const cx = boardWidth / 2;
                    const cy = 72 + Math.max(240, boardHeight - 160) / 2;
                    const maxRx = Math.max(180, boardWidth / 2 - 75);
                    const maxRy = Math.max(140, (boardHeight - 160) / 2 - 42);
                    const isLotus = activePresetId === 'teratai_mekar';
                    const rings = isLotus
                      ? [
                          { num: 1, factor: 0.25, label: 'PUTIK EMAS · G1–G2', accent: '#fbbf24' },
                          { num: 2, factor: 0.48, label: 'KELOPAK I · G3', accent: '#f472b6' },
                          { num: 3, factor: 0.72, label: 'KELOPAK II · G4', accent: '#f9a8d4' },
                          { num: 4, factor: 0.94, label: 'UJUNG KELOPAK · G5+', accent: '#fbcfe8' },
                        ]
                      : [
                          { num: 1, factor: 0.22, label: 'ORBIT 1 · G1–G2', accent: '#f59e0b' },
                          { num: 2, factor: 0.44, label: 'ORBIT 2 · G3', accent: '#38bdf8' },
                          { num: 3, factor: 0.63, label: 'ORBIT 3 · G4', accent: '#34d399' },
                          { num: 4, factor: 0.81, label: 'ORBIT 4 · G4', accent: '#a78bfa' },
                          { num: 5, factor: 0.98, label: 'ORBIT 5 · G5+', accent: '#fb7185' },
                        ];
                    return (
                      <>
                        {isLotus &&
                          Array.from({ length: 12 }).map((_, rayIdx) => {
                            const ang = (rayIdx * Math.PI * 2) / 12;
                            const x2 = cx + Math.cos(ang) * maxRx * 0.98;
                            const y2 = cy + Math.sin(ang) * maxRy * 0.98;
                            return (
                              <line
                                key={`lotus-ray-${rayIdx}`}
                                x1={cx}
                                y1={cy}
                                x2={x2}
                                y2={y2}
                                stroke="#f472b6"
                                strokeWidth={1}
                                strokeOpacity={isDark || bgStyle !== '' ? 0.16 : 0.24}
                                strokeDasharray="3 6"
                              />
                            );
                          })}
                        {rings.map((rg) => {
                          const rx = Math.round(maxRx * rg.factor);
                          const ry = Math.round(maxRy * rg.factor);
                          return (
                            <g key={`orbit-ring-${rg.num}`}>
                              <ellipse
                                cx={cx}
                                cy={cy}
                                rx={rx}
                                ry={ry}
                                fill="none"
                                stroke={rg.accent}
                                strokeWidth={rg.num === 1 ? 1.8 : 1.2}
                                strokeOpacity={isDark || bgStyle !== '' ? 0.34 : 0.42}
                                strokeDasharray="6 5"
                              />
                              <text
                                x={cx}
                                y={Math.max(66, cy - ry + 13)}
                                textAnchor="middle"
                                fontSize="9.5"
                                fontWeight="800"
                                fill={rg.accent}
                                fillOpacity={isDark || bgStyle !== '' ? 0.8 : 0.9}
                              >
                                {rg.label}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              )}

              {guideOverlayMode === 'gen_bands' &&
                generationGuideBands.map((band) => (
                  <div
                    key={`gen-band-${band.gen}`}
                    style={{
                      top: `${band.top}px`,
                      height: `${band.height}px`,
                    }}
                    className={`absolute left-0 right-0 pointer-events-none z-[1] border-t border-b border-dashed flex items-center ${
                      isDark || bgStyle !== ''
                        ? 'border-amber-400/20 bg-white/[0.02]'
                        : 'border-amber-600/20 bg-amber-500/[0.03]'
                    }`}
                  >
                    <span
                      className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider border ${
                        isDark || bgStyle !== ''
                          ? 'bg-slate-900/80 border-amber-500/40 text-amber-300'
                          : 'bg-amber-50/90 border-amber-400/50 text-amber-800'
                      }`}
                    >
                      {band.label}
                    </span>
                  </div>
                ))}

              {showGenGuides && guideOverlayMode === 'modular_center' && (
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 pointer-events-none z-[1] flex items-center justify-center print:hidden">
                  <div
                    className={`w-full border-t border-dashed ${
                      isDark || bgStyle !== '' ? 'border-emerald-400/20' : 'border-emerald-600/20'
                    }`}
                  />
                  <span
                    className={`absolute px-2.5 py-0.5 rounded-full text-[8.5px] font-black tracking-wider border ${
                      isDark || bgStyle !== ''
                        ? 'bg-slate-950/80 border-emerald-500/35 text-emerald-300'
                        : 'bg-white/85 border-emerald-400/50 text-emerald-800'
                    }`}
                  >
                    POROS PUSAT G1–G2 • GRADASI TUA ➔ MUDA
                  </span>
                </div>
              )}

              {/* Kotak Pembatas Group (Dashed Box) */}
              {groupBoxes.map((gb) => (
                <div
                  key={gb.groupId}
                  style={{
                    left: `${gb.x}px`,
                    top: `${gb.y}px`,
                    width: `${gb.w}px`,
                    height: `${gb.h}px`,
                  }}
                  className="absolute border-2 border-dashed border-purple-400/70 bg-purple-500/5 rounded-2xl pointer-events-none z-[2]"
                >
                  <span className="absolute -top-2.5 left-3 px-1.5 py-0.2 rounded bg-purple-600 text-white text-[9px] font-bold">
                    Group ({gb.count})
                  </span>
                </div>
              ))}

              {/* Kotak Seleksi Marquee (Saat user drag kotak di area kosong) */}
              {marqueeBox && (
                <div
                  style={{
                    left: `${marqueeBox.x}px`,
                    top: `${marqueeBox.y}px`,
                    width: `${marqueeBox.w}px`,
                    height: `${marqueeBox.h}px`,
                  }}
                  className="absolute border-2 border-sky-400 bg-sky-400/15 rounded-md pointer-events-none z-50"
                />
              )}

              {/* Lapisan Hybrid Snapshot <canvas> super ringan untuk Overview Trah Besar */}
              <GridHybridSnapshotCanvas
                visible={useSnapshotOverview}
                boardWidth={boardWidth}
                boardHeight={boardHeight}
                nodes={nodes}
                computedEdges={computedEdges}
                treeSkeleton={treeSkeletonMemo}
                lineageHulls={lineageHullsMemo}
                lotusHalos={lotusHalosMemo}
                selectedIds={selectedIds}
                lineStyle={lineStyle}
                lineThickness={lineThickness}
                cardDisplayMode={cardDisplayMode}
                cardFrameMode={cardFrameMode}
                photoFrameSize={photoFrameSize}
                photoShape={photoShape}
                cardScale={cardScale}
                genGradientPalette={genGradientPalette}
                cardBgColor={cardBgColor}
                cardBorderColor={cardBorderColor}
                isDark={isDark}
                bgStyle={bgStyle}
              />

              {/* Lapisan Pembatas Warna Bertingkat Sarang Lebah (G2 ⊃ G3 ⊃ G4) & Aura Kolam Teratai */}
              {!useSnapshotOverview && (lineageHullsMemo.length > 0 || lotusHalosMemo.length > 0) && (
                <svg
                  width={boardWidth}
                  height={boardHeight}
                  className="absolute inset-0 pointer-events-none z-[2]"
                >
                  {lineageHullsMemo.map((hull) => (
                    <path
                      key={hull.id}
                      d={hull.d}
                      fill={hull.fill}
                      stroke={hull.stroke}
                      strokeWidth={hull.strokeWidth}
                      strokeDasharray={hull.dash}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {lotusHalosMemo.map((halo) => (
                    <ellipse
                      key={halo.id}
                      cx={halo.cx}
                      cy={halo.cy}
                      rx={halo.rx}
                      ry={halo.ry}
                      fill={halo.fill}
                      stroke={halo.stroke}
                      strokeWidth={halo.strokeWidth ?? 1.5}
                      strokeDasharray={halo.solid ? undefined : '5 5'}
                    />
                  ))}
                </svg>
              )}

              {/* Lapisan Akar, Batang, Dahan & Ranting Pohon Besar (2 Lapis terpisah tegas + Bayangan) */}
              {!useSnapshotOverview && treeSkeletonMemo && (
                <svg
                  width={boardWidth}
                  height={boardHeight}
                  className="absolute inset-0 pointer-events-none z-[2]"
                >
                  <defs>
                    <filter
                      id="tree-wood-shadow"
                      x="-15%"
                      y="-15%"
                      width="130%"
                      height="130%"
                    >
                      <feDropShadow
                        dx="0"
                        dy="5"
                        stdDeviation="5"
                        floodColor="#000000"
                        floodOpacity="0.34"
                      />
                    </filter>
                  </defs>
                  <g filter="url(#tree-wood-shadow)">
                    {treeSkeletonMemo.rootPaths.map((rp, rIdx) => (
                      <path
                        key={`tr-root-${rIdx}`}
                        d={rp.d}
                        fill={rp.color}
                        stroke={rp.strokeColor || '#290f02'}
                        strokeWidth={1.6}
                        strokeLinejoin="round"
                      />
                    ))}
                    {treeSkeletonMemo.trunkOuterPaths.map((tp, tIdx) => (
                      <path
                        key={`tr-out-${tIdx}`}
                        d={tp.d}
                        fill={tp.color}
                        stroke={tp.strokeColor || '#290f02'}
                        strokeWidth={2}
                        strokeLinejoin="round"
                      />
                    ))}
                    {treeSkeletonMemo.boughPaths.map((bp, bIdx) => (
                      <g key={`tr-bough-${bIdx}`}>
                        <path
                          d={bp.d}
                          fill={bp.color}
                          stroke={bp.strokeColor || '#290f02'}
                          strokeWidth={2}
                          strokeLinejoin="round"
                        />
                        {bp.innerD && bp.innerColor && (
                          <path d={bp.innerD} fill={bp.innerColor} opacity={0.88} />
                        )}
                      </g>
                    ))}
                    {treeSkeletonMemo.twigPaths.map((tp, twIdx) => (
                      <g key={`tr-twig-${twIdx}`}>
                        <path
                          d={tp.d}
                          fill={tp.color}
                          stroke={tp.strokeColor || '#290f02'}
                          strokeWidth={1.6}
                          strokeLinejoin="round"
                        />
                        {tp.innerD && tp.innerColor && (
                          <path d={tp.innerD} fill={tp.innerColor} opacity={0.85} />
                        )}
                      </g>
                    ))}
                    {treeSkeletonMemo.trunkInnerPaths.map((ti, tiIdx) => (
                      <path
                        key={`tr-in-${tiIdx}`}
                        d={ti.d}
                        fill={ti.color}
                        opacity={0.9}
                      />
                    ))}
                    {treeSkeletonMemo.accentLeaves.map((lf, lIdx) => (
                      <g
                        key={`tr-leaf-${lIdx}`}
                        transform={`translate(${lf.cx}, ${lf.cy}) rotate(${lf.angleDeg})`}
                      >
                        <path
                          d={`M 0 ${-lf.h * 0.5} C ${lf.w * 0.5} ${-lf.h * 0.2}, ${lf.w * 0.5} ${lf.h * 0.25}, 0 ${lf.h * 0.5} C ${-lf.w * 0.5} ${lf.h * 0.25}, ${-lf.w * 0.5} ${-lf.h * 0.2}, 0 ${-lf.h * 0.5} Z`}
                          fill={lf.fill}
                          stroke={lf.stroke}
                          strokeWidth={1.2}
                        />
                      </g>
                    ))}
                  </g>
                  {treeSkeletonMemo.arrowChevrons.map((ac, aIdx) => (
                    <g
                      key={`tr-arr-${aIdx}`}
                      transform={`translate(${ac.x}, ${ac.y}) rotate(${ac.angleDeg})`}
                    >
                      <polygon
                        points={`${ac.size * 0.65},0 ${-ac.size * 0.55},${-ac.size * 0.48} ${-ac.size * 0.25},0 ${-ac.size * 0.55},${ac.size * 0.48}`}
                        fill={ac.color}
                        opacity={0.92}
                      />
                    </g>
                  ))}
                </svg>
              )}

              {/* SVG Garis Konektor Real-Time (Memoized • Dinonaktifkan sementara saat Mode Ringan Snapshot) */}
              {!useSnapshotOverview && lineStyle !== 'none' && (() => {
                const isPcbStyle = lineStyle === 'pcb90' || lineStyle === 'pcb45';
                const skipEdgeGradients = lodLite && !isExportingPoster;

                return (
                  <>
                    {/* Layer Kabel / Garis Silsilah (Di bawah kartu atau di atas kartu jika linesOnTop aktif) */}
                    <svg
                      width={boardWidth}
                      height={boardHeight}
                      className={`absolute inset-0 pointer-events-none ${
                        linesOnTop ? 'z-[22]' : 'z-[3]'
                      }`}
                    >
                      {!skipEdgeGradients && (
                        <defs>
                          {computedEdges.map((ce) =>
                            ce.canUseGrad ? (
                              <linearGradient
                                key={`def-${ce.gradId}`}
                                id={ce.gradId}
                                gradientUnits="userSpaceOnUse"
                                x1={ce.pts.a.x}
                                y1={ce.pts.a.y}
                                x2={ce.pts.b.x}
                                y2={ce.pts.b.y}
                              >
                                <stop offset="0%" stopColor={ce.gradFrom} />
                                <stop offset="100%" stopColor={ce.gradTo} />
                              </linearGradient>
                            ) : null
                          )}
                        </defs>
                      )}

                      {computedEdges.map(
                        ({
                          idx,
                          edge,
                          pts,
                          route,
                          edgeKind,
                          strokeWidth,
                          taperedPathD,
                          arrowMeta,
                          lineColor,
                          gradFrom,
                          gradTo,
                          canUseGrad,
                          gradId,
                        }) => {
                          const isActiveEdge = activeEdgeIdx === idx;
                          const isSiblingEdge = edgeKind === 'sibling';
                          const baseStrokeWidth =
                            strokeWidth ??
                            (isSiblingEdge
                              ? Math.max(1.3, lineThickness * 0.85)
                              : lineThickness);
                          const strokePaint = isActiveEdge
                            ? '#f59e0b'
                            : canUseGrad && !skipEdgeGradients
                            ? `url(#${gradId})`
                            : lineColor;
                          return (
                            <g key={`edge-${idx}-${edge.from}-${edge.to}`}>
                              {taperedPathD ? (
                                <>
                                  {linesOnTop && (
                                    <path
                                      d={taperedPathD}
                                      fill={
                                        isDark
                                          ? 'rgba(15,23,42,0.75)'
                                          : 'rgba(255,255,255,0.8)'
                                      }
                                      stroke={
                                        isDark
                                          ? 'rgba(15,23,42,0.75)'
                                          : 'rgba(255,255,255,0.8)'
                                      }
                                      strokeWidth={3}
                                    />
                                  )}
                                  <path
                                    d={taperedPathD}
                                    fill={strokePaint}
                                    fillOpacity={linesOnTop ? 0.92 : 1}
                                  />
                                </>
                              ) : (
                                <>
                                  {linesOnTop && (
                                    <path
                                      d={route.d}
                                      stroke={
                                        isDark
                                          ? 'rgba(15,23,42,0.75)'
                                          : 'rgba(255,255,255,0.8)'
                                      }
                                      strokeWidth={baseStrokeWidth + 3}
                                      strokeLinecap="round"
                                      strokeLinejoin={
                                        lineStyle === 'pcb90' ? 'miter' : 'round'
                                      }
                                      fill="none"
                                    />
                                  )}
                                  <path
                                    d={route.d}
                                    stroke={strokePaint}
                                    strokeWidth={
                                      isActiveEdge
                                        ? baseStrokeWidth + 1.2
                                        : baseStrokeWidth
                                    }
                                    strokeDasharray={
                                      edge.type === 'couple' ? '6,4' : undefined
                                    }
                                    strokeLinecap="round"
                                    strokeLinejoin={
                                      lineStyle === 'pcb90' ? 'miter' : 'round'
                                    }
                                    strokeOpacity={linesOnTop ? 0.92 : 1}
                                    fill="none"
                                  />
                                </>
                              )}
                              {arrowMeta && (
                                <path
                                  d={
                                    arrowMeta.kind === 'sibling'
                                      ? `M 0 0 L ${-arrowMeta.size} ${-arrowMeta.size * 0.48} L ${-arrowMeta.size * 0.58} 0 L ${-arrowMeta.size} ${arrowMeta.size * 0.48} Z`
                                      : `M 0 0 L ${-arrowMeta.size} ${-arrowMeta.size * 0.56} L ${-arrowMeta.size * 0.72} 0 L ${-arrowMeta.size} ${arrowMeta.size * 0.56} Z`
                                  }
                                  transform={`translate(${arrowMeta.tipX}, ${arrowMeta.tipY}) rotate(${(
                                    (arrowMeta.angleRad * 180) /
                                    Math.PI
                                  ).toFixed(2)})`}
                                  fill={isActiveEdge ? '#f59e0b' : arrowMeta.color}
                                />
                              )}
                              <path
                                d={route.d}
                                stroke="transparent"
                                strokeWidth={Math.max(14, baseStrokeWidth + 10)}
                                fill="none"
                                className="pointer-events-auto cursor-pointer print:hidden"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setActiveEdgeIdx(idx);
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  setActiveEdgeIdx(idx);
                                }}
                              />
                              {showEndpointDots &&
                                (isPcbStyle ? (
                                  <>
                                    <circle
                                      cx={pts.a.x}
                                      cy={pts.a.y}
                                      r={4.5}
                                      fill={isDark ? '#0f172a' : '#ffffff'}
                                      stroke={canUseGrad ? gradFrom : lineColor}
                                      strokeWidth={1.8}
                                    />
                                    <circle
                                      cx={pts.a.x}
                                      cy={pts.a.y}
                                      r={1.7}
                                      fill={canUseGrad ? gradFrom : lineColor}
                                    />
                                    <circle
                                      cx={pts.b.x}
                                      cy={pts.b.y}
                                      r={4.5}
                                      fill={isDark ? '#0f172a' : '#ffffff'}
                                      stroke={canUseGrad ? gradTo : lineColor}
                                      strokeWidth={1.8}
                                    />
                                    <circle
                                      cx={pts.b.x}
                                      cy={pts.b.y}
                                      r={1.7}
                                      fill={canUseGrad ? gradTo : lineColor}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <circle
                                      cx={pts.a.x}
                                      cy={pts.a.y}
                                      r={3.5}
                                      fill={canUseGrad ? gradFrom : lineColor}
                                    />
                                    <circle
                                      cx={pts.b.x}
                                      cy={pts.b.y}
                                      r={3.5}
                                      fill={canUseGrad ? gradTo : lineColor}
                                    />
                                  </>
                                ))}
                            </g>
                          );
                        }
                      )}
                    </svg>

                    {/* Layer Dot Handle Interaktif (Hanya muncul di Mode Edit Manual) */}
                    {studioWorkspaceMode === 'edit' && (showLineDots || activeEdgeIdx !== null) && (
                      <svg
                        width={boardWidth}
                        height={boardHeight}
                        className="absolute inset-0 pointer-events-none z-[28] print:hidden"
                      >
                        {computedEdges.map(({ idx, edge, route, lineColor }) => {
                          const isVisible =
                            !edge.hideDot &&
                            (showLineDots ||
                              activeEdgeIdx === idx ||
                              route.isCustomOffset);
                          if (!isVisible) return null;
                          if (
                            edge.type === 'couple' &&
                            !route.isCustomOffset &&
                            activeEdgeIdx !== idx
                          ) {
                            return null;
                          }
                          const isActive = activeEdgeIdx === idx;
                          const { x: hx, y: hy } = route.handle;
                          return (
                            <g
                              key={`dot-${idx}`}
                              className="pointer-events-auto cursor-move group/dot"
                              onMouseDown={(e) => startEdgeDotDrag(e, idx)}
                              onTouchStart={(e) => startEdgeDotDrag(e, idx)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                resetEdgeOffset(idx);
                              }}
                            >
                              <title>
                                Klik untuk ubah posisi dot (25%/50%/75%) atau hapus dot • Seret untuk belokkan garis • Klik 2× reset Auto
                              </title>
                              <circle cx={hx} cy={hy} r={13} fill="transparent" />
                              <circle
                                cx={hx}
                                cy={hy}
                                r={isActive || route.isCustomOffset ? 6.5 : 5}
                                fill={
                                  isActive
                                    ? '#f59e0b'
                                    : route.isCustomOffset
                                    ? '#10b981'
                                    : isDark
                                    ? '#0f172a'
                                    : '#ffffff'
                                }
                                stroke={isActive ? '#ffffff' : lineColor}
                                strokeWidth={2.2}
                              />
                              <circle
                                cx={hx}
                                cy={hy}
                                r={2}
                                fill={
                                  isActive || route.isCustomOffset
                                    ? '#0f172a'
                                    : lineColor
                                }
                              />
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </>
                );
              })()}

              {/* Lapisan Garis Karet Direct-DOM saat Drag Kartu (0 React Re-Render) */}
              <svg
                ref={dragRubberSvgRef}
                width={boardWidth}
                height={boardHeight}
                className="absolute inset-0 pointer-events-none z-[25] print:hidden"
              />

              {/* Kartu Anggota Keluarga & Modular Card-in-Card (React.memo + Direct-DOM GPU Drag) */}
              {!useSnapshotOverview &&
                nodes.map((node) => {
                  const isSelected = selectedIds.includes(node.id);
                  const isUnlocked = moveUnlockedIds.includes(node.id);

                  return (
                    <GridCardItem
                      key={node.id}
                      node={node}
                      isSelected={isSelected}
                      isConnectSource={connectFromId === node.id}
                      isHolding={holdingNodeId === node.id}
                      isUnlocked={isUnlocked}
                      cardDisplayMode={cardDisplayMode}
                      cardFrameMode={cardFrameMode}
                      photoFrameSize={photoFrameSize}
                      photoShape={photoShape}
                      cardScale={cardScale}
                      genGradientPalette={genGradientPalette}
                      cardBgColor={cardBgColor}
                      cardBorderColor={cardBorderColor}
                      isDark={isDark}
                      layoutMode={layoutMode}
                      safeHoldMove={safeHoldMove}
                      isMultiSelectMode={isMultiSelectMode}
                      showGenGuides={showGenGuides}
                      lodLite={lodLite && !isExportingPoster}
                      exportPhotoMap={exportPhotoMap}
                      registerNodeEl={registerNodeEl}
                      onStartInteraction={stableStartCardInteraction}
                    />
                  );
                })}

              {/* Blok Keterangan Poster Silsilah (Nama Keluarga Besar, Tahun, App Pembuat, Legenda Garis) */}
              {captionInfo.show && (
                <div
                  className={`pointer-events-none z-[12] backdrop-blur-md border shadow-xl ${
                    isDark || bgStyle !== ''
                      ? 'bg-slate-950/85 border-amber-500/40 text-slate-100'
                      : 'bg-white/92 border-stone-300 text-slate-900'
                  } ${
                    captionInfo.position === 'bottom-bar'
                      ? 'absolute bottom-3 left-4 right-4 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4'
                      : captionInfo.position === 'bottom-right'
                      ? 'absolute bottom-4 right-4 rounded-xl px-4 py-3 max-w-[460px] space-y-2'
                      : captionInfo.position === 'bottom-left'
                      ? 'absolute bottom-4 left-4 rounded-xl px-4 py-3 max-w-[460px] space-y-2'
                      : 'absolute top-4 left-1/2 -translate-x-1/2 rounded-xl px-6 py-2.5 min-w-[420px] max-w-[780px] flex flex-wrap items-center justify-between gap-4'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-black tracking-wide text-amber-500 uppercase">
                        {captionInfo.familyTitle || `Keluarga Besar ${activeTrah.name}`}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isDark || bgStyle !== ''
                            ? 'bg-slate-900 border-slate-700 text-slate-300'
                            : 'bg-stone-100 border-stone-300 text-stone-700'
                        }`}
                      >
                        {(() => {
                          const tableCount = activeTrah.members.length;
                          const spCount = activeTrah.members.reduce(
                            (s, m) => s + (m.spouses?.length || 0),
                            0
                          );
                          return windowedMembers.length < tableCount
                            ? `${windowedMembers.length}/${tableCount} Anggota • ${paperDim.label}`
                            : `${tableCount} Anggota${spCount > 0 ? ` (+${spCount} Pasangan)` : ''} • ${paperDim.label}`;
                        })()}
                      </span>
                    </div>
                    {captionInfo.subtitleNote && (
                      <div
                        className={`text-[11px] mt-0.5 ${
                          isDark || bgStyle !== ''
                            ? 'text-slate-300'
                            : 'text-slate-600'
                        }`}
                      >
                        {captionInfo.subtitleNote}
                      </div>
                    )}
                  </div>

                  {captionInfo.showLineLegend && (
                    <div className="flex items-center gap-3.5 text-[10.5px] font-bold flex-wrap">
                      {lineStyle === 'none' ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-14 h-2.5 rounded-full border border-white/25"
                            style={{
                              background:
                                genGradientPalette !== 'none'
                                  ? `linear-gradient(90deg, ${GEN_GRADIENT_PALETTES[genGradientPalette].stops[0].bg}, ${GEN_GRADIENT_PALETTES[genGradientPalette].stops[2].bg}, ${GEN_GRADIENT_PALETTES[genGradientPalette].stops[4].bg})`
                                  : 'linear-gradient(90deg, #064e3b, #10b981, #a7f3d0)',
                            }}
                          />
                          <span>Tua (Leluhur) ➔ Cerah (Cucu)</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-6 h-0.5 rounded-full"
                              style={{
                                backgroundColor:
                                  childLineColor ||
                                  (isDark || bgStyle !== '' ? '#38bdf8' : '#0284c7'),
                              }}
                            />
                            <span>
                              {showLineArrows ? 'Ortu ➔ Anak' : 'Keturunan'}
                            </span>
                          </div>
                          {lineRoutingTopology !== 'direct' && (
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-block w-6 h-0.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    siblingLineColor ||
                                    (isDark || bgStyle !== '' ? '#a78bfa' : '#7c3aed'),
                                }}
                              />
                              <span>
                                {showLineArrows ? 'Adik ➔ Kakak' : 'Saudara'}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-6 border-t-2 border-dashed"
                              style={{ borderColor: coupleLineColor || '#f59e0b' }}
                            />
                            <span>Pasangan</span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-3.5 h-3.5 rounded-sm border-2 border-dashed border-slate-400" />
                        <span>Wafat</span>
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex items-center gap-3 text-[10.5px] font-semibold flex-wrap ${
                      isDark || bgStyle !== ''
                        ? 'text-slate-300'
                        : 'text-slate-700'
                    }`}
                  >
                    {captionInfo.createdYear && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        <span>Tahun: {captionInfo.createdYear}</span>
                      </span>
                    )}
                    {captionInfo.createdByApp && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 font-extrabold">
                        Dibuat oleh {captionInfo.createdByApp}
                      </span>
                    )}
                    {captionInfo.curatorName && (
                      <span className="opacity-85">
                        {captionInfo.curatorName}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* KONTROL MELAYANG ADAPTIF (POTRET / LANSKAP ALA GAME)     */}
        {/* ========================================================= */}

        {/* 0. Tombol Eye Toggle saat HUD Disembunyikan */}
        {isFocusMode && isHudHidden && (
          <button
            type="button"
            onClick={() => setIsHudHidden(false)}
            className="absolute top-2.5 right-2.5 z-50 px-2.5 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-amber-300 border border-stone-700 backdrop-blur-md text-[11px] font-extrabold flex items-center gap-1.5 shadow-xl print:hidden"
            title="Tampilkan Ikon Studio"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Tampilkan Ikon</span>
          </button>
        )}

        {/* Indikator Halus saat Drag Kartu GPU */}
        {isDraggingCards && !isHudHidden && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40 px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-400/60 text-emerald-300 text-[10px] font-black pointer-events-none shadow-lg print:hidden">
            Menggeser kartu...
          </div>
        )}

        {/* 1 & 2. HUD MODE LANSKAP ALA GAME (DOCK JEMPOL KIRI & KANAN VERTIKAL) */}
        {isFocusMode && !isHudHidden && isLandscapeHud && (
          <>
            {/* Dock Vertikal Kiri (Layar Miring, Keluar, Mode Smart/Edit, dan alat Edit bila di Mode Edit) */}
            <div className="absolute left-2 top-2 bottom-2 z-40 flex flex-col justify-between items-center gap-1.5 pointer-events-none print:hidden">
              <div className="pointer-events-auto flex flex-col items-center gap-1 p-1 rounded-2xl bg-stone-900/88 border border-stone-700/90 backdrop-blur-md shadow-xl">
                <button
                  type="button"
                  onClick={() => void handleExitFullscreenStudio()}
                  className="w-10 h-9 rounded-xl bg-stone-800 hover:bg-stone-700 text-white flex flex-col items-center justify-center text-[8.5px] font-extrabold"
                  title="Keluar dari Studio Penuh (ESC)"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Keluar</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleStudioScreenMode()}
                  className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[8.5px] font-extrabold transition ${
                    studioScreenMode === 'landscape'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-stone-800 text-sky-300 hover:bg-stone-700'
                  }`}
                  title="Putar Layar Berdiri / Miring (Posisi Kertas Tetap!)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Layar</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    switchWorkspaceMode(
                      studioWorkspaceMode === 'smart' ? 'edit' : 'smart'
                    )
                  }
                  className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[8px] font-black transition ${
                    studioWorkspaceMode === 'smart'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                  title={
                    studioWorkspaceMode === 'smart'
                      ? 'Pindah ke Edit Manual'
                      : 'Kembali ke Mode Smart Bersih'
                  }
                >
                  {studioWorkspaceMode === 'smart' ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Smart</span>
                    </>
                  ) : (
                    <>
                      <Move className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </>
                  )}
                </button>
                {studioWorkspaceMode === 'edit' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isMultiSelectMode;
                        setIsMultiSelectMode(next);
                        if (next) cancelHoldTimer();
                      }}
                      className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[8.5px] font-bold transition ${
                        isMultiSelectMode
                          ? 'bg-sky-500 text-stone-950'
                          : 'text-sky-300 hover:bg-stone-800'
                      }`}
                      title="Mode Pilih Checklist Banyak Kartu"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Pilih</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPanMode((v) => !v);
                        showNotification(
                          !isPanMode
                            ? 'Mode Geser Kanvas Aktif'
                            : 'Mode Edit Kartu Aktif'
                        );
                      }}
                      className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[8.5px] font-bold transition ${
                        isPanMode
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-stone-300 hover:bg-stone-800'
                      }`}
                      title="Mode Geser Kanvas (Hand Tool)"
                    >
                      <Hand className="w-3.5 h-3.5" />
                      <span>Geser</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={undoCount === 0}
                      className={`w-10 h-8 rounded-xl flex flex-col items-center justify-center text-[8.5px] font-bold ${
                        undoCount === 0
                          ? 'text-stone-600 cursor-not-allowed'
                          : 'text-amber-300 hover:bg-stone-800'
                      }`}
                      title="Undo Perubahan Terakhir"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Undo</span>
                    </button>
                  </>
                )}
              </div>

              {studioWorkspaceMode === 'edit' && (
                <div className="pointer-events-auto flex flex-col items-center gap-1 p-1 rounded-2xl bg-stone-900/88 border border-stone-700/90 backdrop-blur-md shadow-xl">
                  <button
                    type="button"
                    onClick={addNewNode}
                    className="w-10 h-9 rounded-xl bg-emerald-700/90 hover:bg-emerald-600 text-white flex flex-col items-center justify-center text-[8.5px] font-bold"
                    title="Tambah Kartu Baru"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Kartu</span>
                  </button>
                  <button
                    type="button"
                    onClick={startConnectMode}
                    className={`w-10 h-9 rounded-xl flex flex-col items-center justify-center text-[8.5px] font-bold ${
                      connectFromId
                        ? 'bg-amber-400 text-stone-950 animate-pulse'
                        : 'text-sky-300 hover:bg-stone-800'
                    }`}
                    title="Hubungkan Garis Silsilah"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{connectFromId ? 'Tuju' : 'Garis'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Dock Vertikal Kanan (Eye, Pilihan Smart / Alat Edit, Simpan, PNG/Cetak + Minimap & Zoom) */}
            <div className="absolute right-2 top-2 bottom-2 z-40 flex flex-col justify-between items-end gap-1.5 pointer-events-none print:hidden">
              <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-2xl bg-stone-900/88 border border-stone-700/90 backdrop-blur-md shadow-xl">
                <button
                  type="button"
                  onClick={() => setIsHudHidden(true)}
                  className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300"
                  title="Sembunyikan Ikon (100% Kanvas Bersih)"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
                {studioWorkspaceMode === 'smart' ? (
                  <button
                    type="button"
                    onClick={() => setIsSmartGalleryOpen((v) => !v)}
                    className={`px-2 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-1 ${
                      isSmartGalleryOpen
                        ? 'bg-emerald-400 text-stone-950'
                        : 'text-emerald-300 hover:bg-stone-800'
                    }`}
                    title="Buka/Tutup Pilihan Tata Letak Smart"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Pilihan</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPanelTab('smart');
                        setIsPanelOpen((v) => (panelTab === 'smart' ? !v : true));
                      }}
                      className={`px-2 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-1 ${
                        isPanelOpen && panelTab === 'smart'
                          ? 'bg-emerald-400 text-stone-950'
                          : 'text-amber-300 hover:bg-stone-800'
                      }`}
                      title="Smart Tata Letak"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPanelTab('style');
                        setIsPanelOpen((v) => (panelTab === 'style' ? !v : true));
                      }}
                      className={`px-2 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-1 ${
                        isPanelOpen && panelTab === 'style'
                          ? 'bg-sky-500 text-stone-950'
                          : 'text-sky-300 hover:bg-stone-800'
                      }`}
                      title="Gaya Kartu, Warna & Garis"
                    >
                      <Palette className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPanelTab('edit');
                        setIsPanelOpen((v) => (panelTab === 'edit' ? !v : true));
                      }}
                      className={`px-2 py-1.5 rounded-xl text-[10.5px] font-bold flex items-center gap-1 ${
                        isPanelOpen && panelTab === 'edit'
                          ? 'bg-amber-500 text-stone-950'
                          : 'text-stone-200 hover:bg-stone-800'
                      }`}
                      title="Edit Kartu & Susunan"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSaveNamedDesign}
                  className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950"
                  title="Simpan Desain"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isExportingPoster}
                  onClick={() => handleTriggerGridExportAction('draft')}
                  className="p-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-400/40"
                  title={`Unduh Draft Ringan ${paperDim.label} (tanpa upscale)`}
                >
                  <Zap className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isExportingPoster}
                  onClick={() => handleTriggerGridExportAction('png')}
                  className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
                  title={`Unduh PNG HD ${paperDim.label}`}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isExportingPoster}
                  onClick={() => handleTriggerGridExportAction('print')}
                  className="p-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950"
                  title={`Cetak Poster ${paperDim.label}`}
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pointer-events-auto flex flex-col items-end gap-1.5">
                <GridMiniNavigator
                  isOpen={isMiniNavOpen}
                  onToggleOpen={() => setIsMiniNavOpen((v) => !v)}
                  boardWidth={boardWidth}
                  boardHeight={boardHeight}
                  nodes={nodes}
                  cardDisplayMode={cardDisplayMode}
                  photoFrameSize={photoFrameSize}
                  cardScale={cardScale}
                  paperLabel={paperDim.label}
                  isDark={isDark}
                  registerViewportBoxEl={(el) => {
                    miniNavViewportElRef.current = el;
                  }}
                  onJumpToBoardPoint={handleJumpToBoardPoint}
                  isCssRotatedLandscape={isCssLandscapeActive}
                />

                <div className="flex items-center gap-1 rounded-2xl bg-stone-900/90 border border-stone-700/90 text-white p-1 backdrop-blur-md shadow-xl">
                  <select
                    value={paperSize}
                    onChange={(e) => applySmartLiveSetting({ paper: e.target.value as GridPaperSize })}
                    className="bg-transparent text-amber-300 text-[10px] font-black px-1 py-0.5 outline-hidden cursor-pointer"
                    title="Ukuran Kertas A0-A4"
                  >
                    <option value="a4" className="bg-stone-900">A4</option>
                    <option value="a3" className="bg-stone-900">A3</option>
                    <option value="a2" className="bg-stone-900">A2</option>
                    <option value="a1" className="bg-stone-900">A1</option>
                    <option value="a0" className="bg-stone-900">A0</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      applySmartLiveSetting({
                        orient: paperOrientation === 'landscape' ? 'portrait' : 'landscape',
                      })
                    }
                    className="px-1.5 py-0.5 rounded-lg bg-stone-800 text-emerald-300 text-[9.5px] font-bold"
                    title="Putar Kertas Potret / Lanskap"
                  >
                    {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}
                  </button>
                  <span className="w-px h-4 bg-stone-700" />
                  <button
                    type="button"
                    onClick={() =>
                      setRenderQualityMode((m) =>
                        m === 'auto' ? 'snapshot' : m === 'snapshot' ? 'hd' : 'auto'
                      )
                    }
                    className={`px-1.5 py-0.5 rounded-lg text-[9.5px] font-black ${
                      useSnapshotOverview
                        ? 'bg-emerald-500 text-slate-950'
                        : renderQualityMode === 'hd'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                    title="Mode Render Kanvas: Auto / Ringan (Snapshot) / HD Penuh"
                  >
                    {renderQualityMode === 'snapshot'
                      ? 'Ringan'
                      : renderQualityMode === 'hd'
                      ? 'HD'
                      : useSnapshotOverview
                      ? 'Auto⚡'
                      : 'Auto'}
                  </button>
                  <span className="w-px h-4 bg-stone-700" />
                  <button
                    type="button"
                    onClick={() => handleZoomByStep(-0.15)}
                    className="p-1 rounded-lg hover:bg-stone-800 text-stone-200"
                    title="Perkecil Zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFitScreen(false)}
                    className="px-1 py-0.5 rounded-lg hover:bg-stone-800 text-[10.5px] font-mono font-extrabold text-amber-300 min-w-[38px] text-center"
                    title="Ketuk untuk Pas Layar"
                  >
                    <span ref={zoomLabelRef}>{Math.round(zoom * 100)}%</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleZoomByStep(0.15)}
                    className="p-1 rounded-lg hover:bg-stone-800 text-stone-200"
                    title="Perbesar Zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFitScreen(false)}
                    className="px-1.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[9.5px] font-extrabold"
                    title="Pas Kertas ke Layar"
                  >
                    Pas
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 1. Dock Melayang Kiri-Atas (Mode Studio Potret) */}
        {isFocusMode && !isHudHidden && !isLandscapeHud && (
          <div className="absolute top-2.5 left-2.5 z-40 flex flex-wrap items-center gap-1 print:hidden max-w-[60vw]">
            <button
              type="button"
              onClick={() => void handleExitFullscreenStudio()}
              className="px-2 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-white border border-stone-700 backdrop-blur-md text-[11px] font-extrabold flex items-center gap-1 shadow-lg"
              title="Keluar dari Studio Penuh (ESC)"
            >
              <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Keluar</span>
            </button>

            <div className="flex items-center rounded-xl bg-stone-900/90 border border-stone-700 backdrop-blur-md p-0.5 gap-0.5 shadow-lg">
              <button
                type="button"
                onClick={() => switchWorkspaceMode('smart')}
                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                  studioWorkspaceMode === 'smart'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Mode Smart Instan (bersih tanpa alat edit)"
              >
                <Sparkles className="w-3 h-3" />
                <span>Smart</span>
              </button>
              <button
                type="button"
                onClick={() => switchWorkspaceMode('edit')}
                className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 whitespace-nowrap shrink-0 transition ${
                  studioWorkspaceMode === 'edit'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Buka Mode Edit Manual"
              >
                <Move className="w-3 h-3" />
                <span>Edit</span>
              </button>
            </div>

            <div className="flex items-center rounded-xl bg-stone-900/85 border border-stone-700 backdrop-blur-md p-0.5 gap-0.5 shadow-lg">
              <select
                value={paperSize}
                onChange={(e) => applySmartLiveSetting({ paper: e.target.value as GridPaperSize })}
                className="bg-transparent text-amber-300 text-[10.5px] font-black px-1 py-1 outline-hidden cursor-pointer"
                title="Ukuran Kertas A0-A4"
              >
                <option value="a4" className="bg-stone-900">A4</option>
                <option value="a3" className="bg-stone-900">A3</option>
                <option value="a2" className="bg-stone-900">A2</option>
                <option value="a1" className="bg-stone-900">A1</option>
                <option value="a0" className="bg-stone-900">A0</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  applySmartLiveSetting({
                    orient: paperOrientation === 'landscape' ? 'portrait' : 'landscape',
                  })
                }
                className="px-1.5 py-1 rounded-lg bg-stone-800 text-emerald-300 text-[9.5px] font-bold"
                title="Putar Kertas Potret / Lanskap"
              >
                {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}
              </button>
              <button
                type="button"
                onClick={() => void handleToggleStudioScreenMode()}
                className={`px-1.5 py-1 rounded-lg text-[9.5px] font-extrabold flex items-center gap-1 ${
                  studioScreenMode === 'landscape'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-sky-300 hover:bg-stone-800'
                }`}
                title="Putar Layar HP Miring (Ala Game) tanpa mengubah ukuran/posisi kertas!"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Layar Miring</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Dock Melayang Kanan-Atas (Mode Studio Potret) */}
        {isFocusMode && !isHudHidden && !isLandscapeHud && (
          <div className="absolute top-2.5 right-2.5 z-40 flex flex-wrap items-center justify-end gap-1 print:hidden max-w-[44vw]">
            <button
              type="button"
              onClick={() => setIsHudHidden(true)}
              className="p-1.5 rounded-xl bg-stone-900/85 hover:bg-stone-800 text-stone-300 border border-stone-700 backdrop-blur-md shadow-lg"
              title="Sembunyikan Ikon (Layar Bersih)"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>

            {studioWorkspaceMode === 'edit' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isMultiSelectMode;
                    setIsMultiSelectMode(next);
                    if (next) cancelHoldTimer();
                  }}
                  className={`px-2 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-bold flex items-center gap-1 shadow-lg ${
                    isMultiSelectMode
                      ? 'bg-sky-500 text-stone-950 border-sky-400'
                      : 'bg-stone-900/85 text-sky-300 border-stone-700 hover:bg-stone-800'
                  }`}
                  title="Pilih Banyak Kartu Langsung"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Pilih</span>
                </button>

                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoCount === 0}
                  className={`px-2 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-bold flex items-center gap-1 shadow-lg ${
                    undoCount === 0
                      ? 'bg-stone-900/50 text-stone-600 border-stone-800 cursor-not-allowed'
                      : 'bg-stone-900/90 text-amber-300 border-amber-500/40 hover:bg-stone-800'
                  }`}
                  title="Undo Perubahan Terakhir (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Undo</span>
                </button>

                <button
                  type="button"
                  onClick={addNewNode}
                  className="px-2 py-1.5 rounded-xl bg-emerald-700/90 hover:bg-emerald-600 text-white border border-emerald-500/50 backdrop-blur-md text-[11px] font-bold flex items-center gap-1 shadow-lg"
                  title="Tambah Kartu Baru"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Kartu</span>
                </button>

                <button
                  type="button"
                  onClick={startConnectMode}
                  className={`px-2 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-bold flex items-center gap-1 shadow-lg ${
                    connectFromId
                      ? 'bg-amber-400 text-stone-950 border-amber-300 animate-pulse'
                      : 'bg-stone-900/85 text-sky-300 border-stone-700 hover:bg-stone-800'
                  }`}
                  title="Hubungkan Garis Silsilah"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{connectFromId ? 'Tujuan...' : 'Garis'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('edit');
                    setIsPanelOpen((v) => (panelTab === 'edit' ? !v : true));
                  }}
                  className={`px-2 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-bold flex items-center gap-1 shadow-lg ${
                    isPanelOpen && panelTab === 'edit'
                      ? 'bg-amber-500 text-stone-950 border-amber-400'
                      : 'bg-stone-900/85 text-stone-200 border-stone-700 hover:bg-stone-800'
                  }`}
                  title="Panel Edit Kartu & Susunan"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('smart');
                    setIsPanelOpen((v) => (panelTab === 'smart' ? !v : true));
                  }}
                  className={`px-2 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-bold flex items-center gap-1 shadow-lg ${
                    isPanelOpen && panelTab === 'smart'
                      ? 'bg-emerald-400 text-stone-950 border-emerald-300'
                      : 'bg-stone-900/85 text-amber-300 border-stone-700 hover:bg-stone-800'
                  }`}
                  title="Rekomendasi Tata Letak & Desain"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Rekomendasi</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPanelTab('style');
                    setIsPanelOpen((v) => (panelTab === 'style' ? !v : true));
                  }}
                  className={`px-2 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-bold flex items-center gap-1 shadow-lg ${
                    isPanelOpen && panelTab === 'style'
                      ? 'bg-sky-500 text-stone-950 border-sky-400'
                      : 'bg-stone-900/85 text-sky-300 border-stone-700 hover:bg-stone-800'
                  }`}
                  title="Warna Card, Garis PCB & Keterangan"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleSaveNamedDesign}
              className="px-2 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-black flex items-center gap-1 shadow-lg"
              title="Simpan Desain"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simpan</span>
            </button>

            <button
              type="button"
              disabled={isExportingPoster}
              onClick={() => handleTriggerGridExportAction('draft')}
              className="px-2 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-amber-400/40 text-amber-300 text-[11px] font-black flex items-center gap-1 shadow-lg"
              title={`Unduh Draft Ringan ${paperDim.label} (cepat, tanpa upscale)`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Draft</span>
            </button>

            <button
              type="button"
              disabled={isExportingPoster}
              onClick={() => handleTriggerGridExportAction('png')}
              className="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 shadow-lg"
              title={`Unduh PNG HD ${paperDim.label} (Full Color + Auto-Upscale)`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">PNG</span>
            </button>

            <button
              type="button"
              disabled={isExportingPoster}
              onClick={() => handleTriggerGridExportAction('print')}
              className="px-2 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow-lg"
              title={`Cetak Poster ${paperDim.label}`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cetak</span>
            </button>
          </div>
        )}

        {/* 3. Dock Melayang Kanan-Bawah (Mode Potret & Mode Normal): Mini-Navigator + Mode Render + Zoom */}
        {!isLandscapeHud && !(isFocusMode && isHudHidden) && (
          <div className="absolute bottom-2.5 right-2.5 z-40 flex flex-col items-end gap-1.5 print:hidden">
            <GridMiniNavigator
              isOpen={isMiniNavOpen}
              onToggleOpen={() => setIsMiniNavOpen((v) => !v)}
              boardWidth={boardWidth}
              boardHeight={boardHeight}
              nodes={nodes}
              cardDisplayMode={cardDisplayMode}
              photoFrameSize={photoFrameSize}
              cardScale={cardScale}
              paperLabel={paperDim.label}
              isDark={isDark}
              registerViewportBoxEl={(el) => {
                miniNavViewportElRef.current = el;
              }}
              onJumpToBoardPoint={handleJumpToBoardPoint}
              isCssRotatedLandscape={isCssLandscapeActive}
            />

            <div className="flex items-center gap-1 rounded-2xl bg-stone-900/90 border border-stone-700/90 text-white p-1 backdrop-blur-md shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setIsPanMode((v) => !v);
                  showNotification(
                    !isPanMode
                      ? 'Mode Geser Kanvas Aktif: seret kanvas bebas tanpa menggeser kartu'
                      : 'Mode Edit Kartu Aktif'
                  );
                }}
                className={`px-2 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition ${
                  isPanMode
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-stone-300 hover:bg-stone-800'
                }`}
                title="Mode Geser Kanvas (Hand Tool)"
              >
                <Hand className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Geser</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setRenderQualityMode((m) =>
                    m === 'auto' ? 'snapshot' : m === 'snapshot' ? 'hd' : 'auto'
                  )
                }
                className={`px-1.5 py-1 rounded-xl text-[10px] font-black transition ${
                  useSnapshotOverview
                    ? 'bg-emerald-500 text-slate-950'
                    : renderQualityMode === 'hd'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
                title="Mode Render Kanvas: Auto / Ringan (Snapshot) / HD Penuh"
              >
                {renderQualityMode === 'snapshot'
                  ? 'Ringan'
                  : renderQualityMode === 'hd'
                  ? 'HD'
                  : useSnapshotOverview
                  ? 'Auto⚡'
                  : 'Auto'}
              </button>

              <span className="w-px h-4 bg-stone-700" />

              <button
                type="button"
                onClick={() => handleZoomByStep(-0.15)}
                className="p-1.5 rounded-xl hover:bg-stone-800 text-stone-200"
                title="Perkecil Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleFitScreen(false)}
                className="px-1.5 py-1 rounded-lg hover:bg-stone-800 text-[11px] font-mono font-extrabold text-amber-300 min-w-[42px] text-center"
                title="Ketuk untuk Pas Layar Otomatis"
              >
                <span ref={zoomLabelRef}>{Math.round(zoom * 100)}%</span>
              </button>
              <button
                type="button"
                onClick={() => handleZoomByStep(0.15)}
                className="p-1.5 rounded-xl hover:bg-stone-800 text-stone-200"
                title="Perbesar Zoom (Mendukung Pinch 2 Jari)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => handleFitScreen(false)}
                className="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold"
                title="Pas Kertas ke Layar"
              >
                Pas
              </button>

              {!isFocusMode && (
                <button
                  type="button"
                  onClick={() => setIsFocusMode(true)}
                  className="p-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950"
                  title="Masuk Studio Penuh"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3b. Kontrol Melayang Garis & Dot (Hanya di Mode Edit Manual) */}
        {studioWorkspaceMode === 'edit' && activeEdgeIdx !== null && edges[activeEdgeIdx] && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${
              isLandscapeHud ? 'top-2' : 'top-14 sm:top-2.5'
            } left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-stone-900/95 border border-amber-500/40 text-white px-2.5 py-1.5 backdrop-blur-md shadow-xl print:hidden max-w-[88%]`}
          >
            <span className="text-[10px] font-black text-amber-300 px-1">
              Garis #{activeEdgeIdx + 1}
            </span>

            <div className="flex items-center gap-0.5 bg-stone-800 rounded-lg p-0.5">
              <span className="text-[9px] text-stone-400 px-1">Dot:</span>
              {([0.25, 0.5, 0.75] as const).map((pos) => {
                const curPos = edges[activeEdgeIdx].dotPos ?? 0.5;
                const activePos = Math.abs(curPos - pos) < 0.05;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => handleUpdateActiveEdgeDot({ dotPos: pos })}
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                      activePos
                        ? 'bg-amber-500 text-stone-950'
                        : 'text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    {Math.round(pos * 100)}%
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 text-[9.5px]">
              <span className="text-stone-400">Keluar:</span>
              <select
                value={edges[activeEdgeIdx].fromPort || 'auto'}
                onChange={(e) =>
                  handleUpdateActiveEdgeDot({
                    fromPort: e.target.value as EdgePortSide,
                  })
                }
                className="bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-[9.5px] font-bold text-sky-300 outline-hidden"
              >
                <option value="auto">Auto</option>
                <option value="bottom">Bawah</option>
                <option value="top">Atas</option>
                <option value="left">Kiri</option>
                <option value="right">Kanan</option>
              </select>
              <span className="text-stone-400">Masuk:</span>
              <select
                value={edges[activeEdgeIdx].toPort || 'auto'}
                onChange={(e) =>
                  handleUpdateActiveEdgeDot({
                    toPort: e.target.value as EdgePortSide,
                  })
                }
                className="bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-[9.5px] font-bold text-emerald-300 outline-hidden"
              >
                <option value="auto">Auto</option>
                <option value="top">Atas</option>
                <option value="bottom">Bawah</option>
                <option value="left">Kiri</option>
                <option value="right">Kanan</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() =>
                handleUpdateActiveEdgeDot({
                  hideDot: !edges[activeEdgeIdx].hideDot,
                })
              }
              className={`px-2 py-0.5 rounded-lg text-[9.5px] font-bold ${
                edges[activeEdgeIdx].hideDot
                  ? 'bg-emerald-600 text-white'
                  : 'bg-stone-800 text-amber-300 hover:bg-stone-700'
              }`}
              title="Hapus atau tampilkan titik dot pada garis ini"
            >
              {edges[activeEdgeIdx].hideDot ? 'Tampilkan Dot' : 'Hapus Dot'}
            </button>

            <button
              type="button"
              onClick={() => resetEdgeOffset(activeEdgeIdx)}
              className="px-2 py-0.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[9.5px] font-bold"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={handleDeleteActiveEdge}
              className="px-2 py-0.5 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 text-rose-300 text-[9.5px] font-bold"
              title="Hapus garis konektor ini"
            >
              Hapus Garis
            </button>

            <button
              type="button"
              onClick={() => setActiveEdgeIdx(null)}
              className="p-1 rounded-lg bg-stone-800 text-stone-400 hover:text-white"
              title="Tutup Kontrol Garis"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* 3c. Galeri Pilihan Smart Instan (Muncul di Mode Smart: Bersih, Tanpa Alat Edit) */}
        {studioWorkspaceMode === 'smart' && !(isFocusMode && isHudHidden) && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className={`absolute ${
              isLandscapeHud
                ? 'bottom-2.5 left-14 max-w-[calc(100%-240px)]'
                : 'bottom-2.5 left-2.5 max-w-[calc(100%-20px)] sm:max-w-[540px]'
            } z-40 print:hidden`}
          >
            {!isSmartGalleryOpen ? (
              <button
                type="button"
                onClick={() => setIsSmartGalleryOpen(true)}
                className="px-3 py-2 rounded-2xl bg-stone-900/92 hover:bg-stone-800 text-emerald-300 border border-emerald-500/40 backdrop-blur-md shadow-xl text-[11px] font-extrabold flex items-center gap-2 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Smart ({smartGalleryOptions.length})</span>
                <span className="text-stone-400 font-normal">·</span>
                <span className="text-[10px] font-mono tabular-nums text-stone-200">
                  {currentLayoutQuality.overlapCount === 0
                    ? '0✓'
                    : `${currentLayoutQuality.overlapCount}!`}
                </span>
              </button>
            ) : (
              <div className="rounded-2xl bg-stone-900/92 border border-stone-700/90 text-slate-100 p-2 backdrop-blur-md shadow-2xl space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="text-[11px] font-extrabold text-emerald-300 whitespace-nowrap">
                      Smart
                    </span>
                    <span className="text-[10px] text-stone-300 font-mono tabular-nums whitespace-nowrap">
                      {smartAnalysis.totalPeopleWithSpouses} · {smartAnalysis.generationCount}G ·{' '}
                      <span
                        className={
                          currentLayoutQuality.overlapCount === 0
                            ? 'text-emerald-300 font-bold'
                            : 'text-amber-300 font-bold'
                        }
                      >
                        {currentLayoutQuality.overlapCount === 0
                          ? '0✓'
                          : `${currentLayoutQuality.overlapCount}!`}
                      </span>
                    </span>
                  </div>

                  {/* Baris Ikon & Simbol Kontrol Cepat Smart */}
                  <div className="flex items-center gap-1 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setAiQuotaInfo(getAiDesignerQuotaInfo());
                        setAiDesignError(null);
                        setIsAiDesignModalOpen(true);
                      }}
                      title="Racik Blueprint Desain AI (Pohon / Teratai / Molekul sesuai struktur keluarga)"
                      className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 shrink-0 transition ${
                        aiBlueprint
                          ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-fuchsia-300 shadow-xs'
                          : 'bg-violet-600/80 hover:bg-violet-500 text-white border-violet-400/60'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 text-amber-200" />
                      <span>Desain AI</span>
                    </button>

                    {/* 1. Mode Isi Kartu (Nama / Foto+Nama / Lengkap) */}
                    <button
                      type="button"
                      onClick={() => {
                        const order: CardDisplayMode[] = [
                          'name_only',
                          'photo_name',
                          'photo_name_unified',
                          'full',
                        ];
                        const next =
                          order[(order.indexOf(cardDisplayMode) + 1) % order.length];
                        applySmartLiveSetting({ cardMode: next });
                        showNotification(
                          next === 'name_only'
                            ? 'Kartu: Nama Saja'
                            : next === 'photo_name'
                            ? 'Kartu: Foto + Nama'
                            : next === 'photo_name_unified'
                            ? 'Kartu: Foto + Nama Menyatu'
                            : 'Kartu: Lengkap'
                        );
                      }}
                      title={`Isi Kartu: ${
                        cardDisplayMode === 'name_only'
                          ? 'Nama Saja'
                          : cardDisplayMode === 'photo_name'
                          ? 'Foto + Nama'
                          : cardDisplayMode === 'photo_name_unified'
                          ? 'Foto + Nama Menyatu'
                          : 'Lengkap'
                      } (klik untuk ganti)`}
                      className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-emerald-300 text-[10px] font-black flex items-center gap-1 shrink-0"
                    >
                      {cardDisplayMode === 'name_only' ? (
                        <Type className="w-3.5 h-3.5" />
                      ) : cardDisplayMode === 'photo_name' ? (
                        <ImageIcon className="w-3.5 h-3.5" />
                      ) : cardDisplayMode === 'photo_name_unified' ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {cardDisplayMode === 'name_only'
                          ? 'Aa'
                          : cardDisplayMode === 'photo_name'
                          ? '🖼'
                          : cardDisplayMode === 'photo_name_unified'
                          ? '✦'
                          : '🪪'}
                      </span>
                    </button>

                    {/* 2. Rasio Pas Foto */}
                    {cardDisplayMode !== 'name_only' && (
                      <select
                        value={photoFrameSize}
                        onChange={(e) =>
                          applySmartLiveSetting({
                            photoSize: e.target.value as PhotoFrameSize,
                          })
                        }
                        className="bg-stone-800 border border-stone-700 text-emerald-300 rounded-lg px-1.5 py-1 text-[10px] font-black outline-hidden cursor-pointer shrink-0"
                        title="Rasio Pas Foto (tetap tegak di atas daun)"
                      >
                        <option value="kotak">1:1</option>
                        <option value="bulat">◯</option>
                        <option value="2x3">2×3</option>
                        <option value="3x4">3×4</option>
                        <option value="4x6">4×6</option>
                      </select>
                    )}

                    {/* 3. Bingkai Kartu: Auto Special / Kelopak Teratai / Daun / Segi Enam / Kotak */}
                    <button
                      type="button"
                      onClick={() => {
                        const order: CardFrameMode[] = ['auto', 'petal', 'leaf', 'hex', 'rect'];
                        const next =
                          order[(order.indexOf(cardFrameMode) + 1) % order.length];
                        setCardFrameMode(next);
                        showNotification(
                          next === 'auto'
                            ? 'Bingkai: Auto Special (Ikut Tata Letak)'
                            : next === 'petal'
                            ? 'Bingkai: Semua Kelopak Teratai (Foto Tegak)'
                            : next === 'leaf'
                            ? 'Bingkai: Semua Daun (Foto Tegak)'
                            : next === 'hex'
                            ? 'Bingkai: Semua Segi Enam Molekul'
                            : 'Bingkai: Semua Kotak'
                        );
                      }}
                      title={`Bingkai Kartu: ${
                        cardFrameMode === 'auto'
                          ? 'Auto Special (Kelopak Teratai / Daun / Segi Enam)'
                          : cardFrameMode === 'petal'
                          ? 'Kelopak Teratai Mekar'
                          : cardFrameMode === 'leaf'
                          ? 'Daun Segala Arah'
                          : cardFrameMode === 'hex'
                          ? 'Segi Enam Atom Molekul'
                          : 'Kotak Standar'
                      }`}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 shrink-0 transition ${
                        cardFrameMode === 'petal'
                          ? 'bg-pink-500 text-white border-pink-300'
                          : cardFrameMode === 'leaf'
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                          : cardFrameMode === 'hex'
                          ? 'bg-sky-500 text-slate-950 border-sky-300'
                          : cardFrameMode === 'auto'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >
                      {cardFrameMode === 'rect' ? (
                        <Square className="w-3.5 h-3.5" />
                      ) : cardFrameMode === 'hex' ? (
                        <CircleDot className="w-3.5 h-3.5" />
                      ) : cardFrameMode === 'petal' ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <Leaf className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {cardFrameMode === 'auto'
                          ? 'A'
                          : cardFrameMode === 'petal'
                          ? '🪷'
                          : cardFrameMode === 'leaf'
                          ? '🌿'
                          : cardFrameMode === 'hex'
                          ? '⬡'
                          : '▢'}
                      </span>
                    </button>

                    {/* 4. Topologi Garis: Rantai / Hibrid / Langsung */}
                    <button
                      type="button"
                      onClick={() => {
                        const order: LineRoutingTopology[] = [
                          'sibling_chain_all',
                          'sibling_chain_g3plus',
                          'direct',
                        ];
                        const next =
                          order[(order.indexOf(lineRoutingTopology) + 1) % order.length];
                        setLineRoutingTopology(next);
                        showNotification(
                          next === 'sibling_chain_all'
                            ? 'Garis: Rantai G1–G5'
                            : next === 'sibling_chain_g3plus'
                            ? 'Garis: Hibrid G3+'
                            : 'Garis: Langsung ke Ortu'
                        );
                      }}
                      title={`Pola Garis: ${
                        lineRoutingTopology === 'sibling_chain_all'
                          ? 'Rantai Saudara G1–G5'
                          : lineRoutingTopology === 'sibling_chain_g3plus'
                          ? 'Hibrid G3+'
                          : 'Langsung Ortu'
                      } (klik untuk ganti)`}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-black flex items-center gap-1 shrink-0 transition ${
                        lineRoutingTopology !== 'direct'
                          ? 'bg-violet-500/25 text-violet-200 border-violet-400/50'
                          : 'bg-stone-800 text-stone-300 border-stone-700'
                      }`}
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      <span>
                        {lineRoutingTopology === 'sibling_chain_all'
                          ? '⛓'
                          : lineRoutingTopology === 'sibling_chain_g3plus'
                          ? '⑂'
                          : '┼'}
                      </span>
                    </button>

                    {/* 5. Batang Pohon 100->20px */}
                    <button
                      type="button"
                      onClick={() => {
                        setLineThicknessMode((m) => {
                          const next = m === 'tree_taper' ? 'uniform' : 'tree_taper';
                          showNotification(
                            next === 'tree_taper'
                              ? 'Batang Pohon: Batang 100→50 • Dahan 70→40 • Ranting 45→20px'
                              : 'Ketebalan Garis: Seragam'
                          );
                          return next;
                        });
                      }}
                      title="Ketebalan Batang Pohon: Batang 100→50px • Dahan 70→40px • Ranting 45→20px"
                      className={`p-1.5 rounded-lg border shrink-0 transition ${
                        lineThicknessMode === 'tree_taper'
                          ? 'bg-amber-500 text-slate-950 border-amber-300'
                          : 'bg-stone-800 text-stone-300 border-stone-700 hover:text-white'
                      }`}
                    >
                      <Trees className="w-3.5 h-3.5" />
                    </button>

                    {/* 6. Panah Arah Silsilah */}
                    <button
                      type="button"
                      onClick={() =>
                        setShowLineArrows((v) => {
                          const next = !v;
                          showNotification(
                            next ? 'Panah Arah: Aktif' : 'Panah Arah: Mati'
                          );
                          return next;
                        })
                      }
                      title={`Panah Arah (Ortu ➔ Anak & Adik ➔ Kakak): ${
                        showLineArrows ? 'Aktif' : 'Mati'
                      }`}
                      className={`p-1.5 rounded-lg border shrink-0 transition ${
                        showLineArrows
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                          : 'bg-stone-800 text-stone-300 border-stone-700 hover:text-white'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    {smartAnalysis.recommendedPaper !== paperSize && (
                      <button
                        type="button"
                        onClick={() =>
                          applySmartLiveSetting({ paper: smartAnalysis.recommendedPaper })
                        }
                        className="px-1.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[9.5px] font-black whitespace-nowrap shrink-0"
                        title={`Ubah ke kertas ideal ${smartAnalysis.recommendedPaper.toUpperCase()}`}
                      >
                        {smartAnalysis.recommendedPaper.toUpperCase()}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                      className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 shrink-0"
                      title="Ganti Tema Gelap / Terang"
                    >
                      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchWorkspaceMode('edit')}
                      className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 shrink-0"
                      title="Masuk ke Mode Edit Manual"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSmartGalleryOpen(false)}
                      className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 shrink-0"
                      title="Perkecil Pilihan Smart"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Daftar Pilihan Tata Letak Smart (Ikon + Simbol Ringkas, 1 Klik Siap Cetak) */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {smartGalleryOptions.map((opt) => {
                    const isActive = activePresetId === opt.preset.id;
                    const isClean = opt.quality.overlapCount === 0 && opt.quality.outOfBoundsCount === 0;
                    const presetSymbol =
                      opt.preset.id === 'pohon_hayat_besar'
                        ? '🌳'
                        : opt.preset.id === 'teratai_mekar'
                        ? '🪷'
                        : opt.preset.id === 'sarang_lebah_turun'
                        ? '🍯'
                        : opt.preset.id === 'sarang_lebah_pusat' ||
                          opt.preset.id === 'molekul_organik'
                        ? '🐝'
                        : opt.preset.id === 'tetris_silsilah'
                        ? '🧩'
                        : opt.preset.id === 'modular_g3_I'
                        ? '◫'
                        : opt.preset.id === 'modular_g3_L'
                        ? '◰'
                        : opt.preset.id.startsWith('kotak_9')
                        ? '▦'
                        : opt.preset.id.startsWith('orbit')
                        ? '◎'
                        : opt.preset.id === 'hierarchy_grid_fill'
                        ? '▤'
                        : '⑂';
                    const isLockedPreset = Boolean(opt.preset.isLocked);
                    return (
                      <button
                        key={opt.preset.id}
                        type="button"
                        disabled={isLockedPreset}
                        onClick={() =>
                          handleApplySmartPreset(
                            opt.preset.id,
                            true,
                            undefined,
                            undefined,
                            undefined,
                            false
                          )
                        }
                        title={
                          isLockedPreset
                            ? `${opt.preset.title} (Sedang Dikunci)`
                            : opt.preset.title
                        }
                        className={`min-w-[116px] max-w-[144px] shrink-0 text-left px-2 py-1.5 rounded-xl border transition ${
                          isLockedPreset
                            ? 'bg-stone-900/60 border-stone-800 text-stone-400 opacity-55 cursor-not-allowed'
                            : isActive
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-xs'
                            : opt.isTopPick
                            ? 'bg-stone-800/95 border-amber-400/50 text-stone-100 hover:border-amber-300'
                            : 'bg-stone-800/75 border-stone-700 text-stone-200 hover:border-emerald-400/60'
                        }`}
                      >
                        <div className="text-[10.5px] font-extrabold truncate flex items-center gap-1">
                          <span>{isLockedPreset ? '🔒' : presetSymbol}</span>
                          <span className="truncate">{opt.preset.badge}</span>
                        </div>
                        <div className="text-[9px] font-mono tabular-nums text-stone-300 mt-0.5 truncate">
                          {isLockedPreset ? (
                            <span className="text-stone-400 font-bold">Terkunci</span>
                          ) : (
                            <>
                              <span
                                className={
                                  isClean
                                    ? 'text-emerald-300 font-bold'
                                    : 'text-amber-300 font-bold'
                                }
                              >
                                {isClean ? '0✓' : `${opt.quality.overlapCount}!`}
                              </span>
                              {' · '}
                              <span>{Math.round(opt.optimalScale * 100)}%</span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Dock Kontekstual Terpisah + Popup Pindah Interaktif (Khusus Mode Edit Manual) */}
        {studioWorkspaceMode === 'edit' && (selectedIds.length > 0 || moveUnlockedIds.length > 0) && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className={`absolute ${
              isLandscapeHud
                ? 'bottom-2.5 left-16 max-w-[58%]'
                : 'bottom-2.5 left-2.5 max-w-[74%]'
            } z-40 flex flex-col items-start gap-1.5 print:hidden`}
          >
            {/* Popup Interaktif Terpisah untuk Panah Pindah ▲▼◀▶ */}
            {moveUnlockedIds.length > 0 && (() => {
              const activeTargets = moveUnlockedIds.filter((id) => nodeMap.has(id));
              if (activeTargets.length === 0) return null;
              const anchorNode =
                (moveAnchorId && nodeMap.get(moveAnchorId)) ||
                nodeMap.get(activeTargets[0]);
              const activeStep = moveStepPx;

              return (
                <div className="rounded-2xl bg-stone-900/95 border border-emerald-400/50 text-white p-2.5 backdrop-blur-md shadow-2xl w-[224px] space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center justify-between gap-2 border-b border-stone-800 pb-1.5">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black text-emerald-300 flex items-center gap-1 truncate">
                        <Move className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {activeTargets.length > 1
                            ? `Pindah ${activeTargets.length} Kartu`
                            : `Pindah: ${anchorNode?.name || 'Kartu'}`}
                        </span>
                      </div>
                      {anchorNode && (
                        <div className="text-[9px] font-mono text-stone-400">
                          X:{Math.round(anchorNode.x)} • Y:{Math.round(anchorNode.y)}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMoveUnlockedIds([]);
                        setMoveAnchorId(null);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-300 text-[9.5px] font-black shrink-0"
                      title="Kunci kembali posisi kartu"
                    >
                      Kunci ✓
                    </button>
                  </div>

                  {/* Kontrol Panah Interaktif 4 Arah + Langkah Geser */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="grid grid-cols-3 gap-1 w-[114px] shrink-0">
                      <span />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startNudgeRepeat(activeTargets, 0, -activeStep);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          startNudgeRepeat(activeTargets, 0, -activeStep);
                        }}
                        onMouseUp={stopNudgeRepeat}
                        onMouseLeave={stopNudgeRepeat}
                        onTouchEnd={stopNudgeRepeat}
                        onTouchCancel={stopNudgeRepeat}
                        className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center shadow"
                        title="Geser ke Atas"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span />

                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startNudgeRepeat(activeTargets, -activeStep, 0);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          startNudgeRepeat(activeTargets, -activeStep, 0);
                        }}
                        onMouseUp={stopNudgeRepeat}
                        onMouseLeave={stopNudgeRepeat}
                        onTouchEnd={stopNudgeRepeat}
                        onTouchCancel={stopNudgeRepeat}
                        className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center shadow"
                        title="Geser ke Kiri"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setMoveStepPx((prev) =>
                            prev === 5 ? 20 : prev === 20 ? 40 : 5
                          )
                        }
                        className="h-8 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-[9.5px] font-mono font-black text-amber-300 flex items-center justify-center"
                        title="Ketuk untuk ubah jarak langkah geser (5px / 20px / 40px)"
                      >
                        {activeStep}px
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startNudgeRepeat(activeTargets, activeStep, 0);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          startNudgeRepeat(activeTargets, activeStep, 0);
                        }}
                        onMouseUp={stopNudgeRepeat}
                        onMouseLeave={stopNudgeRepeat}
                        onTouchEnd={stopNudgeRepeat}
                        onTouchCancel={stopNudgeRepeat}
                        className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center shadow"
                        title="Geser ke Kanan"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <span />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          startNudgeRepeat(activeTargets, 0, activeStep);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          startNudgeRepeat(activeTargets, 0, activeStep);
                        }}
                        onMouseUp={stopNudgeRepeat}
                        onMouseLeave={stopNudgeRepeat}
                        onTouchEnd={stopNudgeRepeat}
                        onTouchCancel={stopNudgeRepeat}
                        className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center shadow"
                        title="Geser ke Bawah"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-1 text-[9.5px]">
                      <div className="text-stone-300 leading-tight">
                        Tekan / tahan panah atau seret kartu langsung di kanvas.
                      </div>
                      <div className="flex items-center gap-1 pt-0.5">
                        {([5, 20, 40] as const).map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => setMoveStepPx(step)}
                            className={`flex-1 py-1 rounded-md font-bold text-[9px] border ${
                              moveStepPx === step
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'
                            }`}
                          >
                            {step}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-stone-900/92 border border-amber-500/40 text-white p-1.5 backdrop-blur-md shadow-xl">
                <span className="text-[10px] font-black text-amber-300 px-1.5">
                  {selectedIds.length} dipilih
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (layoutMode !== 'manual') {
                      setLayoutMode('manual');
                    }
                    const isAlready = selectedIds.every((id) =>
                      moveUnlockedIds.includes(id)
                    );
                    if (isAlready && moveUnlockedIds.length > 0) {
                      setMoveUnlockedIds([]);
                      setMoveAnchorId(null);
                    } else {
                      setMoveUnlockedIds(selectedIds);
                      setMoveAnchorId(selectedIds[0] || null);
                    }
                  }}
                  className={`px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 ${
                    selectedIds.some((id) => moveUnlockedIds.includes(id))
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-stone-800 text-emerald-300'
                  }`}
                  title="Buka popup kontrol panah pindah ▲▼◀▶ atau kunci posisi kartu"
                >
                  {selectedIds.some((id) => moveUnlockedIds.includes(id)) ? (
                    <Unlock className="w-3 h-3" />
                  ) : (
                    <Lock className="w-3 h-3" />
                  )}
                  <span>
                    {selectedIds.some((id) => moveUnlockedIds.includes(id))
                      ? 'Kunci'
                      : 'Pindah'}
                  </span>
                </button>

                {selectedIds.length === 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPanelTab('edit');
                        setIsPanelOpen(true);
                      }}
                      className="px-2 py-1 rounded-xl bg-amber-500 text-stone-950 text-[10px] font-black"
                    >
                      {primarySelectedNode?.mergedMembers?.length
                        ? 'Edit Gabungan'
                        : 'Ubah Nama/Foto'}
                    </button>
                    {primarySelectedNode?.mergedMembers &&
                      primarySelectedNode.mergedMembers.length >= 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUnmergeSelectedCard(primarySelectedNode.id)
                          }
                          className="px-2 py-1 rounded-xl bg-sky-500 text-stone-950 text-[10px] font-black flex items-center gap-1"
                          title="Pisahkan kembali menjadi kartu satuan di posisi saat ini"
                        >
                          <Split className="w-3 h-3" />
                          <span>Pisah Card</span>
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={startConnectMode}
                      className="px-2 py-1 rounded-xl bg-stone-800 text-sky-300 text-[10px] font-bold"
                    >
                      Garis
                    </button>
                  </>
                )}

                {selectedIds.length >= 2 && (
                  <>
                    <button
                      type="button"
                      onClick={handleMergeSelectedIntoBigCard}
                      className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-stone-950 text-[10px] font-black flex items-center gap-1 shadow-xs"
                      title="Gabung kartu/foto terpilih jadi 1 Card Besar dengan 1 garis (kartu lain tetap di posisinya)"
                    >
                      <Layers className="w-3 h-3" />
                      <span>Gabung 1 Card Besar</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGroupSelected}
                      className="px-2 py-1 rounded-xl bg-purple-600 text-white text-[10px] font-bold"
                    >
                      Group
                    </button>
                  </>
                )}

                {hasGroupInSelection && (
                  <button
                    type="button"
                    onClick={handleUngroupSelected}
                    className="px-2 py-1 rounded-xl bg-stone-800 text-rose-300 text-[10px] font-bold"
                  >
                    Lepas
                  </button>
                )}

                <button
                  type="button"
                  onClick={deleteSelectedNodes}
                  className="p-1.5 rounded-xl bg-rose-600/20 text-rose-400 hover:bg-rose-600/30"
                  title="Hapus Terpilih"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds([]);
                    setMoveUnlockedIds([]);
                    setMoveAnchorId(null);
                  }}
                  className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white"
                  title="Batal Pilih"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar Bawah Kanvas (Ringkas) */}
      {!isFocusMode && (
      <div
        className={`px-3 py-1 border-t text-[10px] flex items-center justify-between gap-2 shrink-0 print:hidden ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-400'
            : 'bg-stone-50 border-stone-200 text-stone-600'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="font-bold text-emerald-400">
            {layoutMode === 'manual' ? 'Manual' : 'Auto'} • {paperDim.label}{' '}
            {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}
          </span>
          <span className="hidden sm:inline opacity-75">
            • Ketuk &quot;Pilih&quot; untuk checklist langsung • Tahan kartu 2 dtk untuk panah ▲▼◀▶ • Ctrl+Z Undo
          </span>
        </span>
        <span className="font-mono shrink-0">
          {boardWidth} × {boardHeight} px
        </span>
      </div>
      )}
      <ModularFeeSheet
        isOpen={showPrintFeeModal}
        moduleId="leluhurqu_export"
        actionLabel={
          pendingExportAction === 'png'
            ? `Unduh PNG HD Silsilah ${paperDim.label}`
            : pendingExportAction === 'pdf'
            ? `Unduh PDF Silsilah ${paperDim.label}`
            : `Cetak Poster Silsilah ${paperDim.label}`
        }
        unlockModule={true}
        onClose={() => setShowPrintFeeModal(false)}
        onPaid={() => {
          setShowPrintFeeModal(false);
          setTimeout(() => {
            if (pendingExportAction === 'print') {
              void executeGridPrint();
            } else {
              void executeGridPosterExport(pendingExportAction);
            }
          }, 150);
        }}
        showNotification={showNotification}
      />

      {/* Modal Pratinjau Hasil Unduh Poster HD (Khusus mempermudah Simpan/Bagikan di APK Android & HP) */}
      {posterPreviewModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 print:hidden">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90dvh]">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-amber-300 flex items-center gap-1.5 truncate">
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  <span>
                    {posterPreviewModal.filename.includes('_Draft.')
                      ? 'Draft Silsilah Ringan Siap'
                      : 'Poster Silsilah HD Siap (Penuh Warna)'}
                  </span>
                </h3>
                <p className="text-[10.5px] text-slate-400 truncate">
                  {posterPreviewModal.width} × {posterPreviewModal.height} px •{' '}
                  {posterPreviewModal.upscaledCount > 0
                    ? `${posterPreviewModal.upscaledCount} foto otomatis di-upscale 2.5× tajam`
                    : posterPreviewModal.filename.includes('_Draft.')
                    ? 'Ukuran file ringan untuk pratinjau cepat (tanpa upscale)'
                    : 'Resolusi tinggi penuh warna'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPosterPreviewModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-950 overflow-auto flex-1 flex items-center justify-center">
              <img
                src={posterPreviewModal.dataUrl}
                alt={posterPreviewModal.filename}
                className="max-w-full max-h-[60dvh] object-contain rounded-lg border border-slate-800 shadow-lg"
              />
            </div>
            <div className="px-4 py-3 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const blob = dataUrlToBlob(posterPreviewModal.dataUrl);
                    await saveOrShareFileBlob(
                      blob,
                      posterPreviewModal.filename,
                      `Poster Silsilah ${activeTrah.name}`
                    );
                    showNotification(`Menyimpan / membagikan ${posterPreviewModal.filename}...`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Simpan / Bagikan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPosterPreviewModal(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Modal Racik Blueprint Desain AI (Hanya kirim kerangka struktur ringkas, 0 foto & 0 data pribadi) */}
      {isAiDesignModalOpen && (
        <div
          onClick={() => !isAiDesigning && setIsAiDesignModalOpen(false)}
          className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 print:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border border-violet-500/45 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90dvh]"
          >
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2 bg-gradient-to-r from-violet-950/60 to-slate-900">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-violet-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Racik Blueprint Desain AI</span>
                </h3>
                <p className="text-[10.5px] text-slate-400">
                  Menyesuaikan lekuk, warna &amp; keseimbangan cabang ke struktur tabel Anda
                </p>
              </div>
              <button
                type="button"
                disabled={isAiDesigning}
                onClick={() => setIsAiDesignModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5">
                  Gaya Dasar Organik
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'auto' as const, label: '✨ Otomatis Ideal' },
                      { id: 'honeycomb_tier' as const, label: '🍯 Sarang Lebah Turun' },
                      { id: 'honeycomb_radial' as const, label: '🐝 Sarang Lebah Pusat' },
                      { id: 'lotus_mandala' as const, label: '🪷 Teratai Kolam' },
                      { id: 'tree_organic' as const, label: '🌳 Pohon Hayat (Kunci)' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAiDesignArchetype(item.id)}
                      className={`px-2.5 py-2 rounded-xl border text-[11px] font-extrabold text-left transition ${
                        aiDesignArchetype === item.id
                          ? 'bg-violet-500/25 border-violet-400 text-white'
                          : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5">
                  Arahan Nuansa / Keseimbangan (Opsional)
                </label>
                <input
                  type="text"
                  value={aiDesignPrompt}
                  onChange={(e) => setAiDesignPrompt(e.target.value)}
                  placeholder="Contoh: Sarang lebah emas zamrud, kolam teratai kerajaan..."
                  maxLength={140}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-hidden focus:border-violet-400"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[
                    'Sarang lebah emas & zamrud',
                    'Sarang lebah pusat kerajaan',
                    'Teratai kolam emas malam',
                    'Beringin rindang & seimbang',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAiDesignPrompt(chip)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-slate-300"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[10.5px] text-slate-300 space-y-1">
                <div className="flex items-center justify-between font-bold text-emerald-300">
                  <span>Hemat Token &amp; Privasi Aman</span>
                  <span className="font-mono">
                    Jatah AI: {aiQuotaInfo.remainingToday}/{aiQuotaInfo.maxPerDay}
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Hanya mengirim kerangka jumlah generasi &amp; cabang (tanpa foto/nama pribadi).
                  Ubah kertas, edit cabang G3–G5, atau unduh ulang memakai <b>0 token AI</b>.
                </p>
              </div>

              {aiBlueprint && (
                <div className="p-2.5 rounded-xl bg-violet-950/35 border border-violet-500/35 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-black text-violet-200 truncate">
                      Aktif: {aiBlueprint.themeTitle}
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate">
                      {aiBlueprint.designRationale}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAiBlueprint(null);
                      const pId =
                        activePresetId &&
                        activePresetId !== 'pohon_hayat_besar' &&
                        activePresetId !== 'tetris_silsilah'
                          ? activePresetId
                          : 'subtree_vertical';
                      const rebuilt = rebuildSmartLayoutPreservingVisuals(
                        windowedMembers,
                        pId,
                        nodes,
                        boardWidth,
                        boardHeight,
                        cardDisplayMode,
                        photoFrameSize,
                        cardScale,
                        cardGapMm,
                        modularG12Position,
                        null
                      );
                      setNodes(rebuilt.nodes);
                      setEdges(rebuilt.edges);
                      persistCurrentDesign(rebuilt.nodes, rebuilt.edges, undefined, cardScale, pId, null);
                      setIsAiDesignModalOpen(false);
                      showNotification('Blueprint AI direset ke gaya standar preset.');
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] font-bold shrink-0"
                  >
                    Reset
                  </button>
                </div>
              )}

              {aiDesignError && (
                <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-[11px]">
                  {aiDesignError}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isAiDesigning}
                onClick={() => setIsAiDesignModalOpen(false)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isAiDesigning || windowedMembers.length === 0}
                onClick={() => void handleRunAiBlueprintDesigner()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow-lg"
              >
                {isAiDesigning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Meracik...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Racik &amp; Terapkan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <PhotoCropGuideModal
        isOpen={Boolean(pendingCropFile)}
        file={pendingCropFile}
        title={
          primarySelectedNode
            ? `Atur Foto — ${primarySelectedNode.name}`
            : 'Atur Tata Letak Foto'
        }
        defaultGuideShape={
          primarySelectedNode?.cardShape === 'hex'
            ? 'hex'
            : primarySelectedNode?.cardShape === 'petal' || photoShape === 'bulat'
            ? 'circle'
            : photoShape === 'segi6'
            ? 'hex'
            : ('rect_3x4' as CropGuideShape)
        }
        onCancel={() => setPendingCropFile(null)}
        onConfirm={(croppedDataUrl, sizeInfo) => {
          updateSelectedField({ photo: croppedDataUrl });
          setPendingCropFile(null);
          showNotification(
            `Foto terpasang & terkompres rapi (${sizeInfo.orig} KB ➔ ${sizeInfo.comp} KB) ⚡`
          );
        }}
      />
    </div>
  );
};
