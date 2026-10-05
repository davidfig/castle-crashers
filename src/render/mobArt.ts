// Enemy sprites from the art workbench. Frames are tight cells whose bottom row is the ground line and whose pivot
// column is the cell centre, so the existing bottom-centre drawing code works unchanged. The enemies' swings,
// leans and charges stay code-driven (draw.ts). Weapons are baked into the body frames.
import type { Frame } from '../platform/gl/batcher';
import goblinMeta from '../../art/out/goblin.json';
import orcMeta from '../../art/out/orc.json';
import archerMeta from '../../art/out/mobarcher.json';
import shieldMeta from '../../art/out/shieldbearer.json';
import bomberMeta from '../../art/out/bomber.json';

interface Rect { x: number; y: number; w: number; h: number }
interface SheetMeta { frames: Record<string, Rect>; anims: Record<string, { frames: string[] }> }
const MOB_METAS = [goblinMeta, orcMeta, archerMeta, shieldMeta, bomberMeta] as unknown as SheetMeta[];

export interface MobArt {
  /** Indexed by MobType: the walk cycle. */
  walk: Frame[][];
  /**
   * Indexed by MobType: every authored animation by name (idle, windup, strike, hurt, ...). Which exist varies by enemy:
   * archers have aim/release, orcs have paw/charge/dazed, bombers have lit.
   */
  anims: Record<string, Frame[]>[];
}

const uv = (r: Rect, pl: { x: number; y: number }, W: number, H: number): Frame => ({
  u0: (pl.x + r.x) / W, v0: (pl.y + r.y) / H, u1: (pl.x + r.x + r.w) / W, v1: (pl.y + r.y + r.h) / H, w: r.w, h: r.h,
});

/** places: one atlas placement per sheet, in loadMobImages() order. */
export function buildMobArt(places: { x: number; y: number }[], W: number, H: number): MobArt {
  const anims = MOB_METAS.map((m, t) => {
    const out: Record<string, Frame[]> = {};
    for (const [name, a] of Object.entries(m.anims)) out[name] = a.frames.map((fn) => uv(m.frames[fn], places[t], W, H));
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
  moving: boolean;
  hurt: boolean;
  tick: number;
  /** Per-entity offset so a crowd does not animate in lockstep. */
  salt: number;
}

const at = (frames: Frame[], n: number): Frame => frames[((n % frames.length) + frames.length) % frames.length];

/**
 * Picks the body frame for an enemy. Priority: dazed > charging > hurt > charge wind-up > windup > strike > idle > walk.
 * Missing animations fall through, so an enemy only needs the poses that make sense for it.
 */
export function mobPose(art: MobArt, type: number, s: MobPoseState): Frame {
  const A = art.anims[type];
  if (s.dazed && A.dazed) return at(A.dazed, s.tick >> 3);
  if (s.charging && A.charge) return at(A.charge, s.tick >> 1);
  if (s.hurt && A.hurt) return A.hurt[0];
  if (s.chargeWind && A.paw) return at(A.paw, s.tick >> 2);
  if (s.winding) {
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
