// Puts a run's generated monsters on screen: composes every slot's sheet (monsterArt.ts), packs them into the atlas's monster band, and points
// the sprite tables at them. Called when a run starts with a new bestiary; with no bestiary the hand-made enemy art is restored.
import type { Bestiary } from '../data/bestiary';
import type { MonsterSheet } from '../data/monsterLook';
import { buildMobArtFrom, type SheetMeta } from './mobArt';
import { composeMonster } from './monsterArt';
import type { Sprites } from './art';

/** Shelf-packs sheets (tallest first, one px apart) into a W x H area. Returns each sheet's top-left, or null when they do not fit. */
export function packSheets(sizes: readonly { width: number; height: number }[], W: number, H: number): { x: number; y: number }[] | null {
  const places: { x: number; y: number }[] = new Array(sizes.length);
  let x = 0, y = 0, rowH = 0;
  for (const i of sizes.map((_, k) => k).sort((a, b) => sizes[b].height - sizes[a].height || a - b)) {
    const s = sizes[i];
    if (s.width > W) return null;
    if (x + s.width + 1 > W) { x = 0; y += rowH + 1; rowH = 0; }
    places[i] = { x, y };
    x += s.width + 1;
    if (s.height > rowH) rowH = s.height;
  }
  return y + rowH <= H ? places : null;
}

const composed = new WeakMap<Bestiary, MonsterSheet[]>();

/** The composed sheets of a bestiary (cached: a run's cast is built once). */
export function monsterSheets(b: Bestiary): MonsterSheet[] {
  let sheets = composed.get(b);
  if (!sheets) { sheets = b.looks.map((look) => composeMonster(look)); composed.set(b, sheets); }
  return sheets;
}

/** What the renderer must offer: re-upload some rows of the atlas canvas. */
interface AtlasUploader { updateAtlasRows(atlas: HTMLCanvasElement, y: number, h: number): void }

/** Draws the bestiary's monsters into the atlas and makes them the art in play (null: the hand-made art again). */
export function installMonsterArt(S: Sprites, up: AtlasUploader, b: Bestiary | null): void {
  if (!b) {
    S.mobArt = S.classicMobArt;
  } else {
    const sheets = monsterSheets(b);
    const band = S.monsterBand;
    const places = packSheets(sheets, band.w, band.h);
    if (!places) throw new Error(`The monsters do not fit the atlas band (${sheets.reduce((a, s) => a + s.width * s.height, 0)} px for ${band.w}x${band.h}).`);
    const ctx = S.atlas.getContext('2d')!;
    ctx.clearRect(band.x, band.y, band.w, band.h);
    sheets.forEach((sh, k) => ctx.putImageData(new ImageData(new Uint8ClampedArray(sh.rgba), sh.width, sh.height), band.x + places[k].x, band.y + places[k].y));
    S.mobArt = buildMobArtFrom(sheets.map((s) => s.meta as SheetMeta), places.map((p) => ({ x: band.x + p.x, y: band.y + p.y })), S.atlas.width, S.atlas.height);
    up.updateAtlasRows(S.atlas, band.y, band.h);
  }
  S.mob = S.mobArt.walk;
  S.corpse = S.mobArt.anims.map((a) => a.dead[0]);
}
