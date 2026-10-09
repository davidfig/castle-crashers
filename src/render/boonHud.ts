// What each hero has taken, as a row of boon badges under the party strip (docs/04, docs/06), and the picture that pops over a hero when
// one of their boons fires. Reads state only.
import { UPGRADES, UPGRADE_INDEX } from '../data/upgrades';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import type { GameState } from '../sim/state';
import { PLAYER_COLORS, type Sprites } from './art';
import { drawText } from './draw';
import { FIELD_Y0 } from './background';
import { POP_TICKS, type Fx } from './fx';
import { LANE_W, LANE_Y } from './levelup';
import { BOON_SIZE } from './boonIcons';

/** Boons that act once and leave nothing to show. */
const SKIP = new Set([UPGRADE_INDEX.wind]);
const GAP = 1;
const PER_ROW = 9;

/** Under the level-up pill of each hero's lane (the same quarter of the screen the level-up panel uses), a row of that hero's boons with the rank in a corner. */
export function drawBoonStrip(b: Batcher, S: Sprites, s: GameState): void {
  for (let slot = 0; slot < s.players.length; slot++) {
    const p = s.players[slot];
    if (!p.active) continue;
    const x0 = Math.round(slot * LANE_W) + 3, y = LANE_Y + 15;
    let n = 0;
    for (let i = 0; i < UPGRADES.length && n < PER_ROW; i++) {
      if (p.ranks[i] === 0 || SKIP.has(i)) continue;
      const f = S.ui.icons[UPGRADES[i].icon];
      if (!f) continue;
      const x = x0 + n * (BOON_SIZE + GAP);
      b.drawScaled(f, x, y, f.w, f.h);
      if (p.ranks[i] > 1) drawText(b, S, String(p.ranks[i]), x + BOON_SIZE - 5, y + BOON_SIZE - 6, hex(0xffffff), 1);
      n++;
    }
    if (n > 0) b.drawScaled(S.px, x0, y - 2, n * (BOON_SIZE + GAP) - GAP, 1, hex(PLAYER_COLORS[slot], 0.8)); // the hero's colour over the row
  }
}

/** The boons that just fired, rising and fading over their hero. */
export function drawBoonPops(b: Batcher, S: Sprites, fx: Fx, camX: number, oy: number): void {
  for (let i = 0; i < fx.pt.length; i++) {
    const t = fx.pt[i];
    if (t < 0) continue;
    const f = S.ui.icons[UPGRADES[fx.pboon[i]].icon];
    if (!f) continue;
    const k = t / POP_TICKS;
    const rise = Math.round(14 * (1 - (1 - k) * (1 - k)));
    const a = k < 0.15 ? k / 0.15 : k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
    const x = Math.round(fx.ppx[i] - camX - BOON_SIZE / 2);
    const y = Math.round(FIELD_Y0 + fx.ppy[i] + oy - 46 - rise);
    b.drawScaled(f, x, y, f.w, f.h, hex(0xffffff, a));
  }
}
