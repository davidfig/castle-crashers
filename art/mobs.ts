// The monster roller (art/mobs.html): rolls a run seed's whole generated cast (data/bestiary) and shows each monster animated with its
// numbers, elements, powers and (for a boss) its moves, so changes to traits/plan/look can be judged at a glance. Same data as tools/bestiary.mjs.
// Bundled and served from memory by tools/dev.mjs; reloads on any change under src/ or art/.
import { generateBestiary, type Bestiary } from '../src/data/bestiary';
import { ROSTERS } from '../src/data/roster';
import { ELEMENTS } from '../src/data/elements';
import { monsterSheets } from '../src/render/monsterSprites';
import type { MonsterSheet } from '../src/data/monsterLook';
import type { MobDef, BossMove } from '../src/data/mobs';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const mem = {
  get: (k: string, d: string): string => { try { return localStorage.getItem('mobs.' + k) ?? d; } catch { return d; } },
  set: (k: string, v: string): void => { try { localStorage.setItem('mobs.' + k, v); } catch { /* unsaved */ } },
};
const ROLE = ['melee', 'ranged', 'bomber', 'boss', 'caster'];
const BIOME = ['Meadow', 'Haunted Keep', 'Frozen Pass', 'Sunken Marsh', 'Scorched Dunes'];
const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const el = (id: number | undefined): string => (id ? ELEMENTS[id]?.name ?? String(id) : '');

let paused = mem.get('paused', '0') === '1';
let zoom = Number(mem.get('zoom', '4'));
let seed = 0;
let bestiary: Bestiary;
let sheets: MonsterSheet[] = [];

interface Player { cv: HTMLCanvasElement; sheet: MonsterSheet; sel: HTMLSelectElement; t: number }
let players: Player[] = [];

const params = new URLSearchParams(location.search);
const randomSeed = (): number => (Math.random() * 2 ** 32) >>> 0;

/** Compact "key value" list of a power's tuning numbers (skips the structural keys). */
function nums(o: object, skip: readonly string[] = []): string {
  return Object.entries(o)
    .filter(([k, v]) => !skip.includes(k) && (typeof v === 'number' || typeof v === 'boolean'))
    .map(([k, v]) => (v === true ? k : `${k} ${typeof v === 'number' ? +v.toFixed(3) : v}`)).join(' · ');
}

function skillHtml(s: { kind: string; element?: number; windup: number; cooldown: number }, label = 'special'): string {
  const e = el(s.element);
  return `<div class="skill"><b>${label}: ${s.kind}</b>${e ? ` <span class="tag el" style="color:${hex(ELEMENTS[s.element!].core)}">${e}</span>` : ''}<div class="num">${esc(nums(s, ['kind', 'element']))}</div></div>`;
}

const FLAGS: readonly (keyof MobDef)[] = ['slowOnHit', 'weave', 'regen', 'pack', 'swarm', 'lunge', 'backstep', 'revive', 'retreat', 'launch', 'poisonOnHit', 'rootOnHit', 'witherOnHit', 'hop', 'thorns', 'evade', 'surrender', 'burrow', 'drain', 'trail', 'flame', 'berserk', 'aura', 'onHit', 'elemAura', 'armored', 'shield'];

function flagTags(d: MobDef): string {
  const out: string[] = [];
  for (const k of FLAGS) {
    const v = d[k];
    if (!v) continue;
    out.push(`${k}${typeof v === 'object' ? ' ' + nums(v as object, ['element']) + ((v as { element?: number }).element ? ' /' + el((v as { element?: number }).element) : '') : typeof v === 'number' ? ' ' + +v.toFixed(3) : ''}`);
  }
  return out.map((t) => `<span class="tag">${esc(t)}</span>`).join('');
}

function moveHtml(m: BossMove): string {
  const enr = m.enragedOnly ? ' <span class="enr">(enraged)</span>' : '';
  if (m.kind === 'special') {
    const s = m.special, e = el(s.element);
    return `<li><b>${s.kind}</b>${e ? ` <span style="color:${hex(ELEMENTS[s.element!].core)}">${e}</span>` : ''} w${m.weight}${enr} <span class="num">${esc(nums(s, ['kind', 'element']))}</span></li>`;
  }
  return `<li><b>${m.kind}</b> w${m.weight}${enr}</li>`;
}

