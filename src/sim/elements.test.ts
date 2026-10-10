import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENT_COUNT, Element } from '../data/elements';
import { MOBS, MobType, Pattern, ProjStyle, type Special } from '../data/mobs';
import { allocEntity, freeEntity, Kind, ZoneKind, ELEM_MASK } from './entities';
import { Ev, EV_STRIDE } from './events';
import { createInputFrame } from './input';
import { dropPool, fireSpecialOf, layout, startSpecialOf } from './abilities';
import { elementHit, elementPulse } from './elements';
import { activatePlayer, createSim, type GameState } from './state';
import { step } from './step';

const idle = () => [0, 1, 2, 3].map(createInputFrame);

/** An empty field with hero 0 at (100, 100) and nothing spawning. */
function arena(seed = 1): GameState {
  const s = createSim(seed);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) freeEntity(e, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const pe = s.players[0].ent;
  e.x[pe] = 100; e.y[pe] = 100; e.px[pe] = 100; e.py[pe] = 100;
  s.camX = 0; s.prevCamX = 0;
  return s;
}

/** A mob of some type standing at (x, y) facing the hero. */
function mob(s: GameState, x: number, y: number, type: number = MobType.Goblin): number {
  const i = allocEntity(s.ents, Kind.Mob, type, x, y, MOBS[type].hp);
  s.ents.flags[i] = 1;
  s.ents.face[i] = -1;
  return i;
}

function events(s: GameState, type: number): number {
  let n = 0;
  for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === type) n++;
  return n;
}

/** Cast a special at hero 0 from mob `m`: start it (locks the aim) and fire it. */
function cast(s: GameState, m: number, sp: Special): boolean {
  const e = s.ents, tp = s.players[0].ent;
  const dx = e.x[tp] - e.x[m], dy = e.y[tp] - e.y[m], d = Math.sqrt(dx * dx + dy * dy);
  if (!startSpecialOf(s, m, sp, 0, d, dx / d, dy / d)) return false;
  fireSpecialOf(s, m, sp, 0);
  return true;
}

function run(s: GameState, ticks: number): void { for (let t = 0; t < ticks; t++) step(s, idle()); }

const hpOf = (s: GameState, slot = 0): number => s.ents.hp[s.players[slot].ent];

test('every element does what its table says to a hero it hits', () => {
  for (let el = 1; el < ELEMENT_COUNT; el++) {
    const s = arena();
    const p = s.players[0];
    elementHit(s, 0, el, 1, 6, 60, 100);
    const got = {
      [Element.Fire]: p.poisonT > 0 && p.burning,
      [Element.Ice]: p.slowT > 0 && p.rootT === 0,
      [Element.Lightning]: p.witherT > 0,
      [Element.Poison]: p.poisonT > 0 && !p.burning,
      [Element.Shadow]: p.silenceT > 0,
      [Element.Holy]: p.rootT > 0 && p.silenceT > 0,
      [Element.Earth]: p.rootT > 0,
      [Element.Wind]: p.confuseT > 0 && p.pullT > 0,
      [Element.Arcane]: p.hexT > 0,
      [Element.Blood]: p.poisonT > 0 && !p.burning,
    }[el as 1];
    assert.ok(got, `element ${el} had its effect`);
  }
});

test('ice freezes a hero who is already chilled; a stronger skill lasts longer', () => {
  const s = arena();
  const p = s.players[0];
  elementHit(s, 0, Element.Ice, 1, 4, 60, 100);
  assert.equal(p.rootT, 0, 'the first touch only chills');
  elementHit(s, 0, Element.Ice, 1, 4, 60, 100);
  assert.ok(p.rootT > 0, 'the second freezes');
  const a = arena(), b = arena();
  elementHit(a, 0, Element.Fire, 0.6, 4, 60, 100);
  elementHit(b, 0, Element.Fire, 1.8, 4, 60, 100);
  assert.ok(b.players[0].poisonT > a.players[0].poisonT);
});

test('lightning leaps to a hero close to the one struck, and only a close one', () => {
  const s = arena();
  activatePlayer(s, 1, 140, 100); // 40 px from hero 0
  activatePlayer(s, 2, 400, 100); // far away
  const before = [hpOf(s, 1), hpOf(s, 2)];
  elementHit(s, 0, Element.Lightning, 1, 10, 60, 100);
  assert.ok(hpOf(s, 1) < before[0], 'the near hero is shocked');
  assert.equal(hpOf(s, 2), before[1], 'the far one is not');
  assert.ok(events(s, Ev.Arc) >= 1, 'an arc is drawn');
});

test('blood heals the monster that drew it', () => {
  const s = arena();
  const m = mob(s, 130, 100, MobType.Orc);
  s.ents.hp[m] = 5;
  elementHit(s, 0, Element.Blood, 1, 12, 130, 100, m);
  assert.ok(s.ents.hp[m] > 5);
});

