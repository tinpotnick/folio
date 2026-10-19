import { describe, expect, it } from "vitest";
import { executeQuery, filterIndexes, sortIndexes } from "@folio/engine/query";
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

  it("filters with a Jexl expression (and + text comparison)", () => {
    const out = executeQuery(
      table,
      chart({
        select: ["region", "q3"],
        filter: "q2 > 300 && region != 'South'",
      }),
    );
    expect(out.rows.map((r) => r[0])).toEqual(["North", "Midlands"]);
  });

  it("the legacy {column, op, value} filter still works", () => {
    const out = executeQuery(
      table,
      chart({
        select: ["region", "q3"],
        filter: { column: "q2", op: "gt", value: 400 },
      }),
    );
    expect(out.rows.map((r) => r[0])).toEqual(["North"]);
  });

  it("an expression filter with an unknown column is a visible error", () => {
    expect(() =>
      executeQuery(table, chart({ select: ["region"], filter: "missing > 1" })),
    ).toThrow(/Filter error: unknown column 'missing'/);
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

describe("filterIndexes / sortIndexes (dataset browser primitives)", () => {
  const table: Table = {
    id: "t",
    columns: [
      { name: "region", type: "text" },
      { name: "v", type: "number" },
    ],
    rows: [
      ["North", 10],
      ["South", 40],
      ["North", 20],
    ],
  };

  it("filterIndexes returns MODEL row indexes, not rows", () => {
    expect(filterIndexes(table, "region == 'North'")).toEqual([0, 2]);
    expect(filterIndexes(table, "v > 15")).toEqual([1, 2]);
  });

  it("filterIndexes throws on an unknown column", () => {
    expect(() => filterIndexes(table, "nope > 1")).toThrow(/unknown column/);
  });

  it("sortIndexes sorts indexes without touching the model", () => {
    expect(sortIndexes(table, "v", "desc")).toEqual([1, 2, 0]);
    expect(sortIndexes(table, "v", "asc")).toEqual([0, 2, 1]);
    expect(table.rows[0]).toEqual(["North", 10]);
  });
});

it("filter and sort compose: sorting never resurrects filtered rows", () => {
  const out = executeQuery(
    {
      id: "t",
      columns: [
        { name: "region", type: "text" },
        { name: "q2", type: "number" },
        { name: "growth", type: "number" },
      ],
      rows: [
        ["North", 412, 0.21],
        ["South", 388, 0.015],
        ["Midlands", 301, 0.179],
      ],
    },
    {
      id: "c",
      source: "t",
      query: {
        select: ["region", "growth"],
        filter: "q2 > 400",
        sort: { by: "growth", order: "desc" },
      },
      type: "bar",
    },
  );
  expect(out.rows).toEqual([["North", 0.21]]);
});
