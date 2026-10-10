import { InputManager } from './platform/input/input';
import { startLoop } from './platform/loop';
import { UPGRADES, UPGRADE_INDEX } from './data/upgrades';
import { Renderer } from './platform/gl/renderer';
import { buildSprites } from './render/art';
import { loadHeroImages } from './render/heroSheets';
import { loadMobImages } from './render/mobSheets';
import { loadNpcImages } from './render/npcSheets';
import { drawFrame, setSceneryRoute } from './render/draw';
import { Fx } from './render/fx';
import { Audio } from './platform/audio/audio';
import { dangerOf } from './platform/audio/music';
import { CLASSES, classForBotSlot } from './data/classes';
import { LEVEL_CAM_END, MAX_PLAYERS, STORE_CAM_END, STORE_X, TICK_RATE, WARE_REACH_X, WARE_REACH_Y, VIEW_H, VIEW_W, WORLD_W } from './sim/constants';
import { HEAT_MAX } from './data/heat';
import { createSim } from './sim/state';
import { step } from './sim/step';
import { applyCarry, arriveAt, captureCarry, restCarry, type Carry } from './sim/carry';
import { lerp } from './engine/math';
import { FrameStats } from './platform/perf';
import { botInput } from './sim/bot';
import { Pilot } from './ai/pilot';
import { resolveSkill } from './ai/skill';
import { Btn } from './sim/input';
import { Phase, activatePlayer } from './sim/state';
import { Kind } from './sim/entities';
import { spawnClump } from './sim/gen/level';
import { summarizeEnd } from './campaign/run';
import { levelPlan, LEVELS_PER_BIOME, ROUTE_LEVELS, weatherSpan, type LevelPlan } from './campaign/route';
import { setWeatherRoute } from './render/weather';
import { stockFor, WARES, wareSpot, wareStanding, type StockItem } from './data/wares';
import type { StoreView } from './render/camp';
import type { QuestView } from './render/quests';
import { offerNear, offersAfter, questSpot } from './campaign/questBoard';
import { makeQuest, type MissionKind, type QuestDef, type RewardKind } from './data/quests';
import { buy } from './sim/shop';
import { runEndScreen, selectScreen, type LobbySlot, type Screen } from './campaign/view';
import { drawScreen } from './render/menu';
import { titleToggles, titleToggleRects } from './render/titleArt';
import { Barks } from './render/barks';
import { RoadCast } from './render/roadCast';
import { roadSceneFor, roadSceneT, SCENE_BY_ID } from './data/story/road';
import type { SimBeat } from './sim/gen/level';

function fail(msg: string): never {
  const el = document.getElementById('err');
  if (el) { el.textContent = msg; el.style.display = 'grid'; }
  throw new Error(msg);
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
let heroImages: HTMLImageElement[];
let mobImages: HTMLImageElement[];
let npcImages: HTMLImageElement[];
try {
  heroImages = await loadHeroImages();
  mobImages = await loadMobImages();
  npcImages = await loadNpcImages();
} catch (err) {
  fail(String(err instanceof Error ? err.message : err));
}
const sprites = buildSprites(heroImages, mobImages, npcImages);
let renderer: Renderer;
try {
  renderer = new Renderer(canvas, sprites.atlas, VIEW_W, VIEW_H);
} catch (err) {
  fail(String(err instanceof Error ? err.message : err));
}

let titleKeyHandled = false;
// The title's two buttons can also be clicked or tapped.
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'title') return;
  const box = canvas.getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * VIEW_W, y = ((e.clientY - box.top) / box.height) * VIEW_H;
  const r = titleToggleRects();
  const hit = (t: { x: number; y: number; w: number; h: number }): boolean => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h;
  if (hit(r.sound)) audio.setSound(!audio.soundOn);
  else if (hit(r.music)) audio.setMusic(!audio.musicOn);
});
const input = new InputManager();
let fx = new Fx();
const audio = new Audio();
let lastPhase: number = Phase.Playing;
// Browsers start audio only from a user gesture; the first key or click anywhere unlocks it (N toggles sound, M music).
for (const type of ['keydown', 'pointerdown'] as const) window.addEventListener(type, (e) => {
  audio.unlock();
  const k = e as KeyboardEvent;
  if (type !== 'keydown' || k.repeat) return;
  if (k.code === 'KeyM') { audio.setMusic(!audio.musicOn); titleKeyHandled = true; } // N / M work anywhere; on the title they must not also start the game
  else if (k.code === 'KeyN') { audio.setSound(!audio.soundOn); titleKeyHandled = true; }
});

