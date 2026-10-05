// RIME KING — the Frozen Pass boss, a colossal frost-giant chieftain at ~74px: shaggy blue-grey fur (dark enough to read on snow), a
// scarred hunched chest, a mane, a crown of ice shards over ram-like horns and tusks, a necklace of fangs, a glacier-ice pauldron and
// bracer, a fur skirt, fur-cuffed boots, and a great maul with a head of blue glacier ice rimmed in icicles.
// Built like the Orc Warlord (art/chars/boss.mjs): every frame is composed from lit volumes plus hand-stamped detail pixels, then the
// builder inks the silhouette. Poses: walk, idle, windup, strike, hurt, the charge set (paw / charge / dazed), and the boss's own
// moves (slam, roar, smash).
import { GLASS as G } from '../palette.mjs';

const palette = {
  l: G.lead, e: G.lead, ...G,
  d: '#1c2440', o: '#2e3a66', O: '#475a90', t: '#6e84b6', T: '#a0b8e0',   // fur: d o O t T (deep to lit)
  k: '#1b3a68', z: '#2f6aa8', Z: '#5aaae6', X: '#b4e8ff',                  // glacier ice: k z Z X
  u: '#8c7c5e',                                                            // bone shade (w W above)
  p: '#34201a', P: '#573621', h: '#82552f', H: '#a8763f',                  // leather / wood
  i: '#d8f4ff',                                                            // rime frost on the maul
  Y: '#7af0ff',                                                            // the eyes
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

// ramps: index 0 darkest .. 4 brightest
const R_HIDE = ['d', 'o', 'O', 't', 'T'];
const R_FAR = ['d', 'd', 'o', 'O', 't'];          // the far-side limbs sit in shadow
const R_STEEL = ['k', 'z', 'Z', 'X', 'X'];
const R_LEATHER = ['p', 'P', 'h', 'H', 'H'];
const R_BONE = ['u', 'u', 'w', 'W', 'W'];
const R_CLOTH = ['p', 'P', 'h', 'H', 'H'];                // a fur skirt: dirty umber
const R_GOLD = ['k', 'z', 'Z', 'X', 'X'];                 // ice trim, not gold

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

// ---------- head ----------
function drawHead(F, hc, kind) {
  const [hx, hy] = hc;
  const roar = kind === 'roar', hurt = kind === 'hurt', down = kind === 'down';
  const jawDrop = roar ? 4 : 0;
  // horns first (behind the helm): two long curved bone horns, banded in iron at the root
  const horn = (sgn) => {
    const p0 = [hx + sgn * 8, hy - 6], p1 = [hx + sgn * 14, hy - 11], p2 = [hx + sgn * 17, hy - 18], p3 = [hx + sgn * 16, hy - 23];
    const m = or(cap(p0[0], p0[1], 3, p1[0], p1[1], 2.4), cap(p1[0], p1[1], 2.4, p2[0], p2[1], 1.7), cap(p2[0], p2[1], 1.7, p3[0], p3[1], 0.4));
    shade(F, m, R_BONE, { bias: sgn < 0 ? 0.15 : -0.1 });
    // growth rings
    for (const [t, w] of [[0.38, 2], [0.62, 1.6]]) { const X = p1[0] + (p2[0] - p1[0]) * t, Y = p1[1] + (p2[1] - p1[1]) * t; px(F, X - sgn * w * 0.4, Y, 'u'); px(F, X + sgn * w * 0.4, Y, 'u'); }
  };
  if (!down) { horn(-1); horn(1); }
  else {
    // head lowered: the horns level forward like a bull
    const hornF = (sgn) => {
      const m = or(cap(hx + sgn * 7, hy - 4, 3, hx + sgn * 12 + 3, hy - 8, 2.3), cap(hx + sgn * 12 + 3, hy - 8, 2.3, hx + sgn * 19 + 5, hy - 12, 0.5));
      shade(F, m, R_BONE);
    };
    hornF(-1); hornF(1);
  }
  // mane: a shaggy ruff behind the head and down the neck, ragged at the edge
  {
    const mane = or(ell(hx - 3, hy + 5, 15, 13), ell(hx - 8, hy + 12, 11, 9));
    shade(F, mane, ['d', 'o', 'O', 'o', 't'], { rim: false });
    for (let k = 0; k < 16; k++) {
      const ang = Math.PI * (0.55 + k * 0.095), r0 = 14 + (k % 3) * 1.5;
      line(F, hx - 3 + Math.cos(ang) * r0, hy + 5 + Math.sin(ang) * r0 * 0.95, hx - 3 + Math.cos(ang) * (r0 + 3), hy + 5 + Math.sin(ang) * (r0 + 3) * 0.95, k % 2 ? 'O' : 'o');
    }
  }
  // skull + jaw
  const skull = ell(hx, hy + 2, 10.5, 9.5);
  const snout = ell(hx + 6.5, hy + 6 + jawDrop * 0.2, 8.5, 5);
  const jaw = or(ell(hx + 4, hy + 9.5 + jawDrop, 9, 4.2), box(hx - 4, hy + 6, hx + 9, hy + 9 + jawDrop));
  if (roar) {
    // open mouth: dark throat between the upper face and the dropped jaw
    shade(F, jaw, R_HIDE, { bias: -0.2 });
    shade(F, or(skull, snout), R_HIDE);
    const mouth = and(poly([[hx + 1, hy + 8], [hx + 13, hy + 8], [hx + 13, hy + 9 + jawDrop], [hx + 1, hy + 9 + jawDrop]]), jaw);
    paint(F, mouth, 'r'); paint(F, and(mouth, box(hx + 3, hy + 10 + jawDrop - 2, hx + 11, hy + 12 + jawDrop)), 'R');
    for (let k = 0; k < 4; k++) { px(F, hx + 3 + k * 2.4, hy + 8, 'W'); px(F, hx + 3 + k * 2.4, hy + 9 + jawDrop, 'W'); }
  } else {
    shade(F, jaw, R_HIDE, { bias: -0.25 });
    shade(F, or(skull, snout), R_HIDE);
  }
  // heavy brow ridge, cut by the helm band
  line(F, hx + 1, hy - 1, hx + 11, hy + 1, 'o');
  line(F, hx + 1, hy, hx + 11, hy + 2, 'd');
  // eye: a small mean glint under the brow
  if (hurt) { px(F, hx + 5, hy + 3, 'd'); px(F, hx + 6, hy + 3, 'd'); px(F, hx + 7, hy + 3, 'd'); px(F, hx + 6, hy + 4, 'R'); }
  else { px(F, hx + 5, hy + 3, 'Y'); px(F, hx + 6, hy + 3, 'Y'); px(F, hx + 6, hy + 4, roar ? 'R' : 'e'); px(F, hx + 4, hy + 3, 'd'); px(F, hx + 7, hy + 3, 'd'); px(F, hx + 5, hy + 2, 'd'); px(F, hx + 6, hy + 2, 'd'); }
  // flat broad nose
  shade(F, ell(hx + 12, hy + 5, 3, 2.4), R_HIDE, { bias: 0.1 });
  px(F, hx + 13, hy + 6, 'd'); px(F, hx + 11, hy + 6, 'd');
  // cheek: war paint stripes and an old scar
  line(F, hx + 1, hy + 5, hx + 4, hy + 8, 'X');
  line(F, hx - 1, hy + 3, hx + 1, hy + 9, 'T'); px(F, hx, hy + 5, 'd'); px(F, hx, hy + 7, 'd');
  // mouth line + lower tusks jutting up past the lip
  if (!roar) {
    line(F, hx + 3, hy + 9, hx + 12, hy + 8, 'd');
    for (let k = 0; k < 4; k++) px(F, hx + 4 + k * 2, hy + 10, 'W');
  }
  const tusk = (bx, by, tx, ty, r0) => shade(F, cap(bx, by, r0, tx, ty, 0.4), R_BONE);
  tusk(hx + 7.5, hy + 10 + jawDrop, hx + 9.5, hy + 3.5, 1.9);
  tusk(hx + 12, hy + 10.2 + jawDrop, hx + 14.5, hy + 5, 1.8);
  // stubbly chin tuft + the lower jaw's shadow
  px(F, hx + 7, hy + 14 + jawDrop, 'd'); px(F, hx + 9, hy + 14 + jawDrop, 'd'); px(F, hx + 11, hy + 13 + jawDrop, 'd');
  // the crown: a band of fur and a ring of jagged ice shards of different heights, with a lit facet on each
  const band = and(ell(hx, hy - 2, 11.4, 4.2), box(hx - 12, hy - 5, hx + 12, hy + 1));
  shade(F, band, ['o', 'O', 't', 'T', 'T'], { bias: 0.1 });
  for (const [dx, h, w] of [[-9, 8, 2.6], [-5, 13, 2.8], [-1, 17, 3], [3, 14, 2.8], [7, 10, 2.6], [10, 6, 2.2]]) {
    shade(F, poly([[hx + dx - w, hy - 3], [hx + dx + w, hy - 3], [hx + dx + 0.5, hy - 3 - h]]), R_STEEL, { bias: 0.2 });
    px(F, hx + dx - 1, hy - 5 - h * 0.35, 'X');
  }
  for (let k = -9; k <= 9; k += 3) px(F, hx + k, hy - 1, 'X');
  // a beard of frost down the chin
  px(F, hx + 6, hy + 14, 'X'); px(F, hx + 8, hy + 15, 'X'); px(F, hx + 10, hy + 14, 'X');
}

// ---------- body ----------
function drawLeg(F, hipx, foot, lift, far) {
  const L = lift;
  const hipy = 78, kneeX = hipx + foot * 0.4 + 2, kneeY = 85 - L * 0.4, ankX = hipx + foot, ankY = SOLE - 6 - L;
  const thigh = cap(hipx, hipy, 7, kneeX, kneeY, 6);
  shade(F, thigh, far ? R_FAR : R_HIDE);
  // greave-like boot: leather up to the knee, fur cuff, steel toe cap
  const shin = cap(kneeX, kneeY, 5.8, ankX, ankY, 5);
  shade(F, shin, far ? ['p', 'p', 'p', 'P', 'h'] : R_LEATHER);
  const foot_ = or(box(ankX - 5, ankY - 1, ankX + 7, SOLE - L + 1), ell(ankX + 5, SOLE - L - 2, 4.5, 3.4));
  shade(F, foot_, far ? ['p', 'p', 'p', 'P', 'h'] : R_LEATHER);
  line(F, ankX - 4, SOLE - L, ankX + 6, SOLE - L, 'p');                    // sole
  const cuff = ell(kneeX + 0.3 + (ankX - kneeX) * 0.6, ankY - 3.2, 6.8, 3.2);
  shade(F, cuff, far ? ['u', 'u', 'u', 'w', 'w'] : R_BONE);
  for (let k = -5; k <= 5; k += 2) px(F, ankX + k + (kneeX - ankX) * 0.2, ankY - 0.2 + (k % 4 === 0 ? 0 : 1), far ? 'u' : 'w'); // ragged fur
  // thigh muscle line / scar
  if (!far) { line(F, hipx - 2, hipy + 2, hipx, hipy + 7, 'o'); px(F, hipx + 3, hipy + 4, 'o'); }
}

function drawTorso(F, o) {
  const { lean, bob } = o;
  const cx = 56 + lean, top = 44 + bob;
  // hump (the hunched back and trapezius) + chest + belly make one big lit mass
  const back = ell(cx - 12, top + 5, 11, 9);
  const chest = ell(cx + 3, top + 13, 21, 16);
  const belly = ell(cx, top + 25, 17, 9);
  const neck = ell(cx + 9, top - 1, 8, 6);
  const torso = or(back, chest, belly, neck);
  shade(F, torso, R_HIDE);
  const T = (x, y) => [cx + x, top + y];
  // pecs, solar plexus, abs, ribs and the old wounds
  const pen = (x, y, c) => px(F, cx + x, top + y, c);
  const ln = (a, b, c) => line(F, cx + a[0], top + a[1], cx + b[0], top + b[1], c);
  ln([4, 15], [16, 17], 'o'); ln([3, 9], [4, 15], 'o'); ln([16, 17], [18, 12], 'o');    // lower pec
  ln([-9, 14], [-2, 17], 'o');                                                          // far pec shadow
  ln([2, 18], [2, 27], 'o');                                                            // centre line
  for (const y of [21, 24, 27]) { ln([-2, y], [6, y + 0.5], 'o'); }                      // abs
  for (const [x, y] of [[8, 21], [9, 24], [8, 27]]) pen(x, y, 'd');
  ln([-13, 9], [-9, 12], 'o'); ln([-14, 13], [-10, 15], 'o'); ln([-14, 17], [-11, 18], 'o'); // ribs on the flank
  // scars: a long diagonal slash across the chest and a smaller gouge
  ln([-4, 5], [10, 19], 'T'); ln([-3, 5], [11, 20], 'o'); pen(0, 9, 'T'); pen(4, 13, 'T'); pen(7, 16, 'T');
  ln([12, 4], [14, 8], 'T'); pen(13, 6, 'o');
  // highlights on the lit shoulder / pec
  pen(-1, 4, 'T'); pen(0, 3, 'T'); pen(1, 11, 'T'); pen(2, 11, 'T'); pen(8, 12, 'T');
  // bone-and-tooth necklace round the neck
  for (let k = 0; k <= 10; k++) {
    const x = 1 + k * 1.5, y = 5 + Math.sin((k / 10) * Math.PI) * 5 + 0 * k;
    px(F, cx + x, top + y, k % 3 === 0 ? 'W' : 'u');
    if (k % 3 === 0) { px(F, cx + x, top + y + 1, 'w'); px(F, cx + x, top + y + 2, 'W'); }
  }
  // studded baldric from the near shoulder to the far hip
  const bald = [];
  const bx0 = cx + 14, by0 = top + 3, bx1 = cx - 12, by1 = top + 31;
  const bm = fill((x, y) => { const dx = bx1 - bx0, dy = by1 - by0, L2 = dx * dx + dy * dy; const t = ((x - bx0) * dx + (y - by0) * dy) / L2; if (t < 0 || t > 1) return false; return Math.hypot(x - (bx0 + dx * t), y - (by0 + dy * t)) <= 3.1; });
  shade(F, and(bm, torso), R_LEATHER, { bias: -0.1 });
  for (let k = 1; k <= 5; k++) { const t = k / 6; px(F, bx0 + (bx1 - bx0) * t, by0 + (by1 - by0) * t, 'X'); }
  return { cx, top, torso };
}

function drawKilt(F, o, cx, top) {
  const { bob } = o;
  const by = top + 28;
  // a ragged fur skirt in strips, an ice-crystal buckle
  const strips = [[-15, 9, 9], [-9, 8, 12], [-3, 8, 8], [4, 8, 13], [10, 7, 9]];
  for (const [sx, w, hgt] of strips) {
    const m = box(cx + sx, by + 1, cx + sx + w, by + 1 + hgt);
    shade(F, m, R_CLOTH, { rim: false });
    for (let k = 0; k < w; k += 2) px(F, cx + sx + k, by + hgt, k % 4 === 0 ? 'l' : 'p');   // jagged hem
    px(F, cx + sx + 2, by + hgt - 3, 'p'); px(F, cx + sx + w - 3, by + hgt - 5, 'p');
  }
  // belt
  const belt = box(cx - 18, by - 5, cx + 17, by + 2);
  shade(F, belt, R_LEATHER, { bias: 0.1 });
  for (let x = cx - 16; x < cx + 16; x += 4) px(F, x, by - 3, 'Z');
  const buckle = ell(cx + 1, by - 1.5, 5.2, 5);
  shade(F, buckle, R_GOLD);
  // skull on the buckle
  stampIn(F, buckle, ['.WWW.', 'WeWeW', 'WWWWW', '.WeW.', '.W.W.'], Math.round(cx - 1), Math.round(by - 4));
}

function drawPauldron(F, S) {
  const [sx0, sy0] = S, sx = sx0 - 2, sy = sy0 - 4;
  // a slab of riveted iron riding the shoulder, three spikes raking up and back, a stained fur collar under it
  const fur = ell(sx + 1, sy + 4, 9.5, 4);
  shade(F, fur, ['u', 'u', 'w', 'W', 'W']);
  for (let k = -8; k <= 8; k += 2) px(F, sx + 1 + k, sy + 7 + (k % 4 === 0 ? 0 : 1), 'w');
  for (const [ox, oy, tx, ty] of [[-6, -1, -11, -9], [-1, -3, -4, -12], [4, -3, 3, -11]]) {
    shade(F, poly([[sx + ox - 2, sy + oy + 3], [sx + ox + 3, sy + oy + 3], [sx + tx, sy + ty]]), R_STEEL, { bias: 0.1 });
  }
  const plate = and(ell(sx, sy + 3, 10, 7.5), box(0, 0, CW, sy + 7));
  shade(F, plate, R_STEEL);
  line(F, sx - 8, sy + 5, sx + 8, sy + 5, 'k');
  for (const [ox, oy] of [[-5, 0], [0, -1], [5, 1], [-2, 3]]) px(F, sx + ox, sy + oy, 'X');
  px(F, sx + 3, sy + 1, 'i'); px(F, sx + 4, sy + 2, 'i');
}

function drawFist(F, H, far, wrap = true) {
  const [x, y] = H;
  shade(F, ell(x, y, 6, 5.2), far ? R_FAR : R_HIDE);
  // knuckles + finger gaps
  for (const k of [-3, -1, 1, 3]) px(F, x + 1 + k * 0.6, y + 2 + (k & 1), far ? 'd' : 'o');
  if (wrap) { shade(F, box(x - 5, y - 5.5, x - 1, y + 4), far ? ['p', 'p', 'p', 'P', 'h'] : R_LEATHER); }
}

function drawArm(F, S, H, far, bracer = false) {
  const { E, H: Hh } = arm(S, H);
  const R = far ? R_FAR : R_HIDE;
  shade(F, cap(S[0], S[1], 7.2, E[0], E[1], 5.8), R);
  shade(F, cap(E[0], E[1], 5.8, Hh[0], Hh[1], 4.6), R);
  if (bracer) {
    // an iron bracer on the forearm, near the wrist
    const bx = Hh[0] + (E[0] - Hh[0]) * 0.32, by = Hh[1] + (E[1] - Hh[1]) * 0.32;
    const bm = and(cap(bx, by, 5.4, Hh[0] + (E[0] - Hh[0]) * 0.55, Hh[1] + (E[1] - Hh[1]) * 0.55, 5.6), cap(E[0], E[1], 7, Hh[0], Hh[1], 6));
    shade(F, bm, far ? ['k', 'k', 'k', 'z', 'Z'] : R_STEEL);
    px(F, bx, by, far ? 'z' : 'X');
  }
  // biceps and tendon
  if (!far) { px(F, (S[0] + E[0]) / 2 - 1, (S[1] + E[1]) / 2 - 2, 'T'); px(F, (S[0] + E[0]) / 2, (S[1] + E[1]) / 2 + 1, 'o'); }
  return Hh;
}

/** Fur: break up the smooth lit volumes with short darker and lighter strands, so the hide reads as shaggy. */
function furry(F) {
  const FUR = 'doOtT';
  const hsh = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  const out = F.slice();
  for (let y = 1; y < CH - 1; y++) for (let x = 1; x < CW - 1; x++) {
    const c = F[idx(x, y)];
    const k = c ? FUR.indexOf(c) : -1;
    if (k < 0) continue;
    const h = hsh(x, y);
    if (h % 9 === 0 && k > 0) out[idx(x, y + 1)] = F[idx(x, y + 1)] ? FUR[Math.max(0, FUR.indexOf(F[idx(x, y + 1)]) - 1)] ?? F[idx(x, y + 1)] : F[idx(x, y + 1)];   // a strand
    else if (h % 13 === 0 && k < 4) out[idx(x, y)] = FUR[k + 1];
    else if (h % 11 === 0 && k > 0) out[idx(x, y)] = FUR[k - 1];
  }
  return out;
}

function build(o) {
  const { lean = 0, bob = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, head = 'norm', ang = -70, hand = [84, 62], far = [82, 70], club = true, twoHand = false } = o;
  const F = new Array(CW * CH).fill(null);
  const S = [52 + lean, 50 + bob], S2 = [40 + lean, 50 + bob];
  const hh = (p) => [p[0] + lean * 0, p[1] + bob * 0];
  // far arm behind the torso, far leg behind the near leg
  const farH = drawArm(F, S2, hh(far), true);
  drawFist(F, farH, true, false);
  drawLeg(F, 46, lb, lbl, true);
  drawLeg(F, 62, lf, lfl, false);
  const { cx, top } = drawTorso(F, { lean, bob });
  drawKilt(F, { bob }, cx, top);
    // club arm: club first, then the arm and the fist over the grip
  const handP = hh(hand);
  if (club) drawClub(F, handP, ang);
  const nh = drawArm(F, S, handP, false);
  drawPauldron(F, S);
  drawHead(F, [68 + lean + hx, 33 + bob + hy], head);
  drawFist(F, nh, false, true);
  if (club && twoHand) { const fh = hh(far); drawFist(F, fh, true, false); }
  return furry(F);
}

const frames = {};
function pose(name, o = {}) {
  frames[name] = [(put) => { const F = build(o); for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const c = F[idx(x, y)]; if (c) put(x + SHIFT, y, c); } }];
}

