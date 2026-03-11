const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.PORT || '5000', 10);
const BUILD_DIR = path.join(__dirname, '..', 'build');
const FALLBACK_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>HugoHerbots.ai</title></head><body><p>Loading...</p></body></html>';

function getIndexHtml() {
  try {
    return fs.readFileSync(path.join(BUILD_DIR, 'index.html'));
  } catch {
    return FALLBACK_HTML;
  }
}

const server = http.createServer(handleRequest);
server.requestTimeout = 600000; // 10 min — allow long compression + upload operations
server.timeout = 0; // no idle timeout

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Production] READY on port ${PORT} — health check will pass`);

  setTimeout(() => {
    spawnService('video-processor', 'node', [path.join(__dirname, 'video-processor.js')]);
  }, 3000);

  setTimeout(() => {
    spawnService('hugo-engine', 'node', [path.join(__dirname, 'hugo-engine', 'standalone.js')]);
  }, 5000);
});

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.py': 'text/plain',
};

// Extensions that benefit from gzip compression
const COMPRESSIBLE_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.svg', '.py']);

function getCacheControl(pathname, ext) {
  // Vite hashed assets — immutable, cache forever
  if (pathname.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  // Images — cache for 1 day
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(ext)) {
    return 'public, max-age=86400';
  }
  // Fonts — cache for 1 year (they rarely change)
  if (['.woff', '.woff2', '.ttf'].includes(ext)) {
    return 'public, max-age=31536000, immutable';
  }
  // HTML — always revalidate so deploys are instant
  if (ext === '.html') {
    return 'no-cache';
  }
  // Default — short cache
  return 'public, max-age=3600';
}

function supportsGzip(req) {
  const accept = req.headers['accept-encoding'] || '';
  return accept.includes('gzip');
}

const PORT_3002_PREFIXES = [
  '/api/v2/', '/api/v3/', '/api/session/', '/api/sessions/', '/api/user/',
  '/api/technieken/', '/api/heygen/', '/api/livekit/', '/api/health/',
  '/api/live-sessions/', '/api/roleplay/', '/api/live/',
  '/api/admin-video/', '/api/liveavatar/', '/api/tavus/',
  '/api/stripe/',
];

function handleRequest(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  } catch (e) {
    pathname = req.url.split('?')[0];
  }

  if (pathname === '/' || pathname === '' || pathname === '/healthz' || pathname === '/health') {
    const headers = { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' };
    const body = getIndexHtml();
    if (supportsGzip(req)) {
      zlib.gzip(body, (err, compressed) => {
        if (err) { res.writeHead(200, headers); res.end(body); return; }
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        res.end(compressed);
      });
    } else {
      res.writeHead(200, headers);
      res.end(body);
    }
    return;
  }

  if (PORT_3002_PREFIXES.some(p => pathname.startsWith(p) || pathname + '/' === p)) {
    return proxyRequest(req, res, 3002);
  }

  if (pathname.startsWith('/api/')) {
    return proxyRequest(req, res, 3001);
  }

  const filePath = path.join(BUILD_DIR, pathname);
  const normalizedPath = path.resolve(filePath);
  if (!normalizedPath.startsWith(path.resolve(BUILD_DIR))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const headers = {
        'Content-Type': contentType,
        'Cache-Control': getCacheControl(pathname, ext),
      };
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
        res.end(getIndexHtml());
      });
      // Gzip compressible text-based files
      if (COMPRESSIBLE_EXTENSIONS.has(ext) && supportsGzip(req)) {
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        stream.pipe(zlib.createGzip()).pipe(res);
      } else {
        res.writeHead(200, headers);
        stream.pipe(res);
      }
    } else {
      // SPA fallback — serve index.html for client-side routes
      const headers = { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' };
      const body = getIndexHtml();
      if (supportsGzip(req)) {
        zlib.gzip(body, (gzErr, compressed) => {
          if (gzErr) { res.writeHead(200, headers); res.end(body); return; }
          headers['Content-Encoding'] = 'gzip';
          headers['Vary'] = 'Accept-Encoding';
          res.writeHead(200, headers);
          res.end(compressed);
        });
      } else {
        res.writeHead(200, headers);
        res.end(body);
      }
    }
  });
}

function proxyRequest(req, res, targetPort) {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `Service on port ${targetPort} starting up`, error: `Service on port ${targetPort} starting up` }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

server.on('upgrade', (req, socket, head) => {
  let pathname;
  try { pathname = new URL(req.url, `http://localhost:${PORT}`).pathname; } catch(e) { pathname = req.url; }

  console.log(`[Production] WebSocket upgrade: ${pathname}`);

  if (pathname.startsWith('/ws/')) {
    const proxyReq = http.request({
      hostname: '127.0.0.1', port: 3002, path: req.url, method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:3002' },
    });
    proxyReq.on('upgrade', (proxyRes, proxySocket) => {
      console.log(`[Production] WebSocket upgrade success: ${pathname}`);
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
        '\r\n\r\n'
      );
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });
    proxyReq.on('error', (err) => {
      console.error(`[Production] WebSocket proxy error for ${pathname}:`, err.message);
      socket.destroy();
    });
    proxyReq.end();
  } else {
    socket.destroy();
  }
});

const children = [];
let shuttingDown = false;

function spawnService(name, command, args) {
  if (shuttingDown) return;
  console.log(`[Production] Starting ${name}...`);
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  children.push(child);

  child.stdout.on('data', (data) => {
    data.toString().trim().split('\n').forEach(line => {
      if (line.trim()) console.log(`[${name}] ${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    data.toString().trim().split('\n').forEach(line => {
      if (line.trim()) console.error(`[${name}] ${line}`);
    });
  });

  child.on('exit', (code, signal) => {
    const idx = children.indexOf(child);
    if (idx !== -1) children.splice(idx, 1);
    if (shuttingDown) return;
    console.error(`[Production] ${name} exited (code=${code}, signal=${signal}). Restarting in 5s...`);
    setTimeout(() => spawnService(name, command, args), 5000);
  });
}

function gracefulShutdown(signal) {
  console.log(`[Production] ${signal} — shutting down children...`);
  shuttingDown = true;
  children.forEach(child => {
    try { child.kill('SIGTERM'); } catch {}
  });
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('[Production] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Production] Unhandled rejection:', reason);
});
