import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { MobType } from '../data/mobs';
import { UPGRADE_INDEX } from '../data/upgrades';
import { allocEntity, freeEntity, Kind } from './entities';
import { hashState } from './hash';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, PROC_BUDGET, type GameState } from './state';
import { hurtPlayer, step } from './step';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
function hold(buttons: number, moveX = 0): InputFrame[] { const f = idle(); f[0].buttons = buttons; f[0].moveX = moveX; return f; }

/** An empty field, hero at (100, 100) with plenty of health. */
function arena(seed = 4): GameState {
  const s = createSim(seed);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = 100; s.ents.y[pe] = s.ents.py[pe] = 100;
  s.ents.hp[pe] = 1e6;
  s.camX = s.prevCamX = 0;
  return s;
}
const give = (s: GameState, id: string, rank: number) => { s.players[0].ranks[UPGRADE_INDEX[id]] = rank; };
function goblin(s: GameState, x: number, y = 100, hp = 1): number {
  const g = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, y, hp);
  s.ents.flags[g] = 1;
  return g;
}
const alive = (s: GameState, m: number) => s.ents.alive[m] === 1 && s.ents.kind[m] === Kind.Mob;

test('Powder Kegs: a kill bursts and takes its neighbours with it; without the boon they live', () => {
  for (const rank of [0, 3]) {
    const s = arena();
    give(s, 'kegs', rank);
    s.rngCombat.fill(0); // (no luck needed: every roll is a success)
    goblin(s, 130, 100, 1);
    const nearby = goblin(s, 150, 100, 50);
    s.players[0].faceX = 1; s.players[0].faceY = 0;
    for (let t = 0; t < 4; t++) step(s, hold(Btn.Attack));
    if (rank === 0) assert.ok(alive(s, nearby), 'no boon, no blast');
    else assert.ok(!alive(s, nearby) || s.ents.hp[nearby] < 50, 'the blast hurt it');
  }
});

test('Bloodlust: a kill takes time off the special and the dodge', () => {
  const s = arena();
  give(s, 'lust', 2);
  goblin(s, 130, 100, 1);
  s.players[0].cdSpecial = 100; s.players[0].cdDash = 100;
  step(s, hold(Btn.Attack));
  assert.ok(s.kills >= 1);
  assert.ok(s.players[0].cdSpecial <= 100 - 24 + 1, `special ${s.players[0].cdSpecial}`);
  assert.ok(s.players[0].cdDash <= 100 - 12 + 1, `dodge ${s.players[0].cdDash}`);
});

test('Chain Spark: a hit can arc to a mob beside the target', () => {
  const s = arena();
  give(s, 'spark', 3);
  s.rngCombat.fill(0);
  goblin(s, 130, 100, 100);
  const beside = goblin(s, 130, 130, 100);
  s.ents.x[s.players[0].ent] = 110;
  s.players[0].faceX = 1; s.players[0].faceY = 0;
  step(s, hold(Btn.Attack));
  assert.ok(s.ents.hp[beside] < 100, 'the spark reached the neighbour');
});

test('Farewell: a dodge blasts the ground the hero left', () => {
  const s = arena();
  give(s, 'gift', 3);
  const g = goblin(s, 110, 100, 100);
  step(s, hold(Btn.Dodge, 127));
  assert.ok(s.ents.hp[g] < 100 || !alive(s, g), 'it was caught in the blast');
});

test('Last Stand: dropping low sets off a shockwave once, then it must recharge', () => {
  const s = arena();
  give(s, 'last', 1);
  const cls = CLASSES[s.players[0].classId];
  const pe = s.players[0].ent;
  const g = goblin(s, 130, 100, 100);
  s.ents.hp[pe] = cls.hp * 0.31;
  hurtPlayer(s, 0, 5);
  for (let k = 0; k < 4; k++) step(s, idle()); // (the hit freezes the game a moment first)
  assert.ok(s.ents.hp[g] < 100 || !alive(s, g), 'the wave hit it');
  const after = s.ents.hp[g];
  s.players[0].invuln = 0;
  hurtPlayer(s, 0, 1);
  for (let k = 0; k < 4; k++) step(s, idle());
  assert.equal(s.ents.hp[g], after, 'on cooldown');
});

