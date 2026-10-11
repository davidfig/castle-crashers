// Saves and restores a sim exactly, so a run can be left at any moment and continued later (docs/21-the-road.md, "Saving and
// continuing"). `GameState` is plain data (docs/08): numbers, booleans, strings, arrays, plain objects and typed arrays. A restored
// sim steps on exactly as the one it was taken from would have (the round trip is tested), so everything that decides how the
// game plays must live in `GameState`, never in a module of the sim or outside it.
import { MAX_ENTS } from './constants';
import { createEvents } from './events';
import type { GameState } from './state';

/** The shape of a snapshot. Bump it when an old snapshot can no longer be restored as it is (and migrate it where it is read). */
export const SNAPSHOT_VERSION = 1;

/** Parts of the state that are rebuilt rather than saved: scratch space, and the events the presentation has not yet read. */
const FRESH: Record<string, () => unknown> = {
  scratch: () => new Int32Array(MAX_ENTS),
  procScratch: () => new Int32Array(MAX_ENTS),
  events: createEvents,
};

type Typed = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array | Float64Array;
const TYPED: Record<string, new (n: number) => Typed> = {
  Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array,
};

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * A typed array as `{ $t: type, n: length, d: the leading elements, f: the value of all the rest }`: the tail of an entity array
 * past its high-water mark is all one value, so it costs nothing. Bytes are the platform's order (little-endian everywhere we run).
 */
function packTyped(a: Typed): unknown {
  let k = a.length;
  const fill = k > 0 ? a[k - 1] : 0;
  while (k > 0 && Object.is(a[k - 1], fill)) k--;
  const lead = new Uint8Array(a.buffer, a.byteOffset, k * a.BYTES_PER_ELEMENT);
  return { $t: a.constructor.name, n: a.length, d: toBase64(lead), f: pack(fill, 'fill') };
}

function unpackTyped(o: { $t: string; n: number; d: string; f: unknown }): Typed {
  const Ctor = TYPED[o.$t];
  if (!Ctor) throw new Error(`snapshot: unknown array type ${o.$t}`);
  const a = new Ctor(o.n);
  const lead = fromBase64(o.d);
  new Uint8Array(a.buffer).set(lead);
  a.fill(unpack(o.f) as number, lead.length / a.BYTES_PER_ELEMENT);
  return a;
}

/** JSON loses these numbers, so they travel as `{ $n: ... }`. */
function packNumber(v: number): unknown {
  if (Number.isFinite(v) && !Object.is(v, -0)) return v;
  return { $n: Object.is(v, -0) ? '-0' : String(v) };
}

function pack(v: unknown, path: string): unknown {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return packNumber(v);
  if (v === undefined) return { $u: 1 };
  if (ArrayBuffer.isView(v)) {
    if (!(v.constructor.name in TYPED)) throw new Error(`snapshot: ${path} is a ${v.constructor.name}`);
    return packTyped(v as Typed);
  }
  if (Array.isArray(v)) return v.map((x, i) => pack(x, `${path}[${i}]`));
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = pack(x, `${path}.${k}`);
    return out;
  }
  // a function, a class instance, a Map or Set: the sim's state must stay plain data (docs/08)
  throw new Error(`snapshot: ${path} is not plain data (${typeof v === 'object' ? (v as object).constructor?.name : typeof v})`);
}

function unpack(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(unpack);
  const o = v as Record<string, unknown>;
  if ('$t' in o) return unpackTyped(o as { $t: string; n: number; d: string; f: unknown });
  if ('$n' in o) return o.$n === '-0' ? -0 : Number(o.$n);
  if ('$u' in o) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(o)) out[k] = unpack(x);
  return out;
}

/** The sim as text: everything needed to step on from exactly here. */
export function snapshot(s: GameState): string {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (!(k in FRESH)) body[k] = pack(v, k);
  return JSON.stringify({ v: SNAPSHOT_VERSION, s: body });
}

/** A sim from `snapshot`'s text. Throws if the text is not a snapshot this build can restore. */
export function restore(text: string): GameState {
  const raw = JSON.parse(text) as { v?: unknown; s?: unknown };
  if (raw.v !== SNAPSHOT_VERSION || typeof raw.s !== 'object' || raw.s === null) throw new Error(`snapshot: version ${String(raw.v)} is not ${SNAPSHOT_VERSION}`);
  const s = unpack(raw.s) as Record<string, unknown>;
  for (const [k, make] of Object.entries(FRESH)) s[k] = make();
  return s as unknown as GameState;
}
