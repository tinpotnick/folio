/**
 * The stats example (demo/examples/stats.md) shows folio's own GitHub
 * traffic and release downloads as a typed table with chart queries.
 * The copy in main is the seed; the nightly stats workflow
 * (.github/workflows/stats.yml) regenerates it via scripts/stats-doc.sh
 * and validates the fresh document with STATS_DOC=<path> before
 * deploying. This test pins the document's shape and round-trip and
 * runs every chart query headlessly.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc, type DocBlock } from "@folio/engine/doc";
import { executeQuery } from "@folio/engine/query";

const path = process.env.STATS_DOC
  ? resolve(process.env.STATS_DOC)
  : join(import.meta.dirname, "../../demo/examples/stats.md");
const src = readFileSync(path, "utf8");
const doc = parseDoc(src);

const table = (id: string) => {
  const b = doc.blocks.find(
    (b): b is Extract<DocBlock, { kind: "table" }> =>
      b.kind === "table" && b.table.id === id,
  );
  if (!b) throw new Error(`table ${id} not found`);
  return b.table;
};

const chart = (id: string) => {
  const c = doc.blocks.find(
    (b): b is Extract<DocBlock, { kind: "chart" }> =>
      b.kind === "chart" && b.chart.id === id,
  );
  if (!c) throw new Error(`chart ${id} not found`);
  return c.chart;
};

describe("demo: stats", () => {
  it("parses and round-trips byte-identically", () => {
    expect(serializeDoc(doc)).toBe(src);
  });

  it("has the traffic table: the 14 API days, dates ascending and unique", () => {
    const t = table("traffic");
    expect(t.columns.map((c) => c.name)).toEqual([
      "date",
      "views",
      "views_uniques",
      "clones",
      "clones_uniques",
    ]);
    expect(t.rows.length).toBeGreaterThanOrEqual(14);
    const dates = t.rows.map((r) => String(r[0]));
    expect(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))).toBe(true);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("has the downloads table: one row per release, oldest first", () => {
    const t = table("downloads");
    expect(t.columns.map((c) => c.name)).toEqual([
      "release",
      "published",
      "downloads",
    ]);
    expect(t.rows.length).toBeGreaterThan(0);
    const published = t.rows.map((r) => String(r[1]));
    expect([...published].sort()).toEqual(published);
  });

  it("runs every chart query over its table", () => {
    const sources: Record<string, string> = {
      "views-chart": "traffic",
      "clones-chart": "traffic",
      "downloads-chart": "downloads",
    };
    for (const [chartId, tableId] of Object.entries(sources)) {
      const out = executeQuery(table(tableId), chart(chartId));
      expect(out.rows.length, chartId).toBeGreaterThan(0);
    }
  });
});
