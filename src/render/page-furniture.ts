/**
 * Page furniture on paper (docs/specs/print.md): a running header - the
 * document's title, from page 2 on - and "Page n of N". Both are on
 * unless the document's style turns them off (`page.header: off`,
 * `page.numbers: off`); they are print typography, so they live in
 * style keys, never in the text (AGENTS.md #1).
 */
import type { Doc } from "../engine/doc";
import { PAGE_SIZES, themeFromDoc, type PageSize } from "./theme";

export interface Furniture {
  /** The running header, or null for none. */
  header: string | null;
  numbers: boolean;
  /** Paper size name ("a4", "16:9", ...) for the desktop PDF export. */
  page_size: string;
}

/** The document's body font stack, for the margin boxes. */
export function furnitureFont(doc: Doc | null): string {
  return doc ? themeFromDoc(doc).bodyFont : "sans-serif";
}

/** A heading's words without its Markdown marks. */
function plain(md: string): string {
  return md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function furnitureFor(doc: Doc | null): Furniture {
  const style = new Map(doc?.frontmatter.style ?? []);
  const h1 = doc?.blocks.find((b) => b.kind === "heading" && b.level === 1);
  const title = h1?.kind === "heading" ? plain(h1.text) : "";
  return {
    header: style.get("page.header") === "off" || !title ? null : title,
    numbers: style.get("page.numbers") !== "off",
    page_size: pageSizeFor(doc),
  };
}

/** The typed `page.size` style key (docs/specs/slides.md); default a4. */
export function pageSizeFor(doc: Doc | null): PageSize {
  const style = new Map(doc?.frontmatter.style ?? []);
  const raw = style.get("page.size") ?? "";
  return (PAGE_SIZES as readonly string[]).includes(raw)
    ? (raw as PageSize)
    : "a4";
}

/** A CSS string literal. */
function cssString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}

/**
 * The `@page` margin boxes for the host's document stylesheet (they do
 * not apply from inside a shadow root). Browsers that draw margin boxes
 * (Chromium) print them; the desktop app's WebKitGTK does not, so its
 * PDF export stamps the same furniture on afterwards (ADR-0027).
 */
export function furnitureCss(f: Furniture, font = "sans-serif"): string {
  const box = `font: 8.5pt ${font}; color: #6b6b6b;`;
  const rules: string[] = [];
  if (f.header) {
    rules.push(`@top-left { content: ${cssString(f.header)}; ${box} }`);
  }
  if (f.numbers) {
    rules.push(
      `@bottom-right { content: "Page " counter(page) " of " counter(pages); ${box} }`,
    );
  }
  if (!rules.length) return "";
  const first = f.header
    ? "\n@page :first { @top-left { content: none; } }"
    : "";
  return `@page { ${rules.join(" ")} }${first}`;
}
