// Weather drawn over the world: rain, snow, fog and lightning (see docs/11-backgrounds.md).
// Render-only: a pure function of (biome weather, level progress, camera x, tick), so it cannot touch the deterministic sim.
import { weatherFor, type BlendedMood, type WeatherDef } from '../data/biomes';
import { stormCoverAt, weatherAt, type Active, type Sky } from '../data/scenery/sky';
import type { Batcher } from '../platform/gl/batcher';
import { hex } from '../platform/gl/batcher';
import { VIEW_H, VIEW_W } from '../sim/constants';
import type { Sprites } from './art';
import { FIELD_Y0, GROUND_TOP } from './background';

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** Below this strength an effect is not drawn at all. */
const MIN_LEVEL = 0.02;

/** A 0xRRGGBB color times the mood tint, as a batcher color with alpha 0..1. */
function tinted(rgb: number, tint: number, alpha: number): number {
  const r = (((rgb >> 16) & 255) * ((tint >> 16) & 255)) / 255, g = (((rgb >> 8) & 255) * ((tint >> 8) & 255)) / 255, bl = ((rgb & 255) * (tint & 255)) / 255;
  return hex((Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl), alpha);
}

/** Weather in force at the camera, refilled each frame. */
const active: Active[] = [];
const scratch: Active[] = [];

/**
 * How overcast the sky is (0..1) at road `x`: the rain's strength, felt a little ahead of it and kept a little behind it, so the cloud
 * banks roll in before the first drops and linger as the rain lets up.
 */
export function stormCover(sky: Sky, x: number): number {
  if (devOverride()) { let m = 0; for (const w of devOverride()!) if (w.kind === 'rain') m = Math.max(m, w.curve?.[0]?.[1] ?? 1); return Math.min(1, m * 1.7); }
  return stormCoverAt(sky, x, scratch);
}

/** The dev preview (`?weather=...`): steady weather everywhere, whatever the road says. */
function devOverride(): readonly WeatherDef[] | null {
  const want = typeof __DEV__ !== 'undefined' && __DEV__ ? (globalThis as { __weather?: string }).__weather : undefined;
  return want === undefined ? null : weatherFor(undefined, want);
}

/**
 * Draws the weather at road `x` (the camera's left edge, in road coordinates). The weather is the run's own (`planSky`), laid along the road
 * and not tied to any level or biome, so a front can carry on across a turn between biomes.
 */
export function drawWeather(b: Batcher, S: Sprites, sky: Sky, mood: BlendedMood, x: number, oy: number, tick: number): void {
  const dev = devOverride();
  let n = 0;
  if (dev) for (const w of dev) { if (!active[n]) active[n] = { kind: w.kind, level: 0, wind: 0 }; active[n].kind = w.kind; active[n].level = w.curve?.[0]?.[1] ?? 1; active[n].wind = w.wind ?? 0; n++; }
  else n = weatherAt(sky, x + VIEW_W / 2, active);
  if (n === 0) return;
  const camX = x;
  let storm = 0;
  for (let i = 0; i < n; i++) if (active[i].kind === 'rain') storm = Math.max(storm, active[i].level);
  // heavy rain dims the day
  if (storm > MIN_LEVEL) b.drawScaled(S.px, 0, 0, VIEW_W, VIEW_H, hex(0x0a1226, 0.22 * storm));
  for (let i = 0; i < n; i++) {
    const { kind, level, wind } = active[i];
    if (level < MIN_LEVEL) continue;
    const w: WeatherDef = { kind, wind };
    switch (kind) {
      case 'fog': drawFogBanks(b, S, mood, camX, oy, tick, level); break;
      case 'rain': drawRainfall(b, S, mood, w, camX, oy, tick, level); break;
      case 'snow': drawSnowfall(b, S, mood, w, camX, tick, level); break;
      case 'lightning': drawLightning(b, S, camX, tick, level); break;
      case 'sandstorm': drawSandstorm(b, S, mood, w, camX, oy, tick, level); break;
    }
  }
}

// --- fog -----------------------------------------------------------------------------------------------------------

const FOG_LOOP = 1100;
const FOG_WISPS = 9;

/** A veil that thickens toward the horizon, and big banks of mist drifting between the camera and the characters. */
function drawFogBanks(b: Batcher, S: Sprites, mood: BlendedMood, camX: number, oy: number, tick: number, level: number): void {
  const color = mood.sky[mood.sky.length - 1];
  // the veil: bands out from the horizon, strongest there
  for (let y = 70; y < VIEW_H; y += 20) {
    const d = Math.abs(y + 10 - GROUND_TOP) / 240; // 0 at the horizon
    const a = level * (0.32 - Math.min(1, d) * 0.2);
    b.drawScaled(S.px, 0, y + oy, VIEW_W, 20, tinted(color, mood.tint, a));
  }
  const n = Math.max(1, Math.round(FOG_WISPS * level));
  for (let i = 0; i < n; i++) {
    const h = hash(i, 7001);
    const f = S.fogLarge[h % S.fogLarge.length];
    const x = mod((i * FOG_LOOP) / FOG_WISPS + ((h >>> 8) % 80) + tick * 0.14 - camX * 1.2, FOG_LOOP) - 420;
    if (x > VIEW_W) continue;
    const y = 96 + ((h >>> 16) % 230);
    b.draw(f, Math.round(x), y + oy, (h & 0x100) !== 0, tinted(color, mood.tint, 0.4 * level));
  }
}

