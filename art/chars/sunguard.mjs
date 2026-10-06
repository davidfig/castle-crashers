// SUN GUARD — the sun-cult's elite temple warrior (~16px + plume). Burnished bronze scale armour, a tall plumed bronze helm with a
// gold sun crest and dark eye slit, a bronze-banded crimson kilt, and a heavy khopesh (sickle sword) baked into every pose. Braziers
// on both pauldrons throw up orange flames (painted pixels that flicker between frames). NO shield: his defence is the fire ring the
// game draws around him.
// Poses: walk (slow clank), idle, windup (khopesh raised), strike (hooking chop), hurt and dead.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// A-D = bronze plate (darkest to lightest), v/V = crimson kilt, p/P = plume, f/F = flames, T = eye slit, K = brazier iron
const palette = { l: G.lead, e: G.lead, ...G, A: '#26140a', B: '#52300f', C: '#84501a', D: '#b07a34', v: '#52101c', V: '#901c26', p: '#8e1426', P: '#d03a24', f: '#e8601a', F: '#ffb838', T: '#120808', K: '#2a1c14', g: '#a8791f', G: '#efbd44', X: '#ecc880', Z: '#b48a48' };
const post = { ink: 'l', all: true };

const head = rows(`
  .BCCB.
  BCDCCB
  BTTTTB
  .BCCB.
`);
const headHurt = rows(`
  .BCCB.
  BCDCCB
  BTlTlB
  .BCCB.
`);
const headDown = rows(`
  .BCCB.
  BCDCCB
  BCCCCB
  .BTTB.
`);
// the tall plume (crimson, trailing back) and the gold sun crest on the brow
const hat = rows(`
  .P..GG
  pPP.GG
  pPPGGG
  .pPBGB
`);
const robe = rows(`
  .BCCBBC.
  CCBABBCC
  ACDBBDCA
  .BCDDCB.
  .ABGGBA.
  .vVVVVv.
  .vVvvVv.
`);
const shoe = rows(`
  AA.
  AA.
  AAA
`);
// shoulder braziers: an iron bowl with a tongue of flame, two flicker shapes
const braz = (a) => rows(a ? `
  .F.
  FfF
  fFf
  fFf
  KKK
` : `
  F..
  fF.
  fFF
  fFf
  KKK
`);
const parts = { head, headHurt, headDown, hat, robe, shoe, brazA: braz(true), brazB: braz(false) };
const hand = rows(`
  DC
  BC
`);
parts.hand = hand;
const khopesh = (ang) => weapon({
  angle: ang, len: 10, half: 2.4, grip: 2, holdU: 0,
  mat(u, v, L) {
    if (u >= -2.2 && u < -0.8) return Math.abs(v) <= 0.6 ? 'A' : null;       // grip
    if (u >= -0.8 && u < 0.6) return Math.abs(v) <= 1.9 ? 'g' : null;       // guard
    if (u < 0.6 || u > L) return null;
    const bend = u > 4 ? ((u - 4) ** 2) * 0.16 : 0;                           // the sickle hook
    const hw = u > L - 1.6 ? 0.8 : (u > 4 ? 1.5 : 1.2);
    const d = v - bend;
    return Math.abs(d) > hw ? null : (d < 0 ? 'X' : 'Z');
  },
});
const swordLying = outline(rows(`
  AgXXXXXXXX
  .......XZZ
`), 'l');

const rig = robedRig({
  OX: 10, OY: 10, parts, shoe,
  layout: { robe: [1, 4], head: [2, 0], hat: [2, -3], legB: [2, 11], legF: [5, 11], sleeve: null, hand: [7, 5] },
  propBack(o, h, { add, T }) {
    if (o.noweapon || o.front) return [];
    const k = add('kh' + (o.ang ?? -65), () => khopesh(o.ang ?? -65));
    return [[k, ...T(h[0] + (o.wx ?? 0), h[1] + (o.wy ?? 0))]];
  },
  prop(o, h, { add, T }) {
    const out = [];
    const lean = o.lean ?? 0, bob = o.bob ?? 0, fl = o.fl ?? 0;
    if (o.front && !o.noweapon) { const k = add('kh' + o.ang, () => khopesh(o.ang)); out.push([k, ...T(h[0] + (o.wx ?? 0), h[1] + (o.wy ?? 0))]); }
    if (!o.noweapon) out.push(['hand', ...T(h[0] - 1 + (o.wx ?? 0), h[1] - 1 + (o.wy ?? 0))]);
    // flames on both pauldrons
    out.push([fl ? 'brazA' : 'brazB', ...T(-2 + lean, 0 + bob)]);
    out.push([fl ? 'brazB' : 'brazA', ...T(9 + lean, 0 + bob)]);
    return out;
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1, fl: 0 });
pose('walk1', { bob: 0, lf: 0, lb: 0, lbl: 0, fl: 1 });
pose('walk2', { bob: 1, lf: -1, lb: 1, fl: 0 });
pose('walk3', { bob: 0, fl: 1 });
pose('idle0', { bob: 0, fl: 0 });
pose('idle1', { bob: 1, ang: -70, fl: 1 });
pose('windup0', { ang: -95, front: true, lean: -1, bob: 0, sx: -1, wx: -1, hx: -1, lf: -1, lb: 1, fl: 0 });
pose('windup1', { ang: -135, front: true, lean: -2, bob: 1, sx: -1, sy: 1, wx: -2, hx: -1, hy: 1, lf: -1, lb: 1, fl: 1 });
pose('strike0', { ang: -15, front: true, lean: 3, bob: 1, sx: 1, wx: 0, hx: 1, lf: 2, lb: -2, fl: 0 });
pose('strike1', { ang: 40, front: true, lean: 2, bob: 1, sx: 0, wx: 1, wy: 1, lf: 1, lb: -1, fl: 1 });
pose('hurt0', { ang: -40, lean: -1, bob: 1, sx: -1, hx: -1, hy: 1, headPart: 'headHurt', fl: 1 });

export default {
  name: 'sunguard', title: 'Sun Guard', notes: 'Elite bronze temple warrior; khopesh baked into every pose, braziers flicker on the pauldrons. No shield (the game draws a fire ring).',
  cell: [36, 28], shadow: [14, 4], pivot: [18, 23], palette, post,
  parts: { ...parts, swordLying }, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['swordLying', 24, 23]] } },
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
