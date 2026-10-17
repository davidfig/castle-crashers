// The guest's side of the frames: what the host used for each tick waits here until the sim reaches that tick, kept a few ticks behind
// the host so a late message does not stall the sim. Pure logic; guestLink.ts joins it to the room.
import { MAX_PLAYERS } from '../../sim/constants';
import { createInputFrame, type InputFrame } from '../../sim/input';
import { FRAME_INTS, unpackFrame } from './wire';

/** Ticks kept in hand before the sim steps (about a tenth of a second): what a jittery connection can be late by. */
export const RESERVE = 6;
/** Most ticks stepped in one update when behind. */
const MAX_CATCH_UP = 4;

export class GuestFeed {
  private readonly ticks = new Map<number, number[]>();
  /** The tick the sim steps next. */
  next = 0;
  private haveSim = false;
  /** One past the last tick heard from the host. */
  private end = 0;
  /** Hashes the host sent, by the tick they describe. */
  private readonly hashes = new Map<number, number>();

  /** The sim is now at tick `n` (it was just restored from a snapshot): older frames are of no use. */
  reset(n: number): void {
    this.next = n;
    this.end = n;
    this.haveSim = true;
    for (const k of this.ticks.keys()) if (k < n) this.ticks.delete(k);
    for (const k of this.hashes.keys()) if (k < n) this.hashes.delete(k);
  }

  get ready(): boolean { return this.haveSim; }
  get queued(): number { return this.ticks.size; }

  /** Frames from the host: `f` holds `MAX_PLAYERS * FRAME_INTS` numbers per tick from `n` on. Returns false on a gap (some ticks never came). */
  hear(n: number, f: readonly number[]): boolean {
    if (!this.haveSim) return true;
    const per = MAX_PLAYERS * FRAME_INTS;
    const count = Math.floor(f.length / per);
    const gap = n > this.end;
    this.end = Math.max(this.end, n + count);
    for (let t = 0; t < count; t++) {
      if (n + t >= this.next) this.ticks.set(n + t, f.slice(t * per, (t + 1) * per) as number[]);
    }
    return !gap;
  }

  hearHash(n: number, h: number): void {
    this.hashes.set(n, h);
  }

  /** How many ticks to step now: none while the reserve builds, one at the host's pace, more when far behind. */
  steps(): number {
    const have = this.have();
    if (have <= RESERVE) return 0;
    return Math.min(MAX_CATCH_UP, 1 + Math.floor((have - RESERVE - 1) / 4));
  }

  /** Consecutive ticks waiting from `next`. */
  private have(): number {
    let n = 0;
    while (this.ticks.has(this.next + n)) n++;
    return n;
  }

  /** The frames for the tick the sim steps next, or null when they have not come. Advances. */
  take(into: InputFrame[]): boolean {
    const p = this.ticks.get(this.next);
    if (!p) return false;
    this.ticks.delete(this.next);
    this.next++;
    for (let k = 0; k < MAX_PLAYERS; k++) {
      into[k] ??= createInputFrame();
      unpackFrame(p, k, into[k]);
    }
    return true;
  }

  /** The hash the host sent for the tick the sim has just reached, once (null when it sent none). */
  hashNow(): number | null {
    const h = this.hashes.get(this.next);
    if (h === undefined) return null;
    this.hashes.delete(this.next);
    return h;
  }
}
