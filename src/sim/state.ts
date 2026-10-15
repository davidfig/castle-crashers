import { createRng, Stream, type Rng } from '../engine/rng';
import { CAM_SLACK, LEFT_BEHIND, MAX_ENTS, MAX_PLAYERS, WORLD_W } from './constants';
import { allocEntity, createEntities, freeEntity, Kind, type Entities } from './entities';
import { createEvents, type EventBuf } from './events';
import { createGrid, type Grid } from './grid';
import { CLASSES } from '../data/classes';
import { MOBS } from '../data/mobs';
import { UPGRADES } from '../data/upgrades';
import { TREES, type TreeSave } from '../data/trees';
import { META } from '../data/meta';
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
  /** The skill in each of the four slots (swing, big swing, nova, dodge; data/skills.ts): 0 is the class's own. Rage switched on, and the Roar's ticks and reach left; ticks left of a Whirlwind's spin. */
  loadout: Uint8Array;
  spinT: number;
  /** A Meteor marked: ticks until it lands, and where. */
  meteorT: number;
  meteorX: number;
  meteorY: number;
  /** A Sanctuary Ring standing: ticks left, where, how wide, how strong its mending is (1 = base). */
  sanctT: number;
  sanctX: number;
  sanctY: number;
  sanctR: number;
  sanctPow: number;
  /** Ticks left shielded by an Aegis Roll. */
  aegisT: number;
  /** The rogue's Smoke Bomb: ticks left, where, how wide. His Rapier's riposte: ticks left to land it. */
  smokeT: number;
  smokeX: number;
  smokeY: number;
  smokeR: number;
  riposteT: number;
  /** The archer's Charged Shot: ticks the bow has been drawn. */
  drawT: number;
  /** A patch of ground left behind (sim/patches.ts): ticks left, where, how wide, damage and stun it deals every `patchEvery` ticks, a trap that springs once, how it is drawn. */
  patchT: number;
  patchX: number;
  patchY: number;
  patchR: number;
  patchDmg: number;
  patchStun: number;
  patchEvery: number;
  patchOnce: number;
  patchLook: number;
  rageOn: boolean;
  roarT: number;
  roarR: number;
  /** The Planted Standard: ticks left, where it stands, its reach and its strength (1 = base). */
  stdT: number;
  stdX: number;
  stdY: number;
  stdR: number;
  stdPow: number;
  /** Hard Knocks (Guardian): hits taken lately (up to 3) and ticks left before they fade. */
  knockN: number;
  knockT: number;
  /** The class tree is open in the town (the hero can do nothing else), and the buttons held last tick for its edges. The cursor is `cursor`. */
  treeOpen: boolean;
  treePrev: number;
}

/** A good lying on a camp's ground (data/wares.ts), and whether someone has bought it (each is one of a kind). */
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
  /** In a camp on the road, the biome of the level after it once it is known (the music turns to it at the peddler); -1 otherwise. */
  nextBiome: number;
  /** How long the field (or the road) is, and the x at which a hero has reached its end. */
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
  /** A camp's goods on the ground (set out as the party nears it, sim/gen/road.ts); bought with the trade button (sim/shop.ts). */
  wares: Ware[];
  /** Where the camp the goods belong to begins: its goods, givers and gift stand at their spots (in a camp's own coordinates) plus this. */
  shopX: number;
  /** A camp's gift (data/gifts.ts): two boons, each hero may take one; `giftPick` is which each hero (by slot) took, -1 for none yet. */
  gifts: number[];
  giftPick: number[];
  /** The run's one road (sim/gen/road.ts), or null for a field of its own (a single level: the tests' harness, `?demo=`). */
  road: RoadState | null;
  /** The quests offered by the givers standing in the camp, and the one the party has taken (-1 = none) for the level that follows. */
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
  /** Progress made while the director was held back near a calm place (docs/21-the-road.md): the packs and waves it owes, paid out gradually once the party has moved on. */
  packDebt: number;
  flankDebt: number;
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
    loadout: new Uint8Array(4), spinT: 0, meteorT: 0, meteorX: 0, meteorY: 0, sanctT: 0, sanctX: 0, sanctY: 0, sanctR: 0, sanctPow: 1, aegisT: 0, smokeT: 0, smokeX: 0, smokeY: 0, smokeR: 0, riposteT: 0, drawT: 0, patchT: 0, patchX: 0, patchY: 0, patchR: 0, patchDmg: 0, patchStun: 0, patchEvery: 1, patchOnce: 0, patchLook: 0, rageOn: false, roarT: 0, roarR: 0, stdT: 0, stdX: 0, stdY: 0, stdR: 0, stdPow: 1, knockN: 0, knockT: 0, treeOpen: false, treePrev: 0,
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
 * Lasting upgrades from the town (data/meta.ts) a hero sets out with: the level they begin at (with that many level-ups to choose in the
 * field) and their tree's loadout. The stat places (Armoury, Forge, Stables) are multipliers on `RoadState.metaMul`, applied in the fight.
 * Idempotent: a place built while heroes are in the town takes hold at once, and a hero never loses what they have.
 */
