/**
 * Compute-block contract (spec: docs/specs/compute-blocks.md,
 * ADR-0030): parse `data=@a,@b out=x,y` fence info, turn datasets
 * into Python-visible inputs, and validate the script's return
 * value against the declared outputs. Pure and headless - the
 * sandbox lives in worker.ts, the figure in the component.
 */
import type { Cell, Column, Table } from "../engine/index.js";

/** `data=@budget,@rates out=forecast,sensitivity` — the fence info,
 * JSCAD's `params=` shape (spec: jscad-blocks.md, "Data"). */
export interface ComputeBinding {
  /** Dataset ids bound as inputs, `@` stripped. */
  data: string[];
  /** Output dataset ids, in declared order. */
  out: string[];
}

/** Parse a fence's info string. Null when the block does not
 * compute (a plain ```python fence is inert code, like GitHub's). */
export function parseComputeInfo(
  info: string | undefined,
): ComputeBinding | null {
  // Either key makes a python fence compute: data= (what it reads),
  // out= (what it publishes) - a script may make data from nothing.
  const data = /(?:^|\s)data=(\S+)/.exec(info ?? "")?.[1];
  const out = /(?:^|\s)out=(\S+)/.exec(info ?? "")?.[1];
  if (data === undefined && out === undefined) return null;
  const list = (v: string | undefined, strip: boolean): string[] =>
    (v ?? "")
      .split(",")
      .map((x) => (strip ? x.replace(/^@/, "") : x).trim())
      .filter(Boolean);
  return { data: list(data, true), out: list(out, false) };
}

/** Canonical fence-info form the header writes: `data=` before
 * `out=`, the JSCAD order. */
export function formatComputeInfo(binding: ComputeBinding): string {
  const parts: string[] = [];
  if (binding.data.length > 0)
    parts.push(`data=${binding.data.map((d) => `@${d}`).join(",")}`);
  if (binding.out.length > 0) parts.push(`out=${binding.out.join(",")}`);
  return parts.join(" ");
}

/** A dataset's rows as Python sees them: a list of dicts keyed by
 * column name, units in the schema not the values. */
export function datasetRows(table: Table): Record<string, unknown>[] {
  const names = table.columns.map((c) => c.name);
  return table.rows.map((row) => {
    const record: Record<string, unknown> = {};
    names.forEach((name, i) => {
      record[name] = row[i] ?? "";
    });
    return record;
  });
}

/** A Python-identifier input name: the dataset id sans `@`. An id
 * that is not an identifier (or a Python keyword) is an error, so
 * `budget` and `rates` work and `launch-budget` says why. */
export function inputName(id: string): string {
  if (/^[A-Za-z_]\w*$/.test(id) && !KEYWORDS.has(id)) return id;
  throw new Error(
    `dataset @${id} cannot be a variable name - rename it to a word like "budget"`,
  );
}

const KEYWORDS = new Set([
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
]);

/** The value shape a compute script returns: a table. */
/** A compute block's inputs, by Python name: rows and column names. */
export type ComputeInputs = Record<
  string,
  { rows: Record<string, unknown>[]; columns: string[] } | { value: unknown }
>;

/** A run's result: the `out=` variables, and every variable the
 * script could publish (for the header's tick-boxes). */
export interface ComputeResult {
  outputs: Record<string, ComputeExport>;
  found: string[];
}

/** One `out=` variable as the worker exported it (ADR-0030). */
export type ComputeExport =
  | { columns: string[]; rows: unknown[][] }
  | { value: unknown }
  | { error: string };

/**
 * The `out=` variables as document blocks: a table becomes a dataset,
 * a single number, text or date a value - each with its variable's
 * name as its `@id`, marked `computed: "python"` (the snapshot stored
 * after the block). A variable the script did not set, or one that is
 * neither, is an error naming it.
 */
export function computeOutputs(
  binding: ComputeBinding,
  exported: Record<string, ComputeExport>,
): Table[] {
  if (binding.out.length === 0)
    throw new Error(
      "no out= - name the variables to publish (out=fit,slope), or tick them in the header",
    );
  return binding.out.map((id) => {
    const x = exported[id];
    if (x === undefined)
      throw new Error(`out= names ${id}, but it was not exported`);
    if ("error" in x) throw new Error(x.error);
    if ("value" in x) {
      const v = normalizeCell(x.value);
      const type =
        typeof v === "number"
          ? "number"
          : /^\d{4}-\d{2}-\d{2}$/.test(v)
            ? "date"
            : "text";
      return {
        id,
        computed: "python",
        value: true,
        columns: [{ name: "value", type }],
        rows: [[v]],
      } satisfies Table;
    }
    const rows = x.rows.map((r) => r.map(normalizeCell));
    const columns: Column[] = x.columns.map((name, c) => ({
      name,
      type: inferType(rows.map((r) => r[c])),
    }));
    return { id, computed: "python", columns, rows } satisfies Table;
  });
}

/** A column's type, as table import infers: numbers, ISO dates, text. */
function inferType(values: unknown[]): Column["type"] {
  const filled = values.filter(
    (v) => v !== "" && v !== null && v !== undefined,
  );
  if (filled.length === 0) return "text";
  if (filled.every((v) => typeof v === "number")) return "number";
  if (
    filled.every((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))
  )
    return "date";
  return "text";
}

/** A cell as the document model stores it. */
function normalizeCell(value: unknown): Cell {
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * A Python error as the block says it: the error itself and the
 * script's line - not Pyodide's traceback through its own internals.
 */
export function pythonError(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).trim();
  const last = msg.split("\n").pop() ?? msg;
  const at = [...msg.matchAll(/File "<exec>", line (\d+)/g)].pop();
  const said = at ? `${last} (line ${at[1] ?? ""})` : last;
  // The first design returned tables; a script still doing so is told
  // what replaced it.
  return /'return' outside function/.test(last)
    ? `${said} - a script publishes variables instead: name them in out=`
    : said;
}
