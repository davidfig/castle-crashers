// Procedural background art for the biomes: ground tiles and patches, parallax strips (mountains, tree lines, ruins),
// the sky's moon and clouds, fog, and the distant landmark. Everything is built once at startup into pixel buffers that
// buildSprites() packs into the atlas. See docs/11-backgrounds.md.
import { darken, hash2, setPix, silhouette, type Pix } from './pix';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A 16px grass tile: three close greens with the odd dark blade pair and light highlight. Tiles are subtle so decals read on top. */
export function makeGround(variant: number): { w: number; h: number; rgba: Uint8ClampedArray } {
  const w = 16, h = 16;
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const shades = [0x4b8039, 0x497d37, 0x4d8339];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = hash2(x, y, variant + 1);
      let c = shades[r % 3];
      const k = (r >>> 8) % 90;
      if (k === 0) { setPix(p, x, y, 0x3c6f2f); setPix(p, x, y + 1, 0x3c6f2f); continue; } // a dark blade pair
      if (k === 1) c = 0x5a9444; // highlight
      setPix(p, x, y, c);
    }
  }
  return p;
}

/** An irregular flat blob (a dirt patch or mud): ragged edge, darker rim, a second fill color speckled through it. */
export function makeBlob(w: number, h: number, seed: number, fill: number, fill2: number, rim: number): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      const d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const r = 0.88 + 0.1 * Math.sin(ang * 3 + seed) + 0.06 * Math.sin(ang * 5 + seed * 2);
      const ragged = ((hash2(x, y, seed) % 100) / 100 - 0.5) * 0.14;
      if (d >= r + ragged) continue;
      setPix(p, x, y, d > r - 0.18 ? rim : hash2(x, y, seed + 9) % 7 === 0 ? fill2 : fill);
    }
  }
  return p;
}

/** A mud puddle: a mud blob with a pool of water in the middle, glinting along its top edge. */
export function makePuddle(w: number, h: number, seed: number): Pix {
  const p = makeBlob(w, h, seed, 0x5a4630, 0x4e3c28, 0x43321f);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      const d = Math.hypot(dx, dy);
      if (d >= 0.56 + 0.08 * Math.sin(Math.atan2(dy, dx) * 4 + seed)) continue;
      setPix(p, x, y, dy < -0.25 && hash2(x, y, seed) % 3 === 0 ? 0x8cb0c8 : dy > 0.3 ? 0x4a6e88 : 0x5a86a4);
    }
  }
  return p;
}

/** 0 at the strip's edges easing up to 1 within `span` px: ridges blend to a common height at the ends so any variant can follow any other. */
function edgeEnv(x: number, w: number, span = 28): number {
  const t = Math.min(1, Math.min(x, w - 1 - x) / span);
  return t * t * (3 - 2 * t);
}

export function makeMountains(w: number, h: number, base: number, amp: number, seed: number, fill: number, edge: number): { w: number; h: number; rgba: Uint8ClampedArray } {
  const rgba = new Uint8ClampedArray(w * h * 4);
  const TAU = Math.PI * 2;
  for (let x = 0; x < w; x++) {
    const t = (x / w) * TAU;
    const ridge = base
      - amp * (0.55 * Math.sin(t * 1 + seed) + 0.3 * Math.sin(t * 3 + seed * 2.1) + 0.15 * Math.sin(t * 7 + seed * 0.7));
    const top = Math.max(0, Math.round(base + (ridge - base) * edgeEnv(x, w)));
    for (let y = top; y < h; y++) {
      const o = (y * w + x) * 4;
      const c = y === top ? edge : (hash2(x, y, seed | 0) % 23 === 0 ? darken(fill, 0.92) : fill);
      rgba[o] = (c >> 16) & 255; rgba[o + 1] = (c >> 8) & 255; rgba[o + 2] = c & 255; rgba[o + 3] = 255;
    }
  }
  return { w, h, rgba };
}

/** A seamless row of sharp, jagged peaks (|sin| harmonics have cusps, so the ridge comes to points). */
export function makeJagged(w: number, h: number, base: number, amp: number, seed: number, fill: number, edge: number): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const TAU = Math.PI * 2;
  for (let x = 0; x < w; x++) {
    const t = (x / w) * TAU;
    const peak = 0.5 * (1 - Math.abs(Math.sin(t * 3 + seed))) + 0.3 * (1 - Math.abs(Math.sin(t * 5 + seed * 2))) + 0.2 * (1 - Math.abs(Math.sin(t * 8 + seed * 0.7)));
    const top = Math.max(0, Math.round(base - amp * 0.4 + (amp * 0.4 - amp * peak) * edgeEnv(x, w)));
    for (let y = top; y < h; y++) setPix(p, x, y, y === top ? edge : hash2(x, y, seed | 0) % 19 === 0 ? darken(fill, 0.9) : fill);
  }
  return p;
}

