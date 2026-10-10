// Side quests on the field (docs/15-quests.md). The party took a quest in the camp; this plays its mission on the level and pays the reward.
//
//   escort    a ward walks with the party, swings a sword that hardly scratches, and has to live to the end of the field.
//   bounty    a marked brute comes out of the hill partway down the road; kill it.
//   cull      slay so many of the level's common foe.
//   rescue    a captive stands bound on the field with guards about to arrive, and the guards go for them; stand close until the ring fills to
//             cut them free, and it is done once no guard is left near them alive.
//   flawless  reach the end with no hero ever downed.
//   swift     reach the end before the clock runs out.
//
// The quest lives in `GameState.quest`; its bodies (the ward, the captive) are Kind.Npc entities. Per-entity state on an Npc: `sub` the giver
// (data/quests.ts), `mode` NpcMode, `hp`/`maxhp` the ward's health, `atk` ticks of swing left, `cool` ticks to the next bite it may take,
// `cool2` ticks since it was last bitten (it mends when that is long), `buff` a captive's ring (0..CHANNEL).
// A captive or loose one has `hp`/`maxhp` too, and `cool` ticks to the next bite it may take.
import { QUEST_NPCS, type QuestDef } from '../data/quests';
import { ARROW_DAMAGE, Behavior, MOBS } from '../data/mobs';
import { heatDamage } from '../data/heat';
import { createRng, rngFloat, rngInt, rngRange } from '../engine/rng';
import { UPGRADES } from '../data/upgrades';
import { VIEW_W, WORLD_H, WORLD_W } from './constants';
import { allocEntity, BYSTANDER, freeEntity, Kind, NpcMode, SURRENDERED } from './entities';
import { Ev, emit } from './events';
import { activePlayers, eliteTypes, spawnElite } from './gen/level';
import { CHANNEL, freeLevel, healParty, heroAt } from './sites';
import { CHIP, damageMob, levelProgress, spawnFlankPack } from './step';
import { Phase, type GameState } from './state';

export const QuestStatus = { Active: 0, Done: 1, Failed: 2 } as const;
/** What `Ev.Quest` reports in `a`. */
export const QuestEv = { Start: 0, Done: 1, Fail: 2, Swing: 3, Hurt: 4, Free: 5, Spawn: 6, Progress: 7 } as const;
/** Why a quest failed (`QuestRun.why`, and `b` of the failure event). */
export const FailWhy = { None: 0, Died: 1, Fell: 2, Late: 3, Missed: 4, Lost: 5 } as const;

export interface QuestRun {
  def: QuestDef;
  status: number;
  /** Cull: how many have been slain. */
  progress: number;
  /** The slot of the ward, captive or quarry while there is one (check it still is: slots are reused), else -1. */
  ent: number;
  /** Where the captive stands, or where the quarry comes out of the hill (the camera reaching it). */
  x: number;
  y: number;
  /** A captive's guards, or the quarry, have come. */
  spawned: boolean;
  /** The tick it was settled (-1 while it is open), for the banner. */
  endTick: number;
  why: number;
}

/** A ward's health, and how hard its sword hits: it is there to be protected, not to help. */
export const WARD_HP = 70;
const WARD_DAMAGE = 2;
const WARD_SWING = 46;
/** A bite on the ward does this much of what it would do to a hero, never more than a third of its health, and no more often than this. */
const WARD_TAKEN = 0.8;
const WARD_CAP = 0.34;
const WARD_COOL = 50;
/** It mends this much a tick once it has gone this long without a bite. */
const WARD_MEND = 0.03;
const WARD_QUIET = 150;
const WARD_SPEED = 0.9;
const WARD_RUN = 1.7;
const QUEST_STREAM = 7100;
const REACH_X = 26, REACH_Y = 20;
/** A captive's health, and how often a bite can land on it: the guards are there to kill it, but a crowd must not end it in a blink. */
export const CAPTIVE_HP = 80;
const CAPTIVE_COOL = 24;
/** Guards this close (in x) to a captive may go for it instead of the party; and the field counts as clear once none is this close. */
const LURE_X = 150, LURE_Y = 70;
const CLEAR_X = 180;

export function createQuestRun(def: QuestDef): QuestRun {
  return { def, status: QuestStatus.Active, progress: 0, ent: -1, x: 0, y: 0, spawned: false, endTick: -1, why: FailWhy.None };
}

