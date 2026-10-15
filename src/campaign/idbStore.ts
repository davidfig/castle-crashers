// IndexedDB behind the synchronous KeyValueStore (docs/decisions: run saves live in IndexedDB). The run save is written as the page closes,
// when nothing can be waited for, so reads and writes hit an in-memory copy at once and the database is written behind it. `openIdbStore`
// loads the copy first (the one await, at start-up) and moves any save found in the old localStorage store across.
import type { KeyValueStore } from './storage';

export const IDB_NAME = 'castle-crashers';
const STORE = 'kv';

/** The part of an IDBFactory used here, so tests can stand in a fake. */
export type IdbFactory = Pick<IDBFactory, 'open'>;

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
}

class IdbStore implements KeyValueStore {
  /** Writes are chained so they reach the database in the order they were made. */
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private db: IDBDatabase, private cache: Map<string, string>) {}
  getItem(key: string): string | null { return this.cache.get(key) ?? null; }
  setItem(key: string, value: string): void { this.cache.set(key, value); this.queue((s) => s.put(value, key)); }
  removeItem(key: string): void { this.cache.delete(key); this.queue((s) => s.delete(key)); }
  /** Resolves when everything written so far is in the database (tests; the page never waits). */
  flush(): Promise<unknown> { return this.tail; }
  private queue(op: (s: IDBObjectStore) => IDBRequest): void {
    this.tail = this.tail.then(() => new Promise<void>((ok) => {
      try {
        const tx = this.db.transaction(STORE, 'readwrite');
        op(tx.objectStore(STORE));
        tx.oncomplete = () => ok();
        tx.onerror = tx.onabort = () => ok(); // a failed write is lost, the copy in memory stays right for this page
      } catch { ok(); }
    }));
  }
}

/**
 * The store for `keys`. Anything in `legacy` under those keys that the database lacks is copied in, then removed from `legacy`.
 * Falls back to `legacy` itself when IndexedDB cannot be used (private windows, blocked site data).
 */
export async function openIdbStore(idb: IdbFactory | undefined, keys: readonly string[], legacy?: KeyValueStore): Promise<KeyValueStore | undefined> {
  try {
    if (!idb) return legacy;
    const open = idb.open(IDB_NAME, 1);
    open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
    const db = await request(open);
    const cache = new Map<string, string>();
    const read = db.transaction(STORE, 'readonly').objectStore(STORE);
    const found = await Promise.all(keys.map((k) => request(read.get(k))));
    keys.forEach((k, i) => { if (typeof found[i] === 'string') cache.set(k, found[i]); });
    const store = new IdbStore(db, cache);
    const moved: string[] = [];
    for (const k of keys) {
      const old = legacy?.getItem(k) ?? null;
      if (old === null) continue;
      if (!cache.has(k)) store.setItem(k, old);
      moved.push(k);
    }
    await store.flush(); // the copy is in the database before the old one goes
    for (const k of moved) { try { legacy?.removeItem?.(k); } catch { /* left behind: harmless, never read again */ } }
    return store;
  } catch {
    return legacy;
  }
}
