const express = require('express');
const router = express.Router();
const { ambilPlatform, daftarPlatform } = require('../platforms');
const { statusBrowser, tutupBrowser, cekSession, hapusSession } = require('../browser/manager');
const db = require('../config/database');

// ==================== GET: Daftar Platform ====================
router.get('/platform', (req, res) => {
  res.json({ sukses: true, data: daftarPlatform() });
});

// ==================== GET: Status Browser Aktif ====================
router.get('/status', (req, res) => {
  res.json({ sukses: true, data: statusBrowser() });
});

// ==================== POST: Login Akun ====================
router.post('/login', async (req, res) => {
  try {
    const { akun_id, headless } = req.body;

    if (!akun_id) {
      return res.status(400).json({ sukses: false, pesan: 'akun_id wajib diisi' });
    }

    // Ambil data akun dari database
    const akun = db.ambilAkunById(akun_id);
    if (!akun) {
      return res.status(404).json({ sukses: false, pesan: 'Akun tidak ditemukan' });
    }

    // Ambil modul platform
    const platform = ambilPlatform(akun.platform);
    if (!platform) {
      return res.status(400).json({ sukses: false, pesan: `Platform ${akun.platform} tidak tersedia` });
    }

    // Ambil password asli (untuk login kita perlu password asli, bukan hash)
    // Karena password di-hash, user harus kirim password juga
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ sukses: false, pesan: 'Password wajib diisi untuk login' });
    }

    console.log(`\n🔐 Memulai login ${akun.platform} untuk: ${akun.username}`);

    const hasil = await platform.login(akun_id, akun.username, password, {
      headless: headless !== false, // default headless
      proxy: akun.proxy || null,
    });

    // Log aktivitas
    db.logAktivitas(
      akun_id,
      akun.platform,
      'login',
      `Login ${hasil.sukses ? 'berhasil' : 'gagal'}: ${akun.username}`,
      hasil.sukses ? 'sukses' : 'gagal'
    );

    // Update status akun jika berhasil
    if (hasil.sukses) {
      db.updateAkun(akun_id, { status: 'aktif' });
    }

    res.json({
      sukses: hasil.sukses,
      pesan: hasil.pesan,
      data: {
        akun_id,
        platform: akun.platform,
        username: akun.username,
      }
    });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Login gagal: ' + err.message });
  }
});

// ==================== POST: Jalankan Aksi (Follow/Like/Comment/View/Share) ====================
router.post('/aksi', async (req, res) => {
  try {
    const { akun_id, aksi, target, komentar, durasi } = req.body;

    if (!akun_id || !aksi || !target) {
      return res.status(400).json({
        sukses: false,
        pesan: 'akun_id, aksi, dan target wajib diisi'
      });
    }

    const aksiValid = ['follow', 'like', 'comment', 'view', 'share'];
    if (!aksiValid.includes(aksi)) {
      return res.status(400).json({
        sukses: false,
        pesan: `Aksi tidak valid. Pilih: ${aksiValid.join(', ')}`
      });
    }

    if (aksi === 'comment' && !komentar) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Komentar wajib diisi untuk aksi comment'
      });
    }

    // Ambil data akun
    const akun = db.ambilAkunById(akun_id);
    if (!akun) {
      return res.status(404).json({ sukses: false, pesan: 'Akun tidak ditemukan' });
    }

    // Ambil modul platform
    const platform = ambilPlatform(akun.platform);
    if (!platform) {
      return res.status(400).json({ sukses: false, pesan: `Platform ${akun.platform} tidak tersedia` });
    }

    // Cek apakah browser sudah aktif
    const { ambilBrowser } = require('../browser/manager');
    const browser = ambilBrowser(akun_id);
    if (!browser) {
      return res.status(400).json({
        sukses: false,
        pesan: 'Browser belum aktif. Login terlebih dahulu.'
      });
    }

    // Ambil halaman aktif
    const pages = await browser.pages();
    const page = pages[pages.length - 1] || await browser.newPage();

    console.log(`\n🤖 Menjalankan aksi: ${aksi} | Platform: ${akun.platform} | Target: ${target}`);

    // Jalankan aksi
    let hasil;
    switch (aksi) {
      case 'follow':
        hasil = await platform.follow(page, target);
        break;
      case 'like':
        hasil = await platform.like(page, target);
        break;
      case 'comment':
        hasil = await platform.comment(page, target, komentar);
        break;
      case 'view':
        hasil = await platform.view(page, target, durasi || 10);
        break;
      case 'share':
        hasil = await platform.share(page, target);
        break;
    }

    // Log aktivitas
    db.logAktivitas(
      akun_id,
      akun.platform,
      aksi,
      `${aksi} ${target}: ${hasil.pesan}`,
      hasil.sukses ? 'sukses' : 'gagal'
    );

    res.json({
      sukses: hasil.sukses,
      pesan: hasil.pesan,
      data: {
        akun_id,
        platform: akun.platform,
        username: akun.username,
        aksi,
        target,
      }
    });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: 'Aksi gagal: ' + err.message });
  }
});

