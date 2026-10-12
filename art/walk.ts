// The road walk (art/walk.html): a seed's whole road as the game walks it (one sim, the town to the destination) with every monster taken
// out, the hero walking it end to end so the scenery, the weather, the camps, the crossroads and the road-scene stops can be looked at
// without a fight. It is the game's own sim and renderer; each tick the field is emptied of mobs (and what they throw), and the hero
// cannot be hurt. Bundled and served from memory by tools/dev.mjs.
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
import { BIOMES } from '../src/data/biomes';
import { drawFrame } from '../src/render/draw';
import { Fx } from '../src/render/fx';
import { RoadCast } from '../src/render/roadCast';
import { Barks } from '../src/render/barks';
import { LEVELS_PER_BIOME, ROUTE_LEVELS } from '../src/campaign/route';
import { createSim, Phase, type GameState } from '../src/sim/state';
import { step } from '../src/sim/step';
import { sceneX } from '../src/sim/gen/level';
import { commitFork, inCamp, roadPart, roadUpkeep, stageBounds, type Calm, type RoadLayout } from '../src/sim/gen/road';
import { TOWN_GATE_X } from '../src/data/town';
import { Kind, freeEntity } from '../src/sim/entities';
import { createInputFrame } from '../src/sim/input';
import { STORE_X, VIEW_H, VIEW_W, WORLD_H } from '../src/sim/constants';
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
let playing = true;
let skipStop = false;
let held = 0; // arrow-key nudge
let sim: GameState;
let fx = new Fx();
const cast = new RoadCast();
const barks = new Barks();
let lingerTicks = 0; // how long the hero has stood at the current camp
let lingerCalm = -2;
let paintedChoices = -1;
let castScene = -2;

const road = (): NonNullable<GameState['road']> => sim.road!;
const forkMode = (): string => $<HTMLSelectElement>('fork').value;
/** The side of a crossroads the hero is steered onto (0 the upper road, 1 the lower), by the "crossroads" setting. */
const sideFor = (stage: number): number => forkMode() === 'upper' ? 0 : forkMode() === 'lower' ? 1 : (stage - 1) % 2;
const lingerFor = (): number => Number($<HTMLSelectElement>('linger').value);

function applyZoom(): void {
  const z = Number($<HTMLSelectElement>('zoom').value) || 2;
  const cv = $<HTMLCanvasElement>('game');
  cv.style.width = `${VIEW_W * z}px`; cv.style.height = `${VIEW_H * z}px`;
}
for (const id of ['zoom', 'speed', 'fork', 'linger']) {
  const el = $<HTMLSelectElement>(id);
  el.value = mem.get(id, el.value);
  el.addEventListener('change', () => { mem.set(id, el.value); if (id === 'zoom') applyZoom(); });
}
$<HTMLSelectElement>('weather').value = mem.get('weather', '');
function applyWeather(): void {
  const w = $<HTMLSelectElement>('weather').value;
  mem.set('weather', w);
  (globalThis as { __weather?: string }).__weather = w === '' ? undefined : w === 'none' ? '' : w;
}
$<HTMLSelectElement>('weather').onchange = applyWeather;
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'pause' : 'play'; $('play').classList.toggle('on', !playing); };
$('skip').onclick = () => { skipStop = true; lingerTicks = Infinity; };

let sceneryKey = '';
/** Paints the road's regions in their biomes, as the game does: a crossroads' upper road until chosen, then the chosen one. */
function paintScenery(biomes: number[], layout: RoadLayout): void {
  const stages = Math.max(1, Math.ceil(TOTAL / LEVELS_PER_BIOME));
  const bounds = stageBounds(layout);
  const key = `${seed}:${biomes.slice(0, stages).join(',')}:${bounds.join(',')}`;
  if (key === sceneryKey) return;
  sceneryKey = key;
  const stageLen = Math.min(...bounds.slice(1).map((b, k) => b - bounds[k]));
  const world = generateWorld(seed, biomes.slice(0, stages), stageLen, bounds, true); // each turn waits for its crossroads
  installSceneryArt(sprites, renderer, world);
  setWorld(world);
}

function installRun(): void {
  installBestiary(generateBestiary(seed)); // the sim needs a cast to plan the road, though none of it will be seen
  const folk = generateFolk(seed);
  installFolk(folk);
  installFolkArt(sprites, renderer, folk);
  installHeroArt(sprites, renderer, generateParty(seed));
}

