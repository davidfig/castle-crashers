// Plays a whole route (level, store, level, ... boss) with simulated players and reports how it went. It is the headless twin of the
// campaign flow in main.ts: the same level plans, the same stores, the same carry between sims, with no renderer, no audio and no
// wall clock, so a run costs only the sim (tens of thousands of ticks a second). A run is a pure function of its options.
import { CLASSES } from '../data/classes';
import { roadSceneFor, roadSceneT } from '../data/story/road';
import { stockFor, WARES, wareSpot, type StockItem } from '../data/wares';
import { MAX_PLAYERS, WARE_REACH_X, WARE_REACH_Y } from '../sim/constants';
import { applyCarry, arriveAt, captureCarry, restCarry, type Carry } from '../sim/carry';
import { Kind, ShrineKind } from '../sim/entities';
import { Ev, EV_STRIDE } from '../sim/events';
import { createInputFrame, Btn } from '../sim/input';
import { buy } from '../sim/shop';
import { SiteEv } from '../sim/sites';
import { activatePlayer, createSim, Phase, type GameState } from '../sim/state';
import { step } from '../sim/step';
import { levelPlan, LEVELS_PER_BIOME, ROUTE_LEVELS, type LevelPlan } from '../campaign/route';
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
  /** Stop a level after this many ticks and call it a timeout (a stuck player). Default 10 minutes of play. */
  maxLevelTicks?: number;
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

const TICKS_PER_LEVEL_CAP = 60 * 60 * 10;

function classIndex(c: number | string): number {
  if (typeof c === 'number') return c;
  const k = CLASSES.findIndex((d) => d.name === c);
  if (k < 0) throw new Error(`unknown class "${c}" (try ${CLASSES.map((d) => d.name).join(', ')})`);
  return k;
}

/** The sim for level `plan` (or the store after it), set up exactly as the game's campaign does. */
function makeSim(seed: number, plan: LevelPlan, index: number, total: number, store: boolean, carry: Carry | undefined, party: PartyMember[], heat: number): GameState {
  const nextBiome = store ? levelPlan(seed, Math.min(index + 1, total - 1), total).biome : undefined;
  const sc = store ? undefined : roadSceneFor(plan.chapter, index % LEVELS_PER_BIOME, plan.boss);
  const s = createSim(plan.seed, index === 0 && !store ? { id: 'R1' } : undefined, {
    surrender: plan.chapter >= 2,
    offerSeed: seed,
    boss: plan.boss,
    scale: plan.scale,
    heat,
    damage: plan.damage,
    mix: plan.mix,
    store,
    nextBiome,
    scene: sc ? { id: sc.id, t: roadSceneT(plan.seed) } : undefined,
  });
  if (carry) { applyCarry(s, carry); arriveAt(s, carry); }
  else {
    for (let k = 0; k < party.length && k < MAX_PLAYERS; k++) {
      s.players[k].classId = classIndex(party[k].classId);
      if (k === 0) s.ents.hp[s.players[0].ent] = s.ents.maxhp[s.players[0].ent] = CLASSES[s.players[0].classId].hp;
      else activatePlayer(s, k, 60, 40 + k * 40);
    }
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

function fieldEmpty(s: GameState): boolean {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] === Kind.Mob) return false;
  return true;
}

const WIND_DOWN_MIN = 24;
const WIND_DOWN_MAX = 180;