test('a boon-fed chain reaction stays inside the tick budget and the sim stays deterministic', () => {
  const run = () => {
    const s = arena(9);
    give(s, 'kegs', 3); give(s, 'spark', 3);
    for (let k = 0; k < 150; k++) goblin(s, 120 + (k % 15) * 6, 80 + Math.floor(k / 15) * 6, 1);
    for (let t = 0; t < 120; t++) { step(s, hold(Btn.Attack)); assert.ok(s.procBudget >= 0 && s.procBudget <= PROC_BUDGET); assert.equal(s.procN, 0); }
    return hashState(s);
  };
  assert.equal(run(), run());
});

test('trigger boons change the state hash', () => {
  const a = arena(), b = arena();
  give(b, 'kegs', 1);
  assert.notEqual(hashState(a), hashState(b));
});

import { offerFor, UPGRADES } from '../data/upgrades';

function asClass(s: GameState, classId: number) { s.players[0].classId = classId; }

test('class boons are only offered to their class', () => {
  const warrior = UPGRADE_INDEX.rift, mage = UPGRADE_INDEX.echo;
  for (let level = 2; level < 60; level++) {
    for (const [cls, seen] of [[0, new Set<number>()], [1, new Set<number>()], [2, new Set<number>()]] as const) {
      for (const u of offerFor(level * 7, 0, level, undefined, cls)) seen.add(u);
      if (cls !== 0) assert.ok(!seen.has(warrior), `class ${cls} never sees Split Earth`);
      if (cls !== 1) assert.ok(!seen.has(mage), `class ${cls} never sees Echo Blast`);
    }
  }
  assert.ok(Array.from({ length: 80 }, (_, l) => offerFor(3, 0, l + 2, undefined, 0)).flat().includes(warrior), 'the warrior can');
  assert.ok(UPGRADES.every((u) => !u.classes || offerFor(1, 0, 2, undefined, undefined).every((i) => !UPGRADES[i].classes)), 'with no class, none of them');
});

test('Split Earth: the quake forks, reaching a mob off to the side of the lane', () => {
  for (const rank of [0, 1]) {
    const s = arena();
    give(s, 'rift', rank);
    s.players[0].fury = 100;
    s.players[0].faceX = 1; s.players[0].faceY = 0;
    const side = goblin(s, 190, 150, 50); // well outside the plain lane, inside the forked one
    step(s, hold(Btn.Ability1));
    for (let t = 0; t < 3; t++) step(s, idle());
    assert.equal(s.ents.hp[side] < 50 || !alive(s, side), rank > 0, `rank ${rank}`);
  }
});

test('Shatter: the special bursts around the hero', () => {
  const s = arena();
  give(s, 'pound', 3);
  s.players[0].faceX = -1; s.players[0].faceY = 0;
  const behind = goblin(s, 125, 100, 100); // behind the facing, out of the sweep's arc
  s.ents.face[behind] = 1;
  step(s, hold(Btn.Ability2));
  for (let t = 0; t < 4; t++) step(s, idle());
  assert.ok(s.ents.hp[behind] < 100 || !alive(s, behind));
});

test('Blood Tithe heals on every tenth kill; Executioner hits the wounded harder', () => {
  const s = arena();
  give(s, 'tithe', 2);
  const pe = s.players[0].ent;
  s.ents.hp[pe] = 10; s.players[0].kills = 9;
  goblin(s, 130, 100, 1);
  step(s, hold(Btn.Attack));
  assert.ok(s.ents.hp[pe] > 10, 'healed');

  const hit = (rank: number, hp: number) => {
    const a = arena(); give(a, 'exec', rank);
    const g = goblin(a, 130, 100, 1000); a.ents.maxhp[g] = 1000; a.ents.hp[g] = hp;
    a.players[0].faceX = 1; a.players[0].faceY = 0;
    step(a, hold(Btn.Attack));
    return hp - a.ents.hp[g];
  };
  assert.ok(hit(2, 200) > hit(0, 200) * 1.9, 'a wounded foe takes double at rank 2');
  assert.ok(Math.abs(hit(2, 900) - hit(0, 900)) < 1e-9, 'a healthy one does not');
});

