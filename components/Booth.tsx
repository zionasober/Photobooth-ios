"use client";
import { useEffect, useRef, useState } from "react";
import { FILMS, FilmId, RATIO, getFilm, processImageData, renderFrame } from "@/lib/film";
import { initAudio, shutter } from "@/lib/audio";
import type { Camera } from "@/lib/useCamera";

const LW = 432, LH = 540; // live preview resolution
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useFit(ref: React.RefObject<HTMLDivElement | null>) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = Math.floor(Math.min(el.clientHeight, el.clientWidth * RATIO));
      setS({ w: Math.floor(h / RATIO), h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return s;
}

interface Props {
  cam: Camera;
  filmId: FilmId;
  setFilmId: (f: FilmId) => void;
  onDone: (frames: HTMLCanvasElement[], mirror: boolean) => void;
  onExit: () => void;
  exiting?: boolean;
}

export default function Booth({ cam, filmId, setFilmId, onDone, onExit, exiting }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const size = useFit(stageRef);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rawRef = useRef<HTMLCanvasElement | null>(null);
  const thumbRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const film = getFilm(filmId);
  const filmRef = useRef(film);
  const freeze = useRef(false);
  const run = useRef(0);
  const mutedRef = useRef(false);

  const [phase, setPhase] = useState<"idle" | "shooting">("idle");
  const [count, setCount] = useState<number | null>(null);
  const [frameNo, setFrameNo] = useState(0);
  const [flash, setFlash] = useState(0);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);

  useEffect(() => { filmRef.current = film; }, [film]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => () => { run.current++; }, []);

  const mirrorLive = cam.facing === "user";

  // live preview: every pixel goes through the same film pipeline as the final photo
  useEffect(() => {
    if (!rawRef.current) {
      const c = document.createElement("canvas");
      c.width = LW; c.height = LH;
      rawRef.current = c;
    }
    const raw = rawRef.current;
    const rctx = raw.getContext("2d")!;
    let raf = 0, last = 0, tick = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 42 || freeze.current) return;
      const v = cam.videoRef.current, main = canvasRef.current;
      if (!v || !main || cam.status !== "on" || v.videoWidth === 0) return;
      last = t; tick++;
      const sw = v.videoWidth, sh = v.videoHeight;
      const cw = Math.min(sw, sh / RATIO), ch = cw * RATIO;
      rctx.save();
      if (mirrorLive) { rctx.translate(LW, 0); rctx.scale(-1, 1); }
      rctx.drawImage(v, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, LW, LH);
      rctx.restore();
      const mctx = main.getContext("2d", { willReadFrequently: true })!;
      mctx.drawImage(raw, 0, 0);
      const img = mctx.getImageData(0, 0, LW, LH);
      processImageData(img, filmRef.current, 0.7);
      mctx.putImageData(img, 0, 0);
      if (tick % 4 === 0) {
        FILMS.forEach((f, i) => {
          const tc = thumbRefs.current[i];
          if (!tc) return;
          const c = tc.getContext("2d", { willReadFrequently: true })!;
          c.drawImage(raw, 0, 0, tc.width, tc.height);
          const d = c.getImageData(0, 0, tc.width, tc.height);
          processImageData(d, f, 0.6);
          c.putImageData(d, 0, 0);
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cam.status, cam.videoRef, mirrorLive, phase]);

  function capture() {
    const v = cam.videoRef.current!;
    const sw = v.videoWidth, sh = v.videoHeight;
    const cw = Math.min(sw, sh / RATIO), ch = cw * RATIO;
    const ow = Math.min(Math.round(cw), 1000), oh = Math.round(ow * RATIO);
    const c = document.createElement("canvas");
    c.width = ow; c.height = oh;
    c.getContext("2d")!.drawImage(v, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, ow, oh);
    return c;
  }

  async function begin() {
    if (cam.status !== "on" || phase !== "idle") return;
    initAudio();
    const id = ++run.current;
    const alive = () => run.current === id;
    const mirror = cam.facing === "user";
    const frames: HTMLCanvasElement[] = [];
    setPhase("shooting");
    setThumbs([]);
    for (let i = 0; i < 4; i++) {
      setFrameNo(i + 1);
      for (const n of [3, 2, 1]) {
        setCount(n);
        await wait(1000);
        if (!alive()) return;
      }
      setCount(null);
      const c = capture();
      frames.push(c);
      freeze.current = true;
      setFlash((k) => k + 1);
      if (!mutedRef.current) shutter();
      setThumbs((t) => [...t, renderFrame(c, filmRef.current, 140, mirror, 0.7).toDataURL("image/jpeg", 0.85)]);
      await wait(i < 3 ? 650 : 900);
      if (!alive()) return;
      freeze.current = false;
    }
    cam.stop();
    onDone(frames, mirror);
  }

  const st = cam.status;
  return (
    <main className="screen booth">
      <header className="bar">
        <button className="link" onClick={onExit}>← EXIT</button>
        <span className="bar-title">PHOTOBOOTH / NYC</span>
        <span className="bar-r">
          {cam.canSwitch && st === "on" && phase === "idle" && (
            <button className="link" onClick={() => cam.start(cam.facing === "user" ? "environment" : "user")}>FLIP</button>
          )}
          <button className="link" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
        </span>
      </header>

      <div className="stage" ref={stageRef}>
        <div className="frame" style={{ width: size.w, height: size.h }}>
          <canvas ref={canvasRef} width={LW} height={LH} className="live" />
          <i className="crop tl" /><i className="crop tr" /><i className="crop bl" /><i className="crop br" />
          {st === "on" && (
            <>
              <span className="livetag"><i />LIVE</span>
              <span className="frameno">{phase === "shooting" ? `FRAME 0${frameNo} / 04` : "READY — 04 FRAMES"}</span>
            </>
          )}
          {count !== null && <div key={count} className="count" aria-live="assertive">{count}</div>}
          {flash > 0 && <div key={`f${flash}`} className="flash" />}
          {flash > 0 && <div key={`s${flash}`} className="shbars"><i /><i /></div>}
          {st !== "on" && !exiting && (
            <div className="msg">
              {st === "starting" && <p className="msg-k">Opening the shutter…</p>}
              {st === "off" && (<><h2>Camera’s off.</h2><button className="cta cta-light small" onClick={() => cam.start(cam.facing)}>TURN ON CAMERA</button></>)}
              {st === "denied" && (
                <>
                  <h2>We can’t see you.</h2>
                  <p>Camera access is blocked. Tap the camera or lock icon in your browser’s address bar and allow the camera — on iPhone, Settings → Safari → Camera. Then try again.</p>
                  <button className="cta cta-light small" onClick={() => cam.start(cam.facing)}>TRY AGAIN</button>
                </>
              )}
              {st === "unavailable" && (
                <>
                  <h2>No camera found.</h2>
                  <p>Connect one, or close any other app that’s using it, then try again.</p>
                  <button className="cta cta-light small" onClick={() => cam.start(cam.facing)}>TRY AGAIN</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="panel">
        {phase === "idle" ? (
          <>
            <div className="plabel"><span>01</span> Choose your film</div>
            <div className="films" role="radiogroup" aria-label="Film">
              {FILMS.map((f, i) => (
                <button key={f.id} role="radio" aria-checked={f.id === filmId}
                  className={"film" + (f.id === filmId ? " on" : "")} onClick={() => setFilmId(f.id)}>
                  <canvas ref={(el) => { thumbRefs.current[i] = el; }} width={96} height={120} />
                  <span className="fn">{f.name}</span>
                  <span className="fnote">{f.note}</span>
                </button>
              ))}
            </div>
            <div className="shutter-row">
              <button className="shutter" onClick={begin} disabled={st !== "on"} aria-label="Let’s do this — start the photo session">
                <i className="dome" />
              </button>
              <div className="shtext">
                <span className="shlabel">LET’S DO THIS</span>
                <span className="lamps" aria-hidden="true">
                  <span className="lamp on"><i />POWER</span>
                  <span className={"lamp" + (st === "on" ? " on" : "")}><i />CAMERA</span>
                  <span className="lamp"><i />FILM</span>
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="plabel"><span>02</span> Contact sheet</div>
            <div className="sheet">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="slot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumbs[i] ? <img src={thumbs[i]} alt={`Frame ${i + 1}`} /> : <em>0{i + 1}</em>}
                </div>
              ))}
            </div>
            <p className="hold">Hold still. Or don’t.</p>
          </>
        )}
      </aside>
    </main>
  );
}
