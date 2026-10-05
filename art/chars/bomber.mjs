// BOMBER — a round crimson fuse-bomb on scampering legs with a grin and a sparking fuse. The game swells and
// flashes it while the fuse burns; the sprite is a scamper cycle.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const robe = rows(`
  ..rr..
  .rRRr.
  rRRqRr
  rRYlYr
  rRRRRr
  .rrrr.
`);
const head = rows(`
  .g.Y
  .gY.
`);
const shoe = rows(`
  .l.
  ll.
`);
const parts = { head, robe, shoe };
const rig = robedRig({
  OX: 2, OY: 1, parts, shoe,
  layout: { robe: [2, 2], head: [3, 0], legB: [3, 8], legF: [5, 8], sleeve: null },
  prop: () => [],
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });

export default {
  name: 'bomber', title: 'Bomber', notes: 'Fuse bomb. Scamper cycle; the game swells/flashes it on the fuse.',
  cell: [10, 12], shadow: [7, 3], pivot: [5, 9], palette, post,
  parts, frames: rig.frames,
  anims: { walk: { fps: 10, frames: ['walk0', 'walk1', 'walk2', 'walk3'] } },
};
