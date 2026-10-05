import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARROW_TTL, MOBS, MobType } from '../data/mobs';
import { CLASSES } from '../data/classes';
import { allocEntity, freeEntity, Kind } from './entities';
import { Ev, EV_STRIDE } from './events';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { step } from './step';

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

test('combo: third swing is the heavier finisher', () => {
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
  assert.ok(dmg[2] > dmg[0] * 1.5, `finisher ${dmg[2]} should out-damage opener ${dmg[0]}`);
  assert.equal(p.combo, 2);
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
  s.spawnTimer = 1;
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

test('finisher wave reaches far down the line past the arc', () => {
  const s = arena();
  const p = s.players[0];
  p.combo = 1; p.comboTimer = 20; // next swing is the finisher
  const far = mob(s, MobType.Goblin, 100 + 100, 100); // beyond the arc (50) but inside the wave (120)
  const off = mob(s, MobType.Goblin, 100 + 100, 100 + 60); // too far off the line
  step(s, press(Btn.Attack));
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

test('reinforcements only ever arrive from ahead of the camera', () => {
  const s = arena();
  s.camX = 1000; s.prevCamX = 1000;
  s.ents.x[s.players[0].ent] = 1100;
  for (let k = 0; k < 6; k++) {
    s.spawnTimer = 1;
    step(s, idle());
    s.camX = 1000; // hold the camera still so "ahead" is unambiguous
  }
  let n = 0;
  for (let i = 0; i < s.ents.highWater; i++) {
    if (s.ents.kind[i] !== Kind.Mob) continue;
    n++;
    assert.ok(s.ents.x[i] >= 1000 + 640, `mob spawned at x=${s.ents.x[i]}, not ahead of the screen`);
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
  const behind = mob(s, MobType.Goblin, cam - 500, 100); // engaged, but hopelessly far behind
  const idleBehind = mob(s, MobType.Goblin, cam - 200, 100);
  s.ents.flags[idleBehind] = 0; // never engaged: simply left behind
  const returning = mob(s, MobType.Goblin, cam - 200, 100); // engaged and close enough to rejoin
  const stragglerNear = mob(s, MobType.Goblin, cam + 50, 100);
  f[0].moveX = -127; // try to retreat
  for (let t = 0; t < 200; t++) step(s, f);
  assert.ok(s.camX >= cam, 'camera does not scroll backwards');
  assert.ok(s.ents.x[pe] >= s.camX + 9, 'hero cannot leave the screen to the left');
  assert.ok(!alive(s, behind), 'engaged mob hopelessly far behind was removed');
  assert.ok(!alive(s, idleBehind), 'idle mob left behind was removed');
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
  s.ents.x[a] = 300 + 640 + 10;
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
