import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOME_COUNT } from '../data/roster';
import { UPGRADES, offerFor } from '../data/upgrades';
import { captureCarry } from '../sim/carry';
import { createSim } from '../sim/state';
import { doorsScreen, picksScreen, pickLanes, routeStrip, shopScreen, spoilsScreen } from './camp';
import { merchantLine } from '../data/story/hub';
import { storySafe } from '../data/storyFont';
import { stockFor } from '../data/wares';
import { makeRunConfig, offerWrits } from './board';
import { createLedger } from './ledger';
import { doorsAfter, levelPlan, levelSeed, ROUTE_LEVELS } from './route';
import { beatPlayed, summarizeRun } from './run';
import { Phase } from '../sim/state';
import type { Screen } from './view';

/** The bitmap font: upgrade cards use its percent sign, which screen text spells out (see fontSafe). */
const FONT = /^[0-9A-Z:.\-/!+?% ]*$/;
const texts = (scr: Screen): string[] => {
  if (scr.kind === 'picks') return [scr.header, scr.sub, scr.footer, ...scr.lanes.flatMap((l) => [l.name, ...l.cards.flatMap((c) => [c.name, ...c.text])])];
  if (scr.kind === 'doors') return [scr.header, scr.sub, scr.footer, ...scr.doors.flatMap((d) => [d.label, d.tag])];
  if (scr.kind === 'shop') return [scr.header, scr.sub, scr.footer, scr.note, ...scr.rows.flatMap((r) => [r.name, ...r.text]), ...scr.seats.map((s) => s.name)];
  if (scr.kind === 'text') return [scr.header, scr.footer, ...scr.body.map((b) => b.text)];
  return [];
};

test('a route: the first level is the Writs own seed, later ones are derived, and only the last has a boss', () => {
  assert.equal(levelSeed(1234, 0), 1234);
  assert.notEqual(levelSeed(1234, 1), 1234);
  assert.equal(levelSeed(1234, 1), levelSeed(1234, 1));
  assert.notEqual(levelSeed(1234, 1), levelSeed(1234, 2));
  const plans = Array.from({ length: ROUTE_LEVELS }, (_, k) => levelPlan(levelSeed(77, k), k, ROUTE_LEVELS));
  assert.deepEqual(plans.map((p) => p.boss), plans.map((_, k) => k === ROUTE_LEVELS - 1));
});

test('the doors: two roads, deterministic, into different biomes where there are several', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const d = doorsAfter(seed, 0, ROUTE_LEVELS);
    assert.deepEqual(d, doorsAfter(seed, 0, ROUTE_LEVELS));
    assert.equal(d.length, 2);
    assert.notEqual(d[0].seed, d[1].seed);
    if (BIOME_COUNT > 1) assert.notEqual(d[0].biome, d[1].biome, `seed ${seed}`);
    for (const x of d) { assert.match(x.label, FONT); assert.match(x.tag, FONT); }
  }
  const labels = new Set(Array.from({ length: 60 }, (_, i) => doorsAfter(i, 0, ROUTE_LEVELS).map((x) => x.label).join('|')));
  assert.ok(labels.size > 1, 'which biomes are behind the doors varies by run');
});

test('the camp screens fit the font and say what happened', () => {
  const l = createLedger(3);
  const cfg = makeRunConfig(l, offerWrits(l)[0]);
  const sim = createSim(cfg.seed, undefined, { offerSeed: cfg.seed, boss: false });
  sim.players[0].level = 3; sim.players[0].pending = 2;
  sim.kills = 400; sim.gold = 90; sim.spared[0] = 5;
  const spoils = spoilsScreen(1, captureCarry(sim), undefined, 0, 2);
  const text = texts(spoils).join(' | ');
  assert.match(text, /LEVEL 1 OF 2/);
  assert.match(text, /400/);
  assert.match(text, /Gold: 90/);
  assert.match(text, /Spared: 5/);
  assert.match(text, /2 picks waiting/);
  const picks = picksScreen(sim, [false, false, false, false], 0, 2);
  const doors = doorsScreen(doorsAfter(cfg.seed, 0, 2), 0, 0, 2);
  for (const t of texts(spoils)) assert.equal(storySafe(t), t, 'the spoils are a page, drawn in the story font');
  for (const t of [...texts(picks), ...texts(doors)]) assert.match(t, FONT, t);
  assert.equal(routeStrip(0, 2), 'LEVEL 1 OF 2');
});

