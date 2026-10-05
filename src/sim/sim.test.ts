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
