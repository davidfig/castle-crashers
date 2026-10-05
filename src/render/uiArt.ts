// The UI kit's sprites (docs/13-ui-art.md): the story font, panel corner flourishes, a cursor, a star, a divider and the 9x9
// icons. Procedural, defined as text bitmaps like the rest of the placeholder art and packed into the atlas at startup, so
// they can be replaced by drawn art without touching a screen: screens only call the helpers in ui.ts.
// Colours are the "Glass" palette (art/palette.mjs): lead outline, gold leaf, vellum, lapis, crimson.
import type { Frame } from '../platform/gl/batcher';
import { GLYPH_H, STORY_GLYPHS } from '../data/storyFont';

type Pix = { w: number; h: number; rgba: Uint8ClampedArray };
type Add = (b: Pix) => Frame;

export const GLASS = {
  lead: 0x1a1030, ink: 0x1d1538,
  g: 0xa8791f, G: 0xefbd44, Y: 0xfff0a0,
  w: 0xcfc09f, W: 0xf4ead2,
  a: 0x232f78, b: 0x3b57b8, c: 0x7f9ee8,
  r: 0x7a1a35, R: 0xc23458, q: 0xec7a8c,
  n: 0x2c7554, m: 0x5fb88a,
  z: 0x4a526e, Z: 0x8f98b8, X: 0xd4daf0,
  o: 0x5a2e1e, O: 0x8a4a2e, t: 0xb9744a,
} as const;

const PAL: Record<string, number> = { ...GLASS };

function bitmap(rows: readonly string[], pal: Record<string, number> = PAL): Pix {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '.';
      const c = pal[ch];
      if (ch === '.' || c === undefined) continue;
      const o = (y * w + x) * 4;
      rgba[o] = (c >> 16) & 255; rgba[o + 1] = (c >> 8) & 255; rgba[o + 2] = c & 255; rgba[o + 3] = 255;
    }
  }
  return { w, h, rgba };
}

const mirrorX = (rows: readonly string[]): string[] => rows.map((r) => [...r].reverse().join(''));
const mirrorY = (rows: readonly string[]): string[] => [...rows].reverse();

/** A gold-leaf corner flourish, top-left; the other three are its mirrors. */
const CORNER = ['GGGGGG', 'GYYYg.', 'GY.g..', 'GYg...', 'Gg....', 'G.....'];

/** 9x9 icons on a transparent ground; drawn over a dark badge or a light page alike. */
export const ICONS: Readonly<Record<string, readonly string[]>> = {
  hammer: ['.XXXXXX..', '.XZZZZX..', '.XXXXXX..', '...oo....', '...oo....', '...oo....', '...oo....', '...oo....', '...oo....'],
  shield: ['.GGGGGGG.', '.GbbbRRG.', '.GbbbRRG.', '.GbbbRRG.', '.GbbbRRG.', '..GbbRG..', '..GbbRG..', '...GRG...', '....G....'],
  boot: ['..ooo....', '..ooo....', '..ooo....', '..ooo....', '..oooo...', '.ooooooo.', '.ooooooo.', 'GGGGGGGG.', '.........'],
  coin: ['..GGGG...', '.GYYYYG..', 'GYYggYYG.', 'GYgYYgYG.', 'GYgYYgYG.', 'GYYggYYG.', '.GYYYYG..', '..GGGG...', '.........'],
  heart: ['.RR.RR...', 'RqRRRRR..', 'RRRRRRR..', 'RRRRRRR..', '.RRRRR...', '..RRR....', '...R.....', '.........', '.........'],
  book: ['.GGGGGGG.', 'GWWWWWWWG', 'GWbbbbbWG', 'GWWWWWWWG', 'GWbbbbbWG', 'GWWWWWWWG', 'GWbbbbbWG', 'GWWWWWWWG', '.GGGGGGG.'],
  swords: ['X.......X', '.X.....X.', '..X...X..', '...X.X...', '....G....', '...X.X...', '..X...X..', '.o.....o.', 'o.......o'],
  purse: ['...GGG...', '....o....', '..ooooo..', '.ooYYYoo.', '.oYYYYYo.', '.ooYYYoo.', '.ooooooo.', '..ooooo..', '.........'],
  flame: ['....R....', '...RR....', '...RRR...', '..RRYR...', '..RYYYR..', '.RRYYYRR.', '.RRYYYRR.', '..RRYRR..', '...RRR...'],
  star: ['....Y....', '....Y....', '..YYYYY..', '.YYYYYYY.', '..YYYYY..', '..YY.YY..', '.YY...YY.', '.........', '.........'],
};

export interface UiArt {
  /** The story font: a frame per glyph (white; tint when drawn), each GLYPH_H tall. */
  story: Record<string, Frame>;
  /** Panel flourishes: top-left, top-right, bottom-left, bottom-right. */
  corner: Frame[];
  cursor: Frame;
  icons: Record<string, Frame>;
}

export function buildUiArt(add: Add): UiArt {
  const story: Record<string, Frame> = {};
  for (const [ch, rows] of Object.entries(STORY_GLYPHS)) {
    const w = Math.max(...rows.map((r) => r.length));
    const rgba = new Uint8ClampedArray(w * GLYPH_H * 4);
    for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < w; x++) if (rows[y]?.[x] === '#') rgba.set([255, 255, 255, 255], (y * w + x) * 4);
    story[ch] = add({ w, h: GLYPH_H, rgba });
  }
  const corner = [CORNER, mirrorX(CORNER), mirrorY(CORNER), mirrorY(mirrorX(CORNER))].map((rows) => add(bitmap(rows)));
  const cursor = add(bitmap(['G....', 'GG...', 'GYG..', 'GYYG.', 'GYG..', 'GG...', 'G....']));
  const icons: Record<string, Frame> = {};
  for (const [name, rows] of Object.entries(ICONS)) icons[name] = add(bitmap(rows));
  return { story, corner, cursor, icons };
}
