import { AuthService } from './authService';
import { RtSiagaStorage } from './rtSiagaStorage';
import { SiagaCircleService } from './siagaCircleService';
import { StorageService } from './storage';
import { ZeroTrustService, maskDeviceFingerprint } from './zeroTrustService';
import { SmartCareService } from './smartCareService';
import { RealtimeRelayService } from './realtimeRelayService';
import type { MonetizableModuleId } from './monetizationService';

export type AccountModerationStatus = 'normal' | 'free' | 'warning' | 'banned';

export type GovernanceModuleId =
  | 'leluhurqu'
  | 'rtqu'
  | 'paguyubanqu'
  | 'areaqu'
  | 'muamalahqu'
  | 'usahaqu'
  | 'siagaqu'
  | 'chatqu';

export interface GovernanceModuleMeta {
  id: GovernanceModuleId;
  label: string;
  desc: string;
}

export const GOVERNANCE_MODULES: GovernanceModuleMeta[] = [
  { id: 'leluhurqu', label: 'LeluhurQu (Trah)', desc: 'Silsilah keluarga & pohon trah' },
  { id: 'rtqu', label: 'RTQu', desc: 'Pengurusan warga RT / RW' },
  { id: 'paguyubanqu', label: 'Paguyuban / Org / Sosial', desc: 'Komunitas, ormas & yayasan sosial' },
  { id: 'areaqu', label: 'AreaQu', desc: 'Peta kawasan, lapak & radar' },
  { id: 'muamalahqu', label: 'MuamalahQu', desc: 'Marketplace & belanja warga' },
  { id: 'usahaqu', label: 'UsahaQu / POS Modular', desc: 'Kasir resto & UMKM Voice AI' },
  { id: 'siagaqu', label: 'SiagaQu', desc: 'Panic button & lingkar darurat' },
  { id: 'chatqu', label: 'ChatQu', desc: 'Komunikasi & pengumuman warga' },
];

export const MONETIZABLE_MODULE_OPTIONS: Array<{ id: MonetizableModuleId; label: string }> = [
  { id: 'areaqu_lapak', label: 'AreaQu Lapak' },
  { id: 'leluhurqu_export', label: 'LeluhurQu Print/PDF' },
  { id: 'rtqu_iuran', label: 'RTQu Iuran' },
  { id: 'muamalahqu_tx', label: 'MuamalahQu Checkout' },
  { id: 'usahaqu_pro', label: 'UsahaQu POS Pro' },
  { id: 'siagaqu_pro', label: 'SiagaQu Perusahaan' },
];

export interface AccountPolicyRule {
  key: string; // normalized lowercase email or phone:...
  email: string;
  phone?: string;
  status: AccountModerationStatus;
  freeModules: 'all' | MonetizableModuleId[];
  note?: string;
  updatedAt: string;
}

export interface CommunityFreeRule {
  id: string;
  kind: 'trah' | 'rt_paguyuban';
  targetId?: string;
  name: string;
  enabled: boolean;
  freeModules: 'all' | MonetizableModuleId[];
  updatedAt: string;
}

export interface AccountGovernanceBundle {
  accountRules: Record<string, AccountPolicyRule>;
  communityFreeRules: CommunityFreeRule[];
  updatedAt: string;
}

export interface AccountPresenceRecord {
  accountKey: string;
  email: string;
  displayName: string;
  phone: string;
  deviceMask: string;
  activeModules: GovernanceModuleId[];
  trahList: Array<{ id: string; name: string }>;
  communityList: Array<{ id: string; name: string; orgType: string }>;
  activeScreen: string;
  lastSeenAt: string;
  source: 'online_relay' | 'local_registry';
}

export interface KnownAccountSummary {
  accountKey: string;
  email: string;
  displayName: string;
  phone: string;
  deviceMask: string;
  activeModules: GovernanceModuleId[];
  trahList: Array<{ id: string; name: string }>;
  communityList: Array<{ id: string; name: string; orgType: string }>;
  lastSeenAt: string;
  isOnlineNow: boolean;
  explicitRule?: AccountPolicyRule;
  matchedCommunityFree?: CommunityFreeRule;
  effectiveStatus: AccountModerationStatus;
}

const GOV_BUNDLE_KEY = 'wargaqu_account_governance_v1';
const PRESENCE_CACHE_KEY = 'wargaqu_presence_cache_v1';
const OWNER_EMAILS = ['usahaqu2026@gmail.com', 'usahaqu26@gmail.com'];

export const ACCOUNT_GOV_SYNC_EVENT = 'wargaqu-account-gov-sync';

