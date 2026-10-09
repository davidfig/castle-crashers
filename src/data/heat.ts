// Heat: the difficulty a party chooses for itself. Every step makes the horde bigger and the mobs meaner, and pays more for it.
// Chosen in the lobby for the whole run (and nudged by the curse shrines' elites in the field); the sim reads it from `GameState.heat`.

export const HEAT_MAX = 5;

export const HEAT_NAMES: readonly string[] = ['CALM', 'WARM', 'HOT', 'SCORCHING', 'INFERNAL', 'CATACLYSM'];

/** Enemy count multiplier. */
export const heatHorde = (heat: number): number => 1 + 0.15 * heat;
/** Damage mobs deal. */
export const heatDamage = (heat: number): number => 1 + 0.1 * heat;
/** How fast mobs walk. */
export const heatSpeed = (heat: number): number => 1 + 0.03 * heat;
/** Gold and XP multiplier: the reward for asking for it. */
export const heatReward = (heat: number): number => 1 + 0.2 * heat;
/** Chance (0..1) that a level plans a second mini-boss. */
export const heatElites = (heat: number): number => 0.2 * heat;
