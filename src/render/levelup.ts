// The level-up panel, drawn in the sky band at the top of the screen (docs/06-ui.md). Each player has a fixed lane,
// a quarter of the width, so up to four can choose at once without covering the action or each other. Reads state only.
import { OFFER_SIZE, offerFor, UPGRADES } from '../data/upgrades';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W } from '../sim/constants';
import type { GameState } from '../sim/state';
import { PLAYER_COLORS, type Sprites } from './art';
import { drawText } from './draw';
import { drawCard, drawIcon, drawPanel } from './ui';

const LANE_W = VIEW_W / 4;
/** Below the party strip and the boss bar, above the horizon. */
const LANE_Y = 54;
const CARD_W = 50;

export function drawLevelUp(b: Batcher, S: Sprites, s: GameState): void {
  for (let slot = 0; slot < s.players.length; slot++) {
    const p = s.players[slot];
    if (!p.active || p.pending <= 0) continue;
    const x0 = Math.round(slot * LANE_W);
    const col = PLAYER_COLORS[slot];
    if (!p.panel) {
      // a pill: nothing opens by itself
      const t = `LEVEL ${p.level}${p.pending > 1 ? ` X${p.pending}` : ''}`;
      const on = (s.tick >> 4) & 1;
      const w = t.length * 4 + 8;
      drawPanel(b, S, x0 + 3, LANE_Y, w + 10, 13, { fill: 'ink', accent: col, ornaments: false });
      drawIcon(b, S, 'star', x0 + 7, LANE_Y + 2, 1);
      drawText(b, S, t, x0 + 19, LANE_Y + 4, hex(on ? 0xffd35a : 0xffffff), 1, false);
      continue;
    }
    // the panel: three cards over a solid backing in the player's colour
    const h = 54;
    drawPanel(b, S, x0 + 1, LANE_Y - 1, LANE_W - 2, h + 2, { fill: 'ink', accent: col, ornaments: false });
    drawText(b, S, `P${slot + 1} LEVEL ${p.level - p.pending + 1}`, x0 + 6, LANE_Y + 3, hex(col), 1, false);
    const offer = offerFor(s.offerSeed, slot, p.level - p.pending + 1, p.ranks);
    for (let k = 0; k < OFFER_SIZE; k++) {
      const up = offer[k];
      if (up === undefined) continue;
      const def = UPGRADES[up];
      const cx = x0 + 3 + k * (CARD_W + 1), cy = LANE_Y + 13;
      drawCard(b, S, cx, cy, CARD_W, 38, 0, false);
      drawText(b, S, String(k + 1), cx + 4, cy + 4, hex(0xffd35a), 1, false);
      drawIcon(b, S, def.icon, cx + CARD_W - 13, cy + 3, 1);
      drawText(b, S, def.name, cx + 4, cy + 14, hex(0xffffff), 1, false);
      def.text.forEach((t, j) => drawText(b, S, t, cx + 4, cy + 22 + j * 7, hex(0xa8b4d8), 1, false));
      if (p.ranks[up] > 0) drawText(b, S, `R${p.ranks[up]}`, cx + 12, cy + 4, hex(0x93a0bc), 1, false);
    }
  }
}
