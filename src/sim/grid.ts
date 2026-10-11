// Uniform spatial hash over mobs, rebuilt every tick. Linked lists in typed arrays. It covers a window that moves with the camera, not
// the whole field, so a field (a road) can be any length: mobs only live near the screen (see `backLine`), and one beyond the window
// is counted in its edge column, which is slower but still correct.
import { CAM_SLACK, GRID_CELL, LEFT_BEHIND, MAX_ENTS, VIEW_W, WORLD_H } from './constants';
import { Kind, type Entities } from './entities';
import { MOBS } from '../data/mobs';

/** The widest boss: a giant boss is hit when any part of it is in reach (see `gatherCircle`). */
const BOSS_RADIUS = Math.max(...MOBS.filter((m) => m.boss).map((m) => m.radius));

/** The window: from the furthest back a mob can be (`LEFT_BEHIND` + `CAM_SLACK` behind the camera) to past what streams in ahead. */
const GRID_BACK = CAM_SLACK + LEFT_BEHIND;
const GRID_AHEAD = 900;

export interface Grid {
  /** World x of the left edge of column 0 (a multiple of `GRID_CELL`), set when the grid is rebuilt. */
  x0: number;
  cols: number;
  rows: number;
  head: Int32Array;
  next: Int32Array;
}

export function createGrid(): Grid {
  const cols = Math.ceil((GRID_BACK + VIEW_W + GRID_AHEAD) / GRID_CELL) + 1;
  const rows = Math.ceil(WORLD_H / GRID_CELL) + 1;
  return { x0: 0, cols, rows, head: new Int32Array(cols * rows).fill(-1), next: new Int32Array(MAX_ENTS) };
}

export function cellX(x: number, g: Grid): number {
  const c = Math.floor((x - g.x0) / GRID_CELL);
  return c < 0 ? 0 : c >= g.cols ? g.cols - 1 : c;
}
export function cellY(y: number, g: Grid): number {
  const c = Math.floor(y / GRID_CELL);
  return c < 0 ? 0 : c >= g.rows ? g.rows - 1 : c;
}

/** Files every mob in its cell, with the window placed around the camera at `camX`. */
export function rebuildGrid(g: Grid, e: Entities, camX: number): void {
  g.x0 = Math.floor((camX - GRID_BACK) / GRID_CELL) * GRID_CELL;
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
