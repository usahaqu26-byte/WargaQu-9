import { AUTH_SYNC_EVENT, AuthService } from './authService';
import { DOMPETQU_SYNC_EVENT } from './dompetQuStorage';
import {
  RELAY_PUBLISH_CMD_EVENT,
  RELAY_REGISTER_CHANNELS_EVENT,
} from './inviteRelayService';
import { REALTIME_RELAY_EVENT, RelayIncomingEvent } from './realtimeRelayService';
import { RT_SYNC_EVENT } from './rtSiagaStorage';
import { SIAGA_CIRCLE_SYNC_EVENT } from './siagaCircleService';
import { ZERO_TRUST_SYNC_EVENT, ZeroTrustService } from './zeroTrustService';
import { MONETIZATION_SYNC_EVENT } from './monetizationService';
import { ACCOUNT_GOV_SYNC_EVENT } from './accountGovernanceService';

export const LINKED_DEVICES_STORAGE_KEY = 'wargaqu_linked_devices_v1';
export const PAIRED_HOST_STORAGE_KEY = 'wargaqu_paired_host_v1';
export const PENDING_PAIR_TOKEN_KEY = 'wargaqu_pending_pair_token_v1';
export const DEVICE_PAIRING_SYNC_EVENT = 'wargaqu-device-pairing-sync';

export interface PairingSyncEventDetail {
  remoteApplied?: boolean;
  changedKeys?: string[];
}

export interface PairingSessionInfo {
  sessionId: string;
  secretHex: string;
  channel: string;
  shortToken: string;
  qrUrl: string;
  createdAt: number;
  expiresAt: number;
}

export interface LinkedDesktopDevice {
  linkId: string;
  deviceName: string;
  browserInfo: string;
  includeDompetQu: boolean;
  secretHex: string;
  syncChannel: string;
  linkedAt: string;
  lastSyncAt: string;
  lastSeq?: number;
}

export interface PairedHostSession {
  linkId: string;
  hostLabel: string;
  accountEmail: string;
  includeDompetQu: boolean;
  secretHex: string;
  syncChannel: string;
  linkedAt: string;
  lastSyncAt: string;
  lastSeq?: number;
}

interface EncryptedFrame {
  iv: string;
  ct: string;
}

interface PairingTransferPayload {
  kind: 'wargaqu_pair_v1';
  linkId: string;
  hostLabel: string;
  accountEmail: string;
  includeDompetQu: boolean;
  liveSecretHex?: string;
  sentAt: string;
  entries: Record<string, string>;
}

const EXCLUDED_DEVICE_LOCAL_KEYS = new Set<string>([
  'wargaqu_hidden_device_token_v1',
  'wargaqu_autobackup_prefs_v1',
  'wargaqu_viewport_mode_v1',
  LINKED_DEVICES_STORAGE_KEY,
  PAIRED_HOST_STORAGE_KEY,
  PENDING_PAIR_TOKEN_KEY,
]);

const sessionEcdhKeys = new Map<string, CryptoKey>();

let liveSyncStarted = false;
let isApplyingRemoteSync = false;
let remoteSyncResetTimer: number | null = null;
let lastPushedSignature = '';
let syncDebounceTimer: number | null = null;
let periodicCheckTimer: number | null = null;
let periodicPullTimer: number | null = null;

function emitPairingSync(detail: PairingSyncEventDetail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PairingSyncEventDetail>(DEVICE_PAIRING_SYNC_EVENT, { detail }));
  }
}

function emitAllModuleSyncEvents(changedKeys: string[] = []) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
  window.dispatchEvent(new CustomEvent(RT_SYNC_EVENT));
  window.dispatchEvent(new CustomEvent(SIAGA_CIRCLE_SYNC_EVENT));
  window.dispatchEvent(new CustomEvent(ZERO_TRUST_SYNC_EVENT));
  window.dispatchEvent(new CustomEvent(MONETIZATION_SYNC_EVENT));
  window.dispatchEvent(new CustomEvent(ACCOUNT_GOV_SYNC_EVENT));
  window.dispatchEvent(new CustomEvent(DOMPETQU_SYNC_EVENT));
  emitPairingSync({ remoteApplied: true, changedKeys });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importSecretAesKey(secretHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`wargaqu-pair:${secretHex}`));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function deriveEcdhSecretHex(privateKey: CryptoKey, peerPubJwk: JsonWebKey): Promise<string> {
  const peerPublicKey = await crypto.subtle.importKey(
    'jwk',
    peerPubJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function encryptWithSecret(secretHex: string, data: unknown): Promise<EncryptedFrame> {
  const key = await importSecretAesKey(secretHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoded
  );
  return {
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(cipherBuf)),
  };
}

async function decryptWithSecret<T = unknown>(secretHex: string, frame: EncryptedFrame): Promise<T> {
  const key = await importSecretAesKey(secretHex);
  const iv = fromBase64(frame.iv);
  const ct = fromBase64(frame.ct);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ct.buffer as ArrayBuffer
  );
  return JSON.parse(new TextDecoder().decode(plainBuf)) as T;
}

