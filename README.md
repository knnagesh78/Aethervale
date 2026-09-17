# The Echo-Haven

A little space to just be. A complete React and Three.js sanctuary with a procedural floating island, a shared lantern river, a warm hearth, and a garden that grows when you rest.

## Run locally

Requires Node.js 22.12+ (Node.js 24 recommended).

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. This starts Vite and the anonymous WebSocket server together. No account, API keys, database, downloaded 3D models, or external media services are needed. Two browser tabs can demonstrate shared lanterns and support.

```sh
npm run build       # production client in dist/
npm start           # HTTP + WebSockets on http://localhost:3001
npm test            # real WebSocket integration and logic tests
npm run lint
npm run test:e2e    # browser interaction, privacy, idle, and mobile tests
```

Browser tests use installed Microsoft Edge by default. On other systems, install a Playwright browser with `npx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. The browser test runner starts the development servers if they are not already running. Screenshots are written to `artifacts/`.

## Experience

- **Wander:** drag or swipe to orbit; scroll or pinch to move closer. WASD or arrow keys move the camera's focus through a bounded glade. Orbit and zoom limits keep the visitor within the island view. This is a third-person orbit sanctuary, not a first-person walking simulator.
- **Release river:** click the wooden dock or “Let go.” Type up to 240 characters, then release. The thought stays in browser memory and is cleared on release/close. Only a randomly identified lantern travels to the server. Every connected visitor sees the lantern on the same two-minute path. Clicking another visitor's lantern sends rings of light upstream and a private, silent acknowledgment to its sender.
- **Shared hearth:** flame density, light intensity, ambient crackle, and nearby orbs respond to active visible browser connections. No numerical attendance is shown. There is no persistent identity, so multiple tabs count as multiple presences.
- **Slow garden:** after two minutes without pointer, touch, wheel, or keyboard activity in a visible tab, one flower grows. Further uninterrupted intervals add flowers up to a small garden of twelve. Switching away resets the current interval. Movement never removes existing flowers. The garden is local to the current visit and does not survive reload.
- **Sound:** explicitly enable the Web Audio soundscape. Filtered noise creates wind and water, sine chords create a soft harmonic bed, and short noise grains create gentle crackle. No microphone permission or audio files. Sound fades when the tab is hidden.
- **Atmosphere:** the automatic day-to-night-to-day cycle lasts twelve minutes. The sun control also selects dusk, moonlight, or daylight. The operating system's reduced-motion preference disables decorative sway and CSS animations.

## Code map

```text
src/
  App.jsx                       Canvas, minimal HUD, accessible native dialogs
  main.jsx                      Entry point and bundled local fonts
  styles.css                    Sage glass UI, responsive layout, motion preferences
  scene/
    SanctuaryScene.jsx          Procedural island, forest, river, camera, atmosphere
    InteractiveObjects.jsx      Dock, lanterns, support ripples, hearth, growing garden
  hooks/
    usePresence.js              WebSockets, acknowledgment, retries, synchronized clock
    useStillness.js             Visible-tab idle detection and permanent session blooms
    useSoundscape.js            Procedural ambient audio and audio lifecycle
  lib/sanctuary.js               Shared lifetimes, bounds, deterministic helpers
  lib/connection.js              Endpoint validation and bounded retry policy
server/
  WebSocketServer.js             Static production host and anonymous live protocol
api/
  ws.js                         Vercel HTTP server export for live connections
vercel.json                     Existing-domain routing and function configuration
tests/
  connection.test.js            Secure endpoint URLs and deployment capability checks
  server.test.js                Multi-client integration, origin/payload/rate limits
  sanctuary.test.js             Idle thresholds, camera bounds, path and seed checks
  browser/haven.spec.js         Desktop/mobile end-to-end interaction and privacy
