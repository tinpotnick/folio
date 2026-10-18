/**
 * <folio-doc>: the embeddable document component (ADR-0006).
 * One contenteditable surface for the whole document (seamless
 * WYSIWYG); the model is synced from the DOM, never the reverse
 * during typing. Full re-render happens only on structural ops.
 * Row/column operations live in a context menu, not on the page.
 */
import { parseDoc, serializeDoc, type Doc } from "@folio/engine/doc";
import { outlineOf, type OutlineEntry } from "@folio/engine/outline";
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
  private menu: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleCellBlur = this.handleCellBlur.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
  }

  connectedCallback(): void {
    this.load(this.getAttribute("src") ?? "");
  }

  attributeChangedCallback(name: string, old: string, value: string): void {
    if (name === "src" && old !== value && this.shadowRoot?.childNodes.length) {
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

  getOutline(): OutlineEntry[] {
    return this.doc ? outlineOf(this.doc) : [];
  }

  revealBlock(blockIndex: number): void {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const el = host?.children[blockIndex] as HTMLElement | undefined;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }

  firstVisibleBlockIndex(): number {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return -1;
    const hostRect = this.getBoundingClientRect();
    const top = hostRect.top;
    for (let i = 0; i < host.children.length; i++) {
      const el = host.children[i] as HTMLElement;
      const r = el.getBoundingClientRect();
      if (r.bottom > top + 8) return i;
    }
    return host.children.length - 1;
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
    const root = this.shadowRoot;
    root.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = themeCss(theme);
    root.appendChild(style);

    const host = document.createElement("article");
    host.className = "folio-doc";
    host.setAttribute("contenteditable", "true");
    host.spellcheck = true;
    host.addEventListener("keydown", this.handleKeydown);
    host.addEventListener("input", this.handleInput);
    host.addEventListener("contextmenu", this.handleContextMenu);

    this.doc.blocks.forEach((block, idx) => {
      host.appendChild(this.renderBlock(block, idx));
    });
    root.appendChild(host);
  }

  private renderBlock(block: Doc["blocks"][number], idx: number): HTMLElement {
    switch (block.kind) {
      case "heading": {
        const el = document.createElement(
          `h${String(Math.min(block.level, 6))}`,
        );
        el.dataset.blockIndex = String(idx);
        el.textContent = block.text;
        return el;
      }
      case "prose": {
        const el = document.createElement("p");
        el.dataset.blockIndex = String(idx);
        el.innerHTML = inlineMarkdownToHtml(block.text);
        return el;
      }
      case "table": {
        return this.renderTable(block, idx);
      }
      case "chart": {
        const figure = document.createElement("figure");
        figure.dataset.blockIndex = String(idx);
        figure.dataset.chartSource = block.chart.source;
        const holder = document.createElement("div");
        holder.className = "chart-holder";
        figure.appendChild(holder);
        if (block.chart.caption) {
          const cap = document.createElement("figcaption");
          cap.textContent = block.chart.caption;
          figure.appendChild(cap);
        }
        this.drawChart(figure);
        return figure;
      }
      default: {
        const el = document.createElement("p");
        el.dataset.blockIndex = String(idx);
        return el;
      }
    }
  }

  private renderTable(
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    idx: number,
  ): HTMLElement {
    const recalced = recalcTable(block.table);
    const figure = document.createElement("figure");
    figure.dataset.blockIndex = String(idx);
    figure.dataset.tableId = block.table.id;
    const table = document.createElement("table");
    table.className = "folio-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    block.table.columns.forEach((col, ci) => {
      const th = document.createElement("th");
      th.dataset.colIndex = String(ci);
      th.textContent = col.name;
      if (col.unit !== undefined) {
        th.title = col.unit;
      }
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
      tr.dataset.rowIndex = String(r);
      block.table.columns.forEach((col, c) => {
        const td = document.createElement("td");
        td.dataset.rowIndex = String(r);
        td.dataset.colIndex = String(c);
        const v = row[c];
        if (col.type === "formula") {
          td.classList.add("folio-formula");
          td.contentEditable = "false";
          td.textContent =
            col.format === "percent" && typeof v === "number"
              ? `${(v * 100).toFixed(1)}%`
              : String(v ?? "");
          if (typeof v === "number") td.classList.add("num");
        } else {
          if (col.type === "number") {
            td.classList.add("num");
          }
          td.textContent = String(v ?? "");
        }
        td.addEventListener("blur", this.handleCellBlur, true);
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

  private drawChart(figure: HTMLElement): void {
    if (!this.doc) return;
    const source = figure.dataset.chartSource;
    const block = this.doc.blocks.find(
      (b) => b.kind === "chart" && b.chart.source === source,
    );
    if (!block || block.kind !== "chart") return;
    const holder = figure.querySelector<HTMLElement>(".chart-holder");
    if (!holder) return;
    try {
      const tableBlock = this.doc.blocks.find(
        (b) => b.kind === "table" && b.table.id === block.chart.source,
      );
      if (!tableBlock || tableBlock.kind !== "table") {
        throw new Error(`chart source table '${block.chart.source}' not found`);
      }
      const recalced = recalcTable(tableBlock.table);
      const result = executeQuery(recalced, block.chart);
      holder.innerHTML = renderBarChart(result).svg;
    } catch (e) {
      holder.textContent = `Chart error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private syncFromDom(): void {
    if (!this.doc) return;
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return;
    Array.from(host.children).forEach((el) => {
      const idx = Number((el as HTMLElement).dataset.blockIndex ?? -1);
      const blocks = this.doc?.blocks;
      if (!blocks) return;
      const block = blocks[idx];
      if (!block || block.kind === "table" || block.kind === "chart") return;
      const tag = el.tagName;
      const headingMatch = /^H([1-6])$/.exec(tag);
      if (headingMatch) {
        const level = Number(headingMatch[1]);
        if (block.kind !== "heading" || block.level !== level) {
          blocks[idx] = {
            kind: "heading",
            level,
            text: el.textContent ?? "",
          };
        } else {
          block.text = el.textContent ?? "";
        }
      } else {
        const md = htmlToInlineMarkdown((el as HTMLElement).innerHTML);
        if (block.kind !== "prose") {
          blocks[idx] = { kind: "prose", text: md };
        } else {
          block.text = md;
        }
      }
    });
  }

  private handleInput(): void {
    this.syncFromDom();
    this.emitChange();
  }

  private handleCellBlur(ev: FocusEvent): void {
    const td = ev.target as HTMLTableCellElement;
    if (!td.dataset.rowIndex || !this.doc) return;
    const figure = td.closest("figure");
    const idx = Number(figure?.dataset.blockIndex ?? -1);
    const block = this.doc.blocks[idx];
    if (!block || block.kind !== "table") return;
    const r = Number(td.dataset.rowIndex);
    const c = Number(td.dataset.colIndex);
    const col = block.table.columns[c];
    if (!col || col.type === "formula") return;
    const text = (td.textContent ?? "").trim();
    const value: string | number = /^-?[0-9]+(\.[0-9]+)?$/.test(text)
      ? parseFloat(text)
      : text;
    const row = block.table.rows[r];
    if (row) row[c] = value;
    this.refreshTableBlock(figure, block);
    this.emitChange();
  }

  private refreshTableBlock(
    figure: HTMLElement | null,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    if (!figure || !this.doc || !this.shadowRoot) return;
    const host = figure.parentElement;
    if (!host) return;
    const idx = Number(figure.dataset.blockIndex ?? -1);
    const fresh = this.renderTable(block, idx);
    fresh.dataset.blockIndex = String(idx);
    host.replaceChild(fresh, figure);
    const chartFigures = Array.from(
      host.querySelectorAll<HTMLElement>("[data-chart-source]"),
    );
    for (const cf of chartFigures) this.drawChart(cf);
  }

  insertTable(): void {
    if (!this.doc) return;
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return;
    const sel = window.getSelection();
    let idx = this.doc.blocks.length;
    if (sel && sel.rangeCount > 0 && host.contains(sel.anchorNode)) {
      let node: Node | null = sel.anchorNode;
      while (node && node.parentNode !== host) {
        node = node.parentNode;
      }
      if (node instanceof HTMLElement && node.dataset.blockIndex) {
        idx = Number(node.dataset.blockIndex) + 1;
      }
    }
    this.doc.blocks.splice(idx, 0, {
      kind: "table",
      table: {
        id: `table-${String(Date.now().toString(36))}`,
        columns: [
          { name: "item", type: "text" },
          { name: "value", type: "number" },
        ],
        rows: [
          ["", ""],
          ["", ""],
        ],
      },
    });
    this.render();
    this.emitChange();
  }

  private handleKeydown(ev: KeyboardEvent): void {
    if (ev.key !== "Enter" || !this.doc) return;
    const el = (ev.target as HTMLElement).closest(
      "[data-block-index]",
    ) as HTMLElement | null;
    if (!el) return;
    const idx = Number(el.dataset.blockIndex ?? -1);
    const block = this.doc.blocks[idx];
    if (!block) return;
    if (block.kind === "table" || block.kind === "chart") return;
    ev.preventDefault();
    if (block.kind === "prose") {
      const caret = this.caretOffsetIn(el);
      const text = block.text;
      if (caret < text.length) {
        const before = htmlToInlineMarkdown(el.innerHTML).slice(0, caret);
        const after = htmlToInlineMarkdown(el.innerHTML).slice(caret);
        block.text = before;
        this.doc.blocks.splice(idx + 1, 0, { kind: "prose", text: after });
      } else {
        this.doc.blocks.splice(idx + 1, 0, { kind: "prose", text: "" });
      }
    } else {
      this.doc.blocks.splice(idx + 1, 0, { kind: "prose", text: "" });
    }
    this.render();
    this.emitChange();
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const next = host?.children[idx + 1] as HTMLElement | undefined;
    if (next) {
      next.focus();
      const range = document.createRange();
      range.selectNodeContents(next);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }

  private caretOffsetIn(el: HTMLElement): number {
    const sel = window.getSelection();
    if (sel === null || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0).cloneRange();
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  }

  private handleContextMenu(ev: MouseEvent): void {
    const cell = (ev.target as HTMLElement).closest(
      "td[data-row-index], th[data-col-index]",
    ) as HTMLElement | null;
    if (!cell || !this.doc) return;
    ev.preventDefault();
    const figure = cell.closest("figure") as HTMLElement | null;
    if (!figure) return;
    const idx = Number(figure.dataset.blockIndex ?? -1);
    const block = this.doc.blocks[idx];
    if (!block || block.kind !== "table") return;
    const tr = cell.closest("tr") as HTMLTableRowElement | null;
    const rowIndex = tr ? Number(tr.dataset.rowIndex ?? 0) : 0;
    const colIndex =
      cell.tagName === "TH"
        ? Number(cell.dataset.colIndex ?? 0)
        : Number(cell.dataset.colIndex ?? 0);
    this.showMenu(ev.clientX, ev.clientY, block, rowIndex, colIndex, figure);
  }

  private showMenu(
    x: number,
    y: number,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    r: number,
    c: number,
    figure: HTMLElement,
  ): void {
    this.closeMenu();
    const root = this.shadowRoot;
    if (!root) return;
    const menu = document.createElement("div");
    menu.className = "folio-menu";
    const items: [string, () => void][] = [
      [
        "Insert row below",
        () => {
          block.table.rows.splice(
            r + 1,
            0,
            block.table.columns.map(() => ""),
          );
        },
      ],
      [
        "Delete row",
        () => {
          block.table.rows.splice(r, 1);
        },
      ],
      [
        "Insert column right",
        () => {
          block.table.columns.splice(c + 1, 0, {
            name: "new",
            type: "text",
          });
          block.table.rows.forEach((row) => row.splice(c + 1, 0, ""));
        },
      ],
      [
        "Delete column",
        () => {
          const col = block.table.columns[c];
          if (col && col.type === "formula") return;
          block.table.columns.splice(c, 1);
          block.table.rows.forEach((row) => row.splice(c, 1));
        },
      ],
    ];
    for (const [label, action] of items) {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        action();
        this.closeMenu();
        this.refreshTableBlock(figure, block);
        this.emitChange();
      });
      menu.appendChild(btn);
    }
    const hostRect = this.getBoundingClientRect();
    menu.style.left = `${String(x - hostRect.left)}px`;
    menu.style.top = `${String(y - hostRect.top)}px`;
    const host = root.querySelector("article.folio-doc");
    if (host) host.appendChild(menu);
    this.menu = menu;
    setTimeout(() => {
      document.addEventListener("pointerdown", this.menuCloser, {
        once: true,
      });
    });
  }

  private menuCloser = (ev: Event): void => {
    if (ev.composedPath().includes(this.menu ?? ({} as HTMLElement))) return;
    this.closeMenu();
  };

  private closeMenu(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }
}

customElements.define("folio-doc", FolioDoc);

declare global {
  interface HTMLElementTagNameMap {
    "folio-doc": FolioDoc;
  }
}
