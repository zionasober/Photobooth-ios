export type FilmId = "bw" | "vintage" | "editorial" | "original" | "sepia" | "noir" | "instant";
type V3 = [number, number, number];

export interface Film {
  id: FilmId;
  name: string;
  note: string;
  mono: boolean;
  sat: number;
  bright: number;
  contrast: number;
  gain: V3;
  lift: V3;
  shadow: V3;
  highlight: V3;
  vig: number;
  grain: number;
}

const Z: V3 = [0, 0, 0];
const ONE: V3 = [1, 1, 1];

export const FILMS: Film[] = [
  {
    id: "bw", name: "CLASSIC B&W", note: "High contrast, warm silver-print black-and-white.",
    mono: true, sat: 0, bright: 1.02, contrast: 1.38, gain: [1.02, 1.0, 0.94], lift: [0.045, 0.04, 0.032],
    shadow: [0.035, 0.018, -0.005], highlight: [0.03, 0.015, -0.025], vig: 0.46, grain: 0.16,
  },
  {
    id: "vintage", name: "VINTAGE FILM", note: "Warm, faded, a little forgotten.",
    mono: false, sat: 0.78, bright: 1.04, contrast: 0.94, gain: [1.07, 1.0, 0.86], lift: [0.075, 0.055, 0.035],
    shadow: [0.015, 0.0, 0.02], highlight: Z, vig: 0.32, grain: 0.09,
  },
  {
    id: "editorial", name: "EDITORIAL", note: "Moody, contrast-rich, after dark.",
    mono: false, sat: 0.68, bright: 0.95, contrast: 1.32, gain: ONE, lift: Z,
    shadow: [-0.03, 0.0, 0.035], highlight: [0.03, 0.015, -0.02], vig: 0.52, grain: 0.1,
  },
  {
    id: "original", name: "ORIGINAL", note: "Natural colour. Barely touched.",
    mono: false, sat: 1, bright: 1, contrast: 1.03, gain: ONE, lift: Z,
    shadow: Z, highlight: Z, vig: 0.08, grain: 0.03,
  },
  {
    id: "sepia", name: "SEPIA", note: "Warm brown tones, like an old keepsake.",
    mono: true, sat: 0, bright: 1.04, contrast: 1.12, gain: [1.12, 0.96, 0.74], lift: [0.05, 0.035, 0.02],
    shadow: [0.02, 0.008, -0.01], highlight: [0.03, 0.02, -0.03], vig: 0.36, grain: 0.12,
  },
  {
    id: "noir", name: "NOIR", note: "Crushed blacks, hard light, heavy grain.",
    mono: true, sat: 0, bright: 0.93, contrast: 1.8, gain: ONE, lift: Z,
    shadow: [0, 0, 0.012], highlight: Z, vig: 0.62, grain: 0.2,
  },
  {
    id: "instant", name: "INSTANT", note: "Soft and faded, like an instant print.",
    mono: false, sat: 0.86, bright: 1.05, contrast: 0.88, gain: [1.04, 1.02, 0.96], lift: [0.09, 0.085, 0.08],
    shadow: [-0.012, 0.028, 0.022], highlight: [0.04, 0.02, -0.03], vig: 0.42, grain: 0.07,
  },
];

export const getFilm = (id: FilmId) => FILMS.find((f) => f.id === id)!;

/** Photobooth frame proportions: 4 wide : 5 tall. */
export const RATIO = 1.25;

export function processImageData(img: ImageData, f: Film, grainMul = 1) {
  const d = img.data;
  const w = img.width, h = img.height;
  const cx = w / 2, cy = h / 2, inv = 1 / (cx * cx + cy * cy);
  const [gr, gg, gb] = f.gain;
  const [lr, lg, lb] = f.lift;
  const [sr, sg, sb] = f.shadow;
  const [hr, hg, hb] = f.highlight;
  const grain = f.grain * grainMul;
  const { sat, bright, contrast, vig, mono } = f;
  let i = 0;
  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    for (let x = 0; x < w; x++, i += 4) {
      let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      if (mono) {
        const m = 0.38 * r + 0.5 * g + 0.12 * b;
        r = g = b = m;
      } else if (sat !== 1) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      }
      r *= bright; g *= bright; b *= bright;
      r = (r - 0.5) * contrast + 0.5; g = (g - 0.5) * contrast + 0.5; b = (b - 0.5) * contrast + 0.5;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sh = (1 - lum) * (1 - lum), hi = lum * lum;
      r += sr * sh + hr * hi; g += sg * sh + hg * hi; b += sb * sh + hb * hi;
      r *= gr; g *= gg; b *= gb;
      r = lr + r * (1 - lr); g = lg + g * (1 - lg); b = lb + b * (1 - lb);
      const dx = x - cx;
      const v = 1 - vig * (dx * dx + dy * dy) * inv;
      const n = (Math.random() - 0.5) * grain;
      d[i] = (r * v + n) * 255;
      d[i + 1] = (g * v + n) * 255;
      d[i + 2] = (b * v + n) * 255;
    }
  }
}

/** Draw a (raw, unmirrored) frame into a new 4:5 canvas with film treatment applied. */
export function renderFrame(
  src: CanvasImageSource, f: Film, w: number, mirror: boolean, grainMul = 1,
): HTMLCanvasElement {
  const h = Math.round(w * RATIO);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(src, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  processImageData(img, f, grainMul);
  ctx.putImageData(img, 0, 0);
  return c;
}
