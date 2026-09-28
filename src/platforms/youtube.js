/**
 * Modul Platform YouTube
 * Login, subscribe, like, view, comment, share
 */

const { bukaBrowser, buatHalaman, delayAcak, ketikManusia } = require('../browser/manager');

const YT_URL = 'https://www.youtube.com';
const YT_LOGIN_URL = 'https://accounts.google.com/signin';

/**
 * Login ke YouTube (via Google)
 */
async function login(akunId, username, password, options = {}) {
  const browser = await bukaBrowser(akunId, options);
  const page = await buatHalaman(browser);

  try {
    console.log(`  ▶️ [YouTube] Memulai login untuk: ${username}`);

    await page.goto(`${YT_URL}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 3000);

    // Klik Sign In
    const signInBtn = await page.$('a[href*="accounts.google.com"]');
    if (signInBtn) {
      await signInBtn.click();
      await delayAcak(3000, 5000);
    } else {
      await page.goto('https://accounts.google.com/ServiceLogin?service=youtube', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await delayAcak(2000, 3000);
    }

    // Isi email
    const emailField = await page.$('input[type="email"]');
    if (emailField) {
      await emailField.click();
      await page.keyboard.type(username, { delay: 80 });
      await delayAcak(500, 1000);

      // Klik Next
      const nextBtns = await page.$$('button');
      for (const btn of nextBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && (text.includes('Next') || text.includes('Berikutnya'))) {
          await btn.click();
          break;
        }
      }

      await delayAcak(3000, 5000);
    }

    // Isi password
    const passField = await page.$('input[type="password"]');
    if (passField) {
      await passField.click();
      await page.keyboard.type(password, { delay: 80 });
      await delayAcak(500, 1000);

      // Klik Next
      const nextBtns = await page.$$('button');
      for (const btn of nextBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && (text.includes('Next') || text.includes('Berikutnya'))) {
          await btn.click();
          break;
        }
      }

      await delayAcak(4000, 6000);
    }

    const currentUrl = page.url();
    const loginBerhasil = currentUrl.includes('youtube.com') || currentUrl.includes('myaccount.google.com');

    if (loginBerhasil) {
      console.log(`  ✅ [YouTube] Login berhasil: ${username}`);
      return { sukses: true, pesan: 'Login berhasil', page, browser };
    } else {
      console.log(`  ⚠️ [YouTube] Login memerlukan verifikasi: ${username}`);
      return { sukses: false, pesan: 'Perlu verifikasi 2FA/captcha', page, browser };
    }
  } catch (err) {
    console.error(`  ❌ [YouTube] Login gagal: ${err.message}`);
    return { sukses: false, pesan: err.message, page, browser };
  }
}

/**
 * Subscribe channel
 */
async function follow(page, channelUrl) {
  try {
    console.log(`  👥 [YouTube] Subscribe: ${channelUrl}`);

    await page.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 4000);

    // Cari tombol Subscribe
    const subSelectors = [
      '#subscribe-button button',
      'ytd-subscribe-button-renderer button',
      'button[aria-label*="Subscribe"]',
      'button[aria-label*="Langganan"]',
    ];

    for (const sel of subSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          const text = await page.evaluate(el => el.textContent, btn);
          if (text && (text.includes('Subscribe') || text.includes('Langganan')) && !text.includes('Subscribed')) {
            await btn.click();
            await delayAcak(1000, 2000);
            console.log(`  ✅ [YouTube] Berhasil subscribe`);
            return { sukses: true, pesan: 'Berhasil subscribe' };
          }
        }
      } catch (e) { /* skip */ }
    }

    return { sukses: false, pesan: 'Tombol subscribe tidak ditemukan atau sudah subscribe' };
  } catch (err) {
    return { sukses: false, pesan: err.message };
  }
}

/**
 * Like video
 */
async function like(page, videoUrl) {
  try {
    console.log(`  ❤️ [YouTube] Like: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(3000, 5000);

    // Tonton dulu beberapa detik
    await delayAcak(3000, 5000);

    // Klik like
    const likeSelectors = [
      'like-button-view-model button',
      '#top-level-buttons-computed ytd-toggle-button-renderer:first-child button',
      'button[aria-label*="like this video"]',
      'button[aria-label*="suka"]',
    ];

    for (const sel of likeSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          const pressed = await page.evaluate(el => el.getAttribute('aria-pressed'), btn);
          if (pressed !== 'true') {
            await btn.click();
            await delayAcak(500, 1000);
            console.log(`  ✅ [YouTube] Berhasil like`);
            return { sukses: true, pesan: 'Berhasil like video' };
          }
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
async function comment(page, videoUrl, teksKomentar) {
  try {
    console.log(`  💬 [YouTube] Comment: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(3000, 5000);

    // Scroll ke area komentar
    await page.evaluate(() => window.scrollBy(0, 400));
    await delayAcak(2000, 3000);

    // Klik placeholder komentar
    const placeholders = await page.$$('#placeholder-area, #simplebox-placeholder');
    for (const ph of placeholders) {
      try {
        await ph.click();
        await delayAcak(1000, 2000);
        break;
      } catch (e) { /* skip */ }
    }

    // Ketik komentar
    const inputSelectors = [
      '#contenteditable-root',
      'div[contenteditable="true"]',
    ];

    for (const sel of inputSelectors) {
      try {
        const input = await page.$(sel);
        if (input) {
          await input.click();
          await page.keyboard.type(teksKomentar, { delay: 80 });
          await delayAcak(1000, 2000);

          // Klik submit
          const submitBtns = await page.$$('#submit-button button, #submit-button');
          for (const btn of submitBtns) {
            try {
              await btn.click();
              await delayAcak(1000, 2000);
              break;
            } catch (e) { /* skip */ }
          }

          console.log(`  ✅ [YouTube] Berhasil comment`);
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
async function view(page, videoUrl, durasiDetik = 30) {
  try {
    console.log(`  👁️ [YouTube] View: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(2000, 3000);

    // Pastikan video diputar
    try {
      const playBtn = await page.$('.ytp-play-button');
      if (playBtn) {
        const paused = await page.evaluate(el => el.getAttribute('aria-label'), playBtn);
        if (paused && (paused.includes('Play') || paused.includes('Putar'))) {
          await playBtn.click();
        }
      }
    } catch (e) { /* skip */ }

    // Tonton selama durasi
    await delayAcak(durasiDetik * 1000, (durasiDetik + 5) * 1000);

    console.log(`  ✅ [YouTube] Berhasil view (${durasiDetik}s)`);
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
    console.log(`  🔄 [YouTube] Share: ${videoUrl}`);

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delayAcak(3000, 5000);

    // Klik Share
    const shareBtn = await page.$('button[aria-label*="Share"]');
    if (shareBtn) {
      await shareBtn.click();
      await delayAcak(1000, 2000);

      // Klik Copy
      const copyBtn = await page.$('button[aria-label*="Copy"]');
      if (copyBtn) {
        await copyBtn.click();
        await delayAcak(500, 1000);
      }

      console.log(`  ✅ [YouTube] Berhasil share`);
      return { sukses: true, pesan: 'Berhasil share' };
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
  PLATFORM: 'youtube',
  NAMA: 'YouTube',
  EMOJI: '▶️',
};
