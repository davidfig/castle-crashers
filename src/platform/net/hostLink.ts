// The host's end of an online run: this browser runs the one sim, every guest's inputs steer their heroes, and the frames each tick used
// go out so the guests can step the same sim (the guests' end is guestLink.ts). The server only relays; it never sees the game.
import { MAX_PLAYERS } from '../../sim/constants';
import { hashState } from '../../sim/hash';
import type { InputFrame } from '../../sim/input';
import { snapshot } from '../../sim/snapshot';
import type { GameState } from '../../sim/state';
import { split } from './chunks';
import { HostFeed } from './hostFeed';
import type { RoomClient } from './lobby';
import { isWire, type StartInfo, type Wire } from './wire';

/** Ticks between the state hashes the guests check themselves against (two seconds). */
const HASH_EVERY = 120;
/** Milliseconds before the same guest may be sent the state again. */
const RESEND_MS = 800;

export class HostLink {
  readonly role = 'host';
  private readonly feed = new HostFeed();
  private readonly sent = new Map<number, number>();

  constructor(readonly room: RoomClient, readonly start: StartInfo, private readonly sim: () => GameState, private readonly clock: () => number = () => performance.now()) {
    room.onRelay = (from, data) => this.heard(from, data);
  }

  /** The slot this browser's own player holds. */
  get mySlot(): number { return this.start.slots.indexOf(this.room.you); }

  /** Everyone's frames for the next tick: `local` is this browser's own player. */
  frames(sim: GameState, local: InputFrame): InputFrame[] {
    const gone = (k: number): boolean => this.room.members.find((m) => m.id === this.start.slots[k])?.connected === false;
    return this.feed.frames(sim.tick, local, this.mySlot, this.start.slots.length, gone);
  }

  /** After the sim stepped: tell the guests what it used, and now and then what it came to. */
  after(sim: GameState): void {
    const b = this.feed.take();
    if (b) this.room.relay('all', { t: 'f', n: b.n, f: b.f } satisfies Wire);
    if (sim.tick % HASH_EVERY === 0) this.room.relay('all', { t: 'h', n: sim.tick, h: hashState(sim) } satisfies Wire);
  }

  private heard(from: number, data: unknown): void {
    if (!isWire(data)) return;
    let slot = this.start.slots.indexOf(from);
    if (slot < 0 && data.t === 'need') slot = this.seat(from); // in the room but not seated when the run started (the start beat their arrival)
    if (slot < 0 || slot === this.mySlot) return;
    if (data.t === 'in' && Array.isArray(data.f)) this.feed.hear(slot, data.f);
    else if (data.t === 'need') this.send(from);
  }

  /** Gives a room member the next free slot (their hero walks in at once) and tells everyone; -1 when the party is full. */
  private seat(member: number): number {
    if (this.start.slots.length >= MAX_PLAYERS || !this.room.members.some((m) => m.id === member)) return -1;
    this.start.slots.push(member);
    this.room.relay('all', { t: 'seats', slots: this.start.slots } satisfies Wire);
    return this.start.slots.length - 1;
  }

  /** The sim as it stands, in pieces, to one guest: it picks up from this tick. */
  private send(to: number): void {
    const now = this.clock();
    if (now - (this.sent.get(to) ?? -1e9) < RESEND_MS) return;
    this.sent.set(to, now);
    const sim = this.sim();
    const parts = split(snapshot(sim));
    parts.forEach((s, i) => this.room.relay(to, { t: 'snap', n: sim.tick, i, of: parts.length, s } satisfies Wire));
  }
}
