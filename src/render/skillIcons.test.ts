import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS } from '../data/skills';
import { BOON_SIZE, boonPixels } from './boonIcons';
import { SKILL_SLUGS, SKILL_SYMBOLS } from './skillIcons';
import { GLASS } from './uiArt';

const pal: Record<string, number> = { ...GLASS, k: GLASS.lead };
const all = Object.values(SKILL_SLUGS).flat();

test('every replacement skill has a picture, named skill-<slug>, and no picture is orphaned or doubled', () => {
  for (const k of SKILLS) assert.ok(SKILL_SYMBOLS[k.icon.replace(/^skill-/, '')], `${k.name} has a symbol (${k.icon})`);
  for (const slug of all) assert.ok(SKILL_SYMBOLS[slug], `${slug} is drawn`);
  for (const slug of Object.keys(SKILL_SYMBOLS)) assert.ok(all.includes(slug), `${slug} belongs to a class`);
  assert.equal(new Set(all).size, all.length, 'no slug twice');
  const looks = Object.values(SKILL_SYMBOLS).map((s) => s.rows.join('/'));
  assert.equal(new Set(looks).size, looks.length, 'no two skills drawn alike');
});

test('skill symbols are 10 rows of 10 columns, use known colours, and sit on a full disc', () => {
  for (const [id, s] of Object.entries(SKILL_SYMBOLS)) {
    assert.equal(s.rows.length, 10, `${id} rows`);
    for (const r of s.rows) {
      assert.equal(r.length, s.mirror ? 5 : 10, `${id} row width`);
      for (const ch of r) assert.ok(ch === '.' || pal[ch] !== undefined, `${id} colour ${ch}`);
    }
    const px = boonPixels(s, pal);
    assert.equal(px.w, BOON_SIZE); assert.equal(px.h, BOON_SIZE);
    const marks = s.rows.join('').replace(/\./g, '').length;
    assert.ok(marks >= 10, `${id} has something drawn on it (${marks} px)`);
  }
});
