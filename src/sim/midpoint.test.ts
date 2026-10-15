import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORY_CHARS, storyWidth } from '../data/storyFont';
import { MIDPOINT_CHAPTER, MIDPOINT_SCENE } from '../data/story/midpoint';
import { SCENE_BY_ID, ROAD_REACTIONS, scriptFor } from '../data/story/road';
import { ROUTE_LEVELS } from '../campaign/route';
import { NPC_NAMES } from '../render/npcArt';
import { wrapStory } from '../render/roadCast';
import { propsFor } from '../render/roadProps';
import { layoutRoad, roadJump, stageOf } from './gen/road';
import { createSim } from './state';

// The midpoint scene (docs/12-story.md, R5): staged in its chapter's first scene slot when the road is made with `midpoint`.

const midpointCalm = (seed: number, total: number, midpoint: boolean) => layoutRoad(seed, total, undefined, midpoint).calm.filter((c) => c.kind === 'scene' && c.scene === 'r5');

test('a road made with the midpoint holds it once, on the first level of its chapter\'s region', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const found = midpointCalm(seed, ROUTE_LEVELS, true);
    assert.equal(found.length, 1, `seed ${seed}`);
    assert.equal(stageOf(found[0].level), MIDPOINT_CHAPTER - 1);
    assert.equal(found[0].level % 3, 0);
    assert.equal(midpointCalm(seed, ROUTE_LEVELS, false).length, 0);
  }
});

test('without the midpoint the road is as it was, and a road too short to reach the chapter holds none', () => {
  for (let seed = 1; seed <= 5; seed++) {
    assert.deepEqual(layoutRoad(seed, ROUTE_LEVELS, undefined, false), layoutRoad(seed, ROUTE_LEVELS));
    assert.equal(midpointCalm(seed, 6, true).length, 0);
  }
});

test('the sim plans the scene\'s marker where the layout puts it', () => {
  const s = createSim(7, undefined, { road: { total: ROUTE_LEVELS, midpoint: true } });
  roadJump(s, ROUTE_LEVELS - 1);
  const marks = s.plan.filter((c) => c.scene === 'r5');
  assert.equal(marks.length, 1);
  const calm = s.road!.layout.calm.find((c) => c.scene === 'r5')!;
  assert.equal(marks[0].x, calm.x);
  assert.equal(SCENE_BY_ID.r5, MIDPOINT_SCENE);
});

test('the scene is well formed, told once, and every class can answer it', () => {
  assert.ok(MIDPOINT_SCENE.cast.length >= 2 && MIDPOINT_SCENE.cast.length <= 4);
  for (const f of MIDPOINT_SCENE.cast) assert.ok((NPC_NAMES as readonly string[]).includes(f.npc));
  const spoke = new Set<number>();
  for (const l of MIDPOINT_SCENE.lines) {
    assert.ok(l.who >= 0 && l.who < MIDPOINT_SCENE.cast.length);
    spoke.add(l.who);
    for (const ch of l.text) assert.ok(STORY_CHARS.includes(ch), `"${ch}" in "${l.text}"`);
    for (const row of wrapStory(l.text, 150)) assert.ok(storyWidth(row) <= 150 || !row.includes(' '));
    assert.ok(wrapStory(l.text, 150).length <= 4, l.text);
  }
  assert.ok(spoke.size >= 2);
  for (const heard of [0, 1, 2, 5]) assert.equal(scriptFor(MIDPOINT_SCENE, heard), MIDPOINT_SCENE.lines);
  for (const cls of Object.keys(ROAD_REACTIONS)) assert.ok(ROAD_REACTIONS[cls][MIDPOINT_CHAPTER - 1], cls);
});

test('the ground is covered in it: puddles, many fallen of three kinds, the cart, the tally board', () => {
  const props = propsFor('r5', MIDPOINT_CHAPTER);
  const count = (k: string) => props.filter((p) => p.kind === k).length;
  assert.ok(count('blood') >= 6);
  assert.ok(count('body') >= 8);
  assert.deepEqual([...new Set(props.filter((p) => p.kind === 'body').map((p) => p.variant))].sort(), [0, 1, 2]);
  for (const k of ['cart', 'tally', 'pot', 'prints', 'table']) assert.ok(count(k) >= 1, k);
  // most puddles lie under everything: they sort before any figure that stands in the scene
  const lowest = Math.min(...MIDPOINT_SCENE.cast.map((f) => f.dy), ...props.filter((p) => p.kind !== 'blood' && p.kind !== 'prints').map((p) => p.dy));
  assert.ok(props.filter((p) => p.kind === 'blood' && p.dy < lowest).length >= 6);
});
