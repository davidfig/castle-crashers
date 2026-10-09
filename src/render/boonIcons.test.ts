import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardFor, UPGRADES } from '../data/upgrades';
import { BOON_SIZE, BOON_SYMBOLS, boonPixels } from './boonIcons';
import { GLASS } from './uiArt';

const pal: Record<string, number> = { ...GLASS, k: GLASS.lead };

test('every upgrade has a picture, named by its id, and no picture is orphaned', () => {
  for (const u of UPGRADES) {
    assert.equal(u.icon, `boon-${u.id}`, `${u.id} icon name`);
    assert.ok(BOON_SYMBOLS[u.id], `${u.id} has a symbol`);
  }
  for (const id of Object.keys(BOON_SYMBOLS)) assert.ok(UPGRADES.some((u) => u.id === id), `${id} is an upgrade`);
});

test('symbols are 10 rows of 10 columns (5 when mirrored), use known colours, and fill the badge', () => {
  for (const [id, s] of Object.entries(BOON_SYMBOLS)) {
    assert.equal(s.rows.length, 10, `${id} rows`);
    for (const r of s.rows) {
      assert.equal(r.length, s.mirror ? 5 : 10, `${id} row width`);
      for (const ch of r) assert.ok(ch === '.' || pal[ch] !== undefined, `${id} colour ${ch}`);
    }
    const px = boonPixels(s, pal);
    assert.equal(px.w, BOON_SIZE); assert.equal(px.h, BOON_SIZE);
    let solid = 0;
    for (let i = 3; i < px.rgba.length; i += 4) if (px.rgba[i] === 255) solid++;
    assert.ok(solid > 130 && solid < 200, `${id} badge is a disc (${solid})`);
  }
});

test('the card text fits the card: names and lines are at most 11 glyphs', () => {
  for (const u of UPGRADES) {
    for (const cls of [0, 1, 2, 3, 4]) {
      const c = cardFor(u, cls);
      assert.ok(c.name.length <= 11, `${u.id} name ${c.name}`);
      for (const l of c.text) assert.ok(l.length <= 11, `${u.id} class ${cls} line ${l}`);
    }
  }
});
