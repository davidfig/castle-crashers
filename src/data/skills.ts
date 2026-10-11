// Replacement skills (docs/trees/*.md, "Skill slots"): every starting skill of a class is a *slot* that a skill from its tree can replace, so
// the same class plays differently run to run. A class has four slots, one per button: 0 the basic attack (Swing), 1 Ability 2 (Big Swing),
// 2 Ability 1 (the Nova, paid in fury) and 3 the Dodge; they are the same four the ability tracks scale (sim/abilityMods.ts `AbilityKind`).
// A skill is data: most just *override fields of the class's definition* while equipped (`variantOf`), so the sim needs no new code for them;
// the Nova slot's skills do something no field can say, and sim/skills.ts holds what they do.
import type { ClassDef } from './classes';
import { DRUM, FROST, GRAVITY, SPIRIT, STORM, WARD, type Action } from './totems';

/** The four slots, in the order of the tracks and of the loadout array. */
export const SLOT_SWING = 0, SLOT_BIG = 1, SLOT_NOVA = 2, SLOT_DODGE = 3;
export const SLOTS = 4;

/** The boon behind each track card (size, count, speed, power) of each slot: the cards a skill raises. */
export const TRACK_BOONS: readonly (readonly string[])[] = [
  ['bsize', 'bcount', 'bspeed', 'bpower'],
  ['ssize', 'scount', 'sspeed', 'spower'],
  ['nsize', 'ncount', 'nspeed', 'npower'],
  ['dsize', 'dcount', 'dspeed', 'dpower'],
];

export interface SkillDef {
  /** Unique across classes; 0 is never a skill (it means "the class's own"). */
  id: number;
  classId: number;
  slot: number;
  name: string;
  /** What the card is called (11 characters at most). */
  short: string;
  /** Its picture in the UI kit (render/skillIcons.ts): `skill-<slug>`. */
  icon: string;
  /** What the slot's four tracks (size, count, speed, power) do for this skill: the card's line and its cost %, or null if this skill does not use that track (the pool leaves the card out). */
  tracks: readonly ([string, number] | null)[];
  /** Other cards left out while it is equipped (a mutation of the skill it replaced). */
  drops?: readonly string[];
  /** Fields of the class's definition it replaces while equipped. */
  override?: Partial<ClassDef>;
  /** For a class that fights with totems (the shaman): the totem kind it puts on its slot's button in place of the one there (swing = Attack, nova = Ability 1, big = Ability 2). */
  totem?: number;
}

