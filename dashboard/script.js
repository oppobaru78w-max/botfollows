// ==================== CONFIG ====================
const API_URL = '/api/akun';

// State
let dataAkun = [];
let akunTerpilih = new Set();
let platformDipilih = '';
let hapusTarget = null;
let modeEdit = false;

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', () => {
  muatAnalitik();
  muatData();
  muatLog();
  muatStatistikTask();
  muatStatistikProxy();
  cekStatusRunner();

  // Polling update live untuk monitoring & engine
  setInterval(() => {
    const monTab = document.getElementById('tab-monitoring');
    if (monTab && monTab.classList.contains('active')) {
      muatAnalitik(true);
    }
    const engineTab = document.getElementById('tab-engine');
    if (engineTab && engineTab.classList.contains('active')) {
      muatTasks(true);
      cekStatusRunner();
    }
  }, 3500);
});

// ==================== LOAD DATA ====================
async function muatData() {
  try {
    const platform = document.getElementById('filter-platform').value;
    const status = document.getElementById('filter-status').value;
    const sessionStatus = document.getElementById('filter-session')?.value;
    const cari = document.getElementById('input-cari').value;

    let url = `${API_URL}?`;
    if (platform) url += `platform=${platform}&`;
    if (status) url += `status=${status}&`;
    if (sessionStatus) url += `session_status=${sessionStatus}&`;
    if (cari) url += `cari=${encodeURIComponent(cari)}&`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.sukses) {
      dataAkun = json.data;
      renderTabel();
      muatStatistik();
      updateTaskAkunOptions();
    }
  } catch (err) {
    tampilToast('Gagal memuat data: ' + err.message, 'error');
  }
}

async function muatStatistik() {
  try {
    const res = await fetch(`${API_URL}/statistik`);
    const json = await res.json();

    if (json.sukses) {
      const { total, per_platform, per_status } = json.data;

      document.getElementById('stat-total').textContent = total;

      // Reset
      document.getElementById('stat-aktif').textContent = '0';
      document.getElementById('stat-nonaktif').textContent = '0';
      document.getElementById('stat-banned').textContent = '0';

      // Sidebar counts
      const navCountAkun = document.getElementById('nav-count-akun');
      if (navCountAkun) navCountAkun.textContent = total;

      const platformCounts = { tiktok: 0, instagram: 0, facebook: 0, youtube: 0 };
      per_platform.forEach(p => {
        platformCounts[p.platform] = p.jumlah;
        const navEl = document.getElementById(`nav-count-${p.platform}`);
        if (navEl) navEl.textContent = p.jumlah;
      });

      // Reset platform counts that have 0
      Object.keys(platformCounts).forEach(k => {
        if (platformCounts[k] === 0) {
          const navEl = document.getElementById(`nav-count-${k}`);
          if (navEl) navEl.textContent = '0';
        }
      });

      let nonaktifCount = 0;
      let bannedCount = 0;

      per_status.forEach(s => {
        if (s.status === 'aktif') {
          document.getElementById('stat-aktif').textContent = s.jumlah;
        } else if (s.status === 'nonaktif') {
          nonaktifCount = s.jumlah;
        } else if (s.status === 'banned') {
          bannedCount = s.jumlah;
        }
      });

      document.getElementById('stat-nonaktif').textContent = nonaktifCount;
      document.getElementById('stat-banned').textContent = bannedCount;

      // Table count
      const tableCount = document.getElementById('table-count');
      if (tableCount) tableCount.textContent = `(${dataAkun.length})`;
    }
  } catch (err) {
    console.error('Gagal memuat statistik:', err);
  }
}

async function muatLog() {
  try {
    const res = await fetch(`${API_URL}/log?limit=50`);
    const json = await res.json();

    if (json.sukses) {
      renderLog(json.data);
    }
  } catch (err) {
    console.error('Gagal memuat log:', err);
  }
}

// ==================== RENDER TABEL ====================
function renderTabel() {
  const tbody = document.getElementById('tabel-akun');
  const emptyState = document.getElementById('empty-state');

  if (dataAkun.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  const platformLabels = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube'
  };

  const statusLabels = {
    aktif: 'Aktif',
    nonaktif: 'Nonaktif',
    banned: 'Banned',
    verifikasi: 'Verifikasi'
  };

  tbody.innerHTML = dataAkun.map(akun => {
    let sessionBadge = '';
    const st = akun.session_status || 'belum_login';
    if (st === 'logged_in') {
      sessionBadge = `<span class="badge badge-aktif" title="Cookies aktif & tersimpan"><span class="badge-dot"></span>Sesi Aktif</span>`;
    } else if (st === 'challenge') {
      sessionBadge = `<span class="badge badge-warning" title="Perlu verifikasi captcha/2FA"><span class="badge-dot"></span>Challenge / 2FA</span>`;
    } else if (st === 'expired') {
      sessionBadge = `<span class="badge badge-banned" title="Sesi telah kedaluwarsa"><span class="badge-dot"></span>Sesi Expired</span>`;
    } else {
      sessionBadge = `<span class="badge badge-neutral" title="Belum pernah login"><span class="badge-dot"></span>Belum Login</span>`;
    }

    return `
    <tr data-id="${akun.id}">
      <td>
        <input type="checkbox" class="checkbox-field checkbox-akun"
          value="${akun.id}"
          ${akunTerpilih.has(akun.id) ? 'checked' : ''}
          onchange="togglePilih('${akun.id}')">
      </td>
      <td>
        <span class="badge badge-platform badge-${akun.platform}">
          ${platformLabels[akun.platform] || akun.platform}
        </span>
      </td>
      <td>
        <strong style="display:block;">${escapeHtml(akun.username)}</strong>
        ${akun.email ? `<span style="font-size:11px; color:var(--text-muted);">${escapeHtml(akun.email)}</span>` : ''}
      </td>
      <td class="text-muted" style="font-size:12px; font-family:monospace;">${escapeHtml(akun.proxy) || '<span style="color:var(--text-muted);">Direct</span>'}</td>
      <td>
        <span class="badge badge-${akun.status}">
          <span class="badge-dot"></span>
          ${statusLabels[akun.status] || akun.status}
        </span>
      </td>
      <td>${sessionBadge}</td>
      <td class="text-muted" style="white-space:nowrap; font-size:12px;">
        ${formatTanggal(akun.login_terakhir || akun.session_checked_at)}
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-secondary btn-sm" style="padding:3px 8px; font-size:11px; gap:4px;" onclick="bukaModalSession('${akun.id}')" title="Kelola Login & Sesi">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Login
          </button>
          <button class="btn-icon" onclick="verifikasiSesiCepat('${akun.id}')" title="Cek Status Sesi">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
          <button class="btn-icon" onclick="bukaModalEdit('${akun.id}')" title="Edit">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="konfirmasiHapusSatu('${akun.id}', '${escapeHtml(akun.username)}')" title="Hapus">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
    `;
  }).join('');
}

