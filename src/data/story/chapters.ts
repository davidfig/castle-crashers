// The five chapters of the campaign (docs/12-story.md). A chapter changes the context of the same procedural runs:
// what the humans call the targets, and how much the Writ pays.

export const FINAL_CHAPTER = 5;

export interface Lexicon {
  /** What the Writ calls its targets. */
  foe: string;
  /** The verb on the Writ's title: "<act> <foe> at <place>". */
  act: string;
  /** What the payout is called. */
  noun: string;
  /** The end-of-run head count label. */
  tally: string;
}

export interface ChapterDef {
  name: string;
  lexicon: Lexicon;
  /** Percent multiplier on a Writ's payout (chapter IV pays more, which is the point). */
  payoutPct: number;
}

/** Index = chapter - 1. */
export const CHAPTERS: readonly ChapterDef[] = [
  { name: 'The Bounty', lexicon: { foe: 'vermin', act: 'Hunt', noun: 'Bounty', tally: 'Bounty collected' }, payoutPct: 100 },
  { name: 'Doubt', lexicon: { foe: 'beasts', act: 'Clear', noun: 'Bounty', tally: 'Bounty collected' }, payoutPct: 105 },
  { name: 'The Ledger', lexicon: { foe: 'hostiles', act: 'Pacify', noun: 'Clearance', tally: 'Clearance rendered' }, payoutPct: 115 },
  { name: 'Complicity', lexicon: { foe: 'cohorts', act: 'Resettle', noun: 'Quota', tally: 'Quota met' }, payoutPct: 160 },
  { name: 'Reckoning', lexicon: { foe: 'the remainder', act: 'Close', noun: 'Tally', tally: 'Final tally' }, payoutPct: 200 },
];

export function chapterDef(chapter: number): ChapterDef {
  return CHAPTERS[Math.min(Math.max(chapter, 1), FINAL_CHAPTER) - 1];
}
