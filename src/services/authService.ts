import { buildApiUrl, isNativeCapacitorApk } from './appOriginService';

export interface AuthAccount {
  email: string;
  phone: string;
  deviceId: string; // Disimpan tersembunyi (hidden) di latar belakang
  loggedInAt: string;
  sessionNonce?: string;
}

export interface DeviceAccountBinding {
  deviceId: string;
  boundEmail: string;
  boundPhone: string;
  pinHash: string; // SHA-256 salted dengan deviceId (opsional di Level 1)
  googleVerified: boolean;
  boundAt: string;
  lastChangedAt?: string;
  changeCount30d: number;
  changeWindowStart: string;
  lastSwitchAt?: string;
  switchCooldownUntil?: string;
}

export type TrustLevel = 'guest' | 'basic' | 'pin_locked' | 'verified_google';

export interface TrustProfile {
  level: TrustLevel;
  label: string;
  badgeTone: 'slate' | 'amber' | 'sky' | 'emerald';
  summary: string;
}

export interface SwitchCooldownStatus {
  allowedNow: boolean;
  remainingMs: number;
  freeRemaining: number;
  usedCount30d: number;
  cooldownUntil?: string;
}

export interface BindingActionResult {
  ok: boolean;
  reason?:
    | 'invalid_email'
    | 'invalid_phone'
    | 'invalid_pin'
    | 'pin_required'
    | 'device_locked_other_account'
    | 'phone_mismatch'
    | 'switch_quota_exceeded'
    | 'switch_cooldown_active';
  message: string;
  account?: AuthAccount;
}

export const MAX_DEVICE_SWITCHES_30D = 2;
export const SWITCH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const AUTH_STORAGE_KEY = 'wargaqu_auth_account_v1';
const HIDDEN_DEVICE_KEY = 'wargaqu_hidden_device_token_v1';
const DEVICE_BINDING_KEY = 'wargaqu_device_binding_v1';
export const AUTH_SYNC_EVENT = 'wargaqu-auth-sync';

function emitAuthSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
  }
}

function generateHiddenDeviceToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `wqd-${crypto.randomUUID()}`;
    }
  } catch {
    // fallback below
  }
  const rand = Math.random().toString(36).slice(2, 12);
  const ts = Date.now().toString(36);
  return `wqd-${ts}-${rand}`;
}

export function normalizePhoneDigits(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('62') && digits.length >= 10) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test((pin || '').trim());
}

export async function hashDevicePin(pin: string, deviceId: string): Promise<string> {
  const cleanPin = (pin || '').trim();
  const material = `wargaqu-pin-v1:${deviceId}:${cleanPin}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(material);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback below
  }
  // Deterministic non-Crypto fallback for restricted HTTP contexts
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < material.length; i += 1) {
    const c = material.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return `fb-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function loadRawBinding(): DeviceAccountBinding | null {
  try {
    const raw = localStorage.getItem(DEVICE_BINDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceAccountBinding>;
    if (!parsed || typeof parsed.deviceId !== 'string') return null;
    const nowIso = new Date().toISOString();
    const windowStart = parsed.changeWindowStart || parsed.boundAt || nowIso;
    const elapsed = Date.now() - new Date(windowStart).getTime();
    const withinWindow = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < THIRTY_DAYS_MS;

    return {
      deviceId: parsed.deviceId,
      boundEmail: (parsed.boundEmail || '').trim().toLowerCase(),
      boundPhone: (parsed.boundPhone || '').trim(),
      pinHash: parsed.pinHash || '',
      googleVerified: Boolean(parsed.googleVerified),
      boundAt: parsed.boundAt || nowIso,
      lastChangedAt: parsed.lastChangedAt,
      changeCount30d: withinWindow ? Math.max(0, Number(parsed.changeCount30d) || 0) : 0,
      changeWindowStart: withinWindow ? windowStart : nowIso,
      lastSwitchAt: parsed.lastSwitchAt,
      switchCooldownUntil: withinWindow ? parsed.switchCooldownUntil : undefined,
    };
  } catch {
    return null;
  }
}

function saveRawBinding(binding: DeviceAccountBinding): void {
  try {
    localStorage.setItem(DEVICE_BINDING_KEY, JSON.stringify(binding));
  } catch {
    // ignore storage quota errors
  }
}

async function reportBindingActionToRelay(
  deviceId: string,
  email: string,
  action: 'bind' | 'switch' | 'phone_change'
): Promise<void> {
  if (typeof fetch === 'undefined') return;
  try {
    await fetch(buildApiUrl('/api/relay-device-binding'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        emailHashHint: email.trim().toLowerCase(),
        action,
      }),
    });
  } catch {
    // non-blocking telemetry guard
  }
}

