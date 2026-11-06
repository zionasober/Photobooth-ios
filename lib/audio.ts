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
export function shutter(vol = 1) {
  if (!ctx) return;
  click(0, 0.05, 3200, 0.9 * vol);
  click(0.09, 0.07, 1800, 0.7 * vol);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(140, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.12);
  g.gain.setValueAtTime(0.35 * vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
  o.connect(g).connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + 0.15);
}

/** Quiet vintage printer: a low motor hum, soft stepper ticks while feeding, and a gentle clunk when done. */
export function createPrinterAudio(enabled: () => boolean) {
  let m: { g: GainNode; src: AudioScheduledSourceNode[] } | null = null;
  return {
    motor(on: boolean) {
      if (!ctx) return;
      if (on && !m && enabled()) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 0.4);
        g.connect(ctx.destination);
        const o = ctx.createOscillator();
        o.type = "sawtooth"; o.frequency.value = 47;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 170;
        o.connect(lp).connect(g); o.start();
        const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const ch = nb.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        const ns = ctx.createBufferSource();
        ns.buffer = nb; ns.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = 650; bp.Q.value = 0.8;
        const ng = ctx.createGain(); ng.gain.value = 0.22;
        ns.connect(bp).connect(ng).connect(g); ns.start();
        m = { g, src: [o, ns] };
      } else if (!on && m) {
        const { g, src } = m;
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
        src.forEach((s) => s.stop(ctx!.currentTime + 0.3));
        m = null;
      }
    },
    tick() { if (ctx && enabled()) click(0, 0.018, 1300 + Math.random() * 500, 0.2); },
    done() {
      if (!ctx || !enabled()) return;
      click(0, 0.05, 900, 0.45);
      click(0.07, 0.06, 500, 0.3);
    },
    stop() { this.motor(false); },
  };
}
