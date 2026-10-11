// The level walk (art/walk.html): one real level of a seed's road with every monster taken out, the hero walking it end to end so the
// scenery, the weather and the road-scene stops can be looked at without a fight. It is the game's own sim and renderer; each tick the
// field is emptied of mobs (and what they throw), and the hero cannot be hurt. Bundled and served from memory by tools/dev.mjs.
import { Renderer } from '../src/platform/gl/renderer';
import { buildSprites } from '../src/render/art';
import { installHeroArt } from '../src/render/heroSprites';
import { generateParty } from '../src/data/heroes';
import { installFolkArt } from '../src/render/folkSprites';
import { generateFolk, installFolk } from '../src/data/humans';
import { generateBestiary, installBestiary } from '../src/data/bestiary';
import { generateWorld } from '../src/data/scenery/world';
import { installSceneryArt } from '../src/render/sceneryArt';
import { setLevelsPlayed, setWorld } from '../src/render/sceneryWorld';
import { ROAD_STRIDE } from '../src/render/scenery';
import { BIOMES } from '../src/data/biomes';
import { drawFrame } from '../src/render/draw';
import { Fx } from '../src/render/fx';
import { RoadCast } from '../src/render/roadCast';
import { Barks } from '../src/render/barks';
import { levelPlan, LEVELS_PER_BIOME, ROUTE_LEVELS } from '../src/campaign/route';
import { roadSceneFor, roadSceneT } from '../src/data/story/road';
import { createSim, Phase, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { sceneX } from '../src/sim/gen/level';
import { Kind, freeEntity } from '../src/sim/entities';
import { createInputFrame } from '../src/sim/input';
import { VIEW_H, VIEW_W, WORLD_W } from '../src/sim/constants';
import { FrameStats } from '../src/platform/perf';
import { lerp } from '../src/engine/math';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const mem = {
  get: (k: string, d: string): string => { try { return localStorage.getItem('walk.' + k) ?? d; } catch { return d; } },
  set: (k: string, v: string): void => { try { localStorage.setItem('walk.' + k, v); } catch { /* unsaved */ } },
};
const params = new URLSearchParams(location.search);
const fail = (msg: string): void => { $('err').textContent = msg; };

const TOTAL = ROUTE_LEVELS;
/** The hero stops this far short of the scene's figures while their conversation plays. */
const STOP_BEFORE = 80;
let seed = Number(params.get('seed') ?? mem.get('seed', '1')) >>> 0 || 1;
let level = Math.max(0, Math.min(TOTAL - 1, Number(params.get('level') ?? mem.get('level', '0')) || 0));
let playing = true;
let skipStop = false;
let held = 0; // arrow-key nudge
let sim: GameState;
let fx = new Fx();
const cast = new RoadCast();
const barks = new Barks();

function applyZoom(): void {
  const z = Number($<HTMLSelectElement>('zoom').value) || 2;
  const cv = $<HTMLCanvasElement>('game');
  cv.style.width = `${VIEW_W * z}px`; cv.style.height = `${VIEW_H * z}px`;
}
$<HTMLSelectElement>('zoom').value = mem.get('zoom', '2');
$<HTMLSelectElement>('zoom').onchange = () => { mem.set('zoom', $<HTMLSelectElement>('zoom').value); applyZoom(); };
$<HTMLSelectElement>('speed').value = mem.get('speed', '1');
$<HTMLSelectElement>('speed').onchange = () => mem.set('speed', $<HTMLSelectElement>('speed').value);
$<HTMLSelectElement>('weather').value = mem.get('weather', '');
function applyWeather(): void {
  const w = $<HTMLSelectElement>('weather').value;
  mem.set('weather', w);
  (globalThis as { __weather?: string }).__weather = w === '' ? undefined : w === 'none' ? '' : w;
}
$<HTMLSelectElement>('weather').onchange = applyWeather;
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'pause' : 'play'; $('play').classList.toggle('on', !playing); };
$('skip').onclick = () => { skipStop = true; };

