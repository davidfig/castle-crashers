// GHOUL — Haunted Keep scuttler. Gaunt grey-green, stooped, long dragging claw arms, tattered burial shroud, gaping mouth.
// Poses: walk (scuttle), idle, windup (claws raised and spread), strike (raking swipe), hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, stepLeg, line } from '../lib.mjs';

const palette = { l: G.lead, e: G.lead, ...G, k: '#3b4a3c', K: '#6f8466', J: '#9db08c', x: '#e8e4c8' };
const post = { ink: 'l', all: true };

const head = rows(`
  .kKKk
  kKYKK
  kKKKK
  .kRRK
`);
const headOpen = rows(`
  .kKKk
  kKYKK
  kRRRR
  .kRRK
`);
const headHurt = rows(`
  .kKKk
  kKlKK
  kKKKK
  .kRKK
`);
const torso = rows(`
  .kKKKk
  kKKwwK
  kwwWwk
  kwWwwk
  .w.ww.
`);
const leg = rows(`
  K.
  K.
  KK
`);
const parts = { head, headOpen, headHurt, torso, leg };
// a long arm: a 1px line shoulder -> hand, with three claws fanned at the tip
const arm = (sx, sy, hx, hy, col = 'K', dark = 'k') => (put) => {
  line([sx, sy + 1], [hx - 1, hy], dark)(put);
  line([sx, sy], [hx, hy], col)(put);
  const dx = hx - sx, dy = hy - sy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const px = -uy, py = ux;
  for (const k of [-1, 0, 1]) put(Math.round(hx + ux * 1.5 + px * k), Math.round(hy + uy * 1.5 + py * k), 'x');
};
const OX = 3;
const lg = (side, foot, lift = 0) => { const k = `leg${side}${foot}_${lift}`; if (!parts[k]) parts[k] = stepLeg(leg, foot, lift); return k; };
const frames = {};
const pose = (name, o = {}) => {
  const { bob = 0, lean = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, hp = 'head', back = [14, 11], front = [16, 11] } = o;
  const X = OX + lean;
  frames[name] = [
    arm(OX + lean + 9, 6 + bob, OX + back[0], back[1], 'K', 'k'),
    [lg('B', lb, lbl), X + 5, 10], [lg('F', lf, lfl), X + 8, 10],
    ['torso', X + 4, 5 + bob],
    [hp, X + 8 + hx, 2 + bob + hy],
    arm(X + 10, 7 + bob, OX + front[0], front[1], 'J', 'K'),
  ];
};
pose('bare', {});
pose('walk0', { bob: 1, lf: 1, lb: -1, back: [13, 11], front: [16, 10] });
pose('walk1', { bob: 0, lfl: 1, front: [15, 11], back: [14, 11] });
pose('walk2', { bob: 1, lf: -1, lb: 1, back: [16, 10], front: [13, 11] });
pose('walk3', { bob: 0, lbl: 1, front: [14, 11], back: [15, 11] });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, front: [16, 12], back: [14, 12] });
pose('windup0', { lean: -1, bob: 0, hx: -1, hy: -1, hp: 'headOpen', front: [17, 3], back: [12, 2], lf: -1, lb: 1 });
pose('windup1', { lean: -1, bob: 0, hx: -1, hy: -1, hp: 'headOpen', front: [18, 1], back: [11, 0], lf: -1, lb: 1 });
pose('strike0', { lean: 2, bob: 1, hx: 1, hp: 'headOpen', front: [20, 7], back: [18, 5], lf: 2, lb: -1 });
pose('strike1', { lean: 1, bob: 2, hx: 1, hy: 1, hp: 'headOpen', front: [18, 12], back: [17, 10], lf: 1, lb: -1 });
pose('hurt0', { lean: -1, bob: 1, hx: -1, hy: 1, hp: 'headHurt', front: [13, 9], back: [11, 10] });
// corpse: a sprawled heap, drawn by hand
const corpse = rows(`
  ..kKKk.........
  .kKwwwKkkk.....
  kKwWwwKKKKKKkx.
  kwwwKKKkkkkkKxx
  .kkkkkkkkKKkKxx
`);
parts.corpse = corpse;
frames.dead0 = [['corpse', 4, 8]];

export default {
  name: 'ghoul', title: 'Ghoul', notes: 'Haunted Keep scuttler; claws paralyse. Body poses only.',
  cell: [24, 14], shadow: [9, 3], pivot: [12, 12], palette, post, parts, frames,
  derived: {},
  anims: {
    walk: { fps: 10, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead0'] },
  },
};
