import React, { useEffect, useRef } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Split,
} from 'lucide-react';
import type {
  CardDisplayMode,
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
  showArrowsHere: boolean;
  moveTargets: string[];
  nudgeStep: number;
  cardDisplayMode: CardDisplayMode;
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
  onStartNudgeRepeat: (targets: string[], dx: number, dy: number) => void;
  onStopNudgeRepeat: () => void;
  onLockArrows: () => void;
  onUnmergeCard: (id: string) => void;
}

const GridCardItemInner: React.FC<GridCardItemProps> = ({
  node,
  isSelected,
  isConnectSource,
  isHolding,
  isUnlocked,
  showArrowsHere,
  moveTargets,
  nudgeStep,
  cardDisplayMode,
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
  onStartNudgeRepeat,
  onStopNudgeRepeat,
  onLockArrows,
  onUnmergeCard,
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

  const cardCustomStyle: React.CSSProperties = {
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
      className={`group absolute rounded-xl border-2 flex flex-col items-center justify-center text-center select-none ${
        lodLite ? '' : 'shadow-lg transition-shadow'
      } ${
        cardDisplayMode === 'name_only'
          ? 'px-2 py-1'
          : isModularContainer
          ? 'p-1'
          : 'p-[3px]'
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
      } ${isCardLight ? 'text-slate-900' : 'text-slate-100'} ${
        node.wafat ? 'border-dashed opacity-90' : ''
      }`}
      title={
        safeHoldMove && layoutMode === 'manual' && !isUnlocked
          ? `${node.name} • Tahan 2 detik untuk tampilkan panah geser ▲▼◀▶`
          : node.name
      }
    >
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

      {/* 4 Panah Interaktif Atas / Bawah / Kiri / Kanan setelah Hold 2 Detik */}
      {showArrowsHere && (
        <>
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartNudgeRepeat(moveTargets, 0, -nudgeStep);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onStartNudgeRepeat(moveTargets, 0, -nudgeStep);
            }}
            onMouseUp={onStopNudgeRepeat}
            onMouseLeave={onStopNudgeRepeat}
            onTouchEnd={onStopNudgeRepeat}
            onTouchCancel={onStopNudgeRepeat}
            className="absolute -top-8 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg border-2 border-white flex items-center justify-center z-50 print:hidden"
            title="Geser ke Atas"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartNudgeRepeat(moveTargets, 0, nudgeStep);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onStartNudgeRepeat(moveTargets, 0, nudgeStep);
            }}
            onMouseUp={onStopNudgeRepeat}
            onMouseLeave={onStopNudgeRepeat}
            onTouchEnd={onStopNudgeRepeat}
            onTouchCancel={onStopNudgeRepeat}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg border-2 border-white flex items-center justify-center z-50 print:hidden"
            title="Geser ke Bawah"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartNudgeRepeat(moveTargets, -nudgeStep, 0);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onStartNudgeRepeat(moveTargets, -nudgeStep, 0);
            }}
            onMouseUp={onStopNudgeRepeat}
            onMouseLeave={onStopNudgeRepeat}
            onTouchEnd={onStopNudgeRepeat}
            onTouchCancel={onStopNudgeRepeat}
            className="absolute top-1/2 -translate-y-1/2 -left-8 w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg border-2 border-white flex items-center justify-center z-50 print:hidden"
            title="Geser ke Kiri"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartNudgeRepeat(moveTargets, nudgeStep, 0);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              onStartNudgeRepeat(moveTargets, nudgeStep, 0);
            }}
            onMouseUp={onStopNudgeRepeat}
            onMouseLeave={onStopNudgeRepeat}
            onTouchEnd={onStopNudgeRepeat}
            onTouchCancel={onStopNudgeRepeat}
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
              onLockArrows();
            }}
            className="absolute -top-3 -right-3 px-1.5 py-0.5 rounded-full bg-slate-950 border border-emerald-400 text-emerald-300 text-[8.5px] font-black shadow z-50 print:hidden"
            title="Kunci kembali posisi kartu"
          >
            Kunci ✓
          </button>
        </>
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
              {isSelected && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnmergeCard(node.id);
                  }}
                  className="absolute -top-2.5 right-1.5 px-1.5 py-0.5 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 text-[8.5px] font-black shadow z-30 flex items-center gap-0.5 print:hidden"
                  title="Pisah kembali ke kartu satuan"
                >
                  <Split className="w-2.5 h-2.5" />
                  <span>Pisah</span>
                </button>
              )}

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
              className="font-extrabold leading-snug break-words whitespace-normal w-full text-center"
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
            <div className="w-full h-full flex flex-col items-center justify-between overflow-hidden">
              {renderPhotoFrame(node.photo, node.name, pDim.w, pDim.h)}
              <div
                style={{
                  height: `${uniformUnit.badgeH}px`,
                  fontSize: `${Math.max(7, Math.round(9.5 * effScale))}px`,
                }}
                className={`w-full rounded px-1 flex items-center justify-center font-extrabold leading-none truncate ${
                  isCardLight
                    ? 'bg-black/[0.07] text-slate-900'
                    : 'bg-black/30 text-white'
                }`}
              >
                <span className="truncate">{node.name}</span>
              </div>
            </div>
          )}

          {/* 3. Foto + Badge Lengkap (Nama, Lahir/Wafat, Kota) */}
          {cardDisplayMode === 'full' && (
            <div className="w-full h-full flex flex-col items-center justify-between overflow-hidden gap-0.5">
              {renderPhotoFrame(node.photo, node.name, pDim.w, pDim.h)}
              <div
                className={`w-full rounded-md px-1.5 py-0.5 flex flex-col items-center justify-center text-center leading-tight ${
                  isCardLight
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
                      isCardLight ? 'text-slate-700' : 'text-slate-200'
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
