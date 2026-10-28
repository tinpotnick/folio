import { describe, expect, it } from "vitest";
import { recalcTable } from "../../src/engine/recalc";
import type { Table } from "../../src/engine/index";

/** A blank is no value (docs/specs/formulas.md, "Blanks"). */
describe("blanks stay blank", () => {
  it("in arithmetic, a blank earlier formula gives a blank, not a 0", () => {
    const t: Table = {
      id: "t",
      columns: [
        { name: "n", type: "number" },
        // Blank past row 2, as a model past its term or its data is.
        { name: "a", type: "formula", expr: 'n <= 2 ? n * 10 : ""' },
        { name: "b", type: "formula", expr: "a * 2" },
        {
          name: "run",
          type: "formula",
          expr: "(self.row == 1 ? 0 : self.prev.run) + a",
        },
      ],
      rows: [
        [1, "", "", ""],
        [2, "", "", ""],
        [3, "", "", ""],
      ],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[2])).toEqual([20, 40, ""]);
    // A running total through a blank is blank, not "carried on".
    expect(out.rows.map((r) => r[3])).toEqual([10, 30, ""]);
  });

  it("aggregates skip blanks: last() is the last value, not a 0", () => {
    const t: Table = {
      id: "t",
      columns: [
        { name: "n", type: "number" },
        { name: "a", type: "formula", expr: 'n <= 2 ? n : ""' },
        { name: "last", type: "formula", expr: "self.col.a | last()" },
        { name: "count", type: "formula", expr: "self.col.a | count()" },
      ],
      rows: [
        [1, "", "", ""],
        [2, "", "", ""],
        [3, "", "", ""],
      ],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[2]).toBe(2);
    expect(out.rows[0]?.[3]).toBe(2);
  });

  it("asof over a long price table is quick (keys read once)", () => {
    const prices: Table = {
      id: "p",
      columns: [
        { name: "date", type: "date" },
        { name: "v", type: "number" },
      ],
      rows: Array.from({ length: 3000 }, (_, i) => {
        const y = 1800 + Math.floor(i / 12);
        const m = String((i % 12) + 1).padStart(2, "0");
        return [`${String(y)}-${m}-01`, i];
      }),
    };
    const plan: Table = {
      id: "plan",
      columns: [
        { name: "n", type: "number" },
        {
          name: "month",
          type: "formula",
          expr: "eomonth('1990-01-01', n - 1)",
        },
        {
          name: "v",
          type: "formula",
          expr: "asof(month, @p.col.date, @p.col.v)",
        },
        {
          name: "w",
          type: "formula",
          expr: "xlookup(edate(month, 0), @p.col.date, @p.col.v)",
        },
      ],
      rows: Array.from({ length: 2000 }, (_, i) => [i + 1, "", "", ""]),
    };
    const pool = (id: string): Table | undefined =>
      id === "p" ? prices : undefined;
    const t0 = performance.now();
    const out = recalcTable(plan, pool);
    const ms = performance.now() - t0;
    // January 1990 (month-end 31st) reads 1990-01-01: row 2280.
    expect(out.rows[0]?.[2]).toBe(2280);
    // Past the prices' last month, asof holds the last one.
    expect(out.rows[1999]?.[2]).toBe(2999);
    // 2,000 rows x 3,000 keys: reading the keys per lookup took
    // seconds; read once, a fraction of one. Generous for slow CI.
    expect(ms).toBeLessThan(1500);
  });
});
