// The telegraphed special moves of ordinary enemies (docs/03-gameplay-combat.md, "Enemy roster"): lobbed rocks, healing and
// rally pulses, summoning, blinking, stomps and screams, death rays, and what a mob leaves behind when it dies.
// Everything here is data-driven by `MobDef.special` / `MobDef.onDeath`; step.ts only schedules it.
import { Behavior, MOBS, MobType, NovaStyle, isBossType, ProjStyle, type ClingSpecial, type DeathDef, type MobDef, type Special } from '../data/mobs';
import { clamp, cosTurns, sinTurns } from '../engine/math';
import { rngFloat, rngRange } from '../engine/rng';
import { VIEW_W, WORLD_H, WORLD_W } from './constants';
import { allocEntity, freeEntity, Kind, ZoneKind } from './entities';
import type { Entities } from './entities';
import { Ev, emit } from './events';
import { activePlayers, partyScale } from './gen/level';
import { gatherCircle } from './grid';
import type { GameState } from './state';
import { hurtPlayer, HURT_DOT, stop } from './step';

/** `mode` of a mob in the middle of a special's telegraph (modes 1-2 are the bull charge, 3-5 the boss's moves). */
export const SP_WIND = 6;

/** `mode` of a snow sprite clinging to a hero (`rem` = the hero's slot). */
export const SP_CLING = 7;

/** `mode` of a boss casting one of its specials (modes 1-5 are its own moves; `rem` holds the index in its `moves`). */
export const BOSS_SPECIAL = 8;

/** A shove (a harpoon's haul, a ram's launch) is spread over this many ticks. */
const SHOVE_TICKS = 10;

/** Mob flag (bit 32; 1-16 are taken, see entities.ts): its special's first cooldown has been staggered. */
export const SP_INIT = 32;

/** Burst looks for Ev.Burst. */
export const BurstStyle = { Rock: 0, Stomp: 1, Scream: 2, Bones: 3, Poison: 4, Frost: 5 } as const;

/** A frenzied (rallied) mob moves and attacks this much faster. */
export const RALLY_SPEED = 1.35;

/** How long a thrown shard flies, in ticks. */
const SHARD_TTL = 36;

/** How often a poison pool bites, in ticks. */
const POOL_PULSE = 20;

export function onScreen(s: GameState, x: number): boolean {
  return x > s.camX + 6 && x < s.camX + VIEW_W - 6;
}

function isMob(e: GameState['ents'], m: number): boolean {
  return e.alive[m] === 1 && e.kind[m] === Kind.Mob && !isBossType(e.sub[m]);
}

function countType(s: GameState, type: number): number {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && e.sub[i] === type) n++;
  return n;
}

function countZones(s: GameState, sub: number): number {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Zone && e.sub[i] === sub) n++;
  return n;
}

/** How many mobs are winding up a storm right now (their zones do not exist yet, but will). */
function stormsCasting(s: GameState): number {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && e.mode[i] === SP_WIND && MOBS[e.sub[i]].special?.kind === 'storm') n++;
  return n;
}

/** How many snow sprites are clinging to hero `slot`. */
function clingersOn(s: GameState, slot: number): number {
  const e = s.ents;
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && e.mode[i] === SP_CLING && e.rem[i] === slot) n++;
  return n;
}

/** A frost-shaman ward is up on mob `m` (its timer lives in `cool`, which only chargers use otherwise, and no charger is ever warded). */
export function isWarded(e: Entities, m: number): boolean {
  return e.cool[m] > 0 && !MOBS[e.sub[m]].charge;
}

/** Fling hero `slot` `dist` pixels along (`dx`, `dy`), spread over a few ticks (the caller passes a unit vector). */
export function shovePlayer(s: GameState, slot: number, dx: number, dy: number, dist: number): void {
  const p = s.players[slot];
  p.pullT = SHOVE_TICKS;
  p.pullX = (dx * dist) / SHOVE_TICKS;
  p.pullY = (dy * dist) / SHOVE_TICKS;
}

