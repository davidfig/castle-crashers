import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LEVEL, UPGRADES, UPGRADE_INDEX } from '../data/upgrades';
import { WARES, priceOf, stockFor, wareSpot } from '../data/wares';
import { questOffers, questSpot } from '../data/quests';
import { createSim, type GameState } from './state';
import { buy, nearWare, TradeEv } from './shop';
import { step } from './step';
import { Btn, createInputFrame } from './input';
import { Ev, EV_STRIDE } from './events';

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

function storeSim(seed: number): GameState {
  const s = createSim(seed, undefined, { store: true, stock: stockFor(seed, 1), offers: questOffers(seed, { level: 2, boss: false, biome: 0 }) });
  s.tick = 200;
  return s;
}
function standAt(s: GameState, x: number, y: number): void {
  const e = s.players[0].ent;
  s.ents.x[e] = s.ents.px[e] = x; s.ents.y[e] = s.ents.py[e] = y;
}
/** One tick with the trade button down (`down`) or up, nothing else pressed. */
function press(s: GameState, down: boolean): void {
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].buttons = down ? Btn.Interact : 0;
  step(s, f);
}
function trades(s: GameState): number[][] {
  const out: number[][] = [];
  for (let n = 0; n < s.events.n; n++) { const o = n * EV_STRIDE; if (s.events.data[o] === Ev.Trade) out.push([s.events.data[o + 3], s.events.data[o + 4], s.events.data[o + 5]]); }
  return out;
}

test('in the store the sim trades: the trade button beside a ware buys it once, from the shared purse', () => {
  const s = storeSim(9);
  s.gold = 1000;
  const sp = wareSpot(0, s.wares.length);
  standAt(s, sp.x, sp.y);
  assert.equal(nearWare(s, 0), 0);
  press(s, true);
  assert.equal(s.wares[0].sold, true);
  assert.equal(s.gold, 1000 - s.wares[0].price);
  assert.deepEqual(trades(s), [[TradeEv.Bought, 0, 0]]);
  press(s, true); press(s, false); press(s, true); // holding is not a second press, and a sold ware cannot be bought again
  assert.equal(s.gold, 1000 - s.wares[0].price);
});

test('a ware the purse cannot cover is not bought, and says so', () => {
  const s = storeSim(9);
  s.gold = 0;
  const sp = wareSpot(1, s.wares.length);
  standAt(s, sp.x, sp.y);
  press(s, true);
  assert.equal(s.wares[1].sold, false);
  assert.deepEqual(trades(s), [[TradeEv.Broke, 1, 0]]);
});

test('the trade button beside a giver takes their quest, and pressed again gives it back', () => {
  const s = storeSim(4);
  const sp = questSpot(1);
  standAt(s, sp.x, sp.y);
  press(s, true); press(s, false);
  assert.equal(s.questTaken, 1);
  press(s, true);
  assert.equal(s.questTaken, -1);
});

test('the button that chose a level-up card is not also a trade', () => {
  const s = storeSim(9);
  s.gold = 1000;
  const sp = wareSpot(0, s.wares.length);
  standAt(s, sp.x, sp.y);
  s.players[0].pending = 1; s.players[0].panel = true;
  press(s, true);
  assert.equal(s.wares[0].sold, false);
  assert.equal(s.players[0].pending, 0, 'the press chose the card');
});
