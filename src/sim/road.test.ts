import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pilot } from '../ai/pilot';
import { resolveSkill } from '../ai/skill';
import { levelPlan } from '../campaign/route';
import { LEVEL_CAM_END, ROAD_STRIDE, VIEW_W, WORLD_W } from './constants';
import { Kind } from './entities';
import { planLevel } from './gen/level';
import { campX0, levelX0, roadJump, roadLength, roadPart } from './gen/road';
import { createInputFrame } from './input';
import { restore, snapshot } from './snapshot';
import { createSim, Phase, type GameState } from './state';
import { step } from './step';

// The run as one road (docs/21-the-road.md, step 3): a single sim, levels and camps end to end, planned as the party nears them.

test('the road is split by the camera centre exactly as the old levels and stores were', () => {
  const half = VIEW_W / 2;
  assert.deepEqual(roadPart(5, 0), { level: 0, camp: false });
  assert.deepEqual(roadPart(5, half + LEVEL_CAM_END - 1), { level: 0, camp: false });
  assert.deepEqual(roadPart(5, half + LEVEL_CAM_END), { level: 0, camp: true });
  assert.deepEqual(roadPart(5, half + ROAD_STRIDE - 1), { level: 0, camp: true });
  assert.deepEqual(roadPart(5, half + ROAD_STRIDE), { level: 1, camp: false });
  assert.deepEqual(roadPart(5, levelX0(4) + 99_999), { level: 4, camp: false }, 'no camp after the last level');
  assert.equal(campX0(2), levelX0(2) + LEVEL_CAM_END);
  assert.equal(roadLength(5), levelX0(4) + WORLD_W);
});

test('each level on the road is the level it would have been on its own, moved along, with a lair gate behind its boss', () => {
  const s = createSim(12, undefined, { road: { total: 3 } });
  roadJump(s, 2); // plans all three
  for (let k = 0; k < 3; k++) {
    const lp = levelPlan(12, k, 3);
    const own = planLevel(lp.seed, undefined, { boss: lp.boss, scale: lp.scale, heat: 0, opener: k === 0, length: WORLD_W });
    const mine = s.plan.filter((c) => c.seed === lp.seed);
    assert.deepEqual(mine.map((c) => [Math.round(c.x - levelX0(k)), c.size, !!c.boss]), own.map((c) => [Math.round(c.x), c.size, !!c.boss]));
    for (const c of mine) { assert.equal(c.biome, lp.biome); assert.deepEqual(c.mix, lp.mix); }
  }
  const boss = s.plan.findIndex((c) => c.boss);
  assert.ok(s.gates.some((g) => g.clump === boss && g.x > s.plan[boss].x), 'the lair gate stands past the boss');
  for (let k = 1; k < 3; k++) {
    const prev = s.plan.filter((c) => c.seed === levelPlan(12, k - 1, 3).seed), next = s.plan.filter((c) => c.seed === levelPlan(12, k, 3).seed);
    assert.ok(Math.max(...prev.map((c) => c.x)) < Math.min(...next.map((c) => c.x)), `level ${k} comes wholly after level ${k - 1}`);
    assert.ok(s.plan.indexOf(next[0]) > s.plan.indexOf(prev[prev.length - 1]), 'and after it in the plan, which streams in order');
  }
});

