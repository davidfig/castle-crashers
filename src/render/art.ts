// Procedural placeholder art: sprites are defined as tiny text bitmaps and packed into one atlas
// at startup. Swap for real PNG atlases (tools/pack-atlas) once there is art.
import type { Frame } from '../platform/gl/batcher';
import { buildHeroSet, type HeroSet } from './hero';
import { buildMobArt, type MobArt } from './mobArt';

export const PLAYER_COLORS = [0xe0443a, 0x3a7be0, 0xe8c43a, 0xa04ae0];

function darken(rgb: number, k: number): number {
  const r = Math.round(((rgb >> 16) & 255) * k), g = Math.round(((rgb >> 8) & 255) * k), b = Math.round((rgb & 255) * k);
  return (r << 16) | (g << 8) | b;
}

function bitmap(rows: string[], pal: Record<string, number>, name: string): { w: number; h: number; rgba: Uint8ClampedArray } {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  if (__DEV__) {
    for (const r of rows) if (r.length !== w) console.warn(`art: ${name} has ragged row "${r}" (${r.length} != ${w})`);
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '.';
      const c = pal[ch];
      if (ch === '.' || c === undefined) continue;
      const o = (y * w + x) * 4;
      rgba[o] = (c >> 16) & 255;
      rgba[o + 1] = (c >> 8) & 255;
      rgba[o + 2] = c & 255;
      rgba[o + 3] = 255;
    }
  }
  return { w, h, rgba };
}

const GLYPHS: Record<string, string> = {
  '0': '###' + '#.#' + '#.#' + '#.#' + '###',
  '1': '.#.' + '##.' + '.#.' + '.#.' + '###',
  '2': '###' + '..#' + '###' + '#..' + '###',
  '3': '###' + '..#' + '###' + '..#' + '###',
  '4': '#.#' + '#.#' + '###' + '..#' + '..#',
  '5': '###' + '#..' + '###' + '..#' + '###',
  '6': '###' + '#..' + '###' + '#.#' + '###',
  '7': '###' + '..#' + '.#.' + '.#.' + '.#.',
  '8': '###' + '#.#' + '###' + '#.#' + '###',
  '9': '###' + '#.#' + '###' + '..#' + '###',
  A: '.#.' + '#.#' + '###' + '#.#' + '#.#',
  B: '##.' + '#.#' + '##.' + '#.#' + '##.',
  C: '.##' + '#..' + '#..' + '#..' + '.##',
  D: '##.' + '#.#' + '#.#' + '#.#' + '##.',
  E: '###' + '#..' + '##.' + '#..' + '###',
  F: '###' + '#..' + '##.' + '#..' + '#..',
  G: '.##' + '#..' + '#.#' + '#.#' + '.##',
  H: '#.#' + '#.#' + '###' + '#.#' + '#.#',
  I: '###' + '.#.' + '.#.' + '.#.' + '###',
  J: '..#' + '..#' + '..#' + '#.#' + '.#.',
  K: '#.#' + '#.#' + '##.' + '#.#' + '#.#',
  L: '#..' + '#..' + '#..' + '#..' + '###',
  M: '#.#' + '###' + '###' + '#.#' + '#.#',
  N: '##.' + '#.#' + '#.#' + '#.#' + '#.#',
  O: '.#.' + '#.#' + '#.#' + '#.#' + '.#.',
  P: '##.' + '#.#' + '##.' + '#..' + '#..',
  Q: '.#.' + '#.#' + '#.#' + '##.' + '.##',
  R: '##.' + '#.#' + '##.' + '#.#' + '#.#',
  S: '.##' + '#..' + '.#.' + '..#' + '##.',
  T: '###' + '.#.' + '.#.' + '.#.' + '.#.',
  U: '#.#' + '#.#' + '#.#' + '#.#' + '###',
  V: '#.#' + '#.#' + '#.#' + '#.#' + '.#.',
  W: '#.#' + '#.#' + '###' + '###' + '#.#',
  X: '#.#' + '#.#' + '.#.' + '#.#' + '#.#',
  Y: '#.#' + '#.#' + '.#.' + '.#.' + '.#.',
  Z: '###' + '..#' + '.#.' + '#..' + '###',
  ':': '...' + '.#.' + '...' + '.#.' + '...',
  '.': '...' + '...' + '...' + '...' + '.#.',
  '-': '...' + '...' + '###' + '...' + '...',
  '/': '..#' + '..#' + '.#.' + '#..' + '#..',
  '!': '.#.' + '.#.' + '.#.' + '...' + '.#.',
  '+': '...' + '.#.' + '###' + '.#.' + '...',
  '?': '###' + '..#' + '.#.' + '...' + '.#.',
};

