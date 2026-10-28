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
  /** What a pointer, a tap or the arrow keys read off the chart (the
   * host draws the guide and the panel; docs/specs/chart-readout.md). */
  readout?: Readout;
}

/**
 * A chart's points in its own (viewBox) units: per x position its label,
 * and per series the value and where it is drawn. Blanks are null.
 */
export interface Readout {
  width: number;
  height: number;
  /** The plot's top and bottom: the guide line's extent. */
  top: number;
  bottom: number;
  xs: number[];
  labels: string[];
  series: {
    name: string;
    color: string;
    values: (number | null)[];
    ys: (number | null)[];
  }[];
}

/** Theme-driven styling: the series color, the pie palette, and
 * the semantic axis titles drawn from the query's columns. */
export interface ChartStyle {
  color?: string | undefined;
  /** The value column's name, for the readout. */
  seriesName?: string | undefined;
  colors?: string[] | undefined;
  xTitle?: string | undefined;
  yTitle?: string | undefined;
  /** Axis/tick ink. Defaults to the light-paper values; a dark
   * rendition passes its own (the same chart, re-dressed). */
  text?: string | undefined;
  textMuted?: string | undefined;
  grid?: string | undefined;
  /** The page behind the chart: pie seams and the donut hole. */
  paper?: string | undefined;
  /** The value column's display format: "percent" labels 0.22 as
   * 22.0% (ticks and value labels), matching the table. */
  valueFormat?: "percent" | "currency" | undefined;
  /** Category labels in their stable (source table) order: a pie
   * slice takes the color of its category's position here. */
  colorKeys?: string[] | undefined;
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
  if (out[out.length - 1] !== n - 1) {
    // The last point is always labelled; a regular tick too close to
    // it would draw on top of it (2024-12-23 over 2024-12-30).
    if (out.length > 1 && n - 1 - (out[out.length - 1] ?? 0) < step / 2) {
      out.pop();
    }
    out.push(n - 1);
  }
  return out;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * An x tick's text and anchor. ISO dates read as the span needs - the
 * year over three years or more, "Mar 2024" over one - not as
 * 2026-09-30, clipped. The last tick of a long axis ends at its point
 * (centred, it ran off the chart).
 */
function xLabel(
  labels: readonly string[],
  i: number,
): { text: string; anchor: "middle" | "end" } {
  const n = labels.length;
  const raw = labels[i] ?? "";
  const anchor = n > 8 && i === n - 1 ? "end" : "middle";
  const iso = /^(\d{4})-(\d{2})-\d{2}$/;
  const first = iso.exec(labels[0] ?? "");
  const last = iso.exec(labels[n - 1] ?? "");
  const m = iso.exec(raw);
  if (!first || !last || !m) return { text: escapeXml(raw), anchor };
  const span = Number(last[1]) - Number(first[1]);
  if (span >= 3) return { text: m[1] ?? raw, anchor };
  if (span >= 1) {
    return { text: `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1] ?? ""}`, anchor };
  }
  return { text: escapeXml(raw), anchor };
}

/** A chart value: a number, or NaN for a blank (a gap, not a zero). */
function cellNumber(v: unknown): number {
  if (v === "" || v === null || v === undefined) return Number.NaN;
  return Number(v);
}

/** The per-point value labels to draw: all of them for a sparse
 * series; for a dense one only the extremes and the latest point
 * (labeling every point of a 24-month series clumps). */
function valueLabelIndices(
  values: number[],
  maxDense = 12,
): { indices: number[]; dense: boolean } {
  // Blanks (NaN) are never labelled.
  const at = values.flatMap((v, i) => (Number.isFinite(v) ? [i] : []));
  if (values.length <= maxDense) {
    return { indices: at, dense: false };
  }
  let maxI = at[0] ?? 0;
  let minI = at[0] ?? 0;
  for (const i of at) {
    const v = values[i] ?? 0;
    if (v > (values[maxI] ?? 0)) maxI = i;
    if (v < (values[minI] ?? 0)) minI = i;
  }
  const last = at[at.length - 1] ?? values.length - 1;
  if (!at.length) return { indices: [], dense: true };
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
    ticks: number[];
    tickLabel: (v: number) => string;
    innerH: number;
    padBottom: number;
    yTitle?: string | undefined;
    xTitle?: string | undefined;
    grid?: string | undefined;
    ink?: string | undefined;
    inkMuted?: string | undefined;
  },
): (v: number) => number {
  const grid = opts.grid ?? GRID_COLOR;
  const ink = opts.ink ?? TEXT_DARK;
  const inkMuted = opts.inkMuted ?? TEXT_MUTED;
  const padLeft = opts.yTitle ? 78 : 60;
  const yOf = (v: number): number =>
    PAD.top + ((opts.gridMax - v) / opts.span) * opts.innerH;
  for (const v of opts.ticks) {
    const y = yOf(v);
    parts.push(
      `<line x1="${padLeft}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="${grid}" />`,
      `<text class="tick-y" x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${inkMuted}">${opts.tickLabel(v)}</text>`,
    );
  }
  const zeroY = yOf(0);
  if (opts.gridMin < 0) {
    parts.push(
      `<line x1="${padLeft}" y1="${zeroY}" x2="${W - PAD.right}" y2="${zeroY}" stroke="${opts.inkMuted ?? "#8b949e"}" />`,
    );
  }
  if (opts.yTitle) {
    parts.push(
      `<text class="axis-title" transform="translate(16 ${PAD.top + opts.innerH / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="${ink}">${escapeXml(opts.yTitle)}</text>`,
    );
  }
  if (opts.xTitle) {
    parts.push(
      `<text class="axis-title" x="${(padLeft + W - PAD.right) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="${ink}">${escapeXml(opts.xTitle)}</text>`,
    );
  }
  return yOf;
}

