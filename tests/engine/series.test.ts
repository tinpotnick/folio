import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc } from "@folio/engine/doc";
import { chartSeries } from "@folio/engine/series";
import type { Chart, Table } from "@folio/engine/index.js";

const wide: Table = {
  id: "sales",
  columns: [
    { name: "month", type: "text" },
    { name: "revenue", type: "number" },
    { name: "cost", type: "number" },
  ],
  rows: [
    ["Jan", 10, 4],
    ["Feb", 12, 5],
  ],
};

const long: Table = {
  id: "monthly",
  columns: [
    { name: "month", type: "text" },
    { name: "region", type: "text" },
    { name: "revenue", type: "number" },
  ],
  rows: [
    ["Jan", "North", 10],
    ["Jan", "South", 7],
    ["Feb", "North", 12],
    ["Feb", "South", 9],
    ["Feb", "North", 1],
  ],
};

const chart = (c: Partial<Chart>): Chart => ({
  source: "x",
  query: { select: [] },
  type: "bar",
  ...c,
});

describe("chartSeries", () => {
  it("one value column: one series (the existing charts)", () => {
    const d = chartSeries(
      wide,
      chart({ query: { select: ["month", "revenue"] } }),
    );
    expect(d.categories).toEqual(["Jan", "Feb"]);
    expect(d.series).toEqual([{ name: "revenue", values: [10, 12] }]);
  });

  it("several value columns: a series each", () => {
    const d = chartSeries(
      wide,
      chart({ query: { select: ["month", "revenue", "cost"] } }),
    );
    expect(d.series).toEqual([
      { name: "revenue", values: [10, 12] },
      { name: "cost", values: [4, 5] },
    ]);
  });

  it("series: splits a long table by a column (repeats sum)", () => {
    const d = chartSeries(
      long,
      chart({ query: { select: ["month", "revenue"] }, series: "region" }),
    );
    expect(d.categories).toEqual(["Jan", "Feb"]);
    expect(d.series).toEqual([
      { name: "North", values: [10, 13] },
      { name: "South", values: [7, 9] },
    ]);
  });

  it("a missing combination is a gap, not a zero", () => {
    const t: Table = {
      ...long,
      rows: [
        ["Jan", "North", 1],
        ["Feb", "South", 2],
      ],
    };
    const d = chartSeries(
      t,
      chart({ query: { select: ["month", "revenue"] }, series: "region" }),
    );
    expect(d.series).toEqual([
      { name: "North", values: [1, null] },
      { name: "South", values: [null, 2] },
    ]);
  });

  it("filter and sort still apply", () => {
    const d = chartSeries(
      long,
      chart({
        query: {
          select: ["month", "revenue"],
          filter: "region == 'South'",
          sort: { by: "revenue", order: "desc" },
        },
        series: "region",
      }),
    );
    expect(d.categories).toEqual(["Feb", "Jan"]);
    expect(d.series).toEqual([{ name: "South", values: [9, 7] }]);
  });
});

describe("series and stack round-trip", () => {
  it("serialize(parse) keeps series: and stack:", () => {
    const text =
      '::: chart {#c}\nsource: @monthly\nquery: {select: [month, revenue]}\ntype: bar\nseries: region\nstack: true\ncaption: "By region"\n:::\n';
    const doc = parseDoc(text);
    const c = doc.blocks[0];
    expect(c?.kind === "chart" && c.chart.series).toBe("region");
    expect(c?.kind === "chart" && c.chart.stack).toBe(true);
    expect(serializeDoc(doc)).toBe(text);
  });
});
