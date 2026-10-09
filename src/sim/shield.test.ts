import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, MobType } from '../data/mobs';
import { allocEntity, freeEntity, Kind } from './entities';
import { hashState } from './hash';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { step } from './step';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
const hold = (buttons: number): InputFrame[] => { const f = idle(); f[0].buttons = buttons; return f; };

/** An empty field; a hero at (100, 100) facing right, a shield bearer at (125, 100) facing the hero (its shield towards him). */
function duel(): { s: GameState; g: number } {
  const s = createSim(4);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = 100; s.ents.y[pe] = s.ents.py[pe] = 100; s.ents.hp[pe] = 1e6;
  s.camX = s.prevCamX = 0;
  s.players[0].faceX = 1; s.players[0].faceY = 0;
  const g = allocEntity(s.ents, Kind.Mob, MobType.Shield, 125, 100, MOBS[MobType.Shield].hp);
  s.ents.flags[g] = 1; s.ents.face[g] = -1;
  return { s, g };
}

test('a shield bearer starts with a shield that soaks blows, and the shield breaks once it has taken enough', () => {
  const { s, g } = duel();
  assert.equal(s.ents.shieldHp[g], MOBS[MobType.Shield].shieldHp);
  const hp0 = s.ents.hp[g];
  let blocked = 0;
  for (let t = 0; t < 400 && s.ents.shieldHp[g] > 0; t++) {
    s.ents.x[g] = 125; s.ents.y[g] = 100; s.ents.vx[g] = 0; // hold the duel still
    step(s, t % 30 === 0 ? hold(Btn.Attack) : idle());
    if (s.ents.shieldHp[g] > 0) assert.equal(s.ents.hp[g], hp0, 'nothing gets through an intact shield');
    blocked++;
  }
  assert.equal(s.ents.shieldHp[g], 0, 'it broke');
  assert.ok(blocked > 1, 'not on the first blow');
  assert.ok(s.ents.stun[g] >= 30, 'the break leaves the guard open and stunned');
});

test('once broken the guard takes frontal hits like anyone, and a broken shield stays broken', () => {
  const { s, g } = duel();
  s.ents.shieldHp[g] = 0;
  const hp0 = s.ents.hp[g];
  step(s, hold(Btn.Attack));
  assert.ok(s.ents.hp[g] < hp0, 'a frontal hit lands');
  for (let t = 0; t < 120; t++) step(s, idle());
  assert.equal(s.ents.shieldHp[g], 0);
});

test('heavy hits that pierce a shield still go straight through, without spending it', () => {
  const { s, g } = duel();
  const hp0 = s.ents.hp[g], sh0 = s.ents.shieldHp[g];
  step(s, hold(Btn.Ability2)); // the warrior's big swing pierces
  assert.ok(s.ents.hp[g] < hp0);
  assert.equal(s.ents.shieldHp[g], sh0);
});

test('shield health is part of the state hash', () => {
  const a = duel(), b = duel();
  assert.equal(hashState(a.s), hashState(b.s));
  b.s.ents.shieldHp[b.g] = 3;
  assert.notEqual(hashState(a.s), hashState(b.s));
});
