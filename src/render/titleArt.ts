// The title screen (docs/13-ui-art.md): a dusk over a hill, the keep with its windows lit, a horde of small dark figures
// crossing the field below it, and the name on a gold-edged plaque. Drawn from rectangles at runtime like the hub sets.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_H, VIEW_W } from '../sim/constants';
import { MOBS } from '../data/mobs';
import { TITLE_TAG } from '../data/title';
import { storyWidth } from '../data/storyFont';
import type { Sprites } from './art';
import { drawStory } from './ui';
import { GLASS } from './uiArt';

const HORIZON = 232;

const h01 = (n: number): number => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

function sky(b: Batcher, S: Sprites, tick: number): void {
  const r = (x: number, y: number, w: number, h: number, c: number, a = 1): void => b.drawScaled(S.px, x, y, w, h, hex(c, a));
  const bands = [0x0e0a20, 0x140e2c, 0x1c1238, 0x2a1a48, 0x4a2450, 0x7a3558, 0xb0504f, 0xd8803a];
  const bh = HORIZON / bands.length;
  bands.forEach((c, i) => r(0, Math.round(i * bh), VIEW_W, Math.ceil(bh) + 1, c));
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(h01(i * 3) * VIEW_W), y = Math.floor(h01(i * 3 + 1) * HORIZON * 0.55);
    const big = i % 4 === 0; // a few stars are 2x2 pixels, the rest single pixels
    const flash = (tick >> 4) % 5 === i % 5; // a slow twinkle: the star swells into a plus
    const a = 0.45 + h01(i * 3 + 2) * 0.55;
    r(x, y, big ? 2 : 1, big ? 2 : 1, 0xfff0d0, a);
    if (flash) { r(x - 1, y, 4, big ? 2 : 1, 0xfff0d0, 0.5); r(x, y - 1, big ? 2 : 1, big ? 4 : 3, 0xfff0d0, 0.5); }
  }
  r(512, 40, 22, 22, 0xf4ead2); r(518, 36, 10, 30, 0xf4ead2); r(508, 44, 30, 14, 0xf4ead2); // the moon, a blocky disc
  r(520, 46, 5, 5, 0xcfc09f); r(527, 53, 4, 4, 0xcfc09f);
}

function keep(b: Batcher, S: Sprites, tick: number): void {
  const r = (x: number, y: number, w: number, h: number, c: number, a = 1): void => b.drawScaled(S.px, x, y, w, h, hex(c, a));
  const far = 0x2a1a44, wall = 0x1a1030, edge = 0x241a40;
  // far hills
  for (let x = 0; x < VIEW_W; x += 4) r(x, HORIZON - 14 - Math.round(Math.sin(x * 0.02) * 8 + Math.sin(x * 0.07) * 3), 4, 40, far);
  // the keep: a hill, a curtain wall, two towers and a tall donjon with a banner
  for (let y = 0; y < 34; y++) { const half = 130 + y * 3; r(320 - half, 198 + y, half * 2, 1, wall); }
  r(210, 178, 220, 34, wall);
  for (let x = 210; x < 430; x += 14) r(x, 172, 8, 8, wall); // crenellations
  for (const tx of [196, 418]) {
    r(tx, 150, 26, 62, wall); r(tx, 150, 2, 62, edge);
    for (let x = tx - 2; x < tx + 26; x += 10) r(x, 144, 6, 8, wall);
    r(tx + 11, 168, 4, 10, 0xefbd44);
  }
  r(296, 150, 48, 62, wall); r(296, 150, 2, 62, edge);
  for (let x = 294; x < 346; x += 12) r(x, 142, 7, 9, wall);
  const wave = Math.round(Math.sin(tick * 0.12) * 2);
  for (const tx of [196, 418]) { // a banner on each tower
    r(tx + 12, 122, 2, 26, wall);
    r(tx + 14, 123, 16 + wave, 7, GLASS.R); r(tx + 14, 130, 12 + wave, 3, GLASS.R); r(tx + 14, 123, 16 + wave, 1, GLASS.q);
  }
  // the gate and the lit windows (they flicker)
  r(308, 186, 24, 26, 0x080414); r(310, 182, 20, 6, 0x080414); r(313, 190, 14, 22, 0xd8803a, 0.55);
  const lit = [[308, 158], [326, 158], [317, 174], [304, 190], [334, 190], [206, 164], [428, 164], [250, 188], [376, 188]];
  // each window stays lit; a torch inside makes its glow breathe at its own rate
  lit.forEach(([x, y], i) => {
    const fl = 0.5 + 0.28 * Math.sin(tick * (0.11 + (i % 4) * 0.025) + i * 2.1) + 0.22 * Math.sin(tick * 0.37 + i * 5.3);
    r(x - 4, y - 4, 12, 15, 0xd8561e, 0.05 + 0.07 * fl);
    r(x - 2, y - 2, 8, 11, 0xf0922a, 0.1 + 0.12 * fl);
    r(x - 1, y - 1, 6, 9, 0xffc25a, 0.16 + 0.16 * fl);
    r(x, y, 4, 7, fl > 0.55 ? 0xffd566 : 0xefbd44);
    r(x + 1, y + 1, 2, 3, 0xfff0a0, 0.4 + 0.5 * fl);
  });
  r(302, 184, 36, 30, 0xd8803a, 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(tick * 0.2))); // the gate's torchlight spilling out
  // the field, lightest at the horizon so the horde reads against it as silhouettes
  [0x44305a, 0x38284e, 0x2c1f42, 0x221836].forEach((c, k) => r(0, HORIZON + k * 32, VIEW_W, k === 3 ? VIEW_H : 32, c));
  for (let x = 0; x < VIEW_W; x += 8) r(x, HORIZON - 1 - Math.round(h01(x) * 2), 8, 3, 0x44305a);
}

