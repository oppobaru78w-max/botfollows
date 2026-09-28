const { ambilPlatform } = require('../platforms');
const { ambilBrowser, bukaBrowser, buatHalaman } = require('../browser/manager');
const db = require('../config/database');

let isRunning = false;
let currentTaskId = null;
let stopRequested = false;

/**
 * Jalankan satu task
 */
async function prosesSatuTask(task) {
  currentTaskId = task.id;
  db.updateStatusTask(task.id, 'berjalan');
  console.log(`\n▶️ [Task Engine] Menjalankan task [${task.id}] — ${task.aksi} pada target ${task.target} (${task.platform})`);

  try {
    const akun = db.ambilAkunById(task.akun_id);
    if (!akun) {
      throw new Error(`Akun dengan ID ${task.akun_id} tidak ditemukan`);
    }

    const platform = ambilPlatform(task.platform);
    if (!platform) {
      throw new Error(`Platform ${task.platform} belum didukung`);
    }

    // Ambil browser aktif atau buka baru jika belum ada
    let browser = ambilBrowser(task.akun_id);
    let page;
    if (!browser) {
      // Gunakan proxy akun jika ada, atau ambil dari proxy pool rotasi otomatis
      let proxyTarget = akun.proxy || null;
      if (!proxyTarget) {
        const poolProxy = db.ambilProxyRotasi();
        if (poolProxy) {
          proxyTarget = poolProxy;
          console.log(`  🔄 [Auto-Proxy Rotator] Menggunakan proxy: ${poolProxy.host}:${poolProxy.port}`);
        }
      }

      console.log(`  🌐 Membuka browser untuk akun: ${akun.username} (${task.platform})...`);
      browser = await bukaBrowser(task.akun_id, {
        headless: true,
        proxy: proxyTarget,
      });
      page = await buatHalaman(browser);
    } else {
      const pages = await browser.pages();
      page = pages[pages.length - 1] || await browser.newPage();
    }

    // Pasang session cookies akun jika tersedia untuk autentikasi otomatis
    const savedCookies = db.ambilCookiesAkun(task.akun_id);
    if (savedCookies && savedCookies.length > 0) {
      try {
        await page.setCookie(...savedCookies);
      } catch (e) {
        console.warn(`  ⚠️ Gagal memasang cookies sesi: ${e.message}`);
      }
    }

    let hasil;
    switch (task.aksi) {
      case 'follow':
        hasil = await platform.follow(page, task.target);
        break;
      case 'like':
        hasil = await platform.like(page, task.target);
        break;
      case 'comment':
        hasil = await platform.comment(page, task.target, task.komentar);
        break;
      case 'view':
        hasil = await platform.view(page, task.target, task.durasi || 10);
        break;
      case 'share':
        hasil = await platform.share(page, task.target);
        break;
      default:
        throw new Error(`Aksi "${task.aksi}" tidak dikenali`);
    }

    if (hasil && hasil.sukses) {
      db.updateStatusTask(task.id, 'selesai', hasil.pesan || 'Berhasil dieksekusi');
      db.logAktivitas(task.akun_id, task.platform, task.aksi, `Sukses: ${task.target}`, 'sukses');
      console.log(`  ✅ Task [${task.id}] berhasil diselesaikan`);
      return { sukses: true, pesan: hasil.pesan };
    } else {
      const msg = hasil?.pesan || 'Gagal dieksekusi oleh platform';
      db.updateStatusTask(task.id, 'gagal', msg);
      db.logAktivitas(task.akun_id, task.platform, task.aksi, `Gagal: ${msg}`, 'gagal');
      console.log(`  ❌ Task [${task.id}] gagal: ${msg}`);
      return { sukses: false, pesan: msg };
    }
  } catch (err) {
    db.updateStatusTask(task.id, 'gagal', err.message);
    db.logAktivitas(task.akun_id, task.platform, task.aksi, `Error: ${err.message}`, 'gagal');
    console.error(`  ❌ Error pada task [${task.id}]:`, err.message);
    return { sukses: false, pesan: err.message };
  } finally {
    currentTaskId = null;
  }
}

/**
 * Loop pemrosesan antrian task
 */
async function loopQueue() {
  if (isRunning) return;
  isRunning = true;
  stopRequested = false;

  console.log('\n🚀 [Task Engine] Pemrosesan antrian dimulai');

  try {
    while (!stopRequested) {
      const antrian = db.ambilTaskAntrian(1);
      if (!antrian || antrian.length === 0) {
        console.log('🏁 [Task Engine] Antrian kosong');
        break;
      }

      const task = antrian[0];
      await prosesSatuTask(task);

      if (stopRequested) break;

      // Jeda anti-deteksi antar aksi (2-4 detik)
      const jeda = Math.floor(Math.random() * 2000) + 2000;
      await new Promise(r => setTimeout(r, jeda));
    }
  } catch (loopErr) {
    console.error('❌ Error loop queue:', loopErr);
  } finally {
    isRunning = false;
    currentTaskId = null;
    console.log('⏹️ [Task Engine] Pemrosesan antrian berhenti');
  }
}

function startQueue() {
  if (isRunning) {
    return { berjalan: true, pesan: 'Engine sudah berjalan' };
  }
  loopQueue();
  return { berjalan: true, pesan: 'Engine antrian berhasil dijalankan' };
}

function stopQueue() {
  stopRequested = true;
  isRunning = false;
  return { berjalan: false, pesan: 'Engine antrian dijeda' };
}

function getStatus() {
  return {
    isRunning,
    currentTaskId,
    stats: db.hitungTask(),
  };
}

module.exports = {
  startQueue,
  stopQueue,
  getStatus,
  prosesSatuTask,
};
