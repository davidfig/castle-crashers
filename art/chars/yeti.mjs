// YETI — the Frozen Pass's big brute (~20px). Hunched, long-armed, shaggy dark blue-grey fur (dark so it reads on the snow), a tusked jaw,
// huge fists. windup = both fists raised overhead holding a boulder of ice (the lob telegraph), strike = a heavy slam down.
import { GLASS as G } from '../palette.mjs';
import { rows, limb } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// h/H/J = shaggy fur ramp (deep, mid, light), u = frost in the fur, k = a hide wrap, I/i/j = the ice boulder
const palette = { l: G.lead, e: G.lead, ...G, h: '#2a3050', H: '#46527e', J: '#7684b0', u: '#8ec4e8', k: '#6a4a2a', Y: '#ffe070', I: '#c4ecff', i: '#6aaee0', j: '#34609e' };
const post = { ink: 'l', all: true };

const head = rows(`
  .hhHHh..
  hHHHHHH.
  hHlHYHHH
  HHHHHHHH
  WHRRRRHW
  .WHWWHW.
`);
const headRoar = rows(`
  .hhHHh..
  hHHHHHH.
  hHlHYHHH
  HHHHHHHH
  WRRRRRRW
  WWRllRWW
`);
const headHurt = rows(`
  .hhHHh..
  hHHHHHH.
  hHlHllHH
  HHHHHHHH
  WHRRRRHW
  .WHWWHW.
`);
const robe = rows(`
  .hhHHHHhh.
  hHHHHJJHHh
  hHuHHJHHHH
  hHHHHHHHHH
  hHHHHHuHHH
  hHHHHHHHHh
  hHHHHHHHHh
  .hHHHHHHh.
  .hHHHHHHh.
  .hkkkkkkh.
  ..hkkkkh..
`);
const shoe = rows(`
  hHH.
  hHH.
  hHH.
  hHH.
  hHHh
  hhhh
`);
const fist = { ...rows(`
  .hHHh
  hHJHH
  hHHHH
  hHHHh
  .hhh.
`).reduce((r, x) => (r.rows.push(x), r), { rows: [], ax: 2, ay: 2 }) };
const boulder = rows(`
  ..IIII..
  .IiiIII.
  IiIiiIiI
  IiiIiiiI
  .iijiijj
  ..jjjjj.
`);
const parts = { head, headRoar, headHurt, robe, shoe, fist, boulder };
const rig = robedRig({
  OX: 10, OY: 11, parts, shoe,
  layout: { robe: [2, 3], head: [8, 0], legB: [3, 14], legF: [7, 14], sleeve: null },
  // arms are thick limbs from the shoulder to a fist; o.fF / o.fB = front/back fist position (rig coords)
  propBack(o, h, { T }) { return arm(T, o, 'B', [4, 6], 'h', 'hH'); },
  prop(o, h, { T }) {
    const out = arm(T, o, 'F', [10, 6], 'H', 'JH');
    if (o.boulder) out.push(['boulder', ...T(o.boulder[0] + (o.lean ?? 0), o.boulder[1])]);   // held overhead in both fists
    return out;
  },
});
function arm(T, o, side, sh, body, hi) {
  const bob = o.bob ?? 0, lean = o.lean ?? 0;
  const f = o['f' + side] ?? (side === 'F' ? [13, 16] : [0, 16]);
  const [sx, sy] = T(sh[0] + lean, sh[1] + bob);
  const [fx, fy] = T(f[0] + lean, f[1] + (o.fbob ? bob : 0));
  const el = o['e' + side] ? T(...o['e' + side]) : [Math.round((sx + fx) / 2) + (side === 'F' ? 1 : -1), Math.round((sy + fy) / 2)];
  return [limb([[sx, sy], el, [fx, fy]], { w: 4, body, hi: hi[0] === body ? null : hi[0], lo: 'h' }), ['fist', fx, fy]];
}
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1, fF: [14, 16], fB: [-1, 16] });
pose('walk1', { bob: 0, fF: [13, 15], fB: [0, 15] });
pose('walk2', { bob: 1, lf: -1, lb: 1, fF: [12, 16], fB: [1, 16] });
pose('walk3', { bob: 0, fF: [13, 15], fB: [0, 15] });
pose('idle0', { bob: 0, fF: [13, 15], fB: [0, 15] });
pose('idle1', { bob: 1, hy: 1, fF: [13, 16], fB: [0, 16] });
pose('bare', { fF: [13, 15], fB: [0, 15] });
pose('windup0', { bob: 1, lean: -1, hx: -1, headPart: 'headRoar', lf: -1, lb: 1, fF: [12, 0], eF: [15, 5], fB: [3, 0], eB: [0, 4], boulder: [3, -5] });
pose('windup1', { bob: 0, lean: -2, hx: -1, hy: 0, headPart: 'headRoar', lf: -1, lb: 1, fF: [11, -8], eF: [16, -1], fB: [3, -8], eB: [-1, -1], boulder: [3, -11] });
pose('strike0', { bob: 2, lean: 3, hx: 2, hy: 2, lf: 2, lb: -1, headPart: 'headRoar', fF: [17, 11], eF: [17, 5], fB: [10, 13], eB: [8, 8] });
pose('strike1', { bob: 3, lean: 3, hx: 2, hy: 3, lf: 1, lb: -1, headPart: 'headRoar', fF: [19, 17], eF: [18, 9], fB: [12, 18], eB: [9, 10] });
pose('hurt0', { bob: 1, lean: -2, hx: -1, hy: 1, headPart: 'headHurt', fF: [11, 13], fB: [-1, 16] });

export default {
  name: 'yeti', title: 'Yeti', notes: 'Frozen Pass brute. Both fists overhead holding an ice boulder on windup (the lob), slam on strike.',
  cell: [40, 32], shadow: [14, 4], pivot: [20, 30], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie' } },
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 2, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
