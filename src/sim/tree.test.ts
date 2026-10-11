import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainerSpot } from '../data/town';
import { SKILL_INDEX, SKILLS, SLOT_BIG, SLOT_DODGE, SLOT_SWING, variantOf } from '../data/skills';
import { cardFor, cardIcon } from '../data/upgrades';
import { CLASSES } from '../data/classes';
import { MobType } from '../data/mobs';
import { newTreeSave, newTreeSaves, treesFromProfile, nodeIndex, poolFor, TREES } from '../data/trees';
import { UPGRADE_INDEX, UPGRADES } from '../data/upgrades';
import { Btn, createInputFrame } from './input';
import { heroOffer } from './offers';
import { restore, snapshot } from './snapshot';
import { allocEntity, freeEntity, Kind } from './entities';
import { createSim, type GameState } from './state';
import { hurtPlayer, step } from './step';
import { whyNot } from './tree';
import { novaBase, skillDealt } from './skills';

// The warrior's class tree (docs/22-class-trees.md, docs/trees/warrior.md): buying nodes in the town, the pool they open, the skills they sell.

const W = TREES[0];
const id = (n: string): number => nodeIndex(W, n);
function town(renown = 0): GameState { return createSim(31, undefined, { road: { total: 4, renown, trees: newTreeSaves() } }); }
function tick(s: GameState, buttons: number[] = [0, 0, 0, 0], move: [number, number] = [0, 0]): void {
  const f = [0, 1, 2, 3].map(createInputFrame);
  buttons.forEach((b, k) => { f[k].buttons = b; });
  f[0].moveX = move[0]; f[0].moveY = move[1];
  step(s, f);
}
const press = (s: GameState, b: number, move: [number, number] = [0, 0]): void => { tick(s, [b, 0, 0, 0], move); tick(s); };
function openAt(s: GameState): void {
  const e = s.players[0].ent, t = trainerSpot();
  s.ents.x[e] = s.ents.px[e] = t.x; s.ents.y[e] = s.ents.py[e] = t.y;
  press(s, Btn.Interact);
}

test('the tree has the template shape: 18 branch nodes and 3 bridges, every requirement a real node, every grant a real boon', () => {
  assert.equal(W.nodes.length, 21);
  for (const n of W.nodes) {
    for (const r of n.requires) assert.ok(id(r) >= 0, `${n.id} needs ${r}`);
    for (const g of n.grants ?? []) assert.ok(UPGRADE_INDEX[g] !== undefined, `${n.id} grants ${g}`);
  }
  assert.deepEqual(W.nodes.filter((n) => n.skill).map((n) => n.skill).sort(), [1, 2, 3, 4, 5, 6], 'two skills per branch');
  for (const b of [0, 1, 2]) {
    const slots = W.nodes.filter((n) => n.branch === b && n.skill).map((n) => SKILL_INDEX[n.skill!].slot);
    assert.equal(new Set(slots).size, 2, `branch ${b}: its two skills fill different slots`);
  }
  for (let slot = 0; slot < 4; slot++) assert.ok(SKILLS.some((k) => k.slot === slot), `slot ${slot} has a replacement`);
  assert.ok(W.base.length >= 12, 'a fresh pool is wide enough for the first levels');
});

test('a fresh warrior is dealt only from the base pool; owning a node opens its boons, in an active branch only', () => {
  const save = createSim(31, undefined, { road: { total: 4 } }).road!.trees[0];
  let pool = poolFor(0, save)!;
  assert.equal(pool[UPGRADE_INDEX.heavy], 1);
  assert.equal(pool[UPGRADE_INDEX.recoil], 0, 'Iron Recoil is not open yet');
  save.owned[id('w-a1')] = 1;
  pool = poolFor(0, save)!;
  assert.equal(pool[UPGRADE_INDEX.recoil], 1);
  save.focus = [1, 2]; // Guardian off
  assert.equal(poolFor(0, save)![UPGRADE_INDEX.recoil], 0, 'an inactive branch feeds nothing');
  assert.equal(poolFor(6, save), undefined, 'a class with no tree keeps everything open');
  assert.equal(heroOffer(createSim(31, undefined, { road: { total: 4 } }), 0).length, 3, 'a road made without a tree deals from everything');
});

