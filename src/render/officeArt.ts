// The Tally Office (docs/13-ui-art.md), at the heroes' scale: a registry hall so tall that people look small in it, which is the point. Ledger
// shelves with a rolling ladder, the great map of the realm, the Registrar's desk, filing cabinets, a Crown banner, tall windows throwing dusk across
// the boards, and hanging lamps that flicker. 1x rectangles from the Pen, deterministic, animated from the clock only where a flame is.
import { storyWidth } from '../data/storyFont';
import { VIEW_W } from '../sim/constants';
import type { Pen } from './sceneArt';
import { drawStory } from './ui';
import { GLASS } from './uiArt';

const h01 = (n: number): number => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

/** Where the back wall meets the floor, and the floor's far edge. */
const G = 214;
const SPINES = [GLASS.r, GLASS.a, GLASS.n, GLASS.o, 0x43394a, GLASS.b, 0x8a2a1c, 0x5a2e5a, 0x6a5a2a];

/** A soft pool of warm light with a hard-edged, stepped falloff, rows of one pixel. */
function pool(p: Pen, cx: number, cy: number, rx: number, ry: number, a: number): void {
  for (const [k, al] of [[1, 0.07], [0.68, 0.1], [0.38, 0.15]] as const) {
    const w = Math.round(rx * k), h = Math.round(ry * k);
    for (let dy = -h; dy <= h; dy++) {
      const half = Math.round(w * Math.sqrt(1 - (dy * dy) / (h * h + 0.001)));
      p.r(cx - half, cy + dy, half * 2, 1, 0xffb050, al * a);
    }
  }
}

/** The ceiling's underside (the wall rises to here) and the tie beam under it. */
const CEIL = 70;

function vault(p: Pen): void {
  p.r(0, 0, VIEW_W, CEIL, 0x1c1428);
  for (let x = 0; x < VIEW_W; x += 64) { p.r(x + 26, 0, 8, CEIL, 0x2a190f); p.r(x + 26, 0, 1, CEIL, 0x4a2e1e); } // rafters
  p.r(0, CEIL - 10, VIEW_W, 10, 0x2a190f); p.r(0, CEIL - 10, VIEW_W, 1, 0x6a4430); p.r(0, CEIL - 1, VIEW_W, 1, 0x120a08); // the tie beam
  for (let x = 12; x < VIEW_W; x += 64) { p.r(x, CEIL, 10, 3, 0x2a190f); p.r(x + 2, CEIL + 3, 6, 3, 0x2a190f); p.r(x + 4, CEIL + 6, 2, 2, 0x2a190f); } // corbels
}

function wall(p: Pen): void {
  p.r(0, CEIL, VIEW_W, G - CEIL, 0x4e4258);
  for (let y = CEIL + 8, row = 0; y < G - 28; y += 10, row++) { p.r(0, y, VIEW_W, 1, 0x40354a); for (let x = (row & 1) * 16; x < VIEW_W; x += 32) p.r(x, y, 1, 10, 0x40354a); }
  p.r(0, G - 28, VIEW_W, 28, 0x4a3022); // wainscot
  for (let x = 0; x < VIEW_W; x += 22) { p.r(x + 2, G - 25, 18, 20, 0x3e281c); p.r(x + 2, G - 25, 18, 1, 0x5a3c2a); }
  p.r(0, G - 28, VIEW_W, 2, 0x6a4430); p.r(0, G - 3, VIEW_W, 3, 0x2a190f);
}

