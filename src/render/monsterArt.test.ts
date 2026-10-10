import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MonsterLook, MonsterSheet } from '../data/monsterLook';
import { generateBestiary } from '../data/bestiary';
import { composeMonster } from './monsterArt';
import { BACKS, BUILDS, CROWNS, HEADS, HELDS, LIMBS, MOTIFS, randomLook } from './monsterLookRandom';
import { packSheets } from './monsterSprites';

const alphaAt = (s: MonsterSheet, x: number, y: number): number => s.rgba[(y * s.width + x) * 4 + 3];
const countPx = (s: MonsterSheet, f: { x: number; y: number; w: number; h: number }): number => {
  let n = 0;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (alphaAt(s, f.x + x, f.y + y) > 0) n++;
  return n;
};
const hashSheet = (s: MonsterSheet): string => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.rgba.length; i++) h = Math.imul(h ^ s.rgba[i], 16777619) >>> 0;
  return `${s.width}x${s.height}:${h}`;
};

function checkSheet(look: MonsterLook, s: MonsterSheet): void {
  const base = ['walk', 'idle', 'hurt', 'dead', 'windup', 'strike', 'cast', 'dazed', 'rise'];
  for (const a of base) assert.ok(s.meta.anims[a]?.frames.length > 0, `lacks ${a}`);
  assert.equal(s.meta.anims.walk.frames.length, 4);
  assert.equal(s.meta.anims.idle.frames.length, 2);
  assert.equal(s.meta.anims.windup.frames.length, 2);
  assert.equal(s.meta.anims.strike.frames.length, 2);
  assert.equal(s.meta.anims.cast.frames.length, 2);
  const ranged = ['bow', 'sling', 'orb', 'staff'].includes(look.held);
  if (ranged) for (const a of ['aim', 'release']) assert.ok(s.meta.anims[a]?.frames.length > 0, `ranged lacks ${a}`);
  if (look.held === 'bomb') assert.equal(s.meta.anims.lit.frames.length, 2);
  if (!ranged && look.held !== 'bomb' && !look.boss) assert.equal(s.meta.anims.charge.frames.length, 2);
  if (look.boss) for (const a of ['slam', 'roar', 'smash']) assert.equal(s.meta.anims[a]?.frames.length, 2, `boss lacks ${a}`);
  else for (const a of ['slam', 'roar', 'smash']) assert.equal(s.meta.anims[a], undefined);
  const maxSide = look.boss ? 128 : 64;
  for (const [a, anim] of Object.entries(s.meta.anims)) {
    const first = s.meta.frames[anim.frames[0]];
    for (const fn of anim.frames) {
      const f = s.meta.frames[fn];
      assert.ok(f, `${a}: missing frame ${fn}`);
      assert.equal(f.w, first.w, `${a} widths differ`);
      assert.equal(f.h, first.h, `${a} heights differ`);
      assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= s.width && f.y + f.h <= s.height, `${fn} outside the sheet`);
      assert.ok(f.w <= maxSide && f.h <= maxSide, `${fn} is ${f.w}x${f.h}`);
      assert.ok(countPx(s, f) > 3, `${fn} is empty`);
      assert.equal(f.w % 2, 0, 'cell is centred on a pixel edge');
    }
  }
  // the standing frames touch the ground (bottom row has ink)
  for (const fn of [s.meta.anims.walk.frames[0], s.meta.anims.idle.frames[0]]) {
    const f = s.meta.frames[fn];
    let any = false;
    for (let x = 0; x < f.w; x++) if (alphaAt(s, f.x + x, f.y + f.h - 1) > 0) any = true;
    assert.ok(any, `${fn} floats above the ground`);
  }
  assert.equal(s.rgba.length, s.width * s.height * 4);
}

test('deterministic: the same look gives identical bytes and metadata', () => {
  for (let i = 0; i < 12; i++) {
    const look = randomLook(i, { boss: i % 4 === 0 });
    const a = composeMonster(look), b = composeMonster({ ...look, motifs: [...look.motifs] });
    assert.equal(hashSheet(a), hashSheet(b));
    assert.deepEqual(a.meta, b.meta);
  }
});

