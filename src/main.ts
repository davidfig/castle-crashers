import { InputManager } from './platform/input/input';
import { startLoop } from './platform/loop';
import { UPGRADES, UPGRADE_INDEX } from './data/upgrades';
import { Renderer } from './platform/gl/renderer';
import { buildSprites } from './render/art';
import { activeBestiary, bestiaryEpoch, ensureBestiary, generateBestiary, installBestiary } from './data/bestiary';
import { installMonsterArt } from './render/monsterSprites';
import { installFolkArt } from './render/folkSprites';
import { generateFolk, installFolk } from './data/humans';
import { installHeroArt } from './render/heroSprites';
import { generateParty } from './data/heroes';
import { drawFrame } from './render/draw';
import { generateWorld } from './data/scenery/world';
import { BIOMES } from './data/biomes';
import { ROAD_STRIDE } from './render/scenery';
import { setLevelsPlayed, setRoadShift, setWorld } from './render/sceneryWorld';
import { installSceneryArt } from './render/sceneryArt';
import { Fx } from './render/fx';
import { Audio } from './platform/audio/audio';
import { dangerOf } from './platform/audio/music';
import { CLASSES, classForBotSlot } from './data/classes';
import { MAX_PLAYERS, TICK_RATE, VIEW_H, VIEW_W } from './sim/constants';
import { HEAT_MAX } from './data/heat';
import { createSim } from './sim/state';
import { step } from './sim/step';
import { lerp } from './engine/math';
import { FrameStats } from './platform/perf';
import { botInput } from './sim/bot';
import { Pilot } from './ai/pilot';
import { resolveSkill } from './ai/skill';
import { Btn } from './sim/input';
import { Phase, joinParty, leaveParty, resetHero } from './sim/state';
import { Kind, allocEntity } from './sim/entities';
import { demoSpecial, demoStandoff, parseDemo } from './data/skillDemo';
import { MOBS, MobType } from './data/mobs';
import { campShown, layoutRoad, roadBiomes, roadJump, roadMusicBiome, stageBounds, type RoadLayout } from './sim/gen/road';
import { clearRunSave, describeRunSave, loadRunSave, makeRunSave, RUN_SAVE_BACKUP, RUN_SAVE_KEY, writeRunSave, type RunSave } from './campaign/runSave';
import { openIdbStore } from './campaign/idbStore';
import { loadProfile, metaRanks, saveProfile, treeSaves, withRun, type Profile } from './campaign/profile';
import { treesToProfile } from './data/trees';
import { renownFor } from './data/meta';
import { restore } from './sim/snapshot';
import { drawResumeHold, type ResumeView } from './render/resumeHud';
import { summarizeEnd } from './campaign/run';
import { createTutorial, markTutorialSeen, tutorialSeen, tutorialView, updateTutorial, type Tutorial } from './campaign/tutorial';
import { drawTutorial } from './render/tutorialHud';
import { levelPlan, LEVELS_PER_BIOME, ROUTE_LEVELS, type LevelPlan } from './campaign/route';
import { WARES, wareSpot, wareStanding } from './data/wares';
import type { StoreView } from './render/camp';
import type { QuestView } from './render/quests';
import { questSpot } from './data/quests';
import { nearGift, nearOffer, nearWare, TradeEv } from './sim/shop';
import { giftSpot } from './data/gifts';
import { Ev, EV_STRIDE } from './sim/events';
import { runEndScreen, type Screen } from './campaign/view';
import { drawScreen } from './render/menu';
import { titleToggles, titleToggleRects } from './render/titleArt';
import { rerollTitle } from './render/titleLayout';
import { Barks } from './render/barks';
import { RoadCast } from './render/roadCast';
import type { SimBeat } from './sim/gen/level';

function fail(msg: string): never {
  const el = document.getElementById('err');
  if (el) { el.textContent = msg; el.style.display = 'grid'; }
  throw new Error(msg);
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const sprites = buildSprites();
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
// ?weather=rain,lightning:0.5 forces weather on any level (see weatherFor); ?weather=none turns it off.
if (__DEV__ && params.has('weather')) (globalThis as { __weather?: string }).__weather = params.get('weather') === 'none' ? '' : params.get('weather') ?? undefined;
let seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Date.now() & 0xffffffff) >>> 0;

