import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ArrowDown, ArrowUpRight, CircleHelp, Compass, Flame, Leaf, Moon, MoveUpRight, RotateCcw, Send, ShieldCheck, Sparkles, Sprout, Sun, Sunset, Volume2, VolumeX, Wind, X } from 'lucide-react';
import { usePresence } from './hooks/usePresence';
import { useStillness } from './hooks/useStillness';
import { useSoundscape } from './hooks/useSoundscape';

const SanctuaryScene = lazy(() => import('./scene/SanctuaryScene'));
const VISITS = [
  { id: 'explore', label: 'Wander', icon: Compass },
  { id: 'release', label: 'Let go', icon: Wind },
  { id: 'hearth', label: 'Find warmth', icon: Flame },
  { id: 'garden', label: 'Simply be', icon: Sprout },
];
const COPY = {
  explore: { eyebrow: 'A LITTLE SPACE TO JUST BE', first: 'Nothing to do.', second: 'Nowhere to rush.', body: 'Let the world grow quiet for a while.\nYou don’t have to earn your rest.' },
  release: { eyebrow: 'THE RELEASE RIVER', first: 'Set it down.', second: 'Let it drift.', body: 'Some things feel lighter\nonce you stop holding them alone.' },
  hearth: { eyebrow: 'THE SHARED HEARTH', first: 'A little warmth.', second: 'A little closer.', body: 'Quiet company, wherever you are.\nThere’s a place for you by the fire.' },
  garden: { eyebrow: 'THE SLOW GARDEN', first: 'Less doing.', second: 'More being.', body: 'When you find stillness, life finds a way.\nStay a while. Something will grow.' },
};

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? <div className="scene-fallback"><Sprout size={38} strokeWidth={1} /><h2>A quieter view, for now.</h2><p>Your browser couldn’t open the 3D sanctuary.<br />You can still let a thought go or take a moment to rest.</p><button className="soft-button" onClick={() => location.reload()}><RotateCcw size={15} /> Try the view again</button></div> : this.props.children; }
}