function card(t: number): HTMLElement {
  const d = bestiary.defs[t], l = bestiary.looks[t], sh = sheets[t];
  const c = document.createElement('div');
  c.className = 'card' + (d.boss ? ' boss' : '');
  const pic = document.createElement('div'); pic.className = 'pic';
  const cv = document.createElement('canvas');
  const sel = document.createElement('select');
  for (const a of Object.keys(sh.meta.anims)) sel.add(new Option(a, a));
  sel.value = sh.meta.anims.walk ? 'walk' : Object.keys(sh.meta.anims)[0];
  pic.append(cv, sel);
  const elems = bestiary.elements[t].map((x) => `<span class="tag el" style="color:${hex(ELEMENTS[x].core)}">${ELEMENTS[x].name}</span>`).join('');
  const traits = bestiary.traits[t].map((x) => `<span class="tag">${esc(x)}</span>`).join('');
  const info = document.createElement('div'); info.className = 'info';
  const shot = d.shot ? skillHtml({ kind: `shot ${d.shot.count}×`, element: d.shot.element, windup: d.windup, cooldown: d.atkCooldown }, 'attack').replace(/<div class="num">.*?<\/div>/, `<div class="num">${esc(nums(d.shot, ['element']))}</div>`) : '';
  const charge = d.charge && !d.boss ? `<div class="skill"><b>charge</b> <span class="num">${esc(nums(d.charge))}</span></div>` : '';
  info.innerHTML = `
    <h3>${esc(d.boss ? d.boss.title : d.name)}${d.boss ? ` <span class="role">(${esc(d.name)})</span>` : ''}</h3>
    <div class="role">#${t} · ${l.kind ?? '?'} · ${ROLE[d.behavior]}${d.boss ? ' · boss' : ''}</div>
    <div class="stats">
      <span><b>hp</b> ${d.hp}</span><span><b>dmg</b> ${d.damage}</span><span><b>spd</b> ${d.speed.toFixed(2)}</span>
      <span><b>radius</b> ${d.radius.toFixed(1)}</span><span><b>reach</b> ${d.reach}</span><span><b>windup</b> ${d.windup}</span>
      <span><b>atk cd</b> ${d.atkCooldown}</span><span><b>knock</b> ${d.knockResist}</span><span><b>coin</b> ${d.coinChance}×${d.coinMin}-${d.coinMax}</span>
    </div>
    <div class="tags">${elems}${traits}${flagTags(d)}</div>
    <div class="look">${l.build}/${l.limbs}/${l.head}/${l.held} · back ${l.back} · crown ${l.crown} · ${l.pattern ?? '-'} hide · jaw ${l.jaw ?? '-'} · wears ${l.worn ?? '-'} · size ${l.size} · ${l.motifs.join(',') || 'no motifs'}</div>
    ${shot}${charge}${d.special ? skillHtml(d.special) : ''}
    ${d.boss ? `<div class="skill"><b>moves</b><ul class="moves">${(d.boss.moves ?? []).map(moveHtml).join('')}</ul></div>` : ''}`;
  c.append(pic, info);
  players.push({ cv, sheet: sh, sel, t: 0 });
  return c;
}

function render(): void {
  players = [];
  bestiary = generateBestiary(seed);
  sheets = monsterSheets(bestiary);
  const main = $('main');
  main.textContent = '';
  ROSTERS.forEach((r, bi) => {
    const h = document.createElement('h2'); h.className = 'biome'; h.textContent = BIOME[bi] ?? `Biome ${bi}`;
    const g = document.createElement('div'); g.className = 'grid';
    for (const en of r.entries) g.append(card(en.type));
    g.append(card(r.boss));
    main.append(h, g);
  });
  document.title = `Monster Roller · ${seed}`;
}

function setSeed(s: number, push = true): void {
  seed = s >>> 0;
  $<HTMLInputElement>('seed').value = String(seed);
  if (push) history.replaceState(null, '', `?seed=${seed}`);
  mem.set('seed', String(seed));
  try { render(); $('err').textContent = ''; } catch (e) { $('err').textContent = String(e instanceof Error ? e.stack ?? e.message : e); }
}

function draw(now: number): void {
  for (const p of players) {
    const a = p.sheet.meta.anims[p.sel.value];
    if (!a) continue;
    const frames = a.frames.map((f) => p.sheet.meta.frames[f]);
    const fr = frames[(paused ? 0 : Math.floor(now / 140)) % frames.length];
    // One fixed-size canvas per monster (the largest frame of its walk/idle), feet on the bottom edge.
    const W = Math.max(...Object.values(p.sheet.meta.frames).map((f) => f.w)), H = Math.max(...Object.values(p.sheet.meta.frames).map((f) => f.h));
    if (p.cv.width !== W * zoom) { p.cv.width = W * zoom; p.cv.height = H * zoom; }
    const ctx = p.cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, p.cv.width, p.cv.height);
    const img = getBitmap(p.sheet);
    ctx.drawImage(img, fr.x, fr.y, fr.w, fr.h, Math.floor((W - fr.w) / 2) * zoom, (H - fr.h) * zoom, fr.w * zoom, fr.h * zoom);
  }
  requestAnimationFrame(draw);
}

const bitmaps = new WeakMap<MonsterSheet, HTMLCanvasElement>();
function getBitmap(s: MonsterSheet): HTMLCanvasElement {
  let c = bitmaps.get(s);
  if (!c) {
    c = document.createElement('canvas'); c.width = s.width; c.height = s.height;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(s.rgba), s.width, s.height), 0, 0);
    bitmaps.set(s, c);
  }
  return c;
}

$<HTMLSelectElement>('zoom').value = String(zoom);
$<HTMLSelectElement>('zoom').onchange = () => { zoom = Number($<HTMLSelectElement>('zoom').value) || 4; mem.set('zoom', String(zoom)); for (const p of players) p.cv.width = 0; };
$('pause').classList.toggle('on', paused);
$('pause').onclick = () => { paused = !paused; mem.set('paused', paused ? '1' : '0'); $('pause').classList.toggle('on', paused); };
$('roll').onclick = () => setSeed(randomSeed());
$('prev').onclick = () => setSeed(seed - 1);
$('next').onclick = () => setSeed(seed + 1);
$<HTMLInputElement>('seed').onchange = () => setSeed(Number($<HTMLInputElement>('seed').value) || 0);
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.key === 'r') $('roll').click();
  else if (e.key === 'ArrowLeft') $('prev').click();
  else if (e.key === 'ArrowRight') $('next').click();
  else if (e.key === ' ') { e.preventDefault(); $('pause').click(); }
});

setSeed(params.has('seed') ? Number(params.get('seed')) : Number(mem.get('seed', '') || randomSeed()), true);
requestAnimationFrame(draw);
const es = new EventSource('/art/events');
es.onmessage = (ev) => { if (ev.data === 'reload') location.reload(); else if (ev.data.startsWith('error')) $('err').textContent = JSON.parse(ev.data.slice(6)); };
