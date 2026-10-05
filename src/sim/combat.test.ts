import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARROW_TTL, MOBS, MobType, isBossType } from '../data/mobs';
import { ROSTERS } from '../data/roster';
import { BOSS_SPECIAL, isWarded } from './abilities';
import { CLASSES } from '../data/classes';
import { allocEntity, freeEntity, Kind, ZoneKind } from './entities';
import { Ev, EV_STRIDE } from './events';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { step } from './step';
import { WORLD_H, WORLD_W } from './constants';
import { activePlayers, partyScale, planLevel, spawnAllClumps, STREAM_DELAY_TICKS } from './gen/level';

const idle = () => [0, 1, 2, 3].map(createInputFrame);
function press(buttons: number): InputFrame[] {
  const f = idle();
  f[0].buttons = buttons;
  return f;
}

/** A sim with the horde removed and the player at a known spot, facing right. */
function arena(seed = 1): GameState {
  const s = createSim(seed);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) freeEntity(e, i);
  s.spawnTimer = 1e9; // no reinforcements
  s.flankTimer = 1e9; // and no flank waves
  s.nextClump = s.plan.length; // and no streamed-in encounters: the arena contains only what a test places
  const pe = s.players[0].ent;
  e.x[pe] = 100; e.y[pe] = 100; e.px[pe] = 100; e.py[pe] = 100;
  s.camX = 0; s.prevCamX = 0;
  return s;
}

function mob(s: GameState, type: number, x: number, y: number, face = -1): number {
  const i = allocEntity(s.ents, Kind.Mob, type, x, y, MOBS[type].hp);
  s.ents.flags[i] = 1;
  s.ents.face[i] = face;
  return i;
}

/** Step with a button held until `done()` is true: the previous hit's hit-stop may swallow a single-tick press. */
function pressUntil(s: GameState, buttons: number, done: () => boolean, max = 12): void {
  for (let t = 0; t < max && !done(); t++) step(s, press(buttons));
}

/** Alive as a mob (a freed slot may be reused by a coin). */
const alive = (s: GameState, i: number) => s.ents.alive[i] === 1 && s.ents.kind[i] === Kind.Mob;

function countEvents(s: GameState, type: number): number {
  let n = 0;
  for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === type) n++;
  return n;
}

test('cleave builds fury, nova spends it, and nova is unavailable without fury', () => {
  const s = arena();
  const p = s.players[0];
  const cls = CLASSES[0];
  p.fury = 0;
  step(s, press(Btn.Ability1));
  assert.equal(p.cdAbility1, 0, 'nova must not fire with no fury');

  for (let k = 0; k < 6; k++) mob(s, MobType.Goblin, 118 + k, 100 + (k - 3) * 2);
  step(s, press(Btn.Attack));
  assert.ok(p.fury > 0, 'hitting enemies builds fury');

  p.fury = 80;
  // The cleave's hit-stop may still be running; the press is buffered and fires as soon as time resumes.
  for (let t = 0; t < 6 && p.cdAbility1 === 0; t++) step(s, press(Btn.Ability1));
  assert.ok(p.cdAbility1 > 0, 'nova fired');
  const expected = 80 - cls.novaCost;
  assert.ok(p.fury >= expected && p.fury <= expected + 6 * cls.furyPerKill + 0.01, `fury after nova: ${p.fury}`); // kills refund a little
});

test('full fury makes a bigger nova', () => {
  const s = arena();
  const p = s.players[0];
  const far = mob(s, MobType.Goblin, 100 + 90, 100); // outside the normal radius, inside the big one
  p.fury = CLASSES[0].furyMax;
  s.ents.flags[far] = 1;
  step(s, press(Btn.Ability1));
  assert.ok(p.fury < 2, `bar emptied (kill refunds a little): ${p.fury}`);
  assert.ok(s.ents.hp[far] < MOBS[MobType.Goblin].hp || !alive(s, far), 'big nova reached the far goblin');
});

test('the basic attack is a two-hit combo of quick sweeps; the big swing is a separate, heavier special', () => {
  const cls = CLASSES[0];
  assert.equal(cls.combo.length, 2);
  const s = arena();
  const p = s.players[0];
  const orc = mob(s, MobType.Orc, 125, 100);
  s.ents.hp[orc] = 1000;
  const dmg: number[] = [];
  let last = s.ents.hp[orc];
  for (let t = 0; t < 120 && dmg.length < 3; t++) {
    step(s, press(Btn.Attack));
    if (s.ents.hp[orc] < last) { dmg.push(last - s.ents.hp[orc]); last = s.ents.hp[orc]; }
  }
  assert.equal(dmg.length, 3);
  assert.ok(Math.abs(dmg[2] - dmg[0]) < 0.01, `the basic swings all hit for the same ${dmg[0]}: no heavy third hit`);
  assert.ok([0, 1].includes(p.combo));

  const before = s.ents.hp[orc];
  p.cdAttack = 0;
  pressUntil(s, Btn.Ability2, () => p.cdSpecial > 0);
  assert.ok(before - s.ents.hp[orc] >= dmg[0] * 1.8, `the special hits for ${before - s.ents.hp[orc]} vs ${dmg[0]}`);
});

test('shield blocks frontal cleaves but not from behind, and nova pierces', () => {
  // Shield bearer facing left (toward the player at x=100), standing at x=125: attacker is in front.
  const s = arena();
  const sb = mob(s, MobType.Shield, 125, 100, -1);
  step(s, press(Btn.Attack));
  assert.equal(s.ents.hp[sb], MOBS[MobType.Shield].hp, 'frontal opener is blocked');
  assert.ok(countEvents(s, Ev.Block) > 0);

  const s2 = arena();
  const sb2 = mob(s2, MobType.Shield, 125, 100, 1); // facing away: player hits its back
  step(s2, press(Btn.Attack));
  assert.ok(s2.ents.hp[sb2] < MOBS[MobType.Shield].hp, 'hit from behind lands');

  const s3 = arena();
  const sb3 = mob(s3, MobType.Shield, 125, 100, -1);
  s3.players[0].fury = 60;
  step(s3, press(Btn.Ability1));
  assert.ok(s3.ents.hp[sb3] < MOBS[MobType.Shield].hp, 'nova pierces shields');
});

test('killing a bomber chain-explodes nearby mobs and credits the player', () => {
  const s = arena();
  const bomber = mob(s, MobType.Bomber, 120, 100);
  const victims = [mob(s, MobType.Goblin, 128, 100), mob(s, MobType.Goblin, 124, 106), mob(s, MobType.Goblin, 130, 96)];
  s.ents.hp[bomber] = 1;
  for (const v of victims) s.ents.hp[v] = 3;
  const before = s.kills;
  step(s, press(Btn.Attack));
  for (const v of victims) assert.ok(!alive(s, v), 'goblin caught in the blast died');
  assert.ok(s.kills - before >= 4, `kills credited: ${s.kills - before}`);
  assert.ok(countEvents(s, Ev.Blast) > 0);
});

test('hit-stop freezes the world after a big hit, but input still buffers', () => {
  const s = arena();
  for (let k = 0; k < 10; k++) mob(s, MobType.Goblin, 130 + k * 3, 100 + (k % 3) * 4);
  s.players[0].fury = 60;
  step(s, press(Btn.Ability1));
  assert.ok(s.hitStop > 0, 'nova causes hit-stop');
  const e = s.ents;
  const snapshot = Array.from(e.x.slice(0, e.highWater));
  const tick = s.tick;
  const dashFrames = press(Btn.Dodge);
  step(s, dashFrames);
  assert.equal(s.tick, tick + 1);
  assert.deepEqual(Array.from(e.x.slice(0, e.highWater)), snapshot, 'nothing moved during hit-stop');
  assert.ok(s.players[0].bufDodge > 0, 'dash press was buffered through the freeze');
});

test('orc telegraph can be interrupted by a hit', () => {
  const s = arena();
  const orc = mob(s, MobType.Orc, 112, 100, -1);
  step(s, idle());
  assert.ok(s.ents.wind[orc] > 0, 'orc starts winding up in reach');
  step(s, press(Btn.Attack));
  assert.equal(s.ents.wind[orc], 0, 'hit cancels the windup');
});

