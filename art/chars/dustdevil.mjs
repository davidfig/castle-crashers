// DUST DEVIL — a sand djinn: a whirling funnel of ochre-brown sand (wide at the top, tapering to a point above the ground), swirl
// bands in darker rust-brown, a hint of a dark hood with two pale eyes, and two long arms of sand. No legs; it hovers ~2px above the
// ground line (pivot set by hand; the game's shadow sits below the tip). It blasts heroes outward with a gust.
// Poses: walk (drift and spin), idle, windup (spins up, arms wide), strike (arms thrust, the gust), hurt, dead (a slumped sand heap).
import { GLASS as G } from '../palette.mjs';
import { line } from '../lib.mjs';

// d = dark swirl band, o = body, O = lit side, w = sun-bleached grain, k = the hood's hollow, e = eyes
const palette = { l: G.lead, ...G, d: '#4c2a10', o: '#8a5424', O: '#b27a38', w: '#d8aa60', k: '#1c0e08', e: '#f2d890' };
const post = { ink: 'l', all: true };

const CX = 13;                       // funnel axis
const TOP = 3, H = 16;               // funnel rows TOP .. TOP+H-1

/** the funnel body: width tapers with height, bands spiral with `ph`, the whole column leans/sways by `sway` */
function funnel({ ph = 0, sway = 0, wid = 0, lean = 0, squash = 0, hurt = false }) {
  return (put) => {
    const H2 = H - squash;
    for (let y = 0; y < H2; y++) {
      const t = y / (H2 - 1);                                   // 0 top .. 1 tip
      let hw = Math.max(1, Math.round(1 + (1 - t) ** 1.25 * (6 + wid)));
      if (t < 0.1) hw = Math.max(2, hw - 2); else if (t < 0.2) hw -= 1;
      if (y % 3 === 1 && t < 0.8) hw += 1;
      const cx = Math.round(CX + lean * (1 - t) + sway * Math.sin(t * 5 + ph * 0.9) * (0.4 + t));
      for (let x = -hw; x <= hw; x++) {
        const swirl = (x * 1.4 + y * 2.1 + ph * 2) / 4.2;       // diagonal spiral bands
        const b = ((Math.floor(swirl) % 3) + 3) % 3;
        let c = b === 0 ? 'd' : 'o';
        if (c === 'o' && x <= -hw + 1 && hw > 2) c = 'O';        // lit left edge
        if (c === 'd' && x >= hw - 1) c = 'd';
        if (hurt && (x + y) % 5 === 0) c = 'w';
        put(cx + x, TOP + y, c);
      }
    }
  };
}
/** the hood: a dark hollow near the top of the funnel with two small pale eyes */
const hood = (ox, oy, kind = 'norm') => (put) => {
  const rows = kind === 'hurt'
    ? ['.kkkk.', 'kkkkkk', 'keekkk', 'kkkkkk', '.kkkk.']
    : kind === 'wide'
      ? ['.kkkkk.', 'kkkkkkk', 'keekeek', 'kkkkkkk', '.kkkkk.']
      : ['.kkkk.', 'kkkkkk', 'kekeek'.replace('kekeek', 'kekkek'), 'kkkkkk', '.kkkk.'];
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') put(ox + i, oy + j, c); }));
  // a hint of peaked hood above
  put(ox + 2, oy - 1, 'd'); put(ox + 3, oy - 1, 'd');
};
/** a long arm of sand: thick polyline from the shoulder to the hand, ending in a flicking wisp */
const arm = (sx, sy, mx, my, hx, hy, lit = true) => (put) => {
  line([sx, sy], [mx, my], lit ? 'O' : 'o')(put); line([sx, sy + 1], [mx, my + 1], 'o')(put);
  line([mx, my], [hx, hy], lit ? 'o' : 'd')(put); line([mx, my + 1], [hx, hy + 1], 'd')(put);
  put(hx, hy - 1, 'w'); put(hx + 1, hy, 'O'); put(hx + 1, hy + 1, 'o');
};
/** flying grains round the column */
const grains = (pts) => (put) => { for (const [x, y, c = 'w'] of pts) put(x, y, c); };

