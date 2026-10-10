import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BEATS } from '../data/story/beats';
import { MOBS } from '../data/mobs';
import { createSim, Phase } from '../sim/state';
import { hashState } from '../sim/hash';
import { beatPlayed, slainByName, summarizeRun, outcomeOf } from './run';
import { spawnClump } from '../sim/gen/level';
import { allocEntity, Kind, SURRENDERED } from '../sim/entities';
import { boardScreen, epitaph, fontSafe, sceneScreen, summaryScreen, wrap, type Screen } from './view';
import { writFromSeed } from '../data/story/writs';

import { offerWrits, makeRunConfig, offLedgerConfig, reservedBeatFor } from './board';
import { campaignComplete, createLedger, hasSeen, hubBeats, markBeatsSeen, pendingBeat, type Ledger } from './ledger';
import { applyRunSummary, type Outcome, type RunSummary } from './summary';
import { dueScenes, markSceneSeen } from './scenes';
import { storySafe } from '../data/storyFont';
import { LEDGER_KEY, loadLedger, saveLedger, serializeLedger, type KeyValueStore } from './storage';

function summary(over: Partial<RunSummary> = {}): RunSummary {
  return { outcome: 'won', offLedger: false, region: 'meadow', milestone: false, beatsSeen: [], slain: { goblin: 10 }, spared: {}, betrayed: 0, party: [], ...over };
}
/** Plays one run the way the shell will: pick the milestone Writ if offered, else the first; report what was reserved. */
function playRun(l: Ledger, outcome: Outcome = 'won', reachBeat = true): Ledger {
  const board = offerWrits(l);
  const writ = board.find((w) => w.milestone) ?? board[0];
  const cfg = makeRunConfig(l, writ);
  const id = cfg.reservedBeat?.id;
  return applyRunSummary(l, summary({
    outcome, milestone: !!writ.milestone, reserved: id,
    beatsSeen: id && reachBeat ? [id] : [],
  }));
}
function hub(l: Ledger): Ledger {
  return dueScenes(l).reduce(markSceneSeen, l);
}

test('a new campaign has nothing pending until a Writ is won', () => {
  const l = createLedger(1);
  assert.equal(pendingBeat(l), undefined);
  const after = applyRunSummary(l, summary());
  assert.equal(pendingBeat(after)?.id, 'R1');
  assert.equal(after.chapterWrits, 1);
  assert.equal(after.runs, 1);
  assert.equal(after.slain.goblin, 10);
  assert.equal(after.regions.meadow, 'cleared');
});

test('applying a summary never mutates the old ledger', () => {
  const l = createLedger(1);
  const snap = JSON.stringify(l);
  applyRunSummary(l, summary({ slain: { orc: 3 } }));
  assert.equal(JSON.stringify(l), snap);
});

test('a perfect run through the campaign hits every beat once, in order, in a plausible number of runs', () => {
  let l = createLedger(42);
  const order: string[] = [];
  let runs = 0;
  while (!campaignComplete(l) && runs < 100) {
    const before = l.beatsSeen.length;
    l = hub(playRun(l));
    runs++;
    order.push(...l.beatsSeen.slice(before));
  }
  assert.ok(campaignComplete(l));
  assert.deepEqual(order.filter((id) => id !== 'R12'), BEATS.map((b) => b.id).filter((id) => id !== 'R12'));
  assert.equal(new Set(l.beatsSeen).size, l.beatsSeen.length);
  assert.ok(runs >= 12 && runs <= 25, `${runs} runs`);
});

test('the story cannot be skipped: a bogus summary claiming later beats changes nothing', () => {
  const l = createLedger(1);
  const after = applyRunSummary(l, summary({ beatsSeen: ['R7', 'R11', 'warlord'] }));
  assert.deepEqual(after.beatsSeen, []);
  assert.equal(after.chapter, 1);
});

test('a beat is reserved for the run, a missed one carries over, and two misses move it earlier', () => {
  let l = applyRunSummary(createLedger(5), summary());
  const writ = offerWrits(l)[0];
  assert.equal(reservedBeatFor(l, writ)?.id, 'R1');
  assert.equal(reservedBeatFor(l, writ)?.early, false);
  l = playRun(l, 'lost', false);
  assert.equal(pendingBeat(l)?.id, 'R1');
  assert.equal(l.missed.R1, 1);
  assert.equal(reservedBeatFor(l, offerWrits(l)[0])?.early, false);
  l = playRun(l, 'lost', false);
  assert.equal(l.missed.R1, 2);
  assert.equal(reservedBeatFor(l, offerWrits(l)[0])?.early, true);
  l = playRun(l, 'lost', true);
  assert.ok(hasSeen(l, 'R1'));
  assert.equal(l.missed.R1, undefined);
});

