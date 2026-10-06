// The Sunken Marsh and the Scorched Dunes: each new enemy does one thing no other enemy does (see roster.test.ts), and each is tested here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOBS, MobType } from '../data/mobs';
import { BIOME_COUNT, biomeIndex, ROSTERS } from '../data/roster';
import { allocEntity, freeEntity, Kind, ZoneKind } from './entities';
import { onMobDeath, SP_INIT, SP_LEAP, SP_WIND } from './abilities';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { hurtPlayer, step } from './step';

const idle = () => [0, 1, 2, 3].map(createInputFrame);
function held(buttons: number): InputFrame[] {
  const f = idle();
  f[0].buttons = buttons;
  return f;
}

function arena(seed = 1): GameState {
  const s = createSim(seed);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) freeEntity(e, i);
  s.spawnTimer = 1e9;
  s.flankTimer = 1e9;
  s.nextClump = s.plan.length;
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

/** A caster or special-user that is ready to act on the first tick. */
function ready(s: GameState, i: number): void {
  s.ents.flags[i] |= SP_INIT;
  s.ents.cool2[i] = 0;
}

const alive = (s: GameState, i: number) => s.ents.alive[i] === 1 && s.ents.kind[i] === Kind.Mob;
const countKind = (s: GameState, kind: number, sub = -1) => {
  let n = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === kind && (sub < 0 || s.ents.sub[i] === sub)) n++;
  return n;
};
function run(s: GameState, max: number, pred: () => boolean, inputs: () => InputFrame[] = idle): boolean {
  for (let t = 0; t < max; t++) {
    step(s, inputs());
    if (pred()) return true;
  }
  return false;
}

test('there are two new biomes, each with a boss of its own and a full cast', () => {
  assert.equal(BIOME_COUNT, 5);
  assert.equal(ROSTERS[3].boss, MobType.Fenlord);
  assert.equal(ROSTERS[4].boss, MobType.SunTyrant);
  assert.equal(ROSTERS[3].entries.length, 11);
  assert.equal(ROSTERS[4].entries.length, 11);
  // the seeds of a campaign can reach them
  const seen = new Set<number>();
  for (let seed = 0; seed < 400; seed++) seen.add(biomeIndex(seed));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
});

test('every new level can be played end to end on its own enemies without anything breaking', () => {
  for (const biome of [3, 4]) {
    let seed = 1;
    while (biomeIndex(seed) !== biome) seed++;
    const s = createSim(seed);
    assert.equal(s.biome, biome);
    s.players[0].invuln = 1e9;
    for (let t = 0; t < 2400; t++) {
      const f = idle();
      f[0].moveX = 127;
      f[0].buttons = Btn.Attack;
      step(s, f);
      assert.ok(Number.isFinite(s.ents.x[s.players[0].ent]), 'positions stay finite');
    }
    assert.ok(s.camX > 100, 'the party advances');
  }
});

// ---- Sunken Marsh

test('a bog frog hops: in bursts it covers more ground than it could walk', () => {
  const s = arena();
  const f = mob(s, MobType.BogFrog, 250, 100);
  let most = 0;
  for (let t = 0; t < 120 && alive(s, f); t++) {
    const x0 = s.ents.x[f];
    step(s, idle());
    most = Math.max(most, Math.abs(s.ents.x[f] - x0));
  }
  assert.ok(most > MOBS[MobType.BogFrog].speed * 2, `its biggest step was ${most.toFixed(2)}px`);
});

test('a mud leech\'s bite poisons, and the poison keeps taking health after the bite', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.MudLeech, 106, 100);
  assert.ok(run(s, 120, () => p.poisonT > 0), 'poisoned');
  assert.ok(!p.burning, 'venom, not fire');
  const hp = s.ents.hp[p.ent];
  p.invuln = 0;
  for (const m of [...Array(s.ents.highWater).keys()]) if (alive(s, m)) freeEntity(s.ents, m);
  for (let t = 0; t < 100; t++) step(s, idle());
  assert.ok(s.ents.hp[p.ent] < hp, 'it bleeds on its own');
  for (let t = 0; t < 200; t++) step(s, idle());
  assert.equal(p.poisonT, 0, 'and wears off');
});

test('a toad spitter\'s glob of venom poisons the hero it hits', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.ToadSpitter, 190, 100);
  assert.ok(run(s, 600, () => p.poisonT > 0), 'poisoned by the glob');
});

