// TOAD MATRON — a huge, fat, warty old toad-woman (~24px, troll-sized, a poisonous tank). Squat wide body of mottled green and lime
// with a pale yellow belly and glistening pustules, a vast gash of a mouth, bulging yellow eyes, a ragged plum bonnet with a frayed
// rim, thick froggy legs with webbed feet. windup = rears back, arms up, the throat sac swelling; strike = lunges, belly forward,
// mouth open, arms swiping down.
import { GLASS as G } from '../palette.mjs';
import { rows, limb } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// g/G/Y = skin ramp (olive green, mid green, lime), b/q = belly and wet gloss, n = wart, c/C = bonnet plum, k = mouth, T = tongue, E = eye
const palette = { l: G.lead, e: G.lead, ...G, g: '#4d7e2e', G: '#7eb43c', Y: '#c3de5c', b: '#d8cf7a', q: '#f6f0b8', n: '#b86a38', c: '#6e3358', C: '#aa5a86', k: '#3a1224', T: '#e0566a', E: '#f0d83a' };
const post = { ink: 'l', all: true };

const head = rows(`
  ....cCCCCc....
  ...cCCcCCCc...
  ..gEECCCCEEg..
  .gEElgCCgEEl..
  gGGGGGGGGGGGGg
  gGGnGGGGGGnGGg
  gkkkkkkkkkkkkg
  gGGGGGGGGGGGGg
  .ggGGGGGGGGgg.
`).map((r) => r.padEnd(14, '.'));
const headRoar = rows(`
  ....cCCCCc....
  ...cCCcCCCc...
  ..gEECCCCEEg..
  .gEElgCCgEEl..
  gGGGGGGGGGGGGg
  gGGnGGGGGGnGGg
  gkkkkkkkkkkkkg
  gkTTTTTTTTTTkg
  gkkTTTTTTTTkkg
  .gGGGGGGGGGGg.
`);
const headSwell = rows(`
  ....cCCCCc....
  ...cCCcCCCc...
  ..gEECCCCEEg..
  .gEElgCCgEEl..
  gGGGGGGGGGGGGg
  gGGnGGGGGGnGGg
  gkkkkkkkkkkkkg
  gGGGGGGGGGGGGg
  gbbbbbbbbbbbbg
  gbqqbbbbbbbbbg
  .gbbbbbbbbbbg.
  ..ggbbbbbbgg..
`);
const headHurt = rows(`
  ....cCCCCc....
  ...cCCcCCCc...
  ..gEECCCCEEg..
  .gGggCCCggGgg.
  gGGGGGGGGGGGGg
  gGGnGGGGGGnGGg
  gkkkkkkkkkkkkg
  gkTTTTTTTTTTkg
  .ggGGGGGGGGgg.
`);
const robe = rows(`
  ....ggYYGGGGGgg...
  ..ggYYGGnGGGGGGgg.
  .gGGGnGGGGGGGGGnGg
  gGGGGGGGGGGbbbbGGg
  gGnGGGGGGGbbbbbbGg
  gGGGGGGGGbbqbbbbbg
  gGGGGnGGGbbbbbqbbg
  gGGGGGGGGGbbbbbbbg
  .gGGGGGGGGGbbbbbg.
  .ggGGGnGGGGGbbbgg.
  ..ggGGGGGGGGGggg..
  ...gggggggggggg...
`);
const shoe = rows(`
  .ggGGg..
  gGGGGGg.
  gGGGGGGg
  gGGGGGGG
  gGgGgGgG
  .g.g.g.g
`);
const fist = { rows: rows(`
  .ggGg.
  gGGGGg
  gGYGGg
  .gGgg.
`), ax: 3, ay: 2 };
const parts = { head, headRoar, headSwell, headHurt, robe, shoe, fist };

function arm(T, o, side, sh, body, hi) {
  const bob = o.bob ?? 0, lean = o.lean ?? 0;
  const f = o['f' + side] ?? (side === 'F' ? [18, 16] : [0, 16]);
  const [sx, sy] = T(sh[0] + lean, sh[1] + bob);
  const [fx, fy] = T(f[0] + lean, f[1] + (o.fbob ? bob : 0));
  const el = o['e' + side] ? T(...o['e' + side]) : [Math.round((sx + fx) / 2) + (side === 'F' ? 1 : -1), Math.round((sy + fy) / 2) + 1];
  return [limb([[sx, sy], el, [fx, fy]], { w: 4, body, hi, lo: 'g' }), ['fist', fx, fy]];
}
const rig = robedRig({
  OX: 14, OY: 15, parts, shoe,
  layout: { robe: [1, 5], head: [7, 0], legB: [3, 14], legF: [10, 14], sleeve: null },
  propBack(o, h, { T }) { return arm(T, o, 'B', [4, 9], 'g', 'G'); },
  prop(o, h, { T }) { return arm(T, o, 'F', [15, 9], 'G', 'Y'); },
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1, fF: [19, 16], fB: [-1, 16] });
pose('walk1', { bob: 0, fF: [18, 15], fB: [0, 15] });
pose('walk2', { bob: 1, lf: -1, lb: 1, fF: [17, 16], fB: [1, 16] });
pose('walk3', { bob: 0, fF: [18, 15], fB: [0, 15] });
pose('idle0', { bob: 0, fF: [18, 15], fB: [0, 15] });
pose('idle1', { bob: 1, hy: 1, headPart: 'headSwell', fF: [18, 16], fB: [0, 16] });
pose('bare', { fF: [18, 15], fB: [0, 15] });
pose('windup0', { bob: 0, lean: -2, hx: -1, hy: -1, headPart: 'headSwell', lf: -1, lb: 1, fF: [17, 4], eF: [21, 9], fB: [3, 4], eB: [0, 9] });
pose('windup1', { bob: -1, lean: -3, hx: -1, hy: -2, headPart: 'headSwell', lf: -1, lb: 1, fF: [16, -3], eF: [21, 4], fB: [4, -3], eB: [-1, 4] });
pose('strike0', { bob: 2, lean: 3, hx: 2, hy: 1, headPart: 'headRoar', lf: 2, lb: -1, fF: [24, 13], eF: [22, 9], fB: [13, 15], eB: [9, 11] });
pose('strike1', { bob: 3, lean: 4, hx: 3, hy: 2, headPart: 'headRoar', lf: 1, lb: -1, fF: [26, 18], eF: [24, 11], fB: [15, 18], eB: [10, 12] });
pose('hurt0', { bob: 1, lean: -2, hx: -1, hy: 1, headPart: 'headHurt', fF: [16, 13], fB: [-1, 16] });

export default {
  name: 'toadmatron', title: 'Toad Matron', notes: 'Huge warty toad-woman tank (poisonous skin). windup rears back with the throat sac swelling; strike lunges mouth-first.',
  cell: [52, 46], shadow: [16, 5], pivot: [26, 35], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie' } },
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 2, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