/** White 256x2 masks for dithering one sky band into the next: 25%, 50% and 75% coverage (tint them with the color to blend in). */
export function makeDither(level: number): Pix {
  const p: Pix = { w: 256, h: 2, rgba: new Uint8ClampedArray(256 * 2 * 4) };
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 256; x++) {
      const on = level === 1 ? y === 0 && x % 2 === 0 : level === 2 ? (x + y) % 2 === 0 : !(y === 1 && x % 2 === 0);
      if (on) setPix(p, x, y, 0xffffff);
    }
  }
  return p;
}

/** A crescent moon, white (tinted when drawn). */
export function makeMoon(size: number): Pix {
  const p: Pix = { w: size, h: size, rgba: new Uint8ClampedArray(size * size * 4) };
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - r, dy = y + 0.5 - r;
      const ex = dx - r * 0.45, ey = dy + r * 0.12;
      if (dx * dx + dy * dy <= r * r && ex * ex + ey * ey > r * r * 0.78) setPix(p, x, y, 0xf4f1dc);
    }
  }
  return p;
}

/** A flat-bottomed puffy cloud: a union of discs, lit on top and shaded underneath. */
export function makeCloud(w: number, h: number, seed: number): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const floor = h - 2;
  const blobs: [number, number, number][] = [];
  const n = 3 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const r = (h * (0.35 + 0.3 * Math.sin(Math.PI * t))) * (0.8 + (hash2(i, seed, 5) % 5) / 12);
    blobs.push([w * (0.2 + 0.6 * t), floor - r * 0.7, r]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y > floor) continue;
      let hit = false, topLit = false;
      for (const [cx, cy, r] of blobs) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) { hit = true; if (dy < -r * 0.2) topLit = true; }
      }
      if (hit) setPix(p, x, y, topLit ? 0xffffff : y > floor - 2 ? 0xc4d2e6 : 0xdce6f2);
    }
  }
  return p;
}

/** A seamless tree line (wraps at the sprite's edges): pines, round oaks, fat spruces and bushes, in mixed colors, with gaps. */
export function makeTrees(w: number, h: number, count: number, seed: number, palettes: readonly (readonly [number, number])[]): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const plot = clipPlot(p);
  const rnd = (n: number, salt: number, mod: number): number => hash2(n, seed, salt) % mod;
  const xs = scatter(count, w, 12, seed);
  for (let n = 0; n < count; n++) {
    if (rnd(n, 9, 8) === 0) continue; // a gap
    const cx = xs[n];
    const [dark, light] = palettes[rnd(n, 4, palettes.length)];
    const kind = rnd(n, 3, 6); // 0,1 pine  2 oak  3 fat spruce  4 bush  5 slim pine
    const tall = 0.55 + rnd(n, 2, 45) / 100;
    if (kind === 0 || kind === 1 || kind === 5 || kind === 3) {
      const th = Math.round(h * (kind === 3 ? 0.5 + 0.2 * tall : tall));
      const hw = Math.round(th * (kind === 3 ? 0.42 : kind === 5 ? 0.17 : 0.26)) + 2;
      const tiers = kind === 3 ? 4 : 3;
      const top = h - th;
      for (let y = top; y < h; y++) {
        const u = (y - top) / th, tier = (u * tiers) % 1;
        const half = Math.round(hw * (0.15 + 0.85 * ((Math.floor(u * tiers) + tier * 0.8 + 0.2) / tiers)));
        for (let x = -half; x <= half; x++) plot(cx + x, y, x < -half / 3 ? light : dark);
      }
    } else if (kind === 2) {
      const r = Math.round(h * (0.22 + rnd(n, 5, 10) / 100)), cy = Math.round(h * 0.42);
      const trunk = 0x4a3a28;
      for (let y = cy; y < h; y++) { plot(cx, y, trunk); plot(cx + 1, y, trunk); }
      for (const [ox, oy, rr] of [[0, 0, r], [-r * 0.7, r * 0.3, r * 0.75], [r * 0.7, r * 0.3, r * 0.75]] as const) {
        for (let y = -rr; y <= rr; y++) {
          for (let x = -rr; x <= rr; x++) {
            if (x * x + y * y > rr * rr) continue;
            const lit = x + y < -rr * 0.25 && hash2(cx + x + ox, y, seed) % 5 !== 0;
            plot(Math.round(cx + ox + x), Math.round(cy + oy + y), lit ? light : dark);
          }
        }
      }
    } else {
      const bw = 5 + rnd(n, 6, 5), bh = 3 + rnd(n, 7, 3);
      for (let y = 0; y < bh; y++) {
        const half = Math.round(bw * Math.sqrt(1 - ((bh - 1 - y) / bh) ** 2) * 0.9);
        for (let x = -half; x <= half; x++) plot(cx + x, h - bh + y, y < bh / 2 && x < 0 ? light : dark);
      }
    }
  }
  // a solid base so there are no gaps against the ground
  for (let y = h - 3; y < h; y++) for (let x = 0; x < w; x++) setPix(p, x, y, palettes[0][0]);
  return p;
}

