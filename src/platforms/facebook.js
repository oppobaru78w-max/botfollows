/**
 * Modul Platform Facebook
 * Login, follow/add friend, like, view, comment, share
 */

const { bukaBrowser, buatHalaman, delayAcak, ketikManusia } = require('../browser/manager');

const FB_URL = 'https://www.facebook.com';
const FB_LOGIN_URL = 'https://www.facebook.com/login';

/**
 * Login ke Facebook
 */
async function login(akunId, username, password, options = {}) {
  const browser = await bukaBrowser(akunId, options);
  const page = await buatHalaman(browser);

  try {
    console.log(`  👤 [Facebook] Memulai login untuk: ${username}`);

    await page.goto(FB_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Isi email
    const emailField = await page.$('#email');
    if (emailField) {
      await emailField.click({ clickCount: 3 });
      await page.keyboard.type(username, { delay: 80 });
      await delayAcak(500, 1000);
    }

    // Isi password
    const passField = await page.$('#pass');
    if (passField) {
      await passField.click();
      await page.keyboard.type(password, { delay: 80 });
      await delayAcak(500, 1000);
    }

    // Klik login
    const loginBtn = await page.$('button[name="login"]');
    if (loginBtn) {
      await loginBtn.click();
    }

    await delayAcak(4000, 6000);

    const currentUrl = page.url();
    const loginBerhasil = !currentUrl.includes('login') && !currentUrl.includes('checkpoint');

    if (loginBerhasil) {
      console.log(`  ✅ [Facebook] Login berhasil: ${username}`);
      return { sukses: true, pesan: 'Login berhasil', page, browser };
    } else {
      console.log(`  ⚠️ [Facebook] Login memerlukan verifikasi: ${username}`);
      return { sukses: false, pesan: 'Perlu verifikasi/checkpoint', page, browser };
    }
  } catch (err) {
    console.error(`  ❌ [Facebook] Login gagal: ${err.message}`);
    return { sukses: false, pesan: err.message, page, browser };
  }
}

/**
 * Follow / Add Friend
 */
async function follow(page, targetUrl) {
  try {
    console.log(`  👥 [Facebook] Follow: ${targetUrl}`);

    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Cari tombol Follow atau Add Friend
    const buttons = await page.$$('[role="button"]');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Follow') || text.includes('Ikuti') || text.includes('Add Friend') || text.includes('Tambah Teman'))) {
        await btn.click();
        await delayAcak(1000, 2000);
        console.log(`  ✅ [Facebook] Berhasil follow/add friend`);
        return { sukses: true, pesan: 'Berhasil follow/add friend' };
      }
    }

    return { sukses: false, pesan: 'Tombol follow/add friend tidak ditemukan' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Like post/page
 */
async function like(page, postUrl) {
  try {
    console.log(`  ❤️ [Facebook] Like: ${postUrl}`);

    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Cari tombol Like
    const likeSelectors = [
      '[aria-label="Like"]',
      '[aria-label="Suka"]',
      'div[aria-label="Like"]',
    ];

    for (const sel of likeSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          await delayAcak(500, 1000);
          console.log(`  ✅ [Facebook] Berhasil like`);
          return { sukses: true, pesan: 'Berhasil like' };
        }
      } catch (e) { /* skip */ }
    }

    return { sukses: false, pesan: 'Tombol like tidak ditemukan' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Comment
 */
async function comment(page, postUrl, teksKomentar) {
  try {
    console.log(`  💬 [Facebook] Comment: ${postUrl}`);

    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Klik "Write a comment"
    const commentSelectors = [
      '[aria-label="Write a comment"]',
      '[aria-label="Tulis komentar"]',
      '[placeholder*="comment"]',
      'div[contenteditable="true"]',
    ];

    for (const sel of commentSelectors) {
      try {
        const input = await page.$(sel);
        if (input) {
          await input.click();
          await delayAcak(500, 1000);
          await page.keyboard.type(teksKomentar, { delay: 80 });
          await delayAcak(500, 1000);
          await page.keyboard.press('Enter');
          await delayAcak(1000, 2000);
          console.log(`  ✅ [Facebook] Berhasil comment`);
          return { sukses: true, pesan: 'Berhasil comment' };
        }
      } catch (e) { /* skip */ }
    }

    return { sukses: false, pesan: 'Input komentar tidak ditemukan' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * View video
 */
async function view(page, videoUrl, durasiDetik = 10) {
  try {
    console.log(`  👁️ [Facebook] View: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 3000);
    await delayAcak(durasiDetik * 1000, (durasiDetik + 3) * 1000);

    console.log(`  ✅ [Facebook] Berhasil view (${durasiDetik}s)`);
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
    console.log(`  🔄 [Facebook] Share: ${postUrl}`);

    await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    const shareSelectors = [
      '[aria-label="Share"]',
      '[aria-label="Bagikan"]',
    ];

    for (const sel of shareSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          await delayAcak(1000, 2000);

          // Klik "Share Now"
          const shareNow = await page.$('[aria-label="Share now"]');
          if (shareNow) {
            await shareNow.click();
            await delayAcak(1000, 2000);
          }

          console.log(`  ✅ [Facebook] Berhasil share`);
          return { sukses: true, pesan: 'Berhasil share' };
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
  PLATFORM: 'facebook',
  NAMA: 'Facebook',
  EMOJI: '👤',
};
