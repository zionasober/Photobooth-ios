"use client";
import { useEffect, useRef, useState } from "react";

/** Sizes its text so the line fills the container width, like a justified magazine headline. */
function FitLine({ children, italic }: { children: string; italic?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const span = useRef<HTMLSpanElement>(null);
  const [fs, setFs] = useState(80);
  useEffect(() => {
    const fit = () => {
      const w = wrap.current, s = span.current;
      if (!w || !s) return;
      s.style.fontSize = "100px";
      const natural = s.getBoundingClientRect().width;
      if (natural > 0) setFs(Math.min(520, (w.clientWidth / natural) * 100));
    };
    fit();
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div ref={wrap} className="fit">
      <span ref={span} className={italic ? "it" : ""} style={{ fontSize: fs }}>{children}</span>
    </div>
  );
}

export default function Home({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="screen home">
      <header className="mast">
        <span>PHOTOBOOTH / NYC</span>
        <span className="hide-s">Vol. 01 — Automatic portraits</span>
        <span>4 frames · 1 take</span>
      </header>

      <section className="hero">
        <div className="headline">
          <FitLine>STRIKE</FitLine>
          <span className="overlay-a">a</span>
          <FitLine>POSE.</FitLine>
          <p className="sub">Four frames. No second takes.</p>
          <button className="cta cta-dark" onClick={onEnter}>
            <span>ENTER THE BOOTH</span>
            <span className="arrow" aria-hidden="true">→</span>
          </button>
          <p className="fine">Nothing is uploaded. Every photo stays in your browser.</p>
        </div>
      </section>
    </main>
  );
}
