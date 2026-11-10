// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { onWebLaunch, saveWebFile } from "../src/web-files";

/**
 * The web host's file APIs (spec: docs/specs/web-files.md): the
 * launchQueue consumer behind "Open with folio" on an installed app,
 * and Save asking for write permission on a launch handle before
 * writing back to it.
 */
describe("onWebLaunch", () => {
  it("routes launched files to the handler, skipping empty launches", () => {
    const seen: string[] = [];
    const box: { consumer: ((p: { files: unknown[] }) => void) | null } = {
      consumer: null,
    };
    (window as unknown as Record<string, unknown>).launchQueue = {
      setConsumer: (cb: (p: { files: unknown[] }) => void) => {
        box.consumer = cb;
      },
    };
    onWebLaunch((files) =>
      seen.push(...files.map((f) => (f as { name: string }).name)),
    );
    box.consumer?.({ files: [{ name: "a.md" }] });
    box.consumer?.({ files: [] });
    expect(seen).toEqual(["a.md"]);
  });

  it("is a no-op where there is no launchQueue", () => {
    delete (window as unknown as Record<string, unknown>).launchQueue;
    expect(() => onWebLaunch(() => undefined)).not.toThrow();
  });
});

describe("saveWebFile", () => {
  function fakeHandle(granted: string, calls: string[]) {
    return {
      name: "notes.md",
      queryPermission: async (o: { mode: string }) => {
        calls.push(`q:${o.mode}`);
        return granted;
      },
      requestPermission: async (o: { mode: string }) => {
        calls.push(`r:${o.mode}`);
        return "granted";
      },
      createWritable: async () => ({
        write: async (d: string) => {
          calls.push(`w:${d}`);
        },
        close: async () => {
          calls.push("close");
        },
      }),
    } as unknown as FileSystemFileHandle;
  }

  it("asks for write permission on a read-only launch handle, then writes back", async () => {
    const calls: string[] = [];
    const handle = fakeHandle("prompt", calls);
    const res = await saveWebFile("# Hi\n", "notes.md", handle);
    expect(res?.handle).toBe(handle);
    expect(calls).toEqual(["q:readwrite", "r:readwrite", "w:# Hi\n", "close"]);
  });

  it("does not prompt when write is already granted", async () => {
    const calls: string[] = [];
    await saveWebFile("x", "notes.md", fakeHandle("granted", calls));
    expect(calls).toEqual(["q:readwrite", "w:x", "close"]);
  });
});
