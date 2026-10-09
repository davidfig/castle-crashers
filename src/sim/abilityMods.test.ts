import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { MobType } from '../data/mobs';
import { cardFor, offerFor, UPGRADE_INDEX, UPGRADES } from '../data/upgrades';
import { costMul, novaCost } from './abilityMods';
import { allocEntity, freeEntity, Kind } from './entities';
import { Btn, createInputFrame, type InputFrame } from './input';
import { Ev, EV_STRIDE } from './events';
import { createSim, type GameState } from './state';
import { step } from './step';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);
const hold = (buttons: number): InputFrame[] => { const f = idle(); f[0].buttons = buttons; return f; };

function arena(cls: number, seed = 4): GameState {
  const s = createSim(seed);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const p = s.players[0];
  p.classId = cls;
  s.ents.x[p.ent] = s.ents.px[p.ent] = 100; s.ents.y[p.ent] = s.ents.py[p.ent] = 100;
  s.ents.hp[p.ent] = s.ents.maxhp[p.ent] = 1e6;
  s.camX = s.prevCamX = 0;
  p.faceX = 1; p.faceY = 0;
  return s;
}
const give = (s: GameState, id: string, r: number) => { s.players[0].ranks[UPGRADE_INDEX[id]] = r; };
const mob = (s: GameState, x: number, y = 100, hp = 1000): number => {
  const g = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, y, hp);
  s.ents.maxhp[g] = hp; s.ents.flags[g] = 1;
  return g;
};
const projectiles = (s: GameState): number => { let n = 0; for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Proj) n++; return n; };

test('every track costs more stamina, and they add up', () => {
  const r = new Uint8Array(UPGRADES.length);
  assert.equal(costMul(r, 0), 1);
  r[UPGRADE_INDEX.bsize] = 2;
  assert.ok(Math.abs(costMul(r, 0) - 1.24) < 1e-9);
  r[UPGRADE_INDEX.bcount] = 1; r[UPGRADE_INDEX.bspeed] = 1; r[UPGRADE_INDEX.bpower] = 1;
  assert.ok(Math.abs(costMul(r, 0) - (1 + 0.24 + 0.2 + 0.08 + 0.12)) < 1e-9);
  assert.equal(costMul(r, 1), 1, 'the special is billed separately');

  for (const cls of [0, 1]) {
    const spent = (rank: number) => { const s = arena(cls); give(s, 'bpower', rank); const before = s.players[0].stamina; step(s, hold(Btn.Attack)); return before - s.players[0].stamina; };
    assert.ok(spent(3) > spent(0) * 1.3, `class ${cls} pays more for a stronger attack`);
    const spentSp = (rank: number) => { const s = arena(cls); give(s, 'spower', rank); const before = s.players[0].stamina; step(s, hold(Btn.Ability2)); return before - s.players[0].stamina; };
    assert.ok(spentSp(3) > spentSp(0) * 1.3, `class ${cls} pays more for a stronger special`);
  }
  // a hero too winded to afford the dearer cost cannot use it
  const s = arena(1); give(s, 'spower', 4);
  s.players[0].stamina = CLASSES[1].specialCost * 1.2 - 0.01;
  step(s, hold(Btn.Ability2));
  assert.ok(s.players[0].stamina > CLASSES[1].specialCost * 1.1, 'not cast: it costs 1.48x now');
});

test('the mage fireball grows, splits, flies faster and hits harder, each on its own track', () => {
  const blastHit = (id: string, rank: number) => {
    const s = arena(1); give(s, id, rank);
    const g = mob(s, 150, 100), beside = mob(s, 150, 100 + 38);
    for (let t = 0; t < 70; t++) step(s, t === 0 ? hold(Btn.Attack) : idle());
    return [1000 - s.ents.hp[g], 1000 - s.ents.hp[beside]];
  };
  assert.ok(blastHit('bsize', 3)[1] > blastHit('bsize', 0)[1], 'the blast now reaches the one beside');
  assert.ok(blastHit('bpower', 3)[0] > blastHit('bpower', 0)[0] * 1.4, 'it hits harder');

  const shots = (rank: number) => { const s = arena(1); give(s, 'bcount', rank); step(s, hold(Btn.Attack)); return projectiles(s); };
  assert.equal(shots(0), 1); assert.equal(shots(2), 3);

  const speed = (rank: number) => { const s = arena(1); give(s, 'bspeed', rank); step(s, hold(Btn.Attack)); for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Proj && s.ents.alive[i]) return s.ents.vx[i]; return 0; };
  assert.ok(Math.abs(speed(3) / speed(0) - 1.6) < 1e-6);

  const bigShots = (rank: number) => { const s = arena(1); give(s, 'scount', rank); step(s, hold(Btn.Ability2)); return projectiles(s); };
  assert.equal(bigShots(0), 1); assert.equal(bigShots(2), 3);
});

