// Trigger boons (docs/04-classes-progression.md): upgrades that make something happen on an event, not just change a number.
//
// The sim calls `onKill` / `onHit` / `onDodge` / `onHurt` where those things happen. A boon never acts in the middle of
// the fight: it queues an effect (`s.procs`) that `flushProcs` resolves once the tick's blows have landed, so a chain of
// explosions never nests and never reads a spatial query another loop is still using. A per-tick budget caps how much a
// boon-heavy horde can chain, so one tick can never run away.
import { CLASSES } from '../data/classes';
import { UPGRADE_INDEX } from '../data/upgrades';
import { cosTurns, sinTurns } from '../engine/math';
import { rngFloat } from '../engine/rng';
import { allocEntity, Kind } from './entities';
import { Ev, emit } from './events';
import { gatherCircle } from './grid';
import { PROC_BUDGET, PROC_CAP, type GameState } from './state';
import { damageMob, PIERCE, PROC } from './step';

const Fx = { Burst: 1, Arc: 2, Shockwave: 3 } as const;

/** A ring of damage around (x, y) for hero `slot`, resolved with the tick's other boon effects. */
export function burstAt(s: GameState, slot: number, x: number, y: number, radius: number, damage: number): void {
  queue(s, Fx.Burst, x, y, slot, radius, damage);
}

/** Tell the presentation a boon of hero `slot` just fired, so it can pop its picture over the hero. */
export function pop(s: GameState, slot: number, id: string): void {
  const p = s.players[slot];
  emit(s.events, Ev.Proc, s.ents.x[p.ent], s.ents.y[p.ent], slot, UPGRADE_INDEX[id]);
}

const rank = (s: GameState, slot: number, id: string): number => s.players[slot].ranks[UPGRADE_INDEX[id]];

/** Queue an effect if the tick still has budget. `a` and `b` are the effect's own numbers. */
function queue(s: GameState, kind: number, x: number, y: number, owner: number, a: number, b: number): void {
  if (s.procBudget <= 0 || s.procN >= PROC_CAP) return;
  s.procBudget--;
  const o = s.procN * 6;
  s.procs[o] = kind; s.procs[o + 1] = x; s.procs[o + 2] = y; s.procs[o + 3] = owner; s.procs[o + 4] = a; s.procs[o + 5] = b;
  s.procN++;
}

/** Every tick: the budget refills and cooldowns run down. */
export function tickBoons(s: GameState): void {
  s.procBudget = PROC_BUDGET;
  for (const p of s.players) {
    if (!p.active) continue;
    for (let i = 0; i < p.boonCd.length; i++) if (p.boonCd[i] > 0) p.boonCd[i]--;
  }
}

/** A mob dies to hero `slot` at (x, y). */
export function onKill(s: GameState, slot: number, x: number, y: number): void {
  const p = s.players[slot];
  // Blood Tithe: every tenth kill heals a share of health.
  const tithe = rank(s, slot, 'tithe');
  if (tithe > 0 && p.kills % 10 === 0) {
    const hp = CLASSES[p.classId].hp;
    s.ents.hp[p.ent] = Math.min(hp, s.ents.hp[p.ent] + hp * 0.05 * tithe);
    pop(s, slot, 'tithe');
  }
  // Bloodmoon (Blood Tithe + Executioner): every kill mends a little.
  if (rank(s, slot, 'bloodmoon') > 0) {
    const hp = CLASSES[p.classId].hp;
    s.ents.hp[p.ent] = Math.min(hp, s.ents.hp[p.ent] + hp * 0.006);
    if (p.kills % 8 === 0) pop(s, slot, 'bloodmoon');
  }
  // Death Dance: a kill thrown from hiding frees the dodge.
  if (rank(s, slot, 'dance') > 0 && p.vanishT > 0) { p.cdDash = 0; pop(s, slot, 'dance'); }
  // Bloodlust: each kill takes ticks off the special and the dodge.
  const lust = rank(s, slot, 'lust');
  if (lust > 0) {
    p.cdSpecial = Math.max(0, p.cdSpecial - 12 * lust);
    p.cdDash = Math.max(0, p.cdDash - 6 * lust);
    if (p.kills % 5 === 0) pop(s, slot, 'lust');
  }
}

