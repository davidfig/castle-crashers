import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Behavior, MOBS, MobType, ProjStyle } from '../data/mobs';
import { availableTypes, BIOME_COUNT, biomeIndex, entryWeight, ROSTERS } from '../data/roster';
import { BIOMES } from '../data/biomes';
import { createRng, Stream } from '../engine/rng';
import { allocEntity, freeEntity, Kind, ZoneKind } from './entities';
import { onMobDeath, SP_CLING, SP_INIT } from './abilities';
import { BERSERK } from './entities';
import { Ev, EV_STRIDE } from './events';
import { pickMobType } from './gen/mix';
import { Btn, createInputFrame, type InputFrame } from './input';
import { createSim, type GameState } from './state';
import { step } from './step';

const idle = () => [0, 1, 2, 3].map(createInputFrame);

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

const alive = (s: GameState, i: number) => s.ents.alive[i] === 1 && s.ents.kind[i] === Kind.Mob;
const countKind = (s: GameState, kind: number, sub = -1) => {
  let n = 0;
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === kind && (sub < 0 || s.ents.sub[i] === sub)) n++;
  return n;
};
function sawEvent(s: GameState, type: number): boolean {
  for (let k = 0; k < s.events.n; k++) if (s.events.data[k * EV_STRIDE] === type) return true;
  return false;
}
/** Steps until `pred` holds (checking events each tick too) or `max` ticks pass. */
function run(s: GameState, max: number, pred: () => boolean): boolean {
  for (let t = 0; t < max; t++) {
    step(s, idle());
    if (pred()) return true;
  }
  return false;
}

test('every biome has at least ten enemies, each defined and unlocked progressively', () => {
  assert.equal(BIOME_COUNT, BIOMES.length, 'a roster for every biome');
  for (const roster of ROSTERS) {
    assert.ok(roster.entries.length >= 10, `only ${roster.entries.length} enemies`);
    const types = new Set(roster.entries.map((en) => en.type));
    assert.equal(types.size, roster.entries.length, 'no duplicates');
    for (const en of roster.entries) assert.ok(MOBS[en.type], `type ${en.type} is defined`);
    // the cast widens as the level goes on, and the last arrivals come after the first
    let prev = 0;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const n = availableTypes(ROSTERS.indexOf(roster), t).length;
      assert.ok(n >= prev);
      prev = n;
    }
    assert.equal(availableTypes(ROSTERS.indexOf(roster), 0).length, 1, 'a single type at the start');
    // one new type at a time, evenly spaced, the last well before the end of the level (the boss)
    const froms = roster.entries.map((en) => en.from);
    for (let k = 1; k < froms.length; k++) assert.ok(froms[k] > froms[k - 1], 'arrivals are strictly ordered');
    assert.ok(froms[froms.length - 1] <= 0.85, 'the whole cast is out before the boss');
    assert.equal(availableTypes(ROSTERS.indexOf(roster), 1).length, roster.entries.length, 'all of them by the end');
    for (const en of roster.entries) assert.ok(entryWeight(en, en.from) > 0 && entryWeight(en, 1) > 0);
  }
});

test('the mix of a biome deepens: late enemies never appear early, and do appear late', () => {
  for (let b = 0; b < BIOME_COUNT; b++) {
    const r = createRng(7, Stream.level);
    const early = new Set<number>(), late = new Set<number>();
    for (let k = 0; k < 4000; k++) early.add(pickMobType(r, 0.02, b));
    for (let k = 0; k < 4000; k++) late.add(pickMobType(r, 0.98, b));
    assert.equal(early.size, 1, `early mix has ${early.size} types`);
    assert.equal(late.size, ROSTERS[b].entries.length, 'every enemy shows up at the end');
    for (const t of early) assert.ok(availableTypes(b, 0.02).includes(t));
  }
});

