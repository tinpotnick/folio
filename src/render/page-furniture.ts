/**
 * Page furniture on paper (docs/specs/print.md): a running header - the
 * document's title, from page 2 on - a running footer, and "Page n of
 * N". All are on unless the document's style turns them off
 * (`page.header: off`, `page.numbers: off`, ...); they are print
 * typography, so they live in style keys, never in the text
 * (AGENTS.md #1). A `::: page` block changes them mid-document (see
 * sectionsFor below).
 */
import type { Doc } from "../engine/doc";
import { PAGE_SIZES, pageSizeCss, themeFromDoc, type PageSize } from "./theme";

export interface Furniture {
  /** The running header (top left), or null for none. */
  header: string | null;
  /** The running footer (bottom left), or null for none. */
  footer: string | null;
  /** "Page n of N" bottom right. */
  numbers: boolean;
  /** Paper size name ("a4", "16:9", ...) for the desktop PDF export. */
  page_size: string;
  /** "portrait" (default) | "landscape". */
  orientation: string;
}

/** One print section's furniture + page geometry (spec:
 * docs/specs/print.md, "Page sections"): section 0 is everything
 * before the first `::: page` block; each such block starts the next
 * one. */
export interface PageSectionFurniture extends Furniture {
  index: number;
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
  const headerRaw = style.get("page.header");
  const footerRaw = style.get("page.footer");
  let header: string | null;
  if (headerRaw === "off") header = null;
  else if (headerRaw !== undefined)
    header = headerRaw; // custom text
  else header = title || null; // unset: the title
  const size = pageSizeFor(doc);
  const orientRaw = style.get("page.orientation");
  return {
    header,
    footer: footerRaw !== undefined && footerRaw !== "off" ? footerRaw : null,
    numbers: style.get("page.numbers") !== "off",
    page_size: size,
    // Unset: the size's natural orientation - portrait paper,
    // landscape decks.
    orientation:
      orientRaw === "landscape" || orientRaw === "portrait"
        ? orientRaw
        : size === "16:9" || size === "4:3"
          ? "landscape"
          : "portrait",
  };
}

/** The document's print sections (spec: docs/specs/print.md, "Page
 * sections"): starting from the style defaults, each `::: page` block
 * overrides the keys it sets; omitted keys carry forward. */
export function sectionsFor(doc: Doc | null): PageSectionFurniture[] {
  const base = furnitureFor(doc);
  const sections: PageSectionFurniture[] = [{ index: 0, ...base }];
  for (const b of doc?.blocks ?? []) {
    if (b.kind !== "page") continue;
    const prev = sections[sections.length - 1];
    if (!prev) continue;
    const p = b.page;
    sections.push({
      index: sections.length,
      header: p.header !== undefined ? p.header || null : prev.header,
      footer: p.footer !== undefined ? p.footer || null : prev.footer,
      numbers: p.numbers !== undefined ? p.numbers !== "off" : prev.numbers,
      page_size:
        p.size !== undefined &&
        (PAGE_SIZES as readonly string[]).includes(p.size)
          ? p.size
          : prev.page_size,
      orientation:
        p.orientation === "landscape" || p.orientation === "portrait"
          ? p.orientation
          : prev.orientation,
    });
  }
  return sections;
}

/** The typed `page.size` style key (docs/specs/slides.md); with no
 *  key, the THEME's default (a4 for report themes, 16:9 for decks). */
export function pageSizeFor(doc: Doc | null): PageSize {
  const style = new Map(doc?.frontmatter.style ?? []);
  const raw = style.get("page.size") ?? "";
  if ((PAGE_SIZES as readonly string[]).includes(raw)) return raw as PageSize;
  return doc ? themeFromDoc(doc).pageSize : "a4";
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
  return sectionsCss([{ index: 0, ...f }], font);
}

/**
 * The `@page` rules for a whole document's sections (spec:
 * docs/specs/print.md, "Page sections"): the base `@page` carries
 * section 0's margin boxes (its paper size comes from the host's
 * `--folio-page-size` as before), and each later section gets a named
 * page `@page folio-sec-N` that restates its carried-forward `size:`
 * (a named page would otherwise lose it) plus its own boxes. The
 * `@page :first` guard hides the running header on the document's
 * first page only - later sections' first pages do show theirs.
 */
export function sectionsCss(
  sections: PageSectionFurniture[],
  font = "sans-serif",
): string {
  const box = `font: 8.5pt ${font}; color: #6b6b6b;`;
  const boxes = (s: Furniture): string => {
    const rules: string[] = [];
    if (s.header) {
      rules.push(`@top-left { content: ${cssString(s.header)}; ${box} }`);
    }
    if (s.footer) {
      rules.push(`@bottom-left { content: ${cssString(s.footer)}; ${box} }`);
    }
    if (s.numbers) {
      rules.push(
        `@bottom-right { content: "Page " counter(page) " of " counter(pages); ${box} }`,
      );
    }
    return rules.join(" ");
  };
  const first = sections[0];
  if (!first) return "";
  const parts: string[] = [];
  const base = boxes(first);
  if (base) parts.push(`@page { ${base} }`);
  if (first.header) {
    parts.push(`\n@page :first { @top-left { content: none; } }`);
  }
  for (const s of sections.slice(1)) {
    const size = pageSizeCss(s.page_size as PageSize, s.orientation);
    parts.push(
      `\n@page folio-sec-${String(s.index)} { size: ${size}; ${boxes(s)} }`,
    );
  }
  return parts.join("");
}
