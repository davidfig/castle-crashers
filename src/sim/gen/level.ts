// Battlefield generation: clumps of mobs strung along the field, thickening toward the far end.
// (Chunk-based rooms and encounter budgets come later; see docs/07-procgen.md.)
import { createRng, rngFloat, rngRange, Stream } from '../../engine/rng';
import { MOBS } from '../../data/mobs';
import { pickMobType } from './mix';
import { WORLD_H, WORLD_W } from '../constants';
import { allocEntity, Kind } from '../entities';
import type { GameState } from '../state';

function spawnClump(s: GameState, r: Uint32Array, cx: number, cy: number, size: number, t: number): void {
  const spread = 24 + size * 0.9;
  for (let k = 0; k < size; k++) {
    const type = pickMobType(r, t);
    const x = cx + (rngFloat(r) + rngFloat(r) - 1) * spread;
    const yRaw = cy + (rngFloat(r) + rngFloat(r) - 1) * spread * 0.5;
    const y = yRaw < 4 ? 4 : yRaw > WORLD_H - 4 ? WORLD_H - 4 : yRaw;
    const i = allocEntity(s.ents, Kind.Mob, type, x, y, MOBS[type].hp);
    if (i < 0) return;
    s.ents.face[i] = rngFloat(r) < 0.5 ? 1 : -1;
  }
}

export function generateLevel(s: GameState, seed: number): void {
  const r = createRng(seed, Stream.level);
  const clumps = 46;
  for (let c = 0; c < clumps; c++) {
    const t = c / (clumps - 1);
    const cx = 760 + t * (WORLD_W - 1100) + rngRange(r, -40, 40);
    const cy = rngRange(r, 40, WORLD_H - 40);
    const size = Math.floor(22 + t * 34 + rngRange(r, 0, 14));
    spawnClump(s, r, cx, cy, size, t);
  }
  // Final stand near the far edge.
  spawnClump(s, r, WORLD_W - 260, WORLD_H / 2, 70, 1);
}
