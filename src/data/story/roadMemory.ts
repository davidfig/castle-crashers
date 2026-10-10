// How many times each road scene has been heard, so a repeat meeting plays a different conversation (`scriptFor` in road.ts).
// Per browser, not part of the Ledger: it only picks which of several equally true conversations plays, and losing it just
// replays the first-time script. Blocked site data (private window, cleared storage) is survivable: every call is guarded.
const KEY = 'game.roadHeard';

function load(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const out: Record<string, number> = {};
    if (typeof raw === 'object' && raw !== null) for (const k of Object.keys(raw)) { const v = raw[k]; if (typeof v === 'number' && v > 0) out[k] = Math.floor(v); }
    return out;
  } catch { return {}; }
}

export function timesHeard(id: string): number {
  return load()[id] ?? 0;
}

export function markHeard(id: string): void {
  const all = load();
  all[id] = (all[id] ?? 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* unsaved: the first-time script plays again */ }
}