/** A white stippled blotch with an irregular, lobed outline: dense in the middle, thinning to nothing at the rim (tint it when drawn). */
export function makeMottle(w: number, h: number, seed: number): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const dx = (x + 1 - w / 2) / (w / 2), dy = (y + 1 - h / 2) / (h / 2);
      const ang = Math.atan2(dy, dx);
      const r = 0.8 + 0.2 * Math.sin(ang * 2 + seed) + 0.16 * Math.sin(ang * 3 + seed * 1.7) + 0.1 * Math.sin(ang * 5 + seed * 2.9);
      const d = Math.hypot(dx, dy) / r;
      if (d >= 1) continue;
      if ((hash2(x, y, seed) % 100) / 100 > 1.15 - d * 1.15) continue;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) setPix(p, x + i, y + j, 0xffffff);
    }
  }
  return p;
}

/**
 * The Haunted Keep seen from afar: a curtain wall, flanking towers with conical roofs, a central keep and a spire,
 * `w` px wide. Returns the stone body, a separate layer of lit windows (so they can glow independent of the light),
 * and a white silhouette. Everything is laid out in fractions of `w` so one function makes every size.
 */
export function makeKeep(w: number): { body: Pix; glow: Pix; mask: Pix } {
  const h = Math.round(w * 0.86);
  const body: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const glow: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const stone = 0x3e3650, light = 0x584e72, roof = 0x2a2238, roofLit = 0x463a5c, gate = 0x14101c;
  const m = Math.max(1, Math.round(w / 30)); // merlon size
  /** Fill [x0,x1) x [y0,y1) measured from the bottom. */
  const rect = (x0: number, x1: number, y0: number, y1: number, c: number, into = body): void => {
    for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) setPix(into, x, h - 1 - y, c);
  };
  /**
   * A crenellated tower from about x0 to x1, `top` high, with a lit left edge. Its width is made odd so it has a
   * center pixel, which is returned so a roof can sit exactly on it (the merlons mirror around it too).
   */
  const tower = (x0: number, x1: number, top: number): number => {
    const a = Math.round(x0);
    let b = Math.round(x1);
    if ((b - a) % 2 === 0) b++;
    const c = a + (b - a - 1) / 2;
    rect(a, b, 0, top - m, stone);
    for (let x = a; x < b; x++) if (Math.floor(Math.abs(x - c) / m) % 2 === 0) rect(x, x + 1, top - m, top, stone);
    rect(a, a + Math.max(1, m / 2), 0, top - m, light);
    return c;
  };
  const cone = (cx: number, halfW: number, base: number, ch: number): void => {
    for (let r = 0; r < ch; r++) {
      const half = Math.round(halfW * (1 - r / ch));
      rect(cx - half, cx + half + 1, base + r, base + r + 1, roof);
      rect(cx - half, cx - half + 1, base + r, base + r + 1, roofLit);
    }
  };
  rect(0, w, 0, h * 0.2, stone); // curtain wall
  for (let x = 0, i = 0; x < w; x += m, i++) if (i % 2 === 0) rect(x, x + m, h * 0.2, h * 0.2 + m, stone);
  tower(w * 0.36, w * 0.64, h * 0.62); // keep
  const mid = tower(w * 0.44, w * 0.56, h * 0.82); // spire tower; the gate lines up with it
  cone(mid, w * 0.08, h * 0.82, h * 0.18);
  cone(tower(w * 0.08, w * 0.26, h * 0.5), w * 0.11, h * 0.5, h * 0.15); // left tower
  cone(tower(w * 0.74, w * 0.92, h * 0.56), w * 0.11, h * 0.56, h * 0.17); // right tower
  const gh = Math.max(1, Math.round(w * 0.05));
  rect(mid - gh, mid + gh + 1, 0, h * 0.13, gate); // gate
  rect(mid - gh + 1, mid + gh, h * 0.13, h * 0.15, gate);
  if (w >= 29) {
    const win = Math.max(1, Math.round(w / 40));
    for (const [wx, wy] of [[0.42, 0.44], [0.54, 0.5], [0.48, 0.34], [0.17, 0.36], [0.83, 0.42], [0.49, 0.7]]) {
      rect(w * wx, w * wx + win, h * wy, h * wy + win * 1.6, 0xffb040, glow);
    }
  }
  return { body, glow, mask: silhouette(body) };
}

