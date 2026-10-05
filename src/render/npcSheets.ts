// The NPC sprite sheets built by tools/art.mjs, bundled as data URLs (see npcArt.ts for the metadata). Order: NPC_NAMES.
import registrarPng from '../../art/out/registrar.png';
import peddlerPng from '../../art/out/peddler.png';

const SHEETS = [registrarPng, peddlerPng];

export function loadNpcImages(): Promise<HTMLImageElement[]> {
  return Promise.all(SHEETS.map((src) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load an NPC sprite sheet.'));
    img.src = src;
  })));
}
