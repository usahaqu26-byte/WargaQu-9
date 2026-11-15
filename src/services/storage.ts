import { TableItem, MenuItem, Order, Ingredient, RestaurantProfile, PrinterConfig } from '../types';

import baksoUratImg from '../assets/images/bakso_urat_jumbo_1790260587825.jpg';
import baksoKomplitImg from '../assets/images/bakso_komplit_1790260605375.jpg';
import esTehImg from '../assets/images/es_teh_manis_1790260616776.jpg';
import esJerukImg from '../assets/images/es_jeruk_peras_1790260629539.jpg';

const STORAGE_KEYS = {
  TABLES: 'baksoqu_tables_v1',
  MENU: 'baksoqu_menu_v1',
  ACTIVE_ORDERS: 'baksoqu_active_orders_v1',
  HISTORY_TRANSACTIONS: 'baksoqu_history_v1',
  INGREDIENTS: 'baksoqu_ingredients_v1',
  PROFILE: 'baksoqu_profile_v1',
  PRINTER: 'baksoqu_printer_v1',
};

export const DEFAULT_PROFILE: RestaurantProfile = {
  name: 'UsahaQu POS',
  slogan: 'Aplikasi Kasir & Usaha Warga',
  address: '',
  phone: '',
  receiptHeader: 'Selamat Datang!',
  receiptFooter: 'Terima kasih atas kunjungan Anda.',
  currency: 'Rp',
};

export const DEFAULT_PRINTER: PrinterConfig = {
  paperSize: '58mm',
  autoPrintKitchen: true,
  autoPrintReceipt: true,
  connectedDeviceName: 'POS-58-BT (Thermal)',
  isSimulator: true,
};

export const DEFAULT_TABLES: TableItem[] = [];
export const DEFAULT_MENU: MenuItem[] = [];
export const DEFAULT_INGREDIENTS: Ingredient[] = [];

export const StorageService = {
  getTables(): TableItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.TABLES);
    if (!raw) {
      this.saveTables(DEFAULT_TABLES);
      return DEFAULT_TABLES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_TABLES;
    }
  },

  saveTables(tables: TableItem[]): void {
    localStorage.setItem(STORAGE_KEYS.TABLES, JSON.stringify(tables));
  },

  getMenu(): MenuItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MENU);
    if (!raw) {
      this.saveMenu(DEFAULT_MENU);
      return DEFAULT_MENU;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_MENU;
    }
  },

  saveMenu(menu: MenuItem[]): void {
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menu));
  },

  getActiveOrders(): Record<string, Order> {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_ORDERS);
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  saveActiveOrders(orders: Record<string, Order>): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_ORDERS, JSON.stringify(orders));
  },

  getHistory(): Order[] {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY_TRANSACTIONS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveHistory(history: Order[]): void {
    localStorage.setItem(STORAGE_KEYS.HISTORY_TRANSACTIONS, JSON.stringify(history));
  },

  addTransaction(order: Order): void {
    const history = this.getHistory();
    history.unshift(order);
    this.saveHistory(history);
  },

  getIngredients(): Ingredient[] {
    const raw = localStorage.getItem(STORAGE_KEYS.INGREDIENTS);
    if (!raw) {
      this.saveIngredients(DEFAULT_INGREDIENTS);
      return DEFAULT_INGREDIENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_INGREDIENTS;
    }
  },

  saveIngredients(items: Ingredient[]): void {
    localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(items));
  },

  getProfile(): RestaurantProfile {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) {
      this.saveProfile(DEFAULT_PROFILE);
      return DEFAULT_PROFILE;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile: RestaurantProfile): void {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  },

  getPrinterConfig(): PrinterConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.PRINTER);
    if (!raw) {
      this.savePrinterConfig(DEFAULT_PRINTER);
      return DEFAULT_PRINTER;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_PRINTER;
    }
  },

  savePrinterConfig(cfg: PrinterConfig): void {
    localStorage.setItem(STORAGE_KEYS.PRINTER, JSON.stringify(cfg));
  },
};
