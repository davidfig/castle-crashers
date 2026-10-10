// Class definitions (see docs/04-classes-progression.md). The order matters: art/chars + render/hero.ts use the same one.
export interface Swing {
  range: number;
  /** Minimum dot(facing, direction-to-target); lower = wider arc. */
  dot: number;
  damage: number;
  knock: number;
  cooldown: number;
  hitStop: number;
  /** Heavy swings break shields. */
  pierce: boolean;
  /** Ticks of forward step while swinging (weight). */
  lunge: number;
  /** Finisher: also cuts a straight wave this long down the facing line (0 = none). */
  wave: number;
  waveWidth: number;
  /** Point-blank area burst instead of an arc: hits everything within `range` all around, no facing, no lunge (the cleric). */
  aoe?: boolean;
  /** An aoe's inner ring: within this fraction of `range` each hit does `innerMul` times the damage (the cleric's aura grinds harder up close). */
  inner?: number;
  innerMul?: number;
  /** An aoe's innermost ring: a mob whose body touches the hero takes `touchMul` times the damage (instead of `innerMul`). */
  touchMul?: number;
}

/**
 * A player-fired projectile (an arrow, or the mage's fireball): speed in px/tick, lifetime in ticks; cooldown is the ticks between shots.
 * `splash` makes it explode on impact, hurting everything within that many px; `pierce` lets it fly on through what it hits.
 */
export interface ArrowDef {
  damage: number;
  knock: number;
  speed: number;
  ttl: number;
  cooldown: number;
  splash?: number;
  /** How close (px) the projectile must be to a mob to strike it (default 5); a big fireball is wider. */
  radius?: number;
  /** Fraction of `damage` the blast deals to things it did not hit directly (default 0.55). */
  splashDamage?: number;
  pierce?: boolean;
  /** Lobbed: it arcs over everything in its way (no direct hit) and bursts at the end of its range with the full blast. */
  lob?: boolean;
  /** The most mobs a piercing shot can hit before it is spent (the first one counts); unset = no limit. */
  maxHits?: number;
  /** A piercing shot that also ignores shields; without it, a shield still blocks it (and the shot stops there). */
  shieldPierce?: boolean;
}

/** The archer's ability 1: a volley loosed into the air that rains down on a spot `reach` px ahead (see sim/rain.ts). */
export interface RainDef {
  arrows: number;
  /** Arrows when cast with a full fury bar. */
  bigArrows: number;
  radius: number;
  bigRadius: number;
  damage: number;
  knock: number;
  /** Each arrow hurts mobs within this many px of where it lands. */
  hitRadius: number;
  /** How far ahead of the archer the centre lands. */
  reach: number;
}

export interface ClassDef {
  name: string;
  hp: number;
  speed: number;
  /** The basic attack: a short combo of quick sweeps. */
  combo: Swing[];
  /** Ability 2: the big sweep (with its wave down the field). Stamina is its only cooldown: `specialCooldown` is just how long the cast itself lasts (the swing or shot time). */
  special: Swing;
  specialCost: number;
  specialCooldown: number;
  // Stamina: spent by actions, recovered when not spending; empty means winded (slow, and no attacks or dashes).
  staminaMax: number;
  /** Stamina regained per tick once the regen delay has passed. */
  staminaRegen: number;
  /** Ticks after spending stamina before it starts to come back. */
  staminaRegenDelay: number;
  /** Winded until stamina has recovered to this much. */
  windedRecover: number;
  /** Movement speed multiplier while winded. */
  windedSpeed: number;
  attackCost: number;
  dashCost: number;
  /** Ticks after a swing in which the next press continues the combo. */
  comboWindow: number;
  furyMax: number;
  furyPerHit: number;
  furyPerSwingCap: number;
  furyPerKill: number;
  // ability 1: radial nova, powered by fury
  novaCost: number;
  novaRadius: number;
  novaDamage: number;
  novaKnock: number;
  novaCooldown: number;
  /** Used when the nova is cast with a full fury bar. */
  novaBigRadius: number;
  novaBigDamage: number;
  /** Ranged classes (the archer, the mage): the attack fires projectiles at this rate instead of swinging (`combo` is then unused). */
  shot?: ArrowDef;
  /** Ranged classes: the special is a fan of projectiles instead of a big sweep (`special` is then unused). */
  specialShot?: ArrowDef & { count: number; spread: number };
  /** Replaces the radial nova with a rain of arrows (the archer). */
  rain?: RainDef;
  /** Replaces the radial nova with a ground-splitting shockwave straight down the field (the warrior): px long and px to either side. */
  quake?: { length: number; width: number; bigLength: number; bigWidth: number };
  /** Healing the nova gives every player inside it (the cleric); 0 or absent = none. */
  novaHeal?: number;
  /** Same, for the full-fury nova. */
  novaBigHeal?: number;
  // dodge
  dashSpeed: number;
  dashTicks: number;
  /** Ticks before another dodge may start: only a gap against spamming, stamina is the real limit. */
  dashCooldown: number;
  dashDamage: number;
  dashKnock: number;
  /** The attack button toggles a pulsing aura (the cleric) that drains this much stamina per tick while on; absent = a normal attack. */
  auraDrain?: number;
  /** Movement multiplier while an attack is in progress (its cooldown running): absent = 1, 0 = rooted.*/
  attackMove?: number;
  /** The rogue's edge: melee hits on a mob that faces away from him deal this many times damage (absent = none). */
  backstab?: number;
  /** Same, for a strike thrown from hiding (the mob never saw it coming). */
  ambush?: number;
  /** An ambush swings this many times wider and farther than usual: a sweep across everything in front of him. */
  ambushReach?: number;
  /** The rogue is unseen until he strikes or a mob runs into him; this many ticks after being revealed before he can hide again. */
  hideCooldown?: number;
  /** The archer's edge: a shot's damage grows with the distance it flew, up to 1 + this at full range (absent = flat). */
  longShot?: number;
  /** What the dodge does; absent = a plain invulnerable roll. Upgrades tune `dashPower` / `dashRadius`. */
  dashKind?: 'charge' | 'teleport' | 'heal';
  /** teleport: distance; heal: hp restored. */
  dashPower?: number;
  /** charge: stamina drained per tick while the dodge button is held past `dashTicks`; the charge runs until released or winded. */
  dashDrain?: number;
  /** charge: plow radius; heal: pulse radius. */
  dashRadius?: number;
}

