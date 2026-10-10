// Sprite composer for generated monsters: turns a MonsterLook (src/data/monsterLook.ts) into a sprite sheet at runtime.
// Pure code (no DOM, no canvas) so it runs in node tests and in the browser. Deterministic: one look is always the same bytes.
//
// How it works: the body is built PROCEDURALLY at any size from filled shapes (ellipses / superellipses, thick lines, polygons)
// shaded by one rule (light from the upper left: a light band, a base, a shade band), plus a few small ASCII stamps (eyes, gems,
// fangs, tail tips). Every pose moves PARTS (leg offsets, lean, head bob, a weapon drawn at one of a few angles); nothing is rotated
// or resampled except the corpse, which is the standing body turned a quarter turn. Each frame then gets the house post pass:
// a 1px rim light on the top/left silhouette edges and a 1px dark ink outline all round (see art/README.md "House style").
import type { MonsterLook, MonsterPalette, MonsterSheet, MonsterSheetMeta, Motif } from '../data/monsterLook';

// ---------------------------------------------------------------------------------------------------------------------------
// Colour math
// ---------------------------------------------------------------------------------------------------------------------------
const OP = 0x1000000; // opaque flag kept in the top byte so black (0) is still a colour
const ch = (c: number, s: number): number => (c >> s) & 255;
const mixc = (a: number, b: number, t: number): number => {
  const r = Math.round(ch(a, 16) * (1 - t) + ch(b, 16) * t);
  const g = Math.round(ch(a, 8) * (1 - t) + ch(b, 8) * t);
  const bl = Math.round(ch(a, 0) * (1 - t) + ch(b, 0) * t);
  return (r << 16) | (g << 8) | bl;
};
const lum = (c: number): number => 0.3 * ch(c, 16) + 0.59 * ch(c, 8) + 0.11 * ch(c, 0);

/** Three flat values of one material: light (upper-left), base, shade (lower-right). */
interface Mat { l: number; b: number; s: number }
const matOf = (c: number): Mat => ({ l: mixc(c, 0xfff4d8, 0.34), b: c, s: mixc(c, 0x1c1038, 0.42) });
const flat = (c: number): Mat => ({ l: c, b: c, s: c });

interface Pal {
  base: Mat; acc: Mat; met: Mat; wood: Mat; bone: Mat; dark: Mat;
  eye: number; eyeHi: number; eyeLo: number; ink: number; white: number;
}

