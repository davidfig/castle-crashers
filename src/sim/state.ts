import { createRng, Stream, type Rng } from '../engine/rng';
import { CAM_SLACK, LEFT_BEHIND, MAX_ENTS, MAX_PLAYERS, STORE_EXIT_X, STORE_W, WORLD_W } from './constants';
import { allocEntity, createEntities, freeEntity, Kind, type Entities } from './entities';
import { createEvents, type EventBuf } from './events';
import { createGrid, type Grid } from './grid';
import { CLASSES } from '../data/classes';
import { MOBS } from '../data/mobs';
import { UPGRADES } from '../data/upgrades';
import { biomeIndex } from '../data/roster';
import { HEAT_MAX, heatHorde } from '../data/heat';
import { placeSites } from './sites';
import type { QuestDef } from '../data/quests';
import type { StockItem } from '../data/wares';
import { createQuestRun, placeQuest, type QuestRun } from './quests';
import { planGates, planLevel, type ClumpPlan, type Gate, type SimBeat, type SimScene } from './gen/level';
import { createRoad, roadUpkeep, type RoadState } from './gen/road';

export const BLAST_CAP = 64;
/** Boon effects waiting to resolve this tick: [kind, x, y, owner slot, a, b] each. */
export const PROC_CAP = 96;
/** Effects a tick may queue in all (a chain of kills that each burst stops growing past this). */
export const PROC_BUDGET = 48;

/** Level-up rerolls and banishes each hero starts a run with. */
export const START_REROLLS = 2;
export const START_BANISHES = 1;

export const Phase = { Playing: 0, Won: 1, Lost: 2 } as const;

export interface PlayerState {
  active: boolean;
  ent: number;
  classId: number;
  downed: boolean;
  downTimer: number;
  invuln: number;
  dashT: number;
  /** Non-zero while the rogue is hidden: unseen and untargetable until he strikes, is hurt, or a mob runs into him. */
  vanishT: number;
  /** Where the rogue was when he slipped into hiding: mobs that did not see him go keep hunting this spot. */
  vanishX: number;
  vanishY: number;
  /** Ticks until a revealed rogue can slip back into hiding. */
  revealT: number;
  /** The cleric's holy aura is switched on: it pulses on its own and drains stamina. */
  auraOn: boolean;
  dashX: number;
  dashY: number;
  cdAttack: number;
  cdAbility1: number;
  cdDash: number;
  bufAbility1: number;
  /** The archer is holding Ability 1 to aim his rain: the stick (or movement keys) steers a reticle at (rainX, rainY) instead of walking him. */
  rainOn: boolean;
  rainX: number;
  rainY: number;
  bufDodge: number;
  prevButtons: number;
  faceX: number;
  faceY: number;
  kills: number;
  /** Gold this player has picked up. */
  coins: number;
  fury: number;
  combo: number;
  comboTimer: number;
  /** Ticks of forward lunge remaining. */
  lungeT: number;
  /** Ticks this hero has held Stand Down (0 = not standing down). */
  standT: number;
  /** Party XP towards the next level, the level reached, and level-ups not yet chosen (docs/06: the level-up panel). */
  xp: number;
  level: number;
  pending: number;
  /** The level-up panel is open: this hero can do nothing else while it is (the game does not pause). */
  panel: boolean;
  /** Pick buttons are held from the last pick: they stay muted until released, so choosing a card does not swing a sword. */
  lock: boolean;
  /** Buttons held last tick, unmuted: the edges for the panel. */
  rawPrev: number;
  /** The card highlighted while choosing a level-up, and which way the stick was last pushed (so one push is one step). */
  cursor: number;
  stickPrev: number;
  /** Rank of each upgrade taken (index = UPGRADES). */
  ranks: Uint8Array;
  /** Ticks until each trigger boon (index = UPGRADES) may fire again; only the ones with a cooldown use it. */
  boonCd: Uint16Array;
  /** Stamina: spent by swings, dashes and the special; comes back once the regen delay has passed. */
  stamina: number;
  staminaDelay: number;
  /** Out of stamina: slower, and cannot attack or dash until it has recovered a little. */
  winded: boolean;
  /** Ability 2 (the big sweep). */
  cdSpecial: number;
  bufAbility2: number;
  /** Ticks of slowed movement left (cursed by a ghoul's claws, a scream, a poison pool). */
  slowT: number;
  /** Ticks left snared by a trap (cannot walk; a dodge-roll breaks free). */
  rootT: number;
  /** Dodge Count: extra dodges left in this burst, and ticks left to use them. */
  dashChain: number;
  chainT: number;
  /** Nova Count: echo pulses still to come, ticks to the next, and whether the cast was the big one. */
  echoLeft: number;
  echoT: number;
  echoBig: boolean;
  /** Ticks left silenced by a banshee's wail (the ability buttons do nothing). */
  silenceT: number;
  /** Ticks left disoriented by a whiteout (movement reversed). */
  confuseT: number;
  /** Ticks left poisoned (a slow bleed, `POISON_PULSE` ticks per point) and whether it is a burn rather than venom (look only). */
  poisonT: number;
  burning: boolean;
  /** Ticks left hexed (takes half again as much damage) and withered (no stamina comes back). */
  hexT: number;
  witherT: number;
  /** A harpoon's haul or a ram's launch: `pullT` ticks of shoving the hero by (`pullX`, `pullY`) each tick. */
  pullT: number;
  pullX: number;
  pullY: number;
  /** Level-up rerolls and banishes left (they last the whole run), rerolls spent on the pick in front of the hero, the boons banished for good (index = UPGRADES), and which way the stick was last pushed up/down. */
  rerolls: number;
  banishes: number;
  salt: number;
  banned: Uint8Array;
  stickPrevY: number;
  /** The shaman's pending action (docs/18): a press remembered for a few ticks, as 1 + (4 if Alt was held) + the button (0 Attack, 1 Ability 1, 2 Ability 2, 3 Dodge); 0 = none; `plantT` is the ticks it is still remembered. */
  bufPlant: number;
  plantT: number;
  /** The shaman's selected extra: an index into the class's `totems.extras`. */
  pick: number;
}