```

Stack: React 19.2, React Three Fiber 9, Drei 10, Three.js, Tailwind CSS 4, Vite, Node.js, and `ws`. The lockfile pins the resolved dependency tree. React is constrained below 19.3 to match Fiber's supported peer range. See the [Fiber installation guide](https://r3f.docs.pmnd.rs/getting-started/installation) and [Tailwind Vite setup](https://tailwindcss.com/docs/installation/using-vite).

## Privacy and protocol

There are no tracking cookies, local storage identifiers, accounts, analytics, or public metrics. Fonts and all assets are served locally. Worry text is never included in a WebSocket payload. The server generates a fresh connection ID and keeps only temporary presence, lantern, and duplicate-support state in memory. Lanterns expire after two minutes; server restart clears all shared state. The app does not log IPs, requests, thoughts, or connection identifiers. Hosting providers or reverse proxies may keep their own access logs; configure them separately if you require no infrastructure logs.

Client events: `release {requestId}`, `support {id}`, `visibility {active}`. Server events: `welcome {clientId, serverTime, lanterns}`, `presence {count}`, `lantern {lantern}`, `released {requestId,id}`, `ripple {id,at}`, `supported {id}`, `error {message,requestId?}`. Counts are transport state used only to render warmth. Support is one per connection per lantern; owners cannot support their own lights. Reconnecting creates a new anonymous presence. No tracking identity is added to prevent reconnection-based duplicate support.

The server limits payloads to 1 KB, messages to 40 per minute per connection, releases to one per ten seconds, active lanterns to 256, and simultaneous connections to 500. It sends heartbeat pings, prunes expired lanterns, checks browser origins, and bounds outgoing buffers. These lightweight controls suit a small shared sanctuary; deploy edge connection/rate limits for a public service exposed to hostile traffic.

## Production deployment

### Existing Vercel project and domain

Keep the existing **aethervale-mu.vercel.app** project and any custom domain already attached to it. The repository now includes `api/ws.js`, an exported HTTP server for Vercel Functions, and `vercel.json`, which enables Fluid Compute and routes `/ws` to that function. Vercel supports WebSockets with Fluid Compute; see the [official WebSocket documentation](https://vercel.com/docs/functions/websockets).

1. Push these changes to the Git branch connected to the existing Vercel project and let Vercel redeploy it. No new project or domain is needed.
2. The checked-in settings select Vite, `npm run build`, and the `dist` output folder. The function starts through its server export; **do not** use `npm start` as the Vercel build command.
3. Leave `VITE_WS_URL` unset for this same-domain deployment. Remove any old localhost or unrelated backend override and redeploy if one is set. If `ALLOWED_ORIGINS` is configured, include `https://aethervale-mu.vercel.app` and each intended custom/preview origin exactly.
4. After deployment, open `https://aethervale-mu.vercel.app/ws`. It must return JSON containing `service: "echo-haven"` and `protocol: 1`, not the app HTML or a 404 page. Browser WebSocket requests to the same `/ws` URL should upgrade with status 101, and the app should show “Here, together. Quietly.”

The function duration is 300 seconds. The client reconnects and reloads the river when a healthy connection closes. Failed upgrades use bounded backoff, and an unavailable endpoint displays a manual Retry action. A preflight check prevents endless WebSocket attempts against a static HTML page; typed thoughts stay in the open dialog while reconnecting, and releasing is enabled only after the server handshake succeeds.

**Shared-state limitation:** Vercel may route visitors or reconnects to different function instances. This server's in-memory river is shared only by visitors on the same instance. A single global river and global presence across instances require an external state/pub-sub adapter such as Redis; this patch adds the missing endpoint but does not configure or provision an external database. For one guaranteed shared river without that adapter, run the included standalone server and point `VITE_WS_URL` to it while keeping the website and domain on Vercel.

### Standalone Node or Docker hosting

Build once, then run `npm start`. The Node server serves `dist/`, `/health`, and `/ws` from one origin. `npm run preview` previews the client only; use `npm start` to test a full production deployment. For Vercel, use the function deployment above.

Set environment variables through your host or shell (the `.env.example` file documents them):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP and WebSocket port |
| `HOST` | `0.0.0.0` | Listen address |
| `ALLOWED_ORIGINS` | same request host | Comma-separated exact browser origins, e.g. `https://haven.example.com` |
| `VITE_WS_URL` | same-origin `/ws` | Optional alternative WebSocket endpoint; set before build |

Terminate HTTPS at a reverse proxy. Forward the `Host`, `Upgrade`, and `Connection` headers and permit idle WebSocket connections for at least 90 seconds. Set `ALLOWED_ORIGINS` explicitly when the proxy changes the Host header. Same-origin HTTPS automatically uses `wss://`. The server adds security headers and immutable caching for versioned assets. Do not embed secrets into `VITE_` variables.

```sh
docker build -t echo-haven .
docker run --rm -p 3001:3001 -e ALLOWED_ORIGINS=https://haven.example.com echo-haven
```

This release uses **one server instance** for one shared sanctuary. Multiple independent replicas would create separate rivers; add Redis pub/sub (and a shared expiry store) before scaling horizontally. The Docker runtime is unprivileged and has a health check. TLS, domain setup, proxy limits, and uptime monitoring belong to the deployment environment.

## Rendering and accessibility

The island, low-poly foliage, river, grass, lanterns, and particles are generated in code. Repeated trunks, tree crowns, grass, stones, water streaks, and lanterns use instanced drawing. All 256 possible lanterns need only three draw calls. Unbloomed flower meshes remain hidden. Shadows use one 1024px map; pixel ratio is capped at 1.5; dynamic point lights do not cast shadows. Hidden tabs stop rendering and fade audio. No postprocessing or heavy texture/model downloads are required. Frustum culling stays enabled, with fixed bounds encompassing the moving lanterns. Frame rate depends on device, browser, thermal load, and visitor activity; 60 FPS is a target, not a measured guarantee across mobile hardware.

All spatial interactions also have labeled HTML buttons. Native dialogs provide focus containment, Escape dismissal, and focus return. Toasts and garden blooms have polite live announcements. The page includes reduced-motion handling, muted-by-default sound, touch controls, and a fallback when WebGL initialization fails. Browser speech/voice input is not used.

This is a quiet, nonclinical experience, not a treatment tool. The app avoids exposing strangers' distress, counts, ranking, or urgency mechanics.
