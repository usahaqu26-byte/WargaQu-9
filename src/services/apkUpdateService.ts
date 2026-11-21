import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import {
  APP_VERSION,
  APP_VERSION_CODE,
  compareSemver,
  inferGitHubRepoSlug,
  saveGitHubRepoSlug,
} from '../config/appVersion';
import { buildApiUrl, isNativeCapacitorApk } from './appOriginService';

interface AppUpdaterNativePlugin {
  getAppInfo(): Promise<{
    packageName: string;
    versionName: string;
    versionCode: number;
  }>;
  canRequestPackageInstalls(): Promise<{ allowed: boolean }>;
  openInstallPermissionSettings(): Promise<{ opened: boolean }>;
  downloadAndInstallApk(options: { url: string }): Promise<{
    status: 'installer_launched' | 'permission_required';
    filePath?: string;
  }>;
  addListener(
    eventName: 'apkDownloadProgress',
    listenerFunc: (data: { percent: number; downloadedBytes: number; totalBytes: number }) => void
  ): Promise<PluginListenerHandle>;
}

const AppUpdaterNative = registerPlugin<AppUpdaterNativePlugin>('AppUpdater');

export interface ApkUpdateStatus {
  checkedAt: string;
  isNativeApk: boolean;
  installedVersion: string;
  installedVersionCode: number;
  latestVersion: string;
  latestVersionCode: number;
  hasUpdate: boolean;
  source: 'github' | 'server' | 'bundle';
  repoSlug: string;
  apkDownloadUrl: string;
  releasePageUrl: string;
  releaseNotes: string;
  canAutoInstall: boolean;
}

const UPDATE_STATE_EVENT = 'wargaqu-apk-update-state';
const UPDATE_DISMISSED_VER_KEY = 'wargaqu_apk_update_dismissed_ver_v1';

let lastUpdateStatus: ApkUpdateStatus | null = null;
let lastCheckedMs = 0;

function emitUpdateStatus(status: ApkUpdateStatus) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ApkUpdateStatus>(UPDATE_STATE_EVENT, { detail: status }));
  }
}

export const APK_UPDATE_EVENT = UPDATE_STATE_EVENT;

