import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, MobType } from '../data/mobs';
import { MAX_LEVEL, OFFER_SIZE, UPGRADES, UPGRADE_INDEX, damageMul, offerFor, speedMul, takenMul, xpToNext } from '../data/upgrades';
import { allocEntity, freeEntity, Kind } from './entities';
import { Ev, EV_STRIDE } from './events';
import { hashState } from './hash';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { hurtPlayer, step } from './step';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
function hold(buttons: number, moveX = 0, slot = 0): InputFrame[] {
  const f = idle();
  f[slot].buttons = buttons;
  f[slot].moveX = moveX;
  return f;
}

/** An empty field with the hero at (100, 100) and `pending` level-ups waiting. */
function arena(pending = 1, seed = 4): GameState {
  const s = createSim(seed);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = 100; s.ents.y[pe] = s.ents.py[pe] = 100;
  s.ents.hp[pe] = 1e6;
  s.camX = s.prevCamX = 0;
  s.players[0].level = 1 + pending;
  s.players[0].pending = pending;
  return s;
}
function eventCount(s: GameState, type: number): number {
  let n = 0;
  for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === type) n++;
  return n;
}
const tap = (s: GameState, buttons: number, moveX = 0) => { step(s, hold(buttons, moveX)); step(s, idle()); };

test('XP is shared: every kill feeds the whole party, and enough of it is a pending level', () => {
  const s = createSim(3);
  s.players[1].active = true; // a second hero, without bothering to spawn their body
  s.players[1].ent = s.players[0].ent;
  const need = xpToNext(1);
  const g = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 130, 100, 1);
  s.ents.flags[g] = 1;
  s.ents.x[s.players[0].ent] = 110; s.ents.y[s.players[0].ent] = 100;
  s.players[0].xp = need - 1; s.players[1].xp = need - 1;
  for (let t = 0; t < 60 && s.players[0].pending === 0; t++) step(s, hold(Btn.Attack));
  assert.equal(s.players[0].level, 2);
  assert.equal(s.players[0].pending, 1);
  assert.equal(s.players[1].pending, 1, 'the second hero levels with them');
  assert.equal(s.players[0].xp, 0);
  assert.ok(eventCount(s, Ev.LevelUp) >= 2);
});

test('the XP curve rises and the level cap holds', () => {
  for (let l = 1; l < MAX_LEVEL; l++) assert.ok(xpToNext(l + 1) > xpToNext(l));
  const s = createSim(3);
  s.players[0].level = MAX_LEVEL;
  s.players[0].xp = 1e9;
  const g = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 130, 100, 1);
  s.ents.flags[g] = 1;
  s.ents.x[s.players[0].ent] = 110; s.ents.y[s.players[0].ent] = 100;
  for (let t = 0; t < 60; t++) step(s, hold(Btn.Attack));
  assert.equal(s.players[0].level, MAX_LEVEL);
  assert.equal(s.players[0].pending, 0);
});

test('nothing opens by itself, and Level does nothing with no level pending', () => {
  const s = arena(1);
  for (let t = 0; t < 120; t++) step(s, idle());
  assert.equal(s.players[0].panel, false);
  const none = arena(0);
  tap(none, Btn.Level);
  assert.equal(none.players[0].panel, false);
});

test('the Level button opens the panel and again closes it, leaving the pick pending', () => {
  const s = arena(1);
  tap(s, Btn.Level);
  assert.equal(s.players[0].panel, true);
  tap(s, Btn.Level);
  assert.equal(s.players[0].panel, false);
  assert.equal(s.players[0].pending, 1);
});

test('with the panel open the hero can do nothing, but the world and everyone else carry on', () => {
  const s = arena(1);
  const pe = s.players[0].ent;
  const g = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 300, 100, 1000);
  s.ents.flags[g] = 1;
  tap(s, Btn.Level);
  const x0 = s.ents.x[pe], gx0 = s.ents.x[g], tick0 = s.tick;
  const f2 = idle(); // (any face button, dodge included, would pick a card)
  f2[0].moveY = 127;
  for (let t = 0; t < 60; t++) step(s, f2);
  assert.equal(s.ents.x[pe], x0, 'no movement');
  assert.equal(s.players[0].cdAttack, 0, 'no swing');
  assert.ok(s.ents.x[g] < gx0, 'the goblin kept walking at them');
  assert.ok(s.tick > tick0 + 50, 'the game did not pause');
  assert.equal(s.players[0].panel, true, 'and it is still open');
});

