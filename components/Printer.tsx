"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FilmId, getFilm } from "@/lib/film";
import { getFonts, renderStrip, type StripOpts } from "@/lib/strip";
import { createPrinterAudio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/useReducedMotion";

const SLICES = 10; // the strip is built from slices so the lower end can curl naturally

interface Props {
  frames: HTMLCanvasElement[];
  mirror: boolean;
  filmId: FilmId;
  seed: number;
  sound: boolean;
  setSound: (v: boolean) => void;
  onCollect: () => void;
  onExit: () => void;
}

const bend = (i: number) => (i <= 0 ? 0 : 0.4 + 4.8 * Math.pow(i / (SLICES - 1), 2));
const cum = (i: number) => { let t = 0; for (let k = 1; k <= i; k++) t += bend(k); return t; };
const tone = (deg: number) => Math.min(0.2, deg * 0.0085);

/** One slice of the strip; each is nested in the previous and bent a little further, so the paper curls.
 *  Shading runs continuously from one slice into the next so there are no visible bands. */
function Slice({ i, url }: { i: number; url: string }) {
  const style = {
    backgroundImage: `url(${url})`,
    backgroundSize: `100% ${SLICES * 100}%`,
    backgroundPosition: `0 ${(i / (SLICES - 1)) * 100}%`,
    transform: i === 0 ? undefined : `rotateX(${bend(i)}deg)`,
    ["--a" as string]: tone(cum(i)).toFixed(3),
    ["--b" as string]: tone(cum(i + 1)).toFixed(3),
  } as React.CSSProperties;
  return (
    <div className="sl" style={style}>
      {i < SLICES - 1 && <Slice i={i + 1} url={url} />}
    </div>
  );
}

const ease = (u: number) => u * 0.55 + (0.5 - 0.5 * Math.cos(Math.PI * u)) * 0.45;

export default function Printer({ frames, mirror, filmId, seed, sound, setSound, onCollect, onExit }: Props) {
  const reduced = useReducedMotion();
  const [strip, setStrip] = useState<{ url: string; ratio: number; fr: number[] } | null>(null);
  const [phase, setPhase] = useState<"wait" | "feeding" | "done" | "collecting">("wait");
  const [out, setOut] = useState(false);
  const moveRef = useRef<HTMLDivElement>(null);
  const devRef = useRef<HTMLDivElement>(null);
  const soundRef = useRef(sound);
  const audio = useRef<ReturnType<typeof createPrinterAudio> | null>(null);
  const drag = useRef<{ y: number; dy: number; moved: boolean } | null>(null);
  const alive = useRef(true);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; audio.current?.stop(); }; }, []);

  // The printed strip is the same render the final PNG uses (same film, border, layout, seed).
  useEffect(() => {
    let dead = false;
    let url = "";
    (async () => {
      const opts: StripOpts = {
        film: getFilm(filmId), border: "white", layout: "classic", showDate: true, caption: "", mirror, date: new Date(), seed,
      };
      const P = 420;
      const c = await renderStrip(frames, opts, P, getFonts());
      const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.93));
      if (dead || !blob) return;
      url = URL.createObjectURL(blob);
      const m = P * 0.07, gap = P * 0.03, pH = Math.round(P * 1.25);
      const fr = [0, 1, 2, 3].map((i) => Math.min(1, (m + (i + 1) * pH + i * gap) / c.height));
      setStrip({ url, ratio: c.width / c.height, fr });
    })();
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [frames, filmId, mirror, seed]);

  // Feed the paper: constant slow speed, a pause as each photo clears the slot, tiny mechanical wobble.
  useEffect(() => {
    if (!strip) return;
    const el = moveRef.current, dev = devRef.current;
    if (!el || !dev) return;
    if (reduced) {
      el.style.transform = "none";
      dev.style.opacity = "0";
      const id = window.setTimeout(() => setPhase("done"), 500);
      return () => clearTimeout(id);
    }
    const a = createPrinterAudio(() => soundRef.current);
    audio.current = a;
    const PRE = 1700, FULL = 5600, PAUSE = 460;
    const marks = [...strip.fr, 1];
    const segs: { t0: number; t1: number; p0: number; p1: number }[] = [];
    let t = PRE, prev = 0;
    marks.forEach((m, i) => {
      const dur = (m - prev) * FULL;
      segs.push({ t0: t, t1: t + dur, p0: prev, p1: m });
      t += dur + (i < 3 ? PAUSE : i === 3 ? 320 : 0);
      prev = m;
    });
    const total = t;
    let raf = 0, started = false, finished = false, lastTick = 0, motorOn = false;
    const t00 = performance.now();
    const loop = (now: number) => {
      const e = now - t00;
      let p = 0, moving = false;
      for (const s of segs) {
        if (e >= s.t0 && e < s.t1) { p = s.p0 + (s.p1 - s.p0) * ease((e - s.t0) / (s.t1 - s.t0)); moving = true; break; }
        if (e >= s.t1) p = s.p1;
      }
      if (!started && e >= PRE) { started = true; setPhase("feeding"); }
      const wob = moving ? (Math.sin(now * 0.09) + Math.sin(now * 0.23)) * 0.28 : 0;
      const rot = moving ? Math.sin(now * 0.05) * 0.07 : 0;
      el.style.transform = `translate3d(${wob}px, ${-(1 - p) * 100}%, 0) rotate(${rot}deg)`;
      if (moving !== motorOn) { motorOn = moving; a.motor(moving); }
      if (moving && now - lastTick > 62) { lastTick = now; a.tick(); }
      dev.style.opacity = String(0.55 * (1 - Math.min(1, Math.max(0, (e - PRE) / (total - PRE + 1500)))));
      if (e >= total && !finished) {
        finished = true;
        a.motor(false);
        a.done();
        if (alive.current) setPhase("done");
      }
      if (!finished || e < total + 1800) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); a.stop(); };
  }, [strip, reduced]);

  const collect = useCallback((fromY: number) => {
    if (phase !== "done") return;
    setPhase("collecting");
    const el = moveRef.current;
    if (el) {
      el.getAnimations().forEach((x) => x.cancel());
      el.animate(
        [
          { transform: `translate3d(0, ${fromY}px, 0) scale(1) rotate(0deg)` },
          { transform: `translate3d(0, ${fromY + 90}px, 0) scale(1.16) rotate(-1.4deg)` },
        ],
        { duration: reduced ? 1 : 900, easing: "cubic-bezier(0.3, 0, 0.2, 1)", fill: "forwards" },
      );
    }
    window.setTimeout(() => { if (alive.current) setOut(true); }, reduced ? 0 : 650);
    window.setTimeout(() => { if (alive.current) onCollect(); }, reduced ? 350 : 1250);
  }, [phase, reduced, onCollect]);

  const down = (e: React.PointerEvent) => {
    if (phase !== "done") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, dy: 0, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, el = moveRef.current;
    if (!d || !el) return;
    d.dy = Math.max(0, e.clientY - d.y) * 0.85;
    if (d.dy > 6) d.moved = true;
    el.style.transform = `translate3d(0, ${d.dy}px, 0) rotate(${d.dy * 0.012}deg)`;
  };
  const up = () => {
    const d = drag.current, el = moveRef.current;
    drag.current = null;
    if (!d || !el) return;
    if (!d.moved || d.dy > 50) collect(d.dy);
    else el.style.transform = "none";
  };

  const done = phase === "done" || phase === "collecting";
  const style = { ["--ratio" as string]: strip?.ratio ?? 0.19 } as React.CSSProperties;
  return (
    <main className={"screen printer" + (out ? " out" : "") + (phase === "collecting" ? " collecting" : "")} style={style}>
      <header className="bar">
        <button className="link" onClick={onExit}>← EXIT</button>
        <span className="bar-title">PHOTOBOOTH / NYC</span>
        <span className="bar-r">
          <button className="link" onClick={() => setSound(!sound)} aria-pressed={sound}>{sound ? "SOUND ON" : "SOUND OFF"}</button>
        </span>
      </header>

      <div className="mach">
        <div className={"psign" + (done ? " ready" : "")} role="status" aria-live="polite">
          <i />{done ? "TAKE YOUR PHOTOS." : <>PRINTING<span className="dots"><b>.</b><b>.</b><b>.</b></span></>}
        </div>

        <div className="pplate">
          <span className="stamp l">4 FRAMES</span>
          <span className="stamp r">N°001</span>
          <i className="pled" />
          <div className="pslot" />
        </div>

        <div
          className={"pfeed" + (phase === "done" ? " ready" : "")}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); collect(0); } }}
          role={phase === "done" ? "button" : undefined} tabIndex={phase === "done" ? 0 : -1}
          aria-label="Collect your photo strip"
        >
          <div className="pmove" ref={moveRef} style={{ transform: "translate3d(0,-100%,0)" }}>
            <div className={"psway" + (phase === "done" && !reduced ? " hang" : "")}>
              <div className="pcurl">{strip && <Slice i={0} url={strip.url} />}</div>
              <div className="pdev" ref={devRef} />
              <div className="psheen" />
            </div>
          </div>
          <div className="pshadow" />
        </div>
      </div>

      <p className={"phint" + (phase === "done" ? " on" : "")}>Click or drag the strip to collect it</p>
    </main>
  );
}
