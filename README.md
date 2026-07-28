# 🎓 Sistem Absensi Anak Magang

Aplikasi web absensi peserta magang yang **100% berjalan di sisi klien (client-side)** — tanpa PHP, tanpa Node.js server, tanpa database SQL, tanpa Firebase/Supabase. Seluruh data disimpan di **LocalStorage** browser, sehingga aplikasi ini bisa langsung di-*deploy* sebagai situs statis di **GitHub Pages**, Netlify, Vercel (static), atau dibuka langsung dari file `index.html`.

> Dibangun dengan HTML5, CSS3, dan **Vanilla JavaScript (ES6+)** murni — tidak ada framework, tidak ada proses build/compile.

---

## ✨ Ringkasan Fitur

### Inti
- Login dummy 3 peran: **Admin**, **Pembimbing**, **Peserta** (role-based access)
- Dashboard interaktif: statistik real-time, grafik (Chart.js), kalender kehadiran berwarna, aktivitas terbaru
- CRUD Peserta Magang lengkap (tambah/ubah/hapus/cari/filter/sortir), ID peserta auto-generate (`MG-2026-001`)
- Absensi **Check-In / Check-Out** dengan:
  - Validasi (tidak bisa check-in dua kali, tidak bisa check-out sebelum check-in)
  - **Geolocation** (`navigator.geolocation`) untuk mencatat lokasi absen
  - **Selfie** via `getUserMedia()`, disimpan sebagai Base64 di LocalStorage
  - **QR Code**: setiap peserta punya QR pribadi (generate), pembimbing/admin dapat **scan QR** via kamera untuk absensi cepat
- Status kehadiran otomatis: **Hadir, Terlambat, Izin, Sakit, Alpha** (berdasarkan jam masuk vs toleransi keterlambatan yang bisa diatur)
- Riwayat absensi dengan filter (status/tanggal/nama), pencarian, dan sortir kolom
- Export **CSV**, **Print**, dan **Backup/Restore JSON** penuh (seluruh database LocalStorage)
- Laporan rekap **harian / mingguan / bulanan** lengkap dengan grafik distribusi status, tingkat kehadiran per peserta, dan distribusi per divisi
- Progres masa magang (progress ring + countdown hari tersisa)
- Profil peserta: info magang, statistik, wawasan kedisiplinan
- Kalender kehadiran berwarna per bulan
- Dashboard analitik & **ranking/leaderboard** peserta berdasarkan skor kehadiran
- **Badge & Achievement** (mis. "Streak 10 Hari", "Nol Alpha", "Tepat Waktu")
- Timeline aktivitas & riwayat login
- Reminder otomatis jika peserta belum absen setelah jam kerja dimulai
- **Drag & Drop** widget dashboard (urutan tersimpan per pengguna)
- **Multi Theme**: mode terang/gelap + 6 pilihan warna aksen
- Session timeout otomatis + peringatan sebelum sesi berakhir
- Sanitasi input (mencegah XSS sederhana) di semua form
- Responsif penuh hingga tampilan mobile

### Bonus
- **Command Palette** (`Ctrl/Cmd + K`) untuk navigasi cepat
- Confetti 🎉 otomatis saat *Perfect Attendance* (30 hari tanpa telat/izin/sakit/alpha)
- Notifikasi suara (Web Audio API, tanpa file eksternal)
- Progress ring melingkar untuk progres magang
- Heatmap kehadiran gaya "GitHub contribution graph"
- Insight: jam kedatangan paling sering & hari paling disiplin
- Widget cuaca (opsional, dapat diaktifkan di Pengaturan)
- Countdown selesai magang
- Catatan harian peserta (jurnal aktivitas)
- Penilaian pembimbing (skor + catatan)
- Upload dokumen magang (drag & drop, disimpan Base64)
- Pengumuman & Agenda/Kegiatan
- Skeleton loading, toast notification, empty state, error state, confirmation dialog, ripple effect — semua sudah terintegrasi di seluruh halaman

---

## 🗂️ Struktur Folder