test('a run beat that played counts even if the party then lost the run', () => {
  const l = applyRunSummary(createLedger(5), summary());
  const w = offerWrits(l)[0];
  const after = applyRunSummary(l, summary({ outcome: 'lost', reserved: reservedBeatFor(l, w)?.id, beatsSeen: ['R1'] }));
  assert.ok(hasSeen(after, 'R1'));
  assert.equal(after.chapterWrits, 1, 'a lost run is not a won Writ');
});

test('a milestone only counts when it is won, and the chapter turns when it is', () => {
  let l = createLedger(9);
  l = playRun(l); l = playRun(l);                     // R1 played, two Writs won
  assert.equal(pendingBeat(l)?.id, 'warlord');
  const board = offerWrits(l);
  assert.equal(board.filter((w) => w.milestone).length, 1);
  assert.equal(board[0].milestone, 'warlord');
  const lost = playRun(l, 'lost');
  assert.equal(pendingBeat(lost)?.id, 'warlord');
  assert.equal(lost.chapter, 1);
  const won = playRun(l, 'won');
  assert.equal(won.chapter, 2);
  assert.equal(won.chapterWrits, 0);
});

test('the board: three distinct Writs, stable until a run finishes, milestone only when due', () => {
  let l = createLedger(77);
  const a = offerWrits(l);
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((w) => w.clan.place)).size, 3);
  assert.deepEqual(offerWrits(l), a);
  assert.ok(a.every((w) => !w.milestone));
  const l2 = applyRunSummary(l, summary());
  assert.notDeepEqual(offerWrits(l2).map((w) => w.seed), a.map((w) => w.seed));
  l = playRun(playRun(l));
  assert.equal(offerWrits(l)[0].milestone, 'warlord');
  assert.equal(offerWrits(l).slice(1).filter((w) => w.milestone).length, 0);
});

test('reserved beats: run beats ride ordinary Writs, milestone beats only their own Writ, hub beats never', () => {
  let l = applyRunSummary(createLedger(3), summary());
  for (const w of offerWrits(l)) assert.equal(reservedBeatFor(l, w)?.id, 'R1');
  l = playRun(l);
  const board = offerWrits(l);
  assert.equal(reservedBeatFor(l, board[0])?.id, 'warlord');
  assert.equal(reservedBeatFor(l, board[0])?.node, 'boss');
  assert.equal(reservedBeatFor(l, board[1]), undefined);
  assert.equal(reservedBeatFor(l, board[0])?.at, 'spine');
});

test('hub beats are due after any outcome and capped per visit', () => {
  let l = createLedger(8);
  let guard = 0;
  while (pendingBeat(l)?.tier !== 'hub' && guard++ < 60) l = playRun(l);
  const due = hubBeats(l);
  assert.equal(due.length >= 1 && due.length <= 2, true);
  assert.equal(due[0].tier, 'hub');
  assert.equal(hubBeats(l, 0).length, 0);
});

test('off-ledger runs cannot touch the campaign', () => {
  const l = createLedger(1);
  const cfg = offLedgerConfig(123);
  assert.equal(cfg.offLedger, true);
  assert.equal(cfg.reservedBeat, undefined);
  assert.equal(applyRunSummary(l, summary({ offLedger: true, beatsSeen: ['R1'] })), l);
});

function memStore(init?: string): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (init !== undefined) data.set(LEDGER_KEY, init);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

test('storage: round trip, and a fresh ledger when nothing is stored', () => {
  const store = memStore();
  const fresh = loadLedger(store, () => 99);
  assert.equal(fresh.status, 'new');
  assert.equal(fresh.writable, true);
  assert.equal(fresh.ledger.campaignSeed, 99);
  const played = playRun(playRun(fresh.ledger));
  assert.ok(saveLedger(store, played));
  const back = loadLedger(store, () => 1);
  assert.equal(back.status, 'ok');
  assert.deepEqual(back.ledger, played);
});

test('storage: corrupt, newer and unavailable stores are never overwritten', () => {
  assert.deepEqual(['{nope', '[]', '{"v":1}', JSON.stringify({ ...createLedger(1), chapter: 99 })].map((t) => loadLedger(memStore(t), () => 1).status), ['corrupt', 'corrupt', 'corrupt', 'corrupt']);
  const newer = loadLedger(memStore(JSON.stringify({ ...createLedger(1), v: 2 })), () => 1);
  assert.equal(newer.status, 'newer');
  assert.equal(newer.writable, false);
  const throwing: KeyValueStore = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const blocked = loadLedger(throwing, () => 1);
  assert.equal(blocked.status, 'unavailable');
  assert.equal(blocked.writable, false);
  assert.equal(saveLedger(throwing, blocked.ledger), false);
  assert.equal(saveLedger(undefined, blocked.ledger), false);
});