/**
 * Called once the mob is free to act and its special is off cooldown. Starts the telegraph (and returns true) when the
 * situation calls for the move; otherwise returns false and the mob goes on with its ordinary behaviour.
 */
export function startSpecial(s: GameState, i: number, def: MobDef, target: number, dist: number, dirX: number, dirY: number): boolean {
  return startSpecialOf(s, i, def.special!, target, dist, dirX, dirY);
}

/** `startSpecial` for an explicit special (a boss draws among several). */
export function startSpecialOf(s: GameState, i: number, sp: Special, target: number, dist: number, dirX: number, dirY: number): boolean {
  const e = s.ents;
  const x = e.x[i], y = e.y[i];
  const tp = s.players[target].ent;
  switch (sp.kind) {
    case 'lob':
      if (!onScreen(s, x) || dist < sp.minRange || dist > sp.maxRange) return false;
      e.ax[i] = e.x[tp]; // the rock lands where the hero stands now; moving away dodges it
      e.ay[i] = e.y[tp];
      break;
    case 'beam':
      if (!onScreen(s, x) || dist > sp.range) return false;
      e.ax[i] = dirX;
      e.ay[i] = dirY;
      break;
    case 'nova':
      if (!onScreen(s, x) || dist > sp.radius * 0.9) return false;
      break;
    case 'blink':
      if (dist < sp.minRange || dist > sp.maxRange) return false;
      break;
    case 'trap': {
      if (!onScreen(s, x) || dist < sp.minRange || dist > sp.maxRange) return false;
      if (countZones(s, ZoneKind.Trap) >= Math.round(sp.cap * 4 * partyScale(activePlayers(s)))) { e.cool2[i] = 60; return false; }
      const p = s.players[target];
      e.ax[i] = clamp(e.x[tp] + p.faceX * 22, s.camX + 8, s.camX + VIEW_W - 8); // set where the hero is heading
      e.ay[i] = clamp(e.y[tp] + p.faceY * 14, 6, WORLD_H - 6);
      break;
    }
    case 'cling':
      if (dist > sp.range || s.players[target].dashT > 0 || clingersOn(s, target) >= sp.cap) return false;
      break;
    case 'storm':
      if (!onScreen(s, x) || dist < sp.minRange || dist > sp.maxRange) return false;
      if (sp.cap !== undefined && countZones(s, ZoneKind.Storm) + countZones(s, ZoneKind.Frost) + stormsCasting(s) * (sp.count ?? 1) + (sp.count ?? 1) > Math.round(sp.cap * partyScale(activePlayers(s)))) { e.cool2[i] = 40; return false; }
      e.ax[i] = e.x[tp];
      e.ay[i] = e.y[tp];
      break;
    case 'whiteout':
    case 'wail':
      if (!onScreen(s, x) || dist > sp.radius * 0.9) return false;
      break;
    case 'ward': {
      const n = gatherCircle(s.grid, e, x, y, sp.radius, s.scratch);
      let fresh = 0;
      for (let k = 0; k < n; k++) {
        const m = s.scratch[k];
        if (m !== i && isMob(e, m) && !MOBS[e.sub[m]].charge && e.cool[m] === 0) fresh++;
      }
      if (fresh < sp.need) { e.cool2[i] = 20; return false; }
      break;
    }
    case 'summon': {
      if (!onScreen(s, x)) return false;
      if (countType(s, sp.type) >= Math.round(sp.cap * partyScale(activePlayers(s)))) { e.cool2[i] = 40; return false; }
      break;
    }
    case 'heal': {
      const n = gatherCircle(s.grid, e, x, y, sp.radius, s.scratch);
      let hurt = false;
      for (let k = 0; k < n && !hurt; k++) {
        const m = s.scratch[k];
        if (m !== i && isMob(e, m) && e.hp[m] < e.maxhp[m] * 0.65) hurt = true;
      }
      if (!hurt) { e.cool2[i] = 20; return false; }
      break;
    }
    case 'rally': {
      const n = gatherCircle(s.grid, e, x, y, sp.radius, s.scratch);
      let fresh = 0;
      for (let k = 0; k < n; k++) {
        const m = s.scratch[k];
        if (m !== i && isMob(e, m) && e.buff[m] === 0) fresh++;
      }
      if (fresh < 3) { e.cool2[i] = 20; return false; }
      break;
    }
  }
  e.mode[i] = SP_WIND;
  e.wind[i] = sp.windup;
  return true;
}

