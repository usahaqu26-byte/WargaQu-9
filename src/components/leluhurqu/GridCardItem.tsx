import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import type {
  CardDisplayMode,
  CardFrameMode,
  GenGradientPaletteId,
  GridLayoutMode,
  GridPhotoShape,
  InteractiveNode,
  MergedCardMember,
  PhotoFrameSize,
} from './InteractiveGridCanvasView';
import {
  computeModularContainerPlan,
  getUniformSubCardSize,
  ModularNuclearGroup,
} from './smartGridLayouts';
import {
  HEXAGON_CLIP_PATH,
  getGenGradientStyle,
  getInitials,
  getNodeSize,
  getScaledPhotoDim,
  hexWithAlpha,
  isLightHexColor,
} from './gridCanvasUtils';

export interface GridCardItemProps {
  node: InteractiveNode;
  isSelected: boolean;
  isConnectSource: boolean;
  isHolding: boolean;
  isUnlocked: boolean;
  cardDisplayMode: CardDisplayMode;
  cardFrameMode: CardFrameMode;
  photoFrameSize: PhotoFrameSize;
  photoShape: GridPhotoShape;
  cardScale: number;
  genGradientPalette: GenGradientPaletteId;
  cardBgColor: string;
  cardBorderColor: string;
  isDark: boolean;
  layoutMode: GridLayoutMode;
  safeHoldMove: boolean;
  isMultiSelectMode: boolean;
  showGenGuides: boolean;
  lodLite: boolean;
  exportPhotoMap: Record<string, string> | null;
  registerNodeEl: (id: string, el: HTMLDivElement | null) => void;
  onStartInteraction: (
    e: React.MouseEvent | React.TouchEvent,
    id: string
  ) => void;
}