test('a fire lob burns the hero it lands on, leaves a pool where residue is asked for, and that pool keeps burning', () => {
  const s = arena();
  const m = mob(s, 200, 100, MobType.Slinger);
  const sp: Special = { kind: 'lob', windup: 10, cooldown: 100, minRange: 0, maxRange: 300, radius: 20, damage: 8, delay: 20, element: Element.Fire, residue: { radius: 22, linger: 200, damage: 2 } };
  assert.ok(cast(s, m, sp));
  run(s, 30);
  const p = s.players[0];
  assert.ok(hpOf(s) < s.ents.maxhp[p.ent], 'the strike hurt');
  assert.ok(p.burning && p.poisonT > 0, 'and set the hero alight');
  let pool = -1;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Zone && s.ents.sub[i] === ZoneKind.Pool) pool = i;
  assert.ok(pool >= 0, 'a pool of fire is left behind');
  assert.equal(s.ents.flags[pool] & ELEM_MASK, Element.Fire);
  p.poisonT = 0;
  run(s, 30);
  assert.ok(p.poisonT > 0, 'standing in it keeps the hero burning');
});

test('multi-strike patterns lay their strikes out as promised', () => {
  const s = arena();
  const out = (pattern: number, count: number, spread: number): number[][] => {
    const l = layout(s, pattern, count, spread, 0, 100, 100, 100); // caster to the left of the aim, on the same row
    return Array.from({ length: count }, (_, k) => [l[k * 3], l[k * 3 + 1], l[k * 3 + 2]]);
  };
  const line = out(Pattern.Line, 5, 40);
  assert.ok(line.every((p) => Math.abs(p[1]) < 1e-6) && line[0][0] < line[4][0], 'a line runs along the way the caster faces');
  assert.ok(Math.abs(line[0][0] + 40) < 1e-6 && Math.abs(line[4][0] - 40) < 1e-6);
  const wall = out(Pattern.Wall, 5, 40);
  assert.ok(wall.every((p) => Math.abs(p[0]) < 1e-6) && Math.abs(wall[4][1] - wall[0][1]) > 40, 'a wall stands across it');
  const ring = out(Pattern.Ring, 6, 30);
  for (const p of ring) assert.ok(Math.abs(Math.hypot(p[0], p[1] / 0.7) - 30) < 0.1, 'a ring is round');
  const cross = out(Pattern.Cross, 5, 30);
  assert.deepEqual(cross[0].slice(0, 2), [0, 0]);
  const spiral = out(Pattern.Spiral, 8, 40);
  assert.ok(Math.hypot(spiral[7][0], spiral[7][1]) > Math.hypot(spiral[1][0], spiral[1][1]), 'a spiral winds outward');
  assert.ok(spiral[7][2] > spiral[1][2], 'and later');
  const march = out(Pattern.March, 4, 0);
  assert.ok(march[0][0] < march[3][0] && Math.abs(march[3][0]) < 1e-6, 'a march comes from the caster to the hero');
});

test('a ring-pattern lob puts nothing on the hero, so standing still in the middle is safe', () => {
  const s = arena();
  const m = mob(s, 250, 100, MobType.Slinger);
  const sp: Special = { kind: 'lob', windup: 10, cooldown: 100, minRange: 0, maxRange: 300, radius: 14, damage: 8, delay: 20, count: 6, spread: 50, pattern: Pattern.Ring, element: Element.Ice };
  assert.ok(cast(s, m, sp));
  const before = hpOf(s);
  run(s, 60);
  assert.equal(hpOf(s), before, 'a hero in the middle of the ring is untouched');
  assert.ok(events(s, Ev.Burst) >= 0);
});

test('a bolt flies where it was aimed, hits once, and carries its element; a sidestep dodges it', () => {
  const s = arena();
  const m = mob(s, 220, 100, MobType.Slinger);
  const sp: Special = { kind: 'bolt', windup: 10, cooldown: 100, minRange: 0, maxRange: 300, count: 1, spread: 0, speed: 2.4, damage: 6, shape: ProjStyle.Orb, element: Element.Ice };
  assert.ok(cast(s, m, sp));
  run(s, 80);
  assert.ok(hpOf(s) < s.ents.maxhp[s.players[0].ent] && s.players[0].slowT > 0, 'it hit and chilled');
  const d = arena();
  const m2 = mob(d, 220, 100, MobType.Slinger);
  assert.ok(cast(d, m2, sp));
  d.ents.y[d.players[0].ent] = 160; // the hero stepped aside after the aim was locked
  run(d, 80);
  assert.equal(hpOf(d), d.ents.maxhp[d.players[0].ent], 'dodged');
});

test('a piercing bolt hits each hero once and keeps going; a splash bolt hurts the heroes beside the one it struck', () => {
  const s = arena();
  activatePlayer(s, 1, 118, 100);
  const m = mob(s, 260, 100, MobType.Slinger);
  const sp: Special = { kind: 'bolt', windup: 10, cooldown: 100, minRange: 0, maxRange: 400, count: 1, spread: 0, speed: 3, damage: 5, shape: ProjStyle.Spike, element: Element.Poison, pierce: true };
  const h0 = [hpOf(s, 0), hpOf(s, 1)];
  assert.ok(cast(s, m, sp));
  run(s, 90);
  assert.ok(hpOf(s, 0) < h0[0] && hpOf(s, 1) < h0[1], 'both were hit');
  const t = arena();
  activatePlayer(t, 1, 125, 100);
  const m2 = mob(t, 260, 100, MobType.Slinger);
  const sp2: Special = { kind: 'bolt', windup: 10, cooldown: 100, minRange: 0, maxRange: 400, count: 1, spread: 0, speed: 3, damage: 5, shape: ProjStyle.Orb, element: Element.Fire, splash: 40 };
  const g = [hpOf(t, 0), hpOf(t, 1)];
  assert.ok(cast(t, m2, sp2));
  run(t, 90);
  assert.ok(hpOf(t, 0) < g[0] && hpOf(t, 1) < g[1], 'the splash caught the one beside');
});

