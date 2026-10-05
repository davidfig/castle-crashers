// Which enemies live in which biome, and how the mix deepens as a level goes on (docs/03-gameplay-combat.md).
// The biome is a pure function of the level seed, so the sim and the renderer agree without sharing state.
import { MobType } from './mobs';

/** One enemy in a biome's cast. Its share of the crowd grows linearly from `w0` (when it first appears) to `w1` (the end of the level). */
export interface RosterEntry {
  type: number;
  /** Level progress (0..1) at which it first shows up. Derived from its place in the list: see `spread`. */
  from: number;
  w0: number;
  w1: number;
}

/** The last enemy type arrives at this level progress, leaving the stretch up to the boss for the full cast. */
export const LAST_ARRIVAL = 0.8;

/**
 * A biome starts with a single enemy type and gains exactly one more at evenly spaced points until the whole cast is
 * out, so the list's order is the order of arrival. Each entry is [type, weight when it arrives, weight at the end].
 */
function spread(list: readonly (readonly [number, number, number])[]): RosterEntry[] {
  return list.map(([type, w0, w1], k) => ({ type, from: list.length > 1 ? (k * LAST_ARRIVAL) / (list.length - 1) : 0, w0, w1 }));
}

export interface Roster {
  /** The biome's boss: the enemy that ends the level (see `BossDef` in mobs.ts). */
  boss: number;
  /** Every ordinary enemy of the biome, easiest first. */
  entries: readonly RosterEntry[];
  /** The boss's supporting cast: [type, weight]. Bombers are added once it is enraged. */
  support: readonly (readonly [number, number])[];
  /** What the boss's war cry adds when enraged (a bomber in the Meadow). */
  enragedExtra?: { type: number; chance: number };
}

export const ROSTERS: readonly Roster[] = [
  {
    boss: MobType.Boss,
    // Meadow: the greenskin raiders. Goblins alone at first, then an orc, then archers and wolves; by the end, healers, drummers and trolls behind them.
    entries: spread([
      [MobType.Goblin, 10, 3],
      [MobType.Orc, 1.5, 3.5],
      [MobType.Archer, 1, 1.2],
      [MobType.Wolf, 1.5, 2.4],
      [MobType.Shield, 1, 1.4],
      [MobType.Bomber, 0.6, 1],
      [MobType.Slinger, 1, 1.6],
      [MobType.Shaman, 0.5, 0.8],
      [MobType.Drummer, 0.4, 0.7],
      [MobType.Troll, 0.4, 0.9],
    ]),
    support: [[MobType.Goblin, 0.62], [MobType.Shield, 0.2], [MobType.Archer, 0.18]],
    enragedExtra: { type: MobType.Bomber, chance: 0.1 },
  },
  {
    boss: MobType.DreadRegent,
    // Haunted Keep: the restless dead. Rattling skeletons alone at first, then skulls, archers, ghouls and wraiths, then the casters and the knights.
    entries: spread([
      [MobType.Skeleton, 10, 3],
      [MobType.Skull, 1.2, 1.8],
      [MobType.BoneArcher, 1, 1.5],
      [MobType.Ghoul, 1.2, 2],
      [MobType.Wraith, 0.8, 1.3],
      [MobType.BoneBrute, 0.6, 1],
      [MobType.Necromancer, 0.4, 0.75],
      [MobType.Banshee, 0.45, 0.8],
      [MobType.PlagueZombie, 0.5, 1],
      [MobType.Lich, 0.3, 0.55],
      [MobType.DreadKnight, 0.4, 0.8],
    ]),
    support: [[MobType.Skeleton, 0.62], [MobType.BoneArcher, 0.2], [MobType.Ghoul, 0.18]],
    enragedExtra: { type: MobType.Skull, chance: 0.1 },
  },
  {
    boss: MobType.RimeKing,
    // Frozen Pass: the mountain folk and what the storm sends. Trappers alone at first, then sprites, harpooners, frost wolves and rams; the
    // frost-dead, yetis and shamans behind them, and by the end whiteout spirits and the tundra guard.
    entries: spread([
      [MobType.Trapper, 10, 3],
      [MobType.SnowSprite, 1.2, 1.8],
      [MobType.Harpooner, 1, 1.5],
      [MobType.FrostWolf, 1.5, 2.4],
      [MobType.Ram, 1, 1.6],
      [MobType.IceHusk, 0.6, 1.1],
      [MobType.Yeti, 0.5, 0.9],
      [MobType.FrostShaman, 0.4, 0.75],
      [MobType.BlizzardWitch, 0.45, 0.8],
      [MobType.WhiteoutSpirit, 0.8, 1.3],
      [MobType.TundraGuard, 0.4, 0.8],
    ]),
    support: [[MobType.Trapper, 0.62], [MobType.Harpooner, 0.2], [MobType.FrostWolf, 0.18]],
    enragedExtra: { type: MobType.SnowSprite, chance: 0.1 },
  },
];

export const BIOME_COUNT = ROSTERS.length;

/**
 * The biome for a level seed: an index into both `ROSTERS` and the renderer's `BIOMES`. In dev builds `?biome=N`
 * (read once by the page into `globalThis.__biome`) forces biome N, so the enemies change along with the scenery.
 */
export function biomeIndex(seed: number): number {
  const forced = typeof __DEV__ !== 'undefined' && __DEV__ ? (globalThis as { __biome?: number }).__biome : undefined;
  if (forced !== undefined && forced >= 0 && forced < BIOME_COUNT) return forced;
  const h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  return h % BIOME_COUNT;
}

/** The weight of an entry at level progress t (0 before it first appears). */
export function entryWeight(en: RosterEntry, t: number): number {
  if (t < en.from) return 0;
  const span = 1 - en.from;
  const u = span > 0 ? Math.min(1, (t - en.from) / span) : 1;
  return en.w0 + (en.w1 - en.w0) * u;
}

/** The enemy types that can appear in a biome by progress t, in roster order. */
export function availableTypes(biome: number, t: number): number[] {
  return ROSTERS[biome].entries.filter((en) => t >= en.from).map((en) => en.type);
}
