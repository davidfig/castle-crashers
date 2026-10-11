import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateFolk, generatePerson } from '../data/humans';
import { NPC_NAMES, npcSetFromSheet, npcFrame } from './npcArt';
import { composeHuman } from './humanArt';
import { packSheets } from './monsterSprites';

const hash = (s: { rgba: Uint8ClampedArray }): number => { let h = 2166136261; for (const b of s.rgba) h = Math.imul(h ^ b, 16777619); return h >>> 0; };

test('a look is always the same picture', () => {
  const l = generateFolk(5).looks.king;
  const a = composeHuman(l), b = composeHuman(l);
  assert.equal(hash(a), hash(b));
  assert.deepEqual(a.frames, b.frames);
});

test('people of different looks are different pictures', () => {
  const seen = new Set<number>();
  for (let n = 0; n < 40; n++) seen.add(hash(composeHuman(generatePerson(2, 'commoner', n))));
  assert.ok(seen.size >= 38, `${seen.size} of 40`);
});

test('every figure has idle and talk loops, frames inside the sheet, and a pivot on the feet inside the cell', () => {
  for (let s = 1; s <= 25; s++) for (const n of NPC_NAMES) {
    const sh = composeHuman(generateFolk(s).looks[n]);
    for (const anim of ['idle', 'talk']) {
      const a = sh.anims[anim];
      assert.ok(a && a.frames.length === 4 && a.ms.length === 4, `${n}.${anim}`);
      for (const fn of a.frames) {
        const f = sh.frames[fn];
        assert.ok(f && f.x >= 0 && f.y >= 0 && f.x + f.w <= sh.width && f.y + f.h <= sh.height, `${n} ${fn} in the sheet`);
        assert.ok(sh.pivot[0] > 0 && sh.pivot[0] < f.w && sh.pivot[1] === f.h - 1, 'pivot at the feet');
      }
    }
    let solid = 0;
    for (let i = 3; i < sh.rgba.length; i += 4) if (sh.rgba[i]) solid++;
    assert.ok(solid > 60, `${n} is drawn`);
    assert.ok(sh.cell[0] <= 64 && sh.cell[1] <= 64);
  }
});

test('a run\'s six figures fit the atlas band and make usable story sets', () => {
  for (let s = 1; s <= 25; s++) {
    const sheets = NPC_NAMES.map((n) => composeHuman(generateFolk(s).looks[n]));
    const places = packSheets(sheets, 2048, 64);
    assert.ok(places, `seed ${s} fits`);
    const set = npcSetFromSheet(sheets[0], places![0], 2048, 1024);
    const a = set.anims.talk;
    assert.equal(npcFrame(a, 0), a.frames[0]);
    assert.equal(npcFrame(a, a.ms[0] + 1), a.frames[1]);
  }
});
