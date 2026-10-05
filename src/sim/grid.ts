// Uniform spatial hash over mobs, rebuilt every tick. Linked lists in typed arrays.
import { GRID_CELL, MAX_ENTS, WORLD_H, WORLD_W } from './constants';
import { Kind, type Entities } from './entities';
import { MOBS } from '../data/mobs';

/** The widest boss: a giant boss is hit when any part of it is in reach (see `gatherCircle`). */
const BOSS_RADIUS = Math.max(...MOBS.filter((m) => m.boss).map((m) => m.radius));

export interface Grid {
  cols: number;
  rows: number;
  head: Int32Array;
  next: Int32Array;
}

export function createGrid(): Grid {
  const cols = Math.ceil(WORLD_W / GRID_CELL) + 1;
  const rows = Math.ceil(WORLD_H / GRID_CELL) + 1;
  return { cols, rows, head: new Int32Array(cols * rows).fill(-1), next: new Int32Array(MAX_ENTS) };
}

export function cellX(x: number, g: Grid): number {
  const c = Math.floor(x / GRID_CELL);
  return c < 0 ? 0 : c >= g.cols ? g.cols - 1 : c;
}
export function cellY(y: number, g: Grid): number {
  const c = Math.floor(y / GRID_CELL);
  return c < 0 ? 0 : c >= g.rows ? g.rows - 1 : c;
}

export function rebuildGrid(g: Grid, e: Entities): void {
  g.head.fill(-1);
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Mob) continue;
    const c = cellY(e.y[i], g) * g.cols + cellX(e.x[i], g);
    g.next[i] = g.head[c];
    g.head[c] = i;
  }
}

/** Collect mobs whose centers lie within radius r of (cx, cy) into out[]; returns the count. */
export function gatherCircle(g: Grid, e: Entities, cx: number, cy: number, r: number, out: Int32Array): number {
  const x0 = cellX(cx - r, g), x1 = cellX(cx + r, g);
  const y0 = cellY(cy - r, g), y1 = cellY(cy + r, g);
  const r2 = r * r;
  let n = 0;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      for (let i = g.head[gy * g.cols + gx]; i !== -1; i = g.next[i]) {
        if (!e.alive[i] || e.kind[i] !== Kind.Mob) continue; // grid can hold stale slots mid-tick
        const dx = e.x[i] - cx, dy = e.y[i] - cy;
        if (dx * dx + dy * dy <= r2) out[n++] = i;
      }
    }
  }
  // A giant boss is hit when any part of it is in reach, not only its centre.
  const bi = e.boss;
  if (bi >= 0 && e.alive[bi]) {
    const dx = e.x[bi] - cx, dy = e.y[bi] - cy;
    const reach = r + BOSS_RADIUS;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2 && d2 <= reach * reach) out[n++] = bi;
  }
  return n;
}
