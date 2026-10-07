import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLASSES } from '../data/classes';
import { BEATS } from '../data/story/beats';
import { AFTERMATH, boardGreeting, cityMood, CLASS_ORDER, HUB_SCENES, INTRO, registrarRemark, type Scene } from '../data/story/hub';
import { makeRunConfig, offerWrits } from './board';
import { campaignComplete, createLedger, hasSeen, type Ledger } from './ledger';
import { dueScenes, markSceneSeen, SCENES_PER_VISIT } from './scenes';
import { LEDGER_KEY, loadLedger } from './storage';
import { applyRunSummary, type RunSummary } from './summary';
import { storySafe } from '../data/storyFont';
import { boardScreen, fontSafe, scenePages, sceneScreen, speakers, summaryScreen, type Screen } from './view';

const FONT = /^[0-9A-Z:.\-/!+? ]*$/;
/** Lines of text that fit in a scene's text panel for one beat. */
const PAGE_LINES = 6;
const texts = (s: Scene) => s.lines.flatMap((l) => [l.text ?? '', ...Object.values(l.says ?? {})]);

function playOnce(l: Ledger, party: string[] = []): Ledger {
  const board = offerWrits(l);
  const writ = board.find((w) => w.milestone) ?? board[0];
  const cfg = makeRunConfig(l, writ);
  const sum: RunSummary = { outcome: 'won', offLedger: false, region: 'meadow', milestone: !!writ.milestone, reserved: cfg.reservedBeat?.id, beatsSeen: cfg.reservedBeat ? [cfg.reservedBeat.id] : [], slain: { goblin: 30 }, spared: {}, betrayed: 0, party };
  return applyRunSummary(l, sum);
}

test('every hub-tier beat has its scene, every played beat but the last two has an aftermath, and nothing else does', () => {
  for (const b of BEATS.filter((x) => x.tier === 'hub')) assert.ok(HUB_SCENES[b.id], `hub scene for ${b.id}`);
  for (const b of BEATS.filter((x) => x.tier !== 'hub' && x.id !== 'R11' && x.id !== 'R12')) assert.ok(AFTERMATH[b.id], `aftermath for ${b.id}`);
  for (const [id, sc] of Object.entries({ ...HUB_SCENES, ...AFTERMATH })) {
    assert.ok(BEATS.some((b) => b.id === sc.beat), id);
    assert.equal(sc.kind, id in HUB_SCENES ? 'beat' : 'aftermath');
  }
});

test('scene text can be drawn in the story font', () => {
  for (const sc of [...INTRO, ...Object.values(HUB_SCENES), ...Object.values(AFTERMATH)]) {
    for (const t of texts(sc)) {
      assert.equal(storySafe(t), t, `${sc.id}: ${t}`);
    }
    assert.match(fontSafe(sc.title), FONT);
    for (const l of sc.lines) {
      if (l.who === 'party') {
        const names = Object.keys(l.says ?? {});
        assert.ok(names.length >= 3, `${sc.id}: a party line needs several voices so any party has something to say`);
        for (const n of names) assert.ok(CLASSES.some((c) => c.name === n), `${sc.id}: ${n} is not a class`);
      } else assert.ok(l.text && l.text.length > 0);
    }
  }
});

test('class voices come from the party first, then the usual order, at most two', () => {
  const says = { warrior: 'a', mage: 'b', cleric: 'c', rogue: 'd', archer: 'e' };
  assert.deepEqual(speakers(says, ['archer', 'mage', 'rogue']), ['archer', 'mage']);
  assert.deepEqual(speakers(says, []), [CLASS_ORDER[0], CLASS_ORDER[1]]);
  assert.deepEqual(speakers({ mage: 'x', rogue: 'y' }, ['warrior', 'rogue']), ['rogue', 'mage']);
  assert.deepEqual(speakers(says, ['archer', 'archer']).length, 2);
});

test('a scene is a run of beats: each names its speakers, the place is set, and a page of text fits the panel', () => {
  const pages = scenePages(AFTERMATH.R1, ['archer', 'mage']);
  assert.equal(pages.length, AFTERMATH.R1.lines.length);
  const all = pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n');
  assert.match(all, /Archer:/);
  assert.match(all, /Mage:/);
  assert.match(all, /Registrar:/);
  const scr = sceneScreen(AFTERMATH.R1, ['archer', 'mage'], 1);
  assert.equal(scr.kind, 'scene');
  if (scr.kind === 'scene') {
    assert.equal(scr.backdrop, AFTERMATH.R1.backdrop);
    assert.equal(scr.page, 1);
    assert.equal(scr.pages, pages.length);
    assert.equal(scr.speaker, 'registrar');
    assert.match(scr.footer, /CONTINUE/);
  }
  for (const sc of [...INTRO, ...Object.values(HUB_SCENES), ...Object.values(AFTERMATH)]) {
    for (const party of [[], ['rogue'], ['warrior', 'cleric', 'mage', 'archer']]) {
      const ps = scenePages(sc, party);
      assert.ok(ps.length >= 3, `${sc.id}: a scene has a few beats`);
      for (const p of ps) assert.ok(p.lines.length >= 1 && p.lines.length <= PAGE_LINES, `${sc.id}: ${p.lines.length} lines in one beat`);
      const last = sceneScreen(sc, party, ps.length - 1);
      if (last.kind === 'scene') assert.match(last.footer, /FINISH/, 'the last beat says it ends the scene');
    }
  }
});

