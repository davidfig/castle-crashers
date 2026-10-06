// FLAME ARCHER — ranged sun-cult archer: crimson-and-orange robes, a dark wrapped face with a gold eye, a bronze sun-disc
// headdress standing behind the head like a halo, a bow wrapped in flame-orange cloth. Carried low across the body;
// `aim` raises it (the game draws the fire-tipped arrow), `release` shows the string snapped straight.
import { GLASS as G } from '../palette.mjs';
import { rows, outline } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// r deep crimson, o crimson, O orange cloth, s dark sash, t dark skin, b dark bronze (g/G brass come from GLASS), w bow wood
const palette = { l: G.lead, e: G.lead, ...G, r: '#4a1210', o: '#a02416', O: '#e0601e', s: '#2a1810', t: '#6a3a22', b: '#7a4a14', w: '#3a2414', f: '#f0a030' };
const post = { ink: 'l', all: true };

const head = rows(`
  .rrrr
  roooo
  rtlYt
  .ttt.
`);
const headHurt = rows(`
  .rrrr
  roooo
  rtlll
  .ttt.
`);
const disc = rows(`
  .G.GG.G.
  ..bGGb..
  G.bggb.G
  .bgGggb.
  Gbggggb.
  .bgggb..
`);
const robe = rows(`
  .oooOo
  ooOooo
  ooooOo
  ssssss
  roooor
`);
const shoe = rows(`
  .s.
  ss.
`);
// the bow is wood wrapped in orange cloth; frayed cloth tails flutter off the tips
function bowEntry(gx, gy, aim, slack = false) {
  return (put) => {
    if (!aim) {
      for (let dx = -5; dx <= 5; dx++) put(gx + dx, gy - Math.round(2.2 * (1 - (dx / 5) ** 2)), Math.abs(dx) > 3 ? 'O' : 'w');
      put(gx - 5, gy, 'f'); put(gx + 5, gy, 'f'); put(gx - 6, gy - 1, 'O'); put(gx + 6, gy - 1, 'f');
    } else {
      for (let dy = -4; dy <= 4; dy++) put(gx + Math.round(1.8 * (1 - (dy / 4) ** 2)), gy + dy, Math.abs(dy) > 2 ? 'O' : 'w');
      put(gx, gy - 5, 'f'); put(gx - 1, gy - 5, 'O'); put(gx, gy + 5, 'f'); put(gx - 1, gy + 5, 'O');
      if (slack) { for (let dy = -4; dy <= 4; dy++) put(gx, gy + dy, 'W'); }
      else { put(gx - 1, gy - 4, 'W'); put(gx - 2, gy - 3, 'W'); put(gx - 2, gy + 3, 'W'); put(gx - 1, gy + 4, 'W'); for (let dy = -3; dy <= 3; dy++) put(gx - 2, gy + dy, 'W'); }
    }
  };
}
const bowLying = outline(rows(`
  .wOwOwO.
  f......f
`), 'l');
const parts = { head, headHurt, disc, robe, shoe, bowLying };
const rig = robedRig({
  OX: 3, OY: 5, parts, shoe,
  layout: { back: [-1, -2], robe: [3, 4], head: [3, 0], legB: [3, 9], legF: [5, 9], sleeve: null },
  prop(o, h, { T }) { const bob = o.bob ?? 0, lean = o.lean ?? 0; if (o.nobow) return [];
    return [bowEntry(...T((o.aim ? 8 : 5) + lean, (o.aim ? 6 : 8) + bob), !!o.aim, !!o.slack)]; },
});
const { pose } = rig;
pose('walk0', { bob: 1, lf: 1, lb: -1, back: 'disc' });
pose('walk1', { bob: 0, back: 'disc' });
pose('walk2', { bob: 1, lf: -1, lb: 1, back: 'disc' });
pose('walk3', { bob: 0, back: 'disc' });
pose('aim0', { aim: true, bob: 0, lean: -1, back: 'disc' });
pose('bare', { bob: 0, nobow: true });
pose('idle0', { bob: 0, back: 'disc' });
pose('idle1', { bob: 1, back: 'disc' });
pose('release0', { aim: true, slack: true, bob: 1, lean: -1, back: 'disc' });
pose('hurt0', { bob: 1, lean: -1, hx: -1, hy: 1, headPart: 'headHurt', back: 'disc' });

export default {
  name: 'flamearcher', title: 'Flame Archer', notes: 'Sun-cult archer; sun-disc headdress, flame-cloth bow. aim/release like the archer.',
  cell: [20, 18], shadow: [8, 3], pivot: [10, 15], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['bowLying', 11, 15]] } },
  anims: {
    walk: { fps: 8, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    aim: { fps: 1, frames: ['aim0'] },
    release: { fps: 1, frames: ['release0'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
