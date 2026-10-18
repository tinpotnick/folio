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

// @vitest-environment happy-dom
describe("inlineMarkdownToHtml markdown+ formats", () => {
  it("converts strikethrough and underline", () => {
    expect(inlineMarkdownToHtml("~~gone~~ ++added++")).toBe(
      "<del>gone</del> <ins>added</ins>",
    );
  });

  it("round-trips strikethrough and underline through the HTML seam", async () => {
    const { htmlToInlineMarkdown } = await import("@folio/render/inline");
    const html = inlineMarkdownToHtml("~~gone~~ ++added++");
    expect(htmlToInlineMarkdown(html)).toBe("~~gone~~ ++added++");
  });
});
