// The one road of a run (docs/21-the-road.md, step 3): a single sim walks the whole route, levels and the camps between them laid end to
// end, with no cut. Level k starts at k * ROAD_STRIDE, where it always did in road coordinates, and sim coordinates on the road are road
// coordinates, so the scenery, the weather and the time of day line up as before. The road is planned as the party nears it, a level at
// a time (its encounters, gates and sites; the camp's goods), from the run's seed alone, so a save restores it and a replay agrees.
//
// Where the camera's centre is decides which part of the road the party is in: level k owns [k*S + 320, k*S + 2480) and the camp after
// it [k*S + 2480, (k+1)*S + 320), exactly the stretch the old level's and store's cameras covered (S = ROAD_STRIDE).
import { levelPlan, type LevelPlan } from '../../campaign/route';
import { heatHorde } from '../../data/heat';
import { stockFor } from '../../data/wares';
import { LEVEL_CAM_END, ROAD_STRIDE, STORE_W, STORE_X, VIEW_W, WORLD_W } from '../constants';
import { placeSites } from '../sites';
import type { GameState } from '../state';
import { planGates, planLevel, STREAM_AHEAD } from './level';

/** The run's road, as the sim keeps it (plain data: it is saved with the sim). */
export interface RoadState {
  /** The run's seed: every level's plan and every camp's goods derive from it. */
  runSeed: number;
  /** Levels on the road; the last ends in the final boss. */
  total: number;
  heat: number;
  /** How many levels have been planned so far (their encounters are in `GameState.plan`). */
  planned: number;
  /** Where the camera's centre is: the level (or the camp after it), and whether it is the camp. */
  level: number;
  camp: boolean;
  /** The tick the party came into the current part of the road (a boss dying after this, on the last level, wins the run). */
  since: number;
}

/** The part of the road at road x `c` (a camera's centre): level `level`, or the camp after it. */
export function roadPart(total: number, c: number): { level: number; camp: boolean } {
  const half = VIEW_W / 2;
  const k = Math.floor((c - half) / ROAD_STRIDE);
  if (k < 0) return { level: 0, camp: false };
  if (k >= total - 1) return { level: total - 1, camp: false }; // the last level runs on to the end of the road
  return { level: k, camp: c - half - k * ROAD_STRIDE >= LEVEL_CAM_END };
}

/** Where level `k` starts along the road. */
export function levelX0(k: number): number { return k * ROAD_STRIDE; }
/** Where the camp after level `k` starts (its store's coordinates are offset by this: the peddler stands at `campX0(k) + STORE_X`). */
export function campX0(k: number): number { return k * ROAD_STRIDE + LEVEL_CAM_END; }
/** The length of a road of `total` levels: up to the far end of the last level. */
export function roadLength(total: number): number { return levelX0(total - 1) + WORLD_W; }

/** The plan of level `k` of this road. */
export function roadLevel(r: RoadState, k: number): LevelPlan { return levelPlan(r.runSeed, k, r.total); }

/** The camera is in a camp: no horde, no director; the peddler trades. */
export function inCamp(s: GameState): boolean { return s.road !== null && s.road.camp; }

/** A camp's stall and goods are near enough the screen to draw (a store always is). */
export function campShown(s: GameState): boolean {
  if (s.store) return true;
  return s.road !== null && s.camX + VIEW_W > s.shopX - 200 && s.camX < s.shopX + STORE_W + 200;
}

/** Progress (0..1) through the level the camera is in, for the enemy mix and the director (1 in a camp). */
export function roadProgress(s: GameState): number {
  const r = s.road!;
  if (r.camp) return 1;
  const local = s.camX - levelX0(r.level);
  return Math.max(0, Math.min(1, local / LEVEL_CAM_END));
}

/** The director stops sending packs in a camp and in the last screen before one (as it did near the end of a level). */
export function roadDirectorOff(s: GameState): boolean {
  const r = s.road!;
  if (r.camp) return true;
  return r.level < r.total - 1 && s.camX - levelX0(r.level) > LEVEL_CAM_END - 100;
}

