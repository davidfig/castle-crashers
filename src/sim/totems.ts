// The shaman's totems (docs/18-shaman-and-totems.md). A totem is an entity (Kind.Totem) the shaman plants with one of the action
// buttons; it does one job until its time is up or it is broken: Stone holds enemies (they go for it, not the party), Ember burns a
// ring, Cannon lobs fireballs at the nearest mob, Spirit mends heroes. The shaman's own tools (Gale, Gather) only move mobs.
// Entity fields: sub = the totem kind, by = the owner's slot, rem = ticks left, cool = ticks to the next beat, atk = bite cooldown.
import { CLASSES, type ClassDef } from '../data/classes';
import { CANNON_SHOT, HERDS, TOTEMS, type Action, type Herd, type TotemBagDef } from '../data/totems';
import { MOBS } from '../data/mobs';
import { BurstStyle } from './abilities';
import { WORLD_H } from './constants';
import { allocEntity, freeEntity, Kind } from './entities';
import { Ev, emit } from './events';
import { gatherCircle } from './grid';
import { Btn } from './input';
import type { GameState, PlayerState } from './state';
import { damageMob, PROC } from './step';

/** Ticks an action press is remembered (so one pressed during the cooldown, or a hit-stop, still happens). */
export const PLANT_BUFFER = 8;
/** A totem takes one bite from the crowd at most this often (ticks): a horde around it does not melt it in a flash. */
const BITE_COOL = 8;
/** A cannon's fireball is a player projectile with this flag (see `shotOf` in step.ts). */
export const CANNON_FLAG = 8;

const isMob = (e: GameState['ents'], m: number): boolean => e.alive[m] === 1 && e.kind[m] === Kind.Mob;

const actionIn = (def: TotemBagDef, code: number): Action => (code < 1 ? null : code <= 4 ? (def.plain[code - 1] ?? null) : (def.alt[code - 5] ?? null));

/** Steps the selected extra by `dir`, wrapping. Free and instant. */
export function stepPick(p: PlayerState, def: TotemBagDef, dir: number): void {
  const n = def.extras.length;
  if (n > 0) p.pick = (((p.pick + dir) % n) + n) % n;
}

/**
 * A button press becomes a pending action, coded 1 + (4 when Alt is held) + the button (0 Attack, 1 Ability 1, 2 Ability 2, 3 Dodge), and is
 * remembered for PLANT_BUFFER ticks. Stepping the selection happens at once instead (Q steps back with or without Alt), so it works in a
 * hit-stop and while winded.
 */
export function bagInput(p: PlayerState, cls: ClassDef, pressed: number, held: number): void {
  const def = cls.totems;
  if (!def) return;
  if (pressed & Btn.Swap) stepPick(p, def, -1);
  const alt = held & Btn.Alt ? 4 : 0;
  let code = 0;
  if (pressed & Btn.Attack) code = 1 + alt;
  if (pressed & Btn.Ability1) code = 2 + alt;
  if (pressed & Btn.Ability2) code = 3 + alt;
  if (alt && pressed & Btn.Dodge) { code = 4 + alt; p.bufDodge = 0; } // with Alt held the dodge button is the fourth action, not a roll
  if (!code) return;
  const act = actionIn(def, code);
  if (act && 'cycle' in act) { stepPick(p, def, act.cycle); return; }
  p.bufPlant = code;
  p.plantT = PLANT_BUFFER;
}

/** What a pending-action code means for a class, with the selected extra filled in. */
export function actionOf(classId: number, code: number, p: PlayerState): Action {
  const def = CLASSES[classId].totems;
  if (!def) return null;
  return resolve(def, p, actionIn(def, code));
}

/** A `pick` becomes the totem the selection is on. */
export function resolve(def: TotemBagDef, p: PlayerState, a: Action): Action {
  return a && 'pick' in a ? (def.extras.length ? { totem: def.extras[p.pick % def.extras.length] } : null) : a;
}

