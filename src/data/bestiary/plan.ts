// What each enemy slot is *for*. The hand-made roster fixes, for every MobType index, where it sits in its biome (how early it shows up,
// whether it is cheap crowd or a rare heavy) and what it was worth in numbers. A generated monster takes over a slot and keeps that job:
// slot 0 of a biome is always its plain first enemy, the last slots are its heaviest, and the boss slot is its boss. Everything else is up for grabs.
import { Behavior, CLASSIC_MOBS, MobType, type MobDef } from '../mobs';
import { ROSTERS } from '../roster';

export interface SlotPlan {
  slot: number;
  biome: number;
  /** Position in the biome's order of arrival, and the roster's length. */
  k: number;
  n: number;
  /** 0 (first enemy) .. 1 (last ordinary enemy). */
  u: number;
  /** The biome's plain first enemy: no powers at all. */
  fodder: boolean;
  /** Crowd filler: it fills the boss's retinue, so it stays simple and light. */
  cheap: boolean;
  /** A tiny, frail, quick pest (the hand-made sprites, skulls and scarabs). */
  tiny: boolean;
  bomber: boolean;
  /** The hand-made enemy that held this slot: its numbers are this slot's budget. */
  classic: MobDef;
}

export interface BiomePlan {
  biome: number;
  /** What summoners raise and brutes burst into: the biome's plain first enemy. */
  swarm: number;
  boss: number;
  bossClassic: MobDef;
  entries: SlotPlan[];
}

function build(): BiomePlan[] {
  return ROSTERS.map((r, biome) => {
    const cheapTypes = new Set<number>([...r.support.map(([t]) => t), ...(r.enragedExtra ? [r.enragedExtra.type] : []), r.entries[0].type]);
    const n = r.entries.length;
    const entries = r.entries.map((en, k): SlotPlan => {
      const classic = CLASSIC_MOBS[en.type];
      return {
        slot: en.type, biome, k, n, u: n > 1 ? k / (n - 1) : 0,
        fodder: k === 0, cheap: cheapTypes.has(en.type), bomber: en.type === MobType.Bomber,
        tiny: classic.behavior === Behavior.Melee && classic.hp <= 4, classic,
      };
    });
    return { biome, swarm: r.entries[0].type, boss: r.boss, bossClassic: CLASSIC_MOBS[r.boss], entries };
  });
}

let cached: BiomePlan[] | undefined;
/** The plan for every biome (ROSTERS order). Built on first use, from the roster and the hand-made numbers. */
export function slotPlans(): readonly BiomePlan[] {
  return (cached ??= build());
}
