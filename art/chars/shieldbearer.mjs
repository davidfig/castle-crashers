// SHIELD BEARER — steel bucket-helm behind a battered iron slab held forward. Reads as "hit it from the side".
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  .ZZZZ.
  ZXXXXZ
  ZXllZZ
  .ZZZZ.
`);
const robe = rows(`
  .zZZZz.
  zZZZZZz
  zZZZZZz
  .zRRRz.
`);
const shoe = rows(`
  .z.
  zzz
`);
const slab = rows(`
  XXXXX
  XZZZZ
  XZzZZ
  XZZzZ
  XZZZZ
  XzzzZ
  .zzzz
`);
const parts = { head, robe, shoe, slab };
const rig = robedRig({
  OX: 2, OY: 3, parts, shoe,
  layout: { robe: [3, 5], head: [3, 1], legB: [3, 9], legF: [5, 9], sleeve: null },
  prop(o, h, { T }) { return [['slab', ...T(7, 4 + (o.bob ?? 0))]]; },
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });

export default {
  name: 'shieldbearer', title: 'Shield bearer', notes: 'Steel helm + iron slab held forward (blocks frontal hits).',
  cell: [18, 15], shadow: [12, 4], pivot: [8, 13], palette, post,
  parts, frames: rig.frames,
  anims: { walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] } },
};
