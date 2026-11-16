import { AuthService } from './authService';

export type DompetWalletKind = 'cash' | 'bank' | 'ewallet' | 'tabungan';
export type DompetTxType = 'masuk' | 'keluar' | 'transfer';

export const DOMPET_INCOME_CATEGORIES = [
  'Gaji',
  'Bonus & Lembur',
  'Usaha & Sampingan',
  'Pemasukan Lainnya',
] as const;

export const DOMPET_EXPENSE_CATEGORIES = [
  'Belanja Harian',
  'Rumah & Tagihan',
  'Jajan Bocah',
  'Ongkos Kerja',
  'Makan & Minum',
  'Kesehatan & Obat',
  'Keluarga & Sosial',
  'Pengeluaran Lainnya',
] as const;

export const DOMPET_ALL_CATEGORIES = [
  ...DOMPET_INCOME_CATEGORIES,
  ...DOMPET_EXPENSE_CATEGORIES,
  'Pindah Kantong',
] as const;

export interface DompetWallet {
  id: string;
  name: string;
  kind: DompetWalletKind;
  balance: number;
  bankOrProvider?: string;
  updatedAt: string;
}

export interface DompetTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: DompetTxType;
  category: string;
  title: string;
  amount: number;
  walletId: string;
  toWalletId?: string;
  note?: string;
  source: 'voice' | 'smart_text' | 'manual';
  createdAt: string;
}

export interface DompetBudget {
  category: string;
  monthlyLimit: number;
}

export interface DompetPrivacySettings {
  hideBalanceByDefault: boolean;
  pinEnabled: boolean;
  pinHash?: string; // simple salted client hash so raw PIN isn't plain
}

export interface DompetParsedDraftItem {
  localId: string;
  type: 'masuk' | 'keluar';
  category: string;
  title: string;
  amount: number;
  walletId: string;
  note: string;
}

interface DompetStoreState {
  version: 1;
  ownerScope: string;
  wallets: DompetWallet[];
  transactions: DompetTransaction[];
  budgets: DompetBudget[];
  privacy: DompetPrivacySettings;
}

export const DOMPETQU_SYNC_EVENT = 'wargaqu-dompetqu-sync';
const STORAGE_PREFIX = 'wargaqu_dompetqu_v1_';

function getOwnerScopeKey(): string {
  const acc = AuthService.getAccount();
  if (!acc || !acc.email) return 'guest';
  return acc.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function getStorageKey(): string {
  return `${STORAGE_PREFIX}${getOwnerScopeKey()}`;
}

function emitSync() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DOMPETQU_SYNC_EVENT));
  }
}

function simplePinDigest(pin: string, scope: string): string {
  const input = `${scope}::dompetqu::${pin.trim()}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `dq_${(h >>> 0).toString(36)}`;
}

function createDefaultState(scope: string): DompetStoreState {
  const nowIso = new Date().toISOString();
  return {
    version: 1,
    ownerScope: scope,
    wallets: [
      {
        id: 'wallet-cash',
        name: 'Dompet Cash',
        kind: 'cash',
        balance: 0,
        bankOrProvider: 'Tunai Harian',
        updatedAt: nowIso,
      },
      {
        id: 'wallet-atm',
        name: 'Tabungan ATM / Bank',
        kind: 'bank',
        balance: 0,
        bankOrProvider: 'Rekening Utama',
        updatedAt: nowIso,
      },
      {
        id: 'wallet-ewallet',
        name: 'E-Wallet / QRIS',
        kind: 'ewallet',
        balance: 0,
        bankOrProvider: 'Saldo Digital',
        updatedAt: nowIso,
      },
    ],
    transactions: [],
    budgets: [
      { category: 'Belanja Harian', monthlyLimit: 0 },
      { category: 'Rumah & Tagihan', monthlyLimit: 0 },
      { category: 'Jajan Bocah', monthlyLimit: 0 },
      { category: 'Ongkos Kerja', monthlyLimit: 0 },
      { category: 'Makan & Minum', monthlyLimit: 0 },
    ],
    privacy: {
      hideBalanceByDefault: true,
      pinEnabled: false,
    },
  };
}

function loadState(): DompetStoreState {
  const scope = getOwnerScopeKey();
  const key = `${STORAGE_PREFIX}${scope}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return createDefaultState(scope);
    }
    const parsed = JSON.parse(raw) as Partial<DompetStoreState>;
    const def = createDefaultState(scope);
    return {
      version: 1,
      ownerScope: scope,
      wallets: Array.isArray(parsed.wallets) && parsed.wallets.length > 0 ? parsed.wallets : def.wallets,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      budgets: Array.isArray(parsed.budgets) && parsed.budgets.length > 0 ? parsed.budgets : def.budgets,
      privacy: {
        hideBalanceByDefault:
          typeof parsed.privacy?.hideBalanceByDefault === 'boolean'
            ? parsed.privacy.hideBalanceByDefault
            : true,
        pinEnabled: Boolean(parsed.privacy?.pinEnabled && parsed.privacy?.pinHash),
        pinHash: parsed.privacy?.pinHash,
      },
    };
  } catch {
    return createDefaultState(scope);
  }
}

