// The street behind the notice board (docs/13-ui-art.md): a hand-composed row of distinct buildings at the heroes' own scale (a hero is about
// 20 px of art, so a door is 17 px tall and 9 wide with its frame, and a window 7x9), over a hazy skyline. Each house is a spec (walls, roof, trim, what hangs on it) drawn by
// one function, so they share a craft but not a shape. Everything is 1x rectangles from the Pen, deterministic, and animated from the clock only
// where it should be: chimney smoke, a swinging sign, flickering door lanterns.
import type { Pen } from './sceneArt';

const h01 = (n: number): number => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
/** Mix two 0xRRGGBB colours (t = 0 is a, 1 is b). */
const mix = (a: number, b: number, t: number): number => {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

type Roof = 'gable' | 'steep' | 'hip' | 'flat';
interface House {
  x: number; w: number; h: number;
  plaster: number; beam: number; roofCol: number; roof: Roof; roofH: number;
  seed: number;
  /** Stone foundation height. */
  stone?: number;
  /** The upper floor overhangs the street. */
  jetty?: boolean;
  braces?: boolean;
  shutters?: number;
  /** Window boxes: the flower colour. */
  flowers?: number;
  awning?: readonly [number, number];
  door?: 'arch' | 'square' | 'round';
  /** x of the door's centre from the house's left edge (default: the middle). */
  doorAt?: number;
  /** x of the chimney from the left edge; it smokes. */
  chimney?: number;
  sign?: 'mug' | 'loaf';
  dormer?: boolean;
  /** A round tower at the right corner: its width and how far it stands above the roof ridge, and its cone's colour. */
  tower?: { w: number; up: number; cone: number };
  /** Crimson banners hanging at the front. */
  banners?: boolean;
  /** Floors count the lit windows are laid out in (default by height). */
  floors?: number;
}

/** A tiled roof: a peak (or a flat parapet) with eaves, courses that follow the slope and the lit side lighter. */
function roofOf(p: Pen, s: House, top: number): void {
  const cx = s.x + s.w / 2, over = s.roof === 'steep' ? 3 : 5;
  const dark = mix(s.roofCol, 0x000000, 0.25), light = mix(s.roofCol, 0xffffff, 0.14);
  if (s.roof === 'flat') {
    p.r(s.x - 2, top - 4, s.w + 4, 4, dark); // a parapet with merlons
    for (let x = s.x - 2; x < s.x + s.w + 2; x += 10) p.r(x, top - 9, 6, 5, dark);
    p.r(s.x - 2, top - 4, s.w + 4, 1, light);
    return;
  }
  const w = s.w + over * 2, H = s.roofH;
  if (s.roof === 'hip') {
    for (let i = 0; i < H; i++) { const ww = Math.round(w - (w * 0.45) * (i / H)); p.r(cx - ww / 2, top - i, ww, 1, i % 4 === 3 ? dark : s.roofCol); }
    p.r(cx - w * 0.275, top - H, w * 0.55, 2, dark);
    for (let i = 0; i < H; i += 1) p.r(cx - Math.round(w - (w * 0.45) * (i / H)) / 2, top - i, 2, 1, light);
    return;
  }
  for (let i = 0; i < H; i++) {
    const ww = Math.max(2, Math.round(w * (1 - i / H)));
    p.r(cx - ww / 2, top - i, ww, 1, i % 4 === 3 ? dark : s.roofCol);
    p.r(cx - ww / 2, top - i, Math.min(ww, 2), 1, light); // the lit eave
    p.r(cx + ww / 2 - 1, top - i, 1, 1, dark); // the shaded one
  }
  p.r(cx - 1, top - H, 2, 2, dark);
  p.r(cx - w / 2, top, w, 2, dark); // the eave's underside
}

/** A filled disc of pixels, rows of exact width (a pixel circle, not a square). */
function disc(p: Pen, cx: number, cy: number, r: number, color: number, alpha: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt((r + 0.5) * (r + 0.5) - dy * dy));
    p.r(cx - half, cy + dy, half * 2 + 1, 1, color, alpha);
  }
}

