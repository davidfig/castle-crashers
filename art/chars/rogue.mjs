// ROGUE — glass look, game scale. Silhouette: low crouch, hooded and masked (one gold eye), a long crimson scarf streaming
// behind, a dagger in each hand. Fast: attack frames are short. Ability: shadow dash (smoke streak).
import { GLASS as G, GLASS_PLAYERS } from '../palette.mjs';
import { rows, shear, smear, weapon, stepLeg } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

// face shows; the head is covered by a pulled-up hood (not a mask)
const head = rows(`
  .nnnn.
  nnnnnn
  nnSSSS
  nnSSeS
  .nSss.
`);
const hat = rows(`
  .nn.
`);                               // hood point (1 row), swept back
const robe = rows(`
  .nnnnn.
  nnnGGnn
  nnnnnnn
  .n...n.
`);
const sleeve = rows(`
  nn
  ss
`);
const leg = rows(`
  .aa
  .aa
  .aa
  aaa
`);
const scarf0 = rows(`
  ....RRRR
  .RRRRRq.
  RRRq....
`);
const parts = { head, hat, robe, sleeve, shoe: leg };
const scarf = (sway) => shear(scarf0, (i, n) => -sway * Math.pow(i / (n - 1), 1.3));
for (let i = 0; i < 3; i++) parts['scarf' + i] = scarf([0, 1.5, 3][i]);
parts.fxCutter = rows(`
  .Y.
`);

const dagger = (ang) => weapon({
  angle: ang, len: 6, half: 0.9, grip: 2, holdU: -1,
  mat(u, v, L) {
    if (u >= -2 && u < 0) return Math.abs(v) <= 0.5 ? 'g' : null;
    if (u >= 0 && u < 1) return Math.abs(v) <= 1.6 ? 'G' : null;
    if (u < 1 || u > L) return null;
    const hw = u > L - 1.5 ? 0.3 : 0.9;
    return Math.abs(v) > hw ? null : (v < 0 ? 'X' : 'Z');
  },
});

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe: leg,
  layout: { back: [0, 8], robe: [7, 9], head: [8, 4], hat: [6, 3], legB: [8, 13], legF: [10, 13], hand: [14, 11], sleeve: [-1, -1] },
  prop(o, h, { add, T }) {
    const out = [];
    out.push([add('dg' + o.ang, () => dagger(o.ang)), ...T(...h)]);
    return out;
  },
  propBack(o, h, { add, T }) {   // off-hand dagger sits behind the body so the silhouette stays clean
    const b = o.back2 ?? [h[0] - 6, h[1] + 1]; const a2 = o.ang2 ?? 150;
    return [[add('dg' + a2, () => dagger(a2)), ...T(...b)]];
  },
});
const { pose, frames, T } = rig;
const crouch = { lean: 1, bob: 0 };

pose('idle0', { ...crouch, back: 'scarf0', ang: -30, ang2: 150 });
pose('idle1', { lean: 1, bob: 1, back: 'scarf1', ang: -32, ang2: 152, rb: 1, hand: [14, 12] });
pose('idle2', { lean: 1, bob: 1, back: 'scarf2', ang: -34, ang2: 154, rb: 2, hand: [14, 12] });
pose('idle3', { ...crouch, back: 'scarf1', ang: -32, ang2: 152, rb: 1 });
pose('walk0', { lean: 2, bob: 1, back: 'scarf2', ang: -20, ang2: 140, lf: 3, lb: -3, lbl: 1, rb: 1 });
pose('walk1', { lean: 2, bob: 0, back: 'scarf1', ang: -30, ang2: 150, lf: 0, lb: 1, lbl: 1, rb: 0 });
pose('walk2', { lean: 2, bob: 1, back: 'scarf2', ang: -20, ang2: 140, lf: -3, lb: 3, lfl: 1, rb: 2 });
pose('walk3', { lean: 2, bob: 0, back: 'scarf1', ang: -30, ang2: 150, lf: 1, lfl: 1, lb: 0, rb: 0 });

