/**
 * Open and Save on the web host (spec: docs/specs/web-files.md). Where
 * the browser has the File System Access API (Chrome, Edge), these are
 * real files on the user's disk and Save writes back to the same one;
 * elsewhere Open reads an uploaded file and Save downloads one.
 * Nothing leaves the machine either way.
 */

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface FsWindow {
  showOpenFilePicker?: (o: {
    types: PickerType[];
    multiple?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (o: {
    suggestedName: string;
    types: PickerType[];
  }) => Promise<FileSystemFileHandle>;
}
interface WritableHandle {
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

const TYPES: PickerType[] = [
  {
    description: "folio document",
    accept: { "text/markdown": [".md", ".markdown"] },
  },
];

export interface WebFile {
  name: string;
  /** Real-file handle (File System Access), or null for a download. */
  handle: FileSystemFileHandle | null;
}

const fsw = (): FsWindow => window as unknown as FsWindow;

/** Real files on disk (not upload/download)? */
export function hasRealFiles(): boolean {
  return typeof fsw().showOpenFilePicker === "function";
}

const aborted = (e: unknown): boolean =>
  e instanceof DOMException && e.name === "AbortError";

/** Pick a document. Null when cancelled. */
export async function openWebFile(): Promise<
  (WebFile & { text: string }) | null
> {
  const pick = fsw().showOpenFilePicker;
  if (pick) {
    try {
      const [handle] = await pick({ types: TYPES, multiple: false });
      if (!handle) return null;
      const file = await handle.getFile();
      return { name: file.name, handle, text: await file.text() };
    } catch (e) {
      if (aborted(e)) return null;
      throw e;
    }
  }
  // Upload: the browser's own file chooser.
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,text/markdown,text/plain";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      void file
        .text()
        .then((text) => resolve({ name: file.name, handle: null, text }));
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/**
 * Save `text`. With a real-file handle it writes back to that file;
 * otherwise it asks where (real files) or downloads `name`. Null when
 * cancelled.
 */
export async function saveWebFile(
  text: string,
  name: string,
  handle: FileSystemFileHandle | null,
): Promise<WebFile | null> {
  const save = fsw().showSaveFilePicker;
  if (handle || save) {
    try {
      const target =
        handle ??
        (save ? await save({ suggestedName: name, types: TYPES }) : null);
      if (!target) return null;
      const out = await (target as unknown as WritableHandle).createWritable();
      await out.write(text);
      await out.close();
      return { name: target.name, handle: target };
    } catch (e) {
      if (aborted(e)) return null;
      throw e;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { name, handle: null };
}
