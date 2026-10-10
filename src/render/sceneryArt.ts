// Draws a run's generated scenery. Each biome of the world (data/scenery/world.ts) is painted from its recipe: the parallax strips, ground
// tiles, decals and patches its definition names are built by the generators in bgArt.ts and sceneryProps.ts with this biome's own seed
// (so the mountains, tree lines and ruins differ run to run), then recoloured to its tone. The pictures are packed into the atlas's
// scenery band and the sprite tables point at them, like the run's monsters (monsterSprites.ts). Render-only.
import { DESTINATION_LAYER } from '../data/biomes';
import { createRng, rngFloat, type Rng } from '../engine/rng';
import { artFn, type Tone } from '../data/scenery/tone';
import type { GenBiome, Recipe, World } from '../data/scenery/world';
import type { Frame } from '../platform/gl/batcher';
import {
  makeDeadPalms, makeDeadTrees, makeDesertSkyline, makeDunes, makeGround, makeJagged, makeMarshFloor, makeMarshReeds, makeMarshStilts,
  makeMarshTrees, makeMountains, makeRuins, makeSand, makeSnow, makeSnowPeaks, makeSnowPines, makeTrees,
} from './bgArt';
import { packSheets } from './monsterSprites';
import { DECOR_MAKERS, PATCH_MAKERS } from './sceneryProps';
import type { Pix } from './pix';
import type { Sprites } from './art';

type Lights = { x: number; y: number; w?: number; h?: number }[];

/** The seed and dice of one biome's painting: `sd` moves a generator's seed to this biome's, `jit` and `count` vary a size or a number of objects. */
interface Style {
  off: number;
  sd(base: number): number;
  jit(base: number, frac?: number): number;
  count(base: number, frac?: number): number;
}

function styleOf(recipe: Recipe): Style {
  const rng: Rng = createRng(recipe.seed, 90);
  const off = (recipe.seed >>> 3) % 2000;
  return {
    off,
    sd: (base) => base + off,
    jit: (base, frac = 0.25) => base * (1 + (rngFloat(rng) * 2 - 1) * frac),
    count: (base, frac = 0.3) => Math.max(1, Math.round(base * (1 + (rngFloat(rng) * 2 - 1) * frac))),
  };
}

interface LayerMaker {
  /** Variants of the strip (the renderer chains them in a hash order, so the horizon does not visibly repeat). */
  n: number;
  make(v: number, s: Style): Pix;
}

const sandFar = { fill: 0xd2a07c, lit: 0xdcb08c, shade: 0xbe8c6c, edge: 0xe6c4a0, band: 0xc89674 };
const sandMid = { fill: 0xc8794a, lit: 0xd88c58, shade: 0xa85a38, edge: 0xe8a470, band: 0xb86a40 };

