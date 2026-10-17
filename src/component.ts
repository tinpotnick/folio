/**
 * <folio-doc>: the embeddable document component (ADR-0006).
 * Shadow DOM encapsulation; programmatic API (load/getDoc/onChange);
 * renders the document-first view with live tables and charts.
 * Our apps are hosts of this component — third-party pages can be too.
 */
import { parseDoc, serializeDoc, type Doc } from "@folio/engine/doc";
import { recalcTable } from "@folio/engine/recalc";
import { executeQuery } from "@folio/engine/query";
import { themeFromDoc, themeCss } from "./render/theme.js";
import { renderBarChart } from "./render/chart.js";
import { inlineMarkdownToHtml, htmlToInlineMarkdown } from "./render/inline.js";

export class FolioDoc extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["src"];
  }

  private doc: Doc | null = null;
  private listeners: ((doc: Doc) => void)[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.handleCellEdit = this.handleCellEdit.bind(this);
  }

  connectedCallback(): void {
    this.load(this.getAttribute("src") ?? "");
  }

  attributeChangedCallback(_n: string, old: string, value: string): void {
    if (_n === "src" && old !== value && this.shadowRoot?.childNodes.length) {
      this.load(value);
    }
  }

  async load(src: string): Promise<void> {
    if (!src.trim()) {
      this.renderEmpty();
      return;
    }
    try {
      let text: string;
      if (src.includes("\n")) {
        text = src;
      } else {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
        text = await res.text();
      }
      this.doc = parseDoc(text);
      this.render();
    } catch (e) {
      this.renderError(e instanceof Error ? e.message : String(e));
    }
  }

  getDoc(): Doc | null {
    return this.doc;
  }

  getMarkdown(): string | null {
    return this.doc ? serializeDoc(this.doc) : null;
  }

  onChange(fn: (doc: Doc) => void): void {
    this.listeners.push(fn);
  }

  private emitChange(): void {
    if (!this.doc) return;
    for (const fn of this.listeners) fn(this.doc);
  }

  private renderEmpty(): void {
    const root = this.shadowRoot;
    if (root) {
      root.innerHTML =
        "<style>:host{display:block;font-family:system-ui;padding:1em;color:#57606a}</style><p>No document loaded — set the <code>src</code> attribute to a Markdown file path or inline document text.</p>";
    }
  }

  private renderError(message: string): void {
    const root = this.shadowRoot;
    if (root) {
      root.innerHTML =
        "<style>:host{display:block;font-family:system-ui;padding:1em;color:#862e2e}</style><p>Could not load document: " +
        message.replace(
          /[<>&]/g,
          (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c,
        ) +
        "</p>";
    }
  }

  private render(): void {
    if (!this.doc || !this.shadowRoot) return;
    const theme = themeFromDoc(this.doc);
    const host = document.createElement("article");
    host.className = "folio-doc";
    for (const block of this.doc.blocks) {
      host.appendChild(this.renderBlock(block));
    }
    this.shadowRoot.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = themeCss(theme);
    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(host);
  }

  private renderBlock(block: Doc["blocks"][number]): HTMLElement {
    switch (block.kind) {
      case "heading": {
        const el = document.createElement(
          `h${String(Math.min(block.level, 6))}`,
        );
        el.textContent = block.text;
        return el;
      }
      case "prose": {
        const el = document.createElement("p");
        el.innerHTML = inlineMarkdownToHtml(block.text);
        this.makeEditable(el, {
          kind: "prose",
          block,
          toMd: htmlToInlineMarkdown,
          fromMd: inlineMarkdownToHtml,
        });
        return el;
      }
      case "table": {
        const recalced = recalcTable(block.table);
        const figure = document.createElement("figure");
        const table = document.createElement("table");
        table.className = "folio-table";
        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        block.table.columns.forEach((col) => {
          const th = document.createElement("th");
          th.textContent =
            col.name + (col.unit !== undefined ? ` (${col.unit})` : "");
          if (col.type === "number" || col.type === "formula") {
            th.classList.add("num");
          }
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        recalced.rows.forEach((row, r) => {
          const tr = document.createElement("tr");
          block.table.columns.forEach((col, c) => {
            const td = document.createElement("td");
            if (col.type === "formula") {
              td.classList.add("folio-formula");
              const v = row[c];
              td.textContent =
                col.format === "percent" && typeof v === "number"
                  ? `${(v * 100).toFixed(1)}%`
                  : String(v ?? "");
              if (typeof v === "number") td.classList.add("num");
            } else if (col.type === "number") {
              const input = document.createElement("input");
              input.className = "folio-cell num";
              input.value = String(row[c] ?? "");
              input.dataset.row = String(r);
              input.dataset.col = String(c);
              input.addEventListener("change", this.handleCellEdit);
              td.appendChild(input);
            } else {
              const input = document.createElement("input");
              input.className = "folio-cell";
              input.value = String(row[c] ?? "");
              input.dataset.row = String(r);
              input.dataset.col = String(c);
              input.addEventListener("change", this.handleCellEdit);
              td.appendChild(input);
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        figure.appendChild(table);
        if (block.table.caption) {
          const cap = document.createElement("figcaption");
          cap.textContent = block.table.caption;
          figure.appendChild(cap);
        }
        return figure;
      }
      case "chart": {
        const figure = document.createElement("figure");
        const holder = document.createElement("div");
        holder.className = "chart-holder";
        try {
          const tableBlock = this.doc?.blocks.find(
            (b) => b.kind === "table" && b.table.id === block.chart.source,
          );
          if (!tableBlock || tableBlock.kind !== "table") {
            throw new Error(
              `chart source table '${block.chart.source}' not found`,
            );
          }
          const recalced = recalcTable(tableBlock.table);
          const result = executeQuery(recalced, block.chart);
          const { svg } = renderBarChart(result);
          holder.innerHTML = svg;
        } catch (e) {
          holder.textContent = `Chart error: ${e instanceof Error ? e.message : String(e)}`;
        }
        figure.appendChild(holder);
        if (block.chart.caption) {
          const cap = document.createElement("figcaption");
          cap.textContent = block.chart.caption;
          figure.appendChild(cap);
        }
        return figure;
      }
      default: {
        const el = document.createElement("p");
        el.textContent = "";
        return el;
      }
    }
  }

  private makeEditable(
    el: HTMLElement,
    binding: {
      kind: "heading" | "prose";
      block: Extract<Doc["blocks"][number], { kind: "heading" | "prose" }>;
      toMd: (html: string) => string;
      fromMd: (md: string) => string;
    },
  ): void {
    el.setAttribute("contenteditable", "true");
    el.addEventListener("input", () => {
      binding.block.text = binding.toMd(el.innerHTML);
      this.emitChange();
    });
    el.addEventListener("blur", () => {
      // Re-render from the model so canonical formatting returns.
      el.innerHTML = binding.fromMd(binding.block.text);
    });
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        (ev.target as HTMLElement).blur();
      }
    });
  }

  private handleCellEdit(ev: Event): void {
    if (!this.doc) return;
    const input = ev.target as HTMLInputElement;
    const r = Number(input.dataset.row);
    const c = Number(input.dataset.col);
    const newValue = input.value.trim();
    let cell: string | number;
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(newValue)) {
      cell = parseFloat(newValue);
    } else {
      cell = newValue;
    }
    outer: for (const block of this.doc.blocks) {
      if (block.kind !== "table") continue;
      const target = block.table.rows[r];
      if (target && target.length > c) {
        target[c] = cell;
        break outer;
      }
    }
    this.render();
    this.emitChange();
  }
}

customElements.define("folio-doc", FolioDoc);

declare global {
  interface HTMLElementTagNameMap {
    "folio-doc": FolioDoc;
  }
}
