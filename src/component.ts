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
  private lastCell: HTMLTableCellElement | null = null;
  private lastBlock: HTMLElement | null = null;

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
        const el = this.shadowRoot?.elementFromPoint(ev.clientX, ev.clientY);
        const block = el?.closest("[data-block-index]") as HTMLElement | null;
        if (block) this.lastBlock = block;
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
        // Diagrams are generated output, not editable prose.
        figure.contentEditable = "false";
        const holder = document.createElement("div");
        holder.className = "diagram-holder";
        holder.textContent = block.diagram.text;
        figure.appendChild(holder);
        this.drawDiagram(figure);
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
      if (cell && cell.contentEditable === "true") {
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

  private syncFromDom(): void {
    if (!this.doc) return;
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    if (!host) return;
    Array.from(host.children).forEach((el) => {
      const idx = Number((el as HTMLElement).dataset.blockIndex ?? -1);
      const blocks = this.doc?.blocks;
      if (!blocks) return;
      const block = blocks[idx];
      if (
        !block ||
        block.kind === "table" ||
        block.kind === "chart" ||
        block.kind === "diagram"
      ) {
        return;
      }
      if (block.kind === "code") {
        // innerText keeps rendered line breaks (<br>, wrapped lines
        // only where the DOM actually breaks them).
        block.text = (el as HTMLElement).innerText;
        return;
      }
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
    this.updateRowCalculations(td.closest("figure"), block, r);
    this.emitChange();
  }

  /** Refresh the row's formula cells and dependent charts in place. */
  private updateRowCalculations(
    figure: HTMLElement | null,
    block: Extract<Doc["blocks"][number], { kind: "table" }>,
    r: number,
  ): void {
    const recalced = recalcTable(block.table);
    block.table.columns.forEach((col, c) => {
      if (col.type !== "formula") return;
      const cell = figure?.querySelector(
        `td[data-row-index="${String(r)}"][data-col-index="${String(c)}"]`,
      );
      if (!cell) return;
      const v = recalced.rows[r]?.[c];
      cell.textContent =
        col.format === "percent" && typeof v === "number"
          ? `${(v * 100).toFixed(1)}%`
          : String(v ?? "");
      cell.classList.toggle("num", typeof v === "number");
    });
    const host = this.shadowRoot?.querySelector("article.folio-doc");
    const chartFigures = Array.from(
      host?.querySelectorAll<HTMLElement>("[data-chart-source]") ?? [],
    );
    for (const cf of chartFigures) {
      this.drawChart(cf);
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
      if (td) return td;
    }
    const root = this.shadowRoot as
      | (ShadowRoot & {
          getSelection?: () => Selection | null;
        })
      | null;
    const sel = root?.getSelection?.();
    let n: Node | null = sel?.anchorNode ?? null;
    while (n !== null && !(n instanceof HTMLTableCellElement)) {
      n = n.parentNode;
    }
    if (n instanceof HTMLTableCellElement && n.dataset.rowIndex !== undefined) {
      return n;
    }
    if (
      this.lastCell !== null &&
      this.shadowRoot?.contains(this.lastCell) === true &&
      this.shadowRoot?.activeElement !== null
    ) {
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
    ev.preventDefault();
    if (block.kind === "prose") {
      const host = this.shadowRoot?.querySelector("article.folio-doc");
      const blockEl = (host?.children[idx] ?? null) as HTMLElement | null;
      const caret = blockEl ? this.caretOffsetIn(blockEl) : 0;
      const text = block.text;
      if (blockEl && caret < text.length) {
        const before = htmlToInlineMarkdown(blockEl.innerHTML).slice(0, caret);
        const after = htmlToInlineMarkdown(blockEl.innerHTML).slice(caret);
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
