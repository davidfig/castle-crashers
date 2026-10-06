import { createRng, Stream, type Rng } from '../engine/rng';
import { MAX_ENTS, MAX_PLAYERS } from './constants';
import { allocEntity, createEntities, Kind, type Entities } from './entities';
import { createEvents, type EventBuf } from './events';
import { createGrid, type Grid } from './grid';
import { CLASSES } from '../data/classes';
import { MOBS } from '../data/mobs';
import { UPGRADES } from '../data/upgrades';
import { biomeIndex } from '../data/roster';
import { planGates, planLevel, type ClumpPlan, type Gate, type SimBeat } from './gen/level';

export const BLAST_CAP = 64;

export const Phase = { Playing: 0, Won: 1, Lost: 2 } as const;

export interface PlayerState {
  active: boolean;
  ent: number;
  classId: number;
  downed: boolean;
  downTimer: number;
  invuln: number;
  dashT: number;
  /** Ticks left unseen after a rogue's vanish: untargetable, and broken by attacking. */
  vanishT: number;
  /** Where the rogue vanished from: the spot mobs keep heading for while he is unseen. */
  vanishX: number;
  vanishY: number;
  /** The cleric's holy aura is switched on: it pulses on its own and drains stamina. */
  auraOn: boolean;
  dashX: number;
  dashY: number;
  cdAttack: number;
  cdAbility1: number;
  cdDash: number;
  bufAbility1: number;
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
  /** Tick the party reached the staged beat (-1 = not yet). */
  beatPlayedTick: number;
  /** Stand Down / surrender is available (from chapter II of the campaign). */
  surrender: boolean;
  /** Seed level-up offers are drawn from (the run's, not the level's). */
  offerSeed: number;
  /** Mobs that have laid down their arms this run, how many were killed anyway, and how many got away (by mob type). */
  surrenders: number;
  betrayed: number;
  spared: Int32Array;
  /** Shared gold (docs/05: gold is shared). */
  gold: number;
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
  ents: Entities;
  grid: Grid;
  players: PlayerState[];
  events: EventBuf;
  /** Scratch space for spatial queries; not part of the hashed state. */
  scratch: Int32Array;
}

function createPlayer(): PlayerState {
  return {
    active: false, ent: -1, classId: 0, downed: false, downTimer: 0, invuln: 0,
    dashT: 0, vanishT: 0, vanishX: 0, vanishY: 0, auraOn: false, dashX: 0, dashY: 0, cdAttack: 0, cdAbility1: 0, cdDash: 0,
    bufAbility1: 0, bufDodge: 0, prevButtons: 0, faceX: 1, faceY: 0, kills: 0, coins: 0,
    fury: 50, combo: 0, comboTimer: 0, lungeT: 0, standT: 0, xp: 0, level: 1, pending: 0, panel: false, lock: false, rawPrev: 0, cursor: 0, stickPrev: 0, ranks: new Uint8Array(UPGRADES.length), stamina: 100, staminaDelay: 0, winded: false, cdSpecial: 0, bufAbility2: 0, slowT: 0,
    rootT: 0, silenceT: 0, confuseT: 0, poisonT: 0, burning: false, hexT: 0, witherT: 0, pullT: 0, pullX: 0, pullY: 0,
  };
}

export function activatePlayer(s: GameState, slot: number, x: number, y: number): void {
  const p = s.players[slot];
  const cls = CLASSES[p.classId];
  p.active = true;
  p.downed = false;
  p.ent = allocEntity(s.ents, Kind.Player, slot, x, y, cls.hp);
}

/** Run options the campaign layer decides; the sim knows nothing else about the campaign. */
export interface SimOptions {
  /** Stand Down and surrender are in play. */
  surrender?: boolean;
  /** Seed that level-up offers are drawn from, so a pending pick offers the same cards in every level of a route. Defaults to the level seed. */
  offerSeed?: number;
  /** False for a level that is not the last of its route: no boss, won by reaching the far end. */
  boss?: boolean;
}

export function createSim(seed: number, beat?: SimBeat, opts: SimOptions = {}): GameState {
  const plan = planLevel(seed, beat, { boss: opts.boss });
  const s: GameState = {
    seed,
    biome: biomeIndex(seed),
    tick: 0,
    phase: Phase.Playing,
    kills: 0,
    slain: new Int32Array(MOBS.length),
    camX: 0,
    prevCamX: 0,
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
    beatPlayedTick: -1,
    surrender: opts.surrender === true,
    offerSeed: opts.offerSeed ?? seed,
    surrenders: 0,
    betrayed: 0,
    spared: new Int32Array(MOBS.length),
    gold: 0,
    coinCount: 0,
    potionCount: 0,
    potionBudget: 1,
    hitStop: 0,
    spawnTimer: 300,
    trigCamX: 0,
    flankTimer: 420,
    blasts: new Float64Array(BLAST_CAP * 4),
    blastN: 0,
    ents: createEntities(MAX_ENTS),
    grid: createGrid(),
    players: Array.from({ length: MAX_PLAYERS }, createPlayer),
    events: createEvents(),
    scratch: new Int32Array(MAX_ENTS),
  };
  activatePlayer(s, 0, 80, 100);
  return s;
}
