const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = parseInt(process.env.PORT || '5000', 10);
const BUILD_DIR = path.join(__dirname, '..', 'build');
const FALLBACK_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>HugoHerbots.ai</title></head><body><p>Loading...</p></body></html>';

let cachedIndexHtml = null;
try {
  cachedIndexHtml = fs.readFileSync(path.join(BUILD_DIR, 'index.html'));
  console.log(`[Production] index.html cached (${cachedIndexHtml.length} bytes)`);
} catch (e) {
  console.warn('[Production] index.html not found, using fallback');
}

const server = http.createServer(handleRequest);

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

const PORT_3002_PREFIXES = [
  '/api/v2/', '/api/session/', '/api/sessions/', '/api/user/',
  '/api/technieken/', '/api/heygen/', '/api/livekit/', '/api/health/',
  '/api/live-sessions/', '/api/roleplay/', '/api/live/',
];

function handleRequest(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;
  } catch (e) {
    pathname = req.url.split('?')[0];
  }

  if (pathname === '/' || pathname === '' || pathname === '/healthz' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(cachedIndexHtml || FALLBACK_HTML);
    return;
  }

  if (PORT_3002_PREFIXES.some(p => pathname.startsWith(p))) {
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
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(cachedIndexHtml || FALLBACK_HTML);
      });
      res.writeHead(200, { 'Content-Type': contentType });
      stream.pipe(res);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(cachedIndexHtml || FALLBACK_HTML);
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
      res.end(JSON.stringify({ error: `Service on port ${targetPort} starting up` }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

server.on('upgrade', (req, socket, head) => {
  let pathname;
  try { pathname = new URL(req.url, `http://localhost:${PORT}`).pathname; } catch(e) { pathname = req.url; }

  if (pathname.startsWith('/ws/')) {
    const proxyReq = http.request({
      hostname: '127.0.0.1', port: 3002, path: req.url, method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:3002' },
    });
    proxyReq.on('upgrade', (proxyRes, proxySocket) => {
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
        '\r\n\r\n'
      );
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });
    proxyReq.on('error', () => socket.destroy());
    proxyReq.end();
  } else {
    socket.destroy();
  }
});

function spawnService(name, command, args) {
  console.log(`[Production] Starting ${name}...`);
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

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
    console.error(`[Production] ${name} exited (code=${code}, signal=${signal}). Restarting in 5s...`);
    setTimeout(() => spawnService(name, command, args), 5000);
  });
}

process.on('SIGTERM', () => { console.log('[Production] SIGTERM'); process.exit(0); });
process.on('SIGINT', () => { console.log('[Production] SIGINT'); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error('[Production] Uncaught exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Production] Unhandled rejection:', reason);
});
