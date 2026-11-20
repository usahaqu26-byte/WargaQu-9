export const CUSTOM_RELAY_SERVER_ORIGIN_KEY = 'wargaqu_server_origin_v1';

const DEFAULT_CLOUD_RELAY_ORIGIN =
  'https://ais-pre-mo35b7abwyz4p2rd2vga7n-754024889019.asia-southeast1.run.app';

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

/**
 * Menentukan origin server backend + WebSocket Relay yang dipakai bersama oleh APK & PWA.
 * - Jika berjalan di full-stack server WargaQu (Cloud Run / Node dev), gunakan origin saat ini (same-origin).
 * - Jika berjalan di Android APK (https://localhost) atau static hosting (GitHub Pages / Firebase Hosting),
 *   otomatis arahkan ke Cloud Relay server agar sinkronisasi live APK <-> PWA tetap tersambung.
 */
export function getRelayServerOrigin(): string {
  const custom = getCustomRelayServerOrigin();
  if (custom) return custom;

  const envUrl = normalizeOrigin(
    ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_APP_BASE_URL || '')
  );

  if (typeof window === 'undefined') {
    return envUrl || DEFAULT_CLOUD_RELAY_ORIGIN;
  }

  if (isNativeCapacitorApk() || isStaticHostedOrigin()) {
    return envUrl || DEFAULT_CLOUD_RELAY_ORIGIN;
  }

  return window.location.origin;
}

export function buildApiUrl(apiPath: string): string {
  const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (typeof window === 'undefined') return cleanPath;
  if (isNativeCapacitorApk() || isStaticHostedOrigin() || getCustomRelayServerOrigin()) {
    return `${getRelayServerOrigin()}${cleanPath}`;
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
