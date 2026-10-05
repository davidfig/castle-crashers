import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS } from '../data/mobs';
import { buildMobArt, mobPose, type MobPoseState } from './mobArt';

// Placements are fake; this checks that the generated sheet metadata lines up with what the renderer looks up.
const places = MOBS.map((_, k) => ({ x: 0, y: k * 200 }));
const art = buildMobArt(places, 512, 8192);

test('every enemy has a walk cycle with tight bottom-anchored cells', () => {
  assert.equal(art.walk.length, MOBS.length);
  for (const frames of art.walk) {
    assert.ok(frames.length >= 2);
    for (const f of frames) { assert.ok(f.w > 0 && f.h > 0); assert.equal(f.w, frames[0].w); }
  }
});

test('every enemy has the common poses; specials exist where the behaviour needs them', () => {
  for (let t = 0; t < MOBS.length; t++) for (const n of ['walk', 'idle', 'hurt', 'dead']) assert.ok(art.anims[t][n]?.length > 0, `enemy ${t} lacks ${n}`);
  for (const t of [0, 1, 3]) for (const n of ['windup', 'strike']) assert.ok(art.anims[t][n]?.length > 0, `enemy ${t} lacks ${n}`);
  for (const n of ['paw', 'charge', 'dazed']) assert.ok(art.anims[1][n]?.length > 0, `orc lacks ${n}`);
  for (const n of ['aim', 'release']) assert.ok(art.anims[2][n]?.length > 0, `archer lacks ${n}`);
  assert.ok(art.anims[4].lit.length > 0, 'bomber lacks lit');
  // every boss (the Orc Warlord, the Rime King) has the full set of its own poses, and a corpse
  const bosses = MOBS.map((m, t) => (m.boss ? t : -1)).filter((t) => t >= 0);
  assert.ok(bosses.length >= 2 && bosses.includes(5), 'at least the Warlord and the Rime King');
  for (const t of bosses) for (const n of ['windup', 'strike', 'paw', 'charge', 'dazed', 'slam', 'roar', 'smash', 'dead']) assert.ok(art.anims[t][n]?.length > 0, `${MOBS[t].name} lacks ${n}`);
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

test('the boss uses its own slam / roar / smash poses while winding up', () => {
  const boss = 5;
  assert.equal(mobPose(art, boss, { ...base, winding: true, windP: 0.1, special: 'slam' }), art.anims[boss].slam[0]);
  assert.equal(mobPose(art, boss, { ...base, winding: true, windP: 0.9, special: 'slam' }), art.anims[boss].slam[1]);
  assert.ok(art.anims[boss].roar.includes(mobPose(art, boss, { ...base, winding: true, special: 'roar' })));
  assert.equal(mobPose(art, boss, { ...base, winding: true, windP: 0.9, special: 'smash' }), art.anims[boss].smash[1]);
  // an enemy without those animations ignores the flag
  assert.equal(mobPose(art, 0, { ...base, winding: true, windP: 0.1, special: 'slam' }), art.anims[0].windup[0]);
});

test('every enemy has the telegraph pose its attacks need', () => {
  for (let t = 0; t < MOBS.length; t++) {
    if (MOBS[t].name === 'bomber') continue;
    const needs = MOBS[t].behavior === 1 ? ['aim'] : ['windup']; // archers raise a bow; everyone else winds up
    for (const n of needs) assert.ok(art.anims[t][n]?.length > 0, `${MOBS[t].name} lacks ${n}`);
    if (MOBS[t].charge) for (const n of ['paw', 'charge', 'dazed']) assert.ok(art.anims[t][n]?.length > 0, `${MOBS[t].name} lacks ${n}`);
  }
});

test('special telegraphs, clinging and rising pick their own poses, and fall back when an enemy has none', () => {
  const trapper = MOBS.findIndex((m) => m.name === 'trapper');
  const sprite = MOBS.findIndex((m) => m.name === 'snowsprite');
  const knight = MOBS.findIndex((m) => m.name === 'dreadknight');
  const goblin = 0;
  assert.ok(art.anims[trapper].cast.includes(mobPose(art, trapper, { ...base, winding: true, cast: true })), 'the trapper kneels to set its snare');
  assert.ok(art.anims[trapper].windup.includes(mobPose(art, trapper, { ...base, winding: true })), 'but chops with its hatchet otherwise');
  assert.ok(art.anims[sprite].cling.includes(mobPose(art, sprite, { ...base, cling: true })));
  assert.ok(art.anims[knight].dazed.includes(mobPose(art, knight, { ...base, rising: true })), 'the knight staggers up');
  assert.equal(mobPose(art, goblin, { ...base, winding: true, windP: 0.1, cast: true }), art.anims[goblin].windup[0], 'no cast pose: the windup');
});
