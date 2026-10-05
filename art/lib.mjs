// Helpers for authoring parts. Everything here outputs plain pixel rows; nothing resamples or rotates art
// that was hand-pixeled. Geometry helpers (blade, smear) rasterize straight onto the pixel grid.

/** Shift each row horizontally by fn(rowIndex, rowCount). Returns {rows, ax, ay} anchored at the original (0,0). */
export function shear(rows, fn) {
  const sh = rows.map((r, i) => ({ dx: Math.round(fn(i, rows.length)), r }));
  const min = Math.min(...sh.map((s) => s.dx));
  const max = Math.max(...sh.map((s) => s.dx + s.r.length));
  return { rows: sh.map((s) => '.'.repeat(s.dx - min) + s.r + '.'.repeat(max - (s.dx + s.r.length))), ax: -min, ay: 0 };
}

/** Add a 1px outline (char `c`) around every opaque pixel that touches empty space (4-neighbour). */
export function outline(part, c = 'k') {
  const rows = Array.isArray(part) ? part : part.rows;
  const ax = Array.isArray(part) ? 0 : part.ax, ay = Array.isArray(part) ? 0 : part.ay;
  const w = rows[0].length + 2, h = rows.length + 2;
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  rows.forEach((r, y) => [...r].forEach((ch, x) => { g[y + 1][x + 1] = ch; }));
  const solid = (x, y) => g[y]?.[x] !== undefined && g[y][x] !== '.';
  const out = g.map((r) => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) out[y][x] = c;
  }
  return { rows: out.map((r) => r.join('')), ax: ax + 1, ay: ay + 1 };
}

/**
 * Rasterize a slab blade + grip. angle in degrees (0 = points right, 90 = points down). The grip pivot
 * (where the hand holds it) is the anchor. mat(u, v, L, w) -> palette char or '.'; u along the blade from
 * the guard, v across (+v = cutting edge side before rotation).
 */
export function weapon({ angle, len, half, grip = 6, holdU = 0, mat, outlineChar = null }) {
  const a = (angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const R = len + grip + half + 3;
  const N = Math.ceil(R * 2) + 2, O = Math.ceil(R) + 1;
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x + 0.5 - (O + 0.5), dy = y + 0.5 - (O + 0.5);
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    g[y][x] = mat(u, v, len, half) ?? '.';
  }
  // crop to bounds
  let x0 = N, x1 = -1, y0 = N, y1 = -1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const rows = [];
  for (let y = y0; y <= y1; y++) rows.push(g[y].slice(x0, x1 + 1).join(''));
  const part = { rows, ax: Math.floor(O + 0.5 + holdU * c) - x0, ay: Math.floor(O + 0.5 + holdU * s) - y0 };
  return outlineChar ? outline(part, outlineChar) : part;
}

/** A crescent slash smear around (cx,cy) from angle a0 to a1 (deg), outer radius r, max thickness t. */
export function smear({ cx, cy, a0, a1, r, t, core = '6', rim = '5', tail = '4', w = 40, h = 40 }) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const d = Math.hypot(dx, dy);
    let th = (Math.atan2(dy, dx) * 180) / Math.PI;
    while (th < a0) th += 360;
    while (th >= a0 + 360) th -= 360;
    const f = (th - a0) / (a1 - a0);
    if (f < 0 || f > 1) continue;
    const thick = t * Math.sin(Math.PI * Math.pow(f, 0.7));
    if (d <= r && d > r - thick) {
      const depth = (r - d) / Math.max(thick, 0.001);
      g[y][x] = depth < 0.34 ? core : depth < 0.7 ? rim : tail;
    }
  }
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return { rows: ['.'], ax: 0, ay: 0 };
  const rows = [];
  for (let y = y0; y <= y1; y++) rows.push(g[y].slice(x0, x1 + 1).join(''));
  return { rows, ax: Math.round(cx) - x0, ay: Math.round(cy) - y0 };
}

/** Parse a part drawn with a leading ruler-free block into rows (trims blank edge lines). */
export const rows = (s) => s.split('\n').map((r) => r.trim()).filter((r) => r.length);

/** Thick polyline limb drawn straight into a frame. Returns a frame entry (function). pts = [[x,y],...] cell coords. */
export function limb(pts, { w = 3, body = '4', hi = null, lo = null, ink = null, cap = null } = {}) {
  return (put) => {
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs) - w - 1, x1 = Math.max(...xs) + w + 1, y0 = Math.min(...ys) - w - 1, y1 = Math.max(...ys) + w + 1;
    const r = w / 2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let best = 1e9, side = 0;
      for (const [[ax, ay], [bx, by]] of segs) {
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x + 0.5 - ax - 0.5) * dx + (y + 0.5 - ay - 0.5) * dy) / L2));
        const px = ax + 0.5 + t * dx, py = ay + 0.5 + t * dy;
        const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
        if (d < best) { best = d; side = -(x + 0.5 - px) - (y + 0.5 - py); }
      }
      if (best <= r) put(x, y, side > 0.4 && hi ? hi : side < -0.4 && lo ? lo : body);
      else if (ink && best <= r + 1) put(x, y, ink);
    }
    if (cap) {
      const [ex, ey] = pts[pts.length - 1];
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) put(ex + x, ey + y, cap);
    }
  };
}

/** Transpose-rotate rows 90 degrees counter-clockwise (head of a standing figure ends up on the left). */
export function rot90ccw(part) {
  const rows = Array.isArray(part) ? part : part.rows;
  const h = rows.length, w = rows[0].length;
  const out = [];
  for (let x = w - 1; x >= 0; x--) { let r = ''; for (let y = 0; y < h; y++) r += rows[y][x] ?? '.'; out.push(r); }
  return out;
}

/**
 * A walking leg: slide the foot sideways by `foot` (hip stays put) and optionally lift it by cutting `lift` rows
 * out of the shin, so the boot rises instead of sliding along the ground. Use lift on the swing leg only.
 */
export function stepLeg(shape, foot, lift = 0) {
  const cut = Math.floor(shape.length * 0.45);
  const r = lift > 0 ? [...shape.slice(0, cut), ...shape.slice(cut + lift)] : shape;
  return shear(r, (i, n) => foot * Math.pow(i / (n - 1), 1.2));
}

/** An elliptical ring (1..thick px) centred on the anchor; for shockwaves / heal pulses. Anchor is the centre. */
export function ring({ rx, ry, thick = 1, ch = 'N', inner = null }) {
  const w = rx * 2 + 3, h = ry * 2 + 3, cx = rx + 1, cy = ry + 1;
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot((x + 0.5 - cx - 0.5) / (rx + 0.5), (y + 0.5 - cy - 0.5) / (ry + 0.5));
    if (d <= 1 && d > 1 - thick / Math.max(rx, ry)) g[y][x] = ch;
    else if (inner && d <= 1 - thick / Math.max(rx, ry) && d > 1 - (thick + 1.4) / Math.max(rx, ry)) g[y][x] = inner;
  }
  return { rows: g.map((r) => r.join('')), ax: cx, ay: cy };
}

/** A 1px line between two cell points, as a frame entry. */
export function line(p0, p1, ch) {
  return (put) => {
    let [x0, y0] = p0.map(Math.round); const [x1, y1] = p1.map(Math.round);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      put(x0, y0, ch);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
}
