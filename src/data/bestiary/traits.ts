// The kit of powers a generated monster is dressed from. Every trait here is a mechanic the sim already has (see `MobDef` in data/mobs.ts), so a trait
// only sets fields on the definition. Traits belong to groups that cannot be doubled up on one monster, and a biome never gives the same trait to two
// of its enemies (so each enemy still "does something no other enemy does", and a player can learn what a name means).
//
// Most of the kit is *elemental*: a delivery (a lobbed strike, a trap, a bolt, a ring, a cone...), a melee rider, an aura, a death effect or a way of
// shooting is instantiated once per element (data/elements.ts), so "lob:fire" and "lob:ice" are different traits with different effects and looks.
// A monster has an element it leans on (its affinity) and sometimes a second, so its powers read as a set: an ice monster chills in melee,
// shoots frost and freezes the ground, while the odd one out is a flaming thing with a lightning bolt.
import { Element, ELEMENTS } from '../elements';
import { Behavior, ProjStyle, type MobDef } from '../mobs';
import type { Motif } from '../monsterLook';
import { Dice, round } from './rand';
import { CASTER_SPECIALS, ELEMENTAL_KINDS, MELEE_SPECIALS, makeSpecial, type SpecialKind } from './specials';

/** Biome indices (ROSTERS order): Meadow, Haunted Keep, Frozen Pass, Sunken Marsh, Scorched Dunes. */
export const MEADOW = 0, KEEP = 1, FROZEN = 2, MARSH = 3, DUNES = 4;

/** The elements each biome leans toward (a soft pull: any biome can produce any element). */
export const BIOME_ELEMENTS: readonly (readonly number[])[] = [
  [Element.Fire, Element.Lightning, Element.Earth, Element.Holy, Element.Blood, Element.Wind],
  [Element.Shadow, Element.Poison, Element.Blood, Element.Arcane, Element.Ice],
  [Element.Ice, Element.Wind, Element.Lightning, Element.Shadow, Element.Holy],
  [Element.Poison, Element.Earth, Element.Blood, Element.Shadow, Element.Lightning],
  [Element.Fire, Element.Wind, Element.Earth, Element.Holy, Element.Arcane],
];

export type Group = 'hit' | 'move' | 'body' | 'aura' | 'death' | 'charge' | 'shot' | 'special';

/** What a trait is told about the monster it dresses. */
export interface Ctx {
  /** 0 (an early enemy of its biome) .. 1 (a late one). */
  u: number;
  biome: number;
  /** The biome's cheap swarm slot (what summoners raise and brutes burst into). */
  swarm: number;
  /** This monster's own slot. */
  slot: number;
  /** The element it leans on (0 = none, a plain brawler) and a second one it sometimes borrows. */
  element: number;
  second: number;
  /** Potency of its elements' effects (lower for crowd filler). */
  power: number;
}

export interface Trait {
  id: string;
  group: Group;
  /** Which behaviours can wear it. */
  on: readonly number[];
  /** Earliest `u` it is handed out at. */
  minU: number;
  weight: number;
  /** Biomes it is favoured in (a soft pull: other biomes still get it now and then). */
  themes?: readonly number[];
  /** Other trait ids (or groups) it cannot share a monster with. */
  excl?: readonly string[];
  /** Only for the small stuff (radius at most this). */
  maxRadius?: number;
  /** Only for the big stuff (radius at least this). */
  minRadius?: number;
  hp?: number;
  dmg?: number;
  motifs?: readonly Motif[];
  /** The element it is made of (0 or absent = none): monsters that lean on that element pick it far more often. */
  elem?: number;
  /** May a cheap (crowd filler) slot have it? */
  cheap?: boolean;
  /** For a skill: the delivery kind. */
  kind?: SpecialKind;
  apply(def: MobDef, d: Dice, c: Ctx): void;
}

const M = Behavior.Melee, R = Behavior.Ranged, C = Behavior.Caster;
const ALL = [M, R, C] as const;

const T: Trait[] = [];
const add = (t: Trait): void => { T.push(t); };
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const motifOf = (el: number): readonly Motif[] => [ELEMENTS[el].motif];
const elName = (el: number): string => ELEMENTS[el].name;
const ELEMS = ELEMENTS.slice(1).map((e) => e.id as number);

