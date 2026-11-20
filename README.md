# WargaQu (`v1.5.7`) — Ekosistem Cerdas Warga, Keluarga & UMKM

Aplikasi superapp terpadu **WargaQu** (`com.wargaqu.app`) mencakup **RTQu & Paguyuban**, **SiagaQu SOS**, **AreaQu Pedagang Keliling**, **UsahaQu POS (Resto Qu & ModularQu)**, **DompetQu**, **MuamalahQu**, **ChatQu**, dan **LeluhurQu (Silsilah A3 & Kuis Trah)**.

---

## 📱 Pratinjau ala Google Play Store (PWA + Download APK)

Dalam repositori yang sama tersedia halaman etalase pratinjau aplikasi sebelum unduh/install:

- **Link Aplikasi Langsung (Web & PWA):**
  `https://<username>.github.io/<nama-repo>/`
- **Link Pratinjau ala Google Play Store:**
  `https://<username>.github.io/<nama-repo>/store.html` (atau `?preview=store` / `#store`)
- **Link Unduh APK Android Terbaru (Otomatis via GitHub Releases):**
  `https://github.com/<username>/<nama-repo>/releases/latest/download/WargaQu-latest.apk`

---

## 🌐 Cara Mengaktifkan GitHub Pages (Pratinjau & PWA Auto-Update)

Proyek ini sudah terkonfigurasi otomatis melalui workflow `.github/workflows/deploy-pages.yml`:

1. Buka repositori Anda di **GitHub** → **Settings** → **Pages**.
2. Pada bagian **Build and deployment → Source**, pilih **GitHub Actions**.
3. Setiap kali Anda melakukan `git push` ke branch `main` atau `master`, GitHub Pages otomatis menerbitkan:
   - Aplikasi Web + PWA (mendukung *Auto-Update* via Service Worker)
   - Halaman Pratinjau ala Play Store di `/store.html` dan `/?preview=store`

---

## 🚀 Cara Build & Rilis APK Otomatis di GitHub Actions

Workflow `.github/workflows/build-apk.yml` otomatis membangun **`WargaQu-v1.5.7.apk`** dan **`WargaQu-latest.apk`**, lalu menerbitkannya langsung ke **GitHub Releases**:

1. Buka tab **Actions** → pilih **Build & Release Android APK (WargaQu)** (atau cukup push ke `main` / buat tag `v1.5.7`).
2. Setelah workflow selesai, file APK otomatis tersedia di:
   - **GitHub Releases** (bisa diunduh publik langsung lewat tombol **Unduh Android (.apk)** di halaman `store.html`), dan
   - **Artifacts** di halaman workflow run.

---

## 🛠️ Cara Build APK di Komputer Lokal (Opsional)

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

Dari Android Studio, pilih **Build → Build Bundle(s) / APK(s) → Build APK(s)** (atau **Generate Signed Bundle / APK** untuk unggah ke Google Play Store).
