import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOMES, DESTINATION_LAYER, moodAt, makeBlendedMood } from '../biomes';
import { FADE_PX, ROAD_STRIDE, Scenery } from '../../render/scenery';
import { MIN_PLATEAU, planRoad, profile, profileSlope, spanIndexAt } from './road';
import { artFn, bandWeight, hslToRgb, rgbToHsl, skyFn, toneArt, toneSky, NO_TONE } from './tone';
import { biomeName, generateWorld, rollTone, slotKey } from './world';
import { createRng } from '../../engine/rng';

const STAGE = 3 * ROAD_STRIDE;
const ALL = [0, 1, 2, 3, 4];

test('colour: hsl round-trips, greys are left alone, and only the band turns', () => {
  for (const c of [0x3f7a33, 0xff8040, 0x102030, 0xffffff, 0x000000, 0x808080]) {
    const [h, s, l] = rgbToHsl(c);
    const back = hslToRgb(h, s, l);
    for (const sh of [16, 8, 0]) assert.ok(Math.abs(((c >> sh) & 255) - ((back >> sh) & 255)) <= 1, c.toString(16));
  }
  const t = { band: 0.3, width: 0.15, hue: -0.1, skyHue: 0.05, sat: 1, light: 1 };
  assert.equal(toneArt(0x808080, t), 0x808080);
  assert.equal(toneArt(0xffffff, t), 0xffffff);
  const blue = 0x4a7fb5; // a sky blue, hue ~0.58, far outside a green band
  assert.equal(toneArt(blue, t), blue);
  const [hg] = rgbToHsl(toneArt(0x3f7a33, t)), [h0] = rgbToHsl(0x3f7a33);
  assert.ok(Math.abs(hg - (h0 - 0.1)) < 0.02, 'a green turns by the band hue');
  const [hs] = rgbToHsl(toneSky(blue, t)), [hb] = rgbToHsl(blue);
  assert.ok(Math.abs(hs - (hb + 0.05)) < 0.02, 'a sky colour turns by the sky hue');
  assert.equal(toneArt(0x3f7a33, NO_TONE), toneArt(0x3f7a33, NO_TONE));
  assert.equal(bandWeight(0.3, 0.3, 0.1), 1);
  assert.equal(bandWeight(0.5, 0.3, 0.1), 0);
  assert.equal(bandWeight(0.99, 0.01, 0.1), bandWeight(0.01, 0.99, 0.1), 'the hue wheel wraps');
});

test('a turn rises from 0 to 1 and never falls, with no stretch so flat that a strip lingers half faded', () => {
  for (let seed = 0; seed < 60; seed++) {
    const road = planRoad(seed, 5, STAGE);
    for (const sp of road.spans) {
      assert.equal(profile(sp, 0), 0);
      assert.equal(profile(sp, 1), 1);
      let prev = 0, minSlope = Infinity, maxSlope = 0;
      for (let i = 1; i <= 400; i++) {
        const u = i / 400, v = profile(sp, u);
        assert.ok(v >= prev - 1e-9, `seed ${seed} falls at ${u}`);
        prev = v;
        if (u > 0.04 && u < 0.96) { const sl = profileSlope(sp, u); minSlope = Math.min(minSlope, sl); maxSlope = Math.max(maxSlope, sl); }
      }
      assert.ok(minSlope > 0.1, `seed ${seed} stalls (slope ${minSlope})`);
      assert.ok(maxSlope / minSlope > 1.5, `seed ${seed} is a straight ramp`);
      assert.ok(Math.abs(profileSlope(sp, 0.5) - (profile(sp, 0.5001) - profile(sp, 0.4999)) / 0.0002) < 0.05, 'the slope is the derivative');
    }
  }
});

test('turns are long, ordered, and leave a plateau between them wider than a view', () => {
  for (let seed = 0; seed < 300; seed++) {
    const stages = 2 + (seed % 4);
    const road = planRoad(seed, stages, STAGE);
    assert.equal(road.spans.length, stages - 1);
    road.spans.forEach((sp, k) => {
      const len = sp.to - sp.from;
      assert.ok(len >= 0.9 * ROAD_STRIDE - 1 && len <= 1.7 * ROAD_STRIDE + 1, `turn ${k} of seed ${seed} is ${len} px`);
      assert.ok(sp.from > k * STAGE && sp.to < (k + 2) * STAGE, 'a turn stays between its two biomes\' middles');
      if (k > 0) assert.ok(sp.from - road.spans[k - 1].to >= MIN_PLATEAU, `seed ${seed}: only ${sp.from - road.spans[k - 1].to} px of pure biome`);
    });
  }
});

test('the scenery hands over from one turn to the next where the whole view is one biome', () => {
  for (let seed = 0; seed < 100; seed++) {
    const road = planRoad(seed, 5, STAGE);
    for (let k = 0; k + 1 < road.spans.length; k++) {
      const a = road.spans[k], b = road.spans[k + 1], mid = (a.to + b.from) / 2;
      // the camera's own centre sits at the switch: the view and everything drawn beyond it must be pure on both sides of it
      for (const x of [mid - 1100, mid - 1, mid, mid + 1, mid + 1100]) {
        assert.equal(profile(a, (x - a.from) / (a.to - a.from)), 1, `seed ${seed}: the old turn is not finished at ${x}`);
        assert.equal(profile(b, (x - b.from) / (b.to - b.from)), 0, `seed ${seed}: the next turn has begun at ${x}`);
      }
      assert.equal(spanIndexAt(road, mid - 1), k);
      assert.equal(spanIndexAt(road, mid + 1), k + 1);
    }
    assert.equal(spanIndexAt(road, -5000), 0);
    assert.equal(spanIndexAt(road, 1e9), road.spans.length - 1);
  }
  assert.equal(spanIndexAt(planRoad(1, 1, STAGE), 100), -1, 'a one-biome road has no turns');
});

