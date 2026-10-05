// THE GAUNT — common horde unit. A starved, hunched wretch in a bone mask, dragging a rust hook.
// Same house style as the Warden (flat values, auto rim/ink). Differences that make enemies read as enemies:
//   * verdigris/bone palette (cold, sick) vs the heroes' rust/steel; hollow black eyes, NO glow (the dead don't shine)
//   * long arms, short legs, hump taller than the head: an unmistakable "hunch" silhouette even at 1x
import { MASTER as M } from '../palette.mjs';
import { rows, shear, limb, rot90ccw, stepLeg } from '../lib.mjs';

const palette = {
  k: M.ink, 1: M.s1, 2: M.s2, 3: M.s3, 4: M.s4, 5: M.s5, 6: M.s6, 7: M.s7,
  a: M.v1, b: M.v2, c: M.v3, d: M.v4,
  r: M.r1, R: M.r2, q: M.r3,
  g: M.b1, G: M.b2, y: M.b3,
};
const post = { ink: 'k', rim: { a: 'b', b: 'c', c: 'd', 2: '4', 3: '5', R: 'q', q: 'Q', 6: '7', 5: '6', G: 'y', r: 'R' } };

// carrion-bird skull mask: small cranium, long beak. Reads as "wrong" even at 1x.
const skull = rows(`
  .6666.....
  666666....
  66kk666666
  66kk66665.
  .6665.....
`);

const hump = rows(`
  ..b6b6b...
  .bbbccbb..
  bbbccccbb.
  bbcccccbb.
  .bbcacabb.
  .bbcacabb.
  ..bbcacb..
  ..bbRRRRb.
  ..RRqRRqR.
  ..R.Rr.Rr.
`);
const legShape = rows(`
  .bb.
  .bb.
  .cb.
  .cb.
  .bb.
  .cb.
  .bb.
  .bbb
`);
const hook = rows(`
  .2.
  .2.
  .2.
  GGG
  G..
`);

const parts = { skull, hump, hook };
const legKey = (side, f, l = 0) => { const k = `leg${side}${f}_${l}`; if (!parts[k]) parts[k] = stepLeg(legShape, f, l); return k; };
const frames = {};
const OX = 4, OY = 2;
function pose(name, o) {
  const { bob = 0, lean = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, hand = [14, 18], hx = 0, hy = 0, hookUp = false } = o;
  const T = (x, y) => [x + OX, y + OY];
  const out = [];
  out.push([legKey('B', lb, lbl), ...T(7 + lean, 15)]);
  out.push(limb([T(11 + lean, 8 + bob), T(...hand)], { w: 2, body: 'b' }));
  out.push(['hump', ...T(3 + lean, 4 + bob)]);
  out.push(['skull', ...T(9 + lean + hx, 6 + bob + hy)]);
  out.push([legKey('F', lf, lfl), ...T(9 + lean, 15)]);
  out.push(limb([T(10 + lean, 9 + bob), T(...hand)], { w: 2, body: 'c' }));
  out.push(['hook', ...T(hand[0] - 1, hand[1] - (hookUp ? 5 : 0))]);
  frames[name] = out;
}
pose('walk0', { bob: 1, lf: 3, lb: -3, lbl: 1, hand: [14, 15] });
pose('walk1', { bob: 0, lf: 0, lb: 1, lbl: 2, hand: [15, 16] });
pose('walk2', { bob: 1, lf: -3, lb: 3, lfl: 1, hand: [14, 15] });
pose('walk3', { bob: 0, lf: 1, lfl: 2, lb: 0, hand: [13, 16] });
pose('atk0', { bob: 1, lean: -2, hx: -1, lf: -1, lb: 1, hand: [6, 6], hookUp: true });
pose('atk1', { bob: 0, lean: 2, hx: 2, lf: 3, lb: -3, hand: [20, 11] });
pose('atk2', { bob: 1, lean: 2, hx: 2, lf: 1, lb: -1, hand: [18, 16] });
pose('hurt0', { bob: 1, lean: -2, hx: -2, hy: 1, lf: -1, lb: 1, hand: [11, 16] });

// dies by folding up into a heap of bones and rag; the skull rolls free
parts.pile = rows(`
  ....bbbb......
  ..bbbccbbb....
  .bbRRqRRbbb...
  bbRRqRRRRRbb..
  RRqRRRRrRRRRR.
`);
parts.bones = rows(`
  .77...77.
  7..777..7
`);
parts.skullSide = rot90ccw(skull).map((r) => r);
parts.skullSide = { rows: skull.map((r) => r), ax: 0, ay: 0 };
frames.die0 = [['hump', 6, 8], ['skull', 14, 12], [legKey('B', 0), 10, 18], [legKey('F', 0), 12, 18]].map((e) => [e[0], e[1], e[2]]);
frames.die1 = [['pile', 6, 12], ['bones', 8, 10], ['skullSide', 5, 13]];
frames.die2 = [['pile', 6, 15], ['bones', 12, 14], ['skullSide', 3, 17]];
legKey('B', 0); legKey('F', 0);

export default {
  name: 'gaunt',
  title: 'Gaunt (grunt)',
  notes: 'Horde fodder. Hunch + hook silhouette. Hollow eyes: enemies never glow.',
  cell: [32, 30],
  shadow: [7, 4],
  pivot: [14, 25],
  palette,
  post,
  parts,
  frames,
  anims: {
    walk: { fps: 7, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    attack: { loop: false, frames: ['atk0', 'atk1', 'atk2'], ms: [200, 60, 150] },
    hurt: { fps: 6, loop: false, frames: ['hurt0'] },
    die: { fps: 6, loop: false, frames: ['die0', 'die1', 'die2'] },
  },
};