export function applyMeta(s: GameState, slot: number): void {
  const r = s.road;
  if (!r) return;
  const p = s.players[slot];
  META.forEach((m, i) => {
    const rank = r.meta[i] ?? 0;
    if ('level' in m.gives && p.level < 1 + rank) {
      p.pending += 1 + rank - p.level;
      p.level = 1 + rank;
    }
  });
  if (TREES[p.classId]) p.loadout.set(r.trees[p.classId].loadout); else p.loadout.fill(0); // the tree's equipped skills (data/trees)
}

/**
 * A hero joins a run under way (docs/21-the-road.md, "Joining a run under way"): brought up to strength, at the party's average level
 * (rounded down) with that many level-ups to choose in the field, so they are useful at once without outshining those who earned it; and
 * with the town's lasting upgrades, like everyone else. Alone (or with a party still at level 1), simply a fresh hero.
 */
export function joinParty(s: GameState, slot: number, x: number, y: number): void {
  let sum = 0, n = 0;
  for (let k = 0; k < s.players.length; k++) if (k !== slot && s.players[k].active) { sum += s.players[k].level; n++; }
  activatePlayer(s, slot, x, y);
  const p = s.players[slot];
  const level = n > 0 ? Math.max(1, Math.floor(sum / n)) : 1;
  p.level = level;
  p.pending = level - 1;
  p.xp = 0;
  applyMeta(s, slot);
}

/** A hero takes up another class (the town's stands): a fresh hero of that class where they stand, with the town's upgrades. */
export function resetHero(s: GameState, slot: number, classId: number): void {
  const old = s.players[slot];
  if (!old.active) return;
  const p = createPlayer();
  p.active = true; p.ent = old.ent; p.classId = classId; p.prevButtons = old.prevButtons; p.rawPrev = old.rawPrev;
  s.players[slot] = p;
  s.ents.hp[p.ent] = s.ents.maxhp[p.ent] = CLASSES[classId].hp;
  applyMeta(s, slot);
}

/**
 * The party rests at a camp (as it did on the way into the store between two levels): everyone on their feet, at full health, rid of
 * whatever still ailed them.
 */
export function restParty(s: GameState): void {
  for (const p of s.players) {
    if (!p.active) continue;
    p.downed = false; p.downTimer = 0;
    p.slowT = p.rootT = p.silenceT = p.confuseT = p.poisonT = p.hexT = p.witherT = p.pullT = 0;
    p.burning = false;
    p.stamina = 100; p.staminaDelay = 0; p.winded = false;
    s.ents.hp[p.ent] = s.ents.maxhp[p.ent] = CLASSES[p.classId].hp;
  }
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
  /** How long a field of its own is (default `WORLD_W`): its encounters, sites and quest are laid out along it. */
  length?: number;
  /** The whole run as one road (docs/21-the-road.md): `total` levels with a camp after each but the last, planned from the run's seed
   *  (the sim's `seed`) as the party nears them. The per-level options (boss, scale, mix, damage, opener) then come from the road. It
   *  starts in the town, with the profile's renown to spend and the lasting upgrades bought so far (data/meta.ts, by index). */
  road?: { total: number; renown?: number; meta?: readonly number[]; /** The class trees' owned nodes, active branches and equipped skill (data/trees). */ trees?: readonly TreeSave[]; /** A story beat the first level stages (docs/12, R1: the cookfire). */ beat?: SimBeat; /** The horde's size and the bosses' health (defaults `ROAD_HORDE`, `ROAD_BOSS_HP`): tuning knobs for the balance probe. */ horde?: number; bossHp?: number; hard?: number; /** Stage the midpoint scene (R5, docs/12-story.md) on this road. */ midpoint?: boolean; /** Tell the whole road in this chapter (the Ledger's) rather than each region's own. */ chapter?: number };
}

export function createSim(seed: number, beat?: SimBeat, opts: SimOptions = {}): GameState {
  const heat = Math.max(0, Math.min(HEAT_MAX, Math.floor(opts.heat ?? 0)));
  const road = opts.road ? createRoad(seed, opts.road.total, heat, opts.road.renown ?? 0, opts.road.meta ?? [], opts.road.beat, opts.road.horde, opts.road.bossHp, opts.road.trees, opts.road.hard, opts.road.midpoint, opts.road.chapter) : null;
  const length = road ? road.layout.length : (opts.length ?? WORLD_W);
  const plan = road ? [] : planLevel(seed, beat, { boss: opts.boss, scale: (opts.scale ?? 1) * heatHorde(heat), scene: opts.scene, heat, opener: opts.opener, length });
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
    surrender: opts.surrender === true,
    nextBiome: -1,
    worldW: length,
    exitX: length - 70,
    offerSeed: opts.offerSeed ?? seed,
    surrenders: 0,
    betrayed: 0,
    spared: new Int32Array(MOBS.length),
    quest: opts.quest ? createQuestRun(opts.quest) : null,
    wares: [],
    shopX: -1e9,
    gifts: [],
    giftPick: [-1, -1, -1, -1],
    road,
    offers: [],
    questTaken: -1,
    gold: road ? META.reduce((a, m, i) => a + ('gold' in m.gives ? m.gives.gold * (road.meta[i] ?? 0) : 0), 0) : 0,
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
    packDebt: 0,
    flankDebt: 0,
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
  applyMeta(s, 0);
  if (road) roadUpkeep(s, () => {});
  else placeSites(s, opts.boss !== false);
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
