// The one road of a run (docs/21-the-road.md): a single sim walks the whole route with no cut. The road is a line of FIGHTING stretches
// (a level's battlefield, or part of one) and CALM places (the camp after a level, a road scene in the middle of one, and later towns),
// and it GROWS around the calm places: each is given its own ground, and the fighting is pushed far enough away on both sides that no
// horde can reach it, and keep the empty ground as short as that allows:
//  - while the party is in a calm place nothing streams in, and the moment it has left, the next crowd is spawned just off the right edge of
//    the screen (wherever its plan puts it) and walks in, so it never pops up and never reaches the place; the encounter after a place only
//    has to lie `CLEAR_AFTER` past it, far enough that its gate lets the camera's centre leave the place;
//  - before one, the last encounter lies `CLEAR_BEFORE` short of it, so its crowd does not reach the ground;
//  - while a calm place is on screen, or about to be, the director sends no packs (`roadDirectorOff`).
// The layout (`layoutRoad`) is a pure function of the run's seed, laid out in full when the road is made (it is small: where things go);
// what is IN each level (its encounters, gates and sites; the camp's goods) is planned as the party nears it. Sim coordinates on the road
// are road coordinates (the scenery's); the scenery is told where each level begins (`stageBounds`).
//
// FORKS. A region is one biome's stretch of the road (`LEVELS_PER_BIOME` levels). After every region but the last, past its last camp, the
// road comes to a CROSSROADS (a calm place too): it splits into an upper and a lower road, each signposted with the place it leads to,
// and the party chooses by walking (the side with more heroes on their feet when one of them crosses the commit line; a tie goes to the
// first hero's side). The choice sets the next region's biome (its enemies, scenery and boss); how hard it is goes by how far down the
// road it lies, whichever way the party went. The road is a function of the seed AND the choices (`RoadState.choices`, saved with the
// sim): nothing past a crossroads is planned until the party has chosen, and then the road ahead is laid out again (`commitFork`); what
// lies behind is unchanged by it.
import { levelPlan, LEVELS_PER_BIOME, stageBiome, type LevelPlan } from '../../campaign/route';
import { BIOME_COUNT } from '../../data/roster';
import { createRng, rngFloat, rngInt, Stream } from '../../engine/rng';
import { emit, Ev } from '../events';
import { heatHorde } from '../../data/heat';
import { roadSceneFor, roadSceneT, type RoadScene } from '../../data/story/road';
import { MIDPOINT_CHAPTER, MIDPOINT_SCENE } from '../../data/story/midpoint';
import { giftsFor } from '../../data/gifts';
import { questOffers } from '../../data/quests';
import { Kind, NpcMode } from '../entities';
import { createQuestRun, placeQuest, settleQuestNow } from '../quests';
import { META, metaMultipliers } from '../../data/meta';
import { cloneTreeSaves, newTreeSaves, type TreeSave } from '../../data/trees';
import { TOWN_GATE_X, TOWN_W } from '../../data/town';
import { stockFor } from '../../data/wares';
import { LEVEL_CAM_END, STORE_X, VIEW_W, WORLD_H, WORLD_W } from '../constants';
import { placeSites } from '../sites';
import { restParty, type GameState } from '../state';
import { planLevel, SCENE_RELEASE, SCENE_Y, STREAM_AHEAD, type ClumpPlan, type SimBeat } from './level';

/** How far an encounter's crowd spreads from its centre (a blob for a full party; a line is narrower). */
export const CROWD_SPREAD = 160;
/**
 * From the end of a calm place to the next encounter. Nothing streams in while the party is in the place, and the moment it has left, the
 * crowd is spawned off the right edge wherever its plan puts it (`streamLevel`), so this gap does not have to hide anything: it only has to
 * be long enough that the encounter's gate (which stands 40 px past it and holds the camera) lets the camera's centre leave the place.
 */
export const CLEAR_AFTER = 260;
/** From the last encounter (or gate) before a calm place to where the place begins: its crowd (`CROWD_SPREAD`) does not reach the ground. */
export const CLEAR_BEFORE = CROWD_SPREAD + 60;
/** A camp's ground, in the store's own coordinates: from a little before the first quest-giver to a little past the last of the peddler's goods. */
export const CAMP_FROM = 380, CAMP_TO = 1040;
/** A road scene's ground around where its figures stand: where the party stops to listen, to where the scene lets it go. */
export const SCENE_BEFORE = 420;
/**
 * The size of the road's horde against the levels' own plans and the director's packs: a tuning knob (`pnpm sim --horde=X`). Left at 1 by
 * the balance pass (docs/21-the-road.md, "The balance pass"): a smaller horde barely shortens a run but starves the heroes of experience,
 * so they meet the later bosses under-levelled and the run gets harder, not easier.
 */
