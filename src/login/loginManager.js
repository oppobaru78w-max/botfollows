/**
 * Login & Session Manager
 * Mengelola auto-login headless, visual browser login, verifikasi sesi,
 * dan import/export cookies untuk TikTok, Instagram, Facebook, dan YouTube.
 */

const db = require('../config/database');
const { bukaBrowser, tutupBrowser, buatHalaman, delayAcak, ambilBrowser, hapusSession } = require('../browser/manager');
const platforms = {
  tiktok: require('../platforms/tiktok'),
  instagram: require('../platforms/instagram'),
  facebook: require('../platforms/facebook'),
  youtube: require('../platforms/youtube'),
};

const PLATFORM_LOGIN_URLS = {
  tiktok: 'https://www.tiktok.com/login/phone-or-email/email',
  instagram: 'https://www.instagram.com/accounts/login/',
  facebook: 'https://www.facebook.com/login',
  youtube: 'https://accounts.google.com/ServiceLogin?service=youtube',
};

const PLATFORM_HOME_URLS = {
  tiktok: 'https://www.tiktok.com',
  instagram: 'https://www.instagram.com',
  facebook: 'https://www.facebook.com',
  youtube: 'https://www.youtube.com',
};

/**
 * Auto-login akun bot secara otomatis (Headless atau Visual)
 */
async function autoLogin(akunId, options = {}) {
  const akun = db.ambilAkunById(akunId);
  if (!akun) {
    throw new Error('Akun tidak ditemukan');
  }

  const { headless = true, timeout = 45000 } = options;
  const password = db.ambilPasswordDekripsiAkun(akunId);

  if (!password) {
    return {
      sukses: false,
      pesan: 'Password akun tidak tersedia untuk auto-login. Silakan update password atau gunakan mode Buka Browser Manual.',
      session_status: 'belum_login'
    };
  }

  // Pilih proxy (dari akun atau dari pool)
  let proxy = akun.proxy;
  if (!proxy) {
    const proxyRotasi = db.ambilProxyRotasi();
    if (proxyRotasi) {
      proxy = proxyRotasi;
    }
  }

  const platformModul = platforms[akun.platform];
  if (!platformModul || typeof platformModul.login !== 'function') {
    throw new Error(`Modul login untuk platform ${akun.platform} belum didukung`);
  }

  console.log(`🔑 [AutoLogin] Memulai login untuk ${akun.username} (${akun.platform}) [Headless: ${headless}]`);
  db.logAktivitas(akunId, akun.platform, 'auto_login', `Mencoba auto-login (${headless ? 'Headless' : 'Visual'})...`);

  try {
    const hasil = await platformModul.login(akunId, akun.username, password, {
      headless,
      proxy,
      timeout
    });

    if (hasil.sukses && hasil.page) {
      // Ambil cookies setelah login berhasil
      const cookies = await hasil.page.cookies();
      db.simpanCookiesAkun(akunId, cookies, 'logged_in');
      db.logAktivitas(akunId, akun.platform, 'login_sukses', `Login berhasil. ${cookies.length} cookies disimpan.`);

      // Tutup browser
      await tutupBrowser(akunId);

      return {
        sukses: true,
        pesan: `Login berhasil! ${cookies.length} cookies sesi disimpan.`,
        session_status: 'logged_in',
        cookies_count: cookies.length
      };
    } else {
      // Login gagal atau butuh captcha
      const isChallenge = hasil.pesan && (
        hasil.pesan.toLowerCase().includes('verifikasi') ||
        hasil.pesan.toLowerCase().includes('captcha') ||
        hasil.pesan.toLowerCase().includes('checkpoint')
      );

      const statusSesi = isChallenge ? 'challenge' : 'belum_login';
      db.updateStatusSesiAkun(akunId, statusSesi, `Login gagal: ${hasil.pesan}`);

      if (!headless) {
        // Browser tetap terbuka agar operator bisa menyelesaikan tantangan
        return {
          sukses: false,
          status: 'challenge',
          browser_open: true,
          pesan: `${hasil.pesan}. Browser sedang terbuka di layar Anda. Silakan selesaikan verifikasi lalu klik "Simpan Sesi Dari Browser".`
        };
      } else {
        await tutupBrowser(akunId);
        return {
          sukses: false,
          status: statusSesi,
          pesan: `${hasil.pesan}. Gunakan opsi "Buka Browser Manual" untuk login interaktif atau menyelesaikan captcha.`
        };
      }
    }
  } catch (err) {
    await tutupBrowser(akunId);
    db.updateStatusSesiAkun(akunId, 'belum_login', `Error auto-login: ${err.message}`);
    return {
      sukses: false,
      pesan: `Gagal auto-login: ${err.message}`,
      session_status: 'belum_login'
    };
  }
}

/**
 * Buka browser visual di layar agar pengguna bisa login manual & selesaikan captcha
 */
