export interface AuthAccount {
  email: string;
  phone: string;
  deviceId: string; // Disimpan tersembunyi (hidden) di latar belakang
  loggedInAt: string;
}

const AUTH_STORAGE_KEY = 'wargaqu_auth_account_v1';
const HIDDEN_DEVICE_KEY = 'wargaqu_hidden_device_token_v1';
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

export const AuthService = {
  /**
   * Hidden Device ID: dibuat sekali dan tetap tersembunyi di latar belakang.
   * Tidak ditampilkan ke UI, hanya dipakai untuk pengikatan perangkat & keamanan SiagaQu.
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
      };
    } catch {
      return null;
    }
  },

  isLoggedIn(): boolean {
    return this.getAccount() !== null;
  },

  login(emailInput: string, phoneInput: string): AuthAccount {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPhone = phoneInput.trim();
    const hiddenDeviceId = this.getHiddenDeviceId();

    const account: AuthAccount = {
      email: cleanEmail,
      phone: cleanPhone,
      deviceId: hiddenDeviceId,
      loggedInAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(account));
    } catch {
      // ignore storage quota errors
    }
    emitAuthSync();
    return account;
  },

  logout(): void {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    emitAuthSync();
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
