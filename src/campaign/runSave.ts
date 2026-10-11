// The run in progress, saved as the party goes so it can be left at any moment and continued another day (docs/21-the-road.md, "Saving
// and continuing"). A save is the sim's snapshot plus what cannot be regenerated: the run's config (its seed, the road's length, the heat)
// and, later, the choices made on the way. Everything generated (the cast, the folk, the heroes' looks, the scenery, the road ahead) is
// rebuilt from the seed when the run is continued.
//
// The store is injected (localStorage in the browser) so this stays testable and DOM-free. It is synchronous on purpose: the last save
// is written as the page closes (`pagehide`), when nothing asynchronous is sure to finish. The previous save is kept as a backup, so a
// write cut short never loses the run, and a save from a newer build is never overwritten.
import { CLASSES } from '../data/classes';
import { snapshot, SNAPSHOT_VERSION } from '../sim/snapshot';
import type { GameState } from '../sim/state';
import type { KeyValueStore } from './storage';

export const RUN_SAVE_KEY = 'game.run';
export const RUN_SAVE_BACKUP = 'game.run.prev';
/** The shape of a save. Add a migration in `parseRunSave` when it changes. */
export const RUN_SAVE_VERSION = 1;
/**
 * The generators' version. Everything already spawned is in the snapshot, so a save from older generators still loads: only the road not
 * yet planned and the art come out differently. Bump it when a generator changes what it makes; it is recorded, not enforced.
 */
export const GEN_VERSION = 1;

/** What the run was started with: enough, with the seed, to rebuild everything the snapshot does not hold. */
export interface RunConfigSave {
  seed: number;
  /** Levels on the road. */
  total: number;
  heat: number;
}

/** One hero of the saved party, for the title's "continue" line and the hold screen. */
export interface SavedHero { slot: number; classId: number; level: number }

export interface RunSave {
  v: number;
  gen: number;
  /** Wall-clock time of the save (ms since 1970), for the title. */
  savedAt: number;
  config: RunConfigSave;
  /** Choices made on the road (forks, docs/21 step 5): the road ahead is a function of the seed and these. */
  choices: number[];
  /** Where the party was: the level, and the heroes. */
  level: number;
  heroes: SavedHero[];
  /** The sim (sim/snapshot.ts). */
  sim: string;
}

/** A save of the run being played. */
export function makeRunSave(s: GameState, config: RunConfigSave, now: number, choices: readonly number[] = []): RunSave {
  const heroes = s.players.flatMap((p, slot) => (p.active ? [{ slot, classId: p.classId, level: p.level }] : []));
  return { v: RUN_SAVE_VERSION, gen: GEN_VERSION, savedAt: now, config: { ...config }, choices: [...choices], level: s.road?.level ?? 0, heroes, sim: snapshot(s) };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const int = (x: unknown, lo: number, hi = Number.MAX_SAFE_INTEGER): x is number => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;

/** Validates a parsed save (and upgrades an older shape, once there is one). Undefined when it is not a run save; 'newer' when a later build wrote it. */
export function parseRunSave(raw: unknown): RunSave | 'newer' | undefined {
  if (!isObj(raw) || typeof raw.v !== 'number') return undefined;
  if (raw.v > RUN_SAVE_VERSION) return 'newer';
  if (raw.v < 1) return undefined;
  const c = raw.config;
  if (!isObj(c) || !int(c.seed, 0, 0xffffffff) || !int(c.total, 1, 999) || !int(c.heat, 0, 99)) return undefined;
  if (typeof raw.sim !== 'string') return undefined;
  const snap = /^\{"v":(\d+)/.exec(raw.sim); // the snapshot's own version leads its text (sim/snapshot.ts)
  if (!snap) return undefined;
  if (Number(snap[1]) > SNAPSHOT_VERSION) return 'newer';
  const heroes = Array.isArray(raw.heroes)
    ? raw.heroes.filter((h): h is SavedHero => isObj(h) && int(h.slot, 0, 3) && int(h.classId, 0, CLASSES.length - 1) && int(h.level, 1, 999))
    : [];
  return {
    v: RUN_SAVE_VERSION,
    gen: int(raw.gen, 0) ? raw.gen : 0,
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : 0,
    config: { seed: c.seed, total: c.total, heat: c.heat },
    choices: Array.isArray(raw.choices) ? raw.choices.filter((x): x is number => int(x, 0)) : [],
    level: int(raw.level, 0) ? raw.level : 0,
    heroes,
    sim: raw.sim,
  };
}

/** ok: a save to continue (`backup` if only the previous one was readable). none: no run saved. newer / corrupt / unavailable: nothing usable, and the stored text must not be overwritten (`writable` false). */
export interface LoadRun {
  status: 'ok' | 'none' | 'newer' | 'corrupt' | 'unavailable';
  save?: RunSave;
  backup?: boolean;
  writable: boolean;
}

function read(store: KeyValueStore, key: string): RunSave | 'newer' | 'corrupt' | null {
  const text = store.getItem(key);
  if (text === null) return null;
  try {
    const p = parseRunSave(JSON.parse(text));
    return p === undefined ? 'corrupt' : p;
  } catch { return 'corrupt'; }
}

export function loadRunSave(store: KeyValueStore | undefined): LoadRun {
  try {
    if (!store) return { status: 'unavailable', writable: false };
    const main = read(store, RUN_SAVE_KEY);
    if (main === 'newer') return { status: 'newer', writable: false };
    if (main && main !== 'corrupt') return { status: 'ok', save: main, writable: true };
    const prev = read(store, RUN_SAVE_BACKUP);
    if (prev && prev !== 'corrupt' && prev !== 'newer') return { status: 'ok', save: prev, backup: true, writable: true };
    if (main === null && prev === null) return { status: 'none', writable: true };
    return { status: 'corrupt', writable: true };
  } catch { return { status: 'unavailable', writable: false }; }
}

/**
 * Writes the save. The one it replaces becomes the backup (only if it was a good one: a damaged save never pushes out a good backup).
 * Returns false when nothing was written (no storage, storage full, or a newer build's save there).
 */
export function writeRunSave(store: KeyValueStore | undefined, save: RunSave): boolean {
  if (!store) return false;
  try {
    const old = store.getItem(RUN_SAVE_KEY);
    if (old !== null) {
      let good: RunSave | 'newer' | undefined;
      try { good = parseRunSave(JSON.parse(old)); } catch { good = undefined; }
      if (good === 'newer') return false;
      if (good) store.setItem(RUN_SAVE_BACKUP, old);
    }
    store.setItem(RUN_SAVE_KEY, JSON.stringify(save));
    return true;
  } catch { return false; }
}

/** The run is over (won, lost or abandoned): nothing to continue. */
export function clearRunSave(store: KeyValueStore | undefined): void {
  try {
    store?.removeItem?.(RUN_SAVE_KEY);
    store?.removeItem?.(RUN_SAVE_BACKUP);
  } catch { /* nothing to clear */ }
}

/** The title's line for a saved run: where it was and who was in it. */
export function describeRunSave(save: RunSave): string {
  const who = save.heroes.map((h) => CLASSES[h.classId]?.name.toUpperCase() ?? '?').join(' ');
  return `LEVEL ${save.level + 1} OF ${save.config.total}${who ? `  ${who}` : ''}`;
}
