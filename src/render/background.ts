// The world behind and under the action: sky, parallax layers, ground, hill crest, foreground ridge.
// Render-only; see docs/11-backgrounds.md.
import { DESTINATION_LAYER, mix, type BiomeDef, type BlendedMood, type GroundDef, type ParallaxLayer } from '../data/biomes';
import type { Batcher, Frame } from '../platform/gl/batcher';
import { hex, rgba } from '../platform/gl/batcher';
import { VIEW_H, VIEW_W } from '../sim/constants';
import type { Sprites } from './art';
import { flatNoise, GROUND_CELL, groundNoise, patchNoise, type Scenery } from './scenery';

/** Screen y of world y=0 (feet at the very top of the field stand on the crest line) and of the horizon. */
export const FIELD_Y0 = 112;
export const GROUND_TOP = 112;
/** Where the foreground ridge along the bottom begins. */
export const RIDGE_TOP = 351;

/**
 * A 0xRRGGBB color times a mood tint (0xRRGGBB, default none) and a brightness `v`, as a batcher color with the given
 * alpha (0..255). `blue` is an extra gain on the blue channel (for the cooler look of the far ground).
 */
function shade(rgb: number, tint = 0xffffff, v = 1, alpha = 255, blue = 1): number {
  return rgba(
    Math.round((((rgb >> 16) & 255) * ((tint >> 16) & 255) * v) / 255),
    Math.round((((rgb >> 8) & 255) * ((tint >> 8) & 255) * v) / 255),
    Math.min(255, Math.round(((rgb & 255) * (tint & 255) * v * blue) / 255)),
    alpha,
  );
}

/** How far down the ground a screen y is: 0 at the horizon, 1 at the bottom of the screen. */
function groundDepth(y: number): number {
  return Math.min(1, Math.max(0, (y - GROUND_TOP) / (VIEW_H - GROUND_TOP)));
}

/** The ground's brightness at screen y: darker toward the horizon (lighting, not perspective: nothing scales with depth). */
function depthShade(y: number): number {
  return 0.86 + groundDepth(y) * 0.14;
}

/** A soft radial glow: three nested discs fake the falloff. `squash` flattens it (a glow on the ground is wider than tall). */
function glow(b: Batcher, S: Sprites, cx: number, cy: number, r: number, squash: number, color: number, alpha: number): void {
  for (const f of [1, 0.64, 0.35]) {
    const rr = r * f;
    b.drawScaled(S.disc, cx - rr, cy - rr * squash, rr * 2, rr * 2 * squash, hex(color, alpha / 2.2));
  }
}

/** The far side of the world drifts slightly with the camera: the sun, moon and stars at this fraction of its speed. */
const SKY_PARALLAX = 0.02;
const CLOUD_PERIOD = 768;
const STAR_COUNT = 48;

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** The part of a frame's width [from, from + w) drawn as its own sprite (a run of a repeating strip, for instance). */
const slice: Frame = { u0: 0, v0: 0, u1: 0, v1: 0, w: 0, h: 0 };
function drawSlice(b: Batcher, f: Frame, x: number, y: number, from: number, w: number, tint: number): void {
  const k = (f.u1 - f.u0) / f.w;
  slice.u0 = f.u0 + from * k;
  slice.u1 = f.u0 + (from + w) * k;
  slice.v0 = f.v0;
  slice.v1 = f.v1;
  slice.w = w;
  slice.h = f.h;
  b.draw(slice, x, y, false, tint);
}

/** One sky band's rows of dither (25/50/75% of its color over the band above) across screen columns [x0, x1). */
function drawBandDither(b: Batcher, S: Sprites, y: number, x0: number, x1: number, c: number): void {
  for (let m = 0; m < 3; m++) {
    for (let x = x0; x < x1;) {
      const off = (((x + 8) % 256) + 256) % 256; // the 256 px masks tile from x = -8
      const w = Math.min(x1 - x, 256 - off);
      drawSlice(b, S.dither[m], x, y - 6 + m * 2, off, w, c);
      x += w;
    }
  }
}

/** The sky bands of a mood across screen columns [x0, x1), each dithered into the one above over 6 px. */
function drawSkyBands(b: Batcher, S: Sprites, mood: BlendedMood, oy: number, x0 = -8, x1 = VIEW_W + 8): void {
  const n = mood.sky.length;
  const bandH = Math.ceil(GROUND_TOP / n);
  for (let i = 0; i < n; i++) {
    const y = i * bandH + oy;
    // the whole sky shakes with the screen, so the edges overscan
    b.drawScaled(S.px, x0, i === 0 ? y - 8 : y, x1 - x0, bandH + 1 + (i === 0 ? 8 : 0), hex(mood.sky[i]));
    if (i > 0) drawBandDither(b, S, y, x0, x1, hex(mood.sky[i]));
  }
}

const SKY_COL = 8;
/** How far (as a share of the turn) the top of the sky lags behind the horizon: the new sky comes up from the horizon, so the front leans. */
const SKY_LEAN = 0.3;