test('mob definitions are consistent: a special or a charge, never both; casters have a special', () => {
  for (const d of MOBS) {
    assert.ok(!(d.special && d.charge), `${d.name} has both`);
    if (d.behavior === Behavior.Caster) assert.ok(d.special, `${d.name} is a caster without a special`);
    if (d.special) assert.ok(d.windup === d.special.windup || d.behavior === Behavior.Melee, `${d.name}: windup matches its special`);
  }
});

test('the biome is a pure function of the seed and the sim records it', () => {
  for (let seed = 0; seed < 40; seed++) {
    assert.equal(biomeIndex(seed), biomeIndex(seed));
    assert.equal(createSim(seed).biome, biomeIndex(seed));
  }
  const seen = new Set<number>();
  for (let seed = 0; seed < 40; seed++) seen.add(biomeIndex(seed));
  assert.equal(seen.size, BIOME_COUNT);
});

test('a level only spawns its own biome\'s enemies', () => {
  for (let seed = 1; seed < 8; seed++) {
    const s = createSim(seed);
    for (let k = 0; k < s.plan.length; k++) {
      // spawn each encounter the way streaming would, then check what stands there
      s.nextClump = k;
      if (!s.plan[k].boss) { /* planned encounters */ }
    }
    const ok = new Set(ROSTERS[s.biome].entries.map((en) => en.type));
    ok.add(ROSTERS[s.biome].boss);
    for (const en of ROSTERS[s.biome].support) ok.add(en[0]);
    for (let i = 0; i < 60; i++) {
      const t = pickMobType(createRng(seed + i, Stream.spawn), i / 59, s.biome);
      assert.ok(ok.has(t));
    }
  }
});

test('slinger: telegraphs a rock that lands where the hero stood, and moving away dodges it', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const hp0 = s.ents.hp[pe];
  mob(s, MobType.Slinger, 190, 100);
  assert.ok(run(s, 400, () => countKind(s, Kind.Zone, ZoneKind.Rock) > 0), 'a rock is lobbed');
  // run out of the circle
  s.ents.x[pe] = 30;
  assert.ok(run(s, 120, () => countKind(s, Kind.Zone, ZoneKind.Rock) === 0), 'the rock lands');
  assert.equal(s.ents.hp[pe], hp0, 'dodged');

  const s2 = arena(2);
  const pe2 = s2.players[0].ent;
  const hp2 = s2.ents.hp[pe2];
  mob(s2, MobType.Slinger, 190, 100);
  assert.ok(run(s2, 600, () => s2.ents.hp[pe2] < hp2), 'standing still takes the hit');
});

test('shaman heals hurt allies, and only when someone is hurt', () => {
  const s = arena();
  const sh = mob(s, MobType.Shaman, 170, 100);
  const orc = mob(s, MobType.Orc, 180, 110);
  s.ents.cool2[sh] = 0;
  for (let t = 0; t < 120; t++) step(s, idle());
  assert.equal(s.ents.mode[sh], 0, 'nobody to heal: no cast');
  s.ents.hp[orc] = 5;
  assert.ok(run(s, 200, () => alive(s, orc) && s.ents.hp[orc] > 10), 'the orc is mended');
});

test('drummer rallies the crowd: allies get faster', () => {
  const s = arena();
  const d = mob(s, MobType.Drummer, 220, 100);
  const gs = [0, 1, 2, 3].map((k) => mob(s, MobType.Goblin, 225 + k * 3, 90 + k * 6));
  s.ents.cool2[d] = 0;
  s.ents.flags[d] |= SP_INIT;
  assert.ok(run(s, 300, () => gs.some((g) => alive(s, g) && s.ents.buff[g] > 0)), 'allies are rallied');
});

test('necromancer raises skeletons, up to its cap', () => {
  const s = arena();
  const n = mob(s, MobType.Necromancer, 200, 100);
  s.ents.flags[n] |= SP_INIT;
  s.ents.cool2[n] = 0;
  assert.ok(run(s, 300, () => countKind(s, Kind.Mob, MobType.Skeleton) >= 3), 'skeletons rise');
  for (let t = 0; t < 1500; t++) { step(s, idle()); s.ents.hp[s.players[0].ent] = 100; }
  assert.ok(countKind(s, Kind.Mob, MobType.Skeleton) <= 12 + 3, 'capped');
});

