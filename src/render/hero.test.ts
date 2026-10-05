import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../data/classes';
import { Btn, createInputFrame, type InputFrame } from '../sim/input';
import { createSim } from '../sim/state';
import { step } from '../sim/step';
import { Kind } from '../sim/entities';
import { Fx, SLASH_TICKS } from './fx';
import { buildHeroSet, heroFrame, type HeroSet } from './hero';

// Fake atlas placement: four sheets stacked 320px apart. Frames only need to be distinguishable by identity.
const set: HeroSet = buildHeroSet([0, 1, 2, 3].map((k) => ({ x: 0, y: k * 321 })), 512, 2048);
const idle = () => [0, 1, 2, 3].map(createInputFrame);
const press = (buttons: number): InputFrame[] => { const f = idle(); f[0].buttons = buttons; return f; };

function arena() {
  const s = createSim(1);
  const e = s.ents;
  for (let i = 0; i < e.highWater; i++) if (e.kind[i] === Kind.Mob) e.alive[i] = 0;
  s.spawnTimer = 1e9;
  const pe = s.players[0].ent;
  e.x[pe] = 100; e.y[pe] = 100; e.px[pe] = 100; e.py[pe] = 100;
  return { s, fx: new Fx() };
}

/** One sim tick, then let presentation consume events and advance one tick. */
function tick(s: ReturnType<typeof arena>['s'], fx: Fx, input: InputFrame[]) {
  step(s, input);
  fx.consume(s.events);
  fx.update(1);
}

test('hero atlas frames: every animation exists with a duration per frame', () => {
  for (const slot of [0, 1, 2, 3]) {
    for (const name of ['idle', 'walk', 'sweep', 'finisher', 'recover', 'cast', 'hurt', 'down']) {
      const a = set.anims[slot][name];
      assert.ok(a && a.frames.length > 0, `${name} missing for slot ${slot}`);
      assert.equal(a.ms.length, a.frames.length);
    }
  }
  assert.ok(set.pivotY > 0 && set.top > 0);
});

test('a light swing sweeps the blade through the sweep frames over the slash-arc duration, then recovers', () => {
  const { s, fx } = arena();
  const A = set.anims[0];
  tick(s, fx, press(Btn.Attack)); // swing lands; the arc starts
  const seen: unknown[] = [heroFrame(set, s, fx, 0, false)];
  for (let t = 1; t < SLASH_TICKS; t++) { tick(s, fx, idle()); seen.push(heroFrame(set, s, fx, 0, false)); }
  const sweep = A.sweep.frames;
  // the first frame is an end of the sweep (forward or reversed depending on the alternating direction)
  assert.ok(seen[0] === sweep[0] || seen[0] === sweep[sweep.length - 1]);
  // frames progress monotonically along the sweep (either direction) and cover most of it
  const idx = seen.map((f) => sweep.indexOf(f as (typeof sweep)[number]));
  assert.ok(idx.every((k) => k >= 0), 'all frames during the arc come from the sweep set');
  const up = idx.every((k, n) => n === 0 || k >= idx[n - 1]), down = idx.every((k, n) => n === 0 || k <= idx[n - 1]);
  assert.ok(up || down, 'sweep is monotonic');
  assert.ok(Math.abs(idx[idx.length - 1] - idx[0]) >= sweep.length - 2, 'covers the sweep');
  // after the arc: still on cooldown -> recover frames
  tick(s, fx, idle());
  assert.ok(A.recover.frames.includes(heroFrame(set, s, fx, 0, false)));
});

test('consecutive light swings alternate direction; the third is the finisher using the wide frames', () => {
  const { s, fx } = arena();
  const A = set.anims[0];
  const first = (): unknown => { tick(s, fx, press(Btn.Attack)); return heroFrame(set, s, fx, 0, false); };
  const wait = (n: number) => { for (let k = 0; k < n; k++) tick(s, fx, idle()); };
  const a = first();
  wait(CLASSES[0].combo[0].cooldown);
  const b = first();
  assert.notEqual(a, b, 'second swing starts at the opposite end of the sweep');
  wait(CLASSES[0].combo[1].cooldown);
  const c = first();
  assert.ok(A.finisher.frames.includes(c as (typeof A.finisher.frames)[number]), 'third hit is the finisher');
});

test('idle, walk, downed and the revive timer pick sensible frames', () => {
  const { s, fx } = arena();
  const A = set.anims[0];
  assert.ok(A.idle.frames.includes(heroFrame(set, s, fx, 0, false)));
  assert.ok(A.walk.frames.includes(heroFrame(set, s, fx, 0, true)));
  s.players[0].downed = true;
  s.players[0].downTimer = 600;
  assert.equal(heroFrame(set, s, fx, 0, false), A.down.frames[0]);
  s.players[0].downTimer = 100;
  assert.equal(heroFrame(set, s, fx, 0, false), A.down.frames[2]);
});
