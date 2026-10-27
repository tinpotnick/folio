/**
 * Known sources (docs/specs/data-import.md, "Known sources"): open-data
 * publishers whose licences let a document holding their data be shared
 * with the source credited, and the series a report most often needs.
 * Every code here was fetched live on 2026-10-27; the licences are in
 * docs/research/open-data-licences.md. No keys, no accounts: each is a
 * plain download. Pure data and address building - nothing fetches here.
 */

export interface KnownSeries {
  /** The publisher's own code (BoE IUMABEDR, ONS D7G7, OECD GBR.M.SHARE). */
  code: string;
  title: string;
  /** The value column's name in the document (formula-friendly). */
  column: string;
  /** What the number is, shown in the picker. */
  unit: string;
}

export interface Publisher {
  id: string;
  name: string;
  licence: string;
  notice?: string;
  /** One line on what it has, for the picker. */
  about: string;
  series: KnownSeries[];
  /** Several series in one table (they share dates). */
  multi: boolean;
  /** Any code of the publisher's may be typed, not only the listed. */
  anyCode?: { label: string; example: string };
  /** The download address for the chosen codes, from a year. */
  url: (codes: string[], fromYear: number) => string;
}

const oecd = (key: string, from: number): string =>
  `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0/${key}......?startPeriod=${String(from)}-01&format=csvfilewithlabels`;

const hpi = (region: string, from: number): string => {
  const to = new Date().toISOString().slice(0, 10);
  return `https://landregistry.data.gov.uk/app/ukhpi/download/new.csv?from=${String(from)}-01-01&to=${to}&location=${encodeURIComponent(`http://landregistry.data.gov.uk/id/region/${region}`)}`;
};