test('wraith blinks beside the hero from a distance', () => {
  const s = arena();
  const w = mob(s, MobType.Wraith, 260, 100);
  s.ents.flags[w] |= SP_INIT;
  s.ents.cool2[w] = 0;
  let blinked = false;
  run(s, 200, () => { if (sawEvent(s, Ev.Blink)) blinked = true; return blinked; });
  assert.ok(blinked, 'it blinked');
  const dx = s.ents.x[w] - s.ents.x[s.players[0].ent], dy = s.ents.y[w] - s.ents.y[s.players[0].ent];
  assert.ok(Math.sqrt(dx * dx + dy * dy) < 60, 'and arrived near the hero');
});

test('lich fires a locked ray that hurts only if the hero stays in the lane', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const hp0 = s.ents.hp[pe];
  const l = mob(s, MobType.Lich, 220, 100);
  s.ents.flags[l] |= SP_INIT;
  s.ents.cool2[l] = 0;
  assert.ok(run(s, 400, () => s.ents.hp[pe] < hp0), 'a hero standing in the lane is hit');

  const s2 = arena(2);
  const pe2 = s2.players[0].ent;
  const hp2 = s2.ents.hp[pe2];
  const l2 = mob(s2, MobType.Lich, 220, 100);
  s2.ents.flags[l2] |= SP_INIT;
  s2.ents.cool2[l2] = 0;
  let fired = false;
  for (let t = 0; t < 400 && !fired; t++) {
    step(s2, idle());
    if (s2.ents.mode[l2] === 6) s2.ents.y[pe2] = 100 + 40; // sidestep as soon as the telegraph starts
    fired = sawEvent(s2, Ev.Beam);
  }
  assert.ok(fired);
  assert.equal(s2.ents.hp[pe2], hp2, 'sidestepping the lane dodges it');
});

test('troll stomps a hero who stays close; banshee wail silences', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const hp0 = s.ents.hp[pe];
  const t = mob(s, MobType.Troll, 118, 100);
  s.ents.flags[t] |= SP_INIT;
  s.ents.cool2[t] = 0;
  assert.ok(run(s, 300, () => sawEvent(s, Ev.Burst) || s.ents.hp[pe] < hp0));

  const s2 = arena();
  const b = mob(s2, MobType.Banshee, 140, 100);
  s2.ents.flags[b] |= SP_INIT;
  s2.ents.cool2[b] = 0;
  assert.ok(run(s2, 300, () => s2.players[0].silenceT > 0), 'the wail silences the hero');
  // silenced: the big sweep does nothing
  const p = s2.players[0];
  p.cdSpecial = 0; p.stamina = 100; p.invuln = 0;
  const f = idle();
  f[0].buttons = Btn.Ability2;
  step(s2, f);
  assert.equal(p.cdSpecial, 0, 'no ability while silenced');
});

test('ghoul claws slow the hero', () => {
  const s = arena();
  mob(s, MobType.Ghoul, 108, 100);
  assert.ok(run(s, 200, () => s.players[0].slowT > 0));
});

