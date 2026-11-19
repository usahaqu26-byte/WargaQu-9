import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Radio,
  RefreshCw,
  Gift,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Plus,
  Trash2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  ACCOUNT_GOV_SYNC_EVENT,
  AccountGovernanceService,
  AccountModerationStatus,
  GOVERNANCE_MODULES,
  GovernanceModuleId,
  KnownAccountSummary,
  MONETIZABLE_MODULE_OPTIONS,
} from '../../services/accountGovernanceService';
import { FirebaseSyncService } from '../../services/firebaseSyncService';
import type { MonetizableModuleId } from '../../services/monetizationService';
import {
  RELAY_STATUS_EVENT,
  RELAY_TELEMETRY_EVENT,
  RealtimeRelayService,
  RelayConnectionState,
  ServerTelemetryPayload,
} from '../../services/realtimeRelayService';

type ExtendedAccountFilter =
  | 'all'
  | 'online'
  | 'verified'
  | 'guest'
  | 'active_24h'
  | 'dormant'
  | AccountModerationStatus;

interface AccountGovernancePanelProps {
  showNotification: (msg: string) => void;
  initialModuleFilter?: GovernanceModuleId | 'all';
  onModuleFilterChange?: (mod: GovernanceModuleId | 'all') => void;
}

export const AccountGovernancePanel: React.FC<AccountGovernancePanelProps> = ({
  showNotification,
  initialModuleFilter = 'all',
  onModuleFilterChange,
}) => {
  const [tick, setTick] = useState(0);
  const [connectedClients, setConnectedClients] = useState<number>(
    () => RealtimeRelayService.getTelemetry()?.connectedClients || 0
  );
  const [relayStatus, setRelayStatus] = useState<RelayConnectionState>(
    () => RealtimeRelayService.getStatus()
  );
  const [telemetry, setTelemetry] = useState<ServerTelemetryPayload | null>(
    () => RealtimeRelayService.getTelemetry()
  );
  const [refreshing, setRefreshing] = useState(false);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExtendedAccountFilter>('all');
  const [moduleFilter, setModuleFilter] = useState<GovernanceModuleId | 'all'>(initialModuleFilter);

  useEffect(() => {
    setModuleFilter(initialModuleFilter);
  }, [initialModuleFilter]);

  const handleSelectModuleFilter = (nextMod: GovernanceModuleId | 'all') => {
    setModuleFilter(nextMod);
    onModuleFilterChange?.(nextMod);
  };

  // Add custom Community Free rule
  const [newCommKind, setNewCommKind] = useState<'trah' | 'rt_paguyuban'>('trah');
  const [newCommName, setNewCommName] = useState('');

  // Manual pre-set account policy
  const [manualEmail, setManualEmail] = useState('');
  const [manualStatus, setManualStatus] = useState<AccountModerationStatus>('free');
  const [manualNote, setManualNote] = useState('');

  // Inline note editing per account
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const syncFromRelay = async (quiet = false) => {
    setRefreshing(true);
    const [res, health, cloudRes] = await Promise.all([
      AccountGovernanceService.fetchVolatileServerPresence(),
      RealtimeRelayService.fetchHealthTelemetry(),
      FirebaseSyncService.isCloudAdmin()
        ? FirebaseSyncService.fetchAdminCloudSnapshot().catch(() => ({
            accountsCount: 0,
            policiesCount: 0,
          }))
        : Promise.resolve({ accountsCount: 0, policiesCount: 0 }),
    ]);
    if (health) {
      setTelemetry(health);
      setConnectedClients(health.connectedClients);
    } else {
      setConnectedClients(res.connectedClients);
    }
    setTick(t => t + 1);
    setRefreshing(false);
    if (!quiet) {
      showNotification(
        FirebaseSyncService.isCloudAdmin()
          ? `Sinkronisasi selesai (${cloudRes.accountsCount} akun Cloud, ${health?.connectedClients ?? res.connectedClients} koneksi live).`
          : `Sinkronisasi live relay selesai (${health?.connectedClients ?? res.connectedClients} koneksi aktif, ${res.count} presence).`
      );
    }
  };

  useEffect(() => {
    void syncFromRelay(true);
    const onSync = () => setTick(t => t + 1);
    const onRelayStatus = (ev: Event) => {
      const next = (ev as CustomEvent<RelayConnectionState>).detail;
      if (next) setRelayStatus(next);
    };
    const onRelayTelemetry = (ev: Event) => {
      const next = (ev as CustomEvent<ServerTelemetryPayload>).detail;
      if (next) {
        setTelemetry(next);
        setConnectedClients(next.connectedClients);
      }
    };
    window.addEventListener(ACCOUNT_GOV_SYNC_EVENT, onSync);
    window.addEventListener(RELAY_STATUS_EVENT, onRelayStatus);
    window.addEventListener(RELAY_TELEMETRY_EVENT, onRelayTelemetry);
    const timer = window.setInterval(() => {
      void syncFromRelay(true);
    }, 8000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ACCOUNT_GOV_SYNC_EVENT, onSync);
      window.removeEventListener(RELAY_STATUS_EVENT, onRelayStatus);
      window.removeEventListener(RELAY_TELEMETRY_EVENT, onRelayTelemetry);
    };
  }, []);

  const bundle = AccountGovernanceService.getBundle();
  const accounts = useMemo(() => AccountGovernanceService.getCombinedKnownAccounts(), [bundle, refreshing, tick]);
  const moduleStats = useMemo(() => AccountGovernanceService.getModuleAccountStats(), [accounts]);
  const healthMetrics = useMemo(() => AccountGovernanceService.getAccountHealthMetrics(), [accounts]);
  const adminWorkspaces = useMemo(() => AccountGovernanceService.getAdminOwnWorkspaces(), [tick]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;

    return accounts.filter(acc => {
      if (moduleFilter !== 'all' && !acc.activeModules.includes(moduleFilter)) {
        return false;
      }
      if (statusFilter === 'online' && !acc.isOnlineNow) return false;
      if (
        statusFilter === 'verified' &&
        (acc.email === 'tamu@perangkat-lokal' || !acc.email.includes('@'))
      ) {
        return false;
      }
      if (
        statusFilter === 'guest' &&
        acc.email !== 'tamu@perangkat-lokal' &&
        acc.email.includes('@')
      ) {
        return false;
      }
      if (
        statusFilter === 'active_24h' &&
        now - new Date(acc.lastSeenAt).getTime() > dayMs
      ) {
        return false;
      }
      if (
        statusFilter === 'dormant' &&
        now - new Date(acc.lastSeenAt).getTime() <= weekMs
      ) {
        return false;
      }
      if (
        (statusFilter === 'normal' ||
          statusFilter === 'free' ||
          statusFilter === 'warning' ||
          statusFilter === 'banned') &&
        acc.effectiveStatus !== statusFilter
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        acc.email,
        acc.displayName,
        acc.phone,
        acc.deviceMask,
        ...acc.trahList.map(t => t.name),
        ...acc.communityList.map(c => c.name),
        ...acc.activeModules,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [accounts, searchQuery, statusFilter, moduleFilter]);

  const maxModuleCount = Math.max(1, ...moduleStats.map(m => m.registeredCount));
  const onlineCount = accounts.filter(a => a.isOnlineNow).length;
  const freeCount = accounts.filter(a => a.effectiveStatus === 'free').length;
  const warningCount = accounts.filter(a => a.effectiveStatus === 'warning').length;
  const bannedCount = accounts.filter(a => a.effectiveStatus === 'banned').length;

  const handleSetStatus = (acc: KnownAccountSummary, nextStatus: AccountModerationStatus) => {
    const draftNote = (noteDrafts[acc.accountKey] ?? acc.explicitRule?.note ?? '').trim();
    if (nextStatus === 'warning' && !draftNote) {
      AccountGovernanceService.setAccountPolicy({
        email: acc.email !== 'tamu@perangkat-lokal' ? acc.email : acc.accountKey,
        phone: acc.phone !== '-' ? acc.phone : undefined,
        status: 'warning',
        note: 'Mohon perhatikan tata tertib komunitas WargaQu.',
      });
    } else if (nextStatus === 'banned' && !draftNote) {
      AccountGovernanceService.setAccountPolicy({
        email: acc.email !== 'tamu@perangkat-lokal' ? acc.email : acc.accountKey,
        phone: acc.phone !== '-' ? acc.phone : undefined,
        status: 'banned',
        note: 'Akun dinonaktifkan sementara oleh Admin Zero Trust.',
      });
    } else {
      AccountGovernanceService.setAccountPolicy({
        email: acc.email !== 'tamu@perangkat-lokal' ? acc.email : acc.accountKey,
        phone: acc.phone !== '-' ? acc.phone : undefined,
        status: nextStatus,
        note: nextStatus === 'normal' ? '' : draftNote,
      });
    }
    showNotification(`Status ${acc.email} diubah menjadi ${nextStatus.toUpperCase()}.`);
  };

  const handleQuickWorkspaceToggle = (
    kind: 'trah' | 'rt_paguyuban',
    targetId: string,
    name: string
  ) => {
    const existing = bundle.communityFreeRules.find(
      r =>
        (r.targetId && r.targetId === targetId) ||
        (r.kind === kind && r.name.toLowerCase() === name.toLowerCase())
    );
    if (existing) {
      AccountGovernanceService.toggleCommunityFreeRule(existing.id);
      showNotification(
        `Free Modular untuk ${name} -> ${!existing.enabled ? 'ON (Gratis)' : 'OFF'}`
      );
    } else {
      AccountGovernanceService.upsertCommunityFreeRule({
        kind,
        targetId,
        name,
        enabled: true,
        freeModules: 'all',
      });
      showNotification(`Free Modular untuk ${name} diaktifkan (ON)!`);
    }
  };

  const handleAddCustomCommunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommName.trim()) return;
    AccountGovernanceService.upsertCommunityFreeRule({
      kind: newCommKind,
      name: newCommName.trim(),
      enabled: true,
      freeModules: 'all',
    });
    showNotification(`Free Modular ditambahkan untuk ${newCommName.trim()}.`);
    setNewCommName('');
  };

  const handleAddManualAccountPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim() || !manualEmail.includes('@')) {
      showNotification('Masukkan alamat email akun yang valid.');
      return;
    }
    AccountGovernanceService.setAccountPolicy({
      email: manualEmail.trim().toLowerCase(),
      status: manualStatus,
      note: manualNote.trim() || undefined,
    });
    showNotification(
      `Aturan ${manualStatus.toUpperCase()} disimpan & disiarkan untuk ${manualEmail.trim()}.`
    );
    setManualEmail('');
    setManualNote('');
  };

  const handleToggleRuleModule = (ruleId: string, modId: MonetizableModuleId) => {
    const rule = bundle.communityFreeRules.find(r => r.id === ruleId);
    if (!rule) return;
    let nextMods: MonetizableModuleId[];
    if (rule.freeModules === 'all') {
      nextMods = MONETIZABLE_MODULE_OPTIONS.map(o => o.id).filter(id => id !== modId);
    } else if (rule.freeModules.includes(modId)) {
      nextMods = rule.freeModules.filter(id => id !== modId);
    } else {
      nextMods = [...rule.freeModules, modId];
    }
    if (nextMods.length === MONETIZABLE_MODULE_OPTIONS.length) {
      AccountGovernanceService.updateCommunityFreeModules(ruleId, 'all');
    } else {
      AccountGovernanceService.updateCommunityFreeModules(ruleId, nextMods);
    }
  };

  return (
    <div className="divide-y divide-slate-200">
      {/* 1. Live Telemetry & Zero-DB Status */}
      <section className="p-4 space-y-3 bg-slate-50/70">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Radio
                className={`w-3.5 h-3.5 ${
                  relayStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600'
                }`}
              />
              <h2 className="text-xs font-extrabold text-slate-900">
                Pemantauan Akun Aktif &amp; Akses Dinamis
              </h2>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  relayStatus === 'connected'
                    ? 'bg-emerald-100 text-emerald-800'
                    : relayStatus === 'connecting'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {relayStatus === 'connected'
                  ? `LIVE · ${telemetry?.activeChannels ?? 0} channel`
                  : relayStatus === 'connecting'
                  ? 'MENGHUBUNGKAN'
                  : 'OFFLINE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              {FirebaseSyncService.isCloudAdmin()
                ? 'Mode Hybrid Firestore: metadata akun & status Free/Warning/Banned tersimpan permanen (~0,5 KB/akun) plus status live relay.'
                : 'Mode Relay + Lokal: akun online, perangkat terikat, dan anggota Trah/RT tercatat otomatis. Hubungkan Google Admin untuk sync Firestore permanen.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => syncFromRelay(false)}
            disabled={refreshing}
            className="min-h-[34px] px-2.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-white border border-slate-200 rounded-xl p-2">
            <div className="text-[10px] text-slate-500">Terpantau</div>
            <div className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">
              {accounts.length}
            </div>
            <div className="text-[10px] text-emerald-700 font-semibold">
              {onlineCount} online ({connectedClients} ws)
            </div>
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl p-2">
            <div className="text-[10px] text-emerald-700">Free VIP</div>
            <div className="text-sm font-extrabold text-emerald-700 font-mono tabular-nums">
              {freeCount}
            </div>
            <div className="text-[10px] text-slate-500">Bebas biaya</div>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-2">
            <div className="text-[10px] text-amber-700">Warning</div>
            <div className="text-sm font-extrabold text-amber-700 font-mono tabular-nums">
              {warningCount}
            </div>
            <div className="text-[10px] text-slate-500">Peringatan</div>
          </div>
          <div className="bg-white border border-rose-200 rounded-xl p-2">
            <div className="text-[10px] text-rose-700">Banned</div>
            <div className="text-sm font-extrabold text-rose-700 font-mono tabular-nums">
              {bannedCount}
            </div>
            <div className="text-[10px] text-slate-500">Diblokir</div>
          </div>
        </div>

        {/* Kesehatan Akun Mini-Bar */}
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
          <span>
            Terverifikasi: <strong className="text-slate-900 font-mono">{healthMetrics.verifiedCount}</strong>
          </span>
          <span>
            Tamu: <strong className="text-slate-900 font-mono">{healthMetrics.guestCount}</strong>
          </span>
          <span>
            Aktif 24j: <strong className="text-emerald-700 font-mono">{healthMetrics.active24hCount}</strong>
          </span>
          <span>
            Pasif &gt;7h: <strong className="text-amber-700 font-mono">{healthMetrics.dormantCount}</strong>
          </span>
          <span>
            Multi-Modul: <strong className="text-indigo-700 font-mono">{healthMetrics.multiModuleCount}</strong>
          </span>
        </div>
      </section>

      {/* 2. Per-Module Account Breakdown */}
      <section className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-700" />
            <span>Akun Terdaftar / Aktif per Modul</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">
            {moduleFilter === 'all' ? 'Ketuk modul untuk filter' : 'Filter aktif'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {moduleStats.map(mod => {
            const pct = Math.round((mod.registeredCount / maxModuleCount) * 100);
            const isSelected = moduleFilter === mod.moduleId;
            return (
              <button
                key={mod.moduleId}
                type="button"
                onClick={() =>
                  handleSelectModuleFilter(isSelected ? 'all' : mod.moduleId)
                }
                className={`w-full text-left border rounded-xl p-2.5 space-y-1.5 transition ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900">{mod.label}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5 hidden sm:inline">
                      · {mod.desc}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums shrink-0 flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">
                      {mod.registeredCount} akun
                    </span>
                    {mod.onlineNowCount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        ({mod.onlineNowCount} live)
                      </span>
                    )}
                    {mod.freeAccountsCount > 0 && (
                      <span className="text-[10px] font-bold text-indigo-700">
                        {mod.freeAccountsCount} free
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isSelected ? 'bg-emerald-700' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${mod.registeredCount > 0 ? Math.max(8, pct) : 0}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Free Modular ON/OFF by Trah / RT / Paguyuban */}
      <section className="p-4 space-y-3">
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-emerald-700" />
            <span>Free Modular Komunitas (Trah / RT / Paguyuban ON-OFF)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            Aktifkan agar seluruh akun yang terdaftar di Trah, RT, atau Paguyuban pilihan Anda
            otomatis gratis biaya modular (bisa pilih semua modul atau modul tertentu saja).
          </p>
        </div>

        {/* Quick pick from Admin's own Trah & RT/Paguyuban */}
        {(adminWorkspaces.trahs.length > 0 || adminWorkspaces.communities.length > 0) && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
            <div className="text-[11px] font-bold text-emerald-900">
              Pilih Cepat dari Trah &amp; RT/Paguyuban Milik Anda:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {adminWorkspaces.trahs.map(trah => {
                const rule = bundle.communityFreeRules.find(
                  r =>
                    r.kind === 'trah' &&
                    ((r.targetId && r.targetId === trah.id) ||
                      r.name.toLowerCase() === trah.name.toLowerCase())
                );
                const isOn = Boolean(rule?.enabled);
                return (
                  <button
                    key={trah.id}
                    type="button"
                    onClick={() => handleQuickWorkspaceToggle('trah', trah.id, trah.name)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                      isOn
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Trah: {trah.name} · {isOn ? 'FREE ON' : 'OFF'}
                  </button>
                );
              })}
              {adminWorkspaces.communities.map(comm => {
                const rule = bundle.communityFreeRules.find(
                  r =>
                    r.kind === 'rt_paguyuban' &&
                    ((r.targetId && r.targetId === comm.id) ||
                      r.name.toLowerCase() === comm.name.toLowerCase())
                );
                const isOn = Boolean(rule?.enabled);
                return (
                  <button
                    key={comm.id}
                    type="button"
                    onClick={() =>
                      handleQuickWorkspaceToggle('rt_paguyuban', comm.id, comm.name)
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                      isOn
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {comm.orgType}: {comm.name} · {isOn ? 'FREE ON' : 'OFF'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Manual add Trah / RT / Paguyuban rule */}
        <form onSubmit={handleAddCustomCommunity} className="flex gap-2 text-xs">
          <select
            value={newCommKind}
            onChange={e => setNewCommKind(e.target.value as 'trah' | 'rt_paguyuban')}
            className="min-h-[38px] border border-slate-300 rounded-xl px-2.5 bg-white font-semibold text-[11px] shrink-0"
          >
            <option value="trah">Trah (LeluhurQu)</option>
            <option value="rt_paguyuban">RT / Paguyuban</option>
          </select>
          <input
            type="text"
            value={newCommName}
            onChange={e => setNewCommName(e.target.value)}
            placeholder="Ketik nama Trah atau RT/Paguyuban..."
            className="flex-1 min-w-0 min-h-[38px] border border-slate-300 rounded-xl px-3 text-xs"
          />
          <button
            type="submit"
            className="min-h-[38px] px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah</span>
          </button>
        </form>

        {/* Active Community Free Rules List */}
        {bundle.communityFreeRules.length === 0 ? (
          <div className="text-[11px] text-slate-500 border border-dashed border-slate-300 rounded-xl p-3">
            Belum ada aturan Free Komunitas. Pilih cepat dari daftar Trah/RT Anda di atas atau ketik
            nama komunitas baru.
          </div>
        ) : (
          <div className="space-y-2">
            {bundle.communityFreeRules.map(rule => {
              const isExpanded = expandedRuleId === rule.id;
              return (
                <div
                  key={rule.id}
                  className="border border-slate-200 rounded-xl p-3 bg-white space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        {rule.kind === 'trah' ? 'Trah' : 'RT/Paguyuban'}: {rule.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Cakupan:{' '}
                        {rule.freeModules === 'all'
                          ? 'Semua Modul (100% Free Modular)'
                          : `${rule.freeModules.length} modul dipilih`}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRuleId(isExpanded ? null : rule.id)
                        }
                        className="min-h-[30px] px-2 border border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                      >
                        {isExpanded ? 'Tutup Modul' : 'Pilih Modul'}
                      </button>
                      <button
                        type="button"
                        onClick={() => AccountGovernanceService.toggleCommunityFreeRule(rule.id)}
                        className={`min-h-[30px] px-2.5 rounded-lg text-[10px] font-extrabold ${
                          rule.enabled
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {rule.enabled ? 'FREE ON' : 'OFF'}
                      </button>
                      <button
                        type="button"
                        onClick={() => AccountGovernanceService.deleteCommunityFreeRule(rule.id)}
                        className="w-[30px] h-[30px] border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center"
                        aria-label="Hapus aturan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-600">
                          Modul yang Digratiskan:
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            AccountGovernanceService.updateCommunityFreeModules(
                              rule.id,
                              rule.freeModules === 'all' ? [] : 'all'
                            )
                          }
                          className="text-[10px] font-bold text-emerald-700 hover:underline"
                        >
                          {rule.freeModules === 'all' ? 'Kosongkan' : 'Pilih Semua Modul'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {MONETIZABLE_MODULE_OPTIONS.map(opt => {
                          const checked =
                            rule.freeModules === 'all' || rule.freeModules.includes(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleToggleRuleModule(rule.id, opt.id)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                                checked
                                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                                  : 'bg-slate-50 border-slate-200 text-slate-500'
                              }`}
                            >
                              {checked ? '✓ ' : ''}
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. Dynamic Account Moderation (Normal / Free / Warning / Banned) */}
      <section className="p-4 space-y-3">
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-800" />
            <span>Kontrol Status Akun Dinamis (Free / Warning / Banned)</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Atur status akun secara langsung atau pra-daftar email warga sebelum mereka login.
          </p>
        </div>

        {/* Pre-set manual email policy */}
        <form
          onSubmit={handleAddManualAccountPolicy}
          className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs"
        >
          <div className="text-[11px] font-bold text-slate-700">
            Atur Akun via Email (Langsung Berlaku Saat Login / Online):
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="email"
              value={manualEmail}
              onChange={e => setManualEmail(e.target.value)}
              placeholder="email.warga@gmail.com"
              className="col-span-2 min-h-[36px] border border-slate-300 rounded-lg px-2.5 bg-white text-xs"
            />
            <select
              value={manualStatus}
              onChange={e => setManualStatus(e.target.value as AccountModerationStatus)}
              className="min-h-[36px] border border-slate-300 rounded-lg px-2 bg-white font-bold text-[11px]"
            >
              <option value="free">Free VIP</option>
              <option value="warning">Warning</option>
              <option value="banned">Banned</option>
              <option value="normal">Normal</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualNote}
              onChange={e => setManualNote(e.target.value)}
              placeholder="Catatan alasan / pesan peringatan (opsional)"
              className="flex-1 min-h-[36px] border border-slate-300 rounded-lg px-2.5 bg-white text-xs"
            />
            <button
              type="submit"
              className="min-h-[36px] px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] shrink-0"
            >
              Terapkan
            </button>
          </div>
        </form>

        {/* Search & Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari email, HP, nama, Trah, RT, atau modul..."
              className="w-full min-h-[36px] border border-slate-300 rounded-xl pl-8 pr-3 text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: `Semua (${accounts.length})` },
                { id: 'online', label: `Online (${onlineCount})` },
                { id: 'verified', label: `Terverifikasi (${healthMetrics.verifiedCount})` },
                { id: 'guest', label: `Tamu (${healthMetrics.guestCount})` },
                { id: 'active_24h', label: `Aktif 24j (${healthMetrics.active24hCount})` },
                { id: 'dormant', label: `Pasif >7h (${healthMetrics.dormantCount})` },
                { id: 'free', label: `Free (${freeCount})` },
                { id: 'warning', label: `Warning (${warningCount})` },
                { id: 'banned', label: `Banned (${bannedCount})` },
              ] as Array<{ id: ExtendedAccountFilter; label: string }>
            ).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                  statusFilter === f.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {moduleFilter !== 'all' && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-[11px]">
              <span className="font-bold text-emerald-900">
                Filter Modul:{' '}
                {GOVERNANCE_MODULES.find(m => m.id === moduleFilter)?.label || moduleFilter}
              </span>
              <button
                type="button"
                onClick={() => handleSelectModuleFilter('all')}
                className="font-bold text-emerald-700 hover:underline text-[10px]"
              >
                Tampilkan Semua ×
              </button>
            </div>
          )}
        </div>

        {/* Account Cards */}
        {filteredAccounts.length === 0 ? (
          <div className="text-xs text-slate-500 p-4 border border-dashed border-slate-300 rounded-xl text-center">
            Belum ada akun yang cocok dengan filter ini.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAccounts.map(acc => {
              const currentNote =
                noteDrafts[acc.accountKey] !== undefined
                  ? noteDrafts[acc.accountKey]
                  : acc.explicitRule?.note || '';

              return (
                <div
                  key={acc.accountKey}
                  className="border border-slate-200 rounded-xl p-3 bg-white space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-900 truncate">
                          {acc.email}
                        </span>
                        {acc.isOnlineNow && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold">
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {acc.phone !== '-' ? `${acc.phone} · ` : ''}
                        {acc.deviceMask} ·{' '}
                        {new Date(acc.lastSeenAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase shrink-0 ${
                        acc.effectiveStatus === 'free'
                          ? 'bg-emerald-100 text-emerald-800'
                          : acc.effectiveStatus === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : acc.effectiveStatus === 'banned'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {acc.effectiveStatus}
                    </span>
                  </div>

                  {/* Active Modules & Communities Tags */}
                  {(acc.activeModules.length > 0 ||
                    acc.trahList.length > 0 ||
                    acc.communityList.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {acc.trahList.map(t => (
                        <span
                          key={t.id}
                          className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-semibold"
                        >
                          Trah: {t.name}
                        </span>
                      ))}
                      {acc.communityList.map(c => (
                        <span
                          key={c.id}
                          className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-semibold"
                        >
                          {c.orgType}: {c.name}
                        </span>
                      ))}
                      {acc.activeModules.map(m => (
                        <span
                          key={m}
                          className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  {acc.matchedCommunityFree && (
                    <div className="text-[10px] text-emerald-700 font-semibold">
                      Gratis otomatis via komunitas:{' '}
                      {acc.matchedCommunityFree.kind === 'trah' ? 'Trah' : 'RT/Paguyuban'}{' '}
                      {acc.matchedCommunityFree.name}
                    </div>
                  )}

                  {/* Note Input for Warning/Banned */}
                  <input
                    type="text"
                    value={currentNote}
                    onChange={e =>
                      setNoteDrafts(prev => ({ ...prev, [acc.accountKey]: e.target.value }))
                    }
                    placeholder="Pesan catatan untuk status Warning / Banned..."
                    className="w-full min-h-[32px] border border-slate-200 rounded-lg px-2.5 text-[11px] bg-slate-50"
                  />

                  {/* 4-Way Dynamic Action Switcher */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSetStatus(acc, 'normal')}
                      className={`min-h-[32px] rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border ${
                        acc.effectiveStatus === 'normal' && !acc.explicitRule
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Normal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetStatus(acc, 'free')}
                      className={`min-h-[32px] rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border ${
                        acc.explicitRule?.status === 'free'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      <Gift className="w-3 h-3" />
                      <span>Free VIP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetStatus(acc, 'warning')}
                      className={`min-h-[32px] rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border ${
                        acc.explicitRule?.status === 'warning'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Warning</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetStatus(acc, 'banned')}
                      className={`min-h-[32px] rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border ${
                        acc.explicitRule?.status === 'banned'
                          ? 'bg-rose-700 text-white border-rose-700'
                          : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50'
                      }`}
                    >
                      <Ban className="w-3 h-3" />
                      <span>Banned</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