/**
 * Chimney smoke: a slow column of round puffs, all rising at the same gentle speed from evenly spaced starting points, close together. They start small and warm at
 * the chimney's mouth, swell and cool as they climb (so neighbours overlap), lean with the breeze, and fade out high in the sky. Oldest (biggest) first.
 */
function smoke(p: Pen, x: number, y: number, seed: number): void {
  const RISE = 92, COUNT = 17, SPEED = 0.1; // px climbed before a puff is gone, puffs in the column (about 5 px apart), px a tick
  const puffs: { t: number; k: number }[] = [];
  for (let k = 0; k < COUNT; k++) puffs.push({ t: ((p.tick * SPEED + k * (RISE / COUNT) + h01(seed) * RISE) % RISE) / RISE, k });
  puffs.sort((a, b) => b.t - a.t);
  for (const { t, k } of puffs) {
    const r = 2 + Math.round(t * 6), sway = Math.sin(p.tick * 0.012 + k * 1.3 + seed) * (1 + t * 2.5);
    disc(p, Math.round(x + t * 24 + sway), Math.round(y - t * RISE), r, mix(0xc8b0b4, 0x8a7aa4, t), 0.4 * Math.min(1, (1 - t) * 2.6));
  }
}

const SIGN_ICONS: Record<'mug' | 'loaf', { face: number; rows: readonly string[] }> = {
  mug: { face: 0x8a5a2e, rows: ['............', '...BBBB.....', '...WWWW.WW..', '...WwwW.W.W.', '...WwwW.W.W.', '...WwwW.WW..', '...WWWW.....', '............'] },
  loaf: { face: 0xa87a46, rows: ['............', '...gGGGg....', '..gGGgGGg...', '..GGGGGGG...', '..gGGGGGg...', '...ggggg....', '............', '............'] },
};
const ICON_COL: Record<string, number> = { B: 0xfff6d8, W: 0xe8dcc0, w: 0xb8a888, G: 0xe8c070, g: 0xb88a40 };

/**
 * A tavern or shop sign on an iron bracket: a plate on the wall at x = `wx`, a 2 px arm running left with a brace under it and a curled end, two hooks
 * on the arm, short chains pinned to the hooks and a board hanging from them. The board swings from the hooks (its top row stays put, each row below
 * leans a little further), so it stays attached as it moves.
 */
function hangingSign(p: Pen, wx: number, ay: number, kind: 'mug' | 'loaf', seed: number): void {
  const IRON = 0x1a1030, left = wx - 24, ic = SIGN_ICONS[kind];
  p.r(wx, ay - 3, 3, 18, IRON); // the plate on the wall
  p.r(left, ay, wx - left, 2, IRON); // the arm
  for (let k = 0; k < 8; k++) p.r(wx - 1 - k, ay + 2 + k, 1, 1, IRON); // the brace under it
  p.r(left, ay + 2, 1, 3, IRON); p.r(left + 1, ay + 4, 2, 1, IRON); // a curl at the end
  const hooks = [left + 6, left + 17];
  const sway = Math.sin(p.tick * 0.045 + seed * 1.7) * 1.6 + Math.sin(p.tick * 0.11 + seed) * 0.4;
  for (const hx of hooks) { p.r(hx - 1, ay + 2, 3, 1, IRON); for (let c = 0; c < 3; c++) p.r(hx, ay + 3 + c, 1, 1, c & 1 ? 0x5a526e : IRON); } // the hook and its chain, fixed at the arm
  const bx = left + 4, bw = 19, by = ay + 6, rows = 10;
  for (let r = 0; r < rows; r++) {
    const dx = Math.round((sway * r) / (rows - 1));
    const edge = r === 0 || r === rows - 1;
    p.r(bx + dx, by + r, bw, 1, edge ? 0x3a2418 : 0x3a2418);
    if (!edge) {
      p.r(bx + dx + 1, by + r, bw - 2, 1, ic.face);
      const row = ic.rows[r - 1] ?? '';
      for (let x = 0; x < row.length; x++) { const c = ICON_COL[row[x]]; if (c !== undefined) p.r(bx + dx + 3 + x, by + r, 1, 1, c); }
    }
  }
  p.r(bx + Math.round(sway), by + rows, bw, 1, 0x000000, 0.28); // the shadow it throws
}