/** A good lying on the store's ground (data/wares.ts), and whether someone has bought it (each is one of a kind). */
export interface Ware extends StockItem {
  sold: boolean;
}

export interface GameState {
  seed: number;
  /** Which biome the level is in (an index into the rosters and the renderer's biomes). */
  biome: number;
  tick: number;
  phase: number;
  kills: number;
  /** Credited kills by mob type (index = MobType): the heads the run reports to the campaign. */
  slain: Int32Array;
  camX: number;
  prevCamX: number;
  /** The furthest the camera has been: it may back up only `CAM_SLACK` from here, and what lies behind `backLine` is gone. */
  camMax: number;
  rngCombat: Rng;
  rngSpawn: Rng;
  rngLoot: Rng;
  /** Tick the boss died (-1 = not yet); the run is won a few seconds later so the loot can be gathered. */
  bossDeadTick: number;
  /** The planned encounters (a function of the seed) and how many have been streamed in so far. */
  plan: ClumpPlan[];
  nextClump: number;
  /** The barriers that hold the camera (a function of the plan), how many have opened, and the tick the last one did (-1 = none yet). */
  gates: Gate[];
  gateIdx: number;
  gateOpenTick: number;
  /** Index in `plan` of the staged story beat, or -1. */
  beatIndex: number;
  /** Index in the plan of the road scene's marker, or -1 (see `sceneHold`). */
  sceneIndex: number;
  /** The controls tutorial is running: the planned encounters wait (it brings its own small waves, see `spawnTutorialWave`). */
  tutorialHold: boolean;
  /** Tick the party reached the staged beat (-1 = not yet). */
  beatPlayedTick: number;
  /** Stand Down / surrender is available (from chapter II of the campaign). */
  surrender: boolean;
  /** This is the store between two levels: no enemies, no director, won by walking on to the far end. */
  store: boolean;
  /** The road goes on after this field (another level or the store follows): winning it does not stop the party, who keep walking while what is left of the horde leaves. */
  onward: boolean;
  /** The biome on the far side of the store (-1 outside one). */
  nextBiome: number;
  /** How long the field is, and the x at which a hero has reached its end (a level is won there; the store is left there). */
  worldW: number;
  exitX: number;
  /** Seed level-up offers are drawn from (the run's, not the level's). */
  offerSeed: number;
  /** Mobs that have laid down their arms this run, how many were killed anyway, and how many got away (by mob type). */
  surrenders: number;
  betrayed: number;
  spared: Int32Array;
  /** The side quest the party took in the camp for this level (sim/quests.ts), or none. */
  quest: QuestRun | null;
  /** The store's goods on the ground (empty outside a store); bought with the trade button (sim/shop.ts). */
  wares: Ware[];
  /** Where the store (or a camp on the road) begins: its goods and givers stand at their store spots plus this. */
  shopX: number;
  /** The run's one road (sim/gen/road.ts), or null for a field of its own (a level or a store). */
  road: RoadState | null;
  /** The quests offered by the givers standing in the store, and the one the party has taken (-1 = none) for the level that follows. */
  offers: QuestDef[];
  questTaken: number;
  /** Shared gold (docs/05: gold is shared). */
  gold: number;
  /** The difficulty the party chose (data/heat.ts, 0 = none), chests opened this run, and chests in a row that gave no boon (the pity timer). */
  heat: number;
  /** Depth multiplier on damage dealt to heroes (from the route; constant over a level). */
  damageMul: number;
  mix: readonly [number, number];
  chestsOpened: number;
  chestMiss: number;
  /** Live coin pickups on the field (capped). */
  coinCount: number;
  /** Live potion pickups on the field (capped), and how many more may still drop (refills over time; see `POTION_*` in step.ts). */
  potionCount: number;
  potionBudget: number;
  /** Global freeze ticks remaining (impact weight). */
  hitStop: number;
  /** Px of forward camera progress until the next reinforcement pack (trigger points, not a clock). */
  spawnTimer: number;
  /** Furthest camera x already counted toward the spawn triggers. */
  trigCamX: number;
  /** Px of forward progress until the next flank wave (packs entering over the top/bottom edges). */
  flankTimer: number;
  /** Pending bomber explosions: [x, y, ownerSlot, harmsPlayers] * BLAST_CAP. */
  blasts: Float64Array;
  blastN: number;
  /** Boon effects queued by triggers, resolved after the tick's fighting (so a chain reaction never nests), and how many more this tick may add. */
  procs: Float64Array;
  procN: number;
  procBudget: number;
  ents: Entities;
  grid: Grid;
  players: PlayerState[];
  events: EventBuf;
  /** Scratch space for spatial queries; not part of the hashed state. */
  scratch: Int32Array;
  /** Same, for boon effects, which run while other code is still reading `scratch`. */
  procScratch: Int32Array;
}