/** Plans level `k`: its encounters (moved along the road and tagged with the level's seed, biome and slice of the cast), gates and sites. */
function planRoadLevel(s: GameState, k: number): void {
  const r = s.road!;
  const lp = roadLevel(r, k);
  const x0 = levelX0(k);
  const base = s.plan.length;
  const plan = planLevel(lp.seed, undefined, { boss: lp.boss, scale: lp.scale * heatHorde(r.heat), heat: r.heat, opener: k === 0, length: WORLD_W });
  for (const c of plan) s.plan.push({ ...c, x: c.x + x0, seed: lp.seed, biome: lp.biome, mix: lp.mix });
  for (const g of planGates(plan)) s.gates.push({ x: g.x + x0, clump: g.clump + base });
  // The lair: a boss holds the road until it and its retinue are dead (a level of its own used to end there).
  const boss = plan.findIndex((c) => c.boss);
  if (boss >= 0) s.gates.push({ x: plan[boss].x + x0 + LAIR_PAST, clump: base + boss });
  placeSites(s, lp.boss, { x0, length: WORLD_W, seed: lp.seed, surrender: lp.chapter >= 2 });
  r.planned = k + 1;
}

/** How far past the boss the lair's gate stands. */
const LAIR_PAST = 150;
/** A level is planned once the screen's right edge is this close to where it starts (well before its first encounter streams in). */
const PLAN_AHEAD = STREAM_AHEAD + 400;

/** The camp after level `k`: the peddler's goods (the store's stock, priced for how far down the road it is). */
function openCamp(s: GameState, k: number): void {
  const r = s.road!;
  s.shopX = campX0(k);
  s.wares = stockFor(r.runSeed, k).map((it) => ({ ware: it.ware, price: it.price, sold: false }));
  s.offers = [];
  s.questTaken = -1;
}

/**
 * Called every tick on a road: plans the road ahead as the camera nears it, and keeps the sim's sense of where it is up to date (the
 * level's biome, slice of the cast and damage; stand down from chapter II; the camp's goods; the horde leaving as the party walks into a camp).
 */
export function roadUpkeep(s: GameState, leave: (s: GameState) => void): void {
  const r = s.road!;
  while (r.planned < r.total && s.camX + VIEW_W + PLAN_AHEAD >= levelX0(r.planned)) {
    // the camp before a level is set up with it, long before its goods come into view
    if (r.planned > 0) openCamp(s, r.planned - 1);
    planRoadLevel(s, r.planned);
  }
  const at = roadPart(r.total, s.camX + VIEW_W / 2);
  if (at.level === r.level && at.camp === r.camp && r.since >= 0) return;
  const first = r.since < 0;
  r.level = at.level; r.camp = at.camp; r.since = s.tick;
  const lp = roadLevel(r, at.level);
  s.biome = lp.biome;
  s.mix = lp.mix;
  s.damageMul = lp.damage;
  s.surrender = lp.chapter >= 2;
  s.nextBiome = at.camp ? roadLevel(r, at.level + 1).biome : -1;
  if (at.camp && !first) leave(s); // what is left of the horde walks off the way it came, as it did when a level was won
}

/** The music turns to the next level's biome at the peddler, halfway through the camp. */
export function roadMusicBiome(s: GameState): number {
  return inCamp(s) && s.camX + VIEW_W / 2 >= s.shopX + STORE_X ? s.nextBiome : s.biome;
}

/** A fresh road's state (level 0, nothing planned yet: the first upkeep plans it). */
export function createRoad(runSeed: number, total: number, heat: number): RoadState {
  return { runSeed, total: Math.max(1, total), heat, planned: 0, level: 0, camp: false, since: -1 };
}

/** Dev aid (`?road=1&at=N`): puts the party at the start of level `level`, with the road behind it planned and passed. */
export function roadJump(s: GameState, level: number): void {
  const r = s.road!;
  const x = levelX0(Math.max(0, Math.min(r.total - 1, level)));
  s.camX = s.prevCamX = s.camMax = s.trigCamX = x;
  s.players.forEach((p, k) => {
    if (!p.active) return;
    s.ents.x[p.ent] = s.ents.px[p.ent] = x + 80 - k * 12;
  });
  r.since = -1;
  roadUpkeep(s, () => {});
  while (s.nextClump < s.plan.length && s.plan[s.nextClump].x < x) s.nextClump++;
  while (s.gateIdx < s.gates.length && s.gates[s.gateIdx].x < x) s.gateIdx++;
}