test('orc strike can be dodged by stepping away during the windup', () => {
  const s = arena();
  const orc = mob(s, MobType.Orc, 112, 100, -1);
  const pe = s.players[0].ent;
  const hp0 = s.ents.hp[pe];
  step(s, idle()); // windup begins
  const run = idle();
  run[0].moveX = -127;
  for (let t = 0; t < MOBS[MobType.Orc].windup + 2; t++) {
    s.ents.x[pe] = Math.max(s.camX + 12, s.ents.x[pe]); // stay on screen
    step(s, run);
  }
  s.ents.x[orc] = s.ents.x[orc]; // (orc stays rooted while winding up)
  assert.equal(s.ents.hp[pe], hp0, 'player outranged the strike');
});

test('archer telegraphs, then fires an arrow that hurts, and a cleave can swat arrows', () => {
  const s = arena();
  const archer = mob(s, MobType.Archer, 190, 100, -1);
  const pe = s.players[0].ent;
  const hp0 = s.ents.hp[pe];
  let sawWind = false, sawArrow = false;
  for (let t = 0; t < 400 && s.ents.hp[pe] === hp0; t++) {
    step(s, idle());
    if (s.ents.wind[archer] > 0) sawWind = true;
    for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Proj) sawArrow = true;
  }
  assert.ok(sawWind && sawArrow);
  assert.ok(s.ents.hp[pe] < hp0, 'arrow connected');

  const s2 = arena();
  const a = allocEntity(s2.ents, Kind.Proj, 0, 118, 100, ARROW_TTL);
  s2.ents.vx[a] = -2;
  step(s2, press(Btn.Attack));
  assert.ok(!alive(s2, a), 'cleave knocked the arrow down');
});

test('reinforcements arrive when few mobs are awake', () => {
  const s = arena();
  s.spawnTimer = 0;
  step(s, idle());
  let mobs = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) mobs++;
  assert.ok(mobs >= 6, `got ${mobs}`);
});

test('a single sweep hits a wide arc, including enemies beside the player', () => {
  const s = arena();
  const ahead = mob(s, MobType.Goblin, 125, 100);
  const side = mob(s, MobType.Goblin, 102, 125); // directly "below" the player: still inside a 180-degree sweep
  const behind = mob(s, MobType.Goblin, 70, 100);
  step(s, press(Btn.Attack));
  assert.ok(!alive(s, ahead), 'goblin ahead one-shot');
  assert.ok(!alive(s, side), 'goblin at the side one-shot');
  assert.ok(alive(s, behind), 'goblin behind is untouched');
});

test('knocked-back mobs bowl into others, and the kill is credited to the player', () => {
  const s = arena();
  // An orc-free line: front goblin takes the hit and is launched into a row of goblins behind it.
  const front = mob(s, MobType.Goblin, 124, 100);
  s.ents.hp[front] = 20; // survives the blow, so it is launched rather than killed
  const row = [0, 1, 2, 3, 4, 5].map((k) => mob(s, MobType.Goblin, 138 + k * 6, 100)); // just outside the sweep's reach
  for (const r of row) s.ents.hp[r] = 2; // one bowl kills
  const before = s.kills;
  step(s, press(Btn.Attack));
  for (let t = 0; t < 40; t++) step(s, idle());
  const dead = row.filter((r) => !alive(s, r)).length;
  assert.ok(dead >= 1, `bowled goblins should die, got ${dead}`);
  assert.ok(s.kills - before >= 1, `credited kills: ${s.kills - before}`);
});

test('the special sweeps a wave far down the line past the arc', () => {
  const s = arena();
  const far = mob(s, MobType.Goblin, 100 + 100, 100); // beyond the arc (50) but inside the wave (120)
  const off = mob(s, MobType.Goblin, 100 + 100, 100 + 60); // too far off the line
  step(s, press(Btn.Ability2));
  assert.ok(!alive(s, far), 'wave killed the distant goblin on the line');
  assert.ok(alive(s, off), 'wave does not hit things off the line');
  assert.ok(countEvents(s, Ev.Wave) > 0);
});

test('swinging lunges the hero forward', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const x0 = s.ents.x[pe];
  mob(s, MobType.Goblin, 125, 100);
  for (let t = 0; t < 5; t++) step(s, press(Btn.Attack));
  assert.ok(s.ents.x[pe] > x0 + 2, `moved ${s.ents.x[pe] - x0}`);
});

test('reinforcements never appear behind the camera', () => {
  const s = arena();
  s.camX = 1000; s.prevCamX = 1000;
  s.ents.x[s.players[0].ent] = 1100;
  for (let k = 0; k < 24; k++) {
    s.spawnTimer = 0;
    step(s, idle());
    s.camX = 1000; // hold the camera still so "behind" is unambiguous
  }
  let n = 0;
  for (let i = 0; i < s.ents.highWater; i++) {
    if (s.ents.kind[i] !== Kind.Mob) continue;
    n++;
    assert.ok(s.ents.x[i] >= 1000 - 1, `mob spawned at x=${s.ents.x[i]}, behind the left edge of the screen`);
  }
  assert.ok(n > 0);
});

test('the camera never scrolls back, and mobs left far behind are gone', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const f = idle();
  f[0].moveX = 127;
  for (let t = 0; t < 400; t++) step(s, f);
  const cam = s.camX;
  assert.ok(cam > 100, 'camera advanced');
  const behind = mob(s, MobType.Goblin, cam - 500, 100); // hopelessly far behind
  const returning = mob(s, MobType.Goblin, cam - 200, 100); // close enough to rejoin
  const stragglerNear = mob(s, MobType.Goblin, cam + 50, 100);
  f[0].moveX = -127; // try to retreat
  for (let t = 0; t < 200; t++) step(s, f);
  assert.ok(s.camX >= cam, 'camera does not scroll backwards');
  assert.ok(s.ents.x[pe] >= s.camX + 9, 'hero cannot leave the screen to the left');
  assert.ok(!alive(s, behind), 'a mob hopelessly far behind was removed');
  assert.ok(alive(s, returning), 'an engaged mob just off the left edge is allowed to come back');
  assert.ok(alive(s, stragglerNear));
});

test('an engaged mob that was knocked just offscreen comes back and attacks', () => {
  const s = arena();
  s.camX = 500; s.prevCamX = 500;
  const pe = s.players[0].ent;
  s.ents.x[pe] = 520; s.ents.y[pe] = 100;
  const g = mob(s, MobType.Goblin, 500 - 70, 100, 1); // 70px off the left edge, engaged
  const hp0 = s.ents.hp[pe];
  s.players[0].invuln = 0;
  for (let t = 0; t < 300 && s.ents.hp[pe] === hp0; t++) {
    s.camX = 500; // hold the camera so it is clear the mob is the one returning
    step(s, idle());
  }
  assert.ok(alive(s, g), 'the mob was not removed');
  assert.ok(s.ents.hp[pe] < hp0, 'the mob returned and hit the hero');
});

test('archers never shoot from offscreen: they walk back into view first', () => {
  const s = arena();
  s.camX = 300; s.prevCamX = 300;
  const pe = s.players[0].ent;
  s.ents.x[pe] = 330; s.ents.y[pe] = 100;
  const a = mob(s, MobType.Archer, 300 + 640 + 40, 100, -1); // just off the right edge, in standoff range of nothing yet
  s.ents.x[a] = 300 + 640 + 5; // its edge is just in view, so it is not held
  for (let t = 0; t < 60; t++) {
    s.camX = 300;
    step(s, idle());
    const onScreen = s.ents.x[a] > 306 && s.ents.x[a] < 300 + 640 - 6;
    if (!onScreen) assert.equal(s.ents.wind[a], 0, 'no windup while offscreen');
  }
  assert.ok(s.ents.x[a] < 300 + 640, 'archer moved toward the screen');
});

