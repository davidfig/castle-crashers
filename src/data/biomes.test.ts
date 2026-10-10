import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_SCENERY, BIOMES, blendMoods, DAY_LEVELS, DESTINATION_LAYER, dayPhase, makeBlendedMood, moodAt, pickBiome, TRANSITION_FROM, transitionAt } from './biomes';

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

test('pickBiome is a pure function of the seed', () => {
  for (let s = 0; s < 50; s++) assert.equal(pickBiome(s), pickBiome(s));
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

test('every biome has all four looks with the same number of sky bands', () => {
  for (const biome of ALL_SCENERY) {
    const p = biome.palette;
    for (const look of [p.dawn, p.dusk, p.night]) assert.equal(look.sky.length, p.day.sky.length, biome.name);
  }
});

test('the turn to the next biome starts late in a level, eases in, and is complete at the end', () => {
  assert.equal(transitionAt(0), 0);
  assert.equal(transitionAt(TRANSITION_FROM), 0);
  assert.equal(transitionAt(1), 1);
  let prev = 0;
  for (let p = TRANSITION_FROM; p <= 1; p += 0.02) { const t = transitionAt(p); assert.ok(t >= prev); prev = t; }
});

test('blending moods lands on each end, even with different band counts', () => {
  const a = makeBlendedMood(), b = makeBlendedMood(), out = makeBlendedMood();
  for (const from of BIOMES) for (const to of BIOMES) {
    moodAt(from, 1, a); moodAt(to, 0, b);
    blendMoods(a, b, 0, out);
    assert.deepEqual(out.sky, a.sky); assert.equal(out.tint, a.tint);
    blendMoods(a, b, 1, out);
    assert.equal(out.sky.length, a.sky.length);
    assert.equal(out.sky[0], b.sky[0]); assert.equal(out.sky[out.sky.length - 1], b.sky[b.sky.length - 1]);
    assert.equal(out.tint, b.tint);
  }
});
