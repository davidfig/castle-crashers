// The set dressing of a road scene (src/data/story/road.ts): the tents, chairs, tables and fires the cast stands among, so a scene
// reads as a small camp of its own rather than a few people loose in the field. Drawn as flat pixel shapes at 1x, scaled to the
// figures (a figure is ~28 px tall: a chair seat comes to the knee, a table to the waist, a tent stands a head above). Props are
// ordered by field y with the figures, so a hero walking behind a tent is hidden by it. Cosmetic: the sim never sees them.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import type { Sprites } from './art';
import { drawGore, GORE_KINDS } from './roadGore';

export type PropKind = 'tent' | 'pavilion' | 'banner' | 'throne' | 'chair' | 'stool' | 'table' | 'fire' | 'logseat' | 'crate' | 'barrel' | 'lantern' | 'rug'
  | 'blood' | 'body' | 'cart' | 'pot' | 'tally' | 'prints';

export interface Prop {
  kind: PropKind;
  /** Offset from the scene's centre, in field pixels (the prop's feet / base). */
  dx: number;
  dy: number;
  /** Faces left rather than right (chairs, thrones). */
  flip?: boolean;
  /** Cloth colour (tents, banners, canopies, rugs). */
  col?: number;
  /** What lies on a table: a scroll, a ledger, a map, or mugs. */
  item?: 'scroll' | 'ledger' | 'map' | 'mugs';
  /** Which of a kind (the midpoint's gore, render/roadGore.ts): a puddle's size, a body's creature. */
  variant?: number;
}

type Mood = 'court' | 'desk' | 'camp' | 'hearth' | 'aftermath';
const MOOD: Record<string, Mood> = { c1a: 'court', c1b: 'desk', c2a: 'camp', c2b: 'court', c3a: 'desk', c3b: 'hearth', c4a: 'court', c4b: 'camp', c5a: 'court', c5b: 'hearth', r5: 'aftermath' };
/** The cloth of each chapter: the Crown's red at first, fading to ash grey and mourning black by the reckoning. */
const CLOTH = [0xb8402e, 0xa05a30, 0x6a7a8a, 0x5a4a6a, 0x3a3a46];
const CLOTH_B = [0xe8dcc0, 0xd8c890, 0xc8ccd2, 0xb8aac8, 0x8a8a96];

/** The props of scene `id` (chapter `ch`): placed clear of the cast, which stands within about -34..66 px of the centre. */
export function propsFor(id: string, ch: number): Prop[] {
  const col = CLOTH[Math.min(CLOTH.length, Math.max(1, ch)) - 1];
  switch (MOOD[id] ?? 'camp') {
    case 'aftermath': return AFTERMATH;
    case 'court': return [
      { kind: 'pavilion', dx: 4, dy: -16, col },
      { kind: 'rug', dx: 4, dy: -4, col },
      { kind: 'throne', dx: -64, dy: 0, col },
      { kind: 'banner', dx: -100, dy: -6, col },
      { kind: 'banner', dx: 108, dy: -6, col },
      { kind: 'table', dx: 98, dy: 6, item: 'map' },
      { kind: 'crate', dx: 122, dy: 8 },
      { kind: 'lantern', dx: -86, dy: 12 },
      { kind: 'chair', dx: 84, dy: 22 },
    ];
    case 'desk': return [
      { kind: 'tent', dx: 52, dy: -12, col },
      { kind: 'table', dx: 0, dy: -4, item: 'ledger' },
      { kind: 'stool', dx: -34, dy: 6 },
      { kind: 'chair', dx: 36, dy: 14, flip: true },
      { kind: 'crate', dx: -52, dy: -2 },
      { kind: 'crate', dx: -62, dy: 4 },
      { kind: 'lantern', dx: -78, dy: 10 },
    ];
    case 'hearth': return [
      { kind: 'tent', dx: -58, dy: -10, col },
      { kind: 'fire', dx: 0, dy: 14 },
      { kind: 'logseat', dx: -22, dy: 18 },
      { kind: 'logseat', dx: 22, dy: 20, flip: true },
      { kind: 'barrel', dx: 52, dy: 0 },
      { kind: 'barrel', dx: 62, dy: 6 },
      { kind: 'stool', dx: 44, dy: 18 },
    ];
    default: return [
      { kind: 'tent', dx: 58, dy: -12, col },
      { kind: 'tent', dx: -64, dy: -8, col: CLOTH_B[Math.min(CLOTH_B.length, Math.max(1, ch)) - 1] },
      { kind: 'fire', dx: 0, dy: 24 },
      { kind: 'logseat', dx: -24, dy: 28 },
      { kind: 'logseat', dx: 24, dy: 30, flip: true },
      { kind: 'table', dx: 98, dy: 8, item: 'mugs' },
      { kind: 'crate', dx: 80, dy: 18 },
    ];
  }
}

