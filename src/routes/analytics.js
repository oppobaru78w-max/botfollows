const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { statusBrowser } = require('../browser/manager');
const taskRunner = require('../engine/taskRunner');

// GET: Ringkasan Analitik & Monitoring Dashboard
router.get('/dashboard', (req, res) => {
  try {
    const analitik = db.ambilAnalitikDashboard();
    const browserAktif = statusBrowser();
    const runnerStatus = taskRunner.getStatus();

    analitik.ringkasan.browser_aktif = browserAktif.length;
    analitik.runner = runnerStatus;
    analitik.browser_list = browserAktif;

    res.json({ sukses: true, data: analitik });
  } catch (err) {
    res.status(500).json({ sukses: false, pesan: err.message });
  }
});

module.exports = router;
