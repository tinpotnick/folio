/**
 * Desktop (Tauri) bridge for the host app (ADR-0006: hosts of the
 * component). Absent on plain web: every function fails soft so the
 * same page serves both targets. Open/Save map to native file
 * dialogs; the document remains plain Markdown text end to end.
 */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function openDocument(): Promise<string | null> {
  if (!isDesktop()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<string>("open_document");
  } catch {
    return null;
  }
}

export async function saveDocument(text: string): Promise<string | null> {
  if (!isDesktop()) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<string>("save_document", {
      text,
      suggested: "document.md",
    });
  } catch {
    return null;
  }
}