export const ROAD_HORDE = 1;
/**
 * A boss's health on the road, against its own. The boss levels were more than half of a run's time (the first boss, met at the party's
 * weakest, the longest; the last a wall), so the bosses are a little frailer: a run lands near half an hour (docs/21, "The balance pass").
 * Tuned with `pnpm sim --boss-hp=X`.
 */
export const ROAD_BOSS_HP = 0.75;
/**
 * How hard the road hits against the depth curve (`depthDamage`). The base game is meant to be very hard: a party with none of the
 * town's upgrades should meet a road that only a very good player can beat, and slowly; the town's upgrades (data/meta.ts) are how it
 * becomes beatable with ordinary skill. Tuned with `pnpm sim --hard=X --renown=N` (docs/21-the-road.md, "Difficulty and the town").
 */
export const ROAD_HARD = 1.9;
/** How far past the boss the lair's gate stands. */
const LAIR_PAST = 150;
/** A gate stands this far past the encounter it guards (as `planGates` puts it). */
const GATE_PAST = 40;
const SCENE_STREAM = 5001;
/** A road scene is let go (its figures no longer drawn) once the screen's left edge is this far past where they stand: out of sight. */
const SCENE_GONE = 160;
/** A crossroads' ground: the signposts stand `FORK_SIGNS` into it, the party's choice is counted when a hero crosses `FORK_COMMIT`, and the
 *  ground runs on to `FORK_LEN` so that, when it is counted, the screen does not yet reach the road beyond. */
export const FORK_SIGNS = 200, FORK_COMMIT = 520, FORK_LEN = 800;
/** The scenery turns into the chosen biome only this far past the crossroads (never before the choice: the biome is not known). */
const FORK_TURN = 400;

/** A calm place on the road: its ground (which the camera's centre is in while the party is there) and what it is. */
export interface Calm {
  kind: 'town' | 'camp' | 'scene' | 'fork';
  /** The level it belongs to (a camp: the one before it). */
  level: number;
  from: number;
  to: number;
  /** A road scene's id (data/story/road.ts) and where its figures stand. */
  scene?: string;
  x?: number;
  /** A camp: where its store's coordinates begin (the peddler at `shopX + STORE_X`). */
  shopX?: number;
  /** A crossroads: the region it leads into (its stage), the biomes of the upper and the lower road, and where the choice is counted. */
  stage?: number;
  options?: number[];
  commit?: number;
}

/** From the end of one level's last encounter to the start of the next when no camp lies between (a crowd's spread each side, and room to breathe). */
export const JOIN_GAP = 2 * CROWD_SPREAD + 100;

/**
 * Whether a camp follows level `k` (the rhythm of the road, drawn from the seed alone: not from the biomes the party picks). The last level
 * ends the road and a region's boss level always opens onto its camp (and the crossroads); of a region's other levels each has a camp after
 * it about two times in three, but never none at all, so no region runs its fights end to end without a rest before the boss.
 */
export function campAfter(runSeed: number, k: number, total: number): boolean {
  if (k >= total - 1) return false;
  const inBiome = k % LEVELS_PER_BIOME;
  if (inBiome === LEVELS_PER_BIOME - 1) return true;
  const r = createRng((runSeed ^ Math.imul(stageOf(k) + 1, 0x7f4a7c15)) >>> 0, Stream.campaign + 13);
  const camps: boolean[] = [];
  for (let i = 0; i < LEVELS_PER_BIOME - 1; i++) camps.push(rngInt(r, 3) > 0);
  if (!camps.some((c) => c)) camps[rngInt(r, camps.length)] = true;
  return camps[inBiome];
}

/** The chance that a region's non-boss level holds a road scene (`sceneAt`). */
export const SCENE_ODDS = 0.65;

/**
 * The road scene level `k` stages, if any (drawn from the seed alone, like `campAfter`). Each non-boss level of a region may or may not hold
 * a scene, and a region can have none. A chapter's scenes are told in order (the first carries its beat, the second follows on it), and a
 * level that holds no scene does not use one up: the scenes a region does stage are its chapter's first, then its second, so skipping
 * one never moves the story on past what was told.
 */
export function sceneAt(runSeed: number, k: number, lp: LevelPlan, midpoint = false): RoadScene | undefined {
  const inBiome = k % LEVELS_PER_BIOME;
  if (lp.boss || inBiome >= LEVELS_PER_BIOME - 1) return undefined;
  // the midpoint (docs/12-story.md, R5) takes the first scene slot of its chapter's region, whatever the odds
  if (midpoint && stageOf(k) === MIDPOINT_CHAPTER - 1 && inBiome === 0) return MIDPOINT_SCENE;
  const r = createRng((runSeed ^ Math.imul(stageOf(k) + 1, 0x3c6ef372)) >>> 0, Stream.campaign + 14);
  const held: boolean[] = [];
  for (let i = 0; i < LEVELS_PER_BIOME - 1; i++) held.push(rngFloat(r) < SCENE_ODDS);
  if (!held[inBiome]) return undefined;
  return roadSceneFor(lp.chapter, held.slice(0, inBiome).filter(Boolean).length, false);
}

