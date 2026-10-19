/**
 * Publication-quality SVG chart rendering (ADR-0004).
 * Charts are queries; render() consumes executeQuery output and
 * emits static vector SVG — embeddable in exports, interactive
 * affordances are progressive enhancement.
 */
import type { Cell } from "../engine/index.js";
import type { QueryResult } from "../engine/query.js";

export interface RenderedChart {
  svg: string;
}

const W = 640;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 40, left: 60 };

export function renderBarChart(result: QueryResult): RenderedChart {
  const values = result.rows.map((r) => Number(r[1] ?? 0));
  const max = Math.max(...values, 0.000001);
  const min = Math.min(...values, 0);
  // The axis domain must cover negative values: a decline that
  // clamps at zero hides the data (the growth chart drew every
  // negative as nothing).
  const gridMax = niceCeil(max);
  const gridMin = min < 0 ? -niceCeil(-min) : 0;
  const span = gridMax - gridMin || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = result.rows.length || 1;
  const band = innerW / n;
  const barW = Math.min(band * 0.6, 80);
  const yOf = (v: number): number => PAD.top + ((gridMax - v) / span) * innerH;
  const zeroY = yOf(0);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );

  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (innerH * i) / 4;
    const v = gridMax - (span * i) / 4;
    parts.push(
      `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#e6e8eb" />`,
      `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#57606a">${fmt(v)}</text>`,
    );
  }
  if (gridMin < 0) {
    // The zero baseline is the anchor negative bars hang from.
    parts.push(
      `<line x1="${PAD.left}" y1="${zeroY}" x2="${W - PAD.right}" y2="${zeroY}" stroke="#8b949e" />`,
    );
  }

  result.rows.forEach((row, i) => {
    const value = Number(row[1] ?? 0);
    const x = PAD.left + band * i + (band - barW) / 2;
    const y = value >= 0 ? yOf(value) : zeroY;
    const height = Math.max(
      value >= 0 ? zeroY - yOf(value) : yOf(value) - zeroY,
      0,
    );
    parts.push(
      `<rect x="${x}" y="${y}" width="${barW}" height="${height}" fill="#4c6ef5" rx="2" />`,
    );
    const label = escapeXml(String(row[0] ?? ""));
    // Value labels hug their bar: above for positive growth,
    // below the bar for negative (never inside the axis).
    const valueY =
      value >= 0 ? y - 4 : Math.min(zeroY + height + 12, H - PAD.top);
    parts.push(
      `<text x="${x + barW / 2}" y="${H - PAD.bottom + 16}" text-anchor="middle" font-size="11" fill="#1f2328">${label}</text>`,
      `<text x="${x + barW / 2}" y="${valueY}" text-anchor="middle" font-size="11" fill="#57606a">${fmt(value)}</text>`,
    );
  });

  parts.push(`</svg>`);
  return { svg: parts.join("") };
}

export function renderLineChart(result: QueryResult): RenderedChart {
  const values = result.rows.map((r) => Number(r[1] ?? 0));
  const max = Math.max(...values, 0.000001);
  const min = Math.min(...values, 0);
  const gridMax = niceCeil(max);
  const gridMin = min < 0 ? -niceCeil(-min) : 0;
  const span = gridMax - gridMin || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = result.rows.length || 1;
  const band = innerW / n;
  const yOf = (v: number): number => PAD.top + ((gridMax - v) / span) * innerH;
  const zeroY = yOf(0);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (innerH * i) / 4;
    const v = gridMax - (span * i) / 4;
    parts.push(
      `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#e6e8eb" />`,
      `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#57606a">${fmt(v)}</text>`,
    );
  }
  if (gridMin < 0) {
    parts.push(
      `<line x1="${PAD.left}" y1="${zeroY}" x2="${W - PAD.right}" y2="${zeroY}" stroke="#8b949e" />`,
    );
  }
  const points = result.rows.map(
    (row, i) => `${PAD.left + band * i + band / 2},${yOf(Number(row[1] ?? 0))}`,
  );
  if (points.length > 1) {
    parts.push(
      `<polyline points="${points.join(" ")}" fill="none" stroke="#4c6ef5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`,
    );
  }
  result.rows.forEach((row, i) => {
    const x = PAD.left + band * i + band / 2;
    const y = yOf(Number(row[1] ?? 0));
    parts.push(`<circle cx="${x}" cy="${y}" r="3" fill="#4c6ef5" />`);
    const label = escapeXml(String(row[0] ?? ""));
    const value = Number(row[1] ?? 0);
    parts.push(
      `<text x="${x}" y="${H - PAD.bottom + 16}" text-anchor="middle" font-size="11" fill="#1f2328">${label}</text>`,
      `<text x="${x}" y="${y - 8}" text-anchor="middle" font-size="11" fill="#57606a">${fmt(value)}</text>`,
    );
  });
  parts.push(`</svg>`);
  return { svg: parts.join("") };
}

