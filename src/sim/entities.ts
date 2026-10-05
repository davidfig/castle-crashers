// Struct-of-arrays entity storage. Horde-scale: thousands of entities, zero per-entity allocation.
import { MAX_ENTS } from './constants';

export const Kind = { None: 0, Player: 1, Mob: 2, Proj: 3, Coin: 4 } as const;

export interface Entities {
  capacity: number;
  /** One past the highest slot ever used; iterate 0..highWater. */
  highWater: number;
  count: number;
  alive: Uint8Array;
  kind: Uint8Array;
  /** Mob type id, or player slot. */
  sub: Uint8Array;
  x: Float64Array;
  y: Float64Array;
  /** Previous-tick position, for render interpolation. */
  px: Float64Array;
  py: Float64Array;
  /** Height above the ground and vertical velocity (loot arcs). */
  z: Float64Array;
  vz: Float64Array;
  /** Knockback velocity (decays). */
  vx: Float64Array;
  vy: Float64Array;
  hp: Float64Array;
  /** Hit-flash ticks remaining (cosmetic but sim-owned so it is deterministic). */
  hurt: Uint8Array;
  stun: Uint8Array;
  atk: Uint8Array;
  /** Telegraph/fuse ticks remaining before an attack lands. */
  wind: Uint8Array;
  /** Locked aim direction while winding up (ranged). */
  ax: Float64Array;
  ay: Float64Array;
  /** -1 or +1: which way the sprite faces. */
  face: Int8Array;
  /** Slot of the player who last damaged this mob (-1 = none); credits chain kills. */
  by: Int8Array;
  /** bit0: aggro */
  flags: Uint8Array;
  free: Int32Array;
  freeCount: number;
}

export function createEntities(capacity = MAX_ENTS): Entities {
  const free = new Int32Array(capacity);
  for (let i = 0; i < capacity; i++) free[i] = capacity - 1 - i;
  return {
    capacity,
    highWater: 0,
    count: 0,
    alive: new Uint8Array(capacity),
    kind: new Uint8Array(capacity),
    sub: new Uint8Array(capacity),
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    px: new Float64Array(capacity),
    py: new Float64Array(capacity),
    z: new Float64Array(capacity),
    vz: new Float64Array(capacity),
    vx: new Float64Array(capacity),
    vy: new Float64Array(capacity),
    hp: new Float64Array(capacity),
    hurt: new Uint8Array(capacity),
    stun: new Uint8Array(capacity),
    atk: new Uint8Array(capacity),
    wind: new Uint8Array(capacity),
    ax: new Float64Array(capacity),
    ay: new Float64Array(capacity),
    face: new Int8Array(capacity).fill(1),
    by: new Int8Array(capacity).fill(-1),
    flags: new Uint8Array(capacity),
    free,
    freeCount: capacity,
  };
}

/** Returns the new slot, or -1 when full. Slot reuse order is deterministic (LIFO). */
export function allocEntity(e: Entities, kind: number, sub: number, x: number, y: number, hp: number): number {
  if (e.freeCount === 0) return -1;
  const i = e.free[--e.freeCount];
  e.alive[i] = 1;
  e.kind[i] = kind;
  e.sub[i] = sub;
  e.x[i] = x; e.y[i] = y; e.px[i] = x; e.py[i] = y;
  e.vx[i] = 0; e.vy[i] = 0; e.z[i] = 0; e.vz[i] = 0;
  e.hp[i] = hp;
  e.hurt[i] = 0; e.stun[i] = 0; e.atk[i] = 0; e.wind[i] = 0; e.ax[i] = 0; e.ay[i] = 0;
  e.face[i] = 1;
  e.flags[i] = 0;
  e.by[i] = -1;
  e.count++;
  if (i + 1 > e.highWater) e.highWater = i + 1;
  return i;
}

export function freeEntity(e: Entities, i: number): void {
  if (!e.alive[i]) return;
  e.alive[i] = 0;
  e.kind[i] = Kind.None;
  e.free[e.freeCount++] = i;
  e.count--;
}
