// DUNE RAIDER — plain fodder of the Scorched Dunes. Lean desert raider: indigo wrapped headcloth, rust face veil with a dark
// eye slit, rust tunic with a brass sash, indigo trousers, curved scimitar. Crouches nimbly (the game lets some blows glance off).
// The scimitar is baked into every pose. Poses: walk, idle, windup (crouch, blade raised), strike (lunge), hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// a/b/c indigo cloth, r/o/O rust, g brass sash, t dark skin, k dark leather
const palette = { l: G.lead, e: G.lead, ...G, a: '#1a2058', b: '#2f3f9c', c: '#5a72d0', r: '#6a1c14', o: '#a8341c', O: '#d4582a', g: '#b98a30', t: '#7a4228', k: '#3a2418' };
const post = { ink: 'l', all: true };

const head = rows(`
  .bbbb
  bbcbb
  attYl
  .oooo
`);
const headHit = rows(`
  .bbbb
  bbcbb
  attll
  .oooo
`);
const headLow = rows(`
  .bbbb
  bbcbb
  attYl
  .oooo
`);
const robe = rows(`
  .ooO.
  ooOoo
  ggggg
  aaaa.
`);
const shoe = rows(`
  a.
  kk
`);
const sword = (ang) => weapon({
  angle: ang, len: 7, half: 1.2, grip: 1, holdU: 0,
  mat(u, v, L) {
    if (u >= -1.5 && u < 0.5) return Math.abs(v) <= 0.9 ? 'k' : null;
    if (u < 0.5 || u > L) return null;
    const c = v - 0.07 * u * u;                      // the scimitar's curve
    const w = u > L - 1.8 ? 0.3 : 1.0;
    return Math.abs(c) > w ? null : (c < 0 ? 'X' : 'Z');
  },
});
const swordLying = outline(rows(`
  kZZZZX
  ......X
`), 'l');
const parts = { head, headHit, headLow, robe, shoe, swordLying };
const rig = robedRig({
  OX: 7, OY: 2, parts, shoe,
  layout: { robe: [3, 4], head: [4, 0], legB: [3, 8], legF: [5, 8], sleeve: null, hand: [8, 5] },
  prop(o, h, { add, T }) {
    if (o.noweapon) return [];
    const k = add('sw' + (o.ang ?? -40), () => sword(o.ang ?? -40));
    return [[k, ...T(...h)]];
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0, ang: -35 });
pose('idle1', { bob: 1, ang: -30 });
pose('windup0', { ang: -70, lean: -1, bob: 1, hx: -1, lf: -1, lb: 1 });
pose('windup1', { ang: -118, lean: -2, bob: 1, hx: -1, hy: 1, lf: -1, lb: 1 });
pose('strike0', { ang: -5, lean: 2, hx: 1, lf: 2, lb: -2, bob: 1 });
pose('strike1', { ang: 28, lean: 1, bob: 1, lf: 1, lb: -1 });
pose('hurt0', { ang: -90, lean: -1, hx: -1, hy: 1, bob: 1, headPart: 'headHit' });

export default {
  name: 'duneraider', title: 'Dune Raider', notes: 'Fodder. Scimitar baked into every pose; crouches on windup.',
  cell: [26, 14], shadow: [8, 3], pivot: [13, 11], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['swordLying', 15, 11]] } },
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
