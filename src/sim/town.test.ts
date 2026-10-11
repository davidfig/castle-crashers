import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { META, META_INDEX, META_TOTAL, metaForRenown, metaMultipliers, renownFor, TREASURY_GOLD } from '../data/meta';

import { classStand, heatShrine, metaPlace, TOWN_GATE_X, TOWN_W } from '../data/town';
import { loadProfile, metaRanks, newProfile, PROFILE_KEY, saveProfile, withRun } from '../campaign/profile';
import { VIEW_W } from './constants';
import { Ev, EV_STRIDE } from './events';
import { CLEAR_AFTER, TownEv } from './gen/road';
import { Btn, createInputFrame } from './input';
import { restore, snapshot } from './snapshot';
import { activatePlayer, createSim, joinParty, type GameState } from './state';
import { MOBS, MobType } from '../data/mobs';
import { allocEntity, Kind } from './entities';
import { step } from './step';

// The starting town (docs/21-the-road.md, step 6) and joining a run under way.

/** The town's ranks in `META` order, from a few named ones. */
function ranks(named: Record<string, number>): number[] { return META.map((m) => named[m.id] ?? 0); }
function town(renown = 0, meta: number[] = []): GameState {
  return createSim(31, undefined, { road: { total: 4, renown, meta } });
}
function standAt(s: GameState, k: number, sp: { x: number; y: number }): void {
  const e = s.players[k].ent;
  s.ents.x[e] = s.ents.px[e] = sp.x; s.ents.y[e] = s.ents.py[e] = sp.y;
}
/** Hero `k` presses the trade button (one tick down, one up); the town's events. */
function press(s: GameState, k: number): number[] {
  const out: number[] = [];
  for (const down of [true, false]) {
    const f = [0, 1, 2, 3].map(createInputFrame);
    if (down) f[k].buttons = Btn.Interact;
    s.events.n = 0;
    step(s, f);
    for (let n = 0; n < s.events.n; n++) if (s.events.data[n * EV_STRIDE] === Ev.Town) out.push(s.events.data[n * EV_STRIDE + 3]);
  }
  return out;
}

test('the road begins in the town: a screen of calm ground, the first fight well clear of it', () => {
  const s = town();
  const t = s.road!.layout.calm[0];
  assert.deepEqual([t.kind, t.from, t.to], ['town', 0, TOWN_W]);
  assert.ok(s.road!.town);
  assert.equal(s.plan.length, 0, 'nothing of the road is planned while the party is in the town');
});

test('the camera holds on the town until a hero walks out through the gate; then the road is planned and the camera follows', () => {
  const s = town();
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].moveX = 127;
  for (let t = 0; t < 600 && s.road!.town; t++) { step(s, f); assert.ok(s.camX <= 0.001, `the camera stays on the town (at ${s.camX})`); }
  assert.equal(s.road!.town, false, 'the hero went out through the gate');
  assert.ok(s.ents.x[s.players[0].ent] >= TOWN_GATE_X);
  assert.ok(s.plan.length > 0, 'the road ahead is planned');
  assert.ok(s.plan[0].x >= TOWN_W + CLEAR_AFTER - 1, 'the first encounter is well clear of the town');
  for (let t = 0; t < 200; t++) step(s, f);
  assert.ok(s.camX > 50, 'and the camera follows the party down the road');
});

test('a hero takes up a class at its stand: a fresh hero of that class, with the town\'s upgrades', () => {
  const s = town(0, [1, 0]);
  const mage = CLASSES.findIndex((c) => c.name === 'mage');
  standAt(s, 0, classStand(mage));
  assert.deepEqual(press(s, 0), [TownEv.Class]);
  assert.equal(s.players[0].classId, mage);
  assert.equal(s.ents.maxhp[s.players[0].ent], CLASSES[mage].hp);
  assert.equal(s.road!.metaMul[1], 0.89, 'still armoured');
});