// Every run fights its own randomly built monsters (data/bestiary): the same ones for the whole run, different next run. ?mobs=classic
// brings back the hand-made roster. The cast is installed before any sim of the run is created, and its pictures drawn into the atlas.
// Dev aid: ?demo=<kind>:<element>[:key=val...] stages one caster casting one skill over and over at the hero (see data/skillDemo.ts); it needs the hand-made roster.
const demo = __DEV__ && params.has('demo') ? parseDemo(params.get('demo')!) : null;
if (__DEV__ && params.has('demo') && !demo) console.warn('?demo=kind:element[:key=val...]: unknown kind or element in', params.get('demo'));
const classicMobs = __DEV__ && (params.get('mobs') === 'classic' || demo !== null);
let castEpoch = -1;
let classicArtSeed = -1;
function applyCast(runSeed: number): void {
  if (classicMobs) {
    // The hand-made stats keep no pictures of their own: they wear the look the run's generated cast gives each slot.
    if (activeBestiary() !== null) installBestiary(null);
    if (classicArtSeed !== runSeed) { classicArtSeed = runSeed; installMonsterArt(sprites, renderer, generateBestiary(runSeed)); }
    return;
  }
  ensureBestiary(runSeed);
  if (castEpoch === bestiaryEpoch()) return;
  castEpoch = bestiaryEpoch();
  installMonsterArt(sprites, renderer, activeBestiary()!);
}
applyCast(seed);

// A run's people (the Registrar, King, Herald, Captain, Elder and peddler) are generated from the seed too (data/humans): the same faces and
// clothes all run, new ones next run.
let folkSeed = -1;
function applyFolk(runSeed: number): void {
  if (folkSeed === runSeed) return;
  folkSeed = runSeed;
  const folk = generateFolk(runSeed);
  installFolk(folk);
  installFolkArt(sprites, renderer, folk);
}
applyFolk(seed);

// A run's heroes are generated from the seed as well (data/heroes): four people, one per player slot, each drawn in every class with that class's own
// defining headgear, weapon and gear. Same people all run, new ones next run.
let partySeed = -1;
function applyParty(runSeed: number): void {
  if (partySeed === runSeed) return;
  partySeed = runSeed;
  installHeroArt(sprites, renderer, generateParty(runSeed));
}
applyParty(seed);

// A run's scenery is generated from its seed (data/scenery/world.ts): one biome per stage of the road, each its archetype varied, and the road
// turning each into the next. Drawn into the atlas before any level of the run is shown. Dev aid: ?scenery=frozen makes the whole road that
// archetype (the enemies stay those of the seed's biomes); ?biome=N already forces both; ?world=N changes the scenery's seed alone.
if (__DEV__ && params.has('roadx')) setRoadShift(Number(params.get('roadx')) || 0); // ?roadx=N draws the scenery N px further along the road
let sceneryKey = '';
/** The scenery of a road (`?road=1`): its regions' biomes (the crossroads' upper roads until chosen) and where each region begins. */
function roadScenery(runSeed: number, total: number): { biomes: number[]; layout: RoadLayout } {
  const biomes = roadBiomes(runSeed, total, []);
  return { biomes, layout: layoutRoad(runSeed, total, biomes) };
}
/** Paints the run's scenery: the road's regions in their biomes (a crossroads' upper road until chosen), each turning into the next past its crossroads. */
function applyScenery(runSeed: number, total: number, road: { biomes: number[]; layout: RoadLayout } | undefined = roadScenery(runSeed, total)): void {
  const stages = Math.max(1, Math.ceil(total / LEVELS_PER_BIOME));
  const want = __DEV__ ? (params.get('scenery') ?? '').toLowerCase() : '';
  const forced = want ? BIOMES.findIndex((b) => b.name.toLowerCase().includes(want)) : -1;
  const worldSeed = __DEV__ && params.has('world') ? Number(params.get('world')) >>> 0 : runSeed;
  const archetypes = Array.from({ length: stages }, (_, k) => (forced >= 0 ? forced : road ? road.biomes[k] : levelPlan(runSeed, k * LEVELS_PER_BIOME, total).biome));
  // on the one road (?road=1) each biome's stretch is as long as its levels and the calm places between them grew it (sim/gen/road.ts)
  const bounds = road ? stageBounds(road.layout) : undefined;
  const key = `${worldSeed}:${archetypes.join(',')}:${bounds?.join(',') ?? ''}`;
  if (key === sceneryKey) return;
  sceneryKey = key;
  const stageLen = bounds ? Math.min(...bounds.slice(1).map((b, k) => b - bounds[k])) : LEVELS_PER_BIOME * ROAD_STRIDE;
  const world = generateWorld(worldSeed, archetypes, stageLen, bounds, !!road); // on a road each turn waits for its crossroads
  installSceneryArt(sprites, renderer, world);
  setWorld(world);
}
applyScenery(seed, ROUTE_LEVELS);
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


