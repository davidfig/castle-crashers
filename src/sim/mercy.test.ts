import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, MobType } from '../data/mobs';
import { STAND_RADIUS, STAND_TICKS, SURRENDER_HOLD, surrenderChance } from '../data/surrender';
import { allocEntity, freeEntity, Kind, SURRENDERED } from './entities';
import { hashState } from './hash';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { step } from './step';
import { planLevel, spawnClump } from './gen/level';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
function hold(buttons: number): InputFrame[] {
  const f = idle();
  f[0].buttons = buttons;
  return f;
}

/** The sim with the horde removed and the player at (100, 100). */
function arena(surrender = true, seed = 2): GameState {
  const s = createSim(seed, undefined, { surrender });
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9;
  s.flankTimer = 1e9;
  s.nextClump = s.plan.length;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = 100;
  s.ents.y[pe] = s.ents.py[pe] = 100;
  s.camX = s.prevCamX = 0;
  s.ents.hp[pe] = 1e6; // the tests are about mercy, not survival
  return s;
}
function mob(s: GameState, type: number, x: number, y: number, flags = 1): number {
  const i = allocEntity(s.ents, Kind.Mob, type, x, y, MOBS[type].hp);
  s.ents.flags[i] = flags;
  s.ents.face[i] = -1;
  return i;
}
const alive = (s: GameState, i: number) => s.ents.alive[i] === 1 && s.ents.kind[i] === Kind.Mob;
const surrendered = (s: GameState, i: number) => alive(s, i) && (s.ents.flags[i] & SURRENDERED) !== 0;

test('Stand Down does nothing until the campaign enables it', () => {
  const s = arena(false);
  for (let t = 0; t < 60; t++) step(s, hold(Btn.Interact | Btn.Attack));
  assert.equal(s.players[0].standT, 0);
  assert.ok(s.players[0].cdAttack > 0 || s.players[0].combo > 0 || s.players[0].comboTimer > 0, 'the attack still fires');
});

test('a hero standing down cannot attack, walks slowly, and is ready after a moment', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const f = hold(Btn.Interact | Btn.Attack | Btn.Ability1);
  f[0].moveX = 127;
  const x0 = s.ents.x[pe];
  for (let t = 0; t < STAND_TICKS; t++) step(s, f);
  assert.equal(s.players[0].standT, STAND_TICKS);
  assert.equal(s.players[0].cdAttack, 0, 'no swing');
  assert.equal(s.players[0].combo, 0);
  assert.ok(s.ents.x[pe] - x0 > 0 && s.ents.x[pe] - x0 < STAND_TICKS * 1.6 * 0.7, 'slow but moving');
  step(s, idle());
  assert.equal(s.players[0].standT, 0, 'letting go ends it');
});

test('mobs within reach of a standing hero lay down their arms; far ones do not; bombers and the boss never would', () => {
  const s = arena();
  const near: number[] = [];
  for (let k = 0; k < 20; k++) near.push(mob(s, MobType.Goblin, 130 + (k % 5) * 6, 90 + k, 1));
  const far = mob(s, MobType.Goblin, 100 + STAND_RADIUS + 120, 100, 1);
  for (let t = 0; t < STAND_TICKS + 120; t++) step(s, hold(Btn.Interact));
  assert.ok(near.filter((i) => surrendered(s, i)).length >= 8, `${near.filter((i) => surrendered(s, i)).length} of 20 surrendered`);
  assert.equal(surrendered(s, far), false);
  assert.equal(s.surrenders, near.filter((i) => surrendered(s, i)).length);
  for (const name of ['bomber', 'warlord']) assert.equal(surrenderChance(name), 0, `${name} never surrenders`);
  assert.ok(surrenderChance('goblin') > surrenderChance('orc'), 'the willing and the stubborn');
});

test('a surrendered mob does not attack, kneels, then runs off and is counted as spared', () => {
  const s = arena();
  const g = mob(s, MobType.Goblin, 108, 100, SURRENDERED);
  s.ents.rem[g] = SURRENDER_HOLD;
  const hp = s.ents.hp[s.players[0].ent];
  const x0 = s.ents.x[g];
  for (let t = 0; t < SURRENDER_HOLD - 5; t++) step(s, idle());
  assert.ok(surrendered(s, g));
  assert.equal(s.ents.x[g], x0, 'kneels where it is');
  assert.equal(s.ents.hp[s.players[0].ent], hp, 'no damage');
  for (let t = 0; t < 900 && alive(s, g); t++) step(s, idle());
  assert.equal(alive(s, g), false, 'it ran off');
  assert.equal(s.spared[MobType.Goblin], 1);
  assert.equal(s.slain[MobType.Goblin], 0);
  assert.equal(s.betrayed, 0);
});

