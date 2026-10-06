// SCORPION — a big desert scorpion (armoured shell): glossy dark-red carapace with black plates, orange claws, a raised curled
// tail ending in a pale stinger, eight legs. ~wolf/ghoul sized, built low and wide. Faces right. Poses: walk (scuttle), idle,
// windup (claws up and open, tail cocked forward over the head), strike (claws snap, tail stabs down), hurt, dead (on its back,
// legs curled up, tail slack).
import { GLASS as G } from '../palette.mjs';
import { rows, limb, line } from '../lib.mjs';

// c deep red, C red, h red sheen, k black plate, O orange claw, f dark orange, F bone-yellow stinger
const palette = { l: G.lead, e: G.lead, ...G, c: '#4a0e12', C: '#8c2018', h: '#c24428', k: '#1c0c12', O: '#e8802a', f: '#a8481a', F: '#f0d890' };
const post = { ink: 'l', all: true };

const body = rows(`
  ..cccCCCccc..
  .cCChhCCCkkc.
  cCCCCCCCkkkYc
  ckkkkkkkkkkkc
  .ccckkkkkccc.
`);
const bodyHurt = rows(`
  ..cccCCCccc..
  .cCChhCCCkkc.
  cCCCCCCCkkklc
  ckkkkkkkkkkkc
  .ccckkkkkccc.
`);
// pincers face right: a palm and two jaws (open) / jaws closed
const clawOpen = rows(`
  ...OOOO
  .OOOOf.
  OOOf...
  .OOOOf.
  ...OOOO
`);
const clawShut = rows(`
  ..OOO..
  OOOOOOO
  OOOfOOO
  ..OOO..
`);
const stinger = rows(`
  kk
  .F
  .F
`);
const deadBody = rows(`
  ..kkkkkkkkkk..
  .kckkkkkkkkck.
  ckCCCCCCCCCCcc
  .cCCCCCCCCCCc.
`);
const dark = (r) => r.map((row) => row.replace(/O/g, 'f').replace(/f(?=\.|$)/g, 'c'));
const parts = { clawFarOpen: dark(clawOpen), clawFarShut: dark(clawShut), body, bodyHurt, clawOpen, clawShut, stinger, deadBody, legGround: ['.'] };

const frames = {};
const BX = 9, BY = 9;                 // body top-left; body is 13x5, ground line row 16
const GY = 16;
const TAIL = [[BX + 1, BY + 1], [BX - 2, BY - 2], [BX - 2, BY - 6], [BX + 2, BY - 8], [BX + 6, BY - 7], [BX + 8, BY - 4]];
function pose(name, o = {}) {
  const { bob = 0, lean = 0, tail = TAIL, arms = [[BX + 14, BY - 2], [BX + 14, BY + 4]], claw = 'clawOpen', gait = -1, hp = 'body' } = o;
  const X = BX + lean, Y = BY + bob;
  const out = [['legGround', 18, GY]];
  const hips = [2, 4, 7, 9];
  const base = [-3, -2, 2, 3];
  const sw = (i, ph) => (gait < 0 ? 0 : ((i + ph + gait) % 2 === 0 ? 2 : -1));
  hips.forEach((hx, i) => out.push(line([X + hx + 2, Y + 4], [X + hx + 2 + Math.round(base[i] * 0.6) + sw(i, 1), GY], 'c')));   // far legs
  hips.forEach((hx, i) => out.push(line([X + hx, Y + 4], [X + hx + base[i] + sw(i, 0), GY], 'f')));                              // near legs
  out.push(limb([[X + 11, Y + 1], arms[0]], { w: 2, body: 'f', lo: 'c' }));                                                        // far arm
  const tl = tail.map(([x, y]) => [x + lean, y + bob]);
  out.push(limb(tl, { w: 2, body: 'C', lo: 'c' }));
  const [tx, ty] = tl[tl.length - 1];
  out.push(['stinger', tx, ty + 1]);
  out.push([hp, X, Y]);
  out.push(limb([[X + 11, Y + 3], arms[1]], { w: 2, body: 'O', lo: 'f' }));                                                        // near arm
  out.push([claw === 'clawOpen' ? 'clawFarOpen' : 'clawFarShut', arms[0][0] + lean, arms[0][1] + bob]);
  out.push([claw, arms[1][0] + lean, arms[1][1] + bob]);
  frames[name] = out;
}
const T2 = (f) => TAIL.map(([x, y]) => f(x, y));
pose('walk0', { gait: 0, bob: 0 });
pose('walk1', { gait: 1, bob: 1 });
pose('walk2', { gait: 0, bob: 0, arms: [[BX + 15, BY - 1], [BX + 15, BY + 5]] });
pose('walk3', { gait: 1, bob: 1 });
pose('idle0', {});
pose('idle1', { bob: 1, arms: [[BX + 14, BY - 1], [BX + 13, BY + 5]], tail: T2((x, y) => [x, y + (y < BY ? 1 : 0)]) });
// windup: claws raised wide, tail cocked up and forward over the head
pose('windup0', { lean: -1, arms: [[BX + 13, BY - 6], [BX + 16, BY + 1]], tail: [[BX + 1, BY + 1], [BX - 2, BY - 3], [BX - 1, BY - 8], [BX + 3, BY - 10], [BX + 8, BY - 9], [BX + 11, BY - 6]] });
pose('windup1', { lean: -2, arms: [[BX + 13, BY - 8], [BX + 17, BY - 1]], tail: [[BX + 1, BY + 1], [BX - 2, BY - 3], [BX - 1, BY - 8], [BX + 4, BY - 10], [BX + 10, BY - 9], [BX + 14, BY - 6]] });
// strike: claws snap forward, tail lashes down in front
pose('strike0', { lean: 2, claw: 'clawShut', arms: [[BX + 16, BY - 2], [BX + 17, BY + 3]], tail: [[BX + 1, BY + 1], [BX, BY - 4], [BX + 5, BY - 8], [BX + 11, BY - 6], [BX + 16, BY - 1]] });
pose('strike1', { lean: 3, bob: 1, claw: 'clawShut', arms: [[BX + 16, BY - 1], [BX + 17, BY + 5]], tail: [[BX + 1, BY + 2], [BX + 3, BY - 2], [BX + 10, BY - 3], [BX + 16, BY + 1], [BX + 17, BY + 5]] });
pose('hurt0', { lean: -1, bob: 1, hp: 'bodyHurt', claw: 'clawShut', arms: [[BX + 12, BY + 2], [BX + 13, BY + 4]], tail: [[BX + 1, BY + 2], [BX - 3, BY], [BX - 4, BY - 4], [BX - 1, BY - 7], [BX + 3, BY - 6], [BX + 4, BY - 3]] });
// corpse: on its back, legs curled up, tail slack beside it
frames.deadf = [
  ['legGround', 18, GY],
  ['deadBody', 9, 13],
  (put) => {
    for (const x of [10, 12, 14, 16, 18]) { put(x, 12, 'f'); put(x + 1, 11, 'f'); }
    for (let x = 4; x < 9; x++) put(x, 16, 'C'); put(3, 16, 'k'); put(3, 15, 'F'); put(2, 14, 'F');
    put(24, 14, 'O'); put(25, 13, 'O'); put(25, 15, 'O'); put(26, 14, 'f');
  },
];
export default {
  name: 'scorpion', title: 'Scorpion', notes: 'Armoured desert scorpion (hp 16). Windup: claws up, tail cocked. Faces right.',
  cell: [42, 21], shadow: [12, 4], pivot: [20, GY], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 9, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['deadf'] },
  },
};
