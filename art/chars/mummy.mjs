// MUMMY — a slow, huge tomb mummy (~20px): dingy khaki linen bandages wound in dark-gapped bands, long strips unwinding from the arms
// and hem, a hollow dark face with two empty eye slits (no glow), a tarnished gold collar and bracers, arms outstretched. Its touch
// withers stamina (the game draws the effect). Poses: walk (heavy shamble), idle, windup (arms drawn back and up), strike (arms
// slam forward), hurt, dead (a slumped heap of linen with the gold collar on top).
import { GLASS as G } from '../palette.mjs';
import { rows, stepLeg, line } from '../lib.mjs';

// k = the hollow dark, u/y/Y/J = linen (shade, dull, mid, lit), g/G = tarnished gold
const palette = { l: G.lead, e: G.lead, ...G, k: '#0e0806', u: '#2a1c0e', y: '#5a4422', Y: '#86693a', J: '#b09452', g: '#80601c', G: '#c8a03a' };
const post = { ink: 'l', all: true };

const head = rows(`
  .yYYJy.
  yYYYYYy
  yYkYkYy
  yYkYkYy
  yuYYYuy
  .yuYuy.
`);
const headHurt = rows(`
  .yYYJy.
  yYYYYYy
  yYkkkYy
  yYYkYYy
  yuYkYuy
  .yuYuy.
`);
const headUp = rows(`
  .yYYJy.
  yYYYYYy
  yYkYkYy
  yYkYkYy
  yuYkkuy
  .yukuy.
`);
const collar = rows(`
  .gGGGGGg.
  gGGgGGgGg
  .gggggg..
`);
// the torso: procedural bands of linen. u = the dark gap between wraps, k = a hole in the wrapping.
function torso(w, h, taper) {
  const out = [];
  for (let y = 0; y < h; y++) {
    const ind = Math.max(0, Math.round(((y < 3 ? 2 - y : 0) + (y > h - 3 ? y - (h - 3) : 0) * 0) * taper));
    let r = '';
    for (let x = 0; x < w; x++) {
      if (x < ind || x >= w - ind) { r += '.'; continue; }
      const band = (y + (x >> 2)) % 3 === 2;
      let c = band ? 'u' : x < 3 ? 'J' : x > w - 4 ? 'y' : 'Y';
      if (!band && (x * 5 + y * 3) % 13 === 0) c = x < w / 2 ? 'Y' : 'y';
      if ((x * 7 + y * 11) % 23 === 0) c = 'k';
      if (x === 0 || x === w - 1) c = band ? 'u' : 'y';
      r += c;
    }
    out.push(r);
  }
  return out;
}
const chest = torso(11, 9, 1);
const chestBig = torso(12, 9, 1);
const leg = rows(`
  JYYy
  uuuu
  JYYy
  yYYy
  uuuu
  JYYy
  yyyy
`);
// hanging bandage strips at the waist, three sway shapes (ragged, trailing back/down)
const hem = (a) => rows(a === 0 ? `
  YuY.Yu.Y
  YuY.Yu.Y
  uY..uY..
  Y...Y...
  u.......
` : a === 1 ? `
  YuYY.uY.
  uYY..uY.
  YY...Yu.
  uY...u..
  ......Y.
` : `
  .YuY.Yu.
  .uYY.uY.
  ..Yu.Yu.
  ..uY.u..
  ..Y.....
`);
const parts = { head, headHurt, headUp, collar, chest, chestBig, hem0: hem(0), hem1: hem(1), hem2: hem(2) };
const lg = (side, foot, lift = 0) => { const k = `leg${side}${foot}_${lift}`; if (!parts[k]) parts[k] = stepLeg(leg, foot, lift); return k; };
// an outstretched arm: wrapped limb, gold bracer near the wrist, a fist, and a strip of linen trailing from the wrist
const arm = (sx, sy, hx, hy, col, dark, fl = 0, far = false) => (put) => {
  line([sx, sy], [hx, hy], col)(put);
  line([sx, sy + 1], [hx, hy + 1], far ? 'y' : 'Y')(put);
  line([sx, sy + 2], [hx, hy + 2], 'u')(put);
  const bx = Math.round(hx - (hx - sx) * 0.25), by = Math.round(hy - (hy - sy) * 0.25);
  for (let k = 0; k < 2; k++) { put(bx + k, by, far ? 'g' : 'G'); put(bx + k, by + 1, 'g'); put(bx + k, by + 2, 'u'); }
  put(hx + 1, hy, col); put(hx + 1, hy + 1, dark); put(hx + 2, hy, 'u');
  // trailing strips of linen, fluttering
  const L = 7 + fl;
  line([bx - 2, by + 3], [bx - 3 - fl, by + 3 + L], far ? 'y' : 'J')(put);
  line([bx - 1, by + 3], [bx - 1 - fl, by + 3 + L - 2], 'Y')(put);
  put(bx - 3 - fl, by + 3 + L, 'u');
};
const frames = {};
const pose = (name, o = {}) => {
  const { bob = 0, lean = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, hp = 'head', ch = 'chest', front = [26, 9], back = [24, 16], sw = 0 } = o;
  const X = 5 + lean, Y = 3 + bob;
  frames[name] = [
    arm(X + 10, Y + 8, back[0] + lean, Y + back[1] - 3, 'y', 'u', sw, true),
    [lg('B', lb, lbl), X + 3, Y + 17], [lg('F', lf, lfl), X + 7, Y + 17],
    ['hem' + sw, X + 3, Y + 15],
    [ch, X + 2, Y + 7],
    ['collar', X + 3 + hx, Y + 6],
    [hp, X + 5 + hx, Y + hy],
    arm(X + 11, Y + 8, front[0] + lean, Y + front[1] - 3, 'Y', 'y', sw),
  ];
};
pose('walk0', { bob: 1, lf: 1, lb: -1, sw: 0 });
pose('walk1', { bob: 0, lfl: 1, sw: 1 });
pose('walk2', { bob: 1, lf: -1, lb: 1, sw: 2 });
pose('walk3', { bob: 0, lbl: 1, sw: 1 });
pose('idle0', { bob: 0, sw: 1 });
pose('idle1', { bob: 1, hy: 1, front: [26, 10], back: [24, 17], sw: 2 });
pose('windup0', { lean: -1, bob: 0, hx: -1, hy: -1, hp: 'headUp', ch: 'chestBig', lf: -1, lb: 1, front: [18, 2], back: [15, 6], sw: 2 });
pose('windup1', { lean: -2, bob: -1, hx: -1, hy: -1, hp: 'headUp', ch: 'chestBig', lf: -1, lb: 1, front: [15, -1], back: [12, 4], sw: 0 });
pose('strike0', { lean: 3, bob: 1, hx: 1, hy: 1, hp: 'headUp', lf: 2, lb: -2, front: [29, 11], back: [26, 17], sw: 1 });
pose('strike1', { lean: 3, bob: 2, hx: 2, hy: 2, hp: 'headUp', lf: 1, lb: -1, front: [28, 16], back: [25, 18], sw: 2 });
pose('hurt0', { lean: -1, bob: 1, hx: -1, hy: 1, hp: 'headHurt', front: [21, 10], back: [19, 15], sw: 2 });
// corpse: a slumped heap of unwound linen, the gold collar lying on top, loose strips round it
parts.corpse = rows(`
  ......yYYJy.........u...
  ....gGGggGGg.yYkYkYy.uY..
  ..yYYuYJYYuYYyYYYYyuYYuy.
  .yYuYYYuYYYuYJYYuYYYuYYYy
  yYYuYYkYYuYYYuYYYkYYuYYyy
  uYuYYYuYYYuYuYYYuYYYuYYuY
  .uuYuuYuuuYuuuYuuuYuuYuu.
`);
frames.dead0 = [['corpse', 3, 15]];

export default {
  name: 'mummy', title: 'Mummy', notes: 'Tomb mummy; dingy khaki linen with dark wrap gaps, tarnished gold collar and bracers. Touch withers stamina.',
  cell: [38, 30], shadow: [14, 4], pivot: [19, 26], palette, post, parts, frames,
  derived: {},
  anims: {
    walk: { fps: 4, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 2, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    dead: { fps: 1, loop: false, frames: ['dead0'] },
  },
};
