import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEAT_MAX, heatHorde } from '../data/heat';
import { MOBS } from '../data/mobs';
import { offerFor, UPGRADE_INDEX, UPGRADES } from '../data/upgrades';
import { applyCarry, captureCarry } from './carry';
import { allocEntity, Kind, ShrineKind } from './entities';
import { planLevel } from './gen/level';
import { hashState } from './hash';
import { Btn, createInputFrame, type InputFrame } from './input';
import { heroOffer } from './offers';
import { CHANNEL, chestCost, SiteState } from './sites';
import { createSim, START_BANISHES, START_REROLLS, type GameState } from './state';
import { damageMob, hurtPlayer, step } from './step';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
const stickY = (y: number): InputFrame[] => { const f = idle(); f[0].moveY = y; return f; };

/** A level with only the sites left on it: no mobs, no streaming, the hero parked at x. */
function field(seed = 4): GameState {
  const s = createSim(seed);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) { s.ents.alive[i] = 0; s.ents.kind[i] = Kind.None; }
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length; s.tick = 500;
  return s;
}
function sitesOf(s: GameState, kind: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === kind) out.push(i);
  return out;
}
function standAt(s: GameState, x: number, y: number): void {
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = x; s.ents.y[pe] = s.ents.py[pe] = y;
  s.ents.hp[pe] = s.ents.maxhp[pe] = 100;
  s.camX = s.prevCamX = Math.max(0, x - 200);
}
function runFor(s: GameState, ticks: number): void { for (let t = 0; t < ticks; t++) step(s, idle()); }
function pending(s: GameState, n: number): void { const p = s.players[0]; p.level = 1 + n; p.pending = n; p.xp = 0; }
/** A spare site of `kind` placed right where the hero stands (the seeded ones are far away). */
function plant(s: GameState, kind: number, sub: number): number {
  const pe = s.players[0].ent;
  const i = allocEntity(s.ents, kind, sub, s.ents.x[pe] + 8, s.ents.y[pe], 1);
  assert.ok(i >= 0);
  return i;
}

test('every field has its chests and shrines, the same from the same seed, and none on top of the hero', () => {
  for (let seed = 1; seed < 30; seed++) {
    const a = createSim(seed), b = createSim(seed);
    const chests = sitesOf(a, Kind.Chest).length, shrines = sitesOf(a, Kind.Shrine).length;
    assert.ok(chests + shrines >= 2 && chests <= 2 && shrines <= 2, `seed ${seed}: ${chests} chests, ${shrines} shrines`);
    assert.equal(hashState(a), hashState(b));
    for (const i of [...sitesOf(a, Kind.Chest), ...sitesOf(a, Kind.Shrine)]) assert.ok(a.ents.x[i] > 700, 'well down the road');
  }
  assert.equal(sitesOf(createSim(3, undefined, { store: true }), Kind.Chest).length, 0, 'none in the camp');
});

test('rerolling deals a fresh hand; banishing removes the boon for good; both cost a charge and carry on', () => {
  const s = field();
  pending(s, 1);
  const p = s.players[0];
  assert.equal(p.rerolls, START_REROLLS); assert.equal(p.banishes, START_BANISHES);
  const first = heroOffer(s, 0);
  step(s, idle()); // (nothing happens without the panel)
  assert.equal(p.rerolls, START_REROLLS);
  step(s, (() => { const f = idle(); f[0].buttons = Btn.Level; return f; })());
  assert.ok(p.panel);
  step(s, stickY(-127)); // up
  assert.equal(p.rerolls, START_REROLLS - 1);
  const second = heroOffer(s, 0);
  assert.notDeepEqual(second, first, 'a new hand');
  step(s, idle()); step(s, stickY(127)); // down: banish the highlighted card
  assert.equal(p.banishes, START_BANISHES - 1);
  const gone = second[p.cursor];
  assert.equal(p.banned[gone], 1);
  for (let lvl = 1; lvl < 80; lvl++) for (let salt = 0; salt < 4; salt++) assert.ok(!offerFor(s.offerSeed, 0, lvl, p.ranks, p.classId, { salt, banned: p.banned }).includes(gone), 'never offered again');
  // out of banishes: the stick does nothing
  step(s, idle()); step(s, stickY(127));
  assert.equal(p.banishes, 0);
  // picking resets the deal, and the counts travel to the next level
  step(s, idle());
  const hand = heroOffer(s, 0);
  step(s, (() => { const f = idle(); f[0].buttons = Btn.Attack; return f; })());
  assert.equal(p.pending, 0);
  assert.equal(p.salt, 0);
  assert.ok(p.ranks[hand[p.cursor]] >= 0);
  const next = createSim(9);
  applyCarry(next, captureCarry(s));
  assert.equal(next.players[0].rerolls, p.rerolls);
  assert.equal(next.players[0].banned[gone], 1);
});