test('building is refused for what is coming, what needs another node, and what is too dear', () => {
  const s = town(20);
  assert.equal(whyNot(s, 0, id('w-a6')), 'COMING');
  assert.match(whyNot(s, 0, id('w-a3')), /^NEEDS IRON RECOIL/);
  assert.equal(whyNot(s, 0, id('w-a1')), '');
  s.road!.renown = 5;
  assert.match(whyNot(s, 0, id('w-a1')), /RENOWN/);
});

test('the trainer opens the tree; the stick steps the cursor; trade builds; the hero is frozen while it is open', () => {
  const s = town(100);
  openAt(s);
  assert.ok(s.players[0].treeOpen);
  const x = s.ents.x[s.players[0].ent];
  tick(s, [0, 0, 0, 0], [127, 0]); // the stick: right (one step), and the hero does not walk
  tick(s);
  assert.equal(s.players[0].cursor, 1);
  assert.equal(s.ents.x[s.players[0].ent], x, 'frozen');
  press(s, Btn.Interact); // column 1, row 0: Bloodlust
  assert.ok(s.road!.trees[0].owned[id('w-b1')]);
  assert.equal(s.road!.renown, 100 - 15);
  press(s, Btn.Dodge);
  assert.equal(s.players[0].treeOpen, false, 'dodge closes it');
});

test('buying a skill equips it; trade again puts the quake back; the warrior\'s ability-1 cost follows', () => {
  const s = town(500);
  const r = s.road!;
  for (const n of ['w-a1', 'w-a3']) { r.trees[0].owned[id(n)] = 1; }
  openAt(s);
  s.players[0].cursor = 2 * 3; // column 0, row 2: Taunting Roar (owned, not yet equipped)
  press(s, Btn.Interact);
  assert.equal(r.trees[0].loadout[2], 1);
  assert.equal(s.players[0].loadout[2], 1);
  assert.equal(novaBase(s.players[0], { quake: {}, novaCost: 50 } as never), 50);
  press(s, Btn.Interact);
  assert.equal(r.trees[0].loadout[2], 0, 'put the quake back');
});

test('the equipped skill thins the pool: Split Earth and the lane card are left out; the offer never leaves the pool', () => {
  const s = town(0);
  s.road!.trees[0].loadout[2] = 2;
  const pool = poolFor(0, s.road!.trees[0])!;
  assert.equal(pool[UPGRADE_INDEX.rift], 0);
  assert.equal(pool[UPGRADE_INDEX.ncount], 0);
  for (let level = 1; level < 12; level++) {
    s.players[0].level = level; s.players[0].pending = 1;
    for (const up of heroOffer(s, 0)) assert.ok(pool[up], `${UPGRADES[up].id} is in the pool`);
  }
});

test('Taunting Roar turns foes on the roarer; Rage burns fury and ends; the Standard heals nothing but blesses those near it; all of it saves', () => {
  const s = town(0);
  const p = s.players[0], e = s.ents;
  s.road!.trees[0].loadout[2] = 1;
  p.loadout[2] = 1; p.fury = 100;
  tick(s, [Btn.Ability1, 0, 0, 0]);
  assert.ok(p.roarT > 0 && p.roarR > 0, 'the Roar is up');
  assert.ok(p.fury < 100, 'and cost fury');
  const back = restore(snapshot(s));
  assert.equal(back.players[0].roarT, p.roarT);
  // Rage
  p.loadout[2] = 2; p.fury = 100; p.roarT = 0; p.cdAbility1 = 0;
  tick(s); tick(s, [Btn.Ability1, 0, 0, 0]);
  assert.ok(p.rageOn, 'Rage is on');
  const f0 = p.fury;
  for (let t = 0; t < 10; t++) tick(s);
  assert.ok(p.fury < f0, 'and burns fury');
  p.cdAbility1 = 0;
  tick(s); tick(s, [Btn.Ability1, 0, 0, 0]);
  assert.equal(p.rageOn, false, 'the button ends it');
  // the Standard
  p.loadout[2] = 3; p.fury = 100; p.cdAbility1 = 0;
  tick(s); tick(s, [Btn.Ability1, 0, 0, 0]);
  assert.ok(p.stdT > 0);
  assert.equal(p.stdX, e.x[p.ent]);
});

