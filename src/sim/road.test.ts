import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pilot } from '../ai/pilot';
import { resolveSkill } from '../ai/skill';
import { levelPlan, ROUTE_LEVELS } from '../campaign/route';
import { VIEW_W, WORLD_W } from './constants';
import { MOBS, MobType } from '../data/mobs';
import { allocEntity, BYSTANDER, Kind, SURRENDERED } from './entities';
import { activatePlayer } from './state';
import { planLevel } from './gen/level';
import { CLEAR_AFTER, CLEAR_BEFORE, commitFork, forkChoice, forkOptions, layoutRoad, levelToRoad, roadBiomes, roadJump, roadLevel, roadPart, stageBounds, stageOf, type Calm } from './gen/road';
import { createInputFrame } from './input';
import { restore, snapshot } from './snapshot';
import { createSim, Phase, type GameState } from './state';
import { step } from './step';

// The run as one road (docs/21-the-road.md): a single sim, fighting stretches and calm places (camps, road scenes) end to end, the road
// growing around each calm place so the horde can never reach it.

/** A whole road, planned: every level's encounters, gates and sites. */
function plannedRoad(seed: number, total: number): GameState {
  const s = createSim(seed, undefined, { road: { total } });
  roadJump(s, total - 1);
  return s;
}

test('every encounter keeps clear of every calm place: far enough past one to stream in unseen, far enough before one to be fought out of its sight', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = plannedRoad(seed, ROUTE_LEVELS);
    const calm = s.road!.layout.calm;
    assert.ok(calm.some((c) => c.kind === 'scene'), `seed ${seed}: the road has road scenes on it`);
    assert.equal(calm.filter((c) => c.kind === 'camp').length, ROUTE_LEVELS - 1);
    for (const c of s.plan) {
      if (c.scene) continue;
      for (const p of calm) {
        if (c.x < p.from) assert.ok(c.x + (c.boss ? 150 : c.gate ? 40 : 0) <= p.from - CLEAR_BEFORE + 1e-6, `seed ${seed}: encounter at ${Math.round(c.x)} too close before the ${p.kind} at ${Math.round(p.from)}`);
        else assert.ok(c.x >= p.to + CLEAR_AFTER - 1e-6, `seed ${seed}: encounter at ${Math.round(c.x)} too close after the ${p.kind} ending ${Math.round(p.to)}`);
      }
    }
    for (let i = 0; i < s.ents.highWater; i++) {
      if (!s.ents.alive[i] || (s.ents.kind[i] !== Kind.Shrine && s.ents.kind[i] !== Kind.Chest)) continue;
      for (const p of calm) assert.ok(s.ents.x[i] < p.from || s.ents.x[i] > p.to, `seed ${seed}: a site at ${Math.round(s.ents.x[i])} stands on the ${p.kind}'s ground`);
    }
  }
});

test('the road grows: calm places push the fighting apart instead of clearing it away', () => {
  const lay = layoutRoad(5, ROUTE_LEVELS);
  for (let k = 1; k < lay.levels.length; k++) assert.ok(lay.levels[k].slices[0].dx > lay.levels[k - 1].slices[0].dx + WORLD_W, `level ${k} starts past the whole of level ${k - 1}`);
  const ordinary = ROUTE_LEVELS * WORLD_W;
  assert.ok(lay.length > ordinary, `the road (${Math.round(lay.length)} px) is longer than its levels end to end (${ordinary})`);
  assert.ok(lay.length < ordinary * 2.2, `but not absurdly (${Math.round(lay.length)} px)`);
  const b = stageBounds(lay);
  assert.equal(b.length, ROUTE_LEVELS / 3 + 1);
  assert.ok(b.every((x, i) => i === 0 || x > b[i - 1]), 'each biome\'s stretch begins after the last');
});

test('the camera centre places the party: a calm place, or the level whose stretch it is in', () => {
  const lay = layoutRoad(3, 6);
  for (const [i, p] of lay.calm.entries()) {
    assert.deepEqual(roadPart(lay, (p.from + p.to) / 2), { level: p.level, calm: i });
    // just before it: the level, or the camp a crossroads opens from
    assert.equal(roadPart(lay, p.from - 1).calm, p.kind === 'fork' ? i - 1 : -1);
  }
  for (let k = 1; k < 6; k++) assert.equal(roadPart(lay, lay.levels[k].start + 1).level, k);
  assert.deepEqual(roadPart(lay, lay.length + 50_000), { level: 5, calm: -1 }, 'the last level runs on to the end');
});

