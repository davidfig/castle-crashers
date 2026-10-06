// The barriers that hold the camera (docs/03-gameplay-combat.md, Gates): one wall of the level's own material across the whole
// depth of the field, drawn under the characters. Closed until the screen is clear, then it breaks, lifts or falls away.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W, WORLD_H } from '../sim/constants';
import type { GameState } from '../sim/state';
import type { Sprites } from './art';
import { FIELD_Y0 } from './background';

/** Ticks a gate takes to open. */
const OPEN_TICKS = 45;
/** Depth between the uprights of a barrier, in field px. */
const STEP = 12;

type Px = (x: number, y: number, w: number, h: number, color: number, a?: number) => void;

/** 0 = shut, 1 = fully open; gate `i` of the level. */
function openness(s: GameState, i: number): number {
  if (i < s.gateIdx - 1) return 1;
  if (i === s.gateIdx - 1) return Math.min(1, (s.tick - s.gateOpenTick) / OPEN_TICKS);
  return 0;
}

/** A cheap per-post wobble so the posts are not a ruler-straight comb. */
function jitter(k: number, n: number): number {
  return ((k * 2654435761) >>> (8 + n)) & 3;
}

/** Meadow: a palisade of sharpened logs with a crossbar and a torn banner. The logs topple flat as it opens. */
function palisade(px: Px, k: number, u: number, base: number, sx: number): void {
  const h = 30 + jitter(k, 0) * 2;
  const top = Math.round(h * (1 - u) + 3 * u);
  const w = 6;
  const lean = Math.round(u * (k % 2 ? 3 : -3));
  px(sx - 3 + lean, base - top, w, top, 0x5c3f28);
  px(sx - 3 + lean, base - top, 2, top, 0x7a5636);
  px(sx + 2 + lean, base - top, 1, top, 0x3a2616);
  if (u < 0.5) { // sharpened tip
    px(sx - 2 + lean, base - top - 2, 4, 2, 0x5c3f28);
    px(sx - 1 + lean, base - top - 4, 2, 2, 0x7a5636);
  }
  if (u < 0.7) { // lashed crossbar
    px(sx - 4, base - Math.round(h * 0.45 * (1 - u)) - 2, 8, 2, 0x3a2616);
    px(sx - 4, base - Math.round(h * 0.45 * (1 - u)) - 2, 8, 1, 0x7a5636);
  }
  if (k % 5 === 2 && u < 0.4) px(sx + 3, base - top + 3, 5, 8, 0x9c2a22); // a rag of red cloth nailed on
}

/** Haunted Keep: an iron portcullis between stone piers, a torch on each pier. The bars wind up as it opens. */
function portcullis(px: Px, _k: number, u: number, base: number, sx: number, tick: number, ends: boolean): void {
  const h = 38;
  if (ends) { // a stone pier at either end of the line
    px(sx - 5, base - h - 6, 10, h + 6, 0x4a4650);
    px(sx - 5, base - h - 6, 3, h + 6, 0x68646f);
    px(sx - 6, base - h - 8, 12, 3, 0x3a3640);
    px(sx - 1, base - h - 14, 2, 6, 0x2a262c);
    const f = 3 + ((tick >> 2) & 1);
    px(sx - 2, base - h - 14 - f, 4, f, 0xf0922a);
    px(sx - 1, base - h - 14 - f - 1, 2, f, 0xffd35a);
    px(sx - 12, base - h - 18, 24, 20, 0xff9a3a, 0.06);
    return;
  }
  const lift = Math.round(u * (h - 2)); // the grille winds up, leaving only its lower teeth in the arch
  const gh = h - lift;
  px(sx - 4, base - h, 8, gh, 0x23252c, 0.9); // the iron grille: a dark panel with bars picked out in steel
  px(sx - 4, base - h, 1, gh, 0x8a8e9c);
  px(sx - 1, base - h, 1, gh, 0x6a6e7c);
  px(sx + 2, base - h, 1, gh, 0x6a6e7c);
  px(sx - 4, base - h, 8, 2, 0x3a3c46); // top beam
  px(sx - 4, base - h + 16 + Math.round(u * 6), 8, 2, 0x3a3c46); // crossbar rides up with it
  if (u < 0.9) { // spiked teeth along the foot
    px(sx - 3, base - lift - 3, 1, 3, 0xb0b4c2);
    px(sx, base - lift - 3, 1, 3, 0xb0b4c2);
    px(sx + 3, base - lift - 3, 1, 3, 0xb0b4c2);
  }
}

/** Frozen Pass: a wall of ice shards. It cracks and sinks into glittering rubble as it opens. */
function iceWall(px: Px, k: number, u: number, base: number, sx: number, tick: number): void {
  const h0 = 24 + jitter(k, 2) * 5;
  const h = Math.round(h0 * (1 - u) + 3 * u);
  const w = 8 + jitter(k, 4);
  px(sx - (w >> 1), base - h, w, h, 0x9ec8e0);
  px(sx - (w >> 1), base - h, 2, h, 0xe6f6ff);
  px(sx + (w >> 1) - 2, base - h, 2, h, 0x6a9ac0);
  px(sx - 2, base - h - 3, 4, 3, 0xc8e8f8); // a pointed crown
  px(sx - 1, base - h - 5, 2, 2, 0xe6f6ff);
  if (u > 0 && u < 1) { // cracks, then a flash of shards
    px(sx - 1, base - (h >> 1), 1, 5, 0x3a6a90);
    px(sx + 2 + (k % 3), base - h - 4 - Math.round(u * 8), 1, 1, 0xffffff, 0.9 - u * 0.9);
  } else if (u === 0 && ((tick + k * 7) & 63) === 0) {
    px(sx - 1, base - h + 2, 2, 2, 0xffffff, 0.9); // a glint
  }
  px(sx - (w >> 1) - 1, base - 1, w + 2, 2, 0xe6f6ff, 0.5); // drift of snow at the foot
}

/** Draws every gate in view. `camX` is the (integer) camera of the frame. */
export function drawGates(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  for (let g = 0; g < s.gates.length; g++) {
    const gx = s.gates[g].x;
    const sx = Math.round(gx - camX);
    if (sx < -24 || sx > VIEW_W + 24) continue;
    const u = openness(s, g);
    const n = Math.floor(WORLD_H / STEP) + 1;
    for (let k = 0; k < n; k++) {
      const y = k * STEP + 2;
      const base = Math.round(FIELD_Y0 + y + oy);
      const px: Px = (x, yy, w, h, color, a = 1) => b.drawScaled(S.px, x, yy, w, h, hex(color, a));
      px(sx - 5, base - 1, 10, 2, 0x000000, 0.22); // shadow on the ground
      if (s.biome === 1) portcullis(px, k, u, base, sx, s.tick, k === 0 || k === n - 1);
      else if (s.biome === 2) iceWall(px, k, u, base, sx, s.tick);
      else palisade(px, k, u, base, sx);
    }
  }
}
