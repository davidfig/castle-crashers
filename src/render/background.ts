// The world behind and under the action: sky, parallax layers, ground, hill crest, foreground ridge.
// Render-only; see docs/11-backgrounds.md.
import { DESTINATION_LAYER, mix, type BiomeDef, type BlendedMood, type GroundDef, type ParallaxLayer } from '../data/biomes';
import type { Batcher } from '../platform/gl/batcher';
import { hex, rgba } from '../platform/gl/batcher';
import { VIEW_H, VIEW_W } from '../sim/constants';
import type { Sprites } from './art';

/** Screen y of world y=0 (feet at the very top of the field stand on the crest line) and of the horizon. */
export const FIELD_Y0 = 112;
export const GROUND_TOP = 112;
/** Where the foreground ridge along the bottom begins. */
export const RIDGE_TOP = 351;

/**
 * A 0xRRGGBB color times a mood tint (0xRRGGBB, default none) and a brightness `v`, as a batcher color with the given
 * alpha (0..255). `blue` is an extra gain on the blue channel (for the cooler look of the far ground).
 */
function shade(rgb: number, tint = 0xffffff, v = 1, alpha = 255, blue = 1): number {
  return rgba(
    Math.round((((rgb >> 16) & 255) * ((tint >> 16) & 255) * v) / 255),
    Math.round((((rgb >> 8) & 255) * ((tint >> 8) & 255) * v) / 255),
    Math.min(255, Math.round(((rgb & 255) * (tint & 255) * v * blue) / 255)),
    alpha,
  );
}

/** How far down the ground a screen y is: 0 at the horizon, 1 at the bottom of the screen. */
function groundDepth(y: number): number {
  return Math.min(1, Math.max(0, (y - GROUND_TOP) / (VIEW_H - GROUND_TOP)));
}

/** The ground's brightness at screen y: darker toward the horizon (lighting, not perspective: nothing scales with depth). */
function depthShade(y: number): number {
  return 0.86 + groundDepth(y) * 0.14;
}

/** A soft radial glow: three nested discs fake the falloff. `squash` flattens it (a glow on the ground is wider than tall). */
function glow(b: Batcher, S: Sprites, cx: number, cy: number, r: number, squash: number, color: number, alpha: number): void {
  for (const f of [1, 0.64, 0.35]) {
    const rr = r * f;
    b.drawScaled(S.disc, cx - rr, cy - rr * squash, rr * 2, rr * 2 * squash, hex(color, alpha / 2.2));
  }
}

