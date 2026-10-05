// REGISTRAR — the Tally Office's face (docs/12-story.md). Polite, calm, pleased with your work. Authored at game scale like the
// cleric (~19px incl. outline): a dark lapis robe with a crimson sash and gold buttons, a flat crimson scholar's cap, round
// spectacles that catch the light, and a ledger held open in front. Never fights: poses are idle (a slow breath) and talk
// (the ledger lifts, a small nod). The UI shows him at 3x beside the Registrar's lines.
import { GLASS as G } from '../palette.mjs';
import { rows, shear } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  SSSS.
  SYSYe
  SSSss
  .sss.
`);
const headNod = rows(`
  SSSS.
  SYSYe
  SSsss
  .sss.
`);
// a flat scholar's cap: crimson crown, a gold band
const hat = rows(`
  ..rrr..
  .rrRrr.
  rrrrrrr
  GGGGGGG
`);
const robe = rows(`
  .aaaaa.
  aaRGRaa
  aaaGaaa
  aaRGRaa
  aaaaaaa
  rrrrrrr
`);
const sleeve = rows(`
  aa
  sS
`);
const shoe = rows(`
  .aa
  aaa
`);
// the ledger, open: vellum pages in a gold-cornered cover, a quill laid across it
const ledger = rows(`
  ..W..
  GWWWG
  GwWwG
  GWWWG
  rGGGr
`);
const parts = { head, headNod, hat, sleeve, shoe, ledger };
for (let i = 0; i < 3; i++) parts['robe' + i] = i === 0 ? robe : shear(robe, (y, n) => (i === 1 ? 1 : -1) * Math.pow(y / (n - 1), 2) * 1.1);

const rig = robedRig({
  OX: 10, OY: 14, parts, shoe,
  layout: { robe: [7, 7], head: [8, 3], hat: [7, 0], legB: [8, 13], legF: [10, 13], hand: [13, 9], sleeve: [-1, -1] },
  prop(o, h, { T }) { return [['ledger', ...T(h[0] - 3, h[1] - 1)]]; },
});
const { pose } = rig;

pose('idle0', {});
pose('idle1', { bob: 1, rb: 1 });
pose('idle2', { bob: 1, rb: 2 });
pose('idle3', { rb: 1 });
pose('talk0', { hand: [13, 8], rb: 1 });
pose('talk1', { hand: [13, 7], bob: 1, headPart: 'headNod', rb: 2 });
pose('talk2', { hand: [13, 8], rb: 1 });
pose('talk3', { hand: [13, 9], bob: 1, headPart: 'headNod', rb: 0 });

export default {
  name: 'registrar', title: 'Registrar', notes: 'The Tally Office. Never fights; shown beside his lines (idle, talk). Game scale like the cleric.',
  cell: [46, 44], shadow: [9, 5], pivot: [20, 28], palette, post,
  parts, frames: rig.frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    talk: { fps: 5, frames: ['talk0', 'talk1', 'talk2', 'talk3'] },
  },
};
