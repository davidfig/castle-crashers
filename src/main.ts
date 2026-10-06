import { InputManager } from './platform/input/input';
import { startLoop } from './platform/loop';
import { Renderer } from './platform/gl/renderer';
import { buildSprites } from './render/art';
import { loadHeroImages } from './render/heroSheets';
import { loadMobImages } from './render/mobSheets';
import { loadNpcImages } from './render/npcSheets';
import { drawFrame } from './render/draw';
import { Fx } from './render/fx';
import { CLASSES, classForBotSlot } from './data/classes';
import { MAX_PLAYERS, TICK_RATE, VIEW_H, VIEW_W, WORLD_W } from './sim/constants';
import { createSim } from './sim/state';
import { choosePick, pickCard, step } from './sim/step';
import { applyCarry, captureCarry, restCarry, type Carry } from './sim/carry';
import { lerp } from './engine/math';
import { FrameStats } from './platform/perf';
import { botInput } from './sim/bot';
import { Btn } from './sim/input';
import { Phase, activatePlayer } from './sim/state';
import { applyRunSummary } from './campaign/summary';
import { makeRunConfig, offerWrits, offLedgerConfig, type RunConfig } from './campaign/board';
import { LEDGER_KEY, loadLedger, saveLedger, type KeyValueStore } from './campaign/storage';
import { beatPlayed, summarizeRun } from './campaign/run';
import { doorsAfter, levelPlan, ROUTE_LEVELS, type Door, type LevelPlan } from './campaign/route';
import { doorsScreen, picksScreen, shopScreen, spoilsScreen } from './campaign/camp';
import { stockFor, WARES, type StockItem } from './data/wares';
import { buy } from './sim/shop';
import { boardScreen, scenePages, sceneScreen, selectScreen, summaryScreen, type LobbySlot, type Screen } from './campaign/view';
import { drawScreen } from './render/menu';
import { Barks } from './render/barks';
import { AFTERMATH, HUB_SCENES, type Scene } from './data/story/hub';
import { dueScenes, markSceneSeen } from './campaign/scenes';

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

const input = new InputManager();
let fx = new Fx();

const params = new URLSearchParams(location.search);
// ?biome=N forces a biome (scenery and enemies; see biomeIndex). Read before any sim is created.
if (__DEV__ && params.has('biome')) (globalThis as { __biome?: number }).__biome = Number(params.get('biome'));
// ?scenery=frozen previews scenery that has no enemy roster yet (see FROZEN_PASS); the enemies stay those of the seed's biome.
if (__DEV__ && params.has('scenery')) (globalThis as { __scenery?: string }).__scenery = params.get('scenery') ?? undefined;
let seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Date.now() & 0xffffffff) >>> 0;
// Dev aid: let the bot drive extra player slots so multiplayer can be watched without controllers.
//   ?bots=3  slots 2-4 are bot-controlled     ?auto=1  slot 1 is bot-controlled too
const botSlots: number[] = [];
if (__DEV__) {
  const n = Math.min(3, Number(params.get('bots') ?? 0) || 0);
  if (params.get('auto') === '1') botSlots.push(0);
  for (let k = 1; k <= n; k++) botSlots.push(k);
}


// --- Campaign flow: hub scenes -> Writ board -> run -> summary -> back. Everything here is presentation; the sim only gets a seed.
// ?seed=N is an entered seed: it skips the board and the run never touches the Ledger.
let store: KeyValueStore | undefined;
try { store = localStorage; } catch { /* blocked site data: play on, unsaved */ }
if (__DEV__ && params.get('reset') === '1') { try { localStorage.removeItem(LEDGER_KEY); } catch { /* ignore */ } }
const loaded = loadLedger(store, () => crypto.getRandomValues(new Uint32Array(1))[0]);
let ledger = loaded.ledger;
const SAVE_NOTE = { corrupt: 'SAVE UNREADABLE - THIS SESSION WONT BE SAVED', newer: 'SAVE IS FROM A NEWER VERSION - NOT SAVING', unavailable: 'STORAGE BLOCKED - NOT SAVING' } as const;
const saveNote = loaded.status in SAVE_NOTE ? SAVE_NOTE[loaded.status as keyof typeof SAVE_NOTE] : undefined;
function persist(): void { if (loaded.writable) saveLedger(store, ledger); }