test('each level on the road is the level it would have been on its own, cut at its scene and moved along, with a lair gate behind its boss', () => {
  const s = plannedRoad(12, 6);
  for (let k = 0; k < 6; k++) {
    const lp = levelPlan(12, k, 6, s.road!.biomes[stageOf(k)]);
    const own = planLevel(lp.seed, undefined, { boss: lp.boss, scale: lp.scale, heat: 0, opener: k === 0, length: WORLD_W });
    const mine = s.plan.filter((c) => c.seed === lp.seed && !c.scene);
    const lay = s.road!.layout.levels[k];
    assert.deepEqual(mine.map((c) => [Math.round(c.x), c.size, !!c.boss]), own.map((c) => [Math.round(levelToRoad(lay, c.x)), c.size, !!c.boss]));
    for (const c of mine) { assert.equal(c.biome, lp.biome); assert.deepEqual(c.mix, lp.mix); }
  }
  const boss = s.plan.findIndex((c) => c.boss);
  assert.ok(s.gates.some((g) => g.clump === boss && g.x > s.plan[boss].x), 'the lair gate stands past the boss');
  assert.ok(s.gates.every((g, i) => i === 0 || g.x >= s.gates[i - 1].x - 80), 'gates come in order along the road');
});

/** An expert simulated player walks a road of `total` levels, recording each part of the road and what was on screen in the calm places. */
interface Part { level: number; calm: string; damage: number; biome: number; streamed: number; hostileOnScreen: number; popIns: number }
function walkRoad(seed: number, total: number, cap: number): { s: GameState; won: boolean; parts: Part[]; bought: number; scenesLeft: number[] } {
  const s = createSim(seed, undefined, { road: { total } });
  const pilot = new Pilot(0, resolveSkill('expert'), seed);
  const f = [0, 1, 2, 3].map(createInputFrame);
  const parts: Part[] = [];
  let key = '', enteredAt = 0, clumps = 0;
  const scenesLeft: number[] = []; // where the screen's left edge stood, past each scene's figures, when the scene was let go
  let scene = -1;
  const hostile = (i: number) => s.ents.alive[i] === 1 && s.ents.kind[i] === Kind.Mob && !(s.ents.flags[i] & (8 | BYSTANDER | SURRENDERED));
  for (let t = 0; t < cap && s.phase === Phase.Playing; t++) {
    pilot.drive(s, f[0], s.road!.camp ? { allDone: pilot.storeDone && s.players[0].pending === 0 } : undefined);
    const before = Uint8Array.from(s.ents.kind);
    step(s, f);
    s.events.n = 0;
    const r = s.road!;
    if (s.sceneIndex !== scene) { if (scene >= 0) scenesLeft.push(s.camX - s.plan[scene].x); scene = s.sceneIndex; }
    const place: Calm | undefined = r.calm >= 0 ? r.layout.calm[r.calm] : undefined;
    const k = `${r.level}:${r.calm}`;
    if (k !== key) {
      key = k; enteredAt = t; clumps = s.nextClump;
      parts.push({ level: r.level, calm: place?.kind ?? '', damage: s.damageMul, biome: s.biome, streamed: 0, hostileOnScreen: 0, popIns: 0 });
    }
    const part = parts[parts.length - 1];
    if (place) {
      part.streamed = s.nextClump - clumps;
      for (let i = 0; i < s.ents.highWater; i++) {
        if (!hostile(i) || s.ents.x[i] < s.camX || s.ents.x[i] > s.camX + VIEW_W) continue;
        if (t > enteredAt + 1) part.hostileOnScreen++;
        if (before[i] !== Kind.Mob) part.popIns++; // a mob that was not there a tick ago, already on screen
      }
    }
  }
  return { s, won: s.phase === Phase.Won, parts, bought: s.wares.filter((w) => w.sold).length, scenesLeft };
}

// one run shared by the tests below: four levels (the third ends in a boss that is not the last), with camps and a road scene
const run = walkRoad(3, 4, 120_000);

