// Enemy sprites (a run's generated monsters, see monsterArt.ts). Frames are tight cells whose bottom row is the ground line and whose pivot
// column is the cell centre, so the existing bottom-centre drawing code works unchanged. The enemies' swings,
// leans and charges stay code-driven (draw.ts). Weapons are baked into the body frames.
import type { Frame } from '../platform/gl/batcher';

interface Rect { x: number; y: number; w: number; h: number }
export interface SheetMeta { ground?: number; frames: Record<string, Rect>; anims: Record<string, { frames: string[] }> }

export interface MobArt {
  /** Indexed by MobType: the walk cycle. */
  walk: Frame[][];
  /**
   * Indexed by MobType: every authored animation by name (idle, windup, strike, hurt, ...). Which exist varies by enemy:
   * archers have aim/release, orcs have paw/charge/dazed, bombers have lit,
   * the boss adds slam/roar/smash.
   */
  anims: Record<string, Frame[]>[];
}

const uv = (r: Rect, pl: { x: number; y: number }, W: number, H: number): Frame => ({
  u0: (pl.x + r.x) / W, v0: (pl.y + r.y) / H, u1: (pl.x + r.x + r.w) / W, v1: (pl.y + r.y + r.h) / H, w: r.w, h: r.h,
});

/** Frame tables for a list of sheet metadata (a run's generated monsters), each placed in the atlas at `places`. */
export function buildMobArtFrom(metas: readonly SheetMeta[], places: { x: number; y: number }[], W: number, H: number): MobArt {
  const anims = metas.map((m, t) => {
    const out: Record<string, Frame[]> = {};
    const drop = m.ground ?? 0; // grounded bodies stand a few rows above the cell's bottom edge: sink them onto the ground line (a lying corpse already rests on it)
    for (const [name, a] of Object.entries(m.anims)) out[name] = a.frames.map((fn) => (drop && name !== 'dead' ? { ...uv(m.frames[fn], places[t], W, H), drop } : uv(m.frames[fn], places[t], W, H)));
    return out;
  });
  const walk = anims.map((a) => a.walk);
  return { walk, anims };
}

/** What an enemy is doing this tick (the same flags drawMob already derives). */
export interface MobPoseState {
  winding: boolean;
  /** 0..1 through the windup. */
  windP: number;
  striking: boolean;
  /** 0..1 through the strike. */
  strikeQ: number;
  chargeWind: boolean;
  charging: boolean;
  dazed: boolean;
  /** The boss's own wind-ups (it has authored poses for them); ignored by enemies without those animations. */
  special?: 'slam' | 'roar' | 'smash';
  /** Winding up an ordinary enemy's special move (a snare, a ward, a storm...): uses its `cast` pose when it has one. */
  cast?: boolean;
  /** Clinging to a hero (a snow sprite): uses its `cling` animation. */
  cling?: boolean;
  /** Getting back up after a first death (the dread knight): uses `rise`, else `dazed`. */
  rising?: boolean;
  /** A shield bearer whose shield has broken: uses the `...B` animations. */
  broken?: boolean;
  moving: boolean;
  hurt: boolean;
  tick: number;
  /** Per-entity offset so a crowd does not animate in lockstep. */
  salt: number;
}

const at = (frames: Frame[], n: number): Frame => frames[((n % frames.length) + frames.length) % frames.length];

/**
 * Picks the body frame for an enemy. Priority: rising > cling > dazed > charging > hurt > charge wind-up > windup > strike > idle > walk.
 * Missing animations fall through, so an enemy only needs the poses that make sense for it.
 */
export function mobPose(art: MobArt, type: number, s: MobPoseState): Frame {
  const A = s.broken && art.anims[type].walkB ? brokenAnims(art.anims[type]) : art.anims[type];
  if (s.rising && (A.rise ?? A.dazed)) return at(A.rise ?? A.dazed, s.tick >> 3);
  if (s.cling && A.cling) return at(A.cling, s.tick >> 2);
  if (s.dazed && A.dazed) return at(A.dazed, s.tick >> 3);
  if (s.charging && A.charge) return at(A.charge, s.tick >> 1);
  if (s.hurt && A.hurt) return A.hurt[0];
  if (s.chargeWind && A.paw) return at(A.paw, s.tick >> 2);
  if (s.winding && s.special && A[s.special]) {
    const fr = A[s.special];
    return s.special === 'roar' ? at(fr, s.tick >> 2) : fr[s.windP < 0.55 ? 0 : fr.length - 1];
  }
  if (s.winding) {
    if (s.cast && A.cast) return A.cast[s.windP < 0.55 ? 0 : A.cast.length - 1];
    if (A.lit) return at(A.lit, s.tick >> 1);
    if (A.aim) return A.aim[0];
    if (A.windup) return A.windup[s.windP < 0.55 ? 0 : A.windup.length - 1];
  }
  if (s.striking) {
    if (A.release) return A.release[0];
    if (A.strike) return A.strike[s.strikeQ < 0.5 ? 0 : A.strike.length - 1];
  }
  if (!s.moving && A.idle) return at(A.idle, (s.tick >> 4) + s.salt);
  return at(A.walk, (s.tick >> 3) + s.salt);
}

const brokenCache = new WeakMap<Record<string, Frame[]>, Record<string, Frame[]>>();
/** A shield bearer's animations with the broken-shield set (`walkB`, `idleB`, ...) standing in for the whole ones. */
function brokenAnims(A: Record<string, Frame[]>): Record<string, Frame[]> {
  let out = brokenCache.get(A);
  if (!out) {
    out = { ...A };
    for (const k of Object.keys(A)) if (k.endsWith('B') && A[k.slice(0, -1)]) out[k.slice(0, -1)] = A[k];
    brokenCache.set(A, out);
  }
  return out;
}
