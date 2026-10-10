// The kit of powers a generated monster is dressed from. Every trait here is a mechanic the hand-made enemies already use
// (see `MobDef` in data/mobs.ts), so the sim needs nothing new: a trait only sets fields on the definition. Traits belong to
// groups that cannot be doubled up on one monster, and a biome never gives the same trait to two of its enemies (so each
// enemy still "does something no other enemy does", and a player can learn what a name means).
import { Behavior, ProjStyle, type MobDef } from '../mobs';
import type { Motif } from '../monsterLook';
import { Dice, round } from './rand';
import { CASTER_SPECIALS, MELEE_SPECIALS, makeSpecial, type SpecialKind } from './specials';

/** Biome indices (ROSTERS order): Meadow, Haunted Keep, Frozen Pass, Sunken Marsh, Scorched Dunes. */
export const MEADOW = 0, KEEP = 1, FROZEN = 2, MARSH = 3, DUNES = 4;

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
  /** Other trait ids it cannot share a monster with. */
  excl?: readonly string[];
  /** Only for the small stuff (radius at most this). */
  maxRadius?: number;
  /** Only for the big stuff (radius at least this). */
  minRadius?: number;
  hp?: number;
  dmg?: number;
  motifs?: readonly Motif[];
  apply(def: MobDef, d: Dice, c: Ctx): void;
}

const M = Behavior.Melee, R = Behavior.Ranged, C = Behavior.Caster;
const ALL = [M, R, C] as const;
const FIGHT = [M, R] as const;

const T: Trait[] = [];
const add = (t: Trait): void => { T.push(t); };

// ---- what a melee hit also does
add({ id: 'slow', group: 'hit', on: [M], minU: 0, weight: 2, themes: [KEEP], dmg: 0.9, motifs: ['bones'], apply: (m, d) => { m.slowOnHit = d.int(60, 110); } });
add({ id: 'launch', group: 'hit', on: [M], minU: 0.2, weight: 1.6, themes: [FROZEN, MEADOW], dmg: 0.8, apply: (m, d) => { m.launch = d.int(64, 96); } });
add({ id: 'venom', group: 'hit', on: [M], minU: 0, weight: 2, themes: [MARSH], dmg: 0.6, motifs: ['poison'], apply: (m, d) => { m.poisonOnHit = d.int(110, 180); } });
add({ id: 'snare', group: 'hit', on: [M], minU: 0.4, weight: 1.4, themes: [MARSH], dmg: 0.9, motifs: ['slime'], apply: (m, d) => { m.rootOnHit = d.int(30, 45); } });
add({ id: 'wither', group: 'hit', on: [M], minU: 0.3, weight: 1.4, themes: [DUNES], motifs: ['bandage'], apply: (m, d) => { m.witherOnHit = d.int(170, 260); } });
add({ id: 'drain', group: 'hit', on: [M], minU: 0.1, weight: 1.6, themes: [DUNES, KEEP], hp: 0.85, motifs: ['glow'], apply: (m, d) => { m.drain = d.int(2, 3); } });

// ---- how it moves
add({ id: 'weave', group: 'move', on: [M], minU: 0, weight: 2, apply: (m, d) => { m.weave = round(d.range(0.5, 0.95), 2); } });
add({ id: 'hop', group: 'move', on: [M], minU: 0, weight: 1.8, themes: [MARSH], excl: ['burrow', 'charge'], apply: (m, d) => { m.hop = { every: d.int(45, 65), speed: round(d.range(1.2, 1.6), 1), minDist: 30 }; } });
add({ id: 'retreat', group: 'move', on: [M], minU: 0, weight: 1.6, themes: [FROZEN], excl: ['burrow'], apply: (m, d) => { m.retreat = d.int(24, 40); } });
add({ id: 'evade', group: 'move', on: ALL, minU: 0, weight: 1.6, themes: [DUNES], motifs: ['ghost'], apply: (m, d) => { m.evade = round(d.range(0.15, 0.3), 2); } });
add({ id: 'burrow', group: 'move', on: [M], minU: 0.15, weight: 1.4, themes: [DUNES], excl: ['hop', 'retreat', 'revive', 'charge', 'special'], maxRadius: 5, apply: (m, d) => { m.burrow = d.int(38, 50); } });

// ---- a bull's charge (a melee mob has this or a special, never both)
add({ id: 'charge', group: 'charge', on: [M], minU: 0.2, weight: 1.8, themes: [MEADOW, FROZEN], excl: ['burrow', 'hop', 'special'], minRadius: 4.2, dmg: 0.9,
  apply: (m, d) => { m.charge = { chance: 1 / d.int(380, 520), speed: round(d.range(3, 3.6), 1), distance: d.int(150, 200), windup: d.int(32, 40), cooldown: d.int(380, 440), damage: Math.round(m.damage * 1.15), minRange: 60, maxRange: d.int(220, 250), dazed: d.int(50, 60) }; } });

