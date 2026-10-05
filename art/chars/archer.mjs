// ARCHER — glass look, game scale. Silhouette: a tall curved bow held forward, a feathered green cap with a swept
// crimson feather, a quiver bristling with fletching on the back. Ability: charged shot (golden arrow + beam).
import { GLASS as G, GLASS_PLAYERS } from '../palette.mjs';
import { rows, shear, ring, stepLeg } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  SSSS.
  SSSSe
  SSSss
  .sss.
`);
const hat = rows(`
  R.nnn..
  RRnnnn.
  .nnnnnn
`);
const robe = rows(`
  .mmmmm.
  mmmmmmm
  mmmGGmm
  mmmmmmm
  .m...m.
`);
const sleeve = rows(`
  mm
  sS
`);
const leg = rows(`
  .oo
  .oo
  .oo
  ooo
`);
palette.o = '#7a4a2a';          // leather boots / trousers
const quiver = rows(`
  .RW
  .WR
  ggg
  ggg
  .g.
`);
const parts = { head, hat, robe, sleeve, shoe: leg, quiver };
parts.quiver0 = quiver;

// bow + string + arrow drawn straight into the frame; pull = how far the string is drawn back (0 = relaxed)
function bow({ gx, gy, pull = 0, arrow = false, glow = false, R = 6, aim = false }) {
  if (!aim) {
    // carried slanted across the front of the body (low at the left, high at the right), belly up, string straight below it
    return (put) => {
      for (let dx = -R; dx <= R; dx++) {
        const t = dx / R;
        const slope = -Math.round(dx / 2);
        const bulge = Math.round(2.4 * (1 - t * t));
        put(gx + dx, gy + slope - bulge, Math.abs(t) > 0.7 ? 'G' : 'g');
        put(gx + dx, gy + slope, 'w');
      }
    };
  }
  return (put) => {
    const x0 = gx - 2;
    for (let dy = -R; dy <= R; dy++) {
      const bulge = Math.round(2.4 * (1 - (dy / R) ** 2));
      put(x0 + bulge, gy + dy, Math.abs(dy) > R - 2 ? 'G' : 'g');
    }
    // string from tip to tip, bent back at the nock when drawn
    const nock = [x0 - pull, gy];
    const tips = [[x0, gy - R], [x0, gy + R]];
    const seg = (p, q) => { const n = Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])); for (let i = 0; i <= n; i++) put(Math.round(p[0] + (q[0] - p[0]) * i / n), Math.round(p[1] + (q[1] - p[1]) * i / n), 'w'); };
    seg(tips[0], nock); seg(nock, tips[1]);
    if (arrow) {
      for (let x = nock[0]; x <= x0 + 5; x++) put(x, gy, glow ? 'Y' : 'W');
      put(x0 + 6, gy, glow ? 'Y' : 'X'); put(x0 + 5, gy - 1, glow ? 'Y' : 'Z'); put(x0 + 5, gy + 1, glow ? 'Y' : 'Z');
      put(nock[0], gy - 1, 'R'); put(nock[0] + 1, gy + 1, 'R');
    }
  };
}

const rig = robedRig({
  OX: 10, OY: 12, parts, shoe: leg,
  layout: { back: [5, 6], robe: [7, 7], head: [8, 3], hat: [6, 1], legB: [8, 12], legF: [10, 12], hand: [14, 9], sleeve: [-1, -1] },
  prop(o, h, { T }) {
    const out = [];
    const [gx, gy] = T(...h);
    out.push(bow({ gx, gy, pull: o.pull ?? 0, arrow: o.arrow ?? false, glow: o.glow ?? false, aim: o.aim ?? false }));
    return out;
  },
});
const { frames, T } = rig;
// when the bow is carried (not aimed) it is held at the side of the body, so the grip sits on the sprite's centre line, low at the waist
const pose = (name, o = {}) => rig.pose(name, o.aim ? o : { ...o, hand: [10, (o.hand ? o.hand[1] : 9) + 2] });
const Q = { back: 'quiver0' };

pose('idle0', { ...Q });
pose('idle1', { ...Q, bob: 1, rb: 1, hand: [14, 10] });
pose('idle2', { ...Q, bob: 1, rb: 2, hand: [14, 10] });
pose('idle3', { ...Q, rb: 1 });
pose('walk0', { ...Q, bob: 1, lf: 2, lb: -2, lbl: 1, rb: 1 });
pose('walk1', { ...Q, lf: 0, lb: 1, lbl: 1, rb: 0 });
pose('walk2', { ...Q, bob: 1, lf: -2, lb: 2, lfl: 1, rb: 2 });
pose('walk3', { ...Q, lf: 1, lfl: 1, lb: 0, rb: 0 });

// attack: nock + draw (slow), full draw (hold), RELEASE (impact: arrow leaves), follow-through
parts.fxArrow = rows(`
  RW.......WWWWX
`);

// ability: charged shot — long gold-lit draw, then a piercing beam
parts.fxBeam = rows(`
  Y.YY.YYY.YYYY.YYYYY.YYYYYY.YYYYYYY
`);
parts.fxSpark = rows(`
  Y.Y
  .Y.
  Y.Y
