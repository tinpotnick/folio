// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  htmlToInlineMarkdown,
  inlineMarkdownToHtml,
} from "../../src/render/inline";

describe("footnote references inline", () => {
  it("render as a reference and convert back to [^label]", () => {
    const md = "A claim[^1] and **bold**[^source].";
    const html = inlineMarkdownToHtml(md);
    expect(html).toContain('class="folio-fnref" data-fn="1"');
    expect(html).toContain('data-fn="source"');
    expect(htmlToInlineMarkdown(html)).toBe(md);
  });

  it("leave links alone", () => {
    const md = "[a link](https://example.com) and a note[^2]";
    expect(htmlToInlineMarkdown(inlineMarkdownToHtml(md))).toBe(md);
  });

  it("typed no-break spaces become ordinary spaces in the file", () => {
    const html = inlineMarkdownToHtml("A claim[^1] and more.").replace(
      "</sup> and",
      "</sup>\u00a0and",
    );
    expect(htmlToInlineMarkdown(html)).toBe("A claim[^1] and more.");
  });
});
