// SCARAB — a small fast dung-beetle swarmer, ~7px long and low to the ground. Deep iridescent teal carapace with a seam down the
// back, copper head with feelers, three pairs of little legs. Poses: walk (scurry), idle, windup (rears up, mandibles open),
// strike (bite lunge), hurt, dead (on its back, legs curled).
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';

// c dark teal, C mid teal, h bright teal sheen, x seam / deep shadow, k copper, K dark copper
const palette = { l: G.lead, e: G.lead, ...G, c: '#0f4a58', C: '#1f8e8c', h: '#62dcb8', x: '#0a2630', k: '#c8742c', K: '#7a3a18' };
const post = { ink: 'l', all: true };

const shell = rows(`
  .CChCCc.
  CChCxCCc
  CCCCxCCc
  .ccccxc.
`);
const shellHurt = rows(`
  .CCCCCc.
  CCCCxCCc
  CCCCxCCc
  .ccccxc.
`);
const shellRear = rows(`
  ......CC.
  ..CCCCCCc
  .CChCxCCc
  CCCCCxCc.
  .cccccxc.
`);
const head = rows(`
  kk.
  kkY
  kk.
`);
const headOpen = rows(`
  kk.
  kkY
  kK.
  kk.
`);
const feelers = rows(`
  x.x
  .x.
`);
const leg = rows(`
  x
  x
`);
const legLong = rows(`
  x
  x
  x
`);
const legFwd = rows(`
  .x
  x.
`);
const deadShell = rows(`
  .xcccccx.
  xcCCxCCcx
  .xxxxxxx.
`);
const parts = { shell, shellHurt, shellRear, head, headOpen, feelers, leg, legLong, legFwd, deadShell };

const frames = {};
// bx/by shell origin; legs: heights per leg pair (x offsets 1,3,5)
function pose(name, { bx = 2, by = 1, sh = 'shell', hd = 'head', hy = 1, legs = [2, 2, 2], lx = [0, 0, 0], feel = true } = {}) {
  const out = [];
  const xs = [bx + 1, bx + 3, bx + 5];
  for (let i = 0; i < 3; i++) out.push([legs[i] === 3 ? 'legLong' : legs[i] === 0 ? 'legFwd' : 'leg', xs[i] + lx[i], by + 3 + (legs[i] === 1 ? 1 : 0)]);
  out.push([sh, bx, by]);
  out.push([hd, bx + 8, by + hy]);
  if (feel) out.push(['feelers', bx + 9, by + hy - 2]);
  frames[name] = out;
}
pose('walk0', { legs: [2, 1, 2], lx: [-1, 0, 1] });
pose('walk1', { by: 0, legs: [2, 2, 1], lx: [0, 1, 0] });
pose('walk2', { legs: [1, 2, 2], lx: [1, 0, -1] });
pose('walk3', { by: 0, legs: [2, 1, 2], lx: [0, -1, 0] });
pose('idle0', {});
pose('idle1', { hy: 2, legs: [2, 2, 2] });
// windup: rears up, mandibles open, front legs waving
frames.windup0 = [['leg', 3, 4], ['leg', 5, 4], ['shellRear', 2, 1], ['headOpen', 10, 0], ['feelers', 11, -2]];
frames.windup1 = [['leg', 3, 5], ['leg', 6, 5], ['shellRear', 1, 2], ['headOpen', 9, 0], ['feelers', 10, -2], ['legFwd', 10, 5]];
// strike: lunging bite
frames.strike0 = [['leg', 6, 4], ['leg', 8, 4], ['shell', 5, 1], ['headOpen', 13, 2], ['feelers', 14, 0], ['legFwd', 12, 5]];
frames.strike1 = [['leg', 5, 4], ['leg', 7, 4], ['shell', 4, 2], ['head', 12, 3], ['feelers', 13, 1]];
frames.hurt0 = [['leg', 2, 5], ['leg', 4, 5], ['leg', 6, 5], ['shellHurt', 1, 2], ['head', 8, 3]];
frames.deadf = [
  ['deadShell', 2, 5],
  (put) => { put(3, 4, 'x'); put(5, 3, 'x'); put(7, 4, 'x'); put(4, 8, 'x'); put(7, 8, 'x'); put(10, 6, 'k'); put(10, 7, 'k'); },
];
// shift everything down 2 rows so the raised feelers fit in the cell
for (const k of Object.keys(frames)) frames[k] = frames[k].map((e) => (Array.isArray(e) ? [e[0], e[1], e[2] + 2] : (put) => e((x, y, c) => put(x, y + 2, c))));
export default {
  name: 'scarab', title: 'Scarab', notes: 'Small fast swarmer; feeds on each bite. Teal carapace, copper head.',
  cell: [18, 11], shadow: [5, 2], pivot: [9, 8], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 12, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 4, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['deadf'] },
  },
};
