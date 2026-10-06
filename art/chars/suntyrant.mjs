// SUN TYRANT — the Scorched Dunes boss, a colossal sun-cult god-king at ~74px (as big as the Orc Warlord / Rime King / Dread Regent):
// a towering mummified pharaoh with dark leathery skin and a wrapped, hollow-eyed face, a braided gold false beard, a huge fan of
// gold sunburst rays for a headdress over crimson-and-gold nemes lappets, a broad gold collar, gold bracers and pauldrons with
// braziers flaring orange, a crimson sash, a wrapped linen skirt, and a great golden sunburst sceptre-flail. A wide sun disc (a
// crimson wheel with a gold rim and a ring of rays) is painted behind him; the game's sunbeam/sunfire fx are separate.
// Built like the Rime King (art/chars/rimeking.mjs): every frame is composed from lit volumes plus hand-stamped detail pixels, then
// the builder inks the silhouette. Poses: walk, idle, windup, strike, hurt, the charge set (paw / charge / dazed), and the boss's
// own moves (slam, roar, smash). Same cell, pivot and pose set as the Rime King.
import { GLASS as G } from '../palette.mjs';

const palette = {
  l: G.lead, e: G.lead, ...G,
  d: '#1c0e06', o: '#3a2010', O: '#5e3818', t: '#8a5428', T: '#b07a40',   // mummified skin: d o O t T (deep to lit)
  k: '#4a2c04', z: '#8a5a10', Z: '#d09a20', X: '#f8dc62',                  // gold: k z Z X
  c: '#3a0810', C: '#6e1220', s: '#a41c2a', S: '#d4402c',                  // crimson: c C s S
  n: '#3e3020', N: '#6a5630', m: '#9a8248', M: '#bea46a',                  // linen: n N m M
  p: '#2c1a10', P: '#4c2e1a', h: '#74482a', H: '#9a6638',                  // leather / wood
  f: '#e8601a', F: '#ffb030', y: '#fff0a0',                                // brazier flames
  I: '#2a2022', J: '#5a4a48',                                              // iron
  i: '#d4402c',                                                            // the sceptre's red gems
};
const post = { ink: 'l', all: true };

const CW = 120, CH = 96;           // cell; the sole row is CH-2 and the ink row below it is the ground line
const SOLE = CH - 2;
const SHIFT = 4;                   // body centre sits ~on the cell centre (the club reaches right)

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


