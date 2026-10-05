import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMobArt, mobPose, WEAPON_COUNT, type MobPoseState } from './mobArt';

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

test('every enemy has the common poses; specials exist where the behaviour needs them', () => {
  for (let t = 0; t < 5; t++) for (const n of ['walk', 'idle', 'hurt']) assert.ok(art.anims[t][n]?.length > 0, `enemy ${t} lacks ${n}`);
  for (const t of [0, 1, 3]) for (const n of ['windup', 'strike']) assert.ok(art.anims[t][n]?.length > 0, `enemy ${t} lacks ${n}`);
  for (const n of ['paw', 'charge', 'dazed']) assert.ok(art.anims[1][n]?.length > 0, `orc lacks ${n}`);
  for (const n of ['aim', 'release']) assert.ok(art.anims[2][n]?.length > 0, `archer lacks ${n}`);
  assert.ok(art.anims[4].lit.length > 0, 'bomber lacks lit');
});

const base: MobPoseState = { winding: false, windP: 0, striking: false, strikeQ: 0, chargeWind: false, charging: false, dazed: false, moving: true, hurt: false, tick: 0, salt: 0 };

test('mobPose follows the priority order and falls through when an enemy lacks a pose', () => {
  const orc = 1, goblin = 0, archer = 2, bomber = 4;
  assert.ok(art.anims[goblin].walk.includes(mobPose(art, goblin, base)));
  assert.ok(art.anims[goblin].idle.includes(mobPose(art, goblin, { ...base, moving: false })));
  assert.equal(mobPose(art, goblin, { ...base, hurt: true }), art.anims[goblin].hurt[0]);
  // windup picks the early pose then the extreme one
  assert.equal(mobPose(art, goblin, { ...base, winding: true, windP: 0.1 }), art.anims[goblin].windup[0]);
  assert.equal(mobPose(art, goblin, { ...base, winding: true, windP: 0.9 }), art.anims[goblin].windup[1]);
  assert.equal(mobPose(art, goblin, { ...base, striking: true, strikeQ: 0.1 }), art.anims[goblin].strike[0]);
  assert.equal(mobPose(art, goblin, { ...base, striking: true, strikeQ: 0.9 }), art.anims[goblin].strike[1]);
  // charge states beat hurt/windup; daze beats everything
  assert.ok(art.anims[orc].charge.includes(mobPose(art, orc, { ...base, charging: true, hurt: true })));
  assert.ok(art.anims[orc].dazed.includes(mobPose(art, orc, { ...base, dazed: true, charging: true })));
  assert.ok(art.anims[orc].paw.includes(mobPose(art, orc, { ...base, chargeWind: true, winding: true })));
  // archers use aim while winding and release when striking; bombers flicker lit
  assert.equal(mobPose(art, archer, { ...base, winding: true }), art.anims[archer].aim[0]);
  assert.equal(mobPose(art, archer, { ...base, striking: true }), art.anims[archer].release[0]);
  assert.ok(art.anims[bomber].lit.includes(mobPose(art, bomber, { ...base, winding: true })));
});

test('weapons exist for every 15-degree step', () => {
  assert.equal(art.dagger.length, WEAPON_COUNT);
  assert.equal(art.club.length, WEAPON_COUNT);
  for (const f of [...art.dagger, ...art.club]) assert.ok(f.w > 0 && f.h > 0);
});
