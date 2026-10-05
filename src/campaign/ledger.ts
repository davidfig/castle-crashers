// The Ledger: the persistent campaign state (docs/12-story.md). Pure functions over plain data; no DOM, no clock.
// The sim never touches it: a finished run hands back a RunSummary (summary.ts) and the meta layer applies it here.
import { BEATS, BEAT_BY_ID, type Beat } from '../data/story/beats';
import { FINAL_CHAPTER } from '../data/story/chapters';

export const LEDGER_VERSION = 1;
export type RegionState = 'unseen' | 'cleared' | 'quiet';

export interface Ledger {
  v: number;
  /** 1..FINAL_CHAPTER; FINAL_CHAPTER + 1 once every beat has played. */
  chapter: number;
  beatsSeen: string[];
  /** Ordinary Writs won in the current chapter. */
  chapterWrits: number;
  /** Consecutive misses of a reserved beat, by beat id (cleared when it plays). */
  missed: Record<string, number>;
  /** Heads by mob name (src/data/mobs.ts), campaign-wide. */
  slain: Record<string, number>;
  spared: Record<string, number>;
  /** Mobs that had surrendered and were killed anyway, campaign-wide. */
  betrayed: number;
  /** Hub scenes already shown (aftermath scenes; hub beats are tracked in `beatsSeen`). */
  scenes: string[];
  /** Classes in the last party that went out, for the class voices in hub scenes. */
  party: string[];
  regions: Record<string, RegionState>;
  endings: string[];
  /** Total finished runs; together with `campaignSeed` it fixes the Writ board, so reloading cannot reroll it. */
  runs: number;
  campaignSeed: number;
}

export function createLedger(campaignSeed: number): Ledger {
  return {
    v: LEDGER_VERSION, chapter: 1, beatsSeen: [], chapterWrits: 0, missed: {}, slain: {}, spared: {}, betrayed: 0, scenes: [], party: [],
    regions: {}, endings: [], runs: 0, campaignSeed: campaignSeed >>> 0,
  };
}

export function hasSeen(l: Ledger, id: string): boolean {
  return l.beatsSeen.includes(id);
}

export function campaignComplete(l: Ledger): boolean {
  return l.chapter > FINAL_CHAPTER;
}

/** A beat is pending when its chapter is current, it has not played, its predecessors have, and enough Writs have been won. */
export function isPending(l: Ledger, b: Beat): boolean {
  return b.chapter === l.chapter && !hasSeen(l, b.id) && b.requires.every((r) => hasSeen(l, r)) && l.chapterWrits >= b.minWrits;
}

/** The next beat of the main story, if one is due. At most one is ever pending: beats form a chain. */
export function pendingBeat(l: Ledger): Beat | undefined {
  return BEATS.find((b) => isPending(l, b));
}

/** Marks beats as played, in story order. Ids that are unknown or not pending are ignored, so a bogus summary cannot skip the story. */
export function markBeatsSeen(l: Ledger, ids: readonly string[]): Ledger {
  let cur = l;
  const ordered = [...new Set(ids)].filter((id) => BEAT_BY_ID[id]).sort((a, b) => BEATS.indexOf(BEAT_BY_ID[a]) - BEATS.indexOf(BEAT_BY_ID[b]));
  for (const id of ordered) {
    const beat = BEAT_BY_ID[id];
    if (!isPending(cur, beat)) continue;
    const missed = { ...cur.missed };
    delete missed[id];
    cur = { ...cur, beatsSeen: [...cur.beatsSeen, id, ...(beat.grants ?? []).filter((g) => !hasSeen(cur, g))], missed };
    cur = advanceChapters(cur);
  }
  return cur;
}

/** Moves to the next chapter whenever every beat of the current one has played. */
function advanceChapters(l: Ledger): Ledger {
  let cur = l;
  while (cur.chapter <= FINAL_CHAPTER && BEATS.every((b) => b.chapter !== cur.chapter || hasSeen(cur, b.id))) {
    cur = { ...cur, chapter: cur.chapter + 1, chapterWrits: 0 };
  }
  return cur;
}

/** The hub scenes due on returning to the hub: at most `limit`, in order, each assuming the earlier ones have played. */
export function hubBeats(l: Ledger, limit = 2): Beat[] {
  const out: Beat[] = [];
  let cur = l;
  while (out.length < limit) {
    const b = pendingBeat(cur);
    if (!b || b.tier !== 'hub') break;
    out.push(b);
    cur = markBeatsSeen(cur, [b.id]);
  }
  return out;
}
