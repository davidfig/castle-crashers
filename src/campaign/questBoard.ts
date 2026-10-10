// The quest-givers standing in the camp (docs/15-quests.md): who is offering what, where they stand, and which one a hero is beside.
// The party takes at most one quest, for the level the camp leads into; the sim plays it (sim/quests.ts).
import { questOffers, type QuestDef } from '../data/quests';
import { levelPlan } from './route';

/** Where the givers stand in the store (sim coordinates): in a row between where the party arrives and the peddler's stall. */
export const QUEST_X0 = 430;
export const QUEST_GAP = 100;
export const QUEST_Y = 62;
/** A hero this close (px along the field and across it) to a giver can talk to them. */
export const QUEST_REACH_X = 26;
export const QUEST_REACH_Y = 24;

export function questSpot(i: number): { x: number; y: number } {
  return { x: QUEST_X0 + i * QUEST_GAP, y: QUEST_Y + (i % 2) * 16 };
}

/** The quests offered in the camp after route level `level`, for the level that follows it. A function of the run seed. */
export function offersAfter(runSeed: number, level: number, total: number): QuestDef[] {
  const next = Math.min(level + 1, total - 1);
  const plan = levelPlan(runSeed, next, total);
  return questOffers(runSeed, { level: next, boss: plan.boss, biome: plan.biome });
}

/** The offer a hero at (x, y) can talk to (the nearest along the field), or -1. */
export function offerNear(offers: readonly QuestDef[], x: number, y: number): number {
  let best = -1, bestD = Infinity;
  offers.forEach((_, i) => {
    const sp = questSpot(i);
    const dx = Math.abs(x - sp.x), dy = Math.abs(y - sp.y);
    if (dx < QUEST_REACH_X && dy < QUEST_REACH_Y && dx < bestD) { best = i; bestD = dx; }
  });
  return best;
}
