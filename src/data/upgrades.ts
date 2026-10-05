// Level-up upgrades and the XP curve (docs/04-classes-progression.md, docs/06-ui.md).
//
// PLACEHOLDERS: this small pool exists so the level-up flow can be built and played. The real pool is the class tree's
// unlocks plus generic perks (docs/04, roadmap M4). Offers are a pure function of (run seed, slot, level), so they are
// stable across pause, desync recovery and replays.
import { createRng, rngInt, Stream } from '../engine/rng';

export interface UpgradeDef {
  id: string;
  /** Icon name in the UI kit (render/uiArt.ts). */
  icon: string;
  /** Card text: the bitmap font is 4 px per glyph and a card is 50 px wide, so each line is at most 11 characters. */
  name: string;
  text: readonly string[];
  /** Per rank, as a fraction: damage dealt +, damage taken -, speed +, gold +. 0 where it does not apply. */
  perRank: number;
  maxRank: number;
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'heavy', icon: 'hammer', name: 'HEAVY HANDS', text: ['+15% DAMAGE'], perRank: 0.15, maxRank: 5 },
  { id: 'thick', icon: 'shield', name: 'THICK SKIN', text: ['-12% DAMAGE', 'TAKEN'], perRank: 0.12, maxRank: 4 },
  { id: 'swift', icon: 'boot', name: 'SWIFT FEET', text: ['+8% SPEED'], perRank: 0.08, maxRank: 5 },
  { id: 'windfall', icon: 'coin', name: 'WINDFALL', text: ['+25% GOLD'], perRank: 0.25, maxRank: 4 },
  { id: 'wind', icon: 'heart', name: 'SECOND WIND', text: ['HEAL FULLY', 'NOW'], perRank: 0, maxRank: 255 },
];

export const UPGRADE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(UPGRADES.map((u, i) => [u.id, i]));
export const OFFER_SIZE = 3;
export const MAX_LEVEL = 20;

/** XP the party needs to go from `level` to the next. Shared, so heroes level together. */
export function xpToNext(level: number): number {
  return 60 + 30 * (level - 1);
}

/** The three upgrades offered for `levelNumber` (the level just reached), as indexes into UPGRADES. */
export function offerFor(seed: number, slot: number, levelNumber: number, ranks?: ArrayLike<number>): number[] {
  const r = createRng((seed ^ Math.imul(slot + 1, 0x9e3779b1) ^ Math.imul(levelNumber + 1, 0x85ebca6b)) >>> 0, Stream.offer);
  const pool: number[] = [];
  for (let i = 0; i < UPGRADES.length; i++) if (!ranks || ranks[i] < UPGRADES[i].maxRank) pool.push(i);
  const out: number[] = [];
  while (out.length < OFFER_SIZE && pool.length > 0) out.push(pool.splice(rngInt(r, pool.length), 1)[0]);
  return out;
}

const rank = (ranks: ArrayLike<number>, id: string): number => ranks[UPGRADE_INDEX[id]];
export const damageMul = (ranks: ArrayLike<number>): number => 1 + UPGRADES[UPGRADE_INDEX.heavy].perRank * rank(ranks, 'heavy');
export const takenMul = (ranks: ArrayLike<number>): number => Math.max(0.4, 1 - UPGRADES[UPGRADE_INDEX.thick].perRank * rank(ranks, 'thick'));
export const speedMul = (ranks: ArrayLike<number>): number => 1 + UPGRADES[UPGRADE_INDEX.swift].perRank * rank(ranks, 'swift');
export const goldMul = (ranks: ArrayLike<number>): number => 1 + UPGRADES[UPGRADE_INDEX.windfall].perRank * rank(ranks, 'windfall');
