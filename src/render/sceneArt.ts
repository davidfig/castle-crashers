// The places hub scenes happen in (docs/13-ui-art.md): eight drawn sets, each a flat-fill scene in the Glass palette, drawn
// from rectangles at runtime so they ship with no asset files and can be replaced by painted backdrops without touching a
// screen. A set fills the 640 x 262 area above the text panel; figures stand on the floor line.
import type { Backdrop } from '../data/story/hub';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_W } from '../sim/constants';
import type { Sprites } from './art';
import { storyWidth } from '../data/storyFont';
import { drawStory } from './ui';
import { drawStreet } from './townArt';
import { drawOffice } from './officeArt';
import { GLASS } from './uiArt';

/** Where figures' feet go, and the height of the area a backdrop fills. */
export const SCENE_FLOOR = 250;
export const SCENE_H = 262;

/**
 * Where figures stand in each set, at the game's own size (1x, so a hero is about 28 px tall against a town 262 px high): the left edge of the
 * party (they stand 22 px apart) and the Registrar's feet. Placed to suit what the set shows.
 */
export const STAGE: Record<Backdrop, { party: number; registrar: number; /** The party walks in from this many px to the left when the scene opens, then stands. */ walkIn?: number }> = {
  notice: { party: 196, registrar: 540, walkIn: 150 }, tavern: { party: 110, registrar: 520 }, gates: { party: 120, registrar: 520 }, rain: { party: 120, registrar: 520 },
  campfire: { party: 230, registrar: 420 }, smoke: { party: 120, registrar: 520 }, office: { party: 170, registrar: 506, walkIn: 150 }, market: { party: 150, registrar: 520 }, graves: { party: 120, registrar: 520 },
};

/** A cheap deterministic hash in [0, 1). */
const h01 = (n: number): number => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

export class Pen {
  constructor(readonly b: Batcher, readonly S: Sprites, readonly tick: number) {}
  r(x: number, y: number, w: number, h: number, c: number, a = 1): void { this.b.drawScaled(this.S.px, x, y, w, h, hex(c, a)); }
  /** Horizontal bands from top to `to`, one colour each. */
  bands(cols: readonly number[], to: number, from = 0): void {
    const h = (to - from) / cols.length;
    cols.forEach((c, i) => this.r(0, from + Math.round(i * h), VIEW_W, Math.ceil(h) + 1, c));
  }
  /** A soft light: stacked discs, brightest in the middle. */
  glow(x: number, y: number, rad: number, c: number, a = 0.12): void {
    for (let k = 0; k < 3; k++) {
      const r = rad * (1 - k * 0.3);
      for (let dy = -r; dy <= r; dy += 2) {
        const half = Math.sqrt(Math.max(0, r * r - dy * dy));
        this.r(x - half, y + dy, half * 2, 2, c, a);
      }
    }
  }
  /** A filled triangle-ish peak (a roof, a pine, a tent): stacked rows narrowing to the top. */
  peak(cx: number, baseY: number, w: number, h: number, c: number): void {
    for (let i = 0; i < h; i++) { const ww = Math.max(2, Math.round(w * (1 - i / h))); this.r(cx - ww / 2, baseY - i, ww, 1, c); }
  }
  flame(cx: number, baseY: number, scale = 1, seed = 0): void {
    const t = this.tick;
    const tongues = [[-6, 18], [-2, 28], [3, 24], [7, 15], [0, 34]];
    tongues.forEach(([dx, hh], i) => {
      const hgt = (hh + Math.round(Math.sin((t + i * 7 + seed) * 0.31) * 4 + h01(t >> 2 ^ i) * 3)) * scale;
      const w = (9 - Math.abs(dx) * 0.4) * scale;
      this.r(cx + dx * scale - w / 2, baseY - hgt, w, hgt, 0xd8561e);
      this.r(cx + dx * scale - w / 3, baseY - hgt * 0.75, w * 0.66, hgt * 0.75, 0xf0922a);
      this.r(cx + dx * scale - w / 6, baseY - hgt * 0.45, Math.max(1, w * 0.33), hgt * 0.45, 0xffd35a);
    });
  }
}

type Draw = (p: Pen) => void;

