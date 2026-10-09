// HERALD — the Crown's voice on the road (docs/12-story.md). A lapis tabard barred in gold, a plumed cap, a long trumpet. He reads
// the proclamations. Poses are idle and talk (the trumpet lifts as he calls out). Game scale like the cleric.
import { GLASS as G } from '../palette.mjs';
import { rows, shear } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  SSSS.
  SSSSe
  SSSss
  .sss.
`);
const headCall = rows(`
  SSSS.
  SSSSe
  SSSSs
  .sss.
`);
const hat = rows(`
  ....RR.
  ..bbbRq
  .bbbbb.
  bbbbbbb
`);
const robe = rows(`
  .bbbbb.
  abbGbba
  abbGbba
  aGGGGGa
  aaaGaaa
  GGGGGGG
`);
const sleeve = rows(`
  bb
  sS
`);
const shoe = rows(`
  .aa
  aaa
`);
const trumpet = rows(`
  .....G.
  GGGGGYG
  .....G.
`);
const parts = { head, headCall, hat, sleeve, shoe, trumpet };
for (let i = 0; i < 3; i++) parts['robe' + i] = i === 0 ? robe : shear(robe, (y, n) => (i === 1 ? 1 : -1) * Math.pow(y / (n - 1), 2) * 1.1);

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe,
  layout: { robe: [7, 7], head: [8, 3], hat: [7, 0], legB: [8, 13], legF: [10, 13], hand: [13, 9], sleeve: [-1, -1] },
  prop(o, h, { T }) { return [['trumpet', ...T(h[0] - 2, h[1] - 1)]]; },
});
const { pose } = rig;

pose('idle0', {});
pose('idle1', { bob: 1, rb: 1 });
pose('idle2', { bob: 1, rb: 2 });
pose('idle3', { rb: 1 });
pose('talk0', { hand: [13, 7], rb: 1 });
pose('talk1', { hand: [14, 5], bob: 1, headPart: 'headCall', rb: 2 });
pose('talk2', { hand: [14, 6], rb: 1 });
pose('talk3', { hand: [13, 8], bob: 1, headPart: 'headCall', rb: 0 });

export default {
  name: 'herald', title: 'Herald', notes: "The Crown's voice. Never fights; stands in the field with the court and talks (idle, talk). Game scale like the cleric.",
  cell: [46, 44], shadow: [9, 5], pivot: [20, 28], palette, post,
  parts, frames: rig.frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    talk: { fps: 5, frames: ['talk0', 'talk1', 'talk2', 'talk3'] },
  },
};
