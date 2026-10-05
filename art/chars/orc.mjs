// ORC — the brute (and the charger). ~13px of body + outline. Broad, hunched, brown hide, jutting tusks, one iron
// pauldron. The game draws the club and the charge/windup poses; the sprite is a weaponless walk cycle.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  .ooo..
  oOOOOe
  oOOOOY
  .OWWW.
`);
const robe = rows(`
  .ZZZOOO.
  ZZXZOOOO
  ZZZZOOOO
  .OOOtOO.
  .OOOOOO.
  .oRRRRo.
`);
const shoe = rows(`
  .oo
  .oo
  ooo
`);
const parts = { head, robe, shoe };
const rig = robedRig({
  OX: 2, OY: 2, parts, shoe,
  layout: { robe: [3, 4], head: [4, 0], legB: [4, 10], legF: [7, 10], sleeve: null },
  prop: () => [],
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1, lbl: 0 });
pose('walk1', { bob: 0, lf: 0, lb: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0, lf: 0, lb: 0 });

export default {
  name: 'orc', title: 'Orc', notes: 'Brute / charger. Weaponless walk cycle; the game draws the club.',
  cell: [18, 16], shadow: [14, 4], pivot: [9, 14], palette, post,
  parts, frames: rig.frames,
  anims: { walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] } },
};