/** Where one level lies on the road: each stretch of its own plan (from, to, in its local coordinates) is moved along by `dx`. */
export interface LevelLay {
  slices: { from: number; to: number; dx: number }[];
  /** Where the level's part of the road begins and ends (the camera's centre): from the calm place before it to the one after it. */
  start: number;
  end: number;
}

/** The whole road's layout. Plain data. */
export interface RoadLayout {
  levels: LevelLay[];
  calm: Calm[];
  /** The far end of the road (the last level's field). */
  length: number;
}

/** The run's road, as the sim keeps it (plain data: it is saved with the sim). */
export interface RoadState {
  /** The run's seed: every level's plan and every camp's goods derive from it. */
  runSeed: number;
  /** Levels on the road; the last ends in the final boss. */
  total: number;
  heat: number;
  layout: RoadLayout;
  /** The road stages the midpoint scene (R5, docs/12-story.md) in its chapter's first scene slot. */
  midpoint: boolean;
  /** The chapter the whole road is told in (the Ledger's, docs/12-story.md), or 0 for each region's own (dev runs, the balance probe). */
  chapter: number;
  /** How many levels have been planned so far (their encounters are in `GameState.plan`). */
  planned: number;
  /** Where the camera's centre is: the level, and the calm place it is in (an index into `layout.calm`, or -1). */
  level: number;
  calm: number;
  /** In a camp (a shorthand for `layout.calm[calm].kind === 'camp'`). */
  camp: boolean;
  /** The tick the party came into the current part of the road (a boss dying after this, on the last level, wins the run). */
  since: number;
  /** The road chosen at each crossroads passed (0 the upper road, 1 the lower), and the biome of each region that follows from them
   *  (a region not yet chosen has the upper road's, for the layout of the road ahead until then). */
  choices: number[];
  biomes: number[];
  /** The party is still in the starting town (the camera holds on it; nothing of the road is planned yet). */
  town: boolean;
  /** Renown left to spend in the town, and the lasting upgrades' ranks (data/meta.ts, by index): from the profile, and what the town bought. */
  renown: number;
  meta: number[];
  /** The class trees (data/trees), one per class (index = classId): which nodes the town has built, the active branches, the loadout. */
  trees: TreeSave[];
  /** The run was made with a tree (the game always does): offers are dealt from each class's tree pool rather than from everything. */
  treeGated: boolean;
  /** Bosses slain on this road (for the renown it earns). */
  bosses: number;
  /** A story beat the first level stages (docs/12-story.md: R1, the cookfire), or none. */
  beat: SimBeat | null;
  /** How big the horde is on this road, as a multiple of the levels' own plans and the director's packs (`ROAD_HORDE`, tuned with bot runs). */
  horde: number;
  /** A boss's health on this road, as a multiple of its own (`ROAD_BOSS_HP`). */
  bossHp: number;
  /** The multipliers the town's built places give every hero: [damage dealt, damage taken, speed] (data/meta.ts, kept up to date as places are built). */
  metaMul: [number, number, number];
  /** How hard the road hits, as a multiple of the depth curve's damage (`ROAD_HARD`): the base difficulty a party meets with no upgrades built. */
  hard: number;
  /** The director's measure of how far the party has come (`roadAdvance`): the level it is counting, and the furthest point of that level's own field the camera has reached. */
  trigLevel: number;
  trigLocal: number;
}

/** The region (biome stage) level `k` belongs to. */
export function stageOf(k: number): number { return Math.floor(k / LEVELS_PER_BIOME); }

/** The two roads at the crossroads into region `stage`: two biomes other than the one the party is leaving, the ones not yet seen first. */
export function forkOptions(runSeed: number, stage: number, before: readonly number[]): number[] {
  const r = createRng((runSeed ^ Math.imul(stage + 1, 0x2545f491)) >>> 0, Stream.campaign + 11);
  const here = before[before.length - 1];
  const all = Array.from({ length: BIOME_COUNT }, (_, b) => b).filter((b) => b !== here);
  const fresh = all.filter((b) => !before.includes(b)), seen = all.filter((b) => before.includes(b));
  const out: number[] = [];
  for (const pool of [fresh, seen]) while (out.length < 2 && pool.length > 0) out.push(pool.splice(rngInt(r, pool.length), 1)[0]);
  return out;
}