type Mode = 'title' | 'run' | 'board' | 'scene' | 'summary' | 'select' | 'camp';
let mode: Mode = 'board';
let cfg: RunConfig = offLedgerConfig(seed);
let retreated = false;
let endTicks = 0;
let screen: Screen = boardScreen(ledger, [], 0);
let writs = offerWrits(ledger);
let sel = 0;
let scenes: Scene[] = [];
/** Which beat of the current hub scene is showing. */
let scenePage = 0;
let frameTick = 0;
const barks = new Barks();

// A run is a route of levels with a camp between them (docs/07). The sim only ever sees one level.
interface Route {
  /** Index of the level being played, and how many the route has. */
  index: number;
  total: number;
  plan: LevelPlan;
  /** What the party carries into the level being played (none for the first). */
  carry: Carry | undefined;
  /** Staged beats an earlier level of the route already played. */
  beats: string[];
}
let route: Route = { index: 0, total: 1, plan: levelPlan(seed, 0, 1), carry: undefined, beats: [] };
let campStage: 'spoils' | 'picks' | 'shop' | 'doors' = 'spoils';
let campReady: boolean[] = [];
let campPrevBtn: number[] = [];
let doors: Door[] = [];
let doorSel = 0;
let shopStock: StockItem[] = [];
let shopSold: boolean[] = [];
let shopCursor: number[] = [];
let shopPrevY: number[] = [];
let shopNote = '';
let shopNoteUntil = 0;
let campBefore: Carry | undefined;
let campNow: Carry | undefined;
/** Off-ledger dev runs are one level unless ?levels=N asks for a route. */
function routeTotal(c: RunConfig): number {
  const dev = Math.max(1, Math.min(6, Number(params.get('levels') ?? 1) || 1));
  return c.offLedger ? (params.has('camp') ? Math.max(2, dev) : dev) : ROUTE_LEVELS;
}

/** Show the Writ board, after any hub scenes that are due. */
function enterHub(): void {
  scenes = dueScenes(ledger);
  scenePage = 0;
  if (scenes.length) { mode = 'scene'; screen = sceneScreen(scenes[0], ledger.party, 0); } else showBoard();
}
function showBoard(): void {
  writs = offerWrits(ledger);
  sel = Math.min(sel, writs.length - 1);
  mode = 'board';
  screen = boardScreen(ledger, writs, sel, saveNote);
}

// Character select: devices claim slots by pressing attack (the same claim a run uses), then pick a class and ready up.
let lobby: LobbySlot[] = [];
let lobbyPrevX: number[] = [];
let lobbyPrevBtn: number[] = [];
let pendingCfg: RunConfig | undefined;
/** Class picks carried from the lobby into the next sim (empty when the run skipped selection). */
let picks: LobbySlot[] = [];

/** `c` is the run the party is choosing for (the dev path); without it this is the party select that opens the game and the board's R. */
function enterSelect(c?: RunConfig): void {
  pendingCfg = c;
  lobby = Array.from({ length: MAX_PLAYERS }, () => ({ joined: false, ready: false, classId: 0 }));
  lobbyPrevX = new Array(MAX_PLAYERS).fill(0);
  lobbyPrevBtn = new Array(MAX_PLAYERS).fill(0);
  // Drop stale presses, then let any held button re-claim its slot.
  input.reset(); input.sample(); input.reset();
  mode = 'select';
  screen = selectScreen(c?.writ, lobby);
}

