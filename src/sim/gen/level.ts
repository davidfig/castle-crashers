// Battlefield generation. The level is *planned* up front (a cheap list of encounters, a function of the
// seed alone) and *streamed*: each encounter is spawned only when the camera is about to reach it, sized
// for the party that is playing at that moment (docs/03: difficulty scales with party size).
import { createRng, rngFloat, rngInt, rngRange, Stream, type Rng } from '../../engine/rng';
import { cosTurns, sinTurns } from '../../engine/math';
import { MOBS, MobType } from '../../data/mobs';
import { ROSTERS } from '../../data/roster';
import { pickMobType, pickSupport } from './mix';
import { VIEW_W, WORLD_H, WORLD_W } from '../constants';
import { allocEntity, BYSTANDER, Kind, SURRENDERED } from '../entities';
import type { GameState } from '../state';

export interface ClumpPlan {
  x: number;
  /** Center height for blobs (lines span the whole height). */
  y: number;
  /** Enemy count for a party of one. */
  size: number;
  /** A full-height wall of enemies instead of a blob. */
  line: boolean;
  /** Progress along the battlefield, 0..1 (drives the enemy mix). */
  t: number;
  /** The boss encounter: the boss and its retinue instead of an ordinary crowd. */
  boss?: boolean;
  /** A staged story beat (docs/12-story.md, tier 2): this encounter is the beat's scene, not a crowd. */
  beat?: string;
  /** Random stream number of this encounter, so inserting one never changes the others. Defaults to its index. */
  rid?: number;
}

/** A story beat the run was told to place. Mirrors the campaign layer's ReservedBeat; the sim knows nothing else about the campaign. */
export interface SimBeat {
  id: string;
  /** Placed earlier on the way after the party has missed it twice. */
  early?: boolean;
}

/** Beats the battlefield can stage itself. The rest are not placed (the campaign layer decides what to do about them). */
export const STAGED_BEATS: readonly string[] = ['R1', 'R3'];
/** How far along the field (0..1, same scale as an encounter's `t`) a staged beat stands. */
const BEAT_T = 0.3;
const BEAT_T_EARLY = 0.12;
const BEAT_STREAM = 5000;

/** Encounters are spawned this far past the right edge of the screen, i.e. out of sight. */
export const STREAM_AHEAD = 520;
/** Streaming waits until the opening seconds are over, so players who join right away are counted. */
export const STREAM_DELAY_TICKS = 120;

/**
 * How many times the party-of-one enemy count a party of n faces. Each extra player adds fighting
 * capacity (more AoE, more bodies), so the horde grows with the party instead of the enemies getting tankier.
 */
/** Enemy count multiplier by party size. Sub-linear: heroes stack their AoE on the same crowd, and a huge horde is more chaos than fun. */
const PARTY_SCALE = [1, 1.8, 2.5, 3.2];
export function partyScale(players: number): number {
  const n = Math.max(1, Math.min(4, players));
  return PARTY_SCALE[n - 1];
}

export function activePlayers(s: GameState): number {
  let n = 0;
  for (const p of s.players) if (p.active) n++;
  return n;
}

/** Plan options. A level that is not the last of a route has no boss: it is won by reaching the far end. */
export interface PlanOptions { boss?: boolean }

export function planLevel(seed: number, beat?: SimBeat, opts: PlanOptions = {}): ClumpPlan[] {
  const r = createRng(seed, Stream.level);
  const plan: ClumpPlan[] = [];
  const clumps = 24;
  for (let c = 0; c < clumps; c++) {
    const t = c / (clumps - 1);
    const x = 760 + t * (WORLD_W - 1100) + rngRange(r, -40, 40);
    const size = Math.floor(16 + t * 26 + rngRange(r, 0, 10));
    const line = c % 4 === 3;
    const y = rngRange(r, 8, WORLD_H - 8); // anywhere from the very top to the very bottom
    plan.push({ x, y, size, line, t, rid: c });
  }
  // Final stand: a wall across the field, then the boss with its retinue at the very end.
  plan.push({ x: WORLD_W - 440, y: WORLD_H / 2, size: 38, line: true, t: 1, rid: clumps });
  if (opts.boss !== false) plan.push({ x: WORLD_W - 250, y: WORLD_H / 2, size: 0, line: false, t: 1, boss: true, rid: clumps + 1 });
  if (beat && STAGED_BEATS.includes(beat.id)) {
    // Placed at a fixed point of the field (there is one route), never rolled; the other encounters keep their own streams.
    const t = beat.early ? BEAT_T_EARLY : BEAT_T;
    const x = 760 + t * (WORLD_W - 1100);
    let at = 0;
    while (at < plan.length && plan[at].x <= x) at++;
    plan.splice(at, 0, { x, y: WORLD_H / 2 + 10, size: 0, line: false, t, beat: beat.id, rid: BEAT_STREAM });
  }
  return plan;
}

function addMob(s: GameState, r: Rng, x: number, y: number, t: number): boolean {
  const type = pickMobType(r, t, s.biome);
  const yy = y < 4 ? 4 : y > WORLD_H - 4 ? WORLD_H - 4 : y;
  const i = allocEntity(s.ents, Kind.Mob, type, x, yy, MOBS[type].hp);
  if (i < 0) return false;
  s.ents.face[i] = rngFloat(r) < 0.5 ? 1 : -1;
  s.ents.flags[i] = 1; // awake: it heads for the party from the moment it appears
  return true;
}

export function hasBoss(s: GameState): boolean {
  for (const c of s.plan) if (c.boss) return true;
  return false;
}

