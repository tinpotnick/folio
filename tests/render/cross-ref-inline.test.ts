// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { headingSlug } from "../../src/engine/outline";
import {
  htmlToInlineMarkdown,
  inlineMarkdownToHtml,
} from "../../src/render/inline";

describe("cross-references inline (docs/specs/cross-references.md)", () => {
  it("render as references and convert back exactly", () => {
    const md =
      "See @tbl:regional-revenue, @fig:region-trend and @sec:against-target.";
    const html = inlineMarkdownToHtml(md);
    expect(html).toContain('data-ref="tbl:regional-revenue"');
    expect(html).toContain('data-ref="fig:region-trend"');
    expect(html).toContain('data-ref="sec:against-target"');
    expect(htmlToInlineMarkdown(html)).toBe(md);
  });

  it("leave email addresses and unknown kinds alone", () => {
    for (const md of [
      "mail me@tbl:x now",
      "an @eq:energy for later",
      "@someone",
    ]) {
      expect(inlineMarkdownToHtml(md)).not.toContain("folio-xref");
    }
  });
});

describe("heading slugs (GitHub's)", () => {
  it("lower-case, punctuation dropped, spaces to hyphens", () => {
    expect(headingSlug("Against target")).toBe("against-target");
    expect(headingSlug("Q3 Sales Review: what's next?")).toBe(
      "q3-sales-review-whats-next",
    );
    expect(headingSlug("Mass vs. stiffness_2")).toBe("mass-vs-stiffness_2");
  });
});
