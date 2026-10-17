// The online run's guarantees: what crosses the wire reads back the same, and a guest that starts from the host's snapshot and steps with
// the frames the host used ends up in exactly the host's state (also across late messages, a lost stretch and a drifted copy).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { botInput } from '../../sim/bot';
import { hashState } from '../../sim/hash';
import { Btn, createInputFrame, type InputFrame } from '../../sim/input';
import { restore } from '../../sim/snapshot';
import { createSim, type GameState } from '../../sim/state';
import { step } from '../../sim/step';
import { Assembler, CHUNK, split } from './chunks';
import { GuestFeed, RESERVE } from './guestFeed';
import { GuestLink } from './guestLink';
import { HostFeed } from './hostFeed';
import { HostLink } from './hostLink';
import type { RoomClient } from './lobby';
import { FRAME_INTS, packFrames, readStart, unpackFrame, type StartInfo } from './wire';

test('a frame reads back the same, and a stranger\'s numbers are held to the range', () => {
  const f: InputFrame = { moveX: -127, moveY: 60, aimX: 0, aimY: 5, buttons: Btn.Attack | Btn.Interact };
  const out = createInputFrame();
  unpackFrame(packFrames([f]), 0, out);
  assert.deepEqual(out, f);
  unpackFrame([9999, -9999, NaN, 3.4, 0x7fffffff, 0], 0, out);
  assert.deepEqual([out.moveX, out.moveY, out.aimX, out.aimY], [127, -127, 0, 3]);
  assert.ok(out.buttons >= 0 && out.buttons <= 0xffff);
});

test('start data is read defensively', () => {
  assert.equal(readStart(null), null);
  assert.equal(readStart({ seed: 'x' }), null);
  assert.deepEqual(readStart({ seed: -1, total: 15, heat: 0, slots: [3, 'x', 1, 2, 0, 9] }), { seed: 0xffffffff, total: 15, heat: 0, slots: [3, 1, 2, 0] });
});

test('a snapshot-sized text splits under the relay cap and joins back', () => {
  const text = 'abcdefghij'.repeat(8000);
  const parts = split(text);
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= CHUNK));
  const a = new Assembler();
  let got: string | null = null;
  [...parts.keys()].reverse().forEach((i) => { got = a.add(7, i, parts.length, parts[i]) ?? got; });
  assert.equal(got, text);
  assert.equal(a.add(7, 0, parts.length, parts[0]), null); // a stray piece after the whole is not another snapshot
});

test('the host uses one queued frame per tick, and a tap between two messages is not lost', () => {
  const feed = new HostFeed();
  const tap: InputFrame = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: Btn.Attack };
  const none = createInputFrame();
  feed.hear(1, [...packFrames([tap]).slice(0, FRAME_INTS), ...packFrames([none]).slice(0, FRAME_INTS)]);
  const mine = createInputFrame();
  const a = feed.frames(10, mine, 0, 2, () => false), b = feed.frames(11, mine, 0, 2, () => false);
  const sent = feed.take();
  const c = feed.frames(12, mine, 0, 2, () => false);
  assert.ok(a[1].buttons & Btn.Attack);
  assert.ok(!(b[1].buttons & Btn.Attack));
  assert.ok(!(c[1].buttons & Btn.Attack));
  assert.ok(a[1].buttons & Btn.Join && !(a[2].buttons & Btn.Join), 'seated slots press Join, empty ones do not');
  assert.deepEqual(sent && sent.n, 10);
  assert.equal(sent && sent.f.length, 2 * 4 * FRAME_INTS);
});

test('a guest waits for a reserve, then follows at the host\'s pace and speeds up when behind', () => {
  const feed = new GuestFeed();
  feed.reset(0);
  const per = 4 * FRAME_INTS;
  feed.hear(0, new Array(per * RESERVE).fill(0));
  assert.equal(feed.steps(), 0);
  feed.hear(RESERVE, new Array(per).fill(0));
  assert.equal(feed.steps(), 1);
  feed.hear(RESERVE + 1, new Array(per * 20).fill(0));
  assert.ok(feed.steps() > 1);
  assert.equal(feed.hear(RESERVE + 40, new Array(per).fill(0)), false, 'a stretch that never came is noticed');
});

