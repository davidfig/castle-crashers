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
/** Which stretch of a biome's cast (data/roster.ts: the order enemies arrive in) each of its levels draws from. They overlap, so the new faces of one level are the old ones of the next. */
const MIX: readonly (readonly [number, number])[] = [[0, 0.5], [0.25, 0.75], [0.5, 1]];
/** Later biomes open further into their cast: the road has already been hard by then, so its first level is not the same easy opening as the Meadow's. */
const MIX_PER_BIOME = 0.12;
function mixFor(inBiome: number, biome: number): readonly [number, number] {
  const [lo, hi] = MIX[inBiome] ?? [0, 1];
  return [Math.min(0.35 + 0.1 * inBiome, lo + MIX_PER_BIOME * biome), Math.min(1, hi + (inBiome === LEVELS_PER_BIOME - 1 ? 0 : MIX_PER_BIOME * biome))];
}
/** A biome that plays easy for its place on the road gets a bump (found with `npm run sim -- --curve`). Index = biome. */
const BIOME_BUMP: readonly { scale: number; damage: number }[] = [
  { scale: 1, damage: 1 }, { scale: 1, damage: 1 }, { scale: 1.2, damage: 1.15 }, { scale: 1, damage: 1 }, { scale: 1, damage: 1 },
];
/**
 * The road as a whole ramps up: a hero's build grows faster than the horde does inside one biome, so each level's horde is also multiplied
 * by how far down the road it sits. Level 0 starts gentler than a bare level and the last reaches `DEPTH_END` times it.
 */
export const DEPTH_START = 0.55;
export const DEPTH_END = 2.2;
/** Damage enemies deal, ramped the same way: a hero's armour and health grow along the road too. */
export const DAMAGE_START = 0.8;
export const DAMAGE_END = 2.3;
export function depthDamage(level: number, total: number): number {
  if (total <= 1) return 1;
  return DAMAGE_START + (DAMAGE_END - DAMAGE_START) * Math.min(1, level / (total - 1));
}
export function depthScale(level: number, total: number): number {
  if (total <= 1) return 1;
  const t = Math.min(1, level / (total - 1));
  return DEPTH_START + (DEPTH_END - DEPTH_START) * t;
}

export interface LevelPlan {
  seed: number;
  /** The last level of each biome (and of any shorter dev route) ends in a boss. */
  boss: boolean;
  biome: number;
  /** Enemy count multiplier: the second and third level of a biome are bigger than the first. */
  scale: number;
  /** The slice of the biome's cast this level draws from: the levels of a biome run on from one another, not each from the start. */
  mix: readonly [number, number];
  /** Multiplier on the damage enemies deal this level (the road ramps up). */
  damage: number;
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
    scale: total > 1 ? (1 + SCALE_PER_LEVEL * inBiome) * depthScale(level, total) * BIOME_BUMP[biomeIndex(seed)].scale : 1,
    damage: total > 1 ? depthDamage(level, total) * BIOME_BUMP[biomeIndex(seed)].damage : 1,
    mix: total > 1 ? mixFor(inBiome, stageBiome(level)) : [0, 1],
    chapter: stageBiome(level) + 1,
  };
}