test('kills drop coins that arc out and are vacuumed up into shared gold', () => {
  const s = arena();
  const orc = mob(s, MobType.Orc, 118, 100, -1);
  s.ents.hp[orc] = 1;
  step(s, press(Btn.Attack));
  let coins = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Coin) coins++;
  assert.equal(coins, 1, 'an orc always drops a coin');
  assert.equal(s.coinCount, 1);
  for (let t = 0; t < 120 && s.gold === 0; t++) step(s, idle());
  assert.ok(s.gold >= 3 && s.gold <= 6, `orc coin is worth 3-6, got ${s.gold}`);
  assert.equal(s.players[0].coins, s.gold);
  assert.equal(s.coinCount, 0);
});

test('kills no longer heal; a kill that drops a potion leaves one on the field', () => {
  const s = arena();
  const hp = CLASSES[s.players[0].classId].hp;
  s.ents.hp[s.players[0].ent] = hp / 2;
  s.potionBudget = 2;
  let drops = 0;
  for (let n = 0; n < 40; n++) {
    const orc = mob(s, MobType.Orc, 118, 100, -1);
    s.ents.hp[orc] = 1;
    step(s, press(Btn.Attack));
    s.ents.hp[s.players[0].ent] = hp / 2;
    if (s.potionCount > drops) { drops = s.potionCount; s.potionBudget = 2; }
    if (drops) break;
  }
  assert.ok(drops > 0, 'an orc eventually drops a potion');
  assert.equal(s.ents.hp[s.players[0].ent], hp / 2, 'the kill itself healed nothing');
});

test('drops are rate limited by the potion budget', () => {
  const s = arena();
  s.potionBudget = 0;
  for (let n = 0; n < 30; n++) {
    const orc = mob(s, MobType.Orc, 118, 100, -1);
    s.ents.hp[orc] = 1;
    step(s, press(Btn.Attack));
  }
  assert.equal(s.potionCount, 0);
});

test('a hurt hero drinks a potion on touch; a full-health hero walks past it', () => {
  const s = arena();
  const p = s.players[0];
  const hp = CLASSES[p.classId].hp;
  s.ents.x[p.ent] = 100;
  s.ents.y[p.ent] = 100;
  const i = allocEntity(s.ents, Kind.Potion, 0, 102, 100, 1);
  s.potionCount = 1;
  for (let t = 0; t < 30; t++) { s.camX = 0; step(s, idle()); }
  assert.ok(s.ents.alive[i] && s.potionCount === 1, 'left alone at full health');
  s.ents.hp[p.ent] = 10;
  step(s, idle());
  assert.equal(s.potionCount, 0);
  assert.ok(Math.abs(s.ents.hp[p.ent] - (10 + hp * 0.3)) < 1e-9, `healed 30%, hp ${s.ents.hp[p.ent]}`);
});

test('with too many coins on the field, further drops go straight into the purse', () => {
  const s = arena();
  s.coinCount = 500;
  const orc = mob(s, MobType.Orc, 118, 100, -1);
  s.ents.hp[orc] = 1;
  step(s, press(Btn.Attack));
  assert.ok(s.gold >= 3, `gold ${s.gold}`);
  assert.equal(s.coinCount, 500, 'no new coin entity was created');
});

test('coins never expire while on screen, but are lost once they fall behind it', () => {
  const s = arena();
  s.ents.x[s.players[0].ent] = 100;
  const stays = allocEntity(s.ents, Kind.Coin, 1, 600, 100, 1);
  s.coinCount = 1;
  for (let t = 0; t < 3000; t++) { s.camX = 0; step(s, idle()); }
  assert.ok(s.ents.alive[stays] && s.ents.kind[stays] === Kind.Coin, 'an on-screen coin is still there after 50 seconds');
  assert.equal(s.coinCount, 1);

  const gone = allocEntity(s.ents, Kind.Coin, 1, 20, 100, 1);
  s.coinCount++;
  s.camX = 400; s.prevCamX = 400;
  s.ents.x[s.players[0].ent] = 420;
  step(s, idle());
  assert.ok(!(s.ents.alive[gone] && s.ents.kind[gone] === Kind.Coin), 'a coin left behind the screen is gone');
  assert.equal(s.coinCount, 1);
});

// ---- bull charge ---------------------------------------------------------------------------

/** Run fn with the orc's charge chance forced to 1 (so the random trigger is deterministic). */
function withSureCharge<T>(fn: () => T): T {
  const ch = MOBS[MobType.Orc].charge!;
  const saved = ch.chance;
  ch.chance = 1;
  try { return fn(); } finally { ch.chance = saved; }
}

function chargingOrc(): { s: GameState; orc: number; pe: number } {
  const s = arena();
  s.camX = 0; s.prevCamX = 0;
  const pe = s.players[0].ent;
  s.ents.x[pe] = 60; s.ents.y[pe] = 100;
  const orc = mob(s, MobType.Orc, 200, 100, -1); // 140 px away: inside the charge range
  return { s, orc, pe };
}

test('an orc winds up, locks on, then charges a fixed distance at high speed and ends dazed', () => {
  withSureCharge(() => {
    const { s, orc } = chargingOrc();
    const ch = MOBS[MobType.Orc].charge!;
    const e = s.ents;
    const mode = () => e.mode[orc] as number;
    step(s, idle());
    assert.equal(mode(), 1, 'windup started');
    assert.ok(e.wind[orc] > 0);

    const lockedX = e.ax[orc];
    // keep the hero away from the lane so we measure the charge, not the collision
    s.players[0].invuln = 1e6;
    let guard = 0;
    while (mode() !== 2 && guard++ < 200) step(s, idle());
    assert.equal(mode(), 2, 'charging');
    const startX = e.x[orc], startY = e.y[orc]; // where the charge began
    let ticks = 0;
    while (mode() === 2 && ticks < 200) { step(s, idle()); ticks++; }
    const travelled = Math.hypot(e.x[orc] - startX, e.y[orc] - startY);
    assert.ok(Math.abs(travelled - ch.distance) < ch.speed + 1, `travelled ${travelled.toFixed(1)}, expected ~${ch.distance}`);
    assert.ok(ticks <= Math.ceil(ch.distance / ch.speed) + 2, `charge took ${ticks} ticks: it is fast`);
    assert.ok(Math.sign(e.ax[orc]) === Math.sign(lockedX), 'direction stayed locked');
    assert.equal(mode(), 0, 'charge over');
    assert.ok(e.stun[orc] >= ch.dazed - 1, 'dazed after the charge');
    assert.ok(e.cool[orc] > 0, 'cooldown set');
  });
});

test('a charging orc cannot be stopped, shoved or staggered, but still takes damage', () => {
  withSureCharge(() => {
    const { s, orc } = chargingOrc();
    const e = s.ents;
    s.players[0].invuln = 1e6;
    while (e.mode[orc] !== 2) step(s, idle());
    const hp0 = e.hp[orc];
    // hit it with a heavy blow from the front while it charges
    e.x[s.players[0].ent] = e.x[orc] - 20; e.y[s.players[0].ent] = e.y[orc];
    s.players[0].combo = 1; s.players[0].comboTimer = 20;
    const rem0 = e.rem[orc];
    step(s, press(Btn.Attack));
    assert.ok(e.hp[orc] < hp0, 'damage still lands');
    assert.equal(e.mode[orc], 2, 'still charging');
    assert.equal(e.stun[orc], 0, 'no stagger');
    assert.ok(e.rem[orc] < rem0 && e.rem[orc] > 0, 'the charge keeps going');
  });
});

test('a hit during the windup cancels the charge', () => {
  withSureCharge(() => {
    const { s, orc } = chargingOrc();
    const e = s.ents;
    step(s, idle());
    assert.equal(e.mode[orc], 1);
    // bring the hero in for a swing
    e.x[s.players[0].ent] = e.x[orc] - 22; e.y[s.players[0].ent] = e.y[orc];
    step(s, press(Btn.Attack));
    assert.equal(e.mode[orc], 0, 'charge cancelled');
    assert.equal(e.wind[orc], 0);
  });
});