// attack: coil, stab with the lead hand, stab with the off hand (impact), recover. Fast.
parts.fxStab = rows(`
  ..YY
  YYY.
`);
pose('atk0', { lean: 0, bob: 1, back: 'scarf2', ang: -140, ang2: 150, hx: -1, rb: 2, lf: -1, lb: 1, hand: [12, 10], back2: [10, 13] });
pose('atk1', { lean: 3, bob: 1, back: 'scarf2', ang: 5, ang2: 140, hx: 1, rb: 1, lf: 3, lb: -3, hand: [18, 11], back2: [10, 13], fx: [['fxStab', 24, 10]] });
pose('atk2', { lean: 3, bob: 1, back: 'scarf2', ang: -90, ang2: 175, hx: 1, rb: 1, lf: 3, lb: -3, hand: [15, 9], back2: [19, 13], fx: [['fxStab', 25, 12]] });   // IMPACT
pose('atk3', { lean: 2, bob: 1, back: 'scarf1', ang: -40, ang2: 150, rb: 0, hand: [15, 11] });

// ability: shadow dash — streaks behind, leaning hard into it, then a puff
parts.fxStreak = rows(`
  wwwwww.w
  ..wwww..
  .wwwww.w
`);
pose('cast0', { lean: 0, bob: 2, back: 'scarf2', ang: -150, ang2: 150, hx: -1, rb: 2, hand: [12, 11], back2: [10, 14] });
pose('cast1', { lean: 4, bob: 1, back: 'scarf2', ang: 0, ang2: 170, hx: 2, rb: 1, lf: 3, lb: -3, hand: [19, 11], back2: [17, 14], fx: [['fxStreak', -6, 9]] });
pose('cast2', { lean: 7, bob: 1, back: 'scarf2', ang: 0, ang2: 170, hx: 2, rb: 1, lf: 3, lb: -3, hand: [22, 11], back2: [20, 14], fx: [['fxStreak', 0, 10]] });
pose('cast3', { lean: 4, bob: 1, back: 'scarf1', ang: -20, ang2: 160, rb: 0, hand: [18, 11], });
pose('hurt0', { lean: -1, bob: 1, back: 'scarf2', ang: 60, ang2: 80, hx: -1, hy: 1, rb: 2, lf: -1, lb: 1, hand: [13, 13], back2: [9, 14] });

// down: folds over; hood off beside, daggers crossed on the ground
parts.puddle = rows(`
  ..nnnnn..
  .nnnGGnn.
  nnnnnnnnn
  aaaaaaaaa
`);
parts.puddleLow = rows(`
  .........
  ..nnnnn..
  nnnGGnnnn
  aaaaaaaaa
`);
parts.hoodFallen = rows(`
  .nnnn
  nnnnnn
  .nnn.
`);
parts.daggersLying = rows(`
  X.....Z
  .XG.GZ.
  ..X.Z..
`);
frames.down0 = [['robe1', ...T(7, 12)], ['head', ...T(8, 8)], ['hat', ...T(6, 7)], ['sleeve', ...T(13, 14)]];
frames.down1 = [['puddle', ...T(6, 13)], ['head', ...T(3, 10)], ['hoodFallen', ...T(-3, 13)], ['daggersLying', ...T(12, 15)]];
frames.down2 = [['puddleLow', ...T(6, 15)], ['head', ...T(3, 12)], ['hoodFallen', ...T(-3, 15)], ['daggersLying', ...T(12, 16)]];

export default {
  name: 'rogue', title: 'Rogue', notes: 'Crouched, hooded (face visible), trailing scarf, twin daggers. Ability = shadow dash. Scarf colour swaps per player.',
  cell: [56, 40], shadow: [9, 4], pivot: [20, 28], palette, post,
  variants: [{ id: 'base', label: 'default', palette: {} }, ...GLASS_PLAYERS.map((v) => ({ ...v, palette: { R: v.palette.R, q: v.palette.q } }))],
  parts, frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    walk: { fps: 10, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    attack: { loop: false, frames: ['atk0', 'atk1', 'atk2', 'atk3'], ms: [110, 40, 60, 140] },
    cast: { loop: false, frames: ['cast0', 'cast1', 'cast2', 'cast3'], ms: [130, 60, 90, 160] },
    hurt: { fps: 6, loop: false, frames: ['hurt0'] },
    down: { fps: 5, loop: false, frames: ['down0', 'down1', 'down2'] },
  },
};
