// BOGFROG — plain marsh fodder. A small hunched frog-person: olive skin, pale belly, goggle eyes on top of a wide head,
// a ragged loincloth and a stick with a flint tip. ~9px of body. The stick is baked into every pose; the game adds the hop.
// Poses: walk, idle, windup (crouch, mouth open, stick raised), strike (lunge), hurt (recoil, eyes shut), dead.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, a: '#4c6a1c', g: '#7fa32c', h: '#b0cc44', p: '#f0e4a4' };
const post = { ink: 'l', all: true };

const head = rows(`
  .GG.GG.
  hGlhGlh
  hhhhhhh
  gaaaaag
  .ppppp.
`);
const headOpen = rows(`
  .GG.GG.
  hGlhGlh
  hhhhhhh
  gRRRRRg
  .ppppp.
`);
const headHurt = rows(`
  .hh.hh.
  hllhllh
  hhhhhhh
  gaaaaag
  .ppppp.
`);
const robe = rows(`
  .hhhg.
  gppppg
  gpppg.
  .tRRt.
`);
const shoe = rows(`
  g..
  gg.
  ggg
`);
const stick = (ang) => weapon({
  angle: ang, len: 6, half: 0.8, grip: 1, holdU: 0,
  mat(u, v, L) {
    if (u < -1 || u > L) return null;
    if (u > L - 2) return Math.abs(v) <= 1.2 ? (v < 0 ? 'X' : 'Z') : null;   // flint tip
    return Math.abs(v) <= 0.55 ? (v < 0 ? 'O' : 'o') : null;
  },
});
const stickLying = outline(rows(`
  ooooZ
`), 'l');
const parts = { head, headOpen, headHurt, robe, shoe, stickLying };
const rig = robedRig({
  OX: 6, OY: 2, parts, shoe,
  layout: { robe: [3, 5], head: [3, 0], legB: [3, 9], legF: [5, 9], sleeve: null, hand: [9, 6] },
  prop(o, h, { add, T }) {
    if (o.noweapon) return [];
    const k = add('st' + (o.ang ?? -40), () => stick(o.ang ?? -40));
    return [[k, ...T(...h)]];
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1 });
pose('windup0', { ang: -60, lean: -1, bob: 1, hx: -1, lf: -1, lb: 1, headPart: 'headOpen' });
pose('windup1', { ang: -140, lean: -1, bob: 1, hx: -1, hy: 1, lf: -1, lb: 1, headPart: 'headOpen' });
pose('strike0', { ang: -10, lean: 2, hx: 1, lf: 2, lb: -2, headPart: 'headOpen' });
pose('strike1', { ang: 30, lean: 1, bob: 1, lf: 1, lb: -1 });
pose('hurt0', { ang: -20, lean: -1, hx: -1, hy: 1, bob: 1, headPart: 'headHurt' });

export default {
  name: 'bogfrog', title: 'Bogfrog', notes: 'Marsh fodder. Hunched olive frog-person with a flint stick; the game adds the hop.',
  cell: [26, 15], shadow: [8, 3], pivot: [13, 13], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['stickLying', 14, 13]] } },
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