test('a ring throws its projectiles all round, each made of the element', () => {
  const s = arena();
  const m = mob(s, 170, 100, MobType.Slinger);
  const sp: Special = { kind: 'ring', windup: 10, cooldown: 100, maxRange: 300, count: 10, speed: 1.8, damage: 4, shape: ProjStyle.Mote, element: Element.Lightning };
  assert.ok(cast(s, m, sp));
  let n = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Proj) { n++; assert.equal(s.ents.flags[i] & ELEM_MASK, Element.Lightning); }
  assert.equal(n, 10);
});

test('a cone breath hits a hero inside its arc and range, and nobody outside', () => {
  const sp: Special = { kind: 'cone', windup: 10, cooldown: 100, minRange: 0, maxRange: 200, range: 90, arc: 0.1, damage: 7, element: Element.Fire };
  const inside = arena();
  assert.ok(cast(inside, mob(inside, 150, 100), sp));
  assert.ok(hpOf(inside) < inside.ents.maxhp[inside.players[0].ent] && inside.players[0].burning);
  const far = arena();
  assert.ok(cast(far, mob(far, 160, 100), { ...sp, range: 40 }));
  assert.equal(hpOf(far), far.ents.maxhp[far.players[0].ent], 'out of range');
  const wide = arena();
  const m = mob(wide, 160, 100);
  const dir = wide.players[0];
  assert.ok(startSpecialOf(wide, m, sp, 0, 60, -1, 0));
  wide.ents.y[dir.ent] = 150; // stepped well off the line after the aim was locked
  fireSpecialOf(wide, m, sp, 0);
  assert.equal(hpOf(wide), wide.ents.maxhp[dir.ent], 'outside the arc');
});

test('a totem plants itself, fires at the hero on its interval, crumbles, and a caster keeps only so many', () => {
  const s = arena();
  const m = mob(s, 220, 100, MobType.Slinger);
  const sp: Special = { kind: 'totem', windup: 10, cooldown: 100, minRange: 0, maxRange: 300, range: 200, lifetime: 120, interval: 30, damage: 3, speed: 2, shape: ProjStyle.Orb, cap: 1, element: Element.Shadow };
  assert.ok(cast(s, m, sp));
  const zones = (): number => { let n = 0; for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Zone && s.ents.sub[i] === ZoneKind.Totem) n++; return n; };
  assert.equal(zones(), 1);
  assert.equal(cast(s, m, sp), false, 'the cap holds');
  run(s, 100);
  assert.ok(hpOf(s) < s.ents.maxhp[s.players[0].ent], 'it shot the hero');
  assert.ok(s.players[0].silenceT > 0, 'with shadow');
  run(s, 40);
  assert.equal(zones(), 0, 'it crumbled');
});

test('a melee hit made of an element applies it; an aura pulses it; a death blast and a death pool carry it', () => {
  const s = arena();
  const orc = MOBS[MobType.Orc];
  const saved = { onHit: orc.onHit };
  orc.onHit = { element: Element.Poison, power: 1 };
  const m = mob(s, 108, 100, MobType.Orc);
  s.ents.flags[m] = 1;
  run(s, 140);
  orc.onHit = saved.onHit;
  assert.ok(s.players[0].poisonT > 0 || hpOf(s) < s.ents.maxhp[s.players[0].ent], 'the orc hit the hero');
  const a = arena();
  const g = MOBS[MobType.Goblin];
  g.elemAura = { radius: 40, element: Element.Ice, damage: 1, pulse: 10, power: 1 };
  mob(a, 115, 100, MobType.Goblin);
  a.ents.alive[a.ents.highWater - 1] = 1;
  run(a, 40);
  delete g.elemAura;
  assert.ok(a.players[0].slowT > 0, 'an ice aura chills the hero standing in it');
  const d = arena();
  dropPool(d, 100, 100, Element.Poison, 24, 2, 100, 1);
  run(d, 40);
  assert.ok(d.players[0].poisonT > 0, 'a poison pool poisons');
  elementPulse(d, 0, Element.Earth, 1, 100, 100);
  assert.ok(d.players[0].slowT > 0);
});

test('with every element wired in, a run of mixed elemental monsters replays identically', () => {
  const play = (): number[] => {
    const s = createSim(7);
    for (let t = 0; t < 600; t++) step(s, idle());
    return Array.from(s.ents.x.slice(0, 20));
  };
  assert.deepEqual(play(), play());
});
