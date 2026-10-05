// Deterministic math helpers. Sim code must not call Math.sin/cos/etc (see ADR-0004);
// the tables below are built from a Taylor series that only uses + - * /, which are
// exactly specified by IEEE-754 and therefore identical on every JS engine.

const TWO_PI = 6.283185307179586;
const PI = 3.141592653589793;
const LUT_SIZE = 1024;

function sinTaylor(x: number): number {
  // x in [-pi, pi]
  const x2 = x * x;
  let term = x;
  let sum = x;
  for (let n = 1; n <= 11; n++) {
    term = (-term * x2) / ((2 * n) * (2 * n + 1));
    sum += term;
  }
  return sum;
}

const sinLut = new Float64Array(LUT_SIZE);
for (let i = 0; i < LUT_SIZE; i++) {
  let a = (i / LUT_SIZE) * TWO_PI;
  if (a > PI) a -= TWO_PI;
  sinLut[i] = sinTaylor(a);
}

/** Sine of an angle expressed in turns (1.0 = full circle). */
export function sinTurns(t: number): number {
  const f = (t - Math.floor(t)) * LUT_SIZE;
  const i = Math.floor(f);
  const frac = f - i;
  const a = sinLut[i & (LUT_SIZE - 1)];
  const b = sinLut[(i + 1) & (LUT_SIZE - 1)];
  return a + (b - a) * frac;
}

export function cosTurns(t: number): number {
  return sinTurns(t + 0.25);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