function makePal(p: MonsterPalette): Pal {
  let base = p.base & 0xffffff;
  if (lum(base) < 52) base = mixc(base, 0x6a6080, 0.5); // never vanish against a dark backdrop
  const acc = p.accent & 0xffffff, met = p.metal & 0xffffff, eye = p.eye & 0xffffff;
  const ink = mixc(base, 0x0c0618, 0.88);
  return {
    base: matOf(base), acc: matOf(acc), met: matOf(met),
    wood: matOf(mixc(0x7a4a28, base, 0.15)),
    bone: matOf(mixc(0xe6dac0, acc, 0.12)),
    dark: matOf(mixc(base, 0x1a1030, 0.7)),
    eye, eyeHi: mixc(eye, 0xffffff, 0.62), eyeLo: mixc(eye, 0x1a0a20, 0.45), ink, white: 0xf4efe2,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------------------------------------------------------
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash2 = (a: number, b: number, s: number): number => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x1234, 0xc2b2ae35) ^ Math.imul(s | 0, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const ri = Math.round;

// ---------------------------------------------------------------------------------------------------------------------------
// Working canvas. Edge coordinates: pixel (x, y) covers [x, x+1) x [y, y+1); the ground is the edge y = GY (nothing is drawn below).
// ---------------------------------------------------------------------------------------------------------------------------
const W = 220, H = 220, CX = 110, GY = 200;
const T_BODY = 1, T_HEAD = 2, T_LIMB = 3, T_BACK = 4, T_HELD = 5, T_CROWN = 6, T_EYE = 7;

class Cv {
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

interface Shade { hi?: number; lo?: number; on?: number }
const pick = (m: Mat, ls: number, hi: number, lo: number): number => (ls > hi ? m.l : ls < lo ? m.s : m.b);

/** Filled (super)ellipse; taper > 0 makes the top wider than the bottom. */
function ell(cv: Cv, cx: number, cy: number, rx: number, ry: number, m: Mat, tag: number, o: { e?: number; taper?: number } & Shade = {}): void {
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
function rect(cv: Cv, x0: number, y0: number, x1: number, y1: number, m: Mat, tag: number, o: { on?: number; bevel?: boolean } = {}): void {
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

function bres(cv: Cv, x0: number, y0: number, x1: number, y1: number, c: number, tag: number, on = 0): void {
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
function line(cv: Cv, x0: number, y0: number, x1: number, y1: number, w: number, m: Mat, tag: number, o: Shade = {}): void {
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
function poly(cv: Cv, pts: number[][], m: Mat, tag: number, o: Shade = {}): void {
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
function stamp(cv: Cv, art: readonly string[], x: number, y: number, map: Record<string, number>, tag: number, o: { flip?: boolean; noRim?: boolean } = {}): void {
  for (let r = 0; r < art.length; r++) {
    const row = art[r];
    for (let c = 0; c < row.length; c++) {
      const k = row[o.flip ? row.length - 1 - c : c];
      const col = map[k];
      if (col !== undefined) cv.put(x + c, y + r, col, tag, o.noRim ? 1 : 0);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Model: every proportion worked out once per look
// ---------------------------------------------------------------------------------------------------------------------------
type LimbK = 'biped' | 'quad' | 'many' | 'tentacles' | 'none';
interface Model {
  look: MonsterLook;
  S: number; tier: number; // tier 0 (mite) .. 3 (boss)
  P: Pal;
  limbs: LimbK;
  hover: boolean; // floats: ghost, floater
  wisp: boolean; // lower body is a tapering wisp instead of legs
  quad: boolean;
  headKind: MonsterLook['head'];
  legL: number; bodyH: number; bodyW: number; headH: number; headW: number; overlap: number;
  armLen: number; limbW: number; headOff: number;
  taper: number; exp: number;
  v: { ear: number; horn: number; tip: number; pat: number; snout: number; wing: number; brow: number; lean: number };
  motifs: ReadonlySet<Motif>;
  seed: number;
}

interface BuildSpec { leg: number; head: number; bw: number; hw: number; e: number; taper: number }
const BUILD: Record<MonsterLook['build'], BuildSpec> = {
  blob: { leg: 0.14, head: 0.32, bw: 0.78, hw: 0.5, e: 2, taper: 0 },
  tall: { leg: 0.3, head: 0.27, bw: 0.4, hw: 0.36, e: 2.6, taper: 0 },
  squat: { leg: 0.2, head: 0.4, bw: 0.9, hw: 0.62, e: 2.8, taper: -0.1 },
  wedge: { leg: 0.28, head: 0.26, bw: 0.62, hw: 0.34, e: 3, taper: 0.45 },
  round: { leg: 0.16, head: 0.3, bw: 0.82, hw: 0.42, e: 2, taper: -0.05 },
  serpent: { leg: 0, head: 0.28, bw: 0.4, hw: 0.36, e: 2, taper: 0 },
  insect: { leg: 0.3, head: 0.3, bw: 0.85, hw: 0.38, e: 2, taper: 0 },
  floater: { leg: 0.26, head: 0.3, bw: 0.6, hw: 0.4, e: 2, taper: -0.2 },
};
const HEADW: Record<MonsterLook['head'], number> = { round: 1.1, skull: 1.0, beast: 1.15, horned: 1.1, cyclops: 1.05, maw: 1.4, hood: 0.95, helm: 1.0, none: 0 };

function makeModel(look: MonsterLook): Model {
  const S = clamp(ri(Number.isFinite(look.size) ? look.size : 12), 7, 64);
  const tier = look.boss ? 3 : S < 11 ? 0 : S < 18 ? 1 : 2;
  const rnd = mulberry((look.seed | 0) ^ 0x51ed270b);
  const spec = BUILD[look.build] ?? BUILD.blob;
  const stout = clamp(Number.isFinite(look.stout) ? look.stout : 1, 0.7, 1.4);
  const motifs = new Set<Motif>(look.motifs ?? []);
  const ghost = motifs.has('ghost');
  let limbs: LimbK = look.limbs;
  if (look.build === 'insect' && (limbs === 'biped' || limbs === 'quad' || limbs === 'none')) limbs = 'many';
  if (look.build === 'serpent') limbs = 'none';
  const hover = (look.build === 'floater' || ghost) && look.build !== 'serpent';
  let pal = look.palette;
  if (ghost) pal = { ...pal, base: mixc(pal.base, 0xdfe8ff, 0.4), accent: mixc(pal.accent, 0xdfe8ff, 0.2) };
  if (motifs.has('stone')) pal = { ...pal, base: mixc(pal.base, 0x8a8a92, 0.5) };
  if (motifs.has('frost')) pal = { ...pal, base: mixc(pal.base, 0xcfeaff, 0.25) };
  const wisp = (hover && (limbs === 'none' || ghost)) || (look.build === 'floater' && limbs === 'none');
  if (ghost) limbs = 'none';
  const headKind = look.head;
  const headless = headKind === 'none';
  const quad = limbs === 'quad' && look.build !== 'serpent' && look.build !== 'insect';
  let legL = ri(S * spec.leg);
  if (limbs === 'none' && !wisp) legL = 0;
  if (limbs === 'tentacles') legL = Math.max(legL, ri(S * 0.26));
  if (wisp) legL = Math.max(legL, ri(S * 0.28));
  if (limbs === 'many' && look.build !== 'insect') legL = Math.max(legL, ri(S * 0.22));
  if (quad) legL = Math.max(legL, ri(S * 0.2));
  let headH = headless ? 0 : Math.max(3, ri(S * spec.head));
  if (headKind === 'maw') headH = Math.max(3, ri(headH * 0.92));
  const overlap = headless ? 0 : S >= 18 ? 2 : 1;
  legL = clamp(legL, 0, Math.max(0, S - 5 - (headless ? 0 : 0)));
  let bodyH = S - legL - headH + overlap;
  if (look.build === 'insect') bodyH = Math.max(3, S - legL - ri(S * 0.06));
  bodyH = Math.max(3, bodyH);
  const bwScale = look.build === 'insect' ? 1 : 1;
  let bodyW = Math.max(3, ri(S * spec.bw * stout * bwScale));
  if (look.build === 'tall' || look.build === 'wedge' || look.build === 'serpent') bodyW = Math.max(3, ri(bodyW));
  bodyW = Math.min(bodyW, ri(S * 1.5));
  let headW = headless ? 0 : Math.max(3, ri(S * spec.hw * HEADW[headKind] * (0.85 + 0.15 * stout)));
  headW = Math.min(headW, Math.max(3, bodyW + 4));
  if (headKind === 'maw') headW = Math.max(headW, Math.min(ri(headH * 1.5), bodyW + 4));
  const armLen = Math.max(2, ri(S * 0.28));
  const limbW = S < 10 ? 1 : S < 20 ? 2 : S < 36 ? 3 : 4;
  const v = {
    ear: ri(rnd() * 2), horn: ri(rnd() * 3), tip: ri(rnd() * 3), pat: ri(rnd() * 3), snout: ri(rnd() * 2), wing: ri(rnd() * 2), brow: ri(rnd() * 2), lean: rnd(),
  };
  const headOff = headless ? 0 : quad ? ri(bodyW * 0.3) : look.build === 'insect' ? ri(bodyW * 0.32) : look.build === 'serpent' ? 0 : ri(headW * 0.1);
  return {
    look, S, tier, P: makePal(pal), limbs, hover, wisp, quad, headKind, legL, bodyH, bodyW, headH, headW, overlap, armLen, limbW, headOff,
    taper: spec.taper, exp: spec.e, v, motifs, seed: look.seed | 0,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------------------------------------------------------
type Vec = [number, number];
interface Pose {
  up?: number; // body lifted off planted legs (walk bob)
  hover?: number; // everything lifted (floaters)
  crouch?: number; // body lowered, legs compressed
  lean?: number; // upper body shift, forward positive
  hdx?: number; hdy?: number; // head extra offset (dy positive = down)
  gait?: number; // 0..3 walk phase, 4 stand, 5/6 charge splay, 7 rear, 8 stomp, 9 crouch wide
  armR?: Vec; armL?: Vec; // arm directions (unit-ish; multiplied by armLen), y positive = down
  wang?: number; // held-item angle in degrees (0 = forward, -90 = up)
  wmode?: number; // item specific: bow draw (0 rest .. 1 full, -1 released), orb glow, bomb lit
  mouth?: number; // 0 closed, 1 open, 2 wide
  shut?: boolean;
  wing?: number; // 0 down, 1 mid, 2 up
  tail?: number; // -1..1 swing
  tint?: number; // 1 = bright white, 2 = reddish
  stars?: boolean;
  noHeld?: boolean;
  t?: number; // animation tick for flickering parts
  ph?: number; // phase for waving parts
  flare?: boolean; // bigger orb glow
}

// ---------------------------------------------------------------------------------------------------------------------------
// Frame drawing
// ---------------------------------------------------------------------------------------------------------------------------
interface Ctx {
  cv: Cv; m: Model; p: Pose;
  bx: number; // body centre x
  bcy: number; // body centre y (edge)
  brx: number; bry: number; // body radii
  bTop: number; bBot: number; // body top/bottom edge y
  hx: number; hy: number; hrx: number; hry: number; hTop: number; // head centre / radii
  hipH: number;
  shR: Vec; shL: Vec; // shoulders
  handR: Vec; handL: Vec;
  lean: number;
  serp: number[]; // serpent column centre offsets per row from the bottom
  face: { x: number; y: number; w: number }; // where the eyes go
}

function drawMonster(cv: Cv, m: Model, p: Pose): void {
  cv.clear();
  const S = m.S, look = m.look, g = GY;
  const hover = p.hover ?? 0, up = p.up ?? 0, crouch = p.crouch ?? 0;
  const lean = p.lean ?? 0;
  const bh = m.legL === 0 ? Math.max(3, m.bodyH - crouch) : m.bodyH;
  const legShrink = m.legL === 0 ? 0 : Math.min(crouch, Math.max(0, m.legL - 1));
  const hipH = m.legL - legShrink + up + hover;
  const bx = CX + ri(lean * 0.55);
  const brx = (m.bodyW * (m.quad ? 1.2 : 1)) / 2, bry = bh / 2;
  const bcy = g - (hipH + bh / 2);
  const bTop = g - (hipH + bh), bBot = g - hipH;
  const qdrop = m.quad ? ri(bh * 0.14) : 0;
  const hrx = m.headW / 2, hry = m.headH / 2;
  const hx = bx + ri(lean * 0.45) + m.headOff + (p.hdx ?? 0);
  let hy = g - (hipH + bh - m.overlap + m.headH / 2) + qdrop + (p.hdy ?? 0);
  if (look.build === 'insect') hy = bTop + m.headH * 0.5 + 0.5 + (p.hdy ?? 0);
  const hTop = hy - hry;
  const armLen = m.armLen;
  const shY = bTop + bh * 0.22;
  const shR: Vec = [bx + brx * 0.78, shY], shL: Vec = [bx - brx * 0.78, shY];
  const aR = p.armR ?? [0.3, 0.95], aL = p.armL ?? [-0.3, 0.95];
  const reach = m.look.arms === 0 ? 0.55 : 1;
  const handR: Vec = [shR[0] + aR[0] * armLen * reach, shR[1] + aR[1] * armLen * reach];
  const handL: Vec = [shL[0] + aL[0] * armLen, shL[1] + aL[1] * armLen];
  const ctx: Ctx = { cv, m, p, bx, bcy, brx, bry, bTop, bBot, hx, hy, hrx, hry, hTop, hipH, shR, shL, handR, handL, lean, serp: [], face: { x: hx, y: hy, w: m.headW } };

  drawBack(ctx);
  drawLimbs(ctx, true);
  drawBody(ctx);
  drawLimbs(ctx, false);
  if (m.headKind !== 'none') drawHead(ctx);
  drawCrown(ctx);
  drawMotifs(ctx);
  drawFace(ctx);
  drawArms(ctx);
  if (!p.noHeld) drawHeld(ctx);
  drawFlourish(ctx);
  if (p.tint) tintFrame(cv, m, p.tint);
}

// ----------------------------------------------------------- body
function drawBody(c: Ctx): void {
  const { cv, m } = c;
  const P = m.P;
  if (m.look.build === 'serpent') { drawSerpent(c); return; }
  const o = { e: m.exp, taper: m.taper };
  ell(cv, c.bx, c.bcy, c.brx, c.bry, P.base, T_BODY, o);
  if (m.hover && m.wisp) drawWisp(c);
  // belly / stripes / spots from the accent colour, clipped to the body
  const pat = m.v.pat;
  if (c.bry >= 2.5 && c.brx >= 2.5) {
    if (pat === 0) ell(cv, c.bx + 1, c.bcy + c.bry * 0.3, c.brx * 0.5, c.bry * 0.55, P.acc, T_BODY, { on: T_BODY, e: m.exp });
    else if (pat === 1) {
      const n = c.bry > 7 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const y = ri(c.bTop + c.bry * (0.7 + (i * 1.0) / n * 1.2));
        for (let x = ri(c.bx - c.brx); x < c.bx + c.brx; x++) cv.put(x, y, P.acc.b, T_BODY, 0, T_BODY);
      }
    } else {
      const n = c.bry > 6 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const sx = ri(c.bx + (hash2(i, 3, m.seed) - 0.5) * c.brx * 1.3), sy = ri(c.bcy + (hash2(i, 9, m.seed) - 0.45) * c.bry * 1.2);
        rect(cv, sx, sy, sx + (c.bry > 6 ? 2 : 1), sy + (c.bry > 6 ? 2 : 1), P.acc, T_BODY, { on: T_BODY, bevel: false });
      }
    }
  }
  if (m.tier === 3) {
    // a boss wears a belt and shoulder plates
    const by = ri(c.bTop + c.bry * 1.35);
    rect(cv, c.bx - c.brx + 1, by, c.bx + c.brx - 1, by + 2, P.met, T_BODY, { on: T_BODY });
    cv.put(ri(c.bx), by, P.acc.l, T_BODY, 0, T_BODY);
  }
}

/** Serpent column: rows from the bottom up; a coil mound at the base, a neck above it, undulating. */
function drawSerpent(c: Ctx): void {
  const { cv, m } = c;
  const P = m.P, n = m.bodyH, ph = (c.p.ph ?? 0) * 1.1;
  const hwNeck = Math.max(1.5, m.bodyW * 0.3), hwBase = Math.max(2.5, m.bodyW * 0.72);
  c.serp = [];
  for (let k = 0; k < n; k++) {
    const t = k / Math.max(1, n - 1);
    const coil = Math.pow(Math.max(0, (0.38 - t) / 0.38), 1.3);
    let hw = hwNeck + (hwBase - hwNeck) * coil;
    if (k === 0) hw *= 0.82;
    const amp = (m.bodyW * 0.28 + 0.4) * Math.pow(t, 0.8);
    const off = ri(amp * Math.sin(ph + t * 6.2));
    c.serp.push(off);
    const cx = c.bx + off + ri(c.lean * t);
    const y = ri(GY - (c.hipH + k + 1));
    const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    for (let x = x0; x < x1; x++) {
      const pos = (x - x0 + 0.5) / Math.max(1, x1 - x0);
      let col = pos < 0.3 ? P.base.l : pos > 0.72 ? P.base.s : P.base.b;
      if (x1 - x0 <= 2) col = pos < 0.5 ? P.base.b : P.base.s;
      // belly scutes: accent bands on the lit front
      if (m.v.pat !== 2 && (k >> 1) % 2 === 0 && pos > 0.35 && pos < 0.8 && x1 - x0 >= 4) col = P.acc.b;
      cv.put(x, y, col, T_BODY);
    }
  }
}

/** Tapering ghost / floater tail, drawn below the body. */
function drawWisp(c: Ctx): void {
  const { cv, m } = c;
  const P = m.P, L = ri(c.hipH);
  if (L < 1) return;
  const ghost = m.motifs.has('ghost');
  const strands = ghost ? [[-0.3, 1.0], [0, 0.78], [0.3, 0.9]] : [[0, 1]];
  const ph = (c.p.ph ?? 0);
  for (const [fx, fl] of strands) {
    const len = Math.max(2, ri(L * fl));
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const w = Math.max(1, ri((ghost ? c.brx * 0.34 : c.brx * 0.8) * Math.pow(1 - t, 0.9)));
      const sway = ri(Math.sin(ph * 1.2 + t * 4 + fx * 3) * (1 + c.brx * 0.15) * t);
      const cx = c.bx + fx * c.brx * 1.6 + sway;
      const y = ri(c.bBot + k);
      for (let x = Math.round(cx - w / 2); x < Math.round(cx - w / 2) + w; x++) {
        if (!c.cv.has(x, y)) cv.put(x, y, x === Math.round(cx - w / 2) && w > 1 ? P.base.l : k > len * 0.5 ? P.base.s : P.base.b, T_BODY);
      }
    }
  }
}

// ----------------------------------------------------------- limbs (legs, many legs, tentacles)
const LEGTAB: Vec[] = [[1, 0], [0, 0], [-1, 0], [0, 1]]; // [stride units, lift] per walk phase
function legPose(gait: number, parity: number, st: number): Vec {
  if (gait >= 0 && gait <= 3) {
    const e = LEGTAB[(gait + 2 * parity) % 4];
    return [e[0] * st, e[1]];
  }
  switch (gait) {
    case 5: return parity === 0 ? [2 * st, 1] : [-2 * st, 0];
    case 6: return parity === 0 ? [-2 * st, 0] : [2 * st, 1];
    case 7: return parity === 0 ? [st, 2] : [-st, 0];
    case 8: return parity === 0 ? [st, 0] : [-st, 0];
    case 9: return parity === 0 ? [st * 1.2, 0] : [-st * 1.2, 0];
    default: return [0, 0];
  }
}

function drawLimbs(c: Ctx, behind: boolean): void {
  const { cv, m, p } = c;
  const P = m.P;
  if (m.limbs === 'none') return;
  const gait = p.gait ?? 4;
  const st = Math.max(1, ri(m.S * 0.1));
  const hip = c.bBot - 1; // edge y of the hip, just inside the body
  const hov = p.hover ?? 0;
  const w = m.limbW;
  const lmat = P.base;
  const dark = { l: P.base.b, b: P.base.s, s: mixc(P.base.s, 0x08040f, 0.35) };
  if (m.limbs === 'biped' || m.limbs === 'quad') {
    const xs = m.limbs === 'quad' ? [-0.66, -0.26, 0.26, 0.66] : [-0.3, 0.3];
    xs.forEach((fx, i) => {
      const far = m.limbs === 'quad' ? i === 1 || i === 3 : i === 0;
      if (far !== behind) return;
      const parity = m.limbs === 'quad' ? (i === 0 || i === 3 ? 0 : 1) : i === 1 ? 0 : 1;
      const [dx, lift] = legPose(gait, parity, st);
      const hxp = c.bx + (m.limbs === 'quad' ? fx * c.brx : fx * c.brx * 1.0);
      const footY = GY - hov - lift;
      const fx2 = hxp + dx;
      const mat = far ? dark : lmat;
      // thigh from the hip to the foot; planted feet get a toe
      line(cv, hxp, hip, fx2, footY - 1, w, mat, T_LIMB);
      const fl = Math.max(1, ri(w * 0.9));
      rect(cv, fx2 - w / 2, footY - Math.max(1, ri(w * 0.5)), fx2 + w / 2 + fl, footY, far ? dark : P.base, T_LIMB);
    });
    return;
  }
  if (m.limbs === 'many') {
    if (!behind) return;
    const n = m.S < 14 ? 6 : 8;
    const half = n / 2;
    for (let i = 0; i < n; i++) {
      const side = i < half ? -1 : 1;
      const j = i % half;
      const hxp = c.bx + side * c.brx * (0.2 + (0.5 * j) / Math.max(1, half - 1));
      const [dx, lift] = legPose(gait, j % 2, st);
      const reachX = m.legL * (0.75 + 0.2 * (j / half)) + c.brx * 0.1;
      const kneeX = hxp + side * reachX * 0.7, kneeY = hip - m.legL * 0.1 - lift * 0.3 - m.legL * 0.3 + 1;
      const footX = hxp + side * (reachX * 1.05) + (side * dx) * 0.5 + dx * 0.5, footY = GY - hov - lift;
      const mat = j % 2 === 0 ? lmat : dark;
      line(cv, hxp, hip + 1, kneeX, kneeY, Math.max(1, w - 1), mat, T_LIMB);
      line(cv, kneeX, kneeY, footX, footY - 1, Math.max(1, w - 1), mat, T_LIMB);
    }
    return;
  }
  if (m.limbs === 'tentacles') {
    if (!behind) return;
    const n: number = m.S < 12 ? 3 : m.S < 22 ? 4 : 5;
    const ph = p.ph ?? 0;
    for (let i = 0; i < n; i++) {
      const fx = n === 1 ? 0 : -0.8 + (1.6 * i) / (n - 1);
      const L = Math.max(3, ri(GY - hov - hip));
      for (let k = 0; k < L; k++) {
        const t = k / L;
        const sx = Math.sin(ph * 1.5 + i * 1.3 + t * 5) * (0.8 + m.S * 0.05) * (0.3 + t);
        const rr = Math.max(0.5, (w * 0.5 + 0.6) * (1 - t * 0.7));
        const cxp = c.bx + fx * c.brx * 0.8 + sx;
        const cyp = hip + k + 0.5;
        ell(cv, cxp, cyp, rr, 1, i % 2 ? dark : lmat, T_LIMB);
      }
    }
  }
}

// ----------------------------------------------------------- arms
function drawArm(c: Ctx, sh: Vec, hand: Vec, far: boolean): void {
  const { cv, m } = c;
  const w = Math.max(1, m.limbW - (m.S < 14 ? 0 : 1));
  const mat = far ? { l: m.P.base.b, b: m.P.base.s, s: m.P.base.s } : m.P.base;
  const len = Math.hypot(hand[0] - sh[0], hand[1] - sh[1]);
  if (len > 7) {
    // a slight elbow bend, down and back
    const mx = (sh[0] + hand[0]) / 2 - 0.12 * (hand[1] - sh[1]) * 0.3 - 1, my = (sh[1] + hand[1]) / 2 + 0.12 * len * 0.4;
    line(cv, sh[0], sh[1], mx, my, w, mat, T_LIMB);
    line(cv, mx, my, hand[0], hand[1], w, mat, T_LIMB);
  } else line(cv, sh[0], sh[1], hand[0], hand[1], w, mat, T_LIMB);
  // hand: a fist, or claws on bigger beasts
  const r = Math.max(1, ri(w * 0.7));
  ell(cv, hand[0], hand[1], r, r, far ? mat : m.P.base, T_LIMB, { hi: 0.7, lo: -0.6 });
}

function drawArms(c: Ctx): void {
  const { m } = c;
  if (m.look.arms >= 2) drawArm(c, c.shL, c.handL, true);
  if (m.look.arms >= 1) drawArm(c, c.shR, c.handR, false);
}

// ----------------------------------------------------------- head
function drawHead(c: Ctx): void {
  const { cv, m, hx, hy, hrx, hry } = c;
  const P = m.P;
  let fy = hy - hry * 0.12;
  let fx = hx + (hrx > 3 ? 1 : 0);
  let fw = m.headW - 1;
  switch (m.headKind) {
    case 'round':
    case 'cyclops':
    case 'horned':
      ell(cv, hx, hy, hrx, hry, P.base, T_HEAD);
      break;
    case 'skull': {
      ell(cv, hx, hy - hry * 0.14, hrx, hry * 0.86, P.bone, T_HEAD);
      if (hry >= 3) rect(cv, hx - hrx * 0.58, hy + hry * 0.4, hx + hrx * 0.58, hy + hry, P.bone, T_HEAD);
      fy = hy - hry * 0.2;
      break;
    }
    case 'beast': {
      ell(cv, hx - hrx * 0.1, hy, hrx * 0.85, hry, P.base, T_HEAD);
      const sm = matOf(mixc(P.base.b, 0xfff0d0, 0.28));
      const sl = m.v.snout ? 0.62 : 0.5;
      ell(cv, hx + hrx * 0.5, hy + hry * 0.3, hrx * sl, hry * 0.5, sm, T_HEAD);
      cv.put(ri(hx + hrx * (0.5 + sl) - 1), ri(hy + hry * 0.12), P.ink, T_EYE);
      fx = hx + hrx * 0.1; fw = m.headW * 0.6; fy = hy - hry * 0.2;
      break;
    }
    case 'maw': {
      ell(cv, hx, hy, hrx, hry * 0.97, P.base, T_HEAD, { e: 2.4 });
      fy = hy - hry * 0.52; fw = m.headW - 2;
      break;
    }
    case 'hood': {
      const peak = Math.max(2, ri(hry * 0.8));
      poly(cv, [[hx - hrx, hy], [hx - hrx * 0.2, hy - hry - peak], [hx + hrx * 0.9, hy - hry * 0.9], [hx + hrx, hy + hry * 0.2], [hx + hrx * 0.7, hy + hry], [hx - hrx * 0.8, hy + hry]], P.acc, T_HEAD);
      ell(cv, hx, hy, hrx * 0.98, hry, P.acc, T_HEAD);
      // the face is a void with only eyes in it
      ell(cv, hx + 1, hy + hry * 0.1, hrx * 0.62, hry * 0.62, flat(P.ink), T_EYE, { hi: 9, lo: -9 });
      fy = hy; fx = hx + 1; fw = hrx * 1.1;
      break;
    }
    case 'helm': {
      ell(cv, hx, hy - hry * 0.1, hrx, hry * 0.92, P.met, T_HEAD);
      rect(cv, hx - hrx * 0.82, hy + hry * 0.1, hx + hrx * 0.82, hy + hry, P.met, T_HEAD);
      // visor slit and a nose bar
      const sy = ri(hy - hry * 0.15);
      for (let x = ri(hx - hrx * 0.7); x < ri(hx + hrx * 0.8); x++) cv.put(x, sy, P.ink, T_EYE);
      if (hry >= 4) for (let y = sy; y < ri(hy + hry * 0.6); y++) cv.put(ri(hx + 1), y, P.met.s, T_EYE);
      if (m.tier >= 2) { cv.put(ri(hx - hrx * 0.7), ri(hy + hry * 0.5), P.white, T_HEAD); cv.put(ri(hx + hrx * 0.6), ri(hy + hry * 0.5), P.white, T_HEAD); }
      fy = sy; fw = m.headW - 3;
      break;
    }
    default: break;
  }
  c.face = { x: fx, y: fy, w: fw };
}

/** Eyes, brows, mouth and teeth. Drawn over head or (headless) body. */
function drawFace(c: Ctx): void {
  const { cv, m, p } = c;
  const P = m.P;
  const hk = m.headKind;
  let { x: fx, y: fy, w: fw } = c.face;
  if (hk === 'none') {
    fx = c.bx + 1 + ri(c.lean * 0.4); fy = c.bTop + c.bry * 0.55; fw = m.bodyW * 0.7;
    c.face = { x: fx, y: fy, w: fw };
  }
  const hw = hk === 'none' ? m.bodyW : m.headW;
  const es = m.tier === 3 ? 3 : hw >= 9 ? 2 : 1;
  const shut = !!p.shut;
  const n = clamp(ri(m.look.eyes), 1, 4);
  const hh = hk === 'none' ? m.bodyH : m.headH;
  const brow = (hk === 'horned' || ((hk === 'beast' || hk === 'round') && m.v.brow === 1)) && hw >= 6;
  if (hk === 'cyclops') {
    const r = Math.max(1.5, Math.min(hw * 0.28, hh * 0.3));
    if (shut) { for (let x = ri(fx - r); x < ri(fx + r); x++) cv.put(x, ri(fy), P.ink, T_EYE); }
    else {
      ell(cv, fx, fy, r, r, flat(P.white), T_EYE, { hi: 9, lo: -9 });
      ell(cv, fx + 0.5, fy, r * 0.62, r * 0.62, flat(P.eye), T_EYE, { hi: 9, lo: -9 });
      if (r >= 2) cv.put(ri(fx + 0.5 - r * 0.2), ri(fy), P.ink, T_EYE);
      cv.put(ri(fx - r * 0.3), ri(fy - r * 0.5), P.eyeHi, T_EYE, 1);
    }
  } else {
    const rows = n >= 2 && n * (es + 1) - 1 > fw && hh >= 7 ? 2 : 1;
    const counts = rows === 2 ? [Math.ceil(n / 2), Math.floor(n / 2)] : [n];
    counts.forEach((cnt, r) => {
      const gap = clamp(Math.floor((fw - cnt * es) / cnt), 1, es + 2);
      const tw = cnt * es + (cnt - 1) * gap;
      const y0 = ri(fy - es / 2 + r * (es + 1));
      for (let i = 0; i < cnt; i++) {
        const x0 = ri(fx - tw / 2 + i * (es + gap));
        if (shut) { for (let k = 0; k < es; k++) cv.put(x0 + k, y0 + es - 1, P.ink, T_EYE); continue; }
        if (hk === 'skull') rect(cv, x0 - 1, y0 - 1, x0 + es + 1, y0 + es + 1, flat(P.ink), T_EYE, { bevel: false });
        if (es === 1) cv.put(x0, y0, P.eyeHi, T_EYE, 1);
        else if (es === 2) stamp(cv, ['HE', 'EE'], x0, y0, { H: P.eyeHi, E: P.eye }, T_EYE, { noRim: true });
        else stamp(cv, ['HEE', 'EEE', 'oEE'], x0, y0, { H: P.eyeHi, E: P.eye, o: P.eyeLo }, T_EYE, { noRim: true });
        if (brow) for (let k = 0; k < es; k++) cv.put(x0 + k, y0 - 1, P.ink, T_EYE);
      }
    });
  }
  // mouth
  const mouth = p.mouth ?? 0;
  const teeth = m.look.teeth;
  if (hk === 'maw') {
    const mw = Math.max(4, ri(m.headW * 0.84));
    const mh = Math.max(2, ri(m.headH * (mouth ? 0.5 : 0.36)));
    const my = ri(c.hy + c.hry - mh - 0.5);
    const mx = ri(c.hx - mw / 2 + 0.5);
    rect(cv, mx, my, mx + mw, my + mh, flat(P.ink), T_EYE, { bevel: false });
    for (let x = mx; x < mx + mw; x += 2) {
      cv.put(x, my, P.white, T_EYE, 1);
      if (mh >= 3 || mouth) cv.put(Math.min(x + 1, mx + mw - 1), my + mh - 1, P.white, T_EYE, 1);
    }
    if (mh >= 3) rect(cv, mx + 1, my + mh - 2, mx + mw - 1, my + mh - 1, P.acc, T_EYE, { bevel: false });
    return;
  }
  if (hk === 'cyclops' || hk === 'round' || hk === 'beast' || hk === 'horned' || hk === 'skull' || hk === 'none') {
    const base = hk === 'none' ? c.bTop + c.bry * 1.0 : hk === 'beast' ? c.hy + c.hry * 0.55 : c.hy + c.hry * 0.5;
    if (hw < 5 && !mouth) return;
    if (hk === 'none' && !teeth && !mouth) return;
    const mw = Math.max(2, ri(hw * (hk === 'beast' ? 0.34 : 0.46)));
    const mx = ri((hk === 'beast' ? c.hx + c.hrx * 0.35 : fx) - mw / 2);
    const my = ri(Math.min(base, hk === 'none' ? base : c.hy + c.hry - 1.5));
    if (mouth) {
      const mh = mouth >= 2 ? Math.max(2, ri(hh * 0.28)) : Math.max(1, ri(hh * 0.18));
      rect(cv, mx, my, mx + mw, my + mh, flat(P.ink), T_EYE, { bevel: false });
      if (teeth || mouth >= 2) for (let x = mx; x < mx + mw; x += 2) cv.put(x, my, P.white, T_EYE, 1);
      if (mh >= 3) rect(cv, mx + 1, my + mh - 1, mx + mw - 1, my + mh, P.acc, T_EYE, { bevel: false });
    } else {
      for (let x = mx; x < mx + mw; x++) cv.put(x, my, P.ink, T_EYE);
      if (teeth) { cv.put(mx, my + 1, P.white, T_EYE, 1); if (mw >= 3) cv.put(mx + mw - 1, my + 1, P.white, T_EYE, 1); }
    }
  }
}

// ----------------------------------------------------------- crowns
function drawCrown(c: Ctx): void {
  const { cv, m, hx, hrx, hry, hTop } = c;
  const P = m.P;
  const kind = m.look.crown;
  if (kind === 'none') return;
  const hasHead = m.headKind !== 'none';
  // headless creatures wear the crown on top of the body
  const top = hasHead ? hTop : c.bTop, cx = hasHead ? hx : c.bx, rx = hasHead ? hrx : Math.min(c.brx, m.bodyW * 0.4), ry = hasHead ? hry : c.bry * 0.6;
  const L = Math.max(2, ri(m.S * (m.tier === 3 ? 0.18 : 0.22)));
  const w1 = Math.max(1, ri(rx * 0.3));
  if (m.headKind === 'horned' && kind !== 'horns') {
    for (const s of [-1, 1]) line(cv, cx + s * rx * 0.6, top + ry * 0.4, cx + s * (rx + 1), top - Math.max(1, ry * 0.2), Math.max(1, w1 - 1), P.met, T_CROWN);
  }
  switch (kind) {
    case 'horns': {
      for (const s of [-1, 1]) {
        const bx0 = cx + s * rx * 0.55, by0 = top + ry * 0.45;
        let p1: Vec, p2: Vec;
        if (m.v.horn === 0) { p1 = [bx0 + s * L * 0.45, by0 - L * 0.7]; p2 = [bx0 + s * L * 0.8, by0 - L * 1.2]; }
        else if (m.v.horn === 1) { p1 = [bx0 + s * L * 1.0, by0 - L * 0.15]; p2 = [bx0 + s * L * 1.25, by0 - L * 0.95]; }
        else { p1 = [bx0 + s * L * 0.1, by0 - L * 0.85]; p2 = [bx0 - s * L * 0.1, by0 - L * 1.3]; }
        line(cv, bx0, by0, p1[0], p1[1], w1 + (m.tier > 1 ? 1 : 0), P.met, T_CROWN);
        line(cv, p1[0], p1[1], p2[0], p2[1], Math.max(1, w1 - 1), P.met, T_CROWN);
      }
      break;
    }
    case 'antlers': {
      for (const s of [-1, 1]) {
        const bx0 = cx + s * rx * 0.5, by0 = top + ry * 0.3;
        const tx = bx0 + s * L * 0.6, ty = by0 - L * 1.25;
        line(cv, bx0, by0, tx, ty, Math.max(1, w1 - 1), P.bone, T_CROWN);
        const n = L >= 5 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const t = 0.3 + (0.6 * i) / n;
          const px = bx0 + (tx - bx0) * t, py = by0 + (ty - by0) * t;
          line(cv, px, py, px + s * L * (i % 2 ? 0.55 : 0.4), py - L * 0.5, 1, P.bone, T_CROWN);
        }
        line(cv, tx, ty, tx + s * L * 0.2, ty - L * 0.35, 1, P.bone, T_CROWN);
      }
      break;
    }
    case 'ears': {
      for (const s of [-1, 1]) {
        if (m.v.ear === 0) {
          const el = L * 1.1;
          poly(cv, [[cx + s * rx * 0.55, top + ry * 0.2], [cx + s * (rx + el), top - el * 0.35], [cx + s * rx * 0.95, top + ry * 0.9]], P.base, T_CROWN);
          if (el >= 4) bres(cv, cx + s * (rx * 0.9), top + ry * 0.5, cx + s * (rx + el * 0.6), top + ry * 0.05, P.acc.b, T_CROWN, T_CROWN);
        } else {
          const er = Math.max(1.5, L * 0.6);
          ell(cv, cx + s * rx * 0.7, top + 0.5, er, er, P.base, T_CROWN);
          if (er >= 2.5) ell(cv, cx + s * rx * 0.7, top + 0.8, er * 0.55, er * 0.55, P.acc, T_CROWN, { on: T_CROWN });
        }
      }
      break;
    }
    case 'crest': {
      const n: number = rx >= 5 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const x = cx + t * rx * 1.5 - 0.5;
        const hgt = L * (1.3 - Math.abs(t) * 0.9) * (i % 2 ? 0.85 : 1);
        poly(cv, [[x - 1, top + 1.5], [x + 0.5, top - hgt], [x + 2, top + 1.5]], P.acc, T_CROWN);
      }
      break;
    }
    case 'halo': {
      const hr = Math.max(2, rx * 0.95), hq = Math.max(1, ri(L * 0.28) + 1);
      const hyy = top - hq - 1;
      for (let y = ri(hyy - hq); y <= ri(hyy + hq); y++) for (let x = ri(cx - hr); x <= ri(cx + hr); x++) {
        const nx = (x + 0.5 - cx) / hr, ny = (y + 0.5 - hyy) / hq;
        const d = nx * nx + ny * ny, d2 = (nx * nx) / Math.pow(1 - 1 / hr, 2) + (ny * ny) / Math.pow(Math.max(0.2, 1 - 1 / hq), 2);
        if (d <= 1.05 && d2 >= 0.95) cv.put(x, y, ny < 0 ? P.met.l : P.met.b, T_CROWN, 1);
      }
      break;
    }
    case 'crown': {
      const cw = Math.max(3, ri(rx * 1.6)), x0 = ri(cx - cw / 2);
      const bh = Math.max(1, ri(ry * 0.3));
      rect(cv, x0, top, x0 + cw, top + bh, P.met, T_CROWN);
      const np = cw >= 8 ? 3 : 2;
      const pl = Math.max(1, ri(L * 0.4));
      for (let i = 0; i < np; i++) {
        const px = ri(x0 + ((cw - 1) * i) / (np - 1));
        for (let k = 1; k <= pl; k++) cv.put(px, ri(top) - k, k === pl ? P.met.l : P.met.b, T_CROWN);
      }
      if (cw >= 5) cv.put(ri(cx + 1), ri(top), P.acc.l, T_CROWN, 1);
      break;
    }
    case 'antenna': {
      for (const s of [-1, 1]) {
        const bx0 = cx + s * rx * 0.4, tx = cx + s * (rx * 0.9 + L * 0.2), ty = top - L * 1.1;
        line(cv, bx0, top + 1, tx, ty, 1, P.dark, T_CROWN);
        ell(cv, tx, ty - 0.5, Math.max(1, L * 0.25), Math.max(1, L * 0.25), P.acc, T_CROWN, { hi: 0.4 });
      }
      break;
    }
    default: break;
  }
}

// ----------------------------------------------------------- things on the back
function drawBack(c: Ctx): void {
  const { cv, m, p } = c;
  const P = m.P, S = m.S;
  const kind = m.look.back;
  const wing = p.wing ?? 1, ph = p.ph ?? 0, tail = p.tail ?? 0;
  switch (kind) {
    case 'wings': {
      const span = Math.max(4, ri(S * (m.tier === 3 ? 0.5 : 0.48)));
      for (const s of [-1, 1]) {
        const bxs = c.bx + s * c.brx * 0.45, bys = c.bTop + c.bry * 0.5;
        const tipDir: Vec = wing === 2 ? [0.7, -0.9] : wing === 1 ? [1, -0.35] : [0.8, 0.45];
        const tip: Vec = [bxs + s * span * tipDir[0], Math.min(GY - 2, bys + span * tipDir[1])];
        if (m.v.wing === 0) {
          const drop: Vec = [tip[0] - s * span * 0.2, tip[1] + span * 0.62];
          const mid: Vec = [bxs + s * span * 0.62, (drop[1] + bys) / 2 + span * 0.3];
          poly(cv, [[bxs, bys - 1], tip, drop, [(drop[0] + mid[0]) / 2, drop[1] - span * 0.1], mid, [bxs + s * span * 0.2, bys + span * 0.55], [bxs, bys + span * 0.5]], P.acc, T_BACK);
          line(cv, bxs, bys, tip[0], tip[1], Math.max(1, m.limbW - 1), P.base, T_BACK);
          line(cv, bxs, bys + 1, drop[0], drop[1] - 1, 1, P.base, T_BACK);
        } else {
          for (let i = 0; i < 3; i++) {
            const k = (i - 1) * span * 0.32;
            const mat = i === 1 ? P.acc : { l: P.acc.b, b: P.acc.s, s: P.acc.s };
            line(cv, bxs, bys + 1, tip[0] - s * (i === 2 ? span * 0.15 : 0), tip[1] + k * (wing === 0 ? 0.6 : 1), Math.max(2, ri(span * 0.2)), mat, T_BACK);
          }
        }
      }
      break;
    }
    case 'tail': {
      const L = Math.max(4, ri(S * 0.5));
      const x0 = c.bx - c.brx * 0.7, y0 = c.bBot - c.bry * 0.6;
      const r0 = Math.max(1, m.limbW * 0.5 + (m.tier > 1 ? 0.5 : 0));
      let lx = x0, ly = y0;
      const N = Math.max(4, L);
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        lx = x0 - t * L * 0.95;
        ly = y0 - t * t * L * 0.5 + tail * Math.sin(t * 3.1) * (1 + L * 0.12) + t * 1.2;
        const lr = Math.max(0.6, r0 * (1 - t * 0.7));
        ell(cv, lx, ly, lr, lr, P.base, T_BACK, { hi: 0.5, lo: -0.4 });
      }
      const tr = Math.max(1.2, r0 * 0.9);
      if (m.v.tip === 0 && m.tier > 0) poly(cv, [[lx + 1, ly], [lx - tr * 1.2, ly - tr * 1.6], [lx - tr * 2.6, ly], [lx - tr * 1.2, ly + tr * 1.6]], P.met, T_BACK);
      else if (m.v.tip === 1) ell(cv, lx - 1, ly, tr * 1.2, tr * 1.2, P.acc, T_BACK);
      else if (m.tier > 0) poly(cv, [[lx + 1, ly], [lx - tr * 2.2, ly - tr * 2], [lx - tr * 1.4, ly], [lx - tr * 2.2, ly + tr * 1.6]], P.acc, T_BACK);
      break;
    }
    case 'shell': {
      const ex = Math.max(2, ri(S * 0.1));
      const sm = matOf(mixc(P.acc.b, P.base.b, 0.25));
      const cxs = c.bx - 1, cys = c.bcy - c.bry * 0.18 - 1, rxs = c.brx + ex, rys = c.bry + ex;
      ell(cv, cxs, cys, rxs, rys, sm, T_BACK);
      const n = rxs > 8 ? 3 : rxs > 4 ? 2 : 1;
      for (let i = 1; i <= n; i++) {
        const fx = cxs + (-rxs + (2 * rxs * i) / (n + 1)) * 0.95;
        bres(cv, fx, cys - rys * 0.7, fx + (fx > cxs ? 1 : -1) * 0.5, cys + rys * 0.6, sm.s, T_BACK, T_BACK);
      }
      if (rys >= 5) for (let x = ri(cxs - rxs * 0.8); x < cxs + rxs * 0.8; x++) cv.put(x, ri(cys - rys * 0.1), sm.s, T_BACK, 0, T_BACK);
      break;
    }
    case 'spikes': {
      const n = m.tier >= 2 ? 5 : 3;
      const sl = Math.max(2, ri(S * 0.17));
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * 0.95 + (Math.PI * 0.7 * i) / Math.max(1, n - 1);
        const px = c.bx + Math.cos(a) * c.brx * 0.95, py = c.bcy + Math.sin(a) * c.bry * 0.95;
        const nx = Math.cos(a), ny = Math.sin(a), tx = -ny, ty = nx;
        const wd = Math.max(1, sl * 0.4);
        poly(cv, [[px - tx * wd, py - ty * wd], [px + nx * sl, py + ny * sl], [px + tx * wd, py + ty * wd], [px - nx * 1.5, py - ny * 1.5]], P.met, T_BACK);
      }
      break;
    }
    case 'cape': {
      const topY = c.bTop + c.bry * 0.4, botY = c.bBot + Math.min(m.legL * 0.5, m.S * 0.15) + 1;
      const sway = Math.round(tail * 1.2);
      poly(cv, [[c.bx - c.brx * 0.85, topY], [c.bx + c.brx * 0.8, topY], [c.bx + c.brx * 1.15 + sway, botY], [c.bx - c.brx * 1.2 - 1 + sway, botY]], P.acc, T_BACK);
      for (let x = ri(c.bx - c.brx * 1.15); x < c.bx + c.brx * 1.1; x++) cv.put(x + sway, ri(botY) - 1, P.acc.s, T_BACK, 0, T_BACK);
      break;
    }
    case 'tentacles': {
      const n = m.tier >= 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const s = i % 2 ? 1 : -1;
        const x0 = c.bx + s * c.brx * (0.3 + 0.3 * (i >> 1)), y0 = c.bTop + c.bry * 0.5;
        const L = Math.max(4, ri(S * 0.55));
        for (let k = 0; k <= L; k++) {
          const t = k / L;
          const x = x0 + s * t * L * 0.6 + Math.sin(ph * 1.6 + i * 2 + t * 5) * (1 + L * 0.1) * t;
          const y = y0 - t * L * 0.9 + t * t * L * 0.2;
          const r = Math.max(0.6, (m.limbW * 0.5 + 0.4) * (1 - t * 0.75));
          ell(cv, x, y, r, r, P.acc, T_BACK, { hi: 0.5 });
        }
      }
      break;
    }
    case 'fins': {
      const fl = Math.max(3, ri(S * 0.34));
      poly(cv, [[c.bx - c.brx * 0.1, c.bTop + c.bry * 0.7], [c.bx - c.brx * 0.9, c.bTop - fl * 0.6], [c.bx - c.brx * 0.15, c.bTop - fl * 0.2], [c.bx + c.brx * 0.2, c.bTop - fl * 0.55], [c.bx + c.brx * 0.35, c.bTop + c.bry * 0.5]], P.acc, T_BACK);
      for (const s of [-1, 1]) {
        const x0 = c.bx + s * (c.brx - 1), y0 = c.bcy;
        poly(cv, [[x0, y0 - c.bry * 0.35], [x0 + s * fl * 0.9, y0 - c.bry * 0.7], [x0 + s * fl * 0.55, y0], [x0, y0 + c.bry * 0.4]], P.acc, T_BACK);
      }
      break;
    }
    case 'flame': {
      const fh = Math.max(3, ri(S * 0.34));
      const t = p.t ?? 0;
      for (let i = 0; i < 3; i++) {
        const x = c.bx + (i - 1) * c.brx * 0.75 - 0.5;
        const h = fh * (i === 1 ? 1 : 0.7) + ((t + i) % 2 ? 1 : 0);
        const y = c.bTop + 2;
        const sway = (t + i) % 2 ? 1 : -1;
        poly(cv, [[x - 1.5, y], [x + sway * 0.8, y - h], [x + 2.5, y]], flat(0xe2461e), T_BACK, { hi: 9, lo: -9 });
        poly(cv, [[x - 0.5, y], [x + sway * 0.5 + 0.5, y - h * 0.65], [x + 1.5, y]], flat(0xff9a2a), T_BACK, { hi: 9, lo: -9 });
        if (h >= 5) poly(cv, [[x, y], [x + 0.5, y - h * 0.35], [x + 1, y]], flat(0xffe070), T_BACK, { hi: 9, lo: -9 });
      }
      break;
    }
    default: break;
  }
}

// ----------------------------------------------------------- held items (drawn at one of a few raster angles, never rotated art)
function drawHeld(c: Ctx): void {
  const { cv, m, p } = c;
  const kind = m.look.held;
  if (kind === 'none') return;
  const P = m.P, S = m.S;
  const [hx, hy] = c.handR;
  const ang = ((p.wang ?? defaultAngle(kind)) * Math.PI) / 180;
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  const at = (u: number, v: number): Vec => [hx + dx * u + nx * v, hy + dy * u + ny * v];
  const tw = Math.max(1, ri(S / 20));
  const T = T_HELD;
  const WS = m.tier === 3 ? 0.62 : 1; // a boss's weapon is stubbier so its sheet stays small
  const mode = p.wmode ?? 0;
  const seg = (u0: number, v0: number, u1: number, v1: number, w: number, mat: Mat): void => {
    const a = at(u0, v0), b = at(u1, v1);
    line(cv, a[0], a[1], b[0], b[1], w, mat, T);
  };
  const pl = (pts: number[][], mat: Mat): void => poly(cv, pts.map(([u, v]) => at(u, v)), mat, T);
  switch (kind) {
    case 'club': {
      const L = ri(S * 0.45 * WS) + 2;
      seg(-1, 0, L * 0.75, 0, tw, P.wood);
      const hp = at(L * 0.86, 0);
      ell(cv, hp[0], hp[1], Math.max(1.5, L * 0.22), Math.max(1.5, L * 0.22), P.wood, T);
      if (m.tier >= 1) { const q = at(L * 0.9, -L * 0.14); cv.put(Math.floor(q[0]), Math.floor(q[1]), P.met.l, T); const q2 = at(L * 1.0, L * 0.1); cv.put(Math.floor(q2[0]), Math.floor(q2[1]), P.met.b, T); }
      break;
    }
    case 'sword': {
      const L = ri(S * 0.5 * WS) + 3, bw = Math.max(1, ri(S / 12));
      seg(-2, 0, 1, 0, tw, P.dark);
      const g = Math.max(1.5, L * 0.14);
      seg(1.5, -g, 1.5, g, Math.max(1, tw), P.acc);
      seg(2.5, 0, L, 0, bw, P.met);
      if (bw >= 2) { const a = at(L + 1, 0); cv.put(Math.floor(a[0]), Math.floor(a[1]), P.met.l, T); }
      break;
    }
    case 'axe': {
      const L = ri(S * 0.5 * WS) + 2, bh = Math.max(1.5, L * 0.38);
      seg(-2, 0, L, 0, tw, P.wood);
      pl([[L * 0.6, -0.5], [L * 0.68, -bh], [L * 1.02, -bh * 1.1], [L * 0.98, 0], [L * 0.9, bh * 0.4], [L * 0.62, 0.8]], P.met);
      break;
    }
    case 'spear': {
      const L = ri(S * 0.75 * WS) + 3, tipW = Math.max(1, S / 12);
      seg(-L * 0.25, 0, L * 0.88, 0, tw, P.wood);
      pl([[L * 0.8, -tipW], [L * 1.08 + tipW, 0], [L * 0.8, tipW]], P.met);
      if (m.tier >= 1) seg(L * 0.74, -1, L * 0.74, 1, 1, P.acc);
      break;
    }
    case 'bow': {
      const vmax = ri(S * 0.32 * WS) + 2, bulge = Math.max(1, ri(vmax * 0.38)), bw = Math.max(1, ri(S / 18));
      let prev: Vec | null = null;
      for (let k = -vmax; k <= vmax; k++) {
        const u = -bulge * Math.pow(k / vmax, 2) + 0;
        const q = at(u, k);
        if (prev) line(cv, prev[0], prev[1], q[0], q[1], bw, P.wood, T);
        prev = q;
      }
      seg(-1, -1, -1, 1, Math.max(1, bw), P.acc);
      const sc = 0xe4dcc4;
      const draw = mode > 0 ? Math.max(2, ri(mode * vmax * 0.6)) : 0;
      const sa = at(-bulge, -vmax), sb = at(-bulge, vmax);
      if (draw > 0) {
        const mid = at(-bulge - draw, 0);
        bres(cv, sa[0], sa[1], mid[0], mid[1], sc, T); bres(cv, mid[0], mid[1], sb[0], sb[1], sc, T);
        const tip = at(vmax * 0.9, 0);
        bres(cv, mid[0], mid[1], tip[0], tip[1], P.wood.l, T);
        cv.put(Math.floor(tip[0]), Math.floor(tip[1]), P.met.l, T);
        const f = at(-bulge - draw + 1, 1); cv.put(Math.floor(f[0]), Math.floor(f[1]), P.acc.b, T);
      } else {
        const mid = at(mode < 0 ? -bulge + 1 : -bulge, 0);
        bres(cv, sa[0], sa[1], mid[0], mid[1], sc, T); bres(cv, mid[0], mid[1], sb[0], sb[1], sc, T);
      }
      break;
    }
    case 'staff': {
      const L = ri(S * 0.7 * WS) + 3, orR = Math.max(1.5, S * 0.1);
      seg(-L * 0.35, 0, L * 0.82, 0, tw, P.wood);
      const pa = at(L * 0.78, 0), pb = at(L * 1.0, -orR - 1), pc = at(L * 1.0, orR + 1);
      line(cv, pa[0], pa[1], pb[0], pb[1], 1, P.met, T); line(cv, pa[0], pa[1], pc[0], pc[1], 1, P.met, T);
      const o = at(L * 1.0 + 0.5, 0);
      drawOrb(c, o[0], o[1], orR, mode);
      break;
    }
    case 'shield': {
      const r = ri(S * 0.27) + 1, hgt = ri(S * 0.22) + 2;
      const cx0 = hx + r * 0.6, cy0 = hy - hgt * 0.15;
      ell(cv, cx0, cy0, r + (m.tier > 0 ? 1 : 0), hgt, P.acc, T, { e: 2.4, taper: 0.25 });
      ell(cv, cx0, cy0 + 0.3, Math.max(1, r - 1), Math.max(1, hgt - 1.5), P.met, T, { e: 2.4, taper: 0.25 });
      if (m.tier >= 1) { const b = Math.max(1, ri(r * 0.45)); rect(cv, cx0 - b / 2, cy0 - b / 2, cx0 + b / 2 + 0.5, cy0 + b / 2 + 0.5, flat(P.met.l), T, { bevel: false }); }
      break;
    }
    case 'bomb': {
      const br = Math.max(1.5, ri(S * 0.16) + 1);
      const bx0 = hx + 1, by0 = hy - br + 0.5;
      const bm = matOf(0x2c2834);
      ell(cv, bx0, by0, br, br, bm, T, { hi: 0.5 });
      cv.put(Math.floor(bx0 - br * 0.4), Math.floor(by0 - br * 0.4), 0x8a8498, T);
      const fx = bx0 + br * 0.4, fy = by0 - br;
      bres(cv, fx, fy, fx + 1, fy - 2, P.acc.b, T);
      const lit = mode > 0 || (p.tint ?? 0) > 0;
      cv.put(Math.floor(fx + 1), Math.floor(fy - 3), (p.t ?? 0) % 2 ? 0xffd24a : 0xff7a2a, T, 1);
      if (lit) { cv.put(Math.floor(fx + 2), Math.floor(fy - 3), 0xffe9a0, T, 1); cv.put(Math.floor(fx), Math.floor(fy - 4), 0xff7a2a, T, 1); }
      break;
    }
    case 'orb': {
      const orR = Math.max(1.8, S * 0.14);
      drawOrb(c, hx + 1, hy - orR * 0.7, orR, mode);
      break;
    }
    case 'sling': {
      const cl = ri(S * 0.45 * WS) + 2;
      seg(0, 0, cl, 0, 1, P.acc);
      const sp = at(cl + 1, 0);
      ell(cv, sp[0], sp[1], Math.max(1, S * 0.07), Math.max(1, S * 0.07), P.met, T, { hi: 0.5 });
      break;
    }
    default: break;
  }
}

/** A glowing orb (eye colour). Mode 1 = charging, 2 = bright with sparks. */
function drawOrb(c: Ctx, x: number, y: number, r: number, mode: number): void {
  const { cv, m, p } = c;
  const P = m.P;
  const om = { l: P.eyeHi, b: P.eye, s: P.eyeLo };
  if (mode >= 1) {
    ell(cv, x, y, r + 1, r + 1, flat(mixc(P.eye, P.ink, 0.4)), T_HELD, { hi: 9, lo: -9 });
  }
  ell(cv, x, y, r, r, om, T_HELD, { hi: 0.2, lo: -0.5 });
  cv.put(Math.floor(x - r * 0.4), Math.floor(y - r * 0.4), P.white, T_HELD, 1);
  if (mode >= 2 || p.flare) {
    const t = p.t ?? 0;
    const k = Math.ceil(r + 2);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + (t % 2 ? 0.7 : 0.2);
      cv.put(Math.floor(x + Math.cos(a) * k), Math.floor(y + Math.sin(a) * k), P.eyeHi, T_HELD, 1);
    }
  }
}

function defaultAngle(kind: string): number {
  return kind === 'bow' ? 0 : kind === 'sling' ? 70 : kind === 'spear' ? -78 : kind === 'staff' ? -85 : -55;
}

// ----------------------------------------------------------- motifs: tells of its powers painted onto the body
function region(c: Ctx): [number, number, number, number] {
  const { m } = c;
  const hx = Math.max(c.brx, c.hrx) + Math.max(m.armLen, m.legL * 1.4) + 8;
  return [Math.max(0, ri(c.bx - hx)), Math.min(W - 1, ri(c.bx + hx + m.headOff)), Math.max(0, ri(c.hTop - 6)), GY - 1];
}
const isSkin = (t: number): boolean => t === T_BODY || t === T_HEAD || t === T_LIMB;

function drawMotifs(c: Ctx): void {
  const { cv, m, p } = c;
  const ms = m.motifs;
  if (ms.size === 0) return;
  const P = m.P, S = m.S, seed = m.seed;
  const [x0, x1, y0, y1] = region(c);
  const bcy = ri(c.bcy), bx = ri(c.bx);
  const at = (x: number, y: number): number => cv.tag(x, y);
  const hashAt = (x: number, y: number, s: number): number => hash2(x - bx, y - bcy, seed + s);
  if (ms.has('frost')) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!isSkin(at(x, y))) continue;
      const i = y * W + x;
      if ((cv.px[i] & 0xffffff) === P.base.l) cv.px[i] = 0xf2fbff | OP;
    }
    const n = m.tier >= 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const s = i % 2 ? 1 : -1, px = c.bx + s * c.brx * (0.35 + 0.3 * (i >> 1)), h = Math.max(2, ri(S * 0.2) + (i === 0 ? 1 : 0));
      poly(cv, [[px - 1.2, c.bTop + 1], [px, c.bTop - h], [px + 1.2, c.bTop + 1]], flat(0xcdeeff), T_BACK, { hi: 9, lo: -9 });
      cv.put(Math.floor(px), Math.floor(c.bTop - h + 1), 0xffffff, T_BACK, 1);
    }
  }
  if (ms.has('poison')) {
    const n = c.bry > 6 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const lx = ri((hash2(i, 1, seed) - 0.5) * c.brx * 1.5), ly = ri((hash2(i, 2, seed) - 0.4) * c.bry * 1.4);
      const sz = c.bry > 6 && i % 2 === 0 ? 2 : 1;
      for (let a = 0; a < sz; a++) for (let b = 0; b < sz; b++) cv.put(bx + lx + a, bcy + ly + b, a === 0 && b === 0 && sz === 2 ? 0xc7e84a : 0x8cc43a, T_BODY, 0, T_BODY);
    }
    // drips off the lower edge of the body and the chin
    for (let i = 0; i < 2; i++) {
      const x = ri(c.bx + (i ? 0.32 : -0.35) * c.brx * 2);
      const yb = ri(c.bBot) - 1;
      if (c.m.legL === 0 || c.m.hover) for (let k = 1; k <= 2 + i; k++) if (!cv.has(x, yb + k) && yb + k < GY) cv.put(x, yb + k, k === 2 + i ? 0x6a9a2a : 0x8cc43a, T_BACK);
    }
  }
  if (ms.has('armor')) {
    const rows = c.bry > 7 ? [0.62, 1.15, 1.55] : [0.9, 1.45];
    const bandH = c.bry > 6 ? 2 : 1;
    for (const f of rows) {
      const y = ri(c.bTop + c.bry * f);
      if (y >= c.bBot - 1) continue;
      for (let k = 0; k < bandH; k++) for (let x = ri(c.bx - c.brx) - 1; x <= ri(c.bx + c.brx) + 1; x++) {
        if (at(x, y + k) === T_BODY) cv.put(x, y + k, k === 0 ? P.met.l : P.met.b, T_BODY, 0, T_BODY);
      }
      if (c.brx >= 4) { cv.put(ri(c.bx - c.brx * 0.6), y, P.white, T_BODY, 1); cv.put(ri(c.bx + c.brx * 0.6), y, P.white, T_BODY, 1); }
    }
    const pr = Math.max(1.5, S * 0.12);
    for (const sh of [c.shL, c.shR]) ell(cv, sh[0] + (sh === c.shR ? -0.5 : 0.5), sh[1] + 0.5, pr, pr * 0.85, P.met, T_BODY);
  }
  if (ms.has('bones')) {
    const nr = c.bry > 8 ? 3 : c.bry > 4 ? 2 : 1;
    const hw = Math.max(1, ri(c.brx * 0.6));
    for (let i = 0; i < nr; i++) {
      const y = ri(c.bTop + c.bry * (0.55 + 0.42 * i));
      if (y >= c.bBot - 1) continue;
      for (let x = bx - hw; x <= bx + hw; x++) if (x !== bx + 1 || hw < 2) cv.put(x, y, x === bx - hw || x === bx + hw ? P.bone.s : P.bone.b, T_BODY, 0, T_BODY);
      if (c.bry > 5 && i < nr - 1) cv.put(bx - hw, y + 1, P.bone.s, T_BODY, 0, T_BODY);
    }
    if (c.bry > 4) for (let y = ri(c.bTop + c.bry * 0.4); y < ri(c.bTop + c.bry * (0.55 + 0.42 * (nr - 1))) + 1; y++) cv.put(bx + 1, y, P.bone.s, T_BODY, 0, T_BODY);
  }
  if (ms.has('fur')) {
    const adds: number[][] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = at(x, y);
      if (!isSkin(t)) continue;
      const hh = hashAt(x, y, 17);
      if (hh > 0.34) continue;
      const col = cv.col(x, y);
      if (!cv.has(x, y - 1) && hh < 0.17) adds.push([x, y - 1, col, t]);
      else if (!cv.has(x - 1, y) && hh < 0.25) adds.push([x - 1, y, col, t]);
      else if (!cv.has(x + 1, y)) adds.push([x + 1, y, col, t]);
      else if (!cv.has(x, y + 1) && m.legL === 0) adds.push([x, y + 1, P.base.s, t]);
    }
    for (const [x, y, col, t] of adds) cv.put(x, y, col, t);
    if (c.bry > 4) for (let i = 0; i < 3; i++) {
      const lx = ri((hash2(i, 5, seed) - 0.5) * c.brx * 1.4), ly = ri((hash2(i, 6, seed) - 0.3) * c.bry * 1.2);
      cv.put(bx + lx, bcy + ly, P.base.s, T_BODY, 0, T_BODY); cv.put(bx + lx, bcy + ly + 1, P.base.s, T_BODY, 0, T_BODY);
    }
  }
  if (ms.has('slime')) {
    const hl = mixc(P.base.l, 0xffffff, 0.6);
    cv.put(ri(c.bx - c.brx * 0.5), ri(c.bTop + c.bry * 0.35), hl, T_BODY, 1, T_BODY);
    if (c.bry > 4) { cv.put(ri(c.bx - c.brx * 0.5) + 1, ri(c.bTop + c.bry * 0.35), hl, T_BODY, 1, T_BODY); cv.put(ri(c.bx - c.brx * 0.5), ri(c.bTop + c.bry * 0.35) + 1, hl, T_BODY, 1, T_BODY); }
    if (m.headKind !== 'none' && c.hrx >= 3) cv.put(ri(c.hx - c.hrx * 0.5), ri(c.hy - c.hry * 0.55), hl, T_HEAD, 1, T_HEAD);
    const yb = ri(c.bBot) - 1;
    for (let i = 0; i < 2; i++) {
      const x = ri(c.bx + (i ? 0.45 : -0.2) * c.brx), len = 1 + i + (S > 14 ? 1 : 0);
      for (let k = 1; k <= len; k++) if (m.legL === 0 && !cv.has(x, yb + k) && yb + k < GY) cv.put(x, yb + k, k === len ? P.base.s : P.base.b, T_BODY);
    }
  }
  if (ms.has('glow')) {
    let x = bx - ri(c.brx * 0.4), y = ri(c.bTop + c.bry * 0.5);
    for (let v = 0; v < 2; v++) {
      let cx2 = x + v * ri(c.brx * 0.6), cy2 = y + v * 2;
      for (let k = 0; k < Math.max(3, ri(c.bry * 0.8)); k++) {
        cv.put(cx2, cy2, P.eye, T_BODY, 1, T_BODY);
        cy2 += 1; cx2 += hash2(k, v, seed) < 0.5 ? 0 : 1;
      }
    }
  }
  if (ms.has('stone')) {
    const crack = mixc(P.base.s, 0x08040f, 0.4);
    let x = bx - ri(c.brx * 0.3), y = ri(c.bTop + c.bry * 0.35);
    for (let k = 0; k < Math.max(3, ri(c.bry * 0.9)); k++) {
      cv.put(x, y, crack, T_BODY, 0, T_BODY);
      y += 1; x += hash2(k, 4, seed) < 0.4 ? -1 : hash2(k, 4, seed) < 0.7 ? 0 : 1;
    }
    if (c.bry > 5) {
      const sy = ri(c.bTop + c.bry * 1.2);
      for (let xx = ri(c.bx - c.brx); xx <= c.bx + c.brx; xx++) cv.put(xx, sy, P.base.s, T_BODY, 0, T_BODY);
      for (let yy = sy; yy < ri(c.bBot) - 1; yy++) cv.put(bx + (c.brx > 5 ? 2 : 0), yy, P.base.s, T_BODY, 0, T_BODY);
    }
  }
  if (ms.has('bandage')) {
    const cloth = matOf(mixc(0xe6dcc2, P.base.b, 0.12));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = at(x, y);
      if (t !== T_BODY && t !== T_LIMB && !(t === T_HEAD && m.headKind === 'skull')) continue;
      const q = (((x + y * 1 + 1000) % 5) + 5) % 5;
      if (q === 0) cv.put(x, y, cloth.b, t);
      else if (q === 1 && S > 12) cv.put(x, y, cloth.s, t);
    }
    // a loose end trailing off
    let lx = ri(c.bx - c.brx), ly = ri(c.bTop + c.bry * 0.9);
    for (let k = 0; k < Math.max(2, ri(S * 0.2)); k++) { cv.put(lx - k, ly + (k >> 1), cloth.b, T_BACK); if (k > 1) cv.put(lx - k, ly + (k >> 1) + 1, cloth.s, T_BACK); }
  }
  if (ms.has('thorns')) {
    const n = m.tier >= 2 ? 6 : 4, sl = Math.max(2, ri(S * 0.15));
    for (let i = 0; i < n; i++) {
      const a = -Math.PI + (Math.PI * 2 * (i + 0.5)) / n * 0.92 + hash2(i, 8, seed) * 0.3;
      const sa = Math.sin(a);
      if (sa > 0.6) continue;
      const px = c.bx + Math.cos(a) * c.brx * 0.92, py = c.bcy + sa * c.bry * 0.92;
      const nx = Math.cos(a), ny = sa, tx = -ny, ty = nx, wd = Math.max(0.8, sl * 0.3);
      poly(cv, [[px - tx * wd, py - ty * wd], [px + nx * sl, py + ny * sl], [px + tx * wd, py + ty * wd]], P.met, T_BACK);
    }
  }
  if (ms.has('fire')) {
    const t = p.t ?? 0;
    const cols = [0xff7a2a, 0xffd24a, 0xe2461e];
    const n = 3 + m.tier;
    for (let i = 0; i < n; i++) {
      const lx = (hash2(i, 1, seed) - 0.5) * (c.brx * 2 + 2), top = m.headKind === 'none' ? c.bTop : c.hTop;
      const rise = ((t + i) % 2) * 1 + hash2(i, 2, seed) * S * 0.3;
      cv.put(ri(c.bx + lx), ri(top - 1 - rise), cols[(i + t) % 3], T_BACK, 1);
    }
    // glowing cracks in the lower body
    for (let i = 0; i < 2 + (c.bry > 6 ? 1 : 0); i++) {
      const lx = ri((hash2(i, 3, seed) - 0.5) * c.brx * 1.3), ly = ri(c.bcy + (hash2(i, 4, seed) - 0.1) * c.bry * 0.7);
      cv.put(bx + lx, ly, cols[(i + t) % 2], T_BODY, 1, T_BODY);
      if (c.bry > 5) cv.put(bx + lx + 1, ly + 1, 0xe2461e, T_BODY, 1, T_BODY);
    }
  }
}