export const CLASSES: ClassDef[] = [
  {
    name: 'warrior',
    hp: 100,
    speed: 1.5,
    attackMove: 0.4,
    combo: [
      { range: 38, dot: 0.0, damage: 6, knock: 3.8, cooldown: 21, hitStop: 1, pierce: false, lunge: 3, wave: 0, waveWidth: 0 },
      { range: 40, dot: 0.0, damage: 6, knock: 4.2, cooldown: 21, hitStop: 1, pierce: false, lunge: 3, wave: 0, waveWidth: 0 },
    ],
    special: { range: 50, dot: -0.5, damage: 12, knock: 6.5, cooldown: 24, hitStop: 3, pierce: true, lunge: 5, wave: 120, waveWidth: 26 },
    specialCost: 35,
    specialCooldown: 24,
    staminaMax: 100,
    staminaRegen: 0.75,
    staminaRegenDelay: 12,
    windedRecover: 25,
    windedSpeed: 0.7,
    // 9 a swing against ~6.75 regenerated in the 21-tick gap: holding attack drains about 2 a swing, so ~45 swings empty the pool
    attackCost: 9,
    dashCost: 22,
    comboWindow: 28,
    furyMax: 100,
    furyPerHit: 1.2,
    furyPerSwingCap: 6,
    furyPerKill: 0.8,
    novaCost: 50,
    novaRadius: 70,
    novaDamage: 9,
    novaKnock: 3.5,
    novaCooldown: 30,
    novaBigRadius: 105,
    novaBigDamage: 14,
    // Warrior: a shoulder-down charge that bowls through everything in its path.
    dashSpeed: 4.6,
    dashTicks: 16,
    dashCooldown: 30,
    dashDamage: 7,
    dashKind: 'charge',
    // Held charge: after the 22 start cost the rest of the 100 stamina lasts ~104 ticks at 4.6/tick, i.e. ~480px (3/4 of the 640 view).
    dashDrain: 0.75,
    dashRadius: 15,
    dashKnock: 5,
  },
];

// ---- the other four classes, in the order the art uses (render/hero.ts HERO_CLASSES). They share the warrior's stamina,
// dash and combo rules (so any change to those carries over) and differ in stats and reach: the mage and archer hit from far with
// narrow arcs and long waves, the cleric's nova heals the party, the rogue is fast and fragile.
const WARRIOR = CLASSES[0];
const swing = (s: Partial<Swing> & Pick<Swing, 'range' | 'dot' | 'damage' | 'knock' | 'cooldown'>): Swing => ({ hitStop: 1, pierce: false, lunge: 0, wave: 0, waveWidth: 0, ...s });

