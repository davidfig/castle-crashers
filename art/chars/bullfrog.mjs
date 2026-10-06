// BULLFROG — a big squat bullfrog (orc-sized, ~hp 20) that LEAPS onto the hero. Bright green hide with darker back blotches,
// a huge pale-yellow belly, golden goggle eyes and a wide grin; thick folded hind legs. Faces right.
// Poses: walk (wide-legged hops/waddle), idle (throat breathing), windup + cast (deep coiled crouch), strike (airborne
// stretch, then the landing slam), hurt, dead. The game draws it in the air during a leap: walk0/walk2 (legs wide) is a good frame.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, a: '#2f6a22', g: '#4f9c30', h: '#86cc4a', p: '#f4e9a2', P: '#d8c46a' };
const post = { ink: 'l', all: true };
const pad = (r) => { const w = Math.max(...r.map((x) => x.length)); return r.map((x) => x.padEnd(w, '.')); };

const head = pad(rows(`
  .YY..YY..
  hYlhhYlhh
  hhhhhhhhh
  gaaaaaaag
  .gPPPPPg.
`));
const headOpen = pad(rows(`
  .YY..YY..
  hYlhhYlhh
  hhhhhhhhh
  gRRRRRRRg
  .gPPPPPg.
`));
const headHurt = pad(rows(`
  .hh..hh..
  hllhhllhh
  hhhhhhhhh
  gaaaaaaag
  .gPPPPPg.
`));
const robe = pad(rows(`
  ..hhhhhhhh.
  .hhahhhhahh
  ghhhhhaghhg
  gaPPPPPPPPg
  gPpppppppPg
  .gPpppppPg.
`));
const robeCrouch = pad(rows(`
  ..hhhhhhhh.
  .hhahhhhahh
  ghhhhhaghhg
  gaPPPPPPPPg
  gpppppppppg
`));
const robeStretch = pad(rows(`
  ...hhhhhhhh.
  .hhhahhhhahh
  ghhhhhhaghhg
  .gPPPPPPPPg.
  ..gPpppppg..
`));
const shoe = rows(`
  gg...
  gggg.
  ggggg
`);
// the corpse: belly-up, stubby legs splayed (a standing frog rotated 90 degrees would stand on its nose)
const deadBody = pad(rows(`
  ..gg..........gg.
  .gggaaaaaaaaaaggg
  gggaPPPPPPPPPPagg
  gaPPpppppppppPPag
  .gaPPpppppppPPag.
  ..gggaaaaaaaggg..
  .ggg..hh.hh..ggg.
`));
const parts = { deadBody, head, headOpen, headHurt, robe, robeCrouch, robeStretch, shoe };
const rig = robedRig({
  OX: 6, OY: 3, parts, shoe,
  layout: { robe: [0, 3], head: [8, 0], legB: [1, 9], legF: [6, 9], sleeve: null },
  prop() { return []; },
});
const { pose } = rig;
rig.frames.deadf = [['deadBody', 8, 6]];
pose('walk0', { bob: 1, lf: 2, lb: -2 });
pose('walk1', { bob: 0, lf: 0, lb: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 2 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, hy: 0 });
// the crouch before the leap: body dropped, legs coiled wide and tucked, head down and forward
pose('windup0', { robePart: 'robeCrouch', bob: 2, lean: -1, hy: 1, hx: 0, lf: -2, lb: 2, headPart: 'headOpen' });
pose('windup1', { robePart: 'robeCrouch', bob: 3, lean: -2, hy: 1, hx: -1, lf: -3, lb: 3, headPart: 'headOpen' });
pose('cast0', { robePart: 'robeCrouch', bob: 3, lean: -2, hy: 1, hx: -1, lf: -3, lb: 3 });
// the leap: stretched out, hind legs trailing; then the landing slam
pose('strike0', { robePart: 'robeStretch', bob: -1, lean: 3, hx: 1, hy: 0, lf: -3, lb: -4, lfl: 1, lbl: 1, headPart: 'headOpen' });
pose('strike1', { bob: 2, lean: 2, hx: 1, hy: 1, lf: 3, lb: 2, headPart: 'headOpen' });
pose('hurt0', { bob: 1, lean: -1, hx: -1, hy: 1, headPart: 'headHurt' });

export default {
  name: 'bullfrog', title: 'Bullfrog', notes: 'Leaping brute. windup/cast = coiled crouch; strike = airborne then landing. walk0/walk2 are wide-legged.',
  cell: [32, 19], shadow: [12, 4], pivot: [16, 14], palette, post,
  parts, frames: rig.frames,
  anims: {
    walk: { fps: 6, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    cast: { fps: 1, frames: ['cast0'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['deadf'] },
  },
};
