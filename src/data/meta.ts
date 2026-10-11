// What carries over from run to run (docs/21-the-road.md, step 6; the fuller design is docs/04, "Meta progression"). A run earns RENOWN
// (`renownFor`), kept in the profile (campaign/profile.ts), and the starting town's places spend it on lasting upgrades that every later
// run starts with. A first two, to prove the loop: the Armoury (every hero sets out thicker-skinned) and the Treasury (the party sets out
// with gold).
import { UPGRADE_INDEX } from './upgrades';

export interface MetaDef {
  id: string;
  name: string;
  /** What a rank does, two short lines (the town's sign). */
  text: readonly string[];
  maxRank: number;
  /** Renown for the next rank, from rank `r` (0-based). */
  cost(r: number): number;
}

export const META: readonly MetaDef[] = [
  { id: 'armoury', name: 'ARMOURY', text: ['EVERY HERO SETS', 'OUT THICK SKINNED'], maxRank: 2, cost: (r) => 40 + 60 * r },
  { id: 'treasury', name: 'TREASURY', text: ['THE PARTY SETS', 'OUT WITH 60 GOLD'], maxRank: 3, cost: (r) => 30 + 40 * r },
];
export const META_INDEX: Readonly<Record<string, number>> = Object.fromEntries(META.map((m, i) => [m.id, i]));

/** The upgrade each Armoury rank gives every hero (a rank of Thick Skin). */
export const ARMOURY_UPGRADE = UPGRADE_INDEX.thick;
/** Gold the party sets out with per Treasury rank. */
export const TREASURY_GOLD = 60;

/** What a run earns: something for every level cleared, more for every boss slain, a little for the heads, and a share for winning. */
export function renownFor(end: { cleared: number; bosses: number; kills: number; won: boolean }): number {
  return end.cleared * 4 + end.bosses * 15 + Math.floor(end.kills / 150) + (end.won ? 25 : 0);
}
