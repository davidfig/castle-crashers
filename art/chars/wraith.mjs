// WRAITH — hooded floating spectre. Pale blue/violet tatters trailing into wisps (no legs), a hollow face with two pale eyes,
// a spectral scythe baked into every pose. It hovers ~3px above the ground line (there are no leg* parts, so the pivot is
// set by hand and the game's shadow sits below the wisps). Poses: walk (drift), idle, windup (rears back, fading), strike (slash), hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, line } from '../lib.mjs';

const palette = { l: G.lead, e: G.lead, ...G, p: '#3b3470', P: '#6a62b4', u: '#9cb0ec', U: '#dce6ff', d: '#262048', y: '#8f98b8' };
const post = { ink: 'l', all: true };

const hood = rows(`
  ..pPPPp.
  .pPPPPPp
  pPPllllP
  pPPlUlUP
  pPPllllP
  .pPPPPp.
`);
const hoodHurt = rows(`
  ..pPPPp.
  .pPPPPPp
  pPPllllP
  pPPlllUP
  pPPllllP
  .pPPPPp.
`);
const robe = rows(`
  ..pPPPPp..
  .pPPuPPPp.
  .pPPPPuPp.
  pPPPuPPPPp
  pPPPPPPuPp
`);
const wispA = rows(`
  pP.pP.Pp.p
  .p..P..p..
  ...p......
`);
const wispB = rows(`
  .pP.pP.Pp.
  p..p..P...
  ......p...
`);
const wispC = rows(`
  pP..pP.pP.
  .p.P....p.
  ..p...p...
`);
const fade = (r) => r.map((s) => s.replace(/P/g, 'u').replace(/p/g, 'P'));
const parts = { hood, hoodHurt, robe, wispA, wispB, wispC };
for (const k of ['hood', 'robe', 'wispA', 'wispB', 'wispC']) parts[k + 'F'] = fade(parts[k]);

// a long-handled spectral scythe: staff from the hand along `ang`, blade swept forward off the far end
const scythe = (hx, hy, ang, len = 9) => (put) => {
  const a = (ang * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  const bx = (ang + 90) * Math.PI / 180, vx = Math.cos(bx), vy = Math.sin(bx);
  const sx = hx - ux * 3, sy = hy - uy * 3, tx = hx + ux * len, ty = hy + uy * len;
  line([sx, sy], [tx, ty], 'y')(put);
  const m = [tx + vx * 3, ty + vy * 3], e = [tx + vx * 4 - ux * 3, ty + vy * 4 - uy * 3];
  line([tx, ty], m, 'X')(put);
  line([tx, ty + 1], [m[0], m[1] + 1], 'X')(put);
  line(m, e, 'U')(put);
  line([m[0], m[1] + 1], [e[0], e[1] + 1], 'X')(put);
  put(Math.round(tx - ux), Math.round(ty - uy), 'X');
};
const arm = (sx, sy, hx, hy, col) => (put) => { line([sx, sy], [hx, hy], col)(put); put(hx, hy, 'U'); };

const frames = {};
const pose = (name, o = {}) => {
  const { bob = 0, lean = 0, hx = 0, hy = 0, w = 'A', hp = 'hood', ang = -80, hand = [11, 9], back = [4, 10], f = '' } = o;
  const X = 3 + lean, Y = 2 + bob;
  frames[name] = [
    arm(X + 4, Y + 6, 3 + back[0] + lean, Y + back[1], 'p'),
    [`wisp${w}${f}`, X, Y + 10],
    ['robe' + f, X, Y + 5],
    scythe(3 + hand[0] + lean, Y + hand[1], ang),
    arm(X + 7, Y + 6, 3 + hand[0] + lean, Y + hand[1], 'P'),
    [hp === 'hood' ? 'hood' + f : hp, X + 1 + hx, Y + hy],
  ];
};
pose('walk0', { bob: 1, w: 'A' });
pose('walk1', { bob: 0, w: 'B', lean: 0 });
pose('walk2', { bob: -1, w: 'C' });
pose('walk3', { bob: 0, w: 'B' });
pose('idle0', { bob: 0, w: 'A' });
pose('idle1', { bob: 1, w: 'C' });
pose('windup0', { bob: 0, lean: -1, hx: -1, hy: -1, w: 'B', ang: -125, hand: [11, 6], back: [-1, 4], f: '' });
pose('windup1', { bob: -1, lean: -2, hx: -1, hy: -1, w: 'C', ang: -150, hand: [10, 4], back: [-3, 3], f: 'F' });
pose('strike0', { bob: 1, lean: 2, hx: 1, w: 'A', ang: -20, hand: [14, 6], back: [7, 5] });
pose('strike1', { bob: 1, lean: 2, hx: 1, hy: 1, w: 'B', ang: 50, hand: [14, 9], back: [8, 8] });
pose('hurt0', { bob: 1, lean: -1, hx: -1, hy: 1, hp: 'hoodHurt', w: 'C', ang: -110, hand: [11, 9], back: [3, 8], f: 'F' });
// corpse: the empty robe slumped on the ground, hood flat on top, the scythe dropped beside it
parts.corpse = rows(`
  ..ppPPPp........
  .pPPllUPPPpp....
  pPPuPPPPuPPPpppX
  .pPPPuPPPPuPPPUX
  ..pp.pPP.pPP.p..
`);
frames.dead0 = [['corpse', 3, 13]];

export default {
  name: 'wraith', title: 'Wraith', notes: 'Hovering spectre (no legs: pivot set by hand; wisps end ~3px above the ground line).',
  cell: [22, 19], shadow: [8, 3], pivot: [11, 17], palette, post, parts, frames,
  derived: {},
  anims: {
    walk: { fps: 6, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead0'] },
  },
};
