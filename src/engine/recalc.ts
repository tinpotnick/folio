/**
 * Formula recalculation over typed tables (ADR-0003, ADR-0005,
 * ADR-0012). Automatic and invisible: no execution affordances;
 * editing a cell updates every dependent formula.
 *
 * The expression language is Jexl plus a row context
 * (docs/specs/formulas.md). References are namespaced so the same
 * mechanism reaches other tables:
 *
 *   q2              current row's value (numeric or earlier formula)
 *   self.row        the current row number (1-based)
 *   self.prev.q2    the previous row; self.prev2.q2 two rows back
 *   self.r4.q2      row 4 of this table (1-based)
 *   budget.r3.q2    row 3 of the table with id "budget"
 *   budget.prev.q2  the LAST row of that table (a table has no
 *                  cursor inside another table's formula)
 *
 * All handles are ordinary Jexl context objects - no grammar is
 * bolted onto Jexl. Referenced tables recalc first (dependency
 * order, cycle-detected); their ids must be valid identifiers.
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

/** The Jexl transform set folio registers - shared with chart filters. */
export const TRANSFORMS = new Set([
  "round",
  "floor",
  "ceil",
  "abs",
  "min",
  "max",
]);
/** Jexl language keywords - shared with chart filters. */
export const KEYWORDS = new Set([
  "true",
  "false",
  "null",
  "and",
  "or",
  "not",
  "in",
]);

/** Other tables of the same document, by id (raw, not recalced). */
export type TablePool = (id: string) => Table | undefined;

type RefKind =
  | { kind: "number" }
  | { kind: "formula-earlier" }
  | { kind: "formula-self" }
  | { kind: "formula-later" }
  | { kind: "text" }
  | { kind: "unknown" };

type RowHandle =
  { kind: "distance"; n: number } | { kind: "absolute"; n: number };

interface SelfRef {
  handle: RowHandle;
  name: string | null; // null only for a bare handle (error, except row)
}

interface CrossRef {
  tableId: string;
  handle: RowHandle;
  name: string;
}

function parseHandle(raw: string): RowHandle | null {
  if (raw === "prev") return { kind: "distance", n: 1 };
  if (/^prev\d+$/.test(raw)) {
    return { kind: "distance", n: Number(raw.slice("prev".length)) };
  }
  if (/^r[0-9]+$/.test(raw)) {
    return { kind: "absolute", n: Number(raw.slice(1)) };
  }
  return null;
}

/**
 * Strip the folio reference marker: "@budget" reads as "budget".
 * `@` is not a Jexl token, so this is a pure token rename with no
 * disambiguation rules - but quoted strings keep their `@` intact.
 * Cross-table terminology stays identical to the chart query
 * language's `source: @budget`.
 */
function stripAtRefs(expr: string): string {
  const parts: string[] = [];
  const re = /'[^']*'|"[^"]*"|@/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr)) !== null) {
    if (m[0] !== "@") continue;
    parts.push(expr.slice(last, m.index));
    last = m.index + 1;
  }
  parts.push(expr.slice(last));
  return parts.join("");
}

export function recalcTable(table: Table, pool?: TablePool): Table {
  return recalcWithin(
    table,
    pool ?? ((): Table | undefined => undefined),
    new Map(),
    new Set(),
  );
}

function recalcWithin(
  table: Table,
  pool: TablePool,
  cache: Map<string, Table>,
  visiting: Set<string>,
): Table {
  const cached = cache.get(table.id);
  if (cached !== undefined) return cached;
  if (visiting.has(table.id)) {
    throw new Error(
      `circular table reference: '${table.id}' is already being computed`,
    );
  }
  visiting.add(table.id);
  try {
    return compute(table, pool, cache, visiting);
  } finally {
    visiting.delete(table.id);
  }
}

