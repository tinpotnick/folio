/**
 * Cell-value validation for typed table columns (spec:
 * docs/specs/spellcheck-grammar.md "Typed columns" and
 * docs/specs/block-schema.md's ColumnType). Pure engine - no UI - so
 * it is unit-testable headlessly (ADR: the engine has zero UI deps).
 *
 * The editor uses it to underline a typed cell whose text is NOT a
 * valid value of its column's type (instead of spell-checking data:
 * numbers and dates are not words). Types:
 *   text     - anything (spell-checked as prose instead)
 *   number   - the same shape the engine's cell() coerces: -?digits(.digits)?
 *   date     - anything toIso() reads (ISO YYYY-MM-DD and the common
 *              published shapes), so a real calendar date
 *   datetime - same reader (ISO date-time included)
 *   select   - one of the column's options (comma-separated when multi)
 *   formula / relation - computed, never hand-edited: always valid
 */
import { toIso } from "./dates.js";
import type { Table } from "./index.js";

export type Column = Table["columns"][number];

/** Human-readable "expected" hint for the invalid-value menu. */
export function expectedFor(col: Column): string {
  switch (col.type) {
    case "number":
      return "a number, e.g. 42 or 3.14";
    case "date":
      return "a date, e.g. 2026-11-17";
    case "datetime":
      return "a date and time, e.g. 2026-11-17T09:30:00Z";
    case "select":
      return `one of: ${(col.options ?? []).join(", ")}`;
    default:
      return "a valid value";
  }
}

const NUMBER_RE = /^-?[0-9]+(\.[0-9]+)?$/;

/** Is `value` a valid cell for a column of this type? Empty is valid
 * (an empty cell is not an error). */
export function isValidCellValue(col: Column, value: string): boolean {
  const v = value.trim();
  if (v === "") return true;
  switch (col.type) {
    case "text":
      return true;
    case "number":
      return NUMBER_RE.test(v);
    case "date":
    case "datetime":
      return toIso(v) !== null;
    case "select": {
      const opts = new Set(col.options ?? []);
      const parts = col.multi ? v.split(",").map((p) => p.trim()) : [v];
      return parts.every((p) => opts.has(p));
    }
    case "formula":
    case "relation":
      return true; // computed cells are never hand-edited
    default:
      return true;
  }
}
