import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { MobType } from '../data/mobs';
import { SKILL_INDEX, SLOT_BIG, SLOT_DODGE, SLOT_NOVA, SLOT_SWING } from '../data/skills';
import { newTreeSaves, nodeIndex, poolFor, TREES } from '../data/trees';
import { UPGRADE_INDEX, UPGRADES } from '../data/upgrades';
import { allocEntity, freeEntity, Kind } from './entities';
import { Btn, createInputFrame } from './input';
import { createSim, resetHero, type GameState } from './state';
import { step } from './step';
import { buyNode, whyNot } from './tree';

// The mage's tree and replacement skills (docs/trees/mage.md): Flamethrower, Meteor (Pyromancer), Frost Nova, Ice Slide (Cryomancer), Chain Bolt, Lightning Strike (Stormcaller).

const M = TREES[1];
const mid = (n: string): number => nodeIndex(M, n);

function tick(s: GameState, buttons = 0, move: [number, number] = [0, 0]): void {
  const f = [0, 1, 2, 3].map(createInputFrame);
  f[0].buttons = buttons; f[0].moveX = move[0]; f[0].moveY = move[1];
  step(s, f);
}
function arena(): GameState {
  const s = createSim(4, undefined);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const p = s.players[0];
  p.classId = 1;
  const pe = p.ent;
  s.ents.x[pe] = s.ents.px[pe] = 100; s.ents.y[pe] = s.ents.py[pe] = 100;
  s.ents.hp[pe] = s.ents.maxhp[pe] = CLASSES[1].hp;
  p.faceX = 1; p.faceY = 0;
  s.camX = s.prevCamX = 0;
  return s;
}
function goblin(s: GameState, x: number, y = 100, still = false): number {
  const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, y, 1000);
  s.ents.flags[m] = 1; s.ents.maxhp[m] = 1000;
  if (still) s.ents.stun[m] = 255;
  return m;
}
const hurt = (s: GameState, m: number): number => 1000 - s.ents.hp[m];

test('the mage tree has the template shape and a replacement for every slot; each branch sells two skills in different slots', () => {
  assert.equal(M.nodes.length, 21);
  for (const n of M.nodes) {
    for (const r of n.requires) assert.ok(mid(r) >= 0, `${n.id} needs ${r}`);
    for (const g of n.grants ?? []) assert.ok(UPGRADE_INDEX[g] !== undefined, `${n.id} grants ${g}`);
    if (n.skill) assert.equal(SKILL_INDEX[n.skill].classId, 1, `${n.id} sells a mage skill`);
  }
  for (const b of [0, 1, 2]) assert.equal(new Set(M.nodes.filter((n) => n.branch === b && n.skill).map((n) => SKILL_INDEX[n.skill!].slot)).size, 2, `branch ${b}`);
  const slots = new Set(M.nodes.filter((n) => n.skill).map((n) => SKILL_INDEX[n.skill!].slot));
  assert.deepEqual([...slots].sort(), [SLOT_SWING, SLOT_BIG, SLOT_NOVA, SLOT_DODGE]);
  // every skill node can be reached: whatever it needs is built, not "coming"
  const reach = new Set<string>();
  const open = (id: string): boolean => { const n = M.nodes[mid(id)]; return n.ready && n.requires.every(open); };
  for (const n of M.nodes) if (n.skill) { assert.ok(open(n.id), `${n.id} can be built`); reach.add(n.id); }
});

test('a fresh mage is dealt from the base pool; the skills it owns thin the track cards it does not use', () => {
  const saves = newTreeSaves();
  let pool = poolFor(1, saves[1])!;
  assert.equal(pool[UPGRADE_INDEX.twin], 0, 'Twin Flame is a node, not base');
  assert.equal(pool[UPGRADE_INDEX.heavy], 1);
  saves[1].loadout[SLOT_BIG] = 8; // Meteor has no split
  pool = poolFor(1, saves[1])!;
  assert.equal(pool[UPGRADE_INDEX.scount], 0);
  assert.equal(pool[UPGRADE_INDEX.ssize], 1);
  assert.equal(UPGRADES[UPGRADE_INDEX.twin].classes!.includes(1), true);
});

test('buying a mage skill equips it for the mage and not for a warrior beside them; the trees are kept apart', () => {
  const s = createSim(31, undefined, { road: { total: 4, renown: 500, trees: newTreeSaves() } });
  resetHero(s, 0, 1);
  const p = s.players[0];
  assert.match(whyNot(s, 1, mid('m-a5')), /^NEEDS/);
  assert.ok(buyNode(s, 0, mid('m-a1')));
  assert.ok(buyNode(s, 0, mid('m-a3')));
  assert.equal(p.loadout[SLOT_SWING], 7, 'Flamethrower is in the swing slot');
  assert.equal(s.road!.trees[0].owned.some((v) => v), false, 'the warrior tree is untouched');
  assert.equal(s.road!.renown, 500 - 15 - 60);
  assert.equal(whyNot(s, 1, mid('m-a2')), '', 'Echo Blast is buildable from the start');
});