function BrandMark() {
  return <svg width="38" height="38" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 35c8 0 9-8 17-8s9 8 17 8M13 40h22M24 10v19M24 23c-9 0-12-6-12-11 8 0 12 5 12 11Zm0-6c1-7 6-10 12-10 1 6-4 12-12 13" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Dialog({ kind, close, presence, notify, flowers }) {
  const ref = useRef();
  const [thought, setThought] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const connected = presence.status === 'connected';
  const heading = kind === 'release' ? 'What can you let go of?' : kind === 'hearth' ? (connected ? 'You’re in good company.' : 'A little warmth, just for you.') : kind === 'garden' ? 'Let stillness take root.' : 'A softer place to land.';
  useEffect(() => { const node = ref.current; node.showModal(); return () => node.close(); }, []);
  const release = async event => {
    event.preventDefault(); if (!thought.trim() || busy) return;
    setBusy(true); setError('');
    try { await presence.release(); setThought(''); notify('A little lighter. Your lantern is on its way.'); close(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <dialog className={`haven-dialog ${kind === 'help' ? 'help-dialog' : ''}`} ref={ref} aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } }}>
    <button className="dialog-close icon-button" aria-label="Close dialog" onClick={close}><X size={18} /></button>
    <div className={`dialog-emblem ${kind === 'hearth' ? 'amber' : ''}`}>{kind === 'release' ? <Wind size={25} strokeWidth={1.2} /> : kind === 'hearth' ? <Flame size={26} strokeWidth={1.2} /> : kind === 'garden' ? <Sprout size={26} strokeWidth={1.2} /> : <Leaf size={26} strokeWidth={1.2} />}</div>
    <p className="eyebrow">{kind === 'help' ? 'WELCOME TO ECHO-HAVEN' : 'A SMALL MOMENT, JUST FOR YOU'}</p>
    <h2 id="dialog-title">{heading}</h2>
    {kind === 'release' && <form onSubmit={release}>
      <p>You don’t need the perfect words. Give a thought to the river and let it travel on.</p>
      <label className="sr-only" htmlFor="thought">A thought to release</label>
      <textarea id="thought" autoFocus maxLength={240} value={thought} onChange={e => setThought(e.target.value)} placeholder="I’ve been carrying…" rows={4} disabled={busy} />
      <div className="thought-meta"><span>Only you can read your words.</span><span>{thought.length}/240</span></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!connected && <p className="connection-help">The shared river is {presence.status === 'connecting' ? 'connecting' : 'temporarily unavailable'}. Your words stay here.{presence.status === 'unavailable' && <button type="button" className="reconnect-button" onClick={presence.reconnect}>Try connecting again</button>}</p>}
      <button className="primary-button" type="submit" disabled={!thought.trim() || busy || !connected}>{busy ? 'Giving it to the river…' : 'Release this thought'}<Send size={15} strokeWidth={1.4} /></button>
      <p className="privacy-note"><ShieldCheck size={13} /> Your words disappear. Only the light is shared.</p>
    </form>}
    {kind === 'hearth' && <div className="dialog-content"><p>{connected ? 'This fire grows a little warmer as people find their way here. No introductions needed. Just a shared moment.' : 'The live connection is taking a pause. You can still settle by the fire and enjoy a quiet moment of your own.'}</p><div className="hearth-illustration"><Flame size={54} strokeWidth={0.8} /><span /><span /><span /></div><p className="italic-note">{connected ? 'Somewhere, someone is slowing down with you.' : 'There’s no hurry. The warmth is still here.'}</p><button className="primary-button" onClick={close}>Stay by the fire<ArrowDown size={15} /></button><p className="privacy-note">No names. No numbers. Just a little warmth.</p></div>}
    {kind === 'garden' && <div className="dialog-content"><p>Set your hands down. After two quiet minutes, a flower will begin to grow. There’s no timer to watch, and nothing to lose.</p><div className="breathing-garden"><span /><span /><Sprout size={36} strokeWidth={1} /></div><p className="italic-note">{flowers ? 'Your stillness has already made something beautiful.' : 'Breathe in gently. Let the breath go.'}</p><button className="primary-button" onClick={close}>Make room for stillness<Leaf size={15} /></button><p className="privacy-note">Keep this tab open. Your flowers stay when you move.</p></div>}
    {kind === 'help' && <div className="dialog-content"><p>A small sanctuary for the moments when the world feels a little too loud. There’s no right way to be here.</p><div className="help-places"><div><Wind size={20} /><span><strong>Let a thought drift</strong>Write it down. Release a lantern. Send kindness to a passing light.</span></div><div><Flame size={20} /><span><strong>Share the quiet</strong>Find company in a hearth that warms with every visitor.</span></div><div><Sprout size={20} /><span><strong>Grow by doing less</strong>Two minutes of stillness invite a flower to bloom.</span></div></div><div className="help-controls"><span>Drag to look around</span><span>Scroll or pinch to move closer</span><span>W A S D to wander</span></div><p className="privacy-note">No accounts, cookies, analytics, or saved thoughts.</p><button className="primary-button" onClick={close}>I’m happy to be here<ArrowUpRight size={15} /></button></div>}
  </dialog>;
}

