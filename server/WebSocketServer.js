import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { LANTERN_LIFETIME } from '../src/lib/sanctuary.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws: wss:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

export function createHavenServer({ allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean), heartbeatMs = 30_000 } = {}) {
  const lanterns = new Map();
  const peers = new Map();
  const server = http.createServer(async (req, res) => {
    Object.entries(securityHeaders).forEach(([k, v]) => res.setHeader(k, v));
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ status: 'ok' }));
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
      if (file === root || !path.extname(file)) file = path.join(root, 'index.html');
      const info = await stat(file);
      if (!info.isFile()) throw new Error('Not a file');
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch { res.writeHead(404); res.end('The path is quiet. Please return to the sanctuary.'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 65_536) ws.send(JSON.stringify(data)); };
  const broadcast = (data) => { for (const ws of peers.keys()) send(ws, data); };
  const presence = () => broadcast({ type: 'presence', count: [...peers.values()].filter(p => p.active).length });
  const prune = () => { for (const [id, l] of lanterns) if (Date.now() - l.createdAt >= LANTERN_LIFETIME) lanterns.delete(id); };
  const publicLantern = ({ id, createdAt, hue }) => ({ id, createdAt, hue });

  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    let accepted = !origin;
    try { accepted ||= allowedOrigins.includes(origin) || (allowedOrigins.length === 0 && new URL(origin).host === req.headers.host); } catch { /* Reject malformed origins. */ }
    if (req.url !== '/ws' || !accepted || peers.size >= 500) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
  });

  wss.on('connection', ws => {
    prune();
    const peer = { id: randomUUID(), active: true, alive: true, window: Date.now(), messages: 0, lastRelease: 0, supported: new Set() };
    peers.set(ws, peer);
    send(ws, { type: 'welcome', clientId: peer.id, serverTime: Date.now(), lanterns: [...lanterns.values()].map(publicLantern) });
    presence();
    ws.on('pong', () => { peer.alive = true; });
    ws.on('error', () => { /* No identifiers or personal data are logged. */ });
    ws.on('message', raw => {
      if (Date.now() - peer.window > 60_000) { peer.window = Date.now(); peer.messages = 0; }
      if (++peer.messages > 40) { send(ws, { type: 'error', message: 'Let’s take a small breath before trying again.' }); return; }
      let message;
      try { message = JSON.parse(raw.toString()); } catch { send(ws, { type: 'error', message: 'That message could not find its way here.' }); return; }
      if (!message || typeof message !== 'object' || Array.isArray(message)) return;
      if (message.type === 'visibility' && typeof message.active === 'boolean') { peer.active = message.active; presence(); }
      if (message.type === 'release') {
        if (Date.now() - peer.lastRelease < 10_000) { send(ws, { type: 'error', requestId: message.requestId, message: 'Let this lantern drift a little further. Try again in a few moments.' }); return; }
        if (typeof message.requestId !== 'string' || message.requestId.length > 64) return;
        prune();
        if (lanterns.size >= 256) { send(ws, { type: 'error', requestId: message.requestId, message: 'The river is full for a moment. Please try again shortly.' }); return; }
        peer.lastRelease = Date.now();
        const lantern = { id: randomUUID(), owner: peer.id, createdAt: Date.now(), hue: 30 + Math.floor(Math.random() * 18) };
        lanterns.set(lantern.id, lantern);
        // Deliberately never read, retain, or forward worry text.
        broadcast({ type: 'lantern', lantern: publicLantern(lantern) });
        send(ws, { type: 'released', requestId: message.requestId, id: lantern.id });
      }
      if (message.type === 'support' && typeof message.id === 'string') {
        prune();
        const lantern = lanterns.get(message.id);
        if (!lantern || lantern.owner === peer.id || peer.supported.has(lantern.id)) return;
        if (peer.supported.size >= 256) peer.supported.delete(peer.supported.values().next().value);
        peer.supported.add(lantern.id);
        broadcast({ type: 'ripple', id: lantern.id, at: Date.now() });
        for (const [ownerWs, p] of peers) if (p.id === lantern.owner) send(ownerWs, { type: 'supported', id: lantern.id });
      }
    });
    ws.on('close', () => { peers.delete(ws); presence(); });
  });
  const heartbeat = setInterval(() => {
    prune();
    for (const [ws, peer] of peers) {
      if (!peer.alive) { ws.terminate(); continue; }
      peer.alive = false;
      ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();
  server.on('close', () => clearInterval(heartbeat));
  return { server, wss, close: async () => { clearInterval(heartbeat); for (const ws of peers.keys()) ws.terminate(); await new Promise(resolve => wss.close(resolve)); if (server.listening) await new Promise(resolve => server.close(resolve)); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const haven = createHavenServer();
  const port = Number(process.env.PORT || 3001);
  haven.server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Echo-Haven is listening on http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await haven.close(); process.exit(0); });
}
