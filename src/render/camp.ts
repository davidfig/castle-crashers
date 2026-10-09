// Set dressing on the field: the cookfire at the staged beat's camp (docs/12-story.md, R1) and the store between levels (docs/07-procgen.md).
// Ground decals drawn under the creatures; no sprites needed beyond the peddler himself.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { STORE_X, STORE_Y, VIEW_H, VIEW_W } from '../sim/constants';
import type { GameState } from '../sim/state';
import type { Sprites } from './art';
import { FIELD_Y0 } from './background';
import { drawText } from './draw';
import { PLAYER_COLORS } from './art';
import { drawNpc } from './ui';

export function drawCamps(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  if (s.beatIndex < 0 || s.nextClump <= s.beatIndex) return;
  const c = s.plan[s.beatIndex];
  if (c.beat !== 'R1') return;
  const sx = Math.round(c.x - camX), sy = Math.round(FIELD_Y0 + c.y + oy);
  if (sx < -40 || sx > VIEW_W + 40) return;
  const px = (x: number, y: number, w: number, h: number, color: number, a = 1) => b.drawScaled(S.px, sx + x, sy + y, w, h, hex(color, a));
  const t = s.tick;
  // scorched ground and the glow it throws
  px(-10, -3, 20, 6, 0x1c1410, 0.45);
  px(-7, -4, 14, 8, 0x1c1410, 0.5);
  px(-16, -9, 32, 14, 0xff9a3a, 0.07 + 0.03 * ((t >> 3) & 1));
  // ring of stones
  for (const [x, y] of [[-7, -3], [-3, -4], [3, -4], [7, -3], [-6, 2], [6, 2], [0, 3]]) px(x, y, 2, 1, 0x7a7468);
  // crossed logs
  px(-5, -1, 10, 2, 0x4a3220);
  px(-3, -2, 6, 2, 0x5c3f28);
  // flame: three layers that flicker out of step
  const f1 = 4 + ((t >> 2) & 1), f2 = 6 + (((t >> 1) + 1) & 1) + ((t >> 4) & 1), f3 = 8 + ((t >> 2) & 3) % 2;
  px(-3, -1 - f1, 6, f1, 0xd8561e);
  px(-2, -1 - f2, 4, f2, 0xf0922a);
  px(-1, -1 - f3, 2, f3, 0xffd35a);
  // a thread of smoke
  const k = (t >> 2) % 12;
  px(1 + ((k >> 2) & 1), -12 - k, 1, 1, 0xcfd2d6, 0.35 * (1 - k / 12));
}

/**
 * The store between levels: a bank of mist across the field where one biome gives way to the other, and the peddler's stall standing in it
 * (the seam itself is drawn by the scenery, see `drawStoreScenery` in draw.ts).
 */
export function drawStore(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  const sx = Math.round(STORE_X - camX), sy = Math.round(FIELD_Y0 + STORE_Y + oy);
  const px = (x: number, y: number, w: number, h: number, color: number, a = 1) => b.drawScaled(S.px, x, y, w, h, hex(color, a));
  if (sx < -140 || sx > VIEW_W + 140) return;
  // mist: a soft column the full height of the view, thickest on the seam, so the two skies and two grounds meet inside it
  for (let k = -28; k < 28; k += 2) px(sx + k, 0, 2, VIEW_H, 0xdde5ee, 0.34 * (1 - Math.abs(k) / 28) * (0.85 + 0.15 * Math.sin(s.tick / 40 + k)));
  // the stall: a counter in front of him, an awning over him on two poles, crates at the side
  px(sx - 36, sy - 40, 3, 40, 0x4a3220);
  px(sx + 33, sy - 40, 3, 40, 0x4a3220);
  for (let k = 0; k < 8; k++) px(sx - 40 + k * 10, sy - 46, 10, 9, k % 2 ? 0xe8dcc0 : 0xb8402e);
  px(sx - 40, sy - 37, 80, 2, 0x000000, 0.25);
  drawNpc(b, S, 'peddler', sx, sy - 2, 1, (s.tick >> 7) % 3 === 0, s.tick);
  px(sx - 30, sy - 8, 60, 8, 0x6a4a2c);
  px(sx - 30, sy - 8, 60, 2, 0x8c6a40);
  px(sx - 30, sy - 1, 60, 1, 0x000000, 0.35);
  px(sx + 40, sy - 9, 12, 9, 0x5c3f28);
  px(sx + 40, sy - 9, 12, 2, 0x7a5636);
}

/** "U TRADE" over the peddler for each hero standing close enough to him. */
export function drawStoreHints(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number, hints: readonly string[] | undefined): void {
  if (!hints) return;
  const sx = Math.round(STORE_X - camX), sy = Math.round(FIELD_Y0 + STORE_Y + oy);
  let row = 0;
  hints.forEach((h, k) => {
    if (!h) return;
    const text = `${h} TRADE`;
    drawText(b, S, text, Math.round(sx - text.length * 2), sy - 62 - row * 9, hex(PLAYER_COLORS[k]));
    row++;
  });
  if (row === 0 && s.tick < 400) drawText(b, S, 'STORE', Math.round(sx - 10), sy - 62, hex(0xffe9a8));
}