function shouldSyncKey(key: string, includeDompetQu: boolean): boolean {
  if (EXCLUDED_DEVICE_LOCAL_KEYS.has(key)) return false;
  if (!includeDompetQu && key.startsWith('wargaqu_dompetqu_v1_')) {
    return false;
  }
  return (
    key.startsWith('wargaqu_') ||
    key.startsWith('leluhurqu_grid_') ||
    key.startsWith('uq_') ||
    key.startsWith('baksoqu_') ||
    key.startsWith('siagaqu_')
  );
}

function collectTransferSnapshot(includeDompetQu: boolean): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !shouldSyncKey(key, includeDompetQu)) continue;
    const val = localStorage.getItem(key);
    if (val !== null) {
      snapshot[key] = val;
    }
  }
  return snapshot;
}

function hashStringFnv1a(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildSnapshotSignature(entries: Record<string, string>): string {
  return Object.keys(entries)
    .sort()
    .map(k => `${k}:${entries[k].length}:${hashStringFnv1a(entries[k])}`)
    .join('|');
}

function registerRelayChannels(channels: string[]) {
  if (typeof window === 'undefined' || channels.length === 0) return;
  window.dispatchEvent(
    new CustomEvent(RELAY_REGISTER_CHANNELS_EVENT, {
      detail: { channels },
    })
  );
}

function publishRelay(channel: string, eventName: string, payload: unknown) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RELAY_PUBLISH_CMD_EVENT, {
      detail: { channel, eventName, payload },
    })
  );
}

function getBrowserDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Browser Laptop/PC';
  const ua = navigator.userAgent || '';
  let os = 'Perangkat';
  if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'MacBook / macOS';
  else if (/Android/i.test(ua)) os = 'HP Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iPhone / iPad';
  else if (/Linux/i.test(ua)) os = 'Linux PC';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';

  return `${browser} · ${os}`;
}

