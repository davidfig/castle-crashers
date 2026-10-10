// What a player can see this tick. One pass over the entities (shared by every pilot in the party), then a per-hero view of the foes
// nearest to them. Nothing here is hidden information: it is the screen, read the way a person would read it.
import { CLASSES, type ClassDef } from '../data/classes';
import { Behavior, MOBS, isBossType, type MobDef } from '../data/mobs';
import { VIEW_W, WORLD_H } from '../sim/constants';
import { BYSTANDER, Kind, SURRENDERED } from '../sim/entities';
import { gatherCircle } from '../sim/grid';
import type { GameState } from '../sim/state';

/** Foes tracked per hero (the nearest this many). Everything else only counts toward the crowd tallies. */
export const MAX_NEAR = 24;
/** How far a hero looks for foes to fight. */
export const SIGHT = 260;
const CAP = 512;

/** Mob flag bit 8 (entities.ts): retreating. */
const RETREATING = 8;

/** The shared, once-per-tick part of perception. */
export interface Scan {
  state: GameState | null;
  tick: number;
  projN: number; proj: Int32Array;
  zoneN: number; zone: Int32Array;
  coinN: number; coin: Int32Array;
  potN: number; pot: Int32Array;
  siteN: number; site: Int32Array;
  /** Mobs mid-telegraph or mid-charge anywhere on the field (what a player can read from a distance). */
  teleN: number; tele: Int32Array;
  /** Hostile mobs on screen or about to be (the gate's definition). */
  hostiles: number;
}

const scan: Scan = {
  state: null, tick: -1,
  projN: 0, proj: new Int32Array(CAP),
  zoneN: 0, zone: new Int32Array(CAP),
  coinN: 0, coin: new Int32Array(CAP),
  potN: 0, pot: new Int32Array(CAP),
  siteN: 0, site: new Int32Array(64),
  teleN: 0, tele: new Int32Array(CAP),
  hostiles: 0,
};

/** Is mob `i` a live enemy that fights (not a bystander, a surrendered foe, one leaving, or one still underground)? */
export function isHostile(s: GameState, i: number): boolean {
  const e = s.ents;
  if (!e.alive[i] || e.kind[i] !== Kind.Mob) return false;
  if (e.flags[i] & (BYSTANDER | SURRENDERED | RETREATING)) return false;
  const def = MOBS[e.sub[i]];
  if (def.burrow && e.rem[i] === 0) return false;
  return true;
}

/** Scan the field once per tick (cached by state and tick, so a party of four pays once). */
export function scanWorld(s: GameState): Scan {
  if (scan.state === s && scan.tick === s.tick) return scan;
  scan.state = s; scan.tick = s.tick;
  scan.projN = scan.zoneN = scan.coinN = scan.potN = scan.siteN = scan.teleN = 0;
  scan.hostiles = 0;
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i]) continue;
    switch (e.kind[i]) {
      case Kind.Mob: {
        if (!isHostile(s, i)) break;
        if (e.x[i] > s.camX - 6 && e.x[i] < s.camX + VIEW_W + 120) scan.hostiles++;
        if ((e.mode[i] !== 0 || e.wind[i] > 0) && scan.teleN < CAP) scan.tele[scan.teleN++] = i;
        break;
      }
      case Kind.Proj: if (e.sub[i] === 0 && scan.projN < CAP) scan.proj[scan.projN++] = i; break;
      case Kind.Zone: if (scan.zoneN < CAP) scan.zone[scan.zoneN++] = i; break;
      case Kind.Coin: if (scan.coinN < CAP) scan.coin[scan.coinN++] = i; break;
      case Kind.Potion: if (scan.potN < CAP) scan.pot[scan.potN++] = i; break;
      case Kind.Chest: case Kind.Shrine: if (scan.siteN < 64) scan.site[scan.siteN++] = i; break;
    }
  }
  return scan;
}

/** One hero's view of the fight. Reused every tick: arrays are sorted nearest-first and valid up to `n`. */
export interface View {
  slot: number;
  ent: number;
  cls: ClassDef;
  x: number; y: number;
  hp: number; maxHp: number; hpFrac: number;
  /** Nearest hostile mobs, ascending by distance. */
  n: number;
  idx: Int32Array;
  dx: Float64Array;
  dy: Float64Array;
  dist: Float64Array;
  /** Hostile mobs within 24 / 40 / 70 / 120 px (all of them, not just the tracked ones). */
  c24: number; c40: number; c70: number; c120: number;
  /** Where the crowd within 120 px sits (a centroid), valid when c120 > 0. */
  cx: number; cy: number;
  /** Nearest hostile mob of any kind (index, distance), or -1 / Infinity. */
  nearest: number; nearestDist: number;
  /** Heroes (other than this one) still standing: how many, and the lowest health fraction among them with where they are. */
  allies: number;
  allyX: number; allyY: number;
  weakAlly: number; weakAllyFrac: number; weakAllyX: number; weakAllyY: number;
}

