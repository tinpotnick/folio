/**
 * Document outline (ADR-0001: pure computation, zero UI deps).
 * One deep module: the section browser in the host app is a view of
 * this outline; heading blocks keep their index so navigation can
 * scroll to the exact block.
 */
import type { Doc } from "./doc.js";

export interface OutlineEntry {
  blockIndex: number;
  level: number;
  text: string;
}

export function outlineOf(doc: Doc): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  doc.blocks.forEach((block, i) => {
    if (block.kind === "heading") {
      out.push({ blockIndex: i, level: block.level, text: block.text });
    }
  });
  return out;
}

/**
 * A heading's id, as GitHub makes it: lower case, punctuation dropped
 * (hyphens and underscores kept), spaces to hyphens. `@sec:` cross-
 * references name headings by it (docs/specs/cross-references.md).
 */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}
