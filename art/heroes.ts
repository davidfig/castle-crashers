// The hero roller (art/heroes.html): rolls a run seed's party (data/heroes): four people, one per player slot, each drawn in every class with that
// class's own defining kit, animated, with the variant numbers and colours the roll chose. Same data as tools/hero-sheet.mjs.
// Bundled and served from memory by tools/dev.mjs; reloads on any change under src/ or art/.
import { generateParty, type Party } from '../src/data/heroes';
import { CLASS_KITS, HERO_CLASS_NAMES, type HeroLook, type HeroSheet } from '../src/data/heroLook';
import { composeHero } from '../src/render/heroArt';
import { CLASSES } from '../src/data/classes';
import { SLASH_TICKS } from '../src/render/fx';
import { heroSheets } from '../src/render/heroSprites';
import { mulberry } from '../src/render/pixelKit';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const mem = {
  get: (k: string, d: string): string => { try { return localStorage.getItem('heroes.' + k) ?? d; } catch { return d; } },
  set: (k: string, v: string): void => { try { localStorage.setItem('heroes.' + k, v); } catch { /* unsaved */ } },
};
const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const swatch = (c: number, title: string): string => `<span class="sw" title="${title} ${hex(c)}" style="background:${hex(c)}"></span>`;

let paused = mem.get('paused', '0') === '1';
let zoom = Number(mem.get('zoom', '4'));
let anim = mem.get('anim', 'idle');
let seed = 0;
let mode = mem.get('mode', 'parties');
const PARTIES = 8;
let party: Party;

interface Player { cv: HTMLCanvasElement; sheet: HeroSheet; bmp: HTMLCanvasElement; cls: string }
let players: Player[] = [];
const params = new URLSearchParams(location.search);
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;

function bitmap(s: HeroSheet): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = s.width; c.height = s.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(s.rgba), s.width, s.height), 0, 0);
  return c;
}

function card(L: HeroLook, sheet: HeroSheet): HTMLElement {
  const kit = CLASS_KITS[L.cls], p = L.body.palette, b = L.body;
  const c = document.createElement('div'); c.className = 'hero';
  const cv = document.createElement('canvas');
  cv.style.cssText = 'image-rendering:pixelated;background:#2c4a30;border-radius:3px';
  const info = document.createElement('div'); info.className = 'kit';
  info.innerHTML = `${esc(kit.head)} · ${esc(kit.weapon)}<br>${esc(kit.gear.join(' · '))}<br>
    hat ${L.hat} · weapon ${L.weapon} · off ${L.off} · adorn ${L.adorn}<br>
    ${swatch(L.pal.cloth, 'cloth')}${swatch(L.pal.deep, 'deep')}${swatch(L.pal.metal, 'metal')}${swatch(L.pal.wood, 'wood')}${swatch(L.pal.glow, 'glow')}${swatch(L.pal.feather, 'feather')}${swatch(p.skin, 'skin')}${swatch(p.hair, 'hair')}<br>
    ${b.build} · ${b.hair} hair · ${b.beard} beard · ${b.height}px`;
  const h = document.createElement('h3'); h.textContent = L.cls;
  c.append(h, cv, info);
  players.push({ cv, sheet, bmp: bitmap(sheet), cls: L.cls });
  return c;
}

/** One party: four players, each in a random class, standing in a row the way they do in the field, with the colours the run rolled for them. */
function partyCard(partySeed: number): HTMLElement {
  const party = generateParty(partySeed);
  const rnd = mulberry(partySeed ^ 0x5eed);
  const c = document.createElement('div'); c.className = 'party';
  const stage = document.createElement('div'); stage.className = 'stage';
  const names: string[] = [];
  party.looks.forEach((row, slot) => {
    const L = row[Math.floor(rnd() * row.length)];
    const sheet = composeHero(L);
    const cv = document.createElement('canvas');
    stage.append(cv);
    players.push({ cv, sheet, bmp: bitmap(sheet), cls: L.cls });
    names.push(`<span style="color:${hex(party.colors[slot].cloth)}">${party.colors[slot].name} ${L.cls}</span>`);
  });
  const sw = party.colors.map((k) => `<span class="sw" style="background:${hex(k.cloth)}"></span><span class="sw" style="background:${hex(k.deep)}"></span>`).join(' ');
  const info = document.createElement('div'); info.className = 'kit';
  info.innerHTML = `seed ${partySeed} · ${sw}<br>${names.join(' · ')}`;
  c.append(stage, info);
  return c;
}

function render(): void {
  players = [];
  const main = $('main');
  main.textContent = '';
  if (mode === 'parties') {
    const g = document.createElement('div'); g.className = 'parties';
    g.style.gridTemplateColumns = `repeat(auto-fill, minmax(${zoom * 180 + 40}px, 1fr))`;
    for (let k = 0; k < PARTIES; k++) g.append(partyCard(seed + k));
    main.append(g);
    document.title = `Hero Roller · parties from ${seed}`;
    return;
  }
  party = generateParty(seed);
  const sheets = heroSheets(party);
  party.looks.forEach((row, slot) => {
    const h = document.createElement('h2'); h.className = 'biome'; h.style.color = hex(party.colors[slot].cloth); h.textContent = `P${slot + 1} ${party.colors[slot].name}`;
    const g = document.createElement('div'); g.className = 'row';
    row.forEach((L, c) => g.append(card(L, sheets[c * 4 + slot])));
    main.append(h, g);
  });
  document.title = `Hero Roller · ${seed}`;
}

