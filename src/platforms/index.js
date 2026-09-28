/**
 * Index Platform — akses semua modul platform dari satu tempat
 */

const tiktok = require('./tiktok');
const instagram = require('./instagram');
const facebook = require('./facebook');
const youtube = require('./youtube');

const platforms = {
  tiktok,
  instagram,
  facebook,
  youtube,
};

/**
 * Ambil modul platform berdasarkan nama
 */
function ambilPlatform(nama) {
  return platforms[nama] || null;
}

/**
 * Daftar semua platform yang tersedia
 */
function daftarPlatform() {
  return Object.values(platforms).map(p => ({
    platform: p.PLATFORM,
    nama: p.NAMA,
    emoji: p.EMOJI,
    fitur: ['login', 'follow', 'like', 'comment', 'view', 'share'],
  }));
}

module.exports = {
  platforms,
  ambilPlatform,
  daftarPlatform,
  tiktok,
  instagram,
  facebook,
  youtube,
};
