// The telegraphed special moves of ordinary enemies (docs/03-gameplay-combat.md, "Enemy roster"): lobbed rocks, healing and
// rally pulses, summoning, blinking, stomps and screams, death rays, and what a mob leaves behind when it dies.
// Everything here is data-driven by `MobDef.special` / `MobDef.onDeath`; step.ts only schedules it.
import { ARROW_TTL, Behavior, MOBS, MobType, NovaStyle, Pattern, isBossType, ProjStyle, type ClingSpecial, type DeathDef, type LeapSpecial, type MobDef, type PounceSpecial, type Special } from '../data/mobs';
import { clamp, cosTurns, sinTurns } from '../engine/math';
import { rngFloat, rngRange } from '../engine/rng';
import { VIEW_W, WORLD_H, WORLD_W } from './constants';
import { allocEntity, ELEM_MASK, freeEntity, Kind, PROJ_HOMING, PROJ_PIERCE, ZoneKind } from './entities';
import { elementPulse, powerOf, pulseHero, storePower, strikeHero } from './elements';
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

/** `mode` of a mob in mid-leap (a bullfrog, the Fenlord, a pouncing yeti): it arcs onto the spot it marked (`ax`, `ay`); `wind` counts the ticks left. */
export const SP_LEAP = 9;

/** `mode` of a boss casting one of its specials (modes 1-5 are its own moves; `rem` holds the index in its `moves`). */
export const BOSS_SPECIAL = 8;

/** A shove (a harpoon's haul, a ram's launch) is spread over this many ticks. */
const SHOVE_TICKS = 10;

/** Mob flag (bit 32; 1-16 are taken, see entities.ts): its special's first cooldown has been staggered. */
export const SP_INIT = 32;

/** Burst looks for Ev.Burst. */
export const BurstStyle = {
  Rock: 0, Stomp: 1, Scream: 2, Bones: 3, Poison: 4, Frost: 5, Mire: 6, Sand: 7, Wisp: 8, Hex: 9, Flash: 10,
  /** 32 + an element id: a burst made of that element (colours from data/elements.ts). */
  Element: 32,
} as const;

