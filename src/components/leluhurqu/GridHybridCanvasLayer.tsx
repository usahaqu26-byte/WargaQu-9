import React, { useEffect, useRef } from 'react';
import { Compass, X } from 'lucide-react';
import type {
  CanvasBackground,
  CardDisplayMode,
  ConnectorLineStyle,
  GenGradientPaletteId,
  GridPhotoShape,
  InteractiveEdge,
  InteractiveNode,
  PhotoFrameSize,
} from './InteractiveGridCanvasView';
import {
  getGenGradientStyle,
  getInitials,
  getNodeSize,
  getScaledPhotoDim,
  hexWithAlpha,
  isLightHexColor,
} from './gridCanvasUtils';

export interface ComputedCanvasEdgeItem {
  idx: number;
  edge: InteractiveEdge;
  pts: {
    a: { x: number; y: number };
    b: { x: number; y: number };
    dir1: 'top' | 'bottom' | 'left' | 'right';
    dir2: 'top' | 'bottom' | 'left' | 'right';
  };
  route: { d: string; handle: { x: number; y: number }; isCustomOffset: boolean };
  edgeKind?: 'couple' | 'child' | 'sibling';
  lineColor: string;
  gradFrom: string;
  gradTo: string;
  canUseGrad: boolean;
  gradId: string;
}

interface GridHybridSnapshotCanvasProps {
  visible: boolean;
  boardWidth: number;
  boardHeight: number;
  nodes: InteractiveNode[];
  computedEdges: ComputedCanvasEdgeItem[];
  selectedIds: string[];
  lineStyle: ConnectorLineStyle;
  lineThickness: number;
  cardDisplayMode: CardDisplayMode;
  photoFrameSize: PhotoFrameSize;
  photoShape: GridPhotoShape;
  cardScale: number;
  genGradientPalette: GenGradientPaletteId;
  cardBgColor: string;
  cardBorderColor: string;
  isDark: boolean;
  bgStyle: CanvasBackground;
}

/**
 * Lapisan Pratinjau Snapshot Raster (Gabungan Opsi B):
 * Menampilkan seluruh papan A0-A4 sebagai 1 lapisan <canvas> super ringan
 * ketika melihat keseluruhan trah besar / zoom jauh / saat pan-zoom cepat.
 */
export const GridHybridSnapshotCanvas: React.FC<
  GridHybridSnapshotCanvasProps