/** The 1-2-2.5-5 x 10^n step nearest above `raw`. */
function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * mag;
}

/**
 * The y domain on NICE ticks (0.05, 25, 500 - never quarters of an
 * arbitrary range like 0.18 / 0.05 / -0.07). Zero is always a
 * tick.
 */
function domain(values: number[]): {
  gridMin: number;
  gridMax: number;
  span: number;
  ticks: number[];
  step: number;
} {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const step = niceStep((max - min) / 4 || 1);
  const gridMax = Math.max(step, Math.ceil(max / step - 1e-9) * step);
  const gridMin = Math.floor(min / step + 1e-9) * step;
  const ticks: number[] = [];
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  for (let v = gridMax; v >= gridMin - step / 2; v -= step) {
    const t = Number(v.toFixed(decimals));
    ticks.push(t === 0 ? 0 : t);
  }
  return { gridMin, gridMax, span: gridMax - gridMin || 1, ticks, step };
}

/** Tick labels: as many decimals as the step needs, no more. */
function tickFormatter(
  step: number,
  format: ChartStyle["valueFormat"],
): (v: number) => string {
  const scaled = format === "percent" ? step * 100 : step;
  const decimals = Math.max(0, Math.ceil(-Math.log10(scaled) - 1e-9));
  const d = Number.isInteger(scaled) ? 0 : Math.min(decimals + 1, 4);
  return (v) => {
    const x = format === "percent" ? v * 100 : v;
    const txt = x.toFixed(d).replace(/\.0+$/, "");
    // Big numbers read with thousands separators: 100,000 not 100000.
    const grouped =
      Math.abs(x) >= 10000
        ? Number(txt).toLocaleString("en-GB", { maximumFractionDigits: d })
        : txt;
    return `${grouped === "-0" ? "0" : grouped}${format === "percent" ? "%" : ""}`;
  };
}

/** Value labels: the table's own formatting for percentages. */
function valueFormatter(
  format: ChartStyle["valueFormat"],
): (v: number) => string {
  return format === "percent" ? (v) => `${(v * 100).toFixed(1)}%` : fmt;
}

