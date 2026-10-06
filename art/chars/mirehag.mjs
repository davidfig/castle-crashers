// MIRE HAG — a hunched bog witch (~18px): stringy hair like straw marsh-grass, a tattered green-grey shawl with a ragged hem, a long
// hooked nose and long grasping fingers, a gnarled staff whose hook holds a swinging purple hex-charm. Caster: windup = both arms
// thrown up, staff lifted high, mouth open (the hex telegraph); cast = staff slammed down toward the target.
import { GLASS as G } from '../palette.mjs';
import { rows, limb } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// h/H = sickly green skin, y/Y/x = marsh-grass hair, s/S/z = shawl, u/U = staff wood, v/V = hex-charm purple
const palette = { l: G.lead, e: G.lead, ...G, h: '#8fae6a', H: '#c4d98e', y: '#d2bc5c', Y: '#f0e29a', x: '#8c7c3a', s: '#55745a', S: '#8fb08a', z: '#34503c', u: '#6a4a2a', U: '#a87a44', v: '#8a42c0', V: '#cf8cf4', t: '#6e5236' };
const post = { ink: 'l', all: true };

const head = rows(`
  .yYYYy..
  yYYhHHy.
  yxhhlHH.
  yxhHHHHH
  .xhhHHH.
  .x.hhh..
  .x..h...
`);
const headCast = rows(`
  .yYYYy..
  yYYhHHy.
  yxhhlHH.
  yxhHHHHH
  .xhllHH.
  .x.hhh..
  .x..h...
`);
const headHurt = rows(`
  .yYYYy..
  yYYhHHy.
  yxhllHH.
  yxhHHHHH
  .xhhHHH.
  .x.hhh..
  .x..h...
`);
const robe = rows(`
  ..sSSSSs..
  .sSSSSSSs.
  sSSzSSSSSs
  sSSSSSzSSs
  sSzSSSSSSs
  sSSSSSSzSs
  .sSSSzSSs.
  .sSSSSSSs.
  sSzSSSSzSs
  s.sS.sSs.s
`);
const shoe = rows(`
  tU.
  tU.
  tUU
  ttt
`);
const hand = { rows: rows(`
  hH.h
  HHHH
  .hH.
`), ax: 1, ay: 1 };
const staff = { rows: [
  '.UUU.',
  'UU..x',
  'uU..x',
  'uU.vV',
  'uU.vv',
  ...Array(13).fill('uU...'),
], ax: 1, ay: 12 };
const parts = { head, headCast, headHurt, robe, shoe, hand, staff };

function armTo(T, sh, hp, lean, bob) {
  const [sx, sy] = T(sh[0] + lean, sh[1] + bob), [fx, fy] = T(hp[0] + lean, hp[1] + bob);
  return limb([[sx, sy], [Math.round((sx + fx) / 2) + (fx > sx ? 0 : -1), Math.round((sy + fy) / 2) + 1], [fx, fy]], { w: 3, body: 'S', lo: 's' });
}
const rig = robedRig({
  OX: 8, OY: 16, parts, shoe,
  layout: { robe: [3, 5], head: [4, 0], legB: [4, 13], legF: [7, 13], sleeve: null },
  propBack(o, h, { T }) {
    const hp = o.h2 ?? [1, 12];
    return [armTo(T, [4, 7], hp, o.lean ?? 0, o.bob ?? 0), ['hand', ...T(hp[0] + (o.lean ?? 0), hp[1] + (o.bob ?? 0))]];
  },
  prop(o, h, { T }) {
    const hp = o.h ?? [13, 12], l = o.lean ?? 0, b = o.bob ?? 0;
    return [['staff', ...T(hp[0] + l + (o.sx ?? 0), hp[1] + b + (o.sy ?? 0))], armTo(T, [11, 7], hp, l, b), ['hand', ...T(hp[0] + l, hp[1] + b)]];
  },
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, hy: 1 });
pose('windup0', { bob: 0, lean: -1, hx: -1, headPart: 'headCast', h: [12, 4], h2: [3, 4], lf: -1, lb: 1 });
pose('windup1', { bob: -1, lean: -2, hx: -1, hy: -1, headPart: 'headCast', h: [11, -3], h2: [3, -2], lf: -1, lb: 1 });
pose('cast0', { bob: 1, lean: 2, hx: 1, headPart: 'headCast', h: [16, 8], h2: [8, 12], lf: 1, lb: -1 });
pose('cast1', { bob: 1, lean: 3, hx: 2, hy: 1, headPart: 'headCast', h: [18, 12], h2: [9, 12], lf: 1, lb: -1 });
pose('hurt0', { bob: 1, lean: -2, hx: -1, hy: 1, headPart: 'headHurt', h: [11, 13], h2: [0, 11] });
pose('bare', {});

export default {
  name: 'mirehag', title: 'Mire Hag', notes: 'Hunched bog witch with a charm-hung staff. Caster: windup = arms and staff thrown up (the hex telegraph); cast = staff driven down.',
  cell: [36, 36], shadow: [10, 3], pivot: [18, 32], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie' } },
  anims: {
    walk: { fps: 6, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 2, frames: ['idle0', 'idle1'] },
    windup: { fps: 2, frames: ['windup0', 'windup1'] },
    cast: { fps: 3, frames: ['cast0', 'cast1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
