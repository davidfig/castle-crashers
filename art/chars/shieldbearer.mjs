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
const headHurt = rows(`
  .ZZZZ.
  ZXXXXZ
  ZXlZZZ
  .ZZZZ.
`);
const parts = { head, headHurt, robe, shoe, slab };
const rig = robedRig({
  OX: 5, OY: 3, parts, shoe,
  layout: { robe: [3, 5], head: [3, 1], legB: [3, 9], legF: [5, 9], sleeve: null },
  prop(o, h, { T }) { return [['slab', ...T(7 + (o.sx ?? 0) + (o.lean ?? 0), 4 + (o.bob ?? 0) + (o.sy ?? 0))]]; },
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1 });
pose('windup0', { lean: -1, bob: 1, sx: -1, lf: -1, lb: 1 });                 // slab drawn back
pose('windup1', { lean: -2, bob: 1, sx: -2, sy: -1, lf: -1, lb: 1 });
pose('strike0', { lean: 2, bob: 1, sx: 2, lf: 2, lb: -2 });                   // BASH: slab driven forward
pose('strike1', { lean: 1, bob: 1, sx: 1, lf: 1, lb: -1 });
pose('hurt0', { lean: -1, bob: 1, sx: -1, headPart: 'headHurt' });

export default {
  name: 'shieldbearer', title: 'Shield bearer', notes: 'Steel helm + iron slab held forward (blocks frontal hits).',
  cell: [22, 15], shadow: [12, 4], pivot: [11, 13], palette, post,
  parts, frames: rig.frames,
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
