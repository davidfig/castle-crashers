// Plays a whole run with simulated players and reports how it went: the run's one road (docs/21-the-road.md), from the town through every
// level, road scene, camp and crossroads to the last boss, in one sim, as the game plays it, with no renderer, no audio and no wall clock,
// so a run costs only the sim (tens of thousands of ticks a second). The report is cut into the road's levels and camps, as it was when
// they were separate. A run is a pure function of its options.
import { CLASSES } from '../data/classes';
import { META, metaForRenown } from '../data/meta';
import { WARES } from '../data/wares';
import { MAX_PLAYERS } from '../sim/constants';
import { ShrineKind } from '../sim/entities';
import { roadJump, roadLevel, roadProgress } from '../sim/gen/road';
import { Ev, EV_STRIDE } from '../sim/events';
import { createInputFrame } from '../sim/input';
import { TradeEv } from '../sim/shop';
import { SiteEv } from '../sim/sites';
import { createSim, joinParty, Phase, resetHero, type GameState } from '../sim/state';
import { step } from '../sim/step';
import { ROUTE_LEVELS } from '../campaign/route';
import { UPGRADES } from '../data/upgrades';
import { Attribution } from './attribution';
import { Pilot, type StoreCtx } from './pilot';
import { resolveSkill, type Skill } from './skill';

export interface PartyMember {
  /** A class index, or its name ("warrior", "mage", "cleric", "rogue", "archer"). */
  classId: number | string;
  /** A preset name, a number on the 0..1 ladder, or a ready Skill. */
  skill: Skill | string | number;
}

export interface RunOptions {
  seed: number;
  party: PartyMember[];
  /** Levels in the route (default: the whole campaign, `ROUTE_LEVELS`). */
  levels?: number;
  /** First level to play (default 0). Later starts carry no build; combine with `boost` for a hero of the right strength. */
  startLevel?: number;
  /** The difficulty the party chose in the lobby (data/heat.ts). */
  heat?: number;
  /** Play at most this many levels from `startLevel`, then stop: the run counts as won if the party survived them all (a way to sample a stretch of the route). */
  stopAfter?: number;
  /** Give every hero this many level-ups to spend before the first level (for sampling later levels with a fitting build). */
  boost?: number;
  /** Stop a part of the road (a level, a camp) after this many ticks and call it a timeout (a stuck player). Default 15 minutes of play. */
  maxLevelTicks?: number;
  /** The road's horde size (default `ROAD_HORDE`): for tuning it with bot runs (`pnpm sim --horde=X`). */
  horde?: number;
  /** The bosses' health on the road (default `ROAD_BOSS_HP`): for tuning it (`pnpm sim --boss-hp=X`). */
  bossHp?: number;
  /** How hard the road hits (default `ROAD_HARD`) and how much renown the party has spent in the town before setting out (default none: the base game). */
  hard?: number;
  renown?: number;
  /** Ranks of the town's places by id ({ forge: 5 }), instead of a renown budget: to see what one place does. */
  meta?: Record<string, number>;
  /** Called after every tick of play with the state and the route level. */
  onTick?: (s: GameState, level: number, pilots: readonly Pilot[]) => void;
}

export type Outcome = 'won' | 'lost' | 'timeout';

export interface HeroReport {
  classId: number;
  className: string;
  skill: string;
  level: number;
  kills: number;
  damageTaken: number;
  downs: number;
  /** Boons held at the end: id -> rank. */
  boons: Record<string, number>;
  stats: Pilot['stats'];
}

export interface LevelReport {
  index: number;
  biome: number;
  boss: boolean;
  seed: number;
  outcome: Outcome;
  ticks: number;
  kills: number;
  /** How far across the field the camera got, 0..100. */
  progress: number;
  goldGained: number;
  /** Health lost by all heroes, as a share of one hero's full health (so a party of two that each lose half reads 100). */
  damagePct: number;
  /** Lowest health fraction any hero reached, and how many times a hero went down. */
  lowestHp: number;
  downs: number;
  chests: number;
  shrines: number;
  potions: number;
  levelUps: number;
  /** Health lost by what dealt it. */
  by: Record<string, number>;
}

export interface StoreReport { index: number; ticks: number; spent: number; bought: string[]; timedOut: boolean }

export interface RunReport {
  seed: number;
  outcome: Outcome;
  total: number;
  startLevel: number;
  levelsCleared: number;
  ticks: number;
  kills: number;
  gold: number;
  heat: number;
  levels: LevelReport[];
  stores: StoreReport[];
  heroes: HeroReport[];
  /** Where and to what the party fell (absent on a win). */
  death?: { level: number; biome: number; progress: number; killer: string };
}

/** A part of the road (a level, a camp) taking longer than this is a stuck player: a timeout. 15 minutes of play (a slow party's boss level on the road can take ten). */
const TICKS_PER_LEVEL_CAP = 60 * 60 * 15;