export default function App() {
  const [view, setView] = useState('explore');
  const [dialog, setDialog] = useState(null);
  const [lighting, setLighting] = useState('auto');
  const [toast, setToast] = useState('');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(!document.hidden);
  const [sceneReady, setSceneReady] = useState(false);
  const onReady = useCallback(() => setSceneReady(true), []);
  const toastTimer = useRef();
  const notify = useCallback(message => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 6500); }, []);
  const presence = usePresence(notify);
  const { flowers, resting } = useStillness(notify);
  const audio = useSoundscape(presence.count, notify);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = event => setReducedMotion(event.matches);
    const visibility = () => setVisible(!document.hidden);
    motion.addEventListener('change', change); document.addEventListener('visibilitychange', visibility);
    return () => { motion.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility); clearTimeout(toastTimer.current); };
  }, []);
  const visit = useCallback(id => { setView(id); if (id !== 'explore') setDialog(id); else setDialog(null); }, []);
  const cycleLight = () => setLighting(previous => ({ auto: 'dusk', dusk: 'night', night: 'day', day: 'auto' })[previous]);
  const LightIcon = lighting === 'night' ? Moon : lighting === 'dusk' ? Sunset : Sun;
  const lightLabel = { auto: 'Golden hour', day: 'Daylight', dusk: 'Soft dusk', night: 'Moonlight' }[lighting];
  const copy = COPY[view];
  return <main className={`haven-app ${lighting === 'night' ? 'is-night' : ''}`}>
    <div className="world" aria-label="Interactive floating island sanctuary">
      <SceneBoundary onError={onReady}><Canvas shadows dpr={[1, 1.5]} frameloop={visible ? 'always' : 'never'} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} aria-label="A low-poly floating island with a forest, river, campfire, and garden" fallback={<div className="scene-fallback"><Sprout size={32} /><p>The 3D view needs WebGL. You can still use the quiet spaces below.</p></div>}><color attach="background" args={['#dce5d7']} /><Suspense fallback={null}><SanctuaryScene view={view} lighting={lighting} reducedMotion={reducedMotion} presence={presence} flowers={flowers} resting={resting} onVisit={visit} onReady={onReady} /></Suspense></Canvas></SceneBoundary>
    </div>
    <div className="world-wash" aria-hidden="true" />
    <div className="sun-halo" aria-hidden="true" />
    {!sceneReady && <div className="loading-scene" aria-live="polite"><Sprout size={30} strokeWidth={1} /><span>Finding your quiet corner…</span></div>}

    <header className="site-header">
      <button className="brand" aria-label="Echo-Haven, return to sanctuary overview" onClick={() => visit('explore')}><BrandMark /><span>the echo-haven<span className="brand-period">.</span></span></button>
      <span className="header-note"><span className="tiny-line" /> a gentler kind of online</span>
      <div className="header-actions">
        <button className={`sound-button ${audio.enabled ? 'is-playing' : ''}`} onClick={audio.toggle} aria-label={audio.enabled ? 'Mute ambient sound' : 'Enable ambient sound'} aria-pressed={audio.enabled}>{audio.enabled ? <Volume2 size={17} strokeWidth={1.5} /> : <VolumeX size={17} strokeWidth={1.5} />}<span>Sound {audio.enabled ? 'on' : 'off'}</span>{audio.enabled && <span className="sound-bars"><i /><i /><i /></span>}</button>
        <button className="icon-button help-button" aria-label="About this sanctuary" onClick={() => setDialog('help')}><CircleHelp size={20} strokeWidth={1.3} /></button>
      </div>
    </header>

    <section className="intro" key={view} aria-label="Welcome to your sanctuary">
      <div className="eyebrow intro-eyebrow"><span className="little-star">✳</span>{copy.eyebrow}</div>
      <h1>{copy.first}<br /><em>{copy.second}</em></h1>
      <p>{copy.body}</p>
      <div className="presence-note"><span className={`presence-dot ${presence.status}`} />{presence.status === 'connected' ? 'Here, together. Quietly.' : presence.status === 'connecting' ? 'Finding a quiet connection…' : presence.status === 'unavailable' ? 'Live connection unavailable. Your quiet space is still here.' : 'Reconnecting. Your quiet space is still here.'}{presence.status === 'unavailable' && <button className="reconnect-button" onClick={presence.reconnect} aria-label="Retry live connection"><RotateCcw size={12} /><span>Retry</span></button>}</div>
      {presence.status === 'connected' && presence.incomingLantern && <button className="incoming-kindness" onClick={() => presence.support(presence.incomingLantern.id)} aria-label="Send kindness to a passing lantern"><Sparkles size={13} /> A passing light. Send a little kindness <span>↗</span></button>}
    </section>

    <div className="weather-control"><button onClick={cycleLight} aria-label={`Lighting: ${lightLabel}. Change atmosphere`}><LightIcon size={16} strokeWidth={1.3} /><span>{lightLabel}</span><span className="weather-separator">/</span><span className="weather-mood">a softer pace</span></button></div>

    <div className="bottom-hud">
      <div className="rest-note"><span className="rest-icon"><Leaf size={17} strokeWidth={1.2} /></span><div><span>{resting ? 'Let the quiet settle in.' : 'You can just be here.'}</span><small>{resting ? 'Your garden is taking its time.' : 'Nothing to finish. Nothing to prove.'}</small></div></div>
      <nav className="sanctuary-nav" aria-label="Sanctuary places">{VISITS.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => visit(id)} className={view === id ? 'active' : ''} aria-current={view === id ? 'location' : undefined}><Icon size={17} strokeWidth={1.5} /><span>{label}</span>{view === id && <span className="nav-active-dot" />}</button>)}</nav>
      <div className="view-hint"><span className="drag-symbol"><MoveUpRight size={15} strokeWidth={1.2} /><MoveUpRight size={15} strokeWidth={1.2} /></span><span>Drag to wander<small>Scroll to get a little closer</small></span></div>
    </div>

    <footer className="site-footer"><span>A QUIET CORNER OF THE INTERNET</span><span>No profiles. No pressure. Just presence.<Sprout size={13} strokeWidth={1.3} /></span></footer>
    <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast && <><Sparkles size={16} strokeWidth={1.4} /><span>{toast}</span></>}</div>
    {dialog && <Dialog kind={dialog} close={() => setDialog(null)} presence={presence} flowers={flowers} notify={notify} />}
    <span className="sr-only" aria-live="polite">{flowers ? 'Flowers are growing in your garden.' : ''}</span>
  </main>;
}