// ---- what a melee hit also does (the hand-made riders)
add({ id: 'slow', group: 'hit', on: [M], minU: 0, weight: 1.6, themes: [KEEP], dmg: 0.9, motifs: ['bones'], cheap: true, apply: (m, d) => { m.slowOnHit = d.int(60, 110); } });
add({ id: 'launch', group: 'hit', on: [M], minU: 0.2, weight: 1.4, themes: [FROZEN, MEADOW], dmg: 0.8, apply: (m, d) => { m.launch = d.int(64, 96); } });
add({ id: 'venom', group: 'hit', on: [M], minU: 0, weight: 1.2, themes: [MARSH], dmg: 0.6, motifs: ['poison'], cheap: true, apply: (m, d) => { m.poisonOnHit = d.int(110, 180); } });
add({ id: 'snare', group: 'hit', on: [M], minU: 0.4, weight: 1.2, themes: [MARSH], dmg: 0.9, motifs: ['slime'], apply: (m, d) => { m.rootOnHit = d.int(30, 45); } });
add({ id: 'wither', group: 'hit', on: [M], minU: 0.3, weight: 1.2, themes: [DUNES], motifs: ['bandage'], apply: (m, d) => { m.witherOnHit = d.int(170, 260); } });
add({ id: 'drain', group: 'hit', on: [M], minU: 0.1, weight: 1.3, themes: [DUNES, KEEP], hp: 0.85, motifs: ['glow'], cheap: true, apply: (m, d) => { m.drain = d.int(2, 3); } });
add({ id: 'lunge', group: 'hit', on: [M], minU: 0, weight: 1.4, themes: [KEEP, MEADOW], maxRadius: 5.5, motifs: ['bones'], cheap: true, apply: (m, d) => { m.lunge = d.int(14, 22); } });

// ---- how it moves
add({ id: 'weave', group: 'move', on: [M], minU: 0, weight: 2, cheap: true, apply: (m, d) => { m.weave = round(d.range(0.5, 0.95), 2); } });
add({ id: 'hop', group: 'move', on: [M], minU: 0, weight: 1.8, themes: [MARSH], excl: ['burrow', 'charge'], cheap: true, apply: (m, d) => { m.hop = { every: d.int(45, 65), speed: round(d.range(1.2, 1.6), 1), minDist: 30 }; } });
add({ id: 'retreat', group: 'move', on: [M], minU: 0, weight: 1.6, themes: [FROZEN], excl: ['burrow'], cheap: true, apply: (m, d) => { m.retreat = d.int(24, 40); } });
add({ id: 'backstep', group: 'move', on: [R], minU: 0, weight: 1.6, themes: [MEADOW, DUNES], cheap: true, apply: (m, d) => { m.backstep = { trigger: d.int(40, 50), dist: d.int(58, 70), every: d.int(130, 170) }; } });
add({ id: 'evade', group: 'move', on: ALL, minU: 0, weight: 1.6, themes: [DUNES], motifs: ['ghost'], cheap: true, apply: (m, d) => { m.evade = round(d.range(0.15, 0.3), 2); } });
add({ id: 'burrow', group: 'move', on: [M], minU: 0.15, weight: 1.4, themes: [DUNES], excl: ['hop', 'retreat', 'revive', 'charge', 'special'], maxRadius: 5, apply: (m, d) => { m.burrow = d.int(38, 50); } });

// ---- a bull's charge (a melee mob has this or a special, never both)
add({ id: 'charge', group: 'charge', on: [M], minU: 0.2, weight: 1.8, themes: [MEADOW, FROZEN], excl: ['burrow', 'hop', 'special'], minRadius: 4.2, dmg: 0.9,
  apply: (m, d) => { m.charge = { chance: 1 / d.int(380, 520), speed: round(d.range(3, 3.6), 1), distance: d.int(150, 200), windup: d.int(32, 40), cooldown: d.int(380, 440), damage: Math.round(m.damage * 1.15), minRange: 60, maxRange: d.int(220, 250), dazed: d.int(50, 60) }; } });

