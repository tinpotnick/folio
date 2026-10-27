/**
 * Data from a web address (docs/specs/data-import.md, "From the web"):
 * what came back is read as a table - CSV, JSON, or a publisher's own
 * layout (the ONS "generator" CSV) - and described for the citation:
 * who published it, under what licence, what it is called. The
 * document keeps a snapshot (ADR-0005); nothing here fetches.
 */
import { toIso } from "./dates.js";
import { parseCsv, parseJsonTable, type ParsedImport } from "./ingest.js";

export interface SourceMeta {
  title?: string;
  publisher?: string;
  /** The licence the publisher states, as its name. */
  licence?: string;
  /** Anything to know before sharing a document with this data. */
  notice?: string;
}

/** Publishers folio recognises by address, with their stated licence. */
const PUBLISHERS: {
  host: RegExp;
  publisher: string;
  licence?: string;
  notice?: string;
}[] = [
  {
    host: /(^|\.)ons\.gov\.uk$/,
    publisher: "Office for National Statistics",
    licence: "Open Government Licence v3.0",
  },
  {
    host: /(^|\.)bankofengland\.co\.uk$/,
    publisher: "Bank of England",
    licence: "Open Government Licence v3.0",
    notice:
      "Some exchange-rate series are licensed from third parties and excluded",
  },
  {
    host: /(^|\.)stlouisfed\.org$/,
    publisher: "Federal Reserve Bank of St. Louis (FRED)",
    notice:
      "FRED re-publishes other owners' data: check the series' notes for its copyright before sharing",
  },
  { host: /(^|\.)oecd\.org$/, publisher: "OECD", licence: "CC BY 4.0" },
  {
    host: /(^|\.)ecb\.europa\.eu$/,
    publisher: "European Central Bank",
    licence: "ECB statistics: free reuse with the source credited",
  },
  {
    host: /^ec\.europa\.eu$/,
    publisher: "Eurostat",
    licence: "CC BY 4.0",
  },
  {
    host: /(^|\.)landregistry\.data\.gov\.uk$/,
    publisher: "HM Land Registry",
    licence: "Open Government Licence v3.0",
  },
];

export function publisherFor(url: string): SourceMeta {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return {};
  }
  const hit = PUBLISHERS.find((p) => p.host.test(host));
  if (hit) {
    return {
      publisher: hit.publisher,
      ...(hit.licence ? { licence: hit.licence } : {}),
      ...(hit.notice ? { notice: hit.notice } : {}),
    };
  }
  return { publisher: host.replace(/^www\./, "") };
}

/** A series code in the address, for a title: FRED's id=, BoE's
 * SeriesCodes=, ONS's /timeseries/<cdid>/. */
function seriesOf(url: string): string | undefined {
  try {
    const u = new URL(url);
    const q =
      u.searchParams.get("id") ??
      u.searchParams.get("SeriesCodes") ??
      u.searchParams.get("series_id");
    if (q) return q;
    return /\/timeseries\/([a-z0-9]+)\//i
      .exec(u.pathname + "/")?.[1]
      ?.toUpperCase();
  } catch {
    return undefined;
  }
}

/**
 * The ONS website's CSV: `"Title","..."` and other metadata lines,
 * then years, then quarters (`1989 Q1`), then months (`1989 JAN`).
 * The finest series present wins - months, else quarters, else years.
 */
