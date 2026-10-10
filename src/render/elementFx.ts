// Shared looks for the elements (data/elements.ts): the palette, a few tiny pixel-drawing helpers, and the particle recipes behind an
// element's burst, lightning arc, breath (cone) and beam. Everything is deterministic and allocation-free in the draw helpers:
// zones and projectiles are drawn every frame. The pictures of the skills themselves (projectiles, zones, telegraphs) are in elementDraw.ts;
// fx.ts feeds the sim's events into the recipes here through the `Sink` interface (the `Fx` particle store implements it).
import { ELEMENT_COUNT, ELEMENTS } from '../data/elements';
import { hex } from '../platform/gl/batcher';
import type { Batcher } from '../platform/gl/batcher';
import type { Sprites } from './art';

/** Which colour of an element's palette. */
export const CORE = 0, GLOW = 1, DEEP = 2, SPARK = 3;
export type Tone = 0 | 1 | 2 | 3;

const PAL: number[][] = [];
for (let i = 0; i < ELEMENT_COUNT; i++) PAL.push([ELEMENTS[i].core, ELEMENTS[i].glow, ELEMENTS[i].deep, ELEMENTS[i].spark]);

/** A usable element id (anything unknown is physical). */
export const elemId = (el: number | undefined): number => (el !== undefined && el > 0 && el < ELEMENT_COUNT ? el | 0 : 0);
/** 0xRRGGBB of one tone of an element. */
export const rgbOf = (el: number, tone: number): number => PAL[elemId(el)][tone];
/** The packed colour (with alpha) the batcher wants. */
export const tint = (el: number, tone: number, alpha = 1): number => hex(PAL[elemId(el)][tone], alpha);
/** Mixes two 0xRRGGBB colours (t = 0 gives a, 1 gives b). */
export function mixRgb(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}
/** A dimmer (t < 0) or lighter (t > 0) version of a tone: a cheap way to get a fifth colour. */
export const shade = (el: number, tone: number, t: number): number => mixRgb(PAL[elemId(el)][tone], t < 0 ? 0x000000 : 0xffffff, Math.abs(t));

/** A repeatable 0..1 number from an integer (a hash, not a random: the same pixel flickers the same way every frame it is asked for). */
export function hash01(n: number): number {
  let h = Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// --- pixel drawing (all take the batcher and the sprite set whose `px` is a single white pixel)

/** A w x h box of one colour, snapped to whole pixels. */
export function box(b: Batcher, S: Sprites, x: number, y: number, w: number, h: number, c: number): void {
  b.drawScaled(S.px, Math.round(x), Math.round(y), w, h, c);
}

/** A filled disc as one strip per pixel row. */
export function disc(b: Batcher, S: Sprites, cx: number, cy: number, r: number, c: number): void {
  const x0 = Math.round(cx), y0 = Math.round(cy), n = Math.max(0, Math.round(r));
  if (n === 0) { b.drawScaled(S.px, x0, y0, 1, 1, c); return; }
  for (let dy = -n; dy <= n; dy++) {
    const half = Math.sqrt(Math.max(0, r * r + 0.5 - dy * dy));
    const w = Math.max(1, Math.round(half * 2));
    b.drawScaled(S.px, Math.round(x0 - w / 2), y0 + dy, w, 1, c);
  }
}

/** A pixel line (1 px thick) from (x0, y0) to (x1, y1); `step` > 1 makes it dotted. */
export function pline(b: Batcher, S: Sprites, x0: number, y0: number, x1: number, y1: number, c: number, step = 1): void {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / step));
  for (let k = 0; k <= n; k++) b.drawScaled(S.px, Math.round(x0 + (dx * k) / n), Math.round(y0 + (dy * k) / n), 1, 1, c);
}

/**
 * A jagged lightning line: `segs` straight pieces whose joints are shoved sideways by up to `amp` px (from `seed`, so it holds still until the seed changes).
 * Drawn twice, `c` as the body and `hot` as a one-pixel-thick bright core when given.
 */