function loadLinkedDevices(): LinkedDesktopDevice[] {
  try {
    const raw = localStorage.getItem(LINKED_DEVICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLinkedDevices(list: LinkedDesktopDevice[]) {
  try {
    localStorage.setItem(LINKED_DEVICES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota
  }
  emitPairingSync();
}

function loadPairedHost(): PairedHostSession | null {
  try {
    const raw = localStorage.getItem(PAIRED_HOST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PairedHostSession>;
    if (!parsed.linkId || !parsed.secretHex || !parsed.syncChannel) return null;
    return parsed as PairedHostSession;
  } catch {
    return null;
  }
}

function savePairedHost(host: PairedHostSession | null) {
  try {
    if (!host) {
      localStorage.removeItem(PAIRED_HOST_STORAGE_KEY);
    } else {
      localStorage.setItem(PAIRED_HOST_STORAGE_KEY, JSON.stringify(host));
    }
  } catch {
    // ignore
  }
  emitPairingSync();
}

function applySyncedSnapshot(
  entries: Record<string, string>,
  includeDompetQu: boolean,
  auditLabel: string,
  forceNotify = false
): number {
  isApplyingRemoteSync = true;
  if (remoteSyncResetTimer !== null) {
    window.clearTimeout(remoteSyncResetTimer);
  }
  let writtenCount = 0;
  const changedKeys: string[] = [];
  try {
    Object.entries(entries).forEach(([k, v]) => {
      if (!shouldSyncKey(k, includeDompetQu) || typeof v !== 'string') return;
      try {
        const existing = localStorage.getItem(k);
        if (existing !== v) {
          localStorage.setItem(k, v);
          changedKeys.push(k);
        }
        writtenCount += 1;
      } catch {
        // ignore quota errors
      }
    });

    if (changedKeys.length > 0 || forceNotify) {
      const acc = AuthService.getAccount();
      if (acc) {
        ZeroTrustService.registerOrTouchCurrentDevice(
          acc.email,
          acc.phone,
          getBrowserDeviceLabel()
        );
        ZeroTrustService.appendAudit(
          acc.email,
          auditLabel,
          `${writtenCount} data disinkronkan ke ${getBrowserDeviceLabel()}`,
          'info'
        );
      }
    }

    lastPushedSignature = buildSnapshotSignature(collectTransferSnapshot(includeDompetQu));
    if (changedKeys.length > 0 || forceNotify) {
      emitAllModuleSyncEvents(changedKeys);
    }
  } finally {
    remoteSyncResetTimer = window.setTimeout(() => {
      isApplyingRemoteSync = false;
      remoteSyncResetTimer = null;
    }, 1500);
  }
  return writtenCount;
}

async function registerSessionEcdh(sessionId: string): Promise<void> {
  try {
    if (!crypto?.subtle) return;
    const kp = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits']
    );
    const pubJwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
    sessionEcdhKeys.set(sessionId, kp.privateKey);
    await fetch('/api/pair-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, pubJwk }),
    });
  } catch {
    // Non-fatal: QR & full token still work offline/WS
  }
}

export const DevicePairingService = {
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof crypto !== 'undefined' &&
      Boolean(crypto.subtle)
    );
  },

  getCurrentDeviceLabel(): string {
    return getBrowserDeviceLabel();
  },

  getLinkedDevices(): LinkedDesktopDevice[] {
    return loadLinkedDevices();
  },

  getPairedHost(): PairedHostSession | null {
    return loadPairedHost();
  },

  getPendingPairToken(): string {
    try {
      return localStorage.getItem(PENDING_PAIR_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },

  clearPendingPairToken(): void {
    try {
      localStorage.removeItem(PENDING_PAIR_TOKEN_KEY);
    } catch {
      // ignore
    }
  },

  createPairingSession(): PairingSessionInfo {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let sessionId = '';
    const randBytes = new Uint8Array(6);
    crypto.getRandomValues(randBytes);
    for (let i = 0; i < 6; i += 1) {
      sessionId += chars[randBytes[i] % chars.length];
    }

    const secretBytes = new Uint8Array(16);
    crypto.getRandomValues(secretBytes);
    const secretHex = bytesToHex(secretBytes);
    const shortToken = `WQP1:${sessionId}:${secretHex}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const qrUrl = `${origin}/?pair=${encodeURIComponent(`${sessionId}.${secretHex}`)}`;
    const now = Date.now();
    const channel = `pair:${sessionId}`;

    registerRelayChannels([channel]);
    void registerSessionEcdh(sessionId);

    return {
      sessionId,
      secretHex,
      channel,
      shortToken,
      qrUrl,
      createdAt: now,
      expiresAt: now + 3 * 60 * 1000,
    };
  },

  parsePairingToken(rawInput: string): { sessionId: string; secretHex: string } | null {
    const raw = (rawInput || '').trim();
    if (!raw) return null;

    // 1. URL format: https://.../?pair=ABC123.<32-hex> or #pair=...
    if (raw.includes('pair=')) {
      try {
        const idx = raw.indexOf('pair=');
        const tail = raw.slice(idx + 5).split('&')[0].split('#')[0];
        const decoded = decodeURIComponent(tail).trim();
        const [sid, sec] = decoded.split('.');
        if (sid && sec && /^[A-Z0-9]{6}$/i.test(sid) && /^[a-f0-9]{32}$/i.test(sec)) {
          return { sessionId: sid.toUpperCase(), secretHex: sec.toLowerCase() };
        }
      } catch {
        // fallback below
      }
    }

    // 2. Token format: WQP1:ABC123:<32-hex>
    const wqpMatch = raw.match(/^WQP1:([A-Z0-9]{6}):([a-f0-9]{32})$/i);
    if (wqpMatch) {
      return {
        sessionId: wqpMatch[1].toUpperCase(),
        secretHex: wqpMatch[2].toLowerCase(),
      };
    }

    // 3. Compact dot format: ABC123.<32-hex>
    const dotMatch = raw.match(/^([A-Z0-9]{6})\.([a-f0-9]{32})$/i);
    if (dotMatch) {
      return {
        sessionId: dotMatch[1].toUpperCase(),
        secretHex: dotMatch[2].toLowerCase(),
      };
    }

    // 4. 6-character Session Code typed directly by user (uses ephemeral ECDH key exchange)
    const codeOnly = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z0-9]{6}$/.test(codeOnly)) {
      return {
        sessionId: codeOnly,
        secretHex: '',
      };
    }

    return null;
  },

  /**
   * Dipanggil oleh Laptop/PC untuk menunggu data masuk dari HP setelah QR di-scan atau Kode Sesi diketik.
   * Menggunakan Dual-Transport: WebSocket + HTTP RAM Relay Polling agar tidak pernah gagal putus koneksi.
   */
  listenForPairingOnLaptop(
    session: PairingSessionInfo,
    onLinked: (info: {
      hostLabel: string;
      accountEmail: string;
      restoredKeys: number;
      includeDompetQu: boolean;
    }) => void,
    onError: (msg: string) => void
  ): () => void {
    registerRelayChannels([session.channel]);
    let disposed = false;
    let settledLinkId = '';

    const processEncryptedFrame = async (
      frame: EncryptedFrame,
      senderPubJwk?: JsonWebKey
    ) => {
      if (disposed || settledLinkId) return;
      try {
        let decryptSecret = session.secretHex;
        if (senderPubJwk) {
          const priv = sessionEcdhKeys.get(session.sessionId);
          if (!priv) {
            onError('Sesi QR telah kedaluwarsa. Tekan Muat Ulang QR untuk buat kode baru.');
            return;
          }
          decryptSecret = await deriveEcdhSecretHex(priv, senderPubJwk);
        }

        const decoded = await decryptWithSecret<PairingTransferPayload>(decryptSecret, frame);
        if (decoded.kind !== 'wargaqu_pair_v1' || !decoded.entries) {
          onError('Format tautan perangkat tidak cocok.');
          return;
        }
        if (settledLinkId) return;
        settledLinkId = decoded.linkId;

        const restoredKeys = applySyncedSnapshot(
          decoded.entries,
          decoded.includeDompetQu,
          'Tautkan Laptop via Barcode QR',
          true
        );

        const sharedLiveSecret = decoded.liveSecretHex || session.secretHex;
        const syncChannel = `pair-live:${decoded.linkId}`;
        const hostSession: PairedHostSession = {
          linkId: decoded.linkId,
          hostLabel: decoded.hostLabel || 'HP WargaQu',
          accountEmail: decoded.accountEmail || AuthService.getAccount()?.email || 'Tamu Tertaut',
          includeDompetQu: decoded.includeDompetQu,
          secretHex: sharedLiveSecret,
          syncChannel,
          linkedAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          lastSeq: 0,
        };
        savePairedHost(hostSession);
        registerRelayChannels([syncChannel]);

        const ackBody = {
          linkId: decoded.linkId,
          deviceName: getBrowserDeviceLabel(),
          browserInfo: navigator.userAgent.slice(0, 80),
          restoredKeys,
        };
        publishRelay(session.channel, 'pair:ack', ackBody);
        void fetch(`/api/pair-relay/${encodeURIComponent(session.sessionId)}/ack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ackBody),
        }).catch(() => {});

        onLinked({
          hostLabel: hostSession.hostLabel,
          accountEmail: hostSession.accountEmail,
          restoredKeys,
          includeDompetQu: decoded.includeDompetQu,
        });
      } catch {
        onError('Gagal mendekripsi paket tautan QR. Tekan Muat Ulang QR lalu coba lagi.');
      }
    };

    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<RelayIncomingEvent>).detail;
      if (!detail || detail.channel !== session.channel) return;
      if (detail.eventName === 'pair:payload' && detail.payload && typeof detail.payload === 'object') {
        const raw = detail.payload as { encrypted?: EncryptedFrame; senderPubJwk?: JsonWebKey } & Partial<EncryptedFrame>;
        if (raw.encrypted && raw.encrypted.iv && raw.encrypted.ct) {
          void processEncryptedFrame(raw.encrypted, raw.senderPubJwk);
        } else if (raw.iv && raw.ct) {
          void processEncryptedFrame({ iv: raw.iv, ct: raw.ct });
        }
      }
    };

    window.addEventListener(REALTIME_RELAY_EVENT, handler);

    // HTTP RAM polling fallback every 1.4s in case WebSocket missed the frame
    const pollHttp = async () => {
      if (disposed || settledLinkId) return;
      try {
        const res = await fetch(`/api/pair-relay/${encodeURIComponent(session.sessionId)}`);
        if (!res.ok || disposed || settledLinkId) return;
        const data = (await res.json()) as {
          found?: boolean;
          encrypted?: EncryptedFrame;
          senderPubJwk?: JsonWebKey;
        };
        if (data.found && data.encrypted?.iv && data.encrypted?.ct) {
          await processEncryptedFrame(data.encrypted, data.senderPubJwk);
        }
      } catch {
        // silent retry
      }
    };

    void pollHttp();
    const pollTimer = window.setInterval(() => {
      void pollHttp();
    }, 1400);

    return () => {
      disposed = true;
      window.removeEventListener(REALTIME_RELAY_EVENT, handler);
      window.clearInterval(pollTimer);
    };
  },

  /**
   * Dipanggil oleh HP setelah scan QR Laptop atau mengetik 6 huruf Kode Sesi.
   */
  async sendPairingFromPhone(
    parsedToken: { sessionId: string; secretHex: string },
    options: { includeDompetQu: boolean }
  ): Promise<{
    deviceName: string;
    keyCount: number;
    acknowledged: boolean;
  }> {
    if (!this.isSupported()) {
      throw new Error('Peramban tidak mendukung enkripsi WebCrypto AES-GCM.');
    }

    const channel = `pair:${parsedToken.sessionId}`;
    const linkId = `lnk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const syncChannel = `pair-live:${linkId}`;
    registerRelayChannels([channel, syncChannel]);

    let transportSecretHex = parsedToken.secretHex;
    let senderPubJwk: JsonWebKey | undefined;
    let liveSecretHex = parsedToken.secretHex;

    // Jika user mengetik 6-huruf Kode Sesi secara langsung (tanpa QR/secretHex), lakukan ECDH P-256
    if (!transportSecretHex) {
      const sessRes = await fetch(`/api/pair-session/${encodeURIComponent(parsedToken.sessionId)}`);
      if (!sessRes.ok) {
        const errBody = (await sessRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          errBody.error ||
            'Kode sesi tidak ditemukan atau sudah kedaluwarsa. Klik Muat Ulang QR di Laptop.'
        );
      }
      const sessData = (await sessRes.json()) as { pubJwk?: JsonWebKey };
      if (!sessData.pubJwk) {
        throw new Error('Kunci sesi Laptop tidak tersedia. Muat ulang QR di Laptop.');
      }

      const phoneKp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits']
      );
      senderPubJwk = await crypto.subtle.exportKey('jwk', phoneKp.publicKey);
      transportSecretHex = await deriveEcdhSecretHex(phoneKp.privateKey, sessData.pubJwk);

      const liveBytes = new Uint8Array(16);
      crypto.getRandomValues(liveBytes);
      liveSecretHex = bytesToHex(liveBytes);
    }

    const acc = AuthService.getAccount();
    const hostLabel = acc
      ? `${AuthService.getDisplayName(acc)} (${getBrowserDeviceLabel()})`
      : getBrowserDeviceLabel();

    const entries = collectTransferSnapshot(options.includeDompetQu);
    const keyCount = Object.keys(entries).length;

    const payload: PairingTransferPayload = {
      kind: 'wargaqu_pair_v1',
      linkId,
      hostLabel,
      accountEmail: acc?.email || 'Tamu WargaQu (Tertaut)',
      includeDompetQu: options.includeDompetQu,
      liveSecretHex,
      sentAt: new Date().toISOString(),
      entries,
    };

    const encrypted = await encryptWithSecret(transportSecretHex, payload);

    const ackPromise = new Promise<{ deviceName: string; acknowledged: boolean }>(resolve => {
      let settled = false;
      let httpPollTimer: number | null = null;

      const finish = (deviceName: string, acknowledged: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutTimer);
        if (httpPollTimer !== null) window.clearInterval(httpPollTimer);
        window.removeEventListener(REALTIME_RELAY_EVENT, onAck);
        resolve({ deviceName, acknowledged });
      };

      const timeoutTimer = window.setTimeout(() => {
        finish('Laptop / PC Browser', false);
      }, 8500);

      const onAck = (ev: Event) => {
        const d = (ev as CustomEvent<RelayIncomingEvent>).detail;
        if (!d || d.channel !== channel || d.eventName !== 'pair:ack') return;
        const ackBody = (d.payload || {}) as { linkId?: string; deviceName?: string };
        if (ackBody.linkId && ackBody.linkId !== linkId) return;
        finish(ackBody.deviceName || 'Laptop / PC Browser', true);
      };

      window.addEventListener(REALTIME_RELAY_EVENT, onAck);

      httpPollTimer = window.setInterval(async () => {
        try {
          const res = await fetch(
            `/api/pair-relay/${encodeURIComponent(parsedToken.sessionId)}/ack`
          );
          if (!res.ok) return;
          const data = (await res.json()) as {
            acked?: boolean;
            linkId?: string;
            deviceName?: string;
          };
          if (data.acked && (!data.linkId || data.linkId === linkId)) {
            finish(data.deviceName || 'Laptop / PC Browser', true);
          }
        } catch {
          // ignore
        }
      }, 900);
    });

    // Dual-transport send: HTTP RAM Relay + WebSocket Relay simultaneously
    const httpPostPromise = fetch(
      `/api/pair-relay/${encodeURIComponent(parsedToken.sessionId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          encrypted,
          senderPubJwk,
        }),
      }
    ).catch(() => null);

    publishRelay(
      channel,
      'pair:payload',
      senderPubJwk ? { encrypted, senderPubJwk } : encrypted
    );

    await httpPostPromise;
    const ack = await ackPromise;

    const nowIso = new Date().toISOString();
    const existing = loadLinkedDevices();
    const nextList: LinkedDesktopDevice[] = [
      {
        linkId,
        deviceName: ack.deviceName,
        browserInfo: ack.acknowledged ? 'Terhubung Real-Time' : 'Terkirim via Relay',
        includeDompetQu: options.includeDompetQu,
        secretHex: liveSecretHex,
        syncChannel,
        linkedAt: nowIso,
        lastSyncAt: nowIso,
        lastSeq: 0,
      },
      ...existing.slice(0, 9),
    ];
    saveLinkedDevices(nextList);
    lastPushedSignature = buildSnapshotSignature(entries);

    if (acc) {
      ZeroTrustService.appendAudit(
        acc.email,
        'Tautkan Laptop via Barcode QR',
        `${ack.deviceName} (${keyCount} data · DompetQu: ${
          options.includeDompetQu ? 'Ikut' : 'Terisolasi di HP'
        })`,
        'info'
      );
    }

    return {
      deviceName: ack.deviceName,
      keyCount,
      acknowledged: ack.acknowledged,
    };
  },

  async pushLiveUpdateIfChanged(force = false): Promise<number> {
    if (isApplyingRemoteSync || !this.isSupported()) return 0;

    const pairedHost = loadPairedHost();
    const linkedDevices = loadLinkedDevices();
    if (!pairedHost && linkedDevices.length === 0) return 0;

    const myDeviceId = AuthService.getHiddenDeviceId();
    let sentCount = 0;

    // 1. Jika ini HP yang menautkan ke >= 1 Laptop
    if (linkedDevices.length > 0) {
      const fullEntries = collectTransferSnapshot(true);
      const fullSig = buildSnapshotSignature(fullEntries);
      if (force || fullSig !== lastPushedSignature) {
        lastPushedSignature = fullSig;
        const acc = AuthService.getAccount();
        const nowIso = new Date().toISOString();
        const updatedList = [...linkedDevices];

        for (let i = 0; i < updatedList.length; i += 1) {
          const dev = updatedList[i];
          const entries = dev.includeDompetQu
            ? fullEntries
            : collectTransferSnapshot(false);
          const payload: PairingTransferPayload = {
            kind: 'wargaqu_pair_v1',
            linkId: dev.linkId,
            hostLabel: getBrowserDeviceLabel(),
            accountEmail: acc?.email || 'Tamu WargaQu (Tertaut)',
            includeDompetQu: dev.includeDompetQu,
            sentAt: nowIso,
            entries,
          };
          const encrypted = await encryptWithSecret(dev.secretHex, payload);
          registerRelayChannels([dev.syncChannel]);
          publishRelay(dev.syncChannel, 'pair:live_sync', encrypted);

          let nextSeq = dev.lastSeq ?? 0;
          try {
            const res = await fetch(`/api/pair-live/${encodeURIComponent(dev.linkId)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ senderDeviceId: myDeviceId, encrypted }),
            });
            if (res.ok) {
              const r = (await res.json()) as { seq?: number };
              if (typeof r.seq === 'number') nextSeq = r.seq;
            }
          } catch {
            // WS still handles live push
          }

          updatedList[i] = { ...dev, lastSyncAt: nowIso, lastSeq: nextSeq };
          sentCount += 1;
        }
        saveLinkedDevices(updatedList);
      }
    }

    // 2. Jika ini Laptop yang tertaut ke HP, dorong perubahan dari Laptop balik ke HP juga
    if (pairedHost) {
      const entries = collectTransferSnapshot(pairedHost.includeDompetQu);
      const sig = buildSnapshotSignature(entries);
      if (force || sig !== lastPushedSignature) {
        lastPushedSignature = sig;
        const nowIso = new Date().toISOString();
        const payload: PairingTransferPayload = {
          kind: 'wargaqu_pair_v1',
          linkId: pairedHost.linkId,
          hostLabel: getBrowserDeviceLabel(),
          accountEmail: pairedHost.accountEmail,
          includeDompetQu: pairedHost.includeDompetQu,
          sentAt: nowIso,
          entries,
        };
        const encrypted = await encryptWithSecret(pairedHost.secretHex, payload);
        registerRelayChannels([pairedHost.syncChannel]);
        publishRelay(pairedHost.syncChannel, 'pair:live_sync', encrypted);

        let nextSeq = pairedHost.lastSeq ?? 0;
        try {
          const res = await fetch(`/api/pair-live/${encodeURIComponent(pairedHost.linkId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderDeviceId: myDeviceId, encrypted }),
          });
          if (res.ok) {
            const r = (await res.json()) as { seq?: number };
            if (typeof r.seq === 'number') nextSeq = r.seq;
          }
        } catch {
          // ignore
        }

        savePairedHost({ ...pairedHost, lastSyncAt: nowIso, lastSeq: nextSeq });
        sentCount += 1;
      }
    }

    return sentCount;
  },

  async pullLiveUpdatesFromServer(): Promise<number> {
    if (isApplyingRemoteSync || !this.isSupported()) return 0;
    const host = loadPairedHost();
    const linked = loadLinkedDevices();
    if (!host && linked.length === 0) return 0;

    const myDeviceId = AuthService.getHiddenDeviceId();
    let appliedTotal = 0;

    const targets: Array<{
      linkId: string;
      secretHex: string;
      includeDompetQu: boolean;
      lastSeq: number;
      isHost: boolean;
    }> = [];

    if (host) {
      targets.push({
        linkId: host.linkId,
        secretHex: host.secretHex,
        includeDompetQu: host.includeDompetQu,
        lastSeq: host.lastSeq ?? 0,
        isHost: true,
      });
    } else {
      linked.forEach(dev => {
        targets.push({
          linkId: dev.linkId,
          secretHex: dev.secretHex,
          includeDompetQu: dev.includeDompetQu,
          lastSeq: dev.lastSeq ?? 0,
          isHost: false,
        });
      });
    }

    for (const t of targets) {
      try {
        const res = await fetch(
          `/api/pair-live/${encodeURIComponent(t.linkId)}?sinceSeq=${t.lastSeq}&deviceId=${encodeURIComponent(myDeviceId)}`
        );
        if (!res.ok) continue;
        const data = (await res.json()) as {
          hasUpdate?: boolean;
          seq?: number;
          encrypted?: EncryptedFrame;
        };
        if (!data.hasUpdate || !data.encrypted?.iv || !data.encrypted?.ct) continue;

        const decoded = await decryptWithSecret<PairingTransferPayload>(
          t.secretHex,
          data.encrypted
        );
        if (decoded.kind !== 'wargaqu_pair_v1' || !decoded.entries) continue;

        const applied = applySyncedSnapshot(
          decoded.entries,
          t.includeDompetQu && decoded.includeDompetQu,
          'Sinkronisasi Live Antar-Perangkat'
        );
        appliedTotal += applied;

        const nextSeq = typeof data.seq === 'number' ? data.seq : t.lastSeq + 1;
        const nowIso = new Date().toISOString();
        if (t.isHost) {
          const latestHost = loadPairedHost();
          if (latestHost && latestHost.linkId === t.linkId) {
            savePairedHost({ ...latestHost, lastSyncAt: nowIso, lastSeq: nextSeq });
          }
        } else {
          const latestList = loadLinkedDevices();
          saveLinkedDevices(
            latestList.map(d =>
              d.linkId === t.linkId ? { ...d, lastSyncAt: nowIso, lastSeq: nextSeq } : d
            )
          );
        }
      } catch {
        // ignore transient errors
      }
    }

    return appliedTotal;
  },

  unlinkLaptopFromPhone(linkId: string): void {
    const list = loadLinkedDevices();
    const target = list.find(d => d.linkId === linkId);
    if (target) {
      registerRelayChannels([target.syncChannel]);
      publishRelay(target.syncChannel, 'pair:unlink', {
        linkId,
        reason: 'Diputuskan dari HP pemilik akun',
      });
    }
    saveLinkedDevices(list.filter(d => d.linkId !== linkId));
  },

  disconnectLaptopSession(clearSyncedData = true): void {
    const host = loadPairedHost();
    if (host) {
      registerRelayChannels([host.syncChannel]);
      publishRelay(host.syncChannel, 'pair:laptop_left', {
        linkId: host.linkId,
        deviceName: getBrowserDeviceLabel(),
      });
    }
    savePairedHost(null);

    if (clearSyncedData) {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (!k || EXCLUDED_DEVICE_LOCAL_KEYS.has(k)) continue;
        if (
          k.startsWith('wargaqu_') ||
          k.startsWith('leluhurqu_grid_') ||
          k.startsWith('uq_') ||
          k.startsWith('baksoqu_') ||
          k.startsWith('siagaqu_')
        ) {
          toRemove.push(k);
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      AuthService.logout();
      emitAllModuleSyncEvents(toRemove);
    }
  },

  startLiveSync(onRemoteNotice?: (msg: string) => void): void {
    if (liveSyncStarted || typeof window === 'undefined') return;
    liveSyncStarted = true;

    const ensureChannelsJoined = () => {
      const channels: string[] = [];
      const host = loadPairedHost();
      if (host?.syncChannel) channels.push(host.syncChannel);
      for (const dev of loadLinkedDevices()) {
        if (dev.syncChannel) channels.push(dev.syncChannel);
      }
      if (channels.length > 0) {
        registerRelayChannels(channels);
      }
    };

    ensureChannelsJoined();

    const handleRelayEvent = async (ev: Event) => {
      const detail = (ev as CustomEvent<RelayIncomingEvent>).detail;
      if (!detail || !detail.channel?.startsWith('pair-live:')) return;

      const host = loadPairedHost();
      const linked = loadLinkedDevices();

      if (detail.eventName === 'pair:unlink' && host && host.syncChannel === detail.channel) {
        this.disconnectLaptopSession(true);
        onRemoteNotice?.('Tautan Laptop diputuskan dari HP utama. Sesi dibersihkan.');
        return;
      }

      if (detail.eventName === 'pair:laptop_left') {
        const leftBody = (detail.payload || {}) as { linkId?: string; deviceName?: string };
        const matched = linked.find(
          d => d.syncChannel === detail.channel || (leftBody.linkId && d.linkId === leftBody.linkId)
        );
        if (matched) {
          saveLinkedDevices(linked.filter(d => d.linkId !== matched.linkId));
          onRemoteNotice?.(`${matched.deviceName} keluar dari sesi tautan.`);
        }
        return;
      }

      if (detail.eventName === 'pair:live_sync' && detail.payload && typeof detail.payload === 'object') {
        const frame = detail.payload as EncryptedFrame;
        let secret = '';
        let allowDompetQu = false;

        if (host && host.syncChannel === detail.channel) {
          secret = host.secretHex;
          allowDompetQu = host.includeDompetQu;
        } else {
          const matchedDev = linked.find(d => d.syncChannel === detail.channel);
          if (matchedDev) {
            secret = matchedDev.secretHex;
            allowDompetQu = matchedDev.includeDompetQu;
          }
        }

        if (!secret) return;
        try {
          const decoded = await decryptWithSecret<PairingTransferPayload>(secret, frame);
          if (decoded.kind !== 'wargaqu_pair_v1' || !decoded.entries) return;
          applySyncedSnapshot(
            decoded.entries,
            allowDompetQu && decoded.includeDompetQu,
            'Sinkronisasi Live Antar-Perangkat'
          );
          if (host && host.syncChannel === detail.channel) {
            savePairedHost({ ...host, lastSyncAt: new Date().toISOString() });
          } else {
            const updated = linked.map(d =>
              d.syncChannel === detail.channel ? { ...d, lastSyncAt: new Date().toISOString() } : d
            );
            saveLinkedDevices(updated);
          }
        } catch {
          // ignore mismatched frame
        }
      }
    };

    const scheduleOutboundSync = () => {
      if (isApplyingRemoteSync) return;
      if (syncDebounceTimer !== null) {
        window.clearTimeout(syncDebounceTimer);
      }
      syncDebounceTimer = window.setTimeout(() => {
        void this.pushLiveUpdateIfChanged(false);
      }, 1600);
    };

    window.addEventListener(REALTIME_RELAY_EVENT, handleRelayEvent);
    window.addEventListener(DEVICE_PAIRING_SYNC_EVENT, ensureChannelsJoined);
    [
      AUTH_SYNC_EVENT,
      RT_SYNC_EVENT,
      DOMPETQU_SYNC_EVENT,
      SIAGA_CIRCLE_SYNC_EVENT,
      ZERO_TRUST_SYNC_EVENT,
      MONETIZATION_SYNC_EVENT,
      ACCOUNT_GOV_SYNC_EVENT,
      'storage',
    ].forEach(evName => window.addEventListener(evName, scheduleOutboundSync));

    // When user switches back to HP or Laptop tab, immediately pull remote edits & push local edits
    const handleWakeSync = () => {
      if (document.visibilityState === 'visible') {
        void this.pullLiveUpdatesFromServer().then(() => this.pushLiveUpdateIfChanged(false));
      }
    };
    window.addEventListener('focus', handleWakeSync);
    document.addEventListener('visibilitychange', handleWakeSync);

    // Pull latest state immediately on startup if paired
    void this.pullLiveUpdatesFromServer();

    // Periodic diff check (for modules like LeluhurQu / UsahaQu / ChatQu that write directly to localStorage)
    periodicCheckTimer = window.setInterval(() => {
      if (!isApplyingRemoteSync) {
        void this.pushLiveUpdateIfChanged(false);
      }
    }, 3000);

    // Periodic HTTP live-sync pull fallback every 4.5s
    periodicPullTimer = window.setInterval(() => {
      if (!isApplyingRemoteSync) {
        void this.pullLiveUpdatesFromServer();
      }
    }, 4500);

    void periodicCheckTimer;
    void periodicPullTimer;
  },
};
