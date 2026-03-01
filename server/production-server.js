const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const BUILD_DIR = path.join(__dirname, '..', 'build');

let cachedIndexHtml = null;
try {
  cachedIndexHtml = fs.readFileSync(path.join(BUILD_DIR, 'index.html'));
} catch (e) {
  console.warn('[Production] index.html not found at startup, will retry on request');
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.py': 'text/plain',
};

function proxyRequest(req, res, targetPort) {
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy] Error proxying to port ${targetPort}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Backend on port ${targetPort} unavailable` }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

const PORT_3002_PREFIXES = [
  '/api/v2/',
  '/api/session/',
  '/api/sessions/',
  '/api/user/',
  '/api/technieken/',
  '/api/heygen/',
  '/api/livekit/',
  '/api/health/',
  '/api/live-sessions/',
  '/api/roleplay/',
  '/api/live/',
];

function shouldProxyTo3002(pathname) {
  return PORT_3002_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function shouldProxyTo3001(pathname) {
  return pathname.startsWith('/api/');
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    serveIndex(res);
  });
  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
}

const FALLBACK_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>HugoHerbots.ai</title></head><body><p>Loading...</p></body></html>';

function serveIndex(res) {
  if (cachedIndexHtml) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(cachedIndexHtml);
    return;
  }
  const indexPath = path.join(BUILD_DIR, 'index.html');
  fs.readFile(indexPath, (err, data) => {
    if (err) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(FALLBACK_HTML);
      return;
    }
    cachedIndexHtml = data;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/healthz' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (pathname === '/' || pathname === '') {
    return serveIndex(res);
  }

  if (shouldProxyTo3002(pathname)) {
    return proxyRequest(req, res, 3002);
  }

  if (shouldProxyTo3001(pathname)) {
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
      serveFile(filePath, res);
    } else {
      serveIndex(res);
    }
  });
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/ws/')) {
    const options = {
      hostname: '127.0.0.1',
      port: 3002,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:3002' },
    };

    const proxyReq = http.request(options);
    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n` +
        Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
        '\r\n\r\n'
      );
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });

    proxyReq.on('error', (err) => {
      console.error('[WS Proxy] Error:', err.message);
      socket.destroy();
    });

    proxyReq.end();
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Production] Static + proxy server running on port ${PORT}`);
  console.log(`[Production] Serving build from: ${BUILD_DIR}`);
  console.log(`[Production] Health check: /health, /healthz`);
  console.log(`[Production] index.html cached: ${cachedIndexHtml ? 'YES' : 'NO (will use fallback)'}`);
  console.log(`[Production] API proxy: /api/v2/* -> :3002, /api/* -> :3001`);
  console.log(`[Production] WebSocket proxy: /ws/* -> :3002`);
});
