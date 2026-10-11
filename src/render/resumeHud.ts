// The hold over a continued run (docs/21-the-road.md): the field stands frozen while players take up the saved heroes (or open slots),
// and the run goes on when one of them presses attack. Whoever takes a slot plays it; a saved hero nobody takes leaves the run.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W } from '../sim/constants';
import { PLAYER_COLORS, type Sprites } from './art';
import { drawText } from './draw';
import { drawPanel } from './ui';

export interface ResumeView {
  /** Where the run was ("LEVEL 3 OF 15"). */
  where: string;
  /** Per slot: the saved hero's label (or '' for an empty slot), and whether a player has taken it. */
  slots: { hero: string; taken: boolean }[];
  /** Somebody has taken a slot, so attack starts. */
  canStart: boolean;
}

const W = 380, H = 96, TOP = 40;

export function drawResumeHold(b: Batcher, S: Sprites, v: ResumeView): void {
  const x = Math.round((VIEW_W - W) / 2);
  drawPanel(b, S, x, TOP, W, H, { accent: 0x5a4a2a, ornaments: false });
  const cx = (text: string, scale: number): number => Math.round(VIEW_W / 2 - (text.length * 4 * scale) / 2);
  drawText(b, S, 'SAVED RUN', x + 10, TOP + 8, hex(0x9aa8c0));
  drawText(b, S, v.where, x + W - 10 - v.where.length * 4, TOP + 8, hex(0x9aa8c0));
  const title = 'PRESS A BUTTON TO TAKE A HERO';
  drawText(b, S, title, cx(title, 1), TOP + 22, hex(0xffd35a));
  const cw = 86, gap = 6, total = v.slots.length * cw + (v.slots.length - 1) * gap;
  let px = Math.round(VIEW_W / 2 - total / 2);
  v.slots.forEach((sl, k) => {
    b.drawScaled(S.px, px, TOP + 36, cw, 30, hex(0x000000, 0.7));
    b.drawScaled(S.px, px + 1, TOP + 37, cw - 2, 28, hex(sl.taken ? 0x2f4a3a : 0x2a3140));
    drawText(b, S, `P${k + 1}`, px + 5, TOP + 41, hex(PLAYER_COLORS[k]));
    drawText(b, S, sl.hero || 'OPEN', px + 5, TOP + 53, hex(sl.hero ? 0xffffff : 0x7a8496));
    drawText(b, S, sl.taken ? 'IN' : sl.hero ? 'LEAVES' : '', px + cw - 5 - (sl.taken ? 8 : 24), TOP + 41, hex(sl.taken ? 0x8aff7a : 0xd08a6a));
    px += cw + gap;
  });
  const foot = v.canStart ? 'ATTACK TO PLAY' : 'NOBODY HAS TAKEN A HERO YET';
  drawText(b, S, foot, cx(foot, 1), TOP + 76, hex(v.canStart ? 0xffffff : 0x9aa8c0));
}
