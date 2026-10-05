// DREAD REGENT — the Haunted Keep boss, a colossal undead king at ~74px: a gaunt skeleton gone grey-yellow with age, a ribcage showing
// through a rotted breastplate of blackened iron, a tattered royal-purple cape and tabard, a tarnished gilt crown of tall spikes,
// empty sockets with a cold green glint, bone fingers, a spiked iron pauldron, iron sabatons and a great rusted greatsword.
// Built like the Orc Warlord (art/chars/boss.mjs): every frame is composed from lit volumes plus hand-stamped detail pixels, then the
// builder inks the silhouette. Poses: walk, idle, windup, strike, hurt, the charge set (paw / charge / dazed), and the boss's own
// moves (slam, roar, smash), which its repertoire's specials borrow for their windups.
import { GLASS as G } from '../palette.mjs';

const palette = {
  l: G.lead, e: G.lead, ...G,
  d: '#15101f', u: '#8c7c5e',                                  // the void between the bones, and bone shade (w W above)
  k: '#1c1826', z: '#352f42', Z: '#5c5470', X: '#908aa6',      // blackened iron: k z Z X
  v: '#3b1f58', V: '#6e3fa0', q: '#9a64d8',                    // royal purple: v V q
  p: '#34201a', P: '#573621', h: '#82552f', H: '#a8763f',      // leather
  i: '#7a3a22',                                                // rust
  E: '#6bff9a',                                                // the cold green glint of the eyes
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
const R_BONE = ['u', 'u', 'w', 'W', 'W'];
const R_FARB = ['d', 'u', 'u', 'w', 'w'];          // the far-side limbs sit in shadow
const R_IRON = ['k', 'z', 'Z', 'X', 'X'];           // blackened, rusting iron
const R_LEATHER = ['p', 'P', 'h', 'H', 'H'];
const R_CLOTH = ['v', 'v', 'V', 'q', 'q'];          // a royal purple gone to tatters
const R_GOLD = ['g', 'g', 'G', 'Y', 'Y'];

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


// ---------- the greatsword (screen-space lit, so the light stays upper-left however it is swung) ----------
const SWORD_LEN = 54;
function drawSword(F, hand, angDeg) {
  const a = (angDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const L = SWORD_LEN;
  const Lt = [-0.6, -0.8];
  const prof = (u) => {
    if (u < -8 || u > L + 4) return -1;
    if (u < 0) return 1.7;                                   // the grip
    if (u > L) return Math.max(0, 4.4 * (1 - (u - L) / 4));  // the point
    return 4.8 - 1.5 * (u / L);                              // the blade, tapering
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
    const i = lit > 0.55 ? 3 : lit > 0.12 ? 2 : lit > -0.35 ? 1 : 0;
    let ch;
    if (u < 0) ch = R_LEATHER[i] + '';                                        // a wrapped grip
    else if (u < 2.6 && Math.abs(v) <= 9) ch = R_GOLD[i];                      // (the crossguard is stamped below)
    else {
      ch = R_IRON[i];
      if (u > 4 && u < L - 6 && Math.abs(v) < 0.9) ch = R_IRON[Math.max(0, i - 1)];  // the fuller
      if (u > 6 && (Math.floor(u) * 5 + Math.floor(v * 2) * 11) % 13 === 0) ch = 'i';  // rust
    }
    F[idx(x, y)] = ch;
  }
  // the crossguard: a wide gilt bar across the blade's root, and a pommel at the grip's end
  for (let y = Math.floor(hand[1] - 14); y <= Math.ceil(hand[1] + 14); y++) for (let x = Math.floor(hand[0] - 14); x <= Math.ceil(hand[0] + 14); x++) {
    if (!ok(x, y)) continue;
    const dx = x + 0.5 - hand[0], dy = y + 0.5 - hand[1];
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (u >= -0.4 && u < 2.8 && Math.abs(v) <= 9) F[idx(x, y)] = Math.abs(v) > 7.4 ? 'Y' : (v < 0 ? 'G' : 'g');
    if (Math.hypot(u + 7.5, v) <= 2.2) F[idx(x, y)] = v < 0 ? 'Y' : 'G';
  }
}

// ---------- head ----------
function drawHead(F, hc, kind) {
  const [hx, hy] = hc;
  const roar = kind === 'roar', hurt = kind === 'hurt';
  const jawDrop = roar ? 4 : 0;
  // a rotted cowl hanging behind the skull
  shade(F, or(ell(hx - 7, hy + 7, 9, 10), poly([[hx - 12, hy + 6], [hx - 2, hy + 4], [hx - 4, hy + 22], [hx - 13, hy + 18]])), R_CLOTH, { rim: false });
  // skull, cheek, and lower jaw
  const skull = or(ell(hx, hy + 1, 10.5, 9.5), ell(hx + 6, hy + 6, 7.5, 4.5));
  shade(F, skull, R_BONE);
  const jaw = or(ell(hx + 5, hy + 10.5 + jawDrop, 8.2, 3.6), box(hx - 2, hy + 7, hx + 8, hy + 9 + jawDrop));
  shade(F, jaw, R_BONE, { bias: -0.2 });
  if (roar) {
    const mouth = and(poly([[hx + 1, hy + 8], [hx + 12, hy + 8], [hx + 12, hy + 9 + jawDrop], [hx + 1, hy + 9 + jawDrop]]), or(jaw, skull));
    paint(F, mouth, 'd');
    for (let k = 0; k < 5; k++) { px(F, hx + 2 + k * 2, hy + 8, 'W'); px(F, hx + 2 + k * 2, hy + 9 + jawDrop, 'W'); }
  } else {
    line(F, hx + 2, hy + 9, hx + 12, hy + 8, 'd');
    for (let k = 0; k < 5; k++) px(F, hx + 3 + k * 2, hy + 9, k % 2 ? 'u' : 'W');
  }
  // hollow eye socket with a cold green glint, a nasal cavity, a crack across the brow
  paint(F, ell(hx + 6, hy + 2.5, 3.4, 3.2), 'd');
  if (!hurt) { px(F, hx + 6, hy + 3, 'E'); px(F, hx + 7, hy + 3, 'E'); } else { px(F, hx + 5, hy + 3, 'u'); px(F, hx + 7, hy + 3, 'u'); }
  paint(F, poly([[hx + 11, hy + 5], [hx + 14, hy + 8], [hx + 11, hy + 8]]), 'd');
  line(F, hx - 3, hy - 5, hx + 2, hy + 1, 'u'); px(F, hx + 3, hy + 2, 'u');
  line(F, hx + 1, hy + 5, hx + 4, hy + 8, 'u');
  // the crown: a tarnished gilt band, and a ring of tall jagged spikes
  const band = and(ell(hx, hy - 2, 11.4, 4.2), box(hx - 12, hy - 5, hx + 12, hy + 1));
  shade(F, band, R_GOLD, { bias: 0.1 });
  for (const [dx, h, w] of [[-9, 8, 2.2], [-5, 14, 2.4], [-1, 19, 2.6], [3, 15, 2.4], [7, 11, 2.2], [10, 7, 1.8]]) {
    shade(F, poly([[hx + dx - w, hy - 3], [hx + dx + w, hy - 3], [hx + dx + 0.5, hy - 3 - h]]), R_GOLD, { bias: 0.15 });
  }
  for (let k = -9; k <= 9; k += 3) px(F, hx + k, hy - 1, 'Y');
  px(F, hx - 1, hy - 5, 'R'); px(F, hx - 1, hy - 4, 'r');   // a dull ruby in the brow
}

// ---------- body ----------
function drawLeg(F, hipx, foot, lift, far) {
  const L = lift;
  const hipy = 78, kneeX = hipx + foot * 0.4 + 2, kneeY = 85 - L * 0.4, ankX = hipx + foot, ankY = SOLE - 6 - L;
  const B = far ? R_FARB : R_BONE, I = far ? ['k', 'k', 'k', 'z', 'Z'] : R_IRON;
  shade(F, cap(hipx, hipy, 4.2, kneeX, kneeY, 3.4), B);
  shade(F, cap(kneeX, kneeY, 3.1, ankX, ankY, 2.6), B);
  shade(F, ell(kneeX, kneeY, 4, 3.8), B);                                  // the knee
  shade(F, cap(kneeX + 0.5, kneeY + 2, 3.8, kneeX + (ankX - kneeX) * 0.55, kneeY + (ankY - kneeY) * 0.55 + 1, 3.8), I); // a greave over the shin
  const foot_ = or(box(ankX - 5, ankY - 1, ankX + 8, SOLE - L + 1), ell(ankX + 6, SOLE - L - 2, 4.8, 3.4));
  shade(F, foot_, I);
  line(F, ankX - 4, SOLE - L, ankX + 7, SOLE - L, 'k');                    // sole
  if (!far) { px(F, ankX + 6, SOLE - L - 4, 'X'); px(F, ankX + 1, ankY, 'X'); }
}

function drawTorso(F, o) {
  const { lean, bob } = o;
  const cx = 56 + lean, top = 44 + bob;
  // the ribcage: a dark hollow, six bone ribs curving round it, a sternum at the front and a knobbed spine at the back
  const cage = or(ell(cx + 2, top + 15, 15, 14), ell(cx - 8, top + 8, 9, 8));
  paint(F, cage, 'd');
  for (let k = 0; k < 7; k++) {
    const y = top + 6 + k * 3.1, x0 = cx - 9 + Math.abs(k - 2) * 0.5, x1 = cx + 14 - Math.abs(k - 3) * 1.3;
    line(F, x0, y, x1, y + 1.2, k % 2 ? 'w' : 'W');
    line(F, x0 + 1, y + 1, x1 - 1, y + 2.2, 'u');
  }
  shade(F, cap(cx + 15, top + 7, 1.6, cx + 10, top + 28, 1.4), R_BONE);   // the sternum
  shade(F, or(cap(cx - 11, top + 3, 2.8, cx - 9, top + 20, 2.6), cap(cx - 9, top + 20, 2.6, cx - 6, top + 32, 2.4)), R_BONE);   // the spine
  for (let k = 0; k < 6; k++) px(F, cx - 12.5 + k * 0.5, top + 6 + k * 5, 'W');               // its knobs
  // the collar bones sweeping out to the shoulders, and the pelvis
  line(F, cx + 8, top + 2, cx + 1, top + 5, 'W'); line(F, cx + 8, top + 3, cx + 1, top + 6, 'u');
  shade(F, ell(cx - 1, top + 31, 11, 5), R_BONE);
  paint(F, ell(cx - 2, top + 31, 3, 2), 'd');
  // a rotted breastplate: blackened iron clinging to the lower right ribs, split and rusted
  const plate = poly([[cx + 3, top + 15], [cx + 18, top + 17], [cx + 14, top + 28], [cx + 2, top + 26]]);
  shade(F, plate, R_IRON, { bias: -0.1 });
  line(F, cx + 8, top + 16, cx + 9, top + 27, 'k');
  for (const [x, y] of [[5, 18], [15, 20], [6, 24], [12, 26]]) px(F, cx + x, top + y, 'X');
  px(F, cx + 11, top + 21, 'i'); px(F, cx + 12, top + 22, 'i'); px(F, cx + 7, top + 25, 'i');
  const torso = or(cage, plate);
  return { cx, top, torso };
}

function drawCape(F, o) {
  const { lean, bob } = o;
  const cx = 56 + lean, top = 44 + bob;
  // a tattered cape hanging off the back and shoulders, behind everything
  const cape = poly([[cx - 16, top + 4], [cx + 4, top + 1], [cx + 5, top + 32], [cx + 2, top + 46], [cx - 4, top + 40], [cx - 9, top + 50], [cx - 14, top + 41], [cx - 21, top + 48], [cx - 21, top + 24]]);
  shade(F, cape, R_CLOTH, { rim: false });
  for (let k = 0; k < 9; k++) line(F, cx - 18 + k * 2.4, top + 14, cx - 19 + k * 2.4, top + 38 + (k % 3) * 3, 'v');   // folds
  for (const [x, y] of [[-20, 47], [-14, 49], [-9, 52], [-3, 44], [1, 47]]) px(F, cx + x, top + y, 'l');            // ragged hem
  line(F, cx - 15, top + 6, cx + 3, top + 3, 'q');                                                                   // a lit edge at the shoulders
}

function drawKilt(F, o, cx, top) {
  const { bob } = o;
  const by = top + 30;
  // a tattered purple tabard hanging in ragged strips from a studded belt, gilt at the hem
  const strips = [[-12, 8, 11], [-5, 7, 14], [1, 7, 10], [7, 7, 13], [13, 5, 9]];
  for (const [sx, w, hgt] of strips) {
    shade(F, box(cx + sx, by + 1, cx + sx + w, by + 1 + hgt), R_CLOTH, { rim: false });
    for (let k = 0; k < w; k += 2) px(F, cx + sx + k, by + hgt, k % 4 === 0 ? 'l' : 'v');
    px(F, cx + sx + 2, by + hgt - 4, 'G');
  }
  shade(F, box(cx - 14, by - 3, cx + 18, by + 2), R_LEATHER, { bias: 0.1 });
  for (let x = cx - 12; x < cx + 17; x += 4) px(F, x, by - 1, 'G');
  shade(F, ell(cx + 2, by - 0.5, 4.2, 4), R_GOLD);
  stampIn(F, ell(cx + 2, by - 0.5, 4.2, 4), ['.WWW.', 'WdWdW', 'WWWWW', '.WdW.'], Math.round(cx), Math.round(by - 3));
}

function drawPauldron(F, S) {
  const [sx0, sy0] = S, sx = sx0 - 2, sy = sy0 - 4;
  // a slab of blackened iron riding the shoulder with three spikes raking up and back, over a purple cloth collar
  shade(F, ell(sx + 1, sy + 4, 9.5, 4), R_CLOTH, { rim: false });
  for (const [ox, oy, tx, ty] of [[-6, -1, -11, -9], [-1, -3, -4, -12], [4, -3, 3, -11]]) {
    shade(F, poly([[sx + ox - 2, sy + oy + 3], [sx + ox + 3, sy + oy + 3], [sx + tx, sy + ty]]), R_IRON, { bias: 0.1 });
  }
  const plate = and(ell(sx, sy + 3, 10, 7.5), box(0, 0, CW, sy + 7));
  shade(F, plate, R_IRON);
  line(F, sx - 8, sy + 5, sx + 8, sy + 5, 'k');
  for (const [ox, oy] of [[-5, 0], [0, -1], [5, 1], [-2, 3]]) px(F, sx + ox, sy + oy, 'X');
  px(F, sx + 3, sy + 1, 'i'); px(F, sx + 3, sy + 2, 'i'); px(F, sx + 4, sy + 3, 'i');
}

function drawFist(F, H, far, wrap = true) {
  const [x, y] = H;
  shade(F, ell(x, y, 4.6, 4), far ? R_FARB : R_BONE);
  for (const k of [-3, -1, 1, 3]) px(F, x + 1 + k * 0.6, y + 2 + (k & 1), 'd');             // finger gaps
  if (wrap) shade(F, box(x - 5, y - 5, x - 1, y + 4), R_IRON);                              // a gauntlet cuff
}

function drawArm(F, S, H, far, bracer = false) {
  const { E, H: Hh } = arm(S, H, 17, 16);
  const B = far ? R_FARB : R_BONE;
  shade(F, cap(S[0], S[1], 3.8, E[0], E[1], 3.1), B);
  shade(F, cap(E[0], E[1], 3.1, Hh[0], Hh[1], 2.6), B);
  shade(F, ell(E[0], E[1], 3.7, 3.5), B);                                                    // the elbow
  if (bracer) {
    const bx = Hh[0] + (E[0] - Hh[0]) * 0.34, by = Hh[1] + (E[1] - Hh[1]) * 0.34;
    shade(F, cap(bx, by, 3.8, Hh[0] + (E[0] - Hh[0]) * 0.55, Hh[1] + (E[1] - Hh[1]) * 0.55, 3.9), far ? ['k', 'k', 'k', 'z', 'Z'] : R_IRON);
  }
  return Hh;
}

function build(o) {
  const { lean = 0, bob = 0, hx = 0, hy = 0, lf = 0, lb = 0, lfl = 0, lbl = 0, head = 'norm', ang = -70, hand = [84, 62], far = [82, 70], club = true, twoHand = false } = o;
  const F = new Array(CW * CH).fill(null);
  const S = [52 + lean, 50 + bob], S2 = [40 + lean, 50 + bob];
  const hh = (p) => [p[0] + lean * 0, p[1] + bob * 0];
  drawCape(F, { lean, bob });
  // far arm behind the torso, far leg behind the near leg
  const farH = drawArm(F, S2, hh(far), true);
  drawFist(F, farH, true, false);
  drawLeg(F, 46, lb, lbl, true);
  drawLeg(F, 62, lf, lfl, false);
  const { cx, top } = drawTorso(F, { lean, bob });
  drawKilt(F, { bob }, cx, top);
  // sword arm: the sword first, then the arm and the fist over the grip
  const handP = hh(hand);
  if (club) drawSword(F, handP, ang);
  const nh = drawArm(F, S, handP, false, true);
  drawPauldron(F, S);
  drawHead(F, [68 + lean + hx, 33 + bob + hy], head);
  drawFist(F, nh, false, true);
  if (club && twoHand) { const fh = hh(far); drawFist(F, fh, true, false); }
  return F;
}

const frames = {};
function pose(name, o = {}) {
  frames[name] = [(put) => { const F = build(o); for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const c = F[idx(x, y)]; if (c) put(x + SHIFT, y, c); } }];
}

// walk: a slow, regal stride, the greatsword resting up on the shoulder
const rest = { ang: -62, hand: [84, 64], far: [80, 72] };
pose('bare', { noclub: true, club: false, hand: [82, 66], far: [80, 72] });
pose('walk0', { ...rest, bob: 1, lf: 6, lb: -6, lbl: 3, lfl: 0 });
pose('walk1', { ...rest, bob: 0, lf: 0, lb: 0 });
pose('walk2', { ...rest, bob: 1, lf: -6, lb: 6, lfl: 3, lbl: 0 });
pose('walk3', { ...rest, bob: 0, lf: 0, lb: 0 });
pose('idle0', { ...rest, bob: 0 });
pose('idle1', { ...rest, bob: 1, hy: 0 });
// windup: the sword hauled back over the shoulder, then right back, head thrown back to roar
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
// boss moves: slam (sword raised high in both fists, then driven down), roar (arms wide), smash (sword cocked back low)
pose('slam0', { ang: -150, hand: [60, 32], far: [56, 34], twoHand: true, lean: -1, bob: 0, hy: -2, head: 'roar', lf: -3, lb: 3 });
pose('slam1', { ang: -160, hand: [58, 22], far: [54, 26], twoHand: true, lean: -3, bob: -1, hy: -3, head: 'roar', lf: -4, lb: 4 });
pose('roar0', { ang: -55, hand: [88, 38], far: [38, 44], lean: -2, bob: 1, hx: -2, hy: -2, head: 'roar', lf: -2, lb: 2 });
pose('roar1', { ang: -60, hand: [90, 34], far: [36, 38], lean: -3, bob: 0, hx: -2, hy: -3, head: 'roar', lf: -3, lb: 3 });
pose('smash0', { ang: -145, hand: [64, 44], far: [56, 54], lean: -4, bob: 2, hx: -2, hy: 1, lf: -3, lb: 3 });
pose('smash1', { ang: -170, hand: [56, 46], far: [50, 56], lean: -5, bob: 2, hx: -3, hy: 1, lf: -4, lb: 4 });

// the dropped sword for the corpse (drawn as plain pixels)
function lyingClub() {
  const W = 56, H = 22, F = new Array(W * H).fill(null);
  const a = 0, saved = null;
  const rows = [];
  for (let y = 0; y < H; y++) { rows.push(''); }
  // reuse the screen-space club painter on a scratch cell, then crop
  const G2 = new Array(CW * CH).fill(null);
  drawSword(G2, [10, 30], 0);
  let x0 = CW, x1 = -1, y0 = CH, y1 = -1;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (G2[idx(x, y)]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = [];
  for (let y = y0; y <= y1; y++) { let r = ''; for (let x = x0; x <= x1; x++) r += G2[idx(x, y)] ?? '.'; out.push(r); }
  return { rows: out, ax: 0, ay: 0 };
}
const swordLying = lyingClub();

export default {
  name: 'dreadregent', title: 'Dread Regent (boss)', notes: 'The Haunted Keep boss at native ~74px: a colossal undead king, gilt crown, rotted breastplate, greatsword baked in. Extra poses: slam, roar, smash.',
  cell: [CW, CH], shadow: [60, 10], pivot: [60, SOLE], palette, post,
  parts: { swordLying }, frames,
  derived: { dead: { fromFrame: 'bare', op: 'lie', after: [['swordLying', 62, 78]] } },
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
