// WARRIOR — glass look, game scale (~17px). Silhouette: great helm with a tall crimson crest fin, broad steel
// pauldrons, a kite shield held forward. Weapon: short sword. Ability: ground-slam shockwave (the "fury nova").
import { GLASS as G, GLASS_PLAYERS } from '../palette.mjs';
import { rows, ring, weapon } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  .XXXX.
  XXXXXZ
  XXXllZ
  XXXXXZ
  .ZZZZ.
`);
const hat = rows(`
  .RR..
  RRRR.
  qRRR.
`);                        // crest fin, swept back
const robe = rows(`
  ZZZZZZZZ
  ZRRRRRRZ
  .RRGGRR.
  .RRRGRR.
  .rRRRRr.
  .ZZZZZZ.
`);
const sleeve = rows(`
  ZZ
  ZZ
`);
const shoe = rows(`
  .zz
  zzz
`);
const shield = rows(`
  .ZZZ.
  ZbbbZ
  ZbGbZ
  ZbGbZ
  ZbbbZ
  .ZbZ.
  ..Z..
`);
const parts = { head, hat, robe, sleeve, shoe, shield };

const sword = (ang) => weapon({
  angle: ang, len: 11, half: 1.1, grip: 3, holdU: -1,
  mat(u, v, L) {
    if (u >= -3 && u < -0.5) return Math.abs(v) <= 0.6 ? 'g' : null;
    if (u >= -0.5 && u < 1) return Math.abs(v) <= 2.2 ? 'G' : null;
    if (u < 1 || u > L) return null;
    const hw = u > L - 2 ? Math.max(0.2, (L - u) * 0.5) : 1.1;
    if (Math.abs(v) > hw) return null;
    return v < 0 ? 'X' : 'Z';
  },
});

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe,
  layout: { robe: [7, 7], head: [8, 2], hat: [6, 0], legB: [8, 13], legF: [10, 13], hand: [13, 7], sleeve: [-1, 0] },
  prop(o, h, { add, T }) {
    const out = [];
    const k = add('sw' + o.ang, () => sword(o.ang));
    out.push([k, ...T(...h)]);
    const [sx, sy] = o.shield ?? [0, 0];
    out.push(['shield', ...T(12 + (o.lean ?? 0) + sx, 8 + (o.bob ?? 0) + sy)]);
    return out;
  },
});
const { pose, frames, T } = rig;

pose('idle0', { ang: -55, hand: [14, 9] });
pose('idle1', { ang: -57, bob: 1, rb: 1, hand: [14, 10] });
pose('idle2', { ang: -59, bob: 1, rb: 2, hand: [14, 10] });
pose('idle3', { ang: -57, rb: 1, hand: [14, 9] });
pose('walk0', { ang: -48, hand: [14, 10], bob: 1, lf: 2, lb: -2, lbl: 1, rb: 1 });
pose('walk1', { ang: -57, hand: [14, 9], lf: 0, lb: 1, lbl: 1, rb: 0 });
pose('walk2', { ang: -48, hand: [14, 10], bob: 1, lf: -2, lb: 2, lfl: 1, rb: 2 });
pose('walk3', { ang: -57, hand: [14, 9], lf: 1, lfl: 1, lb: 0, rb: 0 });

// ---- melee swing. In the game the hit lands instantly and a slash arc sweeps for 8 ticks, so these frames are keyed
// to that sweep: `sweep` = the blade follows the arc from its start to its end (play reversed for the rising backhand),
// `finisher` = the wide 240-degree heavy swing, `recover` = the weight settling back before idle. No FX are baked in:
// the game draws the arc itself.
pose('sw0', { ang: -118, bob: 1, lean: -1, hx: -1, rb: 2, lf: -1, lb: 1, hand: [12, 5], shield: [-1, 0] });
pose('sw1', { ang: -72, lean: 0, rb: 2, hand: [13, 5] });
pose('sw2', { ang: -22, lean: 1, hx: 1, rb: 1, lf: 2, lb: -2, hand: [14, 7] });
pose('sw3', { ang: 25, bob: 1, lean: 2, hx: 1, rb: 1, lf: 2, lb: -2, hand: [15, 9], shield: [1, 0] });
pose('sw4', { ang: 70, bob: 1, lean: 2, hx: 1, rb: 1, lf: 2, lb: -2, hand: [15, 10], shield: [1, 0] });
pose('rec0', { ang: 40, bob: 1, lean: 1, rb: 1, hand: [15, 10] });
pose('rec1', { ang: -15, bob: 0, lean: 0, rb: 0, hand: [14, 9] });
pose('fin0', { ang: -128, bob: 1, lean: -2, hx: -1, rb: 2, lf: -2, lb: 2, hand: [11, 5], shield: [-1, 0] });
pose('fin1', { ang: -92, bob: 0, lean: -1, rb: 2, hand: [12, 3] });
pose('fin2', { ang: -45, lean: 0, hx: 1, rb: 1, lf: 2, lb: -2, hand: [14, 4] });
pose('fin3', { ang: 2, bob: 1, lean: 2, hx: 1, rb: 1, lf: 3, lb: -3, hand: [16, 7], shield: [1, 0] });
pose('fin4', { ang: 62, bob: 1, lean: 3, hx: 2, rb: 1, lf: 3, lb: -3, hand: [16, 10], shield: [1, 0] });
pose('fin5', { ang: 122, bob: 2, lean: 3, hx: 2, rb: 0, lf: 3, lb: -3, hand: [15, 11], shield: [1, 0] });

// ability: ground slam. (The shockwave ring and dust are drawn by the game, so none are baked into the frames.)
pose('cast0', { ang: -100, bob: 1, lean: -1, rb: 2, hand: [12, 6] });
pose('cast1', { ang: -90, bob: -1, rb: 1, hand: [13, 2], shield: [0, -1] });
pose('cast2', { ang: 90, bob: 2, lean: 1, rb: 0, lf: 2, lb: -2, hand: [15, 11] });   // SLAM
pose('cast3', { ang: 90, bob: 1, lean: 1, rb: 1, hand: [15, 11] });
pose('cast4', { ang: -60, bob: 1, rb: 2, hand: [13, 8] });
pose('hurt0', { ang: -40, bob: 1, lean: -2, hx: -1, hy: 1, rb: 2, lf: -1, lb: 1, hand: [12, 8], shield: [-1, 1] });

// down: she crumples, the helm rolls off beside her, the sword stays planted (the revive marker)
parts.puddle = rows(`
  ..ZZZZZ..
  .ZRRGRRZ.
  ZRRRGRRRZ
  zzzzzzzzz
