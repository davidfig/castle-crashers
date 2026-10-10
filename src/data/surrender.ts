// Stand Down and surrender (docs/12-story.md, "Stand Down and surrender"). Holding the button lowers a hero's weapons;
// a mob in reach may lay down its arms. A surrendered mob is safe only until something damages it.

/** Per-tick chance that a mob of this kind within reach of a standing hero lays down its arms. Absent = never (bombers, bosses, the undead). */
export const SURRENDER_CHANCE: Readonly<Record<string, number>> = {
  goblin: 0.02,
  archer: 0.015,
  shield: 0.01,
  orc: 0.004,
};

/** How far a standing hero's mercy reaches (px), and how long they must have been standing before it takes (ticks). */
export const STAND_RADIUS = 64;
export const STAND_TICKS = 30;
/** Ticks a surrendered mob kneels where it is before it runs off. */
export const SURRENDER_HOLD = 240;
/** Walking speed (times its own) of a surrendered mob once it flees. */
export const SURRENDER_FLEE = 2.4;
/** A hero who is standing down walks at this fraction of their speed. */
export const STAND_SLOW = 0.6;

export function surrenderChance(def: string | { name: string; surrender?: number }): number {
  if (typeof def === 'string') return SURRENDER_CHANCE[def] ?? 0;
  return def.surrender ?? SURRENDER_CHANCE[def.name] ?? 0;
}
