import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botInput } from '../sim/bot';
import { createInputFrame } from '../sim/input';
import { restore, snapshot } from '../sim/snapshot';
import { activatePlayer, createSim, leaveParty, type GameState } from '../sim/state';
import { step } from '../sim/step';
import { clearRunSave, describeRunSave, loadRunSave, makeRunSave, parseRunSave, RUN_SAVE_BACKUP, RUN_SAVE_KEY, RUN_SAVE_VERSION, writeRunSave } from './runSave';
import type { KeyValueStore } from './storage';

class Memory implements KeyValueStore {
  data = new Map<string, string>();
  full = false;
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { if (this.full) throw new Error('QuotaExceededError'); this.data.set(k, v); }
  removeItem(k: string): void { this.data.delete(k); }
}

function roadRun(ticks: number): GameState {
  const s = createSim(17, undefined, { road: { total: 3 } });
  s.players[1].classId = 1;
  activatePlayer(s, 1, 60, 80);
  const f = [0, 1, 2, 3].map(createInputFrame);
  for (let t = 0; t < ticks; t++) { botInput(s, 0, f[0]); botInput(s, 1, f[1]); step(s, f); s.events.n = 0; }
  return s;
}
const config = { seed: 17, total: 3, heat: 1 };

test('a run saved to the store loads back as the same sim', () => {
  const store = new Memory(), s = roadRun(900);
  assert.ok(writeRunSave(store, makeRunSave(s, config, 1000)));
  const got = loadRunSave(store);
  assert.equal(got.status, 'ok');
  assert.deepEqual(got.save!.config, config);
  assert.deepEqual(got.save!.heroes.map((h) => h.slot), [0, 1]);
  assert.equal(snapshot(restore(got.save!.sim)), snapshot(s));
  assert.match(describeRunSave(got.save!), /^LEVEL 1 OF 3  WARRIOR /);
});

test('the save before is kept as a backup, and used when the latest is damaged', () => {
  const store = new Memory();
  const a = roadRun(300), b = roadRun(600);
  writeRunSave(store, makeRunSave(a, config, 1));
  writeRunSave(store, makeRunSave(b, config, 2));
  assert.equal(JSON.parse(store.getItem(RUN_SAVE_BACKUP)!).savedAt, 1);
  store.setItem(RUN_SAVE_KEY, store.getItem(RUN_SAVE_KEY)!.slice(0, 5000)); // a write cut short
  const got = loadRunSave(store);
  assert.equal(got.status, 'ok');
  assert.equal(got.backup, true);
  assert.equal(got.save!.savedAt, 1);
  // and the damaged save does not push the good backup out on the next write
  writeRunSave(store, makeRunSave(b, config, 3));
  assert.equal(JSON.parse(store.getItem(RUN_SAVE_BACKUP)!).savedAt, 1);
});

test('a save from a newer build is reported, never overwritten', () => {
  const store = new Memory();
  const future = JSON.stringify({ ...makeRunSave(roadRun(10), config, 1), v: RUN_SAVE_VERSION + 1 });
  store.setItem(RUN_SAVE_KEY, future);
  assert.equal(loadRunSave(store).status, 'newer');
  assert.equal(loadRunSave(store).writable, false);
  assert.equal(writeRunSave(store, makeRunSave(roadRun(10), config, 2)), false);
  assert.equal(store.getItem(RUN_SAVE_KEY), future);
  const newerSim = { ...makeRunSave(roadRun(10), config, 1) };
  newerSim.sim = newerSim.sim.replace(/^\{"v":\d+/, '{"v":999');
  assert.equal(parseRunSave(JSON.parse(JSON.stringify(newerSim))), 'newer', 'a newer snapshot inside counts too');
});

test('nothing saved, junk, a full store and no store at all are all survivable', () => {
  assert.equal(loadRunSave(new Memory()).status, 'none');
  const junk = new Memory(); junk.setItem(RUN_SAVE_KEY, 'not json');
  assert.equal(loadRunSave(junk).status, 'corrupt');
  assert.equal(parseRunSave({ v: 1, config: { seed: -1, total: 3, heat: 0 }, sim: '{"v":1}' }), undefined);
  const full = new Memory(); full.full = true;
  assert.equal(writeRunSave(full, makeRunSave(roadRun(10), config, 1)), false);
  assert.equal(loadRunSave(undefined).status, 'unavailable');
  assert.equal(writeRunSave(undefined, makeRunSave(roadRun(10), config, 1)), false);
});

test('a finished run clears its save and its backup', () => {
  const store = new Memory();
  writeRunSave(store, makeRunSave(roadRun(10), config, 1));
  writeRunSave(store, makeRunSave(roadRun(10), config, 2));
  clearRunSave(store);
  assert.equal(loadRunSave(store).status, 'none');
});

test('a saved hero nobody takes up leaves the run; a newcomer in the slot starts afresh', () => {
  const s = restore(snapshot(roadRun(900)));
  const ent = s.players[1].ent, level = s.players[1].level;
  leaveParty(s, 1);
  assert.equal(s.players[1].active, false);
  assert.equal(s.ents.alive[ent], 0, 'their body is gone');
  activatePlayer(s, 1, s.camX + 100, 100);
  assert.equal(s.players[1].level, 1, `the newcomer starts at level 1 (the saved hero was ${level}; up-levelling comes with joining, docs/21 step 6)`);
  const f = [0, 1, 2, 3].map(createInputFrame);
  for (let t = 0; t < 300; t++) { botInput(s, 0, f[0]); botInput(s, 1, f[1]); step(s, f); s.events.n = 0; }
  assert.ok(s.players[1].active);
});