> = React.memo(
  ({
    visible,
    boardWidth,
    boardHeight,
    nodes,
    computedEdges,
    selectedIds,
    lineStyle,
    lineThickness,
    cardDisplayMode,
    photoFrameSize,
    photoShape,
    cardScale,
    genGradientPalette,
    cardBgColor,
    cardBorderColor,
    isDark,
    bgStyle,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imgCacheRef = useRef<Map<string, HTMLImageElement | 'loading' | 'error'>>(
      new Map()
    );
    const redrawTickRef = useRef<number>(0);

    useEffect(() => {
      if (!visible) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      let cancelled = false;
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        const maxSide = 2200;
        const scale = Math.min(1, maxSide / Math.max(boardWidth, boardHeight));
        const targetW = Math.max(320, Math.round(boardWidth * scale));
        const targetH = Math.max(240, Math.round(boardHeight * scale));

        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.scale(scale, scale);

        // 1. Garis Konektor
        if (lineStyle !== 'none') {
          ctx.lineCap = 'round';
          ctx.lineJoin = lineStyle === 'pcb90' ? 'miter' : 'round';
          computedEdges.forEach((ce) => {
            try {
              const p2d = new Path2D(ce.route.d);
              ctx.save();
              ctx.strokeStyle = ce.lineColor;
              const isSiblingEdge = ce.edgeKind === 'sibling';
              ctx.lineWidth = isSiblingEdge
                ? Math.max(1.3, lineThickness * 0.85)
                : Math.max(1.5, lineThickness);
              if (ce.edge.type === 'couple') {
                ctx.setLineDash([6, 4]);
              }
              ctx.stroke(p2d);
              ctx.restore();
            } catch {
              // Abaikan jika Path2D gagal parse
            }
          });
        }

        // 2. Kartu Anggota (termasuk kotak ringkas modular)
        const selectedSet = new Set(selectedIds);
        const resolvedShape: GridPhotoShape =
          photoFrameSize === 'bulat' ? 'bulat' : photoShape;

        const drawCardRoundedRect = (
          x: number,
          y: number,
          w: number,
          h: number,
          r: number
        ) => {
          const rad = Math.min(r, w / 2, h / 2);
          ctx.beginPath();
          ctx.moveTo(x + rad, y);
          ctx.lineTo(x + w - rad, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
          ctx.lineTo(x + w, y + h - rad);
          ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
          ctx.lineTo(x + rad, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
          ctx.lineTo(x, y + rad);
          ctx.quadraticCurveTo(x, y, x + rad, y);
          ctx.closePath();
        };

        const loadAndDrawPhoto = (
          url: string,
          cx: number,
          cy: number,
          pw: number,
          ph: number,
          alt: string,
          isLight: boolean
        ) => {
          ctx.save();
          if (resolvedShape === 'bulat') {
            ctx.beginPath();
            ctx.arc(cx + pw / 2, cy + ph / 2, Math.min(pw, ph) / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
          } else {
            drawCardRoundedRect(cx, cy, pw, ph, 5);
            ctx.clip();
          }

          ctx.fillStyle = isLight ? '#f5f5f4' : '#0f172a';
          ctx.fillRect(cx, cy, pw, ph);

          if (url) {
            const cached = imgCacheRef.current.get(url);
            if (cached && cached !== 'loading' && cached !== 'error') {
              try {
                ctx.drawImage(cached, cx, cy, pw, ph);
              } catch {
                // ignore
              }
            } else if (!cached) {
              imgCacheRef.current.set(url, 'loading');
              const img = new Image();
              if (!url.startsWith('data:')) {
                img.crossOrigin = 'anonymous';
              }
              img.onload = () => {
                imgCacheRef.current.set(url, img);
                redrawTickRef.current += 1;
                // Trigger soft redraw on next frame
                if (!cancelled && canvasRef.current && visible) {
                  window.requestAnimationFrame(() => {
                    const c = canvasRef.current?.getContext('2d');
                    if (!c) return;
                    c.save();
                    c.scale(scale, scale);
                    c.save();
                    if (resolvedShape === 'bulat') {
                      c.beginPath();
                      c.arc(
                        cx + pw / 2,
                        cy + ph / 2,
                        Math.min(pw, ph) / 2,
                        0,
                        Math.PI * 2
                      );
                      c.closePath();
                      c.clip();
                    } else {
                      c.beginPath();
                      c.rect(cx, cy, pw, ph);
                      c.clip();
                    }
                    try {
                      c.drawImage(img, cx, cy, pw, ph);
                    } catch {
                      // ignore
                    }
                    c.restore();
                    c.restore();
                  });
                }
              };
              img.onerror = () => {
                imgCacheRef.current.set(url, 'error');
              };
              img.src = url;
            }
          } else {
            ctx.fillStyle = isLight ? '#b45309' : '#fbbf24';
            ctx.font = `800 ${Math.max(9, Math.round(pw * 0.28))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(getInitials(alt), cx + pw / 2, cy + ph / 2);
          }
          ctx.restore();
        };

        nodes.forEach((node) => {
          const size = getNodeSize(
            node,
            cardDisplayMode,
            photoFrameSize,
            cardScale
          );
          const effScale = cardScale * (node.scaleMultiplier ?? 1);
          const isModular = Boolean(
            node.mergedMembers && node.mergedMembers.length >= 2
          );
          const genStyle = getGenGradientStyle(
            genGradientPalette,
            node.genLevel ?? 0
          );
          const effectiveBg =
            node.customBgColor || cardBgColor || genStyle?.bg || '';
          const effectiveBorder =
            node.customBorderColor || cardBorderColor || genStyle?.border || '';
          const fillCol =
            isModular && effectiveBg
              ? hexWithAlpha(effectiveBg, isDark ? 0.24 : 0.16)
              : effectiveBg || (isDark ? '#1e293b' : '#ffffff');
          const strokeCol = selectedSet.has(node.id)
            ? '#f59e0b'
            : effectiveBorder || (isDark ? '#475569' : '#d6d3d1');
          const isCardLight = effectiveBg
            ? isModular
              ? !isDark
              : isLightHexColor(effectiveBg)
            : !isDark;

          ctx.save();
          drawCardRoundedRect(node.x, node.y, size.w, size.h, 11);
          ctx.fillStyle = fillCol;
          ctx.fill();
          ctx.lineWidth = selectedSet.has(node.id) ? 3.2 : 2;
          if (node.wafat) ctx.setLineDash([5, 3]);
          ctx.strokeStyle = strokeCol;
          ctx.stroke();
          ctx.setLineDash([]);

          if (isModular && node.mergedMembers) {
            ctx.fillStyle = isCardLight ? '#0f172a' : '#f8fafc';
            ctx.font = `800 ${Math.max(9, Math.round(10 * effScale))}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(
              `${node.name} (${node.mergedMembers.length})`,
              node.x + 8,
              node.y + 7,
              size.w - 16
            );

            // Mini preview tiles inside modular card
            const mCount = Math.min(12, node.mergedMembers.length);
            const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(mCount))));
            const pad = 8;
            const tileW = Math.max(14, (size.w - pad * 2 - (cols - 1) * 4) / cols);
            const tileH = Math.min(34, Math.max(16, (size.h - 32) / Math.ceil(mCount / cols) - 4));
            for (let i = 0; i < mCount; i++) {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const tx = node.x + pad + c * (tileW + 4);
              const ty = node.y + 26 + r * (tileH + 4);
              ctx.fillStyle = isCardLight
                ? 'rgba(15,23,42,0.08)'
                : 'rgba(255,255,255,0.08)';
              ctx.fillRect(tx, ty, tileW, tileH);
            }
          } else if (cardDisplayMode === 'name_only') {
            ctx.fillStyle = isCardLight ? '#0f172a' : '#f8fafc';
            ctx.font = `800 ${Math.max(8, Math.round(11.5 * effScale))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              node.name,
              node.x + size.w / 2,
              node.y + size.h / 2,
              size.w - 10
            );
          } else {
            const pDim = getScaledPhotoDim(photoFrameSize, effScale);
            const px = node.x + (size.w - pDim.w) / 2;
            const py = node.y + 4;
            loadAndDrawPhoto(
              node.photo,
              px,
              py,
              pDim.w,
              pDim.h,
              node.name,
              isCardLight
            );

            // Badge Nama + Detail
            const badgeY = py + pDim.h + 3;
            const badgeH = Math.max(14, size.h - (pDim.h + 10));
            ctx.fillStyle = isCardLight
              ? 'rgba(0,0,0,0.07)'
              : 'rgba(0,0,0,0.32)';
            drawCardRoundedRect(
              node.x + 3,
              badgeY,
              size.w - 6,
              badgeH,
              5
            );
            ctx.fill();

            ctx.fillStyle = isCardLight ? '#0f172a' : '#ffffff';
            ctx.font = `800 ${Math.max(7.5, Math.round(9.5 * effScale))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(
              node.name,
              node.x + size.w / 2,
              badgeY + 2,
              size.w - 10
            );

            if (cardDisplayMode === 'full' && node.sub) {
              ctx.fillStyle = isCardLight ? '#334155' : '#e2e8f0';
              ctx.font = `600 ${Math.max(6.5, Math.round(8 * effScale))}px sans-serif`;
              ctx.fillText(
                node.sub,
                node.x + size.w / 2,
                badgeY + Math.max(11, Math.round(12 * effScale)),
                size.w - 10
              );
            }
          }

          ctx.restore();
        });

        ctx.restore();
      }, 60);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }, [
      visible,
      boardWidth,
      boardHeight,
      nodes,
      computedEdges,
      selectedIds,
      lineStyle,
      lineThickness,
      cardDisplayMode,
      photoFrameSize,
      photoShape,
      cardScale,
      genGradientPalette,
      cardBgColor,
      cardBorderColor,
      isDark,
      bgStyle,
    ]);

    if (!visible) return null;

    return (
      <canvas
        ref={canvasRef}
        style={{
          width: `${boardWidth}px`,
          height: `${boardHeight}px`,
        }}
        className="absolute inset-0 pointer-events-none z-[15] print:hidden"
      />
    );
  }
);

