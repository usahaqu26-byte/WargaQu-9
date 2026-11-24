import type {
  CardDisplayMode,
  ConnectorLineStyle,
  EdgePortSide,
  GenGradientPaletteId,
  GridPaperSize,
  InteractiveEdge,
  InteractiveNode,
  PhotoFrameSize,
} from './InteractiveGridCanvasView';
import {
  computeMergedCardMetrics,
  getUniformSubCardSize,
} from './smartGridLayouts';

export const SNAP_SIZE = 20;

export const GRID_PAPER_MAP: Record<
  GridPaperSize,
  { label: string; wMm: number; hMm: number; pxW: number; pxH: number }
> = {
  a4: { label: 'A4', wMm: 297, hMm: 210, pxW: 1123, pxH: 794 },
  a3: { label: 'A3', wMm: 420, hMm: 297, pxW: 1587, pxH: 1123 },
  a2: { label: 'A2', wMm: 594, hMm: 420, pxW: 2245, pxH: 1587 },
  a1: { label: 'A1', wMm: 841, hMm: 594, pxW: 3179, pxH: 2245 },
  a0: { label: 'A0', wMm: 1189, hMm: 841, pxW: 4494, pxH: 3179 },
};

export const PHOTO_DIMENSIONS: Record<
  PhotoFrameSize,
  { w: number; h: number; label: string }
> = {
  kotak: { w: 58, h: 58, label: 'Kotak 1:1' },
  bulat: { w: 56, h: 56, label: 'Bulat 1:1' },
  '2x3': { w: 56, h: 84, label: '2×3' },
  '3x4': { w: 66, h: 88, label: '3×4' },
  '4x6': { w: 80, h: 120, label: '4×6' },
};

export const HEXAGON_CLIP_PATH =
  'polygon(50% 0%, 96% 25%, 96% 75%, 50% 100%, 4% 75%, 4% 25%)';

export const GEN_GRADIENT_PALETTES: Record<
  Exclude<GenGradientPaletteId, 'none'>,
  {
    label: string;
    stops: Array<{ bg: string; border: string; line: string }>;
  }