function selectUpdate(): void {
  if (input.restartRequested) { input.reset(); if (pendingCfg || picks.length) showBoard(); return; } // backing out: to the board (the party stays as it was)
  const frames = input.sample();
  for (let k = 0; k < MAX_PLAYERS; k++) {
    const f = frames[k], l = lobby[k];
    const x = f.moveX > 60 ? 1 : f.moveX < -60 ? -1 : 0;
    const dx = x !== lobbyPrevX[k] ? x : 0;
    const atk = f.buttons & ~Btn.Join & ~lobbyPrevBtn[k]; // any button readies up
    lobbyPrevX[k] = x;
    lobbyPrevBtn[k] = f.buttons;
    if (!l.joined) { if (f.buttons & Btn.Join) l.joined = true; continue; }
    if (!l.ready && dx !== 0) l.classId = (l.classId + dx + CLASSES.length) % CLASSES.length;
    if (atk) l.ready = !l.ready;
  }
  screen = selectScreen(pendingCfg?.writ, lobby);
  const joined = lobby.filter((l) => l.joined);
  if (joined.length && joined.every((l) => l.ready)) {
    picks = lobby.map((l) => ({ ...l }));
    if (pendingCfg) { startRun(pendingCfg, true); return; }
    // the party is set: the hub scenes and the board now speak to this party
    ledger = { ...ledger, party: joined.map((l) => CLASSES[l.classId].name) };
    persist();
    enterHub();
  }
}

function newSim(plan: LevelPlan): ReturnType<typeof createSim> {
  const sd = plan.seed;
  const s = createSim(sd, route.index === 0 ? cfg.reservedBeat : undefined, {
    surrender: cfg.writ.chapter >= 2 || (__DEV__ && params.get('surrender') === '1'),
    offerSeed: cfg.seed,
    boss: plan.boss,
  });
  if (route.carry) applyCarry(s, route.carry);
  for (let k = 0; k < picks.length && !route.carry; k++) {
    if (!picks[k].joined) continue;
    s.players[k].classId = picks[k].classId;
    if (k === 0) s.ents.hp[s.players[0].ent] = s.ents.maxhp[s.players[0].ent] = CLASSES[picks[0].classId].hp;
    else activatePlayer(s, k, 60, 40 + k * 40);
  }
  // Dev aid: bot-controlled slots each take a different class (the warrior stays in slot 1; the seed picks which others), so a bot party shows several.
  if (!route.carry) for (const k of botSlots) s.players[k].classId = classForBotSlot(k, sd);
  // Dev aid: ?boss=1 starts at the boss arena so the boss can be tried without fighting the whole battlefield.
  if (__DEV__ && params.get('boss') === '1' && plan.boss) {
    s.tick = 130;                            // past the opening delay, so encounters stream in
    s.nextClump = s.plan.length - 2;         // skip to the last wall and the boss
    s.camX = s.prevCamX = WORLD_W - 900;       // (the last screens of the field, whatever its length)
    const pe = s.players[0].ent;
    s.ents.x[pe] = s.ents.px[pe] = WORLD_W - 760;
    s.ents.y[pe] = s.ents.py[pe] = 100;
  }
  return s;
}
let sim = newSim(route.plan);

const stats = new FrameStats();

function startRun(c: RunConfig, keepSlots = false): void {
  cfg = c;
  if (!keepSlots) picks = [];
  seed = c.seed;
  const total = routeTotal(c);
  route = { index: 0, total, plan: levelPlan(c.seed, 0, total), carry: undefined, beats: [] };
  sim = newSim(route.plan);
  fx = new Fx();
  input.reset();
  retreated = false;
  endTicks = 0;
  barks.reset();
  mode = 'run';
}

/** Off-ledger dev restart (R): the next seed, as before the campaign existed. */
function restart(): void {
  startRun(offLedgerConfig((seed + 1) >>> 0));
}

function finishRun(): void {
  const before = ledger;
  const sum = summarizeRun(sim, cfg, retreated, undefined, route.beats);
  ledger = applyRunSummary(ledger, sum);
  persist();
  screen = summaryScreen(sum, cfg, before, ledger, sim.gold);
  mode = 'summary';
  input.consumeMenu();
}

