// SPOREBLOAT — a slow, fat, bloated puffball: a swollen sickly yellow-green gas-bag (~12px across) on two stubby legs,
// studded with dark spore pores ringed in pale crust, a few beady eyes low on the face side (right). Faces right.
// windup = swells fat and the pores flare, puffing spores; strike = the belly-flop slam forward; dead = a slack, deflated
// wrinkled sack on the ground (it bursts into a spore cloud, which the game draws). Procedural blobs (hand-placed pixels).
import { GLASS as G } from '../palette.mjs';

// h = lit crust, g = body, a = shade, d = deep shade, k = pore, c = pore rim (pale), w = spore dust, e = eye
const palette = { l: G.lead, ...G, h: '#e2e266', g: '#b4bc34', a: '#80902a', d: '#566a24', k: '#2a3414', c: '#f0f0b0', w: '#e8f0a0', e: '#fff0a0', t: '#a8802c' };
const post = { ink: 'l', all: true };

/** An elliptical blob: lit upper-left, shaded lower-right. pores = [[x,y],...] (single dark pixel with a pale rim above-left). */
function blob(w, h, pores = [], eyes = [], bumps = []) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - cx) / (w / 2), ny = (y + 0.5 - cy) / (h / 2);
    if (nx * nx + ny * ny > 1.02) continue;
    const t = -(nx * 0.7 + ny * 0.7);
    g[y][x] = t > 0.5 ? 'h' : t < -0.55 ? 'd' : t < -0.1 ? 'a' : 'g';
  }
  const set = (x, y, c) => { if (g[y]?.[x] !== undefined && g[y][x] !== '.') g[y][x] = c; };
  for (const [x, y] of pores) { set(x, y, 'k'); set(x + 1, y, 'k'); set(x, y - 1, 'c'); set(x + 1, y - 1, 'c'); set(x - 1, y, 'c'); set(x - 1, y - 1, 'c'); set(x + 2, y, 'a'); }
  for (const [x, y] of eyes) { set(x, y, 'e'); set(x + 1, y, 'l'); set(x, y + 2, 'e'); set(x + 1, y + 2, 'l'); }
  for (const [x, y] of bumps) if (g[y]?.[x] !== undefined) g[y][x] = 'c';
  return g.map((r) => r.join(''));
}
const body = blob(12, 10, [[3, 3], [6, 1], [4, 6], [2, 8]], [[8, 4]]);
const bodyBig = blob(14, 12, [[3, 3], [7, 1], [4, 7], [2, 9], [8, 9]], [[9, 4]]);
const bodyHuge = blob(15, 13, [[3, 3], [7, 1], [4, 7], [2, 10], [8, 10], [11, 9]], [[10, 4]]);
const bodySlam = blob(15, 8, [[3, 2], [7, 1], [5, 5]], [[10, 2]]);
const bodySquish = blob(13, 9, [[3, 3], [6, 1], [4, 6]], [[9, 3]]);
const bodyHurt = blob(12, 9, [[3, 3], [6, 1], [4, 6]], []);
// spore puffs: loose pale dots around a swollen body
const puff = ['.w..w.', 'w....w', '..w...'];
const deadBody = [
  '...gghggg....',
  '.ghhgggagga..',
  'ahgkkgagaggda',
  'aggcagakkagga',
  'dddaaddaddddd',
].map((r) => r.padEnd(14, '.'));
const legA = ['tt.', 'tt.', 'ttt'];
const legB = ['.tt', '.tt', 'ttt'];
const legGround = ['.'];
const parts = { body, bodyBig, bodyHuge, bodySlam, bodySquish, bodyHurt, deadBody, puff, legA, legB, legGround };
const frames = {};
// the body is anchored by its top-left (bx, by); stubby feet always at ground row 14
function pose(name, { b = 'body', bx = 6, by = 3, lx = 0, rx = 0, ll = 0, extra = [] } = {}) {
  frames[name] = [
    ['legGround', 12, 14],
    ['legA', 7 + lx, 12 - ll], ['legB', 12 + rx, 12],
    [b, bx, by], ...extra,
  ];
}
pose('walk0', { by: 4, lx: -1, rx: 1 });
pose('walk1', { by: 3 });
pose('walk2', { by: 4, lx: 1, rx: -1, ll: 0 });
pose('walk3', { by: 3 });
pose('idle0', { by: 3 });
pose('idle1', { b: 'bodySquish', bx: 5, by: 4 });
pose('windup0', { b: 'bodyBig', bx: 5, by: 2, extra: [['puff', 4, 0]] });
pose('windup1', { b: 'bodyHuge', bx: 4, by: 1, extra: [['puff', 3, 0], ['puff', 14, 1]] });
pose('strike0', { b: 'bodySlam', bx: 9, by: 5, lx: 2, rx: 3 });
pose('strike1', { b: 'bodySquish', bx: 8, by: 4, lx: 1, rx: 2 });
pose('hurt0', { b: 'bodyHurt', bx: 4, by: 5, lx: -1, rx: -1 });
frames.deadf = [['deadBody', 6, 9]];

export default {
  name: 'sporebloat', title: 'Sporebloat', notes: 'Bloated spore-gas fungus. Swells on windup; bursts into a spore cloud on death (game draws it).',
  cell: [26, 17], shadow: [9, 3], pivot: [13, 14], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 6, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['deadf'] },
  },
};