/** Three bays of ledger shelves, about four heroes high, and a rolling ladder that reaches the top shelf. */
function shelves(p: Pen): void {
  const TOP = 138, BW = 52;
  for (let i = 0; i < 3; i++) {
    const bx = 8 + i * (BW + 2);
    p.r(bx, TOP, BW, G - TOP, 0x2a190f); p.r(bx + 3, TOP + 3, BW - 6, G - TOP - 6, 0x1c120c); // the case and its dark back
    for (let k = 0; k < 5; k++) {
      const sy = G - 4 - k * 14;
      p.r(bx + 3, sy, BW - 6, 2, 0x5a3c2a); p.r(bx + 3, sy, BW - 6, 1, 0x7a5a3a); // a shelf
      let x = bx + 4;
      while (x < bx + BW - 6) {
        const seed = bx * 31 + k * 97 + x;
        if (h01(seed) < 0.07) { x += 4; continue; } // a gap
        const w = 2 + Math.floor(h01(seed + 1) * 3), h = 8 + Math.floor(h01(seed + 2) * 4), col = SPINES[Math.floor(h01(seed + 3) * SPINES.length)];
        p.r(x, sy - h, w, h, col); p.r(x, sy - h, 1, h, 0xffffff, 0.12); p.r(x, sy - h + 2, w, 1, 0xefbd44, 0.7); p.r(x, sy - 3, w, 1, 0xefbd44, 0.45);
        x += w;
      }
    }
    p.r(bx, TOP, 2, G - TOP, 0x3a2418); p.r(bx + BW - 2, TOP, 2, G - TOP, 0x3a2418); p.r(bx - 1, TOP - 3, BW + 2, 4, 0x3a2418); p.r(bx - 1, TOP - 3, BW + 2, 1, 0x6a4430); // frame and cornice
  }
  p.r(6, TOP - 6, 162, 2, 0xa8791f); p.r(6, TOP - 6, 162, 1, 0xefbd44); // the brass rail the ladder rides on, along the tops of the cases
  const lx = 112, lean = 7; // the ladder: its feet lean out from the case, its top hooks on the rail, with a wheel at each hook
  for (let y = TOP - 4; y < G; y++) { const dx = Math.round(((y - (TOP - 4)) * lean) / (G - TOP + 4)); p.r(lx + dx, y, 2, 1, 0x8a6a46); p.r(lx + dx + 9, y, 2, 1, 0x6a4a30); }
  for (let y = TOP + 2; y < G - 2; y += 6) { const dx = Math.round(((y - (TOP - 4)) * lean) / (G - TOP + 4)); p.r(lx + dx, y, 11, 2, 0xa88a60); p.r(lx + dx, y, 11, 1, 0xc8aa80); }
  for (const dx of [0, 9]) { p.r(lx + dx - 1, TOP - 8, 4, 3, 0xefbd44); p.r(lx + dx, TOP - 7, 2, 1, 0xa8791f); }
  p.r(lx + lean - 1, G - 2, 4, 2, 0x2a190f); p.r(lx + lean + 8, G - 2, 4, 2, 0x2a190f); // its rubber feet
}

