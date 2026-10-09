// ELDER — a goblin elder of the Wild (docs/12-story.md). Old, small and unhurried: a deep brown hood, a white beard, a bone-bead collar on a
// green robe, a gnarled staff topped with a charm. Where the court talks at the party, the elder talks to it. Poses are idle and talk
// (the staff lifts, a slow nod). Game scale like the cleric.
import { GLASS as G } from '../palette.mjs';
import { rows, shear } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  mmmm.
  mmmme
  mWWWW
  .WWW.
`);
const headNod = rows(`
  mmmm.
  mmmme
  mmWWW
  .WWW.
`);
const hat = rows(`
  ...o...
  ..ooO..
  .ooOoo.
  oooOooo
`);
const robe = rows(`
  .nnmnn.
  nnWmWnn
  nnnWnnn
  nnnnnnn
  nnnnnnn
  wwwwwww
`);
const sleeve = rows(`
  nn
  mm
`);
const shoe = rows(`
  .oo
  ooo
`);
const staff = rows(`
  .W.
  WwW
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
  .o.
`);
const parts = { head, headNod, hat, sleeve, shoe, staff };
for (let i = 0; i < 3; i++) parts['robe' + i] = i === 0 ? robe : shear(robe, (y, n) => (i === 1 ? 1 : -1) * Math.pow(y / (n - 1), 2) * 1.1);

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe,
  layout: { robe: [7, 7], head: [8, 3], hat: [7, 0], legB: [8, 13], legF: [10, 13], hand: [13, 9], sleeve: [-1, -1] },
  prop(o, h, { T }) { return [['staff', ...T(h[0] - 1, 1 + (h[1] - 9))]]; },
});
const { pose } = rig;

pose('idle0', {});
pose('idle1', { bob: 1, rb: 1 });
pose('idle2', { bob: 1, rb: 2 });
pose('idle3', { rb: 1 });
pose('talk0', { hand: [13, 8], rb: 1 });
pose('talk1', { hand: [14, 7], bob: 1, headPart: 'headNod', rb: 2 });
pose('talk2', { hand: [14, 8], rb: 1 });
pose('talk3', { hand: [13, 9], bob: 1, headPart: 'headNod', rb: 0 });

export default {
  name: 'elder', title: 'Elder', notes: 'A goblin elder of the Wild. Never fights; talks to the party (idle, talk). Game scale like the cleric.',
  cell: [46, 44], shadow: [9, 5], pivot: [20, 28], palette, post,
  parts, frames: rig.frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    talk: { fps: 5, frames: ['talk0', 'talk1', 'talk2', 'talk3'] },
  },
};