/** The actions on the buttons right now, for the HUD: the plain bank, or the Alt bank while Alt is held. */
export function bank(classId: number, alt: boolean): readonly Action[] {
  const def = CLASSES[classId].totems!;
  return alt ? def.alt : def.plain;
}

export function actionCost(a: Action): number {
  if (!a) return 0;
  if ('totem' in a) return TOTEMS[a.totem].cost;
  return 'herd' in a ? HERDS[a.herd].cost : 0;
}

/** Whether the shaman could do `a` this tick (stamina, the plant gap, and a herd's own cooldown). */
export function canDo(p: PlayerState, a: Action): boolean {
  if (!a) return false;
  if ('cycle' in a) return true;
  if (p.winded || p.stamina < actionCost(a)) return false;
  if ('totem' in a) return p.cdAttack === 0;
  if ('herd' in a) return (a.herd === 'gale' ? p.cdAbility1 : p.cdSpecial) === 0;
  return false;
}

/** Sets a totem of `kind` down a step ahead of the hero. One live totem per kind per hero: a second plant moves the first (and mends it). */
export function plantTotem(s: GameState, slot: number, kind: number): void {
  const p = s.players[slot];
  const def = CLASSES[p.classId].totems!;
  const k = TOTEMS[kind];
  const e = s.ents;
  const x = Math.max(s.camX + 6, e.x[p.ent] + p.faceX * def.reach);
  const y = Math.max(4, Math.min(WORLD_H - 4, e.y[p.ent] + p.faceY * def.reach));
  let at = -1;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Totem && e.alive[i] && e.sub[i] === kind && e.by[i] === slot) { at = i; break; }
  if (at < 0) {
    at = allocEntity(e, Kind.Totem, kind, x, y, k.hp);
    if (at < 0) return;
  }
  e.x[at] = e.px[at] = x; e.y[at] = e.py[at] = y;
  e.hp[at] = e.maxhp[at] = k.hp;
  e.by[at] = slot;
  e.rem[at] = k.ttl;
  e.cool[at] = Math.min(k.beat, 20); // the first beat comes soon: a planted totem answers at once
  e.atk[at] = 0;
  e.hurt[at] = 0;
  emit(s.events, Ev.TotemPlant, x, y, k.radius, kind, slot);
}

/** The shaman's herding moves: they shove mobs and never hurt them. */
export function herd(s: GameState, slot: number, h: Herd): void {
  const p = s.players[slot];
  const e = s.ents;
  const d = HERDS[h];
  const px = e.x[p.ent], py = e.y[p.ent];
  // Gather hauls toward the nearest Stone totem of this hero's, else toward the hero.
  let tx = px, ty = py;
  if (h === 'gather') {
    let best = Infinity;
    for (let i = 0; i < e.highWater; i++) {
      if (e.kind[i] !== Kind.Totem || !e.alive[i] || e.by[i] !== slot || TOTEMS[e.sub[i]].role !== 'taunt') continue;
      const dd = (e.x[i] - px) ** 2 + (e.y[i] - py) ** 2;
      if (dd < best) { best = dd; tx = e.x[i]; ty = e.y[i]; }
    }
  }
  const n = gatherCircle(s.grid, e, px, py, d.radius, s.scratch);
  for (let k = 0; k < n; k++) {
    const m = s.scratch[k];
    if (!isMob(e, m) || (e.flags[m] & 2) || MOBS[e.sub[m]].armored) continue;
    let dx: number, dy: number;
    if (h === 'gale') { dx = e.x[m] - px; dy = e.y[m] - py; } else { dx = tx - e.x[m]; dy = ty - e.y[m]; }
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    const f = d.force * (1 - MOBS[e.sub[m]].knockResist * 0.5);
    e.vx[m] += (dx / len) * f;
    e.vy[m] += (dy / len) * f;
    e.stun[m] = Math.max(e.stun[m], 10); // knocked about: it cannot walk straight back at once
    e.wind[m] = 0;
  }
  emit(s.events, Ev.Burst, px, py, d.radius * 0.5, h === 'gale' ? BurstStyle.Flash : BurstStyle.Rock);
  emit(s.events, Ev.Dash, px, py, 0, 0, 5); // (the roll's sound and puff)
}

