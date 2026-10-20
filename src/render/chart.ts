/**
 * Publication-quality SVG chart rendering (ADR-0004).
 * Charts are queries; render() consumes executeQuery output and
 * emits static vector SVG - embeddable in exports, interactive
 * affordances are progressive enhancement.
 *
 * Dense data never clutters: x tick labels thin to at most eight
 * (plus the last one), and per-point value labels appear only for
 * sparse series - dense lines label their extremes and latest
 * point instead. Axis titles carry the column names (and the
 * value column's unit), so a chart explains itself.
 */
import type { Cell } from "../engine/index.js";
import type { QueryResult } from "../engine/query.js";

export interface RenderedChart {
  svg: string;
}

/** Theme-driven styling: the series color, the pie palette, and
 * the semantic axis titles drawn from the query's columns. */
export interface ChartStyle {
  color?: string | undefined;
  colors?: string[] | undefined;
  xTitle?: string | undefined;
  yTitle?: string | undefined;
}

const W = 640;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 40, left: 60 };
const GRID_COLOR = "#eef0f3";
const TEXT_MUTED = "#57606a";
const TEXT_DARK = "#1f2328";

/** Unique gradient ids: several charts can live on one page. */
let gradientSeq = 0;

/** The x tick indices to label: at most `maxTicks`, always
 * including the last point (the series' end matters). */
function xTickIndices(n: number, maxTicks = 8): number[] {
  // Budget INCLUDES the always-labeled last point.
  const step = Math.max(1, Math.ceil(n / Math.max(1, maxTicks - 1)));
  const out: number[] = [];
  for (let i = 0; i < n; i += step) out.push(i);
  if (out[out.length - 1] !== n - 1) out.push(n - 1);
  return out;
}

/** The per-point value labels to draw: all of them for a sparse
 * series; for a dense one only the extremes and the latest point
 * (labeling every point of a 24-month series clumps). */
function valueLabelIndices(
  values: number[],
  maxDense = 12,
): { indices: number[]; dense: boolean } {
  if (values.length <= maxDense) {
    return { indices: values.map((_, i) => i), dense: false };
  }
  let maxI = 0;
  let minI = 0;
  values.forEach((v, i) => {
    if (v > (values[maxI] ?? 0)) maxI = i;
    if (v < (values[minI] ?? 0)) minI = i;
  });
  const last = values.length - 1;
  return {
    indices: [...new Set([maxI, minI, last])].sort((a, b) => a - b),
    dense: true,
  };
}

/**
 * The shared frame: y grid + tick labels, the zero baseline when
 * the domain dips negative, and the axis titles. Returns the y
 * position helper so each chart stays in sync with the domain.
 */
function drawFrame(
  parts: string[],
  opts: {
    gridMin: number;
    gridMax: number;
    span: number;
    innerH: number;
    padBottom: number;
    yTitle?: string | undefined;
    xTitle?: string | undefined;
  },
): (v: number) => number {
  const padLeft = opts.yTitle ? 78 : 60;
  const yOf = (v: number): number =>
    PAD.top + ((opts.gridMax - v) / opts.span) * opts.innerH;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (opts.innerH * i) / 4;
    const v = opts.gridMax - (opts.span * i) / 4;
    parts.push(
      `<line x1="${padLeft}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="${GRID_COLOR}" />`,
      `<text class="tick-y" x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${TEXT_MUTED}">${fmt(v)}</text>`,
    );
  }
  const zeroY = yOf(0);
  if (opts.gridMin < 0) {
    parts.push(
      `<line x1="${padLeft}" y1="${zeroY}" x2="${W - PAD.right}" y2="${zeroY}" stroke="#8b949e" />`,
    );
  }
  if (opts.yTitle) {
    parts.push(
      `<text class="axis-title" transform="translate(16 ${PAD.top + opts.innerH / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="${TEXT_DARK}">${escapeXml(opts.yTitle)}</text>`,
    );
  }
  if (opts.xTitle) {
    parts.push(
      `<text class="axis-title" x="${(padLeft + W - PAD.right) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="${TEXT_DARK}">${escapeXml(opts.xTitle)}</text>`,
    );
  }
  return yOf;
}

function domain(values: number[]): {
  gridMin: number;
  gridMax: number;
  span: number;
} {
  const max = Math.max(...values, 0.000001);
  const min = Math.min(...values, 0);
  const gridMax = niceCeil(max);
  const gridMin = min < 0 ? -niceCeil(-min) : 0;
  const span = gridMax - gridMin || 1;
  return { gridMin, gridMax, span };
}

