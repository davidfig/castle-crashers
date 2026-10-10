// Generated ground decals: grass tufts, flowers, rocks, shrubs, crystals and mushrooms, each drawn from a seed rather than from a text bitmap, so
// every biome of every run has its own. They are small (3 to 11 px), cut from a few simple shapes and shaded by a light from the upper left
// (a lit pixel, a body, a dark foot), like the hand-made decals beside them. `o` is the biome's seed offset and `v` the variant, so one kind comes
// in several shapes. Colours are given by the caller; the painter then moves them to the biome's tone. Pure.
import { hash2, setPix, type Pix } from './pix';
import { hslToRgb } from '../data/scenery/tone';

/** A value in 0..1 from a seed and a counter (cosmetic noise, not the sim's RNG). */
function r(seed: number, i: number): number { return hash2(i, seed, 733) / 4294967296; }

function blank(w: number, h: number): Pix { return { w, h, rgba: new Uint8ClampedArray(w * h * 4) }; }

/** A tuft of grass: `blades` blades of different heights leaning a little, dark at the foot and lit at the tip. `c` is [foot, body, tip]. */
export function genTuft(o: number, v: number, c: readonly [number, number, number], maxH = 6): Pix {
  const s = o * 31 + v * 7 + 1;
  const blades = 3 + Math.floor(r(s, 0) * 4), w = blades * 2 + 1, h = Math.max(3, maxH - Math.floor(r(s, 1) * 2));
  const p = blank(w, h);
  for (let b = 0; b < blades; b++) {
    const x0 = Math.min(w - 1, Math.floor(((b + 0.5) * w) / blades + (r(s, 10 + b) - 0.5)));
    const bh = 2 + Math.floor(r(s, 20 + b) * (h - 1)), lean = r(s, 30 + b) < 0.35 ? -1 : r(s, 30 + b) > 0.65 ? 1 : 0;
    for (let k = 0; k < bh; k++) {
      const x = Math.max(0, Math.min(w - 1, x0 + (k >= bh / 2 ? lean : 0)));
      setPix(p, x, h - 1 - k, k === 0 ? c[0] : k === bh - 1 ? c[2] : c[1]);
    }
  }
  return p;
}

/** A flower on a stem: a head shaped as a cross, a ring or a bell, with a centre, and sometimes a leaf. `c` is [petal, petal's shade, centre, stem]. */
export function genFlower(o: number, v: number, c: readonly [number, number, number, number]): Pix {
  const s = o * 17 + v * 13 + 5;
  const kind = Math.floor(r(s, 0) * 3), stem = 2 + Math.floor(r(s, 1) * 3), w = kind === 2 ? 5 : 5, h = 3 + stem;
  const p = blank(w, h);
  for (let k = 0; k < stem; k++) setPix(p, 2, h - 1 - k, c[3]);
  if (r(s, 2) < 0.6) setPix(p, r(s, 3) < 0.5 ? 1 : 3, h - 2, c[3]);
  if (kind === 0) { // cross
    for (const [x, y] of [[2, 0], [1, 1], [3, 1], [2, 2]]) setPix(p, x, y, c[0]);
    setPix(p, 2, 1, c[2]);
  } else if (kind === 1) { // ring
    for (let y = 0; y < 3; y++) for (let x = 1; x < 4; x++) setPix(p, x, y, y === 2 ? c[1] : c[0]);
    setPix(p, 2, 1, c[2]);
  } else { // bell
    for (const [x, y] of [[1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1], [2, 2]]) setPix(p, x, y, y === 1 ? c[1] : c[0]);
    setPix(p, 2, 0, c[2]);
  }
  return p;
}

/** A rock: a dome, lit on the upper left and dark along its foot, cracked, and sometimes with moss on top. `c` is [dark, body, lit, moss]. */
export function genRock(o: number, v: number, c: readonly [number, number, number, number], moss = 0.25): Pix {
  const s = o * 23 + v * 11 + 3;
  const w = 6 + Math.floor(r(s, 0) * 5), h = 4 + Math.floor(r(s, 1) * 3), mossy = r(s, 2) < moss;
  const p = blank(w, h);
  const peak = 0.3 + r(s, 3) * 0.4; // where the top sits along the width
  for (let y = 0; y < h; y++) {
    const t = (y + 1) / h; // 0 at the top, 1 at the foot
    const half = (w / 2) * Math.sqrt(t) * (0.9 + r(s, 40 + y) * 0.2);
    const cx = (w - 1) * (0.5 + (peak - 0.5) * (1 - t));
    const x0 = Math.max(0, Math.round(cx - half + 0.5)), x1 = Math.min(w - 1, Math.round(cx + half - 0.5));
    for (let x = x0; x <= x1; x++) {
      let col = c[1];
      if (y === h - 1) col = c[0];
      else if (y <= 1 || x - x0 <= 0) col = c[2];
      else if (x1 - x <= 0 && y > h / 3) col = c[0];
      if (mossy && y <= 1 && r(s, 60 + x) < 0.7) col = c[3];
      setPix(p, x, y, col);
    }
  }
  if (r(s, 4) < 0.6) { const cx = 2 + Math.floor(r(s, 5) * (w - 4)); for (let k = 0; k < Math.min(2, h - 2); k++) setPix(p, cx + k, 1 + k + (r(s, 6) < 0.5 ? 0 : 1), c[0]); }
  return p;
}

