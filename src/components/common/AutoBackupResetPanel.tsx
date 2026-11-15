import React, { useEffect, useState } from 'react';
import {
  Cloud,
  HardDrive,
  RefreshCw,
  RotateCcw,
  Trash2,
  FolderOpen,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lock,
  X,
} from 'lucide-react';
import {
  AUTO_BACKUP_SYNC_EVENT,
  AutoBackupPrefs,
  AutoBackupService,
  DRIVE_BACKUP_FILENAME,
  DriveFileSummary,
  LocalBackupRecord,
  type AnyBackupEnvelope,
} from '../../services/autoBackupService';
import {
  FIREBASE_AUTH_SYNC_EVENT,
  FirebaseSyncService,
} from '../../services/firebaseSyncService';

interface AutoBackupResetPanelProps {
  showNotification: (msg: string) => void;
}

type ConfirmDialogState =
  | null
  | {
      kind: 'drive_overwrite_now' | 'drive_enable_auto';
      existingDriveFile: DriveFileSummary | null;
    }
  | {
      kind: 'drive_restore';
      driveFile: DriveFileSummary;
      envelope: AnyBackupEnvelope;
    }
  | {
      kind: 'local_restore';
      slot: 'auto' | 'pre_reset';
      info: Omit<LocalBackupRecord, 'envelope'>;
    }
  | {
      kind: 'safe_reset';
    };

