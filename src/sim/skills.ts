// The warrior's tree skills (docs/trees/warrior.md), each of which replaces the quake in the ability-1 slot while equipped (data/trees,
// `PlayerState.loadout[2]`): Taunting Roar (Guardian), Rage (Berserker), Planted Standard (Warlord). The slot's four tracks mean something of
// their own for each: Size, Count, Speed, Power (Count is unused by the three; the pool leaves its cards out, data/trees `poolFor`).
import type { ClassDef } from '../data/classes';
import { SLOT_NOVA } from '../data/skills';
import { clamp } from '../engine/math';
import { VIEW_W, WORLD_H } from './constants';
import { gatherCircle } from './grid';
import { Kind } from './entities';
import { emit, Ev } from './events';
import { NOVA_QUICK, NOVA_SIZE, novaCost, POWER_PER_RANK, rankOf } from './abilityMods';
import type { GameState, PlayerState } from './state';
import { aegisMul, beaconWard, plantBeacon, startSanctuary, tickSanctuary } from './clericSkills';
import { setPatch, tickPatch } from './patches';
import { smokeBomb, tickSmoke } from './rogueSkills';
import { totemAura } from './totems';
import { frostBurst, tickMeteor } from './mageSkills';
import { nodeOn } from './tree';

export const SKILL_ROAR = 1, SKILL_RAGE = 2, SKILL_STANDARD = 3, SKILL_FROST_NOVA = 9, SKILL_SANCTUARY = 14, SKILL_BEACON = 17, SKILL_SMOKE = 21, SKILL_SPIKE_FIELD = 27;

/** The skill in the nova slot (ability 1). */
const novaSkill = (p: PlayerState): number => p.loadout[SLOT_NOVA];

/** The Roar: fury, reach (and the big one's), ticks foes stay turned on the roarer, the stagger, damage taken meanwhile. */
const ROAR = { cost: 50, radius: 90, bigRadius: 130, ticks: 180, bigTicks: 300, stun: 10, taken: 0.7, takenPerRank: 0.05 };
/** Rage: fury to start, fury drained a tick, damage dealt (and per Power rank), damage taken, swing speed (every 4th tick the cooldown runs an extra step), fury a kill gives back. */
const RAGE = { cost: 40, drain: 0.25, drainQuick: 0.08, dealt: 0.5, taken: 1.25, killFury: 2.5 };
/** The Standard: fury, reach, ticks it stands, damage dealt and taken by those near it. */
const STANDARD = { cost: 40, radius: 110, ticks: 600, dealt: 0.15, taken: 0.1, longer: 0.08 };

/** Hard Knocks (Guardian node 2): each hit taken makes the hero's hits this much harder, up to `max` of them, for `ticks`. */
const KNOCKS = { dealt: 0.15, max: 3, ticks: 180 };

/** A hero was hit: Hard Knocks stacks, if the node is working. */
export function onKnock(s: GameState, slot: number): void {
  if (!nodeOn(s, slot, 'w-a2')) return;
  const p = s.players[slot];
  p.knockN = Math.min(KNOCKS.max, p.knockN + 1);
  p.knockT = KNOCKS.ticks;
}

/** The fury the ability-1 button costs at base: the equipped skill's, or the class's own. */
export function novaBase(p: PlayerState, cls: ClassDef): number {
  if (!cls.quake) return cls.novaCost;
  const k = novaSkill(p);
  return k === SKILL_ROAR ? ROAR.cost : k === SKILL_RAGE ? RAGE.cost : k === SKILL_STANDARD ? STANDARD.cost : cls.novaCost;
}

const cooldownOf = (p: PlayerState, cls: ClassDef): number => Math.round(cls.novaCooldown * Math.max(0.5, 1 - NOVA_QUICK * rankOf(p.ranks, 2, 2)));

/** Ability 1 pressed while Rage is on: it ends (no cost). Returns whether it did. */
export function rageEnds(p: PlayerState): boolean {
  if (!p.rageOn || p.bufAbility1 <= 0) return false;
  p.rageOn = false;
  p.bufAbility1 = 0;
  p.cdAbility1 = 20;
  return true;
}

