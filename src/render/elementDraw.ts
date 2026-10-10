// The pictures of elemental skills: projectiles, ground zones (pending strikes, pools, traps, storms, pits, totems) and the windup telegraphs.
// draw.ts hands the matching entity here when it carries an element; with no element it keeps the hand-made looks. The palette and the pixel
// helpers (and the particle recipes fx.ts uses) are in elementFx.ts. Nothing here allocates: it runs for every zone and shot every frame.
import { ProjStyle, type Special } from '../data/mobs';
import type { Batcher } from '../platform/gl/batcher';
import { ZoneKind, ELEM_MASK, PROJ_HOMING, PROJ_PIERCE, type Entities } from '../sim/entities';
import type { Sprites } from './art';
import {
  CORE, DEEP, GLOW, SPARK, box, crystal, disc, dotRing, elemId, flame, hash01, jagged, pline, rune, shade, pond, sparkle, tint, warnRing,
} from './elementFx';

const TAU = 6.2832;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------------------------------------------------------------------------------------------- projectiles

/** A diamond of radius r (a crystal bead). */
function diamond(b: Batcher, S: Sprites, cx: number, cy: number, r: number, c: number): void {
  const x = Math.round(cx), y = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) { const w = r - Math.abs(dy); box(b, S, x - w, y + dy, w * 2 + 1, 1, c); }
}

/** The ball of an element at (x, y), radius r (1 = a mote). */
function orb(b: Batcher, S: Sprites, x: number, y: number, r: number, el: number, tick: number, id: number, dx: number, dy: number): void {
  const fl = ((tick >> 1) + id) & 1, big = r >= 3;
  switch (el) {
    case 1: // fire: a ball of flame that licks upward
      disc(b, S, x, y, r + 1, tint(1, DEEP, 0.9));
      disc(b, S, x, y, r, tint(1, CORE));
      if (r >= 2) disc(b, S, x, y, r - 1, tint(1, GLOW));
      box(b, S, x, y, 1, 1, tint(1, SPARK));
      box(b, S, x + (fl ? -1 : 1), y - r - 1, 1, 2, tint(1, GLOW));
      if (big) box(b, S, x + (fl ? 1 : -1), y - r, 1, 2, tint(1, CORE));
      break;
    case 2: // ice: a faceted bead
      diamond(b, S, x, y, r + 1, tint(2, DEEP));
      diamond(b, S, x, y, r, tint(2, CORE));
      if (r >= 2) diamond(b, S, x, y, r - 1, tint(2, GLOW));
      box(b, S, x, y, 1, 1, tint(2, SPARK));
      if (((tick + id * 5) & 15) < 3) sparkle(b, S, x, y, r + 2, 2);
      break;
    case 3: { // lightning: a white-hot core with spokes that crackle
      disc(b, S, x, y, r + 1, tint(3, DEEP, 0.85));
      disc(b, S, x, y, r, tint(3, CORE));
      if (r >= 2) disc(b, S, x, y, r - 1, tint(3, SPARK));
      else box(b, S, x, y, 1, 1, tint(3, SPARK));
      const seed = (tick >> 1) * 7 + id * 3;
      for (let k = 0; k < 3; k++) {
        const a = hash01(seed + k) * TAU;
        jagged(b, S, x, y, x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), seed + k, 1.4, 2, tint(3, CORE, 0.95), -1);
      }
      break;
    }
    case 4: { // poison: a wobbling blob with a bubble
      const w = ((tick >> 2) + id) & 1;
      disc(b, S, x, y, r + 1, tint(4, DEEP, 0.9));
      disc(b, S, x, y, r, tint(4, CORE));
      box(b, S, x - r + 1, y - r + 1 + w, 1, 1, tint(4, SPARK));
      if (big) { box(b, S, x + r - 1, y - r - 1 + w, 1, 1, tint(4, GLOW)); box(b, S, x - 1, y - 1, 2, 1, tint(4, GLOW)); }
      break;
    }
    case 5: // shadow: a dark orb in a violet rim with two pale eyes
      disc(b, S, x, y, r + 1, tint(5, GLOW, 0.6));
      disc(b, S, x, y, r, tint(5, CORE));
      if (r >= 2) disc(b, S, x, y, r - 1, tint(5, DEEP));
      if (big) { box(b, S, x - 1, y - 1, 1, 1, tint(5, SPARK)); box(b, S, x + 1, y - 1, 1, 1, tint(5, SPARK)); }
      break;
    case 6: { // holy: a gold bead with a halo of four turning pips
      for (let k = 0; k < 4; k++) { const a = tick * 0.2 + id + k * 1.5708; box(b, S, x + Math.cos(a) * (r + 2), y + Math.sin(a) * (r + 2), 1, 1, tint(6, k & 1 ? SPARK : GLOW)); }
      disc(b, S, x, y, r + 1, tint(6, DEEP, 0.8));
      disc(b, S, x, y, r, tint(6, CORE));
      if (r >= 2) disc(b, S, x, y, r - 1, tint(6, SPARK));
      if (big && ((tick + id) & 2)) sparkle(b, S, x, y, r + 3, 6);
      break;
    }
    case 7: { // earth: a rough chunk that tumbles
      const v = ((tick >> 2) + id) & 3, rr = Math.max(1, r);
      box(b, S, x - rr, y - rr + 1, rr * 2 + 1, rr * 2 - 1, tint(7, DEEP));
      box(b, S, x - rr + 1, y - rr, rr * 2 - 1, rr * 2 + 1, tint(7, DEEP));
      box(b, S, x - rr + 1, y - rr + 1, Math.max(1, rr * 2 - 1), Math.max(1, rr * 2 - 1), tint(7, CORE));
      box(b, S, x - rr + 1, y - rr + 1, rr, 1, tint(7, GLOW));
      if (big) box(b, S, x + (v & 1 ? 1 : -1), y + (v & 2 ? 1 : -1), 1, 1, tint(7, DEEP));
      break;
    }
    case 8: { // wind: a tight swirl
      disc(b, S, x, y, r + 1, tint(8, DEEP, 0.85));
      disc(b, S, x, y, Math.max(1, r), tint(8, CORE, 0.8));
      for (let k = 0; k < 3; k++) {
        const a = tick * 0.55 + id + k * 2.094;
        box(b, S, x + Math.cos(a) * r, y + Math.sin(a) * r, 1, 1, tint(8, k === 0 ? SPARK : GLOW));
        box(b, S, x + Math.cos(a - 0.7) * (r - 1), y + Math.sin(a - 0.7) * (r - 1), 1, 1, tint(8, CORE, 0.8));
      }
      box(b, S, x, y, 1, 1, tint(8, SPARK));
      break;
    }
    case 9: { // arcane: a magenta diamond with runes orbiting
      diamond(b, S, x, y, r + 1, tint(9, DEEP));
      diamond(b, S, x, y, r, tint(9, CORE));
      if (r >= 2) diamond(b, S, x, y, r - 1, tint(9, GLOW));
      box(b, S, x, y, 1, 1, tint(9, SPARK));
      if (big) {
        const q = (tick >> 1) & 1, o = r + 2;
        if (q) { box(b, S, x - o, y, 1, 1, tint(9, SPARK)); box(b, S, x + o, y, 1, 1, tint(9, SPARK)); box(b, S, x, y - o, 1, 1, tint(9, GLOW)); box(b, S, x, y + o, 1, 1, tint(9, GLOW)); }
        else { const d = o - 1; box(b, S, x - d, y - d, 1, 1, tint(9, GLOW)); box(b, S, x + d, y - d, 1, 1, tint(9, GLOW)); box(b, S, x - d, y + d, 1, 1, tint(9, SPARK)); box(b, S, x + d, y + d, 1, 1, tint(9, SPARK)); }
      }
      break;
    }
    case 10: { // blood: a droplet with a bead hanging off it
      disc(b, S, x, y, r + 1, tint(10, DEEP));
      disc(b, S, x, y, r, tint(10, CORE));
      box(b, S, x - r + 1, y - r + 1, 1, 1, tint(10, GLOW));
      box(b, S, x, y - r - 1, 1, 1, tint(10, CORE));
      if (big) box(b, S, x, y + r + 1 + (((tick + id) >> 1) & 1), 1, 1, tint(10, CORE));
      break;
    }
    default: // physical: a plain grey ball
      disc(b, S, x, y, r + 1, tint(0, DEEP));
      disc(b, S, x, y, r, tint(0, CORE));
      box(b, S, x - r + 1, y - r + 1, 1, 1, tint(0, GLOW));
  }
  void dx; void dy;
}

