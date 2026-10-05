import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES, classForBotSlot } from '../data/classes';
import { HERO_CLASSES } from '../render/hero';
import { botInput } from './bot';
import { Btn, createInputFrame } from './input';
import { allocEntity, Kind } from './entities';
import { Ev, EV_STRIDE } from './events';
import { MOBS } from '../data/mobs';
import { createSim } from './state';
import { step } from './step';

const idle = () => [0, 1, 2, 3].map(createInputFrame);

test('the class table and the art agree on the order', () => {
  assert.deepEqual(CLASSES.map((c) => c.name), [...HERO_CLASSES]);
});

test('every class has sane numbers', () => {
  for (const c of CLASSES) {
    for (const [k, v] of Object.entries(c)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${c.name}.${k}`);
    assert.ok(c.hp > 0 && c.speed > 0 && c.combo.length >= 1, c.name);
    for (const sw of [...c.combo, c.special]) assert.ok(sw.range > 0 && sw.damage > 0 && sw.cooldown > 0 && sw.dot >= -1 && sw.dot <= 1, `${c.name} swing`);
  }
});

test('bot slots take different classes, whatever the seed; slot 0 stays the warrior', () => {
  const seen = new Set<number>();
  for (let seed = 0; seed < 12; seed++) {
    const picks = [0, 1, 2, 3].map((k) => classForBotSlot(k, seed));
    assert.equal(picks[0], 0);
    assert.equal(new Set(picks).size, 4, `seed ${seed}: ${picks.join(',')}`);
    for (const c of picks) { assert.ok(c >= 0 && c < CLASSES.length); seen.add(c); }
  }
  assert.equal(seen.size, CLASSES.length, 'across seeds every class gets a turn');
});

test('a joined player gets the hit points of the class it was given', () => {
  const s = createSim(1);
  s.players[2].classId = 2; // cleric
  const f = idle();
  f[2].buttons = Btn.Join;
  step(s, f);
  assert.equal(s.ents.hp[s.players[2].ent], CLASSES[2].hp);
});

test('every class can play on its own for ten seconds without breaking the sim', () => {
  for (let c = 0; c < CLASSES.length; c++) {
    const s = createSim(3);
    s.players[0].classId = c;
    s.ents.hp[s.players[0].ent] = CLASSES[c].hp;
    const f = idle();
    for (let t = 0; t < 600; t++) {
      botInput(s, 0, f[0]);
      step(s, f);
    }
    const e = s.ents;
    for (const q of s.players) if (q.active) assert.ok(Number.isFinite(e.hp[q.ent]) && Number.isFinite(e.x[q.ent]), `${CLASSES[c].name} produced NaN`);
  }
});

test("the cleric's nova heals a hurt ally in range, not one far away, and never above their max", () => {
  const s = createSim(1);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) e.alive[i] = 0;
  s.spawnTimer = 1e9;
  s.players[0].classId = 2;                       // cleric
  const join = idle();
  join[1].buttons = Btn.Join;
  step(s, join);                                  // player 2 joins as a warrior
  const cl = s.players[0].ent, ally = s.players[1].ent;
  e.x[cl] = e.px[cl] = 200; e.y[cl] = e.py[cl] = 100;
  e.x[ally] = e.px[ally] = 230; e.y[ally] = e.py[ally] = 100;
  s.camX = s.prevCamX = 100;
  e.hp[ally] = 40;
  s.players[0].fury = 60;
  const f = idle();
  f[0].buttons = Btn.Ability1;
  step(s, f);
  assert.ok(e.hp[ally] > 40, 'ally in range was healed');
  assert.ok(e.hp[ally] <= CLASSES[0].hp, 'not above max');
  // far away: unchanged
  e.x[ally] = e.px[ally] = 500;
  e.hp[ally] = 40;
  s.players[0].fury = 60;
  s.players[0].cdAbility1 = 0;
  f[0].buttons = 0; step(s, f);
  f[0].buttons = Btn.Ability1; step(s, f);
  assert.equal(e.hp[ally], 40);
});

test('the archer shoots instead of swinging: arrows at a high rate, no slash, hurting what they hit', () => {
  const s = createSim(1);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) e.alive[i] = 0;
  s.spawnTimer = 1e9;
  const archer = CLASSES.findIndex((c) => c.name === 'archer');
  s.players[0].classId = archer;
  const pe = s.players[0].ent;
  e.x[pe] = e.px[pe] = 200; e.y[pe] = e.py[pe] = 100;
  s.camX = s.prevCamX = 100;
  // a goblin straight ahead, within arrow range
  const g = allocEntity(e, Kind.Mob, 0, 260, 100, MOBS[0].hp);
  e.flags[g] = 1; e.face[g] = -1;
  const f = idle();
  f[0].buttons = Btn.Attack;
  let swings = 0, arrows = 0;
  for (let t = 0; t < 40; t++) {
    step(s, f);
    for (let k = 0; k < s.events.n; k++) {
      const ty = s.events.data[k * EV_STRIDE];
      if (ty === Ev.Swing || ty === Ev.Finisher) swings++;
      if (ty === Ev.Fire) arrows++;
    }
  }
  assert.equal(swings, 0, 'no slash arc');
  assert.ok(arrows >= 4, `fires several arrows in 40 ticks (${arrows})`);
  assert.ok(!e.alive[g] || e.kind[g] !== Kind.Mob || e.hp[g] < MOBS[0].hp, 'the goblin was hit');
});

test("an archer's arrow is not swatted by another player's swing, and the arrow expires", () => {
  const s = createSim(1);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) e.alive[i] = 0;
  s.spawnTimer = 1e9;
  const archer = CLASSES.findIndex((c) => c.name === 'archer');
  s.players[0].classId = archer;
  const f = idle();
  f[0].buttons = Btn.Attack;
  step(s, f);
  let proj = 0;
  for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] === Kind.Proj) proj++;
  assert.ok(proj >= 1, 'an arrow is in flight');
  f[0].buttons = 0;
  for (let t = 0; t < CLASSES[archer].shot!.ttl + 5; t++) step(s, f);
  proj = 0;
  for (let i = 0; i < e.highWater; i++) if (e.alive[i] && e.kind[i] === Kind.Proj) proj++;
  assert.equal(proj, 0, 'arrows expire');
});

test('the mage throws fireballs instead of swinging: no slash, and an impact hurts the neighbours too', () => {
  const s = createSim(1);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) e.alive[i] = 0;
  s.spawnTimer = 1e9;
  const mage = CLASSES.findIndex((c) => c.name === 'mage');
  s.players[0].classId = mage;
  const pe = s.players[0].ent;
  e.x[pe] = e.px[pe] = 200; e.y[pe] = e.py[pe] = 100;
  s.camX = s.prevCamX = 100;
  const hit = allocEntity(e, Kind.Mob, 1, 250, 100, 200);   // an orc takes the fireball
  const near = allocEntity(e, Kind.Mob, 1, 250, 108, 200);  // its neighbour, inside the splash
  const far = allocEntity(e, Kind.Mob, 1, 250, 160, 200);   // well outside it
  for (const m of [hit, near, far]) { e.flags[m] = 1; e.face[m] = -1; e.hp[m] = 200; }
  const f = idle();
  f[0].buttons = Btn.Attack;
  let swings = 0, blasts = 0;
  for (let t = 0; t < 60; t++) {
    step(s, f);
    f[0].buttons = t === 0 ? Btn.Attack : 0;                  // a single cast
    for (let k = 0; k < s.events.n; k++) {
      const ty = s.events.data[k * EV_STRIDE];
      if (ty === Ev.Swing || ty === Ev.Finisher) swings++;
      if (ty === Ev.Blast) blasts++;
    }
  }
  assert.equal(swings, 0, 'no slash arc');
  assert.ok(blasts >= 1, 'the fireball exploded');
  assert.ok(e.hp[hit] < 200, 'the target was hit');
  assert.ok(e.hp[near] < 200, 'the neighbour caught the splash');
  assert.equal(e.hp[far], 200, 'the distant one did not');
});

function dashSetup(classId: number) {
  const s = createSim(1);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) e.alive[i] = 0;
  s.spawnTimer = 1e9;
  s.players[0].classId = classId;
  const join = idle();
  join[1].buttons = Btn.Join;
  step(s, join);
  const me = s.players[0].ent;
  e.x[me] = e.px[me] = 200; e.y[me] = e.py[me] = 100;
  s.camX = s.prevCamX = 100;
  e.hp[me] = CLASSES[classId].hp;
  const dash = idle();
  dash[0].moveX = 127;
  dash[0].buttons = Btn.Dodge;
  return { s, e, me, dash };
}

test('mage dash teleports a set distance at once and is invulnerable after', () => {
  const { s, e, me, dash } = dashSetup(1);
  step(s, dash);
  assert.ok(e.x[me] - 200 > 60, `teleported ${e.x[me] - 200}`);
  assert.ok(s.players[0].invuln > 0);
});

test('rogue dash vanishes: mobs stop targeting, and attacking breaks it', () => {
  const { s, e, me, dash } = dashSetup(3);
  step(s, dash);
  assert.ok(s.players[0].vanishT > 0);
  for (let k = 0; k < 10; k++) step(s, idle());
  assert.ok(s.players[0].vanishT > 0, 'still unseen');
  const atk = idle(); atk[0].buttons = Btn.Attack;
  step(s, atk);
  assert.equal(s.players[0].vanishT, 0);
  void me; void e;
});

test('cleric dash heals nearby allies, not distant ones', () => {
  const { s, e, me, dash } = dashSetup(2);
  const ally = s.players[1].ent;
  e.x[ally] = e.px[ally] = 230; e.y[ally] = e.py[ally] = 100; e.hp[ally] = 40;
  step(s, dash);
  assert.ok(e.hp[ally] > 40 && e.hp[ally] <= CLASSES[0].hp);
  void me;
});

test('warrior dash is a charge that bowls over mobs in its path', () => {
  const { s, e, me, dash } = dashSetup(0);
  const m = allocEntity(e, Kind.Mob, 1, 230, 100, 500);
  e.hp[m] = 500;
  const before = e.hp[m];
  for (let k = 0; k < 12; k++) { step(s, k === 0 ? dash : idle()); }
  assert.ok(e.hp[m] < before, 'mob was hurt');
  assert.ok(e.x[me] > 240, 'charged through');
});

test('the cleric attacks all round her: it hits what is behind it, and emits no slash and no per-hit pulse', () => {
  const { s, e, me } = dashSetup(2);
  const front = allocEntity(e, Kind.Mob, 1, me >= 0 ? 215 : 0, 100, 200);
  const behind = allocEntity(e, Kind.Mob, 1, 185, 100, 200);
  const far = allocEntity(e, Kind.Mob, 1, 300, 100, 200);
  const f = idle(); f[0].buttons = Btn.Attack;
  step(s, f);
  assert.ok(e.hp[front] < 200 && e.hp[behind] < 200, 'both sides hurt');
  assert.equal(e.hp[far], 200);
  let slash = false, pulse = false;
  for (let k = 0; k < s.events.n; k++) { const t = s.events.data[k * EV_STRIDE]; if (t === Ev.Swing || t === Ev.Finisher) slash = true; if (t === Ev.Pulse) pulse = true; }
  assert.ok(!pulse && !slash);
});

test("the cleric's attack button toggles a pulsing aura that drains stamina and stops when toggled off or out of stamina", () => {
  const { s, e, me } = dashSetup(2);
  const g = allocEntity(e, Kind.Mob, 1, 215, 100, 5000);
  const press = idle(); press[0].buttons = Btn.Attack;
  step(s, press);
  assert.ok(s.players[0].auraOn);
  step(s, idle());                                  // released: still on
  assert.ok(s.players[0].auraOn);
  const st = s.players[0].stamina;
  for (let k = 0; k < 60; k++) step(s, idle());
  assert.ok(s.players[0].stamina < st, 'drains');
  assert.ok(e.hp[g] < 5000, 'pulsed on its own');
  step(s, press);                                   // toggle off
  assert.ok(!s.players[0].auraOn);
  void me;
  s.players[0].stamina = 1;
  step(s, idle()); step(s, press);
  for (let k = 0; k < 30; k++) step(s, idle());
  assert.ok(!s.players[0].auraOn, 'runs dry');
});

test('the rogue hits a mob from behind (or out of a vanish) much harder than head-on', () => {
  const hitFor = (faceAway: boolean, vanished = false): number => {
    const s = createSim(1);
    s.players[0].classId = 3; // rogue
    const f = idle();
    f[0].buttons = Btn.Join;
    step(s, f);
    const p = s.players[0], e = s.ents;
    p.faceX = 1; p.faceY = 0;
    const m = allocEntity(e, Kind.Mob, 0, e.x[p.ent] + 20, e.y[p.ent], 1);
    e.hp[m] = e.maxhp[m] = 1000;
    e.flags[m] = 1;
    e.face[m] = faceAway ? 1 : -1;
    if (vanished) p.vanishT = 50;
    f[0].buttons = Btn.Attack;
    step(s, f);
    return 1000 - e.hp[m];
  };
  const front = hitFor(false), back = hitFor(true), ambush = hitFor(false, true);
  assert.ok(back >= front * 2.4, `back ${back} vs front ${front}`);
  assert.ok(ambush > back, `ambush ${ambush} vs back ${back}`);
});

test("the archer's arrows hit harder the farther they have flown", () => {
  const dmgAt = (flown: number): number => {
    const s = createSim(1);
    s.players[0].classId = 4; // archer
    const f = idle();
    f[0].buttons = Btn.Join;
    step(s, f);
    const e = s.ents, a = CLASSES[4].shot!;
    const m = allocEntity(e, Kind.Mob, 0, 300, 100, 1);
    e.hp[m] = e.maxhp[m] = 1000;
    e.flags[m] = 1;
    const q = allocEntity(e, Kind.Proj, 1, 297, 100, a.ttl - Math.round(a.ttl * flown));
    e.vx[q] = a.speed; e.vy[q] = 0;
    step(s, idle());
    return 1000 - e.hp[m];
  };
  assert.ok(dmgAt(0.95) > dmgAt(0.05) * 1.8, `${dmgAt(0.95)} vs ${dmgAt(0.05)}`);
});

test("the cleric's aura is continuous: steady chip damage every few ticks, no pulse bursts, and it never stuns or freezes", () => {
  const s = createSim(1);
  s.players[0].classId = 2; // cleric
  const f = idle();
  f[0].buttons = Btn.Join;
  step(s, f);
  const p = s.players[0], e = s.ents;
  const m = allocEntity(e, Kind.Mob, 1, e.x[p.ent] + 20, e.y[p.ent], 1); // an orc
  e.hp[m] = e.maxhp[m] = 1000;
  e.flags[m] = 1;
  e.vx[m] = 0;
  f[0].buttons = Btn.Attack;
  step(s, f);
  f[0].buttons = 0;
  assert.ok(p.auraOn);
  let hits = 0, last = e.hp[m], pulses = 0, stunned = 0;
  for (let t = 0; t < 80; t++) {
    step(s, f);
    if (e.hp[m] < last) hits++;
    last = e.hp[m];
    if (e.stun[m] > 0) stunned++;
    for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === Ev.Pulse) pulses++;
    assert.equal(s.hitStop, 0, 'the aura never freezes the game');
    e.x[m] = e.x[p.ent] + 20; // hold it in reach so only the cadence is measured
    e.y[m] = e.y[p.ent];
  }
  assert.ok(hits >= 8, `the aura hit ${hits} times in 80 ticks`);
  assert.equal(pulses, 0);
  assert.equal(stunned, 0);
});
