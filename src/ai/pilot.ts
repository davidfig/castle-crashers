// A simulated player: it sees the screen the way a person does (perceive.ts, threats.ts), makes a plan for its class (tactics.ts), and
// presses the same buttons a pad would (one InputFrame a tick). `Skill` (skill.ts) sets how well it does all of that.
//
//   const pilot = new Pilot(slot, skill, seed);
//   pilot.drive(state, inputs[slot]);          // before every step()
import { MOBS, Behavior } from '../data/mobs';
import { MAX_LEVEL, UPGRADES } from '../data/upgrades';
import type { StockItem } from '../data/wares';
import { WARES, wareSpot } from '../data/wares';
import { cosTurns, sinTurns } from '../engine/math';
import { createRng, rngFloat, rngInt, type Rng } from '../engine/rng';
import { VIEW_W, WARE_REACH_X, WARE_REACH_Y, WORLD_H } from '../sim/constants';
import { costMul, rankOf } from '../sim/abilityMods';
import { Kind, ShrineKind } from '../sim/entities';
import { Btn, type InputFrame } from '../sim/input';
import { heroOffer } from '../sim/offers';
import { chestCost, SiteState } from '../sim/sites';
import { Phase, type GameState } from '../sim/state';
import { cardScore } from './cards';
import { createView, isPriority, look, scanWorld, strikeIn, type Scan, type View } from './perceive';
import type { Skill } from './skill';
import { TACTICS } from './tactics';
import { collectThreats, Memory, Threats } from './threats';

/** What the shop looks like to the pilots in a store: the stock on the ground and what has sold. */
export interface StoreCtx {
  stock: readonly StockItem[];
  sold: readonly boolean[];
  /** Every hero is finished shopping: the party can walk on. */
  allDone: boolean;
}

/** What a tactic asks of the pilot this tick. */
export interface Plan {
  hasGoal: boolean; gx: number; gy: number;
  hasAim: boolean; ax: number; ay: number;
  /** Hold the basic attack (for the cleric: wants the aura on). */
  attack: boolean;
  special: boolean;
  nova: boolean;
  /** Dodge now, in the steering's chosen direction (or `rollX/rollY` when set). */
  roll: boolean;
  rollX: number; rollY: number;
  /** Keep the dodge button held this many more ticks (a warrior's charge keeps going while it is). */
  holdRoll: number;
}

function newPlan(): Plan {
  return { hasGoal: false, gx: 0, gy: 0, hasAim: false, ax: 0, ay: 0, attack: false, special: false, nova: false, roll: false, rollX: 0, rollY: 0, holdRoll: 0 };
}

/** Candidate steering directions: 16 round the compass, then standing still. */
const DIRS = 16;
const DIR_X = new Float64Array(DIRS + 1), DIR_Y = new Float64Array(DIRS + 1);
for (let k = 0; k < DIRS; k++) { DIR_X[k] = cosTurns(k / DIRS); DIR_Y[k] = sinTurns(k / DIRS); }

/** Lookahead (ticks) for judging where a move leaves the hero relative to its goal. */
const GOAL_T = 14;
/** Pixels of detour a point of health is worth, for a 100-health hero. */
const PX_PER_HP = 4.5;

export class Pilot {
  readonly slot: number;
  readonly skill: Skill;
  readonly rng: Rng;
  readonly view: View = createView();
  readonly threats = new Threats();
  readonly mem: Memory;
  readonly plan: Plan = newPlan();
  s!: GameState;
  scan!: Scan;

  // target (entity index, and its numbers refreshed every tick)
  te = -1; tk = -1; tx = 0; ty = 0; td = 0;
  private targetAt = -999;
  /** A class that fights with a blade or an aura rather than from range. */
  get meleeKit(): boolean { const c = this.view.cls; return !c.shot && !c.specialShot; }
  private tempoAt = -999;
  /** The aim miss for this stretch (turns), the ability roll for this stretch, and the dodge roll for this stretch. */
  aimErr = 0;
  abilityOk = true;
  dodgeOk = true;
  /** Resting to get stamina back before fighting again. */
  recovering = false;
  /** Backing away to pull a foe out from behind a shut gate. */
  luring = false;
  /** Tick the rogue last slipped out of sight (the wait for a better ambush is capped). */
  hiddenSince = 0;
  wasHidden = false;
  /** Cached cluster result for tactics. */
  clusterK = -1; clusterN = 0; clusterAt = -999;