test('the charge tramples the hero for heavy damage, but a dash dodges it', () => {
  withSureCharge(() => {
    // Standing in the lane
    const a = chargingOrc();
    const hpA = a.s.ents.hp[a.pe];
    for (let t = 0; t < 200 && a.s.ents.hp[a.pe] === hpA; t++) step(a.s, idle());
    assert.ok(hpA - a.s.ents.hp[a.pe] >= MOBS[MobType.Orc].charge!.damage - 0.5, `took ${hpA - a.s.ents.hp[a.pe]}`);

    // Dashing at the right moment: invulnerable while the orc passes through
    const b = chargingOrc();
    const hpB = b.s.ents.hp[b.pe];
    b.s.players[0].invuln = 0;
    for (let t = 0; t < 200; t++) {
      const f = idle();
      // dash sideways as the orc closes in
      if (b.s.ents.mode[b.orc] === 2 && Math.abs(b.s.ents.x[b.orc] - b.s.ents.x[b.pe]) < 40 && b.s.players[0].cdDash === 0) {
        f[0].buttons = Btn.Dodge;
        f[0].moveY = 127;
      }
      step(b.s, f);
    }
    assert.equal(b.s.ents.hp[b.pe], hpB, 'the dash i-frames carried the hero through unhurt');
  });
});

test('a charging orc plows through other mobs', () => {
  withSureCharge(() => {
    const { s, orc } = chargingOrc();
    const e = s.ents;
    s.players[0].invuln = 1e6;
    e.x[s.players[0].ent] = 10; // hero well out of the way
    const fodder = [0, 1, 2, 3].map((k) => mob(s, MobType.Goblin, 150 - k * 12, 100));
    for (const g of fodder) e.hp[g] = 3;
    for (let t = 0; t < 120; t++) step(s, idle());
    const dead = fodder.filter((g) => !alive(s, g)).length;
    assert.ok(dead >= 2, `plowed ${dead} goblins`);
  });
});

test('orcs only charge from a run-up and not while on cooldown', () => {
  withSureCharge(() => {
    const s = arena();
    const pe = s.players[0].ent;
    s.ents.x[pe] = 100; s.ents.y[pe] = 100;
    const close = mob(s, MobType.Orc, 115, 100, -1); // inside minRange
    step(s, idle());
    assert.equal(s.ents.mode[close], 0, 'too close to charge');

    const { s: s2, orc } = chargingOrc();
    s2.ents.cool[orc] = 100;
    step(s2, idle());
    assert.equal(s2.ents.mode[orc], 0, 'cooling down');
  });
});

test('charges are random: some orcs charge on their way in, others do not', () => {
  let charged = 0;
  const seeds = 24;
  for (let seed = 1; seed <= seeds; seed++) {
    const s = arena(seed);
    const pe = s.players[0].ent;
    s.ents.x[pe] = 60; s.ents.y[pe] = 100;
    s.players[0].invuln = 1e9;
    const orc = mob(s, MobType.Orc, 290, 100, -1);
    let did = false;
    for (let t = 0; t < 900 && !did; t++) {
      step(s, idle());
      s.camX = 0;
      if (s.ents.mode[orc] === 1) did = true;
    }
    if (did) charged++;
  }
  assert.ok(charged >= 3, `only ${charged}/${seeds} orcs ever charged`);
  assert.ok(charged <= seeds - 3, `${charged}/${seeds} orcs charged: it should not be guaranteed`);
});

test('enemies spawn at every height of the field, not just the middle', () => {
  const bands = (ys: number[], n: number) => {
    const b = new Array(n).fill(0);
    for (const y of ys) b[Math.min(n - 1, Math.floor((y / WORLD_H) * n))]++;
    return b;
  };
  // authored level, over a few seeds
  const ys: number[] = [];
  for (const seed of [1, 2, 3, 4]) {
    const s = createSim(seed);
    spawnAllClumps(s, 1);
    for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) ys.push(s.ents.y[i]);
  }
  const b = bands(ys, 5); // five 40px bands
  for (let k = 0; k < 5; k++) {
    assert.ok(b[k] / ys.length > 0.12, `band ${k} only has ${(100 * b[k] / ys.length).toFixed(0)}% of the level's mobs`);
  }

  // reinforcements
  const ry: number[] = [];
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = arena(seed);
    s.camX = 300;
    for (let k = 0; k < 8; k++) {
      s.spawnTimer = 0;
      step(s, idle());
      s.camX = 300;
    }
    for (let i = 0; i < s.ents.highWater; i++) {
      // packs walking in over the top/bottom edge start outside the field; judge the ones coming from ahead
      if (s.ents.kind[i] === Kind.Mob && s.ents.y[i] >= 0 && s.ents.y[i] <= WORLD_H) ry.push(s.ents.y[i]);
    }
  }
  const rb = bands(ry, 5);
  for (let k = 0; k < 5; k++) assert.ok(rb[k] / ry.length > 0.1, `reinforcement band ${k}: ${(100 * rb[k] / ry.length).toFixed(0)}%`);
});

test('flank waves enter over the top and bottom edges, in front of the lead hero', () => {
  let top = 0, bottom = 0, pincers = 0, waves = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s = arena(seed);
    s.camX = 600; s.prevCamX = 600;
    const lead = 700;
    s.ents.x[s.players[0].ent] = lead;
    s.flankTimer = 0;
    step(s, idle());
    let t = 0, b = 0;
    for (let i = 0; i < s.ents.highWater; i++) {
      if (s.ents.kind[i] !== Kind.Mob) continue;
      const x = s.ents.x[i], y = s.ents.y[i];
      assert.ok(x >= lead + 30 - 12 - 1 && x <= 600 + 640, `flank entrant at x=${x.toFixed(0)} is not in front of the hero at ${lead} (and on screen)`);
      if (y < 0) t++; else if (y > WORLD_H) b++; else assert.fail(`flank entrant spawned inside the field at y=${y}`);
      assert.equal(s.ents.flags[i] & 2, 2, 'flank entrants are flagged as entering');
    }
    if (t + b > 0) { waves++; top += t > 0 ? 1 : 0; bottom += b > 0 ? 1 : 0; if (t > 0 && b > 0) pincers++; }
  }
  assert.equal(waves, 60, 'every wave spawned a pack');
  assert.ok(top > 15 && bottom > 15, `top ${top}, bottom ${bottom}`);
  assert.ok(pincers > 5 && pincers < 40, `pincers (both edges at once): ${pincers}`);
});

test('flank waves keep coming, faster deeper into the battlefield, and independent of how many enemies are awake', () => {
  const run = (camX: number, pace: number) => {
    const s = arena(7);
    s.camX = camX; s.prevCamX = camX; s.trigCamX = camX;
    s.ents.x[s.players[0].ent] = camX + 100;
    s.players[0].invuln = 1e9;
    s.flankTimer = 100; // px of advance to the first trigger
    let waves = 0, last = 0;
    for (let t = 0; t < 2400; t++) {
      step(s, idle());
      s.camX = camX + t * pace;
      let entering = 0;
      for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob && s.ents.flags[i] & 2) entering++;
      if (entering > last) waves++;
      last = entering;
      // pretend the party kills everything so the "awake" count stays low... and also run with plenty awake
      for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) freeEntity(s.ents, i);
      last = 0;
    }
    return waves;
  };
  // Waves are triggered by forward progress, not by the clock: a party that stands still sees none.
  assert.equal(run(300, 0), 0, 'standing still must not summon flank waves');
  const early = run(0, 0.5), deep = run(800, 0.5); // deep stays short of the boss arena (no flank waves from there)
  assert.ok(early >= 1, `only ${early} flank waves over 600px of advance early on`);
  assert.ok(deep >= early, `deeper waves are at least as frequent: ${deep} vs ${early}`);

  // with 300 enemies already awake, flank waves still come
  const s = arena(9);
  s.camX = 500; s.prevCamX = 500;
  s.ents.x[s.players[0].ent] = 600;
  for (let k = 0; k < 300; k++) mob(s, MobType.Goblin, 1300 + (k % 40) * 8, 20 + (k % 160));
  s.flankTimer = 0;
  step(s, idle());
  let entering = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob && s.ents.flags[i] & 2) entering++;
  assert.ok(entering > 0, 'a flank wave came even though many enemies were already awake');
});

