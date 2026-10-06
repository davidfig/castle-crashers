// FEN LORD — the Sunken Marsh boss, a colossal bloated toad-king (~74px, as big as the Orc Warlord / Rime King / Dread Regent):
// a vast mossy-backed green body with a pale swollen belly and a throat sac that inflates when it roars, bulging yellow eyes (they do
// not glow), a crown of bone spikes and reeds, mottled warty hide with wet highlights, and a gnarled staff with a hanging
// lantern (a sickly false light). Built like the Dread Regent (art/chars/dreadregent.mjs): each frame is composed from lit volumes plus
// hand-stamped details, then the builder inks the silhouette. Poses: walk, idle, windup, strike, hurt, the charge set (paw / charge /
// dazed), and the boss's own moves: slam (crouch-coil then rear up: its leap), roar (throat sac inflated, mouth wide, arms up), smash.
import { GLASS as G } from '../palette.mjs';

const palette = {
  l: G.lead, e: G.lead, ...G,
  a: '#2c5528', b: '#4a7a2e', c: '#74ac3a', d: '#a4cc52', f: '#c8e468',    // skin ramp
  h: '#8a8446', j: '#cfc87a', k: '#f2ecaa',                                 // belly / throat and wet gloss
  m: '#4f7a30', M: '#8cb844',                                               // moss
  w: '#cdbf99', W: '#f2e8cc',                                               // bone
  o: '#5e3f22', O: '#946a3a', n: '#14201a', T: '#d0506a', E: '#f2da3c',     // staff wood, mouth hollow, tongue, eye
  L: '#e4f09a', p: '#a5683a', y: '#c9ad4a', Y: '#e6d27a',                   // lantern light, warts, reeds
};
const post = { ink: 'l', all: true };

const CW = 120, CH = 96;           // cell; the sole row is CH-2 and the ink row below it is the ground line
const SOLE = CH - 2;
const SHIFT = 4;

