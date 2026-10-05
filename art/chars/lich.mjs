// LICH — a tall skeletal sorcerer-king (~15px). Bone-white skull under a tarnished gold crown, tattered violet robe with a high
// collar, a staff topped by a violet-white gem. The staff is baked into every pose. windup = both arms and the staff thrust
// straight forward (right), gem blazing: it fires a locked death-ray from the gem. Caster: no strike.
// Poses: walk (a stately glide), idle, windup, hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, v: '#2c2147', V: '#52397f', h: '#7d5cc0', k: '#0e0a1a', p: '#8a4aff', P: '#c89aff', u: '#f6eaff', g: '#9a7a2c', G: '#d8b24a' };
const post = { ink: 'l', all: true };

const head = rows(`
  .XXXX
  XXkXk
  ZXXkX
  .ZlXl
`);
const headHurt = rows(`
  .XXXX
  XXlXl
  ZXXlX
  .ZlXl
`);
const headBlaze = rows(`
  .XXXX
  XXPXP
  ZXXkX
  .ZlXl
`);
const hat = rows(`
  G.G.G
  gGgGg
`);
// high collar rising behind the skull, torn into points
const collar = rows(`
  v.....v
  vV...Vv
  vVv.vVv
  vvvvvvv
`);
const robe = rows(`
  .vvVvv.
  vvvVvvv
  vvgGgvv
  vvvvvvv
  vvvVvvv
  vvvvvvv
  v.vvvvv
  v..vv.v
`);
const shoe = rows(`
  w.
  ww
`);
const staff = (big) => {
  const out = big
    ? ['..u..', '.uPu.', 'uPuPu', '.uPu.', '.GuG.', '..g..']
    : ['..P..', '.PuP.', '..P..', '.GpG.', '..g..'];
  for (let i = 0; i < 12; i++) out.push('..o..');
  return { rows: out, ax: 2, ay: out.length - 12 + 3 };
};
// level staff for the death-ray windup: grip at the left, gem at the tip
const staffH = (big) => ({
  rows: big
    ? ['........u..', '.......uPu.', 'oooooogGPuP', '.......uPu.', '........u..']
    : ['...........', '.......P...', 'ooooooogPuP', '.......P...', '...........'],
  ax: 3, ay: 2,
});
const armFwd = rows(`
  vvvvW
  .VVvW
`);
const armRaise = rows(`
  vvv
  vVv
`);
const parts = { head, headHurt, headBlaze, hat, collar, robe, shoe, armFwd, armRaise,
  staff0: staff(false), staff1: staff(false), staffH0: staffH(false), staffH1: staffH(true) };

const rig = robedRig({
  OX: 11, OY: 5, parts, shoe,
  layout: { robe: [1, 6], head: [2, 2], hat: [2, 0], legB: [2, 14], legF: [4, 14], sleeve: null, hand: [9, 9] },
  prop(o, h, { T }) {
    const out = [];
    if (o.noweapon) return out;
    // the collar goes behind the skull but over the robe: add it here (prop is drawn after head, so place it as a back piece instead)
    out.push([o.staff ?? 'staff0', ...T(h[0], h[1] + (o.sy ?? -(o.bob ?? 0)))]);
    if (o.arms === 'fwd') {
      out.push(['armFwd', ...T(h[0] - 4, h[1] - 1)]);
      out.push(['armFwd', ...T(h[0] - 5, h[1] + 1)]);
    } else {
      out.push(['armRaise', ...T(h[0] - 3, h[1] - 1)]);
    }
    return out;
  },
  propBack(o) { return []; },
});
const { pose, frames, T } = rig;
// the collar must sit between the robe and the head: rebuild each frame inserting it before the head entry
const withCollar = (name) => {
  const f = frames[name];
  const hi = f.findIndex((e) => e[0] && /^head/.test(e[0]));
  const [, hx, hy] = f[hi];
  f.splice(hi, 0, ['collar', hx - 1, hy + 2]);
};
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1, rb: 1 });
pose('walk1', { bob: 0, rb: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1, rb: 2 });
pose('walk3', { bob: 0, rb: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, rb: 1 });
pose('windup0', { bob: 0, lean: 1, staff: 'staffH0', arms: 'fwd', sy: -2, hand: [10, 9], rb: 1, lf: 1, lb: -1 });
pose('windup1', { bob: 0, lean: 2, staff: 'staffH1', arms: 'fwd', sy: -2, hand: [10, 9], rb: 1, lf: 1, lb: -1, headPart: 'headBlaze' });
pose('hurt0', { bob: 1, lean: -1, headPart: 'headHurt' });
for (const n of Object.keys(frames)) if (n !== 'bare') withCollar(n); else withCollar(n);

const staffLying = outline(rows(`
  ooooogGPu
`), 'l');
export default {
  name: 'lich', title: 'Lich', notes: 'Skeletal sorcerer-king. Staff baked in; windup = arms + staff thrust forward, gem blazing (fires the beam). No strike.',
  cell: [32, 25], shadow: [10, 3], pivot: [16, 20], palette, post,
  parts: { ...parts, staffLying }, frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['staffLying', 18, 23]] } },
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 2, frames: ['windup0', 'windup1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