// --- A run (docs/21-the-road.md): title -> the starting town -> one road of levels, road scenes, camps and crossroads -> the last boss, in
// one sim, saved as it goes. ?seed=N is an entered seed (one level unless ?levels=N), and R restarts it.
const devRun = params.has('seed') || (__DEV__ && demo !== null);

const runStore = browserStore();
// The run in progress lives in IndexedDB (campaign/idbStore.ts), read into memory here so saving stays synchronous; a save left in localStorage by an older build moves across.
const runSaveStore = await openIdbStore(typeof indexedDB === 'undefined' ? undefined : indexedDB, [RUN_SAVE_KEY, RUN_SAVE_BACKUP], runStore);
// What carries over between runs: renown and the town's lasting upgrades (campaign/profile.ts). Written whenever the town spends renown, and at the end of a run.
const profileLoad = loadProfile(runStore);
let profile: Profile = profileLoad.profile;
function keepProfile(next: Profile): void { profile = next; if (profileLoad.writable) saveProfile(runStore, profile); }
type Mode = 'title' | 'run' | 'summary';
let mode: Mode = 'title';
let cfg: RunConfig = devConfig(seed);
let retreated = false;
let endTicks = 0;
let screen: Screen = { kind: 'title' };
let frameTick = 0;
const barks = new Barks();
const cast = new RoadCast();
if (__DEV__ && params.has('variant')) cast.forced = Number(params.get('variant')) || 0; // dev aid: ?variant=N plays a scene's N-th alternate (0 the first-time script, -N the N-th generated conversation)

/** What a run is told about itself: its seed, and the chapter the barks speak in. The chapter follows the biome the road is in. */
interface RunConfig {
  seed: number;
  chapter: number;
  reservedBeat?: SimBeat;
}
function devConfig(sd: number): RunConfig { return { seed: sd, chapter: 1 }; }

/** Where the party is on the road, for the HUD, the music and the summary (followed from the sim each tick, `followRoad`). */
interface Route {
  /** The level the party is in (or the camp after it), and how many the road has. */
  index: number;
  total: number;
  plan: LevelPlan;
  /** In a camp. */
  store: boolean;
}
let route: Route = { index: 0, total: 1, plan: levelPlan(seed, 0, 1), store: false };

// The peddler's goods lie on the ground: a shared purse, and any hero beside one buys it with the trade button. First there gets the last one.
// The people in the camp with a favour to ask: the party takes one (or none) for the next level, with the same trade button.
// Both live in the sim (sim/shop.ts); what is kept here is only the word shown over a ware or a giver for a moment after a press.
let shopNote: { ware: number; text: string } | undefined;
let giftNote: { gift: number; text: string } | undefined;
let questNote: { offer: number; text: string } | undefined;
let questNoteUntil = 0;
let shopNoteUntil = 0;
/** Entered-seed runs are one level unless ?levels=N asks for more. */
function routeTotal(): number {
  if (!devRun) return ROUTE_LEVELS;
  return Math.max(1, Math.min(ROUTE_LEVELS, Number(params.get('levels') ?? 1) || 1));
}

/** The road's heat (data/heat.ts) a run sets out with (the town's shrine changes it; ?heat=N in dev). */
let runHeat = Math.max(0, Math.min(HEAT_MAX, Math.floor(Number(params.get('heat'))) || 0));