/** One building, its feet on `g`. */
function house(p: Pen, g: number, s: House): void {
  const stone = s.stone ?? 0, top = g - s.h, shade = mix(s.plaster, 0x1a1030, 0.28);
  // walls: the plaster, a shaded right-hand strip, and (if the upper floor jetties) the overhang
  const jx = s.jetty ? 3 : 0, jy = g - 38;
  p.r(s.x, top, s.w, s.h - stone, s.plaster);
  if (s.jetty) { p.r(s.x - jx, top, s.w + jx * 2, jy - top, s.plaster); p.r(s.x - jx, jy - 2, s.w + jx * 2, 2, s.beam); for (let cx = s.x; cx < s.x + s.w; cx += 12) p.r(cx, jy, 3, 3, s.beam); }
  p.r(s.x + s.w - 8 + jx * 0, top, 8, s.h - stone, shade);
  if (s.jetty) p.r(s.x + s.w - 8 + jx, top, 8 - 0, jy - top, shade);
  // the timber frame: corner posts, a post per panel and a rail at each floor; X-braces in the upper panels
  const floors = s.floors ?? Math.max(2, Math.round((s.h - stone) / 30));
  const panelW = Math.max(18, Math.round(s.w / Math.max(2, Math.round(s.w / 26))));
  p.r(s.x, top, 2, s.h - stone, s.beam); p.r(s.x + s.w - 2, top, 2, s.h - stone, s.beam);
  for (let x = s.x + panelW; x < s.x + s.w - 4; x += panelW) p.r(x, top, 2, s.h - stone, s.beam);
  const floorH = (s.h - stone) / floors;
  for (let f = 1; f < floors; f++) p.r(s.x - jx, Math.round(top + f * floorH), s.w + jx * 2, 2, s.beam);
  if (s.braces) {
    const fh = Math.round(floorH);
    for (let x = s.x + 2; x + panelW <= s.x + s.w - 2; x += panelW) for (let k = 0; k < fh - 4; k++) {
      p.r(x + 2 + Math.round((k * (panelW - 4)) / (fh - 4)), top + 2 + k, 1, 1, s.beam);
      p.r(x + panelW - 3 - Math.round((k * (panelW - 4)) / (fh - 4)), top + 2 + k, 1, 1, s.beam);
    }
  }
  // the foundation: stone courses
  if (stone) {
    p.r(s.x, g - stone, s.w, stone, 0x5a5468); p.r(s.x, g - stone, s.w, 1, 0x7a748a);
    for (let y = g - stone + 3, row = 0; y < g; y += 3, row++) { p.r(s.x, y, s.w, 1, 0x403a52); for (let x = s.x + (row & 1) * 5; x < s.x + s.w; x += 10) p.r(x, y - 3, 1, 3, 0x403a52); }
  }
  // doors
  const doorX = s.x + Math.round(s.doorAt ?? s.w / 2);
  const DOOR_H = 17, doorTop = g - DOOR_H; // every door is a hero's height, 9 wide and 17 tall with its frame, standing on the ground line whatever the foundation under its house
  const lanterns: number[] = [];
  if (s.door) {
    const arch = s.door !== 'square';
    p.r(doorX - 4, doorTop, 9, DOOR_H, s.beam); // the frame
    p.r(doorX - 3, doorTop + (arch ? 2 : 1), 7, DOOR_H - (arch ? 2 : 1), 0x1d1226); // the dark of the doorway
    if (arch) p.r(doorX - 2, doorTop + 1, 5, 1, 0x1d1226); // the arch
    p.r(doorX, doorTop + 4, 1, DOOR_H - 4, 0x2e2036); // the join of the leaves
    p.r(doorX + 2, g - 6, 1, 2, 0xefbd44); // the handle
    p.r(doorX - 5, g - 2, 11, 2, 0x55496a); // the step
    lanterns.push(doorX - 7, doorX + 7);
  }
  // windows, by floor: each a framed pane, lit or dark, with shutters and a flower box where the house has them
  for (let f = 0; f < floors; f++) {
    const y0 = Math.round(top + f * floorH), yWin = y0 + 8 + (f === 0 ? 0 : 0);
    const gf = f === floors - 1; // the ground floor
    const n = Math.max(1, Math.floor((s.w - 8) / 20));
    for (let k = 0; k < n; k++) {
      const wx = s.x + Math.round(((k + 0.5) * s.w) / n) - 3;
      if (gf && s.door && Math.abs(wx + 3 - doorX) < 10) continue;
      if (yWin + 13 > g - stone) continue;
      const lit = h01(s.seed * 97 + k * 13 + f * 5) > 0.3;
      p.r(wx - 1, yWin - 1, 9, 11, s.beam);
      p.r(wx, yWin, 7, 9, lit ? 0xefbd44 : 0x1a1330);
      if (lit) {
        p.r(wx + 3, yWin, 1, 9, 0xb98a2a); p.r(wx, yWin + 4, 7, 1, 0xb98a2a); p.r(wx, yWin, 7, 2, 0xffe08a);
        p.r(wx - 3, yWin - 3, 13, 15, 0xefbd44, 0.07);
        if (h01(s.seed + k * 7 + f) > 0.6) p.r(wx + 1, yWin + 5, 3, 4, 0xb0455a); // a curtain
      } else p.r(wx + 3, yWin, 1, 9, 0x2e2548);
      if (s.shutters !== undefined) { p.r(wx - 3, yWin - 1, 2, 11, s.shutters); p.r(wx + 8, yWin - 1, 2, 11, s.shutters); p.r(wx - 3, yWin + 2, 2, 1, mix(s.shutters, 0, 0.4)); p.r(wx + 8, yWin + 2, 2, 1, mix(s.shutters, 0, 0.4)); }
      if (s.flowers !== undefined && f > 0) {
        p.r(wx - 1, yWin + 10, 9, 3, 0x4a2e1e);
        for (let q = 0; q < 4; q++) p.r(wx + q * 2, yWin + 9 - (q & 1), 1, 1, h01(s.seed + q + k) > 0.5 ? s.flowers : 0x4a8a4a);
      }
    }
  }
  if (s.awning) { // a striped awning over the shop front
    const ax = s.x + 4, aw = s.w - 8, ay = g - stone - 21;
    for (let x = 0; x < aw; x += 5) p.r(ax + x, ay, Math.min(5, aw - x), 7, (x / 5) & 1 ? s.awning[1] : s.awning[0]);
    for (let x = 0; x < aw; x += 5) p.r(ax + x, ay + 7, Math.min(5, aw - x), 2, (x / 5) & 1 ? s.awning[1] : s.awning[0]);
    for (let x = 1; x < aw; x += 5) p.r(ax + x, ay + 9, 3, 1, (x / 5) & 1 ? s.awning[1] : s.awning[0]);
    p.r(ax, ay + 10, aw, 1, 0x000000, 0.3);
  }
  // the roof and what stands on it
  roofOf(p, s, top);
  if (s.dormer) {
    const dx = s.x + Math.round(s.w * 0.3), dy = top - Math.round(s.roofH * 0.42);
    p.r(dx - 6, dy - 8, 12, 9, mix(s.plaster, 0, 0.1)); p.r(dx - 3, dy - 6, 6, 6, 0xefbd44); p.r(dx, dy - 6, 1, 6, 0xb98a2a);
    for (let i = 0; i < 5; i++) { const ww = 14 - i * 3; p.r(dx - ww / 2, dy - 8 - i, Math.max(2, ww), 1, s.roofCol); }
  }
  if (s.banners) for (const bx of [s.x + 8, s.x + s.w - 14]) { p.r(bx, top + 14, 6, 26, 0xc23458); p.r(bx, top + 14, 6, 2, 0xefbd44); p.r(bx + 2, top + 22, 2, 2, 0xefbd44); p.peak(bx + 3, top + 40, 6, 3, 0x7a1a35); p.r(bx - 1, top + 12, 8, 2, 0x4a2e1e); }
  if (s.sign) hangingSign(p, s.x + s.w - 6, g - 30, s.sign, s.seed);
  if (s.tower) { // a round tower with a cone roof, at the right corner
    const t = s.tower, tx = s.x + s.w - t.w + 4, tt = top - t.up;
    p.r(tx, tt, t.w, t.up + s.h - stone, mix(s.plaster, 0x5a5468, 0.5)); p.r(tx + t.w - 5, tt, 5, t.up + s.h - stone, mix(s.plaster, 0x1a1030, 0.5));
    for (let y = tt + 6; y < top + 20; y += 8) p.r(tx, y, t.w, 1, 0x403a52);
    p.r(tx + t.w / 2 - 1, tt + 8, 3, 7, 0x1a1330); p.r(tx + t.w / 2, tt + 9, 1, 5, 0xefbd44);
    for (let i = 0; i < 22; i++) { const ww = Math.max(2, Math.round((t.w + 6) * (1 - i / 22))); p.r(tx + t.w / 2 - ww / 2, tt - i, ww, 1, i % 4 === 3 ? mix(t.cone, 0, 0.25) : t.cone); }
    p.r(tx + t.w / 2, tt - 28, 1, 6, 0x1a1030); p.r(tx + t.w / 2 + 1, tt - 28, 5 + Math.round(Math.sin(p.tick * 0.12)), 3, 0xc23458);
  }
  if (s.chimney !== undefined) {
    const cx = s.x + s.chimney, cy = top - Math.round(s.roofH * 0.6) - 8;
    p.r(cx, cy, 7, 14, 0x8a4a40); p.r(cx + 5, cy, 2, 14, 0x5e3030); p.r(cx, cy, 1, 14, 0xa86a58); // brick, lit on the left and shaded on the right
    for (let y = cy + 3; y < cy + 14; y += 3) p.r(cx, y, 7, 1, 0x4a2828, 0.55); // courses
    p.r(cx - 1, cy - 2, 9, 2, 0x3a2430); p.r(cx - 1, cy - 2, 9, 1, 0x7a5060); // the cap and its lit edge
    smoke(p, cx + 3, cy - 3, s.seed);
  }
  // a lantern at each side of the door, flickering at its own rate, its light a pool on the wall and the cobbles
  lanterns.forEach((lx, i) => {
    const fl = 0.5 + 0.3 * Math.sin(p.tick * 0.14 + s.seed + i * 2) + 0.2 * Math.sin(p.tick * 0.43 + i * 5);
    const ly = doorTop + 4;
    p.r(lx - 1, ly - 3, 2, 3, 0x1a1030); p.r(lx - 2, ly, 4, 6, 0x1a1030); p.r(lx - 1, ly + 1, 2, 4, fl > 0.55 ? 0xffd566 : 0xefbd44);
    for (const [k, a] of [[9, 0.05], [6, 0.08], [3, 0.14]] as const) p.r(lx - k, ly + 3 - k, k * 2, k * 2, 0xffb050, a * (0.7 + fl * 0.6));
  });
}

