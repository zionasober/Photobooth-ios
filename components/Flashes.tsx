"use client";
import { useCallback, useEffect, useRef } from "react";
import { shutter } from "@/lib/audio";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Paparazzi flashes: brief, irregular, pointer-events: none.
 * Each flash is a white burst plus a warm "screen" layer that lights up the velvet folds.
 * Fire one manually with window.dispatchEvent(new CustomEvent("pb-flash", { detail: { i, x, y, s } })).
 */
export default function Flashes({ enabled, sound }: { enabled: boolean; sound: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const soundRef = useRef(sound);
  const reduced = useReducedMotion();
  useEffect(() => { soundRef.current = sound; }, [sound]);

  const fire = useCallback((i: number, x: number, y: number, forceSound = false) => {
    const el = root.current;
    if (!el || reduced) return;
    const A = 0.3 + 0.55 * i;
    const dur = 210 + i * 150;
    const layer = (bg: string, blend: string) => {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;inset:0;opacity:0;background:${bg};mix-blend-mode:${blend}`;
      el.appendChild(d);
      const a = d.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.07 }, { opacity: 0.45, offset: 0.28 }, { opacity: 0.12, offset: 0.6 }, { opacity: 0 }],
        { duration: dur, easing: "ease-out" },
      );
      a.onfinish = () => d.remove();
    };
    layer(`radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,${A}) 0, rgba(255,244,236,${A * 0.5}) 30%, rgba(255,255,255,${A * 0.1}) 75%)`, "normal");
    layer(`radial-gradient(ellipse 80% 90% at ${x}% ${y}%, rgba(255,140,128,${0.55 * i + 0.1}) 0, rgba(255,90,90,${0.3 * i}) 55%, transparent 100%)`, "screen");
    if (soundRef.current && (forceSound || Math.random() < 0.35)) shutter(forceSound ? 0.6 : 0.3);
  }, [reduced]);

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { i: number; x: number; y: number; s?: boolean };
      fire(d.i, d.x, d.y, !!d.s);
    };
    window.addEventListener("pb-flash", h);
    return () => window.removeEventListener("pb-flash", h);
  }, [fire]);

  // irregular schedule: random gaps, occasional bursts of 2-3
  useEffect(() => {
    if (!enabled || reduced) return;
    const ids: number[] = [];
    let alive = true;
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const loop = () => {
      ids.push(window.setTimeout(() => {
        if (!alive) return;
        if (!document.hidden) {
          const n = Math.random() < 0.28 ? 2 + Math.floor(Math.random() * 2) : 1;
          let t = 0;
          for (let k = 0; k < n; k++) {
            ids.push(window.setTimeout(() => fire(rnd(0.4, 1), rnd(8, 92), rnd(14, 72)), t));
            t += rnd(90, 240);
          }
        }
        loop();
      }, rnd(1100, 4300)));
    };
    ids.push(window.setTimeout(() => fire(0.8, rnd(20, 80), rnd(20, 60)), 900));
    loop();
    return () => { alive = false; ids.forEach(clearTimeout); };
  }, [enabled, reduced, fire]);

  return <div ref={root} className="flashes" aria-hidden="true" />;
}
