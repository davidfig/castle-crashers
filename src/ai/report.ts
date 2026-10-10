// Rolls many runs of one scenario up into the numbers a balance pass looks at: how often the party wins, where it dies, how hard each
// level hits, and what does the hitting. Pure; the CLI (tools/sim.mjs) prints it and the tests check it.
import type { RunReport } from './runner';

export interface LevelSummary {
  index: number;
  biome: number;
  boss: boolean;
  /** Runs that got as far as this level, and the share of all runs. */
  reached: number;
  reachedPct: number;
  /** Of those, how many cleared it. */
  cleared: number;
  clearPct: number;
  timeouts: number;
  /** Means over the runs that played it. */
  seconds: number;
  damagePct: number;
  lowestHp: number;
  downs: number;
  kills: number;
  gold: number;
  /** Health lost by source, averaged over the runs that played the level, biggest first. */
  killers: [string, number][];
}

export interface Summary {
  runs: number;
  wins: number;
  winPct: number;
  /** Mean levels cleared, and the median level a losing run ended on. */
  levelsCleared: number;
  medianDeathLevel: number | null;
  minutes: number;
  kills: number;
  finalLevel: number;
  downsPerRun: number;
  timeouts: number;
  levels: LevelSummary[];
  /** What ended the losing runs, most common first. */
  killers: [string, number][];
  /** Boons taken, by how many heroes ended with each, most common first. */
  boons: [string, number][];
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarize(reports: readonly RunReport[]): Summary {
  const runs = reports.length;
  const wins = reports.filter((r) => r.outcome === 'won').length;
  const deaths = reports.filter((r) => r.outcome !== 'won' && r.death).map((r) => r.death!.level).sort((a, b) => a - b);
  const maxLevel = Math.max(0, ...reports.flatMap((r) => r.levels.map((l) => l.index)));
  const levels: LevelSummary[] = [];
  for (let index = 0; index <= maxLevel; index++) {
    const plays = reports.flatMap((r) => r.levels.filter((l) => l.index === index));
    if (plays.length === 0) continue;
    const by = new Map<string, number>();
    for (const l of plays) for (const [k, v] of Object.entries(l.by)) by.set(k, (by.get(k) ?? 0) + v);
    levels.push({
      index, biome: plays[0].biome, boss: plays[0].boss,
      reached: plays.length, reachedPct: (100 * plays.length) / runs,
      cleared: plays.filter((l) => l.outcome === 'won').length,
      clearPct: (100 * plays.filter((l) => l.outcome === 'won').length) / plays.length,
      timeouts: plays.filter((l) => l.outcome === 'timeout').length,
      seconds: mean(plays.map((l) => l.ticks / 60)),
      damagePct: mean(plays.map((l) => l.damagePct)),
      lowestHp: mean(plays.map((l) => l.lowestHp)),
      downs: mean(plays.map((l) => l.downs)),
      kills: mean(plays.map((l) => l.kills)),
      gold: mean(plays.map((l) => l.goldGained)),
      killers: [...by.entries()].map(([k, v]): [string, number] => [k, v / plays.length]).sort((a, b) => b[1] - a[1]).slice(0, 6),
    });
  }
  const killers = new Map<string, number>();
  for (const r of reports) if (r.death) killers.set(r.death.killer, (killers.get(r.death.killer) ?? 0) + 1);
  const boons = new Map<string, number>();
  for (const r of reports) for (const h of r.heroes) for (const id of Object.keys(h.boons)) boons.set(id, (boons.get(id) ?? 0) + 1);
  return {
    runs, wins, winPct: runs ? (100 * wins) / runs : 0,
    levelsCleared: mean(reports.map((r) => r.levelsCleared)),
    medianDeathLevel: deaths.length ? deaths[Math.floor(deaths.length / 2)] : null,
    minutes: mean(reports.map((r) => r.ticks / 3600)),
    kills: mean(reports.map((r) => r.kills)),
    finalLevel: mean(reports.flatMap((r) => r.heroes.map((h) => h.level))),
    downsPerRun: mean(reports.map((r) => r.heroes.reduce((a, h) => a + h.downs, 0))),
    timeouts: reports.filter((r) => r.outcome === 'timeout').length,
    levels,
    killers: [...killers.entries()].sort((a, b) => b[1] - a[1]),
    boons: [...boons.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export interface CurveRow extends LevelSummary {
  /** Players lost at this level, as a share of the runs that reached it. */
  deathPct: number;
  /** "HARD" or "EASY" against the other levels of the same sort (bosses are compared with bosses), or "". */
  flag: '' | 'HARD' | 'EASY';
  /** Damage taken relative to the median of its sort. */
  vsMedian: number;
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * The difficulty curve of a route over every run given (pool the classes and skills you want to compare): per level, how much it hurt, how
 * long it took and how often it ended the run, with the levels that stand out marked. A boss level is only ever compared with other bosses.
 */
export function difficultyCurve(reports: readonly RunReport[]): CurveRow[] {
  const levels = summarize(reports).levels;
  const medians = new Map<boolean, number>();
  for (const boss of [false, true]) medians.set(boss, median(levels.filter((l) => l.boss === boss && l.reached >= 3).map((l) => l.damagePct)));
  return levels.map((l): CurveRow => {
    const m = medians.get(l.boss) || 1;
    const vsMedian = l.damagePct / m;
    const deathPct = l.reached ? 100 - l.clearPct : 0;
    const flag = l.reached < 3 ? '' : vsMedian > 1.5 || deathPct > 20 ? 'HARD' : vsMedian < 0.5 ? 'EASY' : '';
    return { ...l, deathPct, flag, vsMedian };
  });
}
