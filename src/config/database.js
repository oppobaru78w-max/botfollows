const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { enkripsiPassword, dekripsiPassword } = require('../utils/crypto');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'bot-engine.db');

// Pastikan folder data ada
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;

// Simpan database ke file
function simpanKeFile() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save setiap 30 detik
setInterval(simpanKeFile, 30000);

// Simpan saat proses keluar
process.on('exit', simpanKeFile);
process.on('SIGINT', () => { simpanKeFile(); process.exit(); });
process.on('SIGTERM', () => { simpanKeFile(); process.exit(); });

// Inisialisasi database
async function initDatabase() {
  const SQL = await initSqlJs();

  // Load database yang sudah ada atau buat baru
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('  📂 Database dimuat dari file');
  } else {
    db = new SQL.Database();
    console.log('  🆕 Database baru dibuat');
  }

  // Buat tabel
  db.run(`
    CREATE TABLE IF NOT EXISTS bot_accounts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL CHECK(platform IN ('tiktok', 'instagram', 'facebook', 'youtube')),
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      proxy TEXT DEFAULT '',
      status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif', 'banned', 'verifikasi')),
      catatan TEXT DEFAULT '',
      login_terakhir TEXT DEFAULT '',
      cookies TEXT DEFAULT '',
      session_status TEXT DEFAULT 'belum_login' CHECK(session_status IN ('belum_login', 'logged_in', 'expired', 'challenge')),
      session_checked_at TEXT DEFAULT '',
      password_enc TEXT DEFAULT '',
      dibuat_pada TEXT DEFAULT (datetime('now', 'localtime')),
      diupdate_pada TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pengaturan (
      kunci TEXT PRIMARY KEY,
      nilai TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS log_aktivitas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      akun_id TEXT,
      platform TEXT,
      aksi TEXT NOT NULL,
      detail TEXT DEFAULT '',
      status TEXT DEFAULT 'sukses',
      waktu TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bot_tasks (
      id TEXT PRIMARY KEY,
      akun_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      aksi TEXT NOT NULL CHECK(aksi IN ('follow', 'like', 'comment', 'view', 'share')),
      target TEXT NOT NULL,
      komentar TEXT DEFAULT '',
      durasi INTEGER DEFAULT 10,
      status TEXT DEFAULT 'antrian' CHECK(status IN ('antrian', 'berjalan', 'selesai', 'gagal', 'dibatalkan')),
      hasil TEXT DEFAULT '',
      urutan INTEGER DEFAULT 0,
      dibuat_pada TEXT DEFAULT (datetime('now', 'localtime')),
      selesai_pada TEXT DEFAULT ''
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      protokol TEXT DEFAULT 'http' CHECK(protokol IN ('http', 'https', 'socks5')),
      status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'mati', 'lambat')),
      kecepatan_ms INTEGER DEFAULT 0,
      lokasi TEXT DEFAULT '',
      ip_terdeteksi TEXT DEFAULT '',
      terakhir_dicek TEXT DEFAULT '',
      digunakan_oleh TEXT DEFAULT '',
      catatan TEXT DEFAULT '',
      dibuat_pada TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migrasi kolom baru untuk bot_accounts (Tahap 6: Auto-login & Cookies)
  try {
    const tableInfo = queryAll("PRAGMA table_info(bot_accounts)");
    const columnNames = tableInfo.map(c => c.name);

    if (!columnNames.includes('cookies')) {
      db.run("ALTER TABLE bot_accounts ADD COLUMN cookies TEXT DEFAULT ''");
    }
    if (!columnNames.includes('session_status')) {
      db.run("ALTER TABLE bot_accounts ADD COLUMN session_status TEXT DEFAULT 'belum_login'");
    }
    if (!columnNames.includes('session_checked_at')) {
      db.run("ALTER TABLE bot_accounts ADD COLUMN session_checked_at TEXT DEFAULT ''");
    }
    if (!columnNames.includes('password_enc')) {
      db.run("ALTER TABLE bot_accounts ADD COLUMN password_enc TEXT DEFAULT ''");
    }
  } catch (err) {
    console.warn('  ⚠️ Peringatan migrasi bot_accounts:', err.message);
  }

  simpanKeFile();
  console.log('  ✅ Tabel berhasil disiapkan');

  return db;
}

// Helper: jalankan query SELECT dan return array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: jalankan query SELECT dan return satu object
function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// ==================== FUNGSI AKUN ====================

function tambahAkun({ platform, username, password, email, phone, proxy, catatan, cookies }) {
  const id = uuidv4();
  const hashedPassword = bcrypt.hashSync(password, 10);
  const passwordEnc = enkripsiPassword(password);
  const cookiesStr = typeof cookies === 'object' ? JSON.stringify(cookies) : (cookies || '');
  const sessionStatus = cookiesStr ? 'logged_in' : 'belum_login';
  const checkedAt = cookiesStr ? new Date().toISOString() : '';

  db.run(
    `INSERT INTO bot_accounts (id, platform, username, password, email, phone, proxy, catatan, cookies, session_status, session_checked_at, password_enc)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, platform, username, hashedPassword, email || '', phone || '', proxy || '', catatan || '', cookiesStr, sessionStatus, checkedAt, passwordEnc]
  );

  logAktivitas(id, platform, 'tambah_akun', `Akun ${username} ditambahkan`);
  simpanKeFile();

  return { id, platform, username, email, phone, proxy, status: 'aktif', catatan, session_status: sessionStatus, session_checked_at: checkedAt };
}

