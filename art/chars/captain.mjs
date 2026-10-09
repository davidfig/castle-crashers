// CAPTAIN — the king's guard on the road (docs/12-story.md). Steel plate under a crimson tabard, a plumed helm, a long spear grounded
// at his side. The one of the court who has seen the field up close. Poses are idle and talk. Game scale like the cleric.
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
const headNod = rows(`
  SSSS.
  SSSSe
  SSsss
  .sss.
`);
const hat = rows(`
  ...R...
  .XZZZz.
  ZZZZZZz
  zzzzzzz
`);
const robe = rows(`
  .XZZZz.
  zZRRRZz
  zZRGRZz
  zZRRRZz
  zzRRRzz
  zzzzzzz
`);
const sleeve = rows(`
  Zz
  sS
`);
const shoe = rows(`
  .zz
  zzz
`);
const spear = rows(`
  .X.
  XZX
  .z.
  .o.
  .o.
  .o.
  .o.
  .o.
  .o.
  .o.
  .o.
  .o.
  .o.
  .o.
`);
const parts = { head, headNod, hat, sleeve, shoe, spear };
for (let i = 0; i < 3; i++) parts['robe' + i] = i === 0 ? robe : shear(robe, (y, n) => (i === 1 ? 1 : -1) * Math.pow(y / (n - 1), 2) * 1.1);

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe,
  layout: { robe: [7, 7], head: [8, 3], hat: [7, 0], legB: [8, 13], legF: [10, 13], hand: [13, 9], sleeve: [-1, -1] },
  prop(o, h, { T }) { return [['spear', ...T(h[0] - 1, 1 + (h[1] - 9))]]; },
});
const { pose } = rig;

pose('idle0', {});
pose('idle1', { bob: 1, rb: 1 });
pose('idle2', { bob: 1, rb: 2 });
pose('idle3', { rb: 1 });
pose('talk0', { rb: 1 });
pose('talk1', { bob: 1, headPart: 'headNod', rb: 2 });
pose('talk2', { rb: 1 });
pose('talk3', { bob: 1, headPart: 'headNod', rb: 0 });

export default {
  name: 'captain', title: 'Captain', notes: "The king's guard. Never fights; stands with the court and talks (idle, talk). Game scale like the cleric.",
  cell: [46, 44], shadow: [9, 5], pivot: [20, 28], palette, post,
  parts, frames: rig.frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    talk: { fps: 5, frames: ['talk0', 'talk1', 'talk2', 'talk3'] },
  },
};
