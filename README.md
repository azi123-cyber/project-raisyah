# SIPRAMA — Sistem Inventaris Pramuka MAN 11 Jakarta
**Ambalan Khalid bin Walid - Ummu Kultsum Gudep 06.171-06.172**

Aplikasi Manajemen Inventaris, Pemindaian Barcode Real-time, Verifikasi Bukti Foto Ganda, Alarm Pengingat Pengembalian, dan Otomatisasi Surat Resmi Ambalan.

---

## 🚀 Perubahan dari Versi Simulasi ke Real App (Siap Pakai)

1. **Pembersihan Data Simulasi & Dummy Cart**:
   - Keranjang pinjam pada tab *Scan Barcode* kini dimulai kosong (`[]`), tidak lagi berisi item tiruan awal.
   - Kolom keperluan peminjaman dimulai bersih dengan panduan placeholder informatif.
   - Tanggal peminjaman & jadwal pengembalian kini dibuat dinamis berdasarkan waktu nyata saat transaksi dibuat.
2. **Kamera Pemindai Barcode Nyata (Real Hardware Scanner)**:
   - Dilengkapi deteksi barcode riil secara kontinyu menggunakan `BarcodeDetector` (QR Code, Code 128, Code 39, EAN-13, EAN-8).
   - Terdapat feedback suara *beep* otomatis saat barcode berhasil dipindai dan item masuk ke daftar pinjam.
3. **Dokumentasi Foto Bukti Ganda Riil**:
   - Mendukung pengambilan foto kamera langsung / galeri untuk 4 titik bukti:
     - Foto 1: Kondisi Barang Sebelum Dipinjam
     - Foto 2: Serah-Terima Peminjaman (Peminjam & Dewan Inventaris)
     - Foto 3: Kondisi Barang Sesudah Dikembalikan
     - Foto 4: Serah-Terima Pengembalian
4. **Form Registrasi Anggota Pramuka Riil**:
   - Penambahan input kontak nomor WhatsApp / HP anggota baru (tidak lagi nomor statis).
5. **Wrapper Mobile Expo Go**:
   - Tersedia modul wrapper native di direktori `mobile/` menggunakan `react-native-webview`, `expo-status-bar`, dan `expo-constants`.

---

## 📦 File APK Siap Pasang & Share (100% Offline di Android)

Aplikasi telah berhasil dikompilasi menjadi file APK Release mandiri (Standalone) yang **tidak memerlukan koneksi ke laptop / server / internet**:
- **Lokasi File**: `SIPRAMA.apk` (di folder utama proyek)
- **Dukungan**: Android 5.0 (Lollipop) ke atas (Samsung, Xiaomi, Oppo, Vivo, Realme, Infinix, dll.)
- **Signature**: Release Keystore dengan skema tanda tangan lengkap (v1 JAR + v2 + v3) agar kompatibel di HP Android lama maupun terbaru.

### Cara Membagikan & Menginstal di HP:
1. **Lewat WhatsApp / Telegram**:
   - Buka WhatsApp Web di laptop.
   - Kirim file `SIPRAMA.apk` sebagai **Dokumen** (atau file) ke nomor Anda sendiri atau ke grup ambalan.
   - Di HP penerima, pastikan unduhan selesai 100%, lalu ketuk file `.apk` tersebut dan pilih **Instal** (jika error dari dalam chat WA, buka lewat **File Manager → Folder Download / WhatsApp Documents**).
2. **Lewat Kabel Data / File Manager**:
   - Salin file `SIPRAMA.apk` dari laptop ke penyimpanan HP.
   - Buka aplikasi File Manager di HP, cari file `SIPRAMA.apk`, lalu klik **Instal**.
   *(Jika muncul peringatan "Izinkan instalasi dari sumber tidak dikenal", pilih Izinkan / Allow).*

### Cara Build Ulang APK di Masa Depan:
```bash
npm run build:apk
```

---

## 📱 Panduan Menjalankan di Expo Go (HP Android / iPhone)

### Apa itu Expo Go?
**Expo Go** adalah aplikasi mobile resmi dari Expo yang memungkinkan Anda menjalankan dan menguji aplikasi di smartphone fisik secara instan tanpa perlu mengompilasi APK atau menginstal Android Studio / Xcode.

### Langkah-langkah:

#### 1. Persiapan di Smartphone Anda
- **Android**: Buka Google Play Store, cari dan instal **Expo Go**.
- **iPhone / iOS**: Buka App Store, cari dan instal **Expo Go**.

#### 2. Jalankan Server Web SIPRAMA (Terminal 1)
Buka terminal di komputer/laptop Anda, lalu jalankan:
```bash
npm run dev
```
Server Vite akan aktif di port `3000` (dapat diakses pada jaringan Wi-Fi lokal).

#### 3. Jalankan Expo Metro Bundler (Terminal 2)
Buka terminal baru di folder proyek, lalu jalankan:
```bash
npm run expo:start
```
Terminal akan menampilkan **QR Code** besar.

#### 4. Buka Aplikasi di Smartphone
- **Di Android**: Buka aplikasi **Expo Go**, pilih menu **"Scan QR code"**, lalu arahkan kamera ke QR code di terminal.
- **Di iPhone**: Buka aplikasi **Kamera bawaan iOS**, arahkan ke QR code di terminal, lalu ketuk banner notifikasi kuning untuk membukanya di Expo Go.

> **Catatan Jaringan (Wi-Fi):**
> Pastikan smartphone dan laptop terhubung ke Wi-Fi / Hotspot yang sama. Jika jaringan Wi-Fi Anda memiliki isolasi klien (AP isolation) atau berbeda jaringan, gunakan mode tunnel:
> ```bash
> npm run expo:tunnel
> ```
