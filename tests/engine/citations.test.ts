import { describe, expect, it } from "vitest";
import { latexToText, parseBibtex, parseNames } from "../../src/engine/bibtex";
import {
  formatBibliography,
  formatCitation,
  parseCitation,
  parseCluster,
  runsText,
  type Cluster,
} from "../../src/engine/citations";

/** A citation that must parse. */
function cluster(source: string): Cluster {
  const c = parseCitation(source);
  if (!c) throw new Error(`not a citation: ${source}`);
  return c;
}

const BIB = String.raw`
@string{cj = "The Computer Journal"}
@comment{exported from a reference manager}
@article{knuth1984,
  author  = {Knuth, Donald E.},
  title   = {Literate Programming},
  journal = cj,
  volume  = {27},
  number  = {2},
  pages   = {97--111},
  year    = {1984},
  doi     = {10.1093/comjnl/27.2.97}
}
@book{tufte1983,
  author    = {Edward R. Tufte},
  title     = {The Visual Display of Quantitative Information},
  publisher = {Graphics Press},
  address   = {Cheshire, CT},
  year      = 1983
}
@article{satyanarayan2017,
  author  = {Satyanarayan, Arvind and Moritz, Dominik and Wongsuphasawat, Kanit and Heer, Jeffrey},
  title   = {{Vega-Lite}: A Grammar of Interactive Graphics},
  journal = {IEEE Transactions on Visualization and Computer Graphics},
  volume  = {23}, number = {1}, pages = {341--350}, year = {2017},
  doi     = {10.1109/TVCG.2016.2599030}
}
@inproceedings{kluyver2016,
  author    = {Kluyver, Thomas and Ragan-Kelley, Benjamin and others},
  title     = {Jupyter Notebooks -- a publishing format for reproducible computational workflows},
  booktitle = {Positioning and Power in Academic Publishing: Players, Agents and Agendas},
  editor    = {Loizides, Fernando and Schmidt, Birgit},
  publisher = {IOS Press},
  pages     = {87--90},
  year      = {2016}
}
`;

describe("BibTeX (docs/specs/citations.md)", () => {
  it("reads entries, @string macros, and skips comments", () => {
    const { entries, errors } = parseBibtex(BIB);
    expect(errors).toEqual([]);
    expect(entries.map((e) => e.key)).toEqual([
      "knuth1984",
      "tufte1983",
      "satyanarayan2017",
      "kluyver2016",
    ]);
    const k = entries[0];
    expect(k?.fields.journal).toBe("The Computer Journal");
    expect(k?.fields.pages).toBe("97–111");
    expect(k?.authors).toEqual([{ family: "Knuth", given: "Donald E." }]);
    expect(entries[1]?.fields.year).toBe("1983");
    expect(entries[2]?.fields.title).toBe(
      "Vega-Lite: A Grammar of Interactive Graphics",
    );
  });

  it("turns LaTeX into text", () => {
    expect(
      latexToText(String.raw`G{\"o}del, \'Etienne, Erd\H{o}s, \c{C}a\u{g}`),
    ).toBe("Gödel, Étienne, Erdős, Çağ");
    expect(latexToText(String.raw`{\LaTeX}: A {\TeX}book`)).toBe(
      "LaTeX: A TeXbook",
    );
    expect(latexToText(String.raw`R\&D -- \emph{fast}~now`)).toBe(
      "R&D – fast now",
    );
  });

  it("reads names in either order, with particles and corporate names", () => {
    expect(
      parseNames("Ludwig van Beethoven and {World Health Organization}"),
    ).toEqual([
      { family: "van Beethoven", given: "Ludwig" },
      { family: "World Health Organization", given: "" },
    ]);
  });

  it("reports what it cannot read, and keeps going", () => {
    const { entries, errors } = parseBibtex(
      "@book{a, title={A}, year=2000}\n@book{a, title={B}}\n@misc{b, title={C}",
    );
    expect(entries.map((e) => e.key)).toEqual(["a", "b"]);
    expect(errors.join(" | ")).toMatch(/"a" appears twice.*"b" is not closed/);
  });
});

describe("citation syntax (Pandoc)", () => {
  it("reads clusters with prefixes, locators and suppressed authors", () => {
    expect(parseCluster("see @knuth1984, p. 99; -@tufte1983")).toEqual([
      {
        key: "knuth1984",
        prefix: "see",
        suffix: ", p. 99",
        suppressAuthor: false,
      },
      { key: "tufte1983", prefix: "", suffix: "", suppressAuthor: true },
    ]);
    expect(parseCitation("@knuth1984")?.narrative).toBe(true);
  });

  it("leaves cross-references and plain brackets alone", () => {
    expect(parseCluster("@tbl:results")).toBeNull();
    expect(parseCluster("no keys here")).toBeNull();
  });
});