/** The telegraph ran out: the move happens. */
export function fireSpecial(s: GameState, i: number, def: MobDef, target: number): void {
  fireSpecialOf(s, i, def.special!, target);
}

/** A random spot within `spread` px of the origin, flattened a little (the field is wide and shallow). */
function scatter(s: GameState, spread: number): [number, number] {
  const a = rngFloat(s.rngSpawn), r = spread * Math.sqrt(rngFloat(s.rngSpawn));
  return [cosTurns(a) * r, sinTurns(a) * r * 0.7];
}

/** `fireSpecial` for an explicit special (a boss draws among several). */
export function fireSpecialOf(s: GameState, i: number, sp: Special, target: number): void {
  const e = s.ents;
  e.mode[i] = 0;
  // a trapper's snares come at irregular intervals, so there is always another to dodge instead of one volley
  e.cool2[i] = sp.kind === 'trap' ? Math.round(sp.cooldown * (0.4 + 1.4 * rngFloat(s.rngSpawn))) : sp.cooldown;
  const x = e.x[i], y = e.y[i];
  switch (sp.kind) {
    case 'lob': {
      for (let k = 0; k < (sp.count ?? 1); k++) {
        const [ox, oy] = k === 0 ? [0, 0] : scatter(s, sp.spread ?? 0);
        const z = allocEntity(e, Kind.Zone, ZoneKind.Rock, clamp(e.ax[i] + ox, 0, WORLD_W), clamp(e.ay[i] + oy, 0, WORLD_H), 1);
        if (z < 0) break;
        e.wind[z] = sp.delay + k * 3; // a volley lands in a ripple, not all at once
        e.rem[z] = sp.radius;
        e.hp[z] = sp.damage;
      }
      break;
    }
    case 'trap': {
      for (let k = 0; k < (sp.count ?? 1); k++) {
        const [ox, oy] = k === 0 && (sp.count ?? 1) > 1 ? [0, 0] : scatter(s, sp.spread ?? 0); // a lone trap is off-centre too: it only catches a hero who stays put
        const z = allocEntity(e, Kind.Zone, ZoneKind.Trap, clamp(e.ax[i] + ox, 0, WORLD_W), clamp(e.ay[i] + oy, 6, WORLD_H - 6), 1);
        if (z < 0) break;
        e.wind[z] = sp.arm;
        e.rem[z] = sp.radius;
        e.hp[z] = sp.damage;
        e.cool2[z] = sp.linger;
        e.buff[z] = sp.root;
      }
      break;
    }
    case 'cling': {
      const p = s.players[target];
      const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
      if (p.downed || p.dashT > 0 || dx * dx + dy * dy > sp.range * sp.range * 2.5) break; // it leapt and missed
      e.mode[i] = SP_CLING;
      e.rem[i] = target;
      e.wind[i] = sp.pulse;
      e.vx[i] = 0;
      e.vy[i] = 0;
      break;
    }
    case 'storm': {
      for (let k = 0; k < (sp.count ?? 1); k++) {
        const [ox, oy] = k === 0 ? [0, 0] : scatter(s, sp.spread ?? 0);
        const z = allocEntity(e, Kind.Zone, ZoneKind.Storm, clamp(e.ax[i] + ox, 0, WORLD_W), clamp(e.ay[i] + oy, 0, WORLD_H), 1);
        if (z < 0) break;
        e.wind[z] = sp.delay + k * 4;
        e.rem[z] = sp.radius;
        e.hp[z] = sp.damage;
        e.cool2[z] = sp.linger;
        e.buff[z] = sp.slow;
      }
      break;
    }
    case 'whiteout': {
      emit(s.events, Ev.Burst, x, y, sp.radius, BurstStyle.Frost);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed || p.invuln > 0) continue; // a dodge-roll slips through the gust
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        if (dx * dx + dy * dy > sp.radius * sp.radius) continue;
        hurtPlayer(s, k, sp.damage);
        p.confuseT = Math.max(p.confuseT, sp.duration);
      }
      break;
    }
    case 'wail': {
      emit(s.events, Ev.Burst, x, y, sp.radius, BurstStyle.Scream);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed || p.invuln > 0) continue;
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        if (dx * dx + dy * dy > sp.radius * sp.radius) continue;
        hurtPlayer(s, k, sp.damage);
        p.silenceT = Math.max(p.silenceT, sp.duration);
      }
      break;
    }
    case 'ward': {
      emit(s.events, Ev.Burst, x, y, sp.radius, BurstStyle.Frost);
      const n = gatherCircle(s.grid, e, x, y, sp.radius, s.scratch);
      for (let k = 0; k < n; k++) {
        const m = s.scratch[k];
        if (m !== i && isMob(e, m) && !MOBS[e.sub[m]].charge) e.cool[m] = sp.duration;
      }
      break;
    }
    case 'summon': {
      const r = s.rngSpawn;
      for (let k = 0; k < sp.count; k++) {
        if (e.capacity - e.count < 120) break;
        const ang = rngFloat(r);
        const mx = clamp(x + cosTurns(ang) * 14, 0, WORLD_W), my = clamp(y + sinTurns(ang) * 10, 6, WORLD_H - 6);
        const m = allocEntity(e, Kind.Mob, sp.type, mx, my, MOBS[sp.type].hp);
        if (m < 0) break;
        e.flags[m] = 1;
        e.face[m] = e.face[i];
        e.stun[m] = 16; // clawing out of the ground
        emit(s.events, Ev.Summon, mx, my);
      }
      emit(s.events, Ev.Summon, x, y);
      break;
    }
    case 'heal': {
      emit(s.events, Ev.HealMob, x, y, sp.radius);
      const n = gatherCircle(s.grid, e, x, y, sp.radius, s.scratch);
      for (let k = 0; k < n; k++) {
        const m = s.scratch[k];
        if (m === i || !isMob(e, m)) continue;
        e.hp[m] = Math.min(e.maxhp[m], e.hp[m] + e.maxhp[m] * sp.amount);
      }
      break;
    }
    case 'rally': {
      emit(s.events, Ev.Rally, x, y, sp.radius);
      const n = gatherCircle(s.grid, e, x, y, sp.radius, s.scratch);
      for (let k = 0; k < n; k++) {
        const m = s.scratch[k];
        if (m !== i && isMob(e, m)) e.buff[m] = sp.duration;
      }
      break;
    }
    case 'blink': {
      const tp = s.players[target].ent;
      const ang = rngFloat(s.rngCombat);
      const nx = clamp(e.x[tp] + cosTurns(ang) * 16, s.camX + 8, s.camX + VIEW_W - 8);
      const ny = clamp(e.y[tp] + sinTurns(ang) * 12, 6, WORLD_H - 6);
      emit(s.events, Ev.Blink, x, y, nx, ny);
      e.x[i] = nx;
      e.y[i] = ny;
      e.px[i] = nx;
      e.py[i] = ny;
      e.vx[i] = 0;
      e.vy[i] = 0;
      e.face[i] = e.x[tp] >= nx ? 1 : -1;
      e.atk[i] = 0; // it arrives ready to strike (the strike still has its own windup)
      break;
    }
    case 'nova': {
      emit(s.events, Ev.Burst, x, y, sp.radius, sp.style === NovaStyle.Frost ? BurstStyle.Frost : sp.style === NovaStyle.Scream ? BurstStyle.Scream : BurstStyle.Stomp);
      stop(s, 3);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        if (dx * dx + dy * dy <= sp.radius * sp.radius) hurtPlayer(s, k, sp.damage, sp.slow);
      }
      break;
    }
    case 'beam': {
      const ax = e.ax[i], ay = e.ay[i];
      emit(s.events, Ev.Beam, x, y, ax * sp.range, ay * sp.range, sp.width);
      stop(s, 2);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        const along = dx * ax + dy * ay;
        if (along < 0 || along > sp.range) continue;
        const across = Math.abs(dx * ay - dy * ax);
        if (across <= sp.width + 3) hurtPlayer(s, k, sp.damage);
      }
      break;
    }
  }
}