test('Twin Flame fires more shots; Echo Blast sets a fireball off twice; Quicksilver feeds a blink; Iron Recoil shoves', () => {
  const shots = (rank: number) => { const s = arena(); asClass(s, 1); give(s, 'twin', rank); step(s, hold(Btn.Attack)); let n = 0; for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Proj) n++; return n; };
  assert.equal(shots(0), 1); assert.equal(shots(2), 3);

  const blast = (rank: number) => { const s = arena(); asClass(s, 1); give(s, 'echo', rank); const g = goblin(s, 135, 100, 100); s.players[0].faceX = 1; s.players[0].faceY = 0; for (let t = 0; t < 50; t++) step(s, t === 0 ? hold(Btn.Attack) : idle()); return 100 - s.ents.hp[g]; };
  assert.ok(blast(3) > blast(0), 'echo adds damage');

  const q = arena(); asClass(q, 1); give(q, 'quick', 2); q.players[0].fury = 10; q.players[0].cdAbility1 = 60;
  step(q, hold(Btn.Dodge, 127));
  assert.ok(q.players[0].fury > 30 && q.players[0].cdAbility1 < 40);

  const r = arena(); give(r, 'recoil', 3);
  const g = goblin(r, 115, 100, 100);
  r.ents.hp[r.players[0].ent] = 1e6;
  hurtPlayer(r, 0, 5);
  for (let k = 0; k < 4; k++) step(r, idle());
  assert.ok(r.ents.hp[g] < 100 || r.ents.x[g] > 115, 'the goblin was shoved or hurt');
});

test('Radiance: the cleric aura mends a hurt ally standing in it', () => {
  const run = (rank: number) => {
    const s = arena(); asClass(s, 2); give(s, 'radiance', rank);
    goblin(s, 120, 100, 1000);
    s.ents.hp[s.players[0].ent] = 10;
    for (let t = 0; t < 60; t++) step(s, t === 0 ? hold(Btn.Attack) : idle());
    return s.ents.hp[s.players[0].ent];
  };
  assert.ok(run(3) > run(0) + 3);
});

test('Holy Wrath: the heal pulse also hurts foes; Arrow Ring looses a ring on a dodge', () => {
  const s = arena(); asClass(s, 2); give(s, 'wrath', 3);
  const g = goblin(s, 120, 100, 100);
  step(s, hold(Btn.Dodge, 127));
  assert.ok(s.ents.hp[g] < 100 || !alive(s, g));

  const a = arena(); asClass(a, 4); give(a, 'ring', 2);
  step(a, hold(Btn.Dodge, 127));
  let arrows = 0;
  for (let i = 0; i < a.ents.highWater; i++) if (a.ents.alive[i] && a.ents.kind[i] === Kind.Proj) arrows++;
  assert.equal(arrows, 8);
});

test('Vigil: a fallen hero rises sooner with a cleric close by', () => {
  const rise = (rank: number) => {
    const s = arena(); activate(s);
    asClass(s, 2); give(s, 'vigil', rank);
    s.players[1].downed = true; s.players[1].downTimer = 600;
    for (let t = 0; t < 700; t++) { step(s, idle()); if (!s.players[1].downed) return t; }
    return 700;
  };
  assert.ok(rise(3) < rise(0) * 0.5);
});
import { activatePlayer } from './state';
function activate(s: GameState) { activatePlayer(s, 1, 120, 100); }

