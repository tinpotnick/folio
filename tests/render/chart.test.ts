import { describe, expect, it } from "vitest";
import {
  renderAreaChart,
  renderBarChart,
  renderLineChart,
  renderPieChart,
  renderScatterChart,
} from "@folio/render/chart";
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

describe("renderPieChart", () => {
  it("draws one slice per row with percentage labels", () => {
    const svg = renderPieChart(
      result([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    ).svg;
    expect((svg.match(/<path /g) ?? []).length).toBe(3);
    expect(svg).toContain("a 17%");
    expect(svg).toContain("c 50%");
  });

  it("punches out the center for donuts", () => {
    const svg = renderPieChart(result([["a", 1]]), true).svg;
    expect(svg).toContain('<circle cx="320" cy="150"');
  });

  it("negative values are an error, not a backwards slice", () => {
    expect(() =>
      renderPieChart(
        result([
          ["a", 1],
          ["b", -2],
        ]),
      ),
    ).toThrow(/non-negative/);
  });

  it("an empty or zero-total pie is an error", () => {
    expect(() => renderPieChart(result([]))).toThrow(/at least one row/);
    expect(() =>
      renderPieChart(
        result([
          ["a", 0],
          ["b", 0],
        ]),
      ),
    ).toThrow(/positive total/);
  });
});

describe("renderAreaChart", () => {
  it("fills the polygon down to the zero baseline", () => {
    const svg = renderAreaChart(
      result([
        ["a", 10],
        ["b", 20],
      ]),
    ).svg;
    expect(svg).toContain("<polygon");
    expect(svg).toContain("<polyline");
  });
});

describe("renderScatterChart", () => {
  it("draws a point per row on numeric axes", () => {
    const svg = renderScatterChart(
      result([
        [1, 10],
        [2, 20],
      ] as unknown as [string, number][]),
    ).svg;
    expect((svg.match(/<circle /g) ?? []).length).toBe(2);
  });

  it("non-numeric columns are an error", () => {
    expect(() =>
      renderScatterChart(
        result([
          ["a", 1],
          ["b", 2],
        ]),
      ),
    ).toThrow(/two numeric/);
  });
});

describe("dense-data rendering (the clumping fix)", () => {
  // 24 monthly points: the imported-data report case.
  const dense: QueryResult = {
    columns: ["month", "v"],
    rows: Array.from({ length: 24 }, (_, i) => [
      `2024-${String((i % 12) + 1).padStart(2, "0")}`,
      10 + i,
    ]),
  };

  it("x tick labels thin to at most eight (plus the last)", () => {
    const svg = renderLineChart(dense).svg;
    const ticks = svg.match(/class="x-tick"/g) ?? [];
    expect(ticks.length).toBeLessThanOrEqual(8);
    // The last point is always labeled.
    expect(svg).toContain("2024-12");
  });

  it("dense lines label only extremes and the last point", () => {
    const svg = renderLineChart(dense).svg;
    const labels = svg.match(/class="v-label"/g) ?? [];
    expect(labels.length).toBeLessThanOrEqual(3);
    // 33 is the maximum (the last point), labeled bold.
    expect(svg).toContain('font-weight="600"');
  });

  it("sparse series keep every label", () => {
    const svg = renderLineChart(
      result([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    ).svg;
    expect((svg.match(/class="v-label"/g) ?? []).length).toBe(3);
  });

  it("sparse series keep a marker on every point", () => {
    const svg = renderLineChart(
      result([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ]),
    ).svg;
    expect((svg.match(/<circle /g) ?? []).length).toBe(3);
  });

  it("dense series thin their markers to the x-ticks", () => {
    // 128 points: a marker per point is a bead necklace, not a
    // line. Markers land only at x-tick positions (<= 8).
    const many: QueryResult = {
      columns: ["n", "v"],
      rows: Array.from({ length: 128 }, (_, i) => [String(i), Math.sin(i / 8)]),
    };
    const svg = renderLineChart(many).svg;
    const markers = svg.match(/<circle /g) ?? [];
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.length).toBeLessThanOrEqual(8);
    // The curve itself still covers every point.
    expect((svg.match(/<polyline /g) ?? []).length).toBe(1);
  });

  it("axis titles name the columns, with the unit", () => {
    const svg = renderLineChart(dense, {
      xTitle: "month",
      yTitle: "revenue (£k)",
    }).svg;
    expect(svg).toContain('class="axis-title"');
    expect(svg).toContain("revenue (£k)");
  });

  it("the series color comes from the style", () => {
    const svg = renderLineChart(dense, { color: "#1c3f60" }).svg;
    expect(svg).toContain('stroke="#1c3f60"');
  });

  it("the line's gradient fill is unique per chart", () => {
    const a = renderLineChart(dense).svg;
    const b = renderLineChart(dense).svg;
    const idA = /id="(folio-grad-\d+)"/.exec(a)?.[1];
    const idB = /id="(folio-grad-\d+)"/.exec(b)?.[1];
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
  });
});

/** The y tick label values, top to bottom. */
function yTicks(svg: string): string[] {
  return [...svg.matchAll(/class="tick-y"[^>]*>([^<]*)</g)].map(
    (m) => m[1] ?? "",
  );
}

describe("readable axes and labels (report-quality fixes)", () => {
  it("y ticks fall on nice steps, not quarters of the range", () => {
    const svg = renderBarChart(
      result([
        ["North", 0.22],
        ["South", 0.02],
        ["East", -0.15],
      ]),
    ).svg;
    // Before: 0.30 / 0.18 / 0.05 / -0.07 / -0.20.
    for (const t of yTicks(svg)) {
      expect(Number(t) * 20, t).toBeCloseTo(Math.round(Number(t) * 20), 6);
    }
    expect(yTicks(svg)).toContain("0");
  });

  it("percent value columns label as percentages", () => {
    const svg = renderBarChart(
      result([
        ["North", 0.22],
        ["East", -0.15],
      ]),
      { valueFormat: "percent" },
    ).svg;
    expect(svg).toContain(">22.0%<");
    expect(svg).toContain(">-15.0%<");
    expect(yTicks(svg).every((t) => t.endsWith("%"))).toBe(true);
  });

  it("a negative bar's label clears the x tick labels", () => {
    const svg = renderBarChart(
      result([
        ["Apr", 120],
        ["May", -40],
        ["Jun", 95],
      ]),
      { xTitle: "month" },
    ).svg;
    const vY = Number(
      /class="v-label"[^>]*y="([^"]+)"[^>]*>-40</.exec(svg)?.[1],
    );
    const tickY = Number(
      /class="x-tick"[^>]*y="([^"]+)"[^>]*>May</.exec(svg)?.[1],
    );
    expect(tickY - vY).toBeGreaterThanOrEqual(14);
  });

  it("a line chart's fill hangs BELOW the curve, down to the axis", () => {
    const svg = renderLineChart(
      result([
        ["a", 41],
        ["b", 45],
        ["c", 55],
      ]),
    ).svg;
    const pts = /<polygon points="([^"]+)"/.exec(svg)?.[1]?.split(" ") ?? [];
    const firstY = Number(pts[0]?.split(",")[1]);
    const curveYs = pts.slice(1, -1).map((p) => Number(p.split(",")[1]));
    // SVG y grows downward: the base must be below every point.
    expect(firstY).toBeGreaterThanOrEqual(Math.max(...curveYs));
  });

  it("dense value labels never overlap each other", () => {
    // The report's North series: the max is the second-to-last
    // point, right next to the always-labeled last point.
    const vals = [
      41.3, 40.2, 43.4, 43.6, 43.3, 43.4, 44.5, 42.9, 44.2, 43.6, 48.9, 50.2,
      44.9, 45.7, 49.9, 50.0, 47.3, 48.8, 50.0, 48.1, 50.9, 51.0, 55.6, 55.5,
    ];
    const svg = renderLineChart({
      columns: ["month", "revenue"],
      rows: vals.map((v, i) => [`m${String(i)}`, v]),
    }).svg;
    const labels = [
      ...svg.matchAll(/class="v-label" x="([^"]+)" y="([^"]+)"/g),
    ].map((m) => [Number(m[1]), Number(m[2])] as const);
    for (const [i, a] of labels.entries()) {
      for (const b of labels.slice(i + 1)) {
        const apart =
          Math.abs(a[0] - b[0]) >= 40 || Math.abs(a[1] - b[1]) >= 14;
        expect(apart, `${String(a)} vs ${String(b)}`).toBe(true);
      }
    }
  });
});

