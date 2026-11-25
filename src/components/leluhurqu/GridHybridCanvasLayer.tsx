import React, { useEffect, useRef } from 'react';
import { Compass, X } from 'lucide-react';
import type {
  CanvasBackground,
  CardDisplayMode,
  CardFrameMode,
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
  strokeWidth?: number;
  taperedPathD?: string;
  arrowMeta?: {
    tipX: number;
    tipY: number;
    angleRad: number;
    size: number;
    color: string;
    kind: 'child' | 'sibling';
  };
  lineColor: string;
  gradFrom: string;
  gradTo: string;
  canUseGrad: boolean;
  gradId: string;
}

export interface TreeSkeletonData {
  rootPaths: Array<{ d: string; color: string; strokeColor?: string }>;
  trunkOuterPaths: Array<{ d: string; color: string; strokeColor?: string }>;
  trunkInnerPaths: Array<{ d: string; color: string }>;
  boughPaths: Array<{
    d: string;
    color: string;
    strokeColor?: string;
    innerD?: string;
    innerColor?: string;
  }>;
  twigPaths: Array<{
    d: string;
    color: string;
    strokeColor?: string;
    innerD?: string;
    innerColor?: string;
  }>;
  accentLeaves: Array<{
    cx: number;
    cy: number;
    w: number;
    h: number;
    angleDeg: number;
    fill: string;
    stroke: string;
  }>;
  arrowChevrons: Array<{
    x: number;
    y: number;
    angleDeg: number;
    size: number;
    color: string;
  }>;
}

export interface LineageHullItem {
  id: string;
  d: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: string;
  level: 1 | 2 | 3 | 4;
}

export interface LotusHaloItem {
  id: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  stroke: string;
  fill: string;
  strokeWidth?: number;
  solid?: boolean;
}

interface GridHybridSnapshotCanvasProps {
  visible: boolean;
  boardWidth: number;
  boardHeight: number;
  nodes: InteractiveNode[];
  computedEdges: ComputedCanvasEdgeItem[];
  treeSkeleton?: TreeSkeletonData | null;
  lineageHulls?: LineageHullItem[];
  lotusHalos?: LotusHaloItem[];
  selectedIds: string[];
  lineStyle: ConnectorLineStyle;
  lineThickness: number;
  cardDisplayMode: CardDisplayMode;
  cardFrameMode: CardFrameMode;
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
    treeSkeleton,
    lineageHulls,
    lotusHalos,
    selectedIds,
    lineStyle,
    lineThickness,
    cardDisplayMode,
    cardFrameMode,
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

