// The screens workbench (art/screens.html): renders the title screen with the game's own renderer, live, so its graphics can be
// worked on without launching the game. (The other menu screens are gone from the game.)
// Bundled and served from memory by tools/dev.mjs; it reloads on any change under src/ or art/.
import { Renderer } from '../src/platform/gl/renderer';
import { buildSprites } from '../src/render/art';
import { installHeroArt } from '../src/render/heroSprites';
import { generateParty } from '../src/data/heroes';
import { installFolkArt } from '../src/render/folkSprites';
import { generateFolk, installFolk } from '../src/data/humans';
import { generateBestiary, installBestiary } from '../src/data/bestiary';
import { installMonsterArt } from '../src/render/monsterSprites';
import { drawScreen } from '../src/render/menu';
import { VIEW_H, VIEW_W } from '../src/sim/constants';
import type { Screen } from '../src/campaign/view';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const mem = {
  get: (k: string, d: string): string => { try { return localStorage.getItem('screens.' + k) ?? d; } catch { return d; } },
  set: (k: string, v: string): void => { try { localStorage.setItem('screens.' + k, v); } catch { /* unsaved */ } },
};

const params = new URLSearchParams(location.search);
let paused = false;

$<HTMLSelectElement>('zoom').value = mem.get('zoom', '2');
$<HTMLSelectElement>('zoom').onchange = () => { mem.set('zoom', $<HTMLSelectElement>('zoom').value); applyZoom(); };
$('pause').onclick = () => { paused = !paused; $('pause').classList.toggle('on', paused); };
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  if (e.key === ' ') { e.preventDefault(); $('pause').click(); }
});

function applyZoom(): void {
  const z = Number($<HTMLSelectElement>('zoom').value) || 2;
  const cv = $<HTMLCanvasElement>('game');
  cv.style.width = `${VIEW_W * z}px`; cv.style.height = `${VIEW_H * z}px`;
}

const screen: Screen = { kind: 'title' };
const fail = (msg: string): void => { $('err').textContent = msg; };
(async () => {
  try {
    const sprites = buildSprites();
    (window as unknown as { sprites: typeof sprites }).sprites = sprites; // for poking at in the console
    const renderer = new Renderer($<HTMLCanvasElement>('game'), sprites.atlas, VIEW_W, VIEW_H);
    // The story figures are generated per run (docs/19-generated-humans.md): ?seed=N picks the monsters and people on the title.
    const seed = Number(params.get('seed') ?? mem.get('seed', '1')) || 1;
    const cast = generateBestiary(seed); // the title's horde is this run's generated monsters
    installBestiary(cast);
    installMonsterArt(sprites, renderer, cast);
    const folk = generateFolk(seed);
    installFolk(folk);
    installFolkArt(sprites, renderer, folk);
    installHeroArt(sprites, renderer, generateParty(seed));
    applyZoom();
    let tick = 0, last = performance.now(), acc = 0;
    const frame = (now: number): void => {
      acc += now - last; last = now;
      while (acc >= 1000 / 60) { acc -= 1000 / 60; if (!paused) tick++; }
      renderer.begin();
      drawScreen(renderer.batcher, sprites, screen, tick + acc / (1000 / 60));
      renderer.end();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  } catch (err) { fail(String(err instanceof Error ? err.message : err)); }
  const es = new EventSource('/art/events');
  es.onmessage = (ev) => { if (ev.data === 'reload') location.reload(); else if (ev.data.startsWith('error')) fail(JSON.parse(ev.data.slice(6))); };
})();