export function renderBarChart(
  result: QueryResult,
  style: ChartStyle = {},
): RenderedChart {
  const color = style.color ?? "#4c6ef5";
  const values = result.rows.map((r) => Number(r[1] ?? 0));
  const { gridMin, gridMax, span } = domain(values);
  const padBottom = style.xTitle ? 52 : 40;
  const innerW = W - (style.yTitle ? 78 : 60) - PAD.right;
  const innerH = H - PAD.top - padBottom;
  const n = result.rows.length || 1;
  const band = innerW / n;
  const barW = Math.min(band * 0.6, 80);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );
  const yOf = drawFrame(parts, {
    gridMin,
    gridMax,
    span,
    innerH,
    padBottom,
    yTitle: style.yTitle,
    xTitle: style.xTitle,
  });
  const zeroY = yOf(0);
  const padLeft = style.yTitle ? 78 : 60;
  const { indices: labelAt } = valueLabelIndices(values);
  result.rows.forEach((row, i) => {
    const value = Number(row[1] ?? 0);
    const x = padLeft + band * i + (band - barW) / 2;
    const y = value >= 0 ? yOf(value) : zeroY;
    const height = Math.max(
      value >= 0 ? zeroY - yOf(value) : yOf(value) - zeroY,
      0,
    );
    parts.push(
      `<rect x="${x}" y="${y}" width="${barW}" height="${height}" fill="${color}" rx="2" />`,
    );
    const label = escapeXml(String(row[0] ?? ""));
    if (xTickIndices(n).includes(i)) {
      parts.push(
        `<text class="x-tick" x="${x + barW / 2}" y="${H - padBottom + 16}" text-anchor="middle" font-size="11" fill="${TEXT_DARK}">${label}</text>`,
      );
    }
    if (labelAt.includes(i)) {
      const valueY =
        value >= 0 ? y - 4 : Math.min(zeroY + height + 12, H - PAD.top);
      parts.push(
        `<text class="v-label" x="${x + barW / 2}" y="${valueY}" text-anchor="middle" font-size="11" fill="${TEXT_MUTED}">${fmt(value)}</text>`,
      );
    }
  });

  parts.push(`</svg>`);
  return { svg: parts.join("") };
}

/**
 * A line chart with markers, a soft gradient fill hugging the
 * curve, and sparse labeling for dense series.
 */
export function renderLineChart(
  result: QueryResult,
  style: ChartStyle = {},
): RenderedChart {
  return renderLineLike(result, style, false);
}

export function renderAreaChart(
  result: QueryResult,
  style: ChartStyle = {},
): RenderedChart {
  return renderLineLike(result, style, true);
}

function renderLineLike(
  result: QueryResult,
  style: ChartStyle,
  areaMode: boolean,
): RenderedChart {
  const color = style.color ?? "#4c6ef5";
  const values = result.rows.map((r) => Number(r[1] ?? 0));
  const { gridMin, gridMax, span } = domain(values);
  const padBottom = style.xTitle ? 52 : 40;
  const padLeft = style.yTitle ? 78 : 60;
  const innerW = W - padLeft - PAD.right;
  const innerH = H - PAD.top - padBottom;
  const n = result.rows.length || 1;
  const band = innerW / n;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );
  const yOf = drawFrame(parts, {
    gridMin,
    gridMax,
    span,
    innerH,
    padBottom,
    yTitle: style.yTitle,
    xTitle: style.xTitle,
  });
  const zeroY = yOf(0);
  const xs = result.rows.map((_, i) => padLeft + band * i + band / 2);
  const ys = values.map((v) => yOf(v));
  const points = xs.map((x, i) => `${x},${ys[i]}`).join(" ");

  const fillParts: string[] = [];
  if (xs.length > 0) {
    gradientSeq += 1;
    const gid = `folio-grad-${gradientSeq}`;
    parts.push(
      `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${color}" stop-opacity="0.22" />` +
        `<stop offset="1" stop-color="${color}" stop-opacity="0" />` +
        `</linearGradient></defs>`,
    );
    // An area chart fills to the zero baseline; a line chart's
    // fill hugs the curve down to the same baseline but is a
    // whisper (the gradient), not a statement.
    const baseY = areaMode ? zeroY : Math.min(...ys, zeroY);
    fillParts.push(
      `<polygon points="${xs[0]},${baseY} ${points} ${xs[xs.length - 1]},${baseY}" fill="url(#${gid})" />`,
    );
  }
  if (points.length > 0) {
    fillParts.push(
      `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`,
    );
  }
  parts.push(...fillParts);

  const { indices: labelAt, dense } = valueLabelIndices(values);
  const tickAt = new Set(xTickIndices(n));
  // Dense series draw a marker per x-TICK only: a marker on every
  // point turns a smooth 512-sample line into a bead necklace.
  // Sparse series keep every marker.
  const markerAt: (i: number) => boolean =
    n > 64 ? (i) => tickAt.has(i) : () => true;
  result.rows.forEach((row, i) => {
    const x = xs[i] ?? 0;
    if (markerAt(i)) {
      parts.push(`<circle cx="${x}" cy="${ys[i]}" r="3" fill="${color}" />`);
    }
    if (tickAt.has(i)) {
      parts.push(
        `<text class="x-tick" x="${x}" y="${H - padBottom + 16}" text-anchor="middle" font-size="11" fill="${TEXT_DARK}">${escapeXml(String(row[0] ?? ""))}</text>`,
      );
    }
    if (labelAt.includes(i)) {
      // Dense series label only their extremes and the last
      // point, above the curve; sparse series label every point.
      parts.push(
        `<text class="v-label" x="${x}" y="${(ys[i] ?? 0) - 8}" text-anchor="middle" font-size="11" font-weight="${dense ? 600 : 400}" fill="${TEXT_MUTED}">${fmt(values[i] ?? 0)}</text>`,
      );
    }
  });

  parts.push(`</svg>`);
  return { svg: parts.join("") };
}

