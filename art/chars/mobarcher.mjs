// ARCHER (enemy) — hooded violet cloak, two amber eyes in the hood, bow carried low across the body. `aim` shows the bow
// raised for the windup (the game draws the nocked arrow line).
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, a: '#2e1a5a', b: '#5a3aa0', c: '#9a7ae0' };
const post = { ink: 'l', all: true };

const head = rows(`
  .aaa.
  abbbb
  abllY
  .bbb.
`);
const robe = rows(`
  .bbbb.
  bbcbbb
  bbbbbb
  abbbba
  a.bb.a
`);
const shoe = rows(`
  .a.
  aa.
`);
function bowEntry(gx, gy, aim) {
  return (put) => {
    if (!aim) {                              // carried: horizontal, across the front at the waist, centred on the body
      for (let dx = -5; dx <= 5; dx++) put(gx + dx, gy - Math.round(2.2 * (1 - (dx / 5) ** 2)), Math.abs(dx) > 3 ? 'G' : 'g');
      put(gx - 5, gy, 'z'); put(gx + 5, gy, 'z');       // string only at the tips: keeps the bow from reading as a plank
    } else {                                 // aimed: upright, string drawn slightly
      for (let dy = -4; dy <= 4; dy++) put(gx + Math.round(1.8 * (1 - (dy / 4) ** 2)), gy + dy, Math.abs(dy) > 2 ? 'G' : 'g');
      put(gx - 1, gy - 4, 'w'); put(gx - 2, gy - 3, 'w'); put(gx - 2, gy + 3, 'w'); put(gx - 1, gy + 4, 'w');
      for (let dy = -3; dy <= 3; dy++) put(gx - 2, gy + dy, 'w');
    }
  };
}
const parts = { head, robe, shoe };
const rig = robedRig({
  OX: 3, OY: 4, parts, shoe,
  layout: { robe: [3, 4], head: [3, 0], legB: [3, 9], legF: [5, 9], sleeve: null },
  prop(o, h, { T }) { return [bowEntry(...T(o.aim ? 8 : 5, o.aim ? 6 : 8), !!o.aim)]; },
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('aim0', { aim: true, bob: 0, lean: -1 });

export default {
  name: 'mobarcher', title: 'Archer (enemy)', notes: 'Hooded violet archer; bow carried low, raised on `aim`.',
  cell: [12, 16], shadow: [8, 3], pivot: [6, 14], palette, post,
  parts, frames: rig.frames,
  anims: { walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] }, aim: { fps: 1, frames: ['aim0'] } },
};
