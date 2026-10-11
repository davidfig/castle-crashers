// A patch of ground a hero leaves behind (data/classes.ts `PatchDef`): the rogue's Caltrops, the archer's Spike Field and Snare Trap. One per
// hero (a new one replaces the old). Every `every` ticks the foes inside take a little damage and are stunned for a moment, which holds a crowd
// without the foes needing a slowed state of their own; a trap springs once, on the first foe, and is gone.
import type { PatchDef } from '../data/classes';
import { Kind } from './entities';
import { emit, Ev } from './events';
import { gatherCircle } from './grid';
import { hooks } from './skillHooks';
import type { GameState, PlayerState } from './state';

/** damageMob flags: a chip (no stun, no interrupt) and an effect's damage (it sets off no hit triggers): step.ts `CHIP` and `PROC`. */
const CHIP_PROC = 2 | 4;

/** Sets down `d` at (x, y) for hero `p`; `scale` widens it (a dodge's reach), `power` strengthens it (the stun, the damage). */
export function setPatch(p: PlayerState, x: number, y: number, d: PatchDef, scale = 1, power = 1): void {
  p.patchT = d.ticks;
  p.patchX = x; p.patchY = y;
  p.patchR = d.radius * scale;
  p.patchDmg = d.damage * power;
  p.patchStun = Math.min(250, Math.round(d.stun * power));
  p.patchEvery = Math.max(1, d.every);
  p.patchOnce = d.once ? 1 : 0;
  p.patchLook = d.look;
}

/** Once a tick per hero: a standing patch works on the foes inside it. */
export function tickPatch(s: GameState, slot: number): void {
  const p = s.players[slot];
  if (p.patchT <= 0) return;
  p.patchT--;
  if (p.patchT % p.patchEvery !== 0) return;
  const e = s.ents;
  const n = gatherCircle(s.grid, e, p.patchX, p.patchY, p.patchR, s.scratch);
  let touched = false;
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (e.alive[m] !== 1 || e.kind[m] !== Kind.Mob || (e.flags[m] & 2)) continue;
    if ((e.x[m] - p.patchX) ** 2 + (e.y[m] - p.patchY) ** 2 > p.patchR * p.patchR) continue;
    touched = true;
    if (p.patchDmg > 0) hooks.damageMob(s, m, p.patchDmg, 0, 0, 0, slot, CHIP_PROC);
    if (e.alive[m] === 1) e.stun[m] = Math.max(e.stun[m], p.patchStun);
  }
  if (touched && p.patchOnce) { // sprung
    emit(s.events, Ev.Burst, p.patchX, p.patchY, p.patchR * 0.7, 0);
    p.patchT = 0;
  }
}
