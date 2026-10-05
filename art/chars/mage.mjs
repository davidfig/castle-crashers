// MAGE — glass look, game scale. Silhouette: wide-brim pointed hat with a bent tip and a gold star, long white beard,
// amethyst robe, tall staff capped by a burning orb. Ability: arcane nova. Attack: staff jab + thrown spark.
import { GLASS as G, GLASS_PLAYERS } from '../palette.mjs';
import { rows, smear, ring, weapon } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// amethyst robe + deep-violet hat so the mage reads apart from the lapis cleric
const palette = { l: G.lead, e: G.lead, ...G, a: '#2e1a5a', b: '#5a3aa0', r: '#4a1f6e', R: '#8a4ac0', q: '#c898f0' };
const post = { ink: 'l', all: true };

const head = rows(`
  SSSS.
  SSSSe
  SSSsW
  .WWWW
  ..WW.
`);
const hat = rows(`
  ....bb...
  ...bbbb..
  ..bbbYbb.
  .bbbbbbbb
  aaaaaaaaa
`);
const robe = rows(`
  .rrRRRr.
  rRRqRRRr
  rRRqqRRr
  rRRRqRRr
  rRRRRRRr
  rRRYRYRr
  GGGGGGGG
`);
const sleeve = rows(`
  RR
  sS
`);
const shoe = rows(`
  .aa
  aaa
`);
const parts = { head, hat, robe, sleeve, shoe };

const staff = (ang) => weapon({
  angle: ang, len: 13, half: 1, grip: 4, holdU: -1,
  mat(u, v, L) {
    if (u >= -4 && u < L) return Math.abs(v) <= 0.6 ? (v < 0 ? 'G' : 'g') : null;
    const d = Math.hypot(u - (L + 1.6), v);            // the orb
    if (d < 2.3) return d < 1.2 ? 'W' : 'c';
    return null;
  },
});

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe,
  layout: { robe: [7, 8], head: [8, 4], hat: [5, 0], legB: [8, 14], legF: [10, 14], hand: [14, 11], sleeve: [-1, -1] },
  prop(o, h, { add, T }) { const k = add('st' + o.ang, () => staff(o.ang)); return [[k, ...T(...h)]]; },
});
const { pose, frames, T } = rig;

pose('idle0', { ang: -80 });
pose('idle1', { ang: -82, bob: 1, rb: 1, hand: [14, 12] });
pose('idle2', { ang: -84, bob: 1, rb: 2, hand: [14, 12] });
pose('idle3', { ang: -82, rb: 1 });
pose('walk0', { ang: -74, bob: 1, lf: 2, lb: -2, lbl: 1, rb: 1 });
pose('walk1', { ang: -82, lf: 0, lb: 1, lbl: 1, rb: 0 });
pose('walk2', { ang: -74, bob: 1, lf: -2, lb: 2, lfl: 1, rb: 2 });
pose('walk3', { ang: -82, lf: 1, lfl: 1, lb: 0, rb: 0 });

// attack: pull the staff back, jab, and a spark leaves the orb (impact = spark at full reach)
parts.fxSpark = rows(`
  .c.
  cWc
  .c.
`);
parts.fxTrail = rows(`
  b.c.c.W
`);

