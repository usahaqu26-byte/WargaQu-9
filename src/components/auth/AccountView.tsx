import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  ChevronRight,
  KeyRound,
  Copy,
  RefreshCw,
  ShieldAlert,
  Lock,
  Smartphone,
  Cloud,
  Monitor,
  FileText,
  Copyright,
  ExternalLink,
  Wifi,
  Shield,
  Repeat,
  Eye,
  EyeOff,
  Download,
} from 'lucide-react';
import {
  AUTH_SYNC_EVENT,
  AuthAccount,
  AuthService,
  DeviceAccountBinding,
  MAX_DEVICE_SWITCHES_30D,
  isValidPinFormat,
} from '../../services/authService';
import { RT_SYNC_EVENT, RtSiagaStorage, WargaMember } from '../../services/rtSiagaStorage';
import {
  ZERO_TRUST_SYNC_EVENT,
  ZeroTrustService,
  maskDeviceFingerprint,
} from '../../services/zeroTrustService';
import {
  FIREBASE_AUTH_SYNC_EVENT,
  FirebaseSyncService,
} from '../../services/firebaseSyncService';
import { EncryptedBackupPanel } from '../common/EncryptedBackupPanel';
import { AutoBackupResetPanel } from '../common/AutoBackupResetPanel';
import { AutoBackupService } from '../../services/autoBackupService';
import { LegalNoticeModal, LegalTab } from '../common/LegalNoticeModal';
import { LinkedDevicesSection } from './DevicePairingPanel';
import { DevicePairingService } from '../../services/devicePairingService';
import {
  DesktopViewportMode,
  VIEWPORT_MODE_SYNC_EVENT,
  ViewportLayoutService,
} from '../../services/viewportLayoutService';
import {
  buildApiUrl,
  getCustomRelayServerOrigin,
  getRelayServerOrigin,
  isNativeCapacitorApk,
  probeSharedRelayHealth,
  setCustomRelayServerOrigin,
} from '../../services/appOriginService';
import {
  ApkMigrationService,
  PwaHandoffCreated,
  dispatchSyncFallbackPrompt,
} from '../../services/apkMigrationService';
import {
  APP_VERSION,
  APP_VERSION_CODE,
  inferGitHubRepoSlug,
  saveGitHubRepoSlug,
} from '../../config/appVersion';
import { ApkUpdateService, ApkUpdateStatus } from '../../services/apkUpdateService';

