// PEAT BRUTE — a hulking heap of animated bog (~28px): a lumbering mound of wet brown peat with moss patches, hanging roots and
// reeds sprouting off its back, a lump of a head sunk between the shoulders, and a bog-oak log gripped as a club in the front
// fist. Warm mid-browns with ochre and moss lights so it reads on dark mud. (The game draws the mud trail.)
// windup = log hauled up behind the head (the overhead telegraph), strike = log smashed down and forward.
import { GLASS as G } from '../palette.mjs';
import { rows, limb, weapon } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// p/P/Q = peat ramp, m/M = moss, y = reed ochre, R = root, u/U/x = bog-oak log (dark, mid, pale end-grain)
const palette = { l: G.lead, e: G.lead, ...G, p: '#6a4526', P: '#a8743c', Q: '#d4a05a', m: '#5f8a34', M: '#9cc24a', y: '#d6b25a', R: '#3f2a18', u: '#33261a', U: '#6a523a', x: '#e0c890' };
const post = { ink: 'l', all: true };

const lit = (r) => r.map((x) => x.replace(/P/g, '§').replace(/Q/g, 'y').replace(/§/g, 'Q'));
const head = lit(rows(`
  ..pPPPp.
  .pPQQPPp
  pPQlPlPP
  pPPPPPPp
  pPPlllPp
  .pPPPPp.
  ..pppp..
`));
const headRoar = lit(rows(`
  ..pPPPp.
  .pPQQPPp
  pPQlPlPP
  pPPPPPPp
  pPllllPp
  .plllllp
  ..pppp..
`));
const headHurt = lit(rows(`
  ..pPPPp.
  .pPQQPPp
  pPQllllP
  pPPPPPPp
  pPPlllPp
  .pPPPPp.
  ..pppp..
`));
const robe = rows(`
  ..yppPPQPPpy..
  .pPPQQQPPPPpp.
  ppPQQMmPPPPPpp
  pPPQQmPPlPPPPp
  pPPPPPPPPPlPPp
  pPQPPPPMmPPPPp
  pPPPPPPPPPPPPp
  pPPPPPPPPPPPpp
  ppPPPlPPPPPPpp
  pPPPPPPPmMPPpp
  .pPPPPPPPPPPp.
  .ppPPPPPPPPpp.
  .pRpPPPPPpRpp.
  ..R.pppppp.R..
`);
const shoe = rows(`
  pPPP.
  pPQPP
  PPPPP
  PPPPp
  pPPPp
  ppppp
`);
const fist = { rows: rows(`
  .pPPp.
  pPQPPp
  PPPPPp
  pPPPRp
  .ppRp.
`), ax: 3, ay: 2 };
const reeds = rows(`
  y..y.y
  .y.yy.
  .yy.y.
  ..y.y.
`);
const parts = { head, headRoar, headHurt, robe, shoe, fist, reeds };

/** The bog-oak log: a knotted trunk thickening to a heavy end, moss on the thick end. angle: 0 = right, -90 = up, 90 = down. */
function log(angle) {
  return weapon({
    angle, len: 17, half: 4, grip: 5, holdU: 0,
    mat(u, v, L) {
      if (u < -4 || u > L) return '.';
      const half = 1.7 + 2.1 * (Math.max(0, u) / L);
      if (Math.abs(v) > half) return '.';
      if (u > L - 1.2) return v < 0 ? 'x' : 'U';                         // pale end-grain
      if (u > L - 5 && Math.abs(v) < half * 0.5 && ((Math.floor(u) + Math.floor(v)) & 3) === 0) return 'M';   // moss
      if (Math.floor(u) % 7 === 3 && v > 0) return 'p';                  // a knot
      return v < -half * 0.25 ? 'U' : v > half * 0.45 ? 'u' : 'U';
    },
  });
}

const rig = robedRig({
  OX: 14, OY: 18, parts, shoe,
  layout: { robe: [1, 4], head: [5, 1], legB: [2, 17], legF: [8, 17], sleeve: null },
  propBack(o, h, { T }) {
    const lean = o.lean ?? 0, bob = o.bob ?? 0;
    return [['reeds', ...T(9 + lean, -2 + bob)], ...arm(T, o, 'B', [3, 8], 'p', 'P')];
  },
  prop(o, h, { T, add }) {
    const a = arm(T, o, 'F', [13, 10], 'P', 'Q');
    const f = frontFist(T, o);
    const key = 'log' + o.lg;
    add(key, () => log(o.lg));
    return [a[0], [key, f[0], f[1]], a[1]];
  },
});
function frontFist(T, o) {
  const f = o.fF ?? [18, 18];
  return T(f[0] + (o.lean ?? 0), f[1] + (o.fbob ? (o.bob ?? 0) : 0));
}
function arm(T, o, side, sh, body, hi) {
  const bob = o.bob ?? 0, lean = o.lean ?? 0;
  const f = o['f' + side] ?? (side === 'F' ? [18, 18] : [-4, 18]);
  const [sx, sy] = T(sh[0] + lean, sh[1] + bob);
  const [fx, fy] = T(f[0] + lean, f[1] + (o.fbob ? bob : 0));
  const el = o['e' + side] ? T(...o['e' + side]) : [Math.round((sx + fx) / 2) + (side === 'F' ? 1 : -1), Math.round((sy + fy) / 2)];
  return [limb([[sx, sy], el, [fx, fy]], { w: 5, body, hi: hi === body ? null : hi, lo: 'p' }), ['fist', fx, fy]];
}
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1, lg: -80, fF: [19, 15], fB: [-3, 18] });
pose('walk1', { bob: 0, lg: -80, fF: [18, 14], fB: [-2, 17] });
pose('walk2', { bob: 1, lf: -1, lb: 1, lg: -80, fF: [17, 15], fB: [-1, 18] });
pose('walk3', { bob: 0, lg: -80, fF: [18, 14], fB: [-2, 17] });
pose('idle0', { bob: 0, lg: -78, fF: [18, 14], fB: [-2, 17] });
pose('idle1', { bob: 1, hy: 1, lg: -76, fF: [18, 15], fB: [-2, 18] });
pose('bare', { fF: [18, 16], fB: [-2, 18], lg: 200 });
pose('windup0', { bob: 1, lean: -1, hx: -1, headPart: 'headRoar', lf: -1, lb: 1, lg: -125, fF: [15, 2], eF: [19, 8], fB: [1, 10], eB: [-3, 12] });
pose('windup1', { bob: 0, lean: -3, hx: -1, headPart: 'headRoar', lf: -1, lb: 1, lg: -150, fF: [12, -6], eF: [18, 0], fB: [3, 4], eB: [-2, 6] });
pose('strike0', { bob: 2, lean: 3, hx: 3, hy: -1, headPart: 'headRoar', lf: 2, lb: -1, lg: -20, fF: [22, 10], eF: [20, 6], fB: [10, 14], eB: [6, 10] });
pose('strike1', { bob: 3, lean: 4, hx: 3, hy: 0, headPart: 'headRoar', lf: 1, lb: -1, lg: 55, fF: [23, 14], eF: [21, 9], fB: [12, 18], eB: [8, 12] });
pose('hurt0', { bob: 1, lean: -2, hx: -1, hy: 1, headPart: 'headHurt', lg: -85, fF: [16, 14], fB: [-3, 18] });

export default {
  name: 'peatbrute', title: 'Peat Brute', notes: 'Hulking mound of wet peat with a bog-oak log club. Log hauled overhead on windup, smashed down on strike. Mud trail is drawn by the game.',
  cell: [56, 52], shadow: [16, 5], pivot: [28, 43], palette, post,
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
