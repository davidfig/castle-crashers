// PEDDLER — the merchant at the camp (docs/05-items-trading.md). A hooded traveller bent under a pack hung with pots, a lantern
// in one hand. Game scale like the cleric (~19px incl. outline). Poses: idle (the pack shifts) and talk (the lantern lifts as
// they lean in to haggle). The UI shows them at 3x beside the stall.
import { GLASS as G } from '../palette.mjs';
import { rows, shear } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  .SSS.
  SSSSe
  SSSss
  .sss.
`);
const headLean = rows(`
  .SSS.
  SSSSe
  SSsss
  .sss.
`);
// the hood: deep, with a lighter rim
const hat = rows(`
  ..ooo..
  .ooOoo.
  oooOooo
  oOOOOOo
`);
const robe = rows(`
  .ooOoo.
  ooOttOo
  oOtGtOo
  oOttOOo
  ooOOOoo
  wwwwwww
`);
const sleeve = rows(`
  oo
  sS
`);
const shoe = rows(`
  .oo
  ooo
`);
const lantern = rows(`
  .G.
  GYG
  GYG
  .G.
`);
// the pack, drawn behind: a bedroll on top, a patched sack, a pot and a cup swinging from the bottom
const pack = rows(`
  .ooooo.
  oOOtOOo
  oOtttOo
  oOOtOGo
  oOOOOOo
  .oOZOo.
  ..oZo..
`);
const parts = { head, headLean, hat, sleeve, shoe, lantern, pack };
for (let i = 0; i < 3; i++) parts['robe' + i] = i === 0 ? robe : shear(robe, (y, n) => (i === 1 ? 1 : -1) * Math.pow(y / (n - 1), 2) * 1.1);

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe,
  layout: { back: [1, 5], robe: [7, 7], head: [8, 3], hat: [7, 0], legB: [8, 13], legF: [10, 13], hand: [13, 9], sleeve: [-1, -1] },
  prop(o, h, { T }) { return [['lantern', ...T(h[0] + 1, h[1] + 1)]]; },
});
const { pose } = rig;

pose('idle0', { back: 'pack' });
pose('idle1', { back: 'pack', bob: 1, rb: 1 });
pose('idle2', { back: 'pack', bob: 1, rb: 2, hy: 1 });
pose('idle3', { back: 'pack', rb: 1 });
pose('talk0', { back: 'pack', hand: [13, 8], lean: 1, rb: 1 });
pose('talk1', { back: 'pack', hand: [14, 6], lean: 1, bob: 1, headPart: 'headLean', rb: 2 });
pose('talk2', { back: 'pack', hand: [14, 7], lean: 1, rb: 1 });
pose('talk3', { back: 'pack', hand: [13, 9], bob: 1, headPart: 'headLean', rb: 0 });

export default {
  name: 'peddler', title: 'Peddler', notes: 'The camp merchant. Shown beside the stall (idle, talk). Game scale like the cleric.',
  cell: [46, 44], shadow: [9, 5], pivot: [20, 28], palette, post,
  parts, frames: rig.frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    talk: { fps: 5, frames: ['talk0', 'talk1', 'talk2', 'talk3'] },
  },
};
