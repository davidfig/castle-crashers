import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { MobType } from '../data/mobs';
import { SKILL_INDEX, SLOT_BIG, SLOT_DODGE, SLOT_NOVA, SLOT_SWING } from '../data/skills';
import { DRUM, FROST, GRAVITY, SPIRIT, WARD } from '../data/totems';
import { nodeIndex, TREES } from '../data/trees';
import { UPGRADE_INDEX } from '../data/upgrades';
import { bank } from './totems';
import { allocEntity, freeEntity, Kind } from './entities';
import { Btn, createInputFrame } from './input';
import { skillDealt } from './skills';
import { createSim, type GameState } from './state';
import { hurtPlayer, step } from './step';

// The Rogue, Archer and Shaman trees and their replacement skills (docs/trees/rogue.md, archer.md, shaman.md).

const CLASS = { rogue: 3, archer: 4, shaman: 5 };

for (const [name, id] of Object.entries(CLASS)) {
  test(`the ${name} tree has the template shape and a replacement for every slot; each branch sells two skills`, () => {
    const T = TREES[id];
    assert.equal(T.nodes.length, 21);
    for (const n of T.nodes) {
      for (const r of n.requires) assert.ok(nodeIndex(T, r) >= 0, `${n.id} needs ${r}`);
      for (const g of n.grants ?? []) assert.ok(UPGRADE_INDEX[g] !== undefined, `${n.id} grants ${g}`);
      if (n.skill) assert.equal(SKILL_INDEX[n.skill].classId, id, `${n.id} sells a ${name} skill`);
    }
    for (const b of [0, 1, 2]) assert.equal(T.nodes.filter((n) => n.branch === b && n.skill).length, 2, `branch ${b} sells two`);
    assert.deepEqual([...new Set(T.nodes.filter((n) => n.skill).map((n) => SKILL_INDEX[n.skill!].slot))].sort(), [SLOT_SWING, SLOT_BIG, SLOT_NOVA, SLOT_DODGE]);
    const open = (nid: string): boolean => { const n = T.nodes[nodeIndex(T, nid)]; return n.ready && n.requires.every(open); };
    for (const n of T.nodes) if (n.skill) assert.ok(open(n.id), `${n.id} can be built`);
  });
}

function tick(s: GameState, buttons = 0, move: [number, number] = [0, 0]): void {
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].buttons = buttons; f[0].moveX = move[0]; f[0].moveY = move[1];
  step(s, f);
}
function arena(classId: number): GameState {
  const s = createSim(4, undefined);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const p = s.players[0];
  p.classId = classId;
  s.ents.x[p.ent] = s.ents.px[p.ent] = 100; s.ents.y[p.ent] = s.ents.py[p.ent] = 100;
  s.ents.hp[p.ent] = s.ents.maxhp[p.ent] = CLASSES[classId].hp;
  p.faceX = 1; p.faceY = 0;
  s.camX = s.prevCamX = 0;
  return s;
}
function goblin(s: GameState, x: number, y = 100, still = true, face = -1): number {
  const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, y, 1000);
  s.ents.flags[m] = 1; s.ents.maxhp[m] = 1000; s.ents.face[m] = face;
  if (still) s.ents.stun[m] = 255;
  return m;
}
const hurt = (s: GameState, m: number): number => 1000 - s.ents.hp[m];
const count = (s: GameState, kind: number): number => { let n = 0; for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === kind) n++; return n; };
const lose = (s: GameState, slot: number, dmg: number): number => { const e = s.ents, p = s.players[slot]; p.invuln = 0; const before = e.hp[p.ent]; hurtPlayer(s, slot, dmg); return before - e.hp[p.ent]; };
const bare = (s: GameState): void => { const p = s.players[0]; p.vanishT = 0; p.revealT = 9999; }; // a rogue seen, so no ambush multiplies what is being measured

// ---- rogue ----
test('Rapier: the first thrust after a dodge is a riposte, twice as hard', () => {
  const run = (riposte: boolean): number => {
    const s = arena(CLASS.rogue); bare(s);
    s.players[0].loadout[SLOT_SWING] = 19;
    const m = goblin(s, 130);
    if (riposte) s.players[0].riposteT = 60;
    tick(s, Btn.Attack);
    return hurt(s, m);
  };
  assert.ok(run(false) > 0);
  assert.ok(Math.abs(run(true) / run(false) - 2) < 0.01, 'twice as hard');
});

test('Rapier: a dodge arms the riposte', () => {
  const s = arena(CLASS.rogue);
  s.players[0].loadout[SLOT_SWING] = 19;
  tick(s, Btn.Dodge, [127, 0]);
  assert.ok(s.players[0].riposteT > 0);
});