/** The great map of the realm, framed, with a walled capital, forests, mountains, a road and the title. */
function greatMap(p: Pen): void {
  const X = 178, Y = 112, W = 106, H = 66;
  p.r(X + 2, Y + 2, W, H, 0x000000, 0.3);
  p.r(X, Y, W, H, 0x2a190f); p.r(X + 2, Y + 2, W - 4, H - 4, 0xa8791f); p.r(X + 3, Y + 3, W - 6, H - 6, 0x2a190f);
  const mx = X + 5, my = Y + 5, mw = W - 10, mh = H - 10;
  p.r(mx, my, mw, mh, 0xe8dcc0);
  for (let y = my + 4; y < my + mh; y += 5) p.r(mx, y, mw, 1, 0xd9ccb0);
  const blobs: [number, number, number, number][] = [[32, 30, 27, 17], [62, 24, 19, 13], [22, 42, 13, 8], [46, 41, 17, 8]];
  const land = (x: number, y: number): boolean => blobs.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 + 0.32 * Math.sin(x * 0.55 + y * 0.8) * Math.cos(y * 0.4));
  for (let y = 0; y < mh; y++) {
    let x = 0;
    while (x < mw) {
      if (!land(x, y)) { x++; continue; }
      let e = x; while (e < mw && land(e, y)) e++;
      p.r(mx + x, my + y, e - x, 1, 0xcdbd90);
      p.r(mx + x, my + y, 1, 1, 0x8a6a46); p.r(mx + e - 1, my + y, 1, 1, 0x8a6a46);
      x = e;
    }
  }
  for (const [fx, fy] of [[38, 20], [44, 23], [50, 19], [32, 36], [38, 39], [66, 19], [72, 23]] as const) { p.r(mx + fx, my + fy, 2, 2, 0x2c7554); p.r(mx + fx, my + fy - 1, 1, 1, 0x2c7554); }
  for (const [qx, qy] of [[60, 30], [66, 33], [72, 29]] as const) { p.peak(mx + qx, my + qy, 5, 4, 0x6a5a6a); p.r(mx + qx, my + qy - 3, 1, 1, 0xf4ead2); }
  for (let k = 0; k < 16; k++) p.r(mx + 24 + k * 2, my + 29 - Math.round(Math.sin(k * 0.45) * 3) + (k > 9 ? k - 9 : 0), 1, 1, 0x7a5a3a);
  for (let a = 0; a < 30; a++) p.r(mx + 19 + Math.round(Math.cos(a / 4.8) * 7), my + 32 + Math.round(Math.sin(a / 4.8) * 5), 1, 1, a % 2 ? GLASS.R : GLASS.r); // the capital's walls
  p.r(mx + 18, my + 31, 2, 2, GLASS.R);
  for (const [tx, ty] of [[54, 38], [72, 38], [62, 21], [40, 46]] as const) { p.r(mx + tx, my + ty, 2, 2, GLASS.r); p.r(mx + tx, my + ty - 1, 2, 1, GLASS.Y); }
  p.r(mx + mw - 12, my + mh - 11, 7, 1, 0x6a5a6a); p.r(mx + mw - 9, my + mh - 14, 1, 7, 0x6a5a6a); p.r(mx + mw - 9, my + mh - 15, 1, 2, GLASS.r); // the compass
  const t = 'THE REALM';
  drawStory(p.b, p.S, t, Math.round(X + W / 2 - storyWidth(t) / 2), Y + 6, GLASS.r);
  for (const x of [X + 8, X + W - 8]) { p.r(x - 2, Y - 6, 5, 3, 0xa8791f); p.r(x, Y - 12, 1, 6, 0x6a5a6a); } // the brass hangers
}

/** Two arched windows onto the dusk, mid-wall, and the slanting light they send down the wall and across the boards. */
function windows(p: Pen): void {
  for (const wx of [320, 358]) {
    const wy = 118, ww = 24, wh = 48, R = ww / 2;
    p.r(wx - 3, wy, ww + 6, wh, 0x2a190f);
    for (let j = 0; j < R; j++) { // the arch above
      const half = Math.round(R * Math.sqrt(1 - ((R - 1 - j) / R) ** 2));
      p.r(wx + R - half - 3, wy - R + j, half * 2 + 6, 1, 0x2a190f);
      p.r(wx + R - half, wy - R + j, half * 2, 1, 0x2b2058);
    }
    p.r(wx, wy, ww, wh, 0x2b2058);
    [0x2b2058, 0x4a2f6e, 0x8a4a78, 0xc9707a, 0xe8a060].forEach((c, i) => p.r(wx, wy + Math.round((i * wh) / 5), ww, Math.ceil(wh / 5) + 1, c));
    for (let rx = 0; rx < ww; rx += 8) { const hh = 6 + Math.round(h01(wx + rx) * 12); p.r(wx + rx, wy + wh - hh, 7, hh, 0x2a2044); p.peak(wx + rx + 3, wy + wh - hh, 9, 4, 0x231a3a); }
    p.r(wx + 11, wy - R, 2, wh + R, 0x2a190f); p.r(wx, wy + 16, ww, 2, 0x2a190f); p.r(wx, wy + 32, ww, 2, 0x2a190f);
    p.r(wx - 4, wy + wh, ww + 8, 3, 0x6a4430);
    for (let y = wy + wh + 3; y < 262; y++) p.r(wx + 3 + Math.round((y - wy - wh) * 0.5), y, 18, 1, 0xffd9a0, y > G ? 0.07 : 0.045);
  }
}

