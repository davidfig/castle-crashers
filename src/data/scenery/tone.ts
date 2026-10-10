// How one generated biome differs in colour from its archetype. A `Tone` is applied to every colour of the biome, in its data
// (the sky, fog, ground colours) and in its pictures (the painter recolours each sprite it makes), so the two always agree.
// Pure: nothing here may be read by the sim.

/** A biome's colour shift. `band` is the hue (0..1, a turn) of its foliage or ground; the colours near it are rotated by `hue`. */
export interface Tone {
  /** Hue of the colours that move: green for a meadow's leaves, blue for snow shadow, ... (0..1). */
  band: number;
  /** How wide a stretch of hue around `band` moves with it (0..0.5, a turn). */
  width: number;
  /** Turns the band is rotated by (+0.1 is about 36 degrees along the hue wheel). */
  hue: number;
  /** Turns every colour of the sky is rotated by. */
  skyHue: number;
  /** Saturation and lightness multipliers. */
  sat: number;
  light: number;
}

export const NO_TONE: Tone = { band: 0, width: 0, hue: 0, skyHue: 0, sat: 1, light: 1 };

export function rgbToHsl(c: number): [number, number, number] {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): number {
  let r = l, g = l, b = l;
  if (s > 1e-6) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  return (Math.round(Math.min(1, Math.max(0, r)) * 255) << 16) | (Math.round(Math.min(1, Math.max(0, g)) * 255) << 8) | Math.round(Math.min(1, Math.max(0, b)) * 255);
}

/** How much of the band's rotation a colour of hue `h` takes: all of it at the centre, none beyond `width` (a smooth hump). */
export function bandWeight(h: number, band: number, width: number): number {
  if (width <= 0) return 0;
  let d = Math.abs(h - band);
  if (d > 0.5) d = 1 - d;
  if (d >= width) return 0;
  const t = 1 - d / width;
  return t * t * (3 - 2 * t);
}

/** Colours this grey are left alone by hue (and keep their saturation). */
const GREY = 0.07;

/** The colour of a sprite, ground or other art after the tone. */
export function toneArt(c: number, t: Tone): number {
  const [h, s, l] = rgbToHsl(c);
  const w = s < GREY ? 0 : bandWeight(h, t.band, t.width);
  const h2 = (h + t.hue * w + 1) % 1;
  return hslToRgb(h2, Math.min(1, s * (s < GREY ? 1 : t.sat)), Math.min(1, l * t.light));
}

/** The colour of a sky, tint or other light after the tone: every chromatic colour turns by `skyHue`. */
export function toneSky(c: number, t: Tone, keepLight = false): number {
  const [h, s, l] = rgbToHsl(c);
  const h2 = s < GREY ? h : (h + t.skyHue + 1) % 1;
  return hslToRgb(h2, Math.min(1, s * (s < GREY ? 1 : t.sat)), keepLight ? l : Math.min(1, l * t.light));
}

/** A cached colour function for `t` (a sprite has few distinct colours, and the painter asks for each pixel). */
export function artFn(t: Tone): (c: number) => number {
  const cache = new Map<number, number>();
  return (c) => {
    let v = cache.get(c);
    if (v === undefined) { v = toneArt(c, t); cache.set(c, v); }
    return v;
  };
}
export function skyFn(t: Tone, keepLight = false): (c: number) => number {
  const cache = new Map<number, number>();
  return (c) => {
    let v = cache.get(c);
    if (v === undefined) { v = toneSky(c, t, keepLight); cache.set(c, v); }
    return v;
  };
}
