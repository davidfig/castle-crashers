// What carries over between runs (docs/21-the-road.md, step 6): the renown earned and the town's lasting upgrades (data/meta.ts). Kept apart
// from the run in progress (campaign/runSave.ts) and from the story's Ledger, versioned like them. The store is injected (localStorage in the
// browser) so this stays testable and DOM-free.
import { META } from '../data/meta';
import { treesFromProfile, treesToProfile, type TreeProfile, type TreeSave } from '../data/trees';
import type { KeyValueStore } from './storage';

export const PROFILE_KEY = 'game.profile';
export const PROFILE_VERSION = 1;

export interface Profile {
  v: number;
  renown: number;
  /** Ranks of the town's places, by `META` id (an id the build no longer knows is kept, untouched). */
  meta: Record<string, number>;
  /** The class tree (data/trees): node ids built, the active branches, the equipped skill. Absent = nothing built. */
  tree?: TreeProfile;
  /** Every class's tree by class name (the `tree` above is the warrior's, from before there were more). */
  trees?: Record<string, TreeProfile>;
}

export function newProfile(): Profile { return { v: PROFILE_VERSION, renown: 0, meta: {} }; }

/** The profile's trees as the sim has them (one per class). */
export function treeSaves(p: Profile): TreeSave[] { return treesFromProfile(p.trees, p.tree); }

/** The profile's ranks in `META` order, for the sim. */
export function metaRanks(p: Profile): number[] { return META.map((m) => Math.max(0, Math.min(m.maxRank, p.meta[m.id] ?? 0))); }

/** The profile after a run (or a visit to the town): renown left, and the places' ranks as the sim has them. */
export function withRun(p: Profile, renown: number, ranks: readonly number[], trees?: readonly TreeSave[]): Profile {
  const meta = { ...p.meta };
  META.forEach((m, i) => { meta[m.id] = ranks[i] ?? 0; });
  return { v: PROFILE_VERSION, renown: Math.max(0, Math.floor(renown)), meta, trees: trees ? treesToProfile(trees) : p.trees, tree: trees ? undefined : p.tree };
}

/** One class's saved tree, or undefined if what is stored is not one. */
function parseTree(v: unknown): TreeProfile | undefined {
  const t = v as { owned?: unknown; focus?: unknown; loadout?: unknown; skill?: unknown } | undefined;
  if (!t || !Array.isArray(t.owned) || !Array.isArray(t.focus) || !(Array.isArray(t.loadout) || typeof t.skill === 'number')) return undefined;
  return {
    owned: t.owned.filter((x): x is string => typeof x === 'string'),
    focus: t.focus.filter((x): x is number => typeof x === 'number'),
    loadout: Array.isArray(t.loadout) ? t.loadout.filter((x): x is number => typeof x === 'number') : undefined,
    skill: typeof t.skill === 'number' ? t.skill : undefined,
  };
}

/** ok / none: a profile to use (a new one if none). newer / corrupt / unavailable: a new one in memory, and the stored text must not be overwritten. */
export function loadProfile(store: KeyValueStore | undefined): { status: 'ok' | 'none' | 'newer' | 'corrupt' | 'unavailable'; profile: Profile; writable: boolean } {
  try {
    if (!store) return { status: 'unavailable', profile: newProfile(), writable: false };
    const text = store.getItem(PROFILE_KEY);
    if (text === null) return { status: 'none', profile: newProfile(), writable: true };
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (typeof raw !== 'object' || raw === null || typeof raw.v !== 'number') return { status: 'corrupt', profile: newProfile(), writable: false };
    if (raw.v > PROFILE_VERSION) return { status: 'newer', profile: newProfile(), writable: false };
    const meta: Record<string, number> = {};
    if (typeof raw.meta === 'object' && raw.meta !== null) for (const [k, v] of Object.entries(raw.meta)) if (typeof v === 'number' && Number.isInteger(v) && v >= 0) meta[k] = v;
    const renown = typeof raw.renown === 'number' && Number.isFinite(raw.renown) && raw.renown >= 0 ? Math.floor(raw.renown) : 0;
    const tree = parseTree(raw.tree);
    let trees: Profile['trees'];
    if (typeof raw.trees === 'object' && raw.trees !== null) {
      trees = {};
      for (const [k, v] of Object.entries(raw.trees)) { const t = parseTree(v); if (t) trees[k] = t; }
    }
    return { status: 'ok', profile: { v: PROFILE_VERSION, renown, meta, tree, trees }, writable: true };
  } catch { return { status: 'corrupt', profile: newProfile(), writable: false }; }
}

export function saveProfile(store: KeyValueStore | undefined, p: Profile): boolean {
  try { if (!store) return false; store.setItem(PROFILE_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
