// Telegraphed skills for generated monsters. A skill is a *delivery* (one factory per `Special` kind) made of an *element* (data/elements.ts) with a
// handful of *modifiers* the dice choose (how many strikes, laid out in what pattern, what shape of projectile, whether it pierces, bursts, homes,
// or leaves a pool behind), scaled by `u` (0 = a weak early enemy .. 1 = a late one). Numbers start from the ones the hand-made enemies proved out
// (data/mobs.ts). Boss versions (`bossSpecial`) are the same skills, bigger and with no cooldown of their own (the boss's gap paces them).
// Nothing here knows who will cast the skill: the same `Special` data is what a hero's skill tree will hold.
import { Element } from '../elements';
import { NovaStyle, Pattern, ProjStyle, type Special } from '../mobs';
import { Dice, round } from './rand';

export type SpecialKind = Special['kind'];

/** Who can use a skill well: a melee mob has to walk up to the hero, a caster keeps its distance. */
export const MELEE_SPECIALS: readonly SpecialKind[] = ['blink', 'nova', 'trap', 'cling', 'whiteout', 'leap', 'pounce', 'gust', 'cone', 'ring', 'bolt'];
export const CASTER_SPECIALS: readonly SpecialKind[] = ['lob', 'summon', 'heal', 'rally', 'beam', 'wail', 'ward', 'storm', 'lure', 'pit', 'hex', 'dazzle', 'trap', 'bolt', 'ring', 'cone', 'totem'];
/** What a boss may cast. */
export const BOSS_SPECIALS: readonly SpecialKind[] = ['rally', 'lob', 'nova', 'storm', 'trap', 'ward', 'whiteout', 'beam', 'summon', 'blink', 'heal', 'wail', 'leap', 'lure', 'gust', 'pit', 'bolt', 'ring', 'cone', 'totem'];
/** Kinds whose element changes what they do (the rest only borrow it for their look): every damaging delivery. */
export const ELEMENTAL_KINDS: ReadonlySet<SpecialKind> = new Set<SpecialKind>(['lob', 'trap', 'storm', 'pit', 'nova', 'beam', 'leap', 'pounce', 'gust', 'cling', 'whiteout', 'wail', 'lure', 'hex', 'dazzle', 'bolt', 'ring', 'cone', 'totem']);
/** Kinds that aim: the hero can sidestep them once the aim is locked. */
export const AIMED_KINDS: ReadonlySet<SpecialKind> = new Set<SpecialKind>(['bolt', 'cone', 'beam']);

export interface SkillCtx {
  /** The cheap swarm slot of the biome: what a summoner raises. */
  swarm: number;
  frost?: boolean;
  bog?: boolean;
  /** What the skill is made of (0 or absent = the hand-made look). */
  element?: number;
  /** How potent the element's effect is (1 = as written in sim/elements.ts). */
  power?: number;
}

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

/** The ordinary patterns, weighted: scatter stays the commonest. */
const PATTERNS: readonly (readonly [number, number])[] = [
  [Pattern.Scatter, 2.2], [Pattern.Line, 1], [Pattern.Wall, 1], [Pattern.Ring, 1.2], [Pattern.Cross, 1], [Pattern.Spiral, 1], [Pattern.March, 1],
];

/** A pattern and the spread that suits it (px). */
function patternFor(d: Dice, count: number): { pattern?: number; spread?: number } {
  if (count < 2) return {};
  const pat = d.weighted(PATTERNS, (p) => p[1])![0];
  switch (pat) {
    case Pattern.Line: return { pattern: pat, spread: d.int(46, 70) };
    case Pattern.Wall: return { pattern: pat, spread: d.int(46, 72) };
    case Pattern.Ring: return { pattern: pat, spread: d.int(34, 52) };
    case Pattern.Cross: return { pattern: pat, spread: d.int(30, 48) };
    case Pattern.Spiral: return { pattern: pat, spread: d.int(48, 70) };
    case Pattern.March: return { pattern: pat, spread: 0 };
    default: return { spread: d.int(40, 70) };
  }
}

const SHAPES: readonly number[] = [ProjStyle.Orb, ProjStyle.Spike, ProjStyle.Comet, ProjStyle.Mote];

/** An ordinary monster's skill. `windup` and `cooldown` are its own. */
export function makeSpecial(kind: SpecialKind, d: Dice, u: number, c: SkillCtx): Special {
  const sp = baseSpecial(kind, d, u, c);
  const el = c.element ?? 0;
  if (el && ELEMENTAL_KINDS.has(kind)) {
    sp.element = el;
    sp.power = round((c.power ?? lerp(0.9, 1.5, u)) * d.range(0.88, 1.12), 2);
  }
  return sp;
}

