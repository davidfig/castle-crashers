// The cookfire at the staged beat's camp (docs/12-story.md, R1). A ground decal drawn under the bystanders; no sprites needed.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W } from '../sim/constants';
import type { GameState } from '../sim/state';
import type { Sprites } from './art';
import { FIELD_Y0 } from './background';

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
