// Which mob type to spawn at battlefield progress t (0..1) in a biome. Shared by level gen and the director.
// The cast and its weights live in data/roster.ts: a type is absent until its `from`, then grows steadily more common.
import { rngFloat, type Rng } from '../../engine/rng';
import { entryWeight, ROSTERS } from '../../data/roster';

export function pickMobType(r: Rng, t: number, biome: number): number {
  const entries = ROSTERS[biome].entries;
  let total = 0;
  for (let k = 0; k < entries.length; k++) total += entryWeight(entries[k], t);
  let roll = rngFloat(r) * total;
  for (let k = 0; k < entries.length; k++) {
    roll -= entryWeight(entries[k], t);
    if (roll < 0) return entries[k].type;
  }
  return entries[0].type;
}

/** The boss's supporting cast: mostly small fry, with the sturdier and ranged types behind them (and a pest once enraged). */
export function pickSupport(r: Rng, enraged: boolean, biome: number): number {
  const roster = ROSTERS[biome];
  const roll = rngFloat(r);
  if (enraged && roster.enragedExtra && roll < roster.enragedExtra.chance) return roster.enragedExtra.type;
  let acc = 0;
  for (const [type, w] of roster.support) {
    acc += w;
    if (roll < acc) return type;
  }
  return roster.support[0][0];
}