/** The warrior's skills: Taunting Roar, Rage and Planted Standard replace the quake; Shield Rush the charge; Whirlwind the big swing; Pike the sword. */
export const SKILLS: readonly SkillDef[] = [
  { id: 1, classId: 0, slot: SLOT_NOVA, name: 'TAUNTING ROAR', short: 'ROAR', icon: 'skill-roar', drops: ['rift'], tracks: [['RADIUS +12%', 12], null, ['RECOVER 8%', 8], ['COVER +5%', 12]] },
  { id: 2, classId: 0, slot: SLOT_NOVA, name: 'RAGE', short: 'RAGE', icon: 'skill-rage', drops: ['rift'], tracks: [null, null, ['LASTS LONGER', 8], ['HITS HARDER', 12]] },
  { id: 3, classId: 0, slot: SLOT_NOVA, name: 'PLANTED STANDARD', short: 'STANDARD', icon: 'skill-standard', drops: ['rift'], tracks: [['AURA WIDER', 12], null, ['STANDS LONG', 8], ['AURA +20%', 12]] },
  {
    id: 4, classId: 0, slot: SLOT_DODGE, name: 'SHIELD RUSH', short: 'RUSH', icon: 'skill-rush',
    tracks: [['RUSH +15%', 12], ['EXTRA RUSH', 20], ['RECOVER 10%', 8], ['HITS +25%', 12]],
    // Shield up: a short, wide rush that carries what it catches and slams it at the end. (A held charge goes on; this one does not.)
    override: { dashKind: 'charge', dashSpeed: 3.4, dashTicks: 12, dashDrain: 0, dashDamage: 4, dashKnock: 9, dashRadius: 24, dashCooldown: 34, dashSlam: { radius: 44, damage: 8, knock: 7, stun: 24 } },
  },
  {
    id: 5, classId: 0, slot: SLOT_BIG, name: 'WHIRLWIND', short: 'WHIRLWIND', icon: 'skill-whirlwind',
    tracks: [['REACH +12%', 12], null, ['RECOVER 8%', 8], ['+20% DAMAGE', 12]],
    // A spin that keeps hitting everything round the hero, walking at a crawl, while stamina drains.
    override: {
      special: { range: 46, dot: -1, damage: 5, knock: 3.5, cooldown: 8, hitStop: 0, pierce: true, lunge: 0, wave: 0, waveWidth: 0, aoe: true },
      specialCost: 35, specialCooldown: 40, spin: { ticks: 40, every: 8, move: 0.6, drain: 0.35 },
    },
  },
  {
    id: 6, classId: 0, slot: SLOT_SWING, name: 'PIKE', short: 'PIKE', icon: 'skill-pike',
    tracks: [['REACH +12%', 12], ['ARC WIDER', 20], ['QUICKER 8%', 8], ['+20% DAMAGE', 12]],
    // The sword becomes a long, narrow thrust that reaches down a line of foes, slower and heavier, and no finisher.
    override: {
      combo: [
        { range: 74, dot: 0.82, damage: 9, knock: 5, cooldown: 26, hitStop: 1, pierce: false, lunge: 2, wave: 0, waveWidth: 0 },
        { range: 78, dot: 0.82, damage: 9, knock: 5.5, cooldown: 26, hitStop: 1, pierce: false, lunge: 2, wave: 0, waveWidth: 0 },
      ],
      attackMove: 0.3, attackCost: 11,
    },
  },
  // ---- the mage ----
  {
    id: 7, classId: 1, slot: SLOT_SWING, name: 'FLAMETHROWER', short: 'FLAMES', icon: 'skill-flamethrower',
    tracks: [['REACH +12%', 12], ['CONE WIDER', 20], ['QUICKER 8%', 8], ['+20% DAMAGE', 12]],
    // The fireball becomes a short cone of fire, held down: a quick, weak hit on every foe in it, a little mana a tick.
    override: {
      shot: undefined, attackCost: 2.5, attackMove: 0.6,
      combo: [{ range: 58, dot: 0.5, damage: 2.2, knock: 0.4, cooldown: 5, hitStop: 0, pierce: false, lunge: 0, wave: 0, waveWidth: 0, flame: true }],
    },
  },
  {
    id: 8, classId: 1, slot: SLOT_BIG, name: 'METEOR', short: 'METEOR', icon: 'skill-meteor',
    tracks: [['BLAST +12%', 12], null, ['RECOVER 8%', 8], ['+20% DAMAGE', 12]],
    // The megaball becomes a marked spot and a blast that lands on it a moment later.
    override: { specialShot: undefined, specialCost: 45, specialCooldown: 30, meteor: { reach: 110, delay: 50, radius: 62, damage: 30, knock: 8 } },
  },
  { id: 9, classId: 1, slot: SLOT_NOVA, name: 'FROST NOVA', short: 'FROST', icon: 'skill-frostnova', tracks: [['RADIUS +12%', 12], null, ['RECOVER 8%', 8], ['FREEZE +20%', 12]] },
  {
    id: 10, classId: 1, slot: SLOT_DODGE, name: 'ICE SLIDE', short: 'SLIDE', icon: 'skill-iceslide',
    tracks: [['SLIDE +15%', 12], ['EXTRA SLIDE', 20], ['RECOVER 10%', 8], ['FREEZE +25%', 12]],
    // The blink becomes a long slide, kept up while dodge is held; foes it touches are frozen.
    override: { dashKind: 'charge', dashSpeed: 3, dashTicks: 20, dashDrain: 0.45, dashCost: 14, dashCooldown: 36, dashDamage: 1, dashKnock: 1, dashRadius: 16, dashStun: 50 },
  },
  {
    id: 11, classId: 1, slot: SLOT_SWING, name: 'CHAIN BOLT', short: 'CHAIN', icon: 'skill-chainbolt',
    tracks: [['HOPS +25%', 12], ['+1 HOP', 20], ['QUICKER 8%', 8], ['+20% DAMAGE', 12]],
    // The fireball becomes a bolt that jumps through foes.
    override: { shot: undefined, attackCost: 20, chain: { range: 150, hops: 3, hop: 70, damage: 8, falloff: 0.85, cooldown: 22 } },
  },
  {
    id: 12, classId: 1, slot: SLOT_BIG, name: 'LIGHTNING STRIKE', short: 'STRIKE', icon: 'skill-lightning',
    tracks: [['LONGER +12%', 12], null, ['RECOVER 8%', 8], ['+20% DAMAGE', 12]],
    // The megaball becomes an instant bolt down the aim line.
    override: { specialShot: undefined, specialCost: 40, specialCooldown: 30, bolt: { length: 230, width: 12, damage: 16, stun: 14, arcs: 2 } },
  },
  // ---- the cleric ----
  {
    id: 13, classId: 2, slot: SLOT_SWING, name: 'HEALING BOLT', short: 'MENDING', icon: 'skill-healbolt',
    tracks: [['REACH +12%', 12], null, ['QUICKER 8%', 8], ['+20% POWER', 12]],
    // The aura becomes a bolt: it mends the most wounded ally in front, or hurts the nearest foe.
    override: { auraDrain: undefined, attackCost: 10, attackMove: 0.6, mend: { range: 130, damage: 6, heal: 12, cooldown: 16 } },
  },
  { id: 14, classId: 2, slot: SLOT_NOVA, name: 'SANCTUARY RING', short: 'SANCTUARY', icon: 'skill-sanctuary', tracks: [['RADIUS +12%', 12], null, ['RECOVER 8%', 8], ['MENDS +20%', 12]] },
  {
    id: 15, classId: 2, slot: SLOT_SWING, name: 'MACE', short: 'MACE', icon: 'skill-mace', drops: ['radiance'],
    tracks: [['REACH +12%', 12], null, ['QUICKER 8%', 8], ['+20% DAMAGE', 12]],
    // The aura becomes a real melee swing.
    override: {
      auraDrain: undefined, attackCost: 8, attackMove: 0.5, furyPerHit: 1.2,
      combo: [
        { range: 40, dot: 0, damage: 6, knock: 3.8, cooldown: 24, hitStop: 1, pierce: false, lunge: 3, wave: 0, waveWidth: 0 },
        { range: 42, dot: 0, damage: 6, knock: 4.2, cooldown: 24, hitStop: 1, pierce: false, lunge: 3, wave: 0, waveWidth: 0 },
      ],
    },
  },
  {
    id: 16, classId: 2, slot: SLOT_BIG, name: 'JUDGMENT BEAM', short: 'JUDGMENT', icon: 'skill-judgment',
    tracks: [['LONGER +12%', 12], null, ['RECOVER 8%', 8], ['+20% POWER', 12]],
    // The holy burst becomes a beam down the aim line: it scorches foes and mends the heroes it crosses.
    override: { specialCost: 40, specialCooldown: 30, bolt: { length: 200, width: 14, damage: 22, stun: 0, arcs: 0, element: 6, heal: 16 } },
  },
  { id: 17, classId: 2, slot: SLOT_NOVA, name: 'BEACON', short: 'BEACON', icon: 'skill-beacon', tracks: [null, null, ['RECOVER 8%', 8], ['WARD +5%', 12]] },
  {
    id: 18, classId: 2, slot: SLOT_DODGE, name: 'AEGIS ROLL', short: 'AEGIS', icon: 'skill-aegis', drops: ['wrath'],
    tracks: [['ROLL +15%', 12], ['EXTRA ROLL', 20], ['RECOVER 10%', 8], ['LASTS +25%', 12]],
    // The heal roll becomes a plain roll that leaves the heroes beside the cleric shielded for a few seconds.
    override: { dashKind: undefined, dashSpeed: 3.4, dashTicks: 12, dashCost: 20, dashCooldown: 30, dashDamage: 0, dashAegis: { radius: 70, ticks: 180, mul: 0.6 } },
  },
  // ---- the rogue ----
  {
    id: 19, classId: 3, slot: SLOT_SWING, name: 'RAPIER', short: 'RAPIER', icon: 'skill-rapier',
    tracks: [['REACH +12%', 12], ['ARC WIDER', 20], ['QUICKER 8%', 8], ['+20% DAMAGE', 12]],
    // The dagger jabs become a quick, lunging thrust; the first thrust after a dodge is a riposte, twice as hard.
    override: {
      attackCost: 3, riposte: 2,
      combo: [
        { range: 46, dot: 0.45, damage: 5, knock: 1.5, cooldown: 10, hitStop: 1, pierce: false, lunge: 5, wave: 0, waveWidth: 0 },
        { range: 48, dot: 0.45, damage: 5, knock: 1.7, cooldown: 10, hitStop: 1, pierce: false, lunge: 5, wave: 0, waveWidth: 0 },
      ],
    },
  },
  {
    id: 20, classId: 3, slot: SLOT_BIG, name: 'FAN OF KNIVES', short: 'KNIVES', icon: 'skill-fanknives',
    tracks: [null, ['+2 KNIVES', 20], ['FLIES +20%', 8], ['+20% DAMAGE', 12]],
    // Shadowcut becomes five knives thrown in a fan.
    override: { specialShot: { count: 5, spread: 0.18, damage: 4, knock: 1, speed: 3.8, ttl: 36, cooldown: 14 }, specialCost: 30, specialCooldown: 14 },
  },
  { id: 21, classId: 3, slot: SLOT_NOVA, name: 'SMOKE BOMB', short: 'SMOKE', icon: 'skill-smokebomb', tracks: [['RADIUS +12%', 12], null, ['RECOVER 8%', 8], ['LASTS +20%', 12]] },
  {
    id: 22, classId: 3, slot: SLOT_DODGE, name: 'SHADOW STEP', short: 'STEP', icon: 'skill-shadowstep',
    tracks: [['RANGE +15%', 12], ['EXTRA STEP', 20], ['RECOVER 10%', 8], null],
    // The roll becomes a blink behind the nearest foe, ready to backstab.
    override: { dashKind: undefined, dashTicks: 0, dashCost: 16, dashCooldown: 28, dashStep: { range: 150 } },
  },
  {
    id: 23, classId: 3, slot: SLOT_SWING, name: 'THROWING KNIFE', short: 'KNIFE', icon: 'skill-throwknife',
    tracks: [['BIGGER +25%', 12], ['+1 KNIFE', 20], ['FLIES +20%', 8], ['+20% DAMAGE', 12]],
    // The dagger becomes a thrown knife: ranged, light, and no flank bonus.
    override: { shot: { damage: 4, knock: 1.2, speed: 4, ttl: 40, cooldown: 14, radius: 6 }, attackCost: 4, attackMove: 0.8 },
  },
  {
    id: 24, classId: 3, slot: SLOT_DODGE, name: 'CALTROPS', short: 'CALTROPS', icon: 'skill-caltrops',
    tracks: [['ROLL +15%', 12], ['EXTRA ROLL', 20], ['RECOVER 10%', 8], null],
    // The roll leaves a spread of caltrops where it began.
    override: { dashPatch: { radius: 34, ticks: 360, damage: 0.8, stun: 8, every: 15, look: 0 } },
  },
  // ---- the archer ----
  {
    id: 25, classId: 4, slot: SLOT_SWING, name: 'CHARGED SHOT', short: 'CHARGED', icon: 'skill-chargedshot',
    tracks: [['LONGER +12%', 12], null, ['DRAWS QUICK', 8], ['+20% DAMAGE', 12]],
    // The arrow becomes a drawn shot: hold to draw, release to loose a piercing shot down the aim line, up to twice as hard.
    override: { shot: undefined, attackCost: 6, attackMove: 0.5, charge: { ticks: 36, min: 8, max: 2, length: 260, width: 6, damage: 9, cooldown: 14 } },
  },
  {
    id: 26, classId: 4, slot: SLOT_BIG, name: 'PIERCING BOLT', short: 'PIERCING', icon: 'skill-piercebolt',
    tracks: [['LONGER +12%', 12], null, ['RECOVER 8%', 8], ['+20% DAMAGE', 12]],
    // The volley becomes one heavy bolt through the whole line.
    override: { specialShot: undefined, specialCost: 45, specialCooldown: 30, bolt: { length: 320, width: 8, damage: 26, stun: 0, arcs: 0, element: 0 } },
  },
  {
    id: 27, classId: 4, slot: SLOT_NOVA, name: 'SPIKE FIELD', short: 'SPIKES', icon: 'skill-spikefield', drops: ['downpour'],
    tracks: [['RADIUS +12%', 12], null, ['RECOVER 8%', 8], ['+20% DAMAGE', 12]],
    // The rain becomes a patch of spikes on the ground ahead (the rain's aiming goes).
    override: { rain: undefined },
  },
  {
    id: 28, classId: 4, slot: SLOT_DODGE, name: 'SNARE TRAP', short: 'SNARE', icon: 'skill-snare',
    tracks: [['ROLL +15%', 12], ['EXTRA ROLL', 20], ['RECOVER 10%', 8], ['HOLDS +25%', 12]],
    // The roll drops a trap where it began: the first foe to touch it springs it, and every foe near is held.
    override: { dashPatch: { radius: 30, ticks: 600, damage: 0, stun: 120, every: 4, once: true, look: 2 } },
  },
  {
    id: 29, classId: 4, slot: SLOT_SWING, name: 'FIRE ARROW', short: 'FIRE', icon: 'skill-firearrow',
    tracks: [['BLAST +25%', 12], ['+1 ARROW', 20], ['FLIES +20%', 8], ['+20% DAMAGE', 12]],
    // The arrow becomes a flaming one that bursts where it lands.
    override: { shot: { damage: 3.5, knock: 1.2, speed: 4.2, ttl: 50, cooldown: 9, splash: 22, splashDamage: 0.8, radius: 6 }, attackCost: 3 },
  },
  {
    id: 30, classId: 4, slot: SLOT_DODGE, name: 'BACKFLIP SHOT', short: 'BACKFLIP', icon: 'skill-backflip',
    tracks: [['LEAP +15%', 12], ['EXTRA LEAP', 20], ['RECOVER 10%', 8], null],
    // The roll becomes a leap backward, loosing three arrows forward as it goes.
    override: { dashBack: true, dashVolley: { count: 3, spread: 0.12 }, dashSpeed: 3.8, dashTicks: 10, dashCost: 22, dashCooldown: 36 },
  },
  // ---- the shaman: totems on the buttons (Attack, Ability 1, Ability 2) and a step in place of the roll ----
  { id: 31, classId: 5, slot: SLOT_SWING, name: 'WARD TOTEM', short: 'WARD', icon: 'skill-wardtotem', tracks: [null, null, null, null], totem: WARD },
  { id: 32, classId: 5, slot: SLOT_BIG, name: 'GRAVITY WELL', short: 'GRAVITY', icon: 'skill-gravity', tracks: [null, null, null, null], totem: GRAVITY },
  { id: 33, classId: 5, slot: SLOT_NOVA, name: 'FROST TOTEM', short: 'FROST', icon: 'skill-frosttotem', tracks: [null, null, null, null], totem: FROST },
  { id: 34, classId: 5, slot: SLOT_BIG, name: 'STORM TOTEM', short: 'STORM', icon: 'skill-stormtotem', tracks: [null, null, null, null], totem: STORM },
  { id: 35, classId: 5, slot: SLOT_DODGE, name: 'SPIRIT STEP', short: 'STEP', icon: 'skill-spiritstep', tracks: [null, null, null, null], override: { dashPlant: SPIRIT } },
  { id: 36, classId: 5, slot: SLOT_NOVA, name: 'WAR DRUM', short: 'DRUM', icon: 'skill-drum', tracks: [null, null, null, null], totem: DRUM },
];
export const SKILL_INDEX: Readonly<Record<number, SkillDef>> = Object.fromEntries(SKILLS.map((k) => [k.id, k]));

