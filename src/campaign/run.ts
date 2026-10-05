// Turns a finished sim into the summary the campaign layer applies to the Ledger.
import { CLASSES } from '../data/classes';
import { MOBS } from '../data/mobs';
import { BYSTANDER, Kind, SURRENDERED } from '../sim/entities';
import { Phase, type GameState } from '../sim/state';
import type { RunConfig } from './board';
import type { Outcome, RunSummary } from './summary';

/**
 * Interim, until every beat has a scene: the battlefield stages R1 and the Warlord's death is the first milestone, but
 * the other beats have nothing to play yet. They count as played when their run is won, so the campaign does not stall.
 * Remove as each beat gets a scene (docs/12-story.md, roadmap).
 */
export const STUB_BEATS_PLAY_ON_WIN = true;

export function outcomeOf(s: GameState, retreated: boolean): Outcome {
  if (s.phase === Phase.Won) return 'won';
  if (s.phase === Phase.Lost) return 'lost';
  return retreated ? 'retreat' : 'lost';
}

export function slainByName(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < MOBS.length; i++) if (s.slain[i] > 0) out[MOBS[i].name] = s.slain[i];
  return out;
}

/**
 * Who the party left alone: mobs that surrendered and got away, mobs still kneeling at the end, and the R1 bystanders
 * still standing once the party had reached them (leaving them be counts; an AoE that clips them does not).
 */
export function sparedByName(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (type: number, n: number) => { if (n > 0) out[MOBS[type].name] = (out[MOBS[type].name] ?? 0) + n; };
  for (let t = 0; t < MOBS.length; t++) add(t, s.spared[t]);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i] || e.kind[i] !== Kind.Mob) continue;
    if (e.flags[i] & SURRENDERED) add(e.sub[i], 1);
    else if ((e.flags[i] & BYSTANDER) && s.beatPlayedTick >= 0) add(e.sub[i], 1);
  }
  return out;
}

/** Did the run actually play this beat? Staged beats are read from the sim; the rest follow the interim rule above. */
export function beatPlayed(s: GameState, id: string, outcome: Outcome, stub: boolean): boolean {
  if (id === 'R1' || id === 'R3') return s.beatPlayedTick >= 0;
  if (id === 'warlord') return s.bossDeadTick >= 0;
  return stub && outcome === 'won';
}

/** `alsoPlayed` are beats an earlier level of the route already played (a route is several sims). */
export function summarizeRun(s: GameState, cfg: RunConfig, retreated: boolean, stubBeats = STUB_BEATS_PLAY_ON_WIN, alsoPlayed: readonly string[] = []): RunSummary {
  const outcome = outcomeOf(s, retreated);
  const reserved = cfg.reservedBeat?.id;
  return {
    outcome,
    offLedger: cfg.offLedger,
    region: cfg.writ.region,
    milestone: cfg.writ.milestone !== undefined,
    reserved,
    beatsSeen: reserved && (alsoPlayed.includes(reserved) || beatPlayed(s, reserved, outcome, stubBeats)) ? [reserved] : [],
    slain: slainByName(s),
    spared: sparedByName(s),
    betrayed: s.betrayed,
    party: s.players.filter((p) => p.active).map((p) => CLASSES[p.classId].name),
  };
}