/** Put the quest's bodies on the field: a ward beside the party, or a captive somewhere down the road, or the place the quarry will come from. A function of the seed. */
export function placeQuest(s: GameState): void {
  const q = s.quest;
  if (!q) return;
  const r = createRng(s.seed, QUEST_STREAM);
  const e = s.ents;
  if (q.def.mission === 'escort') {
    const i = allocEntity(e, Kind.Npc, q.def.npc, 44, 130, WARD_HP);
    if (i >= 0) { e.mode[i] = NpcMode.Ward; q.ent = i; }
    return;
  }
  if (q.def.mission !== 'rescue' && q.def.mission !== 'bounty') return;
  // somewhere down the road, off the staged scenes and the chests and shrines
  let x = 0, y = 0;
  for (let tries = 0; tries < 10; tries++) {
    x = 1000 + rngFloat(r) * (WORLD_W - 1700);
    y = rngRange(r, 52, WORLD_H - 52);
    if (s.plan.some((c) => (c.scene || c.beat) && Math.abs(c.x - x) < 330)) continue;
    let clear = true;
    for (let i = 0; i < e.highWater; i++) if (e.alive[i] && (e.kind[i] === Kind.Chest || e.kind[i] === Kind.Shrine) && Math.abs(e.x[i] - x) < 140) clear = false;
    if (clear) break;
  }
  q.x = x; q.y = y;
  if (q.def.mission === 'rescue') {
    const i = allocEntity(e, Kind.Npc, (q.def.npc + 1 + rngInt(r, QUEST_NPCS.length - 1)) % QUEST_NPCS.length, x, y, CAPTIVE_HP);
    if (i >= 0) { e.mode[i] = NpcMode.Captive; e.face[i] = rngFloat(r) < 0.5 ? 1 : -1; q.ent = i; }
  }
}

/** The ward's slot while it is alive, else -1. */
export function wardOf(s: GameState): number {
  const q = s.quest;
  if (!q || q.def.mission !== 'escort') return -1;
  const i = q.ent;
  return i >= 0 && s.ents.alive[i] === 1 && s.ents.kind[i] === Kind.Npc && s.ents.mode[i] === NpcMode.Ward ? i : -1;
}

/** The captive's slot while its guards have come and it can be hurt (bound, or cut free and waiting for them to die), else -1. */
export function captiveOf(s: GameState): number {
  const q = s.quest;
  if (!q || q.def.mission !== 'rescue' || !q.spawned || q.status !== QuestStatus.Active) return -1;
  const i = q.ent;
  return i >= 0 && s.ents.alive[i] === 1 && s.ents.kind[i] === Kind.Npc && (s.ents.mode[i] === NpcMode.Captive || s.ents.mode[i] === NpcMode.Loose) ? i : -1;
}

/** The quest body that foes can hurt right now: the ward, or a guarded captive. -1 for none. */
function guardedOf(s: GameState): number {
  const w = wardOf(s);
  return w >= 0 ? w : captiveOf(s);
}

/** Fraction of the health of the one the party protects (0..1), for the tracker. */
export function wardFrac(s: GameState): number {
  const i = guardedOf(s);
  return i < 0 ? 0 : Math.max(0, s.ents.hp[i] / s.ents.maxhp[i]);
}

/** Mob `m`, whose nearest hero is `best` (squared distance) away: does it go for the captive instead? Returns the captive's slot, or -1.
 *  A guard close by goes for it when it is nearer than any hero, and about half of them go for it anyway: the party has to peel them off. */
export function lureOf(s: GameState, m: number, best: number): number {
  const c = captiveOf(s);
  if (c < 0) return -1;
  const e = s.ents;
  const dx = e.x[c] - e.x[m], dy = e.y[c] - e.y[m];
  if (Math.abs(dx) > LURE_X || Math.abs(dy) > LURE_Y) return -1;
  return dx * dx + dy * dy < best || (Math.imul(m, 2246822519) >>> 31) === 1 ? c : -1;
}

/** A foe's blow reaches the captive. They take one no more often than CAPTIVE_COOL; the rest glance off the crowd. */
export function biteCaptive(s: GameState, i: number, dmg: number): void {
  const e = s.ents;
  if (e.cool[i] > 0) return;
  e.cool[i] = CAPTIVE_COOL;
  hurtNpc(s, i, dmg);
}

/** A creature the party would call an enemy: awake on the field, not a bystander, not kneeling, not leaving, not still climbing in over the hill. */
function hostile(s: GameState, m: number): boolean {
  const e = s.ents;
  if (e.kind[m] !== Kind.Mob || !e.alive[m]) return false;
  if (e.flags[m] & (BYSTANDER | SURRENDERED | 8 | 2)) return false;
  const def = MOBS[e.sub[m]];
  return !(def.burrow && e.rem[m] === 0);
}