/** The boss and the retinue that stands around it. Its health grows with the party; the retinue does too. */
function spawnBoss(s: GameState, plan: ClumpPlan, index: number, scale: number): void {
  const type = ROSTERS[s.biome].boss;
  const def = MOBS[type];
  const b = def.boss!;
  const n = Math.max(1, Math.min(4, activePlayers(s)));
  const hp = def.hp * b.hpScale[n - 1];
  const i = allocEntity(s.ents, Kind.Mob, type, plan.x, WORLD_H / 2, hp);
  if (i < 0) return;
  const e = s.ents;
  e.flags[i] = 1;
  e.face[i] = -1;
  e.cool2[i] = 150; // a short breather before its first special move
  e.boss = i;
  // The retinue: a thick crowd around and in front of the boss, small fry up front, archers behind.
  const r = createRng(s.seed, 1000 + (plan.rid ?? index));
  const count = Math.round(b.retinue * scale);
  for (let k = 0; k < count; k++) {
    const ang = rngFloat(r); // in turns: the sim uses table trig, not Math.cos/sin (ADR-0004)
    const rad = 46 + rngFloat(r) * 90;
    const x = plan.x - 20 + cosTurns(ang) * rad * 1.3 - 30;
    const y = WORLD_H / 2 + sinTurns(ang) * rad * 0.8;
    const type = pickSupport(r, false, s.biome);
    const m = allocEntity(e, Kind.Mob, type, x, y < 6 ? 6 : y > WORLD_H - 6 ? WORLD_H - 6 : y, MOBS[type].hp);
    if (m < 0) return;
    e.flags[m] = 1;
    e.face[m] = -1;
  }
}

/** R1: a few goblins around a cookfire. They do not attack, and they do not chase. */
function spawnCamp(s: GameState, plan: ClumpPlan): void {
  const r = createRng(s.seed, 1000 + (plan.rid ?? 0));
  const count = 3 + rngInt(r, 3);
  for (let k = 0; k < count; k++) {
    const ang = rngFloat(r);
    const rad = 12 + rngFloat(r) * 10;
    const x = plan.x + cosTurns(ang) * rad * 1.4;
    const y = plan.y + sinTurns(ang) * rad * 0.7;
    const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, y, MOBS[MobType.Goblin].hp);
    if (m < 0) return;
    s.ents.flags[m] = BYSTANDER;
    s.ents.face[m] = x < plan.x ? 1 : -1; // facing the fire
  }
}

/** R3: a few goblins and archers who have already laid down their arms, kneeling in the road until the party reaches them. */
function spawnSurrendered(s: GameState, plan: ClumpPlan): void {
  const r = createRng(s.seed, 1000 + (plan.rid ?? 0));
  const count = 4 + rngInt(r, 3);
  for (let k = 0; k < count; k++) {
    const ang = rngFloat(r);
    const rad = 10 + rngFloat(r) * 16;
    const type = k % 3 === 2 ? MobType.Archer : MobType.Goblin;
    const x = plan.x + cosTurns(ang) * rad * 1.4;
    const y = plan.y + sinTurns(ang) * rad * 0.7;
    const m = allocEntity(s.ents, Kind.Mob, type, x, y, MOBS[type].hp);
    if (m < 0) return;
    s.ents.flags[m] = SURRENDERED;
    s.ents.rem[m] = -1; // kneels until the beat has played
    s.ents.face[m] = x < plan.x ? 1 : -1;
  }
}

/** Spawn one planned encounter for a party of the given scale. */
export function spawnClump(s: GameState, index: number, scale: number): void {
  const plan = s.plan[index];
  if (plan.boss) { spawnBoss(s, plan, index, scale); return; }
  if (plan.beat === 'R1') { spawnCamp(s, plan); return; }
  if (plan.beat === 'R3') { spawnSurrendered(s, plan); return; }
  // Each encounter has its own random stream, so its contents do not depend on when it was streamed in.
  const r = createRng(s.seed, 1000 + (plan.rid ?? index));
  const count = Math.round(plan.size * scale);
  if (plan.line) {
    for (let k = 0; k < count; k++) {
      const x = plan.x + (rngFloat(r) - 0.5) * 36 * Math.sqrt(scale);
      const y = rngFloat(r) * WORLD_H;
      if (!addMob(s, r, x, y, plan.t)) return;
    }
  } else {
    // A bigger party faces a denser, somewhat wider crowd, not just a longer one.
    const spread = 24 + plan.size * 0.9 * Math.sqrt(scale);
    for (let k = 0; k < count; k++) {
      const x = plan.x + (rngFloat(r) + rngFloat(r) - 1) * spread;
      const y = plan.y + (rngFloat(r) + rngFloat(r) - 1) * spread * 0.9;
      if (!addMob(s, r, x, y, plan.t)) return;
    }
  }
}

/** Called every tick: spawn the encounters the camera is about to reach, sized for the current party. */
export function streamLevel(s: GameState): void {
  if (s.tick < STREAM_DELAY_TICKS) return;
  const scale = partyScale(activePlayers(s));
  const horizon = s.camX + VIEW_W + STREAM_AHEAD;
  while (s.nextClump < s.plan.length) {
    const next = s.plan[s.nextClump];
    // The boss does not stream in 500 px ahead: it would take a minute to walk to the party. It appears just offscreen.
    if (next.x >= (next.boss ? s.camX + VIEW_W + 90 : horizon)) break;
    if (s.ents.capacity - s.ents.count < 400) return; // entity budget: try again once things have been cleared
    spawnClump(s, s.nextClump, scale);
    s.nextClump++;
  }
}

/** Spawn every remaining encounter right now (tests and tools that want the whole battlefield at once). */
export function spawnAllClumps(s: GameState, scale: number): void {
  while (s.nextClump < s.plan.length) {
    spawnClump(s, s.nextClump, scale);
    s.nextClump++;
  }
}
