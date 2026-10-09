// Ability scaling (docs/04): the basic attack and the special each have four tracks a hero can raise any number of times, in any
// combination: SIZE (reach / blast), COUNT (more arcs, shots or splits), SPEED (flies faster / recovers quicker) and POWER (damage).
// Each rank makes the ability better and makes it cost more stamina, so a hero who stacks all four pays for it. The numbers live
// here; the cards (data/upgrades.ts) say what they mean for each class.
import { UPGRADE_INDEX } from '../data/upgrades';

/** 0 = the basic attack, 1 = the special (ability 2), 2 = the nova (ability 1, paid in fury: quake, rain), 3 = the dodge (paid in stamina). */
export type AbilityKind = 0 | 1 | 2 | 3;
/** 0 size, 1 count, 2 speed, 3 power. */
export type Track = 0 | 1 | 2 | 3;

export const TRACK_IDS: readonly (readonly string[])[] = [
  ['bsize', 'bcount', 'bspeed', 'bpower'],
  ['ssize', 'scount', 'sspeed', 'spower'],
  ['nsize', 'ncount', 'nspeed', 'npower'],
  ['dsize', 'dcount', 'dspeed', 'dpower'],
];
const INDEX: readonly (readonly number[])[] = TRACK_IDS.map((ids) => ids.map((id) => UPGRADE_INDEX[id]));

/** Stamina cost added per rank, as a fraction of the base cost, by track. */
export const COST_PER_RANK: readonly number[] = [0.12, 0.2, 0.08, 0.12];
/** Melee: reach +12%/rank; ranged: blast and hit radius +25%/rank. */
export const SIZE_MELEE = 0.12, SIZE_RANGED = 0.25;
/** Damage +20%/rank. */
export const POWER_PER_RANK = 0.2;
/** Melee: the swing recovers 8% quicker per rank (never under half); ranged: shots fly 20% faster per rank. */
export const QUICK_MELEE = 0.08, QUICK_RANGED = 0.2;
/** Melee: the arc opens this much wider (in dot, down to -1 = all round) per rank, and a special's wave forks into a pair of extra lanes. */
export const ARC_PER_RANK = 0.3;
export const LANE_TURN = 0.09;
/** Nova: radius (and a quake's length and width) +12% a rank, recovers 8% quicker, damage +20%; each Count rank is an echo pulse, two more quake lanes, or eight more arrows in the rain. */
export const NOVA_COST_SHARE = 0.5;
export const NOVA_SIZE = 0.12, NOVA_QUICK = 0.08, NOVA_ECHO_TICKS = 12, NOVA_ECHO_POWER = 0.6, RAIN_PER_COUNT = 8;
/** Dodge: reach (distance, blink, vanish time, plow and pulse radius) +15% a rank, recovers 10% quicker (never under 40%), the effect +25%; each Count rank is another dodge straight after the first. */
export const DODGE_REACH = 0.15, DODGE_QUICK = 0.1, DODGE_POWER = 0.25, DODGE_CHAIN_COOLDOWN = 8, DODGE_CHAIN_WINDOW = 40;

export function rankOf(ranks: ArrayLike<number>, ability: AbilityKind, track: Track): number {
  return ranks[INDEX[ability][track]];
}

/** What it costs, as a multiple of the base stamina cost, to use `ability` with these ranks. */
export function costMul(ranks: ArrayLike<number>, ability: AbilityKind): number {
  let m = 1;
  for (let t = 0; t < 4; t++) m += COST_PER_RANK[t] * ranks[INDEX[ability][t]];
  // The nova is a crowd-breaker paid in fury, which only fighting fills, so its ranks are half as dear as a stamina ability's.
  return ability === 2 ? 1 + (m - 1) * NOVA_COST_SHARE : m;
}

export const powerMul = (ranks: ArrayLike<number>, ability: AbilityKind): number => 1 + POWER_PER_RANK * rankOf(ranks, ability, 3);

/** The fury the nova takes: its base cost times the ranks' cost, but never more than a full bar (a full bar always casts the big one). */
export function novaCost(ranks: ArrayLike<number>, base: number, furyMax: number): number {
  return Math.min(furyMax, base * costMul(ranks, 2));
}