  private prev = 0;
  private lastDir = DIRS;
  private dodgeHold = 0;
  private panelWait = -1;
  private stickCool = 0;
  private lastHp = 0;
  /** Ticks held at a shut gate with nothing to fight. */
  private gateWait = 0;
  private pulling = 0;
  /** A careful player who shut the panel on a fight does not reopen it for a while. */
  private panelCool = 0;
  /** The coin, chest or shrine being walked to (an entity slot, or -1), until when, when a new one was last looked for, and ones given up on. */
  private loot = -1;
  private lootUntil = 0;
  private lootLook = -999;
  private ignore = new Map<number, number>();
  /** Ticks of quiet so far (see `drive`). */
  calm = 0;
  /** Shopping progress. */
  storeDone = false;
  private shopWant = -1;
  private shopTries = 0;
  private interactCool = 0;

  // stats for reports
  stats = { rolls: 0, novas: 0, specials: 0, picks: 0, rerolls: 0, banishes: 0, panelClosed: 0, potions: 0 };

  constructor(slot: number, skill: Skill, seed: number) {
    this.slot = slot;
    this.skill = skill;
    this.rng = createRng(seed ^ Math.imul(slot + 1, 0x9e3779b1), 77);
    this.mem = new Memory(seed ^ Math.imul(slot + 7, 0x85ebca6b));
  }

  /** A fresh sim (the next level, or the store): forget what was seen and chosen in the last one, keep the person. */
  private newSim(): void {
    this.mem.last.fill(-5);
    this.te = -1; this.tk = -1;
    this.loot = -1; this.ignore.clear();
    this.recovering = false; this.luring = false; this.wasHidden = false;
    this.panelWait = -1; this.dodgeHold = 0; this.stickCool = 0;
    this.targetAt = -999; this.tempoAt = -999; this.lootLook = -999;
    this.calm = 0; this.lastHp = 0; this.panelCool = 0; this.gateWait = 0; this.pulling = 0;
    this.storeDone = false; this.shopWant = -1; this.shopTries = 0; this.interactCool = 0;
    this.prev = 0;
  }

  // ---------------------------------------------------------------------------------------------
  // The tick

  drive(s: GameState, out: InputFrame, store?: StoreCtx): void {
    if (this.s !== s) this.newSim();
    this.s = s;
    out.buttons = 0; out.moveX = 0; out.moveY = 0; out.aimX = 0; out.aimY = 0;
    const p = s.players[this.slot];
    if (!p.active) { this.prev = 0; return; }
    if (p.downed || s.phase !== Phase.Playing) { this.prev = 0; this.panelWait = -1; return; }
    this.scan = scanWorld(s);
    look(s, this.slot, this.view);
    collectThreats(this.threats, s, this.scan, this.mem, this.skill);
    const v = this.view;
    if (this.stickCool > 0) this.stickCool--;
    if (this.interactCool > 0) this.interactCool--;
    // how long it has been quiet: nothing about to land, nothing biting, no one in arm's reach
    const hp = s.ents.hp[p.ent];
    if (hp < this.lastHp - 1e-9 || this.threats.n > 0 || v.c24 > 0) this.calm = 0; else this.calm++;
    this.lastHp = hp;

    // --- the level-up panel
    if (p.panel) { this.operatePanel(s, p, out); this.finish(out); return; }
    this.panelWait = -1;
    if (p.pending > 0 && !p.lock && this.wantsPanel(s, p)) { this.tap(out, Btn.Level); this.finish(out); return; }

    // --- decisions are refreshed at the player's tempo; the body is steered every tick
    if (s.tick - this.tempoAt >= Math.max(1, Math.round(this.skill.tempo))) {
      this.tempoAt = s.tick;
      this.aimErr = (rngFloat(this.rng) * 2 - 1) * this.skill.aimError;
      this.abilityOk = rngFloat(this.rng) < this.skill.abilityUse;
      this.dodgeOk = rngFloat(this.rng) < this.skill.dodge;
    }

    const plan = this.plan;
    plan.hasGoal = false; plan.hasAim = false; plan.attack = false; plan.special = false; plan.nova = false; plan.roll = false; plan.holdRoll = 0;
    this.clusterAt = -999;

    if (s.store) this.storeBrain(s, p, store);
    else {
      this.chooseTarget(s);
      if (this.te >= 0) TACTICS[v.cls.name]?.(this, s);
      else this.explore(s, p);
      // a plan can be overridden by staying alive: flasks when hurt, a resting stop when winded
      this.survive(s, p);
    }

    this.act(s, p, out);
    // After a pick the sim mutes the buttons that made it until they are all let go: a player lets go
    if (p.lock) out.buttons = 0;
    this.finish(out);
  }

