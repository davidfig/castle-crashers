import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planGates, planLevel, SCENE_AHEAD, SCENE_CLEARING, spawnAllClumps } from './gen/level';
import { createSim } from './state';
import { sceneHold, sceneX, SCENE_RELEASE, streamLevel } from './gen/level';

test('a road scene clears the road around it and nothing else', () => {
  for (let seed = 1; seed < 40; seed++) {
    const plain = planLevel(seed).filter((c) => !c.elite);
    const plan = planLevel(seed, undefined, { scene: { id: 'c1a', t: 0.6 } }).filter((c) => !c.elite);
    const sc = plan.find((c) => c.scene)!;
    assert.ok(sc, 'the scene is in the plan');
    for (const c of plan) if (c !== sc) assert.ok(c.boss || c.rid! >= 24 || c.x <= sc.x - SCENE_CLEARING || c.x >= sc.x + SCENE_AHEAD, `seed ${seed}: crowd at ${c.x} near scene ${sc.x}`);
    // everything outside the clearing is exactly as without the scene
    const kept = plain.filter((c) => c.boss || c.rid! >= 24 || c.x <= sc.x - SCENE_CLEARING || c.x >= sc.x + SCENE_AHEAD);
    assert.deepEqual(plan.filter((c) => c !== sc), kept);
    for (const g of planGates(plan)) assert.ok(plan[g.clump].gate);
  }
});

test('no scene, no change: plans are as they were', () => {
  assert.deepEqual(planLevel(9, undefined, {}), planLevel(9));
});

test('the scene spawns nothing and the level is the same level otherwise', () => {
  const s = createSim(7, undefined, { scene: { id: 'c2b', t: 0.6 } });
  spawnAllClumps(s, 1);
  const withScene = s.ents.count;
  const base = createSim(7);
  spawnAllClumps(base, 1);
  assert.ok(withScene < base.ents.count, 'the clearing holds fewer enemies');
});

test('beyond a scene nothing streams in until the party has gone past it, and no reinforcements come while it is at the scene', () => {
  const s = createSim(11, undefined, { scene: { id: 'c1a', t: 0.5 } });
  const x = sceneX(s);
  assert.ok(x > 0 && s.sceneIndex >= 0);
  s.tick = 500;
  // the party is at the scene: the camera centre sits on it
  s.camX = x - 320;
  for (let k = 0; k < 5; k++) streamLevel(s);
  assert.ok(s.nextClump > s.sceneIndex, 'the scene itself streams in');
  assert.equal(s.nextClump, s.sceneIndex + 1, 'but nothing beyond it');
  assert.ok(sceneHold(s));
  // past it: the road beyond opens
  s.camX = x + SCENE_RELEASE + 10 - 320;
  assert.ok(!sceneHold(s));
  streamLevel(s);
  assert.ok(s.nextClump > s.sceneIndex + 1);
});
