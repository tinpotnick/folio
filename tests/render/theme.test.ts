import { describe, expect, it } from "vitest";
import { parseDoc } from "@folio/engine/doc";
import { themeCss, themeFromDoc } from "@folio/render/theme";

function themeOf(frontmatter: string): string {
  const doc = parseDoc(`${frontmatter}# T\n\nSome prose.\n`);
  return themeCss(themeFromDoc(doc));
}

describe("theme style keys", () => {
  it("the default theme has no page-break rules and is booktabs", () => {
    const css = themeOf("");
    expect(css).not.toContain("break-before");
    expect(css).not.toContain("page-break-before");
    expect(css).not.toContain("border-top: 1px solid #d0d7de");
  });

  it("pagebreak.h1 and pagebreak.h2 emit guarded page-break rules", () => {
    const css = themeOf(
      "---\nstyle:\n  pagebreak.h1: before\n  pagebreak.h2: before\n---\n\n",
    );
    expect(css).toContain("h1:not(:first-child)");
    expect(css).toContain("h2:not(:first-child)");
    expect(css).toContain("break-before: page");
  });

  it("a page-break rule is not emitted for other values", () => {
    const css = themeOf("---\nstyle:\n  pagebreak.h1: never\n---\n\n");
    expect(css).not.toContain("break-before");
  });

  it("table.style plain emits the grid override", () => {
    const css = themeOf('---\nstyle:\n  table.style: "plain"\n---\n\n');
    expect(css).toContain("border-top: 1px solid #d0d7de");
    expect(css).toContain("border: 1px solid #e6e8eb");
  });
});
