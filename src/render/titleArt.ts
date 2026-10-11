// The title screen (docs/13-ui-art.md): a dusk over a hill, the keep with its windows lit, a horde of small dark figures
// crossing the field below it, and the name on a gold-edged plaque. Drawn from rectangles at runtime like the hub sets.
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_H, VIEW_W } from '../sim/constants';
import { MOBS, isBossType } from '../data/mobs';
import { bestiaryEpoch } from '../data/bestiary';
import { HORIZON, titleLayout } from './titleLayout';
import type { TitleLayout } from './titleLayout';
import { TITLE_TAG } from '../data/title';
import { storyWidth } from '../data/storyFont';
import type { Sprites } from './art';
import { drawStory } from './ui';
import { GLASS } from './uiArt';

const h01 = (n: number): number => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

function sky(b: Batcher, S: Sprites, tick: number, L: TitleLayout): void {
  const r = (x: number, y: number, w: number, h: number, c: number, a = 1): void => b.drawScaled(S.px, x, y, w, h, hex(c, a));
  const bands = [0x0e0a20, 0x140e2c, 0x1c1238, 0x2a1a48, 0x4a2450, 0x7a3558, 0xb0504f, 0xd8803a];
  const bh = HORIZON / bands.length;
  bands.forEach((c, i) => r(0, Math.round(i * bh), VIEW_W, Math.ceil(bh) + 1, c));
  L.stars.forEach(({ x, y, big, a }, i) => { // a few stars are 2x2 pixels, the rest single pixels
    const flash = (tick >> 4) % 5 === i % 5; // a slow twinkle: the star swells into a plus
    r(x, y, big ? 2 : 1, big ? 2 : 1, 0xfff0d0, a);
    if (flash) { r(x - 1, y, 4, big ? 2 : 1, 0xfff0d0, 0.5); r(x, y - 1, big ? 2 : 1, big ? 4 : 3, 0xfff0d0, 0.5); }
  });
  // the moon, a blocky disc of any size, with two craters
  const { x: mx, y: my, s } = L.moon, q = Math.round(s / 4);
  r(mx + q, my, s - q * 2, s, 0xf4ead2); r(mx, my + q, s, s - q * 2, 0xf4ead2); r(mx + Math.round(q / 2), my + Math.round(q / 2), s - q, s - q, 0xf4ead2);
  r(mx + Math.round(s * 0.3), my + Math.round(s * 0.3), Math.max(2, Math.round(s * 0.22)), Math.max(2, Math.round(s * 0.22)), 0xcfc09f);
  r(mx + Math.round(s * 0.62), my + Math.round(s * 0.6), Math.max(2, Math.round(s * 0.17)), Math.max(2, Math.round(s * 0.17)), 0xcfc09f);
}

