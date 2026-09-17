export const MAX_CONNECTION_FAILURES = 4;

export function connectionUrls(configuredUrl, pageUrl) {
  const page = new URL(pageUrl);
  const socket = new URL(configuredUrl?.trim() || '/ws', page);
  if (socket.protocol === 'https:') socket.protocol = 'wss:';
  if (socket.protocol === 'http:') socket.protocol = 'ws:';
  if (!['ws:', 'wss:'].includes(socket.protocol) || (page.protocol === 'https:' && socket.protocol !== 'wss:')) throw new Error('Invalid or insecure WebSocket endpoint');
  if (socket.pathname === '/') socket.pathname = '/ws';
  socket.hash = '';
  const probe = new URL(socket);
  probe.protocol = socket.protocol === 'wss:' ? 'https:' : 'http:';
  // Custom external backends may not allow cross-origin HTTP probes. Their
  // WebSocket connection still uses the same bounded retry policy.
  return { socketUrl: socket.href, probeUrl: probe.origin === page.origin ? probe.href : null };
}

export async function hasHavenEndpoint(response) {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return false;
  try { const data = await response.json(); return data?.service === 'echo-haven' && data.protocol === 1; } catch { return false; }
}

export function reconnectDelay(failures) {
  return Math.min(30_000, 1500 * 2 ** Math.max(0, failures - 1));
}
