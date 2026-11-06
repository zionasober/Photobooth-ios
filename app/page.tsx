"use client";

import { useEffect, useRef, useState } from "react";
import Home from "@/components/Home";
import Booth from "@/components/Booth";
import Result from "@/components/Result";
import Curtains, { type CurtainState } from "@/components/Curtains";
import Flashes from "@/components/Flashes";
import { useCamera } from "@/lib/useCamera";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { initAudio } from "@/lib/audio";
import type { FilmId } from "@/lib/film";

export default function Page() {
  const cam = useCamera();
  const reduced = useReducedMotion();
  const [screen, setScreen] = useState<"home" | "booth" | "result">("home");
  const [curtain, setCurtain] = useState<CurtainState>("closed");
  const [showHome, setShowHome] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [flashPref, setFlashPref] = useState(true);
  const [soundPref, setSoundPref] = useState(false); // paparazzi shutter audio is off by default
  const [filmId, setFilmId] = useState<FilmId>("bw");
  const [shot, setShot] = useState<{ frames: HTMLCanvasElement[]; mirror: boolean } | null>(null);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    try {
      const f = localStorage.getItem("pb-flash");
      if (f !== null) setFlashPref(f === "1");
      setSoundPref(localStorage.getItem("pb-sound") === "1");
    } catch { /* prefs are optional */ }
  }, []);

  const updFlash = (v: boolean) => { setFlashPref(v); try { localStorage.setItem("pb-flash", v ? "1" : "0"); } catch { /* */ } };
  const updSound = (v: boolean) => { setSoundPref(v); if (v) initAudio(); try { localStorage.setItem("pb-sound", v ? "1" : "0"); } catch { /* */ } };

  // ENTER: headline fades -> flash -> curtains part -> booth revealed -> camera permission asked
  const enter = () => {
    if (busy.current) return;
    busy.current = true;
    setLeaving(true);
    if (soundPref) initAudio();
    const openAt = reduced ? 320 : 540;
    if (!reduced) later(() => window.dispatchEvent(new CustomEvent("pb-flash", { detail: { i: 1, x: 50, y: 44, s: true } })), 380);
    later(() => {
      setScreen("booth");
      setCurtain("opening");
      void cam.start(cam.facing); // permission is only requested once the user has entered
    }, openAt);
    later(() => { setCurtain("open"); setShowHome(false); busy.current = false; }, openAt + (reduced ? 600 : 2000));
  };

  // EXIT: camera off, curtains close again, entrance resets
  const close = () => {
    if (busy.current) return;
    busy.current = true;
    cam.stop();
    setExiting(true);
    setShowHome(true);
    setLeaving(true);
    setCurtain("closing");
    later(() => { setCurtain("closed"); setScreen("home"); setShot(null); setExiting(false); }, reduced ? 550 : 1600);
    later(() => { setLeaving(false); busy.current = false; }, reduced ? 650 : 1750);
  };

  const retake = () => { setScreen("booth"); void cam.start(cam.facing); };

  return (
    <>
      <video ref={cam.videoRef} className="src-video" playsInline muted autoPlay />
      {screen === "booth" && (
        <Booth cam={cam} filmId={filmId} setFilmId={setFilmId} onExit={close} exiting={exiting}
          onDone={(frames, mirror) => { setShot({ frames, mirror }); setScreen("result"); }} />
      )}
      {screen === "result" && shot && (
        <Result frames={shot.frames} mirror={shot.mirror} filmId={filmId} onRetake={retake} onNew={close} />
      )}
      <Curtains state={curtain} />
      <Flashes enabled={flashPref && screen === "home" && curtain === "closed" && !leaving} sound={soundPref} />
      {showHome && (
        <Home onEnter={enter} leaving={leaving} flash={flashPref} setFlash={updFlash} sound={soundPref} setSound={updSound} />
      )}
    </>
  );
}