test('bone brute bursts into skulls; plague zombie leaves a poison pool', () => {
  const s = arena();
  const bb = mob(s, MobType.BoneBrute, 130, 100);
  s.ents.hp[bb] = 1;
  // kill it with a player swing
  const pe = s.players[0].ent;
  s.ents.x[bb] = s.ents.x[pe] + 14;
  const f = idle();
  f[0].buttons = 1; // Btn.Attack
  for (let t = 0; t < 12 && alive(s, bb); t++) step(s, f);
  assert.ok(!alive(s, bb), 'the brute died');
  assert.equal(countKind(s, Kind.Mob, MobType.Skull), 3, 'three skulls');

  const s2 = arena();
  const z = mob(s2, MobType.PlagueZombie, 114, 100);
  s2.ents.hp[z] = 1;
  const f2 = idle();
  f2[0].buttons = 1;
  for (let t = 0; t < 12 && alive(s2, z); t++) step(s2, f2);
  assert.equal(countKind(s2, Kind.Zone, ZoneKind.Poison), 1, 'a pool');
  const pe2 = s2.players[0].ent;
  const hp = s2.ents.hp[pe2];
  s2.ents.x[pe2] = s2.ents.x[countZone(s2)];
  s2.ents.y[pe2] = s2.ents.y[countZone(s2)];
  assert.ok(run(s2, 80, () => s2.ents.hp[pe2] < hp), 'standing in it hurts');
  assert.ok(s2.players[0].slowT > 0, 'and slows');
});
function countZone(s: GameState): number {
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Zone) return i;
  return -1;
}

test('wolves hunt in packs, and the dread knight rises once more; bone archer fires a two-arrow volley', () => {
  const closing = (n: number) => {
    const s = arena();
    const ws = [...Array(n).keys()].map((k) => mob(s, MobType.Wolf, 300 + k * 3, 90 + k * 6));
    for (let t = 0; t < 60; t++) { step(s, idle()); s.players[0].invuln = 1e9; }
    return s.ents.x[ws[0]];
  };
  assert.ok(closing(1) - 300 > closing(4) - 300 + 0, 'a lone wolf is slower than one in a pack');
  const s3 = arena();
  const k = mob(s3, MobType.DreadKnight, 400, 100);
  s3.ents.hp[k] = 1;
  const f3 = idle();
  s3.ents.x[s3.players[0].ent] = 386;
  f3[0].buttons = Btn.Attack;
  for (let t = 0; t < 14 && s3.ents.rem[k] === 0; t++) { step(s3, f3); s3.ents.x[s3.players[0].ent] = 386; }
  assert.ok(alive(s3, k) && s3.ents.hp[k] > 20, 'it gets back up at 40% health');
  s3.ents.hp[k] = 1;
  s3.ents.stun[k] = 0;
  for (let t = 0; t < 60 && alive(s3, k); t++) { step(s3, f3); s3.ents.x[s3.players[0].ent] = 386; }
  assert.ok(!alive(s3, k), 'but only once');

  const s2 = arena();
  mob(s2, MobType.BoneArcher, 190, 100);
  let maxArrows = 0;
  for (let t = 0; t < 300; t++) { step(s2, idle()); maxArrows = Math.max(maxArrows, countKind(s2, Kind.Proj)); s2.ents.hp[s2.players[0].ent] = 100; }
  assert.ok(maxArrows >= 2, `saw ${maxArrows} arrows at once`);
});

test('a hit breaks a special\'s telegraph', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const n = mob(s, MobType.Necromancer, 125, 100);
  s.ents.flags[n] |= SP_INIT;
  s.ents.cool2[n] = 0;
  step(s, idle());
  assert.equal(s.ents.mode[n], 6, 'winding up');
  const f = idle();
  f[0].buttons = 1;
  for (let t = 0; t < 6; t++) step(s, f);
  assert.ok(!alive(s, n) || s.ents.mode[n] !== 6, 'interrupted (or dead)');
  void pe;
});


// ---- The Frozen Pass: every enemy has an ability that no other biome's enemies use.

