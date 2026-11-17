import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  LayoutGrid,
  Move,
  Wand2,
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
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Split,
  Undo2,
  Rows3,
  CircleDot,
  Disc,
  GitBranch,
  ArrowRightLeft,
  Users,
} from 'lucide-react';
import { FamilyMember, TrahCategory } from './LeluhurQuView';
import { MonetizationService } from '../../services/monetizationService';
import { ModularFeeSheet } from '../monetization/ModularFeeSheet';
import {
  SMART_LAYOUT_PRESETS,
  SmartPresetId,
  GuideOverlayMode,
  analyzeTrahForSmartLayout,
  computeOptimalCardScale,
  generateSmartLayoutFromTable,
} from './smartGridLayouts';

export type GridLayoutMode = 'auto' | 'manual';
export type CanvasTheme = 'dark' | 'light';
export type CanvasBackground = '' | 'bg-gunung' | 'bg-pohon' | 'bg-galaksi';
export type GridPaperSize = 'a4' | 'a3' | 'a2' | 'a1' | 'a0';
export type GridPaperOrientation = 'landscape' | 'portrait';
export type CardDisplayMode = 'full' | 'name_only' | 'photo_only';
export type PhotoFrameSize = 'bulat' | '2x3' | '3x4' | '4x6';
export type ConnectorLineStyle = 'pcb90' | 'pcb45' | 'straight' | 'curved';
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
  cardScale?: number;
  showGenGuides?: boolean;
  guideOverlayMode?: GuideOverlayMode;
  linesOnTop?: boolean;
  theme: CanvasTheme;
  bgStyle: CanvasBackground;
  lineStyle?: ConnectorLineStyle;
  lineThickness?: number;
  childLineColor?: string;
  coupleLineColor?: string;
  cardBgColor?: string;
  cardBorderColor?: string;
  captionInfo?: CanvasCaptionInfo;
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
    }
  ) => void;
  showNotification: (msg: string) => void;
  defaultCuratorName?: string;
  defaultCreatedYear?: string;
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
  bulat: { w: 56, h: 56, label: 'Bulat' },
  '2x3': { w: 56, h: 84, label: '2×3' },
  '3x4': { w: 66, h: 88, label: '3×4' },
  '4x6': { w: 80, h: 120, label: '4×6' },
};

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
    createdByApp: 'LeluhurQu',
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

function getScaledPhotoDim(
  photoSize: PhotoFrameSize,
  cardScale = 1
): { w: number; h: number } {
  const base = PHOTO_DIMENSIONS[photoSize];
  return {
    w: Math.max(28, Math.round(base.w * cardScale)),
    h: Math.max(28, Math.round(base.h * cardScale)),
  };
}

