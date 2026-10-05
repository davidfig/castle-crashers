// HARPOONER — Frozen Pass ice-fisher turned hunter (~12px): a blue parka with a fur-ringed hood, snow goggles, and a long barbed
// harpoon. Carried upright at its side, levelled on `aim` (also the windup), gone from the hand on `release` as the dart flies
// (the game draws the dart). Dark blue parka and a bright goggle strap so it reads on the snow.
import { GLASS as G } from '../palette.mjs';
import { rows, outline, line } from '../lib.mjs';
import { robedRig } from '../rigs/robed.mjs';

// p/P = parka (deep to mid blue), f/F = fur trim, d = boot
const palette = { l: G.lead, e: G.lead, ...G, p: '#24467a', P: '#3e72b8', f: '#6a5a4a', F: '#9c8870', d: '#2e251f', k: '#2a2a3a', q: '#e8a838' };
const post = { ink: 'l', all: true };

const head = rows(`
  .fFf.
  fkqkf
  fSSSf
  .fFf.
`);
const headHurt = rows(`
  .fFf.
  fkqkf
  fSlSf
  .fFf.
`);
const robe = rows(`
  pPPPp
  pPpPp
  pFFFp
  pPPPp
  .pPp.
`);
const shoe = rows(`
  .d
  .d
  dd
`);
// the harpoon: a shaft and a barbed head. `up` = carried upright; otherwise levelled to the right from (gx, gy)
function harpoon(gx, gy, up) {
  return (put) => {
    if (up) {
      for (let dy = -6; dy <= 4; dy++) put(gx, gy + dy, 'o');
      put(gx, gy - 7, 'Z'); put(gx, gy - 8, 'X'); put(gx - 1, gy - 6, 'Z'); put(gx + 1, gy - 6, 'Z');
    } else {
      for (let dx = -3; dx <= 7; dx++) put(gx + dx, gy, 'o');
      put(gx + 8, gy, 'Z'); put(gx + 9, gy, 'X'); put(gx + 7, gy - 1, 'Z'); put(gx + 7, gy + 1, 'Z');
    }
  };
}
const harpoonLying = outline(rows(`
  .ooooooooZX
  ......ZZ...
`), 'l');
const parts = { head, headHurt, robe, shoe, harpoonLying };
const rig = robedRig({
  OX: 3, OY: 6, parts, shoe,
  layout: { robe: [2, 4], head: [2, 0], legB: [2, 8], legF: [4, 8], sleeve: null },
  prop(o, h, { T }) {
    if (o.noweapon) return [];
    const bob = o.bob ?? 0, lean = o.lean ?? 0;
    const out = [];
    if (o.aim) {
      const [gx, gy] = T(6 + lean, 5 + bob);
      if (!o.thrown) out.push(harpoon(gx, gy, false));
      out.push(line(T(5 + lean, 5 + bob), [gx, gy], 'p'));
    } else {
      const [gx, gy] = T(6 + lean, 6 + bob);
      out.push(harpoon(gx, gy, true));
      out.push(line(T(5 + lean, 5 + bob), [gx, gy], 'p'));
    }
    return out;
  },
});
const { pose } = rig;
pose('bare', { noweapon: true });
pose('walk0', { bob: 1, lf: 1, lb: -1 });
pose('walk1', { bob: 0 });
pose('walk2', { bob: 1, lf: -1, lb: 1 });
pose('walk3', { bob: 0, hx: 1 });
pose('idle0', { bob: 0 });
pose('idle1', { bob: 1 });
pose('aim0', { aim: true, bob: 0, lean: -1 });
pose('aim1', { aim: true, bob: 0, lean: -2, hx: -1 });          // weight back, drawing the throw
pose('release0', { aim: true, thrown: true, bob: 1, lean: 1 });
pose('hurt0', { bob: 1, lean: -1, hx: -1, hy: 1, headPart: 'headHurt' });

export default {
  name: 'harpooner', title: 'Harpooner', notes: 'Frozen Pass ice-fisher. Harpoon carried upright, levelled on aim/windup, gone on release (the game draws the dart).',
  cell: [24, 20], shadow: [8, 3], pivot: [12, 18], palette, post,
  parts, frames: rig.frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['harpoonLying', 14, 18]] } },
  anims: {
    walk: { fps: 9, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 3, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['aim0', 'aim1'] },
    aim: { fps: 2, frames: ['aim0', 'aim1'] },
    release: { fps: 1, frames: ['release0'] },
    hurt: { fps: 1, frames: ['hurt0'] },
  },
};