export function jagged(b: Batcher, S: Sprites, x0: number, y0: number, x1: number, y1: number, seed: number, amp: number, segs: number, c: number, hot = -1): void {
  const dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  let px = x0, py = y0;
  for (let k = 1; k <= segs; k++) {
    const u = k / segs, off = k === segs ? 0 : (hash01(seed * 31 + k) - 0.5) * 2 * amp;
    const qx = x0 + dx * u + nx * off, qy = y0 + dy * u + ny * off;
    pline(b, S, px, py, qx, qy, c);
    if (hot >= 0) pline(b, S, px, py + 0, qx, qy, hot, 2);
    px = qx; py = qy;
  }
}

/** A small flame lick standing on (x, y): `h` tall, flickering from `seed`/`tick`; palette = the element's (fire for a fire, but any works). */
export function flame(b: Batcher, S: Sprites, x: number, y: number, h: number, tick: number, seed: number, el: number, alpha = 1): void {
  const f = hash01(seed * 7 + (tick >> 1));
  const hh = Math.max(2, Math.round(h * (0.75 + 0.5 * f)));
  const sway = f < 0.33 ? -1 : f > 0.66 ? 1 : 0;
  box(b, S, x - 1, y - Math.ceil(hh * 0.45), 3, Math.ceil(hh * 0.45), tint(el, CORE, alpha));
  box(b, S, x - 0 + (sway > 0 ? 0 : -0), y - Math.ceil(hh * 0.8), 1 + (hh > 4 ? 1 : 0), Math.ceil(hh * 0.8), tint(el, GLOW, alpha));
  box(b, S, x + sway, y - hh, 1, 1, tint(el, SPARK, alpha));
  box(b, S, x - 1, y - 1, 3, 1, tint(el, DEEP, alpha * 0.9));
}

/** An icicle/crystal standing on (x, y), `h` tall and 3 wide at its foot: a dark edge, a pale body and a bright tip. */
export function crystal(b: Batcher, S: Sprites, x: number, y: number, h: number, el: number, alpha = 1, glint = false): void {
  box(b, S, x - 1, y - 1, 3, 1, tint(el, DEEP, alpha));
  box(b, S, x - 1, y - Math.ceil(h * 0.5), 3, Math.ceil(h * 0.5) - 1, tint(el, CORE, alpha));
  box(b, S, x, y - h, 1, h - 1, tint(el, GLOW, alpha));
  box(b, S, x, y - h, 1, 1, tint(el, SPARK, alpha));
  if (glint) box(b, S, x - 1, y - h + 1, 3, 1, tint(el, SPARK, alpha * 0.8));
}

/** A little rune: a plus with its four corner pips, turning in quarter steps with `spin`. Radius 2 or 3. */
export function rune(b: Batcher, S: Sprites, cx: number, cy: number, spin: number, el: number, alpha = 1, big = false): void {
  const c = tint(el, GLOW, alpha), d = tint(el, CORE, alpha * 0.9);
  const q = spin & 3;
  box(b, S, cx, cy, 1, 1, tint(el, SPARK, alpha));
  if (q & 1) { box(b, S, cx - 1, cy - 1, 1, 1, c); box(b, S, cx + 1, cy - 1, 1, 1, c); box(b, S, cx - 1, cy + 1, 1, 1, c); box(b, S, cx + 1, cy + 1, 1, 1, c); box(b, S, cx - 1, cy, 3, 1, d); }
  else { box(b, S, cx - 1, cy, 3, 1, c); box(b, S, cx, cy - 1, 1, 3, c); box(b, S, cx - 1, cy - 1, 1, 1, d); box(b, S, cx + 1, cy + 1, 1, 1, d); }
  if (big) { box(b, S, cx - 2, cy, 1, 1, d); box(b, S, cx + 2, cy, 1, 1, d); box(b, S, cx, cy - 2, 1, 1, d); box(b, S, cx, cy + 2, 1, 1, d); }
}

/** A flat, slightly ragged puddle: an ellipse (height 0.72 of its width) of one colour, row by row, its edge wobbling from `seed`. */
export function pond(b: Batcher, S: Sprites, cx: number, cy: number, r: number, seed: number, c: number): void {
  const ry = Math.max(2, Math.round(r * 0.72)), y0 = Math.round(cy);
  for (let dy = -ry; dy <= ry; dy++) {
    const u = dy / ry, half = r * Math.sqrt(Math.max(0, 1 - u * u)) * (0.86 + 0.14 * hash01(seed * 13 + dy));
    const w = Math.round(half * 2);
    if (w < 1) continue;
    const sh = Math.round((hash01(seed * 7 + dy * 3) - 0.5) * 2);
    b.drawScaled(S.px, Math.round(cx - w / 2 + sh), y0 + dy, w, 1, c);
  }
}

