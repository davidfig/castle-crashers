// The rogue's replacement skills (docs/trees/rogue.md, data/skills.ts) that need code of their own: Smoke Bomb and Shadow Step. The Rapier,
// Fan of Knives, Throwing Knife and Caltrops are data (a combo, a fan of arrows, a shot, a patch); the riposte is in step.ts' `swing`.
import type { ClassDef } from '../data/classes';
import { clamp } from '../engine/math';
import { NOVA_SIZE, POWER_PER_RANK, rankOf } from './abilityMods';
import { VIEW_W, WORLD_H } from './constants';
import { Kind } from './entities';
import { emit, Ev } from './events';
import { gatherCircle } from './grid';
import type { GameState, PlayerState } from './state';

/** Smoke Bomb (the nova): a cloud round the rogue. For its few seconds he stays hidden whatever he does (striking does not give him away), and the foes in it are blinded for a moment. */
export function smokeBomb(s: GameState, slot: number, big: boolean): void {
  const p = s.players[slot], e = s.ents;
  const x = e.x[p.ent], y = e.y[p.ent];
  p.smokeX = x; p.smokeY = y;
  p.smokeR = (big ? 85 : 60) * (1 + NOVA_SIZE * rankOf(p.ranks, 2, 0));
  p.smokeT = Math.round((big ? 270 : 180) * (1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3)));
  hide(p, x, y);
  emit(s.events, Ev.Nova, x, y, p.smokeR, 0, 0);
  const n = gatherCircle(s.grid, e, x, y, p.smokeR, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (e.alive[m] === 1 && e.kind[m] === Kind.Mob && !(e.flags[m] & 2)) e.stun[m] = Math.max(e.stun[m], 40); // blinded: it loses a moment
  }
}

/** Once a tick per hero: while the smoke lasts the rogue is kept hidden. */
export function tickSmoke(s: GameState, slot: number): void {
  const p = s.players[slot];
  if (p.smokeT <= 0) return;
  p.smokeT--;
  if (!p.downed) hide(p, s.ents.x[p.ent], s.ents.y[p.ent]);
}

function hide(p: PlayerState, x: number, y: number): void {
  p.vanishT = Math.max(1, p.vanishT);
  p.revealT = 0;
  p.vanishX = x; p.vanishY = y;
}

/**
 * Shadow Step (the dodge): blinks behind the nearest foe within `dashStep.range` (stretched by the dodge's reach) and leaves the rogue hidden and facing
 * its back, so the next strike is an ambush. With no foe near, a short blink along the dash direction instead.
 */
export function shadowStep(s: GameState, slot: number, cls: ClassDef, reach: number): void {
  const p = s.players[slot], e = s.ents, range = cls.dashStep!.range * reach;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  let best = -1, bd = range * range;
  const n = gatherCircle(s.grid, e, cx, cy, range, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (e.alive[m] !== 1 || e.kind[m] !== Kind.Mob || (e.flags[m] & 2)) continue;
    const d2 = (e.x[m] - cx) ** 2 + (e.y[m] - cy) ** 2;
    if (d2 < bd) { bd = d2; best = m; }
  }
  let nx: number, ny: number;
  if (best >= 0) {
    const face = e.face[best] >= 0 ? 1 : -1;
    nx = e.x[best] - face * 20; ny = e.y[best];
    p.faceX = face; p.faceY = 0; // facing its back
    if (face > 0) e.face[p.ent] = 1; else e.face[p.ent] = -1;
  } else { nx = cx + p.dashX * 60 * reach; ny = cy + p.dashY * 60 * reach; }
  nx = clamp(nx, s.camX + 10, s.camX + VIEW_W - 10);
  ny = clamp(ny, 2, WORLD_H - 2);
  emit(s.events, Ev.Teleport, cx, cy, nx, ny);
  e.x[p.ent] = nx; e.y[p.ent] = ny;
  p.invuln = Math.max(p.invuln, 14);
  hide(p, nx, ny);
}