const frames = {};
const pose = (name, o = {}) => {
  const { ph = 0, sway = 1, wid = 0, lean = 0, hx = 0, hy = 0, bob = 0, kind = 'norm', sh = [9, 6], hand = [22, 8], mid = [18, 6], far = [4, 8], farMid = [8, 7], gr = [], squash = 0, hurt = false } = o;
  const f = [];
  f.push(arm(sh[0] - 2 + lean, TOP + 5 + bob, farMid[0] + lean, farMid[1] + bob, far[0] + lean, far[1] + bob, false));
  f.push((put) => funnel({ ph, sway, wid, lean, squash, hurt })((x, y, c) => put(x, y + bob, c)));
  f.push((put) => hood(CX - 3 + hx + lean, TOP + 2 + hy + bob, kind)(put));
  f.push(arm(sh[0] + 5 + lean, TOP + 5 + bob, mid[0] + lean, mid[1] + bob, hand[0] + lean, hand[1] + bob, true));
  if (gr.length) f.push(grains(gr));
  frames[name] = f;
};
pose('walk0', { ph: 0, sway: 1, hand: [22, 12], mid: [18, 10], far: [4, 13], farMid: [8, 11] });
pose('walk1', { ph: 1, sway: 1, bob: -1, hand: [23, 11], mid: [18, 9], far: [3, 12], farMid: [8, 10], gr: [[3, 15], [22, 14]] });
pose('walk2', { ph: 2, sway: 1, hand: [22, 12], mid: [18, 10], far: [4, 13], farMid: [8, 11], gr: [[21, 17], [5, 12]] });
pose('walk3', { ph: 3, sway: 1, bob: -1, hand: [23, 11], mid: [18, 9], far: [3, 12], farMid: [8, 10], gr: [[4, 17]] });
pose('idle0', { ph: 0, sway: 1, hand: [22, 12], mid: [18, 10], far: [4, 13], farMid: [8, 11] });
pose('idle1', { ph: 2, sway: 1, bob: -1, hand: [22, 11], mid: [18, 9], far: [4, 12], farMid: [8, 10], gr: [[6, 14], [20, 15]] });
// windup: spins up, column widens, arms flung wide and high
pose('windup0', { ph: 1, sway: 2, wid: 1, kind: 'wide', hand: [24, 3], mid: [19, 4], far: [2, 3], farMid: [7, 4], bob: -1, gr: [[1, 12], [24, 14], [3, 17], [22, 18]] });
pose('windup1', { ph: 3, sway: 2, wid: 2, kind: 'wide', hand: [25, 1], mid: [19, 2], far: [1, 1], farMid: [7, 2], bob: -2, gr: [[0, 9], [25, 10], [1, 14], [24, 15], [3, 18], [22, 19]] });
// strike: arms thrust forward, the column lunges; grains stream off to the right (the gust)
pose('strike0', { ph: 2, sway: 2, lean: 2, wid: 1, kind: 'wide', hand: [28, 7], mid: [21, 6], far: [24, 11], farMid: [14, 8], gr: [[26, 12], [29, 15], [27, 4], [30, 9]] });
pose('strike1', { ph: 0, sway: 1, lean: 3, hand: [28, 10], mid: [20, 8], far: [26, 13], farMid: [15, 10], gr: [[27, 6], [30, 11], [29, 16], [31, 8], [26, 17]] });
pose('hurt0', { ph: 1, sway: 3, lean: -2, squash: 1, kind: 'hurt', hurt: true, hand: [17, 5], mid: [15, 7], far: [6, 6], farMid: [9, 7], gr: [[4, 10], [18, 11], [8, 16]] });
// corpse: the column has collapsed into a low swirl of sand
const heap = (put) => {
  const rows = [
    '.....dddddd.....',
    '...ddooooood....',
    '.ddooOOooOooodd.',
    'dooOoodooOooodod',
    'dddoodddoooddodd',
  ];
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') put(5 + i, 16 + j, c); }));
  put(14, 15, 'k'); put(15, 15, 'k'); put(14, 16, 'e');
};
frames.dead0 = [heap];

export default {
  name: 'dustdevil', title: 'Dust Devil', notes: 'Hovering whirl of ochre sand with a hooded hollow and two sand arms (no legs: pivot set by hand; the tip hangs ~2px above the ground line).',
  cell: [32, 24], hover: true, shadow: [8, 3], pivot: [16, 21], palette, post, parts: {}, frames,
  derived: {},
  anims: {
    walk: { fps: 6, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 2, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead0'] },
  },
};
