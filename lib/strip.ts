import { Film, RATIO, renderFrame } from "./film";

export type BorderId = "white" | "black" | "cream" | "red";
export type LayoutId = "classic" | "editorial";

export const BORDERS: Record<BorderId, { bg: string; ink: string; label: string }> = {
  white: { bg: "#f7f5ef", ink: "#141311", label: "White" },
  black: { bg: "#0f0e0d", ink: "#ece6d8", label: "Black" },
  cream: { bg: "#ece2cb", ink: "#1b1612", label: "Cream" },
  red: { bg: "#6e1215", ink: "#efe4d0", label: "Deep red" },
};

export interface StripOpts {
  film: Film;
  border: BorderId;
  layout: LayoutId;
  showDate: boolean;
  caption: string;
  mirror: boolean;
  date: Date;
}

export interface Fonts { serif: string; sans: string; hand: string }

export function getFonts(): Fonts {
  const cs = getComputedStyle(document.documentElement);
  const serif = cs.getPropertyValue("--font-serif").trim();
  const sans = cs.getPropertyValue("--font-sans").trim();
  const hand = cs.getPropertyValue("--font-hand").trim();
  return {
    serif: `${serif || "Georgia"}, serif`,
    sans: `${sans || "Helvetica"}, sans-serif`,
    hand: `${hand || "cursive"}, cursive`,
  };
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function spacedWidth(ctx: CanvasRenderingContext2D, t: string, sp: number) {
  let w = 0;
  for (const ch of t) w += ctx.measureText(ch).width + sp;
  return w - sp;
}

function drawSpaced(
  ctx: CanvasRenderingContext2D, t: string, x: number, y: number, sp: number, align: "left" | "center" | "right",
) {
  const total = spacedWidth(ctx, t, sp);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.textAlign = "left";
  for (const ch of t) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + sp;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

function paperGrain(c: HTMLCanvasElement, amp: number) {
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amp;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Draw a frame with slightly irregular corners and a faint uneven chemical edge, like a real print. */
function drawFrame(
  ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, w: number, h: number, paper: string,
) {
  const r = () => w * (0.008 + Math.random() * 0.03);
  const [a, b, c, d] = [r(), r(), r(), r()];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + a, y);
  ctx.lineTo(x + w - b, y); ctx.quadraticCurveTo(x + w, y, x + w, y + b);
  ctx.lineTo(x + w, y + h - c); ctx.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
  ctx.lineTo(x + d, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - d);
  ctx.lineTo(x, y + a); ctx.quadraticCurveTo(x, y, x + a, y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  const edge = Math.floor(Math.random() * 4);
  const t = w * (0.03 + Math.random() * 0.05);
  const vert = edge < 2;
  const g = vert
    ? ctx.createLinearGradient(0, edge === 0 ? y : y + h, 0, edge === 0 ? y + t : y + h - t)
    : ctx.createLinearGradient(edge === 2 ? x : x + w, 0, edge === 2 ? x + t : x + w - t, 0);
  g.addColorStop(0, paper + "99");
  g.addColorStop(1, paper + "00");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

async function loadFonts(f: Fonts) {
  try {
    await Promise.all([
      document.fonts.load(`italic 40px ${f.serif}`),
      document.fonts.load(`40px ${f.serif}`),
      document.fonts.load(`600 20px ${f.sans}`),
      document.fonts.load(`400 20px ${f.sans}`),
      document.fonts.load(`500 20px ${f.hand}`),
    ]);
  } catch { /* fall back to whatever is available */ }
}

/** Render the finished strip. P = width in px of one photo. */
export async function renderStrip(
  frames: HTMLCanvasElement[], o: StripOpts, P: number, fonts: Fonts,
): Promise<HTMLCanvasElement> {
  await loadFonts(fonts);
  const theme = BORDERS[o.border];
  const accent = o.border === "red" ? theme.ink : "#b3191f";
  const pH = Math.round(P * RATIO);
  const caption = o.caption.trim();
  const dateStr = fmtDate(o.date);
  const editorial = o.layout === "editorial";

  const m = editorial ? P * 0.05 : P * 0.07;
  const gap = editorial ? 0 : P * 0.03;
  const lab = editorial ? P * 0.1 : 0;
  const head = editorial ? P * 0.1 : 0;

  // measure footer
  const mc = document.createElement("canvas").getContext("2d")!;
  const capSize = editorial ? P * 0.15 : P * 0.092;
  mc.font = `italic ${capSize}px ${fonts.serif}`;
  const capLines = caption ? wrap(mc, caption, editorial ? P : P * 0.92, editorial ? 3 : 2) : [];
  const brandSize = P * 0.04, dateSize = P * 0.034;

  let foot: number;
  if (editorial) {
    const body = capLines.length ? capLines.length * capSize * 1.0 : o.showDate ? capSize : 0;
    foot = P * 0.1 + body + P * 0.07 + dateSize + m * 1.2;
  } else {
    let content = brandSize;
    if (capLines.length) content += P * 0.035 + capLines.length * capSize * 1.05;
    if (o.showDate) content += P * 0.035 + dateSize;
    foot = Math.max(P * 0.3, content + P * 0.18);
  }

  const W = Math.round(P + 2 * m);
  const H = Math.round(m + head + 4 * pH + 4 * lab + 3 * gap + foot);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // header (editorial)
  if (editorial) {
    ctx.fillStyle = theme.ink;
    ctx.font = `600 ${brandSize * 0.85}px ${fonts.sans}`;
    drawSpaced(ctx, "PHOTOBOOTH / NYC", m, m + head * 0.55, brandSize * 0.22, "left");
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(W - m - brandSize * 0.3, m + head * 0.55 - brandSize * 0.3, brandSize * 0.22, 0, Math.PI * 2); ctx.fill();
  }

  // photos
  const top = m + head;
  const pick = Math.floor(Math.random() * 4);
  const stamp = `${String(o.date.getMonth() + 1).padStart(2, "0")}${String(o.date.getDate()).padStart(2, "0")}`;
  frames.forEach((f, i) => {
    const y = Math.round(top + i * (pH + lab + gap));
    drawFrame(ctx, renderFrame(f, o.film, P, o.mirror), m, y, P, pH, theme.bg);
    if (editorial) {
      // grease-pencil frame numbers, like a contact sheet
      const text = `PB-${stamp}-0${i + 1}`;
      const fs = P * 0.075;
      ctx.fillStyle = theme.ink;
      ctx.font = `500 ${fs}px ${fonts.hand}`;
      ctx.textAlign = "left";
      const ty = y + pH + lab * 0.72;
      ctx.fillText(text, m + P * 0.02, ty);
      if (i === pick) {
        const tw = ctx.measureText(text).width;
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(2, P * 0.006);
        ctx.lineCap = "round";
        ctx.beginPath();
        const cx = m + P * 0.02 + tw / 2, cy = ty - fs * 0.3, rx = tw / 2 + P * 0.04, ry = fs * 0.75;
        for (let k = 0; k <= 70; k++) {
          const t = (k / 60) * Math.PI * 2 + 0.4;
          const wob = 1 + Math.sin(t * 3) * 0.04 + (k / 70) * 0.06;
          const px = cx + Math.cos(t) * rx * wob, py = cy + Math.sin(t) * ry * wob;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  });

  const fy = top + 4 * pH + 4 * lab + 3 * gap;
  ctx.fillStyle = theme.ink;

  if (!editorial) {
    let total = brandSize;
    if (capLines.length) total += P * 0.035 + capLines.length * capSize * 1.05;
    if (o.showDate) total += P * 0.035 + dateSize;
    let y = fy + (foot - total) / 2 + brandSize;
    ctx.font = `600 ${brandSize}px ${fonts.sans}`;
    drawSpaced(ctx, "PHOTOBOOTH / NYC", W / 2, y, brandSize * 0.3, "center");
    if (capLines.length) {
      ctx.font = `italic ${capSize}px ${fonts.serif}`;
      ctx.textAlign = "center";
      y += P * 0.035;
      for (const line of capLines) { y += capSize * 1.05; ctx.fillText(line, W / 2, y - capSize * 0.12); }
    }
    if (o.showDate) {
      ctx.font = `400 ${dateSize}px ${fonts.sans}`;
      y += P * 0.035 + dateSize;
      drawSpaced(ctx, dateStr, W / 2, y, dateSize * 0.3, "center");
    }
  } else {
    let y = fy + P * 0.05;
    ctx.fillStyle = accent;
    ctx.fillRect(m, y, P, Math.max(2, P * 0.004));
    y += P * 0.05;
    ctx.fillStyle = theme.ink;
    ctx.textAlign = "left";
    if (capLines.length) {
      ctx.font = `italic ${capSize}px ${fonts.serif}`;
      for (const line of capLines) { y += capSize; ctx.fillText(line, m, y - capSize * 0.14); }
    } else if (o.showDate) {
      ctx.font = `${capSize}px ${fonts.serif}`;
      y += capSize;
      ctx.fillText(dateStr, m, y - capSize * 0.14);
    }
    y += P * 0.07 + dateSize;
    ctx.font = `400 ${dateSize}px ${fonts.sans}`;
    if (o.showDate && capLines.length) drawSpaced(ctx, dateStr, m, y, dateSize * 0.3, "left");
    ctx.font = `600 ${dateSize}px ${fonts.sans}`;
    drawSpaced(ctx, "N.Y.C.", m + P, y, dateSize * 0.3, "right");
  }

  paperGrain(c, o.border === "black" || o.border === "red" ? 7 : 9);
  return c;
}
