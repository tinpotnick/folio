/**
 * <folio-doc>: the embeddable document component (ADR-0006).
 * One contenteditable surface for the whole document (seamless
 * WYSIWYG); the model is synced from the DOM, never the reverse
 * during typing. Full re-render happens only on structural ops.
 * Row/column operations live in a context menu, not on the page.
 */
import {
  parseDoc,
  serializeDoc,
  type Doc,
  type DocBlock,
} from "@folio/engine/doc";
import { outlineOf, type OutlineEntry } from "@folio/engine/outline";
import { recalcTable, type TablePool } from "@folio/engine/recalc";
import type { Table } from "@folio/engine/index.js";
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
  private lastCell: HTMLTableCellElement | null = null;
  private lastBlock: HTMLElement | null = null;
  /**
   * The last mouse-drag text selection, built from the two caret
   * points (document.caretRangeFromPoint pierces the shadow tree
   * in every engine). WebKitGTK exposes no selection API that
   * pierces the shadow root, so without this the inline format
   * buttons could not resolve any selection there at all.
   */
  private dragRange: Range | null = null;
  private dragStart: { x: number; y: number } | null = null;

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
    host.addEventListener(
      "mousedown",
      (ev: MouseEvent) => {
        this.dragStart = { x: ev.clientX, y: ev.clientY };
        const el = this.shadowRoot?.elementFromPoint(ev.clientX, ev.clientY);
        const block = el?.closest("[data-block-index]") as HTMLElement | null;
        if (block) this.lastBlock = block;
        // Clicking away from a table closes its inspector: the
        // bar belongs to the table being worked on.
        const hitFigure = el?.closest(
          "figure[data-table-id]",
        ) as HTMLElement | null;
        for (const bar of Array.from(
          this.shadowRoot?.querySelectorAll<HTMLElement>(
            ".folio-inspector:not([hidden])",
          ) ?? [],
        )) {
          if (bar.closest("figure") !== hitFigure) bar.hidden = true;
        }
      },
      true,
    );
    host.addEventListener(
      "mouseup",
      (ev: MouseEvent) => {
        const start = this.dragStart;
        this.dragStart = null;
        if (!start) return;
        if (ev.detail >= 2) {
          // Double/triple click: the browser selected a word (or
          // line) natively; no drag ran, so mirror the word.
          this.dragRange = this.wordRangeAt(ev.clientX, ev.clientY);
          return;
        }
        this.dragRange = this.rangeBetweenPoints(
          start.x,
          start.y,
          ev.clientX,
          ev.clientY,
        );
      },
      true,
    );
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
      case "code": {
        const pre = document.createElement("pre");
        pre.className = "folio-code";
        pre.dataset.blockIndex = String(idx);
        if (block.lang !== undefined) pre.dataset.lang = block.lang;
        const code = document.createElement("code");
        code.textContent = block.text;
        pre.appendChild(code);
        return pre;
      }
      case "table": {
        return this.renderTable(block, idx);
      }
      case "diagram": {
        const figure = document.createElement("figure");
        figure.className = "folio-diagram";
        figure.dataset.blockIndex = String(idx);
        figure.dataset.diagramId = block.diagram.id;
        // Diagrams are generated output, not editable prose, but
        // they are selectable (tabindex) so Backspace/Delete on a
        // selected diagram removes the block.
        figure.contentEditable = "false";
        figure.tabIndex = -1;
        figure.title = "Diagram - Backspace or Delete removes it";
        const holder = document.createElement("div");
        holder.className = "diagram-holder";
        holder.textContent = block.diagram.text;
        figure.appendChild(holder);
        this.drawDiagram(figure);
        return figure;
      }
      case "math": {
        const figure = document.createElement("figure");
        figure.className = "folio-math";
        figure.dataset.blockIndex = String(idx);
        figure.contentEditable = "false";
        const holder = document.createElement("div");
        holder.className = "math-holder";
        figure.appendChild(holder);
        void this.drawMath(figure);
        return figure;
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

  /**
   * The document's tables by id, for cross-table formula
   * references (budget.r3.q2): a table's formulas may read any
   * other table of the same document.
   */
  private tablePool(): TablePool {
    const blocks = this.doc?.blocks ?? [];
    return (id: string): Table | undefined => {
      for (const b of blocks) {
        if (b.kind === "table" && b.table.id === id) return b.table;
      }
      return undefined;
    };
  }

  private renderTable(
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    idx: number,
  ): HTMLElement {
    const recalced = recalcTable(block.table, this.tablePool());
    const figure = document.createElement("figure");
    figure.dataset.blockIndex = String(idx);
    figure.dataset.tableId = block.table.id;
    const inspector = this.buildInspector(figure, block);
    figure.appendChild(inspector);
    const table = document.createElement("table");
    table.className = "folio-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    block.table.columns.forEach((col, ci) => {
      const th = document.createElement("th");
      th.dataset.colIndex = String(ci);
      th.appendChild(document.createTextNode(col.name));
      if (col.unit !== undefined) {
        th.title = col.unit;
        // Units are data, not decoration: the reader should see
        // "q2 (£k)" without hovering anything.
        const unit = document.createElement("span");
        unit.className = "unit";
        unit.textContent = ` (${col.unit})`;
        th.appendChild(unit);
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
          // Nested editable, focusable leaf: the cell (not the
          // article) holds focus while it is edited, so blur-based
          // commits and Tab/Enter navigation are real. Without
          // tabindex the browser keeps focus on the article, cell
          // edits never commit, and Tab escapes to the host page
          // toolbar.
          td.contentEditable = "true";
          td.tabIndex = -1;
        }
        td.addEventListener("blur", this.handleCellBlur, true);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    // Browsers hand click focus to the article (the outer editing
    // host), so cell commits and Tab/Enter navigation would never see
    // a focused cell. Focus the clicked data cell ourselves: record
    // on mousedown, focus on mouseup, and restore the caret at the
    // click position (unless the mouse was dragged, which means the
    // user was selecting text - leave the selection alone).
    table.addEventListener("focusin", (ev) => {
      const cell = (ev.target as HTMLElement).closest(
        "td[data-row-index]",
      ) as HTMLTableCellElement | null;
      if (cell) this.lastCell = cell;
    });
    let cellClick: {
      cell: HTMLTableCellElement;
      x: number;
      y: number;
    } | null = null;
    table.addEventListener("mousedown", (ev) => {
      const cell = (ev.target as HTMLElement).closest(
        "td[data-row-index]",
      ) as HTMLTableCellElement | null;
      if (!cell) return;
      // Any cell click focuses its column in the inspector bar -
      // formula cells especially: they are read-only in the table
      // but their expression is the bar's whole point.
      this.showInspector(figure, block, Number(cell.dataset.colIndex));
      if (cell.contentEditable === "true") {
        cellClick = { cell, x: ev.clientX, y: ev.clientY };
      }
    });
    table.addEventListener("mouseup", (ev) => {
      const pending = cellClick;
      cellClick = null;
      if (!pending) return;
      const dragged =
        Math.hypot(ev.clientX - pending.x, ev.clientY - pending.y) > 3;
      pending.cell.focus();
      if (!dragged) {
        const range = document.caretRangeFromPoint(pending.x, pending.y);
        if (range && pending.cell.contains(range.startContainer)) {
          const sel = window.getSelection();
          sel?.setBaseAndExtent(
            range.startContainer,
            range.startOffset,
            range.startContainer,
            range.startOffset,
          );
        }
      }
    });
    figure.appendChild(table);
    if (block.table.caption) {
      const cap = document.createElement("figcaption");
      cap.textContent = block.table.caption;
      figure.appendChild(cap);
    }
    return figure;
  }

  /**
   * The table inspector (spec: docs/specs/table-inspector.md):
   * an Excel-style bar at the top of a table figure. Clicking a
   * cell shows the clicked column's properties - type, unit,
   * format, and for formula columns the expression (the ƒx field
   * Excel users look for) - all editable in place. Edits write to
   * the model and re-render the table; the document stays the
   * source of truth exactly as if the YAML was edited by hand.
   */
  private buildInspector(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "folio-inspector";
    // A real editable region inside the contenteditable article
    // would swallow keystrokes; inputs here must own them.
    bar.contentEditable = "false";
    bar.hidden = true;

    const colSel = document.createElement("select");
    colSel.className = "insp-col";
    colSel.addEventListener("change", () => {
      this.showInspector(figure, block, Math.max(colSel.selectedIndex, 0));
    });

    const typeSel = document.createElement("select");
    typeSel.className = "insp-type";
    typeSel.title = "Column type";
    for (const t of ["text", "number", "formula"]) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    }
    typeSel.addEventListener("change", () => {
      const type = typeSel.value as "text" | "number" | "formula";
      const c = Math.max(colSel.selectedIndex, 0);
      const patch: Record<string, unknown> = { type };
      // A formula column with an empty expression breaks recalc;
      // a fresh formula starts at a constant 0.
      if (type === "formula" && !block.table.columns[c]?.expr) {
        patch.expr = "0";
      }
      this.patchColumn(figure, block, c, patch);
    });

    const unitInp = document.createElement("input");
    unitInp.className = "insp-unit";
    unitInp.type = "text";
    unitInp.placeholder = "unit";
    unitInp.title = "Unit, shown in the column header";
    const unitPatch = (): void => {
      const c = Math.max(colSel.selectedIndex, 0);
      const v = unitInp.value.trim();
      this.patchColumn(figure, block, c, v ? { unit: v } : { unit: undefined });
    };
    unitInp.addEventListener("change", unitPatch);
    unitInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        unitPatch();
      }
    });

    const fmtSel = document.createElement("select");
    fmtSel.className = "insp-format";
    fmtSel.title = "Value format";
    const fmtNone = document.createElement("option");
    fmtNone.value = "default";
    fmtNone.textContent = "plain";
    fmtSel.appendChild(fmtNone);
    const fmtPct = document.createElement("option");
    fmtPct.value = "percent";
    fmtPct.textContent = "percent";
    fmtSel.appendChild(fmtPct);
    fmtSel.addEventListener("change", () => {
      const c = Math.max(colSel.selectedIndex, 0);
      this.patchColumn(figure, block, c, {
        format: fmtSel.value === "percent" ? "percent" : undefined,
      });
    });

    const fx = document.createElement("span");
    fx.className = "insp-fx";
    fx.textContent = "ƒx";

    const exprInp = document.createElement("input");
    exprInp.className = "insp-expr";
    exprInp.type = "text";
    exprInp.placeholder = "formula (Jexl)";
    const exprPatch = (): void => {
      const c = Math.max(colSel.selectedIndex, 0);
      const v = exprInp.value.trim();
      this.patchColumn(figure, block, c, { expr: v === "" ? "0" : v });
    };
    exprInp.addEventListener("change", exprPatch);
    exprInp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        exprPatch();
      }
    });

    bar.append(colSel, typeSel, unitInp, fmtSel, fx, exprInp);
    return bar;
  }

  /** Populate and reveal the inspector for one column. */
  private showInspector(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    c: number,
  ): void {
    const bar = figure.querySelector<HTMLElement>(".folio-inspector");
    const col = block.table.columns[c];
    if (!bar || !col) return;
    const colSel = bar.querySelector<HTMLSelectElement>(".insp-col");
    if (colSel) {
      colSel.textContent = "";
      block.table.columns.forEach((cc, i) => {
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = cc.name;
        colSel.appendChild(o);
      });
      colSel.selectedIndex = c;
    }
    const typeSel = bar.querySelector<HTMLSelectElement>(".insp-type");
    if (typeSel) typeSel.value = col.type;
    const unitInp = bar.querySelector<HTMLInputElement>(".insp-unit");
    if (unitInp) unitInp.value = col.unit ?? "";
    const fmtSel = bar.querySelector<HTMLSelectElement>(".insp-format");
    if (fmtSel) fmtSel.value = col.format === "percent" ? "percent" : "default";
    const exprInp = bar.querySelector<HTMLInputElement>(".insp-expr");
    if (exprInp) {
      exprInp.value = col.expr ?? "";
      exprInp.disabled = col.type !== "formula";
      exprInp.hidden = col.type !== "formula";
    }
    const fx = bar.querySelector<HTMLElement>(".insp-fx");
    if (fx) fx.hidden = col.type !== "formula";
    bar.hidden = false;
  }

  /** Apply a column patch: model write, table re-render, re-show. */
  private patchColumn(
    figure: HTMLElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    c: number,
    patch: {
      type?: "text" | "number" | "formula";
      unit?: string | undefined;
      format?: "percent" | undefined;
      expr?: string;
    },
  ): void {
    const col = block.table.columns[c];
    if (!col) return;
    // An undefined value removes the key so the default applies.
    if ("type" in patch) col.type = patch.type ?? col.type;
    if ("unit" in patch) {
      if (patch.unit) col.unit = patch.unit;
      else delete col.unit;
    }
    if ("format" in patch) {
      if (patch.format) col.format = patch.format;
      else delete col.format;
    }
    if ("expr" in patch) col.expr = patch.expr;
    const host = figure.parentElement;
    this.refreshTableBlock(figure, block);
    if (host) {
      const fresh = host.querySelector(
        `figure[data-table-id="${block.table.id}"]`,
      ) as HTMLElement | null;
      if (fresh) this.showInspector(fresh, block, c);
    }
    this.emitChange();
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
      const recalced = recalcTable(tableBlock.table, this.tablePool());
      const result = executeQuery(recalced, block.chart);
      holder.innerHTML = renderBarChart(result).svg;
    } catch (e) {
      holder.textContent = `Chart error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  /**
   * Render a diagram block with Mermaid (ADR-0010). The library is
   * loaded lazily via dynamic import so documents without diagrams
   * never pay for it; it is bundled, so rendering is offline.
   */
  private async drawDiagram(figure: HTMLElement): Promise<void> {
    if (!this.doc) return;
    const id = figure.dataset.diagramId;
    const block = this.doc.blocks.find(
      (b) => b.kind === "diagram" && b.diagram.id === id,
    );
    const holder = figure.querySelector<HTMLElement>(".diagram-holder");
    if (!block || block.kind !== "diagram" || !holder) return;
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ securityLevel: "strict", startOnLoad: false });
      const { svg } = await mermaid.render(
        `folio-diagram-${id}`,
        block.diagram.text,
      );
      if (figure.isConnected) holder.innerHTML = svg;
    } catch (e) {
      if (figure.isConnected) {
        holder.textContent = `Diagram error: ${
          e instanceof Error ? e.message : String(e)
        }`;
      }
    }
  }

  /**
   * Render a math block with KaTeX (ADR-0011). Loaded lazily like
   * mermaid so documents without math never pay for it; bundled, so
   * rendering stays offline. The KaTeX stylesheet is injected into
   * this shadow root (scoped trees cannot see page CSS) on first
   * use. throwOnError: false renders bad LaTeX as visible inline
   * error text, matching the diagram error contract.
   */
  private async drawMath(figure: HTMLElement): Promise<void> {
    const idx = Number(figure.dataset.blockIndex ?? -1);
    const block = this.doc?.blocks[idx];
    const holder = figure.querySelector<HTMLElement>(".math-holder");
    if (!block || block.kind !== "math" || !holder) return;
    try {
      const [katexMod, cssMod] = await Promise.all([
        import("katex"),
        import("katex/dist/katex.min.css?inline"),
      ]);
      const root = this.shadowRoot;
      if (root && root.querySelector("style#folio-katex") === null) {
        const style = document.createElement("style");
        style.id = "folio-katex";
        style.textContent = (cssMod as unknown as { default: string }).default;
        root.appendChild(style);
      }
      const html = katexMod.default.renderToString(block.text, {
        displayMode: true,
        throwOnError: false,
      });
      if (figure.isConnected) holder.innerHTML = html;
    } catch (e) {
      if (figure.isConnected) {
        holder.textContent = `Math error: ${
          e instanceof Error ? e.message : String(e)
        }`;
      }
    }
  }

  /**
   * Rebuild the block list from the article's children. Text blocks
   * (prose, headings, code) are re-derived wholesale - the DOM is
   * the source of truth during typing, including native structural
   * edits (Enter splits, Backspace merges). Generated blocks
   * (tables, charts, diagrams) carry their structured data in the
   * model only, so they are preserved by figure identity, in
   * document order.
   */
  private syncFromDom(): void {
    if (!this.doc) return;
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return;
    const generated = this.doc.blocks.filter(
      (b) =>
        b.kind === "table" ||
        b.kind === "chart" ||
        b.kind === "diagram" ||
        b.kind === "math",
    );
    let gi = 0;
    const next: DocBlock[] = [];
    for (const child of Array.from(host.children)) {
      const el = child as HTMLElement;
      if (el.tagName === "FIGURE") {
        const g = generated[gi];
        gi += 1;
        if (g) next.push(g);
        continue;
      }
      const headingMatch = /^H([1-6])$/.exec(el.tagName);
      if (headingMatch) {
        next.push({
          kind: "heading",
          level: Number(headingMatch[1]),
          text: el.textContent ?? "",
        });
        continue;
      }
      if (el.tagName === "PRE" && el.querySelector("code") !== null) {
        next.push({
          kind: "code",
          ...(el.dataset.lang !== undefined ? { lang: el.dataset.lang } : {}),
          text: el.innerText,
        });
        continue;
      }
      const md = htmlToInlineMarkdown(el.innerHTML).replace(/\n+$/, "");
      next.push({ kind: "prose", text: md });
    }
    // Native structural edits (Enter splits) create elements without
    // a block index; re-stamp positionally so index-based lookups
    // (setBlockKind, toggleCodeBlock, caret tracking) keep working
    // between renders. Only when the child count matches the rebuilt
    // model - otherwise the DOM is not 1:1 and stamping would lie.
    if (next.length === host.children.length) {
      Array.from(host.children).forEach((child, i) => {
        (child as HTMLElement).dataset.blockIndex = String(i);
      });
    }
    this.doc.blocks = next;
  }

  private handleInput(ev?: Event): void {
    if (
      ev?.target instanceof Element &&
      ev.target.closest(".folio-inspector")
    ) {
      return;
    }
    this.syncFromDom();
    this.commitCaretCell();
    this.emitChange();
  }

  /**
   * Commit the cell the caret is in, if any. Typing steals focus
   * from the cell to the article after the first keystroke, so
   * blur-based commits alone left everything after the first
   * character dangling in the DOM. Committing per keystroke is
   * idempotent and keeps formulas and the Markdown source live.
   */
  private commitCaretCell(): void {
    if (!this.doc) return;
    const cell = this.resolveCell(null);
    if (!cell) return;
    const figure = cell.closest("figure");
    const idx = Number(figure?.dataset.blockIndex ?? -1);
    const block = this.doc.blocks[idx];
    if (!block || block.kind !== "table") return;
    this.commitCell(cell, block);
  }

  private handleCellBlur(ev: FocusEvent): void {
    const td = ev.target as HTMLTableCellElement;
    if (!td.dataset.rowIndex || !this.doc) return;
    const figure = td.closest("figure");
    const idx = Number(figure?.dataset.blockIndex ?? -1);
    const block = this.doc.blocks[idx];
    if (!block || block.kind !== "table") return;
    this.commitCell(td, block);
  }

  /**
   * Write the cell's text into the model. Idempotent, and surgical:
   * the edited cell is the live DOM, so committing must not re-render
   * the table (that would destroy the caret mid-typing). Only the
   * row's formula cells and the charts are refreshed in place.
   */
  private commitCell(
    td: HTMLTableCellElement,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    const r = Number(td.dataset.rowIndex);
    const c = Number(td.dataset.colIndex);
    const col = block.table.columns[c];
    if (!col || col.type === "formula") return;
    const text = (td.textContent ?? "").trim();
    const value: string | number = /^-?[0-9]+(\.[0-9]+)?$/.test(text)
      ? parseFloat(text)
      : text;
    const row = block.table.rows[r];
    if (!row) return;
    if (row[c] === value) return;
    row[c] = value;
    this.updateRowCalculations(td.closest("figure"), block);
    this.emitChange();
  }

  /** Refresh the row's formula cells and dependent charts in place. */
  private updateRowCalculations(
    figure: HTMLElement | null,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
  ): void {
    const recalced = recalcTable(block.table, this.tablePool());
    // Formulas may reference other rows (_prev, name:row), so an
    // edit ripples through every formula cell of the table, not
    // just the edited row. Text-only updates: no structural
    // re-render, the caret in the edited cell is untouched.
    block.table.columns.forEach((col, c) => {
      if (col.type !== "formula") return;
      for (let row = 0; row < block.table.rows.length; row++) {
        const cell = figure?.querySelector(
          `td[data-row-index="${String(row)}"][data-col-index="${String(c)}"]`,
        );
        if (!cell) continue;
        const v = recalced.rows[row]?.[c];
        cell.textContent =
          col.format === "percent" && typeof v === "number"
            ? `${(v * 100).toFixed(1)}%`
            : String(v ?? "");
        cell.classList.toggle("num", typeof v === "number");
      }
    });
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const chartFigures = Array.from(
      host?.querySelectorAll<HTMLElement>("[data-chart-source]") ?? [],
    );
    for (const cf of chartFigures) {
      this.drawChart(cf);
    }
    // Cross-table references ripple: another table's formulas may
    // read this one (budget.r3.q2), so their cells refresh too -
    // text-only updates in place, the edited caret untouched.
    for (const other of this.doc?.blocks ?? []) {
      if (other.kind !== "table" || other.table.id === block.table.id) {
        continue;
      }
      const otherFigure = host?.querySelector(
        `figure[data-table-id="${other.table.id}"]`,
      ) as HTMLElement | null;
      if (!otherFigure) continue;
      let recalcedOther;
      try {
        recalcedOther = recalcTable(other.table, this.tablePool());
      } catch {
        continue; // its own error renders on its next full render
      }
      other.table.columns.forEach((col, c) => {
        if (col.type !== "formula") return;
        for (let row = 0; row < other.table.rows.length; row++) {
          const cell = otherFigure.querySelector(
            `td[data-row-index="${String(row)}"][data-col-index="${String(c)}"]`,
          );
          if (!cell) continue;
          const v = recalcedOther.rows[row]?.[c];
          cell.textContent =
            col.format === "percent" && typeof v === "number"
              ? `${(v * 100).toFixed(1)}%`
              : String(v ?? "");
          cell.classList.toggle("num", typeof v === "number");
        }
      });
    }
  }

  /**
   * The cell a keyboard event applies to. Engines move focus to the
   * article when text is typed into a nested editable cell (the
   * caret stays in the cell), so the event target is often the
   * article: resolve in order - the event target, the caret (via the
   * shadow root's selection, Chromium), then the last focused cell
   * while focus is still inside this component (WebKitGTK has no
   * pierceable selection API at all).
   */
  private resolveCell(target: EventTarget | null): HTMLTableCellElement | null {
    if (target instanceof Element) {
      const td = target.closest(
        "td[data-row-index]",
      ) as HTMLTableCellElement | null;
      if (td) {
        this.lastCell = td;
        return td;
      }
    }
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    const sel = root?.getSelection?.();
    if (sel && sel.anchorNode !== null) {
      let n: Node | null = sel.anchorNode;
      while (n !== null && !(n instanceof HTMLTableCellElement)) {
        n = n.parentNode;
      }
      if (
        n instanceof HTMLTableCellElement &&
        n.dataset.rowIndex !== undefined
      ) {
        this.lastCell = n;
        return n;
      }
      // The caret is resolvable and NOT in a cell: it is
      // authoritative. A stale lastCell must not win here, or Enter
      // in a paragraph after using a table adds a table row instead
      // of splitting the paragraph.
      this.lastCell = null;
      return null;
    }
    // No pierceable selection (WebKitGTK typing in a cell steals
    // focus to the article): the last focused cell is the best
    // available context - but the most recent CLICK still wins:
    // it resolves through the shadow root's hit testing, which is
    // the one pierce available on WebKitGTK. Without this, Enter
    // in a paragraph after using a table grew the table (the
    // focused article kept the stale cell authoritative).
    if (
      this.lastCell !== null &&
      this.shadowRoot?.contains(this.lastCell) === true &&
      this.shadowRoot?.activeElement !== null
    ) {
      if (this.lastBlock !== null && !this.lastBlock.contains(this.lastCell)) {
        this.lastCell = null;
        return null;
      }
      return this.lastCell;
    }
    return null;
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

  /**
   * Convert the caret's block to a heading level or a paragraph
   * (the toolbar's H1/H2/P buttons in document view). execCommand
   * cannot act inside the shadow tree, so the conversion is
   * model-level.
   */
  setBlockKind(kind: "h1" | "h2" | "p"): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    if (idx < 0) return;
    const block = this.doc.blocks[idx];
    if (
      !block ||
      block.kind === "table" ||
      block.kind === "chart" ||
      block.kind === "diagram"
    ) {
      return;
    }
    const text = block.text;
    if (kind === "p") {
      if (block.kind === "prose") return;
      this.doc.blocks[idx] = { kind: "prose", text };
    } else {
      const level = kind === "h1" ? 1 : 2;
      if (block.kind === "heading" && block.level === level) return;
      this.doc.blocks[idx] = { kind: "heading", level, text };
    }
    this.render();
    this.emitChange();
    this.focusBlockStart(idx);
  }

  /**
   * Insert an empty Mermaid diagram block after the caret's block
   * (the toolbar's diagram button).
   */
  insertDiagram(): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    const at = idx >= 0 ? idx + 1 : this.doc.blocks.length;
    this.doc.blocks.splice(at, 0, {
      kind: "diagram",
      diagram: {
        id: `diagram-${Date.now().toString(36)}`,
        text: "graph TD\n  A --> B",
      },
    });
    this.render();
    this.emitChange();
  }

  /**
   * The caret position nearest a point inside one paragraph of
   * this component's tree, computed geometrically. Every
   * document-level caret API (caretRangeFromPoint,
   * caretPositionFromPoint, getComposedRanges) retargets to the
   * shadow host in WebKitGTK (verified against 2.54, the Tauri
   * engine), so the only pierce is the shadow root's own hit
   * testing - and even that resolves the block, not the offset.
   * The offset is found by walking the paragraph's text nodes and
   * measuring caret rects. The vertical term dominates: the right
   * line first, then the nearest horizontal position - real
   * users release drags a few pixels off the line.
   */
  private caretFromPointIn(
    p: HTMLElement,
    x: number,
    y: number,
  ): { node: Node; offset: number; dist: number } | null {
    let best: { node: Node; offset: number } | null = null;
    let bestDist = Infinity;
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node: Node | null = walker.nextNode();
    while (node !== null) {
      const len = node.textContent?.length ?? 0;
      for (let i = 0; i <= len; i++) {
        range.setStart(node, i);
        range.collapse(true);
        const rect = range.getClientRects()[0];
        if (rect) {
          const caretX = i === len ? rect.right : rect.left;
          const dx = Math.abs(caretX - x);
          const dy = Math.abs((rect.top + rect.bottom) / 2 - y);
          const dist = dy * 4 + dx;
          if (dist < bestDist) {
            bestDist = dist;
            best = { node, offset: i };
          }
        }
      }
      node = walker.nextNode();
    }
    return best ? { ...best, dist: bestDist } : null;
  }

  /**
   * The caret position nearest a point anywhere in the article's
   * prose, for engines where caretRangeFromPoint does not pierce
   * (WebKitGTK): the best geometric position across every prose
   * paragraph. Chromium's caretRangeFromPoint pierces and handles
   * pointer slop natively, so it is the fast path there.
   */
  private caretOverParagraphs(
    x: number,
    y: number,
  ): { node: Node; offset: number; p: HTMLElement } | null {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return null;
    const pierced = document.caretRangeFromPoint(x, y);
    if (pierced) {
      const n = pierced.startContainer;
      const p = (n instanceof Element ? n : (n.parentElement ?? null))?.closest(
        "p[data-block-index]",
      ) as HTMLElement | null;
      if (p) return { node: n, offset: pierced.startOffset, p };
    }
    let best: { node: Node; offset: number; p: HTMLElement } | null = null;
    let bestDist = Infinity;
    for (const p of Array.from(
      host.querySelectorAll<HTMLElement>("p[data-block-index]"),
    )) {
      const c = this.caretFromPointIn(p, x, y);
      if (c && c.dist < bestDist) {
        bestDist = c.dist;
        best = { node: c.node, offset: c.offset, p };
      }
    }
    return best;
  }

  /**
   * The text Range between two caret points, or null when the two
   * points do not describe a usable non-collapsed prose selection.
   * The endpoints may sit in different paragraphs, but only in
   * ADJACENT ones - a selection spanning a heading or a generated
   * block between the endpoints would wrap non-prose content.
   */
  private rangeBetweenPoints(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): Range | null {
    if (Math.hypot(x1 - x0, y1 - y0) <= 3) return null;
    const c0 = this.caretOverParagraphs(x0, y0);
    const c1 = this.caretOverParagraphs(x1, y1);
    if (!c0 || !c1) return null;
    const adjacent =
      c0.p === c1.p ||
      c0.p.nextElementSibling === c1.p ||
      c1.p.nextElementSibling === c0.p;
    if (!adjacent) return null;
    const range = document.createRange();
    const forward =
      c0.node === c1.node
        ? c0.offset <= c1.offset
        : (c0.node.compareDocumentPosition(c1.node) &
            Node.DOCUMENT_POSITION_FOLLOWING) !==
          0;
    const [start, end] = forward ? [c0, c1] : [c1, c0];
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    return range.collapsed ? null : range;
  }

  /**
   * The word around a point, mirroring the browser's double-click
   * word selection. A drag never runs for a double click, so
   * without this the fallback had nothing to format after the
   * most common selection gesture of all.
   */
  private wordRangeAt(x: number, y: number): Range | null {
    const c = this.caretOverParagraphs(x, y);
    if (!c || c.node.nodeType !== Node.TEXT_NODE) return null;
    const text = c.node.textContent ?? "";
    const isWord = (ch: string | undefined): boolean =>
      ch !== undefined && /[\w]/.test(ch);
    if (!isWord(text[c.offset]) && !isWord(text[c.offset - 1])) {
      return null;
    }
    let s = c.offset;
    let e = c.offset;
    while (s > 0 && isWord(text[s - 1])) s--;
    while (e < text.length && isWord(text[e])) e++;
    if (e <= s) return null;
    const range = document.createRange();
    range.setStart(c.node, s);
    range.setEnd(c.node, e);
    return range;
  }

  /**
   * The first text position inside the range, for the "what you
   * see is what you toggle" rule. A selection that begins exactly
   * at a format boundary (the caret before a <strong> and the
   * caret at its first text position are the same visual point)
   * must still toggle the format its first visible character
   * carries - starting the ancestor walk at the range's raw start
   * container would miss the element and wrap instead.
   */
  private firstPositionNodeInRange(range: Range): Node | null {
    const startNode = range.startContainer;
    const startLen = startNode.textContent?.length ?? 0;
    if (startNode.nodeType === Node.TEXT_NODE && range.startOffset < startLen) {
      return startNode;
    }
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
    );
    let n: Node | null = null;
    while ((n = walker.nextNode()) !== null) {
      if (n === startNode) {
        if (range.startOffset < (n.textContent?.length ?? 0)) return n;
        continue;
      }
      if (range.intersectsNode(n)) return n;
    }
    return null;
  }

  /**
   * Apply (or remove) an inline semantic format around the current
   * selection (the toolbar's inline format buttons in document
   * view). execCommand cannot act on a selection inside the shadow
   * tree, so this wraps the selection range with the semantic
   * element directly - or unwraps the matching ancestor when the
   * selection already carries the format. The selection resolves
   * in order: the shadow root's selection (Chromium), then the
   * last mouse-drag range (WebKitGTK, which exposes no pierceable
   * selection API - without the fallback every click reported
   * "Select some text first"). Returns false when there is nothing
   * usable to format.
   */
  applyInlineFormat(tag: "strong" | "em" | "del" | "ins"): boolean {
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    const sel = root?.getSelection?.();
    let range: Range;
    let anchorNode: Node | null;
    if (sel && sel.rangeCount > 0 && sel.anchorNode !== null) {
      range = sel.getRangeAt(0);
      anchorNode = sel.anchorNode;
    } else if (
      this.dragRange !== null &&
      this.dragRange.startContainer.isConnected
    ) {
      range = this.dragRange.cloneRange();
      anchorNode = range.startContainer;
    } else {
      return false;
    }
    const anchorEl =
      anchorNode instanceof Element
        ? anchorNode
        : (anchorNode?.parentElement ?? null);
    const block = anchorEl?.closest("[data-block-index]") as HTMLElement | null;
    if (!block || block.tagName !== "P" || !block.isConnected) return false;

    const synonyms: Record<string, string[]> = {
      strong: ["STRONG", "B"],
      em: ["EM", "I"],
      del: ["DEL", "S", "STRIKE"],
      ins: ["INS", "U"],
    };
    const tags = synonyms[tag] ?? [];
    let n: Node | null =
      this.firstPositionNodeInRange(range) ?? anchorNode ?? null;
    while (n && n !== block) {
      if (n instanceof Element && tags.includes(n.tagName)) {
        // Toggle off: unwrap the existing format element.
        n.replaceWith(...Array.from(n.childNodes));
        this.syncFromDom();
        this.emitChange();
        return true;
      }
      n = n.parentNode;
    }
    if (range.collapsed) return false;
    const wrap = document.createElement(tag);
    try {
      wrap.appendChild(range.extractContents());
      range.insertNode(wrap);
      if (sel) {
        const after = document.createRange();
        after.selectNodeContents(wrap);
        sel.removeAllRanges();
        sel.addRange(after);
      }
    } catch {
      return false;
    }
    this.syncFromDom();
    this.emitChange();
    return true;
  }

  /**
   * Toggle the caret's block between prose and a fenced code block
   * (the toolbar's code button in document view).
   */
  toggleCodeBlock(): void {
    if (!this.doc) return;
    const idx = this.blockIndexAtCaret();
    if (idx < 0) return;
    const block = this.doc.blocks[idx];
    if (!block) return;
    if (block.kind === "prose") {
      this.doc.blocks[idx] = { kind: "code", text: block.text };
      this.render();
      this.emitChange();
      this.focusBlockStart(idx);
    } else if (block.kind === "code") {
      this.doc.blocks[idx] = { kind: "prose", text: block.text };
      this.render();
      this.emitChange();
      this.focusBlockStart(idx);
    }
  }

  /** Re-rendering loses the caret; put it back at the block start. */
  private focusBlockStart(idx: number): void {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const el = (host?.children[idx] ?? null) as HTMLElement | null;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  /**
   * The block index at the caret: the shadow selection's anchor
   * (Chromium), or the last clicked block (tracked via shadow-root
   * hit testing, which pierces in every engine).
   */
  private blockIndexAtCaret(): number {
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    let n: Node | null = root?.getSelection?.()?.anchorNode ?? null;
    while (n !== null && !(n instanceof HTMLElement)) {
      n = n.parentNode;
    }
    let el: HTMLElement | null =
      n instanceof HTMLElement
        ? (n.closest("[data-block-index]") as HTMLElement | null)
        : null;
    if (el === null) el = this.lastBlock;
    return Number(el?.dataset.blockIndex ?? -1);
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
    if (!this.doc) return;
    // The inspector's inputs own their keystrokes.
    if (ev.target instanceof Element && ev.target.closest(".folio-inspector")) {
      return;
    }
    const diagram =
      ev.target instanceof Element
        ? (ev.target.closest("figure.folio-diagram") as HTMLElement | null)
        : null;
    if (
      diagram &&
      (ev.key === "Backspace" || ev.key === "Delete") &&
      this.doc
    ) {
      ev.preventDefault();
      const idx = Number(diagram.dataset.blockIndex ?? -1);
      if (idx >= 0) {
        this.doc.blocks.splice(idx, 1);
        this.render();
        this.emitChange();
      }
      return;
    }
    const cell = this.resolveCell(ev.target);
    if (cell) {
      // Ctrl/Cmd+A with the caret in a cell selects the CELL, not the
      // whole article: the article is the browser's editing host, and
      // a document-wide select-all from a cell risks replacing the
      // entire document with the next keystroke.
      if (ev.key.toLowerCase() === "a" && (ev.ctrlKey || ev.metaKey)) {
        // Select the cell via the shadow root's selection only: the
        // document-level selection cannot write ranges inside the
        // shadow tree, and on WebKitGTK doing so corrupts the caret
        // and sends typed text into the light DOM. Where no shadow
        // selection exists, select-all stays inert rather than
        // destructive.
        ev.preventDefault();
        const root = this.shadowRoot as
          | (ShadowRoot & {
              getSelection?: () => Selection | null;
            })
          | null;
        const sel = root?.getSelection?.();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(cell);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
      this.handleTableNav(ev, cell);
      return;
    }
    if (ev.key !== "Enter") return;
    let idx = -1;
    if (ev.target instanceof Element) {
      const el = ev.target.closest("[data-block-index]") as HTMLElement | null;
      idx = Number(el?.dataset.blockIndex ?? -1);
    }
    // Engines put keydown focus on the article; resolve the block
    // from the caret (or the last clicked block) instead.
    if (idx < 0) idx = this.blockIndexAtCaret();
    if (idx < 0) return;
    const block = this.doc.blocks[idx];
    if (!block) return;
    if (block.kind === "table" || block.kind === "chart") return;
    if (block.kind === "math") {
      // Math blocks are generated output; never split into one.
      if (
        ev.target instanceof Element &&
        ev.target.closest("figure.folio-math")
      ) {
        ev.preventDefault();
      }
      return;
    }
    if (block.kind === "diagram") {
      // Never split into a selected diagram.
      if (
        ev.target instanceof Element &&
        ev.target.closest("figure.folio-diagram")
      ) {
        ev.preventDefault();
      }
      return;
    }
    if (block.kind === "code") {
      // A line break inside the code block, not a block split.
      // syncFromDom reads code blocks via innerText so the inserted
      // <br> becomes a real newline in the model.
      ev.preventDefault();
      document.execCommand("insertLineBreak");
      this.syncFromDom();
      this.emitChange();
      return;
    }
    // Prose and headings: let the engine handle Enter natively -
    // the caret lands on the new line in every engine, exactly like
    // a word processor - and the structural sync rebuilds the model
    // from the DOM on the input event. The old model-split +
    // re-render path destroyed the caret, which is why typing
    // after Enter needed a click first.
  }

  /**
   * Keyboard navigation inside tables (spec: docs/specs/
   * table-keyboard.md): Tab/Shift+Tab move across editable cells
   * (formula columns are skipped), Enter moves down a row; both grow
   * the table when moving past the last row. Commits the current
   * cell (and recalculates formulas) before moving.
   */
  private handleTableNav(ev: KeyboardEvent, td: HTMLTableCellElement): void {
    if (ev.key !== "Tab" && ev.key !== "Enter") return;
    const figure = td.closest("figure") as HTMLElement | null;
    if (!figure) return;
    const idx = Number(figure.dataset.blockIndex ?? -1);
    const block = this.doc?.blocks[idx];
    if (!block || block.kind !== "table") return;
    const cols = block.table.columns;
    const editable = cols
      .map((c, i) => (c.type !== "formula" ? i : -1))
      .filter((i) => i >= 0);
    if (editable.length === 0) return;
    ev.preventDefault();
    this.commitCell(td, block);
    let r = Number(td.dataset.rowIndex);
    let c = Number(td.dataset.colIndex);
    let needsRender = false;
    if (ev.key === "Enter") {
      if (ev.shiftKey) {
        r = Math.max(0, r - 1);
      } else {
        r += 1;
        if (r >= block.table.rows.length) {
          block.table.rows.push(cols.map(() => ""));
          needsRender = true;
        }
      }
    } else if (ev.shiftKey) {
      const prev = editable.filter((i) => i < c);
      if (prev.length > 0) {
        c = prev[prev.length - 1] ?? 0;
      } else {
        const prevRow = r - 1;
        if (prevRow < 0) return; // leave focus movement to the browser
        r = prevRow;
        c = editable[editable.length - 1] ?? 0;
      }
    } else {
      const next = editable.filter((i) => i > c);
      if (next.length > 0) {
        c = next[0] ?? 0;
      } else {
        const nextRow = r + 1;
        if (nextRow >= block.table.rows.length) {
          block.table.rows.push(cols.map(() => ""));
          needsRender = true;
        }
        r = nextRow;
        c = editable[0] ?? 0;
      }
    }
    if (needsRender) {
      const host = figure.parentElement;
      this.refreshTableBlock(
        (host?.querySelector(
          `figure[data-block-index="${String(idx)}"]`,
        ) as HTMLElement | null) ?? null,
        block,
      );
      this.emitChange();
    }
    if (!this.caretFollowsFocus()) {
      // WebKitGTK: JavaScript cannot move the caret into a cell - no
      // selection API pierces the shadow root and focus does not
      // carry the caret. Tab/Enter commit the cell (recalculating
      // formulas, growing the table at the edges) and keep the caret
      // in place; the user clicks the next cell. Moving focus without
      // the caret would send typed text into the wrong cell or
      // nowhere at all.
      return;
    }
    this.focusCell(idx, r, c);
  }

  /**
   * Whether focusing a cell also moves the caret into it (so typing
   * after Tab/Enter lands in the focused cell). True in Chromium;
   * false in WebKitGTK.
   */
  private caretFollowsFocus(): boolean {
    return (
      typeof (
        ShadowRoot.prototype as unknown as {
          getSelection?: unknown;
        }
      ).getSelection === "function"
    );
  }

  private focusCell(idx: number, r: number, c: number): void {
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const figure = host?.children[idx] as HTMLElement | undefined;
    const cell = figure?.querySelector(
      `td[data-row-index="${String(r)}"][data-col-index="${String(c)}"]`,
    ) as HTMLTableCellElement | null;
    cell?.focus();
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