const tavern: Draw = (p) => {
  p.r(0, 0, VIEW_W, SCENE_H, 0x2b1b15);
  for (let x = 0; x < VIEW_W; x += 18) p.r(x, 0, 1, SCENE_FLOOR, 0x221410);
  p.r(0, 0, VIEW_W, 20, 0x4a2e1e); p.r(0, 18, VIEW_W, 2, 0x2a190f);
  for (const x of [50, 300, 570]) { p.r(x, 20, 14, SCENE_FLOOR - 20, 0x3a2418); p.r(x, 20, 2, SCENE_FLOOR - 20, 0x4f3322); }
  p.r(0, SCENE_FLOOR, VIEW_W, SCENE_H - SCENE_FLOOR, 0x3a2418);
  for (let y = SCENE_FLOOR; y < SCENE_H; y += 4) p.r(0, y, VIEW_W, 1, 0x2e1c12);
  // the hearth
  p.r(236, 112, 168, SCENE_FLOOR - 112, 0x4a4660); p.r(236, 112, 168, 4, 0x6e6470);
  for (let y = 120; y < SCENE_FLOOR; y += 12) for (let x = 236 + ((y / 12) & 1) * 10; x < 404; x += 20) p.r(x, y, 1, 12, 0x3a3650);
  p.r(262, 148, 116, SCENE_FLOOR - 148, 0x120a08);
  p.glow(320, 226, 96, 0xff9a3a, 0.1);
  p.flame(320, 244, 1.2);
  p.r(296, 240, 48, 6, 0x4a2e1e); p.r(300, 236, 40, 5, 0x5c3f28);
  // a window onto a cold night
  p.r(452, 60, 78, 78, 0x4a2e1e); p.r(458, 66, 66, 66, 0x1a2a5a); p.r(489, 66, 2, 66, 0x4a2e1e); p.r(458, 98, 66, 2, 0x4a2e1e);
  p.r(500, 74, 10, 10, 0xd4daf0); p.r(504, 72, 8, 8, 0x1a2a5a);
  // tables, mugs and lanterns
  for (const [x, w] of [[60, 130], [440, 150]] as const) {
    p.r(x, 214, w, 8, 0x5c3f28); p.r(x, 214, w, 2, 0x8a4a2e); p.r(x + 8, 222, 6, 28, 0x3a2418); p.r(x + w - 14, 222, 6, 28, 0x3a2418);
    for (let k = 0; k < 3; k++) { p.r(x + 20 + k * 38, 205, 8, 9, 0xb9744a); p.r(x + 22 + k * 38, 207, 4, 3, 0xf4ead2); }
  }
  for (const x of [170, 420]) {
    p.r(x, 20, 1, 40, 0x1a1030); p.r(x - 4, 60, 9, 11, 0xefbd44); p.r(x - 3, 61, 7, 9, 0xfff0a0); p.r(x - 5, 58, 11, 2, 0x1a1030);
    p.glow(x, 66, 46, 0xefbd44, 0.09);
  }
};

