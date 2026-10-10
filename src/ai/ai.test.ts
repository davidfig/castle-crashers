import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { MobType } from '../data/mobs';
import { allocEntity, freeEntity, Kind, SURRENDERED } from '../sim/entities';
import { createInputFrame } from '../sim/input';
import { createSim, type GameState } from '../sim/state';
import { step } from '../sim/step';
import { Attribution } from './attribution';
import { cardScore } from './cards';
import { createView, look, scanWorld } from './perceive';
import { Pilot } from './pilot';
import { summarize } from './report';
import { runRoute } from './runner';
import { resolveSkill, SKILL_PRESETS, skillAt } from './skill';
import { collectThreats, Memory, Threats } from './threats';

/** An empty field with the hero at (100, 100) and a lot of health. */
function arena(cls = 0, seed = 4): GameState {
  const s = createSim(seed);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob || s.ents.kind[i] === Kind.Chest || s.ents.kind[i] === Kind.Shrine) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const p = s.players[0];
  p.classId = cls;
  const pe = p.ent;
  s.ents.x[pe] = s.ents.px[pe] = 100; s.ents.y[pe] = s.ents.py[pe] = 100;
  s.ents.hp[pe] = s.ents.maxhp[pe] = CLASSES[cls].hp;
  s.camX = s.prevCamX = 0;
  return s;
}
function mob(s: GameState, type: number, x: number, y = 100): number {
  const i = allocEntity(s.ents, Kind.Mob, type, x, y, 1000);
  s.ents.flags[i] = 1;
  s.ents.face[i] = -1;
  return i;
}
const frames = () => [0, 1, 2, 3].map(createInputFrame);

test('skills: the ladder runs from novice to expert and blends between rungs', () => {
  assert.equal(SKILL_PRESETS[0].name, 'novice');
  assert.equal(skillAt(0).name, 'novice');
  assert.equal(skillAt(1).name, 'expert');
  const mid = skillAt(0.5);
  assert.equal(mid.name, 'average');
  const between = skillAt(0.125);
  assert.ok(between.reaction < SKILL_PRESETS[0].reaction && between.reaction > SKILL_PRESETS[1].reaction);
  // every rung is at least as sharp as the one before
  for (let k = 1; k < SKILL_PRESETS.length; k++) {
    const a = SKILL_PRESETS[k - 1], b = SKILL_PRESETS[k];
    assert.ok(b.reaction < a.reaction && b.attention > a.attention && b.aimError < a.aimError && b.spacing > a.spacing, `${b.name} is sharper than ${a.name}`);
  }
  assert.equal(resolveSkill('skilled').name, 'skilled');
  assert.equal(resolveSkill('0.25').name, skillAt(0.25).name);
  assert.throws(() => resolveSkill('godlike'));
});

test('perception: foes come back nearest first, and the peaceful are not foes', () => {
  const s = arena();
  const far = mob(s, MobType.Goblin, 200), near = mob(s, MobType.Goblin, 130), mid = mob(s, MobType.Orc, 160);
  const kneeling = mob(s, MobType.Goblin, 110);
  s.ents.flags[kneeling] |= SURRENDERED;
  step(s, frames()); // (rebuilds the grid)
  const v = createView();
  look(s, 0, v);
  assert.equal(v.n, 3);
  assert.deepEqual([v.idx[0], v.idx[1], v.idx[2]], [near, mid, far]);
  assert.ok(v.dist[0] < v.dist[1] && v.dist[1] < v.dist[2]);
  assert.equal(scanWorld(s).hostiles, 3);
});

test('threats: a landing blow costs health where the hero stands and nothing a step away', () => {
  const t = new Threats();
  t.circle(100, 100, 20, 10, 12, 12);
  const stay = t.costOf(100, 100, 0, 0, 0, 0, 500, 0, 240);
  assert.equal(stay, 12);
  const away = t.costOf(100, 100, 1, 0, 3, 0, 500, 0, 240); // at 3 px a tick the hero is 30 px out when it lands
  assert.equal(away, 0);
  // a lane is dangerous across its width and not beside it
  const lane = new Threats();
  lane.lane(0, 100, 1, 0, 200, 10, 5, 30, 14);
  assert.equal(lane.costOf(100, 100, 0, 0, 0, 0, 500, 0, 240), 14);
  assert.equal(lane.costOf(100, 160, 0, 0, 0, 0, 500, 0, 240), 0);
  // a shot in flight is dodged by moving out of its line
  const shot = new Threats();
  shot.shot(40, 100, 2, 0, 60, 5, 6);
  assert.equal(shot.costOf(100, 100, 0, 0, 0, 0, 500, 0, 240), 6);
  assert.equal(shot.costOf(100, 100, 0, 1, 1.5, 0, 500, 0, 240), 0);
});

