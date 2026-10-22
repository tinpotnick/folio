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

/** Save an exported text file (an STL model, ...) through a native
 * dialog. Returns the path, or null when cancelled / not desktop. */
export async function saveTextFile(
  text: string,
  filename: string,
  filterName: string,
): Promise<string | null> {
  if (!isDesktop()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  const extension = filename.split(".").pop() ?? "txt";
  try {
    return await invoke<string>("save_text_file", {
      text,
      suggested: filename,
      filterName,
      extension,
    });
  } catch {
    return null;
  }
}

/** Open a web (or mailto) address in the user's own browser. The
 * shell refuses anything else (ADR-0024). False when not desktop or
 * refused. */
export async function openExternal(url: string): Promise<boolean> {
  if (!isDesktop()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("open_external", { url });
    return true;
  } catch {
    return false;
  }
}

export type ExportResult =
  { ok: true; path: string } | { ok: false; reason: string };

/** Export the page as a PDF file: a native save dialog, then the
 * print stylesheet written straight to it (ADR-0025). `reason` is
 * "cancelled", "unsupported" (not built on this platform yet, or not
 * desktop), or the error. */
export async function exportPdfFile(suggested: string): Promise<ExportResult> {
  if (!isDesktop()) return { ok: false, reason: "unsupported" };
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return {
      ok: true,
      path: await invoke<string>("export_pdf", { suggested }),
    };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}