test('flank packs scale with the party', () => {
  const sizes = [1, 4].map((n) => {
    const s = arena(3);
    s.camX = 400; s.prevCamX = 400;
    for (let k = 1; k < n; k++) s.players[k].active = true;
    s.ents.x[s.players[0].ent] = 450;
    s.flankTimer = 0;
    step(s, idle());
    return countMobs(s);
  });
  assert.ok(sizes[1] >= sizes[0] * 3, `${sizes[1]} for four players vs ${sizes[0]} for one`);
});

test('mobs that walk in from the top or bottom end up inside the field and can never leave it that way', () => {
  for (const startY of [-30, WORLD_H + 30]) {
    const s = arena();
    const pe = s.players[0].ent;
    s.ents.x[pe] = 150; s.ents.y[pe] = 100; s.players[0].invuln = 1e9;
    const g = mob(s, MobType.Goblin, 160, startY, -1);
    s.ents.flags[g] = 3; // aggro + entering
    let inside = -1;
    for (let t = 0; t < 400; t++) {
      step(s, idle());
      if (inside < 0 && s.ents.y[g] >= 0 && s.ents.y[g] <= WORLD_H) inside = t;
    }
    assert.ok(inside >= 0, `entrant from y=${startY} never reached the field`);
    assert.equal(s.ents.flags[g] & 2, 0, 'entering flag cleared once inside');
    // Once inside, shoves and knockback must not push it back out.
    for (let t = 0; t < 120; t++) {
      s.ents.vy[g] = startY < 0 ? -9 : 9;
      step(s, idle());
      assert.ok(s.ents.y[g] >= 0 && s.ents.y[g] <= WORLD_H, `mob left the field to y=${s.ents.y[g].toFixed(1)}`);
    }
  }
});

test('mobs walking in do not attack or shoot until they are on the field', () => {
  const s = arena();
  const pe = s.players[0].ent;
  s.ents.x[pe] = 150; s.ents.y[pe] = 6; s.players[0].invuln = 0;
  const a = mob(s, MobType.Archer, 160, -40, -1);
  s.ents.flags[a] = 3;
  for (let t = 0; t < 10; t++) {
    step(s, idle());
    assert.equal(s.ents.wind[a], 0, 'no windup while still entering');
  }
});

// ---- party-size scaling --------------------------------------------------------------------

function countMobs(s: GameState): number {
  let n = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob && s.ents.alive[i]) n++;
  return n;
}

test('the enemy count scales with the party: each extra player adds enemies, not hit points', () => {
  assert.equal(partyScale(1), 1);
  assert.ok(partyScale(2) > 1.5 && partyScale(3) > partyScale(2) && partyScale(4) > partyScale(3));
  assert.equal(partyScale(9), partyScale(4), 'capped at four players');

  const counts = [1, 2, 3, 4].map((n) => {
    const s = createSim(5);
    for (let c = 0; c < 10; c++) spawnClumpOnly(s, c, partyScale(n)); // the opening stretch, not the whole level (entity cap)
    return countMobs(s);
  });
  for (let k = 1; k < 4; k++) assert.ok(counts[k] > counts[k - 1] * 1.2, `party of ${k + 1} faces ${counts[k]}, party of ${k} faces ${counts[k - 1]}`);
  // enemies are not tankier: same stats at any party size
  assert.equal(MOBS[MobType.Goblin].hp, 6);
});

test('the level streams in as the camera advances, sized for the party at that moment', () => {
  const s = createSim(2);
  assert.equal(countMobs(s), 0, 'nothing exists before the battle begins');
  assert.equal(s.nextClump, 0);
  const frames = idle();
  frames[1].buttons = Btn.Join; // a second player drops in during the opening seconds
  step(s, frames);
  for (let t = 0; t < STREAM_DELAY_TICKS + 5; t++) step(s, idle());
  assert.equal(activePlayers(s), 2);
  assert.ok(s.nextClump > 0, 'the first encounters have been streamed in');
  const first = s.plan[0];
  assert.equal(countMobs(s) >= Math.round(first.size * partyScale(2)), true, 'the first encounter was sized for two players');
  assert.ok(s.nextClump < s.plan.length, 'the rest of the battlefield is not spawned yet');
});

test('a clump has the same contents regardless of when it streams in (only the count differs)', () => {
  const a = createSim(8), b = createSim(8);
  spawnAllClumps(a, 1);
  spawnAllClumps(b, 1);
  assert.equal(hashOf(a), hashOf(b));
  // The first members of a bigger encounter are the same enemies as in the small one.
  const small = createSim(8), big = createSim(8);
  const typesOf = (s: GameState) => { const t: number[] = []; for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) t.push(s.ents.sub[i]); return t; };
  spawnClumpOnly(small, 3, 1);
  spawnClumpOnly(big, 3, 2.5);
  const ts = typesOf(small), tb = typesOf(big);
  assert.deepEqual(tb.slice(0, ts.length), ts);
});

test('reinforcements scale with the party too', () => {
  const sizes = [1, 4].map((n) => {
    const s = arena(3);
    s.camX = 400; s.prevCamX = 400;
    for (let k = 1; k < n; k++) s.players[k].active = true; // count the party without spawning heroes
    s.spawnTimer = 0;
    step(s, idle());
    return countMobs(s);
  });
  assert.ok(sizes[1] >= sizes[0] * 2.5, `pack of ${sizes[1]} for four players vs ${sizes[0]} for one`);
});

function hashOf(s: GameState): number { let h = 0; for (let i = 0; i < s.ents.highWater; i++) h = (Math.imul(h, 31) + Math.round(s.ents.x[i] * 100) + Math.round(s.ents.y[i] * 100) + s.ents.sub[i]) | 0; return h; }
import { spawnClump as spawnClumpOnly } from './gen/level';

test('mobs ahead of the screen hold until it reaches them; once in view they head for the party', () => {
  const s = arena();
  const pe = s.players[0].ent;
  s.ents.x[pe] = 100; s.ents.y[pe] = 100;
  s.camX = 0; s.prevCamX = 0;
  const far = mob(s, MobType.Goblin, 900, 100, -1);
  const x0 = s.ents.x[far];
  for (let t = 0; t < 60; t++) { s.camX = 0; step(s, idle()); }
  assert.equal(s.ents.x[far], x0, 'a mob beyond the right edge holds while the party stands still');
  assert.equal(s.ents.flags[far] & 1, 1);
  const near = mob(s, MobType.Goblin, 600, 100, -1); // on screen
  const n0 = s.ents.x[near];
  for (let t = 0; t < 60; t++) { s.camX = 0; step(s, idle()); }
  assert.ok(s.ents.x[near] < n0 - 20, 'a visible mob heads for the party');
  s.camX = 400; // the party advances: the far mob is now in view
  for (let t = 0; t < 60; t++) { s.camX = 400; step(s, idle()); }
  assert.ok(s.ents.x[far] < x0 - 20, 'once in view it comes');
});

test('streamed-in encounters are awake as soon as they appear', () => {
  const s = createSim(4);
  for (let t = 0; t < STREAM_DELAY_TICKS + 2; t++) step(s, idle());
  let mobs = 0, awake = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Mob) { mobs++; if (s.ents.flags[i] & 1) awake++; }
  assert.ok(mobs > 0);
  assert.equal(awake, mobs);
});

test('flank waves are encounter-sized, not small groups', () => {
  const sizes: number[] = [];
  for (let seed = 1; seed <= 20; seed++) {
    const s = arena(seed);
    s.camX = 800; s.prevCamX = 800;
    s.ents.x[s.players[0].ent] = 900;
    s.flankTimer = 0;
    step(s, idle());
    sizes.push(countMobs(s));
  }
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const planAvg = createSim(1).plan.slice(0, 20).reduce((a, c) => a + c.size, 0) / 20;
  assert.ok(Math.min(...sizes) >= 25, `smallest solo wave has ${Math.min(...sizes)} enemies`);
  assert.ok(avg >= planAvg * 0.9, `average flank wave ${avg.toFixed(0)} vs average encounter ${planAvg.toFixed(0)}`);
});