CLASSES.push(
  {
    ...WARRIOR, name: 'mage', hp: 70, speed: 1.4, attackMove: 0.4,
    dashKind: 'teleport', dashPower: 85, dashCost: 20, dashCooldown: 30, dashDamage: 0, dashTicks: 0,
    // No swing: the basic attack is a fireball that explodes on impact. (`combo` and `special` are required by the type but unused.)
    combo: [swing({ range: 1, dot: 1, damage: 1, knock: 0, cooldown: 24 })],
    special: swing({ range: 1, dot: 1, damage: 1, knock: 0, cooldown: 24 }),
    shot: { damage: 12, knock: 4, speed: 2.6, ttl: 60, cooldown: 26, splash: 40, radius: 8 },
    // ability 2: a fireball lobbed in a high arc over the front line; it bursts where it lands, everything in the blast takes the full damage
    specialShot: { count: 1, spread: 0, damage: 14, knock: 6, speed: 2.4, ttl: 50, cooldown: 30, splash: 52, splashDamage: 1, lob: true },
    // The primary is a slightly larger fireball that costs as much as the big one (40): only two or three shots from a full bar, each hitting twice as hard
    attackCost: 40,
    specialCost: 40, specialCooldown: 30,
    novaCost: 40, novaRadius: 85, novaDamage: 11, novaBigRadius: 125, novaBigDamage: 16,
  },
  {
    ...WARRIOR, name: 'cleric', hp: 90, speed: 1.45, attackMove: 1,
    // No mace swing: a point-blank burst of holy light around the cleric hits everything close, in every direction.
    auraDrain: 0.12,
    // The aura is continuous: a small hit every 8 ticks all round her that barely nudges mobs (each hit slides one about 1.5 px) (the old pulse was 3 dmg / 22 ticks).
    combo: [swing({ range: 40, dot: -1, damage: 1, knock: 0.3, cooldown: 8, hitStop: 0, aoe: true, inner: 0.5, innerMul: 2, touchMul: 4 })],
    furyPerHit: 0.5,
    special: swing({ range: 62, dot: -1, damage: 7, knock: 9, cooldown: 28, hitStop: 2, pierce: true, aoe: true }),
    specialCost: 30, specialCooldown: 28,
    novaCost: 45, novaRadius: 58, novaDamage: 6, novaBigRadius: 85, novaBigDamage: 10, novaHeal: 25, novaBigHeal: 45,
    dashKind: 'heal', dashPower: 14, dashRadius: 70, dashSpeed: 3, dashTicks: 8, dashCost: 24, dashCooldown: 30, dashDamage: 0,
  },
  {
    ...WARRIOR, name: 'rogue', hp: 75, speed: 1.9, attackMove: 1,
    // Unseen until he strikes or a mob bumps into him. Front-on he is no better than anyone (4 dmg a quick jab); from behind he hits 2.5x,
    // and the strike out of hiding is a huge sweep across everything in front of him (then he is seen, and must wait to hide again).
    backstab: 2.5, ambush: 6, ambushReach: 1.8, hideCooldown: 240, attackCost: 4, // a 14-tick jab leaves ~1.5 ticks of regen: about 2.5 drained a jab
    combo: [swing({ range: 30, dot: 0.1, damage: 4, knock: 2, cooldown: 14, lunge: 4 }), swing({ range: 32, dot: 0.1, damage: 4, knock: 2.2, cooldown: 14, lunge: 4 })],
    special: swing({ range: 38, dot: -0.2, damage: 8, knock: 4, cooldown: 18, hitStop: 2, pierce: true, lunge: 8, wave: 80, waveWidth: 14 }),
    specialCost: 30, specialCooldown: 18,
    novaRadius: 55, novaDamage: 8, novaBigRadius: 85, novaBigDamage: 12,
    dashSpeed: 4.2, dashTicks: 7, dashCost: 14, dashCooldown: 24, dashDamage: 0,
  },
  {
    ...WARRIOR, name: 'archer', hp: 70, speed: 1.6, attackMove: 0.2,
    // No swing: it shoots. (`combo` and `special` are required by the type but never used for this class.)
    combo: [swing({ range: 1, dot: 1, damage: 1, knock: 0, cooldown: 8 })],
    special: swing({ range: 1, dot: 1, damage: 1, knock: 0, cooldown: 8 }),
    // Sniper: an arrow hits up to 2.2x harder at the far end of its flight, so he wants distance (and the mage's fireball does not scale).
    longShot: 1.2,
    shot: { damage: 3, knock: 1.2, speed: 4.2, ttl: 50, cooldown: 8, pierce: true, maxHits: 3 },
    specialShot: { count: 5, spread: 0.09, damage: 5, knock: 2.5, speed: 4.6, ttl: 80, cooldown: 14, pierce: true, maxHits: 5, shieldPierce: true },
    attackCost: 1,
    specialCost: 35, specialCooldown: 14,
    novaRadius: 60, novaDamage: 7, novaBigRadius: 95, novaBigDamage: 12,
    // Ability 1: a rain of arrows that lands about halfway out along his arrows' range (4.2 px/tick x 50 ticks / 2).
    rain: { arrows: 24, bigArrows: 38, radius: 36, bigRadius: 50, damage: 4, knock: 1.5, hitRadius: 9, reach: 105 },
  },
);

// The warrior's ability 1 drives his sword into the ground and sends a shockwave straight down the field (set here, after the
// others spread the warrior's fields, so only he has it).
WARRIOR.quake = { length: 190, width: 24, bigLength: 270, bigWidth: 36 };

/**
 * Which class a bot-controlled player slot takes, so a bot party always covers different classes. Slot 0 stays the warrior; the
 * other slots take the remaining classes in turn, starting from a point that shifts with the level seed (so every class gets a
 * turn across runs even though a party has only four slots).
 */
export function classForBotSlot(slot: number, seed = 0): number {
  if (slot === 0 || CLASSES.length < 2) return 0;
  return 1 + ((slot - 1 + seed) % (CLASSES.length - 1));
}