const R_SKIN = ['d', 'o', 'O', 't', 'T'];
const R_FACE = ['o', 'O', 't', 'T', 'T'];
const R_FARS = ['d', 'd', 'o', 'O', 't'];          // the far-side limbs sit in shadow
const R_GOLD = ['k', 'z', 'Z', 'X', 'X'];
const R_CRIM = ['c', 'C', 's', 'S', 'S'];
const R_LINEN = ['n', 'N', 'm', 'M', 'M'];
const R_LEATHER = ['p', 'P', 'h', 'H', 'H'];
const R_STEEL = R_GOLD;                            // (the sceptre painter below was written for steel: here it is gold)
// ---------- the club (screen-space lit, so the light stays upper-left however it is swung) ----------
const CLUB_LEN = 46;
function drawClub(F, hand, angDeg) {
  const a = (angDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const L = CLUB_LEN, headU = L - 19;
  const Lt = [-0.6, -0.8];
  const prof = (u) => {
    if (u < -7 || u > L + 1) return -1;
    if (u < headU - 6) return 2.1 + Math.max(0, u) * 0.03;
    if (u < headU + 2) { const t = (u - (headU - 6)) / 8; return 2.4 + t * t * (3 - 2 * t) * 6.2; }
    if (u < L - 3.5) return 8.6;
    return 8.6 * Math.sqrt(Math.max(0, 1 - ((u - (L - 3.5)) / 4.5) ** 2));
  };
  const R = L + 14;
  for (let y = Math.floor(hand[1] - R); y <= Math.ceil(hand[1] + R); y++) for (let x = Math.floor(hand[0] - R); x <= Math.ceil(hand[0] + R); x++) {
    if (!ok(x, y)) continue;
    const dx = x + 0.5 - hand[0], dy = y + 0.5 - hand[1];
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    const r = prof(u);
    if (r < 0 || Math.abs(v) > r) continue;
    const t = v / r;
    const lit = t * (-s * Lt[0] + c * Lt[1]) + 0.35 * Math.sqrt(Math.max(0, 1 - t * t)) - 0.05;
    let i = lit > 0.55 ? 3 : lit > 0.12 ? 2 : lit > -0.35 ? 1 : 0;
    let ch;
    const band = (u > headU - 8.5 && u < headU - 7) || (u > L - 3 && u < L - 1.5) || (u > headU + 5 && u < headU + 6.5) || (u > -3 && u < -1.8);
    if (band) { ch = R_STEEL[i]; }
    else if (u > headU - 0.5 && u < L - 0.5) {
      // the head: a block of blue glacier ice, flecked with brighter facets between the bands
      ch = R_STEEL[Math.max(1, i)];
      const su = Math.round((u - headU) / 4.5) * 4.5 + headU, sv = Math.round(v / 4.2) * 4.2;
      if (Math.hypot(u - su, v - sv) < 1.1 && Math.abs(v) < r - 1) ch = R_STEEL[Math.min(4, i + 1)];
    } else {
      ch = R_LEATHER[i];
      if (u > 3 && u < headU - 9 && ((Math.floor(u) * 7 + Math.floor(v * 2) * 13) % 9 === 0)) ch = R_LEATHER[Math.max(0, i - 1)];
      if (u < 4 && u > -3.5 && Math.abs(Math.floor(u)) % 2 === 0) ch = R_LEATHER[Math.max(0, i - 1)];  // wrapped grip
    }
    F[idx(x, y)] = ch;
  }
  // spikes: a ring of cones round the head, plus one on the end
  const spike = (u, sideSign, len, w) => {
    const r = prof(u);
    const bx = hand[0] + c * u - s * sideSign * (r - 1), by = hand[1] + s * u + c * sideSign * (r - 1);
    const nx = -s * sideSign, ny = c * sideSign, tx = bx + nx * len, ty = by + ny * len;
    const pxu = c, pyu = s;
    const m = poly([[bx - pxu * w, by - pyu * w], [bx + pxu * w, by + pyu * w], [tx, ty]]);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (m[idx(x, y)]) {
      const tt = Math.hypot(x + 0.5 - bx, y + 0.5 - by) / len;
      const side = (x + 0.5 - bx) * -0.6 + (y + 0.5 - by) * -0.8;
      F[idx(x, y)] = tt > 0.78 ? 'X' : side > 0.3 ? 'Z' : 'z';
    }
  };
  for (const u of [headU + 1.5, headU + 8.5, headU + 14.5]) { spike(u, 1, 6.4, 1.5); spike(u, -1, 6.4, 1.5); }   // icicles
  // the end spike
  { const bx = hand[0] + c * (L - 1), by = hand[1] + s * (L - 1), tx = bx + c * 6, ty = by + s * 6;
    const m = poly([[bx - s * 2, by + c * 2], [bx + s * 2, by - c * 2], [tx, ty]]);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (m[idx(x, y)]) F[idx(x, y)] = Math.hypot(x + 0.5 - bx, y + 0.5 - by) > 4 ? 'X' : 'Z'; }
  // rime frost caked on the ice
  for (const [u, v] of [[headU + 4, 2], [headU + 11, -3], [L - 2, 1]]) {
    const X = Math.round(hand[0] + c * u - s * v), Y = Math.round(hand[1] + s * u + c * v);
    if (ok(X, Y) && F[idx(X, Y)] && 'zZXHhPp'.includes(F[idx(X, Y)])) F[idx(X, Y)] = 'i';
  }
}


// ---------- the sun disc painted behind him ----------
function drawDisc(F, cx, cy, r, flare = 0) {
  // a ring of short rays round the rim, then the wheel: gold rim, crimson field, a gold hub ring
  const n = 20;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.1, long = k % 2 === 0;
    const L = r + (long ? 7 + flare : 4 + flare * 0.5), w = 0.13;
    const p = (ang, rr) => [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
    const m = poly([p(a - w, r - 2), p(a + w, r - 2), p(a, L)]);
    shade(F, m, R_GOLD, { bias: -0.15 - 0.15 * Math.sin(a), rim: false });
  }
  shade(F, ell(cx, cy, r, r), R_GOLD, { bias: 0.05 });
  shade(F, ell(cx, cy, r - 4, r - 4), ['c', 'c', 'C', 'C', 's'], { bias: -0.2, rim: false });
  shade(F, ell(cx, cy, r - 9, r - 9), ['c', 'c', 'C', 'C', 'C'], { bias: 0, rim: false });
  for (let k = 0; k < 16; k++) {                          // engraved rays on the field
    const a = (k / 16) * Math.PI * 2;
    line(F, cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8), cx + Math.cos(a) * (r - 5.5), cy + Math.sin(a) * (r - 5.5), 'Z');
  }
}

