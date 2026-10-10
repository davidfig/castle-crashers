import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_SCENERY } from '../data/biomes';
import { frontLevel, planSky, stormCoverAt, weatherAt, type Active } from '../data/scenery/sky';
import { ROAD_STRIDE } from './scenery';
import { strikeAt, type Strike } from './weather';

const STAGE = 3 * ROAD_STRIDE;
const defs = ALL_SCENERY;

test('fronts are laid along the road from the seed alone, each building up and fading out, never starting the run in a storm', () => {
  for (let seed = 0; seed < 60; seed++) {
    const a = planSky(seed, defs, STAGE), b = planSky(seed, defs, STAGE);
    assert.deepEqual(a, b);
    assert.ok(a.fronts.length >= 5, 'a run has weather');
    for (const f of a.fronts) {
      assert.ok(f.from >= 900 && f.to > f.from + 1000, `${f.kind} ${f.from}..${f.to}`);
      assert.equal(frontLevel(f, f.from), 0);
      assert.equal(frontLevel(f, f.to), 0);
      let top = 0;
      for (let x = f.from; x <= f.to; x += 50) { const l = frontLevel(f, x); assert.ok(l >= 0 && l <= 1); top = Math.max(top, l); }
      assert.ok(top > 0.2, 'it blows');
    }
  }
  assert.notDeepEqual(planSky(1, defs, STAGE), planSky(2, defs, STAGE));
});

test('about half the road is under weather, in several kinds, and it comes and goes unevenly', () => {
  const out: Active[] = [];
  const kinds = new Set<string>();
  let wet = 0, total = 0;
  for (let seed = 0; seed < 40; seed++) {
    const sky = planSky(seed, defs, STAGE);
    for (let x = 0; x < 5 * STAGE; x += 120) { total++; const n = weatherAt(sky, x, out); if (n > 0) wet++; for (let i = 0; i < n; i++) kinds.add(out[i].kind); }
  }
  assert.ok(wet / total > 0.3 && wet / total < 0.75, `${wet / total} of the road is under weather`);
  for (const k of ['rain', 'snow', 'fog', 'sandstorm', 'lightning']) assert.ok(kinds.has(k), `no ${k} anywhere`);
});

test('weather is not tied to levels or biomes: fronts begin all over a level, and many run across a boundary between biomes', () => {
  const at = new Set<number>();
  let across = 0, fronts = 0;
  for (let seed = 0; seed < 60; seed++) {
    for (const f of planSky(seed, defs, STAGE).fronts) {
      fronts++;
      at.add(Math.floor(((f.from % ROAD_STRIDE) / ROAD_STRIDE) * 5));
      if (Math.floor(f.from / STAGE) !== Math.floor(f.to / STAGE)) across++;
    }
  }
  assert.equal(at.size, 5, 'fronts start at every fifth of a level');
  assert.ok(across / fronts > 0.2, `only ${across} of ${fronts} fronts cross into the next biome`);
});

test('snow and sand follow the places they belong to, but can drift into a neighbour', () => {
  const home = { snow: [0, 0], sandstorm: [0, 0] } as Record<string, number[]>;
  for (let seed = 0; seed < 200; seed++) {
    for (const f of planSky(seed, defs, STAGE).fronts) {
      const stage = Math.min(4, Math.floor((f.from + f.to) / 2 / STAGE));
      if (f.kind === 'snow') home.snow[stage === 2 ? 0 : 1]++;
      if (f.kind === 'sandstorm') home.sandstorm[stage === 4 ? 0 : 1]++;
    }
  }
  assert.ok(home.snow[0] > home.snow[1], 'most snow falls in the pass');
  assert.ok(home.snow[1] > 0, 'but some drifts elsewhere');
  assert.ok(home.sandstorm[0] > home.sandstorm[1], 'most sandstorms blow in the dunes');
});

test('the cloud cover rolls in ahead of the rain and only rain brings it', () => {
  const sky = { fronts: [{ kind: 'rain' as const, from: 2000, to: 6000, peak: 1, wind: 0, swing: 0, seed: 1 }, { kind: 'snow' as const, from: 8000, to: 12000, peak: 1, wind: 0, swing: 0, seed: 2 }] };
  const s: Active[] = [];
  assert.equal(stormCoverAt(sky, 500, s), 0);
  assert.ok(stormCoverAt(sky, 1900, s) > 0, 'clouds before the first drop');
  assert.ok(stormCoverAt(sky, 4000, s) > 0.9);
  assert.ok(stormCoverAt(sky, 6200, s) > 0, 'and lingering after');
  assert.equal(stormCoverAt(sky, 10000, s), 0, 'snow brings no rain cloud');
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

test('a front can be steady or surge and ebb, and two kinds can blow at once', () => {
  const rain = { kind: 'rain' as const, from: 0, to: 20000, peak: 1, wind: 0, swing: 0.8, seed: 5 };
  const levels = Array.from({ length: 100 }, (_, i) => frontLevel(rain, 3000 + i * 100));
  assert.ok(Math.max(...levels) > 0.8 && Math.min(...levels) < 0.5, 'swells and ebbs');
  const out: Active[] = [];
  assert.equal(weatherAt({ fronts: [rain, { ...rain, kind: 'fog' as const, seed: 6 }] }, 10000, out), 2);
  assert.equal(weatherAt({ fronts: [rain, { ...rain, seed: 6 }] }, 10000, out), 1, 'one entry per kind');
});
