import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pilot } from '../ai/pilot';
import { resolveSkill } from '../ai/skill';
import { levelPlan, ROUTE_LEVELS } from '../campaign/route';
import { ROAD_STRIDE, VIEW_W, WORLD_W } from './constants';
import { MOBS, MobType } from '../data/mobs';
import { allocEntity, BYSTANDER, Kind, SURRENDERED } from './entities';
import { activatePlayer } from './state';
import { planLevel } from './gen/level';
import { roadSceneFor, roadSceneT } from '../data/story/road';
import { campAfter, sceneAt, CLEAR_AFTER, CLEAR_BEFORE, commitFork, forkChoice, forkOptions, layoutRoad, levelToRoad, roadBiomes, roadJump, roadLevel, roadPart, stageBounds, stageOf, type Calm } from './gen/road';
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
    assert.equal(calm.filter((c) => c.kind === 'camp').length, Array.from({ length: ROUTE_LEVELS }, (_, k) => k).filter((k) => campAfter(seed, k, ROUTE_LEVELS)).length);
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

test('the road grows around its calm places, and no longer than the old levels and stores did', () => {
  const lay = layoutRoad(5, ROUTE_LEVELS);
  for (let k = 1; k < lay.levels.length; k++) assert.ok(lay.levels[k].slices[0].dx > lay.levels[k - 1].slices[lay.levels[k - 1].slices.length - 1].dx, `level ${k} begins after level ${k - 1}`);
  assert.ok(lay.calm.length >= ROUTE_LEVELS, 'a camp after every level but the last, and road scenes');
  assert.ok(lay.length < ROUTE_LEVELS * ROAD_STRIDE, `the road (${Math.round(lay.length)} px) is shorter than the old route (${ROUTE_LEVELS * ROAD_STRIDE}): the empty ground is kept as short as the guarantees allow`);
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
    // its own field, the encounters its road scene's clearing left (the road grows for the scene, the horde is as tuned)
    const sc = sceneAt(12, k, lp);
    const own = planLevel(lp.seed, undefined, { boss: lp.boss, scale: lp.scale, heat: 0, opener: k === 0, length: WORLD_W, scene: sc ? { id: sc.id, t: roadSceneT(lp.seed) } : undefined }).filter((c) => !c.scene);
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
  const s = createSim(seed, undefined, { road: { total, hard: 0.7 } }); // (the road's flow, not its difficulty: an easier road than the base game's)
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

// one run shared by the tests below: four levels (the third ends in a boss that is not the last), with camps, a crossroads and a road
// scene; a seed the expert gets all the way through (on some the last boss wins, which is the game, but this run is here to see the whole road)
const run = walkRoad(4, 4, 120_000);

test('a simulated player walks the whole road in one sim, through every level, scene and camp, and wins at the last boss', () => {
  assert.ok(run.won, `the run was won (last part ${JSON.stringify(run.parts.at(-1))})`);
  const camps = run.parts.filter((p) => p.calm === 'camp').map((p) => p.level);
  assert.deepEqual(camps, [0, 1, 2].filter((k) => campAfter(4, k, 4)));
  assert.ok(run.parts.some((p) => p.calm === 'fork'), 'it came through the crossroads');
  assert.equal(run.s.road!.choices.length, 1, 'and chose its road there');
  assert.ok(run.parts.some((p) => p.level === 3), 'the first boss did not end the run: the road went on past its lair');
});

test('each level plays with its own damage and biome, as its level plan says', () => {
  for (const p of run.parts.filter((q) => !q.calm)) {
    const lp = roadLevel(run.s.road!, p.level);
    assert.equal(p.damage, lp.damage * run.s.road!.hard, `level ${p.level} damage`);
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
  const s = createSim(6, undefined, { road: { total: 4 } });
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

// ---- Quests on the road (docs/21-the-road.md, step 7)

/** Moves the camera (and the party) so its centre is at road x `c`, and steps once so the road takes note. */
function centreAt(s: GameState, c: number): void {
  s.camX = s.prevCamX = s.trigCamX = c - VIEW_W / 2;
  s.camMax = Math.max(s.camMax, s.camX);
  for (const p of s.players) if (p.active) { s.ents.x[p.ent] = s.ents.px[p.ent] = c - 40; s.ents.y[p.ent] = s.ents.py[p.ent] = 120; }
  step(s, [0, 1, 2, 3].map(createInputFrame));
}

test('a quest taken in a camp runs through the next level and is settled at the camp after it', () => {
  const s = createSim(23, undefined, { road: { total: 3 } });
  s.road!.town = false;
  const camps = s.road!.layout.calm.filter((c) => c.kind === 'camp');
  centreAt(s, (camps[0].from + camps[0].to) / 2);
  assert.equal(s.offers.length, 3, 'givers in the first camp');
  const escort = s.offers.findIndex((q) => q.mission === 'escort' || q.mission === 'flawless' || q.mission === 'cull' || q.mission === 'swift');
  s.questTaken = escort;
  const mission = s.offers[escort].mission;
  centreAt(s, s.road!.layout.levels[1].start + 10);
  assert.ok(s.quest, 'the quest began as the party walked into the next level');
  assert.ok(s.quest!.startTick > 0, "a race would count from here, not from the start of the run");
  assert.equal(s.offers.length, 0);
  if (mission === 'escort') assert.ok(s.quest!.ent >= 0 && s.ents.kind[s.quest!.ent] === Kind.Npc, 'the ward walks with the party');
  centreAt(s, (camps[1].from + camps[1].to) / 2);
  assert.notEqual(s.quest!.status, 0, `the ${mission} was settled at the next camp`);
});

test('there are no quest-givers in the camp before a crossroads: the level beyond is not known yet', () => {
  const s = createSim(23, undefined, { road: { total: 6 } });
  s.road!.town = false;
  const fork = s.road!.layout.calm.find((c) => c.kind === 'fork')!;
  const before = s.road!.layout.calm[s.road!.layout.calm.indexOf(fork) - 1];
  centreAt(s, (before.from + before.to) / 2);
  assert.ok(s.road!.camp);
  assert.equal(s.offers.length, 0);
});

test('the party rests at a camp: on its feet, at full health, rid of what ailed it', () => {
  const s = createSim(23, undefined, { road: { total: 3 } });
  s.road!.town = false;
  activatePlayer(s, 1, 0, 0);
  const camp = s.road!.layout.calm.find((c) => c.kind === 'camp')!;
  centreAt(s, camp.from - 200);
  s.ents.hp[s.players[0].ent] = 5; s.players[0].poisonT = 300;
  s.players[1].downed = true; s.ents.hp[s.players[1].ent] = 0;
  centreAt(s, (camp.from + camp.to) / 2);
  assert.ok(s.road!.camp);
  assert.equal(s.ents.hp[s.players[0].ent], s.ents.maxhp[s.players[0].ent]);
  assert.equal(s.players[0].poisonT, 0);
  assert.equal(s.players[1].downed, false);
  assert.equal(s.ents.hp[s.players[1].ent], s.ents.maxhp[s.players[1].ent]);
});

// ---- Empty ground kept short (docs/21-the-road.md, step 7 and the balance pass)

test('nothing streams in while the party is in a calm place, and the crowd after it appears just off the right edge the moment it leaves', () => {
  const s = createSim(23, undefined, { road: { total: 3 } });
  s.road!.town = false;
  const camp = s.road!.layout.calm.find((c) => c.kind === 'camp')!;
  s.tick = 300;
  // in the camp, with the next crowd's place on the plan well inside the view (the road no longer puts it far away)
  centreAt(s, (camp.from + camp.to) / 2);
  const before = s.nextClump;
  const next = s.plan[before];
  assert.ok(next, 'a crowd is planned after the camp');
  for (let t = 0; t < 30; t++) step(s, [0, 1, 2, 3].map(createInputFrame));
  assert.equal(s.nextClump, before, 'nothing streams in while the party is in the camp');
  // the party walks out of the camp
  const mobsBefore = new Set<number>();
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Mob) mobsBefore.add(i);
  centreAt(s, camp.to + 4);
  assert.ok(s.nextClump > before, 'the crowd streams in as the party leaves');
  let nearest = Infinity;
  for (let i = 0; i < s.ents.highWater; i++) {
    if (!s.ents.alive[i] || s.ents.kind[i] !== Kind.Mob || mobsBefore.has(i)) continue;
    nearest = Math.min(nearest, s.ents.x[i] - (s.camX + VIEW_W));
  }
  assert.ok(nearest >= 0 && Number.isFinite(nearest), `every new mob is beyond the right edge (the nearest ${Math.round(nearest)} px past it)`);
});

test('a camp\'s people and goods are set out before the party can see them', () => {
  const s = createSim(23, undefined, { road: { total: 3 } });
  s.road!.town = false;
  const camp = s.road!.layout.calm.find((c) => c.kind === 'camp')!;
  // the camera's right edge has only just reached the stall's ground: the goods exist, and nothing of the camp is yet on screen
  s.tick = 300;
  s.camX = s.prevCamX = s.camMax = s.trigCamX = camp.from - 700;
  step(s, [0, 1, 2, 3].map(createInputFrame));
  assert.equal(s.wares.length, 4);
  assert.equal(s.offers.length, 3);
  assert.equal(s.gifts.length, 2);
  const firstThing = Math.min(s.shopX + 430, s.shopX + 520); // the first quest-giver and the first gift
  assert.ok(firstThing > s.camX + VIEW_W, 'they stand beyond the right edge of the screen');
});

test('the last crowd before every calm place holds the party with a gate: nobody walks into a camp or a scene with a fight still on', () => {
  for (const seed of [3, 9, 14]) {
    const s = plannedRoad(seed, ROUTE_LEVELS);
    for (const p of s.road!.layout.calm) {
      if (p.kind !== 'camp' && p.kind !== 'scene') continue;
      let last = -1;
      s.plan.forEach((c, i) => { if (!c.scene && c.beat === undefined && c.x < p.from && (last < 0 || c.x > s.plan[last].x)) last = i; });
      assert.ok(last >= 0);
      assert.ok(s.gates.some((g) => g.clump === last && g.x < p.from), `seed ${seed}: the last crowd before the ${p.kind} at ${Math.round(p.from)} has a gate`);
    }
  }
});

test('progress made while the director is held back near a calm place is banked, and paid out as packs once the party has moved on', () => {
  // a seed whose road has a scene in its first level and, in a level before the boss's, a stretch long enough to walk clear of every calm place
  const stretch = (seed: number) => {
    const lay = layoutRoad(seed, 4), calm = lay.calm;
    for (let i = 1; i + 1 < calm.length; i++) {
      if (roadPart(lay, (calm[i].to + calm[i + 1].from) / 2).level < 2 && calm[i + 1].from - calm[i].to > VIEW_W + 500) return i;
    }
    return -1;
  };
  let seed = 23;
  while (!layoutRoad(seed, 4).calm.some((c) => c.kind === 'scene' && c.level === 0) || stretch(seed) < 0) seed++;
  const s = createSim(seed, undefined, { road: { total: 4 } });
  s.road!.town = false;
  s.tick = 300;
  const scene = s.road!.layout.calm.find((c) => c.kind === 'scene')!;
  // walking the last stretch before the scene: the calm place is on the screen, so no packs, but the progress counts
  for (let x = scene.from - 700; x < scene.from - 300; x += 40) centreAt(s, x);
  assert.ok(s.packDebt > 0, `the held-back progress is banked (${s.packDebt})`);
  assert.ok(s.flankDebt > 0);
  // on a long stretch where no calm place is near the screen, the debt is paid out as the party walks
  const owed = s.packDebt;
  const calm = s.road!.layout.calm, best = stretch(seed);
  const lo = calm[best].to + VIEW_W / 2, hi = calm[best + 1].from - VIEW_W / 2 - 100;
  assert.ok(hi > lo, 'there is a stretch clear of calm places');
  let peak = owed;
  for (let x = lo; x < hi; x += 20) { centreAt(s, x); peak = Math.max(peak, s.packDebt); }
  assert.ok(s.packDebt < peak, 'and it is paid out once the party has moved on');
});

test('road scenes are drawn from the seed, a region may have none, and a skipped scene never moves the story on', () => {
  const counts = new Set<number>();
  for (let seed = 1; seed <= 60; seed++) {
    const total = ROUTE_LEVELS;
    const ids: string[][] = [];
    for (let k = 0; k < total; k++) {
      const lp = levelPlan(seed, k, total);
      const sc = sceneAt(seed, k, lp);
      if (k % 3 === 2) assert.equal(sc, undefined, 'no scene on a boss level');
      (ids[stageOf(k)] ??= []);
      if (sc) { assert.equal(sc.chapter, lp.chapter); ids[stageOf(k)].push(sc.id); }
    }
    ids.forEach((region, st) => {
      counts.add(region.length);
      // what a region stages is its chapter's scenes from the first, in order, none passed over
      assert.deepEqual(region, ['a', 'b'].slice(0, region.length).map((x) => `c${st + 1}${x}`), `seed ${seed} region ${st}`);
    });
  }
  assert.deepEqual([...counts].sort(), [0, 1, 2], 'regions have no scene, one or both');
});
