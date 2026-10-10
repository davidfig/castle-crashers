import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { Behavior, CLASSIC_MOBS, MOBS, MobType, isBossType, type Special } from '../mobs';
import { ROSTERS } from '../roster';
import { activeBestiary, ensureBestiary, generateBestiary, installBestiary } from './index';

afterEach(() => installBestiary(null));

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919 + 3);

test('a bestiary is a pure function of the run seed, and different seeds give different casts', () => {
  const a = generateBestiary(12345), b = generateBestiary(12345), c = generateBestiary(12346);
  assert.deepEqual(a.defs, b.defs);
  assert.deepEqual(a.looks, b.looks);
  assert.notDeepEqual(a.defs, c.defs);
  assert.notDeepEqual(a.looks, c.looks);
});

test('a bestiary has a monster for every slot, bosses in the boss slots and nothing else', () => {
  for (const seed of SEEDS) {
    const b = generateBestiary(seed);
    assert.equal(b.defs.length, CLASSIC_MOBS.length);
    assert.equal(b.looks.length, CLASSIC_MOBS.length);
    const bosses = new Set(ROSTERS.map((r) => r.boss));
    b.defs.forEach((d, t) => {
      assert.ok(d, `slot ${t} is empty (seed ${seed})`);
      assert.equal(d.behavior === Behavior.Boss, bosses.has(t), `slot ${t} is ${bosses.has(t) ? 'not ' : ''}a boss (seed ${seed})`);
      assert.equal(b.looks[t].boss, bosses.has(t));
    });
    assert.equal(b.defs[MobType.Bomber].behavior, Behavior.Bomber, 'the Meadow bomber slot stays a bomber');
  }
});

test('every generated monster is a legal definition the sim can run', () => {
  for (const seed of SEEDS) {
    const b = generateBestiary(seed);
    b.defs.forEach((d, t) => {
      const tag = `${d.name} (slot ${t}, seed ${seed})`;
      assert.ok(d.name.length > 0, tag);
      for (const k of ['hp', 'speed', 'radius', 'atkCooldown', 'reach', 'windup', 'knockResist'] as const) assert.ok(Number.isFinite(d[k]) && d[k] >= 0, `${tag}: ${k}`);
      assert.ok(d.hp >= 3 && d.speed > 0 && d.radius >= 2.8 && d.radius <= 22, `${tag}: size and health`);
      assert.ok(!(d.special && d.charge && d.behavior !== Behavior.Boss), `${tag}: a special or a charge, never both`);
      if (d.behavior === Behavior.Caster) assert.ok(d.special, `${tag}: a caster has something to cast`);
      if (d.behavior === Behavior.Boss) {
        assert.ok(d.boss && d.charge, `${tag}: a boss has its own def and a charge block`);
        assert.ok(d.boss.moves!.length >= 5, `${tag}: a boss has a repertoire`);
        assert.ok(d.boss.moves!.some((m) => m.kind === 'roar'), `${tag}: a boss calls its retinue`);
        assert.ok(d.radius <= 22, `${tag}: no wider than the grid allows for`);
      } else assert.ok(!d.boss, tag);
      if (d.shield) assert.ok((d.shieldHp ?? 0) > 0, `${tag}: a shield breaks`);
      if (d.burrow) assert.ok(!d.special && !d.charge && !d.revive && !d.hop && !d.retreat, `${tag}: a burrower only burrows`);
      const sp: Special[] = [...(d.special ? [d.special] : []), ...(d.boss?.moves ?? []).flatMap((m) => (m.kind === 'special' ? [m.special] : []))];
      for (const s of sp) if (s.kind === 'summon') {
        assert.ok(s.type >= 0 && s.type < MOBS.length && !isBossType(s.type), `${tag}: summons a real enemy`);
        assert.notEqual(s.type, t, `${tag}: does not summon itself`);
      }
      if (d.onDeath?.split) assert.ok(d.onDeath.split.type !== t && !isBossType(d.onDeath.split.type), tag);
    });
  }
});

test('in each biome the first enemy is plain and no two enemies share a power', () => {
  for (const seed of SEEDS) {
    const b = generateBestiary(seed);
    for (const [bi, r] of ROSTERS.entries()) {
      assert.deepEqual(b.traits[r.entries[0].type], [], `biome ${bi}: the first enemy has no powers (seed ${seed})`);
      assert.equal(b.defs[r.entries[0].type].behavior, Behavior.Melee);
      const seen = new Map<string, string>();
      for (const en of r.entries) for (const id of b.traits[en.type]) {
        if (id === 'arrow') continue;
        assert.ok(!seen.has(id), `biome ${bi}: ${b.defs[en.type].name} and ${seen.get(id)} both have "${id}" (seed ${seed})`);
        seen.set(id, b.defs[en.type].name);
      }
    }
  }
});

test('names are unique across a run, and the cast is varied in size, role and power', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const b = generateBestiary(seed);
    assert.equal(new Set(b.defs.map((d) => d.name)).size, b.defs.length, `duplicate names (seed ${seed})`);
  }
  const roles = new Set<number>(), kinds = new Set<string>(), sizes = new Set<number>();
  for (const seed of SEEDS) {
    const b = generateBestiary(seed);
    b.defs.forEach((d, t) => { if (!isBossType(t)) { roles.add(d.behavior); sizes.add(Math.round(d.radius)); } for (const id of b.traits[t]) kinds.add(id); });
  }
  assert.ok(roles.size >= 4, 'melee, ranged, caster and bomber all turn up');
  assert.ok(kinds.size >= 40, `a wide kit gets used (${kinds.size} powers seen)`);
  assert.ok(sizes.size >= 6, `sizes vary (${[...sizes].sort().join(',')})`);
});

test('the cast is tuned like the roster it replaces: the late ones are tougher than the early ones, on average', () => {
  let early = 0, late = 0, ne = 0, nl = 0;
  for (const seed of SEEDS) {
    const b = generateBestiary(seed);
    for (const r of ROSTERS) {
      r.entries.forEach((en, k) => {
        const hp = b.defs[en.type].hp;
        if (k < 3) { early += hp; ne++; } else if (k >= r.entries.length - 3) { late += hp; nl++; }
      });
    }
  }
  assert.ok(late / nl > 2 * (early / ne), `late ${(late / nl).toFixed(1)} vs early ${(early / ne).toFixed(1)}`);
});

test('installing swaps the sim\'s roster, and restoring brings the hand-made one back', () => {
  assert.equal(activeBestiary(), null);
  assert.equal(MOBS[MobType.Goblin].name, 'goblin');
  const b = ensureBestiary(99);
  assert.equal(activeBestiary(), b);
  assert.equal(MOBS[MobType.Goblin], b.defs[MobType.Goblin]);
  assert.notEqual(MOBS[MobType.Goblin].name, 'goblin');
  assert.equal(ensureBestiary(99), b, 'the same seed is not rebuilt');
  installBestiary(null);
  assert.equal(MOBS[MobType.Goblin].name, 'goblin');
});