describe("a minimum on the plot floor", () => {
  it("labels beside the point, clear of the x ticks", () => {
    // The report's Midlands growth: the minimum is the first point
    // and lands on the floor gridline.
    const vals = [
      -0.378, 0, 0.07, 0.01, -0.02, 0.06, 0, 0.02, -0.01, 0.05, 0.08, 0.03,
      -0.04, 0, 0.06, 0.02, -0.02, 0.01, -0.02, 0.01, 0.04, 0.02, 0.114, 0.062,
    ];
    const svg = renderLineChart(
      { columns: ["m", "g"], rows: vals.map((v, i) => [`m${String(i)}`, v]) },
      { valueFormat: "percent", xTitle: "month" },
    ).svg;
    const m =
      /class="v-label" x="[^"]+" y="([^"]+)" text-anchor="([^"]+)"[^>]*>-37\.8%</.exec(
        svg,
      );
    const tickY = Number(/class="x-tick"[^>]*y="([^"]+)"/.exec(svg)?.[1]);
    expect(m?.[2]).toBe("start");
    expect(tickY - Number(m?.[1])).toBeGreaterThanOrEqual(14);
  });
});

describe("pie colors belong to categories", () => {
  // Regression (first-contact eval): slices were colored by their
  // position in the SORTED result, so editing a value that reordered
  // the slices swapped their colors.
  const fills = (svg: string): string[] =>
    [...svg.matchAll(/<path [^>]*fill="([^"]+)"/g)].map((m) => m[1] ?? "");
  it("a category keeps its color when the sort order changes", () => {
    const style = {
      colors: ["#111111", "#222222", "#333333"],
      colorKeys: ["Engineering", "Design", "Marketing"],
    };
    const before = renderPieChart(
      result([
        ["Engineering", 30],
        ["Design", 12],
        ["Marketing", 9],
      ]),
      true,
      style,
    ).svg;
    const after = renderPieChart(
      result([
        ["Design", 40],
        ["Engineering", 30],
        ["Marketing", 9],
      ]),
      true,
      style,
    ).svg;
    expect(fills(before)).toEqual(["#111111", "#222222", "#333333"]);
    expect(fills(after)).toEqual(["#222222", "#111111", "#333333"]);
  });
});
