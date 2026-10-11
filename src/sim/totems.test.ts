import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { MobType } from '../data/mobs';
import { CANNON, EMBER, HERDS, SPIRIT, STONE, STORM, TOTEMS } from '../data/totems';
import { allocEntity, freeEntity, Kind } from './entities';
import { hashState } from './hash';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { step } from './step';
import { runBot } from './bot';

const SHAMAN = CLASSES.findIndex((c) => c.name === 'shaman');
const DEF = CLASSES[SHAMAN].totems!;
const idle = () => [0, 1, 2, 3].map(createInputFrame);
function press(buttons: number): InputFrame[] { const f = idle(); f[0].buttons = buttons; return f; }
/** One tick pressed, then released and waited out. */
function tap(s: GameState, buttons: number, wait = DEF.cooldown + 2): void {
  step(s, press(buttons));
  for (let t = 0; t < wait; t++) step(s, idle());
}
const run = (s: GameState, ticks: number): void => { for (let t = 0; t < ticks; t++) step(s, idle()); };

function arena(seed = 3): GameState {
  const s = createSim(seed);
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
  s.spawnTimer = 1e9; s.flankTimer = 1e9; s.nextClump = s.plan.length;
  const p = s.players[0];
  p.classId = SHAMAN;
  s.ents.x[p.ent] = s.ents.px[p.ent] = 100; s.ents.y[p.ent] = s.ents.py[p.ent] = 100;
  s.ents.hp[p.ent] = s.ents.maxhp[p.ent] = 1e6; // (the horde is gone; nothing hurts them)
  p.stamina = CLASSES[SHAMAN].staminaMax;
  s.camX = s.prevCamX = 0;
  p.faceX = 1; p.faceY = 0;
  return s;
}
const mob = (s: GameState, x: number, y = 100, hp = 1000): number => {
  const g = allocEntity(s.ents, Kind.Mob, MobType.Goblin, x, y, hp);
  s.ents.maxhp[g] = hp; s.ents.flags[g] = 1;
  return g;
};
const totems = (s: GameState, kind?: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Totem && (kind === undefined || s.ents.sub[i] === kind)) out.push(i);
  return out;
};

test('the shaman has no attack of any kind; every action is a totem or a herding move', () => {
  const c = CLASSES[SHAMAN];
  assert.ok(c.totems);
  assert.equal(c.shot, undefined);
  assert.equal(c.dashDamage, 0);
  assert.equal(c.novaDamage, 0);
  for (const a of [...DEF.plain, ...DEF.alt]) assert.ok(a === null || 'totem' in a || 'herd' in a || 'pick' in a || 'cycle' in a);
  assert.deepEqual(DEF.plain.map((a) => a && 'totem' in a ? a.totem : -1), [STONE, EMBER, CANNON]);
});

test('Attack, Ability 1 and Ability 2 each plant their own totem a step ahead', () => {
  const s = arena();
  tap(s, Btn.Attack);
  tap(s, Btn.Ability1);
  tap(s, Btn.Ability2);
  for (const k of [STONE, EMBER, CANNON]) {
    const [t] = totems(s, k);
    assert.ok(t !== undefined, `${TOTEMS[k].name} stands`);
    assert.equal(s.ents.by[t], 0);
    assert.ok(s.ents.x[t] > s.ents.x[s.players[0].ent], 'ahead of the shaman');
  }
  assert.equal(totems(s).length, 3);
});

test('Alt + Attack plants the selected extra; Alt + Ability 1 steps the selection (free, forward, wrapping) and Q steps it back', () => {
  const s = arena();
  const p = s.players[0];
  assert.deepEqual([...DEF.extras], [SPIRIT, STORM]);
  assert.equal(p.pick, 0);
  tap(s, Btn.Alt | Btn.Attack);
  assert.equal(totems(s, SPIRIT).length, 1, 'the first extra');
  tap(s, Btn.Alt | Btn.Ability1, 1);
  assert.equal(p.pick, 1);
  tap(s, Btn.Alt | Btn.Attack);
  assert.equal(totems(s, STORM).length, 1, 'then the second');
  tap(s, Btn.Alt | Btn.Ability1, 1);
  assert.equal(p.pick, 0, 'wraps forward');
  tap(s, Btn.Swap, 1);
  assert.equal(p.pick, 1, 'and back');
  assert.equal(totems(s).length, 2, 'stepping planted nothing');
});

