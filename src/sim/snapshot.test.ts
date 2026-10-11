import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { makeQuest } from '../data/quests';
import { wareSpot } from '../data/wares';
import { botInput } from './bot';
import { hashState } from './hash';
import { Btn, createInputFrame } from './input';
import { restore, snapshot } from './snapshot';
import { createSim, type GameState, type SimOptions } from './state';
import { step } from './step';

const cls = (name: string) => CLASSES.findIndex((c) => c.name === name);

/** A party of bots: slot 0 plays from the start, the others join a little later (so a join is inside the saved stretch too). */
function newRun(seed: number, classes: string[], opts: SimOptions = {}): GameState {
  const s = createSim(seed, undefined, { offerSeed: seed ^ 0x5eed, ...opts });
  classes.forEach((c, k) => { s.players[k].classId = cls(c); });
  s.ents.hp[s.players[0].ent] = s.ents.maxhp[s.players[0].ent] = CLASSES[cls(classes[0])].hp;
  return s;
}

const frames = [0, 1, 2, 3].map(createInputFrame);
function play(s: GameState, ticks: number, party: number): void {
  for (let t = 0; t < ticks; t++) {
    for (let k = 0; k < 4; k++) {
      botInput(s, k, frames[k]);
      if (k > 0 && k < party && s.tick === 40 * k) frames[k].buttons |= Btn.Join;
    }
    step(s, frames);
    s.events.n = 0;
  }
}

/** Plays `a + b` ticks straight through, and `a` ticks then a save and a restore then `b` more: the two must end identical. */
function roundTrip(make: () => GameState, party: number, a: number, b: number): void {
  const straight = make();
  play(straight, a + b, party);
  const first = make();
  play(first, a, party);
  const text = snapshot(first);
  assert.equal(snapshot(restore(text)), text, 'a restored sim saves as the same text');
  const resumed = restore(text);
  play(resumed, b, party);
  assert.equal(hashState(resumed), hashState(straight));
  assert.equal(snapshot(resumed), snapshot(straight), 'every part of the state, not only what the hash covers');
}

test('a sim saved mid-fight and restored plays on exactly as if it had never stopped', () => {
  roundTrip(() => newRun(11, ['warrior', 'shaman', 'archer']), 3, 1500, 1500);
});

test('save and restore round-trips the boss field, the mage and the cleric', () => {
  roundTrip(() => newRun(7, ['mage', 'cleric'], { boss: true, scale: 0.6 }), 2, 2400, 1200);
});

test('save and restore round-trips a quest in progress', () => {
  const quest = makeQuest(0, 'escort', 'purse', { level: 1, boss: false, biome: 0 });
  roundTrip(() => newRun(3, ['rogue', 'warrior'], { quest }), 2, 900, 900);
});

test('save and restore round-trips a camp on the road: goods bought', () => {
  const make = () => {
    const s = createSim(9, undefined, { road: { total: 3 } });
    s.road!.town = false;
    const camp = s.road!.layout.calm.find((c) => c.kind === 'camp')!;
    s.camX = s.prevCamX = s.camMax = s.trigCamX = camp.from - 300;
    const e = s.players[0].ent;
    s.ents.x[e] = s.ents.px[e] = camp.from;
    s.gold = 900;
    return s;
  };
  // walk to the first ware, buy it, saved halfway; then the second
  const route = (s: GameState, ticks: number) => {
    for (let t = 0; t < ticks; t++) {
      const f = frames[0], e = s.players[0].ent, want = wareSpot(s.tick < 400 ? 0 : 1, Math.max(1, s.wares.length));
      f.moveX = Math.sign(want.x + s.shopX - s.ents.x[e]) * 127; f.moveY = Math.sign(want.y - s.ents.y[e]) * 127; f.aimX = f.aimY = 0;
      f.buttons = s.tick % 20 === 0 ? Btn.Interact : 0;
      for (let k = 1; k < 4; k++) frames[k].buttons = frames[k].moveX = frames[k].moveY = 0;
      step(s, frames);
      s.events.n = 0;
    }
  };
  const straight = make(); route(straight, 800);
  assert.equal(straight.wares.filter((w) => w.sold).length, 2, 'the scripted hero bought two goods');
  const first = make(); route(first, 350);
  const resumed = restore(snapshot(first)); route(resumed, 450);
  assert.equal(snapshot(resumed), snapshot(straight));
});

test('a save is small: entity arrays are cut at what is in use', () => {
  const s = newRun(5, ['warrior']);
  play(s, 600, 1);
  assert.ok(snapshot(s).length < 400_000, `snapshot is ${snapshot(s).length} chars`);
});

test('the sim state must stay plain data', () => {
  const s = newRun(1, ['warrior']) as GameState & { extra?: unknown };
  s.extra = new Map();
  assert.throws(() => snapshot(s), /extra is not plain data/);
  s.extra = { f: () => 0 };
  assert.throws(() => snapshot(s), /extra\.f is not plain data/);
});

test('numbers JSON cannot carry survive the trip', () => {
  const s = newRun(1, ['warrior']) as GameState & { extra?: unknown };
  s.extra = [Infinity, -Infinity, -0, NaN, undefined, 1.5];
  const back = (restore(snapshot(s)) as GameState & { extra: number[] }).extra;
  assert.deepEqual(back.map((v) => (Object.is(v, -0) ? '-0' : String(v))), ['Infinity', '-Infinity', '-0', 'NaN', 'undefined', '1.5']);
});