test('a simulated player walks the whole road in one sim, through every level, scene and camp, and wins at the last boss', () => {
  assert.ok(run.won, `the run was won (last part ${JSON.stringify(run.parts.at(-1))})`);
  const camps = run.parts.filter((p) => p.calm === 'camp').map((p) => p.level);
  assert.deepEqual(camps, [0, 1, 2]);
  assert.ok(run.parts.some((p) => p.calm === 'fork'), 'it came through the crossroads');
  assert.equal(run.s.road!.choices.length, 1, 'and chose its road there');
  assert.ok(run.parts.some((p) => p.level === 3), 'the first boss did not end the run: the road went on past its lair');
});

test('each level plays with its own damage and biome, as its level plan says', () => {
  for (const p of run.parts.filter((q) => !q.calm)) {
    const lp = roadLevel(run.s.road!, p.level);
    assert.equal(p.damage, lp.damage, `level ${p.level} damage`);
    assert.equal(p.biome, lp.biome, `level ${p.level} biome`);
  }
});

test('in a calm place no horde is on screen and nothing pops up: stragglers walk off, and the road ahead is far enough away to stream in unseen', () => {
  const calm = run.parts.filter((p) => p.calm);
  assert.ok(calm.length >= 3);
  for (const p of calm) {
    assert.equal(p.hostileOnScreen, 0, `no hostile on screen in the ${p.calm} of level ${p.level}`);
    assert.equal(p.popIns, 0, `nothing appeared on screen in the ${p.calm} of level ${p.level}`);
    assert.equal(p.streamed, 0, `no encounter streamed in while in the ${p.calm} of level ${p.level}`);
  }
  assert.ok(run.bought > 0, 'the player bought something at the last camp');
});

test('a road scene is let go only once its figures are out of sight behind the screen', () => {
  assert.ok(run.scenesLeft.length > 0, 'the run passed a road scene');
  for (const d of run.scenesLeft) assert.ok(d > 100, `the scene was let go with the screen's left edge only ${Math.round(d)} px past it`);
});

test('a straggler that follows the party into a calm place walks off the way it came', () => {
  const s = createSim(6, undefined, { road: { total: 2 } });
  const camp = s.road!.layout.calm.find((c) => c.kind === 'camp')!;
  s.camX = s.prevCamX = s.camMax = s.trigCamX = camp.from - VIEW_W / 2 - 30;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = camp.from + 40; s.ents.y[pe] = 120;
  s.tick = 200;
  const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, camp.from - 60, 120, MOBS[MobType.Goblin].hp);
  s.ents.flags[m] = 1;
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].moveX = 127;
  for (let t = 0; t < 40 && !s.road!.camp; t++) step(s, f);
  assert.ok(s.road!.camp, 'the party is in the camp');
  assert.ok(!s.ents.alive[m] || (s.ents.flags[m] & 8), 'the goblin turned to leave');
  for (let t = 0; t < 600 && s.ents.alive[m] && s.ents.kind[m] === Kind.Mob; t++) step(s, f);
  assert.ok(!(s.ents.alive[m] && s.ents.kind[m] === Kind.Mob), 'and is gone');
});

test('a save taken on the road restores and plays on identically through a camp', () => {
  const make = () => createSim(9, undefined, { road: { total: 2 } });
  const drive = (s: GameState, pilot: Pilot, ticks: number) => {
    const f = [0, 1, 2, 3].map(createInputFrame);
    for (let t = 0; t < ticks; t++) { pilot.drive(s, f[0], s.road!.camp ? { allDone: false } : undefined); step(s, f); s.events.n = 0; }
  };
  // the pilot's own memory is not part of the sim, so each side gets a pilot that has seen the same game
  const a = make();
  drive(a, new Pilot(0, resolveSkill('expert'), 9), 8000);
  const text = snapshot(a);
  const b = restore(text), c = restore(text);
  drive(b, new Pilot(0, resolveSkill('expert'), 9), 4000); drive(c, new Pilot(0, resolveSkill('expert'), 9), 4000);
  assert.equal(snapshot(b), snapshot(c));
});

test('jumping to a level (dev) passes the road behind: nothing behind streams in, and the gates behind are open', () => {
  const s = createSim(4, undefined, { road: { total: 6 } });
  roadJump(s, 4);
  assert.equal(s.road!.level, 4);
  assert.ok(s.plan.slice(s.nextClump).every((c) => c.x >= s.camX));
  assert.ok(s.gates.slice(s.gateIdx).every((g) => g.x >= s.camX));
});