// --- rain ----------------------------------------------------------------------------------------------------------

const RAIN_DROPS = 340;
const RAIN_SPLASH = 5;

/**
 * Streaks that fall at a slant and land on the field, each at its own depth (nearer drops fall faster, land lower on the
 * screen and are brighter), then splash for a few ticks. `level` sets how many of the drops are out.
 */
function drawRainfall(b: Batcher, S: Sprites, mood: BlendedMood, w: WeatherDef, camX: number, oy: number, tick: number, level: number): void {
  const n = Math.round(RAIN_DROPS * level), lean = (w.wind ?? 0) * 2, t = Math.floor(tick);
  for (let i = 0; i < n; i++) {
    const h = hash(i, 9001), d = (h & 255) / 255;
    const v = 5 + d * 4, landY = 125 + d * 215 + ((h >>> 20) & 15);
    const fall = Math.ceil((landY + 8) / v), cycle = fall + RAIN_SPLASH + ((h >>> 4) & 15);
    const phase = (t + ((h >>> 8) % cycle)) % cycle;
    const span = VIEW_W + 200;
    const x0 = mod((h >>> 12) % span - camX * (0.2 + 0.3 * d), span) - 100;
    if (phase < fall) {
      const y = -8 + phase * v, len = 3 + Math.round(d * 3);
      const x = x0 + lean * phase;
      if (x < -6 || x > VIEW_W + 6) continue;
      b.drawScaled(S.px, Math.round(x), Math.round(y) + oy, 1, len, tinted(0xc8dcf2, mood.tint, 0.5 + 0.45 * d), false, 0, -Math.atan2(lean, v));
    } else {
      const s = phase - fall, x = x0 + lean * fall, y = landY;
      if (x < -6 || x > VIEW_W + 6) continue;
      const c = tinted(0xd0e0f2, mood.tint, (0.65 - s * 0.12) * (0.5 + 0.5 * d));
      b.drawScaled(S.px, Math.round(x - 1 - s), Math.round(y - s * 0.6) + oy, 1, 1, c);
      b.drawScaled(S.px, Math.round(x + 1 + s), Math.round(y - s * 0.6) + oy, 1, 1, c);
      if (s < 2) b.drawScaled(S.px, Math.round(x), Math.round(y - 1 - s) + oy, 1, 1, c);
    }
  }
}

// --- snow ----------------------------------------------------------------------------------------------------------

const SNOW_FLAKES = 190;
// white shows on the sky and peaks, the blue-greys on the white ground
const SNOW_COLORS = [0xffffff, 0xa8bcd8, 0x8aa2c6, 0xffffff];

/** Flakes that sink and sway, each at its own depth: nearer ones are bigger, quicker and brighter. `level` sets how many are out. */
function drawSnowfall(b: Batcher, S: Sprites, mood: BlendedMood, w: WeatherDef, camX: number, tick: number, level: number): void {
  const n = Math.round(SNOW_FLAKES * level), wind = w.wind ?? 0, H = VIEW_H + 8;
  for (let i = 0; i < n; i++) {
    const h = hash(i, 4001), d = (h & 255) / 255;
    const y = mod(((h >>> 8) % H) + tick * (0.3 + 0.5 * d), H) - 4;
    const span = VIEW_W + 40;
    const x = mod(((h >>> 12) % span) - camX * (0.3 + 0.5 * d) + tick * wind * (0.5 + d) + Math.sin(tick * 0.03 + i) * (2 + 3 * d), span) - 20;
    const size = d > 0.7 ? 2 : 1;
    b.drawScaled(S.px, Math.round(x), Math.round(y), size, size, tinted(SNOW_COLORS[(h >>> 20) % SNOW_COLORS.length], mood.tint, 0.55 + 0.4 * d));
  }
}

// --- sandstorm -----------------------------------------------------------------------------------------------------

const SAND_GRAINS = 520;
// dark grains show on the pale sand, bright ones on the sky and the shaded dunes
const SAND_COLORS = [0x8a5a28, 0x6e4620, 0xfff0c8, 0xf4d898, 0xa87038];

/**
 * A wall of blown sand: a tan veil over everything that thickens with the strength, fast dust banks, and streaks of grain
 * racing along the wind (nearer ones longer, quicker and brighter). A slow gust swells and slackens the whole thing.
 */