function setSeed(s: number): void {
  seed = s >>> 0;
  $<HTMLInputElement>('seed').value = String(seed);
  history.replaceState(null, '', `?seed=${seed}`);
  mem.set('seed', String(seed));
  try { render(); $('err').textContent = ''; } catch (e) { $('err').textContent = String(e instanceof Error ? e.stack ?? e.message : e); }
}

const TICK = 1000 / 60;
const rep = (n: number, ms: number): number[] => Array.from({ length: n }, () => ms);

/**
 * How long each frame is on screen, as the game plays it (render/hero.ts heroFrame): idle at 3 fps and walk at 8; a swing or finisher sweeps its frames
 * over the slash arc's SLASH_TICKS; a cast spans the class's ability cooldown and a shot its fire cooldown; recover holds its own times; the downed
 * hero holds each collapse frame 10 ticks, then the last. One-shot animations hold their last frame a moment, then play again.
 */
function frameMs(cls: string, name: string, n: number, authored: number[]): { ms: number[]; loop: boolean } {
  const def = CLASSES.find((c) => c.name === cls)!;
  switch (name) {
    case 'idle': return { ms: rep(n, 1000 / 3), loop: true };
    case 'walk': return { ms: rep(n, 1000 / 8), loop: true };
    case 'sweep': case 'finisher': return { ms: rep(n, (SLASH_TICKS * TICK) / n), loop: false };
    case 'cast': {
      const total = def.totems?.cooldown ?? (def.novaCooldown > 0 ? def.novaCooldown : authored.reduce((x, y) => x + y, 0) / TICK);
      const w = authored.reduce((x, y) => x + y, 0);
      return { ms: authored.map((m) => (m / w) * total * TICK), loop: false };
    }
    case 'shoot': return { ms: rep(n, ((def.shot?.cooldown ?? 24) * TICK) / n), loop: false };
    case 'down': return { ms: [10 * TICK, 10 * TICK, 600], loop: false };
    default: return { ms: authored.slice(), loop: false };
  }
}

function draw(now: number): void {
  for (const p of players) {
    const a = p.sheet.anims[anim] ?? p.sheet.anims.idle;
    const { ms, loop } = frameMs(p.cls, p.sheet.anims[anim] ? anim : 'idle', a.frames.length, a.ms);
    const total = ms.reduce((x, y) => x + y, 0) + (loop ? 0 : 500);
    let t = paused ? 0 : now % total, k = 0;
    while (k < a.frames.length - 1 && t >= ms[k]) { t -= ms[k]; k++; }
    const fr = p.sheet.frames[a.frames[k]];
    // the cell is the game's: the feet-centre pivot sits on the bottom edge, so every frame stands where it does in play
    const W = fr.w, H = fr.h;
    if (p.cv.width !== W * zoom) { p.cv.width = W * zoom; p.cv.height = H * zoom; }
    const ctx = p.cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, p.cv.width, p.cv.height);
    ctx.drawImage(p.bmp, fr.x, fr.y, fr.w, fr.h, 0, 0, W * zoom, H * zoom);
  }
  requestAnimationFrame(draw);
}

const modeSel = $<HTMLSelectElement>('mode');
modeSel.value = mode;
modeSel.onchange = () => { mode = modeSel.value; mem.set('mode', mode); setSeed(seed); };
const sel = $<HTMLSelectElement>('anim');
for (const a of ['idle', 'walk', 'sweep', 'finisher', 'recover', 'cast', 'shoot', 'hurt', 'down']) sel.add(new Option(a, a));
sel.value = anim;
sel.onchange = () => { anim = sel.value; mem.set('anim', anim); };
$<HTMLSelectElement>('zoom').value = String(zoom);
$<HTMLSelectElement>('zoom').onchange = () => { zoom = Number($<HTMLSelectElement>('zoom').value) || 4; mem.set('zoom', String(zoom)); for (const p of players) p.cv.width = 0; if (mode === 'parties') setSeed(seed); };
$('pause').classList.toggle('on', paused);
$('pause').onclick = () => { paused = !paused; mem.set('paused', paused ? '1' : '0'); $('pause').classList.toggle('on', paused); };
$('roll').onclick = () => setSeed(randomSeed());
const step = (): number => (mode === 'parties' ? PARTIES : 1);
$('prev').onclick = () => setSeed(seed - step());
$('next').onclick = () => setSeed(seed + step());
$<HTMLInputElement>('seed').onchange = () => setSeed(Number($<HTMLInputElement>('seed').value) || 0);
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === 'r') $('roll').click();
  else if (e.key === 'ArrowLeft') $('prev').click();
  else if (e.key === 'ArrowRight') $('next').click();
  else if (e.key === ' ') { e.preventDefault(); $('pause').click(); }
});

setSeed(params.has('seed') ? Number(params.get('seed')) : Number(mem.get('seed', '') || randomSeed()));
requestAnimationFrame(draw);
const es = new EventSource('/art/events');
es.onmessage = (ev) => { if (ev.data === 'reload') location.reload(); else if (ev.data.startsWith('error')) $('err').textContent = JSON.parse(ev.data.slice(6)); };