/**
 * Scatter: both selected columns are numeric - the first is x, the
 * second y. Unlike the categorical charts the x axis is a numeric
 * domain, so correlation and outliers are readable positionally.
 */
export function renderScatterChart(
  result: QueryResult,
  style: ChartStyle = {},
): RenderedChart {
  const color = style.color ?? "#4c6ef5";
  const pts = result.rows.map((r) => {
    const x = Number(r[0]);
    const y = Number(r[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("scatter charts need two numeric columns (x, y)");
    }
    return { x, y };
  });
  const padBottom = style.xTitle ? 52 : 40;
  const padLeft = style.yTitle ? 78 : 60;
  const innerW = W - padLeft - PAD.right;
  const innerH = H - PAD.top - padBottom;
  const xMinRaw = Math.min(...pts.map((p) => p.x));
  const xMaxRaw = Math.max(...pts.map((p) => p.x));
  const yMinRaw = Math.min(...pts.map((p) => p.y));
  const yMaxRaw = Math.max(...pts.map((p) => p.y));
  const xSpan = xMaxRaw - xMinRaw || 1;
  const yMax = niceCeil(yMaxRaw);
  const yMin = yMinRaw < 0 ? -niceCeil(-yMinRaw) : 0;
  const ySpan = yMax - yMin || 1;
  const xOf = (v: number): number => padLeft + ((v - xMinRaw) / xSpan) * innerW;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );
  const yOf = drawFrame(parts, {
    gridMin: yMin,
    gridMax: yMax,
    span: ySpan,
    innerH,
    padBottom,
    yTitle: style.yTitle,
    xTitle: style.xTitle,
  });
  const ticks = xTickIndices(pts.length);
  for (const i of ticks) {
    const p = pts[i];
    if (!p) continue;
    const x = xOf(p.x);
    parts.push(
      `<text class="x-tick" x="${x}" y="${H - padBottom + 16}" text-anchor="middle" font-size="11" fill="${TEXT_MUTED}">${fmt(p.x)}</text>`,
    );
  }
  for (const p of pts) {
    parts.push(
      `<circle cx="${xOf(p.x)}" cy="${yOf(p.y)}" r="3.5" fill="${color}" />`,
    );
  }
  parts.push(`</svg>`);
  return { svg: parts.join("") };
}

const PIE_FALLBACK_COLORS = [
  "#4c6ef5",
  "#12b886",
  "#fab005",
  "#e64980",
  "#7950f2",
  "#0ca678",
  "#f76707",
  "#74c0fc",
];

/**
 * Pie / donut: each row is a slice - the first selected column
 * labels it, the second sizes it. Negative values are a data
 * error, not something to clamp: half a pie cannot point
 * backwards.
 */
export function renderPieChart(
  result: QueryResult,
  donut = false,
  style: ChartStyle = {},
): RenderedChart {
  const colors = style.colors?.length ? style.colors : PIE_FALLBACK_COLORS;
  const rows = result.rows.map((r) => ({
    label: String(r[0] ?? ""),
    value: Number(r[1] ?? 0),
  }));
  if (rows.length === 0) throw new Error("pie charts need at least one row");
  if (rows.some((r) => r.value < 0)) {
    throw new Error("pie/donut charts need non-negative values");
  }
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total <= 0) throw new Error("pie charts need a positive total");
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - 50;
  const inner = donut ? r * 0.55 : 0;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );
  let angle = -Math.PI / 2;
  rows.forEach((row, i) => {
    const sweep = (row.value / total) * Math.PI * 2;
    const mid = angle + sweep / 2;
    const color = colors[i % colors.length] ?? "#4c6ef5";
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    parts.push(
      `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}" stroke="#fff" stroke-width="1" />`,
    );
    const pct = Math.round((row.value / total) * 100);
    const lx = cx + (r + 22) * Math.cos(mid);
    const ly = cy + (r + 22) * Math.sin(mid);
    const anchor =
      Math.cos(mid) > 0.1 ? "start" : Math.cos(mid) < -0.1 ? "end" : "middle";
    parts.push(
      `<text x="${lx.toFixed(2)}" y="${(ly + 4).toFixed(2)}" text-anchor="${anchor}" font-size="11" fill="${TEXT_DARK}">${escapeXml(row.label)} ${pct}%</text>`,
    );
    angle += sweep;
  });
  if (donut) {
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${inner}" fill="#fff" />`);
  }
  parts.push(`</svg>`);
  return { svg: parts.join("") };
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

function fmt(v: number): string {
  if (Math.abs(v) >= 100) return String(Math.round(v));
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function cellText(c: Cell): string {
  return String(c);
}