function createPlayer(): PlayerState {
  return {
    active: false, ent: -1, classId: 0, downed: false, downTimer: 0, invuln: 0,
    dashT: 0, vanishT: 0, vanishX: 0, vanishY: 0, revealT: 0, auraOn: false, dashX: 0, dashY: 0, cdAttack: 0, cdAbility1: 0, cdDash: 0,
    bufAbility1: 0, rainOn: false, rainX: 0, rainY: 0, bufDodge: 0, prevButtons: 0, faceX: 1, faceY: 0, kills: 0, coins: 0,
    fury: 50, combo: 0, comboTimer: 0, lungeT: 0, standT: 0, xp: 0, level: 1, pending: 0, panel: false, lock: false, rawPrev: 0, cursor: 0, stickPrev: 0, ranks: new Uint8Array(UPGRADES.length), boonCd: new Uint16Array(UPGRADES.length), stamina: 100, staminaDelay: 0, winded: false, cdSpecial: 0, bufAbility2: 0, slowT: 0,
    rootT: 0, dashChain: 0, chainT: 0, echoLeft: 0, echoT: 0, echoBig: false, silenceT: 0, confuseT: 0, poisonT: 0, burning: false, hexT: 0, witherT: 0, pullT: 0, pullX: 0, pullY: 0,
    rerolls: START_REROLLS, banishes: START_BANISHES, salt: 0, banned: new Uint8Array(UPGRADES.length), stickPrevY: 0, bufPlant: 0, plantT: 0, pick: 0,
  };
}

export function activatePlayer(s: GameState, slot: number, x: number, y: number): void {
  const p = s.players[slot];
  const cls = CLASSES[p.classId];
  p.active = true;
  p.downed = false;
  p.ent = allocEntity(s.ents, Kind.Player, slot, x, y, cls.hp);
}

/**
 * A hero leaves the run (a continued run whose saved hero nobody took up, docs/21-the-road.md): their body goes and the slot is empty,
 * so a newcomer who takes it starts afresh. What they bought is gone with them; the shared purse stays.
 */
export function leaveParty(s: GameState, slot: number): void {
  const p = s.players[slot];
  if (p.active && p.ent >= 0) freeEntity(s.ents, p.ent);
  s.players[slot] = createPlayer();
}

/** Run options the campaign layer decides; the sim knows nothing else about the campaign. */
export interface SimOptions {
  /** Stand Down and surrender are in play. */
  surrender?: boolean;
  /** Seed that level-up offers are drawn from, so a pending pick offers the same cards in every level of a route. Defaults to the level seed. */
  offerSeed?: number;
  /** False for a level that is not the last of its route: no boss, won by reaching the far end. */
  boss?: boolean;
  /** Enemy count multiplier for the level (1 = as planned): later levels of a biome are bigger. */
  scale?: number;
  /** The store between levels (see `STORE_W`): nobody to fight, a peddler to trade with, and the road on into the next level's biome. */
  store?: boolean;
  /** The biome the store leads into (its scenery takes over past the peddler). */
  nextBiome?: number;
  /** Another field follows this one (see `GameState.onward`). */
  onward?: boolean;
  /** A road scene to leave a clearing for (see `SimScene`). */
  scene?: SimScene;
  /** The party's chosen difficulty (data/heat.ts). */
  heat?: number;
  /** Multiplier on the damage mobs deal this level (the road ramps up; 1 = as authored). */
  damage?: number;
  /** The side quest the party took for this level (data/quests.ts). */
  quest?: QuestDef;
  /** The slice (of 0..1) of the biome's cast this level draws its enemies from: later levels of a biome open where the last one ended. */
  mix?: readonly [number, number];
  /** The first field of a run: it opens with small encounters (see `PlanOptions.opener`). */
  opener?: boolean;
  /** How long the field is (default `WORLD_W`, a store `STORE_W`): its encounters, sites and quest are laid out along it. */
  length?: number;
  /** The whole run as one road (docs/21-the-road.md): `total` levels with a camp after each but the last, planned from the run's seed
   *  (the sim's `seed`) as the party nears them. The per-level options (boss, scale, mix, damage, opener) then come from the road. */
  road?: { total: number };
  /** A store's goods (data/wares.ts `stockFor`) and the quests its givers offer (data/quests.ts `questOffers`). */
  stock?: readonly StockItem[];
  offers?: readonly QuestDef[];
}