test('stepping the selection costs nothing and works while winded', () => {
  const s = arena();
  const p = s.players[0];
  p.stamina = 0; p.winded = true;
  tap(s, Btn.Alt | Btn.Ability1, 1);
  assert.equal(p.pick, 1);
  assert.ok(p.stamina < 3, 'only the regeneration, nothing spent');
  assert.equal(totems(s).length, 0);
});

test('a Storm strikes the two nearest mobs in its ring and the shaman is credited', () => {
  const s = arena();
  tap(s, Btn.Alt | Btn.Ability1, 1); // select the Storm
  tap(s, Btn.Alt | Btn.Attack);
  const [t] = totems(s, STORM);
  const a = mob(s, s.ents.x[t] + 20, s.ents.y[t], 5);
  const b = mob(s, s.ents.x[t] - 30, s.ents.y[t], 5);
  const far = mob(s, s.ents.x[t] + 200, s.ents.y[t], 5);
  for (const m of [a, b, far]) s.ents.stun[m] = 1000;
  run(s, TOTEMS[STORM].beat * 2);
  for (const m of [a, b]) assert.ok(!s.ents.alive[m] || s.ents.kind[m] !== Kind.Mob, 'struck down');
  assert.equal(s.ents.hp[far], 5);
  assert.ok(s.players[0].kills >= 2);
});

test('one live totem per kind: planting again moves it and mends it', () => {
  const s = arena();
  tap(s, Btn.Attack);
  const [t] = totems(s, STONE);
  s.ents.hp[t] = 10;
  s.ents.x[s.players[0].ent] = 180;
  tap(s, Btn.Attack);
  assert.equal(totems(s).length, 1);
  assert.ok(s.ents.x[t] > 190, 'moved to where the shaman stands now');
  assert.equal(s.ents.hp[t], TOTEMS[STONE].hp);
});

test('planting costs stamina; a winded shaman plants nothing; a press during the cooldown is remembered', () => {
  const s = arena();
  const p = s.players[0];
  tap(s, Btn.Attack, 0);
  assert.ok(p.stamina < CLASSES[SHAMAN].staminaMax - TOTEMS[STONE].cost + 3);
  // an early press lands as soon as the gap is over
  const left = p.cdAttack;
  run(s, left - 2);
  step(s, press(Btn.Ability1));
  run(s, 6);
  assert.equal(totems(s).length, 2);
  p.stamina = 0; p.winded = true;
  tap(s, Btn.Ability2);
  assert.equal(totems(s).length, 2);
});

test('the abilities and the dodge-with-Alt are not a nova and not a roll', () => {
  const s = arena();
  const p = s.players[0];
  p.fury = CLASSES[SHAMAN].furyMax;
  tap(s, Btn.Dodge | Btn.Alt, 1);
  assert.equal(p.dashT, 0, 'no roll');
  assert.ok(p.cdAbility1 > 0, 'Gale ran');
  assert.equal(p.fury, CLASSES[SHAMAN].furyMax, 'and no nova went off');
  tap(s, Btn.Dodge, 1);
  assert.ok(p.dashT > 0 || p.cdDash > 0, 'a plain Dodge is still the roll');
});

test('Ember burns every mob in its ring, not the ones outside, and the shaman gets the kills', () => {
  const s = arena();
  tap(s, Btn.Ability1);
  const [t] = totems(s, EMBER);
  const inside = mob(s, s.ents.x[t] + 20, s.ents.y[t], 6);
  const outside = mob(s, s.ents.x[t] + 120, s.ents.y[t], 6);
  for (const m of [inside, outside]) s.ents.vx[m] = s.ents.vy[m] = 0;
  s.ents.stun[inside] = s.ents.stun[outside] = 400; // they stand where they are
  run(s, TOTEMS[EMBER].beat * 3);
  assert.ok(!s.ents.alive[inside] || s.ents.kind[inside] !== Kind.Mob || s.ents.hp[inside] < 6, 'the inside one burned');
  assert.equal(s.ents.hp[outside], 6, 'the outside one did not');
  assert.ok(s.players[0].kills >= 1, 'credited to the shaman');
});

