// Puts a run's generated people on screen: composes each story figure's sheet (humanArt.ts), packs them into the atlas's folk band and points
// the story-figure sets (`S.npcs`) at them. Called when a run starts with a new seed.
import type { Folk } from '../data/humans';
import type { HumanSheet } from '../data/humanLook';
import { NPC_NAMES, npcSetFromSheet, type NpcName } from './npcArt';
import { composeHuman } from './humanArt';
import { packSheets } from './monsterSprites';
import type { Sprites } from './art';

const composed = new WeakMap<Folk, Record<NpcName, HumanSheet>>();

/** The composed sheets of a run's folk (cached: a run's people are built once). */
export function folkSheets(f: Folk): Record<NpcName, HumanSheet> {
  let sheets = composed.get(f);
  if (!sheets) {
    sheets = {} as Record<NpcName, HumanSheet>;
    for (const name of NPC_NAMES) sheets[name] = composeHuman(f.looks[name]);
    composed.set(f, sheets);
  }
  return sheets;
}

interface AtlasUploader { updateAtlasRows(atlas: HTMLCanvasElement, y: number, h: number): void }

/** Draws the run's people into the atlas and makes them the story figures in play. */
export function installFolkArt(S: Sprites, up: AtlasUploader, f: Folk): void {
  const sheets = folkSheets(f);
  const list = NPC_NAMES.map((n) => sheets[n]);
  const band = S.folkBand;
  const places = packSheets(list, band.w, band.h);
  if (!places) throw new Error(`The people do not fit the atlas band (${list.reduce((a, s) => a + s.width * s.height, 0)} px for ${band.w}x${band.h}).`);
  const ctx = S.atlas.getContext('2d')!;
  ctx.clearRect(band.x, band.y, band.w, band.h);
  list.forEach((sh, k) => ctx.putImageData(new ImageData(new Uint8ClampedArray(sh.rgba), sh.width, sh.height), band.x + places[k].x, band.y + places[k].y));
  NPC_NAMES.forEach((n, k) => { S.npcs[n] = npcSetFromSheet(list[k], { x: band.x + places[k].x, y: band.y + places[k].y }, S.atlas.width, S.atlas.height); });
  up.updateAtlasRows(S.atlas, band.y, band.h);
}
