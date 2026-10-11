// The story figures (the Registrar, peddler, King, Herald, Captain and Elder) that stand beside the text on the story screens and in road
// scenes. Each has an idle and a talk loop. They are generated per run (data/humans, render/humanArt.ts, folkSprites.ts); this file is
// the mapping from a composed sheet to atlas frames, kept free of image imports so tests can use it.
import type { HumanSheet } from '../data/humanLook';
import type { Frame } from '../platform/gl/batcher';
export const NPC_NAMES = ['registrar', 'peddler', 'king', 'herald', 'captain', 'elder'] as const;
export type NpcName = (typeof NPC_NAMES)[number];

export interface NpcAnim { frames: Frame[]; ms: number[] }
export interface NpcSet {
  /** The feet-centre pixel inside a frame, which is placed on the screen position. */
  pivotX: number;
  pivotY: number;
  anims: Record<string, NpcAnim>;
}

/** The set of one generated person (humanArt.ts), whose composed sheet sits at `place` in the atlas. */
export function npcSetFromSheet(sheet: HumanSheet, place: { x: number; y: number }, atlasW: number, atlasH: number): NpcSet {
  const anims: Record<string, NpcAnim> = {};
  for (const [name, a] of Object.entries(sheet.anims)) {
    anims[name] = {
      ms: a.ms,
      frames: a.frames.map((fn) => {
        const r = sheet.frames[fn];
        return { u0: (place.x + r.x) / atlasW, v0: (place.y + r.y) / atlasH, u1: (place.x + r.x + r.w) / atlasW, v1: (place.y + r.y + r.h) / atlasH, w: r.w, h: r.h };
      }),
    };
  }
  return { pivotX: sheet.pivot[0], pivotY: sheet.pivot[1], anims };
}

/** The frame of an animation at `ms` milliseconds into its loop. */
export function npcFrame(a: NpcAnim, ms: number): Frame {
  const total = a.ms.reduce((x, y) => x + y, 0);
  let at = ((ms % total) + total) % total;
  for (let k = 0; k < a.frames.length; k++) {
    if (at < a.ms[k]) return a.frames[k];
    at -= a.ms[k];
  }
  return a.frames[a.frames.length - 1];
}
