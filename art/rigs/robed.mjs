// Shared paper-doll rig for small robed characters (game scale, ~18px tall).
// A variant supplies parts + a `prop` (weapon/ornament) and writes its own pose table; this assembles frames.
import { stepLeg, shear } from '../lib.mjs';

export function robedRig({ parts, layout, prop, propBack = null, shoe, OX = 10, OY = 10 }) {
  const L = { back: [11, 5], robe: [7, 8], head: [8, 3], hat: null, legB: [8, 18], legF: [10, 18], sleeve: [-2, -2], hand: [15, 13], ...layout };
  const T = (x, y) => [x + OX, y + OY];
  if (parts.robe) for (let i = 0; i < 3; i++) if (!parts['robe' + i]) parts['robe' + i] = i === 0 ? parts.robe : shear(parts.robe, (y, n) => (i === 1 ? 1 : -1) * Math.pow(y / (n - 1), 2) * 1.1);
  const frames = {};
  const legKey = (side, foot, lift = 0) => { const k = `leg${side}${foot}_${lift}`; if (!parts[k]) parts[k] = stepLeg(shoe, foot, lift); return k; };
  const ctx = { T, parts, add: (name, part) => { if (!parts[name]) parts[name] = typeof part === 'function' ? part() : part; return name; } };

  function pose(name, o = {}) {
    const { bob = 0, lean = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, rb = 0, back = null, hand = L.hand, fx = [] } = o;
    const h = [hand[0] + lean, hand[1] + bob];
    const out = [];
    if (back) out.push([back, ...T(L.back[0] + lean + hx, L.back[1] + bob + hy)]);
    if (propBack) for (const e of propBack(o, h, ctx)) out.push(e);
    out.push([legKey('B', lb, lbl), ...T(L.legB[0] + lean, L.legB[1])]);
    out.push(['robe' + rb, ...T(L.robe[0] + lean, L.robe[1] + bob)]);
    out.push([legKey('F', lf, lfl), ...T(L.legF[0] + lean, L.legF[1])]);
    out.push(['head', ...T(L.head[0] + lean + hx, L.head[1] + bob + hy)]);
    if (L.hat) out.push(['hat', ...T(L.hat[0] + lean + hx, L.hat[1] + bob + hy)]);
    for (const e of prop(o, h, ctx)) out.push(e);
    if (L.sleeve) out.push(['sleeve', ...T(h[0] + L.sleeve[0], h[1] + L.sleeve[1])]);
    for (const f of fx) out.push(f.length === 3 ? [f[0], ...T(f[1], f[2])] : f);
    frames[name] = out;
  }
  return { frames, pose, legKey, T, ctx };
}
