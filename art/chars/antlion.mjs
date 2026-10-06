// ANTLION — a huge antlion larva: a squat armoured russet beetle-grub, its segmented abdomen half-sunk in a dug crater rim, a heavy
// thorax and a small head with two tiny eyes, and enormous curved dark-grey mandibles held open like a trap. It is a caster that
// keeps its distance and digs sand pits under heroes: windup = the mandibles heave up and a fan of sand sprays (the digging).
// Poses: walk (a scuttling crawl, rim following), idle, windup, cast (alias of the dig, mandibles snapped wide), hurt, dead (flipped).
import { GLASS as G } from '../palette.mjs';
import { limb } from '../lib.mjs';

// u r R S = russet shell (deep, mid, lit, bright rim), d = the pit's dark, m M n = mandible (dark, mid, lit), e = eyes, w = flung sand
const palette = { l: G.lead, ...G, u: '#3e1c0e', r: '#7a3418', R: '#a85220', S: '#c87a38', d: '#241008', m: '#322c30', M: '#625658', n: '#9a8c88', e: '#e8d890', w: '#d8a85c', t: '#5a2c14' };
const post = { ink: 'l', all: true };

/** shaded ellipse: upper-left light, ramp of 4 */
const ell = (put, cx, cy, rx, ry, ramp = 'urRS', bias = 0) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    const l = -0.55 * nx - 0.8 * ny + bias;
    put(x, y, ramp[l > 0.55 ? 3 : l > 0.0 ? 2 : l > -0.55 ? 1 : 0]);
  }
};
const crater = (put, sh = 0) => {
  // the dug pit: a dark hollow with a heaped russet rim in front, so the half-sunk body sits inside it
  ell(put, 16, 21, 15, 4.2, 'ddut', 0);
  for (let x = 2; x <= 30; x++) { const y = 24 - Math.round(Math.sqrt(Math.max(0, 1 - ((x - 16) / 15) ** 2)) * 3.5); put(x, y + 1, 'r'); put(x, y + 2, x % 3 ? 'u' : 'r'); }
};
const body = (put, o) => {
  const { bob = 0, crawl = 0, lowered = 0 } = o;
  const by = bob + lowered;
  // abdomen segments, back to front, each a lit dome with a dark seam
  ell(put, 6, 18 + by, 5, 4, 'urRr');
  ell(put, 11, 16.5 + by, 5.5, 5, 'urRS');
  ell(put, 17.5, 15 + by, 6, 5.5, 'urRS', 0.1);   // thorax
  for (const [x, y0, y1] of [[8, 14, 20], [13, 12, 19]]) for (let y = y0; y <= y1; y++) put(x + (y > 17 ? 0 : 0), y + by, 'u');
  // armour studs along the back
  for (const [x, y] of [[5, 15], [10, 12], [15, 10], [19, 10]]) put(x, y + by, 'S');
  // head
  ell(put, 23, 15 + by, 3.8, 3.4, 'urRS');
  put(25, 14 + by, 'e'); put(25, 15 + by, 'd'); put(23, 13 + by, 'e'); put(22, 14 + by, 'd');
  // scuttling legs under the thorax, spiky
  const L = [[14, 19, 12 + crawl, 22], [18, 19, 20 - crawl, 22], [21, 18, 24 + crawl, 21]];
  for (const [x0, y0, x1, y1] of L) { limb([[x0, y0 + by], [(x0 + x1) / 2, y1 - 1], [x1, y1]], { w: 1, body: 'm' })(put); }
};
/** the two mandibles: arcs from the head, `open` spreads them, `up` swings the whole pair upward */
const jaws = (put, o) => {
  const { open = 0, up = 0, bob = 0, lowered = 0 } = o;
  const by = bob + lowered;
  const hx = 25, hy = 14 + by;
  const upper = [[hx, hy - 2], [hx + 4, hy - 5 - open - up], [hx + 9, hy - 6 - open - up * 1.4], [hx + 11, hy - 3 - open * 0.5 - up * 1.2]];
  const lower = [[hx, hy + 2], [hx + 4, hy + 4 + open - up], [hx + 9, hy + 5 + open - up * 0.8], [hx + 11, hy + 2 + open * 0.5 - up * 0.9]];
  for (const pts of [lower, upper]) {
    limb(pts.slice(0, 2), { w: 3, body: 'm', hi: 'M', lo: 'd' })(put);
    limb(pts.slice(1, 3), { w: 2, body: 'm', hi: 'M', lo: 'd' })(put);
    limb(pts.slice(2), { w: 2, body: 'M', hi: 'n', lo: 'm' })(put);
    const tip = pts[3]; put(Math.round(tip[0]), Math.round(tip[1]) - 1, 'n');
  }
  // inner teeth on each blade
  for (const [dx, dy] of [[5, -3], [8, -4]]) put(hx + dx, hy + dy - open - up + 3, 'n');
};
const spray = (pts) => (put) => { for (const [x, y, c = 'w'] of pts) put(x, y, c); };

