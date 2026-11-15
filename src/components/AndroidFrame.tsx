import React, { useEffect, useState } from 'react';

interface AndroidFrameProps {
  children: React.ReactNode;
}

function detectViewportLayout() {
  if (typeof window === 'undefined') {
    return { isFullBleed: true, rootFontPx: 16 };
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

  // Full-bleed edge-to-edge on all phones, tablets, foldables, or viewports under desktop width
  const isFullBleed = hasTouch || isPortrait || vw < 1024;

  // If a phone browser (e.g. Chrome "Situs desktop" or wide WebView) forces a ~700-980px layout width
  // onto a physical ~360-540px screen, scale root fontSize (rem) so text & spacing match native phone scale.
  let rootFontPx = 16;
  if ((hasTouch || isPortrait) && vw >= 700 && minScreenDim > 0 && minScreenDim <= 560) {
    const ratio = vw / Math.max(360, minScreenDim);
    rootFontPx = Math.round(Math.min(34, Math.max(18, ratio * 15)));
  }

  return { isFullBleed, rootFontPx };
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  const [layout, setLayout] = useState(() => detectViewportLayout());

  useEffect(() => {
    const update = () => {
      const next = detectViewportLayout();
      setLayout(next);
      if (typeof document !== 'undefined') {
        document.documentElement.style.fontSize =
          next.rootFontPx === 16 ? '' : `${next.rootFontPx}px`;
      }
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (typeof document !== 'undefined') {
        document.documentElement.style.fontSize = '';
      }
    };
  }, []);

  return (
    <div
      className={`h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-start text-slate-800 antialiased font-sans selection:bg-emerald-600 selection:text-white overflow-hidden ${
        layout.isFullBleed ? 'bg-[#f0fdf4]' : 'bg-emerald-950/15'
      }`}
    >
      {/* Auto-adaptive container: full-bleed on HP/tablet/mobile, clean centered frame on wide desktop */}
      <div
        className={`w-full h-full max-h-full flex flex-col relative bg-[#f0fdf4] overflow-hidden ${
          layout.isFullBleed ? 'max-w-none' : 'max-w-md shadow-2xl'
        }`}
      >
        {children}
      </div>
    </div>
  );
};