const GridCardItemInner: React.FC<GridCardItemProps> = ({
  node,
  isSelected,
  isConnectSource,
  isHolding,
  isUnlocked,
  cardDisplayMode,
  cardFrameMode,
  photoFrameSize,
  photoShape,
  cardScale,
  genGradientPalette,
  cardBgColor,
  cardBorderColor,
  isDark,
  layoutMode,
  safeHoldMove,
  isMultiSelectMode,
  showGenGuides,
  lodLite,
  exportPhotoMap,
  registerNodeEl,
  onStartInteraction,
}) => {
  const holdFillRef = useRef<HTMLSpanElement | null>(null);

  // Animasi progres hold 2 detik langsung di DOM tanpa memicu React re-render per 50ms
  useEffect(() => {
    if (!isHolding || !holdFillRef.current) return;
    const bar = holdFillRef.current;
    bar.style.transition = 'none';
    bar.style.width = '6%';
    const raf = window.requestAnimationFrame(() => {
      if (!holdFillRef.current) return;
      holdFillRef.current.style.transition = 'width 1950ms linear';
      holdFillRef.current.style.width = '100%';
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isHolding]);

  const effScale = cardScale * (node.scaleMultiplier ?? 1);
  const size = getNodeSize(node, cardDisplayMode, photoFrameSize, cardScale);
  const isModularContainer = Boolean(
    node.mergedMembers && node.mergedMembers.length >= 2
  );
  const isModularUnitNode = Boolean(
    !isModularContainer &&
      (node.modularSubLayout === 'I' ||
        node.modularSubLayout === 'L' ||
        (node.scaleMultiplier ?? 1) > 1.05)
  );
  const uniformUnit = getUniformSubCardSize(
    cardDisplayMode,
    photoFrameSize,
    effScale
  );
  const pDim =
    isModularUnitNode &&
    (cardDisplayMode === 'photo_name' || cardDisplayMode === 'full')
      ? { w: uniformUnit.photoW, h: uniformUnit.photoH }
      : getScaledPhotoDim(photoFrameSize, effScale);
  const scaledNamePx = Math.max(7.5, Math.round(11.5 * effScale));

  const genStyle = getGenGradientStyle(genGradientPalette, node.genLevel ?? 0);
  const effectiveBg = node.customBgColor || cardBgColor || genStyle?.bg || '';
  const effectiveBorder =
    node.customBorderColor || cardBorderColor || genStyle?.border || '';
  const containerBg =
    isModularContainer && effectiveBg
      ? hexWithAlpha(effectiveBg, isDark ? 0.24 : 0.16)
      : effectiveBg;
  const isCardLight = containerBg
    ? effectiveBg && isModularContainer
      ? !isDark
      : isLightHexColor(effectiveBg)
    : !isDark;

  const resolvedShape: GridPhotoShape =
    photoFrameSize === 'bulat' ? 'bulat' : photoShape;

  const renderPhotoFrame = (
    photoUrl: string,
    altName: string,
    w: number,
    h: number,
    borderHex?: string,
    extraMarginClass = ''
  ) => {
    const frameBorderCol =
      borderHex || effectiveBorder || (isCardLight ? '#cbd5e1' : '#475569');
    const innerBgClass = isCardLight
      ? 'bg-stone-100 text-amber-700'
      : 'bg-[#0f172a] text-amber-400';

    const resolvedPhotoSrc =
      (photoUrl && exportPhotoMap?.[photoUrl]) || photoUrl;

    if (resolvedShape === 'segi6') {
      return (
        <div
          style={{
            width: `${w}px`,
            height: `${h}px`,
            clipPath: HEXAGON_CLIP_PATH,
            backgroundColor: frameBorderCol,
            padding: '2px',
          }}
          className={`shrink-0 flex items-center justify-center ${extraMarginClass}`}
        >
          <div
            style={{ clipPath: HEXAGON_CLIP_PATH }}
            className={`w-full h-full overflow-hidden flex items-center justify-center font-extrabold text-[10px] ${innerBgClass}`}
          >
            {resolvedPhotoSrc ? (
              <img
                src={resolvedPhotoSrc}
                alt={altName}
                decoding="async"
                className="w-full h-full object-cover pointer-events-none"
              />
            ) : (
              <span>{getInitials(altName)}</span>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          width: `${w}px`,
          height: `${h}px`,
          borderColor: frameBorderCol,
        }}
        className={`overflow-hidden flex items-center justify-center font-extrabold text-[10px] border shrink-0 ${innerBgClass} ${
          resolvedShape === 'bulat' ? 'rounded-full' : 'rounded-[5px]'
        } ${extraMarginClass}`}
      >
        {resolvedPhotoSrc ? (
          <img
            src={resolvedPhotoSrc}
            alt={altName}
            decoding="async"
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <span>{getInitials(altName)}</span>
        )}
      </div>
    );
  };

  const useLeafFrame =
    !isModularContainer &&
    (cardFrameMode === 'leaf' ||
      (cardFrameMode === 'auto' && node.cardShape === 'leaf'));
  const useHexFrame =
    !isModularContainer &&
    !useLeafFrame &&
    (cardFrameMode === 'hex' ||
      (cardFrameMode === 'auto' && node.cardShape === 'hex'));
  const usePetalFrame =
    !isModularContainer &&
    !useLeafFrame &&
    !useHexFrame &&
    (cardFrameMode === 'petal' ||
      (cardFrameMode === 'auto' && node.cardShape === 'petal'));
  const useSpecialFrame = useLeafFrame || useHexFrame || usePetalFrame;
  const leafAngleDeg = node.leafAngleDeg ?? 0;
  const resolvedLeafTone: 'dark' | 'medium' | 'light' =
    node.leafTone === 'dark' || node.leafTone === 'medium' || node.leafTone === 'light'
      ? node.leafTone
      : (node.genLevel ?? 0) <= 2
      ? 'dark'
      : (node.genLevel ?? 0) === 3
      ? 'medium'
      : 'light';
  const leafFillPrimary =
    resolvedLeafTone === 'dark'
      ? '#15803d'
      : resolvedLeafTone === 'medium'
      ? '#22c55e'
      : '#84cc16';
  const leafFillShade =
    resolvedLeafTone === 'dark'
      ? '#14532d'
      : resolvedLeafTone === 'medium'
      ? '#15803d'
      : '#65a30d';
  const leafStrokeCol = isUnlocked
    ? '#34d399'
    : isSelected
    ? '#f59e0b'
    : isConnectSource
    ? '#38bdf8'
    : resolvedLeafTone === 'dark'
    ? '#4ade80'
    : resolvedLeafTone === 'medium'
    ? '#86efac'
    : '#d9f99d';
  const leafVeinCol =
    resolvedLeafTone === 'dark'
      ? '#86efac'
      : resolvedLeafTone === 'medium'
      ? '#bbf7d0'
      : '#ecfccb';

  const hexStrokeCol = isUnlocked
    ? '#34d399'
    : isSelected
    ? '#f59e0b'
    : isConnectSource
    ? '#38bdf8'
    : effectiveBorder || (isDark ? '#38bdf8' : '#0284c7');
  const hexFillCol =
    effectiveBg || (isDark ? '#0f172a' : '#f8fafc');
  const hexIsCore = (node.genLevel ?? 0) === 0;

  const petalGen = node.genLevel ?? 0;
  const petalIsStamen = petalGen === 0;
  const petalFillPrimary =
    effectiveBg ||
    (petalGen === 0
      ? '#78350f'
      : petalGen === 1
      ? '#9d174d'
      : petalGen === 2
      ? '#db2777'
      : petalGen === 3
      ? '#f472b6'
      : '#fbcfe8');
  const petalFillShade =
    petalGen === 0
      ? '#451a03'
      : petalGen === 1
      ? '#831843'
      : petalGen === 2
      ? '#be185d'
      : petalGen === 3
      ? '#ec4899'
      : '#f9a8d4';
  const petalStrokeCol = isUnlocked
    ? '#34d399'
    : isSelected
    ? '#f59e0b'
    : isConnectSource
    ? '#38bdf8'
    : effectiveBorder ||
      (petalGen === 0
        ? '#fbbf24'
        : petalGen === 1
        ? '#f9a8d4'
        : petalGen <= 3
        ? '#fbcfe8'
        : '#db2777');
  const petalRibCol =
    petalGen === 0 ? '#fde68a' : petalGen <= 2 ? '#fce7f3' : '#be185d';

  const cardCustomStyle: React.CSSProperties = useSpecialFrame
    ? {
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${size.w}px`,
        minHeight: `${size.h}px`,
      }
    : {
        left: `${node.x}px`,
        top: `${node.y}px`,
        width: `${size.w}px`,
        ...(isModularUnitNode
          ? { height: `${size.h}px` }
          : { minHeight: `${size.h}px` }),
        ...(containerBg ? { backgroundColor: containerBg } : {}),
        ...(effectiveBorder && !isSelected && !isConnectSource && !isUnlocked
          ? { borderColor: effectiveBorder }
          : {}),
      };

  return (
    <div
      ref={(el) => registerNodeEl(node.id, el)}
      onMouseDown={(e) => onStartInteraction(e, node.id)}
      onTouchStart={(e) => onStartInteraction(e, node.id)}
      onClick={(e) => e.stopPropagation()}
      style={cardCustomStyle}
      className={`group absolute flex flex-col items-center justify-center text-center select-none ${
        useSpecialFrame
          ? 'overflow-visible bg-transparent border-0 p-[2px]'
          : `rounded-xl border-2 ${
              lodLite ? '' : 'shadow-lg transition-shadow'
            } ${
              cardDisplayMode === 'name_only'
                ? 'px-2 py-1'
                : isModularContainer
                ? 'p-1'
                : 'p-[3px]'
            }`
      } ${
        layoutMode === 'manual'
          ? isUnlocked || !safeHoldMove
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-pointer'
          : 'cursor-pointer'
      } ${
        useSpecialFrame
          ? isUnlocked || isSelected || isConnectSource
            ? 'z-40'
            : 'z-10 hover:brightness-105'
          : isUnlocked
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
        useLeafFrame
          ? 'text-white'
          : usePetalFrame
          ? isCardLight
            ? 'text-slate-900'
            : 'text-white'
          : useHexFrame
          ? isCardLight
            ? 'text-slate-900'
            : 'text-white'
          : isCardLight
          ? 'text-slate-900'
          : 'text-slate-100'
      } ${node.wafat && !useSpecialFrame ? 'border-dashed opacity-90' : ''}`}
      title={
        safeHoldMove && layoutMode === 'manual' && !isUnlocked
          ? `${node.name} • Tahan 2 detik atau pakai tombol Pindah di panel bawah`
          : node.name
      }
    >
      {/* Bingkai Daun Organik (Berputar segala arah • Foto & Badge di atasnya tetap tegak 0°) */}
      {useLeafFrame && (
        <div
          aria-hidden="true"
          style={{
            transform: `rotate(${leafAngleDeg}deg)`,
          }}
          className={`pointer-events-none absolute -inset-[16%] z-0 flex items-center justify-center ${
            node.wafat ? 'opacity-85' : ''
          }`}
        >
          <svg
            viewBox="0 0 120 150"
            preserveAspectRatio="none"
            className="w-full h-full drop-shadow-md overflow-visible"
          >
            {/* Belahan kiri daun */}
            <path
              d="M 60 6 C 12 42 10 104 60 144 Z"
              fill={leafFillPrimary}
            />
            {/* Belahan kanan daun (sedikit lebih gelap untuk kedalaman) */}
            <path
              d="M 60 6 C 108 42 110 104 60 144 Z"
              fill={leafFillShade}
            />
            {/* Garis tepi luar daun */}
            <path
              d="M 60 6 C 108 42 110 104 60 144 C 10 104 12 42 60 6 Z"
              fill="none"
              stroke={leafStrokeCol}
              strokeWidth={isSelected || isUnlocked ? 4.2 : 2.2}
              strokeDasharray={node.wafat ? '6 4' : undefined}
            />
            {/* Tulang daun tengah & urat samping halus */}
            <path
              d="M 60 148 L 60 22 M 60 106 L 34 84 M 60 88 L 86 68 M 60 68 L 36 50 M 60 50 L 82 36"
              fill="none"
              stroke={leafVeinCol}
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={0.72}
            />
          </svg>
        </div>
      )}

      {/* Bingkai Atom Segi Enam Molekul (Hexagon Atom + Cincin Orbital Halus) */}
      {useHexFrame && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-[5%] z-0 flex items-center justify-center ${
            node.wafat ? 'opacity-85' : ''
          }`}
        >
          <svg
            viewBox="0 0 120 132"
            preserveAspectRatio="none"
            className="w-full h-full drop-shadow-md overflow-visible"
          >
            <polygon
              points="60,3 114,34 114,98 60,129 6,98 6,34"
              fill={hexFillCol}
              stroke={hexStrokeCol}
              strokeWidth={
                isSelected || isUnlocked ? 4.2 : hexIsCore ? 3.4 : 2.2
              }
              strokeLinejoin="round"
              strokeDasharray={node.wafat ? '6 4' : undefined}
            />
            <polygon
              points="60,10 107,37 107,95 60,122 13,95 13,37"
              fill="none"
              stroke={hexStrokeCol}
              strokeWidth={hexIsCore ? 1.5 : 0.9}
              strokeDasharray="3 4"
              opacity={hexIsCore ? 0.65 : 0.35}
            />
          </svg>
        </div>
      )}

      {/* Bingkai Teratai Mekar: G1 Putik Emas Mahkota / G2+ Kelopak Teratai Mekar Memancar (Foto & Badge tetap 0°) */}
      {usePetalFrame && (
        <div
          aria-hidden="true"
          style={
            petalIsStamen
              ? undefined
              : {
                  transform: `rotate(${leafAngleDeg}deg)`,
                }
          }
          className={`pointer-events-none absolute ${
            petalIsStamen ? '-inset-[14%]' : '-inset-[17%]'
          } z-0 flex items-center justify-center ${
            node.wafat ? 'opacity-85' : ''
          }`}
        >
          {petalIsStamen ? (
            <svg
              viewBox="0 0 140 140"
              preserveAspectRatio="none"
              className="w-full h-full drop-shadow-lg overflow-visible"
            >
              {/* Mahkota Putik Emas Inti Teratai (12 ujung kelopak mini mengelilingi G1) */}
              <path
                d="M 70 4 C 77 16, 86 14, 96 10 C 97 22, 106 25, 117 26 C 112 37, 118 45, 130 50 C 120 58, 121 68, 134 75 C 121 82, 120 92, 130 100 C 118 105, 112 113, 117 124 C 106 125, 97 128, 96 136 C 86 130, 77 129, 70 138 C 63 129, 54 130, 44 136 C 43 128, 34 125, 23 124 C 28 113, 22 105, 10 100 C 20 92, 19 82, 6 75 C 19 68, 20 58, 10 50 C 22 45, 28 37, 23 26 C 34 25, 43 22, 44 10 C 54 14, 63 16, 70 4 Z"
                fill={petalFillPrimary}
                stroke={petalStrokeCol}
                strokeWidth={isSelected || isUnlocked ? 4 : 2.6}
                strokeLinejoin="round"
                strokeDasharray={node.wafat ? '6 4' : undefined}
              />
              <circle
                cx="70"
                cy="70"
                r="52"
                fill={petalFillShade}
                stroke={petalRibCol}
                strokeWidth={1.6}
                strokeDasharray="4 4"
                opacity={0.9}
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 120 156"
              preserveAspectRatio="none"
              className="w-full h-full drop-shadow-md overflow-visible"
            >
              {/* Belahan kiri kelopak teratai (pangkal melengkung lebar, ujung atas runcing mekar) */}
              <path
                d="M 60 5 C 14 44, 6 102, 34 140 C 44 150, 54 152, 60 151 Z"
                fill={petalFillPrimary}
              />
              {/* Belahan kanan kelopak untuk dimensi cahaya */}
              <path
                d="M 60 5 C 106 44, 114 102, 86 140 C 76 150, 66 152, 60 151 Z"
                fill={petalFillShade}
              />
              {/* Garis tepi luar kelopak teratai */}
              <path
                d="M 60 5 C 106 44, 114 102, 86 140 C 76 150, 66 152, 60 151 C 54 152, 44 150, 34 140 C 6 102, 14 44, 60 5 Z"
                fill="none"
                stroke={petalStrokeCol}
                strokeWidth={isSelected || isUnlocked ? 4.2 : 2.2}
                strokeDasharray={node.wafat ? '6 4' : undefined}
              />
              {/* Guratan urat kelopak teratai halus */}
              <path
                d="M 60 148 L 60 18 M 60 128 Q 34 94 42 46 M 60 128 Q 86 94 78 46"
                fill="none"
                stroke={petalRibCol}
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.58}
              />
            </svg>
          )}
        </div>
      )}
      {/* Indikator Progress Hold 2 Detik (CSS/DOM animation, 0 React re-render) */}
      {isHolding && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 px-2 py-0.5 rounded-full bg-slate-950/95 border border-emerald-400 text-[9px] font-black text-emerald-300 whitespace-nowrap shadow-lg flex items-center gap-1.5 pointer-events-none">
          <span className="inline-block w-10 h-1.5 rounded-full bg-slate-700 overflow-hidden">
            <span
              ref={holdFillRef}
              className="block h-full bg-emerald-400"
              style={{ width: '6%' }}
            />
          </span>
          <span>Tahan...</span>
        </div>
      )}

      {/* Badge Checklist Mode Pilih Banyak */}
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

      {/* Badge Mikro Generasi */}
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
      {!lodLite && (
        <>
          <span
            className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none transition-opacity ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          />
          <span
            className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none transition-opacity ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          />
          <span
            className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none transition-opacity ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          />
          <span
            className={`absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-500 pointer-events-none transition-opacity ${
              isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          />
        </>
      )}

      {node.mergedMembers && node.mergedMembers.length >= 2 ? (
        (() => {
          const mList = node.mergedMembers;
          const modLayout = node.modularSubLayout || 'grid';
          const plan = computeModularContainerPlan(
            mList.length,
            cardDisplayMode,
            photoFrameSize,
            effScale,
            node.mergedCols,
            modLayout,
            mList
          );
          const cellNamePx = Math.max(7, Math.round(9.5 * effScale));
          const cellSubPx = Math.max(6, Math.round(7.5 * effScale));
          const subPhotoW = plan.photoW;
          const subPhotoH = plan.photoH;

          const renderSubCard = (
            mm: MergedCardMember,
            mIdx: number,
            widthPx = plan.cellW,
            heightPx = plan.cellH
          ) => {
            const subGen = getGenGradientStyle(
              genGradientPalette,
              mm.genLevel ?? node.genLevel ?? 0
            );
            const subBg = mm.customBgColor || subGen?.bg || undefined;
            const subBorder =
              mm.customBorderColor || subGen?.border || undefined;
            const subIsLight = subBg ? isLightHexColor(subBg) : isCardLight;

            return (
              <div
                key={`${mm.originalNodeId}_${mIdx}`}
                style={{
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  ...(subBg ? { backgroundColor: subBg } : {}),
                  ...(subBorder ? { borderColor: subBorder } : {}),
                }}
                title={mm.sub ? `${mm.name} (${mm.sub})` : mm.name}
                className={`flex flex-col items-center justify-between rounded-lg border overflow-hidden shrink-0 p-[2px] ${
                  !subBg
                    ? isCardLight
                      ? 'bg-stone-100/90 border-stone-300/80'
                      : 'bg-slate-900/75 border-slate-700/80'
                    : ''
                } ${subIsLight ? 'text-slate-900' : 'text-slate-100'} ${
                  mm.wafat ? 'border-dashed opacity-90' : ''
                }`}
              >
                {cardDisplayMode !== 'name_only' &&
                  renderPhotoFrame(
                    mm.photo,
                    mm.name,
                    subPhotoW,
                    subPhotoH,
                    subBorder
                  )}

                {cardDisplayMode === 'photo_name' && (
                  <div
                    style={{
                      height: `${plan.badgeH}px`,
                      fontSize: `${cellNamePx}px`,
                    }}
                    className={`w-full rounded px-1 flex items-center justify-center font-extrabold leading-none truncate ${
                      subIsLight
                        ? 'bg-black/[0.07] text-slate-900'
                        : 'bg-black/30 text-white'
                    }`}
                  >
                    <span className="truncate">{mm.name}</span>
                  </div>
                )}

                {cardDisplayMode === 'name_only' && (
                  <div
                    style={{ fontSize: `${cellNamePx}px` }}
                    className="font-bold leading-tight text-center break-words whitespace-normal w-full my-auto"
                  >
                    {mm.gender && (
                      <span className="mr-0.5">
                        {mm.gender === 'P' ? '👩' : '👨'}
                      </span>
                    )}
                    {mm.name}
                  </div>
                )}

                {cardDisplayMode === 'full' && (
                  <div
                    style={{ minHeight: `${plan.badgeH}px` }}
                    className={`w-full rounded px-1 py-0.5 flex flex-col items-center justify-center text-center leading-tight ${
                      subIsLight
                        ? 'bg-black/[0.07] text-slate-900'
                        : 'bg-black/30 text-white'
                    }`}
                  >
                    <div
                      style={{ fontSize: `${cellNamePx}px` }}
                      className="font-extrabold leading-tight break-words whitespace-normal w-full line-clamp-2"
                    >
                      {mm.gender && (
                        <span className="mr-0.5">
                          {mm.gender === 'P' ? '👩' : '👨'}
                        </span>
                      )}
                      {mm.name}
                    </div>
                    {mm.sub && (
                      <div
                        style={{ fontSize: `${cellSubPx}px` }}
                        className={`mt-0.5 leading-tight break-words w-full line-clamp-2 opacity-85 ${
                          subIsLight ? 'text-slate-700' : 'text-slate-200'
                        }`}
                      >
                        {mm.sub}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          const renderNuclearGroupBox = (
            grp: ModularNuclearGroup,
            keyPrefix: string
          ) => (
            <div
              key={`${keyPrefix}-${grp.id}`}
              style={{ gap: `${plan.tightGap}px` }}
              className={`flex flex-col items-center rounded-lg p-[2px] border ${
                isCardLight
                  ? 'bg-black/[0.03] border-stone-400/35'
                  : 'bg-white/[0.03] border-white/10'
              }`}
            >
              <div className="flex items-stretch justify-center gap-0">
                {grp.couple.map((cm, cIdx) => renderSubCard(cm, cIdx))}
              </div>
              {grp.childrenRows.map((row, rIdx) => (
                <div
                  key={`${keyPrefix}-${grp.id}-r-${rIdx}`}
                  style={{ gap: `${plan.tightGap}px` }}
                  className="flex items-stretch justify-center"
                >
                  {row.map((ch, kIdx) => renderSubCard(ch, kIdx))}
                </div>
              ))}
            </div>
          );

          return (
            <div className="w-full h-full flex flex-col items-center justify-start">

              <div
                style={{
                  height: `${plan.headerH}px`,
                  fontSize: `${Math.max(
                    8,
                    Math.round(9.5 * Math.max(0.7, effScale))
                  )}px`,
                }}
                className="w-full flex items-center justify-between gap-1 px-1 mb-1 border-b border-current/20 font-extrabold truncate"
              >
                <span className="truncate">{node.name}</span>
                <span className="shrink-0 px-1 rounded bg-black/25 text-[8px] font-black">
                  {modLayout === 'I'
                    ? `I • ${mList.length}`
                    : modLayout === 'L'
                    ? `L • ${mList.length}`
                    : `${mList.length} Foto`}
                </span>
              </div>

              {plan.layout === 'I' ? (
                (() => {
                  const headGroup = plan.groups[0];
                  const childGroups = plan.groups.slice(1);
                  const childRows: ModularNuclearGroup[][] = [];
                  for (let i = 0; i < childGroups.length; i += plan.iSubCols) {
                    childRows.push(childGroups.slice(i, i + plan.iSubCols));
                  }
                  return (
                    <div
                      style={{ gap: `${plan.looseGap}px` }}
                      className="w-full flex flex-col items-center"
                    >
                      {headGroup &&
                        renderNuclearGroupBox(headGroup, 'modI-head')}
                      {childRows.map((rowGrps, rIdx) => (
                        <div
                          key={`modI-row-${rIdx}`}
                          style={{ gap: `${plan.looseGap}px` }}
                          className="flex items-start justify-center"
                        >
                          {rowGrps.map((cg) =>
                            renderNuclearGroupBox(cg, `modI-sub-${rIdx}`)
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : plan.layout === 'L' ? (
                (() => {
                  const headGroup = plan.groups[0];
                  const restGroups = plan.groups.slice(1);
                  if (restGroups.length === 0 && headGroup) {
                    const flatKids = headGroup.childrenRows.flat();
                    if (flatKids.length >= 2) {
                      const rightKidCount = Math.min(
                        2,
                        Math.ceil(flatKids.length / 2)
                      );
                      const rightKids = flatKids.slice(0, rightKidCount);
                      const downKids = flatKids.slice(rightKidCount);
                      const downCols = Math.min(
                        2,
                        Math.max(1, downKids.length)
                      );
                      const downKidRows: MergedCardMember[][] = [];
                      for (let i = 0; i < downKids.length; i += downCols) {
                        downKidRows.push(downKids.slice(i, i + downCols));
                      }
                      return (
                        <div
                          style={{ gap: `${plan.tightGap}px` }}
                          className="w-full flex flex-col items-start rounded-lg p-[2px]"
                        >
                          <div
                            style={{ gap: `${plan.tightGap}px` }}
                            className="flex items-stretch justify-start"
                          >
                            <div className="flex items-stretch gap-0">
                              {headGroup.couple.map((cm, cIdx) =>
                                renderSubCard(cm, cIdx)
                              )}
                            </div>
                            {rightKids.map((rk, rIdx) =>
                              renderSubCard(rk, rIdx)
                            )}
                          </div>
                          {downKidRows.map((dr, drIdx) => (
                            <div
                              key={`l-single-down-${drIdx}`}
                              style={{ gap: `${plan.tightGap}px` }}
                              className="flex items-stretch justify-start"
                            >
                              {dr.map((dk, dkIdx) => renderSubCard(dk, dkIdx))}
                            </div>
                          ))}
                        </div>
                      );
                    }
                  }

                  const downRows: ModularNuclearGroup[][] = [];
                  for (
                    let i = 0;
                    i < plan.lDownGroups.length;
                    i += plan.iSubCols
                  ) {
                    downRows.push(
                      plan.lDownGroups.slice(i, i + plan.iSubCols)
                    );
                  }

                  return (
                    <div
                      style={{ gap: `${plan.looseGap}px` }}
                      className="w-full flex flex-col items-start"
                    >
                      <div
                        style={{ gap: `${plan.looseGap}px` }}
                        className="flex items-start justify-start"
                      >
                        {headGroup &&
                          renderNuclearGroupBox(headGroup, 'modL-head')}
                        {plan.lRightGroups.map((rg) =>
                          renderNuclearGroupBox(rg, 'modL-right')
                        )}
                      </div>
                      {downRows.map((dr, drIdx) => (
                        <div
                          key={`modL-down-${drIdx}`}
                          style={{ gap: `${plan.looseGap}px` }}
                          className="flex items-start justify-start"
                        >
                          {dr.map((dg) =>
                            renderNuclearGroupBox(dg, `modL-d-${drIdx}`)
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${plan.cols}, minmax(0, 1fr))`,
                    gap: `${plan.tightGap}px`,
                    width: '100%',
                  }}
                  className="items-stretch justify-items-center"
                >
                  {mList.map((mm, mIdx) => renderSubCard(mm, mIdx))}
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <>
          {(node.genLevel ?? 0) <= 1 && (node.scaleMultiplier ?? 1) > 1.05 && (
            <span className="absolute -top-2 left-1.5 px-1 rounded bg-amber-500 text-slate-950 text-[7.5px] font-black leading-tight shadow print:hidden">
              G{(node.genLevel ?? 0) + 1}
            </span>
          )}

          {/* 1. Nama Lengkap Saja */}
          {cardDisplayMode === 'name_only' && (
            <div
              style={{ fontSize: `${scaledNamePx}px` }}
              className={`relative z-10 font-extrabold leading-snug break-words whitespace-normal w-full text-center ${
                useLeafFrame
                  ? isDark
                    ? 'px-1.5 py-0.5 rounded-md bg-stone-950/90 border border-emerald-400/70 text-white shadow-md'
                    : 'px-1.5 py-0.5 rounded-md bg-white/95 border border-emerald-700/60 text-slate-950 shadow-md'
                  : usePetalFrame
                  ? isDark
                    ? 'px-1.5 py-[2px] rounded-full bg-rose-950/92 border border-pink-300/80 text-white shadow-md'
                    : 'px-1.5 py-[2px] rounded-full bg-white/96 border border-pink-600/70 text-slate-950 shadow-md'
                  : useHexFrame
                  ? isDark
                    ? 'px-1.5 py-[2px] rounded-full bg-slate-950/92 border border-sky-400/75 text-white shadow-md'
                    : 'px-1.5 py-[2px] rounded-full bg-white/95 border border-sky-700/65 text-slate-950 shadow-md'
                  : ''
              }`}
            >
              {node.gender && (
                <span className="mr-0.5 opacity-90">
                  {node.gender === 'P' ? '👩' : '👨'}
                </span>
              )}
              <span>{node.name}</span>
            </div>
          )}

          {/* 2. Foto + Badge Nama */}
          {cardDisplayMode === 'photo_name' && (
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-between overflow-visible">
              <div className="relative z-10 shrink-0">
                {renderPhotoFrame(
                  node.photo,
                  node.name,
                  pDim.w,
                  pDim.h,
                  useLeafFrame
                    ? leafStrokeCol
                    : usePetalFrame
                    ? petalStrokeCol
                    : useHexFrame
                    ? hexStrokeCol
                    : undefined,
                  useSpecialFrame ? 'shadow-md' : ''
                )}
              </div>
              <div
                style={{
                  height: `${useHexFrame || usePetalFrame ? Math.max(13, Math.round(uniformUnit.badgeH * 0.85)) : uniformUnit.badgeH}px`,
                  fontSize: `${Math.max(7, Math.round(9.5 * effScale))}px`,
                }}
                className={`relative z-20 w-full px-1 flex items-center justify-center font-extrabold leading-none truncate ${
                  useLeafFrame
                    ? isDark
                      ? 'mt-0.5 rounded-md bg-stone-950/92 border border-emerald-400/75 text-white shadow-md'
                      : 'mt-0.5 rounded-md bg-white/95 border border-emerald-700/65 text-slate-950 shadow-md'
                    : usePetalFrame
                    ? isDark
                      ? 'mt-0.5 rounded-full bg-rose-950/92 border border-pink-300/80 text-white shadow-sm'
                      : 'mt-0.5 rounded-full bg-white/96 border border-pink-600/70 text-slate-950 shadow-sm'
                    : useHexFrame
                    ? isDark
                      ? 'mt-0.5 rounded-full bg-slate-950/92 border border-sky-400/80 text-white shadow-sm'
                      : 'mt-0.5 rounded-full bg-white/96 border border-sky-700/70 text-slate-950 shadow-sm'
                    : isCardLight
                    ? 'rounded bg-black/[0.07] text-slate-900'
                    : 'rounded bg-black/30 text-white'
                }`}
              >
                <span className="truncate">{node.name}</span>
              </div>
            </div>
          )}

          {/* 3. Foto + Badge Lengkap (Nama, Lahir/Wafat, Kota) */}
          {cardDisplayMode === 'full' && (
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-between overflow-visible gap-0.5">
              <div className="relative z-10 shrink-0">
                {renderPhotoFrame(
                  node.photo,
                  node.name,
                  pDim.w,
                  pDim.h,
                  useLeafFrame
                    ? leafStrokeCol
                    : usePetalFrame
                    ? petalStrokeCol
                    : useHexFrame
                    ? hexStrokeCol
                    : undefined,
                  useSpecialFrame ? 'shadow-md' : ''
                )}
              </div>
              <div
                className={`relative z-20 w-full rounded-md px-1.5 py-[2px] flex flex-col items-center justify-center text-center leading-tight ${
                  useLeafFrame
                    ? isDark
                      ? 'bg-stone-950/92 border border-emerald-400/75 text-white shadow-md'
                      : 'bg-white/95 border border-emerald-700/65 text-slate-950 shadow-md'
                    : usePetalFrame
                    ? isDark
                      ? 'bg-rose-950/92 border border-pink-300/80 text-white shadow-sm'
                      : 'bg-white/96 border border-pink-600/70 text-slate-950 shadow-sm'
                    : useHexFrame
                    ? isDark
                      ? 'bg-slate-950/92 border border-sky-400/80 text-white shadow-sm'
                      : 'bg-white/96 border border-sky-700/70 text-slate-950 shadow-sm'
                    : isCardLight
                    ? 'bg-black/[0.07] text-slate-900'
                    : 'bg-black/30 text-white'
                }`}
              >
                <div
                  style={{
                    fontSize: `${Math.max(7, Math.round(9.5 * effScale))}px`,
                  }}
                  className="font-extrabold leading-tight break-words whitespace-normal w-full"
                >
                  {node.gender && (
                    <span className="mr-0.5">
                      {node.gender === 'P' ? '👩' : '👨'}
                    </span>
                  )}
                  <span>{node.name}</span>
                </div>
                {node.sub && (
                  <div
                    style={{
                      fontSize: `${Math.max(6, Math.round(8 * effScale))}px`,
                    }}
                    className={`mt-0.5 leading-tight break-words w-full opacity-90 ${
                      useLeafFrame
                        ? isDark
                          ? 'text-lime-200'
                          : 'text-emerald-800'
                        : usePetalFrame
                        ? isDark
                          ? 'text-pink-200'
                          : 'text-pink-800'
                        : useHexFrame
                        ? isDark
                          ? 'text-sky-200'
                          : 'text-sky-800'
                        : isCardLight
                        ? 'text-slate-700'
                        : 'text-slate-200'
                    }`}
                  >
                    {node.sub}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const GridCardItem = React.memo(GridCardItemInner);
