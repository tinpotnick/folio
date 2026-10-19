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
  h3Size: string;
  tableStyle: string;
  palette: string[];
  pageBreakH1: boolean;
  pageBreakH2: boolean;
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
  h3Size: "16pt",
  tableStyle: "booktabs",
  palette: PALETTES["muted"] ?? ["#4c6ef5"],
  pageBreakH1: false,
  pageBreakH2: false,
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
    h3Size: style.get("h3.font.size") ?? DEFAULT_THEME.h3Size,
    tableStyle: style.get("table.style") ?? DEFAULT_THEME.tableStyle,
    palette:
      PALETTES[style.get("chart.palette") ?? "muted"] ?? DEFAULT_THEME.palette,
    pageBreakH1: style.get("pagebreak.h1") === "before",
    pageBreakH2: style.get("pagebreak.h2") === "before",
  };
}

export function themeCss(theme: Theme): string {
  return `
    :host { display: block; }
    /* Author display rules beat the UA's [hidden] mapping, and the
       host page's guard does not pierce the shadow boundary. */
    [hidden] {
      display: none !important;
    }
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
    h3 {
      font-size: ${theme.h3Size};
      line-height: 1.3;
      margin: 1.5em 0 0.4em;
    }
    /* Right-to-left scripts (Arabic, Hebrew, ...) follow their own
       direction: each block's direction and justification derive
       from its first strong character (unicode-bidi: plaintext),
       so an Arabic paragraph right-aligns while the surrounding
       English document is untouched. A direction is typography,
       not content - it lives in the theme, never in the document
       (AGENTS.md #1). */
    article.folio-doc h1,
    article.folio-doc h2,
    article.folio-doc p,
    article.folio-doc figcaption,
    article.folio-doc td,
    article.folio-doc th {
      unicode-bidi: plaintext;
      text-align: start;
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
    table.folio-table td:empty::after {
      content: "\\00a0";
      opacity: 0;
    }
    table.folio-table thead th .unit {
      font-weight: 400;
      font-style: italic;
      font-size: 0.8em;
      color: #57606a;
    }
    table.folio-table thead th .name { user-select: text; }
    table.folio-table thead th .name:hover {
      background: rgba(76, 110, 245, 0.05);
      border-radius: 3px;
    }
    table.folio-table thead th .name:focus {
      outline: none;
      background: rgba(76, 110, 245, 0.07);
      box-shadow: inset 0 0 0 1px rgba(76, 110, 245, 0.25);
      border-radius: 3px;
    }
    .folio-table-error {
      color: #9a6700;
      font-size: 0.9em;
      padding: 6px 2px;
    }
    ${
      theme.tableStyle === "plain"
        ? `table.folio-table thead tr { border-top: 1px solid #d0d7de; }
    table.folio-table thead th { border-bottom: 1px solid #d0d7de; }
    table.folio-table tbody tr:last-child td { border-bottom: 1px solid #d0d7de; }
    table.folio-table td, table.folio-table th { border: 1px solid #e6e8eb; }`
        : ""
    }
    ${
      theme.pageBreakH1
        ? `@media print { article.folio-doc > h1:not(:first-child) { break-before: page; page-break-before: always; } }`
        : ""
    }
    ${
      theme.pageBreakH2
        ? `@media print { article.folio-doc > h2:not(:first-child) { break-before: page; page-break-before: always; } }`
        : ""
    }
    td.num, th.num { text-align: right; }
    td.folio-formula {
      font-feature-settings: "tnum";
      color: #57606a;
      cursor: default;
    }
    pre.folio-code {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 0.9em;
      background: #f6f8fa;
      border: 1px solid #e6e8eb;
      border-radius: 6px;
      padding: 12px 14px;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      margin: 0.9em 0;
    }
    pre.folio-code code {
      background: transparent;
      padding: 0;
      border-radius: 0;
    }
    figure.folio-diagram {
      margin: 0.9em 0;
      padding: 12px;
      border: 1px dashed #d0d7de;
      border-radius: 6px;
      background: #fafbfc;
    }
    figure.folio-diagram:focus {
      outline: 2px solid #1f3fbf;
      border-style: solid;
    }
    .folio-inspector {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 6px 8px;
      margin-bottom: 8px;
      border: 1px solid #e6e8eb;
      border-radius: 6px;
      background: #fafbfc;
      font-family: system-ui, sans-serif;
      font-size: 12px;
    }
    .folio-inspector select,
    .folio-inspector input {
      font: inherit;
      font-size: 12px;
      padding: 3px 6px;
      border: 1px solid #d0d7de;
      border-radius: 5px;
      background: #fff;
      color: #1f2328;
    }
    .folio-inspector .insp-expr {
      flex: 1;
      min-width: 80px;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
    }
    .folio-inspector .insp-unit {
      font-style: italic;
      width: 5em;
    }
    .folio-inspector .insp-source-text {
      flex: 1;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      resize: vertical;
      min-height: 3em;
      box-sizing: border-box;
    }
    .folio-inspector .insp-select,
    .folio-inspector .insp-filter,
    .folio-inspector .insp-caption {
      flex: 1;
      min-width: 60px;
    }
    .folio-inspector .insp-fx {
      font-style: italic;
      color: #57606a;
      flex: none;
    }
    .folio-inspector .insp-fx {
      font-style: italic;
      color: #57606a;
      flex: none;
    }
    .folio-inspector .insp-close {
      flex: none;
      margin-left: auto;
      border: none;
      background: transparent;
      font-size: 15px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 5px;
      cursor: pointer;
      color: #57606a;
    }
    .folio-inspector .insp-close:hover {
      background: #e6e8eb;
    }
    figure.folio-math {
      margin: 1.2em 0;
      overflow-x: auto;
      overflow-y: hidden;
    }
    figure.folio-math .math-holder .katex-display {
      margin: 0;
    }
    code {
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
      font-size: 0.9em;
      background: #f6f8fa;
      padding: 0.1em 0.3em;
      border-radius: 3px;
    }
    p { margin: 0.9em 0; }
    article.folio-doc[contenteditable="true"] { caret-color: #1f2328; }
    article.folio-doc[contenteditable="true"]:focus { outline: none; }
    p:empty::before, h1:empty::before, h2:empty::before {
      content: "…";
      color: #b0b8c1;
    }
    td[contenteditable]:hover { background: rgba(76, 110, 245, 0.05); }
    td[contenteditable]:focus {
      outline: none;
      background: rgba(76, 110, 245, 0.07);
      box-shadow: inset 0 0 0 1px rgba(76, 110, 245, 0.25);
    }
    th { user-select: none; }
    figure[data-chart-source] { user-select: none; }
    .folio-menu {
      position: absolute;
      z-index: 100;
      background: #fff;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
      padding: 4px;
      min-width: 160px;
      display: flex;
      flex-direction: column;
    }
    .folio-menu button {
      border: none;
      background: transparent;
      text-align: left;
      padding: 6px 12px;
      font: inherit;
      font-size: 14px;
      border-radius: 5px;
      cursor: pointer;
      color: #1f2328;
    }
    .folio-menu button:hover { background: #f3f4f6; }
    .chart-holder svg { width: 100%; height: auto; display: block; }
    @media print {
      article.folio-doc { max-width: none; }
      article.folio-doc h1,
      article.folio-doc h2,
      article.folio-doc h3 {
        break-after: avoid;
      }
      figure,
      table.folio-table,
      pre.folio-code {
        break-inside: avoid;
      }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `;
}