function parseOns(
  text: string,
): { parsed: ParsedImport; meta: SourceMeta } | null {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const cells = (l: string): string[] =>
    [...l.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map((m) =>
      (m[1] ?? m[2] ?? "").replace(/""/g, '"').trim(),
    );
  const first = cells(lines[0] ?? "");
  if (first[0] !== "Title") return null;
  const meta: Record<string, string> = {};
  const monthly: [string, number][] = [];
  const quarterly: [string, number][] = [];
  const yearly: [string, number][] = [];
  for (const l of lines) {
    const [k = "", v = ""] = cells(l);
    const num = Number(v);
    if (/^\d{4} [A-Z]{3}$/.test(k) && v !== "" && Number.isFinite(num)) {
      const iso = toIso(k);
      if (iso) monthly.push([iso, num]);
    } else if (/^\d{4} Q[1-4]$/.test(k) && v !== "" && Number.isFinite(num)) {
      const q = Number(k.slice(-1));
      quarterly.push([
        `${k.slice(0, 4)}-${String(q * 3 - 2).padStart(2, "0")}-01`,
        num,
      ]);
    } else if (/^\d{4}$/.test(k) && v !== "" && Number.isFinite(num)) {
      yearly.push([k, num]);
    } else if (k && !/^\d/.test(k)) {
      meta[k] = v;
    }
  }
  const name = (meta["CDID"] ?? "value")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  const series = monthly.length ? monthly : quarterly;
  const parsed: ParsedImport = series.length
    ? {
        columns: [
          { name: "date", type: "date" },
          { name: /^[a-z_]/.test(name) ? name : `v_${name}`, type: "number" },
        ],
        rows: series,
      }
    : {
        columns: [
          { name: "year", type: "number" },
          { name: /^[a-z_]/.test(name) ? name : `v_${name}`, type: "number" },
        ],
        rows: yearly.map(([y, v]) => [Number(y), v]),
      };
  if (!parsed.rows.length) return null;
  return {
    parsed,
    meta: {
      ...(meta["Title"] ? { title: meta["Title"] } : {}),
      publisher: "Office for National Statistics",
      licence: "Open Government Licence v3.0",
    },
  };
}

/**
 * What a web address returned, as a table and a description of it.
 * Errors say what was found instead (an HTML page is the usual one: a
 * sign-in, a cookie wall, or the page ABOUT the data, not the data).
 */
export function parseFetched(
  text: string,
  url: string,
): { parsed: ParsedImport; meta: SourceMeta } {
  const base = publisherFor(url);
  const series = seriesOf(url);
  const head = text.trimStart().slice(0, 200).toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) {
    throw new Error(
      "That address returned a web page, not data - look on the page for a CSV or JSON download link and use that address",
    );
  }
  const ons = parseOns(text);
  if (ons) return { parsed: ons.parsed, meta: { ...base, ...ons.meta } };
  const boe = parseBoeTitled(text);
  if (boe) return { parsed: boe.parsed, meta: { ...base, ...boe.meta } };
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    const table = parseCsv(text);
    const sdmx = fromSdmx(table);
    if (sdmx) return { parsed: sdmx.parsed, meta: { ...base, ...sdmx.meta } };
    const hpi = fromUkHpi(table);
    if (hpi) return { parsed: hpi, meta: base };
  }
  const parsed =
    trimmed.startsWith("[") || trimmed.startsWith("{")
      ? parseJsonTable(text)
      : parseCsv(text);
  return { parsed, meta: { ...base, ...(series ? { title: series } : {}) } };
}

/**
 * The Bank of England's titled CSV (`CSVF=TT`): a SERIES,DESCRIPTION
 * block, a blank line, then the data. The descriptions title the
 * series - for any code, not only folio's list.
 */
function parseBoeTitled(text: string): {
  parsed: ParsedImport;
  meta: SourceMeta & { titles: Record<string, string> };
} | null {
  const body = text.replace(/^\uFEFF/, "");
  if (!/^SERIES,DESCRIPTION\r?\n/.test(body)) return null;
  const split = body.search(/\r?\n\s*\r?\n/);
  if (split < 0) return null;
  const titles: Record<string, string> = {};
  for (const line of body.slice(0, split).split(/\r?\n/).slice(1)) {
    const at = line.indexOf(",");
    if (at > 0)
      titles[line.slice(0, at)] = line.slice(at + 1).replace(/^"|"$/g, "");
  }
  const parsed = parseCsv(body.slice(split).trimStart());
  const list = Object.values(titles);
  return {
    parsed,
    meta: {
      ...(list.length === 1 ? { title: list[0] } : {}),
      titles,
    },
  };
}

/**
 * SDMX-CSV (OECD, ECB, Eurostat): one row per observation with dozens
 * of descriptive columns. The table keeps the period and the value;
 * the descriptions become the title.
 */
function fromSdmx(
  table: ParsedImport,
): { parsed: ParsedImport; meta: SourceMeta } | null {
  const names = table.columns.map((c) => c.name);
  const ti = names.indexOf("TIME_PERIOD");
  const vi = names.indexOf("OBS_VALUE");
  if (ti < 0 || vi < 0) return null;
  // A label column can share its code column's name (OECD's MEASURE
  // and Measure): the de-duplicated label is the LAST match.
  const at = (row: ParsedImport["rows"][number], name: string): string => {
    const re = new RegExp(`^${name}(_\\d+)?$`, "i");
    let i = -1;
    names.forEach((n, j) => {
      if (re.test(n)) i = j;
    });
    return i < 0 ? "" : String(row[i] ?? "");
  };
  const period = (p: string): string => {
    const q = /^(\d{4})-Q([1-4])$/.exec(p);
    if (q)
      return `${q[1] ?? ""}-${String(Number(q[2]) * 3 - 2).padStart(2, "0")}-01`;
    if (/^\d{4}$/.test(p)) return `${p}-01-01`;
    return toIso(p) ?? p;
  };
  // SDMX does not promise an order: observations are sorted by period.
  const rows = table.rows
    .filter((r) => String(r[vi] ?? "") !== "")
    .map((r) => [period(String(r[ti] ?? "")), Number(r[vi])])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const first = table.rows[0];
  const title = first
    ? at(first, "TITLE") ||
      [at(first, "Measure"), at(first, "Reference_area")]
        .filter(Boolean)
        .join(", ")
    : "";
  return {
    parsed: {
      columns: [
        { name: "date", type: "date" },
        { name: "value", type: "number" },
      ],
      rows,
    },
    meta: title ? { title } : {},
  };
}

