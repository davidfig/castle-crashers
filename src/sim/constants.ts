export const TICK_RATE = 60;

/** Internal render resolution (see docs/02-rendering.md). */
export const VIEW_W = 640;
export const VIEW_H = 360;

/** Battlefield: x runs left->right, y is depth across the field. */
export const WORLD_W = 2800;
export const WORLD_H = 244;

/** Enemies coming over the top edge count as still entering until this far into the field (their descent of the near slope). */
export const TOP_ENTRY_DEPTH = 4;

export const MAX_ENTS = 4096;
export const MAX_PLAYERS = 4;
export const GRID_CELL = 16;
export const EVENT_CAP = 8192;

/**
 * The store between levels is a stretch of field of its own, a transition piece: it opens where the level just won ended (the party
 * walks in at the same place on screen) and the scenery changes along it from that level's biome to the next one's, with the peddler
 * at the seam. It ends where the next level begins. Sim coordinates are local to the store.
 */
export const STORE_W = 1740;
/** Where the peddler stands, and so where one biome gives way to the other. */
export const STORE_X = 900;
export const STORE_Y = 70;
/** The camera at the far end of the store (its limit), and the screen column the lead hero crosses to leave it: the next level starts them there. */
export const STORE_CAM_END = STORE_W - VIEW_W;
export const STORE_EXIT_SCREEN = 420;
export const STORE_EXIT_X = STORE_CAM_END + STORE_EXIT_SCREEN;
/** The camera at the far end of a level: the store's scenery for the old biome carries on from here, so the cut from level to store is invisible. */
export const LEVEL_CAM_END = WORLD_W - VIEW_W;
/** A hero this close to the peddler (px, along the field and across it) can trade. */
export const STORE_REACH_X = 70;
export const STORE_REACH_Y = 60;
