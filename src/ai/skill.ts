// How well a simulated player plays. Every number here is a human limit or habit, so the same AI can stand in for a first-timer
// or a veteran: slower to notice a telegraph, sloppier aim, worse at spacing, hazy about which card builds a run.
// `skillAt(0..1)` slides between the named presets, so a balance sweep can ask for any point on the ladder.

export interface Skill {
  /** Display name (a preset's, or "skill 0.35"). */
  name: string;
  /** Ticks between a telegraph starting and the player doing something about it (eyes + hands). Fast attacks can't be dodged below it. */
  reaction: number;
  /** Chance each distinct danger is noticed at all; the rest land by surprise. */
  attention: number;
  /** Worst aim miss, in turns (0.25 = a quarter circle), redrawn every decision. */
  aimError: number;
  /** Ticks between fresh decisions (who to hit, where to stand). A slow player commits to a choice for longer. */
  tempo: number;
  /** Chance an ability is used when the situation calls for it (the rest is forgotten or fumbled). */
  abilityUse: number;
  /** 0..1: keeping distance, flanking, not getting surrounded; how much a player weighs staying out of reach. */
  spacing: number;
  /** 0..1: prefers the dangerous or valuable target (healers, shooters, bombers) over simply the nearest. */
  focus: number;
  /** 0..1: spends the dodge on real danger rather than panic, or never. */
  dodge: number;
  /** Health fraction below which the player stops pushing and goes for flasks. */
  caution: number;
  /** 0..1: chance a level-up pick is the best card the player can see (otherwise whichever is nearest to hand). */
  buildSense: number;
  /** 0..1: uses rerolls and banishes (and knows when a hand is poor). */
  rerollSense: number;
  /** Ticks spent reading a hand of cards before choosing. */
  pickDelay: number;
  /** 0..1: opens the level-up panel only when no one is near (a novice opens it mid-fight and stands there). */
  panelCare: number;
  /** 0..1: detours for coins, chests and shrines. */
  thorough: number;
  /** 0..1: spends gold on the best thing in the shop (and saves for it). */
  shopSense: number;
}

/** The ladder, weakest first. */
export const SKILL_PRESETS: readonly Skill[] = [
  { name: 'novice', reaction: 38, attention: 0.35, aimError: 0.07, tempo: 28, abilityUse: 0.15, spacing: 0.05, focus: 0, dodge: 0.1, caution: 0.2, buildSense: 0.15, rerollSense: 0, pickDelay: 150, panelCare: 0, thorough: 0.1, shopSense: 0.15 },
  { name: 'casual', reaction: 27, attention: 0.6, aimError: 0.045, tempo: 18, abilityUse: 0.45, spacing: 0.3, focus: 0.2, dodge: 0.4, caution: 0.35, buildSense: 0.45, rerollSense: 0.2, pickDelay: 100, panelCare: 0.4, thorough: 0.4, shopSense: 0.45 },
  { name: 'average', reaction: 20, attention: 0.8, aimError: 0.03, tempo: 12, abilityUse: 0.7, spacing: 0.55, focus: 0.5, dodge: 0.65, caution: 0.45, buildSense: 0.7, rerollSense: 0.5, pickDelay: 70, panelCare: 0.75, thorough: 0.65, shopSense: 0.7 },
  { name: 'skilled', reaction: 14, attention: 0.93, aimError: 0.016, tempo: 7, abilityUse: 0.88, spacing: 0.8, focus: 0.8, dodge: 0.85, caution: 0.5, buildSense: 0.9, rerollSense: 0.8, pickDelay: 40, panelCare: 0.95, thorough: 0.85, shopSense: 0.9 },
  { name: 'expert', reaction: 9, attention: 0.99, aimError: 0.006, tempo: 4, abilityUse: 0.97, spacing: 0.95, focus: 1, dodge: 1, caution: 0.55, buildSense: 1, rerollSense: 1, pickDelay: 20, panelCare: 1, thorough: 1, shopSense: 1 },
];

export const SKILL_NAMES: readonly string[] = SKILL_PRESETS.map((s) => s.name);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** A point on the ladder: 0 is the novice, 1 the expert, anything between blends its neighbours. */
export function skillAt(level: number): Skill {
  const t = Math.max(0, Math.min(1, level)) * (SKILL_PRESETS.length - 1);
  const lo = Math.min(SKILL_PRESETS.length - 2, Math.floor(t));
  const f = t - lo;
  const a = SKILL_PRESETS[lo], b = SKILL_PRESETS[lo + 1];
  if (f === 0) return a;
  if (f === 1) return b;
  const out: Record<string, number | string> = { name: `skill ${level.toFixed(2)}` };
  for (const k of Object.keys(a) as (keyof Skill)[]) if (k !== 'name') out[k] = lerp(a[k] as number, b[k] as number, f);
  return out as unknown as Skill;
}

/** Resolve "novice", "average", "0.35" or a ready-made Skill. */
export function resolveSkill(x: Skill | string | number): Skill {
  if (typeof x === 'object') return x;
  if (typeof x === 'number') return skillAt(x);
  const named = SKILL_PRESETS.find((s) => s.name === x);
  if (named) return named;
  const n = Number(x);
  if (Number.isFinite(n)) return skillAt(n);
  throw new Error(`unknown skill "${x}" (try ${SKILL_NAMES.join(', ')} or a number 0..1)`);
}
