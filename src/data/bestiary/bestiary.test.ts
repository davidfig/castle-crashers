import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { Behavior, CLASSIC_MOBS, MOBS, MobType, isBossType, type Special } from '../mobs';
import { ELEMENTS } from '../elements';
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
      const sp0 = d.special as { radius?: number } | undefined;
      if (d.behavior === Behavior.Caster && sp0 && ['wail', 'lure', 'whiteout', 'nova', 'gust'].includes(d.special!.kind)) assert.ok(d.reach * 1.1 <= sp0.radius! * 0.9, `${tag}: it parks inside its own power's radius`);
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

// ---- elements and skills

import { ELEMENT_COUNT } from '../elements';

function allSpecials(seed: number): { kind: string; sp: Special; boss: boolean; el: number }[] {
  const b = generateBestiary(seed);
  const out: { kind: string; sp: Special; boss: boolean; el: number }[] = [];
  b.defs.forEach((d) => {
    if (d.special) out.push({ kind: d.special.kind, sp: d.special, boss: false, el: d.special.element ?? 0 });
    for (const m of d.boss?.moves ?? []) if (m.kind === 'special') out.push({ kind: m.special.kind, sp: m.special, boss: true, el: m.special.element ?? 0 });
  });
  return out;
}

test('every element and every delivery turns up across the casts, in all their variations', () => {
  const elements = new Set<number>(), kinds = new Set<string>(), patterns = new Set<number>(), shapes = new Set<number>();
  let residue = 0, pierce = 0, splash = 0, homing = 0, shotEls = 0, hitEls = 0, auraEls = 0, deathEls = 0;
  for (const seed of SEEDS) {
    for (const { kind, sp, el } of allSpecials(seed)) {
      kinds.add(kind);
      if (el) elements.add(el);
      const s = sp as { pattern?: number; residue?: unknown; pierce?: boolean; splash?: number; homing?: boolean; shape?: number };
      if (s.pattern) patterns.add(s.pattern);
      if (s.shape) shapes.add(s.shape);
      if (s.residue) residue++;
      if (s.pierce) pierce++;
      if (s.splash) splash++;
      if (s.homing) homing++;
    }
    for (const d of generateBestiary(seed).defs) {
      if (d.shot?.element) shotEls++;
      if (d.onHit) hitEls++;
      if (d.elemAura) auraEls++;
      if (d.onDeath?.element) deathEls++;
    }
  }
  assert.equal(elements.size, ELEMENT_COUNT - 1, `all ten elements appear (saw ${[...elements]})`);
  for (const k of ['lob', 'trap', 'storm', 'pit', 'bolt', 'ring', 'cone', 'totem', 'nova', 'beam', 'leap', 'gust', 'summon', 'heal']) assert.ok(kinds.has(k), `${k} appears`);
  assert.ok(patterns.size >= 6, `the patterns are all used (${[...patterns]})`);
  assert.ok(shapes.size >= 4, 'every projectile shape is used');
  for (const [n, what] of [[residue, 'residue'], [pierce, 'pierce'], [splash, 'splash'], [homing, 'homing'], [shotEls, 'element shots'], [hitEls, 'element hits'], [auraEls, 'element auras'], [deathEls, 'element deaths']] as const) assert.ok(n > 5, `${what} are handed out (${n})`);
});

test('the new skills have sensible numbers, and an element only rides on a skill that can carry it', () => {
  for (const seed of SEEDS) {
    for (const { sp, boss } of allSpecials(seed)) {
      const tag = `${sp.kind} (seed ${seed})`;
      assert.ok(sp.windup > 0, tag);
      if (sp.element !== undefined) assert.ok(sp.element >= 1 && sp.element < ELEMENT_COUNT && (sp.power ?? 1) > 0.3 && (sp.power ?? 1) < 3, `${tag}: element and power`);
      if (sp.kind === 'bolt') assert.ok(sp.count >= 1 && sp.count <= 6 && sp.speed > 0.8 && sp.damage > 0 && sp.shape >= 7, tag);
      if (sp.kind === 'ring') assert.ok(sp.count >= 6 && sp.count <= 18 && sp.speed > 0.8 && sp.maxRange > 60, tag);
      if (sp.kind === 'cone') assert.ok(sp.arc > 0.03 && sp.arc < 0.25 && sp.range >= 50 && sp.maxRange >= sp.range * 0.9, tag);
      if (sp.kind === 'totem') assert.ok(sp.lifetime > sp.interval * 3 && sp.interval >= 40 && sp.range > 100 && sp.cap >= 1, tag);
      if (sp.kind === 'lob' || sp.kind === 'storm' || sp.kind === 'pit' || sp.kind === 'trap') {
        const n = sp.count ?? 1;
        if (n > 1 && sp.pattern) assert.ok(sp.spread !== undefined, `${tag}: a pattern has a spread`);
        if (n > 1) assert.ok(n <= (boss ? 6 : 5), `${tag}: count ${n}`);
      }
      if (sp.kind === 'lob' && sp.residue) assert.ok(sp.element, `${tag}: only an element leaves a pool`);
    }
  }
});

test('a monster\'s powers read as a set: most of its elemental powers are made of the element it leans on', () => {
  let match = 0, total = 0, plain = 0, withEl = 0;
  for (const seed of SEEDS) {
    const b = generateBestiary(seed);
    b.defs.forEach((d, t) => {
      if (d.behavior === Behavior.Boss) return;
      const lean = b.elements[t][0];
      if (!lean) { plain++; return; }
      withEl++;
      for (const id of b.traits[t]) {
        const el = ELEMENTS.find((e) => e.id > 0 && id.endsWith(`:${e.name}`));
        if (!el) continue;
        total++;
        if (el.id === lean || el.id === b.elements[t][1]) match++;
      }
    });
  }
  assert.ok(withEl > plain, 'most monsters lean on an element');
  assert.ok(match / total > 0.7, `${match}/${total} elemental powers match the monster's elements`);
});
