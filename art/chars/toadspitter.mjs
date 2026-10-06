// TOADSPITTER — ranged marsh toad-person, ~13px tall. Mustard-green warty hide, goggle eyes, a pale belly and a throat sac
// (orange) that is a small pouch at rest. `aim` = head thrown back, the sac swollen fat; `release` = mouth open, sac
// collapsed, a gob of venom leaving the lips (the game draws the flying glob). Walk/idle/hurt/dead as usual.
import { GLASS as G } from '../palette.mjs';
import { rows } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

const palette = { l: G.lead, e: G.lead, ...G, a: '#5a4a1c', g: '#8f9430', h: '#b8c048', p: '#f0e6a8', s: '#e88a28', S: '#fbd070', v: '#a6ee34', V: '#5cb01e' };
const post = { ink: 'l', all: true };
const pad = (r) => { const w = Math.max(...r.map((x) => x.length)); return r.map((x) => x.padEnd(w, '.')); };

const head = pad(rows(`
  .YY.YY.
  hYlhYlh
  hOhhOhh
  gaaaaag
  .sSSSs.
`));
const headAim = pad(rows(`
  .YY.YY.
  hYYhYYh
  hhhhhhh
  gaaaaag
  .sSSSs.
  sSSSSSs
  sSSSSSs
  .ssSSs.
`));
const headSpit = pad(rows(`
  .YY.YY.
  hYlhYlh
  hhhhhhh
  gRRRRRvV
  .gsSsg.v
`));
const headHurt = pad(rows(`
  .hh.hh.
  hllhllh
  hhhhhhh
  gaaaaag
  .sSSSs.
`));
const robe = pad(rows(`
  .hhhhg.
  gOpppOg
  gpppppg
  gOpppOg
  .gpppg.
`));
const shoe = rows(`
  g..
  gg.
  ggg
`);
const parts = { head, headAim, headSpit, headHurt, robe, shoe };
const rig = robedRig({
  OX: 4, OY: 1, parts, shoe,
  layout: { robe: [3, 5], head: [3, 0], legB: [3, 10], legF: [5, 10], sleeve: null },
  prop() { return []; },
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1 });
pose('aim0', { headPart: 'headAim', hx: -1, lean: -1, bob: 0 });
pose('aim1', { headPart: 'headAim', hx: -1, hy: -1, lean: -1, bob: 0 });
pose('release0', { headPart: 'headSpit', lean: 1, bob: 1, hx: 1 });
pose('hurt0', { headPart: 'headHurt', bob: 1, lean: -1, hx: -1, hy: 1 });

export default {
  name: 'toadspitter', title: 'Toadspitter', notes: 'Ranged toad-person. aim = throat sac swollen, head back; release = spat (game draws the venom glob).',
  cell: [20, 17], shadow: [8, 3], pivot: [10, 13], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'idle0', op: 'lie', after: [] } },
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    aim: { fps: 3, frames: ['aim0', 'aim1'] },
    release: { fps: 1, frames: ['release0'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
