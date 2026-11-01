import { describe, expect, it } from "vitest";
import { parseDoc } from "@folio/engine/doc";
import {
  PALETTES,
  pageSizeCss,
  presetTheme,
  themeCss,
  themeFromDoc,
  themeNames,
  type Mode,
  type Theme,
} from "@folio/render/theme";
import { BUNDLED_FONTS, fontStack } from "@folio/render/fonts";

function themeOf(frontmatter: string, mode: Mode = "light"): string {
  const doc = parseDoc(`${frontmatter}# T\n\nSome prose.\n`);
  return themeCss(themeFromDoc(doc), mode);
}

function docTheme(frontmatter: string): Theme {
  return themeFromDoc(parseDoc(`${frontmatter}# T\n`));
}

/** WCAG relative luminance / contrast of two #rrggbb colors. */
function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const ch = [0, 2, 4].map((o) => parseInt(v.slice(o, o + 2), 16) / 255);
  const lin = ch.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return (
    0.2126 * (lin[0] ?? 0) + 0.7152 * (lin[1] ?? 0) + 0.0722 * (lin[2] ?? 0)
  );
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe("theme style keys", () => {
  it("the default theme has no page-break rules and is booktabs", () => {
    const css = themeOf("");
    // Slide rules are scoped to [slides] and print; the plain
    // document emits no break rules.
    expect(css).not.toContain("article.folio-doc:not([slides]) > .folio-slide");
    expect(docTheme("").tableStyle).toBe("booktabs");
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
    expect(css).not.toContain("article.folio-doc > h1:not(:first-child)");
  });

  it("table.style plain emits the full grid", () => {
    const css = themeOf('---\nstyle:\n  table.style: "plain"\n---\n\n');
    expect(css).toContain(
      "table.folio-table td, table.folio-table th { border: 1px solid var(--folio-rule); }",
    );
  });

  it("an unknown table.style keeps the theme's own", () => {
    const t = docTheme(
      '---\ntheme: modern\nstyle:\n  table.style: "zebra"\n---\n\n',
    );
    expect(t.tableStyle).toBe("striped");
  });

  it("a style key overrides its theme, key by key", () => {
    const t = docTheme(
      '---\ntheme: editorial\nstyle:\n  table.style: "plain"\n  chart.palette: "corporate"\n---\n\n',
    );
    expect(t.tableStyle).toBe("plain");
    expect(t.palette).toBe(PALETTES["corporate"]);
    // ...and everything else is still editorial.
    expect(t.h1Font).toBe(fontStack("Fraunces"));
    expect(t.bodySize).toBe("18px");
  });

  it("an unknown theme name falls back to the default look", () => {
    expect(docTheme("---\ntheme: literary\n---\n\n")).toEqual(docTheme(""));
  });
});

