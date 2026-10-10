// How a player judges a level-up card. A veteran knows which boons carry which class; a newcomer takes whatever catches the eye.
// Scores run roughly 0..10 and are only compared with each other. They are opinions, kept in one table so a balance change that
// makes a boon better or worse can be mirrored here (and so a sweep can disagree with the AI's taste: that is the interesting result).
import { CLASSES } from '../data/classes';
import { UPGRADE_INDEX, UPGRADES, type UpgradeDef } from '../data/upgrades';
import { COST_PER_RANK, costMul } from '../sim/abilityMods';

/** Base value of boons that are not ability scaling. */
const BASE: Readonly<Record<string, number>> = {
  heavy: 8, thick: 8, swift: 5, windfall: 3, wind: 3,
  spark: 6, lust: 6, gift: 4, last: 6, pound: 6, tithe: 5, exec: 6,
  rift: 6, recoil: 5, twin: 8, echo: 6, quick: 5,
  radiance: 6, wrath: 5, vigil: 3, dance: 4, keen: 7, pick: 3,
  eagle: 7, downpour: 6, ring: 4,
  banner: 5, ward: 5, martyr: 3, rally: 3,
  glass: 5, phoenix: 9, frenzy: 8,
  tempest: 9, bloodmoon: 8, undying: 9, wildfire: 7, rallycry: 7,
};

/** Per class (by name), how much each ability matters (basic, special, nova, dodge) and how good each track is for it (size, count, speed, power). */
interface Taste { ability: [number, number, number, number]; tracks: [number, number, number, number][] }
const TASTE: Readonly<Record<string, Taste>> = {
  warrior: { ability: [8, 6, 6, 3], tracks: [[0.7, 0.6, 0.8, 0.9], [0.7, 0.6, 0.6, 0.9], [0.8, 0.6, 0.5, 0.9], [0.6, 0.3, 0.6, 0.5]] },
  mage: { ability: [9, 6, 5, 3], tracks: [[0.8, 1, 0.6, 0.9], [0.8, 0.7, 0.5, 0.9], [0.8, 0.6, 0.5, 0.9], [0.6, 0.3, 0.5, 0.4]] },
  cleric: { ability: [9, 5, 7, 6], tracks: [[1, 0, 0.8, 0.9], [0.7, 0, 0.6, 0.9], [0.8, 0.6, 0.6, 1], [0.6, 0.3, 0.6, 0.9]] },
  rogue: { ability: [8, 6, 4, 4], tracks: [[0.6, 0.6, 1, 0.9], [0.6, 0.5, 0.8, 0.9], [0.8, 0.5, 0.5, 0.8], [0.6, 0.3, 0.8, 0.5]] },
  archer: { ability: [9, 7, 6, 3], tracks: [[0.5, 1, 0.7, 0.9], [0.5, 0.9, 0.5, 0.9], [0.8, 0.7, 0.5, 0.9], [0.6, 0.3, 0.5, 0.4]] },
};

export interface CardContext {
  className: string;
  ranks: ArrayLike<number>;
  /** Health fraction now (Second Wind is worth more when hurt). */
  hpFrac: number;
  /** Heroes in the party, and whether this player is one who would play risky for a legendary. */
  party: number;
}

/**
 * Every rank of an ability boon raises what the ability costs in stamina (the card says so), and an ability dearer than the whole pool can
 * never be cast: the mage's fireball is 40 of 100. A player stops stacking before that. 1 when the next rank is comfortable, less as the
 * cost closes on the pool, nearly 0 when it would not fit.
 */
function affordable(u: UpgradeDef, c: CardContext): number {
  const sc = u.scales;
  const cls = CLASSES.find((k) => k.name === c.className);
  if (!sc || !cls || sc.ability === 2) return 1; // the nova is paid in fury, capped at a full bar
  const base = sc.ability === 0 ? cls.attackCost : sc.ability === 1 ? cls.specialCost : cls.dashCost;
  if (cls.auraDrain && sc.ability === 0) return 1; // the cleric's aura is a drain, not a price per use
  const next = base * (costMul(c.ranks, sc.ability) + COST_PER_RANK[sc.track]);
  const frac = next / cls.staminaMax;
  return frac > 0.9 ? 0.05 : frac > 0.65 ? 0.35 : frac > 0.45 ? 0.75 : 1;
}

/** How good card `up` (an index into UPGRADES) looks to this player. */
export function cardScore(up: number, c: CardContext): number {
  const u: UpgradeDef = UPGRADES[up];
  const held = c.ranks[up] ?? 0;
  let v: number;
  if (u.scales) {
    const t = TASTE[c.className] ?? TASTE.warrior;
    v = t.ability[u.scales.ability] * t.tracks[u.scales.ability][u.scales.track] * 1.05;
    v *= 1 - 0.08 * held; // each rank makes the ability dearer to use
    v *= affordable(u, c);
  } else {
    v = BASE[u.id] ?? (u.kind === 'trigger' ? 5 : 4);
    if (u.id === 'wind') v = 2 + 7 * (1 - c.hpFrac);
    if (u.id === 'vigil' && c.party < 2) v = 0;
    if (held > 0 && u.kind === 'trigger') v += 0.6; // a boon in hand is worth deepening
  }
  // Synergy: tags shared with what is already held.
  let shared = 0;
  for (const tag of u.tags) for (let i = 0; i < UPGRADES.length; i++) if (c.ranks[i] > 0 && UPGRADES[i].tags.includes(tag)) { shared++; break; }
  v += Math.min(1.5, 0.5 * shared);
  return v;
}

/** Index of the boon with this id, for callers that want to refer to one by name. */
export const boon = (id: string): number => UPGRADE_INDEX[id];