function pay(s: GameState, x: number, y: number): void {
  const q = s.quest!;
  const d = q.def;
  switch (d.reward) {
    case 'purse':
      s.gold += d.gold;
      emit(s.events, Ev.Coin, x, y, d.gold);
      break;
    case 'lesson':
      for (let k = 0; k < s.players.length; k++) freeLevel(s, k);
      break;
    case 'relic':
      for (const p of s.players) if (p.active && p.ranks[d.upgrade] < UPGRADES[d.upgrade].maxRank) p.ranks[d.upgrade]++;
      break;
    case 'fortune':
      for (const p of s.players) if (p.active) { p.rerolls += 2; p.banishes += 1; }
      healParty(s, 1);
      break;
  }
}

function complete(s: GameState, x: number, y: number): void {
  const q = s.quest;
  if (!q || q.status !== QuestStatus.Active) return;
  q.status = QuestStatus.Done;
  q.endTick = s.tick;
  pay(s, x, y);
  emit(s.events, Ev.Quest, x, y, QuestEv.Done, q.def.reward === 'purse' ? q.def.gold : 0);
}

function fail(s: GameState, why: number, x = 0, y = 0): void {
  const q = s.quest;
  if (!q || q.status !== QuestStatus.Active) return;
  q.status = QuestStatus.Failed;
  q.endTick = s.tick;
  q.why = why;
  emit(s.events, Ev.Quest, x, y, QuestEv.Fail, why);
}

/** Where the party stands, for something that follows it. */
function party(s: GameState): { n: number; x: number; y: number; far: number } {
  const e = s.ents;
  let n = 0, x = 0, y = 0, far = 0;
  for (const p of s.players) {
    if (!p.active || p.downed) continue;
    n++; x += e.x[p.ent]; y += e.y[p.ent];
    if (e.x[p.ent] > far) far = e.x[p.ent];
  }
  return { n, x: n ? x / n : 0, y: n ? y / n : 0, far };
}

/** Something bit the ward or the captive. A hit never takes more than a third of its health at once, so a lone brute does not end it in a blow. */
export function hurtNpc(s: GameState, i: number, dmg: number): void {
  const e = s.ents;
  dmg = Math.min(dmg * WARD_TAKEN * s.damageMul * heatDamage(s.heat), e.maxhp[i] * WARD_CAP);
  e.hp[i] -= dmg;
  e.hurt[i] = 8;
  e.cool2[i] = 0;
  emit(s.events, Ev.Hit, e.x[i], e.y[i], dmg);
  emit(s.events, Ev.Quest, e.x[i], e.y[i], QuestEv.Hurt, 0);
  if (e.hp[i] <= 0) {
    fail(s, FailWhy.Died, e.x[i], e.y[i]);
    emit(s.events, Ev.Burst, e.x[i], e.y[i], 22, 3);
    freeEntity(e, i);
    if (s.quest) s.quest.ent = -1;
  }
}

/** A hostile shot flying at x, y: if it reaches the ward or a guarded captive, they take it. Returns whether it did (the shot is spent). */
export function shotHitsWard(s: GameState, proj: number): boolean {
  const i = guardedOf(s);
  if (i < 0) return false;
  const e = s.ents;
  const dx = e.x[i] - e.x[proj], dy = e.y[i] - 5 - e.y[proj];
  if (dx * dx + dy * dy >= 36) return false;
  const dmg = e.rem[proj] > 0 ? e.rem[proj] : ARROW_DAMAGE;
  if (e.mode[i] === NpcMode.Ward) hurtNpc(s, i, dmg); else biteCaptive(s, i, dmg);
  freeEntity(e, proj);
  return true;
}

