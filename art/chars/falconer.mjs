// FALCONER — ranged desert hunter: a long deep-teal cloak, a wide indigo-and-rust headcloth with a dark face and a gold eye,
// a leather gauntlet on the raised fist with a hooded falcon perched on it. `aim` = arm raised with the falcon on the fist;
// `release` = arm thrown forward, empty fist (the game draws the falcon as a projectile that homes in).
import { GLASS as G } from '../palette.mjs';
import { rows, outline, line } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// a/b/c teal cloak, r/o rust headcloth, i indigo, t dark skin, k dark leather, K leather, F buff breast, p/P falcon (brown/ochre), h hood
const palette = { l: G.lead, e: G.lead, ...G, a: '#0f3a40', b: '#1c6a6a', c: '#3c9a88', r: '#6a1c14', o: '#b0401e', i: '#2a2a78', I: '#4a52b0', t: '#6a3a22', k: '#2a1810', K: '#6a4224', p: '#4a2c1a', P: '#a86a30', h: '#a82818', F: '#ecd8a4' };
const post = { ink: 'l', all: true };

const head = rows(`
  .iiiii.
  iIIioIi
  rottYtr
  .rttt..
`);
const headHurt = rows(`
  .iiiii.
  iIIioIi
  rottltr
  .rttt..
`);
const robe = rows(`
  ..bbbb.
  .bbcbbb
  .bbbbbb
  abbbbba
  abbbbba
  abbbbbb
`);
const shoe = rows(`
  .k.
  kk.
`);
// the arm is a little cloak sleeve + a leather gauntlet; the falcon perches on the fist (hooded: a red cap, no eye)
const falcon = rows(`
  ..hhh..
  .phhhp.
  pppFFp.
  ppPFFFp
  .pPFFp.
  pp.FFp.
  p..pp..
`);
function armEntry(sx, sy, fx, fy) {                   // cloak sleeve from the shoulder to the gauntlet fist
  return (put) => {
    line([sx, sy], [fx - 1, fy], 'b')(put); line([sx, sy + 1], [fx - 1, fy + 1], 'a')(put);
    put(fx, fy, 'K'); put(fx + 1, fy, 'K'); put(fx, fy + 1, 'k'); put(fx + 1, fy + 1, 'k');
  };
}
const falconLying = outline(rows(`
  .hpPPp.
  pPPPpp.
`), 'l');
const parts = { head, headHurt, robe, shoe, falcon, falconLying };
const rig = robedRig({
  OX: 3, OY: 7, parts, shoe,
  layout: { robe: [3, 4], head: [3, 0], legB: [3, 10], legF: [5, 10], sleeve: null },
  prop(o, h, { T }) {
    const bob = o.bob ?? 0, lean = o.lean ?? 0;
    if (o.bare) return [];
    const sh = T(8 + lean, 6 + bob);
    if (o.mode === 'aim') { const [x, y] = T(12 + lean, 3 + bob); return [armEntry(...sh, x, y), ['falcon', x - 2, y - 5]]; }
    if (o.mode === 'release') { const [x, y] = T(14 + lean, 5 + bob); return [armEntry(...sh, x, y)]; }
    const [x, y] = T(11 + lean, 8 + bob); return [armEntry(...sh, x, y), ['falcon', x - 2, y - 5]];
  },
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1 });
pose('aim0', { mode: 'aim', bob: 0, lean: -1 });
pose('release0', { mode: 'release', bob: 1, lean: 1 });
pose('bare', { bare: true });
pose('hurt0', { bob: 1, lean: -1, hx: -1, hy: 1, headPart: 'headHurt' });

export default {
  name: 'falconer', title: 'Falconer', notes: 'Ranged. aim = falcon raised on the gauntlet; release = arm flung out, empty fist (the game draws the bird).',
  cell: [24, 20], shadow: [8, 3], pivot: [12, 18], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['falconLying', 15, 18]] } },
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    aim: { fps: 1, frames: ['aim0'] },
    release: { fps: 1, frames: ['release0'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