/**
 * A rocky peak for a landmark `w` px wide to stand on: a flat top as wide as the landmark, stepping out in ledges
 * toward a wider base. The left faces are lit and the right faces in shadow, with vertical strata and a bright lip on
 * each ledge. Hangs `ch` px below the landmark's base: tall enough to reach well below the horizon, where the ground hides its foot.
 */
export function makeCrag(w: number, ch: number): { body: Pix; mask: Pix } {
  const cw = Math.round(Math.max(w * 1.7, ch)) | 1, cx = cw >> 1; // a tall peak has a broad base
  const body: Pix = { w: cw, h: ch, rgba: new Uint8ClampedArray(cw * ch * 4) };
  const litA = 0x74708a, litB = 0x66627c, shA = 0x4a4660, shB = 0x403c52, ledge = 0x9692ac, edge = 0x2c283c;
  const sh = Math.max(3, Math.round(ch / 7)); // rows per ledge
  const plateau = w / 2 + 1, base = cw / 2 - 1;
  // every size is the same peak: the ledge pattern depends on the ledge index only, scaled by width
  const halves: [number, number][] = [];
  for (let k = 0; k <= Math.ceil(ch / sh); k++) {
    const t = Math.min(1, ((k + 1) * sh) / ch) ** 0.85;
    const grow = plateau + (base - plateau) * t;
    let l = grow + ((hash2(k, 7, 1) % 5) - 2) / 2 * (w / 18), r = grow + ((hash2(k, 7, 2) % 5) - 2) / 2 * (w / 18);
    if (k > 0) { l = Math.max(l, halves[k - 1][0]); r = Math.max(r, halves[k - 1][1]); }
    halves.push([Math.min(base, Math.round(l)), Math.min(base, Math.round(r))]);
  }
  const split = Math.round(cx - w * 0.1); // where the lit faces turn into the shaded ones
  for (let y = 0; y < ch; y++) {
    const k = Math.floor(y / sh);
    let [hl, hr] = halves[k];
    const rag = hash2(Math.floor((y * 40) / ch), 7, 3) % 4; // ragged outline, same rows at every size
    if (rag === 0 && k > 0) hl--; else if (rag === 1 && k > 0) hr--;
    const prev = k > 0 ? halves[k - 1] : halves[0];
    for (let x = cx - hl; x <= cx + hr; x++) {
      const lit = x < split;
      const strata = hash2(Math.round(((x - cx) * 30) / w), k, 4) % 9; // the same strata at every size
      let c = lit ? (strata < 3 ? litB : litA) : strata < 3 ? shB : shA;
      if (y % sh === 0 && (x < cx - prev[0] || x > cx + prev[1] || k === 0)) c = lit ? ledge : litB; // the lip of a ledge catches light
      else if (x === cx + hr || x === cx - hl) c = edge;
      setPix(body, x, y, c);
    }
  }
  return { body, mask: silhouette(body) };
}

/** Draws into a strip, clipping at the edges. Strips keep their objects clear of the edges (see `place`), so any variant can follow any other. */
function clipPlot(p: Pix): (x: number, y: number, c: number) => void {
  return (x, y, c) => setPix(p, Math.round(x), Math.round(y), c);
}

/**
 * `count` x positions across a strip, `margin` px in from each edge, unevenly spaced: mostly tight gaps with the odd wide
 * one, so objects bunch into groups instead of marching along at even intervals.
 */
function scatter(count: number, w: number, margin: number, seed: number): number[] {
  const gaps: number[] = [];
  let total = 0;
  for (let i = 0; i < count - 1; i++) {
    const g = hash2(i, seed, 55) % 100 < 62 ? 2 + (hash2(i, seed, 56) % 7) : 16 + (hash2(i, seed, 57) % 36);
    gaps.push(g);
    total += g;
  }
  const k = (w - 2 * margin) / Math.max(1, total);
  const xs = [margin];
  let acc = 0;
  for (const g of gaps) { acc += g * k; xs.push(Math.round(margin + acc)); }
  return xs;
}