/** The burst style of a skill: its element's, else the kind's own look. */
const burstOf = (el: number | undefined, plain: number): number => (el ? BurstStyle.Element + el : plain);

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
    case 'gust':
      if (!onScreen(s, x) || dist > sp.radius * 0.9) return false;
      break;
    case 'lure':
      if (!onScreen(s, x) || dist > sp.radius * 0.9 || dist < 24) return false;
      break;
    case 'leap':
    case 'pounce':
      if (!onScreen(s, x) || dist < sp.minRange || dist > sp.maxRange) return false;
      e.ax[i] = e.x[tp]; // it comes down where the hero stands now; moving away dodges it
      e.ay[i] = e.y[tp];
      break;
    case 'hex':
    case 'dazzle':
      if (!onScreen(s, x) || dist < sp.minRange || dist > sp.maxRange) return false;
      e.ax[i] = e.x[tp]; // the mark lands where the hero stands now; moving away dodges it
      e.ay[i] = e.y[tp];
      break;
    case 'pit':
      if (!onScreen(s, x) || dist < sp.minRange || dist > sp.maxRange) return false;
      if (countZones(s, ZoneKind.Pit) >= Math.round(4 * partyScale(activePlayers(s)))) { e.cool2[i] = 40; return false; }
      e.ax[i] = e.x[tp];
      e.ay[i] = e.y[tp];
      break;
    case 'bolt':
    case 'cone':
      if (!onScreen(s, x) || dist < sp.minRange || dist > sp.maxRange) return false;
      e.ax[i] = dirX; // locked: a sidestep dodges it
      e.ay[i] = dirY;
      break;
    case 'ring':
      if (!onScreen(s, x) || dist > sp.maxRange) return false;
      break;
    case 'totem':
      if (!onScreen(s, x) || dist < sp.minRange || dist > sp.maxRange) return false;
      if (countZones(s, ZoneKind.Totem) >= Math.max(1, Math.round(sp.cap * partyScale(activePlayers(s))))) { e.cool2[i] = 60; return false; }
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
      const n = sp.count ?? 1;
      const lay = sp.pattern ? layout(s, sp.pattern, n, sp.spread ?? 0, x, y, e.ax[i], e.ay[i]) : null;
      for (let k = 0; k < n; k++) {
        const [ox, oy] = lay ? [lay[k * 3], lay[k * 3 + 1]] : k === 0 ? [0, 0] : scatter(s, sp.spread ?? 0);
        const z = allocEntity(e, Kind.Zone, ZoneKind.Rock, clamp(e.ax[i] + ox, 0, WORLD_W), clamp(e.ay[i] + oy, 0, WORLD_H), 1);
        if (z < 0) break;
        e.wind[z] = Math.min(255, sp.delay + (lay ? lay[k * 3 + 2] : k * 3)); // a volley lands in a ripple, not all at once
        e.rem[z] = sp.radius;
        e.hp[z] = sp.damage;
        e.flags[z] = sp.element ?? 0;
        e.elite[z] = storePower(sp.power);
        if (sp.residue) { e.ax[z] = sp.residue.radius; e.ay[z] = sp.residue.damage; e.cool2[z] = sp.residue.linger; }
      }
      break;
    }
    case 'trap': {
      const n = sp.count ?? 1;
      const lay = sp.pattern ? layout(s, sp.pattern, n, sp.spread ?? 0, x, y, e.ax[i], e.ay[i]) : null;
      for (let k = 0; k < n; k++) {
        const [ox, oy] = lay ? [lay[k * 3], lay[k * 3 + 1]] : k === 0 && n > 1 ? [0, 0] : scatter(s, sp.spread ?? 0); // a lone trap is off-centre too: it only catches a hero who stays put
        const z = allocEntity(e, Kind.Zone, ZoneKind.Trap, clamp(e.ax[i] + ox, 0, WORLD_W), clamp(e.ay[i] + oy, 6, WORLD_H - 6), 1);
        if (z < 0) break;
        e.flags[z] = sp.element ?? 0;
        e.elite[z] = storePower(sp.power);
        e.wind[z] = sp.arm;
        e.rem[z] = sp.radius;
        e.hp[z] = sp.damage;
        e.cool2[z] = sp.linger;
        e.buff[z] = sp.root;
      }
      break;
    }
    case 'bolt': {
      const el = sp.element ?? 0;
      const flags = (el & ELEM_MASK) | (sp.pierce ? PROJ_PIERCE : 0) | (sp.homing ? PROJ_HOMING : 0);
      for (let k = 0; k < sp.count; k++) {
        const turn = (k - (sp.count - 1) / 2) * sp.spread;
        const c = cosTurns(turn), sn = sinTurns(turn);
        spawnShot(s, x, y, (e.ax[i] * c - e.ay[i] * sn) * sp.speed, (e.ax[i] * sn + e.ay[i] * c) * sp.speed, sp.damage, sp.shape, flags, sp.power, sp.splash ?? 0, ARROW_TTL);
      }
      emit(s.events, Ev.Fire, x, y, e.ax[i], e.ay[i]);
      break;
    }
    case 'ring': {
      const el = sp.element ?? 0;
      const flags = (el & ELEM_MASK) | (sp.pierce ? PROJ_PIERCE : 0);
      const off = rngFloat(s.rngSpawn);
      for (let k = 0; k < sp.count; k++) {
        const a = k / sp.count + off;
        spawnShot(s, x, y, cosTurns(a) * sp.speed, sinTurns(a) * sp.speed * 0.8, sp.damage, sp.shape, flags, sp.power, 0, RING_TTL);
      }
      emit(s.events, Ev.Burst, x, y, 18, burstOf(el, BurstStyle.Rock));
      break;
    }
    case 'cone': {
      const el = sp.element ?? 0, ax = e.ax[i], ay = e.ay[i];
      const cosArc = cosTurns(sp.arc);
      emit(s.events, Ev.Cone, x, y, ax * sp.range, ay * sp.range, sp.arc, el);
      stop(s, 2);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        const along = dx * ax + dy * ay;
        if (along < 0 || along > sp.range) continue;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (along / d >= cosArc) strikeHero(s, k, sp.damage, el, sp.power ?? 1, x, y, i);
      }
      break;
    }
    case 'totem': {
      const tp = s.players[target].ent;
      const dx = e.x[tp] - x, dy = e.y[tp] - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const z = allocEntity(e, Kind.Zone, ZoneKind.Totem, clamp(x + (dx / d) * 22, 0, WORLD_W), clamp(y + (dy / d) * 16, 6, WORLD_H - 6), 1);
      if (z < 0) break;
      e.flags[z] = sp.element ?? 0;
      e.elite[z] = storePower(sp.power);
      e.rem[z] = sp.range;
      e.hp[z] = sp.damage;
      e.ax[z] = sp.speed;
      e.mode[z] = sp.shape;
      e.cool2[z] = sp.lifetime;
      e.buff[z] = sp.interval;
      e.wind[z] = Math.min(255, sp.interval);
      emit(s.events, Ev.Burst, e.x[z], e.y[z], 14, burstOf(sp.element, BurstStyle.Rock));
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
      const n = sp.count ?? 1;
      const lay = sp.pattern ? layout(s, sp.pattern, n, sp.spread ?? 0, x, y, e.ax[i], e.ay[i]) : null;
      for (let k = 0; k < n; k++) {
        const [ox, oy] = lay ? [lay[k * 3], lay[k * 3 + 1]] : k === 0 ? [0, 0] : scatter(s, sp.spread ?? 0);
        const z = allocEntity(e, Kind.Zone, ZoneKind.Storm, clamp(e.ax[i] + ox, 0, WORLD_W), clamp(e.ay[i] + oy, 0, WORLD_H), 1);
        if (z < 0) break;
        e.flags[z] = sp.element ?? 0;
        e.elite[z] = storePower(sp.power);
        e.wind[z] = Math.min(255, sp.delay + (lay ? lay[k * 3 + 2] : k * 4));
        e.rem[z] = sp.radius;
        e.hp[z] = sp.damage;
        e.cool2[z] = sp.linger;
        e.buff[z] = sp.slow;
        if (sp.bog) e.mode[z] = 2; // (a bog: it settles into a poison pool, not black ice)
      }
      break;
    }
    case 'pit': {
      const n = sp.count ?? 1;
      const lay = sp.pattern ? layout(s, sp.pattern, n, sp.spread ?? 0, x, y, e.ax[i], e.ay[i]) : null;
      for (let k = 0; k < n; k++) {
        const [ox, oy] = lay ? [lay[k * 3], lay[k * 3 + 1]] : k === 0 ? [0, 0] : scatter(s, sp.spread ?? 0);
        const z = allocEntity(e, Kind.Zone, ZoneKind.Pit, clamp(e.ax[i] + ox, 0, WORLD_W), clamp(e.ay[i] + oy, 6, WORLD_H - 6), 1);
        if (z < 0) break;
        e.flags[z] = sp.element ?? 0;
        e.elite[z] = storePower(sp.power);
        e.wind[z] = Math.min(255, sp.delay + (lay ? lay[k * 3 + 2] : k * 4));
        e.rem[z] = sp.radius;
        e.hp[z] = sp.damage;
        e.cool2[z] = sp.linger + sp.delay;
        e.ax[z] = sp.pull;
      }
      break;
    }
    case 'leap':
    case 'pounce': {
      if (sp.kind === 'pounce' && target >= 0) { // it springs at where the hero is now, not where it crouched at them
        e.ax[i] = e.x[s.players[target].ent];
        e.ay[i] = e.y[s.players[target].ent];
      }
      e.mode[i] = SP_LEAP;
      e.wind[i] = sp.delay;
      e.vx[i] = 0;
      e.vy[i] = 0;
      e.face[i] = e.ax[i] >= x ? 1 : -1;
      break;
    }
    case 'hex':
    case 'dazzle': {
      emit(s.events, Ev.Burst, e.ax[i], e.ay[i], sp.radius, sp.kind === 'hex' ? BurstStyle.Hex : BurstStyle.Flash);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed || p.invuln > 0) continue; // a dodge-roll slips the mark
        const dx = e.x[p.ent] - e.ax[i], dy = e.y[p.ent] - e.ay[i];
        if (dx * dx + dy * dy > sp.radius * sp.radius) continue;
        if (sp.kind === 'hex') { p.hexT = Math.max(p.hexT, sp.duration); continue; }
        hurtPlayer(s, k, sp.damage);
        p.rootT = Math.max(p.rootT, sp.duration);
        p.silenceT = Math.max(p.silenceT, sp.duration);
      }
      break;
    }
    case 'lure': {
      emit(s.events, Ev.Burst, x, y, sp.radius, BurstStyle.Wisp);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed || p.invuln > 0) continue; // a dodge-roll resists the pull
        const dx = x - e.x[p.ent], dy = y - e.y[p.ent];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > sp.radius || d < 1) continue;
        shovePlayer(s, k, dx / d, dy / d, Math.min(sp.pull, d - 8));
        if (sp.damage > 0) hurtPlayer(s, k, sp.damage);
      }
      break;
    }
    case 'gust': {
      emit(s.events, Ev.Burst, x, y, sp.radius, burstOf(sp.element, BurstStyle.Sand));
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed || p.invuln > 0) continue;
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > sp.radius) continue;
        strikeHero(s, k, sp.damage, sp.element, sp.power ?? 1, x, y, i);
        shovePlayer(s, k, d > 0.5 ? dx / d : e.face[i], d > 0.5 ? dy / d : 0, sp.push);
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
      emit(s.events, Ev.Burst, x, y, sp.radius, burstOf(sp.element, sp.style === NovaStyle.Frost ? BurstStyle.Frost : sp.style === NovaStyle.Scream ? BurstStyle.Scream : BurstStyle.Stomp));
      stop(s, 3);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        if (dx * dx + dy * dy <= sp.radius * sp.radius) strikeHero(s, k, sp.damage, sp.element, sp.power ?? 1, x, y, i, sp.slow);
      }
      break;
    }
    case 'beam': {
      const ax = e.ax[i], ay = e.ay[i];
      emit(s.events, Ev.Beam, x, y, ax * sp.range, ay * sp.range, sp.width, sp.element ?? 0);
      stop(s, 2);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
        const along = dx * ax + dy * ay;
        if (along < 0 || along > sp.range) continue;
        const across = Math.abs(dx * ay - dy * ax);
        if (across <= sp.width + 3) strikeHero(s, k, sp.damage, sp.element, sp.power ?? 1, x, y, i);
      }
      break;
    }
  }
}