function drawFlourish(c: Ctx): void {
  const { cv, m, p } = c;
  if (p.stars) {
    const t = p.t ?? 0;
    const top = m.headKind === 'none' ? c.bTop : c.hTop;
    const r = Math.max(2, c.hrx);
    for (let i = 0; i < 3; i++) {
      const a = (i * 2.1 + t * 0.9) % 6.28;
      cv.put(ri(c.hx + Math.cos(a) * r), ri(top - 2 + Math.sin(a) * 1.4), i % 2 ? 0xfff0a0 : 0xffffff, T_BACK, 1);
    }
  }
}

function tintFrame(cv: Cv, m: Model, tint: number): void {
  const to = tint === 1 ? 0xfff4e6 : 0xff7a5a, k = tint === 1 ? 0.5 : 0.45;
  for (let i = 0; i < cv.px.length; i++) if (cv.px[i] !== 0 && cv.tg[i] !== T_EYE) cv.px[i] = mixc(cv.px[i] & 0xffffff, to, k) | OP;
  void m;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Pose tables
// ---------------------------------------------------------------------------------------------------------------------------
type Stage = 'rest' | 'w0' | 'w1' | 's0' | 's1' | 'a0' | 'a1' | 'rel' | 'c0' | 'c1' | 'chg';
interface Hold { ang: number; arm: Vec; mode?: number }
const SWING: Record<Stage, Hold> = {
  rest: { ang: -55, arm: [0.3, 0.95] }, w0: { ang: -95, arm: [0.1, -0.2] }, w1: { ang: -140, arm: [-0.35, -0.7] },
  s0: { ang: -20, arm: [0.95, -0.05] }, s1: { ang: 55, arm: [0.7, 0.7] },
  a0: { ang: -10, arm: [0.9, 0] }, a1: { ang: -10, arm: [0.95, 0] }, rel: { ang: -5, arm: [1, 0] },
  c0: { ang: -80, arm: [0.15, -0.8] }, c1: { ang: -85, arm: [0.1, -1] }, chg: { ang: -8, arm: [0.9, 0.1] },
};
function holdFor(kind: string, st: Stage): Hold {
  const S = SWING;
  switch (kind) {
    case 'spear': {
      const t: Partial<Record<Stage, Hold>> = {
        rest: { ang: -78, arm: [0.25, 0.9] }, w0: { ang: -8, arm: [-0.3, 0.4] }, w1: { ang: -4, arm: [-0.6, 0.35] },
        s0: { ang: 0, arm: [0.9, 0.2] }, s1: { ang: 3, arm: [1.1, 0.25] }, chg: { ang: 0, arm: [0.9, 0.25] },
        a0: { ang: -5, arm: [0.9, 0] }, a1: { ang: -5, arm: [0.9, 0] }, rel: { ang: -5, arm: [1, 0] },
      };
      return t[st] ?? S[st];
    }
    case 'bow': {
      const t: Partial<Record<Stage, Hold>> = {
        rest: { ang: 0, arm: [0.55, 0.55] }, a0: { ang: 0, arm: [1, -0.05], mode: 0.5 }, a1: { ang: 0, arm: [1, -0.05], mode: 1 }, rel: { ang: 0, arm: [1, -0.05], mode: -1 },
        c0: { ang: 0, arm: [0.9, -0.3] }, c1: { ang: 0, arm: [0.9, -0.5] }, chg: { ang: 0, arm: [0.8, 0.2] },
      };
      return t[st] ?? S[st];
    }
    case 'sling': {
      const t: Partial<Record<Stage, Hold>> = {
        rest: { ang: 70, arm: [0.3, 0.9] }, w0: { ang: -100, arm: [0.1, -0.6] }, w1: { ang: -60, arm: [0.1, -0.7] },
        s0: { ang: -10, arm: [0.9, -0.1] }, s1: { ang: 15, arm: [0.9, 0] }, a0: { ang: -110, arm: [0.1, -0.7] }, a1: { ang: -70, arm: [0.1, -0.7] },
        rel: { ang: 0, arm: [1, -0.1] }, c0: { ang: -100, arm: [0.1, -0.7] }, c1: { ang: -60, arm: [0.1, -0.8] },
      };
      return t[st] ?? S[st];
    }
    case 'bomb': {
      const t: Record<Stage, Hold> = {
        rest: { ang: 0, arm: [0.45, 0.7] }, w0: { ang: 0, arm: [0.2, 0.1] }, w1: { ang: 0, arm: [-0.1, -0.8] },
        s0: { ang: 0, arm: [0.9, -0.3] }, s1: { ang: 0, arm: [0.9, 0.3] }, a0: { ang: 0, arm: [-0.1, -0.8] }, a1: { ang: 0, arm: [-0.1, -0.8] },
        rel: { ang: 0, arm: [0.9, -0.3] }, c0: { ang: 0, arm: [0.2, -0.8] }, c1: { ang: 0, arm: [0.2, -0.9] }, chg: { ang: 0, arm: [0.5, 0.3] },
      };
      return t[st];
    }
    case 'orb': {
      const t: Record<Stage, Hold> = {
        rest: { ang: 0, arm: [0.5, 0.5] }, w0: { ang: 0, arm: [0.3, 0] }, w1: { ang: 0, arm: [0.2, -0.4] },
        s0: { ang: 0, arm: [0.9, -0.1] }, s1: { ang: 0, arm: [0.9, 0.1] }, a0: { ang: 0, arm: [0.3, -0.4], mode: 1 }, a1: { ang: 0, arm: [0.5, -0.2], mode: 2 },
        rel: { ang: 0, arm: [1, -0.1], mode: 2 }, c0: { ang: 0, arm: [0.2, -0.8], mode: 1 }, c1: { ang: 0, arm: [0.1, -1], mode: 2 }, chg: { ang: 0, arm: [0.6, 0.2] },
      };
      return t[st];
    }
    case 'shield': {
      const t: Record<Stage, Hold> = {
        rest: { ang: 0, arm: [0.55, 0.5] }, w0: { ang: 0, arm: [0.3, 0.1] }, w1: { ang: 0, arm: [0, -0.2] },
        s0: { ang: 0, arm: [0.95, 0.1] }, s1: { ang: 0, arm: [1.05, 0.2] }, a0: { ang: 0, arm: [0.8, 0.2] }, a1: { ang: 0, arm: [0.8, 0.2] },
        rel: { ang: 0, arm: [0.8, 0.2] }, c0: { ang: 0, arm: [0.3, -0.4] }, c1: { ang: 0, arm: [0.3, -0.5] }, chg: { ang: 0, arm: [0.9, 0.1] },
      };
      return t[st];
    }
    case 'staff': {
      const h = S[st];
      return st === 'rest' ? { ang: -85, arm: [0.3, 0.95] } : h;
    }
    default: return S[st];
  }
}

/** The whole pose list for one monster, in anim order. */
function buildPoses(m: Model): [string, Pose[]][] {
  const kind = m.look.held;
  const hold = (s: Stage): Pick<Pose, 'armR' | 'wang' | 'wmode'> => { const h = holdFor(kind, s); return { armR: h.arm, wang: h.ang, wmode: h.mode ?? 0 }; };
  const grounded = m.legL === 0 && !m.hover;
  const out: [string, Pose[]][] = [];
  const walk: Pose[] = [];
  for (let k = 0; k < 4; k++) {
    const bobUp = k % 2;
    walk.push({
      gait: m.hover && m.limbs !== 'tentacles' ? 4 : [4, 0, 4, 2][k], up: grounded || m.hover ? 0 : k === 2 ? 1 : 0, crouch: grounded ? bobUp : 0, hover: m.hover ? [0, 1, 2, 1][k] : 0,
      ...hold('rest'), armL: [-0.3 + (k === 1 ? 0.1 : k === 3 ? -0.1 : 0), 0.95], ph: k, t: k, wing: [1, 2, 1, 0][k], tail: [0, 0.6, 0, -0.6][k],
      hdy: m.hover ? 0 : bobUp ? 0 : 0, lean: 0, mouth: 0,
    });
  }
  out.push(['walk', walk]);
  out.push(['idle', [
    { gait: 4, ...hold('rest'), ph: 0, t: 0, wing: 1, tail: 0 },
    { gait: 4, crouch: 1, hover: m.hover ? 1 : 0, ...hold('rest'), hdy: 1, ph: 2, t: 1, wing: 0, tail: 0.5 },
  ]]);
  out.push(['hurt', [{ gait: 4, crouch: 1, lean: -2, hdx: -1, mouth: 2, shut: true, ...hold('rest'), armR: [0.0, 0.55], armL: [-0.5, 0.5], wing: 2, tail: 1, hover: m.hover ? 1 : 0, t: 1 }]]);
  // dead: handled in compose (the standing body, turned)
  out.push(['windup', [
    { gait: 4, crouch: 1, lean: -1, mouth: 1, ...hold('w0'), armL: [-0.4, 0.3], wing: 2, t: 0, hover: m.hover ? 1 : 0 },
    { gait: 9, crouch: 1, lean: -2, hdx: -1, mouth: 2, ...hold('w1'), armL: [-0.5, -0.3], wing: 2, tail: 1, t: 1, hover: m.hover ? 1 : 0 },
  ]]);
  out.push(['strike', [
    { gait: 9, crouch: 1, lean: 2, hdx: 1, mouth: 1, ...hold('s0'), armL: [-0.1, 0.5], wing: 1, tail: -0.5, t: 0, hover: m.hover ? 1 : 0 },
    { gait: 9, crouch: 2, lean: 3, hdx: 1, hdy: 1, mouth: 2, ...hold('s1'), armL: [0.4, 0.5], wing: 0, tail: -1, t: 1, hover: m.hover ? 1 : 0 },
  ]]);
  out.push(['cast', [
    { gait: 4, up: 1, lean: -1, mouth: 1, ...hold('c0'), armL: [-0.2, -0.8], wing: 2, t: 0, ph: 0, hover: m.hover ? 1 : 0 },
    { gait: 4, up: 1, lean: -1, hdy: -1, mouth: 2, ...hold('c1'), armL: [-0.15, -0.95], wing: 2, t: 1, ph: 2, flare: true, hover: m.hover ? 2 : 0 },
  ]]);
  out.push(['aim', [
    { gait: 4, crouch: 1, lean: 0, ...hold('a0'), armL: [0.3, 0.4], t: 0, wing: 1 },
    { gait: 4, crouch: 1, lean: -1, hdx: 1, ...hold('a1'), armL: [-0.2, 0.15], t: 1, wing: 1 },
  ]]);
  out.push(['release', [{ gait: 4, crouch: 1, lean: 1, hdx: 1, ...hold('rel'), armL: [-0.5, 0.3], t: 0, wing: 1, mouth: 1 }]]);
  out.push(['lit', [
    { gait: 0, ...hold('rest'), armR: holdFor(kind, 'w1').arm, wang: holdFor(kind, 'w1').ang, wmode: 1, tint: 1, t: 0, mouth: 1, up: grounded ? 0 : 1, wing: 1, ph: 0 },
    { gait: 2, ...hold('rest'), armR: holdFor(kind, 'w1').arm, wang: holdFor(kind, 'w1').ang, wmode: 1, tint: 2, t: 1, mouth: 1, up: grounded ? 0 : 0, wing: 2, ph: 2 },
  ]]);
  out.push(['paw', [
    { gait: 7, up: 1, lean: -2, hdy: -1, mouth: 1, ...hold('w0'), armL: [-0.4, -0.3], wing: 2, t: 0 },
    { gait: 8, crouch: 2, lean: 1, hdy: 1, mouth: 2, ...hold('rest'), armL: [0.3, 0.6], wing: 0, t: 1 },
  ]]);
  out.push(['charge', [
    { gait: 5, crouch: 2, lean: 3, hdx: 1, mouth: 1, ...hold('chg'), armL: [0.5, 0.4], wing: 1, tail: 1, t: 0, ph: 0 },
    { gait: 6, crouch: 1, lean: 3, hdx: 1, mouth: 1, ...hold('chg'), armL: [0.5, 0.4], wing: 1, tail: 0.6, t: 1, ph: 2 },
  ]]);
  out.push(['dazed', [
    { gait: 4, crouch: 2, lean: 1, hdy: 2, shut: true, armR: [0.1, 1], wang: 70, armL: [-0.1, 1], stars: true, t: 0, wing: 0, tail: 0.3 },
  ]]);
  out.push(['rise', [{ gait: 9, crouch: 1, lean: 1, hdy: 1, armR: [0.3, 0.9], wang: 60, armL: [-0.3, 0.8], wing: 1, t: 0 }]]);
  if (m.look.boss) {
    out.push(['slam', [
      { gait: 9, crouch: -2, lean: -2, hdy: -1, mouth: 2, armR: [0.2, -0.9], wang: kind === 'none' ? 0 : -95, armL: [-0.2, -0.9], wing: 2, t: 0, hover: m.hover ? 2 : 0 },
      { gait: 9, crouch: 2, lean: 3, hdy: 1, mouth: 2, ...hold('s1'), armL: [0.75, 0.65], wing: 0, tail: -1, t: 1 },
    ]]);
    out.push(['roar', [
      { gait: 9, crouch: -1, lean: -1, hdx: -1, hdy: -1, mouth: 2, armR: [0.95, -0.3], wang: -60, armL: [-0.95, -0.3], wing: 2, t: 0 },
      { gait: 9, crouch: -1, lean: -2, hdx: -1, hdy: -2, mouth: 2, armR: [0.8, -0.7], wang: -75, armL: [-0.8, -0.7], wing: 2, flare: true, t: 1 },
    ]]);
    out.push(['smash', [
      { gait: 9, crouch: -1, lean: -1, mouth: 1, armR: [0.05, -0.75], wang: kind === 'none' ? 0 : -110, armL: [-0.1, -0.7], wing: 2, t: 0 },
      { gait: 9, crouch: 2, lean: 3, hdy: 1, mouth: 2, ...hold('s1'), armL: [0.7, 0.6], wing: 0, t: 1 },
    ]]);
  }
  const ranged = kind === 'bow' || kind === 'sling' || kind === 'orb' || kind === 'staff';
  return out.filter(([a]) => !((a === 'aim' || a === 'release') && !ranged) && !(a === 'lit' && kind !== 'bomb') && !((a === 'paw' || a === 'charge') && (ranged || kind === 'bomb')) && !(a === 'paw' && m.look.boss));
}

// ---------------------------------------------------------------------------------------------------------------------------
// Sprites, post pass, sheet packing
// ---------------------------------------------------------------------------------------------------------------------------
interface Spr { w: number; h: number; px: Int32Array; nr: Uint8Array; ax: number; gy: number }

function crop(cv: Cv): Spr {
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (cv.px[y * W + x] !== 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = CX; x1 = CX; y0 = GY - 1; y1 = GY - 1; cv.px[(GY - 1) * W + CX] = 0x808080 | OP; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const px = new Int32Array(w * h), nr = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { px[y * w + x] = cv.px[(y + y0) * W + x + x0]; nr[y * w + x] = cv.nr[(y + y0) * W + x + x0]; }
  return { w, h, px, nr, ax: CX - x0, gy: GY - y0 };
}

/** A quarter turn clockwise: the standing body lies on its side with the head to the right. */
function rotCw(s: Spr): Spr {
  const w = s.h, h = s.w;
  const px = new Int32Array(w * h), nr = new Uint8Array(w * h);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const nx = s.h - 1 - y, ny = x; px[ny * w + nx] = s.px[y * s.w + x]; nr[ny * w + nx] = s.nr[y * s.w + x]; }
  return { w, h, px, nr, ax: w >> 1, gy: h };
}

/** House post pass: 1px rim light on top/left edges, 1px dark ink outline all round. Pads the sprite by 1 on every side. */
function post(s: Spr, ink: number): Spr {
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

/** Compose one monster's whole sprite sheet. Deterministic; never throws for a valid look. */
export function composeMonster(look: MonsterLook): MonsterSheet {
  const m = makeModel(look);
  const cv = new Cv();
  const frames: { name: string; anim: string; spr: Spr }[] = [];
  const sprFor = (pose: Pose): Spr => { drawMonster(cv, m, pose); return crop(cv); };
  for (const [anim, poses] of buildPoses(m)) {
    poses.forEach((pose, i) => frames.push({ name: `${anim}_${i}`, anim, spr: post(sprFor(pose), m.P.ink) }));
    if (anim === 'hurt') {
      const body = sprFor({ gait: 4, crouch: 1, lean: -1, shut: true, mouth: 2, noHeld: true, hover: 0, t: 0, ph: 0 });
      frames.push({ name: 'dead_0', anim: 'dead', spr: post(rotCw(body), m.P.ink) });
    }
  }
  // Cells: frames of one anim share a cell (anims of one group share it too, so identical frames can share a rect). Each cell is centred
  // on the character's centre line with the ground on its bottom row, and only as big as its largest frame.
  const maxW = look.boss ? 128 : 64, maxH = maxW;
  const GROUPS: Record<string, string> = { walk: 'a', idle: 'a', hurt: 'a', dazed: 'a', rise: 'a', aim: 'b', release: 'b' };
  const gOf = (anim: string): string => GROUPS[anim] ?? anim;
  const groups = new Map<string, { E: number; top: number; frames: number[] }>();
  frames.forEach((f, i) => {
    const key = gOf(f.anim);
    const g = groups.get(key) ?? { E: 1, top: 1, frames: [] };
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
  const meta: MonsterSheetMeta = { frames: {}, anims: {} };
  frames.forEach((f, i) => {
    const k = frameCell[i];
    meta.frames[f.name] = { x: pos[k].x, y: pos[k].y, w: cells[k].w, h: cells[k].h };
    (meta.anims[f.anim] ??= { frames: [] }).frames.push(f.name);
  });
  return { width, height, rgba, meta };
}