test('the town\'s places are built up with renown, take hold at once, and refuse when too dear or at their height', () => {
  const s = town(100);
  activatePlayer(s, 1, 100, 100);
  const armoury = META_INDEX.armoury, treasury = META_INDEX.treasury;
  standAt(s, 0, metaPlace(armoury));
  assert.deepEqual(press(s, 0), [TownEv.Built]);
  assert.equal(s.road!.renown, 100 - META[armoury].cost(0));
  assert.equal(s.road!.meta[armoury], 1);
  assert.equal(s.road!.metaMul[1], 0.89, 'heroes take 11% less damage');
  assert.equal(s.players[0].ranks[1], 0, 'and it is a layer of its own: no boon rank is taken from the level-up hands');
  assert.deepEqual(press(s, 0), [TownEv.Dear], `the next rank costs ${META[armoury].cost(1)}`);
  standAt(s, 0, metaPlace(treasury));
  const gold = s.gold;
  assert.deepEqual(press(s, 0), [TownEv.Built]);
  assert.equal(s.gold, gold + TREASURY_GOLD);
  const full = town(9999, [META[armoury].maxRank, 0]);
  standAt(full, 0, metaPlace(armoury));
  assert.deepEqual(press(full, 0), [TownEv.Maxed]);
});

test('a run sets out with what the town has built: armoured heroes, gold in the purse', () => {
  const s = town(0, ranks({ armoury: 2, treasury: 3 }));
  assert.equal(s.road!.metaMul[1], 0.78);
  assert.equal(s.gold, 3 * TREASURY_GOLD);
});

test('the heat shrine raises the road\'s heat, and the road ahead is planned at the heat the party set out with', () => {
  const hot = town(), cold = town();
  standAt(hot, 0, heatShrine());
  for (let n = 0; n < 3; n++) press(hot, 0);
  assert.equal(hot.heat, 3);
  assert.equal(hot.road!.heat, 3);
  const leave = (s: GameState) => { standAt(s, 0, { x: TOWN_GATE_X + 2, y: 100 }); step(s, [0, 1, 2, 3].map(createInputFrame)); };
  leave(hot); leave(cold);
  const sum = (s: GameState) => s.plan.reduce((a, c) => a + c.size, 0);
  assert.ok(sum(hot) > sum(cold), `a hotter road has more horde (${sum(hot)} against ${sum(cold)})`);
});

test('a hero joining a run under way comes at the party\'s level, with that many picks to choose, and the town\'s upgrades', () => {
  const s = town(0, [1, 0]);
  activatePlayer(s, 1, 100, 100);
  s.players[0].level = 6; s.players[1].level = 9;
  joinParty(s, 2, 120, 120);
  assert.equal(s.players[2].level, 7, 'the average, rounded down');
  assert.equal(s.players[2].pending, 6);
  assert.equal(s.road!.metaMul[1], 0.89);
  const solo = town();
  solo.players[0].level = 1;
  joinParty(solo, 1, 100, 100);
  assert.equal(solo.players[1].level, 1, 'a party still at level 1 gets a level 1 newcomer');
});

test('dropping in mid-run (a new device presses join) brings the newcomer up to strength', () => {
  const s = town();
  s.road!.town = false;
  s.players[0].level = 5;
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[1].buttons = Btn.Join;
  step(s, f);
  assert.ok(s.players[1].active);
  assert.equal(s.players[1].level, 5);
  assert.equal(s.players[1].pending, 4);
});

test('a run saved in the town keeps what the town did', () => {
  const s = town(200);
  standAt(s, 0, metaPlace(META_INDEX.treasury));
  press(s, 0);
  const back = restore(snapshot(s));
  assert.equal(back.road!.town, true);
  assert.deepEqual(back.road!.meta, s.road!.meta);
  assert.equal(back.road!.renown, s.road!.renown);
  assert.equal(back.camX, s.camX);
  void VIEW_W;
});