test('the spoils report this levels heads, not the routes running total', () => {
  const sim = createSim(5);
  sim.kills = 100;
  const before = captureCarry(sim);
  sim.kills = 340;
  const text = texts(spoilsScreen(1, captureCarry(sim), before, 1, 2)).join(' | ');
  assert.match(text, /: 240/);
});

test('the picks panels match the offers the level-up panel shows, and a player with nothing pending is ready', () => {
  const sim = createSim(9, undefined, { offerSeed: 4242 });
  sim.players[0].level = 4; sim.players[0].pending = 2;
  const lanes = pickLanes(sim, [false, false, false, false]);
  const offer = offerFor(4242, 0, 3, sim.players[0].ranks);
  assert.deepEqual(lanes[0].cards.map((c) => c.name), offer.map((u) => UPGRADES[u].name));
  assert.equal(lanes[0].ready, false);
  assert.equal(pickLanes(sim, [true, false, false, false])[0].ready, true, 'keeping the picks for later is ready');
  sim.players[0].pending = 0;
  assert.equal(pickLanes(sim, [false, false, false, false])[0].ready, true);
  assert.deepEqual(pickLanes(sim, [false, false, false, false])[0].cards, []);
  assert.equal(lanes[1].active, false);
});

test('a beat staged in an earlier level still counts when the route is summarized', () => {
  const l = createLedger(5);
  const cfg = makeRunConfig({ ...l, chapterWrits: 1 }, offerWrits({ ...l, chapterWrits: 1 })[0]);
  assert.equal(cfg.reservedBeat?.id, 'R1');
  const last = createSim(cfg.seed + 1, undefined, { boss: true });
  last.phase = Phase.Won;
  assert.deepEqual(summarizeRun(last, cfg, false).beatsSeen, [], 'the last level never reached the camp');
  assert.deepEqual(summarizeRun(last, cfg, false, undefined, ['R1']).beatsSeen, ['R1']);
  assert.equal(beatPlayed(last, 'R1', 'won', false), false);
});

test('the merchant screen fits the font, shows the stock and who can afford it, and the line changes with the story', () => {
  const l = createLedger(3);
  const cfg = makeRunConfig(l, offerWrits(l)[0]);
  const sim = createSim(cfg.seed, undefined, { offerSeed: cfg.seed });
  sim.gold = 100;
  const stock = stockFor(cfg.seed, 0);
  const scr = shopScreen(sim, stock, [false, true, false, false], [0, 0, 0, 0], [false, false, false, false], 1, 'P1 BOUGHT SOMETHING');
  assert.equal(scr.kind, 'shop');
  if (scr.kind === 'shop') {
    assert.equal(scr.rows.length, 4);
    assert.equal(scr.rows[1].sold, true);
    assert.ok(scr.rows.some((r) => r.afford) && scr.rows.some((r) => !r.afford), 'a purse of 100 buys the scrolls but not the Lesson');
    assert.equal(scr.gold, 100);
    assert.equal(scr.seats[0].active, true);
  }
  if (scr.kind === 'shop') assert.equal(storySafe(scr.sub), scr.sub, 'the patter is read, so it is in the story font');
  for (const t of texts(scr).filter((x) => x !== (scr.kind === 'shop' ? scr.sub : ''))) assert.match(t, FONT, t);
  const byChapter = [1, 2, 3, 4, 5].map((c) => merchantLine(1, c));
  assert.equal(new Set(byChapter).size, 5);
  for (let seed = 0; seed < 20; seed++) for (let c = 1; c <= 5; c++) assert.match(merchantLine(seed, c).toUpperCase().replace(/[',"]/g, ''), FONT);
});
