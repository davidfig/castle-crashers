// The level-up panel, drawn in the sky band at the top of the screen (docs/06-ui.md). Each player has a fixed lane,
// a quarter of the width, so up to four can choose at once without covering the action or each other. Reads state only.
import { cardFor, OFFER_SIZE, rarityOf, UPGRADES } from '../data/upgrades';
import { heroOffer } from '../sim/offers';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W } from '../sim/constants';
import type { GameState } from '../sim/state';
import { PLAYER_COLORS, type Sprites } from './art';
import { drawText } from './draw';
import { TIER_BORDER, drawCard, drawIcon, drawPanel } from './ui';

export const LANE_W = VIEW_W / 4;
/** Below the party strip and the boss bar, above the horizon. */
export const LANE_Y = 46;
const CARD_W = 50;

export function drawLevelUp(b: Batcher, S: Sprites, s: GameState, keys: string[] = []): void {
  for (let slot = 0; slot < s.players.length; slot++) {
    const p = s.players[slot];
    if (!p.active || p.pending <= 0) continue;
    const x0 = Math.round(slot * LANE_W);
    const col = PLAYER_COLORS[slot];
    if (!p.panel) {
      // a pill: nothing opens by itself
      const t = `LEVEL ${p.level}${p.pending > 1 ? ` X${p.pending}` : ''}${keys[slot] ? ` - PRESS ${keys[slot]}` : ''}`;
      const on = (s.tick >> 4) & 1;
      const w = t.length * 4 + 8;
      drawPanel(b, S, x0 + 3, LANE_Y, w + 10, 13, { fill: 'ink', accent: col, ornaments: false });
      drawIcon(b, S, 'star', x0 + 7, LANE_Y + 2, 1);
      drawText(b, S, t, x0 + 19, LANE_Y + 4, hex(on ? 0xffd35a : 0xffffff), 1, false);
      continue;
    }
    // the panel: three cards over a solid backing in the player's colour
    const h = 74;
    drawPanel(b, S, x0 + 1, LANE_Y - 1, LANE_W - 2, h + 2, { fill: 'ink', accent: col, ornaments: false });
    drawText(b, S, `P${slot + 1} LEVEL ${p.level - p.pending + 1}`, x0 + 6, LANE_Y + 3, hex(col), 1, false);
    const offer = heroOffer(s, slot);
    for (let k = 0; k < OFFER_SIZE; k++) {
      const up = offer[k];
      if (up === undefined) continue;
      const def = UPGRADES[up];
      const card = cardFor(def, p.classId);
      const cx = x0 + 3 + k * (CARD_W + 1), cy = LANE_Y + 13;
      drawCard(b, S, cx, cy, CARD_W, 50, TIER_BORDER[rarityOf(def)], k === p.cursor);
      drawText(b, S, String(k + 1), cx + 4, cy + 4, hex(0xffd35a), 1, false);
      if (def.evolve) drawText(b, S, 'FUSION', cx + 4, cy + 11, hex(0xffd35a), 1, false);
      else if (p.ranks[up] > 0) drawText(b, S, `R${p.ranks[up]}`, cx + 4, cy + 11, hex(0x93a0bc), 1, false);
      drawIcon(b, S, def.icon, cx + CARD_W - 19, cy + 3, 1);
      drawText(b, S, card.name, cx + 4, cy + 21, hex(0xffffff), 1, false);
      card.text.forEach((t, j) => drawText(b, S, t, cx + 4, cy + 29 + j * 6, hex(0xa8b4d8), 1, false));
      // the tags that pull more of the same toward you (docs/04): the first two that fit
      const tags = def.tags.length > 1 && def.tags[0].length + def.tags[1].length < 11 ? `${def.tags[0]} ${def.tags[1]}` : def.tags[0];
      drawText(b, S, tags, cx + 4, cy + 43, hex(def.kind === 'trigger' ? 0xc9a4ff : 0x7d8aa8), 1, false);
    }
    // the deal can be changed: stick up for a fresh hand, stick down to banish the highlighted boon for good
    drawText(b, S, `UP: REROLL X${p.rerolls}`, x0 + 6, LANE_Y + 67, hex(p.rerolls > 0 ? 0xa8b4d8 : 0x5a6480), 1, false);
    drawText(b, S, `DOWN: BANISH X${p.banishes}`, x0 + 78, LANE_Y + 67, hex(p.banishes > 0 ? 0xa8b4d8 : 0x5a6480), 1, false);
  }
}
