import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MobType } from '../data/mobs';
import { BYSTANDER, freeEntity, Kind } from './entities';
import { Ev, EV_STRIDE } from './events';
import { hashState } from './hash';
import { createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { step } from './step';
import { planLevel, spawnClump, STAGED_BEATS } from './gen/level';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
const R1 = { id: 'R1' };

function camp(s: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Mob && (s.ents.flags[i] & BYSTANDER)) out.push(i);
  return out;
}

/** The sim with only the staged camp on the field, and the player placed `dx` px before it. */
function campArena(seed: number, dx: number): GameState {
  const s = createSim(seed, R1);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9;
  s.flankTimer = 1e9;
  spawnClump(s, s.beatIndex, 1);
  s.nextClump = s.beatIndex + 1;
  const c = s.plan[s.beatIndex];
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = c.x - dx;
  s.ents.y[pe] = s.ents.py[pe] = c.y;
  s.camX = s.prevCamX = Math.max(0, c.x - 300);
  return s;
}

function eventCount(s: GameState, type: number): number {
  let n = 0;
  for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === type) n++;
  return n;
}

test('a staged beat is placed in every seed, at a fixed spot, and leaves every other encounter alone', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const base = planLevel(seed);
    const plan = planLevel(seed, R1);
    assert.equal(plan.length, base.length + 1);
    assert.equal(plan.filter((c) => c.beat === 'R1').length, 1);
    const at = plan.findIndex((c) => c.beat);
    assert.ok(plan.slice(0, at).every((c) => c.x <= plan[at].x) && plan[at + 1].x > plan[at].x, 'slotted in order, so it streams in at the right time');
    assert.deepEqual(plan.filter((c) => !c.beat), base, 'the others keep their positions and random streams');
    assert.equal(new Set(plan.map((c) => c.rid)).size, plan.length);
    assert.equal(createSim(seed, R1).beatIndex, plan.findIndex((c) => c.beat));
  }
});

test('the beat does not depend on the seed for its place, and moves earlier after repeated misses', () => {
  const x = (seed: number, early?: boolean) => planLevel(seed, { id: 'R1', early }).find((c) => c.beat)!.x;
  assert.equal(x(1), x(2));
  assert.ok(x(1, true) < x(1));
});

test('beats the battlefield cannot stage are ignored, and no beat means no camp', () => {
  assert.deepEqual(STAGED_BEATS, ['R1', 'R3']);
  assert.deepEqual(planLevel(5, { id: 'R2' }), planLevel(5));
  assert.deepEqual(planLevel(5, { id: 'R5' }), planLevel(5));
  assert.equal(createSim(5).beatIndex, -1);
  assert.equal(createSim(5, { id: 'R2' }).beatIndex, -1);
});

test('the camp is a few goblins that stand by the fire and never attack', () => {
  const s = campArena(3, 60);
  const ids = camp(s);
  assert.ok(ids.length >= 3 && ids.length <= 5, `${ids.length} bystanders`);
  for (const i of ids) assert.equal(s.ents.sub[i], MobType.Goblin);
  const before = ids.map((i) => [s.ents.x[i], s.ents.y[i]]);
  const hp = s.ents.hp[s.players[0].ent];
  for (let t = 0; t < 90; t++) step(s, idle());
  assert.equal(s.ents.hp[s.players[0].ent], hp, 'no damage from bystanders');
  ids.forEach((i, k) => { assert.equal(s.ents.x[i], before[k][0]); assert.equal(s.ents.y[i], before[k][1]); });
});

test('a bystander that is hit stays passive', () => {
  const s = campArena(3, 20);
  const ids = camp(s);
  const m = ids[0];
  s.ents.vx[m] = 3; // shoved
  s.ents.flags[m] |= 1; // and woken, as a hit would
  const hp = s.ents.hp[s.players[0].ent];
  for (let t = 0; t < 120; t++) step(s, idle());
  assert.ok(s.ents.alive[m]);
  assert.equal(s.ents.hp[s.players[0].ent], hp);
});

test('the beat plays when the lead hero walks up to the camp, once', () => {
  const s = campArena(4, 400);
  for (let t = 0; t < 30; t++) step(s, idle());
  assert.equal(s.beatPlayedTick, -1);
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = s.plan[s.beatIndex].x - 70;
  step(s, idle());
  assert.equal(s.beatPlayedTick, s.tick);
  assert.equal(eventCount(s, Ev.Beat), 1);
  const at = s.beatPlayedTick;
  for (let t = 0; t < 20; t++) step(s, idle());
  assert.equal(s.beatPlayedTick, at);
});

test('the beat only plays once its camp has streamed in', () => {
  const s = campArena(4, 0);
  s.nextClump = s.beatIndex; // not spawned yet
  step(s, idle());
  assert.equal(s.beatPlayedTick, -1);
});

test('the beat is part of the state hash and the run stays deterministic', () => {
  const run = (beat?: { id: string }) => { const s = createSim(9, beat); for (let t = 0; t < 400; t++) step(s, idle()); return hashState(s); };
  assert.equal(run(R1), run(R1));
  assert.notEqual(run(R1), run());
  const a = createSim(9, R1), b = createSim(9, R1);
  b.beatPlayedTick = 5;
  assert.notEqual(hashState(a), hashState(b));
});