/** Play one whole route. */
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
  let carry: Carry | undefined;
  let last: GameState | undefined;

  for (let index = start; index < total; index++) {
    const plan = levelPlan(seed, index, total);
    const s = makeSim(seed, plan, index, total, false, carry, party, heat);
    if (index === start && opts.boost) for (const p of s.players) if (p.active) { p.level += opts.boost; p.pending += opts.boost; }
    last = s;
    const led = new Ledger(s);
    let t = 0;
    for (; t < cap && s.phase === Phase.Playing; t++) {
      for (let k = 0; k < party.length; k++) pilots[k].drive(s, inputs[k]);
      step(s, inputs);
      led.update(s);
      opts.onTick?.(s, index, pilots);
    }
    let outcome: Outcome = s.phase === Phase.Won ? 'won' : s.phase === Phase.Lost ? 'lost' : 'timeout';
    // a won level: what is left of the horde walks off before the field carries on into the store
    if (outcome === 'won' && index < total - 1) {
      const idle = Array.from({ length: MAX_PLAYERS }, createInputFrame);
      for (let w = 1; w < WIND_DOWN_MAX && !(w >= WIND_DOWN_MIN && fieldEmpty(s)); w++) { step(s, idle); led.update(s); }
    }
    report.ticks += s.tick;
    const lv: LevelReport = {
      index, biome: plan.biome, boss: plan.boss, seed: plan.seed, outcome, ticks: s.tick, kills: led.kills(s),
      progress: Math.round(100 * Math.min(1, s.camX / Math.max(1, s.worldW - 640))), goldGained: led.gold(s),
      damagePct: Math.round(led.damage * 100), lowestHp: Math.round(led.lowest * 100) / 100, downs: led.downs,
      chests: led.chests, shrines: led.shrines, potions: led.potions, levelUps: led.levelUps, by: roundAll(led.by),
    };
    report.levels.push(lv);
    for (let k = 0; k < MAX_PLAYERS; k++) { heroDamage[k] += led.perHero[k]; heroDowns[k] += led.heroDowns[k]; }
    if (outcome !== 'won') {
      report.outcome = outcome;
      const top = Object.entries(lv.by).sort((a, b) => b[1] - a[1])[0];
      report.death = { level: index, biome: plan.biome, progress: lv.progress, killer: top ? top[0] : outcome === 'timeout' ? 'stuck' : 'unknown' };
      break;
    }
    report.levelsCleared++;
    if (index === total - 1 || (opts.stopAfter !== undefined && index - start + 1 >= opts.stopAfter)) break;

    // --- the store between this level and the next
    carry = restCarry(captureCarry(s));
    const st = playStore(seed, plan, index, total, carry, party, heat, pilots, inputs, cap);
    report.stores.push(st.report);
    report.ticks += st.report.ticks;
    last = st.sim;
    carry = captureCarry(st.sim);
    if (st.report.timedOut) { report.outcome = 'timeout'; report.death = { level: index, biome: plan.biome, progress: 100, killer: 'stuck in store' }; break; }
  }

  if (last) {
    report.kills = last.kills;
    report.gold = last.gold;
    report.heroes = party.map((_, k) => {
      const p = last!.players[k];
      const boons: Record<string, number> = {};
      for (let i = 0; i < UPGRADES.length; i++) if (p.ranks[i] > 0) boons[UPGRADES[i].id] = p.ranks[i];
      return {
        classId: p.classId, className: CLASSES[p.classId].name, skill: skills[k].name, level: p.level, kills: p.kills,
        damageTaken: Math.round(heroDamage[k]), downs: heroDowns[k], boons, stats: pilots[k].stats,
      };
    });
  }
  return report;
}

function roundAll(o: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) out[k] = Math.round(v);
  return out;
}

/** The store after a level: the party shops and walks out the far end, as it would on the road. */
function playStore(seed: number, plan: LevelPlan, index: number, total: number, carry: Carry, party: PartyMember[], heat: number, pilots: Pilot[], inputs: ReturnType<typeof createInputFrame>[], cap: number): { sim: GameState; report: StoreReport } {
  const s = makeSim(seed, plan, index, total, true, carry, party, heat);
  const stock: StockItem[] = stockFor(seed, index);
  const sold = stock.map(() => false);
  const bought: string[] = [];
  const prevBtn: number[] = new Array(MAX_PLAYERS).fill(0);
  const panelBefore: boolean[] = new Array(MAX_PLAYERS).fill(false);
  for (const p of pilots) p.resetForStore();
  const gold0 = s.gold;
  let t = 0;
  for (; t < Math.min(cap, 60 * 60 * 6) && s.phase === Phase.Playing; t++) {
    const ctx: StoreCtx = { stock, sold, allDone: pilots.every((p, k) => p.storeDone && s.players[k].pending === 0) };
    for (let k = 0; k < pilots.length; k++) pilots[k].drive(s, inputs[k], ctx);
    s.players.forEach((p, k) => { panelBefore[k] = p.panel; });
    step(s, inputs);
    s.events.n = 0;
    for (let k = 0; k < MAX_PLAYERS; k++) {
      const edge = inputs[k].buttons & ~prevBtn[k];
      prevBtn[k] = inputs[k].buttons;
      if (!(edge & Btn.Interact) || panelBefore[k]) continue;
      const i = nearWare(s, k, stock);
      if (i < 0 || sold[i]) continue;
      if (buy(s, k, WARES[stock[i].ware], stock[i].price) === 'ok') { sold[i] = true; bought.push(`${CLASSES[s.players[k].classId].name}:${WARES[stock[i].ware].id}`); }
    }
  }
  return { sim: s, report: { index, ticks: s.tick, spent: Math.max(0, gold0 - s.gold), bought, timedOut: s.phase !== Phase.Won } };
}

/** The ware lying beside hero `k` (nearest first), or -1. Mirrors main.ts. */
function nearWare(s: GameState, k: number, stock: readonly StockItem[]): number {
  const p = s.players[k];
  if (!p.active || p.downed) return -1;
  let best = -1, bestD = Infinity;
  stock.forEach((_, i) => {
    const sp = wareSpot(i, stock.length);
    const dx = Math.abs(s.ents.x[p.ent] - sp.x), dy = Math.abs(s.ents.y[p.ent] - sp.y);
    if (dx < WARE_REACH_X && dy < WARE_REACH_Y && dx < bestD) { best = i; bestD = dx; }
  });
  return best;
}
