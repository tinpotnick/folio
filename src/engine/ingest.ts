/**
 * Data ingest: CSV and JSON into typed tables (ADR-0005 - the
 * import SNAPSHOT becomes the document's data; `import:` records
 * provenance metadata; nothing is ever a live binding).
 * Pure engine code, zero UI dependencies.
 */
import type { Cell, Table } from "./index.js";
import { toIso } from "./dates.js";

type ImportType = "text" | "number" | "date";

export interface ParsedImport {
  columns: { name: string; type: ImportType }[];
  rows: Cell[][];
}

/**
 * RFC-4180 CSV: quoted fields, commas and newlines inside quotes,
 * doubled quotes as escapes, CRLF or LF rows. The first row is the
 * header. Column types are inferred: a column is `number` when
 * every non-empty value is numeric and at least one is present.
 */
export function parseCsv(text: string): ParsedImport {
  const rows = csvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length === 0) throw new Error("CSV is empty");
  const header = rows[0] ?? [];
  const dataRows = rows.slice(1).filter((r) => r.length > 1 || r[0] !== "");
  const width = header.length;
  const names = sanitizeNames(header);
  const types = inferTypes(dataRows, width);
  return applyTypes({
    columns: names.map((name, i) => ({
      name,
      type: types[i] ?? "text",
    })),
    rows: dataRows.map((r) => pad(r, width)),
  });
}

/**
 * A column typed `number` carries actual numbers (the model
 * contract formulas and formats rely on): numeric strings convert,
 * empties stay empty.
 */
function applyTypes(parsed: ParsedImport): ParsedImport {
  return {
    columns: parsed.columns,
    rows: parsed.rows.map((row) =>
      row.map((v, c) => {
        const type = parsed.columns[c]?.type;
        if (type === "date") {
          // Dates are written ISO, whatever shape they came in.
          return isMissing(v) ? "" : (toIso(String(v)) ?? v);
        }
        if (type !== "number") return v;
        if (typeof v === "number") return v;
        const s = String(v).trim();
        return isMissing(s) ? "" : NUMBER_RE.test(s) ? parseFloat(s) : v;
      }),
    ),
  };
}

/**
 * JSON: an array of objects (keys become columns, in first-seen
 * order) or an array of arrays whose first row is a string header.
 * Anything else is an error with guidance.
 */
export function parseJsonTable(text: string): ParsedImport {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      "JSON must be an array of objects (or of arrays with a header row)",
    );
  }
  if (
    value.every((r) => typeof r === "object" && r !== null && !Array.isArray(r))
  ) {
    const records = value as Record<string, unknown>[];
    const names: string[] = [];
    for (const rec of records) {
      for (const key of Object.keys(rec)) {
        if (!names.includes(key)) names.push(key);
      }
    }
    const sanitized = sanitizeNames(names);
    const rows: Cell[][] = records.map((rec) =>
      names.map((n) => toCell(rec[n])),
    );
    const types = inferTypes(rows, names.length);
    return applyTypes({
      columns: sanitized.map((name, i) => ({
        name,
        type: types[i] ?? "text",
      })),
      rows,
    });
  }
  if (value.every((r) => Array.isArray(r))) {
    const arrays = value as unknown[][];
    const header = arrays[0] ?? [];
    if (!header.every((h) => typeof h === "string")) {
      throw new Error(
        "JSON array-of-arrays must start with a string header row",
      );
    }
    const dataRows = arrays.slice(1) as Cell[][];
    const names = sanitizeNames(header.map((h) => String(h)));
    const types = inferTypes(dataRows, header.length);
    return applyTypes({
      columns: names.map((name, i) => ({
        name,
        type: types[i] ?? "text",
      })),
      rows: dataRows.map((r) => pad(r, header.length)),
    });
  }
  throw new Error(
    "JSON must be an array of objects (or of arrays with a header row)",
  );
}

/**
 * The imported table, ready for the document: provenance rides the
 * `import:` key (snapshot + metadata, ADR-0005).
 */
export function importedTable(
  id: string,
  parsed: ParsedImport,
  origin: string,
): Table {
  return {
    id,
    columns: parsed.columns,
    rows: parsed.rows,
    import: origin,
  };
}

/** Parse by format name; a sniff falls back to CSV. */
export function parseImport(
  text: string,
  format: "csv" | "json",
): ParsedImport {
  return format === "json" ? parseJsonTable(text) : parseCsv(text);
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = (): void => {
    row.push(field);
    field = "";
  };
  const pushRow = (): void => {
    pushField();
    // Trailing empty fields from a trailing delimiter are kept;
    // a fully empty line ([] or [""]) is a blank row, dropped.
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const ch = text[i] ?? "";
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

const NUMBER_RE = /^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$/;

/** An empty cell - or a published "no value": FRED writes ".", others
 * "NA" or "n/a". */
function isMissing(v: unknown): boolean {
  const s = typeof v === "string" ? v.trim() : v;
  return (
    s === "" ||
    s === undefined ||
    s === null ||
    s === "." ||
    (typeof s === "string" && /^(na|n\/a|null|#n\/a)$/i.test(s))
  );
}

/**
 * A column is `number` when every value present is numeric, `date`
 * when every value is a date `toIso` reads (ISO, "31 Jan 2024", "2024
 * JAN", ...), otherwise `text`. Missing markers are skipped.
 */
function inferTypes(rows: Cell[][], width: number): ImportType[] {
  const types: ImportType[] = [];
  for (let c = 0; c < width; c++) {
    let numeric = true;
    let dates = true;
    let seen = false;
    for (const row of rows) {
      const v = row[c];
      if (isMissing(v)) continue;
      seen = true;
      if (typeof v !== "number" && !NUMBER_RE.test(String(v).trim())) {
        numeric = false;
      }
      if (typeof v === "number" || toIso(String(v)) === null) dates = false;
      if (!numeric && !dates) break;
    }
    types.push(!seen ? "text" : numeric ? "number" : dates ? "date" : "text");
  }
  return types;
}

function toCell(v: unknown): Cell {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function pad(r: Cell[], width: number): Cell[] {
  const out = r.slice(0, width);
  while (out.length < width) out.push("");
  return out;
}

/**
 * Header names become column names: identifier-legal (formulas and
 * cross-table references must be able to use them), deduped, never
 * empty. Spaces and dashes become underscores.
 */
export function sanitizeNames(header: string[]): string[] {
  const seen = new Set<string>();
  const lower = new Set<string>();
  return header.map((raw, i) => {
    let name = raw
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (name === "") name = `col_${String(i + 1)}`;
    if (/^[0-9]/.test(name)) name = `c_${name}`;
    let candidate = name;
    let n = 2;
    while (lower.has(candidate.toLowerCase())) {
      candidate = `${name}_${String(n)}`;
      n += 1;
    }
    seen.add(candidate);
    lower.add(candidate.toLowerCase());
    return candidate;
  });
}