/** Where the road's notable places are, for the "go to" list and the previous / next buttons. */
interface Place { label: string; x: number }
let places: Place[] = [];
function listPlaces(): void {
  const r = road(), L = r.layout, bounds = stageBounds(L);
  const out: Place[] = [{ label: 'Starting town', x: 0 }];
  bounds.slice(1, -1).forEach((x, k) => {
    // (a crossroads' upper road until chosen: the region's name is only certain once it has been)
    const b = r.biomes[k + 1];
    out.push({ label: `Region ${k + 2} · ${BIOMES[b].name}${k + 1 > r.choices.length ? ' (if upper)' : ''}`, x });
  });
  out.push({ label: `Region 1 · ${BIOMES[r.biomes[0]].name}`, x: TOWN_GATE_X + 40 });
  for (const c of L.calm) {
    if (c.kind === 'camp') out.push({ label: `Camp · after level ${c.level + 1}`, x: c.from });
    else if (c.kind === 'scene') out.push({ label: `Scene · ${c.scene}`, x: Math.max(0, (c.x ?? c.from) - STOP_BEFORE - 160) });
    else if (c.kind === 'fork') out.push({ label: `Crossroads · ${(c.options ?? []).map((b) => BIOMES[b].name).join(' / ')}`, x: c.from });
  }
  out.push({ label: 'Destination', x: Math.max(0, L.length - 900) });
  out.sort((a, b) => a.x - b.x);
  places = out;
  const sel = $<HTMLSelectElement>('place');
  sel.textContent = '';
  out.forEach((pl, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = `${Math.round(pl.x)}  ${pl.label}`; sel.append(o); });
}

function load(at = 0): void {
  installRun();
  setLevelsPlayed(0);
  sim = createSim(seed, undefined, { road: { total: TOTAL }, offerSeed: seed });
  fx = new Fx();
  barks.reset();
  cast.reset(sim);
  skipStop = false; lingerTicks = 0; lingerCalm = -2; paintedChoices = -1; castScene = -2;
  paintScenery(road().biomes, road().layout);
  listPlaces();
  mem.set('seed', String(seed));
  $<HTMLInputElement>('seed').value = String(seed);
  if (at > 0) jump(at);
  syncUrl();
}