const params = new URLSearchParams(location.search);
// ?mute=1 silences sound and music for this page load without touching the remembered N / M settings (automated playtests use it).
if (params.has('mute') && params.get('mute') !== '0') audio.muted = true;
// ?biome=N forces a biome (scenery and enemies; see biomeIndex). Read before any sim is created.
if (__DEV__ && params.has('biome')) (globalThis as { __biome?: number }).__biome = Number(params.get('biome'));
// ?scenery=frozen previews scenery that has no enemy roster yet (see FROZEN_PASS); the enemies stay those of the seed's biome.
if (__DEV__ && params.has('scenery')) (globalThis as { __scenery?: string }).__scenery = params.get('scenery') ?? undefined;
// ?weather=rain,lightning:0.5 forces weather on any level (see weatherFor); ?weather=none turns it off.
if (__DEV__ && params.has('weather')) (globalThis as { __weather?: string }).__weather = params.get('weather') === 'none' ? '' : params.get('weather') ?? undefined;
let seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Date.now() & 0xffffffff) >>> 0;
// Dev aid: let the bot drive extra player slots so multiplayer can be watched without controllers.
//   ?bots=3  slots 2-4 are bot-controlled     ?auto=1  slot 1 is bot-controlled too
const botSlots: number[] = [];
if (__DEV__) {
  const n = Math.min(3, Number(params.get('bots') ?? 0) || 0);
  if (params.get('auto') === '1') botSlots.push(0);
  for (let k = 1; k <= n; k++) botSlots.push(k);
}
// Dev aid: ?skill=novice|casual|average|skilled|expert (or a number 0..1) drives the bot slots with a simulated player (src/ai) of that skill
// instead of the plain scripted bot, and ?bclass=mage,archer picks the bots' classes in slot order. The same pilots play the headless balance runs.
const pilotSkill = __DEV__ && params.has('skill') ? resolveSkill(params.get('skill')!) : undefined;
const botClasses = __DEV__ ? (params.get('bclass') ?? '').split(',').filter(Boolean).map((n) => CLASSES.findIndex((c) => c.name === n)) : [];
const pilots = new Map<number, Pilot>();
function pilotFor(k: number): Pilot {
  let p = pilots.get(k);
  if (!p) { p = new Pilot(k, pilotSkill!, cfg.seed); pilots.set(k, p); }
  return p;
}


// --- Campaign flow: title -> party select -> one straight road of levels, each followed by a store in the same field, then the next
// level, with no menus between and no cut on screen: the scenery and the party carry across. The sim only ever sees one level (or one store) at a time.
// ?seed=N is an entered seed: one level, no store, R restarts it.
const devRun = params.has('seed') || (__DEV__ && params.has('store'));

type Mode = 'title' | 'run' | 'summary' | 'select';
let mode: Mode = 'title';
let cfg: RunConfig = devConfig(seed);
let retreated = false;
let endTicks = 0;
let screen: Screen = { kind: 'title' };
let frameTick = 0;
const barks = new Barks();
const cast = new RoadCast();
if (__DEV__ && params.has('variant')) cast.forced = Number(params.get('variant')) || 0; // dev aid: ?variant=N plays a scene's N-th alternate (0 the first-time script)

/** What a run is told about itself: its seed, and the chapter the barks speak in. The chapter follows the biome the road is in. */
interface RunConfig {
  seed: number;
  chapter: number;
  reservedBeat?: SimBeat;
}
function devConfig(sd: number): RunConfig { return { seed: sd, chapter: 1 }; }

// A run is a route of levels, each followed by a store (docs/07). The sim only ever sees one of them.
interface Route {
  /** Index of the level being played (or the one the store follows), and how many the route has. */
  index: number;
  total: number;
  plan: LevelPlan;
  /** The store after the level, rather than the level itself. */
  store: boolean;
  /** What the party carries into the sim being played (none for the first level). */
  carry: Carry | undefined;
  /** The side quest the party took in the camp for the level being played (docs/15-quests.md). */
  quest?: QuestDef;
}
let route: Route = { index: 0, total: 1, plan: levelPlan(seed, 0, 1), store: false, carry: undefined };