function drawSandstorm(b: Batcher, S: Sprites, mood: BlendedMood, w: WeatherDef, camX: number, oy: number, tick: number, level: number): void {
  const dir = (w.wind ?? 1) < 0 ? -1 : 1, gust = 0.8 + 0.2 * Math.sin(tick * 0.045) * Math.sin(tick * 0.017 + 1);
  const L = level * gust;
  // the veil, heavier toward the horizon where the dust is deepest
  b.drawScaled(S.px, 0, 0, VIEW_W, VIEW_H, tinted(0xb07838, mood.tint, 0.42 * L));
  for (let y = 80; y < 230; y += 15) b.drawScaled(S.px, 0, y + oy, VIEW_W, 15, tinted(0xc08840, mood.tint, 0.2 * L * (1 - Math.abs(y + 8 - GROUND_TOP) / 150)));
  // dust banks racing past
  const n = Math.max(1, Math.round(12 * level));
  for (let i = 0; i < n; i++) {
    const h = hash(i, 6001);
    const f = S.fogLarge[h % S.fogLarge.length];
    const x = mod((i * FOG_LOOP) / 12 + ((h >>> 8) % 80) + dir * tick * 1.5 - camX * 1.3, FOG_LOOP) - 420;
    if (x > VIEW_W) continue;
    b.draw(f, Math.round(x), 90 + ((h >>> 16) % 240) + oy, (h & 0x100) !== 0, tinted(0xa87438, mood.tint, 0.5 * L));
  }
  // grains
  const g = Math.round(SAND_GRAINS * level), span = VIEW_W + 120;
  for (let i = 0; i < g; i++) {
    const h = hash(i, 6501), d = (h & 255) / 255;
    const v = (5 + d * 7) * gust;
    const x = mod(((h >>> 8) % span) + dir * tick * v - camX * (0.3 + 0.4 * d), span) - 60;
    if (x < -8 || x > VIEW_W) continue;
    const y = 100 + ((h >>> 18) % 250) + Math.round(Math.sin(tick * 0.08 + i) * 1.5);
    const len = 3 + Math.round(d * 7);
    b.drawScaled(S.px, dir > 0 ? Math.round(x) - len : Math.round(x), y + oy, len, d > 0.6 ? 2 : 1, tinted(SAND_COLORS[(h >>> 10) % SAND_COLORS.length], mood.tint, (0.5 + 0.45 * d) * Math.min(1, L * 1.2)));
  }
}

// --- lightning -----------------------------------------------------------------------------------------------------

/** Strikes are scheduled per window of this many ticks, one at most. */
const STRIKE_WINDOW = 240;

export interface Strike {
  /** Ticks since the strike began. */
  age: number;
  /** Screen brightness of the flash, 0..1. */
  flash: number;
  /** Seed for the bolt's shape and where it falls. */
  seed: number;
}

/**
 * The strike in progress at `tick`, if any: a pure function of the tick, so every client and every replay sees the same
 * sky. Each window may hold one strike (more likely at higher `level`): a hard flash, a flicker, a second flash, then a
 * fade.
 */
export function strikeAt(tick: number, level: number, out: Strike): Strike | null {
  const win = Math.floor(tick / STRIKE_WINDOW), h = hash(win, 8101);
  if ((h & 1023) / 1023 >= level * 0.85) return null;
  const age = tick - win * STRIKE_WINDOW - (20 + ((h >>> 10) % 150));
  if (age < 0 || age >= 40) return null;
  out.age = age;
  out.seed = h;
  out.flash = age < 3 ? 1 : age < 6 ? 0.2 : age < 9 ? 0.75 : Math.max(0, 0.4 * (1 - (age - 9) / 31));
  return out;
}

const strike: Strike = { age: 0, flash: 0, seed: 0 };

/** A flash over the whole screen and, for the first few ticks, a jagged bolt falling from the clouds to the horizon. */
function drawLightning(b: Batcher, S: Sprites, camX: number, tick: number, level: number): void {
  const s = strikeAt(Math.floor(tick), level, strike);
  if (!s) return;
  if (s.age < 9) {
    const cx = 40 + ((s.seed >>> 4) % (VIEW_W - 80)) - Math.round(camX * 0.02);
    const col = hex(0xf2f6ff, s.age < 6 ? 1 : 0.7), halo = hex(0x9ab4ff, s.age < 6 ? 0.4 : 0.2);
    let x = cx;
    for (let y = 0; y < GROUND_TOP - 4; y += 4) {
      const step = ((hash(s.seed, y) % 7) - 3);
      b.drawScaled(S.px, x - 2, y, 5, 4, halo);
      b.drawScaled(S.px, x, y, 2, 4, col);
      if (y % 24 === 20) { // a fork
        const dir = hash(s.seed, y + 1) & 1 ? 1 : -1;
        for (let k = 1; k <= 4; k++) b.drawScaled(S.px, x + dir * k * 2, y + k * 3, 1, 3, col);
      }
      x += step;
    }
  }
  b.drawScaled(S.px, 0, 0, VIEW_W, VIEW_H, hex(0xdfe8ff, 0.5 * s.flash));
}