/** What the special's telegraph looks like to the renderer: the radius of a ring around the mob, or 0 for none. */
export function specialRing(sp: Special | undefined): number {
  if (!sp) return 0;
  return sp.kind === 'nova' || sp.kind === 'whiteout' || sp.kind === 'wail' || sp.kind === 'gust' ? sp.radius : sp.kind === 'heal' || sp.kind === 'rally' || sp.kind === 'ward' ? sp.radius : 0;
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
      e.mode[a] = d.element ? ProjStyle.Spike : ProjStyle.Shard;
      e.flags[a] = (d.element ?? 0) & ELEM_MASK;
    }
  }
  if (d.cloud) {
    const z = allocEntity(e, Kind.Zone, ZoneKind.Spore, x, y, 1);
    if (z >= 0) {
      e.mode[z] = 1;
      e.rem[z] = d.cloud.radius;
      e.hp[z] = 0;
      e.cool2[z] = d.cloud.linger;
      e.buff[z] = 24;
      e.ax[z] = d.cloud.drain;
      emit(s.events, Ev.Burst, x, y, d.cloud.radius, BurstStyle.Mire);
    }
  }
  if (d.blast) {
    const el = d.element ?? 0;
    emit(s.events, Ev.Burst, x, y, d.blast.radius, burstOf(el, BurstStyle.Stomp));
    for (let k = 0; k < s.players.length; k++) {
      const p = s.players[k];
      if (!p.active || p.downed) continue;
      const dx = e.x[p.ent] - x, dy = e.y[p.ent] - y;
      if (dx * dx + dy * dy <= d.blast.radius * d.blast.radius) strikeHero(s, k, d.blast.damage, el, 1, x, y);
    }
  }
  if (d.pool) {
    const z = allocEntity(e, Kind.Zone, d.element && !d.pool.frost ? ZoneKind.Pool : d.pool.frost ? ZoneKind.Frost : ZoneKind.Poison, x, y, 1);
    if (z >= 0) {
      e.mode[z] = 1;
      e.rem[z] = d.pool.radius;
      e.hp[z] = d.pool.damage;
      e.cool2[z] = d.pool.linger;
      e.buff[z] = d.pool.slow;
      if (d.element && !d.pool.frost) e.flags[z] = d.element & ELEM_MASK;
      emit(s.events, Ev.Burst, x, y, d.pool.radius, d.element && !d.pool.frost ? BurstStyle.Element + d.element : d.pool.frost ? BurstStyle.Frost : BurstStyle.Poison);
    }
  }
}

