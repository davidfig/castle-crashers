import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateParty } from '../data/heroes';
import { HERO_VARIANTS } from '../data/heroes/roll';
import { CLASS_KITS, HERO_CLASS_NAMES } from '../data/heroLook';
import { composeHero } from './heroArt';
import { heroSheets } from './heroSprites';
import { packSheets } from './monsterSprites';
import { HERO_SLOTS } from './hero';

const hash = (rgba: Uint8ClampedArray): number => { let h = 0; for (const b of rgba) h = (Math.imul(h, 31) + b) | 0; return h; };

test('a party is a pure function of the seed, and the next seed has other people', () => {
  const a = generateParty(7), b = generateParty(7), c = generateParty(8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.people, c.people);
  assert.equal(hash(composeHero(a.looks[0][0]).rgba), hash(composeHero(b.looks[0][0]).rgba));
});

test('every hero keeps the class-defining parts: a kit for the class, in the player colour, whoever the person is', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const party = generateParty(seed);
    party.looks.forEach((row, slot) => row.forEach((look, c) => {
      assert.equal(look.cls, HERO_CLASS_NAMES[c]);
      assert.ok(CLASS_KITS[look.cls].head && CLASS_KITS[look.cls].weapon);
      // the person under the class is the slot's own, whichever class they wear
      assert.equal(look.body.palette.skin, party.people[slot].palette.skin);
      assert.equal(look.body.palette.cloth, party.people[slot].palette.cloth);
      assert.equal(look.pal.cloth, party.colors[slot].cloth);
      const v = HERO_VARIANTS[look.cls];
      assert.ok(look.hat < v.hat && look.weapon < v.weapon && look.off < v.off && look.adorn < v.adorn);
    }));
  }
});

test('a party\'s four colours are well apart on the hue wheel, and differ from run to run', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const hues = generateParty(seed).colors.map((c) => c.hue);
    seen.add(hues.map((h) => Math.round(h / 20)).join());
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const d = Math.abs(hues[i] - hues[j]) % 360;
      assert.ok(Math.min(d, 360 - d) >= 45, `seed ${seed}: hues ${hues.map(Math.round)}`);
    }
  }
  assert.ok(seen.size > 150, 'new colours nearly every run');
});

test('the four players of a class are told apart by their person and colour, not by the class', () => {
  const rows = generateParty(3).looks;
  for (let c = 0; c < HERO_CLASS_NAMES.length; c++) {
    const hashes = new Set(rows.map((r) => hash(composeHero(r[c]).rgba)));
    assert.equal(hashes.size, HERO_SLOTS, `${HERO_CLASS_NAMES[c]}: four different pictures`);
  }
});

test('sheets carry every animation the game drives, and the four slots of a class share a cell and pivot', () => {
  const sheets = heroSheets(generateParty(5));
  assert.equal(sheets.length, HERO_CLASS_NAMES.length * HERO_SLOTS);
  HERO_CLASS_NAMES.forEach((cls, c) => {
    for (let s = 0; s < HERO_SLOTS; s++) {
      const sh = sheets[c * HERO_SLOTS + s];
      for (const name of ['idle', 'walk', 'sweep', 'finisher', 'recover', 'cast', 'hurt', 'down']) {
        const a = sh.anims[name];
        assert.ok(a && a.frames.length > 0 && a.ms.length === a.frames.length, `${cls} lacks ${name}`);
        for (const f of a.frames) assert.ok(sh.frames[f], `${cls} ${name} frame ${f}`);
      }
      assert.deepEqual(sh.pivot, sheets[c * HERO_SLOTS].pivot, `${cls} slot ${s} pivot`);
      assert.equal(sh.top > 8 && sh.top < 40, true, `${cls} top ${sh.top}`);
    }
  });
  assert.ok(sheets[HERO_CLASS_NAMES.indexOf('mage') * HERO_SLOTS].anims.shoot, 'the mage casts a spark');
});

test('the generated heroes pack into the atlas band', () => {
  for (let seed = 1; seed <= 12; seed++) assert.ok(packSheets(heroSheets(generateParty(seed)), 2048, 640), `seed ${seed}`);
});
