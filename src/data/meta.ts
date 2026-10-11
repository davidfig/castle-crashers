// What carries over from run to run (docs/21-the-road.md, step 6 and "The balance pass"; the class trees of docs/22 sit alongside). A run
// earns RENOWN (`renownFor`), kept in the profile (campaign/profile.ts), and the starting town's places spend it on lasting upgrades that
// every later run starts with. The places are the GENERAL layer of power, the same for every class: the road is balanced so that a party
// with none of it faces a very hard game (possible for a very good player, and slow), and a party that has built the town up is beatable
// with ordinary skill. The class trees add what a character can be on top of that.
export interface MetaDef {
  id: string;
  name: string;
  /** What a rank does, two short lines (the town's sign). */
  text: readonly string[];
  maxRank: number;
  /** Renown for the next rank, from rank `r` (0-based). */
  cost(r: number): number;
  /**
   * What each rank gives every hero: a multiplier on one of their stats (their own layer, applied beside the run's boons, so it never takes
   * a card out of a level-up hand: `damage` and `speed` scale by 1 + per x rank, `taken` (the damage they take) by 1 - per x rank), a
   * level to begin at (with that many level-ups to choose in the field), or gold for the purse.
   */
  gives: { stat: 'damage' | 'taken' | 'speed'; per: number } | { level: true } | { gold: number };
}

export const META: readonly MetaDef[] = [
  { id: 'armoury', name: 'ARMOURY', text: ['HEROES TAKE', '11% LESS DAMAGE'], maxRank: 4, cost: (r) => 40 + 35 * r, gives: { stat: 'taken', per: 0.11 } },
  { id: 'forge', name: 'FORGE', text: ['HEROES DEAL', '14% MORE DAMAGE'], maxRank: 5, cost: (r) => 50 + 40 * r, gives: { stat: 'damage', per: 0.14 } },
  { id: 'stables', name: 'STABLES', text: ['HEROES MOVE', '7% FASTER'], maxRank: 3, cost: (r) => 30 + 30 * r, gives: { stat: 'speed', per: 0.07 } },
  { id: 'academy', name: 'ACADEMY', text: ['HEROES BEGIN A', 'LEVEL HIGHER'], maxRank: 4, cost: (r) => 60 + 45 * r, gives: { level: true } },
  { id: 'treasury', name: 'TREASURY', text: ['THE PARTY SETS', 'OUT WITH 60 GOLD'], maxRank: 4, cost: (r) => 30 + 25 * r, gives: { gold: 60 } },
];
export const META_INDEX: Readonly<Record<string, number>> = Object.fromEntries(META.map((m, i) => [m.id, i]));

/** The multipliers the town's ranks give every hero: [damage dealt, damage taken, speed]. */
export function metaMultipliers(ranks: readonly number[]): [number, number, number] {
  const out: [number, number, number] = [1, 1, 1];
  META.forEach((m, i) => {
    if (!('stat' in m.gives)) return;
    const k = m.gives.stat === 'damage' ? 0 : m.gives.stat === 'taken' ? 1 : 2;
    out[k] += (m.gives.stat === 'taken' ? -1 : 1) * m.gives.per * (ranks[i] ?? 0);
  });
  return out;
}
/** Gold the party sets out with per Treasury rank. */
export const TREASURY_GOLD = 60;
/** What it all costs: every rank of every place. */
export const META_TOTAL = META.reduce((a, m) => { let c = 0; for (let r = 0; r < m.maxRank; r++) c += m.cost(r); return a + c; }, 0);

/**
 * The ranks a player has built after spending `renown`, buying in a sensible order: one rank of each place in turn (defence and
 * damage first), then the next rank of each. A model of a player's choices for the balance runner (`pnpm sim --renown=N`), which has
 * no player to choose; the town itself lets anyone buy anything.
 */
export function metaForRenown(renown: number): number[] {
  const ranks = META.map(() => 0);
  let left = renown;
  for (let round = 0; round < 8; round++) {
    let bought = false;
    for (let i = 0; i < META.length; i++) {
      const m = META[i];
      if (ranks[i] > round || ranks[i] >= m.maxRank) continue;
      const c = m.cost(ranks[i]);
      if (c > left) return ranks;
      left -= c; ranks[i]++; bought = true;
    }
    if (!bought) break;
  }
  return ranks;
}

/**
 * What a run earns: something for every level cleared, more for every boss slain, a little for the heads, a share for winning, and a
 * floor of 15 for any party that set out from the town, so even a run that ends on the first level moves a player on (the base game is
 * very hard, and the town is how it is won: measured in docs/21-the-road.md, "Difficulty and the town").
 */
export function renownFor(end: { cleared: number; bosses: number; kills: number; won: boolean; setOut: boolean }): number {
  return end.cleared * 4 + end.bosses * 15 + Math.floor(end.kills / 50) + (end.setOut ? 15 : 0) + (end.won ? 25 : 0);
}