test('a bullfrog leaps: a ring marks the landing, it comes down on the hero and slows them', () => {
  const s = arena();
  const p = s.players[0];
  const b = mob(s, MobType.Bullfrog, 190, 100);
  ready(s, b);
  assert.ok(run(s, 60, () => s.ents.mode[b] === SP_WIND), 'it crouches');
  assert.ok(run(s, 60, () => s.ents.mode[b] === SP_LEAP), 'it leaps');
  const x0 = s.ents.x[b];
  step(s, idle());
  step(s, idle());
  assert.ok(s.ents.z[b] > 0, 'in the air');
  assert.ok(s.ents.x[b] < x0, 'toward the hero');
  const hp = s.ents.hp[p.ent];
  assert.ok(run(s, 60, () => s.ents.mode[b] !== SP_LEAP), 'it lands');
  assert.equal(s.ents.z[b], 0, 'on the ground');
  assert.ok(s.ents.hp[p.ent] < hp, 'on the hero');
  assert.ok(p.slowT > 0, 'who is slowed');
});

test('a sporebloat bursts into a cloud that saps the stamina of anyone in it', () => {
  const s = arena();
  const p = s.players[0];
  const m = mob(s, MobType.Sporebloat, 100, 100);
  onMobDeath(s, m, MOBS[MobType.Sporebloat].onDeath!, 1, 0);
  assert.equal(countKind(s, Kind.Zone, ZoneKind.Spore), 1, 'a spore cloud');
  p.stamina = 50;
  p.staminaDelay = 0;
  for (let t = 0; t < 30; t++) step(s, idle());
  assert.ok(p.stamina < 35, `stamina drained (now ${p.stamina.toFixed(1)})`);
  const outside = arena();
  const m2 = mob(outside, MobType.Sporebloat, 200, 100);
  onMobDeath(outside, m2, MOBS[MobType.Sporebloat].onDeath!, 1, 0);
  outside.players[0].stamina = 50;
  for (let t = 0; t < 30; t++) step(outside, idle());
  assert.ok(outside.players[0].stamina >= 50, 'not from afar');
});

test('a reed stalker strikes from farther away than any other enemy', () => {
  const longest = Math.max(...ROSTERS.flatMap((r) => r.entries).map((en) => MOBS[en.type]).filter((d) => d.behavior === 0).map((d) => d.reach));
  assert.equal(MOBS[MobType.ReedStalker].reach, longest);
});

test('a wisp\'s false light drags the hero toward it', () => {
  const s = arena();
  const p = s.players[0];
  const w = mob(s, MobType.Wisp, 200, 100);
  ready(s, w);
  const x0 = s.ents.x[p.ent];
  assert.ok(run(s, 120, () => s.ents.x[p.ent] > x0 + 20), 'pulled across the field');
});

test('a peat brute leaves mud that slows, and the mud hurts nothing', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.PeatBrute, 300, 100);
  assert.ok(run(s, 400, () => countKind(s, Kind.Zone, ZoneKind.Mud) >= 2), 'it leaves a trail');
  const z = [...Array(s.ents.highWater).keys()].find((i) => s.ents.alive[i] && s.ents.kind[i] === Kind.Zone && s.ents.sub[i] === ZoneKind.Mud)!;
  for (const m of [...Array(s.ents.highWater).keys()]) if (alive(s, m)) freeEntity(s.ents, m);
  s.ents.x[p.ent] = s.ents.x[z]; s.ents.y[p.ent] = s.ents.y[z];
  const hp = s.ents.hp[p.ent];
  for (let t = 0; t < 60; t++) step(s, idle());
  assert.ok(p.slowT > 0, 'slowed');
  assert.equal(s.ents.hp[p.ent], hp, 'unhurt');
});

test('a mire hag hexes the hero, who then takes half again as much damage', () => {
  const s = arena();
  const p = s.players[0];
  const h = mob(s, MobType.MireHag, 190, 100);
  ready(s, h);
  assert.ok(run(s, 120, () => p.hexT > 0), 'hexed');
  p.invuln = 0;
  const hp = s.ents.hp[p.ent];
  hurtPlayer(s, 0, 10);
  const lost = hp - s.ents.hp[p.ent];
  const plain = arena();
  const hp2 = plain.ents.hp[plain.players[0].ent];
  hurtPlayer(plain, 0, 10);
  assert.ok(lost > (hp2 - plain.ents.hp[plain.players[0].ent]) * 1.4, `${lost} vs normal`);
});

