// Sim -> presentation event queue. Typed ring of [type, x, y, a, b]. The sim never reads it.
import { EVENT_CAP } from './constants';

export const Ev = {
  Swing: 1,       // a,b = facing * range, c = arc dot
  Hit: 2,         // a = damage
  Kill: 3,        // a = mob type, b = credited to a player, c,d = launch velocity
  Nova: 4,        // a = radius
  PlayerHurt: 5,  // a = slot
  PlayerDown: 6,  // a = slot
  Dash: 7,        // a,b = direction
  Revive: 8,      // a = slot
  Finisher: 9,    // a,b = facing
  Blast: 10,      // a = radius
  Block: 11,      // shield absorbed a hit
  Fire: 12,       // archer released an arrow; a,b = direction
  Arrow: 13,      // arrow destroyed by a player
  Coin: 15,       // a = value collected
  Wave: 14,       // finisher wave; a,b = direction * length
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
