// What a party takes from one level of a route into the next (docs/07-procgen.md, "The camp"): who is in it, how they have
// grown, how hurt they are, and the running totals. Plain data, so the camp can edit it (picks, rest) between levels.
import { CLASSES } from '../data/classes';
import { MOBS } from '../data/mobs';
import { UPGRADES } from '../data/upgrades';
import { activatePlayer, type GameState } from './state';

export interface PlayerCarry {
  classId: number;
  level: number;
  xp: number;
  pending: number;
  ranks: number[];
  coins: number;
  kills: number;
  /** Health as a fraction of the class maximum. */
  hpFrac: number;
}

export interface Carry {
  /** By slot; null for a slot nobody is in. */
  players: (PlayerCarry | null)[];
  gold: number;
  kills: number;
  slain: number[];
  spared: number[];
  betrayed: number;
  surrenders: number;
}

/** Where a hero stands at the start of a level. */
const START_X = 80;

export function captureCarry(s: GameState): Carry {
  return {
    players: s.players.map((p) => p.active ? {
      classId: p.classId, level: p.level, xp: p.xp, pending: p.pending, ranks: Array.from(p.ranks), coins: p.coins, kills: p.kills,
      hpFrac: p.downed ? 0 : Math.max(0, Math.min(1, s.ents.hp[p.ent] / CLASSES[p.classId].hp)),
    } : null),
    gold: s.gold,
    kills: s.kills,
    slain: Array.from(s.slain),
    spared: Array.from(s.spared),
    betrayed: s.betrayed,
    surrenders: s.surrenders,
  };
}

/** The camp's rest: everyone is on their feet, at full health. */
export function restCarry(c: Carry): Carry {
  return { ...c, players: c.players.map((p) => (p ? { ...p, hpFrac: 1 } : p)) };
}

/** Puts a carried party into a freshly created sim. */
export function applyCarry(s: GameState, c: Carry): void {
  for (let k = 0; k < c.players.length; k++) {
    const pc = c.players[k];
    if (!pc) continue;
    const p = s.players[k];
    if (!p.active) activatePlayer(s, k, START_X, 40 + k * 40);
    p.classId = pc.classId;
    p.level = pc.level; p.xp = pc.xp; p.pending = pc.pending;
    for (let i = 0; i < UPGRADES.length; i++) p.ranks[i] = pc.ranks[i] ?? 0;
    p.coins = pc.coins; p.kills = pc.kills;
    const cls = CLASSES[pc.classId];
    s.ents.hp[p.ent] = s.ents.maxhp[p.ent] = Math.max(1, cls.hp * pc.hpFrac);
    s.ents.maxhp[p.ent] = cls.hp;
  }
  s.gold = c.gold;
  s.kills = c.kills;
  for (let i = 0; i < MOBS.length; i++) { s.slain[i] = c.slain[i] ?? 0; s.spared[i] = c.spared[i] ?? 0; }
  s.betrayed = c.betrayed;
  s.surrenders = c.surrenders;
}
