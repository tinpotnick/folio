import { describe, expect, it } from "vitest";
import {
  htmlToInlineMarkdown,
  inlineMarkdownToHtml,
} from "@folio/render/inline";

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

describe("links", () => {
  it("renders and round-trips a link", () => {
    const html = inlineMarkdownToHtml(
      "See [the docs](demo/examples/poem.md) here",
    );
    expect(html).toContain('<a href="demo/examples/poem.md">the docs</a>');
    expect(htmlToInlineMarkdown(html)).toBe(
      "See [the docs](demo/examples/poem.md) here",
    );
  });

  it("formatting inside the link label round-trips", () => {
    const md = "[**bold** label](a.md)";
    expect(htmlToInlineMarkdown(inlineMarkdownToHtml(md))).toBe(md);
  });

  it("escapes angle brackets in the label but keeps the URL intact", () => {
    const html = inlineMarkdownToHtml("[a <b> tag](u.md)");
    expect(html).toContain("&lt;b&gt;");
    expect(htmlToInlineMarkdown(html)).toBe("[a <b> tag](u.md)");
  });
});

describe("link edge cases", () => {
  it("image syntax ![alt](url) is not a link", () => {
    const html = inlineMarkdownToHtml(
      "an ![alt](https://example.com/cat.png) image",
    );
    expect(html).not.toContain("<a ");
    expect(html).toContain("![alt]");
  });
});

describe("code spans are literal", () => {
  // Regression (first-contact eval): the help's `+ - * /` and
  // `x * 100` turned a run of prose italic - emphasis ran INSIDE
  // code spans.
  it("emphasis, strike and links never apply inside code", () => {
    expect(inlineMarkdownToHtml("ops `+ - * /`, and `a * 100` here")).toBe(
      "ops <code>+ - * /</code>, and <code>a * 100</code> here",
    );
    expect(inlineMarkdownToHtml("`**not bold**` and `[x](y)`")).toBe(
      "<code>**not bold**</code> and <code>[x](y)</code>",
    );
  });

  it("formatting outside code still works next to it", () => {
    expect(inlineMarkdownToHtml("*a* `*b*` **c**")).toBe(
      "<em>a</em> <code>*b*</code> <strong>c</strong>",
    );
  });
});
