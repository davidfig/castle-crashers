// The merchant's goods (docs/05-items-trading.md, "Sources: merchants (spend shared gold)").
//
// PLACEHOLDERS: there is no item system yet (roadmap M3), so the merchant sells the things the game can already give a
// hero: an upgrade rank, or a level. When items exist, wares become items and this file becomes the stock tables.
import { createRng, rngInt, Stream } from '../engine/rng';
import { STORE_X, STORE_Y, WARE_DY, WARE_GAP } from '../sim/constants';
import { MAX_LEVEL, UPGRADES, UPGRADE_INDEX } from './upgrades';

export type WareKind = 'upgrade' | 'level';

export interface WareDef {
  id: string;
  kind: WareKind;
  /** Index into UPGRADES, for an upgrade scroll. */
  upgrade?: number;
  name: string;
  text: readonly string[];
  /** What it is and what it does, in a sentence or two, for the panel over a ware a hero stands beside (the bitmap font: no commas or apostrophes). */
  blurb: string;
  icon: string;
  basePrice: number;
}

/** Upgrades the merchant sells as scrolls. Second Wind is an instant heal, and the camp already rests the party. */
const SCROLLS = ['heavy', 'thick', 'swift', 'windfall'];

/** The opening of each scroll's blurb: what is written on it. The effect and the rank cap follow from the upgrade. */
const SCROLL_LORE: Record<string, string> = {
  heavy: 'A DRILL MASTERS NOTES ON WHERE TO STRIKE.',
  thick: 'AN OLD SHIELD BEARERS TRICKS FOR TAKING A BLOW.',
  swift: 'A COURIERS SECRETS FOR LIGHT FEET ON A LONG ROAD.',
  windfall: 'A TREASURE HUNTERS EYE FOR WHAT THE DEAD DROP.',
};

export const WARES: readonly WareDef[] = [
  ...SCROLLS.map((id): WareDef => ({
    id: `scroll-${id}`, kind: 'upgrade', upgrade: UPGRADE_INDEX[id],
    name: `SCROLL OF ${UPGRADES[UPGRADE_INDEX[id]].name}`, text: UPGRADES[UPGRADE_INDEX[id]].text, icon: UPGRADES[UPGRADE_INDEX[id]].icon, basePrice: 60,
    blurb: `${SCROLL_LORE[id]} ONE RANK OF ${UPGRADES[UPGRADE_INDEX[id]].name}: ${UPGRADES[UPGRADE_INDEX[id]].text.join(' ')} FOR THE HERO WHO BUYS IT. UP TO ${UPGRADES[UPGRADE_INDEX[id]].maxRank} RANKS.`,
  })),
  {
    id: 'lesson', kind: 'level', name: 'VETERANS LESSON', text: ['+1 LEVEL', 'WITH A PICK TO MAKE'], icon: 'book', basePrice: 140,
    blurb: 'AN OLD SOLDIER TELLS WHAT THE ROAD TAUGHT HIM. THE HERO WHO BUYS IT GAINS A LEVEL AND PICKS A NEW UPGRADE AT ONCE.',
  },
];

/** Where a hero stands with a ware, short: the rank or level it takes them from and to, or MAXED when it would do nothing (sim/shop.ts refuses). */
export function wareStanding(def: WareDef, hero: { ranks: ArrayLike<number>; level: number }): string {
  if (def.kind === 'upgrade') {
    const up = UPGRADES[def.upgrade!], r = hero.ranks[def.upgrade!];
    return r >= up.maxRank ? 'MAXED' : `RANK ${r} TO ${r + 1}`;
  }
  return hero.level >= MAX_LEVEL ? 'MAXED' : `LEVEL ${hero.level} TO ${hero.level + 1}`;
}

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

/** Where ware `i` of `n` lies on the store's ground (sim coordinates): a row centred on the peddler, in front of his stall. */
export function wareSpot(i: number, n: number): { x: number; y: number } {
  return { x: STORE_X + (i - (n - 1) / 2) * WARE_GAP, y: STORE_Y + WARE_DY };
}
