// Versioned persistence for the Ledger. The store is injected (localStorage in the browser) so this stays testable and DOM-free.
import { createLedger, LEDGER_VERSION, type Ledger, type RegionState } from './ledger';
import { FINAL_CHAPTER } from '../data/story/chapters';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const LEDGER_KEY = 'game.ledger';

/**
 * ok: loaded. new: nothing stored yet. corrupt / newer / unavailable: `ledger` is a fresh in-memory one and
 * `writable` is false, so the caller must not overwrite what is on disk (a newer build's save, or a salvageable one).
 */
export interface LoadResult {
  status: 'ok' | 'new' | 'corrupt' | 'newer' | 'unavailable';
  ledger: Ledger;
  writable: boolean;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []);
function counts(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (isObj(x)) for (const k of Object.keys(x)) { const v = x[k]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = Math.floor(v); }
  return out;
}

/** Validates and upgrades a parsed save. Returns undefined when it is not a Ledger. Add a case per version when the shape changes. */
export function migrateLedger(raw: unknown): Ledger | 'newer' | undefined {
  if (!isObj(raw) || typeof raw.v !== 'number') return undefined;
  if (raw.v > LEDGER_VERSION) return 'newer';
  if (raw.v < 1) return undefined;
  const chapter = raw.chapter;
  if (typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1 || chapter > FINAL_CHAPTER + 1) return undefined;
  const seed = raw.campaignSeed;
  if (typeof seed !== 'number' || !Number.isFinite(seed)) return undefined;
  const base = createLedger(seed);
  const regions: Record<string, RegionState> = {};
  if (isObj(raw.regions)) for (const k of Object.keys(raw.regions)) { const v = raw.regions[k]; if (v === 'unseen' || v === 'cleared' || v === 'quiet') regions[k] = v; }
  return {
    ...base,
    chapter,
    beatsSeen: strings(raw.beatsSeen),
    chapterWrits: typeof raw.chapterWrits === 'number' && raw.chapterWrits >= 0 ? Math.floor(raw.chapterWrits) : 0,
    missed: counts(raw.missed),
    slain: counts(raw.slain),
    spared: counts(raw.spared),
    scenes: strings(raw.scenes),
    party: strings(raw.party),
    betrayed: typeof raw.betrayed === 'number' && raw.betrayed >= 0 ? Math.floor(raw.betrayed) : 0,
    regions,
    endings: strings(raw.endings),
    runs: typeof raw.runs === 'number' && raw.runs >= 0 ? Math.floor(raw.runs) : 0,
  };
}

export function serializeLedger(l: Ledger): string {
  return JSON.stringify(l);
}

export function loadLedger(store: KeyValueStore | undefined, newSeed: () => number): LoadResult {
  const fresh = (): Ledger => createLedger(newSeed());
  let text: string | null;
  try {
    if (!store) return { status: 'unavailable', ledger: fresh(), writable: false };
    text = store.getItem(LEDGER_KEY);
  } catch {
    return { status: 'unavailable', ledger: fresh(), writable: false };
  }
  if (text === null) return { status: 'new', ledger: fresh(), writable: true };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { status: 'corrupt', ledger: fresh(), writable: false }; }
  const m = migrateLedger(parsed);
  if (m === 'newer') return { status: 'newer', ledger: fresh(), writable: false };
  if (!m) return { status: 'corrupt', ledger: fresh(), writable: false };
  return { status: 'ok', ledger: m, writable: true };
}

/** Returns whether the write happened. Never throws (private windows, blocked site data). */
export function saveLedger(store: KeyValueStore | undefined, l: Ledger): boolean {
  try {
    if (!store) return false;
    store.setItem(LEDGER_KEY, serializeLedger(l));
    return true;
  } catch {
    return false;
  }
}