// The peddler's goods lie on the ground: a shared purse, and any hero beside one buys it with the trade button. First there gets the last one.
let storePrevBtn: number[] = new Array(MAX_PLAYERS).fill(0);
let shopStock: StockItem[] = [];
let shopSold: boolean[] = [];
let shopNote: { ware: number; text: string } | undefined;
// The people in the camp with a favour to ask: the party takes one (or none) for the next level, with the same trade button.
let questList: QuestDef[] = [];
let questTaken = -1;
let questNote: { offer: number; text: string } | undefined;
let questNoteUntil = 0;
let shopNoteUntil = 0;
/** Off-ledger dev runs are one level unless ?levels=N asks for a route. */
function routeTotal(): number {
  if (!devRun) return ROUTE_LEVELS;
  return Math.max(1, Math.min(ROUTE_LEVELS, Number(params.get('levels') ?? (params.has('store') ? 2 : 1)) || 1));
}

// Character select: devices claim slots by pressing attack (the same claim a run uses), then pick a class and ready up.
let lobby: LobbySlot[] = [];
let lobbyPrevX: number[] = [];
let lobbyPrevBtn: number[] = [];
let lobbyPrevY: number[] = [];
/** The difficulty the party chose in the lobby (data/heat.ts): it holds for the whole run. */
let runHeat = Math.max(0, Math.min(HEAT_MAX, Math.floor(Number(params.get('heat'))) || 0));
/** Class picks carried from the lobby into the next sim (empty when the run skipped selection). */
let picks: LobbySlot[] = [];

function enterSelect(): void {
  lobby = Array.from({ length: MAX_PLAYERS }, () => ({ joined: false, ready: false, classId: 0 }));
  lobbyPrevX = new Array(MAX_PLAYERS).fill(0);
  lobbyPrevBtn = new Array(MAX_PLAYERS).fill(0);
  lobbyPrevY = new Array(MAX_PLAYERS).fill(0);
  // Drop stale presses, then let any held button re-claim its slot.
  input.reset(); input.sample(); input.reset();
  mode = 'select';
  screen = selectScreen(undefined, lobby, runHeat);
}

function selectUpdate(): void {
  if (input.restartRequested) { input.reset(); mode = 'title'; screen = { kind: 'title' }; return; } // backing out: to the title
  const frames = input.sample();
  for (let k = 0; k < MAX_PLAYERS; k++) {
    const f = frames[k], l = lobby[k];
    const x = f.moveX > 60 ? 1 : f.moveX < -60 ? -1 : 0;
    const dx = x !== lobbyPrevX[k] ? x : 0;
    const atk = f.buttons & ~Btn.Join & ~Btn.Interact & ~lobbyPrevBtn[k]; // any other button readies up
    const back = f.buttons & Btn.Interact & ~lobbyPrevBtn[k]; // B: unready, then leave, then out of the lobby
    lobbyPrevX[k] = x;
    lobbyPrevBtn[k] = f.buttons;
    const y = f.moveY > 60 ? 1 : f.moveY < -60 ? -1 : 0; // up raises the heat, down lowers it (any joined hero may)
    if (y !== lobbyPrevY[k] && y !== 0 && l.joined && !l.ready) runHeat = Math.max(0, Math.min(HEAT_MAX, runHeat - y));
    lobbyPrevY[k] = y;
    if (!l.joined) {
      if (f.buttons & Btn.Join || atk) l.joined = true;
      else if (back && !lobby.some((o) => o.joined)) { input.reset(); mode = 'title'; screen = { kind: 'title' }; return; }
      continue;
    }
    if (back) { if (l.ready) l.ready = false; else l.joined = false; continue; }
    if (!l.ready && dx !== 0) l.classId = (l.classId + dx + CLASSES.length) % CLASSES.length;
    if (atk) l.ready = !l.ready;
  }
  screen = selectScreen(undefined, lobby, runHeat);
  const joined = lobby.filter((l) => l.joined);
  if (joined.length && joined.every((l) => l.ready)) {
    picks = lobby.map((l) => ({ ...l }));
    startRun(devConfig((Date.now() & 0xffffffff) >>> 0), true);
  }
}

/** The road scene (if any) this level leaves a clearing for: by chapter and level of the biome, never on a boss level. Dev aid: ?scene=ID stages one anywhere. */
function roadSceneOf(plan: LevelPlan): { id: string; t: number } | undefined {
  const forced = __DEV__ ? params.get('scene') : null;
  const sc = forced && SCENE_BY_ID[forced] ? SCENE_BY_ID[forced] : roadSceneFor(plan.chapter, route.index % LEVELS_PER_BIOME, plan.boss);
  return sc ? { id: sc.id, t: roadSceneT(plan.seed) } : undefined;
}