test('Death Dance frees the dodge after a vanish kill; Keen Edge and Pickpocket sharpen a flank', () => {
  const d = arena(); asClass(d, 3); give(d, 'dance', 1);
  goblin(d, 120, 100, 1);
  d.players[0].vanishT = 50; d.players[0].cdDash = 99;
  d.players[0].faceX = 1; d.players[0].faceY = 0;
  step(d, hold(Btn.Attack));
  assert.equal(d.players[0].cdDash, 0);

  const hit = (keen: number, pick: number) => {
    const s = arena(); asClass(s, 3); give(s, 'keen', keen); give(s, 'pick', pick);
    const g = goblin(s, 120, 100, 1000); s.ents.maxhp[g] = 1000; s.ents.face[g] = 1; // facing away from him
    s.players[0].faceX = 1; s.players[0].faceY = 0;
    step(s, hold(Btn.Attack));
    return [1000 - s.ents.hp[g], s.gold];
  };
  assert.ok(hit(2, 0)[0] > hit(0, 0)[0]);
  assert.ok(hit(0, 3)[1] === hit(0, 0)[1] + 3);
});

test('Eagle Eye hits far shots harder; Downpour rains more arrows', () => {
  const dmg = (rank: number) => { const s = arena(); asClass(s, 4); give(s, 'eagle', rank); const g = goblin(s, 200, 100, 1000); s.ents.maxhp[g] = 1000; s.players[0].faceX = 1; s.players[0].faceY = 0; for (let t = 0; t < 60; t++) step(s, t === 0 ? hold(Btn.Attack) : idle()); return 1000 - s.ents.hp[g]; };
  assert.ok(dmg(3) > dmg(0));

  const rain = (rank: number) => { const s = arena(); asClass(s, 4); give(s, 'downpour', rank); s.players[0].fury = 100; step(s, hold(Btn.Ability1)); for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Zone) return s.ents.mode[i]; return 0; };
  assert.equal(rain(2) - rain(0), 16);
});

import { OFFER_SIZE, rarityOf } from '../data/upgrades';

test('every offer has a trigger, no duplicates, only what the class may take', () => {
  for (const cls of [0, 1, 2, 3, 4]) {
    for (let level = 2; level <= 20; level++) {
      const o = offerFor(77, 1, level, undefined, cls);
      assert.equal(o.length, OFFER_SIZE);
      assert.equal(new Set(o).size, OFFER_SIZE);
      assert.ok(o.some((u) => UPGRADES[u].kind === 'trigger'), `class ${cls} level ${level} offered only numbers`);
      for (const u of o) { const c = UPGRADES[u].classes; assert.ok(!c || c.includes(cls)); }
    }
  }
});

test('offers lean toward the tags a hero already holds, and are a pure function of the held ranks', () => {
  const ranks = new Uint8Array(UPGRADES.length);
  ranks[UPGRADE_INDEX.kegs] = 1; // corpse, blast, fire
  const tally = (r?: Uint8Array) => {
    let blast = 0, total = 0;
    for (let seed = 0; seed < 400; seed++) for (const u of offerFor(seed, 0, 6, r, 1)) { total++; if (UPGRADES[u].tags.includes('blast') && u !== UPGRADE_INDEX.kegs) blast++; }
    return blast / total;
  };
  assert.ok(tally(ranks) > tally(undefined) * 1.15, 'blast boons come up more often once a blast boon is held');
  assert.deepEqual(offerFor(5, 0, 4, ranks, 1), offerFor(5, 0, 4, ranks, 1));
});

test('the common stats thin out and rares grow as levels rise; tiers default by kind', () => {
  const share = (level: number) => { let stat = 0, total = 0; for (let seed = 0; seed < 600; seed++) for (const u of offerFor(seed, 0, level, undefined, 0)) { total++; if (UPGRADES[u].kind === 'stat') stat++; } return stat / total; };
  assert.ok(share(18) < share(2));
  assert.equal(rarityOf(UPGRADES[UPGRADE_INDEX.heavy]), 0);
  assert.equal(rarityOf(UPGRADES[UPGRADE_INDEX.kegs]), 1);
});

import { Ev, EV_STRIDE } from './events';
import { Fx } from '../render/fx';

