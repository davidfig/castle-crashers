// GOBLIN — the horde grunt. Game scale: ~8px of body + outline. Hunched green imp with a long ear, a gold eye, a crimson rag.
// The game animates lean/lunge and draws the dagger (see weapons.mjs); the sprite supplies the body poses:
// walk, idle, windup (crouch, mouth open), strike (lunge), hurt (recoil, eye shut).
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G };
const post = { ink: 'l', all: true };

const head = rows(`
  n.nnn
  nnnnY
  .nnn.
`);
const headOpen = rows(`
  n.nnn
  nnnnY
  .nRR.
`);
const headHurt = rows(`
  n.nnn
  nnnnl
  .nRn.
`);
const robe = rows(`
  .nnn.
  nmmnn
  .nRn.
`);
const shoe = rows(`
  n.
  nn
`);
const parts = { head, headOpen, headHurt, robe, shoe };
const rig = robedRig({
  OX: 3, OY: 2, parts, shoe,
  layout: { robe: [3, 3], head: [4, 0], legB: [3, 6], legF: [5, 6], sleeve: null },
  prop: () => [],
});
const { pose } = rig;

pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1, hy: 0 });
pose('windup0', { lean: -1, bob: 1, hx: -1, lf: -1, lb: 1, headPart: 'headOpen' });
pose('windup1', { lean: -1, bob: 1, hx: -1, hy: 1, lf: -1, lb: 1, headPart: 'headOpen' });
pose('strike0', { lean: 2, hx: 1, lf: 2, lb: -2, headPart: 'headOpen' });
pose('strike1', { lean: 1, bob: 1, lf: 1, lb: -1 });
pose('hurt0', { lean: -1, hx: -1, hy: 1, bob: 1, headPart: 'headHurt' });

export default {
  name: 'goblin', title: 'Goblin', notes: 'Horde grunt. Body poses only; the game draws the dagger.',
  cell: [16, 11], shadow: [8, 3], pivot: [8, 9], palette, post,
  parts, frames: rig.frames,
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
