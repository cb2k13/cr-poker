import { useRef, useCallback } from 'react';

function getCtx(ref) {
  if (!ref.current) {
    ref.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ref.current.state === 'suspended') ref.current.resume();
  return ref.current;
}

// Reusable noise buffer helper
function makeNoise(ctx, durationSec) {
  const len = Math.floor(ctx.sampleRate * durationSec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Single clay-chip click: high-freq transient + short resonant ring
function chipClick(ctx, t, vol = 1) {
  // Transient — shaped noise through a highpass
  const nLen = Math.floor(ctx.sampleRate * 0.055);
  const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (nLen * 0.08));
  const nSrc = ctx.createBufferSource();
  nSrc.buffer = nBuf;

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3200;

  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.55 * vol, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

  nSrc.connect(hp); hp.connect(nGain); nGain.connect(ctx.destination);
  nSrc.start(t);

  // Resonant body — sine with slight pitch drop
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1500, t);
  osc.frequency.exponentialRampToValueAtTime(950, t + 0.045);

  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0, t);
  oGain.gain.linearRampToValueAtTime(0.13 * vol, t + 0.003);
  oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

  osc.connect(oGain); oGain.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.09);
}

export function useSounds() {
  const ctxRef = useRef(null);

  // Card sliding across felt: bandpass-filtered noise swish + brief snap
  const playDeal = useCallback(() => {
    try {
      const ctx = getCtx(ctxRef);
      const t = ctx.currentTime;

      // Swish — mid-range noise shaped like a card sweep
      const swishSrc = ctx.createBufferSource();
      swishSrc.buffer = makeNoise(ctx, 0.2);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3800;
      bp.Q.value = 0.65;

      const shelf = ctx.createBiquadFilter();
      shelf.type = 'highshelf';
      shelf.frequency.value = 5500;
      shelf.gain.value = 5;

      const swishGain = ctx.createGain();
      swishGain.gain.setValueAtTime(0, t);
      swishGain.gain.linearRampToValueAtTime(0.45, t + 0.013);   // fast attack
      swishGain.gain.exponentialRampToValueAtTime(0.001, t + 0.19); // tail off

      swishSrc.connect(bp); bp.connect(shelf); shelf.connect(swishGain);
      swishGain.connect(ctx.destination);
      swishSrc.start(t);

      // Snap at the landing point (~90ms in)
      const snapLen = Math.floor(ctx.sampleRate * 0.025);
      const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
      const sd = snapBuf.getChannelData(0);
      for (let i = 0; i < snapLen; i++) sd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snapLen * 0.15));
      const snapSrc = ctx.createBufferSource();
      snapSrc.buffer = snapBuf;

      const snapHp = ctx.createBiquadFilter();
      snapHp.type = 'highpass';
      snapHp.frequency.value = 5000;

      const snapGain = ctx.createGain();
      snapGain.gain.setValueAtTime(0.3, t + 0.09);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      snapSrc.connect(snapHp); snapHp.connect(snapGain);
      snapGain.connect(ctx.destination);
      snapSrc.start(t + 0.09);
    } catch {}
  }, []);

  // Clay chip click: crisp transient + resonant ring
  const playChip = useCallback(() => {
    try {
      const ctx = getCtx(ctxRef);
      chipClick(ctx, ctx.currentTime, 1);
    } catch {}
  }, []);

  // Pot rake: rapid cascade of chip clicks, escalating in pace
  const playWin = useCallback(() => {
    try {
      const ctx = getCtx(ctxRef);
      const delays = [0, 0.07, 0.13, 0.185, 0.23, 0.265, 0.295];
      delays.forEach((d, i) => {
        const vol = 0.6 + i * 0.07;  // get louder as chips pile up
        chipClick(ctx, ctx.currentTime + d, vol);
      });
    } catch {}
  }, []);

  // Card slap face-down: low thud + brief paper rustle
  const playFold = useCallback(() => {
    try {
      const ctx = getCtx(ctxRef);
      const t = ctx.currentTime;

      // Low thud — pitched sine decaying fast
      const thud = ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(200, t);
      thud.frequency.exponentialRampToValueAtTime(55, t + 0.11);

      const thudGain = ctx.createGain();
      thudGain.gain.setValueAtTime(0.28, t);
      thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

      thud.connect(thudGain); thudGain.connect(ctx.destination);
      thud.start(t); thud.stop(t + 0.12);

      // Paper rustle — bandpass noise, short
      const rustleSrc = ctx.createBufferSource();
      rustleSrc.buffer = makeNoise(ctx, 0.07);

      const rustle = ctx.createBiquadFilter();
      rustle.type = 'bandpass';
      rustle.frequency.value = 2200;
      rustle.Q.value = 0.8;

      const rustleGain = ctx.createGain();
      rustleGain.gain.setValueAtTime(0.18, t);
      rustleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      rustleSrc.connect(rustle); rustle.connect(rustleGain);
      rustleGain.connect(ctx.destination);
      rustleSrc.start(t);
    } catch {}
  }, []);

  return { playDeal, playChip, playWin, playFold };
}
