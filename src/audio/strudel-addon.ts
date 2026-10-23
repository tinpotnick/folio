/**
 * The Strudel player as an add-on (ADR-0026). Strudel is AGPL-3.0;
 * folio is MIT, so folio's builds do not contain it. The first Play
 * of a strudel block asks, then downloads this exact, hash-pinned
 * release once and keeps it (IndexedDB) so it plays offline from
 * then on. Nothing is downloaded without that consent.
 */
import type * as StrudelWeb from "@strudel/web";

export type Strudel = typeof StrudelWeb;

export const STRUDEL_VERSION = "1.3.0";
const CDN = `https://cdn.jsdelivr.net/npm/@strudel/web@${STRUDEL_VERSION}/dist/`;

/** The release's files, pinned by SHA-256: code that is about to run
 * must be exactly the release the user agreed to, byte for byte. */
export const STRUDEL_FILES = {
  module: {
    path: "index.mjs",
    sha256: "50beb01abd04589333a10e078dce182c82e2de75b43e9bbe81a34bd069948931",
  },
  clock: {
    path: "assets/clockworker-ZDiUtESR.js",
    sha256: "effd682665d000035c72c378e9b6338ab996c0a13d847910caaaef0fec20984a",
  },
} as const;

/** Roughly what the download weighs, for the consent text. */
export const STRUDEL_SIZE = "about 850 KB";

const DB = "folio-addons";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("storage unavailable"));
  });
}

async function readFile(key: string): Promise<string | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () =>
      resolve(typeof req.result === "string" ? req.result : undefined);
    req.onerror = () => reject(req.error ?? new Error("read failed"));
  });
}

async function writeFile(key: string, text: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(text, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("write failed"));
  });
}

const keyOf = (path: string): string => `strudel@${STRUDEL_VERSION}/${path}`;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Installed (and still intact) on this machine? */
export async function strudelInstalled(): Promise<boolean> {
  try {
    for (const f of Object.values(STRUDEL_FILES)) {
      const text = await readFile(keyOf(f.path));
      if (text === undefined || (await sha256Hex(text)) !== f.sha256) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Where the files come from (tests answer this address locally). */
export function strudelUrl(path: string): string {
  return CDN + path;
}

/** Download, verify and keep the player. Throws a readable reason. */
export async function installStrudel(): Promise<void> {
  for (const f of Object.values(STRUDEL_FILES)) {
    let text: string;
    try {
      const res = await fetch(strudelUrl(f.path));
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      text = await res.text();
    } catch (e) {
      throw new Error(
        `could not download the Strudel player (${e instanceof Error ? e.message : String(e)}) - check the connection`,
      );
    }
    if ((await sha256Hex(text)) !== f.sha256) {
      throw new Error(
        "the downloaded Strudel player did not match the expected release, so it was not used",
      );
    }
    await writeFile(keyOf(f.path), text);
  }
}

let loaded: Promise<Strudel> | null = null;

/** The installed player, loaded once. Throws when not installed. */
export function loadStrudel(): Promise<Strudel> {
  loaded ??= (async () => {
    const [module, clock] = await Promise.all([
      readFile(keyOf(STRUDEL_FILES.module.path)),
      readFile(keyOf(STRUDEL_FILES.clock.path)),
    ]);
    if (module === undefined || clock === undefined) {
      throw new Error("the Strudel player is not installed");
    }
    // The module finds its clock worker beside itself
    // (`new URL("assets/...", import.meta.url)`); loaded from a blob
    // it has no "beside", so point it at the kept copy.
    const clockUrl = URL.createObjectURL(
      new Blob([clock], { type: "text/javascript" }),
    );
    const patched = module.replace(
      `new URL("${STRUDEL_FILES.clock.path}", import.meta.url)`,
      `new URL(${JSON.stringify(clockUrl)})`,
    );
    const url = URL.createObjectURL(
      new Blob([patched], { type: "text/javascript" }),
    );
    return (await import(/* @vite-ignore */ url)) as Strudel;
  })().catch((e: unknown) => {
    loaded = null;
    throw e;
  });
  return loaded;
}

/** The player if it is already running (Stop needs nothing more). */
export function strudelIfLoaded(): Promise<Strudel> | null {
  return loaded;
}