test('a boon that fires tells the presentation, which pops its picture once per moment', () => {
  const s = arena();
  give(s, 'kegs', 3);
  s.rngCombat.fill(0);
  for (let k = 0; k < 6; k++) goblin(s, 120 + k * 6, 100, 1);
  s.players[0].faceX = 1; s.players[0].faceY = 0;
  const fx = new Fx();
  let procs = 0;
  for (let t = 0; t < 30; t++) {
    step(s, hold(Btn.Attack));
    for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === Ev.Proc) { procs++; assert.equal(s.events.data[k * EV_STRIDE + 4], UPGRADE_INDEX.kegs); }
    fx.consume(s.events);
    s.events.n = 0;
  }
  assert.ok(procs >= 1, 'the sim announced it');
  let pops = 0;
  for (let i = 0; i < fx.pt.length; i++) if (fx.pt[i] >= 0) pops++;
  assert.equal(pops, 1, 'many bursts in a chain are one picture');
});

import { activatePlayer as joinSlot } from './state';

test('company-only boons are never offered to a solo hero; legendaries wait for their unlock', () => {
  const solo = new Set<number>(), duo = new Set<number>();
  for (let level = 2; level < 60; level++) {
    for (const u of offerFor(level * 13, 0, level, undefined, 0, { party: 1 })) solo.add(u);
    for (const u of offerFor(level * 13, 0, level, undefined, 0, { party: 2 })) duo.add(u);
  }
  for (const id of ['martyr', 'rally']) { assert.ok(!solo.has(UPGRADE_INDEX[id]), `${id} not for one`); }
  assert.ok(duo.has(UPGRADE_INDEX.martyr) || duo.has(UPGRADE_INDEX.rally), 'but for two');

  const locked = new Set<number>(), open = new Set<number>();
  const nodes = new Set<string>();
  for (let level = 2; level < 120; level++) {
    for (const u of offerFor(level * 31, 0, level, undefined, 0, { unlocked: nodes })) locked.add(u);
    for (const u of offerFor(level * 31, 0, level, undefined, 0, { unlocked: new Set(['legend']) })) open.add(u);
  }
  for (const id of ['glass', 'phoenix', 'frenzy']) { assert.ok(!locked.has(UPGRADE_INDEX[id]), `${id} locked`); }
  assert.ok(['glass', 'phoenix', 'frenzy'].some((id) => open.has(UPGRADE_INDEX[id])), 'and open once unlocked');
  assert.ok(UPGRADES.filter((u) => u.rarity === 2).every((u) => u.unlock === 'legend'), 'every legendary is gated');
});

test('War Banner and Warding reach an ally who stands close, and not one who does not', () => {
  const hit = (x: number) => {
    const t = arena(); joinSlot(t, 1, x, 100);
    t.players[0].ranks[UPGRADE_INDEX.banner] = 3;
    const g = goblin(t, x + 30, 100, 1000); t.ents.maxhp[g] = 1000;
    t.players[1].faceX = 1; t.players[1].faceY = 0;
    const inputs = idle(); inputs[1].buttons = Btn.Attack;
    step(t, inputs);
    return 1000 - t.ents.hp[g];
  };
  assert.ok(hit(130) > hit(400) * 1.1, 'near the bearer hits harder than far from them');

  const taken = (x: number) => { const t = arena(); joinSlot(t, 1, x, 100); t.players[0].ranks[UPGRADE_INDEX.ward] = 3; t.ents.hp[t.players[1].ent] = 100; hurtPlayer(t, 1, 10); return 100 - t.ents.hp[t.players[1].ent]; };
  assert.ok(taken(130) < taken(400) * 0.8);
});