function ambilSemuaAkun(filter = {}) {
  let query = 'SELECT id, platform, username, email, phone, proxy, status, catatan, login_terakhir, session_status, session_checked_at, (CASE WHEN cookies IS NOT NULL AND cookies != "" THEN 1 ELSE 0 END) as has_cookies, dibuat_pada, diupdate_pada FROM bot_accounts WHERE 1=1';
  const params = [];

  if (filter.platform) {
    query += ' AND platform = ?';
    params.push(filter.platform);
  }

  if (filter.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }

  if (filter.session_status) {
    query += ' AND session_status = ?';
    params.push(filter.session_status);
  }

  if (filter.cari) {
    query += ' AND (username LIKE ? OR email LIKE ?)';
    params.push(`%${filter.cari}%`, `%${filter.cari}%`);
  }

  query += ' ORDER BY dibuat_pada DESC';

  return queryAll(query, params);
}

function ambilAkunById(id) {
  return queryOne(
    'SELECT id, platform, username, email, phone, proxy, status, catatan, login_terakhir, session_status, session_checked_at, cookies, password_enc, dibuat_pada, diupdate_pada FROM bot_accounts WHERE id = ?',
    [id]
  );
}

function updateAkun(id, data) {
  const fields = [];
  const params = [];

  if (data.username) { fields.push('username = ?'); params.push(data.username); }
  if (data.password) {
    fields.push('password = ?');
    params.push(bcrypt.hashSync(data.password, 10));
    fields.push('password_enc = ?');
    params.push(enkripsiPassword(data.password));
  }
  if (data.email !== undefined) { fields.push('email = ?'); params.push(data.email); }
  if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
  if (data.proxy !== undefined) { fields.push('proxy = ?'); params.push(data.proxy); }
  if (data.status) { fields.push('status = ?'); params.push(data.status); }
  if (data.catatan !== undefined) { fields.push('catatan = ?'); params.push(data.catatan); }
  if (data.cookies !== undefined) {
    const cookiesStr = typeof data.cookies === 'object' ? JSON.stringify(data.cookies) : data.cookies;
    fields.push('cookies = ?');
    params.push(cookiesStr);
  }
  if (data.session_status) { fields.push('session_status = ?'); params.push(data.session_status); }
  if (data.session_checked_at) { fields.push('session_checked_at = ?'); params.push(data.session_checked_at); }
  if (data.login_terakhir) { fields.push('login_terakhir = ?'); params.push(data.login_terakhir); }

  if (fields.length === 0) return null;

  fields.push("diupdate_pada = datetime('now', 'localtime')");
  params.push(id);

  db.run(`UPDATE bot_accounts SET ${fields.join(', ')} WHERE id = ?`, params);

  logAktivitas(id, null, 'update_akun', `Akun diupdate: ${Object.keys(data).join(', ')}`);
  simpanKeFile();

  return ambilAkunById(id);
}