interface AccountViewProps {
  onBack: () => void;
  onOpenRtQu: () => void;
  onOpenSiagaQu: () => void;
  onOpenAdminZeroTrust: () => void;
  onOpenStorePreview?: () => void;
  showNotification: (msg: string) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  onBack,
  onOpenRtQu,
  onOpenSiagaQu,
  onOpenAdminZeroTrust,
  onOpenStorePreview,
  showNotification,
}) => {
  const [account, setAccount] = useState<AuthAccount | null>(() => AuthService.getAccount());
  const [binding, setBinding] = useState<DeviceAccountBinding | null>(() =>
    AuthService.getDeviceBinding()
  );
  const [rtMember, setRtMember] = useState<WargaMember>(() => RtSiagaStorage.getCurrentMember());
  const isAdminAccount = ZeroTrustService.isAdminEmail(account?.email);

  const [emailInput, setEmailInput] = useState<string>(
    account?.email || binding?.boundEmail || ''
  );
  const [phoneInput, setPhoneInput] = useState<string>(
    account?.phone || binding?.boundPhone || ''
  );
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [activeProcedure, setActiveProcedure] = useState<
    'none' | 'create_pin' | 'change_phone' | 'change_pin' | 'release_binding'
  >('none');

  // Procedure modal/drawer inputs
  const [verifyMode, setVerifyMode] = useState<'pin' | 'recovery'>('pin');
  const [procVerifyInput, setProcVerifyInput] = useState<string>('');
  const [procNewPhone, setProcNewPhone] = useState<string>('');
  const [procPhoneReason, setProcPhoneReason] = useState<string>('');
  const [procNewPin, setProcNewPin] = useState<string>('');
  const [procConfirmPin, setProcConfirmPin] = useState<string>('');
  const [procBusy, setProcBusy] = useState<boolean>(false);
  const [releaseAuthMode, setReleaseAuthMode] = useState<'owner_verify' | 'force_wipe'>('owner_verify');
  const [forceWipeConfirmed, setForceWipeConfirmed] = useState<boolean>(false);
  const [preSwitchBackingUp, setPreSwitchBackingUp] = useState<boolean>(false);

  const [isFrozen, setIsFrozen] = useState<boolean>(() => ZeroTrustService.isCurrentDeviceFrozen());
  const [recoveryCfg, setRecoveryCfg] = useState<{ code: string; guardianContact: string }>(() =>
    account
      ? ZeroTrustService.getRecoveryConfig(account.email)
      : { code: '', guardianContact: '' }
  );
  const [guardianInput, setGuardianInput] = useState<string>(recoveryCfg.guardianContact || '');
  const [cloudEmail, setCloudEmail] = useState<string>(
    () => FirebaseSyncService.getCurrentUser()?.email || ''
  );
  const [cloudConnecting, setCloudConnecting] = useState<boolean>(false);
  const [pendingPairToken, setPendingPairToken] = useState<string>(() =>
    DevicePairingService.getPendingPairToken()
  );
  const [viewportMode, setViewportMode] = useState<DesktopViewportMode>(() =>
    ViewportLayoutService.getMode()
  );
  const [legalModal, setLegalModal] = useState<{ open: boolean; tab: LegalTab }>({
    open: false,
    tab: 'privasi',
  });
  const isNativeApk = isNativeCapacitorApk();
  const deviceMask = maskDeviceFingerprint(AuthService.getHiddenDeviceId());
  const cooldownStatus = AuthService.getSwitchCooldownStatus();
  const remainingSwitchQuota = cooldownStatus.freeRemaining;
  const trustProfile = AuthService.getTrustProfile();
  const hasBoundOwner = Boolean(binding?.boundEmail);
  const hasPin = Boolean(binding?.pinHash);
  const [relayOriginDraft, setRelayOriginDraft] = useState<string>(() => getRelayServerOrigin());
  const [relayHasCustom, setRelayHasCustom] = useState<boolean>(() =>
    Boolean(getCustomRelayServerOrigin())
  );
  const [editingRelayOrigin, setEditingRelayOrigin] = useState<boolean>(false);
  const [relayPingStatus, setRelayPingStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>(
    'idle'
  );
  const [relayPingInfo, setRelayPingInfo] = useState<string>('');
  const [migrationBusy, setMigrationBusy] = useState<boolean>(false);
  const [handoffCreated, setHandoffCreated] = useState<PwaHandoffCreated | null>(null);
  const [handoffTokenInput, setHandoffTokenInput] = useState<string>('');
  const [apkUpdateStatus, setApkUpdateStatus] = useState<ApkUpdateStatus | null>(null);
  const [apkRepoDraft, setApkRepoDraft] = useState<string>(() => inferGitHubRepoSlug());
  const [apkCheckBusy, setApkCheckBusy] = useState<boolean>(false);
  const [apkDownloadPct, setApkDownloadPct] = useState<number | null>(null);
  const [apkInstallPermNeeded, setApkInstallPermNeeded] = useState<boolean>(false);

  useEffect(() => {
    const sync = () => {
      const acc = AuthService.getAccount();
      const b = AuthService.getDeviceBinding();
      setAccount(acc);
      setBinding(b);
      setRtMember(RtSiagaStorage.getCurrentMember());
      setIsFrozen(ZeroTrustService.isCurrentDeviceFrozen());
      setCloudEmail(FirebaseSyncService.getCurrentUser()?.email || '');
      if (acc) {
        setEmailInput(acc.email);
        setPhoneInput(acc.phone);
        const cfg = ZeroTrustService.getRecoveryConfig(acc.email);
        setRecoveryCfg(cfg);
        setGuardianInput(cfg.guardianContact || '');
      } else if (b?.boundEmail) {
        setEmailInput(b.boundEmail);
        setPhoneInput(b.boundPhone || '');
      }
    };
    const onPairArrived = () => {
      setPendingPairToken(DevicePairingService.getPendingPairToken());
    };
    const onViewportSync = () => {
      setViewportMode(ViewportLayoutService.getMode());
    };
    window.addEventListener(AUTH_SYNC_EVENT, sync);
    window.addEventListener(RT_SYNC_EVENT, sync);
    window.addEventListener(ZERO_TRUST_SYNC_EVENT, sync);
    window.addEventListener(FIREBASE_AUTH_SYNC_EVENT, sync);
    window.addEventListener('wargaqu-pair-invite-arrived', onPairArrived);
    window.addEventListener(VIEWPORT_MODE_SYNC_EVENT, onViewportSync);
    void ApkUpdateService.checkForUpdate(false).then(st => {
      setApkUpdateStatus(st);
      if (st.repoSlug) setApkRepoDraft(st.repoSlug);
    });
    return () => {
      window.removeEventListener(AUTH_SYNC_EVENT, sync);
      window.removeEventListener(RT_SYNC_EVENT, sync);
      window.removeEventListener(ZERO_TRUST_SYNC_EVENT, sync);
      window.removeEventListener(FIREBASE_AUTH_SYNC_EVENT, sync);
      window.removeEventListener('wargaqu-pair-invite-arrived', onPairArrived);
      window.removeEventListener(VIEWPORT_MODE_SYNC_EVENT, onViewportSync);
    };
  }, []);

  const resetProcedureInputs = () => {
    setProcVerifyInput('');
    setProcNewPhone('');
    setProcPhoneReason('');
    setProcNewPin('');
    setProcConfirmPin('');
    setVerifyMode(hasPin ? 'pin' : 'recovery');
    setReleaseAuthMode('owner_verify');
    setForceWipeConfirmed(false);
  };

  const openProcedure = (
    proc: 'none' | 'create_pin' | 'change_phone' | 'change_pin' | 'release_binding'
  ) => {
    resetProcedureInputs();
    setActiveProcedure(prev => (prev === proc ? 'none' : proc));
  };

  const verifyProcedureOwner = async (ownerEmail: string): Promise<{ ok: boolean; usedRecovery: boolean }> => {
    if (!hasPin || verifyMode === 'recovery') {
      const validCode = ZeroTrustService.verifyRecoveryCode(ownerEmail, procVerifyInput);
      if (!validCode) {
        showNotification('Kode Pemulihan (WQ-XXXX-XXXX) tidak cocok. Cek kode cadangan Anda.');
        return { ok: false, usedRecovery: false };
      }
      return { ok: true, usedRecovery: true };
    }
    const validPin = await AuthService.verifyPin(procVerifyInput);
    if (!validPin) {
      showNotification('PIN Keamanan 6 digit tidak cocok. Coba lagi atau pakai Kode Pemulihan.');
      return { ok: false, usedRecovery: false };
    }
    return { ok: true, usedRecovery: false };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFrozen) {
      showNotification('Perangkat ini sedang dibekukan. Hubungi Admin Zero Trust.');
      return;
    }
    if (account) {
      showNotification(
        'Email & No. HP sudah terikat di perangkat ini. Gunakan tombol Prosedur di bawah untuk perubahan sah.'
      );
      return;
    }

    const wasFreshInstall = ApkMigrationService.isFreshEmptyInstallation();
    ApkMigrationService.beginLoginPullWindow();
    try {
      const res = await AuthService.bindAndLogin({
        email: emailInput,
        phone: phoneInput,
        pin: pinInput,
      });
      if (!res.ok || !res.account) {
        showNotification(res.message);
        return;
      }

      const saved = res.account;
      setPinInput('');
      RtSiagaStorage.syncAuthAccount(saved);
      ZeroTrustService.registerOrTouchCurrentDevice(saved.email, saved.phone);
      if (FirebaseSyncService.isCloudSignedIn()) {
        void FirebaseSyncService.syncMyAccountRegistry('akun', true);
      }
      await probeSharedRelayHealth();
      const regRes = await AuthService.registerActiveSessionOnServer(saved, false);
      const pullRes = await ApkMigrationService.pullAccountSnapshot(saved.email, saved.phone, {
        onlyIfNewer: !wasFreshInstall,
      });
      ApkMigrationService.endLoginPullWindow();

      if (pullRes.restored) {
        showNotification(
          `Masuk berhasil & ${pullRes.keyCount} data akun disinkronkan dari ${
            pullRes.source === 'apk' ? 'APK' : 'PWA'
          }!`
        );
        return;
      }
      if (pullRes.serverReachable === false || !regRes.serverReachable) {
        showNotification('Masuk berhasil. Membuka asisten pemulihan cadangan...');
        dispatchSyncFallbackPrompt({
          reason: 'relay_unreachable',
          email: saved.email,
          phone: saved.phone,
        });
        return;
      }
      void ApkMigrationService.pushAccountSnapshotNow(true);
      if (pullRes.reason === 'not_found' && wasFreshInstall) {
        dispatchSyncFallbackPrompt({
          reason: 'not_found',
          email: saved.email,
          phone: saved.phone,
        });
        return;
      }
      showNotification(res.message);
    } finally {
      ApkMigrationService.endLoginPullWindow();
    }
  };

  const handleCreateLegacyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPinFormat(procNewPin)) {
      showNotification('PIN Keamanan harus tepat 6 digit angka.');
      return;
    }
    if (procNewPin.trim() !== procConfirmPin.trim()) {
      showNotification('Konfirmasi PIN tidak cocok.');
      return;
    }
    setProcBusy(true);
    try {
      const res = await AuthService.setOrUpdatePin(procNewPin);
      showNotification(res.message);
      if (res.ok) {
        setActiveProcedure('none');
        resetProcedureInputs();
      }
    } finally {
      setProcBusy(false);
    }
  };

  const handleProcedureChangePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    if (procNewPhone.replace(/\D/g, '').length < 8) {
      showNotification('Masukkan No. HP / WhatsApp baru minimal 8 digit.');
      return;
    }
    setProcBusy(true);
    try {
      const authCheck = await verifyProcedureOwner(account.email);
      if (!authCheck.ok) return;

      const oldPhone = account.phone;
      const updated = AuthService.changeBoundPhone(procNewPhone);
      if (!updated) {
        showNotification('Gagal memperbarui No. HP terikat.');
        return;
      }
      RtSiagaStorage.syncAuthAccount(updated);
      ZeroTrustService.recordAuthorizedPhoneChange(
        account.email,
        oldPhone,
        updated.phone,
        procPhoneReason.trim()
      );
      if (authCheck.usedRecovery) {
        ZeroTrustService.regenerateRecoveryCode(account.email);
      }
      if (FirebaseSyncService.isCloudSignedIn()) {
        void FirebaseSyncService.syncMyAccountRegistry('akun', true);
      }
      setActiveProcedure('none');
      resetProcedureInputs();
      showNotification('Prosedur Ganti No. HP berhasil disetujui & disinkronkan!');
    } finally {
      setProcBusy(false);
    }
  };

  const handleProcedureChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ownerEmail = account?.email || binding?.boundEmail || '';
    if (!ownerEmail) return;
    if (!isValidPinFormat(procNewPin)) {
      showNotification('PIN baru wajib tepat 6 digit angka.');
      return;
    }
    if (procNewPin.trim() !== procConfirmPin.trim()) {
      showNotification('Konfirmasi PIN baru tidak cocok.');
      return;
    }
    setProcBusy(true);
    try {
      const authCheck = await verifyProcedureOwner(ownerEmail);
      if (!authCheck.ok) return;

      const res = await AuthService.setOrUpdatePin(procNewPin, { bypassVerification: true });
      if (!res.ok) {
        showNotification(res.message);
        return;
      }
      if (authCheck.usedRecovery) {
        ZeroTrustService.regenerateRecoveryCode(ownerEmail);
      }
      ZeroTrustService.appendAudit(
        ownerEmail,
        'PIN Keamanan Perangkat Diperbarui',
        `${deviceMask} memperbarui PIN 6 digit`,
        'info'
      );
      setActiveProcedure('none');
      resetProcedureInputs();
      showNotification('PIN Keamanan 6 digit berhasil diperbarui.');
    } finally {
      setProcBusy(false);
    }
  };

  const handlePreSwitchBackup = async () => {
    setPreSwitchBackingUp(true);
    try {
      await AutoBackupService.saveLocalAutoOverwrite('Cadangan Sebelum Ganti Akun', 'pre_reset');
      showNotification('Cadangan data terakhir berhasil disimpan ke brankas lokal HP!');
    } catch {
      showNotification('Gagal membuat cadangan lokal. Coba ekspor file backup di panel Backup di bawah.');
    } finally {
      setPreSwitchBackingUp(false);
    }
  };

  const handleProcedureReleaseBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    const ownerEmail = account?.email || binding?.boundEmail || '';
    if (!ownerEmail) return;

    const latestCooldown = AuthService.getSwitchCooldownStatus();
    if (!latestCooldown.allowedNow) {
      const hoursLeft = Math.max(1, Math.ceil(latestCooldown.remainingMs / (60 * 60 * 1000)));
      showNotification(
        `Jeda keamanan 24 jam sedang aktif (sisa sekitar ${hoursLeft} jam) untuk mencegah penyalahgunaan multi-akun.`
      );
      return;
    }

    setProcBusy(true);
    try {
      let usedRecovery = false;
      if (releaseAuthMode === 'force_wipe') {
        if (!forceWipeConfirmed) {
          showNotification(
            'Centang persetujuan hapus total data lama terlebih dahulu untuk melanjutkan.'
          );
          return;
        }
      } else {
        const authCheck = await verifyProcedureOwner(ownerEmail);
        if (!authCheck.ok) return;
        usedRecovery = authCheck.usedRecovery;
      }

      // Sapu bersih seluruh data lokal akun lama (pola bersih ala WhatsApp)
      const wipeResult = await AutoBackupService.wipeLocalAccountDataForSwitch(ownerEmail, {
        savePreSwitchBackup: true,
      });

      const res = AuthService.releaseDeviceBinding();
      if (!res.ok) {
        showNotification(res.message);
        return;
      }
      if (usedRecovery) {
        ZeroTrustService.regenerateRecoveryCode(ownerEmail);
      }
      ZeroTrustService.recordAuthorizedBindingRelease(
        ownerEmail,
        releaseAuthMode === 'force_wipe'
          ? 'Ganti Akun Pola Bersih WhatsApp (Hapus Total Data Lama)'
          : 'Ganti Akun Pola Bersih WhatsApp (Terverifikasi Pemilik)'
      );
      if (FirebaseSyncService.isCloudSignedIn()) {
        void FirebaseSyncService.signOutCloud().catch(() => {});
      }
      setEmailInput('');
      setPhoneInput('');
      setPinInput('');
      setCloudEmail('');
      setActiveProcedure('none');
      resetProcedureInputs();
      showNotification(
        `Data lokal lama (${wipeResult.clearedKeys} item) dibersihkan ala WhatsApp. Perangkat siap untuk akun baru.`
      );
    } finally {
      setProcBusy(false);
    }
  };

  const handleConnectGoogleCloud = async () => {
    setCloudConnecting(true);
    const wasFreshInstall = ApkMigrationService.isFreshEmptyInstallation();
    ApkMigrationService.beginLoginPullWindow();
    try {
      const user = await FirebaseSyncService.signInWithGoogle(phoneInput);
      setCloudEmail(user.email || '');
      const acc = AuthService.getAccount();
      if (acc) {
        await probeSharedRelayHealth();
        const regRes = await AuthService.registerActiveSessionOnServer(acc, false);
        const pullRes = await ApkMigrationService.pullAccountSnapshot(acc.email, acc.phone, {
          onlyIfNewer: !wasFreshInstall,
        });
        ApkMigrationService.endLoginPullWindow();
        const usedPlaceholderPhone = acc.phone === '0800-0000-0000';
        if (pullRes.restored) {
          showNotification(
            `Google terhubung & ${pullRes.keyCount} data dari ${
              pullRes.source === 'apk' ? 'APK' : 'PWA'
            } disinkronkan!`
          );
          return;
        }
        if (pullRes.serverReachable === false || !regRes.serverReachable) {
          dispatchSyncFallbackPrompt({
            reason: 'relay_unreachable',
            email: acc.email,
            phone: acc.phone,
            usedGooglePlaceholderPhone: usedPlaceholderPhone,
          });
        } else {
          void ApkMigrationService.pushAccountSnapshotNow(true);
          if (pullRes.reason === 'not_found' && (wasFreshInstall || usedPlaceholderPhone)) {
            dispatchSyncFallbackPrompt({
              reason: 'not_found',
              email: acc.email,
              phone: acc.phone,
              usedGooglePlaceholderPhone: usedPlaceholderPhone,
            });
          }
        }
      }
      showNotification(`Cloud Firebase terhubung (${user.email}).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        showNotification(msg || 'Gagal menghubungkan akun Google Cloud.');
      }
    } finally {
      ApkMigrationService.endLoginPullWindow();
      setCloudConnecting(false);
    }
  };

  const handleLogout = async () => {
    await AutoBackupService.flushAllAutoBackupsBeforeLogout('Cadangan Otomatis Sebelum Keluar');
    await ApkMigrationService.pushAccountSnapshotNow(true);
    AuthService.logout();
    void FirebaseSyncService.signOutCloud().catch(() => {});
    setPinInput('');
    setCloudEmail('');
    setActiveProcedure('none');
    showNotification('Cadangan terakhir disimpan & sesi ditutup. Siap masuk di wadah lain.');
  };

  const handleCopyRecoveryCode = async () => {
    if (!recoveryCfg.code) return;
    try {
      await navigator.clipboard.writeText(recoveryCfg.code);
      showNotification('Kode Pemulihan disalin! Simpan di tempat aman selain HP ini.');
    } catch {
      showNotification(`Kode Pemulihan Anda: ${recoveryCfg.code}`);
    }
  };

  const handleSaveGuardian = () => {
    if (!account) return;
    ZeroTrustService.setGuardianContact(account.email, guardianInput);
    showNotification('Kontak Wali Terpercaya disimpan untuk pemulihan HP rusak.');
  };

  const handleFreezeLostPhone = () => {
    if (!account) return;
    const lockedCount = ZeroTrustService.freezeAccountDevicesAsLost(
      account.email,
      'Pengguna mengaktifkan Mode Darurat HP Hilang'
    );
    showNotification(
      `${lockedCount} perangkat dibekukan (Remote Lock Zero Trust aktif).`
    );
  };

  const handleTestRelayConnection = async () => {
    setRelayPingStatus('checking');
    setRelayPingInfo('');
    try {
      const resp = await fetch(buildApiUrl('/api/relay-health'), {
        headers: { Accept: 'application/json' },
      });
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok || !ct.includes('application/json')) {
        setRelayPingStatus('error');
        setRelayPingInfo(
          `Server (${relayOriginDraft}) belum aktif untuk API Relay (HTTP ${resp.status}). Publikasikan/Share server Cloud Run terlebih dahulu atau masukkan URL Relay aktif.`
        );
        return;
      }
      const data = (await resp.json()) as {
        connectedClients?: number;
        activeChannels?: number;
        version?: string;
      };
      setRelayPingStatus('ok');
      setRelayPingInfo(
        `Terhubung (v${data.version || APP_VERSION} · ${data.connectedClients ?? 0} perangkat · ${
          data.activeChannels ?? 0
        } kanal)`
      );
      showNotification('Koneksi sinkronisasi APK ↔ PWA terhubung lancar!');
    } catch {
      setRelayPingStatus('error');
      setRelayPingInfo('Tidak dapat menjangkau server relay. Periksa URL atau internet.');
    }
  };

  const handleSaveRelayOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = setCustomRelayServerOrigin(relayOriginDraft);
    if (!saved) {
      showNotification('Masukkan URL server yang valid (contoh: https://domain-anda.run.app).');
      return;
    }
    setRelayOriginDraft(saved);
    setRelayHasCustom(true);
    setEditingRelayOrigin(false);
    setRelayPingStatus('idle');
    void probeSharedRelayHealth(true).then(() => {
      window.dispatchEvent(new CustomEvent('wargaqu-relay-origin-changed'));
    });
    showNotification('Alamat Server Relay APK ↔ PWA diperbarui. Menguji koneksi & sinkronisasi...');
  };

  const handleResetRelayOrigin = () => {
    setCustomRelayServerOrigin('');
    void probeSharedRelayHealth(true).then(() => {
      const fallback = getRelayServerOrigin();
      setRelayOriginDraft(fallback);
      window.dispatchEvent(new CustomEvent('wargaqu-relay-origin-changed'));
    });
    setRelayOriginDraft(getRelayServerOrigin());
    setRelayHasCustom(false);
    setEditingRelayOrigin(false);
    setRelayPingStatus('idle');
    showNotification('Alamat Server Relay dikembalikan ke bawaan WargaQu.');
  };

  const handleCreatePwaHandoff = async () => {
    setMigrationBusy(true);
    try {
      const created = await ApkMigrationService.createPwaToApkHandoff();
      setHandoffCreated(created);
      try {
        await navigator.clipboard.writeText(created.shareToken);
      } catch {
        // clipboard may require user gesture in some WebViews
      }
      showNotification(
        `Paket transfer (${created.keyCount} data) siap! Membuka APK & menyalin token cadangan.`
      );
      if (!isNativeApk && typeof window !== 'undefined') {
        window.location.href = created.deepLinkUrl;
      }
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Gagal menyiapkan paket transfer data ke APK.'
      );
    } finally {
      setMigrationBusy(false);
    }
  };

  const handleCopyHandoffToken = async () => {
    if (!handoffCreated) return;
    try {
      await navigator.clipboard.writeText(handoffCreated.shareToken);
      showNotification('Token transfer PWA disalin! Tempelkan di APK pada menu Akun Saya.');
    } catch {
      showNotification(`Token: ${handoffCreated.shareToken}`);
    }
  };

  const handleConsumeHandoffToken = async (rawInput?: string) => {
    let token = (rawInput ?? handoffTokenInput).trim();
    if (!token && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim()) {
          token = clip.trim();
          setHandoffTokenInput(token);
        }
      } catch {
        // ignore clipboard permission prompt
      }
    }
    if (!token) {
      showNotification('Tempel token transfer WQH1:... dari PWA terlebih dahulu.');
      return;
    }
    setMigrationBusy(true);
    try {
      const res = await ApkMigrationService.consumePwaHandoff(token);
      setHandoffTokenInput('');
      showNotification(
        `Berhasil memindahkan ${res.restoredKeys} data dari PWA ke APK (${res.ownerEmail})!`
      );
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Gagal menerima data transfer dari PWA.'
      );
    } finally {
      setMigrationBusy(false);
    }
  };

  const handlePullAccountSyncNow = async () => {
    const targetEmail = (account?.email || emailInput).trim();
    const targetPhone = (account?.phone || phoneInput).trim();
    if (!targetEmail || !targetPhone) {
      showNotification('Masuk atau isi Email & No. HP terlebih dahulu untuk menarik data akun.');
      return;
    }
    setMigrationBusy(true);
    try {
      await probeSharedRelayHealth();
      const res = await ApkMigrationService.pullAccountSnapshot(targetEmail, targetPhone, {
        onlyIfNewer: false,
      });
      if (res.serverReachable === false) {
        showNotification(
          'Server Relay belum merespons API JSON. Klik "Uji Koneksi" atau pastikan Server Relay sudah di-Publish/Deploy.'
        );
        return;
      }
      if (res.restored) {
        showNotification(
          `${res.keyCount} data akun berhasil ditarik dari ${res.source === 'apk' ? 'APK' : 'PWA'}!`
        );
      } else {
        const pushed = await ApkMigrationService.pushAccountSnapshotNow(true);
        showNotification(
          pushed
            ? 'Belum ada data lebih baru di server; data perangkat ini diunggah untuk sinkronisasi.'
            : 'Belum ada cadangan akun di server relay untuk Email & No. HP tersebut.'
        );
      }
    } finally {
      setMigrationBusy(false);
    }
  };

  const handleSaveApkRepo = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveGitHubRepoSlug(apkRepoDraft);
    if (!saved) {
      showNotification('Format repositori GitHub harus seperti: pemilik/nama-repo');
      return;
    }
    setApkRepoDraft(saved);
    void handleCheckApkUpdateNow();
    showNotification(`Sumber update APK disimpan (${saved}).`);
  };

  const handleCheckApkUpdateNow = async () => {
    setApkCheckBusy(true);
    try {
      const st = await ApkUpdateService.checkForUpdate(true);
      setApkUpdateStatus(st);
      if (st.hasUpdate) {
        showNotification(
          `Update APK ditemukan: v${st.latestVersion} (terpasang v${st.installedVersion}). Ketuk Unduh & Timpa.`
        );
      } else {
        showNotification(
          `Versi saat ini v${st.installedVersion} sudah sama atau terbaru dibanding v${st.latestVersion}.`
        );
      }
    } finally {
      setApkCheckBusy(false);
    }
  };

  const handleDownloadAndInstallApk = async () => {
    const url =
      apkUpdateStatus?.apkDownloadUrl ||
      (apkRepoDraft
        ? `https://github.com/${apkRepoDraft}/releases/latest/download/WargaQu-latest.apk`
        : '');
    if (!url) {
      showNotification('Isi repositori GitHub rilis terlebih dahulu (contoh: pemilik/wargaqu).');
      return;
    }
    setApkInstallPermNeeded(false);
    setApkDownloadPct(0);
    try {
      const outcome = await ApkUpdateService.downloadAndInstallUpdate(url, pct =>
        setApkDownloadPct(pct)
      );
      setApkDownloadPct(null);
      if (outcome.outcome === 'permission_required') {
        setApkInstallPermNeeded(true);
      }
      showNotification(outcome.message);
    } catch (err) {
      setApkDownloadPct(null);
      showNotification(err instanceof Error ? err.message : 'Gagal mengunduh update APK.');
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden text-slate-800">
      <header className="bg-white border-b border-slate-200 px-4 lg:px-6 pt-4 pb-3 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="w-10 h-10 -ml-1 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-extrabold text-slate-900">Akun &amp; Pengaturan</h1>
              <p className="text-[11px] text-slate-500">
                Identitas tunggal Email, No HP &amp; Tautan Laptop/PC
              </p>
            </div>
          </div>

          {account && (
            <button
              onClick={() => void handleLogout()}
              className="min-h-[36px] px-2.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-bold flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto divide-y divide-slate-200 lg:divide-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:p-6">
          <div className="divide-y divide-slate-200 lg:border lg:border-slate-200 lg:rounded-2xl lg:overflow-hidden lg:bg-white lg:self-start">
        {/* Form Login / Edit Akun */}
        <section className="p-4 space-y-3">
          {isFrozen && (
            <div className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-800 text-[11px] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Perangkat ini sedang dibekukan oleh kebijakan keamanan (status HP Hilang).{' '}
                {isAdminAccount
                  ? 'Buka lewat Panel Admin Zero Trust jika ini perangkat sah Anda.'
                  : 'Hubungi pengurus komunitas atau dukungan warga jika ini perangkat sah Anda.'}
              </span>
            </div>
          )}

          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-extrabold text-slate-900 block">
                {account
                  ? `Masuk sebagai ${AuthService.getDisplayName(account)}`
                  : hasBoundOwner
                  ? 'Perangkat Terikat (Sesi Ditutup)'
                  : 'Ikat Akun Baru ke Perangkat'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block">
                {deviceMask} · {hasPin ? 'PIN Aktif' : 'Level 1 (Tanpa PIN)'} · Ganti cepat:{' '}
                {remainingSwitchQuota}/{MAX_DEVICE_SWITCHES_30D}
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                trustProfile.badgeTone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : trustProfile.badgeTone === 'sky'
                  ? 'border-sky-300 bg-sky-50 text-sky-800'
                  : trustProfile.badgeTone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {trustProfile.label}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-snug">{trustProfile.summary}</p>

          {!account && hasBoundOwner && binding && (
            <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/70 text-[11px] text-sky-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-sky-700" />
                <span>Perlindungan 1 Perangkat = 1 Akun Aktif</span>
              </div>
              <p className="leading-snug text-sky-800">
                Perangkat ini terkunci untuk pemilik{' '}
                <strong className="font-mono">{AuthService.maskEmail(binding.boundEmail)}</strong> (
                <strong className="font-mono">{AuthService.maskPhone(binding.boundPhone)}</strong>).
                Masuk dengan akun pemilik atau gunakan Prosedur Ganti Akun Bersih (ala WhatsApp).
              </p>
            </div>
          )}

          {account && !hasPin && activeProcedure !== 'create_pin' && (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-800 flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900">
                  Tingkatkan Keamanan: Tambah PIN 6 Digit (Opsional)
                </div>
                <div className="text-slate-600">
                  Disarankan jika Anda memakai UsahaQu, DompetQu, atau menjadi Pengurus RTQu.
                </div>
              </div>
              <button
                type="button"
                onClick={() => openProcedure('create_pin')}
                className="min-h-[34px] px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold shrink-0"
              >
                Buat PIN
              </button>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">Email</label>
                {account && (
                  <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Terkunci ke Perangkat</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  readOnly={Boolean(account)}
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="nama@gmail.com"
                  className={`w-full min-h-[42px] border rounded-xl pl-9 pr-3 ${
                    account
                      ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                      : 'border-slate-300 bg-white'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">No. HP / WhatsApp</label>
                {account && (
                  <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Terkunci ke Perangkat</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  readOnly={Boolean(account)}
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  placeholder="0812-3456-7890"
                  className={`w-full min-h-[42px] border rounded-xl pl-9 pr-3 font-mono ${
                    account
                      ? 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                      : 'border-slate-300 bg-white'
                  }`}
                />
              </div>
            </div>

            {!account && (!hasBoundOwner || hasPin) && (
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {hasBoundOwner && hasPin
                    ? 'PIN Keamanan Pemilik (6 Digit)'
                    : 'PIN Keamanan 6 Digit — Opsional (Penjual / Pengurus RT)'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    required={hasBoundOwner && hasPin}
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={hasBoundOwner ? '••••••' : 'Opsional (6 digit angka)'}
                    className="w-full min-h-[42px] border border-slate-300 rounded-xl pl-9 pr-10 font-mono tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                    title={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {hasBoundOwner && hasPin
                    ? 'Masukkan PIN pemilik untuk membuka sesi kembali.'
                    : 'Boleh dikosongkan untuk masuk cepat Level 1. PIN bisa dibuat kapan saja.'}
                </p>
              </div>
            )}

            {!account && (
              <button
                type="submit"
                className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold"
              >
                {hasBoundOwner
                  ? hasPin
                    ? 'Verifikasi PIN & Masuk Kembali'
                    : 'Masuk Kembali ke Akun Pemilik'
                  : 'Ikat Akun & Masuk Sekarang'}
              </button>
            )}
          </form>

          {/* Procedural Controls when Account is Bound (Anti-Arbitrary Overwrite) */}
          {(account || hasBoundOwner) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {account && (
                <button
                  type="button"
                  onClick={() => openProcedure('change_phone')}
                  className={`min-h-[36px] px-3 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition ${
                    activeProcedure === 'change_phone'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Prosedur Ganti No. HP</span>
                </button>
              )}

              {account && (
                <button
                  type="button"
                  onClick={() => openProcedure(hasPin ? 'change_pin' : 'create_pin')}
                  className={`min-h-[36px] px-3 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition ${
                    activeProcedure === 'change_pin' || activeProcedure === 'create_pin'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{hasPin ? 'Ubah PIN' : 'Buat PIN 6 Digit'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => openProcedure('release_binding')}
                className={`min-h-[36px] px-3 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition ${
                  activeProcedure === 'release_binding'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'border-amber-300 text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>{account ? 'Prosedur Ganti Akun / Lepas HP' : 'Lepas Ikatan Pemilik'}</span>
              </button>
            </div>
          )}

          {/* Inline Guided Procedure Forms */}
          {activeProcedure === 'create_pin' && account && (
            <form
              onSubmit={handleCreateLegacyPin}
              className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2.5 text-xs"
            >
              <div className="font-extrabold text-slate-900">
                Buat PIN Keamanan Perangkat (6 Digit)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={procNewPin}
                  onChange={e => setProcNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN Baru (6 digit)"
                  className="min-h-[38px] border border-slate-300 bg-white rounded-lg px-3 font-mono"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={procConfirmPin}
                  onChange={e => setProcConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Ulangi PIN"
                  className="min-h-[38px] border border-slate-300 bg-white rounded-lg px-3 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={procBusy}
                  className="min-h-[36px] px-3.5 rounded-lg bg-emerald-700 text-white font-bold"
                >
                  Simpan &amp; Kunci Perangkat
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProcedure('none')}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-300 text-slate-600 font-semibold"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {activeProcedure === 'change_phone' && account && (
            <form
              onSubmit={handleProcedureChangePhone}
              className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">Prosedur Resmi Ganti No. HP</span>
                {hasPin && (
                  <button
                    type="button"
                    onClick={() => {
                      setProcVerifyInput('');
                      setVerifyMode(prev => (prev === 'pin' ? 'recovery' : 'pin'));
                    }}
                    className="text-[10px] font-bold text-emerald-700 hover:underline"
                  >
                    {verifyMode === 'pin' ? 'Lupa PIN? Pakai Kode Pemulihan' : 'Pakai PIN 6 Digit'}
                  </button>
                )}
              </div>
              <input
                type={!hasPin || verifyMode === 'recovery' ? 'text' : 'password'}
                inputMode={!hasPin || verifyMode === 'recovery' ? 'text' : 'numeric'}
                required
                value={procVerifyInput}
                onChange={e =>
                  setProcVerifyInput(
                    !hasPin || verifyMode === 'recovery'
                      ? e.target.value.toUpperCase()
                      : e.target.value.replace(/\D/g, '').slice(0, 6)
                  )
                }
                placeholder={
                  !hasPin || verifyMode === 'recovery'
                    ? 'Kode Pemulihan (WQ-XXXX-XXXX)'
                    : 'Masukkan PIN Keamanan 6 Digit'
                }
                className="w-full min-h-[38px] border border-slate-300 bg-white rounded-lg px-3 font-mono"
              />
              <input
                type="tel"
                required
                value={procNewPhone}
                onChange={e => setProcNewPhone(e.target.value)}
                placeholder="No. HP / WhatsApp Baru (contoh: 0812...)"
                className="w-full min-h-[38px] border border-slate-300 bg-white rounded-lg px-3 font-mono"
              />
              <input
                type="text"
                value={procPhoneReason}
                onChange={e => setProcPhoneReason(e.target.value)}
                placeholder="Alasan singkat (opsional, mis. Ganti kartu SIM)"
                className="w-full min-h-[38px] border border-slate-300 bg-white rounded-lg px-3"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={procBusy}
                  className="min-h-[36px] px-3.5 rounded-lg bg-emerald-700 text-white font-bold"
                >
                  Verifikasi &amp; Perbarui No. HP
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProcedure('none')}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-300 text-slate-600 font-semibold"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {activeProcedure === 'change_pin' && (account || hasBoundOwner) && (
            <form
              onSubmit={handleProcedureChangePin}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">Ubah PIN Keamanan Perangkat</span>
                {hasPin && (
                  <button
                    type="button"
                    onClick={() => {
                      setProcVerifyInput('');
                      setVerifyMode(prev => (prev === 'pin' ? 'recovery' : 'pin'));
                    }}
                    className="text-[10px] font-bold text-emerald-700 hover:underline"
                  >
                    {verifyMode === 'pin' ? 'Lupa PIN? Pakai Kode Pemulihan' : 'Pakai PIN Lama'}
                  </button>
                )}
              </div>
              <input
                type={!hasPin || verifyMode === 'recovery' ? 'text' : 'password'}
                inputMode={!hasPin || verifyMode === 'recovery' ? 'text' : 'numeric'}
                required
                value={procVerifyInput}
                onChange={e =>
                  setProcVerifyInput(
                    !hasPin || verifyMode === 'recovery'
                      ? e.target.value.toUpperCase()
                      : e.target.value.replace(/\D/g, '').slice(0, 6)
                  )
                }
                placeholder={
                  !hasPin || verifyMode === 'recovery'
                    ? 'Kode Pemulihan (WQ-XXXX-XXXX)'
                    : 'PIN Saat Ini (6 digit)'
                }
                className="w-full min-h-[38px] border border-slate-300 bg-white rounded-lg px-3 font-mono"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={procNewPin}
                  onChange={e => setProcNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="PIN Baru (6 digit)"
                  className="min-h-[38px] border border-slate-300 bg-white rounded-lg px-3 font-mono"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={procConfirmPin}
                  onChange={e => setProcConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Konfirmasi PIN Baru"
                  className="min-h-[38px] border border-slate-300 bg-white rounded-lg px-3 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={procBusy}
                  className="min-h-[36px] px-3.5 rounded-lg bg-slate-900 text-white font-bold"
                >
                  Simpan PIN Baru
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProcedure('none')}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-300 text-slate-600 font-semibold"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {activeProcedure === 'release_binding' && (account || hasBoundOwner) && (
            <form
              onSubmit={handleProcedureReleaseBinding}
              className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-amber-950">
                  Prosedur Ganti Akun / Lepas HP (Pola Bersih ala WhatsApp)
                </span>
              </div>

              <div className="text-[11px] text-amber-900 leading-snug space-y-1">
                <p>
                  Sebelum akun baru masuk, <strong>seluruh data lokal akun lama di perangkat ini disapu bersih</strong>{' '}
                  agar riwayat DompetQu, RTQu, ChatQu, UsahaQu, NasabQu, dan SiagaQu tidak tercampur.
                </p>
                {cooldownStatus.allowedNow ? (
                  <p>
                    {remainingSwitchQuota > 0 ? (
                      <>
                        Tersisa <strong>{remainingSwitchQuota}× ganti cepat tanpa jeda</strong> (per 30 hari).
                        Pergantian ke-3 dan seterusnya menerapkan jeda keamanan 24 jam.
                      </>
                    ) : (
                      <>Jeda 24 jam sudah selesai — perangkat siap berpindah akun sekarang.</>
                    )}
                  </p>
                ) : (
                  <p className="font-bold text-rose-800">
                    Jeda keamanan 24 jam sedang aktif (sisa sekitar{' '}
                    {Math.max(1, Math.ceil(cooldownStatus.remainingMs / (60 * 60 * 1000)))} jam). Hubungi Admin Zero
                    Trust jika darurat.
                  </p>
                )}
              </div>

              {account && (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-amber-200 bg-white">
                  <span className="text-[11px] text-slate-700">
                    Ingin simpan data Anda sebelum dihapus dari HP ini?
                  </span>
                  <button
                    type="button"
                    onClick={handlePreSwitchBackup}
                    disabled={preSwitchBackingUp}
                    className="min-h-[32px] px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-[11px] shrink-0 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {preSwitchBackingUp ? 'Menyimpan...' : 'Cadangkan Dulu'}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1 p-1 bg-amber-100/80 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setReleaseAuthMode('owner_verify')}
                  className={`min-h-[32px] rounded-md font-bold transition ${
                    releaseAuthMode === 'owner_verify'
                      ? 'bg-white text-amber-950 shadow-xs'
                      : 'text-amber-900/75'
                  }`}
                >
                  Verifikasi Pemilik
                </button>
                <button
                  type="button"
                  onClick={() => setReleaseAuthMode('force_wipe')}
                  className={`min-h-[32px] rounded-md font-bold transition ${
                    releaseAuthMode === 'force_wipe'
                      ? 'bg-white text-rose-800 shadow-xs'
                      : 'text-amber-900/75'
                  }`}
                >
                  HP Bekas / Lupa PIN
                </button>
              </div>

              {releaseAuthMode === 'owner_verify' ? (
                <div className="space-y-1.5">
                  {hasPin && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setProcVerifyInput('');
                          setVerifyMode(prev => (prev === 'pin' ? 'recovery' : 'pin'));
                        }}
                        className="text-[10px] font-bold text-amber-800 hover:underline"
                      >
                        {verifyMode === 'pin' ? 'Lupa PIN? Pakai Kode Pemulihan' : 'Pakai PIN 6 Digit'}
                      </button>
                    </div>
                  )}
                  <input
                    type={!hasPin || verifyMode === 'recovery' ? 'text' : 'password'}
                    inputMode={!hasPin || verifyMode === 'recovery' ? 'text' : 'numeric'}
                    required
                    value={procVerifyInput}
                    onChange={e =>
                      setProcVerifyInput(
                        !hasPin || verifyMode === 'recovery'
                          ? e.target.value.toUpperCase()
                          : e.target.value.replace(/\D/g, '').slice(0, 6)
                      )
                    }
                    placeholder={
                      !hasPin || verifyMode === 'recovery'
                        ? 'Kode Pemulihan Pemilik (WQ-XXXX-XXXX)'
                        : 'PIN Keamanan Pemilik (6 digit)'
                    }
                    className="w-full min-h-[38px] border border-amber-300 bg-white rounded-lg px-3 font-mono"
                  />
                </div>
              ) : (
                <label className="flex items-start gap-2 p-2.5 rounded-lg border border-rose-200 bg-rose-50/70 text-[11px] text-rose-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceWipeConfirmed}
                    onChange={e => setForceWipeConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-rose-300 text-rose-700 focus:ring-rose-600"
                  />
                  <span>
                    Saya mengerti ini HP bekas / ganti pengguna: <strong>hapus bersih seluruh data lokal akun lama</strong>{' '}
                    (DompetQu, RTQu, ChatQu, UsahaQu, NasabQu, SiagaQu) sebelum akun baru masuk.
                  </span>
                </label>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={
                    procBusy ||
                    !cooldownStatus.allowedNow ||
                    (releaseAuthMode === 'force_wipe' && !forceWipeConfirmed)
                  }
                  className="min-h-[36px] px-3.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold disabled:opacity-50"
                >
                  Hapus Data Lama &amp; Lepas Ikatan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProcedure('none')}
                  className="min-h-[36px] px-3 rounded-lg border border-slate-300 bg-white text-slate-600 font-semibold"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Hybrid Cloud Sync Strip */}
          <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-start gap-2 min-w-0">
              <Cloud
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  cloudEmail ? 'text-emerald-700' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">
                  {cloudEmail ? `Cloud Aktif: ${cloudEmail}` : 'Sinkronisasi Cloud Firebase'}
                </div>
                <div className="text-[10px] text-slate-500">
                  {cloudEmail
                    ? 'Metadata akun & status akses tersimpan ringan di Firestore.'
                    : 'Hubungkan Google agar status akun & akses lintas perangkat tersinkron.'}
                </div>
              </div>
            </div>
            {!cloudEmail && (
              <button
                type="button"
                onClick={handleConnectGoogleCloud}
                disabled={cloudConnecting}
                className="min-h-[34px] px-2.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-800 shrink-0 disabled:opacity-60"
              >
                {cloudConnecting ? '...' : 'Hubungkan'}
              </button>
            )}
          </div>
        </section>

        {/* Keamanan & Solusi HP Hilang / Rusak */}
        {account && (
          <section className="p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-slate-700" />
                <span className="font-extrabold text-slate-900">
                  Perlindungan HP Hilang / Rusak
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700">Zero Trust Aktif</span>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Kode Pemulihan (Simpan di Luar HP)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextCode = ZeroTrustService.regenerateRecoveryCode(account.email);
                    setRecoveryCfg(prev => ({ ...prev, code: nextCode }));
                    showNotification('Kode Pemulihan baru dibuat.');
                  }}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rotasi</span>
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-extrabold tracking-wider text-slate-900">
                  {recoveryCfg.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyRecoveryCode}
                  className="min-h-[34px] px-2.5 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Wali Terpercaya (Jika HP Rusak Total &amp; Lupa Kode)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guardianInput}
                  onChange={e => setGuardianInput(e.target.value)}
                  placeholder="Email / No HP Pasangan atau Pengurus RT"
                  className="flex-1 min-h-[40px] border border-slate-300 rounded-xl px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={handleSaveGuardian}
                  className="min-h-[40px] px-3 border border-slate-300 rounded-xl font-bold text-slate-800 hover:bg-slate-50 shrink-0"
                >
                  Simpan
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFreezeLostPhone}
              className="w-full min-h-[40px] border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Mode Darurat: Bekukan Perangkat Ini (HP Hilang)</span>
            </button>
          </section>
        )}

        {/* Buka di Laptop / PC via Barcode QR (WhatsApp Web Style) */}
        <LinkedDevicesSection
          showNotification={showNotification}
          initialPendingPairToken={pendingPairToken}
        />

        {/* Preferensi Tampilan Layar Laptop / PC */}
        <section className="p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-700" />
              <span className="font-extrabold text-slate-900">
                Tampilan Layar di Laptop / PC
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Responsif</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'auto', label: 'Otomatis' },
                { id: 'desktop', label: 'Layar Lebar' },
                { id: 'mobile', label: 'Bingkai HP' },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  ViewportLayoutService.setMode(opt.id);
                  setViewportMode(opt.id);
                  showNotification(`Mode tampilan diatur: ${opt.label}`);
                }}
                className={`min-h-[36px] rounded-lg font-bold text-[11px] transition ${
                  viewportMode === opt.id
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Otomatis melebar di monitor Laptop/PC agar Kanvas NasabQu, RtQu &amp; UsahaQu lebih
            lega, dan tetap ringkas saat dibuka di HP.
          </p>
        </section>

        {/* Integrasi & Sinkronisasi APK <-> PWA */}
        <section className="p-4 space-y-2.5 text-xs bg-emerald-50/30">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-700" />
              <span className="font-extrabold text-slate-900">
                Integrasi Data APK &amp; PWA
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {isNativeApk ? 'APK Android Native' : 'PWA / Web App'}
            </span>
          </div>

          <p className="text-[11px] text-slate-600 leading-snug">
            APK dan PWA memakai tampilan, identitas akun, QR Tautan, dan server sinkronisasi
            otomatis yang sama. Masuk dengan Email &amp; No. HP yang sama atau gunakan transfer
            1-Tap di bawah untuk memindahkan seluruh data pada HP yang sama.
          </p>

          {/* 1-Tap Pindah Data PWA <-> APK */}
          <div className="border border-emerald-200 bg-white rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-extrabold text-slate-900">
                {isNativeApk ? 'Tarik Data dari PWA ke APK' : 'Pindahkan Data PWA ke APK (1-Tap)'}
              </span>
              <span className="text-[10px] font-bold text-emerald-700">AES-256-GCM</span>
            </div>

            {!isNativeApk ? (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-600 leading-snug">
                  Jika Anda sudah menginstal WargaQu APK di HP ini, tekan tombol di bawah untuk
                  mengirim seluruh data PWA dan langsung membukanya di APK.
                </p>
                <button
                  type="button"
                  onClick={() => void handleCreatePwaHandoff()}
                  disabled={migrationBusy}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {migrationBusy ? 'Menyiapkan Data...' : 'Kirim & Buka di APK Sekarang'}
                  </span>
                </button>

                {handoffCreated && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-emerald-950">
                        Kode Cadangan ({handoffCreated.keyCount} data):
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyHandoffToken()}
                        className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Salin Token</span>
                      </button>
                    </div>
                    <div className="font-mono text-[10px] bg-white border border-emerald-200 rounded-lg px-2 py-1.5 break-all text-slate-800">
                      {handoffCreated.shareToken}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {account && (
                  <button
                    type="button"
                    onClick={() => void handlePullAccountSyncNow()}
                    disabled={migrationBusy}
                    className="w-full min-h-[40px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${migrationBusy ? 'animate-spin' : ''}`} />
                    <span>
                      {migrationBusy ? 'Menarik Data...' : 'Tarik / Sinkron Data Akun dari PWA'}
                    </span>
                  </button>
                )}

                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Atau tempel Token Transfer dari PWA (Mode Tamu):
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={handoffTokenInput}
                      onChange={e => setHandoffTokenInput(e.target.value)}
                      placeholder="Tempel WQH1:..."
                      className="flex-1 min-h-[38px] border border-slate-300 rounded-xl px-2.5 text-[11px] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => void handleConsumeHandoffToken()}
                      disabled={migrationBusy}
                      className="min-h-[38px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shrink-0 disabled:opacity-60"
                    >
                      {handoffTokenInput.trim() ? 'Pulihkan' : 'Tempel'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                dispatchSyncFallbackPrompt({
                  reason: 'manual_open',
                  email: account?.email || emailInput,
                  phone: account?.phone || phoneInput,
                })
              }
              className="w-full min-h-[36px] px-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 font-bold text-[11px] flex items-center justify-center gap-1.5"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-700" />
              <span>Asisten Restore 1-Klik (Google Drive / HP / Token)</span>
            </button>
          </div>

          <div className="border border-slate-200 bg-white rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Server Relay Aktif {relayHasCustom ? '(Kustom)' : '(Terpadu)'}
                </div>
                <div className="text-[11px] font-mono text-slate-800 truncate">
                  {relayOriginDraft}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleTestRelayConnection}
                  disabled={relayPingStatus === 'checking'}
                  className="min-h-[32px] px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition disabled:opacity-60"
                >
                  {relayPingStatus === 'checking' ? '...' : 'Uji Koneksi'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRelayOrigin(prev => !prev)}
                  className="min-h-[32px] px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold"
                >
                  {editingRelayOrigin ? 'Tutup' : 'Ubah'}
                </button>
              </div>
            </div>

            {relayPingInfo && (
              <div
                className={`text-[11px] font-semibold ${
                  relayPingStatus === 'ok' ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {relayPingInfo}
              </div>
            )}

            {editingRelayOrigin && (
              <form onSubmit={handleSaveRelayOrigin} className="space-y-2 pt-2 border-t border-slate-100">
                <input
                  type="url"
                  value={relayOriginDraft}
                  onChange={e => setRelayOriginDraft(e.target.value)}
                  placeholder="https://server-wargaqu-anda.run.app"
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-300 text-[11px] font-mono"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="min-h-[34px] px-3 rounded-lg bg-slate-900 text-white text-[11px] font-bold"
                  >
                    Simpan Server
                  </button>
                  {relayHasCustom && (
                    <button
                      type="button"
                      onClick={handleResetRelayOrigin}
                      className="min-h-[34px] px-3 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-semibold"
                    >
                      Reset Bawaan
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Pembaruan APK & Sistem Timpa (In-Place Update) */}
          <div className="border border-slate-200 bg-white rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-slate-900">
                  Pembaruan Aplikasi (Sistem Timpa APK)
                </div>
                <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                  Terpasang: v{apkUpdateStatus?.installedVersion || APP_VERSION} (Build{' '}
                  {apkUpdateStatus?.installedVersionCode || APP_VERSION_CODE})
                  {apkUpdateStatus?.latestVersion
                    ? ` · Rilis: v${apkUpdateStatus.latestVersion}`
                    : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCheckApkUpdateNow()}
                disabled={apkCheckBusy}
                className="min-h-[32px] px-2.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-[11px] font-bold flex items-center gap-1 shrink-0 disabled:opacity-60"
              >
                <RefreshCw className={`w-3 h-3 ${apkCheckBusy ? 'animate-spin' : ''}`} />
                <span>{apkCheckBusy ? 'Cek...' : 'Cek Update'}</span>
              </button>
            </div>

            {apkUpdateStatus?.hasUpdate && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
                Versi baru <strong>v{apkUpdateStatus.latestVersion}</strong> tersedia. Ketuk tombol
                di bawah untuk mengunduh dan menimpa langsung tanpa uninstall versi lama.
              </div>
            )}

            <form onSubmit={handleSaveApkRepo} className="flex gap-1.5">
              <input
                type="text"
                value={apkRepoDraft}
                onChange={e => setApkRepoDraft(e.target.value)}
                placeholder="Repo GitHub (cth: usahaqu/wargaqu)"
                className="flex-1 min-h-[36px] px-2.5 rounded-lg border border-slate-300 text-[11px] font-mono"
              />
              <button
                type="submit"
                className="min-h-[36px] px-3 rounded-lg bg-slate-800 text-white text-[11px] font-bold shrink-0"
              >
                Simpan Repo
              </button>
            </form>

            {apkInstallPermNeeded ? (
              <button
                type="button"
                onClick={() => void ApkUpdateService.openInstallPermissionSettings()}
                className="w-full min-h-[38px] px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Izinkan Pasang Aplikasi dari Sumber Ini</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={apkDownloadPct !== null}
                onClick={() => void handleDownloadAndInstallApk()}
                className="w-full min-h-[38px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {apkDownloadPct !== null
                    ? `Mengunduh APK (${apkDownloadPct}%)...`
                    : isNativeApk
                    ? 'Unduh & Timpa APK Langsung'
                    : 'Unduh APK Terbaru (.apk)'}
                </span>
              </button>
            )}
          </div>
        </section>
        </div>

        <div className="divide-y divide-slate-200 lg:border lg:border-slate-200 lg:rounded-2xl lg:overflow-hidden lg:bg-white lg:self-start">
        {/* Auto-Backup HP & Google Drive (Sistem Timpa) + Safe Reset */}
        <section className="p-4 space-y-3 bg-slate-50/40">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Auto-Backup, Restore &amp; Reset Aman
          </div>
          <AutoBackupResetPanel showNotification={showNotification} />
          <EncryptedBackupPanel
            scope="all"
            title="Ekspor / Pulihkan Manual File Terenkripsi (.wqbak)"
            description="Opsi manual: enkripsi seluruh data WargaQu dengan kata sandi untuk disimpan ke perangkat atau dipulihkan manual kapan saja."
            showNotification={showNotification}
          />
        </section>

        {/* Panel Admin Zero Trust — Hanya tampil pada akun Admin */}
        {isAdminAccount && (
          <section className="divide-y divide-slate-200">
            <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Konsol Developer &amp; Keamanan
            </div>
            <button
              onClick={onOpenAdminZeroTrust}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <ShieldAlert className="w-4 h-4 mt-0.5 text-slate-900 shrink-0" />
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Panel Admin Zero Trust
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Kontrol Keamanan Perangkat, Akses Akun, Smart Care &amp; Pemulihan HP
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          </section>
        )}

        {/* Status SiagaQu & Otoritas RTQu */}
        <section className="divide-y divide-slate-200">
          <div className="px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Status Integrasi Modul
          </div>

          <button
            onClick={onOpenRtQu}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldCheck
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  rtMember.siagaStatus === 'active' ? 'text-emerald-700' : 'text-amber-600'
                }`}
              />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  SiagaQu Umum (Radius 500m – 3km)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {rtMember.siagaStatus === 'active'
                    ? `Teraktivasi oleh RT (${rtMember.siagaVerifiedBy || 'Pengurus'})`
                    : 'Wajib aktivasi pengurus di RTQu agar sinyal warga umum tidak disalahgunakan'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            onClick={onOpenSiagaQu}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <CheckCircle2
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  account ? 'text-emerald-700' : 'text-slate-400'
                }`}
              />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  SiagaQu Pribadi &amp; Komunitas Terundang
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {account
                    ? 'Aktif (Cari HP Hilang, Keluarga & Perusahaan via Invite)'
                    : 'Masuk Email & No HP untuk mengaktifkan pelacakan & komunitas pribadi'}
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {[
            { name: 'AreaQu', desc: 'Identitas pedagang & konsumen otomatis dari Email & No HP' },
            { name: 'MuamalahQu & UsahaQu', desc: 'Profil pemilik & kontak toko tersinkron' },
            { name: 'NasabQu, ChatQu & Bantuan', desc: 'Identitas pengirim, silsilah & tiket tersambung' },
          ].map(mod => (
            <div key={mod.name} className="px-4 py-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-900">{mod.name}</div>
                <div className="text-[11px] text-slate-500">{mod.desc}</div>
              </div>
              <span
                className={`text-[11px] font-bold shrink-0 ${
                  account ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {account ? 'Sinkron' : 'Menunggu Login'}
              </span>
            </div>
          ))}
        </section>

        {/* TENTANG APLIKASI, PRIVASI & HAK CIPTA */}
        <section className="divide-y divide-slate-200 border-t border-slate-200">
          <div className="px-4 py-3 flex items-center justify-between gap-2 bg-slate-50/70">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Tentang Aplikasi, Privasi &amp; Hak Cipta
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Kebijakan privasi, disclaimer darurat SiagaQu &amp; status rilis WargaQu v{APP_VERSION}
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 shrink-0">
              v{APP_VERSION}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setLegalModal({ open: true, tab: 'privasi' })}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
              <div>
                <div className="text-xs font-bold text-slate-900">Kebijakan Privasi &amp; Data Warga</div>
                <div className="text-[11px] text-slate-500">
                  Transparansi GPS AreaQu, enkripsi backup &amp; sinkronisasi perangkat
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setLegalModal({ open: true, tab: 'ketentuan' })}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <FileText className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Syarat, Ketentuan &amp; Disclaimer SiagaQu
                </div>
                <div className="text-[11px] text-slate-500">
                  Bukan pengganti layanan darurat resmi 110 / 112 / 118 / 119 / 113
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setLegalModal({ open: true, tab: 'hakcipta' })}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <Copyright className="w-4 h-4 mt-0.5 shrink-0 text-slate-700" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Hak Cipta &amp; Orisinalitas Karya WargaQu
                </div>
                <div className="text-[11px] text-slate-500">
                  © 2026 WargaQu · Ekosistem Cerdas Warga, Keluarga &amp; UMKM
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {onOpenStorePreview && (
            <button
              type="button"
              onClick={onOpenStorePreview}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-emerald-50/50"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <ExternalLink className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
                <div>
                  <div className="text-xs font-bold text-emerald-800">
                    Halaman Pratinjau &amp; Unduh (ala Play Store)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Buka atau bagikan link etalase WargaQu (Pasang PWA &amp; Unduh APK)
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
            </button>
          )}
        </section>
        </div>
        </div>
      </main>

      <LegalNoticeModal
        isOpen={legalModal.open}
        onClose={() => setLegalModal((prev) => ({ ...prev, open: false }))}
        initialTab={legalModal.tab}
      />
    </div>
  );
};