/** `cam0`: where the new sim's camera starts. A field's camera normally starts at 0, but one carried on from the field before starts
 * as far behind that as the last camera stopped short of its far end, so the road (and every hash of the scenery) runs on without a jump. */
/** Dev aid: ?quest=escort|bounty|cull|rescue|flawless|swift puts that quest on every level, without going through the camp (&giver=0-4, &reward=purse|lesson|relic|fortune). */
function devQuest(plan: LevelPlan): QuestDef | undefined {
  if (!__DEV__ || !params.has('quest')) return undefined;
  return makeQuest(Number(params.get('giver') ?? 0) || 0, params.get('quest') as MissionKind, (params.get('reward') ?? 'purse') as RewardKind, { level: route.index, boss: plan.boss, biome: plan.biome });
}

function newSim(plan: LevelPlan, store = false, cam0 = 0): ReturnType<typeof createSim> {
  const nextBiome = store ? levelPlan(cfg.seed, Math.min(route.index + 1, route.total - 1), route.total).biome : undefined;
  const sd = plan.seed;
  setSceneryRoute(!store && route.index + 1 < route.total ? levelPlan(cfg.seed, route.index + 1, route.total).biome : -1, route.index);
  setWeatherRoute(weatherSpan(cfg.seed, route.index, route.total), weatherSpan(cfg.seed, Math.min(route.index + 1, route.total - 1), route.total));
  const s = createSim(sd, route.index === 0 && !store ? cfg.reservedBeat : undefined, {
    surrender: plan.chapter >= 2 || (__DEV__ && params.get('surrender') === '1'),
    offerSeed: cfg.seed,
    boss: plan.boss,
    scale: plan.scale,
    heat: runHeat,
    damage: plan.damage,
    mix: plan.mix,
    quest: store ? undefined : route.quest ?? devQuest(plan),
    store,
    nextBiome,
    onward: store || route.index + 1 < route.total,
    scene: store ? undefined : roadSceneOf(plan),
  });
  s.camX = s.prevCamX = s.trigCamX = cam0;
  if (route.carry) { applyCarry(s, route.carry); arriveAt(s, route.carry); }
  for (let k = 0; k < picks.length && !route.carry; k++) {
    if (!picks[k].joined) continue;
    s.players[k].classId = picks[k].classId;
    if (k === 0) s.ents.hp[s.players[0].ent] = s.ents.maxhp[s.players[0].ent] = CLASSES[picks[0].classId].hp;
    else activatePlayer(s, k, 60, 40 + k * 40);
  }
  // Dev aid: bot-controlled slots each take a different class (the warrior stays in slot 1; the seed picks which others), so a bot party shows several.
  if (!route.carry) botSlots.forEach((k, n) => { s.players[k].classId = botClasses[n] >= 0 && botClasses[n] !== undefined ? botClasses[n] : classForBotSlot(k, sd); });
  // Dev aid: ?boons=spark:2,lust gives every hero those boons (id[:rank]) and ?pending=N waits N level-ups, to see the HUD strip and the level-up panel in a run.
  if (__DEV__ && !route.carry) {
    for (const part of (params.get('boons') ?? '').split(',').filter(Boolean)) {
      const [id, r] = part.split(':');
      const idx = UPGRADE_INDEX[id];
      if (idx !== undefined) for (const p of s.players) p.ranks[idx] = Math.min(UPGRADES[idx].maxRank, Number(r ?? 1) || 1);
    }
    if (params.has('pending')) for (const p of s.players) { p.level = 1 + Number(params.get('pending')); p.pending = Number(params.get('pending')) || 0; }
  }
  // Dev aid: ?boss=1 starts at the boss arena so the boss can be tried without fighting the whole battlefield.
  if (__DEV__ && params.get('boss') === '1' && plan.boss && !store) {
    s.tick = 130;                            // past the opening delay, so encounters stream in
    s.nextClump = s.plan.length - 2;         // skip to the last wall and the boss
    s.camX = s.prevCamX = WORLD_W - 900;       // (the last screens of the field, whatever its length)
    const pe = s.players[0].ent;
    s.ents.x[pe] = s.ents.px[pe] = WORLD_W - 760;
    s.ents.y[pe] = s.ents.py[pe] = 100;
  }
  // Dev aid: ?goto=scene walks the party up to the level's road scene.
  if (__DEV__ && params.get('goto') === 'scene' && !store && s.sceneIndex >= 0) {
    const pe = s.players[0].ent, sx = s.plan[s.sceneIndex].x;
    s.camX = s.prevCamX = Math.max(0, sx - 320 - 120);
    s.ents.x[pe] = s.ents.px[pe] = sx - 140; s.ents.y[pe] = s.ents.py[pe] = 110;
  }
  // Dev aid: ?goto=chest|curse|charge|greed|mercy|elite walks the party up to the first such thing on the field (?gold=N fills the purse).
  if (__DEV__ && params.has('goto') && !store) {
    const want = params.get('goto');
    const e = s.ents;
    let at = -1;
    if (want === 'elite') { const k = s.plan.findIndex((c) => c.elite); if (k >= 0) { s.tick = 130; spawnClump(s, k, 1); s.nextClump = k + 1; for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && e.elite[i] === 1) at = i; } }
    else for (let i = 0; i < e.highWater && at < 0; i++) {
      if (want === 'chest' ? e.kind[i] === Kind.Chest : e.kind[i] === Kind.Shrine && e.sub[i] === ['curse', 'charge', 'greed', 'mercy'].indexOf(want ?? '')) at = i;
    }
    if (at >= 0 && at < e.highWater) {
      const pe = s.players[0].ent;
      s.camX = s.prevCamX = Math.max(0, e.x[at] - 260);
      e.x[pe] = e.px[pe] = e.x[at] - 60; e.y[pe] = e.py[pe] = e.y[at];
    }
  }
  // Dev aid: ?goto=end walks the party to a screen and a half before the end of the field (with ?calm=1, nothing is in the way): the biome turn and the store.
  if (__DEV__ && params.get('goto') === 'end' && !store) {
    const pe = s.players[0].ent;
    s.camX = s.prevCamX = WORLD_W - VIEW_W - 700;
    s.ents.x[pe] = s.ents.px[pe] = s.camX + 300; s.ents.y[pe] = s.ents.py[pe] = 100;
    s.nextClump = s.plan.length; s.gateIdx = s.gates.length;
  }
  if (__DEV__ && params.has('calm') && !store) { s.spawnTimer = s.flankTimer = 1e9; s.nextClump = s.plan.length; } // dev aid: ?calm=1 leaves the field empty so a chest or a panel can be looked at in peace
  if (__DEV__ && params.has('gold')) s.gold = Number(params.get('gold')) || 0;
  return s;
}
let sim = newSim(route.plan);