function formatTime(iso?: string): string {
  if (!iso) return 'Belum pernah';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AutoBackupResetPanel: React.FC<AutoBackupResetPanelProps> = ({
  showNotification,
}) => {
  const [prefs, setPrefs] = useState<AutoBackupPrefs>(() => AutoBackupService.getPrefs());
  const [localInfo, setLocalInfo] = useState<{
    autoSlot: Omit<LocalBackupRecord, 'envelope'> | null;
    preResetSlot: Omit<LocalBackupRecord, 'envelope'> | null;
    hasPhoneFileHandle: boolean;
  }>({ autoSlot: null, preResetSlot: null, hasPhoneFileHandle: false });

  const [hasDriveToken, setHasDriveToken] = useState<boolean>(() =>
    FirebaseSyncService.hasDriveAccessToken()
  );
  const [driveFileInfo, setDriveFileInfo] = useState<DriveFileSummary | null>(null);
  const [drivePassword, setDrivePassword] = useState<string>('');
  const [restorePassword, setRestorePassword] = useState<string>('');
  const [busyAction, setBusyAction] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(null);

  // Safe Reset modal toggles
  const [backupBeforeReset, setBackupBeforeReset] = useState<boolean>(true);
  const [resetIncludeLogout, setResetIncludeLogout] = useState<boolean>(false);

  const refreshState = async () => {
    setPrefs(AutoBackupService.getPrefs());
    setHasDriveToken(FirebaseSyncService.hasDriveAccessToken());
    const slots = await AutoBackupService.getLocalSlotsInfo();
    setLocalInfo(slots);
  };

  useEffect(() => {
    void refreshState();
    const onSync = () => {
      void refreshState();
    };
    window.addEventListener(AUTO_BACKUP_SYNC_EVENT, onSync);
    window.addEventListener(FIREBASE_AUTH_SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener(AUTO_BACKUP_SYNC_EVENT, onSync);
      window.removeEventListener(FIREBASE_AUTH_SYNC_EVENT, onSync);
    };
  }, []);

  const ensureDriveToken = async (): Promise<string | null> => {
    const existing = FirebaseSyncService.getDriveAccessToken();
    if (existing) return existing;
    setBusyAction('auth_drive');
    try {
      const token = await FirebaseSyncService.requestDriveAccess();
      setHasDriveToken(true);
      const existingFile = await AutoBackupService.findDriveBackupFile(token).catch(() => null);
      setDriveFileInfo(existingFile);
      showNotification('Izin Google Drive aktif untuk sesi ini.');
      return token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        showNotification(msg || 'Gagal mendapatkan izin Google Drive.');
      }
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const handleToggleAutoLocal = async () => {
    const nextVal = !prefs.autoLocalEnabled;
    AutoBackupService.setPrefs({ autoLocalEnabled: nextVal });
    if (nextVal) {
      try {
        await AutoBackupService.saveLocalAutoOverwrite('Auto-Timpa HP Diaktifkan', 'auto');
        showNotification('Auto-Backup di HP (Sistem Timpa) diaktifkan.');
      } catch {
        showNotification('Auto-Backup di HP diaktifkan.');
      }
    } else {
      showNotification('Auto-Backup otomatis di HP dimatikan.');
    }
  };

  const handleLocalBackupNow = async () => {
    setBusyAction('local_save');
    try {
      const rec = await AutoBackupService.saveLocalAutoOverwrite('Timpa Manual HP', 'auto');
      await AutoBackupService.trySilentPhoneFileOverwrite();
      await refreshState();
      showNotification(
        `Cadangan HP ditimpa (${rec.keyCount} data · ${Math.max(1, Math.round(rec.sizeBytes / 1024))} KB).`
      );
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal menyimpan cadangan di HP.');
    } finally {
      setBusyAction('');
    }
  };

  const handleBindPhoneFile = async () => {
    setBusyAction('phone_file');
    try {
      const res = await AutoBackupService.bindAndWritePhoneFile(drivePassword);
      await refreshState();
      showNotification(
        `File HP terhubung & ditimpa: ${res.fileName} (${Math.max(1, Math.round(res.sizeBytes / 1024))} KB).`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.toLowerCase().includes('abort')) {
        showNotification(msg || 'Gagal memilih file di memori HP.');
      }
    } finally {
      setBusyAction('');
    }
  };

  const handleRequestDriveOverwrite = async (mode: 'drive_overwrite_now' | 'drive_enable_auto') => {
    const token = await ensureDriveToken();
    if (!token) return;
    setBusyAction('drive_check');
    try {
      const existing = await AutoBackupService.findDriveBackupFile(token);
      setDriveFileInfo(existing);
      setConfirmDialog({ kind: mode, existingDriveFile: existing });
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal memeriksa file Google Drive.');
    } finally {
      setBusyAction('');
    }
  };

  const handleToggleAutoDrive = async () => {
    if (prefs.autoDriveEnabled) {
      AutoBackupService.setPrefs({ autoDriveEnabled: false });
      AutoBackupService.setDriveOverwriteSessionAuthorized(false, '');
      showNotification('Auto-Timpa Google Drive dimatikan.');
      return;
    }
    await handleRequestDriveOverwrite('drive_enable_auto');
  };

  const handleRequestDriveRestore = async () => {
    const token = await ensureDriveToken();
    if (!token) return;
    setBusyAction('drive_download');
    try {
      const found = await AutoBackupService.findDriveBackupFile(token);
      setDriveFileInfo(found);
      if (!found) {
        showNotification(`Belum ada file ${DRIVE_BACKUP_FILENAME} di Google Drive Anda.`);
        return;
      }
      const envelope = await AutoBackupService.downloadDriveBackupEnvelope(token, found.id);
      setRestorePassword('');
      setConfirmDialog({ kind: 'drive_restore', driveFile: found, envelope });
    } catch (err) {
      showNotification(err instanceof Error ? err.message : 'Gagal membaca cadangan Google Drive.');
    } finally {
      setBusyAction('');
    }
  };

  const executeConfirmedDialog = async () => {
    if (!confirmDialog) return;

    if (
      confirmDialog.kind === 'drive_overwrite_now' ||
      confirmDialog.kind === 'drive_enable_auto'
    ) {
      const token = FirebaseSyncService.getDriveAccessToken();
      if (!token) {
        setConfirmDialog(null);
        showNotification('Sesi izin Google Drive habis, silakan izinkan ulang.');
        return;
      }
      const enableAuto = confirmDialog.kind === 'drive_enable_auto';
      setConfirmDialog(null);
      setBusyAction('drive_upload');
      try {
        const res = await AutoBackupService.uploadOverwriteDriveBackup(token, drivePassword);
        if (enableAuto) {
          AutoBackupService.setPrefs({ autoDriveEnabled: true });
          AutoBackupService.setDriveOverwriteSessionAuthorized(true, drivePassword);
        }
        const refreshed = await AutoBackupService.findDriveBackupFile(token).catch(() => null);
        setDriveFileInfo(refreshed);
        await refreshState();
        showNotification(
          `${res.overwritten ? 'File Google Drive ditimpa' : 'Backup Google Drive dibuat'} (${res.keyCount} data${res.encrypted ? ' · Terenkripsi' : ''}).`
        );
      } catch (err) {
        showNotification(err instanceof Error ? err.message : 'Gagal menimpa cadangan Google Drive.');
      } finally {
        setBusyAction('');
      }
      return;
    }

    if (confirmDialog.kind === 'drive_restore') {
      const { envelope } = confirmDialog;
      if (envelope.app === 'WargaQu-EncryptedBackup' && !restorePassword.trim()) {
        showNotification('Masukkan kata sandi enkripsi untuk mendekripsi cadangan Drive.');
        return;
      }
      setBusyAction('drive_restore_apply');
      try {
        const res = await AutoBackupService.restoreFromAnyEnvelope(envelope, restorePassword);
        setConfirmDialog(null);
        await refreshState();
        showNotification(
          `Berhasil memulihkan ${res.restoredKeys} data dari Google Drive (${res.ownerEmail}).`
        );
      } catch (err) {
        showNotification(err instanceof Error ? err.message : 'Gagal memulihkan dari Google Drive.');
      } finally {
        setBusyAction('');
      }
      return;
    }

    if (confirmDialog.kind === 'local_restore') {
      const { slot } = confirmDialog;
      setConfirmDialog(null);
      setBusyAction('local_restore_apply');
      try {
        const res = await AutoBackupService.restoreLocalSlot(slot);
        await refreshState();
        showNotification(
          `Pulihkan ${res.restoredKeys} data dari cadangan HP (${formatTime(res.savedAt)}).`
        );
      } catch (err) {
        showNotification(err instanceof Error ? err.message : 'Gagal memulihkan cadangan HP.');
      } finally {
        setBusyAction('');
      }
      return;
    }

    if (confirmDialog.kind === 'safe_reset') {
      setConfirmDialog(null);
      setBusyAction('safe_reset');
      try {
        const res = await AutoBackupService.resetAppData({
          saveBackupBeforeReset: backupBeforeReset,
          includeLogout: resetIncludeLogout,
        });
        await refreshState();
        showNotification(
          `Reset selesai (${res.clearedKeys} data dibersihkan${res.preResetSaved ? ' · Cadangan sebelum reset tersimpan di HP' : ''}).`
        );
      } catch (err) {
        showNotification(err instanceof Error ? err.message : 'Gagal mereset data.');
      } finally {
        setBusyAction('');
      }
    }
  };

  const supportsFilePicker = AutoBackupService.supportsPhoneFilePicker();

  return (
    <div className="space-y-3 text-xs">
      {/* 1. AUTO-BACKUP DI HP (SISTEM TIMPA) */}
      <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <HardDrive className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900">
                Auto-Backup di HP (Sistem Timpa)
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Otomatis menimpa 1 slot cadangan lokal di perangkat setiap kali data berubah tanpa
                membuat file duplikat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleAutoLocal}
            className={`min-h-[30px] px-2.5 rounded-lg text-[10px] font-extrabold shrink-0 transition ${
              prefs.autoLocalEnabled
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {prefs.autoLocalEnabled ? 'AUTO ON' : 'OFF'}
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] text-slate-600 space-y-0.5">
          <div>
            Slot Timpa HP:{' '}
            <strong className="text-slate-900">
              {localInfo.autoSlot
                ? `${formatTime(localInfo.autoSlot.savedAt)} (${localInfo.autoSlot.keyCount} data · ${Math.max(1, Math.round(localInfo.autoSlot.sizeBytes / 1024))} KB)`
                : 'Belum ada snapshot'}
            </strong>
          </div>
          {prefs.phoneFileName && (
            <div className="text-[10px] text-emerald-800">
              File fisik HP ({prefs.phoneFileName}): ditimpa {formatTime(prefs.lastPhoneFileBackupAt)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busyAction !== ''}
            onClick={handleLocalBackupNow}
            className="min-h-[38px] bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-[11px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'local_save' ? 'animate-spin' : ''}`} />
            <span>Timpa HP Sekarang</span>
          </button>
          <button
            type="button"
            disabled={busyAction !== '' || !localInfo.autoSlot}
            onClick={() =>
              localInfo.autoSlot &&
              setConfirmDialog({
                kind: 'local_restore',
                slot: 'auto',
                info: localInfo.autoSlot,
              })
            }
            className="min-h-[38px] border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 text-[11px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Pulihkan dari HP</span>
          </button>
        </div>

        {localInfo.preResetSlot && (
          <button
            type="button"
            disabled={busyAction !== ''}
            onClick={() =>
              localInfo.preResetSlot &&
              setConfirmDialog({
                kind: 'local_restore',
                slot: 'pre_reset',
                info: localInfo.preResetSlot,
              })
            }
            className="w-full min-h-[34px] border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            <span>
              Undo Reset: Pulihkan Cadangan Sebelum Reset ({formatTime(localInfo.preResetSlot.savedAt)})
            </span>
          </button>
        )}

        {supportsFilePicker && (
          <button
            type="button"
            disabled={busyAction !== ''}
            onClick={handleBindPhoneFile}
            className="w-full min-h-[36px] border border-dashed border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              {localInfo.hasPhoneFileHandle
                ? 'Ubah Lokasi File Auto-Timpa di Memori HP'
                : 'Izinkan & Pilih File di Memori HP (Auto-Timpa)'}
            </span>
          </button>
        )}
      </div>

      {/* 2. AUTO-BACKUP GOOGLE DRIVE USER (SISTEM TIMPA) */}
      <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Cloud className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900">
                Auto-Backup Google Drive (Sistem Timpa)
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Menimpa 1 file (<span className="font-mono">{DRIVE_BACKUP_FILENAME}</span>) di
                Google Drive pribadi Anda sehingga tidak menumpuk.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busyAction !== ''}
            onClick={handleToggleAutoDrive}
            className={`min-h-[30px] px-2.5 rounded-lg text-[10px] font-extrabold shrink-0 transition ${
              prefs.autoDriveEnabled
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {prefs.autoDriveEnabled ? 'AUTO ON' : 'OFF'}
          </button>
        </div>

        {/* Official Google Sign-In / Drive Permission Button when token not in memory */}
        {!hasDriveToken ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="text-[11px] text-slate-600 leading-relaxed">
              Perlu izin manual ke Google Drive Anda untuk membuat, menimpa, dan memulihkan file
              cadangan WargaQu.
            </div>
            <button
              type="button"
              disabled={busyAction !== ''}
              onClick={() => void ensureDriveToken()}
              className="w-full min-h-[42px] bg-white hover:bg-slate-50 border border-[#747775] rounded-full px-4 flex items-center justify-center gap-2.5 text-[#1f1f1f] font-medium text-xs shadow-2xs transition disabled:opacity-60"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-4 h-4 shrink-0"
                style={{ display: 'block' }}
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>
                {busyAction === 'auth_drive'
                  ? 'Meminta Izin Google Drive...'
                  : 'Sign in with Google (Izinkan Drive)'}
              </span>
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2 text-[11px] text-emerald-900 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">
                Izin Google Drive aktif · Terakhir:{' '}
                <strong>
                  {formatTime(driveFileInfo?.modifiedTime || prefs.lastDriveBackupAt)}
                </strong>
              </span>
            </span>
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold text-slate-600 block mb-1">
            Sandi Enkripsi Drive (Opsional — kosongkan untuk Restore 1-klik)
          </label>
          <div className="relative">
            <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={drivePassword}
              onChange={e => setDrivePassword(e.target.value)}
              placeholder="Min. 4 karakter jika ingin dienkripsi AES-256"
              className="w-full min-h-[36px] border border-slate-300 rounded-xl pl-8 pr-3 text-[11px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busyAction !== ''}
            onClick={() => void handleRequestDriveOverwrite('drive_overwrite_now')}
            className="min-h-[38px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 text-[11px]"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>
              {busyAction === 'drive_upload' ? 'Menimpa...' : 'Backup & Timpa Drive'}
            </span>
          </button>
          <button
            type="button"
            disabled={busyAction !== ''}
            onClick={() => void handleRequestDriveRestore()}
            className="min-h-[38px] border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 text-[11px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {busyAction === 'drive_download' ? 'Mengunduh...' : 'Restore dari Drive'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. SAFE RESET DATA */}
      <div className="border border-rose-200 bg-rose-50/40 rounded-xl p-3.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-extrabold text-rose-900 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
            <span>Reset Data Aplikasi</span>
          </div>
          <p className="text-[11px] text-rose-700/80 mt-0.5">
            Kosongkan data lokal di HP ini dengan cadangan pengaman otomatis sebelum reset.
          </p>
        </div>
        <button
          type="button"
          disabled={busyAction !== ''}
          onClick={() => setConfirmDialog({ kind: 'safe_reset' })}
          className="min-h-[36px] px-3 border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 rounded-xl font-bold text-[11px] flex items-center gap-1 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* MANDATORY EXPLICIT CONFIRMATION MODAL FOR OVERWRITE / RESTORE / RESET */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/65 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-xs">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-slate-900">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>
                  {confirmDialog.kind === 'drive_overwrite_now' &&
                    'Konfirmasi Timpa File Google Drive'}
                  {confirmDialog.kind === 'drive_enable_auto' &&
                    'Aktifkan Auto-Timpa Google Drive'}
                  {confirmDialog.kind === 'drive_restore' &&
                    'Konfirmasi Restore dari Google Drive'}
                  {confirmDialog.kind === 'local_restore' &&
                    'Konfirmasi Pulihkan Cadangan HP'}
                  {confirmDialog.kind === 'safe_reset' && 'Konfirmasi Reset Data Aplikasi'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-slate-700 leading-relaxed">
              {(confirmDialog.kind === 'drive_overwrite_now' ||
                confirmDialog.kind === 'drive_enable_auto') && (
                <>
                  <p>
                    {confirmDialog.existingDriveFile ? (
                      <>
                        File cadangan{' '}
                        <strong className="font-mono text-slate-900">
                          {confirmDialog.existingDriveFile.name}
                        </strong>{' '}
                        (terakhir diubah{' '}
                        <strong>{formatTime(confirmDialog.existingDriveFile.modifiedTime)}</strong>)
                        sudah ada di Google Drive Anda dan akan <strong>ditimpa</strong> dengan
                        data terbaru.
                      </>
                    ) : (
                      <>
                        Aplikasi akan membuat file baru{' '}
                        <strong className="font-mono text-slate-900">{DRIVE_BACKUP_FILENAME}</strong>{' '}
                        di Google Drive Anda dan menimpa file yang sama setiap pembaruan berikutnya.
                      </>
                    )}
                  </p>
                  {confirmDialog.kind === 'drive_enable_auto' && (
                    <p className="text-[11px] bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-emerald-900">
                      Setelah dikonfirmasi, setiap perubahan data selama sesi ini akan otomatis
                      menimpa file tersebut secara berkala (maks. tiap 3 menit).
                    </p>
                  )}
                </>
              )}

              {confirmDialog.kind === 'drive_restore' && (
                <>
                  <p>
                    Data lokal di HP ini akan <strong>ditimpa</strong> oleh cadangan Google Drive{' '}
                    <strong className="font-mono">{confirmDialog.driveFile.name}</strong>:
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] space-y-0.5">
                    <div>
                      Pemilik: <strong>{confirmDialog.envelope.ownerEmail}</strong>
                    </div>
                    <div>
                      Tanggal Cadangan: <strong>{formatTime(confirmDialog.envelope.createdAt)}</strong>
                    </div>
                    <div>
                      Jumlah Data: <strong>{confirmDialog.envelope.keyCount} kunci</strong> ·{' '}
                      <strong>
                        {confirmDialog.envelope.app === 'WargaQu-EncryptedBackup'
                          ? 'Terenkripsi AES-256'
                          : 'Langsung'}
                      </strong>
                    </div>
                  </div>
                  {confirmDialog.envelope.app === 'WargaQu-EncryptedBackup' && (
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        Masukkan Kata Sandi Dekripsi Drive:
                      </label>
                      <input
                        type="password"
                        value={restorePassword}
                        onChange={e => setRestorePassword(e.target.value)}
                        placeholder="Kata sandi cadangan Drive"
                        className="w-full min-h-[38px] border border-slate-300 rounded-xl px-3"
                        autoFocus
                      />
                    </div>
                  )}
                </>
              )}

              {confirmDialog.kind === 'local_restore' && (
                <>
                  <p>
                    Data aplikasi di HP saat ini akan <strong>ditimpa</strong> dengan cadangan lokal{' '}
                    <strong>
                      {confirmDialog.slot === 'pre_reset'
                        ? 'Sebelum Reset'
                        : 'Auto-Timpa HP'}
                    </strong>
                    :
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] space-y-0.5">
                    <div>
                      Waktu Simpan: <strong>{formatTime(confirmDialog.info.savedAt)}</strong>
                    </div>
                    <div>
                      Jumlah Data: <strong>{confirmDialog.info.keyCount} kunci</strong> (
                      {Math.max(1, Math.round(confirmDialog.info.sizeBytes / 1024))} KB)
                    </div>
                  </div>
                </>
              )}

              {confirmDialog.kind === 'safe_reset' && (
                <>
                  <p>
                    Semua data lokal WargaQu (LeluhurQu, RTQu, POS/UsahaQu, AreaQu, ChatQu, dan
                    pengaturan lokal) di HP ini akan dikosongkan.
                  </p>
                  <label className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backupBeforeReset}
                      onChange={e => setBackupBeforeReset(e.target.checked)}
                      className="mt-0.5 accent-emerald-700"
                    />
                    <span>
                      <strong>Simpan cadangan otomatis di HP sebelum Reset</strong> (agar bisa
                      di-Undo kapan saja)
                    </span>
                  </label>
                  <label className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetIncludeLogout}
                      onChange={e => setResetIncludeLogout(e.target.checked)}
                      className="mt-0.5 accent-rose-700"
                    />
                    <span>Sekalian keluar dari akun saat ini</span>
                  </label>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="min-h-[40px] border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busyAction !== ''}
                  onClick={() => void executeConfirmedDialog()}
                  className={`min-h-[40px] rounded-xl font-bold text-white ${
                    confirmDialog.kind === 'safe_reset'
                      ? 'bg-rose-700 hover:bg-rose-800'
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {confirmDialog.kind === 'safe_reset'
                    ? 'Ya, Reset Sekarang'
                    : confirmDialog.kind === 'drive_restore' ||
                      confirmDialog.kind === 'local_restore'
                    ? 'Ya, Pulihkan & Timpa'
                    : 'Ya, Konfirmasi & Timpa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
