// Pixel toolkit shared by the sprite composers (monsterArt.ts for monsters, humanArt.ts for people): colour math, a working canvas with
// shaded shapes (ellipse, rect, thick line, polygon, ASCII stamp), the house post pass (rim light + ink outline) and a sheet packer.
// Pure code (no DOM) so it runs in node tests and in the browser.
// ---------------------------------------------------------------------------------------------------------------------------
// Colour math
// ---------------------------------------------------------------------------------------------------------------------------
export const OP = 0x1000000; // opaque flag kept in the top byte so black (0) is still a colour
export const ch = (c: number, s: number): number => (c >> s) & 255;
export const mixc = (a: number, b: number, t: number): number => {
  const r = Math.round(ch(a, 16) * (1 - t) + ch(b, 16) * t);
  const g = Math.round(ch(a, 8) * (1 - t) + ch(b, 8) * t);
  const bl = Math.round(ch(a, 0) * (1 - t) + ch(b, 0) * t);
  return (r << 16) | (g << 8) | bl;
};
export const lum = (c: number): number => 0.3 * ch(c, 16) + 0.59 * ch(c, 8) + 0.11 * ch(c, 0);

/** Three flat values of one material: light (upper-left), base, shade (lower-right). */
export interface Mat { l: number; b: number; s: number }
export const matOf = (c: number): Mat => ({ l: mixc(c, 0xfff4d8, 0.34), b: c, s: mixc(c, 0x1c1038, 0.42) });
export const flat = (c: number): Mat => ({ l: c, b: c, s: c });

// ---------------------------------------------------------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------------------------------------------------------
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash2 = (a: number, b: number, s: number): number => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x1234, 0xc2b2ae35) ^ Math.imul(s | 0, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const ri = Math.round;

// ---------------------------------------------------------------------------------------------------------------------------
// Working canvas. Edge coordinates: pixel (x, y) covers [x, x+1) x [y, y+1); the ground is the edge y = GY (nothing is drawn below).
// ---------------------------------------------------------------------------------------------------------------------------
export const W = 220, H = 220, CX = 110, GY = 200;

export class Cv {
  px = new Int32Array(W * H);
  nr = new Uint8Array(W * H);
  tg = new Uint8Array(W * H);
  clear(): void { this.px.fill(0); this.nr.fill(0); this.tg.fill(0); }
  put(x: number, y: number, c: number, tag: number, noRim = 0, on = 0): void {
    if (x < 0 || x >= W || y < 0 || y >= GY) return;
    const i = y * W + x;
    if (on && this.tg[i] !== on) return;
    this.px[i] = c | OP; this.tg[i] = tag; this.nr[i] = noRim;
  }
  has(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < W && y < H && this.px[y * W + x] !== 0; }
  tag(x: number, y: number): number { return x >= 0 && y >= 0 && x < W && y < H ? this.tg[y * W + x] : 0; }
  col(x: number, y: number): number { return this.px[y * W + x] & 0xffffff; }
}

export interface Shade { hi?: number; lo?: number; on?: number }
export const pick = (m: Mat, ls: number, hi: number, lo: number): number => (ls > hi ? m.l : ls < lo ? m.s : m.b);

/** Filled (super)ellipse; taper > 0 makes the top wider than the bottom. */
export function ell(cv: Cv, cx: number, cy: number, rx: number, ry: number, m: Mat, tag: number, o: { e?: number; taper?: number } & Shade = {}): void {
  const e = o.e ?? 2, tp = o.taper ?? 0;
  const small = Math.min(rx, ry) < 2.6;
  const hi = o.hi ?? (small ? 0.62 : 0.5), lo = o.lo ?? (small ? -0.5 : -0.34);
  const rmax = rx * (1 + Math.abs(tp));
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const ny = (y + 0.5 - cy) / ry;
    const rxa = rx * (1 - tp * ny);
    if (rxa <= 0) continue;
    for (let x = Math.floor(cx - rmax); x <= Math.ceil(cx + rmax); x++) {
      const nx = (x + 0.5 - cx) / rxa;
      const d = e === 2 ? nx * nx + ny * ny : Math.pow(Math.abs(nx), e) + Math.pow(Math.abs(ny), e);
      if (d > 1) continue;
      cv.put(x, y, pick(m, -(nx * 0.55 + ny * 0.8), hi, lo), tag, 0, o.on ?? 0);
    }
  }
}

/** Filled axis-aligned rectangle in edge coordinates; the bottom row takes the shade, the top row the light when tall enough. */
export function rect(cv: Cv, x0: number, y0: number, x1: number, y1: number, m: Mat, tag: number, o: { on?: number; bevel?: boolean } = {}): void {
  const xa = Math.round(x0), xb = Math.round(x1), ya = Math.round(y0), yb = Math.round(y1);
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
    let c = m.b;
    if (o.bevel !== false) {
      if (yb - ya >= 2 && y === yb - 1) c = m.s; else if (yb - ya >= 3 && y === ya) c = m.l;
      else if (xb - xa >= 3 && x === xa && c === m.b) c = m.l;
      else if (xb - xa >= 3 && x === xb - 1 && c === m.b) c = m.s;
    }
    cv.put(x, y, c, tag, 0, o.on ?? 0);
  }
}