const stats = new FrameStats();
/** After a level is won the party keeps walking and the horde gets this long (at least, at most) to leave before the store takes over: the least lets the camera settle at the end of the field. */
const WIND_DOWN_MIN = 12;
const WIND_DOWN_MAX = 180;

function startRun(c: RunConfig, keepSlots = false): void {
  cfg = c;
  if (!keepSlots) picks = [];
  seed = c.seed;
  const total = routeTotal();
  const at = __DEV__ ? Math.max(0, Math.min(total - 1, Number(params.get('at') ?? 0) || 0)) : 0;
  const plan = levelPlan(c.seed, at, total);
  // the first level of a real run stages the cookfire camp (docs/12, R1): the story told in the field
  cfg = { ...c, chapter: plan.chapter, reservedBeat: at === 0 && !devRun ? { id: 'R1' } : c.reservedBeat };
  route = { index: at, total, plan, store: false, carry: undefined, };
  sim = newSim(plan);
  beginSim(keepSlots ? picks.map((p) => p.joined) : undefined);
  mode = 'run';
}

/** Common to every new sim of a run: fresh effects, barks and end state; the lobby's devices (if any) stay on their heroes. */
function beginSim(keep?: boolean[], shiftX?: number): void {
  if (shiftX !== undefined) fx.shift(shiftX); else fx = new Fx(); // crossing from one field to the next keeps what lies on the ground
  if (keep) input.reset(keep); else input.restartRequested = false; // slots stay claimed: the same devices keep the same heroes
  retreated = false;
  endTicks = 0;
  barks.reset();
  cast.reset(sim);
  storePrevBtn = input.sample().map((f) => f.buttons); // a button still held from the crossing is not a trade
}

