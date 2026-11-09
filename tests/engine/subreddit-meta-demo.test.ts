/**
 * The subreddit-meta demo (demo/examples/subreddit-meta.md) is 857
 * public r/datavisualization posts (Arctic Shift archive, removed and
 * deleted posts excluded, authors omitted) imported as a typed table,
 * with six chart queries over it. This test pins the document to the
 * numbers it reports.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDoc, serializeDoc, type DocBlock } from "@folio/engine/doc";
import { executeQuery } from "@folio/engine/query";

const path = join(import.meta.dirname, "../../demo/examples/subreddit-meta.md");
const src = readFileSync(path, "utf8");
const doc = parseDoc(src);

const postsBlock = doc.blocks.find(
  (b): b is Extract<DocBlock, { kind: "table" }> =>
    b.kind === "table" && b.table.id === "posts",
);
if (!postsBlock) throw new Error("posts table not found");
const posts = postsBlock.table;

const chart = (id: string) => {
  const c = doc.blocks.find(
    (b): b is Extract<DocBlock, { kind: "chart" }> =>
      b.kind === "chart" && b.chart.id === id,
  );
  if (!c) throw new Error(`chart ${id} not found`);
  return c.chart;
};

describe("demo: subreddit-meta", () => {
  it("parses and round-trips byte-identically", () => {
    expect(serializeDoc(doc)).toBe(src);
  });

  it("has the posts table with 857 rows and 9 columns", () => {
    expect(posts.rows.length).toBe(857);
    expect(posts.columns.length).toBe(9);
  });

  it("histograms scores: score 0 has the most posts, 43 the fewest", () => {
    const out = executeQuery(posts, chart("score-histogram"));
    expect(out.rows.at(0)).toEqual([0, 153]);
    expect(out.rows.at(-1)).toEqual([43, 1]);
  });

  it("ranks the top posts, best first, capped at 8", () => {
    const out = executeQuery(posts, chart("top-posts"));
    expect(out.rows.length).toBe(8);
    expect(out.rows.at(0)?.[1]).toBe(43);
  });

  it("groups post counts and average score by all 24 hours", () => {
    const byHour = executeQuery(posts, chart("posts-by-hour"));
    expect(byHour.rows.length).toBe(24);
    const avg = executeQuery(posts, chart("avg-score-by-hour"));
    expect(avg.rows.length).toBe(24);
    expect(avg.rows.at(0)?.[0]).toBe(0);
    expect(avg.rows.at(-1)?.[0]).toBe(23);
  });

  it("mixes flairs, OC first, untagged posts excluded", () => {
    const out = executeQuery(posts, chart("flair-mix"));
    expect(out.rows.at(0)).toEqual(["OC", 54]);
    expect(out.rows.length).toBe(5);
  });

  it("crosses hour and day of week in the heatmap: 168 cells at most, all 857 posts", () => {
    const hm = chart("activity-heatmap");
    expect(hm.type).toBe("heatmap");
    const out = executeQuery(posts, hm);
    expect(out.columns).toEqual(["hour_utc", "dow_utc", "posts"]);
    expect(out.rows.length).toBeLessThanOrEqual(24 * 7);
    const total = out.rows.reduce((s, r) => s + Number(r[2]), 0);
    expect(total).toBe(857);
  });
});