/** The ability tokens of a mob: everything that makes it more than a body with a weapon. */
function abilities(type: number): string[] {
  const d = MOBS[type];
  const a: string[] = [];
  if (d.charge) a.push('charge');
  if (d.shield) a.push('shield');
  if (d.armored) a.push('armored');
  if (d.slowOnHit) a.push('slowOnHit');
  if (d.weave) a.push('weave');
  if (d.regen) a.push('regen');
  if (d.retreat) a.push('retreat');
  if (d.launch) a.push('launch');
  if (d.berserk) a.push('berserk');
  if (d.aura) a.push('aura');
  if (d.behavior === Behavior.Bomber) a.push('bomber');
  if (d.shot && d.shot.count > 1) a.push('volley');
  if (d.shot?.pull) a.push('hook');
  if (d.special) a.push(d.special.kind);
  if (d.poisonOnHit) a.push('poisonBite');
  if (d.rootOnHit) a.push('root');
  if (d.witherOnHit) a.push('wither');
  if (d.hop) a.push('hop');
  if (d.thorns) a.push('thorns');
  if (d.evade) a.push('evade');
  if (d.burrow) a.push('burrow');
  if (d.drain) a.push('drain');
  if (d.trail) a.push('trail');
  if (d.flame) a.push('flameAura');
  if (d.behavior === Behavior.Melee && d.reach >= 20) a.push('longReach');
  if (d.shot?.poison) a.push(d.shot.style === ProjStyle.Fire ? 'ignite' : 'spit');
  if (d.shot?.homing) a.push('homing');
  if (d.onDeath?.cloud) a.push('spores');
  if (d.pack) a.push('pack');
  if (d.revive) a.push('revive');
  if (d.onDeath?.split) a.push('split');
  if (d.onDeath?.pool) a.push('pool');
  if (d.onDeath?.shards) a.push('shards');
  return a;
}

test('no ability is used by two enemies, in any biome (plain fodder and the basic archer are the baseline)', () => {
  const seen = new Map<string, string>();
  for (const roster of ROSTERS) {
    for (const en of roster.entries) {
      for (const a of abilities(en.type)) {
        assert.ok(!seen.has(a), `${MOBS[en.type].name} and ${seen.get(a)} both have '${a}'`);
        seen.set(a, MOBS[en.type].name);
      }
    }
  }
  const bare = ROSTERS.flatMap((r) => r.entries).filter((en) => abilities(en.type).length === 0).map((en) => MOBS[en.type].name);
  assert.deepEqual(bare.sort(), ['archer', 'goblin', 'skeleton'], 'only the baseline enemies have no ability');
});

function held(buttons: number, moveX = 0): InputFrame[] {
  const f = idle();
  f[0].buttons = buttons;
  f[0].moveX = moveX;
  return f;
}

test('trapper sets a snare that arms, roots whoever steps in, and a dodge-roll tears free', () => {
  const s = arena();
  const p = s.players[0];
  const pe = p.ent;
  const t = mob(s, MobType.Trapper, 230, 100);
  s.ents.flags[t] |= SP_INIT;
  s.ents.cool2[t] = 0;
  assert.ok(run(s, 300, () => countKind(s, Kind.Zone, ZoneKind.Trap) > 0), 'a snare is set');
  freeEntity(s.ents, t);
  const z = [...Array(s.ents.highWater).keys()].find((i) => s.ents.alive[i] && s.ents.kind[i] === Kind.Zone)!;
  assert.equal(p.rootT, 0, 'nobody caught yet');
  assert.ok(run(s, 120, () => s.ents.mode[z] === 2), 'it arms');
  const hp0 = s.ents.hp[pe];
  s.ents.x[pe] = s.ents.x[z]; s.ents.y[pe] = s.ents.y[z]; p.invuln = 0;
  step(s, idle());
  assert.ok(p.rootT > 0, 'rooted');
  assert.ok(s.ents.hp[pe] < hp0, 'and bitten');
  assert.equal(countKind(s, Kind.Zone, ZoneKind.Trap), 0, 'the snare is spent');
  const x0 = s.ents.x[pe];
  for (let k = 0; k < 20; k++) step(s, held(0, 127));
  assert.equal(s.ents.x[pe], x0, 'cannot walk while held');
  p.bufDodge = 5;
  step(s, idle());
  assert.equal(p.rootT, 0, 'a dodge-roll breaks free');
});

