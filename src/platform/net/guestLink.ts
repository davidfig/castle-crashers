// A guest's end of an online run: the sim here is a copy of the host's, started from its snapshot and stepped with the frames the host
// used for each tick (hostLink.ts), so it plays out the same. This player's own inputs go to the host. If the copy drifts from the host's
// (its hash disagrees, or ticks went missing) it asks for the state again.
import { hashState } from '../../sim/hash';
import { createInputFrame, type InputFrame } from '../../sim/input';
import { MAX_PLAYERS } from '../../sim/constants';
import type { GameState } from '../../sim/state';
import { Assembler } from './chunks';
import { GuestFeed } from './guestFeed';
import type { RoomClient } from './lobby';
import { isWire, packFrame, type StartInfo, type Wire } from './wire';

/** Milliseconds between asks for the state. */
const ASK_MS = 1000;
/** Ticks of this player's input sent in one message. */
const SEND_BATCH = 2;

export class GuestLink {
  readonly role = 'guest';
  private readonly feed = new GuestFeed();
  private readonly asm = new Assembler();
  private readonly frames: InputFrame[] = Array.from({ length: MAX_PLAYERS }, createInputFrame);
  private outbox: number[] = [];
  private outTicks = 0;
  private askedAt = -1e9;

  /** `restore` builds the sim from the host's snapshot text and returns it (null if it cannot). */
  constructor(readonly room: RoomClient, readonly start: StartInfo, private readonly sim: () => GameState | null, private readonly restore: (text: string) => GameState | null, private readonly clock: () => number = () => performance.now()) {
    room.onRelay = (from, data) => { if (from === room.host) this.heard(data); };
  }

  get mySlot(): number { return this.start.slots.indexOf(this.room.you); }
  /** Has a sim to step (the host's state has arrived). */
  get ready(): boolean { return this.feed.ready; }

  /**
   * One update of the loop: sends this player's input, then steps the sim as far as the host's frames allow (`advance` runs one tick with
   * the frames given). Asks for the state while there is none, and again when the copy has drifted.
   */
  play(local: InputFrame, advance: (frames: InputFrame[]) => void): void {
    packFrame(local, this.outbox);
    if (++this.outTicks >= SEND_BATCH) this.flush();
    if (!this.feed.ready) { this.ask(); return; }
    for (let n = this.feed.steps(); n > 0 && this.feed.take(this.frames); n--) {
      advance(this.frames);
      const h = this.feed.hashNow();
      const sim = this.sim();
      if (h !== null && sim && h !== hashState(sim)) this.ask();
    }
  }

  private flush(): void {
    if (this.room.host !== null) this.room.relay(this.room.host, { t: 'in', f: this.outbox } satisfies Wire);
    this.outbox = [];
    this.outTicks = 0;
  }

  private ask(): void {
    const now = this.clock();
    if (now - this.askedAt < ASK_MS || this.room.host === null) return;
    this.askedAt = now;
    this.room.relay(this.room.host, { t: 'need' } satisfies Wire);
  }

  private heard(data: unknown): void {
    if (!isWire(data)) return;
    if (data.t === 'f' && Array.isArray(data.f)) {
      if (!this.feed.hear(data.n, data.f)) this.ask(); // ticks went missing
    } else if (data.t === 'h') this.feed.hearHash(data.n, data.h);
    else if (data.t === 'seats' && Array.isArray(data.slots)) this.start.slots.splice(0, Infinity, ...data.slots.filter((x) => typeof x === 'number'));
    else if (data.t === 'snap') {
      const text = this.asm.add(data.n, data.i, data.of, data.s);
      const sim = text === null ? null : this.restore(text);
      if (sim) this.feed.reset(sim.tick);
    }
  }
}
