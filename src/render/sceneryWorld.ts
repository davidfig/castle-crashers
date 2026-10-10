// The scenery of the run being played (data/scenery/world.ts), shared by the game's frame, the menus' thumbnails and the weather.
// Set by the game when a run begins, after `installSceneryArt` has drawn its pictures into the atlas.
import type { World } from '../data/scenery/world';

let current: World | null = null;
/** The levels played before the one on screen (a level and its store are one stretch of the road), and the road's biome stages. */
let played = 0;

export function setWorld(w: World | null): void { current = w; }
export function getWorld(): World | null { return current; }

/** Set whenever a level or store begins: how many levels the run has already finished. */
export function setLevelsPlayed(n: number): void { played = n; }
export function levelsPlayed(): number { return played; }

/** Dev aid (?roadx=N): the scenery is drawn N px further along the road than the level really is, to look at any stretch of it. */
let shift = 0;
export function setRoadShift(n: number): void { shift = n; }
export function roadShift(): number { return shift; }