/** Most puddles of mud on the field at once (a peat brute leaves one every few steps). */
const MUD_CAP = 40;

/** A puddle of slowing mud (no damage) where a peat brute has walked. */
export function dropMud(s: GameState, x: number, y: number, t: { radius: number; linger: number; slow: number }): void {
  const e = s.ents;
  if (countZones(s, ZoneKind.Mud) >= MUD_CAP) return;
  const z = allocEntity(e, Kind.Zone, ZoneKind.Mud, x, y, 1);
  if (z < 0) return;
  e.mode[z] = 1;
  e.rem[z] = t.radius;
  e.hp[z] = 0;
  e.cool2[z] = t.linger;
  e.buff[z] = t.slow;
}

/** Ticks a ring's projectiles fly (they fan out from the caster, so they need not travel as far as an arrow). */
const RING_TTL = 130;

const layoutBuf = new Float64Array(3 * 16);
const MAX_LAYOUT = 16;

/**
 * Where each strike of a multi-strike skill lands, laid out by a `Pattern` round the aim point (`aimX`, `aimY`; the caster stands at `fromX`, `fromY`).
 * Returns a shared buffer of [offsetX, offsetY, extraDelay] per strike (valid until the next call).
 */
export function layout(s: GameState, pattern: number, count: number, spread: number, fromX: number, fromY: number, aimX: number, aimY: number): Float64Array {
  const n = Math.min(count, MAX_LAYOUT);
  let dx = aimX - fromX, dy = aimY - fromY;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
  const out = layoutBuf;
  const put = (k: number, ox: number, oy: number, delay: number): void => { out[k * 3] = ox; out[k * 3 + 1] = oy; out[k * 3 + 2] = delay; };
  const phase = rngFloat(s.rngSpawn);
  for (let k = 0; k < n; k++) {
    switch (pattern) {
      case Pattern.Line: { // along the caster-to-hero line, centred on the hero
        const t = n > 1 ? (k - (n - 1) / 2) * ((2 * spread) / (n - 1)) : 0;
        put(k, dx * t, dy * t * 0.8, k * 3);
        break;
      }
      case Pattern.Wall: { // across the path
        const t = n > 1 ? (k - (n - 1) / 2) * ((2 * spread) / (n - 1)) : 0;
        put(k, -dy * t, dx * t * 0.8, k * 2);
        break;
      }
      case Pattern.Ring: {
        const a = k / n + phase;
        put(k, cosTurns(a) * spread, sinTurns(a) * spread * 0.7, k * 3);
        break;
      }
      case Pattern.Cross: {
        if (k === 0) { put(k, 0, 0, 0); break; }
        const arm = (k - 1) % 4, ring = Math.floor((k - 1) / 4) + 1, rings = Math.ceil((n - 1) / 4);
        const a = arm / 4, r = (spread * ring) / rings;
        put(k, cosTurns(a) * r, sinTurns(a) * r * 0.7, ring * 5);
        break;
      }
      case Pattern.Spiral: {
        const a = k * 0.19 + phase, r = (spread * k) / Math.max(1, n - 1);
        put(k, cosTurns(a) * r, sinTurns(a) * r * 0.7, k * 4);
        break;
      }
      case Pattern.March: { // from the caster toward the hero, one strike after another
        const f = (k + 1) / n;
        put(k, (fromX - aimX) * (1 - f), (fromY - aimY) * (1 - f), k * 5);
        break;
      }
      default: { // scatter
        if (k === 0) put(k, 0, 0, 0);
        else { const [ox, oy] = scatter(s, spread); put(k, ox, oy, k * 3); }
      }
    }
  }
  return out;
}