export interface MiniNavTransformSnapshot {
  panX: number;
  panY: number;
  zoom: number;
  vpW: number;
  vpH: number;
}

interface GridMiniNavigatorProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  boardWidth: number;
  boardHeight: number;
  nodes: InteractiveNode[];
  cardDisplayMode: CardDisplayMode;
  photoFrameSize: PhotoFrameSize;
  cardScale: number;
  paperLabel: string;
  isDark: boolean;
  registerViewportBoxEl: (el: HTMLDivElement | null) => void;
  onJumpToBoardPoint: (boardX: number, boardY: number) => void;
  isCssRotatedLandscape?: boolean;
}

/**
 * Panel Mini-Navigator (Minimap ala Photoshop/CorelDRAW)
 * Menampilkan seluruh kertas A0-A4 dan posisi area yang sedang dilihat.
 */
export const GridMiniNavigator: React.FC<GridMiniNavigatorProps> = React.memo(
  ({
    isOpen,
    onToggleOpen,
    boardWidth,
    boardHeight,
    nodes,
    cardDisplayMode,
    photoFrameSize,
    cardScale,
    paperLabel,
    isDark,
    registerViewportBoxEl,
    onJumpToBoardPoint,
    isCssRotatedLandscape = false,
  }) => {
    const mapBoxRef = useRef<HTMLDivElement | null>(null);
    const draggingMapRef = useRef(false);

    const maxW = 122;
    const maxH = 84;
    const mapScale = Math.min(maxW / boardWidth, maxH / boardHeight);
    const mapW = Math.max(56, Math.round(boardWidth * mapScale));
    const mapH = Math.max(40, Math.round(boardHeight * mapScale));

    const handlePointerToBoard = (clientX: number, clientY: number) => {
      if (!mapBoxRef.current) return;
      const rect = mapBoxRef.current.getBoundingClientRect();
      if (isCssRotatedLandscape) {
        const rx = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
        const ry = Math.max(0, Math.min(1, 1 - (clientX - rect.left) / Math.max(1, rect.width)));
        onJumpToBoardPoint(rx * boardWidth, ry * boardHeight);
        return;
      }
      const rx = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      const ry = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
      onJumpToBoardPoint(rx * boardWidth, ry * boardHeight);
    };

    if (!isOpen) {
      return (
        <button
          type="button"
          onClick={onToggleOpen}
          className="px-2 py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-amber-300 border border-stone-700/90 backdrop-blur-md shadow-xl text-[10px] font-black flex items-center gap-1"
          title="Buka Mini-Navigator Kertas A0-A4"
        >
          <Compass className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Peta {paperLabel}</span>
        </button>
      );
    }

    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="rounded-2xl bg-stone-950/90 border border-stone-700/90 backdrop-blur-md p-1.5 shadow-2xl flex flex-col gap-1 select-none"
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[9px] font-black text-amber-300 tracking-wide flex items-center gap-1">
            <Compass className="w-3 h-3" />
            <span>{paperLabel} • {nodes.length}</span>
          </span>
          <button
            type="button"
            onClick={onToggleOpen}
            className="p-0.5 rounded text-stone-400 hover:text-white"
            title="Lipat Peta Navigator"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <div
          ref={mapBoxRef}
          onMouseDown={(e) => {
            e.stopPropagation();
            draggingMapRef.current = true;
            handlePointerToBoard(e.clientX, e.clientY);
          }}
          onMouseMove={(e) => {
            if (!draggingMapRef.current) return;
            handlePointerToBoard(e.clientX, e.clientY);
          }}
          onMouseUp={() => {
            draggingMapRef.current = false;
          }}
          onMouseLeave={() => {
            draggingMapRef.current = false;
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            if (e.touches[0]) {
              handlePointerToBoard(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
            if (e.touches[0]) {
              handlePointerToBoard(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          style={{ width: `${mapW}px`, height: `${mapH}px` }}
          className={`relative rounded-lg overflow-hidden border cursor-crosshair touch-none ${
            isDark
              ? 'bg-slate-900 border-slate-700'
              : 'bg-stone-100 border-stone-300'
          }`}
        >
          {nodes.map((n) => {
            const sz = getNodeSize(n, cardDisplayMode, photoFrameSize, cardScale);
            return (
              <div
                key={`mini-${n.id}`}
                style={{
                  left: `${n.x * mapScale}px`,
                  top: `${n.y * mapScale}px`,
                  width: `${Math.max(2, sz.w * mapScale)}px`,
                  height: `${Math.max(2, sz.h * mapScale)}px`,
                }}
                className="absolute rounded-[1px] bg-emerald-400/80 pointer-events-none"
              />
            );
          })}

          {/* Kotak Viewport Aktif (diperbarui langsung oleh GPU rAF tanpa React re-render) */}
          <div
            ref={registerViewportBoxEl}
            className="absolute border-2 border-amber-400 bg-amber-400/15 rounded-[2px] pointer-events-none shadow-xs"
          />
        </div>
      </div>
    );
  }
);