/** A ring of 1-px dots on the flattened ground (squash `sq` ~ 0.7-0.85), as the telegraphs draw: n dots at radius r. */
export function dotRing(b: Batcher, S: Sprites, cx: number, cy: number, r: number, n: number, c: number, sq = 0.8, phase = 0, size = 1): void {
  const half = size === 1 ? 0 : 0.5;
  for (let d = 0; d < n; d++) {
    const a = (d / n) * 6.2832 + phase;
    b.drawScaled(S.px, Math.round(cx + Math.cos(a) * r - half), Math.round(cy + Math.sin(a) * r * sq - half), size, size, c);
  }
}

/** A danger ring on the ground: 2-px dots in the element's core colour over a darker copy one pixel lower, so it holds on sand, snow and grass alike. */
export function warnRing(b: Batcher, S: Sprites, cx: number, cy: number, r: number, n: number, el: number, alpha: number, sq = 0.85, phase = 0): void {
  dotRing(b, S, cx, cy + 1, r, n, tint(el, DEEP, Math.min(1, alpha * 0.95)), sq, phase, 2);
  dotRing(b, S, cx, cy, r, n, tint(el, CORE, alpha), sq, phase, 2);
}

/** A star-shaped sparkle `arm` px long (a plus with a bright core). */
export function sparkle(b: Batcher, S: Sprites, x: number, y: number, arm: number, el: number, alpha = 1): void {
  const x0 = Math.round(x), y0 = Math.round(y);
  b.drawScaled(S.px, x0 - arm, y0, arm * 2 + 1, 1, tint(el, GLOW, alpha));
  b.drawScaled(S.px, x0, y0 - arm, 1, arm * 2 + 1, tint(el, GLOW, alpha));
  b.drawScaled(S.px, x0, y0, 1, 1, tint(el, SPARK, alpha));
}

// --- particle recipes

/** The particle store the recipes spawn into (the `Fx` class implements it). Gravity (px/tick^2) defaults to 0.12, drag and spin to none. */
export interface Sink {
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, col: number, big?: number, grav?: number, drag?: number, spin?: number): void;
  rand(): number;
}

/** How one element's particles behave. Counts are for a radius-20 burst. */
interface Recipe {
  n: number;
  /** 0 from the centre, 1 anywhere in the disc, 2 on the rim. */
  place: 0 | 1 | 2;
  /** 0 out from the centre, 1 in toward it, 2 round it (tangent), 3 no sideways motion. */
  dir: 0 | 1 | 2 | 3;
  speed: readonly [number, number];
  vz: readonly [number, number];
  z0: readonly [number, number];
  life: readonly [number, number];
  grav: number;
  drag: number;
  spin: number;
  /** Chance a particle is 2x2. */
  big: number;
  /** Palette tones chosen from at random. */
  cols: readonly Tone[];
}

const R = (n: number, place: 0 | 1 | 2, dir: 0 | 1 | 2 | 3, speed: [number, number], vz: [number, number], z0: [number, number], life: [number, number], grav: number, drag: number, spin: number, big: number, cols: Tone[]): Recipe =>
  ({ n, place, dir, speed, vz, z0, life, grav, drag, spin, big, cols });