// ---- its body
add({ id: 'armor', group: 'body', on: ALL, minU: 0.15, weight: 1.6, themes: [DUNES, MEADOW], hp: 0.85, motifs: ['armor'], cheap: true, apply: (m) => { m.armored = true; } });
add({ id: 'shield', group: 'body', on: [M], minU: 0.1, weight: 1.6, themes: [MEADOW], excl: ['armor'], hp: 0.8, motifs: ['armor'], apply: (m, d) => { m.shield = true; m.shieldHp = d.int(16, 30); } });
add({ id: 'thorns', group: 'body', on: [M], minU: 0.2, weight: 1.4, themes: [MARSH], motifs: ['thorns', 'poison'], apply: (m, d) => { m.thorns = d.int(130, 200); } });
add({ id: 'regen', group: 'body', on: ALL, minU: 0.2, weight: 1.4, themes: [KEEP, MARSH], hp: 0.85, motifs: ['slime'], apply: (m, d) => { m.regen = round(d.range(0.02, 0.045), 3); } });
add({ id: 'berserk', group: 'body', on: [M], minU: 0.3, weight: 1.4, themes: [FROZEN, MEADOW], motifs: ['fur'], apply: (m, d) => { m.berserk = round(d.range(0.3, 0.5), 2); } });
add({ id: 'swarm', group: 'body', on: [M], minU: 0, weight: 1.5, themes: [MEADOW, DUNES], maxRadius: 5, motifs: ['fur'], cheap: true, apply: (m, d) => { m.swarm = { radius: d.int(54, 66), bonus: round(d.range(0.04, 0.06), 2), max: d.int(6, 8) }; } });
add({ id: 'pack', group: 'body', on: [M], minU: 0, weight: 1.8, themes: [MEADOW, FROZEN], maxRadius: 5, motifs: ['fur'], cheap: true, apply: (m, d) => { m.pack = { radius: 44, bonus: round(d.range(0.15, 0.25), 2) }; } });
add({ id: 'revive', group: 'body', on: [M], minU: 0.55, weight: 1.4, themes: [KEEP], excl: ['burrow'], hp: 0.8, motifs: ['bones', 'ghost'], apply: (m, d) => { m.revive = round(d.range(0.35, 0.45), 2); } });
add({ id: 'mud', group: 'body', on: [M], minU: 0.35, weight: 1.3, themes: [MARSH], minRadius: 4.5, motifs: ['slime'], apply: (m, d) => { m.trail = { every: d.int(32, 40), radius: d.int(12, 14), linger: d.int(380, 440), slow: 30 }; } });

// ---- the hand-made fields and death effects
add({ id: 'flame', group: 'aura', on: [M], minU: 0.5, weight: 0.9, themes: [DUNES], minRadius: 4.5, motifs: ['fire'], apply: (m, d) => { m.flame = { radius: d.int(30, 36) }; } });
add({ id: 'chill', group: 'aura', on: [M], minU: 0.45, weight: 0.9, themes: [FROZEN], minRadius: 4.5, motifs: ['frost'], apply: (m, d) => { m.aura = { radius: d.int(36, 42), slow: 30, damage: 1, pulse: 40 }; } });
add({ id: 'burst', group: 'death', on: [M], minU: 0.35, weight: 1.2, themes: [KEEP, MEADOW], minRadius: 4.8, motifs: ['bones'], apply: (m, d, c) => { m.onDeath = { split: { type: c.swarm, count: d.int(2, 3) } }; } });
add({ id: 'spores', group: 'death', on: ALL, minU: 0.1, weight: 1.0, themes: [MARSH], motifs: ['poison'], cheap: true, apply: (m, d) => { m.onDeath = { cloud: { radius: d.int(26, 30), linger: d.int(280, 320), drain: 0.7 } }; } });