export const PUBLISHERS: Publisher[] = [
  {
    id: "boe",
    name: "Bank of England",
    licence: "Open Government Licence v3.0",
    notice:
      "Some exchange-rate series are licensed from third parties and excluded",
    about: "Bank Rate, mortgage rates, gilt yields - monthly",
    multi: true,
    anyCode: {
      label: "Or any series code from the Bank's database",
      example: "IUMBV42",
    },
    series: [
      {
        code: "IUMABEDR",
        title: "Bank Rate (monthly average)",
        column: "bank_rate",
        unit: "%",
      },
      {
        code: "IUMBEDR",
        title: "Bank Rate (end of month)",
        column: "bank_rate_eom",
        unit: "%",
      },
      {
        code: "IUMBV34",
        title: "2-year fixed mortgage rate (75% LTV)",
        column: "fixed_2y",
        unit: "%",
      },
      {
        code: "IUMBV37",
        title: "3-year fixed mortgage rate (75% LTV)",
        column: "fixed_3y",
        unit: "%",
      },
      {
        code: "IUMBV42",
        title: "5-year fixed mortgage rate (75% LTV)",
        column: "fixed_5y",
        unit: "%",
      },
      {
        code: "IUMTLMV",
        title: "Standard variable (revert-to) mortgage rate",
        column: "svr",
        unit: "%",
      },
      {
        code: "IUMAMNZC",
        title: "10-year gilt yield (nominal zero coupon)",
        column: "gilt_10y",
        unit: "%",
      },
    ],
    url: (codes, from) =>
      `https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/${String(from)}&Dateto=now&SeriesCodes=${codes.join(",")}&CSVF=TT&UsingCodes=Y&VPD=Y&VFD=N`,
  },
  {
    id: "ons",
    name: "Office for National Statistics",
    licence: "Open Government Licence v3.0",
    about: "Inflation and earnings - monthly",
    multi: false,
    series: [
      {
        code: "/economy/inflationandpriceindices/timeseries/d7g7/mm23",
        title: "CPI inflation, annual rate",
        column: "cpi_rate",
        unit: "%",
      },
      {
        code: "/economy/inflationandpriceindices/timeseries/d7bt/mm23",
        title: "CPI index (2015 = 100)",
        column: "cpi",
        unit: "index",
      },
      {
        code: "/economy/inflationandpriceindices/timeseries/l55o/mm23",
        title: "CPIH inflation, annual rate",
        column: "cpih_rate",
        unit: "%",
      },
      {
        code: "/employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kab9/emp",
        title: "Average weekly earnings, whole economy",
        column: "weekly_pay",
        unit: "£",
      },
    ],
    url: (codes) =>
      `https://www.ons.gov.uk/generator?format=csv&uri=${codes[0] ?? ""}`,
  },
  {
    id: "oecd",
    name: "OECD",
    licence: "CC BY 4.0",
    notice:
      "Share price indices exclude dividends; OECD names the UK one only as the national index",
    about: "Share price indices and interest rates by country - monthly",
    multi: false,
    series: [
      {
        code: "GBR.M.SHARE",
        title: "United Kingdom share prices (index, 2015 = 100)",
        column: "uk_shares",
        unit: "index",
      },
      {
        code: "USA.M.SHARE",
        title: "United States share prices (index, 2015 = 100)",
        column: "us_shares",
        unit: "index",
      },
      {
        code: "DEU.M.SHARE",
        title: "Germany share prices (index, 2015 = 100)",
        column: "de_shares",
        unit: "index",
      },
      {
        code: "FRA.M.SHARE",
        title: "France share prices (index, 2015 = 100)",
        column: "fr_shares",
        unit: "index",
      },
      {
        code: "JPN.M.SHARE",
        title: "Japan share prices (index, 2015 = 100)",
        column: "jp_shares",
        unit: "index",
      },
      {
        code: "GBR.M.IRLT",
        title: "United Kingdom long-term interest rate",
        column: "uk_long_rate",
        unit: "%",
      },
      {
        code: "GBR.M.IR3TIB",
        title: "United Kingdom short-term interest rate (3-month)",
        column: "uk_short_rate",
        unit: "%",
      },
      {
        code: "USA.M.IRLT",
        title: "United States long-term interest rate",
        column: "us_long_rate",
        unit: "%",
      },
    ],
    url: (codes, from) => oecd(codes[0] ?? "", from),
  },
  {
    id: "hmlr",
    name: "HM Land Registry",
    licence: "Open Government Licence v3.0",
    about: "UK House Price Index by region - monthly",
    multi: false,
    series: [
      {
        code: "united-kingdom",
        title: "House prices, United Kingdom",
        column: "average_price",
        unit: "£",
      },
      {
        code: "england",
        title: "House prices, England",
        column: "average_price",
        unit: "£",
      },
      {
        code: "scotland",
        title: "House prices, Scotland",
        column: "average_price",
        unit: "£",
      },
      {
        code: "wales",
        title: "House prices, Wales",
        column: "average_price",
        unit: "£",
      },
      {
        code: "northern-ireland",
        title: "House prices, Northern Ireland",
        column: "average_price",
        unit: "£",
      },
      {
        code: "london",
        title: "House prices, London",
        column: "average_price",
        unit: "£",
      },
    ],
    url: (codes, from) => hpi(codes[0] ?? "united-kingdom", from),
  },
  {
    id: "ecb",
    name: "European Central Bank",
    licence: "ECB statistics: free reuse with the source credited",
    about: "Euro exchange rates - monthly averages",
    multi: false,
    series: [
      {
        code: "M.GBP.EUR.SP00.A",
        title: "Pounds per euro (monthly average)",
        column: "gbp_per_eur",
        unit: "£",
      },
      {
        code: "M.USD.EUR.SP00.A",
        title: "US dollars per euro (monthly average)",
        column: "usd_per_eur",
        unit: "$",
      },
    ],
    url: (codes, from) =>
      `https://data-api.ecb.europa.eu/service/data/EXR/${codes[0] ?? ""}?format=csvdata&startPeriod=${String(from)}-01`,
  },
  {
    id: "eurostat",
    name: "Eurostat",
    licence: "CC BY 4.0",
    about: "Euro-area inflation - monthly",
    multi: false,
    series: [
      {
        code: "prc_hicp_manr/M.RCH_A.CP00.EA",
        title: "Euro-area inflation (HICP), annual rate",
        column: "ea_inflation",
        unit: "%",
      },
    ],
    url: (codes, from) => {
      const [flow, key] = (codes[0] ?? "").split("/");
      return `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/${flow ?? ""}/${key ?? ""}?format=SDMX-CSV&startPeriod=${String(from)}-01`;
    },
  },
  {
    id: "fred",
    name: "Federal Reserve Bank of St. Louis (FRED)",
    licence: "",
    notice:
      "FRED re-publishes other owners' data: check the series' notes for its copyright before sharing",
    about: "Any FRED series by its ID (many are other owners' data)",
    multi: false,
    anyCode: { label: "FRED series ID (from its page)", example: "CPIAUCSL" },
    series: [],
    url: (codes) =>
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(codes[0] ?? "")}`,
  },
];

export function publisher(id: string): Publisher | undefined {
  return PUBLISHERS.find((p) => p.id === id);
}