/** A level was won and the route goes on: the camp. The action stops here, and only here. */
function enterCamp(): void {
  // a staged beat plays in the level it was placed in, not necessarily the last
  if (route.index === 0 && cfg.reservedBeat && beatPlayed(sim, cfg.reservedBeat.id, 'won', false)) route.beats.push(cfg.reservedBeat.id);
  campBefore = route.carry;
  campNow = captureCarry(sim);
  doors = doorsAfter(cfg.seed, route.index, route.total);
  doorSel = 0;
  campStage = 'spoils';
  mode = 'camp';
  screen = spoilsScreen(cfg.writ.chapter, campNow, campBefore, route.index, route.total);
  input.consumeMenu();
}

function enterPicks(): void {
  campStage = 'picks';
  campReady = new Array(MAX_PLAYERS).fill(false);
  for (const k of botSlots) campReady[k] = true;
  campPrevBtn = input.sample().map((f) => f.buttons); // a button still held from the click-through is not a pick
  screen = picksScreen(sim, campReady, route.index, route.total);
}

function anyPicksWaiting(): boolean {
  return sim.players.some((p) => p.active && p.pending > 0);
}

/** The merchant: a shared purse, and each hero choosing for themselves at the same time. First to the counter gets the last one. */
function enterShop(): void {
  campStage = 'shop';
  shopStock = stockFor(cfg.seed, route.index);
  shopSold = shopStock.map(() => false);
  shopCursor = new Array(MAX_PLAYERS).fill(0);
  shopPrevY = new Array(MAX_PLAYERS).fill(0);
  shopNote = '';
  campReady = new Array(MAX_PLAYERS).fill(false);
  for (const k of botSlots) campReady[k] = true;
  campPrevBtn = input.sample().map((f) => f.buttons);
  screen = shopScreen(sim, shopStock, shopSold, shopCursor, campReady, cfg.writ.chapter, shopNote);
}

function enterDoors(): void {
  campStage = 'doors';
  screen = doorsScreen(doors, doorSel, route.index, route.total);
  input.consumeMenu();
}

/** Through a door and into the next level, with the party as the camp left it. */
function takeDoor(door: Door): void {
  route.carry = restCarry(captureCarry(sim));
  route.index++;
  route.plan = levelPlan(door.seed, route.index, route.total);
  sim = newSim(route.plan);
  fx = new Fx();
  input.restartRequested = false; // slots stay claimed: the same devices keep the same heroes
  retreated = false;
  endTicks = 0;
  barks.reset();
  mode = 'run';
}

