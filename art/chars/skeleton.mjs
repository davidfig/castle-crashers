// SKELETON — Haunted Keep warrior. ~11px of bone: dark sockets, ribs, a rusty short sword, a scrap of rag at the hip.
// windup = sword raised, strike = chop. Basic swarm unit.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, outline, line } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  .WWW.
  WlWlW
  WWWWw
  .wWw.
`);
const headOpen = rows(`
  .WWW.
  WlWlW
  WWWWw
  .WlW.
`);
const headHurt = rows(`
  .WWW.
  WWlWW
  WWWWw
  .wWw.
`);
const robe = rows(`
  wWWWw
  .WlW.
  .wlw.
  .WlW.
  .RRr.
`);
const shoe = rows(`
  .W
  .W
  WW
`);
const sword = (ang) => weapon({
  angle: ang, len: 6, half: 0.9, grip: 1, holdU: 0,
  mat(u, v, L) {
    if (u >= -1 && u < 0.5) return Math.abs(v) <= 1.4 ? 'g' : null;
    if (u < 0.5 || u > L) return null;
    return Math.abs(v) > (u > L - 1.5 ? 0.3 : 0.8) ? null : (v < 0 ? 't' : 'O');
  },
});
const swordLying = outline(rows(`
  gtOOOO
`), 'l');
const parts = { head, headOpen, headHurt, robe, shoe, swordLying };
const rig = robedRig({
  OX: 4, OY: 3, parts, shoe,
  layout: { robe: [2, 4], head: [2, 0], legB: [2, 8], legF: [4, 8], sleeve: null, hand: [7, 6] },
  prop(o, h, { add, T }) {
    if (o.noweapon) return [];
    const k = add('sw' + (o.ang ?? -40), () => sword(o.ang ?? -40));
    const sh = T(5 + (o.lean ?? 0), 5 + (o.bob ?? 0));        // bone arm from shoulder to the sword hand
    return [line(sh, T(...h), 'W'), [k, ...T(...h)]];
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
pose('strike1', { ang: 50, lean: 2, bob: 1, lf: 2, lb: -2 });
pose('hurt0', { ang: -20, lean: -1, hx: -1, hy: 1, bob: 1, headPart: 'headHurt' });

export default {
  name: 'skeleton', title: 'Skeleton', notes: 'Haunted Keep warrior. Rusty sword baked in; bone scatters on death.',
  cell: [24, 15], shadow: [8, 3], pivot: [12, 13], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['swordLying', 15, 13]] } },
  anims: {
    walk: { fps: 9, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
