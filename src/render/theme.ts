/**
 * Closed, typed theme schema (ADR-0002). Documents reference themes;
 * they never carry style. This module maps frontmatter style keys to
 * a typed Theme and emits the component's CSS.
 */
import type { Doc } from "../engine/doc.js";

export interface Theme {
  bodyFont: string;
  bodySize: string;
  h1Font: string;
  h1Size: string;
  h2Size: string;
  tableStyle: string;
  palette: string[];
}

const PALETTES: Record<string, string[]> = {
  muted: ["#4c6ef5", "#12b886", "#fab005", "#e8590c", "#845ef7"],
  corporate: ["#1c3f60", "#2f6a8f", "#6aa2b8", "#b8cdd9", "#3d5a80"],
};

const DEFAULT_THEME: Theme = {
  bodyFont: "Source Serif 4, Georgia, serif",
  bodySize: "17px",
  h1Font: "Source Serif 4, Georgia, serif",
  h1Size: "28pt",
  h2Size: "20pt",
  tableStyle: "booktabs",
  palette: PALETTES["muted"] ?? ["#4c6ef5"],
};

export function themeFromDoc(doc: Doc): Theme {
  const style = new Map(doc.frontmatter.style);
  return {
    bodyFont: style.get("body.font.family")
      ? `"${style.get("body.font.family")}", Georgia, serif`
      : DEFAULT_THEME.bodyFont,
    bodySize: style.get("body.font.size") ?? DEFAULT_THEME.bodySize,
    h1Font: style.get("h1.font.family")
      ? `"${style.get("h1.font.family")}", Georgia, serif`
      : DEFAULT_THEME.h1Font,
    h1Size: style.get("h1.font.size") ?? DEFAULT_THEME.h1Size,
    h2Size: style.get("h2.font.size") ?? DEFAULT_THEME.h2Size,
    tableStyle: style.get("table.style") ?? DEFAULT_THEME.tableStyle,
    palette:
      PALETTES[style.get("chart.palette") ?? "muted"] ?? DEFAULT_THEME.palette,
  };
}

export function themeCss(theme: Theme): string {
  return `
    :host { display: block; }
    article.folio-doc {
      max-width: 720px;
      margin: 0 auto;
      font-family: ${theme.bodyFont};
      font-size: ${theme.bodySize};
      line-height: 1.65;
      color: #1f2328;
    }
    h1 {
      font-family: ${theme.h1Font};
      font-size: ${theme.h1Size};
      line-height: 1.2;
      margin: 1.6em 0 0.6em;
    }
    h2 {
      font-size: ${theme.h2Size};
      line-height: 1.25;
      margin: 1.8em 0 0.5em;
    }
    figure {
      margin: 1.6em 0;
    }
    figcaption {
      font-size: 0.85em;
      color: #57606a;
      margin-top: 0.4em;
      text-align: center;
    }
    table.folio-table {
      border-collapse: collapse;
      width: 100%;
      font-variant-numeric: tabular-nums;
    }
    table.folio-table thead tr { border-top: 2px solid #1f2328; }
    table.folio-table thead th {
      border-bottom: 1px solid #1f2328;
      text-align: left;
      padding: 6px 10px;
      font-weight: 600;
    }
    table.folio-table tbody tr:last-child td {
      border-bottom: 2px solid #1f2328;
    }
    table.folio-table td, table.folio-table th { padding: 5px 10px; }
    td.num, th.num { text-align: right; }
    td.folio-formula { font-feature-settings: "tnum"; }
    input.folio-cell {
      border: none;
      background: transparent;
      font: inherit;
      width: 100%;
      padding: 2px 4px;
      margin: -2px -4px;
      border-radius: 3px;
    }
    input.folio-cell.num { text-align: right; }
    input.folio-cell:hover { background: rgba(76, 110, 245, 0.08); }
    input.folio-cell:focus {
      outline: 2px solid #4c6ef5;
      outline-offset: 0;
      background: #fff;
    }
    code {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 0.9em;
      background: #f6f8fa;
      padding: 0.1em 0.3em;
      border-radius: 3px;
    }
    p { margin: 0.9em 0; }
    [contenteditable="true"] { border-radius: 3px; caret-color: #1f2328; }
    [contenteditable="true"]:hover { background: rgba(76, 110, 245, 0.05); }
    [contenteditable="true"]:focus {
      background: rgba(76, 110, 245, 0.07);
      box-shadow: 0 0 0 2px rgba(76, 110, 245, 0.07);
    }
    [contenteditable="true"]:empty::before {
      content: "…";
      color: #b0b8c1;
    }
    input.folio-cell.folio-head {
      font-weight: 600;
      color: inherit;
    }
    td.folio-ctl, th.folio-ctl {
      width: 1%;
      white-space: nowrap;
      border-bottom: none !important;
    }
    .folio-btn {
      border: 1px solid #d0d7de;
      background: #fff;
      border-radius: 5px;
      width: 22px;
      height: 22px;
      line-height: 1;
      font-size: 13px;
      color: #57606a;
      cursor: pointer;
      margin-left: 3px;
      padding: 0;
    }
    .folio-btn:hover { background: #f3f4f6; color: #1f2328; }
    .chart-holder svg { width: 100%; height: auto; display: block; }
  `;
}
