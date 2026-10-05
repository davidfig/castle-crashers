// The four player-colour warrior sheets built by tools/art.mjs, bundled as data URLs (esbuild "dataurl" loader).
import sheetP1 from '../../art/out/warrior.p1.png';
import sheetP2 from '../../art/out/warrior.p2.png';
import sheetP3 from '../../art/out/warrior.p3.png';
import sheetP4 from '../../art/out/warrior.p4.png';

const SHEETS = [sheetP1, sheetP2, sheetP3, sheetP4];

export function loadHeroImages(): Promise<HTMLImageElement[]> {
  return Promise.all(SHEETS.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load a hero sprite sheet.'));
    img.src = src;
  })));
}