/** Half-width the prop occupies on screen (for off-screen culling). */
export const PROP_REACH = 40;

/**
 * The midpoint scene's ground (data/story/midpoint.ts): puddles first (deep in the sort, so they lie under everything), then the fallen,
 * the tipped cart and the spilled supper, the hunters' tally board and banner, and the clerk's table. A lot of it, on purpose.
 */
const AFTERMATH: Prop[] = [
  { kind: 'blood', dx: -120, dy: -50, variant: 3 }, { kind: 'blood', dx: -40, dy: -48, variant: 1 }, { kind: 'blood', dx: 36, dy: -46, variant: 2 },
  { kind: 'blood', dx: 118, dy: -44, variant: 0 }, { kind: 'blood', dx: -76, dy: -36, variant: 2 }, { kind: 'blood', dx: 80, dy: -34, variant: 3 },
  { kind: 'prints', dx: -10, dy: -30 },
  { kind: 'cart', dx: -150, dy: -12 },
  { kind: 'body', dx: -112, dy: -6, col: 0x5a9a3a, variant: 0 }, { kind: 'body', dx: -88, dy: 6, col: 0x6a8a3a, variant: 1, flip: true },
  { kind: 'body', dx: -62, dy: -2, col: 0xb88a5a, variant: 2 }, { kind: 'body', dx: -52, dy: 12, col: 0x5a9a3a, variant: 0, flip: true },
  { kind: 'pot', dx: -34, dy: 20 },
  { kind: 'table', dx: 52, dy: -14, item: 'ledger' },
  { kind: 'banner', dx: 104, dy: -20, col: 0x20202a },
  { kind: 'tally', dx: 126, dy: -6 },
  { kind: 'body', dx: 100, dy: 14, col: 0x6a8a3a, variant: 1 }, { kind: 'body', dx: 134, dy: 18, col: 0xb88a5a, variant: 2, flip: true },
  { kind: 'body', dx: 8, dy: 22, col: 0x5a9a3a, variant: 0, flip: true }, { kind: 'body', dx: 160, dy: 4, col: 0x5a9a3a, variant: 0 },
  { kind: 'crate', dx: 80, dy: 24 }, { kind: 'blood', dx: 14, dy: 26, variant: 1 },
];