// Small deterministic hash for cosmetic noise (not the sim RNG).
function hash2(x: number, y: number, s = 0): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A body lying on its side: the sprite rotated 90 degrees, darkened and spattered with blood. */
function makeGround(variant: number): { w: number; h: number; rgba: Uint8ClampedArray } {
  const w = 16, h = 16;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const shades = [0x4b8039, 0x497d37, 0x4d8339];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = hash2(x, y, variant + 1);
      let c = shades[r % 3];
      if ((r >>> 8) % 70 === 0) c = 0x437535; // tufts
      if ((r >>> 8) % 400 === 1) c = 0xd8d26a; // tiny flowers
      const o = (y * w + x) * 4;
      rgba[o] = (c >> 16) & 255; rgba[o + 1] = (c >> 8) & 255; rgba[o + 2] = c & 255; rgba[o + 3] = 255;
    }
  }
  return { w, h, rgba };
}

function makeMountains(w: number, h: number, base: number, amp: number, seed: number, fill: number, edge: number): { w: number; h: number; rgba: Uint8ClampedArray } {
  const rgba = new Uint8ClampedArray(w * h * 4);
  const TAU = Math.PI * 2;
  for (let x = 0; x < w; x++) {
    const t = (x / w) * TAU;
    const ridge = base
      - amp * (0.55 * Math.sin(t * 1 + seed) + 0.3 * Math.sin(t * 3 + seed * 2.1) + 0.15 * Math.sin(t * 7 + seed * 0.7));
    const top = Math.max(0, Math.round(ridge));
    for (let y = top; y < h; y++) {
      const o = (y * w + x) * 4;
      const c = y === top ? edge : (hash2(x, y, seed | 0) % 23 === 0 ? darken(fill, 0.92) : fill);
      rgba[o] = (c >> 16) & 255; rgba[o + 1] = (c >> 8) & 255; rgba[o + 2] = c & 255; rgba[o + 3] = 255;
    }
  }
  return { w, h, rgba };
}

function makeEllipse(w: number, h: number): { w: number; h: number; rgba: Uint8ClampedArray } {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      if (dx * dx + dy * dy <= 1) rgba[(y * w + x) * 4 + 3] = 255;
    }
  }
  return { w, h, rgba };
}

export interface Sprites {
  atlas: HTMLCanvasElement;
  px: Frame;
  /** Indexed by MobType: the walk cycle (4 frames); other poses live in mobArt. */
  mob: Frame[][];
  shadow: Frame[];
  /** Indexed by MobType: a fallen body of that enemy. */
  corpse: Frame[];
  /** Coins: [small, big] x [face-on, edge-on]. */
  coin: Frame[][];
  /** Warrior sprites from the art workbench, per player slot (see hero.ts). */
  hero: HeroSet;
  /** Enemy art from the art workbench: walk cycles, the raised-bow archer, rotated weapons (see mobArt.ts). */
  mobArt: MobArt;
  ground: Frame[];
  mountFar: Frame;
  mountNear: Frame;
  glyph: Record<string, Frame>;
}