test('the warrior sword reaches, opens its arc, recovers quicker and hits harder; the big swing forks its wave', () => {
  const hit = (id: string, rank: number, x: number, y = 100, ability: number = Btn.Attack) => {
    const s = arena(0); give(s, id, rank);
    const g = mob(s, x, y);
    step(s, hold(ability));
    return 1000 - s.ents.hp[g];
  };
  assert.equal(hit('bsize', 0, 150), 0); assert.ok(hit('bsize', 4, 150) > 0, 'reach 38 -> 56');
  assert.equal(hit('bcount', 0, 80), 0); assert.ok(hit('bcount', 4, 80) > 0, 'the arc opens right round behind');
  assert.ok(hit('bpower', 2, 125) > hit('bpower', 0, 125) * 1.3);
  const recover = (rank: number) => { const s = arena(0); give(s, 'bspeed', rank); step(s, hold(Btn.Attack)); return s.players[0].cdAttack; };
  assert.ok(recover(4) < recover(0));
  // the wave: a mob off to the side of the lane is caught only once the wave has forked
  assert.equal(hit('scount', 0, 190, 160, Btn.Ability2), 0);
  assert.ok(hit('scount', 2, 190, 160, Btn.Ability2) > 0, 'a forked lane');
});

test('ability cards say what the boon does for that class', () => {
  const size = UPGRADES[UPGRADE_INDEX.bsize], split = UPGRADES[UPGRADE_INDEX.ssize];
  assert.equal(cardFor(size, 1).name, 'FIREBALL'); assert.equal(cardFor(size, 0).name, 'SWORD');
  assert.equal(cardFor(split, 1).name, 'MEGABALL'); assert.equal(cardFor(split, 4).name, 'VOLLEY');
  assert.ok(cardFor(size, 1).text[1].startsWith('COST'));
  assert.equal(cardFor(UPGRADES[UPGRADE_INDEX.scount], 4).text[0], '+2 ARROWS');
  // the cleric's aura has no count track to offer
  for (let level = 2; level < 80; level++) for (const u of offerFor(level, 0, level, undefined, 2)) assert.ok(u !== UPGRADE_INDEX.bcount && u !== UPGRADE_INDEX.scount);
});