/** The run's sim: its one road (or, for `?demo=`, a field of its own), with the dev aids asked for in the URL. */
function newSim(): ReturnType<typeof createSim> {
  setLevelsPlayed(0);
  const s = demo
    ? createSim(cfg.seed, undefined, { heat: runHeat, offerSeed: cfg.seed })
    : createSim(cfg.seed, undefined, { road: { total: route.total, renown: profile.renown, meta: metaRanks(profile), trees: treeSaves(profile), beat: cfg.reservedBeat }, heat: runHeat, offerSeed: cfg.seed });
  // Dev aid: ?class=shaman (or an index) plays slot 0 as that class.
  if (__DEV__ && params.has('class')) {
    const want = params.get('class')!;
    const k = CLASSES.findIndex((c) => c.name === want);
    resetHero(s, 0, k >= 0 ? k : Math.min(CLASSES.length - 1, Number(want) || 0));
  }
  // Dev aid: bot-controlled slots each take a different class (the warrior stays in slot 1; the seed picks which others), so a bot party shows several.
  botSlots.forEach((k, n) => {
    const c = botClasses[n] >= 0 && botClasses[n] !== undefined ? botClasses[n] : classForBotSlot(k, cfg.seed);
    if (k === 0) resetHero(s, 0, c); else s.players[k].classId = c;
  });
  // Dev aid: ?boons=spark:2,lust gives every hero those boons (id[:rank]) and ?pending=N waits N level-ups, to see the HUD strip and the level-up panel in a run.
  if (__DEV__) {
    for (const part of (params.get('boons') ?? '').split(',').filter(Boolean)) {
      const [id, r] = part.split(':');
      const idx = UPGRADE_INDEX[id];
      if (idx !== undefined) for (const p of s.players) p.ranks[idx] = Math.min(UPGRADES[idx].maxRank, Number(r ?? 1) || 1);
    }
    if (params.has('pending')) for (const p of s.players) { p.level = 1 + Number(params.get('pending')); p.pending = Number(params.get('pending')) || 0; }
  }
  if (demo) setUpDemo(s);
  if (__DEV__ && params.has('gold')) s.gold = Number(params.get('gold')) || 0;
  // Dev aid: ?renown=N sets the renown to spend in the town (to try the class trees).
  if (__DEV__ && params.has('renown') && s.road) s.road.renown = Number(params.get('renown')) || 0;
  return s;
}
/** Dev aid: ?calm=1 keeps the road empty (no encounters, no packs), so a camp, a crossroads or a panel can be looked at in peace. */
const calmRoad = __DEV__ && params.has('calm');
/** ?demo=: an empty field, the hero standing still and a tireless caster of the skill a little way off (it holds the skill's usual distance and casts it every cooldown). */
function setUpDemo(s: ReturnType<typeof createSim>): void {
  if (!demo) return;
  s.spawnTimer = s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const e = s.ents, pe = s.players[0].ent, stand = demoStandoff(demo.kind);
  s.camX = s.prevCamX = 0;
  e.x[pe] = e.px[pe] = 150; e.y[pe] = e.py[pe] = 100;
  const sp = demoSpecial(demo.kind, demo.element, demo.overrides);
  MOBS[MobType.Slinger] = { ...MOBS[MobType.Slinger], hp: 30000, special: sp, reach: stand, speed: 0.3, knockResist: 1, onHit: undefined };
  const m = allocEntity(e, Kind.Mob, MobType.Slinger, 150 + stand, 100, 30000);
  if (m >= 0) { e.flags[m] = 1; e.face[m] = -1; }
}
/** ?demo=: the hero is never beaten, so the skill can be watched for as long as it takes. */
function refillDemoHero(): void {
  const e = sim.ents, p = sim.players[0];
  if (p.active) e.hp[p.ent] = e.maxhp[p.ent];
}
let sim = newSim();

const stats = new FrameStats();

/** The first-time controls tutorial, while it is playing (campaign/tutorial.ts). */
let tutorial: Tutorial | null = null;
function browserStore(): Storage | undefined { try { return localStorage; } catch { return undefined; } }

// ---- The run in progress is saved as it goes (docs/21-the-road.md, step 4): on the one road only, every few seconds, on reaching a calm
// place, when the page closes and on Save and quit (Escape, or a pad's Back). Continue (C / Y on the title) rebuilds everything from the seed,
// restores the sim and holds the field frozen until the players have taken up their heroes.
let savedRun: RunSave | undefined = (() => { const r = loadRunSave(runSaveStore); return r.status === 'ok' ? r.save : undefined; })();
/** Ticks between autosaves (10 s of play). */
const AUTOSAVE_TICKS = 600;
let lastSaveTick = -Infinity;
let lastCalm = -2;
let savedChoices = 0;
function titleScreen(): Screen { rerollTitle(); return { kind: 'title', cont: savedRun ? describeRunSave(savedRun) : undefined }; }
/** Saves the run being played, if it can be continued later (a run on the one road, still going). */
function saveRun(): void {
  if (mode !== 'run' || !sim.road || sim.phase !== Phase.Playing || demo) return;
  const save = makeRunSave(sim, { seed: cfg.seed, total: route.total, heat: runHeat }, Date.now(), sim.road.choices);
  if (writeRunSave(runSaveStore, save)) savedRun = save;
  lastSaveTick = sim.tick;
}
window.addEventListener('pagehide', saveRun);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveRun(); });