`);
pose('cast0', { ...Q, aim: true, bob: 1, lean: -1, rb: 2, hand: [15, 7], arrow: true, pull: 2, glow: true });
pose('cast1', { ...Q, aim: true, bob: 1, lean: -1, rb: 2, hand: [16, 6], arrow: true, pull: 4, glow: true });
pose('cast2', { ...Q, aim: true, bob: 1, lean: -2, rb: 2, hand: [16, 6], arrow: true, pull: 5, glow: true });
pose('cast3', { ...Q, aim: true, bob: 0, lean: 1, rb: 1, hand: [17, 6], pull: 0 });          // RELEASE
pose('cast4', { ...Q, bob: 1, rb: 0, hand: [15, 10] });
// ---- the shot, same contract as the warrior (see warrior.mjs): draw -> hold -> release over the 8-tick slash arc the game draws
pose('sw0', { ...Q, aim: true, bob: 1, lean: -1, rb: 2, hand: [15, 6], arrow: true, pull: 1 });
pose('sw1', { ...Q, aim: true, bob: 1, lean: -1, rb: 2, hand: [16, 6], arrow: true, pull: 3 });
pose('sw2', { ...Q, aim: true, bob: 0, rb: 1, hand: [16, 6], arrow: true, pull: 4 });
pose('sw3', { ...Q, aim: true, bob: 1, lean: 1, rb: 1, hand: [16, 6], pull: 0 });          // RELEASE
pose('sw4', { ...Q, aim: true, bob: 1, lean: 1, rb: 1, hand: [16, 7], pull: 0 });
pose('rec0', { ...Q, bob: 1, rb: 0, hand: [15, 10] });
pose('rec1', { ...Q, bob: 0, rb: 0, hand: [15, 10] });
// charged shot as the finisher: a long glowing draw, then the release
pose('fin0', { ...Q, aim: true, bob: 1, lean: -1, rb: 2, hand: [15, 7], arrow: true, pull: 2, glow: true });
pose('fin1', { ...Q, aim: true, bob: 1, lean: -1, rb: 2, hand: [16, 6], arrow: true, pull: 3, glow: true });
pose('fin2', { ...Q, aim: true, bob: 1, lean: -2, rb: 2, hand: [16, 6], arrow: true, pull: 5, glow: true });
pose('fin3', { ...Q, aim: true, bob: 1, lean: -2, rb: 2, hand: [16, 6], arrow: true, pull: 5, glow: true });
pose('fin4', { ...Q, aim: true, bob: 0, lean: 1, rb: 1, hand: [17, 6], pull: 0 });         // RELEASE
pose('fin5', { ...Q, aim: true, bob: 1, lean: 1, rb: 1, hand: [17, 7], pull: 0 });

pose('hurt0', { ...Q, bob: 1, lean: -2, hx: -1, hy: 1, rb: 2, lf: -1, lb: 1, hand: [13, 10] });

// down: slumps; cap beside, bow dropped, quiver spilled
parts.puddle = rows(`
  ..mmmmm..
  .mmmGGmm.
  mmmmmmmmm
  ooooooooo
`);
parts.puddleLow = rows(`
  .........
  ..mmmmm..
  mmmGGmmmm
  ooooooooo
`);
parts.capFallen = rows(`
  RRnnnn
  .nnnnn
`);
parts.bowLying = rows(`
  .ggggggg.
  w.......w
`);
frames.down0 = [['robe1', ...T(7, 10)], ['head', ...T(8, 7)], ['hat', ...T(6, 5)], ['sleeve', ...T(13, 11)], ['quiver0', ...T(5, 9)]];
frames.down1 = [['puddle', ...T(6, 12)], ['head', ...T(3, 9)], ['capFallen', ...T(-3, 12)], ['bowLying', ...T(11, 16)], ['quiver0', ...T(13, 9)]];
frames.down2 = [['puddleLow', ...T(6, 14)], ['head', ...T(3, 11)], ['capFallen', ...T(-3, 14)], ['bowLying', ...T(11, 17)]];

export default {
  name: 'archer', title: 'Archer', notes: 'Feathered cap, quiver, tall bow. Ability = charged shot. Tunic colour swaps per player.',
  cell: [72, 40], shadow: [9, 4], pivot: [20, 28], palette, post,
  variants: [{ id: 'base', label: 'default', palette: {} }, ...GLASS_PLAYERS.map((v) => ({ ...v, palette: { m: v.palette.q, n: v.palette.R } }))],
  parts, frames,
  anims: {
    idle: { fps: 3, frames: ['idle0', 'idle1', 'idle2', 'idle3'] },
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    sweep: { loop: false, frames: ['sw0', 'sw1', 'sw2', 'sw3', 'sw4'], ms: [30, 30, 30, 30, 30] },        // spans the 8-tick slash arc
    finisher: { loop: false, frames: ['fin0', 'fin1', 'fin2', 'fin3', 'fin4', 'fin5'], ms: [30, 30, 30, 30, 30, 30] },
    recover: { loop: false, frames: ['rec0', 'rec1'], ms: [100, 120] },
    cast: { loop: false, frames: ['cast0', 'cast1', 'cast2', 'cast3', 'cast4'], ms: [200, 200, 220, 70, 200] },
    hurt: { fps: 6, loop: false, frames: ['hurt0'] },
    down: { fps: 5, loop: false, frames: ['down0', 'down1', 'down2'] },
  },
};