function lerpRGB(c0: number, c1: number, t: number): number {
  const r = Math.round(((c0 >> 16) & 255) * (1 - t) + ((c1 >> 16) & 255) * t);
  const g = Math.round(((c0 >> 8) & 255) * (1 - t) + ((c1 >> 8) & 255) * t);
  const bl = Math.round((c0 & 255) * (1 - t) + (c1 & 255) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * The next biome's sky comes in as a smooth wash along the road. The sky is redrawn in 8 px columns, each band in the color a
 * fraction of the way from the old biome's band to the new one's, the fraction being the share of the road that has turned at that
 * column (the same share a hero walks through, so the front stays put in the world and the hero walks across it). The horizon turns
 * first and the top of the sky follows (`SKY_LEAN`), so the front leans like evening coming in from the right. Every column is a
 * complete, opaque sky (bands and the dither between them), so nothing shows through and no seam appears at any point of the wash.
 */
function drawSkyWash(b: Batcher, S: Sprites, sc: Scenery, camXf: number, oy: number): void {
  const m0 = sc.mood[0], m1 = sc.mood[1];
  const n = m0.sky.length;
  const bandH = Math.ceil(GROUND_TOP / n);
  const cols = Math.ceil((VIEW_W + 16) / SKY_COL);
  for (let cx = 0; cx < cols; cx++) {
    const x0 = -8 + cx * SKY_COL;
    const road = camXf + x0 + SKY_COL / 2;
    if (sc.skyShare(road, 0, SKY_LEAN) <= 0.002) continue; // still the old sky (the horizon turns first)
    for (let i = 0; i < n; i++) {
      const a = sc.skyShare(road, 1 - i / Math.max(1, n - 1), SKY_LEAN);
      const y = i * bandH + oy;
      const c = hex(lerpRGB(m0.sky[i], m1.sky[Math.min(i, m1.sky.length - 1)], a));
      b.drawScaled(S.px, x0, i === 0 ? y - 8 : y, SKY_COL, bandH + 1 + (i === 0 ? 8 : 0), c);
      if (i > 0) drawBandDither(b, S, y, x0, x0 + SKY_COL, c);
    }
  }
}

/** Sky bands, then stars, the sun and moon, and drifting clouds; where the road is turning into the next biome, its sky washes in along the road and its stars, aurora and clouds take over one by one. */
export function drawSky(b: Batcher, S: Sprites, sc: Scenery, camXf: number, tick: number, ox: number, oy: number, cover = 0): void {
  const mood = sc.mood[0];
  const allNew = sc.allNew(camXf - 8);
  drawSkyBands(b, S, allNew ? sc.mood[1] : mood, oy);
  if (!allNew && sc.n === 2 && !sc.allOld(camXf + VIEW_W + 8)) drawSkyWash(b, S, sc, camXf, oy);

  if (mood.stars > 0.02 || (sc.n === 2 && sc.mood[1].stars > 0.02)) {
    for (let i = 0; i < STAR_COUNT; i++) {
      const h = hash(i, 11);
      const x = ((((h % VIEW_W) - Math.floor(camXf * SKY_PARALLAX)) % VIEW_W) + VIEW_W) % VIEW_W;
      const y = (h >>> 10) % (GROUND_TOP - 30);
      const twinkle = ((tick >> 4) + i) % 7 === 0 ? 0.4 : 1;
      const stars = sc.n === 2 && sc.keep(1, camXf + x, flatNoise(i, 3, 12)) ? sc.mood[1].stars : mood.stars; // each star is one biome's
      if (stars > 0.02) b.drawScaled(S.px, x + ox, y + oy, 1, 1, hex(0xffffff, stars * twinkle * (0.5 + (h >>> 20 & 3) / 6)));
    }
  }

  if (mood.aurora > 0.02 || (sc.n === 2 && sc.mood[1].aurora > 0.02)) drawAurora(b, S, sc, camXf, tick, ox, oy);

  let moonScale = sc.biome[0].moonScale ?? 1;
  if (sc.n === 2) { const m1 = sc.biome[1].moonScale ?? 1; moonScale += (m1 - moonScale) * sc.share(camXf + VIEW_W * 0.28); }
  drawSunMoon(b, S, moonScale, mood, camXf, ox, oy);
  for (let i = 0; i < sc.n; i++) drawClouds(b, S, sc, i, camXf, tick, ox, oy);
  if (cover > 0.02) drawStormClouds(b, S, mood.tint, camXf, tick, ox, oy, cover);
}

const STORM_CLOUDS = 34;

/**
 * Rain clouds: big dark banks that thicken across the sky with `cover` (0..1), hiding the sun and moon. Each cloud has its
 * own threshold and fades in as the cover passes it, so the sky fills in (and empties again) one bank at a time.
 */
function drawStormClouds(b: Batcher, S: Sprites, moodTint: number, camXf: number, tick: number, ox: number, oy: number, cover: number): void {
  for (let i = 0; i < STORM_CLOUDS; i++) {
    const h = hash(i, 4242);
    const thr = ((h >>> 4) % 100) / 100 * 0.8;
    const a = Math.min(1, Math.max(0, (cover - thr) / 0.2));
    if (a <= 0.01) continue;
    const k = 0.1 + ((h >>> 12) % 5) * 0.02;
    const x = ((((i * CLOUD_PERIOD) / STORM_CLOUDS + (h % 60) + tick * (0.03 + (h % 7) * 0.006) - camXf * k) % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD - 140;
    if (x > VIEW_W) continue;
    const f = S.clouds[(h >>> 16) % S.clouds.length];
    const sc = 3 + ((h >>> 20) % 4) * 0.5;
    const y = ((h >>> 8) % (GROUND_TOP - 40)) - 10;
    const dark = 0.5 + ((h >>> 24) % 5) * 0.06 - cover * 0.15;
    b.drawScaled(f, Math.round(x) + ox, y + oy, f.w * sc, f.h * sc, shade(0xb4bac8, moodTint, dark, Math.round(255 * 0.92 * a)));
  }
}

/** The sun (reddening as it sinks) and the moon (`moonScale` times its sprite) at the clock's heights in `m`. */
function drawSunMoon(b: Batcher, S: Sprites, moonScale: number, m: { sunY: number; moonY: number }, camXf: number, ox: number, oy: number): void {
  const bx = Math.round(VIEW_W * 0.7 - camXf * SKY_PARALLAX) + ox;
  const sunY = m.sunY + oy, moonY = m.moonY + oy;
  if (m.sunY < GROUND_TOP + 24) {
    const k = Math.min(1, Math.max(0, (m.sunY - 40) / 70));
    const col = mix(0xfff6c8, 0xff8a40, k);
    b.drawScaled(S.disc, bx - 32, sunY - 32, 64, 64, hex(col, 0.14));
    b.drawScaled(S.disc, bx - 16, sunY - 16, 32, 32, hex(col, 0.3));
    b.drawScaled(S.disc, bx - 8, sunY - 8, 16, 16, hex(col));
  }
  if (m.moonY < GROUND_TOP + 12) {
    const mx = Math.round(VIEW_W * 0.28 - camXf * SKY_PARALLAX) + ox;
    const mr = 10 * moonScale;
    b.drawScaled(S.disc, mx - mr * 1.6, moonY - mr * 1.6, mr * 3.2, mr * 3.2, hex(0xc8d0ff, 0.12));
    b.drawScaled(S.moon, mx - mr, moonY - mr, S.moon.w * moonScale, S.moon.h * moonScale);
  }
}

/** Biome `pi`'s drifting cloud layers under its time-of-day tint; where the road is turning, each cloud is one biome's and fades in or out as the road passes it. */
function drawClouds(b: Batcher, S: Sprites, sc: Scenery, pi: number, camXf: number, tick: number, ox: number, oy: number): void {
  const moodTint = sc.mood[pi].tint;
  for (const layer of sc.biome[pi].clouds) {
    for (let i = 0; i < layer.count; i++) {
      const h = hash(i, Math.round(layer.k * 1000));
      const base = (i * CLOUD_PERIOD) / layer.count + (h % 90);
      const x = ((((base + tick * layer.drift - camXf * layer.k) % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD) - 80;
      if (x > VIEW_W) continue;
      const w = sc.weight(pi, camXf + x + 40, flatNoise(i, Math.round(layer.k * 1000), 17));
      if (w <= 0.01) continue;
      const y = layer.y0 + ((h >>> 8) % Math.max(1, layer.y1 - layer.y0));
      b.draw(S.clouds[(h >>> 16) % S.clouds.length], Math.round(x) + ox, y + oy, false, shade(layer.tint ?? 0xffffff, moodTint, 1, Math.round(layer.alpha * 255 * w)));
    }
  }
}

/**
 * Northern lights: three slowly undulating curtains, each drawn as 8 px columns in three stacked bands that brighten
 * toward the lower edge (the curtain's hem), in green, teal and violet. They shimmer and drift with the tick. The strength of a
 * column is its biome's.
 */
function drawAurora(b: Batcher, S: Sprites, sc: Scenery, camXf: number, tick: number, ox: number, oy: number): void {
  const COLORS = [0x40f0a0, 0x30d0c8, 0xa060f0];
  for (let r = 0; r < COLORS.length; r++) {
    const base = 34 + r * 15;
    for (let x = -8; x < VIEW_W + 8; x += 8) {
      const strength = sc.n === 2 && sc.keep(1, camXf + x, patchNoise(x, r * 30, 56, 18)) ? sc.mood[1].aurora : sc.mood[0].aurora; // each curtain column is one biome's
      if (strength <= 0.02) continue;
      const wx = x + camXf * 0.05;
      const hem = base + Math.sin(wx * 0.011 + tick * 0.006 + r * 2) * 12 + Math.sin(wx * 0.027 - tick * 0.01 + r) * 4;
      const len = 20 + 10 * Math.sin(wx * 0.02 + r + tick * 0.004);
      const shimmer = 0.75 + 0.25 * Math.sin(wx * 0.09 + tick * 0.03 + r * 3);
      for (let band = 0; band < 3; band++) {
        const a = strength * shimmer * (0.08 + band * 0.11);
        b.drawScaled(S.px, x + ox, Math.round(hem - len + (len / 3) * band) + oy, 8, Math.ceil(len / 3), hex(COLORS[r], a));
      }
    }
  }
}

/**
 * The lights on a strip. Torches: a flame that flickers between two frames and a warm glow (three nested discs).
 * Windows: a lit rectangle over each baked opening, in a color picked per window (mostly warm, a few eerie teal), with a
 * small halo; some are dark, and the odd lit one blinks out for a moment. All are emissive, so they are not dimmed by
 * the time of day and glow a little more at night.
 */
function drawLights(b: Batcher, S: Sprites, layer: ParallaxLayer, spots: readonly { x: number; y: number; w?: number; h?: number }[], sx: number, sy: number, chunk: number, tick: number, night: number, fade = 1): void {
  const lt = layer.lights, wn = layer.windows;
  for (let i = 0; i < spots.length; i++) {
    const sp = spots[i];
    const h = hash(chunk * 17 + i, 61);
    const cx = sx + sp.x, cy = sy + sp.y;
    if (sp.w && sp.h) {
      if (!wn || (h % 100) / 100 >= wn.lit) continue; // this window is dark
      if ((tick + (h >>> 8) * 7) % 420 < 14) continue; // blinks out now and then
      const col = wn.colors[(h >>> 4) % wn.colors.length];
      const a = wn.a * fade * (0.9 + 0.1 * Math.sin(tick * 0.13 + (h & 255)));
      b.drawScaled(S.px, cx, cy, sp.w, sp.h, hex(col, a));
      b.drawScaled(S.disc, cx + sp.w / 2 - (3 + sp.w), cy + sp.h / 2 - (3 + sp.w), (3 + sp.w) * 2, (3 + sp.w) * 2, hex(col, (0.1 + 0.08 * night) * fade)); // a small halo
      continue;
    }
    if (!lt) continue;
    const t = tick * 0.21 + (h & 255); // each torch flickers on its own phase
    const flick = 0.85 + 0.15 * Math.sin(t) + 0.08 * Math.sin(t * 2.7);
    const k = lt.a * fade * flick * (0.8 + 0.5 * night);
    glow(b, S, cx, cy, lt.r * (0.95 + 0.05 * flick), 0.8, lt.color, k);
    b.draw(S.flame[((tick >> 2) + h) & 1], cx - 1, cy - 1, false, rgba(255, 255, 255, Math.round(255 * fade)));
  }
}

/** Which of a layer's `n` variants fills strip `c`: pseudo-random, and never the same as its left neighbor. */
function pickChunk(c: number, salt: number, n: number): number {
  const a = hash(c, salt) % n;
  return a === hash(c - 1, salt) % n ? (a + 1 + (hash(c, salt + 1) % (n - 1))) % n : a;
}

/** The horizon: each biome's layers, far to near, with the two biomes' layers of the same depth drawn together so a near strip of one never ends up behind a far strip of the other. */
export function drawParallax(b: Batcher, S: Sprites, sc: Scenery, camXf: number, ox: number, oy: number, tick: number): void {
  const deepest = Math.max(sc.biome[0].layers.length, sc.n === 2 ? sc.biome[1].layers.length : 0);
  for (let li = 0; li < deepest; li++) {
    for (let i = 0; i < sc.n; i++) {
      if (li < sc.biome[i].layers.length) drawParallaxLayer(b, S, sc, i, li, camXf, sc.prog[i], ox, oy, tick);
    }
  }
}

/** One layer of biome `pi`'s horizon in 256 px strips. Where the road is turning, each strip is one biome's and fades in or out as the road passes it. */
function drawParallaxLayer(b: Batcher, S: Sprites, sc: Scenery, pi: number, li: number, camXf: number, progress: number, ox: number, oy: number, tick: number): void {
  const biome = sc.biome[pi], mood = sc.mood[pi];
  const layer = biome.layers[li];
  if (layer.sprite === DESTINATION_LAYER) { if (progress >= 0) drawDestination(b, S, sc, pi, camXf, progress, layer.k, ox, oy); return; }
  const frames = S.layers[layer.sprite];
  const off = Math.floor(camXf * layer.k);
  const y = GROUND_TOP - frames[0].h + (layer.dy ?? 0) + oy;
  // chain 256 px strips, each a different variant, so the same trees and ruins don't repeat along the horizon
  for (let c = Math.floor(off / 256), x = c * 256 - off + ox; x < VIEW_W + 8; c++, x += 256) {
    const w = sc.weight(pi, camXf + x - ox + 128, flatNoise(c, li, 500 + pi));
    if (w <= 0.01) continue;
    const v = pickChunk(c, 40 + li * 7, frames.length);
    b.draw(frames[v], x, y, false, shade(mood.tint, 0xffffff, 1, Math.round(255 * w)));
    const lights = (layer.lights || layer.windows) && S.layerLights[layer.sprite]?.[v];
    if (lights) drawLights(b, S, layer, lights, x, y, c, tick, mood.stars, w);
  }
}

/**
 * The next biome's landmark on the horizon. It starts small and hazed into the sky and, as the level goes on, steps
 * up through larger sizes, clears out of the haze, drifts toward the middle of the screen, and its windows light up.
 * It stands on a low rocky bluff whose foot runs down behind the ground. Once the road has turned into that biome the landmark fades from the horizon.
 */
function drawDestination(b: Batcher, S: Sprites, sc: Scenery, pi: number, camXf: number, progress: number, k: number, ox: number, oy: number): void {
  const biome = sc.biome[pi], mood = sc.mood[pi];
  const d = biome.destination;
  if (!d) return;
  const set = S.landmarks[d.landmark];
  const n = set.body.length;
  const i = Math.min(n - 1, Math.floor(progress * n));
  const body = set.body[i];
  const cx = Math.round(VIEW_W * (d.x0 + (d.x1 - d.x0) * progress) - camXf * k) + ox;
  const fade = sc.weight(pi, camXf + cx - ox, 0.5);
  if (fade <= 0.01) return;
  const x = cx - (body.w >> 1), y = GROUND_TOP - Math.round(d.lift0 + (d.lift1 - d.lift0) * progress) - body.h + oy;
  const clarity = Math.min(1, Math.max(0, progress)); // 0 far and hazy, 1 near and sharp
  const night = mood.stars;
  const haze = 0.62 * (1 - clarity) ** 1.5 + 0.08;
  const horizon = mood.sky[mood.sky.length - 1];
  b.drawScaled(S.disc, cx - body.w, y + body.h * 0.2 - body.w * 0.5, body.w * 2, body.w, hex(d.aura, (0.06 + 0.12 * clarity) * (0.6 + night) * fade));

  // the rocky peak it stands on, hanging from the castle's base and running down behind the ground
  const crag = set.crag[i];
  const cragY = y + body.h - 3; // the wall sinks a little into the rock
  const cragX = cx - (crag.w >> 1);
  const lit = shade(mood.tint, 0xffffff, 1, Math.round(255 * fade));
  b.draw(crag, cragX, cragY, false, lit);
  b.draw(set.cragMask[i], cragX, cragY, false, hex(horizon, haze * fade));

  b.draw(body, x, y, false, lit);
  b.draw(set.glow[i], x, y, false, rgba(255, 255, 255, Math.round(255 * fade * Math.min(1, (0.25 + 0.5 * clarity + night) * clarity + 0.15))));
  b.draw(set.mask[i], x, y, false, hex(horizon, haze * fade));
}

/**
 * Fog gathered at the horizon, in the horizon sky's color, drawn over the parallax layers. Where the road turns, each biome's haze
 * is drawn in 8 px columns at its share of the horizon (the same smooth wash as the sky, so the two stay in step).
 */
export function drawHaze(b: Batcher, S: Sprites, sc: Scenery, camXf: number, oy: number): void {
  const cols = Math.ceil((VIEW_W + 16) / SKY_COL);
  for (let pi = 0; pi < sc.n; pi++) {
    const { height, alpha } = sc.biome[pi].haze, col = sc.mood[pi].sky[sc.mood[pi].sky.length - 1];
    const steps = Math.ceil(height / 4);
    for (let i = 0; i < steps; i++) {
      const a = alpha * ((i + 1) / steps) ** 2;
      const y = GROUND_TOP - height + i * 4 + oy;
      if (sc.n === 1) { b.drawScaled(S.px, -8, y, VIEW_W + 16, 4, hex(col, a)); continue; }
      for (let cx = 0; cx < cols; cx++) {
        const sx = -8 + cx * SKY_COL;
        const s = sc.skyShare(camXf + sx + SKY_COL / 2, 0, SKY_LEAN);
        const w = pi === 1 ? s : 1 - s;
        if (w > 0.004) b.drawScaled(S.px, sx, y, SKY_COL, 4, hex(col, a * w));
      }
    }
  }
}

/** Does biome `pi` own the ground at road x `wx`, screen y `y`? The floor, patches, decals and the path ask the same question of the same 8 px cell, so a decal never stands on the other biome's floor. */
function ownsGround(sc: Scenery, pi: number, wx: number, y: number): boolean {
  if (sc.n === 1) return pi === 0;
  const cx = Math.floor(wx / GROUND_CELL), cy = Math.floor((y - GROUND_TOP) / GROUND_CELL);
  return sc.keep(pi, cx * GROUND_CELL + GROUND_CELL / 2, groundNoise(cx, cy));
}

/**
 * A paved floor: rows of irregular slabs, staggered like brickwork, all one constant size (characters do not scale with
 * depth, so the floor must not either). Each row is cut into 192 px cells whose slab boundaries come from a hash of
 * (cell, row), shifted per row, so the slabs are anchored to world x and hold still as the camera scrolls. Brightness
 * still falls off toward the horizon as lighting. `overlay`: only the slabs this biome owns (it is drawn over the other biome's floor).
 */
function drawFlagstones(b: Batcher, S: Sprites, f: Extract<GroundDef['floor'], { kind: 'flagstones' }>, mood: BlendedMood, camX: number, oy: number, sc: Scenery, pi: number, overlay: boolean): void {
  const CELL = 192, [minW, maxW] = f.slabW;
  let r = 0;
  for (let y = GROUND_TOP; y < VIEW_H; y += f.rowH, r++) {
    const rowH = Math.min(f.rowH, VIEW_H - y);
    const v = depthShade(y + rowH / 2);
    const mortar = shade(f.mortar, mood.tint, v);
    const shift = hash(r, 3) % CELL;
    for (let i = Math.floor((camX - shift) / CELL); i * CELL + shift < camX + VIEW_W; i++) {
      let x = 0, k = 0;
      while (x < CELL) {
        const h = hash(i * 31 + k, r + 700);
        let w = minW + (h % (maxW - minW + 1));
        if (CELL - (x + w) < minW) w = CELL - x; // the last slab takes what is left
        const wx = i * CELL + shift + x, sx = wx - camX;
        if (sx < VIEW_W && sx + w > 0 && (!overlay || ownsGround(sc, pi, wx + (w >> 1), y + (rowH >> 1)))) {
          const lum = v * (0.92 + ((h >>> 8) % 17) / 100);
          const x0 = Math.max(0, sx), x1 = Math.min(VIEW_W, sx + w);
          b.drawScaled(S.px, x0, y + oy, x1 - x0, rowH, mortar); // the mortar showing between slabs
          const s0 = Math.max(0, sx + 1);
          b.drawScaled(S.px, s0, y + oy, x1 - s0, Math.max(1, rowH - 1), shade(f.slabs[(h >>> 4) % f.slabs.length], mood.tint, lum));
          b.drawScaled(S.px, s0, y + oy, x1 - s0, 1, shade(f.lit, mood.tint, lum)); // lit top edge
          if ((h >>> 12) % 11 === 0 && sx + (w >> 1) >= 0 && sx + (w >> 1) < VIEW_W) { // a crack
            b.drawScaled(S.px, sx + (w >> 1), y + 2 + oy, 1, Math.max(1, rowH - 4), shade(0x1c1a26, mood.tint, 1));
          }
        }
        x += w;
        k++;
      }
    }
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A gust moving across the field: a pixel of sway to either side (or none), in step along the ground so it ripples. */
function swayAt(wx: number, tick: number, wind: number): number {
  return wind ? Math.round(wind * 1.4 * Math.sin(tick * 0.05 + wx * 0.04)) : 0;
}

/** The path's center (screen y) at world x: a lazy S-curve across the field. */
function pathY(wx: number): number {
  return FIELD_Y0 + 122 + 38 * Math.sin(wx * 0.0042) + 14 * Math.sin(wx * 0.0113 + 1.3);
}

/** Ground art tinted for its depth: lit by the mood and darker (and a touch cooler) toward the horizon. */
function depthTint(tint: number, y: number): number {
  return shade(0xffffff, tint, depthShade(y), 255, 1 + (1 - groundDepth(y)) * 0.04);
}

/** A shared frame for drawing one 8 px quarter of a 16 px tile. */
const quarter: Frame = { u0: 0, v0: 0, u1: 0, v1: 0, w: 8, h: 8 };
function drawQuarter(b: Batcher, f: Frame, x: number, y: number, qx: number, qy: number, tint: number): void {
  const ku = (f.u1 - f.u0) / f.w, kv = (f.v1 - f.v0) / f.h;
  quarter.u0 = f.u0 + qx * 8 * ku; quarter.u1 = quarter.u0 + 8 * ku;
  quarter.v0 = f.v0 + qy * 8 * kv; quarter.v1 = quarter.v0 + 8 * kv;
  b.draw(quarter, x + qx * 8, y + qy * 8, false, tint);
}

/**
 * The floor surface: flat tiles, or a paved floor. The first biome is drawn whole (it is the ground beneath), the second's floor goes over it
 * where it owns the ground: a whole tile where it owns all four of the tile's 8 px quarters, otherwise just the quarters it owns.
 */
function drawFloor(b: Batcher, S: Sprites, sc: Scenery, pi: number, camX: number, oy: number): void {
  const g = sc.biome[pi].ground, mood = sc.mood[pi], overlay = pi === 1;
  if (g.floor.kind === 'flagstones') { drawFlagstones(b, S, g.floor, mood, camX, oy, sc, pi, overlay); return; }
  const tx0 = Math.floor(camX / 16), tx1 = Math.floor((camX + VIEW_W) / 16);
  const rows = Math.ceil((VIEW_H - GROUND_TOP) / 16);
  const tiles = S.groundSets[g.floor.set];
  for (let ty = 0; ty < rows; ty++) {
    const y = GROUND_TOP + ty * 16;
    const tint = depthTint(mood.tint, y + 8);
    for (let tx = tx0; tx <= tx1; tx++) {
      const h = Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663);
      const f = tiles[((h >>> 8) & 0xffff) % tiles.length];
      if (!overlay) { b.draw(f, tx * 16 - camX, y + oy, false, tint); continue; }
      let mask = 0;
      for (let q = 0; q < 4; q++) if (sc.keep(1, tx * 16 + (q & 1) * 8 + 4, groundNoise(tx * 2 + (q & 1), ty * 2 + (q >> 1)))) mask |= 1 << q;
      if (mask === 15) b.draw(f, tx * 16 - camX, y + oy, false, tint);
      else for (let q = 0; q < 4; q++) if (mask & (1 << q)) drawQuarter(b, f, tx * 16 - camX, y + oy, q & 1, q >> 1, tint);
    }
  }
}

/** Stippled blotches, lighter and darker, over a jittered grid. */
function drawMottle(b: Batcher, S: Sprites, sc: Scenery, pi: number, camX: number, oy: number): void {
  const g = sc.biome[pi].ground, mood = sc.mood[pi];
  const CELL_W = 192, CELL_H = 112;
  const alpha = Math.round(g.mottle.alpha * 255);
  for (let cy = 0; cy < Math.ceil((VIEW_H - GROUND_TOP) / CELL_H) + 1; cy++) {
    for (let cx = Math.floor((camX - 140) / CELL_W); cx <= Math.floor((camX + VIEW_W) / CELL_W); cx++) {
      const h = hash(cx, cy + 40);
      const x = cx * CELL_W + ((h >>> 12) % 60) - camX, y = GROUND_TOP + cy * CELL_H + ((h >>> 18) % 40) + oy;
      if (!ownsGround(sc, pi, x + camX, y - oy)) continue;
      b.draw(S.patch['mottle' + ((h >>> 3) & 3)], x, y, (h & 0x10) !== 0, shade(h & 0x100 ? g.mottle.light : g.mottle.dark, mood.tint, 1, alpha));
    }
  }
}

/** The path: a continuous ribbon in 2 px columns aligned to the world, so it holds still as the camera moves. Each column belongs to one biome. */
function drawPath(b: Batcher, S: Sprites, sc: Scenery, pi: number, pa: NonNullable<GroundDef['path']>, camX: number, oy: number): void {
  const mood = sc.mood[pi];
  for (let wx = Math.floor(camX / 2) * 2; wx < camX + VIEW_W; wx += 2) {
    const c = pathY(wx);
    if (!ownsGround(sc, pi, wx, c)) continue;
    const half = pa.half + 2 * Math.sin(wx * 0.031) + 1.5 * Math.sin(wx * 0.083 + 2);
    const h = hash(wx >> 1, 31);
    const top = Math.round(c - half) + ((h & 3) === 0 ? 1 : 0), bot = Math.round(c + half) - ((h & 12) === 0 ? 1 : 0);
    const v = depthShade(c);
    const x = wx - camX;
    b.drawScaled(S.px, x, top - 1 + oy, 2, bot - top + 3, shade(pa.edge, mood.tint, v));
    b.drawScaled(S.px, x, top + oy, 2, bot - top + 1, shade(pa.fill, mood.tint, v));
    b.drawScaled(S.px, x, top + oy, 2, 1, shade(pa.lip, mood.tint, v));
    if (pa.ruts !== undefined) { // wheel ruts, in occasional stretches rather than all along the road
      const rut = shade(pa.ruts, mood.tint, v);
      const SEG = 112, seg = Math.floor(wx / SEG), at = wx - seg * SEG;
      for (let side = 0; side < 2; side++) {
        const hs = hash(seg, 71 + side * 7);
        if (hs % 100 >= 38) continue; // this rut is not here in this stretch
        const from = (hs >>> 8) % 40, to = SEG - ((hs >>> 16) % 40); // ragged start and end
        if (at < from || at >= to || (h >>> 5) % 6 === 0) continue; // and the odd gap within it
        const off = 3 + ((hs >>> 24) % 3); // how far from the middle varies stretch to stretch
        b.drawScaled(S.px, x, Math.round(c + (side ? off : -off) + 1.3 * Math.sin(wx * 0.05 + side * 2)) + oy, 2, 1, rut);
      }
    }
    if (pa.fringe && (h >>> 20) % 4 === 0) { // grass fraying the edges
      const g = shade(pa.fringe[(h >>> 4) % pa.fringe.length], mood.tint, v);
      b.drawScaled(S.px, x + (h & 1), top - 2 + oy, 1, 2, g);
      if ((h >>> 12) & 1) b.drawScaled(S.px, x + (h & 1), bot + 1 + oy, 1, 2, g);
    }
    const k = (h >>> 8) % 11; // the odd speck
    if (k < 3) b.drawScaled(S.px, x, top + 2 + ((h >>> 16) % Math.max(1, bot - top - 3)) + oy, k === 0 ? 2 : 1, 1, shade(k < 2 ? pa.speck : pa.speck2, mood.tint, v));
  }
}

/** Patches (mud, puddles, blood...) scattered over a grid, one per cell with some probability, kept clear of the path. */
function drawPatches(b: Batcher, S: Sprites, sc: Scenery, pi: number, camX: number, oy: number): void {
  const g = sc.biome[pi].ground, mood = sc.mood[pi];
  const pc = g.patches;
  for (let cy = 0; cy < Math.ceil((VIEW_H - GROUND_TOP) / (pc.cell * 0.6)) + 1; cy++) {
    for (let cx = Math.floor((camX - 64) / pc.cell); cx <= Math.floor((camX + VIEW_W) / pc.cell); cx++) {
      const h = hash(cx, cy + 90);
      if ((h % 100) / 100 >= pc.chance) continue;
      const f = S.patch[pc.sprites[(h >>> 8) % pc.sprites.length]];
      const wx = cx * pc.cell + ((h >>> 12) % pc.cell), y = GROUND_TOP + 14 + cy * pc.cell * 0.6 + ((h >>> 20) % 30);
      if (g.path && Math.abs(y - pathY(wx)) < 30) continue;
      if (!ownsGround(sc, pi, wx, y)) continue;
      b.draw(f, wx - camX - (f.w >> 1), Math.round(y) + oy, (h & 0x2000) !== 0, depthTint(mood.tint, y));
    }
  }
}

/** Small flat decals picked from a weighted table, one candidate per cell. Flames flicker; some decals glow. */
function drawDecor(b: Batcher, S: Sprites, sc: Scenery, pi: number, camX: number, oy: number, tick: number): void {
  const biome = sc.biome[pi], g = biome.ground, mood = sc.mood[pi], wind = biome.wind ?? 0;
  const d = g.decor;
  let total = 0;
  for (const k of d.table) total += k.w;
  const rows = Math.ceil((VIEW_H - GROUND_TOP - 8) / d.cellH);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = Math.floor(camX / d.cellW) - 1; cx <= Math.floor((camX + VIEW_W) / d.cellW); cx++) {
      const h = hash(cx, cy + 200);
      if ((h % 1000) / 1000 >= d.density) continue;
      let pick = (((h >>> 10) % 1000) / 1000) * total, kind = d.table[0];
      for (const k of d.table) { pick -= k.w; if (pick < 0) { kind = k; break; } }
      const wx = cx * d.cellW + ((h >>> 4) % d.cellW), y = GROUND_TOP + 8 + cy * d.cellH + ((h >>> 20) % d.cellH);
      if (g.path && !kind.onPath && Math.abs(y - pathY(wx)) < 14) continue;
      if (!ownsGround(sc, pi, wx, y)) continue;
      const lit = kind.alt !== undefined && ((tick >> 3) + (h & 7)) % 2 === 1; // a flickering flame swaps frames
      const f = S.decor[lit ? kind.alt! : kind.sprite];
      const sway = kind.sway ? swayAt(wx, tick, wind) : 0;
      b.draw(f, wx - camX + sway, y - f.h + oy, (h & 0x4000) !== 0, depthTint(mood.tint, y));
      if (kind.glow) glow(b, S, wx - camX + (f.w >> 1), y - (f.h >> 1) + oy, kind.glow.r + (lit ? 1 : 0), 0.6, kind.glow.color, kind.glow.a * (lit ? 1.25 : 1));
    }
  }
}

/**
 * The floor: its surface, soft mottling, the path and patches, then flat decals. Everything is a function of world
 * position (cosmetic hashes), so it holds still as the camera scrolls. Where the road is turning into the next biome both
 * are drawn, and every tile, patch, decal and stretch of path belongs to one of them (`Scenery`).
 */
export function drawGround(b: Batcher, S: Sprites, sc: Scenery, camX: number, oy: number, tick: number): void {
  const first = sc.allNew(camX) ? 1 : 0, last = sc.n === 2 && !sc.allOld(camX + VIEW_W) ? 1 : 0;
  for (let pi = first; pi <= last; pi++) drawFloor(b, S, sc, pi, camX, oy);
  for (let pi = first; pi <= last; pi++) drawMottle(b, S, sc, pi, camX, oy);
  for (let pi = first; pi <= last; pi++) { const pa = sc.biome[pi].ground.path; if (pa) drawPath(b, S, sc, pi, pa, camX, oy); }
  for (let pi = first; pi <= last; pi++) drawPatches(b, S, sc, pi, camX, oy);
  for (let pi = first; pi <= last; pi++) drawDecor(b, S, sc, pi, camX, oy, tick);
}

/**
 * Ground fog: dithered wisps that drift slowly along the floor, over the floor and decals but under the characters (so
 * a horde stays readable). Each layer's wisps wrap around a 960 px loop that scrolls with the camera by `k` and slides by
 * `drift` per tick, so they never run out and the fog never seems to follow the camera exactly. Each wisp is one biome's.
 */
export function drawFog(b: Batcher, S: Sprites, sc: Scenery, camX: number, oy: number, tick: number): void {
  for (let pi = 0; pi < sc.n; pi++) {
    const biome = sc.biome[pi], mood = sc.mood[pi];
    if (!biome.fog) continue;
    const LOOP = 960;
    const prog = Math.max(0, sc.prog[pi]);
    for (const layer of biome.fog) {
      // morning mist thins out and is gone by `until`
      const burn = layer.until === undefined ? 1 : 1 - smoothstep(layer.until - 0.25, layer.until, prog);
      if (burn <= 0.01) continue;
      for (let i = 0; i < layer.count; i++) {
        const h = hash(i, Math.round(layer.k * 100) + 300);
        const wisps = layer.big ? S.fogLarge : S.fog;
        const f = wisps[h % wisps.length];
        const base = (i * LOOP) / layer.count + ((h >>> 8) % 60);
        const x = ((((base + tick * layer.drift - camX * layer.k) % LOOP) + LOOP) % LOOP) - (layer.big ? 400 : 224);
        if (x > VIEW_W) continue;
        const w = sc.weight(pi, camX + x + (f.w >> 1), flatNoise(i, Math.round(layer.k * 100), 19));
        if (w <= 0.01) continue;
        const y = layer.y0 + ((h >>> 16) % Math.max(1, layer.y1 - layer.y0));
        b.draw(f, Math.round(x), y + oy, (h & 0x100) !== 0, shade(layer.color, mood.tint, 1, Math.round(layer.alpha * burn * w * 255)));
      }
    }
  }
}

/**
 * Specks carried on the wind (petals, embers, dust), drawn last so they drift over everything. Each speck picks its own
 * heading and speed (plus the biome's gentle prevailing drift), so they wander every which way. Each wraps around a
 * 1280 px loop at its own parallax depth; nearer ones cross the screen faster. Each speck is one biome's.
 */
export function drawAmbient(b: Batcher, S: Sprites, sc: Scenery, camX: number, oy: number, tick: number): void {
  for (let pi = 0; pi < sc.n; pi++) {
    const a = sc.biome[pi].ambient, mood = sc.mood[pi];
    if (!a) continue;
    const LOOP = 1280, rangeY = a.y1 - a.y0;
    for (let i = 0; i < a.count; i++) {
      const h = hash(i, 555);
      const k = a.k[0] + (a.k[1] - a.k[0]) * ((h & 255) / 255);
      const ang = (((h >>> 12) & 1023) / 1024) * Math.PI * 2, sp = a.speed * (0.5 + 0.8 * (((h >>> 22) & 255) / 255));
      const vx = Math.cos(ang) * sp + a.bias[0], vy = Math.sin(ang) * sp * 0.6 + a.bias[1]; // flatter than wide: they float, they don't fall
      const wob = Math.sin(tick * 0.04 + (h >>> 8)) * a.wobble;
      const x = ((((h >>> 8) % LOOP) + tick * vx * k - camX * k) % LOOP + LOOP) % LOOP - 320 + wob;
      if (x < -4 || x > VIEW_W) continue;
      const w = sc.weight(pi, camX + x, flatNoise(i, 1, 20));
      if (w <= 0.01) continue;
      const y = a.y0 + ((((h >>> 16) % rangeY) + tick * vy * k + Math.cos(tick * 0.03 + i) * a.wobble * 0.5) % rangeY + rangeY) % rangeY;
      const flip = ((tick >> 4) + i) & 1; // tumbling
      b.drawScaled(S.px, Math.round(x), Math.round(y) + oy, flip ? a.h : a.w, flip ? a.w : a.h, shade(a.colors[(h >>> 4) % a.colors.length], mood.tint, 1, Math.round(a.alpha * 255 * w)));
    }
  }
}

/** The hill's crest: an uneven grassy edge in front of the climbers. Biome 0's is drawn whole, biome 1's over it column by column where it owns the ground. */
export function drawCrest(b: Batcher, S: Sprites, sc: Scenery, camX: number, oy: number): void {
  const first = sc.allNew(camX) ? 1 : 0, last = sc.n === 2 && !sc.allOld(camX + VIEW_W) ? 1 : 0;
  for (let pi = first; pi <= last; pi++) {
    const crest = sc.biome[pi].crest, mood = sc.mood[pi];
    const fill = shade(crest.fill, mood.tint), edge = shade(crest.edge, mood.tint);
    for (let px = 0; px < VIEW_W; px += 2) {
      const wx = camX + px;
      if (pi === 1 && !ownsGround(sc, 1, wx, GROUND_TOP)) continue;
      const bump = Math.round(1.7 * (1 + Math.sin(wx * 0.07) * 0.6 + Math.sin(wx * 0.21) * 0.4));
      if (bump > 0) {
        b.drawScaled(S.px, px, GROUND_TOP - bump + oy, 2, bump + 1, fill);
        b.drawScaled(S.px, px, GROUND_TOP - bump + oy, 2, 1, edge);
      }
    }
  }
}

/** Screen y of the foreground ridge's top edge at world x. */
function ridgeTop(wx: number): number {
  return RIDGE_TOP + Math.round(1.6 * (1 + Math.sin(wx * 0.045) * 0.7 + Math.sin(wx * 0.13) * 0.3));
}

/** The foreground ridge along the bottom of the field: enemies coming from below walk up from behind it. Where the road turns, each column and blade of grass is one biome's. */
export function drawRidge(b: Batcher, S: Sprites, sc: Scenery, camX: number, oy: number, tick: number): void {
  const first = sc.allNew(camX) ? 1 : 0, last = sc.n === 2 && !sc.allOld(camX + VIEW_W) ? 1 : 0;
  for (let pi = first; pi <= last; pi++) {
    const ridge = sc.biome[pi].ridge, mood = sc.mood[pi], wind = sc.biome[pi].wind ?? 0;
    const fill = shade(ridge.fill, mood.tint), edge = shade(ridge.edge, mood.tint), lip = shade(ridge.shade, mood.tint);
    for (let px = 0; px < VIEW_W; px += 2) {
      if (pi === 1 && !ownsGround(sc, 1, camX + px, VIEW_H)) continue;
      const top = ridgeTop(camX + px);
      b.drawScaled(S.px, px, top + oy, 2, VIEW_H - top + 8, fill);
      b.drawScaled(S.px, px, top + oy, 2, 1, edge);
      b.drawScaled(S.px, px, top + 1 + oy, 2, 1, lip);
    }
    // blades poking up along the edge, one pixel wide at world positions (so they hold still as the camera moves)
    for (let px = 0; px < VIEW_W; px++) {
      const h = hash(camX + px, 5);
      if (h % 6 !== 0) continue;
      if (sc.n === 2 && !ownsGround(sc, pi, camX + px, VIEW_H)) continue;
      const bh = 2 + ((h >>> 8) % 3), top = ridgeTop(camX + px);
      b.drawScaled(S.px, px, top - bh + 1 + oy, 1, bh - 1, fill);
      b.drawScaled(S.px, px + swayAt(camX + px, tick, wind), top - bh + oy, 1, 1, edge); // the tip leans in the wind
    }
  }
}
