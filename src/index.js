const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDatabase } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve dashboard (file statis)
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// API Routes
const accountRoutes = require('./routes/accounts');
const botRoutes = require('./routes/bot');
const proxyRoutes = require('./routes/proxy');
const analyticsRoutes = require('./routes/analytics');
app.use('/api/akun', accountRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/analytics', analyticsRoutes);

// Route utama — arahkan ke dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dashboard', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ sukses: false, pesan: 'Terjadi kesalahan server', error: err.message });
});

// Start server setelah database siap
async function mulai() {
  console.log('');
  console.log('⏳ Menginisialisasi database...');

  await initDatabase();

  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║         🤖 SMM Bot Engine v1.0.0            ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🌐 Dashboard : http://localhost:${PORT}          ║`);
    console.log(`║  📡 API       : http://localhost:${PORT}/api      ║`);
    console.log('║  📋 Status    : Step 1 - Konfigurasi Akun   ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  });
}

mulai().catch(err => {
  console.error('❌ Gagal memulai server:', err);
  process.exit(1);
});

module.exports = app;