async function bukaBrowserManual(akunId) {
  const akun = db.ambilAkunById(akunId);
  if (!akun) throw new Error('Akun tidak ditemukan');

  // Pastikan browser lama tertutup
  await tutupBrowser(akunId);

  let proxy = akun.proxy;
  if (!proxy) {
    const proxyRotasi = db.ambilProxyRotasi();
    if (proxyRotasi) proxy = proxyRotasi;
  }

  const browser = await bukaBrowser(akunId, {
    headless: false,
    proxy,
    slowMo: 30
  });

  const page = await buatHalaman(browser);
  const targetUrl = PLATFORM_LOGIN_URLS[akun.platform] || 'https://google.com';

  // Inject cookies lama jika sudah pernah ada
  const savedCookies = db.ambilCookiesAkun(akunId);
  if (savedCookies && savedCookies.length > 0) {
    try {
      await page.setCookie(...savedCookies);
    } catch (e) {
      console.warn('Gagal setCookie lama:', e.message);
    }
  }

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

  db.logAktivitas(akunId, akun.platform, 'buka_browser_manual', `Browser login interaktif dibuka`);

  return {
    sukses: true,
    pesan: `Browser Chrome interaktif telah terbuka di layar. Silakan selesaikan login untuk akun ${akun.username}. Setelah login selesai, klik "Simpan Sesi Dari Browser".`,
    target_url: targetUrl
  };
}

/**
 * Ambil cookies dari browser interaktif yang sedang terbuka lalu simpan ke database
 */
async function simpanSesiDariBrowser(akunId) {
  const akun = db.ambilAkunById(akunId);
  if (!akun) throw new Error('Akun tidak ditemukan');

  const browser = ambilBrowser(akunId);
  if (!browser) {
    return {
      sukses: false,
      pesan: 'Tidak ada browser aktif untuk akun ini. Buka browser terlebih dahulu dengan "Buka Browser Manual".'
    };
  }

  try {
    const pages = await browser.pages();
    if (!pages || pages.length === 0) {
      throw new Error('Tidak ada halaman aktif di browser');
    }

    const page = pages[pages.length - 1]; // halaman teratas
    const cookies = await page.cookies();

    if (!cookies || cookies.length === 0) {
      return {
        sukses: false,
        pesan: 'Tidak ada cookies ditemukan. Pastikan Anda telah berhasil login di halaman website.'
      };
    }

    db.simpanCookiesAkun(akunId, cookies, 'logged_in');
    db.logAktivitas(akunId, akun.platform, 'simpan_sesi', `Sesi & ${cookies.length} cookies berhasil disimpan dari browser`);

    // Tutup browser setelah disimpan
    await tutupBrowser(akunId);

    return {
      sukses: true,
      pesan: `Berhasil mengambil & menyimpan ${cookies.length} cookies sesi! Status akun kini aktif.`,
      session_status: 'logged_in',
      cookies_count: cookies.length
    };
  } catch (err) {
    return {
      sukses: false,
      pesan: 'Gagal mengekstrak cookies dari browser: ' + err.message
    };
  }
}

/**
 * Tutup browser manual tanpa menyimpan
 */
async function tutupBrowserManual(akunId) {
  const sukses = await tutupBrowser(akunId);
  return {
    sukses,
    pesan: sukses ? 'Browser berhasil ditutup.' : 'Tidak ada browser aktif untuk ditutup.'
  };
}

/**
 * Verifikasi apakah sesi cookies masih aktif dan valid
 */
async function verifikasiSesi(akunId) {
  const akun = db.ambilAkunById(akunId);
  if (!akun) throw new Error('Akun tidak ditemukan');

  const cookies = db.ambilCookiesAkun(akunId);
  if (!cookies || cookies.length === 0) {
    db.updateStatusSesiAkun(akunId, 'belum_login');
    return {
      sukses: true,
      valid: false,
      session_status: 'belum_login',
      pesan: 'Akun belum memiliki data sesi/cookies.'
    };
  }

  let proxy = akun.proxy;
  if (!proxy) {
    const proxyRotasi = db.ambilProxyRotasi();
    if (proxyRotasi) proxy = proxyRotasi;
  }

  let browser = null;
  try {
    browser = await bukaBrowser(akunId, { headless: true, proxy });
    const page = await buatHalaman(browser);

    // Pasang cookies ke halaman
    await page.setCookie(...cookies);

    const testUrl = PLATFORM_HOME_URLS[akun.platform] || 'https://www.tiktok.com';
    await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(1500, 2500);

    const currentUrl = page.url();
    let isValid = false;

    if (akun.platform === 'tiktok') {
      const loginBtn = await page.$('[data-e2e="top-login-button"]');
      isValid = !loginBtn && !currentUrl.includes('/login');
    } else if (akun.platform === 'instagram') {
      isValid = !currentUrl.includes('/accounts/login/');
    } else if (akun.platform === 'facebook') {
      isValid = !currentUrl.includes('/login') && !currentUrl.includes('/checkpoint');
    } else if (akun.platform === 'youtube') {
      const signInBtn = await page.$('a[href*="accounts.google.com"]');
      isValid = !signInBtn;
    } else {
      isValid = !currentUrl.includes('login');
    }

    const newStatus = isValid ? 'logged_in' : 'expired';
    db.updateStatusSesiAkun(akunId, newStatus, isValid ? 'Sesi terverifikasi aktif' : 'Sesi terdeteksi expired');

    await tutupBrowser(akunId);

    return {
      sukses: true,
      valid: isValid,
      session_status: newStatus,
      pesan: isValid ? 'Sesi akun masih aktif dan valid.' : 'Sesi telah kedaluwarsa atau membutuhkan login ulang.'
    };
  } catch (err) {
    if (browser) await tutupBrowser(akunId);
    return {
      sukses: false,
      pesan: `Gagal verifikasi sesi: ${err.message}`
    };
  }
}