/** Bresenham line through a plot function. */
function line(plot: (x: number, y: number, c: number) => void, x0: number, y0: number, x1: number, y1: number, c: number): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/**
 * A skyline of ruins built from modular pieces: wall segments (crenellated or broken, some with window holes), towers
 * (crenellated, shattered, roofed or flat, with arrow slits), gatehouses, pitched-roof halls with chimneys, buttresses,
 * spires, broken pillars and rubble. Pieces are joined edge to edge into buildings of one to five pieces, with at least
 * one tall piece each, and the buildings bunch into clusters separated by wide gaps. Everything stays 16 px clear of the
 * strip's edges so any variant can follow any other. Torch positions are recorded for the renderer to light.
 */
export function makeRuins(w: number, h: number, seed: number, fill: number, lit: number): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4), lights: [] };
  const plot = clipPlot(p);
  let ctr = 0;
  const R = (mod: number): number => hash2(ctr++, seed, 99) % mod;
  const roof = darken(fill, 0.8), roofLit = darken(lit, 0.9), voidC = 0x0c0a14;
  const MARGIN = 16;
  /** Makes a pixel see-through again (a window or doorway cut through the stone). */
  const clear = (x: number, y: number): void => { if (x >= 0 && y >= 0 && x < w && y < h) p.rgba[(y * w + x) * 4 + 3] = 0; };
  const solid = (x0: number, width: number, top: (i: number) => number, color = fill): void => {
    for (let i = 0; i < width; i++) for (let y = Math.max(0, top(i)); y < h; y++) plot(x0 + i, y, i === 0 ? lit : color);
  };
  const crenel = (i: number): number => (Math.floor(i / 2) % 2 ? 2 : 0); // alternating merlons
  const broken = (i: number, k: number): number => hash2(Math.floor(i / 2) + k, seed, 5) % 5; // a ragged broken top
  /** An arched opening cut through stone: `ow` wide, `oh` tall, left edge at x, standing on the ground. */
  const opening = (x: number, ow: number, oh: number): void => {
    for (let i = 0; i < ow; i++) {
      const d = i - (ow - 1) / 2, rise = Math.round(Math.sqrt(Math.max(0, (ow / 2) ** 2 - d * d)));
      for (let y = h - oh + (Math.round(ow / 2) - rise); y < h; y++) clear(x + i, y);
    }
  };
  type Piece = { w: number; top: number };
  const kinds: [number, (x0: number, maxW: number) => Piece | null][] = [];
  const piece = (weight: number, make: (x0: number, maxW: number) => Piece | null): void => { kinds.push([weight, make]); };

  piece(4, (x0, maxW) => { // wall segment
    const ww = Math.min(maxW, 10 + R(16)), hh = 8 + R(11), isBroken = R(3) !== 0, k = R(50);
    solid(x0, ww, (i) => h - hh + (isBroken ? broken(i, k) : crenel(i)));
    if (hh >= 13 && ww >= 12 && R(2)) opening(x0 + 3 + R(ww - 9), 3, 5); // a window hole
    return { w: ww, top: h - hh };
  });
  piece(4, (x0, maxW) => { // tower
    const tw = Math.min(maxW, 8 + R(6)), kind = R(4), rh = Math.round(tw * 1.1);
    const hh = Math.min(22 + R(22), h - 1 - (kind === 2 ? rh : 0)), k = R(50);
    solid(x0, tw, (i) => h - hh + (kind === 0 ? crenel(i) : kind === 1 ? broken(i, k) : 0));
    if (kind === 2) { // a conical roof
      for (let r = 0; r < rh; r++) {
        const half = Math.round((tw / 2 + 1) * (1 - r / rh));
        for (let x = -half; x <= half; x++) plot(x0 + tw / 2 + x, h - hh - 1 - r, x === -half ? roofLit : roof);
      }
    }
    for (let y = h - hh + 5; y < h - 6; y += 10) { // arrow slits (lit by the renderer)
      for (let j = 0; j < 3; j++) plot(x0 + (tw >> 1), y + j, voidC);
      p.lights!.push({ x: x0 + (tw >> 1), y, w: 1, h: 3 });
    }
    return { w: tw, top: h - hh - (kind === 2 ? rh : 0) };
  });
  piece(2, (x0, maxW) => { // hall with a pitched roof and a chimney
    const hw = Math.min(maxW, 18 + R(14)), hh = 10 + R(8), rise = Math.round(hw / 3.2);
    solid(x0, hw, () => h - hh);
    const cut = R(3) === 0 ? [4 + R(hw - 10), 4 + R(4)] : null; // part of the roof has fallen in
    for (let i = 0; i < hw; i++) {
      let top = h - hh - Math.round(rise * (1 - Math.abs(i - (hw - 1) / 2) / (hw / 2)));
      if (cut && i >= cut[0] && i < cut[0] + cut[1]) top = h - hh;
      for (let y = top; y < h - hh; y++) plot(x0 + i, y, i === 0 ? roofLit : roof);
    }
    const cx = x0 + 3 + R(Math.max(1, hw - 8));
    for (let y = h - hh - rise - 4; y < h - hh - 1; y++) { plot(cx, y, fill); plot(cx + 1, y, fill); }
    for (let i = 3; i < hw - 4; i += 6) { // windows, 2 x 3 (lit by the renderer)
      for (let j = 0; j < 3; j++) { plot(x0 + i, h - hh + 3 + j, voidC); plot(x0 + i + 1, h - hh + 3 + j, voidC); }
      p.lights!.push({ x: x0 + i, y: h - hh + 3, w: 2, h: 3 });
    }
    return { w: hw, top: h - hh - rise };
  });
  piece(2, (x0, maxW) => { // gatehouse
    const gw = Math.min(maxW, 16 + R(8)), hh = 20 + R(14), k = R(50), isBroken = R(2) === 0;
    solid(x0, gw, (i) => h - hh + (isBroken ? broken(i, k) : crenel(i)));
    opening(x0 + ((gw - 8) >> 1), 8, 11);
    return { w: gw, top: h - hh };
  });
  piece(2, (x0) => { // buttress: a slanted fin that leans on a neighbor
    const hh = 8 + R(14);
    solid(x0, 5, (i) => h - hh + Math.round(i * hh * 0.18));
    return { w: 5, top: h - hh };
  });
  piece(1, (x0) => { // spire
    const hh = 28 + R(14);
    for (let y = h - hh; y < h; y++) for (let x = 0; x < 3 - (y - (h - hh) < 5 ? 1 : 0); x++) plot(x0 + x, y, x === 0 ? lit : fill);
    plot(x0 + 1, h - hh - 1, fill);
    return { w: 3, top: h - hh - 1 };
  });
  piece(1.5, (x0, maxW) => { // broken pillars
    const n = Math.min(2 + R(2), Math.floor(maxW / 6));
    let top = h;
    for (let i = 0; i < n; i++) {
      const ph = 8 + R(15);
      solid(x0 + i * 6, 3, () => h - ph);
      top = Math.min(top, h - ph);
    }
    return n > 0 ? { w: n * 6 - 3, top } : null;
  });
  piece(2, (x0, maxW) => { // rubble
    const rw = Math.min(maxW, 8 + R(10)), rh = 3 + R(4);
    solid(x0, rw, (i) => h - Math.round(rh * Math.sin((Math.PI * (i + 0.5)) / rw)) - R(2));
    return { w: rw, top: h - rh };
  });
  const total = kinds.reduce((a, [wt]) => a + wt, 0);
  const pickKind = (): number => {
    let r = (R(1000) / 1000) * total;
    for (let i = 0; i < kinds.length; i++) { r -= kinds[i][0]; if (r < 0) return i; }
    return 0;
  };

  let x = MARGIN + R(14);
  while (x < w - MARGIN - 6) {
    const n = 1 + R(4), anchor = R(n);
    for (let i = 0; i < n; i++) {
      const k = i === anchor ? [1, 2, 3, 5][R(4)] : pickKind(); // the anchor is a tower, hall, gatehouse or spire
      const made = kinds[k][1](x, w - MARGIN - x);
      if (!made) break;
      // a torch on the face of a taller piece
      if (made.w >= 8 && p.lights!.filter((l) => !l.w).length < 5 && R(100) < 45) {
        const tx = x + 2 + R(made.w - 4), ty = made.top + 7 + R(3);
        if (ty < h - 8 && p.rgba[(ty * w + tx) * 4 + 3] > 0) { plot(tx, ty, 0x120e18); plot(tx, ty + 1, 0x120e18); p.lights!.push({ x: tx, y: ty - 2 }); }
      }
      x += made.w - R(2); // pieces overlap by a pixel so they read as one building
      if (x >= w - MARGIN - 6) break;
    }
    x += R(100) < 55 ? 2 + R(7) : 26 + R(50); // next building: often right alongside (a cluster), otherwise a wide gap
  }
  for (let y = h - 3; y < h; y++) for (let x2 = 0; x2 < w; x2++) setPix(p, x2, y, fill);
  return p;
}

