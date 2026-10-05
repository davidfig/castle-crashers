import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AFTERMATH, HUB_SCENES } from '../data/story/hub';
import { BACKDROPS, SCENE_FLOOR, SCENE_H, drawBackdrop } from './sceneArt';
import type { Sprites } from './art';
import type { Batcher } from '../platform/gl/batcher';

/** A batcher that records what is drawn, so a backdrop can be checked without a GL context. */
function recorder() {
  const calls: number[][] = [];
  const b = { drawScaled: (_f: unknown, x: number, y: number, w: number, h: number, tint: number) => { calls.push([x, y, w, h, tint]); }, draw: () => {}, setClip: () => {}, clearClip: () => {} } as unknown as Batcher;
  const S = { px: {} } as unknown as Sprites;
  return { b, S, calls };
}

test('every scene happens somewhere drawn, and every drawn place is used', () => {
  const scenes = [...Object.values(HUB_SCENES), ...Object.values(AFTERMATH)];
  for (const sc of scenes) assert.ok(BACKDROPS.includes(sc.backdrop), `${sc.id} -> ${sc.backdrop}`);
  for (const kind of BACKDROPS) assert.ok(scenes.some((s) => s.backdrop === kind), `${kind} is never used`);
});

test('each set fills its area, stays on the screen, is deterministic and moves with the clock', () => {
  for (const kind of BACKDROPS) {
    const a = recorder(), a2 = recorder(), later = recorder();
    drawBackdrop(a.b, a.S, kind, 100);
    drawBackdrop(a2.b, a2.S, kind, 100);
    drawBackdrop(later.b, later.S, kind, 137);
    assert.ok(a.calls.length > 40, `${kind} draws very little (${a.calls.length})`);
    assert.deepEqual(a.calls, a2.calls, `${kind} is not deterministic`);
    const covered = a.calls.some(([x, y, w, h]) => x <= 0 && y <= 0 && w >= 640 && h >= SCENE_H - 10) || a.calls.filter(([x, , w]) => x <= 0 && w >= 640).length > 3;
    assert.ok(covered, `${kind} does not cover the area`);
    for (const [x, y, w, h] of a.calls) {
      assert.ok(Number.isFinite(x + y + w + h), `${kind}: NaN in a rectangle`);
      assert.ok(w >= 0 && h >= 0, `${kind}: negative size`);
    }
    assert.notDeepEqual(a.calls, later.calls, `${kind} never changes`);
  }
  assert.ok(SCENE_FLOOR < SCENE_H);
});
