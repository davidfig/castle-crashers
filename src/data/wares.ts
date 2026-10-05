// The merchant's goods (docs/05-items-trading.md, "Sources: merchants (spend shared gold)").
//
// PLACEHOLDERS: there is no item system yet (roadmap M3), so the merchant sells the things the game can already give a
// hero: an upgrade rank, or a level. When items exist, wares become items and this file becomes the stock tables.
import { createRng, rngInt, Stream } from '../engine/rng';
import { UPGRADES, UPGRADE_INDEX } from './upgrades';

export type WareKind = 'upgrade' | 'level';

export interface WareDef {
  id: string;
  kind: WareKind;
  /** Index into UPGRADES, for an upgrade scroll. */
  upgrade?: number;
  name: string;
  text: readonly string[];
  icon: string;
  basePrice: number;
}

/** Upgrades the merchant sells as scrolls. Second Wind is an instant heal, and the camp already rests the party. */
const SCROLLS = ['heavy', 'thick', 'swift', 'windfall'];

export const WARES: readonly WareDef[] = [
  ...SCROLLS.map((id): WareDef => ({
    id: `scroll-${id}`, kind: 'upgrade', upgrade: UPGRADE_INDEX[id],
    name: `SCROLL OF ${UPGRADES[UPGRADE_INDEX[id]].name}`, text: UPGRADES[UPGRADE_INDEX[id]].text, icon: UPGRADES[UPGRADE_INDEX[id]].icon, basePrice: 60,
  })),
  { id: 'lesson', kind: 'level', name: 'VETERANS LESSON', text: ['+1 LEVEL', 'WITH A PICK TO MAKE'], icon: 'book', basePrice: 140 },
];

export interface StockItem {
  /** Index into WARES. */
  ware: number;
  price: number;
}

/** Goods are dearer deeper into a route. */
export function priceOf(def: WareDef, level: number): number {
  return Math.round(def.basePrice * (1 + 0.2 * (level + 1)));
}

/** What the merchant at the camp after `level` has for sale: the Lesson, and three different scrolls. Pure in (run seed, level). */
export function stockFor(runSeed: number, level: number): StockItem[] {
  const r = createRng((runSeed ^ Math.imul(level + 1, 0x9e3779b1)) >>> 0, Stream.story);
  const pool = WARES.map((w, i) => (w.kind === 'upgrade' ? i : -1)).filter((i) => i >= 0);
  const picks: number[] = [];
  while (picks.length < 3 && pool.length > 0) picks.push(pool.splice(rngInt(r, pool.length), 1)[0]);
  const lesson = WARES.findIndex((w) => w.kind === 'level');
  return [...picks, lesson].map((ware) => ({ ware, price: priceOf(WARES[ware], level) }));
}
