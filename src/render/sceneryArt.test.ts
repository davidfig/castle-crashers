import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOMES, DESTINATION_LAYER } from '../data/biomes';
import { generateWorld } from '../data/scenery/world';
import { SCENERY_BAND_H } from './art';
import { itemsOf, paintWorld, baseKey, LAYER_MAKERS } from './sceneryArt';
import { packSheets } from './monsterSprites';
import { ROAD_STRIDE, Scenery } from './scenery';
import { drawAmbient, drawCrest, drawFog, drawGround, drawHaze, drawParallax, drawRidge, drawSky } from './background';
import { moodAt } from '../data/biomes';
import type { Sprites } from './art';
import type { Batcher, Frame } from '../platform/gl/batcher';

const STAGE = 3 * ROAD_STRIDE;
const ALL = [0, 1, 2, 3, 4];

test('every generated biome is painted: all the sprites its definition names exist, and no others are left over', () => {
  for (const seed of [1, 2, 3]) {
    const world = generateWorld(seed, ALL, STAGE);
    const painted = paintWorld(world);
    world.biomes.forEach((g, k) => {
      const p = painted[k], d = g.def;
      for (const l of d.layers) if (l.sprite !== DESTINATION_LAYER) assert.ok(p.layers[l.sprite]?.length, `${d.name}: strip ${l.sprite}`);
      if (d.ground.floor.kind === 'tiles') assert.equal(p.ground[d.ground.floor.set]?.length, 6, `${d.name}: floor`);
      for (const t of d.ground.decor.table) {
        assert.ok(p.decor[t.sprite], `${d.name}: decal ${t.sprite}`);
        if (t.alt) assert.ok(p.decor[t.alt], `${d.name}: decal ${t.alt}`);
      }
      for (const s of d.ground.patches.sprites) assert.ok(p.patch[s], `${d.name}: patch ${s}`);
      assert.equal(Object.keys(p.layers).length, d.layers.filter((l) => l.sprite !== DESTINATION_LAYER).length);
    });
  }
});

test('a whole world of five biomes fits the atlas band, with room to spare', () => {
  for (const seed of [1, 7, 99, 12345]) {
    const items = itemsOf(paintWorld(generateWorld(seed, ALL, STAGE)));
    const px = items.reduce((a, i) => a + i.pix.w * i.pix.h, 0);
    const places = packSheets(items.map((i) => ({ width: i.pix.w, height: i.pix.h })), 2048, SCENERY_BAND_H);
    assert.ok(places, `seed ${seed}: ${px} px do not fit 2048x${SCENERY_BAND_H}`);
    assert.ok(px < 2048 * SCENERY_BAND_H * 0.8, `seed ${seed}: ${px} px leaves no room`);
  }
});

test('painting is a pure function of the world: same seed, same pixels; another seed, other pixels', () => {
  const a = paintWorld(generateWorld(5, ALL, STAGE)), b = paintWorld(generateWorld(5, ALL, STAGE)), c = paintWorld(generateWorld(6, ALL, STAGE));
  const flat = (p: ReturnType<typeof paintWorld>): string => itemsOf(p).map((i) => i.key + i.pix.rgba.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 7)).join('|');
  assert.equal(flat(a), flat(b));
  assert.notEqual(flat(a), flat(c));
});

test('the skyline differs between runs of the same archetype, not only its colour', () => {
  const strip = (seed: number): Uint8ClampedArray => paintWorld(generateWorld(seed, [0], STAGE))[0].layers['0:mountFar'][0].rgba;
  const alpha = (d: Uint8ClampedArray): number[] => Array.from(d).filter((_, i) => i % 4 === 3);
  assert.notDeepEqual(alpha(strip(1)), alpha(strip(2)));
});

test('every strip maker is used by some archetype, and every archetype strip has a maker', () => {
  const used = new Set<string>();
  for (const b of BIOMES) for (const l of b.layers) if (l.sprite !== DESTINATION_LAYER) { used.add(l.sprite); assert.ok(LAYER_MAKERS[baseKey(l.sprite)], l.sprite); }
  for (const k of Object.keys(LAYER_MAKERS)) assert.ok(used.has(k), `${k} is never used`);
});

/** Frames shaped like the painter's pictures, so the whole drawing code can run without a GL context. */
function fakeSprites(world: ReturnType<typeof generateWorld>): Sprites {
  const fr = (w = 16, h = 16): Frame => ({ u0: 0, v0: 0, u1: 1, v1: 1, w, h });
  const S = {
    px: fr(1, 1), dither: [fr(256, 2), fr(256, 2), fr(256, 2)], disc: fr(32, 32), moon: fr(20, 20), clouds: [fr(30, 11), fr(44, 14), fr(22, 9)],
    fog: [fr(192, 32)], fogLarge: [fr(352, 52)], flame: [fr(3, 4)],
    landmarks: { keep: { body: Array(8).fill(fr(40, 40)), glow: Array(8).fill(fr(40, 40)), mask: Array(8).fill(fr(40, 40)), crag: Array(8).fill(fr(40, 40)), cragMask: Array(8).fill(fr(40, 40)) } },
    layers: {} as Record<string, Frame[]>, groundSets: {} as Record<string, Frame[]>, decor: {} as Record<string, Frame>, patch: { mottle0: fr(), mottle1: fr(), mottle2: fr(), mottle3: fr() } as Record<string, Frame>, layerLights: {} as Record<string, unknown>,
  };
  for (const p of paintWorld(world)) {
    for (const [k, v] of Object.entries(p.layers)) S.layers[k] = v.map((x) => fr(x.w, x.h));
    for (const [k, v] of Object.entries(p.ground)) S.groundSets[k] = v.map((x) => fr(x.w, x.h));
    for (const [k, v] of Object.entries(p.decor)) S.decor[k] = fr(v.w, v.h);
    for (const [k, v] of Object.entries(p.patch)) S.patch[k] = fr(v.w, v.h);
    Object.assign(S.layerLights, p.lights);
  }
  return S as unknown as Sprites;
}

test('every stretch of the road draws: each sprite a frame asks for exists, and a frame stays within the draw budget', () => {
  for (const seed of [1, 2]) {
    const world = generateWorld(seed, ALL, STAGE), S = fakeSprites(world), sc = new Scenery();
    let calls = 0, worst = 0;
    const b = new Proxy({}, { get: () => () => { calls++; } }) as unknown as Batcher;
    for (let x = -700; x < 5 * STAGE; x += 173) {
      sc.setRoad(world, x + 320);
      sc.prog[0] = (x / 97) % 1; sc.prog[1] = -1;
      for (let i = 0; i < sc.n; i++) moodAt(sc.biome[i], ((x / STAGE) * 0.4 + 0.05) % 1, sc.mood[i]);
      calls = 0;
      drawSky(b, S, sc, x, x & 255, 0, 0); drawParallax(b, S, sc, x, 0, 0, x & 255); drawHaze(b, S, sc, x, 0);
      drawGround(b, S, sc, x, 0, x & 255); drawCrest(b, S, sc, x, 0); drawFog(b, S, sc, x, 0, x & 255); drawRidge(b, S, sc, x, 0, x & 255); drawAmbient(b, S, sc, x, 0, x & 255);
      worst = Math.max(worst, calls);
    }
    assert.ok(worst < 16000, `seed ${seed}: ${worst} draws in one frame`);
  }
});
