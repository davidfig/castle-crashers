import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StandingList } from './standing';

// What stands on the field is drawn among the characters by where it touches the ground (render/standing.ts, docs/02 "Draw order").

test('standing things are drawn back to front, each just before the first character at or in front of it', () => {
  const list = new StandingList(), out: string[] = [];
  list.clear();
  list.push(150, () => out.push('booth'));
  list.push(30, () => out.push('banner'));
  list.push(100, () => out.push('sign'));
  list.sort();
  // the characters, in their own depth order, with the standing things merged in
  for (const [name, y] of [['hero behind', 20], ['hero beside the banner', 30], ['hero', 120]] as const) {
    list.drawUpTo(y);
    out.push(name);
  }
  list.drawRest();
  assert.deepEqual(out, ['hero behind', 'banner', 'hero beside the banner', 'sign', 'hero', 'booth']);
});

test('at the same depth the one pushed first stays behind, and a frame starts afresh', () => {
  const list = new StandingList(), out: string[] = [];
  list.push(50, () => out.push('a'));
  list.push(50, () => out.push('b'));
  list.sort();
  list.drawRest();
  assert.deepEqual(out, ['a', 'b']);
  list.clear();
  assert.equal(list.length, 0);
  list.drawRest();
  assert.deepEqual(out, ['a', 'b'], 'nothing left over from the last frame');
});