function renderLog(logData) {
  const tbody = document.getElementById('tabel-log');
  const emptyLog = document.getElementById('empty-log');

  if (logData.length === 0) {
    tbody.innerHTML = '';
    emptyLog.style.display = 'block';
    return;
  }

  emptyLog.style.display = 'none';

  tbody.innerHTML = logData.map(log => `
    <tr>
      <td class="text-muted" style="white-space:nowrap; font-size:12px;">${formatTanggal(log.waktu)}</td>
      <td><span class="badge badge-${log.status === 'sukses' ? 'aktif' : 'banned'}" style="font-size:11px;">${log.aksi}</span></td>
      <td style="font-weight:500;">${escapeHtml(log.username) || '—'}</td>
      <td class="text-secondary" style="font-size:13px;">${escapeHtml(log.detail)}</td>
      <td>
        <span class="badge badge-${log.status === 'sukses' ? 'aktif' : 'banned'}">
          <span class="badge-dot"></span>
          ${log.status}
        </span>
      </td>
    </tr>
  `).join('');
}

// ==================== MODAL: TAMBAH AKUN ====================
function bukaModalTambah() {
  modeEdit = false;
  document.getElementById('modal-akun-judul').textContent = 'Tambah Akun Baru';
  document.getElementById('btn-simpan').textContent = 'Simpan';

  // Reset form
  document.getElementById('form-id').value = '';
  document.getElementById('form-username').value = '';
  document.getElementById('form-password').value = '';
  document.getElementById('form-email').value = '';
  document.getElementById('form-phone').value = '';
  document.getElementById('form-proxy').value = '';
  document.getElementById('form-catatan').value = '';
  platformDipilih = '';

  document.querySelectorAll('.platform-option').forEach(el => el.classList.remove('selected'));

  bukaModal('modal-akun');
}

// ==================== MODAL: EDIT AKUN ====================
function bukaModalEdit(id) {
  const akun = dataAkun.find(a => a.id === id);
  if (!akun) return;

  modeEdit = true;
  document.getElementById('modal-akun-judul').textContent = 'Edit Akun';
  document.getElementById('btn-simpan').textContent = 'Update';

  document.getElementById('form-id').value = akun.id;
  document.getElementById('form-username').value = akun.username;
  document.getElementById('form-password').value = '';
  document.getElementById('form-email').value = akun.email;
  document.getElementById('form-phone').value = akun.phone;
  document.getElementById('form-proxy').value = akun.proxy;
  document.getElementById('form-catatan').value = akun.catatan;

  pilihPlatform(akun.platform);
  bukaModal('modal-akun');
}

// ==================== SIMPAN AKUN ====================
async function simpanAkun() {
  const id = document.getElementById('form-id').value;
  const username = document.getElementById('form-username').value.trim();
  const password = document.getElementById('form-password').value;
  const email = document.getElementById('form-email').value.trim();
  const phone = document.getElementById('form-phone').value.trim();
  const proxy = document.getElementById('form-proxy').value.trim();
  const catatan = document.getElementById('form-catatan').value.trim();

  if (!platformDipilih) {
    tampilToast('Pilih platform terlebih dahulu!', 'warning');
    return;
  }
  if (!username) {
    tampilToast('Username wajib diisi!', 'warning');
    return;
  }
  if (!modeEdit && !password) {
    tampilToast('Password wajib diisi!', 'warning');
    return;
  }

  const data = { platform: platformDipilih, username, email, phone, proxy, catatan };
  if (password) data.password = password;

  try {
    let res;
    if (modeEdit) {
      res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    const json = await res.json();

    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      tutupModal('modal-akun');
      muatData();
      muatLog();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

// ==================== HAPUS AKUN ====================
function konfirmasiHapusSatu(id, username) {
  hapusTarget = { type: 'satu', id, username };
  document.getElementById('pesan-hapus').textContent = `Apakah kamu yakin ingin menghapus akun "${username}"?`;
  bukaModal('modal-hapus');
}

function hapusTerpilih() {
  if (akunTerpilih.size === 0) return;
  hapusTarget = { type: 'banyak', ids: Array.from(akunTerpilih) };
  document.getElementById('pesan-hapus').textContent = `Apakah kamu yakin ingin menghapus ${akunTerpilih.size} akun yang dipilih?`;
  bukaModal('modal-hapus');
}

async function konfirmasiHapus() {
  if (!hapusTarget) return;

  try {
    let res;
    if (hapusTarget.type === 'satu') {
      res = await fetch(`${API_URL}/${hapusTarget.id}`, { method: 'DELETE' });
    } else {
      res = await fetch(API_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: hapusTarget.ids })
      });
    }

    const json = await res.json();

    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      akunTerpilih.clear();
      updateTombolHapusTerpilih();
      tutupModal('modal-hapus');
      muatData();
      muatLog();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }

  hapusTarget = null;
}

