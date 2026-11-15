import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Store,
  ShieldCheck,
  LocateFixed,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Phone,
  Clock,
  BadgeCheck,
  FileWarning,
  Lock
} from 'lucide-react';
import {
  ConsumerIdentity,
  MerchantIdentity,
  POICategory,
  LapakType,
  CATEGORY_OPTIONS,
  AVATAR_ICON_OPTIONS
} from './types';

interface IdentityPanelProps {
  consumerIdentity: ConsumerIdentity;
  merchantIdentity: MerchantIdentity;
  onSaveConsumerIdentity: (identity: ConsumerIdentity) => void;
  onSaveMerchantIdentity: (identity: MerchantIdentity) => void;
  userCoords: [number, number];
  gpsSourceLabel: string;
  onOpenGpsModal: () => void;
  onSyncLapakGps: () => void;
  showNotification: (msg: string) => void;
  initialSubTab?: 'konsumen' | 'pedagang' | 'keamanan';
}

export const IdentityPanel: React.FC<IdentityPanelProps> = ({
  consumerIdentity,
  merchantIdentity,
  onSaveConsumerIdentity,
  onSaveMerchantIdentity,
  userCoords,
  gpsSourceLabel,
  onOpenGpsModal,
  onSyncLapakGps,
  showNotification,
  initialSubTab = 'konsumen'
}) => {
  const [subTab, setSubTab] = useState<'konsumen' | 'pedagang' | 'keamanan'>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Local form state for Consumer
  const [cForm, setCForm] = useState<ConsumerIdentity>(consumerIdentity);
  useEffect(() => {
    setCForm(consumerIdentity);
  }, [consumerIdentity]);

  // Local form state for Merchant
  const [mForm, setMForm] = useState<MerchantIdentity>(merchantIdentity);
  useEffect(() => {
    setMForm(merchantIdentity);
  }, [merchantIdentity]);

  // Report issue form state
  const [reportTarget, setReportTarget] = useState('');
  const [reportReason, setReportReason] = useState('Lapak fiktif / alamat tidak sesuai');

  const handleConsumerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cForm.fullName.trim() || !cForm.addressDetail.trim() || !cForm.phone.trim()) {
      showNotification('Nama lengkap, alamat antar, dan nomor WhatsApp wajib diisi');
      return;
    }
    if (cForm.residentStatus === 'warga' && !cForm.rtRw.trim()) {
      showNotification('Mohon isi keterangan RT/RW untuk verifikasi warga');
      return;
    }

    const saved: ConsumerIdentity = {
      ...cForm,
      fullName: cForm.fullName.trim(),
      wargaId: cForm.wargaId.trim() || (cForm.residentStatus === 'warga' ? 'WQ-RT03-NEW' : 'TAMU-AREAQU'),
      rtRw: cForm.rtRw.trim() || 'Pengunjung Sekitar',
      addressDetail: cForm.addressDetail.trim(),
      landmark: cForm.landmark.trim(),
      phone: cForm.phone.trim(),
      isVerified: true,
      updatedAt: new Date().toISOString()
    };
    onSaveConsumerIdentity(saved);
  };

  const handleMerchantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mForm.ownerName.trim() || !mForm.lapakName.trim() || !mForm.baseAddress.trim() || !mForm.phone.trim()) {
      showNotification('Nama pemilik, nama lapak, alamat pangkalan, dan nomor WA wajib diisi');
      return;
    }

    const saved: MerchantIdentity = {
      ...mForm,
      ownerName: mForm.ownerName.trim(),
      wargaId: mForm.wargaId.trim() || 'WQ-UMKM-01',
      rtRw: mForm.rtRw.trim() || 'RT 03 / RW 05',
      lapakName: mForm.lapakName.trim(),
      baseAddress: mForm.baseAddress.trim(),
      phone: mForm.phone.trim(),
      operationalHours: mForm.operationalHours.trim() || '08:00 - 20:00 WIB',
      description: mForm.description.trim() || 'Lapak dagangan warga terverifikasi di AreaQu.',
      isVerified: true,
      updatedAt: new Date().toISOString()
    };
    onSaveMerchantIdentity(saved);
  };

  const handleSendReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget.trim()) {
      showNotification('Masukkan nama lapak atau akun yang ingin dilaporkan');
      return;
    }
    showNotification(`Laporan untuk "${reportTarget.trim()}" diteruskan ke Pengurus RT 03`);
    setReportTarget('');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-hidden">
      {/* Sub-Menu Segmented Switcher */}
      <div className="bg-white border-b border-slate-200 px-4 pt-3 pb-3 shrink-0">
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Identitas & Verifikasi</h2>
            <p className="text-xs text-slate-500">
              Identitas jelas untuk keamanan transaksi antar warga
            </p>
          </div>
          <div className="text-right text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>WargaQu ID</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('konsumen')}
            className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              subTab === 'konsumen'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Konsumen</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('pedagang')}
            className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              subTab === 'pedagang'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span>Pedagang</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('keamanan')}
            className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
              subTab === 'keamanan'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>GPS & Aman</span>
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        {/* SUB-MENU 1: IDENTITAS CALON KONSUMEN */}
        {subTab === 'konsumen' && (
          <form onSubmit={handleConsumerSubmit} className="space-y-4">
            {/* Status Verification Banner */}
            <div
              className={`rounded-2xl p-3.5 border flex items-start gap-3 ${
                consumerIdentity.isVerified
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
              }`}
            >
              {consumerIdentity.isVerified ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">
                  {consumerIdentity.isVerified
                    ? 'Identitas Calon Konsumen Terverifikasi'
                    : 'Identitas Calon Konsumen Belum Lengkap'}
                </p>
                <p className="text-[11px] opacity-85 mt-0.5 leading-relaxed">
                  {consumerIdentity.isVerified
                    ? `${consumerIdentity.fullName} · ${consumerIdentity.rtRw} · Titik antar siap digunakan saat memesan.`
                    : 'Lengkapi nama, kontak WhatsApp, dan alamat/patokan agar pedagang mudah mengantar pesanan Anda.'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5">
              {/* Resident Status Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Status Domisili Pembeli
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCForm(prev => ({ ...prev, residentStatus: 'warga' }))}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      cForm.residentStatus === 'warga'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Warga Terdaftar (RT/RW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCForm(prev => ({ ...prev, residentStatus: 'tamu' }))}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      cForm.residentStatus === 'tamu'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tamu / Pengunjung
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nama Lengkap Pembeli
                  </label>
                  <input
                    type="text"
                    required
                    value={cForm.fullName}
                    onChange={e => setCForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Contoh: Hendriana"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nomor WhatsApp Aktif
                  </label>
                  <input
                    type="tel"
                    required
                    value={cForm.phone}
                    onChange={e => setCForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ID Warga / Pengenal
                  </label>
                  <input
                    type="text"
                    value={cForm.wargaId}
                    onChange={e => setCForm(prev => ({ ...prev, wargaId: e.target.value }))}
                    placeholder="WQ-RT03-012"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Wilayah RT / RW atau Area
                </label>
                <input
                  type="text"
                  value={cForm.rtRw}
                  onChange={e => setCForm(prev => ({ ...prev, rtRw: e.target.value }))}
                  placeholder="Contoh: RT 03 / RW 05 Desa Harmoni"
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Alamat & Blok Pengantaran
                </label>
                <input
                  type="text"
                  required
                  value={cForm.addressDetail}
                  onChange={e => setCForm(prev => ({ ...prev, addressDetail: e.target.value }))}
                  placeholder="Contoh: Jl. Melati Blok A No. 12"
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Patokan Rumah / Titik Jemput
                </label>
                <input
                  type="text"
                  value={cForm.landmark}
                  onChange={e => setCForm(prev => ({ ...prev, landmark: e.target.value }))}
                  placeholder="Contoh: Rumah pagar hitam sebelah pos ronda"
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                />
              </div>

              <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cForm.shareExactLocationOnOrder}
                  onChange={e =>
                    setCForm(prev => ({ ...prev, shareExactLocationOnOrder: e.target.checked }))
                  }
                  className="mt-0.5 w-4 h-4 accent-emerald-700 rounded"
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Sertakan koordinat titik GPS saya secara otomatis hanya saat saya mengirim pesanan atau memanggil pedagang keliling.
                </span>
              </label>

              <button
                type="submit"
                className="w-full min-h-[46px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.99] transition"
              >
                Simpan & Verifikasi Identitas Konsumen
              </button>
            </div>
          </form>
        )}

        {/* SUB-MENU 2: IDENTITAS PEDAGANG & LAPAK */}
        {subTab === 'pedagang' && (
          <form onSubmit={handleMerchantSubmit} className="space-y-4">
            <div
              className={`rounded-2xl p-3.5 border flex items-start gap-3 ${
                merchantIdentity.isVerified
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50/80 border-amber-200 text-amber-900'
              }`}
            >
              {merchantIdentity.isVerified ? (
                <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">
                  {merchantIdentity.isVerified
                    ? 'Identitas Pedagang Terverifikasi'
                    : 'Lengkapi Identitas Pedagang untuk Buka Lapak'}
                </p>
                <p className="text-[11px] opacity-85 mt-0.5 leading-relaxed">
                  {merchantIdentity.isVerified
                    ? `Penanggung jawab: ${merchantIdentity.ownerName} (${merchantIdentity.wargaId}) · Siap tampil di peta warga.`
                    : 'Warga wajib mencantumkan nama pemilik, ID warga/RT-RW, kategori, serta kontak sebelum membagikan lokasi lapak.'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5">
              {/* Avatar Icon Picker */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Ikon Lapak di Peta
                </label>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {AVATAR_ICON_OPTIONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setMForm(prev => ({ ...prev, avatarIcon: icon }))}
                      className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center shrink-0 border transition ${
                        mForm.avatarIcon === icon
                          ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-600/20'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Usaha / Lapak Digital
                </label>
                <input
                  type="text"
                  required
                  value={mForm.lapakName}
                  onChange={e => setMForm(prev => ({ ...prev, lapakName: e.target.value }))}
                  placeholder="Contoh: Bakso Qu 1.0 (Pusat & Gerobak Keliling)"
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nama Pemilik Asli
                  </label>
                  <input
                    type="text"
                    required
                    value={mForm.ownerName}
                    onChange={e => setMForm(prev => ({ ...prev, ownerName: e.target.value }))}
                    placeholder="Nama sesuai KTP/WargaQu"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ID Warga / UMKM
                  </label>
                  <input
                    type="text"
                    value={mForm.wargaId}
                    onChange={e => setMForm(prev => ({ ...prev, wargaId: e.target.value }))}
                    placeholder="WQ-RT03-012"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Kategori Lapak
                  </label>
                  <select
                    value={mForm.category}
                    onChange={e =>
                      setMForm(prev => ({ ...prev, category: e.target.value as POICategory }))
                    }
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  >
                    {CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.icon} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tipe Operasional
                  </label>
                  <select
                    value={mForm.lapakType}
                    onChange={e =>
                      setMForm(prev => ({ ...prev, lapakType: e.target.value as LapakType }))
                    }
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  >
                    <option value="menetap">Menetap (Kios / Rumah)</option>
                    <option value="keliling">Keliling (Gerobak / Motor)</option>
                    <option value="jasa_panggilan">Jasa Panggilan Warga</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nomor WA Pedagang
                  </label>
                  <input
                    type="tel"
                    required
                    value={mForm.phone}
                    onChange={e => setMForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0812-3456-7890"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Jam Operasional
                  </label>
                  <input
                    type="text"
                    value={mForm.operationalHours}
                    onChange={e =>
                      setMForm(prev => ({ ...prev, operationalHours: e.target.value }))
                    }
                    placeholder="09:00 - 21:00 WIB"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Wilayah RT / RW
                  </label>
                  <input
                    type="text"
                    value={mForm.rtRw}
                    onChange={e => setMForm(prev => ({ ...prev, rtRw: e.target.value }))}
                    placeholder="RT 03 / RW 05"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Kendaraan / Stand
                  </label>
                  <input
                    type="text"
                    value={mForm.vehicleType}
                    onChange={e => setMForm(prev => ({ ...prev, vehicleType: e.target.value }))}
                    placeholder="Gerobak Motor / Kios"
                    className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Alamat Pangkalan / Area Keliling
                </label>
                <input
                  type="text"
                  required
                  value={mForm.baseAddress}
                  onChange={e => setMForm(prev => ({ ...prev, baseAddress: e.target.value }))}
                  placeholder="Depan Balai Warga RT 03 & Keliling Blok A-C"
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Deskripsi Lapak & Keunggulan Dagangan
                </label>
                <textarea
                  rows={2}
                  value={mForm.description}
                  onChange={e => setMForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Jelaskan dagangan Anda agar warga yakin..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm active:scale-[0.99] transition"
              >
                Simpan & Terbitkan Identitas Pedagang
              </button>
            </div>
          </form>
        )}

        {/* SUB-MENU 3: GPS, PRIVASI & KEAMANAN */}
        {subTab === 'keamanan' && (
          <div className="space-y-4">
            {/* GPS Calibration Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Titik Lokasi Perangkat</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{gpsSourceLabel}</p>
                </div>
                <MapPin className="w-5 h-5 text-emerald-700 shrink-0" />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs font-mono tabular-nums text-slate-700 flex items-center justify-between">
                <span>Lat: {userCoords[0].toFixed(6)}</span>
                <span>Lng: {userCoords[1].toFixed(6)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenGpsModal}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <LocateFixed className="w-4 h-4" />
                  <span>Kalibrasi GPS</span>
                </button>
                <button
                  type="button"
                  onClick={onSyncLapakGps}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Store className="w-4 h-4 text-emerald-700" />
                  <span>Set Lokasi Lapak</span>
                </button>
              </div>
            </div>

            {/* Privacy & Verification Policy Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <h3 className="text-sm font-bold text-slate-900">Aturan Identitas AreaQu</h3>
              <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    Nomor kontak dan alamat detail calon konsumen hanya diteruskan kepada pedagang yang dipilih saat mengirim pesanan.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    Pedagang keliling wajib memperbarui status (Buka / Keliling / Tutup) agar warga tidak menunggu di luar jam operasional.
                  </span>
                </li>
              </ul>
            </div>

            {/* Report Lapak Form */}
            <form
              onSubmit={handleSendReport}
              className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-bold text-slate-900">Laporkan Lapak / Akun</h3>
              </div>
              <input
                type="text"
                value={reportTarget}
                onChange={e => setReportTarget(e.target.value)}
                placeholder="Nama lapak atau pemilik yang dilaporkan..."
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
              />
              <select
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                className="w-full min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
              >
                <option value="Lapak fiktif / alamat tidak sesuai">Lapak fiktif / alamat tidak sesuai</option>
                <option value="Identitas pemilik tidak jelas">Identitas pemilik tidak jelas</option>
                <option value="Harga atau barang tidak sesuai katalog">Harga atau barang tidak sesuai katalog</option>
                <option value="Pembeli tidak dapat dihubungi">Pembeli tidak dapat dihubungi</option>
              </select>
              <button
                type="submit"
                className="w-full min-h-[44px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold transition"
              >
                Kirim Laporan ke Pengurus RT
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