export const AuthService = {
  /**
   * Hidden Device ID: dibuat sekali dan tetap tersembunyi di latar belakang.
   * Tidak ditampilkan ke UI secara utuh, hanya dipakai untuk pengikatan perangkat & keamanan SiagaQu.
   */
  getHiddenDeviceId(): string {
    try {
      const existing = localStorage.getItem(HIDDEN_DEVICE_KEY);
      if (existing && existing.trim()) {
        return existing;
      }
      const created = generateHiddenDeviceToken();
      localStorage.setItem(HIDDEN_DEVICE_KEY, created);
      return created;
    } catch {
      return generateHiddenDeviceToken();
    }
  },

  maskEmail(email: string): string {
    const clean = (email || '').trim().toLowerCase();
    const [local, domain] = clean.split('@');
    if (!local || !domain) return clean || '-';
    if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
    return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
  },

  maskPhone(phone: string): string {
    const clean = (phone || '').trim();
    if (clean.length <= 4) return clean || '-';
    return `${clean.slice(0, 4)}••••${clean.slice(-2)}`;
  },

  getAccount(): AuthAccount | null {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<AuthAccount>;
      if (!parsed.email || !parsed.phone) return null;
      return {
        email: parsed.email,
        phone: parsed.phone,
        deviceId: parsed.deviceId || this.getHiddenDeviceId(),
        loggedInAt: parsed.loggedInAt || new Date().toISOString(),
        sessionNonce: parsed.sessionNonce,
      };
    } catch {
      return null;
    }
  },

  isLoggedIn(): boolean {
    return this.getAccount() !== null;
  },

  /**
   * Mengambil status ikatan perangkat keras (Email + No HP + Hidden Device ID + PIN Hash).
   * Untuk akun lama sebelum pembaruan PIN, otomatis menghidrasi ikatan dari sesi aktif.
   */
  getDeviceBinding(): DeviceAccountBinding | null {
    const deviceId = this.getHiddenDeviceId();
    const stored = loadRawBinding();
    if (stored && stored.deviceId === deviceId) {
      return stored;
    }

    const legacyAcc = this.getAccount();
    if (legacyAcc) {
      const nowIso = new Date().toISOString();
      const hydrated: DeviceAccountBinding = {
        deviceId,
        boundEmail: legacyAcc.email.trim().toLowerCase(),
        boundPhone: legacyAcc.phone.trim(),
        pinHash: '',
        googleVerified: false,
        boundAt: legacyAcc.loggedInAt || nowIso,
        changeCount30d: stored?.changeCount30d || 0,
        changeWindowStart: stored?.changeWindowStart || nowIso,
        lastSwitchAt: stored?.lastSwitchAt,
        switchCooldownUntil: stored?.switchCooldownUntil,
      };
      saveRawBinding(hydrated);
      return hydrated;
    }

    return stored;
  },

  hasActiveOwnerBinding(): boolean {
    const b = this.getDeviceBinding();
    return Boolean(b && b.boundEmail);
  },

  hasPinConfigured(): boolean {
    const b = this.getDeviceBinding();
    return Boolean(b && b.pinHash);
  },

  getSwitchCooldownStatus(): SwitchCooldownStatus {
    const b = this.getDeviceBinding();
    const usedCount30d = b?.changeCount30d || 0;
    const freeRemaining = Math.max(0, MAX_DEVICE_SWITCHES_30D - usedCount30d);
    if (b?.switchCooldownUntil) {
      const untilMs = new Date(b.switchCooldownUntil).getTime();
      const remainingMs = Number.isFinite(untilMs) ? Math.max(0, untilMs - Date.now()) : 0;
      if (remainingMs > 0) {
        return {
          allowedNow: false,
          remainingMs,
          freeRemaining,
          usedCount30d,
          cooldownUntil: b.switchCooldownUntil,
        };
      }
    }
    return {
      allowedNow: true,
      remainingMs: 0,
      freeRemaining,
      usedCount30d,
    };
  },

  getRemainingSwitchQuota(): number {
    return this.getSwitchCooldownStatus().freeRemaining;
  },

  getTrustProfile(): TrustProfile {
    const acc = this.getAccount();
    const b = this.getDeviceBinding();
    if (!acc) {
      return {
        level: 'guest',
        label: 'Mode Tamu',
        badgeTone: 'slate',
        summary: 'Masuk dengan Email & No. HP untuk mengikat perangkat dan menyinkronkan modul.',
      };
    }
    if (b?.googleVerified && b?.pinHash) {
      return {
        level: 'verified_google',
        label: 'Terverifikasi Penuh (Google + PIN)',
        badgeTone: 'emerald',
        summary: 'Identitas Google terverifikasi & perangkat dikunci PIN 6 digit.',
      };
    }
    if (b?.googleVerified) {
      return {
        level: 'verified_google',
        label: 'Terverifikasi Google',
        badgeTone: 'emerald',
        summary: 'Email terverifikasi Google. Tambah PIN 6 digit jika ingin kunci perangkat ekstra.',
      };
    }
    if (b?.pinHash) {
      return {
        level: 'pin_locked',
        label: 'Terkunci PIN 6 Digit',
        badgeTone: 'sky',
        summary: 'Perangkat dikunci PIN 6 digit. Hubungkan Google untuk verifikasi cloud.',
      };
    }
    return {
      level: 'basic',
      label: 'Aktif Dasar (Level 1)',
      badgeTone: 'amber',
      summary: 'Email & No. HP terikat otomatis. Tambah PIN 6 digit bila memakai fitur transaksi/RT.',
    };
  },

  async verifyPin(pinInput: string): Promise<boolean> {
    const b = this.getDeviceBinding();
    if (!b || !b.pinHash) return false;
    if (!isValidPinFormat(pinInput)) return false;
    const candidate = await hashDevicePin(pinInput, b.deviceId);
    return candidate === b.pinHash;
  },

  async setOrUpdatePin(
    newPin: string,
    options?: { currentPin?: string; bypassVerification?: boolean }
  ): Promise<BindingActionResult> {
    if (!isValidPinFormat(newPin)) {
      return {
        ok: false,
        reason: 'invalid_pin',
        message: 'PIN Keamanan wajib terdiri dari tepat 6 digit angka.',
      };
    }

    const deviceId = this.getHiddenDeviceId();
    const binding = this.getDeviceBinding();
    const acc = this.getAccount();
    if (!binding && !acc) {
      return {
        ok: false,
        reason: 'invalid_email',
        message: 'Masuk terlebih dahulu sebelum mengatur PIN perangkat.',
      };
    }

    if (binding?.pinHash && !options?.bypassVerification) {
      const match = await this.verifyPin(options?.currentPin || '');
      if (!match) {
        return {
          ok: false,
          reason: 'invalid_pin',
          message: 'PIN Keamanan saat ini tidak cocok.',
        };
      }
    }

    const nextHash = await hashDevicePin(newPin, deviceId);
    const nowIso = new Date().toISOString();
    const nextBinding: DeviceAccountBinding = binding
      ? {
          ...binding,
          pinHash: nextHash,
          lastChangedAt: nowIso,
        }
      : {
          deviceId,
          boundEmail: (acc?.email || '').trim().toLowerCase(),
          boundPhone: (acc?.phone || '').trim(),
          pinHash: nextHash,
          googleVerified: false,
          boundAt: nowIso,
          lastChangedAt: nowIso,
          changeCount30d: 0,
          changeWindowStart: nowIso,
        };

    saveRawBinding(nextBinding);
    emitAuthSync();
    return {
      ok: true,
      message: 'PIN Keamanan 6 digit berhasil diikat ke perangkat ini.',
    };
  },

  markGoogleVerified(verified = true): void {
    const b = this.getDeviceBinding();
    if (!b || !b.boundEmail) return;
    if (b.googleVerified === verified) return;
    saveRawBinding({ ...b, googleVerified: verified });
    emitAuthSync();
  },

  /**
   * Masuk atau ikat akun baru dengan penegakan Device Binding & PIN 6 digit.
   * Mencegah pergantian email / No HP sembarangan pada 1 perangkat.
   */
  async bindAndLogin(params: {
    email: string;
    phone: string;
    pin?: string;
    googleVerified?: boolean;
  }): Promise<BindingActionResult> {
    const cleanEmail = (params.email || '').trim().toLowerCase();
    const cleanPhone = (params.phone || '').trim();
    const cleanPin = (params.pin || '').trim();

    if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
      return {
        ok: false,
        reason: 'invalid_email',
        message: 'Masukkan alamat Email yang valid.',
      };
    }
    if (cleanPhone.replace(/\D/g, '').length < 8) {
      return {
        ok: false,
        reason: 'invalid_phone',
        message: 'Masukkan No. HP / WhatsApp minimal 8 digit.',
      };
    }

    const deviceId = this.getHiddenDeviceId();
    const existing = this.getDeviceBinding();
    const nowIso = new Date().toISOString();

    if (existing && existing.boundEmail) {
      if (existing.boundEmail !== cleanEmail) {
        return {
          ok: false,
          reason: 'device_locked_other_account',
          message: `Perangkat ini terkunci untuk akun ${this.maskEmail(existing.boundEmail)}. Gunakan Prosedur Lepas Ikatan jika ingin pindah akun.`,
        };
      }

      // Same bound email: verify PIN if configured
      if (existing.pinHash) {
        if (!isValidPinFormat(cleanPin)) {
          return {
            ok: false,
            reason: 'pin_required',
            message: 'Masukkan PIN Keamanan 6 digit pemilik akun untuk masuk kembali.',
          };
        }
        const okPin = await this.verifyPin(cleanPin);
        if (!okPin) {
          return {
            ok: false,
            reason: 'invalid_pin',
            message: 'PIN Keamanan salah. Gunakan Kode Pemulihan jika lupa PIN.',
          };
        }
      } else if (cleanPin) {
        if (!isValidPinFormat(cleanPin)) {
          return {
            ok: false,
            reason: 'invalid_pin',
            message: 'PIN Keamanan baru wajib 6 digit angka.',
          };
        }
      }

      // Prevent silent phone number change on re-login
      if (
        existing.boundPhone &&
        existing.boundPhone !== '0800-0000-0000' &&
        normalizePhoneDigits(existing.boundPhone) !== normalizePhoneDigits(cleanPhone)
      ) {
        return {
          ok: false,
          reason: 'phone_mismatch',
          message: `No. HP tidak cocok dengan yang terikat (${this.maskPhone(existing.boundPhone)}). Masuk dengan nomor lama lalu gunakan Prosedur Ganti No. HP.`,
        };
      }

      const nextHash = existing.pinHash
        ? existing.pinHash
        : cleanPin
        ? await hashDevicePin(cleanPin, deviceId)
        : '';

      saveRawBinding({
        ...existing,
        boundPhone:
          existing.boundPhone === '0800-0000-0000' || !existing.boundPhone
            ? cleanPhone
            : existing.boundPhone,
        pinHash: nextHash,
        googleVerified: existing.googleVerified || Boolean(params.googleVerified),
      });

      const saved = this.login(
        cleanEmail,
        existing.boundPhone === '0800-0000-0000' || !existing.boundPhone
          ? cleanPhone
          : existing.boundPhone
      );
      return {
        ok: true,
        message: 'Identitas terverifikasi & sesi perangkat dibuka.',
        account: saved,
      };
    }

    // Fresh / unbound device: PIN is OPTIONAL (Progressive Trust Level 1)
    if (cleanPin && !isValidPinFormat(cleanPin)) {
      return {
        ok: false,
        reason: 'invalid_pin',
        message: 'Jika diisi, PIN Keamanan harus tepat 6 digit angka.',
      };
    }

    const pinHash = cleanPin ? await hashDevicePin(cleanPin, deviceId) : '';
    const nextBinding: DeviceAccountBinding = {
      deviceId,
      boundEmail: cleanEmail,
      boundPhone: cleanPhone,
      pinHash,
      googleVerified: Boolean(params.googleVerified),
      boundAt: nowIso,
      changeCount30d: existing?.changeCount30d || 0,
      changeWindowStart: existing?.changeWindowStart || nowIso,
      lastSwitchAt: existing?.lastSwitchAt,
      switchCooldownUntil: existing?.switchCooldownUntil,
    };
    saveRawBinding(nextBinding);
    const saved = this.login(cleanEmail, cleanPhone);
    void reportBindingActionToRelay(deviceId, cleanEmail, 'bind');

    return {
      ok: true,
      message: pinHash
        ? 'Email, No. HP & PIN Keamanan berhasil diikat ke perangkat ini.'
        : 'Email & No. HP berhasil diikat (Level 1). Anda bisa menambahkan PIN kapan saja.',
      account: saved,
    };
  },

  /**
   * Memperbarui No. HP terikat setelah verifikasi prosedur selesai dilakukan pemanggil.
   */
  changeBoundPhone(newPhone: string): AuthAccount | null {
    const cleanPhone = (newPhone || '').trim();
    if (cleanPhone.replace(/\D/g, '').length < 8) return null;

    const existing = this.getDeviceBinding();
    const currentAcc = this.getAccount();
    const targetEmail = existing?.boundEmail || currentAcc?.email || '';
    if (!targetEmail) return null;

    const nowIso = new Date().toISOString();
    const deviceId = this.getHiddenDeviceId();
    saveRawBinding({
      deviceId,
      boundEmail: targetEmail,
      boundPhone: cleanPhone,
      pinHash: existing?.pinHash || '',
      googleVerified: Boolean(existing?.googleVerified),
      boundAt: existing?.boundAt || nowIso,
      lastChangedAt: nowIso,
      changeCount30d: existing?.changeCount30d || 0,
      changeWindowStart: existing?.changeWindowStart || nowIso,
    });

    const saved = this.login(targetEmail, cleanPhone);
    void reportBindingActionToRelay(deviceId, targetEmail, 'phone_change');
    return saved;
  },

  /**
   * Melepas ikatan pemilik dari perangkat ini dengan jeda bertahap:
   * 2× pergantian pertama per 30 hari langsung diizinkan; ke-3 dst menerapkan jeda keamanan 24 jam.
   */
  releaseDeviceBinding(options?: { bypassQuota?: boolean }): BindingActionResult {
    const existing = this.getDeviceBinding();
    const deviceId = this.getHiddenDeviceId();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    if (existing && existing.boundEmail && !options?.bypassQuota) {
      const cooldown = this.getSwitchCooldownStatus();
      if (!cooldown.allowedNow) {
        const hoursLeft = Math.max(1, Math.ceil(cooldown.remainingMs / (60 * 60 * 1000)));
        return {
          ok: false,
          reason: 'switch_cooldown_active',
          message: `Batas ganti cepat (${MAX_DEVICE_SWITCHES_30D}× dalam 30 hari) sudah dipakai. Tunggu jeda keamanan ${hoursLeft} jam lagi untuk pindah akun, atau hubungi Admin Zero Trust.`,
        };
      }
    }

    const nextCount = (existing?.changeCount30d || 0) + (existing?.boundEmail ? 1 : 0);
    const nextCooldownUntil =
      existing?.boundEmail && nextCount >= MAX_DEVICE_SWITCHES_30D
        ? new Date(nowMs + SWITCH_COOLDOWN_MS).toISOString()
        : undefined;

    saveRawBinding({
      deviceId,
      boundEmail: '',
      boundPhone: '',
      pinHash: '',
      googleVerified: false,
      boundAt: '',
      lastChangedAt: nowIso,
      changeCount30d: nextCount,
      changeWindowStart: existing?.changeWindowStart || nowIso,
      lastSwitchAt: existing?.boundEmail ? nowIso : existing?.lastSwitchAt,
      switchCooldownUntil: nextCooldownUntil,
    });

    if (existing?.boundEmail) {
      void reportBindingActionToRelay(deviceId, existing.boundEmail, 'switch');
    }
    this.logout();
    return {
      ok: true,
      message: nextCooldownUntil
        ? 'Ikatan perangkat dilepas & data lama dibersihkan. Pergantian berikutnya menerapkan jeda keamanan 24 jam.'
        : 'Ikatan perangkat berhasil dilepas sesuai prosedur. Silakan daftarkan atau masuk dengan akun baru.',
    };
  },

  resetSwitchQuotaByAdmin(): void {
    const existing = this.getDeviceBinding();
    if (!existing) return;
    saveRawBinding({
      ...existing,
      changeCount30d: 0,
      changeWindowStart: new Date().toISOString(),
      lastSwitchAt: undefined,
      switchCooldownUntil: undefined,
    });
    emitAuthSync();
  },

  /**
   * Low-level session setter (dipakai internal oleh pemulihan kode, Google Cloud sync, & pairing).
   */
  login(emailInput: string, phoneInput: string): AuthAccount {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPhone = phoneInput.trim();
    const hiddenDeviceId = this.getHiddenDeviceId();
    const sessionNonce = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const account: AuthAccount = {
      email: cleanEmail,
      phone: cleanPhone,
      deviceId: hiddenDeviceId,
      loggedInAt: new Date().toISOString(),
      sessionNonce,
    };

    const existingBinding = loadRawBinding();
    if (!existingBinding || !existingBinding.boundEmail) {
      const nowIso = new Date().toISOString();
      saveRawBinding({
        deviceId: hiddenDeviceId,
        boundEmail: cleanEmail,
        boundPhone: cleanPhone,
        pinHash: '',
        googleVerified: false,
        boundAt: nowIso,
        changeCount30d: existingBinding?.changeCount30d || 0,
        changeWindowStart: existingBinding?.changeWindowStart || nowIso,
        lastSwitchAt: existingBinding?.lastSwitchAt,
        switchCooldownUntil: existingBinding?.switchCooldownUntil,
      });
    }

    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(account));
    } catch {
      // ignore storage quota errors
    }
    emitAuthSync();
    return account;
  },

  /**
   * Logout hanya menutup sesi aktif — TIDAK menghapus kunci ikatan pemilik pada Hidden Device ID.
   */
  logout(): void {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    emitAuthSync();
  },

  async computeSessionAccountKey(email: string): Promise<string> {
    const norm = (email || '').trim().toLowerCase();
    if (!norm) return '';
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`wargaqu-session-v1:${norm}`)
      );
      return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261;
    for (let i = 0; i < norm.length; i += 1) {
      h ^= norm.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return `fallback_${(h >>> 0).toString(16).padStart(16, '0')}`;
  },

  async registerActiveSessionOnServer(
    account: AuthAccount,
    isCompanionLaptop = false
  ): Promise<boolean> {
    if (isCompanionLaptop || !account?.email || !account?.sessionNonce) return false;
    try {
      const accountKey = await this.computeSessionAccountKey(account.email);
      const container: 'apk' | 'pwa' = isNativeCapacitorApk() ? 'apk' : 'pwa';
      const res = await fetch(buildApiUrl('/api/session/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountKey,
          sessionNonce: account.sessionNonce,
          container,
          deviceIdHash: account.deviceId.slice(-16),
          issuedAt: account.loggedInAt,
          isCompanionLaptop,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async validateActiveSessionOnServer(
    account: AuthAccount | null,
    isCompanionLaptop = false
  ): Promise<{ valid: boolean; reason?: string; activeContainer?: 'apk' | 'pwa' }> {
    if (!account || !account.email || !account.sessionNonce || isCompanionLaptop) {
      return { valid: true };
    }
    try {
      const accountKey = await this.computeSessionAccountKey(account.email);
      const url = buildApiUrl(
        `/api/session/validate?accountKey=${encodeURIComponent(
          accountKey
        )}&sessionNonce=${encodeURIComponent(account.sessionNonce)}&isCompanionLaptop=${
          isCompanionLaptop ? '1' : '0'
        }`
      );
      const res = await fetch(url);
      if (!res.ok) return { valid: true };
      const data = (await res.json()) as {
        valid?: boolean;
        reason?: string;
        activeContainer?: 'apk' | 'pwa';
      };
      return {
        valid: data.valid !== false,
        reason: data.reason,
        activeContainer: data.activeContainer,
      };
    } catch {
      return { valid: true };
    }
  },

  async unregisterActiveSessionOnServer(account: AuthAccount | null): Promise<void> {
    if (!account?.email || !account?.sessionNonce) return;
    try {
      const accountKey = await this.computeSessionAccountKey(account.email);
      await fetch(buildApiUrl('/api/session/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountKey,
          sessionNonce: account.sessionNonce,
        }),
      });
    } catch {
      // ignore offline
    }
  },

  getDisplayName(account?: AuthAccount | null): string {
    const acc = account === undefined ? this.getAccount() : account;
    if (!acc || !acc.email) return 'Tamu WargaQu';
    const localPart = acc.email.split('@')[0] || 'WargaQu';
    const words = localPart
      .replace(/[._-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return 'WargaQu';
    return words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  },
};
