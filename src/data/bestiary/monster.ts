// Builds one ordinary generated monster for a slot: stats from the slot's budget and the dice, then a few traits (powers) dressed on,
// then a picture recipe. See plan.ts for what a slot means and traits.ts for the powers.
import { Behavior, type MobDef } from '../mobs';
import { SURRENDER_CHANCE } from '../surrender';
import type { Motif, MonsterLook } from '../monsterLook';
import { lookFor, type Faction } from './look';
import { nameFor } from './names';
import type { BiomePlan, SlotPlan } from './plan';
import { Dice, clamp, round } from './rand';
import { CASTER_SPECIALS } from './specials';
import { CHEAP_OK, PLAIN_SHOT, TRAITS, TRAIT_BY_ID, clash, type Ctx, type Trait } from './traits';

export interface Made {
  def: MobDef;
  look: MonsterLook;
  /** Ids of the powers it wears. */
  traits: string[];
}

/** Per-biome book-keeping while a bestiary is built: which powers are spoken for, and which names are taken. */
export interface Ledger {
  used: Set<string>;
  names: Set<string>;
}

/** Does a slot change what it does? Casters and archers stay what they are most of the time; heavy melee almost always does. */
function pickRole(p: SlotPlan, d: Dice): number {
  const c = p.classic;
  if (p.bomber) return Behavior.Bomber;
  if (p.fodder || p.cheap || p.tiny || p.u < 0.2) return c.behavior;
  if (c.behavior === Behavior.Melee) {
    const brute = c.hp >= 40;
    const r = d.f();
    return r < (brute ? 0.92 : 0.7) ? Behavior.Melee : r < (brute ? 0.96 : 0.84) ? Behavior.Ranged : Behavior.Caster;
  }
  if (c.behavior === Behavior.Ranged) { const r = d.f(); return r < 0.78 ? Behavior.Ranged : r < 0.9 ? Behavior.Melee : Behavior.Caster; }
  if (c.behavior === Behavior.Caster) return d.chance(0.8) ? Behavior.Caster : Behavior.Melee;
  return c.behavior;
}

/** Numbers for a plain monster of this role in this slot, before any powers. */
function baseStats(p: SlotPlan, role: number, d: Dice): MobDef {
  const c = p.classic;
  const J = (lo: number, hi: number): number => d.range(lo, hi);
  // early enemies stay close to their budget: a run should not open with a surprise
  const K = p.u < 0.35 ? 0.5 : 1;
  const M = (lo: number, hi: number): number => d.range(1 - (1 - lo) * K, 1 + (hi - 1) * K);
  const m: MobDef = { ...c, special: undefined, charge: undefined, shot: undefined, onDeath: undefined, shield: false, shieldHp: undefined };
  // drop every power the hand-made enemy had
  for (const k of ['armored', 'slowOnHit', 'weave', 'regen', 'pack', 'revive', 'retreat', 'launch', 'poisonOnHit', 'rootOnHit', 'witherOnHit', 'hop', 'thorns', 'evade', 'burrow', 'drain', 'trail', 'flame', 'berserk', 'aura', 'surrender', 'swarm', 'lunge', 'backstep'] as const) delete (m as unknown as Record<string, unknown>)[k];
  const fromMelee = c.behavior === Behavior.Melee;
  m.behavior = role;

  if (role === Behavior.Bomber) {
    m.radius = round(J(3, 4), 1); m.hp = d.int(3, 6); m.speed = round(J(0.8, 1.05), 2); m.damage = d.int(12, 16);
    return m;
  }
  m.radius = round(clamp(p.tiny ? J(2.8, 3.3) : c.radius * M(0.8, 1.25), 2.8, 8), 1);
  if (role === Behavior.Melee) {
    m.hp = Math.max(3, Math.round((fromMelee ? c.hp : c.hp * 1.7) * M(0.75, 1.35)));
    m.speed = round(clamp((fromMelee ? c.speed : J(0.4, 0.7)) * M(0.8, 1.3), 0.26, 1.05), 2);
    m.damage = Math.max(1, Math.round((c.damage > 0 && fromMelee ? c.damage : 3 + c.hp * 0.22) * M(0.8, 1.25)));
    m.atkCooldown = Math.round(clamp((fromMelee ? c.atkCooldown : 45 + m.radius * 5) * M(0.85, 1.2), 38, 95));
    m.reach = Math.round(m.radius * 1.6 + 3.5 + J(-1, 1.5));
    m.windup = Math.round(8 + m.radius * 2.6 + J(-2, 3));
    m.knockResist = round(clamp(1.25 - m.radius * 0.14, 0.25, 1), 2);
  } else if (role === Behavior.Ranged) {
    m.hp = Math.max(4, Math.round((fromMelee ? c.hp * 0.5 : c.hp) * M(0.8, 1.3)));
    m.speed = round(J(0.4, 0.52), 2);
    m.damage = Math.round(clamp((c.behavior === Behavior.Ranged ? c.damage : 4 + p.u * 4) * M(0.85, 1.2), 3, 9));
    m.atkCooldown = d.int(110, 145); m.reach = d.int(100, 125); m.windup = d.int(30, 36);
    m.knockResist = 1;
    m.radius = round(clamp(m.radius, 2.8, 4.4), 1);
  } else {
    m.hp = Math.max(7, Math.round((fromMelee ? c.hp * 0.45 : c.hp) * M(0.85, 1.25)));
    m.speed = round(J(0.32, 0.5), 2);
    m.damage = 0; m.atkCooldown = 0; m.reach = d.int(80, 130); m.windup = 40;
    m.knockResist = round(J(0.6, 1), 2);
    m.radius = round(clamp(m.radius, 3, 5.5), 1);
  }
  return m;
}