function compute(
  table: Table,
  pool: TablePool,
  cache: Map<string, Table>,
  visiting: Set<string>,
): Table {
  const formulaIndexes = table.columns
    .map((c, i) => ({ col: c, index: i }))
    .filter((x) => x.col.type === "formula");
  if (formulaIndexes.length === 0) {
    cache.set(table.id, table);
    return table;
  }

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

    // Static reference scan. Dotted chains (self.prev.q2,
    // budget.r3.q2) are row/table context accesses, not
    // current-row names: pull them out and neutralize them so the
    // plain-identifier scan stays honest. A hyphen in the head can
    // only be a table id (columns never contain dots or hyphens).
    const stripped = raw.replace(/'[^']*'|"[^"]*"/g, "");
    const selfRefs: SelfRef[] = [];
    const crossRefs: CrossRef[] = [];
    let selfRow = false;
    const neutralized = stripped.replace(
      /@?[A-Za-z_][A-Za-z0-9_-]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/g,
      (chain: string): string => {
        const [rawHead, ...segs] = chain.split(".");
        const head =
          rawHead !== undefined && rawHead.startsWith("@")
            ? rawHead.slice(1)
            : rawHead;
        if (head === undefined) return chain;
        if (head === "self") {
          if (segs.length === 1 && segs[0] === "row") {
            selfRow = true;
            return "_row__REF__";
          }
          if (segs.length !== 2) {
            fail(
              `self references are self.prev.q2, self.prevN.q2, self.r4.q2, self.row`,
            );
          }
          const handle = parseHandle(segs[0] ?? "");
          if (handle === null) {
            throw new Error(
              `Formula '${col.name}' in table '${table.id}': unknown self handle '${segs[0]}'`,
            );
          }
          selfRefs.push({ handle, name: segs[1] ?? null });
          return "_row__REF__";
        }
        // A table reference (possibly this table's own id).
        if (segs.length !== 2) {
          if (pool(head) !== undefined || head === table.id) {
            fail(
              `table reference '${head}' needs a row handle and a column: ${head}.r4.q2 (${head}.prev.q2 is its last row)`,
            );
          }
          if (indexByName.has(head)) {
            fail(`column '${head}' has no properties`);
          }
          return chain;
        }
        const handle = parseHandle(segs[0] ?? "");
        if (handle === null) {
          throw new Error(
            `Formula '${col.name}' in table '${table.id}': table reference '${head}' handles are prev (last row) or rN (row N), not '${segs[0]}'`,
          );
        }
        crossRefs.push({ tableId: head, handle, name: segs[1] ?? "" });
        return "_row__REF__";
      },
    );
    const plain = new Set<string>();
    for (const m of neutralized.matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)) {
      const name = m[0];
      if (name === "_row__REF__") continue;
      if (KEYWORDS.has(name) || TRANSFORMS.has(name)) continue;
      plain.add(name);
    }
    // A bare "@table" (no row handle and column) - the chain scan
    // above only consumed dotted chains.
    for (const m of neutralized.matchAll(/@[A-Za-z_][A-Za-z0-9_-]*/g)) {
      const id = (m[0] ?? "").slice(1);
      if (pool(id) !== undefined || id === table.id) {
        fail(
          `table reference '@${id}' needs a row handle and a column: @${id}.r4.q2 (@${id}.prev.q2 is its last row)`,
        );
      }
      fail(`unknown table '@${id}'`);
    }

    for (const name of plain) {
      if (name === "self") {
        fail("self needs a handle: self.prev.q2, self.r4.q2, self.row");
      }
      const kind = kindOf(name, index);
      if (kind.kind === "unknown") {
        if (name !== table.id && pool(name) !== undefined) {
          fail(
            `table reference '${name}' needs a row handle and a column: ${name}.r4.q2`,
          );
        }
        fail(`unknown column '${name}'`);
      }
      if (kind.kind === "text") fail(`non-numeric column '${name}'`);
      if (kind.kind === "formula-later") {
        fail(
          `later formula column '${name}' - a formula may only reference columns to its left`,
        );
      }
      if (kind.kind === "formula-self") {
        fail(
          `self-reference '${name}' - use self.prev.${name} for the previous row's value`,
        );
      }
    }
    for (const ref of selfRefs) {
      const handle = ref.handle;
      if (ref.name !== null) {
        const kind = kindOf(ref.name, index);
        if (kind.kind === "unknown") fail(`unknown column '${ref.name}'`);
        if (handle.kind === "distance" && handle.n < 1) {
          fail("row offsets start at 1 (self.prev = 1 row back)");
        }
        if (handle.kind === "absolute" && handle.n < 1) {
          fail("row indexes start at 1");
        }
      }
    }
    for (const ref of crossRefs) {
      const failTable = (msg: string): never =>
        fail(`table reference '${ref.tableId}': ${msg}`);
      const other = ref.tableId === table.id ? table : pool(ref.tableId);
      if (other === undefined) failTable("unknown table");
      if (/-/.test(ref.tableId)) {
        failTable(
          "referenced table ids must be valid identifiers - no hyphens",
        );
      }
      const target = other as Table;
      if (!target.columns.some((c) => c.name === ref.name)) {
        failTable(`unknown column '${ref.name}'`);
      }
      if (ref.handle.kind === "distance" && ref.handle.n !== 1) {
        failTable("cross-table prev is the LAST row; use rN for a row");
      }
      if (ref.handle.kind === "absolute" && ref.handle.n < 1) {
        failTable("row indexes start at 1");
      }
    }

    // Referenced tables recalc first (dependency order); the cache
    // makes each table compute once, and the visiting set turns
    // reference cycles into visible errors.
    const crossTables = new Map<string, Table>();
    for (const ref of crossRefs) {
      if (crossTables.has(ref.tableId)) continue;
      if (ref.tableId === table.id) {
        crossTables.set(ref.tableId, { ...table, rows });
        continue;
      }
      const other = pool(ref.tableId);
      if (other === undefined) {
        throw new Error(
          `Formula '${col.name}' in table '${table.id}': table reference '${ref.tableId}': unknown table`,
        );
      }
      crossTables.set(ref.tableId, recalcWithin(other, pool, cache, visiting));
    }

    const snapshot = (
      row: number,
      map: Map<string, number>,
      columns: Table["columns"],
      srcRows: Cell[][],
      ownIndex: number,
      currentRow: number,
    ): Record<string, unknown> => {
      const snap: Record<string, unknown> = {};
      for (const [name, i] of map) {
        const c = columns[i];
        if (c === undefined) continue;
        // The formula's OWN column is only computed for rows above
        // the current one; forward self-references read empty.
        if (c.type === "formula" && i === ownIndex && row >= currentRow) {
          snap[name] = Number.NaN;
          continue;
        }
        const v = srcRows[row]?.[i];
        snap[name] = v === undefined ? Number.NaN : v;
      }
      return snap;
    };

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
      const self: Record<string, unknown> = {};
      if (selfRow) self.row = r + 1;
      const selfSnap = (row: number): Record<string, unknown> =>
        snapshot(row, indexByName, table.columns, rows, index, r);
      for (const ref of selfRefs) {
        const key =
          ref.handle.kind === "distance"
            ? ref.handle.n === 1
              ? "prev"
              : `prev${String(ref.handle.n)}`
            : `r${String(ref.handle.n)}`;
        const row =
          ref.handle.kind === "distance" ? r - ref.handle.n : ref.handle.n - 1;
        // Out-of-range reads are NaN snapshots: empty, never an
        // engine error.
        self[key] = selfSnap(row);
      }
      ctx.self = self;
      for (const ref of crossRefs) {
        const target = crossTables.get(ref.tableId);
        if (target === undefined) continue;
        const tMap = new Map(
          target.columns.map((c, i) => [c.name, i] as const),
        );
        const tSnap = (row: number): Record<string, unknown> =>
          snapshot(row, tMap, target.columns, target.rows, -1, -1);
        const entry = (ctx[ref.tableId] ?? {}) as Record<string, unknown>;
        if (ref.handle.kind === "distance") {
          entry.prev = tSnap(target.rows.length - 1);
        } else {
          entry[`r${String(ref.handle.n)}`] = tSnap(ref.handle.n - 1);
        }
        ctx[ref.tableId] = entry;
      }

      const src = rows[r] ?? [];
      const out: Cell[] = table.columns.map((_, i) => src[i] ?? "");
      let result: Cell;
      try {
        const v = jexl.evalSync(stripAtRefs(raw), ctx) as Cell;
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
  const result = { ...table, rows };
  cache.set(table.id, result);
  return result;
}
