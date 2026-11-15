import { AuthService } from './authService';
import { ZeroTrustService } from './zeroTrustService';
import { RealtimeRelayService } from './realtimeRelayService';
import { AccountGovernanceService } from './accountGovernanceService';

export type MonetizableModuleId =
  | 'areaqu_lapak'
  | 'leluhurqu_export'
  | 'rtqu_iuran'
  | 'muamalahqu_tx'
  | 'usahaqu_pro'
  | 'siagaqu_pro';

export type FeeMode = 'flat' | 'percent_1' | 'hybrid';

export interface ModuleMonetizationRule {
  moduleId: MonetizableModuleId;
  moduleName: string;
  triggerLabel: string;
  description: string;
  enabled: boolean; // Modular ON / OFF
  feeMode: FeeMode;
  flatFee: number; // Rp 2.000 - Rp 30.000
  percentRate: number; // 1 (%)
}

export interface DeveloperQrisConfig {
  merchantName: string;
  bankOrWalletLabel: string;
  accountInfo: string;
  nmid: string;
  qrisImageDataUrl: string; // Kosong jika menyusul
  minSettlementAmount: number;
  qrisPendingNote: string;
}

export interface MonetizationLedgerEntry {
  id: string;
  moduleId: MonetizableModuleId;
  moduleName: string;
  actionLabel: string;
  grossAmount: number;
  feeAmount: number;
  feeTypeLabel: string;
  userEmail: string;
  userPhone: string;
  status: 'pending_developer' | 'settled';
  settlementId?: string;
  createdAt: string;
}

export interface DeveloperSettlement {
  id: string;
  totalAmount: number;
  entriesCount: number;
  qrisReference: string;
  destinationName: string;
  settledAt: string;
}

const RULES_KEY = 'wargaqu_monetize_rules_v2';
const QRIS_CFG_KEY = 'wargaqu_dev_qris_cfg_v1';
const LEDGER_KEY = 'wargaqu_monetize_ledger_v1';
const SETTLEMENTS_KEY = 'wargaqu_monetize_settlements_v1';
const UNLOCKS_KEY = 'wargaqu_monetize_unlocks_v1';

export const MONETIZATION_SYNC_EVENT = 'wargaqu-monetize-sync';

function emitMonetizationSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MONETIZATION_SYNC_EVENT));
  }
}

const DEFAULT_RULES: ModuleMonetizationRule[] = [
  {
    moduleId: 'areaqu_lapak',
    moduleName: 'AreaQu (Sewa Lapak & Radar)',
    triggerLabel: 'Terbitkan / Perpanjang Lapak di Peta',
    description: 'Biaya tayang lapak warga di peta radius AreaQu (Rp 2.000 – Rp 30.000 atau 1% order).',
    enabled: false,
    feeMode: 'flat',
    flatFee: 15000,
    percentRate: 1,
  },
  {
    moduleId: 'leluhurqu_export',
    moduleName: 'LeluhurQu (Print & Download)',
    triggerLabel: 'Cetak Poster A0-A4, Buku PDF & Ekspor Data',
    description: 'Biaya cetak/download paket dokumen silsilah keluarga beresolusi tinggi.',
    enabled: false,
    feeMode: 'flat',
    flatFee: 10000,
    percentRate: 1,
  },
  {
    moduleId: 'rtqu_iuran',
    moduleName: 'RTQu (Bayar Iuran Warga)',
    triggerLabel: 'Pembayaran Iuran Bulanan & Kas RT',
    description: 'Akumulasi platform 1% per transaksi iuran atau tarif flat Rp 2.000 – Rp 30.000.',
    enabled: false,
    feeMode: 'percent_1',
    flatFee: 2500,
    percentRate: 1,
  },
  {
    moduleId: 'muamalahqu_tx',
    moduleName: 'MuamalahQu (Marketplace)',
    triggerLabel: 'Checkout Pesanan Warga',
    description: 'Akumulasi komisi 1% dari total belanja atau biaya layanan flat per checkout.',
    enabled: false,
    feeMode: 'percent_1',
    flatFee: 2000,
    percentRate: 1,
  },
  {
    moduleId: 'usahaqu_pro',
    moduleName: 'UsahaQu & Modular POS',
    triggerLabel: 'Aktivasi Paket Kasir Voice AI & Ekspor',
    description: 'Langganan opsional pemilik warung/UMKM (default OFF agar UMKM mudah onboarding).',
    enabled: false,
    feeMode: 'flat',
    flatFee: 25000,
    percentRate: 1,
  },
  {
    moduleId: 'siagaqu_pro',
    moduleName: 'SiagaQu Komunitas Perusahaan',
    triggerLabel: 'Lingkaran Darurat Perusahaan / Instansi',
    description: 'Khusus mode perusahaan. SiagaQu Umum RT & Pribadi dasar tetap gratis untuk keselamatan.',
    enabled: false,
    feeMode: 'flat',
    flatFee: 20000,
    percentRate: 1,
  },
];