function classIndex(c: number | string): number {
  if (typeof c === 'number') return c;
  const k = CLASSES.findIndex((d) => d.name === c);
  if (k < 0) throw new Error(`unknown class "${c}" (try ${CLASSES.map((d) => d.name).join(', ')})`);
  return k;
}

/** The run's one road (docs/21-the-road.md), set up as the game sets it up, the party already in their classes in the town. */
function makeRoad(seed: number, total: number, party: PartyMember[], heat: number, horde?: number, bossHp?: number, hard?: number, renown = 0, metaNamed?: Record<string, number>): GameState {
  const s = createSim(seed, undefined, { road: { total, beat: { id: 'R1' }, horde, bossHp, hard, meta: metaNamed ? META.map((m) => Math.min(m.maxRank, metaNamed[m.id] ?? 0)) : metaForRenown(renown) }, heat, offerSeed: seed });
  for (let k = 0; k < party.length && k < MAX_PLAYERS; k++) {
    const c = classIndex(party[k].classId);
    if (k === 0) resetHero(s, 0, c);
    else { s.players[k].classId = c; joinParty(s, k, 60, 40 + k * 40); }
  }
  return s;
}

/** Tracks what happened during a level so the report can say what hurt. */
class Ledger {
  hp: number[] = [];
  damage = 0;
  lowest = 1;
  downs = 0;
  chests = 0;
  shrines = 0;
  potions = 0;
  levelUps = 0;
  /** What was bought (a camp's goods): "class:ware". */
  bought: string[] = [];
  by: Record<string, number> = {};
  perHero: number[] = [0, 0, 0, 0];
  heroDowns: number[] = [0, 0, 0, 0];
  private startGold: number;
  private startKills: number;
  constructor(s: GameState) {
    this.hp = s.players.map((p) => (p.active ? s.ents.hp[p.ent] : 0));
    this.startGold = s.gold;
    this.startKills = s.kills;
  }
  gold(s: GameState): number { return s.gold - this.startGold; }
  kills(s: GameState): number { return s.kills - this.startKills; }

  /** After a step: read the events, then the health that moved. */
  update(s: GameState): void {
    const ev = s.events;
    for (let k = 0; k < ev.n; k++) {
      const o = k * EV_STRIDE;
      const t = ev.data[o];
      if (t === Ev.PlayerDown) { this.downs++; this.heroDowns[ev.data[o + 3]]++; }
      else if (t === Ev.Trade && ev.data[o + 3] === TradeEv.Bought) {
        const i = ev.data[o + 4], k = ev.data[o + 5];
        this.bought.push(`${CLASSES[s.players[k].classId].name}:${WARES[s.wares[i].ware].id}`);
      }
      else if (t === Ev.Potion) this.potions++;
      else if (t === Ev.LevelUp) this.levelUps++;
      else if (t === Ev.Site) {
        const a = ev.data[o + 3], b = ev.data[o + 4];
        if (a === SiteEv.Done && b === ShrineKind.Greed) this.attr.greedTick = s.tick;
        if (a === SiteEv.Open) this.chests++;
        else if (a === SiteEv.Start || (a === SiteEv.Done && (b === ShrineKind.Greed || b === ShrineKind.Mercy))) this.shrines++;
      }
    }
    ev.n = 0;
    const e = s.ents;
    for (let k = 0; k < s.players.length; k++) {
      const p = s.players[k];
      if (!p.active) continue;
      const hp = e.hp[p.ent];
      const prev = this.hp[k] ?? hp;
      const maxHp = CLASSES[p.classId].hp;
      if (hp < prev - 1e-9) {
        const d = prev - hp;
        this.damage += d / maxHp;
        this.perHero[k] += d;
        const src = this.attribute(s, k, d);
        this.by[src] = (this.by[src] ?? 0) + d;
      }
      this.hp[k] = hp;
      if (!p.downed) this.lowest = Math.min(this.lowest, hp / maxHp);
      else this.lowest = 0;
    }
    this.attr.snapshot(s);
  }

  private attr = new Attribution();
  private attribute(s: GameState, k: number, dmg: number): string { return this.attr.explain(s, k, dmg); }
}

/** Which part of the road the camera is in, for the report: the town, a level (with its road scene), or the camp and crossroads after it. */
function partOf(s: GameState): { level: number; kind: 'town' | 'level' | 'camp' } {
  const r = s.road!;
  const calm = r.calm >= 0 ? r.layout.calm[r.calm].kind : '';
  return { level: r.level, kind: calm === 'town' ? 'town' : calm === 'camp' || calm === 'fork' ? 'camp' : 'level' };
}