const frames = {};
const pose = (name, o = {}) => {
  const f = [(put) => crater(put), (put) => body(put, o), (put) => jaws(put, o)];
  if (o.sand) f.push(spray(o.sand));
  frames[name] = f;
};
pose('walk0', { bob: 0, crawl: 1 });
pose('walk1', { bob: 1, crawl: 0, open: 1 });
pose('walk2', { bob: 0, crawl: -1 });
pose('walk3', { bob: 1, crawl: 0, open: 1 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, open: 1 });
// windup: sinks and heaves, jaws swung high and wide scooping sand, a fan of grains thrown up and back
pose('windup0', { lowered: 1, open: 1, up: 2, sand: [[26, 6], [30, 4], [33, 7], [28, 2], [35, 5]] });
pose('windup1', { lowered: 2, open: 2, up: 4, sand: [[27, 2], [31, 0], [35, 3], [24, 1], [33, 9], [37, 6], [29, 7], [22, 4]] });
pose('cast0', { lowered: 1, open: 3, up: 1, sand: [[30, 10], [34, 12], [32, 17]] });
pose('cast1', { lowered: 1, open: 4, up: 0, sand: [[31, 9], [35, 11], [33, 18], [29, 20]] });
pose('hurt0', { bob: 1, lowered: 1, open: 3, sand: [[10, 8], [14, 6], [20, 7]] });
// corpse: the shell rolled belly-up, legs curled, mandibles slack in the sand
const corpse = (put) => {
  ell(put, 16, 22, 14, 3.5, 'ddut');
  ell(put, 10, 19, 6, 3, 'turr'); ell(put, 16, 19, 6, 3.2, 'turr'); ell(put, 22, 19.5, 4, 3, 'turr');
  for (const x of [7, 13, 19]) for (let y = 17; y <= 21; y++) put(x, y, 'd');
  for (const [x0, x1] of [[9, 7], [14, 13], [19, 20], [23, 25]]) limb([[x0, 18], [(x0 + x1) / 2, 15], [x1, 16]], { w: 1, body: 'm' })(put);
  limb([[25, 20], [30, 21], [34, 19]], { w: 2, body: 'm', hi: 'M' })(put);
  limb([[25, 22], [29, 23], [33, 23]], { w: 2, body: 'm', hi: 'M' })(put);
};
frames.dead0 = [corpse];

export default {
  name: 'antlion', title: 'Antlion', notes: 'Caster that digs sand pits. Russet shell half-sunk in its own crater, huge grey mandibles. windup = jaws heaved up with sand spray; cast = jaws snapped wide.',
  cell: [38, 27], shadow: [14, 3], pivot: [19, 24], palette, post, parts: {}, frames,
  derived: {},
  anims: {
    walk: { fps: 4, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 2, frames: ['idle0', 'idle1'] },
    windup: { fps: 2, frames: ['windup0', 'windup1'] },
    cast: { fps: 3, frames: ['cast0', 'cast1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead0'] },
  },
};
