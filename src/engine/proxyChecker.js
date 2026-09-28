const http = require('http');
const net = require('net');
const db = require('../config/database');

/**
 * Tes koneksi satu proxy via TCP socket & HTTP request
 */
async function testProxy(proxy, timeoutMs = 5000) {
  const mulai = Date.now();
  const host = proxy.host;
  const port = parseInt(proxy.port, 10);

  // Tahap 1: Cek Socket TCP Reachability
  const socketOk = await new Promise(resolve => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });

  const latency = Date.now() - mulai;

  if (!socketOk) {
    const hasil = {
      sukses: false,
      status: 'mati',
      kecepatan_ms: latency,
      pesan: 'Koneksi ke host/port gagal atau timeout',
      ip_terdeteksi: '',
    };
    if (proxy.id) {
      db.updateProxy(proxy.id, {
        status: 'mati',
        kecepatan_ms: latency,
        terakhir_dicek: new Date().toISOString(),
      });
    }
    return hasil;
  }

  // Tahap 2: Tes HTTP Proxy Request
  let ipDitemukan = '';
  let httpSukses = false;

  try {
    const res = await new Promise(resolve => {
      const headers = { 'User-Agent': 'Mozilla/5.0 SMM-Bot-Engine/1.0' };
      if (proxy.username && proxy.password) {
        headers['Proxy-Authorization'] = 'Basic ' + Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
      }

      const req = http.request({
        host,
        port,
        path: 'http://api.ipify.org?format=json',
        method: 'GET',
        headers,
        timeout: timeoutMs,
      }, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 400) {
            try {
              const parsed = JSON.parse(data);
              ipDitemukan = parsed.ip || '';
            } catch {
              ipDitemukan = data.trim().slice(0, 50);
            }
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
    httpSukses = res;
  } catch (e) {
    httpSukses = false;
  }

  const finalLatency = Date.now() - mulai;
  const status = (finalLatency > 2000) ? 'lambat' : 'aktif';

  const hasil = {
    sukses: true,
    status,
    kecepatan_ms: finalLatency,
    ip_terdeteksi: ipDitemukan || host,
    pesan: `Terkoneksi (${finalLatency}ms)`,
  };

  if (proxy.id) {
    db.updateProxy(proxy.id, {
      status,
      kecepatan_ms: finalLatency,
      ip_terdeteksi: ipDitemukan || host,
      terakhir_dicek: new Date().toISOString(),
    });
  }

  return hasil;
}

/**
 * Tes semua proxy di database secara concurrency
 */
async function testSemuaProxy(concurrency = 5) {
  const proxies = db.ambilSemuaProxy();
  const hasil = [];

  for (let i = 0; i < proxies.length; i += concurrency) {
    const chunk = proxies.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(p => testProxy(p)));
    hasil.push(...chunkResults);
  }

  return {
    total: proxies.length,
    stats: db.hitungStatistikProxy(),
  };
}

module.exports = {
  testProxy,
  testSemuaProxy,
};
