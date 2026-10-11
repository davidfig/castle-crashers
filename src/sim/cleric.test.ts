import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { MobType } from '../data/mobs';
import { SKILL_INDEX, SLOT_BIG, SLOT_DODGE, SLOT_NOVA, SLOT_SWING } from '../data/skills';
import { BEACON } from '../data/totems';
import { newTreeSaves, nodeIndex, TREES } from '../data/trees';
import { UPGRADE_INDEX } from '../data/upgrades';
import { allocEntity, freeEntity, Kind } from './entities';
import { Btn, createInputFrame } from './input';
import { activatePlayer, createSim, resetHero, type GameState } from './state';
import { hurtPlayer, step } from './step';
import { buyNode, whyNot } from './tree';

// The cleric's tree and replacement skills (docs/trees/cleric.md): Healing Bolt, Sanctuary Ring (Mender), Mace, Judgment Beam (Zealot), Beacon, Aegis Roll (Sentinel).

const C = TREES[2];
const cid = (n: string): number => nodeIndex(C, n);

function tick(s: GameState, buttons = 0, move: [number, number] = [0, 0]): void {
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].buttons = buttons; f[0].moveX = move[0]; f[0].moveY = move[1];
  step(s, f);
}
/** A quiet field, the cleric (slot 0) at (100, 100) facing right, and an ally (slot 1) where `ally` says, hurt to `allyHp`. */
function arena(ally?: { x: number; y: number; hp: number }): GameState {
  const s = createSim(4, undefined);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const p = s.players[0];
  p.classId = 2;
  s.ents.x[p.ent] = s.ents.px[p.ent] = 100; s.ents.y[p.ent] = s.ents.py[p.ent] = 100;
  s.ents.hp[p.ent] = s.ents.maxhp[p.ent] = CLASSES[2].hp;
  p.faceX = 1; p.faceY = 0;
  s.camX = s.prevCamX = 0;
  if (ally) {
    activatePlayer(s, 1, ally.x, ally.y);
    s.players[1].classId = 0;
    s.ents.hp[s.players[1].ent] = ally.hp;
    s.ents.maxhp[s.players[1].ent] = CLASSES[0].hp;
  }
  return s;
}
function goblin(s: GameState, x: number, y = 100, still = true): number {
  const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, y, 1000);
  s.ents.flags[m] = 1; s.ents.maxhp[m] = 1000;
  if (still) s.ents.stun[m] = 255;
  return m;
}
const hurt = (s: GameState, m: number): number => 1000 - s.ents.hp[m];
const lose = (s: GameState, slot: number, dmg: number): number => { const e = s.ents, p = s.players[slot]; p.invuln = 0; const before = e.hp[p.ent]; hurtPlayer(s, slot, dmg); return before - e.hp[p.ent]; };

test('the cleric tree has the template shape and a replacement for every slot; each branch sells two skills in different slots', () => {
  assert.equal(C.nodes.length, 21);
  for (const n of C.nodes) {
    for (const r of n.requires) assert.ok(cid(r) >= 0, `${n.id} needs ${r}`);
    for (const g of n.grants ?? []) assert.ok(UPGRADE_INDEX[g] !== undefined, `${n.id} grants ${g}`);
    if (n.skill) assert.equal(SKILL_INDEX[n.skill].classId, 2, `${n.id} sells a cleric skill`);
  }
  for (const b of [0, 1, 2]) assert.equal(new Set(C.nodes.filter((n) => n.branch === b && n.skill).map((n) => SKILL_INDEX[n.skill!].slot)).size, 2, `branch ${b}`);
  assert.deepEqual([...new Set(C.nodes.filter((n) => n.skill).map((n) => SKILL_INDEX[n.skill!].slot))].sort(), [SLOT_SWING, SLOT_BIG, SLOT_NOVA, SLOT_DODGE]);
  const open = (id: string): boolean => { const n = C.nodes[cid(id)]; return n.ready && n.requires.every(open); };
  for (const n of C.nodes) if (n.skill) assert.ok(open(n.id), `${n.id} can be built`);
});

test('buying a cleric skill equips it for the cleric, and only in the cleric\'s own save', () => {
  const s = createSim(31, undefined, { road: { total: 4, renown: 500, trees: newTreeSaves() } });
  resetHero(s, 0, 2);
  assert.match(whyNot(s, 2, cid('cl-a3')), /^NEEDS/);
  assert.ok(buyNode(s, 0, cid('cl-a1')));
  assert.ok(buyNode(s, 0, cid('cl-a3')));
  assert.equal(s.players[0].loadout[SLOT_SWING], 13, 'Healing Bolt is in the swing slot');
  assert.equal(s.road!.trees[0].owned.some((v) => v), false);
  assert.equal(s.road!.trees[1].owned.some((v) => v), false);
});