/** The skyline far behind: simple, pale with the dusk haze, a bell tower and a spire among the roofs, a few lit windows. */
function skyline(p: Pen, g: number): void {
  const col = 0x4a3a66, haze = 0x8a5a8a;
  const spec: [number, number, number, 'gable' | 'steep' | 'flat' | 'spire'][] = [
    [-10, 56, 66, 'gable'], [44, 34, 84, 'steep'], [76, 62, 54, 'gable'], [134, 40, 96, 'steep'], [172, 30, 128, 'spire'], [200, 66, 60, 'gable'],
    [262, 54, 80, 'steep'], [314, 70, 58, 'flat'], [384, 38, 100, 'steep'], [420, 66, 66, 'gable'], [484, 50, 90, 'steep'], [532, 34, 120, 'spire'], [564, 72, 62, 'gable'], [632, 40, 80, 'steep'],
  ];
  spec.forEach(([x, w, h, kind], i) => {
    const base = g - 6, top = base - h, c = mix(col, haze, 0.18 + (i % 3) * 0.05), d = mix(c, 0x1a1030, 0.25);
    p.r(x, top, w, h, c); p.r(x + w - 5, top, 5, h, d);
    if (kind === 'spire') { p.r(x + w / 2 - 6, top - 24, 12, 24, c); p.peak(x + w / 2, top - 24, 16, 36, mix(d, 0x000000, 0.2)); p.r(x + w / 2 - 4, top - 14, 8, 10, 0x1a1330); p.r(x + w / 2 - 1, top - 12, 2, 6, 0xefbd44, 0.7); }
    else if (kind === 'flat') { for (let k = x; k < x + w; k += 8) p.r(k, top - 5, 5, 5, c); }
    else p.peak(x + w / 2, top, w + 8, kind === 'steep' ? 28 : 16, d);
    for (let wy = top + 8; wy < base - 12; wy += 20) for (let wx = x + 6; wx < x + w - 10; wx += 14) if (h01(i * 31 + wx + wy) > 0.55) p.r(wx, wy, 3, 5, 0xefbd44, 0.8);
    p.r(x, top, w, h, haze, 0.12); // the dusk haze over the walls only
  });
}