/** Draws a prop with its base centre at screen (sx, sy). */
export function drawProp(b: Batcher, S: Sprites, p: Prop, sx: number, sy: number, tick: number): void {
  if (GORE_KINDS.includes(p.kind)) { drawGore(b, S, p, sx, sy); return; }
  const px = (x: number, y: number, w: number, h: number, color: number, a = 1): void => b.drawScaled(S.px, sx + x, sy + y, w, h, hex(color, a));
  const dir = p.flip ? -1 : 1;
  const cloth = p.col ?? 0xb8402e;
  const dark = (c: number, f = 0.7): number => (((c >> 16 & 255) * f) << 16) | (((c >> 8 & 255) * f) << 8) | ((c & 255) * f);
  switch (p.kind) {
    case 'tent': {
      const w = 46, h = 34;
      px(-w / 2 - 2, -3, w + 4, 5, 0x000000, 0.25);
      for (let r = 0; r < h; r++) {
        const half = Math.max(1, Math.round(((r + 1) / h) * (w / 2)));
        px(-half, -h + r, half, 1, cloth);
        px(0, -h + r, half, 1, dark(cloth));
      }
      px(-1, -h - 5, 1, 6, 0x4a3220);
      px(0, -h - 5, 6, 3, 0xe8dcc0);
      px(-5, -15, 10, 15, 0x1a1030); // the door
      px(-4, -14, 4, 14, 0x2a1c20);
      px(-w / 2, -2, w, 2, 0x4a3220);
      break;
    }
    case 'pavilion': {
      const w = 76, h = 44;
      px(-w / 2 - 2, -3, w + 4, 5, 0x000000, 0.25);
      px(-w / 2, -h, 3, h, 0x4a3220);
      px(w / 2 - 3, -h, 3, h, 0x4a3220);
      px(-w / 2 + 3, -h + 8, w - 6, h - 8, 0x000000, 0.18); // the shade under the canopy
      for (let k = 0; k < 9; k++) {
        const x = -w / 2 - 2 + k * 9;
        px(x, -h - 8, 9, 10, k % 2 ? CLOTH_LIGHT : cloth);
        px(x + 1, -h + 2, 7, 3, k % 2 ? CLOTH_LIGHT : cloth);
      }
      px(-w / 2 - 2, -h + 2, w + 4, 1, 0x000000, 0.3);
      break;
    }
    case 'banner': {
      px(-1, -44, 2, 44, 0x4a3220);
      px(-1, -46, 2, 2, 0xd8b04a);
      const sway = Math.round(Math.sin(tick / 22 + p.dx) * 1);
      px(1, -42, 11 + sway, 20, cloth);
      px(1, -22, 11 + sway, 1, 0x000000, 0.3);
      px(4, -37, 5 + sway, 5, 0xd8b04a);
      px(-3, 0, 6, 2, 0x000000, 0.25);
      break;
    }
    case 'throne': {
      px(-8, -2, 16, 3, 0x000000, 0.25);
      px(-7 * dir - 1, -26, 3, 26, 0x6a4a2c);
      px(-6, -26, 12, 20, cloth);
      px(-7, -9, 14, 4, 0xd8b04a);
      px(-7, -8, 14, 8, 0x6a4a2c);
      px(-6, -8, 12, 2, cloth);
      px(-8, -28, 16, 2, 0xd8b04a);
      break;
    }
    case 'chair': {
      px(-5, -1, 10, 2, 0x000000, 0.25);
      px(-4, -9, 9, 2, 0x8c6a40); // seat
      px(-4, -8, 9, 1, 0x000000, 0.25);
      px(-4 * dir - (dir > 0 ? 0 : 1), -18, 2, 9, 0x6a4a2c); // back
      px(-4 * dir - (dir > 0 ? 0 : 1) + (dir > 0 ? 2 : -3), -17, 1, 6, 0x5c3f28);
      px(-4, -7, 1, 7, 0x5c3f28);
      px(4, -7, 1, 7, 0x5c3f28);
      break;
    }
    case 'stool': {
      px(-4, -1, 8, 2, 0x000000, 0.25);
      px(-4, -8, 8, 2, 0x8c6a40);
      px(-3, -6, 1, 6, 0x5c3f28);
      px(2, -6, 1, 6, 0x5c3f28);
      break;
    }
    case 'table': {
      const w = 30;
      px(-w / 2 - 1, -1, w + 2, 3, 0x000000, 0.25);
      px(-w / 2, -12, w, 3, 0x8c6a40);
      px(-w / 2, -9, w, 1, 0x000000, 0.3);
      px(-w / 2 + 2, -9, 2, 9, 0x5c3f28);
      px(w / 2 - 4, -9, 2, 9, 0x5c3f28);
      if (p.item === 'ledger') { px(-9, -16, 10, 4, 0x3a2418); px(-8, -17, 8, 1, 0xe8dcc0); px(6, -14, 6, 2, 0xe8dcc0); }
      else if (p.item === 'map') { px(-10, -13, 18, 1, 0xe8dcc0); px(-8, -13, 4, 1, 0x7a4a2c); px(0, -13, 5, 1, 0x4a7a4a); px(11, -17, 2, 5, 0xd8b04a); }
      else if (p.item === 'scroll') { px(-6, -15, 12, 3, 0xe8dcc0); px(-7, -15, 1, 3, 0xb89a60); px(6, -15, 1, 3, 0xb89a60); }
      else if (p.item === 'mugs') { px(-8, -16, 4, 4, 0xc8ccd2); px(-1, -16, 4, 4, 0xc8ccd2); px(7, -16, 4, 4, 0xc8ccd2); px(-8, -16, 4, 1, 0xf4ead2); px(-1, -16, 4, 1, 0xf4ead2); px(7, -16, 4, 1, 0xf4ead2); }
      break;
    }
    case 'fire': {
      px(-14, -4, 28, 8, 0xffb04a, 0.08 + 0.04 * ((tick >> 3) & 1)); // the glow on the ground
      for (const [x, y] of [[-7, -3], [-3, -4], [3, -4], [7, -3], [-6, 2], [6, 2], [0, 3]]) px(x, y, 2, 1, 0x7a7468);
      px(-5, -1, 10, 2, 0x4a3220);
      px(-3, -2, 6, 2, 0x5c3f28);
      const f1 = 4 + ((tick >> 2) & 1), f2 = 6 + (((tick >> 1) + 1) & 1) + ((tick >> 4) & 1), f3 = 8 + ((tick >> 2) & 3) % 2;
      px(-3, -1 - f1, 6, f1, 0xd8561e);
      px(-2, -1 - f2, 4, f2, 0xf0922a);
      px(-1, -1 - f3, 2, f3, 0xffd35a);
      const k = (tick >> 2) % 12;
      px(1 + ((k >> 2) & 1), -12 - k, 1, 1, 0xcfd2d6, 0.35 * (1 - k / 12));
      break;
    }
    case 'logseat': {
      px(-9, -1, 18, 2, 0x000000, 0.25);
      px(-9, -6, 18, 5, 0x5c3f28);
      px(-9, -6, 18, 2, 0x7a5636);
      px(dir > 0 ? 7 : -9, -5, 2, 3, 0xc8a070); // the cut end
      break;
    }
    case 'crate': {
      px(-6, -1, 12, 2, 0x000000, 0.25);
      px(-5, -9, 10, 9, 0x6a4a2c);
      px(-5, -9, 10, 2, 0x8c6a40);
      px(-5, -5, 10, 1, 0x3a2418);
      px(-5, -9, 1, 9, 0x3a2418);
      px(4, -9, 1, 9, 0x3a2418);
      break;
    }
    case 'barrel': {
      px(-5, -1, 10, 2, 0x000000, 0.25);
      px(-4, -12, 8, 12, 0x6a4430);
      px(-3, -13, 6, 1, 0x6a4430);
      px(-4, -9, 8, 1, 0x3a2418);
      px(-4, -3, 8, 1, 0x3a2418);
      px(-2, -12, 1, 12, 0x8a5a3a);
      break;
    }
    case 'lantern': {
      px(-2, -1, 5, 2, 0x000000, 0.25);
      px(0, -24, 2, 24, 0x4a3220);
      px(-2, -29, 6, 6, 0x3a2418);
      px(-1, -28, 4, 4, 0xffd35a, 0.75 + 0.2 * (((tick >> 3) + p.dx) & 1));
      px(-6, -32, 14, 12, 0xffd35a, 0.07);
      break;
    }
    case 'rug': {
      px(-30, -3, 60, 8, dark(cloth, 0.8), 0.9);
      px(-28, -2, 56, 6, cloth, 0.9);
      px(-30, -3, 60, 1, 0xd8b04a, 0.8);
      px(-30, 4, 60, 1, 0xd8b04a, 0.8);
      break;
    }
  }
}

const CLOTH_LIGHT = 0xe8dcc0;