export function buildSprites(heroImages: HTMLImageElement[], mobImages: HTMLImageElement[]): Sprites {
  const blank: Frame = { u0: 0, v0: 0, u1: 0, v1: 0, w: 0, h: 0 };
  const mk = (): Frame => ({ ...blank });
  const items: { w: number; h: number; rgba: Uint8ClampedArray; frame: Frame }[] = [];
  const add = (b: { w: number; h: number; rgba: Uint8ClampedArray }): Frame => {
    const frame = mk();
    items.push({ ...b, frame });
    return frame;
  };

  const px = add({ w: 1, h: 1, rgba: new Uint8ClampedArray([255, 255, 255, 255]) });

  const shadow = [add(makeEllipse(8, 3)), add(makeEllipse(12, 4)), add(makeEllipse(16, 5))];

  const cpal = { y: 0xc98a14, Y: 0xffd84a, W: 0xfff6b0 };
  const coin = [
    [add(bitmap(['.yy.', 'yYWy', 'yYYy', '.yy.'], cpal, 'coinS')), add(bitmap(['yY', 'yY', 'yY', 'yY'], cpal, 'coinSe'))],
    [add(bitmap(['.yyyy.', 'yYYYYy', 'yYWWYy', 'yYYYYy', 'yYYYYy', '.yyyy.'], cpal, 'coinB')), add(bitmap(['yY', 'yY', 'yY', 'yY', 'yY', 'yY'], cpal, 'coinBe'))],
  ];

  const ground = [0, 1, 2, 3].map((v) => add(makeGround(v)));
  const mountFar = add(makeMountains(256, 64, 40, 20, 1.3, 0x8aa2c4, 0xaabfd9));
  const mountNear = add(makeMountains(256, 44, 28, 14, 4.1, 0x6c8c84, 0x8aaba0));

  const glyph: Record<string, Frame> = {};
  for (const [ch, bits] of Object.entries(GLYPHS)) {
    const rgba = new Uint8ClampedArray(3 * 5 * 4);
    for (let i = 0; i < 15; i++) if (bits[i] === '#') rgba.set([255, 255, 255, 255], i * 4);
    glyph[ch] = add({ w: 3, h: 5, rgba });
  }

  // Shelf-pack into a 512-wide atlas with 1px padding.
  const W = 512;
  const order = [...items].sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0;
  const placed: { it: (typeof items)[number]; x: number; y: number }[] = [];
  for (const it of order) {
    if (x + it.w + 1 > W) { x = 0; y += rowH + 1; rowH = 0; }
    placed.push({ it, x, y });
    x += it.w + 1;
    if (it.h > rowH) rowH = it.h;
  }
  // Hero sheets from the art workbench are stacked under the procedural sprites.
  let usedH = y + rowH + 1;
  const heroPlaces = heroImages.map((img) => { const pl = { x: 0, y: usedH }; usedH += img.height + 1; return pl; });
  const mobPlaces = mobImages.map((img) => { const pl = { x: 0, y: usedH }; usedH += img.height + 1; return pl; });
  let H = 1;
  while (H < usedH) H <<= 1;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  for (const p of placed) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(p.it.rgba), p.it.w, p.it.h), p.x, p.y);
    const f = p.it.frame;
    f.u0 = p.x / W; f.v0 = p.y / H; f.u1 = (p.x + p.it.w) / W; f.v1 = (p.y + p.it.h) / H;
    f.w = p.it.w; f.h = p.it.h;
  }

  heroImages.forEach((img, k) => ctx.drawImage(img, heroPlaces[k].x, heroPlaces[k].y));
  mobImages.forEach((img, k) => ctx.drawImage(img, mobPlaces[k].x, mobPlaces[k].y));
  const hero = buildHeroSet(heroPlaces, W, H);
  const mobArt = buildMobArt(mobPlaces, W, H);
  const mob = mobArt.walk;
  // Corpses are the authored `dead` frame of each enemy sheet (the first walk frame laid on its side, built by tools/art.mjs).
  const corpse = mobArt.anims.slice(0, 5).map((a) => a.dead[0]);

  return { atlas: canvas, px, mob, shadow, corpse, coin, hero, mobArt, ground, mountFar, mountNear, glyph };
}