/** Off-ledger dev restart (R): the next seed, as before the campaign existed. */
function restart(): void {
  startRun(devConfig((seed + 1) >>> 0));
}

function finishRun(): void {
  const sum = summarizeEnd(sim, retreated, route.index, route.total);
  screen = runEndScreen(sum, cfg.chapter);
  mode = 'summary';
  input.consumeMenu();
}

/** The level was won and the road goes on: the party walks into the store at the end of the same field. */
function enterStore(): void {
  const levelCam = sim.camX;
  route.carry = restCarry(captureCarry(sim)); // everyone is on their feet, at full health
  route.store = true;
  sim = newSim(route.plan, true, Math.min(0, levelCam - LEVEL_CAM_END));
  shopStock = stockFor(cfg.seed, route.index);
  shopSold = shopStock.map(() => false);
  questList = offersAfter(cfg.seed, route.index, route.total);
  questTaken = -1;
  questNote = undefined;
  route.quest = undefined;
  beginSim(undefined, sim.camX - levelCam); // the corpses and arrows on the ground stay where they lay, on screen
}

/** Out of the store and on to the next level, with the party as the store left it. */
function enterNextLevel(): void {
  const storeCam = sim.camX;
  route.carry = captureCarry(sim);
  route.quest = questTaken >= 0 ? questList[questTaken] : undefined; // the quest the party took plays on the level they are walking into
  route.index++;
  route.plan = levelPlan(cfg.seed, route.index, route.total);
  route.store = false;
  cfg = { ...cfg, chapter: route.plan.chapter };
  sim = newSim(route.plan, false, Math.min(0, storeCam - STORE_CAM_END));
  beginSim(undefined, sim.camX - storeCam);
}

/** Nothing of the horde is left on the field. */
function fieldEmpty(): boolean {
  const e = sim.ents;
  for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] === Kind.Mob) return false;
  return true;
}

/** The ware lying beside hero `k` (nearest first), or -1 if they are not standing by one. */
function nearWare(k: number): number {
  const p = sim.players[k];
  if (!p.active || p.downed) return -1;
  let best = -1, bestD = Infinity;
  shopStock.forEach((_, i) => {
    const sp = wareSpot(i, shopStock.length);
    const dx = Math.abs(sim.ents.x[p.ent] - sp.x), dy = Math.abs(sim.ents.y[p.ent] - sp.y);
    if (dx < WARE_REACH_X && dy < WARE_REACH_Y && dx < bestD) { best = i; bestD = dx; }
  });
  return best;
}

/** Hero `k` pressed the trade button beside ware `i`: they buy it if the purse covers it. */
function tryBuy(k: number, i: number): void {
  if (shopSold[i]) return;
  const ware = WARES[shopStock[i].ware];
  const res = buy(sim, k, ware, shopStock[i].price);
  if (res === 'ok') { shopSold[i] = true; shopNote = { ware: i, text: `P${k + 1} BOUGHT` }; }
  else shopNote = { ware: i, text: res === 'broke' ? 'NOT ENOUGH GOLD' : `P${k + 1} HAS THE MOST` };
  shopNoteUntil = frameTick + 120;
}

/** The quest-giver beside hero `k`, or -1. */
function nearQuest(k: number): number {
  const p = sim.players[k];
  if (!p.active || p.downed) return -1;
  return offerNear(questList, sim.ents.x[p.ent], sim.ents.y[p.ent]);
}

/** Hero `k` pressed the trade button beside giver `i`: the party takes their quest, or gives it back if it was already the one taken. */
function tryQuest(k: number, i: number): void {
  questTaken = questTaken === i ? -1 : i;
  questNote = { offer: i, text: questTaken === i ? `P${k + 1} ACCEPTED` : 'GIVEN BACK' };
  questNoteUntil = frameTick + 120;
}

/** The people with a favour to ask, as the renderer shows them. */
function questView(): QuestView {
  return {
    offers: questList.map((def, i) => ({ ...questSpot(i), def })),
    near: sim.players.map((_, k) => nearQuest(k)),
    taken: questTaken,
    note: questNote,
  };
}

/** The goods on the ground as the renderer shows them. */
function storeView(): StoreView {
  return {
    wares: shopStock.map((it, i) => {
      const def = WARES[it.ware];
      return {
        ...wareSpot(i, shopStock.length), icon: def.icon, name: def.name, blurb: def.blurb, price: it.price, sold: shopSold[i], afford: sim.gold >= it.price,
        standing: sim.players.map((p) => wareStanding(def, p)),
      };
    }),
    near: sim.players.map((_, k) => nearWare(k)),
    note: shopNote,
  };
}

