import { AUTH_SYNC_EVENT, AuthService } from './authService';
import { RT_SYNC_EVENT } from './rtSiagaStorage';
import { SIAGA_CIRCLE_SYNC_EVENT } from './siagaCircleService';
import { ZERO_TRUST_SYNC_EVENT, ZeroTrustService } from './zeroTrustService';
import { MONETIZATION_SYNC_EVENT } from './monetizationService';

export type BackupScope = 'all' | 'leluhurqu' | 'rtqu';

export interface EncryptedBackupEnvelope {
  app: 'WargaQu-EncryptedBackup';
  version: 1;
  scope: BackupScope;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
  ownerEmail: string;
  keyCount: number;
  createdAt: string;
}

const PBKDF2_ITERATIONS = 100000;

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

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
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

function shouldIncludeKey(key: string, scope: BackupScope): boolean {
  // Hidden device token tetap unik per perangkat fisik
  if (key === 'wargaqu_hidden_device_token_v1') return false;

  if (scope === 'leluhurqu') {
    return key.startsWith('wargaqu_leluhur_') || key.startsWith('leluhurqu_grid_');
  }
  if (scope === 'rtqu') {
    return key.startsWith('wargaqu_rt_');
  }
  return (
    key.startsWith('wargaqu_') ||
    key.startsWith('leluhurqu_grid_') ||
    key.startsWith('uq_') ||
    key.startsWith('baksoqu_')
  );
}

function collectStorageSnapshot(scope: BackupScope): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !shouldIncludeKey(key, scope)) continue;
    const val = localStorage.getItem(key);
    if (val !== null) {
      snapshot[key] = val;
    }
  }
  return snapshot;
}

export const EncryptedBackupService = {
  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof crypto !== 'undefined' &&
      Boolean(crypto.subtle)
    );
  },

  async createEncryptedBackupBlob(
    scope: BackupScope,
    password: string
  ): Promise<{ blob: Blob; filename: string; keyCount: number }> {
    if (!this.isSupported()) {
      throw new Error('Peramban tidak mendukung enkripsi WebCrypto AES-GCM.');
    }
    if (password.trim().length < 4) {
      throw new Error('Kata sandi enkripsi minimal 4 karakter.');
    }

    const snapshot = collectStorageSnapshot(scope);
    const keyCount = Object.keys(snapshot).length;
    const payload = JSON.stringify({
      scope,
      exportedAt: new Date().toISOString(),
      ownerEmail: AuthService.getAccount()?.email || 'tamu@wargaqu.id',
      entries: snapshot,
    });

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aesKey = await deriveAesKey(password, salt);

    const encryptedBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      aesKey,
      new TextEncoder().encode(payload)
    );

    const envelope: EncryptedBackupEnvelope = {
      app: 'WargaQu-EncryptedBackup',
      version: 1,
      scope,
      kdf: 'PBKDF2-SHA256',
      iterations: PBKDF2_ITERATIONS,
      cipher: 'AES-256-GCM',
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(encryptedBuf)),
      ownerEmail: AuthService.getAccount()?.email || 'tamu@wargaqu.id',
      keyCount,
      createdAt: new Date().toISOString(),
    };

    const dateStamp = new Date().toISOString().slice(0, 10);
    const scopeLabel =
      scope === 'leluhurqu' ? 'LeluhurQu' : scope === 'rtqu' ? 'RTQu' : 'SemuaData';
    const filename = `WargaQu_${scopeLabel}_Terenkripsi_${dateStamp}.wqbak.json`;

    const blob = new Blob([JSON.stringify(envelope, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });

    ZeroTrustService.appendAudit(
      AuthService.getAccount()?.email || 'WargaQu',
      'Ekspor Backup Terenkripsi',
      `Scope: ${scopeLabel} · ${keyCount} kunci AES-256-GCM`,
      'info'
    );

    return { blob, filename, keyCount };
  },

  async exportAndDownload(
    scope: BackupScope,
    password: string
  ): Promise<{ filename: string; keyCount: number }> {
    const { blob, filename, keyCount } = await this.createEncryptedBackupBlob(
      scope,
      password
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { filename, keyCount };
  },

  async restoreFromEncryptedFile(
    file: File,
    password: string
  ): Promise<{ restoredKeys: number; scope: BackupScope; ownerEmail: string }> {
    if (!this.isSupported()) {
      throw new Error('Peramban tidak mendukung dekripsi WebCrypto AES-GCM.');
    }
    if (!password.trim()) {
      throw new Error('Masukkan kata sandi cadangan terlebih dahulu.');
    }

    const rawText = await file.text();
    let envelope: EncryptedBackupEnvelope;
    try {
      envelope = JSON.parse(rawText) as EncryptedBackupEnvelope;
    } catch {
      throw new Error('Format file cadangan tidak valid (.wqbak.json).');
    }

    if (
      envelope?.app !== 'WargaQu-EncryptedBackup' ||
      !envelope.salt ||
      !envelope.iv ||
      !envelope.ciphertext
    ) {
      throw new Error('File ini bukan arsip cadangan terenkripsi WargaQu.');
    }

    let decryptedBytes: ArrayBuffer;
    try {
      const salt = fromBase64(envelope.salt);
      const iv = fromBase64(envelope.iv);
      const ciphertext = fromBase64(envelope.ciphertext);
      const aesKey = await deriveAesKey(password, salt);
      decryptedBytes = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        aesKey,
        ciphertext.buffer as ArrayBuffer
      );
    } catch {
      throw new Error('Kata sandi salah atau file cadangan sudah termodifikasi.');
    }

    const decoded = JSON.parse(new TextDecoder().decode(decryptedBytes)) as {
      scope: BackupScope;
      ownerEmail: string;
      entries: Record<string, string>;
    };

    const entries = decoded.entries || {};
    let restoredKeys = 0;
    Object.entries(entries).forEach(([k, v]) => {
      if (k === 'wargaqu_hidden_device_token_v1') return;
      if (typeof v === 'string') {
        try {
          localStorage.setItem(k, v);
          restoredKeys += 1;
        } catch {
          // ignore storage quota
        }
      }
    });

    // Pastikan perangkat baru tetap terikat dengan akun yang baru dipulihkan
    const restoredAcc = AuthService.getAccount();
    if (restoredAcc) {
      ZeroTrustService.registerOrTouchCurrentDevice(
        restoredAcc.email,
        restoredAcc.phone,
        'Perangkat Pemulihan Backup Terenkripsi'
      );
    }

    ZeroTrustService.appendAudit(
      restoredAcc?.email || decoded.ownerEmail || 'WargaQu',
      'Pulihkan Backup Terenkripsi',
      `${restoredKeys} kunci dipulihkan (${decoded.scope})`,
      'info'
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(RT_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(SIAGA_CIRCLE_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(ZERO_TRUST_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(MONETIZATION_SYNC_EVENT));
    }

    return {
      restoredKeys,
      scope: decoded.scope || envelope.scope,
      ownerEmail: decoded.ownerEmail || envelope.ownerEmail,
    };
  },
};