function updateWard(s: GameState, i: number): void {
  const e = s.ents;
  if (e.hurt[i] > 0) e.hurt[i]--;
  if (e.atk[i] > 0) e.atk[i]--;
  if (e.cool[i] > 0) e.cool[i]--;
  if (e.cool2[i] < 65535) e.cool2[i]++;
  const pt = party(s);
  if (pt.n === 0) return;
  const x = e.x[i], y = e.y[i];
  // the nearest foe within sight of the ward and not too far from the party: he goes for it
  let foe = -1, foeD = Infinity;
  let touching = 0, worst = 0;
  for (let m = 0; m < e.highWater; m++) {
    if (!hostile(s, m)) continue;
    const dx = e.x[m] - x, dy = e.y[m] - y;
    const def = MOBS[e.sub[m]];
    if (Math.abs(dx) <= def.reach + 4 && Math.abs(dy) <= 10 && (def.behavior === Behavior.Melee || def.behavior === Behavior.Boss)) {
      touching++;
      worst = Math.max(worst, def.damage * (e.elite[m] ? 1.3 : 1));
    }
    const d = dx * dx + dy * dy * 4;
    if (d < foeD && Math.abs(dx) < 110 && Math.abs(e.x[m] - pt.x) < 140) { foeD = d; foe = m; }
  }
  if (touching > 0 && e.cool[i] === 0) {
    e.cool[i] = WARD_COOL;
    hurtNpc(s, i, worst * (1 + 0.25 * (touching - 1)));
    if (!e.alive[i] || e.kind[i] !== Kind.Npc) return;
  }
  if (e.cool2[i] > WARD_QUIET && e.hp[i] < e.maxhp[i]) e.hp[i] = Math.min(e.maxhp[i], e.hp[i] + WARD_MEND);
  // where he wants to stand: behind the party's middle, or beside the foe he has picked
  let gx = pt.x - 28, gy = pt.y + 14;
  if (foe >= 0) { gx = e.x[foe] + (x < e.x[foe] ? -13 : 13); gy = e.y[foe]; }
  const dx = gx - x, dy = gy - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const sp = Math.sqrt((x - pt.x) * (x - pt.x) + (y - pt.y) * (y - pt.y)) > 90 ? WARD_RUN : WARD_SPEED;
  if (dist > 2) { e.x[i] += (dx / dist) * Math.min(sp, dist); e.y[i] += (dy / dist) * Math.min(sp, dist) * 0.8; }
  if (foe >= 0) e.face[i] = e.x[foe] >= e.x[i] ? 1 : -1;
  else if (Math.abs(dx) > 3) e.face[i] = dx > 0 ? 1 : -1;
  // a swing: a flourish that scratches
  if (foe >= 0 && e.atk[i] === 0 && Math.abs(e.x[foe] - e.x[i]) <= 22 && Math.abs(e.y[foe] - e.y[i]) <= 12) {
    e.atk[i] = WARD_SWING;
    emit(s.events, Ev.Quest, e.x[i], e.y[i], QuestEv.Swing, e.face[i]);
    damageMob(s, foe, WARD_DAMAGE, e.face[i], 0, 0.4, -1, CHIP);
  }
  e.x[i] = Math.max(s.camX + 12, Math.min(s.camX + VIEW_W - 12, Math.min(pt.far + 6, e.x[i])));
  e.y[i] = Math.max(6, Math.min(WORLD_H - 6, e.y[i]));
}

function updateCaptive(s: GameState, i: number): void {
  const q = s.quest!;
  const e = s.ents;
  if (q.status !== QuestStatus.Active) return;
  if (e.hurt[i] > 0) e.hurt[i]--;
  if (e.cool[i] > 0) e.cool[i]--;
  if (e.mode[i] === NpcMode.Loose) {
    // cut free, but the guards are still about: they cower where they stood until the last one near them is dead
    if (nearFoes(s, e.x[i]) > 0) return;
    e.mode[i] = NpcMode.Freed;
    e.face[i] = -1;
    complete(s, e.x[i], e.y[i]);
    return;
  }
  // the guards come out of the hill when the captive is on screen
  if (!q.spawned && e.x[i] < s.camX + VIEW_W - 30) {
    q.spawned = true;
    const size = Math.round(7 * (1 + 0.5 * (activePlayers(s) - 1)));
    const lo = Math.max(s.camX + 20, e.x[i] - 120), hi = Math.min(s.camX + VIEW_W - 8, e.x[i] + 120);
    spawnFlankPack(s, true, size, levelProgress(s), lo, hi);
    spawnFlankPack(s, false, size, levelProgress(s), lo, hi);
    emit(s.events, Ev.Quest, e.x[i], e.y[i], QuestEv.Spawn, 0);
  }
  const hero = heroAt(s, e.x[i], e.y[i], REACH_X, REACH_Y);
  if (hero < 0) { if (e.buff[i] > 0) e.buff[i] = Math.max(0, e.buff[i] - 2); return; }
  e.by[i] = hero;
  if (++e.buff[i] < CHANNEL) return;
  e.buff[i] = 0;
  emit(s.events, Ev.Quest, e.x[i], e.y[i], QuestEv.Free, 0);
  if (nearFoes(s, e.x[i]) > 0) { e.mode[i] = NpcMode.Loose; q.progress = 1; return; }
  e.mode[i] = NpcMode.Freed;
  e.face[i] = -1;
  complete(s, e.x[i], e.y[i]);
}

