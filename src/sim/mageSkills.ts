// The mage's replacement skills (docs/trees/mage.md, data/skills.ts): what Chain Bolt, Meteor, Lightning Strike and Frost Nova do. The
// Flamethrower and Ice Slide are plain data (a cone swing, a held slide that stuns), so they have no code here.
import { CLASSES, type ClassDef } from '../data/classes';
import { Element } from '../data/elements';
import { variantOf } from '../data/skills';
import { clamp } from '../engine/math';
import { NOVA_SIZE, POWER_PER_RANK, rankOf, SIZE_MELEE } from './abilityMods';
import { VIEW_W, WORLD_H } from './constants';
import { Kind } from './entities';
import { emit, Ev } from './events';
import { gatherCircle } from './grid';
import { hooks } from './skillHooks';
import type { GameState } from './state';

/** The damage flag that makes a blow break shields (step.ts `PIERCE`). */
const PIERCE = 1;

const live = (s: GameState, m: number): boolean => s.ents.alive[m] === 1 && s.ents.kind[m] === Kind.Mob;

/**
 * Chain Bolt (the basic attack): a bolt at the nearest foe in front of the mage, which jumps to the nearest unhit foe near the last, each
 * hop a little weaker. Size is how far a hop reaches, Count is more hops, Power is damage. Returns whether it was loosed (a target was found).
 */
export function chainBolt(s: GameState, slot: number, cls: ClassDef): boolean {
  const ch = cls.chain!, p = s.players[slot], e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  let first = -1, best = Infinity;
  const n = gatherCircle(s.grid, e, cx, cy, ch.range, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!live(s, m) || (e.flags[m] & 2)) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy, d2 = dx * dx + dy * dy;
    if (d2 > 36 && dx * p.faceX + dy * p.faceY < 0.2 * Math.sqrt(d2)) continue; // in front, not behind
    if (d2 < best) { best = d2; first = m; }
  }
  if (first < 0) return false;
  const hop = ch.hop * (1 + 0.25 * rankOf(p.ranks, 0, 0));
  const hops = ch.hops + rankOf(p.ranks, 0, 1);
  const dmg = ch.damage * (1 + POWER_PER_RANK * rankOf(p.ranks, 0, 3));
  const hit: number[] = [];
  let from = { x: cx, y: cy }, m = first, hits = 0;
  for (let h = 0; h <= hops && m >= 0; h++) {
    hit.push(m);
    const tx = e.x[m], ty = e.y[m];
    emit(s.events, Ev.Arc, from.x, from.y, tx, ty, Element.Lightning);
    const d = Math.hypot(tx - from.x, ty - from.y) || 1;
    if (hooks.damageMob(s, m, dmg * Math.pow(ch.falloff, h), (tx - from.x) / d, (ty - from.y) / d, 1.5, slot, 0) === 1) hits++;
    from = { x: tx, y: ty };
    // on to the nearest foe not yet hit within a hop
    let next = -1, nb = hop * hop;
    const c = gatherCircle(s.grid, e, tx, ty, hop, s.scratch);
    for (let k = 0; k < c; k++) {
      const q = s.scratch[k];
      if (!live(s, q) || hit.includes(q) || (e.flags[q] & 2)) continue;
      const d2 = (e.x[q] - tx) ** 2 + (e.y[q] - ty) ** 2;
      if (d2 < nb) { nb = d2; next = q; }
    }
    m = next;
  }
  p.fury = Math.min(cls.furyMax, p.fury + hits * cls.furyPerHit);
  return true;
}

/** Meteor (the big swing): marks a spot ahead of the mage; the blast lands on it `meteor.delay` ticks later (`tickMeteor`). */
export function startMeteor(s: GameState, slot: number, cls: ClassDef): void {
  const m = cls.meteor!, p = s.players[slot], e = s.ents;
  p.meteorT = m.delay;
  p.meteorX = clamp(e.x[p.ent] + p.faceX * m.reach, s.camX + 10, s.camX + VIEW_W - 10);
  p.meteorY = clamp(e.y[p.ent] + p.faceY * m.reach, 6, WORLD_H - 6);
}

/** Once a tick per hero: a marked Meteor counts down and lands. */
export function tickMeteor(s: GameState, slot: number): void {
  const p = s.players[slot];
  if (p.meteorT <= 0 || --p.meteorT > 0) return;
  const cls = variantOf(CLASSES[p.classId], p.loadout), m = cls.meteor;
  if (!m) return;
  const e = s.ents, x = p.meteorX, y = p.meteorY;
  const radius = m.radius * (1 + SIZE_MELEE * rankOf(p.ranks, 1, 0));
  const dmg = m.damage * (1 + POWER_PER_RANK * rankOf(p.ranks, 1, 3));
  emit(s.events, Ev.Blast, x, y, radius);
  emit(s.events, Ev.Burst, x, y, radius * 0.9, 32 + Element.Fire);
  const n = gatherCircle(s.grid, e, x, y, radius, s.scratch);
  for (let k = 0; k < n; k++) {
    const q = s.scratch[k];
    if (!live(s, q)) continue;
    const dx = e.x[q] - x, dy = e.y[q] - y, d = Math.hypot(dx, dy);
    hooks.damageMob(s, q, dmg * (1 - 0.4 * (d / radius)), d > 0.001 ? dx / d : 1, d > 0.001 ? dy / d : 0, m.knock, slot, PIERCE);
  }
}