/** What an orb leaves behind it: `len` steps back along (-dx, -dy) from (x, y). */
function tail(b: Batcher, S: Sprites, x: number, y: number, dx: number, dy: number, len: number, el: number, tick: number, id: number): void {
  if (el === 3) { // lightning: one crackling line
    jagged(b, S, x, y, x - dx * len * 1.7, y - dy * len * 1.7, (tick >> 1) * 5 + id, 2, 3, tint(3, CORE, 0.85), -1);
    return;
  }
  for (let t = len; t >= 1; t--) {
    const f = 1 - t / (len + 1), j = hash01(id * 13 + t * 5 + (tick >> 1));
    const px = x - dx * t * 1.6, py = y - dy * t * 1.6;
    switch (el) {
      case 1: // fire: embers streaming off, rising
        box(b, S, px + (j - 0.5) * 2, py - t * 0.35, t < len * 0.5 ? 3 : 2, t < len * 0.5 ? 3 : 2, tint(1, t < len / 3 ? GLOW : t < len * 0.66 ? CORE : DEEP, 0.95 * f));
        break;
      case 2: // ice: a few glinting flakes
        box(b, S, px + (j - 0.5) * 3, py + (hash01(t + id) - 0.5) * 3, 2, 2, tint(2, j > 0.5 ? SPARK : GLOW, 0.9 * f));
        break;
      case 4: // poison: drips that fall
        box(b, S, px, py + t * 0.5, 2, 2, tint(4, t & 1 ? CORE : DEEP, 0.9 * f));
        break;
      case 5: // shadow: dark smoke spreading
        box(b, S, px + (j - 0.5) * 2, py + (j - 0.5) * 2, 3, 3, tint(5, DEEP, 0.65 * f));
        if (t % 3 === 0) box(b, S, px + (j - 0.5) * 4, py - 1, 1, 1, tint(5, GLOW, 0.5 * f));
        break;
      case 6: // holy: sparkles
        if (t & 1) box(b, S, px + (j - 0.5) * 4, py + (hash01(t * 3 + id) - 0.5) * 4, 1, 1, tint(6, j > 0.5 ? SPARK : GLOW, 0.9 * f));
        break;
      case 7: // earth: dust falling away
        box(b, S, px + (j - 0.5) * 2, py + t * 0.4, 2, 2, tint(7, t & 1 ? GLOW : CORE, 0.75 * f));
        break;
      case 8: // wind: a streak that curls
        box(b, S, px - dy * Math.sin(t * 0.9 + tick * 0.4) * 2, py + dx * Math.sin(t * 0.9 + tick * 0.4) * 2, 2, 2, tint(8, t & 1 ? DEEP : GLOW, 0.85 * f));
        break;
      case 9: // arcane: glittering dust
        if (t & 1) box(b, S, px + (j - 0.5) * 3, py + (hash01(t + id * 7) - 0.5) * 3, 1, 1, tint(9, j > 0.5 ? SPARK : GLOW, 0.9 * f));
        break;
      case 10: // blood: drops
        box(b, S, px, py + t * 0.6, 2, 2, tint(10, t & 1 ? CORE : DEEP, 0.9 * f));
        break;
      default:
        if (t & 1) box(b, S, px, py, 1, 1, tint(0, GLOW, 0.5 * f));
    }
  }
}

/** A needle/arrow of an element, `len` long, tip toward (dx, dy). */
function spike(b: Batcher, S: Sprites, x: number, y: number, dx: number, dy: number, len: number, el: number, tick: number, id: number): void {
  const nx = -dy, ny = dx;
  if (el === 3) { // lightning: a zig-zag bolt
    jagged(b, S, x - dx * len * 0.5, y - dy * len * 0.5, x + dx * len * 0.5, y + dy * len * 0.5, (tick >> 1) * 3 + id, 2.2, 4, tint(3, CORE), tint(3, SPARK));
    box(b, S, x + dx * len * 0.5, y + dy * len * 0.5, 2, 2, tint(3, SPARK));
    return;
  }
  for (let k = 0; k < len; k++) {
    const u = k / (len - 1); // 0 = tip, 1 = tail
    const px = x + dx * (len * 0.5 - k), py = y + dy * (len * 0.5 - k);
    const tone = u < 0.12 ? SPARK : u < 0.5 ? GLOW : u < 0.8 ? CORE : DEEP;
    let a = 1;
    if (el === 8) a = 1 - u * 0.8; // wind: a streak that thins out
    box(b, S, px, py, 1, 1, tint(el, tone, a));
    if (el !== 8 && u > 0.1 && u < 0.75) {
      box(b, S, px + nx, py + ny, 1, 1, tint(el, el === 5 || el === 7 ? DEEP : CORE, 0.95));
      if (u > 0.2 && u < 0.6) box(b, S, px - nx, py - ny, 1, 1, tint(el, DEEP, 0.9));
    }
  }
  const tx = x - dx * (len * 0.5 + 1), ty = y - dy * (len * 0.5 + 1);
  switch (el) {
    case 1: // flaming tail
      for (let t = 0; t < 4; t++) box(b, S, tx - dx * t * 1.5 + (hash01(id + t + (tick >> 1)) - 0.5) * 2, ty - dy * t * 1.5 - t * 0.4, 1, 1, tint(1, t < 2 ? GLOW : CORE, 0.9 - t * 0.2));
      break;
    case 4: case 10: // a drip falling from the tail
      box(b, S, tx, ty + 1 + ((tick + id) & 3), 1, 1, tint(el, CORE, 0.85));
      break;
    case 5: // smoke
      for (let t = 0; t < 3; t++) box(b, S, tx - dx * t * 2, ty - dy * t * 2, 2, 2, tint(5, DEEP, 0.5 - t * 0.14));
      break;
    case 6: // a glint at the tip
      if ((tick + id) & 2) sparkle(b, S, x + dx * len * 0.5, y + dy * len * 0.5, 2, 6);
      break;
    case 9: // two pips circling
      box(b, S, x + nx * 2 * Math.sin(tick * 0.5), y + ny * 2 * Math.sin(tick * 0.5), 1, 1, tint(9, SPARK));
      box(b, S, x - nx * 2 * Math.sin(tick * 0.5), y - ny * 2 * Math.sin(tick * 0.5), 1, 1, tint(9, GLOW));
      break;
    case 2: // frost glint
      if (((tick + id * 3) & 15) < 3) sparkle(b, S, x, y, 2, 2);
      break;
  }
}

/**
 * An elemental mob projectile at screen (x, y) (its ground position; it is drawn 8 px up) flying along the unit vector (dx, dy).
 * `shape` is a `ProjStyle` (Orb, Spike, Comet, Mote), `flags` the entity's flags (pierce and homing cues).
 */
export function drawElemProj(b: Batcher, S: Sprites, x: number, y: number, dx: number, dy: number, shape: number, el: number, flags: number, tick: number, id: number): void {
  el = elemId(el);
  const cy = y - 8;
  switch (shape) {
    case ProjStyle.Spike: spike(b, S, x, cy, dx, dy, 12, el, tick, id); break;
    case ProjStyle.Comet: tail(b, S, x, cy, dx, dy, 12, el, tick, id); orb(b, S, x, cy, 3, el, tick, id, dx, dy); break;
    case ProjStyle.Mote: tail(b, S, x, cy, dx, dy, 3, el, tick, id); orb(b, S, x, cy, 1, el, tick, id, dx, dy); break;
    default: tail(b, S, x, cy, dx, dy, 5, el, tick, id); orb(b, S, x, cy, 3, el, tick, id, dx, dy);
  }
  if (flags & PROJ_PIERCE) box(b, S, x + dx * 6, cy + dy * 6, 1, 1, tint(el, SPARK, 0.9)); // a bright point ahead: it passes through
  if (flags & PROJ_HOMING) { const a = tick * 0.35 + id; box(b, S, x + Math.cos(a) * 5, cy + Math.sin(a) * 5, 1, 1, tint(el, SPARK, 0.8)); } // a pip circling it: it steers
}

// ---------------------------------------------------------------------------------------------------- swirling motes

/**
 * `n` motes of an element's weather gathered in a disc of radius r on the ground at (cx, cy): embers rising, flakes swirling, sparks
 * flickering, bubbles, wisps, motes of light, dust, streaks, runes, drops. `k` in 0..1 is how strong (alpha). Used by storms, pits and telegraphs.
 */
