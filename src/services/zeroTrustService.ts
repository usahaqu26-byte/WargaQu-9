import { AuthService } from './authService';
import { RealtimeRelayService } from './realtimeRelayService';

export type DeviceTrustStatus = 'trusted' | 'frozen_lost' | 'retired_broken' | 'pending_recovery';

export interface DeviceTrustRecord {
  deviceId: string;
  maskedFingerprint: string;
  email: string;
  phone: string;
  label: string;
  status: DeviceTrustStatus;
  lastActiveAt: string;
  registeredAt: string;
  guardianContact?: string;
}

export interface RecoveryRequest {
  id: string;
  email: string;
  phone: string;
  reason: 'hp_hilang' | 'hp_rusak';
  guardianContact: string;
  newDeviceId: string;
  newDeviceMask: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
}

export interface ZeroTrustPolicy {
  adminEmail: string;
  adminPin: string;
  strictDeviceBinding: boolean;
  requireGuardianForBrokenPhone: boolean;
  autoLockMinutes: number;
  blockUnknownDeviceActions: boolean;
}

export interface ZeroTrustAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical';
  deviceMask: string;
}

const POLICY_KEY = 'wargaqu_zt_policy_v1';
const DEVICES_KEY = 'wargaqu_zt_devices_v1';
const RECOVERY_KEY_MAP = 'wargaqu_zt_recovery_codes_v1';
const RECOVERY_REQUESTS_KEY = 'wargaqu_zt_recovery_requests_v1';
const AUDIT_LOG_KEY = 'wargaqu_zt_audit_logs_v1';
const ADMIN_SESSION_KEY = 'wargaqu_zt_admin_session_v1';

export const ZERO_TRUST_SYNC_EVENT = 'wargaqu-zt-sync';

function emitZeroTrustSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ZERO_TRUST_SYNC_EVENT));
  }
}

export function maskDeviceFingerprint(deviceId: string): string {
  const clean = (deviceId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length <= 4) return `DEV-${clean || '0000'}`;
  return `DEV-••••${clean.slice(-4)}`;
}

const ADMIN_OWNER_EMAILS = ['usahaqu2026@gmail.com', 'usahaqu26@gmail.com'];

const DEFAULT_POLICY: ZeroTrustPolicy = {
  adminEmail: 'usahaqu2026@gmail.com',
  adminPin: '202600',
  strictDeviceBinding: true,
  requireGuardianForBrokenPhone: true,
  autoLockMinutes: 15,
  blockUnknownDeviceActions: true,
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `WQ-${pick(4)}-${pick(4)}`;
}

