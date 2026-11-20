import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Menu,
  ShoppingBag,
  Printer,
  Sparkles,
  Store,
  ChevronRight,
  Headphones,
  HelpCircle
} from 'lucide-react';
import { ModuleOnboardingService } from '../../services/moduleOnboardingService';

import { HeaderBar } from '../HeaderBar';
import { NavigationDrawer } from '../NavigationDrawer';
import { BottomNavBar } from '../BottomNavBar';
import { TableGrid } from '../kasir/TableGrid';
import { OrderBottomSheet } from '../kasir/OrderBottomSheet';
import { TableActionModal } from '../kasir/TableActionModal';
import { CheckoutModal } from '../kasir/CheckoutModal';
import { ReceiptModal } from '../kasir/ReceiptModal';
import { BahanView } from '../bahan/BahanView';
import { OmsetDashboard } from '../omset/OmsetDashboard';
import { LaporanView } from '../laporan/LaporanView';
import { SettingView } from '../setting/SettingView';
import { BluetoothModal } from '../BluetoothModal';
import { ModularQuView } from '../modularqu/ModularQuView';

import {
  TableItem,
  MenuItem,
  Order,
  OrderItem,
  OrderType,
  Ingredient,
  RestaurantProfile,
  PrinterConfig
} from '../../types';
import { StorageService } from '../../services/storage';
import { PrinterService } from '../../services/printer';
import { MonetizationService } from '../../services/monetizationService';

interface UsahaQuViewProps {
  onBackToWarga: () => void;
  onOpenModularQu?: () => void;
  onOpenBantuan?: () => void;
  initialMode?: 'resto' | 'modular';
  tables: TableItem[];
  setTables: React.Dispatch<React.SetStateAction<TableItem[]>>;
  menuList: MenuItem[];
  setMenuList: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  history: Order[];
  setHistory: React.Dispatch<React.SetStateAction<Order[]>>;
  activeOrders: Record<string, Order>;
  setActiveOrders: React.Dispatch<React.SetStateAction<Record<string, Order>>>;
  profile: RestaurantProfile;
  setProfile: React.Dispatch<React.SetStateAction<RestaurantProfile>>;
  printerConfig: PrinterConfig;
  setPrinterConfig: React.Dispatch<React.SetStateAction<PrinterConfig>>;
  showNotification: (msg: string) => void;
}