function baseSpecial(kind: SpecialKind, d: Dice, u: number, c: SkillCtx): Special {
  const cool = (lo: number, hi: number) => Math.round(d.range(lo, hi));
  const el = c.element ?? 0;
  switch (kind) {
    case 'lob': {
      const count = u > 0.35 && d.chance(0.55) ? d.int(2, u > 0.7 ? 5 : 3) : 1;
      const residue = el && u >= 0.3 && d.chance(0.35) ? { radius: cool(20, 26), linger: cool(170, 250), damage: d.int(1, 2) } : undefined;
      return { kind, windup: cool(34, 42), cooldown: cool(130, 190), minRange: 40, maxRange: cool(165, 190), radius: cool(14, 20), damage: Math.round(lerp(7, 12, u)), delay: cool(44, 52),
        ...(count > 1 ? { count, ...patternFor(d, count) } : {}), ...(residue ? { residue } : {}) };
    }
    case 'summon':
      return { kind, windup: cool(46, 56), cooldown: cool(300, 340), type: c.swarm, count: d.int(2, 3), cap: d.int(8, 12) };
    case 'heal':
      return { kind, windup: cool(38, 46), cooldown: cool(190, 230), radius: cool(66, 80), amount: round(d.range(0.35, 0.5), 2) };
    case 'rally':
      return { kind, windup: cool(28, 34), cooldown: cool(260, 300), radius: cool(85, 105), duration: cool(300, 360) };
    case 'blink':
      return { kind, windup: cool(24, 30), cooldown: cool(220, 260), minRange: 70, maxRange: cool(210, 240) };
    case 'nova':
      return { kind, windup: cool(40, 48), cooldown: cool(220, 260), radius: cool(38, 52), damage: Math.round(lerp(11, 17, u)), slow: el ? 0 : d.chance(0.5) ? 0 : cool(40, 80),
        style: c.frost || el === Element.Ice ? NovaStyle.Frost : el === Element.Shadow || el === Element.Wind ? NovaStyle.Scream : d.pick([NovaStyle.Stomp, NovaStyle.Scream]) };
    case 'beam':
      return { kind, windup: cool(52, 60), cooldown: cool(230, 270), range: cool(210, 240), width: d.int(5, 7), damage: Math.round(lerp(13, 19, u)) };
    case 'trap': {
      const count = u > 0.4 && d.chance(0.4) ? d.int(2, 3) : 1;
      return { kind, windup: cool(24, 30), cooldown: cool(260, 300), minRange: 30, maxRange: cool(160, 180), radius: d.int(8, 10), damage: Math.round(lerp(3, 5, u)), arm: 50, root: cool(55, 65), linger: 900, cap: count > 1 ? 3 : 2,
        ...(count > 1 ? { count, ...patternFor(d, count) } : { spread: cool(18, 26) }) };
    }
    case 'cling':
      return { kind, windup: cool(8, 12), cooldown: cool(180, 220), range: 26, damage: 1, pulse: cool(26, 34), slow: cool(35, 45), cap: 3 };
    case 'ward':
      return { kind, windup: cool(46, 54), cooldown: cool(280, 320), radius: cool(84, 96), duration: cool(440, 520), need: 3 };
    case 'storm': {
      const count = u > 0.5 && d.chance(0.4) ? d.int(2, 3) : 1;
      return { kind, windup: cool(40, 48), cooldown: cool(200, 240), minRange: 30, maxRange: cool(160, 180), radius: cool(32, 40), delay: cool(46, 54), linger: cool(240, 280), damage: Math.round(lerp(2, 3, u)), slow: cool(50, 70), cap: 3 * count,
        ...(count > 1 ? { count, ...patternFor(d, count) } : {}), ...(c.bog && !el ? { bog: true } : {}) };
    }
    case 'whiteout':
      return { kind, windup: cool(32, 40), cooldown: cool(280, 320), radius: cool(58, 70), damage: 3, duration: cool(65, 85) };
    case 'wail':
      return { kind, windup: cool(40, 48), cooldown: cool(220, 260), radius: cool(64, 76), damage: 4, duration: cool(190, 230) };
    case 'lure':
      return { kind, windup: cool(36, 44), cooldown: cool(250, 290), radius: cool(130, 150), pull: cool(58, 70), damage: 2 };
    case 'leap':
      return { kind, windup: cool(25, 31), cooldown: cool(250, 290), minRange: 50, maxRange: cool(140, 160), radius: cool(18, 22), damage: Math.round(lerp(7, 11, u)), slow: el ? 0 : cool(50, 70), delay: cool(27, 33) };
    case 'pounce':
      return { kind, windup: cool(12, 16), cooldown: cool(140, 170), minRange: 34, maxRange: cool(120, 135), radius: cool(13, 15), damage: Math.round(lerp(8, 11, u)), delay: cool(14, 18) };
    case 'gust':
      return { kind, windup: cool(30, 38), cooldown: cool(260, 300), radius: cool(50, 62), damage: Math.round(lerp(3, 5, u)), push: cool(80, 100) };
    case 'pit': {
      const count = u > 0.5 && d.chance(0.35) ? d.int(2, 3) : 1;
      return { kind, windup: cool(42, 50), cooldown: cool(280, 320), minRange: 30, maxRange: cool(160, 180), radius: cool(30, 38), delay: cool(40, 50), linger: cool(220, 260), pull: round(d.range(0.5, 0.6), 2), damage: 4,
        ...(count > 1 ? { count, ...patternFor(d, count) } : {}) };
    }
    case 'hex':
      return { kind, windup: cool(40, 48), cooldown: cool(240, 280), minRange: 30, maxRange: cool(160, 180), radius: cool(20, 24), duration: cool(280, 320) };
    case 'dazzle':
      return { kind, windup: cool(44, 52), cooldown: cool(260, 300), minRange: 40, maxRange: cool(190, 210), radius: cool(22, 26), duration: cool(45, 55), damage: 3 };
    case 'bolt': {
      const shape = d.pick(SHAPES);
      const count = u > 0.3 && d.chance(0.45) ? d.int(2, u > 0.7 ? 5 : 3) : 1;
      const speedBy: Record<number, [number, number]> = { [ProjStyle.Orb]: [1.5, 2.1], [ProjStyle.Spike]: [2.1, 2.8], [ProjStyle.Comet]: [2.4, 3.1], [ProjStyle.Mote]: [1.3, 1.9] };
      const [lo, hi] = speedBy[shape];
      return { kind, windup: cool(34, 46), cooldown: cool(150, 220), minRange: 30, maxRange: cool(190, 250), count, spread: count > 1 ? round(d.range(0.035, 0.08), 3) : 0, speed: round(d.range(lo, hi), 1),
        damage: Math.round(lerp(4, 9, u) * (count > 1 ? 0.8 : 1)), shape,
        ...(shape === ProjStyle.Comet && d.chance(0.4) ? { pierce: true } : {}), ...(shape === ProjStyle.Mote && d.chance(0.45) ? { homing: true } : {}), ...(shape === ProjStyle.Orb && d.chance(0.5) ? { splash: cool(24, 36) } : {}) };
    }
    case 'ring': {
      const shape = d.pick([ProjStyle.Orb, ProjStyle.Mote, ProjStyle.Spike]);
      return { kind, windup: cool(38, 48), cooldown: cool(190, 250), maxRange: cool(130, 180), count: d.int(6, 12), speed: round(d.range(1.2, 2), 1), damage: Math.round(lerp(3, 7, u)), shape, ...(d.chance(0.2) ? { pierce: true } : {}) };
    }
    case 'cone': {
      const range = cool(58, 88);
      return { kind, windup: cool(34, 44), cooldown: cool(180, 240), minRange: 0, maxRange: Math.round(range * 1.15), range, arc: round(d.range(0.06, 0.14), 3), damage: Math.round(lerp(8, 15, u)) };
    }
    case 'totem':
      return { kind, windup: cool(36, 46), cooldown: cool(300, 360), minRange: 40, maxRange: cool(150, 190), range: cool(150, 200), lifetime: cool(300, 420), interval: cool(50, 80), damage: Math.round(lerp(3, 5, u)), speed: round(d.range(1.5, 2.1), 1), shape: d.pick([ProjStyle.Orb, ProjStyle.Mote, ProjStyle.Spike]), cap: d.int(1, 2) };
  }
}

