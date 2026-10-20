/**
 * Chart query execution over typed tables (ADR-0004).
 * A chart is a query; this module computes it headlessly.
 */
import jexl from "jexl";
import type { Cell, Chart, Table } from "./index.js";
import { CONSTANTS, KEYWORDS, TRANSFORMS } from "./recalc.js";

export interface QueryResult {
  columns: string[];
  rows: Cell[][];
}

function columnIndex(table: Table, name: string): number {
  const idx = table.columns.findIndex((c) => c.name === name);
  if (idx < 0) throw new Error(`Unknown column: '${name}' (table ${table.id})`);
  return idx;
}

function compare(a: Cell, b: Cell): number {
  const na = numericValue(a);
  const nb = numericValue(b);
  if (na !== null && nb !== null) return na - nb;
  if (na !== null) return -1;
  if (nb !== null) return 1;
  if (a === "" && b === "") return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  return String(a).localeCompare(String(b));
}

function numericValue(c: Cell): number | null {
  if (typeof c === "number") return c;
  if (
    typeof c === "string" &&
    c.trim() !== "" &&
    /^-?[0-9]+(\.[0-9]+)?$/.test(c.trim())
  ) {
    return parseFloat(c.trim());
  }
  return null;
}

/**
 * The row indexes a Jexl filter keeps, in model order. Indexes -
 * not rows - so callers (the chart pipeline, the dataset browser)
 * can map kept rows back to their model positions.
 */
export function filterIndexes(table: Table, expr: string): number[] {
  // A typo'd column must be a visible error, not a silently empty
  // result (Jexl resolves unknown names to undefined).
  const stripped = expr.replace(/'[^']*'|"[^"]*"/g, "");
  const known = new Set(table.columns.map((c) => c.name));
  for (const m of stripped.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    const name = m[0];
    if (KEYWORDS.has(name) || TRANSFORMS.has(name) || name in CONSTANTS) {
      continue;
    }
    if (!known.has(name)) {
      throw new Error(
        `Filter error: unknown column '${name}' (table ${table.id})`,
      );
    }
  }
  const out: number[] = [];
  table.rows.forEach((r, i) => {
    // Constants first, so a column of the same name shadows them.
    const ctx: Record<string, unknown> = { ...CONSTANTS };
    table.columns.forEach((c, ci) => {
      const v = r[ci];
      ctx[c.name] = v === undefined ? Number.NaN : v;
    });
    const keep = jexl.evalSync(expr, ctx);
    if (
      keep === true ||
      (typeof keep === "number" && keep !== 0 && Number.isFinite(keep))
    ) {
      out.push(i);
    }
  });
  return out;
}

/**
 * Row indexes sorted by one column - a view sort, never a model
 * write. Numbers first-class, empties last, text collated.
 */
export function sortIndexes(
  table: Table,
  by: string,
  order: "asc" | "desc",
): number[] {
  const idx = columnIndex(table, by);
  const sign = order === "desc" ? -1 : 1;
  return table.rows
    .map((_, i) => i)
    .sort((x, y) => {
      const a = table.rows[x]?.[idx] ?? "";
      const b = table.rows[y]?.[idx] ?? "";
      const aEmpty = a === "";
      const bEmpty = b === "";
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      if (aEmpty && bEmpty) return 0;
      return sign * compare(a, b);
    });
}

export function executeQuery(table: Table, chart: Chart): QueryResult {
  const { query } = chart;

  for (const name of query.select) columnIndex(table, name);

  // The pipeline works on MODEL ROW INDEXES so filter and sort
  // compose (sorting must not resurrect filtered-out rows - the
  // bug the old row-swap had).
  let indexes = table.rows.map((_, i) => i);
  if (query.filter) {
    if (typeof query.filter === "string") {
      // A Jexl expression filter: the same language as table
      // formulas, evaluated per row against the recalced table
      // (any column, text included: "q2 > 400 and region != 'South'").
      indexes = filterIndexes(table, query.filter);
    } else {
      const { column, op, value } = query.filter;
      const idx = columnIndex(table, column);
      indexes = indexes.filter((i) => {
        const cell = table.rows[i]?.[idx];
        if (cell === undefined) return false;
        switch (op) {
          case "eq":
            return cell === value;
          case "gt":
            return compare(cell, value) > 0;
          case "lt":
            return compare(cell, value) < 0;
          default:
            throw new Error(`Unknown filter op: '${op}'`);
        }
      });
    }
  }
  if (query.sort) {
    const keep = new Set(indexes);
    indexes = sortIndexes(table, query.sort.by, query.sort.order).filter((i) =>
      keep.has(i),
    );
  }
  const selected = query.select.map((name) => columnIndex(table, name));
  const rows = indexes.map((i) => table.rows[i] ?? []) as Cell[][];
  return {
    columns: query.select,
    rows: rows.map((r) => selected.map((i) => r[i] ?? "")),
  };
}