test('Hard Knocks: each hit taken makes the warrior\'s hits 15% stronger for a while, up to three, and only while the node is working', () => {
  const s = town(0);
  const p = s.players[0];
  hurtPlayer(s, 0, 1); p.invuln = 0;
  assert.equal(p.knockN, 0, 'not owned: nothing');
  s.road!.trees[0].owned[id('w-a2')] = 1;
  for (let k = 0; k < 4; k++) { hurtPlayer(s, 0, 1); p.invuln = 0; }
  assert.equal(p.knockN, 3);
  assert.ok(Math.abs(skillDealt(s, 0) - 1.45) < 1e-9);
  for (let t = 0; t < 200; t++) tick(s);
  assert.equal(p.knockN, 0, 'it fades');
  s.road!.trees[0].focus = [1, 2]; // Guardian off
  hurtPlayer(s, 0, 1);
  assert.equal(p.knockN, 0, 'an inactive branch does nothing');
});

test('each slot\'s skill leaves out the track cards it does not use, and the card reads in its own words', () => {
  const save = newTreeSave();
  let pool = poolFor(0, save)!;
  assert.equal(pool[UPGRADE_INDEX.scount], 1);
  save.loadout[SLOT_BIG] = 5; // Whirlwind has no split
  pool = poolFor(0, save)!;
  assert.equal(pool[UPGRADE_INDEX.scount], 0);
  assert.equal(pool[UPGRADE_INDEX.ssize], 1);
  save.loadout[SLOT_SWING] = 6; // the Pike widens its arc
  assert.equal(poolFor(0, save)![UPGRADE_INDEX.bcount], 1);
  assert.equal(cardFor(UPGRADES[UPGRADE_INDEX.bsize], 0, save.loadout).name, 'PIKE');
  assert.deepEqual(cardFor(UPGRADES[UPGRADE_INDEX.ssize], 0, save.loadout).text, ['REACH +12%', 'COST +12%']);
  assert.equal(cardFor(UPGRADES[UPGRADE_INDEX.dsize], 0, save.loadout).name, 'CHARGE', 'an unreplaced slot keeps the class\'s own card');
  assert.equal(cardIcon(UPGRADES[UPGRADE_INDEX.bsize], save.loadout), 'skill-pike', 'the card wears the skill\'s picture');
  assert.equal(cardIcon(UPGRADES[UPGRADE_INDEX.dsize], save.loadout), 'boon-dsize', 'an unreplaced slot keeps the boon\'s own');
  assert.equal(cardIcon(UPGRADES[UPGRADE_INDEX.heavy], save.loadout), 'boon-heavy');
});

test('a replacement skill is the class with fields replaced: the Pike reaches farther down a narrower line', () => {
  const base = CLASSES[0];
  const pike = variantOf(base, [6, 0, 0, 0]);
  assert.ok(pike.combo[0].range > base.combo[0].range);
  assert.ok(pike.combo[0].dot > base.combo[0].dot, 'a narrower arc');
  assert.equal(variantOf(base, [0, 0, 2, 0]), base, 'the nova slot changes no field');
  assert.equal(variantOf(base, [6, 0, 0, 0]), pike, 'memoised');
});

