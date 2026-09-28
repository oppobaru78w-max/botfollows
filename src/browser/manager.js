const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

// Aktifkan stealth mode untuk anti-deteksi
puppeteer.use(StealthPlugin());

// Simpan session/cookies di folder ini
const SESSION_DIR = path.join(__dirname, '..', '..', 'data', 'sessions');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Simpan semua browser instance yang aktif
const aktivBrowser = new Map();

/**
 * Buka browser baru dengan anti-deteksi
 */
async function bukaBrowser(akunId, options = {}) {
  const {
    headless = true,
    proxy = null,
    slowMo = 50,
  } = options;

  const sessionPath = path.join(SESSION_DIR, akunId);
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--window-size=1366,768',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--lang=id-ID,id',
  ];

  let proxyServer = null;
  let proxyAuth = null;

  if (proxy) {
    const db = require('../config/database');
    if (typeof proxy === 'string') {
      const parsed = db.parseProxyString(proxy);
      if (parsed && parsed.host) {
        proxyServer = `${parsed.protokol || 'http'}://${parsed.host}:${parsed.port}`;
        if (parsed.username && parsed.password) {
          proxyAuth = { username: parsed.username, password: parsed.password };
        }
      } else {
        proxyServer = proxy;
      }
    } else if (typeof proxy === 'object' && proxy.host) {
      proxyServer = `${proxy.protokol || 'http'}://${proxy.host}:${proxy.port}`;
      if (proxy.username && proxy.password) {
        proxyAuth = { username: proxy.username, password: proxy.password };
      }
    }
  }

  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
  }

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args,
    slowMo,
    userDataDir: sessionPath,
    defaultViewport: {
      width: 1366,
      height: 768,
    },
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Simpan instance
  aktivBrowser.set(akunId, { browser, dibuat: new Date(), proxyAuth });

  console.log(`  🌐 Browser dibuka untuk akun: ${akunId}${proxyServer ? ' [Proxy: ' + proxyServer + ']' : ''}`);
  return browser;
}

/**
 * Tutup browser
 */
async function tutupBrowser(akunId) {
  const entry = aktivBrowser.get(akunId);
  if (entry) {
    try {
      await entry.browser.close();
    } catch (e) {
      // Browser mungkin sudah ditutup
    }
    aktivBrowser.delete(akunId);
    console.log(`  🔒 Browser ditutup untuk akun: ${akunId}`);
    return true;
  }
  return false;
}

/**
 * Tutup semua browser
 */
async function tutupSemuaBrowser() {
  for (const [akunId] of aktivBrowser) {
    await tutupBrowser(akunId);
  }
}

/**
 * Ambil browser yang sudah aktif
 */
function ambilBrowser(akunId) {
  const entry = aktivBrowser.get(akunId);
  return entry ? entry.browser : null;
}

/**
 * Buat halaman baru dengan anti-deteksi tambahan & proxy auth
 */
async function buatHalaman(browser, proxyAuth = null) {
  const page = await browser.newPage();

  // Autentikasi proxy jika diperlukan
  if (proxyAuth && proxyAuth.username) {
    await page.authenticate(proxyAuth);
  }

  // Set User-Agent yang realistis
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // Sembunyikan webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);
  });

  return page;
}

/**
 * Delay acak untuk menghindari deteksi
 */
function delayAcak(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ketik teks seperti manusia (dengan delay antar huruf)
 */
async function ketikManusia(page, selector, teks) {
  await page.click(selector);
  await delayAcak(300, 600);

  for (const huruf of teks) {
    await page.type(selector, huruf, { delay: Math.floor(Math.random() * 150) + 50 });
  }
}

/**
 * Scroll halaman secara bertahap
 */
async function scrollPelan(page, jarak = 300) {
  await page.evaluate((j) => {
    window.scrollBy({ top: j, behavior: 'smooth' });
  }, jarak);
  await delayAcak(500, 1500);
}

/**
 * Ambil status semua browser aktif
 */
function statusBrowser() {
  const status = [];
  for (const [akunId, entry] of aktivBrowser) {
    status.push({
      akun_id: akunId,
      aktif: true,
      dibuat: entry.dibuat.toISOString(),
    });
  }
  return status;
}

/**
 * Cek apakah session (cookies) sudah tersimpan
 */
function cekSession(akunId) {
  const sessionPath = path.join(SESSION_DIR, akunId);
  return fs.existsSync(sessionPath) && fs.readdirSync(sessionPath).length > 0;
}

/**
 * Hapus session
 */
function hapusSession(akunId) {
  const sessionPath = path.join(SESSION_DIR, akunId);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

// Bersihkan saat proses keluar
process.on('exit', () => { tutupSemuaBrowser(); });
process.on('SIGINT', async () => { await tutupSemuaBrowser(); process.exit(); });
process.on('SIGTERM', async () => { await tutupSemuaBrowser(); process.exit(); });

module.exports = {
  bukaBrowser,
  tutupBrowser,
  tutupSemuaBrowser,
  ambilBrowser,
  buatHalaman,
  delayAcak,
  ketikManusia,
  scrollPelan,
  statusBrowser,
  cekSession,
  hapusSession,
};