let sceneryKey = '';
function applyRun(): void {
  installBestiary(generateBestiary(seed)); // the sim needs a cast to plan a level, though none of it will be seen
  const folk = generateFolk(seed);
  installFolk(folk);
  installFolkArt(sprites, renderer, folk);
  installHeroArt(sprites, renderer, generateParty(seed));
  const stages = Math.ceil(TOTAL / LEVELS_PER_BIOME);
  const archetypes = Array.from({ length: stages }, (_, k) => levelPlan(seed, k * LEVELS_PER_BIOME, TOTAL).biome);
  const key = `${seed}:${archetypes.join(',')}`;
  if (key === sceneryKey) return;
  sceneryKey = key;
  const world = generateWorld(seed, archetypes, LEVELS_PER_BIOME * ROAD_STRIDE);
  installSceneryArt(sprites, renderer, world);
  setWorld(world);
}

function fillLevels(): void {
  const sel = $<HTMLSelectElement>('level');
  sel.textContent = '';
  for (let k = 0; k < TOTAL; k++) {
    const plan = levelPlan(seed, k, TOTAL);
    const sc = roadSceneFor(plan.chapter, k % LEVELS_PER_BIOME, plan.boss);
    const o = document.createElement('option');
    o.value = String(k);
    o.textContent = `${k + 1}  ${BIOMES[plan.biome].name}${sc ? `  · ${sc.id}` : ''}`;
    sel.append(o);
  }
  sel.value = String(level);
}

function load(): void {
  applyRun();
  const plan = levelPlan(seed, level, TOTAL);
  setLevelsPlayed(level);
  const sc = roadSceneFor(plan.chapter, level % LEVELS_PER_BIOME, plan.boss);
  // boss: false, so the level is won by reaching its far end (whatever stood in the way is cleared away anyway)
  sim = createSim(plan.seed, undefined, { boss: false, scale: 0, damage: 0, mix: plan.mix, onward: false, offerSeed: seed, scene: sc ? { id: sc.id, t: roadSceneT(plan.seed) } : undefined });
  fx = new Fx();
  barks.reset();
  cast.reset(sim);
  skipStop = false;
  $<HTMLInputElement>('scrub').max = String(sim.exitX);
  $<HTMLInputElement>('scrub').value = '0';
  $<HTMLSelectElement>('level').value = String(level);
  mem.set('seed', String(seed)); mem.set('level', String(level));
  $<HTMLInputElement>('seed').value = String(seed);
  history.replaceState(null, '', `?seed=${seed}&level=${level}`);
}

/** Empties the field of anything that fights: the creatures, and what they threw and left burning. */
function clearField(s: GameState): void {
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) {
    if (!e.alive[i]) continue;
    const k = e.kind[i];
    if (k === Kind.Mob || k === Kind.Proj || k === Kind.Zone) freeEntity(e, i);
  }
  s.blastN = 0;
  s.gateIdx = s.gates.length; // no gate holds the walk
  const p = s.players[0];
  if (p.active) { e.hp[p.ent] = e.maxhp[p.ent]; p.downed = false; }
}

const frame = createInputFrame();
function tick(): void {
  const p = sim.players[0];
  frame.buttons = 0; frame.moveY = 0;
  const sx = sceneX(sim);
  const hx = sim.ents.x[p.ent];
  const atScene = sx >= 0 && !cast.done && !skipStop && hx > sx - STOP_BEFORE - 40 && hx < sx + 200;
  const waiting = atScene && hx >= sx - STOP_BEFORE && sim.phase === Phase.Playing;
  frame.moveX = held ? held * 127 : sim.phase !== Phase.Playing || waiting ? 0 : 127;
  step(sim, [frame, createInputFrame(), createInputFrame(), createInputFrame()]);
  clearField(sim);
  fx.camX = sim.camX;
  fx.consume(sim.events);
  fx.update(1);
  barks.update(sim, 1);
  cast.update(sim);
}

