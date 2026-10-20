// Small encrypted key-value store on IndexedDB for the offline snapshot and
// the outbox. Values are AES-GCM encrypted with a non-extractable key that
// lives in the same database, so health data is never stored as plain text
// (not in localStorage, not in Cache Storage). Everything is wiped on logout.

const DB_NAME = "sana-cabinet";
const STORE = "kv";
const KEY_ID = "__key";

let dbPromise: Promise<IDBDatabase> | null = null;
let keyPromise: Promise<CryptoKey | null> | null = null;

function available(): boolean {
  return typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && !!crypto.subtle;
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        r.onsuccess = () => resolve(r.result as T);
        r.onerror = () => reject(r.error);
      }),
  );
}

async function getKey(): Promise<CryptoKey | null> {
  keyPromise ??= (async () => {
    const existing = await tx<CryptoKey | undefined>("readonly", (s) => s.get(KEY_ID));
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    try {
      // `add`, not `put`: if another tab created a key meanwhile, use that one
      // instead of overwriting it (which would make its data unreadable).
      await tx("readwrite", (s) => s.add(key, KEY_ID));
      return key;
    } catch {
      return (await tx<CryptoKey | undefined>("readonly", (s) => s.get(KEY_ID))) ?? null;
    }
  })().catch(() => null);
  return keyPromise;
}

export async function saveSecure(name: string, value: unknown): Promise<void> {
  if (!available()) return;
  try {
    const key = await getKey();
    if (!key) return;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(value));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    await tx("readwrite", (s) => s.put({ iv, ct }, name));
  } catch {
    /* storage is best effort */
  }
}

export async function loadSecure<T>(name: string): Promise<T | null> {
  if (!available()) return null;
  try {
    const key = await getKey();
    if (!key) return null;
    const rec = await tx<{ iv: Uint8Array; ct: ArrayBuffer } | undefined>("readonly", (s) => s.get(name));
    if (!rec) return null;
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: rec.iv as BufferSource }, key, rec.ct);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

/** Removes every stored value and the encryption key. */
export async function wipeSecure(): Promise<void> {
  if (!available()) return;
  // Forget the key first: a save that is still running can then only produce
  // a record nobody can decrypt any more.
  keyPromise = null;
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* ignore */
  }
}