function keep(b: Batcher, S: Sprites, tick: number, L: TitleLayout): void {
  const r = (x: number, y: number, w: number, h: number, c: number, a = 1): void => b.drawScaled(S.px, x, y, w, h, hex(c, a));
  const wall = 0x1a1030, edge = 0x241a40;
  const K = L.keep, cx = K.cx;
  // two ranges of mountains behind the keep, the far one paler
  L.far.forEach((h, c) => r(c * 4, HORIZON - h, 4, h + 26, 0x2a1a44));
  L.near.forEach((h, c) => r(c * 4, HORIZON - h + 6, 4, h + 20, 0x221538));
  // the keep: a hill, a curtain wall, two towers and a tall donjon with banners
  for (let y = 0; y < 34; y++) { const half = K.hillHalf + y * 3; r(cx - half, 198 + y, half * 2, 1, wall); }
  r(cx - K.wallHalf, K.wallTop, K.wallHalf * 2, 212 - K.wallTop, wall);
  for (let x = cx - K.wallHalf; x < cx + K.wallHalf; x += 14) r(x, K.wallTop - 6, 8, 8, wall); // crenellations
  for (const t of K.turrets) { r(t.x, t.top, 14, K.wallTop - t.top + 2, wall); r(t.x - 1, t.top - 4, 4, 5, wall); r(t.x + 11, t.top - 4, 4, 5, wall); }
  for (const tx of K.towerX) {
    r(tx, K.towerTop, K.towerW, 212 - K.towerTop, wall); r(tx, K.towerTop, 2, 212 - K.towerTop, edge);
    if (K.towerRoof) for (let k = 0; k < K.towerRoof; k++) { const w = Math.max(2, Math.round((K.towerW + 6) * (1 - k / K.towerRoof))); r(tx + Math.round((K.towerW - w) / 2), K.towerTop - k - 1, w, 1, wall); }
    else for (let x = tx - 2; x < tx + K.towerW; x += 10) r(x, K.towerTop - 6, 6, 8, wall);
  }
  r(cx - K.donjonW / 2, K.donjonTop, K.donjonW, 212 - K.donjonTop, wall); r(cx - K.donjonW / 2, K.donjonTop, 2, 212 - K.donjonTop, edge);
  if (K.donjonRoof === 1) {
    const rh = K.donjonTop - K.donjonCap;
    for (let k = 0; k < rh; k++) { const w = Math.max(2, Math.round((K.donjonW + 8) * (1 - k / rh))); r(cx - Math.round(w / 2), K.donjonTop - k - 1, w, 1, wall); }
  } else if (K.donjonRoof === 2) { // a narrower upper tier with its own merlons
    const tw = Math.round(K.donjonW * 0.6), top = K.donjonCap + 8;
    r(cx - tw / 2, top, tw, K.donjonTop - top + 1, wall);
    for (let x = cx - tw / 2 - 1; x < cx + tw / 2; x += 9) r(x, K.donjonCap, 6, 9, wall);
  } else for (let x = cx - K.donjonW / 2 - 2; x < cx + K.donjonW / 2 + 2; x += 12) r(x, K.donjonTop - 8, 7, 9, wall);
  // banners; each catches the wind on its own rate and phase, so they never wave in step
  K.banners.forEach((bn, i) => {
    r(bn.x, bn.top, 2, 26, wall);
    const F = K.flag;
    for (let c = 0; c < F.w; c++) { // the cloth a column at a time, rippling more toward its free end; each pole waves on its own phase
      const dy = Math.round(Math.sin(tick * 0.2 + c * 0.6 + i * 2.3) * (c / F.w) * 1.6);
      for (let y = 0; y < F.h;) {
        const col = F.cells[y * F.w + c];
        let n = 1;
        while (y + n < F.h && F.cells[(y + n) * F.w + c] === col) n++;
        if (col >= 0) r(bn.x + 2 + c, bn.top + 1 + y + dy, 1, n, col);
        y += n;
      }
    }
  });
  // the gate and the lit windows (they flicker)
  const gw = K.gateW, gh = Math.floor(gw / 2);
  r(cx - gh, 186, gw, 26, 0x080414); r(cx - gh + 2, 182, gw - 4, 6, 0x080414); r(cx - gh + 5, 190, gw - 10, 22, 0xd8803a, 0.55);
  // each window stays lit; a torch inside makes its glow breathe at its own rate
  K.windows.forEach(({ x, y }, i) => {
    const fl = 0.5 + 0.28 * Math.sin(tick * (0.11 + (i % 4) * 0.025) + i * 2.1) + 0.22 * Math.sin(tick * 0.37 + i * 5.3);
    r(x - 4, y - 4, 12, 15, 0xd8561e, 0.05 + 0.07 * fl);
    r(x - 2, y - 2, 8, 11, 0xf0922a, 0.1 + 0.12 * fl);
    r(x - 1, y - 1, 6, 9, 0xffc25a, 0.16 + 0.16 * fl);
    r(x, y, 4, 7, fl > 0.55 ? 0xffd566 : 0xefbd44);
    r(x + 1, y + 1, 2, 3, 0xfff0a0, 0.4 + 0.5 * fl);
  });
  r(cx - gh - 6, 184, gw + 12, 30, 0xd8803a, 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(tick * 0.2))); // the gate's torchlight spilling out
  // the field, lightest at the horizon so the horde reads against it as silhouettes
  [0x44305a, 0x38284e, 0x2c1f42, 0x221836].forEach((c, k) => r(0, HORIZON + k * 32, VIEW_W, k === 3 ? VIEW_H : 32, c));
  for (let x = 0; x < VIEW_W; x += 8) r(x, HORIZON - 1 - Math.round(h01(x) * 2), 8, 3, 0x44305a);
}

/** The party behind the keep's walls: each class is a flat silhouette in its idle loop, feet hidden behind the parapet so only the top of it shows over the wall and between the merlons. */
function guards(b: Batcher, S: Sprites, tick: number, L: TitleLayout): void {
  L.posts.forEach(([c, x, y], k) => {
    const H = S.heroes[c];
    if (!H) return;
    const frames = H.anims[0].idle.frames;
    const f = frames[((tick >> 4) + k) % frames.length];
    const flip = x > L.keep.cx;
    const feet = y + Math.round(H.top * 0.55); // feet below the merlon tops: a little under half of the body shows over the wall
    b.drawScaled(f, x - (flip ? f.w - 1 - H.pivotX : H.pivotX), feet - H.pivotY, f.w, f.h, hex(0x0a0614), flip, -1);
  });
}

/** Who walks in each depth, from this run's own cast (the mob randomizer, docs/15): the small enemies far off at the foot of the keep, the big ones near. Bosses never march. */
let poolEpoch = -1;
let pools: number[][] = [[0], [0], [0]];
function mobPools(): number[][] {
  if (poolEpoch === bestiaryEpoch()) return pools;
  poolEpoch = bestiaryEpoch();
  const types = MOBS.map((_, i) => i).filter((i) => !isBossType(i)).sort((a, c) => MOBS[a].radius - MOBS[c].radius);
  const third = Math.ceil(types.length / 3);
  pools = [types.slice(0, third), types.slice(third, third * 2), types.slice(third * 2)].map((p, i) => (p.length ? p : pools[i] ?? [0]));
  return pools;
}