/** Hero `slot` damaged mob `m` (not to death) for `dmg`. */
export function onHit(s: GameState, slot: number, m: number, dmg: number): void {
  const spark = rank(s, slot, 'spark');
  // Chain Spark: a chance to arc to the nearest others, for a share of the blow.
  if (spark > 0 && rngFloat(s.rngCombat) < 0.12 + 0.08 * spark) { queue(s, Fx.Arc, s.ents.x[m], s.ents.y[m], slot, dmg * 0.6, m * 8 + 1 + spark); pop(s, slot, 'spark'); }
}

/** Executioner: hero `slot` hits a mob this much harder when it is already below a third of its health. */
export function executeMul(s: GameState, slot: number, m: number): number {
  const r = rank(s, slot, 'exec');
  return r > 0 && s.ents.hp[m] < s.ents.maxhp[m] / 3 ? 1 + 0.5 * r : 1;
}

/** The cleric's aura just landed on `hits` mobs: Radiance mends everyone standing in it. */
export function onAura(s: GameState, slot: number, hits: number): void {
  const r = rank(s, slot, 'radiance');
  if (r === 0 || hits === 0) return;
  const e = s.ents, me = s.players[slot];
  const reach = CLASSES[me.classId].combo[0].range;
  for (const q of s.players) {
    if (!q.active || q.downed) continue;
    const dx = e.x[q.ent] - e.x[me.ent], dy = e.y[q.ent] - e.y[me.ent];
    if (dx * dx + dy * dy > reach * reach) continue;
    e.hp[q.ent] = Math.min(CLASSES[q.classId].hp, e.hp[q.ent] + 0.2 * r);
  }
}

/** Extra ticks off a fallen hero's revive timer each tick: any standing cleric with Vigil close by speeds it up. */
export function vigilBonus(s: GameState, slot: number): number {
  const e = s.ents, down = s.players[slot];
  let bonus = 0;
  for (const q of s.players) {
    if (q === down || !q.active || q.downed) continue;
    const r = q.ranks[UPGRADE_INDEX.vigil];
    if (r === 0) continue;
    const dx = e.x[q.ent] - e.x[down.ent], dy = e.y[q.ent] - e.y[down.ent];
    if (dx * dx + dy * dy < 90 * 90) bonus = Math.max(bonus, r * 1.5);
  }
  return bonus;
}

/** Hero `slot` casts its special (the big sweep or fan). */
export function onSpecial(s: GameState, slot: number): void {
  const pound = rank(s, slot, 'pound');
  const p = s.players[slot];
  if (pound > 0) { queue(s, Fx.Burst, s.ents.x[p.ent], s.ents.y[p.ent], slot, 34 + 6 * pound, 5 + 3 * pound); pop(s, slot, 'pound'); }
}

/** A hero's shot (`damage`) exploded at (x, y): Echo Blast sets it off again. */
export function onExplode(s: GameState, slot: number, x: number, y: number, radius: number, damage: number): void {
  const echo = rank(s, slot, 'echo');
  if (echo > 0) { queue(s, Fx.Burst, x, y, slot, radius * (0.7 + 0.1 * echo), damage * (0.4 + 0.1 * echo)); pop(s, slot, 'echo'); }
}

/** Hero `slot` starts a dodge from (x, y). */
export function onDodge(s: GameState, slot: number, x: number, y: number): void {
  const gift = rank(s, slot, 'gift');
  if (gift > 0) { queue(s, Fx.Burst, x, y, slot, 30 + 5 * gift, 5 + 2 * gift); pop(s, slot, 'gift'); }
  // Wildfire (Farewell + Swift Feet): the dodge lays two more blasts behind the first.
  if (rank(s, slot, 'wildfire') > 0) {
    queue(s, Fx.Burst, x - 20, y - 8, slot, 26, 6);
    queue(s, Fx.Burst, x + 20, y + 8, slot, 26, 6);
    pop(s, slot, 'wildfire');
  }
  // Holy Wrath: the cleric's healing pulse smites too.
  const wrath = rank(s, slot, 'wrath');
  if (wrath > 0) { queue(s, Fx.Burst, x, y, slot, 40 + 6 * wrath, 4 + 3 * wrath); pop(s, slot, 'wrath'); }
  // Arrow Ring: a dodge looses arrows in every direction.
  const ring = rank(s, slot, 'ring');
  const shot = CLASSES[s.players[slot].classId].shot;
  if (ring > 0 && shot) {
    pop(s, slot, 'ring');
    const n = 4 + 2 * ring;
    for (let k = 0; k < n; k++) {
      const a = (k + 0.5) / n;
      const q = allocEntity(s.ents, Kind.Proj, 1 + slot, x, y, shot.ttl);
      if (q < 0) break;
      s.ents.vx[q] = cosTurns(a) * shot.speed;
      s.ents.vy[q] = sinTurns(a) * shot.speed;
      s.ents.flags[q] = shot.pierce ? 2 : 0;
    }
  }
  // Quicksilver: a dodge refills some fury and takes time off the first ability.
  const quick = rank(s, slot, 'quick');
  if (quick > 0) {
    const p = s.players[slot];
    p.fury = Math.min(CLASSES[p.classId].furyMax, p.fury + 12 * quick);
    p.cdAbility1 = Math.max(0, p.cdAbility1 - 15 * quick);
    pop(s, slot, 'quick');
  }
}