function menuUpdate(): void {
  const { ok, any, sound, music } = input.consumeMenu();
  if (sound) audio.setSound(!audio.soundOn);
  if (music) audio.setMusic(!audio.musicOn);
  if (any) audio.unlock(); // a pad press is not a user gesture to the browser, but costs nothing to try
  if (mode === 'summary' && ok) enterSelect();
  else if (mode === 'title' && any && !titleKeyHandled) enterSelect();
  titleKeyHandled = false;
}

if (devRun) {
  const c = devConfig(seed);
  // Dev aid: ?beat=R1 stages a story beat in an entered-seed run, to look at it without playing the campaign up to it.
  if (__DEV__ && params.has('beat')) c.reservedBeat = { id: params.get('beat')! };
  startRun(c);
  // Dev aid: ?store=1 goes straight to the store after a won level, to work on it without playing the level.
  //   &players=N (1-4)  &gold=N  &pending=N (level-ups waiting per hero)  &level=N (their level)  &kills=N  &at=N (the route level, 0-based)
  if (__DEV__ && params.has('store')) {
    const want = Math.max(1, Math.min(MAX_PLAYERS, Number(params.get('players') ?? 1) || 1));
    for (let k = 1; k < want; k++) if (!sim.players[k].active) { sim.players[k].classId = k % CLASSES.length; activatePlayer(sim, k, 80, 40 + k * 40); }
    sim.players[0].classId = Math.min(CLASSES.length - 1, Number(params.get('class') ?? 0) || 0);
    for (const p of sim.players) {
      if (!p.active) continue;
      p.level = Math.max(1, Number(params.get('level') ?? 1) || 1);
      p.pending = Math.max(0, Number(params.get('pending') ?? 0) || 0);
    }
    sim.gold = Math.max(0, Number(params.get('gold') ?? 200) || 0);
    sim.kills = Math.max(0, Number(params.get('kills') ?? 320) || 0);
    enterStore();
  }
} else { mode = 'title'; screen = { kind: 'title' }; }

/** Panels that were open before this tick's step, so the button that chose a card is not also a trade. */
const panelBefore: boolean[] = new Array(MAX_PLAYERS).fill(false);

