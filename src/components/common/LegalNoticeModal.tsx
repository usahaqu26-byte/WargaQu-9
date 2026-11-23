import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, FileText, AlertTriangle, Copyright } from 'lucide-react';
import { APP_VERSION } from '../../config/appVersion';

export type LegalTab = 'privasi' | 'ketentuan' | 'hakcipta';

interface LegalNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

export const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privasi',
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl max-h-[88vh] flex flex-col overflow-hidden text-slate-800">
        <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-200 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Informasi Legal &amp; Hak Cipta WargaQu
              </h3>
              <p className="text-[11px] text-slate-500">
                Transparansi privasi, ketentuan penggunaan &amp; perlindungan karya
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('privasi')}
              className={`min-h-[36px] rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                activeTab === 'privasi'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privasi</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ketentuan')}
              className={`min-h-[36px] rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                activeTab === 'ketentuan'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ketentuan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hakcipta')}
              className={`min-h-[36px] rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                activeTab === 'hakcipta'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Copyright className="w-3.5 h-3.5" />
              <span>Hak Cipta</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs leading-relaxed text-slate-700">
          {activeTab === 'privasi' && (
            <>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <div className="font-extrabold">Prinsip Data Lokal &amp; Relay Tanpa Simpan</div>
                <p className="text-[11px]">
                  Data operasional utama (catatan DompetQu, kasir UsahaQu, katalog AreaQu, dan
                  pohon silsilah NasabQu) disimpan di perangkat Anda sendiri. Server relay
                  real-time hanya meneruskan sinyal antarperangkat yang sedang online.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900">1. Data yang Diproses</h4>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    <strong>Identitas Akun:</strong> Email &amp; No. HP/WhatsApp untuk sinkronisasi
                    lintas modul, verifikasi pedagang/pembeli AreaQu, dan tautan perangkat QR.
                  </li>
                  <li>
                    <strong>Lokasi GPS (Opsional &amp; Sesuai Izin):</strong> Hanya diakses saat Anda
                    mengaktifkan fitur Peta AreaQu, Siaran Pedagang Keliling, atau tombol darurat
                    SiagaQu.
                  </li>
                  <li>
                    <strong>Mikrofon, Kamera &amp; Bluetooth:</strong> Hanya dipakai atas tindakan Anda
                    untuk Catat Suara, pemindaian QR/dokumen, dan cetak struk thermal Bluetooth.
                  </li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900">2. Cadangan &amp; Penghapusan Data</h4>
                <p className="text-[11px]">
                  Anda memegang kendali penuh untuk mengekspor cadangan terenkripsi, menyinkronkan ke
                  Google Drive pribadi, atau melakukan reset data perangkat kapan saja melalui menu{' '}
                  <strong>Akun Saya</strong>.
                </p>
              </div>
            </>
          )}

          {activeTab === 'ketentuan' && (
            <>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-extrabold">Disclaimer Darurat SiagaQu</div>
                  <p className="text-[11px]">
                    Fitur <strong>SiagaQu (SOS)</strong> adalah alat bantu komunikasi cepat antarwarga
                    dan lingkungan komunitas. Fitur ini <strong>bukan pengganti</strong> layanan
                    darurat resmi negara (Kepolisian 110, Panggilan Darurat 112, Ambulans 118/119,
                    atau Damkar 113). Dalam keadaan mengancam nyawa, segera hubungi nomor resmi
                    pemerintah setempat.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900">1. Etika Penggunaan Komunitas</h4>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    Dilarang mengirimkan sinyal SOS palsu, spam pengumuman keliling, atau informasi
                    menyesatkan di modul komunitas RTQu dan ChatQu.
                  </li>
                  <li>
                    Transaksi jual beli di AreaQu dan MuamalahQu dilakukan langsung antarwarga dan
                    pedagang; pastikan kejelasan harga, stok, dan alamat antar sebelum bertransaksi.
                  </li>
                  <li>
                    Untuk data penting (kas RT, silsilah trah, laporan usaha), pengguna disarankan
                    menjaga cadangan berkala agar aman saat berganti atau kehilangan perangkat.
                  </li>
                </ul>
              </div>
            </>
          )}

          {activeTab === 'hakcipta' && (
            <>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="text-sm font-black text-slate-900">WargaQu v{APP_VERSION}</div>
                <div className="text-[11px] font-semibold text-emerald-700">
                  Ekosistem Cerdas Warga, Komunitas &amp; UMKM
                </div>
                <div className="text-[11px] text-slate-600 pt-1">
                  &copy; 2026 WargaQu. Seluruh Hak Cipta Dilindungi Undang-Undang.
                </div>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <p>
                  Rancangan alur terpadu, struktur antarmuka, nama ekosistem modul (<strong>WargaQu,
                  RtQu, SiagaQu, AreaQu, UsahaQu, ModularQu, DompetQu, MuamalahQu, NasabQu, ChatQu,
                  dan Smart Care</strong>) merupakan karya cipta asli milik pengembang WargaQu.
                </p>
                <p>
                  Dilarang menggandakan, memperjualbelikan ulang kode sumber, mengkloning merek, atau
                  mendistribusikan ulang paket aplikasi tanpa izin tertulis dari pemilik resmi.
                </p>
                <p className="text-slate-500">
                  Pustaka dan peta terbuka (seperti OpenStreetMap) digunakan sesuai lisensi terbuka
                  masing-masing penyedia.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[42px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
};