function saveState(state: DompetStoreState) {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
    emitSync();
  } catch {
    // ignore quota errors
  }
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nowHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseIndonesianAmountFragment(rawText: string): number {
  const text = rawText.toLowerCase().replace(/\brp\.?\s*/g, ' ').trim();

  // Slang & spoken shorthand
  if (/\bsetengah\s+juta\b/.test(text)) return 500000;
  if (/\bsejuta\b|\bsatu\s+juta\b/.test(text)) {
    const extraRb = text.match(/juta\s*(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|ratus)?/);
    if (extraRb) {
      const sub = parseFloat(extraRb[1].replace(',', '.'));
      if (!Number.isNaN(sub)) {
        return Math.round(1000000 + (sub < 1000 ? sub * 1000 : sub));
      }
    }
    return 1000000;
  }
  if (/\bgocap\b|\bgoban\b/.test(text)) return 50000;
  if (/\bceban\b/.test(text)) return 10000;
  if (/\bnoban\b/.test(text)) return 20000;
  if (/\bseceng\b|\bseribu\b/.test(text)) return 1000;

  // Written Indonesian numbers like "dua puluh lima ribu", "tiga ratus ribu", "lima juta"
  const unitWords: Record<string, number> = {
    satu: 1,
    se: 1,
    dua: 2,
    tiga: 3,
    empat: 4,
    lima: 5,
    enam: 6,
    tujuh: 7,
    delapan: 8,
    sembilan: 9,
    sepuluh: 10,
    sebelas: 11,
  };
  const spokenMatch = text.match(
    /\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas)(?:\s+puluh(?:\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?|\s+ratus(?:\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)(?:\s+puluh)?)?)?\s*(juta|jt|ribu|rb)\b/
  );
  if (spokenMatch) {
    let base = unitWords[spokenMatch[1]] || 0;
    if (/puluh/.test(spokenMatch[0])) {
      base *= 10;
      if (spokenMatch[2]) base += unitWords[spokenMatch[2]] || 0;
    } else if (/ratus/.test(spokenMatch[0])) {
      base *= 100;
      if (spokenMatch[3]) base += (unitWords[spokenMatch[3]] || 0) * (/puluh/.test(spokenMatch[0]) ? 10 : 1);
    }
    const mult = spokenMatch[4] === 'juta' || spokenMatch[4] === 'jt' ? 1000000 : 1000;
    if (base > 0) return base * mult;
  }

  // Numeric patterns: "5 juta", "1,5jt", "150rb", "75.000", "25000"
  const jtMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    if (!Number.isNaN(val)) return Math.round(val * 1000000);
  }

  const rbMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ribu|rb|k)\b/);
  if (rbMatch) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    if (!Number.isNaN(val)) return Math.round(val * 1000);
  }

  const formattedNum = text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
  if (formattedNum) {
    const digits = formattedNum[1].replace(/[.,]/g, '');
    const n = parseInt(digits, 10);
    if (!Number.isNaN(n)) return n;
  }

  const plainNum = text.match(/\b(\d{3,11})\b/);
  if (plainNum) {
    const n = parseInt(plainNum[1], 10);
    if (!Number.isNaN(n)) return n;
  }

  return 0;
}