test('a Stone totem holds enemies: they leave the far-off hero and bite the stone', () => {
  const s = arena();
  tap(s, Btn.Attack);
  const [t] = totems(s, STONE);
  const hp0 = s.ents.hp[t];
  const m = mob(s, s.ents.x[t] + 60, s.ents.y[t] + 6);
  s.ents.x[s.players[0].ent] = s.ents.px[s.players[0].ent] = s.ents.x[t] - 150; // the hero is farther from the mob than the stone is
  for (let k = 0; k < 400 && s.ents.hp[t] === hp0; k++) step(s, idle());
  assert.ok(s.ents.hp[t] < hp0, 'the stone was bitten');
  assert.ok(Math.hypot(s.ents.x[m] - s.ents.x[t], s.ents.y[m] - s.ents.y[t]) < 30, 'the mob came to the stone');
});

test('a broken Stone frees its enemies, and a totem falls when its time is up', () => {
  const s = arena();
  tap(s, Btn.Attack);
  const [t] = totems(s, STONE);
  s.ents.hp[t] = 0.01;
  mob(s, s.ents.x[t] + 6, s.ents.y[t]);
  run(s, 200);
  assert.equal(totems(s, STONE).length, 0);
  tap(s, Btn.Ability1);
  run(s, TOTEMS[EMBER].ttl + 5);
  assert.equal(totems(s).length, 0);
});

test('a Cannon lobs fireballs at the nearest mob in range, and the shaman is credited', () => {
  const s = arena();
  tap(s, Btn.Ability2);
  const [t] = totems(s, CANNON);
  const m = mob(s, s.ents.x[t] + 100, s.ents.y[t], 12);
  s.ents.stun[m] = 1000;
  run(s, 400);
  assert.ok(!s.ents.alive[m] || s.ents.kind[m] !== Kind.Mob, 'the fireballs killed it');
  assert.ok(s.players[0].kills >= 1);
});

test('a Spirit totem mends the shaman and the Stone beside it', () => {
  const s = arena();
  s.ents.maxhp[s.players[0].ent] = CLASSES[SHAMAN].hp;
  s.ents.hp[s.players[0].ent] = 10;
  tap(s, Btn.Attack);
  tap(s, Btn.Alt | Btn.Attack); // (the selected extra is the Spirit)
  const [stone] = totems(s, STONE);
  s.ents.hp[stone] = 20;
  run(s, TOTEMS[SPIRIT].beat * 3);
  assert.ok(s.ents.hp[s.players[0].ent] > 10, 'the shaman is mended');
  assert.ok(s.ents.hp[stone] > 20, 'and the stone');
});

test('Gale shoves mobs away and Gather hauls them toward the Stone; neither hurts', () => {
  const s = arena();
  const near = mob(s, 130, 100);
  s.ents.stun[near] = 0;
  const x0 = s.ents.x[near];
  tap(s, Btn.Alt | Btn.Dodge, 6);
  assert.ok(s.ents.x[near] > x0 + 8, `shoved away (${s.ents.x[near] - x0})`);
  assert.equal(s.ents.hp[near], 1000);
  freeEntity(s.ents, near);

  const t = arena();
  tap(t, Btn.Attack);
  const [stone] = totems(t, STONE);
  t.ents.x[t.players[0].ent] = t.ents.x[stone] - 40;
  const far = mob(t, t.ents.x[stone] + 100, t.ents.y[stone]);
  const d0 = Math.abs(t.ents.x[far] - t.ents.x[stone]);
  tap(t, Btn.Alt | Btn.Ability2, 6);
  assert.ok(Math.abs(t.ents.x[far] - t.ents.x[stone]) < d0 - 8, 'hauled toward the stone');
  assert.equal(t.ents.hp[far], 1000);
  assert.ok(HERDS.gale.cooldown > 0 && HERDS.gather.cooldown > 0);
});

test('a bot-played shaman run replays to the same hash and stays finite', () => {
  const play = (): number => {
    const s = createSim(7);
    s.players[0].classId = SHAMAN;
    s.ents.hp[s.players[0].ent] = s.ents.maxhp[s.players[0].ent] = CLASSES[SHAMAN].hp;
    const f = idle();
    for (let t = 0; t < 900; t++) {
      f[0].buttons = t % 20 === 0 ? Btn.Attack : t % 20 === 6 ? Btn.Ability1 : t % 20 === 12 ? Btn.Ability2 : t % 50 === 7 ? Btn.Alt | Btn.Dodge : 0;
      f[0].moveX = 60;
      step(s, f);
    }
    assert.ok(Number.isFinite(s.ents.x[s.players[0].ent]));
    assert.ok(totems(s).length <= TOTEMS.length);
    return hashState(s);
  };
  assert.equal(play(), play());
  assert.ok(runBot(5, 600, { classId: SHAMAN }).ticks > 0);
});