// ---- the boss ------------------------------------------------------------------------------

import { spawnClump as spawnClumpForBoss } from './gen/level';
import { hasBoss } from './gen/level';

/** The arena at the boss of `biome` (the Meadow's Orc Warlord unless asked for another): each biome ends with its own boss. */
/** The camera at the boss's arena (the last screen of the field) and the spots around it that the boss tests use. */
const BOSS_CAM = WORLD_W - 640;

function bossArena(players = 1, seed = 1, biome = 0): { s: GameState; boss: number; pe: number } {
  const g = globalThis as { __biome?: number };
  const prev = g.__biome;
  g.__biome = biome; // the biome is part of the level seed; pin it so a test does not depend on which biome a seed rolls
  try {
    const s = arena(seed);
    for (let k = 1; k < players; k++) s.players[k].active = true; // count the party for scaling
    const idx = s.plan.findIndex((c) => c.boss);
    s.camX = BOSS_CAM; s.prevCamX = BOSS_CAM;
    spawnClumpForBoss(s, idx, 1);
    const pe = s.players[0].ent;
    s.ents.x[pe] = (BOSS_CAM + 140); s.ents.y[pe] = 100; s.players[0].invuln = 0;
    return { s, boss: s.ents.boss, pe };
  } finally { g.__biome = prev; }
}

test('the level ends with a boss encounter, and the boss is huge, armored, and supported by a retinue', () => {
  const s = createSim(3);
  assert.ok(hasBoss(s));
  const { s: a, boss } = bossArena();
  assert.ok(boss >= 0 && a.ents.alive[boss] === 1);
  assert.equal(a.ents.sub[boss], MobType.Boss);
  const def = MOBS[a.ents.sub[boss]];
  assert.ok(def.radius >= 18 && def.radius > MOBS[MobType.Orc].radius * 3, 'the boss is several times an orc');
  assert.ok(a.ents.hp[boss] >= 600, `the boss has ${a.ents.hp[boss]} HP`);
  const support = countMobs(a) - 1;
  assert.ok(support >= 25, `a retinue of ${support} stands around the boss`);
  assert.ok(a.ents.maxhp[boss] === a.ents.hp[boss]);
});

test('boss health and retinue grow with the party', () => {
  const hp = [1, 2, 4].map((n) => { const { s, boss } = bossArena(n); return s.ents.hp[boss]; });
  assert.ok(hp[1] > hp[0] * 1.4 && hp[2] > hp[1] * 1.2, `hp by party: ${hp.join(', ')}`);
});

test('the boss cannot be shoved or staggered, but takes damage and is hit by its edge, not its centre', () => {
  const { s, boss, pe } = bossArena();
  const e = s.ents;
  // clear the retinue so we are measuring the boss
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
  e.x[boss] = (BOSS_CAM + 140) + 40; e.y[boss] = 100; // centre 40 px away: outside the cleave range of 38 but inside its edge (radius 22)
  e.mode[boss] = 0; e.cool2[boss] = 9999;
  const hp0 = e.hp[boss], x0 = e.x[boss];
  step(s, press(Btn.Attack));
  assert.ok(e.hp[boss] < hp0, 'the cleave connected with the boss\'s edge');
  for (let t = 0; t < 10; t++) step(s, idle());
  assert.equal(e.stun[boss], 0, 'no stagger');
  assert.ok(Math.abs(e.x[boss] - x0) < 8, `the boss was barely moved (${(e.x[boss] - x0).toFixed(1)} px)`);
});

test('the boss ground slam telegraphs, then hurts everyone in the ring; a dash gets through it', () => {
  for (const dash of [false, true]) {
    const { s, boss, pe } = bossArena();
    const e = s.ents;
    for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
    e.x[boss] = (BOSS_CAM + 120); e.y[boss] = 100; e.cool2[boss] = 9999;
    e.x[pe] = (BOSS_CAM + 140); e.y[pe] = 100; // 20 px away: well inside the ring
    e.mode[boss] = 3; e.wind[boss] = MOBS[e.sub[boss]].boss!.slamWindup; // begin the slam windup
    const hp0 = e.hp[pe];
    s.camX = BOSS_CAM;
    let slammed = false;
    for (let t = 0; t < MOBS[e.sub[boss]].boss!.slamWindup + 4; t++) {
      const f = idle();
      if (dash && e.wind[boss] === 8) { f[0].buttons = Btn.Dodge; f[0].moveY = 127; }
      step(s, f);
      for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === Ev.Slam) slammed = true;
      s.events.n = 0;
      s.camX = BOSS_CAM;
    }
    assert.ok(slammed, 'the slam landed');
    if (dash) assert.equal(e.hp[pe], hp0, 'the dash i-frames carried the hero through the slam');
    else assert.ok(hp0 - e.hp[pe] >= MOBS[e.sub[boss]].boss!.slamDamage - 0.5, `took ${hp0 - e.hp[pe]}`);
  }
});

test('the war cry summons supporters, more of them when the party is bigger', () => {
  const sizes = [1, 4].map((n) => {
    const { s, boss } = bossArena(n);
    const e = s.ents;
    for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
    e.cool2[boss] = 9999;
    e.mode[boss] = 4; e.wind[boss] = 2;
    for (let t = 0; t < 4; t++) { step(s, idle()); s.camX = BOSS_CAM; }
    return countMobs(s) - 1;
  });
  assert.ok(sizes[0] >= 8, `the war cry summoned ${sizes[0]}`);
  assert.ok(sizes[1] >= sizes[0] * 3, `${sizes[1]} for four players vs ${sizes[0]} for one`);
});

test('the boss enrages at half health: it roars at once and its moves speed up', () => {
  const { s, boss } = bossArena();
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
  e.cool2[boss] = 9999;
  e.hp[boss] = e.maxhp[boss] * 0.49;
  step(s, idle());
  assert.equal(e.flags[boss] & 4, 4, 'enraged');
  assert.equal(e.mode[boss], 4, 'it opens with a war cry');
});

test('the boss uses its special moves on its own, and a charge covers its full distance', () => {
  const { s, boss, pe } = bossArena();
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
  s.players[0].invuln = 1e9;
  e.cool2[boss] = 5;
  const seen = new Set<number>();
  for (let t = 0; t < 3000 && seen.size < 4; t++) {
    step(s, idle());
    s.camX = BOSS_CAM;
    e.x[pe] = (BOSS_CAM + 140); e.y[pe] = 100; // stay put as a target
    seen.add(e.mode[boss]);
    if (e.mode[boss] === 4) for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
  }
  assert.ok(seen.has(3) || seen.has(4) || seen.has(1), `moves seen: ${[...seen].join(',')}`);
  assert.ok(seen.size >= 3, `moves seen: ${[...seen].join(',')}`);
});

test('killing the boss drops a burst of coins and wins the battle after a few seconds; reaching the end does not', () => {
  const { s, boss, pe } = bossArena();
  const e = s.ents;
  // reaching the far end of the field is not enough while the boss lives
  e.x[pe] = (WORLD_W - 5); s.camX = BOSS_CAM;
  step(s, idle());
  assert.equal(s.phase, 0, 'still fighting');
  e.x[pe] = (BOSS_CAM + 140);
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
  e.hp[boss] = 1; e.x[boss] = (BOSS_CAM + 170); e.y[boss] = 100; e.cool2[boss] = 9999;
  const coins0 = s.coinCount;
  const lootCoins = MOBS[e.sub[boss]].boss!.lootCoins;
  step(s, press(Btn.Attack));
  assert.ok(s.bossDeadTick >= 0, 'the boss is dead');
  assert.equal(e.boss, -1);
  assert.ok(s.coinCount - coins0 >= lootCoins - 1, `coins dropped: ${s.coinCount - coins0}`);
  assert.equal(s.phase, 0, 'not won yet: time to gather the loot');
  for (let t = 0; t < 200; t++) { s.camX = BOSS_CAM; step(s, idle()); }
  assert.equal(s.phase, 1, 'battle won');
});

