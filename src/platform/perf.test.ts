import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameStats } from './perf';

function steady(st: FrameStats, ms: number, n: number): void {
  for (let i = 0; i < n; i++) st.record(ms);
}

test('steady frames produce no drops', () => {
  const st = new FrameStats();
  steady(st, 16.7, 300);
  assert.equal(st.drops, 0);
  assert.equal(st.fps, 60);
});

test('a long frame is counted as a drop and shows up as the worst frame', () => {
  const st = new FrameStats();
  steady(st, 16.7, 100);
  st.record(48);
  steady(st, 16.7, 40);
  assert.equal(st.drops, 1);
  assert.ok(st.worstMs >= 47, `worst ${st.worstMs}`);
});

test('drops are measured against the display rhythm (144 Hz vs 60 Hz)', () => {
  const fast = new FrameStats();
  steady(fast, 6.9, 200);
  fast.record(14); // fine on 60 Hz, but a clear hitch at 144 Hz
  assert.equal(fast.drops, 1);

  const slow = new FrameStats();
  steady(slow, 16.7, 200);
  slow.record(14);
  assert.equal(slow.drops, 0);
});

test('startup frames and hidden-tab gaps are not counted', () => {
  const st = new FrameStats();
  st.record(120); // warmup (shader compile etc.)
  steady(st, 16.7, 100);
  st.record(2500); // tab was hidden
  assert.equal(st.drops, 0);
});

test('drops age out of the ten second window', () => {
  const st = new FrameStats();
  steady(st, 16.7, 100);
  st.record(60);
  assert.equal(st.drops, 1);
  steady(st, 16.7, 650);
  assert.equal(st.drops, 0);
});

test('a sustained slowdown does not teach the meter that slow is normal', () => {
  const st = new FrameStats();
  steady(st, 16.7, 200);
  steady(st, 40, 100); // everything drops to 25 fps
  assert.ok(st.drops >= 90, `drops ${st.drops}`);
  assert.ok(st.typicalMs < 18, `typical ${st.typicalMs}`);
});

test('sim lag is reported for ten seconds after skipped ticks', () => {
  const st = new FrameStats();
  assert.equal(st.simLagging(5000), false);
  st.noteSkippedTicks(12, 5000);
  assert.equal(st.simLagging(9000), true);
  assert.equal(st.simLagging(16000), false);
  assert.equal(st.skippedTicks, 12);
});
