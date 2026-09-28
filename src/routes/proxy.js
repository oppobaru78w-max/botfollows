const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { testProxy, testSemuaProxy } = require('../engine/proxyChecker');

// ==================== GET: Daftar Proxy ====================
router.get('/', (req, res) => {
  try {
    const { status, protokol, cari, limit } = req.query;
    const proxies = db.ambilSemuaProxy({
      status,
      protokol,
      cari,
      limit: limit ? parseInt(limit, 10) : 200,
    });
    res.json({ sukses: true, data: proxies });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== GET: Statistik Proxy ====================
router.get('/stats', (req, res) => {
  try {
    const stats = db.hitungStatistikProxy();
    res.json({ sukses: true, data: stats });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== GET: Ambil Proxy Rotasi ====================
router.get('/rotate', (req, res) => {
  try {
    const proxy = db.ambilProxyRotasi();
    if (!proxy) {
      return res.status(404).json({ sukses: false, pesan: 'Tidak ada proxy aktif yang tersedia di pool' });
    }
    res.json({ sukses: true, data: proxy });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Tambah Proxy Tunggal ====================
router.post('/', (req, res) => {
  try {
    const { host, port, username, password, protokol, catatan, status } = req.body;

    if (!host) {
      return res.status(400).json({ sukses: false, pesan: 'Host proxy wajib diisi' });
    }

    const baru = db.tambahProxy({
      host,
      port,
      username,
      password,
      protokol,
      catatan,
      status,
    });

    db.logAktivitas(null, null, 'tambah_proxy', `Proxy ${baru.host}:${baru.port} ditambahkan`, 'sukses');

    res.json({ sukses: true, pesan: 'Proxy berhasil ditambahkan', data: baru });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Tambah Banyak Proxy (Bulk Import) ====================
router.post('/bulk', (req, res) => {
  try {
    const { text, proxies } = req.body;

    let list = [];
    if (text) {
      list = text.split('\n').map(l => l.trim()).filter(Boolean);
    } else if (Array.isArray(proxies)) {
      list = proxies;
    }

    if (list.length === 0) {
      return res.status(400).json({ sukses: false, pesan: 'Data proxy kosong' });
    }

    const sukses = db.tambahBanyakProxy(list);
    db.logAktivitas(null, null, 'import_proxy', `${sukses} proxy berhasil diimport ke pool`, 'sukses');

    res.json({ sukses: true, pesan: `${sukses} proxy berhasil ditambahkan ke pool` });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Tes Satu Proxy ====================
router.post('/:id/test', async (req, res) => {
  try {
    const proxy = db.ambilProxyById(req.params.id);
    if (!proxy) {
      return res.status(404).json({ sukses: false, pesan: 'Proxy tidak ditemukan' });
    }

    const hasil = await testProxy(proxy);
    res.json({ sukses: hasil.sukses, data: hasil });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Tes Semua Proxy ====================
router.post('/test-all', async (req, res) => {
  try {
    const hasil = await testSemuaProxy(5);
    res.json({ sukses: true, pesan: 'Tes koneksi seluruh proxy selesai', data: hasil });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== PUT: Update Proxy ====================
router.put('/:id', (req, res) => {
  try {
    const berhasil = db.updateProxy(req.params.id, req.body);
    if (!berhasil) {
      return res.status(404).json({ sukses: false, pesan: 'Proxy tidak ditemukan atau tidak ada data yang diubah' });
    }
    res.json({ sukses: true, pesan: 'Proxy berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== DELETE: Hapus Proxy ====================
router.delete('/:id', (req, res) => {
  try {
    db.hapusProxy(req.params.id);
    res.json({ sukses: true, pesan: 'Proxy berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== POST: Hapus Proxy Mati ====================
router.post('/clear-dead', (req, res) => {
  try {
    db.hapusProxyMati();
    res.json({ sukses: true, pesan: 'Proxy yang mati/tidak aktif berhasil dibersihkan' });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

module.exports = router;