/** A seamless line of gnarled dead trees: a wobbling trunk, forking branches and twigs, no leaves. */
export function makeDeadTrees(w: number, h: number, count: number, seed: number, palettes: readonly (readonly [number, number])[]): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const plot = clipPlot(p);
  const rnd = (n: number, salt: number, mod: number): number => hash2(n, seed, salt) % mod;
  const xs = scatter(count, w, 12, seed);
  for (let n = 0; n < count; n++) {
    if (rnd(n, 9, 7) === 0) continue; // a gap
    const [dark, light] = palettes[rnd(n, 4, palettes.length)];
    const cx = xs[n];
    const th = Math.round(h * (0.55 + rnd(n, 2, 40) / 100));
    const lean = (rnd(n, 3, 7) - 3) / 3;
    // the trunk, one pixel thicker near the ground
    let tx = cx;
    for (let y = 0; y < th; y++) {
      tx = cx + lean * y * 0.3 + Math.sin(y * 0.5 + n) * 0.9;
      plot(tx, h - 1 - y, dark);
      if (y < th * 0.45) plot(tx + 1, h - 1 - y, light);
    }
    // branches fork off at three heights, alternating sides, each with a twig
    for (let b = 0; b < 3; b++) {
      const by = Math.round(th * (0.38 + b * 0.22)), side = (b + rnd(n, 5, 2)) % 2 ? 1 : -1;
      const bx = cx + lean * by * 0.3 + Math.sin(by * 0.5 + n) * 0.9;
      const len = 3 + rnd(n * 3 + b, 6, 5) + (b === 0 ? 2 : 0);
      const ex = bx + side * len, ey = h - 1 - by - Math.round(len * 0.7);
      line(plot, bx, h - 1 - by, ex, ey, dark);
      line(plot, ex, ey, ex + side * 2, ey - 2, dark);
      line(plot, (bx + ex) / 2, (h - 1 - by + ey) / 2, (bx + ex) / 2 - side, (h - 1 - by + ey) / 2 - 3, dark);
    }
    // the crown: a short fork at the top
    const topX = cx + lean * th * 0.3 + Math.sin(th * 0.5 + n) * 0.9;
    line(plot, topX, h - th, topX - 2, h - th - 3, dark);
    line(plot, topX, h - th, topX + 2, h - th - 3, dark);
  }
  for (let y = h - 2; y < h; y++) for (let x = 0; x < w; x++) setPix(p, x, y, palettes[0][0]);
  return p;
}

