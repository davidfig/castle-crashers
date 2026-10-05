// CLERIC — glass look. Authored at GAME SCALE: ~19px tall including outline (placeholder hero is 14px).
// Silhouette comes from a pointed mitre; the weapon is a shepherd's-crook staff (reach + thrust).
import { GLASS as G, GLASS_PLAYERS } from '../palette.mjs';
import { rows, shear, smear, ring, weapon } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  SSSS.
  SSSSe
  SSSss
  .sss.
`);
// rounded mitre: domed top, gold infula stripe, gold brim band; overhangs the head by 1px
const hat = rows(`
  ..WWW..
  .WWYWW.
  WWWYWWW
  GGGGGGG
`);
const robe = rows(`
  .bbbbb.
  bbbGbbb
  bbGGGbb
  bbbGbbb
  wwwwwww
  GgGgGgG
`);
const sleeve = rows(`
  RR
  sS
`);
const shoe = rows(`
  .aa
  aaa
`);
const parts = { head, hat, sleeve, shoe };

const crozier = (ang) => weapon({
  angle: ang, len: 10, half: 0.9, grip: 3, holdU: -1,
  mat(u, v, L) {
    if (u >= -3 && u < L) return Math.abs(v) <= 0.6 ? (v < 0 ? 'G' : 'g') : null;
    const d = Math.hypot(u - (L + 1), v - 1.2);       // the crook: a small ring off the tip
    if (d < 2.1 && d > 0.9) return d < 1.5 ? 'Y' : 'G';
    return null;
  },
});

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe,
  layout: { robe: [7, 7], head: [8, 3], hat: [7, 0], legB: [8, 13], legF: [10, 13], hand: [13, 9], sleeve: [-1, -1] },
  prop(o, h, { add, T }) { const k = add('c' + o.ang, () => crozier(o.ang)); return [[k, ...T(...h)]]; },
});
for (let i = 0; i < 3; i++) parts['robe' + i] = i === 0 ? robe : shear(robe, (y, n) => (i === 1 ? 1 : -1) * Math.pow(y / (n - 1), 2) * 1.1);
const { pose, frames, T } = rig;

pose('idle0', { ang: -82 });
pose('idle1', { ang: -84, bob: 1, rb: 1, hand: [13, 10] });
pose('idle2', { ang: -86, bob: 1, rb: 2, hand: [13, 10] });
pose('idle3', { ang: -84, rb: 1 });
pose('walk0', { ang: -76, bob: 1, lf: 2, lb: -2, lbl: 1, rb: 1 });
pose('walk1', { ang: -84, lf: 0, lb: 1, lbl: 1, rb: 0 });
pose('walk2', { ang: -76, bob: 1, lf: -2, lb: 2, lfl: 1, rb: 2 });
pose('walk3', { ang: -84, lf: 1, lfl: 1, lb: 0, rb: 0 });

parts.fxSweep = smear({ cx: 13, cy: 9, a0: 230, a1: 340, r: 10, t: 2.5, core: 'Y', rim: 'G', tail: 'g', w: 32, h: 32 });
parts.fxThrust = rows(`
  ....Y
  .YYY.
  Y....
`);
pose('atk0', { ang: -150, bob: 1, lean: -1, hx: -1, rb: 2, lf: -1, lb: 1, hand: [12, 8] });     // crook drawn back
pose('atk1', { ang: -120, bob: 1, lean: -1, rb: 2, hand: [12, 8] });
pose('atk2', { ang: -30, lean: 1, hx: 1, rb: 1, lf: 2, lb: -2, hand: [14, 9], fx: [['fxSweep', 13, 9]] });
pose('atk3', { ang: 8, bob: 1, lean: 2, hx: 1, rb: 1, lf: 2, lb: -2, hand: [15, 10], fx: [['fxThrust', 22, 6]] });   // IMPACT
pose('atk4', { ang: -40, bob: 1, lean: 1, rb: 0, hand: [14, 10] });

parts.fxNova1 = ring({ rx: 6, ry: 2, thick: 1, ch: 'G' });
parts.fxNova2 = ring({ rx: 11, ry: 3, thick: 2, ch: 'Y', inner: 'G' });
parts.fxNova3 = ring({ rx: 15, ry: 4, thick: 1, ch: 'G' });
parts.fxRays = rows(`
  Y..Y..Y
  .Y.Y.Y.
`);
pose('cast0', { ang: -95, bob: 1, lean: -1, rb: 2, hand: [12, 10] });
pose('cast1', { ang: -90, rb: 1, hand: [14, 6], fx: [['fxNova1', 10, 14]] });
pose('cast2', { ang: -90, bob: -1, hand: [14, 5], fx: [['fxNova2', 10, 14], ['fxRays', 11, -8]] });
pose('cast3', { ang: -90, rb: 1, hand: [14, 6], fx: [['fxNova3', 10, 14]] });
pose('cast4', { ang: -84, bob: 1, rb: 2, hand: [13, 10] });
pose('hurt0', { ang: -40, bob: 1, lean: -2, hx: -1, hy: 1, rb: 2, lf: -1, lb: 1, hand: [12, 10] });

// the mitre is knocked off and lies on its side next to her head, so her face stays visible while she waits to be revived
parts.hatFallen = rows(`
  .WWWWG
  WWWYWG
  WWWWWG
  .WWWWG
`);
parts.puddle = rows(`
  ..bbbbb..
  .bbbGbbb.
  bbbbGbbbb
  wwwwwwwww
`);
parts.puddleLow = rows(`
  .........
  ..bbbbb..
  bbbbGbbbb
  wwwwwwwww
`);
parts.crozierLying = weapon({ angle: 0, len: 10, half: 0.9, grip: 3, holdU: 0, mat: (u, v, L) => (u >= -3 && u < L ? (Math.abs(v) <= 0.6 ? 'G' : null) : (Math.hypot(u - L - 1, v - 1.2) < 2.1 && Math.hypot(u - L - 1, v - 1.2) > 0.9 ? 'Y' : null)) });
parts['c-90'] = crozier(-90);
frames.down0 = [['robe1', ...T(7, 9)], ['head', ...T(8, 6)], ['hat', ...T(7, 3)], ['sleeve', ...T(12, 10)], ['c-90', ...T(15, 10)]];
frames.down1 = [['puddle', ...T(6, 10)], ['head', ...T(3, 8)], ['hatFallen', ...T(-3, 10)], ['crozierLying', ...T(8, 15)]];
frames.down2 = [['puddleLow', ...T(6, 12)], ['head', ...T(3, 10)], ['hatFallen', ...T(-4, 12)], ['crozierLying', ...T(8, 16)]];

export default {
  name: 'cleric', title: 'Cleric', notes: 'Mitre + crozier. Game scale (~17px incl. outline). Robe colour swaps per player.',
  cell: [46, 36],
  shadow: [9, 5], pivot: [20, 28], palette, post,
  variants: [{ id: 'base', label: 'default', palette: {} }, ...GLASS_PLAYERS.map((v) => ({ ...v, palette: { b: v.palette.R, a: v.palette.r } }))],
  parts, frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    attack: { loop: false, frames: ['atk0', 'atk1', 'atk2', 'atk3', 'atk4'], ms: [190, 110, 40, 120, 170] },
    cast: { loop: false, frames: ['cast0', 'cast1', 'cast2', 'cast3', 'cast4'], ms: [170, 120, 110, 140, 200] },
    hurt: { fps: 6, loop: false, frames: ['hurt0'] },
    down: { fps: 5, loop: false, frames: ['down0', 'down1', 'down2'] },
  },
};