/** Launches one mob projectile of an element (or a plain one): `shape` is a `ProjStyle`; `flags` carry the element and the pierce/homing bits (entities.ts). */
export function spawnShot(s: GameState, x: number, y: number, vx: number, vy: number, damage: number, shape: number, flags: number, power: number | undefined, splash: number, ttl: number): number {
  const e = s.ents;
  const a = allocEntity(e, Kind.Proj, 0, x, y, ttl);
  if (a < 0) return -1;
  e.vx[a] = vx;
  e.vy[a] = vy;
  e.rem[a] = damage;
  e.mode[a] = shape;
  e.flags[a] = flags;
  e.elite[a] = storePower(power);
  e.wind[a] = Math.min(255, Math.round(splash));
  e.ax[a] = x;
  e.ay[a] = y;
  return a;
}

/** A pool of an element on the ground: bites `damage` every so often and applies the element's pulse while a hero stands in it. */
export function dropPool(s: GameState, x: number, y: number, element: number, radius: number, damage: number, linger: number, power: number): void {
  const e = s.ents;
  const z = allocEntity(e, Kind.Zone, ZoneKind.Pool, x, y, 1);
  if (z < 0) return;
  e.mode[z] = 1;
  e.rem[z] = radius;
  e.hp[z] = damage;
  e.cool2[z] = linger;
  e.buff[z] = 0;
  e.flags[z] = element;
  e.elite[z] = storePower(power);
  emit(s.events, Ev.Burst, x, y, radius, burstOf(element, BurstStyle.Rock));
}