/** Casts the equipped skill (not the quake): called where the quake would have been. */
export function castSkill(s: GameState, slot: number, cls: ClassDef): void {
  const p = s.players[slot], e = s.ents;
  const cx = e.x[p.ent], cy = e.y[p.ent];
  const big = p.fury >= cls.furyMax;
  const cost = novaCost(p.ranks, novaBase(p, cls), cls.furyMax);
  const k = novaSkill(p);
  if (k === SKILL_ROAR) {
    p.fury = big ? 0 : p.fury - cost;
    p.cdAbility1 = cooldownOf(p, cls);
    const radius = (big ? ROAR.bigRadius : ROAR.radius) * (1 + NOVA_SIZE * rankOf(p.ranks, 2, 0));
    p.roarT = big ? ROAR.bigTicks : ROAR.ticks;
    p.roarR = radius;
    const n = gatherCircle(s.grid, e, cx, cy, radius, s.scratch);
    for (let k = 0; k < n; k++) {
      const m = s.scratch[k];
      if (e.alive[m] === 1 && e.kind[m] === Kind.Mob) e.stun[m] = Math.max(e.stun[m], ROAR.stun);
    }
    emit(s.events, Ev.Nova, cx, cy, radius, big ? 1 : 0, 0);
  } else if (k === SKILL_RAGE) {
    p.fury -= cost;
    p.rageOn = true;
    p.cdAbility1 = 20;
    emit(s.events, Ev.Nova, cx, cy, 36, 0, 1);
  } else if (k === SKILL_FROST_NOVA) {
    p.fury = big ? 0 : p.fury - cost;
    p.cdAbility1 = cooldownOf(p, cls);
    frostBurst(s, slot, cls, big);
  } else if (k === SKILL_SANCTUARY) {
    p.fury = big ? 0 : p.fury - cost;
    p.cdAbility1 = cooldownOf(p, cls);
    startSanctuary(s, slot, big);
  } else if (k === SKILL_SMOKE) {
    p.fury = big ? 0 : p.fury - cost;
    p.cdAbility1 = cooldownOf(p, cls);
    smokeBomb(s, slot, big);
  } else if (k === SKILL_SPIKE_FIELD) {
    // a patch of spikes a step ahead of the archer: it chips and holds what walks into it
    p.fury = big ? 0 : p.fury - cost;
    p.cdAbility1 = cooldownOf(p, cls);
    const px = clamp(cx + p.faceX * 70, s.camX + 10, s.camX + VIEW_W - 10), py = clamp(cy + p.faceY * 70, 6, WORLD_H - 6);
    setPatch(p, px, py, { radius: big ? 70 : 50, ticks: big ? 720 : 480, damage: 0.8, stun: 8, every: 15, look: 1 }, 1 + NOVA_SIZE * rankOf(p.ranks, 2, 0), 1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3));
    emit(s.events, Ev.Burst, px, py, 30, 0);
  } else if (k === SKILL_BEACON) {
    p.fury = big ? 0 : p.fury - cost;
    p.cdAbility1 = cooldownOf(p, cls);
    plantBeacon(s, slot);
  } else if (k === SKILL_STANDARD) {
    p.fury = big ? 0 : p.fury - cost;
    p.cdAbility1 = cooldownOf(p, cls);
    p.stdX = cx; p.stdY = cy;
    p.stdT = Math.round(STANDARD.ticks * (1 + STANDARD.longer * rankOf(p.ranks, 2, 2)) * (big ? 1.5 : 1));
    p.stdR = STANDARD.radius * (1 + NOVA_SIZE * rankOf(p.ranks, 2, 0));
    p.stdPow = 1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3);
    emit(s.events, Ev.Nova, cx, cy, p.stdR, big ? 1 : 0, 0);
  }
}

/** Once a tick per hero: Rage burns fury (and ends when it is gone), the Roar and the Standard run down. */
export function tickSkills(s: GameState, slot: number): void {
  const p = s.players[slot];
  tickMeteor(s, slot);
  tickSanctuary(s, slot);
  tickSmoke(s, slot);
  if (p.riposteT > 0) p.riposteT--;
  tickPatch(s, slot);
  if (p.aegisT > 0) p.aegisT--;
  if (p.roarT > 0) p.roarT--;
  if (p.knockT > 0 && --p.knockT === 0) p.knockN = 0;
  if (p.stdT > 0) p.stdT--;
  if (!p.rageOn) return;
  p.fury -= RAGE.drain * Math.max(0.4, 1 - RAGE.drainQuick * rankOf(p.ranks, 2, 2));
  if (p.fury <= 0 || p.downed) { p.fury = Math.max(0, p.fury); p.rageOn = false; }
  else if ((s.tick & 3) === 0 && p.cdAttack > 0) p.cdAttack--; // swings 25% faster
}

/** Fury a kill gives back while Rage is on, on top of the class's own. */
export const rageKillFury = (p: PlayerState): number => (p.rageOn ? RAGE.killFury : 0);

/** The nearest hero standing within a standard's reach of hero `slot` (the hero's own included) with a standard up: its strength, or 0. */
function standardNear(s: GameState, slot: number): number {
  const e = s.ents, me = s.players[slot];
  let best = 0;
  for (const q of s.players) {
    if (!q.active || q.downed || q.stdT <= 0) continue;
    const dx = e.x[me.ent] - q.stdX, dy = e.y[me.ent] - q.stdY;
    if (dx * dx + dy * dy <= q.stdR * q.stdR && q.stdPow > best) best = q.stdPow;
  }
  return best;
}

/** Damage dealt by hero `slot`, from the skills: Rage, and a Planted Standard nearby. */
export function skillDealt(s: GameState, slot: number): number {
  const p = s.players[slot];
  const std = standardNear(s, slot);
  return (p.rageOn ? 1 + RAGE.dealt * (1 + POWER_PER_RANK * rankOf(p.ranks, 2, 3)) : 1) * (std > 0 ? 1 + STANDARD.dealt * std : 1) * (1 + KNOCKS.dealt * p.knockN) * (1 + totemAura(s, slot, 'drum'));
}

/** Damage taken by hero `slot`, from the skills: Rage's price, the Roar's cover while foes are turned on it, and a Standard's ward. */
export function skillTaken(s: GameState, slot: number): number {
  const p = s.players[slot];
  const std = standardNear(s, slot);
  const roar = p.roarT > 0 ? Math.max(0.4, ROAR.taken - ROAR.takenPerRank * rankOf(p.ranks, 2, 3)) : 1;
  return (p.rageOn ? RAGE.taken : 1) * roar * (std > 0 ? 1 - STANDARD.taken * std : 1) * aegisMul(p.aegisT) * beaconWard(s, slot) * (1 - totemAura(s, slot, 'ward'));
}
