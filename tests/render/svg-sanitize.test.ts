// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@folio/render/svg-sanitize";

const wrap = (inner: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">${inner}</svg>`;

describe("sanitizeSvg", () => {
  it("keeps shapes, text, styles and in-document references", () => {
    const out = sanitizeSvg(
      wrap(
        '<defs><linearGradient id="g"/></defs><rect width="5" height="5" fill="url(#g)"/><text x="1" y="2">Hi</text><use href="#g"/>',
      ),
    );
    expect(out).toContain("<rect");
    expect(out).toContain('fill="url(#g)"');
    expect(out).toContain(">Hi</text>");
    expect(out).toContain('href="#g"');
  });

  it("drops scripts, handlers, javascript: links and embedded HTML", () => {
    const out = sanitizeSvg(
      wrap(
        '<script>alert(1)</script><rect onclick="alert(1)" width="1" height="1"/><a href="javascript:alert(1)"><text>x</text></a><foreignObject><div>html</div></foreignObject>',
      ),
    );
    expect(out).not.toMatch(/script|onclick|javascript|foreignObject/i);
    expect(out).toContain("<rect");
  });

  it("drops anything that would LOAD from outside (offline)", () => {
    const out = sanitizeSvg(
      wrap(
        '<image href="https://example.com/x.png"/><rect fill="url(https://example.com/p.svg#q)"/><style>@import url(https://e.com/a.css);</style>',
      ),
    );
    expect(out).not.toContain("example.com");
    expect(out).not.toContain("@import");
  });

  it("keeps data: images and plain web links (a click loads nothing on render)", () => {
    const out = sanitizeSvg(
      wrap(
        '<image href="data:image/png;base64,AAAA"/><a href="https://folio.example"><text>link</text></a>',
      ),
    );
    expect(out).toContain("data:image/png");
    expect(out).toContain('href="https://folio.example"');
  });

  it("refuses markup that is not SVG", () => {
    expect(() => sanitizeSvg("<div>nope</div>")).toThrow(/valid SVG/);
  });
});
