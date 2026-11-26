import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Grid3X3,
  Hexagon,
  Circle,
  RectangleVertical,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
  Move,
} from 'lucide-react';

export type CropGuideShape = 'circle' | 'rect_3x4' | 'hex';

export interface PhotoCropGuideModalProps {
  isOpen: boolean;
  file: File | null;
  defaultGuideShape?: CropGuideShape;
  title?: string;
  onCancel: () => void;
  onConfirm: (dataUrl: string, sizeInfo: { orig: number; comp: number }) => void;
}

const STAGE_W = 280;
const STAGE_H = 300;

function getBoxDimensions(shape: CropGuideShape): { w: number; h: number } {
  if (shape === 'rect_3x4') {
    return { w: 204, h: 272 }; // Exact 3:4 portrait aspect ratio
  }
  return { w: 236, h: 236 };
}

function getHexagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 90); // Pointy-top hexagon
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export const PhotoCropGuideModal: React.FC<PhotoCropGuideModalProps> = ({
  isOpen,
  file,
  defaultGuideShape = 'circle',
  title = 'Atur Tata Letak & Potong Foto',
  onCancel,
  onConfirm,
}) => {
  const [shape, setShape] = useState<CropGuideShape>(defaultGuideShape);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageSrc, setImageSrc] = useState<string>('');
  const [naturalDim, setNaturalDim] = useState<{ w: number; h: number } | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShape(defaultGuideShape);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setNaturalDim(null);
    }
  }, [isOpen, defaultGuideShape, file]);

  useEffect(() => {
    if (!isOpen || !file) {
      setImageSrc('');
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setImageSrc(objUrl);
    return () => {
      URL.revokeObjectURL(objUrl);
    };
  }, [isOpen, file]);

  const box = useMemo(() => getBoxDimensions(shape), [shape]);
  const boxLeft = (STAGE_W - box.w) / 2;
  const boxTop = (STAGE_H - box.h) / 2;

  const baseScale = useMemo(() => {
    if (!naturalDim || naturalDim.w <= 0 || naturalDim.h <= 0) return 1;
    return Math.max(box.w / naturalDim.w, box.h / naturalDim.h);
  }, [naturalDim, box.w, box.h]);

  const effectiveScale = baseScale * zoom;
  const drawnW = (naturalDim?.w || box.w) * effectiveScale;
  const drawnH = (naturalDim?.h || box.h) * effectiveScale;

  const clampPan = (px: number, py: number, scaleVal = zoom) => {
    if (!naturalDim) return { x: 0, y: 0 };
    const sc = baseScale * scaleVal;
    const dw = naturalDim.w * sc;
    const dh = naturalDim.h * sc;
    const maxOffsetX = Math.max(0, (dw - box.w) / 2);
    const maxOffsetY = Math.max(0, (dh - box.h) / 2);
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, px)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, py)),
    };
  };

  useEffect(() => {
    setPan((prev) => clampPan(prev.x, prev.y, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, shape, naturalDim?.w, naturalDim?.h]);

  if (!isOpen || !file) return null;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    imgRef.current = el;
    setNaturalDim({
      w: el.naturalWidth || el.width || 1,
      h: el.naturalHeight || el.height || 1,
    });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalDim) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current?.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan(clampPan(dragRef.current.origPanX + dx, dragRef.current.origPanY + dy));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      dragRef.current = null;
    }
  };

  const handleConfirmCrop = () => {
    const imgEl = imgRef.current;
    if (!imgEl || !naturalDim || !file) return;
    setIsExporting(true);

    try {
      const outW = shape === 'rect_3x4' ? 320 : 400;
      const outH = shape === 'rect_3x4' ? 426 : 400;
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsExporting(false);
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Map box area onto natural image coordinates
      const imgCenterX = STAGE_W / 2 + pan.x;
      const imgCenterY = STAGE_H / 2 + pan.y;
      const imgLeft = imgCenterX - drawnW / 2;
      const imgTop = imgCenterY - drawnH / 2;

      const srcX = Math.max(0, (boxLeft - imgLeft) / effectiveScale);
      const srcY = Math.max(0, (boxTop - imgTop) / effectiveScale);
      const srcW = Math.min(naturalDim.w - srcX, box.w / effectiveScale);
      const srcH = Math.min(naturalDim.h - srcY, box.h / effectiveScale);

      ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, outW, outH);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const origKb = Math.max(1, Math.round(file.size / 1024));
      const base64Body = dataUrl.split(',')[1] || '';
      const compKb = Math.max(1, Math.round((base64Body.length * 3) / 4 / 1024));

      onConfirm(dataUrl, { orig: origKb, comp: compKb });
    } finally {
      setIsExporting(false);
    }
  };

  const maskUid = 'photo_crop_guide_mask';
  const stageCx = STAGE_W / 2;
  const stageCy = STAGE_H / 2;
  const hexRadius = Math.min(box.w, box.h) / 2;
  const hexPoints = getHexagonPoints(stageCx, stageCy, hexRadius);

  return (
    <div className="fixed inset-0 z-[95] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-stone-200 text-stone-800 space-y-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-stone-900">{title}</h3>
            <p className="text-[11px] text-stone-500 leading-snug">
              Geser &amp; perbesar foto agar wajah pas di dalam garis panduan bingkai kartu.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 bg-stone-100 transition shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pilih Bentuk Panduan Bingkai */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-stone-100 border border-stone-200">
            <button
              type="button"
              onClick={() => setShape('circle')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                shape === 'circle'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Circle className="w-3 h-3" />
              <span>Bulat</span>
            </button>
            <button
              type="button"
              onClick={() => setShape('rect_3x4')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                shape === 'rect_3x4'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <RectangleVertical className="w-3 h-3" />
              <span>Kotak 3×4</span>
            </button>
            <button
              type="button"
              onClick={() => setShape('hex')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                shape === 'hex'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Hexagon className="w-3 h-3" />
              <span>Heksagon</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGuides((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition ${
              showGuides
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-stone-50 border-stone-200 text-stone-500'
            }`}
            title="Aktif/nonaktifkan garis bantu tata letak"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Garis Bantu</span>
          </button>
        </div>

        {/* Interactive Crop Stage */}
        <div className="flex justify-center">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: STAGE_W, height: STAGE_H }}
            className="relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-stone-300 shadow-inner cursor-grab active:cursor-grabbing touch-none select-none"
          >
            {imageSrc && (
              <img
                src={imageSrc}
                alt="Crop preview"
                onLoad={handleImageLoad}
                draggable={false}
                style={{
                  width: drawnW,
                  height: drawnH,
                  left: STAGE_W / 2 + pan.x - drawnW / 2,
                  top: STAGE_H / 2 + pan.y - drawnH / 2,
                }}
                className="absolute max-w-none max-h-none pointer-events-none select-none"
              />
            )}

            {/* SVG Mask + Garis Tata Letak Overlay */}
            <svg
              width={STAGE_W}
              height={STAGE_H}
              viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
              className="absolute inset-0 pointer-events-none"
            >
              <defs>
                <mask id={maskUid}>
                  <rect x="0" y="0" width={STAGE_W} height={STAGE_H} fill="white" />
                  {shape === 'circle' && (
                    <circle cx={stageCx} cy={stageCy} r={box.w / 2} fill="black" />
                  )}
                  {shape === 'rect_3x4' && (
                    <rect
                      x={boxLeft}
                      y={boxTop}
                      width={box.w}
                      height={box.h}
                      rx={14}
                      fill="black"
                    />
                  )}
                  {shape === 'hex' && <polygon points={hexPoints} fill="black" />}
                </mask>
              </defs>

              {/* Darkened outside area */}
              <rect
                x="0"
                y="0"
                width={STAGE_W}
                height={STAGE_H}
                fill="rgba(15, 23, 42, 0.66)"
                mask={`url(#${maskUid})`}
              />

              {/* Garis Panduan Tata Letak (Grid 3x3, Crosshair, & Siluet Kepala-Bahu) */}
              {showGuides && (
                <g>
                  {/* 3x3 Rule-of-Thirds Grid inside crop box */}
                  {[1 / 3, 2 / 3].map((f, idx) => (
                    <React.Fragment key={idx}>
                      <line
                        x1={boxLeft + box.w * f}
                        y1={boxTop + 4}
                        x2={boxLeft + box.w * f}
                        y2={boxTop + box.h - 4}
                        stroke="rgba(255,255,255,0.42)"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                      <line
                        x1={boxLeft + 4}
                        y1={boxTop + box.h * f}
                        x2={boxLeft + box.w - 4}
                        y2={boxTop + box.h * f}
                        stroke="rgba(255,255,255,0.42)"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                    </React.Fragment>
                  ))}

                  {/* Center Crosshair (+) */}
                  <line
                    x1={stageCx - 14}
                    y1={stageCy}
                    x2={stageCx + 14}
                    y2={stageCy}
                    stroke="rgba(251,191,36,0.9)"
                    strokeWidth={1.3}
                  />
                  <line
                    x1={stageCx}
                    y1={stageCy - 14}
                    x2={stageCx}
                    y2={stageCy + 14}
                    stroke="rgba(251,191,36,0.9)"
                    strokeWidth={1.3}
                  />

                  {/* Subtle Oval Head & Shoulder Guide */}
                  <ellipse
                    cx={stageCx}
                    cy={boxTop + box.h * 0.37}
                    rx={box.w * 0.22}
                    ry={box.h * 0.24}
                    fill="none"
                    stroke="rgba(110, 231, 183, 0.78)"
                    strokeWidth={1.4}
                    strokeDasharray="5 4"
                  />
                  <path
                    d={`M ${stageCx - box.w * 0.36} ${boxTop + box.h * 0.92} Q ${stageCx} ${
                      boxTop + box.h * 0.62
                    } ${stageCx + box.w * 0.36} ${boxTop + box.h * 0.92}`}
                    fill="none"
                    stroke="rgba(110, 231, 183, 0.62)"
                    strokeWidth={1.3}
                    strokeDasharray="5 4"
                  />
                </g>
              )}

              {/* Crisp Frame Outline */}
              {shape === 'circle' && (
                <circle
                  cx={stageCx}
                  cy={stageCy}
                  r={box.w / 2}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={2}
                />
              )}
              {shape === 'rect_3x4' && (
                <rect
                  x={boxLeft}
                  y={boxTop}
                  width={box.w}
                  height={box.h}
                  rx={14}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={2}
                />
              )}
              {shape === 'hex' && (
                <polygon
                  points={hexPoints}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={2}
                />
              )}
            </svg>

            {/* Bottom drag hint badge */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-950/75 text-white/90 text-[10px] font-semibold flex items-center gap-1 pointer-events-none whitespace-nowrap">
              <Move className="w-3 h-3 text-amber-300" />
              <span>Geser foto untuk meluruskan posisi</span>
            </div>
          </div>
        </div>

        {/* Zoom Slider + Reset */}
        <div className="p-2.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.1).toFixed(2))))}
            className="p-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-700"
            title="Perkecil"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-emerald-700 h-1.5"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
            className="p-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-700"
            title="Perbesar"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-bold text-stone-600 w-10 text-right">
            {zoom.toFixed(1)}×
          </span>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-600"
            title="Reset posisi & zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!naturalDim || isExporting}
            onClick={handleConfirmCrop}
            className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition"
          >
            <Check className="w-4 h-4" />
            <span>{isExporting ? 'Memproses...' : 'Simpan & Pakai Foto'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