export function bres(cv: Cv, x0: number, y0: number, x1: number, y1: number, c: number, tag: number, on = 0): void {
  let ax = Math.floor(x0), ay = Math.floor(y0);
  const bx = Math.floor(x1), by = Math.floor(y1);
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 4000; n++) {
    cv.put(ax, ay, c, tag, 0, on);
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; ax += sx; }
    if (e2 <= dx) { err += dx; ay += sy; }
  }
}

/** Thick line (round caps) from (x0,y0) to (x1,y1), w px wide. Odd widths are centred on pixel centres. */
export function line(cv: Cv, x0: number, y0: number, x1: number, y1: number, w: number, m: Mat, tag: number, o: Shade = {}): void {
  w = Math.max(1, Math.round(w));
  if (w === 1) { bres(cv, x0, y0, x1, y1, m.b, tag, o.on ?? 0); return; }
  const sh = w & 1 ? 0.5 : 0;
  x0 += sh; y0 += sh; x1 += sh; y1 += sh;
  const hw = w / 2, hi = o.hi ?? 0.3, lo = o.lo ?? -0.3;
  const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy;
  const xa = Math.floor(Math.min(x0, x1) - hw), xb = Math.ceil(Math.max(x0, x1) + hw);
  const ya = Math.floor(Math.min(y0, y1) - hw), yb = Math.ceil(Math.max(y0, y1) + hw);
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
    const px = x + 0.5, py = y + 0.5;
    const t = l2 === 0 ? 0 : clamp(((px - x0) * vx + (py - y0) * vy) / l2, 0, 1);
    const dx = px - (x0 + vx * t), dy = py - (y0 + vy * t);
    if (dx * dx + dy * dy > hw * hw + 0.01) continue;
    cv.put(x, y, pick(m, -(dx * 0.7 + dy * 0.7) / hw, hi, lo), tag, 0, o.on ?? 0);
  }
}

/** Filled polygon (even-odd, tested at pixel centres), shaded from the centroid. */
export function poly(cv: Cv, pts: number[][], m: Mat, tag: number, o: Shade = {}): void {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.max(1, (x1 - x0) / 2, (y1 - y0) / 2);
  const hi = o.hi ?? 0.45, lo = o.lo ?? -0.35;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (!inside) continue;
    cv.put(x, y, pick(m, -(((px - cx) / R) * 0.6 + ((py - cy) / R) * 0.8), hi, lo), tag, 0, o.on ?? 0);
  }
}

/** Small authored picture: one character per pixel; letters map through `map`; '.' and ' ' are empty. */
export function stamp(cv: Cv, art: readonly string[], x: number, y: number, map: Record<string, number>, tag: number, o: { flip?: boolean; noRim?: boolean } = {}): void {
  for (let r = 0; r < art.length; r++) {
    const row = art[r];
    for (let c = 0; c < row.length; c++) {
      const k = row[o.flip ? row.length - 1 - c : c];
      const col = map[k];
      if (col !== undefined) cv.put(x + c, y + r, col, tag, o.noRim ? 1 : 0);
    }
  }
}

export interface Spr { w: number; h: number; px: Int32Array; nr: Uint8Array; ax: number; gy: number }

export function crop(cv: Cv): Spr {
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cv.px[y * W + x] !== 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = CX; x1 = CX; y0 = GY - 1; y1 = GY - 1; cv.px[(GY - 1) * W + CX] = 0x808080 | OP; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const px = new Int32Array(w * h), nr = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { px[y * w + x] = cv.px[(y + y0) * W + x + x0]; nr[y * w + x] = cv.nr[(y + y0) * W + x + x0]; }
  return { w, h, px, nr, ax: CX - x0, gy: GY - y0 };
}

/** House post pass: 1px rim light on top/left edges, 1px dark ink outline all round. Pads the sprite by 1 on every side. */
export function post(s: Spr, ink: number): Spr {
  const w = s.w + 2, h = s.h + 2;
  const solid = new Uint8Array(w * h);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.px[y * s.w + x] !== 0) solid[(y + 1) * w + x + 1] = 1;
  const px = new Int32Array(w * h), nr = new Uint8Array(w * h);
  const sd = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x] === 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (solid[i]) {
      const c = s.px[(y - 1) * s.w + x - 1] & 0xffffff;
      const flag = s.nr[(y - 1) * s.w + x - 1];
      nr[i] = flag;
      px[i] = (!flag && (!sd(x - 1, y) || !sd(x, y - 1)) ? mixc(c, 0xfff6e0, 0.38) : c) | OP;
    } else if (sd(x - 1, y) || sd(x + 1, y) || sd(x, y - 1) || sd(x, y + 1)) px[i] = ink | OP;
  }
  return { w, h, px, nr, ax: s.ax + 1, gy: s.gy + 1 };
}


/** A sheet's metadata, in the shape of the game's own sheet json (the shape the sprite sheets have always used). */
export interface SheetMeta {
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
  anims: Record<string, { frames: string[] }>;
}
export interface BuiltSheet { width: number; height: number; rgba: Uint8ClampedArray; meta: SheetMeta }

