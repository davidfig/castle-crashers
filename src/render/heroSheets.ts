// Player sprite sheets built by tools/art.mjs: every class in 4 player colours, bundled as data URLs (esbuild "dataurl" loader).
// Order: class-major (the CLASSES order), then player slot 0..3. Keep HERO_CLASSES in hero.ts in step with this.
import warriorP1 from '../../art/out/warrior.p1.png';
import warriorP2 from '../../art/out/warrior.p2.png';
import warriorP3 from '../../art/out/warrior.p3.png';
import warriorP4 from '../../art/out/warrior.p4.png';
import mageP1 from '../../art/out/mage.p1.png';
import mageP2 from '../../art/out/mage.p2.png';
import mageP3 from '../../art/out/mage.p3.png';
import mageP4 from '../../art/out/mage.p4.png';
import clericP1 from '../../art/out/cleric.p1.png';
import clericP2 from '../../art/out/cleric.p2.png';
import clericP3 from '../../art/out/cleric.p3.png';
import clericP4 from '../../art/out/cleric.p4.png';
import rogueP1 from '../../art/out/rogue.p1.png';
import rogueP2 from '../../art/out/rogue.p2.png';
import rogueP3 from '../../art/out/rogue.p3.png';
import rogueP4 from '../../art/out/rogue.p4.png';
import archerP1 from '../../art/out/archer.p1.png';
import archerP2 from '../../art/out/archer.p2.png';
import archerP3 from '../../art/out/archer.p3.png';
import archerP4 from '../../art/out/archer.p4.png';

const SHEETS = [
  warriorP1, warriorP2, warriorP3, warriorP4,
  mageP1, mageP2, mageP3, mageP4,
  clericP1, clericP2, clericP3, clericP4,
  rogueP1, rogueP2, rogueP3, rogueP4,
  archerP1, archerP2, archerP3, archerP4,
];

export function loadHeroImages(): Promise<HTMLImageElement[]> {
  return Promise.all(SHEETS.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load a hero sprite sheet.'));
    img.src = src;
  })));
}
