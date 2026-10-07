// The UI kit's sprites (docs/13-ui-art.md): the story font, panel corner flourishes, a cursor, a star, a divider and the 9x9
// icons. Procedural, defined as text bitmaps like the rest of the placeholder art and packed into the atlas at startup, so
// they can be replaced by drawn art without touching a screen: screens only call the helpers in ui.ts.
// Colours are the "Glass" palette (art/palette.mjs): lead outline, gold leaf, vellum, lapis, crimson.
import type { Frame } from '../platform/gl/batcher';
import { glyphWidth, GLYPH_H, STORY_GLYPHS } from '../data/storyFont';
import { TITLE_LINES } from '../data/title';

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

/** A line of text as a 1-bit grid in the story font's 5x7 letterforms (the glyphs' own rows, descenders included). */
function textGrid(text: string): boolean[][] {
  let w = 0;
  for (const ch of text) w += glyphWidth(ch) + 1;
  w = Math.max(0, w - 1);
  const g = Array.from({ length: GLYPH_H }, () => new Array<boolean>(w).fill(false));
  let cx = 0;
  for (const ch of text) {
    const rows = STORY_GLYPHS[ch];
    if (rows) for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < (rows[y]?.length ?? 0); x++) if (rows[y][x] === '#') g[y][cx + x] = true;
    cx += glyphWidth(ch) + 1;
  }
  return g;
}

/**
 * Scale3x (the AdvMAME pixel-art enlarger): each pixel becomes 3x3 and diagonal steps are rounded off, so a 5x7 letterform becomes a 15x21 one
 * with real, smooth strokes at 1x, not a font blown up into 3-pixel squares. That keeps the title on the game's pixel grid.
 */
function scale3x(src: boolean[][]): boolean[][] {
  const h = src.length, w = src[0]?.length ?? 0;
  const at = (x: number, y: number): boolean => (x >= 0 && y >= 0 && x < w && y < h ? src[y][x] : false);
  const out = Array.from({ length: h * 3 }, () => new Array<boolean>(w * 3).fill(false));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y), G = at(x - 1, y + 1), H = at(x, y + 1), I = at(x + 1, y + 1);
      const e = [E, E, E, E, E, E, E, E, E];
      if (B !== H && D !== F) {
        e[0] = D === B ? D : E;
        e[1] = (D === B && E !== C) || (B === F && E !== A) ? B : E;
        e[2] = B === F ? F : E;
        e[3] = (D === B && E !== G) || (D === H && E !== A) ? D : E;
        e[5] = (B === F && E !== I) || (F === H && E !== C) ? F : E;
        e[6] = D === H ? D : E;
        e[7] = (D === H && E !== I) || (F === H && E !== G) ? H : E;
        e[8] = F === H ? F : E;
      }
      for (let k = 0; k < 9; k++) out[y * 3 + Math.floor(k / 3)][x * 3 + (k % 3)] = e[k];
    }
  }
  return out;
}

/**
 * The title's lettering as one sprite on the game's pixel grid: the lines' letterforms smoothed with Scale3x, filled gold with a lit top and a
 * shaded bottom edge, a one-pixel lead outline, and a soft drop shadow. Built once at startup.
 */
function buildLogo(lines: readonly string[]): Pix {
  const grids = lines.map((l) => scale3x(textGrid(l)));
  const gw = Math.max(...grids.map((g) => g[0]?.length ?? 0)), gap = 2;
  const gh = grids.reduce((a, g) => a + g.length, 0) + gap * (grids.length - 1);
  const PAD = 4, W = gw + PAD * 2, H = gh + PAD * 2;
  const ink = Array.from({ length: H }, () => new Array<boolean>(W).fill(false));
  let y0 = PAD;
  for (const g of grids) {
    const x0 = PAD + Math.floor((gw - (g[0]?.length ?? 0)) / 2);
    g.forEach((row, y) => row.forEach((on, x) => { if (on) ink[y0 + y][x0 + x] = true; }));
    y0 += g.length + gap;
  }
  const has = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && ink[y][x];
  const rgba = new Uint8ClampedArray(W * H * 4);
  const put = (x: number, y: number, c: number, a = 255): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    rgba[o] = (c >> 16) & 255; rgba[o + 1] = (c >> 8) & 255; rgba[o + 2] = c & 255; rgba[o + 3] = a;
  };
  const near = (x: number, y: number): boolean => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (has(x + dx, y + dy)) return true; return false; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!has(x, y) && (near(x - 2, y - 2) || near(x - 1, y - 2) || near(x - 2, y - 1))) put(x, y, 0x000000, 90); // the drop shadow
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!has(x, y) && near(x, y)) put(x, y, GLASS.lead);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!has(x, y)) continue;
      const lit = !has(x, y - 1) || !has(x - 1, y) && !has(x, y - 2) ? GLASS.Y : null;
      const shade = !has(x, y + 1) || !has(x + 1, y) ? GLASS.g : null;
      put(x, y, lit ?? shade ?? GLASS.G);
    }
  }
  return { w: W, h: H, rgba };
}

export interface UiArt {
  /** The title's lettering, drawn ready-made (see buildLogo). */
  logo: Frame;
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
  const logo = add(buildLogo(TITLE_LINES));
  return { story, corner, cursor, icons, logo };
}