// ---------- head ----------
function drawHead(F, hc, kind) {
  const [hx, hy] = hc;
  const roar = kind === 'roar', hurt = kind === 'hurt', down = kind === 'down';
  const jawDrop = roar ? 4 : 0;
  // the sunburst: a fan of gold rays behind the head, long and short, spread wider when he roars
  {
    const C = [hx - 1, hy - 1];
    const a0 = down ? -150 : roar ? -176 : -166, a1 = down ? -30 : roar ? -4 : -14;
    const nR = 9;
    for (let k = 0; k < nR; k++) {
      const a = ((a0 + (a1 - a0) * (k / (nR - 1))) * Math.PI) / 180;
      const Lr = (k % 2 === 0 ? 27 : 20) + (roar ? 5 : 0) - (down ? 9 : 0) - (Math.abs(k - 4) === 4 ? 4 : 0);
      const w = 0.17;
      const p = (ang, rr) => [C[0] + Math.cos(ang) * rr, C[1] + Math.sin(ang) * rr];
      shade(F, poly([p(a - w, 9), p(a + w, 9), p(a, Lr)]), R_GOLD, { bias: -0.2 + 0.5 * Math.cos(a + 2.2) });
      const [tx, ty] = p(a, Lr - 3); px(F, tx, ty, 'X');
      const [mx, my] = p(a, Lr * 0.55); px(F, mx, my, k % 2 ? 'S' : 'k');
    }
  }
  // nemes: crimson headcloth with a lappet hanging behind the neck, gold stripes
  {
    const lap = and(box(hx - 11, hy, hx - 4, hy + 13), or(ell(hx - 7, hy + 11, 4, 4), box(hx - 11, hy, hx - 4, hy + 11)));
    shade(F, lap, R_CRIM, { bias: -0.1 });
    for (let y = hy + 4; y < hy + 13; y += 4) line(F, hx - 10, y, hx - 5, y, 'Z');
  }
  const cloth = and(ell(hx, hy - 1, 11.5, 8), box(0, 0, CW, hy - 1));
  shade(F, cloth, R_CRIM, { bias: 0.05 });
  // face: dark mummified skin under wrapped linen
  const skull = ell(hx + 3, hy + 3, 9, 9.5);
  const jaw = or(ell(hx + 5, hy + 10 + jawDrop, 7.4, 4.2), box(hx - 2, hy + 6, hx + 11, hy + 9 + jawDrop));
  if (roar) {
    shade(F, jaw, R_FACE, { bias: -0.2 });
    shade(F, skull, R_FACE);
    const mouth = and(box(hx + 1, hy + 8, hx + 12, hy + 9 + jawDrop), jaw);
    paint(F, mouth, 'e'); paint(F, and(mouth, box(hx + 3, hy + 10 + jawDrop - 2, hx + 11, hy + 12 + jawDrop)), 'c');
    for (let k = 0; k < 4; k++) { px(F, hx + 3 + k * 2.2, hy + 8, 'W'); px(F, hx + 3 + k * 2.2, hy + 9 + jawDrop, 'w'); }
  } else {
    shade(F, jaw, R_FACE, { bias: -0.25 });
    shade(F, skull, R_FACE);
    line(F, hx + 2, hy + 9, hx + 11, hy + 8, 'd');
  }
  // linen wrapped over the lower face and a diagonal across the brow, loose ends trailing
  const wraps = [[-1, 6, 11, 10, 'N'], [-1, 8, 10, 12 + jawDrop, 'm'], [0, 12 + jawDrop, 9, 13 + jawDrop, 'N']];
  for (const [a, b, c, d, ch] of wraps) { line(F, hx + a, hy + b, hx + c, hy + d - 3, ch); line(F, hx + a, hy + b + 1, hx + c, hy + d - 2, 'n'); }
  line(F, hx - 3, hy + 1, hx + 9, hy + 4, 'M'); line(F, hx - 3, hy + 2, hx + 9, hy + 5, 'n');
  // hollow eye sockets (no glow), a dark nose slit
  if (hurt) { for (let k = 0; k < 3; k++) { px(F, hx + 4 + k, hy + 5, 'e'); px(F, hx + 8 + (k > 1 ? 0 : 0), hy + 5 + (k === 1 ? 1 : 0), 'e'); } px(F, hx + 6, hy + 6, 'e'); }
  else { for (const ex of [4, 8]) { px(F, hx + ex, hy + 5, 'e'); px(F, hx + ex + 1, hy + 5, 'e'); px(F, hx + ex, hy + 6, 'e'); px(F, hx + ex + 1, hy + 6, 'd'); px(F, hx + ex, hy + 4, 'M'); } }
  px(F, hx + 11, hy + 7, 'e'); px(F, hx + 11, hy + 8, 'e');
  // the golden brow band with a rearing sun-gem, a crimson stripe under it
  shade(F, and(ell(hx + 1, hy + 0, 11.5, 5.2), box(hx - 12, hy - 4, hx + 14, hy + 1)), R_GOLD, { bias: 0.1 });
  for (let k = -9; k <= 10; k += 3) px(F, hx + k, hy - 1, 'S');
  shade(F, ell(hx + 9, hy - 3, 3, 3), R_CRIM, { bias: 0.2 }); px(F, hx + 9, hy - 3, 'y');
  // the braided false beard, a gold plait ending in a curl
  const bx = hx + 8, by = hy + 14 + jawDrop;
  shade(F, cap(bx, by - 2, 2.6, bx + 1, by + 8, 2.2), R_GOLD, { bias: 0.1 });
  for (let k = 0; k < 4; k++) px(F, bx + (k % 2 ? 1 : -1), by + 1 + k * 2, 'k');
  px(F, bx + 2, by + 10, 'Z'); px(F, bx + 3, by + 9, 'Z');
}