function banner(p: Pen): void {
  const x = 596, w = 22, top = CEIL + 6;
  p.r(x - 3, top, w + 6, 3, 0x2a190f); p.r(x - 4, top - 1, 3, 5, 0xa8791f); p.r(x + w + 1, top - 1, 3, 5, 0xa8791f);
  p.r(x, top + 3, w, 54, GLASS.R); p.r(x, top + 3, 3, 54, GLASS.r); p.r(x + w - 3, top + 3, 3, 54, GLASS.r); p.r(x, top + 3, w, 2, GLASS.Y);
  p.peak(x + w / 2, top + 57, w, 8, 0x4a1020); p.r(x + w / 2 - 1, top + 53, 3, 4, GLASS.R);
  p.r(x + 5, top + 16, 12, 1, GLASS.Y); p.r(x + 5, top + 12, 1, 5, GLASS.Y); p.r(x + 16, top + 12, 1, 5, GLASS.Y); p.r(x + 10, top + 10, 1, 7, GLASS.Y); // a crown
  p.r(x + 8, top + 30, 6, 6, GLASS.G); p.r(x + 10, top + 32, 2, 2, GLASS.r); // a seal
}

/** A bank of filing cabinets: drawers with brass labels. */
function cabinets(p: Pen): void {
  const X = 552, Y = 162, W = 88;
  p.r(X, Y, W, G - Y, 0x4a4660); p.r(X, Y, W, 2, 0x6a6682); p.r(X, G - 2, W, 2, 0x2a2638);
  for (let c = 0; c < 5; c++) for (let r = 0; r < 4; r++) {
    const dx = X + 2 + c * 17, dy = Y + 4 + r * 12;
    p.r(dx, dy, 15, 10, 0x3a3652); p.r(dx, dy, 15, 1, 0x5a5672); p.r(dx + 4, dy + 2, 7, 3, 0xa8791f); p.r(dx + 5, dy + 3, 5, 1, 0xefbd44); p.r(dx + 6, dy + 7, 3, 1, 0x1a1030);
  }
}

/** The Registrar's desk, small and plain: a leather top, an open ledger, a stack of closed ones, ink and quill, and a green-shaded lamp. */
function desk(p: Pen): void {
  const X = 424, W = 48, T = 238;
  p.r(X, T, W, 3, 0x8a6a46); p.r(X, T, W, 1, 0xa88a60); p.r(X + 2, T + 1, W - 4, 2, 0x2c5a4a);
  p.r(X + 1, T + 3, W - 2, 10, 0x4a3022); p.r(X + 1, T + 3, W - 2, 1, 0x2a190f);
  for (const dx of [4, 26]) { p.r(X + dx, T + 5, 18, 6, 0x5a3c2a); p.r(X + dx, T + 5, 18, 1, 0x7a5a3a); p.r(X + dx + 8, T + 8, 3, 1, 0xefbd44); }
  p.r(X + 3, T + 13, 4, 3, 0x2a190f); p.r(X + W - 7, T + 13, 4, 3, 0x2a190f);
  p.r(X + 3, T - 4, 13, 4, 0xf4ead2); p.r(X + 9, T - 4, 1, 4, 0xcfc09f); p.r(X + 4, T - 3, 4, 1, 0x6a5a6a); p.r(X + 11, T - 3, 4, 1, 0x6a5a6a); // an open ledger
  for (const [bw, by, col] of [[10, T - 2, GLASS.r], [9, T - 4, GLASS.a], [8, T - 6, GLASS.n]] as const) { p.r(X + 19, by, bw, 2, col); p.r(X + 19, by, bw, 1, 0xffffff, 0.14); }
  p.r(X + 31, T - 3, 3, 3, 0x1a1030); p.r(X + 33, T - 9, 1, 6, 0xf4ead2); p.r(X + 34, T - 8, 1, 4, 0xcfc09f); // inkwell and quill
  const fl = 0.5 + 0.3 * Math.sin(p.tick * 0.12) + 0.2 * Math.sin(p.tick * 0.37);
  p.r(X + 40, T - 2, 4, 2, 0x4a3a1a); p.r(X + 41, T - 8, 1, 6, 0xa8791f); p.r(X + 38, T - 11, 7, 3, 0x2c7554); p.r(X + 38, T - 11, 7, 1, 0x5fb88a); p.r(X + 39, T - 8, 5, 1, 0xffe08a, 0.5 + fl * 0.4);
  pool(p, X + 41, T - 4, 13, 7, 0.7 + fl * 0.5);
}