/** The party behind the keep's walls: each class is a flat silhouette in its idle loop, feet hidden behind the parapet so only the top of it shows over the wall and between the merlons. */
function guards(b: Batcher, S: Sprites, tick: number): void {
  // [class index (CLASSES order), x, top of the merlons in front]: archer and mage behind the towers, the others behind the curtain wall
  const posts = [[4, 209, 144], [1, 431, 144], [0, 268, 172], [2, 372, 172], [3, 240, 172]];
  posts.forEach(([c, x, y], k) => {
    const H = S.heroes[c];
    if (!H) return;
    const frames = H.anims[0].idle.frames;
    const f = frames[((tick >> 4) + k) % frames.length];
    const flip = x > VIEW_W / 2;
    const feet = y + Math.round(H.top * 0.55); // feet below the merlon tops: a little under half of the body shows over the wall
    b.drawScaled(f, x - (flip ? f.w - 1 - H.pivotX : H.pivotX), feet - H.pivotY, f.w, f.h, hex(0x0a0614), flip, -1);
  });
}

/** Who walks in each depth: small enemies far off at the foot of the keep, the big ones near (MobType, data/mobs.ts). Real sizes, 1x: depth is shade, rank and who is in it. */
const POOLS = [[0, 0, 0, 6, 7, 2], [0, 1, 2, 3, 6, 1], [1, 10, 1, 3, 10, 1]];

/** A horde crossing the field left to right, as the game's own walk cycles flattened to one colour per rank (batcher flash -1), all at 1x. */
function horde(b: Batcher, S: Sprites, tick: number): void {
  // ten ranks, back to front, the far ones right at the foot of the keep: nearer ranks are darker, walk faster (parallax, on top of each mob's own speed), thinner, and made of bigger enemies
  const ranks = Array.from({ length: 10 }, (_, k) => {
    const t = k / 9, ch = (hi: number, lo: number): number => Math.round(hi + (lo - hi) * t);
    return { y: HORIZON + 6 + k * 12, col: (ch(0x2a, 0x06) << 16) | (ch(0x1e, 0x03) << 8) | ch(0x42, 0x0f), pool: POOLS[Math.min(2, Math.floor(k / 3.4))], n: Math.round(40 - k * 3.5), speed: 0.7 + k * 0.1 };
  });
  ranks.forEach((rk, row) => {
    for (let i = 0; i < rk.n; i++) {
      const type = rk.pool[Math.floor(h01(row * 53 + i * 11) * rk.pool.length)];
      const walk = S.mob[type];
      // each mob walks at its in-game speed (px/tick), times a rank factor for parallax; its steps follow the ground it covers
      const v = MOBS[type].speed * rk.speed;
      const f = walk[(Math.floor((tick * v) / 4.5) + i) % walk.length] ?? walk[0];
      const span = VIEW_W + 80;
      const x = ((h01(row * 99 + i) * span + tick * v) % span) - 40;
      const bob = Math.round(Math.abs(Math.sin(tick * 0.15 + i * 1.7)));
      const top = rk.y - f.h - bob;
      b.drawScaled(f, Math.round(x - f.w / 2), top, f.w, f.h, hex(rk.col), false, -1);
      if (h01(row * 17 + i * 5) < 0.05) { // a few carry a banner: a pole at the front hand and a cloth streaming back, both in the rank's silhouette shade
        const poleX = Math.round(x + f.w * 0.25), poleTop = top - 11, cw = 9, ch = 5;
        b.drawScaled(S.px, poleX, poleTop, 1, Math.round(top + f.h * 0.45 - poleTop), hex(rk.col));
        for (let c = 0; c < cw; c++) { // the cloth, a column at a time, rippling more toward its free end
          const ripple = Math.round(Math.sin(tick * 0.2 + c * 0.7 + i) * (c / cw) * 1.5);
          b.drawScaled(S.px, poleX - c - 1, poleTop + ripple, 1, Math.max(1, Math.round(ch * (1 - c / (cw * 1.6)))), hex(rk.col));
        }
      }
    }
  });
}

