// The host's side of the frames: what each guest has sent waits in a queue per slot, one frame is used per tick, and every tick's
// frames (all slots) go out to the guests so they can step the same sim. Pure logic; hostLink.ts joins it to the room.
import { MAX_PLAYERS } from '../../sim/constants';
import { Btn, createInputFrame, type InputFrame } from '../../sim/input';
import { FRAME_INTS, packFrames, unpackFrame } from './wire';

/** Most frames kept waiting for one guest (a fifth of a second): past it the oldest are folded into the next, never lost as presses. */
const MAX_QUEUED = 12;
/** Ticks sent in one message. */
export const BATCH = 2;
/** A guest's frame repeated for want of a new one keeps the buttons that are held, not the ones pressed once. */
const HELD = Btn.Alt | Btn.Attack;

export class HostFeed {
  /** The frames each remote slot has sent and the sim has not used yet, oldest first. */
  private readonly queues: InputFrame[][] = Array.from({ length: MAX_PLAYERS }, () => []);
  private readonly last: InputFrame[] = Array.from({ length: MAX_PLAYERS }, createInputFrame);
  private pending: number[] = [];
  private pendingFrom = 0;
  private count = 0;

  /** Frames from the guest in slot `slot` (a `Wire` 'in'). */
  hear(slot: number, packed: readonly number[]): void {
    const q = this.queues[slot];
    if (!q) return;
    for (let o = 0; o + FRAME_INTS <= packed.length; o += FRAME_INTS) {
      const f = createInputFrame();
      unpackFrame(packed.slice(o, o + FRAME_INTS), 0, f);
      q.push(f);
    }
    while (q.length > MAX_QUEUED) {
      const gone = q.shift()!;
      q[0].buttons |= gone.buttons; // an overflow merges frames: a press in the dropped one still lands
    }
  }

  /**
   * The frames for the next tick, `tick` being the sim's tick before it steps: `mine` fills the host's own slot, each guest's slot takes
   * its next queued frame (the last one again when none came, sticks and held buttons carrying on, a press not repeated).
   * Every seated slot presses Join (the sim ignores it from a hero already up); `gone` slots hold nothing down.
   */
  frames(tick: number, mine: InputFrame, mySlot: number, slots: number, gone: (k: number) => boolean): InputFrame[] {
    const out: InputFrame[] = [];
    for (let k = 0; k < MAX_PLAYERS; k++) {
      const f = createInputFrame();
      if (k === mySlot) Object.assign(f, mine);
      else if (k < slots && !gone(k)) {
        const next = this.queues[k].shift();
        if (next) { Object.assign(f, next); this.last[k] = next; } else Object.assign(f, this.last[k], { buttons: this.last[k].buttons & HELD });
      }
      if (k < slots && !gone(k)) f.buttons |= Btn.Join;
      out.push(f);
    }
    if (this.count++ % BATCH === 0) { this.pending = []; this.pendingFrom = tick; }
    this.pending.push(...packFrames(out));
    return out;
  }

  /** The batch to send now (if the last tick completed one), else null. */
  take(): { n: number; f: number[] } | null {
    if (this.count % BATCH !== 0 || !this.pending.length) return null;
    const b = { n: this.pendingFrom, f: this.pending };
    this.pending = [];
    return b;
  }
}