test('every anim is present, frames of an anim share one size, none is empty, standing frames touch the ground', () => {
  for (let i = 0; i < 60; i++) { const look = randomLook(500 + i, { boss: i % 6 === 0 }); checkSheet(look, composeMonster(look)); }
});

test('sheet size budgets for random looks', () => {
  for (let i = 0; i < 80; i++) {
    const look = randomLook(900 + i);
    const s = composeMonster(look);
    assert.ok(s.width * s.height <= 70000, `normal sheet ${s.width}x${s.height}`);
  }
  for (let i = 0; i < 20; i++) {
    const s = composeMonster(randomLook(1300 + i, { boss: true }));
    assert.ok(s.width * s.height <= 300000, `boss sheet ${s.width}x${s.height}`);
  }
});

test('fuzz: hundreds of looks across every enum value (and odd numbers) never throw', () => {
  let n = 0;
  const run = (look: MonsterLook): void => { checkSheet(look, composeMonster(look)); n++; };
  for (let i = 0; i < 300; i++) run(randomLook(3000 + i, { boss: i % 9 === 0 }));
  const base = randomLook(77);
  for (const build of BUILDS) for (const boss of [false, true]) run({ ...base, build, boss, size: boss ? 50 : 15 });
  for (const head of HEADS) run({ ...base, head, held: 'staff' });
  for (const limbs of LIMBS) for (const b of ['blob', 'insect', 'floater', 'serpent'] as const) run({ ...base, limbs, build: b });
  for (const back of BACKS) run({ ...base, back });
  for (const crown of CROWNS) for (const head of HEADS) run({ ...base, crown, head });
  for (const held of HELDS) for (const arms of [0, 1, 2] as const) run({ ...base, held, arms });
  for (const mo of MOTIFS) run({ ...base, motifs: [mo] });
  run({ ...base, motifs: [...MOTIFS] });
  for (const size of [1, 7, 8, 9, 26, 44, 64, 200, -5, 12.6]) for (const boss of [false, true]) run({ ...base, size, boss });
  for (const stout of [0.1, 0.7, 1.4, 5]) run({ ...base, stout });
  for (const eyes of [0, 1, 4, 9]) run({ ...base, eyes });
  assert.ok(n > 450);
});

test('different looks and seeds give visibly different pixels', () => {
  const look = randomLook(11);
  const a = hashSheet(composeMonster(look));
  assert.notEqual(a, hashSheet(composeMonster({ ...look, palette: { ...look.palette, base: look.palette.base ^ 0x203040 } })));
  assert.notEqual(a, hashSheet(composeMonster({ ...look, head: look.head === 'skull' ? 'round' : 'skull' })));
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) seen.add(hashSheet(composeMonster(randomLook(i))));
  assert.equal(seen.size, 40);
});

test('size scales the picture monotonically-ish', () => {
  const look = randomLook(5);
  const hs = [8, 12, 16, 22, 26].map((size) => {
    const s = composeMonster({ ...look, size, boss: false });
    return s.meta.frames.walk_0.h;
  });
  for (let i = 1; i < hs.length; i++) assert.ok(hs[i] > hs[i - 1], `heights ${hs}`);
  const b = [44, 52, 64].map((size) => composeMonster({ ...look, size, boss: true }).meta.frames.walk_0.h);
  assert.ok(b[2] > b[0], `boss heights ${b}`);
});

test('a real bestiary fits the atlas band: all sheets total <= 1.4M px and shelf-pack into 2048x1024', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const be = generateBestiary(seed * 7919);
    const sheets = be.looks.map((l) => composeMonster(l));
    const total = sheets.reduce((a, s) => a + s.width * s.height, 0);
    assert.ok(total <= 1_400_000, `seed ${seed}: ${total} px`);
    assert.ok(packSheets(sheets, 2048, 1024), `seed ${seed}: does not pack (${total} px)`);
    be.looks.forEach((l, i) => checkSheet(l, sheets[i]));
  }
});
