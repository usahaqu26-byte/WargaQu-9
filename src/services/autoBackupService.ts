import { AUTH_SYNC_EVENT, AuthService } from './authService';
import {
  BackupScope,
  EncryptedBackupEnvelope,
  EncryptedBackupService,
} from './encryptedBackupService';
import { RT_SYNC_EVENT } from './rtSiagaStorage';
import { SIAGA_CIRCLE_SYNC_EVENT } from './siagaCircleService';
import { ZERO_TRUST_SYNC_EVENT, ZeroTrustService } from './zeroTrustService';
import { MONETIZATION_SYNC_EVENT } from './monetizationService';
import { ACCOUNT_GOV_SYNC_EVENT } from './accountGovernanceService';
import { FirebaseSyncService } from './firebaseSyncService';
import { DOMPETQU_SYNC_EVENT } from './dompetQuStorage';
import { DEVICE_PAIRING_SYNC_EVENT } from './devicePairingService';

export const DRIVE_BACKUP_FILENAME = 'WargaQu_AutoBackup_SemuaData.wqbak.json';
export const AUTO_BACKUP_SYNC_EVENT = 'wargaqu-autobackup-sync';

const PREFS_KEY = 'wargaqu_autobackup_prefs_v1';
const IDB_NAME = 'wargaqu_autobackup_db_v1';
const IDB_STORE = 'snapshots';
const SLOT_AUTO_OVERWRITE = 'hp_auto_overwrite';
const SLOT_PRE_RESET = 'hp_pre_reset';
const SLOT_PHONE_FILE_HANDLE = 'phone_file_handle';

const PRESERVED_INFRA_KEYS = new Set([
  'wargaqu_hidden_device_token_v1',
  'wargaqu_device_binding_v1',
  PREFS_KEY,
  'wargaqu_zt_policy_v1',
  'wargaqu_zt_audit_logs_v1',
  'wargaqu_server_origin_v1',
  'wargaqu_github_repo_slug_v1',
]);

export interface DirectBackupEnvelope {
  app: 'WargaQu-DirectBackup';
  version: 1;
  scope: BackupScope;
  ownerEmail: string;
  keyCount: number;
  createdAt: string;
  entries: Record<string, string>;
}

export type AnyBackupEnvelope = EncryptedBackupEnvelope | DirectBackupEnvelope;

export interface LocalBackupRecord {
  id: string;
  reason: string;
  keyCount: number;
  sizeBytes: number;
  ownerEmail: string;
  savedAt: string;
  envelope: DirectBackupEnvelope;
}

export interface AutoBackupPrefs {
  autoLocalEnabled: boolean;
  autoDriveEnabled: boolean;
  lastLocalBackupAt?: string;
  lastLocalKeyCount?: number;
  lastLocalSizeBytes?: number;
  lastPreResetAt?: string;
  lastDriveBackupAt?: string;
  lastDriveFileId?: string;
  lastDriveKeyCount?: number;
  lastDriveSizeBytes?: number;
  phoneFileName?: string;
  lastPhoneFileBackupAt?: string;
}

export interface DriveFileSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

type FileHandleLike = {
  name: string;
  queryPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  createWritable: () => Promise<{
    write: (data: Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

let driveOverwriteSessionConfirmed = false;
let sessionDrivePassword = '';
let monitorStarted = false;
let debounceTimer: number | null = null;
let lastLocalSignature = '';
let lastDriveSyncMs = 0;

function emitAutoBackupSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTO_BACKUP_SYNC_EVENT));
  }
}

function openBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di peramban ini.'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka penyimpanan lokal HP.'));
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openBackupDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(key: string, val: T): Promise<void> {
  const db = await openBackupDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(val, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function buildDirectEnvelope(): DirectBackupEnvelope {
  const snapshot = EncryptedBackupService.collectSnapshot('all');
  // Exclude backup prefs so restore doesn't clobber UI metadata unnecessarily
  delete snapshot[PREFS_KEY];
  return {
    app: 'WargaQu-DirectBackup',
    version: 1,
    scope: 'all',
    ownerEmail: AuthService.getAccount()?.email || 'tamu@wargaqu.id',
    keyCount: Object.keys(snapshot).length,
    createdAt: new Date().toISOString(),
    entries: snapshot,
  };
}

function buildSignature(entries: Record<string, string>): string {
  const keys = Object.keys(entries).sort();
  return keys.map(k => `${k}:${entries[k].length}:${entries[k].slice(0, 24)}`).join('|');
}

function loadPrefs(): AutoBackupPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) {
      return { autoLocalEnabled: true, autoDriveEnabled: false };
    }
    const parsed = JSON.parse(raw) as Partial<AutoBackupPrefs>;
    return {
      autoLocalEnabled: parsed.autoLocalEnabled !== false,
      autoDriveEnabled: Boolean(parsed.autoDriveEnabled),
      ...parsed,
    };
  } catch {
    return { autoLocalEnabled: true, autoDriveEnabled: false };
  }
}