function arena(): GameState {
  const s = createSim(4, undefined);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const pe = s.players[0].ent;
  s.ents.x[pe] = s.ents.px[pe] = 100; s.ents.y[pe] = s.ents.py[pe] = 100;
  s.camX = s.prevCamX = 0;
  return s;
}
function goblin(s: GameState, x: number, y: number): number {
  const m = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, y, 1000);
  s.ents.flags[m] = 1; s.ents.maxhp[m] = 1000;
  return m;
}
const hpOf = (s: GameState, m: number): number => s.ents.hp[m];

test('Pike: the thrust reaches a foe the sword cannot', () => {
  const s = arena();
  const far = goblin(s, 100 + 66, 100), near = goblin(s, 100 - 10, 100);
  void near;
  s.players[0].faceX = 1; s.players[0].faceY = 0;
  s.players[0].loadout[SLOT_SWING] = 0;
  tick(s, [Btn.Attack, 0, 0, 0]);
  const sword = hpOf(s, far);
  const t = arena();
  const far2 = goblin(t, 100 + 66, 100);
  t.players[0].faceX = 1; t.players[0].faceY = 0;
  t.players[0].loadout[SLOT_SWING] = 6;
  tick(t, [Btn.Attack, 0, 0, 0]);
  assert.equal(sword, 1000, 'the sword (reach 38) misses a foe 66 away');
  assert.ok(hpOf(t, far2) < 1000, 'the pike (reach 74) hits it');
});

test('Whirlwind: the big swing becomes a spin that hits all round for a while, drains stamina and slows the hero', () => {
  const s = arena();
  const p = s.players[0];
  p.loadout[SLOT_BIG] = 5;
  const behind = goblin(s, 100 - 30, 100), front = goblin(s, 100 + 30, 100);
  tick(s, [Btn.Ability2, 0, 0, 0]);
  assert.ok(p.spinT > 0, 'it is spinning');
  const st = p.stamina;
  for (let t = 0; t < 30; t++) tick(s);
  assert.ok(hpOf(s, behind) < 1000 && hpOf(s, front) < 1000, 'both sides are hit');
  assert.ok(p.stamina < st || p.staminaDelay > 0, 'it costs stamina');
  for (let t = 0; t < 40; t++) tick(s);
  assert.equal(p.spinT, 0, 'and it ends');
  const hurtAfter = hpOf(s, front);
  for (let t = 0; t < 20; t++) tick(s);
  assert.equal(hpOf(s, front), hurtAfter, 'hits stop with the spin');
});

test('Shield Rush: a short rush that slams and stuns what it caught', () => {
  const s = arena();
  const p = s.players[0];
  p.loadout[SLOT_DODGE] = 4;
  p.faceX = 1; p.faceY = 0;
  const m = goblin(s, 100 + 30, 100);
  tick(s, [Btn.Dodge, 0, 0, 0], [127, 0]);
  for (let t = 0; t < 20; t++) tick(s, [0, 0, 0, 0]);
  assert.ok(hpOf(s, m) < 1000, 'the foe in the way was hit');
  assert.ok(s.ents.x[p.ent] - 100 < 80, 'a short rush, not a long charge');
});

test('a profile from before the slots (one skill) still loads: it was the nova slot\'s', () => {
  const t = treesFromProfile(undefined, { owned: ['w-a1', 'w-a3'], focus: [0, 1], skill: 1 })[0];
  assert.deepEqual(t.loadout, [0, 0, 1, 0]);
  assert.deepEqual(treesFromProfile({ warrior: { owned: [], focus: [0, 1], loadout: [6, 0, 0, 4] } })[0].loadout, [6, 0, 0, 4]);
  assert.deepEqual(treesFromProfile({ warrior: { owned: [], focus: [0, 1], loadout: [4, 0, 0, 6] } })[0].loadout, [0, 0, 0, 0], 'a skill in the wrong slot is dropped');
});