const gates: Draw = (p) => {
  p.bands([0x3b57b8, 0x5f7fcf, 0x8fa9e0, 0xc9d3ee, 0xf0cfae, 0xefbd44], 170);
  p.glow(330, 168, 120, 0xfff0a0, 0.07);
  for (const [x, w, h] of [[40, 56, 120], [150, 44, 90], [500, 60, 130], [580, 48, 100]] as const) {
    p.r(x, 170 - h, w, h, 0x4a526e);
    for (let k = 0; k < w; k += 10) p.r(x + k, 170 - h - 6, 6, 6, 0x4a526e);
    p.r(x + w / 2 - 3, 170 - h + 16, 6, 12, 0x232f78);
  }
  p.r(0, 150, VIEW_W, SCENE_FLOOR - 150, 0x6e6470);
  for (let y = 154; y < SCENE_FLOOR; y += 12) { p.r(0, y, VIEW_W, 1, 0x4a4660); for (let x = ((y / 12) & 1) * 14; x < VIEW_W; x += 28) p.r(x, y, 1, 12, 0x4a4660); }
  for (let x = 0; x < VIEW_W; x += 24) p.r(x, 144, 14, 8, 0x6e6470);
  // the gate: a deep arch and a raised portcullis
  p.r(238, 100, 164, SCENE_FLOOR - 100, 0x43394a);
  for (let i = 0; i < 40; i++) { const half = Math.sqrt(Math.max(0, 1600 - (i - 40) * (i - 40))); p.r(320 - half, 100 + i, half * 2, 1, 0x1a1030); }
  p.r(280, 140, 80, SCENE_FLOOR - 140, 0x1a1030);
  for (let x = 284; x < 360; x += 8) p.r(x, 120, 2, 30, 0x4a526e);
  // banners and bunting
  for (const x of [196, 428]) { p.r(x, 96, 16, 70, 0xc23458); p.r(x, 96, 16, 3, 0xefbd44); p.r(x + 6, 120, 4, 4, 0xefbd44); p.peak(x + 8, 166, 16, 8, 0x1a1030); p.r(x, 96, 1, 70, 0x7a1a35); p.r(x + 16, 100 + Math.round(Math.sin(p.tick * 0.06 + x) * 2), 3, 60, 0x7a1a35); }
  for (let x = 0; x < VIEW_W; x += 16) { const y = 60 + Math.round(Math.sin(x * 0.03 + p.tick * 0.04) * 8); p.r(x, y, 8, 6, (x >> 4) & 1 ? 0xc23458 : 0xefbd44); }
  p.r(0, SCENE_FLOOR, VIEW_W, SCENE_H - SCENE_FLOOR, 0x8f98b8);
  for (let x = 0; x < VIEW_W; x += 14) p.r(x, SCENE_FLOOR, 1, SCENE_H - SCENE_FLOOR, 0x6e6470);
};

const rain: Draw = (p) => {
  p.bands([0x0f0c22, 0x14102c, 0x1a1536, 0x201b42, 0x28224c], SCENE_FLOOR - 40);
  p.glow(120, 50, 60, 0xd4daf0, 0.05);
  for (let x = -10; x < VIEW_W; x += 46) {
    const w = 38 + Math.round(h01(x) * 10), h = 50 + Math.round(h01(x + 3) * 60);
    p.r(x, SCENE_FLOOR - 40 - h, w, h + 40, 0x151030);
    p.peak(x + w / 2, SCENE_FLOOR - 40 - h, w + 8, 18, 0x120d28);
    for (let wy = SCENE_FLOOR - 36 - h; wy < SCENE_FLOOR - 50; wy += 18) for (let wx = x + 6; wx < x + w - 8; wx += 14) if (h01(wx * 31 + wy) > 0.55) { p.r(wx, wy, 6, 8, 0xefbd44); p.r(wx - 1, wy - 1, 8, 10, 0xefbd44, 0.12); }
  }
  p.r(0, SCENE_FLOOR - 40, VIEW_W, 40 + SCENE_H - SCENE_FLOOR, 0x1c1738);
  for (let k = 0; k < 6; k++) { const x = 40 + k * 110, y = SCENE_FLOOR - 16 + (k & 1) * 6; p.r(x, y, 50, 2, 0x3b57b8, 0.5); p.r(x + 8, y + 3, 30, 1, 0x7f9ee8, 0.3); }
  for (let i = 0; i < 110; i++) {
    const x = (h01(i) * 760 - 60 + p.tick * 2.4) % 700 - 40, y = (h01(i + 500) * 330 + p.tick * 9 * (0.8 + h01(i + 900) * 0.5)) % 330 - 40;
    if (y > SCENE_FLOOR + 8) continue;
    p.r(x, y, 1, 6, 0x7f9ee8, 0.55); p.r(x - 1, y + 5, 1, 2, 0x7f9ee8, 0.4);
  }
};

