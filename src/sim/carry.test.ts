import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { UPGRADE_INDEX, UPGRADES } from '../data/upgrades';
import { hasBoss, planLevel } from './gen/level';
import { applyCarry, captureCarry, restCarry } from './carry';
import { activatePlayer, createSim, Phase } from './state';
import { choosePick, step } from './step';
import { Btn, createInputFrame } from './input';
import { WORLD_W } from './constants';

const idle = () => [0, 1, 2, 3].map(createInputFrame);

test('a party carries its growth, health, gold and tallies into the next level', () => {
  const a = createSim(11, undefined, { offerSeed: 99 });
  activatePlayer(a, 1, 60, 80);
  a.players[0].classId = 1; a.players[1].classId = 4;
  a.players[0].level = 5; a.players[0].xp = 17; a.players[0].pending = 2; a.players[0].ranks[UPGRADE_INDEX.heavy] = 3; a.players[0].coins = 40; a.players[0].kills = 120;
  a.players[1].level = 4; a.players[1].pending = 1;
  a.ents.hp[a.players[0].ent] = CLASSES[1].hp / 2;
  a.gold = 77; a.kills = 300; a.slain[0] = 250; a.slain[1] = 50; a.spared[0] = 4; a.betrayed = 2; a.surrenders = 9;
  const c = captureCarry(a);
  assert.equal(c.players[2], null);
  assert.ok(Math.abs(c.players[0]!.hpFrac - 0.5) < 1e-9);

  const b = createSim(22, undefined, { offerSeed: 99 });
  applyCarry(b, c);
  assert.equal(b.players[0].classId, 1);
  assert.equal(b.players[1].active, true, 'the second hero is back');
  assert.equal(b.players[1].classId, 4);
  assert.equal(b.players[2].active, false);
  assert.equal(b.players[0].level, 5); assert.equal(b.players[0].xp, 17); assert.equal(b.players[0].pending, 2);
  assert.equal(b.players[0].ranks[UPGRADE_INDEX.heavy], 3);
  assert.equal(b.players[0].coins, 40); assert.equal(b.players[0].kills, 120);
  assert.ok(Math.abs(b.ents.hp[b.players[0].ent] - CLASSES[1].hp / 2) < 1e-9);
  assert.equal(b.ents.maxhp[b.players[0].ent], CLASSES[1].hp);
  assert.equal(b.gold, 77); assert.equal(b.kills, 300);
  assert.equal(b.slain[0], 250); assert.equal(b.slain[1], 50); assert.equal(b.spared[0], 4);
  assert.equal(b.betrayed, 2); assert.equal(b.surrenders, 9);
  assert.equal(b.offerSeed, 99, 'offers are drawn from the run seed in every level');
  assert.equal(b.players[0].ranks.length, UPGRADES.length);
});

test('the camp rests the party: everyone, downed or not, is back at full health', () => {
  const a = createSim(3);
  a.ents.hp[a.players[0].ent] = 1;
  const c = captureCarry(a);
  assert.ok(c.players[0]!.hpFrac < 0.05);
  const downed = createSim(3);
  downed.players[0].downed = true;
  assert.equal(captureCarry(downed).players[0]!.hpFrac, 0);
  const b = createSim(4);
  applyCarry(b, restCarry(captureCarry(downed)));
  assert.equal(b.players[0].downed, false);
  assert.equal(b.ents.hp[b.players[0].ent], CLASSES[b.players[0].classId].hp);
});

test('picks made at the camp are in the carry, and a pick left pending stays pending', () => {
  const a = createSim(8);
  a.players[0].level = 3; a.players[0].pending = 2;
  choosePick(a, 0, 0);
  const c = captureCarry(a);
  assert.equal(c.players[0]!.pending, 1);
  assert.equal(c.players[0]!.ranks.reduce((x, y) => x + y, 0), 1);
  const b = createSim(9);
  applyCarry(b, c);
  assert.equal(b.players[0].pending, 1);
});

test('a level that is not the last has no boss and is won by reaching the far end', () => {
  const withBoss = planLevel(5, undefined, { boss: true });
  const without = planLevel(5, undefined, { boss: false });
  assert.equal(withBoss.length, without.length + 1);
  assert.ok(withBoss.some((c) => c.boss));
  assert.ok(!without.some((c) => c.boss));
  assert.deepEqual(planLevel(5), withBoss, 'a boss is the default');
  const s = createSim(5, undefined, { boss: false });
  assert.equal(hasBoss(s), false);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === 2) s.ents.alive[i] = 0;
  s.ents.hp[s.players[0].ent] = 1e6;
  s.camX = s.prevCamX = WORLD_W - 640; // (the camera tethers the party)
  s.ents.x[s.players[0].ent] = WORLD_W - 60;
  step(s, idle());
  assert.equal(s.phase, Phase.Won);
  const boss = createSim(5);
  boss.camX = boss.prevCamX = WORLD_W - 640;
  boss.ents.x[boss.players[0].ent] = WORLD_W - 60;
  boss.spawnTimer = 1e9; boss.flankTimer = 1e9; boss.nextClump = boss.plan.length;
  step(boss, idle());
  assert.equal(boss.phase, Phase.Playing, 'with a boss, reaching the end is not enough');
});

test('the boss option does not change the other encounters of a level', () => {
  const a = planLevel(12, { id: 'R1' }, { boss: true }), b = planLevel(12, { id: 'R1' }, { boss: false });
  assert.deepEqual(a.filter((c) => !c.boss), b);
});

test('a carried sim still plays: the party can fight and the hash is stable', () => {
  const run = () => {
    const a = createSim(5); a.players[0].level = 3; a.players[0].ranks[0] = 2; a.gold = 10;
    const b = createSim(6); applyCarry(b, captureCarry(a));
    for (let t = 0; t < 300; t++) { const f = idle(); f[0].buttons = Btn.Attack; f[0].moveX = 100; step(b, f); }
    return b;
  };
  assert.equal(run().kills, run().kills);
  assert.ok(run().gold >= 10);
});