function getMergedGridMetrics(
  membersCount: number,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1,
  customCols?: number
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
  const pDim = PHOTO_DIMENSIONS[photoSize];
  const gap = Math.max(4, Math.round((displayMode === 'photo_only' ? 6 : 8) * cardScale));
  const padX = Math.max(6, Math.round(10 * cardScale));
  const padY = Math.max(6, Math.round(10 * cardScale));

  if (displayMode === 'photo_only') {
    const cellW = Math.max(28, Math.round(pDim.w * cardScale));
    const cellH = Math.max(28, Math.round(pDim.h * cardScale));
    return {
      cols,
      rows,
      cellW,
      cellH,
      gap,
      padX,
      padY,
      headerH: 0,
      w: cols * cellW + (cols - 1) * gap + padX * 2,
      h: rows * cellH + (rows - 1) * gap + padY * 2,
    };
  }

  if (displayMode === 'name_only') {
    const cellW = Math.max(76, Math.round(114 * cardScale));
    const cellH = Math.max(22, Math.round(28 * cardScale));
    const headerH = Math.max(16, Math.round(20 * cardScale));
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

  // 'full'
  const cellW = Math.max(76, Math.round(Math.max(98, pDim.w + 28) * cardScale));
  const cellH = Math.max(58, Math.round((pDim.h + 46) * cardScale));
  const headerH = Math.max(18, Math.round(24 * cardScale));
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

// Hitung dimensi aktual kartu agar garis konektor & tata letak presisi 100%
function getNodeSize(
  node: InteractiveNode,
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1
): { w: number; h: number } {
  if (node.mergedMembers && node.mergedMembers.length >= 2) {
    const m = getMergedGridMetrics(
      node.mergedMembers.length,
      displayMode,
      photoSize,
      cardScale,
      node.mergedCols
    );
    return { w: m.w, h: m.h };
  }

  const pDim = PHOTO_DIMENSIONS[photoSize];

  if (displayMode === 'photo_only') {
    return {
      w: Math.round((pDim.w + 10) * cardScale),
      h: Math.round((pDim.h + 10) * cardScale),
    };
  }

  if (displayMode === 'name_only') {
    const estW = Math.max(96, Math.min(180, node.name.length * 8 + 26));
    return {
      w: Math.round(estW * cardScale),
      h: Math.max(24, Math.round(38 * cardScale)),
    };
  }

  // 'full'
  const cardW = Math.round(Math.max(145, pDim.w + 36) * cardScale);
  const cardH = Math.round((pDim.h + 52) * cardScale);
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
          photo: '',
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

function getSmartPorts(
  n1: InteractiveNode,
  n2: InteractiveNode,
  edgeType: 'couple' | 'child',
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1
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

  // Pasangan di baris sejajar selalu tersambung rapi kiri-kanan
  if (
    edgeType === 'couple' &&
    Math.abs(cy1 - cy2) < Math.max(s1.h, s2.h) * 0.75
  ) {
    if (n2.x >= n1.x) {
      return { a: p1.right, b: p2.left, dir1: 'right' as PortKey, dir2: 'left' as PortKey };
    }
    return { a: p1.left, b: p2.right, dir1: 'left' as PortKey, dir2: 'right' as PortKey };
  }

  // Keturunan ke bawah -> jalur PCB keluar dari port bawah ke port atas anak
  if (edgeType === 'child' && n2.y >= n1.y + s1.h * 0.6) {
    return { a: p1.bottom, b: p2.top, dir1: 'bottom' as PortKey, dir2: 'top' as PortKey };
  }

  // Keturunan cabang horizontal kiri ke kanan
  if (
    edgeType === 'child' &&
    n2.x >= n1.x + s1.w * 0.75 &&
    Math.abs(cy1 - cy2) < 200
  ) {
    return { a: p1.right, b: p2.left, dir1: 'right' as PortKey, dir2: 'left' as PortKey };
  }

  let minDist = Infinity;
  let bestPair: {
    a: { x: number; y: number };
    b: { x: number; y: number };
    dir1: PortKey;
    dir2: PortKey;
  } = { a: p1.bottom, b: p2.top, dir1: 'bottom', dir2: 'top' };

  (Object.keys(p1) as PortKey[]).forEach((k1) => {
    (Object.keys(p2) as PortKey[]).forEach((k2) => {
      const dx = p1[k1].x - p2[k2].x;
      const dy = p1[k1].y - p2[k2].y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        minDist = dist;
        bestPair = { a: p1[k1], b: p2[k2], dir1: k1, dir2: k2 };
      }
    });
  });

  return bestPair;
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
  const midX = Math.round(((ax + bx) / 2) * 10) / 10;
  const midY = Math.round(((ay + by) / 2) * 10) / 10;

  const ox = edge.offsetX ?? 0;
  const oy = edge.offsetY ?? 0;
  const isCustomOffset = Math.abs(ox) >= 2 || Math.abs(oy) >= 2;
  const otherBoxes = obstacles.filter((ob) => ob.id !== edge.from && ob.id !== edge.to);

  if (lineStyle === 'straight') {
    const hx = Math.round((midX + ox) * 10) / 10;
    const hy = Math.round((midY + oy) * 10) / 10;
    if (!isCustomOffset) {
      return {
        d: `M ${ax} ${ay} L ${bx} ${by}`,
        handle: { x: midX, y: midY },
        isCustomOffset: false,
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
    if (!isCustomOffset) {
      const d =
        dir1 === 'top' || dir1 === 'bottom'
          ? `M ${ax} ${ay} C ${ax} ${midY}, ${bx} ${midY}, ${bx} ${by}`
          : `M ${ax} ${ay} C ${midX} ${ay}, ${midX} ${by}, ${bx} ${by}`;
      return { d, handle: { x: midX, y: midY }, isCustomOffset: false };
    }
    // Kurva kuadratik yang persis melewati titik dot (hx, hy)
    const cx = Math.round((2 * hx - midX) * 10) / 10;
    const cy = Math.round((2 * hy - midY) * 10) / 10;
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
            const nextSub =
              m.callName ||
              (m.birthYear ? `Lahir ${m.birthYear}` : `Gen ${m.generationLevel}`);
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

        if (subChanged) {
          changed = true;
          if (syncedMerged.length === 1) {
            const lone = syncedMerged[0];
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
          return { ...n, mergedMembers: syncedMerged };
        }
        return n;
      }

      if (!n.memberId) return n;
      const m = memberMap.get(n.memberId);
      if (!m) return n;
      const nextSub =
        m.callName ||
        (m.birthYear ? `Lahir ${m.birthYear}` : `Gen ${m.generationLevel}`);
      const nextPhoto = m.photoUrl || n.photo;
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
        sub:
          m.callName ||
          (m.birthYear ? `Lahir ${m.birthYear}` : `Gen ${m.generationLevel}`),
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
            photo: '',
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
> = ({ activeTrah, onOpenTable, onSyncMember, showNotification, defaultCuratorName = '', defaultCreatedYear = '' }) => {
  // Mode Layout & Interaksi
  const [layoutMode, setLayoutMode] = useState<GridLayoutMode>('manual');
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showPrintFeeModal, setShowPrintFeeModal] = useState<boolean>(false);

  // Kertas A0 - A4 & Orientasi
  const [paperSize, setPaperSize] = useState<GridPaperSize>('a3');
  const [paperOrientation, setPaperOrientation] =
    useState<GridPaperOrientation>('landscape');

  // Gaya Card & Foto (Lengkap / Nama Saja / Foto Saja + Bulat / 2x3 / 3x4 / 4x6 + Skala)
  const [cardDisplayMode, setCardDisplayMode] =
    useState<CardDisplayMode>('full');
  const [photoFrameSize, setPhotoFrameSize] =
    useState<PhotoFrameSize>('3x4');
  const [cardScale, setCardScale] = useState<number>(1);
  const [showGenGuides, setShowGenGuides] = useState<boolean>(true);
  const [guideOverlayMode, setGuideOverlayMode] = useState<GuideOverlayMode>('gen_bands');
  const [smartCategoryFilter, setSmartCategoryFilter] = useState<'all' | 'kotak9' | 'orbit' | 'klasik'>('all');

  // Tema & Background
  const [theme, setTheme] = useState<CanvasTheme>('dark');
  const [bgStyle, setBgStyle] = useState<CanvasBackground>('');

  // Gaya Garis PCB / Warna Garis & Card / Keterangan Poster
  const [lineStyle, setLineStyle] = useState<ConnectorLineStyle>('pcb90');
  const [lineThickness, setLineThickness] = useState<number>(2.5);
  const [childLineColor, setChildLineColor] = useState<string>('');
  const [coupleLineColor, setCoupleLineColor] = useState<string>('#f59e0b');
  const [linesOnTop, setLinesOnTop] = useState<boolean>(false);
  const [showLineDots, setShowLineDots] = useState<boolean>(true);
  const [cardBgColor, setCardBgColor] = useState<string>('');
  const [cardBorderColor, setCardBorderColor] = useState<string>('');
  const [captionInfo, setCaptionInfo] = useState<CanvasCaptionInfo>(() =>
    getDefaultCaptionInfo(activeTrah.name, defaultCuratorName, defaultCreatedYear)
  );

  // Kunci Geser Aman (Hold 2 detik untuk tampilkan panah ▲▼◀▶ & buka geser kartu)
  const [safeHoldMove, setSafeHoldMove] = useState<boolean>(true);
  const [holdingState, setHoldingState] = useState<{
    nodeId: string;
    progress: number;
  } | null>(null);
  const [moveUnlockedIds, setMoveUnlockedIds] = useState<string[]>([]);
  const [moveAnchorId, setMoveAnchorId] = useState<string | null>(null);
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

  // Mode Leluasa (Layar Penuh dengan Tombol Melayang Adaptif) & Navigasi Sentuh
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [autoScreenOrient, setAutoScreenOrient] = useState<boolean>(false);

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

  // Manajemen Desain Tersimpan
  const [savedDesigns, setSavedDesigns] = useState<SavedGridDesign[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string>('');
  const [designNameInput, setDesignNameInput] = useState<string>('');

  const boardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const loadedTrahIdRef = useRef<string>('');
  const lastMemberSigRef = useRef<string>('');

  // Pinch-to-Zoom 2 Jari & Pan Hand Ref
  const pinchRef = useRef<{
    active: boolean;
    startDist: number;
    startZoom: number;
    midX: number;
    midY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({
    active: false,
    startDist: 0,
    startZoom: 1,
    midX: 0,
    midY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });

  const panDragRef = useRef<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
  }>({
    active: false,
    startClientX: 0,
    startClientY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
  });

  // Drag State Ref (mendukung drag 1 kartu, multi-select, maupun satu Group sekaligus!)
  const dragStateRef = useRef<{
    active: boolean;
    movingIds: string[];
    startPointerX: number;
    startPointerY: number;
    initialPositions: Record<string, { x: number; y: number }>;
    preDragNodes?: InteractiveNode[];
  }>({
    active: false,
    movingIds: [],
    startPointerX: 0,
    startPointerY: 0,
    initialPositions: {},
  });

  // Dimensi Kertas Aktif (A0 - A4)
  const paperDim = GRID_PAPER_MAP[paperSize];
  const boardWidth =
    paperOrientation === 'landscape' ? paperDim.pxW : paperDim.pxH;
  const boardHeight =
    paperOrientation === 'landscape' ? paperDim.pxH : paperDim.pxW;

  const designsStorageKey = `${DESIGNS_STORAGE_PREFIX}${activeTrah.id}`;
  const activeDesignIdKey = `${ACTIVE_DESIGN_ID_PREFIX}${activeTrah.id}`;

  const getMemberSig = (members: FamilyMember[]) =>
    members
      .map(
        (m) =>
          `${m.id}:${m.name}:${m.gender}:${m.callName || ''}:${m.birthYear || ''}:${m.deathYear || ''}:${m.isDeceased ? 1 : 0}:${m.photoUrl || ''}:${m.parentId || ''}:${m.generationLevel}:${(m.spouses || []).map((s) => s.name).join('|')}`
      )
      .join(';');

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

    if (loadedDesigns.length > 0) {
      let target =
        loadedDesigns.find((d) => d.id === storedActiveId) || loadedDesigns[0];
      let nextDesigns = loadedDesigns;

      // Sinkronkan desain tersimpan dengan data anggota terbaru (mis. saat baru tambah/impor banyak anggota di Excel lalu kembali ke Grid!)
      if (activeTrah.members.length > 0) {
        const pKey = target.paperSize || 'a3';
        const pDim = GRID_PAPER_MAP[pKey];
        const pW = (target.paperOrientation || 'landscape') === 'landscape' ? pDim.pxW : pDim.pxH;
        const pH = (target.paperOrientation || 'landscape') === 'landscape' ? pDim.pxH : pDim.pxW;
        const cMode = target.cardDisplayMode || 'full';
        const phSize = target.photoFrameSize || '3x4';
        const curScale = target.cardScale ?? 1;

        const reconciled = reconcileCanvasWithMembers(
          target.nodes,
          target.edges,
          activeTrah.members,
          pW,
          pH,
          cMode,
          phSize,
          curScale,
          false
        );

        if (reconciled.changed) {
          target = {
            ...target,
            nodes: reconciled.nodes,
            edges: reconciled.edges,
            quickText: buildQuickTextFromTrah(activeTrah.members),
            cardScale: reconciled.nextScale,
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

      setSavedDesigns(nextDesigns);
      setActiveDesignId(target.id);
      setDesignNameInput(target.name);
      setNodes(target.nodes);
      setEdges(target.edges);
      setQuickText(target.quickText);
      setPaperSize(target.paperSize || 'a3');
      setPaperOrientation(target.paperOrientation || 'landscape');
      setCardDisplayMode(target.cardDisplayMode || 'full');
      setPhotoFrameSize(target.photoFrameSize || '3x4');
      setCardScale(target.cardScale ?? 1);
      setShowGenGuides(target.showGenGuides ?? true);
      setGuideOverlayMode(target.guideOverlayMode || 'gen_bands');
      setLinesOnTop(target.linesOnTop ?? false);
      setTheme(target.theme || 'dark');
      setBgStyle(target.bgStyle || '');
      setLineStyle(target.lineStyle || 'pcb90');
      setLineThickness(target.lineThickness || 2.5);
      setChildLineColor(target.childLineColor ?? '');
      setCoupleLineColor(target.coupleLineColor ?? '#f59e0b');
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
      return;
    }

    // Buat desain awal otomatis di kertas A3 memakai skala kartu/foto optimal
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
      activeTrah.members.length > 16 ? 'hierarchy_grid_fill' : 'subtree_vertical',
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
      cardScale: initScale,
      showGenGuides: true,
      guideOverlayMode: 'gen_bands',
      theme: 'dark',
      bgStyle: '',
      lineStyle: 'pcb90',
      lineThickness: 2.5,
      childLineColor: '',
      coupleLineColor: '#f59e0b',
      cardBgColor: '',
      cardBorderColor: '',
      captionInfo: defaultCap,
    };
    setCardScale(initScale);
    setShowGenGuides(true);
    setGuideOverlayMode('gen_bands');
    setSavedDesigns([initialDesign]);
    setActiveDesignId(initialDesign.id);
    setDesignNameInput(initialDesign.name);
    setNodes(initialDesign.nodes);
    setEdges(initialDesign.edges);
    setQuickText(initialDesign.quickText);
    setLineStyle('pcb90');
    setLineThickness(2.5);
    setChildLineColor('');
    setCoupleLineColor('#f59e0b');
    setCardBgColor('');
    setCardBorderColor('');
    setCaptionInfo(defaultCap);
    setSelectedIds([]);
    undoStackRef.current = [];
    setUndoCount(0);
    loadedTrahIdRef.current = activeTrah.id;
    lastMemberSigRef.current = getMemberSig(activeTrah.members);
    try {
      localStorage.setItem(designsStorageKey, JSON.stringify([initialDesign]));
      localStorage.setItem(activeDesignIdKey, initialDesign.id);
    } catch (e) {
      console.warn(e);
    }
  }, [activeTrah.id, activeTrah.name, designsStorageKey, activeDesignIdKey]);

  // Persist perubahan pada desain aktif secara otomatis
  const persistCurrentDesign = useCallback(
    (
      overrideNodes?: InteractiveNode[],
      overrideEdges?: InteractiveEdge[],
      overrideQuickText?: string,
      overrideCardScale?: number
    ) => {
      if (!activeDesignId) return;
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
                cardScale: overrideCardScale ?? cardScale,
                showGenGuides,
                guideOverlayMode,
                linesOnTop,
                theme,
                bgStyle,
                lineStyle,
                lineThickness,
                childLineColor,
                coupleLineColor,
                cardBgColor,
                cardBorderColor,
                captionInfo,
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
      nodes,
      edges,
      quickText,
      paperSize,
      paperOrientation,
      cardDisplayMode,
      photoFrameSize,
      cardScale,
      showGenGuides,
      guideOverlayMode,
      linesOnTop,
      theme,
      bgStyle,
      lineStyle,
      lineThickness,
      childLineColor,
      coupleLineColor,
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
    cardScale,
    showGenGuides,
    guideOverlayMode,
    linesOnTop,
    theme,
    bgStyle,
    lineStyle,
    lineThickness,
    childLineColor,
    coupleLineColor,
    cardBgColor,
    cardBorderColor,
    captionInfo,
  ]);

  // Sinkronisasi otomatis perubahan anggota dari Tabel Excel / Isi Cepat / Edit ke Kanvas Grid aktif
  useEffect(() => {
    if (!activeDesignId || loadedTrahIdRef.current !== activeTrah.id) return;
    const nextSig = getMemberSig(activeTrah.members);
    if (nextSig === lastMemberSigRef.current) return;
    lastMemberSigRef.current = nextSig;

    const refreshedQuickText = buildQuickTextFromTrah(activeTrah.members);
    const reconciled = reconcileCanvasWithMembers(
      nodes,
      edges,
      activeTrah.members,
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
  }, [activeTrah.id, activeTrah.members, activeDesignId]);

  // Auto-Fit kanvas ke viewport layar (menyesuaikan lebar & tinggi agar kertas Potret/Lanskap utuh)
  const handleFitScreen = useCallback(() => {
    if (!viewportRef.current) return;
    const pad = isFocusMode ? 24 : 40;
    const availW = Math.max(160, viewportRef.current.clientWidth - pad);
    const availH = Math.max(160, viewportRef.current.clientHeight - pad);
    const fit = Math.max(
      0.15,
      Math.min(1.5, +Math.min(availW / boardWidth, availH / boardHeight).toFixed(2))
    );
    setZoom(fit);
    showNotification(
      `Kertas ${paperDim.label} (${paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}) pas layar (${Math.round(
        fit * 100
      )}%)`
    );
  }, [boardWidth, boardHeight, isFocusMode, paperDim.label, paperOrientation, showNotification]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (viewportRef.current) {
        const pad = isFocusMode ? 24 : 40;
        const availW = Math.max(160, viewportRef.current.clientWidth - pad);
        const availH = Math.max(160, viewportRef.current.clientHeight - pad);
        const fit = Math.max(
          0.15,
          Math.min(1.1, +Math.min(availW / boardWidth, availH / boardHeight).toFixed(2))
        );
        setZoom(fit);
      }
    }, 60);
    return () => clearTimeout(t);
  }, [paperSize, paperOrientation, activeDesignId, isFocusMode, boardWidth, boardHeight]);

  // Ikuti orientasi layar (Potret / Lanskap) otomatis bila diaktifkan
  useEffect(() => {
    if (!autoScreenOrient) return;
    const syncOrientationToScreen = () => {
      const targetOrient: GridPaperOrientation =
        window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
      setPaperOrientation((prev) => (prev === targetOrient ? prev : targetOrient));
    };
    syncOrientationToScreen();
    window.addEventListener('resize', syncOrientationToScreen);
    window.addEventListener('orientationchange', syncOrientationToScreen);
    return () => {
      window.removeEventListener('resize', syncOrientationToScreen);
      window.removeEventListener('orientationchange', syncOrientationToScreen);
    };
  }, [autoScreenOrient]);

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
              cardScale,
              showGenGuides,
              guideOverlayMode,
              theme,
              bgStyle,
              lineStyle,
              lineThickness,
              childLineColor,
              coupleLineColor,
              cardBgColor,
              cardBorderColor,
              captionInfo,
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
        cardScale,
        showGenGuides,
        guideOverlayMode,
        theme,
        bgStyle,
        lineStyle,
        lineThickness,
        childLineColor,
        coupleLineColor,
        cardBgColor,
        cardBorderColor,
        captionInfo,
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
        : buildCanvasFromTrah(activeTrah.members, boardWidth);
    const text = mode === 'blank' ? '' : buildQuickTextFromTrah(activeTrah.members);

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
      cardScale,
      showGenGuides,
      guideOverlayMode,
      theme,
      bgStyle,
      lineStyle,
      lineThickness,
      childLineColor,
      coupleLineColor,
      cardBgColor,
      cardBorderColor,
      captionInfo,
    };

    const nextList = [freshDesign, ...savedDesigns];
    setSavedDesigns(nextList);
    setActiveDesignId(newId);
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
    setDesignNameInput(design.name);
    setNodes(design.nodes);
    setEdges(design.edges);
    setQuickText(design.quickText);
    setPaperSize(design.paperSize || 'a3');
    setPaperOrientation(design.paperOrientation || 'landscape');
    setCardDisplayMode(design.cardDisplayMode || 'full');
    setPhotoFrameSize(design.photoFrameSize || '3x4');
    setCardScale(design.cardScale ?? 1);
    setShowGenGuides(design.showGenGuides ?? true);
    setGuideOverlayMode(design.guideOverlayMode || 'gen_bands');
    setLinesOnTop(design.linesOnTop ?? false);
    setTheme(design.theme || 'dark');
    setBgStyle(design.bgStyle || '');
    setLineStyle(design.lineStyle || 'pcb90');
    setLineThickness(design.lineThickness || 2.5);
    setChildLineColor(design.childLineColor ?? '');
    setCoupleLineColor(design.coupleLineColor ?? '#f59e0b');
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

      const prevByName = new Map<string, InteractiveNode>();
      nodes.forEach((n) => prevByName.set(n.name.trim().toLowerCase(), n));

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
            if (/\((P|Pr|Perempuan|Wanita|Perp|F)\)/i.test(cleanName)) {
              parsedGender = 'P';
              cleanName = cleanName.replace(/\((P|Pr|Perempuan|Wanita|Perp|F)\)/i, '').trim();
            } else if (/\((L|Lk|Laki|Laki-laki|Pria|M)\)/i.test(cleanName)) {
              parsedGender = 'L';
              cleanName = cleanName.replace(/\((L|Lk|Laki|Laki-laki|Pria|M)\)/i, '').trim();
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

            nextNodes.push({
              id,
              name: cleanName,
              sub:
                prev?.sub ||
                (rowIdx === 0 ? 'Leluhur Inti' : `Generasi ${rowIdx + 1}`),
              x: posX,
              y: posY,
              photo: prev?.photo || '',
              wafat: prev?.wafat || false,
              gender: parsedGender ?? prev?.gender,
              memberId: prev?.memberId,
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
      showNotification(
        `Auto-Grid menata ${nextNodes.length} kartu ke kertas ${paperDim.label}!`
      );
    },
    [quickText, nodes, boardWidth, paperDim.label, persistCurrentDesign, pushUndoSnapshot, showNotification]
  );

  // =========================================================================
  // SMART REKOMENDASI TATA LETAK BERBASIS DATA TABEL (ANTI-SILANG)
  // =========================================================================
  const smartAnalysis = useMemo(
    () => analyzeTrahForSmartLayout(activeTrah.members),
    [activeTrah.members]
  );

  const handleApplySmartPreset = useCallback(
    (presetId: SmartPresetId, overrideLockPaper?: boolean) => {
      const preset = SMART_LAYOUT_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      pushUndoSnapshot(`Smart: ${preset.title}`);

      const keepCurrentPaper =
        overrideLockPaper !== undefined ? overrideLockPaper : lockSelectedPaper;

      let nextPaper = paperSize;
      let nextOrient = paperOrientation;
      let nextCardMode = cardDisplayMode;
      let nextPhotoSize = photoFrameSize;

      if (!keepCurrentPaper) {
        nextPaper = smartAnalysis.recommendedPaper;
        setPaperSize(nextPaper);
      }

      if (applyRecommendedStyle) {
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
        if (preset.recommendedLineStyle) {
          setLineStyle(preset.recommendedLineStyle);
        }
      }

      const targetPaperObj = GRID_PAPER_MAP[nextPaper];
      const targetW =
        nextOrient === 'landscape' ? targetPaperObj.pxW : targetPaperObj.pxH;
      const targetH =
        nextOrient === 'landscape' ? targetPaperObj.pxH : targetPaperObj.pxW;

      // Hitung skala kartu/foto otomatis agar kertas pilihan (mis. A3) terisi pas: tidak terlalu kosong & tidak menumpuk
      const nextScale = applyRecommendedStyle
        ? computeOptimalCardScale(
            activeTrah.members,
            targetW,
            targetH,
            nextCardMode,
            nextPhotoSize,
            presetId
          )
        : cardScale;

      if (applyRecommendedStyle) {
        setCardScale(nextScale);
      }

      const sampleDim = getNodeSize(
        { id: 's', name: 'Nama Anggota', sub: '', x: 0, y: 0, photo: '', wafat: false },
        nextCardMode,
        nextPhotoSize,
        nextScale
      );

      const result = generateSmartLayoutFromTable(
        activeTrah.members,
        presetId,
        targetW,
        targetH,
        sampleDim,
        {
          displayMode: nextCardMode,
          photoSize: nextPhotoSize,
          cardScale: nextScale,
        }
      );

      const nextGuideMode: GuideOverlayMode =
        preset.recommendedGuideMode || 'gen_bands';
      setGuideOverlayMode(nextGuideMode);
      if (
        presetId === 'hierarchy_grid_fill' ||
        nextGuideMode === 'grid_9_rows' ||
        nextGuideMode === 'orbit_rings'
      ) {
        setShowGenGuides(true);
      }

      const refreshedText = buildQuickTextFromTrah(activeTrah.members);
      setNodes(result.nodes);
      setEdges(result.edges);
      setQuickText(refreshedText);
      setSelectedIds([]);
      setLayoutMode('manual');
      persistCurrentDesign(result.nodes, result.edges, refreshedText, nextScale);

      showNotification(
        `Tata letak "${preset.title}" ditata pas di ${targetPaperObj.label} (Skala Foto ${Math.round(
          nextScale * 100
        )}%)!`
      );
    },
    [
      activeTrah.members,
      lockSelectedPaper,
      applyRecommendedStyle,
      paperSize,
      paperOrientation,
      cardDisplayMode,
      photoFrameSize,
      cardScale,
      smartAnalysis.recommendedPaper,
      persistCurrentDesign,
      pushUndoSnapshot,
      showNotification,
    ]
  );

  // Tombol cepat: sesuaikan skala kartu & foto otomatis agar kertas aktif terisi seimbang
  const handleAutoFitCardScale = useCallback(() => {
    pushUndoSnapshot('Pas-kan Skala Kertas');
    const optimal = computeOptimalCardScale(
      activeTrah.members,
      boardWidth,
      boardHeight,
      cardDisplayMode,
      photoFrameSize
    );
    setCardScale(optimal);
    if (activeTrah.members.length > 0) {
      const sampleDim = getNodeSize(
        { id: 's', name: 'Nama Anggota', sub: '', x: 0, y: 0, photo: '', wafat: false },
        cardDisplayMode,
        photoFrameSize,
        optimal
      );
      const rebuilt = generateSmartLayoutFromTable(
        activeTrah.members,
        'hierarchy_grid_fill',
        boardWidth,
        boardHeight,
        sampleDim
      );
      setNodes(rebuilt.nodes);
      setEdges(rebuilt.edges);
      persistCurrentDesign(rebuilt.nodes, rebuilt.edges);
    }
    showNotification(
      `Skala kartu & foto disesuaikan ke ${Math.round(optimal * 100)}% agar pas isi ${paperDim.label}!`
    );
  }, [
    activeTrah.members,
    boardWidth,
    boardHeight,
    cardDisplayMode,
    photoFrameSize,
    paperDim.label,
    persistCurrentDesign,
    pushUndoSnapshot,
    showNotification,
  ]);

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
    const gm = getMergedGridMetrics(
      mergedNode.mergedMembers.length,
      cardDisplayMode,
      photoFrameSize,
      cardScale,
      mergedNode.mergedCols
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
  // INTERAKSI DRAG KARTU / HOLD 2 DETIK (PANAH ▲▼◀▶) / GESER DOT GARIS
  // =========================================================================
  const cancelHoldTimer = useCallback(() => {
    if (holdTimerRef.current.intervalId !== null) {
      window.clearInterval(holdTimerRef.current.intervalId);
      holdTimerRef.current.intervalId = null;
    }
    holdTimerRef.current.active = false;
    setHoldingState(null);
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
    if (!boardRef.current) return;

    const ed = edges[edgeIdx];
    if (!ed) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = boardRef.current.getBoundingClientRect();
    const startPointerX = (clientX - rect.left) / zoom;
    const startPointerY = (clientY - rect.top) / zoom;

    setActiveEdgeIdx(edgeIdx);
    edgeDragRef.current = {
      active: true,
      edgeIdx,
      startPointerX,
      startPointerY,
      initOffsetX: ed.offsetX ?? 0,
      initOffsetY: ed.offsetY ?? 0,
      preDragEdges: edges.map((item) => ({ ...item })),
    };
  };

  const resetEdgeOffset = (edgeIdx: number) => {
    pushUndoSnapshot('Reset Jalur Garis');
    const nextEdges = edges.map((ed, i) =>
      i === edgeIdx ? { ...ed, offsetX: undefined, offsetY: undefined } : ed
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
    }));
    setEdges(nextEdges);
    setActiveEdgeIdx(null);
    persistCurrentDesign(nodes, nextEdges);
    showNotification('Semua jalur garis direset ke Auto!');
  };

  const startNodeInteraction = (
    e: React.MouseEvent | React.TouchEvent,
    id: string
  ) => {
    if ('touches' in e) {
      lastTouchTimeRef.current = Date.now();
      if (e.touches.length >= 2) {
        dragStateRef.current.active = false;
        cancelHoldTimer();
        return;
      }
    } else if (Date.now() - lastTouchTimeRef.current < 500) {
      // Abaikan mousedown sintetis setelah touchstart pada layar sentuh
      return;
    }

    if (isPanMode) {
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
      ('shiftKey' in e && e.shiftKey) || ('ctrlKey' in e && e.ctrlKey) || ('metaKey' in e && e.metaKey);

    // 2. Mode Checklist Pilih Banyak: langsung pilih/batal pilih tanpa menekan lama (tanpa hold 2 detik)!
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

    if (layoutMode !== 'manual' || !boardRef.current) return;

    // Tentukan semua kartu yang ikut tergeser (kartu terpilih + semua anggota group terkait)
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
    const rect = boardRef.current.getBoundingClientRect();
    const startX = (clientX - rect.left) / zoom;
    const startY = (clientY - rect.top) / zoom;

    const initialPositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      if (movingSet.has(n.id)) {
        initialPositions[n.id] = { x: n.x, y: n.y };
      }
    });

    const alreadyUnlocked = moveUnlockedIds.includes(id);

    // Jika Kunci Aman nonaktif ATAU kartu sudah di-unlock (hold 2 detik), langsung bisa geser
    if (!safeHoldMove || alreadyUnlocked) {
      if (alreadyUnlocked) {
        setMoveAnchorId(id);
      }
      dragStateRef.current = {
        active: true,
        movingIds: movingArr,
        startPointerX: startX,
        startPointerY: startY,
        initialPositions,
        preDragNodes: cloneNodesForHistory(nodes),
      };
      return;
    }

    // Kunci Aman Aktif: tahan ~2 detik untuk membuka panah interaktif ▲▼◀▶ & geser bebas!
    if (!moveUnlockedIds.includes(id)) {
      setMoveUnlockedIds([]);
      setMoveAnchorId(null);
    }
    cancelHoldTimer();
    const holdStartTime = Date.now();
    const HOLD_DURATION_MS = 2000;

    setHoldingState({ nodeId: id, progress: 5 });
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - holdStartTime;
      const pct = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));
      if (elapsed >= HOLD_DURATION_MS) {
        window.clearInterval(intervalId);
        holdTimerRef.current.intervalId = null;
        holdTimerRef.current.active = false;
        setHoldingState(null);
        setMoveUnlockedIds(movingArr);
        setMoveAnchorId(id);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(35);
        }
        // Aktifkan drag langsung sambil jari/mouse masih menahan, atau gunakan panah ▲▼◀▶
        dragStateRef.current = {
          active: true,
          movingIds: movingArr,
          startPointerX: startX,
          startPointerY: startY,
          initialPositions,
          preDragNodes: cloneNodesForHistory(latestUndoStateRef.current.nodes),
        };
        showNotification(
          'Kartu terbuka! Gunakan panah ▲▼◀▶ atau seret kartu untuk memindahkan.'
        );
      } else {
        setHoldingState({ nodeId: id, progress: pct });
      }
    }, 50);

    holdTimerRef.current = {
      active: true,
      nodeId: id,
      startClientX: clientX,
      startClientY: clientY,
      intervalId,
    };
  };

  // Pinch-to-Zoom 2 Jari & Pan Kanvas pada Viewport
  const handleViewportTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const vp = viewportRef.current;
    if (!vp) return;

    if (e.touches.length === 2) {
      dragStateRef.current.active = false;
      edgeDragRef.current.active = false;
      marqueeRef.current.active = false;
      panDragRef.current.active = false;
      cancelHoldTimer();

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const vpRect = vp.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2 - vpRect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - vpRect.top;

      pinchRef.current = {
        active: true,
        startDist: Math.max(10, dist),
        startZoom: zoom,
        midX,
        midY,
        startScrollLeft: vp.scrollLeft,
        startScrollTop: vp.scrollTop,
      };
    } else if (e.touches.length === 1 && isPanMode) {
      const t = e.touches[0];
      panDragRef.current = {
        active: true,
        startClientX: t.clientX,
        startClientY: t.clientY,
        startScrollLeft: vp.scrollLeft,
        startScrollTop: vp.scrollTop,
      };
    }
  };

  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((z) => Math.max(0.15, Math.min(2.5, +(z + delta).toFixed(2))));
    }
  };

  // Mulai seret kotak seleksi (Marquee) atau Pan di area kanvas kosong
  const handleBoardMouseDown = (e: React.MouseEvent) => {
    if (!boardRef.current || !viewportRef.current) return;

    setMoveUnlockedIds([]);
    setMoveAnchorId(null);
    setActiveEdgeIdx(null);

    if (isPanMode || e.button === 1) {
      e.preventDefault();
      panDragRef.current = {
        active: true,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startScrollLeft: viewportRef.current.scrollLeft,
        startScrollTop: viewportRef.current.scrollTop,
      };
      return;
    }

    if (e.button !== 0) return;

    const rect = boardRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / zoom;
    const startY = (e.clientY - rect.top) / zoom;

    marqueeRef.current = { active: true, startX, startY };
    setMarqueeBox({ x: startX, y: startY, w: 0, h: 0 });
    if (!e.shiftKey && !isMultiSelectMode) {
      setSelectedIds([]);
    }
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const vp = viewportRef.current;

      // 0A. Pinch-to-Zoom 2 Jari (prioritas tertinggi!)
      if ('touches' in e && e.touches.length === 2 && vp) {
        if (e.cancelable) e.preventDefault();
        dragStateRef.current.active = false;
        edgeDragRef.current.active = false;
        marqueeRef.current.active = false;
        cancelHoldTimer();

        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        if (!pinchRef.current.active) {
          const vpRect = vp.getBoundingClientRect();
          pinchRef.current = {
            active: true,
            startDist: Math.max(10, currDist),
            startZoom: zoom,
            midX: (t1.clientX + t2.clientX) / 2 - vpRect.left,
            midY: (t1.clientY + t2.clientY) / 2 - vpRect.top,
            startScrollLeft: vp.scrollLeft,
            startScrollTop: vp.scrollTop,
          };
          return;
        }

        const {
          startDist,
          startZoom,
          midX,
          midY,
          startScrollLeft,
          startScrollTop,
        } = pinchRef.current;
        const scaleRatio = currDist / startDist;
        const nextZoom = Math.max(0.15, Math.min(2.5, +(startZoom * scaleRatio).toFixed(3)));
        const zoomFactor = nextZoom / startZoom;

        setZoom(nextZoom);
        vp.scrollLeft = (startScrollLeft + midX) * zoomFactor - midX;
        vp.scrollTop = (startScrollTop + midY) * zoomFactor - midY;
        return;
      }

      // 0B. Geser Kanvas (Pan Hand Mode)
      if (panDragRef.current.active && vp) {
        if (e.cancelable) e.preventDefault();
        const clientX =
          'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY =
          'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const dx = clientX - panDragRef.current.startClientX;
        const dy = clientY - panDragRef.current.startClientY;
        vp.scrollLeft = panDragRef.current.startScrollLeft - dx;
        vp.scrollTop = panDragRef.current.startScrollTop - dy;
        return;
      }

      // Batalkan timer hold 2 detik jika pengguna menggeser jari > 12px (berniat scroll/batal)
      if (holdTimerRef.current.active) {
        const cx = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const cy = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        if (
          Math.hypot(
            cx - holdTimerRef.current.startClientX,
            cy - holdTimerRef.current.startClientY
          ) > 12
        ) {
          cancelHoldTimer();
        }
      }

      if (!boardRef.current) return;

      const clientX =
        'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY =
        'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const rect = boardRef.current.getBoundingClientRect();
      const currX = (clientX - rect.left) / zoom;
      const currY = (clientY - rect.top) / zoom;

      // 1A. Geser Titik Dot Jalur Garis (Atas/Bawah/Kiri/Kanan)
      if (edgeDragRef.current.active) {
        if (e.cancelable) e.preventDefault();
        const { edgeIdx, startPointerX, startPointerY, initOffsetX, initOffsetY } =
          edgeDragRef.current;
        const nextOx = Math.round(initOffsetX + (currX - startPointerX));
        const nextOy = Math.round(initOffsetY + (currY - startPointerY));
        setEdges((prev) =>
          prev.map((ed, idx) =>
            idx === edgeIdx ? { ...ed, offsetX: nextOx, offsetY: nextOy } : ed
          )
        );
        return;
      }

      // 1B. Dragging Kartu / Group
      if (dragStateRef.current.active) {
        if (e.cancelable) e.preventDefault();
        const {
          movingIds,
          startPointerX,
          startPointerY,
          initialPositions,
        } = dragStateRef.current;

        const dx = currX - startPointerX;
        const dy = currY - startPointerY;
        const movingSet = new Set(movingIds);

        setNodes((prev) =>
          prev.map((n) => {
            if (!movingSet.has(n.id)) return n;
            const orig = initialPositions[n.id];
            if (!orig) return n;

            let nx = orig.x + dx;
            let ny = orig.y + dy;

            if (snapToGrid) {
              nx = Math.round(nx / SNAP_SIZE) * SNAP_SIZE;
              ny = Math.round(ny / SNAP_SIZE) * SNAP_SIZE;
            }

            const size = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
            return {
              ...n,
              x: Math.max(0, Math.min(boardWidth - size.w, nx)),
              y: Math.max(0, Math.min(boardHeight - size.h, ny)),
            };
          })
        );
        return;
      }

      // 2. Marquee Selection Rectangle
      if (marqueeRef.current.active) {
        const { startX, startY } = marqueeRef.current;
        const rx = Math.min(startX, currX);
        const ry = Math.min(startY, currY);
        const rw = Math.abs(currX - startX);
        const rh = Math.abs(currY - startY);
        setMarqueeBox({ x: rx, y: ry, w: rw, h: rh });
      }
    };

    const handleEnd = (e?: MouseEvent | TouchEvent) => {
      if (e && 'touches' in e && e.touches.length < 2) {
        pinchRef.current.active = false;
      } else if (!e || !('touches' in e)) {
        pinchRef.current.active = false;
      }

      panDragRef.current.active = false;
      stopNudgeRepeat();

      if (holdTimerRef.current.active) {
        cancelHoldTimer();
      }

      if (edgeDragRef.current.active) {
        edgeDragRef.current.active = false;
        const { edgeIdx, initOffsetX, initOffsetY, preDragEdges } = edgeDragRef.current;
        setEdges((currentEdges) => {
          const movedEdge = currentEdges[edgeIdx];
          if (
            movedEdge &&
            preDragEdges &&
            ((movedEdge.offsetX ?? 0) !== initOffsetX ||
              (movedEdge.offsetY ?? 0) !== initOffsetY)
          ) {
            pushUndoSnapshot('Geser Jalur Garis', undefined, preDragEdges);
          }
          persistCurrentDesign(nodes, currentEdges);
          return currentEdges;
        });
      }

      if (dragStateRef.current.active) {
        dragStateRef.current.active = false;
        const { initialPositions, preDragNodes } = dragStateRef.current;
        setNodes((currentNodes) => {
          const movedAny = currentNodes.some((n) => {
            const initPos = initialPositions[n.id];
            return initPos && (initPos.x !== n.x || initPos.y !== n.y);
          });
          if (movedAny && preDragNodes) {
            pushUndoSnapshot('Geser Kartu', preDragNodes);
          }
          persistCurrentDesign(currentNodes, edges);
          return currentNodes;
        });
      }

      if (marqueeRef.current.active) {
        marqueeRef.current.active = false;
        setMarqueeBox((box) => {
          if (box && (box.w > 12 || box.h > 12)) {
            const insideIds = nodes
              .filter((n) => {
                const s = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
                const overlapX = n.x < box.x + box.w && n.x + s.w > box.x;
                const overlapY = n.y < box.y + box.h && n.y + s.h > box.y;
                return overlapX && overlapY;
              })
              .map((n) => n.id);

            if (insideIds.length > 0) {
              setSelectedIds((prev) =>
                isMultiSelectMode
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
    };
  }, [
    zoom,
    snapToGrid,
    boardWidth,
    boardHeight,
    cardDisplayMode,
    photoFrameSize,
    cardScale,
    edges,
    nodes,
    isMultiSelectMode,
    cancelHoldTimer,
    stopNudgeRepeat,
    persistCurrentDesign,
    pushUndoSnapshot,
  ]);

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
    const nextNodes = nodes.map((n) => {
      if (!selSet.has(n.id)) return n;
      if (n.memberId) syncedMemberIds.push(n.memberId);
      return { ...n, ...patch };
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
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !primarySelectedNode) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 220;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxSize) {
            h *= maxSize / w;
            w = maxSize;
          }
        } else {
          if (h > maxSize) {
            w *= maxSize / h;
            h = maxSize;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          updateSelectedField({ photo: compressedDataUrl });
          showNotification('Foto dikompres ringan & dipasang!');
        }
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
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

  return (
    <div
      className={
        isFocusMode
          ? `fixed inset-0 z-50 flex flex-col overflow-hidden ${
              isDark
                ? 'bg-[#0b1120] text-slate-100'
                : 'bg-[#e2e8f0] text-slate-900'
            }`
          : `flex-1 flex flex-col overflow-hidden rounded-2xl border shadow-lg ${
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
        className={`px-3 py-1.5 border-b flex flex-wrap items-center justify-between gap-1.5 shrink-0 z-20 ${
          isDark
            ? 'bg-[#1e293b] border-slate-700'
            : 'bg-white border-stone-200'
        }`}
      >
        {/* Kiri: Auto (Smart) / Manual, Pilih Banyak, Tambah Kartu, Sambung Garis */}
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
              onClick={() => {
                setLayoutMode('auto');
                if (activeTrah.members.length > 0) {
                  pushUndoSnapshot('Tata Letak Auto');
                  const optScale = computeOptimalCardScale(
                    activeTrah.members,
                    boardWidth,
                    boardHeight,
                    cardDisplayMode,
                    photoFrameSize
                  );
                  setCardScale(optScale);
                  const sampleDim = getNodeSize(
                    { id: 's', name: 'Nama Anggota', sub: '', x: 0, y: 0, photo: '', wafat: false },
                    cardDisplayMode,
                    photoFrameSize,
                    optScale
                  );
                  const chosenPreset =
                    lockSelectedPaper && activeTrah.members.length > 16
                      ? 'hierarchy_grid_fill'
                      : smartAnalysis.topPresetId;
                  const rebuilt = generateSmartLayoutFromTable(
                    activeTrah.members,
                    chosenPreset,
                    boardWidth,
                    boardHeight,
                    sampleDim
                  );
                  setNodes(rebuilt.nodes);
                  setEdges(rebuilt.edges);
                  persistCurrentDesign(rebuilt.nodes, rebuilt.edges);
                  showNotification(
                    `Tata letak otomatis dirapikan pas di ${paperDim.label} (Foto ${Math.round(
                      optScale * 100
                    )}%)!`
                  );
                } else {
                  generateFromQuickText();
                }
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition ${
                layoutMode === 'auto'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Tata ulang otomatis rapi dari data Tabel"
            >
              <Wand2 className="w-3 h-3" />
              <span>Auto</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode('manual');
                showNotification('Mode Manual: Geser bebas, Gabung Card & Group!');
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition ${
                layoutMode === 'manual'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : isDark
                  ? 'text-slate-300 hover:text-white'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Mode Manual: Geser kartu & rapikan sesuka hati"
            >
              <Move className="w-3 h-3" />
              <span>Manual</span>
            </button>
          </div>

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
        </div>

        {/* Kanan: Kertas A0-A4, Laci Atur & Desain, Mode Leluasa, Cetak */}
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
              onChange={(e) => setPaperSize(e.target.value as GridPaperSize)}
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
              onClick={() => {
                setAutoScreenOrient(false);
                setPaperOrientation((o) =>
                  o === 'landscape' ? 'portrait' : 'landscape'
                );
              }}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isDark
                  ? 'bg-slate-800 text-emerald-300 hover:bg-slate-700'
                  : 'bg-white text-emerald-800 border border-stone-200'
              }`}
              title="Ubah Orientasi Lanskap / Potret"
            >
              {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsPanelOpen((v) => !v)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center gap-1 transition shadow-xs ${
              isPanelOpen
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/50 text-white'
            }`}
            title="Buka panel Smart Tata Letak, Gaya Kartu/Garis PCB, Edit & Simpan Desain"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Atur &amp; Desain ({savedDesigns.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFocusMode(true)}
            className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-emerald-300 hover:border-emerald-400'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
            title="Mode Leluasa (Kanvas Layar Penuh dengan Tombol Melayang)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leluasa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const rule = MonetizationService.getRule('leluhurqu_export');
              if (rule.enabled && !MonetizationService.hasActiveUnlock('leluhurqu_export')) {
                setShowPrintFeeModal(true);
                return;
              }
              window.print();
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1"
            title={`Cetak ke ukuran ${paperDim.label}`}
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
      <div className="flex-1 flex overflow-hidden relative">
        {isPanelOpen && (
          <aside
            className={`${
              isFocusMode
                ? 'absolute left-2 top-14 bottom-16 rounded-2xl border shadow-2xl z-40 w-[290px] sm:w-[320px]'
                : 'absolute sm:relative left-0 top-0 bottom-0 w-[290px] sm:w-[320px] shrink-0 border-r z-30 shadow-xl sm:shadow-none'
            } p-3.5 flex flex-col gap-3 overflow-y-auto ${
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
                        <option value="full">Lengkap</option>
                        <option value="name_only">Nama Saja</option>
                        <option value="photo_only">Foto Saja</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] opacity-75 block mb-0.5">Ukuran Foto:</label>
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
                        <option value="bulat">Bulat</option>
                        <option value="2x3">Pas Foto 2×3</option>
                        <option value="3x4">Pas Foto 3×4</option>
                        <option value="4x6">Pas Foto 4×6</option>
                      </select>
                    </div>
                  </div>

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
                    <p className="text-[9.5px] opacity-75">
                      Geser ke kanan untuk perbesar foto jika kertas terasa kosong, atau ke kiri jika kartu menumpuk.
                    </p>
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
                    <label className="flex items-center gap-2 cursor-pointer text-[10.5px]">
                      <input
                        type="checkbox"
                        checked={autoScreenOrient}
                        onChange={(e) => setAutoScreenOrient(e.target.checked)}
                        className="accent-sky-500"
                      />
                      <Smartphone className="w-3 h-3 text-sky-400" />
                      <span>Auto Potret/Lanskap ikuti layar</span>
                    </label>
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
                      ] as const
                    ).map((opt) => {
                      const active = lineStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setLineStyle(opt.id)}
                          className={`p-2 rounded-xl border text-left flex items-center gap-2 transition ${
                            active
                              ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-xs'
                              : isDark
                              ? 'bg-slate-900/70 border-slate-700 hover:border-sky-400'
                              : 'bg-stone-50 border-stone-200 hover:border-sky-500'
                          }`}
                        >
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
                          <span className="text-[10.5px] font-bold leading-tight">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Ketebalan Garis */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] opacity-75">Tebal Garis:</span>
                    {[1.8, 2.5, 3.5].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setLineThickness(w)}
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                          lineThickness === w
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'border-slate-600 opacity-75'
                        }`}
                      >
                        {w === 1.8 ? 'Tipis' : w === 2.5 ? 'Standar' : 'Tebal'}
                      </button>
                    ))}
                  </div>

                  {/* Anti-Tertutup Kartu & Titik Dot Geser Garis */}
                  <div className="p-2 rounded-xl border border-sky-500/30 bg-sky-500/10 space-y-1.5">
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
                        onChange={(e) => setShowLineDots(e.target.checked)}
                        className="accent-amber-400"
                      />
                      <span>
                        Tampilkan titik (dot) geser jalur garis 4 arah
                      </span>
                    </label>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[9.5px] opacity-75">
                        Seret dot di garis ke atas/bawah/kiri/kanan • Klik 2× reset
                      </span>
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
                        placeholder="LeluhurQu"
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
                      <span>Terapkan Rekomendasi #1</span>
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

                {/* Filter Kategori Pilihan Tata Letak Smart */}
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-black/25 border border-slate-700/60">
                    {[
                      { id: 'all' as const, label: `Semua (${SMART_LAYOUT_PRESETS.length})` },
                      { id: 'kotak9' as const, label: 'Kotak 9 Baris' },
                      { id: 'orbit' as const, label: 'Orbit 1–5' },
                      { id: 'klasik' as const, label: 'Klasik' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSmartCategoryFilter(tab.id)}
                        className={`py-1 px-1.5 rounded-lg text-[9.5px] font-extrabold whitespace-nowrap transition ${
                          smartCategoryFilter === tab.id
                            ? 'bg-emerald-500 text-slate-950 shadow-xs'
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

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
                          onClick={() => handleApplySmartPreset(preset.id)}
                          className={`w-full text-left p-2 rounded-xl border transition flex items-center gap-2.5 group ${
                            isTop
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
                              preset.category === 'orbit'
                                ? 'bg-sky-500/15 border-sky-400/40 text-sky-400'
                                : preset.category === 'kotak9'
                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-400'
                                : 'bg-amber-500/15 border-amber-400/40 text-amber-400'
                            }`}
                          >
                            <PresetIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-[11px] leading-tight truncate">
                                {preset.title}
                              </span>
                              <span
                                className={`text-[8.5px] px-1.5 py-0.5 rounded font-black shrink-0 ${
                                  isTop
                                    ? 'bg-amber-400 text-slate-950'
                                    : preset.category === 'orbit'
                                    ? 'bg-sky-500/20 text-sky-300'
                                    : preset.category === 'kotak9'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-slate-700/60 text-slate-300'
                                }`}
                              >
                                {isTop ? '★' : preset.badge}
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
                        Anggota Tergabung:
                      </span>
                      <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                        {primarySelectedNode.mergedMembers.map((mm, mIdx) => (
                          <div
                            key={`${mm.originalNodeId}_${mIdx}`}
                            className="flex items-center gap-2 px-2 py-1 rounded-lg bg-black/20 border border-slate-700/50 text-[10.5px]"
                          >
                            <span className="font-mono text-amber-400 font-bold">
                              {mIdx + 1}.
                            </span>
                            <span className="truncate font-semibold">{mm.name}</span>
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

        {/* Viewport Kanvas Kertas A0 - A4 + Kontrol Melayang Adaptif */}
        <div
          ref={viewportRef}
          onTouchStart={handleViewportTouchStart}
          onWheel={handleViewportWheel}
          style={{ touchAction: isPanMode ? 'none' : 'pan-x pan-y' }}
          className={`flex-1 overflow-auto flex relative ${
            isFocusMode ? 'p-3 sm:p-5' : 'p-4 sm:p-6'
          } ${isPanMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          <div
            className="m-auto shrink-0"
            style={{
              width: `${boardWidth * zoom}px`,
              height: `${boardHeight * zoom}px`,
            }}
          >
            <div
              ref={boardRef}
              onMouseDown={handleBoardMouseDown}
              style={{
                width: `${boardWidth}px`,
                height: `${boardHeight}px`,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                ...getBoardBackgroundStyle(),
              }}
              className={`relative rounded-xl border-2 shadow-2xl overflow-hidden print:shadow-none print:border-none ${
                isDark ? 'border-slate-700' : 'border-stone-300'
              }`}
            >
              {/* Watermark Info Kertas & Desain Aktif (Khusus Layar) */}
              <div className="absolute top-3 left-4 z-10 flex items-center gap-2 pointer-events-none opacity-85 print:hidden">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/50 text-amber-300 border border-amber-400/30 backdrop-blur-xs">
                  {paperDim.label} {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'} ({paperDim.wMm}×{paperDim.hMm}mm)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/40 text-white/85">
                  {designNameInput || activeTrah.name} • {nodes.length} Kartu
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
                    const rings = [
                      { num: 1, factor: 0.22, label: 'ORBIT 1 · G1–G2', accent: '#f59e0b' },
                      { num: 2, factor: 0.44, label: 'ORBIT 2 · G3', accent: '#38bdf8' },
                      { num: 3, factor: 0.63, label: 'ORBIT 3 · G4', accent: '#34d399' },
                      { num: 4, factor: 0.81, label: 'ORBIT 4 · G4', accent: '#a78bfa' },
                      { num: 5, factor: 0.98, label: 'ORBIT 5 · G5+', accent: '#fb7185' },
                    ];
                    return rings.map((rg) => {
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
                    });
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

              {/* SVG Garis Konektor Real-Time (Auto-Hindar Kartu + Jalur 4-Arah + Layer Anti-Tertutup) */}
              {(() => {
                const obstacleBoxes: NodeObstacleBox[] = nodes.map((n) => {
                  const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
                  return { id: n.id, x: n.x, y: n.y, w: sz.w, h: sz.h };
                });

                const computedEdges = edges
                  .map((edge, idx) => {
                    const n1 = nodeMap.get(edge.from);
                    const n2 = nodeMap.get(edge.to);
                    if (!n1 || !n2) return null;

                    const pts = getSmartPorts(
                      n1,
                      n2,
                      edge.type,
                      cardDisplayMode,
                      photoFrameSize,
                      cardScale
                    );
                    const route = buildConnectorRoute(
                      pts,
                      lineStyle,
                      edge,
                      obstacleBoxes
                    );
                    const resolvedChildColor =
                      childLineColor ||
                      (isDark || bgStyle !== '' ? '#38bdf8' : '#0284c7');
                    const resolvedCoupleColor = coupleLineColor || '#f59e0b';
                    const lineColor =
                      edge.type === 'couple'
                        ? resolvedCoupleColor
                        : resolvedChildColor;

                    return { idx, edge, pts, route, lineColor };
                  })
                  .filter(Boolean) as Array<{
                  idx: number;
                  edge: InteractiveEdge;
                  pts: ReturnType<typeof getSmartPorts>;
                  route: ReturnType<typeof buildConnectorRoute>;
                  lineColor: string;
                }>;

                const isPcbStyle = lineStyle === 'pcb90' || lineStyle === 'pcb45';

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
                      {computedEdges.map(({ idx, edge, pts, route, lineColor }) => {
                        const isActiveEdge = activeEdgeIdx === idx;
                        return (
                          <g key={`edge-${idx}`}>
                            {/* Halo lembut saat garis tampil di atas kartu agar tetap terbaca bersih */}
                            {linesOnTop && (
                              <path
                                d={route.d}
                                stroke={isDark ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.8)'}
                                strokeWidth={lineThickness + 3}
                                strokeLinecap="round"
                                strokeLinejoin={lineStyle === 'pcb90' ? 'miter' : 'round'}
                                fill="none"
                              />
                            )}
                            <path
                              d={route.d}
                              stroke={isActiveEdge ? '#f59e0b' : lineColor}
                              strokeWidth={isActiveEdge ? lineThickness + 1 : lineThickness}
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
                            {isPcbStyle ? (
                              <>
                                <circle
                                  cx={pts.a.x}
                                  cy={pts.a.y}
                                  r={4.5}
                                  fill={isDark ? '#0f172a' : '#ffffff'}
                                  stroke={lineColor}
                                  strokeWidth={1.8}
                                />
                                <circle
                                  cx={pts.a.x}
                                  cy={pts.a.y}
                                  r={1.7}
                                  fill={lineColor}
                                />
                                <circle
                                  cx={pts.b.x}
                                  cy={pts.b.y}
                                  r={4.5}
                                  fill={isDark ? '#0f172a' : '#ffffff'}
                                  stroke={lineColor}
                                  strokeWidth={1.8}
                                />
                                <circle
                                  cx={pts.b.x}
                                  cy={pts.b.y}
                                  r={1.7}
                                  fill={lineColor}
                                />
                              </>
                            ) : (
                              <>
                                <circle cx={pts.a.x} cy={pts.a.y} r={3.5} fill={lineColor} />
                                <circle cx={pts.b.x} cy={pts.b.y} r={3.5} fill={lineColor} />
                              </>
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    {/* Layer Dot Handle Interaktif (Selalu mudah digeser Atas/Bawah/Kiri/Kanan walau melintasi kartu) */}
                    {(showLineDots || activeEdgeIdx !== null) && (
                      <svg
                        width={boardWidth}
                        height={boardHeight}
                        className="absolute inset-0 pointer-events-none z-[28] print:hidden"
                      >
                        {computedEdges.map(({ idx, edge, route, lineColor }) => {
                          const isVisible =
                            showLineDots ||
                            activeEdgeIdx === idx ||
                            route.isCustomOffset;
                          if (!isVisible) return null;
                          if (edge.type === 'couple' && !route.isCustomOffset && activeEdgeIdx !== idx) {
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
                                Seret titik ke Atas / Bawah / Kiri / Kanan untuk belokkan garis • Klik 2× untuk reset Auto
                              </title>
                              {/* Area sentuh luas tak terlihat */}
                              <circle cx={hx} cy={hy} r={13} fill="transparent" />
                              {/* Titik Dot Utama */}
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
                                fill={isActive || route.isCustomOffset ? '#0f172a' : lineColor}
                              />
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </>
                );
              })()}

              {/* Kartu Anggota Keluarga */}
              {nodes.map((node) => {
                const isSelected = selectedIds.includes(node.id);
                const isConnectSource = connectFromId === node.id;
                const isHolding = holdingState?.nodeId === node.id;
                const isUnlocked = moveUnlockedIds.includes(node.id);
                const showArrowsHere =
                  isUnlocked &&
                  (moveAnchorId === node.id ||
                    (!moveAnchorId && moveUnlockedIds[0] === node.id));
                const moveTargets =
                  moveUnlockedIds.length > 0 ? moveUnlockedIds : [node.id];
                const nudgeStep = snapToGrid ? SNAP_SIZE : 10;

                const size = getNodeSize(node, cardDisplayMode, photoFrameSize, cardScale);
                const pDim = getScaledPhotoDim(photoFrameSize, cardScale);
                const scaledNamePx = Math.max(8, Math.round(12.5 * cardScale));
                const scaledSubPx = Math.max(7, Math.round(10 * cardScale));

                const effectiveBg = node.customBgColor || cardBgColor;
                const effectiveBorder = node.customBorderColor || cardBorderColor;
                const isCardLight = effectiveBg
                  ? isLightHexColor(effectiveBg)
                  : !isDark;

                const cardCustomStyle: React.CSSProperties = {
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${size.w}px`,
                  minHeight: `${size.h}px`,
                  ...(effectiveBg ? { backgroundColor: effectiveBg } : {}),
                  ...(effectiveBorder && !isSelected && !isConnectSource && !isUnlocked
                    ? { borderColor: effectiveBorder }
                    : {}),
                };

                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => startNodeInteraction(e, node.id)}
                    onTouchStart={(e) => startNodeInteraction(e, node.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={cardCustomStyle}
                    className={`group absolute rounded-xl border-2 flex flex-col items-center justify-center text-center shadow-lg transition-shadow select-none ${
                      cardDisplayMode === 'photo_only'
                        ? 'p-1'
                        : cardDisplayMode === 'name_only'
                        ? 'px-2 py-1'
                        : 'p-1.5'
                    } ${
                      layoutMode === 'manual'
                        ? isUnlocked || !safeHoldMove
                          ? 'cursor-grab active:cursor-grabbing'
                          : 'cursor-pointer'
                        : 'cursor-pointer'
                    } ${
                      isUnlocked
                        ? 'z-50 border-emerald-400 ring-4 ring-emerald-400/40'
                        : isSelected
                        ? 'z-40 border-amber-500 ring-3 ring-amber-500/35'
                        : isConnectSource
                        ? 'z-40 border-sky-400 ring-3 ring-sky-400/40'
                        : !effectiveBg
                        ? isDark
                          ? 'z-10 bg-[#1e293b] border-slate-600 hover:border-amber-400'
                          : 'z-10 bg-white border-stone-300 hover:border-amber-500'
                        : 'z-10 hover:brightness-105'
                    } ${
                      isCardLight ? 'text-slate-900' : 'text-slate-100'
                    } ${node.wafat ? 'border-dashed opacity-90' : ''}`}
                    title={
                      safeHoldMove && layoutMode === 'manual' && !isUnlocked
                        ? `${node.name} • Tahan 2 detik untuk tampilkan panah geser ▲▼◀▶`
                        : node.name
                    }
                  >
                    {/* Indikator Progress Hold 2 Detik */}
                    {isHolding && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 px-2 py-0.5 rounded-full bg-slate-950/95 border border-emerald-400 text-[9px] font-black text-emerald-300 whitespace-nowrap shadow-lg flex items-center gap-1.5 pointer-events-none">
                        <span className="inline-block w-10 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                          <span
                            className="block h-full bg-emerald-400 transition-all duration-75"
                            style={{ width: `${holdingState.progress}%` }}
                          />
                        </span>
                        <span>Tahan...</span>
                      </div>
                    )}

                    {/* 4 Panah Interaktif Atas / Bawah / Kiri / Kanan setelah Hold 2 Detik */}
                    {showArrowsHere && (
                      <>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            startNudgeRepeat(moveTargets, 0, -nudgeStep);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            startNudgeRepeat(moveTargets, 0, -nudgeStep);
                          }}
                          onMouseUp={stopNudgeRepeat}
                          onMouseLeave={stopNudgeRepeat}
                          onTouchEnd={stopNudgeRepeat}
                          onTouchCancel={stopNudgeRepeat}
                          className="absolute -top-8 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg border-2 border-white flex items-center justify-center z-50 print:hidden"
                          title="Geser ke Atas"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            startNudgeRepeat(moveTargets, 0, nudgeStep);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            startNudgeRepeat(moveTargets, 0, nudgeStep);
                          }}
                          onMouseUp={stopNudgeRepeat}
                          onMouseLeave={stopNudgeRepeat}
                          onTouchEnd={stopNudgeRepeat}
                          onTouchCancel={stopNudgeRepeat}
                          className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg border-2 border-white flex items-center justify-center z-50 print:hidden"
                          title="Geser ke Bawah"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            startNudgeRepeat(moveTargets, -nudgeStep, 0);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            startNudgeRepeat(moveTargets, -nudgeStep, 0);
                          }}
                          onMouseUp={stopNudgeRepeat}
                          onMouseLeave={stopNudgeRepeat}
                          onTouchEnd={stopNudgeRepeat}
                          onTouchCancel={stopNudgeRepeat}
                          className="absolute top-1/2 -translate-y-1/2 -left-8 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg border-2 border-white flex items-center justify-center z-50 print:hidden"
                          title="Geser ke Kiri"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            startNudgeRepeat(moveTargets, nudgeStep, 0);
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            startNudgeRepeat(moveTargets, nudgeStep, 0);
                          }}
                          onMouseUp={stopNudgeRepeat}
                          onMouseLeave={stopNudgeRepeat}
                          onTouchEnd={stopNudgeRepeat}
                          onTouchCancel={stopNudgeRepeat}
                          className="absolute top-1/2 -translate-y-1/2 -right-8 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg border-2 border-white flex items-center justify-center z-50 print:hidden"
                          title="Geser ke Kanan"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoveUnlockedIds([]);
                            setMoveAnchorId(null);
                          }}
                          className="absolute -top-3 -right-3 px-1.5 py-0.5 rounded-full bg-slate-950 border border-emerald-400 text-emerald-300 text-[8.5px] font-black shadow z-50 print:hidden"
                          title="Kunci kembali posisi kartu"
                        >
                          Kunci ✓
                        </button>
                      </>
                    )}

                    {/* Badge Checklist Mode Pilih Banyak (ketuk langsung pilih/batal pilih) */}
                    {isMultiSelectMode && (
                      <span
                        className={`absolute -top-2 -right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center shadow z-30 pointer-events-none print:hidden ${
                          isSelected
                            ? 'bg-sky-500 border-white text-slate-950'
                            : isDark
                            ? 'bg-slate-900/90 border-sky-400/70 text-transparent'
                            : 'bg-white/95 border-sky-500/70 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}

                    {/* Badge Mikro Generasi di sudut kiri-atas kartu saat Jalur Generasi aktif */}
                    {showGenGuides && node.genLevel !== undefined && (
                      <span
                        className={`absolute -top-2 left-1.5 px-1 rounded text-[8px] font-black leading-tight border ${
                          isDark
                            ? 'bg-slate-900 border-amber-500/50 text-amber-300'
                            : 'bg-amber-50 border-amber-400 text-amber-800'
                        }`}
                      >
                        G{node.genLevel + 1}
                      </span>
                    )}

                    {/* 4 Titik Port Indikator */}
                    <span
                      className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none transition-opacity ${
                        isSelected
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    />
                    <span
                      className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none transition-opacity ${
                        isSelected
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    />
                    <span
                      className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none transition-opacity ${
                        isSelected
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    />
                    <span
                      className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none transition-opacity ${
                        isSelected
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    />

                    {node.mergedMembers && node.mergedMembers.length >= 2 ? (
                      (() => {
                        const mList = node.mergedMembers;
                        const gm = getMergedGridMetrics(
                          mList.length,
                          cardDisplayMode,
                          photoFrameSize,
                          cardScale,
                          node.mergedCols
                        );
                        const cellNamePx = Math.max(7.5, Math.round(10.5 * cardScale));
                        const cellSubPx = Math.max(6.5, Math.round(8.5 * cardScale));
                        return (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            {isSelected && (
                              <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnmergeSelectedCard(node.id);
                                }}
                                className="absolute -top-2.5 right-1.5 px-1.5 py-0.5 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 text-[8.5px] font-black shadow z-30 flex items-center gap-0.5 print:hidden"
                                title="Pisah kembali ke kartu satuan"
                              >
                                <Split className="w-2.5 h-2.5" />
                                <span>Pisah</span>
                              </button>
                            )}

                            {cardDisplayMode !== 'photo_only' && (
                              <div
                                style={{
                                  height: `${gm.headerH}px`,
                                  fontSize: `${Math.max(8, Math.round(10.5 * cardScale))}px`,
                                }}
                                className="w-full flex items-center justify-between gap-1 px-1 mb-1 border-b border-amber-500/30 font-extrabold truncate"
                              >
                                <span className="truncate text-amber-400">
                                  {node.name}
                                </span>
                                <span className="shrink-0 px-1 rounded bg-amber-500/20 text-amber-300 text-[8.5px] font-black">
                                  {mList.length} Foto
                                </span>
                              </div>
                            )}

                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${gm.cols}, minmax(0, 1fr))`,
                                gap: `${gm.gap}px`,
                                width: '100%',
                              }}
                              className="items-stretch justify-items-center"
                            >
                              {mList.map((mm, mIdx) => (
                                <div
                                  key={`${mm.originalNodeId}_${mIdx}`}
                                  className={`w-full flex flex-col items-center justify-start rounded-lg ${
                                    cardDisplayMode === 'photo_only'
                                      ? ''
                                      : isCardLight
                                      ? 'bg-stone-100/80 border border-stone-300/80 p-1'
                                      : 'bg-slate-900/65 border border-slate-700/80 p-1'
                                  } ${mm.wafat ? 'border-dashed opacity-90' : ''}`}
                                >
                                  {cardDisplayMode !== 'name_only' && (
                                    <div
                                      style={{
                                        width: `${pDim.w}px`,
                                        height: `${pDim.h}px`,
                                      }}
                                      className={`overflow-hidden flex items-center justify-center font-extrabold text-xs border shrink-0 ${
                                        isDark
                                          ? 'bg-[#0f172a] border-slate-600 text-amber-400'
                                          : 'bg-stone-100 border-stone-300 text-amber-700'
                                      } ${
                                        photoFrameSize === 'bulat'
                                          ? 'rounded-full'
                                          : 'rounded-md'
                                      } ${cardDisplayMode === 'full' ? 'mb-0.5' : ''}`}
                                    >
                                      {mm.photo ? (
                                        <img
                                          src={mm.photo}
                                          alt={mm.name}
                                          className="w-full h-full object-cover pointer-events-none"
                                        />
                                      ) : (
                                        <span>{getInitials(mm.name)}</span>
                                      )}
                                    </div>
                                  )}

                                  {cardDisplayMode !== 'photo_only' && (
                                    <div
                                      style={{ fontSize: `${cellNamePx}px` }}
                                      className="font-bold leading-tight text-center break-words w-full line-clamp-2"
                                    >
                                      {mm.gender && (
                                        <span className="mr-0.5">
                                          {mm.gender === 'P' ? '👩' : '👨'}
                                        </span>
                                      )}
                                      {mm.name}
                                    </div>
                                  )}

                                  {cardDisplayMode === 'full' && mm.sub && (
                                    <div
                                      style={{ fontSize: `${cellSubPx}px` }}
                                      className={`leading-tight text-center truncate w-full opacity-75 ${
                                        isCardLight ? 'text-slate-600' : 'text-slate-400'
                                      }`}
                                    >
                                      {mm.sub}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        {/* Mode Card: Seukuran Foto Saja (2x3 / 3x4 / 4x6 / Bulat) */}
                        {cardDisplayMode === 'photo_only' && (
                          <div
                            style={{ width: `${pDim.w}px`, height: `${pDim.h}px` }}
                            className={`overflow-hidden flex items-center justify-center font-extrabold text-sm border relative ${
                              isDark
                                ? 'bg-[#0f172a] border-slate-600 text-amber-400'
                                : 'bg-stone-100 border-stone-300 text-amber-700'
                            } ${photoFrameSize === 'bulat' ? 'rounded-full' : 'rounded-lg'}`}
                          >
                            {node.photo ? (
                              <img
                                src={node.photo}
                                alt={node.name}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                            ) : (
                              <span>{getInitials(node.name)}</span>
                            )}
                          </div>
                        )}

                        {/* Mode Card: Nama Saja */}
                        {cardDisplayMode === 'name_only' && (
                          <div
                            style={{ fontSize: `${scaledNamePx}px` }}
                            className="font-extrabold leading-tight truncate w-full flex items-center justify-center gap-1"
                          >
                            {node.gender && (
                              <span className="shrink-0 opacity-90">
                                {node.gender === 'P' ? '👩' : '👨'}
                              </span>
                            )}
                            <span className="truncate">{node.name}</span>
                          </div>
                        )}

                        {/* Mode Card: Lengkap (Foto + Nama + Keterangan) */}
                        {cardDisplayMode === 'full' && (
                          <>
                            <div
                              style={{
                                width: `${pDim.w}px`,
                                height: `${pDim.h}px`,
                              }}
                              className={`mb-1 overflow-hidden flex items-center justify-center font-extrabold text-sm border-2 shrink-0 ${
                                isDark
                                  ? 'bg-[#0f172a] border-slate-600 text-amber-400'
                                  : 'bg-stone-100 border-stone-300 text-amber-600'
                              } ${
                                photoFrameSize === 'bulat'
                                  ? 'rounded-full'
                                  : 'rounded-lg'
                              }`}
                            >
                              {node.photo ? (
                                <img
                                  src={node.photo}
                                  alt={node.name}
                                  className="w-full h-full object-cover pointer-events-none"
                                />
                              ) : (
                                <span>{getInitials(node.name)}</span>
                              )}
                            </div>
                            <div
                              style={{ fontSize: `${scaledNamePx}px` }}
                              className="font-bold leading-tight break-words w-full"
                            >
                              {node.gender && (
                                <span className="mr-0.5">
                                  {node.gender === 'P' ? '👩' : '👨'}
                                </span>
                              )}
                              {node.name}
                            </div>
                            {node.sub && (
                              <div
                                style={{ fontSize: `${scaledSubPx}px` }}
                                className={`mt-0.5 leading-tight ${
                                  (node.customBgColor || cardBgColor)
                                    ? isLightHexColor(node.customBgColor || cardBgColor)
                                      ? 'text-slate-600'
                                      : 'text-slate-300'
                                    : isDark
                                    ? 'text-slate-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {node.sub}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
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
                        {nodes.length} Anggota • {paperDim.label}
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
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-6 h-0.5 rounded-full"
                          style={{
                            backgroundColor:
                              childLineColor ||
                              (isDark || bgStyle !== '' ? '#38bdf8' : '#0284c7'),
                          }}
                        />
                        <span>Keturunan</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-6 border-t-2 border-dashed"
                          style={{ borderColor: coupleLineColor || '#f59e0b' }}
                        />
                        <span>Pasangan</span>
                      </div>
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
        {/* KONTROL MELAYANG ADAPTIF (MENYESUAIKAN PORTRAIT/LANSKAP)  */}
        {/* ========================================================= */}

        {/* 1. Dock Melayang Kiri-Atas (Khusus Mode Leluasa: Kertas, Orientasi, Keluar) */}
        {isFocusMode && (
          <div className="fixed top-2.5 left-2.5 z-40 flex flex-wrap items-center gap-1.5 print:hidden max-w-[58vw]">
            <button
              type="button"
              onClick={() => setIsFocusMode(false)}
              className="px-2.5 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-white border border-stone-700 backdrop-blur-md text-[11px] font-extrabold flex items-center gap-1 shadow-lg"
              title="Keluar dari Mode Leluasa (ESC)"
            >
              <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Keluar Penuh</span>
            </button>

            <div className="flex items-center rounded-xl bg-stone-900/85 border border-stone-700 backdrop-blur-md p-0.5 gap-0.5 shadow-lg">
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as GridPaperSize)}
                className="bg-transparent text-amber-300 text-[11px] font-black px-1.5 py-1 outline-hidden cursor-pointer"
              >
                <option value="a4" className="bg-stone-900">A4</option>
                <option value="a3" className="bg-stone-900">A3</option>
                <option value="a2" className="bg-stone-900">A2</option>
                <option value="a1" className="bg-stone-900">A1</option>
                <option value="a0" className="bg-stone-900">A0</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setAutoScreenOrient(false);
                  setPaperOrientation((o) =>
                    o === 'landscape' ? 'portrait' : 'landscape'
                  );
                }}
                className="px-2 py-1 rounded-lg bg-stone-800 text-emerald-300 text-[10px] font-bold"
                title="Putar Kertas Potret / Lanskap"
              >
                {paperOrientation === 'landscape' ? 'Lanskap' : 'Potret'}
              </button>
              <button
                type="button"
                onClick={() => setAutoScreenOrient((v) => !v)}
                className={`p-1 rounded-lg text-[10px] font-bold ${
                  autoScreenOrient
                    ? 'bg-emerald-600 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
                title="Auto-Sesuaikan Potret/Lanskap dengan Layar"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Dock Melayang Kanan-Atas (Khusus Mode Leluasa: Aksi Edit Cepat) */}
        {isFocusMode && (
          <div className="fixed top-2.5 right-2.5 z-40 flex flex-wrap items-center justify-end gap-1 print:hidden max-w-[55vw]">
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

            <button
              type="button"
              onClick={handleSaveNamedDesign}
              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-[11px] font-black flex items-center gap-1 shadow-lg"
              title="Simpan Desain"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simpan</span>
            </button>
          </div>
        )}

        {/* 3. Dock Melayang Kanan-Bawah: Zoom 2-Jari / Tombol, Mode Geser (Hand), Pas Layar, Leluasa */}
        <div
          className={`${
            isFocusMode ? 'fixed bottom-3 right-3' : 'absolute bottom-2.5 right-2.5'
          } z-40 flex items-center gap-1 rounded-2xl bg-stone-900/90 border border-stone-700/90 text-white p-1 backdrop-blur-md shadow-xl print:hidden`}
        >
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
            title="Mode Geser Kanvas (Hand Tool) agar layar sentuh tidak tidak sengaja menggeser kartu"
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Geser</span>
          </button>

          <span className="w-px h-4 bg-stone-700" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.15, +(z - 0.1).toFixed(2)))}
            className="p-1.5 rounded-xl hover:bg-stone-800 text-stone-200"
            title="Perkecil Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFitScreen}
            className="px-1.5 py-1 rounded-lg hover:bg-stone-800 text-[11px] font-mono font-extrabold text-amber-300 min-w-[42px] text-center"
            title="Ketuk untuk Pas Layar Otomatis"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}
            className="p-1.5 rounded-xl hover:bg-stone-800 text-stone-200"
            title="Perbesar Zoom (Mendukung Pinch 2 Jari)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleFitScreen}
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
              title="Mode Leluasa (Layar Penuh)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 4. Dock Kontekstual Melayang saat Kartu Dipilih (Normal & Mode Leluasa) */}
        {selectedIds.length > 0 && (
          <div
            className={`${
              isFocusMode ? 'fixed bottom-3 left-3' : 'absolute bottom-2.5 left-2.5'
            } z-40 flex flex-col gap-1.5 print:hidden max-w-[68vw]`}
          >
            <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-stone-900/92 border border-amber-500/40 text-white p-1.5 backdrop-blur-md shadow-xl">
              <span className="text-[10px] font-black text-amber-300 px-1.5">
                {selectedIds.length} dipilih
              </span>

              {layoutMode === 'manual' && (
                <button
                  type="button"
                  onClick={() => {
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
                  title="Tampilkan panah geser ▲▼◀▶ atau buka kunci geser kartu terpilih"
                >
                  {selectedIds.some((id) => moveUnlockedIds.includes(id)) ? (
                    <Unlock className="w-3 h-3" />
                  ) : (
                    <Lock className="w-3 h-3" />
                  )}
                  <span>
                    {selectedIds.some((id) => moveUnlockedIds.includes(id))
                      ? 'Kunci'
                      : 'Panah Geser'}
                  </span>
                </button>
              )}

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
          </div>
        )}
      </div>

      {/* Status Bar Bawah Kanvas (Ringkas) */}
      {!isFocusMode && (
      <div
        className={`px-3 py-1 border-t text-[10px] flex items-center justify-between gap-2 shrink-0 ${
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
        actionLabel={`Cetak Poster Silsilah ${paperDim.label}`}
        unlockModule={true}
        onClose={() => setShowPrintFeeModal(false)}
        onPaid={() => {
          setShowPrintFeeModal(false);
          setTimeout(() => window.print(), 150);
        }}
        showNotification={showNotification}
      />
    </div>
  );
};
