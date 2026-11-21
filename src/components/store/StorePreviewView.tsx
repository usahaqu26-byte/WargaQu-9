import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Lock,
  MapPin,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { WargaQuLogoIcon } from '../common/WargaQuLogo';
import { LegalNoticeModal, LegalTab } from '../common/LegalNoticeModal';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { getPublicShareOrigin, isNativeCapacitorApk } from '../../services/appOriginService';
import {
  APP_VERSION,
  inferGitHubRepoSlug,
  saveGitHubRepoSlug,
} from '../../config/appVersion';
import { ApkUpdateService } from '../../services/apkUpdateService';

export type PreviewTargetScreen =
  | 'warga'
  | 'areaqu'
  | 'usahaqu'
  | 'leluhurqu'
  | 'rtqu'
  | 'siagaqu'
  | 'dompetqu'
  | 'muamalahqu';

interface StorePreviewViewProps {
  onEnterApp: (targetScreen?: PreviewTargetScreen) => void;
  showNotification: (msg: string) => void;
}

interface ModuleShowcaseItem {
  id: PreviewTargetScreen;
  title: string;
  subtitle: string;
  caption: string;
  accentBg: string;
  accentText: string;
  highlights: string[];
}

const MODULE_SHOWCASE: ModuleShowcaseItem[] = [
  {
    id: 'areaqu',
    title: 'AreaQu Keliling',
    subtitle: 'Radar Pedagang & GPS',
    caption: 'Pantau gerobak & motor keliling dinamis real-time beserta pesan panggil.',
    accentBg: 'bg-emerald-900',
    accentText: 'text-emerald-100',
    highlights: ['Pelacakan kecepatan & rute', 'Pesan antar / panggil lapak', 'Filter jarak radius warga'],
  },
  {
    id: 'usahaqu',
    title: 'UsahaQu POS',
    subtitle: 'Kasir Resto & ModularQu',
    caption: 'POS meja restoran & kasir suara cerdas dengan cetak struk Bluetooth.',
    accentBg: 'bg-slate-900',
    accentText: 'text-slate-100',
    highlights: ['Denah meja & bungkus', 'Printer thermal 58mm/80mm', 'Laporan omset PDF & Excel'],
  },
  {
    id: 'leluhurqu',
    title: 'LeluhurQu',
    subtitle: 'Silsilah A3 & Kuis Trah',
    caption: 'Pohon keluarga modular 100+ anggota siap cetak A3 dan kuis trah seru.',
    accentBg: 'bg-teal-900',
    accentText: 'text-teal-100',
    highlights: ['Poros G1-G2 & grid padat A3', 'Kuis 300+ soal + sponsor hadiah', 'Rekap skor & undangan QR'],
  },
  {
    id: 'rtqu',
    title: 'RTQu & Paguyuban',
    subtitle: 'Tata Kelola Lingkungan',
    caption: 'Kelola iuran, kas transparan, forum warga, dan direktori pengurus.',
    accentBg: 'bg-emerald-800',
    accentText: 'text-emerald-50',
    highlights: ['Buku kas & iuran real-time', 'Impor daftar warga Excel', 'Aktivasi SiagaQu terverifikasi'],
  },
  {
    id: 'siagaqu',
    title: 'SiagaQu SOS',
    subtitle: 'Radar Keamanan Warga',
    caption: 'Peringatan darurat komunitas terverifikasi pengurus RT & pelacak HP.',
    accentBg: 'bg-rose-900',
    accentText: 'text-rose-100',
    highlights: ['Radius 500m-3km terverifikasi', 'Cari HP hilang & grup keluarga', 'Disclaimer layanan darurat resmi'],
  },
  {
    id: 'dompetqu',
    title: 'DompetQu',
    subtitle: 'Keuangan Pribadi Terisolasi',
    caption: 'Catat pemasukan dan pengeluaran harian via ketik atau suara cerdas.',
    accentBg: 'bg-slate-800',
    accentText: 'text-slate-100',
    highlights: ['Privasi saldo tersembunyi', 'Cadangan terenkripsi AES-GCM', 'Ekspor catatan CSV pribadi'],
  },
];

function buildStoreShareUrl(repoSlug: string): string {
  if (typeof window === 'undefined') return '';
  const baseHref = isNativeCapacitorApk() ? getPublicShareOrigin() : window.location.href;
  const url = new URL(baseHref);
  url.searchParams.set('preview', 'store');
  if (repoSlug) {
    url.searchParams.set('repo', repoSlug);
  }
  url.hash = '';
  return url.toString();
}

