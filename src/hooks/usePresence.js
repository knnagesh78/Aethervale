import { useCallback, useEffect, useRef, useState } from 'react';
import { LANTERN_LIFETIME } from '../lib/sanctuary';
import { connectionUrls, hasHavenEndpoint, MAX_CONNECTION_FAILURES, reconnectDelay } from '../lib/connection';

export function usePresence(notify) {
  const [status, setStatus] = useState('connecting');
  const [count, setCount] = useState(1);
  const [lanterns, setLanterns] = useState([]);
  const [ripples, setRipples] = useState([]);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const ws = useRef(null);
  const pending = useRef(new Map());
  const own = useRef(new Set());
  const supported = useRef(new Set());
  const clockOffset = useRef(0);
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

  useEffect(() => {
    let stopped = false, retry, handshakeTimer, probeTimer, probeController, activeSocket, attempts = 0;
    setStatus('connecting');
    const rejectPending = () => { for (const { reject, timer } of pending.current.values()) { clearTimeout(timer); reject(new Error('The connection drifted away. Your words are still private. Please try again.')); } pending.current.clear(); };
    const failed = () => {
      if (stopped) return;
      setCount(1); rejectPending();
      if (++attempts >= MAX_CONNECTION_FAILURES) { setStatus('unavailable'); return; }
      setStatus('offline');
      retry = setTimeout(connect, reconnectDelay(attempts) + Math.random() * 500);
    };
    const connect = async () => {
      if (stopped) return;
      if (!navigator.onLine) { setStatus('unavailable'); return; }
      let endpoint;
      try { endpoint = connectionUrls(import.meta.env.VITE_WS_URL, location.href); }
      catch { setStatus('unavailable'); return; }
      if (endpoint.probeUrl) {
        probeController = new AbortController();
        probeTimer = setTimeout(() => probeController.abort(), 8000);
        try {
          const response = await fetch(endpoint.probeUrl, { cache: 'no-store', signal: probeController.signal });
          const available = await hasHavenEndpoint(response);
          if (stopped) return;
          // A static deployment can return the app HTML for /ws. Retrying a
          // WebSocket against that page can never work and floods the console.
          if (!available) { setStatus('unavailable'); setCount(1); return; }
        } catch { if (!stopped) failed(); return; }
        finally { clearTimeout(probeTimer); }
      }
      if (stopped) return;
      let socket;
      try { socket = new WebSocket(endpoint.socketUrl); }
      catch { setStatus('unavailable'); return; }
      activeSocket = socket;
      ws.current = socket;
      handshakeTimer = setTimeout(() => { if (!stopped) socket.close(); }, 12_000);
      socket.onopen = () => { if (stopped) { socket.close(); return; } socket.send(JSON.stringify({ type: 'visibility', active: !document.hidden })); };
      socket.onmessage = event => {
        if (stopped) return;
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'welcome') { clearTimeout(handshakeTimer); attempts = 0; setStatus('connected'); clockOffset.current = data.serverTime - Date.now(); setLanterns(data.lanterns); }
        if (data.type === 'presence') setCount(data.count);
        if (data.type === 'lantern') setLanterns(items => [...items.filter(l => l.id !== data.lantern.id), data.lantern].slice(-256));
        if (data.type === 'released') { own.current.add(data.id); setLanterns(items => [...items]); const p = pending.current.get(data.requestId); if (p) { clearTimeout(p.timer); p.resolve(data.id); pending.current.delete(data.requestId); } }
        if (data.type === 'ripple') setRipples(items => [...items.slice(-23), { ...data, localAt: Date.now() }]);
        if (data.type === 'supported') notifyRef.current('Someone held a little space for you.');
        if (data.type === 'error') { const p = pending.current.get(data.requestId); if (p) { clearTimeout(p.timer); p.reject(new Error(data.message)); pending.current.delete(data.requestId); } else notifyRef.current(data.message); }
      };
      socket.onclose = () => { clearTimeout(handshakeTimer); failed(); };
      socket.onerror = () => socket.close();
    };
    connect();
    const online = () => setConnectionAttempt(n => n + 1);
    window.addEventListener('online', online);
    const visibility = () => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'visibility', active: !document.hidden })); };
    document.addEventListener('visibilitychange', visibility);
    const pruning = setInterval(() => {
      const now = Date.now() + clockOffset.current;
      setLanterns(items => items.filter(l => { const live = now - l.createdAt < LANTERN_LIFETIME; if (!live) { own.current.delete(l.id); supported.current.delete(l.id); } return live; }));
      setRipples(items => items.filter(r => Date.now() - r.localAt < 4500));
    }, 2000);
    return () => { stopped = true; clearTimeout(retry); clearTimeout(handshakeTimer); clearTimeout(probeTimer); probeController?.abort(); clearInterval(pruning); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visibility); if (activeSocket?.readyState === WebSocket.OPEN) activeSocket.close(); rejectPending(); };
  }, [connectionAttempt]);

  const release = useCallback(() => new Promise((resolve, reject) => {
    if (ws.current?.readyState !== WebSocket.OPEN) { reject(new Error('The river is reconnecting. Take a breath and try again in a moment.')); return; }
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { pending.current.delete(requestId); reject(new Error('The river is taking a moment. Please try again.')); }, 8000);
    pending.current.set(requestId, { resolve, reject, timer });
    ws.current.send(JSON.stringify({ type: 'release', requestId }));
  }), []);
  const support = useCallback(id => {
    if (own.current.has(id)) { notifyRef.current('Your thought is on its way. You can let it go.'); return; }
    if (supported.current.has(id)) { notifyRef.current('Your kindness is already on its way.'); return; }
    if (ws.current?.readyState !== WebSocket.OPEN) { notifyRef.current('The river is reconnecting. Try again in a moment.'); return; }
    supported.current.add(id);
    setLanterns(items => [...items]);
    ws.current.send(JSON.stringify({ type: 'support', id }));
    notifyRef.current('A little kindness, sent downstream.');
  }, []);
  const incomingLantern = lanterns.find(l => !own.current.has(l.id) && !supported.current.has(l.id));
  const reconnect = useCallback(() => setConnectionAttempt(n => n + 1), []);
  return { status, count, lanterns, ripples, release, support, clockOffset, incomingLantern, reconnect };
}
