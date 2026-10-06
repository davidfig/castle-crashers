// Enemy sprites from the art workbench. Frames are tight cells whose bottom row is the ground line and whose pivot
// column is the cell centre, so the existing bottom-centre drawing code works unchanged. The enemies' swings,
// leans and charges stay code-driven (draw.ts). Weapons are baked into the body frames.
import type { Frame } from '../platform/gl/batcher';
import goblinMeta from '../../art/out/goblin.json';
import orcMeta from '../../art/out/orc.json';
import mobarcherMeta from '../../art/out/mobarcher.json';
import shieldbearerMeta from '../../art/out/shieldbearer.json';
import bomberMeta from '../../art/out/bomber.json';
import bossMeta from '../../art/out/boss.json';
import wolfMeta from '../../art/out/wolf.json';
import slingerMeta from '../../art/out/slinger.json';
import shamanMeta from '../../art/out/shaman.json';
import drummerMeta from '../../art/out/drummer.json';
import trollMeta from '../../art/out/troll.json';
import skeletonMeta from '../../art/out/skeleton.json';
import bonearcherMeta from '../../art/out/bonearcher.json';
import ghoulMeta from '../../art/out/ghoul.json';
import wraithMeta from '../../art/out/wraith.json';
import skullMeta from '../../art/out/skull.json';
import bonebruteMeta from '../../art/out/bonebrute.json';
import necromancerMeta from '../../art/out/necromancer.json';
import bansheeMeta from '../../art/out/banshee.json';
import plaguezombieMeta from '../../art/out/plaguezombie.json';
import lichMeta from '../../art/out/lich.json';
import dreadknightMeta from '../../art/out/dreadknight.json';
import trapperMeta from '../../art/out/trapper.json';
import snowspriteMeta from '../../art/out/snowsprite.json';
import harpoonerMeta from '../../art/out/harpooner.json';
import frostwolfMeta from '../../art/out/frostwolf.json';
import ramMeta from '../../art/out/ram.json';
import icehuskMeta from '../../art/out/icehusk.json';
import yetiMeta from '../../art/out/yeti.json';
import frostshamanMeta from '../../art/out/frostshaman.json';
import blizzardwitchMeta from '../../art/out/blizzardwitch.json';
import whiteoutspiritMeta from '../../art/out/whiteoutspirit.json';
import tundraguardMeta from '../../art/out/tundraguard.json';
import rimekingMeta from '../../art/out/rimeking.json';
import dreadregentMeta from '../../art/out/dreadregent.json';
import bogfrogMeta from '../../art/out/bogfrog.json';
import mudleechMeta from '../../art/out/mudleech.json';
import toadspitterMeta from '../../art/out/toadspitter.json';
import bullfrogMeta from '../../art/out/bullfrog.json';
import sporebloatMeta from '../../art/out/sporebloat.json';
import reedstalkerMeta from '../../art/out/reedstalker.json';
import wispMeta from '../../art/out/wisp.json';
import peatbruteMeta from '../../art/out/peatbrute.json';
import mirehagMeta from '../../art/out/mirehag.json';
import toadmatronMeta from '../../art/out/toadmatron.json';
import drownedwardenMeta from '../../art/out/drownedwarden.json';
import fenlordMeta from '../../art/out/fenlord.json';
import duneraiderMeta from '../../art/out/duneraider.json';
import scarabMeta from '../../art/out/scarab.json';
import flamearcherMeta from '../../art/out/flamearcher.json';
import sidewinderMeta from '../../art/out/sidewinder.json';
import scorpionMeta from '../../art/out/scorpion.json';
import falconerMeta from '../../art/out/falconer.json';
import dustdevilMeta from '../../art/out/dustdevil.json';
import antlionMeta from '../../art/out/antlion.json';
import mummyMeta from '../../art/out/mummy.json';
import sunpriestMeta from '../../art/out/sunpriest.json';
import sunguardMeta from '../../art/out/sunguard.json';
import suntyrantMeta from '../../art/out/suntyrant.json';

interface Rect { x: number; y: number; w: number; h: number }
interface SheetMeta { frames: Record<string, Rect>; anims: Record<string, { frames: string[] }> }
const MOB_METAS = [
  goblinMeta, orcMeta, mobarcherMeta, shieldbearerMeta, bomberMeta, bossMeta, wolfMeta, slingerMeta, shamanMeta, drummerMeta, trollMeta, skeletonMeta, bonearcherMeta, ghoulMeta, wraithMeta, skullMeta, bonebruteMeta, necromancerMeta, bansheeMeta, plaguezombieMeta, lichMeta, dreadknightMeta,
  trapperMeta, snowspriteMeta, harpoonerMeta, frostwolfMeta, ramMeta, icehuskMeta, yetiMeta, frostshamanMeta, blizzardwitchMeta, whiteoutspiritMeta, tundraguardMeta, rimekingMeta, dreadregentMeta,
  bogfrogMeta, mudleechMeta, toadspitterMeta, bullfrogMeta, sporebloatMeta, reedstalkerMeta, wispMeta, peatbruteMeta, mirehagMeta, toadmatronMeta, drownedwardenMeta, fenlordMeta,
  duneraiderMeta, scarabMeta, flamearcherMeta, sidewinderMeta, scorpionMeta, falconerMeta, dustdevilMeta, antlionMeta, mummyMeta, sunpriestMeta, sunguardMeta, suntyrantMeta,
] as unknown as SheetMeta[];

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
  /** The boss's own wind-ups (it has authored poses for them); ignored by enemies without those animations. */
  special?: 'slam' | 'roar' | 'smash';
  /** Winding up an ordinary enemy's special move (a snare, a ward, a storm...): uses its `cast` pose when it has one. */
  cast?: boolean;
  /** Clinging to a hero (a snow sprite): uses its `cling` animation. */
  cling?: boolean;
  /** Getting back up after a first death (the dread knight): uses `rise`, else `dazed`. */
  rising?: boolean;
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
  const A = art.anims[type];
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