// ---------- raster toolkit ----------
const M = () => new Uint8Array(CW * CH);
const idx = (x, y) => y * CW + x;
const ok = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH;
function fill(fn) { const m = M(); for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (fn(x + 0.5, y + 0.5)) m[idx(x, y)] = 1; return m; }
const ell = (cx, cy, rx, ry) => fill((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1);
function cap(x0, y0, r0, x1, y1, r1) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  return fill((x, y) => {
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2));
    return Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t)) <= r0 + (r1 - r0) * t;
  });
}
function poly(pts) {
  return fill((x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}
const box = (x0, y0, x1, y1) => fill((x, y) => x >= x0 && x < x1 && y >= y0 && y < y1);
const or = (...ms) => { const o = M(); for (const m of ms) for (let i = 0; i < o.length; i++) if (m[i]) o[i] = 1; return o; };
const sub = (a, b) => { const o = a.slice(); for (let i = 0; i < o.length; i++) if (b[i]) o[i] = 0; return o; };
const and = (a, b) => { const o = M(); for (let i = 0; i < o.length; i++) if (a[i] && b[i]) o[i] = 1; return o; };

// ramps: index 0 darkest .. 4 brightest

function steps(m, x, y, dx, dy, cap_ = 4) {
  let n = 1;
  while (n <= cap_ && ok(x + dx * n, y + dy * n) && m[idx(x + dx * n, y + dy * n)]) n++;
  return n;
}

/** Shade a mask with a lit ramp: upper-left light, a bright rim on the lit edge, a dark rim on the far edge. */
function shade(F, m, ramp, { bias = 0, rim = true } = {}) {
  let x0 = CW, x1 = -1, y0 = CH, y1 = -1;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (m[idx(x, y)]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return;
  const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, rx = (x1 - x0 + 1) / 2, ry = (y1 - y0 + 1) / 2;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!m[idx(x, y)]) continue;
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    const l = -0.55 * nx - 0.75 * ny + bias;
    let i = l > 0.5 ? 3 : l > -0.15 ? 2 : l > -0.6 ? 1 : 0;
    if (rim) {
      if (steps(m, x, y, 1, 1, 2) === 2 && steps(m, x, y, 0, 1, 2) === 2) i = Math.max(0, i - 1);
      if (steps(m, x, y, -1, -1, 2) === 2 && i >= 2) i = Math.min(4, i + 1);
    }
    F[idx(x, y)] = ramp[i];
  }
}
const paint = (F, m, ch) => { for (let i = 0; i < m.length; i++) if (m[i]) F[i] = ch; };
const px = (F, x, y, c) => { x = Math.round(x); y = Math.round(y); if (ok(x, y)) F[idx(x, y)] = c; };
function line(F, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) { px(F, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
/** Stamp hand-drawn rows with their top-left at (x, y); '.' is transparent, `skip` pixels never overwrite. */
function stamp(F, rows, x, y, flip = false) {
  rows.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.' && c !== ' ') px(F, x + (flip ? r.length - 1 - i : i), y + j, c); }));
}
/** Only paint onto pixels already covered by `m` (so details never spill past a shape). */
function stampIn(F, m, rows, x, y) {
  rows.forEach((r, j) => [...r].forEach((c, i) => { const X = x + i, Y = y + j; if (c !== '.' && ok(X, Y) && m[idx(X, Y)]) F[idx(X, Y)] = c; }));
}

// two-bone arm: elbow bends down/back
function elbow(S, H, l1, l2, bend = 1) {
  const dx = H[0] - S[0], dy = H[1] - S[1];
  let d = Math.hypot(dx, dy);
  const reach = l1 + l2 - 0.5;
  if (d > reach) { H = [S[0] + (dx / d) * reach, S[1] + (dy / d) * reach]; d = reach; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = S[0] + (dx / d) * a, my = S[1] + (dy / d) * a;
  const ex = mx + bend * (dy / d) * h, ey = my - bend * (dx / d) * h;
  return { E: [ex, ey], H };
}
// pick the elbow that sits lower on screen
function arm(S, H, l1 = 17, l2 = 16) {
  const a = elbow(S, H, l1, l2, 1), b = elbow(S, H, l1, l2, -1);
  return a.E[1] > b.E[1] ? a : b;
}



const R_SKIN = ['a', 'b', 'c', 'd', 'f'];
const R_FARS = ['a', 'a', 'b', 'b', 'c'];
const R_BELLY = ['h', 'h', 'j', 'k', 'k'];
const R_MOSS = ['m', 'm', 'M', 'M', 'M'];
const R_BONE = ['w', 'w', 'w', 'W', 'W'];
const R_WOOD = ['o', 'o', 'O', 'O', 'O'];

// ---------- the staff: a gnarled pole with a hooked head and a hanging lantern ----------
function drawStaff(F, hand, angDeg) {
  const a = (angDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const L = 40;
  const tip = [hand[0] + c * L, hand[1] + s * L];
  const tail = [hand[0] - c * 10, hand[1] - s * 10];
  shade(F, cap(tail[0], tail[1], 1.9, tip[0], tip[1], 2.5), R_WOOD, { bias: 0.1 });
  for (const t of [0.3, 0.55, 0.8]) px(F, tail[0] + (tip[0] - tail[0]) * t + 1, tail[1] + (tip[1] - tail[1]) * t, 'o');   // knots
  // a hook of root at the tip and a lantern hanging off it
  const tx = Math.round(tip[0]), ty = Math.round(tip[1]);
  line(F, tx, ty, tx + 3, ty - 2, 'O'); line(F, tx + 3, ty - 2, tx + 5, ty + 1, 'O');
  line(F, tx + 5, ty + 1, tx + 5, ty + 4, 'o');
  stamp(F, ['.oo.', 'oLLo', 'oLkL', 'oLLo', '.oo.'], tx + 3, ty + 4);
  px(F, tx + 5, ty + 6, 'k');
}

// ---------- head ----------
function drawHead(F, hc, kind) {
  const [hx, hy] = hc;
  const roar = kind === 'roar', hurt = kind === 'hurt', down = kind === 'down';
  const jaw = roar ? 8 : 0;
  // throat sac, hanging under the jaw: swells (and goes pale) on a roar
  const sacR = roar ? 12 : kind === 'swell' ? 9 : 5;
  const sac = ell(hx + 2, hy + 13 + (roar ? 5 : 0), sacR + 3, sacR);
  shade(F, sac, R_BELLY, { bias: 0.1 });
  if (roar || kind === 'swell') { for (let k = 0; k < 4; k++) line(F, hx - 6 + k * 3, hy + 14 + (roar ? 4 : 0), hx - 5 + k * 3, hy + 18 + (roar ? 5 : 0), 'h'); px(F, hx - 3, hy + 11 + (roar ? 4 : 0), 'k'); px(F, hx - 2, hy + 12 + (roar ? 4 : 0), 'k'); }
  // the great wide head
  const skull = or(ell(hx, hy, 17, 11), ell(hx + 8, hy + 3, 14, 8));
  shade(F, skull, R_SKIN);
  // lower jaw
  const jawM = or(ell(hx + 6, hy + 8 + jaw, 15, 5), box(hx - 6, hy + 6, hx + 20, hy + 8 + jaw));
  shade(F, jawM, R_SKIN, { bias: -0.15 });
  if (roar) {
    paint(F, and(poly([[hx - 4, hy + 6], [hx + 20, hy + 5], [hx + 20, hy + 8 + jaw], [hx - 4, hy + 8 + jaw]]), or(jawM, skull)), 'n');
    paint(F, ell(hx + 8, hy + 8 + jaw, 9, 3), 'T');        // the tongue
    for (let k = 0; k < 6; k++) px(F, hx + k * 3, hy + 7, 'k');
  } else {
    line(F, hx - 5, hy + 7, hx + 8, hy + 9 + (hurt ? -1 : 0), 'n');
    line(F, hx + 8, hy + 9, hx + 20, hy + 6, 'n');
    line(F, hx - 4, hy + 8, hx + 8, hy + 10, 'a');
    px(F, hx + 19, hy + 5, 'n');
  }
  // nostril, warts, wet gloss
  px(F, hx + 18, hy + 1, 'n'); px(F, hx + 19, hy + 1, 'n');
  for (const [x, y] of [[-6, 3], [2, 5], [10, -3], [-10, -1], [14, 4]]) { px(F, hx + x, hy + y, 'p'); px(F, hx + x - 1, hy + y - 1, 'f'); }
  // the crown: a ring of bone spikes among bound reeds
  const band = and(ell(hx + 2, hy - 12, 14, 4), box(hx - 14, hy - 16, hx + 18, hy - 10));
  shade(F, band, R_BONE, { bias: 0.1 });
  for (const [dx, h, w] of [[-9, 11, 2], [-4, 16, 2.3], [2, 19, 2.5], [8, 14, 2.2], [13, 10, 1.8]]) {
    shade(F, poly([[hx + dx - w, hy - 12], [hx + dx + w, hy - 12], [hx + dx + 0.5, hy - 12 - h]]), R_BONE, { bias: 0.15 });
  }
  for (const [dx, h] of [[-12, 15], [-1, 22], [5, 17], [11, 18]]) {       // reeds bound into the crown
    line(F, hx + dx, hy - 12, hx + dx + (dx < 0 ? -2 : 2), hy - 12 - h, 'y');
    px(F, hx + dx + (dx < 0 ? -2 : 2), hy - 13 - h, 'Y'); px(F, hx + dx + (dx < 0 ? -2 : 2), hy - 14 - h, 'Y');
  }
  for (let k = -12; k <= 14; k += 4) px(F, hx + k, hy - 11, 'o');
  // the bulging eyes (they do not glow): a yellow iris and a dark slit
  for (const [dx, dy] of [[-4, -10], [9, -9]]) {
    shade(F, ell(hx + dx, hy + dy, 6.5, 5.8), R_SKIN, { bias: 0.1 });
    if (!hurt) {
      paint(F, ell(hx + dx + 1.5, hy + dy + 0.5, 4, 3.6), 'E');
      line(F, hx + dx + 1, hy + dy - 2, hx + dx + 1, hy + dy + 3, 'l');
      px(F, hx + dx + 3, hy + dy - 1, 'W');
    } else line(F, hx + dx - 3, hy + dy + 1, hx + dx + 5, hy + dy + 1, 'a');
    if (down) paint(F, box(hx + dx - 7, hy + dy - 7, hx + dx + 8, hy + dy - 1), 'c');
  }
}

// ---------- body ----------
function drawLeg(F, hipx, foot, lift, far) {
  const B = far ? R_FARS : R_SKIN;
  const hipy = 76, kneeX = hipx - 8 + foot * 0.3, kneeY = 84 - lift * 0.5, ankX = hipx + 6 + foot, ankY = SOLE - 5 - lift;
  shade(F, cap(hipx, hipy, 9, kneeX, kneeY, 6.5), B);                       // the thigh
  shade(F, cap(kneeX, kneeY, 5.5, ankX, ankY, 4.2), B);                      // the shin
  const toe = or(box(ankX - 4, ankY - 1, ankX + 12, SOLE - lift + 1), ell(ankX + 12, SOLE - lift - 1, 4, 3));
  shade(F, toe, B);
  for (const k of [3, 7, 11]) line(F, ankX + k, SOLE - lift - 1, ankX + k + 1, SOLE - lift + 1, 'a');   // webbed toes
  if (!far) { px(F, kneeX - 2, kneeY - 3, 'f'); px(F, hipx - 4, hipy - 5, 'f'); }
}

function drawBody(F, o) {
  const { lean, bob } = o;
  const cx = 50 + lean, cy = 62 + bob;
  const torso = or(ell(cx, cy, 29, 24), ell(cx - 4, cy - 8, 24, 18));
  shade(F, torso, R_SKIN);
  // the pale swollen belly
  const belly = and(ell(cx + 12, cy + 6, 19, 17), torso);
  shade(F, belly, R_BELLY, { bias: 0.05 });
  for (let k = 0; k < 5; k++) line(F, cx + 2 + k * 3, cy + 6 + (k % 2) * 2, cx + 3 + k * 3, cy + 20 - (k % 3), 'h');
  // the mossy back
  shade(F, and(ell(cx - 16, cy - 10, 17, 13), torso), R_MOSS, { bias: 0.1 });
  for (const [x, y] of [[-26, -2], [-20, 6], [-8, -18], [-14, 4], [-30, -8]]) shade(F, ell(cx + x, cy + y, 3.5, 2.8), R_MOSS);
  // warts, pustules and wet gloss
  for (const [x, y] of [[-4, -4], [6, -14], [-22, 14], [14, -8], [-10, 12], [20, 10], [-2, 18]]) {
    paint(F, ell(cx + x, cy + y, 2.2, 2), 'p');
    px(F, cx + x - 1, cy + y - 1, 'f'); px(F, cx + x, cy + y - 1, 'k');
  }
  for (const [x, y] of [[-12, -22], [8, -22], [22, -2], [18, 14]]) { px(F, cx + x, cy + y, 'k'); px(F, cx + x + 1, cy + y, 'd'); }
  return { cx, cy };
}

function drawArm(F, S, H, far) {
  const { E, H: Hh } = arm(S, H, 15, 14);
  const B = far ? R_FARS : R_SKIN;
  shade(F, cap(S[0], S[1], 5.2, E[0], E[1], 4.4), B);
  shade(F, cap(E[0], E[1], 4.4, Hh[0], Hh[1], 3.6), B);
  shade(F, ell(E[0], E[1], 4.8, 4.6), B);
  return Hh;
}
function drawHand(F, H, far) {
  const [x, y] = H;
  shade(F, ell(x, y, 5.6, 4.6), far ? R_FARS : R_SKIN);
  for (const k of [-3, 0, 3]) line(F, x + k, y + 2, x + k + 1, y + 5, far ? 'a' : 'b');      // webbed fingertips
  for (const k of [-4, -1, 2]) px(F, x + k, y + 5, far ? 'a' : 'c');
}

function build(o) {
  const { lean = 0, bob = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, head = 'norm', ang = -80, hand = [92, 62], far = [70, 72], staff = true, twoHand = false } = o;
  const F = new Array(CW * CH).fill(null);
  const S = [64 + lean, 52 + bob], S2 = [50 + lean, 50 + bob];
  const farH = drawArm(F, S2, far, true);
  drawHand(F, farH, true);
  drawLeg(F, 36 + lean * 0.5, lb, lbl, true);
  drawLeg(F, 62 + lean * 0.5, lf, lfl, false);
  const { cx, cy } = drawBody(F, { lean, bob });
  drawLeg(F, 36 + lean * 0.5, 0, 0, true);
  drawLeg(F, 62 + lean * 0.5, lf, lfl, false);
  if (staff) drawStaff(F, hand, ang);
  drawHead(F, [80 + lean + hx, 46 + bob + hy], head);
  const nh = drawArm(F, S, hand, false);
  drawHand(F, nh, false);
  if (staff && twoHand) drawHand(F, far, true);
  return F;
}

const frames = {};
function pose(name, o = {}) {
  frames[name] = [(put) => { const F = build(o); for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const c = F[idx(x, y)]; if (c) put(x + SHIFT, y, c); } }];
}

const rest = { ang: -80, hand: [94, 64], far: [72, 74] };
pose('bare', { staff: false, hand: [90, 70], far: [72, 74] });
pose('walk0', { ...rest, bob: 1, lf: 6, lb: -6, lbl: 3 });
pose('walk1', { ...rest, bob: -1 });
pose('walk2', { ...rest, bob: 1, lf: -6, lb: 6, lfl: 3 });
pose('walk3', { ...rest, bob: -1 });
pose('idle0', { ...rest, bob: 0, head: 'swell' });
pose('idle1', { ...rest, bob: 1, hy: 1 });
pose('windup0', { ang: -120, hand: [86, 38], far: [66, 44], lean: -3, bob: 1, hx: -1, head: 'swell', lf: -2, lb: 2 });
pose('windup1', { ang: -150, hand: [72, 30], far: [62, 40], lean: -5, bob: 2, hx: -2, hy: -1, head: 'swell', lf: -3, lb: 3 });
pose('strike0', { ang: -10, hand: [100, 52], far: [84, 60], lean: 4, bob: 2, hx: 2, head: 'roar', lf: 4, lb: -3 });
pose('strike1', { ang: 40, hand: [104, 74], far: [88, 72], lean: 6, bob: 3, hx: 3, hy: 2, lf: 3, lb: -3 });
pose('hurt0', { ang: -50, hand: [90, 54], far: [74, 66], lean: -4, bob: 2, hx: -2, hy: 1, head: 'hurt', lf: -1, lb: 1 });
pose('paw0', { ang: -40, hand: [92, 70], far: [76, 76], lean: -2, bob: 2, hx: -1, hy: 1, head: 'roar', lf: 3, lb: 2, lfl: 10 });
pose('paw1', { ang: -45, hand: [92, 70], far: [76, 76], lean: -3, bob: 1, hx: -2, head: 'roar', lf: 0, lb: 2 });
pose('charge0', { ang: 60, hand: [96, 74], far: [76, 72], lean: 8, bob: 3, hx: 3, hy: 4, head: 'norm', lf: 8, lb: -8, lbl: 5 });
pose('charge1', { ang: 62, hand: [96, 74], far: [76, 72], lean: 8, bob: 1, hx: 3, hy: 4, lf: -8, lb: 8, lfl: 5 });
pose('dazed0', { ang: 70, hand: [94, 78], far: [76, 80], lean: 2, bob: 5, hx: 1, hy: 8, head: 'down', lf: 1, lb: -1 });
pose('dazed1', { ang: 72, hand: [94, 78], far: [76, 80], lean: -1, bob: 5, hx: 0, hy: 8, head: 'down', lf: -1, lb: 1 });
// slam: a deep coiled crouch (the leap's wind-up), then rearing up with the staff raised to crash down
pose('slam0', { ang: -100, hand: [88, 50], far: [66, 56], twoHand: true, lean: -4, bob: 9, hx: -2, hy: 2, head: 'swell', lf: -4, lb: 4, lfl: 0 });
pose('slam1', { ang: -140, hand: [74, 24], far: [60, 28], twoHand: true, lean: -6, bob: -7, hx: -3, hy: -1, head: 'roar', lf: -4, lb: 4, lfl: 5, lbl: 5 });
// roar: head back, throat sac fully inflated, mouth wide, both arms thrown up
pose('roar0', { ang: -70, hand: [96, 32], far: [48, 34], lean: -3, bob: 1, hx: -3, hy: -1, head: 'roar', lf: -2, lb: 2 });
pose('roar1', { ang: -75, hand: [98, 28], far: [44, 30], lean: -4, bob: 0, hx: -3, hy: -2, head: 'roar', lf: -3, lb: 3 });
// smash: staff cocked back low, then driven across
pose('smash0', { ang: -150, hand: [66, 52], far: [60, 62], lean: -5, bob: 3, hx: -2, hy: 1, lf: -3, lb: 3 });
pose('smash1', { ang: -170, hand: [58, 54], far: [54, 62], lean: -6, bob: 3, hx: -3, hy: 1, lf: -4, lb: 4 });

export default {
  name: 'fenlord', title: 'Fen Lord (boss)', notes: 'The Sunken Marsh boss at ~74px: a bloated toad-king with a bone-and-reed crown, throat sac and lantern staff. Extra poses: slam (crouch then rear), roar (sac inflated), smash.',
  cell: [CW, CH], shadow: [60, 10], pivot: [60, SOLE], palette, post,
  parts: {}, frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie' } },
  anims: {
    walk: { fps: 5, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
    idle: { fps: 2, frames: ['idle0', 'idle1'] },
    windup: { fps: 1, frames: ['windup0', 'windup1'] },
    strike: { fps: 1, frames: ['strike0', 'strike1'] },
    hurt: { fps: 1, frames: ['hurt0'] },
    paw: { fps: 6, frames: ['paw0', 'paw1'] },
    charge: { fps: 12, frames: ['charge0', 'charge1'] },
    dazed: { fps: 4, frames: ['dazed0', 'dazed1'] },
    slam: { fps: 1, frames: ['slam0', 'slam1'] },
    roar: { fps: 8, frames: ['roar0', 'roar1'] },
    smash: { fps: 1, frames: ['smash0', 'smash1'] },
  },
};
