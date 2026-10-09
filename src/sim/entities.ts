// Struct-of-arrays entity storage. Horde-scale: thousands of entities, zero per-entity allocation.
import { MOBS } from '../data/mobs';
import { MAX_ENTS } from './constants';

/** A Zone is a patch of ground that something is about to happen to (a lobbed rock) or that stays dangerous (a poison pool). */
export const Kind = { None: 0, Player: 1, Mob: 2, Proj: 3, Coin: 4, Zone: 5, Potion: 6 } as const;

/** Zone looks (the `sub` of a Kind.Zone entity). */
export const ZoneKind = { Rock: 0, Poison: 1, Frost: 2, Trap: 3, Storm: 4, Rain: 5, Pit: 6, Mud: 7, Spore: 8 } as const;

/** Mob flag: a bystander stands by its fire and never attacks or chases (docs/12-story.md, R1). Other bits: 1 aggro, 2 entering, 4 enraged, 8 retreating, 32 specials initialised (abilities.ts), 128 berserk. */
export const BYSTANDER = 16;
/** Mob flag: it has laid down its arms. It kneels (`rem` ticks, -1 until the staged beat plays), then runs off; any damage kills it like any mob. */
export const SURRENDERED = 64;
/** Mob flag: it has gone berserk (below its `berserk` health): frenzied, harder-hitting, never staggered. */
export const BERSERK = 128;

export interface Entities {
  capacity: number;
  /** Slot of the boss while one is alive, else -1. */
  boss: number;
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
  /** 0 normal, 1 charge windup, 2 charging, handled per mob type. */
  mode: Uint8Array;
  /** Ticks until the next special move (charge) is allowed. */
  cool: Uint16Array;
  /** A second timer for mobs with several special moves (the boss's move scheduler). */
  cool2: Uint16Array;
  /** Mobs: ticks of frenzy left (a drummer's rally). Zones: ticks of slow it inflicts. */
  buff: Uint16Array;
  /** Mobs with a shield: damage it can still soak (0 = broken, or none). */
  shieldHp: Float32Array;
  /** Full health, so a health bar can show a fraction. */
  maxhp: Float64Array;
  /** Distance left to cover in a charge. */
  rem: Float64Array;
  /** Locked aim direction while winding up (ranged) or charging. */
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
    boss: -1,
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
    mode: new Uint8Array(capacity),
    cool: new Uint16Array(capacity),
    cool2: new Uint16Array(capacity),
    buff: new Uint16Array(capacity),
    shieldHp: new Float32Array(capacity),
    maxhp: new Float64Array(capacity),
    rem: new Float64Array(capacity),
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
  e.maxhp[i] = hp;
  e.cool2[i] = 0;
  e.hurt[i] = 0; e.stun[i] = 0; e.atk[i] = 0; e.wind[i] = 0; e.mode[i] = 0; e.cool[i] = 0; e.buff[i] = 0; e.shieldHp[i] = kind === Kind.Mob ? (MOBS[sub]?.shieldHp ?? 0) : 0; e.rem[i] = 0; e.ax[i] = 0; e.ay[i] = 0;
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
