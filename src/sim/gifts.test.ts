import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GIFT_POOL, giftsFor, giftSpot } from '../data/gifts';
import { rarityOf, UPGRADES } from '../data/upgrades';
import { VIEW_W } from './constants';
import { Ev, EV_STRIDE } from './events';
import { Btn, createInputFrame } from './input';
import { TradeEv } from './shop';
import { restore, snapshot } from './snapshot';
import { activatePlayer, createSim, type GameState } from './state';
import { step } from './step';

// A camp's gift on the road (docs/21-the-road.md, step 5): two boons, one each, every hero choosing for themselves.

test('a gift is two different boons any class can use, from the run seed', () => {
  assert.ok(GIFT_POOL.length >= 6);
  for (const i of GIFT_POOL) { const u = UPGRADES[i]; assert.ok(!u.classes && !u.unlock && !u.evolve && rarityOf(u) < 2, u.id); }
  for (let seed = 1; seed < 30; seed++) {
    const g = giftsFor(seed, 2);
    assert.equal(g.length, 2);
    assert.notEqual(g[0], g[1]);
    assert.deepEqual(g, giftsFor(seed, 2));
  }
});

/** A road sim with two heroes, the camera in the first camp, its gift set out. */
function atCamp(): GameState {
  const s = createSim(14, undefined, { road: { total: 3 } });
  activatePlayer(s, 1, 0, 0);
  const camp = s.road!.layout.calm.find((c) => c.kind === 'camp')!;
  s.camX = s.prevCamX = s.camMax = s.trigCamX = (camp.from + camp.to) / 2 - VIEW_W / 2;
  s.tick = 200;
  step(s, [0, 1, 2, 3].map(createInputFrame));
  assert.ok(s.road!.camp, 'in the camp');
  assert.equal(s.gifts.length, 2, 'its gift is set out');
  return s;
}
function standAt(s: GameState, k: number, gift: number): void {
  const e = s.players[k].ent, sp = giftSpot(gift);
  s.ents.x[e] = s.ents.px[e] = s.shopX + sp.x; s.ents.y[e] = s.ents.py[e] = sp.y;
}
/** One tick with hero `k`'s trade button down, then one with it up; returns the trade events. */
function press(s: GameState, k: number): number[] {
  const out: number[] = [];
  for (const down of [true, false]) {
    const f = [0, 1, 2, 3].map(createInputFrame);
    if (down) f[k].buttons = Btn.Interact;
    s.events.n = 0;
    step(s, f);
    for (let n = 0; n < s.events.n; n++) if (s.events.data[n * EV_STRIDE] === Ev.Trade) out.push(s.events.data[n * EV_STRIDE + 3]);
  }
  return out;
}

test('each hero takes one boon of the two, their own choice; a second press, or the other boon, is refused', () => {
  const s = atCamp();
  const [a, b] = s.gifts;
  standAt(s, 0, 0);
  assert.deepEqual(press(s, 0), [TradeEv.Gift]);
  assert.equal(s.players[0].ranks[a], 1);
  assert.deepEqual(press(s, 0), [TradeEv.HasGift], 'one each');
  standAt(s, 0, 1);
  assert.deepEqual(press(s, 0), [TradeEv.HasGift], 'not the other one too');
  assert.equal(s.players[0].ranks[b], 0);
  standAt(s, 1, 1);
  assert.deepEqual(press(s, 1), [TradeEv.Gift], 'the second hero chooses for themselves');
  assert.equal(s.players[1].ranks[b], 1);
  assert.deepEqual(s.giftPick.slice(0, 2), [0, 1]);
});

test('a boon already at its height is not taken, and the hero may still choose the other', () => {
  const s = atCamp();
  const [a, b] = s.gifts;
  s.players[0].ranks[a] = UPGRADES[a].maxRank;
  standAt(s, 0, 0);
  assert.deepEqual(press(s, 0), [TradeEv.GiftMaxed]);
  standAt(s, 0, 1);
  assert.deepEqual(press(s, 0), [TradeEv.Gift]);
  assert.equal(s.players[0].ranks[b], 1);
});

test('who took which gift is saved with the run', () => {
  const s = atCamp();
  standAt(s, 1, 0);
  press(s, 1);
  const back = restore(snapshot(s));
  assert.deepEqual(back.gifts, s.gifts);
  assert.deepEqual(back.giftPick, s.giftPick);
});
