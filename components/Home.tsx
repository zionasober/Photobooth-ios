"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

/** Sizes its text so the line fills the container width, like a justified magazine headline. */
function FitLine({ children }: { children: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const span = useRef<HTMLSpanElement>(null);
  const [fs, setFs] = useState(80);
  useEffect(() => {
    const fit = () => {
      const w = wrap.current, s = span.current;
      if (!w || !s) return;
      s.style.fontSize = "100px";
      const natural = s.getBoundingClientRect().width;
      if (natural > 0) {
        const next = Math.min(520, (w.clientWidth / natural) * 100);
        s.style.fontSize = `${next}px`; // restore immediately; React state alone would skip an unchanged value
        setFs(next);
      }
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div ref={wrap} className="fit">
      <span ref={span} style={{ fontSize: fs }}>{children}</span>
    </div>
  );
}

interface Props {
  onEnter: () => void;
  leaving: boolean;
  flash: boolean;
  setFlash: (v: boolean) => void;
  sound: boolean;
  setSound: (v: boolean) => void;
}

export default function Home({ onEnter, leaving, flash, setFlash, sound, setSound }: Props) {
  const reduced = useReducedMotion();
  return (
    <main className={"home" + (leaving ? " leaving" : "")}>
      <header className="mast">
        <span>PHOTOBOOTH / NYC</span>
        <span className="vacant"><i />VACANT</span>
        <span>N°001</span>
      </header>

      <section className="hero">
        <div className="headline">
          <FitLine>STRIKE</FitLine>
          <span className="overlay-a">a</span>
          <FitLine>POSE.</FitLine>
          <p className="sub">Four frames. No second takes.</p>
          <button className="cta cta-cream" onClick={onEnter} disabled={leaving}>
            <span>ENTER THE BOOTH</span>
            <span className="arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <footer className="foot">
        {!reduced ? (
          <button className="link" onClick={() => setFlash(!flash)} aria-pressed={flash}>FLASHES {flash ? "ON" : "OFF"}</button>
        ) : <span />}
        <span className="fine">Nothing is uploaded. Every photo stays in your browser.</span>
        <button className="link" onClick={() => setSound(!sound)} aria-pressed={sound}>SOUND {sound ? "ON" : "OFF"}</button>
      </footer>
    </main>
  );
}