/** The whole street: skyline, then the near row left to right. */
export function drawStreet(p: Pen, g: number): void {
  skyline(p, g);
  const TIMBER = 0x33202e, SLATE = 0x2e3a54;
  house(p, g, { x: -6, w: 92, h: 62, plaster: 0x82606c, beam: TIMBER, roofCol: 0x8a3a3a, roof: 'gable', roofH: 17, seed: 1, stone: 5, braces: true, shutters: 0x2e5a5a, flowers: 0xe0605a, door: 'arch', doorAt: 30, chimney: 66, sign: 'mug', floors: 2 });
  house(p, g, { x: 86, w: 50, h: 82, plaster: 0x5e6e86, beam: 0x251c36, roofCol: SLATE, roof: 'steep', roofH: 24, seed: 2, stone: 6, jetty: true, shutters: 0x8a2a3e, flowers: 0xf0a0c0, door: 'square', dormer: true, floors: 3 });
  house(p, g, { x: 138, w: 72, h: 56, plaster: 0x8e7c58, beam: 0x3a2a1a, roofCol: 0x5e3a2a, roof: 'hip', roofH: 13, seed: 3, stone: 4, shutters: 0x3a6a3a, awning: [0xc23458, 0xe8dcc0], floors: 2 });
  house(p, g, { x: 212, w: 44, h: 46, plaster: 0x7a6a8a, beam: 0x2e2440, roofCol: 0x6a4a3a, roof: 'gable', roofH: 14, seed: 8, stone: 4, shutters: 0x5a3a6a, flowers: 0xf0d060, door: 'square', doorAt: 22, floors: 2 });
  house(p, g, { x: 256, w: 128, h: 76, plaster: 0x6a6478, beam: 0x403a52, roofCol: 0x3a3652, roof: 'flat', roofH: 0, seed: 4, stone: 14, banners: true, floors: 3 });
  house(p, g, { x: 386, w: 58, h: 68, plaster: 0x6a7a68, beam: 0x2a2a30, roofCol: 0x34503a, roof: 'gable', roofH: 16, seed: 5, stone: 10, braces: true, shutters: 0x4a3a66, flowers: 0xf0d060, door: 'round', doorAt: 20, tower: { w: 20, up: 16, cone: 0x6a3a58 }, floors: 2 });
  house(p, g, { x: 446, w: 78, h: 58, plaster: 0x8e6a72, beam: 0x3a2430, roofCol: 0x4a5a40, roof: 'gable', roofH: 15, seed: 6, stone: 4, shutters: 0x3a4a6a, flowers: 0xe0605a, door: 'round', doorAt: 26, chimney: 54, sign: 'loaf', floors: 2 });
  house(p, g, { x: 526, w: 90, h: 70, plaster: 0x6a7090, beam: 0x25203a, roofCol: 0x363c5e, roof: 'steep', roofH: 22, seed: 7, stone: 6, braces: true, shutters: 0x7a5a3a, flowers: 0xf0a0c0, door: 'arch', doorAt: 60, dormer: true, chimney: 12, floors: 2 });
  house(p, g, { x: 618, w: 40, h: 50, plaster: 0x7a6a62, beam: 0x33241c, roofCol: 0x5a4a6a, roof: 'gable', roofH: 13, seed: 9, stone: 4, shutters: 0x3a5a4a, door: 'square', doorAt: 16, floors: 2 });
}