test('rerolls run dry: with none left the stick does nothing', () => {
  const s = field();
  pending(s, 1);
  const p = s.players[0];
  p.rerolls = 0; p.panel = true;
  const hand = heroOffer(s, 0);
  step(s, stickY(-127));
  assert.deepEqual(heroOffer(s, 0), hand);
});

test('two boons at rank 2 offer their fusion; the fusion changes the rules', () => {
  const ranks = new Uint8Array(UPGRADES.length);
  ranks[UPGRADE_INDEX.spark] = 2; ranks[UPGRADE_INDEX.pound] = 2;
  let offered = 0;
  for (let level = 2; level < 60; level++) {
    const hand = offerFor(77, 0, level, ranks, 0, { party: 1 });
    if (hand.includes(UPGRADE_INDEX.tempest)) offered++;
    assert.ok(!offerFor(77, 0, level, new Uint8Array(UPGRADES.length), 0, { party: 1 }).includes(UPGRADE_INDEX.tempest), 'not without its parts');
    assert.ok(!offerFor(77, 0, level, ranks, 0, { party: 1, banned: Object.assign(new Uint8Array(UPGRADES.length), { [UPGRADE_INDEX.tempest]: 1 }) }).includes(UPGRADE_INDEX.tempest), 'banished');
  }
  assert.equal(offered, 58, 'every hand carries it until taken');
  ranks[UPGRADE_INDEX.tempest] = 1;
  assert.ok(!offerFor(77, 0, 5, ranks, 0, { party: 1 }).includes(UPGRADE_INDEX.tempest), 'taken');
  // a fusion that needs company is not offered to a lone hero
  const r2 = new Uint8Array(UPGRADES.length); r2[UPGRADE_INDEX.banner] = 2; r2[UPGRADE_INDEX.ward] = 2;
  assert.ok(!offerFor(5, 0, 6, r2, 0, { party: 1 }).includes(UPGRADE_INDEX.rallycry));
  assert.ok(offerFor(5, 0, 6, r2, 0, { party: 2 }).includes(UPGRADE_INDEX.rallycry));
});

test('Bloodmoon heals on every kill', () => {
  const run = (rank: number) => {
    const s = field();
    standAt(s, 100, 100);
    s.players[0].ranks[UPGRADE_INDEX.bloodmoon] = rank;
    const hp0 = 50; s.ents.hp[s.players[0].ent] = hp0;
    for (let k = 0; k < 6; k++) { const m = sitesOf(s, Kind.Mob)[0] ?? -1; void m; }
    return s;
  };
  const s = run(1);
  for (let k = 0; k < 10; k++) {
    const g = allocEntity(s.ents, Kind.Mob, 0, 140, 100, 1);
    damageMob(s, g, 99, 1, 0, 1, 0, 0);
  }
  assert.ok(s.ents.hp[s.players[0].ent] > 50, 'mended');
});

test('a chest sells a pick for gold, dearer each time; a poor hero opens nothing; two misses guarantee a pick', () => {
  const s = field();
  standAt(s, 100, 100);
  const c = plant(s, Kind.Chest, 0);
  s.gold = 5;
  runFor(s, CHANNEL + 20);
  assert.equal(s.ents.elite[c], SiteState.Waiting, 'too poor');
  assert.equal(s.chestsOpened, 0);
  s.gold = chestCost(s) + 3;
  const price = chestCost(s);
  runFor(s, CHANNEL + 5);
  assert.equal(s.ents.elite[c], SiteState.Spent);
  assert.equal(s.chestsOpened, 1);
  assert.ok(chestCost(s) > price, 'the next one is dearer');
  // pity: after two misses the next chest gives a pick
  s.chestMiss = 2;
  const c2 = plant(s, Kind.Chest, 0);
  s.gold = 1e6;
  const lv = s.players[0].level, pend = s.players[0].pending;
  runFor(s, CHANNEL + 5);
  assert.equal(s.ents.elite[c2], SiteState.Spent);
  assert.equal(s.players[0].level, lv + 1);
  assert.equal(s.players[0].pending, pend + 1);
  assert.equal(s.chestMiss, 0);
});

test('a curse shrine summons elites; killing them all pays out a level for everyone', () => {
  const s = field();
  standAt(s, 100, 100);
  const sh = plant(s, Kind.Shrine, ShrineKind.Curse);
  runFor(s, CHANNEL + 5);
  assert.equal(s.ents.elite[sh], SiteState.Running);
  const elites = sitesOf(s, Kind.Mob).filter((i) => s.ents.elite[i] === 2);
  assert.ok(elites.length >= 2);
  for (const i of elites) assert.ok(s.ents.maxhp[i] > MOBS[s.ents.sub[i]].hp * 3, 'tough');
  const lv = s.players[0].level;
  for (const i of elites) damageMob(s, i, 1e6, 1, 0, 1, 0, 0);
  runFor(s, 100);
  assert.equal(s.ents.elite[sh], SiteState.Spent);
  assert.equal(s.players[0].level, lv + 1);
});

