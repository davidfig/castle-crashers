// BONE ARCHER — skeleton archer. Same bone look as the skeleton; a bow carried low, drawn on `aim` (also the windup),
// `release` as the string snaps. Fires volleys of two arrows (the game draws the arrows).
import { GLASS as G } from '../palette.mjs';
import { rows, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  .WWW.
  WlWlW
  WWWWw
  .wWw.
`);
const headHurt = rows(`
  .WWW.
  WWlWW
  WWWWw
  .wWw.
`);
const robe = rows(`
  wWWWw
  .WlW.
  .wlw.
  .WlW.
  .RRr.
`);
const shoe = rows(`
  .W
  .W
  WW
`);
function bowEntry(gx, gy, aim, slack = false) {
  return (put) => {
    if (!aim) {
      for (let dx = -4; dx <= 4; dx++) put(gx + dx, gy - Math.round(1.8 * (1 - (dx / 4) ** 2)), Math.abs(dx) > 2 ? 'G' : 'g');
      put(gx - 4, gy, 'z'); put(gx + 4, gy, 'z');
    } else {
      for (let dy = -4; dy <= 4; dy++) put(gx + Math.round(1.8 * (1 - (dy / 4) ** 2)), gy + dy, Math.abs(dy) > 2 ? 'G' : 'g');
      if (slack) { for (let dy = -4; dy <= 4; dy++) put(gx, gy + dy, 'w'); }
      else { put(gx - 1, gy - 4, 'w'); put(gx - 2, gy - 3, 'w'); put(gx - 2, gy + 3, 'w'); put(gx - 1, gy + 4, 'w'); for (let dy = -3; dy <= 3; dy++) put(gx - 2, gy + dy, 'w'); }
    }
  };
}
const bowLying = outline(rows(`
  .gggggg.
  G......G
`), 'l');
const parts = { head, headHurt, robe, shoe, bowLying };
const rig = robedRig({
  OX: 3, OY: 4, parts, shoe,
  layout: { robe: [2, 4], head: [2, 0], legB: [2, 8], legF: [4, 8], sleeve: null },
  prop(o, h, { T }) { const bob = o.bob ?? 0, lean = o.lean ?? 0; if (o.nobow) return [];
    return [bowEntry(...T((o.aim ? 7 : 4) + lean, (o.aim ? 5 : 6) + bob), !!o.aim, !!o.slack)]; },
});
const { pose } = rig;
pose('bare', { nobow: true });
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0, hx: 1 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1 });
pose('aim0', { aim: true, bob: 0, lean: -1 });
pose('aim1', { aim: true, bob: 0, lean: -1, hx: -1 });          // string drawn to the cheek: head pulls back a pixel
pose('release0', { aim: true, slack: true, bob: 1, lean: -1 });
pose('hurt0', { bob: 1, lean: -1, hx: -1, hy: 1, headPart: 'headHurt' });

export default {
  name: 'bonearcher', title: 'Bone Archer', notes: 'Skeleton archer; bow carried low, drawn on `aim`/`windup`, `release` on the shot.',
  cell: [18, 16], shadow: [8, 3], pivot: [9, 14], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['bowLying', 10, 14]] } },
  anims: {
    walk: { fps: 9, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['aim0', 'aim1'] },
    aim: { fps: 2, frames: ['aim0', 'aim1'] },
    release: { fps: 1, frames: ['release0'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
