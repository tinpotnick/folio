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
  const trimmed = text.trimStart();
  const parsed =
    trimmed.startsWith("[") || trimmed.startsWith("{")
      ? parseJsonTable(text)
      : parseCsv(text);
  return { parsed, meta: { ...base, ...(series ? { title: series } : {}) } };
}

/** The names publishers are known by, for citation keys. */
const SHORT_NAMES: Record<string, string> = {
  "Bank of England": "boe",
  "Office for National Statistics": "ons",
  "Federal Reserve Bank of St. Louis (FRED)": "fred",
  OECD: "oecd",
  "HM Land Registry": "hmlr",
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
  const base = `${pub || "data"}_${id}`.replace(/[^A-Za-z0-9_]/g, "_");
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