test('another player is unaffected while one is choosing', () => {
  const s = arena(1);
  s.players[1].active = true;
  s.players[1].ent = allocEntity(s.ents, Kind.Player, 1, 150, 100, 1e6);
  tap(s, Btn.Level);
  const p1 = s.players[1].ent;
  const x0 = s.ents.x[p1];
  const f = idle();
  f[1].moveX = 127;
  for (let t = 0; t < 30; t++) step(s, f);
  assert.ok(s.ents.x[p1] > x0 + 10, 'the second hero walks');
});

test('three face buttons choose cards 1, 2 and 3; the choice applies and spends the level', () => {
  for (const [button, card] of [[Btn.Attack, 0], [Btn.Ability1, 1], [Btn.Ability2, 2]] as const) {
    const s = arena(1);
    const offer = offerFor(s.seed, 0, 2, s.players[0].ranks);
    tap(s, Btn.Level);
    step(s, hold(button));
    assert.equal(s.players[0].pending, 0);
    assert.equal(s.players[0].panel, false);
    const total = s.players[0].ranks.reduce((a, b) => a + b, 0);
    assert.equal(total, 1);
    assert.ok(s.players[0].ranks[offer[card]] === 1 || offer[card] === UPGRADE_INDEX.wind, `card ${card + 1} is ${UPGRADES[offer[card]].id}`);
    assert.equal(eventCount(s, Ev.Pick), 1);
  }
});

test('choosing a card does not swing a sword: the pick button stays muted until it is let go', () => {
  const s = arena(1);
  tap(s, Btn.Level);
  for (let t = 0; t < 40; t++) step(s, hold(Btn.Attack)); // mashing attack through the pick
  assert.equal(s.players[0].pending, 0);
  assert.equal(s.players[0].cdAttack, 0, 'no swing while the pick button is held');
  step(s, idle());
  step(s, hold(Btn.Attack));
  assert.ok(s.players[0].cdAttack > 0 || s.players[0].combo > 0, 'released and pressed again: it swings');
});

test('pending levels queue: each opens in turn, and the offer follows the level reached', () => {
  const s = arena(3);
  const first = offerFor(s.seed, 0, 2, s.players[0].ranks);
  tap(s, Btn.Level);
  step(s, hold(Btn.Attack));
  step(s, idle());
  assert.equal(s.players[0].pending, 2);
  tap(s, Btn.Level);
  assert.equal(s.players[0].panel, true);
  const second = offerFor(s.seed, 0, 3, s.players[0].ranks);
  assert.notDeepEqual(second, first, 'a different level offers differently (for this seed)');
});

test('a hero who goes down has the panel closed, and the pick waits', () => {
  const s = arena(1);
  tap(s, Btn.Level);
  s.ents.hp[s.players[0].ent] = 1;
  hurtPlayer(s, 0, 50);
  for (let t = 0; t < 6; t++) step(s, idle()); // (a hit-stop may swallow a tick)
  assert.equal(s.players[0].downed, true);
  assert.equal(s.players[0].panel, false);
  assert.equal(s.players[0].pending, 1);
});

test('offers are three distinct upgrades, a pure function of seed, slot and level', () => {
  for (let seed = 1; seed < 40; seed++) {
    for (let level = 2; level < 8; level++) {
      const a = offerFor(seed, 0, level), b = offerFor(seed, 0, level);
      assert.deepEqual(a, b);
      assert.equal(a.length, OFFER_SIZE);
      assert.equal(new Set(a).size, OFFER_SIZE);
    }
  }
  const slots = new Set([0, 1, 2, 3].map((k) => offerFor(5, k, 2).join()));
  assert.ok(slots.size > 1, 'players are offered different things');
  const maxed = new Uint8Array(UPGRADES.length);
  maxed[UPGRADE_INDEX.heavy] = UPGRADES[UPGRADE_INDEX.heavy].maxRank;
  for (let level = 2; level < 30; level++) assert.ok(!offerFor(9, 0, level, maxed).includes(UPGRADE_INDEX.heavy), 'a maxed upgrade is not offered');
});

