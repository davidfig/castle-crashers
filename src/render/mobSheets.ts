// Enemy sprite sheets built by tools/art.mjs (art/chars/goblin.mjs ... weapons.mjs), bundled as data URLs.
import goblinPng from '../../art/out/goblin.png';
import orcPng from '../../art/out/orc.png';
import archerPng from '../../art/out/mobarcher.png';
import shieldPng from '../../art/out/shieldbearer.png';
import bomberPng from '../../art/out/bomber.png';

/** Order matches MobType (goblin, orc, archer, shield, bomber). */
const SHEETS = [goblinPng, orcPng, archerPng, shieldPng, bomberPng];

export function loadMobImages(): Promise<HTMLImageElement[]> {
  return Promise.all(SHEETS.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load an enemy sprite sheet.'));
    img.src = src;
  })));
}
