import { describe, expect, it } from "vitest";
import { parseDoc } from "@folio/engine/doc";
import { outlineOf } from "@folio/engine/outline";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sample = readFileSync(
  fileURLToPath(
    new URL("../../tests/golden/sample-document.md", import.meta.url),
  ),
  "utf8",
);

describe("outlineOf", () => {
  it("lists headings in order with block indices", () => {
    const doc = parseDoc(sample);
    const outline = outlineOf(doc);
    expect(outline).toEqual([
      { blockIndex: 0, level: 1, text: "Q3 Field Operations Review" },
      { blockIndex: 2, level: 2, text: "Regional summary" },
    ]);
    for (const entry of outline) {
      expect(doc.blocks[entry.blockIndex]?.kind).toBe("heading");
    }
  });

  it("returns empty for a document without headings", () => {
    expect(outlineOf(parseDoc("just prose\n\nmore prose"))).toEqual([]);
  });
});