// ==================== POST: Tutup Browser ====================
router.post('/tutup', async (req, res) => {
  try {
    const { akun_id } = req.body;

    if (!akun_id) {
      return res.status(400).json({ sukses: false, pesan: 'akun_id wajib diisi' });
    }

    const berhasil = await tutupBrowser(akun_id);

    if (berhasil) {
      db.logAktivitas(akun_id, null, 'tutup_browser', 'Browser ditutup');
      res.json({ sukses: true, pesan: 'Browser berhasil ditutup' });
    } else {
      res.json({ sukses: false, pesan: 'Browser tidak ditemukan atau sudah ditutup' });
    }
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// ==================== GET: Cek Session ====================
router.get('/session/:akun_id', (req, res) => {
  const ada = cekSession(req.params.akun_id);
  res.json({ sukses: true, data: { ada_session: ada } });
});

// ==================== DELETE: Hapus Session ====================
router.delete('/session/:akun_id', (req, res) => {
  const berhasil = hapusSession(req.params.akun_id);
  res.json({ sukses: true, pesan: berhasil ? 'Session dihapus' : 'Session tidak ditemukan' });
});

// ==================== TASK QUEUE ====================

// GET: Daftar task
router.get('/tasks', (req, res) => {
  const { status, platform, akun_id, limit } = req.query;
  const tasks = db.ambilSemuaTask({
    status, platform, akun_id,
    limit: limit ? parseInt(limit) : 100
  });
  res.json({ sukses: true, data: tasks });
});

// GET: Statistik task
router.get('/tasks/stats', (req, res) => {
  res.json({ sukses: true, data: db.hitungTask() });
});

// POST: Tambah task baru
router.post('/tasks', (req, res) => {
  try {
    const { akun_id, aksi, target, komentar, durasi } = req.body;

    if (!akun_id || !aksi || !target) {
      return res.status(400).json({
        sukses: false,
        pesan: 'akun_id, aksi, dan target wajib diisi'
      });
    }

    const akun = db.ambilAkunById(akun_id);
    if (!akun) {
      return res.status(404).json({ sukses: false, pesan: 'Akun tidak ditemukan' });
    }

    const task = db.tambahTask({
      akun_id,
      platform: akun.platform,
      aksi,
      target,
      komentar: komentar || '',
      durasi: durasi || 10,
    });

    res.json({ sukses: true, pesan: 'Task ditambahkan ke antrian', data: task });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// POST: Tambah banyak task (bulk)
router.post('/tasks/bulk', (req, res) => {
  try {
    const { akun_ids, aksi, targets, komentar, durasi } = req.body;

    if (!akun_ids || !aksi || !targets) {
      return res.status(400).json({
        sukses: false,
        pesan: 'akun_ids, aksi, dan targets wajib diisi'
      });
    }

    const tasks = [];
    const targetList = Array.isArray(targets) ? targets : [targets];
    const akunList = Array.isArray(akun_ids) ? akun_ids : [akun_ids];

    for (const akun_id of akunList) {
      const akun = db.ambilAkunById(akun_id);
      if (!akun) continue;

      for (const target of targetList) {
        tasks.push({
          akun_id,
          platform: akun.platform,
          aksi,
          target: target.trim(),
          komentar: komentar || '',
          durasi: durasi || 10,
        });
      }
    }

    const sukses = db.tambahBanyakTask(tasks);
    res.json({ sukses: true, pesan: `${sukses} task ditambahkan ke antrian` });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

// POST: Batalkan semua task
router.post('/tasks/cancel-all', (req, res) => {
  db.batalkanSemuaTask();
  res.json({ sukses: true, pesan: 'Semua task dibatalkan' });
});

// POST: Bersihkan task selesai
router.post('/tasks/clear', (req, res) => {
  db.bersihkanTaskSelesai();
  res.json({ sukses: true, pesan: 'Task selesai/gagal dihapus' });
});

// DELETE: Hapus task
router.delete('/tasks/:id', (req, res) => {
  db.hapusTask(req.params.id);
  res.json({ sukses: true, pesan: 'Task dihapus' });
});

// POST: Batalkan task
router.patch('/tasks/:id/cancel', (req, res) => {
  db.updateStatusTask(req.params.id, 'dibatalkan', 'Dibatalkan oleh user');
  res.json({ sukses: true, pesan: 'Task dibatalkan' });
});

// ==================== TASK RUNNER ENGINE ====================
const taskRunner = require('../engine/taskRunner');

// GET: Status Task Runner & Statistik
router.get('/tasks/runner-status', (req, res) => {
  res.json({ sukses: true, data: taskRunner.getStatus() });
});

// POST: Jalankan Antrian Task
router.post('/tasks/start', (req, res) => {
  const hasil = taskRunner.startQueue();
  res.json({ sukses: true, pesan: hasil.pesan, data: taskRunner.getStatus() });
});

// POST: Jeda Antrian Task
router.post('/tasks/pause', (req, res) => {
  const hasil = taskRunner.stopQueue();
  res.json({ sukses: true, pesan: hasil.pesan, data: taskRunner.getStatus() });
});

// POST: Jalankan 1 task tertentu sekarang
router.post('/tasks/:id/run', async (req, res) => {
  try {
    const tasks = db.ambilSemuaTask();
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) {
      return res.status(404).json({ sukses: false, pesan: 'Task tidak ditemukan' });
    }
    const hasil = await taskRunner.prosesSatuTask(task);
    res.json({ sukses: hasil.sukses, pesan: hasil.pesan });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

module.exports = router;