function hapusAkun(id) {
  const akun = ambilAkunById(id);
  if (!akun) return false;

  db.run('DELETE FROM bot_accounts WHERE id = ?', [id]);
  logAktivitas(null, akun.platform, 'hapus_akun', `Akun ${akun.username} dihapus`);
  simpanKeFile();

  return true;
}

function hapusBanyakAkun(ids) {
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM bot_accounts WHERE id IN (${placeholders})`, ids);
  simpanKeFile();
  return ids.length;
}

function updateStatusAkun(id, status) {
  return updateAkun(id, { status });
}

// ==================== STATISTIK ====================

function ambilStatistik() {
  const total = queryOne('SELECT COUNT(*) as jumlah FROM bot_accounts');
  const perPlatform = queryAll('SELECT platform, COUNT(*) as jumlah FROM bot_accounts GROUP BY platform');
  const perStatus = queryAll('SELECT status, COUNT(*) as jumlah FROM bot_accounts GROUP BY status');

  return {
    total: total ? total.jumlah : 0,
    per_platform: perPlatform,
    per_status: perStatus
  };
}

// ==================== LOG AKTIVITAS ====================

function logAktivitas(akunId, platform, aksi, detail, status = 'sukses') {
  db.run(
    `INSERT INTO log_aktivitas (akun_id, platform, aksi, detail, status) VALUES (?, ?, ?, ?, ?)`,
    [akunId, platform, aksi, detail, status]
  );
}

function ambilLogAktivitas(limit = 50) {
  return queryAll(`
    SELECT la.*, ba.username
    FROM log_aktivitas la
    LEFT JOIN bot_accounts ba ON la.akun_id = ba.id
    ORDER BY la.waktu DESC
    LIMIT ?
  `, [limit]);
}

// ==================== PENGATURAN ====================

function simpanPengaturan(kunci, nilai) {
  db.run(
    `INSERT OR REPLACE INTO pengaturan (kunci, nilai) VALUES (?, ?)`,
    [kunci, typeof nilai === 'object' ? JSON.stringify(nilai) : nilai]
  );
  simpanKeFile();
}

function ambilPengaturan(kunci, defaultValue = null) {
  const row = queryOne('SELECT nilai FROM pengaturan WHERE kunci = ?', [kunci]);
  return row ? row.nilai : defaultValue;
}

// ==================== IMPORT/EXPORT ====================

function importAkunBulk(akunList) {
  let sukses = 0;
  let gagal = 0;

  for (const akun of akunList) {
    try {
      const id = uuidv4();
      const hashedPassword = bcrypt.hashSync(akun.password, 10);
      const passwordEnc = enkripsiPassword(akun.password);
      db.run(
        `INSERT INTO bot_accounts (id, platform, username, password, email, phone, proxy, catatan, session_status, password_enc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'belum_login', ?)`,
        [id, akun.platform, akun.username, hashedPassword, akun.email || '', akun.phone || '', akun.proxy || '', akun.catatan || '', passwordEnc]
      );
      sukses++;
    } catch (err) {
      gagal++;
    }
  }

  logAktivitas(null, null, 'import_bulk', `Import ${sukses} akun sukses, ${gagal} gagal`);
  simpanKeFile();

  return { sukses, gagal };
}

// ==================== MANAJEMEN SESI & COOKIES ====================

function simpanCookiesAkun(id, cookies, sessionStatus = 'logged_in') {
  const cookiesStr = typeof cookies === 'object' ? JSON.stringify(cookies) : (cookies || '');
  db.run(
    `UPDATE bot_accounts 
     SET cookies = ?, 
         session_status = ?, 
         session_checked_at = datetime('now', 'localtime'),
         login_terakhir = datetime('now', 'localtime'),
         diupdate_pada = datetime('now', 'localtime')
     WHERE id = ?`,
    [cookiesStr, sessionStatus, id]
  );
  simpanKeFile();
  return true;
}

function ambilCookiesAkun(id) {
  const row = queryOne('SELECT cookies FROM bot_accounts WHERE id = ?', [id]);
  if (!row || !row.cookies) return [];
  try {
    return JSON.parse(row.cookies);
  } catch {
    return [];
  }
}

function ambilPasswordDekripsiAkun(id) {
  const row = queryOne('SELECT password_enc FROM bot_accounts WHERE id = ?', [id]);
  if (!row || !row.password_enc) return '';
  return dekripsiPassword(row.password_enc);
}

function updateStatusSesiAkun(id, sessionStatus, detail = '') {
  db.run(
    `UPDATE bot_accounts 
     SET session_status = ?, 
         session_checked_at = datetime('now', 'localtime'),
         diupdate_pada = datetime('now', 'localtime')
     WHERE id = ?`,
    [sessionStatus, id]
  );
  if (detail) {
    const akun = ambilAkunById(id);
    logAktivitas(id, akun ? akun.platform : null, 'status_sesi', detail);
  }
  simpanKeFile();
}

function hapusCookiesAkun(id) {
  db.run(
    `UPDATE bot_accounts 
     SET cookies = '', 
         session_status = 'belum_login', 
         session_checked_at = datetime('now', 'localtime'),
         diupdate_pada = datetime('now', 'localtime')
     WHERE id = ?`,
    [id]
  );
  simpanKeFile();
}

function hitungStatistikSesi() {
  const total = queryOne('SELECT COUNT(*) as jumlah FROM bot_accounts');
  const loggedIn = queryOne("SELECT COUNT(*) as jumlah FROM bot_accounts WHERE session_status = 'logged_in'");
  const belumLogin = queryOne("SELECT COUNT(*) as jumlah FROM bot_accounts WHERE session_status = 'belum_login'");
  const expired = queryOne("SELECT COUNT(*) as jumlah FROM bot_accounts WHERE session_status = 'expired'");
  const challenge = queryOne("SELECT COUNT(*) as jumlah FROM bot_accounts WHERE session_status = 'challenge'");

  return {
    total: total ? total.jumlah : 0,
    logged_in: loggedIn ? loggedIn.jumlah : 0,
    belum_login: belumLogin ? belumLogin.jumlah : 0,
    expired: expired ? expired.jumlah : 0,
    challenge: challenge ? challenge.jumlah : 0,
  };
}

function exportAkun(filter = {}) {
  return ambilSemuaAkun(filter);
}

// ==================== TASK QUEUE ====================

function tambahTask({ akun_id, platform, aksi, target, komentar, durasi }) {
  const id = uuidv4();
  db.run(
    `INSERT INTO bot_tasks (id, akun_id, platform, aksi, target, komentar, durasi)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, akun_id, platform, aksi, target, komentar || '', durasi || 10]
  );
  simpanKeFile();
  return { id, akun_id, platform, aksi, target, komentar, durasi, status: 'antrian' };
}

