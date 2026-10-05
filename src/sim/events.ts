// Sim -> presentation event queue. Typed ring of [type, x, y, a, b]. The sim never reads it.
import { EVENT_CAP } from './constants';

export const Ev = {
  Swing: 1,       // a,b = facing * range, c = arc dot
  Hit: 2,         // a = damage
  Kill: 3,        // a = mob type, b = credited to a player, c,d = launch velocity
  Nova: 4,        // a = radius
  PlayerHurt: 5,  // a = slot
  PlayerDown: 6,  // a = slot
  Dash: 7,        // a,b = direction, c = kind (0 roll, 1 charge, 2 vanish, 3 teleport, 4 heal)
  Revive: 8,      // a = slot
  Finisher: 9,    // a,b = facing
  Blast: 10,      // a = radius
  Block: 11,      // shield absorbed a hit
  Fire: 12,       // archer released an arrow; a,b = direction
  Quake: 33,      // warrior shockwave; a,b = direction * length, c = half-width, d = 1 for the big one
  ArrowSpent: 32, // a player's arrow reached the end of its range and drops to the ground; a,b = direction
  Arrow: 13,      // arrow destroyed by a player
  Pulse: 24,      // cleric point-blank burst; a = radius, b = 1 for the heavy one
  Teleport: 22,   // mage blink; a,b = destination
  Heal: 23,       // cleric pulse; a = radius
  Winded: 21,     // a hero ran out of stamina; a = slot
  Slam: 18,       // boss ground slam lands; a = radius
  Roar: 19,       // boss war cry; supporters burst out
  BossDown: 20,   // the boss dies
  Charge: 16,     // a charge begins; a,b = direction
  Dust: 17,       // a kicked-up dust puff while charging; a,b = direction
  Coin: 15,       // a = value collected
  Wave: 14,       // finisher wave; a,b = direction * length
  Burst: 25,      // a = radius, b = style (0 rock, 1 stomp, 2 scream, 3 bone burst, 4 poison)
  Summon: 26,     // something is raised here
  HealMob: 27,    // an enemy healer's pulse; a = radius
  Rally: 28,      // a drummer's beat; a = radius
  Blink: 29,      // a = destination x, b = destination y
  Beam: 30,       // a,b = direction * length, c = width
  Beat: 22,       // the party reached a staged story beat
  Surrender: 23,  // a mob lays down its arms; a = mob type
  LevelUp: 24,    // a hero gained a level; a = slot
  Potion: 31,     // a hero drank a potion; a = slot
  Pick: 25,       // a hero chose an upgrade; a = slot, b = upgrade index
} as const;

export const EV_STRIDE = 7;

export interface EventBuf {
  n: number;
  data: Float64Array;
}

export function createEvents(): EventBuf {
  return { n: 0, data: new Float64Array(EVENT_CAP * EV_STRIDE) };
}

export function emit(b: EventBuf, type: number, x: number, y: number, a = 0, c = 0, d = 0, f = 0): void {
  if (b.n >= EVENT_CAP) return;
  const o = b.n * EV_STRIDE;
  b.data[o] = type;
  b.data[o + 1] = x;
  b.data[o + 2] = y;
  b.data[o + 3] = a;
  b.data[o + 4] = c;
  b.data[o + 5] = d;
  b.data[o + 6] = f;
  b.n++;
}
