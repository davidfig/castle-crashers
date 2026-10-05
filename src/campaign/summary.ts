// What a finished run reports to the campaign, and how the Ledger absorbs it.
import { BEAT_BY_ID } from '../data/story/beats';
import { markBeatsSeen, type Ledger } from './ledger';

export type Outcome = 'won' | 'lost' | 'retreat';

export interface RunSummary {
  outcome: Outcome;
  /** Entered and daily seeds are sandboxes: they never touch the Ledger. */
  offLedger: boolean;
  region: string;
  /** The Writ was a milestone Writ. */
  milestone: boolean;
  /** The beat the run reserved, if any. */
  reserved?: string;
  /** Beats that actually played out. */
  beatsSeen: string[];
  /** Heads by mob name. */
  slain: Record<string, number>;
  spared: Record<string, number>;
  /** Mobs that had surrendered and were killed anyway. */
  betrayed: number;
  /** Class names in the party, in slot order. */
  party: string[];
  /** An ending reached in this run (Final Writ only). */
  ending?: string;
}

function addCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] ?? 0) + b[k];
  return out;
}

export function applyRunSummary(l: Ledger, s: RunSummary): Ledger {
  if (s.offLedger) return l;
  let n: Ledger = {
    ...l,
    runs: l.runs + 1,
    slain: addCounts(l.slain, s.slain),
    spared: addCounts(l.spared, s.spared),
    betrayed: l.betrayed + s.betrayed,
    party: s.party.length > 0 ? s.party : l.party,
    regions: s.outcome === 'won' && l.regions[s.region] !== 'quiet' ? { ...l.regions, [s.region]: 'cleared' } : l.regions,
    endings: s.ending && !l.endings.includes(s.ending) ? [...l.endings, s.ending] : l.endings,
    chapterWrits: l.chapterWrits + (s.outcome === 'won' && !s.milestone ? 1 : 0),
  };
  // A milestone only counts as played if the party won it; run and hub beats count as soon as they play.
  const played = s.beatsSeen.filter((id) => BEAT_BY_ID[id]?.tier !== 'milestone' || s.outcome === 'won');
  if (s.reserved && !played.includes(s.reserved)) {
    n = { ...n, missed: { ...n.missed, [s.reserved]: (n.missed[s.reserved] ?? 0) + 1 } };
  }
  return markBeatsSeen(n, played);
}
