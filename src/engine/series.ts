/**
 * A chart's data as categories x series (spec: docs/specs/
 * chart-rendering.md, "Several series"). Pure; no UI.
 *
 * Two forms, both through the chart's query (filter and sort apply):
 * - several VALUE columns: `select: [month, revenue, cost]` - one
 *   series per value column, named after it;
 * - a SPLIT-BY column: `series: region` with `select: [month,
 *   revenue]` - one series per distinct value of that column (in
 *   first-appearance order); repeated category/series pairs sum. A
 *   missing pair is a gap (null), not a zero.
 */
import type { Chart, Table } from "./index.js";
import { executeQuery } from "./query.js";

export interface SeriesData {
  categories: string[];
  series: { name: string; values: (number | null)[] }[];
}

export function chartSeries(table: Table, chart: Chart): SeriesData {
  const select = chart.query.select;
  const split = chart.series;
  if (split) {
    const label = select[0] ?? "";
    const value = select[select.length - 1] ?? "";
    const result = executeQuery(table, {
      ...chart,
      query: { ...chart.query, select: [label, value, split] },
    });
    const categories: string[] = [];
    const names: string[] = [];
    const sums = new Map<string, number>();
    for (const row of result.rows) {
      const cat = String(row[0] ?? "");
      const name = String(row[2] ?? "");
      if (!categories.includes(cat)) categories.push(cat);
      if (!names.includes(name)) names.push(name);
      const key = `${name}\u0000${cat}`;
      sums.set(key, (sums.get(key) ?? 0) + Number(row[1] ?? 0));
    }
    return {
      categories,
      series: names.map((name) => ({
        name,
        values: categories.map(
          (cat) => sums.get(`${name}\u0000${cat}`) ?? null,
        ),
      })),
    };
  }
  const result = executeQuery(table, chart);
  const valueNames = select.slice(1);
  return {
    categories: result.rows.map((r) => String(r[0] ?? "")),
    series: valueNames.map((name, i) => ({
      name,
      values: result.rows.map((r) => {
        const v = r[i + 1];
        return v === undefined || v === "" ? null : Number(v);
      }),
    })),
  };
}