test('killing a mob that had surrendered is counted as a betrayal', () => {
  const s = arena();
  const g = mob(s, MobType.Goblin, 112, 100, SURRENDERED);
  s.ents.rem[g] = SURRENDER_HOLD;
  for (let t = 0; t < 40 && alive(s, g); t++) step(s, hold(Btn.Attack));
  assert.equal(alive(s, g), false, 'a swing kills it, like any mob');
  assert.equal(s.betrayed, 1);
  assert.equal(s.slain[MobType.Goblin], 1);
});

test('an ordinary kill is not a betrayal', () => {
  const s = arena();
  const g = mob(s, MobType.Goblin, 112, 100, 1);
  for (let t = 0; t < 40 && alive(s, g); t++) step(s, hold(Btn.Attack));
  assert.equal(alive(s, g), false);
  assert.equal(s.betrayed, 0);
});

test('R3 stages a group that has already surrendered, kneeling until the party reaches it', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const plan = planLevel(seed, { id: 'R3' });
    assert.equal(plan.filter((c) => c.beat === 'R3').length, 1);
  }
  const s = createSim(5, { id: 'R3' }, { surrender: true });
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9;
  spawnClump(s, s.beatIndex, 1);
  s.nextClump = s.plan.length; // nothing else streams in
  s.ents.hp[s.players[0].ent] = 1e6;
  const group: number[] = [];
  for (let i = 0; i < s.ents.highWater; i++) if (alive(s, i)) group.push(i);
  assert.ok(group.length >= 4 && group.length <= 6);
  assert.ok(group.every((i) => surrendered(s, i) && (s.ents.sub[i] === MobType.Goblin || s.ents.sub[i] === MobType.Archer)));
  const c = s.plan[s.beatIndex];
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = c.x - 300; s.ents.y[pe] = s.ents.py[pe] = c.y;
  s.camX = s.prevCamX = c.x - 500;
  for (let t = 0; t < SURRENDER_HOLD + 120; t++) step(s, idle());
  assert.ok(group.every((i) => surrendered(s, i) && s.ents.rem[i] === -1), 'still kneeling: the party has not arrived');
  s.ents.x[pe] = s.ents.px[pe] = c.x - 60;
  step(s, idle());
  assert.ok(s.beatPlayedTick >= 0);
  for (let t = 0; t < SURRENDER_HOLD + 600; t++) step(s, idle());
  assert.equal(group.filter((i) => alive(s, i)).length, 0, 'then they run');
  assert.equal(s.spared[MobType.Goblin] + s.spared[MobType.Archer], group.length);
});

test('mercy is deterministic and part of the state hash', () => {
  const run = () => {
    const s = arena(true, 7);
    for (let k = 0; k < 30; k++) mob(s, MobType.Goblin, 130 + (k % 6) * 5, 80 + k, 1);
    for (let t = 0; t < 200; t++) step(s, hold(Btn.Interact));
    return s;
  };
  const a = run(), b = run();
  assert.equal(hashState(a), hashState(b));
  assert.ok(a.surrenders > 0);
  const c = arena(true, 7);
  assert.notEqual(hashState(a), hashState(c));
  const d = arena(true, 7), e = arena(true, 7);
  e.betrayed = 1;
  assert.notEqual(hashState(d), hashState(e));
});

test('only a player killing a surrendered mob counts as betrayal: an enemy bomber blast does not', () => {
  const s = arena();
  const g = mob(s, MobType.Goblin, 130, 100, SURRENDERED);
  s.ents.rem[g] = SURRENDER_HOLD;
  mob(s, MobType.Bomber, 118, 100, 1); // runs at the hero, lights its fuse, and takes the kneeling goblin with it
  for (let t = 0; t < 200 && alive(s, g); t++) step(s, idle());
  assert.equal(alive(s, g), false, 'the blast killed it');
  assert.equal(s.betrayed, 0);
  assert.equal(s.slain[MobType.Goblin], 0);
});