  private finish(out: InputFrame): void { this.prev = out.buttons; }

  /** Press `btn` this tick if it was not down last tick (a press is an edge; holding does nothing more). */
  tap(out: InputFrame, btn: number): boolean {
    if (this.prev & btn) return false;
    out.buttons |= btn;
    return true;
  }

  // ---------------------------------------------------------------------------------------------
  // Targets

  private chooseTarget(s: GameState): void {
    const v = this.view;
    const e = s.ents;
    // keep the current target while it lasts, unless it is time to think again
    if (this.te >= 0 && s.tick - this.targetAt < Math.max(1, Math.round(this.skill.tempo * 1.5))) {
      let k = -1;
      for (let q = 0; q < v.n; q++) if (v.idx[q] === this.te) { k = q; break; }
      if (k >= 0 && e.alive[this.te]) { this.setTarget(k); return; }
    }
    this.targetAt = s.tick;
    let best = -1, bestScore = -Infinity;
    const lim = Math.min(v.n, 14);
    const focus = this.skill.focus;
    for (let k = 0; k < lim; k++) {
      const i = v.idx[k];
      const def = MOBS[e.sub[i]];
      if (e.y[i] < 0 || e.y[i] > WORLD_H) continue; // still climbing the hill
      let score = -v.dist[k];
      // a sword cannot reach a foe holding its standoff past a shut gate: take anyone else first
      if (this.meleeKit && e.x[i] - this.maxX(s) > v.cls.combo[0].range * 0.8) score -= 600;
      score += focus * 28 * isPriority(def) * (v.dist[k] < 200 ? 1 : 0.3);
      if (def.behavior === Behavior.Bomber) score += 45 * (0.4 + focus);
      score += 14 * focus * (1 - e.hp[i] / Math.max(1, e.maxhp[i]));
      if (i === this.te) score += 22;
      if (score > bestScore) { bestScore = score; best = k; }
    }
    if (best < 0 && v.n > 0) best = 0;
    if (best >= 0) this.setTarget(best);
    else { this.te = -1; this.tk = -1; }
  }

  private setTarget(k: number): void {
    const v = this.view;
    this.tk = k;
    this.te = v.idx[k];
    this.tx = this.s.ents.x[this.te]; this.ty = this.s.ents.y[this.te];
    this.td = v.dist[k];
  }

  // ---------------------------------------------------------------------------------------------
  // Helpers tactics use

