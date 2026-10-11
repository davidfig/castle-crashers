// The quest-givers standing in the camp (docs/15-quests.md): what they offer after each level of the route. Where they stand and
// which one a hero is beside are in data/quests.ts (`questSpot`, `offerNear`); the sim keeps the offers and plays the quest taken (sim/quests.ts).
import { questOffers, type QuestDef } from '../data/quests';
import { levelPlan } from './route';

/** The quests offered in the camp after route level `level`, for the level that follows it. A function of the run seed. */
export function offersAfter(runSeed: number, level: number, total: number): QuestDef[] {
  const next = Math.min(level + 1, total - 1);
  const plan = levelPlan(runSeed, next, total);
  return questOffers(runSeed, { level: next, boss: plan.boss, biome: plan.biome });
}