startLoop({
  tickRate: TICK_RATE,
  timeScale: () => (__DEV__ ? ((window as unknown as { __ts?: number }).__ts ?? 1) : 1),
  update() {
    frameTick++;
    if (mode === 'select') { selectUpdate(); return; }
    if (mode !== 'run') { menuUpdate(); return; }
    if (input.restartRequested) {
      if (devRun) { restart(); return; }
      retreated = true; // abandoning the road is a retreat
      finishRun();
      return;
    }
    const frames = input.sample();
    for (const k of botSlots) {
      if (pilotSkill) pilotFor(k).drive(sim, frames[k], route.store ? { stock: shopStock, sold: shopSold, allDone: [...pilots.values()].every((q) => q.storeDone && sim.players[q.slot].pending === 0) } : undefined);
      else botInput(sim, k, frames[k]);
      if (k > 0 && sim.tick === 3) frames[k].buttons |= Btn.Join;
    }
    sim.players.forEach((p, k) => { panelBefore[k] = p.panel; });
    step(sim, frames);
    // The goods on the ground: the trade button, pressed beside one, buys it.
    if (route.store && sim.phase === Phase.Playing) {
      for (let k = 0; k < MAX_PLAYERS; k++) {
        const edge = frames[k].buttons & ~storePrevBtn[k];
        storePrevBtn[k] = frames[k].buttons;
        if (!(edge & Btn.Interact) || panelBefore[k]) continue;
        const q = nearQuest(k);
        if (q >= 0) { tryQuest(k, q); continue; }
        const i = nearWare(k);
        if (i >= 0) tryBuy(k, i);
      }
      if (frameTick > shopNoteUntil) shopNote = undefined;
      if (frameTick > questNoteUntil) questNote = undefined;
    }
    if (sim.phase === Phase.Playing) return;
    if (devRun && route.total === 1) return; // an entered seed: the banner stays until R
    if (sim.phase === Phase.Won && route.store) { enterNextLevel(); return; } // the lead hero walked out of the store: on into the next level, no one has moved on screen
    if (sim.phase === Phase.Won && route.index < route.total - 1) {
      // the level is won: what is left of the horde walks off the way it came on, then the field carries on into the store
      if (++endTicks >= WIND_DOWN_MIN && (fieldEmpty() || endTicks >= WIND_DOWN_MAX)) enterStore();
      return;
    }
    // The end of the road, or the party is down: the banner shows for a few seconds (or until the party has had a look), then the summary.
    if (endTicks === 0) input.consumeMenu();
    const ok = input.consumeMenu().ok;
    if (++endTicks >= 300 || (endTicks >= 60 && ok)) finishRun();
  },
  onSkippedTicks(n) {
    stats.noteSkippedTicks(n, performance.now());
  },
  render(alpha, dt, rawDt) {
    stats.record(rawDt * 1000);
    // Music: quiet away from the fighting; the sim's biome (or the one beyond the store) sets the key.
    if (mode === 'run' && sim.phase !== lastPhase) {
      if (sim.phase === Phase.Lost) audio.stinger('lose');
      else if (sim.phase === Phase.Won && !route.store && route.index === route.total - 1) audio.stinger('win'); // earlier levels lead on to the store, which has its own calm
    }
    lastPhase = sim.phase;
    const fighting = mode === 'run' && !route.store && sim.phase === Phase.Playing;
    const danger = fighting ? dangerOf(sim, sim.camX) : { danger: 0, boss: false };
    // The music turns to the next biome's key at the peddler, halfway through the store's turn of the scenery, and not when the next level
    // begins, so nothing (seen or heard) changes at the cut between one field and the next.
    const musicBiome = route.store && sim.nextBiome >= 0 && sim.camX + VIEW_W / 2 >= STORE_X ? sim.nextBiome : sim.biome;
    audio.updateMusic(rawDt, { biome: mode === 'run' ? musicBiome : 0, ...danger });
    if (mode !== 'run') {
      renderer.begin();
      titleToggles.sound = audio.soundOn; titleToggles.music = audio.musicOn;
      drawScreen(renderer.batcher, sprites, screen, frameTick + alpha);
      renderer.end();
      return;
    }
    input.consumeHaptics(sim.events);
    audio.consume(sim.events, sim.camX);
    fx.camX = sim.camX;
    fx.consume(sim.events);
    fx.update(dt * 60);
    barks.update(sim, cfg.chapter);
    cast.update(sim);
    const cam = lerp(sim.prevCamX, sim.camX, alpha);
    const routed = !devRun || route.total > 1;
    const lastLevel = !route.store && route.index === route.total - 1;
    renderer.begin();
    drawFrame(renderer.batcher, sprites, sim, fx, cam, alpha, {
      stats,
      simLag: stats.simLagging(performance.now()),
      drawCalls: renderer.batcher.lastDrawCalls,
      sprites: renderer.batcher.lastSprites,
      cast,
      endPrompt: routed ? 'ATTACK TO CONTINUE' : undefined,
      // a level won on the road is not a stopping point: the banner is only for the end of the road and for a party that is down
      hideEndBanner: routed && sim.phase === Phase.Won && !lastLevel,
      levelKeys: sim.players.map((_, k) => input.levelHint(k)),
      storeHints: route.store ? sim.players.map((_, k) => (nearWare(k) >= 0 || nearQuest(k) >= 0 ? input.interactHint(k) : '')) : undefined,
      questView: route.store ? questView() : undefined,
      storeView: route.store ? storeView() : undefined,
      routeLabel: route.total > 1 ? (route.store ? `STORE  LEVEL ${route.index + 1} OF ${route.total}` : `LEVEL ${route.index + 1} OF ${route.total}`) : undefined,
    });
    cast.drawBubbles(renderer.batcher, sprites, sim, cam, alpha);
    if (!cast.hearing()) barks.draw(renderer.batcher, sprites, sim, cam, alpha);
    renderer.end();
  },
});

if (__DEV__) {
  new EventSource('/esbuild').addEventListener('change', () => location.reload());
  const w = window as unknown as { sim: () => typeof sim; cast: () => typeof cast; sprites: typeof sprites; fx: typeof fx };
  w.sim = () => sim;
  w.cast = () => cast;
  w.sprites = sprites;
  w.fx = fx;
  (w as unknown as { stats: typeof stats }).stats = stats;
}
