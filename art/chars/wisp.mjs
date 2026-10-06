// WISP — a will-o'-the-wisp (~12px): a hovering teal-white flame orb with a dark hollow face and trailing wisps. FLIES: no legs;
// the pivot is the ground line (an empty `legGround` part pins it) and the orb floats a few px above. The one enemy allowed to glow:
// it IS the false light that lures heroes. windup = the orb swells and flares near-white (the lure telegraph), cast = it stretches
// up, bright, tongues high. dead = a dim cinder-husk on the mud.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';

// f/F/h = flame ramp (deep teal, bright cyan-teal, near-white); k = the dark hollow of the face; c = cinder
const palette = { l: G.lead, e: G.lead, ...G, f: '#1b9a96', F: '#35e0cc', h: '#d6fff6', k: '#0a2a36', c: '#1c4a4c', C: '#2f7a72' };
const post = { ink: 'l', all: true };

/** A round flame orb: lit core up-left, a dark hollow face, and flame tongues licking off the top (heights in px, left to right). */
function orb(r, { tongues = [2, 4, 2], eyes = 'open', hollow = 1 } = {}) {
  const W = r * 2 + 3, T = Math.max(...tongues) + 1, H = r * 2 + 1 + T;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const cx = r + 1, cy = T + r;
  for (let y = 0; y <= r * 2; y++) for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - r;
    if (Math.hypot(dx, dy) > r + 0.3) continue;
    const d = Math.hypot(dx + r * 0.25, dy + r * 0.3) / r;
    g[T + y][x] = d < 0.5 ? 'h' : d < 0.95 ? 'F' : 'f';
  }
  // tongues: pointed flames rising from the crown
  const n = tongues.length;
  tongues.forEach((h, i) => {
    const x = cx - Math.floor(r * 0.7) + Math.round((i * r * 1.4) / Math.max(1, n - 1));
    for (let k = 1; k <= h; k++) {
      const y = T - k + 1;
      if (y < 0) break;
      g[y][x] = k >= h - 1 ? 'F' : 'h';
      if (k < h - 1 && x + 1 < W) g[y][x + 1] = 'F';
      if (k < 2 && x - 1 >= 0) g[y][x - 1] = 'F';
    }
  });
  // the hollow face: two eye pits and a gaping mouth, dark so it reads on any ground
  const ey = T + Math.round(r * 0.75), ex = Math.round(r * 0.45);
  const put = (x, y, c) => { if (g[y]?.[x] !== undefined && g[y][x] !== '.') g[y][x] = c; };
  const pit = (x, y, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, 'k'); };
  if (eyes === 'open') { pit(cx - ex - 1, ey, 2, hollow + 1); pit(cx + ex, ey, 2, hollow + 1); pit(cx - 1, ey + hollow + 2, 2, 1); }
  if (eyes === 'wide') { pit(cx - ex - 1, ey - 1, 2, hollow + 2); pit(cx + ex, ey - 1, 2, hollow + 2); pit(cx - 2, ey + hollow + 2, 4, 2); }
  if (eyes === 'hurt') { pit(cx - ex - 1, ey, 2, 1); pit(cx + ex, ey, 2, 1); pit(cx - 1, ey + 3, 3, 1); }
  return g.map((r2) => r2.join(''));
}
const orbS = orb(5, { tongues: [2, 4, 2] });
const orbA = orb(5, { tongues: [3, 5, 2] });
const orbB = orb(5, { tongues: [2, 3, 4] });
const orbBig = orb(6, { tongues: [3, 5, 3], eyes: "wide", hollow: 2 });
const orbBigger = orb(7, { tongues: [4, 7, 5], eyes: 'wide', hollow: 2 });
const orbCast = orb(5, { tongues: [4, 8, 5], eyes: 'wide' });
const orbHurt = orb(5, { tongues: [1, 2, 1], eyes: 'hurt' });

const tailA = rows(`
  .hF..Fh.
  fFFhFFf.
  .fFFFf..
  .fF.Ff..
  ..fF.f..
  ..f.f...
  ...f.f..
  ....f...
`);
const tailB = rows(`
  .Fh.hF..
  fFFhFFf.
  ..fFFf..
  .fF.fF..
  .f.fF...
  ..f.f...
  .f..f...
  ......f.
`);
const tailC = rows(`
  ..hF.hF.
  .fFhFFf.
  .fFFFf..
  ..fF.Ff.
  ..f.fF..
  ...f.f..
  ..f..f..
  .f......
`);
const tailLong = rows(`
  .hFh.hFh.
  fFFhFhFFf
  .fFFFFFf.
  .fF.F.Ff.
  .f.fF.f..
  ..f.F.f..
  ..f.f.f..
  .f..f....
  ....f....
`);
const cinder = rows(`
  ..cCCc..
  .cCkCkCc
  cCCCCCCc
  .cccccc.
`);
const parts = { orbS, orbA, orbB, orbBig, orbBigger, orbCast, orbHurt, tailA, tailB, tailC, tailLong, cinder, legGround: ['.'] };

const CX = 12;
function pose(name, { o = 'orbS', dy = 0, dx = 0, t = 'tailA', ground = true, ty = 0 } = {}) {
  const r = parts[o].length, w = parts[o][0].length;
  const top = 24 - r + dy;
  const out = [];
  if (ground) out.push(["legGround", CX, 28]);
  out.push([t, CX - Math.floor(parts[t][0].length / 2) + dx, top + r - 3 + ty]);
  out.push([o, CX - Math.floor(w / 2) + dx, top]);
  frames[name] = out;
}
const frames = {};
pose('walk0', { dy: 0, t: 'tailA' });
pose('walk1', { dy: -1, t: 'tailB', o: 'orbA' });
pose('walk2', { dy: 0, t: 'tailC', o: 'orbB' });
pose('walk3', { dy: 1, t: 'tailB', o: 'orbA' });
pose('idle0', { dy: 0, t: 'tailA', o: 'orbA' });
pose('idle1', { dy: -1, t: 'tailC', o: 'orbB' });
pose('windup0', { o: 'orbBig', dy: 0, t: 'tailLong', ty: 1 });
pose('windup1', { o: 'orbBigger', dy: -1, t: 'tailLong', ty: 2 });
pose('cast0', { o: 'orbCast', dy: -2, t: 'tailLong', ty: 1 });
pose('cast1', { o: 'orbBig', dy: -1, t: 'tailB' });
pose('hurt0', { o: 'orbHurt', dx: -2, t: 'tailC' });
frames.deadf = [["legGround", CX, 28], ["cinder", CX - 4, 25]];

export default {
  name: 'wisp', title: 'Wisp', notes: 'Flies; hovers above the ground line. A caster: windup = the orb swells and flares (the false-light lure). The one glowing enemy.',
  cell: [24, 32], shadow: [6, 2], pivot: [CX, 28], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 4, frames: ['idle0', 'idle1'] },
    windup: { fps: 2, frames: ['windup0', 'windup1'] },
    cast: { fps: 4, frames: ['cast0', 'cast1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['deadf'] },
  },
};
