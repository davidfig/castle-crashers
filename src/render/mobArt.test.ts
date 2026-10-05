import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMobArt, WEAPON_COUNT } from './mobArt';

// Placements are fake; this checks that the generated sheet metadata lines up with what the renderer looks up.
const places = [0, 1, 2, 3, 4, 5].map((k) => ({ x: 0, y: k * 100 }));
const art = buildMobArt(places, 512, 2048);

test('every enemy has a walk cycle with tight bottom-anchored cells', () => {
  assert.equal(art.walk.length, 5);
  for (const frames of art.walk) {
    assert.ok(frames.length >= 2);
    for (const f of frames) { assert.ok(f.w > 0 && f.h > 0); assert.equal(f.w, frames[0].w); }
  }
});

test('the archer has a raised-bow frame the same size as its walk frames', () => {
  assert.equal(art.aim.w, art.walk[2][0].w);
  assert.equal(art.aim.h, art.walk[2][0].h);
});

test('weapons exist for every 15-degree step', () => {
  assert.equal(art.dagger.length, WEAPON_COUNT);
  assert.equal(art.club.length, WEAPON_COUNT);
  for (const f of [...art.dagger, ...art.club]) assert.ok(f.w > 0 && f.h > 0);
});