/**
 * A white wisp of ground fog: a lobed, elongated cloud whose density thins toward the rim and is broken up by noise,
 * then ordered-dithered to single pixels so it stays pixel art (tint and fade it when drawn).
 */
export function makeFog(w: number, h: number, seed: number): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      const ang = Math.atan2(dy, dx);
      const r = 0.85 + 0.15 * Math.sin(ang * 2 + seed) + 0.1 * Math.sin(ang * 4 + seed * 2.3);
      const d = Math.hypot(dx, dy) / r;
      if (d >= 1) continue;
      const noise = 0.55 + 0.45 * ((hash2(x >> 2, y >> 1, seed) % 100) / 100);
      const v = (1 - d) ** 0.7 * noise;
      if (v > BAYER4[(y & 3) * 4 + (x & 3)] / 16) setPix(p, x, y, 0xffffff);
    }
  }
  return p;
}

/**
 * A patch of denser growth that blends into the turf: an irregular, lobed area filled with grass-colored pixels that
 * thin out toward the edge (ordered-dithered, so there is no outline), with a sprinkling of accent pixels (flowers,
 * bright clover) inside. Looks like part of the meadow rather than a decal laid on it.
 */
export function makePatch(w: number, h: number, seed: number, base: readonly number[], accents: readonly number[], accentRate: number): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
      const ang = Math.atan2(dy, dx);
      const r = 0.8 + 0.2 * Math.sin(ang * 2 + seed) + 0.15 * Math.sin(ang * 3 + seed * 1.7) + 0.1 * Math.sin(ang * 5 + seed * 2.9);
      const d = Math.hypot(dx, dy) / r;
      if (d >= 1) continue;
      if ((1 - d) ** 0.8 <= BAYER4[(y & 3) * 4 + (x & 3)] / 16) continue; // thins to nothing at the edge
      const n = hash2(x, y, seed);
      const accent = d < 0.85 && (n % 1000) / 1000 < accentRate;
      setPix(p, x, y, accent ? accents[(n >>> 10) % accents.length] : base[(n >>> 10) % base.length]);
    }
  }
  return p;
}

/**
 * Jagged snow-capped peaks: the ridge comes to points (like `makeJagged`), each slope is lit or shaded depending on
 * which way it faces (light from the left), and the upper part of every peak is snow with a ragged snow line over the
 * rock below, which has the odd darker crevasse streak.
 */