function campUpdate(): void {
  if (campStage === 'spoils') {
    if (!input.consumeMenu().ok) return;
    if (!anyPicksWaiting()) { enterShop(); return; }
    enterPicks();
  } else if (campStage === 'picks') {
    const frames = input.sample();
    for (let k = 0; k < MAX_PLAYERS; k++) {
      const edge = frames[k].buttons & ~campPrevBtn[k];
      campPrevBtn[k] = frames[k].buttons;
      const p = sim.players[k];
      if (!p.active) continue;
      if (p.pending > 0) {
        const my = frames[k].moveY;
        const card = pickCard(p, my > 60 ? 1 : my < -60 ? -1 : 0, edge); // the camp's cards stack top to bottom
        if (card >= 0) { choosePick(sim, k, card); p.cursor = 0; }
      }
      if (edge & Btn.Level) campReady[k] = true;
    }
    screen = picksScreen(sim, campReady, route.index, route.total);
    if (sim.players.every((p) => !p.active || p.pending === 0 || campReady[sim.players.indexOf(p)])) enterShop();
  } else if (campStage === 'shop') {
    const frames = input.sample();
    for (let k = 0; k < MAX_PLAYERS; k++) {
      const f = frames[k];
      const edge = f.buttons & ~campPrevBtn[k];
      campPrevBtn[k] = f.buttons;
      const y = f.moveY > 60 ? 1 : f.moveY < -60 ? -1 : 0;
      const dy = y !== shopPrevY[k] ? y : 0;
      shopPrevY[k] = y;
      if (!sim.players[k].active || campReady[k]) continue;
      if (dy !== 0) shopCursor[k] = (shopCursor[k] + dy + shopStock.length) % shopStock.length;
      if (edge & Btn.Attack) {
        const i = shopCursor[k];
        if (shopSold[i]) continue;
        const res = buy(sim, k, WARES[shopStock[i].ware], shopStock[i].price);
        if (res === 'ok') { shopSold[i] = true; shopNote = `P${k + 1} BOUGHT ${WARES[shopStock[i].ware].name}`; }
        else shopNote = res === 'broke' ? `NOT ENOUGH GOLD FOR ${WARES[shopStock[i].ware].name}` : `P${k + 1} CANNOT TAKE ANY MORE OF THAT`;
        shopNoteUntil = frameTick + 150;
      }
      if (edge & Btn.Level) campReady[k] = true;
    }
    if (frameTick > shopNoteUntil) shopNote = '';
    screen = shopScreen(sim, shopStock, shopSold, shopCursor, campReady, cfg.writ.chapter, shopNote);
    if (sim.players.every((p, k) => !p.active || campReady[k])) enterDoors();
  } else {
    const { dx, ok } = input.consumeMenu();
    if (dx !== 0) { doorSel = (doorSel + dx + doors.length) % doors.length; screen = doorsScreen(doors, doorSel, route.index, route.total); }
    if (ok) takeDoor(doors[doorSel]);
  }
}

function menuUpdate(): void {
  const { dx, ok } = input.consumeMenu();
  if (mode === 'board') {
    if (dx !== 0) { sel = (sel + dx + writs.length) % writs.length; screen = boardScreen(ledger, writs, sel, saveNote); }
    if (input.restartRequested) { enterSelect(); return; } // R: change the party
    if (ok) {
      const c = makeRunConfig(ledger, writs[sel]);
      if (picks.some((p) => p.joined)) startRun(c, true); else enterSelect(c); // the party was chosen up front (a dev skip has none)
    }
  } else if (mode === 'scene') {
    if (ok) {
      if (scenePage + 1 < scenePages(scenes[0], ledger.party).length) {
        scenePage++; // the next beat of the same scene
        screen = sceneScreen(scenes[0], ledger.party, scenePage);
      } else {
        ledger = markSceneSeen(ledger, scenes[0]);
        persist();
        scenes.shift();
        scenePage = 0;
        if (scenes.length) screen = sceneScreen(scenes[0], ledger.party, 0); else showBoard();
      }
    }
  } else if (mode === 'summary' && ok) enterHub();
  else if (mode === 'title' && ok) enterSelect();
}

if (params.has('seed') || (__DEV__ && params.has('camp'))) {
  const c = offLedgerConfig(seed);
  // Dev aid: ?beat=R1 stages a story beat in an entered-seed run, to look at it without playing the campaign up to it.
  if (__DEV__ && params.has('beat')) c.reservedBeat = { id: params.get('beat')!, node: 'combat', biome: 0, at: 'spine', early: false };
  startRun(c);
  // Dev aid: ?camp=spoils|picks|shop|doors goes straight to the camp after a won first level, to work on it without playing the level.
  //   &players=N (1-4)  &gold=N  &pending=N (level-ups waiting per hero)  &level=N (their level)  &kills=N  &chapter=N (the story's wording)
  if (__DEV__ && params.has('camp')) {
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
    if (params.has('chapter')) cfg = { ...cfg, writ: { ...cfg.writ, chapter: Math.max(1, Math.min(5, Number(params.get('chapter')) || 1)) } };
    sim.phase = Phase.Won;
    enterCamp();
    const stage = params.get('camp');
    if (stage === 'picks') enterPicks(); else if (stage === 'shop') enterShop(); else if (stage === 'doors') enterDoors();
  }
} else if (__DEV__ && params.has('scene')) {
  // Dev aid: ?scene=R1:after (or R6, warlord:after ...) shows that hub scene without playing up to it; &page=N starts at a beat,
  // &party=archer,mage sets who stands in it. Nothing is saved.
  const sc = [...Object.values(HUB_SCENES), ...Object.values(AFTERMATH)].find((s) => s.id === params.get('scene'));
  if (sc) {
    loaded.writable = false;
    if (params.has('party')) ledger = { ...ledger, party: params.get('party')!.split(',') };
    scenes = [sc];
    scenePage = Math.max(0, Number(params.get('page') ?? 0) || 0);
    mode = 'scene';
    screen = sceneScreen(sc, ledger.party, scenePage);
  } else enterHub();
} else if (__DEV__ && params.has('hub')) enterHub();
else { mode = 'title'; screen = { kind: 'title' }; }

