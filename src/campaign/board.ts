// The Writ board and the run configuration the campaign layer hands to a run (docs/12-story.md).
import { BEAT_BY_ID, type BeatNode } from '../data/story/beats';
import { FINAL_CHAPTER } from '../data/story/chapters';
import { writFromSeed, type Writ } from '../data/story/writs';
import { createRng, nextU32, Stream } from '../engine/rng';
import { campaignComplete, pendingBeat, type Ledger } from './ledger';

/** A beat the run generator must place, not roll. */
export interface ReservedBeat {
  id: string;
  node: BeatNode;
  /** Index in the run's biome order. */
  biome: number;
  /** A step every route passes through, so no fork can avoid it. */
  at: 'spine';
  /** Placed earlier on the spine after two misses in a row (a deterministic nudge, not a probability). */
  early: boolean;
}

export interface RunConfig {
  seed: number;
  writ: Writ;
  reservedBeat?: ReservedBeat;
  offLedger: boolean;
}

export const BOARD_SIZE = 3;
const MAX_ATTEMPTS = 24;

/** The three Writs on offer. Fixed by the Ledger (seed + runs finished), and a pending milestone Writ always leads. */
export function offerWrits(l: Ledger): Writ[] {
  const chapter = Math.min(l.chapter, FINAL_CHAPTER);
  const r = createRng((l.campaignSeed ^ Math.imul(l.runs + 1, 0x9e3779b1)) >>> 0, Stream.campaign);
  const out: Writ[] = [];
  const pending = pendingBeat(l);
  const milestone = pending?.tier === 'milestone' && !campaignComplete(l) ? pending : undefined;
  if (milestone) out.push({ ...writFromSeed(nextU32(r), chapter), milestone: milestone.id, title: milestone.title });
  for (let tries = 0; out.length < BOARD_SIZE && tries < MAX_ATTEMPTS; tries++) {
    const w = writFromSeed(nextU32(r), chapter);
    if (!out.some((o) => o.clan.place === w.clan.place)) out.push(w);
  }
  return out;
}

export function reservedBeatFor(l: Ledger, writ: Writ): ReservedBeat | undefined {
  const b = pendingBeat(l);
  if (!b || b.tier === 'hub') return undefined;
  if (b.tier === 'milestone' ? writ.milestone !== b.id : writ.milestone !== undefined) return undefined;
  return { id: b.id, node: b.node ?? 'witness', biome: b.biome ?? 0, at: 'spine', early: (l.missed[b.id] ?? 0) >= 2 };
}

export function makeRunConfig(l: Ledger, writ: Writ): RunConfig {
  return { seed: writ.seed, writ, reservedBeat: reservedBeatFor(l, writ), offLedger: false };
}

/** Entered and daily seeds still get a people, a place and a Writ, but cannot advance the story. */
export function offLedgerConfig(seed: number, chapter = 1): RunConfig {
  return { seed, writ: writFromSeed(seed, chapter), offLedger: true };
}
