import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openIdbStore, type IdbFactory } from './idbStore';
import type { KeyValueStore } from './storage';

/** Just enough IndexedDB for one object store of strings: requests and transactions finish on a later tick, as in a browser. */
function fakeIdb(data: Map<string, string>, failOpen = false): IdbFactory {
  const later = (f: () => void) => setTimeout(f, 0);
  const req = <T>(get: () => T): IDBRequest<T> => {
    const r = {} as IDBRequest<T>;
    later(() => { (r as { result: T }).result = get(); r.onsuccess?.({} as Event); });
    return r;
  };
  const db = {
    createObjectStore() { return {}; },
    transaction() {
      const tx = {} as IDBTransaction;
      const os = {
        get: (k: string) => req(() => data.get(k)),
        put: (v: string, k: string) => { data.set(k, v); later(() => tx.oncomplete?.({} as Event)); return {} as IDBRequest; },
        delete: (k: string) => { data.delete(k); later(() => tx.oncomplete?.({} as Event)); return {} as IDBRequest; },
      };
      (tx as { objectStore: unknown }).objectStore = () => os;
      return tx;
    },
  };
  return {
    open() {
      const r = {} as IDBOpenDBRequest;
      later(() => {
        if (failOpen) { (r as { error: unknown }).error = new Error('blocked'); r.onerror?.({} as Event); return; }
        (r as { result: unknown }).result = db;
        r.onupgradeneeded?.({} as IDBVersionChangeEvent);
        r.onsuccess?.({} as Event);
      });
      return r;
    },
  } as unknown as IdbFactory;
}

class Memory implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
  removeItem(k: string): void { this.data.delete(k); }
}

test('writes are readable at once and reach the database', async () => {
  const data = new Map<string, string>();
  const store = (await openIdbStore(fakeIdb(data), ['a', 'b']))!;
  store.setItem('a', '1');
  assert.equal(store.getItem('a'), '1');
  store.setItem('b', '2');
  store.removeItem?.('b');
  assert.equal(store.getItem('b'), null);
  await (store as unknown as { flush(): Promise<unknown> }).flush();
  assert.deepEqual([...data], [['a', '1']]);
});

test('what the database holds is there on the next start', async () => {
  const data = new Map([['a', 'saved']]);
  const store = (await openIdbStore(fakeIdb(data), ['a']))!;
  assert.equal(store.getItem('a'), 'saved');
});

test('a save in localStorage moves across, and the database wins over a stale one', async () => {
  const legacy = new Memory();
  legacy.setItem('a', 'old'); legacy.setItem('b', 'older'); legacy.setItem('other', 'x');
  const data = new Map([['b', 'new']]);
  const store = (await openIdbStore(fakeIdb(data), ['a', 'b'], legacy))!;
  assert.equal(store.getItem('a'), 'old');
  assert.equal(store.getItem('b'), 'new');
  assert.deepEqual([...data].sort(), [['a', 'old'], ['b', 'new']]);
  assert.equal(legacy.getItem('a'), null);
  assert.equal(legacy.getItem('b'), null);
  assert.equal(legacy.getItem('other'), 'x');
});

test('without IndexedDB (or when it will not open) the old store is used', async () => {
  const legacy = new Memory();
  assert.equal(await openIdbStore(undefined, ['a'], legacy), legacy);
  assert.equal(await openIdbStore(fakeIdb(new Map(), true), ['a'], legacy), legacy);
});
