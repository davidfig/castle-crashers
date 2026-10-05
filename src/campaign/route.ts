// A run is a route of several levels with a camp between them (docs/07-procgen.md, "The camp"). This is the route's shape:
// which level comes next, and the doors the party chooses between at each camp. Pure; the sim only ever sees one level's seed.
import { BIOMES } from '../data/biomes';
import { BIOME_COUNT, biomeIndex } from '../data/roster';

/** Levels in a campaign route. The prototype is two levels with one crossroads between them. */
export const ROUTE_LEVELS = 2;

export interface LevelPlan {
  seed: number;
  /** Only the last level of a route ends in a boss. */
  boss: boolean;
  biome: number;
}

export interface Door {
  seed: number;
  biome: number;
  label: string;
  tag: string;
}

const DOOR_TAGS = ['THE ROAD', 'A DETOUR'];
const MAX_TRIES = 32;

/** The first level uses the Writ's own seed; later ones are derived, so a route is a function of its Writ and its choices. */
export function levelSeed(runSeed: number, level: number): number {
  return level === 0 ? runSeed >>> 0 : Math.imul((runSeed ^ 0x9e3779b9) >>> 0, Math.imul(level, 0x85ebca6b) + 1) >>> 0;
}

export function levelPlan(seed: number, level: number, total: number): LevelPlan {
  return { seed: seed >>> 0, boss: level === total - 1, biome: biomeIndex(seed) };
}

/** The doors at the camp after `level`: two roads, into different biomes where there are several. */
export function doorsAfter(runSeed: number, level: number, total: number): Door[] {
  void total;
  const out: Door[] = [];
  for (let a = 0; a < MAX_TRIES && out.length < DOOR_TAGS.length; a++) {
    const seed = Math.imul((levelSeed(runSeed, level) ^ Math.imul(a + 1, 0xc2b2ae35)) >>> 0, 0x27d4eb2f) >>> 0;
    const biome = biomeIndex(seed);
    if (BIOME_COUNT > 1 && out.some((d) => d.biome === biome) && a < MAX_TRIES - 1) continue;
    out.push({ seed, biome, label: (BIOMES[biome]?.name ?? 'THE ROAD').toUpperCase(), tag: DOOR_TAGS[out.length] });
  }
  return out;
}
