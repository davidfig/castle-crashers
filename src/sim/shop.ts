// The store: buying the peddler's goods off the ground and taking a quest from a giver, both with the trade button. Shared gold:
// anyone can spend it, on themselves. It all happens in the sim (and so is saved with it, docs/21-the-road.md).
import { offerNear } from '../data/quests';
import { MAX_LEVEL, UPGRADES } from '../data/upgrades';
import { WARE_REACH_X, WARE_REACH_Y } from './constants';
import { WARES, wareSpot, type WareDef } from '../data/wares';
import { emit, Ev } from './events';
import { Btn, type InputFrame } from './input';
import type { GameState } from './state';

export type BuyResult = 'ok' | 'broke' | 'maxed';

export function buy(s: GameState, slot: number, ware: WareDef, price: number): BuyResult {
  const p = s.players[slot];
  if (s.gold < price) return 'broke';
  if (ware.kind === 'upgrade') {
    const up = ware.upgrade!;
    if (p.ranks[up] >= UPGRADES[up].maxRank) return 'maxed';
    p.ranks[up]++;
  } else {
    if (p.level >= MAX_LEVEL) return 'maxed';
    p.level++;
    p.pending++;
    p.xp = 0;
  }
  s.gold -= price;
  return 'ok';
}

/** What the trade button did (the `a` of an `Ev.Trade`). */
export const TradeEv = { Bought: 0, Broke: 1, Maxed: 2, Taken: 3, Returned: 4 } as const;

/** The ware lying beside hero `k` (nearest first), or -1 if they are not standing by one. */
export function nearWare(s: GameState, k: number): number {
  const p = s.players[k];
  if (!p.active || p.downed) return -1;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < s.wares.length; i++) {
    const sp = wareSpot(i, s.wares.length);
    const dx = Math.abs(s.ents.x[p.ent] - sp.x), dy = Math.abs(s.ents.y[p.ent] - sp.y);
    if (dx < WARE_REACH_X && dy < WARE_REACH_Y && dx < bestD) { best = i; bestD = dx; }
  }
  return best;
}

/** The quest-giver beside hero `k`, or -1. */
export function nearOffer(s: GameState, k: number): number {
  const p = s.players[k];
  if (!p.active || p.downed) return -1;
  return offerNear(s.offers, s.ents.x[p.ent], s.ents.y[p.ent]);
}

/**
 * The trade button, pressed beside a giver, takes their quest (or gives it back); beside a ware, buys it if the purse covers it.
 * Runs at the start of a store tick, before the heroes move, so a button that chose a level-up card (the panel was open) is not also a trade.
 */
export function updateTrade(s: GameState, inputs: readonly InputFrame[]): void {
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active || p.panel || !(inputs[k].buttons & ~p.rawPrev & Btn.Interact)) continue;
    const x = s.ents.x[p.ent], y = s.ents.y[p.ent];
    const q = nearOffer(s, k);
    if (q >= 0) {
      s.questTaken = s.questTaken === q ? -1 : q;
      emit(s.events, Ev.Trade, x, y, s.questTaken === q ? TradeEv.Taken : TradeEv.Returned, q, k);
      continue;
    }
    const i = nearWare(s, k);
    if (i < 0 || s.wares[i].sold) continue;
    const res = buy(s, k, WARES[s.wares[i].ware], s.wares[i].price);
    if (res === 'ok') s.wares[i].sold = true;
    emit(s.events, Ev.Trade, x, y, res === 'ok' ? TradeEv.Bought : res === 'broke' ? TradeEv.Broke : TradeEv.Maxed, i, k);
  }
}
