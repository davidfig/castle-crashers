// Seeded PRNG (sfc32). State is a plain Uint32Array so it serializes and hashes trivially.
export type Rng = Uint32Array;

export const Stream = { level: 1, spawn: 2, combat: 3, loot: 4, story: 5, campaign: 6, offer: 7 } as const;

function splitmix32(state: Uint32Array): number {
  state[0] = (state[0] + 0x9e3779b9) >>> 0;
  let z = state[0];
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

/** Derive an independent stream from a run seed. */
export function createRng(seed: number, stream: number): Rng {
  const sm = new Uint32Array(1);
  sm[0] = (seed ^ Math.imul(stream + 1, 0x85ebca6b)) >>> 0;
  const s = new Uint32Array(4);
  s[0] = splitmix32(sm);
  s[1] = splitmix32(sm);
  s[2] = splitmix32(sm);
  s[3] = 1;
  for (let i = 0; i < 12; i++) nextU32(s);
  return s;
}

export function nextU32(s: Rng): number {
  let a = s[0], b = s[1], c = s[2], d = s[3];
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  s[0] = a; s[1] = b; s[2] = c; s[3] = d;
  return t >>> 0;
}

/** Float in [0, 1). */
export function rngFloat(s: Rng): number {
  return nextU32(s) / 4294967296;
}

/** Float in [lo, hi). */
export function rngRange(s: Rng, lo: number, hi: number): number {
  return lo + rngFloat(s) * (hi - lo);
}

/** Integer in [0, n). */
export function rngInt(s: Rng, n: number): number {
  return Math.floor(rngFloat(s) * n);
}
