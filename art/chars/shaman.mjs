// SHAMAN — goblin hedge-witch. Hunched under a ragged dark-green hood-cloak hung with bone charms and a red feather, one
// gold eye in the shadow, a gnarled staff topped with a glowing herb-and-orb (a deliberate small glow). windup = staff raised,
// orb flaring: the healing pulse. No strike (a pure support caster). Poses: walk, idle, windup, hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, outline, line } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, u: '#173a2a', U: '#2a6044', V: '#3f8a5e' };
const post = { ink: 'l', all: true };

const head = rows(`
  .uuu..
  uUUUu.
  uulYn.
  .uUnn.
`);
const headHurt = rows(`
  .uuu..
  uUUUu.
  uullu.
  .uUnn.
`);
// hunched cloak with a ragged hem, feather (R), bone charms (W)
const robe = rows(`
  uUUUuu
  uUUUUu
  uUUUUu
  uUuUUu
  uWU.Ru
`);
const shoe = rows(`
  n.
  nn
`);
const orbLying = rows(`
  mY
`);
const staffLying = outline(rows(`
  OOOOOOO
`), 'l');
const parts = { head, headHurt, robe, shoe, orbLying, staffLying };

// gnarled staff planted at x, running from the ground (gy) up to ty, with a bent knot and the orb on top
const staff = (x, gy, ty, glow) => (put) => {
  for (let y = ty + 2; y <= gy; y++) put(x + (y % 5 === 0 ? 1 : 0), y, y % 3 === 0 ? 'O' : 'o');
  put(x - 1, ty + 3, 'o'); put(x + 1, ty + 2, 'O');                    // knot / prongs cradling the orb
  put(x - 1, ty + 1, 'o'); put(x + 1, ty + 1, 'o');
  if (glow) {                                                           // flared pulse: bright core, halo, sparks
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) put(x + dx, ty + dy, 'm');
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, ty + dy, 'Y');
    put(x - 3, ty - 1, 'm'); put(x + 3, ty - 1, 'm'); put(x, ty - 3, 'm');
  } else {
    put(x, ty, 'Y'); put(x - 1, ty, 'm'); put(x + 1, ty, 'm'); put(x, ty - 1, 'm'); put(x, ty + 1, 'm');
    put(x - 1, ty - 1, 'n'); put(x + 1, ty - 1, 'n');                   // herb tuft
  }
};
const rig = robedRig({
  OX: 5, OY: 9, parts, shoe,
  layout: { robe: [3, 3], head: [3, 0], legB: [3, 8], legF: [5, 8], sleeve: null, hand: [9, 4] },
  prop(o, h, { T }) {
    if (o.noweapon) return [];
    const [sx, sy] = T(o.sx ?? 9 + (o.lean ?? 0), 0);
    const out = [staff(sx, T(0, 8)[1] - (o.lift ?? 0), T(0, o.top ?? -3 + (o.bob ?? 0))[1], !!o.glow)];
    out.push(line(T(6 + (o.lean ?? 0), 5 + (o.bob ?? 0)), [sx, T(0, h[1])[1]], 'n'));   // arm to the staff
    return out;
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1, top: -2, hand: [9, 5] });
pose('walk1', { bob: 0, hand: [9, 4] });
pose('walk2', { bob: 1, lf: -1, lb: 1, top: -2, hand: [9, 5] });
pose('walk3', { bob: 0, hand: [9, 4] });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, top: -2, hand: [9, 5] });
// windup: the staff is lifted clear of the ground and thrust up, orb flaring
pose('windup0', { lean: 0, bob: 0, hy: -1, hand: [9, 2], lift: 2, top: -6, sx: 9, glow: true });
pose('windup1', { lean: 0, bob: 0, hy: -1, hand: [9, 1], lift: 3, top: -8, sx: 9, glow: true });
pose('hurt0', { lean: -1, hx: -1, hy: 1, bob: 1, headPart: 'headHurt', sx: 8, top: -2, hand: [8, 5] });
const { frames } = rig;

export default {
  name: 'shaman', title: 'Shaman', notes: 'Goblin hedge-witch. windup = staff raised, orb flared (heal pulse). No strike.',
  cell: [18, 20], shadow: [8, 3], pivot: [9, 18], palette, post,
  parts, frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['staffLying', 3, 18], ['orbLying', 10, 17]] } },
  anims: {
    walk: { fps: 7, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