// ---------- body ----------
function drawLeg(F, hipx, foot, lift, far) {
  const L = lift;
  const hipy = 78, kneeX = hipx + foot * 0.4 + 2, kneeY = 85 - L * 0.4, ankX = hipx + foot, ankY = SOLE - 6 - L;
  shade(F, cap(hipx, hipy, 7, kneeX, kneeY, 6), far ? R_FARS : R_SKIN);
  // a leather sandal-greave to the knee, wrapped in linen strips, a gold anklet and a flat sandal
  shade(F, cap(kneeX, kneeY, 5.8, ankX, ankY, 5), far ? ['p', 'p', 'p', 'P', 'h'] : R_LEATHER);
  const foot_ = or(box(ankX - 5, ankY - 1, ankX + 7, SOLE - L + 1), ell(ankX + 5, SOLE - L - 2, 4.5, 3.4));
  shade(F, foot_, far ? ['p', 'p', 'p', 'P', 'h'] : R_LEATHER);
  line(F, ankX - 4, SOLE - L, ankX + 6, SOLE - L, 'p');
  const wrap = ell(kneeX + 0.3 + (ankX - kneeX) * 0.6, ankY - 3.2, 6.8, 3.2);
  shade(F, wrap, far ? ['n', 'n', 'n', 'N', 'N'] : R_LINEN);
  for (let k = -5; k <= 5; k += 2) px(F, ankX + k + (kneeX - ankX) * 0.2, ankY - 0.2 + (k % 4 === 0 ? 0 : 1), far ? 'n' : 'N');
  line(F, ankX - 4, ankY + 2, ankX + 5, ankY + 2, far ? 'z' : 'Z');
  if (!far) { line(F, hipx - 2, hipy + 2, hipx, hipy + 7, 'o'); px(F, hipx + 3, hipy + 4, 'o'); }
}