/** The parallax strips by key. Every number here is a size or a seed the biome's style moves. */
export const LAYER_MAKERS: Record<string, LayerMaker> = {
  mountFar: { n: 4, make: (v, s) => makeMountains(256, 64, 40, s.jit(20), s.sd(1.3 + v * 1.9), 0x8aa2c4, 0xaabfd9) },
  mountNear: { n: 4, make: (v, s) => makeMountains(256, 44, 28, s.jit(14), s.sd(4.1 + v * 2.3), 0x6c8c84, 0x8aaba0) },
  hills: { n: 4, make: (v, s) => makeMountains(256, 30, 16, s.jit(7), s.sd(7.7 + v * 1.7), 0x5c8a64, 0x7aa87c) },
  treesFar: { n: 5, make: (v, s) => makeTrees(256, 26, s.count(17), s.sd(11 + v * 7), [[0x4a7a68, 0x5c9078], [0x456f64, 0x58887a], [0x507c6a, 0x66947c]]) },
  trees: { n: 6, make: (v, s) => makeTrees(256, 36, s.count(10), s.sd(3 + v * 5), [[0x2c5a3a, 0x3a7048], [0x35603a, 0x4a8048], [0x3a6a2a, 0x5a8a34], [0x24483a, 0x31604a]]) },
  spiresFar: { n: 4, make: (v, s) => makeJagged(256, 70, 50, s.jit(34), s.sd(2.1 + v * 1.7), 0x4a4872, 0x66628c) },
  cragsNear: { n: 4, make: (v, s) => makeJagged(256, 50, 36, s.jit(24), s.sd(5.3 + v * 2.1), 0x3a385c, 0x524e78) },
  ruins: { n: 6, make: (v, s) => makeRuins(256, 46, s.sd(4 + v * 5), 0x1e1c34, 0x3c3860) },
  deadFar: { n: 5, make: (v, s) => makeDeadTrees(256, 30, s.count(13), s.sd(12 + v * 7), [[0x2a2a40, 0x3a3a54], [0x26263a, 0x34344c]]) },
  deadNear: { n: 5, make: (v, s) => makeDeadTrees(256, 40, s.count(7), s.sd(7 + v * 5), [[0x14121e, 0x201c2e], [0x181624, 0x262236]]) },
  peaksFar: { n: 4, make: (v, s) => makeSnowPeaks(256, 76, 52, s.jit(38), s.sd(1.9 + v * 1.7), { snowLit: 0xf4f8ff, snowShade: 0xc4d4ec, rockLit: 0x8aa0c0, rockShade: 0x5a6e92, edge: 0xffffff }) },
  peaksNear: { n: 4, make: (v, s) => makeSnowPeaks(256, 54, 38, s.jit(26), s.sd(5.1 + v * 2.3), { snowLit: 0xe4eefa, snowShade: 0xaec0de, rockLit: 0x6c84a8, rockShade: 0x46587c, edge: 0xf4f8ff }) },
  pinesFar: { n: 5, make: (v, s) => makeSnowPines(256, 28, s.count(16), s.sd(9 + v * 7), { dark: 0x3c5c6c, light: 0x4c7080, snow: 0xe0ecf8, snowShade: 0xb8cce0 }) },
  pinesNear: { n: 6, make: (v, s) => makeSnowPines(256, 38, s.count(10), s.sd(4 + v * 5), { dark: 0x1e4034, light: 0x2c5a48, snow: 0xf4f8ff, snowShade: 0xc0d2e6 }) },
  mrShore: { n: 4, make: (v, s) => makeMountains(256, 44, 28, s.jit(9), s.sd(2.3 + v * 1.9), 0x7a8c78, 0x8a9c86) },
  mrReedFar: { n: 4, make: (v, s) => makeMarshReeds(256, 26, s.sd(3 + v * 7), { dark: 0x62786a, light: 0x74887a, head: 0x5a5648 }) },
  mrStilts: { n: 6, make: (v, s) => makeMarshStilts(256, 48, s.sd(1 + v * 3), { dark: 0x1c2822, light: 0x3c4a34 }) },
  mrCypFar: { n: 5, make: (v, s) => makeMarshTrees(256, 44, s.count(8), s.sd(5 + v * 7), { dark: 0x405448, light: 0x506658, moss: 0x4a5e50 }) },
  mrCypNear: { n: 6, make: (v, s) => makeMarshTrees(256, 56, s.count(6), s.sd(2 + v * 5), { dark: 0x0e1812, light: 0x1c2a20, moss: 0x142018 }) },
  mesasFar: { n: 4, make: (v, s) => makeDesertSkyline(256, 66, 5, s.sd(3 + v * 4), ['mesa', 'mesa', 'butte', 'ziggurat', 'mesa'], sandFar) },
  dunesFar: { n: 4, make: (v, s) => makeDunes(256, 40, 22, s.jit(12), s.sd(1.7 + v * 1.9), { lit: 0xe2bc8e, shade: 0xc9966c, edge: 0xefd0a4, ripple: 0xd8ae82 }) },
  ruinsDune: { n: 5, make: (v, s) => makeDesertSkyline(256, 52, 4, s.sd(11 + v * 5), ['obelisk', 'arch', 'mesa', 'columns', 'obelisk', 'butte'], sandMid) },
  dunesNear: { n: 4, make: (v, s) => makeDunes(256, 32, 18, s.jit(10), s.sd(4.3 + v * 2.2), { lit: 0xdcb47e, shade: 0xbf8d5c, edge: 0xecca96, ripple: 0xd0a46c }) },
  palmsNear: { n: 5, make: (v, s) => makeDeadPalms(256, 52, s.count(6), s.sd(5 + v * 5), { trunk: 0x4a3420, frond: 0x5c4426, dry: 0x7a6034 }) },
};

/** The 16 px floor tile sets by name (six variants each). */
export const GROUND_MAKERS: Record<string, (v: number) => Pix> = {
  grass: makeGround,
  snow: makeSnow,
  marsh: makeMarshFloor,
  sand: makeSand,
};

/** What one biome's painting produced, keyed by the atlas key (`slot:name`). */
export interface Painted {
  layers: Record<string, Pix[]>;
  lights: Record<string, Lights[]>;
  ground: Record<string, Pix[]>;
  decor: Record<string, Pix>;
  patch: Record<string, Pix>;
}