/**
 * HM Land Registry's UK House Price Index download: ~60 columns, one
 * set per property type. The table keeps all property types: the
 * average price, the index, and the yearly and monthly changes (%).
 */
function fromUkHpi(table: ParsedImport): ParsedImport | null {
  const names = table.columns.map((c) => c.name);
  const want: [string, string][] = [
    ["Period", "date"],
    ["Average_price_All_property_types", "average_price"],
    ["House_price_index_All_property_types", "hpi"],
    ["Percentage_change_yearly_All_property_types", "change_yearly"],
    ["Percentage_change_monthly_All_property_types", "change_monthly"],
  ];
  const idx = want.map(([n]) => names.indexOf(n));
  if (idx[0] === -1 || idx[1] === -1) return null;
  const keep = want.filter((_, i) => (idx[i] ?? -1) >= 0);
  const cols = idx.filter((i) => i >= 0);
  return {
    columns: keep.map(([, name], i) => ({
      name,
      type: i === 0 ? "date" : "number",
    })),
    rows: table.rows.map((r) =>
      cols.map((ci, i) => {
        const v = r[ci] ?? "";
        if (i === 0) return toIso(String(v)) ?? v;
        const num = typeof v === "number" ? v : Number(v);
        return v === "" || !Number.isFinite(num) ? "" : num;
      }),
    ),
  };
}

/** The names publishers are known by, for citation keys. */
const SHORT_NAMES: Record<string, string> = {
  "Bank of England": "boe",
  "Office for National Statistics": "ons",
  "Federal Reserve Bank of St. Louis (FRED)": "fred",
  OECD: "oecd",
  "HM Land Registry": "hmlr",
  "European Central Bank": "ecb",
  Eurostat: "eurostat",
};

/** A BibTeX key for a source: publisher initials and the series. */
export function sourceKey(
  meta: SourceMeta,
  id: string,
  taken: ReadonlySet<string>,
): string {
  const pub =
    SHORT_NAMES[meta.publisher ?? ""] ??
    (meta.publisher ?? "")
      .replace(/\(.*?\)/g, "")
      .split(/\s+/)
      .filter((w) => /^[A-Z]/.test(w))
      .map((w) => w[0]?.toLowerCase())
      .join("");
  const prefix = pub || "data";
  // boe + boe_series is boe_series, not boe_boe_series.
  const base = (id.startsWith(`${prefix}_`) ? id : `${prefix}_${id}`).replace(
    /[^A-Za-z0-9_]/g,
    "_",
  );
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${String(i)}`;
  return key;
}

const brace = (s: string): string => s.replace(/[{}\\]/g, "");

/**
 * A BibTeX entry citing a dataset fetched from the web: `@misc` with
 * the address and the date it was retrieved (`urldate`), so the
 * reference reads "Retrieved <date>, from <url>" in any style.
 */
export function sourceBibtex(
  key: string,
  meta: SourceMeta,
  url: string,
  retrieved: string,
): string {
  const year = retrieved.slice(0, 4);
  const fields: [string, string][] = [
    // Double braces: an organisation, not "Surname, Given".
    ["author", `{${brace(meta.publisher ?? "Unknown publisher")}}`],
    ["title", brace(meta.title ?? "Dataset")],
    ["howpublished", "Dataset"],
    ["year", year],
    ["url", url],
    ["urldate", retrieved],
  ];
  if (meta.licence) fields.push(["note", `Licence: ${brace(meta.licence)}`]);
  const width = Math.max(...fields.map(([k]) => k.length));
  return `@misc{${key},\n${fields
    .map(([k, v]) => `  ${k.padEnd(width)} = {${v}}`)
    .join(",\n")}\n}`;
}
