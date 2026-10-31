import { describe, expect, it } from "vitest";
import { parseDoc } from "../../src/engine/doc";
import {
  furnitureCss,
  furnitureFont,
  furnitureFor,
} from "../../src/render/page-furniture";

describe("page furniture (docs/specs/print.md)", () => {
  it("is the title and page numbers by default", () => {
    const f = furnitureFor(parseDoc("# Q3 *Sales* Review\n\nText.\n"));
    expect(f).toEqual({
      header: "Q3 Sales Review",
      numbers: true,
      page_size: "a4",
    });
    const css = furnitureCss(f);
    expect(css).toContain('@top-left { content: "Q3 Sales Review";');
    expect(css).toContain('counter(page) " of " counter(pages)');
    // The first page carries the title itself.
    expect(css).toContain("@page :first { @top-left { content: none; } }");
  });

  it("turns off by style key", () => {
    const doc = parseDoc(
      "---\nstyle:\n  page.header: off\n  page.numbers: off\n---\n\n# Title\n",
    );
    expect(furnitureFor(doc)).toEqual({
      header: null,
      numbers: false,
      page_size: "a4",
    });
    expect(furnitureCss(furnitureFor(doc))).toBe("");
  });

  it("has no header without a title, and quotes it safely", () => {
    expect(furnitureFor(parseDoc("Just text.\n")).header).toBeNull();
    expect(
      furnitureCss({ header: 'A "q" \\ b', numbers: false, page_size: "a4" }),
    ).toContain('content: "A \\"q\\" \\\\ b"');
  });

  it("sets the margin boxes in the theme's body face", () => {
    const font = furnitureFont(
      parseDoc("---\ntheme: manuscript\n---\n\n# T\n"),
    );
    expect(font).toMatch(/serif/i);
    expect(
      furnitureCss({ header: "T", numbers: true, page_size: "a4" }, font),
    ).toContain(`font: 8.5pt ${font};`);
  });
});
