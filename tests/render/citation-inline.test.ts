// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  htmlToInlineMarkdown,
  inlineMarkdownToHtml,
} from "../../src/render/inline";

const keys = new Set(["knuth1984", "tufte1983"]);
const round = (md: string): string =>
  htmlToInlineMarkdown(inlineMarkdownToHtml(md, { citeKeys: keys }));

describe("citations inline (docs/specs/citations.md)", () => {
  it("render as atoms and convert back exactly", () => {
    for (const md of [
      "As argued [@knuth1984, p. 99], programs are literature.",
      "Two views [see @knuth1984; -@tufte1983, ch. *2*].",
      "@knuth1984 calls this literate programming.",
      'Ink & data [@tufte1983, pp. 91--93] "quoted".',
    ]) {
      expect(round(md)).toBe(md);
    }
    const html = inlineMarkdownToHtml("See [@knuth1984].", { citeKeys: keys });
    expect(html).toContain('class="folio-cite"');
    expect(html).toContain('data-cite="[@knuth1984]"');
  });

  it("keeps a bracket's *emphasis* literal inside the citation", () => {
    const html = inlineMarkdownToHtml("[@knuth1984, *passim*]");
    expect(html).not.toContain("<em>");
  });

  it("leaves handles, emails, links and cross-references alone", () => {
    for (const md of [
      "Ping @nick about it.",
      "Mail knuth1984@example.com today.",
      "[a link](https://example.com/@knuth1984)",
      "See [@tbl:results] and @fig:trend.",
      "Plain [brackets] stay.",
    ]) {
      const html = inlineMarkdownToHtml(md, { citeKeys: keys });
      expect(html).not.toContain("folio-cite");
      expect(round(md)).toBe(md);
    }
  });

  it("a bare @key is a citation only when the bibliography has it", () => {
    expect(inlineMarkdownToHtml("@knuth1984 wrote")).not.toContain(
      "folio-cite",
    );
    expect(
      inlineMarkdownToHtml("@knuth1984 wrote", { citeKeys: keys }),
    ).toContain("folio-cite-narrative");
    // Bracketed citations always are - a missing key is shown, not hidden.
    expect(inlineMarkdownToHtml("[@unknown2020]")).toContain("folio-cite");
  });
});