/** A burst of each element (index = element id). */
const BURST: readonly Recipe[] = [
  R(14, 0, 0, [0.8, 2], [0.3, 1], [1, 2], [16, 22], 0.12, 0.94, 0, 0.4, [1, 3]),                         // physical: a puff
  R(26, 1, 0, [0.1, 0.5], [0.3, 0.9], [0, 4], [24, 38], 0.012, 1, 0, 0.35, [0, 1, 0, 2]),                // fire: embers rising, orange to red
  R(26, 0, 0, [1.4, 3.2], [0.3, 1.2], [1, 3], [22, 30], 0.1, 0.9, 0, 0.7, [1, 3, 0, 2]),                 // ice: shards that stop and fall
  R(10, 0, 0, [1.5, 3], [0, 0.6], [2, 5], [6, 10], 0.1, 0.85, 0, 0, [3, 1]),                              // lightning: sparks (arcs are added in code)
  R(22, 1, 3, [0, 0.12], [0.35, 0.9], [0, 3], [30, 46], 0, 1, 0, 0.3, [0, 1, 3]),                         // poison: bubbles rising
  R(22, 2, 1, [0.35, 0.8], [0.1, 0.4], [2, 8], [28, 40], 0, 1, 0, 0.5, [2, 0, 2, 1]),                    // shadow: wisps drifting in
  R(24, 1, 3, [0, 0.1], [0.5, 1.2], [0, 6], [28, 44], 0, 1, 0, 0.4, [1, 3, 0, 2]),                       // holy: sparkles rising
  R(12, 0, 0, [1, 2.4], [1.4, 2.6], [1, 2], [26, 36], 0.12, 0.97, 0, 1, [0, 2, 0, 1]),                    // earth: chunks in an arc
  R(28, 2, 2, [1.3, 2.2], [0, 0.3], [2, 8], [20, 28], 0, 1, 0.11, 0.3, [1, 3, 0, 2]),                      // wind: swirling streaks
  R(20, 1, 2, [0.3, 0.9], [0.3, 0.8], [0, 6], [28, 40], 0, 1, -0.06, 0.4, [0, 1, 3]),                     // arcane: sparkles
  R(22, 0, 0, [1, 2.5], [1.2, 2.4], [1, 3], [22, 32], 0.12, 0.97, 0, 0.6, [0, 1, 2]),                     // blood: droplets in arcs
];
/** Extra particles some bursts throw besides: earth's dust. */
const BURST_EXTRA: ReadonlyArray<Recipe | null> = [
  null, null, null, null, null, null, null,
  R(12, 1, 0, [0.3, 1], [0.2, 0.6], [0, 2], [18, 26], 0.03, 0.9, 0, 0.5, [1, 3]),
  null, null, null,
];

/** A breath (cone) of each element: the same recipe fields, with `speed` unused (a particle is aimed to die near its distance). */
const CONE: readonly Recipe[] = [
  R(60, 0, 0, [0, 0], [0.1, 0.4], [3, 7], [10, 15], 0.02, 1, 0, 0.4, [1, 3]),
  R(80, 0, 0, [0, 0], [0.1, 0.5], [3, 8], [11, 17], 0.012, 1, 0, 0.5, [0, 1, 0, 2]),
  R(70, 0, 0, [0, 0], [0.3, 0.8], [2, 6], [11, 16], 0.05, 1, 0, 0.4, [1, 3, 0]),
  R(30, 0, 0, [0, 0], [0, 0.2], [4, 8], [5, 8], 0.04, 1, 0, 0, [3, 1]),
  R(70, 0, 0, [0, 0], [0.1, 0.4], [2, 6], [15, 22], 0, 1, 0, 0.7, [0, 1, 3]),
  R(70, 0, 0, [0, 0], [0.05, 0.3], [2, 7], [15, 22], 0, 1, 0, 0.6, [2, 0, 2, 1]),
  R(60, 0, 0, [0, 0], [0, 0.1], [5, 8], [8, 12], 0, 1, 0, 0.3, [1, 3, 0]),
  R(46, 0, 0, [0, 0], [1, 2], [1, 3], [14, 20], 0.12, 1, 0, 1, [0, 2, 0, 1]),
  R(70, 0, 0, [0, 0], [0, 0.2], [3, 8], [12, 18], 0, 1, 0.07, 0, [1, 3, 0]),
  R(60, 0, 0, [0, 0], [0.1, 0.4], [3, 8], [12, 18], 0, 1, -0.05, 0.4, [0, 1, 3]),
  R(54, 0, 0, [0, 0], [0.8, 1.6], [2, 5], [12, 18], 0.1, 1, 0, 0.6, [0, 1, 2]),
];

const between = (sk: Sink, r: readonly [number, number]): number => r[0] + (r[1] - r[0]) * sk.rand();
const pickTone = (sk: Sink, cols: readonly Tone[]): Tone => cols[Math.floor(sk.rand() * cols.length) % cols.length];