> = {
  royal_emerald: {
    label: 'Zamrud Tua ➔ Mint Cerah',
    stops: [
      { bg: '#022c22', border: '#10b981', line: '#065f46' },
      { bg: '#064e3b', border: '#34d399', line: '#059669' },
      { bg: '#047857', border: '#6ee7b7', line: '#10b981' },
      { bg: '#34d399', border: '#065f46', line: '#34d399' },
      { bg: '#a7f3d0', border: '#047857', line: '#6ee7b7' },
      { bg: '#ecfdf5', border: '#10b981', line: '#a7f3d0' },
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
};

export function getGenGradientStyle(
  paletteId: GenGradientPaletteId,
  genLevel = 0
): { bg: string; border: string; line: string } | null {
  if (paletteId === 'none') return null;
  const pal = GEN_GRADIENT_PALETTES[paletteId];
  if (!pal) return null;
  const idx = Math.max(0, Math.min(pal.stops.length - 1, Math.floor(genLevel)));
  return pal.stops[idx];
}

export function isLightHexColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getScaledPhotoDim(
  photoSize: PhotoFrameSize,
  cardScale = 1
): { w: number; h: number } {
  const base = PHOTO_DIMENSIONS[photoSize] || PHOTO_DIMENSIONS['3x4'];
  const aspect = base.h / Math.max(1, base.w);
  const w = Math.max(18, Math.round(base.w * cardScale));
  const h = Math.max(18, Math.round(w * aspect));
  return { w, h };
}

export function getNodeSize(
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

  if (
    node.modularSubLayout === 'I' ||
    node.modularSubLayout === 'L' ||
    (node.scaleMultiplier ?? 1) > 1.05
  ) {
    const u = getUniformSubCardSize(displayMode, photoSize, effScale);
    return { w: u.w, h: u.h };
  }

  const pDim = PHOTO_DIMENSIONS[photoSize] || PHOTO_DIMENSIONS['3x4'];

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

  const cardW = Math.round(Math.max(142, pDim.w + 26) * effScale);
  const cardH = Math.round((pDim.h + 50) * effScale);
  return { w: cardW, h: cardH };
}

export function getSmartPorts(
  n1: InteractiveNode,
  n2: InteractiveNode,
  edgeType: 'couple' | 'child',
  displayMode: CardDisplayMode,
  photoSize: PhotoFrameSize,
  cardScale = 1,
  fromPortOverride?: EdgePortSide,
  toPortOverride?: EdgePortSide
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

  if (
    edgeType === 'couple' &&
    Math.abs(cy1 - cy2) < Math.max(s1.h, s2.h) * 0.75
  ) {
    if (n2.x >= n1.x) {
      autoPair = { a: p1.right, b: p2.left, dir1: 'right', dir2: 'left' };
    } else {
      autoPair = { a: p1.left, b: p2.right, dir1: 'left', dir2: 'right' };
    }
  } else if (edgeType === 'child' && n2.y >= n1.y + s1.h * 0.6) {
    autoPair = { a: p1.bottom, b: p2.top, dir1: 'bottom', dir2: 'top' };
  } else if (
    edgeType === 'child' &&
    n2.x >= n1.x + s1.w * 0.75 &&
    Math.abs(cy1 - cy2) < 200
  ) {
    autoPair = { a: p1.right, b: p2.left, dir1: 'right', dir2: 'left' };
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
    fromPortOverride && fromPortOverride !== 'auto'
      ? fromPortOverride
      : autoPair.dir1;
  const finalDir2 =
    toPortOverride && toPortOverride !== 'auto'
      ? toPortOverride
      : autoPair.dir2;

  return {
    a: p1[finalDir1],
    b: p2[finalDir2],
    dir1: finalDir1,
    dir2: finalDir2,
  };
}

export interface NodeObstacleBox {
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

export function buildConnectorRoute(
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
  const isCustomOffset =
    Math.abs(ox) >= 2 || Math.abs(oy) >= 2 || Math.abs(dotT - 0.5) >= 0.03;
  const otherBoxes = obstacles.filter(
    (ob) => ob.id !== edge.from && ob.id !== edge.to
  );

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

  if (isVert1 && isVert2) {
    if (dir1 === dir2) {
      const baseOutY =
        dir1 === 'bottom' ? Math.max(ay, by) + 26 : Math.min(ay, by) - 26;
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

    let baseRailY =
      Math.abs(dy) > 190 && dir1 === 'bottom' && dir2 === 'top'
        ? Math.round((by - 20) * 10) / 10
        : midY;
    let autoDetourX: number | null = null;

    if (!isCustomOffset && otherBoxes.length > 0) {
      const railHits = otherBoxes.some((ob) =>
        segmentIntersectsHoriz(baseRailY, ax, bx, ob, 5)
      );
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
          if (
            !otherBoxes.some((ob) =>
              segmentIntersectsHoriz(candY, ax, bx, ob, 5)
            )
          ) {
            baseRailY = Math.round(candY * 10) / 10;
            break;
          }
        }
      }

      const blockingBox = otherBoxes.find((ob) =>
        segmentIntersectsVert(
          ax,
          ay + (dir1 === 'bottom' ? 14 : -14),
          baseRailY,
          ob,
          4
        )
      );
      if (blockingBox) {
        const leftClear = blockingBox.x - 14;
        const rightClear = blockingBox.x + blockingBox.w + 14;
        autoDetourX =
          Math.abs(leftClear - ax) <= Math.abs(rightClear - ax)
            ? leftClear
            : rightClear;
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
      const c = Math.min(
        20,
        Math.abs(dx) / 2,
        Math.abs(railY - ay),
        Math.abs(by - railY)
      );
      return {
        d: `M ${ax} ${ay} L ${ax} ${railY - sy * c} L ${ax + sx * c} ${railY} L ${bx - sx * c} ${railY} L ${bx} ${railY + sy * c} L ${bx} ${by}`,
        handle: { x: midX, y: railY },
        isCustomOffset,
      };
    }

    const trunkX =
      Math.round((Math.abs(ox) >= 6 ? midX + ox : autoDetourX!) * 10) / 10;
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
    const c1 = Math.min(
      10,
      Math.abs(trunkX - ax) / 2,
      Math.abs(exitY - ay) / 2
    );
    const c2 = Math.min(
      10,
      Math.abs(trunkX - ax) / 2,
      Math.abs(railY - exitY) / 2
    );
    const c3 = Math.min(
      10,
      Math.abs(bx - trunkX) / 2,
      Math.abs(railY - exitY) / 2
    );
    const c4 = Math.min(
      10,
      Math.abs(bx - trunkX) / 2,
      Math.abs(by - railY) / 2
    );
    const syExit = exitY >= ay ? 1 : -1;
    return {
      d: `M ${ax} ${ay} L ${ax} ${exitY - syExit * c1} L ${ax + sxA * c1} ${exitY} L ${trunkX - sxA * c2} ${exitY} L ${trunkX} ${exitY + syMid * c2} L ${trunkX} ${railY - syMid * c3} L ${trunkX + sxB * c3} ${railY} L ${bx - sxB * c4} ${railY} L ${bx} ${railY + syEnd * c4} L ${bx} ${by}`,
      handle: { x: trunkX, y: railY },
      isCustomOffset,
    };
  }

  if (!isVert1 && !isVert2) {
    if (dir1 === dir2) {
      const baseOutX =
        dir1 === 'right' ? Math.max(ax, bx) + 26 : Math.min(ax, bx) - 26;
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
      const c = Math.min(
        20,
        Math.abs(railX - ax),
        Math.abs(bx - railX),
        Math.abs(dy) / 2
      );
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

  const hx = Math.round(((isVert1 ? ax : bx) + ox) * 10) / 10;
  const hy = Math.round(((isVert1 ? by : ay) + oy) * 10) / 10;
  if (!isCustomOffset) {
    const c =
      lineStyle === 'pcb90' ? 0 : Math.min(18, Math.abs(dx), Math.abs(dy));
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
