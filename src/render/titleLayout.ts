// The title screen's composition (docs/13-ui-art.md), rolled fresh each time the title comes up: where the stars, the moon and the
// mountains sit, what the keep looks like and where the party stands on it. Render-only, so it uses plain Math.random, not the sim's dice.
import { VIEW_W } from '../sim/constants';
import { rollFlag } from './titleFlag';
import type { Flag } from './titleFlag';

export const HORIZON = 232;
const GROUND = 212; // where the keep's walls meet the hill

export interface Star { x: number; y: number; big: boolean; a: number }
export interface Window { x: number; y: number }
export interface Banner { x: number; top: number }
export interface TitleLayout {
  /** Rolled once; also salts the horde so its mix and spacing change too. */
  seed: number;
  stars: Star[];
  moon: { x: number; y: number; s: number };
  /** Heights above the horizon, one per 4px column, for the far and near mountain ranges. */
  far: number[];
  near: number[];
  keep: {
    cx: number; hillHalf: number;
    wallTop: number; wallHalf: number;
    donjonTop: number; donjonW: number;
    /** 0 flat with merlons, 1 a conical roof, 2 a narrower crenellated upper tier. */
    donjonRoof: number;
    /** Where the donjon's highest point is. */
    donjonCap: number;
    towerTop: number; towerW: number; towerX: [number, number];
    /** Height of a conical roof on each tower, 0 for open crenellated tops (the party then stands on them). */
    towerRoof: number;
    gateW: number;
    flag: Flag;
    turrets: { x: number; top: number }[];
    banners: Banner[];
    windows: Window[];
  };
  /** The party on the walls: class index (CLASSES order), x, top of the merlons in front. */
  posts: [number, number, number][];
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** A mountain range: a handful of peaks of random height and steepness, the highest wins in each column, with a little rock-face noise. */
function range(r: () => number, peaks: number, maxH: number, minH: number): number[] {
  const cols = VIEW_W / 4 + 1;
  const ps = Array.from({ length: peaks }, () => ({ x: r() * VIEW_W, h: minH + r() * (maxH - minH), slope: 0.35 + r() * 0.5 }));
  return Array.from({ length: cols }, (_, c) => {
    let h = minH * 0.3;
    for (const p of ps) h = Math.max(h, p.h - Math.abs(c * 4 - p.x) * p.slope);
    return Math.round(h + (r() - 0.5) * 3);
  });
}

export function rollTitle(seed = Math.floor(Math.random() * 0x100000000)): TitleLayout {
  const r = rng(seed);
  const int = (lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));

  const stars: Star[] = Array.from({ length: int(50, 90) }, () => ({ x: int(0, VIEW_W - 1), y: int(0, Math.floor(HORIZON * 0.55)), big: r() < 0.25, a: 0.45 + r() * 0.55 }));

  // the moon sits to one side, clear of the plaque in the middle
  const left = r() < 0.5;
  const moon = { x: left ? int(24, 120) : int(500, 600), y: int(30, 110), s: int(14, 28) };

  const far = range(r, int(4, 8), 95, 40), near = range(r, int(3, 6), 60, 22);

  const cx = VIEW_W / 2, gap = int(92, 124), towerW = int(22, 30);
  const towerTop = int(138, 162), donjonW = int(40, 60), donjonTop = int(124, 158), wallTop = int(164, 180);
  const wallHalf = gap + Math.floor(towerW / 2) - 2;
  const towerX: [number, number] = [cx - gap - Math.floor(towerW / 2), cx + gap - Math.floor(towerW / 2)];
  const towerC = [towerX[0] + towerW / 2, towerX[1] + towerW / 2];

  // small turrets on the curtain wall, in the gap between donjon and tower
  const turrets: { x: number; top: number }[] = [];
  for (const side of [-1, 1]) {
    if (r() < 0.45) turrets.push({ x: Math.round(cx + side * (donjonW / 2 + (gap - donjonW / 2 - towerW / 2) * (0.35 + r() * 0.3))) - 7, top: wallTop - int(10, 20) });
  }