function runRecipe(sk: Sink, rc: Recipe, x: number, y: number, r: number, el: number, scale: number): void {
  const n = Math.min(110, Math.max(4, Math.round(rc.n * scale * 1.6)));
  const big = Math.min(1, rc.big + 0.2);
  const sp = Math.max(0.6, Math.min(1.8, r / 20));
  for (let j = 0; j < n; j++) {
    const ang = sk.rand() * 6.2832;
    const rad = rc.place === 0 ? 0 : rc.place === 1 ? r * 0.8 * Math.sqrt(sk.rand()) : r * (0.85 + 0.15 * sk.rand());
    const px = x + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad * 0.6;
    const v = between(sk, rc.speed) * (rc.drag < 1 ? sp : 1);
    let vx = 0, vy = 0;
    if (rc.dir === 0) { vx = Math.cos(ang) * v; vy = Math.sin(ang) * v * 0.7; }
    else if (rc.dir === 1) { vx = -Math.cos(ang) * v; vy = -Math.sin(ang) * v * 0.6; }
    else if (rc.dir === 2) { vx = -Math.sin(ang) * v; vy = Math.cos(ang) * v * 0.6; }
    else { vx = (sk.rand() - 0.5) * v; vy = (sk.rand() - 0.5) * v * 0.5; }
    const col = tint(el, pickTone(sk, rc.cols), 0.92);
    sk.spawn(px, py, between(sk, rc.z0), vx, vy, between(sk, rc.vz), between(sk, rc.life), col, sk.rand() < big ? 1 : 0, rc.grav, rc.drag, rc.spin);
  }
}

/** Trauma (screen shake) an element's burst adds. */
export const burstTrauma = (el: number): number => (el === 7 ? 0.3 : el === 3 ? 0.18 : el === 1 ? 0.2 : 0.1);

/** The ring colour of an element's burst. */
export const ringColor = (el: number): number => rgbOf(el, el === 8 ? GLOW : CORE);

/** The particles of a burst of element `el` and radius `r` at (x, y) on the ground; `ringed` adds nothing: the caller draws the ring. */
export function elementBurst(sk: Sink, x: number, y: number, r: number, el: number): void {
  el = elemId(el);
  const scale = Math.max(0.6, Math.min(2.2, Math.sqrt(r / 20)));
  runRecipe(sk, BURST[el], x, y, r, el, scale);
  const extra = BURST_EXTRA[el];
  if (extra) runRecipe(sk, extra, x, y, r, el, scale);
  switch (el) {
    case 1: // fire: a hot white-yellow flash at the heart
      for (let j = 0; j < 5; j++) sk.spawn(x + (sk.rand() - 0.5) * 6, y + (sk.rand() - 0.5) * 3, 2 + sk.rand() * 4, 0, 0, 0.3 + sk.rand() * 0.5, 12 + sk.rand() * 6, tint(1, j & 1 ? SPARK : GLOW, 0.95), 1, 0.01);
      break;
    case 3: { // lightning: jagged arcs thrown out from the point of impact, and a white flash
      for (let j = 0; j < 7; j++) {
        const ang = (j / 7) * 6.2832 + sk.rand() * 0.6, len = r * (0.5 + 0.5 * sk.rand());
        let px = x, py = y;
        const steps = Math.max(3, Math.round(len / 3.5));
        for (let k = 1; k <= steps; k++) {
          const u = k / steps, jx = (sk.rand() - 0.5) * 3.5, jy = (sk.rand() - 0.5) * 2.5;
          const nx = x + Math.cos(ang) * len * u + jx, ny = y + Math.sin(ang) * len * u * 0.6 + jy;
          for (let q = 0; q < 3; q++) sk.spawn(px + (nx - px) * (q / 3), py + (ny - py) * (q / 3), 4, 0, 0, 0, 8 + sk.rand() * 5, tint(3, q === 1 ? SPARK : CORE, 0.95), q === 1 ? 1 : 0, 0);
          px = nx; py = ny;
        }
        sk.spawn(px, py, 4, 0, 0, 0, 7, tint(3, SPARK), 1, 0);
      }
      for (let j = 0; j < 6; j++) sk.spawn(x + (sk.rand() - 0.5) * 8, y + (sk.rand() - 0.5) * 4, 3 + sk.rand() * 3, 0, 0, 0, 3 + sk.rand() * 2, tint(3, SPARK), 1, 0);
      break;
    }
    case 6: // holy: a soft column of light over the spot
      for (let j = 0; j < 9; j++) sk.spawn(x + (sk.rand() - 0.5) * 3, y, 3 + j * 2.4, 0, 0, 0.35 + sk.rand() * 0.3, 16 + sk.rand() * 8, tint(6, j & 1 ? SPARK : GLOW, 0.85), 0, 0);
      break;
    case 9: // arcane: six runes standing round the blast
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * 6.2832 + 0.3, rr = Math.max(8, r * 0.7);
        sk.spawn(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6, 2, 0, 0, 0.25, 18 + sk.rand() * 4, tint(9, j & 1 ? SPARK : GLOW, 0.95), 1, 0);
      }
      break;
    case 5: // shadow: a darkening puff in the middle
      for (let j = 0; j < 5; j++) sk.spawn(x + (sk.rand() - 0.5) * 6, y + (sk.rand() - 0.5) * 3, 2 + sk.rand() * 3, 0, 0, 0.2, 22 + sk.rand() * 8, tint(5, DEEP, 0.9), 1, 0);
      break;
  }
}

