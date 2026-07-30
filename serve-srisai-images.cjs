// Tiny CORS HTTP server for Sri Sai Ram Agencies SKU image upload.
// Serves:
//   GET /manifest.json                -> the SKU->files manifest
//   GET /img/<folder>/<file>          -> the image bytes
// All responses include Access-Control-Allow-Origin: *
//
// Usage: node serve-srisai-images.cjs [port]
//        default port 8080

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, 'Sri Sai Ram Agencies');
const IMAGES = path.join(ROOT, 'SKU_Images');
const MANIFEST = path.join(ROOT, 'manifest.json');

const PORT = parseInt(process.argv[2] || '8080', 10);

const TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
}

const server = http.createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const u = url.parse(req.url);
  let pathname = decodeURIComponent(u.pathname || '/');

  if (pathname === '/' || pathname === '/health') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('sri-sai image server: ok\n');
    return;
  }

  if (pathname === '/manifest.json') {
    fs.readFile(MANIFEST, (err, buf) => {
      if (err) { res.writeHead(500); res.end('manifest missing: ' + err.message); return; }
      res.writeHead(200, {'Content-Type': TYPES['.json']});
      res.end(buf);
    });
    return;
  }

  if (pathname.startsWith('/img/')) {
    const rel = pathname.slice('/img/'.length);
    // Defense: forbid traversal
    if (rel.includes('..')) { res.writeHead(400); res.end('bad path'); return; }
    const full = path.join(IMAGES, rel);
    if (!full.startsWith(IMAGES)) { res.writeHead(400); res.end('bad path'); return; }
    fs.readFile(full, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(full).toLowerCase();
      res.writeHead(200, {'Content-Type': TYPES[ext] || 'application/octet-stream'});
      res.end(buf);
    });
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Sri Sai image server: http://localhost:${PORT}`);
  console.log(`  /manifest.json`);
  console.log(`  /img/<folder>/<file>`);
});