/** A planted totem: every `interval` ticks it fires at the nearest hero in range, until its lifetime runs out. */
function totemStep(s: GameState, i: number): void {
  const e = s.ents;
  if (--e.cool2[i] <= 0) { emit(s.events, Ev.Burst, e.x[i], e.y[i], 10, burstOf(e.flags[i] & ELEM_MASK, BurstStyle.Rock)); freeEntity(e, i); return; }
  if (--e.wind[i] > 0) return;
  e.wind[i] = Math.min(255, e.buff[i]);
  let best = -1, bestD = e.rem[i] * e.rem[i];
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active || p.downed) continue;
    const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i], d2 = dx * dx + dy * dy;
    if (d2 < bestD) { bestD = d2; best = k; }
  }
  if (best < 0) return;
  const tp = s.players[best].ent;
  const dx = e.x[tp] - e.x[i], dy = e.y[tp] - e.y[i], d = Math.sqrt(dx * dx + dy * dy) || 1;
  spawnShot(s, e.x[i], e.y[i], (dx / d) * e.ax[i], (dy / d) * e.ax[i], e.hp[i], e.mode[i], e.flags[i] & ELEM_MASK, powerOf(e.elite[i]), 0, 150);
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
    const el = e.flags[i] & ELEM_MASK;
    emit(s.events, Ev.Burst, e.x[i], e.y[i], r + 4, burstOf(el, BurstStyle.Bones));
    strikeHero(s, k, e.hp[i], el, powerOf(e.elite[i]), e.x[i], e.y[i]);
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
    if (sp.element) elementPulse(s, slot, sp.element, sp.power ?? 1, e.x[i], e.y[i]);
  }
}

/** The leap a mob can make: its own special, or (for a boss) the one among its moves. */
function leapOf(def: MobDef): LeapSpecial | PounceSpecial | undefined {
  if (def.special?.kind === 'leap' || def.special?.kind === 'pounce') return def.special;
  for (const mv of def.boss?.moves ?? []) if (mv.kind === 'special' && mv.special.kind === 'leap') return mv.special;
  return undefined;
}

/** A mob in mid-leap: it arcs toward the spot it marked and comes down on it (a stomp that hurts and slows whoever is under it). */
export function leapStep(s: GameState, i: number, def: MobDef): void {
  const e = s.ents;
  const sp = leapOf(def);
  const left = e.wind[i];
  if (!sp || left <= 0) { e.mode[i] = 0; e.z[i] = 0; return; }
  e.x[i] += (e.ax[i] - e.x[i]) / left;
  e.y[i] += (e.ay[i] - e.y[i]) / left;
  e.z[i] = sinTurns((1 - left / sp.delay) * 0.5) * (sp.kind === 'pounce' ? 4 + def.radius * 0.5 : 6 + def.radius); // a pounce is a low, flat bound
  e.wind[i] = left - 1;
  if (e.wind[i] > 0) return;
  e.mode[i] = 0;
  e.z[i] = 0;
  const pounce = sp.kind === 'pounce';
  e.stun[i] = def.behavior === Behavior.Boss ? 20 : pounce ? 6 : 16; // it lands heavily (a pouncer lands ready to swing)
  emit(s.events, Ev.Burst, e.x[i], e.y[i], sp.radius, burstOf(sp.element, pounce ? BurstStyle.Stomp : BurstStyle.Mire));
  stop(s, def.behavior === Behavior.Boss ? 5 : 2);
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active || p.downed) continue;
    const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
    if (dx * dx + dy * dy <= sp.radius * sp.radius) strikeHero(s, k, sp.damage, sp.element, sp.power ?? 1, e.x[i], e.y[i], i, pounce ? 0 : sp.slow);
  }
}