function emitGovernanceSync(alsoSyncMonetization = false) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACCOUNT_GOV_SYNC_EVENT));
    if (alsoSyncMonetization) {
      window.dispatchEvent(new CustomEvent('wargaqu-monetize-sync'));
    }
  }
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore storage quota errors
  }
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function normalizeName(name: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(phone: string): string {
  return (phone || '').replace(/\D/g, '');
}

function isProtectedAdminEmail(email?: string): boolean {
  const clean = normalizeEmail(email || '');
  if (!clean) return false;
  const policyAdmin = normalizeEmail(ZeroTrustService.getPolicy().adminEmail);
  return OWNER_EMAILS.includes(clean) || (Boolean(policyAdmin) && clean === policyAdmin);
}

function getDefaultBundle(): AccountGovernanceBundle {
  return {
    accountRules: {},
    communityFreeRules: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function loadLocalTrahListForScope(email?: string): Array<{ id: string; name: string }> {
  const cleanEmail = normalizeEmail(email || '');
  const scopeKey = cleanEmail ? cleanEmail.replace(/[^a-z0-9@._-]/g, '_') : 'guest';
  const keysToCheck = [`wargaqu_leluhur_trah_v5_${scopeKey}`];
  if (OWNER_EMAILS.includes(cleanEmail)) {
    keysToCheck.push('wargaqu_leluhur_trah_v4');
  }
  const seen = new Map<string, string>();
  for (const k of keysToCheck) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Array<{ id?: string; name?: string }>;
      if (Array.isArray(parsed)) {
        for (const t of parsed) {
          if (t?.id && t.id !== '__empty__' && t?.name) {
            seen.set(String(t.id), String(t.name));
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

function detectActiveModulesForCurrentDevice(
  trahList: Array<{ id: string; name: string }>,
  communities: ReturnType<typeof RtSiagaStorage.getCommunities>,
  activeScreen?: string
): GovernanceModuleId[] {
  const mods = new Set<GovernanceModuleId>();
  if (trahList.length > 0 || activeScreen === 'leluhurqu') {
    mods.add('leluhurqu');
  }
  if (communities.some(c => c.profile?.orgType === 'RT') || activeScreen === 'rtqu') {
    mods.add('rtqu');
  }
  if (communities.some(c => c.profile?.orgType && c.profile.orgType !== 'RT')) {
    mods.add('paguyubanqu');
  }
  try {
    const history = StorageService.getHistory();
    const activeOrders = StorageService.getActiveOrders();
    const customMenu = StorageService.getMenu();
    if (
      history.length > 0 ||
      Object.keys(activeOrders).length > 0 ||
      customMenu.length > 0 ||
      activeScreen === 'usahaqu' ||
      activeScreen === 'modularqu'
    ) {
      mods.add('usahaqu');
    }
  } catch {
    // ignore
  }
  try {
    if (
      localStorage.getItem('wargaqu_areaqu_lapaks_v1') ||
      localStorage.getItem('wargaqu_areaqu_orders_v1') ||
      activeScreen === 'areaqu'
    ) {
      mods.add('areaqu');
    }
    if (
      localStorage.getItem('wargaqu_muamalah_orders_v1') ||
      localStorage.getItem('wargaqu_muamalah_products_v1') ||
      activeScreen === 'muamalahqu'
    ) {
      mods.add('muamalahqu');
    }
    if (
      SiagaCircleService.getCircles().length > 0 ||
      RtSiagaStorage.getAuditLogs().length > 0 ||
      activeScreen === 'siagaqu'
    ) {
      mods.add('siagaqu');
    }
    if (
      localStorage.getItem('wargaqu_chatqu_messages_v1') ||
      localStorage.getItem('wargaqu_chatqu_groups_v1') ||
      activeScreen === 'chatqu'
    ) {
      mods.add('chatqu');
    }
  } catch {
    // ignore
  }
  return Array.from(mods);
}

type GovernanceCloudHooks = {
  onSaveGovernanceConfig?: (rules: CommunityFreeRule[]) => Promise<void> | void;
  onSaveAccountPolicy?: (params: {
    email: string;
    phone?: string;
    status: AccountModerationStatus;
    freeModules?: 'all' | MonetizableModuleId[];
    note?: string;
  }) => Promise<void> | void;
  onSyncPresence?: (activeScreen?: string) => Promise<void> | void;
};

let cloudHooks: GovernanceCloudHooks = {};

export const AccountGovernanceService = {
  registerCloudHooks(hooks: GovernanceCloudHooks): void {
    cloudHooks = { ...cloudHooks, ...hooks };
  },

  getBundle(): AccountGovernanceBundle {
    const raw = loadJson<Partial<AccountGovernanceBundle>>(GOV_BUNDLE_KEY, {});
    return {
      accountRules: raw.accountRules && typeof raw.accountRules === 'object' ? raw.accountRules : {},
      communityFreeRules: Array.isArray(raw.communityFreeRules) ? raw.communityFreeRules : [],
      updatedAt: raw.updatedAt || new Date(0).toISOString(),
    };
  },

  saveBundle(bundle: AccountGovernanceBundle, broadcast = true): AccountGovernanceBundle {
    const next: AccountGovernanceBundle = {
      ...bundle,
      updatedAt: new Date().toISOString(),
    };
    saveJson(GOV_BUNDLE_KEY, next);
    emitGovernanceSync(true);
    if (broadcast) {
      RealtimeRelayService.publish('admin:policy', 'admin:account_policies', next);
      if (typeof fetch !== 'undefined') {
        void fetch('/api/relay-policy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountPolicies: next }),
        }).catch(() => {});
      }
      if (cloudHooks.onSaveGovernanceConfig) {
        void Promise.resolve(cloudHooks.onSaveGovernanceConfig(next.communityFreeRules)).catch(
          () => {}
        );
      }
    }
    return next;
  },

  applyCloudSelfPolicies(email: string, policies: Record<string, AccountPolicyRule>): void {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return;
    const current = this.getBundle();
    const nextRules = { ...current.accountRules };
    if (policies[cleanEmail]) {
      nextRules[cleanEmail] = policies[cleanEmail];
    } else {
      delete nextRules[cleanEmail];
    }
    saveJson(GOV_BUNDLE_KEY, {
      ...current,
      accountRules: nextRules,
      updatedAt: new Date().toISOString(),
    });
    emitGovernanceSync(true);
  },

  applyCloudAdminPolicies(policies: Record<string, AccountPolicyRule>): void {
    const current = this.getBundle();
    saveJson(GOV_BUNDLE_KEY, {
      ...current,
      accountRules: { ...policies },
      updatedAt: new Date().toISOString(),
    });
    emitGovernanceSync(true);
  },

  applyCloudCommunityRules(communityFreeRules: CommunityFreeRule[], updatedAt?: string): void {
    if (!Array.isArray(communityFreeRules)) return;
    const current = this.getBundle();
    saveJson(GOV_BUNDLE_KEY, {
      ...current,
      communityFreeRules,
      updatedAt: updatedAt || new Date().toISOString(),
    });
    emitGovernanceSync(true);
  },

  ingestCloudRegistryBatch(records: AccountPresenceRecord[]): void {
    if (!Array.isArray(records) || records.length === 0) return;
    const current = this.getCachedPresences();
    const byKey = new Map<string, AccountPresenceRecord>();
    for (const item of current) {
      byKey.set(item.accountKey, item);
    }
    for (const r of records) {
      const prev = byKey.get(r.accountKey);
      const prevTs = prev ? new Date(prev.lastSeenAt).getTime() : 0;
      const incTs = new Date(r.lastSeenAt).getTime();
      const mergedMods = Array.from(
        new Set<GovernanceModuleId>([...(prev?.activeModules || []), ...(r.activeModules || [])])
      );
      byKey.set(r.accountKey, {
        ...(prev || r),
        ...r,
        phone: r.phone && r.phone !== '-' ? r.phone : prev?.phone || '-',
        activeModules: mergedMods,
        trahList: r.trahList.length > 0 ? r.trahList : prev?.trahList || [],
        communityList: r.communityList.length > 0 ? r.communityList : prev?.communityList || [],
        lastSeenAt: prevTs > incTs ? prev!.lastSeenAt : r.lastSeenAt,
        source: prev?.source === 'online_relay' ? 'online_relay' : 'local_registry',
      });
    }
    saveJson(PRESENCE_CACHE_KEY, Array.from(byKey.values()).slice(0, 500));
    emitGovernanceSync(false);
  },

  async syncPolicyFromServer(): Promise<void> {
    try {
      const resp = await fetch('/api/relay-policy');
      if (!resp.ok) return;
      const data = (await resp.json()) as { accountPolicies?: unknown };
      if (data?.accountPolicies) {
        this.applyRemotePolicies(data.accountPolicies);
      }
    } catch {
      // ignore offline
    }
  },

  applyRemotePolicies(remote: unknown): void {
    if (!remote || typeof remote !== 'object') return;
    const r = remote as Partial<AccountGovernanceBundle>;
    const current = this.getBundle();
    // Accept remote if newer or non-empty
    const remoteTs = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
    const localTs = current.updatedAt ? new Date(current.updatedAt).getTime() : 0;
    if (remoteTs < localTs && current.updatedAt !== new Date(0).toISOString()) {
      return;
    }
    const merged: AccountGovernanceBundle = {
      accountRules: r.accountRules && typeof r.accountRules === 'object' ? r.accountRules : {},
      communityFreeRules: Array.isArray(r.communityFreeRules) ? r.communityFreeRules : [],
      updatedAt: r.updatedAt || new Date().toISOString(),
    };
    saveJson(GOV_BUNDLE_KEY, merged);
    emitGovernanceSync(true);
  },

  setAccountPolicy(params: {
    email: string;
    phone?: string;
    status: AccountModerationStatus;
    freeModules?: 'all' | MonetizableModuleId[];
    note?: string;
  }): AccountGovernanceBundle {
    const cleanEmail = normalizeEmail(params.email);
    const cleanPhone = (params.phone || '').trim();
    const key = cleanEmail || `phone:${normalizePhone(cleanPhone)}`;
    if (!key || key === 'phone:') return this.getBundle();

    const bundle = this.getBundle();
    const nextRules = { ...bundle.accountRules };

    if (params.status === 'normal' && !params.note?.trim()) {
      delete nextRules[key];
    } else {
      nextRules[key] = {
        key,
        email: cleanEmail || key,
        phone: cleanPhone || nextRules[key]?.phone,
        status: params.status,
        freeModules: params.freeModules || nextRules[key]?.freeModules || 'all',
        note: params.note?.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
    }

    ZeroTrustService.appendAudit(
      'Admin Zero Trust',
      `Status Akun: ${params.status.toUpperCase()}`,
      `${cleanEmail || cleanPhone}${params.note ? ` · ${params.note}` : ''}`,
      params.status === 'banned' ? 'critical' : params.status === 'warning' ? 'warning' : 'info'
    );

    if (cleanEmail && cleanEmail.includes('@') && cloudHooks.onSaveAccountPolicy) {
      void Promise.resolve(cloudHooks.onSaveAccountPolicy(params)).catch(() => {});
    }

    return this.saveBundle({ ...bundle, accountRules: nextRules }, true);
  },

  upsertCommunityFreeRule(params: {
    id?: string;
    kind: 'trah' | 'rt_paguyuban';
    targetId?: string;
    name: string;
    enabled: boolean;
    freeModules?: 'all' | MonetizableModuleId[];
  }): AccountGovernanceBundle {
    const cleanName = params.name.trim();
    if (!cleanName) return this.getBundle();

    const bundle = this.getBundle();
    const existingIdx = bundle.communityFreeRules.findIndex(
      r =>
        (params.id && r.id === params.id) ||
        (params.targetId && r.targetId && r.targetId === params.targetId) ||
        (r.kind === params.kind && normalizeName(r.name) === normalizeName(cleanName))
    );

    const record: CommunityFreeRule = {
      id:
        params.id ||
        (existingIdx >= 0
          ? bundle.communityFreeRules[existingIdx].id
          : `cf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`),
      kind: params.kind,
      targetId:
        params.targetId ||
        (existingIdx >= 0 ? bundle.communityFreeRules[existingIdx].targetId : undefined),
      name: cleanName,
      enabled: params.enabled,
      freeModules:
        params.freeModules ||
        (existingIdx >= 0 ? bundle.communityFreeRules[existingIdx].freeModules : 'all'),
      updatedAt: new Date().toISOString(),
    };

    const nextList = [...bundle.communityFreeRules];
    if (existingIdx >= 0) {
      nextList[existingIdx] = record;
    } else {
      nextList.unshift(record);
    }

    ZeroTrustService.appendAudit(
      'Admin Zero Trust',
      `Free Modular ${params.kind === 'trah' ? 'Trah' : 'RT/Paguyuban'}`,
      `${cleanName} -> ${params.enabled ? 'ON (Gratis)' : 'OFF'}`,
      'info'
    );

    return this.saveBundle({ ...bundle, communityFreeRules: nextList }, true);
  },

  toggleCommunityFreeRule(id: string): AccountGovernanceBundle {
    const bundle = this.getBundle();
    const target = bundle.communityFreeRules.find(r => r.id === id);
    if (!target) return bundle;
    const nextList = bundle.communityFreeRules.map(r =>
      r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r
    );
    ZeroTrustService.appendAudit(
      'Admin Zero Trust',
      `Toggle Free Modular ${target.name}`,
      `${!target.enabled ? 'ON' : 'OFF'}`,
      'info'
    );
    return this.saveBundle({ ...bundle, communityFreeRules: nextList }, true);
  },

  updateCommunityFreeModules(
    id: string,
    freeModules: 'all' | MonetizableModuleId[]
  ): AccountGovernanceBundle {
    const bundle = this.getBundle();
    const nextList = bundle.communityFreeRules.map(r =>
      r.id === id ? { ...r, freeModules, updatedAt: new Date().toISOString() } : r
    );
    return this.saveBundle({ ...bundle, communityFreeRules: nextList }, true);
  },

  deleteCommunityFreeRule(id: string): AccountGovernanceBundle {
    const bundle = this.getBundle();
    const nextList = bundle.communityFreeRules.filter(r => r.id !== id);
    return this.saveBundle({ ...bundle, communityFreeRules: nextList }, true);
  },

  getAdminOwnWorkspaces(): {
    trahs: Array<{ id: string; name: string; memberCount: number }>;
    communities: Array<{ id: string; name: string; orgType: string; memberCount: number }>;
  } {
    const acc = AuthService.getAccount();
    const email = normalizeEmail(acc?.email || ZeroTrustService.getPolicy().adminEmail);
    const scopeKey = email ? email.replace(/[^a-z0-9@._-]/g, '_') : 'guest';
    const keys = [`wargaqu_leluhur_trah_v5_${scopeKey}`];
    if (OWNER_EMAILS.includes(email)) keys.push('wargaqu_leluhur_trah_v4');

    const trahMap = new Map<string, { id: string; name: string; memberCount: number }>();
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Array<{ id?: string; name?: string; members?: unknown[] }>;
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (t?.id && t.id !== '__empty__' && t?.name && !trahMap.has(t.id)) {
              trahMap.set(t.id, {
                id: t.id,
                name: t.name,
                memberCount: Array.isArray(t.members) ? t.members.length : 0,
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const communities = RtSiagaStorage.getCommunities().map(w => ({
      id: w.id,
      name: w.profile.orgName,
      orgType: w.profile.orgType,
      memberCount: w.members.length,
    }));

    return {
      trahs: Array.from(trahMap.values()),
      communities,
    };
  },

  collectCurrentUserPresence(activeScreen = 'warga'): AccountPresenceRecord {
    const acc = AuthService.getAccount();
    const deviceId = AuthService.getHiddenDeviceId();
    const trahList = loadLocalTrahListForScope(acc?.email);
    const communities = RtSiagaStorage.getCommunities();
    const communityList = communities.map(w => ({
      id: w.id,
      name: w.profile.orgName,
      orgType: w.profile.orgType,
    }));
    const activeModules = detectActiveModulesForCurrentDevice(trahList, communities, activeScreen);
    const email = normalizeEmail(acc?.email || '');
    const phone = (acc?.phone || '').trim();
    const accountKey = email || (phone ? `phone:${normalizePhone(phone)}` : `dev:${deviceId.slice(-8)}`);
    const displayName =
      email ? email.split('@')[0] : phone ? `Warga ${phone.slice(-4)}` : `Tamu ${deviceId.slice(-4)}`;

    return {
      accountKey,
      email: email || 'tamu@perangkat-lokal',
      displayName,
      phone: phone || '-',
      deviceMask: maskDeviceFingerprint(deviceId),
      activeModules,
      trahList,
      communityList,
      activeScreen,
      lastSeenAt: new Date().toISOString(),
      source: 'local_registry',
    };
  },

  getCachedPresences(): AccountPresenceRecord[] {
    return loadJson<AccountPresenceRecord[]>(PRESENCE_CACHE_KEY, []);
  },

  ingestRemotePresence(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const p = raw as Partial<AccountPresenceRecord>;
    if (!p.accountKey) return;
    const current = this.getCachedPresences();
    const record: AccountPresenceRecord = {
      accountKey: String(p.accountKey),
      email: String(p.email || 'tamu@perangkat-lokal'),
      displayName: String(p.displayName || 'Warga'),
      phone: String(p.phone || '-'),
      deviceMask: String(p.deviceMask || 'DEV-••••'),
      activeModules: Array.isArray(p.activeModules) ? (p.activeModules as GovernanceModuleId[]) : [],
      trahList: Array.isArray(p.trahList) ? p.trahList : [],
      communityList: Array.isArray(p.communityList) ? p.communityList : [],
      activeScreen: String(p.activeScreen || 'warga'),
      lastSeenAt: String(p.lastSeenAt || new Date().toISOString()),
      source: 'online_relay',
    };
    const idx = current.findIndex(item => item.accountKey === record.accountKey);
    const next = [...current];
    if (idx >= 0) {
      next[idx] = record;
    } else {
      next.unshift(record);
    }
    saveJson(PRESENCE_CACHE_KEY, next.slice(0, 300));
    emitGovernanceSync(false);
  },

  publishCurrentPresence(activeScreen = 'warga'): AccountPresenceRecord {
    const presence = this.collectCurrentUserPresence(activeScreen);
    this.ingestRemotePresence({ ...presence, source: 'online_relay' });
    RealtimeRelayService.publish('admin:policy', 'presence:heartbeat', presence);
    if (typeof fetch !== 'undefined') {
      void fetch('/api/relay-presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...presence, source: 'online_relay' }),
      }).catch(() => {});
    }
    if (cloudHooks.onSyncPresence) {
      void Promise.resolve(cloudHooks.onSyncPresence(activeScreen)).catch(() => {});
    }
    return presence;
  },

  async fetchVolatileServerPresence(): Promise<{ connectedClients: number; count: number }> {
    try {
      const resp = await fetch('/api/relay-presence');
      if (!resp.ok) return { connectedClients: 0, count: 0 };
      const data = (await resp.json()) as {
        connectedClients?: number;
        entries?: AccountPresenceRecord[];
      };
      if (Array.isArray(data.entries)) {
        for (const entry of data.entries) {
          this.ingestRemotePresence(entry);
        }
      }
      return {
        connectedClients: Number(data.connectedClients) || 0,
        count: Array.isArray(data.entries) ? data.entries.length : 0,
      };
    } catch {
      return { connectedClients: 0, count: 0 };
    }
  },

  findMatchedCommunityFreeForUser(
    trahList: Array<{ id: string; name: string }>,
    communityList: Array<{ id: string; name: string; orgType: string }>,
    moduleId?: MonetizableModuleId
  ): CommunityFreeRule | undefined {
    const rules = this.getBundle().communityFreeRules.filter(r => r.enabled);
    if (rules.length === 0) return undefined;

    for (const rule of rules) {
      if (moduleId && rule.freeModules !== 'all' && !rule.freeModules.includes(moduleId)) {
        continue;
      }
      if (rule.kind === 'trah') {
        const matched = trahList.some(
          t =>
            (rule.targetId && t.id === rule.targetId) ||
            normalizeName(t.name) === normalizeName(rule.name)
        );
        if (matched) return rule;
      } else {
        const matched = communityList.some(
          c =>
            (rule.targetId && c.id === rule.targetId) ||
            normalizeName(c.name) === normalizeName(rule.name)
        );
        if (matched) return rule;
      }
    }
    return undefined;
  },

  evaluateCurrentAccountAccess(moduleId?: MonetizableModuleId): {
    status: AccountModerationStatus;
    isFreeForModule: boolean;
    warningNote?: string;
    banReason?: string;
    freeReason?: string;
    isAdminProtected: boolean;
  } {
    const acc = AuthService.getAccount();
    const email = normalizeEmail(acc?.email || '');
    const phoneDigits = normalizePhone(acc?.phone || '');
    const isAdminProtected = isProtectedAdminEmail(email);

    const bundle = this.getBundle();
    let explicitRule: AccountPolicyRule | undefined;

    if (email && bundle.accountRules[email]) {
      explicitRule = bundle.accountRules[email];
    } else if (phoneDigits && bundle.accountRules[`phone:${phoneDigits}`]) {
      explicitRule = bundle.accountRules[`phone:${phoneDigits}`];
    } else if (phoneDigits) {
      explicitRule = Object.values(bundle.accountRules).find(
        r => r.phone && normalizePhone(r.phone) === phoneDigits
      );
    }

    // Admin is never locked out by banned status
    if (!isAdminProtected && explicitRule?.status === 'banned') {
      return {
        status: 'banned',
        isFreeForModule: false,
        banReason:
          explicitRule.note ||
          'Akun ini dibatasi oleh Admin Zero Trust. Hubungi pengurus atau developer.',
        isAdminProtected: false,
      };
    }

    const trahList = loadLocalTrahListForScope(email);
    const communityList = RtSiagaStorage.getCommunities().map(w => ({
      id: w.id,
      name: w.profile.orgName,
      orgType: w.profile.orgType,
    }));

    const matchedCommunity = this.findMatchedCommunityFreeForUser(
      trahList,
      communityList,
      moduleId
    );

    const accountFreeMatchesModule =
      explicitRule?.status === 'free' &&
      (!moduleId ||
        explicitRule.freeModules === 'all' ||
        explicitRule.freeModules.includes(moduleId));

    const isFreeForModule = Boolean(accountFreeMatchesModule || matchedCommunity);
    let freeReason: string | undefined;
    if (accountFreeMatchesModule) {
      freeReason = 'Gratis (Akun Free VIP Admin)';
    } else if (matchedCommunity) {
      freeReason = `Gratis (${
        matchedCommunity.kind === 'trah' ? 'Trah' : 'RT/Paguyuban'
      }: ${matchedCommunity.name})`;
    }

    if (!isAdminProtected && explicitRule?.status === 'warning') {
      return {
        status: 'warning',
        isFreeForModule,
        warningNote:
          explicitRule.note ||
          'Akun Anda mendapat peringatan resmi dari Admin Zero Trust. Harap patuhi aturan warga.',
        freeReason,
        isAdminProtected: false,
      };
    }

    return {
      status: isFreeForModule ? 'free' : explicitRule?.status || 'normal',
      isFreeForModule,
      freeReason,
      isAdminProtected,
    };
  },

  isCurrentUserFreeForModule(moduleId: MonetizableModuleId): { free: boolean; reason?: string } {
    const evalRes = this.evaluateCurrentAccountAccess(moduleId);
    if (evalRes.status === 'banned') {
      return { free: false };
    }
    return {
      free: evalRes.isFreeForModule,
      reason: evalRes.freeReason,
    };
  },

  getCombinedKnownAccounts(): KnownAccountSummary[] {
    const bundle = this.getBundle();
    const map = new Map<string, KnownAccountSummary>();
    const onlineWindowMs = 5 * 60 * 1000;
    const now = Date.now();

    const upsertEntry = (incoming: {
      accountKey: string;
      email: string;
      displayName: string;
      phone: string;
      deviceMask: string;
      activeModules: GovernanceModuleId[];
      trahList: Array<{ id: string; name: string }>;
      communityList: Array<{ id: string; name: string; orgType: string }>;
      lastSeenAt: string;
      isOnlineHint?: boolean;
    }) => {
      const prev = map.get(incoming.accountKey);
      const mergedMods = new Set<GovernanceModuleId>([
        ...(prev?.activeModules || []),
        ...incoming.activeModules,
      ]);
      const trahMap = new Map<string, { id: string; name: string }>();
      for (const t of [...(prev?.trahList || []), ...incoming.trahList]) {
        trahMap.set(t.id || normalizeName(t.name), t);
      }
      const commMap = new Map<string, { id: string; name: string; orgType: string }>();
      for (const c of [...(prev?.communityList || []), ...incoming.communityList]) {
        commMap.set(c.id || normalizeName(c.name), c);
      }

      const lastSeenAt =
        prev && new Date(prev.lastSeenAt).getTime() > new Date(incoming.lastSeenAt).getTime()
          ? prev.lastSeenAt
          : incoming.lastSeenAt;

      const isOnlineNow =
        Boolean(incoming.isOnlineHint) &&
        now - new Date(lastSeenAt).getTime() <= onlineWindowMs;

      map.set(incoming.accountKey, {
        accountKey: incoming.accountKey,
        email: incoming.email !== 'tamu@perangkat-lokal' ? incoming.email : prev?.email || incoming.email,
        displayName: incoming.displayName || prev?.displayName || 'Warga',
        phone: incoming.phone && incoming.phone !== '-' ? incoming.phone : prev?.phone || '-',
        deviceMask: incoming.deviceMask || prev?.deviceMask || 'DEV-••••',
        activeModules: Array.from(mergedMods),
        trahList: Array.from(trahMap.values()),
        communityList: Array.from(commMap.values()),
        lastSeenAt,
        isOnlineNow: Boolean(prev?.isOnlineNow || isOnlineNow),
        effectiveStatus: 'normal',
      });
    };

    // 1. Live / Cached Presence Heartbeats
    for (const p of this.getCachedPresences()) {
      upsertEntry({
        ...p,
        isOnlineHint: p.source === 'online_relay',
      });
    }

    // 2. ZeroTrust Devices
    for (const dev of ZeroTrustService.getDevices()) {
      const email = normalizeEmail(dev.email || '');
      const phone = (dev.phone || '').trim();
      const accountKey = email || (phone ? `phone:${normalizePhone(phone)}` : `dev:${dev.deviceId.slice(-8)}`);
      upsertEntry({
        accountKey,
        email: email || 'tamu@perangkat-lokal',
        displayName: email ? email.split('@')[0] : dev.label || 'Perangkat',
        phone: phone || '-',
        deviceMask: dev.maskedFingerprint,
        activeModules: [],
        trahList: [],
        communityList: [],
        lastSeenAt: dev.lastActiveAt || dev.registeredAt,
      });
    }

    // 3. Smart Care Ticket Reporters
    for (const ticket of SmartCareService.getLogs()) {
      const email = normalizeEmail(ticket.reporterEmail || '');
      const phone = (ticket.reporterPhone || '').trim();
      if (!email && !phone) continue;
      const accountKey = email || `phone:${normalizePhone(phone)}`;
      upsertEntry({
        accountKey,
        email: email || 'tamu@perangkat-lokal',
        displayName: ticket.reporterName || 'Pelapor Smart Care',
        phone: phone || '-',
        deviceMask: ticket.hiddenDeviceId
          ? maskDeviceFingerprint(ticket.hiddenDeviceId)
          : ticket.device || 'DEV-••••',
        activeModules: [],
        trahList: [],
        communityList: [],
        lastSeenAt: ticket.createdAt,
      });
    }

    // 4. Local Admin Communities' Claimed Members (if email/phone recorded)
    for (const ws of RtSiagaStorage.getCommunities()) {
      const modId: GovernanceModuleId = ws.profile.orgType === 'RT' ? 'rtqu' : 'paguyubanqu';
      for (const m of ws.members) {
        const email = normalizeEmail(m.email || '');
        const phone = (m.phone || '').trim();
        if (!email && (!phone || phone === '-')) continue;
        const accountKey = email || `phone:${normalizePhone(phone)}`;
        upsertEntry({
          accountKey,
          email: email || 'tamu@perangkat-lokal',
          displayName: m.name || 'Warga',
          phone: phone || '-',
          deviceMask: m.deviceId ? maskDeviceFingerprint(m.deviceId) : 'DEV-••••',
          activeModules: [modId],
          trahList: [],
          communityList: [
            { id: ws.id, name: ws.profile.orgName, orgType: ws.profile.orgType },
          ],
          lastSeenAt: m.claimedAt || m.invitedAt || ws.profile.createdAt || new Date().toISOString(),
        });
      }
    }

    // 5. Explicit account policy entries added manually by Admin
    for (const rule of Object.values(bundle.accountRules)) {
      if (!map.has(rule.key)) {
        upsertEntry({
          accountKey: rule.key,
          email: rule.email,
          displayName: rule.email.split('@')[0] || rule.key,
          phone: rule.phone || '-',
          deviceMask: 'POLICY-ADMIN',
          activeModules: [],
          trahList: [],
          communityList: [],
          lastSeenAt: rule.updatedAt,
        });
      }
    }

    // Compute effective moderation & community free status
    const result: KnownAccountSummary[] = [];
    for (const item of map.values()) {
      const explicitRule =
        bundle.accountRules[item.accountKey] ||
        bundle.accountRules[normalizeEmail(item.email)] ||
        (item.phone !== '-' ? bundle.accountRules[`phone:${normalizePhone(item.phone)}`] : undefined);

      const matchedCommunityFree = this.findMatchedCommunityFreeForUser(
        item.trahList,
        item.communityList
      );

      let effectiveStatus: AccountModerationStatus = explicitRule?.status || 'normal';
      if (effectiveStatus === 'normal' && matchedCommunityFree) {
        effectiveStatus = 'free';
      }

      result.push({
        ...item,
        explicitRule,
        matchedCommunityFree,
        effectiveStatus,
      });
    }

    return result.sort(
      (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    );
  },

  getModuleAccountStats(): Array<{
    moduleId: GovernanceModuleId;
    label: string;
    desc: string;
    registeredCount: number;
    onlineNowCount: number;
    freeAccountsCount: number;
  }> {
    const accounts = this.getCombinedKnownAccounts();
    return GOVERNANCE_MODULES.map(mod => {
      const matched = accounts.filter(a => a.activeModules.includes(mod.id));
      return {
        moduleId: mod.id,
        label: mod.label,
        desc: mod.desc,
        registeredCount: matched.length,
        onlineNowCount: matched.filter(a => a.isOnlineNow).length,
        freeAccountsCount: matched.filter(a => a.effectiveStatus === 'free').length,
      };
    });
  },

  getAccountHealthMetrics() {
    const accounts = this.getCombinedKnownAccounts();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;

    const verifiedCount = accounts.filter(
      a => a.email !== 'tamu@perangkat-lokal' && a.email.includes('@')
    ).length;
    const guestCount = accounts.length - verifiedCount;
    const active24hCount = accounts.filter(
      a => now - new Date(a.lastSeenAt).getTime() <= dayMs
    ).length;
    const active7dCount = accounts.filter(
      a => now - new Date(a.lastSeenAt).getTime() <= weekMs
    ).length;
    const dormantCount = accounts.filter(
      a => now - new Date(a.lastSeenAt).getTime() > weekMs
    ).length;
    const onlineCount = accounts.filter(a => a.isOnlineNow).length;
    const multiModuleCount = accounts.filter(a => a.activeModules.length >= 2).length;

    return {
      totalAccounts: accounts.length,
      verifiedCount,
      guestCount,
      active24hCount,
      active7dCount,
      dormantCount,
      onlineCount,
      multiModuleCount,
    };
  },
};