/** A shrub: a lump of leaves from a few overlapping discs, with lit leaves on the upper left, a dark underside and a few berries. `c` is [dark, body, lit, berry]. */
export function genShrub(o: number, v: number, c: readonly [number, number, number, number], berries = 0.35): Pix {
  const s = o * 19 + v * 5 + 9;
  const w = 8 + Math.floor(r(s, 0) * 4), h = 6 + Math.floor(r(s, 1) * 3);
  const p = blank(w, h);
  const discs = 3 + Math.floor(r(s, 2) * 2);
  const cells: number[] = new Array(w * h).fill(0);
  for (let d = 0; d < discs; d++) {
    const rad = 2.2 + r(s, 10 + d) * 1.8, cx = rad + r(s, 20 + d) * (w - 2 * rad), cy = h - 1 - rad - r(s, 30 + d) * (h - 2 * rad - 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + 0.5 - cx) ** 2 + ((y + 0.5 - cy) * 1.1) ** 2 <= rad * rad) cells[y * w + x] = 1;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!cells[y * w + x]) continue;
      const above = y > 0 && cells[(y - 1) * w + x], left = x > 0 && cells[y * w + x - 1];
      const below = y < h - 1 && cells[(y + 1) * w + x];
      let col = c[1];
      if (!below) col = c[0];
      else if ((!above || !left) && r(s, 100 + y * w + x) < 0.7) col = c[2];
      else if (r(s, 100 + y * w + x) < 0.12) col = c[0];
      setPix(p, x, y, col);
    }
  }
  const nb = r(s, 3) < berries ? 1 + Math.floor(r(s, 4) * 3) : 0;
  for (let b = 0; b < nb; b++) { const x = 1 + Math.floor(r(s, 50 + b) * (w - 2)), y = 1 + Math.floor(r(s, 60 + b) * (h - 3)); if (cells[y * w + x]) setPix(p, x, y, c[3]); }
  return p;
}

/** A cluster of crystal shards: tall pointed columns, lit on the left. `c` is [dark, body, lit]. */
export function genCrystal(o: number, v: number, c: readonly [number, number, number]): Pix {
  const s = o * 29 + v * 3 + 2;
  const n = 2 + Math.floor(r(s, 0) * 2), w = n * 3 + 1, h = 5 + Math.floor(r(s, 1) * 5);
  const p = blank(w, h);
  for (let k = 0; k < n; k++) {
    const x0 = k * 3, sh = Math.max(3, h - Math.floor(r(s, 10 + k) * 4) - (k === 0 ? 0 : 1)), wid = 2 + (r(s, 20 + k) < 0.4 ? 1 : 0);
    for (let y = 0; y < sh; y++) {
      const yy = h - sh + y, taper = y < 2 ? 1 : 0; // a point at the top
      for (let x = 0; x < wid; x++) {
        if (taper && x > 0 && y === 0) continue;
        setPix(p, x0 + x, yy, x === 0 ? c[2] : y === sh - 1 ? c[0] : c[1]);
      }
    }
  }
  return p;
}

/** A mushroom or two: a round cap with a few spots on a short stem. `c` is [cap, cap's shade, spot, stem]. */
export function genMushroom(o: number, v: number, c: readonly [number, number, number, number]): Pix {
  const s = o * 37 + v * 9 + 7;
  const cap = 4 + Math.floor(r(s, 0) * 3), two = r(s, 1) < 0.4, w = two ? cap + 4 : cap, h = 6;
  const p = blank(w, h);
  const draw = (x0: number, wd: number, capH: number, stemH: number, spots: number): void => {
    const top = h - capH - stemH;
    for (let y = 0; y < stemH; y++) setPix(p, x0 + (wd >> 1), top + capH + y, c[3]);
    for (let y = 0; y < capH; y++) {
      const inset = y === 0 ? 1 : 0;
      for (let x = x0 + inset; x < x0 + wd - inset; x++) setPix(p, x, top + y, y === capH - 1 ? c[1] : c[0]);
    }
    for (let k = 0; k < spots; k++) setPix(p, x0 + 1 + Math.floor(r(s, 5 + x0 + k) * Math.max(1, wd - 2)), top + (capH > 2 ? 1 : 0), c[2]);
  };
  draw(0, cap, 3, 3, 1 + Math.floor(r(s, 2) * 2));
  if (two) draw(cap + 1, 3, 2, 2, 1);
  return p;
}

/** A hue (0..1) that is not green, for petals and berries: random but never a leaf's colour. */
export function brightHue(o: number, i: number): number {
  const t = r(o * 3 + 1, i);
  return t < 0.5 ? t * 0.34 : 0.5 + (t - 0.5) * 0.9 > 0.95 ? 0.95 : 0.5 + (t - 0.5) * 0.9; // reds to yellows, or blues to magentas
}

/** A flower palette of `n` saturated colours for a biome: [petal, shade, centre] sets. */
export function flowerPalette(o: number, n: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const h = brightHue(o, i);
    out.push([hslToRgb(h, 0.7, 0.62), hslToRgb(h, 0.62, 0.46), hslToRgb((h + 0.12) % 1, 0.8, 0.62)]);
  }
  return out;
}