export function createView(): View {
  return {
    slot: 0, ent: 0, cls: CLASSES[0], x: 0, y: 0, hp: 0, maxHp: 1, hpFrac: 1,
    n: 0, idx: new Int32Array(MAX_NEAR), dx: new Float64Array(MAX_NEAR), dy: new Float64Array(MAX_NEAR), dist: new Float64Array(MAX_NEAR),
    c24: 0, c40: 0, c70: 0, c120: 0, cx: 0, cy: 0, nearest: -1, nearestDist: Infinity,
    allies: 0, allyX: 0, allyY: 0, weakAlly: -1, weakAllyFrac: 1, weakAllyX: 0, weakAllyY: 0,
  };
}

const gathered = new Int32Array(4096);

/** Fill `v` with what hero `slot` sees. */
export function look(s: GameState, slot: number, v: View): void {
  const p = s.players[slot];
  const e = s.ents;
  v.slot = slot;
  v.ent = p.ent;
  v.cls = CLASSES[p.classId];
  v.x = e.x[p.ent]; v.y = e.y[p.ent];
  v.hp = e.hp[p.ent]; v.maxHp = v.cls.hp; v.hpFrac = v.hp / v.cls.hp;
  v.n = 0; v.c24 = v.c40 = v.c70 = v.c120 = 0; v.cx = v.cy = 0;
  v.nearest = -1; v.nearestDist = Infinity;

  const g = gatherCircle(s.grid, e, v.x, v.y, SIGHT, gathered);
  let sx = 0, sy = 0;
  for (let k = 0; k < g; k++) {
    const i = gathered[k];
    if (!isHostile(s, i)) continue;
    const dx = e.x[i] - v.x, dy = e.y[i] - v.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 120) { v.c120++; sx += dx; sy += dy; if (d < 70) { v.c70++; if (d < 40) { v.c40++; if (d < 24) v.c24++; } } }
    // Keep the nearest MAX_NEAR in order (insertion into a short sorted list).
    if (v.n === MAX_NEAR && d >= v.dist[MAX_NEAR - 1]) continue;
    let at = v.n < MAX_NEAR ? v.n++ : MAX_NEAR - 1;
    while (at > 0 && v.dist[at - 1] > d) { v.idx[at] = v.idx[at - 1]; v.dx[at] = v.dx[at - 1]; v.dy[at] = v.dy[at - 1]; v.dist[at] = v.dist[at - 1]; at--; }
    v.idx[at] = i; v.dx[at] = dx; v.dy[at] = dy; v.dist[at] = d;
  }
  if (v.n > 0) { v.nearest = v.idx[0]; v.nearestDist = v.dist[0]; }
  if (v.c120 > 0) { v.cx = v.x + sx / v.c120; v.cy = v.y + sy / v.c120; }

  v.allies = 0; v.weakAlly = -1; v.weakAllyFrac = 1;
  let ax = 0, ay = 0;
  for (let k = 0; k < s.players.length; k++) {
    const q = s.players[k];
    if (k === slot || !q.active || q.downed) continue;
    v.allies++;
    ax += e.x[q.ent]; ay += e.y[q.ent];
    const f = e.hp[q.ent] / CLASSES[q.classId].hp;
    if (f < v.weakAllyFrac) { v.weakAllyFrac = f; v.weakAlly = k; v.weakAllyX = e.x[q.ent]; v.weakAllyY = e.y[q.ent]; }
  }
  if (v.allies > 0) { v.allyX = ax / v.allies; v.allyY = ay / v.allies; }
}

/** The mob's definition (a convenience for tactics). */
export function defOf(s: GameState, i: number): MobDef { return MOBS[s.ents.sub[i]]; }

/** True for the enemies a player takes seriously first: healers, summoners, drummers, shooters and bombers. */
export function isPriority(def: MobDef): number {
  if (def.special) {
    switch (def.special.kind) {
      case 'heal': case 'summon': case 'rally': case 'ward': return 3;
      case 'wail': case 'whiteout': case 'lure': case 'hex': case 'dazzle': case 'trap': case 'pit': return 2;
    }
  }
  if (def.behavior === Behavior.Ranged || def.behavior === Behavior.Caster) return 2;
  if (def.behavior === Behavior.Bomber) return 2;
  if (isBossType(MOBS.indexOf(def))) return 0;
  return 0;
}

/** Ticks until mob `i` could land a blow if its target stayed in reach (the telegraph if one is running, else cooldown + windup). */
export function strikeIn(s: GameState, i: number): number {
  const e = s.ents;
  const def = MOBS[e.sub[i]];
  if (e.wind[i] > 0) return e.wind[i];
  return e.atk[i] + def.windup;
}

/** Is the screen's y-range one this foe is fully on (not still climbing over the hill)? */
export function inField(y: number): boolean { return y > -2 && y < WORLD_H + 2; }
