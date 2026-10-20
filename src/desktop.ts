/**
 * Desktop (Tauri) bridge for the host app (ADR-0006: hosts of the
 * component). Absent on plain web: every function fails soft so the
 * same page serves both targets. Open/Save map to native file
 * dialogs; the document remains plain Markdown text end to end.
 */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface OpenedDocument {
  /** The file's absolute path: the host remembers it so the NEXT
   * open dialog starts in this folder (not the home folder). */
  path: string;
  text: string;
}

/** `current` is the open document's path - the dialog starts in
 * its folder. Returns null when cancelled or not on desktop. */
export async function openDocument(
  current?: string,
): Promise<OpenedDocument | null> {
  if (!isDesktop()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<OpenedDocument>("open_document", {
      current: current ?? null,
    });
  } catch {
    return null;
  }
}

/** `current` is the open document's path: the dialog starts in
 * its folder, defaulting the file name to the document's own. */
export async function saveDocument(
  text: string,
  current?: string,
): Promise<string | null> {
  if (!isDesktop()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  const suggested = current
    ? (current.split(/[\\/]/).pop() ?? "document.md")
    : "document.md";
  try {
    return await invoke<string>("save_document", {
      text,
      suggested,
      current: current ?? null,
    });
  } catch {
    return null;
  }
}