test('Martyr mends the party when its bearer falls; Avenger fills an ally with power; Phoenix refuses the first death', () => {
  const s = arena(); joinSlot(s, 1, 130, 100);
  const e = s.ents;
  s.players[0].ranks[UPGRADE_INDEX.martyr] = 3;
  e.hp[s.players[1].ent] = 10;
  e.hp[s.players[0].ent] = 5;
  hurtPlayer(s, 0, 50);
  assert.ok(s.players[0].downed);
  assert.ok(e.hp[s.players[1].ent] > 40, 'the ally was mended');

  const a = arena(); joinSlot(a, 1, 130, 100);
  a.players[1].ranks[UPGRADE_INDEX.rally] = 1; a.players[1].fury = 0; a.players[1].cdSpecial = 99;
  a.ents.hp[a.players[0].ent] = 5;
  hurtPlayer(a, 0, 50);
  assert.equal(a.players[1].cdSpecial, 0);
  assert.equal(a.players[1].fury, CLASSES[a.players[1].classId].furyMax);

  const p = arena();
  p.players[0].ranks[UPGRADE_INDEX.phoenix] = 1;
  const g = goblin(p, 130, 100, 100);
  p.ents.hp[p.players[0].ent] = 5;
  hurtPlayer(p, 0, 50);
  assert.ok(!p.players[0].downed && p.ents.hp[p.players[0].ent] >= CLASSES[0].hp * 0.5 - 1, 'back on their feet');
  for (let k = 0; k < 4; k++) step(p, idle());
  assert.ok(p.ents.hp[g] < 100 || !alive(p, g), 'in a burst of flame');
  p.players[0].invuln = 0;
  p.ents.hp[p.players[0].ent] = 5;
  hurtPlayer(p, 0, 50);
  assert.ok(p.players[0].downed, 'only once');
});

test('Glass Fang doubles damage dealt and takes half again; Frenzy shortens attack cooldowns', () => {
  const dmg = (rank: number) => { const s = arena(); give(s, 'glass', rank); const g = goblin(s, 130, 100, 1000); s.ents.maxhp[g] = 1000; s.players[0].faceX = 1; s.players[0].faceY = 0; step(s, hold(Btn.Attack)); return 1000 - s.ents.hp[g]; };
  assert.ok(Math.abs(dmg(1) - 2 * dmg(0)) < 1e-6);
  const taken = (rank: number) => { const s = arena(); give(s, 'glass', rank); s.ents.hp[s.players[0].ent] = 100; hurtPlayer(s, 0, 10); return 100 - s.ents.hp[s.players[0].ent]; };
  assert.ok(Math.abs(taken(1) - 1.5 * taken(0)) < 1e-6);
  const wait = (rank: number) => { const s = arena(); give(s, 'frenzy', rank); s.players[0].cdAttack = 40; let t = 0; while (s.players[0].cdAttack > 0 && t < 100) { step(s, idle()); t++; } return t; };
  assert.ok(wait(1) < wait(0) * 0.8);
});

import { botInput } from './bot';
import { UPGRADES as ALL_UPGRADES } from '../data/upgrades';

/** Every class, every boon at top rank, a bot at the controls: the run is deterministic and nothing goes non-finite or leaks. */
test('all boons at once, every class: deterministic, finite, and the queues drain', () => {
  const play = (cls: number) => {
    const s = createSim(11 + cls);
    s.players[0].classId = cls;
    s.ents.hp[s.players[0].ent] = s.ents.maxhp[s.players[0].ent] = CLASSES[cls].hp;
    activatePlayer(s, 1, 60, 140); s.players[1].classId = (cls + 2) % 5; s.ents.hp[s.players[1].ent] = CLASSES[s.players[1].classId].hp;
    for (const p of s.players) if (p.active) ALL_UPGRADES.forEach((u, i) => { if (u.id !== 'wind') p.ranks[i] = u.maxRank; });
    const inputs = [0, 1, 2, 3].map(createInputFrame);
    for (let t = 0; t < 1500; t++) {
      botInput(s, 0, inputs[0]); botInput(s, 1, inputs[1]);
      step(s, inputs);
      assert.equal(s.procN, 0, `procs drained (tick ${t})`);
      assert.ok(s.procBudget >= 0 && s.procBudget <= PROC_BUDGET);
      s.events.n = 0;
    }
    for (let i = 0; i < s.ents.highWater; i++) {
      if (!s.ents.alive[i]) continue;
      assert.ok(Number.isFinite(s.ents.x[i]) && Number.isFinite(s.ents.y[i]) && Number.isFinite(s.ents.hp[i]), `entity ${i} finite`);
    }
    for (const p of s.players) assert.ok(!p.active || Number.isFinite(s.ents.hp[p.ent]));
    return hashState(s);
  };
  for (let cls = 0; cls < 5; cls++) assert.equal(play(cls), play(cls), `class ${cls} replays identically`);
});