function tambahBanyakTask(tasks) {
  let sukses = 0;
  for (const t of tasks) {
    try {
      tambahTask(t);
      sukses++;
    } catch (e) { /* skip */ }
  }
  return sukses;
}

function ambilSemuaTask(filter = {}) {
  let query = `SELECT bt.*, ba.username
    FROM bot_tasks bt
    LEFT JOIN bot_accounts ba ON bt.akun_id = ba.id
    WHERE 1=1`;
  const params = [];

  if (filter.status) {
    query += ' AND bt.status = ?';
    params.push(filter.status);
  }
  if (filter.platform) {
    query += ' AND bt.platform = ?';
    params.push(filter.platform);
  }
  if (filter.akun_id) {
    query += ' AND bt.akun_id = ?';
    params.push(filter.akun_id);
  }

  query += ' ORDER BY bt.dibuat_pada DESC';

  if (filter.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
  }

  return queryAll(query, params);
}

function ambilTaskAntrian(limit = 1) {
  return queryAll(
    `SELECT bt.*, ba.username
     FROM bot_tasks bt
     LEFT JOIN bot_accounts ba ON bt.akun_id = ba.id
     WHERE bt.status = 'antrian'
     ORDER BY bt.urutan ASC, bt.dibuat_pada ASC
     LIMIT ?`,
    [limit]
  );
}