test('Fan of Knives: the big swing throws five knives in a fan', () => {
  const s = arena(CLASS.rogue);
  s.players[0].loadout[SLOT_BIG] = 20;
  goblin(s, 300);
  tick(s, Btn.Ability2);
  assert.equal(count(s, Kind.Proj), 5);
});

test('Smoke Bomb: for its few seconds the rogue stays hidden even when he strikes', () => {
  const s = arena(CLASS.rogue), p = s.players[0];
  p.loadout[SLOT_NOVA] = 21; p.fury = 60;
  const m = goblin(s, 130, 100, false);
  tick(s, Btn.Ability1);
  assert.ok(p.smokeT > 100 && p.vanishT > 0, 'hidden in the smoke');
  assert.ok(s.ents.stun[m] > 20, 'a foe in the cloud is blinded');
  for (let t = 0; t < 6; t++) tick(s, Btn.Attack);
  assert.ok(p.vanishT > 0, 'striking does not give him away');
});

test('Shadow Step: the dodge blinks behind the nearest foe and leaves the rogue hidden', () => {
  const s = arena(CLASS.rogue), p = s.players[0];
  p.loadout[SLOT_DODGE] = 22;
  const m = goblin(s, 190, 100, true, -1); // facing the rogue
  tick(s, Btn.Dodge, [127, 0]);
  assert.ok(Math.abs(s.ents.x[p.ent] - (190 + 20)) < 3, `behind it (${s.ents.x[p.ent]})`);
  assert.ok(p.vanishT > 0, 'hidden');
  void m;
});

test('Throwing Knife: the attack is a thrown knife, not a stab', () => {
  const s = arena(CLASS.rogue); bare(s);
  s.players[0].loadout[SLOT_SWING] = 23;
  const m = goblin(s, 130);
  tick(s, Btn.Attack);
  assert.equal(count(s, Kind.Proj), 1, 'a knife is in the air');
  assert.equal(hurt(s, m), 0, 'and nothing was stabbed');
});

test('Caltrops: the roll leaves a patch that chips and holds the foes in it', () => {
  const s = arena(CLASS.rogue), p = s.players[0];
  p.loadout[SLOT_DODGE] = 24;
  const m = goblin(s, 100, 100, false); // standing where the roll began
  s.ents.stun[m] = 0;
  tick(s, Btn.Dodge, [127, 0]);
  assert.ok(p.patchT > 0 && p.patchLook === 0);
  for (let t = 0; t < 40; t++) tick(s);
  assert.ok(hurt(s, m) > 0 || s.ents.stun[m] > 0, 'the foe in the caltrops is caught');
});

// ---- archer ----
test('Charged Shot: held, it draws; let go, it pierces a line of foes, and a longer draw hits harder', () => {
  const shot = (hold: number): { near: number; far: number } => {
    const s = arena(CLASS.archer);
    s.players[0].loadout[SLOT_SWING] = 25;
    const a = goblin(s, 160), b = goblin(s, 230);
    for (let t = 0; t < hold; t++) tick(s, Btn.Attack);
    assert.ok(s.players[0].drawT > 0, 'drawing');
    tick(s, 0);
    return { near: hurt(s, a), far: hurt(s, b) };
  };
  const quick = shot(10), full = shot(40);
  assert.ok(quick.near > 0 && quick.far > 0, 'it pierces both');
  assert.ok(full.near > quick.near * 1.4, `a full draw hits harder (${full.near} against ${quick.near})`);
});

test('Piercing Bolt: one heavy bolt through every foe on a long line', () => {
  const s = arena(CLASS.archer);
  s.players[0].loadout[SLOT_BIG] = 26;
  const a = goblin(s, 160), b = goblin(s, 330), off = goblin(s, 250, 160);
  tick(s, Btn.Ability2);
  assert.ok(hurt(s, a) > 20 && hurt(s, b) > 20, 'through both');
  assert.equal(hurt(s, off), 0);
});

test('Spike Field: the rain becomes a patch of spikes ahead that holds the foes in it', () => {
  const s = arena(CLASS.archer), p = s.players[0];
  p.loadout[SLOT_NOVA] = 27; p.fury = 60;
  const m = goblin(s, 170, 100, false);
  s.ents.stun[m] = 0;
  tick(s, Btn.Ability1);
  assert.ok(p.patchT > 400 && p.patchLook === 1, 'spikes are down');
  for (let t = 0; t < 40; t++) tick(s);
  assert.ok(hurt(s, m) > 0 || s.ents.stun[m] > 0, 'the foe in them is caught');
});

