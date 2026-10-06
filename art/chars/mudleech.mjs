// MUDLEECH — a fat little marsh leech, ~11px long and 4px high: olive-green back, yellow ring markings, a pale underside.
// Faces right. Low and slithery: `walk` ripples the body, `windup` rears the front half up with the sucker-mouth open,
// `strike` lunges flat and long with the mouth wide. `dead` is the leech on its back with the belly showing.
// Hand-placed frames (no legs); a blank leg part pins the ground line.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';

const palette = { l: G.lead, e: G.lead, ...G, q: '#86b838', m: '#55902c', n: '#2f5e24', Y: '#f2cc48', p: '#e8d6a0' };
const post = { ink: 'l', all: true };

const pad = (r) => { const w = Math.max(...r.map((x) => x.length)); return r.map((x) => x.padEnd(w, '.')); };
const flat0 = pad(rows(`
  .....qqYqqq..
  ..qqmmmYmmYqq
  qmmmmmmYmmYmmR
  .nnnnnnnnnnnn.
`));
const flat1 = pad(rows(`
  ......qqYqqq.
  ..qqqmmmYmmYqq
  qmmmmmmmYmmYmmR
  ..nnnnnnnnnnn.
`));
const flat2 = pad(rows(`
  .....qqYqqq..
  .qqmmmmYmmYqq.
  qmmmmmmYmmYmmR
  .nnnnnnnnnnnn.
`));
const flat3 = pad(rows(`
  ....qqYqqqq..
  ..qqmmmYmmYqq
  .qmmmmmYmmYmmR
  qnnnnnnnnnnn.
`));
const rear0 = pad(rows(`
  ..........qqq.
  .........qmYmq
  ........qmmmmR
  ...qqY.qmmYmm.
  .qqmmmYmmmYn..
  qmmmmmYmmYnn..
  .nnnnnnnnnn...
`));
const rear1 = pad(rows(`
  ..........qqq
  .........qmYmq
  .........mmmmR
  ........qmmYm.
  ..qqY..qmmmn..
  .qmmmYmmmYn...
  qmmmmmYmmYn...
  .nnnnnnnnn....
`));
const lunge = pad(rows(`
  ...qqYqqqYqqqq.
  qqmmmmYmmmYmmmR
  .nnnnnnnnnnnnn.
`));
const lunge1 = pad(rows(`
  ....qqYqqqYqqqq
  .qmmmmmYmmmYmmR
  ..nnnnnnnnnnnn.
`));
const hurt = pad(rows(`
  ....qqYqqq...
  ..qqmmmYmmYq.
  qmmmmmmYmmYmm.
  .nnYnnnnnnYn..
`));
const dead = pad(rows(`
  ....ppYppp...
  ..ppppYppYpp.
  qmmmmmmYmmYmm.
  .nnnnnnnnnnn..
`));
const legGround = ['.'];
const parts = { flat0, flat1, flat2, flat3, rear0, rear1, lunge, lunge1, hurt, dead, legGround };
const at = (p, x = 3, y = 4) => [[p, x + 1, y]];
const frames = {};
for (const [k, p, y] of [['walk0', 'flat0', 4], ['walk1', 'flat1', 3], ['walk2', 'flat2', 4], ['walk3', 'flat3', 3], ['idle0', 'flat0', 4], ['idle1', 'flat1', 4]]) {
  frames[k] = [["legGround", 9, 8], ...at(p, 2, y)];
}
frames.windup0 = at('rear0', 2, 2);
frames.windup1 = at('rear1', 2, 0);
frames.strike0 = at('lunge', 4, 5);
frames.strike1 = at('lunge1', 3, 5);
frames.hurt0 = at('hurt', 1, 4);
frames.deadf = at('dead', 2, 4);

export default {
  name: 'mudleech', title: 'Mudleech', notes: 'Tiny leech. Faces right; rears up on windup, lunges on strike. Poisons on hit (game).',
  cell: [20, 10], shadow: [6, 2], pivot: [10, 8], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['deadf'] },
  },
};