```
/
├── index.html          # Entry point — redirect otomatis ke login/dashboard
├── login.html           # Halaman login (3 role dummy)
├── dashboard.html        # Dashboard utama (statistik, grafik, widget drag & drop)
├── absensi.html          # Check-in/out, QR, riwayat absensi
├── peserta.html          # CRUD data peserta magang (admin & pembimbing)
├── laporan.html          # Rekap harian/mingguan/bulanan + grafik
├── profile.html          # Profil, kalender, badge, catatan, penilaian, dokumen, riwayat login
├── settings.html         # Tema, sesi, jam kerja, backup/restore, reset
├── assets/
│   ├── css/
│   │   ├── style.css      # Design tokens + layout + komponen inti
│   │   ├── theme.css       # Komponen tambahan (widget, confetti, dsb.)
│   │   └── animations.css  # Keyframe animasi yang dapat dipakai ulang
│   ├── js/
│   │   ├── helpers.js       # Fungsi utilitas murni (format, sanitasi, dsb.)
│   │   ├── storage.js        # Lapisan "database" LocalStorage + seed data
│   │   ├── auth.js           # Login, sesi, guard halaman, riwayat login
│   │   ├── attendance.js     # Check-in/out, geolokasi, selfie, QR, analitik
│   │   ├── participants.js   # CRUD peserta magang
│   │   ├── dashboard.js      # Agregasi data dashboard, badge, widget order
│   │   ├── charts.js         # Wrapper Chart.js
│   │   ├── ui.js             # Shell (sidebar/topbar), toast, modal, command palette, dst.
│   │   └── settings.js       # Simpan pengaturan, backup/restore
│   ├── images/            # Aset gambar statis (opsional)
│   └── icons/              # Placeholder ikon kustom (ikon utama pakai Lucide via CDN)
├── data/                  # Lokasi opsional untuk file backup/export
└── README.md
```

---

## 🔑 Akun Demo

| Role        | Username     | Password     |
|-------------|--------------|--------------|
| Admin       | `admin`      | `admin123`   |
| Pembimbing  | `pembimbing` | `bimbing123` |
| Peserta     | `peserta`    | `magang123`  |

Data contoh (5 peserta, ~40 hari riwayat absensi, pengumuman, agenda, dsb.) akan otomatis dibuat (*seed*) saat aplikasi pertama kali dibuka.

---

## 🚀 Cara Menjalankan

### 1. Langsung dibuka di browser
Karena aplikasi 100% statis, Anda bisa langsung membuka `index.html` di browser. Namun beberapa browser membatasi fitur seperti kamera (`getUserMedia`) pada protokol `file://`, jadi disarankan menjalankan lewat local server sederhana:

```bash
# Python
python3 -m http.server 8080

# atau Node.js (http-server)
npx http-server -p 8080
```

Lalu buka `http://localhost:8080`.

### 2. Deploy ke GitHub Pages
1. Buat repository baru di GitHub, lalu unggah seluruh isi folder ini (pastikan `index.html` berada di root repo).
2. Masuk ke **Settings → Pages**.
3. Pilih source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Simpan — situs akan tersedia di `https://<username>.github.io/<nama-repo>/` dalam beberapa menit.

Tidak ada proses build/compile yang diperlukan.

### 3. Izin Browser
- **Kamera** (selfie & scan QR) dan **Lokasi** (geolocation) memerlukan izin eksplisit dari pengguna dan koneksi **HTTPS** (atau `localhost`) — ini merupakan kebijakan keamanan browser, bukan batasan aplikasi.
- Jika izin ditolak, aplikasi tetap dapat digunakan (absensi tetap tercatat tanpa foto/lokasi).

---

## 💾 Penyimpanan Data (LocalStorage)

Seluruh data tersimpan di `localStorage` browser dengan prefix `absensi_magang_v1.*`, mencakup: pengguna, peserta, absensi, pengumuman, agenda, catatan harian, penilaian, dokumen, riwayat login, pengaturan, dan sesi aktif.