/**
 * Area: a line chart whose series closes down to the zero
 * baseline - the filled polygon makes cumulative magnitude
 * readable in a way a bare polyline is not.
 */
export function renderAreaChart(result: QueryResult): RenderedChart {
  const values = result.rows.map((r) => Number(r[1] ?? 0));
  const max = Math.max(...values, 0.000001);
  const min = Math.min(...values, 0);
  const gridMax = niceCeil(max);
  const gridMin = min < 0 ? -niceCeil(-min) : 0;
  const span = gridMax - gridMin || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = result.rows.length || 1;
  const band = innerW / n;
  const yOf = (v: number): number => PAD.top + ((gridMax - v) / span) * innerH;
  const zeroY = yOf(0);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (innerH * i) / 4;
    const v = gridMax - (span * i) / 4;
    parts.push(
      `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#e6e8eb" />`,
      `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#57606a">${fmt(v)}</text>`,
    );
  }
  if (gridMin < 0) {
    parts.push(
      `<line x1="${PAD.left}" y1="${zeroY}" x2="${W - PAD.right}" y2="${zeroY}" stroke="#8b949e" />`,
    );
  }
  const points = result.rows.map(
    (row, i) => `${PAD.left + band * i + band / 2},${yOf(Number(row[1] ?? 0))}`,
  );
  if (points.length > 0) {
    const firstX = PAD.left + band / 2;
    const lastX = PAD.left + band * (n - 1) + band / 2;
    const area = `${firstX},${zeroY} ${points.join(" ")} ${lastX},${zeroY}`;
    parts.push(
      `<polygon points="${area}" fill="rgba(76, 110, 245, 0.15)" />`,
      `<polyline points="${points.join(" ")}" fill="none" stroke="#4c6ef5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`,
    );
  }
  result.rows.forEach((row, i) => {
    const x = PAD.left + band * i + band / 2;
    const y = yOf(Number(row[1] ?? 0));
    parts.push(`<circle cx="${x}" cy="${y}" r="3" fill="#4c6ef5" />`);
    const label = escapeXml(String(row[0] ?? ""));
    parts.push(
      `<text x="${x}" y="${H - PAD.bottom + 16}" text-anchor="middle" font-size="11" fill="#1f2328">${label}</text>`,
    );
  });
  parts.push(`</svg>`);
  return { svg: parts.join("") };
}

/**
 * Scatter: both selected columns are numeric - the first is x, the
 * second y. Unlike the categorical charts the x axis is a numeric
 * domain, so correlation and outliers are readable positionally.
 */
export function renderScatterChart(result: QueryResult): RenderedChart {
  const pts = result.rows.map((r) => {
    const x = Number(r[0]);
    const y = Number(r[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("scatter charts need two numeric columns (x, y)");
    }
    return { x, y };
  });
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xMinRaw = Math.min(...pts.map((p) => p.x));
  const xMaxRaw = Math.max(...pts.map((p) => p.x));
  const yMinRaw = Math.min(...pts.map((p) => p.y));
  const yMaxRaw = Math.max(...pts.map((p) => p.y));
  const xSpan = xMaxRaw - xMinRaw || 1;
  const yMax = niceCeil(yMaxRaw);
  const yMin = yMinRaw < 0 ? -niceCeil(-yMinRaw) : 0;
  const ySpan = yMax - yMin || 1;
  const xOf = (v: number): number =>
    PAD.left + ((v - xMinRaw) / xSpan) * innerW;
  const yOf = (v: number): number => PAD.top + ((yMax - v) / ySpan) * innerH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (innerH * i) / 4;
    const v = yMax - (ySpan * i) / 4;
    parts.push(
      `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#e6e8eb" />`,
      `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#57606a">${fmt(v)}</text>`,
    );
  }
  for (let i = 0; i <= 4; i++) {
    const x = PAD.left + (innerW * i) / 4;
    const v = xMinRaw + (xSpan * i) / 4;
    parts.push(
      `<text x="${x}" y="${H - PAD.bottom + 16}" text-anchor="middle" font-size="11" fill="#57606a">${fmt(v)}</text>`,
    );
  }
  for (const p of pts) {
    parts.push(
      `<circle cx="${xOf(p.x)}" cy="${yOf(p.y)}" r="3.5" fill="#4c6ef5" />`,
    );
  }
  parts.push(`</svg>`);
  return { svg: parts.join("") };
}

const PIE_COLORS = [
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
): RenderedChart {
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
    const color = PIE_COLORS[i % PIE_COLORS.length] ?? "#4c6ef5";
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
      `<text x="${lx.toFixed(2)}" y="${(ly + 4).toFixed(2)}" text-anchor="${anchor}" font-size="11" fill="#1f2328">${escapeXml(row.label)} ${pct}%</text>`,
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