/** A boss's version of a skill: bigger, reaching the whole field, with no cooldown of its own. */
export function bossSpecial(kind: SpecialKind, d: Dice, c: SkillCtx): Special {
  const sp = baseBoss(kind, d, c);
  const el = c.element ?? 0;
  if (el && ELEMENTAL_KINDS.has(kind)) {
    sp.element = el;
    sp.power = round((c.power ?? 1.5) * d.range(0.9, 1.1), 2);
  }
  return sp;
}

function baseBoss(kind: SpecialKind, d: Dice, c: SkillCtx): Special {
  const w = (lo: number, hi: number) => Math.round(d.range(lo, hi));
  const el = c.element ?? 0;
  const bossPat = (count: number, spreadMul = 1): { pattern?: number; spread?: number } => {
    const p = patternFor(d, count);
    return { ...p, ...(p.spread ? { spread: Math.round(p.spread * 1.4 * spreadMul) } : {}) };
  };
  switch (kind) {
    case 'rally': return { kind, windup: w(42, 48), cooldown: 0, radius: w(140, 160), duration: w(340, 380) };
    case 'lob': {
      const count = d.int(4, 6);
      return { kind, windup: w(38, 46), cooldown: 0, minRange: 0, maxRange: w(320, 380), radius: w(20, 22), damage: w(12, 14), delay: 56, count, ...bossPat(count),
        ...(el && d.chance(0.45) ? { residue: { radius: w(24, 30), linger: w(220, 300), damage: 2 } } : {}) };
    }
    case 'nova': return { kind, windup: w(46, 52), cooldown: 0, radius: w(80, 100), damage: w(16, 19), slow: el ? 0 : w(100, 150), style: c.frost || el === Element.Ice ? NovaStyle.Frost : d.pick([NovaStyle.Stomp, NovaStyle.Scream]) };
    case 'storm': {
      const count = d.int(3, 4);
      return { kind, windup: w(44, 48), cooldown: 0, minRange: 0, maxRange: 420, radius: w(28, 32), delay: 56, linger: w(300, 340), damage: 2, slow: w(60, 70), count, ...bossPat(count, 1.1), ...(c.bog && !el ? { bog: true } : {}) };
    }
    case 'trap': {
      const count = d.int(4, 5);
      return { kind, windup: w(38, 42), cooldown: 0, minRange: 0, maxRange: 420, radius: 10, damage: 5, arm: 50, root: w(70, 80), linger: 900, cap: 3, count, ...bossPat(count) };
    }
    case 'ward': return { kind, windup: w(50, 54), cooldown: 0, radius: w(130, 150), duration: w(460, 500), need: 4 };
    case 'whiteout': return { kind, windup: w(42, 46), cooldown: 0, radius: w(110, 130), damage: 6, duration: w(140, 160) };
    case 'beam': return { kind, windup: w(66, 72), cooldown: 0, range: 420, width: w(12, 14), damage: w(24, 28) };
    case 'summon': return { kind, windup: w(50, 56), cooldown: 0, type: c.swarm, count: d.int(5, 6), cap: w(18, 24) };
    case 'blink': return { kind, windup: w(28, 32), cooldown: 0, minRange: 80, maxRange: w(290, 310) };
    case 'heal': return { kind, windup: w(44, 48), cooldown: 0, radius: w(150, 170), amount: 0.5 };
    case 'wail': return { kind, windup: w(48, 52), cooldown: 0, radius: w(120, 140), damage: 5, duration: w(170, 190) };
    case 'leap': return { kind, windup: w(42, 46), cooldown: 0, minRange: 60, maxRange: w(320, 360), radius: w(52, 60), damage: w(20, 24), slow: el ? 0 : w(90, 110), delay: w(42, 46) };
    case 'lure': return { kind, windup: w(48, 52), cooldown: 0, radius: w(210, 230), pull: w(85, 95), damage: 4 };
    case 'gust': return { kind, windup: w(46, 50), cooldown: 0, radius: w(100, 120), damage: w(9, 11), push: w(95, 105) };
    case 'pit': {
      const count = d.int(3, 4);
      return { kind, windup: w(42, 46), cooldown: 0, minRange: 0, maxRange: 420, radius: w(34, 38), delay: w(46, 50), linger: w(250, 270), pull: round(d.range(0.55, 0.65), 2), damage: 5, count, ...bossPat(count) };
    }
    case 'bolt': {
      const shape = d.pick(SHAPES);
      const count = d.int(3, 5);
      return { kind, windup: w(44, 52), cooldown: 0, minRange: 0, maxRange: 420, count, spread: round(d.range(0.05, 0.09), 3), speed: round(d.range(1.8, 2.6), 1), damage: w(8, 11), shape,
        ...(shape === ProjStyle.Comet ? { pierce: true } : {}), ...(shape === ProjStyle.Orb ? { splash: w(30, 40) } : {}), ...(shape === ProjStyle.Mote ? { homing: true } : {}) };
    }
    case 'ring': return { kind, windup: w(44, 52), cooldown: 0, maxRange: 420, count: d.int(12, 18), speed: round(d.range(1.5, 2.2), 1), damage: w(6, 9), shape: d.pick([ProjStyle.Orb, ProjStyle.Mote, ProjStyle.Spike]), ...(d.chance(0.3) ? { pierce: true } : {}) };
    case 'cone': return { kind, windup: w(44, 50), cooldown: 0, minRange: 0, maxRange: 140, range: w(120, 150), arc: round(d.range(0.1, 0.17), 3), damage: w(20, 26) };
    case 'totem': return { kind, windup: w(44, 50), cooldown: 0, minRange: 0, maxRange: 420, range: 260, lifetime: w(420, 520), interval: w(46, 60), damage: w(5, 7), speed: round(d.range(1.8, 2.4), 1), shape: d.pick([ProjStyle.Orb, ProjStyle.Mote]), cap: 3 };
    case 'cling': case 'hex': case 'dazzle': case 'pounce': return baseBoss('nova', d, c);
  }
}
