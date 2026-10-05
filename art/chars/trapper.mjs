// TRAPPER — Frozen Pass fodder: a fur-hooded mountain trapper (~11px) in a patched coat, a blue scarf, a belt and a hatchet.
// Dark furs and a bright scarf so it reads on the pale snow. The hatchet is baked into every pose.
// windup = hatchet raised, strike = chop. Basic swarm unit.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, outline, line } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// f/F/d = fur ramp (dark umber to dusty tan), b/B = scarf (cobalt)
const palette = { l: G.lead, e: G.lead, ...G, f: '#5a4a3c', F: '#8c7660', d: '#362c24', b: '#2a5fa8', B: '#5a98e0' };
const post = { ink: 'l', all: true };

const head = rows(`
  .fFf.
  flSlf
  fSSSf
  .bBb.
`);
const headOpen = rows(`
  .fFf.
  flSlf
  fSlSf
  .bBb.
`);
const headHurt = rows(`
  .fFf.
  fSSSf
  fSlSf
  .bBb.
`);
const robe = rows(`
  fFFFf
  fFbFf
  fooof
  fFfFf
  dfdfd
`);
const shoe = rows(`
  .f
  .d
  dd
`);
const hatchet = (ang) => weapon({
  angle: ang, len: 7, half: 0.9, grip: 1, holdU: 0,
  mat(u, v, L) {
    if (u >= -1 && u < 0.5) return Math.abs(v) <= 1.2 ? 'o' : null;
    if (u < 0.5 || u > L) return null;
    if (u >= L - 2.6) return v >= -2.4 && v <= 0.9 ? (v < -1.3 ? 'X' : 'Z') : null;   // the blade, edge forward
    return Math.abs(v) <= 0.5 ? 'o' : null;
  },
});
const hatchetLying = outline(rows(`
  oooooZX
`), 'l');
// the snare it sets: a steel-toothed jaw trap, opened out
const trapItem = rows(`
  X..X..X
  XZZZZZX
  .ZoooZ.
`);
const parts = { head, headOpen, headHurt, robe, shoe, hatchetLying, trapItem };
const rig = robedRig({
  OX: 4, OY: 3, parts, shoe,
  layout: { robe: [2, 4], head: [2, 0], legB: [2, 8], legF: [4, 8], sleeve: null, hand: [7, 6] },
  prop(o, h, { add, T }) {
    if (o.noweapon) return [];
    if (o.trap) return [line(T(5 + (o.lean ?? 0), 5 + (o.bob ?? 0)), T(...h), 'f'), ['trapItem', ...T(h[0] - 3, h[1] - 1)]];
    const k = add('ha' + (o.ang ?? -40), () => hatchet(o.ang ?? -40));
    const sh = T(5 + (o.lean ?? 0), 5 + (o.bob ?? 0));        // fur sleeve from the shoulder to the hand
    return [line(sh, T(...h), 'f'), [k, ...T(...h)]];
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 2, lb: -2 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -2, lb: 2 });
pose('walk3', { bob: 0, hy: 0, hx: 1 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, hy: 0 });
pose('windup0', { ang: -60, lean: -1, bob: 0, hx: -1, lf: -1, lb: 1, headPart: 'headOpen' });
pose('windup1', { ang: -125, lean: -1, bob: 0, hx: -1, hy: -1, lf: -1, lb: 1, headPart: 'headOpen' });
pose('strike0', { ang: -5, lean: 2, hx: 1, lf: 2, lb: -2, headPart: 'headOpen' });
pose('strike1', { ang: 38, lean: 2, bob: 1, lf: 2, lb: -2 });
// set: crouched over the snow, the trap held out in front and being laid down (the telegraph of its snare special)
pose('set0', { trap: true, bob: 1, lean: 1, hx: 1, hy: 1, lf: 1, lb: -1, headPart: 'headOpen' });
pose('set1', { trap: true, bob: 2, lean: 2, hx: 1, hy: 2, lf: 2, lb: -2, headPart: 'headOpen' });
pose('hurt0', { ang: -20, lean: -1, hx: -1, hy: 1, bob: 1, headPart: 'headHurt' });

export default {
  name: 'trapper', title: 'Trapper', notes: 'Frozen Pass fodder. Hatchet baked in; the corpse drops it.',
  cell: [24, 15], shadow: [8, 3], pivot: [12, 13], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['hatchetLying', 15, 13]] } },
  anims: {
    walk: { fps: 9, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    cast: { fps: 1, frames: ['set0', 'set1'] },
  },
};
