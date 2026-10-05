// GOBLIN — the horde grunt. Game scale: ~8px of body + outline. Hunched green imp with long ears, a gold eye, a crimson rag.
// The game animates lean/lunge and draws the dagger (see weapons.mjs), so the sprite is weaponless: just a walk cycle.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  n.nnn
  nnnnY
  .nnn.
`);
const robe = rows(`
  .nnn.
  nmmnn
  .nRn.
`);
const shoe = rows(`
  n.
  nn
`);
const parts = { head, robe, shoe };
const rig = robedRig({
  OX: 1, OY: 2, parts, shoe,
  layout: { robe: [3, 3], head: [4, 0], legB: [3, 6], legF: [5, 6], sleeve: null },
  prop: () => [],
});
const { pose } = rig;

pose('walk0', { bob: 1, lf: 1, lb: -1, lbl: 0 });
pose('walk1', { bob: 0, lf: 0, lb: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1, lfl: 0 });
pose('walk3', { bob: 0, lf: 0, lb: 0 });

export default {
  name: 'goblin', title: 'Goblin', notes: 'Horde grunt. Weaponless walk cycle; the game draws the dagger.',
  cell: [12, 11], shadow: [8, 3], pivot: [6, 8], palette, post,
  parts, frames: rig.frames,
  anims: { walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] } },
};
