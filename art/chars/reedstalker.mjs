// REEDSTALKER — a lanky heron-person of the reeds with the longest spear in the game (~22px of reach). Tall thin silhouette:
// a pale heron head on a long neck with a yellow dagger beak and a dark plume, a woven reed-straw cloak with green fringe,
// stork legs. The spear is baked into every pose: carried slanted up like a punt-pole, drawn back on `windup`, thrust
// straight out on `strike`. Faces right. Corpse = the unarmed pose laid down with the spear dropped beside it.
import { GLASS as G } from '../palette.mjs';
import { rows, weapon, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, h: '#d8c070', g: '#a89040', a: '#6a5a24', q: '#5aa030', y: '#e8b83a', Y: '#fff0a0', f: '#c8d0d8', F: '#8c98aa' };
const post = { ink: 'l', all: true };
const pad = (r) => { const w = Math.max(...r.map((x) => x.length)); return r.map((x) => x.padEnd(w, '.')); };

const head = pad(rows(`
  .lff....
  ffRfyyyy
  .ffF....
  ..fF....
  ..ff....
`));
const headStrike = pad(rows(`
  ..lff...
  .ffRfyyyy
  ..ffF....
  ...fF....
  ...ff....
`));
const headHurt = pad(rows(`
  .lff....
  ffllyyy.
  .ffF....
  ..fF....
  ..ff....
`));
const robe = pad(rows(`
  .hhhhh.
  hhqhhqh
  hghhghg
  hhhqhhh
  .gqhhq.
  ..qhhq.
`));
const shoe = rows(`
  .y
  .y
  .y
  .y
  yy
`);
const spear = (ang) => weapon({
  angle: ang, len: 18, half: 1.1, grip: 1, holdU: 0,
  mat(u, v, L) {
    if (u < -6 || u > L) return null;
    if (u > L - 4.5) { const w = 1.3 * (1 - Math.abs(u - (L - 2.6)) / 2.4); return Math.abs(v) <= Math.max(w, 0.3) ? (v < 0 ? 'X' : 'Z') : null; }   // leaf blade
    if (u > L - 6.5 && u < L - 4.5) return Math.abs(v) <= 0.55 ? 'R' : null;                                                                      // red binding
    return Math.abs(v) <= 0.5 ? (v < 0 ? 'O' : 'o') : null;
  },
});
const spearLying = outline(rows(`
  ooooooooooooZXXX
`), 'l');
const parts = { head, headStrike, headHurt, robe, shoe, spearLying };
const rig = robedRig({
  OX: 8, OY: 9, parts, shoe,
  layout: { robe: [3, 5], head: [3, 0], legB: [4, 11], legF: [7, 11], sleeve: null, hand: [8, 8] },
  prop(o, h, { add, T }) {
    if (o.noweapon) return [];
    const k = add('sp' + (o.ang ?? -60), () => spear(o.ang ?? -60));
    return [[k, ...T(...h)]];
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1, ang: -62 });
pose('walk1', { bob: 0, ang: -60 });
pose('walk2', { bob: 1, lf: -1, lb: 1, ang: -62 });
pose('walk3', { bob: 0, ang: -60 });
pose('idle0', { bob: 0, ang: -64 });
pose('idle1', { bob: 1, ang: -66 });
pose('windup0', { ang: -35, lean: -1, bob: 1, hx: -1, lf: -1, lb: 1 });
pose('windup1', { ang: -8, lean: -2, bob: 1, hx: -2, hy: 0, lf: -1, lb: 1 });
pose('strike0', { ang: 0, lean: 3, hx: 1, lf: 2, lb: -2, headPart: 'headStrike' });
pose('strike1', { ang: 3, lean: 4, bob: 0, hx: 1, lf: 2, lb: -1, headPart: 'headStrike' });
pose('hurt0', { ang: -75, lean: -1, hx: -1, hy: 1, bob: 1, headPart: 'headHurt' });

export default {
  name: 'reedstalker', title: 'Reedstalker', notes: 'Heron-person with a very long spear (~22px reach). Spear baked in; strike = full thrust.',
  cell: [48, 30], shadow: [8, 3], pivot: [24, 24], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['spearLying', 4, 26]] } },
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
