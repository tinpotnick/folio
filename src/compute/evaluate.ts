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

const INFO_RE = /(?:^|\s)data=([@\w,-]+)(?:\s+out=([\w,-]+))?/;

/** Parse a fence's info string. Null when the block does not
 * compute (a plain ```python fence is inert code, like GitHub's). */
export function parseComputeInfo(
  info: string | undefined,
): ComputeBinding | null {
  if (info === undefined || info === "") return null;
  const m = INFO_RE.exec(info);
  if (!m) return null;
  const data = (m[1] ?? "")
    .split(",")
    .map((s) => s.replace(/^@/, ""))
    .filter(Boolean);
  const out = (m[2] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { data, out };
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
export type ComputeTable =
  | Record<string, unknown>[] // columns inferred from the first row
  | { columns: Column[]; rows: unknown[][] }; // explicit

/** A script's return value: one table, or a tuple matching `out=`. */
export type ComputeReturn = ComputeTable | ComputeTable[];

/** Validate a script's return value against the declared outputs
 * (matched by position) and normalize each to a Table model with
 * the declared id. Errors carry the spec's wording. */
export function computeOutputs(
  binding: ComputeBinding,
  returned: ComputeReturn,
): Table[] {
  if (binding.out.length === 0)
    throw new Error("no out= - a compute block must name its output datasets");
  // One out: the whole return is ONE table (a list of dicts is
  // rows, not a tuple). Several: a tuple, matched by position.
  const values =
    binding.out.length === 1
      ? [returned]
      : Array.isArray(returned)
        ? returned
        : [returned];
  if (values.length !== binding.out.length)
    throw new Error(
      `returned ${String(values.length)} table${values.length === 1 ? "" : "s"} but out= names ${String(binding.out.length)} - return one table per name, as a tuple`,
    );
  return values.map((value, i) => {
    const id = binding.out[i] ?? "";
    const table = normalizeTable(value as ComputeTable);
    return { ...table, id };
  });
}

/** A return value as a Table: a list of dicts infers columns from
 * the first row (types as table import infers them), or a
 * `{columns, rows}` dict names them explicitly. */
function normalizeTable(value: ComputeTable): Omit<Table, "id"> {
  if (Array.isArray(value)) {
    if (value.length === 0)
      throw new Error(
        "returned an empty table - the first row names the columns",
      );
    const first = value[0];
    if (typeof first !== "object" || first === null)
      throw new Error("a table is a list of dicts keyed by column name");
    const columns: Column[] = Object.keys(first).map((name) => ({
      name,
      type: inferType(value.map((r) => (r as Record<string, unknown>)[name])),
    }));
    const rows = value.map((r) =>
      columns.map((c) => normalizeCell((r as Record<string, unknown>)[c.name])),
    );
    return { columns, rows };
  }
  // Explicit form: column names/types/units given by the script.
  if (
    value === null ||
    typeof value !== "object" ||
    !Array.isArray(value.columns) ||
    !Array.isArray(value.rows)
  )
    throw new Error(
      "a table is a list of dicts, or {columns, rows} with names and types",
    );
  return {
    columns: value.columns,
    rows: value.rows.map((row) =>
      (row as unknown[]).map((cell) => normalizeCell(cell)),
    ),
  };
}

/** The declared/inferred column types, as table import infers. */
function inferType(values: unknown[]): Column["type"] {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number" || typeof v === "boolean") return "number";
    return "text";
  }
  return "text";
}

/** A cell as the document model stores it. */
function normalizeCell(value: unknown): Cell {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * A Python error as the figure says it: the error itself and the
 * script's line - not Pyodide's traceback through its own internals.
 * The script runs as the body of `__folio_compute__`, one line below
 * the `async def`, so the user's line is one less than Python's.
 */
export function pythonError(e: unknown): string {
  const msg = (e instanceof Error ? e.message : String(e)).trim();
  const last = msg.split("\n").pop() ?? msg;
  const at = [...msg.matchAll(/File "<exec>", line (\d+)/g)].pop();
  if (!at) return last;
  const line = Number(at[1]) - 1;
  return line >= 1 ? `${last} (line ${String(line)})` : last;
}