/** A sand pit: opens after its delay, then drags heroes toward its centre and bites whoever reaches it. A dodge-roll is not pulled. */
function pitStep(s: GameState, i: number): void {
  const e = s.ents;
  if (--e.cool2[i] <= 0) { freeEntity(e, i); return; }
  const r = e.rem[i];
  if (e.mode[i] === 0) {
    if (--e.wind[i] > 0) return;
    e.mode[i] = 1;
    emit(s.events, Ev.Burst, e.x[i], e.y[i], r, burstOf(e.flags[i] & ELEM_MASK, BurstStyle.Sand));
    return;
  }
  const bite = (s.tick + i) % POOL_PULSE === 0;
  const pel = e.flags[i] & ELEM_MASK;
  for (let k = 0; k < s.players.length; k++) {
    const p = s.players[k];
    if (!p.active || p.downed || p.dashT > 0) continue;
    const dx = e.x[i] - e.x[p.ent], dy = (e.y[i] - e.y[p.ent]) * 1.3;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) continue;
    const d = Math.sqrt(d2) || 1;
    const step = Math.min(e.ax[i], d);
    e.x[p.ent] += (dx / d) * step;
    e.y[p.ent] += ((e.y[i] - e.y[p.ent]) / d) * step;
    if (p.slowT < 12) p.slowT = 12;
    if (bite && d < r * 0.3) hurtPlayer(s, k, e.hp[i], 0, HURT_DOT);
    if (bite && pel) elementPulse(s, k, pel, powerOf(e.elite[i]), e.x[i], e.y[i]);
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
    if (e.sub[i] === ZoneKind.Pit) { pitStep(s, i); continue; }
    if (e.sub[i] === ZoneKind.Totem) { totemStep(s, i); continue; }
    if (e.sub[i] === ZoneKind.Storm) {
      // the blizzard gathers where the witch aimed, then settles into a pool of black ice
      if (--e.wind[i] > 0) continue;
      const bog = e.mode[i] === 2;
      const sel = e.flags[i] & ELEM_MASK;
      e.sub[i] = sel ? ZoneKind.Pool : bog ? ZoneKind.Poison : ZoneKind.Frost;
      e.mode[i] = 1;
      e.atk[i] = 0;
      emit(s.events, Ev.Burst, e.x[i], e.y[i], r, burstOf(sel, bog ? BurstStyle.Mire : BurstStyle.Frost));
      continue;
    }
    if (e.mode[i] === 0) {
      if (--e.wind[i] > 0) continue;
      const lel = e.flags[i] & ELEM_MASK;
      emit(s.events, Ev.Burst, e.x[i], e.y[i], r, burstOf(lel, BurstStyle.Rock));
      stop(s, 2);
      for (let k = 0; k < s.players.length; k++) {
        const p = s.players[k];
        if (!p.active || p.downed) continue;
        const dx = e.x[p.ent] - e.x[i], dy = e.y[p.ent] - e.y[i];
        if (dx * dx + dy * dy <= r * r) strikeHero(s, k, e.hp[i], lel, powerOf(e.elite[i]), e.x[i], e.y[i]);
      }
      if (lel && e.cool2[i] > 0) dropPool(s, e.x[i], e.y[i], lel, e.ax[i], e.ay[i], e.cool2[i], powerOf(e.elite[i]));
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
      if (e.sub[i] === ZoneKind.Spore) { // spores: breathing them in saps the stamina
        p.stamina = Math.max(0, p.stamina - e.ax[i]);
        p.staminaDelay = Math.max(p.staminaDelay, 24);
      }
      if (e.sub[i] === ZoneKind.Pool) { if (bite) pulseHero(s, k, e.hp[i], e.flags[i] & ELEM_MASK, powerOf(e.elite[i]), e.x[i], e.y[i]); continue; }
      if (bite && e.hp[i] > 0) hurtPlayer(s, k, e.hp[i], 0, HURT_DOT);
    }
  }
}

/** True for the mobs that hold a `special` and use `cool2` as its cooldown. */
export function hasSpecial(def: MobDef): boolean {
  return def.special !== undefined && def.behavior !== Behavior.Boss;
}
