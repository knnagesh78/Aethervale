import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createHavenServer } from '../server/WebSocketServer.js';

async function setup(t, options) {
  const haven = createHavenServer(options);
  await new Promise(resolve => haven.server.listen(0, '127.0.0.1', resolve));
  t.after(() => haven.close());
  const port = haven.server.address().port;
  return { ...haven, url: `ws://127.0.0.1:${port}/ws`, origin: `http://127.0.0.1:${port}` };
}

function client(url, options) {
  const socket = new WebSocket(url, options);
  const messages = [];
  socket.on('message', raw => messages.push(JSON.parse(raw.toString())));
  const wait = (predicate, timeout = 2000) => new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const index = messages.findIndex(predicate);
      if (index >= 0) { clearInterval(timer); resolve(messages.splice(index, 1)[0]); }
      else if (Date.now() - start > timeout) { clearInterval(timer); reject(new Error('Expected WebSocket event did not arrive')); }
    }, 5);
  });
  return { socket, messages, wait, send: data => socket.send(JSON.stringify(data)) };
}

test('two visitors share ephemeral lanterns and private support without transmitting worries', async t => {
  const haven = await setup(t);
  const a = client(haven.url), b = client(haven.url);
  await Promise.all([a.wait(m => m.type === 'welcome'), b.wait(m => m.type === 'welcome')]);
  assert.equal((await a.wait(m => m.type === 'presence' && m.count === 2)).count, 2);
  a.send({ type: 'release', requestId: 'first', text: 'THIS MUST NEVER BE FORWARDED' });
  const release = await a.wait(m => m.type === 'released');
  const lantern = (await b.wait(m => m.type === 'lantern')).lantern;
  assert.equal(lantern.id, release.id);
  assert.deepEqual(Object.keys(lantern).sort(), ['createdAt', 'hue', 'id']);
  b.send({ type: 'support', id: lantern.id });
  assert.equal((await a.wait(m => m.type === 'supported')).id, lantern.id);
  await b.wait(m => m.type === 'ripple');
  b.send({ type: 'support', id: lantern.id });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(b.messages.filter(m => m.type === 'ripple').length, 0, 'one support per visitor per lantern');
  const c = client(haven.url);
  const welcome = await c.wait(m => m.type === 'welcome');
  assert.equal(welcome.lanterns.length, 1);
  assert.ok(!JSON.stringify(welcome).includes('THIS MUST'));
  b.send({ type: 'visibility', active: false });
  await a.wait(m => m.type === 'presence' && m.count === 2);
  c.socket.close();
  await a.wait(m => m.type === 'presence' && m.count === 1);
});

test('rate limits release requests and ignores self-support', async t => {
  const haven = await setup(t);
  const a = client(haven.url);
  await a.wait(m => m.type === 'welcome');
  a.send({ type: 'release', requestId: 'a' });
  const { id } = await a.wait(m => m.type === 'released');
  a.send({ type: 'release', requestId: 'b' });
  assert.equal((await a.wait(m => m.type === 'error')).requestId, 'b');
  a.send({ type: 'support', id });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(a.messages.filter(m => m.type === 'ripple' || m.type === 'supported').length, 0);
  a.socket.send('{bad json');
  assert.match((await a.wait(m => m.type === 'error')).message, /message/);
});

test('rejects cross-origin browser connections and oversized payloads', async t => {
  const haven = await setup(t);
  const rejected = new WebSocket(haven.url, { origin: 'https://untrusted.example' });
  await new Promise(resolve => rejected.on('error', resolve));
  const a = client(haven.url, { origin: haven.origin });
  await a.wait(m => m.type === 'welcome');
  const closed = new Promise(resolve => a.socket.on('close', code => resolve(code)));
  a.socket.send('x'.repeat(2048));
  assert.equal(await closed, 1009);
});

test('health endpoint reveals no user metrics or identifiers', async t => {
  const haven = await setup(t);
  const response = await fetch(`${haven.origin}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('set-cookie'), null);
});
