import React, { useEffect, useState } from 'react';
import {
  DesktopViewportMode,
  VIEWPORT_MODE_SYNC_EVENT,
  ViewportLayoutService,
} from '../services/viewportLayoutService';

interface AndroidFrameProps {
  children: React.ReactNode;
}

function detectViewportLayout(mode: DesktopViewportMode) {
  if (typeof window === 'undefined') {
    return { isFullBleed: true, isDesktopWide: false, rootFontPx: 16 };
  }

  const ua = navigator.userAgent || '';
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const hasCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const hasTouch = hasCoarsePointer || navigator.maxTouchPoints > 0 || isMobileUa;

  const vw = window.innerWidth || document.documentElement.clientWidth || 390;
  const vh = window.innerHeight || document.documentElement.clientHeight || 844;
  const isPortrait = vh >= vw;
  const minScreenDim = Math.min(window.screen?.width || vw, window.screen?.height || vh);

  const isDesktopScreen = !hasTouch && !isPortrait && vw >= 1024;

  // Full-bleed edge-to-edge on all phones/tablets AND on Laptop/PC unless user explicitly picks "mobile" frame preview
  const isFullBleed = !isDesktopScreen || mode !== 'mobile';
  const isDesktopWide = isDesktopScreen && mode !== 'mobile';

  // If a phone browser (e.g. Chrome "Situs desktop" or wide WebView) forces a ~700-980px layout width
  // onto a physical ~360-540px screen, scale root fontSize (rem) so text & spacing match native phone scale.
  let rootFontPx = 16;
  if ((hasTouch || isPortrait) && vw >= 700 && minScreenDim > 0 && minScreenDim <= 560) {
    const ratio = vw / Math.max(360, minScreenDim);
    rootFontPx = Math.round(Math.min(34, Math.max(18, ratio * 15)));
  }

  return { isFullBleed, isDesktopWide, rootFontPx };
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  const [mode, setMode] = useState<DesktopViewportMode>(() => ViewportLayoutService.getMode());
  const [layout, setLayout] = useState(() => detectViewportLayout(ViewportLayoutService.getMode()));

  useEffect(() => {
    const update = (nextMode?: DesktopViewportMode) => {
      const effectiveMode = nextMode ?? ViewportLayoutService.getMode();
      const next = detectViewportLayout(effectiveMode);
      setLayout(next);
      if (typeof document !== 'undefined') {
        document.documentElement.style.fontSize =
          next.rootFontPx === 16 ? '' : `${next.rootFontPx}px`;
      }
    };

    const onResize = () => update();
    const onModeChange = (ev: Event) => {
      const nextMode =
        (ev as CustomEvent<DesktopViewportMode>).detail || ViewportLayoutService.getMode();
      setMode(nextMode);
      update(nextMode);
    };

    update(mode);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener(VIEWPORT_MODE_SYNC_EVENT, onModeChange);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.removeEventListener(VIEWPORT_MODE_SYNC_EVENT, onModeChange);
      if (typeof document !== 'undefined') {
        document.documentElement.style.fontSize = '';
      }
    };
  }, [mode]);

  return (
    <div
      className={`h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-start text-slate-800 antialiased font-sans selection:bg-emerald-600 selection:text-white overflow-hidden safe-area-shell print-flow-unlock ${
        layout.isFullBleed ? 'bg-[#f0fdf4]' : 'bg-emerald-950/15'
      }`}
    >
      {/* Adaptive shell: full-screen responsive on HP & Laptop/PC, optional phone frame preview on desktop */}
      <div
        className={`w-full h-full max-h-full flex flex-col relative bg-[#f0fdf4] overflow-hidden print-flow-unlock ${
          layout.isFullBleed ? 'max-w-none' : 'max-w-md shadow-2xl border-x border-emerald-200/70'
        }`}
      >
        {children}
      </div>
    </div>
  );
};
