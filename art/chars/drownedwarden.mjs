// DROWNED WARDEN — an elite drowned knight (~26px, tall and heavy): a corpse-soldier in rust-orange plate draped in pond weed and
// river reeds, a rotted helm with weed spilling from the visor, weed beard, and a weed-wrapped trident (NO shield). Lashing green
// tendrils uncoil from its body when it attacks (its hit roots the hero). windup = trident hauled back, tendrils rearing up;
// strike = trident thrust with tendrils whipping out along the ground.
import { GLASS as G } from '../palette.mjs';
import { rows, limb, weapon } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// a/A/B = rusted plate (dark, orange, bright), w/W = pond weed, u = trident shaft, T = pale rusted prongs, h = grey-green dead flesh
const palette = { l: G.lead, e: G.lead, ...G, a: '#8c4624', A: '#d1823e', B: '#f2bd6e', w: '#3d7a3a', W: '#80c44c', u: '#7c5c3a', T: '#e0c890', h: '#9fb48c' };
const post = { ink: 'l', all: true };

const head = rows(`
  .W.wW.W.
  wWwAAWwW
  .AAAAAAa
  ABBBBBAa
  AAllllAa
  AAAhAAAa
  .AaaaaAa
  .wWwWwW.
`);
const headHurt = rows(`
  .W.wW.W.
  wWwAAWwW
  .AAAAAAa
  ABBBBBAa
  AAlllllA
  AAAhAAAa
  .AaaaaAa
  .wWwWwW.
`);
const robe = rows(`
  .WAAAAAAAAWw
  wAABBBBBBAAa
  wAABAAAAAAaa
  AAAAWwAAAAaa
  AAAAAWWAAaaa
  aAAAAAwWWAaa
  aaAAAAAAwWWa
  .waaAAAAaaw.
  .wWAaaaaAWw.
  ..wAa..aAw..
`);
const shoe = rows(`
  aAA.
  aAA.
  wWA.
  aAA.
  aAAA
  aaaa
`);
const hand = { rows: rows(`
  hhh
  hhh
`), ax: 1, ay: 1 };
const parts = { head, headHurt, robe, shoe, hand };

/** A weed-wrapped trident: pole with leaf-wrap, and three rusted prongs. */
function trident(angle) {
  return weapon({
    angle, len: 22, half: 4, grip: 4, holdU: 0,
    mat(u, v, L) {
      if (u < -5 || u > L) return '.';
      const av = Math.abs(v);
      if (u > L - 6) {                                   // the head: crossbar and three prongs
        if (u < L - 4.2 && av <= 3.4) return 'T';
        if ((av < 0.7 || Math.abs(av - 3) < 0.7) && u > L - 6) return u > L - 2 ? 'B' : 'T';
        return '.';
      }
      if (av > 0.9) return '.';
      if (u > 2 && Math.floor(u / 3) % 2 === 0) return v < 0 ? 'W' : 'w';   // the weed wrap
      return v < 0 ? 'u' : 'a';
    },
  });
}
const tendril = (pts, w = 2) => limb(pts, { w, body: 'W', lo: 'w' });
function armTo(T, sh, hp, lean, bob, w = 3) {
  const [sx, sy] = T(sh[0] + lean, sh[1] + bob), [fx, fy] = T(hp[0] + lean, hp[1] + bob);
  return limb([[sx, sy], [Math.round((sx + fx) / 2) + 1, Math.round((sy + fy) / 2) + 1], [fx, fy]], { w, body: 'A', hi: 'B', lo: 'a' });
}
const rig = robedRig({
  OX: 16, OY: 22, parts, shoe,
  layout: { robe: [2, 6], head: [4, 0], legB: [3, 14], legF: [8, 14], sleeve: null },
  propBack(o, h, { T }) {
    const hp = o.h2 ?? [0, 15];
    const out = [];
    for (const pts of o.td ?? []) out.push(tendril(pts.map(([x, y]) => T(x + (o.lean ?? 0), y + (o.bob ?? 0)))));
    return [...out, armTo(T, [3, 9], hp, o.lean ?? 0, o.bob ?? 0), ['hand', ...T(hp[0] + (o.lean ?? 0), hp[1] + (o.bob ?? 0))]];
  },
  prop(o, h, { T, add }) {
    const hp = o.h ?? [15, 12], l = o.lean ?? 0, b = o.bob ?? 0;
    const key = 'tri' + o.ta;
    add(key, () => trident(o.ta));
    const out = [];
    out.push([key, ...T(hp[0] + l, hp[1] + b)], armTo(T, [11, 9], hp, l, b), ['hand', ...T(hp[0] + l, hp[1] + b)]);
    return out;
  },
});
const { pose } = rig;
const tdWalk = (k) => [[[3, 15], [-1 - k, 18], [-2 - k, 21]], [[12, 15], [15 + k, 18], [16 + k, 21]]];
pose('walk0', { bob: 1, lf: 1, lb: -1, ta: -68, td: tdWalk(0) });
pose('walk1', { bob: 0, ta: -68, td: tdWalk(1) });
pose('walk2', { bob: 1, lf: -1, lb: 1, ta: -68, td: tdWalk(0) });
pose('walk3', { bob: 0, ta: -68, td: tdWalk(1) });
pose('idle0', { bob: 0, ta: -70, td: tdWalk(0) });
pose('idle1', { bob: 1, hy: 1, ta: -72, td: tdWalk(1) });
pose('bare', { ta: 200 });
pose('windup0', { bob: 1, lean: -2, hx: -1, lf: -1, lb: 1, ta: -140, h: [11, 4], h2: [2, 9], td: [[[6, 8], [3, 3], [5, -2]], [[9, 8], [12, 2], [10, -4]]] });
pose('windup1', { bob: 1, lean: -3, hx: -1, lf: -1, lb: 1, ta: -165, h: [8, 1], h2: [1, 7], td: [[[6, 8], [1, 1], [4, -6]], [[9, 8], [14, 0], [10, -8]]] });
pose('strike0', { bob: 2, lean: 3, hx: 2, lf: 2, lb: -2, ta: 5, h: [20, 12], h2: [8, 14], td: [[[8, 14], [14, 19], [22, 20]], [[10, 12], [18, 15], [27, 17]]] });
pose('strike1', { bob: 2, lean: 4, hx: 2, lf: 2, lb: -2, ta: 12, h: [22, 13], h2: [9, 14], td: [[[8, 14], [17, 20], [26, 21]], [[10, 12], [20, 18], [32, 20]]] });
pose('hurt0', { bob: 1, lean: -2, hx: -1, hy: 1, headPart: 'headHurt', ta: -50, h: [13, 13], h2: [-1, 13], td: [[[4, 16], [1, 19], [3, 21]]] });

export default {
  name: 'drownedwarden', title: 'Drowned Warden', notes: 'Rust-orange drowned knight draped in weed; weed-wrapped trident, lashing tendrils (they root the hero). No shield. windup rears the trident back; strike thrusts with tendrils whipping out.',
  cell: [68, 54], shadow: [14, 4], pivot: [34, 42], palette, post,
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