export const UsahaQuView: React.FC<UsahaQuViewProps> = ({
  onBackToWarga,
  onOpenModularQu,
  onOpenBantuan,
  initialMode = 'resto',
  tables,
  setTables,
  menuList,
  setMenuList,
  ingredients,
  setIngredients,
  history,
  setHistory,
  activeOrders,
  setActiveOrders,
  profile,
  setProfile,
  printerConfig,
  setPrinterConfig,
  showNotification,
}) => {
  // Unified POS Mode: Resto Qu (Bakso Qu) vs ModularQu (Voice AI Multi-Usaha)
  const [posMode, setPosMode] = useState<'resto' | 'modular'>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setPosMode(initialMode);
    }
  }, [initialMode]);

  // Navigation State inside POS
  const [activeTab, setActiveTab] = useState<string>('kasir');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState<boolean>(false);

  // Interactive Flow States
  const [selectedTableForAction, setSelectedTableForAction] = useState<TableItem | null>(null);
  const [orderSheetState, setOrderSheetState] = useState<{
    isOpen: boolean;
    orderType: OrderType;
    tableId?: string;
    tableName?: string;
    existingOrder?: Order | null;
  }>({
    isOpen: false,
    orderType: 'meja',
  });

  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [receiptModalState, setReceiptModalState] = useState<{
    isOpen: boolean;
    order: Order | null;
    isKitchenSlip?: boolean;
  }>({
    isOpen: false,
    order: null,
    isKitchenSlip: false,
  });

  // Reference hooks for Android / Browser Back Button
  const activeTabRef = useRef(activeTab);
  const isDrawerOpenRef = useRef(isDrawerOpen);
  const isBluetoothModalOpenRef = useRef(isBluetoothModalOpen);
  const selectedTableRef = useRef(selectedTableForAction);
  const orderSheetRef = useRef(orderSheetState);
  const checkoutOrderRef = useRef(checkoutOrder);
  const receiptModalRef = useRef(receiptModalState);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { isDrawerOpenRef.current = isDrawerOpen; }, [isDrawerOpen]);
  useEffect(() => { isBluetoothModalOpenRef.current = isBluetoothModalOpen; }, [isBluetoothModalOpen]);
  useEffect(() => { selectedTableRef.current = selectedTableForAction; }, [selectedTableForAction]);
  useEffect(() => { orderSheetRef.current = orderSheetState; }, [orderSheetState]);
  useEffect(() => { checkoutOrderRef.current = checkoutOrder; }, [checkoutOrder]);
  useEffect(() => { receiptModalRef.current = receiptModalState; }, [receiptModalState]);

  // Tangani tombol Back HP / Browser di UsahaQu
  useEffect(() => {
    window.history.replaceState({ screen: 'usahaqu', tab: 'kasir' }, '', '#usahaqu-kasir');

    const handleBackButton = () => {
      // 1. Tutup modal yang sedang terbuka terlebih dahulu
      if (receiptModalRef.current.isOpen) {
        setReceiptModalState({ isOpen: false, order: null });
        return;
      }
      if (checkoutOrderRef.current) {
        setCheckoutOrder(null);
        return;
      }
      if (orderSheetRef.current.isOpen) {
        setOrderSheetState({ isOpen: false, orderType: 'meja' });
        return;
      }
      if (selectedTableRef.current) {
        setSelectedTableForAction(null);
        return;
      }
      if (isBluetoothModalOpenRef.current) {
        setIsBluetoothModalOpen(false);
        return;
      }
      if (isDrawerOpenRef.current) {
        setIsDrawerOpen(false);
        return;
      }

      // 2. Jika di tab selain kasir, kembalikan ke tab kasir
      if (activeTabRef.current !== 'kasir') {
        setActiveTab('kasir');
        return;
      }

      // 3. Jika sudah di kasir dan tanpa modal, kembali ke beranda WargaQu
      onBackToWarga();
    };

    const onPop = () => {
      handleBackButton();
    };

    window.addEventListener('popstate', onPop);

    let capHandle: any = null;
    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        CapApp.addListener('backButton', () => {
          handleBackButton();
        })
          .then((h) => {
            capHandle = h;
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('popstate', onPop);
      if (capHandle?.remove) {
        capHandle.remove();
      }
    };
  }, [onBackToWarga]);

  // Table Management
  const handleAddTable = () => {
    const nextNumber = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) + 1 : 1;
    const newTable: TableItem = {
      id: `tbl-${Date.now()}`,
      name: `Meja ${nextNumber}`,
      number: nextNumber,
      status: 'kosong',
      positionIndex: tables.length,
    };
    const updated = [...tables, newTable];
    setTables(updated);
    StorageService.saveTables(updated);
    showNotification(`Meja ${nextNumber} berhasil ditambahkan ke denah.`);
  };

  const handleReorderTables = (newTables: TableItem[]) => {
    setTables(newTables);
    StorageService.saveTables(newTables);
  };

  const handleDeleteTable = (tableId: string) => {
    const updated = tables.filter((t) => t.id !== tableId);
    setTables(updated);
    StorageService.saveTables(updated);
    showNotification('Meja dihapus dari denah.');
  };

  const handleSelectTable = (table: TableItem) => {
    if (table.status === 'kosong') {
      setOrderSheetState({
        isOpen: true,
        orderType: 'meja',
        tableId: table.id,
        tableName: table.name,
        existingOrder: null,
      });
    } else {
      setSelectedTableForAction(table);
    }
  };

  const handleOpenBungkus = () => {
    setOrderSheetState({
      isOpen: true,
      orderType: 'bungkus',
      existingOrder: null,
    });
  };

  const handleSaveAndPrintOrder = async (
    items: OrderItem[],
    type: OrderType,
    tableId?: string,
    tableName?: string,
    customerName?: string,
    printOption?: 'bluetooth' | 'pdf' | 'none'
  ) => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const date = new Date();
    const dateKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    let orderToSave: Order;

    if (orderSheetState.existingOrder) {
      orderToSave = {
        ...orderSheetState.existingOrder,
        items,
        subtotal,
        total: subtotal,
        customerName: customerName || orderSheetState.existingOrder.customerName,
      };
    } else {
      const newReceiptNumber = `BQ-${dateKey}-${String(Math.floor(100 + Math.random() * 900))}`;
      orderToSave = {
        id: `ord-${Date.now()}`,
        receiptNumber: newReceiptNumber,
        type,
        tableId,
        tableName,
        customerName: customerName || (type === 'meja' ? tableName || 'Meja' : 'Bungkus'),
        items,
        subtotal,
        discount: 0,
        tax: 0,
        total: subtotal,
        status: 'saved',
        createdAt: date.toISOString(),
      };
    }

    if (type === 'bungkus') {
      setOrderSheetState({ isOpen: false, orderType: 'bungkus' });
      setCheckoutOrder(orderToSave);
      showNotification('Pesanan bungkus tersimpan. Lanjutkan pembayaran.');
      return;
    }

    const updatedActiveOrders = { ...activeOrders, [orderToSave.id]: orderToSave };
    setActiveOrders(updatedActiveOrders);
    StorageService.saveActiveOrders(updatedActiveOrders);

    if (tableId) {
      const updatedTables = tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status: 'terisi' as const,
              orderId: orderToSave.id,
              totalAmount: orderToSave.total,
              itemsCount: orderToSave.items.reduce((s, i) => s + i.quantity, 0),
              openedAt: date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            }
          : t
      );
      setTables(updatedTables);
      StorageService.saveTables(updatedTables);
    }

    setOrderSheetState({ isOpen: false, orderType: 'meja' });

    if (printOption === 'bluetooth') {
      await PrinterService.printOrder(orderToSave, profile, printerConfig, true);
      setReceiptModalState({
        isOpen: true,
        order: orderToSave,
        isKitchenSlip: true,
      });
      showNotification(`Pesanan ${tableName} tersimpan & Struk Dapur dicetak.`);
    } else {
      showNotification(`Pesanan ${tableName} berhasil disimpan.`);
    }
  };

  const handleProceedToPay = (table: TableItem) => {
    if (!table.orderId || !activeOrders[table.orderId]) {
      showNotification('Data pesanan meja tidak ditemukan.');
      return;
    }
    const currentOrder = activeOrders[table.orderId];
    setCheckoutOrder(currentOrder);
  };

  const handleCompletePayment = async (
    completedOrder: Order,
    printOption: 'bluetooth' | 'pdf' | 'both' | 'none'
  ) => {
    StorageService.addTransaction(completedOrder);
    setHistory([completedOrder, ...history]);
    MonetizationService.recordCharge({
      moduleId: 'usahaqu_pro',
      actionLabel: `Transaksi Kasir Resto Qu (${completedOrder.receiptNumber})`,
      grossAmount: completedOrder.total,
    });

    const copyActive = { ...activeOrders };
    delete copyActive[completedOrder.id];
    setActiveOrders(copyActive);
    StorageService.saveActiveOrders(copyActive);

    if (completedOrder.tableId) {
      const updatedTables = tables.map((t) =>
        t.id === completedOrder.tableId
          ? {
              ...t,
              status: 'kosong' as const,
              orderId: undefined,
              totalAmount: undefined,
              itemsCount: undefined,
              openedAt: undefined,
            }
          : t
      );
      setTables(updatedTables);
      StorageService.saveTables(updatedTables);
    }

    setCheckoutOrder(null);

    if (printOption === 'bluetooth' || printOption === 'both') {
      await PrinterService.printOrder(completedOrder, profile, printerConfig, false);
      setReceiptModalState({
        isOpen: true,
        order: completedOrder,
        isKitchenSlip: false,
      });
      showNotification('Pembayaran LUNAS! Struk nota dicetak ke printer.');
    } else if (printOption === 'pdf') {
      setReceiptModalState({
        isOpen: true,
        order: completedOrder,
        isKitchenSlip: false,
      });
      showNotification('Pembayaran LUNAS! Pratinjau struk PDF siap disimpan.');
    } else {
      showNotification('Pembayaran LUNAS! Transaksi tersimpan rapi.');
    }
  };

  const handleClearTable = (table: TableItem) => {
    if (table.orderId) {
      const copy = { ...activeOrders };
      delete copy[table.orderId];
      setActiveOrders(copy);
      StorageService.saveActiveOrders(copy);
    }
    const updated = tables.map((t) =>
      t.id === table.id
        ? {
            ...t,
            status: 'kosong' as const,
            orderId: undefined,
            totalAmount: undefined,
            itemsCount: undefined,
            openedAt: undefined,
          }
        : t
    );
    setTables(updated);
    StorageService.saveTables(updated);
    showNotification(`${table.name} berhasil dikosongkan.`);
  };

  const occupiedTablesCount = tables.filter((t) => t.status !== 'kosong').length;

  const getPageTitle = () => {
    switch (activeTab) {
      case 'kasir':
        return { title: profile.name || 'Resto Qu', subtitle: 'Kasir & Denah Meja' };
      case 'bahan':
        return { title: 'Modal & Bahan', subtitle: 'Manajemen Stok Gudang' };
      case 'omset':
        return { title: 'Omset & Pendapatan', subtitle: 'Ringkasan Keuangan' };
      case 'laporan':
        return { title: 'Laporan Transaksi', subtitle: 'Riwayat Penjualan & Ekspor' };
      case 'setting':
        return { title: 'Pengaturan Usaha', subtitle: 'Profil Usaha & Bluetooth' };
      default:
        return { title: profile.name || 'Resto Qu', subtitle: 'UsahaQu POS Restoran' };
    }
  };

  const pageInfo = getPageTitle();

  // If currently in ModularQu Mode, render the full Modular Voice AI POS within UsahaQu
  if (posMode === 'modular') {
    return (
      <div className="flex-1 flex flex-col relative overflow-hidden bg-zinc-950">
        {/* Top UsahaQu Mode Switch Bar */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 px-3 py-2 border-b border-zinc-800 flex items-center justify-between shrink-0 z-40 shadow-md">
          <button
            onClick={onBackToWarga}
            className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 text-zinc-300 flex items-center justify-center transition border border-zinc-700/60"
            title="Kembali ke Beranda WargaQu"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Segmented Mode Switcher */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 shadow-inner">
            <button
              onClick={() => {
                setPosMode('resto');
                showNotification('Beralih ke Mode Restoran Resto Qu 🍲');
              }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition active:scale-95"
              title="Beralih ke Mode Restoran (Resto Qu & Denah Meja)"
            >
              <span>🍲 Resto Qu</span>
            </button>
            <button
              className="px-2.5 py-1 rounded-lg text-[10px] font-black text-zinc-950 bg-emerald-400 shadow-sm flex items-center gap-1 transition cursor-default"
            >
              <span>⚡ ModularQu</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => ModuleOnboardingService.openGuide('usahaqu')}
              className="w-7 h-7 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center border border-zinc-700 active:scale-95"
              title="Panduan & Manfaat UsahaQu / ModularQu"
              aria-label="Panduan UsahaQu"
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            </button>
            {onOpenBantuan && (
              <button
                onClick={onOpenBantuan}
                className="w-7 h-7 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center border border-zinc-700 active:scale-95"
                title="Pusat Bantuan UsahaQu & Smart Care"
              >
                <Headphones className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
          </div>
        </div>

        {/* Embedded ModularQu Interface */}
        <ModularQuView
          onBackToWarga={onBackToWarga}
          onOpenBaksoQu={() => {
            setPosMode('resto');
            showNotification('Beralih ke Mode Restoran Resto Qu 🍲');
          }}
          onOpenBantuan={onOpenBantuan}
          showNotification={showNotification}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden bg-stone-100">
      {/* Top Banner: Breadcrumb & POS Mode Switcher */}
      <div className="bg-gradient-to-r from-[#047857] via-[#059669] to-[#047857] text-white px-3.5 py-2 flex items-center justify-between shrink-0 shadow-sm border-b border-emerald-800">
        <button
          onClick={onBackToWarga}
          className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition flex items-center justify-center text-emerald-100 hover:text-white"
          title="Kembali ke Beranda WargaQu"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* 2-in-1 POS Mode Switcher Segmented Pill */}
        <div className="flex items-center bg-emerald-950/70 p-1 rounded-xl border border-emerald-400/40 shadow-inner">
          <button
            className="px-2.5 py-1 rounded-lg text-[10px] font-black text-emerald-950 bg-[#5eead4] shadow-sm flex items-center gap-1 transition cursor-default"
          >
            <span>🍲 Resto Qu</span>
          </button>
          <button
            onClick={() => {
              setPosMode('modular');
              showNotification('Beralih ke Mode POS Modular Voice AI ⚡');
            }}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-200 hover:text-white flex items-center gap-1 transition active:scale-95"
            title="Beralih ke Mode POS ModularQu (Universal Voice AI POS)"
          >
            <span>⚡ ModularQu</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => ModuleOnboardingService.openGuide('usahaqu')}
            className="w-7 h-7 rounded-xl bg-emerald-950/80 hover:bg-emerald-950 text-[#5eead4] border border-[#5eead4]/40 flex items-center justify-center font-bold shadow-xs active:scale-95"
            title="Panduan & Manfaat UsahaQu / Resto Qu"
            aria-label="Panduan UsahaQu"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#5eead4]" />
          </button>
          {onOpenBantuan && (
            <button
              onClick={onOpenBantuan}
              className="w-7 h-7 rounded-xl bg-emerald-950/80 hover:bg-emerald-950 text-[#5eead4] border border-[#5eead4]/40 flex items-center justify-center font-bold shadow-xs active:scale-95"
              title="Pusat Bantuan UsahaQu & Smart Care"
            >
              <Headphones className="w-3.5 h-3.5 text-[#5eead4]" />
            </button>
          )}
        </div>
      </div>

      {/* POS Header Bar */}
      <HeaderBar
        title={pageInfo.title}
        subtitle={pageInfo.subtitle}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onTakeawayClick={handleOpenBungkus}
        printerConfig={printerConfig}
        onOpenPrinterModal={() => setIsBluetoothModalOpen(true)}
        showTakeawayBtn={activeTab === 'kasir'}
      />

      {/* Main Content Area Based on Active Tab */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-stone-100">
        {activeTab === 'kasir' && (
          <TableGrid
            tables={tables}
            activeOrders={activeOrders}
            onSelectTable={handleSelectTable}
            onAddTable={handleAddTable}
            onReorderTables={handleReorderTables}
            onDeleteTable={handleDeleteTable}
          />
        )}

        {activeTab === 'bahan' && (
          <BahanView
            ingredients={ingredients}
            onSaveIngredients={(newItems) => {
              setIngredients(newItems);
              StorageService.saveIngredients(newItems);
              showNotification('Data bahan baku diperbarui.');
            }}
          />
        )}

        {activeTab === 'omset' && <OmsetDashboard history={history} />}

        {activeTab === 'laporan' && (
          <LaporanView
            history={history}
            profile={profile}
            onOpenReceipt={(ord) =>
              setReceiptModalState({ isOpen: true, order: ord, isKitchenSlip: false })
            }
          />
        )}

        {activeTab === 'setting' && (
          <SettingView
            profile={profile}
            onSaveProfile={(newProf) => {
              setProfile(newProf);
              StorageService.saveProfile(newProf);
            }}
            printerConfig={printerConfig}
            onSavePrinterConfig={(newCfg) => {
              setPrinterConfig(newCfg);
              StorageService.savePrinterConfig(newCfg);
            }}
            menuList={menuList}
            onSaveMenu={(newMenu) => {
              setMenuList(newMenu);
              StorageService.saveMenu(newMenu);
              showNotification('Daftar menu berhasil diperbarui.');
            }}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation Bar inside POS */}
      <BottomNavBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        occupiedCount={occupiedTablesCount}
      />

      {/* Navigation Drawer (Sidebar) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        profile={profile}
        printerConfig={printerConfig}
        occupiedTablesCount={occupiedTablesCount}
        onSwitchToModular={() => {
          setPosMode('modular');
          showNotification('Beralih ke Mode POS Modular Voice AI ⚡');
        }}
      />

      {/* Quick Bluetooth Status Modal */}
      <BluetoothModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
        printerConfig={printerConfig}
        onSavePrinterConfig={(cfg) => {
          setPrinterConfig(cfg);
          StorageService.savePrinterConfig(cfg);
        }}
        profile={profile}
      />

      {/* Order Bottom Sheet */}
      <OrderBottomSheet
        isOpen={orderSheetState.isOpen}
        onClose={() => setOrderSheetState({ isOpen: false, orderType: 'meja' })}
        orderType={orderSheetState.orderType}
        tableName={orderSheetState.tableName}
        tableId={orderSheetState.tableId}
        existingOrder={orderSheetState.existingOrder}
        menuList={menuList}
        onSaveAndPrint={handleSaveAndPrintOrder}
      />

      {/* Table Action Sheet */}
      <TableActionModal
        isOpen={selectedTableForAction !== null}
        onClose={() => setSelectedTableForAction(null)}
        table={selectedTableForAction}
        activeOrder={
          selectedTableForAction?.orderId
            ? activeOrders[selectedTableForAction.orderId] || null
            : null
        }
        onPay={() => {
          if (selectedTableForAction) handleProceedToPay(selectedTableForAction);
        }}
        onAddMoreMenu={() => {
          if (selectedTableForAction) {
            const existing = selectedTableForAction.orderId
              ? activeOrders[selectedTableForAction.orderId]
              : null;
            setOrderSheetState({
              isOpen: true,
              orderType: 'meja',
              tableId: selectedTableForAction.id,
              tableName: selectedTableForAction.name,
              existingOrder: existing,
            });
          }
        }}
        onViewReceipt={() => {
          if (selectedTableForAction?.orderId && activeOrders[selectedTableForAction.orderId]) {
            setReceiptModalState({
              isOpen: true,
              order: activeOrders[selectedTableForAction.orderId],
              isKitchenSlip: true,
            });
          }
        }}
        onClearTable={() => {
          if (selectedTableForAction) handleClearTable(selectedTableForAction);
        }}
      />

      {/* Checkout Screen Sheet */}
      <CheckoutModal
        isOpen={checkoutOrder !== null}
        onClose={() => setCheckoutOrder(null)}
        order={checkoutOrder}
        printerConfig={printerConfig}
        onCompletePayment={handleCompletePayment}
      />

      {/* Thermal Receipt Preview Modal */}
      <ReceiptModal
        isOpen={receiptModalState.isOpen}
        onClose={() => setReceiptModalState({ isOpen: false, order: null })}
        order={receiptModalState.order}
        profile={profile}
        printerConfig={printerConfig}
        isKitchenSlip={receiptModalState.isKitchenSlip}
      />
    </div>
  );
};
