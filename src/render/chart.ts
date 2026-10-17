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
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = result.rows.length || 1;
  const band = innerW / n;
  const barW = Math.min(band * 0.6, 80);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">`,
  );

  const gridMax = niceCeil(max);
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (innerH * i) / 4;
    const v = gridMax - (gridMax * i) / 4;
    parts.push(
      `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#e6e8eb" />`,
      `<text x="${PAD.left - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#57606a">${fmt(v)}</text>`,
    );
  }

  result.rows.forEach((row, i) => {
    const value = Number(row[1] ?? 0);
    const h = (value / gridMax) * innerH;
    const x = PAD.left + band * i + (band - barW) / 2;
    const y = PAD.top + innerH - h;
    parts.push(
      `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 0)}" fill="#4c6ef5" rx="2" />`,
    );
    const label = escapeXml(String(row[0] ?? ""));
    parts.push(
      `<text x="${x + barW / 2}" y="${H - PAD.bottom + 16}" text-anchor="middle" font-size="11" fill="#1f2328">${label}</text>`,
      `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="11" fill="#57606a">${fmt(value)}</text>`,
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