function detectWalletForText(textLower: string, type: 'masuk' | 'keluar', wallets: DompetWallet[]): string {
  const byKind = (kind: DompetWalletKind) => wallets.find(w => w.kind === kind)?.id;
  if (/\b(atm|bank|rekening|bca|bri|bni|mandiri|bsi|transfer|tabungan)\b/.test(textLower)) {
    return byKind('bank') || wallets[0]?.id || 'wallet-atm';
  }
  if (/\b(gopay|ovo|dana|shopeepay|qris|ewallet|e-wallet|linkaja)\b/.test(textLower)) {
    return byKind('ewallet') || wallets[0]?.id || 'wallet-ewallet';
  }
  if (/\b(cash|tunai|dompet|uang saku|kantong)\b/.test(textLower)) {
    return byKind('cash') || wallets[0]?.id || 'wallet-cash';
  }
  if (type === 'masuk' && /\b(gaji|bonus|thr|transferan)\b/.test(textLower)) {
    return byKind('bank') || wallets[0]?.id || 'wallet-atm';
  }
  return byKind('cash') || wallets[0]?.id || 'wallet-cash';
}

function classifyLocalSegment(segment: string): {
  type: 'masuk' | 'keluar';
  category: string;
  title: string;
} {
  const lower = segment.toLowerCase();

  if (/\b(gaji|gajian|upah|honor)\b/.test(lower)) {
    return { type: 'masuk', category: 'Gaji', title: 'Gaji / Penghasilan' };
  }
  if (/\b(bonus|lembur|insentif|thr|komisi)\b/.test(lower)) {
    return { type: 'masuk', category: 'Bonus & Lembur', title: 'Bonus & Lembur' };
  }
  if (/\b(omset|jualan|dagang|usaha|dapat uang|terima uang|pemasukan|masuk)\b/.test(lower)) {
    return { type: 'masuk', category: 'Usaha & Sampingan', title: 'Pemasukan Usaha / Lainnya' };
  }

  if (/\b(jajan|bocah|anak|sekolah|saku anak|mainan|eskrim)\b/.test(lower)) {
    return { type: 'keluar', category: 'Jajan Bocah', title: 'Jajan Bocah' };
  }
  if (/\b(ongkos|bensin|bbm|parkir|tol|ojol|gojek|grab|kereta|busway|transport|kerja)\b/.test(lower)) {
    return { type: 'keluar', category: 'Ongkos Kerja', title: 'Ongkos Kerja & Transport' };
  }
  if (/\b(rumah|kontrakan|kos|cicilan|kpr|listrik|token|pln|air|pdam|wifi|internet|gas|elpiji|ipl|kebersihan)\b/.test(lower)) {
    return { type: 'keluar', category: 'Rumah & Tagihan', title: 'Keperluan Rumah & Tagihan' };
  }
  if (/\b(makan|minum|sarapan|siang|malam|warteg|bakso|kopi|nasi|gorengan|lauk|snack)\b/.test(lower)) {
    return { type: 'keluar', category: 'Makan & Minum', title: 'Makan & Minum' };
  }
  if (/\b(belanja|pasar|sayur|beras|sembako|supermarket|minimarket|indomaret|alfamart|sabun|dapur)\b/.test(lower)) {
    return { type: 'keluar', category: 'Belanja Harian', title: 'Belanja Harian' };
  }
  if (/\b(obat|dokter|klinik|apotek|sakit|kesehatan|vitamin)\b/.test(lower)) {
    return { type: 'keluar', category: 'Kesehatan & Obat', title: 'Kesehatan & Obat' };
  }
  if (/\b(sedekah|infaq|zakat|iuran|rt|arisan|kondangan|sumbangan|keluarga|orang tua)\b/.test(lower)) {
    return { type: 'keluar', category: 'Keluarga & Sosial', title: 'Keluarga & Sosial' };
  }

  // Extract clean label words without numbers
  const stripped = segment
    .replace(/\b(?:rp\.?\s*)?\d+(?:[.,]\d+)*\s*(?:juta|jt|ribu|rb|k)?\b/gi, '')
    .replace(/\b(cash|tunai|atm|bank|rekening|ewallet|gopay|ovo|dana|pakai|dari|masuk|ke)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanTitle = stripped
    ? stripped.charAt(0).toUpperCase() + stripped.slice(1, 36)
    : 'Catatan Pengeluaran';

  return { type: 'keluar', category: 'Pengeluaran Lainnya', title: cleanTitle };
}

export const DompetQuStorage = {
  getOwnerLabel(): string {
    const acc = AuthService.getAccount();
    return acc ? `${AuthService.getDisplayName(acc)} (${acc.email})` : 'Tamu Perangkat Ini';
  },

  getWallets(): DompetWallet[] {
    return loadState().wallets;
  },

  getTotalCombinedBalance(): number {
    return loadState().wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
  },

  getTransactions(): DompetTransaction[] {
    return loadState().transactions;
  },

  getBudgets(): DompetBudget[] {
    return loadState().budgets;
  },

  getPrivacySettings(): DompetPrivacySettings {
    return loadState().privacy;
  },

  updatePrivacySettings(patch: { hideBalanceByDefault?: boolean; newPin?: string | null }): void {
    const state = loadState();
    const scope = getOwnerScopeKey();
    const nextPrivacy: DompetPrivacySettings = { ...state.privacy };
    if (typeof patch.hideBalanceByDefault === 'boolean') {
      nextPrivacy.hideBalanceByDefault = patch.hideBalanceByDefault;
    }
    if (patch.newPin === null) {
      nextPrivacy.pinEnabled = false;
      delete nextPrivacy.pinHash;
    } else if (typeof patch.newPin === 'string' && patch.newPin.trim().length >= 4) {
      nextPrivacy.pinEnabled = true;
      nextPrivacy.pinHash = simplePinDigest(patch.newPin, scope);
    }
    saveState({ ...state, privacy: nextPrivacy });
  },

  verifyPin(pin: string): boolean {
    const state = loadState();
    if (!state.privacy.pinEnabled || !state.privacy.pinHash) return true;
    const scope = getOwnerScopeKey();
    return simplePinDigest(pin, scope) === state.privacy.pinHash;
  },

  addWallet(input: {
    name: string;
    kind: DompetWalletKind;
    initialBalance: number;
    bankOrProvider?: string;
  }): DompetWallet {
    const state = loadState();
    const wallet: DompetWallet = {
      id: `wallet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: input.name.trim() || 'Kantong Baru',
      kind: input.kind,
      balance: Math.round(Number(input.initialBalance) || 0),
      bankOrProvider: input.bankOrProvider?.trim() || '',
      updatedAt: new Date().toISOString(),
    };
    saveState({ ...state, wallets: [...state.wallets, wallet] });
    return wallet;
  },

  updateWallet(walletId: string, patch: { name?: string; kind?: DompetWalletKind; balance?: number; bankOrProvider?: string }): void {
    const state = loadState();
    const nextWallets = state.wallets.map(w => {
      if (w.id !== walletId) return w;
      return {
        ...w,
        name: patch.name !== undefined ? patch.name.trim() || w.name : w.name,
        kind: patch.kind !== undefined ? patch.kind : w.kind,
        balance: patch.balance !== undefined ? Math.round(Number(patch.balance) || 0) : w.balance,
        bankOrProvider: patch.bankOrProvider !== undefined ? patch.bankOrProvider : w.bankOrProvider,
        updatedAt: new Date().toISOString(),
      };
    });
    saveState({ ...state, wallets: nextWallets });
  },

  deleteWallet(walletId: string): boolean {
    const state = loadState();
    if (state.wallets.length <= 1) return false;
    saveState({
      ...state,
      wallets: state.wallets.filter(w => w.id !== walletId),
    });
    return true;
  },

  addTransactionsBatch(
    items: Array<{
      type: 'masuk' | 'keluar';
      category: string;
      title: string;
      amount: number;
      walletId: string;
      note?: string;
      date?: string;
      source?: 'voice' | 'smart_text' | 'manual';
    }>
  ): number {
    const valid = items.filter(i => (Number(i.amount) || 0) > 0 && i.title.trim());
    if (valid.length === 0) return 0;

    const state = loadState();
    const nowIso = new Date().toISOString();
    const fallbackWalletId = state.wallets[0]?.id || 'wallet-cash';
    const walletBalances = new Map<string, number>();
    state.wallets.forEach(w => walletBalances.set(w.id, w.balance));

    const newTxs: DompetTransaction[] = valid.map((item, idx) => {
      const targetWalletId = walletBalances.has(item.walletId) ? item.walletId : fallbackWalletId;
      const amt = Math.round(Math.abs(Number(item.amount) || 0));
      const curBal = walletBalances.get(targetWalletId) || 0;
      walletBalances.set(targetWalletId, item.type === 'masuk' ? curBal + amt : curBal - amt);

      return {
        id: `dtx-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        date: item.date || todayYmd(),
        time: nowHm(),
        type: item.type,
        category: item.category || (item.type === 'masuk' ? 'Pemasukan Lainnya' : 'Pengeluaran Lainnya'),
        title: item.title.trim(),
        amount: amt,
        walletId: targetWalletId,
        note: item.note?.trim() || '',
        source: item.source || 'voice',
        createdAt: nowIso,
      };
    });

    const nextWallets = state.wallets.map(w => ({
      ...w,
      balance: walletBalances.get(w.id) ?? w.balance,
      updatedAt: nowIso,
    }));

    saveState({
      ...state,
      wallets: nextWallets,
      transactions: [...newTxs, ...state.transactions],
    });
    return newTxs.length;
  },

  transferBetweenWallets(fromWalletId: string, toWalletId: string, amount: number, note?: string): boolean {
    const cleanAmt = Math.round(Math.abs(Number(amount) || 0));
    if (cleanAmt <= 0 || fromWalletId === toWalletId) return false;
    const state = loadState();
    const fromW = state.wallets.find(w => w.id === fromWalletId);
    const toW = state.wallets.find(w => w.id === toWalletId);
    if (!fromW || !toW) return false;

    const nowIso = new Date().toISOString();
    const tx: DompetTransaction = {
      id: `dtx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      date: todayYmd(),
      time: nowHm(),
      type: 'transfer',
      category: 'Pindah Kantong',
      title: `${fromW.name} -> ${toW.name}`,
      amount: cleanAmt,
      walletId: fromWalletId,
      toWalletId,
      note: note?.trim() || 'Pindah saldo antar kantong',
      source: 'manual',
      createdAt: nowIso,
    };

    const nextWallets = state.wallets.map(w => {
      if (w.id === fromWalletId) return { ...w, balance: w.balance - cleanAmt, updatedAt: nowIso };
      if (w.id === toWalletId) return { ...w, balance: w.balance + cleanAmt, updatedAt: nowIso };
      return w;
    });

    saveState({
      ...state,
      wallets: nextWallets,
      transactions: [tx, ...state.transactions],
    });
    return true;
  },

  deleteTransaction(txId: string): void {
    const state = loadState();
    const target = state.transactions.find(t => t.id === txId);
    if (!target) return;
    const nowIso = new Date().toISOString();

    const nextWallets = state.wallets.map(w => {
      if (target.type === 'masuk' && w.id === target.walletId) {
        return { ...w, balance: w.balance - target.amount, updatedAt: nowIso };
      }
      if (target.type === 'keluar' && w.id === target.walletId) {
        return { ...w, balance: w.balance + target.amount, updatedAt: nowIso };
      }
      if (target.type === 'transfer') {
        if (w.id === target.walletId) return { ...w, balance: w.balance + target.amount, updatedAt: nowIso };
        if (w.id === target.toWalletId) return { ...w, balance: w.balance - target.amount, updatedAt: nowIso };
      }
      return w;
    });

    saveState({
      ...state,
      wallets: nextWallets,
      transactions: state.transactions.filter(t => t.id !== txId),
    });
  },

  saveBudget(category: string, monthlyLimit: number): void {
    const state = loadState();
    const cleanLimit = Math.max(0, Math.round(Number(monthlyLimit) || 0));
    const exists = state.budgets.some(b => b.category === category);
    const nextBudgets = exists
      ? state.budgets.map(b => (b.category === category ? { ...b, monthlyLimit: cleanLimit } : b))
      : [...state.budgets, { category, monthlyLimit: cleanLimit }];
    saveState({ ...state, budgets: nextBudgets });
  },

  resetAllData(): void {
    const scope = getOwnerScopeKey();
    saveState(createDefaultState(scope));
  },

  parseSpeechLocalFallback(transcript: string, wallets?: DompetWallet[]): DompetParsedDraftItem[] {
    const activeWallets = wallets && wallets.length > 0 ? wallets : this.getWallets();
    const segments = transcript
      .split(/(?:,|\n|;|\bdan\s+(?=[a-zA-Z])|\blalu\b|\bterus\b)/i)
      .map(s => s.trim())
      .filter(s => s.length >= 2);

    const parsed: DompetParsedDraftItem[] = [];
    segments.forEach((seg, idx) => {
      const amount = parseIndonesianAmountFragment(seg);
      const cls = classifyLocalSegment(seg);
      const walletId = detectWalletForText(seg.toLowerCase(), cls.type, activeWallets);
      // Avoid empty filler segments that have neither clear amount nor recognizable intent
      if (amount === 0 && segments.length > 1 && seg.split(/\s+/).length < 2) return;
      parsed.push({
        localId: `draft-${Date.now()}-${idx}`,
        type: cls.type,
        category: cls.category,
        title: cls.title,
        amount,
        walletId,
        note: seg,
      });
    });

    return parsed;
  },

  async parseSpeechSmart(
    transcript: string,
    wallets?: DompetWallet[]
  ): Promise<{ items: DompetParsedDraftItem[]; usedAi: boolean }> {
    const activeWallets = wallets && wallets.length > 0 ? wallets : this.getWallets();
    const cleanText = transcript.trim();
    if (!cleanText) return { items: [], usedAi: false };

    try {
      const resp = await fetch('/api/dompetqu/parse-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: cleanText,
          wallets: activeWallets.map(w => ({ id: w.id, name: w.name, kind: w.kind })),
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          ok?: boolean;
          items?: Array<{
            type?: string;
            category?: string;
            title?: string;
            amount?: number;
            walletId?: string;
            note?: string;
          }>;
        };
        if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
          const validIds = new Set(activeWallets.map(w => w.id));
          const fallbackId = activeWallets[0]?.id || 'wallet-cash';
          const mapped: DompetParsedDraftItem[] = data.items.map((it, idx) => ({
            localId: `ai-${Date.now()}-${idx}`,
            type: it.type === 'masuk' ? 'masuk' : 'keluar',
            category:
              typeof it.category === 'string' && it.category.trim()
                ? it.category.trim()
                : it.type === 'masuk'
                ? 'Pemasukan Lainnya'
                : 'Pengeluaran Lainnya',
            title:
              typeof it.title === 'string' && it.title.trim()
                ? it.title.trim()
                : 'Catatan DompetQu',
            amount: Math.max(0, Math.round(Number(it.amount) || 0)),
            walletId: it.walletId && validIds.has(it.walletId) ? it.walletId : fallbackId,
            note: typeof it.note === 'string' ? it.note : '',
          }));
          return { items: mapped, usedAi: true };
        }
      }
    } catch {
      // Fall back smoothly to deterministic local parser
    }

    return {
      items: this.parseSpeechLocalFallback(cleanText, activeWallets),
      usedAi: false,
    };
  },

  exportTransactionsCsv(): void {
    const state = loadState();
    const walletMap = new Map(state.wallets.map(w => [w.id, w.name]));
    const rows = [
      ['Tanggal', 'Jam', 'Tipe', 'Judul', 'Kategori', 'Kantong Sumber', 'Kantong Tujuan', 'Nominal (Rp)', 'Catatan'],
      ...state.transactions.map(tx => [
        tx.date,
        tx.time,
        tx.type,
        `"${(tx.title || '').replace(/"/g, '""')}"`,
        tx.category,
        `"${(walletMap.get(tx.walletId) || tx.walletId).replace(/"/g, '""')}"`,
        tx.toWalletId ? `"${(walletMap.get(tx.toWalletId) || tx.toWalletId).replace(/"/g, '""')}"` : '-',
        String(tx.amount),
        `"${(tx.note || '').replace(/"/g, '""')}"`,
      ]),
    ];
    const csv = '\ufeff' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dompetqu-pribadi-${todayYmd()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
