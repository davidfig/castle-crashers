// Where the road passes from one biome into the next, both biomes are drawn at once and each ELEMENT (a ground tile, a decal, a parallax strip,
// a cell of sky, a column of the crest) belongs to one of them. The share that belongs to the new biome rises along the road, so the old
// biome's things are replaced a few at a time by the new one's: no colour is ever blended and nothing is faded across the whole view.
// Render-only; see docs/11-backgrounds.md (Biome transitions).
import { makeBlendedMood, type BiomeDef, type BlendedMood } from '../data/biomes';
import { LEVEL_CAM_END, STORE_CAM_END } from '../sim/constants';

/** The scenery is drawn in road coordinates: a level's camera plus how far along the road that level (and its store) begins, so the horizon, the ground and the hashes carry straight on from one level to the next. */
export const ROAD_STRIDE = LEVEL_CAM_END + STORE_CAM_END;
export function roadOffset(levelIndex: number): number { return levelIndex * ROAD_STRIDE; }

/** The turn happens between these two points of a level's stretch of road (0 = where the level's camera starts): it begins well inside the level and is complete where the next level's camera starts. */
export const TURN_FROM = 2000;
export const TURN_TO = ROAD_STRIDE;

function smoothstep(t: number): number { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }

function hash3(x: number, y: number, salt: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(salt, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in 0..1 with a feature size of `cell` px: neighbouring elements get similar values, so the new biome arrives in patches and not as salt and pepper. */
function blob(x: number, y: number, cell: number, salt: number): number {
  const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash3(ix, iy, salt), b = hash3(ix + 1, iy, salt), c = hash3(ix, iy + 1, salt), d = hash3(ix + 1, iy + 1, salt);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * The noise an element at (x, y) uses to decide which biome it belongs to: patchy at `cell` px, roughened by the element's own hash,
 * and evened out so a share of 0.3 really gives it to the new biome about 30% of the time.
 */
export function patchNoise(x: number, y: number, cell: number, salt: number): number {
  const n = 0.6 * blob(x, y, cell, salt) + 0.4 * hash3(Math.floor(x), Math.floor(y), salt + 91);
  // (the sum of a smooth and a flat random value piles up in the middle; this flattens it again)
  return n < 0.5 ? 2 * n * n : 1 - 2 * (1 - n) * (1 - n);
}

/** A random value in 0..1 for the element at (x, y): no patchiness at all. */
export function flatNoise(x: number, y: number, salt: number): number { return hash3(x, y, salt); }

/**
 * The biomes on screen: index 0 is the biome of the level, index 1 (when `n` is 2) the one the road turns into. Elements are
 * drawn once per biome, each asking `keep` / `weight` whether it is theirs at that spot of the road.
 */
export class Scenery {
  n = 1;
  biome: BiomeDef[] = [undefined as unknown as BiomeDef, undefined as unknown as BiomeDef];
  mood: BlendedMood[] = [makeBlendedMood(), makeBlendedMood()];
  /** Road coordinates between which the share of the new biome rises from nothing to everything. */
  from = 0;
  to = 1;

  /** One biome, or two when `next` differs; `base` is the road coordinate of the level's camera start. */
  set(biome: BiomeDef, next: BiomeDef | undefined, base: number): void {
    this.biome[0] = biome;
    this.n = next && next !== biome ? 2 : 1;
    if (this.n === 2) this.biome[1] = next!;
    this.from = base + TURN_FROM;
    this.to = base + TURN_TO;
  }

  /** The share of the road at `x` that has turned into the new biome (0 with only one biome). */
  share(x: number): number { return this.n === 1 ? 0 : smoothstep((x - this.from) / (this.to - this.from)); }

  /**
   * How far the new biome's sky has come at road `x`, smoothly (0..1). `lag` (0 at the horizon, 1 at the top of the sky) delays the turn by up
   * to `lean` of its length, so the new sky comes up from the horizon; it is still complete by the end of the turn.
   */
  skyShare(x: number, lag: number, lean: number): number {
    if (this.n === 1) return 0;
    const u = (x - this.from) / (this.to - this.from);
    return smoothstep((u - lag * lean) / (1 - lean));
  }

  /** Whether the road is still entirely biome 0 / has become entirely biome 1 over [x0, x1]. */
  allOld(x1: number): boolean { return this.n === 1 || x1 <= this.from; }
  allNew(x0: number): boolean { return this.n === 2 && x0 >= this.to; }

  /** Does biome `i` own an element at road `x` whose noise is `h` (0..1)? Exactly one biome does. */
  keep(i: number, x: number, h: number): boolean {
    if (this.n === 1) return i === 0;
    return (h < this.share(x)) === (i === 1);
  }

  /** The same question answered softly (0..1), for things that move or can overlap (clouds, fog, parallax strips): biome `i`'s opacity for that element. */
  weight(i: number, x: number, h: number): number {
    if (this.n === 1) return i === 0 ? 1 : 0;
    // the noise is squeezed into [FADE / 2, 1 - FADE / 2] so every element is fully the old biome's at a share of 0 and fully the new one's at 1:
    // otherwise the few with noise near 1 were still half faded at the end of the turn, and popped in when the next level began
    const v = Math.min(1, Math.max(0, (this.share(x) - (FADE / 2 + h * (1 - FADE))) / FADE + 0.5));
    return i === 1 ? v : 1 - v;
  }
}

/** How much of the share one element takes to fade from one biome to the other (`Scenery.weight`). */
const FADE = 0.12;

/** The scenery of an ordinary stretch of road: one biome all the way. */
export const SOLO = new Scenery();
