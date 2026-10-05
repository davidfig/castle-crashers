// SNOW SPRITE — a floating ice imp (~6px): a crystalline blue head crowned with spikes, trailing a swirl of snow-mist, with a jaw that snaps. FLIES: no legs.
// The pivot is the ground line; the skull hovers a few px above it (the game draws the shadow under it).
// windup = jaws wide open, strike = snap shut (lunge), dead = a few shards of ice on the ground.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';

// W/w = the ice of the head (light, deep), f/F/h = the swirl of snow-mist trailing behind (deep, mid, glint)
const palette = { l: G.lead, e: G.lead, ...G, W: '#7fc4f4', w: '#3a7cc4', f: '#244f9a', F: '#4a98e8', h: '#cdeeff' };
const post = { ink: 'l', all: true };

const cranium = rows(`
  W.WW.W
  WWWWWw
  WllWlw
  WlhWhw
  .WWWw.
`);
const craniumHurt = rows(`
  W.WW.W
  WWWWWw
  WlWlWw
  WWlWlw
  .WWWw.
`);
const jaw = rows(`
  .WwWw.
  ..wWw.
`);
const jawOpen = rows(`
  .W.W..
  .l.l..
  .WwWw.
  ..wWw.
`);
const flameA = rows(`
  ..F....F..
  .FFh..FF..
  FFFFhFFFF.
  fFFhFFFFFf
  .fFFFFFFf.
  ..ffFFFf..
`);
const flameB = rows(`
  .F.....F..
  FFF..h.FF.
  fFFhFFFFF.
  .FFFhFFFFf
  ..fFFFFFf.
  ...ffFFf..
`);
const flameC = rows(`
  ..F...F...
  .FF.h.FF..
  FFFFFhFFF.
  fFFFFFFFFf
  .ffFFFFFf.
  ...fFFf...
`);
const flameLong = rows(`
  F...F....F
  FF.hFF.hFF
  FFFFFFFFFF
  fFFhFFFFFF
  .fFFFFFFFf
  ..ffFFFff.
`);
// the corpse: a plain skull on the ground, jaw slack
const skullDead = rows(`
  ..W..w..W.
  .WWw.WWw.w
  wWWWwwWWWw
  .wwW..wwW.
`);
const parts = { cranium, craniumHurt, jaw, jawOpen, flameA, flameB, flameC, flameLong, skullDead };

// cell 22x16, ground line row 13 (pivot), skull hovers ~4px above it
const frames = {};
// flame sits behind (left of) and over the skull top; anchored so its right edge tucks under the cranium
function pose(name, { fl = 'flameA', dy = 0, dx = 0, open = 0, cr = 'cranium', fdx = 0, fdy = 0 } = {}) {
  const sx = 11 + dx, sy = 5 + dy;                         // skull top-left
  const out = [[fl, sx - 5 + fdx, sy - 2 + fdy]];
  out.push([cr, sx, sy]);
  out.push(open ? ['jawOpen', sx, sy + 4] : ['jaw', sx, sy + 4]);
  frames[name] = out;
}
pose('walk0', { fl: 'flameA', dy: 0 });
pose('walk1', { fl: 'flameB', dy: -1 });
pose('walk2', { fl: 'flameC', dy: 0 });
pose('walk3', { fl: 'flameB', dy: 1 });
pose('idle0', { fl: 'flameA', dy: 0 });
pose('idle1', { fl: 'flameC', dy: -1 });
pose('windup0', { fl: 'flameC', dy: -1, dx: -1, open: 1 });
pose('windup1', { fl: 'flameLong', dy: -2, dx: -2, open: 1, fdx: -1 });
pose('strike0', { fl: 'flameLong', dy: 1, dx: 3, fdx: -2 });
pose('strike1', { fl: 'flameLong', dy: 1, dx: 2, fdx: -3 });
pose('hurt0', { fl: 'flameB', dy: 0, dx: -2, cr: 'craniumHurt', fdx: 1 });
frames.deadf = [['skullDead', 9, 9]];
// a blank, hidden leg part pins the ground line (pivot) without drawing anything
parts.legGround = ['.'];
for (const k of ['walk0', 'walk1', 'walk2', 'walk3', 'idle0', 'idle1']) frames[k].unshift(['legGround', 11, 13]);

export default {
  name: 'snowsprite', title: 'Snow Sprite', notes: 'Flies. Hovers above the ground line; swirl of snow-mist tail; jaws open on windup, snap on strike.',
  cell: [22, 15], shadow: [6, 2], pivot: [11, 13], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 4, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    // clinging to a hero's back: gnawing, jaws working
    cling: { fps: 6, frames: ['windup0', 'strike0', 'windup1', 'strike1'] },
    dead: { fps: 1, loop: false, frames: ['deadf'] },
  },
};
