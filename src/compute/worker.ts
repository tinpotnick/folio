/**
 * The compute sandbox (ADR-0030). A compute script is arbitrary
 * Python and runs on RENDER (it is a figure, not a Run button), so
 * it never runs in the page: it runs here, in a worker with no DOM,
 * no network, no scripts and no storage - the JSCAD doors
 * (src/jscad/worker.ts), shut BEFORE any document code runs. The
 * page sends `{ id, source, inputs, out }` and gets back the `out=`
 * variables (tables and values) or an error; a script that runs too long is terminated by
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
  /** Input name -> the dataset's rows (dicts keyed by column name) and
   * its column names, in order. */
  inputs: Record<
    string,
    { rows: Record<string, unknown>[]; columns: string[] } | { value: unknown }
  >;
  /** The variables to publish (`out=`), in order. */
  out: string[];
  /** The page's `/pyodide/` base - the host computes it from its
   * own base URL, so the root, a subfolder and the desktop app
   * all find the same bundled runtime. */
  indexURL: string;
};

/**
 * Python that folio defines once, beside every script (ADR-0030):
 * `Table`, what an input arrives as - a list of row dicts, so plain
 * loops and indexing work, plus helpers that can grow without
 * breaking a script; and the export, which turns the `out=` variables
 * into plain tables and values (and lists the script's other
 * publishable variables, for the header's tick-boxes).
 */
const PRELUDE = `
import json as _json, math as _math, datetime as _dt

class Table(list):
    """A folio dataset: a list of row dicts (one per row), plus helpers."""
    def __init__(self, rows=(), columns=()):
        super().__init__(rows)
        self.columns = list(columns)
    def col(self, name):
        """One column, top to bottom, as a list."""
        if name not in self.columns:
            raise KeyError(f"no column {name!r} - the columns are: {', '.join(self.columns)}")
        return [r.get(name) for r in self]

def _folio_cell(v):
    if v is None:
        return ""
    if hasattr(v, "item") and not isinstance(v, (list, tuple, dict)):
        v = v.item()  # a numpy number
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return "" if isinstance(v, float) and not _math.isfinite(v) else v
    if isinstance(v, _dt.datetime):
        return v.isoformat()
    if isinstance(v, _dt.date):
        return v.isoformat()
    return str(v)

def _folio_table(v):
    """Rows and columns, or None when v is not a table."""
    if hasattr(v, "to_dict") and hasattr(v, "columns"):  # pandas
        cols = [str(c) for c in v.columns]
        return cols, [[_folio_cell(x) for x in r] for r in v.itertuples(index=False)]
    if isinstance(v, dict) and v and all(isinstance(c, (list, tuple)) for c in v.values()):
        cols = [str(k) for k in v]
        n = max(len(c) for c in v.values())
        return cols, [[_folio_cell(c[i] if i < len(c) else None) for c in v.values()] for i in range(n)]
    if isinstance(v, (list, tuple)) and v and all(isinstance(r, dict) for r in v):
        cols = list(getattr(v, "columns", []) or [])
        for r in v:
            for k in r:
                if str(k) not in cols:
                    cols.append(str(k))
        return cols, [[_folio_cell(r.get(c)) for c in cols] for r in v]
    return None

def _folio_value(v):
    if hasattr(v, "item") and not isinstance(v, (list, tuple, dict, str)):
        try:
            v = v.item()
        except Exception:
            return None
    if isinstance(v, (bool, int, float, str, _dt.date)):
        return _folio_cell(v)
    return None

def _folio_export(names, ns, skip):
    out = {}
    for n in names:
        if n not in ns:
            out[n] = {"error": f"out= names {n}, but the script never sets it"}
            continue
        v = ns[n]
        t = _folio_table(v)
        if t is not None:
            out[n] = {"columns": t[0], "rows": t[1]}
            continue
        if isinstance(v, (list, tuple, dict)) and not v:
            out[n] = {"error": f"{n} is empty - a table needs at least one row (its keys name the columns)"}
            continue
        x = _folio_value(v)
        if x is not None:
            out[n] = {"value": x}
            continue
        out[n] = {"error": f"{n} is a {type(v).__name__} - publish a table (a list of row dicts, a dict of column lists, a DataFrame) or a single number, text or date"}
    found = [
        k for k, v in ns.items()
        if not k.startswith("_") and k not in skip and k != "Table"
        and (_folio_table(v) is not None or _folio_value(v) is not None)
    ]
    return _json.dumps({"outputs": out, "found": found})
`;

type Py = {
  runPythonAsync: (
    code: string,
    opts?: { globals?: unknown },
  ) => Promise<unknown>;
  toPy: (value: unknown) => unknown;
  globals: { get: (name: string) => unknown };
};

let boot: Promise<Py> | null = null;
let bootURL = "";

/** Load Pyodide once (its chunk loads with this worker, so only
 * documents with a compute block pay for it), and define the prelude. */
async function pyodide(indexURL: string): Promise<Py> {
  if (boot === null || bootURL !== indexURL) {
    bootURL = indexURL;
    boot = import("pyodide")
      .then((m) =>
        (m as { loadPyodide: (o: object) => Promise<unknown> }).loadPyodide({
          // The bundled runtime, never fetched at run time (ADR-0005):
          // vite copies pyodide's dist to /pyodide (vite.config.ts).
          indexURL,
        }),
      )
      .then(async (raw) => {
        const py = raw as Py;
        await py.runPythonAsync(PRELUDE);
        return py;
      });
  }
  return boot;
}

// One job at a time: a job awaits several times, and two interleaved
// (two blocks rendering together) once ran each other's scripts and
// deleted each other's inputs. Each job also gets FRESH variables (its
// own namespace), so nothing leaks from one block - or one run - to
// the next.
let queue: Promise<void> = Promise.resolve();
self.addEventListener("message", (ev: MessageEvent<Job>) => {
  queue = queue.then(() => runJob(ev.data));
});

async function runJob(job: Job): Promise<void> {
  const { id, source, inputs, out, indexURL } = job;
  // The runtime's folder, fixed by the first job (see runtimeOnly).
  if (runtimeBase === "") {
    runtimeBase = new URL(indexURL, self.location.href).href;
  }
  let py: Py;
  try {
    py = await pyodide(indexURL);
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
  try {
    const makeDict = py.globals.get("dict") as () => {
      set: (k: string, v: unknown) => void;
      destroy?: () => void;
    };
    const ns = makeDict();
    const TableCls = py.globals.get("Table") as (
      rows: unknown,
      columns: unknown,
    ) => unknown;
    ns.set("Table", TableCls);
    const names: string[] = [];
    for (const [key, data] of Object.entries(inputs)) {
      const name = inputName(key);
      // A dataset arrives as a Table; a single value as itself.
      ns.set(
        name,
        "value" in data
          ? data.value
          : TableCls(py.toPy(data.rows), py.toPy(data.columns)),
      );
      names.push(name);
    }
    await py.runPythonAsync(source, { globals: ns });
    const exportFn = py.globals.get("_folio_export") as (
      names: unknown,
      ns: unknown,
      skip: unknown,
    ) => string;
    const result = JSON.parse(exportFn(py.toPy(out), ns, py.toPy(names))) as {
      outputs: Record<string, unknown>;
      found: string[];
    };
    ns.destroy?.();
    self.postMessage({ id, outputs: result.outputs, found: result.found });
  } catch (e) {
    self.postMessage({ id, error: pythonError(e) });
  }
}
