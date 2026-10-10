// Level-up upgrades and the XP curve (docs/04-classes-progression.md, docs/06-ui.md).
//
// PLACEHOLDERS: this small pool exists so the level-up flow can be built and played. The real pool is the class tree's
// unlocks plus generic perks (docs/04, roadmap M4). Offers are a pure function of (run seed, slot, level), so they are
// stable across pause, desync recovery and replays.
import { createRng, rngFloat, rngInt, Stream } from '../engine/rng';

export interface UpgradeDef {
  id: string;
  /** Icon name in the UI kit (render/uiArt.ts): `boon-<id>`, a 16x16 badge drawn in render/boonIcons.ts. */
  icon: string;
  /** Card text: the bitmap font is 4 px per glyph and a card is 50 px wide, so each line is at most 11 characters. */
  name: string;
  text: readonly string[];
  /** Per rank, as a fraction: damage dealt +, damage taken -, speed +, gold +. 0 where it does not apply. */
  perRank: number;
  maxRank: number;
  /** 'stat' changes a number; 'trigger' makes something happen on an event (sim/boons.ts holds what). */
  kind: 'stat' | 'trigger';
  /** Synergy tags (docs/04): offers will lean toward the tags a hero already holds. */
  tags: readonly string[];
  /** Class indexes (data/classes.ts) this is offered to; absent = every class. */
  classes?: readonly number[];
  /** 0 common, 1 rare, 2 legendary; absent = common for a stat, rare for a trigger. Sets the border and how often it is offered. */
  rarity?: 0 | 1 | 2;
  /** Only worth offering with company: a solo hero is never offered it (offerFor's `party`). */
  needsParty?: boolean;
  /** The class-tree node that opens it (docs/04, "Meta progression"). Absent = always in the pool; present = only when `offerFor` is told that node is unlocked. */
  unlock?: string;
  /** An ability-scaling boon (sim/abilityMods.ts): which ability (0 basic, 1 special, 2 nova, 3 dodge) and which track (0 size, 1 count, 2 speed, 3 power). */
  scales?: { ability: 0 | 1 | 2 | 3; track: 0 | 1 | 2 | 3 };
  /** An evolution: two boons held at `rank` fuse into this one. Never in the ordinary pool; once both are held high enough it takes a card in every offer until taken or banished. */
  evolve?: { from: readonly [string, string]; rank: number };
}

