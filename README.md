# 🤖 SMM Bot Engine

SMM Bot Engine adalah aplikasi web enterprise-ready untuk manajemen otomasi media sosial multi-platform (**TikTok**, **Instagram**, **Facebook**, dan **YouTube**). Dibangun dengan antarmuka B2B SaaS modern, Puppeteer Stealth anti-deteksi, sistem antrian tugas multi-target, pool proxy dengan auto-rotator, monitoring & analitik real-time, serta manajemen auto-login & sesi cookies.

---

## ✨ Fitur Utama

### 1. 👥 Manajemen Akun Bot
- CRUD lengkap akun bot media sosial (TikTok, Instagram, Facebook, YouTube).
- Bulk Import format `username:password:email:phone:proxy`.
- Enkripsi kredensial dua arah (AES-256-CBC) untuk auto-login otomatis.
- Masking password di UI & API untuk keamanan data.

### 2. 📱 Modul Platform Otomasi
- Engine Puppeteer Stealth dengan fingerprinting anti-deteksi.
- Dukungan aksi otomatis: **Follow**, **Like**, **Comment**, **View Video**, dan **Share / Repost**.
- Simulasi perilaku manusia (*human-like typing delay*, acak *mouse scroll*, dan interaksi dinamis).

### 3. ⚡ Bot Engine & Task Queue
- Antrian tugas (*Task Queue*) dengan dukungan input target tunggal atau multi-target (satu per baris).
- Auto-Runner independen di latar belakang dengan kontrol *Mulai*, *Jeda*, *Bersihkan*, dan *Batalkan Semua*.
- Injeksi otomatis sesi cookies yang terotentikasi ke browser sebelum menjalankan tugas.

### 4. 🌐 Proxy Pool & Anti-Ban Rotator
- Manajemen pool proxy (HTTP, HTTPS, SOCKS5) dengan autentikasi IP/Username:Password.
- Alat tes koneksi & latency ping real-time.
- Pembersih proxy mati otomatis (*dead proxy cleaner*).
- Auto-rotator proxy antar task antrian untuk meminimalisir risiko blokir/banned.

### 5. 📊 Dashboard Monitoring & Analitik
- Live System Banner: status task runner, jumlah instance browser aktif, dan proxy siap pakai.
- 4 Kartu KPI: Total Akun, Aksi Sukses, Tingkat Keberhasilan (Success Rate %), dan Proxy Aktif.
- Bar chart horizontal distribusi kuantitas aksi bot.
- Matriks performa breakdown per platform (TikTok, IG, FB, YT).
- Live audit activity log feed real-time.

### 6. 🔑 Auto-Login & Manajemen Sesi Cookies
- **Auto-Login (Headless)**: Otomatis login di latar belakang dan menyimpan cookies otentikasi.
- **Browser Visual (Manual)**: Membuka jendela Chrome nyata di layar komputer untuk menyelesaikan puzzle captcha, verifikasi email, atau SMS OTP.
- **Import / Export Cookies JSON**: Kompatibel dengan ekstensi browser *EditThisCookie* atau *Cookie-Editor*.
- **Pengecekan Status Sesi**: Verifikasi validitas cookies secara berkala atau massal (*Bulk Verify*).

---

## 🛠️ Arsitektur Teknologi

- **Backend**: Node.js, Express.js
- **Database**: SQLite (via `sql.js` & filesystem persistence)
- **Browser Engine**: Puppeteer Extra, Puppeteer Stealth Plugin
- **Keamanan**: AES-256-CBC Encryption, Bcrypt, CORS
- **Frontend**: Vanilla HTML5, CSS3 Tokens (SaaS B2B design inspired by Nexaseller), Vanilla JavaScript (No heavy frameworks required)

---

## 🚀 Cara Menjalankan

### 1. Kloning Repositori
```bash
git clone https://github.com/oppobaru78w-max/botfollows.git
cd botfollows
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Jalankan Aplikasi
```bash
npm start
```

Buka browser dan akses:
```
http://localhost:3000
```

---

## 📡 Dokumentasi Endpoint API

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/akun` | Ambil semua akun bot (filter: platform, status, session_status, cari) |
| `POST` | `/api/akun` | Tambah akun bot baru |
| `POST` | `/api/akun/import` | Import akun massal (array) |
| `PUT` | `/api/akun/:id` | Update data akun |
| `DELETE` | `/api/akun/:id` | Hapus akun |
| `POST` | `/api/akun/:id/auto-login` | Eksekusi auto-login headless |
| `POST` | `/api/akun/:id/open-browser` | Buka jendela Chrome interaktif di layar |
| `POST` | `/api/akun/:id/save-session` | Ambil cookies dari browser aktif |
| `POST` | `/api/akun/:id/verify-session` | Cek status keaktifan sesi akun |
| `POST` | `/api/akun/verify-all-sessions` | Cek kesehatan sesi seluruh akun |
| `GET` | `/api/akun/:id/cookies` | Export data cookies (JSON) |
| `POST` | `/api/akun/:id/cookies` | Import data cookies (JSON) |
| `DELETE` | `/api/akun/:id/session` | Reset & hapus sesi akun |
| `GET` | `/api/bot/tasks` | Ambil daftar antrian task bot |
| `POST` | `/api/bot/tasks` | Buat task baru (single atau multi-target) |
| `POST` | `/api/bot/runner/start` | Jalankan auto-runner task queue |
| `POST` | `/api/bot/runner/stop` | Hentikan sementara auto-runner |
| `GET` | `/api/proxy` | Ambil daftar proxy di pool |
| `POST` | `/api/proxy` | Tambah proxy baru ke pool |
| `POST` | `/api/proxy/test/:id` | Tes koneksi & latency proxy |
| `POST` | `/api/proxy/test-all` | Tes koneksi seluruh proxy di pool |
| `GET` | `/api/analytics/dashboard` | Ambil agregasi metrik dashboard monitoring |

---

## 📄 Lisensi
ISC License
