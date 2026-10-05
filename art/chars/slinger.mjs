// SLINGER — goblin sling-thrower. Goblin family (green skin, long ear, crimson rag) but a head taller and thinner, with a
// leather sling. Poses: walk, idle, windup (whirling the sling overhead), strike (release / follow-through), hurt, dead.
// The sling and stone are baked in; the game draws the flying rock.
import { GLASS as G } from '../palette.mjs';
import { rows, outline, line } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  n.nnn
  nnnnY
  .nnn.
`);
const headFocus = rows(`
  n.nnn
  nnnnY
  .nRn.
`);
const headHurt = rows(`
  n.nnn
  nnnnl
  .nRn.
`);
const robe = rows(`
  .nnn.
  nmmn.
  .nRn.
  .nRn.
`);
const shoe = rows(`
  n.
  nn
`);
const stoneLying = rows(`
  XZ
`);
const parts = { head, headFocus, headHurt, robe, shoe, stoneLying };

// the sling: a leather cord (o) from the hand to a pouch (O) holding a stone (X)
const sling = (a, b, stone = true) => (put) => {
  line(a, b, 'o')(put);
  if (stone) { put(b[0], b[1], 'X'); put(b[0] + 1, b[1], 'Z'); put(b[0], b[1] + 1, 'Z'); }
};
const arm = (a, b) => line(a, b, 'n');
const rig = robedRig({
  OX: 6, OY: 7, parts, shoe,
  layout: { robe: [3, 3], head: [4, 0], legB: [3, 7], legF: [5, 7], sleeve: null, hand: [8, 4] },
  prop(o, h, { T }) {
    const out = [];
    const sh = [(o.shx ?? 6) + (o.lean ?? 0), 4 + (o.bob ?? 0)];                       // shoulder
    if (o.noweapon) return out;
    out.push(arm(T(...sh), T(...h)));
    if (o.sl) out.push(sling(T(...o.sl[0]), T(...o.sl[1]), o.sl[2] ?? true));
    return out;
  },
});
const { pose } = rig;
const carry = { sl: [[8, 5], [7, 8]] };              // cord hangs down from the hand with the stone at its end
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1, hand: [8, 6], sl: [[8, 7], [7, 10, ], true] });
pose('walk1', { bob: 0, hand: [8, 5], sl: [[8, 6], [7, 9]] });
pose('walk2', { bob: 1, lf: -1, lb: 1, hand: [8, 6], sl: [[8, 7], [7, 10]] });
pose('walk3', { bob: 0, hand: [8, 5], sl: [[8, 6], [7, 9]] });
pose('idle0', { bob: 0, hand: [8, 5], sl: [[8, 6], [7, 9]] });
pose('idle1', { bob: 1, hand: [8, 6], sl: [[8, 7], [7, 10]] });
// windup: arm up, sling whirling above the head, stone out at the left then the right
pose('windup0', { lean: -1, bob: 1, hx: -1, lf: -1, lb: 1, hand: [3, -2], shx: 3, headPart: 'headFocus', sl: [[3, -2], [-1, -4]] });
pose('windup1', { lean: -1, bob: 1, hx: -1, hy: 0, lf: -1, lb: 1, hand: [3, -3], shx: 3, headPart: 'headFocus', sl: [[3, -3], [8, -5]] });
// strike: released (stone gone, cord whips forward), then follow-through with the arm down
pose('strike0', { lean: 2, hx: 1, lf: 2, lb: -2, hand: [12, 3], headPart: 'headFocus', sl: [[12, 3], [15, 4], false] });
pose('strike1', { lean: 1, bob: 1, lf: 1, lb: -1, hand: [11, 7], sl: [[11, 7], [8, 10], false] });
pose('hurt0', { lean: -1, hx: -1, hy: 1, bob: 1, hand: [6, 6], headPart: 'headHurt', sl: [[6, 7], [4, 9]] });
const { frames } = rig;

export default {
  name: 'slinger', title: 'Slinger', notes: 'Goblin sling-thrower. windup = whirl overhead, strike = release; the game draws the rock.',
  cell: [24, 16], shadow: [8, 3], pivot: [12, 14], palette, post,
  parts, frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['stoneLying', 13, 14]] } },
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
