import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GLYPH_H, STORY_CHARS, STORY_GLYPHS, glyphWidth, storySafe, storyWidth } from './storyFont';

test('every glyph is well formed: one width, set and clear pixels only, nothing taller than the cell', () => {
  for (const [ch, rows] of Object.entries(STORY_GLYPHS)) {
    assert.ok(rows.length >= 1 && rows.length <= GLYPH_H, `${ch}: ${rows.length} rows`);
    const w = Math.max(...rows.map((r) => r.length));
    assert.ok(w >= 1 && w <= 5, `${ch}: width ${w}`);
    assert.ok(rows.some((r) => r.includes('#')), `${ch} has no pixels`);
    for (const r of rows) {
      assert.match(r, /^[#.]*$/, `${ch}: ${r}`);
      assert.ok(r.length === 0 || r.length === w, `${ch}: ragged row "${r}"`);
    }
  }
});

test('the font draws every printable ASCII character a writer is likely to use, and nothing is missing from a sentence', () => {
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?'\":;-+/()%&=<>[]*_") assert.ok(STORY_CHARS.includes(ch), `missing ${ch}`);
  const s = "The Registrar's remark: \"Efficient.\" (Pay is 25% more; don't ask!)";
  assert.equal(storySafe(s), s);
});

test('widths: proportional, a space is narrow, and storySafe turns the rest into something drawable', () => {
  assert.ok(glyphWidth('i') < glyphWidth('m'));
  assert.ok(glyphWidth(' ') < glyphWidth('a'));
  assert.equal(storyWidth(''), 0);
  assert.equal(storyWidth('ab'), glyphWidth('a') + glyphWidth('b') + 1);
  assert.equal(storySafe('“quoted” — ‘it’ …'), '"quoted" - \'it\' ...');
  assert.equal(storySafe('snow☃man'), 'snow?man');
  assert.equal(storySafe('tab\there'), 'tab?here');
});

test('lowercase letters with tails descend below the baseline, the rest sit on it', () => {
  for (const ch of 'gjpqy') assert.ok(STORY_GLYPHS[ch].length > 7, `${ch} should descend`);
  for (const ch of 'abcdefhiklmnorstuvwxz') assert.ok(STORY_GLYPHS[ch].length <= 7, `${ch} should sit on the baseline`);
});