// ---- its body
add({ id: 'armor', group: 'body', on: ALL, minU: 0.15, weight: 1.6, themes: [DUNES, MEADOW], hp: 0.85, motifs: ['armor'], apply: (m) => { m.armored = true; } });
add({ id: 'shield', group: 'body', on: [M], minU: 0.1, weight: 1.6, themes: [MEADOW], excl: ['armor'], hp: 0.8, motifs: ['armor'], apply: (m, d) => { m.shield = true; m.shieldHp = d.int(16, 30); } });
add({ id: 'thorns', group: 'body', on: [M], minU: 0.2, weight: 1.4, themes: [MARSH], motifs: ['thorns', 'poison'], apply: (m, d) => { m.thorns = d.int(130, 200); } });
add({ id: 'regen', group: 'body', on: ALL, minU: 0.2, weight: 1.4, themes: [KEEP, MARSH], hp: 0.85, motifs: ['slime'], apply: (m, d) => { m.regen = round(d.range(0.02, 0.045), 3); } });
add({ id: 'berserk', group: 'body', on: [M], minU: 0.3, weight: 1.4, themes: [FROZEN, MEADOW], motifs: ['fur'], apply: (m, d) => { m.berserk = round(d.range(0.3, 0.5), 2); } });
add({ id: 'pack', group: 'body', on: [M], minU: 0, weight: 1.8, themes: [MEADOW, FROZEN], maxRadius: 5, motifs: ['fur'], apply: (m, d) => { m.pack = { radius: 44, bonus: round(d.range(0.15, 0.25), 2) }; } });
add({ id: 'revive', group: 'body', on: [M], minU: 0.55, weight: 1.4, themes: [KEEP], excl: ['burrow'], hp: 0.8, motifs: ['bones', 'ghost'], apply: (m, d) => { m.revive = round(d.range(0.35, 0.45), 2); } });
add({ id: 'mud', group: 'body', on: [M], minU: 0.35, weight: 1.3, themes: [MARSH], minRadius: 4.5, motifs: ['slime'], apply: (m, d) => { m.trail = { every: d.int(32, 40), radius: d.int(12, 14), linger: d.int(380, 440), slow: 30 }; } });

// ---- a field around it
add({ id: 'flame', group: 'aura', on: [M], minU: 0.5, weight: 1.5, themes: [DUNES], minRadius: 4.5, motifs: ['fire'], apply: (m, d) => { m.flame = { radius: d.int(30, 36) }; } });
add({ id: 'chill', group: 'aura', on: [M], minU: 0.45, weight: 1.5, themes: [FROZEN], minRadius: 4.5, motifs: ['frost'], apply: (m, d) => { m.aura = { radius: d.int(36, 42), slow: 30, damage: 1, pulse: 40 }; } });

// ---- what it leaves behind
add({ id: 'burst', group: 'death', on: [M], minU: 0.35, weight: 1.5, themes: [KEEP, MEADOW], minRadius: 4.8, motifs: ['bones'], apply: (m, d, c) => { m.onDeath = { split: { type: c.swarm, count: d.int(2, 3) } }; } });
add({ id: 'pool', group: 'death', on: ALL, minU: 0.3, weight: 1.4, themes: [KEEP, MARSH], motifs: ['poison'], apply: (m, d) => { m.onDeath = { pool: { radius: d.int(22, 26), linger: d.int(280, 320), damage: 2, slow: d.int(35, 45) } }; } });
add({ id: 'shards', group: 'death', on: ALL, minU: 0.3, weight: 1.4, themes: [FROZEN], motifs: ['frost', 'stone'], apply: (m, d) => { m.onDeath = { shards: { count: d.int(5, 7), speed: round(d.range(1.8, 2), 1), damage: 4 } }; } });
add({ id: 'spores', group: 'death', on: ALL, minU: 0.1, weight: 1.4, themes: [MARSH], motifs: ['poison'], apply: (m, d) => { m.onDeath = { cloud: { radius: d.int(26, 30), linger: d.int(280, 320), drain: 0.7 } }; } });

// ---- how a ranged mob shoots (plain arrows are the baseline and may repeat)
export const PLAIN_SHOT = 'arrow';
add({ id: PLAIN_SHOT, group: 'shot', on: [R], minU: 0, weight: 3, apply: () => { /* the default single arrow */ } });
add({ id: 'volley', group: 'shot', on: [R], minU: 0, weight: 1.6, themes: [KEEP], motifs: ['bones'], apply: (m, d) => { m.shot = { count: 2, spread: 0.03, speed: 2.1, damage: Math.max(2, Math.round(m.damage * 0.85)), style: ProjStyle.Bone }; m.atkCooldown += 10; } });
add({ id: 'fan', group: 'shot', on: [R], minU: 0.3, weight: 1.2, themes: [FROZEN, MEADOW], apply: (m, d) => { m.shot = { count: 3, spread: round(d.range(0.06, 0.09), 2), speed: 2, damage: Math.max(2, Math.round(m.damage * 0.7)), style: ProjStyle.Shard }; m.atkCooldown += 20; } });
add({ id: 'harpoon', group: 'shot', on: [R], minU: 0, weight: 1.4, themes: [FROZEN], apply: (m, d) => { m.shot = { count: 1, spread: 0, speed: 2.6, damage: Math.max(2, Math.round(m.damage * 0.75)), style: ProjStyle.Harpoon, pull: d.int(48, 60) }; m.atkCooldown += 20; } });
add({ id: 'glob', group: 'shot', on: [R], minU: 0, weight: 1.4, themes: [MARSH], motifs: ['poison', 'slime'], apply: (m, d) => { m.shot = { count: 1, spread: 0, speed: 1.9, damage: 3, style: ProjStyle.Glob, poison: d.int(130, 160) }; } });
add({ id: 'firebolt', group: 'shot', on: [R], minU: 0, weight: 1.4, themes: [DUNES], motifs: ['fire'], apply: (m, d) => { m.shot = { count: 1, spread: 0, speed: 2.3, damage: 4, style: ProjStyle.Fire, poison: d.int(110, 130) }; } });
add({ id: 'falcon', group: 'shot', on: [R], minU: 0.3, weight: 1.2, themes: [DUNES], apply: (m, d) => { m.shot = { count: 1, spread: 0, speed: 1.5, damage: Math.max(3, Math.round(m.damage * 0.8)), style: ProjStyle.Falcon, homing: true }; m.atkCooldown += 30; } });