/** A lightning arc from (x0, y0) to (x1, y1) (ground coordinates): a crackling jagged line of short-lived points with forks and flashes at its ends. */
export function elementArc(sk: Sink, x0: number, y0: number, x1: number, y1: number, el: number): void {
  el = elemId(el);
  const dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const segs = Math.max(3, Math.round(len / 8));
  let px = x0, py = y0 - 7;
  for (let k = 1; k <= segs; k++) {
    const u = k / segs, off = k === segs ? 0 : (sk.rand() - 0.5) * 9;
    const qx = x0 + dx * u + nx * off, qy = y1 * u + y0 * (1 - u) + ny * off * 0.6 - 7;
    const steps = Math.max(1, Math.round(Math.hypot(qx - px, qy - py) / 1.5));
    for (let q = 0; q < steps; q++) {
      const t = q / steps;
      sk.spawn(px + (qx - px) * t, py + (qy - py) * t + 7, 7, 0, 0, 0, 6 + sk.rand() * 4, tint(el, q & 1 ? SPARK : CORE, 0.95), 0, 0);
    }
    if (k < segs && sk.rand() < 0.45) { // a fork
      const fx = qx + (sk.rand() - 0.5) * 12, fy = qy + (sk.rand() - 0.5) * 8;
      for (let q = 0; q < 4; q++) sk.spawn(qx + (fx - qx) * (q / 4), qy + (fy - qy) * (q / 4) + 7, 7, 0, 0, 0, 3 + sk.rand() * 3, tint(el, GLOW, 0.8), 0, 0);
    }
    px = qx; py = qy;
  }
  for (const [ex, ey] of [[x0, y0], [x1, y1]]) {
    for (let q = 0; q < 4; q++) sk.spawn(ex + (sk.rand() - 0.5) * 6, ey + (sk.rand() - 0.5) * 3, 6 + sk.rand() * 3, (sk.rand() - 0.5) * 1.2, (sk.rand() - 0.5) * 0.6, 0.2, 5 + sk.rand() * 4, tint(el, q & 1 ? SPARK : GLOW, 0.95), q === 0 ? 1 : 0);
  }
}

/** How many ticks a breath takes to sweep across its cone. */
export const CONE_TICKS = 10;

/**
 * A breath of an element: the part of its sweep from `u0` to `u1` (0..1 across the cone, from one edge to the other) as particles fanned over the cone
 * (origin (x, y), direction*length (ax, ay), half-angle `arc` turns). Fx calls it every tick of the sweep with the slice that tick covers.
 */
