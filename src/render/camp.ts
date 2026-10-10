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
import { wrapLines } from './quests';
import { drawIcon, drawNpc, drawPanel } from './ui';

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
 * The store between levels: the peddler's stall, standing halfway along the road's turn between two levels
 * (the scenery under it is the road's, see `Scenery`).
 */
export function drawStore(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  const sx = Math.round(STORE_X - camX), sy = Math.round(FIELD_Y0 + STORE_Y + oy);
  const px = (x: number, y: number, w: number, h: number, color: number, a = 1) => b.drawScaled(S.px, x, y, w, h, hex(color, a));
  if (sx < -140 || sx > VIEW_W + 140) return;
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

/** One of the peddler's goods lying on the ground, for the renderer. */
export interface StoreWare {
  x: number; y: number; icon: string; name: string; price: number; sold: boolean; afford: boolean;
  /** What it does, in full, for the panel over it. */
  blurb: string;
  /** Per player slot: what buying it would do for that hero ("RANK 1 TO 2", "MAXED"). */
  standing: string[];
}
/** What the store's ground shows: the goods, the ware each hero stands beside (-1 for none), and a line over a ware just tried. */
export interface StoreView {
  wares: StoreWare[];
  near: number[];
  note?: { ware: number; text: string };
}

/** The goods on the ground with their prices beside them, a panel over the one a hero stands next to (what it is, what it does, what it
 * would do for each hero there and the button that buys it, like the quest-givers'), and a line over a ware just tried. */
export function drawStoreWares(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number, view: StoreView | undefined, hints: readonly string[] | undefined): void {
  if (!view) return;
  const t = s.tick;
  let panel = -1;
  view.wares.forEach((w, i) => {
    const sx = Math.round(w.x - camX), sy = Math.round(FIELD_Y0 + w.y + oy);
    if (sx < -40 || sx > VIEW_W + 40) return;
    const price = String(w.price);
    const priceW = (price.length + 2) * 4; // the coin and a space, then the digits
    if (w.sold) {
      drawText(b, S, 'SOLD', sx - 8, sy - 6, hex(0x8a8f99));
      return;
    }
    const nearBy = view.near.some((n) => n === i);
    if (nearBy && panel < 0) panel = i;
    // a pool of light on the ground under the ware, brighter when someone stands beside it
    b.drawScaled(S.px, sx - 12, sy - 2, 24, 4, hex(0xffe9a8, nearBy ? 0.22 : 0.1));
    const bob = Math.round(Math.sin(t / 14 + i * 1.7) * 1.5);
    const icon = S.ui.icons[w.icon];
    const scale = 2;
    if (icon) { const iw = icon.w * scale, ih = icon.h * scale; b.drawScaled(S.px, sx - iw / 2, sy + 1, iw, 2, hex(0x000000, 0.3)); b.drawScaled(icon, sx - iw / 2, sy - ih - 2 + bob, iw, ih); }
    // the price beside it, in red when the purse cannot cover it
    drawIcon(b, S, 'coin', sx - Math.round(priceW / 2), sy + 6, 1);
    drawText(b, S, price, sx - Math.round(priceW / 2) + 12, sy + 6, hex(w.afford ? 0xffd35a : 0xe2564a));
    // a second hero beside another ware gets the short form: its name and their button
    if (nearBy && panel !== i) {
      drawText(b, S, w.name, Math.round(sx - w.name.length * 2), sy - 36, 0xffffffff);
      view.near.forEach((n, k) => {
        if (n !== i) return;
        const text = `${hints?.[k] ?? ''} BUY`;
        drawText(b, S, text, Math.round(sx - text.length * 2), sy - 45, hex(PLAYER_COLORS[k]));
      });
    }
  });
  let noteY = -62;
  if (panel >= 0) {
    const w = view.wares[panel];
    const lines = wrapLines(w.blurb, 42);
    const rows = view.near.filter((n) => n === panel).length;
    const pw = 184, ph = 28 + lines.length * 8 + 4 + rows * 9;
    const cx = Math.round(w.x - camX), sy = Math.round(FIELD_Y0 + w.y + oy);
    const x = Math.max(4, Math.min(VIEW_W - pw - 4, cx - pw / 2)), y = sy - 40 - ph;
    drawPanel(b, S, x, y, pw, ph, { fill: 'ink', ornaments: false });
    drawText(b, S, w.name, x + 8, y + 7, hex(0xffe9a8));
    const price = String(w.price);
    const px = x + pw - 8 - price.length * 4;
    drawText(b, S, price, px, y + 7, hex(w.afford ? 0xffd35a : 0xe2564a));
    drawIcon(b, S, 'coin', px - 11, y + 6, 1);
    lines.forEach((ln, k) => drawText(b, S, ln, x + 8, y + 18 + k * 8, 0xffffffff));
    let row = 0;
    const base = y + 18 + lines.length * 8 + 4;
    view.near.forEach((n, k) => {
      if (n !== panel) return;
      const standing = w.standing[k] ?? '';
      const maxed = standing === 'MAXED';
      const text = maxed ? `P${k + 1} MAXED` : `${hints?.[k] ?? ''} BUY`;
      drawText(b, S, text, x + 8, base + row * 9, hex(maxed ? 0x8a8f99 : PLAYER_COLORS[k]));
      if (!maxed) drawText(b, S, standing, x + pw - 8 - standing.length * 4, base + row * 9, hex(0x9ed0ff));
      row++;
    });
    noteY = y - sy - 10;
  }
  if (view.note) {
    const w = view.wares[view.note.ware];
    if (w) drawText(b, S, view.note.text, Math.round(w.x - camX - view.note.text.length * 2), Math.round(FIELD_Y0 + w.y + oy) + noteY, hex(0xffe9a8));
  }
}

/** "STORE" over the peddler for a moment on arrival. */
export function drawStoreHints(b: Batcher, S: Sprites, s: GameState, camX: number, oy: number): void {
  const sx = Math.round(STORE_X - camX), sy = Math.round(FIELD_Y0 + STORE_Y + oy);
  if (s.tick < 400) drawText(b, S, 'STORE', Math.round(sx - 10), sy - 62, hex(0xffe9a8));
}
