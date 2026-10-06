import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_SCENERY, BIOMES, DESTINATION_LAYER, makeBlendedMood, moodAt, pickBiome } from './biomes';

test('mood: first keyframe before the start, last after the end, blended in between', () => {
  const biome = BIOMES[0];
  const first = biome.timeline[0], last = biome.timeline[biome.timeline.length - 1];
  const m = makeBlendedMood();
  moodAt(biome, 0, m);
  assert.deepEqual(m.sky, [...first.sky]);
  assert.equal(m.tint, first.tint);
  moodAt(biome, 1, m);
  assert.deepEqual(m.sky, [...last.sky]);
  assert.equal(m.tint, last.tint);
  assert.equal(m.stars, last.stars);
  assert.equal(m.moonY, last.moonY);
  const mid = (biome.timeline[2].at + biome.timeline[3].at) / 2;
  moodAt(biome, mid, m);
  assert.notDeepEqual(m.sky, [...biome.timeline[2].sky]);
  assert.notDeepEqual(m.sky, [...last.sky]);
});

test('pickBiome is a pure function of the seed', () => {
  for (let s = 0; s < 50; s++) assert.equal(pickBiome(s), pickBiome(s));
});

test('the sun sets and the moon rises over the level', () => {
  const m = makeBlendedMood();
  moodAt(BIOMES[0], 0, m);
  const sun0 = m.sunY, moon0 = m.moonY;
  moodAt(BIOMES[0], 1, m);
  assert.ok(m.sunY > sun0);
  assert.ok(m.moonY < moon0);
});

test('every parallax layer names a sprite the art builds', () => {
  const known = ['mountFar', 'mountNear', 'hills', 'treesFar', 'trees', 'spiresFar', 'cragsNear', 'ruins', 'deadFar', 'deadNear', 'peaksFar', 'peaksNear', 'pinesFar', 'pinesNear', 'mesasFar', 'dunesFar', 'ruinsDune', 'dunesNear', 'palmsNear', 'mrShore', 'mrReedFar', 'mrStilts', 'mrCypFar', 'mrCypNear'];
  for (const biome of ALL_SCENERY) for (const l of biome.layers) assert.ok(l.sprite === DESTINATION_LAYER || known.includes(l.sprite), l.sprite);
});

test('every biome names ground tiles and decor sprites the art builds', () => {
  const tiles = ['grass', 'snow', 'sand', 'marsh'];
  const decor = ['tuft0', 'tuft1', 'tuft2', 'flowerW', 'flowerY', 'flowerP', 'flowerB', 'pebble', 'rock', 'mushroom', 'iceshard0', 'iceshard1', 'snowrock', 'snowmound', 'twigsS', 'sapling', 'tracks', 'deadshrub', 'clover', 'wheat', 'bush', 'daisies', 'twig', 'stump', 'mossrock', 'bone0', 'bone1', 'skull', 'rubble0', 'rubble1', 'weeds0', 'weeds1', 'moss0', 'crack0', 'candle0', 'candle1', 'glowcap', 'brazier0', 'brazier1', 'cactus', 'cactusBloom', 'cactusBarrel', 'scrubDry', 'scrubTuft', 'tumbleweed', 'skullBleached', 'ribcage', 'sherd', 'sandrock', 'statuehead', 'flagstake', 'camelbones', 'sandpebble', 'mrGrass0', 'mrGrass1', 'mrCattail0', 'mrCattail1', 'mrReeds0', 'mrReeds1', 'mrLily', 'mrLilies', 'mrMoss', 'mrLog', 'mrStump', 'mrFrog', 'mrSkull', 'mrRibs', 'mrBone', 'mrFlowerP', 'mrFlowerW', 'mrShroom', 'mrGlow', 'mrHelm'];
  const patches = ['snowshadow', 'snowshadow2', 'ice0', 'ice1', 'wildflowers', 'wildflowers2', 'clover', 'puddle1', 'blood0', 'blood1', 'rubble', 'moss', 'sandripple', 'sandripple2', 'sandripple3', 'drypatch', 'mrWater0', 'mrWater1', 'mrWater2', 'mrLily0', 'mrLily1', 'mrScum', 'mrScum2', 'mrMud'];
  for (const biome of ALL_SCENERY) {
    if (biome.ground.floor.kind === 'tiles') assert.ok(tiles.includes(biome.ground.floor.set), biome.name);
    for (const k of biome.ground.decor.table) {
      assert.ok(decor.includes(k.sprite), k.sprite);
      if (k.alt) assert.ok(decor.includes(k.alt), k.alt);
    }
    for (const k of biome.ground.patches.sprites) assert.ok(patches.includes(k), k);
  }
});

test('every biome has a sorted timeline and a destination that exists', () => {
  for (const biome of ALL_SCENERY) {
    for (let i = 1; i < biome.timeline.length; i++) assert.ok(biome.timeline[i].at > biome.timeline[i - 1].at, biome.name);
    assert.equal(biome.timeline[0].sky.length, biome.timeline[biome.timeline.length - 1].sky.length);
  }
});
