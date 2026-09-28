const crypto = require('crypto');

// Kunci enkripsi default aplikasi (dapat di-override via env APP_SECRET)
const SECRET_KEY = process.env.APP_SECRET || 'smm-bot-engine-super-secret-key-32b!';
// Pastikan panjang key tepat 32 bytes untuk aes-256-cbc
const CIPHER_KEY = crypto.createHash('sha256').update(SECRET_KEY).digest();
const ALGORITHM = 'aes-256-cbc';

/**
 * Enkripsi teks password agar dapat didekripsi kembali oleh bot engine
 * @param {string} text - Password plaintext
 * @returns {string} - Hasil enkripsi berformat iv:ciphertext (hex)
 */
function enkripsiPassword(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, CIPHER_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Dekripsi ciphertext kembali ke password asli
 * @param {string} encryptedText - Format iv:ciphertext
 * @returns {string} - Plaintext password
 */
function dekripsiPassword(encryptedText) {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return '';
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, CIPHER_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Gagal dekripsi password:', err.message);
    return '';
  }
}

module.exports = {
  enkripsiPassword,
  dekripsiPassword
};
