// The starting town (docs/21-the-road.md, step 6): the first screen of every run's road, a calm place where the party gathers before it
// sets out. Everything is within one screen (no scrolling until the party leaves): a stand per class, where a hero who walks up and presses
// the trade button takes up that class (the party select is walking in); the town's places, where what carries over between runs is
// built up (data/meta.ts); the shrine of the road's heat; and the gate on the right, through which the road begins.
import { CLASSES } from './classes';
import { META } from './meta';

/** The town's screen: the road begins at x 0 and the town is the first `TOWN_W` px of it (one screen). */
export const TOWN_W = 640;
/** A hero who walks past this x has gone out through the gate: the road begins (and the camera is let go). */
export const TOWN_GATE_X = 596;
/** Where heroes come into the town. */
export const TOWN_SPAWN_X = 60;
/** How near (px along and across the field) a hero must stand to use a stand, a place or the shrine. */
export const TOWN_REACH_X = 18, TOWN_REACH_Y = 18;

/** A class's stand: along the top of the town. */
export function classStand(classId: number): { x: number; y: number } {
  return { x: 90 + classId * Math.round(380 / Math.max(1, CLASSES.length - 1)), y: 36 };
}
/** A meta place (data/meta.ts): along the bottom of the town. */
export function metaPlace(i: number): { x: number; y: number } {
  return { x: 70 + i * 92, y: 200 };
}
/** The trainer, where a hero opens their class's tree (data/trees): at the right of the town, off the other places' rows. */
export function trainerSpot(): { x: number; y: number } {
  return { x: 540, y: 110 };
}
/** The shrine where the party sets the road's heat (data/heat.ts). */
export function heatShrine(): { x: number; y: number } {
  return { x: 70 + META.length * 92, y: 200 };
}
