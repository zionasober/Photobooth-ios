let ctx: AudioContext | null = null;

/** Call from a user gesture (click) so the browser allows audio. */
export function initAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* audio is optional */ }
}

function click(at: number, dur: number, freq: number, gain: number) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + at);
}

/** Mechanical leaf-shutter: two clicks and a soft thunk. */
export function shutter() {
  if (!ctx) return;
  click(0, 0.05, 3200, 0.9);
  click(0.09, 0.07, 1800, 0.7);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.12);
  g.gain.setValueAtTime(0.35, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
  o.connect(g).connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + 0.15);
}
