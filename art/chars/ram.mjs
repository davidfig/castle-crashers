// BIGHORN RAM — Frozen Pass herd beast. ~17px long, stocky, dusty-brown wool, a dark face and great curled golden horns. A quadruped:
// leg parts are named leg… so the builder derives the ground line from them. Poses: walk (trot), idle, windup (head lowered, pawing),
// strike (headbutt, which launches the hero), hurt, dead.
import { GLASS as G } from '../palette.mjs';
import { rows, outline } from '../lib.mjs';

// f/F/d = wool (dusty brown, tan, shadow), k = face, h/H = horn, Y = eye
const palette = { l: G.lead, e: G.lead, ...G, f: '#7a6a58', F: '#a8947c', d: '#4a3e32', k: '#3a2e28', h: '#b8903c', H: '#ecd488', Y: '#ffd84a' };
const post = { ink: 'l', all: true };

const body = rows(`
  .fFFfFFFf.
  fFfFFfFFFf
  ffffffffff
  fffffffffd
  .dffffffd.
`);
const head = rows(`
  .hhh..
  hHHhh.
  hHkkk.
  .hkYkk
  ..kkkF
  ...kFF
`);
const headHurt = rows(`
  .hhh..
  hHHhh.
  hHkkk.
  .hklkk
  ..kkkF
  ...kFF
`);
const headDaze = rows(`
  .hhh..
  hHHhh.
  hHkkk.
  .hklkk
  ..kkkF
  ...kkk
`);
const tail = rows(`
  ff
  .f
`);
const mk = (c) => ({
  S: [c + c, c + c, c + c], Fw: [c + c + '.', '.' + c + c, '.' + c + c], Bk: ['.' + c + c, c + c + '.', c + c + '.'],
  T: [c + c, c + c], ExFw: [c + c + '..', '.' + c + c + c, '..' + c + c], ExBk: ['..' + c + c, c + c + c + '.', c + c + '..'], Lo: [c + c],
});
const deadRam = rows(`
  ..hh..ffffffff.ff.f
  .hHkkfFFFFfffffffdf
  hHkYkffffffffffdddd
  .kkkFFfdfddfddf.dd.
`);
const parts = { deadRam, body, head, headHurt, headDaze, tail };
for (const [k, c] of [['n', 'f'], ['f', 'd']]) for (const [kind, r] of Object.entries(mk(c))) parts[`leg${k}${kind}`] = r;

const X0 = 4;
// opts: bx,by body origin; legs [hindFar, hindNear, frontFar, frontNear] kinds; ly lift per leg; head part + dx/dy; tail dx/dy
function ram({ by = 2, bx = 6, h = 'head', hx = 9, hy = -1, tx = -2, ty = 0, legs = ['S', 'S', 'S', 'S'], ly = [0, 0, 0, 0] } = {}) {
  const X = bx + X0 - 4;
  const out = [];
  const leg = (kind, hip, y, near) => {
    const off = kind === 'Bk' ? -1 : kind === 'ExBk' ? -2 : 0;
    return [`leg${near ? 'n' : 'f'}${kind}`, X + hip + off, y];
  };
  out.push(leg(legs[0], 3, by + 5 + ly[0], false));
  out.push(leg(legs[2], 7, by + 5 + ly[2], false));
  out.push(['tail', X + tx, by + ty]);
  out.push(['body', X, by]);
  out.push(leg(legs[1], 1, by + 5 + ly[1], true));
  out.push(leg(legs[3], 8, by + 5 + ly[3], true));
  out.push([h, X + hx, by + hy]);
  return out;
}
const frames = {};
frames.idle0 = ram({ hy: 0 });
frames.idle1 = ram({ hy: 1, tx: -3 });
frames.dead = [['deadRam', 5, 6], (put) => { put(10, 5, 'r'); put(13, 8, 'r'); put(16, 7, 'r'); }];
frames.walk0 = ram({ legs: ['Bk', 'Bk', 'Fw', 'Fw'], hy: 0 });
frames.walk1 = ram({ by: 1, legs: ['T', 'T', 'T', 'T'], ly: [0, 0, 1, 1], hy: 1 });
frames.walk2 = ram({ by: 2, legs: ['Fw', 'Fw', 'S', 'S'], ly: [-1, -1, 0, 0], hy: 0 });
frames.walk3 = ram({ by: 1, legs: ['S', 'S', 'T', 'T'], ly: [0, 0, 1, 1], hy: 1 });
// windup: weight back, head lowered, a front hoof scraping
frames.windup0 = ram({ by: 3, bx: 5, h: 'head', hx: 9, hy: 1, legs: ['S', 'S', 'S', 'Fw'], ly: [-1, -1, -1, -1] });
frames.windup1 = ram({ by: 3, bx: 4, h: 'head', hx: 9, hy: 2, legs: ['Bk', 'Bk', 'S', 'Fw'], ly: [-1, -1, -1, 0], tx: -3 });
// strike: the headbutt, body thrown forward
frames.strike0 = ram({ by: 2, bx: 8, h: 'head', hx: 9, hy: 1, legs: ['Bk', 'Bk', 'Fw', 'Fw'] });
frames.strike1 = ram({ by: 3, bx: 10, h: 'head', hx: 9, hy: 2, legs: ['S', 'S', 'Fw', 'Fw'], ly: [-1, -1, -1, -1] });
frames.hurt0 = ram({ by: 3, bx: 5, h: 'headHurt', hx: 9, hy: -1, legs: ['S', 'S', 'S', 'S'], ly: [-1, -1, -1, -1], tx: -3 });

export default {
  name: 'ram', title: 'Bighorn Ram', notes: 'Frozen Pass herd beast. Headbutt: windup (head down, scraping) -> strike.',
  cell: [30, 14], shadow: [10, 3], pivot: [15, 12], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead'] },
  },
};