/** The clerks' standing desk and stool at the left, with a small heap of ledgers on the floor. */
function clerkCorner(p: Pen): void {
  p.r(14, 237, 30, 3, 0x6a4430); p.r(14, 237, 30, 1, 0x8a6a46);
  p.r(16, 240, 2, 13, 0x4a3022); p.r(40, 240, 2, 13, 0x4a3022); p.r(16, 246, 26, 1, 0x4a3022);
  p.r(20, 233, 10, 4, 0xf4ead2); p.r(20, 236, 10, 1, 0xcfc09f); p.r(22, 234, 5, 1, 0x6a5a6a); p.r(34, 234, 2, 3, 0x1a1030);
  p.r(52, 245, 8, 2, 0x6a4430); p.r(53, 247, 1, 6, 0x4a3022); p.r(58, 247, 1, 6, 0x4a3022);
  for (const [x, y, w, col] of [[66, 250, 12, GLASS.a], [67, 247, 10, GLASS.r], [68, 244, 9, GLASS.n]] as const) { p.r(x, y, w, 3, col); p.r(x, y, w, 1, 0xffffff, 0.14); p.r(x + 1, y + 1, w - 2, 1, 0xefbd44, 0.6); }
}

/** The floor: boards, a long red runner with gold edges, and three hanging lamps with their cones of light. */
function floorAndLamps(p: Pen): void {
  p.r(0, G, VIEW_W, 262 - G, 0x4a2e1e);
  for (let y = G, row = 0; y < 262; y += 7, row++) { p.r(0, y, VIEW_W, 1, 0x2e1c12); if (row) for (let x = (row * 37) % 52; x < VIEW_W; x += 52) p.r(x, y, 1, 7, 0x2e1c12); if (row & 1) p.r(0, y + 3, VIEW_W, 1, 0x553620, 0.5); }
  p.r(0, G, VIEW_W, 1, 0x1a0e08);
  p.r(24, 244, VIEW_W - 24, 18, 0x7a1a35); p.r(24, 244, VIEW_W - 24, 1, GLASS.Y); p.r(24, 246, VIEW_W - 24, 1, 0xa8791f); p.r(24, 259, VIEW_W - 24, 1, 0xa8791f); p.r(24, 261, VIEW_W - 24, 1, GLASS.Y);
  for (let x = 40; x < VIEW_W; x += 28) { p.r(x, 251, 6, 1, GLASS.R); p.r(x + 2, 249, 2, 5, GLASS.R); p.r(x - 1, 251, 8, 1, 0x5a1228); }
  for (const [lx, ph] of [[92, 0], [300, 1.7], [452, 3.1]] as const) {
    const fl = 0.5 + 0.3 * Math.sin(p.tick * 0.13 + ph) + 0.2 * Math.sin(p.tick * 0.39 + ph * 3);
    for (let y = CEIL; y < 96; y += 3) p.r(lx, y, 1, 2, 0x1a1030); // the chain
    p.r(lx - 6, 96, 13, 2, 0x2a190f); p.r(lx - 4, 92, 9, 4, 0x6a5a2a); p.r(lx - 2, 89, 5, 3, 0x8a7a3a);
    p.r(lx - 5, 98, 11, 3, fl > 0.55 ? 0xffd566 : 0xefbd44); p.r(lx - 2, 101, 5, 1, 0xfff0a0, 0.7);
    for (let y = 102; y < 146; y++) p.r(lx - 5 - Math.round((y - 102) * 0.4), y, 11 + Math.round((y - 102) * 0.8), 1, 0xffb050, (0.05 + 0.04 * fl) * (1 - (y - 102) / 44));
    pool(p, lx, 106, 13, 6, 0.8 + fl * 0.6);
  }
}

/** The whole room, back to front. */
export function drawOffice(p: Pen): void {
  vault(p);
  wall(p);
  shelves(p);
  greatMap(p);
  windows(p);
  banner(p);
  cabinets(p);
  floorAndLamps(p);
  desk(p);
  clerkCorner(p);
}
