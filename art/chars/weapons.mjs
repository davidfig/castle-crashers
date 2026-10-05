// Rotated weapon sprites for the enemies' code-driven swings (windup raise, strike, charge). One frame per 15 degrees,
// 0 = forward, +90 = down (screen), drawn by the game at the arm pivot and mirrored with the mob. Anchor = cell centre.
import { GLASS as G } from '../palette.mjs';
import { weapon } from '../lib.mjs';

const palette = { l: G.lead, ...G };
const post = null;

const dagger = (ang) => weapon({
  angle: ang, len: 5, half: 0.8, grip: 1, holdU: 0,
  mat(u, v, L) {
    if (u >= -1 && u < 0.5) return Math.abs(v) <= 1.4 ? 'G' : null;
    if (u < 0.5 || u > L) return null;
    return Math.abs(v) > (u > L - 1.5 ? 0.3 : 0.8) ? null : (v < 0 ? 'X' : 'Z');
  },
  outlineChar: 'l',
});
const club = (ang) => weapon({
  angle: ang, len: 9, half: 0.9, grip: 1, holdU: 0,
  mat(u, v, L) {
    if (u >= -1 && u < L - 3) return Math.abs(v) <= 0.6 ? 'O' : null;
    const d = Math.hypot(u - (L - 1.2), v);
    if (d < 2.3) return d < 1.1 ? 'X' : 'z';
    return null;
  },
  outlineChar: 'l',
});

const STEP = 15, N = 360 / STEP;
const parts = {}, frames = {};
const anims = {};
for (const [name, make] of [['dagger', dagger], ['club', club]]) {
  for (let k = 0; k < N; k++) {
    const key = `${name}${k}`;
    parts[key] = make(k * STEP);
    frames[key] = [[key, 12, 12]];
  }
  // two rows of 12 so the sheet stays narrower than the atlas
  anims[`${name}A`] = { fps: 1, frames: Array.from({ length: 12 }, (_, k) => `${name}${k}`) };
  anims[`${name}B`] = { fps: 1, frames: Array.from({ length: 12 }, (_, k) => `${name}${k + 12}`) };
}

export default {
  name: 'weapons', title: 'Enemy weapons (rotated)', notes: 'dagger/club at 15-degree steps; grip at cell centre (12,12).',
  cell: [24, 24], shadow: [1, 1], pivot: [12, 12], palette, post, parts, frames, anims,
};