describe("shipped themes", () => {
  const names = themeNames();

  it("ships twelve themes, default first", () => {
    expect(names).toHaveLength(12);
    expect(names[0]).toBe("default");
    expect(names).toContain("deck");
    expect(names).toContain("deck-clean");
  });

  it("every theme names only bundled faces (offline, identical everywhere)", () => {
    for (const name of names) {
      const t = presetTheme(name);
      for (const stack of [t.bodyFont, t.h1Font, t.headingFont, t.monoFont]) {
        const family = /^"([^"]+)"/.exec(stack)?.[1] ?? "";
        expect(BUNDLED_FONTS, `${name}: ${stack}`).toContain(family);
      }
    }
  });

  // The bug this guards: three "themes" that differed by a font
  // size. Any two themes must differ on at least three visible axes.
  it("any two themes differ visibly", () => {
    const axes = (t: Theme): string[] => [
      t.bodyFont,
      t.h1Font,
      String(t.headingWeight),
      t.tableStyle,
      t.palette.light.join(),
      t.colors.light.paper,
      t.colors.light.accent,
      t.h1Align,
      t.h2Rule,
      t.h3Case,
      t.measure,
    ];
    for (const a of names) {
      for (const b of names) {
        if (a >= b) continue;
        const ax = axes(presetTheme(a));
        const bx = axes(presetTheme(b));
        const diff = ax.filter((v, i) => v !== bx[i]).length;
        expect(diff, `${a} vs ${b}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  for (const mode of ["light", "dark"] as const) {
    it(`every theme is legible in the ${mode} rendition`, () => {
      for (const name of names) {
        const t = presetTheme(name);
        const c = t.colors[mode];
        const at = `${name} (${mode})`;
        // Body text: AAA. Muted text and links: AA.
        expect(contrast(c.ink, c.paper), `${at} ink`).toBeGreaterThanOrEqual(7);
        expect(
          contrast(c.heading, c.paper),
          `${at} heading`,
        ).toBeGreaterThanOrEqual(7);
        expect(
          contrast(c.muted, c.paper),
          `${at} muted`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(c.accent, c.paper),
          `${at} accent`,
        ).toBeGreaterThanOrEqual(4.5);
        // Chart series are graphics: 3:1 against the page.
        for (const s of t.palette[mode]) {
          expect(
            contrast(s, c.paper),
            `${at} series ${s}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }
});

describe("renditions", () => {
  it("the mode picks the theme's own colors", () => {
    const t = presetTheme("editorial");
    expect(themeOf("---\ntheme: editorial\n---\n\n", "light")).toContain(
      `--folio-paper: ${t.colors.light.paper};`,
    );
    expect(themeOf("---\ntheme: editorial\n---\n\n", "dark")).toContain(
      `--folio-paper: ${t.colors.dark.paper};`,
    );
  });

  it("print is the light rendition on white, even from dark", () => {
    const css = themeOf("---\ntheme: manuscript\n---\n\n", "dark");
    const print = css.slice(css.indexOf("@media print {\n      /* Print"));
    expect(print).toContain(
      `--folio-ink: ${presetTheme("manuscript").colors.light.ink};`,
    );
    expect(print).toContain("--folio-paper: #ffffff;");
  });

  it("a bundled family gets its category fallback; others a serif", () => {
    expect(fontStack("Inter")).toContain("sans-serif");
    expect(fontStack("Merriweather")).toBe('"Merriweather", Georgia, serif');
  });
});

describe("slides (docs/specs/slides.md)", () => {
  it("slide rules are scoped to [slides] and never apply to the plain document", () => {
    const css = themeOf("");
    expect(css).toContain("article.folio-doc[slides]");
    expect(css).not.toContain("article.folio-doc:not([slides])");
    expect(css).toContain("aspect-ratio: 16 / 9");
  });

  it("slide CSS scales the theme ramp by slide.scale", () => {
    const css = themeOf("---\nstyle:\n  slide.scale: 2\n---\n\n");
    expect(css).toContain("font-size: calc(17px * 2)");
  });

  it("slide.aspect 4/3 changes the slide aspect and print size", () => {
    const css = themeOf("---\nstyle:\n  slide.aspect: 4/3\n---\n\n");
    expect(css).toContain("aspect-ratio: 4 / 3");
  });

  it("slide rendering breaks every H1 onto its own printed page", () => {
    const css = themeOf("");
    expect(css).toContain("article.folio-doc[slides] .folio-slide");
    expect(css).toContain("break-before: page");
    // The H1 is the deck title, hidden while playing.
    expect(css).toContain("article.folio-doc[slides] > h1");
  });

  it("page.size is a typed style key, default a4, 16:9 maps to 16in 9in", () => {
    expect(docTheme("").pageSize).toBe("a4");
    expect(docTheme("---\nstyle:\n  page.size: letter\n---\n\n").pageSize).toBe(
      "letter",
    );
    expect(docTheme("---\nstyle:\n  page.size: 16:9\n---\n\n").pageSize).toBe(
      "16:9",
    );
    expect(docTheme("---\nstyle:\n  page.size: bogus\n---\n\n").pageSize).toBe(
      "a4",
    );
    expect(pageSizeCss("a4")).toBe("A4");
    expect(pageSizeCss("16:9")).toBe("16in 9in");
    expect(pageSizeCss("4:3")).toBe("10.67in 8in");
  });

  it("deck themes default their paper to the slide aspect", () => {
    expect(docTheme("---\ntheme: deck\n---\n\n").pageSize).toBe("16:9");
    expect(docTheme("---\ntheme: deck-clean\n---\n\n").pageSize).toBe("16:9");
    // An explicit key still wins over the theme default.
    expect(
      docTheme("---\ntheme: deck\nstyle:\n  page.size: a4\n---\n\n").pageSize,
    ).toBe("a4");
  });

  it("deck themes ship with slide keys and pass the legibility rules", () => {
    for (const name of ["deck", "deck-clean"]) {
      const t = presetTheme(name);
      expect(t.slide.scale).toBeGreaterThan(1);
      expect(["16/9", "4/3"]).toContain(t.slide.aspect);
    }
  });
});
