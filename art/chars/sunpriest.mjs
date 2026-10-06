// SUN PRIEST — sun-cult caster (~14px + halo). Flowing crimson and deep-orange robes, a bare dark-skinned head ringed by a large
// painted-gold sun-disc, gold cuffs, and a tall staff topped with a sun medallion (baked into every pose).
// windup = staff and free hand thrust up, the disc rises behind the head (he dazzles with a flash; the game draws the flash).
// Caster: no strike. Poses: walk, idle, windup, hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// v V h = crimson (deep, mid, bright), q Q = orange (deep, bright), s S = skin, k = kohl, g G = painted gold, o = staff wood
const palette = { l: G.lead, e: G.lead, ...G, v: '#4a0a18', V: '#8e1426', h: '#c8281e', q: '#d8561a', Q: '#f08a2a', s: '#8a4a2a', S: '#b4703e', k: '#1a0a10', g: '#a8791f', G: '#efbd44' };
const post = { ink: 'l', all: true };

const head = rows(`
  .sss.
  sSSSs
  skSkS
  .sss.
`);
const headHurt = rows(`
  .sss.
  sSSSs
  skkkS
  .sks.
`);
const headBack = rows(`
  .sss.
  sSSSs
  skSkS
  .skS.
`);
// the sun-disc halo: drawn behind the head. G rim and rays, a ring of g, the head sits over its middle.
const disc = rows(`
  ..G.G.G..
  .GGGGGGG.
  GGgqqqgGG
  GgqQQQqgG
  GgqQQQqgG
  GGgqqqgGG
  .GGGGGGG.
  ..G.G.G..
`);
const discHi = rows(`
  G.G.G.G.G
  .GGGGGGG.
  GGgqqqgGG
  GgqQQQqgG
  GgqQQQqgG
  GGgqqqgGG
  .GGGGGGG.
  ..G.G.G..
`);
const robe = rows(`
  .hVhVVh.
  hhVhhVVV
  hhVVhhVV
  .VhhVVV.
  .hVVhVVv
  VhqqQqqV
  qQQqqQQq
`);
const shoe = rows(`
  vv
`);
// staff: wood pole under a sun medallion (gold ring, red heart, little flame rays). Anchor = the gripping hand.
const staff = (len, big) => {
  const out = big
    ? ['G.G.G.G', '.GgGgG.', 'GgGRGgG', '.GRRRG.', 'GgGRGgG', '.GgGgG.', 'G.GgG.G']
    : ['..G.G..', '.GgGgG.', 'GgGRGgG', '.gRRRg.', 'GgGRGgG', '.GgGgG.', '..G.G..'];
  const top = out.length;
  for (let i = 0; i < len; i++) out.push('...o...');
  return { rows: out, ax: 3, ay: top + 6 };
};
const armF = rows(`
  VVVVVV
  hVVVhG
`);
const armUp = rows(`
  .S.S
  .SVS
  ..VV
  .GVh
`);
const parts = { head, headHurt, headBack, robe, shoe, armF, armUp, staff0: staff(10, false), staffB: staff(10, true) };

const rig = robedRig({
  OX: 8, OY: 12, parts, shoe,
  layout: { robe: [2, 4], head: [3, 0], legB: [3, 10], legF: [5, 10], sleeve: null, hand: [13, 6] },
  propBack(o, h, { T, add }) {
    const k = o.disc === 'hi' ? 'discHi' : 'disc';
    add(k, k === 'disc' ? disc : discHi);
    const lean = o.lean ?? 0, hx = o.hx ?? 0;
    return [[k, ...T(1 + lean + hx, -5 + (o.bob ?? 0) + (o.hy ?? 0) + (o.disc === 'hi' ? -2 : 0))]];
  },
  prop(o, h, { T }) {
    const out = [];
    if (o.noweapon) return out;
    out.push([o.staff ?? 'staff0', ...T(h[0] + (o.sx ?? 0), h[1] + (o.sy ?? -(o.bob ?? 0)))]);
    out.push(['armF', ...T(h[0] - 5, h[1] - 1)]);
    if (o.spread) out.push(['armUp', ...T((o.lean ?? 0) - 1, 1 + (o.bob ?? 0))]);
    return out;
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1 });
pose('windup0', { lean: -1, bob: 0, sy: -2, staff: 'staff0', spread: true, headPart: 'headBack', lf: -1, lb: 1 });
pose('windup1', { lean: -1, bob: 0, sy: -4, staff: 'staffB', spread: true, headPart: 'headBack', disc: 'hi', lf: -1, lb: 1 });
pose('hurt0', { lean: -1, bob: 1, sx: -1, headPart: 'headHurt' });

const staffLying = outline(rows(`
  ooooooGGR
`), 'l');
export default {
  name: 'sunpriest', title: 'Sun Priest', notes: 'Crimson/orange robed caster with a gold sun-disc halo and a medallion staff. windup = staff and hand raised, disc lifts. No strike.',
  cell: [28, 25], shadow: [10, 3], pivot: [14, 22], palette, post,
  parts: { ...parts, staffLying }, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['staffLying', 17, 23]] } },
  anims: {
    walk: { fps: 6, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 2, frames: ['windup0', 'windup1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
