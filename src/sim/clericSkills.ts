// The cleric's replacement skills (docs/trees/cleric.md, data/skills.ts): what Healing Bolt, Sanctuary Ring, Beacon and Aegis Roll do. The Mace
// is plain data (a melee combo in place of the aura) and Judgment Beam is the mage's line strike with a holy element and mending (mageSkills.ts).
import { Element } from '../data/elements';
import { MOBS } from '../data/mobs';
import { BEACON } from '../data/totems';
import { CLASSES, type ClassDef } from '../data/classes';
import { NOVA_SIZE, POWER_PER_RANK, rankOf, SIZE_MELEE } from './abilityMods';
import { Kind } from './entities';
import { onAura } from './boons';
import { emit, Ev } from './events';
import { gatherCircle } from './grid';
import { hooks } from './skillHooks';
import type { GameState } from './state';
import { plantTotem } from './totems';

const live = (s: GameState, m: number): boolean => s.ents.alive[m] === 1 && s.ents.kind[m] === Kind.Mob;

/**
 * Healing Bolt (the basic attack): at the most wounded ally in front (within reach) and mends them, else at the nearest foe in front and hurts it.
 * Size is the reach, Power the mending and the damage. Returns whether it was loosed (there was a target).
 */
export function mendBolt(s: GameState, slot: number, cls: ClassDef): boolean {
  const m = cls.mend!, p = s.players[slot], e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const range = m.range * (1 + SIZE_MELEE * rankOf(p.ranks, 0, 0));
  const power = 1 + POWER_PER_RANK * rankOf(p.ranks, 0, 3);
  const front = (x: number, y: number): boolean => { const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy; return d2 <= range * range && (d2 < 36 || dx * p.faceX + dy * p.faceY >= 0.2 * Math.sqrt(d2)); };
  // the most wounded ally in front
  let ally = -1, worst = 0.98;
  for (let k = 0; k < s.players.length; k++) {
    const q = s.players[k];
    if (k === slot || !q.active || q.downed || !front(e.x[q.ent], e.y[q.ent])) continue;
    const frac = e.hp[q.ent] / CLASSES[q.classId].hp;
    if (frac < worst) { worst = frac; ally = k; }
  }
  if (ally >= 0) {
    const q = s.players[ally], hp = CLASSES[q.classId].hp;
    e.hp[q.ent] = Math.min(hp, e.hp[q.ent] + m.heal * power);
    emit(s.events, Ev.Arc, cx, cy, e.x[q.ent], e.y[q.ent], Element.Holy);
    emit(s.events, Ev.Heal, e.x[q.ent], e.y[q.ent], 14);
    return true;
  }
  let foe = -1, best = Infinity;
  const n = gatherCircle(s.grid, e, cx, cy, range, s.scratch);
  for (let k = 0; k < n; k++) {
    const t = s.scratch[k];
    if (!live(s, t) || (e.flags[t] & 2) || !front(e.x[t], e.y[t])) continue;
    const d2 = (e.x[t] - cx) ** 2 + (e.y[t] - cy) ** 2;
    if (d2 < best) { best = d2; foe = t; }
  }
  if (foe < 0) return false;
  const d = Math.sqrt(best) || 1;
  emit(s.events, Ev.Arc, cx, cy, e.x[foe], e.y[foe], Element.Holy);
  if (hooks.damageMob(s, foe, m.damage * power, (e.x[foe] - cx) / d, (e.y[foe] - cy) / d, 1.5, slot, 0) === 1) {
    p.fury = Math.min(cls.furyMax, p.fury + cls.furyPerHit);
    onAura(s, slot, 1); // a bolt that strikes a foe is a pulse of the aura as far as Radiance goes
  }
  return true;
}