function updateStatusTask(id, status, hasil = '') {
  const selesaiPada = (status === 'selesai' || status === 'gagal')
    ? "datetime('now', 'localtime')" : "''";

  db.run(
    `UPDATE bot_tasks SET status = ?, hasil = ?, selesai_pada = ${selesaiPada} WHERE id = ?`,
    [status, hasil, id]
  );
  simpanKeFile();
}

function hapusTask(id) {
  db.run('DELETE FROM bot_tasks WHERE id = ?', [id]);
  simpanKeFile();
  return true;
}

function hapusBanyakTask(ids) {
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM bot_tasks WHERE id IN (${placeholders})`, ids);
  simpanKeFile();
  return ids.length;
}

function bersihkanTaskSelesai() {
  db.run(`DELETE FROM bot_tasks WHERE status IN ('selesai', 'gagal', 'dibatalkan')`);
  simpanKeFile();
}

function batalkanSemuaTask() {
  db.run(`UPDATE bot_tasks SET status = 'dibatalkan' WHERE status IN ('antrian', 'berjalan')`);
  simpanKeFile();
}

function hitungTask() {
  const antrian = queryOne("SELECT COUNT(*) as jumlah FROM bot_tasks WHERE status = 'antrian'");
  const berjalan = queryOne("SELECT COUNT(*) as jumlah FROM bot_tasks WHERE status = 'berjalan'");
  const selesai = queryOne("SELECT COUNT(*) as jumlah FROM bot_tasks WHERE status = 'selesai'");
  const gagal = queryOne("SELECT COUNT(*) as jumlah FROM bot_tasks WHERE status = 'gagal'");
  const total = queryOne("SELECT COUNT(*) as jumlah FROM bot_tasks");

  return {
    antrian: antrian ? antrian.jumlah : 0,
    berjalan: berjalan ? berjalan.jumlah : 0,
    selesai: selesai ? selesai.jumlah : 0,
    gagal: gagal ? gagal.jumlah : 0,
    total: total ? total.jumlah : 0,
  };
}

// ==================== PROXY POOL ====================

function parseProxyString(proxyStr) {
  if (!proxyStr) return null;
  let str = proxyStr.trim();
  let protokol = 'http';

  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('socks5://')) {
    const parts = str.split('://');
    protokol = parts[0];
    str = parts[1];
  }

  let host = '', port = 8080, username = '', password = '';

  if (str.includes('@')) {
    const [auth, server] = str.split('@');
    const [u, p] = auth.split(':');
    username = u || '';
    password = p || '';
    const [h, pt] = server.split(':');
    host = h;
    port = parseInt(pt, 10) || 8080;
  } else {
    const parts = str.split(':');
    if (parts.length >= 4) {
      host = parts[0];
      port = parseInt(parts[1], 10) || 8080;
      username = parts[2];
      password = parts[3];
    } else if (parts.length >= 2) {
      host = parts[0];
      port = parseInt(parts[1], 10) || 8080;
    } else {
      host = parts[0];
    }
  }

  return { host, port, username, password, protokol };
}

function tambahProxy(data) {
  const id = uuidv4();
  let { host, port, username, password, protokol, status, catatan } = data;

  if (host && host.includes(':') && !data.port) {
    const parsed = parseProxyString(host);
    if (parsed) {
      host = parsed.host;
      port = parsed.port;
      username = parsed.username || username || '';
      password = parsed.password || password || '';
      protokol = parsed.protokol || protokol || 'http';
    }
  }

  db.run(
    `INSERT INTO proxies (id, host, port, username, password, protokol, status, catatan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, host, parseInt(port, 10) || 8080, username || '', password || '', protokol || 'http', status || 'aktif', catatan || '']
  );
  simpanKeFile();
  return { id, host, port, username, password, protokol: protokol || 'http', status: status || 'aktif', catatan: catatan || '' };
}

function tambahBanyakProxy(proxyList) {
  let sukses = 0;
  for (const item of proxyList) {
    try {
      if (typeof item === 'string') {
        const parsed = parseProxyString(item);
        if (parsed && parsed.host) {
          tambahProxy(parsed);
          sukses++;
        }
      } else if (item && item.host) {
        tambahProxy(item);
        sukses++;
      }
    } catch (e) {
      // skip
    }
  }
  return sukses;
}