// ---- Crossroads (docs/21-the-road.md, step 5)

test('a crossroads closes every region but the last, past its last camp, offering two other biomes', () => {
  const lay = layoutRoad(8, ROUTE_LEVELS);
  const forks = lay.calm.filter((c) => c.kind === 'fork');
  assert.equal(forks.length, ROUTE_LEVELS / 3 - 1);
  for (const f of forks) {
    const i = lay.calm.indexOf(f);
    assert.equal(lay.calm[i - 1].kind, 'camp', 'it opens from the region\'s last camp');
    assert.equal(lay.calm[i - 1].to, f.from);
    assert.equal(f.level % 3, 2, 'after the third level of the region');
    assert.equal(f.options!.length, 2);
    assert.notEqual(f.options![0], f.options![1]);
  }
  for (let seed = 1; seed < 40; seed++) {
    const opts = forkOptions(seed, 1, [0]);
    assert.ok(!opts.includes(0), 'never back into the biome being left');
    assert.deepEqual(opts, forkOptions(seed, 1, [0]), 'a function of the seed');
  }
});

test('nothing past a crossroads is planned before the party chooses', () => {
  const s = createSim(8, undefined, { road: { total: 6 } });
  const fork = s.road!.layout.calm.find((c) => c.kind === 'fork')!;
  s.camX = s.prevCamX = s.camMax = s.trigCamX = fork.from - VIEW_W / 2;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = fork.from + 40;
  step(s, [0, 1, 2, 3].map(createInputFrame));
  assert.equal(s.road!.planned, 3, 'the first region is planned, the next is not');
  assert.equal(s.road!.calm, s.road!.layout.calm.indexOf(fork), 'the party is at the crossroads');
});

test('the party chooses by walking: the side most heroes stand on when one crosses the line, a tie to the first hero', () => {
  const s = createSim(8, undefined, { road: { total: 6 } });
  activatePlayer(s, 1, 0, 0); activatePlayer(s, 2, 0, 0);
  const fork = s.road!.layout.calm.find((c) => c.kind === 'fork')!;
  const place = (k: number, x: number, y: number) => { const e = s.players[k].ent; s.ents.x[e] = x; s.ents.y[e] = y; };
  place(0, fork.commit! - 50, 40); place(1, fork.commit! - 80, 200); place(2, fork.commit! - 90, 210);
  assert.equal(forkChoice(s, fork), -1, 'nobody has crossed yet');
  place(0, fork.commit! + 1, 40);
  assert.equal(forkChoice(s, fork), 1, 'two of three on the lower road');
  s.players[2].downed = true;
  assert.equal(forkChoice(s, fork), 0, 'a downed hero has no say: a tie, and the first hero is on the upper road');
});

test('choosing a road lays out the road ahead for that biome, and leaves what lies behind as it was', () => {
  const s = createSim(8, undefined, { road: { total: 9 } });
  const before = structuredClone(s.road!.layout);
  const fork = s.road!.layout.calm.find((c) => c.kind === 'fork')!;
  commitFork(s, fork, 1);
  assert.deepEqual(s.road!.choices, [1]);
  assert.equal(s.road!.biomes[1], fork.options![1]);
  assert.equal(roadLevel(s.road!, 3).biome, fork.options![1], 'the next region is the chosen biome');
  const after = s.road!.layout;
  const cut = before.calm.findIndex((c: Calm) => c.kind === 'fork');
  assert.deepEqual(after.calm.slice(0, cut + 1), before.calm.slice(0, cut + 1), 'the road up to the crossroads is unchanged');
  assert.deepEqual(after.levels.slice(0, 3), before.levels.slice(0, 3));
  assert.equal(s.worldW, after.length);
  const other = layoutRoad(8, 9, roadBiomes(8, 9, [0]));
  assert.notDeepEqual(other.levels[3], after.levels[3], 'the other road would have been another road');
});

test('a run saved at a crossroads, after the choice, continues down the chosen road', () => {
  const s = createSim(8, undefined, { road: { total: 6 } });
  const fork = s.road!.layout.calm.find((c) => c.kind === 'fork')!;
  commitFork(s, fork, 1);
  const back = restore(snapshot(s));
  assert.deepEqual(back.road!.choices, [1]);
  assert.deepEqual(back.road!.biomes, s.road!.biomes);
  assert.deepEqual(back.road!.layout, s.road!.layout);
});