test('Flamethrower: held down it burns every foe in a cone in front, not behind or beyond', () => {
  const s = arena(), p = s.players[0];
  p.loadout[SLOT_SWING] = 7;
  const ahead = goblin(s, 130), behind = goblin(s, 70), far = goblin(s, 175);
  const mana = p.stamina;
  for (let t = 0; t < 12; t++) tick(s, Btn.Attack);
  assert.ok(hurt(s, ahead) > 0, 'the foe in the cone burns');
  assert.equal(hurt(s, behind), 0);
  assert.equal(hurt(s, far), 0, 'out of reach');
  assert.ok(p.stamina < mana, 'and it drains mana');
});

test('Chain Bolt: jumps through foes in a chain, weaker each hop, and stops where the gap is too wide', () => {
  const s = arena(), p = s.players[0];
  p.loadout[SLOT_SWING] = 11;
  const a = goblin(s, 140, 100, true), b = goblin(s, 190, 100, true), c = goblin(s, 255, 100, true), d = goblin(s, 400, 100, true);
  tick(s, Btn.Attack);
  assert.ok(hurt(s, a) > hurt(s, b) && hurt(s, b) > hurt(s, c) && hurt(s, c) > 0, 'a chain, weaker each hop');
  assert.equal(hurt(s, d), 0, 'a gap too wide to jump');
  const idle = arena();
  idle.players[0].loadout[SLOT_SWING] = 11;
  const mana = idle.players[0].stamina;
  tick(idle, Btn.Attack);
  assert.equal(idle.players[0].stamina >= mana, true, 'with no foe in front nothing is loosed (and nothing spent)');
});

test('Meteor: marks a spot, and the blast lands there a moment later, not before and not far from it', () => {
  const s = arena(), p = s.players[0];
  p.loadout[SLOT_BIG] = 8;
  const near = goblin(s, 215, 100, true), far = goblin(s, 420, 100, true);
  tick(s, Btn.Ability2);
  assert.ok(p.meteorT > 0, 'a mark is down');
  for (let t = 0; t < 30; t++) tick(s);
  assert.equal(hurt(s, near), 0, 'not yet');
  for (let t = 0; t < 40; t++) tick(s);
  assert.ok(hurt(s, near) > 20, 'it lands on the mark');
  assert.equal(hurt(s, far), 0);
  assert.equal(p.meteorT, 0);
});

test('Lightning Strike: an instant bolt down the aim line hurts and stuns what is on it, not what is beside it', () => {
  const s = arena(), p = s.players[0];
  p.loadout[SLOT_BIG] = 12;
  const on = goblin(s, 170, 101), beside = goblin(s, 170, 245), arced = goblin(s, 175, 150);
  tick(s, Btn.Ability2);
  assert.ok(hurt(s, on) > 10, 'on the line');
  assert.ok(s.ents.stun[on] > 5, 'stunned');
  assert.equal(hurt(s, beside), 0, 'well beside the line, and too far to arc to');
  assert.ok(hurt(s, arced) > 0 && hurt(s, arced) < hurt(s, on), 'the bolt arcs on to a foe near the last, weaker');
});

test('Frost Nova: every foe in the ring is frozen, those outside are not', () => {
  const s = arena(), p = s.players[0];
  p.loadout[SLOT_NOVA] = 9;
  p.fury = 50;
  const inside = goblin(s, 150), outside = goblin(s, 260);
  tick(s, Btn.Ability1);
  assert.ok(s.ents.stun[inside] > 40, `frozen (${s.ents.stun[inside]})`);
  assert.ok(s.ents.stun[outside] < 5);
  assert.ok(p.fury < 50, 'it cost fury');
});

test('Ice Slide: a held slide that freezes the foes it touches', () => {
  const s = arena(), p = s.players[0];
  p.loadout[SLOT_DODGE] = 10;
  const m = goblin(s, 130);
  for (let t = 0; t < 22; t++) tick(s, Btn.Dodge, [127, 0]);
  assert.ok(s.ents.x[p.ent] > 140, 'a long slide');
  assert.ok(s.ents.stun[m] > 10 || hurt(s, m) > 0, 'the foe in the way was caught and frozen');
});