function ambilSemuaProxy(filter = {}) {
  let query = 'SELECT * FROM proxies WHERE 1=1';
  const params = [];

  if (filter.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }
  if (filter.protokol) {
    query += ' AND protokol = ?';
    params.push(filter.protokol);
  }
  if (filter.cari) {
    query += ' AND (host LIKE ? OR catatan LIKE ? OR lokasi LIKE ?)';
    const c = `%${filter.cari}%`;
    params.push(c, c, c);
  }

  query += ' ORDER BY dibuat_pada DESC';

  if (filter.limit) {
    query += ' LIMIT ?';
    params.push(filter.limit);
  }

  return queryAll(query, params);
}

function ambilProxyById(id) {
  return queryOne('SELECT * FROM proxies WHERE id = ?', [id]);
}

function updateProxy(id, data) {
  const allowed = ['host', 'port', 'username', 'password', 'protokol', 'status', 'kecepatan_ms', 'lokasi', 'ip_terdeteksi', 'terakhir_dicek', 'catatan', 'digunakan_oleh'];
  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(data[key]);
    }
  }

  if (sets.length === 0) return false;

  params.push(id);
  db.run(`UPDATE proxies SET ${sets.join(', ')} WHERE id = ?`, params);
  simpanKeFile();
  return true;
}

function hapusProxy(id) {
  db.run('DELETE FROM proxies WHERE id = ?', [id]);
  simpanKeFile();
  return true;
}