export function elementCone(sk: Sink, x: number, y: number, ax: number, ay: number, arc: number, el: number, u0 = 0, u1 = 1, flip = false): void {
  el = elemId(el);
  const len = Math.sqrt(ax * ax + ay * ay) || 1;
  const base = Math.atan2(ay, ax), half = arc * 6.2832;
  const span = u1 - u0;
  const side = flip ? -1 : 1;
  if (el === 3) { // lightning: a forked bolt along the edge the sweep has reached
    const bolts = Math.max(1, Math.round(span * 6));
    for (let j = 0; j < bolts; j++) {
      const u = u0 + span * (j + 0.5) / bolts, ang = base + side * half * (u * 2 - 1), l = len * (0.75 + 0.25 * sk.rand());
      let px = x, py = y;
      const steps = Math.max(4, Math.round(l / 8));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, off = k === steps ? 0 : (sk.rand() - 0.5) * 8;
        const qx = x + Math.cos(ang) * l * t - Math.sin(ang) * off, qy = y + Math.sin(ang) * l * t + Math.cos(ang) * off;
        for (let q = 0; q < 5; q++) sk.spawn(px + (qx - px) * (q / 5), py + (qy - py) * (q / 5), 7, 0, 0, 0, 5 + sk.rand() * 4 + k * 0.2, tint(3, q === 2 ? SPARK : CORE, 0.95), q === 2 ? 1 : 0, 0);
        px = qx; py = qy;
      }
    }
  }
  const rc = CONE[el];
  const n = Math.max(1, Math.round(rc.n * 2.6 * Math.max(0.6, len / 90) * span));
  for (let j = 0; j < n; j++) {
    const u = u0 + span * sk.rand(), ang = base + side * half * (u * 2 - 1) + (sk.rand() - 0.5) * half * 0.3;
    const s = 4 + len * 0.55 * sk.rand(), e = Math.min(len, s + len * (0.25 + 0.5 * sk.rand()));
    const life = between(sk, rc.life), v = (e - s) / life;
    sk.spawn(x + Math.cos(ang) * s, y + Math.sin(ang) * s * 0.9, between(sk, rc.z0), Math.cos(ang) * v, Math.sin(ang) * v, between(sk, rc.vz), life, tint(el, pickTone(sk, rc.cols), 0.92), sk.rand() < rc.big ? 1 : 0, rc.grav, rc.drag, rc.spin);
  }
}

/** A beam of an element along (dx, dy) (unit) for `len` px and `width`: a solid bright core, coloured edges and a spray of motes, flavoured per element. */
export function elementBeam(sk: Sink, x: number, y: number, dx: number, dy: number, len: number, width: number, el: number): void {
  el = elemId(el);
  const jag = el === 3 ? 2.2 : 1;
  const hw = Math.max(2, width * 0.5);
  let vz = 0, grav = 0;
  if (el === 1 || el === 4 || el === 6) vz = 0.35; // fire, poison, holy lift
  else if (el === 7 || el === 10) { vz = 0.7; grav = 0.1; } // earth, blood throw up
  const spin = el === 8 ? 0.1 : 0;
  for (let d = 4; d < len; d += 2) {
    const wob = el === 3 ? (sk.rand() - 0.5) * 3 : 0; // lightning's line is ragged
    const bx = x + dx * d - dy * wob, by = y + dy * d + dx * wob;
    sk.spawn(bx, by + 1, 7, 0, 0, 0, 8 + sk.rand() * 5, tint(el, DEEP, 0.9), 1, 0);                  // a dark underside so it holds on pale ground
    sk.spawn(bx, by, 8, 0, 0, vz * 0.5, 7 + sk.rand() * 6, tint(el, SPARK, 0.98), 1, grav, 1, spin);   // the core line
    for (let k = 0; k < 2; k++) {
      const lat = (sk.rand() * 2 - 1) * hw * jag;
      const edge = Math.abs(lat) > hw * 0.6;
      sk.spawn(bx - dy * lat, by + dx * lat, 7 + sk.rand() * 3, 0, 0, vz * (0.5 + sk.rand()), 9 + sk.rand() * 7, tint(el, edge ? CORE : sk.rand() < 0.5 ? GLOW : CORE, 0.95), sk.rand() < 0.3 ? 1 : 0, grav, 1, spin);
    }
  }
  sk.spawn(x + dx * 4, y + dy * 4, 8, 0, 0, 0, 12, tint(el, SPARK), 1, 0); // a flare at the mouth
}
