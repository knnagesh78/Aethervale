import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionUrls, hasHavenEndpoint, reconnectDelay } from '../src/lib/connection.js';

test('production connection stays on the existing Vercel or custom HTTPS domain', () => {
  for (const domain of ['aethervale-mu.vercel.app', 'haven.example.com']) {
    assert.deepEqual(connectionUrls(undefined, `https://${domain}/`), { socketUrl: `wss://${domain}/ws`, probeUrl: `https://${domain}/ws` });
  }
  assert.equal(connectionUrls(undefined, 'http://localhost:5173/').socketUrl, 'ws://localhost:5173/ws');
  assert.equal(connectionUrls(' /api/ws ', 'https://haven.example.com/').socketUrl, 'wss://haven.example.com/api/ws');
});

test('external backend override works without requiring an HTTP CORS probe', () => {
  assert.deepEqual(connectionUrls('wss://backend.example.com/ws', 'https://haven.example.com'), { socketUrl: 'wss://backend.example.com/ws', probeUrl: null });
  assert.throws(() => connectionUrls('ws://backend.example.com/ws', 'https://haven.example.com'));
  assert.throws(() => connectionUrls('ftp://backend.example.com/ws', 'https://haven.example.com'));
});

test('detects static HTML fallbacks and malformed responses before opening a WebSocket', async () => {
  assert.equal(await hasHavenEndpoint(new Response('<html>app</html>', { headers: { 'Content-Type': 'text/html' } })), false);
  assert.equal(await hasHavenEndpoint(new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })), false);
  assert.equal(await hasHavenEndpoint(new Response('invalid', { headers: { 'Content-Type': 'application/json' } })), false);
  assert.equal(await hasHavenEndpoint(Response.json({ service: 'other', protocol: 1 })), false);
  assert.equal(await hasHavenEndpoint(Response.json({ service: 'echo-haven', protocol: 1 })), true);
  assert.equal(reconnectDelay(1), 1500);
  assert.equal(reconnectDelay(20), 30_000);
});