export const ApkUpdateService = {
  getLastStatus(): ApkUpdateStatus | null {
    return lastUpdateStatus;
  },

  isVersionDismissed(version: string): boolean {
    try {
      return localStorage.getItem(UPDATE_DISMISSED_VER_KEY) === version;
    } catch {
      return false;
    }
  },

  dismissVersion(version: string): void {
    try {
      localStorage.setItem(UPDATE_DISMISSED_VER_KEY, version);
    } catch {
      // ignore
    }
  },

  async getInstalledNativeInfo(): Promise<{
    versionName: string;
    versionCode: number;
    canAutoInstall: boolean;
  }> {
    if (!isNativeCapacitorApk() || !Capacitor.isNativePlatform()) {
      return {
        versionName: APP_VERSION,
        versionCode: APP_VERSION_CODE,
        canAutoInstall: false,
      };
    }
    try {
      const [info, perm] = await Promise.all([
        AppUpdaterNative.getAppInfo(),
        AppUpdaterNative.canRequestPackageInstalls().catch(() => ({ allowed: true })),
      ]);
      return {
        versionName: info.versionName || APP_VERSION,
        versionCode: Number(info.versionCode) || APP_VERSION_CODE,
        canAutoInstall: Boolean(perm.allowed),
      };
    } catch {
      return {
        versionName: APP_VERSION,
        versionCode: APP_VERSION_CODE,
        canAutoInstall: false,
      };
    }
  },

  async checkForUpdate(force = false): Promise<ApkUpdateStatus> {
    const now = Date.now();
    if (!force && lastUpdateStatus && now - lastCheckedMs < 45 * 1000) {
      return lastUpdateStatus;
    }

    const native = isNativeCapacitorApk();
    const installed = await this.getInstalledNativeInfo();
    let repoSlug = inferGitHubRepoSlug();

    let latestVersion = APP_VERSION;
    let latestVersionCode = APP_VERSION_CODE;
    let apkDownloadUrl = '';
    let releasePageUrl = '';
    let releaseNotes = '';
    let source: 'github' | 'server' | 'bundle' = 'bundle';

    // 1. Check WargaQu server /api/app-version (works across APK, PWA, and custom relay)
    try {
      const qs = repoSlug ? `?repo=${encodeURIComponent(repoSlug)}` : '';
      const res = await fetch(buildApiUrl(`/api/app-version${qs}`), {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as {
            version?: string;
            versionCode?: number;
            githubRepo?: string;
            apkDownloadUrl?: string;
            releasePageUrl?: string;
            changelog?: string[];
          };
          if (data.githubRepo && !repoSlug) {
            repoSlug = saveGitHubRepoSlug(data.githubRepo) || data.githubRepo;
          }
          if (data.version && compareSemver(data.version, latestVersion) >= 0) {
            latestVersion = data.version;
            latestVersionCode = Math.max(latestVersionCode, Number(data.versionCode || 0));
            source = 'server';
          }
          if (data.apkDownloadUrl) apkDownloadUrl = data.apkDownloadUrl;
          if (data.releasePageUrl) releasePageUrl = data.releasePageUrl;
          if (Array.isArray(data.changelog) && data.changelog.length > 0) {
            releaseNotes = data.changelog.join(' · ');
          }
        }
      }
    } catch {
      // fallback to direct GitHub Releases check below
    }

    // 2. Direct GitHub Releases check (works even if Cloud Run relay is offline or behind)
    if (repoSlug) {
      try {
        const ghRes = await fetch(`https://api.github.com/repos/${repoSlug}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (ghRes.ok) {
          const gh = (await ghRes.json()) as {
            tag_name?: string;
            html_url?: string;
            body?: string;
            assets?: Array<{ name?: string; browser_download_url?: string }>;
          };
          const ghVer = (gh.tag_name || '').replace(/^v/i, '').trim();
          const apkAsset =
            gh.assets?.find(a => (a.name || '').toLowerCase() === 'wargaqu-latest.apk') ||
            gh.assets?.find(a => (a.name || '').toLowerCase().endsWith('.apk'));

          if (ghVer && compareSemver(ghVer, latestVersion) >= 0) {
            latestVersion = ghVer;
            if (compareSemver(ghVer, APP_VERSION) > 0) {
              latestVersionCode = Math.max(latestVersionCode, installed.versionCode + 1);
            }
            source = 'github';
          }
          if (apkAsset?.browser_download_url) {
            apkDownloadUrl = apkAsset.browser_download_url;
          } else if (!apkDownloadUrl) {
            apkDownloadUrl = `https://github.com/${repoSlug}/releases/latest/download/WargaQu-latest.apk`;
          }
          if (gh.html_url) {
            releasePageUrl = gh.html_url;
          }
          if (gh.body && !releaseNotes) {
            releaseNotes = gh.body.split('\n')[0].trim().slice(0, 180);
          }
        }
      } catch {
        // ignore GitHub rate-limit/network errors
      }
    }

    if (!apkDownloadUrl && repoSlug) {
      apkDownloadUrl = `https://github.com/${repoSlug}/releases/latest/download/WargaQu-latest.apk`;
      releasePageUrl = releasePageUrl || `https://github.com/${repoSlug}/releases/latest`;
    }

    const semverDiff = compareSemver(latestVersion, installed.versionName);
    const hasUpdate =
      native &&
      (semverDiff > 0 ||
        (semverDiff === 0 && latestVersionCode > installed.versionCode));

    const status: ApkUpdateStatus = {
      checkedAt: new Date().toISOString(),
      isNativeApk: native,
      installedVersion: installed.versionName,
      installedVersionCode: installed.versionCode,
      latestVersion,
      latestVersionCode,
      hasUpdate,
      source,
      repoSlug,
      apkDownloadUrl,
      releasePageUrl,
      releaseNotes:
        releaseNotes ||
        `Pembaruan WargaQu v${latestVersion}: sinkronisasi sesi APK-PWA & sistem pasang timpa langsung.`,
      canAutoInstall: installed.canAutoInstall,
    };

    lastUpdateStatus = status;
    lastCheckedMs = now;
    emitUpdateStatus(status);
    return status;
  },

  async openInstallPermissionSettings(): Promise<boolean> {
    if (!isNativeCapacitorApk() || !Capacitor.isNativePlatform()) return false;
    try {
      const res = await AppUpdaterNative.openInstallPermissionSettings();
      return Boolean(res.opened);
    } catch {
      return false;
    }
  },

  async downloadAndInstallUpdate(
    apkUrl: string,
    onProgress?: (percent: number) => void
  ): Promise<{
    outcome: 'installer_launched' | 'permission_required' | 'browser_opened';
    message: string;
  }> {
    const cleanUrl = (apkUrl || '').trim();
    if (!cleanUrl || !cleanUrl.startsWith('https://')) {
      throw new Error('URL file APK belum tersedia. Hubungkan repo GitHub rilis di Toko/Akun.');
    }

    if (!isNativeCapacitorApk() || !Capacitor.isNativePlatform()) {
      window.location.assign(cleanUrl);
      return {
        outcome: 'browser_opened',
        message: 'Mengunduh APK melalui browser...',
      };
    }

    let listenerHandle: PluginListenerHandle | null = null;
    try {
      if (onProgress) {
        listenerHandle = await AppUpdaterNative.addListener('apkDownloadProgress', data => {
          if (typeof data?.percent === 'number') {
            onProgress(data.percent);
          }
        });
      }

      const res = await AppUpdaterNative.downloadAndInstallApk({ url: cleanUrl });
      if (res.status === 'permission_required') {
        return {
          outcome: 'permission_required',
          message:
            'Aktifkan izin "Pasang aplikasi dari sumber ini" agar WargaQu bisa menimpa versi baru langsung.',
        };
      }
      return {
        outcome: 'installer_launched',
        message:
          'Paket APK selesai diunduh. Ketuk "Update" / "Perbarui" pada layar Android untuk menimpa tanpa menghapus data.',
      };
    } finally {
      if (listenerHandle?.remove) {
        void listenerHandle.remove().catch(() => {});
      }
    }
  },
};
