import { useEffect, useRef, useState } from 'react';
import { stillnessGrowth, STILLNESS_INTERVAL } from '../lib/sanctuary';

export function useStillness(onBloom) {
  const [flowers, setFlowers] = useState(0);
  const [resting, setResting] = useState(false);
  const activity = useRef(performance.now());
  const bloomCallback = useRef(onBloom);
  useEffect(() => { bloomCallback.current = onBloom; }, [onBloom]);
  useEffect(() => {
    let lastPointer = null;
    const reset = event => {
      if (event.type === 'pointermove') {
        if (lastPointer && Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) < 4) return;
        lastPointer = { x: event.clientX, y: event.clientY };
      }
      activity.current = performance.now();
      setResting(false);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(type => window.addEventListener(type, reset, { passive: true }));
    document.addEventListener('visibilitychange', reset);
    const interval = setInterval(() => {
      if (document.hidden) { activity.current = performance.now(); return; }
      const elapsed = performance.now() - activity.current;
      setResting(elapsed > 12_000);
      if (elapsed >= STILLNESS_INTERVAL) {
        const now = performance.now(), lastActivity = activity.current;
        setFlowers(previous => stillnessGrowth(now, lastActivity, previous, !document.hidden));
        activity.current = performance.now();
      }
    }, 1000);
    return () => { clearInterval(interval); events.forEach(type => window.removeEventListener(type, reset)); document.removeEventListener('visibilitychange', reset); };
  }, []);
  useEffect(() => { if (flowers > 0) bloomCallback.current('Something beautiful grew while you were simply here.'); }, [flowers]);
  return { flowers, resting };
}