// ability: arcane nova
parts.fxNova1 = ring({ rx: 6, ry: 2, thick: 1, ch: 'c' });
parts.fxNova2 = ring({ rx: 11, ry: 3, thick: 2, ch: 'W', inner: 'c' });
parts.fxNova3 = ring({ rx: 15, ry: 4, thick: 1, ch: 'c' });
parts.fxStars = rows(`
  Y...c...Y
  ..Y...Y..
  c...Y...c
`);
pose('cast0', { ang: -95, bob: 1, lean: -1, rb: 2, hand: [13, 12] });
pose('cast1', { ang: -90, rb: 1, hand: [15, 7] });
pose('cast2', { ang: -90, bob: -1, hand: [15, 5] });
pose('cast3', { ang: -90, rb: 1, hand: [15, 6] });
pose('cast4', { ang: -84, bob: 1, rb: 2, hand: [14, 11] });
// ---- melee swing, same contract as the warrior (see warrior.mjs): the staff follows the 8-tick slash arc the game draws
pose('sw0', { ang: -130, bob: 1, lean: -1, hx: -1, rb: 2, lf: -1, lb: 1, hand: [13, 10] });
pose('sw1', { ang: -85, rb: 2, hand: [14, 9] });
pose('sw2', { ang: -30, lean: 1, hx: 1, rb: 1, lf: 2, lb: -2, hand: [15, 10] });
pose('sw3', { ang: 15, bob: 1, lean: 2, hx: 1, rb: 1, lf: 2, lb: -2, hand: [16, 11] });
pose('sw4', { ang: 40, bob: 1, lean: 2, hx: 1, rb: 1, lf: 2, lb: -2, hand: [16, 12] });
pose('rec0', { ang: 25, bob: 1, lean: 1, rb: 1, hand: [15, 11] });
pose('rec1', { ang: -50, rb: 0, hand: [14, 10] });
pose('fin0', { ang: -150, bob: 1, lean: -2, hx: -1, rb: 2, lf: -2, lb: 2, hand: [12, 10] });
pose('fin1', { ang: -110, lean: -1, rb: 2, hand: [13, 8] });
pose('fin2', { ang: -60, hx: 1, rb: 1, lf: 2, lb: -2, hand: [14, 7] });
pose('fin3', { ang: -10, bob: 1, lean: 1, hx: 1, rb: 1, lf: 2, lb: -2, hand: [16, 10] });
pose('fin4', { ang: 25, bob: 1, lean: 2, hx: 2, rb: 1, lf: 3, lb: -3, hand: [17, 12] });
pose('fin5', { ang: 55, bob: 2, lean: 2, hx: 2, rb: 0, lf: 3, lb: -3, hand: [16, 13] });

pose('hurt0', { ang: -40, bob: 1, lean: -2, hx: -1, hy: 1, rb: 2, lf: -1, lb: 1, hand: [13, 12] });

// down: slumps; the hat is knocked off beside her/him and the orb dims on the ground
parts.puddle = rows(`
  ..rRRRRr..
  .rRRqRRRr.
  rRRRqRRRRr
  GGGGGGGGGG
`);
parts.puddleLow = rows(`
  ..........
  ..rRRRRr..
  rRRRqRRRRr
  GGGGGGGGGG
`);
parts.hatFallen = rows(`
  .bbbbbb
  bbbYbbb
  aaaaaaa
`);
parts.staffLying = weapon({ angle: 0, len: 13, half: 1, grip: 4, holdU: 0, mat: (u, v, L) => (u >= -4 && u < L ? (Math.abs(v) <= 0.6 ? 'g' : null) : (Math.hypot(u - L - 1.6, v) < 2.3 ? (Math.hypot(u - L - 1.6, v) < 1.2 ? 'w' : 'b') : null)) });
parts['st-90'] = staff(-90);
frames.down0 = [['robe1', ...T(7, 10)], ['head', ...T(8, 7)], ['hat', ...T(5, 3)], ['sleeve', ...T(13, 12)], ['st-90', ...T(15, 12)]];
frames.down1 = [['puddle', ...T(6, 12)], ['head', ...T(3, 9)], ['hatFallen', ...T(-4, 12)], ['staffLying', ...T(9, 17)]];
frames.down2 = [['puddleLow', ...T(6, 14)], ['head', ...T(3, 11)], ['hatFallen', ...T(-4, 14)], ['staffLying', ...T(9, 18)]];

export default {
  name: 'mage', title: 'Mage', notes: 'Wide-brim hat with a bent tip, beard, staff with orb. Ability = arcane nova. Robe colour swaps per player.',
  cell: [52, 48], shadow: [9, 5], pivot: [20, 28], palette, post,
  variants: [{ id: 'base', label: 'default', palette: {} }, ...GLASS_PLAYERS.map((v) => ({ ...v, palette: { R: v.palette.R, r: v.palette.r, q: v.palette.q } }))],
  parts, frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    sweep: { loop: false, frames: ['sw0', 'sw1', 'sw2', 'sw3', 'sw4'], ms: [30, 30, 30, 30, 30] },        // spans the 8-tick slash arc
    finisher: { loop: false, frames: ['fin0', 'fin1', 'fin2', 'fin3', 'fin4', 'fin5'], ms: [30, 30, 30, 30, 30, 30] },
    recover: { loop: false, frames: ['rec0', 'rec1'], ms: [100, 120] },
    cast: { loop: false, frames: ['cast0', 'cast1', 'cast2', 'cast3', 'cast4'], ms: [170, 120, 110, 140, 200] },
    hurt: { fps: 6, loop: false, frames: ['hurt0'] },
    down: { fps: 5, loop: false, frames: ['down0', 'down1', 'down2'] },
  },
};
