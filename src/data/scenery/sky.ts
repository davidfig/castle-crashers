// A run's weather: fronts laid along the road, each its own kind, length, strength and wind, starting and ending wherever the seed puts them.
// They have nothing to do with where a level or a biome begins or ends, so rain that starts in the Meadow's second level can still be falling
// as the road turns into the Keep, and a snowfall can drift down out of the pass into the marsh. What a front is made of comes from the places
// near it (a biome's own weather, mostly, sometimes its neighbour's, rarely anyone's), so snow is likelier near the pass than the dunes.
// Pure and seeded; render-only (the sim never sees the weather). See docs/17-generated-scenery.md.
import { createRng, rngFloat, rngInt, rngRange, type Rng } from '../../engine/rng';
import type { BiomeDef, WeatherKind } from '../biomes';

export interface Front {
  kind: WeatherKind;
  /** Road coordinates between which it blows: it builds up over the first third and fades over the last third. */
  from: number;
  to: number;
  /** Its strongest, 0..1. */
  peak: number;
  /** Sideways push (see `WeatherDef.wind`). */
  wind: number;
  /** How deep the lulls within it go, 0 (steady) to 1. */
  swing: number;
  seed: number;
}

export interface Sky { fronts: Front[] }

/** One kind of weather in force at a point of the road. */
export interface Active { kind: WeatherKind; level: number; wind: number }

/** Random knots of a front's surge noise sit this far apart along the road. */
const SURGE_PX = 640;
/** Clear weather between fronts, and how long a front runs, in road px (a level and its store are about 3300). */
const GAP: readonly [number, number] = [500, 3600];
const LEN: Readonly<Record<WeatherKind, readonly [number, number]>> = {
  rain: [2200, 6500], snow: [2600, 7000], fog: [3000, 8000], sandstorm: [2400, 5500], lightning: [1500, 4000],
};
/** Nothing falls in the first stretch of the road: the first level opens in clear air. */
const FIRST_CLEAR = 900;

function noise(seed: number, k: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 1, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** How strongly front `f` blows at road `x` (0..1). */
export function frontLevel(f: Front, x: number): number {
  if (x <= f.from || x >= f.to) return 0;
  const u = (x - f.from) / (f.to - f.from);
  const r = Math.min(1, u / 0.33, (1 - u) / 0.33), e = r * r * (3 - 2 * r);
  const pos = (x - f.from) / SURGE_PX, k = Math.floor(pos), t = pos - k, s = t * t * (3 - 2 * t);
  const n = noise(f.seed, k) * (1 - s) + noise(f.seed, k + 1) * s;
  return f.peak * e * (1 - f.swing + f.swing * Math.min(1, n * 1.25));
}

/**
 * The weather in force at road `x`, written into `out` (one entry per kind, the strongest front of that kind). Returns how many.
 * Fills in place, so the draw path allocates nothing.
 */
export function weatherAt(sky: Sky, x: number, out: Active[]): number {
  let n = 0;
  for (const f of sky.fronts) {
    if (x <= f.from || x >= f.to) continue;
    const level = frontLevel(f, x);
    if (level <= 0) continue;
    let slot = -1;
    for (let i = 0; i < n; i++) if (out[i].kind === f.kind) slot = i;
    if (slot < 0) { slot = n++; if (!out[slot]) out[slot] = { kind: f.kind, level: 0, wind: 0 }; out[slot].kind = f.kind; out[slot].level = 0; }
    if (level > out[slot].level) { out[slot].level = level; out[slot].wind = f.wind; }
  }
  return n;
}

/** The strongest rain at road `x`, felt a little ahead and kept a little behind (the cloud banks roll in before the first drops and linger as it eases). */
export function stormCoverAt(sky: Sky, x: number, scratch: Active[]): number {
  let m = 0;
  for (const d of [-420, -210, 0, 210, 420]) {
    const n = weatherAt(sky, x + d, scratch);
    for (let i = 0; i < n; i++) if (scratch[i].kind === 'rain') m = Math.max(m, scratch[i].level * (1 - Math.abs(d) / 840));
  }
  return Math.min(1, m * 1.7);
}

/** Picks what a front at road `mid` is made of: the weather of the biome it lies in, or its neighbour's, or (rarely) anyone's. */
function pickSource(rng: Rng, biomes: readonly BiomeDef[], stageLen: number, mid: number): { kind: WeatherKind; wind: number } {
  const stage = Math.min(biomes.length - 1, Math.max(0, Math.floor(mid / stageLen)));
  const frac = mid / stageLen - stage;
  const r = rngFloat(rng);
  let from = stage;
  if (r > 0.72 && r <= 0.93) from = Math.min(biomes.length - 1, Math.max(0, frac > 0.5 ? stage + 1 : stage - 1)); // the next place's weather, drifting in (or lingering from the last)
  else if (r > 0.93) from = rngInt(rng, biomes.length);
  const pool = biomes[from].weather?.filter((w) => w.kind !== 'lightning') ?? [];
  if (pool.length === 0) return { kind: 'rain', wind: 0.2 };
  const w = pool[rngInt(rng, pool.length)];
  return { kind: w.kind, wind: w.wind ?? 0 };
}

/**
 * The run's weather: clear stretches and fronts one after another along `length` px of road. About half the road is under some weather.
 * `stageLen` is the road px one biome lasts, `biomes` their definitions in order.
 */
export function planSky(seed: number, biomes: readonly BiomeDef[], stageLen: number): Sky {
  const rng = createRng(seed, 120);
  const length = biomes.length * stageLen;
  const fronts: Front[] = [];
  let x = FIRST_CLEAR + rngRange(rng, 0, 1800);
  while (x < length) {
    // a system: one front, now and then with a second kind riding along (rain with lightning, snow with fog)
    const probe = pickSource(rng, biomes, stageLen, x + 2500);
    const [lo, hi] = LEN[probe.kind];
    const len = rngRange(rng, lo, hi);
    const mid = x + len / 2;
    const src = Math.abs(mid - (x + 2500)) < 2500 ? probe : pickSource(rng, biomes, stageLen, mid);
    const sign = rngFloat(rng) < 0.3 ? -1 : 1;
    const f: Front = { kind: src.kind, from: x, to: x + len, peak: rngRange(rng, 0.45, 1), wind: src.wind * sign * rngRange(rng, 0.6, 1.3), swing: rngRange(rng, 0.35, 0.85), seed: Math.floor(rngFloat(rng) * 0x7fffffff) };
    fronts.push(f);
    if (f.kind === 'rain' && f.peak > 0.6 && rngFloat(rng) < 0.5) {
      const inset = len * rngRange(rng, 0.12, 0.3);
      fronts.push({ kind: 'lightning', from: f.from + inset, to: f.to - inset * rngRange(rng, 0.5, 1.2), peak: Math.min(1, f.peak * rngRange(rng, 0.7, 1.1)), wind: 0, swing: 0.5, seed: Math.floor(rngFloat(rng) * 0x7fffffff) });
    } else if (f.kind === 'snow' && rngFloat(rng) < 0.35) {
      fronts.push({ kind: 'fog', from: f.from + len * 0.4, to: f.to + len * 0.15, peak: rngRange(rng, 0.3, 0.7), wind: 0, swing: 0.5, seed: Math.floor(rngFloat(rng) * 0x7fffffff) });
    }
    x = f.to + rngRange(rng, GAP[0], GAP[1]);
  }
  fronts.sort((a, b) => a.from - b.from);
  return { fronts };
}