export const StorePreviewView: React.FC<StorePreviewViewProps> = ({
  onEnterApp,
  showNotification,
}) => {
  const { isInstallable, isInstalled, isNativeApk, isIOS, install } = usePWAInstall();

  const [repoSlug, setRepoSlug] = useState<string>(() => inferGitHubRepoSlug());
  const [repoDraft, setRepoDraft] = useState<string>(() => inferGitHubRepoSlug());
  const [editingRepo, setEditingRepo] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeSlide, setActiveSlide] = useState<ModuleShowcaseItem | null>(null);
  const [legalModal, setLegalModal] = useState<{ open: boolean; tab: LegalTab }>({
    open: false,
    tab: 'privasi',
  });
  const [releaseCheck, setReleaseCheck] = useState<{
    status: 'idle' | 'checking' | 'ready' | 'missing' | 'error';
    tag?: string;
    downloadUrl?: string;
    hasUpdate?: boolean;
    message?: string;
  }>({ status: 'idle' });
  const [apkUpdateProgress, setApkUpdateProgress] = useState<number | null>(null);
  const [apkPermissionNeeded, setApkPermissionNeeded] = useState<boolean>(false);

  const apkDirectUrl = useMemo(() => {
    if (!repoSlug) return '';
    return `https://github.com/${repoSlug}/releases/latest/download/WargaQu-latest.apk`;
  }, [repoSlug]);

  const releasesPageUrl = useMemo(() => {
    if (!repoSlug) return '';
    return `https://github.com/${repoSlug}/releases/latest`;
  }, [repoSlug]);

  const storeShareUrl = useMemo(() => buildStoreShareUrl(repoSlug), [repoSlug]);

  const handleInstallPwa = async () => {
    if (isInstalled) {
      showNotification('WargaQu sudah terpasang di perangkat ini. Membuka aplikasi...');
      onEnterApp('warga');
      return;
    }

    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        showNotification('WargaQu berhasil dipasang! Cek ikon di layar utama.');
        return;
      }
      if (outcome === 'dismissed') {
        showNotification('Pemasangan dibatalkan. Anda tetap bisa mencoba pratinjau web.');
        return;
      }
    }

    if (isIOS) {
      setShowIosGuide((prev) => !prev);
      return;
    }

    showNotification(
      'Ketuk menu browser (⋮) lalu pilih "Tambahkan ke layar utama" atau "Install app" untuk memasang PWA.'
    );
  };

  const handleSaveRepoSlug = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveGitHubRepoSlug(repoDraft);
    if (!saved) {
      showNotification('Masukkan format repositori GitHub: username/nama-repo');
      return;
    }
    setRepoSlug(saved);
    setRepoDraft(saved);
    setEditingRepo(false);
    setReleaseCheck({ status: 'idle' });
    showNotification(`Tautan unduh APK terhubung ke ${saved}`);
  };

  const handleCheckLatestRelease = async () => {
    if (!repoSlug) {
      setEditingRepo(true);
      showNotification('Isi username/nama-repo GitHub terlebih dahulu untuk mengecek APK rilis.');
      return;
    }
    setReleaseCheck({ status: 'checking' });
    try {
      const status = await ApkUpdateService.checkForUpdate(true);
      if (status.source === 'bundle' && !status.apkDownloadUrl) {
        setReleaseCheck({
          status: 'missing',
          message:
            'Belum ada GitHub Release. Jalankan workflow build APK di tab Actions GitHub satu kali.',
        });
        return;
      }
      setReleaseCheck({
        status: 'ready',
        tag: `v${status.latestVersion}`,
        downloadUrl: status.apkDownloadUrl || apkDirectUrl,
        hasUpdate: status.hasUpdate,
        message: status.hasUpdate
          ? `Versi baru v${status.latestVersion} tersedia (terpasang v${status.installedVersion}). Siap timpa langsung!`
          : `Rilis terbaru v${status.latestVersion} terdeteksi (perangkat memakai v${status.installedVersion}).`,
      });
    } catch {
      setReleaseCheck({
        status: 'error',
        message: 'Tidak dapat menghubungi API GitHub saat ini. Gunakan tombol Unduh APK langsung.',
      });
    }
  };

  const handleNativeApkTimpa = async () => {
    const targetUrl = releaseCheck.downloadUrl || apkDirectUrl;
    if (!targetUrl) {
      setEditingRepo(true);
      showNotification('Isi username/nama-repo GitHub terlebih dahulu untuk unduh APK.');
      return;
    }
    setApkPermissionNeeded(false);
    setApkUpdateProgress(0);
    try {
      const outcome = await ApkUpdateService.downloadAndInstallUpdate(targetUrl, pct =>
        setApkUpdateProgress(pct)
      );
      setApkUpdateProgress(null);
      if (outcome.outcome === 'permission_required') {
        setApkPermissionNeeded(true);
      }
      showNotification(outcome.message);
    } catch (err) {
      setApkUpdateProgress(null);
      showNotification(err instanceof Error ? err.message : 'Gagal mengunduh file APK.');
    }
  };

  const handleShareStore = async () => {
    const shareData = {
      title: 'WargaQu - Ekosistem Warga & UMKM',
      text: 'Coba pratinjau WargaQu sebelum unduh APK atau pasang langsung versi PWA lintas perangkat.',
      url: storeShareUrl,
    };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fallback copy
      }
    }
    try {
      await navigator.clipboard.writeText(storeShareUrl);
      setCopiedLink(true);
      showNotification('Tautan halaman pratinjau berhasil disalin!');
      window.setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      showNotification('Salin URL dari bilah alamat browser untuk membagikan pratinjau.');
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-white text-slate-900 select-text">
      {/* 3-Zone Sticky Store Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onEnterApp('warga');
            }}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            WargaQu
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#pratinjau" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Pratinjau
            </a>
            <a href="#fitur" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Fitur
            </a>
            <a href="#keamanan" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              Keamanan Data
            </a>
            <a href="#rilis" className="hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0">
              PWA &amp; APK
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEnterApp('warga')}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition whitespace-nowrap shrink-0"
            >
              Buka Web App
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10">
        {/* HERO PLAY STORE HEADER */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-900 flex items-center justify-center shadow-md shrink-0">
              <WargaQuLogoIcon uid="store_hero" className="w-14 h-14 sm:w-16 sm:h-16" />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
                WargaQu - Ekosistem Cerdas Warga &amp; UMKM
              </h1>
              <p className="text-sm font-semibold text-emerald-700">
                WargaQu Official
              </p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 tabular-nums">
                <span>Versi {APP_VERSION}</span>
                <span aria-hidden="true">·</span>
                <span>Gratis</span>
                <span aria-hidden="true">·</span>
                <span>Android 7.0+ &amp; PWA Lintas Perangkat</span>
                <span aria-hidden="true">·</span>
                <span>Tanpa Iklan</span>
              </div>
            </div>
          </div>

          {/* 3-Column Store Metrics Strip */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-3.5 text-center sm:max-w-lg">
            <div className="px-2">
              <div className="text-sm sm:text-base font-extrabold text-slate-900 tabular-nums">
                7 Modul
              </div>
              <div className="text-[11px] text-slate-500">RT, Radar, Kasir, Trah</div>
            </div>
            <div className="px-2">
              <div className="text-sm sm:text-base font-extrabold text-slate-900 tabular-nums">
                v{APP_VERSION}
              </div>
              <div className="text-[11px] text-slate-500">Auto-Update PWA</div>
            </div>
            <div className="px-2">
              <div className="text-sm sm:text-base font-extrabold text-slate-900">
                100% Lokal
              </div>
              <div className="text-[11px] text-slate-500">Enkripsi &amp; Cloud Opsional</div>
            </div>
          </div>

          {/* Primary Action Controls */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={handleInstallPwa}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
            >
              <Smartphone className="w-4 h-4" />
              <span>
                {isNativeApk
                  ? 'Aplikasi Android Terpasang · Buka Sekarang'
                  : isInstalled
                  ? 'Aplikasi Terpasang · Buka Sekarang'
                  : isIOS
                  ? 'Pasang di iPhone / iPad (PWA)'
                  : 'Pasang Instan (PWA)'}
              </span>
            </button>

            {isNativeApk && apkDirectUrl ? (
              apkPermissionNeeded ? (
                <button
                  type="button"
                  onClick={() => void ApkUpdateService.openInstallPermissionSettings()}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-amber-500 bg-amber-50 hover:bg-amber-100 text-amber-900 text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  <span>Buka Izin Pasang APK</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={apkUpdateProgress !== null}
                  onClick={() => void handleNativeApkTimpa()}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap disabled:opacity-60"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>
                    {apkUpdateProgress !== null
                      ? `Mengunduh APK (${apkUpdateProgress}%)...`
                      : releaseCheck.hasUpdate
                      ? `Download & Timpa ${releaseCheck.tag || ''}`
                      : 'Unduh & Timpa APK Terbaru'}
                  </span>
                </button>
              )
            ) : apkDirectUrl ? (
              <a
                href={releaseCheck.downloadUrl || apkDirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 hover:border-emerald-700 hover:bg-emerald-50/40 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-emerald-700" />
                <span>Unduh Android (.apk)</span>
              </a>
            ) : !isNativeApk ? (
              <button
                type="button"
                onClick={() => setEditingRepo(true)}
                className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 hover:border-emerald-700 hover:bg-emerald-50/40 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-emerald-700" />
                <span>Hubungkan Link APK GitHub</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditingRepo(true)}
                className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-300 hover:border-emerald-700 hover:bg-emerald-50/40 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-emerald-700" />
                <span>Atur Repo Update APK</span>
              </button>
            )}

            {!isNativeApk && (
              <button
                type="button"
                onClick={() => onEnterApp('warga')}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
              >
                <span>Coba Pratinjau Web</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleShareStore}
              className="min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 transition whitespace-nowrap"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-700" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span>{copiedLink ? 'Tersalin' : 'Bagikan'}</span>
            </button>
          </div>

          {/* iOS Install Guide Drawer (Inline) */}
          {showIosGuide && (
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 text-xs text-slate-700 space-y-2 max-w-xl">
              <div className="font-bold text-slate-900 flex items-center justify-between">
                <span>Cara Pasang WargaQu di Safari iPhone / iPad</span>
                <button
                  type="button"
                  onClick={() => setShowIosGuide(false)}
                  className="p-1 text-slate-500 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Ketuk ikon Bagikan (kotak dengan panah ke atas) di bilah bawah Safari.</li>
                <li>Gulir lalu pilih <strong>Tambahkan ke Layar Utama</strong>.</li>
                <li>Ketuk <strong>Tambah</strong> — WargaQu langsung muncul sebagai aplikasi mandiri.</li>
              </ol>
            </div>
          )}

          {/* GitHub Repository & Release APK Link Status */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-emerald-700 shrink-0" />
                {repoSlug ? (
                  <span>
                    Sumber Rilis APK GitHub:{' '}
                    <strong className="text-slate-900 font-mono">{repoSlug}</strong>
                  </span>
                ) : (
                  <span>
                    Mode pratinjau mandiri. Hubungkan nama repositori GitHub agar tombol unduh APK
                    mengarah ke rilis Anda.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {repoSlug && (
                  <button
                    type="button"
                    onClick={handleCheckLatestRelease}
                    disabled={releaseCheck.status === 'checking'}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        releaseCheck.status === 'checking' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>Cek Rilis APK</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingRepo((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
                >
                  {editingRepo ? 'Tutup' : repoSlug ? 'Ubah Repo' : 'Atur Repo'}
                </button>
              </div>
            </div>

            {releaseCheck.status !== 'idle' && releaseCheck.message && (
              <div className="text-xs flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <span
                  className={
                    releaseCheck.status === 'ready'
                      ? 'text-emerald-800 font-semibold'
                      : 'text-amber-800'
                  }
                >
                  {releaseCheck.message}
                </span>
                {releasesPageUrl && (
                  <a
                    href={releasesPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <span>Buka GitHub Releases</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {editingRepo && (
              <form
                onSubmit={handleSaveRepoSlug}
                className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200"
              >
                <input
                  type="text"
                  value={repoDraft}
                  onChange={(e) => setRepoDraft(e.target.value)}
                  placeholder="contoh: usahaqu/wargaqu-app"
                  className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-xs font-mono focus:outline-none focus:border-emerald-700"
                />
                <button
                  type="submit"
                  className="min-h-[40px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition whitespace-nowrap"
                >
                  Simpan Tautan Repo
                </button>
              </form>
            )}
          </div>
        </section>

        {/* PRATINJAU VISUAL & GALERI MODUL ALA PLAY STORE */}
        <section id="pratinjau" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Pratinjau Modul &amp; Antarmuka</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ketuk kartu pratinjau untuk melihat detail atau mencoba modul secara langsung
              </p>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar snap-x">
            {/* Feature Graphic 16:9 */}
            <div className="shrink-0 w-[300px] sm:w-[360px] snap-start rounded-2xl overflow-hidden border border-slate-200 bg-emerald-950 flex flex-col justify-between">
              <div className="relative aspect-video w-full bg-emerald-900">
                <img
                  src="./wargaqu-share.jpg"
                  alt="Banner Ekosistem WargaQu"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
                  <div className="text-white">
                    <div className="text-xs font-bold text-emerald-300">WargaQu v{APP_VERSION}</div>
                    <div className="text-sm font-extrabold leading-snug">
                      Satu Aplikasi Warga, Keluarga &amp; UMKM
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3.5 bg-white flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600">Siap dipasang via PWA &amp; APK</span>
                <button
                  type="button"
                  onClick={() => onEnterApp('warga')}
                  className="text-xs font-bold text-emerald-700 hover:underline whitespace-nowrap"
                >
                  Coba Sekarang
                </button>
              </div>
            </div>

            {/* Phone-Frame Module Previews */}
            {MODULE_SHOWCASE.map((mod) => (
              <div
                key={mod.id}
                className="shrink-0 w-[220px] snap-start rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between"
              >
                <button
                  type="button"
                  onClick={() => setActiveSlide(mod)}
                  className="text-left flex-1 flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <div className={`${mod.accentBg} ${mod.accentText} p-4 space-y-1.5`}>
                    <div className="text-[11px] opacity-80">{mod.subtitle}</div>
                    <div className="text-base font-extrabold">{mod.title}</div>
                  </div>
                  <div className="p-4 space-y-2.5 flex-1">
                    <p className="text-xs text-slate-600 leading-relaxed">{mod.caption}</p>
                    <ul className="space-y-1 text-[11px] text-slate-700">
                      {mod.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
                <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveSlide(mod)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Lihat Ringkasan
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterApp(mod.id)}
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    Buka Modul
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TENTANG APLIKASI & PEMBARUAN */}
        <section id="fitur" className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-2 border-t border-slate-200">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Tentang Aplikasi Ini</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              WargaQu dirancang sebagai ekosistem digital ringan untuk kebutuhan lingkungan RT/RW,
              keluarga besar, hingga pelaku UMKM keliling dan kasir kedai. Data tersimpan cepat di
              perangkat sehingga tetap responsif meski sinyal lemah, serta mendukung sinkronisasi
              antar perangkat HP dan Laptop melalui akun terpadu maupun tautan QR.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <span>AreaQu Pedagang Keliling</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Radar gerobak, motor, dan lapak lokal dinamis lengkap dengan penanda kecepatan,
                  pesan panggil langsung, dan pelacakan radius GPS.
                </p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Store className="w-4 h-4 text-emerald-700" />
                  <span>UsahaQu POS &amp; ModularQu</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sistem kasir restoran/UMKM dengan denah meja, stok bahan, struk Bluetooth thermal,
                  dan pencatatan suara cerdas.
                </p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Users className="w-4 h-4 text-emerald-700" />
                  <span>LeluhurQu &amp; Kuis Trah</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tata letak silsilah keluarga besar 100+ anggota skala A3 tanpa garis kusut, serta
                  kuis trah keluarga interaktif berhadiah sponsor.
                </p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Wallet className="w-4 h-4 text-emerald-700" />
                  <span>RTQu, DompetQu &amp; SiagaQu</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Buku kas warga transparan, pencatatan keuangan pribadi terenkripsi, dan sinyal
                  bantuan komunitas terverifikasi pengurus RT.
                </p>
              </div>
            </div>
          </div>

          {/* Release Notes Column */}
          <aside className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Yang Baru di v{APP_VERSION}</h2>
            <div className="p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs text-slate-600">
              <div className="font-bold text-slate-900">Catatan Rilis Resmi</div>
              <ul className="space-y-2 leading-relaxed">
                <li>• Sesi tunggal aktif APK vs PWA (login di satu wadah menutup sesi lama di wadah lain).</li>
                <li>• Sinkronisasi data akun APK ↔ PWA lebih cepat dengan server relay bersama.</li>
                <li>• Sistem timpa APK (in-place update) memakai kunci penandatanganan tetap + pengunduh pembaruan bawaan.</li>
                <li>• Alur 3 langkah LeluhurQu (Ajukan → Admin Approve → Tarik Pembaruan) terisolasi per modul.</li>
              </ul>
            </div>
          </aside>
        </section>

        {/* KEAMANAN DATA (PLAY STORE DATA SAFETY STYLE) */}
        <section id="keamanan" className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Keamanan Data &amp; Privasi</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Penjelasan transparan mengenai cara WargaQu mengelola izin perangkat dan data Anda
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLegalModal({ open: true, tab: 'privasi' })}
              className="text-xs font-bold text-emerald-700 hover:underline self-start sm:self-auto"
            >
              Baca Kebijakan Lengkap
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl divide-y divide-slate-200">
            <div className="p-4 flex items-start gap-3">
              <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Penyimpanan Lokal &amp; Cadangan Terenkripsi
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Data DompetQu, kasir, dan silsilah dapat berjalan offline di perangkat dan
                  dicadangkan memakai enkripsi AES-GCM sebelum disimpan ke file atau Google Drive.
                </p>
              </div>
            </div>
            <div className="p-4 flex items-start gap-3">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Izin Lokasi GPS &amp; Bluetooth Opsional
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Lokasi hanya aktif ketika Anda membuka Radar AreaQu atau SiagaQu. Bluetooth hanya
                  dipakai saat mencetak struk thermal di UsahaQu POS.
                </p>
              </div>
            </div>
            <div className="p-4 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-900">
                  Disclaimer Layanan Darurat SiagaQu
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  SiagaQu merupakan alat koordinasi warga dan keluarga—bukan pengganti layanan
                  darurat resmi negara (110, 112, 118, 119, 113).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PERBANDINGAN PWA VS APK & AUTO-UPDATE */}
        <section id="rilis" className="space-y-4 pt-4 border-t border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Pilih PWA atau Unduh APK?</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Keduanya tersedia di repositori yang sama dengan karakteristik pembaruan berikut
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Pasang Instan (PWA) · Disarankan
                </h3>
                <Sparkles className="w-4 h-4 text-emerald-700" />
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>• Jalan di Android, iPhone/iPad (iOS), dan Laptop/PC.</li>
                <li>• Pembaruan aplikasi berjalan otomatis (Auto-Update via Service Worker).</li>
                <li>• Bebas peringatan "Sumber Tidak Dikenal" saat dipasang warga.</li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Unduh Android (.apk) · Native
                </h3>
                <Download className="w-4 h-4 text-slate-700" />
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700">
                <li>• Khusus perangkat Android; cocok untuk kasir harian UsahaQu POS.</li>
                <li>• File APK otomatis dibuat melalui GitHub Actions Releases.</li>
                <li>• Pembaruan APK di luar Play Store memerlukan konfirmasi pasang manual 1x ketuk.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 mt-8 py-6 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 WargaQu · Versi {APP_VERSION}</span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setLegalModal({ open: true, tab: 'privasi' })}
              className="hover:text-emerald-700"
            >
              Kebijakan Privasi
            </button>
            <button
              type="button"
              onClick={() => setLegalModal({ open: true, tab: 'ketentuan' })}
              className="hover:text-emerald-700"
            >
              Ketentuan &amp; Disclaimer
            </button>
            <button
              type="button"
              onClick={() => setLegalModal({ open: true, tab: 'hakcipta' })}
              className="hover:text-emerald-700"
            >
              Hak Cipta
            </button>
          </div>
        </div>
      </footer>

      {/* Module Preview Lightbox Modal */}
      {activeSlide && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 flex items-end sm:items-center justify-center p-3">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className={`${activeSlide.accentBg} ${activeSlide.accentText} p-5 flex items-start justify-between gap-3`}>
              <div>
                <div className="text-xs opacity-80">{activeSlide.subtitle}</div>
                <h3 className="text-lg font-extrabold">{activeSlide.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSlide(null)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">{activeSlide.caption}</p>
              <ul className="space-y-2 text-xs text-slate-800">
                {activeSlide.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = activeSlide.id;
                    setActiveSlide(null);
                    onEnterApp(target);
                  }}
                  className="flex-1 min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition"
                >
                  Coba Modul Ini Langsung
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide(null)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LegalNoticeModal
        isOpen={legalModal.open}
        onClose={() => setLegalModal((prev) => ({ ...prev, open: false }))}
        initialTab={legalModal.tab}
      />
    </div>
  );
};
