/**
 * Document parse/serialize (ADR-0005, invariant #2: round-trip
 * identity). One deep module hides the entire textual format:
 * frontmatter, prose, headings, table and chart directive blocks.
 * serializeDoc(parseDoc(text)) === text for any canonical doc.
 */
import type { Audio, Cell, Chart, Image, Table } from "./index.js";

export interface Frontmatter {
  theme?: string;
  style: [string, string][];
}

export type DocBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "prose"; text: string }
  | { kind: "list"; ordered: boolean; start?: number; items: string[] }
  | { kind: "code"; lang?: string; text: string }
  | { kind: "math"; text: string }
  | { kind: "table"; table: Table }
  | { kind: "chart"; chart: Chart }
  | { kind: "diagram"; diagram: { id: string; text: string } }
  | { kind: "image"; image: Image }
  | { kind: "audio"; audio: Audio };

export interface Doc {
  frontmatter: Frontmatter;
  blocks: DocBlock[];
}

const DIRECTIVE_RE = /^::: (table|chart|image|audio) \{#([^}]+)\}$/;
const MERMAID_RE = /^::: mermaid \{#([^}]+)\}$/;

export class ParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`${message} (line ${line})`);
  }
}

export function parseDoc(text: string): Doc {
  const lines = text.split("\n");
  const doc: Doc = { frontmatter: { style: [] }, blocks: [] };
  let i = 0;
  let imageCount = 0;

  if (lines[0] === "---") {
    i = parseFrontmatter(lines, 1, doc);
  }
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      let blanks = 0;
      while (i < lines.length && (lines[i] ?? "").trim() === "") {
        blanks++;
        i++;
      }
      // Between content, a run of k blank lines encodes floor(k/2)
      // empty paragraphs: the serializer joins blocks with a blank
      // line, so n empty blocks emit 2n blank lines. Leading and
      // trailing runs are plain separators (they cannot round-trip).
      // A hand-typed odd run canonicalizes down on the next
      // serialization.
      if (i < lines.length && doc.blocks.length > 0) {
        const empties = Math.floor(blanks / 2);
        for (let e = 0; e < empties; e++) {
          doc.blocks.push({ kind: "prose", text: "" });
        }
      }
      continue;
    }
    const mm = MERMAID_RE.exec(line.trim());
    if (mm) {
      const end = findDirectiveEnd(lines, i + 1);
      doc.blocks.push({
        kind: "diagram",
        diagram: {
          id: mm[1] ?? "",
          text: lines
            .slice(i + 1, end)
            .join("\n")
            .trim(),
        },
      });
      i = end + 1;
      continue;
    }
    // A standard Markdown image on its own line - the hand-typed
    // form. It canonicalizes to the image directive on the next
    // serialization (ids are assigned per document).
    const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line.trim());
    if (img) {
      imageCount += 1;
      doc.blocks.push({
        kind: "image",
        image: {
          id: `image-${imageCount}`,
          src: img[2] ?? "",
          ...(img[1] ? { alt: img[1] } : {}),
        },
      });
      i++;
      continue;
    }
    const m = DIRECTIVE_RE.exec(line);
    if (m) {
      const id = m[2] ?? "";
      const body = readDirectiveBody(lines, i, id);
      if (m[1] === "table") doc.blocks.push(parseTableDirective(body, id));
      else if (m[1] === "chart") doc.blocks.push(parseChartDirective(body, id));
      else if (m[1] === "audio") doc.blocks.push(parseAudioDirective(body, id));
      else doc.blocks.push(parseImageDirective(body, id));
      i = body.endLine + 1;
      continue;
    }
    const fence = /^`{3,}(\S*)$/.exec(line.trim());
    if (fence) {
      const end = findFenceEnd(lines, i + 1);
      doc.blocks.push({
        kind: "code",
        ...(fence[1] ? { lang: fence[1] } : {}),
        text: lines.slice(i + 1, end).join("\n"),
      });
      i = end + 1;
      continue;
    }
    if (line.trim() === "$$") {
      const end = findMathEnd(lines, i + 1);
      doc.blocks.push({
        kind: "math",
        text: lines.slice(i + 1, end).join("\n"),
      });
      i = end + 1;
      continue;
    }
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) {
      doc.blocks.push({
        kind: "heading",
        level: (heading[1] ?? "#").length,
        text: heading[2] ?? "",
      });
      i++;
      continue;
    }
    if (LIST_ITEM_RE.test(line)) {
      const list = parseList(lines, i);
      doc.blocks.push(list.block);
      i = list.end;
      continue;
    }
    const proseEnd = collectProse(lines, i);
    doc.blocks.push({
      kind: "prose",
      text: lines.slice(i, proseEnd).join("\n").trimEnd(),
    });
    i = proseEnd;
  }
  return doc;
}

function parseFrontmatter(lines: string[], start: number, doc: Doc): number {
  let i = start;
  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line === "---") return i + 1;
    const kv = /^(\w[\w-]*): (.*)$/.exec(line);
    if (kv) {
      if (kv[1] === "style") continue;
      if (kv[1] === "theme" && kv[2] !== undefined) {
        doc.frontmatter.theme = kv[2];
      }
      continue;
    }
    const style = /^ {2}([\w.]+): (.*)$/.exec(line);
    if (style && (style[2] ?? "").length > 0) {
      doc.frontmatter.style.push([style[1] ?? "", unquote(style[2] ?? "")]);
    }
  }
  throw new ParseError("Unterminated frontmatter", start);
}

interface DirectiveBody {
  entries: [string, string][];
  endLine: number;
}

function readDirectiveBody(
  lines: string[],
  start: number,
  id: string,
): DirectiveBody {
  const entries: [string, string][] = [];
  let i = start + 1;
  for (; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line === ":::") return { entries, endLine: i };
    if (line.trim() === "") continue;
    const kv = /^([\w]+):(?: ?(.*))$/.exec(line);
    if (kv) entries.push([kv[1] ?? "", kv[2] ?? ""]);
    else if (/^ {2}/.test(line) || /^ {4}/.test(line)) {
      entries.push(["_item", line.trim()]);
    } else throw new ParseError(`Bad directive line: '${line}'`, i + 1);
  }
  throw new ParseError(`Unterminated directive '{#${id}}'`, start + 1);
}

function parseTableDirective(body: DirectiveBody, id: string): DocBlock {
  const table: Table = { id, columns: [], rows: [] };
  let section: "none" | "columns" | "data" = "none";
  for (const [k, raw] of body.entries) {
    if (k === "_item") {
      if (section === "columns") table.columns.push(parseColumn(raw));
      else if (section === "data") table.rows.push(parseRow(raw));
      else
        throw new ParseError(`List item outside section in table '${id}'`, 0);
      continue;
    }
    if (k === "caption") table.caption = unquote(raw);
    else if (k === "import") table.import = unquote(raw);
    else if (k === "columns") section = "columns";
    else if (k === "data") section = "data";
    else throw new ParseError(`Unknown table key: '${k}'`, 0);
  }
  return { kind: "table", table };
}

function parseColumn(raw: string): Table["columns"][number] {
  const inner = raw.replace(/^- \{|\}$/g, "");
  const col: Record<string, string> = {};
  for (const part of splitMapEntries(inner)) {
    const idx = part.indexOf(":");
    if (idx < 0) throw new ParseError(`Bad column entry: '${part}'`, 0);
    col[part.slice(0, idx).trim()] = unquote(part.slice(idx + 1).trim());
  }
  return {
    name: col["name"] ?? "",
    type: (col["type"] ?? "text") as Table["columns"][number]["type"],
    ...(col["unit"] !== undefined ? { unit: col["unit"] } : {}),
    ...(col["format"] !== undefined
      ? { format: col["format"] as "percent" }
      : {}),
    ...(col["expr"] !== undefined ? { expr: col["expr"] } : {}),
    ...(col["width"] !== undefined
      ? { width: parseInt(col["width"], 10) }
      : {}),
    ...(col["align"] !== undefined
      ? { align: col["align"] as "left" | "right" }
      : {}),
  };
}

function splitMapEntries(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  let depth = 0;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && (ch === "[" || ch === "{")) depth++;
    if (!quoted && (ch === "]" || ch === "}")) depth--;
    if (ch === "," && !quoted && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseRow(raw: string): Cell[] {
  const inner = raw.replace(/^- \[|\]$/g, "");
  const out: Cell[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of inner) {
    if (ch === '"') quoted = !quoted;
    if (ch === "," && !quoted) {
      out.push(cell(cur.trim()));
      cur = "";
    } else cur += ch;
  }
  out.push(cell(cur.trim()));
  return out;
}

function cell(s: string): Cell {
  if (/^-?[0-9]+(\.[0-9]+)?$/.test(s)) return parseFloat(s);
  return unquote(s);
}

function parseChartDirective(body: DirectiveBody, id: string): DocBlock {
  const values: Record<string, string> = {};
  for (const [k, v] of body.entries) values[k] = v;
  if (!values["source"] || !values["query"] || !values["type"]) {
    throw new ParseError("Chart directive missing source/query/type", 0);
  }
  const chart: Chart = {
    id,
    source: values["source"].replace(/^@/, ""),
    query: parseQuery(values["query"]),
    type: values["type"] as Chart["type"],
    ...(values["caption"] !== undefined
      ? { caption: unquote(values["caption"]) }
      : {}),
  };
  return { kind: "chart", chart };
}

function parseImageDirective(body: DirectiveBody, id: string): DocBlock {
  const values: Record<string, string> = {};
  for (const [k, v] of body.entries) {
    if (k !== "src" && k !== "alt" && k !== "caption") {
      throw new ParseError(`Unknown image key: '${k}'`, 0);
    }
    values[k] = v;
  }
  if (!values["src"]) {
    throw new ParseError("Image directive missing src", 0);
  }
  const image: Image = { id, src: values["src"] };
  if (values["alt"] !== undefined) image.alt = unquote(values["alt"]);
  if (values["caption"] !== undefined) {
    image.caption = unquote(values["caption"]);
  }
  return { kind: "image", image };
}

function parseAudioDirective(body: DirectiveBody, id: string): DocBlock {
  const values: Record<string, string> = {};
  for (const [k, v] of body.entries) {
    if (k !== "src" && k !== "alt" && k !== "caption") {
      throw new ParseError(`Unknown audio key: '${k}'`, 0);
    }
    values[k] = v;
  }
  if (!values["src"]) {
    throw new ParseError("Audio directive missing src", 0);
  }
  const audio: Audio = { id, src: values["src"] };
  if (values["alt"] !== undefined) audio.alt = unquote(values["alt"]);
  if (values["caption"] !== undefined) {
    audio.caption = unquote(values["caption"]);
  }
  return { kind: "audio", audio };
}

function parseQuery(raw: string): Chart["query"] {
  const map = parseInlineMap(raw);
  const select = (map["select"] ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim());
  const query: Chart["query"] = { select };
  if (map["sort"]) {
    const s = parseInlineMap(map["sort"]);
    query.sort = {
      by: s["by"] ?? "",
      order: (s["order"] as "asc" | "desc") ?? "asc",
    };
  }
  if (map["filter"]) {
    const raw = map["filter"];
    if (raw.startsWith('"') || raw.startsWith("'")) {
      // A Jexl expression filter: the whole value is one string.
      query.filter = unquoteEscape(raw);
    } else {
      const f = parseInlineMap(raw);
      query.filter = {
        column: f["column"] ?? "",
        op: f["op"] ?? "",
        value: cell(f["value"] ?? ""),
      };
    }
  }
  return query;
}

function parseInlineMap(raw: string): Record<string, string> {
  const inner = raw.replace(/^\{|\}$/g, "");
  const out: Record<string, string> = {};
  for (const part of splitMapEntries(inner)) {
    const idx = part.indexOf(":");
    if (idx < 0) throw new ParseError(`Bad inline map entry: '${part}'`, 0);
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return out;
}

/** A list item line (spec: docs/specs/lists.md): an UNINDENTED
 * bullet (`- `, `* `, `+ `, or a bare marker for an empty item) or
 * number (`N. `, `N) `). */
const LIST_ITEM_RE = /^(?:([-*+])|(\d{1,9})[.)])(?: (.*))?$/;

/**
 * A flat list starting at `start`: item lines plus their indented
 * continuation lines, up to a blank line or an unindented non-item.
 * The first line's marker decides bulleted vs numbered.
 */
function parseList(
  lines: string[],
  start: number,
): { block: Extract<DocBlock, { kind: "list" }>; end: number } {
  const first = LIST_ITEM_RE.exec(lines[start] ?? "");
  const ordered = first?.[2] !== undefined;
  const startNo = ordered ? Number(first?.[2]) : 1;
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") break;
    const m = LIST_ITEM_RE.exec(line);
    if (m && (m[2] !== undefined) === ordered) {
      items.push(m[3] ?? "");
    } else if (/^\s/.test(line) && items.length > 0) {
      items[items.length - 1] += "\n" + line.trimStart();
    } else {
      break;
    }
    i++;
  }
  return {
    block: {
      kind: "list",
      ordered,
      ...(ordered && startNo !== 1 ? { start: startNo } : {}),
      items,
    },
    end: i,
  };
}

function serializeList(block: Extract<DocBlock, { kind: "list" }>): string {
  const first = block.start ?? 1;
  return block.items
    .map((item, n) => {
      const marker = block.ordered ? `${String(first + n)}.` : "-";
      const [head = "", ...rest] = item.split("\n");
      const indent = " ".repeat(marker.length + 1);
      return [
        head === "" ? marker : `${marker} ${head}`,
        ...rest.map((r) => indent + r),
      ].join("\n");
    })
    .join("\n");
}

function collectProse(lines: string[], start: number): number {
  let i = start;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (
      line.trim() === "" ||
      DIRECTIVE_RE.test(line) ||
      /^!\[[^\]]*\]\([^)]+\)$/.test(line.trim()) ||
      line.startsWith("#") ||
      line.trim() === "$$" ||
      /^`{3,}/.test(line.trim())
    ) {
      break;
    }
    i++;
  }
  return i;
}

