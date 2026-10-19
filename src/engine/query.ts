/**
 * Chart query execution over typed tables (ADR-0004).
 * A chart is a query; this module computes it headlessly.
 */
import jexl from "jexl";
import type { Cell, Chart, Table } from "./index.js";
import { KEYWORDS, TRANSFORMS } from "./recalc.js";

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

export function executeQuery(table: Table, chart: Chart): QueryResult {
  const { query } = chart;

  for (const name of query.select) columnIndex(table, name);

  let rows = table.rows.slice();
  if (query.filter) {
    if (typeof query.filter === "string") {
      // A Jexl expression filter: the same language as table
      // formulas, evaluated per row against the recalced table
      // (any column, text included: "q2 > 400 and region != 'South'").
      const expr = query.filter;
      // A typo'd column must be a visible error, not a silently
      // empty chart (Jexl resolves unknown names to undefined).
      const stripped = expr.replace(/'[^']*'|"[^"]*"/g, "");
      const known = new Set(table.columns.map((c) => c.name));
      for (const m of stripped.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
        const name = m[0];
        if (KEYWORDS.has(name) || TRANSFORMS.has(name)) continue;
        if (!known.has(name)) {
          throw new Error(
            `Filter error: unknown column '${name}' (table ${table.id})`,
          );
        }
      }
      rows = rows.filter((r) => {
        const ctx: Record<string, unknown> = {};
        table.columns.forEach((c, i) => {
          const v = r[i];
          ctx[c.name] = v === undefined ? Number.NaN : v;
        });
        const keep = jexl.evalSync(expr, ctx);
        return (
          keep === true ||
          (typeof keep === "number" && keep !== 0 && Number.isFinite(keep))
        );
      });
    } else {
      const { column, op, value } = query.filter;
      const idx = columnIndex(table, column);
      rows = rows.filter((r) => {
        const cell = r[idx];
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
    const idx = columnIndex(table, query.sort.by);
    const order = query.sort.order === "desc" ? -1 : 1;
    rows = rows
      .map((r) => r.slice())
      .sort((x, y) => {
        const a = x[idx] ?? "";
        const b = y[idx] ?? "";
        const aEmpty = a === "";
        const bEmpty = b === "";
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        if (aEmpty && bEmpty) return 0;
        return order * compare(a, b);
      });
  }
  const selected = query.select.map((name) => columnIndex(table, name));
  return {
    columns: query.select,
    rows: rows.map((r) => selected.map((i) => r[i] ?? "")),
  };
}
