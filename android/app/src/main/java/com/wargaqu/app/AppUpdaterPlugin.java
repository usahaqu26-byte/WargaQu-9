package com.wargaqu.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final long MAX_APK_BYTES = 150L * 1024L * 1024L;
    private static final int MAX_REDIRECTS = 6;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageInfo pkgInfo = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = pkgInfo.getLongVersionCode();
            } else {
                @SuppressWarnings("deprecation")
                long legacyCode = pkgInfo.versionCode;
                versionCode = legacyCode;
            }
            JSObject ret = new JSObject();
            ret.put("packageName", ctx.getPackageName());
            ret.put("versionName", pkgInfo.versionName != null ? pkgInfo.versionName : "1.0.0");
            ret.put("versionCode", versionCode);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal membaca versi APK terpasang: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            allowed = getContext().getPackageManager().canRequestPackageInstalls();
        }
        JSObject ret = new JSObject();
        ret.put("allowed", allowed);
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            JSObject ret = new JSObject();
            ret.put("opened", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal membuka pengaturan izin pasang APK: " + e.getMessage());
        }
    }

    private boolean isTrustedHttpsApkUrl(String rawUrl) {
        if (rawUrl == null) return false;
        try {
            Uri uri = Uri.parse(rawUrl.trim());
            String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase(Locale.ROOT) : "";
            String host = uri.getHost() != null ? uri.getHost().toLowerCase(Locale.ROOT) : "";
            if (!"https".equals(scheme) || host.isEmpty()) {
                return false;
            }
            return host.equals("github.com")
                    || host.endsWith(".github.com")
                    || host.endsWith(".githubusercontent.com")
                    || host.endsWith(".run.app")
                    || host.endsWith(".github.io");
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        String rawUrl = call.getString("url", "");
        if (!isTrustedHttpsApkUrl(rawUrl)) {
            call.reject("URL unduhan APK harus HTTPS dari rilis resmi GitHub atau server WargaQu.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            JSObject ret = new JSObject();
            ret.put("status", "permission_required");
            call.resolve(ret);
            return;
        }

        executor.execute(() -> {
            HttpURLConnection conn = null;
            File outFile = null;
            try {
                String currentUrl = rawUrl.trim();
                for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                    if (!isTrustedHttpsApkUrl(currentUrl)) {
                        throw new SecurityException("Redirect APK mengarah ke domain tidak tepercaya.");
                    }
                    URL parsedUrl = new URL(currentUrl);
                    conn = (HttpURLConnection) parsedUrl.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(45000);
                    conn.setRequestProperty("User-Agent", "WargaQu-Android-Updater/1.6.0");
                    conn.connect();

                    int code = conn.getResponseCode();
                    if (code == HttpURLConnection.HTTP_MOVED_PERM
                            || code == HttpURLConnection.HTTP_MOVED_TEMP
                            || code == HttpURLConnection.HTTP_SEE_OTHER
                            || code == 307
                            || code == 308) {
                        String loc = conn.getHeaderField("Location");
                        conn.disconnect();
                        conn = null;
                        if (loc == null || loc.trim().isEmpty()) {
                            throw new IllegalStateException("Redirect URL rilis APK kosong.");
                        }
                        URL resolved = new URL(parsedUrl, loc.trim());
                        currentUrl = resolved.toString();
                        continue;
                    }
                    if (code < 200 || code >= 300) {
                        throw new IllegalStateException("Server rilis APK merespons HTTP " + code);
                    }
                    break;
                }

                if (conn == null) {
                    throw new IllegalStateException("Terlalu banyak pengalihan URL saat mengunduh APK.");
                }

                long totalBytes = conn.getContentLengthLong();
                if (totalBytes > MAX_APK_BYTES) {
                    throw new IllegalStateException("Ukuran file APK melebihi batas aman 150 MB.");
                }

                File cacheRoot = getContext().getCacheDir().getCanonicalFile();
                File updateDir = new File(cacheRoot, "apk-updates").getCanonicalFile();
                if (!updateDir.getPath().startsWith(cacheRoot.getPath() + File.separator)) {
                    throw new SecurityException("Direktori cache update tidak valid.");
                }
                if (!updateDir.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    updateDir.mkdirs();
                }

                outFile = new File(updateDir, "WargaQu-update.apk").getCanonicalFile();
                if (!outFile.getPath().startsWith(updateDir.getPath() + File.separator)) {
                    throw new SecurityException("Target path file APK tidak valid.");
                }
                if (outFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
                }

                try (InputStream rawIn = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(outFile)) {
                    byte[] buffer = new byte[16384];
                    long downloaded = 0L;
                    int lastPercent = -1;
                    boolean magicChecked = false;
                    int bytesRead;

                    while ((bytesRead = rawIn.read(buffer)) != -1) {
                        if (!magicChecked) {
                            if (bytesRead < 2 || buffer[0] != 'P' || buffer[1] != 'K') {
                                throw new IllegalStateException("File unduhan bukan paket APK Android yang valid.");
                            }
                            magicChecked = true;
                        }
                        downloaded += bytesRead;
                        if (downloaded > MAX_APK_BYTES) {
                            throw new IllegalStateException("Ukuran file unduhan melebihi batas 150 MB.");
                        }
                        out.write(buffer, 0, bytesRead);

                        if (totalBytes > 0) {
                            int pct = (int) Math.min(100, (downloaded * 100L) / totalBytes);
                            if (pct >= lastPercent + 5 || pct == 100) {
                                lastPercent = pct;
                                JSObject progress = new JSObject();
                                progress.put("percent", pct);
                                progress.put("downloadedBytes", downloaded);
                                progress.put("totalBytes", totalBytes);
                                notifyListeners("apkDownloadProgress", progress);
                            }
                        }
                    }
                    out.flush();
                }

                Uri apkUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        outFile
                );

                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.addFlags(
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK
                );
                getContext().startActivity(installIntent);

                JSObject ret = new JSObject();
                ret.put("status", "installer_launched");
                ret.put("filePath", outFile.getAbsolutePath());
                call.resolve(ret);
            } catch (Exception e) {
                if (outFile != null && outFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    outFile.delete();
                }
                call.reject("Gagal mengunduh/memasang pembaruan APK: " + e.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }
}
