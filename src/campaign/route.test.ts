import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOME_COUNT, biomeIndex } from '../data/roster';
import { levelPlan, levelSeed, LEVELS_PER_BIOME, ROUTE_LEVELS, stageBiome } from './route';

test('the route is straight: LEVELS_PER_BIOME levels in each biome in turn, a boss ending each biome', () => {
  assert.equal(ROUTE_LEVELS, BIOME_COUNT * LEVELS_PER_BIOME);
  for (const run of [1, 77, 123456]) {
    const plans = Array.from({ length: ROUTE_LEVELS }, (_, k) => levelPlan(run, k, ROUTE_LEVELS));
    plans.forEach((p, k) => {
      assert.equal(p.biome, Math.floor(k / LEVELS_PER_BIOME), `level ${k} of run ${run}`);
      assert.equal(p.biome, biomeIndex(p.seed));
      assert.equal(p.boss, k % LEVELS_PER_BIOME === LEVELS_PER_BIOME - 1);
      assert.equal(p.chapter, p.biome + 1);
    });
    assert.equal(new Set(plans.map((p) => p.seed)).size, ROUTE_LEVELS, 'every level has its own seed');
  }
});

test('a route is a function of its seed, and a later level of a biome is a bigger horde', () => {
  assert.deepEqual(levelPlan(5, 4, ROUTE_LEVELS), levelPlan(5, 4, ROUTE_LEVELS));
  assert.notEqual(levelSeed(1234, 1), levelSeed(1234, 2));
  const scales = Array.from({ length: LEVELS_PER_BIOME }, (_, k) => levelPlan(9, k, ROUTE_LEVELS).scale);
  assert.equal(scales[0], 1);
  assert.ok(scales.every((s, k) => k === 0 || s > scales[k - 1]));
  assert.equal(stageBiome(ROUTE_LEVELS), 0, 'past the last biome the road wraps');
});

test('a one-level dev run keeps its seed and always ends in a boss', () => {
  const p = levelPlan(4242, 0, 1);
  assert.equal(p.seed, 4242);
  assert.equal(p.boss, true);
  assert.equal(p.scale, 1);
});
