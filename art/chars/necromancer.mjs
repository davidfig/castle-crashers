// NECROMANCER — hooded dark-robed death mage (~12px). Black/violet robe with bone trim, a skull-topped staff with a green
// soul-glow. The staff is baked into every pose. windup = staff thrust high, glow blazing, free hand spread (it summons
// skeletons). Caster: no strike. Poses: walk (shuffle), idle, windup, hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, v: '#2a1f45', V: '#4b3578', h: '#7a5ab8', k: '#0e0a1a', u: '#b8ffc4', U: '#4fd978', d: '#1f7a46' };
const post = { ink: 'l', all: true };

const head = rows(`
  .vvv.
  vvVvv
  vkkUv
  .vkk.
`);
const headHurt = rows(`
  .vvv.
  vvVvv
  vkkkv
  .vkk.
`);
const headBack = rows(`
  .vvv.
  vvVvv
  vkUUv
  .vkk.
`);
const robe = rows(`
  .vvVvv.
  vvVVvvv
  vvwvvvv
  vvvwvvv
  vvvvvvv
  wvwvwvw
`);
const shoe = rows(`
  vv
`);
// skull-topped staff: o pole, skull W, soul-glow above. Anchor = where the hand grips (pole, 4 rows below the skull).
const staff = (glow, len = 8) => {
  const out = glow === 2 ? ['.u.u.', 'uUuUu', '.UUU.', '.WWW.', '.WlW.', '..W..'] : ['..u..', '.UuU.', '.WWW.', '.WlW.', '..W..'];
  for (let i = 0; i < len; i++) out.push('..o..');
  return { rows: out, ax: 2, ay: out.length - len + 2 };
};
const armF = rows(`
  vvvv
  vVvv
`);
const armUp = rows(`
  W.W.
  WWW.
  .vV.
  ..vv
`);
const parts = { head, headHurt, headBack, robe, shoe, armF, armUp,
  staff0: staff(1, 7), staffB: staff(2, 7) };

const rig = robedRig({
  OX: 7, OY: 9, parts, shoe,
  layout: { robe: [2, 4], head: [3, 0], legB: [3, 10], legF: [5, 10], sleeve: null, hand: [10, 6] },
  prop(o, h, { T }) {
    const out = [];
    if (o.noweapon) return out;
    out.push([o.staff ?? 'staff0', ...T(h[0] + (o.sx ?? 0), h[1] + (o.sy ?? -(o.bob ?? 0)))]);
    out.push(['armF', ...T(h[0] - 3, h[1] - 1)]);
    if (o.spread) out.push(['armUp', ...T((o.lean ?? 0) - 1, 1 + (o.bob ?? 0))]);
    return out;
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1 });
pose('windup0', { lean: -1, bob: 0, sy: -2, sx: 0, staff: 'staff0', spread: true, headPart: 'headBack', lf: -1, lb: 1 });
pose('windup1', { lean: -1, bob: 0, sy: -4, sx: 0, staff: 'staffB', spread: true, headPart: 'headBack', lf: -1, lb: 1 });
pose('hurt0', { lean: -1, bob: 1, sx: -1, headPart: 'headHurt' });

const staffLying = outline(rows(`
  oooooWUu
`), 'l');
export default {
  name: 'necromancer', title: 'Necromancer', notes: 'Hooded death mage. Staff baked in; windup = staff raised, glow bright, hand spread (summons). No strike.',
  cell: [24, 21], shadow: [10, 3], pivot: [12, 19], palette, post,
  parts: { ...parts, staffLying }, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['staffLying', 15, 20]] } },
  anims: {
    walk: { fps: 6, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 2, frames: ['windup0', 'windup1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
