// The screens workbench (art/screens.html): renders the game's own screens (title, party select, the Writ board and every hub
// scene) with the game's own renderer, live, so the story's graphics and words can be worked on without playing up to them.
// Bundled and served from memory by tools/art-dev.mjs; it reloads on any change under src/ or art/.
import { Renderer } from '../src/platform/gl/renderer';
import { buildSprites } from '../src/render/art';
import { loadHeroImages } from '../src/render/heroSheets';
import { loadNpcImages } from '../src/render/npcSheets';
import { drawScreen } from '../src/render/menu';
import { VIEW_H, VIEW_W } from '../src/sim/constants';
import { AFTERMATH, HUB_SCENES, INTRO, type Scene } from '../src/data/story/hub';
import { boardScreen, scenePages, sceneScreen, selectScreen, type LobbySlot, type Screen } from '../src/campaign/view';
import { createLedger } from '../src/campaign/ledger';
import { offerWrits } from '../src/campaign/board';
import { CLASSES } from '../src/data/classes';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const mem = {
  get: (k: string, d: string): string => { try { return localStorage.getItem('screens.' + k) ?? d; } catch { return d; } },
  set: (k: string, v: string): void => { try { localStorage.setItem('screens.' + k, v); } catch { /* unsaved */ } },
};

const CLASS_NAMES = CLASSES.map((c) => c.name);
const SCENES: Scene[] = [...INTRO, ...Object.values(HUB_SCENES), ...Object.values(AFTERMATH)];

interface Entry { id: string; label: string; scene?: Scene }
const ENTRIES: Entry[] = [
  { id: 'title', label: 'Title' },
  { id: 'select', label: 'Party select' },
  { id: 'board', label: 'Writ board' },
  ...SCENES.map((s) => ({ id: `scene:${s.id}`, label: `Scene: ${s.title} (${s.id})`, scene: s })),
];

const params = new URLSearchParams(location.search);
let current = params.get('screen') ?? mem.get('screen', 'title');
if (!ENTRIES.some((e) => e.id === current)) current = 'title';
let page = Math.max(0, Number(params.get('page') ?? 0) || 0);
let party: string[] = (params.get('party') ?? mem.get('party', 'warrior,mage')).split(',').filter((c) => CLASS_NAMES.includes(c));
let chapter = Math.max(1, Math.min(5, Number(params.get('chapter') ?? mem.get('chapter', '1')) || 1));
let paused = false;

const sel = $<HTMLSelectElement>('screen');
for (const e of ENTRIES) sel.add(new Option(e.label, e.id));
sel.value = current;
sel.onchange = () => { current = sel.value; page = 0; mem.set('screen', current); refresh(); };
$<HTMLSelectElement>('zoom').value = mem.get('zoom', '2');
$<HTMLSelectElement>('zoom').onchange = () => { mem.set('zoom', $<HTMLSelectElement>('zoom').value); applyZoom(); };
$('pause').onclick = () => { paused = !paused; $('pause').classList.toggle('on', paused); };
$('prev').onclick = () => { page = Math.max(0, page - 1); refresh(); };
$('next').onclick = () => { page++; refresh(); };
$<HTMLSelectElement>('chapter').value = String(chapter);
$<HTMLSelectElement>('chapter').onchange = () => { chapter = Number($<HTMLSelectElement>('chapter').value); mem.set('chapter', String(chapter)); refresh(); };
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLSelectElement) return;
  if (e.key === 'ArrowRight') { page++; refresh(); } else if (e.key === 'ArrowLeft') { page = Math.max(0, page - 1); refresh(); } else if (e.key === ' ') { e.preventDefault(); $('pause').click(); }
});

const partyRow = $('partyRow');
for (const c of CLASS_NAMES) {
  const l = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = party.includes(c);
  cb.onchange = () => { party = CLASS_NAMES.filter((n) => (n === c ? cb.checked : party.includes(n))); mem.set('party', party.join(',')); refresh(); };
  l.append(cb, c);
  partyRow.append(l);
}

function applyZoom(): void {
  const z = Number($<HTMLSelectElement>('zoom').value) || 2;
  const cv = $<HTMLCanvasElement>('game');
  cv.style.width = `${VIEW_W * z}px`; cv.style.height = `${VIEW_H * z}px`;
}

/** The lobby shown for the party select: a few classes joined, one ready, one empty. */
function sampleLobby(): LobbySlot[] {
  return [{ joined: true, ready: true, classId: 0 }, { joined: true, ready: false, classId: 1 }, { joined: true, ready: false, classId: 4 }, { joined: false, ready: false, classId: 0 }];
}

function screenFor(e: Entry): Screen {
  if (e.id === 'title') return { kind: 'title' };
  if (e.id === 'select') return selectScreen(undefined, sampleLobby());
  if (e.id === 'board') {
    const l = { ...createLedger(11), chapter };
    return boardScreen(l, offerWrits(l), 0);
  }
  return sceneScreen(e.scene!, party, page);
}

function renderWords(e: Entry): void {
  const box = $('words');
  box.textContent = '';
  if (!e.scene) { box.textContent = 'This screen has no scene text; its words live in src/campaign/view.ts and src/data/story/.'; return; }
  const pages = scenePages(e.scene, party);
  pages.forEach((p, i) => {
    const d = document.createElement('p');
    if (i === Math.min(page, pages.length - 1)) d.className = 'cur';
    const who = document.createElement('span');
    who.className = p.speaker === 'narrator' ? 'who narr' : 'who';
    who.textContent = `${i + 1}. ${p.speaker}  `;
    d.append(who, p.lines.map((l) => l.text).join(' '));
    box.append(d);
  });
}

let screen: Screen = { kind: 'title' };
function refresh(): void {
  const e = ENTRIES.find((x) => x.id === current)!;
  const total = e.scene ? scenePages(e.scene, party).length : 1;
  page = Math.min(page, total - 1);
  screen = screenFor(e);
  $('title').textContent = e.label;
  $('pager').style.display = e.scene ? '' : 'none';
  $('partyRow').style.display = e.scene ? '' : 'none';
  $('chapterRow').style.display = e.id === 'board' ? '' : 'none';
  $('pageNo').textContent = `${page + 1} / ${total}`;
  renderWords(e);
}

const fail = (msg: string): void => { $('err').textContent = msg; };
(async () => {
  try {
    const sprites = buildSprites(await loadHeroImages(), await loadNpcImages());
    (window as unknown as { sprites: typeof sprites }).sprites = sprites; // for poking at in the console
    const renderer = new Renderer($<HTMLCanvasElement>('game'), sprites.atlas, VIEW_W, VIEW_H);
    applyZoom();
    refresh();
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
  const es = new EventSource('/events');
  es.onmessage = (ev) => { if (ev.data === 'reload') location.reload(); else if (ev.data.startsWith('error')) fail(JSON.parse(ev.data.slice(6))); };
})();
