// Enemy sprites from the art workbench. Frames are tight cells whose bottom row is the ground line and whose pivot
// column is the cell centre, so the existing bottom-centre drawing code works unchanged. The enemies' swings,
// leans and charges stay code-driven (draw.ts); `weapons` holds pre-rotated dagger/club sprites for those swings.
import type { Frame } from '../platform/gl/batcher';
import goblinMeta from '../../art/out/goblin.json';
import orcMeta from '../../art/out/orc.json';
import archerMeta from '../../art/out/mobarcher.json';
import shieldMeta from '../../art/out/shieldbearer.json';
import bomberMeta from '../../art/out/bomber.json';
import weaponsMeta from '../../art/out/weapons.json';

interface Rect { x: number; y: number; w: number; h: number }
interface SheetMeta { frames: Record<string, Rect>; anims: Record<string, { frames: string[] }> }
const MOB_METAS = [goblinMeta, orcMeta, archerMeta, shieldMeta, bomberMeta] as unknown as SheetMeta[];
const WEAPONS = weaponsMeta as unknown as SheetMeta;

export const WEAPON_STEP = 15;
export const WEAPON_COUNT = 360 / WEAPON_STEP;
/** Where in a weapon frame the grip sits (the weapon is rotated about this point). */
export const WEAPON_GRIP = 12;

export interface MobArt {
  /** Indexed by MobType: the walk cycle. */
  walk: Frame[][];
  /** The archer with its bow raised (windup). */
  aim: Frame;
  /** Weapon sprites at WEAPON_STEP-degree steps, 0 = forward, +90 = down. */
  dagger: Frame[];
  club: Frame[];
}

const uv = (r: Rect, pl: { x: number; y: number }, W: number, H: number): Frame => ({
  u0: (pl.x + r.x) / W, v0: (pl.y + r.y) / H, u1: (pl.x + r.x + r.w) / W, v1: (pl.y + r.y + r.h) / H, w: r.w, h: r.h,
});

/** Pixel rect of a mob's first walk frame in its sheet (used to derive its corpse). */
export function mobCorpseSource(type: number): Rect {
  const m = MOB_METAS[type];
  return m.frames[m.anims.walk.frames[0]];
}

/** places: one atlas placement per sheet, in loadMobImages() order. */
export function buildMobArt(places: { x: number; y: number }[], W: number, H: number): MobArt {
  const walk = MOB_METAS.map((m, t) => m.anims.walk.frames.map((fn) => uv(m.frames[fn], places[t], W, H)));
  const arch = MOB_METAS[2];
  const aim = uv(arch.frames[arch.anims.aim.frames[0]], places[2], W, H);
  const wp = places[5];
  // weapons.mjs lays each weapon out as two rows (A: 0-165 degrees, B: 180-345) named <weapon>A_<n> / <weapon>B_<n>
  const weapon = (name: string) => Array.from({ length: WEAPON_COUNT }, (_, k) => uv(WEAPONS.frames[`${name}${k < 12 ? 'A' : 'B'}_${k % 12}`], wp, W, H));
  return { walk, aim, dagger: weapon('dagger'), club: weapon('club') };
}
