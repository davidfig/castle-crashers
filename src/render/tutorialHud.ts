// The controls tutorial's card: what to learn, which button does it on each hero's device, and a tick once they have.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W } from '../sim/constants';
import type { TutorialView } from '../campaign/tutorial';
import { PLAYER_COLORS, type Sprites } from './art';
import { drawText } from './draw';
import { drawPanel } from './ui';

const W = 360, H = 76, TOP = 28;

export function drawTutorial(b: Batcher, S: Sprites, v: TutorialView): void {
  const x = Math.round((VIEW_W - W) / 2);
  drawPanel(b, S, x, TOP, W, H, { accent: 0x3a4a6a, ornaments: false });
  const cx = (text: string, scale: number): number => Math.round(VIEW_W / 2 - (text.length * 4 * scale) / 2);
  drawText(b, S, 'LEARN THE CONTROLS', x + 10, TOP + 8, hex(0x9aa8c0));
  drawText(b, S, v.count, x + W - 10 - v.count.length * 4, TOP + 8, hex(0x9aa8c0));
  drawText(b, S, v.title, cx(v.title, 2), TOP + 20, hex(v.gap ? 0x8aff7a : 0xffd35a), 2);
  if (v.text) drawText(b, S, v.text, cx(v.text, 1), TOP + 38, hex(0xffffff));
  // One key cap per hero, lit green once they have done it.
  if (v.keys.length) {
    const cells = v.keys.map((k) => `P${k.slot + 1} ${k.label}`);
    const widths = cells.map((c) => c.length * 4 + 14);
    const total = widths.reduce((a, c) => a + c + 8, -8);
    let px = Math.round(VIEW_W / 2 - total / 2);
    v.keys.forEach((k, i) => {
      b.drawScaled(S.px, px, TOP + 50, widths[i], 14, hex(0x000000, 0.7));
      b.drawScaled(S.px, px + 1, TOP + 51, widths[i] - 2, 12, hex(k.done ? 0x2f6a3a : 0x2a3140));
      drawText(b, S, cells[i], px + 5, TOP + 54, hex(k.done ? 0xcfffd0 : PLAYER_COLORS[k.slot]));
      if (k.done) drawText(b, S, 'OK', px + widths[i] - 13, TOP + 54, hex(0x8aff7a));
      px += widths[i] + 8;
    });
  }
  // The way out, for anyone who has played before.
  const skip = `HOLD ${v.skipLabel} TO SKIP`;
  drawText(b, S, skip, x + W / 2 - skip.length * 2, TOP + H + 4, hex(0xffffff, 0.55));
  if (v.skip > 0) {
    b.drawScaled(S.px, x + W / 2 - 40, TOP + H + 14, 80, 3, hex(0x000000, 0.6));
    b.drawScaled(S.px, x + W / 2 - 40, TOP + H + 14, Math.round(80 * v.skip), 3, hex(0xffd35a));
  }
}