/** What the special's telegraph looks like to the renderer: the radius of a ring around the mob, or 0 for none. */
export function specialRing(sp: Special | undefined): number {
  if (!sp) return 0;
  return sp.kind === 'nova' || sp.kind === 'whiteout' || sp.kind === 'wail' ? sp.radius : sp.kind === 'heal' || sp.kind === 'rally' || sp.kind === 'ward' ? sp.radius : 0;
}

/** A mob has just been killed at its slot `m` (still allocated): break apart, or leave something behind. */
export function onMobDeath(s: GameState, m: number, d: DeathDef, dirX: number, dirY: number): void {
  const e = s.ents;
  const x = e.x[m], y = e.y[m];
  if (d.split) {
    emit(s.events, Ev.Burst, x, y, 14, BurstStyle.Bones);
    const r = s.rngSpawn;
    for (let k = 0; k < d.split.count; k++) {
      if (e.capacity - e.count < 120) break;
      const ang = (k + rngRange(r, 0, 0.5)) / d.split.count;
      const c = allocEntity(e, Kind.Mob, d.split.type, x, y, MOBS[d.split.type].hp);
      if (c < 0) break;
      e.flags[c] = 1;
      e.face[c] = e.face[m];
      e.vx[c] = cosTurns(ang) * 2.4 + dirX * 0.8;
      e.vy[c] = sinTurns(ang) * 1.5 + dirY * 0.5;
      e.stun[c] = 10;
    }
  }
  if (d.shards) {
    emit(s.events, Ev.Burst, x, y, 16, BurstStyle.Frost);
    const off = rngRange(s.rngSpawn, 0, 1 / d.shards.count);
    for (let k = 0; k < d.shards.count; k++) {
      if (e.capacity - e.count < 120) break;
      const ang = k / d.shards.count + off;
      const a = allocEntity(e, Kind.Proj, 0, x, y, SHARD_TTL);
      if (a < 0) break;
      e.vx[a] = cosTurns(ang) * d.shards.speed;
      e.vy[a] = sinTurns(ang) * d.shards.speed * 0.8;
      e.rem[a] = d.shards.damage;
      e.mode[a] = ProjStyle.Shard;
    }
  }
  if (d.pool) {
    const z = allocEntity(e, Kind.Zone, d.pool.frost ? ZoneKind.Frost : ZoneKind.Poison, x, y, 1);
    if (z >= 0) {
      e.mode[z] = 1;
      e.rem[z] = d.pool.radius;
      e.hp[z] = d.pool.damage;
      e.cool2[z] = d.pool.linger;
      e.buff[z] = d.pool.slow;
      emit(s.events, Ev.Burst, x, y, d.pool.radius, d.pool.frost ? BurstStyle.Frost : BurstStyle.Poison);
    }
  }
}

