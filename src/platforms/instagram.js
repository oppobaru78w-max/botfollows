/**
 * Modul Platform Instagram
 * Login, follow, like, view, comment, share
 */

const { bukaBrowser, buatHalaman, delayAcak, ketikManusia } = require('../browser/manager');

const IG_URL = 'https://www.instagram.com';
const IG_LOGIN_URL = 'https://www.instagram.com/accounts/login/';

/**
 * Login ke Instagram
 */
async function login(akunId, username, password, options = {}) {
  const browser = await bukaBrowser(akunId, options);
  const page = await buatHalaman(browser);

  try {
    console.log(`  📸 [Instagram] Memulai login untuk: ${username}`);

    await page.goto(IG_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Tutup dialog cookies jika ada
    try {
      const cookieBtn = await page.$('button:has-text("Allow")');
      if (cookieBtn) await cookieBtn.click();
    } catch (e) { /* skip */ }

    await delayAcak(1000, 2000);

    // Isi username
    const usernameField = await page.$('input[name="username"]');
    if (usernameField) {
      await usernameField.click({ clickCount: 3 });
      await page.keyboard.type(username, { delay: 80 });
      await delayAcak(500, 1000);
    }

    // Isi password
    const passwordField = await page.$('input[name="password"]');
    if (passwordField) {
      await passwordField.click();
      await page.keyboard.type(password, { delay: 80 });
      await delayAcak(500, 1000);
    }

    // Klik login
    const loginBtn = await page.$('button[type="submit"]');
    if (loginBtn) {
      await loginBtn.click();
    }

    await delayAcak(4000, 6000);

    // Handle "Save Login Info" popup
    try {
      const notNowBtn = await page.$('button:has-text("Not Now")');
      if (notNowBtn) await notNowBtn.click();
    } catch (e) { /* skip */ }

    await delayAcak(1000, 2000);

    // Handle "Turn on Notifications" popup
    try {
      const notNowBtn2 = await page.$('button:has-text("Not Now")');
      if (notNowBtn2) await notNowBtn2.click();
    } catch (e) { /* skip */ }

    const currentUrl = page.url();
    const loginBerhasil = !currentUrl.includes('login');

    if (loginBerhasil) {
      console.log(`  ✅ [Instagram] Login berhasil: ${username}`);
      return { sukses: true, pesan: 'Login berhasil', page, browser };
    } else {
      console.log(`  ⚠️ [Instagram] Login memerlukan verifikasi: ${username}`);
      return { sukses: false, pesan: 'Perlu verifikasi', page, browser };
    }
  } catch (err) {
    console.error(`  ❌ [Instagram] Login gagal: ${err.message}`);
    return { sukses: false, pesan: err.message, page, browser };
  }
}

/**
 * Follow user target
 */
async function follow(page, targetUsername) {
  try {
    console.log(`  👥 [Instagram] Follow: @${targetUsername}`);

    const profileUrl = `${IG_URL}/${targetUsername.replace('@', '')}/`;
    await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Cari tombol Follow
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.trim() === 'Follow' || text.trim() === 'Ikuti')) {
        await btn.click();
        await delayAcak(1000, 2000);
        console.log(`  ✅ [Instagram] Berhasil follow @${targetUsername}`);
        return { sukses: true, pesan: `Berhasil follow @${targetUsername}` };
      }
    }

    return { sukses: false, pesan: 'Tombol follow tidak ditemukan atau sudah di-follow' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Like post
 */
async function like(page, postUrl) {
  try {
    console.log(`  ❤️ [Instagram] Like: ${postUrl}`);

    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Klik like (icon hati)
    const likeSelectors = [
      'svg[aria-label="Like"]',
      'svg[aria-label="Suka"]',
      '[aria-label="Like"]',
      '[aria-label="Suka"]',
    ];

    for (const sel of likeSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          await delayAcak(500, 1000);
          console.log(`  ✅ [Instagram] Berhasil like post`);
          return { sukses: true, pesan: 'Berhasil like post' };
        }
      } catch (e) { /* skip */ }
    }

    return { sukses: false, pesan: 'Tombol like tidak ditemukan' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Comment pada post
 */
async function comment(page, postUrl, teksKomentar) {
  try {
    console.log(`  💬 [Instagram] Comment: ${postUrl}`);

    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Klik area komentar
    const commentSelectors = [
      'textarea[aria-label="Add a comment…"]',
      'textarea[aria-label="Tambahkan komentar…"]',
      'textarea[placeholder*="comment"]',
    ];

    for (const sel of commentSelectors) {
      try {
        const input = await page.$(sel);
        if (input) {
          await input.click();
          await delayAcak(500, 1000);
          await page.keyboard.type(teksKomentar, { delay: 80 });
          await delayAcak(500, 1000);

          // Klik tombol Post
          const postBtn = await page.$('button:has-text("Post")');
          if (postBtn) {
            await postBtn.click();
            await delayAcak(1000, 2000);
          }

          console.log(`  ✅ [Instagram] Berhasil comment`);
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
 * View reels/post
 */
async function view(page, url, durasiDetik = 10) {
  try {
    console.log(`  👁️ [Instagram] View: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 3000);
    await delayAcak(durasiDetik * 1000, (durasiDetik + 3) * 1000);

    console.log(`  ✅ [Instagram] Berhasil view (${durasiDetik}s)`);
    return { sukses: true, pesan: `Ditonton selama ${durasiDetik} detik` };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Share post
 */
async function share(page, postUrl) {
  try {
    console.log(`  🔄 [Instagram] Share: ${postUrl}`);

    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    const shareSelectors = [
      'svg[aria-label="Share Post"]',
      'svg[aria-label="Bagikan Kiriman"]',
      '[aria-label="Share Post"]',
    ];

    for (const sel of shareSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          await delayAcak(1000, 2000);

          // Klik "Copy Link"
          const copyBtn = await page.$('button:has-text("Copy Link")');
          if (copyBtn) {
            await copyBtn.click();
            await delayAcak(500, 1000);
          }

          console.log(`  ✅ [Instagram] Berhasil share`);
          return { sukses: true, pesan: 'Berhasil share post' };
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
  follow,
  like,
  comment,
  view,
  share,
  PLATFORM: 'instagram',
  NAMA: 'Instagram',
  EMOJI: '📸',
};
