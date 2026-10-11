import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NPC_NAMES } from '../../render/npcArt';
import { QUEST_NPCS, npcName } from '../quests';
import { activeFolk, generateFolk, generatePerson, installFolk, NPC_ROLE } from './index';

test('a seed always makes the same people', () => {
  assert.deepEqual(generateFolk(7), generateFolk(7));
  assert.deepEqual(generatePerson(7, 'commoner', 3), generatePerson(7, 'commoner', 3));
});

test('different seeds make different people, and one run\'s people differ from each other', () => {
  const seen = new Set<string>();
  for (let s = 1; s <= 30; s++) for (const n of NPC_NAMES) seen.add(JSON.stringify(generateFolk(s).looks[n]));
  assert.equal(seen.size, 30 * NPC_NAMES.length, 'no two figures are alike across 30 runs');
  const f = generateFolk(3);
  assert.equal(new Set(NPC_NAMES.map((n) => f.looks[n].seed)).size, NPC_NAMES.length);
});

test('every figure holds its office and wears what the office wears', () => {
  for (let s = 1; s <= 40; s++) {
    const f = generateFolk(s);
    for (const n of NPC_NAMES) {
      const l = f.looks[n];
      assert.equal(l.role, NPC_ROLE[n]);
      assert.ok(l.height >= 15 && l.height <= 21, `${n} height ${l.height}`);
    }
    assert.equal(f.looks.herald.held, 'trumpet');
    assert.equal(f.looks.captain.held, 'sword');
    assert.equal(f.looks.peddler.extras.includes('pack'), true);
    assert.equal(f.looks.king.garment === 'robe' || f.looks.king.garment === 'coat', true);
    assert.ok(f.looks.elder.stoop >= 1);
    // the court wears one livery: the same trim metal
    assert.equal(f.looks.king.palette.trim, f.livery.trim);
    assert.equal(f.looks.herald.palette.trim, f.livery.trim);
    assert.equal(f.looks.captain.palette.trim, f.livery.trim);
  }
});

test('the wardrobe is varied: many hairstyles, hats and builds turn up over some runs', () => {
  const hair = new Set<string>(), head = new Set<string>(), build = new Set<string>();
  for (let n = 0; n < 200; n++) { const l = generatePerson(11, 'commoner', n); hair.add(l.hair); head.add(l.head); build.add(l.build); }
  assert.ok(hair.size >= 6 && head.size >= 4 && build.size === 4, `${hair.size} ${head.size} ${build.size}`);
});

test('every run names its people: plain letters, all different, the same each time', () => {
  for (let s = 1; s <= 60; s++) {
    const f = generateFolk(s);
    const names = NPC_NAMES.map((n) => f.names[n]);
    assert.equal(new Set(names).size, names.length, `seed ${s} repeats a name`);
    for (const n of names) assert.match(n, /^[A-Z][a-z]{2,8}$/, n);
    assert.deepEqual(generateFolk(s).names, f.names);
  }
  const all = new Set<string>();
  for (let s = 1; s <= 60; s++) for (const n of NPC_NAMES) all.add(generateFolk(s).names[n]);
  assert.ok(all.size > 200, `${all.size} different names over 60 runs`);
});

test('quest givers wear the run\'s names, and the hand-made ones when no folk are installed', () => {
  assert.equal(activeFolk(), null);
  assert.equal(npcName(QUEST_NPCS[0]), 'LORD ALDRIC');
  const f = generateFolk(9);
  installFolk(f);
  try {
    assert.equal(npcName(QUEST_NPCS[0]), `LORD ${f.names.king.toUpperCase()}`);
    assert.equal(npcName(QUEST_NPCS[4]), 'THE REGISTRAR');
    for (const q of QUEST_NPCS) assert.match(npcName(q), /^[A-Z ]+$/);
  } finally { installFolk(null); }
});
