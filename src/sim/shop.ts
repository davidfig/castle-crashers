// Buying from the merchant at the camp. The camp edits the sim of the level just played (as the picks do), and the carry
// then takes the result into the next level. Shared gold: anyone can spend it, on themselves.
import { MAX_LEVEL, UPGRADES } from '../data/upgrades';
import type { WareDef } from '../data/wares';
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
