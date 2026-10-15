import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEAT_BY_ID } from '../data/story/beats';
import { Phase, createSim } from '../sim/state';
import { layoutRoad } from '../sim/gen/road';
import { ROUTE_LEVELS } from './route';
import { createLedger, markBeatsSeen, pendingBeat } from './ledger';
import { applyRunSummary } from './summary';
import { runChapter, summarizeRoadRun } from './roadRun';

/** A ledger that has played every beat before `id`, with the Writs the next one asks for. */
function ledgerAt(id: string) {
  let l = createLedger(1);
  for (let g = 0; g < 40; g++) {
    l = { ...l, chapterWrits: 9 };
    if (pendingBeat(l)?.id === id) break;
    l = markBeatsSeen(l, [pendingBeat(l)!.id]);
  }
  return l;
}

test('the Ledger tells the whole road in its chapter: scenes, mercy and all', () => {
  const s = createSim(3, undefined, { road: { total: ROUTE_LEVELS, chapter: 3 } });
  assert.equal(s.road!.chapter, 3);
  const scenes = (ch: number) => layoutRoad(3, ROUTE_LEVELS, undefined, false, ch).calm.filter((c) => c.kind === 'scene').map((c) => c.scene);
  assert.ok(scenes(3).length > 0 && scenes(3).every((id) => id!.startsWith('c3')), 'every scene is chapter III\'s');
  assert.ok(scenes(1).every((id) => id!.startsWith('c1')));
  assert.ok(scenes(0).some((id) => !id!.startsWith('c1')), 'with no chapter the regions keep their own');
});

test('the midpoint scene is staged when R5 is pending, and playing it advances the story', () => {
  const l = ledgerAt('R5');
  assert.equal(runChapter(l), 3);
  const s = createSim(3, undefined, { road: { total: ROUTE_LEVELS, chapter: 3, midpoint: true } });
  const beat = pendingBeat(l)!;
  s.phase = Phase.Lost;
  const heard = summarizeRoadRun(s, beat, false, new Set(['r5']));
  assert.deepEqual(heard.beatsSeen, ['R5']);
  const after = applyRunSummary(l, heard);
  assert.ok(after.beatsSeen.includes('R5'));
  assert.equal(pendingBeat(after)!.id, 'R6');
  // walked past it: still pending, and the miss is counted
  const missed = applyRunSummary(l, summarizeRoadRun(s, beat, false, new Set()));
  assert.equal(pendingBeat(missed)!.id, 'R5');
  assert.equal(missed.missed.R5, 1);
});

test('beats with no scene yet play on a win, a milestone only on a win, and a run that never set out reports nothing played', () => {
  const l = ledgerAt('R4');
  const s = createSim(3, undefined, { road: { total: ROUTE_LEVELS } });
  s.phase = Phase.Won;
  assert.deepEqual(summarizeRoadRun(s, BEAT_BY_ID.R2, false, new Set()).beatsSeen, ['R2']);
  s.phase = Phase.Lost;
  assert.deepEqual(summarizeRoadRun(s, BEAT_BY_ID.R2, false, new Set()).beatsSeen, []);
  assert.equal(summarizeRoadRun(s, pendingBeat(l), false, new Set()).milestone, true);
  s.road!.town = true;
  assert.deepEqual(summarizeRoadRun(s, BEAT_BY_ID.R6, false, new Set()).beatsSeen, []);
  s.road!.town = false;
  assert.deepEqual(summarizeRoadRun(s, BEAT_BY_ID.R6, false, new Set()).beatsSeen, ['R6']);
});