const campfire: Draw = (p) => {
  p.bands([0x0b0a1c, 0x0f0e26, 0x141234, 0x1b1842, 0x221e4e], 200);
  for (let i = 0; i < 70; i++) { const tw = ((p.tick >> 4) + i) % 9 === 0; p.r(h01(i) * VIEW_W, h01(i + 70) * 150, 1, 1, tw ? 0xfff0a0 : 0xd4daf0, tw ? 0.4 : 0.8); }
  p.r(500, 40, 22, 22, 0xd4daf0); p.r(508, 36, 20, 20, 0x0f0e26);
  for (let x = -10; x < VIEW_W; x += 34) { const hgt = 60 + Math.round(h01(x) * 60); p.peak(x + 17, 200, 40, hgt, 0x0e1a1c); p.peak(x + 17, 200, 40, hgt * 0.7, 0x12262a); }
  p.r(0, 200, VIEW_W, SCENE_H - 200, 0x16181f);
  p.r(0, 200, VIEW_W, 2, 0x1d2a2c);
  p.peak(90, SCENE_FLOOR, 90, 56, 0x2a2440); p.r(78, SCENE_FLOOR - 20, 24, 20, 0x120d28);
  p.peak(560, SCENE_FLOOR - 4, 80, 48, 0x2a2440); p.r(550, SCENE_FLOOR - 22, 20, 18, 0x120d28);
  p.glow(320, 232, 130, 0xff9a3a, 0.08);
  for (let k = 0; k < 7; k++) p.r(296 + k * 8, 244 + (k & 1), 7, 5, 0x6e6470);
  p.r(300, 238, 40, 6, 0x4a2e1e); p.r(306, 234, 30, 5, 0x5c3f28);
  p.flame(320, 238, 1.1, 3);
  for (let i = 0; i < 6; i++) { const t = (p.tick * 1.3 + i * 40) % 120; p.r(318 + Math.sin(t * 0.2 + i) * 14, 220 - t * 1.1, 1, 1, 0xffd35a, 1 - t / 120); }
};

const smoke: Draw = (p) => {
  p.bands([0x2a0e1c, 0x52161a, 0x8a2a1c, 0xc24a22, 0xe8873a], 190);
  p.glow(150, 188, 110, 0xefbd44, 0.1);
  p.r(0, 190, VIEW_W, SCENE_H - 190, 0x1b1720);
  for (let x = 0; x < VIEW_W; x += 12) p.r(x, 190, 8, 2, 0x2c2530);
  for (const base of [90, 230, 380, 520]) {
    for (let k = 0; k < 9; k++) {
      const t = (p.tick * 0.5 + k * 22 + base) % 200;
      const x = base + Math.sin(t * 0.04 + base) * 16 + k * 3, y = 200 - t * 0.9, s = 14 + t * 0.22;
      p.r(x - s / 2, y - s / 2, s, s * 0.8, 0x2c2530, Math.max(0, 0.42 - t / 520));
    }
  }
  for (const [x, hh] of [[60, 70], [170, 56], [300, 80], [430, 60], [560, 74]] as const) {
    p.r(x, SCENE_FLOOR - hh, 2, hh, 0x6e6470);
    p.r(x + 2, SCENE_FLOOR - hh, 16, 10, 0x7a1a35); p.peak(x + 22, SCENE_FLOOR - hh + 5, 10, 5, 0x1b1720);
  }
  p.r(360, SCENE_FLOOR - 22, 70, 6, 0x3a2418); p.r(364, SCENE_FLOOR - 16, 4, 16, 0x3a2418);
  p.r(386, SCENE_FLOOR - 28, 18, 18, 0x2a1810); p.r(390, SCENE_FLOOR - 24, 10, 10, 0x1b1720);
  p.r(0, SCENE_FLOOR, VIEW_W, SCENE_H - SCENE_FLOOR, 0x241d2a);
};

const office: Draw = (p) => { drawOffice(p); };