/** The biome of each region of a road of `total` levels, given the choices made so far (an unchosen crossroads counts as its upper road). */
export function roadBiomes(runSeed: number, total: number, choices: readonly number[]): number[] {
  const stages = Math.max(1, Math.ceil(total / LEVELS_PER_BIOME));
  const out = [stageBiome(0)];
  for (let st = 1; st < stages; st++) {
    const opts = forkOptions(runSeed, st, out);
    out.push(opts[Math.min(opts.length - 1, choices[st - 1] ?? 0)] ?? out[st - 1]);
  }
  return out;
}

/** The plan of level `k` of this road. */
export function roadLevel(r: RoadState, k: number): LevelPlan { return withChapter(levelPlan(r.runSeed, k, r.total, r.biomes[stageOf(k)]), r.chapter); }

/** A level's plan told in the run's chapter, when the run has one (the campaign's, docs/12-story.md): its scenes, its mercy, its wording. 0: the region's own. */
function withChapter(lp: LevelPlan, chapter: number): LevelPlan { return chapter > 0 ? { ...lp, chapter } : lp; }

/**
 * The encounters of level `k`'s field, without its road scene's marker (the road places the scene itself, on ground of its own). A level
 * with a road scene keeps the encounters it had as a field of its own, the ones its scene's clearing left (`SCENE_CLEARING`): the road
 * grows to give the scene room, but how much horde the level holds is as it was tuned.
 */
function levelEncounters(runSeed: number, lp: LevelPlan, k: number, opts: { scale?: number; heat?: number; beat?: SimBeat; midpoint?: boolean } = {}): ClumpPlan[] {
  const sc = sceneAt(runSeed, k, lp, opts.midpoint);
  const scene = sc ? { id: sc.id, t: roadSceneT(lp.seed) } : undefined;
  const plan = planLevel(lp.seed, opts.beat, { boss: lp.boss, scale: opts.scale, heat: opts.heat, opener: k === 0, length: WORLD_W, scene }).filter((c) => c.scene === undefined);
  // The last crowd before a calm place (the road scene in the middle of the level, or the camp after it) holds the party with a gate until it
  // is dead: nobody walks into a camp or a scene with a fight still on, and what is left when the party arrives would be sent away unkilled
  // (`leaveField`). A boss's lair has a gate of its own.
  const cuts = scene ? [760 + scene.t * (WORLD_W - 1100)] : [];
  const ends = [...cuts, Infinity];
  let from = -Infinity;
  for (const to of ends) {
    let last = -1;
    plan.forEach((c, i) => { if (c.x >= from && c.x < to && !c.boss && !c.elite && c.beat === undefined) last = i; });
    if (last >= 0) plan[last] = { ...plan[last], gate: true };
    from = to;
  }
  return plan;
}

/** Where level `k`'s field would place its encounters (a pure function of its seed: the positions do not depend on the horde's size). */
function levelShape(runSeed: number, lp: LevelPlan, k: number, midpoint: boolean): ClumpPlan[] {
  return levelEncounters(runSeed, lp, k, { midpoint });
}

/** The road scene level `k` stages (if any), and where in its field (local x). */
function levelScene(runSeed: number, lp: LevelPlan, k: number, midpoint: boolean): { id: string; x: number } | undefined {
  const sc = sceneAt(runSeed, k, lp, midpoint);
  return sc ? { id: sc.id, x: 760 + roadSceneT(lp.seed) * (WORLD_W - 1100) } : undefined;
}

/** How far a planned encounter's ground reaches to either side (its gate, or the lair's, stands past it). */
function reach(c: ClumpPlan): [number, number] {
  return [c.x, c.x + (c.boss ? LAIR_PAST : c.gate ? GATE_PAST : 0)];
}

/**
 * Lays out a road of `total` levels: each level's field, cut at its road scene (if any), with a camp after most levels (`campAfter`), and
 * the gaps that keep every calm place out of the horde's reach. A pure function of the run's seed.
 */
