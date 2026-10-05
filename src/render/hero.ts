// Hero sprites from the art workbench (art/chars/*.mjs -> art/out/*, built by tools/art.mjs).
// art.ts packs the four player-colour sheets into the atlas (heroSheets.ts loads them); this file maps game state to a frame.
import type { Frame } from '../platform/gl/batcher';
import { CLASSES } from '../data/classes';
import { REVIVE_TICKS } from '../sim/step';
import type { GameState } from '../sim/state';
import { SLASH_TICKS, type Fx } from './fx';
import warriorMeta from '../../art/out/warrior.json';

export interface HeroAnim { frames: Frame[]; ms: number[] }
export interface HeroSet {
  /** Pivot inside a frame: the feet-centre pixel that is placed on the entity position. */
  pivotX: number;
  pivotY: number;
  /** Pixels of art above the ground line (for overhead bars). */
  top: number;
  /** [slot][animName] */
  anims: Record<string, HeroAnim>[];
}

/** Turns each sheet's placement in the atlas into UV frames for every animation. */
export function buildHeroSet(places: { x: number; y: number }[], atlasW: number, atlasH: number): HeroSet {
  const meta = warriorMeta as unknown as {
    pivot: number[]; top: number; frames: Record<string, { x: number; y: number; w: number; h: number }>;
    anims: Record<string, { frames: string[]; ms: number[] }>;
  };
  const anims = places.map((pl) => {
    const out: Record<string, HeroAnim> = {};
    for (const [name, a] of Object.entries(meta.anims)) {
      out[name] = {
        ms: a.ms,
        frames: a.frames.map((fn) => {
          const r = meta.frames[fn];
          return { u0: (pl.x + r.x) / atlasW, v0: (pl.y + r.y) / atlasH, u1: (pl.x + r.x + r.w) / atlasW, v1: (pl.y + r.y + r.h) / atlasH, w: r.w, h: r.h };
        }),
      };
    }
    return out;
  });
  return { pivotX: meta.pivot[0], pivotY: meta.pivot[1], top: meta.top, anims };
}

/** Picks the frame at fraction t (0..1) of an animation, weighting frames by their authored durations. */
function byProgress(a: HeroAnim, t: number): Frame {
  const total = a.ms.reduce((x, y) => x + y, 0);
  let at = Math.max(0, Math.min(0.9999, t)) * total;
  for (let k = 0; k < a.frames.length; k++) {
    if (at < a.ms[k]) return a.frames[k];
    at -= a.ms[k];
  }
  return a.frames[a.frames.length - 1];
}

/** The slash arc a player is currently sweeping, or -1. Newest wins when swings chain. */
function activeSlash(fx: Fx, slot: number): number {
  let best = -1;
  for (let k = 0; k < fx.slt.length; k++) {
    if (fx.slt[k] < 0 || fx.slSlot[k] !== slot) continue;
    if (best < 0 || fx.slt[k] < fx.slt[best]) best = k;
  }
  return best;
}

/**
 * Chooses the hero frame for this tick.
 *  - swings follow the slash arc the game draws: the sprite's blade sweeps through its frames over the same
 *    SLASH_TICKS the arc takes (reversed for the rising backhand, wide for the finisher), then settles in `recover`
 *  - ability: the cast animation spans the ability cooldown
 *  - otherwise hurt / walk / idle; downed plays the collapse once, then holds
 */
export function heroFrame(set: HeroSet, s: GameState, fx: Fx, slot: number, moving: boolean): Frame {
  const A = set.anims[slot];
  const p = s.players[slot];
  const i = p.ent;
  const cls = CLASSES[p.classId];

  if (p.downed) {
    const elapsed = REVIVE_TICKS - p.downTimer;
    return A.down.frames[elapsed < 10 ? 0 : elapsed < 20 ? 1 : 2];
  }

  const k = activeSlash(fx, slot);
  if (k >= 0 && fx.slt[k] <= SLASH_TICKS) {
    const heavy = fx.slHeavy[k] === 1;
    const anim = heavy ? A.finisher : A.sweep;
    const prog = fx.slt[k] / SLASH_TICKS;
    const idx = Math.min(anim.frames.length - 1, Math.floor(prog * anim.frames.length));
    return anim.frames[!heavy && fx.slDir[k] < 0 ? anim.frames.length - 1 - idx : idx];
  }
  if (p.cdAbility1 > 0 && cls.novaCooldown > 0) {
    return byProgress(A.cast, (cls.novaCooldown - p.cdAbility1) / cls.novaCooldown);
  }
  if (p.cdAttack > 0) return A.recover.frames[p.cdAttack > 8 ? 0 : 1];
  if (s.ents.hurt[i] > 0) return A.hurt.frames[0];
  const t = s.tick / 60;
  return moving
    ? A.walk.frames[Math.floor(t * 8) % A.walk.frames.length]
    : A.idle.frames[Math.floor(t * 3) % A.idle.frames.length];
}
