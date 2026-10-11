// Heroes outrun anything that walks to them, so mobs get two answers: skills aimed where a hero is heading, and bursts of speed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, MobType, type Special } from '../data/mobs';
import { startSpecialOf } from './abilities';
import { allocEntity, freeEntity, Kind } from './entities';
import { createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { step } from './step';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);

function arena(): GameState {
  const s = createSim(2);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9;
  s.flankTimer = 1e9;
  s.nextClump = s.plan.length;
  s.camX = s.prevCamX = 0;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = 100;
  s.ents.y[pe] = s.ents.py[pe] = 100;
  s.ents.hp[pe] = 1e6;
  return s;
}

const LOB: Special = { kind: 'lob', windup: 36, cooldown: 100, minRange: 20, maxRange: 200, radius: 16, damage: 8, delay: 48 };

test('a thrown area is aimed ahead of a running hero, and at a standing one it lands on them', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 170, 100, 10);
  s.ents.px[pe] = 98; // running right at 2 px a tick
  assert.ok(startSpecialOf(s, m, LOB, 0, 70, -1, 0));
  assert.ok(s.ents.ax[m] > 120, `aimed ahead of a runner (${s.ents.ax[m]})`);
  s.ents.px[pe] = 100; // standing still
  s.ents.mode[m] = 0;
  assert.ok(startSpecialOf(s, m, LOB, 0, 70, -1, 0));
  assert.equal(s.ents.ax[m], 100);
});

test('the lead is capped, so it never throws far past a hero who rolls', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 170, 100, 10);
  s.ents.px[pe] = 80; // a roll: 20 px in a tick
  assert.ok(startSpecialOf(s, m, LOB, 0, 70, -1, 0));
  assert.ok(s.ents.ax[m] <= 100 + 56 + 1e-9);
});

test('a sprinter covers ground in bursts, and a plain walker does not', () => {
  const run = (sprint: boolean): number => {
    const def = MOBS[MobType.Goblin];
    const saved = def.sprint;
    def.sprint = sprint ? { every: 120, ticks: 40, mul: 3, minDist: 40 } : undefined;
    try {
      const s = arena();
      const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 300, 100, MOBS[MobType.Goblin].hp);
      s.ents.flags[m] = 1;
      s.camX = s.prevCamX = 200;
      const x0 = s.ents.x[m];
      for (let t = 0; t < 120; t++) { s.ents.x[s.players[0].ent] = s.ents.px[s.players[0].ent] = 100; s.ents.y[s.players[0].ent] = s.ents.py[s.players[0].ent] = 100; step(s, idle()); }
      return x0 - s.ents.x[m];
    } finally { def.sprint = saved; }
  };
  assert.ok(run(true) > run(false) * 1.4, 'a sprinter closes more ground');
});