export function layoutRoad(runSeed: number, total: number, biomes: readonly number[] = roadBiomes(runSeed, total, []), midpoint = false, chapter = 0): RoadLayout {
  const levels: LevelLay[] = [], calm: Calm[] = [];
  // the road begins in the town: a calm place a screen wide, and the first level keeps clear of it like any other
  calm.push({ kind: 'town', level: 0, from: 0, to: TOWN_W });
  let calmEnd = TOWN_W, gap = CLEAR_AFTER, length = WORLD_W;
  for (let k = 0; k < total; k++) {
    const lp = withChapter(levelPlan(runSeed, k, total, biomes[stageOf(k)]), chapter);
    const shape = levelShape(runSeed, lp, k, midpoint);
    const scene = levelScene(runSeed, lp, k, midpoint);
    const cuts = scene ? [0, scene.x, WORLD_W] : [0, WORLD_W];
    const lay: LevelLay = { slices: [], start: calmEnd === -Infinity ? -Infinity : calmEnd, end: Infinity };
    for (let i = 0; i + 1 < cuts.length; i++) {
      const from = cuts[i], to = cuts[i + 1];
      const inside = shape.filter((c) => c.x >= from && c.x < to);
      const lo = inside.length ? Math.min(...inside.map((c) => reach(c)[0])) : from;
      const hi = inside.length ? Math.max(...inside.map((c) => reach(c)[1])) : to;
      // the first stretch of the road keeps its own place; every other starts where the calm place before it lets it
      const dx = calmEnd === -Infinity ? 0 : calmEnd + gap - lo;
      lay.slices.push({ from, to, dx });
      length = dx + WORLD_W;
      const last = i + 2 === cuts.length;
      if (last && k === total - 1) break; // the end of the road
      const at = dx + hi + CLEAR_BEFORE;
      if (last && !campAfter(runSeed, k, total)) {
        // no camp here: the next level's field follows this one's on the same road, a breath further on
        calmEnd = dx + hi;
        gap = JOIN_GAP;
        continue;
      }
      if (!last) {
        // a road scene: its figures stand SCENE_BEFORE into its ground, and it lets the party go SCENE_RELEASE past them
        calm.push({ kind: 'scene', level: k, from: at, to: at + SCENE_BEFORE + SCENE_RELEASE, scene: scene!.id, x: at + SCENE_BEFORE });
      } else {
        calm.push({ kind: 'camp', level: k, from: at, to: at + CAMP_TO - CAMP_FROM, shopX: at - CAMP_FROM });
        // the last camp of a region opens onto the crossroads into the next
        const next = stageOf(k + 1);
        if (next !== stageOf(k)) {
          const from = calm[calm.length - 1].to;
          calm.push({ kind: 'fork', level: k, from, to: from + FORK_LEN, stage: next, options: forkOptions(runSeed, next, biomes.slice(0, next)), commit: from + FORK_COMMIT });
        }
      }
      calmEnd = calm[calm.length - 1].to;
      gap = CLEAR_AFTER;
    }
    levels.push(lay);
  }
  for (let k = 0; k < total; k++) levels[k].end = k + 1 < total ? levels[k + 1].start : Infinity;
  // a level's part of the road ends where the camp after it begins (the camp is counted as the level's, as the store was)
  for (const c of calm) if (c.kind === 'camp') levels[c.level].end = c.from;
  return { levels, calm, length };
}

/** Where each biome's stretch of the road begins (one per `LEVELS_PER_BIOME` levels), and the road's end: for the scenery's turns. */
export function stageBounds(layout: RoadLayout): number[] {
  const out: number[] = [];
  for (let k = 0; k < layout.levels.length; k += LEVELS_PER_BIOME) {
    const fork = layout.calm.find((c) => c.kind === 'fork' && c.stage === stageOf(k));
    out.push(k === 0 ? 0 : fork ? fork.to + FORK_TURN : layout.levels[k].slices[0].dx);
  }
  out.push(layout.length);
  return out;
}

/** The part of the road at road x `c` (a camera's centre): the level, and the calm place there (an index into `layout.calm`, or -1). */
export function roadPart(layout: RoadLayout, c: number): { level: number; calm: number } {
  const calm = layout.calm.findIndex((p) => c >= p.from && c < p.to);
  if (calm >= 0) return { level: layout.calm[calm].level, calm };
  let level = 0;
  for (let k = 1; k < layout.levels.length; k++) if (c >= layout.levels[k].start) level = k;
  return { level, calm: -1 };
}

/** Where a point of level `k`'s own field (local x) lies on the road. */
export function levelToRoad(lay: LevelLay, x: number): number {
  for (const sl of lay.slices) if (x < sl.to) return x + sl.dx;
  return x + lay.slices[lay.slices.length - 1].dx;
}

/** The party is still in the starting town. */
export function inTown(s: GameState): boolean { return s.road !== null && s.road.town; }

/** What happened in the town (the `a` of an `Ev.Town`): a hero took up a class, a place was built up (or was too dear, or is at its height), the heat was set, the party left. */
export const TownEv = { Class: 0, Built: 1, Dear: 2, Maxed: 3, Heat: 4, Left: 5 } as const;

/** The camera is in a camp: no horde, no director; the peddler trades. */
export function inCamp(s: GameState): boolean { return s.road !== null && s.road.camp; }

/** A camp's stall and goods are near enough the screen to draw (a store always is). */
export function campShown(s: GameState): boolean {
  return s.road !== null && s.camX + VIEW_W > s.shopX + CAMP_FROM - 300 && s.camX < s.shopX + CAMP_TO + 300;
}

/** Progress (0..1) through the level the camera is in, for the enemy mix and the director (1 in a camp). */
export function roadProgress(s: GameState): number {
  const r = s.road!;
  if (r.camp) return 1;
  const lay = r.layout.levels[r.level];
  const a = Number.isFinite(lay.start) ? lay.start : 0;
  const b = Number.isFinite(lay.end) ? lay.end : r.layout.length;
  return Math.max(0, Math.min(1, (s.camX + VIEW_W / 2 - a) / Math.max(1, b - a)));
}