export function swirlMotes(b: Batcher, S: Sprites, el: number, cx: number, cy: number, r: number, tick: number, seed: number, n: number, k: number): void {
  el = elemId(el);
  for (let m = 0; m < n; m++) {
    const t = (((m * 29 + tick * (el === 8 ? 1.6 : el === 3 ? 0 : 1) + seed * 7) % 50) / 50);
    const ang = m * 2.4 + seed;
    const a0 = tick * (el === 8 ? 0.4 : el === 5 ? -0.12 : 0.2) + m * (TAU / n);
    switch (el) {
      case 1: { // embers rise out of the disc
        const rr = r * (0.15 + 0.75 * hash01(m + seed * 3)), px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * 0.7;
        box(b, S, px, py - t * 12, t < 0.5 ? 2 : 1, t < 0.5 ? 2 : 1, tint(1, t < 0.35 ? SPARK : t < 0.7 ? GLOW : CORE, k * (1 - t * 0.7)));
        if (t < 0.5) box(b, S, px, py - t * 12 + 2, 2, 1, tint(1, DEEP, k * 0.6));
        break;
      }
      case 2: { // flakes spiral
        const rr = r * (0.2 + 0.75 * t);
        box(b, S, cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr * 0.7 - 1, 2, 2, tint(2, DEEP, k * 0.7));
        box(b, S, cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr * 0.7 - 2, 1, 1, tint(2, m & 1 ? GLOW : SPARK, k));
        break;
      }
      case 3: { // sparks flicker in and out of place
        const q = (tick >> 1) + m * 3 + seed;
        if (hash01(q) < 0.55) {
          const px = cx + (hash01(q * 3 + 1) - 0.5) * r * 1.6, py = cy + (hash01(q * 5 + 2) - 0.5) * r * 1.0;
          box(b, S, px - 1, py - 4, 3, 5, tint(3, DEEP, k * 0.5));
          box(b, S, px, py - 4, 1, 4, tint(3, CORE, k));
          box(b, S, px, py - 5, 1, 1, tint(3, SPARK, k));
        }
        break;
      }
      case 4: { // bubbles rise and pop
        const rr = r * (0.1 + 0.8 * hash01(m + seed * 3)), px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * 0.7;
        if (t < 0.85) { box(b, S, px, py - t * 8, 2, 2, tint(4, CORE, k * 0.9)); box(b, S, px, py - t * 8, 1, 1, tint(4, SPARK, k)); }
        else box(b, S, px, py - 6, 1, 1, tint(4, GLOW, k * 0.7));
        break;
      }
      case 5: { // wisps wind inward and up
        const rr = r * (1 - t) * 0.95;
        box(b, S, cx + Math.cos(a0) * rr - 1, cy + Math.sin(a0) * rr * 0.7 - t * 6, 3, 2, tint(5, m & 1 ? CORE : GLOW, k * 0.9));
        box(b, S, cx + Math.cos(a0 - 0.5) * rr, cy + Math.sin(a0 - 0.5) * rr * 0.7 - t * 6, 1, 1, tint(5, DEEP, k));
        break;
      }
      case 6: { // slender streaks of light climbing
        const rr = r * (0.1 + 0.8 * hash01(m + seed * 3)), px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * 0.7;
        box(b, S, px - 1, py - t * 14, 3, 4, tint(6, DEEP, k * 0.45));
        box(b, S, px, py - t * 14, 1, 4, tint(6, t < 0.5 ? SPARK : GLOW, k * (1 - t * 0.5)));
        break;
      }
      case 7: { // stones hop and dust puffs
        const rr = r * (0.2 + 0.7 * hash01(m + seed * 3)), px = cx + Math.cos(a0 * 0.5) * rr, py = cy + Math.sin(a0 * 0.5) * rr * 0.7;
        const hop = Math.abs(Math.sin(tick * 0.2 + m * 1.7)) * 4;
        box(b, S, px, py - hop, 2, 2, tint(7, m & 1 ? CORE : DEEP, k));
        box(b, S, px, py - hop, 1, 1, tint(7, GLOW, k));
        break;
      }
      case 8: { // tight fast streaks
        const rr = r * (0.2 + 0.75 * t);
        box(b, S, cx + Math.cos(a0) * rr - 1, cy + Math.sin(a0) * rr * 0.7 - 1, 4, 2, tint(8, DEEP, k * 0.7));
        box(b, S, cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr * 0.7 - 2, 3, 1, tint(8, m & 1 ? GLOW : SPARK, k * 0.95));
        break;
      }
      case 9: { // little runes turning on a ring
        const rr = r * 0.62, a1 = -tick * 0.06 + m * (TAU / n);
        if (m < 6) rune(b, S, cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr * 0.7, (tick >> 3) + m, 9, k);
        else box(b, S, cx + Math.cos(a0) * r * 0.9, cy + Math.sin(a0) * r * 0.65, 1, 1, tint(9, SPARK, k));
        break;
      }
      case 10: { // drops fall into the disc
        const rr = r * (0.1 + 0.8 * hash01(m + seed * 3)), px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr * 0.7;
        box(b, S, px, py - (1 - t) * 14, 1, 2, tint(10, t > 0.9 ? GLOW : CORE, k));
        break;
      }
      default: {
        const rr = r * (0.2 + 0.7 * t);
        box(b, S, cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr * 0.7 - 2, 1, 1, tint(0, GLOW, k));
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------- zones

/** A puddle of one colour over a disc (the body of a pool; `w` and `h` are unused, kept so the old patch calls read the same). */
function sheet(b: Batcher, S: Sprites, cx: number, cy: number, r: number, seed: number, _w: number, _h: number, c: number): void {
  pond(b, S, cx, cy, r, seed, c);
}

function pool(b: Batcher, S: Sprites, e: Entities, i: number, sx: number, sy: number, tick: number, el: number): void {
  const r = e.rem[i], life = e.cool2[i], fade = life < 60 ? life / 60 : 1;
  const x = Math.round(sx), y = Math.round(sy);
  switch (el) {
    case 1: { // fire: scorched ground with flames
      sheet(b, S, x, y, r, i, 11, 6, tint(1, DEEP, 0.55 * fade));
      sheet(b, S, x, y, r * 0.7, i + 3, 7, 4, tint(1, CORE, 0.4 * fade));
      sheet(b, S, x, y, r * 0.38, i + 5, 7, 4, tint(1, GLOW, (0.3 + 0.15 * (((tick >> 2) + i) & 1)) * fade));
      warnRing(b, S, x, y, r * 0.95, 26, 1, (0.6 + 0.25 * (((tick >> 2) + i) & 1)) * fade, 0.74);
      const nf = Math.min(14, 5 + Math.round(r / 4));
      for (let k = 0; k < nf; k++) {
        if (hash01(k * 5 + i * 3 + (tick >> 3)) < 0.25) continue;
        const a = k * 2.4 + i, rr = r * (0.1 + 0.8 * hash01(k * 17 + i));
        flame(b, S, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, 4 + Math.round(hash01(k + i * 9) * 4), tick, k + i * 13, 1, fade);
      }
      break;
    }
    case 2: { // ice: a sheet of ice with crystals
      sheet(b, S, x, y, r, i, 9, 5, tint(2, CORE, 0.36 * fade));
      dotRing(b, S, x, y, r * 0.95, 26, tint(2, DEEP, 0.75 * fade), 0.8);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + (i % 7), rr = r * (0.2 + hash01(k * 29 + i * 13) * 0.55);
        crystal(b, S, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, 3 + ((k + i) % 3), 2, fade, ((tick >> 3) + k + i) % 6 === 0);
      }
      break;
    }
    case 3: { // lightning: a charged patch with arcs crackling across it
      sheet(b, S, x, y, r, i, 9, 5, tint(3, DEEP, 0.35 * fade));
      dotRing(b, S, x, y, r * 0.95, 26, tint(3, CORE, (((tick >> 1) + i) & 1 ? 0.8 : 0.4) * fade), 0.8);
      const seed = (tick / 3) | 0;
      for (let k = 0; k < 3; k++) {
        if (hash01(seed * 7 + k + i) < 0.35) continue;
        const a0 = hash01(seed * 3 + k * 11 + i) * TAU, a1 = a0 + 1.6 + hash01(seed + k * 5) * 2.4;
        jagged(b, S, x + Math.cos(a0) * r * 0.7, y + Math.sin(a0) * r * 0.5, x + Math.cos(a1) * r * 0.7, y + Math.sin(a1) * r * 0.5, seed * 5 + k + i, 3, 4, tint(3, CORE, fade), tint(3, SPARK, fade));
      }
      break;
    }
    case 4: { // poison: a green sheet and bubbles
      sheet(b, S, x, y, r, i, 9, 5, tint(4, CORE, 0.3 * fade));
      sheet(b, S, x, y, r * 0.6, i + 5, 6, 3, tint(4, DEEP, 0.3 * fade));
      dotRing(b, S, x, y, r * 0.95, 26, tint(4, GLOW, 0.5 * fade), 0.8);
      swirlMotes(b, S, 4, x, y, r * 0.85, tick, i, 6, fade);
      break;
    }
    case 5: { // shadow: a dark pool that breathes out wisps
      sheet(b, S, x, y, r, i, 11, 6, tint(5, DEEP, 0.75 * fade));
      sheet(b, S, x, y, r * 0.6, i + 2, 7, 4, tint(5, CORE, 0.35 * fade));
      dotRing(b, S, x, y, r * 0.95, 26, tint(5, GLOW, (0.4 + 0.2 * (((tick >> 3) + i) & 1)) * fade), 0.8);
      swirlMotes(b, S, 5, x, y, r * 0.9, tick, i, 8, fade);
      break;
    }
    case 6: { // holy: a ring of light with rays and rising motes
      sheet(b, S, x, y, r, i, 9, 5, tint(6, CORE, 0.22 * fade));
      warnRing(b, S, x, y, r * 0.95, 28, 6, 0.8 * fade, 0.74);
      for (let k = 0; k < 4; k++) {
        const a = tick * 0.03 + k * 1.5708;
        pline(b, S, x, y, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.42, tint(6, GLOW, 0.5 * fade), 3);
      }
      swirlMotes(b, S, 6, x, y, r * 0.85, tick, i, 6, fade);
      sparkle(b, S, x, y - 1, 2 + (((tick >> 3) + i) & 1), 6, fade);
      break;
    }
    case 7: { // earth: cracked soil with stones
      sheet(b, S, x, y, r, i, 11, 6, tint(7, DEEP, 0.55 * fade));
      sheet(b, S, x, y, r * 0.7, i + 4, 7, 4, tint(7, CORE, 0.35 * fade));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + (i % 9);
        jagged(b, S, x, y, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.55, i * 3 + k, 2, 4, tint(7, DEEP, 0.9 * fade), -1);
      }
      dotRing(b, S, x, y, r * 0.95, 20, tint(7, GLOW, 0.5 * fade), 0.8);
      swirlMotes(b, S, 7, x, y, r * 0.85, tick, i, 4, fade);
      break;
    }
    case 8: { // wind: a swirl of dust and leaves, no sheet
      sheet(b, S, x, y, r, i, 11, 6, tint(8, DEEP, 0.16 * fade));
      for (let k = 0; k < 22; k++) {
        const t = k / 22, a = tick * 0.25 + t * 5.5, rr = r * (0.1 + 0.88 * t), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.7 - 1;
        box(b, S, px - 1, py + 1, 4, 2, tint(8, DEEP, (0.75 - t * 0.3) * fade));
        box(b, S, px, py, 2, 1, tint(8, k & 1 ? GLOW : SPARK, (0.95 - t * 0.3) * fade));
      }
      dotRing(b, S, x, y, r * 0.95, 24, tint(8, DEEP, 0.55 * fade), 0.8, tick * 0.1, 2);
      break;
    }
    case 9: { // arcane: a rune circle
      const sp = tick * 0.03;
      dotRing(b, S, x, y, r * 0.96, 30, tint(9, CORE, 0.85 * fade), 0.74, sp, 2);
      dotRing(b, S, x, y, r * 0.6, 18, tint(9, GLOW, 0.7 * fade), 0.74, -sp * 1.5, 2);
      sheet(b, S, x, y, r * 0.8, i, 8, 4, tint(9, DEEP, 0.3 * fade));
      for (let t = 0; t < 2; t++) {
        for (let k = 0; k < 3; k++) {
          const a0 = sp * 1.5 + (t * 3 + k) * 1.0472 + t * 0, a1 = a0 + 2.0944;
          pline(b, S, x + Math.cos(a0) * r * 0.6, y + Math.sin(a0) * r * 0.48, x + Math.cos(a1) * r * 0.6, y + Math.sin(a1) * r * 0.48, tint(9, CORE, 0.55 * fade), 3);
        }
      }
      for (let k = 0; k < 6; k++) { const a = -sp * 1.5 + k * 1.0472; rune(b, S, x + Math.cos(a) * r * 0.84, y + Math.sin(a) * r * 0.67, (tick >> 3) + k, 9, fade); }
      sparkle(b, S, x, y - 1, 2, 9, fade);
      break;
    }
    case 10: { // blood: a dark glossy pool with ripples
      sheet(b, S, x, y, r, i, 11, 6, tint(10, DEEP, 0.8 * fade));
      sheet(b, S, x, y, r * 0.7, i + 6, 7, 4, tint(10, CORE, 0.4 * fade));
      dotRing(b, S, x, y, r * 0.95, 26, tint(10, DEEP, 0.9 * fade), 0.8);
      const t = ((tick + i * 17) % 50) / 50;
      dotRing(b, S, x, y, r * 0.8 * t, 14, tint(10, GLOW, (1 - t) * 0.7 * fade), 0.75);
      box(b, S, x - r * 0.3, y - r * 0.15, 3, 1, tint(10, GLOW, 0.7 * fade));
      box(b, S, x + r * 0.25, y + r * 0.1, 2, 1, tint(10, GLOW, 0.6 * fade));
      swirlMotes(b, S, 10, x, y, r * 0.8, tick, i, 3, fade);
      break;
    }
    default: // an element with no look of its own: a grey puddle
      sheet(b, S, x, y, r, i, 9, 5, tint(0, DEEP, 0.4 * fade));
      dotRing(b, S, x, y, r * 0.95, 24, tint(0, CORE, 0.5 * fade), 0.8);
  }
}

/** The thing a lob drops, at screen (x, y - h) falling to (x, y), `left` ticks from landing, in an element's shape. `prog` = 0..1 of the windup. */
function falling(b: Batcher, S: Sprites, el: number, x: number, y: number, h: number, left: number, prog: number, tick: number, id: number, r: number): void {
  const cx = x, cy = y - h;
  switch (el) {
    case 1: { // fire: a meteor coming in on a slant, a long flickering trail behind
      const lx = x - h * 0.35, ly = y - h - 5;
      for (let t = 12; t >= 1; t--) {
        const w = t < 4 ? 5 : t < 8 ? 4 : 2;
        box(b, S, lx - t * 0.8 - w / 2 + (hash01(t + id + (tick >> 1)) - 0.5) * 2, ly - t * 2.3, w, 3, tint(1, t < 3 ? GLOW : t < 7 ? CORE : DEEP, 0.9 - t * 0.06));
      }
      disc(b, S, lx, ly, 5, tint(1, DEEP)); disc(b, S, lx, ly, 4, tint(1, CORE)); disc(b, S, lx, ly, 3, tint(1, GLOW)); disc(b, S, lx, ly, 1, tint(1, SPARK));
      box(b, S, lx - 1 + ((tick >> 1) & 1), ly - 6, 2, 2, tint(1, GLOW));
      break;
    }
    case 2: { // ice: an icicle, point down, glinting
      box(b, S, cx - 3, cy - 15, 7, 6, tint(2, CORE)); box(b, S, cx - 3, cy - 15, 2, 6, tint(2, DEEP)); box(b, S, cx + 1, cy - 15, 2, 6, tint(2, GLOW));
      box(b, S, cx - 2, cy - 9, 5, 4, tint(2, CORE)); box(b, S, cx - 2, cy - 9, 1, 4, tint(2, DEEP)); box(b, S, cx + 1, cy - 9, 1, 4, tint(2, GLOW));
      box(b, S, cx - 1, cy - 5, 3, 3, tint(2, GLOW)); box(b, S, cx, cy - 2, 1, 3, tint(2, GLOW)); box(b, S, cx, cy + 1, 1, 1, tint(2, SPARK));
      box(b, S, cx, cy - 19 - ((tick >> 1) & 1), 1, 2, tint(2, GLOW, 0.7)); box(b, S, cx + 2, cy - 23, 1, 1, tint(2, SPARK, 0.5));
      if (((tick + id) >> 2) & 1) sparkle(b, S, cx + 1, cy - 12, 2, 2);
      break;
    }
    case 3: { // lightning: a bolt striking down, two pixels wide; its tip is the point
      const top = Math.max(cy - 70, y - 150);
      jagged(b, S, cx + 3, top, cx + 1, cy, (tick >> 1) * 3 + id, 5, 8, tint(3, CORE), -1);
      jagged(b, S, cx + 2, top, cx, cy, (tick >> 1) * 3 + id, 5, 8, tint(3, SPARK), -1);
      jagged(b, S, cx + 1, top, cx - 1, cy, (tick >> 1) * 3 + id, 5, 8, tint(3, DEEP, 0.8), -1);
      disc(b, S, cx, cy, 3, tint(3, SPARK, 0.8)); disc(b, S, cx, cy, 2, tint(3, SPARK));
      break;
    }
    case 4: { // poison: a glob of bile with drips above it
      const w = (tick >> 1) & 1;
      for (let t = 1; t <= 5; t++) box(b, S, cx - (t & 1), cy - 6 - t * 3 - w, 1, 2, tint(4, CORE, 0.85 - t * 0.14));
      disc(b, S, cx, cy - 4, 5, tint(4, DEEP)); disc(b, S, cx, cy - 4, 4, tint(4, CORE)); box(b, S, cx - 2, cy - 7, 2, 2, tint(4, SPARK)); box(b, S, cx + 2, cy - 3 + w, 1, 1, tint(4, GLOW)); box(b, S, cx - 1, cy, 2, 1, tint(4, DEEP));
      break;
    }
    case 5: { // shadow: a dark orb trailing smoke, with two pale eyes
      for (let t = 1; t <= 5; t++) box(b, S, cx - 2 + (hash01(t + id + (tick >> 1)) - 0.5) * 4, cy - 6 - t * 3, 4, 3, tint(5, DEEP, 0.7 - t * 0.12));
      disc(b, S, cx, cy - 4, 5, tint(5, GLOW, 0.7)); disc(b, S, cx, cy - 4, 4, tint(5, CORE)); disc(b, S, cx, cy - 4, 3, tint(5, DEEP));
      box(b, S, cx - 2, cy - 5, 1, 2, tint(5, SPARK)); box(b, S, cx + 1, cy - 5, 1, 2, tint(5, SPARK));
      break;
    }
    case 6: { // holy: a column of light dropping onto the spot
      const w = Math.round(3 + prog * Math.max(4, r * 0.7)), top = y - 150;
      box(b, S, cx - w / 2, top, w, 150, tint(6, CORE, 0.22 + 0.3 * prog));
      box(b, S, cx - w / 2, top, 1, 150, tint(6, DEEP, 0.5 + 0.3 * prog)); box(b, S, cx + w / 2 - 1, top, 1, 150, tint(6, DEEP, 0.5 + 0.3 * prog));
      box(b, S, cx - 1, top, 3, 150, tint(6, SPARK, 0.3 + 0.5 * prog));
      for (let t = 0; t < 5; t++) box(b, S, cx + (hash01(t + id) - 0.5) * w, y - ((tick * 2 + t * 31) % 140), 1, 2, tint(6, SPARK, 0.9));
      if (left < 12) sparkle(b, S, cx, y - 2, 3 + (left & 1), 6);
      break;
    }
    case 7: { // earth: a boulder tumbling in on a slant
      const lx = x - h * 0.3, ly = y - h - 5, v = (tick >> 2) & 3;
      for (let t = 1; t <= 5; t++) box(b, S, lx - t * 0.8 + (hash01(t + id) - 0.5) * 3, ly - t * 3, 2, 1, tint(7, GLOW, 0.8 - t * 0.14));
      box(b, S, lx - 5, ly - 3, 11, 7, tint(7, DEEP)); box(b, S, lx - 4, ly - 4, 9, 9, tint(7, DEEP));
      box(b, S, lx - 4, ly - 3, 8, 7, tint(7, CORE)); box(b, S, lx - 3, ly - 4, 6, 1, tint(7, CORE)); box(b, S, lx - 4, ly - 3, 4, 2, tint(7, GLOW));
      box(b, S, lx + (v & 1 ? 1 : -2), ly + (v & 2 ? 1 : -1), 2, 1, tint(7, DEEP)); box(b, S, lx + 1, ly + 2, 3, 1, tint(7, DEEP));
      break;
    }
    case 8: { // wind: a funnel of whirling air coming down
      for (let k = 0; k < 11; k++) {
        const yy = cy - 3 - k * 3, ww = 2 + k * 1.2, a = tick * 0.5 + k * 0.9;
        box(b, S, cx + Math.cos(a) * ww - 2, yy, 4, 2, tint(8, DEEP, 0.85 - k * 0.04));
        box(b, S, cx - Math.cos(a) * ww - 2, yy, 4, 2, tint(8, DEEP, 0.7 - k * 0.04));
        box(b, S, cx + Math.cos(a) * ww - 1, yy, 2, 1, tint(8, k & 1 ? GLOW : SPARK, 0.95));
        box(b, S, cx - Math.cos(a) * ww - 1, yy, 2, 1, tint(8, CORE, 0.95));
      }
      break;
    }
    case 9: { // arcane: a sigil star falling, a rune circle already glowing on the ground
      dotRing(b, S, x, y, r * 0.8, 20, tint(9, CORE, 0.5 + 0.4 * prog), 0.8, tick * 0.08, 2);
      for (let k = 0; k < 4; k++) { const a = tick * 0.08 + k * 1.5708; rune(b, S, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.65, (tick >> 3) + k, 9, 0.5 + 0.5 * prog); }
      for (let t = 1; t <= 4; t++) box(b, S, cx + (hash01(t + id + (tick >> 1)) - 0.5) * 4, cy - 6 - t * 4, 1, 1, tint(9, t & 1 ? SPARK : GLOW, 0.9 - t * 0.18));
      sparkle(b, S, cx, cy - 4, 5, 9); rune(b, S, cx, cy - 4, tick >> 2, 9, 1, true);
      break;
    }
    case 10: { // blood: a drop, pointed at the top
      for (let t = 1; t <= 4; t++) box(b, S, cx, cy - 11 - t * 3, 1, 2, tint(10, CORE, 0.8 - t * 0.17));
      box(b, S, cx - 1, cy - 12, 3, 3, tint(10, DEEP)); box(b, S, cx - 2, cy - 9, 5, 3, tint(10, DEEP)); box(b, S, cx - 3, cy - 6, 7, 4, tint(10, DEEP)); box(b, S, cx - 2, cy - 2, 5, 2, tint(10, DEEP)); box(b, S, cx - 1, cy, 3, 1, tint(10, DEEP));
      box(b, S, cx, cy - 12, 1, 3, tint(10, CORE)); box(b, S, cx - 1, cy - 9, 3, 3, tint(10, CORE)); box(b, S, cx - 2, cy - 6, 5, 4, tint(10, CORE)); box(b, S, cx - 1, cy - 2, 3, 2, tint(10, CORE));
      box(b, S, cx - 2, cy - 6, 2, 2, tint(10, GLOW));
      break;
    }
    default:
      box(b, S, cx - 3, cy - 4, 7, 7, tint(0, CORE));
  }
  void left;
}

/** A strike on its way (Rock zone, mode 0) of an element: the target ring in its colour, the shape falling in. */
function lobPending(b: Batcher, S: Sprites, e: Entities, i: number, sx: number, sy: number, tick: number, el: number): void {
  const r = e.rem[i], left = e.wind[i];
  const prog = clamp01(1 - left / (e.stun[i] || 46));
  const blink = (tick >> 2) & 1 ? 0.85 : 0.5;
  warnRing(b, S, sx, sy, r, 22, el, blink);
  dotRing(b, S, sx, sy, r * (0.3 + 0.7 * prog), 16, tint(el, GLOW, 0.6), 0.85, 0, 2);
  if (e.ax[i] > 0 && e.cool2[i] > 0) dotRing(b, S, sx, sy, e.ax[i], 18, tint(el, DEEP, 0.55), 0.85); // it will leave a pool this big
  const h = Math.min(left, 56) * 2.2;
  const sh = 2 + Math.round((1 - h / 125) * 3);
  box(b, S, sx - sh, sy - 1, sh * 2 + 1, 2, 0x44000000);
  falling(b, S, el, Math.round(sx), Math.round(sy), h, left, prog, tick, i, r);
}

/** An armed or arming trap of an element. */
function trap(b: Batcher, S: Sprites, e: Entities, i: number, sx: number, sy: number, tick: number, el: number): void {
  const r = e.rem[i], x = Math.round(sx), y = Math.round(sy);
  if (e.mode[i] !== 2) { // still being set: the ring firms up, a rune flickers
    warnRing(b, S, x, y, r, 10, el, 0.4 + 0.3 * ((tick >> 2) & 1));
    if ((tick >> 1) & 1) rune(b, S, x, y - 1, tick >> 3, el, 0.5);
    return;
  }
  dotRing(b, S, x, y, r * 0.85, 12, tint(el, CORE, 0.8), 0.85);
  const pulse = ((tick >> 3) + i) & 1;
  switch (el) {
    case 1: // fire: a rune mine, hot at the heart
      box(b, S, x - 2, y - 2, 5, 3, tint(1, DEEP)); box(b, S, x - 1, y - 2, 3, 1, tint(1, pulse ? GLOW : CORE)); flame(b, S, x, y - 2, 3, tick, i, 1);
      break;
    case 2: // ice: a cluster of crystals
      crystal(b, S, x - 3, y, 3, 2); crystal(b, S, x + 3, y, 4, 2); crystal(b, S, x, y + 1, 5, 2, 1, pulse === 1);
      break;
    case 3: // lightning: a coil with an arc between two prongs
      box(b, S, x - 2, y - 1, 5, 3, tint(3, DEEP)); box(b, S, x - 3, y - 4, 1, 4, tint(3, CORE)); box(b, S, x + 3, y - 4, 1, 4, tint(3, CORE));
      if (hash01((tick >> 1) + i) < 0.7) jagged(b, S, x - 3, y - 4, x + 3, y - 4, (tick >> 1) + i, 1.6, 3, tint(3, SPARK), -1);
      break;
    case 4: // poison: a pod that breathes spores
      disc(b, S, x, y - 1, 3, tint(4, DEEP)); disc(b, S, x, y - 1, 2, tint(4, CORE)); box(b, S, x - 1, y - 2, 1, 1, tint(4, SPARK));
      box(b, S, x + ((tick >> 2) % 3) - 1, y - 5 - ((tick >> 1) % 3), 1, 1, tint(4, GLOW, 0.8));
      break;
    case 5: // shadow: a hole with wisps
      box(b, S, x - 3, y - 1, 7, 3, tint(5, DEEP)); box(b, S, x - 2, y - 2, 5, 1, tint(5, DEEP)); box(b, S, x - 2, y + 2, 5, 1, tint(5, CORE, 0.7));
      box(b, S, x - 1 + ((tick >> 2) % 3), y - 3 - ((tick >> 1) % 4), 1, 2, tint(5, GLOW, 0.8));
      break;
    case 6: // holy: a glyph of light
      box(b, S, x - 3, y, 7, 1, tint(6, GLOW)); box(b, S, x, y - 3, 1, 7, tint(6, GLOW)); box(b, S, x, y, 1, 1, tint(6, SPARK)); if (pulse) sparkle(b, S, x, y, 4, 6, 0.8);
      break;
    case 7: // earth: three stone stakes
      box(b, S, x - 3, y - 4, 2, 4, tint(7, CORE)); box(b, S, x, y - 6, 2, 6, tint(7, CORE)); box(b, S, x + 3, y - 4, 2, 4, tint(7, CORE));
      box(b, S, x - 3, y - 4, 1, 1, tint(7, GLOW)); box(b, S, x, y - 6, 1, 1, tint(7, GLOW)); box(b, S, x + 3, y - 4, 1, 1, tint(7, GLOW)); box(b, S, x - 3, y - 1, 8, 1, tint(7, DEEP));
      break;
    case 8: { // wind: a pinwheel
      const a = tick * 0.3;
      for (let k = 0; k < 4; k++) { const aa = a + k * 1.5708; box(b, S, x + Math.cos(aa) * 3, y - 1 + Math.sin(aa) * 2, 2, 1, tint(8, k & 1 ? GLOW : SPARK)); }
      box(b, S, x, y - 1, 1, 1, tint(8, CORE));
      break;
    }
    case 9: // arcane: a small rune circle
      dotRing(b, S, x, y, 4, 8, tint(9, GLOW), 0.8, tick * 0.1); rune(b, S, x, y - 1, tick >> 3, 9);
      break;
    case 10: // blood: red thorns
      box(b, S, x - 3, y - 3, 1, 3, tint(10, CORE)); box(b, S, x - 1, y - 5, 1, 5, tint(10, CORE)); box(b, S, x + 1, y - 4, 1, 4, tint(10, CORE)); box(b, S, x + 3, y - 3, 1, 3, tint(10, CORE));
      box(b, S, x - 1, y - 5, 1, 1, tint(10, GLOW)); box(b, S, x - 2, y, 5, 1, tint(10, DEEP)); box(b, S, x + 1, y + 1 + (tick >> 2) % 2, 1, 1, tint(10, CORE));
      break;
    default:
      box(b, S, x - 1, y - 1, 3, 3, tint(0, CORE));
  }
}

/** A planted totem of an element: a short stone post whose gem charges as its next shot nears, a faint ring of its range. */
function totem(b: Batcher, S: Sprites, e: Entities, i: number, sx: number, sy: number, tick: number, el: number): void {
  const x = Math.round(sx), y = Math.round(sy), life = e.cool2[i], gap = Math.max(1, e.buff[i] || 60), wind = e.wind[i];
  const charge = wind < 28 ? 1 - wind / 28 : 0;
  const fired = gap - wind < 5 && gap - wind >= 0 ? 1 - (gap - wind) / 5 : 0;
  const sink = life < 30 ? Math.round((30 - life) / 30 * 7) : 0;
  const fade = life < 30 ? life / 30 : 1;
  const r = e.rem[i];
  dotRing(b, S, x, y, r, Math.min(60, Math.max(16, Math.round(r / 4))), tint(el, CORE, 0.1 * fade), 0.85);
  box(b, S, x - 5, y - 1, 11, 3, 0x40000000);
  const y0 = y - sink;
  const stone = shade(el, DEEP, 0.25), stoneHi = shade(el, DEEP, 0.5);
  const sc = (0xff << 24) | stone, sh = (0xff << 24) | stoneHi;
  box(b, S, x - 3, y0 - 4, 7, 4, sc); box(b, S, x - 3, y0 - 4, 7, 1, sh);
  box(b, S, x - 2, y0 - 9, 5, 5, sc); box(b, S, x - 2, y0 - 9, 1, 5, sh);
  box(b, S, x - 3, y0 - 11, 7, 2, sh);
  // the gem: dim, then bright as the shot nears, white as it leaves
  const gem = fired > 0 ? SPARK : charge > 0.7 ? GLOW : CORE;
  box(b, S, x - 1, y0 - 8, 3, 3, tint(el, gem, fade * (0.55 + 0.45 * Math.max(charge, fired))));
  box(b, S, x, y0 - 7, 1, 1, tint(el, SPARK, fade));
  const top = y0 - 11;
  switch (el) {
    case 1: flame(b, S, x, top, 4 + Math.round(charge * 4), tick, i, 1, fade); break;
    case 2: crystal(b, S, x, top, 5 + Math.round(charge * 2), 2, fade, charge > 0.6); break;
    case 3: // lightning: a rod that arcs when charged
      box(b, S, x, top - 5, 1, 5, tint(3, CORE, fade)); box(b, S, x, top - 6, 1, 1, tint(3, SPARK, fade));
      if (charge > 0.2 && ((tick >> 1) & 1)) jagged(b, S, x, top - 6, x + (hash01(tick + i) - 0.5) * 12, top - 6 + (hash01(tick * 3 + i) - 0.3) * 8, tick + i, 2, 3, tint(3, SPARK, fade), -1);
      break;
    case 4: box(b, S, x - 1, top - 2, 3, 2, tint(4, CORE, fade)); box(b, S, x, top - 3 - ((tick >> 2) & 1), 1, 1, tint(4, SPARK, fade)); break;
    case 5: for (let k = 0; k < 3; k++) box(b, S, x - 1 + k + ((tick >> 2) + k) % 2, top - 2 - ((tick * 0.5 + k * 3) % 7), 1, 2, tint(5, k === 1 ? GLOW : CORE, fade * 0.9)); break;
    case 6: sparkle(b, S, x, top - 3, 2 + (charge > 0.5 ? 1 : 0), 6, fade); break;
    case 7: box(b, S, x - 1, top - 2, 3, 2, tint(7, CORE, fade)); box(b, S, x, top - 3, 1, 1, tint(7, GLOW, fade)); break;
    case 8: for (let k = 0; k < 3; k++) { const a = tick * 0.4 + k * 2.094; box(b, S, x + Math.cos(a) * 3, top - 3 + Math.sin(a) * 1.5, 2, 1, tint(8, k ? GLOW : SPARK, fade)); } break;
    case 9: rune(b, S, x, top - 4 - (((tick >> 4) & 1)), tick >> 3, 9, fade); break;
    case 10: box(b, S, x, top - 2, 1, 2, tint(10, CORE, fade)); box(b, S, x, top + 1 + ((tick >> 2) % 4), 1, 1, tint(10, CORE, fade * 0.8)); break;
    default: box(b, S, x - 1, top - 1, 3, 1, sh);
  }
  if (charge > 0 && fired === 0) { // motes gather into the gem
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i + tick * 0.1, d = 9 * (1 - charge);
      box(b, S, x + Math.cos(a) * d, y0 - 7 + Math.sin(a) * d * 0.6, 1, 1, tint(el, k & 1 ? SPARK : GLOW, 0.4 + 0.6 * charge));
    }
  }
  if (fired > 0) sparkle(b, S, x, y0 - 7, 3, el, fired);
}

/** The gathering storm (Storm zone, still gathering) of an element. */
function storm(b: Batcher, S: Sprites, e: Entities, i: number, sx: number, sy: number, tick: number, el: number): void {
  const r = e.rem[i], left = e.wind[i], blink = (tick >> 2) & 1 ? 0.8 : 0.45;
  warnRing(b, S, sx, sy, r, 26, el, blink);
  dotRing(b, S, sx, sy, r * clamp01(0.3 + 0.7 * (1 - left / 50)), 18, tint(el, GLOW, 0.4), 0.85, 0, 2);
  swirlMotes(b, S, el, sx, sy, r, tick, i, 16, 0.75 + 0.25 * clamp01(1 - left / 50));
}

/** A pit of an element: a ring that opens into a vortex in its colours. */
function pit(b: Batcher, S: Sprites, e: Entities, i: number, sx: number, sy: number, tick: number, el: number): void {
  const r = e.rem[i], open = e.mode[i] === 1, fade = e.cool2[i] < 40 ? e.cool2[i] / 40 : 1;
  warnRing(b, S, sx, sy, r, 28, el, (open ? 0.85 : ((tick >> 2) & 1 ? 0.8 : 0.4)) * fade);
  if (!open) { swirlMotes(b, S, el, sx, sy, r, tick, i, 5, 0.5 * fade); return; }
  pond(b, S, sx, sy, r * 0.8, i, tint(el, DEEP, 0.22 * fade));
  pond(b, S, sx, sy, r * 0.45, i + 1, tint(el, DEEP, 0.4 * fade));
  for (let k = 0; k < 4; k++) dotRing(b, S, sx, sy, r * (0.25 + 0.2 * k), 16 + k * 4, tint(el, k < 2 ? DEEP : k === 2 ? CORE : GLOW, (0.7 - k * 0.1) * fade), 0.85, tick * 0.02 * (k & 1 ? -1 : 1));
  for (let k = 0; k < 10; k++) {
    const t = ((tick * 0.9 + k * 11) % 40) / 40, a = tick * (el === 8 ? 0.2 : 0.12) + k * 0.63 + t * 3, rr = r * (1 - t);
    box(b, S, sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.7 - 1, 1, 1, tint(el, k & 1 ? SPARK : GLOW, 0.85 * fade));
  }
  switch (el) {
    case 1: // lava: a hot heart that bubbles
      dotRing(b, S, sx, sy, r * 0.18, 8, tint(1, SPARK, (0.6 + 0.3 * ((tick >> 2) & 1)) * fade), 0.85);
      if (((tick >> 3) + i) % 3 === 0) box(b, S, sx + (hash01(tick >> 3) - 0.5) * r * 0.5, sy - 2, 2, 2, tint(1, GLOW, fade));
      break;
    case 3: // lightning: arcs pour into the centre
      for (let k = 0; k < 2; k++) { const a = hash01((tick >> 1) * 3 + k + i) * TAU; jagged(b, S, sx + Math.cos(a) * r * 0.9, sy + Math.sin(a) * r * 0.65, sx, sy, (tick >> 1) + k * 9 + i, 3, 4, tint(3, CORE, fade), tint(3, SPARK, fade)); }
      break;
    case 5: // shadow: a black hole
      disc(b, S, sx, sy, Math.max(1, r * 0.14), tint(5, DEEP, fade));
      break;
    case 6: // holy: a shaft of light up out of it
      box(b, S, sx - 1, sy - 28, 3, 28, tint(6, SPARK, 0.25 * fade)); box(b, S, sx, sy - 28, 1, 28, tint(6, SPARK, 0.5 * fade));
      break;
    case 9:
      for (let k = 0; k < 6; k++) { const a = tick * 0.05 + k * 1.0472; rune(b, S, sx + Math.cos(a) * r * 0.7, sy + Math.sin(a) * r * 0.55, (tick >> 3) + k, 9, fade); }
      break;
  }
}

/**
 * Draws a zone that carries an element (or a pool/totem, which always do); returns false when the zone is none of those, so the hand-made look draws it.
 * `sx`, `sy`: its screen position.
 */
export function drawElemZone(b: Batcher, S: Sprites, e: Entities, i: number, sx: number, sy: number, tick: number): boolean {
  const sub = e.sub[i], el = e.flags ? elemId(e.flags[i] & ELEM_MASK) : 0; // (a bare test double may have no flags)
  switch (sub) {
    case ZoneKind.Pool: pool(b, S, e, i, sx, sy, tick, el); return true;
    case ZoneKind.Totem: totem(b, S, e, i, sx, sy, tick, el); return true;
    case ZoneKind.Rock: if (!el || e.mode[i] !== 0) return false; lobPending(b, S, e, i, sx, sy, tick, el); return true;
    case ZoneKind.Trap: if (!el) return false; trap(b, S, e, i, sx, sy, tick, el); return true;
    case ZoneKind.Storm: if (!el) return false; storm(b, S, e, i, sx, sy, tick, el); return true;
    case ZoneKind.Pit: if (!el) return false; pit(b, S, e, i, sx, sy, tick, el); return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------- telegraphs

/** What `elemTelegraph` leaves for the caller to draw above the head: nothing handled, a "!", a "!!", or no glyph at all. */
export const Glyph = { Unhandled: 0, Bang: 1, Bang2: 2, None: 3 } as const;

/** A dotted lane from (x, y) along (ux, uy) for `len` px, brighter and denser as the shot nears. */
function lane(b: Batcher, S: Sprites, x: number, y: number, ux: number, uy: number, len: number, el: number, p: number, blink: number): void {
  const step = p > 0.75 ? 3 : 6;
  for (let d = 12; d <= len; d += step) {
    box(b, S, x + ux * d, y + uy * d + 1, 2, 2, tint(el, DEEP, p > 0.75 ? 0.8 : blink * 0.7));
    box(b, S, x + ux * d, y + uy * d, 2, 2, tint(el, p > 0.75 ? GLOW : CORE, p > 0.75 ? 0.95 : blink));
  }
  const ex = x + ux * len, ey = y + uy * len;
  box(b, S, ex - 1, ey - 1, 3, 3, tint(el, CORE, 0.5 + 0.5 * p));
  box(b, S, ex, ey, 1, 1, tint(el, SPARK, 0.6 + 0.4 * p));
  if (p > 0.75 && ((p * 40) | 0) & 1) sparkle(b, S, ex, ey, 3, el, 0.9);
}

/**
 * The windup tell of a special that is made of an element, or of one of the new kinds (bolt, ring, cone, totem, even with none). `p` = 0..1 through the windup.
 * Returns what glyph to draw over the caster's head, or `Glyph.Unhandled` when the old telegraph should draw instead.
 */
export function elemTelegraph(b: Batcher, S: Sprites, e: Entities, i: number, sp: Special, sx: number, feetY: number, tick: number, p: number): number {
  const el = elemId(sp.element);
  const blink = (tick >> 2) & 1 ? 0.8 : 0.45;
  switch (sp.kind) {
    case 'bolt': { // an aim line per bolt, ending in a pip, and a bead charging at the hand
      const base = Math.atan2(e.ay[i], e.ax[i]), y0 = feetY - 7, L = Math.min(150, Math.max(70, sp.maxRange));
      for (let k = 0; k < sp.count; k++) {
        const a = base + (k - (sp.count - 1) / 2) * sp.spread * TAU;
        lane(b, S, sx, y0, Math.cos(a), Math.sin(a), L, el, p, blink);
      }
      orb(b, S, sx + e.ax[i] * 9, y0 + e.ay[i] * 9, p < 0.4 ? 1 : p < 0.75 ? 2 : 3, el, tick, i, e.ax[i], e.ay[i]);
      return Glyph.Bang;
    }
    case 'ring': { // a ring of ticks that closes in, with a mark for each shot
      const n = Math.min(24, sp.count), R = 30 - 12 * p + Math.sin(tick * 0.4);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + tick * 0.03, c = Math.cos(a), s = Math.sin(a);
        box(b, S, sx + c * R - 1, feetY - 1 + s * R * 0.8, 3, 3, tint(el, DEEP, blink * 0.8));
        box(b, S, sx + c * R - 1, feetY - 2 + s * R * 0.8 - 1, 2, 2, tint(el, CORE, blink));
        box(b, S, sx + c * (R + 4), feetY - 2 + s * (R + 4) * 0.8, 2, 2, tint(el, DEEP, 0.3 + 0.5 * p));
        box(b, S, sx + c * (R + 7), feetY - 2 + s * (R + 7) * 0.8, 1, 1, tint(el, GLOW, 0.2 + 0.6 * p));
      }
      sparkle(b, S, sx, feetY - 9, 1 + Math.round(p * 3), el, 0.5 + 0.5 * p);
      return Glyph.Bang;
    }
    case 'cone': { // a wedge on the ground (true ground coordinates, as the hit test uses) that fills from the mouth outward
      const base = Math.atan2(e.ay[i], e.ax[i]), half = sp.arc * TAU, y0 = feetY - 2;
      for (let sgn = -1; sgn <= 1; sgn += 2) {
        const ex = Math.cos(base + sgn * half), ey = Math.sin(base + sgn * half);
        for (let d = 8; d <= sp.range; d += 4) {
          box(b, S, sx + ex * d, y0 + ey * d + 1, 2, 2, tint(el, DEEP, blink * 0.7));
          box(b, S, sx + ex * d, y0 + ey * d, 2, 2, tint(el, CORE, blink));
        }
      }
      const steps = Math.max(5, Math.round(half * sp.range / 4));
      for (let k = 0; k <= steps; k++) { const a = base - half + (k / steps) * half * 2; box(b, S, sx + Math.cos(a) * sp.range, y0 + Math.sin(a) * sp.range, 2, 2, tint(el, CORE, 0.45)); }
      const front = sp.range * p;
      for (let d = 10; d <= front; d += 6) {
        const cnt = Math.max(1, Math.round(half * 2 * d / 7));
        for (let k = 0; k <= cnt; k++) {
          const a = base - half + (cnt === 0 ? 0.5 : k / cnt) * half * 2;
          if (hash01(k * 7 + d + (tick >> 2)) < 0.25) continue;
          box(b, S, sx + Math.cos(a) * d, y0 + Math.sin(a) * d, 2, 2, tint(el, d > front - 8 ? SPARK : GLOW, 0.55 + 0.4 * p));
        }
      }
      return Glyph.Bang2;
    }
    case 'totem': { // a rune circle on the ground where the post will rise
      const ox = sx + (e.ax[i] || 0) * 22, oy = feetY + (e.ay[i] || 0) * 16;
      dotRing(b, S, ox, oy, 12 - 4 * p, 14, tint(el, CORE, blink), 0.8, tick * 0.06);
      dotRing(b, S, ox, oy, 6 * (0.3 + 0.7 * p), 8, tint(el, GLOW, 0.4 + 0.5 * p), 0.8, -tick * 0.1);
      rune(b, S, ox, oy - 1, tick >> 3, el, 0.5 + 0.5 * p);
      return Glyph.Bang;
    }
  }
  if (!el) return Glyph.Unhandled;
  switch (sp.kind) {
    case 'lob': case 'trap': case 'storm': case 'pit': case 'leap': case 'pounce': case 'hex': case 'dazzle': {
      const tx = sx + (e.ax[i] - e.x[i]), ty = feetY + (e.ay[i] - e.y[i]);
      const R = sp.kind === 'trap' ? sp.radius + 3 - 3 * p : sp.radius;
      warnRing(b, S, tx, ty, R, 24, el, blink);
      dotRing(b, S, tx, ty, R * (0.2 + 0.8 * p), 16, tint(el, GLOW, 0.5 + 0.4 * p), 0.85, 0, 2);
      swirlMotes(b, S, el, tx, ty, R, tick, i, 8, 0.4 + 0.5 * p);
      return Glyph.Bang;
    }
    case 'nova': case 'wail': case 'whiteout': case 'gust': {
      warnRing(b, S, sx, feetY, sp.radius, 40, el, blink);
      dotRing(b, S, sx, feetY, sp.radius * (0.2 + 0.8 * p), 28, tint(el, GLOW, 0.5 + 0.4 * p), 0.85, 0, 2);
      swirlMotes(b, S, el, sx, feetY, sp.radius, tick, i, 8, 0.4 + 0.5 * p);
      return Glyph.Bang2;
    }
    case 'beam': {
      for (let d = 10; d < sp.range; d += p > 0.75 ? 3 : 6) {
        box(b, S, sx + e.ax[i] * d, feetY - 7 + e.ay[i] * d, 2, 2, tint(el, DEEP, p > 0.75 ? 0.85 : blink * 0.7));
        box(b, S, sx + e.ax[i] * d, feetY - 8 + e.ay[i] * d, 2, 2, tint(el, p > 0.75 ? SPARK : CORE, p > 0.75 ? 0.95 : blink));
      }
      return Glyph.Bang2;
    }
  }
  return Glyph.Unhandled;
}

/** The colour (0xRRGGBB) of the "!" over an element's caster. */
export const glyphColor = (el: number): number => (el ? shade(el, CORE, 0) : 0xffe14a);

/** An element's field around a monster (`elemAura`): a faint ring on the ground with its weather in it. */
export function drawElemAura(b: Batcher, S: Sprites, el: number, radius: number, sx: number, sy: number, tick: number, id: number): void {
  el = elemId(el);
  dotRing(b, S, sx, sy, radius, 30, tint(el, CORE, 0.28 + 0.1 * (((tick >> 3) + id) & 1)), 0.85);
  swirlMotes(b, S, el, sx, sy, radius, tick, id, 4, 0.7);
}

/**
 * Cheap elemental cues over a hero (`top` = screen y of the head): shock sparks while a lightning hit lingers (`witherT`), a flash of light while a
 * holy hit blinds (stunned and silenced together), and rime crystals on a hero frozen solid (rooted while chilled).
 */
export function drawHeroElemCues(b: Batcher, S: Sprites, p: { witherT: number; rootT: number; silenceT: number; slowT: number }, sx: number, top: number, tick: number, id: number): void {
  if (p.witherT > 0 && (tick & 2) === 0) {
    const q = (tick >> 2) + id * 3;
    for (let k = 0; k < 2; k++) {
      const x0 = sx + (k ? 4 : -4), y0 = top + 6 + hash01(q + k) * 8;
      jagged(b, S, x0, y0, x0 + (k ? 3 : -3), y0 + 3 + hash01(q * 3 + k) * 3, q * 5 + k, 1.2, 2, tint(3, CORE), -1);
      box(b, S, x0, y0, 1, 1, tint(3, SPARK));
    }
  }
  if (p.rootT > 0 && p.silenceT > 0 && p.rootT <= 30) sparkle(b, S, sx, top - 4, 2 + ((tick >> 2) & 1), 6); // blinded by a holy flash
  if (p.rootT > 0 && p.slowT > 0 && p.silenceT === 0) { // frozen: crystals at the shoulders and a glint
    crystal(b, S, sx - 6, top + 16, 5, 2);
    crystal(b, S, sx + 6, top + 16, 4, 2);
    if (((tick >> 3) + id) & 1) sparkle(b, S, sx, top + 8, 2, 2, 0.9);
  }
}