/** Sanctuary Ring (the nova): a ring set down where the cleric stands that mends the heroes in it and shoves foes out, for a while (`tickSanctuary`). */
export function startSanctuary(s: GameState, slot: number, big: boolean): void {
  const p = s.players[slot], e = s.ents;
  p.sanctX = e.x[p.ent]; p.sanctY = e.y[p.ent];
  p.sanctR = (big ? 95 : 70) * (1 + NOVA_SIZE * rankOf(p.ranks, 2, 0));
  p.sanctPow = 1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3);
  p.sanctT = big ? 720 : 480;
  emit(s.events, Ev.Heal, p.sanctX, p.sanctY, p.sanctR);
}

/** Once a tick per hero: a standing Sanctuary Ring mends the heroes inside every half second and pushes every foe inside toward its edge. */
export function tickSanctuary(s: GameState, slot: number): void {
  const p = s.players[slot];
  if (p.sanctT <= 0) return;
  p.sanctT--;
  const e = s.ents, x = p.sanctX, y = p.sanctY, r = p.sanctR;
  if (p.sanctT % 30 === 0) {
    for (const q of s.players) {
      if (!q.active || q.downed) continue;
      const dx = e.x[q.ent] - x, dy = e.y[q.ent] - y;
      if (dx * dx + dy * dy > r * r) continue;
      e.hp[q.ent] = Math.min(CLASSES[q.classId].hp, e.hp[q.ent] + 4 * p.sanctPow);
      emit(s.events, Ev.Heal, e.x[q.ent], e.y[q.ent], 10);
    }
  }
  const n = gatherCircle(s.grid, e, x, y, r, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!live(s, m) || (e.flags[m] & 2) || MOBS[e.sub[m]].armored) continue;
    const dx = e.x[m] - x, dy = e.y[m] - y, d = Math.hypot(dx, dy);
    if (d > r) continue;
    const f = 0.9 * (1 - MOBS[e.sub[m]].knockResist * 0.5), nx = d > 0.5 ? dx / d : 1, ny = d > 0.5 ? dy / d : 0;
    e.vx[m] += nx * f; e.vy[m] += ny * f;
  }
}

/** Beacon (the nova): a lamp set down a step ahead that holds foes like a Stone totem (they go for it, not the party) and wards the heroes near it. */
export function plantBeacon(s: GameState, slot: number): void { plantTotem(s, slot, BEACON); }

/** Damage taken by hero `slot` from the cleric's Beacon: the heroes inside any beacon's reach take less (stronger with its owner's Power ranks). */
export function beaconWard(s: GameState, slot: number): number {
  const e = s.ents, me = s.players[slot];
  let best = 1;
  for (let t = 0; t < e.highWater; t++) {
    if (e.kind[t] !== Kind.Totem || !e.alive[t] || e.sub[t] !== BEACON) continue;
    const dx = e.x[me.ent] - e.x[t], dy = e.y[me.ent] - e.y[t];
    if (dx * dx + dy * dy > 110 * 110) continue;
    const owner = s.players[e.by[t]];
    best = Math.min(best, 0.75 - 0.05 * (owner ? rankOf(owner.ranks, 2, 3) : 0));
  }
  return Math.max(0.5, best);
}

/** Aegis Roll (the dodge): the heroes within reach of the cleric, the cleric too, are shielded for a few seconds (`aegisMul`). */
export function aegis(s: GameState, slot: number, cls: ClassDef, reach: number, power: number): void {
  const a = cls.dashAegis!, p = s.players[slot], e = s.ents;
  const radius = a.radius * reach;
  emit(s.events, Ev.Heal, e.x[p.ent], e.y[p.ent], radius);
  for (const q of s.players) {
    if (!q.active || q.downed) continue;
    const dx = e.x[q.ent] - e.x[p.ent], dy = e.y[q.ent] - e.y[p.ent];
    if (dx * dx + dy * dy <= radius * radius) q.aegisT = Math.max(q.aegisT, Math.round(a.ticks * power));
  }
}

/** Damage taken while an Aegis Roll holds. */
export const AEGIS_MUL = 0.6;
export const aegisMul = (aegisT: number): number => (aegisT > 0 ? AEGIS_MUL : 1);