/** The hold over a continued run: which slots a player has taken (their last buttons, so a press is an edge), until one presses attack. */
let resume: { taken: boolean[]; prev: number[] } | null = null;

/** Continue the saved run: everything generated is rebuilt from its seed, the sim is restored, and the field holds until the players are back. */
function continueRun(): void {
  const save = savedRun!;
  let restored: ReturnType<typeof restore>;
  try { restored = restore(save.sim); } catch (err) {
    console.warn('The saved run could not be restored:', err);
    savedRun = undefined;
    screen = titleScreen();
    return;
  }
  applyCast(save.config.seed);
  applyFolk(save.config.seed);
  applyParty(save.config.seed);
  seed = save.config.seed;
  runHeat = save.config.heat;
  const total = save.config.total;
  applyScenery(seed, total, restored.road ?? undefined);
  paintedChoices = restored.road?.choices.length ?? 0;
  const plan = levelPlan(seed, save.level, total);
  cfg = { seed, chapter: plan.chapter };
  route = { index: save.level, total, plan, store: false };
  sim = restored;
  roadScene = -1;
  beginSim();
  input.reset();
  if (sim.road) followRoad();
  lastSaveTick = sim.tick;
  lastCalm = sim.road?.calm ?? -2;
  savedChoices = sim.road?.choices.length ?? 0;
  resume = { taken: [false, false, false, false], prev: [0, 0, 0, 0] };
  mode = 'run';
}

/** The hold: a press takes a slot; attack from someone who has one starts. Saved heroes nobody took leave; newcomers join beside the party. */
function resumeUpdate(): void {
  const r = resume!;
  const frames = input.sample();
  let start = false;
  for (let k = 0; k < MAX_PLAYERS; k++) {
    if (!input.isClaimed(k)) continue;
    const b = frames[k].buttons;
    if (!r.taken[k]) { r.taken[k] = true; r.prev[k] = b; continue; } // the press that took the slot does not also start
    if (b & ~r.prev[k] & (Btn.Attack | Btn.Confirm)) start = true;
    r.prev[k] = b;
  }
  if (!start) return;
  for (let k = 0; k < MAX_PLAYERS; k++) {
    if (!r.taken[k]) { if (sim.players[k].active) leaveParty(sim, k); continue; }
    if (!sim.players[k].active) { sim.players[k].classId = k % CLASSES.length; joinParty(sim, k, sim.camX + 120, 40 + k * 40); }
  }
  sim.players.forEach((p, k) => { p.rawPrev = frames[k].buttons; p.prevButtons = frames[k].buttons; }); // the press that started is not a swing or a trade
  resume = null;
  saveRun(); // the party as it now is
}

function resumeView(): ResumeView {
  const r = resume!;
  return {
    where: `LEVEL ${route.index + 1} OF ${route.total}`,
    slots: sim.players.map((p, k) => ({ hero: p.active ? `${CLASSES[p.classId].name.toUpperCase()} ${p.level}` : '', taken: r.taken[k] })),
    canStart: r.taken.some(Boolean),
  };
}

/** Save and quit: back to the title, the run kept to continue. */
function saveAndQuit(): void {
  saveRun();
  resume = null;
  tutorial = null;
  input.reset();
  mode = 'title';
  screen = titleScreen();
}
function endTutorial(): void {
  sim.tutorialHold = false;
  markTutorialSeen(browserStore());
  tutorial = null;
}

