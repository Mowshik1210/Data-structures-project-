'use strict';

/* ============================================================
 *  TRWL — server.js
 *  Zero-dependency Node.js backend:
 *    • REAL data structures (linked list, queue, stack)
 *    • JSON API
 *    • serves the frontend (single command to run it all)
 *  Run:  node server.js     (or:  npm start)
 * ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ReservationSystem = require('./backend/reservationSystem');
const Logger = require('./backend/logger');

const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const logger = new Logger();
const system = new ReservationSystem({ trainNo: 12658, totalSeats: 5, maxWaiting: 10, logger });

/* ---------------- helpers ---------------- */

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '', bytes = 0;
    req.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        reject(Object.assign(new Error('Request body too large (limit 64 KB).'), { status: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error('Request body is not valid JSON.'), { status: 400 })); }
    });
    req.on('error', (e) => reject(Object.assign(e, { status: 400 })));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function serveStatic(res, pathname) {
  if (pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.normalize(path.join(FRONTEND_DIR, rel));
  if (file !== FRONTEND_DIR && !file.startsWith(FRONTEND_DIR + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      // unknown path → serve the app shell (deep-link friendly)
      return fs.readFile(path.join(FRONTEND_DIR, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(html);
      });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ---------------- API layer ---------------- */

async function handleApi(req, res, url) {
  const p = url.pathname;
  logger.log('API', `${req.method} ${p}`);
  try {
    if (req.method === 'GET') {
      switch (p) {
        case '/api/health':
          return send(res, 200, {
            ok: true,
            service: 'TRWL Backend — Train Reservation Waiting List',
            uptimeSec: Math.floor((Date.now() - system.startedAt) / 1000),
            structures: {
              confirmedLinkedList: { status: 'ACTIVE', nodes: system.confirmed.size },
              waitingQueue: { status: 'ACTIVE', nodes: system.waiting.size },
              actionStack: { status: 'ACTIVE', actions: system.history.size }
            },
            modules: { search: 'Linear Search', sort: 'Insertion Sort' }
          });
        case '/api/state':        return send(res, 200, { ok: true, state: system.snapshot() });
        case '/api/availability': return send(res, 200, { ok: true, availability: system.availability() });
        case '/api/confirmed':    return send(res, 200, { ok: true, count: system.confirmed.size, confirmed: system.confirmed.toArray() });
        case '/api/waiting':      return send(res, 200, { ok: true, count: system.waiting.size, waiting: system.waiting.toArray() });
        case '/api/history':      return send(res, 200, { ok: true, count: system.history.size, stack: system.history.toArray() });
        case '/api/activity':     return send(res, 200, { ok: true, activity: system.snapshot().activity });
        default:                  return send(res, 404, { ok: false, error: `Unknown API endpoint: ${p}` });
      }
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      switch (p) {
        case '/api/book':   return send(res, 201, { ok: true, result: system.book(body) });
        case '/api/cancel': return send(res, 200, { ok: true, result: system.cancel(body.pnr) });
        case '/api/search': return send(res, 200, { ok: true, result: system.search(body.type, body.value) });
        case '/api/sort':   return send(res, 200, { ok: true, result: system.sortConfirmed(body.key) });
        case '/api/undo':   return send(res, 200, { ok: true, result: system.undo() });
        case '/api/update': return send(res, 200, { ok: true, result: system.update(body.pnr, body) });
        case '/api/demo':   return send(res, 200, { ok: true, state: system.loadDemo() });
        case '/api/reset':  return send(res, 200, { ok: true, state: system.reset() });
        default:            return send(res, 404, { ok: false, error: `Unknown API endpoint: ${p}` });
      }
    }
    return send(res, 405, { ok: false, error: 'Method not allowed.' });
  } catch (err) {
    const status = err.status || 500;
    logger.log('ERROR', `${req.method} ${p} → ${status} — ${err.message}`);
    return send(res, status, { ok: false, error: err.message || 'Internal server error.' });
  }
}

/* ---------------- HTTP server ---------------- */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url).catch((e) => send(res, 500, { ok: false, error: String(e) }));
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('Method not allowed'); }
  return serveStatic(res, url.pathname);
});

/* auto-start when run directly; exportable so the test-suite can use it */
if (require.main === module) {
  server.listen(PORT, () => {
    logger.banner({
      trainNo: system.trainNo,
      totalSeats: system.totalSeats,
      maxWaiting: system.maxWaiting,
      url: `http://localhost:${PORT}`
    });
  });
  process.on('SIGINT', () => {
    logger.log('SYS', 'Shutting down — goodbye.');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 400);
  });
}

module.exports = { server, system };