// ---- the hand-made ways to shoot (plain arrows are the baseline and may repeat)
export const PLAIN_SHOT = 'arrow';
add({ id: PLAIN_SHOT, group: 'shot', on: [R], minU: 0, weight: 2, cheap: true, apply: () => { /* the default single arrow */ } });
add({ id: 'volley', group: 'shot', on: [R], minU: 0, weight: 0.8, themes: [KEEP], motifs: ['bones'], cheap: true, apply: (m) => { m.shot = { count: 2, spread: 0.03, speed: 2.1, damage: Math.max(2, Math.round(m.damage * 0.85)), style: ProjStyle.Bone }; m.atkCooldown += 10; } });
add({ id: 'harpoon', group: 'shot', on: [R], minU: 0, weight: 0.9, themes: [FROZEN], cheap: true, apply: (m, d) => { m.shot = { count: 1, spread: 0, speed: 2.6, damage: Math.max(2, Math.round(m.damage * 0.75)), style: ProjStyle.Harpoon, pull: d.int(48, 60) }; m.atkCooldown += 20; } });
add({ id: 'falcon', group: 'shot', on: [R], minU: 0.3, weight: 0.8, themes: [DUNES], apply: (m) => { m.shot = { count: 1, spread: 0, speed: 1.5, damage: Math.max(3, Math.round(m.damage * 0.8)), style: ProjStyle.Falcon, homing: true }; m.atkCooldown += 30; } });

// ---- elemental melee riders, auras, death effects and shots: one instance per element
for (const el of ELEMS) {
  const name = elName(el), motifs = motifOf(el);
  add({ id: `elemhit:${name}`, group: 'hit', on: [M], minU: 0, weight: 2.4, dmg: 0.85, motifs, elem: el, cheap: true,
    apply: (m, d, c) => { m.onHit = { element: el, power: round(c.power * d.range(0.9, 1.1), 2) }; } });
  add({ id: `elemaura:${name}`, group: 'aura', on: [M], minU: 0.4, weight: 1.6, hp: 0.9, minRadius: 4.2, motifs, elem: el,
    apply: (m, d, c) => { m.elemAura = { radius: d.int(34, 42), element: el, damage: 1, pulse: d.int(34, 44), power: round(c.power, 2) }; } });
  add({ id: `blast:${name}`, group: 'death', on: ALL, minU: 0.3, weight: 1.4, hp: 0.9, motifs, elem: el,
    apply: (m, d, c) => { m.onDeath = { blast: { radius: d.int(30, 38), damage: Math.round(lerp(5, 10, c.u)) }, element: el }; } });
  add({ id: `elempool:${name}`, group: 'death', on: ALL, minU: 0.3, weight: 1.2, motifs, elem: el,
    apply: (m, d) => { m.onDeath = { pool: { radius: d.int(22, 28), linger: d.int(260, 320), damage: 2, slow: el === Element.Ice || el === Element.Earth ? d.int(35, 50) : 0 }, element: el }; } });
  add({ id: `shards:${name}`, group: 'death', on: ALL, minU: 0.3, weight: 1.1, motifs, elem: el,
    apply: (m, d) => { m.onDeath = { shards: { count: d.int(5, 8), speed: round(d.range(1.7, 2.1), 1), damage: 4 }, element: el }; } });

  // shots
  const shot = (id: string, weight: number, minU: number, cheap: boolean, build: (m: MobDef, d: Dice, c: Ctx) => void): void => {
    add({ id: `${id}:${name}`, group: 'shot', on: [R], minU, weight, motifs, elem: el, cheap, apply: build });
  };
  shot('orb', 2, 0, true, (m, d, c) => { m.shot = { count: 1, spread: 0, speed: round(d.range(1.6, 2.1), 1), damage: Math.max(2, Math.round(m.damage)), style: ProjStyle.Orb, element: el, power: round(c.power, 2) }; });
  shot('needles', 1.4, 0.25, false, (m, d, c) => { m.shot = { count: 3, spread: round(d.range(0.06, 0.09), 2), speed: round(d.range(2.2, 2.6), 1), damage: Math.max(2, Math.round(m.damage * 0.7)), style: ProjStyle.Spike, element: el, power: round(c.power, 2) }; m.atkCooldown += 20; });
  shot('comet', 1.2, 0.4, false, (m, d, c) => { m.shot = { count: 1, spread: 0, speed: round(d.range(2.6, 3.1), 1), damage: Math.max(3, Math.round(m.damage * 0.9)), style: ProjStyle.Comet, element: el, power: round(c.power, 2), pierce: true }; m.atkCooldown += 20; });
  shot('blastorb', 1.2, 0.35, false, (m, d, c) => { m.shot = { count: 1, spread: 0, speed: round(d.range(1.4, 1.7), 1), damage: Math.max(3, Math.round(m.damage)), style: ProjStyle.Orb, element: el, power: round(c.power, 2), splash: d.int(28, 36) }; m.atkCooldown += 25; });
  shot('seeker', 1.2, 0.3, false, (m, d, c) => { m.shot = { count: 1, spread: 0, speed: round(d.range(1.3, 1.6), 1), damage: Math.max(2, Math.round(m.damage * 0.8)), style: ProjStyle.Mote, element: el, power: round(c.power, 2), homing: true }; m.atkCooldown += 30; });
  shot('twin', 1.2, 0.1, true, (m, d, c) => { m.shot = { count: 2, spread: round(d.range(0.035, 0.05), 3), speed: round(d.range(1.8, 2.2), 1), damage: Math.max(2, Math.round(m.damage * 0.75)), style: ProjStyle.Mote, element: el, power: round(c.power, 2) }; m.atkCooldown += 10; });
}

