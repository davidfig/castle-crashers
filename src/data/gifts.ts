// A wayfarer's gift at each camp on the road (docs/21-the-road.md, step 5: choices for the characters): two boons on pedestals, and each
// hero may take ONE of them, a choice of their own (the other heroes choose for themselves, the same one or the other). Only boons any class
// can use, already in the ordinary pool, and not the legendary ones: a gift is a nudge, not a windfall.
import { createRng, rngInt, Stream } from '../engine/rng';
import { rarityOf, UPGRADES } from './upgrades';

/** The boons a gift may be: for every class, always in the pool, no fusions, not legendary, not only for a party. */
export const GIFT_POOL: readonly number[] = UPGRADES.map((u, i) => (u.classes || u.unlock || u.evolve || u.needsParty || rarityOf(u) >= 2 ? -1 : i)).filter((i) => i >= 0);

/** The two boons at the camp after road level `level`: different, and a function of the run seed alone. */
export function giftsFor(runSeed: number, level: number): number[] {
  const r = createRng((runSeed ^ Math.imul(level + 3, 0x632be5ab)) >>> 0, Stream.loot + 21);
  const pool = GIFT_POOL.slice();
  const out: number[] = [];
  while (out.length < 2 && pool.length > 0) out.push(pool.splice(rngInt(r, pool.length), 1)[0]);
  return out;
}

/** Where gift `i` stands, in a camp's own coordinates: on the near side of the road, below the quest-givers (who stand along the far side) and before the peddler's goods. */
export function giftSpot(i: number): { x: number; y: number } {
  return { x: 520 + i * 120, y: 190 };
}
