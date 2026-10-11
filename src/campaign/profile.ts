// What carries over between runs (docs/21-the-road.md, step 6): the renown earned and the town's lasting upgrades (data/meta.ts). Kept apart
// from the run in progress (campaign/runSave.ts) and from the story's Ledger, versioned like them. The store is injected (localStorage in the
// browser) so this stays testable and DOM-free.
import { META } from '../data/meta';
import type { KeyValueStore } from './storage';

export const PROFILE_KEY = 'game.profile';
export const PROFILE_VERSION = 1;

export interface Profile {
  v: number;
  renown: number;
  /** Ranks of the town's places, by `META` id (an id the build no longer knows is kept, untouched). */
  meta: Record<string, number>;
}

export function newProfile(): Profile { return { v: PROFILE_VERSION, renown: 0, meta: {} }; }

/** The profile's ranks in `META` order, for the sim. */
export function metaRanks(p: Profile): number[] { return META.map((m) => Math.max(0, Math.min(m.maxRank, p.meta[m.id] ?? 0))); }

/** The profile after a run (or a visit to the town): renown left, and the places' ranks as the sim has them. */
export function withRun(p: Profile, renown: number, ranks: readonly number[]): Profile {
  const meta = { ...p.meta };
  META.forEach((m, i) => { meta[m.id] = ranks[i] ?? 0; });
  return { v: PROFILE_VERSION, renown: Math.max(0, Math.floor(renown)), meta };
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
    return { status: 'ok', profile: { v: PROFILE_VERSION, renown, meta }, writable: true };
  } catch { return { status: 'corrupt', profile: newProfile(), writable: false }; }
}

export function saveProfile(store: KeyValueStore | undefined, p: Profile): boolean {
  try { if (!store) return false; store.setItem(PROFILE_KEY, JSON.stringify(p)); return true; } catch { return false; }
}