const market: Draw = (p) => {
  p.bands([0x7f9ee8, 0x9fb8ee, 0xbfd0f2, 0xd4daf0, 0xe9e6dc], 120);
  for (const [x, w, h, c] of [[10, 110, 100, 0xb9744a], [150, 90, 120, 0xa8791f], [260, 80, 90, 0xb9744a], [370, 110, 130, 0x8a4a2e], [500, 130, 100, 0xa8791f]] as const) {
    p.r(x, 150 - h, w, h + 40, c); p.peak(x + w / 2, 150 - h, w + 10, 22, 0x7a1a35);
    for (let wy = 150 - h + 14; wy < 180; wy += 24) for (let wx = x + 10; wx < x + w - 14; wx += 26) p.r(wx, wy, 10, 12, 0x232f78);
  }
  p.r(0, 186, VIEW_W, SCENE_H - 186, 0x8f98b8);
  for (let y = 190; y < SCENE_H; y += 9) { p.r(0, y, VIEW_W, 1, 0x6e6470); for (let x = ((y / 9) & 1) * 9; x < VIEW_W; x += 18) p.r(x, y, 1, 9, 0x6e6470); }
  for (const [x, w] of [[24, 150], [236, 168], [470, 150]] as const) {
    for (let k = 0; k < w; k += 10) p.r(x + k, 142, 10, 20, (k / 10) % 2 ? 0xf4ead2 : 0xc23458);
    p.r(x, 162, w, 3, 0x1a1030); p.r(x + 4, 162, 4, 60, 0x5c3f28); p.r(x + w - 8, 162, 4, 60, 0x5c3f28);
    p.r(x, 196, w, 12, 0x5c3f28); p.r(x, 196, w, 2, 0x8a4a2e);
    for (let k = 0; k < w - 12; k += 14) { p.r(x + 8 + k, 188, 8, 8, [0xc23458, 0xefbd44, 0x5fb88a, 0x7f9ee8][(k / 14) & 3]); }
  }
  // the mapmaker's stall: rolled sheets of vellum
  for (let k = 0; k < 5; k++) { p.r(262 + k * 22, 178, 6, 20, 0xf4ead2); p.r(262 + k * 22, 178, 6, 2, 0xa8791f); p.r(262 + k * 22, 196, 6, 2, 0xa8791f); }
  for (let x = 0; x < VIEW_W; x += 18) { const y = 120 + Math.round(Math.sin(x * 0.04 + p.tick * 0.05) * 6); p.r(x, y, 7, 8, (x >> 4) & 1 ? 0xefbd44 : 0x3b57b8); }
};

const graves: Draw = (p) => {
  p.bands([0x3a3848, 0x55536a, 0x7e7d92, 0xa39a98, 0xc9bfae], 190);
  p.r(0, 190, VIEW_W, SCENE_H - 190, 0x2c2a33);
  for (let row = 0; row < 5; row++) {
    const y = 200 + row * 11, s = 0.55 + row * 0.2;
    for (let k = 0; k < 9; k++) {
      const x = 20 + k * 70 + (row & 1) * 30 + Math.round(h01(row * 9 + k) * 14);
      const mw = 34 * s, mh = 7 * s;
      p.r(x, y, mw, mh, 0x3a3848); p.r(x + 2 * s, y - 2 * s, mw - 4 * s, 2 * s, 0x3a3848); p.r(x + 4 * s, y - 3 * s, mw - 8 * s, 1 * s, 0x4a4660);
      if (h01(row * 31 + k) > 0.45) { p.r(x + mw / 2, y - 14 * s, 2 * s, 14 * s, 0x6e6470); p.r(x + mw / 2 - 4 * s, y - 11 * s, 10 * s, 2 * s, 0x6e6470); }
    }
  }
  for (const [y, a] of [[170, 0.22], [196, 0.3], [222, 0.2]] as const) for (let x = -40; x < VIEW_W; x += 120) p.r(x + Math.sin((p.tick + y) * 0.01) * 20, y, 200, 14, 0xe9e6dc, a);
  p.r(560, 60, 8, 132, 0x1b1720);
  for (const [dx, dy, w, h] of [[-40, 40, 40, 4], [-30, 70, 30, 3], [8, 30, 36, 4], [8, 60, 26, 3], [-20, 100, 24, 3]] as const) p.r(564 + dx, 60 + dy, w, h, 0x1b1720);
  for (const [x, y] of [[100, 60], [140, 80], [420, 50]] as const) { const f = (p.tick >> 4) & 1; p.r(x, y + f, 4, 1, 0x1b1720); p.r(x + 3, y - 1 + f, 4, 1, 0x1b1720); }
};

/**
 * The town square at dusk, drawn at the heroes' own scale (a hero is about 20 px of art): doors are 17 px tall, windows 7x9, the notice board
 * three heroes high with the Crown's proclamation among older notices, a lantern on each post, and barrels, crates and a well for size.
 */
