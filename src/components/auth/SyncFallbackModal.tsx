import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  FileUp,
  HardDrive,
  KeyRound,
  Lock,
  RefreshCw,
  RotateCcw,
  Server,
  Smartphone,
  X,
} from 'lucide-react';
import {
  AnyBackupEnvelope,
  AutoBackupService,
  DRIVE_BACKUP_FILENAME,
  DriveFileSummary,
  LocalBackupRecord,
} from '../../services/autoBackupService';
import {
  ApkMigrationService,
  SyncFallbackTriggerDetail,
} from '../../services/apkMigrationService';
import { EncryptedBackupService } from '../../services/encryptedBackupService';
import { FirebaseSyncService } from '../../services/firebaseSyncService';
import {
  getRelayServerOrigin,
  isNativeCapacitorApk,
  probeSharedRelayHealth,
  setCustomRelayServerOrigin,
} from '../../services/appOriginService';
import { AuthService } from '../../services/authService';

interface SyncFallbackModalProps {
  detail: SyncFallbackTriggerDetail | null;
  onClose: () => void;
  onOpenLogin?: (reason?: string) => void;
  showNotification: (msg: string) => void;
}

function formatShortTime(iso?: string): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const SyncFallbackModal: React.FC<SyncFallbackModalProps> = ({
  detail,
  onClose,
  onOpenLogin,
  showNotification,
}) => {
  const isOpen = Boolean(detail);
  const isNativeApk = isNativeCapacitorApk();
  const [busy, setBusy] = useState<string>('');
  const [statusNote, setStatusNote] = useState<{ tone: 'info' | 'warn' | 'error' | 'ok'; text: string } | null>(null);
  const [tokenInput, setTokenInput] = useState<string>('');
  const [relayUrlDraft, setRelayUrlDraft] = useState<string>(() => getRelayServerOrigin());
  const [showRelayConfig, setShowRelayConfig] = useState<boolean>(false);
  const [altPhoneDraft, setAltPhoneDraft] = useState<string>('');

  // Drive restore states (1-click auto find by fixed filename)
  const [drivePending, setDrivePending] = useState<{
    driveFile: DriveFileSummary;
    envelope: AnyBackupEnvelope;
  } | null>(null);
  const [drivePassword, setDrivePassword] = useState<string>('');

  // File restore states (fallback manual file)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [filePassword, setFilePassword] = useState<string>('');

  // Local IndexedDB slot check
  const [localSlots, setLocalSlots] = useState<{
    autoSlot: Omit<LocalBackupRecord, 'envelope'> | null;
    preResetSlot: Omit<LocalBackupRecord, 'envelope'> | null;
  }>({ autoSlot: null, preResetSlot: null });

  useEffect(() => {
    if (!detail) return;
    setStatusNote(null);
    setDrivePending(null);
    setDrivePassword('');
    setPendingFile(null);
    setFilePassword('');
    setTokenInput('');
    setRelayUrlDraft(getRelayServerOrigin());
    setShowRelayConfig(detail.reason === 'relay_unreachable');
    setAltPhoneDraft(
      detail.phone && detail.phone !== '0800-0000-0000' ? detail.phone : ''
    );
    void AutoBackupService.getLocalSlotsInfo().then(info => {
      setLocalSlots({
        autoSlot: info.autoSlot,
        preResetSlot: info.preResetSlot,
      });
    });
  }, [detail]);

  if (!isOpen || !detail) return null;

  const containerLabel = isNativeApk ? 'APK Android' : 'PWA Browser';
  const otherContainerLabel = isNativeApk ? 'PWA Browser' : 'APK Android';

  const getHeaderTitle = () => {
    if (detail.reason === 'superseded') {
      return 'Akun Aktif di Wadah Lain (Sesi Ditutup)';
    }
    if (detail.reason === 'relay_unreachable') {
      return 'Sinkronisasi Otomatis APK ↔ PWA Terputus';
    }
    if (detail.reason === 'not_found') {
      return 'Data Belum Ada di Server Relay';
    }
    return 'Pulihkan Cepat Data WargaQu (Tanpa Cari Manual)';
  };

  const getHeaderSubtitle = () => {
    if (detail.reason === 'superseded') {
      return `Akun baru masuk di ${
        detail.activeContainer === 'apk'
          ? 'APK Android'
          : detail.activeContainer === 'pwa'
          ? 'PWA Browser'
          : otherContainerLabel
      }. Cadangan lokal terakhir wadah ini sudah diamankan otomatis di memori HP.`;
    }
    if (detail.reason === 'relay_unreachable') {
      return `Server Relay bersama (${relayUrlDraft}) belum merespons API JSON saat ini, sehingga sistem belum bisa menarik data otomatis dari ${otherContainerLabel} atau memutus sesi lama. Gunakan 1-Klik Restore Google Drive atau Token di bawah.`;
    }
    if (detail.reason === 'not_found') {
      return detail.usedGooglePlaceholderPhone
        ? `Anda masuk via Google tanpa No. HP asli, atau cadangan di ${otherContainerLabel} belum sempat tersinkron ke relay. Tarik langsung dari Google Drive (1-Klik) atau masukkan No. HP yang dipakai di ${otherContainerLabel}.`
        : `Server Relay terhubung, tetapi belum menemukan snapshot dari ${otherContainerLabel} untuk akun ini. Anda bisa langsung tarik cadangan dari Google Drive (1-Klik) atau tempel Token Transfer.`;
    }
    return `Pilih sumber pemulihan instan tanpa harus mencari folder file satu per satu.`;
  };

  const handleRetryRelaySync = async (overridePhone?: string) => {
    const acc = AuthService.getAccount();
    const targetEmail = (acc?.email || detail.email || '').trim();
    const targetPhone = (overridePhone || altPhoneDraft || acc?.phone || detail.phone || '').trim();

    if (!targetEmail || !targetPhone) {
      setStatusNote({
        tone: 'warn',
        text: 'Masukkan Email dan No. HP akun terlebih dahulu untuk menarik dari Server Relay.',
      });
      return;
    }

    setBusy('relay');
    setStatusNote(null);
    try {
      if (showRelayConfig && relayUrlDraft.trim()) {
        setCustomRelayServerOrigin(relayUrlDraft.trim());
      }
      const online = await probeSharedRelayHealth(true);
      if (!online) {
        setStatusNote({
          tone: 'error',
          text: `Server Relay (${getRelayServerOrigin()}) masih belum aktif/merespons JSON (kemungkinan belum di-Publish/Deploy). Gunakan Google Drive 1-Klik atau Token WQH1 di bawah.`,
        });
        return;
      }

      if (acc) {
        await AuthService.registerActiveSessionOnServer(acc, false);
      }

      const res = await ApkMigrationService.pullAccountSnapshot(targetEmail, targetPhone, {
        onlyIfNewer: false,
      });
      if (res.serverReachable === false) {
        setStatusNote({
          tone: 'error',
          text: 'Server Relay menolak atau gagal dihubungi. Gunakan Google Drive 1-Klik.',
        });
        return;
      }
      if (res.restored) {
        if (overridePhone && acc && acc.phone === '0800-0000-0000') {
          AuthService.changeBoundPhone(targetPhone);
        }
        showNotification(
          `Berhasil! ${res.keyCount} data akun dipulihkan otomatis dari ${
            res.source === 'apk' ? 'APK' : 'PWA'
          }.`
        );
        onClose();
        return;
      }
      setStatusNote({
        tone: 'warn',
        text: 'Server Relay aktif, namun belum ada cadangan tersimpan dari wadah sebelah untuk kombinasi Email + No. HP tersebut.',
      });
    } finally {
      setBusy('');
    }
  };

  const handleOneClickDriveRestore = async () => {
    setBusy('drive');
    setStatusNote(null);
    try {
      const token = await FirebaseSyncService.requestDriveAccess(altPhoneDraft || detail.phone);
      const res = await AutoBackupService.findAndDownloadDriveBackup(token);
      if (!res.found || !res.driveFile || !res.envelope) {
        setStatusNote({
          tone: 'warn',
          text: `File cadangan "${DRIVE_BACKUP_FILENAME}" belum ditemukan di Google Drive akun tersebut. Aktifkan Auto-Backup Drive di perangkat lama terlebih dahulu.`,
        });
        return;
      }

      if (res.envelope.app === 'WargaQu-DirectBackup') {
        const applied = await AutoBackupService.restoreFromAnyEnvelope(res.envelope);
        AutoBackupService.setPrefs({ autoDriveEnabled: true });
        AutoBackupService.setDriveOverwriteSessionAuthorized(true, '');
        const syncedAcc = AuthService.getAccount();
        if (syncedAcc) {
          void AuthService.registerActiveSessionOnServer(syncedAcc, false);
          void ApkMigrationService.pushAccountSnapshotNow(true);
        }
        showNotification(
          `1-Klik Google Drive berhasil memulihkan ${applied.restoredKeys} data (${applied.ownerEmail})!`
        );
        onClose();
        return;
      }

      // Terenkripsi kata sandi -> tampilkan kolom sandi langsung di popup yang sama
      setDrivePending({ driveFile: res.driveFile, envelope: res.envelope });
      setStatusNote({
        tone: 'info',
        text: `File "${res.driveFile.name}" ditemukan (terenkripsi). Masukkan kata sandinya untuk memulihkan.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setStatusNote({
          tone: 'error',
          text: msg || 'Gagal mengakses Google Drive. Di beberapa Android WebView, coba lewat Token WQH1 atau File .wqbak.',
        });
      }
    } finally {
      setBusy('');
    }
  };

  const handleDecryptDrivePending = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drivePending) return;
    if (!drivePassword.trim()) {
      setStatusNote({ tone: 'warn', text: 'Masukkan kata sandi cadangan Drive.' });
      return;
    }
    setBusy('drive_decrypt');
    setStatusNote(null);
    try {
      const applied = await AutoBackupService.restoreFromAnyEnvelope(
        drivePending.envelope,
        drivePassword
      );
      AutoBackupService.setPrefs({ autoDriveEnabled: true });
      AutoBackupService.setDriveOverwriteSessionAuthorized(true, drivePassword);
      const syncedAcc = AuthService.getAccount();
      if (syncedAcc) {
        void AuthService.registerActiveSessionOnServer(syncedAcc, false);
        void ApkMigrationService.pushAccountSnapshotNow(true);
      }
      showNotification(
        `Berhasil mendekripsi & memulihkan ${applied.restoredKeys} data dari Google Drive!`
      );
      onClose();
    } catch (err) {
      setStatusNote({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Kata sandi Drive salah.',
      });
    } finally {
      setBusy('');
    }
  };

  const handleRestoreLocalSlot = async (slot: 'auto' | 'pre_reset') => {
    setBusy(`local_${slot}`);
    setStatusNote(null);
    try {
      const res = await AutoBackupService.restoreLocalSlot(slot);
      showNotification(
        `Berhasil memulihkan ${res.restoredKeys} data dari memori HP (${formatShortTime(res.savedAt)})!`
      );
      onClose();
    } catch (err) {
      setStatusNote({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Gagal memulihkan slot lokal.',
      });
    } finally {
      setBusy('');
    }
  };

  const handleRestoreToken = async () => {
    let token = tokenInput.trim();
    if (!token && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip?.trim()) {
          token = clip.trim();
          setTokenInput(token);
        }
      } catch {
        // ignore clipboard permission errors
      }
    }
    if (!token) {
      setStatusNote({ tone: 'warn', text: 'Tempel kode transfer WQH1:... dari wadah sebelah.' });
      return;
    }
    setBusy('token');
    setStatusNote(null);
    try {
      const res = await ApkMigrationService.consumePwaHandoff(token);
      const syncedAcc = AuthService.getAccount();
      if (syncedAcc) {
        void AuthService.registerActiveSessionOnServer(syncedAcc, false);
      }
      showNotification(`Berhasil memulihkan ${res.restoredKeys} data lewat Token Transfer!`);
      onClose();
    } catch (err) {
      setStatusNote({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Token transfer tidak valid atau kedaluwarsa.',
      });
    } finally {
      setBusy('');
    }
  };

  const handlePickFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('file');
    setStatusNote(null);
    try {
      const res = await EncryptedBackupService.restoreFromAnyFile(file, filePassword);
      showNotification(`Berhasil memulihkan ${res.restoredKeys} data dari file ${file.name}!`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'PASSWORD_REQUIRED') {
        setPendingFile(file);
        setStatusNote({
          tone: 'info',
          text: `File "${file.name}" terenkripsi. Masukkan kata sandi di bawah lalu tekan Pulihkan.`,
        });
      } else {
        setStatusNote({
          tone: 'error',
          text: msg || 'Gagal membaca file cadangan.',
        });
      }
    } finally {
      setBusy('');
    }
  };

  const handleDecryptPendingFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile) return;
    setBusy('file_decrypt');
    setStatusNote(null);
    try {
      const res = await EncryptedBackupService.restoreFromAnyFile(pendingFile, filePassword);
      showNotification(`Berhasil memulihkan ${res.restoredKeys} data dari file!`);
      onClose();
    } catch (err) {
      setStatusNote({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Kata sandi salah.',
      });
    } finally {
      setBusy('');
    }
  };

  const hasAnyLocalSlot = Boolean(localSlots.preResetSlot || localSlots.autoSlot);

  return (
    <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 bg-amber-50/70 flex items-start justify-between gap-2 shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                Pemberitahuan Sinkronisasi · {containerLabel}
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 leading-snug mt-0.5">
                {getHeaderTitle()}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-amber-100 flex items-center justify-center text-slate-500 shrink-0"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3">
          <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
            {getHeaderSubtitle()}
          </p>

          {statusNote && (
            <div
              className={`p-3 rounded-xl border text-[11px] font-medium leading-snug ${
                statusNote.tone === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : statusNote.tone === 'warn'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : statusNote.tone === 'ok'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-sky-50 border-sky-300 text-sky-900'
              }`}
            >
              {statusNote.text}
            </div>
          )}

          {detail.reason === 'superseded' && onOpenLogin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLogin(
                  'Masuk kembali di wadah ini untuk mengambil alih sesi tunggal & menarik data terbaru'
                );
              }}
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" />
              <span>Masuk Kembali di {containerLabel} &amp; Tarik Data Terbaru</span>
            </button>
          )}

          {/* Option 1: 1-Klik Restore Google Drive (Zero file hunting) */}
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-emerald-700" />
                <span>1-Klik Pulihkan dari Google Drive</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700">Tanpa Cari File</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-snug">
              Langsung mencari file otomatis{' '}
              <span className="font-mono text-[10px]">{DRIVE_BACKUP_FILENAME}</span> di Google
              Drive Anda dan memulihkan seluruh modul.
            </p>

            {!drivePending ? (
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => void handleOneClickDriveRestore()}
                className="w-full min-h-[40px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${busy === 'drive' ? 'animate-spin' : ''}`} />
                <span>
                  {busy === 'drive'
                    ? 'Mencari & Mengunduh dari Drive...'
                    : 'Cari & Pulihkan dari Google Drive'}
                </span>
              </button>
            ) : (
              <form onSubmit={handleDecryptDrivePending} className="space-y-2 pt-1">
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={drivePassword}
                    onChange={e => setDrivePassword(e.target.value)}
                    placeholder="Kata sandi cadangan Drive"
                    className="w-full min-h-[38px] border border-slate-300 bg-white rounded-xl pl-8 pr-3 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy !== ''}
                  className="w-full min-h-[38px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                >
                  {busy === 'drive_decrypt' ? 'Membuka Enkripsi...' : 'Dekripsi & Pulihkan'}
                </button>
              </form>
            )}
          </div>

          {/* Option 2: Phone number retry or Relay server check */}
          {detail.reason !== 'superseded' && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
              <div className="flex items-center justify-between gap-2">
                <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-slate-700" />
                  <span>Coba Tarik Ulang dari Server Relay</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRelayConfig(prev => !prev)}
                  className="text-[10px] font-bold text-emerald-700 hover:underline"
                >
                  {showRelayConfig ? 'Tutup URL' : 'Atur URL Relay'}
                </button>
              </div>

              {detail.usedGooglePlaceholderPhone && (
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    No. HP yang dipakai di {otherContainerLabel} (wajib sama untuk kunci enkripsi):
                  </label>
                  <input
                    type="tel"
                    value={altPhoneDraft}
                    onChange={e => setAltPhoneDraft(e.target.value)}
                    placeholder="Contoh: 0812-3456-7890"
                    className="w-full min-h-[36px] border border-slate-300 rounded-lg px-2.5 font-mono text-[11px]"
                  />
                </div>
              )}

              {showRelayConfig && (
                <input
                  type="url"
                  value={relayUrlDraft}
                  onChange={e => setRelayUrlDraft(e.target.value)}
                  placeholder="https://server-wargaqu-anda.run.app"
                  className="w-full min-h-[36px] border border-slate-300 rounded-lg px-2.5 font-mono text-[11px]"
                />
              )}

              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => void handleRetryRelaySync(altPhoneDraft)}
                className="w-full min-h-[38px] rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-900 font-bold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy === 'relay' ? 'animate-spin' : ''}`} />
                <span>
                  {busy === 'relay' ? 'Memeriksa Server Relay...' : 'Uji Relay & Tarik Snapshot'}
                </span>
              </button>
            </div>
          )}

          {/* Option 3: Local IndexedDB slot in this container */}
          {hasAnyLocalSlot && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-slate-700" />
                <span>Cadangan Otomatis di Memori {containerLabel}</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {localSlots.autoSlot && (
                  <button
                    type="button"
                    disabled={busy !== ''}
                    onClick={() => void handleRestoreLocalSlot('auto')}
                    className="w-full min-h-[36px] px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-left flex items-center justify-between text-[11px]"
                  >
                    <span className="font-bold text-slate-800">
                      Slot Auto-Timpa ({localSlots.autoSlot.keyCount} data)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {formatShortTime(localSlots.autoSlot.savedAt)}
                    </span>
                  </button>
                )}
                {localSlots.preResetSlot && (
                  <button
                    type="button"
                    disabled={busy !== ''}
                    onClick={() => void handleRestoreLocalSlot('pre_reset')}
                    className="w-full min-h-[36px] px-3 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-left flex items-center justify-between text-[11px]"
                  >
                    <span className="font-bold text-amber-900">
                      Slot Sebelum Switch/Keluar ({localSlots.preResetSlot.keyCount} data)
                    </span>
                    <span className="text-[10px] text-amber-800">
                      {formatShortTime(localSlots.preResetSlot.savedAt)}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Option 4: Token WQH1 or Backup File */}
          <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-white">
            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-slate-700" />
              <span>Alternatif Cepat: Token WQH1 atau File .wqbak</span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="Tempel token WQH1:..."
                className="flex-1 min-h-[36px] border border-slate-300 rounded-lg px-2.5 text-[11px] font-mono"
              />
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => void handleRestoreToken()}
                className="min-h-[36px] px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shrink-0"
              >
                {tokenInput.trim() ? 'Pulihkan' : 'Tempel'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.wqbak,application/json"
              onChange={handlePickFileRestore}
              className="hidden"
            />
            {!pendingFile ? (
              <button
                type="button"
                disabled={busy !== ''}
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-[36px] border border-dashed border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Pilih File Cadangan (.wqbak.json) dari HP</span>
              </button>
            ) : (
              <form onSubmit={handleDecryptPendingFile} className="flex gap-1.5">
                <input
                  type="password"
                  required
                  value={filePassword}
                  onChange={e => setFilePassword(e.target.value)}
                  placeholder="Sandi file backup"
                  className="flex-1 min-h-[36px] border border-slate-300 rounded-lg px-2.5 text-[11px]"
                />
                <button
                  type="submit"
                  disabled={busy !== ''}
                  className="min-h-[36px] px-3 rounded-lg bg-emerald-700 text-white font-bold text-[11px] shrink-0"
                >
                  Buka
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs"
          >
            Lanjutkan dengan Data Saat Ini
          </button>
        </div>
      </div>
    </div>
  );
};
