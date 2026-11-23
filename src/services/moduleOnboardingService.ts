import { AuthService } from './authService';

export type GuideModuleId =
  | 'dompetqu'
  | 'leluhurqu'
  | 'rtqu'
  | 'areaqu'
  | 'siagaqu'
  | 'muamalahqu'
  | 'usahaqu'
  | 'chatqu';

export interface ModuleGuideStep {
  title: string;
  desc: string;
}

export interface ModuleGuideFaq {
  q: string;
  a: string;
}

export interface ModuleGuideInfo {
  id: GuideModuleId;
  name: string;
  category: string;
  tagline: string;
  benefits: string[];
  steps: ModuleGuideStep[];
  privacyNote: string;
  faq: ModuleGuideFaq[];
}

export const MODULE_GUIDES: ModuleGuideInfo[] = [
  {
    id: 'dompetqu',
    name: 'DompetQu',
    category: 'Keuangan Pribadi Terisolasi',
    tagline: 'Catat gaji, belanja harian, kebutuhan rumah, jajan bocah, hingga ongkos kerja cukup lewat suara atau ketik cepat dengan privasi mata tertutup.',
    benefits: [
      'Menyatukan sisa saldo gabungan Dompet Cash, Tabungan ATM/Bank, dan E-Wallet dalam satu ringkasan privat.',
      'Smart Catat Suara mengubah ucapan panjang sekaligus menjadi tabel edit yang bisa dicek sebelum disimpan.',
      'Terisolasi ketat per akun dengan ikon mata tertutup otomatis saat dibuka serta opsi kunci PIN 4–6 digit.',
    ],
    steps: [
      {
        title: 'Ketuk Mikrofon Catat Suara',
        desc: 'Sebutkan sekaligus seperti: "gaji 5 juta masuk atm, belanja 100rb cash, jajan bocah 20rb, ongkos kerja 30rb, makan 35rb".',
      },
      {
        title: 'Periksa & Revisi di Tabel Edit',
        desc: 'Sesuaikan nominal, kategori, atau kantong sumber (Cash / ATM / E-Wallet) sebelum menekan Simpan.',
      },
      {
        title: 'Pantau Pos & Aktifkan PIN Privasi',
        desc: 'Atur batas anggaran bulanan di tab Anggaran dan pasang PIN pribadi di tab Privasi agar aman dari intipan.',
      },
    ],
    privacyNote: 'Data DompetQu 100% terisolasi pada akun Anda dan tidak dibagikan ke RTQu, pengurus, atau pengguna lain.',
    faq: [
      {
        q: 'Apakah orang lain atau pengurus RT bisa melihat saldo DompetQu saya?',
        a: 'Tidak bisa. DompetQu disimpan terpisah khusus untuk akun Anda saja, dan saldo otomatis tertutup ikon mata saat aplikasi dibuka.',
      },
    ],
  },
  {
    id: 'leluhurqu',
    name: 'NasabQu',
    category: 'Silsilah Keluarga',
    tagline: 'Catat pohon nasab lintas generasi, undang saudara lewat 1 link ringkas, hingga cetak buku & poster A0–A4.',
    benefits: [
      'Menyimpan garis keturunan hingga 4 trah keluarga (Ayah, Ibu, Ayah Pasangan, Ibu Pasangan) secara rapi.',
      'Kanvas Grid Interaktif & Smart Layout anti-tumpuk untuk merapikan puluhan hingga ratusan anggota.',
      'Undangan 1-klik otomatis memasukkan keluarga ke trah tanpa perlu input ulang dari nol.',
    ],
    steps: [
      {
        title: 'Buat Trah Baru atau Terima Link Undangan',
        desc: 'Akun baru dimulai bersih (0 trah). Tekan + Buat Trah Baru atau tempel link undangan keluarga.',
      },
      {
        title: 'Isi Cepat dengan Pemisah Koma',
        desc: 'Gunakan fitur Isi Cepat (contoh: Budi, Siti (P), Andi) untuk mendaftarkan beberapa anak sekaligus.',
      },
      {
        title: 'Rapikan di Grid & Cetak PDF',
        desc: 'Gunakan Smart Rekomendasi di Kanvas Grid atau ekspor Buku Leluhur (A4/A5/A6) dan tabel Excel CSV.',
      },
    ],
    privacyNote: 'Data silsilah tersimpan aman di perangkat akun Anda dan hanya berpindah saat Anda membagikan link undangan.',
    faq: [
      {
        q: 'Kenapa akun baru tidak melihat data trah lama?',
        a: 'Demi privasi keluarga, akun baru memang dimulai kosong dan hanya menampilkan trah yang dibuat sendiri atau yang diundang.',
      },
      {
        q: 'Bagaimana mengubah Pria / Wanita anggota?',
        a: 'Klik langsung lencana 👨 L / 👩 P di Tabel Excel, halaman Detail Anggota, atau panel Edit Kartu pada Kanvas Grid.',
      },
    ],
  },
  {
    id: 'rtqu',
    name: 'RTQu & PaguyubanQu',
    category: 'Lingkungan & Organisasi',
    tagline: 'Kelola RT, Paguyuban warga, Ormas/Kampus, hingga lembaga sosial (DKM/Panti) dalam satu ruang transparan.',
    benefits: [
      'Mendukung banyak komunitas paralel: RT aktif, Paguyuban warga, organisasi/partai/mahasiswa, maupun DKM/panti sosial.',
      'Transparansi buku kas real-time & kartu iuran 12 bulan per KK yang bisa dicek langsung oleh warga.',
      'Undangan warga 1-link ringkas agar anggota baru langsung tergabung ke komunitas yang tepat.',
    ],
    steps: [
      {
        title: 'Gabung Undangan atau Buat Komunitas Baru',
        desc: 'Jika belum ada RT/Paguyuban, pilih Buat Baru dan tentukan jenisnya (RT, Paguyuban, Organisasi, atau Sosial).',
      },
      {
        title: 'Klaim Profil & Cek Iuran',
        desc: 'Ketuk header profil untuk mengklaim nama warga Anda, lalu buka tab Iuran 12 Bulan atau Kas RT.',
      },
      {
        title: 'Kelola Pengurus & Undang Warga',
        desc: 'Aktifkan Mode Pengurus untuk mencatat transaksi kas, membuka iuran, atau menyebarkan link undangan warga.',
      },
    ],
    privacyNote: 'Hanya anggota yang menerima link undangan atau pembuat komunitas yang dapat melihat data internal lingkungan.',
    faq: [
      {
        q: 'Bagaimana jika di perumahan yang aktif Paguyuban bukan RT?',
        a: 'Anda bisa membuat atau bergabung ke mode PaguyubanQu saja secara opsional, atau menjalankan keduanya paralel.',
      },
      {
        q: 'Apakah lembaga sosial (DKM/Panti) bisa menerima sumbangan?',
        a: 'Bisa. Pilih tipe Sosial/DKM agar catatan donasi dan info lapak sosial bisa tampil terhubung ke AreaQu.',
      },
    ],
  },
  {
    id: 'areaqu',
    name: 'AreaQu',
    category: 'Peta & Radar Sekitar',
    tagline: 'Temukan UMKM warga, warung makan, pos keamanan, masjid/DKM, dan kegiatan sosial di radius sekitar Anda.',
    benefits: [
      'Peta interaktif radius sekitar (500 m – 5 km) untuk mencari usaha dan layanan warga terdekat.',
      'Menampilkan lapak UMKM, rumah makan, organisasi sosial/DKM, serta sumbangan terbuka di lingkungan sekitar.',
      'Terhubung langsung dengan ChatQu dan UsahaQu untuk pesan atau tanya lokasi cepat.',
    ],
    steps: [
      {
        title: 'Setel Titik GPS atau Pilih Lokasi',
        desc: 'Ketuk tombol Radar GPS di bagian atas untuk menentukan posisi Anda agar jarak sekitar akurat.',
      },
      {
        title: 'Filter Kategori & Radius',
        desc: 'Pilih kategori (Kuliner, Jasa, DKM/Sosial, UMKM) dan geser jarak radius sesuai kebutuhan.',
      },
      {
        title: 'Buka Lapak Sendiri (Opsional)',
        desc: 'Masuk ke tab Lapak Saya untuk mempublikasikan usaha, warung, atau titik bakti sosial Anda ke peta warga.',
      },
    ],
    privacyNote: 'Lokasi GPS hanya dipakai untuk menghitung jarak di layar dan tidak dipublikasikan tanpa izin Anda.',
    faq: [
      {
        q: 'Kenapa titik peta belum tepat di rumah saya?',
        a: 'Ketuk kotak Radar di header atas untuk kalibrasi ulang GPS atau pilih titik lokasi secara manual di peta.',
      },
    ],
  },
  {
    id: 'siagaqu',
    name: 'SiagaQu',
    category: 'Keselamatan & Darurat',
    tagline: 'Tombol darurat SOS tahan 3 detik, radar darurat keluarga/RT, pemandu darurat (NaviQu), dan pengaman HP hilang.',
    benefits: [
      'Sinyal SOS cepat ke lingkaran Keluarga, Perusahaan, atau Warga RT sekitar (500 m – 3 km).',
      'Fitur SandiQu (suar darurat banjir) dan MorseQu untuk komunikasi saat jaringan lemah atau gelap.',
      'Perlindungan HP Hilang/Rusak di Zero Trust untuk membekukan akses perangkat lama dari jarak jauh.',
    ],
    steps: [
      {
        title: 'Tentukan Jangkauan (Umum RT atau Pribadi)',
        desc: 'Pilih lingkar Keluarga/Pribadi untuk kontak terdekat, atau Umum RT bila butuh bantuan warga sekitar.',
      },
      {
        title: 'Coba Mode Simulasi Terlebih Dahulu',
        desc: 'Gunakan mode Simulasi agar Anda familier menekan tombol SOS 3 detik tanpa mengirim alarm sungguhan.',
      },
      {
        title: 'Undang Kontak Tepercaya',
        desc: 'Tambahkan anggota keluarga inti ke lingkaran siaga agar notifikasi darurat langsung diterima orang terdekat.',
      },
    ],
    privacyNote: 'Layanan keselamatan dasar Pribadi dan RT selalu gratis serta terikat identitas perangkat secara aman.',
    faq: [
      {
        q: 'Apakah tombol SOS langsung bunyi jika tersentuh tak sengaja?',
        a: 'Tidak. Tombol utama harus ditahan selama 3 detik penuh untuk mencegah sinyal darurat palsu.',
      },
    ],
  },
  {
    id: 'muamalahqu',
    name: 'MuamalahQu',
    category: 'Pasar Warga',
    tagline: 'Marketplace internal warga untuk jual-beli produk harian, kuliner tetangga, dan kebutuhan keluarga.',
    benefits: [
      'Belanja langsung dari sesama warga/UMKM sekitar tanpa perantara rumit.',
      'Keranjang belanja cepat, pilih alamat blok/RT, dan langsung terhubung ke penjual lewat ChatQu.',
      'Mendukung pemilik toko warga mengatur produk dan pesanan masuk dari satu tempat.',
    ],
    steps: [
      {
        title: 'Cari Produk atau Jelajahi Kategori',
        desc: 'Gunakan kolom pencarian di atas untuk menemukan makanan, sembako, atau jasa warga.',
      },
      {
        title: 'Masukkan Keranjang & Cek Ringkasan',
        desc: 'Pilih jumlah barang lalu buka ikon keranjang untuk memeriksa rincian pesanan.',
      },
      {
        title: 'Checkout atau Hubungi Penjual',
        desc: 'Selesaikan checkout atau tekan ikon Chat untuk konfirmasi stok dan pengantaran ke blok Anda.',
      },
    ],
    privacyNote: 'Transaksi dicatat secara lokal pada akun Anda untuk kemudahan riwayat belanja warga.',
    faq: [
      {
        q: 'Bagaimana cara warga ikut berjualan?',
        a: 'Buka menu Pengaturan Toko di MuamalahQu atau kelola daftar menu langsung melalui modul UsahaQu.',
      },
    ],
  },
  {
    id: 'usahaqu',
    name: 'UsahaQu & POS Modular',
    category: 'Kasir & UMKM',
    tagline: 'Kasir 2-in-1: Mode Resto Meja lengkap & Mode POS Modular Suara untuk mencatat pesanan UMKM secepat kilat.',
    benefits: [
      'Dua mode dalam satu layar: denah meja restoran/warung atau kasir modular cepat pakai suara.',
      'Kelola stok bahan baku, hitung omset harian, cetak struk PDF maupun printer termal Bluetooth.',
      'Cocok untuk warung makan, toko kelontong, jasa laundry, hingga stan bazar warga.',
    ],
    steps: [
      {
        title: 'Pilih Mode Resto atau ModularQu',
        desc: 'Gunakan pengalih di bar atas untuk memilih tampilan meja restoran atau kasir modular serbaguna.',
      },
      {
        title: 'Catat Pesanan (Tap atau Voice)',
        desc: 'Ketuk menu yang dipesan pelanggan atau tekan tombol rekam suara untuk input cepat.',
      },
      {
        title: 'Terima Bayar & Cetak Struk',
        desc: 'Selesaikan pembayaran dan pilih simpan struk PDF atau cetak ke printer Bluetooth.',
      },
    ],
    privacyNote: 'Laporan omset, bahan baku, dan riwayat nota tersimpan aman pada perangkat kasir Anda.',
    faq: [
      {
        q: 'Apakah bisa dipakai tanpa printer Bluetooth?',
        a: 'Bisa. Anda tetap dapat menyimpan transaksi atau mengunduh struk dalam format PDF untuk dikirim lewat WhatsApp.',
      },
    ],
  },
  {
    id: 'chatqu',
    name: 'ChatQu',
    category: 'Komunikasi Warga',
    tagline: 'Ruang obrolan warga, grup blok/komunitas, pengumuman resmi pengurus, dan koordinasi darurat.',
    benefits: [
      'Memisahkan percakapan pribadi, grup warga/RT, dan kanal pengumuman penting agar tidak tenggelam.',
      'Terintegrasi dengan RTQu, MuamalahQu, dan SiagaQu untuk koordinasi langsung antarmodul.',
      'Pencarian cepat untuk melacak pesan pengumuman atau kontak penjual warga.',
    ],
    steps: [
      {
        title: 'Pilih Tab Komunitas, Chat, atau Pengumuman',
        desc: 'Gunakan tab di bawah header untuk berpindah antara pesan personal, grup warga, dan info resmi.',
      },
      {
        title: 'Cari Topik atau Nama Warga',
        desc: 'Ketuk ikon kaca pembesar di kanan atas untuk mencari riwayat obrolan secara cepat.',
      },
      {
        title: 'Kirim Kabar atau Lampiran Foto',
        desc: 'Masuk ke ruang obrolan dan kirim teks koordinasi kepada tetangga atau pengurus.',
      },
    ],
    privacyNote: 'Percakapan tersimpan lokal pada profil akun Anda dan tidak dibagikan ke luar lingkungan aplikasi.',
    faq: [
      {
        q: 'Bagaimana menghubungi penjual dari pasar warga?',
        a: 'Ketuk tombol Chat di MuamalahQu atau AreaQu, maka ruang obrolan penjual akan langsung terbuka di ChatQu.',
      },
    ],
  },
];

