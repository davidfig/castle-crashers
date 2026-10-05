// DREADKNIGHT — a heavy undead knight (~15px): black-iron full plate, a closed horned helm with glowing teal eye slits, a tattered
// purple surcoat, and a longsword. (The kite shield it was drawn with is gone: its ability is rising once more after it falls.)
// The sword is baked into every pose; the game adds lean/lunge on top.
// Poses: walk (slow clank), idle, windup (sword raised), strike (chop), hurt, dazed (staggering; the game plays it while the knight gets back up
// after its first death) and dead.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, A: '#1f1b29', B: '#352f42', C: '#5c5470', D: '#908aa6', v: '#3b1f58', V: '#6e3fa0', T: '#5ff0e0' };
const post = { ink: 'l', all: true };

const head = rows(`
  .BBBB.
  BCCBBB
  BBBTTB
  .BBBB.
`);
const headHurt = rows(`
  .BBBB.
  BCCBBB
  BBBllB
  .BBBB.
`);
const headDown = rows(`
  .BBBB.
  BCCBBB
  BBBBBB
  .BTTB.
`);
// two long horns sweeping up and out
const hat = rows(`
  W....W
  wB..Bw
`);
const robe = rows(`
  .CCBBCC.
  CDCBBCDC
  BBvVvBBB
  .BvVVvB.
  .BvvvvB.
  .vVvvVv.
  .v.vv.v.
`);
const shoe = rows(`
  BB
  BB
  BBB
`);
const shield = rows(`
  DDDDDD
  DBBvBC
  DBvVvC
  DBvVvC
  DBBvBC
  .CBvBC
  .CBvC.
  ..CBC.
  ...C..
`);
const sword = (ang) => weapon({
  angle: ang, len: 11, half: 1.2, grip: 2, holdU: 0,
  mat(u, v, L) {
    if (u >= -2.2 && u < -0.8) return Math.abs(v) <= 0.6 ? 'o' : null;      // grip
    if (u >= -0.8 && u < 0.6) return Math.abs(v) <= 1.9 ? 'G' : null;      // crossguard
    if (u < 0.6 || u > L) return null;
    const hw = u > L - 1.6 ? 0.4 : 0.9;
    return Math.abs(v) > hw ? null : (v < 0 ? 'X' : 'Z');
  },
});
const swordLying = outline(rows(`
  oGXXXXXXX
`), 'l');
const parts = { head, headHurt, headDown, hat, robe, shoe, shield, swordLying };

const rig = robedRig({
  OX: 11, OY: 7, parts, shoe,
  layout: { robe: [1, 4], head: [2, 0], hat: [2, -2], legB: [2, 11], legF: [5, 11], sleeve: null, hand: [7, 5] },
  propBack(o, h, { add, T }) {
    if (o.noweapon || o.front) return [];
    const k = add('sw' + (o.ang ?? -65), () => sword(o.ang ?? -65));
    return [[k, ...T(h[0] + (o.wx ?? 0), h[1] + (o.wy ?? 0))]];
  },
  prop(o, h, { add, T }) {
    const out = []; // no shield: its ability is rising again, not blocking
    if (o.front && !o.noweapon) { const k = add('sw' + o.ang, () => sword(o.ang)); out.push([k, ...T(h[0] + (o.wx ?? 0), h[1] + (o.wy ?? 0))]); }
    return out;
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0, lf: 0, lb: 0, lbl: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, ang: -70 });
pose('windup0', { ang: -95, front: true, lean: -1, bob: 0, sx: -1, wx: -1, hx: -1, lf: -1, lb: 1 });
pose('windup1', { ang: -135, front: true, lean: -2, bob: 1, sx: -1, sy: 1, wx: -2, hx: -1, hy: 1, lf: -1, lb: 1 });
pose('strike0', { ang: -15, front: true, lean: 3, bob: 1, sx: 1, wx: 0, hx: 1, lf: 2, lb: -2 });
pose('strike1', { ang: 40, front: true, lean: 2, bob: 1, sx: 0, wx: 1, wy: 1, lf: 1, lb: -1 });
pose('hurt0', { ang: -40, lean: -1, bob: 1, sx: -1, hx: -1, hy: 1, headPart: 'headHurt' });
pose('dazed0', { ang: 30, lean: 1, bob: 1, sx: -1, sy: 0, hx: 1, hy: 2, lf: 1, lb: -1, headPart: 'headDown' });
pose('dazed1', { ang: 40, lean: -1, bob: 1, sx: -2, sy: 0, hx: 0, hy: 2, lf: -1, lb: 1, headPart: 'headDown' });

export default {
  name: 'dreadknight', title: 'Dread knight', notes: 'Black-iron undead knight; rises once from its first death. Body poses include the sword.',
  cell: [32, 22], shadow: [14, 4], pivot: [16, 19], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['swordLying', 23, 20]] } },
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dazed: { fps: 4, frames: ['dazed0', 'dazed1'] },
  },
};