/** Two ends of a room that pass JSON between them after `delay` calls of `pump`. */
function fakeRoom(you: number, host: number, members: number[]) {
  const room = { you, host, members: members.map((id) => ({ id, name: 'Hero', info: {}, ready: false, connected: true })), connected: true, isHost: you === host, onRelay: undefined as undefined | ((from: number, data: unknown) => void), out: [] as { due: number; to: number | 'all'; data: unknown }[], now: 0,
    relay(to: number | 'all', data: unknown) { room.out.push({ due: room.now, to, data: JSON.parse(JSON.stringify(data)) }); } };
  return room;
}

function runOnline(opts: { ticks: number; lag: number; lose?: [number, number]; drift?: number; late?: boolean }) {
  const start: StartInfo = { seed: 5, total: 15, heat: 0, slots: opts.late ? [0] : [0, 1] };
  const hostRoom = fakeRoom(0, 0, [0, 1]), guestRoom = fakeRoom(1, 0, [0, 1]);
  const guestStart: StartInfo = { ...start, slots: [...start.slots] }; // (each browser has its own copy of the start)
  const sim = createSim(start.seed, undefined, { road: { total: start.total } });
  let clock = 0;
  const host = new HostLink(hostRoom as unknown as RoomClient, start, () => sim, () => clock);
  const held: { copy: GameState | null } = { copy: null };
  const guest = new GuestLink(guestRoom as unknown as RoomClient, guestStart, () => held.copy, (text) => (held.copy = restore(text)), () => clock);
  const hashes = new Map<number, number>();
  const mine = createInputFrame(), theirs = createInputFrame();
  let delivered = 0;
  const deliver = (from: typeof hostRoom, to: typeof hostRoom, fromId: number, t: number): void => {
    from.out = from.out.filter((m) => {
      if (m.due + opts.lag > t) return true;
      const lost = opts.lose && t >= opts.lose[0] && t < opts.lose[1] && (m.data as { t: string }).t === 'f';
      if (!lost && (m.to === 'all' || m.to === to.you)) { to.onRelay?.(fromId, m.data); delivered++; }
      return false;
    });
  };
  for (let t = 0; t < opts.ticks; t++) {
    clock += 17;
    hostRoom.now = guestRoom.now = t;
    botInput(sim, 0, mine);
    const f = host.frames(sim, mine);
    step(sim, f);
    hashes.set(sim.tick, hashState(sim));
    host.after(sim);
    // the guest's own player: a bot driving the hero it would see (the host's copy of it, which is all that is known at first)
    botInput(sim, 1, theirs);
    guest.play(theirs, (frames) => step(held.copy!, frames));
    if (opts.drift && t === opts.drift && held.copy) held.copy.kills += 7;
    deliver(hostRoom, guestRoom, 0, t);
    deliver(guestRoom, hostRoom, 1, t);
  }
  return { sim, copy: held.copy, hashes, delivered, guest };
}

test('a guest that starts from the host\'s snapshot and follows its frames stays in the host\'s exact state', () => {
  const r = runOnline({ ticks: 900, lag: 3 });
  assert.ok(r.copy, 'the guest got the state');
  assert.ok(r.sim.players[1].active, 'the guest\'s hero walked in');
  assert.ok(r.copy!.tick > 800, `the guest keeps up (at ${r.copy!.tick})`);
  assert.equal(hashState(r.copy!), r.hashes.get(r.copy!.tick));
});

test('a guest that lost a stretch of the host\'s frames asks again and is put right', () => {
  const r = runOnline({ ticks: 1500, lag: 2, lose: [300, 360] });
  assert.ok(r.copy && r.copy.tick > 1300);
  assert.equal(hashState(r.copy!), r.hashes.get(r.copy!.tick));
});

test('a guest whose copy drifted is noticed by the host\'s hash and put right', () => {
  const r = runOnline({ ticks: 1500, lag: 2, drift: 500 });
  assert.ok(r.copy!.kills < 7 + r.sim.kills, 'the drift is gone');
  assert.equal(hashState(r.copy!), r.hashes.get(r.copy!.tick));
});

test('a guest the start missed (it arrived as the host set out) is seated when it asks, and walks in', () => {
  const r = runOnline({ ticks: 900, lag: 3, late: true });
  assert.equal(r.guest.mySlot, 1);
  assert.ok(r.sim.players[1].active, 'the late guest\'s hero walked in');
  assert.ok(r.copy && r.copy.tick > 800);
  assert.equal(hashState(r.copy!), r.hashes.get(r.copy!.tick));
});