test('a hag\'s hex can be dodged by stepping out of the marked spot', () => {
  const s = arena();
  const p = s.players[0];
  const h = mob(s, MobType.MireHag, 190, 100);
  ready(s, h);
  assert.ok(run(s, 60, () => s.ents.mode[h] === SP_WIND), 'winding up');
  s.ents.x[p.ent] += 60; // walked away
  assert.ok(run(s, 80, () => s.ents.mode[h] !== SP_WIND));
  assert.equal(p.hexT, 0, 'the mark landed on empty ground');
});

test('a toad matron\'s venomous skin poisons whoever hits her', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.ToadMatron, 112, 100);
  assert.ok(run(s, 200, () => p.poisonT > 0, () => held(Btn.Attack)), 'poisoned by striking her');
});

test('a drowned warden\'s grasp snares the hero, and a dodge-roll tears free', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.DrownedWarden, 108, 100);
  assert.ok(run(s, 200, () => p.rootT > 0), 'held fast');
  for (let k = 0; k < 6 && p.rootT > 0; k++) { p.bufDodge = 5; step(s, idle()); } // (a hit-stop may swallow a tick)
  assert.equal(p.rootT, 0, 'a roll breaks free');
});

// ---- Scorched Dunes

test('a dune raider sometimes lets a blow glance off', () => {
  const def = MOBS[MobType.DuneRaider];
  const saved = def.evade;
  def.evade = 1;
  try {
    const s = arena();
    const r = mob(s, MobType.DuneRaider, 112, 100);
    for (let t = 0; t < 120; t++) { s.ents.x[s.players[0].ent] = s.ents.x[r] - 10; s.ents.y[s.players[0].ent] = s.ents.y[r]; step(s, held(Btn.Attack)); }
    assert.equal(s.ents.hp[r], def.hp, 'every blow glanced off');
    def.evade = 0;
    s.players[0].stamina = 100;
    s.players[0].winded = false;
    for (let t = 0; t < 120 && alive(s, r); t++) { s.ents.x[s.players[0].ent] = s.ents.x[r] - 10; s.ents.y[s.players[0].ent] = s.ents.y[r]; step(s, held(Btn.Attack)); } // (a swing lunges: keep the hero beside it)
    assert.ok(!alive(s, r), 'and when it does not evade it falls');
  } finally {
    def.evade = saved;
  }
});

test('a scarab heals itself on each bite', () => {
  const s = arena();
  const p = s.players[0];
  const m = mob(s, MobType.Scarab, 106, 100);
  s.ents.hp[m] = 1;
  assert.ok(run(s, 120, () => s.ents.hp[p.ent] < 100 && s.ents.hp[m] > 1), 'it bit and fed');
});

test('a flame archer\'s arrow sets the hero alight', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.FlameArcher, 190, 100);
  assert.ok(run(s, 600, () => p.poisonT > 0), 'burning');
  assert.ok(p.burning, 'fire, not venom');
});

test('a sidewinder travels under the sand, cannot be hurt there, and surfaces beside the hero', () => {
  const s = arena();
  const sw = mob(s, MobType.Sidewinder, 260, 100);
  const x0 = s.ents.x[sw];
  for (let t = 0; t < 10; t++) step(s, idle());
  assert.equal(s.ents.rem[sw], 0, 'hidden');
  assert.ok(s.ents.x[sw] < x0 - 3, 'tunnelling toward the hero');
  assert.equal(s.ents.hp[sw], MOBS[MobType.Sidewinder].hp, 'untouched');
  assert.ok(run(s, 400, () => s.ents.rem[sw] === 1), 'it surfaces');
  assert.ok(Math.abs(s.ents.x[sw] - s.ents.x[s.players[0].ent]) <= MOBS[MobType.Sidewinder].burrow! + 8, 'beside the hero');
});

test('a scorpion\'s shell cannot be staggered', () => {
  const s = arena();
  const m = mob(s, MobType.Scorpion, 112, 100);
  for (let t = 0; t < 20 && alive(s, m); t++) step(s, held(Btn.Attack));
  assert.ok(s.ents.hp[m] < MOBS[MobType.Scorpion].hp, 'it was hit');
  assert.equal(s.ents.stun[m], 0, 'but never reeled');
});

