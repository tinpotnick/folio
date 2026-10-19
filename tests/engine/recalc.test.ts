import { describe, expect, it } from "vitest";
import { recalcTable } from "@folio/engine/recalc";
import type { Table } from "@folio/engine";

function sampleTable(): Table {
  return {
    id: "regional-data",
    columns: [
      { name: "region", type: "text" },
      { name: "q2", type: "number", unit: "£k" },
      { name: "q3", type: "number", unit: "£k" },
      {
        name: "growth",
        type: "formula",
        expr: "(q3 - q2) / q2",
        format: "percent",
      },
    ],
    rows: [
      ["North", 412, 501],
      ["South", 388, 394],
      ["Midlands", 301, 355],
    ],
  };
}

describe("recalcTable", () => {
  it("fills formula cells for every row (sample document values)", () => {
    const out = recalcTable(sampleTable());
    const expected = [(501 - 412) / 412, (394 - 388) / 388, (355 - 301) / 301];
    out.rows.forEach((row, i) => {
      expect(row[3]).toBeCloseTo(expected[i] ?? Number.NaN, 10);
    });
  });

  it("does not mutate the input table", () => {
    const t = sampleTable();
    const before = JSON.stringify(t.rows);
    recalcTable(t);
    expect(JSON.stringify(t.rows)).toBe(before);
  });

  it("returns the same object identity when no formula columns", () => {
    const t: Table = {
      id: "t",
      columns: [{ name: "a", type: "text" }],
      rows: [["x"]],
    };
    expect(recalcTable(t)).toBe(t);
  });

  it("yields empty string for formula cells when inputs are incomplete", () => {
    const t: Table = {
      id: "partial",
      columns: [
        { name: "region", type: "text" },
        { name: "q2", type: "number" },
        { name: "q3", type: "number" },
        { name: "growth", type: "formula", expr: "(q3 - q2) / q2" },
      ],
      rows: [
        ["", "", ""],
        ["South", 388, 394],
      ],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[3]).toBe("");
    expect(out.rows[1]?.[3]).toBeCloseTo((394 - 388) / 388, 10);
  });

  it("throws on unknown column reference", () => {
    const t: Table = {
      id: "bad",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "missing * 2" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(/unknown column 'missing'/);
  });

  it("chained formulas work when the referenced formula column is earlier", () => {
    const t: Table = {
      id: "chain",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "formula", expr: "a * 2" },
        { name: "c", type: "formula", expr: "b + 1" },
      ],
      rows: [[2]],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[1]).toBe(4);
    expect(out.rows[0]?.[2]).toBe(5);
  });

  it("rejects formulas referencing a LATER formula column", () => {
    const t: Table = {
      id: "later",
      columns: [
        { name: "a", type: "number" },
        { name: "x", type: "formula", expr: "y + 1" },
        { name: "y", type: "formula", expr: "a" },
      ],
      rows: [[2]],
    };
    expect(() => recalcTable(t)).toThrow(
      /later formula column 'y' - a formula may only reference columns to its left/,
    );
  });

  it("rejects plain self-reference and points at _prev", () => {
    const t: Table = {
      id: "self",
      columns: [
        { name: "a", type: "number" },
        { name: "t", type: "formula", expr: "a + t" },
      ],
      rows: [[1], [2]],
    };
    expect(() => recalcTable(t)).toThrow(/self-reference 't' - use _prev\.t/);
  });

  it("row references address any row by name (_r2.q2 is row 2's q2)", () => {
    const t: Table = {
      id: "refs",
      columns: [
        { name: "q2", type: "number" },
        { name: "delta", type: "formula", expr: "_r2.q2 - q2" },
      ],
      rows: [[10], [20], [30]],
    };
    const out = recalcTable(t);
    // Every row sees row 2's value minus its own.
    expect(out.rows.map((r) => r[1])).toEqual([10, 0, -10]);
  });

  it("row references may address an earlier formula column's history", () => {
    const t: Table = {
      id: "refsf",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "formula", expr: "a * 2" },
        { name: "c", type: "formula", expr: "_r1.b + b" },
      ],
      rows: [[1], [2], [3]],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[2])).toEqual([4, 6, 8]);
  });

  it("running totals via _prev and _row", () => {
    const t: Table = {
      id: "running",
      columns: [
        { name: "month", type: "text" },
        { name: "q2", type: "number" },
        {
          name: "total",
          type: "formula",
          expr: "q2 + (_row == 1 ? 0 : _prev.total)",
        },
      ],
      rows: [
        ["jan", 10],
        ["feb", 20],
        ["mar", 30],
      ],
    };
    const out = recalcTable(t);
    expect(out.rows.map((r) => r[2])).toEqual([10, 30, 60]);
  });

  it("references to not-yet-computed OWN-column rows yield empty", () => {
    const t: Table = {
      id: "forward",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "formula", expr: "a * 2" },
        { name: "c", type: "formula", expr: "_r3.b + a" },
      ],
      rows: [[1], [2], [3]],
    };
    const out = recalcTable(t);
    // Earlier formula columns are fully computed: _r3.b is 6 for
    // all rows. Forward references to the formula's OWN column
    // would be empty (running totals use _prev instead).
    expect(out.rows.map((r) => r[2])).toEqual([7, 8, 9]);
  });

  it("rejects row index 0 (rows start at 1)", () => {
    const t: Table = {
      id: "zero",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "_r0.a" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(/row indexes start at 1/);
  });

  it("rejects text columns as formula references", () => {
    const t: Table = {
      id: "bad",
      columns: [
        { name: "name", type: "text" },
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "a * 2 + name" },
      ],
      rows: [["x", 1]],
    };
    expect(() => recalcTable(t)).toThrow(/non-numeric column 'name'/);
  });

  it("row references to unknown columns are rejected too", () => {
    const t: Table = {
      id: "bad",
      columns: [
        { name: "name", type: "text" },
        {
          name: "f",
          type: "formula",
          expr: '_r1.missing == "x" ? 1 : 0',
        },
      ],
      rows: [["x"]],
    };
    expect(() => recalcTable(t)).toThrow(/unknown column 'missing'/);
  });

  it("_rN may read text columns (cross-row comparisons)", () => {
    const t: Table = {
      id: "rowtext",
      columns: [
        { name: "name", type: "text" },
        {
          name: "last",
          type: "formula",
          expr: '_r3.name == "b" ? 1 : 0',
        },
      ],
      rows: [["a"], ["a"], ["b"]],
    };
    const out = recalcTable(t);
    // Every row sees row 3's text.
    expect(out.rows.map((r) => r[1])).toEqual([1, 1, 1]);
  });

  it("_prev may read text columns (previous-row comparisons)", () => {
    const t: Table = {
      id: "prevtext",
      columns: [
        { name: "name", type: "text" },
        {
          name: "repeat",
          type: "formula",
          expr: '_prev.name == "a" ? 1 : 0',
        },
      ],
      rows: [["a"], ["a"], ["b"]],
    };
    const out = recalcTable(t);
    // Row 1 has no previous row; rows 2 and 3 both follow an "a".
    expect(out.rows.map((r) => r[1])).toEqual([0, 1, 1]);
  });

  it("treats division by zero as 0, not an error (reporting contract)", () => {
    const t: Table = {
      id: "div",
      columns: [
        { name: "a", type: "number" },
        { name: "b", type: "number" },
        { name: "f", type: "formula", expr: "a / b" },
      ],
      rows: [[1, 0]],
    };
    expect(recalcTable(t).rows[0]?.[2]).toBe(0);
  });

  it("supports Jexl comparisons and ternaries in formulas", () => {
    const t: Table = {
      id: "jexl",
      columns: [
        { name: "q3", type: "number" },
        { name: "trend", type: "formula", expr: 'q3 > 400 ? "up" : "down"' },
      ],
      rows: [[501], [394]],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[1]).toBe("up");
    expect(out.rows[1]?.[1]).toBe("down");
  });

  it("supports transforms", () => {
    const t: Table = {
      id: "jexl2",
      columns: [
        { name: "q2", type: "number" },
        { name: "q3", type: "number" },
        {
          name: "r",
          type: "formula",
          expr: "((q3 - q2) / q2 * 100) | round(1)",
        },
      ],
      rows: [[301, 355]],
    };
    const out = recalcTable(t);
    expect(out.rows[0]?.[2]).toBe(17.9);
  });

  it("wraps syntax errors with the table and column context", () => {
    const t: Table = {
      id: "syn",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "a +" },
      ],
      rows: [[1]],
    };
    expect(() => recalcTable(t)).toThrow(/Formula 'f' in table 'syn'/);
  });

  it("ternaries with spaces around the colon are not cell references", () => {
    const t: Table = {
      id: "ternary",
      columns: [
        { name: "a", type: "number" },
        { name: "f", type: "formula", expr: "a > 1 ? 10 : 5" },
      ],
      rows: [[2]],
    };
    expect(recalcTable(t).rows[0]?.[1]).toBe(10);
  });
});