/** Jumps the party (and the camera) to road position `x`; scenery, weather and the scene all follow from where the camera is. */
function jump(x: number): void {
  const p = sim.players[0], e = sim.ents;
  x = Math.max(0, Math.min(sim.exitX - 1, x));
  const cam = Math.max(0, x - VIEW_W / 2 + 24);
  e.x[p.ent] = e.px[p.ent] = x;
  sim.camX = sim.prevCamX = sim.trigCamX = cam;
  const sx = sceneX(sim);
  if (sx >= 0 && x < sx - STOP_BEFORE - 40) cast.reset(sim); // back before the scene: it plays again
  clearField(sim);
}

$<HTMLInputElement>('scrub').oninput = () => { jump(Number($<HTMLInputElement>('scrub').value)); };
$<HTMLInputElement>('seed').onchange = () => { seed = Number($<HTMLInputElement>('seed').value) >>> 0 || 1; fillLevels(); load(); };
$<HTMLSelectElement>('level').onchange = () => { level = Number($<HTMLSelectElement>('level').value); load(); };
const go = (d: number): void => { level = (level + d + TOTAL) % TOTAL; load(); };
$('prev').onclick = () => go(-1);
$('next').onclick = () => go(1);
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type === 'number') return;
  if (e.target instanceof HTMLSelectElement) return;
  if (e.key === ' ') { e.preventDefault(); $('play').click(); }
  else if (e.key === 's') $('skip').click();
  else if (e.key === '[') go(-1);
  else if (e.key === ']') go(1);
  else if (e.key === 'ArrowRight') { e.preventDefault(); held = 1; }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); jump(sim.ents.x[sim.players[0].ent] - 24); }
});
window.addEventListener('keyup', (e) => { if (e.key === 'ArrowRight') held = 0; });

let renderer: Renderer;
let sprites: ReturnType<typeof buildSprites>;
(async () => {
  try {
    sprites = buildSprites();
    renderer = new Renderer($<HTMLCanvasElement>('game'), sprites.atlas, VIEW_W, VIEW_H);
    (window as unknown as { sprites: typeof sprites; sim: () => GameState }).sprites = sprites;
    (window as unknown as { sim: () => GameState }).sim = () => sim;
    applyZoom();
    applyWeather();
    fillLevels();
    load();
    const stats = new FrameStats();
    let last = performance.now(), acc = 0;
    const loop = (now: number): void => {
      const dt = now - last; last = now;
      if (playing || held) acc += dt * Number($<HTMLSelectElement>('speed').value);
      acc = Math.min(acc, 400);
      while (acc >= 1000 / 60) { acc -= 1000 / 60; tick(); }
      if (sim.phase !== Phase.Playing && playing) { sim.phase = Phase.Playing; } // the far end reached: hold there rather than banner
      const alpha = acc / (1000 / 60);
      const cam = lerp(sim.prevCamX, sim.camX, alpha);
      renderer.begin();
      drawFrame(renderer.batcher, sprites, sim, fx, cam, alpha, { stats, simLag: false, drawCalls: 0, sprites: 0, cast, hideEndBanner: true });
      cast.drawBubbles(renderer.batcher, sprites, sim, cam, alpha);
      if (!cast.hearing()) barks.draw(renderer.batcher, sprites, sim, cam, alpha);
      renderer.end();
      const x = sim.ents.x[sim.players[0].ent];
      if (document.activeElement !== $('scrub')) $<HTMLInputElement>('scrub').value = String(Math.round(x));
      const sx = sceneX(sim);
      $('info').textContent = `${BIOMES[levelPlan(seed, level, TOTAL).biome].name} · x ${Math.round(x)}/${sim.exitX}${sx >= 0 ? ` · stop at ${Math.round(sx)}${cast.done ? ' (done)' : cast.hearing() ? ' (talking)' : ''}` : ' · no stop'}`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } catch (err) { fail(String(err instanceof Error ? err.stack ?? err.message : err)); }
  const es = new EventSource('/art/events');
  es.onmessage = (ev) => { if (ev.data === 'reload') location.reload(); else if (ev.data.startsWith('error')) fail(JSON.parse(ev.data.slice(6))); };
})();
void WORLD_W;