Karena data tersimpan lokal per-browser/perangkat:
- Data **tidak otomatis tersinkron** antar perangkat atau antar browser.
- Selalu lakukan **Export Backup (JSON)** secara berkala via menu **Pengaturan** agar data tidak hilang saat cache browser dibersihkan.
- Gunakan **Import/Restore** untuk memulihkan data dari file backup, termasuk saat berpindah perangkat.

---

## 🧩 Teknologi yang Digunakan

| Kebutuhan          | Teknologi                                   |
|---------------------|----------------------------------------------|
| Struktur & Markup   | HTML5                                          |
| Styling             | CSS3 murni (custom properties / design tokens) |
| Logika Aplikasi     | Vanilla JavaScript (ES6+, IIFE modules)         |
| Penyimpanan Data    | LocalStorage + JSON                             |
| Grafik              | [Chart.js](https://www.chartjs.org/) via CDN     |
| Ikon                | [Lucide Icons](https://lucide.dev) via CDN        |
| Font                | Google Fonts — Inter & JetBrains Mono             |
| QR Generate         | qrcodejs via CDN                                    |
| QR Scan             | jsQR via CDN                                          |

Semua pustaka eksternal dimuat lewat CDN publik — tidak ada `npm install` atau proses build yang diperlukan. Aplikasi tetap dapat digunakan secara penuh tanpa koneksi internet (kecuali fitur QR & font Google yang butuh pustaka CDN dimuat sekali).

---

## 🎨 Prinsip Desain

- **Design tokens** terpusat di `assets/css/style.css` (`:root` & `[data-theme]`) — warna, tipografi, radius, shadow, dan motion semuanya dapat diubah dari satu tempat.
- **Signature element**: heatmap kehadiran & progress ring yang mencerminkan inti aplikasi — pelacakan kehadiran harian dari waktu ke waktu.
- Palet warna status kehadiran konsisten di seluruh aplikasi (Hadir = emerald, Terlambat = amber, Izin = sky, Sakit = slate, Alpha = rose).
- Mendukung **mode terang/gelap** dan **6 warna aksen** yang dapat dipilih bebas di halaman Pengaturan.
- Aksesibilitas: kontras warna memadai, `:focus-visible` pada semua elemen interaktif, dan menghormati `prefers-reduced-motion`.

---

## ⌨️ Pintasan Keyboard

| Pintasan       | Aksi                        |
|-----------------|------------------------------|
| `Ctrl/Cmd + K`  | Buka Command Palette          |
| `Esc`           | Tutup modal / command palette |

---

## 🔒 Catatan Keamanan

Ini adalah **aplikasi demo/edukasi front-end**. Autentikasi bersifat *dummy* (kredensial tersimpan di LocalStorage tanpa hashing) dan **tidak cocok untuk data produksi sungguhan**. Untuk kebutuhan produksi nyata, gunakan backend & database yang sesungguhnya dengan autentikasi yang aman.

---

## 🧱 Struktur Kode JavaScript

Setiap modul JS memakai pola **IIFE (Revealing Module Pattern)** dan hanya mengekspos fungsi yang diperlukan, sehingga mudah dikembangkan tanpa konflik namespace global:

```js
const NamaModul = (() => {
  function fungsiPrivat() { /* ... */ }
  function fungsiPublik() { /* ... */ }
  return { fungsiPublik };
})();
```

Urutan pemuatan skrip di setiap halaman **penting** — modul dasar (`helpers.js`, `storage.js`) harus dimuat sebelum modul yang bergantung padanya (`auth.js`, `ui.js`, dst).

---

## 📌 Roadmap Pengembangan Lanjutan (opsional)

- Notifikasi push browser (Web Push API) untuk pengingat absen
- Mode offline penuh dengan Service Worker (PWA)
- Enkripsi data LocalStorage sederhana
- Multi-bahasa (i18n)

---

Selamat menggunakan **Sistem Absensi Anak Magang**! Jika ada pertanyaan seputar struktur kode, silakan telusuri komentar di setiap file `assets/js/*.js` — setiap modul didokumentasikan singkat di bagian atas file.
