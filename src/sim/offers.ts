// The level-up hand a hero is looking at: one place, so the sim (choosing), the panel (drawing) and the tests all deal the same cards.
import { offerFor } from '../data/upgrades';
import { activePlayers } from './gen/level';
import type { GameState } from './state';

/** The cards (indexes into UPGRADES) in front of hero `slot`: a function of the run seed, the pick's level, the hero's build, the rerolls spent on it and what has been banished. */
export function heroOffer(s: GameState, slot: number): number[] {
  const p = s.players[slot];
  return offerFor(s.offerSeed, slot, p.level - p.pending + 1, p.ranks, p.classId, { party: activePlayers(s), salt: p.salt, banned: p.banned });
}