export function renderBarChart(
  result: QueryResult,
  style: ChartStyle = {},
): RenderedChart {
  const ink = style.text ?? TEXT_DARK;
  const inkMuted = style.textMuted ?? TEXT_MUTED;
  const color = style.color ?? "#4c6ef5";
  // A blank is no bar and no label - never a zero.
  const values = result.rows.map((r) => cellNumber(r[1]));
  const present = values.filter((v) => Number.isFinite(v));
  const padBottom = style.xTitle ? 52 : 40;
  const innerH = H - PAD.top - padBottom;
  // A negative bar's label hangs under the bar's end: when that
  // would run into the x tick labels, the floor drops one step.
  let dom = domain(present.length ? present : [0]);
  const lowest = Math.min(...present, 0);
  if (lowest < 0) {
    const roomPx = ((lowest - dom.gridMin) / dom.span) * innerH;
    if (roomPx < 11) dom = domain([...present, dom.gridMin - dom.step / 2]);
  }
  const { gridMin, gridMax, span, ticks, step } = dom;
  const tickLabel = tickFormatter(step, style.valueFormat);
  const valueLabel = valueFormatter(style.valueFormat);
  const innerW = W - (style.yTitle ? 78 : 60) - PAD.right;
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
    ticks,
    tickLabel,
    innerH,
    padBottom,
    grid: style.grid,
    ink: style.text,
    inkMuted: style.textMuted,
    yTitle: style.yTitle,
    xTitle: style.xTitle,
  });
  const zeroY = yOf(0);
  const padLeft = style.yTitle ? 78 : 60;
  const { indices: labelAt } = valueLabelIndices(values);
  result.rows.forEach((_row, i) => {
    const value = values[i] ?? Number.NaN;
    const x = padLeft + band * i + (band - barW) / 2;
    const blank = !Number.isFinite(value);
    const y = value >= 0 ? yOf(value) : zeroY;
    const height = Math.max(
      value >= 0 ? zeroY - yOf(value) : yOf(value) - zeroY,
      0,
    );
    if (!blank) {
      parts.push(
        `<rect x="${x}" y="${y}" width="${barW}" height="${height}" fill="${color}" rx="2" />`,
      );
    }
    if (xTickIndices(n).includes(i)) {
      const lab = xLabel(
        result.rows.map((r) => String(r[0] ?? "")),
        i,
      );
      parts.push(
        `<text class="x-tick" x="${lab.anchor === "end" ? x + barW : x + barW / 2}" y="${H - padBottom + 16}" text-anchor="${lab.anchor}" font-size="11" fill="${ink}">${lab.text}</text>`,
      );
    }
    if (labelAt.includes(i)) {
      const valueY =
        value >= 0 ? y - 4 : Math.min(zeroY + height + 12, H - PAD.top);
      parts.push(
        `<text class="v-label" x="${x + barW / 2}" y="${valueY}" text-anchor="middle" font-size="11" fill="${inkMuted}">${valueLabel(value)}</text>`,
      );
    }
  });

  parts.push(`</svg>`);
  return {
    svg: parts.join(""),
    readout: {
      width: W,
      height: H,
      top: PAD.top,
      bottom: PAD.top + innerH,
      xs: result.rows.map((_, i) => padLeft + band * i + band / 2),
      labels: result.rows.map((r) => String(r[0] ?? "")),
      series: [
        {
          name: style.seriesName ?? style.yTitle ?? "",
          color,
          values: values.map((v) => (Number.isFinite(v) ? v : null)),
          ys: values.map((v) => (Number.isFinite(v) ? yOf(v) : null)),
        },
      ],
    },
  };
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
  const ink = style.text ?? TEXT_DARK;
  const inkMuted = style.textMuted ?? TEXT_MUTED;
  const color = style.color ?? "#4c6ef5";
  // A blank is no value: a gap in the line, never a dive to zero.
  const raw = result.rows.map((r) => cellNumber(r[1]));
  const present = raw.filter((v) => Number.isFinite(v));
  // Labels and extremes read only the points that exist.
  const values = raw.map((v) => (Number.isFinite(v) ? v : Number.NaN));
  const { gridMin, gridMax, span, ticks, step } = domain(
    present.length ? present : [0],
  );
  const tickLabel = tickFormatter(step, style.valueFormat);
  const valueLabel = valueFormatter(style.valueFormat);
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
    ticks,
    tickLabel,
    innerH,
    padBottom,
    grid: style.grid,
    ink: style.text,
    inkMuted: style.textMuted,
    yTitle: style.yTitle,
    xTitle: style.xTitle,
  });
  const zeroY = yOf(0);
  const xs = result.rows.map((_, i) => padLeft + band * i + band / 2);
  const ys = values.map((v) => yOf(v));
  // Unbroken runs of points: the line (and its fill) breaks at blanks.
  const runs: number[][] = [];
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1] === i - 1) last.push(i);
    else runs.push([i]);
  });
  const pointsOf = (run: number[]): string =>
    run.map((i) => `${xs[i]},${ys[i]}`).join(" ");

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
    // fill hangs below the curve down to the plot's floor, a
    // whisper (the gradient), not a statement. (SVG y grows
    // DOWNWARD: the floor is the LARGEST y.)
    const baseY = areaMode ? zeroY : PAD.top + innerH;
    for (const run of runs) {
      fillParts.push(
        `<polygon points="${xs[run[0] ?? 0]},${baseY} ${pointsOf(run)} ${xs[run[run.length - 1] ?? 0]},${baseY}" fill="url(#${gid})" />`,
      );
    }
  }
  for (const run of runs) {
    if (run.length > 1) {
      fillParts.push(
        `<polyline points="${pointsOf(run)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`,
      );
    }
  }
  parts.push(...fillParts);

  const { indices: picked, dense } = valueLabelIndices(values);
  // Labels that would collide give way: the last point (the
  // series' end) wins, then the extremes in order.
  const labelAt: number[] = [];
  for (const i of [...picked].sort((a, b) =>
    a === n - 1 ? -1 : b === n - 1 ? 1 : 0,
  )) {
    const clash = labelAt.some(
      (j) =>
        Math.abs((xs[i] ?? 0) - (xs[j] ?? 0)) < 40 &&
        Math.abs((ys[i] ?? 0) - (ys[j] ?? 0)) < 14,
    );
    if (!clash) labelAt.push(i);
  }
  const tickAt = new Set(xTickIndices(n));
  // Dense series draw a marker per x-TICK only: a marker on every
  // point turns a smooth 512-sample line into a bead necklace.
  // Sparse series keep every marker.
  // A dense line marks only the points it labels (high, low, latest):
  // dots at the tick months read as data points that matter.
  const markerAt: (i: number) => boolean = (i) =>
    Number.isFinite(values[i]) && (n > 64 ? labelAt.includes(i) : true);
  const xLabels = result.rows.map((r) => String(r[0] ?? ""));
  result.rows.forEach((_row, i) => {
    const x = xs[i] ?? 0;
    if (markerAt(i)) {
      parts.push(`<circle cx="${x}" cy="${ys[i]}" r="3" fill="${color}" />`);
    }
    if (tickAt.has(i)) {
      parts.push(
        `<text class="x-tick" x="${x}" y="${H - padBottom + 16}" text-anchor="${xLabel(xLabels, i).anchor}" font-size="11" fill="${ink}">${xLabel(xLabels, i).text}</text>`,
      );
    }
    if (labelAt.includes(i)) {
      // Dense series label only their extremes and the last
      // point, above the curve; sparse series label every point.
      // A dense series' minimum hangs its label BELOW the point
      // (above it, the label sits on the line climbing out).
      const below =
        dense &&
        i !== n - 1 &&
        (values[i] ?? 0) === Math.min(...present) &&
        (values[i] ?? 0) !== Math.max(...present);
      // On the plot's floor there is no room below (the x ticks
      // live there): the label sits beside the point instead.
      const floorY = PAD.top + innerH;
      const beside = below && (ys[i] ?? 0) + 17 > floorY - 4;
      const labelY = beside
        ? (ys[i] ?? 0) + 4
        : below
          ? (ys[i] ?? 0) + 17
          : (ys[i] ?? 0) - 8;
      const labelX = beside ? x + 8 : x;
      parts.push(
        `<text class="v-label" x="${labelX}" y="${labelY}" text-anchor="${beside ? "start" : "middle"}" font-size="11" font-weight="${dense ? 600 : 400}" fill="${inkMuted}">${valueLabel(values[i] ?? 0)}</text>`,
      );
    }
  });

  parts.push(`</svg>`);
  return {
    svg: parts.join(""),
    readout: {
      width: W,
      height: H,
      top: PAD.top,
      bottom: PAD.top + innerH,
      xs,
      labels: result.rows.map((r) => String(r[0] ?? "")),
      series: [
        {
          name: style.seriesName ?? style.yTitle ?? "",
          color,
          values: values.map((v) => (Number.isFinite(v) ? v : null)),
          ys: values.map((v, i) =>
            Number.isFinite(v) ? (ys[i] ?? null) : null,
          ),
        },
      ],
    },
  };
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
  const inkMuted = style.textMuted ?? TEXT_MUTED;
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
  const yDom = domain([yMinRaw, yMaxRaw]);
  const xOf = (v: number): number => padLeft + ((v - xMinRaw) / xSpan) * innerW;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );
  const yOf = drawFrame(parts, {
    gridMin: yDom.gridMin,
    gridMax: yDom.gridMax,
    span: yDom.span,
    ticks: yDom.ticks,
    tickLabel: tickFormatter(yDom.step, style.valueFormat),
    innerH,
    padBottom,
    yTitle: style.yTitle,
    xTitle: style.xTitle,
    grid: style.grid,
    ink: style.text,
    inkMuted: style.textMuted,
  });
  const ticks = xTickIndices(pts.length);
  for (const i of ticks) {
    const p = pts[i];
    if (!p) continue;
    const x = xOf(p.x);
    parts.push(
      `<text class="x-tick" x="${x}" y="${H - padBottom + 16}" text-anchor="middle" font-size="11" fill="${inkMuted}">${fmt(p.x)}</text>`,
    );
  }
  for (const p of pts) {
    parts.push(
      // The browser's own tooltip names the point (a scatter has no
      // single x to read across).
      `<circle cx="${xOf(p.x)}" cy="${yOf(p.y)}" r="3.5" fill="${color}"><title>${escapeXml(`${fmt(p.x)}, ${valueFormatter(style.valueFormat)(p.y)}`)}</title></circle>`,
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
  const ink = style.text ?? TEXT_DARK;
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
    // A slice's color belongs to its CATEGORY (its place in the
    // source table), not its place in the sorted result - otherwise
    // an edit that reorders slices swaps their colors.
    const key = style.colorKeys?.indexOf(row.label) ?? -1;
    const color = colors[(key >= 0 ? key : i) % colors.length] ?? "#4c6ef5";
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    parts.push(
      `<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}" stroke="${style.paper ?? "#ffffff"}" stroke-width="1.5"><title>${escapeXml(`${row.label}: ${valueFormatter(style.valueFormat)(row.value)} (${String(Math.round((row.value / total) * 100))}%)`)}</title></path>`,
    );
    const pct = Math.round((row.value / total) * 100);
    const lx = cx + (r + 22) * Math.cos(mid);
    const ly = cy + (r + 22) * Math.sin(mid);
    const anchor =
      Math.cos(mid) > 0.1 ? "start" : Math.cos(mid) < -0.1 ? "end" : "middle";
    parts.push(
      `<text x="${lx.toFixed(2)}" y="${(ly + 4).toFixed(2)}" text-anchor="${anchor}" font-size="11" fill="${ink}">${escapeXml(row.label)} ${pct}%</text>`,
    );
    angle += sweep;
  });
  if (donut) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="${style.paper ?? "#ffffff"}" />`,
    );
  }
  parts.push(`</svg>`);
  return { svg: parts.join("") };
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