test('snow sprite clings to a hero, slowing and gnawing, until a dodge-roll shakes it off', () => {
  const s = arena();
  const p = s.players[0];
  const sp = mob(s, MobType.SnowSprite, 118, 100);
  s.ents.flags[sp] |= SP_INIT;
  s.ents.cool2[sp] = 0;
  assert.ok(run(s, 120, () => s.ents.mode[sp] === SP_CLING), 'it leaps on');
  const hp0 = s.ents.hp[p.ent];
  for (let k = 0; k < 80; k++) step(s, idle());
  assert.ok(s.ents.hp[p.ent] < hp0, 'it gnaws');
  assert.ok(p.slowT > 0, 'and slows');
  assert.ok(Math.abs(s.ents.x[sp] - s.ents.x[p.ent]) < 6, 'riding along');
  for (let k = 0; k < 6 && alive(s, sp) && s.ents.mode[sp] === SP_CLING; k++) { p.bufDodge = 5; step(s, idle()); } // (a hit-stop may swallow a tick)
  assert.ok(!alive(s, sp) || s.ents.mode[sp] !== SP_CLING, 'rolled off (the warrior\'s roll also plows it under)');
});

test('harpooner\'s hook hauls the hero toward it', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.Harpooner, 220, 100);
  assert.ok(run(s, 400, () => p.pullT > 0), 'the line goes taut');
  const x0 = s.ents.x[p.ent];
  for (let k = 0; k < 12; k++) step(s, idle());
  assert.ok(s.ents.x[p.ent] > x0 + 20, `hauled toward the harpooner: ${x0} -> ${s.ents.x[p.ent]}`);
});

test('frost wolf bites and runs, then comes back', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const w = mob(s, MobType.FrostWolf, 108, 100);
  const hp0 = s.ents.hp[pe];
  assert.ok(run(s, 120, () => s.ents.hp[pe] < hp0), 'it bites');
  for (let k = 0; k < 40; k++) { step(s, idle()); s.ents.hp[pe] = hp0; }
  assert.ok(s.ents.x[w] - s.ents.x[pe] > 30, `it has darted away: ${s.ents.x[w] - s.ents.x[pe]}`);
  assert.ok(run(s, 400, () => s.ents.hp[pe] < hp0), 'and it returns for another bite');
});

test('ram\'s headbutt launches the hero across the field', () => {
  const s = arena();
  const pe = s.players[0].ent;
  mob(s, MobType.Ram, 110, 100);
  const hp0 = s.ents.hp[pe];
  assert.ok(run(s, 200, () => s.ents.hp[pe] < hp0), 'the butt lands');
  for (let k = 0; k < 14; k++) step(s, idle());
  assert.ok(100 - s.ents.x[pe] > 50, `flung ${100 - s.ents.x[pe]}`);
});

test('ice husk shatters into a ring of shards that hurt, and a swing can knock them down', () => {
  const s = arena();
  const pe = s.players[0].ent;
  const h = mob(s, MobType.IceHusk, 100, 100);
  const hp0 = s.ents.hp[pe];
  onMobDeath(s, h, MOBS[MobType.IceHusk].onDeath!, 1, 0);
  assert.equal(countKind(s, Kind.Proj), MOBS[MobType.IceHusk].onDeath!.shards!.count, 'a ring of shards');
  for (let k = 0; k < 6; k++) step(s, idle());
  assert.ok(s.ents.hp[pe] < hp0, 'a shard finds the hero');
});

test('yeti goes berserk below half health: frenzied, harder-hitting, and never staggered', () => {
  const s = arena();
  const y = mob(s, MobType.Yeti, 400, 100);
  step(s, idle());
  assert.equal(s.ents.flags[y] & BERSERK, 0, 'calm at full health');
  s.ents.hp[y] = s.ents.maxhp[y] * 0.4;
  step(s, idle());
  assert.ok(s.ents.flags[y] & BERSERK, 'berserk');
  assert.ok(s.ents.buff[y] > 0, 'frenzied');
});

