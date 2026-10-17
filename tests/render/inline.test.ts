import { describe, expect, it } from "vitest";
import { inlineMarkdownToHtml } from "@folio/render/inline";

describe("inlineMarkdownToHtml", () => {
  it("converts bold, italic, code", () => {
    expect(inlineMarkdownToHtml("**b** *i* `c`")).toBe(
      "<strong>b</strong> <em>i</em> <code>c</code>",
    );
  });

  it("escapes HTML to prevent XSS via document content", () => {
    expect(inlineMarkdownToHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(inlineMarkdownToHtml("just words")).toBe("just words");
  });
});