// ---- telegraphed skills (deliveries), each made of an element where the delivery can be
export interface SkillRule { minU: number; weight: number; themes?: readonly number[]; maxRadius?: number; minRadius?: number; motifs?: readonly Motif[]; natural?: readonly number[] }
const E = Element;
export const SKILL_RULES: Record<SpecialKind, SkillRule> = {
  lob: { minU: 0, weight: 2.2, themes: [MEADOW], natural: [E.Fire, E.Earth, E.Ice, E.Arcane, E.Poison] },
  summon: { minU: 0.5, weight: 1.4, themes: [KEEP], motifs: ['bones'] },
  heal: { minU: 0.3, weight: 1.6, themes: [MEADOW], motifs: ['glow'] },
  rally: { minU: 0.3, weight: 1.6, themes: [MEADOW] },
  blink: { minU: 0.25, weight: 1.6, themes: [KEEP], motifs: ['ghost'] },
  nova: { minU: 0.2, weight: 1.6, themes: [MEADOW, FROZEN], natural: [E.Fire, E.Ice, E.Lightning, E.Earth, E.Arcane, E.Holy, E.Shadow] },
  beam: { minU: 0.5, weight: 1.4, themes: [KEEP, DUNES], natural: [E.Lightning, E.Holy, E.Fire, E.Arcane, E.Shadow, E.Ice] },
  trap: { minU: 0.1, weight: 1.6, themes: [FROZEN, MARSH], natural: [E.Lightning, E.Earth, E.Poison, E.Ice, E.Fire] },
  cling: { minU: 0, weight: 1.2, themes: [FROZEN], maxRadius: 3.4, natural: [E.Ice, E.Blood, E.Poison, E.Fire] },
  ward: { minU: 0.4, weight: 1.4, themes: [FROZEN], motifs: ['frost'] },
  storm: { minU: 0.35, weight: 1.5, themes: [FROZEN, MARSH], natural: [E.Ice, E.Poison, E.Lightning, E.Fire, E.Wind] },
  whiteout: { minU: 0.35, weight: 1.4, themes: [FROZEN], natural: [E.Ice, E.Wind, E.Shadow] },
  wail: { minU: 0.35, weight: 1.5, themes: [KEEP], natural: [E.Shadow, E.Holy, E.Arcane] },
  lure: { minU: 0.2, weight: 1.5, themes: [MARSH], natural: [E.Shadow, E.Arcane, E.Holy] },
  leap: { minU: 0.25, weight: 1.5, themes: [MARSH], minRadius: 4.5, natural: [E.Earth, E.Poison, E.Fire, E.Blood] },
  pounce: { minU: 0.25, weight: 1.5, themes: [FROZEN, MEADOW], maxRadius: 6.5, natural: [E.Blood, E.Fire, E.Lightning, E.Wind] },
  gust: { minU: 0.2, weight: 1.5, themes: [DUNES], natural: [E.Wind, E.Fire, E.Earth, E.Ice] },
  pit: { minU: 0.3, weight: 1.4, themes: [DUNES], natural: [E.Earth, E.Fire, E.Shadow, E.Poison] },
  hex: { minU: 0.25, weight: 1.5, themes: [MARSH], natural: [E.Arcane, E.Shadow, E.Blood] },
  dazzle: { minU: 0.4, weight: 1.4, themes: [DUNES], natural: [E.Holy, E.Lightning, E.Arcane] },
  bolt: { minU: 0.1, weight: 2, themes: [MEADOW, KEEP, DUNES] },
  ring: { minU: 0.45, weight: 1.3, themes: [KEEP, FROZEN], natural: [E.Fire, E.Ice, E.Lightning, E.Poison, E.Arcane, E.Holy] },
  cone: { minU: 0.3, weight: 1.5, themes: [DUNES, MEADOW], natural: [E.Fire, E.Ice, E.Poison, E.Wind, E.Lightning] },
  totem: { minU: 0.45, weight: 1.2, themes: [MARSH, MEADOW], natural: [E.Earth, E.Lightning, E.Arcane, E.Fire, E.Shadow] },
};