function startRun(c: RunConfig): void {
  applyCast(c.seed);
  applyFolk(c.seed);
  applyParty(c.seed);
  seed = c.seed;
  const total = routeTotal();
  const at = __DEV__ ? Math.max(0, Math.min(total - 1, Number(params.get('at') ?? 0) || 0)) : 0;
  const plan = levelPlan(c.seed, at, total);
  // the first level of a real run stages the cookfire camp (docs/12, R1): the story told in the field
  cfg = { ...c, chapter: plan.chapter, reservedBeat: at === 0 && !devRun ? { id: 'R1' } : c.reservedBeat };
  route = { index: at, total, plan, store: false };
  tutorialAfterTown = false;
  sim = newSim();
  if (sim.road) applyScenery(c.seed, total, sim.road);
  paintedChoices = 0;
  if (sim.road && at > 0) roadJump(sim, at);
  resume = null;
  lastSaveTick = -Infinity;
  lastCalm = -2;
  savedChoices = 0;
  beginSim();
  // A new player's first field opens with the controls tutorial (once the party has left the town). Dev: ?tutorial=1 plays it on any run, ?tutorial=0 never.
  const wantTutorial = __DEV__ && params.has('tutorial') ? params.get('tutorial') !== '0' : !devRun && !tutorialSeen(browserStore());
  if (wantTutorial && at === 0) {
    if (sim.road?.town) tutorialAfterTown = true;
    else { tutorial = createTutorial(); sim.tutorialHold = true; }
  }
  mode = 'run';
}

/** Common to every run's start (new or continued): fresh effects, barks and end state. */
function beginSim(): void {
  tutorial = null;
  fx = new Fx();
  input.restartRequested = false; input.quitRequested = false;
  retreated = false;
  endTicks = 0;
  barks.reset();
  cast.reset(sim);
  input.sample().forEach((f, k) => { sim.players[k].rawPrev = f.buttons; }); // a button still held from the title is not a trade
}

/** A new run: it opens in the starting town, where the party is chosen by walking in (data/town.ts). */
function startRoadRun(): void {
  input.reset();
  input.claim(0, input.menuSource); // the device whose press started the run plays the first hero at once
  startRun(devConfig((Date.now() & 0xffffffff) >>> 0));
}

/** Off-ledger dev restart (R): the next seed, as before the campaign existed. */
function restart(): void {
  startRun(devConfig((seed + 1) >>> 0));
}

function finishRun(): void {
  if (sim.road) { clearRunSave(runSaveStore); savedRun = undefined; } // the run is over: nothing to continue
  const sum = summarizeEnd(sim, retreated, route.index, route.total);
  screen = runEndScreen(sum, cfg.chapter);
  if (sim.road && screen.kind === 'text') {
    // renown for the run, kept in the profile for the town to spend
    const earned = renownFor({ cleared: sum.cleared, bosses: sim.road.bosses, kills: sum.kills, won: sum.outcome === 'won', setOut: !sim.road.town });
    keepProfile(withRun(profile, sim.road.renown + earned, sim.road.meta, sim.road.trees));
    screen.body.push({ text: `Renown earned: ${earned}  (${profile.renown} to spend in the town)`, tone: 'gold' });
  }
  mode = 'summary';
  input.consumeMenu();
}

/** There is no cut between levels: the route just follows where the party is on the road, for the HUD, the music and the summary. */
let roadScene = -1;
/** The controls tutorial opens once the party has walked out of the town. */
let tutorialAfterTown = false;
/** How many crossroads the scenery has been painted for: a choice repaints the road ahead in the chosen biome (well before any of it is in view). */
let paintedChoices = 0;
function followRoad(): void {
  const r = sim.road!;
  if (tutorialAfterTown && !r.town) { tutorialAfterTown = false; tutorial = createTutorial(); sim.tutorialHold = true; }
  // the town spent renown (or built a place): keep it, whatever becomes of the run
  if (r.renown !== profile.renown || metaRanks(profile).some((v, i) => v !== r.meta[i]) || JSON.stringify(profile.trees ?? null) !== JSON.stringify(treesToProfile(r.trees))) keepProfile(withRun(profile, r.renown, r.meta, r.trees));
  if (r.choices.length !== paintedChoices) { paintedChoices = r.choices.length; applyScenery(cfg.seed, route.total, r); }
  if (sim.sceneIndex !== roadScene) { roadScene = sim.sceneIndex; cast.reset(sim); } // the next road scene along the way
  if (r.level !== route.index) { route.index = r.level; route.plan = levelPlan(cfg.seed, r.level, route.total); cfg = { ...cfg, chapter: route.plan.chapter }; }
  route.store = r.camp;
}

