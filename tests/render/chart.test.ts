import { describe, expect, it } from "vitest";
import { renderBarChart } from "@folio/render/chart";
import type { QueryResult } from "@folio/engine/query";

function result(rows: [string, number][]): QueryResult {
  return { columns: ["region", "growth"], rows };
}

/** Rect elements as [y, height] pairs, rounded. */
function rects(svg: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of svg.matchAll(/<rect [^>]*\/>/g) ?? []) {
    const y = Number(/y="([^"]+)"/.exec(m[0])?.[1]);
    const h = Number(/height="([^"]+)"/.exec(m[0])?.[1]);
    out.push([y, h]);
  }
  return out;
}

describe("renderBarChart", () => {
  it("positive-only charts keep a zero baseline at the bottom", () => {
    const svg = renderBarChart(
      result([
        ["a", 10],
        ["b", 20],
      ]),
    ).svg;
    expect(svg).not.toContain('stroke="#8b949e"'); // no separate zero line
    const bars = rects(svg);
    expect(bars.length).toBe(2);
    // The taller bar has a smaller y (further from the bottom).
    expect(bars[1]?.[0]).toBeLessThan(bars[0]?.[0] ?? 0);
  });

  it("negative values hang below a visible zero baseline", () => {
    const svg = renderBarChart(
      result([
        ["a", 20],
        ["b", -10],
      ]),
    ).svg;
    // The domain extends below zero: a negative axis label exists.
    expect(svg).toMatch(/>-1\d*</);
    // A zero baseline is drawn.
    expect(svg).toContain('stroke="#8b949e"');
    const bars = rects(svg);
    expect(bars.length).toBe(2);
    const [posY, posH] = bars[0] ?? [0, 0];
    const [negY, negH] = bars[1] ?? [0, 0];
    // The positive bar ends where the negative bar begins.
    expect(posY + posH).toBeCloseTo(negY, 5);
    expect(negH).toBeGreaterThan(0);
    expect(negY).toBeGreaterThan(posY);
  });

  it("all-negative charts still show bars with the zero line at top", () => {
    const svg = renderBarChart(
      result([
        ["a", -5],
        ["b", -12],
      ]),
    ).svg;
    const bars = rects(svg);
    expect(bars[1]?.[1]).toBeGreaterThan(bars[0]?.[1] ?? 0);
    expect(bars.every(([, h]) => h > 0)).toBe(true);
  });
});