function syncUrl(): void {
  const x = Math.round(sim.ents.x[sim.players[0].ent]);
  history.replaceState(null, '', `?seed=${seed}&at=${x}`);
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

/** The next crossroads the hero has yet to choose at, or undefined. */
function pendingFork(): Calm | undefined {
  const r = road();
  return r.layout.calm.find((c) => c.kind === 'fork' && c.stage === r.choices.length + 1);
}

const frame = createInputFrame();
function tick(): void {
  const r = road();
  const p = sim.players[0];
  const hx = sim.ents.x[p.ent], hy = sim.ents.y[p.ent];
  frame.buttons = 0; frame.moveY = 0;
  // road scenes: stop short of the figures until the conversation has played
  const sx = sceneX(sim);
  const atScene = sx >= 0 && !cast.done && !skipStop && hx > sx - STOP_BEFORE - 40 && hx < sx + 200;
  let waiting = atScene && hx >= sx - STOP_BEFORE && sim.phase === Phase.Playing;
  // camps (and the town's square): stand by the peddler for a while
  const calm = r.calm >= 0 ? r.layout.calm[r.calm] : undefined;
  if (r.calm !== lingerCalm) { lingerCalm = r.calm; lingerTicks = 0; }
  const linger = lingerFor();
  if (linger !== 0 && calm && inCamp(sim) && hx >= sim.shopX + STORE_X - 70 && lingerTicks !== Infinity) {
    if (linger < 0 || lingerTicks < linger) { waiting = true; lingerTicks++; }
  }
  if (linger !== 0 && r.town && hx >= 320 && lingerTicks !== Infinity) {
    if (linger < 0 || lingerTicks < linger) { waiting = true; lingerTicks++; }
  }
  // crossroads: steer onto the chosen road (the commit line counts who stands on which side), then back to the middle of the road
  const fork = pendingFork();
  const mid = WORLD_H * 0.55;
  let aim = mid;
  if (fork && hx > fork.from - 300) aim = sideFor(fork.stage!) === 0 ? WORLD_H * 0.22 : WORLD_H * 0.9;
  if (Math.abs(hy - aim) > 6) frame.moveY = (aim > hy ? 1 : -1) * 127;
  frame.moveX = held ? held * 127 : sim.phase !== Phase.Playing || waiting ? 0 : 127;
  step(sim, [frame, createInputFrame(), createInputFrame(), createInputFrame()]);
  clearField(sim);
  followRoad();
  fx.camX = sim.camX;
  fx.consume(sim.events);
  fx.update(1);
  barks.update(sim, 1);
  cast.update(sim);
}

/** A choice at a crossroads repaints the road ahead in the chosen biome; a new scene along the way gets its cast. */
function followRoad(): void {
  const r = road();
  if (r.choices.length !== paintedChoices) {
    paintedChoices = r.choices.length;
    paintScenery(r.biomes, r.layout);
    listPlaces();
  }
  if (sim.sceneIndex !== castScene) { castScene = sim.sceneIndex; cast.reset(sim); skipStop = false; }
}

/** Jumps the party (and the camera) to road position `x`; scenery, weather and the scene all follow from where the camera is. */
function jump(x: number): void {
  const r = road(), e = sim.ents, p = sim.players[0];
  x = Math.max(0, Math.min(r.layout.length - 1, x));
  const inTownSquare = x < TOWN_GATE_X;
  const cam = inTownSquare ? 0 : Math.max(0, x - VIEW_W / 2 + 24);
  if (!inTownSquare) {
    r.town = false;
    // the crossroads on the way there take the road the "crossroads" setting asks for
    for (let fork = pendingFork(); fork && x >= fork.commit!; fork = pendingFork()) commitFork(sim, fork, sideFor(fork.stage!));
  } else r.town = true;
  e.x[p.ent] = e.px[p.ent] = x;
  sim.camX = sim.prevCamX = sim.camMax = sim.trigCamX = cam;
  // plan everything up to here (the planner runs as the camera nears), then drop what the jump skipped past
  r.since = -1;
  roadUpkeep(sim, () => {});
  while (sim.nextClump < sim.plan.length && sim.plan[sim.nextClump].x < x) sim.nextClump++;
  clearField(sim);
  const at = roadPart(r.layout, cam + VIEW_W / 2);
  if (at.calm >= 0) lingerCalm = at.calm; // (jumping into a camp does not make the hero stand there again)
  const sx = sceneX(sim);
  if (sx >= 0 && x < sx - STOP_BEFORE - 40) cast.reset(sim); // back before the scene: it plays again
  followRoad();
  syncUrl();
}

$<HTMLInputElement>('scrub').oninput = () => { jump(Number($<HTMLInputElement>('scrub').value)); };
$<HTMLInputElement>('seed').onchange = () => { seed = Number($<HTMLInputElement>('seed').value) >>> 0 || 1; load(); };
$<HTMLSelectElement>('place').onchange = () => { jump(places[Number($<HTMLSelectElement>('place').value)].x); };
const go = (d: number): void => {
  const x = sim.ents.x[sim.players[0].ent];
  const target = d > 0 ? places.find((pl) => pl.x > x + 8) : [...places].reverse().find((pl) => pl.x < x - 8);
  if (target) jump(target.x);
};
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

/** What the info line says about where the hero is. */
function describe(x: number): string {
  const r = road();
  const calm = r.calm >= 0 ? r.layout.calm[r.calm] : undefined;
  const where = r.town ? 'town' : calm ? (calm.kind === 'camp' ? 'camp' : calm.kind === 'scene' ? `scene ${calm.scene}` : 'crossroads') : 'the road';
  const sx = sceneX(sim);
  const stop = sx >= 0 ? ` · scene at ${Math.round(sx)}${cast.done ? ' (done)' : cast.hearing() ? ' (talking)' : ''}` : '';
  return `${BIOMES[sim.biome].name} · ${where} · x ${Math.round(x)}/${r.layout.length}${stop}`;
}

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
    load(Number(params.get('at') ?? 0) || 0);
    const stats = new FrameStats();
    let last = performance.now(), acc = 0;
    const loop = (now: number): void => {
     try {
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
      const scrub = $<HTMLInputElement>('scrub');
      scrub.max = String(road().layout.length);
      if (document.activeElement !== scrub) scrub.value = String(Math.round(x));
      $('info').textContent = describe(x);
      const sel = $<HTMLSelectElement>('place');
      if (document.activeElement !== sel) { let k = 0; places.forEach((pl, i) => { if (pl.x <= x + 8) k = i; }); sel.value = String(k); }
      requestAnimationFrame(loop);
     } catch (err) { fail(String(err instanceof Error ? err.stack ?? err.message : err)); }
    };
    requestAnimationFrame(loop);
  } catch (err) { fail(String(err instanceof Error ? err.stack ?? err.message : err)); }
  const es = new EventSource('/art/events');
  es.onmessage = (ev) => { if (ev.data === 'reload') location.reload(); else if (ev.data.startsWith('error')) fail(JSON.parse(ev.data.slice(6))); };
})();