/** A snare: arms (`mode` 0 to 2), then snaps shut on the first hero to step in, rooting them. A dodge-roll passes over it. */
function trapStep(s: GameState, i: number): void {
  const e = s.ents;
  if (e.mode[i] === 0 && --e.wind[i] <= 0) e.mode[i] = 2;
  if (--e.cool2[i] <= 0) { freeEntity(e, i); return; }
  if (e.mode[i] !== 2) return;
  const r = e.rem[i];
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active || p.downed || p.invuln > 0) continue;
    const dx = e.x[p.ent] - e.x[i], dy = (e.y[p.ent] - e.y[i]) * 1.3;
    if (dx * dx + dy * dy > r * r) continue;
    emit(s.events, Ev.Burst, e.x[i], e.y[i], r + 4, BurstStyle.Bones);
    hurtPlayer(s, k, e.hp[i]);
    p.rootT = Math.max(p.rootT, e.buff[i]);
    freeEntity(e, i);
    return;
  }
}

/** A snow sprite on a hero's back: it rides along, gnawing and slowing, until it is killed, knocked loose, or the hero rolls it off. */
export function clingStep(s: GameState, i: number, def: MobDef): void {
  const e = s.ents;
  const sp = def.special as ClingSpecial;
  const slot = e.rem[i];
  const p = s.players[slot];
  if (!p || !p.active || p.downed || p.dashT > 0 || e.stun[i] > 0) {
    e.mode[i] = 0;
    e.stun[i] = Math.max(e.stun[i], 24); // shaken off, and dazed for a moment
    return;
  }
  const tp = p.ent;
  e.x[i] = e.x[tp] + ((i * 7) % 9) - 4;
  e.y[i] = e.y[tp] + 1;
  e.vx[i] = 0;
  e.vy[i] = 0;
  e.face[i] = p.faceX >= 0 ? -1 : 1;
  if (--e.wind[i] <= 0) {
    e.wind[i] = sp.pulse;
    hurtPlayer(s, slot, sp.damage, sp.slow, HURT_DOT);
  }
}