function drawTorso(F, o) {
  const { lean, bob } = o;
  const cx = 56 + lean, top = 44 + bob;
  const back = ell(cx - 12, top + 5, 11, 9);
  const chest = ell(cx + 3, top + 13, 21, 16);
  const belly = ell(cx, top + 25, 17, 9);
  const neck = ell(cx + 9, top - 1, 8, 6);
  const torso = or(back, chest, belly, neck);
  shade(F, torso, R_SKIN);
  const pen = (x, y, c) => px(F, cx + x, top + y, c);
  const ln = (a, b, c) => line(F, cx + a[0], top + a[1], cx + b[0], top + b[1], c);
  // desiccated ribs, hollow belly, the old embalmer's seam and bandage scraps
  ln([4, 15], [16, 17], 'o'); ln([-9, 14], [-2, 17], 'o'); ln([2, 18], [2, 27], 'o');
  for (const y of [21, 24, 27]) ln([-2, y], [6, y + 0.5], 'o');
  ln([-13, 9], [-9, 12], 'o'); ln([-14, 13], [-10, 15], 'o'); ln([-14, 17], [-11, 18], 'o');
  ln([8, 20], [14, 23], 'd'); ln([9, 22], [13, 25], 'd');
  ln([-6, 20], [3, 23], 'N'); ln([-6, 21], [3, 24], 'n'); ln([-8, 24], [1, 27], 'm'); ln([-8, 25], [1, 28], 'n');   // wrap over the belly
  pen(-1, 4, 'T'); pen(0, 3, 'T'); pen(1, 11, 'T'); pen(8, 12, 'T');
  // the broad gold collar (usekh): a wide arc over the shoulders and chest with a crimson bead row and drops
  const collar = sub(and(ell(cx + 5, top + 7, 20, 13), box(0, 0, CW, top + 17)), ell(cx + 6, top - 4, 11, 8));
  shade(F, collar, R_GOLD, { bias: 0.1 });
  for (let k = 0; k <= 12; k++) { const a = Math.PI * (0.08 + 0.84 * (k / 12)); pen(5 + Math.cos(a) * 17, 8 + Math.sin(a) * 9.2, k % 2 ? 'S' : 'C'); }
  for (let k = 0; k <= 12; k++) { const a = Math.PI * (0.08 + 0.84 * (k / 12)); pen(5 + Math.cos(a) * 12, 6 + Math.sin(a) * 6.5, k % 2 ? 'k' : 'X'); }
  // a crimson baldric from the near shoulder to the far hip, gold studs
  const bx0 = cx + 14, by0 = top + 3, bx1 = cx - 12, by1 = top + 31;
  const bm = fill((x, y) => { const dx = bx1 - bx0, dy = by1 - by0, L2 = dx * dx + dy * dy; const t = ((x - bx0) * dx + (y - by0) * dy) / L2; if (t < 0 || t > 1) return false; return Math.hypot(x - (bx0 + dx * t), y - (by0 + dy * t)) <= 3.1; });
  shade(F, and(bm, torso), R_CRIM, { bias: -0.1 });
  for (let k = 2; k <= 6; k++) { const t = k / 7; px(F, bx0 + (bx1 - bx0) * t, by0 + (by1 - by0) * t, 'X'); }
  return { cx, top, torso };
}

