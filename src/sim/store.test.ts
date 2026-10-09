import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORE_CAM_END, STORE_EXIT_X, STORE_W, STORE_X } from './constants';
import { arriveAt, applyCarry, captureCarry, restCarry } from './carry';
import { Btn, createInputFrame } from './input';
import { Kind } from './entities';
import { createSim, Phase } from './state';
import { step } from './step';

const idle = () => [0, 1, 2, 3].map(createInputFrame);

test('the store has nobody to fight: no plan, no gates, nothing ever spawns', () => {
  const s = createSim(11, undefined, { store: true });
  assert.equal(s.store, true);
  assert.equal(s.plan.length, 0);
  assert.equal(s.gates.length, 0);
  assert.equal(s.camX, 0);
  assert.equal(s.worldW, STORE_W);
  const frames = idle();
  frames[0].moveX = 127;
  for (let t = 0; t < 2400; t++) step(s, frames);
  let mobs = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Mob) mobs++;
  assert.equal(mobs, 0);
  assert.equal(s.phase, Phase.Won, 'walking on past the far end leaves the store');
  assert.ok(s.ents.x[s.players[0].ent] >= STORE_EXIT_X);
  assert.ok(s.camX <= STORE_CAM_END + 1e-6 && s.camX > STORE_CAM_END - 5, 'the camera ends where the next levels scenery begins');
  assert.ok(STORE_X - s.camX < -100, 'by then the peddler is well out of sight');
});

test('the store carries the party across: gold, ranks and levels, on their feet at full health', () => {
  const level = createSim(11, undefined, { boss: false });
  level.players[0].level = 4; level.players[0].pending = 1; level.players[0].ranks[3] = 2;
  level.gold = 77;
  level.ents.hp[level.players[0].ent] = 5;
  const carry = restCarry(captureCarry(level));
  const store = createSim(11, undefined, { store: true });
  applyCarry(store, carry);
  arriveAt(store, carry);
  const p = store.players[0];
  assert.equal(p.level, 4);
  assert.equal(p.pending, 1);
  assert.equal(p.ranks[3], 2);
  assert.equal(store.gold, 77);
  assert.equal(store.ents.hp[p.ent], store.ents.maxhp[p.ent]);
  assert.ok(Math.abs(store.ents.x[p.ent] - (level.ents.x[level.players[0].ent] - level.camX)) < 31, 'the hero stands in the same place on screen');
});

test('the store never offers Stand Down, so the trade button is only a trade button', () => {
  const s = createSim(11, undefined, { store: true, surrender: true });
  assert.equal(s.surrender, false);
  const f = idle();
  f[0].buttons = Btn.Interact;
  for (let t = 0; t < 30; t++) step(s, f);
  assert.equal(s.players[0].standT, 0);
});

test('a later level of a biome plans a bigger horde, and the default plan is unchanged', () => {
  const total = (scale?: number) => createSim(21, undefined, { boss: false, scale }).plan.reduce((a, c) => a + c.size, 0);
  assert.equal(total(), total(1));
  assert.ok(total(1.3) > total(1));
});