const notice: Draw = (p) => {
  const GROUND = 214;
  p.bands([0x2b2058, 0x4a2f6e, 0x8a4a78, 0xc9707a, 0xe8a060, 0xf0cf8e], GROUND);
  p.glow(110, 150, 90, 0xffe0a0, 0.07);
  drawStreet(p, GROUND);
  // the cobbled square: stones about the size of a hand, rows staggered, a little lighter toward the front
  p.r(0, GROUND, VIEW_W, SCENE_H - GROUND, 0x6e5f70);
  for (let y = GROUND + 1, row = 0; y < SCENE_H; y += 5, row++) { p.r(0, y, VIEW_W, 1, 0x574a5c); for (let x = (row & 1) * 7; x < VIEW_W; x += 14) p.r(x, y, 1, 5, 0x574a5c); }
  p.r(0, GROUND, VIEW_W, 1, 0x3a2e4a);
  // the board, three heroes high: two posts, a cork panel under a little roof
  const BX = 260, BY = 170, BW = 120, BH = 72, BASE = 246;
  for (const x of [BX - 2, BX + BW - 2]) { p.r(x, BY - 6, 4, BASE - BY + 6, 0x4a2e1e); p.r(x, BY - 6, 1, BASE - BY + 6, 0x6a4430); }
  p.r(BX - 4, BASE - 2, 8, 3, 0x33201a); p.r(BX + BW - 6, BASE - 2, 8, 3, 0x33201a);
  p.r(BX, BY, BW, BH, 0x3a2418); p.r(BX + 3, BY + 3, BW - 6, BH - 6, 0x8a6a48);
  p.peak(BX + BW / 2, BY, BW + 10, 8, 0x3a2418); p.r(BX - 3, BY - 1, BW + 6, 2, 0x2a190f);
  for (const [nx, ny, nw, nh, col] of [[BX + 5, BY + 8, 13, 20, 0xe8dcc0], [BX + 7, BY + 34, 12, 21, 0xcfc09f], [BX + BW - 18, BY + 7, 13, 21, 0xcfc09f], [BX + BW - 19, BY + 33, 12, 20, 0xe8dcc0]] as const) {
    p.r(nx, ny, nw, nh, col); p.r(nx, ny + nh - 1, nw, 1, 0xa8896a);
    for (let l = 0; l < Math.floor((nh - 6) / 4); l++) p.r(nx + 2, ny + 4 + l * 4, nw - 5 - (h01(nx + l) > 0.5 ? 2 : 0), 1, 0x6a5a6a);
    p.r(nx + nw / 2, ny, 1, 2, 0x7a1a35);
  }
  // the Crown's proclamation: the largest and newest, lines centred on one axis with even gaps, a wax seal hanging over its lower edge
  const PW = 72, PH = 62, px = BX + Math.round((BW - PW) / 2), py = BY + 5, axis = px + PW / 2;
  p.r(px + 1, py + 2, PW, PH, 0x2a190f, 0.45); p.r(px, py, PW, PH, 0xf4ead2);
  p.r(px + 2, py + 2, PW - 4, 1, 0xa8791f); p.r(px + 2, py + PH - 3, PW - 4, 1, 0xa8791f); p.r(px + 2, py + 2, 1, PH - 4, 0xa8791f); p.r(px + PW - 3, py + 2, 1, PH - 4, 0xa8791f);
  const line = (t: string, y: number, c: number, bold = false): void => {
    const x = Math.round(axis - storyWidth(t) / 2);
    drawStory(p.b, p.S, t, x, y, c);
    if (bold) drawStory(p.b, p.S, t, x + 1, y, c); // a heavier face for the heading
  };
  const rule = (y: number): void => { p.r(axis - 22, y + 1, 18, 1, 0xa8791f); p.r(axis + 5, y + 1, 18, 1, 0xa8791f); p.r(axis - 1, y - 1, 3, 3, 0xa8791f); p.r(axis, y, 1, 1, GLASS.Y); };
  line('THE CROWN', py + 6, 0x6a5a7a);
  rule(py + 17);
  line('BOUNTY', py + 21, GLASS.r, true);
  line('ON ALL', py + 31, GLASS.lead);
  line('VERMIN', py + 40, GLASS.lead);
  line('PER HEAD', py + 50, 0x8a5a10);
  [5, 7, 9, 9, 9, 7, 5].forEach((w, k) => p.r(px + PW - 9 - w / 2 + 4, py + PH - 10 + k, w, 1, k < 3 ? GLASS.R : GLASS.r)); // the wax seal, in the lower corner
  p.r(px + PW - 5, py + PH - 7, 1, 2, GLASS.Y);
  p.r(px + 3, py + 3, 1, 1, 0x4a526e); p.r(px + PW - 4, py + 3, 1, 1, 0x4a526e); // nails
  // a lantern at the top of each post, each flickering at its own rate, its light a small pool kept on the board
  const pool = (cx: number, cy: number, R: number, a: number): void => {
    for (const [k, al] of [[1, 0.1], [0.66, 0.14], [0.34, 0.2]] as const) {
      const r = Math.round(R * k);
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.round(Math.sqrt(r * r - dy * dy)), x0 = Math.max(BX + 3, cx - half), x1 = Math.min(BX + BW - 3, cx + half);
        if (x1 > x0 && cy + dy > BY + 2 && cy + dy < BY + BH - 2) p.r(x0, cy + dy, x1 - x0, 1, 0xffb050, al * a);
      }
    }
  };
  for (const [x, ph] of [[BX, 0], [BX + BW, 2.4]] as const) {
    const fl = 0.5 + 0.3 * Math.sin(p.tick * 0.13 + ph) + 0.2 * Math.sin(p.tick * 0.41 + ph * 3);
    pool(x, BY + 10, 20 + Math.round(fl * 2), 0.8 + fl * 0.5);
    p.r(x - 1, BY - 12, 2, 3, 0x1a1030); p.r(x - 3, BY - 10, 6, 1, 0x1a1030);
    p.r(x - 3, BY - 9, 6, 8, 0x1a1030); p.r(x - 2, BY - 8, 4, 6, fl > 0.55 ? 0xffd566 : 0xefbd44); p.r(x - 1, BY - 7, 2, 3, 0xfff0a0);
    p.r(x - 3, BY - 1, 6, 1, 0x1a1030);
    p.r(x - 7, BY - 14, 14, 18, 0xffb050, 0.05 + 0.05 * fl); // a faint halo about the lantern only
  }
  // things in the square, for size: barrels and crates at the board's foot, a well at the right
  const barrel = (x: number, base: number): void => { p.r(x, base - 13, 10, 13, 0x6a4430); p.r(x + 1, base - 14, 8, 1, 0x6a4430); p.r(x, base - 10, 10, 1, 0x3a2418); p.r(x, base - 4, 10, 1, 0x3a2418); p.r(x + 2, base - 13, 1, 13, 0x8a5a3a); p.r(x, base, 10, 1, 0x000000, 0.25); };
  barrel(120, 244); barrel(132, 248); barrel(396, 246);
  p.r(410, 234, 14, 12, 0x7a5a3a); p.r(410, 234, 14, 2, 0x9a7a52); p.r(410, 240, 14, 1, 0x4a2e1e); p.r(416, 234, 1, 12, 0x4a2e1e); p.r(424, 238, 12, 8, 0x6a4a30); p.r(424, 238, 12, 2, 0x8a6a42); p.r(410, 246, 26, 1, 0x000000, 0.25);
  p.r(522, 226, 36, 16, 0x7a7390); p.r(522, 226, 36, 3, 0x9a94b0); p.r(526, 229, 28, 4, 0x1a1030); for (let x = 522; x < 558; x += 9) p.r(x, 226, 1, 16, 0x5a5470);
  p.r(526, 198, 3, 30, 0x4a2e1e); p.r(551, 198, 3, 30, 0x4a2e1e); p.peak(540, 198, 44, 10, 0x2a2044); p.r(538, 206, 1, 14, 0x6a5a6a); p.r(536, 220, 5, 4, 0x6a4430);
};

const SETS: Record<Backdrop, Draw> = { notice, tavern, gates, rain, campfire, smoke, office, market, graves };
export const BACKDROPS = Object.keys(SETS) as Backdrop[];

export function drawBackdrop(b: Batcher, S: Sprites, kind: Backdrop, tick: number): void {
  b.setClip(0, 0, VIEW_W, SCENE_H); // lights and rain may spill; the text panel below stays clean
  SETS[kind](new Pen(b, S, tick));
  b.clearClip();
}