function drawKilt(F, o, cx, top) {
  const by = top + 28;
  // a wrapped linen skirt in stiff pleated panels, a gold-trimmed hem, crimson sash with a sun buckle
  const strips = [[-15, 9, 9], [-9, 8, 12], [-3, 8, 8], [4, 8, 13], [10, 7, 9]];
  for (const [sx, w, hgt] of strips) {
    shade(F, box(cx + sx, by + 1, cx + sx + w, by + 1 + hgt), R_LINEN, { rim: false });
    line(F, cx + sx + 1, by + 2, cx + sx + 1, by + hgt - 1, 'N');
    for (let k = 0; k < w; k += 2) px(F, cx + sx + k, by + hgt, k % 4 === 0 ? 'l' : 'Z');
    px(F, cx + sx + 4, by + 4, 'n'); px(F, cx + sx + 5, by + 7, 'n');
  }
  shade(F, box(cx - 18, by - 5, cx + 17, by + 2), R_CRIM, { bias: 0.1 });
  for (let x = cx - 16; x < cx + 16; x += 4) px(F, x, by - 3, 'X');
  const buckle = ell(cx + 1, by - 1.5, 5.4, 5.2);
  shade(F, buckle, R_GOLD);
  stampIn(F, buckle, ['..S..', '.SSS.', 'SSySS', '.SSS.', '..S..'], Math.round(cx - 1), Math.round(by - 4));
}

function drawBrazier(F, x, y, fl, big = true) {
  // an iron bowl on the shoulder with flames licking up (orange fabric-fire pixels, part of the sprite)
  const bowl = ell(x, y, big ? 6 : 4.5, 3);
  shade(F, bowl, ['I', 'I', 'J', 'J', 'J'], { rim: false });
  const hs = [[-4, 9], [-1, 13], [2, 10], [5, 7]].map(([dx, h], i) => [dx, h + ((fl + i) % 3) * 2 - 2]);
  for (const [dx, h] of hs) {
    const w = 2.6;
    shade(F, poly([[x + dx - w, y - 1], [x + dx + w, y - 1], [x + dx + (fl % 2 ? 0.8 : -0.8), y - 1 - h]]), ['f', 'f', 'F', 'F', 'y'], { bias: 0.3, rim: false });
  }
  px(F, x - 1, y - 3, 'y'); px(F, x + 2, y - 4, 'y');
}
function drawPauldron(F, S, fl) {
  const [sx0, sy0] = S, sx = sx0 - 2, sy = sy0 - 4;
  // linen under-collar, a gold shoulder-plate with a crimson cabochon, and the brazier riding on top
  shade(F, ell(sx + 1, sy + 4, 9.5, 4), R_LINEN);
  const plate = and(ell(sx, sy + 3, 10, 7.5), box(0, 0, CW, sy + 7));
  shade(F, plate, R_GOLD);
  line(F, sx - 8, sy + 5, sx + 8, sy + 5, 'k');
  for (const [ox, oy] of [[-5, 0], [5, 1]]) px(F, sx + ox, sy + oy, 'X');
  shade(F, ell(sx, sy + 1, 2.4, 2.2), R_CRIM, { bias: 0.2 });
  drawBrazier(F, sx - 1, sy - 3, fl, true);
}

function drawFist(F, H, far, wrap = true) {
  const [x, y] = H;
  shade(F, ell(x, y, 6, 5.2), far ? R_FARS : R_SKIN);
  for (const k of [-3, -1, 1, 3]) px(F, x + 1 + k * 0.6, y + 2 + (k & 1), far ? 'd' : 'o');
  if (wrap) { shade(F, box(x - 5, y - 5.5, x - 1, y + 4), far ? ['n', 'n', 'n', 'N', 'N'] : R_LINEN); }
}