/** Play one whole run: its road from the town to the last boss, in one sim. */
export function runRoute(opts: RunOptions): RunReport {
  const seed = opts.seed >>> 0;
  const total = Math.max(1, Math.min(ROUTE_LEVELS, opts.levels ?? ROUTE_LEVELS));
  const start = Math.max(0, Math.min(total - 1, opts.startLevel ?? 0));
  const heat = opts.heat ?? 0;
  const cap = opts.maxLevelTicks ?? TICKS_PER_LEVEL_CAP;
  const party = opts.party.slice(0, MAX_PLAYERS);
  if (party.length === 0) throw new Error('a run needs at least one hero');
  const skills = party.map((m) => resolveSkill(m.skill));
  const pilots = party.map((_, k) => new Pilot(k, skills[k], seed));
  const inputs = Array.from({ length: MAX_PLAYERS }, createInputFrame);
  const report: RunReport = { seed, outcome: 'won', total, startLevel: start, levelsCleared: 0, ticks: 0, kills: 0, gold: 0, heat, levels: [], stores: [], heroes: [], };
  const heroDamage = [0, 0, 0, 0], heroDowns = [0, 0, 0, 0];
  const s = makeRoad(seed, total, party, heat, opts.horde, opts.bossHp, opts.hard, opts.renown, opts.meta);
  if (start > 0) roadJump(s, start);
  if (opts.boost) for (const p of s.players) if (p.active) { p.level += opts.boost; p.pending += opts.boost; }

  let part = partOf(s), led = new Ledger(s), since = s.tick, gold0 = s.gold, stopped = false;
  /** The part of the road just left (or the one the run ended in): its report. */
  const close = (outcome: Outcome): void => {
    const ticks = s.tick - since;
    for (let k = 0; k < MAX_PLAYERS; k++) { heroDamage[k] += led.perHero[k]; heroDowns[k] += led.heroDowns[k]; }
    if (part.kind === 'camp') {
      report.stores.push({ index: part.level, ticks, spent: Math.max(0, gold0 - s.gold), bought: led.bought, timedOut: outcome === 'timeout' });
      if (outcome !== 'won') { report.outcome = outcome; report.death = { level: part.level, biome: s.biome, progress: 100, killer: outcome === 'timeout' ? 'stuck in camp' : 'unknown' }; }
      return;
    }
    if (part.kind === 'town') {
      if (outcome === 'timeout') { report.outcome = 'timeout'; report.death = { level: 0, biome: s.biome, progress: 0, killer: 'stuck in town' }; }
      return;
    }
    const lp = roadLevel(s.road!, part.level);
    const lv: LevelReport = {
      index: part.level, biome: lp.biome, boss: lp.boss, seed: lp.seed, outcome, ticks, kills: led.kills(s),
      progress: outcome === 'won' ? 100 : Math.round(100 * roadProgress(s)), goldGained: led.gold(s),
      damagePct: Math.round(led.damage * 100), lowestHp: Math.round(led.lowest * 100) / 100, downs: led.downs,
      chests: led.chests, shrines: led.shrines, potions: led.potions, levelUps: led.levelUps, by: roundAll(led.by),
    };
    report.levels.push(lv);
    if (outcome === 'won') report.levelsCleared++;
    else {
      report.outcome = outcome;
      const top = Object.entries(lv.by).sort((a, b) => b[1] - a[1])[0];
      report.death = { level: part.level, biome: lp.biome, progress: lv.progress, killer: top ? top[0] : outcome === 'timeout' ? 'stuck' : 'unknown' };
    }
  };

  while (s.phase === Phase.Playing) {
    if (s.tick - since > cap) { close('timeout'); stopped = true; break; }
    const ctx: StoreCtx | undefined = s.road!.camp ? { allDone: pilots.every((p, k) => p.storeDone && s.players[k].pending === 0) } : undefined;
    for (let k = 0; k < party.length; k++) pilots[k].drive(s, inputs[k], ctx);
    step(s, inputs);
    led.update(s);
    opts.onTick?.(s, s.road!.level, pilots);
    const now = partOf(s);
    if (now.level !== part.level || now.kind !== part.kind) {
      close('won'); // walked on: the part behind was come through
      if (opts.stopAfter !== undefined && report.levelsCleared >= opts.stopAfter) { stopped = true; break; }
      part = now; led = new Ledger(s); since = s.tick; gold0 = s.gold;
    }
  }
  if (!stopped) close(s.phase === Phase.Won ? 'won' : 'lost');
  report.ticks = s.tick;
  report.kills = s.kills;
  report.gold = s.gold;
  report.heroes = party.map((_, k) => {
    const p = s.players[k];
    const boons: Record<string, number> = {};
    for (let i = 0; i < UPGRADES.length; i++) if (p.ranks[i] > 0) boons[UPGRADES[i].id] = p.ranks[i];
    return {
      classId: p.classId, className: CLASSES[p.classId].name, skill: skills[k].name, level: p.level, kills: p.kills,
      damageTaken: Math.round(heroDamage[k]), downs: heroDowns[k], boons, stats: pilots[k].stats,
    };
  });
  return report;
}

function roundAll(o: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) out[k] = Math.round(v);
  return out;
}