/** The word shown for a moment over a ware or a giver after a trade press (the sim's `Ev.Trade` events since `from`). */
function noteTrades(from: number): void {
  const ev = sim.events;
  for (let n = from; n < ev.n; n++) {
    const o = n * EV_STRIDE;
    if (ev.data[o] !== Ev.Trade) continue;
    const what = ev.data[o + 3], i = ev.data[o + 4], k = ev.data[o + 5];
    if (what === TradeEv.Gift || what === TradeEv.HasGift || what === TradeEv.GiftMaxed) {
      giftNote = { gift: i, text: what === TradeEv.Gift ? `P${k + 1} TOOK IT` : what === TradeEv.HasGift ? `P${k + 1} HAS ONE` : `P${k + 1} HAS THE MOST` };
      shopNoteUntil = frameTick + 120;
    } else if (what === TradeEv.Taken || what === TradeEv.Returned) {
      questNote = { offer: i, text: what === TradeEv.Taken ? `P${k + 1} ACCEPTED` : 'GIVEN BACK' };
      questNoteUntil = frameTick + 120;
    } else {
      shopNote = { ware: i, text: what === TradeEv.Bought ? `P${k + 1} BOUGHT` : what === TradeEv.Broke ? 'NOT ENOUGH GOLD' : `P${k + 1} HAS THE MOST` };
      shopNoteUntil = frameTick + 120;
    }
  }
}

/** The people with a favour to ask, as the renderer shows them. */
function questView(): QuestView {
  return {
    offers: sim.offers.map((def, i) => { const sp = questSpot(i); return { x: sp.x + sim.shopX, y: sp.y, def }; }),
    near: sim.players.map((_, k) => nearOffer(sim, k)),
    taken: sim.questTaken,
    note: questNote,
  };
}

/** The goods on the ground as the renderer shows them. */
function storeView(): StoreView {
  return {
    wares: sim.wares.map((it, i) => {
      const def = WARES[it.ware];
      return {
        x: wareSpot(i, sim.wares.length).x + sim.shopX, y: wareSpot(i, sim.wares.length).y, icon: def.icon, name: def.name, blurb: def.blurb, price: it.price, sold: it.sold, afford: sim.gold >= it.price,
        standing: sim.players.map((p) => wareStanding(def, p)),
      };
    }),
    near: sim.players.map((_, k) => nearWare(sim, k)),
    note: shopNote,
    gifts: sim.gifts.map((up, i) => {
      const sp = giftSpot(i), u = UPGRADES[up];
      return { x: sp.x + sim.shopX, y: sp.y, icon: u.icon, name: u.name, text: u.text, takenBy: sim.giftPick.flatMap((g, k) => (g === i ? [k] : [])) };
    }),
    giftNear: sim.players.map((_, k) => nearGift(sim, k)),
    giftNote,
    giftDone: sim.giftPick.map((g) => g >= 0),
  };
}

function menuUpdate(): void {
  const { ok, any, sound, music, cont } = input.consumeMenu();
  if (sound) audio.setSound(!audio.soundOn);
  if (music) audio.setMusic(!audio.musicOn);
  if (any) audio.unlock(); // a pad press is not a user gesture to the browser, but costs nothing to try
  if (mode === 'summary' && ok) { mode = 'title'; screen = titleScreen(); }
  else if (mode === 'title' && cont && savedRun) continueRun();
  else if (mode === 'title' && any && !titleKeyHandled) startRoadRun();
  titleKeyHandled = false;
}

if (devRun) {
  const c = devConfig(seed);
  // Dev aid: ?beat=R1 stages a story beat in an entered-seed run, to look at it without playing the campaign up to it.
  if (__DEV__ && params.has('beat')) c.reservedBeat = { id: params.get('beat')! };
  startRun(c);
} else { mode = 'title'; screen = titleScreen(); }

