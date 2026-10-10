// Danger, as a player reads it off the screen: red circles on the ground, a wind-up that is about to land, a lane a charger has locked,
// an arrow in flight. Each one is a circle, a lane or a projectile with a time it lands and a cost if it lands on the hero. A pilot
// rolls out the moves it could make and asks `costOf` what each would cost it; reaction time and attention decide which dangers it knows about.
import { Behavior, LEGACY_BOSS_MOVES, MOBS, ARROW_DAMAGE, ARROW_SPEED, ARROW_TTL, BLAST_RADIUS, isBossType, type Special } from '../data/mobs';
import { createRng, rngFloat, type Rng } from '../engine/rng';
import { WORLD_H } from '../sim/constants';
import { MAX_ENTS } from '../sim/constants';
import { Kind, ZoneKind } from '../sim/entities';
import { BOSS_SPECIAL, SP_LEAP, SP_WIND } from '../sim/abilities';
import type { GameState } from '../sim/state';
import type { Scan } from './perceive';
import type { Skill } from './skill';

const CAP = 256;
/** A threat further than this many ticks away is not weighed yet. */
export const HORIZON = 42;
const PERSISTS = 1e9;
/** A hero's body: how far into a circle's edge counts as standing in it. */
const BODY = 3;

const CIRCLE = 0, LANE = 1, SHOT = 2;

export class Threats {
  n = 0;
  kind = new Uint8Array(CAP);
  x = new Float64Array(CAP);
  y = new Float64Array(CAP);
  /** Radius (circle), half-width (lane) or hit radius (shot). */
  r = new Float64Array(CAP);
  /** Lane direction, or a shot's velocity per tick. */
  dx = new Float64Array(CAP);
  dy = new Float64Array(CAP);
  /** Lane length, or a shot's remaining life in ticks. */
  len = new Float64Array(CAP);
  /** Ticks until it starts hurting and until it stops. */
  from = new Float64Array(CAP);
  to = new Float64Array(CAP);
  /** Health lost if it lands (a persistent circle: per bite, about every 20 ticks). */
  dmg = new Float64Array(CAP);
  /** Pools are drawn flattened: distance across the field counts this much more. */
  flat = new Float64Array(CAP);

  clear(): void { this.n = 0; }

  private slot(): number { return this.n < CAP ? this.n++ : -1; }

  circle(x: number, y: number, r: number, from: number, to: number, dmg: number, flat = 1): void {
    const k = this.slot(); if (k < 0) return;
    this.kind[k] = CIRCLE; this.x[k] = x; this.y[k] = y; this.r[k] = r; this.from[k] = from; this.to[k] = to; this.dmg[k] = dmg; this.flat[k] = flat;
  }

  lane(x: number, y: number, dx: number, dy: number, len: number, halfW: number, from: number, to: number, dmg: number): void {
    const k = this.slot(); if (k < 0) return;
    this.kind[k] = LANE; this.x[k] = x; this.y[k] = y; this.dx[k] = dx; this.dy[k] = dy; this.len[k] = len; this.r[k] = halfW; this.from[k] = from; this.to[k] = to; this.dmg[k] = dmg;
  }

  shot(x: number, y: number, vx: number, vy: number, life: number, r: number, dmg: number): void {
    const k = this.slot(); if (k < 0) return;
    this.kind[k] = SHOT; this.x[k] = x; this.y[k] = y; this.dx[k] = vx; this.dy[k] = vy; this.len[k] = life; this.r[k] = r; this.dmg[k] = dmg; this.from[k] = 0; this.to[k] = life;
  }

