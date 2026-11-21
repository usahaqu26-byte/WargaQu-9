import {
  AUTH_SYNC_EVENT,
  AuthAccount,
  AuthService,
  normalizePhoneDigits,
} from './authService';
import { DOMPETQU_SYNC_EVENT } from './dompetQuStorage';
import { RT_SYNC_EVENT } from './rtSiagaStorage';
import { SIAGA_CIRCLE_SYNC_EVENT } from './siagaCircleService';
import { ZERO_TRUST_SYNC_EVENT, ZeroTrustService } from './zeroTrustService';
import { MONETIZATION_SYNC_EVENT } from './monetizationService';
import { ACCOUNT_GOV_SYNC_EVENT } from './accountGovernanceService';
import { DEVICE_PAIRING_SYNC_EVENT, PairingSyncEventDetail } from './devicePairingService';
import { LELUHUR_SYNC_EVENT } from './leluhurVersionSyncService';
import { buildApiUrl, isNativeCapacitorApk } from './appOriginService';

export const APK_MIGRATION_DONE_KEY = 'wargaqu_apk_migration_done_v1';
export const APK_MIGRATION_BANNER_DISMISSED_KEY = 'wargaqu_apk_banner_dismissed_v1';
const LAST_SYNC_TS_KEY = 'wargaqu_last_account_sync_ts_v1';
const PBKDF2_ITERATIONS = 100000;

const EXCLUDED_MIGRATION_KEYS = new Set<string>([
  'wargaqu_hidden_device_token_v1',
  'wargaqu_device_binding_v1',
  'wargaqu_autobackup_prefs_v1',
  'wargaqu_viewport_mode_v1',
  'wargaqu_linked_devices_v1',
  'wargaqu_paired_host_v1',
  'wargaqu_pending_pair_token_v1',
  APK_MIGRATION_DONE_KEY,
  APK_MIGRATION_BANNER_DISMISSED_KEY,
  LAST_SYNC_TS_KEY,
]);

interface MigrationSnapshotPayload {
  kind: 'wargaqu_migration_v1';
  source: 'pwa' | 'apk';
  ownerEmail: string;
  sentAt: string;
  entries: Record<string, string>;
}

export interface PwaHandoffCreated {
  code: string;
  secretHex: string;
  shareToken: string;
  deepLinkUrl: string;
  intentUrl: string;
  keyCount: number;
  expiresAt: number;
}

let autoSyncStarted = false;
let isApplyingRemoteMigration = false;
let resetApplyingTimer: number | null = null;
let lastPushedSignature = '';
let pushDebounceTimer: number | null = null;

function shouldSyncKey(key: string): boolean {
  if (!key || EXCLUDED_MIGRATION_KEYS.has(key)) return false;
  return (
    key.startsWith('wargaqu_') ||
    key.startsWith('leluhurqu_grid_') ||
    key.startsWith('uq_') ||
    key.startsWith('baksoqu_') ||
    key.startsWith('siagaqu_')
  );
}

export function collectMigrationSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return snapshot;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !shouldSyncKey(key)) continue;
    const val = localStorage.getItem(key);
    if (val !== null) {
      snapshot[key] = val;
    }
  }
  return snapshot;
}