/** The far side of the world drifts slightly with the camera: the sun, moon and stars at this fraction of its speed. */
const SKY_PARALLAX = 0.02;
const CLOUD_PERIOD = 768;
const STAR_COUNT = 48;

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Sky bands, each dithered into the next over 6 px, then stars, the sun and moon, and drifting clouds. */
export function drawSky(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, camXf: number, tick: number, ox: number, oy: number): void {
  const n = mood.sky.length;
  const bandH = Math.ceil(GROUND_TOP / n);
  for (let i = 0; i < n; i++) {
    const y = i * bandH + oy;
    // the whole sky shakes with the screen, so the edges overscan
    b.drawScaled(S.px, -8, i === 0 ? y - 8 : y, VIEW_W + 16, bandH + 1 + (i === 0 ? 8 : 0), hex(mood.sky[i]));
    if (i > 0) {
      // 25% / 50% / 75% of this band's color over the one above, ending where this band starts
      const c = hex(mood.sky[i]);
      for (let m = 0; m < 3; m++) {
        for (let x = -8; x < VIEW_W + 8; x += 256) b.draw(S.dither[m], x, y - 6 + m * 2, false, c);
      }
    }
  }

  if (mood.stars > 0.02) {
    for (let i = 0; i < STAR_COUNT; i++) {
      const h = hash(i, 11);
      const x = ((((h % VIEW_W) - Math.floor(camXf * SKY_PARALLAX)) % VIEW_W) + VIEW_W) % VIEW_W;
      const y = (h >>> 10) % (GROUND_TOP - 30);
      const twinkle = ((tick >> 4) + i) % 7 === 0 ? 0.4 : 1;
      b.drawScaled(S.px, x + ox, y + oy, 1, 1, hex(0xffffff, mood.stars * twinkle * (0.5 + (h >>> 20 & 3) / 6)));
    }
  }

  if (mood.aurora > 0.02) drawAurora(b, S, mood.aurora, camXf, tick, ox, oy);

  const bx = Math.round(VIEW_W * 0.7 - camXf * SKY_PARALLAX) + ox;
  const sunY = mood.sunY + oy, moonY = mood.moonY + oy;
  if (mood.sunY < GROUND_TOP + 24) {
    // the sun reddens as it sinks
    const k = Math.min(1, Math.max(0, (mood.sunY - 40) / 70));
    const col = mix(0xfff6c8, 0xff8a40, k);
    b.drawScaled(S.disc, bx - 32, sunY - 32, 64, 64, hex(col, 0.14));
    b.drawScaled(S.disc, bx - 16, sunY - 16, 32, 32, hex(col, 0.3));
    b.drawScaled(S.disc, bx - 8, sunY - 8, 16, 16, hex(col));
  }
  if (mood.moonY < GROUND_TOP + 12) {
    const mx = Math.round(VIEW_W * 0.28 - camXf * SKY_PARALLAX) + ox;
    const ms = biome.moonScale ?? 1, mr = 10 * ms;
    b.drawScaled(S.disc, mx - mr * 1.6, moonY - mr * 1.6, mr * 3.2, mr * 3.2, hex(0xc8d0ff, 0.12));
    b.drawScaled(S.moon, mx - mr, moonY - mr, S.moon.w * ms, S.moon.h * ms);
  }

  for (const layer of biome.clouds) {
    const tint = shade(layer.tint ?? 0xffffff, mood.tint, 1, Math.round(layer.alpha * 255));
    for (let i = 0; i < layer.count; i++) {
      const h = hash(i, Math.round(layer.k * 1000));
      const base = (i * CLOUD_PERIOD) / layer.count + (h % 90);
      const x = ((((base + tick * layer.drift - camXf * layer.k) % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD) - 80;
      if (x > VIEW_W) continue;
      const y = layer.y0 + ((h >>> 8) % Math.max(1, layer.y1 - layer.y0));
      b.draw(S.clouds[(h >>> 16) % S.clouds.length], Math.round(x) + ox, y + oy, false, tint);
    }
  }
}

/**
 * Northern lights: three slowly undulating curtains, each drawn as 8 px columns in three stacked bands that brighten
 * toward the lower edge (the curtain's hem), in green, teal and violet. They shimmer and drift with the tick.
 */
function drawAurora(b: Batcher, S: Sprites, strength: number, camXf: number, tick: number, ox: number, oy: number): void {
  const COLORS = [0x40f0a0, 0x30d0c8, 0xa060f0];
  for (let r = 0; r < COLORS.length; r++) {
    const base = 34 + r * 15;
    for (let x = -8; x < VIEW_W + 8; x += 8) {
      const wx = x + camXf * 0.05;
      const hem = base + Math.sin(wx * 0.011 + tick * 0.006 + r * 2) * 12 + Math.sin(wx * 0.027 - tick * 0.01 + r) * 4;
      const len = 20 + 10 * Math.sin(wx * 0.02 + r + tick * 0.004);
      const shimmer = 0.75 + 0.25 * Math.sin(wx * 0.09 + tick * 0.03 + r * 3);
      for (let band = 0; band < 3; band++) {
        const a = strength * shimmer * (0.08 + band * 0.11);
        b.drawScaled(S.px, x + ox, Math.round(hem - len + (len / 3) * band) + oy, 8, Math.ceil(len / 3), hex(COLORS[r], a));
      }
    }
  }
}

/**
 * The lights on a strip. Torches: a flame that flickers between two frames and a warm glow (three nested discs).
 * Windows: a lit rectangle over each baked opening, in a color picked per window (mostly warm, a few eerie teal), with a
 * small halo; some are dark, and the odd lit one blinks out for a moment. All are emissive, so they are not dimmed by
 * the time of day and glow a little more at night.
 */
function drawLights(b: Batcher, S: Sprites, layer: ParallaxLayer, spots: readonly { x: number; y: number; w?: number; h?: number }[], sx: number, sy: number, chunk: number, tick: number, night: number): void {
  const lt = layer.lights, wn = layer.windows;
  for (let i = 0; i < spots.length; i++) {
    const sp = spots[i];
    const h = hash(chunk * 17 + i, 61);
    const cx = sx + sp.x, cy = sy + sp.y;
    if (sp.w && sp.h) {
      if (!wn || (h % 100) / 100 >= wn.lit) continue; // this window is dark
      if ((tick + (h >>> 8) * 7) % 420 < 14) continue; // blinks out now and then
      const col = wn.colors[(h >>> 4) % wn.colors.length];
      const a = wn.a * (0.9 + 0.1 * Math.sin(tick * 0.13 + (h & 255)));
      b.drawScaled(S.px, cx, cy, sp.w, sp.h, hex(col, a));
      b.drawScaled(S.disc, cx + sp.w / 2 - (3 + sp.w), cy + sp.h / 2 - (3 + sp.w), (3 + sp.w) * 2, (3 + sp.w) * 2, hex(col, 0.1 + 0.08 * night)); // a small halo
      continue;
    }
    if (!lt) continue;
    const t = tick * 0.21 + (h & 255); // each torch flickers on its own phase
    const flick = 0.85 + 0.15 * Math.sin(t) + 0.08 * Math.sin(t * 2.7);
    const k = lt.a * flick * (0.8 + 0.5 * night);
    glow(b, S, cx, cy, lt.r * (0.95 + 0.05 * flick), 0.8, lt.color, k);
    b.draw(S.flame[((tick >> 2) + h) & 1], cx - 1, cy - 1);
  }
}

/** Which of a layer's `n` variants fills strip `c`: pseudo-random, and never the same as its left neighbor. */
function pickChunk(c: number, salt: number, n: number): number {
  const a = hash(c, salt) % n;
  return a === hash(c - 1, salt) % n ? (a + 1 + (hash(c, salt + 1) % (n - 1))) % n : a;
}

export function drawParallax(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, camXf: number, progress: number, ox: number, oy: number, tick: number): void {
  const tint = shade(mood.tint);
  for (let li = 0; li < biome.layers.length; li++) {
    const layer = biome.layers[li];
    if (layer.sprite === DESTINATION_LAYER) { drawDestination(b, S, biome, mood, camXf, progress, layer.k, ox, oy); continue; }
    const frames = S.layers[layer.sprite];
    const off = Math.floor(camXf * layer.k);
    const y = GROUND_TOP - frames[0].h + (layer.dy ?? 0) + oy;
    // chain 256 px strips, each a different variant, so the same trees and ruins don't repeat along the horizon
    for (let c = Math.floor(off / 256), x = c * 256 - off + ox; x < VIEW_W + 8; c++, x += 256) {
      const v = pickChunk(c, 40 + li * 7, frames.length);
      b.draw(frames[v], x, y, false, tint);
      const lights = (layer.lights || layer.windows) && S.layerLights[layer.sprite]?.[v];
      if (lights) drawLights(b, S, layer, lights, x, y, c, tick, mood.stars);
    }
  }
}

/**
 * The next biome's landmark on the horizon. It starts small and hazed into the sky and, as the level goes on, steps
 * up through larger sizes, clears out of the haze, drifts toward the middle of the screen, and its windows light up.
 * It stands on a low rocky bluff whose foot runs down behind the ground.
 */
function drawDestination(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, camXf: number, progress: number, k: number, ox: number, oy: number): void {
  const d = biome.destination;
  if (!d) return;
  const set = S.landmarks[d.landmark];
  const n = set.body.length;
  const i = Math.min(n - 1, Math.floor(progress * n));
  const body = set.body[i];
  const cx = Math.round(VIEW_W * (d.x0 + (d.x1 - d.x0) * progress) - camXf * k) + ox;
  const x = cx - (body.w >> 1), y = GROUND_TOP - Math.round(d.lift0 + (d.lift1 - d.lift0) * progress) - body.h + oy;
  const clarity = Math.min(1, Math.max(0, progress)); // 0 far and hazy, 1 near and sharp
  const night = mood.stars;
  const haze = 0.62 * (1 - clarity) ** 1.5 + 0.08;
  const horizon = mood.sky[mood.sky.length - 1];
  b.drawScaled(S.disc, cx - body.w, y + body.h * 0.2 - body.w * 0.5, body.w * 2, body.w, hex(d.aura, (0.06 + 0.12 * clarity) * (0.6 + night)));

  // the rocky peak it stands on, hanging from the castle's base and running down behind the ground
  const crag = set.crag[i];
  const cragY = y + body.h - 3; // the wall sinks a little into the rock
  const cragX = cx - (crag.w >> 1);
  b.draw(crag, cragX, cragY, false, shade(mood.tint));
  b.draw(set.cragMask[i], cragX, cragY, false, hex(horizon, haze));

  b.draw(body, x, y, false, shade(mood.tint));
  b.draw(set.glow[i], x, y, false, rgba(255, 255, 255, Math.round(255 * Math.min(1, (0.25 + 0.5 * clarity + night) * clarity + 0.15))));
  b.draw(set.mask[i], x, y, false, hex(horizon, haze));
}

/** Fog gathered at the horizon, in the horizon sky's color, drawn over the parallax layers. */
export function drawHaze(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, oy: number): void {
  const { height, alpha } = biome.haze;
  const col = mood.sky[mood.sky.length - 1];
  const steps = Math.ceil(height / 4);
  for (let i = 0; i < steps; i++) {
    const a = alpha * ((i + 1) / steps) ** 2;
    b.drawScaled(S.px, -8, GROUND_TOP - height + i * 4 + oy, VIEW_W + 16, 4, hex(col, a));
  }
}

/**
 * A paved floor: rows of irregular slabs, staggered like brickwork, all one constant size (characters do not scale with
 * depth, so the floor must not either). Each row is cut into 192 px cells whose slab boundaries come from a hash of
 * (cell, row), shifted per row, so the slabs are anchored to world x and hold still as the camera scrolls. Brightness
 * still falls off toward the horizon as lighting.
 */
function drawFlagstones(b: Batcher, S: Sprites, f: Extract<GroundDef['floor'], { kind: 'flagstones' }>, mood: BlendedMood, camX: number, oy: number): void {
  const CELL = 192, [minW, maxW] = f.slabW;
  let r = 0;
  for (let y = GROUND_TOP; y < VIEW_H; y += f.rowH, r++) {
    const rowH = Math.min(f.rowH, VIEW_H - y);
    const v = depthShade(y + rowH / 2);
    b.drawScaled(S.px, 0, y + oy, VIEW_W, rowH, shade(f.mortar, mood.tint, v));
    const shift = hash(r, 3) % CELL;
    for (let i = Math.floor((camX - shift) / CELL); i * CELL + shift < camX + VIEW_W; i++) {
      let x = 0, k = 0;
      while (x < CELL) {
        const h = hash(i * 31 + k, r + 700);
        let w = minW + (h % (maxW - minW + 1));
        if (CELL - (x + w) < minW) w = CELL - x; // the last slab takes what is left
        const sx = i * CELL + shift + x - camX;
        if (sx < VIEW_W && sx + w > 0) {
          const lum = v * (0.92 + ((h >>> 8) % 17) / 100);
          const x0 = Math.max(0, sx + 1), x1 = Math.min(VIEW_W, sx + w);
          b.drawScaled(S.px, x0, y + oy, x1 - x0, Math.max(1, rowH - 1), shade(f.slabs[(h >>> 4) % f.slabs.length], mood.tint, lum));
          b.drawScaled(S.px, x0, y + oy, x1 - x0, 1, shade(f.lit, mood.tint, lum)); // lit top edge
          if ((h >>> 12) % 11 === 0 && sx + (w >> 1) >= 0 && sx + (w >> 1) < VIEW_W) { // a crack
            b.drawScaled(S.px, sx + (w >> 1), y + 2 + oy, 1, Math.max(1, rowH - 4), shade(0x1c1a26, mood.tint, 1));
          }
        }
        x += w;
        k++;
      }
    }
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A gust moving across the field: a pixel of sway to either side (or none), in step along the ground so it ripples. */
function swayAt(wx: number, tick: number, wind: number): number {
  return wind ? Math.round(wind * 1.4 * Math.sin(tick * 0.05 + wx * 0.04)) : 0;
}

/** The path's center (screen y) at world x: a lazy S-curve across the field. */
function pathY(wx: number): number {
  return FIELD_Y0 + 122 + 38 * Math.sin(wx * 0.0042) + 14 * Math.sin(wx * 0.0113 + 1.3);
}

/** Ground art tinted for its depth: lit by the mood and darker (and a touch cooler) toward the horizon. */
function depthTint(tint: number, y: number): number {
  return shade(0xffffff, tint, depthShade(y), 255, 1 + (1 - groundDepth(y)) * 0.04);
}

/** The floor surface: flat tiles, or a paved floor. */
function drawFloor(b: Batcher, S: Sprites, g: GroundDef, mood: BlendedMood, camX: number, oy: number): void {
  if (g.floor.kind === 'flagstones') { drawFlagstones(b, S, g.floor, mood, camX, oy); return; }
  const tx0 = Math.floor(camX / 16), tx1 = Math.floor((camX + VIEW_W) / 16);
  const rows = Math.ceil((VIEW_H - GROUND_TOP) / 16);
  const tiles = S.groundSets[g.floor.set];
  for (let ty = 0; ty < rows; ty++) {
    const y = GROUND_TOP + ty * 16;
    const tint = depthTint(mood.tint, y + 8);
    for (let tx = tx0; tx <= tx1; tx++) {
      const h = Math.imul(tx, 73856093) ^ Math.imul(ty, 19349663);
      b.draw(tiles[((h >>> 8) & 0xffff) % tiles.length], tx * 16 - camX, y + oy, false, tint);
    }
  }
}

/** Stippled blotches, lighter and darker, over a jittered grid. */
function drawMottle(b: Batcher, S: Sprites, g: GroundDef, mood: BlendedMood, camX: number, oy: number): void {
  const CELL_W = 192, CELL_H = 112;
  const alpha = Math.round(g.mottle.alpha * 255);
  for (let cy = 0; cy < Math.ceil((VIEW_H - GROUND_TOP) / CELL_H) + 1; cy++) {
    for (let cx = Math.floor((camX - 140) / CELL_W); cx <= Math.floor((camX + VIEW_W) / CELL_W); cx++) {
      const h = hash(cx, cy + 40);
      const x = cx * CELL_W + ((h >>> 12) % 60) - camX, y = GROUND_TOP + cy * CELL_H + ((h >>> 18) % 40) + oy;
      b.draw(S.patch['mottle' + ((h >>> 3) & 3)], x, y, (h & 0x10) !== 0, shade(h & 0x100 ? g.mottle.light : g.mottle.dark, mood.tint, 1, alpha));
    }
  }
}

/** The path: a continuous ribbon in 2 px columns aligned to the world, so it holds still as the camera moves. */
function drawPath(b: Batcher, S: Sprites, pa: NonNullable<GroundDef['path']>, mood: BlendedMood, camX: number, oy: number): void {
  for (let wx = Math.floor(camX / 2) * 2; wx < camX + VIEW_W; wx += 2) {
    const c = pathY(wx);
    const half = pa.half + 2 * Math.sin(wx * 0.031) + 1.5 * Math.sin(wx * 0.083 + 2);
    const h = hash(wx >> 1, 31);
    const top = Math.round(c - half) + ((h & 3) === 0 ? 1 : 0), bot = Math.round(c + half) - ((h & 12) === 0 ? 1 : 0);
    const v = depthShade(c);
    const x = wx - camX;
    b.drawScaled(S.px, x, top - 1 + oy, 2, bot - top + 3, shade(pa.edge, mood.tint, v));
    b.drawScaled(S.px, x, top + oy, 2, bot - top + 1, shade(pa.fill, mood.tint, v));
    b.drawScaled(S.px, x, top + oy, 2, 1, shade(pa.lip, mood.tint, v));
    if (pa.ruts !== undefined) { // wheel ruts, in occasional stretches rather than all along the road
      const rut = shade(pa.ruts, mood.tint, v);
      const SEG = 112, seg = Math.floor(wx / SEG), at = wx - seg * SEG;
      for (let side = 0; side < 2; side++) {
        const hs = hash(seg, 71 + side * 7);
        if (hs % 100 >= 38) continue; // this rut is not here in this stretch
        const from = (hs >>> 8) % 40, to = SEG - ((hs >>> 16) % 40); // ragged start and end
        if (at < from || at >= to || (h >>> 5) % 6 === 0) continue; // and the odd gap within it
        const off = 3 + ((hs >>> 24) % 3); // how far from the middle varies stretch to stretch
        b.drawScaled(S.px, x, Math.round(c + (side ? off : -off) + 1.3 * Math.sin(wx * 0.05 + side * 2)) + oy, 2, 1, rut);
      }
    }
    if (pa.fringe && (h >>> 20) % 4 === 0) { // grass fraying the edges
      const g = shade(pa.fringe[(h >>> 4) % pa.fringe.length], mood.tint, v);
      b.drawScaled(S.px, x + (h & 1), top - 2 + oy, 1, 2, g);
      if ((h >>> 12) & 1) b.drawScaled(S.px, x + (h & 1), bot + 1 + oy, 1, 2, g);
    }
    const k = (h >>> 8) % 11; // the odd speck
    if (k < 3) b.drawScaled(S.px, x, top + 2 + ((h >>> 16) % Math.max(1, bot - top - 3)) + oy, k === 0 ? 2 : 1, 1, shade(k < 2 ? pa.speck : pa.speck2, mood.tint, v));
  }
}

/** Patches (mud, puddles, blood...) scattered over a grid, one per cell with some probability, kept clear of the path. */
function drawPatches(b: Batcher, S: Sprites, g: GroundDef, mood: BlendedMood, camX: number, oy: number): void {
  const pc = g.patches;
  for (let cy = 0; cy < Math.ceil((VIEW_H - GROUND_TOP) / (pc.cell * 0.6)) + 1; cy++) {
    for (let cx = Math.floor((camX - 64) / pc.cell); cx <= Math.floor((camX + VIEW_W) / pc.cell); cx++) {
      const h = hash(cx, cy + 90);
      if ((h % 100) / 100 >= pc.chance) continue;
      const f = S.patch[pc.sprites[(h >>> 8) % pc.sprites.length]];
      const wx = cx * pc.cell + ((h >>> 12) % pc.cell), y = GROUND_TOP + 14 + cy * pc.cell * 0.6 + ((h >>> 20) % 30);
      if (g.path && Math.abs(y - pathY(wx)) < 30) continue;
      b.draw(f, wx - camX - (f.w >> 1), Math.round(y) + oy, (h & 0x2000) !== 0, depthTint(mood.tint, y));
    }
  }
}

/** Small flat decals picked from a weighted table, one candidate per cell. Flames flicker; some decals glow. */
function drawDecor(b: Batcher, S: Sprites, g: GroundDef, mood: BlendedMood, camX: number, oy: number, tick: number, wind: number): void {
  const d = g.decor;
  let total = 0;
  for (const k of d.table) total += k.w;
  const rows = Math.ceil((VIEW_H - GROUND_TOP - 8) / d.cellH);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = Math.floor(camX / d.cellW) - 1; cx <= Math.floor((camX + VIEW_W) / d.cellW); cx++) {
      const h = hash(cx, cy + 200);
      if ((h % 1000) / 1000 >= d.density) continue;
      let pick = (((h >>> 10) % 1000) / 1000) * total, kind = d.table[0];
      for (const k of d.table) { pick -= k.w; if (pick < 0) { kind = k; break; } }
      const wx = cx * d.cellW + ((h >>> 4) % d.cellW), y = GROUND_TOP + 8 + cy * d.cellH + ((h >>> 20) % d.cellH);
      if (g.path && !kind.onPath && Math.abs(y - pathY(wx)) < 14) continue;
      const lit = kind.alt !== undefined && ((tick >> 3) + (h & 7)) % 2 === 1; // a flickering flame swaps frames
      const f = S.decor[lit ? kind.alt! : kind.sprite];
      const sway = kind.sway ? swayAt(wx, tick, wind) : 0;
      b.draw(f, wx - camX + sway, y - f.h + oy, (h & 0x4000) !== 0, depthTint(mood.tint, y));
      if (kind.glow) glow(b, S, wx - camX + (f.w >> 1), y - (f.h >> 1) + oy, kind.glow.r + (lit ? 1 : 0), 0.6, kind.glow.color, kind.glow.a * (lit ? 1.25 : 1));
    }
  }
}

/**
 * The floor: its surface, soft mottling, the path and patches, then flat decals. Everything is a function of world
 * position (cosmetic hashes), so it holds still as the camera scrolls.
 */
export function drawGround(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, camX: number, oy: number, tick: number): void {
  const g = biome.ground;
  drawFloor(b, S, g, mood, camX, oy);
  drawMottle(b, S, g, mood, camX, oy);
  if (g.path) drawPath(b, S, g.path, mood, camX, oy);
  drawPatches(b, S, g, mood, camX, oy);
  drawDecor(b, S, g, mood, camX, oy, tick, biome.wind ?? 0);
}

/**
 * Ground fog: dithered wisps that drift slowly along the floor, over the floor and decals but under the characters (so
 * a horde stays readable). Each layer's wisps wrap around a 960 px loop that scrolls with the camera by `k` and slides by
 * `drift` per tick, so they never run out and the fog never seems to follow the camera exactly.
 */
export function drawFog(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, camX: number, oy: number, tick: number, progress: number): void {
  if (!biome.fog) return;
  const LOOP = 960;
  for (const layer of biome.fog) {
    // morning mist thins out and is gone by `until`
    const burn = layer.until === undefined ? 1 : 1 - smoothstep(layer.until - 0.25, layer.until, progress);
    if (burn <= 0.01) continue;
    const tint = shade(layer.color, mood.tint, 1, Math.round(layer.alpha * burn * 255));
    for (let i = 0; i < layer.count; i++) {
      const h = hash(i, Math.round(layer.k * 100) + 300);
      const wisps = layer.big ? S.fogLarge : S.fog;
      const f = wisps[h % wisps.length];
      const base = (i * LOOP) / layer.count + ((h >>> 8) % 60);
      const x = ((((base + tick * layer.drift - camX * layer.k) % LOOP) + LOOP) % LOOP) - (layer.big ? 400 : 224);
      if (x > VIEW_W) continue;
      const y = layer.y0 + ((h >>> 16) % Math.max(1, layer.y1 - layer.y0));
      b.draw(f, Math.round(x), y + oy, (h & 0x100) !== 0, tint);
    }
  }
}

/**
 * Specks carried on the wind (petals, embers, dust), drawn last so they drift over everything. Each speck picks its own
 * heading and speed (plus the biome's gentle prevailing drift), so they wander every which way. Each wraps around a
 * 1280 px loop at its own parallax depth; nearer ones cross the screen faster.
 */
export function drawAmbient(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, camX: number, oy: number, tick: number): void {
  const a = biome.ambient;
  if (!a) return;
  const LOOP = 1280, rangeY = a.y1 - a.y0;
  for (let i = 0; i < a.count; i++) {
    const h = hash(i, 555);
    const k = a.k[0] + (a.k[1] - a.k[0]) * ((h & 255) / 255);
    const ang = (((h >>> 12) & 1023) / 1024) * Math.PI * 2, sp = a.speed * (0.5 + 0.8 * (((h >>> 22) & 255) / 255));
    const vx = Math.cos(ang) * sp + a.bias[0], vy = Math.sin(ang) * sp * 0.6 + a.bias[1]; // flatter than wide: they float, they don't fall
    const wob = Math.sin(tick * 0.04 + (h >>> 8)) * a.wobble;
    const x = ((((h >>> 8) % LOOP) + tick * vx * k - camX * k) % LOOP + LOOP) % LOOP - 320 + wob;
    if (x < -4 || x > VIEW_W) continue;
    const y = a.y0 + ((((h >>> 16) % rangeY) + tick * vy * k + Math.cos(tick * 0.03 + i) * a.wobble * 0.5) % rangeY + rangeY) % rangeY;
    const flip = ((tick >> 4) + i) & 1; // tumbling
    b.drawScaled(S.px, Math.round(x), Math.round(y) + oy, flip ? a.h : a.w, flip ? a.w : a.h, shade(a.colors[(h >>> 4) % a.colors.length], mood.tint, 1, Math.round(a.alpha * 255)));
  }
}

/** The hill's crest: an uneven grassy edge in front of the climbers. */
export function drawCrest(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, camX: number, oy: number): void {
  const fill = shade(biome.crest.fill, mood.tint), edge = shade(biome.crest.edge, mood.tint);
  for (let px = 0; px < VIEW_W; px += 2) {
    const wx = camX + px;
    const bump = Math.round(1.7 * (1 + Math.sin(wx * 0.07) * 0.6 + Math.sin(wx * 0.21) * 0.4));
    if (bump > 0) {
      b.drawScaled(S.px, px, GROUND_TOP - bump + oy, 2, bump + 1, fill);
      b.drawScaled(S.px, px, GROUND_TOP - bump + oy, 2, 1, edge);
    }
  }
}

/** Screen y of the foreground ridge's top edge at world x. */
function ridgeTop(wx: number): number {
  return RIDGE_TOP + Math.round(1.6 * (1 + Math.sin(wx * 0.045) * 0.7 + Math.sin(wx * 0.13) * 0.3));
}

/** The foreground ridge along the bottom of the field: enemies coming from below walk up from behind it. */
export function drawRidge(b: Batcher, S: Sprites, biome: BiomeDef, mood: BlendedMood, camX: number, oy: number, tick: number): void {
  const fill = shade(biome.ridge.fill, mood.tint), edge = shade(biome.ridge.edge, mood.tint), lip = shade(biome.ridge.shade, mood.tint);
  for (let px = 0; px < VIEW_W; px += 2) {
    const top = ridgeTop(camX + px);
    b.drawScaled(S.px, px, top + oy, 2, VIEW_H - top + 8, fill);
    b.drawScaled(S.px, px, top + oy, 2, 1, edge);
    b.drawScaled(S.px, px, top + 1 + oy, 2, 1, lip);
  }
  // blades poking up along the edge, one pixel wide at world positions (so they hold still as the camera moves)
  for (let px = 0; px < VIEW_W; px++) {
    const h = hash(camX + px, 5);
    if (h % 6 !== 0) continue;
    const bh = 2 + ((h >>> 8) % 3), top = ridgeTop(camX + px);
    b.drawScaled(S.px, px, top - bh + 1 + oy, 1, bh - 1, fill);
    b.drawScaled(S.px, px + swayAt(camX + px, tick, biome.wind ?? 0), top - bh + oy, 1, 1, edge); // the tip leans in the wind
  }
}