export const ZeroTrustService = {
  getPolicy(): ZeroTrustPolicy {
    const stored = loadJson<Partial<ZeroTrustPolicy>>(POLICY_KEY, {});
    return { ...DEFAULT_POLICY, ...stored };
  },

  updatePolicy(patch: Partial<ZeroTrustPolicy>, actor = 'Admin Zero Trust'): ZeroTrustPolicy {
    const next = { ...this.getPolicy(), ...patch };
    saveJson(POLICY_KEY, next);
    this.appendAudit(actor, 'Update Kebijakan Zero Trust', 'Konfigurasi keamanan diperbarui', 'info');
    emitZeroTrustSync();
    return next;
  },

  isAdminEmail(email?: string): boolean {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return false;
    const policyAdmin = this.getPolicy().adminEmail.trim().toLowerCase();
    return ADMIN_OWNER_EMAILS.includes(clean) || (Boolean(policyAdmin) && clean === policyAdmin);
  },

  isCurrentUserAdminAccount(): boolean {
    const acc = AuthService.getAccount();
    return this.isAdminEmail(acc?.email);
  },

  isAdminSessionActive(): boolean {
    try {
      if (!this.isCurrentUserAdminAccount()) return false;
      const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { verifiedAt: number; email: string };
      if (!this.isAdminEmail(parsed.email)) return false;
      const policy = this.getPolicy();
      const elapsedMin = (Date.now() - parsed.verifiedAt) / 60000;
      if (elapsedMin > policy.autoLockMinutes) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  verifyAdminAccess(emailInput: string, pinInput: string): { ok: boolean; message: string } {
    const policy = this.getPolicy();
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPin = pinInput.trim();
    const currentDeviceId = AuthService.getHiddenDeviceId();
    const devRecord = this.getDeviceById(currentDeviceId);

    if (devRecord?.status === 'frozen_lost') {
      this.appendAudit(
        cleanEmail || 'Unknown',
        'Akses Admin Ditolak',
        'Perangkat ini berstatus dibekukan (HP Hilang)',
        'critical'
      );
      return {
        ok: false,
        message: 'Perangkat ini dibekukan oleh kebijakan Zero Trust (status HP Hilang).',
      };
    }

    if (!this.isCurrentUserAdminAccount() || !cleanEmail || !this.isAdminEmail(cleanEmail)) {
      this.appendAudit(
        cleanEmail || 'Tamu',
        'Percobaan Akses Admin Ditolak',
        'Email tidak cocok dengan Super Admin Zero Trust',
        'warning'
      );
      return {
        ok: false,
        message: 'Akses ditolak: Email tidak terdaftar sebagai Admin.',
      };
    }

    if (cleanPin !== policy.adminPin) {
      this.appendAudit(cleanEmail, 'PIN Zero Trust Salah', 'Challenge verifikasi gagal', 'warning');
      return { ok: false, message: 'PIN Zero Trust salah. Periksa kembali.' };
    }

    try {
      sessionStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({ verifiedAt: Date.now(), email: cleanEmail })
      );
    } catch {
      // ignore
    }

    this.registerOrTouchCurrentDevice(cleanEmail, AuthService.getAccount()?.phone || 'Admin');
    this.appendAudit(cleanEmail, 'Sesi Admin Zero Trust Dibuka', 'Verifikasi email, PIN & device berhasil', 'info');
    emitZeroTrustSync();
    return { ok: true, message: 'Verifikasi Zero Trust berhasil.' };
  },

  lockAdminSession(): void {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    this.appendAudit('Admin Zero Trust', 'Sesi Dikunci Manual', 'Zero Trust session locked', 'info');
    emitZeroTrustSync();
  },

  getDevices(): DeviceTrustRecord[] {
    return loadJson<DeviceTrustRecord[]>(DEVICES_KEY, []);
  },

  getDeviceById(deviceId: string): DeviceTrustRecord | undefined {
    return this.getDevices().find(d => d.deviceId === deviceId);
  },

  isCurrentDeviceFrozen(): boolean {
    const rec = this.getDeviceById(AuthService.getHiddenDeviceId());
    return rec?.status === 'frozen_lost';
  },

  registerOrTouchCurrentDevice(
    email: string,
    phone: string,
    label = 'Perangkat Utama',
    options?: { allowOverwrite?: boolean }
  ): DeviceTrustRecord {
    const deviceId = AuthService.getHiddenDeviceId();
    const list = this.getDevices();
    const now = new Date().toISOString();
    const idx = list.findIndex(d => d.deviceId === deviceId);
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const policy = this.getPolicy();

    if (idx >= 0) {
      const existing = list[idx];
      const existingEmail = (existing.email || '').trim().toLowerCase();
      const isDifferentEmail = Boolean(existingEmail && cleanEmail && existingEmail !== cleanEmail);

      if (policy.strictDeviceBinding && isDifferentEmail && !options?.allowOverwrite) {
        const untouched: DeviceTrustRecord = {
          ...existing,
          lastActiveAt: now,
        };
        list[idx] = untouched;
        saveJson(DEVICES_KEY, list);
        this.appendAudit(
          cleanEmail || 'Unknown',
          'Pergantian Akun Tanpa Prosedur Ditolak',
          `${existing.maskedFingerprint} masih terikat ke ${AuthService.maskEmail(existingEmail)}`,
          'warning'
        );
        emitZeroTrustSync();
        return untouched;
      }

      const updated: DeviceTrustRecord = {
        ...existing,
        email: cleanEmail || existing.email,
        phone:
          options?.allowOverwrite || !existing.phone || existing.phone === '0800-0000-0000'
            ? cleanPhone || existing.phone
            : existing.phone,
        label: options?.allowOverwrite ? label : existing.label,
        lastActiveAt: now,
      };
      list[idx] = updated;
      saveJson(DEVICES_KEY, list);
      return updated;
    }

    const created: DeviceTrustRecord = {
      deviceId,
      maskedFingerprint: maskDeviceFingerprint(deviceId),
      email: cleanEmail,
      phone: cleanPhone,
      label,
      status: 'trusted',
      lastActiveAt: now,
      registeredAt: now,
    };
    const next = [created, ...list];
    saveJson(DEVICES_KEY, next);
    this.appendAudit(cleanEmail || 'Warga', 'Perangkat Terdaftar', `${created.maskedFingerprint} diikat ke akun`, 'info');
    emitZeroTrustSync();
    return created;
  },

  recordAuthorizedPhoneChange(email: string, oldPhone: string, newPhone: string, reason = ''): void {
    this.registerOrTouchCurrentDevice(email, newPhone, 'Perangkat Utama', { allowOverwrite: true });
    this.appendAudit(
      email,
      'Prosedur Ganti No. HP Disetujui',
      `${AuthService.maskPhone(oldPhone)} → ${AuthService.maskPhone(newPhone)}${reason ? ` (${reason})` : ''}`,
      'info'
    );
    emitZeroTrustSync();
  },

  recordAuthorizedBindingRelease(oldEmail: string, reason = 'Lepas Ikatan Perangkat'): void {
    const deviceId = AuthService.getHiddenDeviceId();
    const list = this.getDevices().map(d =>
      d.deviceId === deviceId
        ? { ...d, email: '', phone: '', label: 'Perangkat Dilepas (Siap Ikat Ulang)', lastActiveAt: new Date().toISOString() }
        : d
    );
    saveJson(DEVICES_KEY, list);
    this.appendAudit(
      oldEmail || 'Pemilik Perangkat',
      'Prosedur Lepas Ikatan Perangkat',
      `${maskDeviceFingerprint(deviceId)} dilepas (${reason})`,
      'warning'
    );
    emitZeroTrustSync();
  },

  setDeviceStatus(deviceId: string, status: DeviceTrustStatus, reason?: string): void {
    const list = this.getDevices();
    const target = list.find(d => d.deviceId === deviceId);
    const next = list.map(d =>
      d.deviceId === deviceId ? { ...d, status, lastActiveAt: new Date().toISOString() } : d
    );
    saveJson(DEVICES_KEY, next);

    if (status === 'frozen_lost' && deviceId === AuthService.getHiddenDeviceId()) {
      this.lockAdminSession();
    }

    this.appendAudit(
      target?.email || 'Admin',
      `Status Perangkat -> ${status}`,
      `${maskDeviceFingerprint(deviceId)}${reason ? ` · ${reason}` : ''}`,
      status === 'frozen_lost' ? 'critical' : 'warning'
    );
    RealtimeRelayService.publish('admin:policy', 'zt:device_freeze', {
      deviceId,
      status,
      reason: reason || '',
    });
    emitZeroTrustSync();
  },

  applyRemoteFreeze(deviceId: string, status: DeviceTrustStatus, reason?: string): void {
    const currentId = AuthService.getHiddenDeviceId();
    const list = this.getDevices();
    const exists = list.some(d => d.deviceId === deviceId);
    const next = exists
      ? list.map(d =>
          d.deviceId === deviceId ? { ...d, status, lastActiveAt: new Date().toISOString() } : d
        )
      : deviceId === currentId
      ? [
          {
            deviceId,
            maskedFingerprint: maskDeviceFingerprint(deviceId),
            email: AuthService.getAccount()?.email || 'warga@wargaqu.id',
            phone: AuthService.getAccount()?.phone || '-',
            label: 'Perangkat Ini',
            status,
            lastActiveAt: new Date().toISOString(),
            registeredAt: new Date().toISOString(),
          },
          ...list,
        ]
      : list;
    saveJson(DEVICES_KEY, next);
    if (status === 'frozen_lost' && deviceId === currentId) {
      this.lockAdminSession();
      this.appendAudit('Zero Trust Relay', 'Perangkat Dibekukan Jarak Jauh', reason || 'HP Hilang', 'critical');
    }
    emitZeroTrustSync();
  },

  freezeAccountDevicesAsLost(email: string, note = 'Laporan HP Hilang oleh pemilik'): number {
    const cleanEmail = email.trim().toLowerCase();
    const list = this.getDevices();
    let count = 0;
    const next = list.map(d => {
      if (d.email.toLowerCase() === cleanEmail && d.status === 'trusted') {
        count += 1;
        return { ...d, status: 'frozen_lost' as DeviceTrustStatus, lastActiveAt: new Date().toISOString() };
      }
      return d;
    });
    if (count === 0) {
      const currentId = AuthService.getHiddenDeviceId();
      const acc = AuthService.getAccount();
      next.unshift({
        deviceId: currentId,
        maskedFingerprint: maskDeviceFingerprint(currentId),
        email: cleanEmail || acc?.email || 'warga@wargaqu.id',
        phone: acc?.phone || '-',
        label: 'Perangkat Terkunci',
        status: 'frozen_lost',
        lastActiveAt: new Date().toISOString(),
        registeredAt: new Date().toISOString(),
      });
      count = 1;
    }
    saveJson(DEVICES_KEY, next);
    for (const dev of next) {
      if (dev.email.toLowerCase() === cleanEmail && dev.status === 'frozen_lost') {
        RealtimeRelayService.publish('admin:policy', 'zt:device_freeze', {
          deviceId: dev.deviceId,
          status: 'frozen_lost',
          reason: note,
        });
      }
    }
    this.appendAudit(cleanEmail || 'Pemilik Akun', 'Remote Lock HP Hilang', `${count} perangkat dibekukan (${note})`, 'critical');
    emitZeroTrustSync();
    return count;
  },

  // Kode Pemulihan & Wali Terpercaya (untuk HP Rusak / Hilang)
  getRecoveryConfig(email: string): { code: string; guardianContact: string } {
    const cleanEmail = email.trim().toLowerCase();
    const map = loadJson<Record<string, { code: string; guardianContact: string }>>(RECOVERY_KEY_MAP, {});
    if (!map[cleanEmail]) {
      map[cleanEmail] = {
        code: generateRecoveryCode(),
        guardianContact: '',
      };
      saveJson(RECOVERY_KEY_MAP, map);
    }
    return map[cleanEmail];
  },

  regenerateRecoveryCode(email: string): string {
    const cleanEmail = email.trim().toLowerCase();
    const map = loadJson<Record<string, { code: string; guardianContact: string }>>(RECOVERY_KEY_MAP, {});
    const existing = map[cleanEmail] || { code: '', guardianContact: '' };
    const nextCode = generateRecoveryCode();
    map[cleanEmail] = { ...existing, code: nextCode };
    saveJson(RECOVERY_KEY_MAP, map);
    this.appendAudit(cleanEmail, 'Rotasi Kode Pemulihan', 'Kode cadangan baru dibuat', 'info');
    emitZeroTrustSync();
    return nextCode;
  },

  setGuardianContact(email: string, guardianContact: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const cfg = this.getRecoveryConfig(cleanEmail);
    const map = loadJson<Record<string, { code: string; guardianContact: string }>>(RECOVERY_KEY_MAP, {});
    map[cleanEmail] = { ...cfg, guardianContact: guardianContact.trim() };
    saveJson(RECOVERY_KEY_MAP, map);
    this.appendAudit(cleanEmail, 'Update Wali Pemulihan', `Wali: ${guardianContact.trim() || '-'}`, 'info');
    emitZeroTrustSync();
  },

  verifyRecoveryCode(emailInput: string, recoveryCodeInput: string): boolean {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanCode = recoveryCodeInput.trim().toUpperCase();
    if (!cleanEmail || !cleanCode) return false;
    const map = loadJson<Record<string, { code: string; guardianContact: string }>>(RECOVERY_KEY_MAP, {});
    const stored = map[cleanEmail];
    return Boolean(stored && stored.code.toUpperCase() === cleanCode);
  },

  recoverWithCode(
    emailInput: string,
    phoneInput: string,
    recoveryCodeInput: string,
    reason: 'hp_hilang' | 'hp_rusak'
  ): { ok: boolean; message: string } {
    const cleanEmail = emailInput.trim().toLowerCase();
    const cleanPhone = phoneInput.trim();
    const cleanCode = recoveryCodeInput.trim().toUpperCase();

    const map = loadJson<Record<string, { code: string; guardianContact: string }>>(RECOVERY_KEY_MAP, {});
    const stored = map[cleanEmail];
    if (!stored || stored.code.toUpperCase() !== cleanCode) {
      this.appendAudit(cleanEmail || 'Unknown', 'Pemulihan Kode Gagal', 'Kode pemulihan tidak cocok', 'warning');
      return {
        ok: false,
        message: 'Kode pemulihan tidak valid. Ajukan verifikasi Admin Zero Trust & Wali jika HP rusak tanpa kode.',
      };
    }

    // Retire or freeze previous devices for this email, then bind current device
    const oldStatus: DeviceTrustStatus = reason === 'hp_hilang' ? 'frozen_lost' : 'retired_broken';
    const currentId = AuthService.getHiddenDeviceId();
    const devices = this.getDevices().map(d =>
      d.email.toLowerCase() === cleanEmail && d.deviceId !== currentId
        ? { ...d, status: oldStatus, lastActiveAt: new Date().toISOString() }
        : d
    );
    saveJson(DEVICES_KEY, devices);

    AuthService.releaseDeviceBinding({ bypassQuota: true });
    AuthService.login(cleanEmail, cleanPhone);
    this.registerOrTouchCurrentDevice(cleanEmail, cleanPhone, 'Perangkat Baru (Hasil Pemulihan)', {
      allowOverwrite: true,
    });
    // Rotate recovery code after use (Zero Trust one-time recovery)
    this.regenerateRecoveryCode(cleanEmail);

    this.appendAudit(
      cleanEmail,
      'Pemulihan Akun Berhasil',
      `Perangkat lama ditandai ${oldStatus}, perangkat baru diaktifkan`,
      'info'
    );
    emitZeroTrustSync();
    return {
      ok: true,
      message: 'Akun dipulihkan ke perangkat ini! Perangkat lama dinonaktifkan & kode pemulihan dirotasi.',
    };
  },

  getRecoveryRequests(): RecoveryRequest[] {
    return loadJson<RecoveryRequest[]>(RECOVERY_REQUESTS_KEY, []);
  },

  submitRecoveryRequest(payload: {
    email: string;
    phone: string;
    reason: 'hp_hilang' | 'hp_rusak';
    guardianContact: string;
    note: string;
  }): RecoveryRequest {
    const newDeviceId = AuthService.getHiddenDeviceId();
    const req: RecoveryRequest = {
      id: `REC-${Date.now().toString(36).toUpperCase()}`,
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone.trim(),
      reason: payload.reason,
      guardianContact: payload.guardianContact.trim(),
      newDeviceId,
      newDeviceMask: maskDeviceFingerprint(newDeviceId),
      note: payload.note.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const list = [req, ...this.getRecoveryRequests()];
    saveJson(RECOVERY_REQUESTS_KEY, list);
    this.appendAudit(
      req.email,
      'Pengajuan Pemulihan Tanpa Kode',
      `${req.reason === 'hp_hilang' ? 'HP Hilang' : 'HP Rusak'} · Wali: ${req.guardianContact || '-'}`,
      'warning'
    );
    emitZeroTrustSync();
    return req;
  },

  resolveRecoveryRequest(requestId: string, approve: boolean): void {
    const list = this.getRecoveryRequests();
    const target = list.find(r => r.id === requestId);
    if (!target) return;

    const now = new Date().toISOString();
    const next = list.map(r =>
      r.id === requestId ? { ...r, status: approve ? ('approved' as const) : ('rejected' as const), resolvedAt: now } : r
    );
    saveJson(RECOVERY_REQUESTS_KEY, next);

    if (approve) {
      const oldStatus: DeviceTrustStatus = target.reason === 'hp_hilang' ? 'frozen_lost' : 'retired_broken';
      const devices = this.getDevices().map(d =>
        d.email.toLowerCase() === target.email && d.deviceId !== target.newDeviceId
          ? { ...d, status: oldStatus, lastActiveAt: now }
          : d
      );
      const hasNew = devices.some(d => d.deviceId === target.newDeviceId);
      if (!hasNew) {
        devices.unshift({
          deviceId: target.newDeviceId,
          maskedFingerprint: target.newDeviceMask,
          email: target.email,
          phone: target.phone,
          label: 'Perangkat Baru (Disetujui Admin)',
          status: 'trusted',
          lastActiveAt: now,
          registeredAt: now,
          guardianContact: target.guardianContact,
        });
      }
      saveJson(DEVICES_KEY, devices);

      if (target.newDeviceId === AuthService.getHiddenDeviceId()) {
        AuthService.releaseDeviceBinding({ bypassQuota: true });
        AuthService.login(target.email, target.phone);
      }
    }

    this.appendAudit(
      'Admin Zero Trust',
      approve ? 'Pemulihan Perangkat Disetujui' : 'Pemulihan Perangkat Ditolak',
      `${target.email} (${target.newDeviceMask})`,
      approve ? 'info' : 'warning'
    );
    emitZeroTrustSync();
  },

  getAuditLogs(): ZeroTrustAuditEntry[] {
    return loadJson<ZeroTrustAuditEntry[]>(AUDIT_LOG_KEY, []);
  },

  appendAudit(
    actor: string,
    action: string,
    detail: string,
    severity: 'info' | 'warning' | 'critical' = 'info'
  ): void {
    const entry: ZeroTrustAuditEntry = {
      id: `zt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actor,
      action,
      detail,
      severity,
      deviceMask: maskDeviceFingerprint(AuthService.getHiddenDeviceId()),
    };
    const prev = this.getAuditLogs();
    saveJson(AUDIT_LOG_KEY, [entry, ...prev].slice(0, 120));
  },
};