/** Foes still near x: awake or still climbing in, not bystanders, not kneeling, not leaving. */
function nearFoes(s: GameState, x: number): number {
  const e = s.ents;
  let n = 0;
  for (let m = 0; m < e.highWater; m++) {
    if (!e.alive[m] || e.kind[m] !== Kind.Mob || (e.flags[m] & (BYSTANDER | SURRENDERED | 8))) continue;
    if (Math.abs(e.x[m] - x) < CLEAR_X) n++;
  }
  return n;
}

/** A freed captive runs for home, back the way the party came, and is gone once off screen. */
function updateFreed(s: GameState, i: number): void {
  const e = s.ents;
  e.x[i] -= 1.3;
  if (e.x[i] < s.camX - 24) { freeEntity(e, i); if (s.quest && s.quest.ent === i) s.quest.ent = -1; }
}

/** The marked brute comes out of the hill when the party nears the place the road chose for it. */
function updateBounty(s: GameState): void {
  const q = s.quest!;
  if (q.spawned || s.camX + VIEW_W < q.x - 40) return;
  q.spawned = true;
  const types = eliteTypes(s.biome);
  const r = createRng(s.seed, QUEST_STREAM + 1);
  const m = spawnElite(s, types[rngInt(r, types.length)], 3, Math.max(s.camX + 60, Math.min(s.camX + VIEW_W - 60, q.x)), -14);
  if (m >= 0) { s.ents.flags[m] = 3; q.ent = m; } // awake and "entering": over the hill, like any other arrival
  emit(s.events, Ev.Quest, q.x, 0, QuestEv.Spawn, 1);
}

/** Every tick of play. */
export function updateQuest(s: GameState): void {
  const q = s.quest;
  if (!q) return;
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i] || e.kind[i] !== Kind.Npc) continue;
    if (e.mode[i] === NpcMode.Ward) { if (q.status === QuestStatus.Active) updateWard(s, i); }
    else if (e.mode[i] === NpcMode.Captive || e.mode[i] === NpcMode.Loose) updateCaptive(s, i);
    else updateFreed(s, i);
  }
  if (q.status !== QuestStatus.Active) return;
  switch (q.def.mission) {
    case 'bounty': updateBounty(s); break;
    case 'flawless':
      for (const p of s.players) if (p.active && p.downed) { fail(s, FailWhy.Fell, e.x[p.ent], e.y[p.ent]); break; }
      break;
    case 'swift':
      if (s.tick > q.def.goal * 60) fail(s, FailWhy.Late);
      break;
  }
}

/** A creature is dying at `m`: it may be the quest's quarry, or one of the many a cull counts. */
export function questKill(s: GameState, m: number): void {
  const q = s.quest;
  if (!q || q.status !== QuestStatus.Active) return;
  const e = s.ents;
  if (q.def.mission === 'bounty' && e.elite[m] === 3) complete(s, e.x[m], e.y[m]);
  else if (q.def.mission === 'cull' && e.sub[m] === q.def.mob && ++q.progress >= q.def.goal) complete(s, e.x[m], e.y[m]);
  else if (q.def.mission === 'cull' && e.sub[m] === q.def.mob) emit(s.events, Ev.Quest, e.x[m], e.y[m], QuestEv.Progress, q.progress);
}

/** After the tick's end check: the field is won or lost, and whatever the quest was waiting on is decided. */
export function settleQuest(s: GameState): void {
  const q = s.quest;
  if (!q || q.status !== QuestStatus.Active || s.phase === Phase.Playing) return;
  const e = s.ents;
  const pt = party(s);
  const x = pt.n ? pt.x : 0, y = pt.n ? pt.y : 0;
  if (s.phase === Phase.Lost) { fail(s, FailWhy.Lost, x, y); return; }
  switch (q.def.mission) {
    case 'escort': {
      const w = wardOf(s);
      if (w >= 0) complete(s, e.x[w], e.y[w]); else fail(s, FailWhy.Died, x, y);
      break;
    }
    case 'flawless': complete(s, x, y); break;
    case 'swift': if (s.tick <= q.def.goal * 60) complete(s, x, y); else fail(s, FailWhy.Late, x, y); break;
    default: fail(s, FailWhy.Missed, x, y);
  }
}
