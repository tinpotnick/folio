import { describe, expect, it } from "vitest";
import { executeQuery } from "@folio/engine/query";
import type { Chart, Table } from "@folio/engine";

const table: Table = {
  id: "regional-data",
  columns: [
    { name: "region", type: "text" },
    { name: "q2", type: "number" },
    { name: "q3", type: "number" },
  ],
  rows: [
    ["North", 412, 501],
    ["South", 388, 394],
    ["Midlands", 301, 355],
  ],
};

function chart(query: Chart["query"]): Chart {
  return { source: "regional-data", query, type: "bar" };
}

describe("executeQuery", () => {
  it("selects and sorts desc by numeric column", () => {
    const out = executeQuery(
      table,
      chart({
        select: ["region", "q3"],
        sort: { by: "q3", order: "desc" },
      }),
    );
    expect(out.columns).toEqual(["region", "q3"]);
    expect(out.rows).toEqual(
      [
        ["North", 501],
        ["Midlands", 355],
        ["South", 394],
      ].sort((a, b) => (b[1] as number) - (a[1] as number)),
    );
  });

  it("filters with gt", () => {
    const out = executeQuery(
      table,
      chart({
        select: ["region"],
        filter: { column: "q2", op: "gt", value: 350 },
      }),
    );
    expect(out.rows.map((r) => r[0])).toEqual(["North", "South"]);
  });

  it("sorts numerically with empty cells last in asc order", () => {
    const t: Table = {
      id: "t",
      columns: [
        { name: "region", type: "text" },
        { name: "v", type: "number" },
      ],
      rows: [
        ["b", 2],
        ["empty", ""],
        ["a", 10],
      ],
    };
    const asc = executeQuery(
      t,
      chart({
        select: ["region"],
        sort: { by: "v", order: "asc" },
      }),
    );
    expect(asc.rows.map((r) => r[0])).toEqual(["b", "a", "empty"]);
    const desc = executeQuery(
      t,
      chart({
        select: ["region"],
        sort: { by: "v", order: "desc" },
      }),
    );
    expect(desc.rows.map((r) => r[0])).toEqual(["a", "b", "empty"]);
  });

  it("throws on unknown select column", () => {
    expect(() => executeQuery(table, chart({ select: ["nope"] }))).toThrow(
      /Unknown column/,
    );
  });

  it("throws on unknown filter column", () => {
    expect(() =>
      executeQuery(
        table,
        chart({
          select: ["region"],
          filter: { column: "nope", op: "eq", value: 1 },
        }),
      ),
    ).toThrow(/Unknown column/);
  });
});
