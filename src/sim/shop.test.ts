import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, UPGRADES, UPGRADE_INDEX } from '../data/upgrades';
import { WARES, priceOf, stockFor } from '../data/wares';
import { createSim } from './state';
import { buy } from './shop';

const scroll = (id: string) => WARES.find((w) => w.id === `scroll-${id}`)!;
const lesson = WARES.find((w) => w.kind === 'level')!;

test('the stock is a pure function of the run seed and the camp: three different scrolls and the Lesson', () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (let level = 0; level < 3; level++) {
      const a = stockFor(seed, level);
      assert.deepEqual(a, stockFor(seed, level));
      assert.equal(a.length, 4);
      assert.equal(new Set(a.map((x) => x.ware)).size, 4);
      assert.equal(a.filter((x) => WARES[x.ware].kind === 'level').length, 1);
      for (const x of a) assert.equal(x.price, priceOf(WARES[x.ware], level));
    }
  }
  const sets = new Set(Array.from({ length: 40 }, (_, i) => stockFor(i, 0).map((x) => x.ware).join()));
  assert.ok(sets.size > 3, 'which scrolls are on offer varies');
  assert.ok(priceOf(lesson, 1) > priceOf(lesson, 0), 'dearer deeper into a route');
});

test('buying a scroll raises that upgrade for the buyer only, and spends the shared purse', () => {
  const s = createSim(3);
  s.players[1].active = true;
  s.gold = 200;
  const heavy = scroll('heavy');
  assert.equal(buy(s, 0, heavy, 80), 'ok');
  assert.equal(s.players[0].ranks[UPGRADE_INDEX.heavy], 1);
  assert.equal(s.players[1].ranks[UPGRADE_INDEX.heavy], 0);
  assert.equal(s.gold, 120);
});

test('the Lesson is a level with a pick to make', () => {
  const s = createSim(3);
  s.gold = 500; s.players[0].xp = 30;
  assert.equal(buy(s, 0, lesson, 140), 'ok');
  assert.equal(s.players[0].level, 2);
  assert.equal(s.players[0].pending, 1);
  assert.equal(s.gold, 360);
});

test('no money, no sale; a maxed upgrade or level cap is refused and costs nothing', () => {
  const s = createSim(3);
  s.gold = 10;
  assert.equal(buy(s, 0, scroll('swift'), 60), 'broke');
  assert.equal(s.gold, 10);
  assert.equal(s.players[0].ranks[UPGRADE_INDEX.swift], 0);
  s.gold = 1000;
  s.players[0].ranks[UPGRADE_INDEX.swift] = UPGRADES[UPGRADE_INDEX.swift].maxRank;
  assert.equal(buy(s, 0, scroll('swift'), 60), 'maxed');
  assert.equal(s.gold, 1000);
  s.players[0].level = MAX_LEVEL;
  assert.equal(buy(s, 0, lesson, 140), 'maxed');
  assert.equal(s.gold, 1000);
});

test('two heroes who want the same scroll: the purse is shared, so it can run out', () => {
  const s = createSim(3);
  s.players[1].active = true;
  s.gold = 100;
  assert.equal(buy(s, 0, scroll('thick'), 70), 'ok');
  assert.equal(buy(s, 1, scroll('thick'), 70), 'broke');
});