export function createSim(seed: number, beat?: SimBeat, opts: SimOptions = {}): GameState {
  const store = opts.store === true;
  const heat = Math.max(0, Math.min(HEAT_MAX, Math.floor(opts.heat ?? 0)));
  const road = opts.road ? createRoad(seed, opts.road.total, heat) : null;
  const length = store ? STORE_W : road ? road.layout.length : (opts.length ?? WORLD_W);
  const plan = store || road ? [] : planLevel(seed, beat, { boss: opts.boss, scale: (opts.scale ?? 1) * heatHorde(heat), scene: opts.scene, heat, opener: opts.opener, length });
  const s: GameState = {
    seed,
    biome: biomeIndex(seed),
    tick: 0,
    phase: Phase.Playing,
    kills: 0,
    slain: new Int32Array(MOBS.length),
    camX: 0,
    prevCamX: 0,
    camMax: 0,
    rngCombat: createRng(seed, Stream.combat),
    rngSpawn: createRng(seed, Stream.spawn),
    rngLoot: createRng(seed, Stream.loot),
    bossDeadTick: -1,
    plan,
    nextClump: 0,
    gates: planGates(plan),
    gateIdx: 0,
    gateOpenTick: -1,
    beatIndex: plan.findIndex((c) => c.beat !== undefined),
    sceneIndex: plan.findIndex((c) => c.scene !== undefined),
    tutorialHold: false,
    beatPlayedTick: -1,
    surrender: opts.surrender === true && !store,
    store,
    onward: opts.onward === true,
    nextBiome: store ? (opts.nextBiome ?? biomeIndex(seed)) : -1,
    worldW: length,
    exitX: store ? STORE_EXIT_X : length - 70,
    offerSeed: opts.offerSeed ?? seed,
    surrenders: 0,
    betrayed: 0,
    spared: new Int32Array(MOBS.length),
    quest: opts.quest && !store ? createQuestRun(opts.quest) : null,
    wares: store ? (opts.stock ?? []).map((it) => ({ ware: it.ware, price: it.price, sold: false })) : [],
    shopX: store ? 0 : -1e9,
    road,
    offers: store ? (opts.offers ?? []).map((q) => ({ ...q })) : [],
    questTaken: -1,
    gold: 0,
    heat,
    damageMul: opts.damage ?? 1,
    mix: opts.mix ?? [0, 1],
    chestsOpened: 0,
    chestMiss: 0,
    coinCount: 0,
    potionCount: 0,
    potionBudget: 1,
    hitStop: 0,
    spawnTimer: 300,
    trigCamX: 0,
    flankTimer: 420,
    blasts: new Float64Array(BLAST_CAP * 4),
    blastN: 0,
    procs: new Float64Array(PROC_CAP * 6),
    procN: 0,
    procBudget: PROC_BUDGET,
    ents: createEntities(MAX_ENTS),
    grid: createGrid(),
    players: Array.from({ length: MAX_PLAYERS }, createPlayer),
    events: createEvents(),
    scratch: new Int32Array(MAX_ENTS),
    procScratch: new Int32Array(MAX_ENTS),
  };
  activatePlayer(s, 0, 80, 100);
  if (road) roadUpkeep(s, () => {});
  else if (!store) placeSites(s, opts.boss !== false);
  if (s.quest) placeQuest(s);
  return s;
}

/**
 * The line behind which nothing lives any more: `LEFT_BEHIND` past the furthest-back the camera can still go (`CAM_SLACK` behind the
 * furthest it has been). Entities are kept in front of it, and whatever falls behind it is removed, so a road of any length keeps only
 * what is near the party (docs/21-the-road.md).
 */
export function backLine(s: GameState): number {
  return s.camMax - CAM_SLACK - LEFT_BEHIND;
}