test('storage: missing or junk optional fields are repaired, not trusted', () => {
  const raw = JSON.stringify({ v: 1, chapter: 2, campaignSeed: 5, beatsSeen: ['R1', 4, 'warlord'], slain: { goblin: 3, bad: 'x', neg: -1 }, regions: { meadow: 'cleared', x: 'bogus' } });
  const r = loadLedger(memStore(raw), () => 1);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.ledger.beatsSeen, ['R1', 'warlord']);
  assert.deepEqual(r.ledger.slain, { goblin: 3 });
  assert.deepEqual(r.ledger.regions, { meadow: 'cleared' });
  assert.equal(r.ledger.runs, 0);
  assert.equal(serializeLedger(r.ledger).includes('"v":1'), true);
});

// --- run summary + screens

test('summarizeRun reports heads by name, the outcome, and the reserved beat only once it played', () => {
  let l = applyRunSummary(createLedger(5), summary());
  const writ = offerWrits(l)[0];
  const cfg = makeRunConfig(l, writ);
  const s = createSim(writ.seed, cfg.reservedBeat);
  s.slain[0] = 12; s.slain[1] = 3;
  s.phase = Phase.Won;
  const sum = summarizeRun(s, cfg, false);
  assert.deepEqual(sum.slain, { [MOBS[0].name]: 12, [MOBS[1].name]: 3 });
  assert.equal(sum.outcome, 'won');
  assert.equal(sum.reserved, 'R1');
  assert.deepEqual(sum.beatsSeen, [], 'the party never reached the camp, so R1 did not play (a win does not make it so)');
  assert.deepEqual(sum.spared, {});
  spawnClump(s, s.beatIndex, 1);
  s.beatPlayedTick = 100;
  const played = summarizeRun(s, cfg, false);
  assert.deepEqual(played.beatsSeen, ['R1']);
  assert.ok(played.spared.goblin >= 3 && played.spared.goblin <= 5, 'the bystanders still standing');
  s.phase = Phase.Playing;
  assert.equal(outcomeOf(s, true), 'retreat');
  assert.deepEqual(summarizeRun(s, cfg, true).beatsSeen, ['R1'], 'a beat that played counts even if the party then retreats');
  l = applyRunSummary(l, played);
  assert.ok(hasSeen(l, 'R1'));
  assert.equal(l.spared.goblin, played.spared.goblin);
});

test('beats the battlefield does not stage yet follow the interim rule: played on a win, never on a loss', () => {
  const s = createSim(1);
  s.phase = Phase.Won;
  assert.equal(beatPlayed(s, 'R2', 'won', true), true);
  assert.equal(beatPlayed(s, 'R2', 'lost', true), false);
  assert.equal(beatPlayed(s, 'R2', 'won', false), false);
  assert.equal(beatPlayed(s, 'warlord', 'won', true), false, 'the Warlord milestone needs the Warlord dead');
  s.bossDeadTick = 10;
  assert.equal(beatPlayed(s, 'warlord', 'won', false), true);
});

test('slain counts are part of the state hash, so two runs that killed differently differ', () => {
  const a = createSim(7), b = createSim(7);
  assert.equal(hashState(a), hashState(b));
  b.slain[2] = 1;
  assert.notEqual(hashState(a), hashState(b));
  assert.deepEqual(slainByName(a), {});
});

function everyChar(scr: Screen): string[] {
  if (scr.kind === 'board') return [scr.header, scr.sub, scr.footer, ...scr.cards.flatMap((c) => [c.title, c.tag ?? '', ...c.lines])];
  if (scr.kind === 'select') return [scr.header, scr.sub, scr.footer, ...scr.slots.flatMap((sl) => [sl.name, ...sl.blurb])];
  if (scr.kind === 'picks') return [scr.header, scr.sub, scr.footer, ...scr.lanes.flatMap((l) => [l.name, ...l.cards.flatMap((c) => [c.name, ...c.text])])];
  if (scr.kind === 'doors') return [scr.header, scr.sub, scr.footer, ...scr.doors.flatMap((d) => [d.label, d.tag])];
  if (scr.kind === 'scene') return [scr.header, scr.footer, ...scr.lines.map((l) => l.text)];
  if (scr.kind === 'title') return [];
  return [scr.header, scr.footer, ...scr.body.map((b) => b.text)];
}
const FONT = /^[0-9A-Z:.\-/!+? ]*$/;

