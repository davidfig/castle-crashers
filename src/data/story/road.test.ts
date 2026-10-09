import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STORY_CHARS, storyWidth } from '../storyFont';
import { NPC_NAMES } from '../../render/npcArt';
import { beatsOf, fieldCalm, lineTicks, wrapStory } from '../../render/roadCast';
import { FINAL_CHAPTER } from './chapters';
import { ROAD_REACTIONS, ROAD_SCENES, roadSceneFor, roadSceneT } from './road';
import { CLASSES } from '../classes';
import { LEVELS_PER_BIOME } from '../../campaign/route';
import { createSim } from '../../sim/state';
import { allocEntity, BYSTANDER, Kind, SURRENDERED } from '../../sim/entities';
import { MobType } from '../mobs';

test('every non-boss level of every chapter has a road scene', () => {
  for (let ch = 1; ch <= FINAL_CHAPTER; ch++) {
    for (let lv = 0; lv < LEVELS_PER_BIOME - 1; lv++) assert.ok(roadSceneFor(ch, lv, false), `chapter ${ch} level ${lv}`);
    assert.equal(roadSceneFor(ch, LEVELS_PER_BIOME - 1, true), undefined, 'no scene on a boss level');
  }
  assert.equal(new Set(ROAD_SCENES.map((s) => s.id)).size, ROAD_SCENES.length, 'ids are unique');
});

test('scenes are well formed: real figures, real speakers, text the font can draw, room in a bubble', () => {
  for (const sc of ROAD_SCENES) {
    assert.ok(sc.cast.length >= 2 && sc.cast.length <= 4, sc.id);
    for (const f of sc.cast) assert.ok((NPC_NAMES as readonly string[]).includes(f.npc), `${sc.id} ${f.npc}`);
    assert.ok(sc.lines.length >= 4, sc.id);
    const spoke = new Set<number>();
    for (const l of sc.lines) {
      assert.ok(l.who >= 0 && l.who < sc.cast.length, `${sc.id} speaker`);
      spoke.add(l.who);
      for (const ch of l.text) assert.ok(STORY_CHARS.includes(ch), `${sc.id}: "${ch}" in "${l.text}"`);
      for (const row of wrapStory(l.text, 150)) assert.ok(storyWidth(row) <= 150 || !row.includes(' '), `${sc.id} wraps`);
      assert.ok(wrapStory(l.text, 150).length <= 4, `${sc.id}: "${l.text}" is too long for a bubble`);
    }
    assert.ok(spoke.size >= 2, `${sc.id} is a conversation`);
  }
});

test('lines stay up long enough to read, scaled to their length', () => {
  assert.ok(lineTicks('Hi.') >= 80);
  assert.ok(lineTicks('x'.repeat(80)) > lineTicks('x'.repeat(20)));
});

test('a scene stands in the middle of the field, clear of the staged beats and the final stand', () => {
  for (let s = 0; s < 500; s++) {
    const t = roadSceneT(s);
    assert.ok(t >= 0.46 && t <= 0.56, `${t}`);
    assert.equal(roadSceneT(s), t);
  }
});

test('every class has a partway and a closing reaction for every chapter, drawable and short enough for a bubble', () => {
  for (const c of CLASSES) {
    const per = ROAD_REACTIONS[c.name];
    assert.ok(per, c.name);
    assert.equal(per.length, FINAL_CHAPTER, c.name);
    for (const pair of per) for (const text of pair) {
      for (const ch of text) assert.ok(STORY_CHARS.includes(ch), `${c.name}: "${ch}" in "${text}"`);
      assert.ok(wrapStory(text, 150).length <= 3, text);
    }
  }
});

test('a scene is its lines with a reaction partway and one at the end', () => {
  for (const sc of ROAD_SCENES) {
    const beats = beatsOf(sc);
    assert.equal(beats.length, sc.lines.length + 2);
    assert.deepEqual(beats[beats.length - 1], { react: 1 });
    assert.equal(beats.filter((b) => 'react' in b).length, 2);
    assert.ok('react' in beats[Math.floor(sc.lines.length / 2)], 'the first reaction comes partway through');
  }
});

test('the field is calm only without awake hostiles nearby; bystanders and the surrendered do not count', () => {
  const s = createSim(3);
  assert.ok(fieldCalm(s, 1500));
  const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, 1600, 100, 10);
  s.ents.flags[m] = 1;
  assert.ok(!fieldCalm(s, 1500), 'an awake goblin near the scene');
  assert.ok(fieldCalm(s, 1500 - 600), 'but not one far from it');
  s.ents.flags[m] = BYSTANDER;
  assert.ok(fieldCalm(s, 1500), 'a bystander at its fire is no threat');
  s.ents.flags[m] = SURRENDERED;
  assert.ok(fieldCalm(s, 1500));
});
