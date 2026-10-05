// BONEBRUTE — a hulking skeleton knight-brute stitched from mismatched bones: huge ribcage with a stack of small skulls in
// the cavity (it bursts into skulls when destroyed), one oversized femur club. ~16px tall. Slow, heavy walk.
// The club is baked into every pose; the game adds lean/lunge on top. Poses: walk, idle, windup (club up), strike (overhead smash), hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, stepLeg, line } from '../lib.mjs';

const palette = { l: G.lead, e: G.lead, ...G, h: '#8d8576', d: '#2a1a22' };
const post = { ink: 'l', all: true };

const skull = rows(`
  .wWWWw.
  wWWWWWw
  wWlWWlw
  .wWWWw.
  ..wlwl.
`);
const skullHurt = rows(`
  .wWWWw.
  wWWWWWw
  wWlWWlw
  .wWWWw.
  ..wlll.
`);
const skullRoar = rows(`
  .wWWWw.
  wWWWWWw
  wWlWWlw
  .wWWWw.
  ..wlll.
  ..wlll.
`);
const ribs = rows(`
  hwwWWWWWWWWwwO
  .wWddddddddWw.
  .wdWWWWWWWWdw.
  .wdWlWlWlWldw.
  ..wWwdddddwWw.
  ...hwwwwwwwwh.
`);
const pelvis = rows(`
  .hwwwwwwh.
  .hwOOOOwh.
`);
const shape = rows(`
  .wW
  .oO
  hwW
  wWW
`);
const parts = { skull, skullHurt, skullRoar, ribs, pelvis };
const club = (ang) => weapon({
  angle: ang, len: 13, half: 1.2, grip: 2, holdU: 1,
  mat(u, v, L) {
    const kn = (cu, r) => { const d = Math.hypot(u - cu, v); return d < r ? (d < r * 0.5 ? 'W' : 'w') : null; };
    if (u > L - 3.5) return kn(L - 1.4, 2.6) ?? null;
    if (u > -2 && u <= L - 3.5) return Math.abs(v) <= 0.9 ? (v < 0 ? 'W' : 'w') : null;
    return null;
  },
});
const clubLying = rows(`
  .wWWWWWWWWwh
  wWWwwwwwwwWw
  .wwhhhhhhwW.
`);
const lg = (side, foot, lift = 0) => { const k = `leg${side}${foot}_${lift}`; if (!parts[k]) parts[k] = stepLeg(shape, foot, lift); return k; };
const arm = (sx, sy, hx, hy, col, dark) => (put) => {
  line([sx, sy + 1], [hx, hy + 1], dark)(put);
  line([sx, sy], [hx, hy], col)(put);
  line([sx + 1, sy], [hx + 1, hy], col)(put);
  put(hx, hy, 'W'); put(hx + 1, hy, 'W'); put(hx, hy + 1, 'W');
};
const frames = {};
const pose = (name, o = {}) => {
  const { bob = 0, lean = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, hp = 'skull', ang = 40, noweapon = false, hand = [14, 6] } = o;
  const X = 11 + lean, Y = 9 + bob;
  const h = [X + hand[0] - 1, Y + hand[1]];
  const e = [
    arm(X + 1, Y + 5, X - 1, Y + 11, 'O', 'o'),
    [lg('B', lb, lbl), X + 3, 21], [lg('F', lf, lfl), X + 8, 21],
    ['pelvis', X + 2, Y + 10],
    ['ribs', X, Y + 4],
    [hp, X + 4 + hx, Y + hy - 1],
  ];
  if (!noweapon) {
    const k = 'cb' + ang;
    if (!parts[k]) parts[k] = club(ang);
    e.push([k, h[0], h[1]]);
  }
  e.push(arm(X + 12, Y + 5, h[0], h[1], 'w', 'h'));
  frames[name] = e;
};
pose('walk0', { bob: 1, lf: 1, lb: -1, ang: 28 });
pose('walk1', { bob: 0, lfl: 1, ang: 32 });
pose('walk2', { bob: 1, lf: -1, lb: 1, ang: 28 });
pose('walk3', { bob: 0, lbl: 1, ang: 32 });
pose('idle0', { bob: 0, ang: 32 });
pose('idle1', { bob: 1, ang: 36 });
pose('windup0', { ang: -70, lean: -1, bob: 0, hx: -1, lf: -1, lb: 1, hp: 'skullRoar', hand: [13, 5] });
pose('windup1', { ang: -125, lean: -2, bob: -1, hx: -1, hy: 1, lf: -1, lb: 1, hp: 'skullRoar', hand: [11, 3] });
pose('strike0', { ang: -15, lean: 3, bob: 1, hx: 1, hy: 1, lf: 2, lb: -2, hp: 'skullRoar', hand: [14, 5] });
pose('strike1', { ang: 50, lean: 3, bob: 1, hx: 1, hy: 2, lf: 1, lb: -1, hp: 'skullRoar', hand: [14, 4] });
pose('hurt0', { ang: 15, lean: -2, bob: 1, hx: -1, hy: 1, lf: -1, lb: 1, hp: 'skullHurt' });
frames.dead0 = [['corpse', 7, 19], ['clubLying', 25, 22]];
parts.clubLying = clubLying;
parts.corpse = rows(`
  ......hww.........
  ....hwWWWwh.......
  ..hwWlWWlWWwh.hww.
  .hwwWWWWWWWwwhwWWw
  hwwWlWWWlWWwwwWlWh
  hhwWWWWWWWWwwwwhhh
`);

export default {
  name: 'bonebrute', title: 'Bone brute', notes: 'Patchwork skeleton brute; skull stack in the ribcage. Club baked in (femur).',
  cell: [44, 26], shadow: [14, 4], pivot: [22, 24], palette, post, parts, frames,
  derived: {},
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 2, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead0'] },
  },
};
