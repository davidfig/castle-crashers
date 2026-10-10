import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topplePose } from './draw';

test('a toppling body starts upright on its feet and ends lying on the ground, head the way the corpse faces', () => {
  const w = 10, h = 20;
  const start = topplePose(w, h, false, 0.3, 0);
  assert.equal(start.angle, 0);
  assert.equal(start.cx, 0);
  assert.equal(start.cy, -h / 2, 'standing: its centre half a figure above the feet');
  const end = topplePose(w, h, false, 0, 1);
  assert.ok(Math.abs(end.angle - Math.PI / 2) < 1e-9, 'a quarter turn toward the head side');
  assert.ok(Math.abs(end.cy + w / 2) < 1e-9, 'lying: half its width above the ground');
  assert.ok(end.cx > 0, 'and its centre has swung out toward the head');
  const mirrored = topplePose(w, h, true, 0, 1);
  assert.ok(Math.abs(mirrored.angle + Math.PI / 2) < 1e-9 && mirrored.cx < 0, 'a mirrored body falls the other way');
  const leaned = topplePose(w, h, false, 0.4, 1);
  assert.ok(Math.abs(leaned.angle - (Math.PI / 2 + 0.4)) < 1e-9, 'it comes to rest at the corpse\'s own lean');
});

test('the fall is smooth and accelerates: it never turns back, and the last stretch is quicker than the first', () => {
  let prev = topplePose(8, 16, false, 0, 0).angle;
  let firstThird = 0, lastThird = 0;
  for (let k = 1; k <= 30; k++) {
    const a = topplePose(8, 16, false, 0, k / 30).angle;
    assert.ok(a >= prev, 'monotonic');
    if (k <= 10) firstThird += a - prev; else if (k > 20) lastThird += a - prev;
    prev = a;
  }
  assert.ok(lastThird > firstThird * 1.5, 'gravity: slow to start, quick to land');
});

import { Fx } from './fx';
import { createEvents, emit, Ev } from '../sim/events';
import { MobType } from '../data/mobs';

test('a launched body turns steadily through the air and lands in exactly the pose its corpse keeps', () => {
  const fx = new Fx();
  const ev = createEvents();
  emit(ev, Ev.Kill, 200, 90, MobType.Goblin, 0, 3.5, 0); // a hard blow to the right: a = type, c,d = launch velocity
  fx.consume(ev);
  assert.equal(fx.nb, 1, 'it was launched, not dropped on the spot');
  assert.equal(fx.cCount, 0);
  const flip = fx.bflip[0], rot = fx.brot[0], dur = fx.bdur[0];
  assert.ok(dur > 8 && dur < 60, `a flight of ${dur.toFixed(1)} ticks`);
  assert.equal(flip, 0, 'thrown to the right: it falls head to the right');
  let prev = 0;
  const angles: number[] = [];
  for (let t = 0; fx.nb > 0 && t < 200; t++) {
    const pose = topplePose(10, 18, fx.bflip[0] === 1, fx.brot[0], Math.min(1, fx.bage[0] / fx.bdur[0]));
    assert.ok(pose.angle >= prev - 1e-9, 'it never turns back');
    prev = pose.angle;
    angles.push(pose.angle);
    fx.update(1);
  }
  assert.equal(fx.nb, 0, 'it landed');
  assert.ok(angles.filter((a) => a > 0.2 && a < 1.3).length >= 3, 'with several frames at angles between upright and flat: a rotation you can see');
  assert.equal(fx.cCount, 1);
  const c = (fx.cHead + fx.cCount - 1) % fx.cx.length;
  assert.equal(fx.cflip[c], flip, 'the corpse lies the way it fell');
  assert.ok(Math.abs(fx.crot[c] - rot) < 1e-6, 'at the lean it was turning to');
  assert.ok(fx.cborn[c] < -1000, 'and does not topple a second time');
});

test('a body killed where it stands topples over in place, over a visible stretch of time', () => {
  const fx = new Fx();
  const ev = createEvents();
  emit(ev, Ev.Kill, 200, 90, MobType.Goblin, 0, 0, 0);
  fx.consume(ev);
  assert.equal(fx.nb, 0);
  assert.equal(fx.cCount, 1);
  const c = (fx.cHead + fx.cCount - 1) % fx.cx.length;
  assert.equal(fx.cborn[c], fx.now, 'it is toppling from now');
});
