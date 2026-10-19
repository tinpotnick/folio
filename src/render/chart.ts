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