export function makeSnowPeaks(w: number, h: number, base: number, amp: number, seed: number, c: { snowLit: number; snowShade: number; rockLit: number; rockShade: number; edge: number }): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const TAU = Math.PI * 2;
  const top: number[] = [];
  for (let x = 0; x < w; x++) {
    const t = (x / w) * TAU;
    const peak = 0.5 * (1 - Math.abs(Math.sin(t * 3 + seed))) + 0.3 * (1 - Math.abs(Math.sin(t * 5 + seed * 2))) + 0.2 * (1 - Math.abs(Math.sin(t * 8 + seed * 0.7)));
    top.push(Math.max(0, Math.round(base - amp * 0.4 + (amp * 0.4 - amp * peak) * edgeEnv(x, w))));
  }
  for (let x = 0; x < w; x++) {
    const lit = top[Math.min(w - 1, x + 1)] - top[Math.max(0, x - 1)] <= 0; // rising to the right: faces the light
    const depth = Math.round((h - top[x]) * 0.38) + (hash2(x >> 1, seed, 3) % 5) - 2; // a ragged snow line
    for (let y = top[x]; y < h; y++) {
      const dy = y - top[x], snow = dy < depth;
      let col = snow ? (lit ? c.snowLit : c.snowShade) : lit ? c.rockLit : c.rockShade;
      if (dy === 0) col = c.edge;
      else if (!snow && hash2(x, 0, seed) % 17 === 0) col = darken(col, 0.85); // a crevasse streak
      setPix(p, x, y, col);
    }
  }
  return p;
}

/** A seamless line of snow-laden pines: each tier of boughs is capped with snow, lit on the left. */
export function makeSnowPines(w: number, h: number, count: number, seed: number, c: { dark: number; light: number; snow: number; snowShade: number }): Pix {
  const p: Pix = { w, h, rgba: new Uint8ClampedArray(w * h * 4) };
  const plot = clipPlot(p);
  const rnd = (n: number, salt: number, mod: number): number => hash2(n, seed, salt) % mod;
  const xs = scatter(count, w, 12, seed);
  for (let n = 0; n < count; n++) {
    if (rnd(n, 9, 8) === 0) continue; // a gap
    const cx = xs[n], th = Math.round(h * (0.55 + rnd(n, 2, 45) / 100));
    const hw = Math.round(th * (0.2 + rnd(n, 3, 12) / 100)) + 2, tiers = 3 + rnd(n, 5, 2), top = h - th;
    for (let y = top; y < h; y++) {
      const u = (y - top) / th, tier = (u * tiers) % 1;
      const half = Math.round(hw * (0.15 + 0.85 * ((Math.floor(u * tiers) + tier * 0.8 + 0.2) / tiers)));
      for (let x = -half; x <= half; x++) {
        const left = x < -half / 3;
        plot(cx + x, y, tier < 0.4 ? (left ? c.snow : c.snowShade) : left ? c.light : c.dark); // snow on the top of each tier
      }
    }
  }
  for (let y = h - 3; y < h; y++) for (let x = 0; x < w; x++) setPix(p, x, y, c.dark);
  return p;
}

/** A sheet of ice on the ground: a pale cyan blob with a few diagonal glints. */
export function makeIce(w: number, h: number, seed: number): Pix {
  const p = makeBlob(w, h, seed, 0xb4d8ee, 0xc8e6f6, 0x8cbcd8);
  for (let k = 0; k < 4; k++) {
    const x0 = 4 + (hash2(k, seed, 1) % Math.max(1, w - 12)), y0 = h - 3 - (hash2(k, seed, 2) % Math.max(1, h - 6)), len = 4 + (hash2(k, seed, 3) % 5);
    for (let i = 0; i < len; i++) {
      const x = x0 + i, y = y0 - (i >> 1);
      if (x >= 0 && y >= 0 && x < w && y < h && p.rgba[(y * w + x) * 4 + 3] > 0) setPix(p, x, y, 0xffffff);
    }
  }
  return p;
}

/** A 16 px snow tile: near-white with a few sparkles, bluish shadow flecks and short wind-rippled streaks. */
export function makeSnow(variant: number): Pix {
  const p: Pix = { w: 16, h: 16, rgba: new Uint8ClampedArray(16 * 16 * 4) };
  const shades = [0xdfe7f1, 0xd8e1ed, 0xe4ecf5]; // a soft blue-grey white, not glaring: heroes' arrows and pale enemies must read against it
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = hash2(x, y, variant + 31);
      let col = shades[r % 3];
      const k = (r >>> 8) % 70;
      if (k === 0) col = 0xf4f8fd; // a sparkle
      else if (k === 1) col = 0xbccadf; // a shadow fleck
      else if (k === 2 && x < 13) { setPix(p, x, y, 0xcddaea); setPix(p, x + 1, y, 0xcddaea); setPix(p, x + 2, y, 0xd3dfee); continue; } // a wind streak
      setPix(p, x, y, col);
    }
  }
  return p;
}
