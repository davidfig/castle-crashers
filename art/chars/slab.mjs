// THE SLAB — shield brute. A hulk hiding behind a door-sized slab of rusted iron planks.
// Gameplay hint baked into the art: the slab hides a glowing crack-wound (its heart). Heavy swings break the slab.
// Silhouette: one big rectangle with a tiny hooded lump peeking over it.
import { MASTER as M } from '../palette.mjs';
import { rows, shear, limb, rot90ccw, stepLeg } from '../lib.mjs';

const palette = {
  k: M.ink, 1: M.s1, 2: M.s2, 3: M.s3, 4: M.s4, 5: M.s5, 6: M.s6, 7: M.s7,
  r: M.r1, R: M.r2, q: M.r3, Q: M.r4,
  g: M.b1, G: M.b2, y: M.b3,
  a: M.v1, b: M.v2,
  E: M.gl, F: M.gd, x: M.s1,
};
const post = { ink: 'k', rim: { 1: '3', 2: '4', 3: '5', 4: '6', 5: '7', R: 'q', q: 'Q', r: 'R', G: 'y', g: 'G' } };

// iron-plank slab shield, generated from rules so planks/bands/crack stay consistent across states
function makeSlab(W, H, { dead = false } = {}) {
  const g = Array.from({ length: H }, () => Array(W).fill('5'));
  const set = (x, y, c) => { if (g[y] && g[y][x] !== undefined) g[y][x] = c; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x % 4 === 3) g[y][x] = '3';                          // plank seams
    else if (((x * 5 + y * 3) % 11) === 0) g[y][x] = '4';    // grain
  }
  const bands = [3, H - 5];
  for (const by of bands) for (let y = by; y < by + 2; y++) for (let x = 0; x < W; x++) g[y][x] = '2';
  for (let y = 0; y < H; y++) set(W - 1, y, '3');
  for (let x = 0; x < W; x++) set(x, H - 1, '3');
  // rust drips from the bands
  for (const [x, y0, n] of [[1, bands[0] + 2, 4], [W - 3, bands[0] + 2, 6], [5, bands[1] + 2, 2]]) for (let i = 0; i < n; i++) set(x, y0 + i, i === n - 1 ? 'r' : 'R');
  // broken top edge (jagged, not a clean rectangle)
  const bite = [3, 1, 0, 0, 2, 0, 1, 0, 0, 1, 3, 4];
  for (let x = 0; x < W; x++) for (let y = 0; y < (bite[x % bite.length] ?? 0); y++) g[y][x] = '.';
  // glowing crack: the weak point
  const crack = [[7, 4], [6, 5], [6, 6], [7, 7], [7, 8], [6, 9], [5, 10], [5, 11], [4, 12]].filter(([, y]) => y < H - 5);
  if (!dead) for (const [x, y] of crack) { set(x - 1, y, 'F'); set(x + 1, y, 'F'); }
  for (const [x, y] of crack) set(x, y, dead ? 'F' : 'E');
  return g.map((r) => r.join(''));
}
const slab = makeSlab(12, 17);
const slabLying = (dead) => rot90ccw(makeSlab(12, 17, { dead }));
// bucket helm: a rusted iron pail with one ink slit. No glow: it is not alive in the way the heroes are.
const hood = rows(`
  3.....3
  .44444.
  4555554
  4555554
  4kkkk54
  4555554
  .33333.
`);
const body = rows(`
  ..2..2..........
  ..22.22.44444...
  .2444444444333..
  .24444433333333.
  244443333333222.
  2444333333322222
  .24333333332222.
  .2333333322222..
  ..233333322222..
  ..22233222222...
  ..RRqRRqRR2.....
  ..R.RR.RR.R.....
`);

const leg = rows(`
  .2222.
  .2332.
  .2332.
  .2332.
  .2332.
  .2332.
  .23322
  .23322
  .22222
`);

const parts = { slab, hood, body };
const lk = (s, f, l = 0) => { const k = `leg${s}${f}_${l}`; if (!parts[k]) parts[k] = stepLeg(leg, f, l); return k; };
const frames = {};
const OX = 6, OY = 4;
function pose(name, o) {
  const { bob = 0, sx = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, slabDy = 0, fx = null } = o;
  const T = (x, y) => [x + OX, y + OY];
  const out = [];
  out.push([lk('B', lb, lbl), ...T(5 + sx, 20)]);
  out.push(['body', ...T(1 + sx, 9 + bob)]);
  out.push(['hood', ...T(7 + sx + hx, 4 + bob + hy)]);
  out.push([lk('F', lf, lfl), ...T(10 + sx, 20)]);
  out.push(limb([T(13 + sx, 14 + bob), T(19 + sx, 19 + bob + slabDy)], { w: 3, body: '4', hi: '5', lo: '3' })); // arm to the slab
  out.push(['slab', ...T(16 + sx, 12 + bob + slabDy)]);
  if (fx) out.push(fx);
  frames[name] = out;
}
pose('walk0', { bob: 1, lf: 3, lb: -3, lbl: 1 });
pose('walk1', { bob: 0, lf: 0, lb: 1, lbl: 2, slabDy: 1 });
pose('walk2', { bob: 1, lf: -3, lb: 3, lfl: 1 });
pose('walk3', { bob: 0, lf: 1, lfl: 2, lb: 0, slabDy: 1 });
parts.fxDust = rows(`
  ..5..5....
  .5555.55..
  5555555555
`);
// rear up (slow) -> hold the slab overhead -> SLAM (impact, frame 2) -> heave back up
pose('atk0', { sx: -2, hx: -1, bob: 1, lb: 1, lf: -1, slabDy: -7 });
pose('atk1', { sx: -3, hx: -2, bob: 2, lb: 2, lf: -2, slabDy: -11 });
pose('atk2', { sx: 6, hx: 2, bob: 2, lf: 3, lb: -3, slabDy: 5, fx: ['fxDust', 28, 33] });
pose('atk3', { sx: 4, bob: 1, lf: 1, lb: -1, slabDy: 1 });
pose('hurt0', { sx: -2, hx: -1, hy: 1, bob: 1, lf: -1, lb: 1, slabDy: 2 });

// dies: the slab topples forward and lies flat, its crack gone dark; the hood slumps behind it.
parts.slabFlat = slabLying(false);
parts.slabDead = slabLying(true);
parts.hoodDead = rot90ccw(hood);
frames.die0 = [[lk('B', 0), 11, 23], ['body', 8, 13], ['hood', 14, 8], [lk('F', 0), 16, 23], ['slab', 24, 13]];
frames.die1 = [['body', 6, 22], ['hoodDead', 3, 24], ['slabFlat', 16, 22]];
frames.die2 = [['body', 6, 25], ['hoodDead', 3, 27], ['slabDead', 16, 25]];

export default {
  name: 'slab',
  title: 'Slab (shield brute)',
  notes: 'Slow tank. Glowing crack = weak point; breaks to a flat plank slab on death.',
  cell: [48, 40],
  shadow: [13, 5],
  pivot: [18, 32],
  palette,
  post,
  parts,
  frames,
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    attack: { loop: false, frames: ['atk0', 'atk1', 'atk2', 'atk3'], ms: [260, 140, 70, 220] },
    hurt: { fps: 6, loop: false, frames: ['hurt0'] },
    die: { fps: 5, loop: false, frames: ['die0', 'die1', 'die2'] },
  },
};
