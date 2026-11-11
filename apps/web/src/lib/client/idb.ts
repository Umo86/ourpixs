/** Tiny IndexedDB key-value store for upload persistence (survives refresh / app switch). */
const DB = "op-uploads";
const STORE = "items";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
    t.oncomplete = () => db.close();
  });
}

export const idbAvailable = () => typeof indexedDB !== "undefined";
export const idbPut = (key: string, value: unknown) => tx("readwrite", (s) => s.put(value, key));
export const idbDel = (key: string) => tx("readwrite", (s) => s.delete(key));
export async function idbAll<T>(prefix: string): Promise<{ key: string; value: T }[]> {
  const db = await open();
  return new Promise((res, rej) => {
    const out: { key: string; value: T }[] = [];
    const t = db.transaction(STORE, "readonly");
    const req = t.objectStore(STORE).openCursor(IDBKeyRange.bound(prefix, prefix + "￿"));
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      out.push({ key: String(c.key), value: c.value as T });
      c.continue();
    };
    req.onerror = () => rej(req.error);
    t.oncomplete = () => { db.close(); res(out); };
  });
}