test('the nova and the dodge scale too: fury and stamina cost more, and the effects grow', () => {
  const r = new Uint8Array(UPGRADES.length);
  r[UPGRADE_INDEX.nsize] = 2; r[UPGRADE_INDEX.dcount] = 1;
  assert.ok(Math.abs(costMul(r, 2) - 1.12) < 1e-9); assert.ok(Math.abs(costMul(r, 3) - 1.2) < 1e-9);
  assert.ok(Math.abs(novaCost(r, 40, 100) - 44.8) < 1e-9);
  r[UPGRADE_INDEX.nsize] = 4; r[UPGRADE_INDEX.ncount] = 4; r[UPGRADE_INDEX.npower] = 4; r[UPGRADE_INDEX.nspeed] = 4;
  assert.equal(novaCost(r, 200, 100), 100, 'never more than a full bar');

  // the fury a cast takes
  for (const cls of [0, 1, 4]) {
    const spent = (rank: number) => { const s = arena(cls); give(s, 'npower', rank); s.players[0].fury = 90; step(s, hold(Btn.Ability1)); return 90 - s.players[0].fury; };
    assert.ok(spent(3) > spent(0) * 1.1, `class ${cls}: a stronger nova takes more fury`);
  }
  // a bar that cannot pay the dearer price does not cast
  const s = arena(1); give(s, 'npower', 4); s.players[0].fury = CLASSES[1].novaCost * 1.1;
  step(s, hold(Btn.Ability1));
  assert.equal(s.players[0].cdAbility1, 0, 'not cast: it now costs 1.24x');

  // the mage's nova: size reaches farther, power hits harder, speed recovers sooner, count echoes
  const nova = (id: string, rank: number, x = 140) => { const t = arena(1); give(t, id, rank); t.players[0].fury = 60; const g = mob(t, x); step(t, hold(Btn.Ability1)); const cd = t.players[0].cdAbility1; for (let k = 0; k < 40; k++) step(t, idle()); return [1000 - t.ents.hp[g], cd] as const; };
  assert.equal(nova('nsize', 0, 190)[0], 0); assert.ok(nova('nsize', 4, 190)[0] > 0, 'the ring now reaches past 85px');
  assert.ok(nova('npower', 3)[0] > nova('npower', 0)[0] * 1.4);
  assert.ok(nova('nspeed', 4)[1] < nova('nspeed', 0)[1]);
  assert.ok(nova('ncount', 2)[0] > nova('ncount', 0)[0] * 1.6, 'two echoes add to the first pulse');

  // the warrior's quake forks with the nova's count
  const lane = (rank: number) => { const t = arena(0); give(t, 'ncount', rank); t.players[0].fury = 90; const g = mob(t, 190, 160); step(t, hold(Btn.Ability1)); for (let k = 0; k < 3; k++) step(t, idle()); return 1000 - t.ents.hp[g]; };
  assert.equal(lane(0), 0); assert.ok(lane(2) > 0);

  // the archer's rain gets more arrows
  const arrows = (rank: number) => { const t = arena(4); give(t, 'ncount', rank); t.players[0].fury = 90; step(t, hold(Btn.Ability1)); for (let i = 0; i < t.ents.highWater; i++) if (t.ents.alive[i] && t.ents.kind[i] === Kind.Zone) return t.ents.mode[i]; return 0; };
  assert.equal(arrows(2) - arrows(0), 16);
});

test('the dodge: dearer, farther, quicker to come back, chained with Count, and blasting with Power', () => {
  const dodge = (cls: number, id: string, rank: number) => { const s = arena(cls); give(s, id, rank); const f = hold(Btn.Dodge); f[0].moveX = 127; const x0 = s.ents.x[s.players[0].ent]; const st0 = s.players[0].stamina; for (let t = 0; t < 20; t++) step(s, t === 0 ? f : idle()); return { s, moved: s.ents.x[s.players[0].ent] - x0, spent: st0 - s.players[0].stamina }; };
  for (const cls of [0, 1, 3, 4]) {
    assert.ok(dodge(cls, 'dpower', 4).spent > dodge(cls, 'dpower', 0).spent * 1.3, `class ${cls} pays for a stronger dodge`);
    assert.ok(dodge(cls, 'dsize', 4).moved > dodge(cls, 'dsize', 0).moved * 1.25, `class ${cls} goes farther`);
  }
  const wait = (rank: number) => { const { s } = dodge(0, 'dspeed', rank); return s.players[0].cdDash; };
  assert.ok(wait(4) < wait(0));
  // Count: a second dodge straight after the first, once, then the long cooldown
  const chain = (rank: number) => { const s = arena(4); give(s, 'dcount', rank); s.players[0].stamina = 1e6; let n = 0; for (let t = 0; t < 60; t++) { step(s, t % 2 === 0 ? hold(Btn.Dodge) : idle()); for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === Ev.Dash) n++; s.events.n = 0; } return n; };
  assert.ok(chain(2) > chain(0), 'extra dodges come quickly');
  // Power on a dodge with no strike of its own (the mage's blink) leaves a blast where it began
  const g = (rank: number) => { const s = arena(1); give(s, 'dpower', rank); const m = mob(s, 110); step(s, hold(Btn.Dodge)); for (let k = 0; k < 4; k++) step(s, idle()); return 1000 - s.ents.hp[m]; };
  assert.equal(g(0), 0); assert.ok(g(3) > 0);
});