  const towerRoof = r() < 0.5 ? int(18, 28) : 0, donjonRoof = int(0, 2), gateW = int(20, 30);
  const donjonCap = donjonRoof === 1 ? donjonTop - int(26, 36) : donjonRoof === 2 ? donjonTop - int(20, 30) : donjonTop - 8;
  const towerCap = towerTop - (towerRoof || 6);
  const banners: Banner[] = [];
  towerX.forEach((tx) => { banners.push({ x: tx + Math.floor(towerW / 2) - 1, top: towerCap - 26 }); });
  if (r() < 0.4) banners.push({ x: cx - 1, top: donjonCap - 26 });

  const windows: Window[] = [
    { x: cx - 12, y: donjonTop + 8 }, { x: cx + 8, y: donjonTop + 8 }, { x: cx - 2, y: donjonTop + 24 },
    { x: towerX[0] + Math.floor(towerW / 2) - 2, y: towerTop + 16 }, { x: towerX[1] + Math.floor(towerW / 2) - 2, y: towerTop + 16 },
    { x: cx - gap + 28, y: wallTop + 14 }, { x: cx + gap - 32, y: wallTop + 14 },
  ];
  if (r() < 0.6) windows.push({ x: cx - gap + 28 + int(14, 22), y: wallTop + 14 }, { x: cx + gap - 32 - int(14, 22), y: wallTop + 14 });
  if (r() < 0.5) windows.push({ x: cx - 2, y: donjonTop + 40 });
  // keep every window on the wall face and off the gate
  const lit = windows.filter((w) => w.y + 7 < GROUND - 2 && (w.y < 180 || Math.abs(w.x + 2 - cx) > gateW / 2 + 6));

  // the party: archer/mage-style perches on the towers, the rest along the wall between donjon and tower; shuffled each time
  const order = [0, 1, 2, 3, 4];
  for (let i = order.length - 1; i > 0; i--) { const j = int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  const spans = [[cx - wallHalf + 8, cx - donjonW / 2 - 6], [cx + donjonW / 2 + 6, cx + wallHalf - 8]].filter(([a, b]) => b - a > 12);
  const nWall = towerRoof ? 5 : 3, gapMin = towerRoof ? 20 : 24;
  const wallXs: number[] = [];
  for (let tries = 0; wallXs.length < nWall && tries < 200; tries++) {
    const [a, b] = spans[int(0, spans.length - 1)];
    const x = Math.round(a + r() * (b - a));
    if (wallXs.every((o) => Math.abs(o - x) >= gapMin)) wallXs.push(x);
  }
  for (let k = 0; wallXs.length < nWall; k++) wallXs.push(cx + (k % 2 ? 1 : -1) * (30 + Math.floor(k / 2) * 22)); // a very narrow wall: fall back to spaced posts
  const posts: [number, number, number][] = towerRoof
    ? wallXs.map((x, k): [number, number, number] => [order[k], x, wallTop - 6])
    : [[order[0], Math.round(towerC[0]), towerTop - 6], [order[1], Math.round(towerC[1]), towerTop - 6], ...wallXs.map((x, k): [number, number, number] => [order[2 + k], x, wallTop - 6])];

  return { seed, stars, moon, far, near, keep: { cx, hillHalf: wallHalf + int(10, 40), wallTop, wallHalf, donjonTop, donjonW, donjonRoof, donjonCap, towerTop, towerW, towerX, towerRoof, gateW, flag: rollFlag(r), turrets, banners, windows: lit }, posts };
}

let current: TitleLayout | null = null;
/** The layout in play; rolled on first use. */
export function titleLayout(): TitleLayout { return current ??= rollTitle(); }
/** Rolls a new title (main.ts calls this whenever the title comes up). */
export function rerollTitle(): void { current = rollTitle(); }
