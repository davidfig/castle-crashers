// The road's biomes: one long stretch of scenery per run, which turns from one biome into the next slowly and unevenly instead of at the
// edge of a level. A `Span` is one such turn. Along it, the share of the road that belongs to the next biome rises from 0 to 1 by a
// smooth, always-rising curve with steep and gentle stretches, so the road may sit at 90% one biome and 10% the other for a long while
// before the balance tips. Pure and seeded (render-only; see docs/17-generated-scenery.md).
import { createRng, rngFloat, rngRange } from '../../engine/rng';

/** A turn between two neighbouring biomes of the road (`a` into `b`, indexes into the run's world). */
export interface Span {
  a: number;
  b: number;
  /** Road coordinates between which the share rises from 0 to 1. */
  from: number;
  to: number;
  /** The share's knots: positions along the turn (0..1), the share there, and the slope (share per unit of position) the curve has through each. */
  us: number[];
  ss: number[];
  ts: number[];
}

export interface Road {
  /** Road px of one biome's stretch (its levels). */
  stageLen: number;
  spans: Span[];
}

/** The shortest pure stretch between two turns, px. A view is 640 wide and the scenery looks a few hundred px past its edges, so a turn can be handed over to the next in the middle of one unseen. */
export const MIN_PLATEAU = 1800;
/** How long a turn runs, as a multiple of one level's stretch of road: from a screen or two to well over a level. */
export const TURN_MIN = 0.9, TURN_MAX = 1.7;
/** How far a turn's centre may sit from the boundary between two biomes' stretches, as a share of a stretch. */
export const OFF_CENTRE = 0.12;

/** Share (0..1) at position `u` (0..1 along the span): a monotone cubic through the knots. */
export function profile(sp: Span, u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let i = 0;
  while (i < sp.us.length - 2 && u > sp.us[i + 1]) i++;
  const u0 = sp.us[i], u1 = sp.us[i + 1], h = u1 - u0, t = (u - u0) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * sp.ss[i] + (t3 - 2 * t2 + t) * h * sp.ts[i] + (-2 * t3 + 3 * t2) * sp.ss[i + 1] + (t3 - t2) * h * sp.ts[i + 1];
}

/** How fast the share rises at `u` (share per unit of position, so the mean is 1). */
export function profileSlope(sp: Span, u: number): number {
  if (u <= 0 || u >= 1) return 0;
  let i = 0;
  while (i < sp.us.length - 2 && u > sp.us[i + 1]) i++;
  const u0 = sp.us[i], u1 = sp.us[i + 1], h = u1 - u0, t = (u - u0) / h, t2 = t * t;
  return ((6 * t2 - 6 * t) * sp.ss[i] + (3 * t2 - 4 * t + 1) * h * sp.ts[i] + (-6 * t2 + 6 * t) * sp.ss[i + 1] + (3 * t2 - 2 * t) * h * sp.ts[i + 1]) / h;
}

/** Builds the knots of a span: three to five interior knots whose slopes differ by up to a factor of five, so the turn has runs of nearly all one biome and steep changes. */
function knots(sp: Span, seed: number, k: number): void {
  const rng = createRng(seed, 40 + k);
  const n = 3 + Math.floor(rngFloat(rng) * 3); // interior knots
  const du: number[] = [], r: number[] = [];
  for (let j = 0; j <= n; j++) { du.push(rngRange(rng, 0.6, 1.4)); r.push(rngRange(rng, 0.35, 2.2)); }
  const su = du.reduce((a, b) => a + b, 0);
  for (let j = 0; j <= n; j++) du[j] /= su;
  const rise = du.map((d, j) => d * r[j]);
  const sr = rise.reduce((a, b) => a + b, 0);
  sp.us = [0]; sp.ss = [0];
  for (let j = 0; j <= n; j++) { sp.us.push(Math.min(1, sp.us[j] + du[j])); sp.ss.push(Math.min(1, sp.ss[j] + rise[j] / sr)); }
  sp.us[n + 1] = 1; sp.ss[n + 1] = 1;
  // tangents: the harmonic mean of the neighbouring secants keeps the curve rising, and the ends are flat so a turn starts and finishes gently
  const sec = sp.us.slice(1).map((u, j) => (sp.ss[j + 1] - sp.ss[j]) / (u - sp.us[j]));
  sp.ts = sp.us.map((_, j) => (j === 0 || j === sp.us.length - 1 ? 0 : (2 * sec[j - 1] * sec[j]) / (sec[j - 1] + sec[j])));
}

/**
 * The road of a run with `stages` biomes, one per `stageLen` of road. Each boundary between two biomes gets a turn centred near it
 * (up to 12% of a stage early or late), of random length. The longest turn is short enough that two neighbours, each as long and as far
 * off-centre as can be, still leave `MIN_PLATEAU` between them (`TURN_MAX`; checked in the tests).
 */
export function planRoad(seed: number, stages: number, stageLen: number): Road {
  const spans: Span[] = [];
  for (let k = 0; k + 1 < stages; k++) {
    const rng = createRng(seed, 30 + k);
    const len = rngRange(rng, TURN_MIN, TURN_MAX) * (stageLen / 3);
    const centre = (k + 1) * stageLen + rngRange(rng, -OFF_CENTRE, OFF_CENTRE) * stageLen;
    const sp: Span = { a: k, b: k + 1, from: centre - len / 2, to: centre + len / 2, us: [], ss: [], ts: [] };
    knots(sp, seed, k);
    spans.push(sp);
  }
  return { stageLen, spans };
}

/**
 * Which span is in force for a view centred at road `x`: the one whose turn is nearest, handing over in the middle of the
 * plateau between two turns (where every element on screen belongs to one biome, so the hand-over cannot be seen). -1: no spans.
 */
export function spanIndexAt(road: Road, x: number): number {
  const s = road.spans;
  if (s.length === 0) return -1;
  for (let k = 0; k + 1 < s.length; k++) if (x < (s[k].to + s[k + 1].from) / 2) return k;
  return s.length - 1;
}