test('every screen the campaign can show uses only characters the bitmap font has', () => {
  let l = createLedger(11);
  let guard = 0;
  while (!campaignComplete(l) && guard++ < 60) {
    const before = l;
    const board = offerWrits(l);
    const bs = boardScreen(l, board, 0);
    if (bs.kind === 'board') {
      for (const t of [bs.header, bs.footer]) assert.match(t, FONT, t);
      for (const t of [bs.sub, bs.mood, ...bs.cards.flatMap((c) => [c.title, ...c.lines])]) assert.equal(storySafe(t), t, 'a notice is read, so it is in the story font');
    }
    const writ = board.find((w) => w.milestone) ?? board[0];
    const cfg = makeRunConfig(l, writ);
    const sum = summary({ milestone: !!writ.milestone, reserved: cfg.reservedBeat?.id, beatsSeen: cfg.reservedBeat ? [cfg.reservedBeat.id] : [], slain: { goblin: 40, orc: 2 } });
    l = applyRunSummary(l, sum);
    for (const t of everyChar(summaryScreen(sum, cfg, before, l, 123))) assert.equal(storySafe(t), t, t);
    for (const sc of dueScenes(l)) for (const t of everyChar(sceneScreen(sc, l.party))) assert.equal(storySafe(t), t, t);
    l = hub(l);
  }
  assert.ok(campaignComplete(l));
});

test('the summary reveals the people you fought a little more each chapter', () => {
  const w = (ch: number) => writFromSeed(3, ch);
  assert.deepEqual(epitaph(w(1)), []);
  assert.equal(epitaph(w(2)).length, 1);
  assert.equal(epitaph(w(3)).length, 3);
  assert.ok(epitaph(w(3))[2].length > 10);
});

test('fontSafe and wrap', () => {
  assert.equal(fontSafe("The Warlord's Writ, 125%"), 'THE WARLORDS WRIT 125 PCT');
  assert.deepEqual(wrap('aa bb cc dd', 5), ['aa bb', 'cc dd']);
  assert.deepEqual(wrap('', 5), []);
});

test('spared and betrayed travel from the sim to the summary and the Ledger', () => {
  const l0 = applyRunSummary(createLedger(5), summary());
  const cfg = makeRunConfig(l0, offerWrits(l0)[0]);
  const s = createSim(cfg.seed, undefined, { surrender: true });
  s.spared[0] = 4;
  s.betrayed = 2;
  const kneeling = allocEntity(s.ents, Kind.Mob, 1, 200, 100, 30);
  s.ents.flags[kneeling] = SURRENDERED;
  s.phase = Phase.Won;
  const sum = summarizeRun(s, cfg, false);
  assert.deepEqual(sum.spared, { [MOBS[0].name]: 4, [MOBS[1].name]: 1 });
  assert.equal(sum.betrayed, 2);
  const l1 = applyRunSummary(l0, sum);
  assert.equal(l1.betrayed, 2);
  assert.equal(l1.spared[MOBS[0].name], 4);
  assert.equal(applyRunSummary(l1, sum).betrayed, 4);
  const scr = summaryScreen(sum, cfg, l0, l1, 10);
  const text = everyChar(scr).join(' | ');
  assert.match(text, /Spared: 5/);
  assert.match(text, /2 had surrendered/);
  for (const t of everyChar(scr)) assert.equal(storySafe(t), t, 'the story font can draw it');
});

test('an old save without betrayed loads with zero', () => {
  const raw = JSON.stringify({ v: 1, chapter: 2, campaignSeed: 5, beatsSeen: ['R1', 'warlord'] });
  const r = loadLedger(memStore(raw), () => 1);
  assert.equal(r.status, 'ok');
  assert.equal(r.ledger.betrayed, 0);
});

test('every class blurb on the select screen fits its card in the story font', async () => {
  const { BLURB } = await import('./view');
  const { storyWidth } = await import('../data/storyFont');
  const { CLASSES } = await import('../data/classes');
  for (const c of CLASSES) {
    const lines = BLURB[c.name];
    assert.ok(lines && lines.length >= 3 && lines.length <= 4, `${c.name} needs 3-4 note lines`);
    for (const l of lines) {
      assert.match(l, /^[0-9A-Z:.\-/!+?, ]*$/, `${c.name}: ${l}`);
      assert.ok(storyWidth(l) <= 130, `${c.name}: "${l}" is ${storyWidth(l)}px wide`);
    }
  }
});