/** An expert simulated player walks a road of `total` levels; records what happened at each camp and level. */
interface Trace {
  won: boolean;
  ticks: number;
  /** Per part of the road entered: level, camp, the sim's damage and biome there, mobs retreating a few ticks in. */
  parts: { level: number; camp: boolean; damage: number; biome: number; retreating: number; streamedInCamp: number }[];
  bought: number;
  phaseBeforeEnd: number[];
}
function walkRoad(seed: number, total: number, cap: number): { s: GameState; trace: Trace } {
  const s = createSim(seed, undefined, { road: { total } });
  const pilot = new Pilot(0, resolveSkill('expert'), seed);
  const f = [0, 1, 2, 3].map(createInputFrame);
  const trace: Trace = { won: false, ticks: 0, parts: [], bought: 0, phaseBeforeEnd: [] };
  let key = '', enteredAt = 0, clumpsAtCamp = 0;
  for (let t = 0; t < cap && s.phase === Phase.Playing; t++) {
    pilot.drive(s, f[0], s.road!.camp ? { allDone: pilot.storeDone && s.players[0].pending === 0 } : undefined);
    step(s, f);
    s.events.n = 0;
    const r = s.road!;
    const k = `${r.level}:${r.camp}`;
    if (k !== key) {
      key = k; enteredAt = t; clumpsAtCamp = s.nextClump;
      trace.parts.push({ level: r.level, camp: r.camp, damage: s.damageMul, biome: s.biome, retreating: 0, streamedInCamp: 0 });
    }
    const part = trace.parts[trace.parts.length - 1];
    if (t === enteredAt + 3) for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Mob && (s.ents.flags[i] & 8)) part.retreating++;
    if (r.camp) part.streamedInCamp = s.nextClump - clumpsAtCamp;
  }
  trace.won = s.phase === Phase.Won;
  trace.ticks = s.tick;
  trace.bought = s.wares.filter((w) => w.sold).length;
  return { s, trace };
}

// one run shared by the tests below: four levels, so the third ends in a boss that is not the last
const run = walkRoad(3, 4, 90_000);

test('a simulated player walks the whole road in one sim, through every level and camp, and wins at the last boss', () => {
  const { trace } = run;
  assert.ok(trace.won, `the run was won (ended at tick ${trace.ticks}, last part ${JSON.stringify(trace.parts.at(-1))})`);
  assert.deepEqual(trace.parts.map((p) => `${p.level}${p.camp ? 'c' : ''}`), ['0', '0c', '1', '1c', '2', '2c', '3']);
});

test('the first boss on the road does not end the run: the road goes on past its lair', () => {
  assert.ok(run.trace.parts.some((p) => p.level === 3), 'the party reached the level after the first boss');
});

test('each level plays with its own damage and biome, as its level plan says', () => {
  for (const p of run.trace.parts.filter((q) => !q.camp)) {
    const lp = levelPlan(3, p.level, 4);
    assert.equal(p.damage, lp.damage, `level ${p.level} damage`);
    assert.equal(p.biome, lp.biome, `level ${p.level} biome`);
  }
});

test('walking into a camp, the horde left on the field walks off, and nothing new streams in while the party shops', () => {
  const camps = run.trace.parts.filter((p) => p.camp);
  assert.ok(camps.some((p) => p.retreating > 0), 'some stragglers walked off at a camp');
  for (const p of camps) assert.equal(p.streamedInCamp, 0, `nothing streamed in at camp ${p.level}`);
  assert.ok(run.trace.bought > 0, 'the player bought something at the last camp');
});

test('a save taken on the road just before a camp restores and plays on identically through it', () => {
  const make = () => createSim(9, undefined, { road: { total: 2 } });
  const drive = (s: GameState, pilot: Pilot, ticks: number) => {
    const f = [0, 1, 2, 3].map(createInputFrame);
    for (let t = 0; t < ticks; t++) { pilot.drive(s, f[0], s.road!.camp ? { allDone: false } : undefined); step(s, f); s.events.n = 0; }
  };
  // the pilot's own memory is not part of the sim, so each side gets a pilot that has seen the same game
  const a = make(), pa = new Pilot(0, resolveSkill('expert'), 9);
  drive(a, pa, 8000);
  const text = snapshot(a);
  const b = restore(text), pb = new Pilot(0, resolveSkill('expert'), 9);
  const c = restore(text), pc = new Pilot(0, resolveSkill('expert'), 9);
  drive(b, pb, 3000); drive(c, pc, 3000);
  assert.equal(snapshot(b), snapshot(c));
  assert.ok(b.road!.camp || b.road!.level === 1, `the stretch crossed into the camp (at ${JSON.stringify(b.road)})`);
});

test('jumping to a level (dev) passes the road behind: nothing behind streams in, and the gates behind are open', () => {
  const s = createSim(4, undefined, { road: { total: 6 } });
  roadJump(s, 4);
  assert.equal(s.road!.level, 4);
  assert.ok(s.plan.slice(s.nextClump).every((c) => c.x >= levelX0(4)));
  assert.ok(s.gates.slice(s.gateIdx).every((g) => g.x >= levelX0(4)));
});
