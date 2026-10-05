export const TICK_RATE = 60;

/** Internal render resolution (see docs/02-rendering.md). */
export const VIEW_W = 640;
export const VIEW_H = 360;

/** Battlefield: x runs left->right, y is depth across the field. */
export const WORLD_W = 2800;
export const WORLD_H = 222;

/** Enemies coming over the top edge count as still entering until this far into the field (their descent of the near slope). */
export const TOP_ENTRY_DEPTH = 22;

export const MAX_ENTS = 4096;
export const MAX_PLAYERS = 4;
export const GRID_CELL = 16;
export const EVENT_CAP = 8192;