test('a charge shrine fills only while a hero stands in it, and mends the party when full', () => {
  const s = field();
  standAt(s, 100, 100);
  const sh = plant(s, Kind.Shrine, ShrineKind.Charge);
  runFor(s, CHANNEL + 2);
  assert.equal(s.ents.elite[sh], SiteState.Running);
  const at = s.ents.rem[sh];
  standAt(s, 400, 100); // walk away: it stalls
  runFor(s, 30);
  assert.equal(s.ents.rem[sh], at);
  standAt(s, 100, 100);
  s.ents.hp[s.players[0].ent] = 20;
  for (let t = 0; t < 700 && (s.ents.elite[sh] as number) !== SiteState.Spent; t++) { step(s, idle()); for (const i of sitesOf(s, Kind.Mob)) { s.ents.alive[i] = 0; s.ents.kind[i] = Kind.None; } }
  assert.equal(s.ents.elite[sh], SiteState.Spent);
  assert.ok(s.ents.hp[s.players[0].ent] > 50);
});

test('a greed shrine takes blood for gold, and will not kill', () => {
  const s = field();
  standAt(s, 100, 100);
  s.ents.hp[s.players[0].ent] = 30; // too weak
  const sh = plant(s, Kind.Shrine, ShrineKind.Greed);
  runFor(s, CHANNEL + 20);
  assert.equal(s.ents.elite[sh], SiteState.Waiting);
  s.ents.hp[s.players[0].ent] = 100;
  runFor(s, CHANNEL + 5);
  assert.equal(s.ents.elite[sh], SiteState.Spent);
  assert.ok(s.ents.hp[s.players[0].ent] <= 56 && s.ents.hp[s.players[0].ent] >= 1);
  const before = s.gold;
  runFor(s, 200);
  assert.ok(s.gold > before, 'the coins land in the purse');
});

test('the mini-boss is planned mid-field, gated, tough, and leaves a free chest', () => {
  for (let seed = 1; seed < 10; seed++) {
    const plan = planLevel(seed);
    const k = plan.findIndex((c) => c.elite);
    assert.ok(k >= 0 && plan[k].gate, `seed ${seed}`);
  }
  const s = createSim(4);
  s.tick = 500;
  const k = s.plan.findIndex((c) => c.elite);
  while (s.nextClump <= k) { /* stream up to and including the mini-boss */ s.camX = s.plan[s.nextClump].x; step(s, idle()); }
  const big = sitesOf(s, Kind.Mob).find((i) => s.ents.elite[i] === 1)!;
  assert.ok(big !== undefined);
  assert.ok(s.ents.maxhp[big] >= MOBS[s.ents.sub[big]].hp * 6);
  const free0 = sitesOf(s, Kind.Chest).length;
  damageMob(s, big, 1e9, 1, 0, 1, 0, 0);
  const chests = sitesOf(s, Kind.Chest);
  assert.equal(chests.length, free0 + 1);
  assert.ok(chests.some((c) => s.ents.elite[c] === SiteState.Free));
});

test('heat makes a bigger, meaner horde that pays more', () => {
  assert.ok(heatHorde(HEAT_MAX) > heatHorde(1));
  const count = (heat: number) => planLevel(5, undefined, { scale: heatHorde(heat), heat }).reduce((n, c) => n + c.size, 0);
  assert.ok(count(5) > count(0) * 1.5);
  const a = createSim(5, undefined, { heat: 0 }), b = createSim(5, undefined, { heat: 5 });
  assert.equal(b.heat, 5);
  for (const s of [a, b]) { s.ents.hp[s.players[0].ent] = 1000; s.players[0].invuln = 0; }
  hurtPlayer(a, 0, 10); hurtPlayer(b, 0, 10);
  assert.ok(1000 - b.ents.hp[b.players[0].ent] > 1000 - a.ents.hp[a.players[0].ent]);
  assert.equal(createSim(5, undefined, { heat: 99 }).heat, HEAT_MAX, 'clamped');
});

test('with every new system live, a run is deterministic', () => {
  const run = () => {
    const s = createSim(11, undefined, { heat: 3, surrender: true });
    for (let t = 0; t < 900; t++) { const f = idle(); f[0].moveX = 100; f[0].buttons = t % 7 === 0 ? Btn.Attack : 0; step(s, f); }
    return hashState(s);
  };
  assert.equal(run(), run());
});