`);
parts.puddleLow = rows(`
  .........
  ..ZZZZZ..
  ZRRRGRRRZ
  zzzzzzzzz
`);
parts.helmFallen = rows(`
  .XXXX
  XXXXZ
  XllXZ
  .ZZZZ
`);
parts.shieldFlat = rows(`
  ZZZZZZ
  ZbGGbZ
  ZZZZZZ
`);
parts['sw-90'] = sword(90);
frames.down0 = [['robe1', ...T(7, 9)], ['head', ...T(8, 5)], ['hat', ...T(6, 3)], ['sleeve', ...T(12, 10)], ['sw90', ...T(14, 5)], ['shield', ...T(12, 10)]];
parts.sw90 = sword(90);
frames.down1 = [['puddle', ...T(6, 11)], ['helmFallen', ...T(0, 11)], ['sw90', ...T(16, 7)], ['shieldFlat', ...T(10, 14)]];
frames.down2 = [['puddleLow', ...T(6, 13)], ['helmFallen', ...T(0, 12)], ['sw90', ...T(16, 8)], ['shieldFlat', ...T(10, 15)]];

export default {
  name: 'warrior', title: 'Warrior', notes: 'Great helm + crest, kite shield, short sword. Ability = ground slam shockwave. Robe/crest colour swaps per player.',
  cell: [48, 40], shadow: [11, 5], pivot: [20, 28], palette, post,
  variants: [{ id: 'base', label: 'default', palette: {} }, ...GLASS_PLAYERS.map((v) => ({ ...v, palette: { R: v.palette.R, r: v.palette.r, q: v.palette.q } }))],
  parts, frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    sweep: { loop: false, frames: ['sw0', 'sw1', 'sw2', 'sw3', 'sw4'], ms: [30, 30, 30, 30, 30] },        // spans the 8-tick slash arc
    finisher: { loop: false, frames: ['fin0', 'fin1', 'fin2', 'fin3', 'fin4', 'fin5'], ms: [30, 30, 30, 30, 30, 30] },
    recover: { loop: false, frames: ['rec0', 'rec1'], ms: [100, 120] },
    cast: { loop: false, frames: ['cast0', 'cast1', 'cast2', 'cast3', 'cast4'], ms: [180, 150, 70, 130, 200] },
    hurt: { fps: 6, loop: false, frames: ['hurt0'] },
    down: { fps: 5, loop: false, frames: ['down0', 'down1', 'down2'] },
  },
};