startLoop({
  tickRate: TICK_RATE,
  timeScale: () => (__DEV__ ? ((window as unknown as { __ts?: number }).__ts ?? 1) : 1),
  update() {
    frameTick++;
    if (mode === 'select') { selectUpdate(); return; }
    if (mode === 'camp') { campUpdate(); return; }
    if (mode !== 'run') { menuUpdate(); return; }
    if (input.restartRequested) {
      if (cfg.offLedger) { restart(); return; }
      retreated = true; // abandoning a Writ is a retreat
      finishRun();
      return;
    }
    const frames = input.sample();
    for (const k of botSlots) {
      botInput(sim, k, frames[k]);
      if (k > 0 && sim.tick === 3) frames[k].buttons |= Btn.Join;
    }
    step(sim, frames);
    // A routed run hands over a few seconds after the banner appears (or on confirm, once the party has had a look):
    // to the camp when a level was won and the route goes on, otherwise to the summary.
    if ((!cfg.offLedger || route.total > 1) && sim.phase !== Phase.Playing) {
      if (endTicks === 0) input.consumeMenu();
      const ok = input.consumeMenu().ok;
      if (++endTicks >= 300 || (endTicks >= 60 && ok)) {
        if (sim.phase === Phase.Won && route.index < route.total - 1) enterCamp(); else finishRun();
      }
    }
  },
  onSkippedTicks(n) {
    stats.noteSkippedTicks(n, performance.now());
  },
  render(alpha, dt, rawDt) {
    stats.record(rawDt * 1000);
    if (mode !== 'run') {
      renderer.begin();
      drawScreen(renderer.batcher, sprites, screen, frameTick + alpha);
      renderer.end();
      return;
    }
    input.consumeHaptics(sim.events);
    fx.consume(sim.events);
    fx.update(dt * 60);

    const cam = lerp(sim.prevCamX, sim.camX, alpha);
    barks.update(sim, cfg.writ.chapter);
    renderer.begin();
    drawFrame(renderer.batcher, sprites, sim, fx, cam, alpha, {
      stats,
      simLag: stats.simLagging(performance.now()),
      drawCalls: renderer.batcher.lastDrawCalls,
      sprites: renderer.batcher.lastSprites,
      endPrompt: !cfg.offLedger || route.total > 1 ? 'ATTACK TO CONTINUE' : undefined,
      levelKeys: sim.players.map((_, k) => input.levelHint(k)),
      routeLabel: route.total > 1 ? `LEVEL ${route.index + 1} OF ${route.total}` : undefined,
    });
    barks.draw(renderer.batcher, sprites, sim, cam, alpha);
    renderer.end();
  },
});

if (__DEV__) {
  new EventSource('/esbuild').addEventListener('change', () => location.reload());
  const w = window as unknown as { sim: () => typeof sim; sprites: typeof sprites; fx: typeof fx };
  w.sim = () => sim;
  w.sprites = sprites;
  w.fx = fx;
  (w as unknown as { ledger: () => typeof ledger }).ledger = () => ledger;
  (w as unknown as { stats: typeof stats }).stats = stats;
}