test('Snare Trap: the roll leaves a trap; the first foe to touch it springs it and is held', () => {
  const s = arena(CLASS.archer), p = s.players[0];
  p.loadout[SLOT_DODGE] = 28;
  tick(s, Btn.Dodge, [127, 0]);
  assert.equal(p.patchLook, 2);
  const m = goblin(s, p.patchX + 5, p.patchY, false);
  s.ents.stun[m] = 0;
  for (let t = 0; t < 12; t++) tick(s);
  assert.ok(s.ents.stun[m] > 60, `held (${s.ents.stun[m]})`);
  assert.equal(p.patchT, 0, 'and the trap is spent');
});

test('Fire Arrow: a flaming arrow in the air; Backflip Shot: a leap back that looses three arrows', () => {
  const s = arena(CLASS.archer);
  s.players[0].loadout[SLOT_SWING] = 29;
  tick(s, Btn.Attack);
  assert.equal(count(s, Kind.Proj), 1);
  const t = arena(CLASS.archer);
  t.players[0].loadout[SLOT_DODGE] = 30;
  const x0 = t.ents.x[t.players[0].ent];
  tick(t, Btn.Dodge, [127, 0]); // the stick says right; the leap goes back
  for (let k = 0; k < 8; k++) tick(t);
  assert.equal(count(t, Kind.Proj) >= 3, true, 'three arrows loosed');
  assert.ok(t.ents.x[t.players[0].ent] < x0, 'and the archer went backward');
});

// ---- shaman ----
test('Shaman: a tree totem replaces the one on its button, in the bank and when planted', () => {
  const s = arena(CLASS.shaman), p = s.players[0];
  p.loadout[SLOT_SWING] = 31; // Ward replaces the Stone on Attack
  p.loadout[SLOT_NOVA] = 33; // Frost replaces the Ember on Ability 1
  p.loadout[SLOT_BIG] = 32; // Gravity replaces the Cannon on Ability 2
  const plain = bank(CLASS.shaman, false, p.loadout) as readonly { totem: number }[];
  assert.deepEqual(plain.map((a) => a.totem), [WARD, FROST, GRAVITY]);
  assert.deepEqual((bank(CLASS.shaman, false) as readonly { totem: number }[]).map((a) => a.totem), [1, 0, 2], 'the starting bank is untouched');
  tick(s, Btn.Attack);
  let sub = -1;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Totem) sub = s.ents.sub[i];
  assert.equal(sub, WARD, 'Attack planted a Ward totem');
});

test('Ward Totem shields the heroes in its ring; War Drum makes them hit harder', () => {
  const s = arena(CLASS.shaman), p = s.players[0];
  const without = lose(arena(CLASS.shaman), 0, 10);
  p.loadout[SLOT_SWING] = 31;
  tick(s, Btn.Attack);
  assert.ok(lose(s, 0, 10) < without, 'it takes less inside the ward');
  const d = arena(CLASS.shaman);
  d.players[0].loadout[SLOT_NOVA] = 36;
  const before = skillDealt(d, 0);
  tick(d, Btn.Ability1);
  assert.ok(skillDealt(d, 0) > before * 1.15, 'a drum beside it lifts what it deals');
});

test('Frost Totem freezes the mobs in its ring and Gravity Well hauls them in', () => {
  const s = arena(CLASS.shaman), p = s.players[0];
  p.loadout[SLOT_NOVA] = 33;
  const m = goblin(s, 140, 100, false);
  s.ents.stun[m] = 0;
  tick(s, Btn.Ability1);
  for (let t = 0; t < 40; t++) tick(s);
  assert.ok(s.ents.stun[m] > 0, 'frozen');
  const g = arena(CLASS.shaman);
  g.players[0].loadout[SLOT_BIG] = 32;
  const far = goblin(g, 200, 100, false);
  g.ents.stun[far] = 0;
  const d0 = Math.abs(g.ents.x[far] - 100);
  tick(g, Btn.Ability2);
  for (let t = 0; t < 40; t++) tick(g);
  assert.ok(Math.abs(g.ents.x[far] - 100) < d0, 'hauled toward the well');
});

test('Spirit Step: the roll sets a Spirit totem down where it began', () => {
  const s = arena(CLASS.shaman);
  s.players[0].loadout[SLOT_DODGE] = 35;
  tick(s, Btn.Dodge, [127, 0]);
  let sub = -1;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Totem) sub = s.ents.sub[i];
  assert.equal(sub, SPIRIT);
  void DRUM;
});
