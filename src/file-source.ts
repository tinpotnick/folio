/**
 * The host file source behind save-time conflict detection (spec:
 * docs/specs/save-conflicts.md): stat() for the cheap check, read()
 * for the authoritative one. Desktop reads the open path through
 * Tauri; the web reads the File System Access handle. Null when there
 * is no source (in-memory doc, download-only web) - then the check
 * is skipped and Save behaves as before.
 */
import { isDesktop, readDocument, statDocument } from "./desktop.js";
import type { WebFile } from "./web-files.js";

export interface SourceStat {
  mtimeMs: number;
  size: number;
}

export interface FileSource {
  /** Null when the file is gone or unreadable. */
  stat(): Promise<SourceStat | null>;
  read(): Promise<string | null>;
}

/** SHA-256 of the text, hex. Falls back to a plain FNV-1a when
 *  crypto.subtle is unavailable (non-secure context): the hash only
 *  compares two reads of the same file, so any stable hash does. */
export async function hashText(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv-${h.toString(16)}-${text.length}`;
}

/** The source of the open document, if it has one on disk. */
export function sourceFor(
  currentDocPath: string | null,
  webFile: WebFile | null,
): FileSource | null {
  if (isDesktop() && currentDocPath !== null) {
    const path = currentDocPath;
    return {
      stat: () => statDocument(path),
      read: () => readDocument(path),
    };
  }
  const handle = webFile?.handle ?? null;
  if (handle) {
    return {
      stat: async () => {
        try {
          const f = await handle.getFile();
          return { mtimeMs: f.lastModified, size: f.size };
        } catch {
          return null;
        }
      },
      read: async () => {
        try {
          return await (await handle.getFile()).text();
        } catch {
          return null;
        }
      },
    };
  }
  return null;
}