/** Recolours a picture to the tone, in place. */
export function recolor(p: Pix, tone: Tone): Pix {
  const f = artFn(tone), d = p.rgba;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const c = f((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255;
  }
  return p;
}

/** The template name of an atlas key: `3:trees` is `trees`. */
export function baseKey(key: string): string { return key.slice(key.indexOf(':') + 1); }

/** Every sprite the biome's definition names, drawn from its recipe. */
export function paintBiome(g: GenBiome): Painted {
  const { def, recipe } = g;
  const s = styleOf(recipe), tone = recipe.tone;
  const out: Painted = { layers: {}, lights: {}, ground: {}, decor: {}, patch: {} };
  for (const l of def.layers) {
    if (l.sprite === DESTINATION_LAYER) continue;
    const maker = LAYER_MAKERS[baseKey(l.sprite)];
    if (!maker) throw new Error(`scenery: no strip maker for ${l.sprite}`);
    const strips: Pix[] = [], lights: Lights[] = [];
    for (let v = 0; v < maker.n; v++) {
      const p = recolor(maker.make(v, s), tone);
      strips.push(p);
      if (p.lights) lights.push(p.lights);
    }
    out.layers[l.sprite] = strips;
    if (lights.length) out.lights[l.sprite] = lights;
  }
  const gr = def.ground;
  if (gr.floor.kind === 'tiles') {
    const make = GROUND_MAKERS[baseKey(gr.floor.set)];
    if (!make) throw new Error(`scenery: no floor maker for ${gr.floor.set}`);
    out.ground[gr.floor.set] = [0, 1, 2, 3, 4, 5].map((v) => recolor(make(v + s.off * 7), tone));
  }
  for (const k of gr.decor.table) {
    for (const key of [k.sprite, k.alt]) {
      if (key === undefined || out.decor[key]) continue;
      const make = DECOR_MAKERS[baseKey(key)];
      if (!make) throw new Error(`scenery: no decal maker for ${key}`);
      out.decor[key] = recolor(make(s.off), tone);
    }
  }
  for (const key of gr.patches.sprites) {
    if (out.patch[key]) continue;
    const make = PATCH_MAKERS[baseKey(key)];
    if (!make) throw new Error(`scenery: no patch maker for ${key}`);
    out.patch[key] = recolor(make(s.off), tone);
  }
  return out;
}

/** The atlas strip the scenery is drawn into: a run's world is repainted here, over the last run's. */
export interface SceneryBand { x: number; y: number; w: number; h: number }

/** What the renderer must offer: re-upload some rows of the atlas canvas. */
interface AtlasUploader { updateAtlasRows(atlas: HTMLCanvasElement, y: number, h: number): void }

interface Item { key: string; kind: 'layer' | 'ground' | 'decor' | 'patch'; index: number; pix: Pix }

/** Every picture of a painted world, in a fixed order. */
export function itemsOf(painted: readonly Painted[]): Item[] {
  const items: Item[] = [];
  for (const p of painted) {
    for (const [k, list] of Object.entries(p.layers)) list.forEach((pix, i) => items.push({ key: k, kind: 'layer', index: i, pix }));
    for (const [k, list] of Object.entries(p.ground)) list.forEach((pix, i) => items.push({ key: k, kind: 'ground', index: i, pix }));
    for (const [k, pix] of Object.entries(p.decor)) items.push({ key: k, kind: 'decor', index: 0, pix });
    for (const [k, pix] of Object.entries(p.patch)) items.push({ key: k, kind: 'patch', index: 0, pix });
  }
  return items;
}

/** Paints the whole world. */
export function paintWorld(world: World): Painted[] {
  return world.biomes.map(paintBiome);
}

/** Draws the world's scenery into the atlas and makes it the art in play. */
export function installSceneryArt(S: Sprites, up: AtlasUploader, world: World): void {
  const painted = paintWorld(world);
  const items = itemsOf(painted);
  const band = S.sceneryBand;
  const places = packSheets(items.map((i) => ({ width: i.pix.w, height: i.pix.h })), band.w, band.h);
  if (!places) throw new Error(`The scenery does not fit the atlas band (${items.reduce((a, i) => a + i.pix.w * i.pix.h, 0)} px for ${band.w}x${band.h}).`);
  const ctx = S.atlas.getContext('2d')!;
  ctx.clearRect(band.x, band.y, band.w, band.h);
  const W = S.atlas.width, H = S.atlas.height;
  const layers: Record<string, Frame[]> = {}, ground: Record<string, Frame[]> = {}, decor: Record<string, Frame> = {}, patch: Record<string, Frame> = {};
  for (const k of Object.keys(S.patch)) if (!k.includes(':')) patch[k] = S.patch[k]; // the static mottles stay
  items.forEach((it, n) => {
    const x = band.x + places[n].x, y = band.y + places[n].y;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(it.pix.rgba), it.pix.w, it.pix.h), x, y);
    const f: Frame = { u0: x / W, v0: y / H, u1: (x + it.pix.w) / W, v1: (y + it.pix.h) / H, w: it.pix.w, h: it.pix.h };
    if (it.kind === 'layer') (layers[it.key] ??= [])[it.index] = f;
    else if (it.kind === 'ground') (ground[it.key] ??= [])[it.index] = f;
    else if (it.kind === 'decor') decor[it.key] = f;
    else patch[it.key] = f;
  });
  S.layers = layers; S.groundSets = ground; S.decor = decor; S.patch = patch;
  S.layerLights = Object.assign({}, ...painted.map((p) => p.lights));
  up.updateAtlasRows(S.atlas, band.y, band.h);
}