const SEEN_STORAGE_PREFIX = 'wargaqu_module_guides_seen_v1_';
export const OPEN_MODULE_GUIDE_EVENT = 'wargaqu-open-module-guide';
export const MODULE_GUIDE_SYNC_EVENT = 'wargaqu-module-guide-sync';

function getCurrentScopeKey(): string {
  const acc = AuthService.getAccount();
  if (!acc || !acc.email) return 'guest';
  return acc.email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function getSeenStorageKey(): string {
  return `${SEEN_STORAGE_PREFIX}${getCurrentScopeKey()}`;
}

function readSeenMap(): Partial<Record<GuideModuleId, boolean>> {
  try {
    const raw = localStorage.getItem(getSeenStorageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function emitGuideSync(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MODULE_GUIDE_SYNC_EVENT));
  }
}

export const ModuleOnboardingService = {
  getAllGuides(): ModuleGuideInfo[] {
    return MODULE_GUIDES;
  },

  getGuide(moduleId: GuideModuleId): ModuleGuideInfo {
    return MODULE_GUIDES.find((g) => g.id === moduleId) || MODULE_GUIDES[0];
  },

  hasSeen(moduleId: GuideModuleId): boolean {
    const map = readSeenMap();
    return Boolean(map[moduleId]);
  },

  markSeen(moduleId: GuideModuleId): void {
    try {
      const map = readSeenMap();
      map[moduleId] = true;
      localStorage.setItem(getSeenStorageKey(), JSON.stringify(map));
      emitGuideSync();
    } catch {
      // ignore storage errors
    }
  },

  resetAllSeen(): void {
    try {
      localStorage.removeItem(getSeenStorageKey());
      emitGuideSync();
    } catch {
      // ignore
    }
  },

  openGuide(moduleId: GuideModuleId): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(OPEN_MODULE_GUIDE_EVENT, { detail: { moduleId } })
      );
    }
  },

  formatShareText(moduleId: GuideModuleId): string {
    const g = this.getGuide(moduleId);
    const lines = [
      `*PANDUAN MODUL ${g.name.toUpperCase()} — WargaQu*`,
      `${g.tagline}`,
      '',
      '*Manfaat Utama:*',
      ...g.benefits.map((b, idx) => `${idx + 1}. ${b}`),
      '',
      '*Cara Mulai Cepat:*',
      ...g.steps.map((s, idx) => `${idx + 1}. ${s.title} — ${s.desc}`),
    ];
    return lines.join('\n');
  },

  shareToWhatsApp(moduleId: GuideModuleId): void {
    const text = this.formatShareText(moduleId);
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  },
};
