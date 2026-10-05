// The authored beats of the main story, in story order (docs/12-story.md, "Delivering the beats").
// Which beat is pending is a pure function of the Ledger (src/campaign); nothing here is rolled.

export type Tier = 'hub' | 'run' | 'milestone';
/** The node type the run generator reserves for a run or milestone beat. */
export type BeatNode = 'witness' | 'combat' | 'treasure' | 'boss';

export interface Beat {
  id: string;
  chapter: number;
  tier: Tier;
  title: string;
  summary: string;
  /** Beats that must have played first. Every beat requires its predecessor, so the story is a single chain. */
  requires: readonly string[];
  /** Ordinary Writs won in this chapter before the beat becomes pending (starting targets, to tune). */
  minWrits: number;
  /** Run and milestone beats: the node type to reserve, and which biome of the run it is placed in. */
  node?: BeatNode;
  biome?: number;
  /** Further revelations that play out in the same scene. */
  grants?: readonly string[];
}

export const BEATS: readonly Beat[] = [
  // I — The Bounty
  { id: 'R1', chapter: 1, tier: 'run', title: 'The one that did not attack', summary: 'A mob stands by its cookfire and does not attack.', requires: [], minWrits: 1, node: 'combat' },
  { id: 'warlord', chapter: 1, tier: 'milestone', title: "The Warlord's Writ", summary: 'The Orc Warlord falls. His retinue were bodyguards for a column of families.', requires: ['R1'], minWrits: 2, node: 'boss' },
  // II — Doubt
  { id: 'R2', chapter: 2, tier: 'run', title: 'Carts and children', summary: 'Some of them carry children and carts.', requires: ['warlord'], minWrits: 1, node: 'witness' },
  { id: 'R3', chapter: 2, tier: 'run', title: 'They surrender', summary: 'An enemy surrenders, and the party can choose.', requires: ['R2'], minWrits: 2, node: 'combat' },
  { id: 'R4', chapter: 2, tier: 'milestone', title: 'A voice in the smoke', summary: 'A mid-boss speaks plainly to the party.', requires: ['R3'], minWrits: 3, node: 'boss' },
  // III — The Ledger
  { id: 'R5', chapter: 3, tier: 'run', title: 'The quotas', summary: 'The bounty quotas predate any attack.', requires: ['R4'], minWrits: 0, node: 'treasure' },
  { id: 'R6', chapter: 3, tier: 'hub', title: 'The map', summary: 'A map of the cities spreading over their land.', requires: ['R5'], minWrits: 1 },
  { id: 'R7', chapter: 3, tier: 'milestone', title: "The Elder's Writ", summary: 'The Elder asks the party to stop, and knew the Registrar by name.', requires: ['R6'], minWrits: 3, node: 'boss' },
  // IV — Complicity
  { id: 'R8', chapter: 4, tier: 'hub', title: 'Paid by the head, paid more for the helpless', summary: 'The Writ pays more for targets who are not fighting.', requires: ['R7'], minWrits: 1 },
  { id: 'R9', chapter: 4, tier: 'milestone', title: 'The Quiet Writ', summary: 'A cleared region, revisited: empty, with the dead where they fell.', requires: ['R8'], minWrits: 3, node: 'witness' },
  // V — Reckoning
  { id: 'R10', chapter: 5, tier: 'hub', title: 'The last settlement', summary: "The Registrar explains the final Writ.", requires: ['R9'], minWrits: 0 },
  { id: 'R11', chapter: 5, tier: 'milestone', title: 'The Final Writ', summary: 'No one is left outside the last settlement, and the party may decline.', requires: ['R10'], minWrits: 1, node: 'boss', grants: ['R12'] },
  { id: 'R12', chapter: 5, tier: 'milestone', title: 'The last of them', summary: 'The Final Writ is the last.', requires: ['R11'], minWrits: 0, node: 'boss' },
];

export const BEAT_BY_ID: Readonly<Record<string, Beat>> = Object.fromEntries(BEATS.map((b) => [b.id, b]));
