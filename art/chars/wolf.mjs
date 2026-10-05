// WOLF — meadow wolf. ~14px long, low and lean, grey-brown fur, pale muzzle, ears laid back. A quadruped: leg parts are
// named leg… so the builder derives the ground line from them. Poses: walk (gallop), idle, windup (snarling crouch), strike
// (snapping lunge), hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, outline } from '../lib.mjs';

const palette = { l: G.lead, e: G.lead, ...G, f: '#7d6d60', F: '#a39382', d: '#54483f', H: '#e0d4ba' };
const post = { ink: 'l', all: true };

const body = rows(`
  .fffFFf.
  ffFFFFff
  fffffffH
  .ffffff.
`);
// rump raised / chest low (paw crouch): two halves placed at different heights
const rump = rows(`
  .fffF
  ffFFF
  fffff
  .ffff
`);
const chest = rows(`
  FFff.
  FFfff
  ffffH
  fffff
`);
const head = rows(`
  ff....
  fffff.
  fYfHHH
  .ffHHl
`);
const headSnarl = rows(`
  ff....
  fffff.
  fYfHHH
  .ffWRW
`);
const headHurt = rows(`
  ff....
  fffff.
  flfHHH
  .ffWRW
`);
const headPant = rows(`
  ff....
  fffff.
  flfHHH
  .ffHRl
`);
const tailA = rows(`
  f..
  ff.
  .f.
`);
const tailUp = rows(`
  ..f
  .ff
  ff.
`);
const tailLine = rows(`
  ffff
`);
const tailDrop = rows(`
  f.
  f.
  ff
`);
const mk = (c) => ({
  S: [c, c], Fw: [c + '.', '.' + c], Bk: ['.' + c, c + '.'], T: [c],
  ExFw: [c + '..', '.' + c + c], ExBk: ['..' + c, c + c + '.'], Lo: [c],
});
const deadWolf = rows(`
  ..ffff.fff.ff
  ffffFFFfffHHH
  .ddffffffffHl
`);
const parts = { deadWolf, body, rump, chest, head, headSnarl, headHurt, headPant, tailA, tailUp, tailLine, tailDrop };
for (const [k, c] of [['n', 'f'], ['f', 'd']]) for (const [kind, r] of Object.entries(mk(c))) parts[`leg${k}${kind}`] = r;

// opts: bx,by body origin; legs [hindFar,hindNear,frontFar,frontNear] kinds; ly extra leg y; head part + dx/dy; tail part + dx/dy
const OXX = 4;
function wolf({ by = 2, bx = 7, h = 'head', hx = 6, hy = -1, tail = 'tailA', tx = -2, ty = 0, legs = ['S', 'S', 'S', 'S'], ly = [0, 0, 0, 0], split = false } = {}) {
  const X = bx + OXX - 4;
  const out = [];
  const leg = (kind, hip, y, near) => {
    const off = kind === 'Bk' ? -1 : kind === 'ExBk' ? -2 : 0;
    return [`leg${near ? 'n' : 'f'}${kind}`, X + hip + off, y];
  };
  out.push(leg(legs[0], 3, by + 4 + ly[0], false));
  out.push(leg(legs[2], 5, by + 4 + ly[2], false));
  out.push([tail, X + tx, by + ty]);
  if (split) { out.push(['rump', X, by]); out.push(['chest', X + 4, by + split]); }
  else out.push(['body', X, by]);
  out.push(leg(legs[1], 1, by + 4 + ly[1], true));
  out.push(leg(legs[3], 6, by + 4 + ly[3], true));
  out.push([h, X + hx, by + hy]);
  return out;
}
const frames = {};
frames.idle0 = wolf({ h: 'head', hy: 0 });
frames.idle1 = wolf({ hy: -1, tail: 'tailUp', tx: -3, ty: -1 });
frames.dead = [['deadWolf', 4, 5], (put) => { put(9, 4, 'r'); put(11, 7, 'r'); put(14, 6, 'r'); }];
frames.walk0 = wolf({ legs: ['Bk', 'Bk', 'Fw', 'Fw'], hy: -1, tail: 'tailLine', tx: -3, ty: 1 });
frames.walk1 = wolf({ by: 1, legs: ['T', 'T', 'T', 'T'], ly: [0, 0, 1, 1], hy: 0, tail: 'tailLine', tx: -3, ty: 1 });
frames.walk2 = wolf({ by: 3, legs: ['Fw', 'Fw', 'S', 'S'], ly: [-1, -1, -1, -1], hy: -1, tail: 'tailA', tx: -2, ty: 0 });
frames.walk3 = wolf({ by: 1, legs: ['S', 'S', 'T', 'T'], ly: [0, 0, 1, 1], hy: 0, tail: 'tailLine', tx: -3, ty: 1 });
// windup: lowered snarl, weight back, jaws open
frames.windup0 = wolf({ by: 3, bx: 6, h: 'headSnarl', hx: 6, hy: 0, legs: ['S', 'S', 'S', 'S'], ly: [-1, -1, -1, -1], tail: 'tailA', tx: -2 });
frames.windup1 = wolf({ by: 3, bx: 5, h: 'headSnarl', hx: 6, hy: 1, legs: ['Bk', 'Bk', 'Fw', 'Fw'], ly: [-1, -1, -1, -1], tail: 'tailUp', tx: -3, ty: -1 });
// strike: lunging snap
frames.strike0 = wolf({ by: 2, bx: 9, h: 'headSnarl', hx: 6, hy: 0, legs: ['Bk', 'Bk', 'Fw', 'Fw'], ly: [0, 0, 0, 0], tail: 'tailLine', tx: -3, ty: 1 });
frames.strike1 = wolf({ by: 3, bx: 10, h: 'headSnarl', hx: 6, hy: 1, legs: ['S', 'S', 'Fw', 'Fw'], ly: [-1, -1, -1, -1], tail: 'tailA', tx: -2, ty: 0 });
frames.hurt0 = wolf({ by: 3, bx: 6, h: 'headHurt', hx: 5, hy: -2, legs: ['S', 'S', 'S', 'S'], ly: [-1, -1, -1, -1], tail: 'tailDrop', tx: -2, ty: 0 });

export default {
  name: 'wolf', title: 'Wolf', notes: 'Meadow wolf. Hunts in packs (no pose change; the game speeds it up).',
  cell: [22, 9], shadow: [8, 3], pivot: [11, 7], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 10, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead'] },
  },
};
