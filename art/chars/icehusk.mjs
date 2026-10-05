// ICE HUSK — a frozen-dead shambler, ~13px tall: dark blue-grey skin cracked with frost, a swollen torso studded with ice crystals,
// jagged ice shards growing from the shoulders and an icicle dripping from the jaw, arms reaching forward. On death it shatters
// and leaves a frost pool, so `dead` is a heap of broken ice.
// Poses: walk (lurching shamble), idle, windup (lurches back, belly swells), strike (flailing lunge), hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, stepLeg, line } from '../lib.mjs';

// y/Y = frozen skin (deep, mid), J/L = frost and ice glints, v = shadow
const palette = { l: G.lead, e: G.lead, ...G, y: '#2e4166', Y: '#4d6a9c', J: '#78a8dc', L: '#b4e8ff', v: '#1c2840' };
const post = { ink: 'l', all: true };

const head = rows(`
  .yYYy
  yYWlY
  yYYYY
  .ylly
`);
const headHurt = rows(`
  .yYYy
  yYllY
  yYYYY
  .ylLy
`);
const headOpen = rows(`
  .yYYy
  yYWlY
  yYYlY
  .yllL
`);
const belly = rows(`
  ..yYYYYy..
  .yYYJJYYy.
  yYYJLJYYYy
  yYYYYYLYYy
  yYLYYYYYYy
  .yYYYYYLy.
  ..zzZZzz..
`);
const bellyBig = rows(`
  ...yYYYYy...
  ..yYYJJYYy..
  .yYYJLJYYYy.
  yYYYYYYLYYYy
  yYLYYYYYYYLy
  yYYYJYYLYYYy
  .yYYYYYYYYy.
  ..zzZZZZzz..
`);
const shape = rows(`
  .zZ
  .zZ
  .yY
  zZZ
`);
const shards = rows(`
  .L..L.
  .LL.LL
  .JLLJ.
  .yJJy.
`);
const parts = { head, headHurt, headOpen, belly, bellyBig, shards };
const lg = (side, foot, lift = 0) => { const k = `leg${side}${foot}_${lift}`; if (!parts[k]) parts[k] = stepLeg(shape, foot, lift); return k; };
const arm = (sx, sy, hx, hy, col, dark) => (put) => {
  line([sx, sy + 1], [hx, hy + 1], dark)(put);
  line([sx, sy], [hx, hy], col)(put);
  put(hx + 1, hy, 'J'); put(hx + 1, hy + 1, 'J');
};
const drip = (x, y, n) => (put) => { for (let i = 0; i < n; i++) put(x, y + i, 'L'); };
const frames = {};
const pose = (name, o = {}) => {
  const { bob = 0, lean = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, hp = 'head', bp = 'belly', front = [18, 6], back = [16, 8], dr = 2 } = o;
  const X = 4 + lean, Y = 3 + bob;
  const bx = bp === 'bellyBig' ? X + 1 : X + 2;
  frames[name] = [
    arm(X + 9, Y + 5, 4 + back[0] + lean, Y + back[1], 'y', 'v'),
    [lg('B', lb, lbl), X + 3, 11], [lg('F', lf, lfl), X + 8, 11],
    [bp, bx, Y + 2 + (bp === 'bellyBig' ? -1 : 0)],
    ['shards', X + 5 + hx, Math.max(0, Y - 2 + hy)],
    [hp, X + 9 + hx, Y + hy],
    drip(X + 13 + hx, Y + hy + 4, dr),
    arm(X + 10, Y + 5, 4 + front[0] + lean, Y + front[1], 'Y', 'y'),
  ];
};
pose('walk0', { bob: 1, lean: 1, lf: 1, lb: -1, hy: 1, dr: 2, front: [19, 6], back: [17, 8] });
pose('walk1', { bob: 0, lean: 0, lfl: 1, hy: 0, dr: 1 });
pose('walk2', { bob: 1, lean: 0, lf: -1, lb: 1, hy: 1, dr: 3, front: [17, 7], back: [18, 6] });
pose('walk3', { bob: 0, lean: 0, lbl: 1, hy: 0, dr: 2 });
pose('idle0', { bob: 0, dr: 2 });
pose('idle1', { bob: 1, hy: 1, dr: 3, front: [18, 7] });
pose('windup0', { lean: -1, bob: 0, hx: -1, hy: -1, hp: 'headOpen', bp: 'bellyBig', lf: -1, lb: 1, front: [14, 8], back: [12, 9], dr: 3 });
pose('windup1', { lean: -2, bob: -1, hx: -1, hy: -1, hp: 'headOpen', bp: 'bellyBig', lf: -1, lb: 1, front: [13, 10], back: [11, 10], dr: 4 });
pose('strike0', { lean: 3, bob: 1, hx: 1, hy: 1, hp: 'headOpen', lf: 2, lb: -2, front: [22, 3], back: [21, 6], dr: 1 });
pose('strike1', { lean: 3, bob: 1, hx: 2, hy: 2, hp: 'headOpen', lf: 1, lb: -1, front: [21, 10], back: [20, 4], dr: 0 });
pose('hurt0', { lean: -1, bob: 1, hx: -1, hy: 1, hp: 'headHurt', front: [15, 6], back: [13, 8], dr: 3 });
// corpse: the burst belly flopped open, innards and a green pool spread around, rib scraps showing
parts.corpse = rows(`
  ...yYYy.....L.....L..
  ..yYWlYy..LLJL..LJL..
  .yYYYYYYyJLJLLJLLJLL.
  yYJYLYYJYvLLJLLLJLLLy
  .yvwyLwLLJLJLLwLLJLYz
  ..zZvLLLJLLLLLLLLLvZZ
`);
frames.dead0 = [['corpse', 2, 8]];

export default {
  name: 'icehusk', title: 'Ice husk', notes: 'Frozen-dead shambler with ice shards; shatters on death and leaves a frost pool (the game draws the pool).',
  cell: [30, 16], shadow: [11, 3], pivot: [15, 14], palette, post, parts, frames,
  derived: {},
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 2, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead0'] },
  },
};