/**
 * Lightning Strike (the big swing): an instant bolt down the aim line that hurts and stuns everything on it, then arcs on from the last foe struck.
 * The cleric's Judgment Beam is the same line with a holy element, no arcs, and a mending for every hero on it (`bolt.heal`).
 */
export function lineStrike(s: GameState, slot: number, cls: ClassDef): void {
  const b = cls.bolt!, p = s.players[slot], e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent], fx = p.faceX, fy = p.faceY;
  const length = b.length * (1 + SIZE_MELEE * rankOf(p.ranks, 1, 0));
  const dmg = b.damage * (1 + POWER_PER_RANK * rankOf(p.ranks, 1, 3));
  const element = b.element ?? Element.Lightning;
  emit(s.events, Ev.Beam, cx, cy, fx * length, fy * length, b.width, element);
  if (b.heal) {
    for (const q of s.players) {
      if (!q.active || q.downed) continue;
      const dx = e.x[q.ent] - cx, dy = e.y[q.ent] - cy, along = dx * fx + dy * fy, lateral = dx * -fy + dy * fx;
      if (along < -4 || along > length || Math.abs(lateral) > b.width) continue;
      e.hp[q.ent] = Math.min(CLASSES[q.classId].hp, e.hp[q.ent] + b.heal * (1 + POWER_PER_RANK * rankOf(p.ranks, 1, 3)));
      emit(s.events, Ev.Heal, e.x[q.ent], e.y[q.ent], 14);
    }
  }
  const hit: number[] = [];
  const n = gatherCircle(s.grid, e, cx, cy, length + b.width, s.scratch);
  let lastAlong = -1, last = -1;
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!live(s, m)) continue;
    const dx = e.x[m] - cx, dy = e.y[m] - cy;
    const along = dx * fx + dy * fy, lateral = dx * -fy + dy * fx;
    if (along < -4 || along > length || Math.abs(lateral) > b.width) continue;
    hit.push(m);
    if (along > lastAlong) { lastAlong = along; last = m; }
  }
  for (const m of hit) {
    hooks.damageMob(s, m, dmg, fx, fy, 2, slot, PIERCE);
    e.stun[m] = Math.max(e.stun[m], b.stun);
  }
  // the bolt does not stop at the last foe: it arcs to a few more beside it
  let from = last;
  for (let a = 0; a < b.arcs && from >= 0; a++) {
    let next = -1, nb = 70 * 70;
    const c = gatherCircle(s.grid, e, e.x[from], e.y[from], 70, s.scratch);
    for (let k = 0; k < c; k++) {
      const q = s.scratch[k];
      if (!live(s, q) || hit.includes(q)) continue;
      const d2 = (e.x[q] - e.x[from]) ** 2 + (e.y[q] - e.y[from]) ** 2;
      if (d2 < nb) { nb = d2; next = q; }
    }
    if (next < 0) break;
    hit.push(next);
    emit(s.events, Ev.Arc, e.x[from], e.y[from], e.x[next], e.y[next], Element.Lightning);
    hooks.damageMob(s, next, dmg * 0.6, fx, fy, 1.5, slot, 0);
    e.stun[next] = Math.max(e.stun[next], b.stun);
    from = next;
  }
}

/** Frost Nova (the nova): a ring round the mage that hurts a little and freezes every foe in it. Size is the radius, Power how long they stay frozen. */
export function frostBurst(s: GameState, slot: number, cls: ClassDef, big: boolean): void {
  const p = s.players[slot], e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const radius = (big ? 125 : 85) * (1 + NOVA_SIZE * rankOf(p.ranks, 2, 0));
  const freeze = Math.round((big ? 100 : 60) * (1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3)));
  const dmg = (big ? cls.novaBigDamage : cls.novaDamage) * 0.5;
  emit(s.events, Ev.Nova, cx, cy, radius, big ? 1 : 0, 0);
  emit(s.events, Ev.Burst, cx, cy, radius * 0.8, 32 + Element.Ice);
  const n = gatherCircle(s.grid, e, cx, cy, radius, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!live(s, m) || (e.flags[m] & 2)) continue;
    hooks.damageMob(s, m, dmg, 0, 0, 0, slot, PIERCE);
    if (live(s, m)) e.stun[m] = Math.max(e.stun[m], Math.min(250, freeze)); // (stun is a byte)
  }
}
