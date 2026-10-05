import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, nextU32 } from '../engine/rng';
import { sinTurns } from '../engine/math';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, Phase } from './state';
import { step } from './step';
import { hashState } from './hash';
import { spawnAllClumps } from './gen/level';
import { Kind } from './entities';

function script(tick: number): InputFrame[] {
  const frames = [0, 1, 2, 3].map(createInputFrame);
  const f = frames[0];
  f.moveX = tick % 240 < 200 ? 127 : -60;
  f.moveY = (tick >> 5) % 2 ? 40 : -40;
  f.buttons = (tick % 7 < 5 ? Btn.Attack : 0) | (tick % 90 === 10 ? Btn.Ability1 : 0) | (tick % 150 === 50 ? Btn.Dodge : 0);
  if (tick === 30) frames[1].buttons = Btn.Join;
  return frames;
}

function run(seed: number, ticks: number): number {
  const s = createSim(seed);
  for (let t = 0; t < ticks; t++) step(s, script(t));
  return hashState(s);
}

test('rng is deterministic and stream-independent', () => {
  const a = createRng(42, 1), b = createRng(42, 1), c = createRng(42, 2);
  for (let i = 0; i < 100; i++) assert.equal(nextU32(a), nextU32(b));
  assert.notEqual(nextU32(createRng(42, 1)), nextU32(c));
});

test('table sine is accurate', () => {
  assert.ok(Math.abs(sinTurns(0.25) - 1) < 1e-4);
  assert.ok(Math.abs(sinTurns(0.5)) < 1e-4);
  assert.ok(Math.abs(sinTurns(0.75) + 1) < 1e-4);
});

test('same seed + inputs => identical state hash', () => {
  assert.equal(run(1234, 1500), run(1234, 1500));
});

test('different seed => different state', () => {
  assert.notEqual(run(1, 600), run(2, 600));
});

test('level spawns a horde', () => {
  const s = createSim(7);
  spawnAllClumps(s, 1);
  let mobs = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) mobs++;
  assert.ok(mobs > 800, `expected a big horde, got ${mobs}`);
});

test('nova kills nearby goblins', () => {
  const s = createSim(9);
  spawnAllClumps(s, 1);
  // Drop a pack of goblins around the player.
  const p = s.ents;
  const px = p.x[s.players[0].ent], py = p.y[s.players[0].ent];
  const before = s.kills;
  for (let i = 0; i < p.highWater; i++) {
    if (p.kind[i] === Kind.Mob) { p.x[i] = px + 20 + (i % 20); p.y[i] = py + ((i % 9) - 4) * 4; p.flags[i] = 0; p.sub[i] = 0; p.hp[i] = 6; }
    if (p.kind[i] === Kind.Mob && i > 60) break;
  }
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].buttons = Btn.Ability1;
  step(s, f);
  assert.ok(s.kills - before > 10, `nova should kill many goblins, killed ${s.kills - before}`);
});

test("archer's rain of arrows lands ahead of him, hurting mobs there and not those beside him", () => {
  const s = createSim(9);
  spawnAllClumps(s, 1);
  const e = s.ents, pl = s.players[0];
  pl.classId = 4;
  pl.fury = 100;
  pl.faceX = 1; pl.faceY = 0;
  const px = e.x[pl.ent], py = e.y[pl.ent];
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) { e.x[i] = px - 400; e.y[i] = py; e.flags[i] = 0; }
  const near: number[] = [], far: number[] = [];
  for (let i = 0; i < e.highWater && (near.length < 30 || far.length < 5); i++) {
    if (e.kind[i] !== Kind.Mob) continue;
    const isNear = near.length < 30;
    const arr = isNear ? near : far;
    if (isNear) { e.x[i] = px + 147 + ((near.length % 10) - 5) * 5; e.y[i] = py + (Math.floor(near.length / 10) - 1) * 6; } else { e.x[i] = px + 10; e.y[i] = py; }
    e.sub[i] = 0; e.hp[i] = 50; e.maxhp[i] = 50; e.stun[i] = 255; arr.push(i);
  }
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].buttons = Btn.Ability1;
  step(s, f);
  f[0].buttons = 0;
  for (let t = 0; t < 90; t++) step(s, f);
  const hurt = near.filter((i) => e.hp[i] < 50).length;
  assert.ok(hurt >= 10, `the rain should hurt the mobs under it, hurt ${hurt}`);
  assert.ok(far.every((i) => e.hp[i] === 50), 'mobs next to the archer are not under the rain');
});

test("warrior's shockwave hurts a lane in front of him, not what is behind or beside it", () => {
  const s = createSim(9);
  spawnAllClumps(s, 1);
  const e = s.ents, pl = s.players[0];
  pl.fury = 100; pl.faceX = 1; pl.faceY = 0;
  const px = e.x[pl.ent], py = e.y[pl.ent];
  const spots: [number, number, boolean][] = [[100, 0, true], [160, 8, true], [-60, 0, false], [60, 70, false], [300, 0, false]];
  const ids: number[] = [];
  for (let i = 0; i < e.highWater && ids.length < spots.length; i++) {
    if (e.kind[i] !== Kind.Mob) continue;
    const [dx, dy] = spots[ids.length];
    e.x[i] = px + dx; e.y[i] = py + dy; e.flags[i] = 0; e.sub[i] = 0; e.hp[i] = 500; e.maxhp[i] = 500; e.stun[i] = 255;
    ids.push(i);
  }
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && !ids.includes(i)) e.x[i] = px - 900;
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].buttons = Btn.Ability1;
  step(s, f);
  ids.forEach((id, k) => assert.equal(e.hp[id] < 500, spots[k][2], `mob ${k} at ${spots[k]}`));
});

test('unattended player eventually loses', () => {
  const s = createSim(3);
  spawnAllClumps(s, 1);
  const f = [0, 1, 2, 3].map(createInputFrame);
  // Pull every mob next to the player and aggro them.
  const e = s.ents;
  const px = e.x[s.players[0].ent], py = e.y[s.players[0].ent];
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) { e.x[i] = px + 30; e.y[i] = py; e.flags[i] = 1; }
  for (let t = 0; t < 3000 && s.phase === Phase.Playing; t++) step(s, f);
  assert.equal(s.phase, Phase.Lost);
});

test('after a wipe the surviving mobs all walk off screen, even at the edge of the world', () => {
  const s = createSim(3);
  spawnAllClumps(s, 1);
  const e = s.ents;
  s.phase = Phase.Lost;
  // one mob pinned against each world edge, the rest wherever they spawned
  let n = 0;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) { n++; if (n === 1) e.x[i] = 0; if (n === 2) e.x[i] = 4800; }
  assert.ok(n > 2);
  const f = [0, 1, 2, 3].map(createInputFrame);
  for (let t = 0; t < 2000; t++) step(s, f);
  for (let i = 0; i < e.highWater; i++) assert.notEqual(e.kind[i], Kind.Mob);
});