test('Healing Bolt: mends the most wounded ally in front; with nobody hurt it smites the nearest foe; with no target it does nothing', () => {
  const s = arena({ x: 150, y: 100, hp: 20 });
  s.players[0].loadout[SLOT_SWING] = 13;
  const foe = goblin(s, 160);
  tick(s, Btn.Attack);
  assert.ok(s.ents.hp[s.players[1].ent] > 20, 'the ally is mended');
  assert.equal(hurt(s, foe), 0, 'and the foe is left alone while an ally needs it');
  const t = arena();
  t.players[0].loadout[SLOT_SWING] = 13;
  const f2 = goblin(t, 160);
  tick(t, Btn.Attack);
  assert.ok(hurt(t, f2) > 0, 'with nobody hurt, the foe is smitten');
  const u = arena();
  u.players[0].loadout[SLOT_SWING] = 13;
  const mana = u.players[0].stamina;
  tick(u, Btn.Attack);
  assert.ok(u.players[0].stamina >= mana, 'no target, nothing spent');
});

test('Mace: the aura is gone and the attack is a melee swing that hits a foe in front', () => {
  const s = arena(), p = s.players[0];
  p.loadout[SLOT_SWING] = 15;
  const front = goblin(s, 130), behind = goblin(s, 70);
  tick(s, Btn.Attack);
  assert.equal(p.auraOn, false, 'no aura');
  assert.ok(hurt(s, front) > 0, 'hit in front');
  assert.equal(hurt(s, behind), 0, 'not behind');
});

test('Judgment Beam: scorches the foes on the line and mends the hero on it, not what is beside it', () => {
  const s = arena({ x: 150, y: 100, hp: 30 });
  s.players[0].loadout[SLOT_BIG] = 16;
  const on = goblin(s, 190, 101), beside = goblin(s, 190, 160);
  tick(s, Btn.Ability2);
  assert.ok(hurt(s, on) > 10, 'on the line');
  assert.equal(hurt(s, beside), 0);
  assert.ok(s.ents.hp[s.players[1].ent] > 30, 'the ally on the line is mended');
});

test('Sanctuary Ring: a ring that mends the heroes inside it and shoves foes out of it', () => {
  const s = arena({ x: 120, y: 100, hp: 30 });
  const p = s.players[0];
  p.loadout[SLOT_NOVA] = 14;
  p.fury = 60;
  const foe = goblin(s, 115, 100, false);
  s.ents.stun[foe] = 0;
  const d0 = Math.abs(s.ents.x[foe] - 100);
  tick(s, Btn.Ability1);
  assert.ok(p.sanctT > 400, 'the ring stands');
  for (let t = 0; t < 40; t++) tick(s);
  assert.ok(s.ents.hp[s.players[1].ent] > 30, 'the ally inside is mended');
  assert.ok(Math.hypot(s.ents.x[foe] - p.sanctX, s.ents.y[foe] - p.sanctY) > d0, 'the foe is pushed out');
});

test('Beacon: sets down a lamp that holds foes and wards the heroes beside it', () => {
  const s = arena();
  const p = s.players[0];
  p.loadout[SLOT_NOVA] = 17;
  p.fury = 60;
  const bare = lose(arena(), 0, 10);
  tick(s, Btn.Ability1);
  let lamp = -1;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Totem && s.ents.alive[i] && s.ents.sub[i] === BEACON) lamp = i;
  assert.ok(lamp >= 0, 'a beacon stands');
  assert.equal(s.ents.by[lamp], 0);
  const warded = lose(s, 0, 10);
  assert.ok(warded < bare, `the cleric beside it takes less (${warded} against ${bare})`);
});

test('Aegis Roll: a roll that shields the heroes beside the cleric for a while (and only those)', () => {
  const s = arena({ x: 130, y: 100, hp: 100 });
  activatePlayer(s, 2, 420, 100);
  s.players[0].loadout[SLOT_DODGE] = 18;
  const bare = lose(arena({ x: 130, y: 100, hp: 100 }), 1, 10);
  tick(s, Btn.Dodge, [127, 0]);
  assert.ok(s.players[0].aegisT > 0 && s.players[1].aegisT > 0, 'the cleric and the ally beside them are shielded');
  assert.equal(s.players[2].aegisT, 0, 'the one far away is not');
  const shielded = lose(s, 1, 10);
  assert.ok(shielded < bare, `shielded (${shielded}) takes less than bare (${bare})`);
});
