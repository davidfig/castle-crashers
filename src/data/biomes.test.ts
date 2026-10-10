import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DECOR_MAKERS, PATCH_MAKERS } from '../render/sceneryProps';
import { GROUND_MAKERS, LAYER_MAKERS } from '../render/sceneryArt';
import { ALL_SCENERY, BIOMES, DAY_LEVELS, DESTINATION_LAYER, dayPhase, makeBlendedMood, moodAt } from './biomes';

test('mood: every biome is bright by day, dark and starry by night, and passes through in between', () => {
  const m = makeBlendedMood();
  for (const biome of ALL_SCENERY) {
    moodAt(biome, 0.28, m);
    assert.deepEqual(m.sky, [...biome.palette.day.sky], biome.name);
    assert.equal(m.stars, biome.palette.day.stars);
    moodAt(biome, 0.8, m);
    assert.deepEqual(m.sky, [...biome.palette.night.sky], biome.name);
    assert.equal(m.stars, biome.palette.night.stars);
    moodAt(biome, 0.47, m);
    assert.notDeepEqual(m.sky, [...biome.palette.day.sky]);
    assert.notDeepEqual(m.sky, [...biome.palette.dusk.sky]);
  }
});

test('the sun sets and the moon rises on the clock, the same in every biome, and the day runs on across levels', () => {
  const m = makeBlendedMood(), o = makeBlendedMood();
  moodAt(BIOMES[0], 0.28, m);
  assert.ok(m.sunY < 50 && m.moonY > 136);
  moodAt(BIOMES[0], 0.52, m);
  assert.ok(m.sunY > 90 && m.sunY < 136, 'the sun is low');
  assert.ok(m.moonY > 100, 'the moon is just coming up');
  moodAt(BIOMES[0], 0.78, m);
  assert.ok(m.sunY > 136 && m.moonY < 50);
  moodAt(BIOMES[0], 0.4, m); moodAt(BIOMES[3], 0.4, o);
  assert.equal(m.sunY, o.sunY); assert.equal(m.moonY, o.moonY);
  assert.ok(Math.abs(dayPhase(DAY_LEVELS) - dayPhase(0)) < 1e-9);
  assert.notEqual(dayPhase(0), dayPhase(1));
});

test('every parallax layer names a sprite the art builds', () => {
  const known = Object.keys(LAYER_MAKERS);
  for (const biome of ALL_SCENERY) for (const l of biome.layers) assert.ok(l.sprite === DESTINATION_LAYER || known.includes(l.sprite), l.sprite);
});

test('every biome names ground tiles and decor sprites the art builds', () => {
  const tiles = Object.keys(GROUND_MAKERS), decor = Object.keys(DECOR_MAKERS), patches = Object.keys(PATCH_MAKERS);
  for (const biome of ALL_SCENERY) {
    if (biome.ground.floor.kind === 'tiles') assert.ok(tiles.includes(biome.ground.floor.set), biome.name);
    for (const k of biome.ground.decor.table) {
      assert.ok(decor.includes(k.sprite), k.sprite);
      if (k.alt) assert.ok(decor.includes(k.alt), k.alt);
    }
    for (const k of biome.ground.patches.sprites) assert.ok(patches.includes(k), k);
  }
});

test('every biome has all four looks with the same number of sky bands', () => {
  for (const biome of ALL_SCENERY) {
    const p = biome.palette;
    for (const look of [p.dawn, p.dusk, p.night]) assert.equal(look.sky.length, p.day.sky.length, biome.name);
  }
});
