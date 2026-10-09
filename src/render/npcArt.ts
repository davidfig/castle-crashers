// Non-player characters from the art workbench (art/chars/registrar.mjs, peddler.mjs -> art/out/*): figures that stand beside
// the text on the story screens. Each has an idle and a talk loop. The sheet loader is in npcSheets.ts; this file is the
// metadata and the mapping to atlas frames, kept free of image imports so tests can use it.
import type { Frame } from '../platform/gl/batcher';
import registrarMeta from '../../art/out/registrar.json';
import peddlerMeta from '../../art/out/peddler.json';
import kingMeta from '../../art/out/king.json';
import heraldMeta from '../../art/out/herald.json';
import captainMeta from '../../art/out/captain.json';
import elderMeta from '../../art/out/elder.json';

/** Order matches the sheets in npcSheets.ts. */
export const NPC_NAMES = ['registrar', 'peddler', 'king', 'herald', 'captain', 'elder'] as const;
export type NpcName = (typeof NPC_NAMES)[number];

interface NpcMeta {
  pivot: number[];
  cell: number[];
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
  anims: Record<string, { frames: string[]; ms: number[] }>;
}
const METAS = [registrarMeta, peddlerMeta, kingMeta, heraldMeta, captainMeta, elderMeta] as unknown as NpcMeta[];

export interface NpcAnim { frames: Frame[]; ms: number[] }
export interface NpcSet {
  /** The feet-centre pixel inside a frame, which is placed on the screen position. */
  pivotX: number;
  pivotY: number;
  anims: Record<string, NpcAnim>;
}

/** places: one atlas placement per sheet, in NPC_NAMES order. */
export function buildNpcSets(places: { x: number; y: number }[], atlasW: number, atlasH: number): Record<NpcName, NpcSet> {
  const out = {} as Record<NpcName, NpcSet>;
  METAS.forEach((meta, i) => {
    const pl = places[i];
    const anims: Record<string, NpcAnim> = {};
    for (const [name, a] of Object.entries(meta.anims)) {
      anims[name] = {
        ms: a.ms,
        frames: a.frames.map((fn) => {
          const r = meta.frames[fn];
          return { u0: (pl.x + r.x) / atlasW, v0: (pl.y + r.y) / atlasH, u1: (pl.x + r.x + r.w) / atlasW, v1: (pl.y + r.y + r.h) / atlasH, w: r.w, h: r.h };
        }),
      };
    }
    out[NPC_NAMES[i]] = { pivotX: meta.pivot[0], pivotY: meta.pivot[1], anims };
  });
  return out;
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