test('a falconer\'s falcon veers after a hero who sidesteps', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.Falconer, 200, 100);
  let proj = -1;
  assert.ok(run(s, 400, () => { for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Proj) { proj = i; return true; } return false; }), 'a falcon is loosed');
  const vy0 = s.ents.vy[proj];
  s.ents.y[p.ent] = 40; // sidestepped to the far edge of the lane
  for (let t = 0; t < 20 && s.ents.alive[proj]; t++) step(s, idle());
  assert.ok(s.ents.vy[proj] < vy0 - 0.05, 'it turned toward them');
});

test('a dust devil\'s gust blows the hero away from it', () => {
  const s = arena();
  const p = s.players[0];
  const d = mob(s, MobType.DustDevil, 130, 100);
  ready(s, d);
  s.ents.cool2[d] = 0;
  assert.ok(run(s, 120, () => p.pullT > 0), 'shoved');
  assert.ok(s.ents.x[p.ent] <= 100 && p.pullX < 0, 'away from the devil');
});

test('an antlion opens a pit that drags the hero toward its middle', () => {
  const s = arena();
  const p = s.players[0];
  const a = mob(s, MobType.Antlion, 190, 100);
  ready(s, a);
  assert.ok(run(s, 200, () => countKind(s, Kind.Zone, ZoneKind.Pit) > 0), 'a pit is dug');
  freeEntity(s.ents, a);
  const z = [...Array(s.ents.highWater).keys()].find((i) => s.ents.alive[i] && s.ents.kind[i] === Kind.Zone && s.ents.sub[i] === ZoneKind.Pit)!;
  assert.ok(run(s, 120, () => s.ents.mode[z] === 1), 'it opens');
  s.ents.x[p.ent] = s.ents.x[z] - 20; s.ents.y[p.ent] = s.ents.y[z];
  const gap = Math.abs(s.ents.x[z] - s.ents.x[p.ent]);
  for (let t = 0; t < 20; t++) step(s, idle());
  assert.ok(Math.abs(s.ents.x[z] - s.ents.x[p.ent]) < gap - 4, 'dragged in');
});

test('a mummy\'s curse stops a hero\'s stamina coming back', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.Mummy, 110, 100);
  assert.ok(run(s, 200, () => p.witherT > 0), 'withered');
  for (const m of [...Array(s.ents.highWater).keys()]) if (alive(s, m)) freeEntity(s.ents, m);
  p.stamina = 20;
  p.staminaDelay = 0;
  for (let t = 0; t < 40; t++) step(s, idle());
  assert.equal(p.stamina, 20, 'no recovery while withered');
});

test('a sun priest\'s flash roots and silences the hero it catches', () => {
  const s = arena();
  const p = s.players[0];
  const m = mob(s, MobType.SunPriest, 200, 100);
  ready(s, m);
  assert.ok(run(s, 160, () => p.rootT > 0 && p.silenceT > 0), 'dazzled');
});

test('a sun guard\'s fire sets heroes beside it alight', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.SunGuard, 120, 100);
  step(s, idle());
  assert.ok(p.poisonT > 0 && p.burning, 'burning');
  const far = arena();
  mob(far, MobType.SunGuard, 260, 100);
  step(far, idle());
  assert.equal(far.players[0].poisonT, 0, 'not from afar');
});

test('the Fenlord leaps across the field and the Sun Tyrant digs pits, and both fight on', () => {
  for (const [type, kind] of [[MobType.Fenlord, 'leap'], [MobType.SunTyrant, 'pit']] as const) {
    const moves = MOBS[type].boss!.moves!;
    assert.ok(moves.some((m) => m.kind === 'special' && m.special.kind === kind), `${MOBS[type].name} has a ${kind}`);
  }
  const s = arena();
  s.players[0].invuln = 1e9;
  const b = mob(s, MobType.Fenlord, 260, 100);
  s.ents.boss = b;
  let leapt = false;
  for (let t = 0; t < 4000 && alive(s, b); t++) {
    s.ents.x[s.players[0].ent] = Math.max(20, s.ents.x[b] - 180); // the party keeps its distance, so the leap has room
    step(s, idle());
    if (s.ents.mode[b] === SP_LEAP) leapt = true;
    assert.ok(Number.isFinite(s.ents.x[b]) && Number.isFinite(s.ents.z[b]), 'stays sane');
  }
  assert.ok(leapt, 'the Fenlord leaps');
  assert.ok(s.ents.z[b] === 0, 'and comes down');
});