function savePrefs(patch: Partial<AutoBackupPrefs>): AutoBackupPrefs {
  const next = { ...loadPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  emitAutoBackupSync();
  return next;
}

async function buildUploadJsonString(password?: string): Promise<{
  jsonText: string;
  keyCount: number;
  encrypted: boolean;
}> {
  const cleanPass = (password || '').trim();
  if (cleanPass.length >= 4) {
    const { blob, keyCount } = await EncryptedBackupService.createEncryptedBackupBlob(
      'all',
      cleanPass
    );
    const jsonText = await blob.text();
    return { jsonText, keyCount, encrypted: true };
  }
  const direct = buildDirectEnvelope();
  return {
    jsonText: JSON.stringify(direct, null, 2),
    keyCount: direct.keyCount,
    encrypted: false,
  };
}

export const AutoBackupService = {
  getPrefs(): AutoBackupPrefs {
    return loadPrefs();
  },

  setPrefs(patch: Partial<AutoBackupPrefs>): AutoBackupPrefs {
    return savePrefs(patch);
  },

  setDriveOverwriteSessionAuthorized(confirmed: boolean, password = ''): void {
    driveOverwriteSessionConfirmed = confirmed;
    sessionDrivePassword = password;
  },

  isDriveOverwriteSessionAuthorized(): boolean {
    return driveOverwriteSessionConfirmed;
  },

  supportsPhoneFilePicker(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
    );
  },

  async getLocalSlotsInfo(): Promise<{
    autoSlot: Omit<LocalBackupRecord, 'envelope'> | null;
    preResetSlot: Omit<LocalBackupRecord, 'envelope'> | null;
    hasPhoneFileHandle: boolean;
  }> {
    const [autoRec, preRec, fileHandle] = await Promise.all([
      idbGet<LocalBackupRecord>(SLOT_AUTO_OVERWRITE),
      idbGet<LocalBackupRecord>(SLOT_PRE_RESET),
      idbGet<FileHandleLike>(SLOT_PHONE_FILE_HANDLE),
    ]);
    return {
      autoSlot: autoRec
        ? {
            id: autoRec.id,
            reason: autoRec.reason,
            keyCount: autoRec.keyCount,
            sizeBytes: autoRec.sizeBytes,
            ownerEmail: autoRec.ownerEmail,
            savedAt: autoRec.savedAt,
          }
        : null,
      preResetSlot: preRec
        ? {
            id: preRec.id,
            reason: preRec.reason,
            keyCount: preRec.keyCount,
            sizeBytes: preRec.sizeBytes,
            ownerEmail: preRec.ownerEmail,
            savedAt: preRec.savedAt,
          }
        : null,
      hasPhoneFileHandle: Boolean(fileHandle),
    };
  },

  async saveLocalAutoOverwrite(reason = 'Auto-Timpa Berkala', slot: 'auto' | 'pre_reset' = 'auto'): Promise<LocalBackupRecord> {
    const envelope = buildDirectEnvelope();
    const serialized = JSON.stringify(envelope);
    const sizeBytes = new Blob([serialized]).size;
    const targetId = slot === 'pre_reset' ? SLOT_PRE_RESET : SLOT_AUTO_OVERWRITE;
    const record: LocalBackupRecord = {
      id: targetId,
      reason,
      keyCount: envelope.keyCount,
      sizeBytes,
      ownerEmail: envelope.ownerEmail,
      savedAt: new Date().toISOString(),
      envelope,
    };

    await idbSet(targetId, record);
    lastLocalSignature = buildSignature(envelope.entries);

    if (slot === 'pre_reset') {
      savePrefs({ lastPreResetAt: record.savedAt });
    } else {
      savePrefs({
        lastLocalBackupAt: record.savedAt,
        lastLocalKeyCount: record.keyCount,
        lastLocalSizeBytes: record.sizeBytes,
      });
    }

    return record;
  },

  async restoreLocalSlot(slot: 'auto' | 'pre_reset' = 'auto'): Promise<{
    restoredKeys: number;
    savedAt: string;
    ownerEmail: string;
  }> {
    const targetId = slot === 'pre_reset' ? SLOT_PRE_RESET : SLOT_AUTO_OVERWRITE;
    const record = await idbGet<LocalBackupRecord>(targetId);
    if (!record || !record.envelope?.entries) {
      throw new Error('Belum ada cadangan otomatis di penyimpanan HP.');
    }
    const restoredKeys = EncryptedBackupService.applyRestoredEntries(
      record.envelope.entries,
      'all',
      record.ownerEmail,
      slot === 'pre_reset' ? 'Pulihkan Titik Sebelum Reset' : 'Pulihkan Auto-Backup HP'
    );
    return {
      restoredKeys,
      savedAt: record.savedAt,
      ownerEmail: record.ownerEmail,
    };
  },

  async bindAndWritePhoneFile(password?: string): Promise<{ fileName: string; sizeBytes: number }> {
    const picker = (
      window as unknown as {
        showSaveFilePicker?: (opts: unknown) => Promise<FileHandleLike>;
      }
    ).showSaveFilePicker;

    if (!picker) {
      throw new Error('Peramban HP ini belum mendukung izin timpa file langsung.');
    }

    const handle = await picker({
      suggestedName: DRIVE_BACKUP_FILENAME,
      types: [
        {
          description: 'Arsip Cadangan WargaQu',
          accept: { 'application/json': ['.json', '.wqbak.json'] },
        },
      ],
    });

    await idbSet(SLOT_PHONE_FILE_HANDLE, handle);
    const sizeBytes = await this.writeToBoundPhoneFile(handle, password);
    return { fileName: handle.name || DRIVE_BACKUP_FILENAME, sizeBytes };
  },

  async writeToBoundPhoneFile(
    existingHandle?: FileHandleLike | null,
    password?: string
  ): Promise<number> {
    const handle = existingHandle || (await idbGet<FileHandleLike>(SLOT_PHONE_FILE_HANDLE));
    if (!handle) {
      throw new Error('Lokasi file di HP belum dipilih.');
    }

    if (handle.queryPermission) {
      let perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && handle.requestPermission) {
        perm = await handle.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') {
        throw new Error('Izin menulis file di HP tidak diberikan.');
      }
    }

    const { jsonText } = await buildUploadJsonString(password);
    const writable = await handle.createWritable();
    await writable.write(jsonText);
    await writable.close();

    const sizeBytes = new Blob([jsonText]).size;
    savePrefs({
      phoneFileName: handle.name || DRIVE_BACKUP_FILENAME,
      lastPhoneFileBackupAt: new Date().toISOString(),
    });
    return sizeBytes;
  },

  async trySilentPhoneFileOverwrite(): Promise<boolean> {
    try {
      const handle = await idbGet<FileHandleLike>(SLOT_PHONE_FILE_HANDLE);
      if (!handle || !handle.queryPermission) return false;
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return false;
      const { jsonText } = await buildUploadJsonString();
      const writable = await handle.createWritable();
      await writable.write(jsonText);
      await writable.close();
      savePrefs({
        phoneFileName: handle.name || DRIVE_BACKUP_FILENAME,
        lastPhoneFileBackupAt: new Date().toISOString(),
      });
      return true;
    } catch {
      return false;
    }
  },

  // =========================================================================
  // GOOGLE DRIVE API v3 — SISTEM TIMPA (OVERWRITE IN PLACE)
  // =========================================================================
  async findDriveBackupFile(accessToken: string): Promise<DriveFileSummary | null> {
    const q = `name='${DRIVE_BACKUP_FILENAME}' and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name,modifiedTime,size)&spaces=drive&orderBy=modifiedTime desc`;

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Gagal memeriksa Google Drive (${resp.status}): ${errText.slice(0, 120)}`);
    }
    const data = (await resp.json()) as { files?: DriveFileSummary[] };
    if (Array.isArray(data.files) && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  },

  async uploadOverwriteDriveBackup(
    accessToken: string,
    password?: string
  ): Promise<{
    fileId: string;
    overwritten: boolean;
    keyCount: number;
    sizeBytes: number;
    encrypted: boolean;
  }> {
    const { jsonText, keyCount, encrypted } = await buildUploadJsonString(password);
    const sizeBytes = new Blob([jsonText]).size;
    const existing = await this.findDriveBackupFile(accessToken);

    const boundary = `wargaqu_boundary_${Date.now().toString(36)}`;
    const metadata: Record<string, string> = existing
      ? { name: DRIVE_BACKUP_FILENAME }
      : { name: DRIVE_BACKUP_FILENAME, mimeType: 'application/json' };

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${jsonText}\r\n` +
      `--${boundary}--`;

    const endpoint = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
          existing.id
        )}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    const resp = await fetch(endpoint, {
      method: existing ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Gagal mengunggah ke Google Drive (${resp.status}): ${errText.slice(0, 140)}`);
    }

    const savedFile = (await resp.json()) as { id: string };
    lastDriveSyncMs = Date.now();
    savePrefs({
      lastDriveBackupAt: new Date().toISOString(),
      lastDriveFileId: savedFile.id,
      lastDriveKeyCount: keyCount,
      lastDriveSizeBytes: sizeBytes,
    });

    ZeroTrustService.appendAudit(
      AuthService.getAccount()?.email || 'WargaQu',
      existing ? 'Timpa Backup Google Drive' : 'Buat Backup Google Drive',
      `${DRIVE_BACKUP_FILENAME} (${keyCount} data · ${Math.round(sizeBytes / 1024)} KB)`,
      'info'
    );

    return {
      fileId: savedFile.id,
      overwritten: Boolean(existing),
      keyCount,
      sizeBytes,
      encrypted,
    };
  },

  async downloadDriveBackupEnvelope(
    accessToken: string,
    fileId: string
  ): Promise<AnyBackupEnvelope> {
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!resp.ok) {
      throw new Error(`Gagal mengunduh cadangan dari Google Drive (${resp.status}).`);
    }
    const parsed = (await resp.json()) as AnyBackupEnvelope;
    if (
      !parsed ||
      (parsed.app !== 'WargaQu-EncryptedBackup' && parsed.app !== 'WargaQu-DirectBackup')
    ) {
      throw new Error('Format file cadangan di Google Drive tidak dikenali.');
    }
    return parsed;
  },

  async restoreFromAnyEnvelope(
    envelope: AnyBackupEnvelope,
    password?: string
  ): Promise<{ restoredKeys: number; ownerEmail: string; createdAt: string }> {
    if (envelope.app === 'WargaQu-EncryptedBackup') {
      const decoded = await EncryptedBackupService.decryptEnvelope(envelope, password || '');
      const restoredKeys = EncryptedBackupService.applyRestoredEntries(
        decoded.entries || {},
        decoded.scope || envelope.scope,
        decoded.ownerEmail || envelope.ownerEmail,
        'Pulihkan Backup Google Drive (Terenkripsi)'
      );
      return {
        restoredKeys,
        ownerEmail: decoded.ownerEmail || envelope.ownerEmail,
        createdAt: envelope.createdAt,
      };
    }

    const restoredKeys = EncryptedBackupService.applyRestoredEntries(
      envelope.entries || {},
      envelope.scope || 'all',
      envelope.ownerEmail,
      'Pulihkan Backup Google Drive'
    );
    return {
      restoredKeys,
      ownerEmail: envelope.ownerEmail,
      createdAt: envelope.createdAt,
    };
  },

  // =========================================================================
  // SAFE RESET (RESET DATA AMAN)
  // =========================================================================
  async resetAppData(options: {
    saveBackupBeforeReset: boolean;
    includeLogout: boolean;
  }): Promise<{ clearedKeys: number; preResetSaved: boolean }> {
    let preResetSaved = false;
    if (options.saveBackupBeforeReset) {
      try {
        await this.saveLocalAutoOverwrite('Cadangan Otomatis Sebelum Reset', 'pre_reset');
        preResetSaved = true;
      } catch {
        // continue reset even if IDB fails
      }
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === 'wargaqu_hidden_device_token_v1' || k === PREFS_KEY) continue;
      if (
        k.startsWith('wargaqu_') ||
        k.startsWith('leluhurqu_grid_') ||
        k.startsWith('uq_') ||
        k.startsWith('baksoqu_') ||
        k.startsWith('siagaqu_')
      ) {
        keysToRemove.push(k);
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }

    if (options.includeLogout) {
      AuthService.logout();
      try {
        await FirebaseSyncService.signOutCloud();
      } catch {
        // ignore
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(RT_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(DOMPETQU_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(SIAGA_CIRCLE_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(ZERO_TRUST_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(MONETIZATION_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(ACCOUNT_GOV_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(DEVICE_PAIRING_SYNC_EVENT));
    }

    emitAutoBackupSync();
    return { clearedKeys: keysToRemove.length, preResetSaved };
  },

  /**
   * Sapu bersih data modul lokal ala WhatsApp sebelum akun baru masuk ke perangkat ini.
   * Menyimpan cadangan otomatis ke slot pre_reset dan tetap menjaga token fisik + kebijakan Zero Trust.
   */
  async wipeLocalAccountDataForSwitch(
    oldEmail: string,
    options?: { savePreSwitchBackup?: boolean }
  ): Promise<{ clearedKeys: number; preSwitchBackupSaved: boolean }> {
    let preSwitchBackupSaved = false;
    if (options?.savePreSwitchBackup !== false) {
      try {
        await this.saveLocalAutoOverwrite(
          `Cadangan Sebelum Ganti Akun (${oldEmail || 'Pemilik Lama'})`,
          'pre_reset'
        );
        preSwitchBackupSaved = true;
      } catch {
        // lanjutkan pembersihan meski penyimpanan IndexedDB gagal
      }
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || PRESERVED_INFRA_KEYS.has(k)) continue;
      if (
        k.startsWith('wargaqu_') ||
        k.startsWith('leluhurqu_grid_') ||
        k.startsWith('uq_') ||
        k.startsWith('baksoqu_') ||
        k.startsWith('siagaqu_')
      ) {
        keysToRemove.push(k);
      }
    }

    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }

    lastLocalSignature = '';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(RT_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(DOMPETQU_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(SIAGA_CIRCLE_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(ZERO_TRUST_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(MONETIZATION_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(ACCOUNT_GOV_SYNC_EVENT));
      window.dispatchEvent(new CustomEvent(DEVICE_PAIRING_SYNC_EVENT));
    }

    emitAutoBackupSync();
    return { clearedKeys: keysToRemove.length, preSwitchBackupSaved };
  },

  // =========================================================================
  // BACKGROUND AUTO-OVERWRITE SCHEDULER
  // =========================================================================
  startAutoBackupMonitor(): void {
    if (monitorStarted || typeof window === 'undefined') return;
    monitorStarted = true;

    const scheduleCheck = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(async () => {
        const prefs = loadPrefs();
        const envelope = buildDirectEnvelope();
        if (envelope.keyCount === 0) return;

        const sig = buildSignature(envelope.entries);
        const changed = sig !== lastLocalSignature;

        if (prefs.autoLocalEnabled && changed) {
          try {
            await this.saveLocalAutoOverwrite('Auto-Timpa HP Berkala', 'auto');
            await this.trySilentPhoneFileOverwrite();
          } catch {
            // ignore silent background errors
          }
        }

        // Only auto-overwrite Drive if user explicitly enabled & confirmed overwrite for this session
        const driveToken = FirebaseSyncService.getDriveAccessToken();
        const threeMinutes = 3 * 60 * 1000;
        if (
          prefs.autoDriveEnabled &&
          driveOverwriteSessionConfirmed &&
          driveToken &&
          changed &&
          Date.now() - lastDriveSyncMs >= threeMinutes
        ) {
          try {
            await this.uploadOverwriteDriveBackup(driveToken, sessionDrivePassword);
          } catch {
            // token expired or offline — user will be prompted when opening Backup panel
          }
        }
      }, 8000);
    };

    const events = [
      AUTH_SYNC_EVENT,
      RT_SYNC_EVENT,
      SIAGA_CIRCLE_SYNC_EVENT,
      ZERO_TRUST_SYNC_EVENT,
      MONETIZATION_SYNC_EVENT,
      ACCOUNT_GOV_SYNC_EVENT,
      'storage',
    ];
    events.forEach(ev => window.addEventListener(ev, scheduleCheck));

    // Initial check 6s after boot
    scheduleCheck();
  },
};
