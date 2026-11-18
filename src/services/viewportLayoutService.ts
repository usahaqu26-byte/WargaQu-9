export type DesktopViewportMode = 'auto' | 'desktop' | 'mobile';

const VIEWPORT_MODE_KEY = 'wargaqu_viewport_mode_v1';
export const VIEWPORT_MODE_SYNC_EVENT = 'wargaqu-viewport-mode-sync';

export const ViewportLayoutService = {
  getMode(): DesktopViewportMode {
    try {
      const raw = localStorage.getItem(VIEWPORT_MODE_KEY);
      if (raw === 'desktop' || raw === 'mobile' || raw === 'auto') {
        return raw;
      }
    } catch {
      // ignore
    }
    return 'auto';
  },

  setMode(mode: DesktopViewportMode): void {
    try {
      localStorage.setItem(VIEWPORT_MODE_KEY, mode);
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(VIEWPORT_MODE_SYNC_EVENT, { detail: mode }));
    }
  },
};
