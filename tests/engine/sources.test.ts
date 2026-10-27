import { describe, expect, it } from "vitest";
import { parseBibtex } from "../../src/engine/bibtex";
import { formatBibliography, runsText } from "../../src/engine/citations";
import {
  parseFetched,
  publisherFor,
  sourceBibtex,
  sourceKey,
} from "../../src/engine/sources";

const BOE =
  "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&SeriesCodes=IUMABEDR&CSVF=TN&UsingCodes=Y";
const FRED =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=SPASTT01GBM661N";
const ONS =
  "https://www.ons.gov.uk/generator?format=csv&uri=/economy/inflationandpriceindices/timeseries/d7bt/mm23";

describe("data from the web (docs/specs/data-import.md)", () => {
  it("reads the Bank of England's CSV: dates ISO, a series title", () => {
    const { parsed, meta } = parseFetched(
      "DATE,IUMABEDR\n31 Jan 2020,0.75\n29 Feb 2020,0.75\n",
      BOE,
    );
    expect(parsed.columns).toEqual([
      { name: "DATE", type: "date" },
      { name: "IUMABEDR", type: "number" },
    ]);
    expect(parsed.rows[0]).toEqual(["2020-01-31", 0.75]);
    expect(meta).toMatchObject({
      publisher: "Bank of England",
      title: "IUMABEDR",
      licence: "Open Government Licence v3.0",
    });
  });

  it("reads FRED's CSV, '.' as missing", () => {
    const { parsed, meta } = parseFetched(
      "observation_date,SPASTT01GBM661N\n1958-01-01,1.54\n1958-02-01,.\n",
      FRED,
    );
    expect(parsed.columns.map((c) => c.type)).toEqual(["date", "number"]);
    expect(parsed.rows[1]).toEqual(["1958-02-01", ""]);
    expect(meta.publisher).toBe("Federal Reserve Bank of St. Louis (FRED)");
    expect(meta.title).toBe("SPASTT01GBM661N");
  });

  it("reads the ONS layout: its title, OGL, and the monthly series", () => {
    const text = [
      '"Title","CPI INDEX 00: ALL ITEMS 2015=100"',
      '"CDID","D7BT"',
      '"Unit","Index, base year = 100"',
      '"2023","128.6"',
      '"2023 Q4","130.5"',
      '"2024 JAN","131.5"',
      '"2024 FEB","132.3"',
    ].join("\n");
    const { parsed, meta } = parseFetched(text, ONS);
    expect(parsed.columns).toEqual([
      { name: "date", type: "date" },
      { name: "d7bt", type: "number" },
    ]);
    expect(parsed.rows).toEqual([
      ["2024-01-01", 131.5],
      ["2024-02-01", 132.3],
    ]);
    expect(meta).toEqual({
      title: "CPI INDEX 00: ALL ITEMS 2015=100",
      publisher: "Office for National Statistics",
      licence: "Open Government Licence v3.0",
    });
  });

  it("says when an address is a web page, not data", () => {
    expect(() =>
      parseFetched("<!DOCTYPE html><html><body>Sign in</body></html>", BOE),
    ).toThrow(/returned a web page, not data/);
  });

  it("names unknown publishers by their host", () => {
    expect(publisherFor("https://www.example.org/x.csv")).toEqual({
      publisher: "example.org",
    });
  });

  it("writes a BibTeX entry that cites the dataset with its access date", () => {
    const meta = {
      title: "CPI INDEX 00: ALL ITEMS 2015=100",
      publisher: "Office for National Statistics",
      licence: "Open Government Licence v3.0",
    };
    const key = sourceKey(meta, "cpi", new Set(["ons_cpi"]));
    expect(key).toBe("ons_cpi_2");
    const bib = sourceBibtex(key, meta, ONS, "2026-10-27");
    const { entries, errors } = parseBibtex(bib);
    expect(errors).toEqual([]);
    expect(entries[0]?.authors).toEqual([
      { family: "Office for National Statistics", given: "" },
    ]);
    const apa = formatBibliography(entries, [key], "author-date");
    expect(runsText(apa.entries[0]?.runs ?? [])).toBe(
      `Office for National Statistics. (2026). CPI INDEX 00: ALL ITEMS 2015=100 [Data set]. Retrieved 27 October 2026, from ${ONS}`,
    );
    const ieee = formatBibliography(entries, [key], "numeric");
    expect(runsText(ieee.entries[0]?.runs ?? [])).toContain(
      "Accessed: Oct. 27, 2026. [Online]. Available: ",
    );
  });
});