/** A horde crossing the field left to right, as the game's own walk cycles flattened to one colour per rank (batcher flash -1), all at 1x. */
function horde(b: Batcher, S: Sprites, tick: number, L: TitleLayout): void {
  const POOLS = mobPools(), salt = L.seed & 0xffff;
  // ten ranks, back to front, the far ones right at the foot of the keep: nearer ranks are darker, walk faster (parallax, on top of each mob's own speed), thinner, and made of bigger enemies
  const ranks = Array.from({ length: 10 }, (_, k) => {
    const t = k / 9, ch = (hi: number, lo: number): number => Math.round(hi + (lo - hi) * t);
    return { y: HORIZON + 6 + k * 12, col: (ch(0x2a, 0x06) << 16) | (ch(0x1e, 0x03) << 8) | ch(0x42, 0x0f), pool: POOLS[Math.min(2, Math.floor(k / 3.4))], n: Math.round(40 - k * 3.5), speed: 0.7 + k * 0.1 };
  });
  ranks.forEach((rk, row) => {
    for (let i = 0; i < rk.n; i++) {
      const type = rk.pool[Math.floor(h01(row * 53 + i * 11 + salt) * rk.pool.length)];
      const walk = S.mob[type];
      // each mob walks at its in-game speed (px/tick), times a rank factor for parallax; its steps follow the ground it covers
      const v = MOBS[type].speed * rk.speed;
      const f = walk[(Math.floor((tick * v) / 4.5) + i) % walk.length] ?? walk[0];
      const span = VIEW_W + 80;
      const x = ((h01(row * 99 + i + salt) * span + tick * v) % span) - 40;
      const bob = Math.round(Math.abs(Math.sin(tick * 0.15 + i * 1.7)));
      const top = rk.y - f.h - bob + (f.drop ?? 0);
      b.drawScaled(f, Math.round(x - f.w / 2), top, f.w, f.h, hex(rk.col), false, -1);
      if (h01(row * 17 + i * 5 + salt) < 0.05) { // a few carry a banner: a pole at the front hand and a cloth streaming back, both in the rank's silhouette shade
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
/** The blinking prompts spend most of the cycle visible: dark for only 12 of every 64 ticks. */
export const promptOn = (tick: number): boolean => Math.floor(tick) % 64 < 52;

/** What the title's sound and music buttons show; main.ts keeps these current. */
export const titleToggles = { sound: true, music: true };
const TOGGLE_Y = VIEW_H - 32, TOGGLE_H = 18, TOGGLE_MARGIN = 12;
const toggleLabel = (name: string, key: string, on: boolean): string => `${name}: ${on ? 'On' : 'Off'} (${key})`;
/** The two buttons' boxes in view pixels, widest label reserved so a box does not change size when toggled. */
export function titleToggleRects(): { sound: { x: number; y: number; w: number; h: number }; music: { x: number; y: number; w: number; h: number } } {
  const w = (name: string, key: string): number => storyWidth(toggleLabel(name, key, false)) + 16;
  const sw = w('Sound', 'N/LB'), mw = w('Music', 'M/RB');
  return {
    sound: { x: TOGGLE_MARGIN, y: TOGGLE_Y, w: sw, h: TOGGLE_H },
    music: { x: VIEW_W - TOGGLE_MARGIN - mw, y: TOGGLE_Y, w: mw, h: TOGGLE_H },
  };
}

/** The title. `cont`: a saved run can be continued (shown above the prompt, with where it was). */
export function drawTitle(b: Batcher, S: Sprites, tick: number, cont?: string): void {
  if (!(tick > 0)) tick = 0; // a first frame can arrive with a NaN or negative tick; the animation indices below need a non-negative one
  const L = titleLayout();
  sky(b, S, tick, L);
  guards(b, S, tick, L); // before the keep, so its wall and merlons are drawn over them
  keep(b, S, tick, L);
  horde(b, S, tick, L);
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
  const prompt = cont ? 'Press any key for a new run' : 'Press any key to begin';
  if (cont) {
    const line = `C / Y: continue  ${cont.toLowerCase()}`;
    const w = storyWidth(line) + 24, x = Math.round((VIEW_W - w) / 2);
    b.drawScaled(S.px, x, VIEW_H - 54, w, 18, hex(0x000000, 0.7));
    drawStory(b, S, line, x + 12, VIEW_H - 50, GLASS.Y);
  }
  if (promptOn(tick)) {
    const w = storyWidth(prompt) + 24, x = Math.round((VIEW_W - w) / 2);
    b.drawScaled(S.px, x, VIEW_H - 32, w, 18, hex(0x000000, 0.55));
    drawStory(b, S, prompt, x + 12, VIEW_H - 28, GLASS.W);
  }
  const r = titleToggleRects();
  for (const [t, on, name, key] of [[r.sound, titleToggles.sound, 'Sound', 'N/LB'], [r.music, titleToggles.music, 'Music', 'M/RB']] as const) {
    b.drawScaled(S.px, t.x, t.y, t.w, t.h, hex(0x000000, 0.55));
    drawStory(b, S, toggleLabel(name, key, on), t.x + 8, t.y + 4, on ? GLASS.W : GLASS.z);
  }
}
