// A run is one straight road: a few levels in one biome, then the next biome, and so on to the last boss (docs/07-procgen.md, "The route").
// Between two levels the party walks through a store (the end of the field it just won), and out of it into the next level. There is
// no choice of road, no board and no menu between levels. Pure; the sim only ever sees one level's seed.
import { BIOME_COUNT, biomeIndex } from '../data/roster';

/** Levels played in one biome before the road moves on; the last of them ends in the biome's boss. */
export const LEVELS_PER_BIOME = 3;
/** Levels in a whole campaign route. */
export const ROUTE_LEVELS = BIOME_COUNT * LEVELS_PER_BIOME;
/** Each further level of a biome has this much more horde in it. */
const SCALE_PER_LEVEL = 0.15;
const MAX_TRIES = 64;

export interface LevelPlan {
  seed: number;
  /** The last level of each biome (and of any shorter dev route) ends in a boss. */
  boss: boolean;
  biome: number;
  /** Enemy count multiplier: the second and third level of a biome are bigger than the first. */
  scale: number;
  /** The story's chapter wording for the barks: one per biome. */
  chapter: number;
}

/** Which biome the road is in at `level`. */
export function stageBiome(level: number): number {
  return Math.floor(level / LEVELS_PER_BIOME) % BIOME_COUNT;
}

/** The first level uses the run's own seed; later ones are derived, so a route is a function of its seed alone. */
export function levelSeed(runSeed: number, level: number): number {
  return level === 0 ? runSeed >>> 0 : Math.imul((runSeed ^ 0x9e3779b9) >>> 0, Math.imul(level, 0x85ebca6b) + 1) >>> 0;
}

/** The level's seed, nudged until the seed's biome is the one the road is in (the biome is a function of the seed). A one-level dev run keeps its seed. */
export function levelPlan(runSeed: number, level: number, total: number): LevelPlan {
  const base = levelSeed(runSeed, level);
  let seed = base;
  if (total > 1) {
    const want = stageBiome(level);
    for (let a = 1; a <= MAX_TRIES && biomeIndex(seed) !== want; a++) seed = Math.imul((base ^ Math.imul(a, 0xc2b2ae35)) >>> 0, 0x27d4eb2f) >>> 0;
  }
  const inBiome = level % LEVELS_PER_BIOME;
  return {
    seed,
    boss: level === total - 1 || inBiome === LEVELS_PER_BIOME - 1,
    biome: biomeIndex(seed),
    scale: total > 1 ? 1 + SCALE_PER_LEVEL * inBiome : 1,
    chapter: stageBiome(level) + 1,
  };
}

/** Where a level sits in its biome's weather: the weather runs across all of a biome's levels, so it is drawn from a slice of one shared span. */
export interface WeatherSpan {
  /** One seed for the whole biome, so the weather's surges carry across its levels. */
  seed: number;
  /** This level's slice of the biome's progress, 0..1. */
  from: number;
  to: number;
  /** Levels in the biome. */
  levels: number;
}

/** The weather span of `level` in a route of `total` levels (a one-level dev run is its own whole span). */
export function weatherSpan(runSeed: number, level: number, total: number): WeatherSpan {
  const first = total > 1 ? level - (level % LEVELS_PER_BIOME) : 0;
  const levels = total > 1 ? Math.min(LEVELS_PER_BIOME, total - first) : 1;
  const at = level - first;
  return { seed: (levelSeed(runSeed, first) ^ 0x57ea7e) >>> 0, from: at / levels, to: (at + 1) / levels, levels };
}