/** Ground zones: a lobbed rock waiting to land, poison and frost pools that linger, snares, and gathering storms. */
export function updateZones(s: GameState): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (e.kind[i] !== Kind.Zone) continue;
    if (e.sub[i] === ZoneKind.Rain) continue; // the archer's rain runs in step.ts
    if (e.x[i] < s.camX - 60) { freeEntity(e, i); continue; }
    const r = e.rem[i];
    if (e.sub[i] === ZoneKind.Trap) { trapStep(s, i); continue; }
    if (e.sub[i] === ZoneKind.Storm) {
      // the blizzard gathers where the witch aimed, then settles into a pool of black ice
      if (--e.wind[i] > 0) continue;
      e.sub[i] = ZoneKind.Frost;
      e.mode[i] = 1;
      e.atk[i] = 0;
      emit(s.events, Ev.Burst, e.x[i], e.y[i], r, BurstStyle.Frost);
      continue;
    }
    if (e.mode[i] === 0) {
      if (--e.wind[i] > 0) continue;
      emit(s.events, Ev.Burst, e.x[i], e.y[i], r, BurstStyle.Rock);
      stop(s, 2);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
        if (dx * dx + dy * dy <= r * r) hurtPlayer(s, k, e.hp[i]);
      }
      freeEntity(e, i);
      continue;
    }
    // A pool: bites every few ticks while a hero stands in it.
    if (--e.cool2[i] <= 0) { freeEntity(e, i); continue; }
    const bite = ++e.atk[i] >= POOL_PULSE;
    if (bite) e.atk[i] = 0;
    for (let k = 0; k < s.players.length; k++) {
      const p = s.players[k];
      if (!p.active || p.downed) continue;
      const dx = e.x[p.ent] - e.x[i], dy = (e.y[p.ent] - e.y[i]) * 1.3; // pools are drawn flattened
      if (dx * dx + dy * dy > r * r) continue;
      if (e.buff[i] > p.slowT) p.slowT = e.buff[i];
      if (bite) hurtPlayer(s, k, e.hp[i], 0, HURT_DOT);
    }
  }
}

/** True for the mobs that hold a `special` and use `cool2` as its cooldown. */
export function hasSpecial(def: MobDef): boolean {
  return def.special !== undefined && def.behavior !== Behavior.Boss;
}
