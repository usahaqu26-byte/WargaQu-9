import { Capacitor, registerPlugin } from '@capacitor/core';

export type StudioScreenMode = 'portrait' | 'landscape' | 'auto';

interface ScreenControlPluginInterface {
  setOrientation(options: {
    mode: StudioScreenMode;
    immersive?: boolean;
  }): Promise<{ supported: boolean; mode: string; immersive: boolean }>;
}

const ScreenControlPlugin =
  registerPlugin<ScreenControlPluginInterface>('ScreenControl');

export interface StudioOrientationResult {
  appliedVia: 'native' | 'web-api' | 'css-fallback';
  nativeLandscape: boolean;
}

/**
 * Mengatur orientasi layar HP secara nyata (APK Native / Web Screen Orientation API)
 * tanpa mengubah orientasi kertas A0-A4 di dalam kanvas NasabQu.
 */
export async function applyStudioScreenOrientation(
  mode: StudioScreenMode,
  immersive = false
): Promise<StudioOrientationResult> {
  // 1. Native Android APK (Capacitor Plugin)
  if (Capacitor.isNativePlatform()) {
    try {
      await ScreenControlPlugin.setOrientation({ mode, immersive });
      return {
        appliedVia: 'native',
        nativeLandscape: mode === 'landscape',
      };
    } catch {
      // Lanjut fallback jika gagal
    }
  }

  // 2. Web / PWA (Fullscreen + Screen Orientation API)
  const docEl = typeof document !== 'undefined' ? document.documentElement : null;
  const screenOrient =
    typeof window !== 'undefined'
      ? (window.screen?.orientation as
          | (ScreenOrientation & {
              lock?: (orientation: string) => Promise<void>;
              unlock?: () => void;
            })
          | undefined)
      : undefined;

  if (mode === 'auto') {
    try {
      if (screenOrient?.unlock) screenOrient.unlock();
    } catch {
      // ignore
    }
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
    return { appliedVia: 'web-api', nativeLandscape: false };
  }

  if (mode === 'landscape') {
    try {
      if (docEl && !document.fullscreenElement && docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      }
      if (screenOrient?.lock) {
        await screenOrient.lock('landscape');
        return { appliedVia: 'web-api', nativeLandscape: true };
      }
    } catch {
      // Browser (iOS Safari / desktop) menolak lock() -> gunakan CSS 90deg fallback stage
    }
    const alreadyWide =
      typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
    return {
      appliedVia: alreadyWide ? 'web-api' : 'css-fallback',
      nativeLandscape: alreadyWide,
    };
  }

  // mode === 'portrait'
  try {
    if (screenOrient?.lock) {
      await screenOrient.lock('portrait');
      return { appliedVia: 'web-api', nativeLandscape: false };
    }
  } catch {
    // ignore
  }
  try {
    if (screenOrient?.unlock) screenOrient.unlock();
  } catch {
    // ignore
  }
  return { appliedVia: 'web-api', nativeLandscape: false };
}