// ---------------------------------------------------------------------------------------------
// Taunt: the mob AI asks which totem, if any, a mob goes for instead of the nearest hero.

const tauntList = new Int32Array(16);
let tauntN = 0;

/** The Stone totem (slot) that holds mob `m`: the nearest whose reach covers it, or -1. Only mobs that are on the field and fighting are held. */
export function tauntOf(s: GameState, m: number): number {
  if (tauntN === 0) return -1;
  const e = s.ents;
  let best = -1, bd = Infinity;
  for (let k = 0; k < tauntN; k++) {
    const t = tauntList[k];
    const r = TOTEMS[e.sub[t]].radius;
    const d = (e.x[t] - e.x[m]) ** 2 + ((e.y[t] - e.y[m]) * 1.3) ** 2;
    if (d <= r * r && d < bd) { bd = d; best = t; }
  }
  return best;
}

/** A mob's blow lands on a totem. One bite per BITE_COOL ticks lands; the rest glance off the crowd. */
export function biteTotem(s: GameState, t: number, dmg: number): void {
  const e = s.ents;
  if (e.atk[t] > 0) return;
  e.atk[t] = BITE_COOL;
  hurtTotem(s, t, dmg);
}

export function hurtTotem(s: GameState, t: number, dmg: number): void {
  const e = s.ents;
  e.hp[t] -= dmg;
  e.hurt[t] = 6;
  if (e.hp[t] <= 0) breakTotem(s, t);
}

function breakTotem(s: GameState, t: number): void {
  const e = s.ents;
  emit(s.events, Ev.Burst, e.x[t], e.y[t], 22, BurstStyle.Rock);
  freeEntity(e, t);
}

/** An enemy shot that reaches a totem is spent on it. Returns whether it was. */
export function shotHitsTotem(s: GameState, proj: number, dmg: number): boolean {
  const e = s.ents;
  for (let t = 0; t < e.highWater; t++) {
    if (e.kind[t] !== Kind.Totem || !e.alive[t]) continue;
    const dx = e.x[t] - e.x[proj], dy = e.y[t] - e.y[proj];
    if (dx * dx + dy * dy < 49) { hurtTotem(s, t, dmg); freeEntity(e, proj); return true; }
  }
  return false;
}

// ---------------------------------------------------------------------------------------------

