// SIDEWINDER — a sidewinder viper: a low, long S-curve of russet-and-ochre scales with dark diamonds, a flat wedge head with a
// gold slit eye and a flicking red tongue. ~20px long, 3px thick. It travels hidden under the sand and pops up beside you (the
// game draws the dust ripple while hidden). Poses: walk (the S-curve ripples), idle (tongue flick), windup (coils back, head
// raised, hood flared), strike (darts forward, fangs bared), hurt, dead (limp and straight, belly up).
// Bodies are generated: a sine centre line with a thickness profile, shaded top light / bottom dark, a diamond every few px.
import { GLASS as G } from '../palette.mjs';

// o russet, O ochre (top light), m dark russet (belly side), d diamond / marking, R tongue/mouth, F fang
const palette = { l: G.lead, e: G.lead, ...G, o: '#8a3a16', O: '#bc6a20', m: '#5a2a12', d: '#1e0e0a', R: '#e03a2a', F: '#f4ead2' };
const post = { ink: 'l', all: true };
const W = 30, H = 13, GROUND = 10;

function snake({ x0 = 1, len = 19, base = 6, amp = 1.6, lam = 16, phase = 0, hy = 0, hood = false, open = false, tongue = 1, taper = 7, dead = false }) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  let hx = x0, hyc = base;
  for (let i = 0; i < len; i++) {
    const x = x0 + i;
    const th = i < 3 ? 1 : i < 5 ? 2 : i < taper ? 3 : 4;         // tail taper, thick mid-body
    const t = Math.min(1, (i + 1) / taper);
    const cy = Math.round(base + amp * Math.sin((2 * Math.PI * i) / lam + phase) * (0.4 + 0.6 * t) + (i > len - 5 ? hy * ((i - (len - 5)) / 4) : 0));
    const cols = th === 4 ? (dead ? ['m', 'm', 'm', 'O'] : ['O', 'o', 'o', 'm']) : th === 3 ? (dead ? ['m', 'm', 'O'] : ['O', 'o', 'm']) : th === 2 ? ['o', 'm'] : ['m'];
    for (let k = 0; k < th; k++) put(x, cy - 1 + k, cols[k]);
    if (th === 4 && i > 6) {
      const q = (i - 7) % 6;
      if (q === 2) { put(x, cy, 'd'); put(x, cy + 1, 'd'); }
      if (q === 1 || q === 3) put(x, cy + (q === 1 ? 0 : 1), 'd');
    }
    hx = x; hyc = cy;
  }
  // head: a flat wedge, wider than the neck
  const x = hx + 1, y = hyc;
  if (hood) {                                                      // hood flared: a tall fan behind the eye
    for (let k = -4; k <= 1; k++) put(x - 2, y + k, k === -4 ? 'o' : 'O');
    for (let k = -3; k <= 1; k++) put(x - 1, y + k, k === -3 ? 'O' : k === 0 ? 'd' : 'o');
    for (let k = -2; k <= 2; k++) put(x, y + k, k === -2 ? 'O' : k === 0 ? 'd' : 'o');
    put(x + 1, y - 1, 'O'); put(x + 1, y, 'Y'); put(x + 1, y + 1, 'o'); put(x + 1, y + 2, 'm');
    put(x + 2, y, 'o'); put(x + 2, y + 1, open ? 'F' : 'm'); put(x + 3, y + 1, open ? 'R' : 'm');
    if (open) put(x + 4, y + 2, 'R');
    else if (tongue) { put(x + 4, y + 1, 'R'); put(x + 5, y, 'R'); }
  } else {
    put(x, y - 1, 'O'); put(x + 1, y - 1, 'O'); put(x + 2, y - 1, 'o'); put(x + 3, y - 1, 'o');
    put(x, y, 'o'); put(x + 1, y, 'Y'); put(x + 2, y, 'o'); put(x + 3, y, 'o'); put(x + 4, y, 'o');
    put(x, y + 1, 'm'); put(x + 1, y + 1, 'm'); put(x + 2, y + 1, 'm'); put(x + 3, y + 1, open ? 'F' : 'm'); put(x + 4, y + 1, 'm');
    if (dead) put(x + 1, y, 'l');
    if (open) { put(x + 4, y + 2, 'R'); put(x + 5, y + 1, 'R'); put(x + 3, y + 2, 'F'); }
    else if (tongue === 1) { put(x + 5, y + 1, 'R'); put(x + 6, y, 'R'); put(x + 6, y + 2, 'R'); }
    else if (tongue === 2) { put(x + 5, y + 1, 'R'); put(x + 6, y + 1, 'R'); }
  }
  return g.map((r) => r.join(''));
}
const ground = ['.'];
const parts = { ground };
const frames = {};
const add = (name, opts, extra = {}) => {
  parts[name] = snake(opts);
  frames[name] = [...(extra.noGround ? [] : [['ground', 15, GROUND]]), [name, 0, 0]];
};
// walk: the S-curve slides along the body (phase), body slightly longer/shorter
add('walk0', { phase: 0 });
add('walk1', { phase: Math.PI / 2, x0: 2 });
add('walk2', { phase: Math.PI });
add('walk3', { phase: (3 * Math.PI) / 2, x0: 2 });
add('idle0', { phase: 0.4, tongue: 1 });
add('idle1', { phase: 0.4, tongue: 2, hy: -1 });
// windup: coiled back on itself (short, tall waves), head raised on a lifted neck, hood flared
add('windup0', { x0: 3, len: 15, amp: 2.2, lam: 11, phase: 0, base: 8, hy: -3, hood: true });
add('windup1', { x0: 2, len: 14, amp: 2.6, lam: 11, phase: 1, base: 8, hy: -4, hood: true, open: true });
// strike: stretched flat and low, fangs out
add('strike0', { x0: 2, len: 22, amp: 0.7, lam: 22, base: 9, open: true, taper: 6 });
add('strike1', { x0: 1, len: 23, amp: 0.4, lam: 22, base: 9, open: true, tongue: 0, taper: 6 });
add('hurt0', { x0: 3, len: 16, amp: 2, lam: 11, phase: 2, base: 8, hy: 1, tongue: 0 });
add('deadf', { x0: 3, len: 21, amp: 0.8, lam: 14, phase: 1, base: 9, dead: true, tongue: 0 }, { noGround: true });

export default {
  name: 'sidewinder', title: 'Sidewinder', notes: 'Low long viper. Travels hidden under the sand (the game draws a ripple); windup flares the hood.',
  cell: [W, H], shadow: [9, 3], pivot: [15, GROUND], palette, post,
  parts, frames,
  anims: {
    walk: { fps: 9, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 4, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['deadf'] },
  },
};
