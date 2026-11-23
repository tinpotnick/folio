import { describe, expect, it } from "vitest";
import { parseDoc } from "../../src/engine/doc";
import {
  furnitureCss,
  furnitureFont,
  furnitureFor,
  pageSizeFor,
  sectionsCss,
  sectionsFor,
} from "../../src/render/page-furniture";
import { pageSizeCss } from "../../src/render/theme";

describe("page furniture (docs/specs/print.md)", () => {
  it("is the title and page numbers by default", () => {
    const f = furnitureFor(parseDoc("# Q3 *Sales* Review\n\nText.\n"));
    expect(f).toEqual({
      header: "Q3 Sales Review",
      footer: null,
      numbers: true,
      page_size: "a4",
      orientation: "portrait",
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
      footer: null,
      numbers: false,
      page_size: "a4",
      orientation: "portrait",
    });
    expect(furnitureCss(furnitureFor(doc))).toBe("");
  });

  it("reads a custom header/footer text and orientation by style key", () => {
    const doc = parseDoc(
      '---\nstyle:\n  page.header: "My Report"\n  page.footer: "Confidential"\n  page.orientation: landscape\n---\n\n# Title\n',
    );
    expect(furnitureFor(doc)).toEqual({
      header: "My Report",
      footer: "Confidential",
      numbers: true,
      page_size: "a4",
      orientation: "landscape",
    });
    const css = furnitureCss(furnitureFor(doc));
    expect(css).toContain('@top-left { content: "My Report";');
    expect(css).toContain('@bottom-left { content: "Confidential";');
  });

  it("has no header without a title, and quotes it safely", () => {
    expect(furnitureFor(parseDoc("Just text.\n")).header).toBeNull();
    expect(
      furnitureCss({
        header: 'A "q" \\ b',
        footer: null,
        numbers: false,
        page_size: "a4",
        orientation: "portrait",
      }),
    ).toContain('content: "A \\"q\\" \\\\ b"');
  });

  it("sets the margin boxes in the theme's body face", () => {
    const font = furnitureFont(
      parseDoc("---\ntheme: manuscript\n---\n\n# T\n"),
    );
    expect(font).toMatch(/serif/i);
    expect(
      furnitureCss(
        {
          header: "T",
          footer: null,
          numbers: true,
          page_size: "a4",
          orientation: "portrait",
        },
        font,
      ),
    ).toContain(`font: 8.5pt ${font};`);
  });

  it("pageSizeFor falls back to the theme's default paper", () => {
    // No key, no theme: a4.
    expect(pageSizeFor(parseDoc("# T\n"))).toBe("a4");
    // A deck theme defaults to slide paper; an explicit key wins.
    expect(pageSizeFor(parseDoc("---\ntheme: deck\n---\n\n# T\n"))).toBe(
      "16:9",
    );
    expect(
      pageSizeFor(
        parseDoc("---\ntheme: deck\nstyle:\n  page.size: a5\n---\n\n# T\n"),
      ),
    ).toBe("a5");
    expect(pageSizeFor(null)).toBe("a4");
  });

  it("pageSizeCss applies orientation", () => {
    expect(pageSizeCss("a4")).toBe("A4");
    expect(pageSizeCss("a4", "landscape")).toBe("A4 landscape");
    expect(pageSizeCss("16:9")).toBe("16in 9in");
    expect(pageSizeCss("16:9", "portrait")).toBe("9in 16in");
    expect(pageSizeCss("letter", "landscape")).toBe("letter landscape");
  });
});

describe("page sections (docs/specs/print.md, 'Page sections')", () => {
  const doc = parseDoc(
    '# T\n\nIntro.\n\n::: page {#s1}\nheader: "Part One"\nfooter: "Draft"\n:::\n\nMid.\n\n::: page {#s2}\nnumbers: off\nsize: a4\norientation: landscape\n:::\n\nEnd.\n',
  );

  it("sectionsFor carries omitted keys forward from the style defaults", () => {
    const s = sectionsFor(doc);
    expect(s).toHaveLength(3);
    expect(s[0]).toMatchObject({
      index: 0,
      header: "T",
      footer: null,
      numbers: true,
      page_size: "a4",
      orientation: "portrait",
    });
    expect(s[1]).toMatchObject({
      index: 1,
      header: "Part One", // set
      footer: "Draft", // set
      numbers: true, // carried forward
      page_size: "a4", // carried forward
      orientation: "portrait", // carried forward
    });
    expect(s[2]).toMatchObject({
      index: 2,
      header: "Part One", // carried forward
      footer: "Draft", // carried forward
      numbers: false, // set
      page_size: "a4", // set
      orientation: "landscape", // set
    });
  });

  it("sectionsCss emits the base @page plus a named page per section", () => {
    const css = sectionsCss(sectionsFor(doc));
    // Base: section 0's boxes, no size (the host's --folio-page-size).
    expect(css).toContain('@page { @top-left { content: "T";');
    expect(css).toContain('counter(page) " of " counter(pages)');
    expect(css).toContain("@page :first { @top-left { content: none; } }");
    // Section 1: named page, carried-forward size restated, own boxes.
    expect(css).toContain(
      '@page folio-sec-1 { size: A4; @top-left { content: "Part One";',
    );
    expect(css).toContain('@bottom-left { content: "Draft";');
    // Section 2: landscape size, numbers off (no bottom-right box).
    expect(css).toContain(
      '@page folio-sec-2 { size: A4 landscape; @top-left { content: "Part One";',
    );
    const sec2 = css.slice(css.indexOf("@page folio-sec-2"));
    expect(sec2).not.toContain("@bottom-right");
    // No named page for a document without ::: page blocks.
    expect(sectionsCss(sectionsFor(parseDoc("# T\n\nText.\n")))).not.toContain(
      "folio-sec-",
    );
  });
});
