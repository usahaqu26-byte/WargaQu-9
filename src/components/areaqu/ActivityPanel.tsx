import React, { useState } from 'react';
import {
  ShoppingBag,
  Heart,
  Inbox,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  Truck,
  ChefHat,
  ExternalLink,
  BellRing,
  Navigation,
  CalendarClock
} from 'lucide-react';
import {
  AreaOrderItem,
  KelilingPingItem,
  KelilingPingStatus,
  LapakItem,
  OrderStatus
} from './types';

interface ActivityPanelProps {
  orders: AreaOrderItem[];
  pings: KelilingPingItem[];
  favoriteLapaks: LapakItem[];
  myLapakId: string;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onUpdatePingStatus: (pingId: string, status: KelilingPingStatus) => void;
  onSelectLapakOnMap: (lapak: LapakItem) => void;
  onToggleFavorite: (lapakId: string) => void;
}

const STATUS_LABELS: Record<OrderStatus, { label: string; style: string }> = {
  menunggu: { label: 'Menunggu Konfirmasi', style: 'text-amber-700 bg-amber-50 border-amber-200' },
  diproses: { label: 'Sedang Disiapkan', style: 'text-sky-700 bg-sky-50 border-sky-200' },
  diantar: { label: 'Dalam Pengantaran', style: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  selesai: { label: 'Selesai', style: 'text-slate-600 bg-slate-100 border-slate-200' }
};

const PING_STATUS_LABELS: Record<KelilingPingStatus, { label: string; style: string }> = {
  menunggu: { label: 'Menunggu Pedagang', style: 'text-amber-700 bg-amber-50 border-amber-200' },
  otw: { label: 'Pedagang OTW Mampir', style: 'text-violet-700 bg-violet-50 border-violet-200' },
  sampai: { label: 'Sudah di Depan / Lokasi', style: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  selesai: { label: 'Selesai', style: 'text-slate-600 bg-slate-100 border-slate-200' }
};

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  orders,
  pings,
  favoriteLapaks,
  myLapakId,
  onUpdateOrderStatus,
  onUpdatePingStatus,
  onSelectLapakOnMap,
  onToggleFavorite
}) => {
  const [subTab, setSubTab] = useState<'pesanan' | 'favorit' | 'masuk'>('pesanan');

  const incomingOrders = orders.filter(o => o.lapakId === myLapakId);
  const incomingPings = pings.filter(p => p.lapakId === myLapakId);
  const activeIncomingTotal =
    incomingOrders.filter(o => o.status !== 'selesai').length +
    incomingPings.filter(p => p.status !== 'selesai').length;

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Header & Sub-Menus */}
      <div className="bg-white border-b border-slate-200 px-4 pt-3 pb-3 shrink-0">
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Aktivitas Warga</h2>
            <p className="text-xs text-slate-500">
              Pantau pesanan, lapak favorit, dan order masuk
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700">
            {orders.length} Transaksi
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('pesanan')}
            className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              subTab === 'pesanan'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
            <span>Pesanan</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('favorit')}
            className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              subTab === 'favorit'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Heart className="w-3.5 h-3.5 shrink-0" />
            <span>Favorit ({favoriteLapaks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('masuk')}
            className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              subTab === 'masuk'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-3.5 h-3.5 shrink-0" />
            <span>Masuk ({activeIncomingTotal})</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
        {/* SUB-MENU 1: PESANAN & PANGGILAN MAMPIR SAYA */}
        {subTab === 'pesanan' && (
          <>
            {pings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-violet-700" />
                    <span>Panggilan Mampir Keliling ({pings.length})</span>
                  </span>
                </div>
                {pings.map(ping => {
                  const pMeta = PING_STATUS_LABELS[ping.status];
                  return (
                    <div
                      key={ping.id}
                      className="bg-white rounded-2xl border border-violet-200/80 p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{ping.lapakIcon}</span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{ping.lapakName}</h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {ping.lapakOwner} · {ping.createdAt}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${pMeta.style}`}>
                          {pMeta.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100">
                        {ping.note || 'Mohon mampir ke titik lokasi saya.'}
                      </p>
                      {ping.status !== 'selesai' && (
                        <button
                          type="button"
                          onClick={() => onUpdatePingStatus(ping.id, 'selesai')}
                          className="w-full min-h-[38px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selesaikan Panggilan</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {orders.length === 0 && pings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
                <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Belum Ada Pesanan atau Panggilan</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pilih lapak di menu Jelajah untuk kirim pesanan, Pre-Order jam lewat, atau tekan Panggil Mampir pada pedagang keliling.
                </p>
              </div>
            ) : (
              orders.map(order => {
                const statusMeta = STATUS_LABELS[order.status];
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl shrink-0">{order.lapakIcon}</span>
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 truncate">
                            {order.lapakName}
                          </h3>
                          <p className="text-[11px] text-slate-500 truncate">
                            {order.lapakOwner} · {order.createdAt}
                          </p>
                          {order.orderKind === 'preorder' && (
                            <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-violet-800 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md">
                              <CalendarClock className="w-3 h-3" />
                              <span>PRE-ORDER {order.scheduledSlot ? `· ${order.scheduledSlot}` : ''}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 ${statusMeta.style}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-700">
                      {order.items.map(item => (
                        <div key={item.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {item.qty}x {item.name}
                          </span>
                          <span className="font-mono tabular-nums font-semibold shrink-0">
                            Rp {(item.price * item.qty).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="text-[11px] text-slate-500 truncate max-w-[60%]">
                        Antar ke: {order.consumerName} ({order.consumerAddress})
                      </div>
                      <div className="font-extrabold text-emerald-700 font-mono tabular-nums">
                        Total Rp {order.total.toLocaleString('id-ID')}
                      </div>
                    </div>

                    {order.status !== 'selesai' && (
                      <button
                        type="button"
                        onClick={() => onUpdateOrderStatus(order.id, 'selesai')}
                        className="w-full min-h-[40px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Konfirmasi Pesanan Diterima</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* SUB-MENU 2: LAPAK FAVORIT */}
        {subTab === 'favorit' && (
          <>
            {favoriteLapaks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
                <Heart className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Belum Ada Lapak Favorit</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tekan tombol ikon hati pada detail lapak di menu Jelajah untuk memantau pedagang langganan Anda.
                </p>
              </div>
            ) : (
              favoriteLapaks.map(lapak => (
                <div
                  key={lapak.id}
                  className="bg-white rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">
                      {lapak.avatarIcon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 truncate">{lapak.name}</h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        {lapak.ownerName} · {lapak.status === 'buka' ? 'Buka' : lapak.status === 'keliling' ? 'Keliling' : 'Tutup'}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-semibold mt-0.5">
                        <span>
                          {lapak.distanceMeter !== undefined
                            ? lapak.distanceMeter >= 1000
                              ? `${(lapak.distanceMeter / 1000).toFixed(1)} km`
                              : `${lapak.distanceMeter} m`
                            : 'Dekat'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{lapak.catalog.length} menu</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectLapakOnMap(lapak)}
                      className="min-h-[40px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition"
                    >
                      <span>Buka</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(lapak.id)}
                      className="min-h-[40px] min-w-[40px] rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center"
                      title="Hapus dari favorit"
                    >
                      <Heart className="w-4 h-4 fill-rose-500" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* SUB-MENU 3: PESANAN & PANGGILAN MASUK (PEDAGANG) */}
        {subTab === 'masuk' && (
          <>
            {incomingPings.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-violet-900 flex items-center gap-1.5 px-0.5">
                  <BellRing className="w-3.5 h-3.5 text-violet-700" />
                  <span>Warga Memanggil / Minta Mampir ({incomingPings.length})</span>
                </div>
                {incomingPings.map(ping => {
                  const pMeta = PING_STATUS_LABELS[ping.status];
                  return (
                    <div
                      key={ping.id}
                      className="bg-white rounded-2xl border border-violet-200 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-900 truncate">
                            Panggilan: {ping.senderName}
                          </h3>
                          <p className="text-[11px] text-slate-500 truncate">
                            {ping.senderAddress}{ping.senderLandmark ? ` (${ping.senderLandmark})` : ''}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${pMeta.style}`}>
                          {pMeta.label}
                        </span>
                      </div>

                      <div className="bg-violet-50/70 rounded-xl p-2.5 text-[11px] text-slate-800 space-y-1 border border-violet-100">
                        <p className="font-medium">{ping.note || 'Mohon mampir sebentar ke lokasi saya.'}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-mono tabular-nums">{ping.senderPhone || '-'}</span>
                          <span>{ping.createdAt}</span>
                        </div>
                      </div>

                      {ping.status !== 'selesai' && (
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => onUpdatePingStatus(ping.id, 'otw')}
                            className="min-h-[38px] px-2 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-800 text-[11px] font-bold flex items-center justify-center gap-1"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>OTW</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePingStatus(ping.id, 'sampai')}
                            className="min-h-[38px] px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Sampai</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePingStatus(ping.id, 'selesai')}
                            className="min-h-[38px] px-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Selesai</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {incomingOrders.length === 0 && incomingPings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-2">
                <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-800">Belum Ada Order / Panggilan Masuk</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pesanan, Pre-Order, maupun panggilan "Mampir" dari warga akan tampil di sini secara real-time.
                </p>
              </div>
            ) : (
              incomingOrders.map(order => {
                const statusMeta = STATUS_LABELS[order.status];
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900">
                          Pembeli: {order.consumerName}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {order.consumerWargaId} · {order.consumerRtRw}
                        </p>
                        {order.orderKind === 'preorder' && (
                          <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-violet-800 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md">
                            <CalendarClock className="w-3 h-3" />
                            <span>PRE-ORDER {order.scheduledSlot ? `· ${order.scheduledSlot}` : ''}</span>
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 ${statusMeta.style}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    {/* Verified Consumer Delivery Identity */}
                    <div className="bg-slate-50 rounded-xl p-2.5 space-y-1 text-[11px] text-slate-700 border border-slate-200/70">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                        <span>
                          {order.consumerAddress}
                          {order.consumerLandmark ? ` (${order.consumerLandmark})` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600">
                        <span className="flex items-center gap-1 font-mono tabular-nums">
                          <Phone className="w-3 h-3 text-emerald-700" />
                          {order.consumerPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {order.createdAt}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-700">
                      {order.items.map(item => (
                        <div key={item.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {item.qty}x {item.name}
                          </span>
                          <span className="font-mono tabular-nums font-semibold shrink-0">
                            Rp {(item.price * item.qty).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-1.5 border-t border-slate-100 font-extrabold text-emerald-800">
                        <span>Total Tagihan</span>
                        <span className="font-mono tabular-nums">
                          Rp {order.total.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Merchant Action Buttons */}
                    {order.status !== 'selesai' && (
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onUpdateOrderStatus(order.id, 'diproses')}
                          className="min-h-[40px] px-2 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <ChefHat className="w-3.5 h-3.5" />
                          <span>Siapkan</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateOrderStatus(order.id, 'diantar')}
                          className="min-h-[40px] px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Antar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateOrderStatus(order.id, 'selesai')}
                          className="min-h-[40px] px-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Selesai</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};