function drawArm(F, S, H, far, bracer = false) {
  const { E, H: Hh } = arm(S, H);
  const R = far ? R_FARS : R_SKIN;
  shade(F, cap(S[0], S[1], 7.2, E[0], E[1], 5.8), R);
  shade(F, cap(E[0], E[1], 5.8, Hh[0], Hh[1], 4.6), R);
  // linen wound round the forearm, a loose strip trailing from the elbow
  const mx = (E[0] + Hh[0]) / 2, my = (E[1] + Hh[1]) / 2;
  line(F, E[0] - 3, E[1] + 1, E[0] + 3, E[1] - 2, far ? 'n' : 'N');
  line(F, mx - 3, my + 2, mx + 3, my - 2, far ? 'n' : 'm');
  line(F, E[0], E[1] + 5, E[0] - 2, E[1] + 11, far ? 'N' : 'M'); line(F, E[0] + 1, E[1] + 5, E[0] - 1, E[1] + 10, far ? 'n' : 'N');
  if (bracer) {
    const bx = Hh[0] + (E[0] - Hh[0]) * 0.32, by = Hh[1] + (E[1] - Hh[1]) * 0.32;
    const bm = and(cap(bx, by, 5.4, Hh[0] + (E[0] - Hh[0]) * 0.55, Hh[1] + (E[1] - Hh[1]) * 0.55, 5.6), cap(E[0], E[1], 7, Hh[0], Hh[1], 6));
    shade(F, bm, far ? ['k', 'k', 'k', 'z', 'Z'] : R_GOLD);
    px(F, bx, by, far ? 'z' : 'X');
  }
  return Hh;
}

function build(o) {
  const { lean = 0, bob = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, head = 'norm', ang = -70, hand = [84, 62], far = [82, 70], club = true, twoHand = false, fl = 0, flare = 0 } = o;
  const F = new Array(CW * CH).fill(null);
  const S = [52 + lean, 50 + bob], S2 = [40 + lean, 50 + bob];
  const hh = (p) => [p[0], p[1]];
  // the sun disc first, centred behind the head and shoulders
  drawDisc(F, 61 + lean * 0.5 + hx * 0.3, 38 + bob + hy * 0.3, 22, flare);
  const farH = drawArm(F, S2, hh(far), true, true);
  drawFist(F, farH, true, false);
  drawBrazier(F, S2[0] - 3, S2[1] - 8, fl + 1, false);
  drawLeg(F, 46, lb, lbl, true);
  drawLeg(F, 62, lf, lfl, false);
  const { cx, top } = drawTorso(F, { lean, bob });
  drawKilt(F, { bob }, cx, top);
  const handP = hh(hand);
  if (club) drawClub(F, handP, ang);
  const nh = drawArm(F, S, handP, false, true);
  drawPauldron(F, S, fl);
  drawHead(F, [68 + lean + hx, 33 + bob + hy], head);
  drawFist(F, nh, false, true);
  if (club && twoHand) { const fh = hh(far); drawFist(F, fh, true, false); }
  return F;
}

const frames = {};
let nPose = 0;
function pose(name, o = {}) {
  const fl = nPose++ % 3;
  frames[name] = [(put) => { const F = build({ fl, ...o }); for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const c = F[idx(x, y)]; if (c) put(x + SHIFT, y, c); } }];
}

