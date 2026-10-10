// The scenery is drawn in road coordinates, and the road turns from one biome into the next over a long stretch (data/scenery/road.ts), so
// part of the way through a turn both biomes are on screen. Every ELEMENT (a ground tile, a decal, a stretch of path, a parallax strip,
// a cloud, a cell of sky, a column of the crest) belongs to one of them, and the share that belongs to the new biome rises along the turn.
// No colour is blended and nothing is faded across the whole view: at a share of 0.1 one tile in ten is the new biome's, in patches.
// Render-only; see docs/17-generated-scenery.md and docs/11-backgrounds.md (Biome transitions).
import { makeBlendedMood, type BiomeDef, type BlendedMood } from '../data/biomes';
import { profile, profileSlope, spanIndexAt, type Span } from '../data/scenery/road';
import type { World } from '../data/scenery/world';
import { LEVEL_CAM_END, STORE_CAM_END } from '../sim/constants';

/** The scenery is drawn in road coordinates: a level's camera plus how far along the road that level (and its store) begins, so the horizon, the ground and the hashes carry straight on from one level to the next. */
export const ROAD_STRIDE = LEVEL_CAM_END + STORE_CAM_END;
export function roadOffset(levelIndex: number): number { return levelIndex * ROAD_STRIDE; }

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

/** Ground cells are this many px square: the finest grain at which one biome's ground hands over to the other's. */
export const GROUND_CELL = 8;
let cdf: Float32Array | null = null;
/** Raw ground noise at cell (cx, cy): large soft blobs, smaller lumps within them and a little roughness, so a border between two biomes wanders like a coast. */
function rawGround(cx: number, cy: number): number {
  const x = cx * GROUND_CELL + GROUND_CELL / 2, y = cy * GROUND_CELL + GROUND_CELL / 2;
  return 0.5 * blob(x, y, 104, 11) + 0.32 * blob(x, y, 38, 12) + 0.18 * hash3(cx, cy, 13);
}
/**
 * The noise that decides which biome the ground cell (cx, cy) belongs to, in 0..1 and evened out (a share of 0.3 gives the new biome 30% of
 * the cells): its blobs are large and its edges ragged at the cell size, so the two grounds meet along an irregular shore, not along tile edges.
 */
export function groundNoise(cx: number, cy: number): number {
  if (!cdf) { // the empirical distribution of the raw noise, so each value maps to the share of cells below it
    const n = 1 << 15, v = new Float32Array(n);
    for (let i = 0; i < n; i++) v[i] = rawGround((i * 7919) % 521 - 260, Math.floor(i / 521) * 3 - 90);
    v.sort();
    cdf = new Float32Array(257);
    for (let i = 0; i <= 256; i++) cdf[i] = v[Math.min(n - 1, Math.floor((i / 256) * (n - 1)))];
  }
  const r = rawGround(cx, cy);
  let lo = 0, hi = 256;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m] <= r) lo = m; else hi = m; }
  const span = cdf[hi] - cdf[lo];
  return (lo + (span > 1e-9 ? (r - cdf[lo]) / span : 0)) / 256;
}

/** A random value in 0..1 for the element at (x, y): no patchiness at all. */
export function flatNoise(x: number, y: number, salt: number): number { return hash3(x, y, salt); }

/** How many road px an element that moves or overlaps (a cloud, a strip of horizon, a wisp of fog) takes to fade from one biome to the other (`Scenery.weight`). */
export const FADE_PX = 180;

/**
 * The biomes on screen: index 0 is the one the road is turning out of, index 1 the one it turns into (when `n` is 2). Elements are drawn
 * once per biome, each asking `keep` / `weight` whether it is theirs at that spot of the road.
 */
export class Scenery {
  n = 1;
  biome: BiomeDef[] = [undefined as unknown as BiomeDef, undefined as unknown as BiomeDef];
  mood: BlendedMood[] = [makeBlendedMood(), makeBlendedMood()];
  /** Progress through the level for each biome (0..1), or -1 when the level is not in that biome (its mist is full and it shows no destination). */
  prog: [number, number] = [0, 0];
  /** The world's index of each biome on screen (the stage it belongs to). */
  slot: [number, number] = [0, -1];
  private span: Span | null = null;
  /** Road coordinates between which the share of the new biome rises from nothing to everything. */
  from = 0;
  to = 1;

  /** One biome only (a thumbnail, a dev run of a single level). */
  setSolo(biome: BiomeDef): void {
    this.biome[0] = biome;
    this.n = 1;
    this.span = null;
    this.prog[0] = 0; this.prog[1] = -1;
    this.slot[0] = 0; this.slot[1] = -1;
  }

  /** The two biomes in force for a view centred at road `centre`: the turn nearest to it. */
  setRoad(world: World, centre: number): void {
    const k = spanIndexAt(world.road, centre);
    if (k < 0) { this.setSolo(world.biomes[0].def); return; }
    const sp = world.road.spans[k];
    this.span = sp;
    this.n = 2;
    this.slot[0] = sp.a; this.slot[1] = sp.b;
    this.biome[0] = world.biomes[sp.a].def;
    this.biome[1] = world.biomes[sp.b].def;
    this.from = sp.from;
    this.to = sp.to;
  }

  /** The share of the road at `x` that has turned into the new biome (0 with only one biome). */
  share(x: number): number { return this.span === null ? 0 : profile(this.span, (x - this.from) / (this.to - this.from)); }

  /** How fast the share rises at `x`, per px of road. */
  slope(x: number): number { return this.span === null ? 0 : profileSlope(this.span, (x - this.from) / (this.to - this.from)) / (this.to - this.from); }

  /**
   * How far the new biome's sky has come at road `x`, smoothly (0..1). `lag` (0 at the horizon, 1 at the top of the sky) delays the turn by up
   * to `lean` of its length, so the new sky comes up from the horizon; it is still complete by the end of the turn.
   */
  skyShare(x: number, lag: number, lean: number): number {
    if (this.span === null) return 0;
    const u = (x - this.from) / (this.to - this.from);
    return profile(this.span, (u - lag * lean) / (1 - lean));
  }

  /** Whether the road is still entirely biome 0 / has become entirely biome 1 over [x0, x1]. */
  allOld(x1: number): boolean { return this.n === 1 || x1 <= this.from; }
  allNew(x0: number): boolean { return this.n === 2 && x0 >= this.to; }

  /** Does biome `i` own an element at road `x` whose noise is `h` (0..1)? Exactly one biome does. */
  keep(i: number, x: number, h: number): boolean {
    if (this.n === 1) return i === 0;
    return (h < this.share(x)) === (i === 1);
  }

  /**
   * The same question answered softly (0..1), for things that move or can overlap (clouds, fog, parallax strips): biome `i`'s opacity for
   * that element. The fade takes `FADE_PX` of road wherever the turn is steep or gentle, so a strip never lingers half faded.
   */
  weight(i: number, x: number, h: number): number {
    if (this.n === 1) return i === 0 ? 1 : 0;
    // the noise is squeezed off 0 and 1 so every element is fully the old biome's at a share of 0 and fully the new one's at 1
    const w = FADE_PX * Math.max(this.slope(x), 1e-7);
    const v = Math.min(1, Math.max(0, (this.share(x) - (0.001 + h * 0.998)) / w + 0.5));
    return i === 1 ? v : 1 - v;
  }
}

/** The scenery of an ordinary stretch of road: one biome all the way. */
export const SOLO = new Scenery();
