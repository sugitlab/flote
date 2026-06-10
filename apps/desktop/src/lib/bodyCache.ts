// IndexedDB cache for note/task body_md.
// Avoids re-fetching bodies from Supabase on every app startup by caching
// them locally keyed by (id, updated_at). A cache entry is only valid when
// its updated_at matches the server manifest — stale entries are ignored.

const DB_NAME = "flote-body-cache";
const NOTE_STORE = "notes";
const TASK_STORE = "tasks";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(NOTE_STORE)) db.createObjectStore(NOTE_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(TASK_STORE)) db.createObjectStore(TASK_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

export type CacheEntry = { id: string; body_md: string; updated_at: string };

async function getEntries(store: string, ids: string[]): Promise<Map<string, CacheEntry>> {
  if (ids.length === 0) return new Map();
  try {
    const db = await openDB();
    const result = new Map<string, CacheEntry>();
    await Promise.all(ids.map(id => new Promise<void>(resolve => {
      const req = db.transaction(store, "readonly").objectStore(store).get(id);
      req.onsuccess = () => { if (req.result) result.set(id, req.result as CacheEntry); resolve(); };
      req.onerror = () => resolve();
    })));
    return result;
  } catch {
    return new Map();
  }
}

async function putEntries(store: string, entries: CacheEntry[]): Promise<void> {
  if (entries.length === 0) return;
  try {
    const db = await openDB();
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const e of entries) os.put(e);
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
  } catch {
    // non-fatal
  }
}

async function deleteEntries(store: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const db = await openDB();
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const id of ids) os.delete(id);
    await new Promise<void>(resolve => { tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
  } catch {}
}

export const noteBodyCache = {
  get: (ids: string[]) => getEntries(NOTE_STORE, ids),
  put: (entries: CacheEntry[]) => putEntries(NOTE_STORE, entries),
  delete: (ids: string[]) => deleteEntries(NOTE_STORE, ids),
};

export const taskBodyCache = {
  get: (ids: string[]) => getEntries(TASK_STORE, ids),
  put: (entries: CacheEntry[]) => putEntries(TASK_STORE, entries),
  delete: (ids: string[]) => deleteEntries(TASK_STORE, ids),
};
