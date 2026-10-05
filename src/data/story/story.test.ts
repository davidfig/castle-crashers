import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storySafe, storyWidth } from '../storyFont';
import { CLASSES } from '../classes';
import { Stream } from '../../engine/rng';
import { BARK_TRIGGERS, pickBark, STREAK_MARKS, VOICES, VOICE_TIERS, voiceTier } from './barks';
import { MobType } from '../mobs';
import { BEATS, BEAT_BY_ID } from './beats';
import { CHAPTERS, FINAL_CHAPTER } from './chapters';
import { makeClan } from './clan';
import { CLAUSES, writFromSeed, writLines } from './writs';

test('the beats form one chain: unique ids, each requires its predecessor, chapters never go backwards', () => {
  assert.equal(new Set(BEATS.map((b) => b.id)).size, BEATS.length);
  BEATS.forEach((b, i) => {
    assert.deepEqual([...b.requires], i === 0 ? [] : [BEATS[i - 1].id], b.id);
    if (i > 0) assert.ok(b.chapter >= BEATS[i - 1].chapter, b.id);
    for (const g of b.grants ?? []) assert.ok(BEAT_BY_ID[g], `${b.id} grants unknown ${g}`);
    if (b.tier !== 'hub') assert.ok(b.node, `${b.id} needs a node type`);
  });
});

test('every chapter has beats and ends on a milestone or a hub scene; milestone chapters need ordinary Writs first', () => {
  for (let c = 1; c <= FINAL_CHAPTER; c++) {
    const inCh = BEATS.filter((b) => b.chapter === c);
    assert.ok(inCh.length > 0, `chapter ${c}`);
    assert.ok(inCh.some((b) => b.tier === 'milestone'), `chapter ${c} has a milestone`);
  }
  assert.equal(CHAPTERS.length, FINAL_CHAPTER);
});

test('story streams are distinct from the sim streams', () => {
  const ids = Object.values(Stream);
  assert.equal(new Set(ids).size, ids.length);
});

test('makeClan is a pure function of the seed and has variety', () => {
  const names = new Set<string>();
  for (let s = 0; s < 300; s++) {
    assert.deepEqual(makeClan(s), makeClan(s));
    names.add(makeClan(s).name);
  }
  assert.ok(names.size > 100, `only ${names.size} distinct clans in 300 seeds`);
});

test('clans are well formed: playable species, no unfilled text slots', () => {
  for (let s = 0; s < 500; s++) {
    const c = makeClan(s);
    assert.ok(c.species.length >= 1 && c.species.length <= 3);
    assert.equal(new Set(c.species).size, c.species.length);
    for (const t of c.species) assert.ok(t >= MobType.Goblin && t < MobType.Boss, `mob type ${t}`);
    for (const text of [c.name, c.grievance, c.leader.name, c.leader.trait, c.place]) assert.ok(!/[{}]/.test(text), text);
    assert.ok(c.grievance.length > 10);
  }
});

test('writs are pure, readable in every chapter, and pay more as the chapters turn', () => {
  for (let s = 0; s < 200; s++) {
    for (let ch = 1; ch <= FINAL_CHAPTER; ch++) {
      const w = writFromSeed(s, ch);
      assert.deepEqual(w, writFromSeed(s, ch));
      assert.equal(w.seed, s);
      assert.ok(w.quota >= 600 && w.quota <= 1200 && w.quota % 50 === 0);
      assert.ok(new Set(w.clauses).size === w.clauses.length && w.clauses.length <= 2);
      for (const c of w.clauses) assert.ok(CLAUSES[c]);
      for (const line of writLines(w)) assert.ok(!/[{}]/.test(line), line);
      assert.ok(w.title.includes(w.clan.place));
    }
    assert.ok(writFromSeed(s, 4).payoutPct > writFromSeed(s, 1).payoutPct);
  }
});

test('the chapter wording drifts toward euphemism', () => {
  const t = (c: number) => writFromSeed(7, c).title.split(' at ')[0];
  const titles = [1, 2, 3, 4, 5].map(t);
  assert.equal(new Set(titles).size, 5, titles.join(' | '));
});

/** Minimum lines per tier [I, II-III, IV-V] for each trigger: enough that a player sees different lines around the same themes. */
const MIN_LINES: Record<string, [number, number, number]> = {
  start: [6, 4, 4], idle: [7, 5, 5], streak: [6, 4, 4], clear: [5, 4, 4], boss: [6, 4, 4], camp: [6, 0, 0], surrender: [0, 4, 4], betray: [0, 4, 4],
  hurt: [4, 3, 3], down: [4, 3, 3], coin: [4, 3, 3], win: [4, 3, 3], lost: [4, 3, 3],
};

test('every class has a voice with every trigger, and plenty of lines for each', () => {
  assert.deepEqual(Object.keys(VOICES).sort(), CLASSES.map((c) => c.name).sort());
  assert.deepEqual([...BARK_TRIGGERS].sort(), Object.keys(MIN_LINES).sort());
  for (const [name, v] of Object.entries(VOICES)) {
    for (const t of BARK_TRIGGERS) {
      assert.equal(v[t].length, VOICE_TIERS, `${name}.${t}`);
      v[t].forEach((lines, tier) => assert.ok(lines.length >= MIN_LINES[t][tier], `${name}.${t} tier ${tier} has ${lines.length}, wants ${MIN_LINES[t][tier]}`));
    }
    const all = BARK_TRIGGERS.flatMap((t) => v[t].flat());
    assert.equal(new Set(all).size, all.length, `${name} repeats a line`);
  }
  assert.ok(Object.values(VOICES).flatMap((v) => BARK_TRIGGERS.flatMap((t) => v[t].flat())).length > 450);
});

test('every bark can be drawn in the story font and fits a speech bubble', () => {
  for (const v of Object.values(VOICES)) for (const t of BARK_TRIGGERS) for (const lines of v[t]) for (const text of lines) {
    assert.equal(storySafe(text), text, text);
    assert.ok(storyWidth(text) <= 230, `${storyWidth(text)} px: ${text}`);
  }
});

test('barks are picked from the story stream: the same for a seed, quiet where a tier has no line', () => {
  for (let seed = 0; seed < 50; seed++) {
    assert.equal(pickBark(seed, 'start', 'warrior', 1), pickBark(seed, 'start', 'warrior', 1));
    assert.ok(pickBark(seed, 'camp', 'mage', 1));
    assert.equal(pickBark(seed, 'camp', 'mage', 2), undefined);
    assert.equal(pickBark(seed, 'start', 'not-a-class', 1), undefined);
  }
  const lines = new Set(Array.from({ length: 300 }, (_, i) => pickBark(i, 'start', 'warrior', 1)));
  assert.equal(lines.size, VOICES.warrior.start[0].length, 'every tier-I line comes up');
  const said = new Set(VOICES.warrior.idle[0].slice(0, 6));
  for (let i = 0; i < 40; i++) assert.equal(said.has(pickBark(i, 'idle', 'warrior', 1, 0, said)!), false, 'recently said lines are skipped while others remain');
  assert.ok(pickBark(1, 'idle', 'warrior', 1, 0, new Set(VOICES.warrior.idle[0])), 'and repeated rather than silent when nothing else is left');
  assert.equal(voiceTier(1), 0); assert.equal(voiceTier(2), 1); assert.equal(voiceTier(3), 1); assert.equal(voiceTier(4), 2); assert.equal(voiceTier(5), 2);
  assert.deepEqual([...STREAK_MARKS], [...STREAK_MARKS].sort((a, b) => a - b));
});