function findDirectiveEnd(lines: string[], start: number): number {
  for (let i = start; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === ":::") return i;
  }
  throw new ParseError("Unterminated diagram block", start);
}

function findFenceEnd(lines: string[], start: number): number {
  for (let i = start; i < lines.length; i++) {
    if (/^`{3,}$/.test((lines[i] ?? "").trim())) return i;
  }
  throw new ParseError("Unterminated code block", start);
}

function findMathEnd(lines: string[], start: number): number {
  for (let i = start; i < lines.length; i++) {
    if ((lines[i] ?? "").trim() === "$$") return i;
  }
  throw new ParseError("Unterminated math block", start);
}

function unquote(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}

/** Unquote a string value keeping escaped double quotes (""). */
function unquoteEscape(s: string): string {
  const q = s.slice(0, 1);
  const inner =
    (q === '"' || q === "'") && s.length > 1 && s.endsWith(q)
      ? s.slice(1, -1)
      : s;
  return inner.replace(/\\"/g, '"');
}

/** Quote a Jexl expression for the source (double quotes, escaped). */
function quoteExpr(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function quoteStyleValue(v: string): string {
  if (/^[0-9.]+(pt|px|em|rem|%)$/.test(v)) return v;
  return `"${v}"`;
}

export function serializeDoc(doc: Doc): string {
  const parts: string[] = [];
  const fmLines: string[] = [];
  if (doc.frontmatter.theme !== undefined) {
    fmLines.push(`theme: ${doc.frontmatter.theme}`);
  }
  if (doc.frontmatter.style.length > 0) {
    fmLines.push("style:");
    for (const [k, v] of doc.frontmatter.style) {
      fmLines.push(`  ${k}: ${quoteStyleValue(v)}`);
    }
  }
  if (fmLines.length > 0) {
    parts.push(`---\n${fmLines.join("\n")}\n---`);
  }
  for (const block of doc.blocks) parts.push(serializeBlock(block));
  return parts.join("\n\n") + "\n";
}

function serializeBlock(block: DocBlock): string {
  switch (block.kind) {
    case "heading":
      return `${"#".repeat(block.level)} ${block.text}`;
    case "prose":
      return block.text;
    case "list":
      return serializeList(block);
    case "code":
      return "```" + (block.lang ?? "") + "\n" + block.text + "\n```";
    case "math":
      return "$$\n" + block.text + "\n$$";
    case "table":
      return serializeTable(block.table);
    case "chart":
      return serializeChart(block.chart);
    case "diagram":
      return `::: mermaid {#${block.diagram.id}}\n${block.diagram.text}\n:::`;
    case "image":
      return serializeImage(block.image);
    case "audio":
      return serializeAudio(block.audio);
  }
}

function serializeImage(image: Image): string {
  const lines = [`::: image {#${image.id}}`];
  // src stays raw (unquoted): data URIs and URLs carry no spaces.
  lines.push(`src: ${image.src}`);
  if (image.alt !== undefined) lines.push(`alt: "${image.alt}"`);
  if (image.caption !== undefined) {
    lines.push(`caption: "${image.caption}"`);
  }
  lines.push(":::");
  return lines.join("\n");
}

function serializeAudio(audio: Audio): string {
  const lines = [`::: audio {#${audio.id}}`];
  // src stays raw (unquoted): data URIs and URLs carry no spaces.
  lines.push(`src: ${audio.src}`);
  if (audio.alt !== undefined) lines.push(`alt: "${audio.alt}"`);
  if (audio.caption !== undefined) {
    lines.push(`caption: "${audio.caption}"`);
  }
  lines.push(":::");
  return lines.join("\n");
}

function serializeTable(table: Table): string {
  const lines = [`::: table {#${table.id}}`];
  if (table.caption !== undefined) {
    lines.push(`caption: "${table.caption}"`);
  }
  if (table.import !== undefined) {
    lines.push(`import: "${table.import}"`);
  }
  lines.push("columns:");
  for (const col of table.columns) {
    const entries = [`name: ${col.name}`, `type: ${col.type}`];
    if (col.unit !== undefined) entries.push(`unit: "${col.unit}"`);
    if (col.align !== undefined) entries.push(`align: ${col.align}`);
    if (col.width !== undefined) entries.push(`width: ${col.width}`);
    if (col.expr !== undefined) entries.push(`expr: "${col.expr}"`);
    if (col.format !== undefined) entries.push(`format: ${col.format}`);
    lines.push(`  - {${entries.join(", ")}}`);
  }
  lines.push("data:");
  for (const row of table.rows) {
    lines.push(`  - [${row.map(formatCell).join(", ")}]`);
  }
  lines.push(":::");
  return lines.join("\n");
}

function serializeChart(chart: Chart): string {
  const lines = [`::: chart {#${chart.id ?? `chart-${chart.source}`}}`];
  lines.push(`source: @${chart.source}`);
  const q: string[] = [`select: [${chart.query.select.join(", ")}]`];
  if (chart.query.filter) {
    const f = chart.query.filter;
    q.push(
      typeof f === "string"
        ? `filter: ${quoteExpr(f)}`
        : `filter: {column: ${f.column}, op: ${f.op}, value: ${f.value}}`,
    );
  }
  if (chart.query.sort) {
    q.push(
      `sort: {by: ${chart.query.sort.by}, order: ${chart.query.sort.order}}`,
    );
  }
  lines.push(`query: {${q.join(", ")}}`);
  lines.push(`type: ${chart.type}`);
  if (chart.caption !== undefined) lines.push(`caption: "${chart.caption}"`);
  lines.push(":::");
  return lines.join("\n");
}

function formatCell(c: Cell): string {
  if (typeof c === "number") return String(c);
  if (/^[A-Za-z0-9£$%-]+$/.test(c)) return c;
  return `"${c}"`;
}