// ==================== GANTI STATUS CEPAT ====================
async function gantiStatusCepat(id, statusSekarang) {
  const urutan = ['aktif', 'nonaktif', 'banned', 'verifikasi'];
  const index = urutan.indexOf(statusSekarang);
  const statusBaru = urutan[(index + 1) % urutan.length];

  try {
    const res = await fetch(`${API_URL}/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusBaru })
    });

    const json = await res.json();

    if (json.sukses) {
      tampilToast(`Status diubah ke "${statusBaru}"`, 'sukses');
      muatData();
      muatLog();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

// ==================== IMPORT AKUN ====================
function bukaModalImport() {
  document.getElementById('import-text').value = '';
  bukaModal('modal-import');
}

function prosesFileImport(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('import-text').value = e.target.result;
    tampilToast(`File "${file.name}" berhasil dimuat`, 'info');
  };
  reader.readAsText(file);
}

async function importAkun() {
  const platform = document.getElementById('import-platform').value;
  const text = document.getElementById('import-text').value.trim();

  if (!text) {
    tampilToast('Masukkan data akun terlebih dahulu!', 'warning');
    return;
  }

  const baris = text.split('\n').filter(b => b.trim());
  const akunList = baris.map(baris => {
    const parts = baris.trim().split(':');
    return {
      platform,
      username: parts[0] || '',
      password: parts[1] || '',
      email: parts[2] || '',
      phone: parts[3] || '',
      proxy: parts[4] || ''
    };
  }).filter(a => a.username && a.password);

  if (akunList.length === 0) {
    tampilToast('Tidak ada data akun yang valid!', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ akun_list: akunList })
    });

    const json = await res.json();

    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      tutupModal('modal-import');
      muatData();
      muatLog();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

// ==================== FILTER & SEARCH ====================
function filterData() {
  muatData();
}

function filterPlatformSidebar(platform) {
  const filterEl = document.getElementById('filter-platform');
  filterEl.value = platform;
  // Switch to akun tab if on log
  gantiTab('akun');
  muatData();
}

let timerCari;
function cariAkun() {
  clearTimeout(timerCari);
  timerCari = setTimeout(() => muatData(), 300);
}

// ==================== CHECKBOX / PILIH ====================
function togglePilih(id) {
  if (akunTerpilih.has(id)) {
    akunTerpilih.delete(id);
  } else {
    akunTerpilih.add(id);
  }
  updateTombolHapusTerpilih();
}

function pilihSemua() {
  const checked = document.getElementById('pilih-semua').checked;
  if (checked) {
    dataAkun.forEach(a => akunTerpilih.add(a.id));
  } else {
    akunTerpilih.clear();
  }
  renderTabel();
  updateTombolHapusTerpilih();
}

function updateTombolHapusTerpilih() {
  const btn = document.getElementById('btn-hapus-terpilih');
  const jumlah = document.getElementById('jumlah-terpilih');
  if (akunTerpilih.size > 0) {
    btn.style.display = 'inline-flex';
    jumlah.textContent = akunTerpilih.size;
  } else {
    btn.style.display = 'none';
  }
}

// ==================== PLATFORM SELECTOR ====================
function pilihPlatform(platform) {
  platformDipilih = platform;
  document.querySelectorAll('.platform-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.platform === platform);
  });
}

// ==================== TAB / PAGE NAVIGATION ====================
function gantiTab(tab) {
  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(el => el.classList.remove('active'));
  const navItem = document.getElementById(`nav-${tab}`);
  if (navItem) navItem.classList.add('active');

  // Switch content
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const contentEl = document.getElementById(`tab-${tab}`);
  if (contentEl) contentEl.classList.add('active');

  // Update page title
  const titles = { monitoring: 'Monitoring & Analitik', akun: 'Akun Bot', engine: 'Bot Engine', proxy: 'Proxy Pool', log: 'Log Aktivitas' };
  document.getElementById('page-title').textContent = titles[tab] || '';

  // Update top bar buttons visibility (hanya untuk akun bot)
  const topBarRight = document.querySelector('.top-bar-right');
  if (topBarRight) {
    topBarRight.style.display = (tab === 'akun') ? 'flex' : 'none';
  }

  if (tab === 'monitoring') muatAnalitik();
  if (tab === 'log') muatLog();
  if (tab === 'engine') {
    muatTasks();
    muatStatistikTask();
    cekStatusRunner();
    updateTaskAkunOptions();
  }
  if (tab === 'proxy') {
    muatProxy();
    muatStatistikProxy();
  }

  // Close sidebar on mobile
  closeSidebarMobile();
}

// ==================== SIDEBAR MOBILE ====================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

// ==================== MODAL HELPERS ====================
function bukaModal(id) {
  document.getElementById(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}

function tutupModal(id) {
  document.getElementById(id).classList.remove('active');
  document.body.style.overflow = '';
}

// Tutup modal kalau klik di luar
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// Tutup modal dengan ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
    });
    document.body.style.overflow = '';
  }
});

// ==================== TOAST NOTIFICATION ====================
function tampilToast(pesan, tipe = 'info') {
  const container = document.getElementById('toast-container');

  const iconMap = {
    sukses: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${tipe}`;
  toast.innerHTML = `${iconMap[tipe] || iconMap.info} <span>${pesan}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3000);
}

// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTanggal(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

// ==================== BOT ENGINE / TASK QUEUE ====================

function updateTaskAkunOptions() {
  const select = document.getElementById('task-akun');
  if (!select) return;

  const nilaiDipilih = select.value;
  select.innerHTML = '<option value="">— Pilih akun bot —</option>';

  dataAkun.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `[${a.platform.toUpperCase()}] ${a.username}${a.status !== 'aktif' ? ' (' + a.status + ')' : ''}`;
    select.appendChild(opt);
  });

  if (nilaiDipilih) select.value = nilaiDipilih;
}

function toggleTaskFields() {
  const aksi = document.getElementById('task-aksi').value;
  const fieldKomentar = document.getElementById('field-komentar');
  const fieldDurasi = document.getElementById('field-durasi');

  if (fieldKomentar) {
    fieldKomentar.style.display = (aksi === 'comment') ? 'block' : 'none';
  }
  if (fieldDurasi) {
    fieldDurasi.style.display = (aksi === 'view') ? 'block' : 'none';
  }
}

async function buatTask() {
  const akunId = document.getElementById('task-akun').value;
  const aksi = document.getElementById('task-aksi').value;
  const targetText = document.getElementById('task-target').value.trim();
  const komentar = document.getElementById('task-komentar')?.value.trim() || '';
  const durasi = parseInt(document.getElementById('task-durasi')?.value, 10) || 10;

  if (!akunId) {
    tampilToast('Silakan pilih akun bot terlebih dahulu!', 'warning');
    return;
  }
  if (!targetText) {
    tampilToast('Masukkan URL target!', 'warning');
    return;
  }
  if (aksi === 'comment' && !komentar) {
    tampilToast('Tuliskan komentar terlebih dahulu!', 'warning');
    return;
  }

  const targets = targetText.split('\n').map(t => t.trim()).filter(Boolean);
  if (targets.length === 0) {
    tampilToast('URL target tidak valid!', 'warning');
    return;
  }

  try {
    let res;
    if (targets.length > 1) {
      res = await fetch('/api/bot/tasks/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          akun_ids: [akunId],
          aksi,
          targets,
          komentar,
          durasi
        })
      });
    } else {
      res = await fetch('/api/bot/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          akun_id: akunId,
          aksi,
          target: targets[0],
          komentar,
          durasi
        })
      });
    }

    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan || 'Task berhasil ditambahkan!', 'sukses');
      document.getElementById('task-target').value = '';
      if (document.getElementById('task-komentar')) {
        document.getElementById('task-komentar').value = '';
      }
      muatTasks();
      muatStatistikTask();
    } else {
      tampilToast(json.pesan || 'Gagal menambahkan task', 'error');
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

async function muatTasks(silent = false) {
  try {
    const status = document.getElementById('filter-task-status')?.value || '';
    let url = '/api/bot/tasks?';
    if (status) url += `status=${status}&`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.sukses) {
      renderTabelTasks(json.data);
      muatStatistikTask();
    }
  } catch (err) {
    if (!silent) console.error('Gagal memuat task:', err);
  }
}

function renderTabelTasks(tasks) {
  const tbody = document.getElementById('tabel-task');
  const emptyState = document.getElementById('empty-task');
  const countEl = document.getElementById('task-table-count');

  if (!tbody) return;

  if (countEl) countEl.textContent = tasks.length > 0 ? `(${tasks.length})` : '';

  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = tasks.map(t => {
    let aksiBtn = '';
    if (t.status === 'antrian') {
      aksiBtn = `
        <button class="btn-icon" title="Jalankan sekarang" onclick="jalankanSatuTask('${t.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button class="btn-icon danger" title="Batalkan" onclick="batalkanTask('${t.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
    } else if (t.status === 'berjalan') {
      aksiBtn = `
        <button class="btn-icon danger" title="Batalkan" onclick="batalkanTask('${t.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
    } else {
      aksiBtn = `
        <button class="btn-icon danger" title="Hapus" onclick="hapusTask('${t.id}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(t.username || '—')}</strong></td>
        <td><span class="badge badge-${t.platform}">${t.platform}</span></td>
        <td><span class="badge badge-action badge-action-${t.aksi}">${t.aksi}</span></td>
        <td>
          <a href="${escapeHtml(t.target)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent); text-decoration:none; max-width:220px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(t.target)}">
            ${escapeHtml(t.target)}
          </a>
        </td>
        <td><span class="badge badge-${t.status}"><span class="badge-dot"></span>${t.status}</span></td>
        <td>
          <span style="font-size:12px; color:var(--text-secondary); max-width:180px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(t.hasil || '')}">
            ${escapeHtml(t.hasil || '—')}
          </span>
        </td>
        <td class="text-muted">${formatTanggal(t.dibuat_pada)}</td>
        <td>
          <div class="actions-cell">
            ${aksiBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function muatStatistikTask() {
  try {
    const res = await fetch('/api/bot/tasks/stats');
    const json = await res.json();
    if (json.sukses) {
      const s = json.data;
      const totalEl = document.getElementById('task-total');
      const antrianEl = document.getElementById('task-antrian');
      const selesaiEl = document.getElementById('task-selesai');
      const gagalEl = document.getElementById('task-gagal');
      const navEngineCount = document.getElementById('nav-count-engine');

      if (totalEl) totalEl.textContent = s.total;
      if (antrianEl) antrianEl.textContent = s.antrian;
      if (selesaiEl) selesaiEl.textContent = s.selesai;
      if (gagalEl) gagalEl.textContent = s.gagal;
      if (navEngineCount) navEngineCount.textContent = s.antrian;
    }
  } catch (e) {
    console.error('Gagal muat stats task:', e);
  }
}

async function cekStatusRunner() {
  try {
    const res = await fetch('/api/bot/tasks/runner-status');
    const json = await res.json();
    if (json.sukses) {
      updateRunnerUI(json.data.isRunning);
    }
  } catch (e) {
    console.error('Gagal cek status runner:', e);
  }
}

function updateRunnerUI(isRunning) {
  const badge = document.getElementById('runner-status-badge');
  const text = document.getElementById('runner-status-text');
  const btn = document.getElementById('btn-toggle-runner');
  const btnText = document.getElementById('runner-btn-text');
  const btnIcon = document.getElementById('runner-btn-icon');

  if (isRunning) {
    if (badge) {
      badge.style.background = 'var(--warning-light)';
      badge.style.color = 'var(--warning)';
    }
    if (text) text.textContent = 'Runner: Berjalan';
    if (btn) {
      btn.className = 'btn btn-secondary btn-sm';
    }
    if (btnText) btnText.textContent = 'Jeda Antrian';
    if (btnIcon) {
      btnIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    }
  } else {
    if (badge) {
      badge.style.background = 'var(--neutral-light)';
      badge.style.color = 'var(--neutral)';
    }
    if (text) text.textContent = 'Runner: Idle';
    if (btn) {
      btn.className = 'btn btn-primary btn-sm';
    }
    if (btnText) btnText.textContent = 'Mulai Antrian';
    if (btnIcon) {
      btnIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
  }
}

async function toggleRunner() {
  try {
    const statusRes = await fetch('/api/bot/tasks/runner-status');
    const statusJson = await statusRes.json();
    const isRunning = statusJson.data ? statusJson.data.isRunning : false;

    const endpoint = isRunning ? '/api/bot/tasks/pause' : '/api/bot/tasks/start';
    const res = await fetch(endpoint, { method: 'POST' });
    const json = await res.json();

    if (json.sukses) {
      tampilToast(json.pesan, isRunning ? 'info' : 'sukses');
      updateRunnerUI(!isRunning);
      muatTasks();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error toggle runner: ' + err.message, 'error');
  }
}

async function jalankanSatuTask(id) {
  tampilToast('Menjalankan task...', 'info');
  try {
    const res = await fetch(`/api/bot/tasks/${id}/run`, { method: 'POST' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast('Task selesai: ' + json.pesan, 'sukses');
    } else {
      tampilToast('Task: ' + json.pesan, 'warning');
    }
    muatTasks();
    muatLog();
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
    muatTasks();
  }
}

async function batalkanTask(id) {
  try {
    const res = await fetch(`/api/bot/tasks/${id}/cancel`, { method: 'PATCH' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'info');
      muatTasks();
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

async function hapusTask(id) {
  try {
    const res = await fetch(`/api/bot/tasks/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      muatTasks();
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

async function bersihkanTask() {
  try {
    const res = await fetch('/api/bot/tasks/clear', { method: 'POST' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      muatTasks();
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

async function batalkanSemuaTask() {
  if (!confirm('Yakin ingin membatalkan semua task dalam antrian?')) return;
  try {
    const res = await fetch('/api/bot/tasks/cancel-all', { method: 'POST' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'info');
      muatTasks();
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

// ==================== PROXY POOL MANAGEMENT ====================
let dataProxy = [];
let timerCariProxy = null;

async function muatProxy(silent = false) {
  try {
    const status = document.getElementById('filter-proxy-status')?.value || '';
    const cari = document.getElementById('input-cari-proxy')?.value || '';

    let url = '/api/proxy?';
    if (status) url += `status=${status}&`;
    if (cari) url += `cari=${encodeURIComponent(cari)}&`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.sukses) {
      dataProxy = json.data;
      renderTabelProxy(dataProxy);
      muatStatistikProxy();
    }
  } catch (err) {
    if (!silent) tampilToast('Gagal memuat proxy: ' + err.message, 'error');
  }
}

function renderTabelProxy(proxies) {
  const tbody = document.getElementById('tabel-proxy');
  const emptyState = document.getElementById('empty-proxy');
  const countEl = document.getElementById('proxy-table-count');

  if (!tbody) return;

  if (countEl) countEl.textContent = proxies.length > 0 ? `(${proxies.length})` : '';

  if (!proxies || proxies.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = proxies.map(p => {
    let latencyBadge = '<span class="text-muted">—</span>';
    if (p.kecepatan_ms > 0) {
      const cls = p.kecepatan_ms < 1000 ? 'latency-fast' : (p.kecepatan_ms < 2500 ? 'latency-slow' : 'latency-dead');
      latencyBadge = `<span class="${cls}">${p.kecepatan_ms} ms</span>`;
    }

    const authText = p.username ? '<span style="color:var(--accent); font-size:12px; font-weight:500;">Ya</span>' : '<span class="text-muted">Tidak</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(p.host)}:${p.port}</strong></td>
        <td><span class="badge badge-proto badge-proto-${p.protokol}">${p.protokol}</span></td>
        <td>${authText}</td>
        <td><span class="badge badge-${p.status}"><span class="badge-dot"></span>${p.status}</span></td>
        <td>${latencyBadge}</td>
        <td style="font-family:monospace; font-size:12px;">${escapeHtml(p.ip_terdeteksi || '—')}</td>
        <td class="text-muted">${formatTanggal(p.terakhir_dicek)}</td>
        <td class="text-muted" style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.catatan || '—')}</td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon" title="Tes Koneksi Proxy" onclick="testSatuProxy('${p.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            <button class="btn-icon danger" title="Hapus Proxy" onclick="hapusProxyPool('${p.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function muatStatistikProxy() {
  try {
    const res = await fetch('/api/proxy/stats');
    const json = await res.json();
    if (json.sukses) {
      const s = json.data;
      const totalEl = document.getElementById('proxy-stat-total');
      const aktifEl = document.getElementById('proxy-stat-aktif');
      const matiEl = document.getElementById('proxy-stat-mati');
      const kecEl = document.getElementById('proxy-stat-kecepatan');
      const navProxyCount = document.getElementById('nav-count-proxy');

      if (totalEl) totalEl.textContent = s.total;
      if (aktifEl) aktifEl.textContent = s.aktif;
      if (matiEl) matiEl.textContent = s.mati;
      if (kecEl) kecEl.textContent = s.rata_kecepatan > 0 ? `${s.rata_kecepatan} ms` : '—';
      if (navProxyCount) navProxyCount.textContent = s.aktif;
    }
  } catch (e) {
    console.error('Gagal muat stats proxy:', e);
  }
}

function cariProxy() {
  clearTimeout(timerCariProxy);
  timerCariProxy = setTimeout(() => muatProxy(), 300);
}

function bukaModalTambahProxy() {
  document.getElementById('form-proxy-id').value = '';
  document.getElementById('form-proxy-host').value = '';
  document.getElementById('form-proxy-port').value = '8080';
  document.getElementById('form-proxy-protokol').value = 'http';
  document.getElementById('form-proxy-user').value = '';
  document.getElementById('form-proxy-pass').value = '';
  document.getElementById('form-proxy-catatan').value = '';
  document.getElementById('modal-proxy-judul').textContent = 'Tambah Proxy';
  bukaModal('modal-proxy');
}

async function simpanProxy() {
  const host = document.getElementById('form-proxy-host').value.trim();
  const port = parseInt(document.getElementById('form-proxy-port').value, 10);
  const protokol = document.getElementById('form-proxy-protokol').value;
  const username = document.getElementById('form-proxy-user').value.trim();
  const password = document.getElementById('form-proxy-pass').value.trim();
  const catatan = document.getElementById('form-proxy-catatan').value.trim();

  if (!host) {
    tampilToast('Host / IP proxy wajib diisi!', 'warning');
    return;
  }
  if (!port || isNaN(port)) {
    tampilToast('Port proxy harus berupa angka valid!', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, port, protokol, username, password, catatan })
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      tutupModal('modal-proxy');
      muatProxy();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

function bukaModalImportProxy() {
  document.getElementById('import-proxy-text').value = '';
  bukaModal('modal-import-proxy');
}

async function importProxyBulk() {
  const text = document.getElementById('import-proxy-text').value.trim();
  if (!text) {
    tampilToast('Masukkan daftar proxy terlebih dahulu!', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/proxy/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      tutupModal('modal-import-proxy');
      muatProxy();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

async function testSatuProxy(id) {
  tampilToast('Mengetes koneksi proxy...', 'info');
  try {
    const res = await fetch(`/api/proxy/${id}/test`, { method: 'POST' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(`Proxy aktif! Ping: ${json.data.kecepatan_ms}ms (IP: ${json.data.ip_terdeteksi})`, 'sukses');
    } else {
      tampilToast(`Proxy mati / gagal: ${json.data?.pesan || 'Timeout'}`, 'error');
    }
    muatProxy();
  } catch (err) {
    tampilToast('Error tes proxy: ' + err.message, 'error');
  }
}

async function testSemuaProxyUI() {
  const btn = document.getElementById('btn-test-semua-proxy');
  if (btn) btn.disabled = true;
  tampilToast('Mengetes koneksi seluruh proxy di pool...', 'info');

  try {
    const res = await fetch('/api/proxy/test-all', { method: 'POST' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      muatProxy();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function hapusProxyPool(id) {
  if (!confirm('Hapus proxy ini dari pool?')) return;
  try {
    const res = await fetch(`/api/proxy/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      muatProxy();
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

async function bersihkanProxyMati() {
  if (!confirm('Yakin ingin menghapus seluruh proxy yang berstatus mati?')) return;
  try {
    const res = await fetch('/api/proxy/clear-dead', { method: 'POST' });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      muatProxy();
    }
  } catch (err) {
    tampilToast('Error: ' + err.message, 'error');
  }
}

async function pilihProxyDariPool() {
  try {
    const res = await fetch('/api/proxy?status=aktif');
    const json = await res.json();
    const list = json.sukses ? json.data : [];
    const container = document.getElementById('list-pilihan-proxy');

    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:20px; color:var(--text-muted);">
          <p>Belum ada proxy aktif di pool.</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="tutupModal('modal-pilih-proxy'); gantiTab('proxy');">Buka Proxy Pool</button>
        </div>
      `;
    } else {
      container.innerHTML = list.map(p => {
        let proxyFormatted = `${p.host}:${p.port}`;
        if (p.username && p.password) {
          proxyFormatted = `${p.username}:${p.password}@${p.host}:${p.port}`;
        }
        return `
          <div class="proxy-select-item" onclick="terapkanProxyKeForm('${escapeHtml(proxyFormatted)}')">
            <div>
              <strong>${escapeHtml(p.host)}:${p.port}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${p.protokol.toUpperCase()} ${p.catatan ? '• ' + escapeHtml(p.catatan) : ''}</div>
            </div>
            <div>
              <span class="badge badge-aktif"><span class="badge-dot"></span>${p.kecepatan_ms > 0 ? p.kecepatan_ms + 'ms' : 'Aktif'}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    bukaModal('modal-pilih-proxy');
  } catch (err) {
    tampilToast('Gagal memuat proxy pool: ' + err.message, 'error');
  }
}

function terapkanProxyKeForm(proxyStr) {
  const input = document.getElementById('form-proxy');
  if (input) {
    input.value = proxyStr;
    tampilToast('Proxy pool diterapkan ke form', 'info');
  }
  tutupModal('modal-pilih-proxy');
}

// ==================== MONITORING & ANALITIK ====================
async function muatAnalitik(silent = false) {
  try {
    const res = await fetch('/api/analytics/dashboard');
    const json = await res.json();
    if (!json.sukses) {
      if (!silent) tampilToast('Gagal memuat analitik: ' + json.pesan, 'error');
      return;
    }

    const { ringkasan, runner, distribusi_aksi, distribusi_platform, log_terbaru } = json.data;

    // 1. KPI Cards
    const elAkun = document.getElementById('mon-stat-akun');
    const elSelesai = document.getElementById('mon-stat-selesai');
    const elRate = document.getElementById('mon-stat-rate');
    const elProxy = document.getElementById('mon-stat-proxy');

    if (elAkun) elAkun.textContent = ringkasan.total_akun ?? 0;
    if (elSelesai) elSelesai.textContent = ringkasan.task_selesai ?? 0;
    if (elRate) elRate.textContent = (ringkasan.success_rate ?? 100) + '%';
    if (elProxy) elProxy.textContent = ringkasan.proxy_aktif ?? 0;

    // 2. System Banner
    const badgeRunner = document.getElementById('mon-runner-badge');
    const textRunner = document.getElementById('mon-runner-text');
    const elBrowser = document.getElementById('mon-browser-count');
    const elProxyPool = document.getElementById('mon-proxy-pool');

    const isRunning = runner && (runner.isRunning || runner.is_running);
    if (isRunning) {
      if (badgeRunner) {
        badgeRunner.style.background = 'var(--success-light)';
        badgeRunner.style.color = 'var(--success)';
      }
      const activeCount = runner.active_tasks_count ?? runner.stats?.berjalan ?? 0;
      if (textRunner) textRunner.textContent = `Runner: Berjalan (${activeCount} aktif)`;
    } else {
      if (badgeRunner) {
        badgeRunner.style.background = 'var(--bg-muted)';
        badgeRunner.style.color = 'var(--text-secondary)';
      }
      if (textRunner) textRunner.textContent = 'Runner: Siaga (Idle)';
    }

    if (elBrowser) elBrowser.textContent = `${ringkasan.browser_aktif || 0} instance`;
    if (elProxyPool) elProxyPool.textContent = `${ringkasan.proxy_aktif || 0} aktif (${ringkasan.total_proxy || 0} total)`;

    // 3. Distribusi Aksi Chart
    renderDistribusiAksi(distribusi_aksi);

    // 4. Performa Platform
    renderPerformaPlatform(distribusi_platform);

    // 5. Live Feed Log Aktivitas
    renderFeedLogMonitoring(log_terbaru);

  } catch (err) {
    if (!silent) tampilToast('Error memuat monitoring: ' + err.message, 'error');
  }
}

function renderDistribusiAksi(distribusi) {
  const container = document.getElementById('container-aksi-chart');
  if (!container) return;

  if (!distribusi || distribusi.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px;">Belum ada task yang dieksekusi.</div>';
    return;
  }

  const labelAksiMap = {
    follow: 'Follow Target',
    like: 'Like Konten',
    comment: 'Komentar',
    view: 'Tonton Video',
    share: 'Bagikan (Share)'
  };

  const totalAksi = distribusi.reduce((sum, item) => sum + (item.jumlah || 0), 0);
  const maxJumlah = Math.max(...distribusi.map(d => d.jumlah || 0), 1);

  container.innerHTML = distribusi.map(d => {
    const label = labelAksiMap[d.aksi] || d.aksi;
    const persen = totalAksi > 0 ? Math.round(((d.jumlah || 0) / maxJumlah) * 100) : 0;
    return `
      <div class="chart-bar-row">
        <div class="chart-bar-label">${label}</div>
        <div class="chart-bar-track">
          <div class="chart-bar-fill" style="width: ${persen}%;"></div>
        </div>
        <div class="chart-bar-val">${d.jumlah || 0}</div>
      </div>
    `;
  }).join('');
}

function renderPerformaPlatform(distribusi) {
  const container = document.getElementById('container-platform-perf');
  if (!container) return;

  if (!distribusi || distribusi.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:16px;">Belum ada data performa platform.</div>';
    return;
  }

  const platformNames = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube'
  };

  container.innerHTML = distribusi.map(p => {
    const name = platformNames[p.platform] || p.platform;
    const rate = p.tasks > 0 ? Math.round((p.sukses / p.tasks) * 100) : 100;
    return `
      <div class="platform-perf-row">
        <div class="platform-perf-left">
          <span class="badge badge-platform badge-${p.platform}">${name}</span>
          <span style="font-size:12px; color:var(--text-muted);">${p.akun} akun terdaftar</span>
        </div>
        <div class="platform-perf-stats">
          <div><span style="color:var(--text-muted);">Total Task:</span> <strong>${p.tasks}</strong></div>
          <div><span style="color:var(--text-muted);">Sukses:</span> <strong style="color:var(--success);">${p.sukses}</strong></div>
          <div><span style="color:var(--text-muted);">Tingkat Sukses:</span> <strong>${rate}%</strong></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderFeedLogMonitoring(logs) {
  const tbody = document.getElementById('tabel-mon-log');
  if (!tbody) return;

  if (!logs || logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">
          Belum ada log aktivitas bot yang tercatat.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map(l => {
    let statusBadge = '';
    if (l.status === 'sukses') {
      statusBadge = '<span class="badge badge-aktif"><span class="badge-dot"></span>Sukses</span>';
    } else if (l.status === 'gagal') {
      statusBadge = '<span class="badge badge-banned"><span class="badge-dot"></span>Gagal</span>';
    } else {
      statusBadge = `<span class="badge badge-neutral">${escapeHtml(l.status)}</span>`;
    }

    const platformBadge = l.platform
      ? `<span class="badge badge-platform badge-${l.platform}">${l.platform}</span>`
      : `<span class="badge badge-neutral">Sistem</span>`;

    return `
      <tr>
        <td style="white-space:nowrap; font-size:12px; color:var(--text-secondary);">${formatTanggal(l.waktu)}</td>
        <td>${platformBadge}</td>
        <td><strong>${escapeHtml(l.username || 'System')}</strong></td>
        <td><span class="badge badge-neutral">${escapeHtml(l.aksi || '—')}</span></td>
        <td style="font-size:12px; color:var(--text-secondary); max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escapeHtml(l.detail || '—')}
        </td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

// ==================== SESI & AUTO-LOGIN MODAL ====================
let sessionTargetAkun = null;

function bukaModalSession(akunId) {
  const akun = dataAkun.find(a => a.id === akunId);
  if (!akun) {
    tampilToast('Akun tidak ditemukan', 'error');
    return;
  }

  sessionTargetAkun = akun;

  // Set modal headers
  document.getElementById('modal-session-title').textContent = `Kelola Login: ${akun.username}`;
  document.getElementById('modal-session-subtitle').textContent = `${akun.platform.toUpperCase()} • ID: ${akun.id.slice(0, 8)}...`;

  // Proxy info
  const proxyEl = document.getElementById('session-proxy-info');
  if (proxyEl) {
    proxyEl.textContent = akun.proxy ? `Proxy: ${akun.proxy}` : 'Proxy: Auto-Rotator / Direct Connection';
  }

  // Current session badge
  updateModalSessionBadge(akun.session_status || 'belum_login');

  // Reset progress and input
  const progressBox = document.getElementById('session-login-progress');
  if (progressBox) progressBox.style.display = 'none';

  const cookiesInput = document.getElementById('session-cookies-input');
  if (cookiesInput) {
    fetch(`/api/akun/${akunId}/cookies`)
      .then(r => r.json())
      .then(d => {
        if (d.sukses && d.cookies && d.cookies.length > 0) {
          cookiesInput.value = JSON.stringify(d.cookies, null, 2);
        } else {
          cookiesInput.value = '';
        }
      })
      .catch(() => { cookiesInput.value = ''; });
  }

  // Set default active tab
  gantiSubtabSession('autologin');
  bukaModal('modal-session');
}

function updateModalSessionBadge(status) {
  const badgeEl = document.getElementById('session-cur-badge');
  if (!badgeEl) return;

  if (status === 'logged_in') {
    badgeEl.className = 'badge badge-aktif';
    badgeEl.innerHTML = '<span class="badge-dot"></span>Sesi Aktif';
  } else if (status === 'challenge') {
    badgeEl.className = 'badge badge-warning';
    badgeEl.innerHTML = '<span class="badge-dot"></span>Challenge / 2FA';
  } else if (status === 'expired') {
    badgeEl.className = 'badge badge-banned';
    badgeEl.innerHTML = '<span class="badge-dot"></span>Sesi Expired';
  } else {
    badgeEl.className = 'badge badge-neutral';
    badgeEl.innerHTML = '<span class="badge-dot"></span>Belum Login';
  }
}

function gantiSubtabSession(subtab) {
  document.querySelectorAll('.session-subtab').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-subtab-${subtab}`);
  if (activeBtn) activeBtn.classList.add('active');

  const panes = ['autologin', 'interactive', 'cookies'];
  panes.forEach(p => {
    const paneEl = document.getElementById(`session-pane-${p}`);
    if (paneEl) paneEl.style.display = (p === subtab) ? 'block' : 'none';
  });
}

async function jalankanAutoLoginUI() {
  if (!sessionTargetAkun) return;

  const btn = document.getElementById('btn-run-autologin');
  const progressBox = document.getElementById('session-login-progress');
  const progressText = document.getElementById('session-progress-text');

  if (btn) btn.disabled = true;
  if (progressBox) progressBox.style.display = 'block';
  if (progressText) progressText.textContent = 'Memulai browser stealth & mencoba login...';

  try {
    const res = await fetch(`/api/akun/${sessionTargetAkun.id}/auto-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headless: true })
    });

    const json = await res.json();

    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      updateModalSessionBadge('logged_in');
      muatData();
      muatLog();
    } else {
      if (json.status === 'challenge') {
        tampilToast(json.pesan, 'warning');
        updateModalSessionBadge('challenge');
      } else {
        tampilToast(json.pesan, 'error');
        updateModalSessionBadge('belum_login');
      }
      muatData();
    }
  } catch (err) {
    tampilToast('Error auto-login: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (progressBox) progressBox.style.display = 'none';
  }
}

async function bukaBrowserLoginManualUI() {
  if (!sessionTargetAkun) return;

  const btn = document.getElementById('btn-open-browser');
  if (btn) btn.disabled = true;
  tampilToast('Membuka browser Chrome interaktif di layar...', 'info');

  try {
    const res = await fetch(`/api/akun/${sessionTargetAkun.id}/open-browser`, {
      method: 'POST'
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error buka browser: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function simpanSesiDariBrowserUI() {
  if (!sessionTargetAkun) return;

  const btn = document.getElementById('btn-save-browser-session');
  if (btn) btn.disabled = true;
  tampilToast('Mengekstrak cookies dari browser aktif...', 'info');

  try {
    const res = await fetch(`/api/akun/${sessionTargetAkun.id}/save-session`, {
      method: 'POST'
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      updateModalSessionBadge('logged_in');
      muatData();
      muatLog();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error simpan sesi: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function tutupBrowserManualUI() {
  if (!sessionTargetAkun) return;
  try {
    const res = await fetch(`/api/akun/${sessionTargetAkun.id}/close-browser`, {
      method: 'POST'
    });
    const json = await res.json();
    tampilToast(json.pesan, json.sukses ? 'info' : 'warning');
  } catch (err) {
    tampilToast('Error tutup browser: ' + err.message, 'error');
  }
}

async function verifikasiSesiAkunUI() {
  if (!sessionTargetAkun) return;

  const btn = document.getElementById('btn-verify-single');
  if (btn) btn.disabled = true;
  tampilToast('Memverifikasi status sesi akun...', 'info');

  try {
    const res = await fetch(`/api/akun/${sessionTargetAkun.id}/verify-session`, {
      method: 'POST'
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, json.valid ? 'sukses' : 'warning');
      updateModalSessionBadge(json.session_status);
      muatData();
      muatLog();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error verifikasi sesi: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function verifikasiSesiCepat(akunId) {
  tampilToast('Memverifikasi status sesi...', 'info');
  try {
    const res = await fetch(`/api/akun/${akunId}/verify-session`, {
      method: 'POST'
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, json.valid ? 'sukses' : 'warning');
      muatData();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error verifikasi: ' + err.message, 'error');
  }
}

async function verifikasiSemuaSesiUI() {
  const btn = document.getElementById('btn-cek-semua-sesi');
  if (btn) btn.disabled = true;
  tampilToast('Memeriksa kesehatan sesi seluruh akun...', 'info');

  try {
    const res = await fetch('/api/akun/verify-all-sessions', {
      method: 'POST'
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      muatData();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error cek semua sesi: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function simpanCookiesJSONUI() {
  if (!sessionTargetAkun) return;

  const text = document.getElementById('session-cookies-input').value.trim();
  if (!text) {
    tampilToast('Masukkan data cookies JSON terlebih dahulu!', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/akun/${sessionTargetAkun.id}/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies: text })
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      updateModalSessionBadge('logged_in');
      muatData();
      muatLog();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error import cookies: ' + err.message, 'error');
  }
}

async function exportCookiesJSONUI() {
  if (!sessionTargetAkun) return;
  try {
    const res = await fetch(`/api/akun/${sessionTargetAkun.id}/cookies`);
    const json = await res.json();
    if (json.sukses && json.cookies && json.cookies.length > 0) {
      const formatted = JSON.stringify(json.cookies, null, 2);
      await navigator.clipboard.writeText(formatted);
      tampilToast(`Berhasil menyalin ${json.cookies.length} cookies ke clipboard!`, 'sukses');
    } else {
      tampilToast('Belum ada cookies tersimpan untuk akun ini.', 'warning');
    }
  } catch (err) {
    tampilToast('Gagal copy cookies: ' + err.message, 'error');
  }
}

async function hapusSesiAkunUI() {
  if (!sessionTargetAkun) return;
  if (!confirm(`Reset dan bersihkan sesi untuk akun ${sessionTargetAkun.username}?`)) return;

  try {
    const res = await fetch(`/api/akun/${sessionTargetAkun.id}/session`, {
      method: 'DELETE'
    });
    const json = await res.json();
    if (json.sukses) {
      tampilToast(json.pesan, 'sukses');
      updateModalSessionBadge('belum_login');
      document.getElementById('session-cookies-input').value = '';
      muatData();
      muatLog();
    } else {
      tampilToast(json.pesan, 'error');
    }
  } catch (err) {
    tampilToast('Error reset sesi: ' + err.message, 'error');
  }
}