// ---- a telegraphed special
const SPECIAL_RULES: Record<SpecialKind, { minU: number; weight: number; themes?: readonly number[]; maxRadius?: number; minRadius?: number; motifs?: readonly Motif[] }> = {
  lob: { minU: 0, weight: 2, themes: [MEADOW] },
  summon: { minU: 0.5, weight: 1.4, themes: [KEEP], motifs: ['bones'] },
  heal: { minU: 0.3, weight: 1.6, themes: [MEADOW], motifs: ['glow'] },
  rally: { minU: 0.3, weight: 1.6, themes: [MEADOW] },
  blink: { minU: 0.25, weight: 1.6, themes: [KEEP], motifs: ['ghost'] },
  nova: { minU: 0.2, weight: 1.6, themes: [MEADOW, FROZEN], motifs: ['stone'] },
  beam: { minU: 0.5, weight: 1.4, themes: [KEEP, DUNES], motifs: ['glow'] },
  trap: { minU: 0.1, weight: 1.6, themes: [FROZEN, MARSH], motifs: ['thorns'] },
  cling: { minU: 0, weight: 1.2, themes: [FROZEN], maxRadius: 3.4, motifs: ['frost'] },
  ward: { minU: 0.4, weight: 1.4, themes: [FROZEN], motifs: ['frost'] },
  storm: { minU: 0.35, weight: 1.5, themes: [FROZEN, MARSH], motifs: ['frost'] },
  whiteout: { minU: 0.35, weight: 1.4, themes: [FROZEN], motifs: ['frost', 'ghost'] },
  wail: { minU: 0.35, weight: 1.5, themes: [KEEP], motifs: ['ghost'] },
  lure: { minU: 0.2, weight: 1.5, themes: [MARSH], motifs: ['glow', 'ghost'] },
  leap: { minU: 0.25, weight: 1.5, themes: [MARSH], minRadius: 4.5 },
  gust: { minU: 0.2, weight: 1.5, themes: [DUNES], motifs: ['ghost'] },
  pit: { minU: 0.3, weight: 1.4, themes: [DUNES] },
  hex: { minU: 0.25, weight: 1.5, themes: [MARSH], motifs: ['glow'] },
  dazzle: { minU: 0.4, weight: 1.4, themes: [DUNES], motifs: ['glow'] },
};
for (const kind of Object.keys(SPECIAL_RULES) as SpecialKind[]) {
  const r = SPECIAL_RULES[kind];
  const behaviours = [...(MELEE_SPECIALS.includes(kind) ? [M] : []), ...(CASTER_SPECIALS.includes(kind) ? [C] : [])];
  add({
    id: kind, group: 'special', on: behaviours, minU: r.minU, weight: r.weight, themes: r.themes, maxRadius: r.maxRadius, minRadius: r.minRadius, motifs: r.motifs, excl: ['charge', 'burrow'],
    apply: (m, d, c) => {
      m.special = makeSpecial(kind, d, c.u, { swarm: c.swarm, frost: c.biome === FROZEN, bog: c.biome === MARSH });
      if (m.behavior === Behavior.Caster) m.windup = m.special.windup;
    },
  });
}

export const TRAITS: readonly Trait[] = T;
export const TRAIT_BY_ID: ReadonlyMap<string, Trait> = new Map(T.map((t) => [t.id, t]));

/** Traits a cheap slot (a fodder, a crowd filler, something summoned) may wear: light ones that never need a lesson. */
export const CHEAP_OK: ReadonlySet<string> = new Set(['weave', 'evade', 'pack', 'hop', 'retreat', 'slow', 'venom', 'armor', 'drain', PLAIN_SHOT, 'volley', 'harpoon', 'glob', 'firebolt', 'spores']);

/** Do two traits clash (by id or by group-level rule)? */
export function clash(a: Trait, b: Trait): boolean {
  if (a.group === b.group) return true;
  if (a.excl?.includes(b.id) || a.excl?.includes(b.group) || b.excl?.includes(a.id) || b.excl?.includes(a.group)) return true;
  return false;
}
