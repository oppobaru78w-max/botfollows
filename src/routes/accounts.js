const express = require('express');
const router = express.Router();
const db = require('../config/database');
const loginManager = require('../login/loginManager');

// ==================== GET: Statistik Sesi ====================
router.get('/session/statistik', (req, res) => {
  try {
    const stats = db.hitungStatistikSesi();
    res.json({ sukses: true, data: stats });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Verifikasi Semua Sesi ====================
router.post('/verify-all-sessions', async (req, res) => {
  try {
    const hasil = await loginManager.verifikasiSemuaSesi();
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== GET: Semua Akun ====================
router.get('/', (req, res) => {
  try {
    const { platform, status, cari } = req.query;
    const akun = db.ambilSemuaAkun({ platform, status, cari });
    res.json({ sukses: true, data: akun, total: akun.length });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal mengambil data akun', error: err.message });
  }
});

// ==================== GET: Statistik ====================
router.get('/statistik', (req, res) => {
  try {
    const stats = db.ambilStatistik();
    res.json({ sukses: true, data: stats });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal mengambil statistik', error: err.message });
  }
});

// ==================== GET: Log Aktivitas ====================
router.get('/log', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const log = db.ambilLogAktivitas(limit);
    res.json({ sukses: true, data: log });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal mengambil log', error: err.message });
  }
});

// ==================== GET: Akun by ID ====================
router.get('/:id', (req, res) => {
  try {
    const akun = db.ambilAkunById(req.params.id);
    if (!akun) {
      return res.status(404).json({ sukses: false, pesan: 'Akun tidak ditemukan' });
    }
    res.json({ sukses: true, data: akun });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal mengambil akun', error: err.message });
  }
});

// ==================== POST: Tambah Akun ====================
router.post('/', (req, res) => {
  try {
    const { platform, username, password, email, phone, proxy, catatan, cookies } = req.body;

    // Validasi
    if (!platform || !username || !password) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Platform, username, dan password wajib diisi'
      });
    }

    const platformValid = ['tiktok', 'instagram', 'facebook', 'youtube'];
    if (!platformValid.includes(platform)) {
      return res.status(400).json({
        sukses: false,
        pesan: `Platform tidak valid. Pilih: ${platformValid.join(', ')}`
      });
    }

    const akun = db.tambahAkun({ platform, username, password, email, phone, proxy, catatan, cookies });
    res.status(201).json({ sukses: true, pesan: 'Akun berhasil ditambahkan', data: akun });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal menambahkan akun', error: err.message });
  }
});

// ==================== POST: Import Bulk ====================
router.post('/import', (req, res) => {
  try {
    const { akun_list } = req.body;

    if (!akun_list || !Array.isArray(akun_list) || akun_list.length === 0) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Kirim array akun_list yang berisi data akun'
      });
    }

    const hasil = db.importAkunBulk(akun_list);
    res.json({
      sukses: true,
      pesan: `Import selesai: ${hasil.sukses} berhasil, ${hasil.gagal} gagal`,
      data: hasil
    });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal import akun', error: err.message });
  }
});

// ==================== PUT: Update Akun ====================
router.put('/:id', (req, res) => {
  try {
    const akun = db.updateAkun(req.params.id, req.body);
    if (!akun) {
      return res.status(404).json({ sukses: false, pesan: 'Akun tidak ditemukan' });
    }
    res.json({ sukses: true, pesan: 'Akun berhasil diupdate', data: akun });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal update akun', error: err.message });
  }
});

// ==================== PATCH: Update Status ====================
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const statusValid = ['aktif', 'nonaktif', 'banned', 'verifikasi'];

    if (!status || !statusValid.includes(status)) {
      return res.status(400).json({
        sukses: false,
        pesan: `Status tidak valid. Pilih: ${statusValid.join(', ')}`
      });
    }

    const akun = db.updateStatusAkun(req.params.id, status);
    if (!akun) {
      return res.status(404).json({ sukses: false, pesan: 'Akun tidak ditemukan' });
    }
    res.json({ sukses: true, pesan: `Status berhasil diubah ke ${status}`, data: akun });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal update status', error: err.message });
  }
});

// ==================== DELETE: Hapus Akun ====================
router.delete('/:id', (req, res) => {
  try {
    const berhasil = db.hapusAkun(req.params.id);
    if (!berhasil) {
      return res.status(404).json({ sukses: false, pesan: 'Akun tidak ditemukan' });
    }
    res.json({ sukses: true, pesan: 'Akun berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal menghapus akun', error: err.message });
  }
});

// ==================== DELETE: Hapus Banyak ====================
router.delete('/', (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ sukses: false, pesan: 'Kirim array ids yang berisi ID akun' });
    }

    const jumlah = db.hapusBanyakAkun(ids);
    res.json({ sukses: true, pesan: `${jumlah} akun berhasil dihapus` });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal menghapus akun', error: err.message });
  }
});

// ==================== GET: Export Akun ====================
router.get('/export/semua', (req, res) => {
  try {
    const { platform, status } = req.query;
    const akun = db.exportAkun({ platform, status });
    res.json({ sukses: true, data: akun, total: akun.length });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Gagal export akun', error: err.message });
  }
});

// ==================== POST: Auto-Login Akun ====================
router.post('/:id/auto-login', async (req, res) => {
  try {
    const { headless = true } = req.body;
    const hasil = await loginManager.autoLogin(req.params.id, { headless });
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Buka Browser Manual ====================
router.post('/:id/open-browser', async (req, res) => {
  try {
    const hasil = await loginManager.bukaBrowserManual(req.params.id);
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Simpan Sesi dari Browser ====================
router.post('/:id/save-session', async (req, res) => {
  try {
    const hasil = await loginManager.simpanSesiDariBrowser(req.params.id);
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Tutup Browser Manual ====================
router.post('/:id/close-browser', async (req, res) => {
  try {
    const hasil = await loginManager.tutupBrowserManual(req.params.id);
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Verifikasi Sesi ====================
router.post('/:id/verify-session', async (req, res) => {
  try {
    const hasil = await loginManager.verifikasiSesi(req.params.id);
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== GET: Export Cookies Akun ====================
router.get('/:id/cookies', (req, res) => {
  try {
    const hasil = loginManager.exportCookies(req.params.id);
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Import Cookies Akun ====================
router.post('/:id/cookies', (req, res) => {
  try {
    const { cookies } = req.body;
    if (!cookies) {
      return res.status(400).json({ sukses: false, pesan: 'Parameter cookies (JSON) wajib diisi' });
    }
    const hasil = loginManager.importCookies(req.params.id, cookies);
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== DELETE: Reset Sesi Akun ====================
router.delete('/:id/session', (req, res) => {
  try {
    const hasil = loginManager.hapusSesi(req.params.id);
    res.json(hasil);
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

module.exports = router;
