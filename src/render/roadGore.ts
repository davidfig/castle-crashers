// The set dressing of the midpoint scene (data/story/midpoint.ts): a settlement the Crown's other hunters have been through. Flat 1x pixel
// shapes like the rest of the road props, in the cartoon style: bright, blunt, and a great deal of it. Cosmetic: the sim never sees it.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import type { Sprites } from './art';
import type { Prop, PropKind } from './roadProps';

export const GORE_KINDS: readonly PropKind[] = ['blood', 'body', 'cart', 'pot', 'tally', 'prints'];

const RED = 0xa01828, RED_DARK = 0x6e0f1c, RED_LIGHT = 0xc8283c;

/** A small deterministic hash for scatter that must not move between frames. */
function h(n: number): number {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  return (n ^ (n >>> 13)) >>> 0;
}

/** Draws a gore prop with its base centre at screen (sx, sy). */
export function drawGore(b: Batcher, S: Sprites, p: Prop, sx: number, sy: number): void {
  const px = (x: number, y: number, w: number, hh: number, color: number, a = 1): void => b.drawScaled(S.px, sx + x, sy + y, w, hh, hex(color, a));
  const dir = p.flip ? -1 : 1;
  const v = p.variant ?? 0;
  switch (p.kind) {
    case 'blood': {
      // a puddle (rows of an ellipse), a bright rim on its top edge and drops thrown around it
      const w = 22 + (v % 4) * 8;
      for (let r = -3; r <= 3; r++) {
        const half = Math.round((w / 2) * Math.sqrt(1 - (r * r) / 13));
        px(-half, r, half * 2, 1, r === 3 ? RED_DARK : RED);
        if (r === -2 && half > 4) px(-half + 3, r, Math.min(7, half), 1, RED_LIGHT);
      }
      for (let i = 0; i < 6; i++) {
        const hh = h(v * 31 + i);
        px((hh % (w + 20)) - (w + 20) / 2, ((hh >> 8) % 11) - 5, 1 + (hh >> 16) % 2, 1, i % 2 ? RED : RED_DARK);
      }
      break;
    }
    case 'body': {
      // a creature lying on its side: fur colour in `col`, `v` 0 a goblin, 1 a big orc, 2 a kit; x for eyes, a pool under it
      const c = p.col ?? 0x5a9a3a;
      const k = v === 1 ? 1.4 : v === 2 ? 0.7 : 1;
      const bw = Math.round(22 * k), bh = Math.round(9 * k), hd = Math.round(9 * k);
      const dark = (((c >> 16 & 255) * 0.7) << 16) | (((c >> 8 & 255) * 0.7) << 8) | ((c & 255) * 0.7);
      px(-bw / 2 - 5, -3, bw + 14, 6, RED, 0.9);
      px(-bw / 2, -3, bw + 4, 1, RED_LIGHT, 0.8);
      px(-bw / 2, -bh, bw, bh, c);
      px(-bw / 2, -2, bw, 2, dark);
      px(-bw / 2 + 3, -bh + 2, bw - 6, 3, 0xe8dcc0, 0.35); // the belly
      px(-bw / 2 + 4, -bh + 3, 4, 3, RED_DARK); // a wound
      px(dir > 0 ? bw / 2 - 1 : -bw / 2 - hd + 1, -bh - 1, hd, hd, c); // the head
      const hx = dir > 0 ? bw / 2 - 1 : -bw / 2 - hd + 1;
      px(hx + 1, -bh - 2, 2, 2, c); px(hx + hd - 3, -bh - 2, 2, 2, c); // ears
      px(hx + 2, -bh + 2, 2, 2, 0x000000); px(hx + 3, -bh + 1, 1, 1, 0x000000); px(hx + 1, -bh + 1, 1, 1, 0x000000); // an x for an eye
      px(hx + hd - 4, -bh + 2, 2, 2, 0x000000); px(hx + hd - 3, -bh + 1, 1, 1, 0x000000); px(hx + hd - 5, -bh + 1, 1, 1, 0x000000);
      px(hx + 3, -bh + 5, hd - 5, 1, 0x000000); // a flat mouth
      px(dir > 0 ? hx + hd - 3 : hx + 1, -bh + 6, 2, 2, 0xe0707a); // the tongue
      px(-bw / 2 + 2, 0, 3, 3, dark); px(bw / 2 - 5, 0, 3, 3, dark); // feet in the air
      px(-bw / 2 - 2, -bh + 2, 3, 2, c); px(bw / 2 - 1, -bh + 3, 3, 2, c); // arms flung out
      break;
    }
    case 'cart': {
      // a wagon tipped on its side, one wheel in the air, its goods in the dirt
      px(-22, -2, 48, 4, 0x000000, 0.25);
      px(-18, -14, 38, 13, 0x6a4a2c);
      px(-18, -14, 38, 2, 0x8c6a40);
      px(-16, -12, 34, 9, 0x2a1c20); // the open side
      for (let i = 0; i < 4; i++) px(-14 + i * 9, -12, 1, 9, 0x6a4a2c);
      px(-26, -6, 9, 2, 0x4a3220); // the shaft
      const wx = 24, wy = -12;
      for (let r = -6; r <= 6; r++) { const half = Math.round(Math.sqrt(36 - r * r)); px(wx - half, wy + r, 2, 1, 0x3a2418); px(wx + half - 2, wy + r, 2, 1, 0x3a2418); }
      px(wx - 6, wy - 1, 12, 2, 0x5c3f28); px(wx - 1, wy - 6, 2, 12, 0x5c3f28);
      px(-6, 1, 4, 4, 0xb89a60); px(2, 3, 5, 3, 0xd8c890); px(10, 1, 3, 3, 0xd8561e); // spilled sacks and an orange
      px(-12, -4, 18, 3, RED, 0.9);
      break;
    }
    case 'pot': {
      // a cooking pot kicked over, the stew in a puddle with a carrot in it
      px(-12, -1, 26, 5, 0x000000, 0.2);
      px(-8, 0, 20, 4, 0xa8682c, 0.9);
      px(-4, 0, 4, 2, 0xd8561e); px(4, 1, 3, 2, 0x6a8a3a);
      px(-14, -8, 10, 8, 0x3a3a46);
      px(-14, -8, 10, 2, 0x5a5a66);
      px(-15, -9, 12, 1, 0x1a1030);
      px(-5, -6, 2, 5, 0x5a5a66);
      px(2, -3, 7, 2, RED, 0.9);
      break;
    }
    case 'tally': {
      // the hunters' tally board: chalk strokes in fives, a crooked red header
      px(-3, -1, 7, 2, 0x000000, 0.25);
      px(-1, -34, 3, 34, 0x4a3220);
      px(-14, -36, 30, 20, 0x6a4a2c);
      px(-13, -35, 28, 18, 0x2a2a30);
      px(-13, -35, 28, 4, RED);
      for (let g = 0; g < 3; g++) for (let i = 0; i < 4; i++) px(-11 + g * 9 + i * 2, -29, 1, 6, 0xf4ead2);
      for (let g = 0; g < 3; g++) px(-12 + g * 9, -27, 8, 1, 0xf4ead2);
      for (let g = 0; g < 2; g++) for (let i = 0; i < 4; i++) px(-11 + g * 9 + i * 2, -22, 1, 5, 0xf4ead2);
      px(8, -20, 1, 4, 0xf4ead2); px(10, -20, 1, 4, 0xf4ead2);
      px(-4, -18, 10, 2, 0xe8dcc0, 0.8); // a hanging note
      break;
    }
    case 'prints': {
      // red footprints heading away, left then right, the way the hunters went
      for (let i = 0; i < 7; i++) {
        const x = -30 + i * 9 * dir, y = (i % 2 ? 2 : -2);
        px(x, y, 3, 2, i % 3 ? RED : RED_DARK, 1 - i * 0.1);
        px(x + 1, y + 2, 1, 1, RED_DARK, 1 - i * 0.1);
      }
      break;
    }
  }
}