/**
 * Verifikasi semua akun yang memiliki cookies
 */
async function verifikasiSemuaSesi() {
  const akuns = db.ambilSemuaAkun();
  let validCount = 0;
  let expiredCount = 0;
  let skippedCount = 0;

  for (const a of akuns) {
    const cookies = db.ambilCookiesAkun(a.id);
    if (!cookies || cookies.length === 0) {
      skippedCount++;
      continue;
    }

    try {
      const res = await verifikasiSesi(a.id);
      if (res.valid) validCount++;
      else expiredCount++;
    } catch {
      expiredCount++;
    }
  }

  return {
    sukses: true,
    ringkasan: {
      total_akun: akuns.length,
      valid: validCount,
      expired: expiredCount,
      tanpa_cookies: skippedCount
    },
    pesan: `Pemeriksaan selesai: ${validCount} aktif, ${expiredCount} expired, ${skippedCount} belum login.`
  };
}

/**
 * Import cookies dari format JSON
 */
function importCookies(akunId, cookiesInput) {
  const akun = db.ambilAkunById(akunId);
  if (!akun) throw new Error('Akun tidak ditemukan');

  let cookiesArray = [];
  if (typeof cookiesInput === 'string') {
    try {
      cookiesArray = JSON.parse(cookiesInput);
    } catch (e) {
      throw new Error('Format JSON cookies tidak valid: ' + e.message);
    }
  } else if (Array.isArray(cookiesInput)) {
    cookiesArray = cookiesInput;
  } else {
    throw new Error('Data cookies harus berupa array JSON');
  }

  // Sanitasi & normalisasi cookies
  const validCookies = cookiesArray.filter(c => c && c.name && c.value).map(c => {
    const item = {
      name: String(c.name),
      value: String(c.value),
      domain: c.domain || (akun.platform === 'tiktok' ? '.tiktok.com' :
                          akun.platform === 'instagram' ? '.instagram.com' :
                          akun.platform === 'facebook' ? '.facebook.com' : '.youtube.com'),
      path: c.path || '/'
    };
    if (c.secure !== undefined) item.secure = Boolean(c.secure);
    if (c.httpOnly !== undefined) item.httpOnly = Boolean(c.httpOnly);
    if (c.sameSite) item.sameSite = c.sameSite;
    return item;
  });

  if (validCookies.length === 0) {
    throw new Error('Tidak ditemukan cookie yang valid dalam format yang dimasukkan.');
  }

  db.simpanCookiesAkun(akunId, validCookies, 'logged_in');
  db.logAktivitas(akunId, akun.platform, 'import_cookies', `Berhasil import ${validCookies.length} cookies secara manual`);

  return {
    sukses: true,
    pesan: `Berhasil mengimport ${validCookies.length} cookies. Status sesi akun kini aktif.`,
    session_status: 'logged_in',
    cookies_count: validCookies.length
  };
}

/**
 * Export cookies ke format JSON
 */
function exportCookies(akunId) {
  const akun = db.ambilAkunById(akunId);
  if (!akun) throw new Error('Akun tidak ditemukan');

  const cookies = db.ambilCookiesAkun(akunId);
  return {
    sukses: true,
    akun: { id: akun.id, username: akun.username, platform: akun.platform },
    cookies_count: cookies.length,
    cookies
  };
}

/**
 * Hapus sesi & cookies akun
 */
function hapusSesi(akunId) {
  const akun = db.ambilAkunById(akunId);
  if (!akun) throw new Error('Akun tidak ditemukan');

  db.hapusCookiesAkun(akunId);
  hapusSession(akunId);
  db.logAktivitas(akunId, akun.platform, 'hapus_sesi', `Sesi akun ${akun.username} direset`);

  return {
    sukses: true,
    pesan: `Sesi akun ${akun.username} berhasil dibersihkan.`
  };
}

module.exports = {
  autoLogin,
  bukaBrowserManual,
  simpanSesiDariBrowser,
  tutupBrowserManual,
  verifikasiSesi,
  verifikasiSemuaSesi,
  importCookies,
  exportCookies,
  hapusSesi
};