function hashFnv1a(str: string): string {
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
    .map(k => `${k}:${entries[k].length}:${hashFnv1a(entries[k])}`)
    .join('|');
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
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

async function computeAccountSyncHash(email: string, phone: string): Promise<string> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = normalizePhoneDigits(phone || '');
  const material = `wargaqu-acct-sync-v1:${cleanEmail}:${cleanPhone}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return bytesToHex(new Uint8Array(digest));
}

async function deriveAccountAesKey(
  email: string,
  phone: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = normalizePhoneDigits(phone || '');
  const passphrase = `wargaqu-acct-kdf-v1:${cleanEmail}:${cleanPhone}`;
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function deriveHandoffAesKey(secretHex: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`wargaqu-handoff-v1:${secretHex.trim().toLowerCase()}`)
  );
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function emitScopedModuleSyncEvents(changedKeys: string[] = []) {
  if (typeof window === 'undefined' || changedKeys.length === 0) return;
  const hasPrefix = (prefixes: string[]) =>
    changedKeys.some(k => prefixes.some(p => k.startsWith(p)));

  if (hasPrefix(['wargaqu_auth_'])) {
    window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
  }
  if (hasPrefix(['wargaqu_rt_'])) {
    window.dispatchEvent(new CustomEvent(RT_SYNC_EVENT));
  }
  if (hasPrefix(['siagaqu_', 'wargaqu_siaga'])) {
    window.dispatchEvent(new CustomEvent(SIAGA_CIRCLE_SYNC_EVENT));
  }
  if (hasPrefix(['wargaqu_zt_', 'wargaqu_zero_'])) {
    window.dispatchEvent(new CustomEvent(ZERO_TRUST_SYNC_EVENT));
  }
  if (hasPrefix(['wargaqu_monetiz'])) {
    window.dispatchEvent(new CustomEvent(MONETIZATION_SYNC_EVENT));
  }
  if (hasPrefix(['wargaqu_gov', 'wargaqu_account_gov'])) {
    window.dispatchEvent(new CustomEvent(ACCOUNT_GOV_SYNC_EVENT));
  }
  if (hasPrefix(['wargaqu_dompetqu_'])) {
    window.dispatchEvent(new CustomEvent(DOMPETQU_SYNC_EVENT));
  }
  if (hasPrefix(['wargaqu_leluhur_', 'leluhurqu_grid_'])) {
    window.dispatchEvent(new CustomEvent(LELUHUR_SYNC_EVENT, { detail: { changedKeys } }));
  }
  window.dispatchEvent(
    new CustomEvent<PairingSyncEventDetail>(DEVICE_PAIRING_SYNC_EVENT, {
      detail: { remoteApplied: true, changedKeys },
    })
  );
}

function applyMigratedSnapshot(
  entries: Record<string, string>,
  auditLabel: string,
  serverUpdatedAt?: number,
  allowAuthRestore = false
): number {
  isApplyingRemoteMigration = true;
  if (resetApplyingTimer !== null) {
    window.clearTimeout(resetApplyingTimer);
  }

  let writtenCount = 0;
  const changedKeys: string[] = [];
  const physicalDeviceId = AuthService.getHiddenDeviceId();

  try {
    Object.entries(entries).forEach(([key, rawVal]) => {
      if (!shouldSyncKey(key) || typeof rawVal !== 'string') return;
      if (key === 'wargaqu_auth_account_v1' && !allowAuthRestore) {
        return;
      }
      let finalVal = rawVal;

      // Adapt transferred auth session cleanly to this physical APK's hidden device ID
      if (key === 'wargaqu_auth_account_v1') {
        try {
          const parsed = JSON.parse(rawVal) as Partial<AuthAccount>;
          if (parsed && parsed.email && parsed.phone) {
            finalVal = JSON.stringify({
              ...parsed,
              deviceId: physicalDeviceId,
            });
          }
        } catch {
          // keep rawVal
        }
      }

      try {
        const prev = localStorage.getItem(key);
        if (prev !== finalVal) {
          localStorage.setItem(key, finalVal);
          changedKeys.push(key);
        }
        writtenCount += 1;
      } catch {
        // ignore storage quota errors
      }
    });

    // Hydrate device binding on fresh APK cleanly if PWA session was transferred
    const migratedAcc = AuthService.getAccount();
    if (migratedAcc && changedKeys.length > 0) {
      AuthService.getDeviceBinding();
      ZeroTrustService.registerOrTouchCurrentDevice(
        migratedAcc.email,
        migratedAcc.phone,
        isNativeCapacitorApk() ? 'WargaQu APK Android' : 'WargaQu PWA Browser'
      );
      ZeroTrustService.appendAudit(
        migratedAcc.email,
        auditLabel,
        `${writtenCount} item data berhasil dipindahkan ke perangkat ini`,
        'info'
      );
    }

    try {
      localStorage.setItem(APK_MIGRATION_DONE_KEY, '1');
      if (typeof serverUpdatedAt === 'number' && serverUpdatedAt > 0) {
        localStorage.setItem(LAST_SYNC_TS_KEY, String(serverUpdatedAt));
      }
    } catch {
      // ignore
    }

    lastPushedSignature = buildSnapshotSignature(collectMigrationSnapshot());
    emitScopedModuleSyncEvents(changedKeys);
  } finally {
    resetApplyingTimer = window.setTimeout(() => {
      isApplyingRemoteMigration = false;
      resetApplyingTimer = null;
    }, 1800);
  }

  return writtenCount;
}

export const ApkMigrationService = {
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof crypto !== 'undefined' &&
      Boolean(crypto.subtle)
    );
  },

  isFreshEmptyInstallation(): boolean {
    if (typeof localStorage === 'undefined') return true;
    try {
      if (localStorage.getItem(APK_MIGRATION_DONE_KEY) === '1') return false;
      if (AuthService.getAccount()) return false;
      if (localStorage.getItem('wargaqu_leluhur_trah_list_v1')) return false;
      if (localStorage.getItem('wargaqu_rt_communities_v1')) return false;
      if (localStorage.getItem('wargaqu_dompetqu_v1_tx')) return false;
      if (localStorage.getItem('uq_history')) return false;
      return true;
    } catch {
      return false;
    }
  },

  isBannerDismissed(): boolean {
    try {
      return localStorage.getItem(APK_MIGRATION_BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  },

  dismissBanner(): void {
    try {
      localStorage.setItem(APK_MIGRATION_BANNER_DISMISSED_KEY, '1');
    } catch {
      // ignore
    }
  },

  async pushAccountSnapshotNow(force = false): Promise<boolean> {
    if (!this.isSupported() || isApplyingRemoteMigration) return false;
    const acc = AuthService.getAccount();
    if (!acc || !acc.email || !acc.phone) return false;

    const entries = collectMigrationSnapshot();
    const sig = buildSnapshotSignature(entries);
    if (!force && sig === lastPushedSignature) return false;

    const payload: MigrationSnapshotPayload = {
      kind: 'wargaqu_migration_v1',
      source: isNativeCapacitorApk() ? 'apk' : 'pwa',
      ownerEmail: acc.email,
      sentAt: new Date().toISOString(),
      entries,
    };

    try {
      const accountHash = await computeAccountSyncHash(acc.email, acc.phone);
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const aesKey = await deriveAccountAesKey(acc.email, acc.phone, salt);
      const encoded = new TextEncoder().encode(JSON.stringify(payload));
      const cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        aesKey,
        encoded
      );

      const res = await fetch(buildApiUrl('/api/account-sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountHash,
          salt: toBase64(salt),
          iv: toBase64(iv),
          ct: toBase64(new Uint8Array(cipherBuf)),
          keyCount: Object.keys(entries).length,
          source: payload.source,
        }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as { updatedAt?: number };
      lastPushedSignature = sig;
      if (typeof body.updatedAt === 'number') {
        try {
          localStorage.setItem(LAST_SYNC_TS_KEY, String(body.updatedAt));
        } catch {
          // ignore
        }
      }
      return true;
    } catch {
      return false;
    }
  },

  async pullAccountSnapshot(
    email: string,
    phone: string,
    options?: { onlyIfNewer?: boolean }
  ): Promise<{ restored: boolean; keyCount: number; source: string }> {
    if (!this.isSupported()) {
      return { restored: false, keyCount: 0, source: '' };
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();
    if (!cleanEmail || !cleanPhone) {
      return { restored: false, keyCount: 0, source: '' };
    }

    try {
      const accountHash = await computeAccountSyncHash(cleanEmail, cleanPhone);
      const res = await fetch(
        buildApiUrl(`/api/account-sync/${encodeURIComponent(accountHash)}`)
      );
      if (!res.ok) return { restored: false, keyCount: 0, source: '' };
      const data = (await res.json()) as {
        found?: boolean;
        salt?: string;
        iv?: string;
        ct?: string;
        source?: string;
        updatedAt?: number;
      };
      if (!data.found || !data.salt || !data.iv || !data.ct) {
        return { restored: false, keyCount: 0, source: '' };
      }

      if (options?.onlyIfNewer) {
        const localTs = Number(localStorage.getItem(LAST_SYNC_TS_KEY) || 0);
        if (typeof data.updatedAt === 'number' && localTs >= data.updatedAt) {
          return { restored: false, keyCount: 0, source: data.source || '' };
        }
      }

      const salt = fromBase64(data.salt);
      const iv = fromBase64(data.iv);
      const ct = fromBase64(data.ct);
      const aesKey = await deriveAccountAesKey(cleanEmail, cleanPhone, salt);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        aesKey,
        ct.buffer as ArrayBuffer
      );
      const decoded = JSON.parse(new TextDecoder().decode(plainBuf)) as MigrationSnapshotPayload;
      if (decoded.kind !== 'wargaqu_migration_v1' || !decoded.entries) {
        return { restored: false, keyCount: 0, source: '' };
      }

      const allowAuthRestore = this.isFreshEmptyInstallation();
      const restoredKeys = applyMigratedSnapshot(
        decoded.entries,
        'Sinkronisasi Akun Otomatis PWA ↔ APK',
        data.updatedAt,
        allowAuthRestore
      );
      return {
        restored: restoredKeys > 0,
        keyCount: restoredKeys,
        source: data.source || decoded.source || 'pwa',
      };
    } catch {
      return { restored: false, keyCount: 0, source: '' };
    }
  },

  async createPwaToApkHandoff(): Promise<PwaHandoffCreated> {
    if (!this.isSupported()) {
      throw new Error('Peramban tidak mendukung enkripsi AES-GCM.');
    }

    const entries = collectMigrationSnapshot();
    const keyCount = Object.keys(entries).length;
    const secretBytes = crypto.getRandomValues(new Uint8Array(16));
    const secretHex = bytesToHex(secretBytes);
    const acc = AuthService.getAccount();

    const payload: MigrationSnapshotPayload = {
      kind: 'wargaqu_migration_v1',
      source: isNativeCapacitorApk() ? 'apk' : 'pwa',
      ownerEmail: acc?.email || 'tamu@wargaqu.id',
      sentAt: new Date().toISOString(),
      entries,
    };

    const aesKey = await deriveHandoffAesKey(secretHex);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      aesKey,
      encoded
    );

    const res = await fetch(buildApiUrl('/api/pwa-handoff'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        iv: toBase64(iv),
        ct: toBase64(new Uint8Array(cipherBuf)),
        keyCount,
      }),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error || 'Gagal mengunggah paket transfer ke server relay.');
    }
    const body = (await res.json()) as { code: string; expiresAt: number };
    const code = String(body.code || '').toUpperCase();
    const shareToken = `WQH1:${code}:${secretHex}`;
    const deepLinkUrl = `wargaqu://handoff?c=${encodeURIComponent(code)}&s=${encodeURIComponent(secretHex)}`;
    const intentUrl = `intent://handoff?c=${encodeURIComponent(code)}&s=${encodeURIComponent(secretHex)}#Intent;scheme=wargaqu;package=com.wargaqu.app;end`;

    return {
      code,
      secretHex,
      shareToken,
      deepLinkUrl,
      intentUrl,
      keyCount,
      expiresAt: body.expiresAt,
    };
  },

  parseHandoffInput(rawInput: string): { code: string; secretHex: string } | null {
    const raw = (rawInput || '').trim();
    if (!raw) return null;

    // 1. Token WQH1:CODE:SECRET
    const tokenMatch = raw.match(/WQH1:([A-Z0-9]{6}):([a-f0-9]{32})/i);
    if (tokenMatch) {
      return {
        code: tokenMatch[1].toUpperCase(),
        secretHex: tokenMatch[2].toLowerCase(),
      };
    }

    // 2. Deep-link wargaqu://handoff?c=CODE&s=SECRET or ?handoff=CODE.SECRET
    try {
      const normalized = raw.startsWith('wargaqu://')
        ? raw.replace('wargaqu://', 'https://wargaqu.local/')
        : raw.includes('://')
        ? raw
        : `https://wargaqu.local/${raw.startsWith('?') ? '' : '?'}${raw}`;
      const u = new URL(normalized);
      const c = (u.searchParams.get('c') || '').trim().toUpperCase();
      const s = (u.searchParams.get('s') || '').trim().toLowerCase();
      if (/^[A-Z0-9]{6}$/.test(c) && /^[a-f0-9]{32}$/.test(s)) {
        return { code: c, secretHex: s };
      }
      const handoff = (u.searchParams.get('handoff') || '').trim();
      if (handoff.includes('.')) {
        const [hc, hs] = handoff.split('.');
        if (/^[A-Z0-9]{6}$/i.test(hc) && /^[a-f0-9]{32}$/i.test(hs)) {
          return { code: hc.toUpperCase(), secretHex: hs.toLowerCase() };
        }
      }
    } catch {
      // ignore URL parse failure
    }

    return null;
  },

  async consumePwaHandoff(rawOrToken: string): Promise<{
    restoredKeys: number;
    ownerEmail: string;
    code: string;
  }> {
    if (!this.isSupported()) {
      throw new Error('Perangkat tidak mendukung dekripsi WebCrypto AES-GCM.');
    }
    const parsed = this.parseHandoffInput(rawOrToken);
    if (!parsed) {
      throw new Error(
        'Format kode transfer tidak valid. Salin token WQH1:... atau tekan tombol "Kirim ke APK" dari PWA.'
      );
    }

    const res = await fetch(buildApiUrl(`/api/pwa-handoff/${encodeURIComponent(parsed.code)}`));
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        errBody.error || 'Kode transfer PWA tidak ditemukan atau sudah kedaluwarsa (24 jam).'
      );
    }
    const data = (await res.json()) as { found?: boolean; iv?: string; ct?: string };
    if (!data.found || !data.iv || !data.ct) {
      throw new Error('Paket data transfer PWA kosong atau kedaluwarsa.');
    }

    let decoded: MigrationSnapshotPayload;
    try {
      const aesKey = await deriveHandoffAesKey(parsed.secretHex);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(data.iv).buffer as ArrayBuffer },
        aesKey,
        fromBase64(data.ct).buffer as ArrayBuffer
      );
      decoded = JSON.parse(new TextDecoder().decode(plainBuf)) as MigrationSnapshotPayload;
    } catch {
      throw new Error('Gagal mendekripsi data dari PWA. Pastikan kode transfer utuh.');
    }

    if (decoded.kind !== 'wargaqu_migration_v1' || !decoded.entries) {
      throw new Error('Isi paket transfer PWA tidak dikenali.');
    }

    const restoredKeys = applyMigratedSnapshot(
      decoded.entries,
      'Transfer Langsung PWA → APK',
      undefined,
      true
    );

    return {
      restoredKeys,
      ownerEmail: decoded.ownerEmail || 'WargaQu',
      code: parsed.code,
    };
  },

  startAutoSync(onAutoRestored?: (msg: string) => void): void {
    if (autoSyncStarted || typeof window === 'undefined') return;
    autoSyncStarted = true;

    lastPushedSignature = buildSnapshotSignature(collectMigrationSnapshot());

    const schedulePush = () => {
      if (isApplyingRemoteMigration) return;
      if (!AuthService.getAccount()) return;
      if (pushDebounceTimer !== null) {
        window.clearTimeout(pushDebounceTimer);
      }
      pushDebounceTimer = window.setTimeout(() => {
        void this.pushAccountSnapshotNow(false);
      }, 2400);
    };

    [
      AUTH_SYNC_EVENT,
      RT_SYNC_EVENT,
      DOMPETQU_SYNC_EVENT,
      SIAGA_CIRCLE_SYNC_EVENT,
      ZERO_TRUST_SYNC_EVENT,
      MONETIZATION_SYNC_EVENT,
      ACCOUNT_GOV_SYNC_EVENT,
      LELUHUR_SYNC_EVENT,
      'storage',
    ].forEach(ev => window.addEventListener(ev, schedulePush));

    // Initial check on startup:
    // If signed in, pull newer cloud account snapshot on startup; otherwise push local edits
    const initialAcc = AuthService.getAccount();
    if (initialAcc) {
      void this.pullAccountSnapshot(initialAcc.email, initialAcc.phone, { onlyIfNewer: true }).then(
        res => {
          if (res.restored) {
            onAutoRestored?.(
              `${res.keyCount} data akun disinkronkan otomatis dari ${
                res.source === 'apk' ? 'APK' : 'PWA'
              }.`
            );
          } else {
            void this.pushAccountSnapshotNow(false);
          }
        }
      );
    }

    const handleVisibilityResume = () => {
      if (document.visibilityState !== 'visible') return;
      const acc = AuthService.getAccount();
      if (!acc) return;
      void this.pullAccountSnapshot(acc.email, acc.phone, { onlyIfNewer: true }).then(res => {
        if (res.restored) {
          onAutoRestored?.(`${res.keyCount} pembaruan data disinkronkan.`);
        } else {
          void this.pushAccountSnapshotNow(false);
        }
      });
    };
    window.addEventListener('focus', handleVisibilityResume);
    document.addEventListener('visibilitychange', handleVisibilityResume);
  },
};
