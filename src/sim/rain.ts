// The archer's ability: a rain of arrows shot up into the air that falls on a spot ahead of him. Shared by the sim (when each
// arrow lands, and where) and the renderer (the arrows rising and falling), so what you see is what hits.

/** Ticks from an arrow leaving the bow to its landing: it flies a high arc the whole way. */
export const RAIN_FLIGHT = 34;
/** The volley is loosed over this many ticks. */
export const RAIN_SPREAD = 36;
/** How high (px) the top of an arrow's arc is above the ground. */
export const RAIN_HEIGHT = 80;

export function rainLaunchTick(n: number, count: number): number {
  return Math.floor((n * RAIN_SPREAD) / count);
}

export function rainLandTick(n: number, count: number): number {
  return rainLaunchTick(n, count) + RAIN_FLIGHT;
}

function hash(seed: number, n: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n + 1, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Where arrow `n` of a volley lands, relative to the centre of the rain (the ground is foreshortened, hence the 0.7). */
export function rainOffset(seed: number, n: number, radius: number, out: [number, number]): void {
  const a = hash(seed, n * 2) * Math.PI * 2, r = radius * Math.sqrt(hash(seed, n * 2 + 1));
  out[0] = Math.cos(a) * r;
  out[1] = Math.sin(a) * r * 0.7;
}