/** Ages the totems and runs their beats. Runs once a tick after the players have acted, before the mobs decide who to go for. */
export function updateTotems(s: GameState): void {
  const e = s.ents;
  tauntN = 0;
  for (let t = 0; t < e.highWater; t++) {
    if (e.kind[t] !== Kind.Totem || !e.alive[t]) continue;
    const k = TOTEMS[e.sub[t]];
    const owner = e.by[t];
    if (e.hurt[t] > 0) e.hurt[t]--;
    if (e.atk[t] > 0) e.atk[t]--;
    if (--e.rem[t] <= 0) { emit(s.events, Ev.Burst, e.x[t], e.y[t], 12, BurstStyle.Flash); freeEntity(e, t); continue; }
    if (k.role === 'taunt' && tauntN < tauntList.length) tauntList[tauntN++] = t;
    if (e.cool[t] > 0) { e.cool[t]--; if (e.cool[t] > 0) continue; }
    e.cool[t] = k.beat;
    if (k.role === 'damage') {
      let hit = false;
      const n = gatherCircle(s.grid, e, e.x[t], e.y[t], k.radius, s.scratch);
      for (let i = 0; i < n; i++) {
        const m = s.scratch[i];
        if (!isMob(e, m) || (e.flags[m] & 2)) continue;
        const dx = e.x[m] - e.x[t], dy = e.y[m] - e.y[t];
        if (dx * dx + (dy * 1.18) ** 2 > k.radius * k.radius) continue; // the ring is drawn squashed
        const d = Math.hypot(dx, dy) || 1;
        damageMob(s, m, k.power, dx / d, dy / d, 0.6, owner, PROC);
        hit = true;
      }
      emit(s.events, Ev.TotemPulse, e.x[t], e.y[t], k.radius, e.sub[t], owner);
      void hit;
    } else if (k.role === 'cannon') {
      let target = -1, bd = k.radius * k.radius;
      for (let m = 0; m < e.highWater; m++) {
        if (!isMob(e, m) || (e.flags[m] & 2) || e.x[m] < s.camX || e.x[m] > s.camX + 640) continue;
        const d = (e.x[m] - e.x[t]) ** 2 + (e.y[m] - e.y[t]) ** 2;
        if (d < bd) { bd = d; target = m; }
      }
      if (target < 0) { e.cool[t] = 8; continue; } // nothing in range: look again soon
      const dx = e.x[target] - e.x[t], dy = e.y[target] - e.y[t], d = Math.hypot(dx, dy) || 1;
      const q = allocEntity(e, Kind.Proj, 1 + owner, e.x[t], e.y[t], CANNON_SHOT.ttl);
      if (q >= 0) {
        e.vx[q] = (dx / d) * CANNON_SHOT.speed;
        e.vy[q] = (dy / d) * CANNON_SHOT.speed;
        e.flags[q] = CANNON_FLAG;
      }
      emit(s.events, Ev.Fire, e.x[t], e.y[t], dx / d, dy / d);
      emit(s.events, Ev.TotemPulse, e.x[t], e.y[t], 14, e.sub[t], owner);
    } else if (k.role === 'storm') {
      // lightning: the two nearest mobs in the ring are struck
      let a = -1, b = -1, da = Infinity, db = Infinity;
      const n = gatherCircle(s.grid, e, e.x[t], e.y[t], k.radius, s.scratch);
      for (let i = 0; i < n; i++) {
        const m = s.scratch[i];
        if (!isMob(e, m) || (e.flags[m] & 2)) continue;
        const dx = e.x[m] - e.x[t], dy = (e.y[m] - e.y[t]) * 1.18;
        const d = dx * dx + dy * dy;
        if (d > k.radius * k.radius) continue;
        if (d < da) { b = a; db = da; a = m; da = d; } else if (d < db) { b = m; db = d; }
      }
      if (a < 0) { e.cool[t] = 8; continue; }
      for (const m of [a, b]) {
        if (m < 0) continue;
        emit(s.events, Ev.Arc, e.x[t], e.y[t] - 18, e.x[m], e.y[m] - 6, 3); // (3 = lightning, data/elements.ts)
        damageMob(s, m, k.power, 0, 0, 0.4, owner, PROC);
      }
      emit(s.events, Ev.TotemPulse, e.x[t], e.y[t], 14, e.sub[t], owner);
    } else if (k.role === 'heal') {
      for (const q of s.players) {
        if (!q.active || q.downed) continue;
        const dx = e.x[q.ent] - e.x[t], dy = e.y[q.ent] - e.y[t];
        if (dx * dx + (dy * 1.18) ** 2 > k.radius * k.radius) continue;
        e.hp[q.ent] = Math.min(CLASSES[q.classId].hp, e.hp[q.ent] + k.power);
      }
      for (let i = 0; i < e.highWater; i++) { // and the stone that is holding the line
        if (e.kind[i] !== Kind.Totem || !e.alive[i] || i === t) continue;
        const dx = e.x[i] - e.x[t], dy = e.y[i] - e.y[t];
        if (dx * dx + dy * dy <= k.radius * k.radius) e.hp[i] = Math.min(e.maxhp[i], e.hp[i] + k.power * 2);
      }
      emit(s.events, Ev.TotemPulse, e.x[t], e.y[t], k.radius, e.sub[t], owner);
    } else emit(s.events, Ev.TotemPulse, e.x[t], e.y[t], k.radius, e.sub[t], owner);
  }
}