describe("author-date (APA-like)", () => {
  const { entries } = parseBibtex(BIB);
  const keys = ["tufte1983", "knuth1984", "satyanarayan2017", "kluyver2016"];
  const f = formatBibliography(entries, keys, "author-date");
  const cite = (src: string): string =>
    formatCitation(cluster(src), f, "author-date").text;

  it("cites in the text", () => {
    expect(cite("[@knuth1984]")).toBe("(Knuth, 1984)");
    expect(cite("[see @knuth1984, p. 99; @tufte1983]")).toBe(
      "(see Knuth, 1984, p. 99; Tufte, 1983)",
    );
    expect(cite("[-@knuth1984]")).toBe("(1984)");
    expect(cite("@knuth1984")).toBe("Knuth (1984)");
    expect(cite("[@satyanarayan2017]")).toBe("(Satyanarayan et al., 2017)");
    expect(cite("[@kluyver2016]")).toBe("(Kluyver et al., 2016)");
  });

  it("marks a key the bibliography lacks", () => {
    const r = formatCitation(cluster("[@nobody2020]"), f, "author-date");
    expect(r).toEqual({ text: "(nobody2020?)", missing: ["nobody2020"] });
  });

  it("lists entries alphabetically, formatted", () => {
    expect(f.entries.map((e) => e.entry.key)).toEqual([
      "kluyver2016",
      "knuth1984",
      "satyanarayan2017",
      "tufte1983",
    ]);
    const text = f.entries.map((e) => runsText(e.runs));
    expect(text[1]).toBe(
      "Knuth, D. E. (1984). Literate Programming. The Computer Journal, 27(2), 97–111. https://doi.org/10.1093/comjnl/27.2.97",
    );
    expect(text[3]).toBe(
      "Tufte, E. R. (1983). The Visual Display of Quantitative Information. Graphics Press.",
    );
    expect(text[0]).toBe(
      "Kluyver, T., Ragan-Kelley, B., et al. (2016). Jupyter Notebooks – a publishing format for reproducible computational workflows. In F. Loizides & B. Schmidt (Eds.), Positioning and Power in Academic Publishing: Players, Agents and Agendas (pp. 87–90). IOS Press.",
    );
    // Titles of books and journals are italic.
    expect(f.entries[3]?.runs.find((r) => r.em)?.text).toBe(
      "The Visual Display of Quantitative Information",
    );
  });

  it("tells apart one author's works from the same year", () => {
    const two = parseBibtex(
      "@book{a, author={Doe, Jane}, title={Alpha}, year=2020}\n@book{b, author={Doe, Jane}, title={Beta}, year=2020}",
    ).entries;
    const g = formatBibliography(two, ["b", "a"], "author-date");
    expect(formatCitation(cluster("[@a; @b]"), g, "author-date").text).toBe(
      "(Doe, 2020a; Doe, 2020b)",
    );
  });
});

describe("numeric (IEEE-like)", () => {
  const { entries } = parseBibtex(BIB);
  const f = formatBibliography(
    entries,
    ["tufte1983", "knuth1984", "tufte1983"],
    "numeric",
  );

  it("numbers in order of first citation", () => {
    expect(f.entries.map((e) => [e.label, e.entry.key])).toEqual([
      ["[1]", "tufte1983"],
      ["[2]", "knuth1984"],
    ]);
    const cite = (src: string): string =>
      formatCitation(cluster(src), f, "numeric").text;
    expect(cite("[@knuth1984, p. 99]")).toBe("[2, p. 99]");
    expect(cite("[see @tufte1983; @knuth1984]")).toBe("see [1], [2]");
    expect(cite("@knuth1984")).toBe("Knuth [2]");
  });

  it("formats entries", () => {
    expect(runsText(f.entries[1]?.runs ?? [])).toBe(
      "D. E. Knuth, “Literate Programming,” The Computer Journal, vol. 27, no. 2, pp. 97–111, 1984, doi: 10.1093/comjnl/27.2.97.",
    );
    expect(runsText(f.entries[0]?.runs ?? [])).toBe(
      "E. R. Tufte, The Visual Display of Quantitative Information. Cheshire, CT: Graphics Press, 1983.",
    );
  });
});