/** `tick` drives the sky, the banner, the horde and the prompt blink. */
export function drawTitle(b: Batcher, S: Sprites, tick: number): void {
  if (!(tick > 0)) tick = 0; // a first frame can arrive with a NaN or negative tick; the animation indices below need a non-negative one
  sky(b, S, tick);
  guards(b, S, tick); // before the keep, so its wall and merlons are drawn over them
  keep(b, S, tick);
  horde(b, S, tick);
  // the plaque, fitted to the lettering (a sprite on the game's pixel grid, see uiArt buildLogo)
  const logo = S.ui.logo, pw = logo.w + 30, ph = logo.h + 20, px = Math.round((VIEW_W - pw) / 2), py = 12;
  b.drawScaled(S.px, px - 3, py + 4, pw + 6, ph, hex(0x000000, 0.35));
  // a thick gold-leaf frame: lead outline, a two-pixel gold band between darker gold rules, a lead line, then the ink face
  const ring = (inset: number, c: number): void => b.drawScaled(S.px, px + inset, py + inset, pw - inset * 2, ph - inset * 2, hex(c));
  ring(0, GLASS.lead); ring(1, GLASS.g); ring(2, GLASS.G); ring(4, GLASS.g); ring(5, GLASS.lead); ring(6, GLASS.ink);
  b.drawScaled(S.px, px + 2, py + 2, pw - 4, 1, hex(GLASS.Y)); // a highlight along the top edge
  for (const [cx, cy] of [[1, 1], [pw - 8, 1], [1, ph - 8], [pw - 8, ph - 8]]) { // a stud at each corner
    b.drawScaled(S.px, px + cx, py + cy, 7, 7, hex(GLASS.lead));
    b.drawScaled(S.px, px + cx + 1, py + cy + 1, 5, 5, hex(GLASS.G));
    b.drawScaled(S.px, px + cx + 2, py + cy + 2, 3, 3, hex(GLASS.Y));
  }
  b.draw(logo, px + Math.round((pw - logo.w) / 2), py + Math.round((ph - logo.h) / 2));
  const ribbon = Math.round(storyWidth(TITLE_TAG)) + 28, rx = Math.round((VIEW_W - ribbon) / 2);
  b.drawScaled(S.px, rx, py + ph + 3, ribbon, 14, hex(GLASS.lead));
  b.drawScaled(S.px, rx + 1, py + ph + 4, ribbon - 2, 12, hex(GLASS.r));
  b.drawScaled(S.px, rx + 1, py + ph + 4, ribbon - 2, 1, hex(GLASS.R));
  drawStory(b, S, TITLE_TAG, Math.round((VIEW_W - storyWidth(TITLE_TAG)) / 2), py + ph + 7, GLASS.W);
  const prompt = 'Press attack to begin';
  if ((tick >> 5) % 2 === 0) {
    const w = storyWidth(prompt) + 24, x = Math.round((VIEW_W - w) / 2);
    b.drawScaled(S.px, x, VIEW_H - 32, w, 18, hex(0x000000, 0.55));
    drawStory(b, S, prompt, x + 12, VIEW_H - 28, GLASS.W);
  }
}