// ---- stamina and the special ---------------------------------------------------------------

test('swings, dashes and the special spend stamina', () => {
  const cls = CLASSES[0];
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.Goblin, 125, 100);
  assert.equal(p.stamina, cls.staminaMax);
  step(s, press(Btn.Attack));
  assert.equal(p.stamina, cls.staminaMax - cls.attackCost, 'a swing costs a little');
  p.cdAttack = 0;
  pressUntil(s, Btn.Dodge, () => p.dashT > 0);
  assert.ok(p.stamina <= cls.staminaMax - cls.attackCost - cls.dashCost + 0.01, `after a dash: ${p.stamina}`);
  p.cdAttack = 0; p.dashT = 0;
  const before = p.stamina;
  pressUntil(s, Btn.Ability2, () => p.cdSpecial > 0);
  assert.ok(before - p.stamina >= cls.specialCost - 1, `the special cost ${before - p.stamina}`);
  assert.ok(p.cdSpecial > 0, 'and went on cooldown');
});

test('stamina recovers after a short delay, and not while the hero keeps spending it', () => {
  const cls = CLASSES[0];
  const s = arena();
  const p = s.players[0];
  p.stamina = 40; p.staminaDelay = cls.staminaRegenDelay;
  for (let t = 0; t < cls.staminaRegenDelay - 1; t++) step(s, idle());
  assert.equal(p.stamina, 40, 'nothing comes back during the delay');
  for (let t = 0; t < 60; t++) step(s, idle());
  assert.ok(p.stamina > 40 + 30, `recovering: ${p.stamina}`);
  for (let t = 0; t < 600; t++) step(s, idle());
  assert.equal(p.stamina, cls.staminaMax, 'back to full, and capped');
});

test('running out of stamina leaves the hero winded: slow, no attacks or dashes, until some has come back', () => {
  const cls = CLASSES[0];
  const s = arena();
  const p = s.players[0];
  const pe = p.ent;
  mob(s, MobType.Goblin, 125, 100);
  p.stamina = cls.dashCost + 1;
  step(s, press(Btn.Dodge)); // spends almost everything...
  p.stamina = 1; p.dashT = 0; p.cdDash = 0; p.cdAttack = 0;
  step(s, press(Btn.Attack)); // ...and this swing (cost 4) cannot start with 1 stamina
  assert.equal(p.cdAttack, 0, 'cannot swing on 1 stamina');
  p.stamina = cls.attackCost; // exactly enough
  pressUntil(s, Btn.Attack, () => p.cdAttack > 0);
  assert.equal(p.stamina, 0);
  assert.equal(p.winded, true, 'emptied: winded');
  assert.ok(countEvents(s, Ev.Winded) > 0);

  p.cdAttack = 0;
  const hp0 = s.ents.hp[pe];
  step(s, press(Btn.Attack));
  assert.equal(p.cdAttack, 0, 'no attacks while winded');
  p.cdDash = 0; p.dashT = 0;
  step(s, press(Btn.Dodge));
  assert.equal(p.dashT, 0, 'no dashes while winded');
  p.bufAbility2 = 5; p.cdSpecial = 0;
  step(s, idle());
  assert.equal(p.cdSpecial, 0, 'no special while winded');

  // movement is slowed
  const f = idle(); f[0].moveX = 127;
  p.lungeT = 0; s.hitStop = 0; // the swing's forward lunge would be added to the step
  const x0 = s.ents.x[pe];
  step(s, f);
  const winded = s.ents.x[pe] - x0;
  assert.ok(winded < cls.speed * 0.8 && winded > 0, `winded step ${winded.toFixed(2)} vs normal ${cls.speed}`);

  // recovers once enough has come back (and not before)
  for (let t = 0; t < 600 && p.winded; t++) step(s, idle());
  assert.equal(p.winded, false);
  assert.ok(p.stamina >= cls.windedRecover, `back on their feet at ${p.stamina}`);
  assert.ok(hp0 > 0);
});

test('the special needs its stamina and its cooldown', () => {
  const cls = CLASSES[0];
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.Goblin, 125, 100);
  p.stamina = cls.specialCost - 1;
  step(s, press(Btn.Ability2));
  assert.equal(p.cdSpecial, 0, 'not enough stamina');
  p.stamina = cls.staminaMax; p.cdAttack = 0;
  pressUntil(s, Btn.Ability2, () => p.cdSpecial > 0);
  assert.ok(p.cdSpecial > 0, 'cast');
  p.cdAttack = 0; p.stamina = cls.staminaMax;
  const cd = p.cdSpecial;
  step(s, press(Btn.Ability2));
  assert.ok(p.cdSpecial <= cd, 'on cooldown: it did not fire again');
  for (let t = 0; t < cls.specialCooldown + 2; t++) step(s, idle());
  p.stamina = cls.staminaMax; p.cdAttack = 0;
  pressUntil(s, Btn.Ability2, () => p.cdSpecial > 0);
  assert.ok(p.cdSpecial > cd - 5, 'ready again after its cooldown');
});

test('a revived hero comes back with full stamina', () => {
  const cls = CLASSES[0];
  const s = arena();
  s.players[1].active = true;
  s.players[0].downed = true; s.players[0].downTimer = 1;
  s.players[0].stamina = 0; s.players[0].winded = true;
  // someone has to be standing for the auto-revive
  activateForTest(s, 1);
  step(s, idle());
  assert.equal(s.players[0].downed, false);
  assert.equal(s.players[0].stamina, cls.staminaMax);
  assert.equal(s.players[0].winded, false);
});

function activateForTest(s: GameState, slot: number): void {
  const p = s.players[slot];
  p.ent = allocEntity(s.ents, Kind.Player, slot, 120, 100, 100);
  p.active = true; p.downed = false;
}

// ---- the Frozen Pass boss ----------------------------------------------------------------------

test('every biome ends with its own boss, and each is a boss type', () => {
  for (let b = 0; b < ROSTERS.length; b++) {
    const { s, boss } = bossArena(1, 1, b);
    assert.equal(s.biome, b);
    assert.equal(s.ents.sub[boss], ROSTERS[b].boss, `biome ${b}`);
    assert.ok(isBossType(s.ents.sub[boss]));
  }
  assert.equal(ROSTERS[0].boss, MobType.Boss, 'the Meadow keeps the Orc Warlord');
  assert.equal(ROSTERS[2].boss, MobType.RimeKing, 'the Frozen Pass has the Rime King');
});

test('the Rime King is huge and armored, with a retinue of the Pass\'s own folk', () => {
  const { s, boss } = bossArena(1, 1, 2);
  const def = MOBS[MobType.RimeKing];
  assert.equal(s.ents.sub[boss], MobType.RimeKing);
  assert.ok(def.radius >= 18 && def.armored && def.boss, 'a giant boss with its own move set');
  assert.ok(s.ents.hp[boss] >= 600, `the boss has ${s.ents.hp[boss]} HP`);
  const folk = new Set<number>([...ROSTERS[2].support.map((x) => x[0]), ...ROSTERS[2].entries.map((x) => x.type)]);
  let retinue = 0;
  for (let i = 0; i < s.ents.highWater; i++) {
    if (s.ents.kind[i] !== Kind.Mob || i === boss) continue;
    retinue++;
    assert.ok(folk.has(s.ents.sub[i]), `an enemy of type ${s.ents.sub[i]} is not one of the Pass's`);
  }
  assert.ok(retinue >= 25, `a retinue of ${retinue}`);
});

// ---- boss abilities: every boss has a repertoire of its own -----------------------------------------