// walk: heavy lurching stride, the club resting up on the shoulder
const rest = { ang: -62, hand: [84, 64], far: [80, 72] };
pose('bare', { noclub: true, club: false, hand: [82, 66], far: [80, 72] });
pose('walk0', { ...rest, bob: 1, lf: 6, lb: -6, lbl: 3, lfl: 0 });
pose('walk1', { ...rest, bob: 0, lf: 0, lb: 0 });
pose('walk2', { ...rest, bob: 1, lf: -6, lb: 6, lfl: 3, lbl: 0 });
pose('walk3', { ...rest, bob: 0, lf: 0, lb: 0 });
pose('idle0', { ...rest, bob: 0 });
pose('idle1', { ...rest, bob: 1, hy: 0 });
// windup: the club hauled back over the shoulder, then right back, head thrown back to roar
pose('windup0', { ang: -140, hand: [72, 34], far: [60, 36], lean: -2, bob: 1, hx: -1, head: 'roar', lf: -2, lb: 2 });
pose('windup1', { ang: -165, hand: [58, 28], far: [52, 34], lean: -4, bob: 1, hx: -2, hy: 1, head: 'roar', lf: -3, lb: 3 });
pose('strike0', { ang: -15, hand: [92, 48], far: [86, 56], lean: 4, bob: 1, hx: 1, head: 'roar', lf: 4, lb: -4 });
pose('strike1', { ang: 55, hand: [92, 70], far: [88, 72], lean: 5, bob: 3, hx: 2, hy: 1, lf: 3, lb: -3 });
pose('hurt0', { ang: -35, hand: [84, 52], far: [76, 64], lean: -3, bob: 1, hx: -2, hy: 1, head: 'hurt', lf: -1, lb: 1 });
// charge: stomp and rock back (paw), head-down gallop (charge), then slumped (dazed)
pose('paw0', { ang: 150, hand: [76, 66], far: [60, 74], lean: -3, bob: 2, hx: -1, hy: 2, head: 'roar', lf: -2, lb: 2, lfl: 5 });
pose('paw1', { ang: 160, hand: [74, 66], far: [58, 72], lean: -4, bob: 1, hx: -2, hy: 1, head: 'roar', lf: 0, lb: 2, lfl: 0 });
pose('charge0', { ang: 168, hand: [72, 62], far: [54, 64], lean: 6, bob: 2, hx: 2, hy: 5, head: 'down', lf: 6, lb: -6, lbl: 4 });
pose('charge1', { ang: 172, hand: [72, 62], far: [54, 62], lean: 6, bob: 1, hx: 2, hy: 5, head: 'down', lf: -6, lb: 6, lfl: 4 });
pose('dazed0', { ang: 50, hand: [86, 74], far: [74, 78], lean: 2, bob: 3, hx: 1, hy: 7, head: 'down', lf: 1, lb: -1 });
pose('dazed1', { ang: 55, hand: [86, 74], far: [74, 78], lean: -1, bob: 3, hx: 0, hy: 7, head: 'down', lf: -1, lb: 1 });
// boss moves: slam (club raised high in both fists, then driven down), roar (arms wide), smash (club cocked back low)
pose('slam0', { ang: -150, hand: [60, 32], far: [56, 34], twoHand: true, lean: -1, bob: 0, hy: -2, head: 'roar', lf: -3, lb: 3 });
pose('slam1', { ang: -160, hand: [58, 22], far: [54, 26], twoHand: true, lean: -3, bob: -1, hy: -3, head: 'roar', lf: -4, lb: 4 });
pose('roar0', { ang: -55, hand: [88, 38], far: [38, 44], lean: -2, bob: 1, hx: -2, hy: -2, head: 'roar', lf: -2, lb: 2 });
pose('roar1', { ang: -60, hand: [90, 34], far: [36, 38], lean: -3, bob: 0, hx: -2, hy: -3, head: 'roar', lf: -3, lb: 3 });
pose('smash0', { ang: -145, hand: [64, 44], far: [56, 54], lean: -4, bob: 2, hx: -2, hy: 1, lf: -3, lb: 3 });
pose('smash1', { ang: -170, hand: [56, 46], far: [50, 56], lean: -5, bob: 2, hx: -3, hy: 1, lf: -4, lb: 4 });

// the dropped club for the corpse (a lying maul, drawn as plain pixels)
function lyingClub() {
  const W = 56, H = 22, F = new Array(W * H).fill(null);
  const a = 0, saved = null;
  const rows = [];
  for (let y = 0; y < H; y++) { rows.push(''); }
  // reuse the screen-space club painter on a scratch cell, then crop
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
  name: 'rimeking', title: 'Rime King (boss)', notes: 'The Frozen Pass boss at native ~74px: shaggy frost-giant chieftain, ice crown, glacier maul baked in. Extra poses: slam, roar, smash.',
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