test('renown and the town\'s ranks are kept in the profile between runs', () => {
  const e = (cleared: number, bosses: number, kills: number, won = false, setOut = true) => renownFor({ cleared, bosses, kills, won, setOut });
  assert.ok(e(5, 1, 3000) > e(2, 0, 900));
  assert.ok(e(15, 5, 0, true) > e(15, 5, 0, false));
  assert.equal(e(0, 0, 0, false, false), 0, 'a run quit in the town earns nothing');
  assert.ok(e(0, 0, 250) >= 20, 'a run that dies on the first level still earns a start towards a rank');
  const store = new Map<string, string>();
  const kv = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  assert.equal(loadProfile(kv).status, 'none');
  const p = withRun(newProfile(), 75, ranks({ armoury: 1, forge: 2 }));
  assert.ok(saveProfile(kv, p));
  const back = loadProfile(kv);
  assert.equal(back.status, 'ok');
  assert.equal(back.profile.renown, 75);
  assert.deepEqual(metaRanks(back.profile), ranks({ armoury: 1, forge: 2 }));
  store.set(PROFILE_KEY, JSON.stringify({ v: 99, renown: 5, meta: {} }));
  assert.equal(loadProfile(kv).status, 'newer');
  assert.equal(loadProfile(kv).writable, false);
});

test('the town\'s places make heroes hit harder, take less and run faster, and begin a level higher', () => {
  const none = town(), built = town(0, ranks({ armoury: 4, forge: 5, stables: 3, academy: 4 }));
  assert.deepEqual(none.road!.metaMul, [1, 1, 1]);
  const [dmg, taken, speed] = metaMultipliers(built.road!.meta);
  assert.ok(Math.abs(dmg - 1.7) < 1e-9 && Math.abs(taken - 0.56) < 1e-9 && Math.abs(speed - 1.21) < 1e-9, `${dmg} ${taken} ${speed}`);
  assert.equal(built.players[0].level, 5, 'the Academy: level 5 to begin, with four level-ups waiting');
  assert.equal(built.players[0].pending, 4);
  // and it shows in a fight: a hit on a built hero is smaller, a hero's swing is bigger
  const mob = (s: GameState) => {
    const e = s.players[0].ent;
    s.ents.x[e] = s.ents.px[e] = 300; s.ents.y[e] = s.ents.py[e] = 100;
  };
  mob(none); mob(built);
  const dmgTo = (s: GameState): number => {
    const e = s.players[0].ent, before = s.ents.hp[e];
    s.road!.town = false; s.tick = 400;
    const m = allocEntity(s.ents, Kind.Mob, MobType.Orc, 312, 100, MOBS[MobType.Orc].hp);
    s.ents.flags[m] = 1;
    for (let t = 0; t < 400 && s.ents.hp[e] === before; t++) step(s, [0, 1, 2, 3].map(createInputFrame));
    return before - s.ents.hp[e];
  };
  const a = dmgTo(none), b = dmgTo(built);
  assert.ok(a > 0 && b > 0 && Math.abs(b / a - 0.56) < 0.05, `an orc's first hit: ${a} on an unbuilt hero, ${b} on a built one`);
});

test('the renown budget model buys one rank of each place in turn, and everything for the full price', () => {
  assert.deepEqual(metaForRenown(0), META.map(() => 0));
  let spent = 0;
  const cost = (r: number[]) => r.reduce((a, k, i) => { let c = 0; for (let j = 0; j < k; j++) c += META[i].cost(j); return a + c; }, 0);
  for (const r of [50, 150, 400, 800, 1500]) {
    const ranks = metaForRenown(r);
    assert.ok(cost(ranks) <= r, `${r} renown buys at most ${r} (${cost(ranks)})`);
    assert.ok(cost(ranks) > spent, 'more renown buys more');
    spent = cost(ranks);
  }
  assert.deepEqual(metaForRenown(META_TOTAL), META.map((m) => m.maxRank));
});