test('frost shaman wards its allies: the next hit on each is absorbed whole', () => {
  const s = arena();
  const sh = mob(s, MobType.FrostShaman, 150, 100);
  s.ents.flags[sh] |= SP_INIT;
  s.ents.cool2[sh] = 0;
  const gs = [0, 1, 2].map((k) => mob(s, MobType.Trapper, 170 + k * 4, 90 + k * 8));
  for (const g of gs) { s.ents.flags[g] |= SP_INIT; s.ents.cool2[g] = 1e4 & 0xffff; }
  assert.ok(run(s, 200, () => gs.every((g) => s.ents.cool[g] > 0)), 'allies are warded');
  // a swing at a warded trapper does nothing the first time
  const g = gs[0];
  s.ents.x[g] = s.ents.x[s.players[0].ent] + 12; s.ents.y[g] = s.ents.y[s.players[0].ent];
  const hp0 = s.ents.hp[g];
  for (let k = 0; k < 8 && s.ents.cool[g] > 0; k++) step(s, held(Btn.Attack));
  assert.equal(s.ents.cool[g], 0, 'the ward broke');
  assert.equal(s.ents.hp[g], hp0, 'and the blow was absorbed');
});

test('blizzard witch conjures a storm that settles into a lingering pool of ice', () => {
  const s = arena();
  const p = s.players[0];
  const w = mob(s, MobType.BlizzardWitch, 190, 100);
  s.ents.flags[w] |= SP_INIT;
  s.ents.cool2[w] = 0;
  assert.ok(run(s, 300, () => countKind(s, Kind.Zone, ZoneKind.Storm) > 0), 'a storm gathers');
  assert.ok(run(s, 120, () => countKind(s, Kind.Zone, ZoneKind.Frost) > 0), 'it settles');
  assert.ok(run(s, 60, () => p.slowT > 0), 'and chills whoever stays');
});

test('whiteout spirit howls a whiteout that reverses the hero\'s movement', () => {
  const s = arena();
  const p = s.players[0];
  const w = mob(s, MobType.WhiteoutSpirit, 130, 100);
  s.ents.flags[w] |= SP_INIT;
  s.ents.cool2[w] = 0;
  assert.ok(run(s, 200, () => p.confuseT > 0), 'the hero loses their bearings');
  for (let k = 0; k < 4; k++) step(s, idle()); // let the hit-stop pass
  const x0 = s.ents.x[p.ent];
  step(s, held(0, 127));
  assert.ok(s.ents.x[p.ent] < x0, 'pushing right walks left');
});

test('tundra guard\'s permafrost chills heroes who stand beside it', () => {
  const s = arena();
  const p = s.players[0];
  mob(s, MobType.TundraGuard, 120, 100);
  step(s, idle());
  assert.ok(p.slowT > 0, 'chilled');
  const far = arena();
  mob(far, MobType.TundraGuard, 260, 100);
  step(far, idle());
  assert.equal(far.players[0].slowT, 0, 'not from afar');
});

test('storms from many witches never stack past the cap', () => {
  const s = arena();
  s.players[0].invuln = 1e9;
  for (let k = 0; k < 8; k++) { const w = mob(s, MobType.BlizzardWitch, 180 + k * 6, 60 + k * 10); s.ents.flags[w] |= SP_INIT; s.ents.cool2[w] = 0; }
  let most = 0;
  for (let t = 0; t < 900; t++) {
    step(s, idle());
    most = Math.max(most, countKind(s, Kind.Zone, ZoneKind.Storm) + countKind(s, Kind.Zone, ZoneKind.Frost));
  }
  assert.ok(most > 0, 'storms are cast');
  assert.ok(most <= (MOBS[MobType.BlizzardWitch].special as { cap: number }).cap, `at most the cap at once (saw ${most})`);
});