test('the upgrades do what they say', () => {
  const r = new Uint8Array(UPGRADES.length);
  assert.equal(damageMul(r), 1); assert.equal(takenMul(r), 1); assert.equal(speedMul(r), 1);
  r[UPGRADE_INDEX.heavy] = 2; r[UPGRADE_INDEX.thick] = 1; r[UPGRADE_INDEX.swift] = 3;
  assert.ok(Math.abs(damageMul(r) - 1.3) < 1e-9);
  assert.ok(Math.abs(takenMul(r) - 0.88) < 1e-9);
  assert.ok(Math.abs(speedMul(r) - 1.24) < 1e-9);

  // damage dealt: a stronger hero kills a tougher mob in the same time
  const hits = (rank: number) => {
    const s = arena(0);
    s.players[0].ranks[UPGRADE_INDEX.heavy] = rank;
    const g = allocEntity(s.ents, Kind.Mob, MobType.Orc, 112, 100, MOBS[MobType.Orc].hp);
    s.ents.flags[g] = 1;
    let t = 0;
    while (s.ents.alive[g] && s.ents.kind[g] === Kind.Mob && t < 600) { step(s, hold(Btn.Attack)); t++; }
    return t;
  };
  assert.ok(hits(5) < hits(0), 'heavier hands kill faster');

  // damage taken
  const taken = (rank: number) => { const s = arena(0); s.ents.hp[s.players[0].ent] = 100; s.players[0].ranks[UPGRADE_INDEX.thick] = rank; hurtPlayer(s, 0, 50); return 100 - s.ents.hp[s.players[0].ent]; };
  assert.equal(taken(0), 50);
  assert.ok(taken(3) < 40);

  // speed
  const walked = (rank: number) => { const s = arena(0); s.players[0].ranks[UPGRADE_INDEX.swift] = rank; for (let t = 0; t < 30; t++) step(s, hold(0, 127)); return s.ents.x[s.players[0].ent] - 100; };
  assert.ok(walked(4) > walked(0) * 1.2);

  // second wind heals fully
  const s = arena(1);
  s.ents.hp[s.players[0].ent] = 5;
  const wind = offerFor(s.seed, 0, 2, s.players[0].ranks).indexOf(UPGRADE_INDEX.wind);
  if (wind >= 0) {
    tap(s, Btn.Level);
    step(s, hold([Btn.Attack, Btn.Ability1, Btn.Ability2][wind]));
    assert.ok(s.ents.hp[s.players[0].ent] > 50);
  }
});

test('levels, picks and ranks are part of the hash, and a run with picks is deterministic', () => {
  const run = () => { const s = arena(2, 11); tap(s, Btn.Level); step(s, hold(Btn.Ability1)); for (let t = 0; t < 100; t++) step(s, idle()); return s; };
  assert.equal(hashState(run()), hashState(run()));
  const a = arena(1), b = arena(1);
  b.players[0].ranks[0] = 1;
  assert.notEqual(hashState(a), hashState(b));
  const c = arena(1), d = arena(1);
  d.players[0].xp = 3;
  assert.notEqual(hashState(c), hashState(d));
  const e = arena(1), f = arena(1);
  tap(f, Btn.Level);
  assert.notEqual(hashState(e), hashState(f));
});

test('the stick steps a highlight along the cards and a confirm button takes the highlighted one', () => {
  const s = arena(1);
  tap(s, Btn.Level);
  step(s, hold(0, 127));
  step(s, idle());
  step(s, hold(0, 127));
  assert.equal(s.players[0].cursor, 2, 'one step per push');
  step(s, idle());
  step(s, hold(0, 127));
  assert.equal(s.players[0].cursor, 2, 'stops at the last card');
  const expected = offerFor(s.offerSeed, 0, s.players[0].level, s.players[0].ranks)[2];
  step(s, idle());
  tap(s, Btn.Dodge);
  assert.equal(s.players[0].pending, 0, 'the pick was made');
  assert.equal(s.players[0].ranks[expected], 1, 'it was the third card');
});
