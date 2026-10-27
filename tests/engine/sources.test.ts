import { readFileSync } from "node:fs";
import { PUBLISHERS, publisher } from "../../src/engine/catalog";
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

/** Trimmed copies of real responses, fetched 2026-10-27 (open licences). */
const FX = JSON.parse(
  readFileSync(new URL("./fixtures/sources.json", import.meta.url), "utf8"),
) as Record<string, string[]>;
const fx = (k: string): string => (FX[k] ?? []).join("\n");

describe("known sources' layouts", () => {
  it("SDMX-CSV (OECD, ECB, Eurostat) keeps the period and the value", () => {
    const o = parseFetched(
      fx("oecd"),
      "https://sdmx.oecd.org/public/rest/data/x",
    );
    expect(o.parsed.columns.map((c) => c.name)).toEqual(["date", "value"]);
    expect(o.parsed.rows[0]).toEqual(["1957-12-01", 1.573449]);
    expect(o.meta).toMatchObject({
      publisher: "OECD",
      licence: "CC BY 4.0",
      title: "Share prices, United Kingdom",
    });
    const e = parseFetched(
      fx("ecb"),
      "https://data-api.ecb.europa.eu/service/data/EXR/M.GBP.EUR.SP00.A",
    );
    expect(e.parsed.rows[0]?.[0]).toBe("2024-01-01");
    expect(e.meta.title).toBe(
      "Pound sterling/Euro ECB reference exchange rate",
    );
    // Observations out of order come back in date order.
    const lines = fx("oecd").split("\n");
    const shuffled = [lines[0], lines[2], lines[1]].join("\n");
    const sorted = parseFetched(
      shuffled,
      "https://sdmx.oecd.org/public/rest/data/x",
    );
    expect(sorted.parsed.rows.map((r) => String(r[0]))).toEqual([
      "1957-12-01",
      "1958-01-01",
    ]);
    const s = parseFetched(
      fx("eurostat"),
      "https://ec.europa.eu/eurostat/api/x",
    );
    expect(s.parsed.rows[0]).toEqual(["2024-01-01", 2.8]);
    expect(s.meta.publisher).toBe("Eurostat");
  });

  it("the UK House Price Index keeps all property types", () => {
    const h = parseFetched(
      fx("hpi"),
      "https://landregistry.data.gov.uk/app/ukhpi/download/new.csv",
    );
    expect(h.parsed.columns.map((c) => c.name)).toEqual([
      "date",
      "average_price",
      "hpi",
      "change_yearly",
      "change_monthly",
    ]);
    expect(h.parsed.rows[0]?.slice(0, 3)).toEqual(["2024-01-01", 255972, 98.1]);
  });

  it("the Bank of England's titled CSV titles each series", () => {
    const b = parseFetched(
      fx("boe"),
      "https://www.bankofengland.co.uk/boeapps/database/x?SeriesCodes=IUMABEDR,IUMBV34",
    );
    expect(b.parsed.columns.map((c) => c.name)).toEqual([
      "DATE",
      "IUMABEDR",
      "IUMBV34",
    ]);
    expect(b.parsed.rows[0]).toEqual(["2024-01-31", 5.25, 4.71]);
    expect(
      (b.meta as { titles?: Record<string, string> }).titles?.IUMABEDR,
    ).toBe("Monthly average of official Bank Rate");
  });

  it("every catalogue entry builds an address of its publisher's", () => {
    for (const p of PUBLISHERS) {
      const codes = p.series.length ? [p.series[0]?.code ?? ""] : ["CPIAUCSL"];
      const url = new URL(p.url(codes, 2000));
      expect(url.protocol).toBe("https:");
      expect(publisherFor(url.href).publisher).toBe(p.name);
      // Column names are formula-friendly.
      for (const s of p.series) expect(s.column).toMatch(/^[a-z][a-z0-9_]*$/);
    }
    expect(publisher("boe")?.url(["IUMABEDR", "IUMBV34"], 2010)).toContain(
      "Datefrom=01/Jan/2010&Dateto=now&SeriesCodes=IUMABEDR,IUMBV34&CSVF=TT",
    );
  });
});