/* --- Several series (spec: chart-rendering.md, "Several series") --- */

export interface SeriesChartData {
  categories: string[];
  series: { name: string; values: (number | null)[] }[];
}

export interface RenderedSeriesChart extends RenderedChart {
  /** Legend entries, in series order: the host draws the legend. */
  legend: { name: string; color: string }[];
}

/**
 * Bar (grouped, or stacked with `stack`), line (one line per series),
 * or area (overlapping, or stacked with `stack`). Gaps (null) are
 * skipped: a line breaks, a bar is absent, a stacked area treats a
 * gap as zero.
 */
export function renderSeriesChart(
  data: SeriesChartData,
  type: "bar" | "line" | "area",
  stack: boolean,
  style: ChartStyle = {},
): RenderedSeriesChart {
  const ink = style.text ?? TEXT_DARK;
  const inkMuted = style.textMuted ?? TEXT_MUTED;
  const colors = style.colors?.length ? style.colors : PIE_FALLBACK_COLORS;
  const colorOf = (i: number): string => colors[i % colors.length] ?? "#4c6ef5";
  const n = data.categories.length || 1;
  const stacked = stack && type !== "line";
  // The domain covers every drawn value - stacked sums both ways.
  const extent: number[] = [];
  if (stacked) {
    data.categories.forEach((_, c) => {
      let pos = 0;
      let neg = 0;
      for (const s of data.series) {
        const v = s.values[c] ?? 0;
        if (v >= 0) pos += v;
        else neg += v;
      }
      extent.push(pos, neg);
    });
  } else {
    for (const s of data.series) {
      for (const v of s.values) if (v !== null) extent.push(v);
    }
  }
  const { gridMin, gridMax, span, ticks, step } = domain(extent);
  const tickLabel = tickFormatter(step, style.valueFormat);
  const valueLabel = valueFormatter(style.valueFormat);
  const padBottom = style.xTitle ? 52 : 40;
  const padLeft = style.yTitle ? 78 : 60;
  const innerW = W - padLeft - PAD.right;
  const innerH = H - PAD.top - padBottom;
  const band = innerW / n;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  ];
  const yOf = drawFrame(parts, {
    gridMin,
    gridMax,
    span,
    ticks,
    tickLabel,
    innerH,
    padBottom,
    grid: style.grid,
    ink: style.text,
    inkMuted: style.textMuted,
    yTitle: style.yTitle,
    xTitle: style.xTitle,
  });
  const zeroY = yOf(0);
  const xMid = (c: number): number => padLeft + band * c + band / 2;
  const tickAt = new Set(xTickIndices(n));
  data.categories.forEach((_cat, c) => {
    if (!tickAt.has(c)) return;
    const lab = xLabel(data.categories, c);
    parts.push(
      `<text class="x-tick" x="${lab.anchor === "end" ? padLeft + band * (c + 1) : xMid(c)}" y="${H - padBottom + 16}" text-anchor="${lab.anchor}" font-size="11" fill="${ink}">${lab.text}</text>`,
    );
  });
  const k = data.series.length;
  if (type === "bar" && !stacked) {
    // Grouped: the series side by side within each category's band.
    const groupW = Math.min(band * 0.75, 28 * k + 12);
    const barW = groupW / k;
    const labels = k * n <= 12;
    data.series.forEach((s, i) => {
      s.values.forEach((v, c) => {
        if (v === null) return;
        const x = padLeft + band * c + (band - groupW) / 2 + barW * i;
        const y = v >= 0 ? yOf(v) : zeroY;
        const h = Math.abs(yOf(v) - zeroY);
        parts.push(
          `<rect class="series-${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 1.5).toFixed(1)}" height="${h.toFixed(1)}" fill="${colorOf(i)}" rx="1.5" />`,
        );
        if (labels) {
          const ly = v >= 0 ? y - 4 : y + h + 12;
          parts.push(
            `<text class="v-label" x="${(x + barW / 2).toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="10" fill="${inkMuted}">${valueLabel(v)}</text>`,
          );
        }
      });
    });
  } else if (type === "bar") {
    // Stacked: positives build up from zero, negatives down; the
    // TOTAL labels each stack.
    const barW = Math.min(band * 0.6, 80);
    data.categories.forEach((_, c) => {
      let up = 0;
      let down = 0;
      const x = xMid(c) - barW / 2;
      data.series.forEach((s, i) => {
        const v = s.values[c] ?? 0;
        if (v === 0) return;
        const from = v >= 0 ? up : down;
        const to = from + v;
        if (v >= 0) up = to;
        else down = to;
        const y = Math.min(yOf(from), yOf(to));
        const h = Math.abs(yOf(to) - yOf(from));
        parts.push(
          `<rect class="series-${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${colorOf(i)}" />`,
        );
      });
      if (n <= 12) {
        const total = up + down;
        parts.push(
          `<text class="v-label" x="${xMid(c).toFixed(1)}" y="${(yOf(up) - 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="${inkMuted}">${valueLabel(total)}</text>`,
        );
      }
    });
  } else {
    // Lines / areas. A stacked area's baseline is the series below.
    const base = data.categories.map(() => 0);
    data.series.forEach((s, i) => {
      const color = colorOf(i);
      const tops = s.values.map((v, c) =>
        stacked ? (base[c] ?? 0) + (v ?? 0) : v,
      );
      if (type === "area") {
        const lower = data.categories.map((_, c) =>
          stacked ? (base[c] ?? 0) : 0,
        );
        const upper = tops.map((v) => v ?? 0);
        const pts = [
          ...upper.map((v, c) => `${xMid(c).toFixed(1)},${yOf(v).toFixed(1)}`),
          ...lower
            .map((v, c) => `${xMid(c).toFixed(1)},${yOf(v).toFixed(1)}`)
            .reverse(),
        ].join(" ");
        parts.push(
          `<polygon class="series-${i}" points="${pts}" fill="${color}" fill-opacity="${stacked ? 0.85 : 0.22}" />`,
        );
      }
      // The line, broken at gaps.
      let run: string[] = [];
      const flush = (): void => {
        if (run.length > 1) {
          parts.push(
            `<polyline class="series-${i}" points="${run.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`,
          );
        }
        run = [];
      };
      tops.forEach((v, c) => {
        if (v === null) {
          flush();
          return;
        }
        run.push(`${xMid(c).toFixed(1)},${yOf(v).toFixed(1)}`);
        if (type === "line" && n <= 64) {
          parts.push(
            `<circle cx="${xMid(c).toFixed(1)}" cy="${yOf(v).toFixed(1)}" r="2.5" fill="${color}" />`,
          );
        }
      });
      flush();
      if (stacked)
        s.values.forEach((v, c) => (base[c] = (base[c] ?? 0) + (v ?? 0)));
    });
  }
  parts.push("</svg>");
  // Where each value is drawn: stacked series sit on the ones below.
  const sums = data.categories.map(() => 0);
  const readSeries = data.series.map((s, i) => ({
    name: s.name,
    color: colorOf(i),
    values: s.values,
    ys: s.values.map((v, c) => {
      if (v === null) return null;
      if (!stacked) return yOf(v);
      sums[c] = (sums[c] ?? 0) + v;
      return yOf(sums[c] ?? v);
    }),
  }));
  return {
    svg: parts.join(""),
    legend: data.series.map((s, i) => ({ name: s.name, color: colorOf(i) })),
    readout: {
      width: W,
      height: H,
      top: PAD.top,
      bottom: PAD.top + innerH,
      xs: data.categories.map((_, c) => xMid(c)),
      labels: data.categories,
      series: readSeries,
    },
  };
}
