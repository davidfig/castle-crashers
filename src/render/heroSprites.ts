// Puts a run's generated heroes on screen: composes every (class, player slot) sheet (heroArt.ts), packs them into the atlas's hero band and builds the
// hero sets the renderer reads (hero.ts). Called when a run starts with a new seed.
import type { Party } from '../data/heroes';
import type { HeroSheet } from '../data/heroLook';
import { composeHero } from './heroArt';
import { buildHeroSets, HERO_CLASSES, HERO_SLOTS, type HeroMeta } from './hero';
import { packSheets } from './monsterSprites';
import { PLAYER_COLORS, type Sprites } from './art';
import { mixc } from './pixelKit';

const composed = new WeakMap<Party, HeroSheet[]>();

/** The party's sheets, class-major then slot (cached: a run's heroes are built once). The four slots of a class share one cell size and pivot. */
export function heroSheets(party: Party): HeroSheet[] {
  let out = composed.get(party);
  if (!out) {
    out = [];
    for (let c = 0; c < HERO_CLASSES.length; c++) {
      const mine = Array.from({ length: HERO_SLOTS }, (_, slot) => composeHero(party.looks[slot][c]));
      const E = Math.max(...mine.map((s) => s.pivot[0])), top = Math.max(...mine.map((s) => s.pivot[1] + 1));
      const same = mine.every((s) => s.pivot[0] === E && s.pivot[1] + 1 === top);
      out.push(...(same ? mine : mine.map((_, slot) => composeHero(party.looks[slot][c], { E, top }))));
    }
    composed.set(party, out);
  }
  return out;
}

interface AtlasUploader { updateAtlasRows(atlas: HTMLCanvasElement, y: number, h: number): void }

/** Draws the party into the atlas and makes them the heroes in play. */
export function installHeroArt(S: Sprites, up: AtlasUploader, party: Party): void {
  const sheets = heroSheets(party);
  const band = S.heroBand;
  const places = packSheets(sheets, band.w, band.h);
  if (!places) throw new Error(`The heroes do not fit the atlas band (${sheets.reduce((a, s) => a + s.width * s.height, 0)} px for ${band.w}x${band.h}).`);
  const ctx = S.atlas.getContext('2d')!;
  ctx.clearRect(band.x, band.y, band.w, band.h);
  sheets.forEach((sh, k) => ctx.putImageData(new ImageData(new Uint8ClampedArray(sh.rgba), sh.width, sh.height), band.x + places[k].x, band.y + places[k].y));
  S.heroes = buildHeroSets(sheets as HeroMeta[], places.map((p) => ({ x: band.x + p.x, y: band.y + p.y })), S.atlas.width, S.atlas.height);
  up.updateAtlasRows(S.atlas, band.y, band.h);
  // the HUD's player colours (health bars, rings, name tags) are the party's, so a hero and their bar always match
  party.colors.forEach((c, i) => { PLAYER_COLORS[i] = mixc(c.cloth, c.light, 0.25); });
}
