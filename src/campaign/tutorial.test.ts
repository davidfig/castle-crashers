import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Btn, createInputFrame, type InputFrame } from '../sim/input';
import { Kind } from '../sim/entities';
import { step } from '../sim/step';
import { createSim, type GameState } from '../sim/state';
import { STREAM_DELAY_TICKS } from '../sim/gen/level';
import { createTutorial, markTutorialSeen, tutorialSeen, tutorialView, updateTutorial, SKIP_TICKS, TUTORIAL_STEPS } from './tutorial';

const idle = (): InputFrame[] => [0, 1, 2, 3].map(createInputFrame);

function mobsOf(s: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.ents.highWater; i++) if (s.ents.alive[i] && s.ents.kind[i] === Kind.Mob) out.push(i);
  return out;
}

/** A player who does what the card asks: walk toward the nearest enemy and press every button in turn. */
function drive(s: GameState, n: number): InputFrame[] {
  const f = idle();
  const e = s.ents, me = s.players[0].ent;
  const near = mobsOf(s).sort((a, b) => Math.abs(e.x[a] - e.x[me]) - Math.abs(e.x[b] - e.x[me]))[0];
  if (near === undefined) f[0].moveX = 127; // nothing to fight: walk on
  else {
    f[0].moveX = e.x[near] > e.x[me] + 20 ? 127 : e.x[near] < e.x[me] - 20 ? -127 : 0;
    f[0].moveY = e.y[near] > e.y[me] + 6 ? 127 : e.y[near] < e.y[me] - 6 ? -127 : 0;
  }
  const phase = Math.floor(n / 6) % 8; // each button is held for 6 ticks, then released, so every press is an edge
  if (phase === 0) f[0].buttons = Btn.Attack;
  else if (phase === 2) f[0].buttons = Btn.Ability1;
  else if (phase === 4) f[0].buttons = Btn.Ability2;
  else if (phase === 6) f[0].buttons = Btn.Dodge;
  return f;
}

test('the tutorial holds the planned encounters back, and walks a hero through every step', () => {
  const s = createSim(11);
  s.tutorialHold = true;
  const t = createTutorial();
  const seen = new Set<number>();
  for (let n = 0; n < 60 * 60 * 5 && !t.over; n++) {
    const frames = drive(s, n);
    step(s, frames);
    updateTutorial(t, s, frames);
    if (!t.over) seen.add(t.step);
    assert.equal(s.nextClump, 0, 'no planned encounter streams in while the tutorial runs');
    assert.ok(mobsOf(s).length <= 8, 'and no reinforcements or flank packs come either: only the tutorial\'s own small waves');
  }
  assert.ok(t.over, 'the tutorial finishes');
  assert.equal(seen.size, TUTORIAL_STEPS, 'every step is shown');
});

test('a step does not end while its enemies live, and the next one waits for a breath', () => {
  const s = createSim(11);
  s.tutorialHold = true;
  const t = createTutorial();
  for (let n = 0; n < 600 && t.gap === 0; n++) { const f = idle(); f[0].moveX = 127; step(s, f); updateTutorial(t, s, f); }
  assert.equal(t.gap > 0, true, 'walking far enough finishes the first step');
  for (let n = 0; n < 200 && t.step === 0; n++) { const f = idle(); step(s, f); updateTutorial(t, s, f); }
  assert.equal(t.step, 1);
  // the attack step's goblins are out there and the hero has done nothing yet
  for (let n = 0; n < 5; n++) { const f = idle(); step(s, f); updateTutorial(t, s, f); }
  assert.ok(mobsOf(s).length > 0, 'the wave is on the field');
  assert.equal(t.gap, 0);
});

test('the skip button, held, ends it', () => {
  const s = createSim(11);
  s.tutorialHold = true;
  const t = createTutorial();
  for (let n = 0; n < SKIP_TICKS - 2; n++) { const f = idle(); f[0].buttons = Btn.Interact; step(s, f); updateTutorial(t, s, f); }
  assert.equal(t.over, false);
  for (let n = 0; n < 4; n++) { const f = idle(); f[0].buttons = Btn.Interact; step(s, f); updateTutorial(t, s, f); }
  assert.equal(t.over, true);
});

test('without the hold the field streams in as usual', () => {
  const s = createSim(11);
  for (let n = 0; n < STREAM_DELAY_TICKS + 400; n++) step(s, idle());
  assert.ok(s.nextClump > 0);
});

test('the view names each hero\'s button and the move, and falls back for an unclaimed device', () => {
  const s = createSim(11);
  const t = createTutorial();
  const v = tutorialView(t, s, (slot, a) => (slot === 0 ? `${a}-key` : ''));
  assert.equal(v.title, 'MOVE');
  assert.equal(v.keys[0].label, 'move-key');
  assert.equal(tutorialView(t, s, () => '').keys[0].label, 'WASD');
  assert.equal(v.count, `1 / ${TUTORIAL_STEPS}`);
});

test('it is remembered once seen, and blocked storage just means it plays again', () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.equal(tutorialSeen(store), false);
  markTutorialSeen(store);
  assert.equal(tutorialSeen(store), true);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(tutorialSeen(blocked), false);
  assert.doesNotThrow(() => markTutorialSeen(blocked));
  assert.equal(tutorialSeen(undefined), false);
});