        // 0. Kerangka Akar, Batang, Dahan & Ranting Pohon Natal Bertingkat (dengan bayangan kedalaman)
        if (treeSkeleton) {
          const fillPathList = (
            items: Array<{ d: string; color: string; strokeColor?: string }>
          ) => {
            items.forEach((it) => {
              try {
                const p = new Path2D(it.d);
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.34)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetY = 5;
                ctx.fillStyle = it.color;
                ctx.fill(p);
                ctx.restore();
                if (it.strokeColor) {
                  ctx.strokeStyle = it.strokeColor;
                  ctx.lineWidth = 2;
                  ctx.lineJoin = 'round';
                  ctx.stroke(p);
                }
              } catch {
                // ignore invalid path
              }
            });
          };
          fillPathList(treeSkeleton.rootPaths);
          fillPathList(treeSkeleton.trunkOuterPaths);
          fillPathList(treeSkeleton.boughPaths);
          treeSkeleton.boughPaths.forEach((bp) => {
            if (!bp.innerD || !bp.innerColor) return;
            try {
              ctx.fillStyle = bp.innerColor;
              ctx.fill(new Path2D(bp.innerD));
            } catch {
              // ignore
            }
          });
          fillPathList(treeSkeleton.twigPaths);
          treeSkeleton.twigPaths.forEach((tp) => {
            if (!tp.innerD || !tp.innerColor) return;
            try {
              ctx.fillStyle = tp.innerColor;
              ctx.fill(new Path2D(tp.innerD));
            } catch {
              // ignore
            }
          });
          treeSkeleton.trunkInnerPaths.forEach((ti) => {
            try {
              ctx.fillStyle = ti.color;
              ctx.fill(new Path2D(ti.d));
            } catch {
              // ignore
            }
          });
          treeSkeleton.accentLeaves.forEach((lf) => {
            ctx.save();
            ctx.translate(lf.cx, lf.cy);
            ctx.rotate((lf.angleDeg * Math.PI) / 180);
            ctx.shadowColor = 'rgba(0,0,0,0.24)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetY = 2;
            ctx.beginPath();
            ctx.moveTo(0, -lf.h * 0.5);
            ctx.bezierCurveTo(lf.w * 0.5, -lf.h * 0.2, lf.w * 0.5, lf.h * 0.25, 0, lf.h * 0.5);
            ctx.bezierCurveTo(-lf.w * 0.5, lf.h * 0.25, -lf.w * 0.5, -lf.h * 0.2, 0, -lf.h * 0.5);
            ctx.closePath();
            ctx.fillStyle = lf.fill;
            ctx.fill();
            ctx.strokeStyle = lf.stroke;
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
          });
          treeSkeleton.arrowChevrons.forEach((ac) => {
            ctx.save();
            ctx.translate(ac.x, ac.y);
            ctx.rotate((ac.angleDeg * Math.PI) / 180);
            ctx.beginPath();
            ctx.moveTo(ac.size * 0.65, 0);
            ctx.lineTo(-ac.size * 0.55, -ac.size * 0.48);
            ctx.lineTo(-ac.size * 0.25, 0);
            ctx.lineTo(-ac.size * 0.55, ac.size * 0.48);
            ctx.closePath();
            ctx.fillStyle = ac.color;
            ctx.fill();
            ctx.restore();
          });
        }

        // 0B. Pembatas Warna Celah Terhubung Sarang Lebah & Aura Kolam Teratai
        if (lineageHulls && lineageHulls.length > 0) {
          lineageHulls.forEach((hull) => {
            try {
              const p = new Path2D(hull.d);
              ctx.save();
              if (hull.fill && hull.fill !== 'none') {
                ctx.fillStyle = hull.fill;
                ctx.fill(p);
              }
              ctx.strokeStyle = hull.stroke;
              ctx.lineWidth = hull.strokeWidth;
              if (hull.dash) {
                const parts = hull.dash
                  .split(/\s+/)
                  .map((v) => Number(v))
                  .filter((v) => !Number.isNaN(v) && v > 0);
                if (parts.length > 0) ctx.setLineDash(parts);
              }
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.stroke(p);
              ctx.restore();
            } catch {
              // ignore invalid path
            }
          });
        }

        if (lotusHalos && lotusHalos.length > 0) {
          lotusHalos.forEach((halo) => {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(halo.cx, halo.cy, halo.rx, halo.ry, 0, 0, Math.PI * 2);
            if (halo.fill && halo.fill !== 'none' && halo.fill !== 'transparent') {
              ctx.fillStyle = halo.fill;
              ctx.fill();
            }
            ctx.strokeStyle = halo.stroke;
            ctx.lineWidth = halo.strokeWidth ?? 1.4;
            if (!halo.solid) ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
          });
        }

        // 1. Garis Konektor
        if (lineStyle !== 'none') {
          ctx.lineCap = 'round';
          ctx.lineJoin = lineStyle === 'pcb90' ? 'miter' : 'round';
          computedEdges.forEach((ce) => {
            try {
              ctx.save();
              if (ce.taperedPathD && ce.edge.type !== 'couple') {
                const taperPath = new Path2D(ce.taperedPathD);
                if (ce.canUseGrad) {
                  const grad = ctx.createLinearGradient(
                    ce.pts.a.x,
                    ce.pts.a.y,
                    ce.pts.b.x,
                    ce.pts.b.y
                  );
                  grad.addColorStop(0, ce.gradFrom);
                  grad.addColorStop(1, ce.gradTo);
                  ctx.fillStyle = grad;
                } else {
                  ctx.fillStyle = ce.lineColor;
                }
                ctx.fill(taperPath);
              } else {
                const p2d = new Path2D(ce.route.d);
                ctx.strokeStyle = ce.lineColor;
                const isSiblingEdge = ce.edgeKind === 'sibling';
                ctx.lineWidth =
                  ce.strokeWidth ??
                  (isSiblingEdge
                    ? Math.max(1.3, lineThickness * 0.85)
                    : Math.max(1.5, lineThickness));
                if (ce.edge.type === 'couple') {
                  ctx.setLineDash([6, 4]);
                }
                ctx.stroke(p2d);
              }
              if (ce.arrowMeta) {
                const am = ce.arrowMeta;
                ctx.save();
                ctx.translate(am.tipX, am.tipY);
                ctx.rotate(am.angleRad);
                ctx.beginPath();
                const hw = am.kind === 'sibling' ? am.size * 0.48 : am.size * 0.56;
                const notch = am.kind === 'sibling' ? am.size * 0.58 : am.size * 0.72;
                ctx.moveTo(0, 0);
                ctx.lineTo(-am.size, -hw);
                ctx.lineTo(-notch, 0);
                ctx.lineTo(-am.size, hw);
                ctx.closePath();
                ctx.fillStyle = am.color;
                ctx.fill();
                ctx.restore();
              }
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

        const drawCoverPhotoInActiveClip = (
          url: string,
          bx: number,
          by: number,
          bw: number,
          bh: number,
          alt: string,
          bgTopCol: string,
          nameStr: string,
          fontPx: number,
          padBottomRatio = 0.1
        ) => {
          const grdBg = ctx.createRadialGradient(
            bx + bw * 0.5,
            by + bh * 0.35,
            2,
            bx + bw * 0.5,
            by + bh * 0.5,
            Math.max(bw, bh) * 0.72
          );
          grdBg.addColorStop(0, bgTopCol || '#1e293b');
          grdBg.addColorStop(1, '#020617');
          ctx.fillStyle = grdBg;
          ctx.fillRect(bx, by, bw, bh);

          let drewPhoto = false;
          if (url) {
            const cached = imgCacheRef.current.get(url);
            if (cached && cached !== 'loading' && cached !== 'error') {
              try {
                const iw = cached.naturalWidth || cached.width || bw;
                const ih = cached.naturalHeight || cached.height || bh;
                const imgAspect = iw / Math.max(1, ih);
                const boxAspect = bw / Math.max(1, bh);
                let sx = 0;
                let sy = 0;
                let sw = iw;
                let sh = ih;
                if (imgAspect > boxAspect) {
                  sw = ih * boxAspect;
                  sx = (iw - sw) * 0.5;
                } else {
                  sh = iw / Math.max(0.01, boxAspect);
                  sy = (ih - sh) * 0.22;
                }
                ctx.drawImage(cached, sx, sy, sw, sh, bx, by, bw, bh);
                drewPhoto = true;
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
              };
              img.onerror = () => {
                imgCacheRef.current.set(url, 'error');
              };
              img.src = url;
            }
          }

          if (!drewPhoto) {
            ctx.fillStyle = '#fcd34d';
            ctx.font = `900 ${Math.max(10, Math.round(Math.min(bw, bh) * 0.28))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(getInitials(alt), bx + bw / 2, by + bh * 0.42);
          }

          // Scrim gelap bawah + Nama menyatu di dalam bentuk
          const scrimTop = by + bh * 0.54;
          const scrimGrad = ctx.createLinearGradient(0, scrimTop, 0, by + bh);
          scrimGrad.addColorStop(0, 'rgba(2, 6, 23, 0)');
          scrimGrad.addColorStop(0.45, 'rgba(2, 6, 23, 0.78)');
          scrimGrad.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
          ctx.fillStyle = scrimGrad;
          ctx.fillRect(bx, scrimTop, bw, by + bh - scrimTop);

          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${fontPx}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(
            nameStr,
            bx + bw / 2,
            by + bh - Math.max(3, Math.round(bh * padBottomRatio)),
            bw * 0.78
          );
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

          const useLeafFrame =
            !isModular &&
            (cardFrameMode === 'leaf' ||
              (cardFrameMode === 'auto' && node.cardShape === 'leaf'));
          const useHexFrame =
            !isModular &&
            !useLeafFrame &&
            (cardFrameMode === 'hex' ||
              (cardFrameMode === 'auto' && node.cardShape === 'hex'));
          const usePetalFrame =
            !isModular &&
            !useLeafFrame &&
            !useHexFrame &&
            (cardFrameMode === 'petal' ||
              (cardFrameMode === 'auto' && node.cardShape === 'petal'));

          ctx.save();
          if (useLeafFrame) {
            const cx = node.x + size.w / 2;
            const cy = node.y + size.h / 2;
            const leafW = size.w * 1.28;
            const leafH = size.h * 1.28;
            const angleRad = ((node.leafAngleDeg ?? 0) * Math.PI) / 180;
            const resolvedLeafTone: 'dark' | 'medium' | 'light' =
              node.leafTone === 'dark' ||
              node.leafTone === 'medium' ||
              node.leafTone === 'light'
                ? node.leafTone
                : (node.genLevel ?? 0) <= 2
                ? 'dark'
                : (node.genLevel ?? 0) === 3
                ? 'medium'
                : 'light';
            const leafFillCol =
              effectiveBg ||
              (resolvedLeafTone === 'dark'
                ? '#14532d'
                : resolvedLeafTone === 'medium'
                ? '#16a34a'
                : '#84cc16');
            const leafStrokeDefault =
              effectiveBorder ||
              (resolvedLeafTone === 'dark'
                ? '#4ade80'
                : resolvedLeafTone === 'medium'
                ? '#86efac'
                : '#d9f99d');
            const leafVeinStroke =
              resolvedLeafTone === 'dark'
                ? '#86efac'
                : resolvedLeafTone === 'medium'
                ? '#bbf7d0'
                : '#ecfccb';

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angleRad);
            ctx.shadowColor = 'rgba(0,0,0,0.32)';
            ctx.shadowBlur = 7;
            ctx.shadowOffsetY = 3;
            // Bentuk daun botani organik simetris (puncak lancip halus, pangkal membulat bertangkai)
            ctx.beginPath();
            ctx.moveTo(0, -leafH * 0.56);
            ctx.bezierCurveTo(
              leafW * 0.44,
              -leafH * 0.3,
              leafW * 0.56,
              leafH * 0.14,
              leafW * 0.24,
              leafH * 0.44
            );
            ctx.quadraticCurveTo(leafW * 0.1, leafH * 0.52, 0, leafH * 0.52);
            ctx.quadraticCurveTo(-leafW * 0.1, leafH * 0.52, -leafW * 0.24, leafH * 0.44);
            ctx.bezierCurveTo(
              -leafW * 0.56,
              leafH * 0.14,
              -leafW * 0.44,
              -leafH * 0.3,
              0,
              -leafH * 0.56
            );
            ctx.closePath();
            ctx.fillStyle = leafFillCol;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = selectedSet.has(node.id) ? 3.2 : 1.8;
            ctx.strokeStyle = selectedSet.has(node.id)
              ? '#f59e0b'
              : leafStrokeDefault;
            ctx.stroke();

            // Tangkai & tulang daun tengah melengkung halus
            ctx.beginPath();
            ctx.moveTo(-leafW * 0.02, leafH * 0.6);
            ctx.quadraticCurveTo(0, leafH * 0.55, 0, leafH * 0.52);
            ctx.quadraticCurveTo(leafW * 0.02, 0, 0, -leafH * 0.45);
            ctx.strokeStyle = leafVeinStroke;
            ctx.lineWidth = 1.4;
            ctx.stroke();
            ctx.restore();

            if (cardDisplayMode === 'name_only') {
              ctx.fillStyle = 'rgba(12, 10, 9, 0.88)';
              drawCardRoundedRect(
                node.x + 2,
                node.y + size.h / 2 - 12,
                size.w - 4,
                24,
                6
              );
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.font = `800 ${Math.max(8, Math.round(10.5 * effScale))}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(node.name, cx, node.y + size.h / 2, size.w - 10);
            } else if (cardDisplayMode === 'photo_name_unified') {
              ctx.save();
              drawCardRoundedRect(node.x + 2, node.y + 2, size.w - 4, size.h - 4, 10);
              ctx.clip();
              drawCoverPhotoInActiveClip(
                node.photo,
                node.x + 2,
                node.y + 2,
                size.w - 4,
                size.h - 4,
                node.name,
                leafFillCol,
                node.name,
                Math.max(6.5, Math.min(11.5, Math.round(9 * effScale))),
                0.08
              );
              ctx.restore();
              ctx.strokeStyle = leafStrokeDefault;
              ctx.lineWidth = 1.4;
              drawCardRoundedRect(node.x + 2, node.y + 2, size.w - 4, size.h - 4, 10);
              ctx.stroke();
            } else {
              // Pas foto tetap tegak 0° dan terpisah dari bingkai daun!
              const pDim = getScaledPhotoDim(photoFrameSize, effScale);
              const px = node.x + (size.w - pDim.w) / 2;
              const py = node.y + 3;
              loadAndDrawPhoto(
                node.photo,
                px,
                py,
                pDim.w,
                pDim.h,
                node.name,
                false
              );

              // Badge nama terpisah tegak 0° berdekatan di bawah foto
              const badgeY = py + pDim.h + 2;
              const badgeH = Math.max(15, size.h - (pDim.h + 8));
              ctx.fillStyle = isDark
                ? 'rgba(12, 10, 9, 0.9)'
                : 'rgba(255, 255, 255, 0.94)';
              drawCardRoundedRect(node.x + 2, badgeY, size.w - 4, badgeH, 6);
              ctx.fill();
              ctx.strokeStyle = leafStrokeDefault;
              ctx.lineWidth = 1;
              ctx.stroke();

              ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
              ctx.font = `800 ${Math.max(7.5, Math.round(9.5 * effScale))}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(node.name, cx, badgeY + 2, size.w - 10);

              if (cardDisplayMode === 'full' && node.sub) {
                ctx.fillStyle = isDark ? '#d9f99d' : '#166534';
                ctx.font = `600 ${Math.max(6.5, Math.round(8 * effScale))}px sans-serif`;
                ctx.fillText(
                  node.sub,
                  cx,
                  badgeY + Math.max(11, Math.round(12 * effScale)),
                  size.w - 10
                );
              }
            }
            ctx.restore();
            return;
          }

          if (useHexFrame) {
            const cx = node.x + size.w / 2;
            const cy = node.y + size.h / 2;
            const hw = size.w * 0.5;
            const hh = size.h * 0.5;
            const hexBorderCol = selectedSet.has(node.id)
              ? '#f59e0b'
              : effectiveBorder || (isDark ? '#38bdf8' : '#0284c7');

            const buildHexPath = (rx: number, ry: number) => {
              ctx.beginPath();
              ctx.moveTo(cx, cy - ry);
              ctx.lineTo(cx + rx, cy - ry * 0.5);
              ctx.lineTo(cx + rx, cy + ry * 0.5);
              ctx.lineTo(cx, cy + ry);
              ctx.lineTo(cx - rx, cy + ry * 0.5);
              ctx.lineTo(cx - rx, cy - ry * 0.5);
              ctx.closePath();
            };

            ctx.save();
            ctx.shadowColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(15,23,42,0.12)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetY = 2;
            buildHexPath(hw, hh);
            ctx.fillStyle = fillCol;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = selectedSet.has(node.id)
              ? 3.2
              : (node.genLevel ?? 0) === 0
              ? 2.8
              : 2.1;
            if (node.wafat) ctx.setLineDash([5, 3]);
            ctx.strokeStyle = hexBorderCol;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            if (cardDisplayMode === 'name_only') {
              ctx.fillStyle = isDark
                ? 'rgba(2, 6, 23, 0.92)'
                : 'rgba(255, 255, 255, 0.96)';
              drawCardRoundedRect(
                node.x + 2,
                cy - 11,
                size.w - 4,
                22,
                11
              );
              ctx.fill();
              ctx.strokeStyle = hexBorderCol;
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
              ctx.font = `800 ${Math.max(8, Math.round(10 * effScale))}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(node.name, cx, cy, size.w - 10);
            } else if (cardDisplayMode === 'photo_name_unified') {
              const innerHw = Math.max(18, size.w * 0.465);
              const innerHh = Math.max(20, size.h * 0.465);
              ctx.save();
              buildHexPath(innerHw, innerHh);
              ctx.clip();
              drawCoverPhotoInActiveClip(
                node.photo,
                cx - innerHw,
                cy - innerHh,
                innerHw * 2,
                innerHh * 2,
                node.name,
                fillCol,
                node.name,
                Math.max(6.5, Math.min(11.5, Math.round(9 * effScale))),
                0.13
              );
              ctx.restore();
            } else {
              const pDim = getScaledPhotoDim(photoFrameSize, effScale);
              const px = node.x + (size.w - pDim.w) / 2;
              const py = node.y + 3;
              loadAndDrawPhoto(
                node.photo,
                px,
                py,
                pDim.w,
                pDim.h,
                node.name,
                isCardLight
              );

              const badgeY = py + pDim.h + 2;
              const badgeH = Math.max(13, size.h - (pDim.h + 8));
              ctx.fillStyle = isDark
                ? 'rgba(2, 6, 23, 0.92)'
                : 'rgba(255, 255, 255, 0.96)';
              drawCardRoundedRect(node.x + 2, badgeY, size.w - 4, badgeH, 8);
              ctx.fill();
              ctx.strokeStyle = hexBorderCol;
              ctx.lineWidth = 1;
              ctx.stroke();

              ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
              ctx.font = `800 ${Math.max(7.5, Math.round(9.5 * effScale))}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(node.name, cx, badgeY + 2, size.w - 10);

              if (cardDisplayMode === 'full' && node.sub) {
                ctx.fillStyle = isDark ? '#bae6fd' : '#0369a1';
                ctx.font = `600 ${Math.max(6.5, Math.round(8 * effScale))}px sans-serif`;
                ctx.fillText(
                  node.sub,
                  cx,
                  badgeY + Math.max(11, Math.round(12 * effScale)),
                  size.w - 10
                );
              }
            }
            ctx.restore();
            return;
          }

          if (usePetalFrame) {
            const cx = node.x + size.w / 2;
            const cy = node.y + size.h / 2;
            const pGen = node.genLevel ?? 0;
            const isFlowerCenter =
              node.lotusRole === 'flower_center' ||
              (pGen <= 2 &&
                node.lotusRole !== 'petal_inner' &&
                node.lotusRole !== 'petal_outer');
            const petalW = size.w * 1.32;
            const petalH = size.h * 1.32;
            const angleRad = ((node.leafAngleDeg ?? 0) * Math.PI) / 180;
            const petalFillCol =
              effectiveBg ||
              (pGen === 0
                ? '#78350f'
                : pGen === 1
                ? '#9d174d'
                : pGen === 2
                ? '#db2777'
                : pGen === 3
                ? '#f472b6'
                : '#fbcfe8');
            const petalStrokeCol = selectedSet.has(node.id)
              ? '#f59e0b'
              : effectiveBorder ||
                (pGen === 0 ? '#fbbf24' : pGen <= 3 ? '#f9a8d4' : '#db2777');

            ctx.save();
            ctx.translate(cx, cy);
            ctx.shadowColor = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(15,23,42,0.14)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 2;

            if (isFlowerCenter) {
              const r = Math.max(size.w, size.h) * (pGen === 0 ? 0.65 : 0.61);
              const outerRingCol = petalStrokeCol;
              const innerCoreFill = isCardLight ? '#ffffff' : petalFillCol;
              ctx.beginPath();
              for (let k = 0; k < 28; k++) {
                const a = (k * Math.PI * 2) / 28 - Math.PI / 2;
                const rad = k % 2 === 0 ? r * 1.08 : r * 0.82;
                const px = Math.cos(a) * rad;
                const py = Math.sin(a) * rad;
                if (k === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              ctx.fillStyle = isCardLight ? hexWithAlpha(outerRingCol, 0.24) : petalFillCol;
              ctx.fill();
              ctx.shadowBlur = 0;
              ctx.lineWidth = selectedSet.has(node.id) ? 3.2 : 2.1;
              ctx.strokeStyle = outerRingCol;
              ctx.stroke();

              // Inti lingkaran bersih bunga teratai
              ctx.beginPath();
              ctx.arc(0, 0, Math.min(size.w, size.h) * 0.48, 0, Math.PI * 2);
              ctx.fillStyle = innerCoreFill;
              ctx.fill();
              ctx.strokeStyle = outerRingCol;
              ctx.lineWidth = 1.4;
              ctx.stroke();
            } else {
              // Daun / Kelopak Bulat Teratai (G4 hijau zamrud & G5 hijau muda)
              const rx = Math.max(size.w, size.h) * 0.51;
              ctx.beginPath();
              ctx.arc(0, 0, rx, 0, Math.PI * 2);
              ctx.fillStyle = petalFillCol;
              ctx.fill();
              ctx.shadowBlur = 0;
              ctx.lineWidth = selectedSet.has(node.id) ? 3.0 : 1.9;
              if (node.wafat) ctx.setLineDash([5, 3]);
              ctx.strokeStyle = petalStrokeCol;
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.beginPath();
              ctx.arc(0, 0, rx * 0.86, 0, Math.PI * 2);
              ctx.strokeStyle = isCardLight ? 'rgba(6,78,59,0.22)' : 'rgba(255,255,255,0.28)';
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            ctx.restore();

            if (cardDisplayMode === 'name_only') {
              ctx.fillStyle = isDark
                ? 'rgba(76, 5, 25, 0.92)'
                : 'rgba(255, 255, 255, 0.96)';
              drawCardRoundedRect(node.x + 2, cy - 11, size.w - 4, 22, 11);
              ctx.fill();
              ctx.strokeStyle = petalStrokeCol;
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
              ctx.font = `800 ${Math.max(8, Math.round(10 * effScale))}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(node.name, cx, cy, size.w - 10);
            } else if (cardDisplayMode === 'photo_name_unified') {
              const rx = Math.max(17, (size.w - 6) * 0.5);
              const ry = Math.max(17, (size.h - 6) * 0.5);
              ctx.save();
              ctx.beginPath();
              if (isFlowerCenter) {
                ctx.arc(cx, cy, Math.min(rx, ry), 0, Math.PI * 2);
              } else {
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
              }
              ctx.closePath();
              ctx.clip();
              drawCoverPhotoInActiveClip(
                node.photo,
                cx - rx,
                cy - ry,
                rx * 2,
                ry * 2,
                node.name,
                petalFillCol,
                node.name,
                Math.max(6.5, Math.min(11.5, Math.round(9 * effScale))),
                0.11
              );
              ctx.restore();
              ctx.beginPath();
              if (isFlowerCenter) {
                ctx.arc(cx, cy, Math.min(rx, ry), 0, Math.PI * 2);
              } else {
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
              }
              ctx.strokeStyle = petalStrokeCol;
              ctx.lineWidth = 1.4;
              ctx.stroke();
            } else {
              const pDim = getScaledPhotoDim(photoFrameSize, effScale);
              const px = node.x + (size.w - pDim.w) / 2;
              const py = node.y + 3;
              loadAndDrawPhoto(
                node.photo,
                px,
                py,
                pDim.w,
                pDim.h,
                node.name,
                isCardLight
              );

              const badgeY = py + pDim.h + 2;
              const badgeH = Math.max(13, size.h - (pDim.h + 8));
              ctx.fillStyle = isDark
                ? 'rgba(76, 5, 25, 0.92)'
                : 'rgba(255, 255, 255, 0.96)';
              drawCardRoundedRect(node.x + 2, badgeY, size.w - 4, badgeH, 8);
              ctx.fill();
              ctx.strokeStyle = petalStrokeCol;
              ctx.lineWidth = 1;
              ctx.stroke();

              ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
              ctx.font = `800 ${Math.max(7.5, Math.round(9.5 * effScale))}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(node.name, cx, badgeY + 2, size.w - 10);

              if (cardDisplayMode === 'full' && node.sub) {
                ctx.fillStyle = isDark ? '#fbcfe8' : '#9d174d';
                ctx.font = `600 ${Math.max(6.5, Math.round(8 * effScale))}px sans-serif`;
                ctx.fillText(
                  node.sub,
                  cx,
                  badgeY + Math.max(11, Math.round(12 * effScale)),
                  size.w - 10
                );
              }
            }
            ctx.restore();
            return;
          }

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
          } else if (cardDisplayMode === 'photo_name_unified') {
            ctx.save();
            drawCardRoundedRect(node.x + 2, node.y + 2, size.w - 4, size.h - 4, 9);
            ctx.clip();
            drawCoverPhotoInActiveClip(
              node.photo,
              node.x + 2,
              node.y + 2,
              size.w - 4,
              size.h - 4,
              node.name,
              fillCol,
              node.name,
              Math.max(6.5, Math.min(11.5, Math.round(9 * effScale))),
              0.08
            );
            ctx.restore();
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
      treeSkeleton,
      lineageHulls,
      lotusHalos,
      selectedIds,
      lineStyle,
      lineThickness,
      cardDisplayMode,
      cardFrameMode,
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