const DEFAULT_QRIS_CONFIG: DeveloperQrisConfig = {
  merchantName: 'WargaQu Developer Official',
  bankOrWalletLabel: 'QRIS All-Payment (Menyusul Upload Resmi)',
  accountInfo: 'usahaqu2026@gmail.com',
  nmid: 'ID-MENYUSUL-2026',
  qrisImageDataUrl: '',
  minSettlementAmount: 25000,
  qrisPendingNote:
    'QRIS Developer resmi menyusul. Biaya modul & 1% transaksi tetap tercatat di saldo akumulasi.',
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

function saveJson<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

export const MonetizationService = {
  getRules(): ModuleMonetizationRule[] {
    const saved = loadJson<ModuleMonetizationRule[] | null>(RULES_KEY, null);
    if (!saved || !Array.isArray(saved) || saved.length === 0) {
      return DEFAULT_RULES;
    }
    return DEFAULT_RULES.map(def => {
      const found = saved.find(s => s.moduleId === def.moduleId);
      return found ? { ...def, ...found } : def;
    });
  },

  getRule(moduleId: MonetizableModuleId): ModuleMonetizationRule {
    return this.getRules().find(r => r.moduleId === moduleId) || DEFAULT_RULES[0];
  },

  isAnyRuleEnabled(): boolean {
    return this.getRules().some(r => r.enabled);
  },

  updateRule(
    moduleId: MonetizableModuleId,
    patch: Partial<ModuleMonetizationRule>
  ): ModuleMonetizationRule[] {
    const rules = this.getRules();
    const next = rules.map(r => {
      if (r.moduleId !== moduleId) return r;
      const clampedFlat =
        patch.flatFee !== undefined
          ? Math.min(30000, Math.max(2000, Math.round(patch.flatFee)))
          : r.flatFee;
      return {
        ...r,
        ...patch,
        flatFee: clampedFlat,
        percentRate: 1,
      };
    });
    saveJson(RULES_KEY, next);
    const updatedRule = next.find(r => r.moduleId === moduleId);
    if (updatedRule) {
      ZeroTrustService.appendAudit(
        'Admin Zero Trust',
        `Monetisasi ${updatedRule.moduleName}`,
        `${updatedRule.enabled ? 'ON' : 'OFF'} · Mode: ${updatedRule.feeMode} · Flat Rp ${updatedRule.flatFee.toLocaleString('id-ID')}`,
        'info'
      );
    }
    emitMonetizationSync();
    RealtimeRelayService.publish('admin:policy', 'admin:monetize_rules', next);
    return next;
  },

  applyRemoteRules(remoteRules: ModuleMonetizationRule[]): void {
    if (!Array.isArray(remoteRules) || remoteRules.length === 0) return;
    const merged = DEFAULT_RULES.map(def => {
      const found = remoteRules.find(r => r.moduleId === def.moduleId);
      if (!found) return def;
      return {
        ...def,
        enabled: Boolean(found.enabled),
        feeMode: found.feeMode || def.feeMode,
        flatFee: Math.min(30000, Math.max(2000, Number(found.flatFee) || def.flatFee)),
        percentRate: 1,
      };
    });
    saveJson(RULES_KEY, merged);
    emitMonetizationSync();
  },

  isProtectedLifeSafetyScope(scope: 'umum_rt' | 'pribadi_hp' | 'keluarga' | 'perusahaan'): boolean {
    // SiagaQu Darurat Nyawa (Umum RT, Cari HP Hilang & Keluarga) selalu GRATIS permanen
    return scope === 'umum_rt' || scope === 'pribadi_hp' || scope === 'keluarga';
  },

  calculateFee(
    moduleId: MonetizableModuleId,
    grossAmount = 0
  ): {
    enabled: boolean;
    feeAmount: number;
    label: string;
    rule: ModuleMonetizationRule;
  } {
    const rule = this.getRule(moduleId);
    const govFree = AccountGovernanceService.isCurrentUserFreeForModule(moduleId);
    if (govFree.free) {
      return {
        enabled: false,
        feeAmount: 0,
        label: govFree.reason || 'Gratis (Akses Free Admin / Komunitas)',
        rule,
      };
    }
    if (!rule.enabled) {
      return { enabled: false, feeAmount: 0, label: 'Gratis (Monetisasi OFF)', rule };
    }
    const percentPart = Math.max(0, Math.round((grossAmount * rule.percentRate) / 100));
    let feeAmount = 0;
    let label = '';

    if (rule.feeMode === 'flat') {
      feeAmount = rule.flatFee;
      label = `Tarif Modular Rp ${rule.flatFee.toLocaleString('id-ID')}`;
    } else if (rule.feeMode === 'percent_1') {
      feeAmount = grossAmount > 0 ? Math.max(500, percentPart) : rule.flatFee;
      label = `Akumulasi 1% (${grossAmount > 0 ? `dari Rp ${grossAmount.toLocaleString('id-ID')}` : 'Min'})`;
    } else {
      feeAmount = rule.flatFee + percentPart;
      label = `Hybrid Rp ${rule.flatFee.toLocaleString('id-ID')} + 1%`;
    }

    return { enabled: true, feeAmount, label, rule };
  },

  // Unlock tracking for pass-based modules (AreaQu Sewa Lapak & LeluhurQu Print/Download)
  hasActiveUnlock(moduleId: MonetizableModuleId): boolean {
    const govFree = AccountGovernanceService.isCurrentUserFreeForModule(moduleId);
    if (govFree.free) return true;
    const rule = this.getRule(moduleId);
    if (!rule.enabled) return true;
    const acc = AuthService.getAccount();
    const userKey = `${acc?.email || 'guest'}::${moduleId}`;
    const unlocks = loadJson<Record<string, string>>(UNLOCKS_KEY, {});
    return Boolean(unlocks[userKey]);
  },

  grantUnlock(moduleId: MonetizableModuleId): void {
    const acc = AuthService.getAccount();
    const userKey = `${acc?.email || 'guest'}::${moduleId}`;
    const unlocks = loadJson<Record<string, string>>(UNLOCKS_KEY, {});
    unlocks[userKey] = new Date().toISOString();
    saveJson(UNLOCKS_KEY, unlocks);
    emitMonetizationSync();
  },

  revokeUnlock(moduleId: MonetizableModuleId): void {
    const acc = AuthService.getAccount();
    const userKey = `${acc?.email || 'guest'}::${moduleId}`;
    const unlocks = loadJson<Record<string, string>>(UNLOCKS_KEY, {});
    delete unlocks[userKey];
    saveJson(UNLOCKS_KEY, unlocks);
    emitMonetizationSync();
  },

  recordCharge(params: {
    moduleId: MonetizableModuleId;
    actionLabel: string;
    grossAmount: number;
    unlockModule?: boolean;
  }): MonetizationLedgerEntry | null {
    const calc = this.calculateFee(params.moduleId, params.grossAmount);
    if (!calc.enabled || calc.feeAmount <= 0) return null;

    const acc = AuthService.getAccount();
    const entry: MonetizationLedgerEntry = {
      id: `MON-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      moduleId: params.moduleId,
      moduleName: calc.rule.moduleName,
      actionLabel: params.actionLabel,
      grossAmount: params.grossAmount,
      feeAmount: calc.feeAmount,
      feeTypeLabel: calc.label,
      userEmail: acc?.email || 'tamu@wargaqu.id',
      userPhone: acc?.phone || '-',
      status: 'pending_developer',
      createdAt: new Date().toISOString(),
    };

    const list = [entry, ...this.getLedger()];
    saveJson(LEDGER_KEY, list);

    if (params.unlockModule) {
      this.grantUnlock(params.moduleId);
    }

    emitMonetizationSync();
    return entry;
  },

  getLedger(): MonetizationLedgerEntry[] {
    return loadJson<MonetizationLedgerEntry[]>(LEDGER_KEY, []);
  },

  getQrisConfig(): DeveloperQrisConfig {
    const saved = loadJson<Partial<DeveloperQrisConfig>>(QRIS_CFG_KEY, {});
    return { ...DEFAULT_QRIS_CONFIG, ...saved };
  },

  updateQrisConfig(patch: Partial<DeveloperQrisConfig>): DeveloperQrisConfig {
    const next = { ...this.getQrisConfig(), ...patch };
    saveJson(QRIS_CFG_KEY, next);
    ZeroTrustService.appendAudit(
      'Admin Zero Trust',
      'Update Konfigurasi QRIS Developer',
      `${next.merchantName} · ${next.qrisImageDataUrl ? 'QRIS Terpasang' : 'Menunggu QRIS Resmi'}`,
      'info'
    );
    emitMonetizationSync();
    return next;
  },

  getSettlements(): DeveloperSettlement[] {
    return loadJson<DeveloperSettlement[]>(SETTLEMENTS_KEY, []);
  },

  getSummary() {
    const ledger = this.getLedger();
    const pendingEntries = ledger.filter(e => e.status === 'pending_developer');
    const settledEntries = ledger.filter(e => e.status === 'settled');
    const pendingTotal = pendingEntries.reduce((acc, e) => acc + e.feeAmount, 0);
    const settledTotal = settledEntries.reduce((acc, e) => acc + e.feeAmount, 0);
    const grossTotal = ledger.reduce((acc, e) => acc + e.grossAmount, 0);

    const byModule = this.getRules().map(rule => {
      const items = ledger.filter(e => e.moduleId === rule.moduleId);
      return {
        moduleId: rule.moduleId,
        moduleName: rule.moduleName,
        enabled: rule.enabled,
        count: items.length,
        pending: items
          .filter(i => i.status === 'pending_developer')
          .reduce((s, i) => s + i.feeAmount, 0),
        settled: items
          .filter(i => i.status === 'settled')
          .reduce((s, i) => s + i.feeAmount, 0),
        totalFee: items.reduce((s, i) => s + i.feeAmount, 0),
      };
    });

    return {
      pendingTotal,
      settledTotal,
      grandTotal: pendingTotal + settledTotal,
      grossTotal,
      pendingCount: pendingEntries.length,
      totalCount: ledger.length,
      byModule,
    };
  },

  settlePendingToDeveloper(qrisReferenceInput: string): DeveloperSettlement | null {
    const ledger = this.getLedger();
    const pending = ledger.filter(e => e.status === 'pending_developer');
    if (pending.length === 0) return null;

    const totalAmount = pending.reduce((sum, e) => sum + e.feeAmount, 0);
    const cfg = this.getQrisConfig();
    const settlement: DeveloperSettlement = {
      id: `SET-${Date.now().toString(36).toUpperCase()}`,
      totalAmount,
      entriesCount: pending.length,
      qrisReference:
        qrisReferenceInput.trim() ||
        `QRIS-DEV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      destinationName: cfg.merchantName,
      settledAt: new Date().toISOString(),
    };

    const nextLedger = ledger.map(e =>
      e.status === 'pending_developer'
        ? { ...e, status: 'settled' as const, settlementId: settlement.id }
        : e
    );

    saveJson(LEDGER_KEY, nextLedger);
    saveJson(SETTLEMENTS_KEY, [settlement, ...this.getSettlements()]);

    ZeroTrustService.appendAudit(
      'Admin Zero Trust',
      'Setoran Akumulasi TF QRIS Developer',
      `Rp ${totalAmount.toLocaleString('id-ID')} (${pending.length} entri) · Ref: ${settlement.qrisReference}`,
      'info'
    );
    emitMonetizationSync();
    return settlement;
  },
};
