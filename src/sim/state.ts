import { createRng, Stream, type Rng } from '../engine/rng';
import { MAX_ENTS, MAX_PLAYERS } from './constants';
import { allocEntity, createEntities, Kind, type Entities } from './entities';
import { createEvents, type EventBuf } from './events';
import { createGrid, type Grid } from './grid';
import { CLASSES } from '../data/classes';
import { generateLevel } from './gen/level';

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
}

export interface GameState {
  seed: number;
  tick: number;
  phase: number;
  kills: number;
  camX: number;
  prevCamX: number;
  rngCombat: Rng;
  rngSpawn: Rng;
  rngLoot: Rng;
  /** Shared gold (docs/05: gold is shared). */
  gold: number;
  /** Live coin pickups on the field (capped). */
  coinCount: number;
  /** Global freeze ticks remaining (impact weight). */
  hitStop: number;
  spawnTimer: number;
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
    dashT: 0, dashX: 0, dashY: 0, cdAttack: 0, cdAbility1: 0, cdDash: 0,
    bufAbility1: 0, bufDodge: 0, prevButtons: 0, faceX: 1, faceY: 0, kills: 0, coins: 0,
    fury: 50, combo: 0, comboTimer: 0, lungeT: 0,
  };
}

export function activatePlayer(s: GameState, slot: number, x: number, y: number): void {
  const p = s.players[slot];
  const cls = CLASSES[p.classId];
  p.active = true;
  p.downed = false;
  p.ent = allocEntity(s.ents, Kind.Player, slot, x, y, cls.hp);
}

export function createSim(seed: number): GameState {
  const s: GameState = {
    seed,
    tick: 0,
    phase: Phase.Playing,
    kills: 0,
    camX: 0,
    prevCamX: 0,
    rngCombat: createRng(seed, Stream.combat),
    rngSpawn: createRng(seed, Stream.spawn),
    rngLoot: createRng(seed, Stream.loot),
    gold: 0,
    coinCount: 0,
    hitStop: 0,
    spawnTimer: 300,
    blasts: new Float64Array(BLAST_CAP * 4),
    blastN: 0,
    ents: createEntities(MAX_ENTS),
    grid: createGrid(),
    players: Array.from({ length: MAX_PLAYERS }, createPlayer),
    events: createEvents(),
    scratch: new Int32Array(MAX_ENTS),
  };
  activatePlayer(s, 0, 80, 100);
  generateLevel(s, seed);
  return s;
}