  /**
   * Expected health lost by a hero starting at (px, py) and walking along unit (ux, uy) at `v` px/tick, within the clamp box. Dangers that
   * land within `near` ticks are tallied separately in `costNear` (what a dodge-roll's invulnerability could still save).
   */
  costOf(px: number, py: number, ux: number, uy: number, v: number, minX: number, maxX: number, minY: number, maxY: number): number {
    let total = 0;
    let near = 0;
    for (let k = 0; k < this.n; k++) {
      const from = this.from[k];
      if (from > HORIZON) continue;
      let c = 0;
      let soon = from <= 7;
      switch (this.kind[k]) {
        case CIRCLE: {
          const to = this.to[k];
          const r = this.r[k] + BODY, flat = this.flat[k];
          if (to - from > 10) {
            // lingering: price the time spent inside over a few samples
            for (let q = 0; q < 3; q++) {
              const t = Math.max(1, from) + q * 11;
              if (t > to || t > HORIZON) break;
              c += this.circleHit(k, px, py, ux, uy, v, t, r, flat, minX, maxX, minY, maxY) * this.dmg[k] * 0.45;
            }
          } else {
            c = this.circleHit(k, px, py, ux, uy, v, Math.max(1, from), r, flat, minX, maxX, minY, maxY) * this.dmg[k];
          }
          break;
        }
        case LANE: {
          const from1 = Math.max(1, from), to = Math.min(this.to[k], HORIZON);
          let hit = 0;
          for (let q = 0; q < 3; q++) {
            const t = from1 + ((to - from1) * q) / 2;
            if (t > HORIZON) break;
            const hx = clampN(px + ux * v * t, minX, maxX) - this.x[k], hy = clampN(py + uy * v * t, minY, maxY) - this.y[k];
            const along = hx * this.dx[k] + hy * this.dy[k];
            const lat = Math.abs(hx * -this.dy[k] + hy * this.dx[k]);
            if (along > -10 && along < this.len[k] + 6 && lat < this.r[k] + BODY) { hit = 1; break; }
            if (lat < this.r[k] + BODY + 6 && along > -10 && along < this.len[k]) hit = Math.max(hit, 0.35);
          }
          c = hit * this.dmg[k];
          break;
        }
        default: {
          // a shot: closest approach of two straight lines over its remaining life
          const life = Math.min(this.len[k], HORIZON);
          const rx = this.x[k] - px, ry = this.y[k] - py;
          const wx = this.dx[k] - ux * v, wy = this.dy[k] - uy * v;
          const w2 = wx * wx + wy * wy;
          let t = w2 > 1e-9 ? -(rx * wx + ry * wy) / w2 : 0;
          if (t < 0) t = 0; else if (t > life) t = life;
          const cx = rx + wx * t, cy = ry + wy * t;
          const rr = this.r[k] + BODY;
          const d2 = cx * cx + cy * cy;
          if (d2 < rr * rr) c = this.dmg[k];
          else if (d2 < (rr + 6) * (rr + 6)) c = this.dmg[k] * 0.3;
          soon = t <= 7;
        }
      }
      if (soon) near += c;
      total += c;
    }
    this.lastNear = near;
    return total;
  }

  /** Part of the last `costOf` that lands within the next few ticks. */
  lastNear = 0;

  private circleHit(k: number, px: number, py: number, ux: number, uy: number, v: number, t: number, r: number, flat: number, minX: number, maxX: number, minY: number, maxY: number): number {
    const hx = clampN(px + ux * v * t, minX, maxX) - this.x[k];
    const hy = (clampN(py + uy * v * t, minY, maxY) - this.y[k]) * flat;
    const d = Math.sqrt(hx * hx + hy * hy);
    if (d < r) return 1;
    if (d < r + 7) return 0.4 * (1 - (d - r) / 7); // a margin: nobody places themselves to the pixel
    return 0;
  }
}

