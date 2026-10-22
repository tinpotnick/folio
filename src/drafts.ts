/**
 * The unsaved draft (spec: docs/specs/web-files.md): unsaved work is
 * kept in the browser's storage as it changes, so closing the tab or
 * the app loses nothing; the next launch restores it. IndexedDB, not
 * localStorage: documents carry images and can be megabytes.
 */

export interface Draft {
  markdown: string;
  /** The file it belongs to, when it has one (its name only). */
  name: string | null;
  /** When it was last kept (ms since epoch). */
  at: number;
}

const DB = "folio-drafts";
const STORE = "drafts";
const KEY = "current";

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("storage unavailable"));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  act: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = act(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("storage failed"));
  });
}

export async function keepDraft(draft: Draft): Promise<void> {
  try {
    await run("readwrite", (s) => s.put(draft, KEY));
  } catch {
    // No storage (a private window): drafts are a safety net only.
  }
}

export async function readDraft(): Promise<Draft | null> {
  try {
    const d = (await run("readonly", (s) => s.get(KEY))) as Draft | undefined;
    return d && typeof d.markdown === "string" ? d : null;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(KEY));
  } catch {
    // Nothing kept, nothing to clear.
  }
}