/**
 * Packs finished sprites into one sheet. Frames whose anims share a group (`groupOf`) share a cell size: each cell is centred on the
 * character's centre line with the ground on its bottom row and only as big as the group's largest frame (at most maxW x maxH); identical
 * frames of a group share one rect. `min` makes every cell at least that big (half-width E, rows above the ground), so sheets of one family share a pivot.
 */
export function buildSheet(frames: { name: string; anim: string; spr: Spr }[], groupOf: (anim: string) => string, maxW: number, maxH: number, min?: { E: number; top: number }): BuiltSheet {
  const gOf = groupOf;
  // Cells: frames of one anim share a cell (anims of one group share it too, so identical frames can share a rect). Each cell is centred
  // on the character's centre line with the ground on its bottom row, and only as big as its largest frame.
  const groups = new Map<string, { E: number; top: number; frames: number[] }>();
  frames.forEach((f, i) => {
    const key = gOf(f.anim);
    const g = groups.get(key) ?? { E: min?.E ?? 1, top: min?.top ?? 1, frames: [] };
    g.E = Math.max(g.E, f.spr.ax, f.spr.w - f.spr.ax); g.top = Math.max(g.top, f.spr.gy);
    g.frames.push(i);
    groups.set(key, g);
  });
  interface Cell { w: number; h: number; rgba: Uint8ClampedArray }
  const cells: Cell[] = [];
  const frameCell: number[] = new Array(frames.length);
  for (const g of groups.values()) {
    const E = Math.min(g.E, maxW >> 1), cw = 2 * E, chh = Math.min(g.top + 1, maxH);
    const mine: number[] = [];
    for (const fi of g.frames) {
      const f = frames[fi];
      const rgba = new Uint8ClampedArray(cw * chh * 4);
      const ox = E - f.spr.ax, oy = chh - 1 - f.spr.gy;
      for (let y = 0; y < f.spr.h; y++) for (let x = 0; x < f.spr.w; x++) {
        const c = f.spr.px[y * f.spr.w + x];
        if (c === 0) continue;
        const X = ox + x, Y = oy + y;
        if (X < 0 || Y < 0 || X >= cw || Y >= chh) continue;
        const o = (Y * cw + X) * 4;
        rgba[o] = (c >> 16) & 255; rgba[o + 1] = (c >> 8) & 255; rgba[o + 2] = c & 255; rgba[o + 3] = 255;
      }
      let found = -1;
      for (const k of mine) {
        const o = cells[k].rgba;
        let same = true;
        for (let i = 0; i < rgba.length; i++) if (o[i] !== rgba[i]) { same = false; break; }
        if (same) { found = k; break; }
      }
      if (found < 0) { found = cells.length; cells.push({ w: cw, h: chh, rgba }); mine.push(found); }
      frameCell[fi] = found;
    }
  }
  // shelf-pack the unique cells into one wide sheet
  const order = cells.map((_, i) => i).sort((a, b) => cells[b].h - cells[a].h || cells[b].w - cells[a].w || a - b);
  let total = 0, widest = 1;
  for (const c of cells) { total += c.w * c.h; widest = Math.max(widest, c.w); }
  const packAt = (target: number): { pos: { x: number; y: number }[]; width: number; height: number } => {
    const pos: { x: number; y: number }[] = new Array(cells.length);
    let sx = 0, sy = 0, rowH = 0, width = 1;
    for (const k of order) {
      const c = cells[k];
      if (sx > 0 && sx + c.w > target) { sy += rowH; sx = 0; rowH = 0; }
      pos[k] = { x: sx, y: sy };
      sx += c.w; rowH = Math.max(rowH, c.h); width = Math.max(width, sx);
    }
    return { pos, width, height: sy + rowH };
  };
  let best = packAt(widest);
  for (let t = widest; t <= Math.ceil(Math.sqrt(total) * 3) + widest; t += Math.max(2, widest >> 3)) {
    const r = packAt(t);
    const ok = (q: { width: number; height: number }): boolean => q.width <= q.height * 4 && q.height <= q.width * 1.5;
    if (ok(r) && (!ok(best) || r.width * r.height < best.width * best.height)) best = r;
  }
  const { pos, width } = best;
  const sy = 0, rowH = best.height;
  const height = sy + rowH;
  const rgba = new Uint8ClampedArray(width * height * 4);
  cells.forEach((cell, k) => {
    for (let y = 0; y < cell.h; y++) rgba.set(cell.rgba.subarray(y * cell.w * 4, (y + 1) * cell.w * 4), ((pos[k].y + y) * width + pos[k].x) * 4);
  });
  const meta: SheetMeta = { frames: {}, anims: {} };
  frames.forEach((f, i) => {
    const k = frameCell[i];
    meta.frames[f.name] = { x: pos[k].x, y: pos[k].y, w: cells[k].w, h: cells[k].h };
    (meta.anims[f.anim] ??= { frames: [] }).frames.push(f.name);
  });
  return { width, height, rgba, meta };
}
