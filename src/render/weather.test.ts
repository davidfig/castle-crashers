import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_SCENERY, WEATHER_END, weatherLevel, type WeatherDef } from '../data/biomes';
import { LEVELS_PER_BIOME, ROUTE_LEVELS, weatherSpan } from '../campaign/route';
import { strikeAt, type Strike } from './weather';

test('weatherLevel follows the authored curve, then is shaped by surges and ends clear', () => {
  const w: WeatherDef = { kind: 'rain', curve: [[0.2, 0], [0.6, 1]], swing: 0 }; // swing 0: no random lulls
  assert.equal(weatherLevel(w, 0.2, 1), 0);
  assert.ok(Math.abs(weatherLevel(w, 0.4, 1) - 0.5) < 1e-9);
  assert.equal(weatherLevel({ kind: 'fog', swing: 0 }, 0.5, 1), 1);
  for (let seed = 0; seed < 20; seed++) {
    assert.equal(weatherLevel({ kind: 'snow' }, 0, seed), 0, 'eases in from clear');
    assert.equal(weatherLevel({ kind: 'snow' }, WEATHER_END, seed), 0, 'gone before the next biome');
    assert.equal(weatherLevel({ kind: 'snow' }, 1, seed), 0);
  }
});

test('weather surges and lulls at different points on different seeds, identically every time', () => {
  const w: WeatherDef = { kind: 'rain' };
  const curve = (seed: number) => Array.from({ length: 80 }, (_, i) => weatherLevel(w, 0.05 + i * 0.01, seed));
  assert.deepEqual(curve(7), curve(7));
  assert.notDeepEqual(curve(7), curve(8));
  for (let seed = 0; seed < 10; seed++) {
    const c = curve(seed);
    assert.ok(Math.max(...c) > 0.8, 'swells');
    assert.ok(Math.min(...c) < 0.5, 'ebbs');
    assert.ok(c.every((v) => v >= 0 && v <= 1));
  }
});

test('every biome weather curve is sorted and within 0..1', () => {
  for (const biome of ALL_SCENERY) for (const w of biome.weather ?? []) {
    let last = -1;
    for (const [at, level] of w.curve ?? []) {
      assert.ok(at >= last && level >= 0 && level <= 1, `${biome.name} ${w.kind}`);
      last = at;
    }
  }
});

test('lightning is a pure function of the tick, absent at zero strength, and frequent at full strength', () => {
  const a: Strike = { age: 0, flash: 0, seed: 0 }, b: Strike = { age: 0, flash: 0, seed: 0 };
  let strikes = 0;
  for (let t = 0; t < 240 * 40; t++) {
    assert.equal(strikeAt(t, 0, a), null);
    const x = strikeAt(t, 1, a);
    const y = strikeAt(t, 1, b);
    assert.equal(x === null, y === null);
    if (x) { assert.deepEqual(x, y); assert.ok(x.flash >= 0 && x.flash <= 1); if (x.age === 0) strikes++; }
  }
  assert.ok(strikes > 10 && strikes <= 40, String(strikes));
});

test("a biome's levels share one weather span, laid end to end, and the next biome starts a fresh one", () => {
  const run = 12345;
  for (let g = 0; g < ROUTE_LEVELS / LEVELS_PER_BIOME; g++) {
    const spans = Array.from({ length: LEVELS_PER_BIOME }, (_, k) => weatherSpan(run, g * LEVELS_PER_BIOME + k, ROUTE_LEVELS));
    for (let k = 0; k < spans.length; k++) {
      assert.equal(spans[k].seed, spans[0].seed);
      assert.equal(spans[k].levels, LEVELS_PER_BIOME);
      if (k > 0) assert.equal(spans[k].from, spans[k - 1].to);
    }
    assert.equal(spans[0].from, 0);
    assert.equal(spans[spans.length - 1].to, 1);
    if (g > 0) assert.notEqual(spans[0].seed, weatherSpan(run, (g - 1) * LEVELS_PER_BIOME, ROUTE_LEVELS).seed);
  }
  assert.deepEqual(weatherSpan(run, 0, 1), { seed: weatherSpan(run, 0, 1).seed, from: 0, to: 1, levels: 1 });
});

test('weather carries over a mid-biome level boundary and clears only at the end of the biome', () => {
  const w: WeatherDef = { kind: 'rain', swing: 0 }; // steady, so only the fades show
  const a = weatherSpan(9, 0, ROUTE_LEVELS), b = weatherSpan(9, 1, ROUTE_LEVELS), c = weatherSpan(9, 2, ROUTE_LEVELS);
  assert.ok(weatherLevel(w, a.to, a.seed, a.levels) > 0.9, 'still raining as the first level ends');
  assert.equal(weatherLevel(w, a.to, a.seed, a.levels), weatherLevel(w, b.from, b.seed, b.levels));
  assert.ok(weatherLevel(w, c.to, c.seed, c.levels) === 0, 'clear at the end of the last level');
});
