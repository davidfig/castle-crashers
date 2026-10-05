// TUNDRA GUARD — the Pass's heavy sentinel (~15px): blue-grey riveted plate, a closed ram-horned helm with amber eye slits, a fur
// collar, a deep-blue surcoat and a longsword. (The tower shield it was drawn with is gone: its ability is the chilling aura around it.)
// The sword is baked into every pose; the game adds lean/lunge on top.
// Poses: walk (slow clank), idle, windup (sword raised), strike (chop), hurt and dead.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// A-D = plate (darkest to lightest), v/V = surcoat (deep, mid blue), T = amber eye slits, W/w = brass horns, f/F = the fur collar
const palette = { l: G.lead, e: G.lead, ...G, A: '#1e2736', B: '#34445e', C: '#587090', D: '#8aa4c4', v: '#1f3a68', V: '#3b64b0', T: '#ffc040', W: '#c8a458', w: '#8a6a2c', f: '#5a4a3c', F: '#8c7660' };
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
  .FfFFfF.
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
    const out = []; // no shield: its ability is the permafrost aura, not blocking
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

export default {
  name: 'tundraguard', title: 'Tundra Guard', notes: 'Pass sentinel; chills everyone close to it (permafrost aura). Body poses include the sword.',
  cell: [32, 22], shadow: [14, 4], pivot: [16, 19], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['swordLying', 23, 20]] } },
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