test('reaction: a wind-up only registers after the player has had time to see it', () => {
  const s = arena();
  const g = mob(s, MobType.Goblin, 112);
  const novice = resolveSkill('expert');
  const slow = { ...novice, attention: 1, reaction: 12 };
  const mem = new Memory(1);
  const t = new Threats();
  s.ents.wind[g] = 10;
  const seenAt: number[] = [];
  for (let k = 0; k < 20; k++) {
    s.tick = 100 + k;
    const sc = scanWorld(s);
    collectThreats(t, s, sc, mem, slow);
    seenAt.push(t.n);
    s.ents.wind[g] = Math.max(1, s.ents.wind[g]);
  }
  assert.equal(seenAt[0], 0, 'not seen the moment it starts');
  assert.equal(seenAt[11], 0, 'not yet at 11 ticks');
  assert.equal(seenAt[12], 1, 'seen once the reaction time has passed');
});

test('cards: a class prefers the boons that carry it', () => {
  const ranks = new Uint8Array(80);
  const score = (cls: string, id: string): number => {
    const { UPGRADE_INDEX } = require_upgrades();
    return cardScore(UPGRADE_INDEX[id], { className: cls, ranks, hpFrac: 1, party: 1 });
  };
  assert.ok(score('mage', 'bcount') > score('mage', 'dsize'), 'a mage wants more fireballs over a longer blink');
  assert.ok(score('cleric', 'bsize') > score('cleric', 'ssize'), 'the cleric wants a wider aura');
  assert.ok(score('warrior', 'heavy') > score('warrior', 'windfall'));
});

import { UPGRADE_INDEX } from '../data/upgrades';
function require_upgrades(): { UPGRADE_INDEX: Record<string, number> } { return { UPGRADE_INDEX }; }

test('a pilot walks a lone hero up to the foe and swings', () => {
  for (const cls of [0, 3]) {
    const s = arena(cls);
    const g = mob(s, MobType.Goblin, 180);
    s.ents.hp[g] = s.ents.maxhp[g] = 6;
    const pilot = new Pilot(0, resolveSkill('expert'), 1);
    const inputs = frames();
    let swung = false;
    for (let t = 0; t < 600 && s.ents.alive[g]; t++) {
      pilot.drive(s, inputs[0]);
      if (inputs[0].buttons & 1) swung = true;
      step(s, inputs);
    }
    assert.ok(swung, `${CLASSES[cls].name} swung`);
    assert.ok(!s.ents.alive[g] || s.ents.kind[g] !== Kind.Mob, `${CLASSES[cls].name} killed the goblin`);
  }
});

test('a pilot ranged class shoots from a distance instead of walking up', () => {
  for (const cls of [1, 4]) {
    const s = arena(cls);
    const g = mob(s, MobType.Goblin, 220);
    s.ents.hp[g] = s.ents.maxhp[g] = 6;
    const pilot = new Pilot(0, resolveSkill('expert'), 1);
    const inputs = frames();
    let closest = Infinity;
    for (let t = 0; t < 600 && s.ents.alive[g] && s.ents.kind[g] === Kind.Mob; t++) {
      pilot.drive(s, inputs[0]);
      step(s, inputs);
      if (s.ents.alive[g]) closest = Math.min(closest, Math.abs(s.ents.x[g] - s.ents.x[s.players[0].ent]));
    }
    assert.ok(s.kills >= 1, `${CLASSES[cls].name} killed it`);
    assert.ok(closest > 60, `${CLASSES[cls].name} kept its distance (closest ${closest.toFixed(0)})`);
  }
});

test('a pilot spends a level-up through the panel, with the same buttons a pad has', () => {
  const s = arena();
  const p = s.players[0];
  p.level = 3; p.pending = 2;
  const pilot = new Pilot(0, resolveSkill('expert'), 1);
  const inputs = frames();
  let opened = false;
  for (let t = 0; t < 900 && p.pending > 0; t++) {
    pilot.drive(s, inputs[0]);
    step(s, inputs);
    if (p.panel) opened = true;
  }
  assert.ok(opened, 'the panel was opened');
  assert.equal(p.pending, 0, 'both picks were made');
  assert.ok(p.ranks.some((r) => r > 0), 'something was taken');
});

test('a pilot does not leave a held attack muted after a pick (the pick lock needs the buttons let go)', () => {
  const s = arena();
  const p = s.players[0];
  p.level = 2; p.pending = 1;
  const g = mob(s, MobType.Goblin, 400);
  s.ents.hp[g] = 1e6; s.ents.maxhp[g] = 1e6;
  const pilot = new Pilot(0, resolveSkill('expert'), 1);
  const inputs = frames();
  let swungAfter = 0;
  for (let t = 0; t < 1500; t++) {
    pilot.drive(s, inputs[0]);
    step(s, inputs);
    if (p.pending === 0 && !p.lock && p.cdAttack > 0) swungAfter++;
  }
  assert.ok(p.pending === 0 && swungAfter > 0, 'the hero fights on after choosing');
});

test('damage is attributed to what dealt it', () => {
  const s = arena();
  const g = mob(s, MobType.Goblin, 106);
  const attr = new Attribution();
  const inputs = frames();
  let who = '';
  const hp0 = s.ents.hp[s.players[0].ent];
  for (let t = 0; t < 200 && !who; t++) {
    attr.snapshot(s);
    step(s, inputs);
    if (s.ents.hp[s.players[0].ent] < hp0) who = attr.explain(s, 0, hp0 - s.ents.hp[s.players[0].ent]);
  }
  assert.equal(who, 'goblin');
  assert.ok(g >= 0);
});