/**
 * The director sends no packs while a calm place is on the screen or just ahead of it (a pack arrives from past the right edge), nor in
 * the last screen of a level's own field (as it never did at the end of a level).
 */
export function roadDirectorOff(s: GameState): boolean {
  const lo = s.camX, hi = s.camX + VIEW_W + 80, r = s.road!;
  if (r.layout.calm.some((p) => p.to > lo && p.from < hi)) return true;
  return roadToLevel(r.layout.levels[r.level], s.camX) > LEVEL_CAM_END - 100;
}

/**
 * Where road x `x` lies in level `lay`'s own field: inside one of its stretches, that point of the field; in the ground the road grew
 * around a calm place, the end of the stretch before it (or the start of the field). So walking that ground does not count as advancing.
 */
export function roadToLevel(lay: LevelLay, x: number): number {
  let local = lay.slices[0].from;
  for (const sl of lay.slices) {
    if (x < sl.from + sl.dx) break;
    local = Math.min(x - sl.dx, sl.to);
  }
  return local;
}

/**
 * How far the party has advanced this tick, for the director's packs: measured over each level's own field, as it was when a level was a
 * field of its own, so the ground the road grew around its calm places brings no extra horde.
 */
export function roadAdvance(s: GameState): number {
  const r = s.road!;
  const local = roadToLevel(r.layout.levels[r.level], s.camX);
  if (r.trigLevel !== r.level) { r.trigLevel = r.level; r.trigLocal = Math.min(local, 0); }
  const adv = Math.max(0, local - r.trigLocal);
  r.trigLocal = Math.max(r.trigLocal, local);
  return adv;
}

/** Plans level `k`: its encounters (each stretch moved along the road, and tagged with the level's seed, biome and slice of the cast), its road scene, gates and sites. */
function planRoadLevel(s: GameState, k: number): void {
  const r = s.road!;
  const lp = roadLevel(r, k);
  const lay = r.layout.levels[k];
  const base = s.plan.length;
  // (a staged beat adds an encounter of its own and moves no other, so the layout, made without it, still holds)
  const plan = levelEncounters(r.runSeed, lp, k, { scale: lp.scale * heatHorde(r.heat) * r.horde, heat: r.heat, beat: k === 0 ? r.beat ?? undefined : undefined, midpoint: r.midpoint });
  const scene = r.layout.calm.find((c) => c.kind === 'scene' && c.level === k);
  let sceneAt = scene ? plan.findIndex((c) => levelToRoad(lay, c.x) > scene.x!) : -1;
  if (scene && sceneAt < 0) sceneAt = plan.length;
  plan.forEach((c, i) => {
    if (i === sceneAt) s.plan.push({ x: scene!.x!, y: SCENE_Y, size: 0, line: false, t: c.t, scene: scene!.scene, rid: SCENE_STREAM, seed: lp.seed, biome: lp.biome, mix: lp.mix });
    s.plan.push({ ...c, x: levelToRoad(lay, c.x), seed: lp.seed, biome: lp.biome, mix: lp.mix });
  });
  if (scene && sceneAt === plan.length) s.plan.push({ x: scene.x!, y: SCENE_Y, size: 0, line: false, t: 1, scene: scene.scene, rid: SCENE_STREAM, seed: lp.seed, biome: lp.biome, mix: lp.mix });
  // gates stand past the encounters they guard; the lair holds a boss's road until it and its retinue are dead
  const gates: { x: number; clump: number }[] = [];
  for (let i = base; i < s.plan.length; i++) {
    const c = s.plan[i];
    if (c.beat !== undefined) s.beatIndex = i;
    if (c.gate) gates.push({ x: c.x + GATE_PAST, clump: i });
    if (c.boss) gates.push({ x: c.x + LAIR_PAST, clump: i });
  }
  gates.sort((a, b) => a.x - b.x); // (crowds are jittered, so a neighbour's gate can stand a little before another's: the camera meets them in order)
  s.gates.push(...gates);
  placeSites(s, lp.boss, {
    x0: 0, length: WORLD_W, seed: lp.seed, surrender: lp.chapter >= 2,
    at: (x) => levelToRoad(lay, x),
    clear: (x) => r.layout.calm.every((c) => x < c.from - CLEAR_BEFORE / 2 || x > c.to + CLEAR_BEFORE / 2),
  });
  r.planned = k + 1;
}

/** A level is planned once the screen's right edge is this close to where it starts (well before its first encounter streams in). */
const PLAN_AHEAD = STREAM_AHEAD + 600;

