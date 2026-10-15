// How a run on the road reports to the Ledger (docs/12-story.md, "Delivered across runs"): the Ledger's chapter tells the whole road, the
// beat it has pending is staged in it, and a finished run hands back what actually played. The sim never reads the Ledger.
import { CLASSES } from '../data/classes';
import { FINAL_CHAPTER } from '../data/story/chapters';
import type { Beat } from '../data/story/beats';
import type { GameState } from '../sim/state';
import { outcomeOf, slainByName, sparedByName } from './run';
import type { Ledger } from './ledger';
import { pendingBeat } from './ledger';
import type { RunSummary } from './summary';

/** The chapter a run is told in: the Ledger's (the last one once the campaign is over). */
export function runChapter(l: Ledger): number { return Math.min(Math.max(l.chapter, 1), FINAL_CHAPTER); }

/** The beat this run is meant to stage: the Ledger's pending one. */
export function runBeat(l: Ledger): Beat | undefined { return pendingBeat(l); }

/**
 * Whether the pending beat played in this run. Staged beats are read from the sim or from the scenes the party heard (`heard`: scene ids); a
 * hub beat (told in the old hub, now the town) plays once the party sets out; the rest have no scene yet and play on a win (interim, as in
 * `STUB_BEATS_PLAY_ON_WIN`; remove as each gets one).
 */
export function beatPlayedOnRoad(s: GameState, beat: Beat, won: boolean, heard: ReadonlySet<string>): boolean {
  switch (beat.id) {
    case 'R1': case 'R3': return s.beatPlayedTick >= 0;
    case 'warlord': return s.bossDeadTick >= 0;
    case 'R5': return heard.has('r5');
    default: return beat.tier === 'hub' ? !!s.road && !s.road.town : won;
  }
}

/** What a finished run on the road tells the Ledger. */
export function summarizeRoadRun(s: GameState, beat: Beat | undefined, retreated: boolean, heard: ReadonlySet<string>): RunSummary {
  const outcome = outcomeOf(s, retreated);
  return {
    outcome,
    offLedger: false,
    region: 'road',
    milestone: beat?.tier === 'milestone',
    reserved: beat?.id,
    beatsSeen: beat && beatPlayedOnRoad(s, beat, outcome === 'won', heard) ? [beat.id] : [],
    slain: slainByName(s),
    spared: sparedByName(s),
    betrayed: s.betrayed,
    party: s.players.filter((p) => p.active).map((p) => CLASSES[p.classId].name),
  };
}