test('every element belongs to exactly one biome, changes hands once, and is never left half faded at the ends of a turn', () => {
  const world = generateWorld(3, ALL, STAGE), sc = new Scenery();
  for (let k = 0; k < 4; k++) {
    const sp = world.road.spans[k];
    sc.setRoad(world, (sp.from + sp.to) / 2);
    assert.equal(sc.n, 2);
    for (let h = 0.005; h < 1; h += 0.05) {
      let was = 0;
      let flips = 0;
      for (let x = sp.from - 300; x <= sp.to + 300; x += 7) {
        const o0 = sc.keep(0, x, h), o1 = sc.keep(1, x, h);
        assert.notEqual(o0, o1, 'exactly one owns it');
        const w = sc.weight(1, x, h);
        assert.ok(Math.abs(w + sc.weight(0, x, h) - 1) < 1e-9);
        assert.ok(w >= was - 1e-9, `weight of the new biome falls at ${x} (h ${h})`);
        if (o1 && was === 0 && x > sp.from) flips++;
        if (x <= sp.from) assert.equal(w, 0);
        if (x >= sp.to) assert.equal(w, 1);
        was = w;
      }
      assert.ok(flips <= 1);
    }
  }
});

test('over any stretch of a turn only a small share of the horizon is mid-fade', () => {
  const world = generateWorld(9, ALL, STAGE), sc = new Scenery();
  for (const sp of world.road.spans) {
    sc.setRoad(world, (sp.from + sp.to) / 2);
    for (let x = sp.from; x <= sp.to; x += 41) {
      let mid = 0;
      for (let i = 0; i < 400; i++) { const w = sc.weight(1, x, (i + 0.5) / 400); if (w > 0.03 && w < 0.97) mid++; }
      assert.ok(mid / 400 < 0.3, `${(mid / 400).toFixed(2)} of the strips are mid-fade at ${x}`);
    }
  }
  assert.ok(FADE_PX > 0);
});

test('at a share of 10% about a tenth of the ground is the next biome\'s, and at 90% about nine tenths', () => {
  const world = generateWorld(4, ALL, STAGE), sc = new Scenery();
  const sp = world.road.spans[0];
  sc.setRoad(world, (sp.from + sp.to) / 2);
  const at = (target: number): number => { let lo = sp.from, hi = sp.to; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (sc.share(m) < target) lo = m; else hi = m; } return (lo + hi) / 2; };
  for (const target of [0.1, 0.5, 0.9]) {
    const x = at(target);
    let owned = 0, n = 0;
    for (let i = 0; i < 4000; i++) { n++; if (sc.keep(1, x, ((i * 0.6180339887) % 1))) owned++; }
    assert.ok(Math.abs(owned / n - target) < 0.02, `${owned / n} at share ${target}`);
  }
});

test('the generated biomes are the archetypes in kind, and different from run to run', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const w = generateWorld(seed, ALL, STAGE);
    w.biomes.forEach((g, k) => {
      const t = BIOMES[k];
      assert.equal(g.recipe.archetype, k);
      assert.equal(g.def.layers.length, t.layers.length);
      assert.equal(g.def.ground.floor.kind, t.ground.floor.kind);
      assert.ok(g.def.ground.decor.table.length >= Math.min(t.ground.decor.table.length - 8, 4), 'the ground keeps its most common things');
      for (const l of g.def.layers) assert.ok(l.sprite === DESTINATION_LAYER || l.sprite.startsWith(`${k}:`), l.sprite);
      for (const d of g.def.ground.decor.table) assert.ok(d.sprite.startsWith(`${k}:`));
      assert.equal(g.def.palette.day.sky.length, t.palette.day.sky.length);
      assert.equal(g.def.name, biomeName(k, g.recipe.tone));
    });
  }
  const names = new Set<string>(), skies = new Set<number>(), tables = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const g = generateWorld(seed, [0], STAGE).biomes[0];
    names.add(g.def.name); skies.add(g.def.palette.day.sky[0]); tables.add(g.def.ground.decor.table.map((d) => d.sprite + d.w.toFixed(1)).join());
  }
  assert.ok(names.size >= 3, `only ${names.size} kinds of meadow`);
  assert.ok(skies.size >= 30, 'the sky is not the same colour every run');
  assert.ok(tables.size >= 38, 'the ground is not strewn the same way every run');
});

test('generation is a pure function of the seed', () => {
  const a = generateWorld(77, ALL, STAGE), b = generateWorld(77, ALL, STAGE);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.road, generateWorld(78, ALL, STAGE).road);
  assert.equal(slotKey(2, 'trees'), '2:trees');
  const t = rollTone(createRng(1, 1), 0);
  assert.ok(t.sat > 0.8 && t.light > 0.9);
});

test('every generated look has a bright day and a dark night, the moods blend, and a hue turn keeps the sky readable', () => {
  const m = makeBlendedMood();
  for (let seed = 1; seed <= 20; seed++) {
    for (const g of generateWorld(seed, ALL, STAGE).biomes) {
      moodAt(g.def, 0.28, m);
      const lum = (c: number): number => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
      const day = lum(m.sky[m.sky.length - 1]);
      moodAt(g.def, 0.8, m);
      const night = lum(m.sky[m.sky.length - 1]);
      assert.ok(day > night + 30, `${g.def.name}: day ${day} vs night ${night}`);
      assert.ok(m.stars > 0.4, `${g.def.name} has stars at night`);
    }
  }
  assert.ok(artFn(NO_TONE)(0x123456) === 0x123456 && skyFn(NO_TONE)(0xabcdef) === 0xabcdef, 'no tone changes nothing');
});