/** The tier of `u`, defaulting by kind. */
export function rarityOf(u: UpgradeDef): 0 | 1 | 2 {
  return u.rarity ?? (u.kind === 'trigger' ? 1 : 0);
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'heavy', icon: 'boon-heavy', name: 'HEAVY HANDS', text: ['+15% DAMAGE'], perRank: 0.15, maxRank: 5, kind: 'stat', tags: ['damage'] },
  { id: 'thick', icon: 'boon-thick', name: 'THICK SKIN', text: ['-12% DAMAGE', 'TAKEN'], perRank: 0.12, maxRank: 4, kind: 'stat', tags: ['defense'] },
  { id: 'swift', icon: 'boon-swift', name: 'SWIFT FEET', text: ['+8% SPEED'], perRank: 0.08, maxRank: 5, kind: 'stat', tags: ['speed'] },
  { id: 'windfall', icon: 'boon-windfall', name: 'WINDFALL', text: ['+25% GOLD'], perRank: 0.25, maxRank: 4, kind: 'stat', tags: ['gold'] },
  { id: 'wind', icon: 'boon-wind', name: 'SECOND WIND', text: ['HEAL FULLY', 'NOW'], perRank: 0, maxRank: 255, kind: 'stat', tags: ['heal'] },
  // Triggers (roadmap "Progression", docs/04): the first of the boons that change what happens, not how much.
  { id: 'spark', icon: 'boon-spark', name: 'CHAIN SPARK', text: ['HITS ARC TO', 'NEARBY FOES'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['chain', 'lightning'] },
  { id: 'lust', icon: 'boon-lust', name: 'BLOODLUST', text: ['KILLS GIVE', 'STAMINA'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['streak', 'cooldown'] },
  { id: 'gift', icon: 'boon-gift', name: 'FAREWELL', text: ['DODGE DROPS', 'A BLAST'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['dodge', 'blast'] },
  { id: 'last', icon: 'boon-last', name: 'LAST STAND', text: ['LOW HEALTH', 'SHOCKWAVE'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['defense', 'blast'] },
  // Generic triggers.
  { id: 'pound', icon: 'boon-pound', name: 'SHATTER', text: ['SPECIAL', 'BLASTS AREA'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['blast', 'special'] },
  { id: 'tithe', icon: 'boon-tithe', name: 'BLOOD TITHE', text: ['EVERY 10TH', 'KILL HEALS'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['streak', 'heal'] },
  { id: 'exec', icon: 'boon-exec', name: 'EXECUTIONER', text: ['+50% VS', 'WOUNDED'], perRank: 0.5, maxRank: 3, kind: 'trigger', tags: ['damage', 'streak'] },
  // Warrior (class 0).
  { id: 'rift', icon: 'boon-rift', name: 'SPLIT EARTH', text: ['QUAKE FORKS', 'INTO LANES'], perRank: 0, maxRank: 2, kind: 'trigger', tags: ['quake', 'blast'], classes: [0] },
  { id: 'recoil', icon: 'boon-recoil', name: 'IRON RECOIL', text: ['HITS TO YOU', 'SHOVE FOES'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['defense', 'blast'], classes: [0] },
  // Mage (class 1) and archer (class 4).
  { id: 'twin', icon: 'boon-twin', name: 'TWIN FLAME', text: ['EXTRA SHOTS', 'FAN OUT'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['projectile', 'fire'], classes: [1, 4] },
  { id: 'echo', icon: 'boon-echo', name: 'ECHO BLAST', text: ['BLASTS GO', 'OFF TWICE'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['projectile', 'blast', 'fire'], classes: [1] },
  { id: 'quick', icon: 'boon-quick', name: 'QUICKSILVER', text: ['BLINK FEEDS', 'YOUR POWER'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['dodge', 'cooldown'], classes: [1] },
  // Cleric (class 2).
  { id: 'radiance', icon: 'boon-radiance', name: 'RADIANCE', text: ['AURA HEALS', 'THE PARTY'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['holy', 'heal'], classes: [2] },
  { id: 'wrath', icon: 'boon-wrath', name: 'HOLY WRATH', text: ['HEAL PULSE', 'ALSO SMITES'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['holy', 'blast', 'dodge'], classes: [2] },
  { id: 'vigil', icon: 'boon-vigil', name: 'VIGIL', text: ['REVIVES', 'COME SOONER'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['holy', 'heal', 'party'], classes: [2] },
  // Rogue (class 3).
  { id: 'dance', icon: 'boon-dance', name: 'DEATH DANCE', text: ['AMBUSH KILL', 'DODGE FREE'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['dodge', 'streak', 'flank'], classes: [3] },
  { id: 'keen', icon: 'boon-keen', name: 'KEEN EDGE', text: ['FLANKING', 'HITS HARDER'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['damage', 'flank'], classes: [3] },
  { id: 'pick', icon: 'boon-pick', name: 'PICKPOCKET', text: ['FLANK HITS', 'STEAL GOLD'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['gold', 'flank'], classes: [3] },
  // Archer (class 4).
  { id: 'eagle', icon: 'boon-eagle', name: 'EAGLE EYE', text: ['LONG SHOTS', 'HIT HARDER'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['projectile', 'damage'], classes: [4] },
  { id: 'downpour', icon: 'boon-downpour', name: 'DOWNPOUR', text: ['MORE ARROWS', 'IN THE RAIN'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['projectile', 'blast'], classes: [4] },
  { id: 'ring', icon: 'boon-ring', name: 'ARROW RING', text: ['DODGE FIRES', 'A RING'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['projectile', 'dodge'], classes: [4] },
  // Party boons (co-op): they act on, or because of, the people standing near you.
  { id: 'banner', icon: 'boon-banner', name: 'WAR BANNER', text: ['ALLIES NEAR', 'HIT HARDER'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['party', 'damage'] },
  { id: 'ward', icon: 'boon-ward', name: 'WARDING', text: ['ALLIES NEAR', 'TAKE LESS'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['party', 'defense'] },
  { id: 'martyr', icon: 'boon-martyr', name: 'MARTYR', text: ['YOUR FALL', 'HEALS PARTY'], perRank: 0, maxRank: 3, kind: 'trigger', tags: ['party', 'heal', 'holy'], needsParty: true },
  { id: 'rally', icon: 'boon-rally', name: 'AVENGER', text: ['ALLY FALLS:', 'FULL POWER'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['party', 'streak'], needsParty: true },
  // Legendaries: rule-changing, with a price. Opened by the class tree (unlock 'legend'); until the tree exists everything is in the pool.
  { id: 'glass', icon: 'boon-glass', name: 'GLASS FANG', text: ['2X DAMAGE', '1.5X TAKEN'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['damage', 'risk'], rarity: 2, unlock: 'legend' },
  { id: 'phoenix', icon: 'boon-phoenix', name: 'PHOENIX', text: ['RISE ONCE', 'IN FLAMES'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['defense', 'blast', 'fire'], rarity: 2, unlock: 'legend' },
  { id: 'frenzy', icon: 'boon-frenzy', name: 'FRENZY', text: ['ATTACK 50%', 'FASTER'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['damage', 'speed'], rarity: 2, unlock: 'legend' },
  // Evolutions: two boons at rank 2 fuse into one that changes the rules (sim/boons.ts holds what). Offered the moment both are held.
  { id: 'tempest', icon: 'boon-tempest', name: 'TEMPEST', text: ['SPARKS', 'EXPLODE'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['chain', 'lightning', 'blast'], rarity: 2, evolve: { from: ['spark', 'pound'], rank: 2 } },
  { id: 'bloodmoon', icon: 'boon-bloodmoon', name: 'BLOODMOON', text: ['EVERY KILL', 'HEALS A BIT'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['streak', 'heal', 'damage'], rarity: 2, evolve: { from: ['tithe', 'exec'], rank: 2 } },
  { id: 'undying', icon: 'boon-undying', name: 'UNDYING', text: ['LAST STAND', 'COMES TWICE'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['defense', 'blast'], rarity: 2, evolve: { from: ['last', 'thick'], rank: 2 } },
  { id: 'wildfire', icon: 'boon-wildfire', name: 'WILDFIRE', text: ['DODGE LAYS', '3 BLASTS'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['dodge', 'blast', 'speed'], rarity: 2, evolve: { from: ['gift', 'swift'], rank: 2 } },
  { id: 'rallycry', icon: 'boon-rallycry', name: 'WAR CRY', text: ['AURAS REACH', '2X FARTHER'], perRank: 0, maxRank: 1, kind: 'trigger', tags: ['party', 'damage', 'defense'], rarity: 2, needsParty: true, evolve: { from: ['banner', 'ward'], rank: 2 } },
  // Ability scaling: the basic attack and the special each grow along four tracks, any number of times, and cost more stamina for it (sim/abilityMods.ts).
  { id: 'bsize', icon: 'boon-bsize', name: 'SIZE', text: ['BIGGER'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['basic', 'size'], rarity: 1, scales: { ability: 0, track: 0 } },
  { id: 'bcount', icon: 'boon-bcount', name: 'SPLIT', text: ['MORE'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['basic', 'split'], rarity: 1, classes: [0, 1, 3, 4], scales: { ability: 0, track: 1 } },
  { id: 'bspeed', icon: 'boon-bspeed', name: 'SPEED', text: ['FASTER'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['basic', 'speed'], rarity: 1, scales: { ability: 0, track: 2 } },
  { id: 'bpower', icon: 'boon-bpower', name: 'POWER', text: ['STRONGER'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['basic', 'damage'], rarity: 1, scales: { ability: 0, track: 3 } },
  { id: 'ssize', icon: 'boon-ssize', name: 'SIZE', text: ['BIGGER'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['special', 'size'], rarity: 1, scales: { ability: 1, track: 0 } },
  { id: 'scount', icon: 'boon-scount', name: 'SPLIT', text: ['MORE'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['special', 'split'], rarity: 1, classes: [0, 1, 3, 4], scales: { ability: 1, track: 1 } },
  { id: 'sspeed', icon: 'boon-sspeed', name: 'SPEED', text: ['FASTER'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['special', 'speed'], rarity: 1, scales: { ability: 1, track: 2 } },
  { id: 'spower', icon: 'boon-spower', name: 'POWER', text: ['STRONGER'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['special', 'damage'], rarity: 1, scales: { ability: 1, track: 3 } },
  { id: 'nsize', icon: 'boon-nsize', name: 'SIZE', text: ['X'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['nova', 'size'], rarity: 0, scales: { ability: 2, track: 0 } },
  { id: 'ncount', icon: 'boon-ncount', name: 'SPLIT', text: ['X'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['nova', 'split'], rarity: 0, scales: { ability: 2, track: 1 } },
  { id: 'nspeed', icon: 'boon-nspeed', name: 'SPEED', text: ['X'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['nova', 'speed'], rarity: 0, scales: { ability: 2, track: 2 } },
  { id: 'npower', icon: 'boon-npower', name: 'POWER', text: ['X'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['nova', 'damage'], rarity: 0, scales: { ability: 2, track: 3 } },
  { id: 'dsize', icon: 'boon-dsize', name: 'SIZE', text: ['X'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['dodge', 'size'], rarity: 0, scales: { ability: 3, track: 0 } },
  { id: 'dcount', icon: 'boon-dcount', name: 'SPLIT', text: ['X'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['dodge', 'split'], rarity: 0, scales: { ability: 3, track: 1 } },
  { id: 'dspeed', icon: 'boon-dspeed', name: 'SPEED', text: ['X'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['dodge', 'speed'], rarity: 0, scales: { ability: 3, track: 2 } },
  { id: 'dpower', icon: 'boon-dpower', name: 'POWER', text: ['X'], perRank: 0, maxRank: 4, kind: 'stat', tags: ['dodge', 'damage'], rarity: 0, scales: { ability: 3, track: 3 } },
];

export const UPGRADE_INDEX: Readonly<Record<string, number>> = Object.fromEntries(UPGRADES.map((u, i) => [u.id, i]));
export const OFFER_SIZE = 3;
export const MAX_LEVEL = 20;

/** XP the party needs to go from `level` to the next. Shared, so heroes level together. */
export function xpToNext(level: number): number {
  return 60 + 30 * (level - 1);
}

/** Offer weight by tier: the common stats thin out and the interesting ones grow as the run goes on. */
function tierWeight(tier: number, level: number): number {
  if (tier === 0) return Math.max(4, 10 - 0.25 * level);
  if (tier === 1) return 6 + 0.3 * level;
  return 1 + 0.2 * level;
}

/** Synergy: a candidate is this much likelier for each tag (up to three) it shares with what the hero already holds, and for a boon already held (a rank-up deepens a build). */
const TAG_BIAS = 1;
const HELD_BIAS = 1.5;

/** Are both halves of evolution `u` held at the rank it needs? */
function evolved(u: UpgradeDef, ranks: ArrayLike<number>): boolean {
  return !!u.evolve && u.evolve.from.every((id) => ranks[UPGRADE_INDEX[id]] >= u.evolve!.rank);
}

/**
 * The three upgrades offered for `levelNumber` (the level just reached), as indexes into UPGRADES. Weighted by tier and by the tags
 * the hero already holds, so builds emerge; the first card is always a trigger when one is on offer (so a level never offers only
 * numbers), and the last is a wildcard drawn without the synergy bias. Pure in its arguments.
 */
export interface OfferContext {
  /** Heroes in the party: with fewer than two, boons that need company are left out. Absent = not considered. */
  party?: number;
  /** Class-tree nodes the hero's character has unlocked. Absent = everything is open (until the tree exists); present = a boon with an `unlock` needs it in here. */
  unlocked?: ReadonlySet<string>;
  /** Rerolls spent on this pick: each one deals a fresh hand. */
  salt?: number;
  /** Boons the hero has banished this run (index = UPGRADES, non-zero = never offered again). */
  banned?: ArrayLike<number>;
}

export function offerFor(seed: number, slot: number, levelNumber: number, ranks?: ArrayLike<number>, classId?: number, ctx: OfferContext = {}): number[] {
  const r = createRng((seed ^ Math.imul(slot + 1, 0x9e3779b1) ^ Math.imul(levelNumber + 1, 0x85ebca6b) ^ Math.imul((ctx.salt ?? 0) + 1, 0xc2b2ae35)) >>> 0, Stream.offer);
  const held = new Set<string>();
  if (ranks) for (let i = 0; i < UPGRADES.length; i++) if (ranks[i] > 0) for (const tag of UPGRADES[i].tags) held.add(tag);
  const pool: number[] = [];
  const syn: number[] = [];
  const evos: number[] = [];
  for (let i = 0; i < UPGRADES.length; i++) {
    const u = UPGRADES[i];
    if (u.classes && (classId === undefined || !u.classes.includes(classId))) continue;
    if (ranks && ranks[i] >= u.maxRank) continue;
    if (ctx.banned && ctx.banned[i]) continue;
    if (u.evolve) { if (ranks && evolved(u, ranks) && !(u.needsParty && ctx.party !== undefined && ctx.party < 2)) evos.push(i); continue; }
    if (u.needsParty && ctx.party !== undefined && ctx.party < 2) continue;
    if (u.unlock && ctx.unlocked && !ctx.unlocked.has(u.unlock)) continue;
    let shared = 0;
    for (const tag of u.tags) if (held.has(tag)) shared++;
    pool.push(i);
    syn.push(tierWeight(rarityOf(u), levelNumber) * (1 + TAG_BIAS * Math.min(3, shared)) * (ranks && ranks[i] > 0 ? HELD_BIAS : 1));
  }
  const draw = (candidates: number[], weight: (k: number) => number): number => {
    let total = 0;
    for (const k of candidates) total += weight(k);
    let x = rngFloat(r) * total;
    for (const k of candidates) { x -= weight(k); if (x < 0) return k; }
    return candidates[candidates.length - 1];
  };
  const out: number[] = [];
  const take = (k: number) => { out.push(pool[k]); pool.splice(k, 1); syn.splice(k, 1); };
  const triggers = () => pool.map((_, k) => k).filter((k) => UPGRADES[pool[k]].kind === 'trigger');
  while (out.length < OFFER_SIZE && pool.length > 0) {
    const all = pool.map((_, k) => k);
    if (out.length === 0) {
      const tr = triggers();
      take(draw(tr.length > 0 ? tr : all, (k) => syn[k]));
    } else if (out.length === OFFER_SIZE - 1) {
      take(draw(all, (k) => tierWeight(rarityOf(UPGRADES[pool[k]]), levelNumber))); // the wildcard
    } else take(draw(all, (k) => syn[k]));
  }
  // A fusion that is ready takes the wildcard's place: a build always gets its chance at the payoff.
  if (evos.length > 0 && out.length === OFFER_SIZE) out[OFFER_SIZE - 1] = evos[rngInt(r, evos.length)];
  // Which position holds the guaranteed trigger is not fixed.
  if (out.length === OFFER_SIZE) { const j = rngInt(r, OFFER_SIZE); [out[0], out[j]] = [out[j], out[0]]; }
  return out;
}

const rank = (ranks: ArrayLike<number>, id: string): number => ranks[UPGRADE_INDEX[id]];
export const damageMul = (ranks: ArrayLike<number>): number => (1 + UPGRADES[UPGRADE_INDEX.heavy].perRank * rank(ranks, 'heavy')) * (rank(ranks, 'glass') > 0 ? 2 : 1);
export const takenMul = (ranks: ArrayLike<number>): number => Math.max(0.4, 1 - UPGRADES[UPGRADE_INDEX.thick].perRank * rank(ranks, 'thick')) * (rank(ranks, 'glass') > 0 ? 1.5 : 1);
export const speedMul = (ranks: ArrayLike<number>): number => 1 + UPGRADES[UPGRADE_INDEX.swift].perRank * rank(ranks, 'swift');
export const goldMul = (ranks: ArrayLike<number>): number => 1 + UPGRADES[UPGRADE_INDEX.windfall].perRank * rank(ranks, 'windfall');

// ---------------------------------------------------------------------------------------------
// Ability cards: the same boon reads differently for each class (a fireball grows, a sword reaches).

/** What each class calls its basic attack, its special, its nova (ability 1) and its dodge. */
const NOUNS: readonly (readonly [string, string, string, string])[] = [
  ['SWORD', 'BIG SWING', 'QUAKE', 'CHARGE'],
  ['FIREBALL', 'MEGABALL', 'FIRE NOVA', 'BLINK'],
  ['AURA', 'HOLY BURST', 'HOLY NOVA', 'HEAL ROLL'],
  ['DAGGER', 'SHADOWCUT', 'BLADE RING', 'ROLL'],
  ['ARROW', 'VOLLEY', 'RAIN', 'ROLL'],
];
const RANGED = [1, 4];
const AURA = 2;
const DODGE_KIND = ['charge', 'teleport', 'heal', 'roll', 'roll'];

/** The card's name and text for `def`, for a hero of `classId`: ability boons say what they do to that class's own attack. */
export function cardFor(def: UpgradeDef, classId: number): { name: string; text: readonly string[] } {
  const s = def.scales;
  if (!s) return { name: def.name, text: def.text };
  const noun = NOUNS[classId]?.[s.ability] ?? def.name;
  const ranged = RANGED.includes(classId);
  const pct = (n: number): string => (s.ability === 2 ? `FURY +${n / 2}%` : `COST +${n}%`);
  if (s.ability === 2) {
    const quake = classId === 0, rain = classId === 4;
    switch (s.track) {
      case 0: return { name: noun, text: [quake ? 'LENGTH +12%' : rain ? 'WIDER +12%' : 'RADIUS +12%', pct(12)] };
      case 1: return { name: noun, text: [quake ? '+2 LANES' : rain ? '+8 ARROWS' : 'ECHO PULSE', pct(20)] };
      case 2: return { name: noun, text: ['RECOVER 8%', pct(8)] };
      default: return { name: noun, text: [classId === AURA ? '+20% POWER' : '+20% DAMAGE', pct(12)] };
    }
  }
  if (s.ability === 3) {
    switch (s.track) {
      case 0: return { name: noun, text: ['REACH +15%', pct(12)] };
      case 1: return { name: noun, text: ['EXTRA DODGE', pct(20)] };
      case 2: return { name: noun, text: ['RECOVER 10%', pct(8)] };
      default: return { name: noun, text: [DODGE_KIND[classId] === 'charge' ? '+25% DAMAGE' : DODGE_KIND[classId] === 'heal' ? '+25% HEAL' : 'DODGE BLAST', pct(12)] };
    }
  }
  switch (s.track) {
    case 0: return { name: noun, text: [ranged ? 'BLAST +25%' : classId === AURA ? 'RADIUS +12%' : 'REACH +12%', pct(12)] };
    case 1: return { name: noun, text: [ranged ? (classId === 4 && s.ability === 1 ? '+2 ARROWS' : '+1 SPLIT') : 'ARC WIDER', pct(20)] };
    case 2: return { name: noun, text: [ranged ? 'FLIES +20%' : 'QUICKER 8%', pct(8)] };
    default: return { name: noun, text: ['+20% DAMAGE', pct(12)] };
  }
}
