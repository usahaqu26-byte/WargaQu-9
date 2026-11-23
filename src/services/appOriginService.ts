export const CUSTOM_RELAY_SERVER_ORIGIN_KEY = 'wargaqu_server_origin_v1';

export const DEFAULT_CLOUD_RELAY_ORIGIN =
  'https://ais-pre-mo35b7abwyz4p2rd2vga7n-754024889019.asia-southeast1.run.app';

let sharedRelayHealthState: 'unknown' | 'online' | 'offline' = 'unknown';
let sharedRelayProbePromise: Promise<boolean> | null = null;

function normalizeOrigin(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return '';
  }
}

export function isNativeCapacitorApk(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    const proto = (window.location.protocol || '').toLowerCase();
    if (proto === 'capacitor:' || proto === 'file:') return true;
    // Android Capacitor WebView with androidScheme: https runs on https://localhost (no port)
    const host = (window.location.hostname || '').toLowerCase();
    const port = window.location.port || '';
    const isAndroidUa = /android/i.test(navigator.userAgent || '');
    if (isAndroidUa && host === 'localhost' && !port && proto === 'https:') {
      return true;
    }
  } catch {
    // ignore detection errors
  }
  return false;
}

export function isStaticHostedOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  return (
    host.endsWith('.github.io') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com')
  );
}

export function isAiStudioDevOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const host = (window.location.hostname || '').toLowerCase();
  return host.startsWith('ais-dev-') && host.endsWith('.run.app');
}

export function getCustomRelayServerOrigin(): string {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeOrigin(localStorage.getItem(CUSTOM_RELAY_SERVER_ORIGIN_KEY) || '');
  } catch {
    return '';
  }
}

export function setCustomRelayServerOrigin(rawUrl: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const clean = normalizeOrigin(rawUrl);
    if (!clean) {
      localStorage.removeItem(CUSTOM_RELAY_SERVER_ORIGIN_KEY);
      return '';
    }
    localStorage.setItem(CUSTOM_RELAY_SERVER_ORIGIN_KEY, clean);
    return clean;
  } catch {
    return '';
  }
}

function getEnvBaseOrigin(): string {
  return normalizeOrigin(
    ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_APP_BASE_URL || '')
  );
}

/**
 * Checks whether the configured/default public cloud relay (used by standalone APK & static PWA)
 * responds with valid WargaQu relay JSON (not a 404/HTML page).
 */
export async function probeSharedRelayHealth(force = false): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  if (!force && sharedRelayHealthState !== 'unknown') {
    return sharedRelayHealthState === 'online';
  }
  if (!force && sharedRelayProbePromise) {
    return sharedRelayProbePromise;
  }

  const targetOrigin =
    getCustomRelayServerOrigin() || getEnvBaseOrigin() || DEFAULT_CLOUD_RELAY_ORIGIN;

  sharedRelayProbePromise = (async () => {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), 3500) : null;
      try {
        const res = await fetch(`${targetOrigin}/api/relay-health`, {
          headers: { Accept: 'application/json' },
          signal: controller?.signal,
        });
        if (!res.ok) {
          sharedRelayHealthState = 'offline';
          return false;
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          sharedRelayHealthState = 'offline';
          return false;
        }
        const data = (await res.json()) as { status?: string };
        const ok = data?.status === 'ok';
        sharedRelayHealthState = ok ? 'online' : 'offline';
        return ok;
      } finally {
        if (timer !== null) window.clearTimeout(timer);
      }
    } catch {
      sharedRelayHealthState = 'offline';
      return false;
    } finally {
      sharedRelayProbePromise = null;
    }
  })();

  return sharedRelayProbePromise;
}

export function getSharedRelayProbeState(): 'unknown' | 'online' | 'offline' {
  return sharedRelayHealthState;
}

/**
 * Menentukan origin server backend + WebSocket Relay yang dipakai bersama oleh APK & PWA.
 * - Jika ada custom relay / env base URL, atau APK / static hosting: pakai origin Relay bersama.
 * - Jika berjalan di AI Studio Dev Preview (`ais-dev-...`) dan Shared Relay (`ais-pre-...`) aktif:
 *   arahkan rute sync/session/WS ke `ais-pre` agar APK & PWA bertemu di server yang sama.
 */
export function getRelayServerOrigin(): string {
  const custom = getCustomRelayServerOrigin();
  if (custom) return custom;

  const envUrl = getEnvBaseOrigin();

  if (typeof window === 'undefined') {
    return envUrl || DEFAULT_CLOUD_RELAY_ORIGIN;
  }

  if (isNativeCapacitorApk() || isStaticHostedOrigin()) {
    return envUrl || DEFAULT_CLOUD_RELAY_ORIGIN;
  }

  if (isAiStudioDevOrigin() && sharedRelayHealthState === 'online') {
    return envUrl || DEFAULT_CLOUD_RELAY_ORIGIN;
  }

  return window.location.origin;
}

function isSyncRelayApiPath(cleanPath: string): boolean {
  return (
    cleanPath.startsWith('/api/session/') ||
    cleanPath.startsWith('/api/account-sync') ||
    cleanPath.startsWith('/api/pwa-handoff') ||
    cleanPath.startsWith('/api/pair-') ||
    cleanPath.startsWith('/api/leluhur/') ||
    cleanPath.startsWith('/api/invite-room') ||
    cleanPath.startsWith('/api/relay-') ||
    cleanPath.startsWith('/api/quiz-rounds') ||
    cleanPath.startsWith('/api/smartcare/tickets')
  );
}

export function buildApiUrl(apiPath: string): string {
  const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (typeof window === 'undefined') return cleanPath;

  if (isNativeCapacitorApk() || isStaticHostedOrigin() || getCustomRelayServerOrigin()) {
    return `${getRelayServerOrigin()}${cleanPath}`;
  }

  if (isAiStudioDevOrigin() && isSyncRelayApiPath(cleanPath) && sharedRelayHealthState === 'online') {
    const shared = getEnvBaseOrigin() || DEFAULT_CLOUD_RELAY_ORIGIN;
    return `${shared}${cleanPath}`;
  }

  return cleanPath;
}

export function buildWsRelayUrl(): string {
  const customWs = (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_WS_RELAY_URL;
  if (customWs && customWs.trim() && !getCustomRelayServerOrigin()) {
    return customWs.trim();
  }
  const serverOrigin = getRelayServerOrigin();
  try {
    const parsed = new URL(serverOrigin);
    const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${parsed.host}/ws-relay`;
  } catch {
    return 'ws://localhost:3000/ws-relay';
  }
}

/**
 * Origin publik yang aman dibagikan sebagai QR / tautan undangan (selalu URL web nyata, bukan https://localhost APK).
 */
export function getPublicShareOrigin(): string {
  if (typeof window === 'undefined') return DEFAULT_CLOUD_RELAY_ORIGIN;
  if (!isNativeCapacitorApk()) {
    const origin = window.location.origin;
    if (origin && origin !== 'null' && !origin.startsWith('capacitor://') && !origin.startsWith('file://')) {
      return origin;
    }
  }
  return getRelayServerOrigin();
}
