import { useCallback, useEffect, useRef, useState } from 'react';

function createSoundscape() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('Audio is unavailable in this browser.');
  const context = new AudioContext();
  const master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
  const noise = context.createBuffer(1, context.sampleRate * 6, context.sampleRate);
  const channel = noise.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < channel.length; i++) { brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02; channel[i] = brown * 3.5; }
  const sources = [];
  const layer = (frequency, gain, type = 'lowpass') => {
    const source = context.createBufferSource(); source.buffer = noise; source.loop = true;
    const filter = context.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency; filter.Q.value = 0.4;
    const volume = context.createGain(); volume.gain.value = gain;
    source.connect(filter); filter.connect(volume); volume.connect(master); source.start(Math.random()); sources.push(source); return volume;
  };
  layer(460, 0.5); layer(1800, 0.16, 'bandpass');
  const fire = layer(850, 0.08, 'highpass');
  [130.81, 196, 261.63, 293.66].forEach((frequency, i) => {
    const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    const volume = context.createGain(); volume.gain.value = 0.008;
    const lfo = context.createOscillator(); lfo.frequency.value = 0.045 + i * 0.011;
    const depth = context.createGain(); depth.gain.value = 0.005; lfo.connect(depth); depth.connect(volume.gain);
    oscillator.connect(volume); volume.connect(master); oscillator.start(); lfo.start(); sources.push(oscillator, lfo);
  });
  // Tiny filtered noise grains create a soft fire crackle without audio files.
  const crackle = setInterval(() => {
    if (context.state !== 'running') return;
    const grain = context.createBufferSource(); grain.buffer = noise;
    const envelope = context.createGain(); envelope.gain.setValueAtTime(0, context.currentTime);
    envelope.gain.linearRampToValueAtTime(fire.gain.value * 0.35, context.currentTime + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    grain.connect(envelope); envelope.connect(master); grain.start(0, Math.random() * 4, 0.15);
    grain.onended = () => { grain.disconnect(); envelope.disconnect(); };
  }, 650);
  return { context, master, fire, close: () => { clearInterval(crackle); sources.forEach(s => s.stop()); context.close(); } };
}

export function useSoundscape(count, notify) {
  const engine = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const toggle = useCallback(async () => {
    try {
      if (!engine.current) engine.current = createSoundscape();
      const { context, master } = engine.current;
      if (context.state === 'suspended') await context.resume();
      const next = !enabled;
      master.gain.setTargetAtTime(next ? 0.65 : 0, context.currentTime, 0.5);
      setEnabled(next);
    } catch { notify('Sound isn’t available here yet. The quiet is yours, too.'); }
  }, [enabled, notify]);
  useEffect(() => {
    if (engine.current) engine.current.fire.gain.setTargetAtTime(Math.min(0.22, 0.06 + Math.log2(count + 1) * 0.025), engine.current.context.currentTime, 3);
  }, [count, enabled]);
  useEffect(() => {
    const visibility = () => {
      const audio = engine.current;
      if (audio) audio.master.gain.setTargetAtTime(!document.hidden && enabled ? 0.65 : 0, audio.context.currentTime, 0.5);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [enabled]);
  useEffect(() => () => { engine.current?.close(); engine.current = null; }, []);
  return { enabled, toggle };
}