/** The camp after level `k`: the peddler's goods (the store's stock, priced for how far down the road it is). */
function openCamp(s: GameState, c: Calm): void {
  const r = s.road!;
  s.shopX = c.shopX!;
  s.wares = stockFor(r.runSeed, c.level).map((it) => ({ ware: it.ware, price: it.price, sold: false }));
  // quest-givers, for the level after the camp; none before a crossroads (the level beyond is not yet known: a cull needs its creatures)
  const next = c.level + 1;
  const known = next < r.total && stageOf(next) === stageOf(c.level);
  const lp = known ? roadLevel(r, next) : undefined;
  s.offers = lp ? questOffers(r.runSeed, { level: next, boss: lp.boss, biome: lp.biome }) : [];
  s.questTaken = -1;
  s.gifts = giftsFor(r.runSeed, c.level);
  s.giftPick = [-1, -1, -1, -1];
}

/**
 * Called every tick on a road: plans the road ahead as the camera nears it, and keeps the sim's sense of where it is up to date (the
 * level's biome, slice of the cast and damage; stand down from chapter II; the camp's goods; the next road scene; the horde leaving as
 * the party walks into a calm place).
 */
export function roadUpkeep(s: GameState, leave: (s: GameState) => void): void {
  const r = s.road!, L = r.layout;
  // the party walks out of the town through its gate: the road begins
  if (r.town && s.players.some((p) => p.active && !p.downed && s.ents.x[p.ent] >= TOWN_GATE_X)) {
    r.town = false;
    emit(s.events, Ev.Town, TOWN_GATE_X, WORLD_H / 2, TownEv.Left, 0, 0);
  }
  // nothing is planned while the party is in the town (the heat may still change), nor past a crossroads until the party has chosen its road
  while (!r.town && r.planned < r.total && stageOf(r.planned) <= r.choices.length && s.camX + VIEW_W + PLAN_AHEAD >= L.levels[r.planned].slices[0].dx + 700) planRoadLevel(s, r.planned);
  const fork = L.calm.find((c) => c.kind === 'fork' && c.stage === r.choices.length + 1);
  if (fork) { const side = forkChoice(s, fork); if (side >= 0) { commitFork(s, fork, side); return; } }
  // a camp's goods are set out as it nears (the last camp's are long behind by then)
  const next = L.calm.find((c) => c.kind === 'camp' && c.shopX !== s.shopX && s.camX + VIEW_W + PLAN_AHEAD >= c.from && s.camX < c.to);
  if (next) openCamp(s, next);
  // the road scene the party is coming to (or standing at): the first whose figures are not yet out of sight behind the screen
  const gone = (i: number) => s.camX > s.plan[i].x + SCENE_GONE;
  if (s.sceneIndex < 0 || gone(s.sceneIndex)) {
    let i = s.sceneIndex + 1;
    while (i < s.plan.length && (s.plan[i].scene === undefined || gone(i))) i++;
    s.sceneIndex = i < s.plan.length ? i : -1;
  }
  const at = roadPart(L, s.camX + VIEW_W / 2);
  if (at.level === r.level && at.calm === r.calm && r.since >= 0) return;
  const first = r.since < 0;
  const entering = at.calm >= 0 && at.calm !== r.calm;
  const newLevel = at.level !== r.level;
  r.level = at.level; r.calm = at.calm; r.camp = at.calm >= 0 && L.calm[at.calm].kind === 'camp'; r.since = s.tick;
  const lp = roadLevel(r, at.level);
  s.biome = lp.biome;
  s.mix = lp.mix;
  s.damageMul = lp.damage * r.hard;
  s.surrender = lp.chapter >= 2;
  // (the camp before a crossroads leads nowhere certain yet: the music keeps to this region's key)
  const nextLevel = Math.min(r.total - 1, at.level + 1);
  s.nextBiome = r.camp && stageOf(nextLevel) <= r.choices.length ? roadLevel(r, nextLevel).biome : -1;
  if (entering && !first) leave(s); // what is left of the horde walks off the way it came, as it did when a level was won
  // a quest runs from the camp it was taken in, through the next level, to the next camp: there it is settled
  if (entering && L.calm[at.calm].kind === 'camp') { endQuest(s); restParty(s); } // the party rests at a camp
  if (newLevel && at.calm < 0 && s.questTaken >= 0 && s.offers[s.questTaken]) beginQuest(s, at.level);
}

/** The quest the party took in the camp begins as it walks into the next level: its bodies placed along that level's stretch of road. */
function beginQuest(s: GameState, k: number): void {
  const r = s.road!, lay = r.layout.levels[k];
  let lead = -Infinity;
  for (const p of s.players) if (p.active && !p.downed) lead = Math.max(lead, s.ents.x[p.ent]);
  s.quest = createQuestRun(s.offers[s.questTaken], s.tick);
  s.questTaken = -1;
  s.offers = [];
  placeQuest(s, { x0: 0, length: WORLD_W, seed: roadLevel(r, k).seed, at: (x) => levelToRoad(lay, x), wardX: Number.isFinite(lead) ? lead - 40 : s.camX + 60 });
}

