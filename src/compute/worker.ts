/**
 * The compute sandbox (ADR-0030). A compute script is arbitrary
 * Python and runs on RENDER (it is a figure, not a Run button), so
 * it never runs in the page: it runs here, in a worker with no DOM,
 * no network, no scripts and no storage - the JSCAD doors
 * (src/jscad/worker.ts), shut BEFORE any document code runs. The
 * page sends `{ id, source, inputs }` and gets back the returned
 * tables or an error; a script that runs too long is terminated by
 * the page (the worker is replaced).
 */
import { inputName } from "./evaluate.js";

const scope = self as unknown as Record<string, unknown>;
for (const name of [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "indexedDB",
  "caches",
  "BroadcastChannel",
  "Worker",
  "SharedWorker",
]) {
  try {
    Object.defineProperty(scope, name, {
      value: undefined,
      writable: false,
      configurable: false,
    });
  } catch {
    scope[name] = undefined;
  }
}

type Job = {
  id: number;
  source: string;
  /** Dataset id (sans @) -> rows as dicts keyed by column name. */
  inputs: Record<string, Record<string, unknown>[]>;
  /** The page's `/pyodide/` base - the host computes it from its
   * own base URL, so the root, a subfolder and the desktop app
   * all find the same bundled runtime. */
  indexURL: string;
};

let boot: Promise<unknown> | null = null;
let bootURL = "";

/** Load Pyodide once (its chunk loads with this worker, so only
 * documents with a compute block pay for it). */
async function pyodide(indexURL: string): Promise<unknown> {
  if (boot === null || bootURL !== indexURL) {
    bootURL = indexURL;
    boot = import("pyodide").then((m) =>
      (m as { loadPyodide: (o: object) => Promise<unknown> }).loadPyodide({
        // The bundled runtime, never fetched at run time (ADR-0005):
        // vite copies pyodide's dist to /pyodide (vite.config.ts).
        indexURL,
      }),
    );
  }
  return boot;
}

self.addEventListener("message", async (ev: MessageEvent<Job>) => {
  const { id, source, inputs, indexURL } = ev.data;
  let py: {
    runPythonAsync: (code: string) => Promise<unknown>;
    toPy: (value: unknown) => { destroy?: () => void };
  };
  try {
    py = (await pyodide(indexURL)) as typeof py;
  } catch {
    self.postMessage({ id, error: "could not load the Python runtime" });
    return;
  }
  try {
    const globals = (
      py as unknown as {
        runPythonAsync: (code: string) => Promise<unknown>;
        toPy: (value: unknown) => { destroy?: () => void };
        globals: Map<string, unknown> & { destroy?: (name: string) => void };
      }
    ).globals as unknown as Map<string, unknown>;
    // Each bound dataset arrives as a named variable, and every
    // job runs clean: previous inputs (and returns) are cleared.
    const names: string[] = [];
    for (const [key, rows] of Object.entries(inputs)) {
      const name = inputName(key);
      const value = py.toPy(rows);
      globals.set(name, value);
      names.push(name);
    }
    globals.set("inputs", py.toPy(inputs));
    // Top-level `return` is not Python - the script is the body of
    // a function, so `return [{...}]` and `return a, b` work as the
    // spec writes them, and the script's own imports/defs stay
    // local to the job.
    const wrapped = `async def __folio_compute__():\n${source
      .split("\n")
      .map((l) => (l === "" ? "" : `    ${l}`))
      .join("\n")}\n`;
    await py.runPythonAsync(wrapped);
    const returned = await py.runPythonAsync("await __folio_compute__()");
    let plain: unknown;
    try {
      plain = (returned as { toJs?: (o?: object) => unknown }).toJs?.({
        dict_converter: Object.fromEntries,
      });
    } catch {
      plain = undefined;
    }
    for (const name of [...names, "inputs"]) globals.delete(name);
    self.postMessage({ id, returned: plain });
  } catch (e) {
    self.postMessage({
      id,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