function wants(p: SlotPlan, d: Dice): number {
  if (p.fodder || p.bomber) return 0;
  if (p.cheap) return d.chance(0.6) ? 1 : 0;
  if (p.tiny || p.u < 0.25) return 1;
  if (p.u < 0.6) return d.chance(0.45) ? 1 : 2;
  return (d.chance(0.25) ? 1 : 2) + (p.u > 0.8 && d.chance(0.3) ? 1 : 0);
}

export function makeMob(p: SlotPlan, bp: BiomePlan, faction: Faction, led: Ledger, seed: number): Made {
  const d = new Dice(seed, p.slot * 7919 + 13);
  const role = pickRole(p, d);
  const def = baseStats(p, role, d);
  const ctx: Ctx = { u: p.u, biome: p.biome, swarm: bp.swarm, slot: p.slot };
  const picked: Trait[] = [];

  const eligible = (t: Trait, mandatory: 'shot' | 'special' | null): boolean => {
    if (!t.on.includes(role)) return false;
    if (t.group === 'shot' && mandatory !== 'shot') return false;
    if (t.group === 'special' && mandatory === null && role !== Behavior.Melee) return false;
    if (t.group === 'special' && t.id === 'summon' && p.slot === bp.swarm) return false;
    if (t.minU > p.u + 0.1) return false;
    if (t.maxRadius !== undefined && def.radius > t.maxRadius) return false;
    if (t.minRadius !== undefined && def.radius < t.minRadius) return false;
    if (t.id !== PLAIN_SHOT && led.used.has(t.id)) return false;
    if (p.cheap && !CHEAP_OK.has(t.id)) return false;
    if (p.tiny && (t.group === 'special' ? t.id !== 'cling' : false)) return false;
    if (picked.some((x) => clash(x, t))) return false;
    return true;
  };
  const choose = (mandatory: 'shot' | 'special' | null, pool: readonly Trait[] = TRAITS): Trait | undefined =>
    d.weighted(pool.filter((t) => eligible(t, mandatory) && (mandatory === null || t.group === mandatory)),
      (t) => t.weight * (t.themes?.includes(p.biome) ? 2.6 : 1));
  const take = (t: Trait | undefined): void => { if (t) { picked.push(t); if (t.id !== PLAIN_SHOT) led.used.add(t.id); } };

  if (role === Behavior.Ranged) take(choose('shot') ?? TRAIT_BY_ID.get(PLAIN_SHOT));
  if (role === Behavior.Caster) {
    take(choose('special'));
    if (picked.length === 0) {
      // every special the biome could use is spoken for: repeat one rather than leave a caster with nothing to cast
      const t = TRAIT_BY_ID.get(d.pick(CASTER_SPECIALS.filter((k) => !(k === 'summon' && p.slot === bp.swarm))))!;
      picked.push(t);
    }
  }
  let more = wants(p, d) - (role === Behavior.Melee ? 0 : 1);
  if (role === Behavior.Melee && p.tiny) more = 1;
  for (; more > 0; more--) take(choose(null));

  let hpMul = 1, dmgMul = 1;
  for (const t of picked) {
    t.apply(def, d, ctx);
    hpMul *= t.hp ?? 1;
    dmgMul *= t.dmg ?? 1;
  }
  def.hp = Math.max(3, Math.round(def.hp * hpMul));
  if (role === Behavior.Melee) def.damage = Math.max(1, Math.round(def.damage * dmgMul));
  if (def.charge) def.charge.damage = Math.round(def.damage * 1.15);
  if (role === Behavior.Caster && def.special) {
    const sp = def.special as { damage?: number };
    def.damage = sp.damage ?? 0;
  }
  const sc = SURRENDER_CHANCE[p.classic.name];
  if (sc && (role === Behavior.Melee || role === Behavior.Ranged)) def.surrender = sc;

  const motifs: Motif[] = [];
  for (const t of picked) for (const m of t.motifs ?? []) if (!motifs.includes(m)) motifs.push(m);
  const ids = picked.map((t) => t.id);
  const look = lookFor(d, { def, traits: new Set(ids), motifs, boss: false, faction, u: p.u });
  def.name = nameFor(look, d, led.names);
  led.names.add(def.name);
  return { def, look, traits: ids };
}
