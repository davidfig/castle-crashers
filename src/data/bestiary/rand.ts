// A small seeded helper for the bestiary generator. It has its own streams (never the sim's), and everything it draws is a pure
// function of the run seed, so every client and every replay builds the same monsters.
import { createRng, nextU32, rngFloat, type Rng } from '../../engine/rng';

/** A stream number well clear of the sim's own (engine/rng.ts `Stream`). */
const BESTIARY_STREAM = 0x6d6f6e;

export class Dice {
  private r: Rng;
  constructor(seed: number, salt = 0) { this.r = createRng((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0, BESTIARY_STREAM); }
  /** Float in [0, 1). */
  f(): number { return rngFloat(this.r); }
  /** Float in [lo, hi). */
  range(lo: number, hi: number): number { return lo + this.f() * (hi - lo); }
  /** Integer in [lo, hi] (inclusive). */
  int(lo: number, hi: number): number { return lo + Math.floor(this.f() * (hi - lo + 1)); }
  chance(p: number): boolean { return this.f() < p; }
  pick<T>(list: readonly T[]): T { return list[Math.floor(this.f() * list.length)]; }
  u32(): number { return nextU32(this.r); }
  /** Picks one by weight (weights <= 0 are never picked); undefined when nothing has weight. */
  weighted<T>(list: readonly T[], weight: (x: T) => number): T | undefined {
    let total = 0;
    for (const x of list) total += Math.max(0, weight(x));
    if (total <= 0) return undefined;
    let t = this.f() * total;
    for (const x of list) {
      const w = Math.max(0, weight(x));
      if (t < w) return x;
      t -= w;
    }
    return list[list.length - 1];
  }
  shuffle<T>(list: readonly T[]): T[] {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
}

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
/** Rounds to `places` decimals (so generated numbers read cleanly in logs). */
export const round = (x: number, places = 0): number => { const k = 10 ** places; return Math.round(x * k) / k; };