function addSkill(kind: SpecialKind, el: number): void {
  const r = SKILL_RULES[kind];
  const behaviours: number[] = [...(MELEE_SPECIALS.includes(kind) ? [M] : []), ...(CASTER_SPECIALS.includes(kind) ? [C] : [])];
  const name = el ? elName(el) : '';
  // a melee mob with a ranged skill is a rarer hybrid
  const hybridMul = (kind === 'bolt' || kind === 'ring') ? 0.5 : 1;
  const natural = el === 0 ? 0.55 : r.natural?.includes(el) ? 2.5 : r.natural ? 0.8 : 1;
  add({
    id: el ? `${kind}:${name}` : kind, group: 'special', on: behaviours, minU: r.minU, weight: r.weight * natural * hybridMul, themes: r.themes, maxRadius: r.maxRadius, minRadius: r.minRadius,
    motifs: el ? motifOf(el) : r.motifs, excl: ['charge', 'burrow'], elem: el, kind, cheap: false,
    apply: (m, d, c) => {
      m.special = makeSpecial(kind, d, c.u, { swarm: c.swarm, frost: c.biome === FROZEN, bog: c.biome === MARSH, element: el, power: c.power });
      if (m.behavior === Behavior.Caster) {
        m.windup = m.special.windup;
        // a power that goes off around the caster only does so inside 0.9x its radius, and a caster parks at ~1.1x its reach
        const around = m.special as { radius?: number };
        if ((kind === 'wail' || kind === 'lure' || kind === 'whiteout' || kind === 'nova' || kind === 'gust') && around.radius !== undefined) m.reach = Math.min(m.reach, Math.floor(around.radius * 0.7));
        // a breath is cast from up close; an aimed bolt from a standoff
        if (kind === 'cone') m.reach = Math.min(m.reach, Math.floor((m.special as { range: number }).range * 0.8));
      }
    },
  });
}
for (const kind of Object.keys(SKILL_RULES) as SpecialKind[]) {
  addSkill(kind, 0);
  if (ELEMENTAL_KINDS.has(kind)) for (const el of ELEMS) addSkill(kind, el);
}

export const TRAITS: readonly Trait[] = T;
export const TRAIT_BY_ID: ReadonlyMap<string, Trait> = new Map(T.map((t) => [t.id, t]));

/** Do two traits clash (by id or by group-level rule)? */
export function clash(a: Trait, b: Trait): boolean {
  if (a.group === b.group) return true;
  if (a.excl?.includes(b.id) || a.excl?.includes(b.group) || b.excl?.includes(a.id) || b.excl?.includes(a.group)) return true;
  return false;
}

/** How much a monster leaning on `ctx.element` (and sometimes `ctx.second`) favours a trait made of `trait.elem`. */
export function affinity(trait: Trait, ctx: Ctx): number {
  const el = trait.elem ?? 0;
  if (!el) return trait.kind && ELEMENTAL_KINDS.has(trait.kind) ? 1 : 1; // plain traits are always welcome
  if (el === ctx.element) return 6;
  if (el === ctx.second) return 2.4;
  return ctx.element === 0 ? 0.25 : 0.12;
}

/** The element a monster of this biome leans on: the biome's own elements are favoured, any can come up; some are plain (0). */
export function pickAffinity(d: Dice, biome: number, plainChance: number): number {
  if (d.chance(plainChance)) return 0;
  const own = BIOME_ELEMENTS[biome];
  return d.weighted(ELEMS, (e) => (own.includes(e) ? 3 : 1)) ?? 0;
}
