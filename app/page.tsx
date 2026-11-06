"use client";

import { useState } from "react";
import Home from "@/components/Home";
import Booth from "@/components/Booth";
import Result from "@/components/Result";
import { useCamera } from "@/lib/useCamera";
import type { FilmId } from "@/lib/film";

export default function Page() {
  const cam = useCamera();
  const [screen, setScreen] = useState<"home" | "booth" | "result">("home");
  const [filmId, setFilmId] = useState<FilmId>("bw");
  const [shot, setShot] = useState<{ frames: HTMLCanvasElement[]; mirror: boolean } | null>(null);

  // Camera permission is only ever requested from a click.
  const enter = () => { void cam.start(cam.facing); setScreen("booth"); };
  const exit = () => { cam.stop(); setScreen("home"); };

  return (
    <>
      <video ref={cam.videoRef} className="src-video" playsInline muted autoPlay />
      {screen === "home" && <Home onEnter={enter} />}
      {screen === "booth" && (
        <Booth cam={cam} filmId={filmId} setFilmId={setFilmId} onExit={exit}
          onDone={(frames, mirror) => { setShot({ frames, mirror }); setScreen("result"); }} />
      )}
      {screen === "result" && shot && (
        <Result frames={shot.frames} mirror={shot.mirror} filmId={filmId} onRetake={enter}
          onNew={() => { setShot(null); setScreen("home"); }} />
      )}
    </>
  );
}