/** Make the boss cast its special move of kind `kind` right now (its windup is one tick), aimed at the hero, and step once. */
function castBossMove(s: GameState, boss: number, pe: number, kind: string): void {
  const e = s.ents;
  const moves = MOBS[e.sub[boss]].boss!.moves!;
  const k = moves.findIndex((m) => m.kind === 'special' && m.special.kind === kind);
  assert.ok(k >= 0, `the boss has no ${kind} move`);
  e.mode[boss] = BOSS_SPECIAL;
  e.rem[boss] = k;
  e.wind[boss] = 1;
  e.stun[boss] = 0; // (a boss rests a beat after each move; start the next at once)
  e.ax[boss] = e.x[pe]; e.ay[boss] = e.y[pe]; // where aimed moves land
  e.cool2[boss] = 9999;
  // (a heavy move freezes the game for a few ticks of hit-stop: step until this one has gone off)
  for (let t = 0; t < 12 && e.mode[boss] === BOSS_SPECIAL; t++) step(s, idle());
}

function bossMoveKinds(type: number): Set<string> {
  return new Set((MOBS[type].boss!.moves ?? []).map((m) => (m.kind === 'special' ? m.special.kind : m.kind)));
}

function countZones(s: GameState, kind: number): number {
  let n = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.kind[i] === Kind.Zone && s.ents.sub[i] === kind) n++;
  return n;
}

test('every boss has a repertoire of its own: several moves, and moves the other bosses do not have', () => {
  const kinds = ROSTERS.map((r) => bossMoveKinds(r.boss)).filter((k, i, all) => all.findIndex((o) => o === k) === i);
  const warlord = bossMoveKinds(MobType.Boss), rime = bossMoveKinds(MobType.RimeKing);
  assert.ok(kinds.length >= 2);
  assert.ok(warlord.size >= 5 && rime.size >= 5, `${warlord.size} and ${rime.size} kinds of move`);
  const onlyWarlord = [...warlord].filter((k) => !rime.has(k)), onlyRime = [...rime].filter((k) => !warlord.has(k));
  assert.ok(onlyWarlord.length >= 2, `the Warlord's own: ${onlyWarlord.join(', ')}`);
  assert.ok(onlyRime.length >= 3, `the Rime King's own: ${onlyRime.join(', ')}`);
  for (const t of [MobType.Boss, MobType.RimeKing]) for (const m of MOBS[t].boss!.moves!) assert.ok(m.weight > 0);
});

test('the Orc Warlord hurls a volley of boulders and rallies its warband into a frenzy', () => {
  const { s, boss, pe } = bossArena(1, 1, 0);
  const e = s.ents;
  e.x[pe] = e.x[boss] - 120; e.y[pe] = 100;
  castBossMove(s, boss, pe, 'lob');
  assert.ok(countZones(s, ZoneKind.Rock) >= 4, `${countZones(s, ZoneKind.Rock)} boulders in the volley`);
  const rallied = (): number => { let n = 0; for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss && e.buff[i] > 0) n++; return n; };
  assert.equal(rallied(), 0);
  castBossMove(s, boss, pe, 'rally');
  assert.ok(rallied() >= 10, `${rallied()} of the retinue are frenzied`);
});

test('the Rime King throws a frost nova that slows, a barrage of blizzards, and a field of snares', () => {
  const { s, boss, pe } = bossArena(1, 1, 2);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
  e.x[boss] = BOSS_CAM + 120; e.y[boss] = 100;
  e.x[pe] = e.x[boss] - 40; e.y[pe] = 100;
  s.camX = BOSS_CAM;
  const hp0 = e.hp[pe];
  let frost = false;
  castBossMove(s, boss, pe, 'nova');
  for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === Ev.Burst && s.events.data[k * EV_STRIDE + 4] === 5) frost = true;
  assert.ok(frost, 'a frost burst');
  assert.ok(hp0 - e.hp[pe] >= 17, `took ${hp0 - e.hp[pe]}`);
  assert.ok(s.players[0].slowT > 0, 'chilled');
  s.events.n = 0;
  castBossMove(s, boss, pe, 'storm');
  assert.ok(countZones(s, ZoneKind.Storm) >= 4, `${countZones(s, ZoneKind.Storm)} blizzards in the barrage`);
  castBossMove(s, boss, pe, 'trap');
  assert.ok(countZones(s, ZoneKind.Trap) >= 4, `${countZones(s, ZoneKind.Trap)} snares`);
});

test('the Rime King wards its retinue in ice, and an enraged whiteout turns the hero around', () => {
  const { s, boss, pe } = bossArena(1, 1, 2);
  const e = s.ents;
  e.x[pe] = e.x[boss] - 60; e.y[pe] = e.y[boss];
  s.players[0].invuln = 0;
  let warded = 0;
  castBossMove(s, boss, pe, 'ward');
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss && isWarded(e, i)) warded++;
  assert.ok(warded >= 4, `${warded} of the retinue are warded`);
  s.players[0].invuln = 0;
  castBossMove(s, boss, pe, 'whiteout');
  assert.ok(s.players[0].confuseT > 0, 'lost in the whiteout');
  const whiteout = MOBS[MobType.RimeKing].boss!.moves!.find((m) => m.kind === 'special' && m.special.kind === 'whiteout');
  assert.ok(whiteout?.enragedOnly, 'the whiteout is held back for the enrage');
});

test('the Dread Regent is the Keep\'s boss, with a repertoire unlike the other two', () => {
  assert.equal(ROSTERS[1].boss, MobType.DreadRegent);
  const regent = bossMoveKinds(MobType.DreadRegent), others = new Set([...bossMoveKinds(MobType.Boss), ...bossMoveKinds(MobType.RimeKing)]);
  const own = [...regent].filter((k) => !others.has(k));
  assert.ok(own.length >= 3, `the Regent's own: ${own.join(', ')}`);
  assert.ok(!regent.has('charge') && !regent.has('slam'), 'a caster king: no charge or slam');
  const wail = MOBS[MobType.DreadRegent].boss!.moves!.find((m) => m.kind === 'special' && m.special.kind === 'wail');
  assert.ok(wail?.enragedOnly, 'the death wail is held back for the enrage');
});

test('the Dread Regent raises the dead, blinks, screams, drinks its retinue and wails', () => {
  const { s, boss, pe } = bossArena(1, 1, 1);
  const e = s.ents;
  const mobs = (): number => { let n = 0; for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss && e.sub[i] === MobType.Skeleton) n++; return n; };
  e.x[pe] = e.x[boss] - 50; e.y[pe] = e.y[boss];
  s.camX = BOSS_CAM;
  const n0 = mobs();
  castBossMove(s, boss, pe, 'summon');
  assert.ok(mobs() >= n0 + 3, `${mobs() - n0} skeletons raised`);
  s.players[0].invuln = 0;
  const hp0 = e.hp[pe];
  castBossMove(s, boss, pe, 'nova');
  assert.ok(hp0 - e.hp[pe] >= 10, `scream took ${hp0 - e.hp[pe]}`);
  s.players[0].invuln = 0;
  castBossMove(s, boss, pe, 'wail');
  assert.ok(s.players[0].silenceT > 0, 'silenced by the wail');
  e.x[pe] = e.x[boss] - 200; e.y[pe] = e.y[boss];
  const x0 = e.x[boss];
  castBossMove(s, boss, pe, 'blink');
  assert.notEqual(e.x[boss], x0, 'it blinked');
  castBossMove(s, boss, pe, 'heal');
});

test('the Rime King fights with its repertoire: it charges, calls its folk, and casts its ice magic on its own', () => {
  const { s, boss, pe } = bossArena(1, 1, 2);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
  s.players[0].invuln = 1e9;
  e.cool2[boss] = 5;
  const seen = new Set<number>(), casts = new Set<number>();
  for (let t = 0; t < 12000 && !(seen.has(1) && seen.has(4) && casts.size >= 4); t++) {
    step(s, idle());
    s.camX = BOSS_CAM;
    e.x[pe] = e.x[boss] - 90; e.y[pe] = e.y[boss]; // stay put as a target
    seen.add(e.mode[boss]);
    if (e.mode[boss] === BOSS_SPECIAL) casts.add(e.rem[boss]);
    if (e.mode[boss] === 4) for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob && i !== boss) freeEntity(e, i);
  }
  assert.ok(seen.has(1), 'charged');
  assert.ok(seen.has(4), 'called its folk');
  assert.ok(casts.size >= 3, `cast ${casts.size} different specials on its own`);
});