test('dueScenes: aftermath of what played, then the pending hub beat, two at a time, each exactly once', () => {
  let l = createLedger(3);
  assert.deepEqual(dueScenes(l).map((s) => s.id), INTRO.map((s) => s.id), 'a fresh save opens with the intro, both scenes in one visit');
  l = INTRO.reduce(markSceneSeen, l);
  assert.deepEqual(dueScenes(l), []);
  l = playOnce(l); l = playOnce(l);                       // R1 plays in the second Writ
  assert.ok(hasSeen(l, 'R1'));
  assert.deepEqual(dueScenes(l).map((s) => s.id), ['R1:after']);
  l = markSceneSeen(l, AFTERMATH.R1);
  assert.deepEqual(dueScenes(l), []);
  assert.equal(markSceneSeen(l, AFTERMATH.R1), l, 'marking twice changes nothing');
  assert.ok(SCENES_PER_VISIT === 2);
});

test('a whole campaign: every scene shows exactly once, in story order, and a hub beat is played by seeing it', () => {
  let l = createLedger(21);
  const shown: string[] = [];
  let guard = 0;
  while (!campaignComplete(l) && guard++ < 80) {
    l = playOnce(l, ['warrior', 'cleric']);
    for (let k = 0; k < 4; k++) {
      const due = dueScenes(l);
      assert.ok(due.length <= SCENES_PER_VISIT);
      if (!due.length) break;
      for (const sc of due) { shown.push(sc.id); l = markSceneSeen(l, sc); }
    }
  }
  assert.ok(campaignComplete(l));
  assert.equal(new Set(shown).size, shown.length, 'no repeats');
  const expected = BEATS.filter((b) => HUB_SCENES[b.id] || AFTERMATH[b.id]).map((b) => HUB_SCENES[b.id]?.id ?? AFTERMATH[b.id].id);
  assert.deepEqual(shown, [...INTRO.map((s) => s.id), ...expected]);
});

test('the Registrar remarks differently by chapter and result, and notices mercy and betrayal from chapter II', () => {
  const ctx = (chapter: number, outcome: 'won' | 'lost' | 'retreat', spared = 0, betrayed = 0) => ({ chapter, outcome, spared, betrayed });
  for (let ch = 1; ch <= 5; ch++) {
    assert.equal(registrarRemark(1, ctx(ch, 'won')).length, 1);
    assert.deepEqual(registrarRemark(9, ctx(ch, 'lost')), registrarRemark(9, ctx(ch, 'lost')));
    assert.notDeepEqual(registrarRemark(1, ctx(ch, 'won')), registrarRemark(1, ctx(ch, 'lost')));
    for (const t of [...registrarRemark(4, ctx(ch, 'won', 3, 0)), ...registrarRemark(4, ctx(ch, 'won', 0, 2))]) assert.match(fontSafe(t), FONT);
  }
  assert.equal(registrarRemark(1, ctx(1, 'won', 5, 5)).length, 1, 'chapter I has no remark on mercy');
  assert.equal(registrarRemark(1, ctx(2, 'won', 5, 0)).length, 2);
  assert.equal(registrarRemark(1, ctx(3, 'won', 0, 4)).length, 2);
  const lines = new Set(Array.from({ length: 60 }, (_, i) => registrarRemark(i, ctx(2, 'won'))[0]));
  assert.ok(lines.size >= 4, 'variety');
});

test('the board greets differently each visit and the city mood follows the mercy shown', () => {
  const greetings = new Set(Array.from({ length: 50 }, (_, i) => boardGreeting(i, 3)));
  assert.ok(greetings.size >= 4);
  for (let ch = 1; ch <= 5; ch++) {
    const moods = [cityMood(ch, 0, 1000), cityMood(ch, 200, 1000), cityMood(ch, 800, 1000)];
    assert.equal(new Set(moods).size >= 2, true, `chapter ${ch}`);
    assert.equal(cityMood(ch, 0, 0), moods[0], 'no tally yet is the low band');
  }
  let l = createLedger(5);
  const a = boardScreen(l, offerWrits(l), 0);
  l = { ...l, slain: { goblin: 100 }, spared: { goblin: 80 } };
  const b = boardScreen(l, offerWrits(l), 0);
  assert.ok(a.kind === 'board' && b.kind === 'board' && a.mood !== b.mood);
  if (a.kind === 'board') { assert.equal(storySafe(a.sub), a.sub); assert.equal(storySafe(a.mood), a.mood); }
});

test('the summary carries the Registrars remark in Registrar gold, and the party is remembered', () => {
  let l = createLedger(8);
  l = playOnce(l, ['rogue', 'archer']);
  assert.deepEqual(l.party, ['rogue', 'archer']);
  l = playOnce(l, []);
  assert.deepEqual(l.party, ['rogue', 'archer'], 'an empty party does not erase the last one');
  const board = offerWrits(l);
  const cfg = makeRunConfig(l, board[0]);
  const sum: RunSummary = { outcome: 'won', offLedger: false, region: 'meadow', milestone: false, beatsSeen: [], slain: { goblin: 5 }, spared: {}, betrayed: 0, party: [] };
  const scr = summaryScreen(sum, cfg, l, l, 10) as Extract<Screen, { kind: 'text' }>;
  assert.ok(scr.body.some((b) => b.text.startsWith('Registrar:') && b.tone === 'gold'));
});

test('older saves load with no scenes shown and no party', () => {
  const raw = JSON.stringify({ v: 1, chapter: 2, campaignSeed: 5, beatsSeen: ['R1', 'warlord'] });
  const r = loadLedger({ getItem: (k) => (k === LEDGER_KEY ? raw : null), setItem: () => {} }, () => 1);
  assert.deepEqual(r.ledger.scenes, []);
  assert.deepEqual(r.ledger.party, []);
});
