// A Writ: the contract that frames a run (docs/12-story.md, "The Writ is the run's contract").
// A Writ is a pure function of (seed, chapter), so the same board entry always means the same run.
import { createRng, rngInt, Stream } from '../../engine/rng';
import { chapterDef, FINAL_CHAPTER } from './chapters';
import { makeClan, pick, type Clan } from './clan';

/** The run modifiers from docs/07-procgen.md, written as contract clauses. */
export const CLAUSES = {
  swarm: { name: 'Nest Clearance', mod: 'swarm', text: 'More targets, each weaker.', bonusPct: 25 },
  glass: { name: 'Hazard Pay', mod: 'glassCannons', text: 'Everyone takes more damage.', bonusPct: 30 },
  cursed: { name: 'Tainted Spoils', mod: 'cursedLoot', text: 'Some loot is cursed.', bonusPct: 20 },
} as const;
export type ClauseId = keyof typeof CLAUSES;
const CLAUSE_IDS = Object.keys(CLAUSES) as ClauseId[];

export interface Region {
  id: string;
  name: string;
  /** Index into BIOMES. */
  biome: number;
}

/** Only the Meadow has art so far. */
export const REGIONS: readonly Region[] = [
  { id: 'meadow', name: 'The Meadow', biome: 0 },
];

export interface Writ {
  /** Stable for a (seed, chapter). */
  id: string;
  /** The run seed. */
  seed: number;
  chapter: number;
  region: string;
  title: string;
  clan: Clan;
  /** Heads the Writ asks for. */
  quota: number;
  clauses: ClauseId[];
  payoutPct: number;
  /** Set when this Writ is a milestone Writ: the id of the beat it is built around. */
  milestone?: string;
}

export function writFromSeed(seed: number, chapter: number): Writ {
  const ch = Math.min(Math.max(chapter, 1), FINAL_CHAPTER);
  // The Writ's own rolls use a sub-stream of `story`, so they never depend on how many draws makeClan makes.
  const w = createRng((seed ^ 0x5bd1e995) >>> 0, Stream.story);
  const clan = makeClan(seed);
  const region = pick(w, REGIONS);
  const quota = 600 + 50 * rngInt(w, 13); // 600..1200
  const roll = rngInt(w, 100);
  const nClauses = roll < 40 ? 0 : roll < 85 ? 1 : 2;
  const pool = [...CLAUSE_IDS];
  const clauses: ClauseId[] = [];
  for (let i = 0; i < nClauses; i++) clauses.push(pool.splice(rngInt(w, pool.length), 1)[0]);
  let bonus = 100;
  for (const c of clauses) bonus += CLAUSES[c].bonusPct;
  const lex = chapterDef(ch).lexicon;
  return {
    id: `w${seed.toString(16)}-${ch}`,
    seed,
    chapter: ch,
    region: region.id,
    title: `${lex.act} ${lex.foe} at ${clan.place}`,
    clan,
    quota,
    clauses,
    payoutPct: Math.round((bonus * chapterDef(ch).payoutPct) / 100),
  };
}

/** The lines the Writ board shows for a Writ, in the chapter's wording. */
export function writLines(w: Writ): string[] {
  const lex = chapterDef(w.chapter).lexicon;
  const lines = [w.title, `${lex.noun}: ${w.quota}`];
  for (const c of w.clauses) lines.push(`${CLAUSES[c].name}: ${CLAUSES[c].text}`);
  lines.push(`Pays x${(w.payoutPct / 100).toFixed(2)}`);
  return lines;
}
