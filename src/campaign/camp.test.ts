import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSim } from '../sim/state';
import { shopScreen } from './camp';
import { merchantLine } from '../data/story/hub';
import { storySafe } from '../data/storyFont';
import { stockFor } from '../data/wares';
import type { Screen } from './view';

/** The bitmap font: upgrade cards use its percent sign, which screen text spells out (see fontSafe). */
const FONT = /^[0-9A-Z:.\-/!+?% ]*$/;
const texts = (scr: Screen): string[] => {
  if (scr.kind === 'shop') return [scr.header, scr.sub, scr.footer, scr.note, ...scr.rows.flatMap((r) => [r.name, ...r.text]), ...scr.seats.map((s) => s.name)];
  return [];
};

test('the merchant screen fits the font, shows the stock and who can afford it, and the line changes with the story', () => {
  const sim = createSim(3, undefined, { offerSeed: 3, store: true });
  sim.gold = 100;
  const stock = stockFor(3, 0);
  const scr = shopScreen(sim, stock, [false, true, false, false], [0, 0, 0, 0], [false, false, false, false], 1, 'P1 BOUGHT SOMETHING');
  assert.equal(scr.kind, 'shop');
  if (scr.kind === 'shop') {
    assert.equal(scr.rows.length, 4);
    assert.equal(scr.rows[1].sold, true);
    assert.ok(scr.rows.some((r) => r.afford) && scr.rows.some((r) => !r.afford), 'a purse of 100 buys the scrolls but not the Lesson');
    assert.equal(scr.gold, 100);
    assert.equal(scr.seats[0].active, true);
  }
  if (scr.kind === 'shop') assert.equal(storySafe(scr.sub), scr.sub, 'the patter is read, so it is in the story font');
  for (const t of texts(scr).filter((x) => x !== (scr.kind === 'shop' ? scr.sub : ''))) assert.match(t, FONT, t);
  const byChapter = [1, 2, 3, 4, 5].map((c) => merchantLine(1, c));
  assert.equal(new Set(byChapter).size, 5);
  for (let seed = 0; seed < 20; seed++) for (let c = 1; c <= 5; c++) assert.match(merchantLine(seed, c).toUpperCase().replace(/[',"]/g, ''), FONT);
});
