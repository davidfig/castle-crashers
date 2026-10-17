// What a host and its guests say to each other through the shared lobby server's relay (server-geometry). Everything is plain JSON,
// small numbers first: the server never reads it. Host-authoritative, as in the other geometry games: the host's browser runs the one
// sim, the guests send their inputs and step the same sim from the frames the host used.
import { MAX_PLAYERS } from '../../sim/constants';
import { createInputFrame, type InputFrame } from '../../sim/input';

/** Numbers per InputFrame on the wire: moveX, moveY, aimX, aimY, buttons. */
export const FRAME_INTS = 5;

/** The room's game data when the host starts a run (`RoomRequest.start`): everyone builds the same run from it. */
export interface StartInfo {
  seed: number;
  total: number;
  heat: number;
  /** Member ids in slot order: slot k is played by member `slots[k]`. The host may seat more later (`Wire` 'seats'). */
  slots: number[];
}

export type Wire =
  /** Guest -> host: that guest's input frames, one per tick since its last message. */
  | { t: 'in'; f: number[] }
  /** Guest -> host: I have no sim (or mine drifted): send me the state. */
  | { t: 'need' }
  /** Host -> guests: the frames the sim used for ticks `n`, `n+1`, ...; every frame is `MAX_PLAYERS * FRAME_INTS` numbers. */
  | { t: 'f'; n: number; f: number[] }
  /** Host -> guests: the state hash after tick `n` (a guest that disagrees asks for the state). */
  | { t: 'h'; n: number; h: number }
  /** Host -> guests: who holds which slot, when it changes (someone in the room who was not seated at the start asked to play). */
  | { t: 'seats'; slots: number[] }
  /** Host -> guests: a piece of the sim's snapshot taken at tick `n` (see chunks.ts). */
  | { t: 'snap'; n: number; i: number; of: number; s: string };

export function packFrame(f: InputFrame, out: number[]): void {
  out.push(f.moveX, f.moveY, f.aimX, f.aimY, f.buttons);
}

/** Frame `k` of a packed list into `into`. */
export function unpackFrame(p: readonly number[], k: number, into: InputFrame): void {
  const o = k * FRAME_INTS;
  into.moveX = clampAxis(p[o]);
  into.moveY = clampAxis(p[o + 1]);
  into.aimX = clampAxis(p[o + 2]);
  into.aimY = clampAxis(p[o + 3]);
  into.buttons = (p[o + 4] | 0) & 0xffff;
}

/** A guest is someone else's browser: its numbers are never trusted past the range the sim expects. */
function clampAxis(v: number): number {
  return Number.isFinite(v) ? Math.max(-127, Math.min(127, Math.round(v))) : 0;
}

export function packFrames(frames: readonly InputFrame[]): number[] {
  const out: number[] = [];
  for (let k = 0; k < MAX_PLAYERS; k++) packFrame(frames[k] ?? createInputFrame(), out);
  return out;
}

export function isWire(v: unknown): v is Wire {
  return typeof v === 'object' && v !== null && typeof (v as { t?: unknown }).t === 'string';
}

/** The room's start data as a StartInfo, or null if it is not one. */
export function readStart(v: unknown): StartInfo | null {
  const g = v as Partial<StartInfo> | null;
  if (!g || typeof g.seed !== 'number' || typeof g.total !== 'number' || typeof g.heat !== 'number' || !Array.isArray(g.slots)) return null;
  return { seed: g.seed >>> 0, total: g.total, heat: g.heat, slots: g.slots.filter((s): s is number => typeof s === 'number').slice(0, MAX_PLAYERS) };
}