/** Hero `slot` has just been hurt. */
export function onHurt(s: GameState, slot: number): void {
  const p = s.players[slot];
  // Iron Recoil: being struck shoves everything close away (it can fire every second).
  const recoil = rank(s, slot, 'recoil');
  const ri = UPGRADE_INDEX.recoil;
  if (recoil > 0 && p.boonCd[ri] === 0) {
    p.boonCd[ri] = 60;
    queue(s, Fx.Burst, s.ents.x[p.ent], s.ents.y[p.ent], slot, 28 + 4 * recoil, 2 + recoil);
    pop(s, slot, 'recoil');
  }
  const last = rank(s, slot, 'last');
  const i = UPGRADE_INDEX.last;
  if (last > 0 && p.boonCd[i] === 0 && !p.downed && s.ents.hp[p.ent] <= CLASSES[p.classId].hp * 0.3) {
    const undying = rank(s, slot, 'undying') > 0; // Undying (Last Stand + Thick Skin): it comes back in half the time, with a longer breath of safety
    p.boonCd[i] = (1800 - 300 * last) / (undying ? 2 : 1);
    p.invuln = Math.max(p.invuln, undying ? 90 : 30);
    queue(s, Fx.Shockwave, s.ents.x[p.ent], s.ents.y[p.ent], slot, 70 + 12 * last, 8 + 3 * last);
    pop(s, slot, 'last');
  }
}

/** Resolve everything queued this tick (effects may queue more, up to the budget). */
export function flushProcs(s: GameState): void {
  const e = s.ents;
  let guard = 0;
  while (s.procN > 0 && guard++ < PROC_CAP * 2) {
    s.procN--;
    const o = s.procN * 6;
    const kind = s.procs[o], x = s.procs[o + 1], y = s.procs[o + 2], owner = s.procs[o + 3], a = s.procs[o + 4], b = s.procs[o + 5];
    if (kind === Fx.Arc) {
      // a = damage per target, b = source mob * 8 + number of targets
      const source = Math.floor(b / 8), targets = b % 8;
      const n = gatherCircle(s.grid, e, x, y, 56, s.procScratch);
      let left = targets;
      for (let k = 0; k < n && left > 0; k++) {
        const m = s.procScratch[k];
        if (m === source || e.alive[m] !== 1 || e.kind[m] !== Kind.Mob) continue;
        const dx = e.x[m] - x, dy = e.y[m] - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        emit(s.events, Ev.Beam, x, y, dx, dy, 2);
        damageMob(s, m, a, dist > 0.001 ? dx / dist : 1, dist > 0.001 ? dy / dist : 0, 1.5, owner, PROC);
        if (rank(s, owner, 'tempest') > 0) queue(s, Fx.Burst, e.x[m], e.y[m], owner, 20, a * 0.6); // Tempest: each spark goes off where it lands
        left--;
      }
      continue;
    }
    // Burst and Shockwave: a ring of damage around (x, y); a = radius, b = damage
    emit(s.events, kind === Fx.Shockwave ? Ev.Nova : Ev.Blast, x, y, a, 0);
    const n = gatherCircle(s.grid, e, x, y, a, s.procScratch);
    for (let k = 0; k < n; k++) {
      const m = s.procScratch[k];
      if (e.alive[m] !== 1 || e.kind[m] !== Kind.Mob) continue;
      const dx = e.x[m] - x, dy = e.y[m] - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      damageMob(s, m, b, dist > 0.001 ? dx / dist : 1, dist > 0.001 ? dy / dist : 0, kind === Fx.Shockwave ? 6 : 3, owner, PROC | PIERCE);
    }
  }
  s.procN = 0;
}