function hapusBanyakProxy(ids) {
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM proxies WHERE id IN (${placeholders})`, ids);
  simpanKeFile();
  return ids.length;
}

function hapusProxyMati() {
  db.run("DELETE FROM proxies WHERE status = 'mati'");
  simpanKeFile();
}

let lastRotatedIndex = 0;
function ambilProxyRotasi() {
  const list = queryAll("SELECT * FROM proxies WHERE status IN ('aktif', 'lambat') ORDER BY kecepatan_ms ASC, dibuat_pada ASC");
  if (!list || list.length === 0) return null;
  lastRotatedIndex = (lastRotatedIndex + 1) % list.length;
  return list[lastRotatedIndex];
}

function hitungStatistikProxy() {
  const total = queryOne('SELECT COUNT(*) as jumlah FROM proxies');
  const aktif = queryOne("SELECT COUNT(*) as jumlah FROM proxies WHERE status = 'aktif'");
  const mati = queryOne("SELECT COUNT(*) as jumlah FROM proxies WHERE status = 'mati'");
  const lambat = queryOne("SELECT COUNT(*) as jumlah FROM proxies WHERE status = 'lambat'");
  const avg = queryOne("SELECT AVG(kecepatan_ms) as rata FROM proxies WHERE kecepatan_ms > 0 AND status != 'mati'");

  return {
    total: total ? total.jumlah : 0,
    aktif: aktif ? aktif.jumlah : 0,
    mati: mati ? mati.jumlah : 0,
    lambat: lambat ? lambat.jumlah : 0,
    rata_kecepatan: avg && avg.rata ? Math.round(avg.rata) : 0,
  };
}

function ambilAnalitikDashboard() {
  const statAkun = queryOne("SELECT COUNT(*) as total, SUM(CASE WHEN status='aktif' THEN 1 ELSE 0 END) as aktif, SUM(CASE WHEN status='banned' THEN 1 ELSE 0 END) as banned FROM bot_accounts");
  const statTask = queryOne("SELECT COUNT(*) as total, SUM(CASE WHEN status='selesai' THEN 1 ELSE 0 END) as selesai, SUM(CASE WHEN status='gagal' THEN 1 ELSE 0 END) as gagal, SUM(CASE WHEN status='antrian' THEN 1 ELSE 0 END) as antrian, SUM(CASE WHEN status='berjalan' THEN 1 ELSE 0 END) as berjalan FROM bot_tasks");
  const statProxy = queryOne("SELECT COUNT(*) as total, SUM(CASE WHEN status='aktif' THEN 1 ELSE 0 END) as aktif, AVG(CASE WHEN kecepatan_ms > 0 AND status != 'mati' THEN kecepatan_ms ELSE NULL END) as avg_speed FROM proxies");

  const totalSelesai = statTask ? (statTask.selesai || 0) : 0;
  const totalGagal = statTask ? (statTask.gagal || 0) : 0;
  const executed = totalSelesai + totalGagal;
  const successRate = executed > 0 ? Math.round((totalSelesai / executed) * 100) : 100;

  // Distribusi aksi
  const aksiList = ['follow', 'like', 'comment', 'view', 'share'];
  const aksiDist = queryAll("SELECT aksi, COUNT(*) as jumlah FROM bot_tasks GROUP BY aksi");
  const distribusiAksi = aksiList.map(a => {
    const found = aksiDist.find(d => d.aksi === a);
    return { aksi: a, jumlah: found ? found.jumlah : 0 };
  });

  // Distribusi platform
  const platforms = ['tiktok', 'instagram', 'facebook', 'youtube'];
  const akunPerPlatform = queryAll("SELECT platform, COUNT(*) as akun FROM bot_accounts GROUP BY platform");
  const taskPerPlatform = queryAll("SELECT platform, COUNT(*) as tasks, SUM(CASE WHEN status='selesai' THEN 1 ELSE 0 END) as sukses FROM bot_tasks GROUP BY platform");

  const distribusiPlatform = platforms.map(p => {
    const acc = akunPerPlatform.find(x => x.platform === p);
    const tsk = taskPerPlatform.find(x => x.platform === p);
    return {
      platform: p,
      akun: acc ? acc.akun : 0,
      tasks: tsk ? tsk.tasks : 0,
      sukses: tsk ? (tsk.sukses || 0) : 0,
    };
  });

  // Riwayat 7 aktivitas terakhir
  const logTerbaru = queryAll(`
    SELECT la.*, ba.username
    FROM log_aktivitas la
    LEFT JOIN bot_accounts ba ON la.akun_id = ba.id
    ORDER BY la.waktu DESC
    LIMIT 7
  `);

  return {
    ringkasan: {
      total_akun: statAkun ? statAkun.total : 0,
      akun_aktif: statAkun ? (statAkun.aktif || 0) : 0,
      akun_banned: statAkun ? (statAkun.banned || 0) : 0,
      total_task: statTask ? statTask.total : 0,
      task_selesai: totalSelesai,
      task_gagal: totalGagal,
      task_antrian: statTask ? (statTask.antrian || 0) : 0,
      task_berjalan: statTask ? (statTask.berjalan || 0) : 0,
      success_rate: successRate,
      total_proxy: statProxy ? statProxy.total : 0,
      proxy_aktif: statProxy ? (statProxy.aktif || 0) : 0,
      proxy_speed: statProxy && statProxy.avg_speed ? Math.round(statProxy.avg_speed) : 0,
    },
    distribusi_aksi: distribusiAksi,
    distribusi_platform: distribusiPlatform,
    log_terbaru: logTerbaru,
  };
}

module.exports = {
  initDatabase,
  tambahAkun,
  ambilSemuaAkun,
  ambilAkunById,
  updateAkun,
  hapusAkun,
  hapusBanyakAkun,
  updateStatusAkun,
  ambilStatistik,
  logAktivitas,
  ambilLogAktivitas,
  simpanPengaturan,
  ambilPengaturan,
  importAkunBulk,
  exportAkun,
  // Task queue
  tambahTask,
  tambahBanyakTask,
  ambilSemuaTask,
  ambilTaskAntrian,
  updateStatusTask,
  hapusTask,
  hapusBanyakTask,
  bersihkanTaskSelesai,
  batalkanSemuaTask,
  hitungTask,
  // Proxy pool
  parseProxyString,
  tambahProxy,
  tambahBanyakProxy,
  ambilSemuaProxy,
  ambilProxyById,
  updateProxy,
  hapusProxy,
  hapusBanyakProxy,
  hapusProxyMati,
  ambilProxyRotasi,
  hitungStatistikProxy,
  // Analytics
  ambilAnalitikDashboard,
  // Sesi & Cookies
  simpanCookiesAkun,
  ambilCookiesAkun,
  ambilPasswordDekripsiAkun,
  updateStatusSesiAkun,
  hapusCookiesAkun,
  hitungStatistikSesi,
};


