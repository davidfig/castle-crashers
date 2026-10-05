// DRUMMER — goblin war-drummer. A bulky goblin (~11px tall) with a big hide war drum slung on his belly and a mallet in each
// fist. Poses: walk, idle, windup (mallets raised: the rally beat), strike (mallets down on the drum), hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, outline, line } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  n..nnn
  nnnnnY
  .nnnn.
`);
const headRoar = rows(`
  n..nnn
  nnnnnY
  .nRRn.
`);
const headHurt = rows(`
  n..nnn
  nnnnnl
  .nRnn.
`);
const robe = rows(`
  .nnnnn.
  nnmmnnn
  nnnnnnn
  .nnnnn.
  .nRRRn.
`);
const shoe = rows(`
  nn
  nn
`);
// the war drum: hide face, pale rim, lacing
const drum = rows(`
  .WWWWW.
  RRRRRRr
  RGRGRGr
  RRRRRRr
  .rrrrr.
`);
const drumHit = rows(`
  .WWWWW.
  RYYYYYr
  RGYGYGr
  RRYYRRr
  .rrrrr.
`);
const drumLying = outline(rows(`
  WWWWW
  RGRGR
  rrrrr
`), 'l');
const parts = { head, headRoar, headHurt, robe, shoe, drum, drumHit, drumLying };
const rig = robedRig({
  OX: 5, OY: 6, parts, shoe,
  layout: { robe: [3, 3], head: [4, 0], legB: [3, 8], legF: [6, 8], sleeve: null, hand: [8, 4] },
  prop(o, h, { T }) {
    if (o.noweapon) return [];
    return [[o.hit ? 'drumHit' : 'drum', ...T(5 + (o.lean ?? 0), 4 + (o.bob ?? 0))]];
  },
});
const { pose } = rig;
// mallets: arms are drawn explicitly per pose via `mal` = [[x0,y0,x1,y1] ...] shoulder->head
// override prop result by wrapping pose: simplest is to append mallet entries as fx-free functions after the fact
const withMal = (name, o, list) => {
  pose(name, { ...o, noweapon: false });
  const T = rig.T;
  rig.frames[name].push(...list.map(([x0, y0, x1, y1]) => mallet2(T(x0, y0), T(x1, y1))));
};
function mallet2([x0, y0], [x1, y1]) {
  return (put) => {
    line([x0, y0], [x1, y1], 'n')(put);
    // mallet: stick continues past the fist, head is a 2x2 knob
    put(x1, y1, 'W'); put(x1 + 1, y1, 'w'); put(x1, y1 - 1, 'W'); put(x1 + 1, y1 - 1, 'w');
  };
}
withMal('bare', { noweapon: true }, []);
rig.frames.bare = rig.frames.bare.filter((e) => typeof e !== 'function');
const rest = (b) => [[5, 5 + b, 3, 7 + b], [9, 5 + b, 11, 4 + b]];       // mallets held up at the chest, heads above the drum
withMal('walk0', { bob: 1, lf: 1, lb: -1 }, rest(1));
withMal('walk1', { bob: 0 }, rest(0));
withMal('walk2', { bob: 1, lf: -1, lb: 1 }, rest(1));
withMal('walk3', { bob: 0 }, rest(0));
withMal('idle0', { bob: 0 }, rest(0));
withMal('idle1', { bob: 1 }, rest(1));
// windup: both mallets raised high; second frame higher with the head thrown back, roaring
withMal('windup0', { lean: -1, bob: 1, hx: -1, headPart: 'headRoar' }, [[5, 4, 4, 0], [9, 4, 12, 0]]);
withMal('windup1', { lean: -1, bob: 0, hx: -1, hy: -1, headPart: 'headRoar' }, [[5, 3, 3, -3], [9, 3, 13, -3]]);
// strike: mallets slam down on the drum face
withMal('strike0', { lean: 1, bob: 1, hit: true, hx: 1, headPart: 'headRoar' }, [[5, 4, 7, 5], [9, 4, 10, 5]]);
withMal('strike1', { lean: 0, bob: 1, hit: true }, [[5, 4, 7, 6], [9, 4, 11, 6]]);
withMal('hurt0', { lean: -1, hx: -1, hy: 1, bob: 1, headPart: 'headHurt' }, [[5, 5, 7, 7], [7, 5, 8, 8]]);
const frames = rig.frames;

export default {
  name: 'drummer', title: 'Drummer', notes: 'Goblin war-drummer. windup = mallets raised (rally beat), strike = mallets down.',
  cell: [24, 18], shadow: [10, 3], pivot: [12, 16], palette, post,
  parts, frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['drumLying', 14, 16]] } },
  anims: {
    walk: { fps: 7, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