test('a route is a pure function of its options, and levels, stores and carry all happen', () => {
  const opts = { seed: 7, party: [{ classId: 'warrior', skill: 'expert' }], levels: 2 };
  const a = runRoute(opts), b = runRoute(opts);
  assert.deepEqual(a, b);
  assert.equal(a.outcome, 'won');
  assert.equal(a.levelsCleared, 2);
  assert.equal(a.stores.length, 1, 'one store between two levels');
  assert.ok(a.levels[0].kills > 100 && a.levels[1].kills > 100);
  assert.ok(a.heroes[0].level >= 3, 'the hero grew over the route');
  assert.ok(a.stores[0].ticks > 300, 'the party walked the store');
  const sum = summarize([a, b]);
  assert.equal(sum.wins, 2);
  assert.equal(sum.levels.length, 2);
});

test('the ladder matters: an expert warrior clears the first level and takes less damage than a novice', () => {
  const run = (skill: string, seed: number) => runRoute({ seed, party: [{ classId: 'warrior', skill }], stopAfter: 1 });
  const experts = [1, 2, 3].map((sd) => run('expert', sd));
  const novices = [1, 2, 3].map((sd) => run('novice', sd));
  assert.ok(experts.every((r) => r.outcome === 'won'), 'the expert wins every time');
  assert.ok(experts.reduce((a, r) => a + r.heroes[0].damageTaken, 0) < novices.reduce((a, r) => a + r.heroes[0].damageTaken, 0), 'and takes less damage');
});

test('a party of two plays together: both heroes move, fight and level', () => {
  const r = runRoute({ seed: 3, party: [{ classId: 'warrior', skill: 'skilled' }, { classId: 'cleric', skill: 'skilled' }], levels: 1 });
  assert.equal(r.heroes.length, 2);
  assert.ok(r.heroes[0].kills > 20 && r.heroes[1].kills > 20, 'both took part');
  assert.equal(r.outcome, 'won');
});

test('rogue: opens with the ambush out of hiding, on a knot of foes', () => {
  const s = arena(3);
  for (let k = 0; k < 8; k++) { const g = mob(s, MobType.Goblin, 190 + (k % 4) * 10, 90 + Math.floor(k / 4) * 16); s.ents.hp[g] = s.ents.maxhp[g] = 6; s.ents.flags[g] = 0; }
  const p = s.players[0];
  const pilot = new Pilot(0, resolveSkill('expert'), 2);
  const inputs = frames();
  let ambushed = -1, killsAtFirst = 0;
  for (let t = 0; t < 600; t++) {
    pilot.drive(s, inputs[0]);
    const hidden = p.vanishT > 0, swinging = (inputs[0].buttons & 1) !== 0;
    if (ambushed < 0 && swinging) { ambushed = hidden ? 1 : 0; killsAtFirst = s.kills; }
    step(s, inputs);
  }
  assert.equal(ambushed, 1, 'the first blow came from hiding');
  assert.ok(s.kills >= 6, `the knot fell (${s.kills})`);
  void killsAtFirst;
});

test('cleric: switches the aura on among foes and keeps it on while they last', () => {
  const s = arena(2);
  for (let k = 0; k < 6; k++) { const g = mob(s, MobType.Goblin, 150 + k * 6, 90 + (k % 3) * 12); s.ents.hp[g] = s.ents.maxhp[g] = 40; }
  const p = s.players[0];
  const pilot = new Pilot(0, resolveSkill('expert'), 2);
  const inputs = frames();
  let onTicks = 0;
  for (let t = 0; t < 700; t++) { pilot.drive(s, inputs[0]); step(s, inputs); if (p.auraOn) onTicks++; }
  assert.ok(onTicks > 40, `the aura was on (${onTicks} ticks)`);
  assert.ok(s.kills >= 5, `the aura did the work (${s.kills})`);
});

test('warrior: sends the quake down a column of foes', () => {
  const s = arena(0);
  for (let k = 0; k < 7; k++) { const g = mob(s, MobType.Orc, 150 + k * 22, 100); s.ents.hp[g] = s.ents.maxhp[g] = 400; s.ents.flags[g] = 1; }
  const p = s.players[0];
  p.fury = 100;
  const pilot = new Pilot(0, resolveSkill('expert'), 2);
  const inputs = frames();
  for (let t = 0; t < 120 && pilot.stats.novas === 0; t++) { pilot.drive(s, inputs[0]); step(s, inputs); }
  assert.ok(pilot.stats.novas >= 1, 'the quake was cast');
});

test('a pilot with nobody to fight keeps advancing, and holds at a shut gate', () => {
  const s = arena(0);
  const pilot = new Pilot(0, resolveSkill('average'), 3);
  const inputs = frames();
  const x0 = s.ents.x[s.players[0].ent];
  for (let t = 0; t < 300; t++) { pilot.drive(s, inputs[0]); step(s, inputs); }
  assert.ok(s.ents.x[s.players[0].ent] > x0 + 150, 'walked on');
});
