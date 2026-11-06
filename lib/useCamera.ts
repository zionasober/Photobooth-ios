"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type CamStatus = "off" | "starting" | "on" | "denied" | "unavailable";
export type Facing = "user" | "environment";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CamStatus>("off");
  const [facing, setFacing] = useState<Facing>("user");
  const [canSwitch, setCanSwitch] = useState(false);

  const killTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    killTracks();
    setStatus("off");
  }, [killTracks]);

  /** Must be called from a user gesture (click / tap). */
  const start = useCallback(async (f: Facing = "user") => {
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("unavailable"); return; }
    killTracks();
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: f }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
      setFacing(f);
      setStatus("on");
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        setCanSwitch(devs.filter((d) => d.kind === "videoinput").length > 1);
      } catch { setCanSwitch(false); }
    } catch (e) {
      const name = (e as DOMException)?.name;
      setStatus(name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError" ? "denied" : "unavailable");
    }
  }, [killTracks]);

  useEffect(() => killTracks, [killTracks]);

  return { videoRef, status, facing, canSwitch, start, stop };
}
export type Camera = ReturnType<typeof useCamera>;