function clampN(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

/** What a pilot remembers about dangers it has seen: since when, and whether it noticed at all. Indexed by entity slot. */
export class Memory {
  first = new Int32Array(MAX_ENTS);
  last = new Int32Array(MAX_ENTS).fill(-5);
  missed = new Uint8Array(MAX_ENTS);
  /** The last wind-up reading of each mob and since when it has read that: a telegraph that stops counting down is frozen (nothing is aimed at anyone) and is not a danger. */
  windVal = new Int32Array(MAX_ENTS);
  windAt = new Int32Array(MAX_ENTS);
  rng: Rng;
  constructor(seed: number) { this.rng = createRng(seed, 91); }
}

/** Has the pilot noticed danger `i` and had time to react to it? (An episode is one unbroken stretch of the danger being there.) */
function seen(mem: Memory, skill: Skill, tick: number, i: number, reaction = skill.reaction): boolean {
  if (mem.last[i] < tick - 1) {
    mem.first[i] = tick;
    mem.missed[i] = rngFloat(mem.rng) < skill.attention ? 0 : 1;
  }
  mem.last[i] = tick;
  return mem.missed[i] === 0 && tick - mem.first[i] >= reaction;
}

/** The telegraphed special of mob `i` as a danger, if it has a shape to dodge. `wind` ticks remain. */
function specialThreat(t: Threats, s: GameState, i: number, sp: Special, wind: number): void {
  const e = s.ents;
  const x = e.x[i], y = e.y[i];
  switch (sp.kind) {
    case 'nova': t.circle(x, y, sp.radius, wind, wind + 3, sp.damage * 1.15); break;
    case 'gust': t.circle(x, y, sp.radius, wind, wind + 3, sp.damage + 3); break;
    case 'wail': t.circle(x, y, sp.radius, wind, wind + 3, sp.damage + 7); break;
    case 'whiteout': t.circle(x, y, sp.radius, wind, wind + 3, sp.damage + 9); break;
    case 'lure': t.circle(x, y, sp.radius, wind, wind + 3, sp.damage + 6); break;
    case 'beam': t.lane(x, y, e.ax[i], e.ay[i], sp.range, sp.width, wind, wind + 8, sp.damage * 1.1); break;
    case 'leap':
    case 'pounce': t.circle(e.ax[i], e.ay[i], sp.radius, wind + sp.delay, wind + sp.delay + 3, sp.damage + 3); break;
    case 'hex': t.circle(e.ax[i], e.ay[i], sp.radius, wind, wind + 3, 9); break;
    case 'dazzle': t.circle(e.ax[i], e.ay[i], sp.radius, wind, wind + 3, sp.damage + 10); break;
    case 'storm': t.circle(e.ax[i], e.ay[i], sp.radius, wind + sp.delay, wind + sp.delay + sp.linger, sp.damage + 1, 1.3); break;
    case 'pit': t.circle(e.ax[i], e.ay[i], sp.radius, wind + sp.delay, wind + sp.delay + sp.linger, sp.damage + 1); break;
    case 'trap': t.circle(e.ax[i], e.ay[i], sp.radius, wind + sp.arm, wind + sp.arm + sp.linger, sp.damage + 6); break;
    default: break; // lob (its rock shows as a ring once thrown), blink, summon, heal, rally, ward, cling
  }
}

/**
 * Gather every danger the pilot is aware of into `t`. The hero's `slot` matters only for the clinging sprites (skipped) and nothing
 * else here: dangers are the same for everyone; it is awareness (`mem`) that differs.
 */
export function collectThreats(t: Threats, s: GameState, scan: Scan, mem: Memory, skill: Skill): void {
  t.clear();
  const e = s.ents;
  const tick = s.tick;
  // Mobs in a telegraph
  for (let q = 0; q < scan.teleN; q++) {
    const i = scan.tele[q];
    if (!e.alive[i] || e.kind[i] !== Kind.Mob) continue;
    const def = MOBS[e.sub[i]];
    const mode = e.mode[i];
    const wind = e.wind[i];
    const x = e.x[i], y = e.y[i];
    // (the whole move state: a telegraph that has stopped changing is frozen, whatever its counter reads)
    const sig = mode * 65536 + wind * 256 + (Math.floor(e.rem[i]) & 255);
    if (mem.windVal[i] !== sig) { mem.windVal[i] = sig; mem.windAt[i] = tick; }
    else if (tick - mem.windAt[i] > 30 && (wind > 0 || mode !== 0)) continue;
    if (def.behavior === Behavior.Boss) {
      const b = def.boss!;
      if (mode === 3) { if (seen(mem, skill, tick, i)) t.circle(x, y, b.slamRadius, wind, wind + 3, b.slamDamage); }
      else if (mode === 5) { if (seen(mem, skill, tick, i)) t.circle(x, y, def.radius + def.reach + 6, wind, wind + 3, def.damage); }
      else if (mode === 1 || mode === 2) {
        const c = def.charge!;
        if (seen(mem, skill, tick, i)) {
          const len = mode === 1 ? c.distance : Math.max(30, e.rem[i]);
          const lead = mode === 1 ? wind : 0;
          t.lane(x, y, e.ax[i], e.ay[i], len + def.radius, def.radius + 4, lead, lead + len / c.speed + 10, c.damage);
        }
      } else if (mode === BOSS_SPECIAL) {
        const mv = (b.moves ?? LEGACY_BOSS_MOVES)[e.rem[i]];
        if (mv?.kind === 'special' && seen(mem, skill, tick, i)) specialThreat(t, s, i, mv.special, wind);
      } else if (mode === SP_LEAP) {
        const sp = def.special;
        if ((sp?.kind === 'leap' || sp?.kind === 'pounce') && seen(mem, skill, tick, i)) t.circle(e.ax[i], e.ay[i], sp.radius, wind, wind + 3, sp.damage + 3);
      }
      continue;
    }
    if (mode === SP_WIND) {
      if (def.special && seen(mem, skill, tick, i)) specialThreat(t, s, i, def.special, wind);
      continue;
    }
    if (mode === SP_LEAP) {
      const sp = def.special;
      if ((sp?.kind === 'leap' || sp?.kind === 'pounce') && seen(mem, skill, tick, i)) t.circle(e.ax[i], e.ay[i], sp.radius, wind, wind + 3, sp.damage + 3);
      continue;
    }
    if (def.charge && (mode === 1 || mode === 2)) {
      if (!seen(mem, skill, tick, i)) continue;
      const ch = def.charge;
      const len = mode === 1 ? ch.distance : Math.max(24, e.rem[i]);
      const lead = mode === 1 ? wind : 0;
      t.lane(x, y, e.ax[i], e.ay[i], len + def.radius, def.radius + 5, lead, lead + len / ch.speed + 8, ch.damage);
      continue;
    }
    if (wind > 0) {
      if (def.behavior === Behavior.Melee) {
        if (seen(mem, skill, tick, i)) t.circle(x, y, def.reach + (def.lunge ?? 0) * 0.8 + 4 + def.radius * 0.3, wind, wind + 2, def.damage * (e.elite[i] ? 1.3 : 1));
      } else if (def.behavior === Behavior.Bomber) {
        if (seen(mem, skill, tick, i)) t.circle(x, y, BLAST_RADIUS + 4, wind, wind + 2, def.damage);
      } else if (def.behavior === Behavior.Ranged) {
        if (seen(mem, skill, tick, i)) {
          const sh = def.shot;
          const speed = sh ? sh.speed : ARROW_SPEED;
          const n = sh ? sh.count : 1;
          const range = speed * ARROW_TTL;
          const dmg = sh ? sh.damage : ARROW_DAMAGE;
          const width = n > 1 ? 4 + n * 3 : 5;
          t.lane(x, y, e.ax[i], e.ay[i], Math.min(range, 320), width, wind + 6, wind + 6 + Math.min(range, 320) / speed, dmg);
        }
      }
    }
  }
  // Arrows and bolts in flight (the shooter's windup was already on screen, so these need less of a double take)
  const projReaction = Math.max(2, Math.round(skill.reaction * 0.35));
  for (let q = 0; q < scan.projN; q++) {
    const i = scan.proj[q];
    if (!e.alive[i] || e.kind[i] !== Kind.Proj) continue;
    if (!seen(mem, skill, tick, i, projReaction)) continue;
    t.shot(e.x[i], e.y[i], e.vx[i], e.vy[i], Math.max(1, e.hp[i]), 5, e.rem[i] > 0 ? e.rem[i] : ARROW_DAMAGE);
  }
  // Ground effects
  for (let q = 0; q < scan.zoneN; q++) {
    const i = scan.zone[q];
    if (!e.alive[i] || e.kind[i] !== Kind.Zone) continue;
    const sub = e.sub[i];
    if (sub === ZoneKind.Rain || sub === ZoneKind.Mud) continue; // the archer's own volley; mud only slows
    if (!seen(mem, skill, tick, i)) continue;
    const r = e.rem[i];
    if (sub === ZoneKind.Rock) { if (e.mode[i] === 0) t.circle(e.x[i], e.y[i], r, e.wind[i], e.wind[i] + 2, e.hp[i]); continue; }
    if (sub === ZoneKind.Storm) { t.circle(e.x[i], e.y[i], r, e.wind[i], PERSISTS, Math.max(2, e.hp[i]), 1.3); continue; }
    if (sub === ZoneKind.Trap || sub === ZoneKind.Pit) { t.circle(e.x[i], e.y[i], r, Math.max(0, e.wind[i]), e.cool2[i] + e.wind[i], e.hp[i] + (sub === ZoneKind.Trap ? 6 : 0)); continue; }
    // pools and spore clouds
    t.circle(e.x[i], e.y[i], r, 0, Math.max(10, e.cool2[i]), Math.max(2, e.hp[i]), 1.3);
  }
}

export const FIELD_Y_MIN = 2;
export const FIELD_Y_MAX = WORLD_H - 2;
export { isBossType };