  /** Aim at a point from the hero, off by this stretch's miss. */
  aimAt(x: number, y: number, bias = 0): void {
    const v = this.view;
    let dx = x - v.x, dy = y - v.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.001) return;
    dx /= d; dy /= d;
    const turn = this.aimErr - bias;
    const c = cosTurns(turn), sn = sinTurns(turn);
    this.plan.hasAim = true;
    this.plan.ax = dx * c - dy * sn;
    this.plan.ay = dx * sn + dy * c;
  }

  /** Stand `gap` px from the target on the side the hero is already on. */
  standOff(gap: number, tx = this.tx, ty = this.ty): void {
    const v = this.view;
    let dx = v.x - tx, dy = v.y - ty;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= d; dy /= d;
    this.plan.hasGoal = true;
    this.plan.gx = tx + dx * gap;
    this.plan.gy = ty + dy * gap;
  }

  /** Stamina affordability, with a reserve kept back for a dodge when the hero is in a scrum. */
  canSpend(cost: number, reserve = 0): boolean {
    const p = this.s.players[this.slot];
    return !p.winded && p.stamina >= cost + reserve;
  }

  /** Keep stamina for a dodge when something is about to land. */
  dodgeReserve(): number {
    const v = this.view;
    const p = this.s.players[this.slot];
    return this.threats.n > 0 || v.c40 > 1 ? v.cls.dashCost * costMul(p.ranks, 3) : 0;
  }

  /** The foe at the centre of the thickest knot of enemies of `radius` whose distance is within [lo, hi]. Cached for the tick. */
  cluster(radius: number, lo: number, hi: number): { k: number; n: number } {
    const v = this.view;
    let bestK = -1, bestN = 0;
    const lim = Math.min(v.n, 16);
    const gate = this.meleeKit ? this.maxX(this.s) + 40 : Infinity; // a blade cannot reach a knot past a shut gate
    for (let a = 0; a < lim; a++) {
      if (v.dist[a] < lo || v.dist[a] > hi || v.x + v.dx[a] > gate) continue;
      let n = 0;
      for (let b = 0; b < lim; b++) {
        const dx = v.dx[a] - v.dx[b], dy = v.dy[a] - v.dy[b];
        if (dx * dx + dy * dy <= radius * radius) n++;
      }
      if (n > bestN) { bestN = n; bestK = a; }
    }
    return { k: bestK, n: bestN };
  }

  /** Foes in the lane ahead along a unit direction: `length` long, `halfW` to either side. */
  laneCount(ux: number, uy: number, length: number, halfW: number): number {
    const v = this.view;
    let n = 0;
    for (let k = 0; k < v.n; k++) {
      const along = v.dx[k] * ux + v.dy[k] * uy;
      if (along < 0 || along > length) continue;
      if (Math.abs(v.dx[k] * -uy + v.dy[k] * ux) <= halfW) n++;
    }
    return n;
  }

  // ---------------------------------------------------------------------------------------------
  // No target: advance, collect, open things

  private explore(s: GameState, p: GameState['players'][number]): void {
    const v = this.view;
    const plan = this.plan;
    const e = s.ents;
    const maxX = this.maxX(s);
    // the pace of the party: do not run ahead of a hero who is behind
    let gx = Math.min(maxX, v.x + 90), gy = v.y;
    if (v.allies > 0 && v.x - v.allyX > 130) gx = v.x - 20;
    plan.hasGoal = true;
    // Loot and sites, in the player's habit. A choice is kept until it is reached, goes stale, or has taken too long (then it is not chased again for a while).
    const calm = v.n === 0 || v.nearestDist > 120;
    if (this.loot >= 0 && !(calm && this.lootValid(s, this.loot) && s.tick < this.lootUntil)) {
      if (this.loot >= 0 && s.tick >= this.lootUntil) this.ignore.set(this.loot, s.tick + 900);
      this.loot = -1;
    }
    if (this.loot < 0 && calm && s.tick - this.lootLook >= Math.max(4, Math.round(this.skill.tempo))) {
      this.lootLook = s.tick;
      const thorough = this.skill.thorough;
      if (thorough > 0.3) {
        const site = this.siteGoal(s, p);
        if (site >= 0) { this.loot = site; this.lootUntil = s.tick + 420; }
      }
      if (this.loot < 0 && rngFloat(this.rng) < 0.05 + thorough) {
        let bestD = 220 * (0.4 + 0.6 * thorough), best = -1;
        for (let q = 0; q < this.scan.coinN; q++) {
          const i = this.scan.coin[q];
          if (!this.lootValid(s, i)) continue;
          const d = Math.abs(e.x[i] - v.x) + Math.abs(e.y[i] - v.y);
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best >= 0) { this.loot = best; this.lootUntil = s.tick + 240; }
      }
    }
    if (this.loot >= 0) { gx = e.x[this.loot]; gy = e.y[this.loot]; }
    else if (v.y < 40 || v.y > WORLD_H - 40) gy = WORLD_H / 2; // drift back toward the middle of the road
    // Held at a shut gate with foes left on the field and none in reach: nobody is coming (they cannot see a hidden rogue, or they hold a
    // standoff). A player backs off to pull them in, and a hidden rogue steps out with a swing to be seen.
    const blocked = s.gates[s.gateIdx] !== undefined && v.x >= maxX - 6 && this.scan.hostiles > 0 && this.loot < 0;
    if (blocked) this.gateWait++;
    else if (this.pulling === 0) this.gateWait = 0;
    if (this.gateWait > 150 && this.pulling === 0) this.pulling = 600; // (a long pull: back off, stay in view, let them come)
    if (this.pulling > 0) {
      this.pulling--;
      gx = s.camX + 60; gy = WORLD_H / 2;
      // a swing resets the rogue's wait to hide again, so one every so often keeps him in view while he pulls them in
      if (v.cls.hideCooldown && (p.vanishT > 0 || p.revealT < 100) && p.cdAttack === 0 && this.canSpend(v.cls.attackCost)) plan.attack = true;
      if (this.pulling === 0) this.gateWait = 0;
    }
    plan.gx = gx; plan.gy = gy;
  }

  /** Is `i` still worth walking to: alive, on the screen the hero can reach, not recently given up on? */
  private lootValid(s: GameState, i: number): boolean {
    const e = s.ents;
    if (!e.alive[i]) return false;
    const k = e.kind[i];
    if (k !== Kind.Coin && k !== Kind.Chest && k !== Kind.Shrine) return false;
    if ((this.ignore.get(i) ?? 0) > s.tick) return false;
    if (k === Kind.Coin) return e.x[i] >= s.camX + 16 && e.x[i] <= this.maxX(s);
    return e.elite[i] !== SiteState.Spent && e.x[i] >= s.camX + 12 && e.x[i] <= s.camX + VIEW_W - 16;
  }

  /** The chest or shrine this player wants to open right now, or -1. */
  private siteGoal(s: GameState, p: GameState['players'][number]): number {
    const e = s.ents;
    const v = this.view;
    const sc = this.scan;
    let best = -1, bestD = 260;
    for (let q = 0; q < sc.siteN; q++) {
      const i = sc.site[q];
      if (!e.alive[i] || e.elite[i] === SiteState.Spent) continue;
      if (e.x[i] < s.camX + 12 || e.x[i] > s.camX + VIEW_W - 16) continue;
      const d = Math.abs(e.x[i] - v.x) + Math.abs(e.y[i] - v.y);
      if (d > bestD) continue;
      const hpf = v.hpFrac;
      let want = false;
      if (e.kind[i] === Kind.Chest) want = e.elite[i] === SiteState.Free || s.gold >= chestCost(s);
      else if (e.elite[i] === SiteState.Running) want = e.sub[i] === ShrineKind.Charge && hpf > 0.4; // stay in the ring while it fills
      else switch (e.sub[i]) {
        case ShrineKind.Curse: want = hpf > 0.75 && this.skill.thorough > 0.55 && p.level >= 3; break;
        case ShrineKind.Charge: want = hpf > 0.8 && this.skill.thorough > 0.6 && p.level >= 3; break;
        case ShrineKind.Greed: want = hpf > 0.9 && this.skill.thorough > 0.7; break;
        case ShrineKind.Mercy: want = hpf < 0.55 && s.gold >= 0; break;
      }
      if (want) { best = i; bestD = d; }
    }
    return best;
  }

  /** Overrides that keep the hero alive: flasks, a breather when winded, a stand-off when the plan is a charge into danger. */
  private survive(s: GameState, p: GameState['players'][number]): void {
    const v = this.view;
    const plan = this.plan;
    const e = s.ents;
    const cautious = v.hpFrac < this.skill.caution;
    const needStamina = p.winded || (p.stamina < 12 && v.cls.attackCost >= 8);
    if (!cautious && !needStamina) return;
    // a flask close by is worth a short detour; a hurt hero looks for the red ones, a winded one for the yellow
    let best = -1, bestD = cautious ? 170 : 130;
    for (let q = 0; q < this.scan.potN; q++) {
      const i = this.scan.pot[q];
      const stam = e.sub[i] === 1;
      if (stam ? !(needStamina) : !cautious) continue;
      if (e.x[i] < s.camX + 8 || e.x[i] > this.maxX(s) + 6) continue; // (a flask past a shut gate cannot be had)
      const d = Math.abs(e.x[i] - v.x) + Math.abs(e.y[i] - v.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) { plan.hasGoal = true; plan.gx = e.x[best]; plan.gy = e.y[best]; }
  }

  // ---------------------------------------------------------------------------------------------
  // Steering: pick the move that serves the plan's goal and costs the least health

  maxX(s: GameState): number {
    const gate = s.gates[s.gateIdx];
    return gate ? Math.min(s.camX + VIEW_W - 10, gate.x - 8) : s.camX + VIEW_W - 10;
  }

  private act(s: GameState, p: GameState['players'][number], out: InputFrame): void {
    const v = this.view;
    const plan = this.plan;
    const cls = v.cls;
    const sk = this.skill;
    const minX = s.camX + 10, maxX = this.maxX(s);
    const minY = 2, maxY = WORLD_H - 2;
    const speed = cls.speed * (1 + 0) * (p.winded ? cls.windedSpeed : 1) * (p.slowT > 0 ? 0.55 : 1) * (p.cdAttack > 0 ? cls.attackMove ?? 1 : 1) * this.speedBoost(p);
    const rooted = p.rootT > 0;
    const confused = p.confuseT > 0;

    // Candidate scoring
    const kd = PX_PER_HP * (100 / cls.hp);
    let bestK = DIRS, bestScore = -Infinity, bestTotal = 0, bestNear = 0;
    const spacing = 0.25 + 1.1 * sk.spacing;
    const GX = plan.hasGoal ? plan.gx : v.x, GY = plan.hasGoal ? plan.gy : v.y;
    for (let k = 0; k <= DIRS; k++) {
      const ux = DIR_X[k], uy = DIR_Y[k];
      const vv = k === DIRS ? 0 : speed;
      let reachT = GOAL_T;
      if (plan.hasGoal && vv > 0) {
        // a line toward the goal stops at the goal: arriving is not overshooting
        const along = (GX - v.x) * ux + (GY - v.y) * uy;
        if (along > 0) reachT = Math.min(GOAL_T, along / vv);
      }
      const px = clampN(v.x + ux * vv * reachT, minX, maxX), py = clampN(v.y + uy * vv * reachT, minY, maxY);
      let goal = 0;
      if (plan.hasGoal) {
        const gdx = GX - px, gdy = GY - py;
        goal = -Math.sqrt(gdx * gdx + gdy * gdy);
      }
      const total = this.threats.costOf(v.x, v.y, ux, uy, vv, minX, maxX, minY, maxY);
      const near = this.threats.lastNear;
      const crowd = this.crowdCost(px, py, spacing);
      let score = goal - total * kd - crowd * kd;
      if (k === this.lastDir) score += 3; // keep to a line rather than jitter
      if (rooted) score = k === DIRS ? score : -Infinity;
      if (score > bestScore) { bestScore = score; bestK = k; bestTotal = total; bestNear = near; }
    }
    this.lastDir = bestK;
    let ux = DIR_X[bestK], uy = DIR_Y[bestK];
    let moving = bestK !== DIRS;
    if (!plan.hasGoal && bestTotal === 0) { ux = 0; uy = 0; moving = false; }

    // --- dodge: when the best move still eats a hit that lands within a few ticks, or the plan asks for one
    let rolled = false;
    const canRoll = p.dashT === 0 && p.cdDash === 0 && !p.winded && p.stamina >= cls.dashCost * costMul(p.ranks, 3);
    if (this.dodgeHold > 0 && cls.dashKind === 'charge') { out.buttons |= Btn.Dodge; this.dodgeHold--; rolled = true; }
    else if (canRoll || (rooted && p.stamina >= cls.dashCost)) {
      const threshold = 0.07 * cls.hp;
      if (plan.roll || (this.dodgeOk && bestNear >= threshold) || (rooted && bestTotal > 0.03 * cls.hp && this.dodgeOk)) {
        // the way out is the line that leaves the fewest later dangers behind, ignoring what the roll itself dodges
        let rk = bestK, rBest = Infinity;
        if (plan.roll && (plan.rollX !== 0 || plan.rollY !== 0)) {
          ux = plan.rollX; uy = plan.rollY; rk = -1;
        } else {
          for (let k = 0; k < DIRS; k++) {
            const t = this.threats.costOf(v.x, v.y, DIR_X[k], DIR_Y[k], cls.dashSpeed * 6, minX, maxX, minY, maxY) - this.threats.lastNear + this.crowdCost(clampN(v.x + DIR_X[k] * 60, minX, maxX), clampN(v.y + DIR_Y[k] * 60, minY, maxY), spacing);
            if (t < rBest) { rBest = t; rk = k; }
          }
          if (rk >= 0) { ux = DIR_X[rk]; uy = DIR_Y[rk]; }
        }
        if (this.tap(out, Btn.Dodge)) {
          rolled = true; moving = true;
          this.stats.rolls++;
          this.dodgeHold = plan.holdRoll > 0 ? plan.holdRoll : 0;
        }
      }
    }

    // --- movement stick (a whiteout reverses it, and a hero who knows turns it back round)
    if (moving) {
      const f = confused ? -1 : 1;
      out.moveX = Math.round(ux * 127 * f);
      out.moveY = Math.round(uy * 127 * f);
    }
    if (plan.hasAim) { out.aimX = Math.round(plan.ax * 127); out.aimY = Math.round(plan.ay * 127); }

    // --- the rest of the buttons
    if (p.silenceT === 0) {
      if (plan.nova && this.tap(out, Btn.Ability1)) this.stats.novas++;
      else if (plan.special && this.tap(out, Btn.Ability2)) this.stats.specials++;
    }
    // A boss that cannot see a hidden rogue stands frozen mid-move: with a boss on the field he steps out of hiding and keeps himself in view with a swing before he would slip away again
    if (cls.hideCooldown && s.ents.boss >= 0 && (p.vanishT > 0 || p.revealT < 80) && p.cdAttack === 0 && this.canSpend(cls.attackCost)) plan.attack = true;
    if (cls.auraDrain) {
      if (plan.attack !== p.auraOn) this.tap(out, Btn.Attack);
    } else if (plan.attack) out.buttons |= Btn.Attack;
    if (this.pressInteract) { this.tap(out, Btn.Interact); this.pressInteract = false; }
    if (!rolled && this.dodgeHold > 0) this.dodgeHold = 0;
  }

  private speedBoost(p: GameState['players'][number]): number {
    let m = 1;
    const sw = UPGRADES.findIndex((u) => u.id === 'swift');
    if (sw >= 0) m += UPGRADES[sw].perRank * p.ranks[sw];
    return m;
  }

  /** Soft cost of standing at (px, py) among the nearest foes: how much of a bite it invites, scaled by how much room the player likes. */
  private crowdCost(px: number, py: number, spacing: number): number {
    const v = this.view;
    const e = this.s.ents;
    let c = 0;
    const lim = Math.min(v.n, 12);
    for (let k = 0; k < lim; k++) {
      const i = v.idx[k];
      const def = MOBS[e.sub[i]];
      if (def.damage <= 0 || def.behavior === Behavior.Boss) continue; // (a boss's blows are all telegraphs, priced as threats)
      const dx = e.x[i] - px, dy = e.y[i] - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      let reach: number;
      if (def.behavior === Behavior.Ranged || def.behavior === Behavior.Caster) reach = 22;
      else if (def.behavior === Behavior.Bomber) reach = 46;
      else reach = def.reach + (def.lunge ?? 0) + def.radius + 7;
      if (e.flags[i] & 4) reach += 4; // enraged
      if (d >= reach) continue;
      const armed = strikeIn(this.s, i) <= 30 ? 1 : 0.4;
      c += def.damage * armed * (1 - d / reach) * spacing * 0.55;
    }
    return c;
  }

  // ---------------------------------------------------------------------------------------------
  // The level-up panel

  /** Is there anyone close that could hurt the hero (a drummer or a healer standing about is not it)? */
  private dangerNear(): boolean {
    const v = this.view;
    const e = this.s.ents;
    if (this.nearThreat()) return true;
    const lim = Math.min(v.n, 8);
    let biters = 0;
    for (let k = 0; k < lim; k++) {
      if (v.dist[k] > 120) break;
      const def = MOBS[e.sub[v.idx[k]]];
      if (def.damage > 0 || def.behavior === Behavior.Bomber) { if (v.dist[k] < 95) return true; biters++; }
    }
    return biters >= 4;
  }

  private wantsPanel(s: GameState, p: GameState['players'][number]): boolean {
    const v = this.view;
    if (s.store) return true;
    const care = this.skill.panelCare;
    if (rngFloat(this.rng) > care) return rngFloat(this.rng) < 0.04; // a careless player opens it whenever the thought strikes
    void p;
    if (v.hpFrac <= 0.35 || s.tick < this.panelCool) return false;
    return !this.dangerNear();
  }

  private operatePanel(s: GameState, p: GameState['players'][number], out: InputFrame): void {
    const v = this.view;
    if (this.panelWait < 0) { this.panelWait = Math.round(this.skill.pickDelay * (0.7 + 0.6 * rngFloat(this.rng))); }
    // a careful player closes it when a fight finds them
    if (this.skill.panelCare > 0.5 && !s.store && this.dangerNear()) {
      if (this.tap(out, Btn.Level)) { this.stats.panelClosed++; this.panelWait = -1; this.panelCool = s.tick + 150; }
      return;
    }
    if (this.panelWait > 0) { this.panelWait--; return; }
    if (this.stickCool > 0) return;
    const offer = heroOffer(s, this.slot);
    if (offer.length === 0) { this.tap(out, Btn.Level); return; }
    const cls = v.cls;
    const scores = offer.map((up) => cardScore(up, { className: cls.name, ranks: p.ranks, hpFrac: v.hpFrac, party: this.partySize(s) }));
    let best = 0;
    for (let k = 1; k < scores.length; k++) if (scores[k] > scores[best]) best = k;
    const sk = this.skill;
    // a poor hand: deal another if rerolls remain and the player knows to
    if (scores[best] < 6.2 && p.rerolls > 0 && rngFloat(this.rng) < sk.rerollSense) {
      out.moveY = -127; this.stickCool = 4; this.stats.rerolls++; this.panelWait = Math.max(4, Math.round(sk.pickDelay * 0.3)); return;
    }
    // a card so bad it should never come back, when the player has the habit
    let worst = 0;
    for (let k = 1; k < scores.length; k++) if (scores[k] < scores[worst]) worst = k;
    if (p.banishes > 0 && scores[worst] < 2.5 && rngFloat(this.rng) < sk.rerollSense * 0.5 && scores.length > 1) {
      if (p.cursor !== worst) { out.moveX = p.cursor < worst ? 127 : -127; this.stickCool = 3; return; }
      out.moveY = 127; this.stickCool = 4; this.stats.banishes++; this.panelWait = Math.max(4, Math.round(sk.pickDelay * 0.3)); return;
    }
    // a player with a poor sense of builds takes whichever card is nearest to hand
    let pick = best;
    if (rngFloat(this.rng) > sk.buildSense) pick = rngInt(this.rng, offer.length);
    if (pick === 1) this.tap(out, Btn.Ability1);
    else if (pick === 2) this.tap(out, Btn.Ability2);
    else if (p.cursor !== 0) { out.moveX = -127; this.stickCool = 3; return; } else this.tap(out, Btn.Attack);
    this.stats.picks++;
    this.stickCool = 6;
  }

  private nearThreat(): boolean {
    const t = this.threats;
    for (let k = 0; k < t.n; k++) if (t.from[k] <= 20) return true;
    return false;
  }

  partySize(s: GameState): number {
    let n = 0;
    for (const q of s.players) if (q.active) n++;
    return n;
  }

  // ---------------------------------------------------------------------------------------------
  // The store

  private storeBrain(s: GameState, p: GameState['players'][number], store?: StoreCtx): void {
    const v = this.view;
    const plan = this.plan;
    plan.hasGoal = true;
    const exit = s.exitX;
    // picks first
    if (p.pending > 0) { plan.gx = v.x; plan.gy = v.y; return; }
    if (!store) this.storeDone = true;
    else if (!this.storeDone) {
      if (this.shopWant < 0 || store.sold[this.shopWant] || this.shopTries > 3) this.shopWant = this.pickWare(s, p, store);
      if (this.shopWant < 0) this.storeDone = true;
      else {
        const sp = wareSpot(this.shopWant, store.stock.length);
        plan.gx = sp.x; plan.gy = sp.y;
        const nearX = Math.abs(v.x - sp.x) < WARE_REACH_X - 6, nearY = Math.abs(v.y - sp.y) < WARE_REACH_Y - 5;
        if (nearX && nearY && this.interactCool === 0) {
          this.shopTries++;
          this.pressInteract = true;
          this.interactCool = 10;
        }
        return;
      }
    }
    // done: wait for the party, then walk out
    if (store && !store.allDone) { plan.gx = Math.min(exit - 200, Math.max(v.x, 700)); plan.gy = v.y; return; }
    plan.gx = exit + 40; plan.gy = WORLD_H / 2;
  }

  /** A new store: nothing bought yet. */
  resetForStore(): void { this.storeDone = false; this.shopWant = -1; this.shopTries = 0; this.recovering = false; this.te = -1; }

  /** Press the trade button this tick (standing at a ware). */
  private pressInteract = false;

  /** Which ware to buy next, or -1 when there is nothing worth the gold. */
  private pickWare(s: GameState, p: GameState['players'][number], store: StoreCtx): number {
    this.shopTries = 0;
    let best = -1, bestV = -1;
    const sk = this.skill;
    for (let i = 0; i < store.stock.length; i++) {
      if (store.sold[i]) continue;
      const ware = WARES[store.stock[i].ware];
      const price = store.stock[i].price;
      if (price > s.gold) continue;
      let value: number;
      if (ware.kind === 'level') { if (p.level >= MAX_LEVEL) continue; value = 9; }
      else {
        const up = ware.upgrade!;
        if (p.ranks[up] >= UPGRADES[up].maxRank) continue;
        value = ({ heavy: 7.5, thick: 7.5, swift: 5, windfall: 2.5 } as Record<string, number>)[UPGRADES[up].id] ?? 4;
      }
      value *= 0.5 + 0.5 * sk.shopSense * (0.7 + 0.6 * rngFloat(this.rng)); // a novice is swayed by whatever
      value -= price / 120;
      if (value > bestV) { bestV = value; best = i; }
    }
    return bestV > 0.6 ? best : -1;
  }
}

function clampN(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

export { rankOf };
