// Totems (docs/18-shaman-and-totems.md): spirit pillars the shaman plants. Each is an entity (Kind.Totem) with hit points, owned by the
// hero who planted it, and does one job: hold enemies (taunt), burn a ring, fire fireballs, or mend the party. The shaman is a
// one-player party of these; a kind is an index into TOTEMS.
import type { ArrowDef } from './classes';

export type TotemRole = 'taunt' | 'damage' | 'cannon' | 'heal' | 'storm' | 'ward' | 'gravity' | 'frost' | 'drum';

export interface TotemKind {
  id: string;
  name: string;
  /** One letter for the button icon over the shaman (the 4-px font has no more room). */
  glyph: string;
  /** Pillar and ring colours (0xRRGGBB). */
  color: number;
  accent: number;
  role: TotemRole;
  /** Ring radius (px): the taunt reach, the burn ring, the cannon's range, the mending ring. */
  radius: number;
  /** Ticks between pulses (cannon: between shots). */
  beat: number;
  /** Ticks a planted totem stands, and its hit points. */
  ttl: number;
  hp: number;
  /** Stamina to plant. */
  cost: number;
  /** Damage per pulse (damage), hit points mended per pulse (heal). A cannon's damage is in CANNON_SHOT. */
  power: number;
}

export const TOTEMS: readonly TotemKind[] = [
  { id: 'ember', name: 'EMBER', glyph: 'E', color: 0xff7a2a, accent: 0xffd070, role: 'damage', radius: 46, beat: 40, ttl: 600, hp: 40, cost: 12, power: 3 },
  { id: 'stone', name: 'STONE', glyph: 'S', color: 0xa89878, accent: 0xe0d4b8, role: 'taunt', radius: 120, beat: 60, ttl: 900, hp: 140, cost: 14, power: 0 },
  { id: 'cannon', name: 'CANNON', glyph: 'C', color: 0xd8402e, accent: 0xffb340, role: 'cannon', radius: 170, beat: 55, ttl: 600, hp: 50, cost: 18, power: 0 },
  { id: 'spirit', name: 'SPIRIT', glyph: 'H', color: 0x6ad8c4, accent: 0xd8fff4, role: 'heal', radius: 52, beat: 60, ttl: 720, hp: 40, cost: 12, power: 3 },
  /** Strikes the two nearest mobs in its ring with lightning every beat. */
  { id: 'storm', name: 'STORM', glyph: 'T', color: 0xe8d84a, accent: 0xffffff, role: 'storm', radius: 90, beat: 75, ttl: 600, hp: 40, cost: 14, power: 5 },
  /** The cleric's Beacon (data/skills.ts): a lamp that holds foes like a Stone, and wards the allies near it (sim/clericSkills.ts). Not in any totem bag. */
  { id: 'beacon', name: 'BEACON', glyph: 'B', color: 0xf0c850, accent: 0xfff4c8, role: 'taunt', radius: 110, beat: 60, ttl: 540, hp: 120, cost: 0, power: 0 },
  // The shaman's tree totems (data/skills.ts): each replaces one of the totems on a button.
  /** Heroes inside its ring take 30% less damage. */
  { id: 'ward', name: 'WARD', glyph: 'W', color: 0x5a8ae0, accent: 0xc8dcff, role: 'ward', radius: 80, beat: 30, ttl: 720, hp: 60, cost: 14, power: 0.3 },
  /** Every beat, pulls every mob in its ring toward it. */
  { id: 'gravity', name: 'GRAVITY', glyph: 'V', color: 0x7a4ab4, accent: 0xd0b0ff, role: 'gravity', radius: 110, beat: 20, ttl: 540, hp: 50, cost: 18, power: 6 },
  /** Every beat, freezes every mob in its ring for a moment (the stun, a chill that holds them). */
  { id: 'frost', name: 'FROST', glyph: 'F', color: 0x5ac8f4, accent: 0xe0f8ff, role: 'frost', radius: 80, beat: 30, ttl: 600, hp: 40, cost: 14, power: 24 },
  /** Heroes inside its ring deal 20% more damage. */
  { id: 'drum', name: 'DRUM', glyph: 'D', color: 0xd89a3a, accent: 0xffe0a0, role: 'drum', radius: 90, beat: 60, ttl: 720, hp: 50, cost: 14, power: 0.2 },
];

export const EMBER = 0, STONE = 1, CANNON = 2, SPIRIT = 3, STORM = 4, BEACON = 5, WARD = 6, GRAVITY = 7, FROST = 8, DRUM = 9;

/** The fireball a cannon totem lobs at the nearest mob: a splash shot, drawn like the mage's. */
export const CANNON_SHOT: ArrowDef = { damage: 9, knock: 3, speed: 2.8, ttl: 70, cooldown: 0, splash: 30, radius: 7 };

/** The shaman's own non-damaging tools: they move mobs, so the totems get to work. */
export type Herd = 'gale' | 'gather';
export interface HerdDef {
  name: string;
  glyph: string;
  color: number;
  cost: number;
  /** Ticks before it can be used again. */
  cooldown: number;
  /** Mobs within this many px of the shaman are moved. */
  radius: number;
  /** Shove strength (px/tick of knock-back; it decays 20% a tick, so the push is about five times this). */
  force: number;
}
export const HERDS: Record<Herd, HerdDef> = {
  /** Shoves everything near the shaman away: it peels a crowd off. */
  gale: { name: 'GALE', glyph: 'G', color: 0x9ae0ff, cost: 20, cooldown: 50, radius: 70, force: 6 },
  /** Hauls everything near toward the nearest Stone totem (or the shaman, with none standing): it feeds a crowd to the rings. */
  gather: { name: 'GATHER', glyph: 'A', color: 0xc8a0ff, cost: 24, cooldown: 70, radius: 140, force: 5 },
};

/**
 * What a button does: plant a given totem, plant the selected extra, step the selection of the extras (free and instant), or a herding move.
 */
export type Action = { totem: number } | { pick: true } | { cycle: 1 | -1 } | { herd: Herd } | null;

/**
 * A class that fights with totems (the shaman, docs/18). A hybrid: the core totems have a button each (Attack / Ability 1 / Ability 2), so the
 * basics are one press; holding Alt (E, or A on a pad) swaps in a second bank whose first slot plants the *selected* extra and whose second
 * steps the selection through `extras` (the rest of the roster, which the class tree grows). What fills the slots is the loadout, chosen in the camp.
 */
export interface TotemBagDef {
  /** Attack, Ability 1, Ability 2. */
  plain: readonly [Action, Action, Action];
  /** Attack, Ability 1, Ability 2 and Dodge, while Alt is held. (Plain Dodge is the dodge.) */
  alt: readonly [Action, Action, Action, Action];
  /** The extras the selection steps through (totem kinds). */
  extras: readonly number[];
  /** Ticks between one plant and the next. */
  cooldown: number;
  /** How far ahead of the hero (px) a totem is set down. */
  reach: number;
}
