/**
 * Modul Platform TikTok
 * Login, follow, like, view, comment, share
 */

const { bukaBrowser, buatHalaman, delayAcak, ketikManusia, scrollPelan } = require('../browser/manager');

const TIKTOK_URL = 'https://www.tiktok.com';
const TIKTOK_LOGIN_URL = 'https://www.tiktok.com/login/phone-or-email/email';

/**
 * Login ke TikTok
 */
async function login(akunId, username, password, options = {}) {
  const browser = await bukaBrowser(akunId, options);
  const page = await buatHalaman(browser);

  try {
    console.log(`  🎵 [TikTok] Memulai login untuk: ${username}`);

    await page.goto(TIKTOK_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Klik tab "Login dengan email / username"
    // TikTok sering mengubah selector, jadi kita coba beberapa
    const loginSelectors = [
      'a[href*="email"]',
      '[data-e2e="login-email-tab"]',
      'div[class*="login"] a:nth-child(1)',
    ];

    for (const sel of loginSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await delayAcak(1000, 2000);
          break;
        }
      } catch (e) { /* skip */ }
    }

    // Isi username
    const usernameSelectors = [
      'input[name="username"]',
      'input[placeholder*="Email"]',
      'input[placeholder*="email"]',
      'input[placeholder*="Phone"]',
      'input[type="text"]',
    ];

    let usernameField = null;
    for (const sel of usernameSelectors) {
      usernameField = await page.$(sel);
      if (usernameField) break;
    }

    if (usernameField) {
      await ketikManusia(page, usernameSelectors.find(s => page.$(s)), username);
      await delayAcak(500, 1000);
    }

    // Isi password
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="Password"]',
      'input[placeholder*="password"]',
    ];

    let passwordField = null;
    for (const sel of passwordSelectors) {
      passwordField = await page.$(sel);
      if (passwordField) {
        await ketikManusia(page, sel, password);
        await delayAcak(500, 1000);
        break;
      }
    }

    // Klik tombol login
    const loginBtnSelectors = [
      'button[type="submit"]',
      '[data-e2e="login-button"]',
      'button[class*="login"]',
    ];

    for (const sel of loginBtnSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        break;
      }
    }

    // Tunggu navigasi
    await delayAcak(3000, 5000);

    // Cek apakah login berhasil
    const currentUrl = page.url();
    const loginBerhasil = !currentUrl.includes('login');

    if (loginBerhasil) {
      console.log(`  ✅ [TikTok] Login berhasil: ${username}`);
      return { sukses: true, pesan: 'Login berhasil', page, browser };
    } else {
      // Mungkin ada captcha atau verifikasi
      console.log(`  ⚠️ [TikTok] Login memerlukan verifikasi: ${username}`);
      return { sukses: false, pesan: 'Perlu verifikasi captcha/OTP', page, browser };
    }
  } catch (err) {
    console.error(`  ❌ [TikTok] Login gagal: ${err.message}`);
    return { sukses: false, pesan: err.message, page, browser };
  }
}

/**
 * Cek apakah sudah login
 */
async function cekLogin(page) {
  try {
    await page.goto(TIKTOK_URL, { waitUntil: 'networkidle2', timeout: 20000 });
    await delayAcak(2000, 3000);

    // Cek apakah ada tombol login (berarti belum login)
    const loginBtn = await page.$('[data-e2e="top-login-button"]');
    return !loginBtn;
  } catch {
    return false;
  }
}

/**
 * Follow user target
 */
async function follow(page, targetUsername) {
  try {
    console.log(`  👥 [TikTok] Follow: @${targetUsername}`);

    const profileUrl = `${TIKTOK_URL}/@${targetUsername.replace('@', '')}`;
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Cari tombol follow
    const followSelectors = [
      '[data-e2e="follow-button"]',
      'button[class*="follow"]',
      'button:has-text("Follow")',
    ];

    for (const sel of followSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          const text = await page.evaluate(el => el.textContent, btn);
          if (text && (text.includes('Follow') || text.includes('Ikuti'))) {
            await btn.click();
            await delayAcak(1000, 2000);
            console.log(`  ✅ [TikTok] Berhasil follow @${targetUsername}`);
            return { sukses: true, pesan: `Berhasil follow @${targetUsername}` };
          }
        }
      } catch (e) { /* skip */ }
    }

    return { sukses: false, pesan: 'Tombol follow tidak ditemukan atau sudah di-follow' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Like video
 */
async function like(page, videoUrl) {
  try {
    console.log(`  ❤️ [TikTok] Like: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Tonton dulu beberapa detik
    await delayAcak(3000, 6000);

    // Klik like
    const likeSelectors = [
      '[data-e2e="like-icon"]',
      '[data-e2e="browse-like-icon"]',
      'span[class*="like"]',
    ];

    for (const sel of likeSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          await delayAcak(500, 1000);
          console.log(`  ✅ [TikTok] Berhasil like video`);
          return { sukses: true, pesan: 'Berhasil like video' };
        }
      } catch (e) { /* skip */ }
    }

    return { sukses: false, pesan: 'Tombol like tidak ditemukan' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Comment pada video
 */
async function comment(page, videoUrl, teksKomentar) {
  try {
    console.log(`  💬 [TikTok] Comment: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Klik area komentar
    const commentSelectors = [
      '[data-e2e="comment-input"]',
      'div[class*="comment-input"]',
      '[contenteditable="true"]',
    ];

    for (const sel of commentSelectors) {
      try {
        const input = await page.$(sel);
        if (input) {
          await input.click();
          await delayAcak(500, 1000);
          await page.keyboard.type(teksKomentar, { delay: 100 });
          await delayAcak(500, 1000);

          // Tekan Enter atau klik post
          await page.keyboard.press('Enter');
          await delayAcak(1000, 2000);

          console.log(`  ✅ [TikTok] Berhasil comment`);
          return { sukses: true, pesan: 'Berhasil menambahkan komentar' };
        }
      } catch (e) { /* skip */ }
    }

    return { sukses: false, pesan: 'Input komentar tidak ditemukan' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * View video (buka dan tonton)
 */
async function view(page, videoUrl, durasiDetik = 10) {
  try {
    console.log(`  👁️ [TikTok] View: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 3000);

    // Tonton selama durasi
    await delayAcak(durasiDetik * 1000, (durasiDetik + 3) * 1000);

    console.log(`  ✅ [TikTok] Berhasil view video (${durasiDetik}s)`);
    return { sukses: true, pesan: `Video ditonton selama ${durasiDetik} detik` };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Share video
 */
async function share(page, videoUrl) {
  try {
    console.log(`  🔄 [TikTok] Share: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    const shareSelectors = [
      '[data-e2e="share-icon"]',
      '[data-e2e="browse-share-icon"]',
    ];

    for (const sel of shareSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          await delayAcak(1000, 2000);

          // Klik "Copy Link"
          const copySelectors = [
            '[data-e2e="copy-link"]',
            'a[class*="copy"]',
          ];

          for (const cs of copySelectors) {
            const copyBtn = await page.$(cs);
            if (copyBtn) {
              await copyBtn.click();
              await delayAcak(500, 1000);
              break;
            }
          }

          console.log(`  ✅ [TikTok] Berhasil share video`);
          return { sukses: true, pesan: 'Berhasil share video' };
        }
      } catch (e) { /* skip */ }
    }

    return { sukses: false, pesan: 'Tombol share tidak ditemukan' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

module.exports = {
  login,
  cekLogin,
  follow,
  like,
  comment,
  view,
  share,
  PLATFORM: 'tiktok',
  NAMA: 'TikTok',
  EMOJI: '🎵',
};