startLoop({
  tickRate: TICK_RATE,
  timeScale: () => (__DEV__ ? ((window as unknown as { __ts?: number }).__ts ?? 1) : 1),
  update() {
    frameTick++;
    if (mode !== 'run') { menuUpdate(); return; }
    if (resume) { resumeUpdate(); return; } // a continued run holds until the players are back
    if (input.quitRequested) { input.quitRequested = false; if (sim.road && sim.phase === Phase.Playing) { saveAndQuit(); return; } }
    if (input.restartRequested) {
      if (devRun) { restart(); return; }
      retreated = true; // abandoning the road is a retreat
      finishRun();
      return;
    }
    const frames = input.sample();
    for (const k of botSlots) {
      if (pilotSkill) pilotFor(k).drive(sim, frames[k], route.store ? { allDone: [...pilots.values()].every((q) => q.storeDone && sim.players[q.slot].pending === 0) } : undefined);
      else botInput(sim, k, frames[k]);
      if (k > 0 && sim.tick === 3) frames[k].buttons |= Btn.Join;
    }
    if (demo) refillDemoHero();
    if (calmRoad) { sim.spawnTimer = sim.flankTimer = 1e9; sim.nextClump = sim.plan.length; }
    const evFrom = sim.events.n;
    step(sim, frames);
    if (sim.road) followRoad();
    if (sim.road && sim.phase === Phase.Playing) {
      const calm = sim.road.calm;
      if (sim.tick - lastSaveTick >= AUTOSAVE_TICKS || (calm >= 0 && calm !== lastCalm) || sim.road.choices.length !== savedChoices) { saveRun(); savedChoices = sim.road.choices.length; }
      lastCalm = calm;
    }
    if (tutorial) { updateTutorial(tutorial, sim, frames); if (tutorial.over) endTutorial(); }
    // The goods on the ground and the quest-givers: the sim trades (sim/shop.ts); here only the words shown after a press.
    if (route.store) {
      noteTrades(evFrom);
      if (frameTick > shopNoteUntil) { shopNote = undefined; giftNote = undefined; }
      if (frameTick > questNoteUntil) questNote = undefined;
    }
    if (sim.phase === Phase.Playing) return;
    if (devRun && route.total === 1) return; // an entered seed of one level: the banner stays until R
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
      else if (sim.phase === Phase.Won) audio.stinger('win'); // (only the end of the road is won)
    }
    lastPhase = sim.phase;
    const fighting = mode === 'run' && !route.store && sim.phase === Phase.Playing;
    const danger = fighting ? dangerOf(sim, sim.camX) : { danger: 0, boss: false };
    // The music turns to the next level's biome at the peddler, halfway through a camp (roadMusicBiome).
    const musicBiome = sim.road ? roadMusicBiome(sim) : sim.biome;
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
    if (resume) alpha = 1; // frozen: no stepping, so nothing to interpolate
    const cam = lerp(sim.prevCamX, sim.camX, alpha);
    const routed = !devRun || route.total > 1;
    renderer.begin();
    drawFrame(renderer.batcher, sprites, sim, fx, cam, alpha, {
      stats,
      simLag: stats.simLagging(performance.now()),
      drawCalls: renderer.batcher.lastDrawCalls,
      sprites: renderer.batcher.lastSprites,
      cast,
      endPrompt: routed ? 'ATTACK TO CONTINUE' : undefined,
      hideEndBanner: false,
      levelKeys: sim.players.map((_, k) => input.levelHint(k)),
      storeHints: sim.road?.town ? sim.players.map((_, k) => input.interactHint(k)) : campShown(sim) ? sim.players.map((_, k) => (nearWare(sim, k) >= 0 || nearOffer(sim, k) >= 0 || nearGift(sim, k) >= 0 ? input.interactHint(k) : '')) : undefined,
      questView: campShown(sim) ? questView() : undefined, // (from the moment the camp is near, so its people are in place before the party arrives)
      storeView: campShown(sim) ? storeView() : undefined,
      routeLabel: sim.road?.town ? `THE TOWN  ${route.total} LEVELS AHEAD` : route.total > 1 ? (route.store ? `STORE  LEVEL ${route.index + 1} OF ${route.total}` : `LEVEL ${route.index + 1} OF ${route.total}`) : undefined,
    });
    cast.drawBubbles(renderer.batcher, sprites, sim, cam, alpha);
    if (!cast.hearing()) barks.draw(renderer.batcher, sprites, sim, cam, alpha);
    if (tutorial) drawTutorial(renderer.batcher, sprites, tutorialView(tutorial, sim, (k, a) => input.actionHint(k, a)));
    if (resume) drawResumeHold(renderer.batcher, sprites, resumeView());
    renderer.end();
  },
});

if (__DEV__) {
  new EventSource('/esbuild').addEventListener('change', () => location.reload());
  const w = window as unknown as { sim: () => typeof sim; cast: () => typeof cast; sprites: typeof sprites; fx: typeof fx };
  w.sim = () => sim;
  w.cast = () => cast;
  (w as unknown as { tutorial: () => Tutorial | null }).tutorial = () => tutorial;
  w.sprites = sprites;
  Object.defineProperty(w, 'fx', { get: () => fx }); // (the run replaces it, so hand out the live one)
  (w as unknown as { stats: typeof stats }).stats = stats;
}