// walk: heavy stride, the sceptre resting up on the shoulder
const rest = { ang: -62, hand: [84, 64], far: [80, 72] };
pose('bare', { club: false, hand: [82, 66], far: [80, 72] });
pose('walk0', { ...rest, bob: 1, lf: 6, lb: -6, lbl: 3, lfl: 0 });
pose('walk1', { ...rest, bob: 0, lf: 0, lb: 0 });
pose('walk2', { ...rest, bob: 1, lf: -6, lb: 6, lfl: 3, lbl: 0 });
pose('walk3', { ...rest, bob: 0, lf: 0, lb: 0 });
pose('idle0', { ...rest, bob: 0 });
pose('idle1', { ...rest, bob: 1, hy: 0 });
pose('windup0', { ang: -140, hand: [72, 34], far: [60, 36], lean: -2, bob: 1, hx: -1, head: 'roar', lf: -2, lb: 2 });
pose('windup1', { ang: -165, hand: [58, 28], far: [52, 34], lean: -4, bob: 1, hx: -2, hy: 1, head: 'roar', lf: -3, lb: 3, flare: 3 });
pose('strike0', { ang: -15, hand: [92, 48], far: [86, 56], lean: 4, bob: 1, hx: 1, head: 'roar', lf: 4, lb: -4 });
pose('strike1', { ang: 55, hand: [92, 70], far: [88, 72], lean: 5, bob: 3, hx: 2, hy: 1, lf: 3, lb: -3 });
pose('hurt0', { ang: -35, hand: [84, 52], far: [76, 64], lean: -3, bob: 1, hx: -2, hy: 1, head: 'hurt', lf: -1, lb: 1 });
pose('paw0', { ang: 150, hand: [76, 66], far: [60, 74], lean: -3, bob: 2, hx: -1, hy: 2, head: 'roar', lf: -2, lb: 2, lfl: 5 });
pose('paw1', { ang: 160, hand: [74, 66], far: [58, 72], lean: -4, bob: 1, hx: -2, hy: 1, head: 'roar', lf: 0, lb: 2, lfl: 0 });
pose('charge0', { ang: 168, hand: [72, 62], far: [54, 64], lean: 6, bob: 2, hx: 2, hy: 5, head: 'down', lf: 6, lb: -6, lbl: 4 });
pose('charge1', { ang: 172, hand: [72, 62], far: [54, 62], lean: 6, bob: 1, hx: 2, hy: 5, head: 'down', lf: -6, lb: 6, lfl: 4 });
pose('dazed0', { ang: 50, hand: [86, 74], far: [74, 78], lean: 2, bob: 3, hx: 1, hy: 7, head: 'down', lf: 1, lb: -1 });
pose('dazed1', { ang: 55, hand: [86, 74], far: [74, 78], lean: -1, bob: 3, hx: 0, hy: 7, head: 'down', lf: -1, lb: 1 });
pose('slam0', { ang: -150, hand: [60, 32], far: [56, 34], twoHand: true, lean: -1, bob: 0, hy: -2, head: 'roar', lf: -3, lb: 3 });
pose('slam1', { ang: -160, hand: [58, 22], far: [54, 26], twoHand: true, lean: -3, bob: -1, hy: -3, head: 'roar', lf: -4, lb: 4, flare: 4 });
pose('roar0', { ang: -55, hand: [88, 38], far: [38, 44], lean: -2, bob: 1, hx: -2, hy: -2, head: 'roar', lf: -2, lb: 2, flare: 2 });
pose('roar1', { ang: -60, hand: [90, 34], far: [36, 38], lean: -3, bob: 0, hx: -2, hy: -3, head: 'roar', lf: -3, lb: 3, flare: 5 });
pose('smash0', { ang: -145, hand: [64, 44], far: [56, 54], lean: -4, bob: 2, hx: -2, hy: 1, lf: -3, lb: 3 });
pose('smash1', { ang: -170, hand: [56, 46], far: [50, 56], lean: -5, bob: 2, hx: -3, hy: 1, lf: -4, lb: 4 });

// the dropped sceptre for the corpse (a lying flail, drawn as plain pixels)
function lyingClub() {
  const G2 = new Array(CW * CH).fill(null);
  drawClub(G2, [10, 30], 0);
  let x0 = CW, x1 = -1, y0 = CH, y1 = -1;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (G2[idx(x, y)]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = [];
  for (let y = y0; y <= y1; y++) { let r = ''; for (let x = x0; x <= x1; x++) r += G2[idx(x, y)] ?? '.'; out.push(r); }
  return { rows: out, ax: 0, ay: 0 };
}
const clubLying = lyingClub();

export default {
  name: 'suntyrant', title: 'Sun Tyrant (boss)', notes: 'The Scorched Dunes boss at native ~74px: mummified god-king, gold sunburst headdress, painted sun disc behind, gold sceptre-flail baked in. Extra poses: slam, roar, smash.',
  cell: [CW, CH], shadow: [60, 10], pivot: [60, SOLE], palette, post,
  parts: { clubLying }, frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['clubLying', 62, 78]] } },
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
