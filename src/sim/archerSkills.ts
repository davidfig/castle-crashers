// The archer's replacement skill that needs code of its own: Charged Shot (the basic attack, drawn like a bow). The Piercing Bolt is the mage's
// line strike with no stun (mageSkills.ts `lineStrike`), the Fire Arrow and the Throwing Knife are shots, the Spike Field and the Snare Trap
// are patches (patches.ts), and the Backflip Shot is a dodge (step.ts).
import type { ClassDef } from '../data/classes';
import { UPGRADE_INDEX } from '../data/upgrades';
import { POWER_PER_RANK, rankOf, SIZE_MELEE } from './abilityMods';
import { Kind } from './entities';
import { emit, Ev } from './events';
import { gatherCircle } from './grid';
import { hooks } from './skillHooks';
import type { GameState } from './state';

/** damageMob flag that breaks shields (step.ts `PIERCE`). */
const PIERCE = 1;

/**
 * One tick of the draw. Held (and able to shoot) the bow draws, up to `charge.ticks`; let go after `charge.min` the shot is loosed (returns true: the
 * caller spends the stamina and sets the pause). Let go too soon, or unable to shoot, the draw is just dropped.
 */
export function drawStep(s: GameState, slot: number, cls: ClassDef, held: boolean, ready: boolean): boolean {
  const c = cls.charge!, p = s.players[slot];
  const need = Math.max(c.min, Math.round(c.ticks * Math.max(0.4, 1 - 0.08 * rankOf(p.ranks, 0, 2))));
  if (held && ready) { if (p.drawT < need) p.drawT++; return false; }
  const t = p.drawT;
  p.drawT = 0;
  if (t < c.min || !ready) return false;
  loose(s, slot, cls, Math.min(1, t / need));
  return true;
}

/** The drawn shot: a piercing line down the aim, `damage` x up to `max` by how far it was drawn (and more by how far it flies, the archer's long shot). */
function loose(s: GameState, slot: number, cls: ClassDef, frac: number): void {
  const c = cls.charge!, p = s.players[slot], e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent], fx = p.faceX, fy = p.faceY;
  const length = c.length * (1 + SIZE_MELEE * rankOf(p.ranks, 0, 0));
  const dmg = c.damage * (1 + (c.max - 1) * frac) * (1 + POWER_PER_RANK * rankOf(p.ranks, 0, 3));
  emit(s.events, Ev.Fire, cx, cy, fx, fy);
  emit(s.events, Ev.Beam, cx, cy, fx * length, fy * length, c.width, 0);
  const n = gatherCircle(s.grid, e, cx, cy, length + c.width, s.scratch);
  let hits = 0;
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (e.alive[m] !== 1 || e.kind[m] !== Kind.Mob) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const along = dx * fx + dy * fy, lateral = dx * -fy + dy * fx;
    if (along < -4 || along > length || Math.abs(lateral) > c.width) continue;
    const far = 1 + ((cls.longShot ?? 0) + 0.4 * p.ranks[UPGRADE_INDEX.eagle]) * Math.max(0, along) / length; // an arrow hits harder the farther it flew (Eagle Eye too)
    if (hooks.damageMob(s, m, dmg * far, fx, fy, 2, slot, PIERCE) === 1) hits++;
  }
  p.fury = Math.min(cls.furyMax, p.fury + hits * cls.furyPerHit);
}