/** The skill in slot `slot` of a loadout, or undefined for the class's own. */
export function skillIn(loadout: ArrayLike<number>, slot: number): SkillDef | undefined { return loadout[slot] ? SKILL_INDEX[loadout[slot]] : undefined; }

const variants = new Map<string, ClassDef>();
/**
 * The class as it plays with this loadout: the definition with each equipped skill's overrides laid over it (memoised; a pure function of
 * its arguments, so nothing here is state). The same object is returned for the same class and loadout.
 */
export function variantOf(base: ClassDef, loadout: ArrayLike<number>): ClassDef {
  if (!loadout[0] && !loadout[1] && !loadout[2] && !loadout[3]) return base;
  const key = `${base.name}:${loadout[0]}.${loadout[1]}.${loadout[2]}.${loadout[3]}`;
  let v = variants.get(key);
  if (!v) {
    v = { ...base };
    const plain = base.totems ? [...base.totems.plain] as [Action, Action, Action] : undefined;
    let changed = false;
    for (let slot = 0; slot < SLOTS; slot++) {
      const k = skillIn(loadout, slot);
      if (!k) continue;
      if (k.override) { Object.assign(v, k.override); changed = true; }
      // a totem replaces the one on a button: Attack (swing), Ability 1 (nova) or Ability 2 (big)
      if (k.totem !== undefined && plain) { plain[slot === SLOT_SWING ? 0 : slot === SLOT_NOVA ? 1 : 2] = { totem: k.totem }; changed = true; }
    }
    if (plain && base.totems && changed) v.totems = { ...base.totems, plain };
    if (!changed) v = base; // (a nova skill that is all code changes no field)
    variants.set(key, v);
  }
  return v;
}
