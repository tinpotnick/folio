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
import { inputName, pythonError } from "./evaluate.js";

const scope = self as unknown as Record<string, unknown>;

// fetch stays - for the bundled runtime ONLY. Pyodide fetches its own
// files (pyodide.asm.wasm, the standard library, the lock file) from
// the page's /pyodide/ folder; with fetch removed outright, as the
// other doors are, Python could never start ("could not load the
// Python runtime", everywhere). The folder is set by the first job,
// before anything loads; any other address is refused, so a script
// still reaches no network (urllib, which uses XMLHttpRequest, finds
// that door shut).
const realFetch = self.fetch.bind(self);
let runtimeBase = "";
const runtimeOnly = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    self.location.href,
  ).href;
  if (runtimeBase !== "" && url.startsWith(runtimeBase)) {
    return realFetch(input, init);
  }
  return Promise.reject(
    new TypeError(`no network in a compute block (${url})`),
  );
};
Object.defineProperty(scope, "fetch", {
  value: runtimeOnly,
  writable: false,
  configurable: false,
});

for (const name of [
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

// One job at a time. A job's inputs, its script (defined as the global
// __folio_compute__) and its cleanup all live in Python's globals, and
// a job awaits several times; two jobs interleaved - two blocks
// rendering together - ran each other's scripts ("returned 14 tables")
// and deleted each other's inputs (KeyError: 'takings').
let queue: Promise<void> = Promise.resolve();
self.addEventListener("message", (ev: MessageEvent<Job>) => {
  queue = queue.then(() => runJob(ev.data));
});

async function runJob(job: Job): Promise<void> {
  const { id, source, inputs, indexURL } = job;
  // The runtime's folder, fixed by the first job (see runtimeOnly).
  if (runtimeBase === "")
    runtimeBase = new URL(indexURL, self.location.href).href;
  let py: {
    runPythonAsync: (code: string) => Promise<unknown>;
    toPy: (value: unknown) => { destroy?: () => void };
  };
  try {
    py = (await pyodide(indexURL)) as typeof py;
  } catch (e) {
    // Say why: a bare "could not load" hid a sandbox that had shut
    // the runtime's own fetch.
    const why = e instanceof Error ? e.message : String(e);
    self.postMessage({
      id,
      error: `could not load the Python runtime (${why})`,
    });
    return;
  }
  // The page's time limit runs from here: not while the job waits its
  // turn, nor while the runtime loads.
  self.postMessage({ id, started: true });
  const names: string[] = [];
  let globals: Map<string, unknown> | null = null;
  try {
    globals = (
      py as unknown as {
        runPythonAsync: (code: string) => Promise<unknown>;
        toPy: (value: unknown) => { destroy?: () => void };
        globals: Map<string, unknown> & { destroy?: (name: string) => void };
      }
    ).globals as unknown as Map<string, unknown>;
    // Each bound dataset arrives as a named variable, and every
    // job runs clean: its inputs are cleared after it (finally).
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
    // A Python object converts; a plain value (`return 42`) is already
    // one, and goes as it is - so the page can say it is not a table
    // (it went as undefined, and the check crashed on null).
    const proxy = returned as { toJs?: (o?: object) => unknown } | null;
    const plain =
      typeof proxy?.toJs === "function"
        ? proxy.toJs({ dict_converter: Object.fromEntries })
        : returned;
    self.postMessage({ id, returned: plain ?? null });
  } catch (e) {
    self.postMessage({ id, error: pythonError(e) });
  } finally {
    // Cleared even when the script fails: the next job starts clean.
    for (const name of [...names, "inputs"]) globals?.delete(name);
  }
}
