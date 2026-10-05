// BLIZZARD WITCH — a screaming storm-hag (~12px). Dark navy hair and a mid-blue gown streaming back into wisps of snow, no legs: she hovers a few
// px above the ground (the ground line is set by the `legMist` wisps trailing on the floor, so the game's shadow sits under her).
// Poses: walk (drifting bob), idle, windup (head thrown back, mouth wide, hair flaring: the scream), hurt, dead (a heap of gown and hair).
// Caster: no strike.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';

// I/i = gown (mid, deep blue), j/J = hair (navy), f = unused
const palette = { l: G.lead, e: G.lead, ...G, i: '#2e5c9c', I: '#6aaee4', j: '#1a3466', J: '#0e1c40', k: '#0a0814', f: '#a8e0e8' };
const post = { ink: 'l', all: true };

const head = rows(`
  .jjjj
  jjjII
  jjIlI
  jjIII
  .jIlI
`);
const headScream = rows(`
  .jjjj.
  jjjIII
  jjIlIl
  jjIlll
  .jIlll
  ..jIII
`);
const headHurt = rows(`
  .jjjj
  jjjII
  jjIlI
  jjIII
  .jIll
`);
// long hair streaming behind (left), darker than the gown so it reads as a separate mass; two wave phases; flare = whipped up and out
const hair0 = rows(`
  .jj.
  jJjj
  jjJj
  .jjJ
  jjJ.
  .jJj
  .Jj.
  ..jJ
  .j..
  j...
`);
const hair1 = rows(`
  .jj.
  jjJj
  .jjJ
  jJj.
  .jjJ
  jJj.
  ..Jj
  .jJ.
  ..j.
  .j..
`);
const hairFlare = rows(`
  j..j.J
  Jj.jJj
  .jjJj.
  .jJjj.
  ..jJj.
  ...jJ.
`);
const hairFlare1 = rows(`
  J..j...J
  .jj.jJj.
  ..jjJjj.
  ...jJjj.
  ....jJj.
  .....jJ.
`);
// gown: pale, narrow at the shoulders, flaring to a ragged skirt that dissolves into wisps (3 phases of tail wave)
const gown0 = rows(`
  ..III..
  ..IiI..
  .IIiII.
  .IIIiII
  IIiIIiI.
  IiI.IiI.
  .I..Ii.i
`);
const gown1 = rows(`
  ..III..
  ..IiI..
  .IIiII.
  .IIIiII
  IIiIIiII
  .IiI.Ii.
  .i.I..I.
`);
const gown2 = rows(`
  ..III..
  ..IiI..
  .IIiII.
  .IIIiI.
  IIiIIiII
  IiI.IiI.
  ..I.i.i.
`);
const armRe = rows(`
  .III
  II..
`);
const armUp = rows(`
  I.I.I
  .III.
  ..Ii.
  .II..
`);
const armHurt = rows(`
  .IiI
  II..
`);
const mist = rows(`
  I..i
`);
const mist2 = rows(`
  .i.I
`);
const heap = rows(`
  ....IIII....
  ..IIiIIIII..
  .IIIiIIiIII.
  IIiIIIIiIIiI
  jjJjjJjjJjjj
`);
const heapHair = rows(`
  jJjj
  .jJjj
`);
const heapHand = rows(`
  .II
  I..
`);

const parts = { head, headScream, headHurt, hair0, hair1, hairFlare, hairFlare1, gown0, gown1, gown2, armRe, armUp, armHurt,
  legMist: mist, legMist2: mist2, heap, heapHair, heapHand };

const GX = 9, GY = 6;       // gown top-left; head sits on the shoulders, hair trails to its left
const frame = ({ dy = 0, gown = 'gown0', hair = 'hair0', headP = 'head', arm = 'armRe', mist: m = 'legMist', hx = 0, hy = 0, lean = 0, ax = 0, ay = 0, hairAt = null }) => [
  [m, 9 + (m === 'legMist' ? 0 : 1) + lean, 18],
  [hair, ...(hairAt ?? [GX - 3 + lean + hx, 4 + dy + hy])],
  [gown, GX + lean, GY + dy],
  [headP, GX + 1 + lean + hx, 2 + dy + hy],
  [arm, GX + 6 + lean + ax, GY + 2 + dy + ay],
];
const frames = {
  walk0: frame({ dy: 0, gown: 'gown0', hair: 'hair0', lean: 0 }),
  walk1: frame({ dy: -1, gown: 'gown1', hair: 'hair1', lean: 0, mist: 'legMist2' }),
  walk2: frame({ dy: 0, gown: 'gown2', hair: 'hair0', lean: 0 }),
  walk3: frame({ dy: 1, gown: 'gown1', hair: 'hair1', lean: 0, mist: 'legMist2' }),
  idle0: frame({ dy: 0, gown: 'gown0', hair: 'hair0' }),
  idle1: frame({ dy: -1, gown: 'gown2', hair: 'hair1', mist: 'legMist2' }),
  windup0: frame({ dy: -1, gown: 'gown1', hair: 'hairFlare', headP: 'headScream', arm: 'armUp', hx: -1, hy: -1, lean: -1, ax: 0, ay: -3, hairAt: [GX - 4, 2] }),
  windup1: frame({ dy: -2, gown: 'gown2', hair: 'hairFlare1', headP: 'headScream', arm: 'armUp', hx: -1, hy: 0, lean: -2, ax: 0, ay: -4, hairAt: [GX - 5, 2] }),
  hurt0: frame({ dy: 0, gown: 'gown2', hair: 'hair1', headP: 'headHurt', arm: 'armHurt', lean: -1 }),
  dead: [['heapHair', 5, 15], ['heap', 7, 14], ['heapHand', 18, 14]],
};

export default {
  name: 'blizzardwitch', title: 'Blizzard Witch', notes: 'Screaming storm-hag, hovers (ground line = trailing floor wisps). windup = the scream. No strike.',
  cell: [24, 20], shadow: [11, 3], pivot: [12, 18], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 6, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 2, frames: ['windup0', 'windup1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead'] },
  },
};
