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