/** The party reached the next camp: the quest is settled, and whoever it was about (a ward, a captive) goes home. */
function endQuest(s: GameState): void {
  if (!s.quest) return;
  settleQuestNow(s, true);
  const i = s.quest.ent;
  if (i >= 0 && s.ents.alive[i] && s.ents.kind[i] === Kind.Npc) s.ents.mode[i] = NpcMode.Freed;
}

/** The music turns to the next level's biome at the peddler, halfway through the camp (once the road beyond is known). */
export function roadMusicBiome(s: GameState): number {
  return inCamp(s) && s.nextBiome >= 0 && s.camX + VIEW_W / 2 >= s.shopX + STORE_X ? s.nextBiome : s.biome;
}

/**
 * The road the party takes at a crossroads, once a hero on their feet has crossed its commit line: the side (0 upper, 1 lower half of the
 * field) more of them stand on, a tie going to the first hero's side. -1 while nobody has crossed.
 */
export function forkChoice(s: GameState, fork: Calm): number {
  let crossed = false, up = 0, down = 0, first = -1;
  for (const p of s.players) {
    if (!p.active || p.downed) continue;
    const x = s.ents.x[p.ent], high = s.ents.y[p.ent] < WORLD_H / 2;
    if (x >= fork.commit!) crossed = true;
    if (high) up++; else down++;
    if (first < 0) first = high ? 0 : 1;
  }
  if (!crossed) return -1;
  return up > down ? 0 : down > up ? 1 : first;
}

/** The party took road `side` at a crossroads: the next region's biome is set, and the road ahead is laid out again from the seed and the choices. */
export function commitFork(s: GameState, fork: Calm, side: number): void {
  const r = s.road!;
  r.choices.push(side);
  r.biomes = roadBiomes(r.runSeed, r.total, r.choices);
  r.layout = layoutRoad(r.runSeed, r.total, r.biomes, r.midpoint, r.chapter);
  s.worldW = r.layout.length;
  s.exitX = s.worldW - 70;
  emit(s.events, Ev.Fork, fork.commit!, WORLD_H / 2, side, r.biomes[fork.stage!], fork.stage!);
}

/** A fresh road's state (level 0, nothing planned yet: the first upkeep plans it). */
export function createRoad(runSeed: number, total: number, heat: number, renown = 0, meta: readonly number[] = [], beat?: SimBeat, horde = ROAD_HORDE, bossHp = ROAD_BOSS_HP, trees?: readonly TreeSave[], hard = ROAD_HARD, midpoint = false, chapter = 0): RoadState {
  const n = Math.max(1, total);
  const biomes = roadBiomes(runSeed, n, []);
  return {
    runSeed, total: n, heat, layout: layoutRoad(runSeed, n, biomes, midpoint, chapter), midpoint, chapter, planned: 0, level: 0, calm: -1, camp: false, since: -1, choices: [], biomes,
    town: true, renown, meta: META.map((_, i) => meta[i] ?? 0), metaMul: metaMultipliers(meta), trees: trees ? cloneTreeSaves(trees) : newTreeSaves(), treeGated: !!trees, bosses: 0, beat: beat ? { ...beat } : null, trigLevel: -1, trigLocal: 0, horde, bossHp, hard,
  };
}

/** Where level `k`'s field begins on the road (its first stretch's local 0). */
export function levelX0(r: RoadState, k: number): number { return r.layout.levels[k].slices[0].dx; }

/** Dev aid (`?road=1&at=N`): puts the party at the start of level `level`, with the road behind it planned and passed. */
export function roadJump(s: GameState, level: number): void {
  const r = s.road!;
  const k = Math.max(0, Math.min(r.total - 1, level));
  // the crossroads on the way there take the upper road
  while (stageOf(k) > r.choices.length) commitFork(s, r.layout.calm.find((c) => c.kind === 'fork' && c.stage === r.choices.length + 1)!, 0);
  s.events.n = 0;
  const lay = r.layout.levels[k];
  const x = Number.isFinite(lay.start) ? lay.start - VIEW_W / 2 + 40 : 0;
  s.camX = s.prevCamX = s.camMax = s.trigCamX = x;
  s.players.forEach((p, i) => {
    if (!p.active) return;
    s.ents.x[p.ent] = s.ents.px[p.ent] = x + 80 - i * 12;
  });
  r.since = -1;
  r.town = false; // (a jump leaves the town behind)
  roadUpkeep(s, () => {});
  while (s.nextClump < s.plan.length && s.plan[s.nextClump].x < x) s.nextClump++;
  while (s.gateIdx < s.gates.length && s.gates[s.gateIdx].x < x) s.gateIdx++;
}