/** Reach of the party boons: allies this close share a banner or a ward. */
const PARTY_REACH = 90;

/** The best rank of boon `id` among standing heroes within reach of hero `slot` (itself included). */
function nearbyRank(s: GameState, slot: number, id: string, reach: number): number {
  const e = s.ents, me = s.players[slot], idx = UPGRADE_INDEX[id];
  let best = 0;
  for (const q of s.players) {
    if (!q.active || q.downed || q.ranks[idx] <= best) continue;
    const dx = e.x[q.ent] - e.x[me.ent], dy = e.y[q.ent] - e.y[me.ent];
    if (dx * dx + dy * dy <= reach * reach) best = q.ranks[idx];
  }
  return best;
}

/** War Banner: damage dealt by hero `slot` while a banner-bearer (itself or an ally) is close. */
export function bannerMul(s: GameState, slot: number): number {
  const cry = nearbyRank(s, slot, 'rallycry', PARTY_REACH * 2) > 0; // War Cry (War Banner + Warding): auras reach twice as far and hit half again as hard
  return 1 + 0.12 * (cry ? 1.5 : 1) * nearbyRank(s, slot, 'banner', cry ? PARTY_REACH * 2 : PARTY_REACH);
}

/** Warding: damage taken by hero `slot` while a warder is close. */
export function wardMul(s: GameState, slot: number): number {
  const cry = nearbyRank(s, slot, 'rallycry', PARTY_REACH * 2) > 0;
  return 1 - 0.1 * (cry ? 1.5 : 1) * nearbyRank(s, slot, 'ward', cry ? PARTY_REACH * 2 : PARTY_REACH);
}

/** Phoenix: a hero who would fall rises once at half health in a burst of flame (once per level; the cooldown outlasts it). Returns true if it saved them. */
export function rebirth(s: GameState, slot: number): boolean {
  const p = s.players[slot], i = UPGRADE_INDEX.phoenix;
  if (p.ranks[i] === 0 || p.boonCd[i] > 0) return false;
  const e = s.ents;
  p.boonCd[i] = 65535;
  e.hp[p.ent] = CLASSES[p.classId].hp * 0.5;
  p.invuln = Math.max(p.invuln, 90);
  queue(s, Fx.Shockwave, e.x[p.ent], e.y[p.ent], slot, 110, 14);
  pop(s, slot, 'phoenix');
  return true;
}

/** Hero `slot` has fallen: a Martyr's death mends the party; an Avenger's allies are filled with power. */
export function onDown(s: GameState, slot: number): void {
  const e = s.ents, me = s.players[slot];
  const martyr = me.ranks[UPGRADE_INDEX.martyr];
  if (martyr > 0) {
    for (const q of s.players) {
      if (q === me || !q.active || q.downed) continue;
      const dx = e.x[q.ent] - e.x[me.ent], dy = e.y[q.ent] - e.y[me.ent];
      if (dx * dx + dy * dy > 140 * 140) continue;
      e.hp[q.ent] = Math.min(CLASSES[q.classId].hp, e.hp[q.ent] + CLASSES[q.classId].hp * 0.2 * martyr);
    }
    queue(s, Fx.Shockwave, e.x[me.ent], e.y[me.ent], slot, 60 + 12 * martyr, 6 + 3 * martyr);
    pop(s, slot, 'martyr');
  }
  for (let k = 0; k < s.players.length; k++) {
    const q = s.players[k];
    if (k === slot || !q.active || q.downed || q.ranks[UPGRADE_INDEX.rally] === 0) continue;
    q.fury = CLASSES[q.classId].furyMax;
    q.cdSpecial = 0; q.cdAbility1 = 0; q.cdDash = 0;
    q.stamina = CLASSES[q.classId].staminaMax; q.winded = false;
    pop(s, k, 'rally');
  }
}

/** Frenzy: attack cooldowns run down half again as fast. Called each tick for a hero. */
export function frenzyTick(s: GameState, slot: number): void {
  const p = s.players[slot];
  if (p.ranks[UPGRADE_INDEX.frenzy] > 0 && (s.tick & 1) === 0) { if (p.cdAttack > 0) p.cdAttack--; }
}
