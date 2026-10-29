import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc } from "../../src/engine/doc";
import { recalcTable } from "../../src/engine/recalc";
import type { Table } from "../../src/engine/index";

/**
 * Compute outputs in the document (ADR-0030): a table snapshot marked
 * `computed: python`, and a single named value, `::: value {#slope}`,
 * which a formula reads bare.
 */
describe("compute outputs in the document", () => {
  const src = [
    "# T",
    "",
    "::: table {#fit}",
    "computed: python",
    "columns:",
    "  - {name: day, type: number}",
    "  - {name: trend, type: number}",
    "data:",
    "  - [1, 410]",
    "  - [2, 418.5]",
    ":::",
    "",
    "::: value {#slope}",
    "computed: python",
    "value: 8.6",
    ":::",
    "",
    "::: value {#label}",
    "computed: python",
    'value: "steady growth"',
    ":::",
    "",
  ].join("\n");

  it("round-trips byte for byte", () => {
    expect(serializeDoc(parseDoc(src))).toBe(src);
  });

  it("reads a value as a one-cell table that says what it is", () => {
    const blocks = parseDoc(src).blocks;
    const fit = blocks.find((b) => b.kind === "table" && b.table.id === "fit");
    const slope = blocks.find(
      (b) => b.kind === "table" && b.table.id === "slope",
    );
    expect(fit?.kind === "table" && fit.table.computed).toBe("python");
    expect(slope?.kind === "table" && slope.table.value).toBe(true);
    expect(slope?.kind === "table" && slope.table.rows).toEqual([[8.6]]);
  });

  const slope: Table = {
    id: "slope",
    value: true,
    computed: "python",
    columns: [{ name: "value", type: "number" }],
    rows: [[8.6]],
  };
  const pool = (id: string) => (id === "slope" ? slope : undefined);
  const with_ = (expr: string): Table => ({
    id: "t",
    columns: [
      { name: "days", type: "number" },
      { name: "x", type: "formula", expr },
    ],
    rows: [[30, ""]],
  });

  it("a formula reads a value bare: @slope", () => {
    expect(recalcTable(with_("@slope * days"), pool).rows[0]?.[1]).toBeCloseTo(
      258,
    );
    // ...and leaves the same word inside a string alone.
    expect(recalcTable(with_("'@slope'"), pool).rows[0]?.[1]).toBe("@slope");
  });

  it("a path into a value says it is a value", () => {
    expect(() => recalcTable(with_("@slope.r2.value"), pool)).toThrow(
      /@slope is a value, not a table/,
    );
    expect(() => recalcTable(with_("@slope.col.value"), pool)).toThrow(
      /@slope is a value, not a table/,
    );
  });
});
