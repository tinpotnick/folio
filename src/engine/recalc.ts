/**
 * Formula recalculation over typed tables (ADR-0003, ADR-0005,
 * ADR-0012). Automatic and invisible: no execution affordances;
 * editing a cell updates every dependent formula.
 *
 * The expression language is Jexl plus a ROW CONTEXT
 * (docs/specs/formulas.md): plain names read the current row;
 * `_prev.name` the previous row; `_r4.name` row 4 (rows are
 * 1-based); `_row` is the current row number. No folio-specific
 * grammar is bolted onto Jexl - the row context is ordinary
 * context objects, so evaluation stays plain Jexl.
 */
import jexl from "jexl";
import type { Cell, Table } from "./index.js";

// The reporting contract predates Jexl: a division by zero is a
// blank fact, not an error - the formula yields 0 rather than
// Infinity, so documents with empty denominators keep rendering.
// Registered at Jexl's default precedence for '/' (40) - a wrong
// precedence silently regroups every expression.
jexl.addBinaryOp("/", 40, (l: unknown, r: unknown): number => {
  const a = Number(l);
  const b = Number(r);
  return b === 0 ? 0 : a / b;
});

// A small, documented transform set (called with the pipe syntax,
// e.g. "growth * 100 | round()").
jexl.addTransform("round", (v: unknown, ...args: unknown[]): number =>
  Number(Number(v).toFixed(Number(args[0] ?? 0))),
);
jexl.addTransform("floor", (v: unknown): number => Math.floor(Number(v)));
jexl.addTransform("ceil", (v: unknown): number => Math.ceil(Number(v)));
jexl.addTransform("abs", (v: unknown): number => Math.abs(Number(v)));
jexl.addTransform("min", (a: unknown, ...args: unknown[]): number =>
  Math.min(Number(a), Number(args[0])),
);
jexl.addTransform("max", (a: unknown, ...args: unknown[]): number =>
  Math.max(Number(a), Number(args[0])),
);

const TRANSFORMS = new Set(["round", "floor", "ceil", "abs", "min", "max"]);
const KEYWORDS = new Set(["true", "false", "null", "and", "or", "not", "in"]);

type RefKind =
  | { kind: "number" }
  | { kind: "formula-earlier" }
  | { kind: "formula-self" }
  | { kind: "formula-later" }
  | { kind: "text" }
  | { kind: "unknown" };

interface RowRef {
  row: number;
  name: string;
}

export function recalcTable(table: Table): Table {
  const formulaIndexes = table.columns
    .map((c, i) => ({ col: c, index: i }))
    .filter((x) => x.col.type === "formula");
  if (formulaIndexes.length === 0) return table;

  const indexByName = new Map(
    table.columns.map((c, i) => [c.name, i] as const),
  );
  const kindOf = (name: string, own: number): RefKind => {
    const i = indexByName.get(name);
    if (i === undefined) return { kind: "unknown" };
    const c = table.columns[i];
    if (c === undefined) return { kind: "unknown" };
    if (c.type === "number") return { kind: "number" };
    if (c.type !== "formula") return { kind: "text" };
    if (i < own) return { kind: "formula-earlier" };
    if (i === own) return { kind: "formula-self" };
    return { kind: "formula-later" };
  };

  const rows: Cell[][] = table.rows.map((row) => row.slice());
  for (const { col, index } of formulaIndexes) {
    const raw = col.expr ?? "";
    const fail = (msg: string): never => {
      throw new Error(`Formula '${col.name}' in table '${table.id}': ${msg}`);
    };

    // Static reference scan. `_prev.x` / `_rN.x` are row-context
    // property accesses, not current-row names: pull them out and
    // neutralize them so the plain-identifier scan stays honest.
    const stripped = raw.replace(/'[^']*'|"[^"]*"/g, "");
    const prevNames = new Set<string>();
    const rowRefs: RowRef[] = [];
    const neutralized = stripped.replace(
      /(_prev|_r[0-9]+)\.([A-Za-z_][A-Za-z0-9_]*)/g,
      (_all: string, handle: string, name: string): string => {
        if (handle === "_prev") {
          prevNames.add(name);
        } else {
          rowRefs.push({ row: Number(handle.slice(2)), name });
        }
        return "_row__REF__";
      },
    );
    const plain = new Set<string>();
    for (const m of neutralized.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
      const name = m[0];
      if (name === "_prev" || name === "_row" || name === "_row__REF__") {
        continue;
      }
      if (KEYWORDS.has(name) || TRANSFORMS.has(name)) continue;
      plain.add(name);
    }

    for (const name of plain) {
      const kind = kindOf(name, index);
      if (kind.kind === "unknown") fail(`unknown column '${name}'`);
      if (kind.kind === "text") fail(`non-numeric column '${name}'`);
      if (kind.kind === "formula-later") {
        fail(
          `later formula column '${name}' - a formula may only reference columns to its left`,
        );
      }
      if (kind.kind === "formula-self") {
        fail(
          `self-reference '${name}' - use _prev.${name} for the previous row's value`,
        );
      }
    }
    for (const name of prevNames) {
      const kind = kindOf(name, index);
      if (kind.kind === "unknown") fail(`unknown column '${name}'`);
    }
    for (const ref of rowRefs) {
      const kind = kindOf(ref.name, index);
      if (kind.kind === "unknown") fail(`unknown column '${ref.name}'`);
      if (kind.kind === "formula-later") {
        fail(
          `later formula column '${ref.name}' - a formula may only reference columns to its left`,
        );
      }
      if (ref.row < 1) fail("row indexes start at 1");
    }

    table.rows.forEach((_row, r) => {
      const ctx: Record<string, unknown> = {};
      for (const [name, i] of indexByName) {
        const c = table.columns[i];
        if (c === undefined) continue;
        if (c.type === "number") {
          const v = rows[r]?.[i];
          ctx[name] = typeof v === "number" ? v : Number.NaN;
        } else if (c.type === "formula" && i < index) {
          // Earlier formula columns: computed-so-far at this row.
          const v = rows[r]?.[i];
          ctx[name] = v === undefined ? Number.NaN : v;
        }
      }
      ctx._row = r + 1;
      const snapshot = (row: number): Record<string, unknown> => {
        const snap: Record<string, unknown> = {};
        for (const [name, i] of indexByName) {
          const c = table.columns[i];
          if (c === undefined) continue;
          // The formula's OWN column is only computed for rows
          // above the current one; forward self-references read
          // empty (undefined -> NaN).
          if (c.type === "formula" && i === index && row >= r) {
            snap[name] = Number.NaN;
            continue;
          }
          const v = rows[row]?.[i];
          snap[name] = v === undefined ? Number.NaN : v;
        }
        return snap;
      };
      ctx._prev = snapshot(r - 1);
      for (const ref of rowRefs) {
        if (ref.row >= 1 && ref.row <= rows.length) {
          ctx[`_r${String(ref.row)}`] = snapshot(ref.row - 1);
        }
        // Out-of-range rows stay unset: Jexl reads undefined,
        // which arithmetics to NaN and renders empty.
      }

      const src = rows[r] ?? [];
      const out: Cell[] = table.columns.map((_, i) => src[i] ?? "");
      let result: Cell;
      try {
        const v = jexl.evalSync(raw, ctx) as Cell;
        result =
          typeof v === "number" ? (Number.isFinite(v) ? v : "") : (v ?? "");
      } catch (e) {
        throw new Error(
          `Formula '${col.name}' in table '${table.id}': ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
      out[index] = result;
      rows[r] = out;
    });
  }
  return { ...table, rows };
}
