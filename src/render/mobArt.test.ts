import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBestiary } from '../data/bestiary';
import { buildMobArtFrom, mobPose, type MobPoseState, type SheetMeta } from './mobArt';
import { monsterSheets } from './monsterSprites';

// Placements are fake; this checks that a generated cast's sheet metadata lines up with what the renderer looks up.
const cast = generateBestiary(7);
const metas = monsterSheets(cast).map((s) => s.meta as SheetMeta);
const art = buildMobArtFrom(metas, metas.map((_, k) => ({ x: 0, y: k * 200 })), 512, 16384);
const slotWith = (name: string, from = 0): number => { const t = art.anims.findIndex((a, k) => k >= from && a[name]?.length > 0); assert.ok(t >= 0, `no monster has ${name}`); return t; };

test('every enemy has a walk cycle with tight bottom-anchored cells', () => {
  assert.equal(art.walk.length, cast.defs.length);
  for (const frames of art.walk) {
    assert.ok(frames.length >= 2);
    for (const f of frames) { assert.ok(f.w > 0 && f.h > 0); assert.equal(f.w, frames[0].w); }
  }
});

test('every enemy has the common poses; every boss has its own', () => {
  for (let t = 0; t < art.anims.length; t++) for (const n of ['walk', 'idle', 'hurt', 'dead']) assert.ok(art.anims[t][n]?.length > 0, `enemy ${t} lacks ${n}`);
  const bosses = cast.defs.map((m, t) => (m.boss ? t : -1)).filter((t) => t >= 0);
  assert.ok(bosses.length >= 2);
  for (const t of bosses) for (const n of ['windup', 'strike', 'slam', 'roar', 'smash', 'dead']) assert.ok(art.anims[t][n]?.length > 0, `${cast.defs[t].name} lacks ${n}`);
});

const base: MobPoseState = { winding: false, windP: 0, striking: false, strikeQ: 0, chargeWind: false, charging: false, dazed: false, moving: true, hurt: false, tick: 0, salt: 0 };

test('mobPose follows the priority order and falls through when an enemy lacks a pose', () => {
  const goblin = slotWith('windup'), orc = slotWith('charge'), archer = slotWith('release'), bomber = slotWith('lit');
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
  const boss = slotWith('slam');
  assert.equal(mobPose(art, boss, { ...base, winding: true, windP: 0.1, special: 'slam' }), art.anims[boss].slam[0]);
  assert.equal(mobPose(art, boss, { ...base, winding: true, windP: 0.9, special: 'slam' }), art.anims[boss].slam[1]);
  assert.ok(art.anims[boss].roar.includes(mobPose(art, boss, { ...base, winding: true, special: 'roar' })));
  assert.equal(mobPose(art, boss, { ...base, winding: true, windP: 0.9, special: 'smash' }), art.anims[boss].smash[1]);
  // an enemy without those animations ignores the flag
  const plain = art.anims.findIndex((a) => a.windup && !a.slam);
  assert.equal(mobPose(art, plain, { ...base, winding: true, windP: 0.1, special: 'slam' }), art.anims[plain].windup[0]);
});

test('every enemy has the telegraph pose its attacks need', () => {
  cast.defs.forEach((d, t) => {
    const a = art.anims[t];
    assert.ok(a.windup?.length > 0 || a.aim?.length > 0 || a.lit?.length > 0, `${d.name} has no telegraph pose`);
    if (d.charge && !d.boss) for (const n of ['paw', 'charge', 'dazed']) assert.ok(a[n]?.length > 0, `${d.name} lacks ${n}`);
  });
});

test('special telegraphs pick the cast pose, and fall back to the windup otherwise', () => {
  const caster = art.anims.findIndex((a) => a.cast?.length > 0 && a.windup?.length > 0);
  assert.ok(caster >= 0, 'some monster casts');
  assert.ok(art.anims[caster].cast.includes(mobPose(art, caster, { ...base, winding: true, cast: true })), 'a special uses the cast pose');
  assert.ok(art.anims[caster].windup.includes(mobPose(art, caster, { ...base, winding: true })), 'an ordinary attack winds up');
  const riser = slotWith('rise');
  assert.ok(art.anims[riser].rise.includes(mobPose(art, riser, { ...base, rising: true })), 'a monster getting back up uses its rise pose');
});
