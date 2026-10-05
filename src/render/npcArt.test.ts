import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NPC_NAMES, buildNpcSets, npcFrame } from './npcArt';

test('every story figure has an idle and a talk loop, with frames inside their sheet and a sensible pivot', () => {
  const sets = buildNpcSets(NPC_NAMES.map((_, i) => ({ x: 0, y: i * 100 })), 512, 256);
  for (const name of NPC_NAMES) {
    const set = sets[name];
    assert.ok(set, name);
    for (const anim of ['idle', 'talk']) {
      const a = set.anims[anim];
      assert.ok(a && a.frames.length >= 2, `${name}.${anim}`);
      assert.equal(a.ms.length, a.frames.length);
      for (const f of a.frames) {
        assert.ok(f.u1 > f.u0 && f.v1 > f.v0 && f.u0 >= 0 && f.u1 <= 1 && f.v0 >= 0 && f.v1 <= 1, `${name}.${anim} uv`);
        assert.ok(f.w > 0 && f.h > 0);
        assert.ok(set.pivotX >= 0 && set.pivotX <= f.w && set.pivotY >= 0 && set.pivotY <= f.h, 'pivot inside the frame');
      }
    }
  }
});

test('npcFrame follows the authored timings and wraps around', () => {
  const sets = buildNpcSets(NPC_NAMES.map(() => ({ x: 0, y: 0 })), 512, 256);
  const a = sets.registrar.anims.idle;
  const total = a.ms.reduce((x, y) => x + y, 0);
  assert.equal(npcFrame(a, 0), a.frames[0]);
  assert.equal(npcFrame(a, total), a.frames[0], 'a loop wraps');
  assert.equal(npcFrame(a, a.ms[0] + 1), a.frames[1]);
  assert.equal(npcFrame(a, -1), a.frames[a.frames.length - 1], 'and so does a negative time');
});
