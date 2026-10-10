// Per-enemy presentation that is not part of the sheet: how big its shadow is, what colour it bleeds, what it holds. They come from the
// monster itself (its size and its `MonsterLook`); the looks are those of the cast whose art is on screen (set by installMonsterArt).
import type { Bestiary } from '../data/bestiary';
import { MOBS, isBossType } from '../data/mobs';
import type { HeldKind } from '../data/monsterLook';

let artCast: Bestiary | null = null;

/** The cast whose pictures are in play (monsterSprites.ts calls this when it draws a run's monsters). */
export function setArtCast(b: Bestiary | null): void { artCast = b; }

export function shadowSize(type: number): 0 | 1 | 2 {
  if (isBossType(type)) return 2;
  const r = MOBS[type].radius;
  return r >= 6 ? 2 : r >= 4.2 ? 1 : 0;
}

export function bloodColor(type: number): number {
  return artCast?.looks[type]?.palette.base ?? 0x6fbf3f;
}

/** What an enemy carries (the weapon is baked into its sprite; the game only adds the swing trail and the nocked arrow). */
export function heldOf(type: number): HeldKind {
  return artCast?.looks[type]?.held ?? 'none';
}
