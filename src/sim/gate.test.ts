import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MobType } from '../data/mobs';
import { allocEntity, BYSTANDER, Kind, SURRENDERED } from './entities';
import { VIEW_W } from './constants';
import { createInputFrame, type InputFrame } from './input';
import { planGates, planLevel } from './gen/level';
import { createSim, type GameState } from './state';
import { step } from './step';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
const run = (): InputFrame[] => { const f = idle(); f[0].moveX = 127; return f; };

/** A sim with the whole field spawned empty: no mobs, no top-ups, so only what a test places is on it. */
function emptyField(seed = 1): GameState {
  const s = createSim(seed);
  s.nextClump = s.plan.length;
  s.spawnTimer = 1e9;
  s.flankTimer = 1e9;
  return s;
}

function addMob(s: GameState, x: number, flags = 1): number {
  const i = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, 100, 9999);
  s.ents.flags[i] = flags;
  s.ents.cool[i] = 1e9; // it never attacks: these tests are about the camera
  return i;
}

function runRight(s: GameState, ticks: number): void {
  const pe = s.players[0].ent;
  for (let t = 0; t < ticks; t++) {
    s.ents.hp[pe] = 1e6;
    step(s, run());
  }
}

test('gates stand just past a wall of enemies, in order, and the boss is not gated', () => {
  const plan = planLevel(7);
  const gates = planGates(plan);
  assert.equal(gates.length, plan.filter((c) => c.gate).length);
  assert.ok(gates.length >= 5);
  for (let i = 1; i < gates.length; i++) assert.ok(gates[i].x > gates[i - 1].x);
  for (const g of gates) { assert.ok(g.x > plan[g.clump].x); assert.ok(!plan[g.clump].boss); }
});

test('running ahead stops at the gate while an enemy is in sight, and the gate opens once the screen is clear', () => {
  const s = emptyField();
  const g = s.gates[0];
  const m = addMob(s, g.x - 200); // standing in the way, never attacking
  runRight(s, 1500);
  assert.ok(s.camX <= g.x - VIEW_W + 56 + 1e-6, 'the camera cannot pass a shut gate');
  assert.ok(s.camX > g.x - VIEW_W + 56 - 6, 'the camera is up against it');
  assert.equal(s.gateIdx, 0);
  const pe = s.players[0].ent;
  assert.ok(s.ents.x[pe] <= g.x, 'and neither can the hero');
  s.ents.alive[m] = 0; s.ents.count--; // (the mob is gone)
  runRight(s, 5);
  assert.equal(s.gateIdx, 1);
  runRight(s, 600);
  assert.ok(s.camX > g.x - VIEW_W + 56, 'the camera runs on past an open gate');
});

test('stragglers off the screen, bystanders and the surrendered do not hold a gate', () => {
  const s = emptyField();
  const g = s.gates[0];
  addMob(s, g.x - VIEW_W - 800); // far behind
  addMob(s, g.x - 100, BYSTANDER);
  addMob(s, g.x - 90, SURRENDERED);
  addMob(s, g.x - 80, 8); // running away
  runRight(s, 1500);
  assert.ok(s.gateIdx >= 1, 'none of them kept the first gate shut');
});

test('a gate cannot open before the encounter it guards has streamed in', () => {
  const s = emptyField();
  s.nextClump = 0;
  s.tick = 0;
  const g = s.gates[0];
  s.camX = s.prevCamX = g.x - VIEW_W + 56;
  s.trigCamX = s.camX;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.camX + 300;
  step(s, idle());
  assert.equal(s.gateIdx, 0);
});

test('a won field the road goes on from is not a stop: the party keeps walking while the horde leaves', () => {
  for (const onward of [false, true]) {
    const s = createSim(3, undefined, { boss: false, onward });
    s.nextClump = s.plan.length; s.spawnTimer = 1e9; s.flankTimer = 1e9; s.gateIdx = s.gates.length;
    const pe = s.players[0].ent;
    s.ents.x[pe] = s.ents.px[pe] = s.exitX - 4;
    s.camX = s.prevCamX = s.trigCamX = s.exitX - 300;
    runRight(s, 6);
    assert.equal(s.phase, 1, 'the far end wins the level');
    const at = s.ents.x[pe];
    runRight(s, 20);
    if (onward) assert.ok(s.ents.x[pe] > at + 10, 'the hero is still in control');
    else assert.equal(s.ents.x[pe], at, 'the last level stops dead (the banner and the summary follow)');
  }
});
