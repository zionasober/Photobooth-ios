"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FILMS, FilmId, getFilm, renderFrame } from "@/lib/film";
import { BORDERS, BorderId, LayoutId, StripOpts, fmtDate, getFonts, renderStrip } from "@/lib/strip";

interface Props {
  frames: HTMLCanvasElement[];
  mirror: boolean;
  filmId: FilmId;
  seed: number;
  onRetake: () => void;
  onNew: () => void;
}

const stampName = (d: Date) =>
  `photobooth-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("blob"))), "image/png"));

export default function Result({ frames, mirror: mirror0, filmId: film0, seed, onRetake, onNew }: Props) {
  const [date] = useState(() => new Date());
  const [filmId, setFilmId] = useState<FilmId>(film0);
  const [border, setBorder] = useState<BorderId>("white");
  const [layout, setLayout] = useState<LayoutId>("classic");
  const [showDate, setShowDate] = useState(true);
  const [mirror, setMirror] = useState(mirror0);
  const [caption, setCaption] = useState("");
  const [debounced, setDebounced] = useState("");
  const [preview, setPreview] = useState<{ url: string; ratio: number } | null>(null);
  const [fthumbs, setFthumbs] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "strip" | "share">("");
  const [canShare, setCanShare] = useState(false);
  const fonts = useRef<ReturnType<typeof getFonts> | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(caption), 150); return () => clearTimeout(t); }, [caption]);
  useEffect(() => {
    try {
      setCanShare(typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] }));
    } catch { setCanShare(false); }
  }, []);

  const opts: StripOpts = useMemo(() => ({
    film: getFilm(filmId), border, layout, showDate, caption: debounced, mirror, date, seed,
  }), [filmId, border, layout, showDate, debounced, mirror, date, seed]);

  // on-screen preview + frame thumbs
  useEffect(() => {
    let dead = false;
    (async () => {
      fonts.current ??= getFonts();
      const c = await renderStrip(frames, opts, 380, fonts.current);
      if (dead) return;
      setPreview({ url: c.toDataURL("image/jpeg", 0.92), ratio: c.width / c.height });
    })();
    return () => { dead = true; };
  }, [frames, opts]);

  useEffect(() => {
    setFthumbs(frames.map((f) => renderFrame(f, getFilm(filmId), 150, mirror, 0.6).toDataURL("image/jpeg", 0.8)));
  }, [frames, filmId, mirror]);

  async function exportStrip() {
    fonts.current ??= getFonts();
    const c = await renderStrip(frames, opts, 1000, fonts.current);
    return toBlob(c);
  }
  async function download() {
    setBusy("strip");
    try { save(await exportStrip(), `${stampName(date)}-strip.png`); } finally { setBusy(""); }
  }
  async function share() {
    setBusy("share");
    try {
      const file = new File([await exportStrip()], `${stampName(date)}-strip.png`, { type: "image/png" });
      await navigator.share({ files: [file], title: "Photobooth / NYC" });
    } catch { /* cancelled */ } finally { setBusy(""); }
  }
  async function downloadFrame(i: number) {
    const c = renderFrame(frames[i], getFilm(filmId), frames[i].width, mirror, 1);
    save(await toBlob(c), `${stampName(date)}-frame-0${i + 1}.png`);
  }

  return (
    <main className="screen result">
      <header className="bar light">
        <button className="link" onClick={onNew}>← NEW SESSION</button>
        <span className="bar-title">PHOTOBOOTH / NYC</span>
        <span className="bar-r"><span className="hide-s">{date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}</span></span>
      </header>

      <div className="prevstage">
        <div className="prevspot" />
        <div className="prevstrip" style={{ ["--ratio" as string]: preview?.ratio ?? 0.19 }}>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="pv" src={preview.url} alt="Your photo strip" draggable={false} />
          )}
        </div>
        <p className="prevcap">N°001 — {getFilm(filmId).name} — {fmtDate(date)}</p>
      </div>

      <section className="controls">
        <div className="plabel"><span>03</span> Make it yours</div>

        <div className="row">
          <label>Border</label>
          <div className="swatches" role="radiogroup" aria-label="Border colour">
            {(Object.keys(BORDERS) as BorderId[]).map((b) => (
              <button key={b} role="radio" aria-checked={b === border} aria-label={BORDERS[b].label}
                className={"sw" + (b === border ? " on" : "")} style={{ background: BORDERS[b].bg }} onClick={() => setBorder(b)} />
            ))}
          </div>
        </div>

        <div className="row">
          <label>Film</label>
          <div className="seg">
            {FILMS.map((f) => (
              <button key={f.id} className={f.id === filmId ? "on" : ""} onClick={() => setFilmId(f.id)}>{f.name.replace("CLASSIC ", "").replace(" FILM", "")}</button>
            ))}
          </div>
        </div>

        <div className="row">
          <label>Layout</label>
          <div className="seg">
            <button className={layout === "classic" ? "on" : ""} onClick={() => setLayout("classic")}>CLASSIC</button>
            <button className={layout === "editorial" ? "on" : ""} onClick={() => setLayout("editorial")}>EDITORIAL</button>
          </div>
        </div>

        <div className="row">
          <label>Details</label>
          <div className="seg">
            <button className={showDate ? "on" : ""} aria-pressed={showDate} onClick={() => setShowDate((v) => !v)}>DATE</button>
            <button className={mirror ? "on" : ""} aria-pressed={mirror} onClick={() => setMirror((v) => !v)}>MIRROR</button>
          </div>
        </div>

        <div className="row">
          <label htmlFor="cap">Caption</label>
          <input id="cap" className="cap" value={caption} maxLength={32} placeholder="Add a few words…"
            onChange={(e) => setCaption(e.target.value)} />
        </div>

        <div className="row">
          <label>Frames</label>
          <div className="fthumbs">
            {fthumbs.map((u, i) => (
              <button key={i} onClick={() => downloadFrame(i)} aria-label={`Download frame ${i + 1}`} title="Download this frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" /><span>↓ 0{i + 1}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="cta cta-dark" onClick={download} disabled={busy !== "" || !preview}>
            <span>{busy === "strip" ? "DEVELOPING…" : "DOWNLOAD STRIP"}</span><span className="arrow" aria-hidden="true">↓</span>
          </button>
          <div className="actions-2">
            {canShare && <button className="cta cta-ghost" onClick={share} disabled={busy !== ""}>{busy === "share" ? "…" : "SHARE"}</button>}
            <button className="cta cta-ghost" onClick={onRetake}>RETAKE</button>
          </div>
        </div>
      </section>
    </main>
  );
}
