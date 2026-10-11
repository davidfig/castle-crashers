import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, MobType } from '../data/mobs';
import { botInput } from './bot';
import { WORLD_W } from './constants';
import { allocEntity, Kind } from './entities';
import { gatherCircle, rebuildGrid } from './grid';
import { createInputFrame } from './input';
import { restore, snapshot } from './snapshot';
import { backLine, createSim, Phase, type GameState } from './state';
import { step } from './step';

// A field can be any length (docs/21-the-road.md, step 2): nothing in the sim is sized by the field, and what is left behind is gone,
// so a long road holds no more than a short one.

const frames = [0, 1, 2, 3].map(createInputFrame);

/** A bot hero that cannot fall walks the field; returns the most entity slots ever in use and the largest save seen. */
function walk(s: GameState, ticks: number): { highWater: number; maxCount: number; maxSave: number } {
  let maxCount = 0, maxSave = 0;
  const pe = s.players[0].ent;
  for (let t = 0; t < ticks && s.phase === Phase.Playing; t++) {
    s.ents.hp[pe] = s.ents.maxhp[pe];
    botInput(s, 0, frames[0]);
    step(s, frames);
    s.events.n = 0;
    maxCount = Math.max(maxCount, s.ents.count);
    if (t % 5000 === 0) maxSave = Math.max(maxSave, snapshot(s).length);
  }
  return { highWater: s.ents.highWater, maxCount, maxSave };
}

test('a field ten times as long has as many encounters per px, and is walked end to end', () => {
  const s = createSim(21, undefined, { length: WORLD_W * 10, boss: false });
  assert.equal(s.worldW, WORLD_W * 10);
  const short = createSim(21, undefined, { boss: false });
  assert.ok(s.plan.length > short.plan.length * 8, `${s.plan.length} encounters against ${short.plan.length}`);
  assert.ok(s.plan[s.plan.length - 1].x > WORLD_W * 9, 'the encounters reach the far end');
});

test('walking a long road, the sim only ever holds what is near the party', () => {
  const s = createSim(5, undefined, { length: 30_000, boss: false });
  s.gates = []; // the scripted bot only pushes right, so a shooter behind it would hold a gate shut; this test is about memory, not gates
  const r = walk(s, 50_000);
  assert.ok(s.camX > 10_000, `the bot got along the road (camera at ${Math.round(s.camX)})`);
  assert.ok(r.maxCount < 1400, `at most ${r.maxCount} entities alive at once`);
  assert.ok(r.highWater < 2000, `entity slots in use stay bounded (${r.highWater})`);
  assert.ok(r.maxSave < 600_000, `a save stays small (${r.maxSave} chars)`);
  for (let i = 0; i < s.ents.highWater; i++) {
    if (s.ents.alive[i] && s.ents.kind[i] !== Kind.Npc) assert.ok(s.ents.x[i] >= backLine(s) - 40, `${s.ents.kind[i]} left at x=${Math.round(s.ents.x[i])}, behind the back line`);
  }
});

test('the grid finds mobs far along the road, near the camera and beyond its window', () => {
  const s = createSim(1, undefined, { length: 200_000 });
  s.camX = s.camMax = 150_000;
  const near = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 150_300, 100, MOBS[MobType.Goblin].hp);
  const far = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 160_000, 100, MOBS[MobType.Goblin].hp);
  rebuildGrid(s.grid, s.ents, s.camX);
  const out = new Int32Array(64);
  assert.deepEqual([...out.subarray(0, gatherCircle(s.grid, s.ents, 150_310, 100, 20, out))], [near]);
  assert.deepEqual([...out.subarray(0, gatherCircle(s.grid, s.ents, 160_000, 104, 10, out))], [far], 'outside the window it sits in the edge column, still found');
  assert.equal(gatherCircle(s.grid, s.ents, 155_000, 100, 30, out), 0);
});

test('a save far along a long road restores and plays on identically', () => {
  const a = createSim(8, undefined, { length: 20_000, boss: false });
  walk(a, 6000);
  const b = restore(snapshot(a));
  walk(a, 3000); walk(b, 3000);
  assert.equal(snapshot(b), snapshot(a));
});
