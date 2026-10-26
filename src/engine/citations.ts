/**
 * Citations (spec: docs/specs/citations.md, ADR-0028): Pandoc's syntax
 * - `[@key]`, `[see @key, p. 12]`, `[@a; @b]`, `[-@key]`, narrative
 * `@key` - formatted in one of two styles folio writes itself:
 * author-date (APA-like) and numeric (IEEE-like). No UI dependencies:
 * the output is text runs the renderer dresses.
 */
import type { BibEntry, Name } from "./bibtex";

export type CitationStyle = "author-date" | "numeric";
export const CITATION_STYLES: readonly CitationStyle[] = [
  "author-date",
  "numeric",
];

/** A piece of formatted text; `em` is italic, `link` an address. */
export interface Run {
  text: string;
  em?: boolean;
  link?: string;
}

export interface CiteItem {
  key: string;
  prefix: string;
  /** The locator and anything after the key: ", p. 12". */
  suffix: string;
  /** `-@key`: the year alone (the author is already in the sentence). */
  suppressAuthor: boolean;
}

export interface Cluster {
  items: CiteItem[];
  /** `@key` in running text, not in brackets. */
  narrative: boolean;
}

/** A citation key: Pandoc's - inner punctuation only between word characters. */
export const CITE_KEY = String.raw`[\w](?:[\w]|[:.#$%&\-+?<>~/](?=[\w]))*`;
/** Keys that are cross-references, never citations. */
export const XREF_PREFIX = /^(tbl|fig|sec|eq):/;

const ITEM_RE = new RegExp(String.raw`^([\s\S]*?)(-?)@(${CITE_KEY})([\s\S]*)$`);

/**
 * The inside of a bracketed cluster, `see @a, p. 2; @b`, as items;
 * null when it is not a citation (no keys, or a cross-reference).
 */
export function parseCluster(inner: string): CiteItem[] | null {
  const items: CiteItem[] = [];
  for (const part of inner.split(";")) {
    const m = ITEM_RE.exec(part.trim());
    if (!m) return null;
    const key = m[3] ?? "";
    if (XREF_PREFIX.test(key)) return null;
    items.push({
      key,
      prefix: (m[1] ?? "").trim(),
      suffix: (m[4] ?? "").trim(),
      suppressAuthor: m[2] === "-",
    });
  }
  return items.length ? items : null;
}

/** A cluster's source text (`[@a, p. 2]` or `@a`) -> its parts. */
export function parseCitation(source: string): Cluster | null {
  if (source.startsWith("[") && source.endsWith("]")) {
    const items = parseCluster(source.slice(1, -1));
    return items ? { items, narrative: false } : null;
  }
  const m = new RegExp(`^@(${CITE_KEY})$`).exec(source);
  return m
    ? {
        items: [
          { key: m[1] ?? "", prefix: "", suffix: "", suppressAuthor: false },
        ],
        narrative: true,
      }
    : null;
}

/* --- Shared pieces --- */

const year = (e: BibEntry): string => e.fields.year ?? "n.d.";
const others = (names: Name[]): boolean =>
  names.some((n) => n.family === "others");
const real = (names: Name[]): Name[] =>
  names.filter((n) => n.family !== "others");

function initials(given: string, spaced: boolean): string {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      w
        .split("-")
        .map((p) => (/^\p{L}/u.test(p) ? `${p[0] ?? ""}.` : p))
        .join("-"),
    )
    .join(spaced ? " " : " ");
}

/** A locator as typed ("pp. 91--93") with BibTeX's dashes as typography. */
function locator(suffix: string): string {
  return suffix
    .replace(/^,\s*/, "")
    .replace(/---/g, "\u2014")
    .replace(/--/g, "\u2013");
}

/** "pp. 45–67" from "45--67" (already dashed by the reader) or "45-67". */
function pages(p: string): string {
  return p.replace(/\s*[-–]+\s*/g, "–");
}

function sentence(s: string): string {
  return /[.?!]$/.test(s) ? s : `${s}.`;
}

/** Who a citation names: families joined for the text. */
function citedNames(e: BibEntry, and: string): string {
  const names = real(e.authors.length ? e.authors : e.editors);
  if (!names.length) return e.fields.title ?? e.key;
  if (names.length === 1 && !others(e.authors)) return names[0]?.family ?? "";
  if (names.length === 2 && !others(e.authors)) {
    return `${names[0]?.family ?? ""} ${and} ${names[1]?.family ?? ""}`;
  }
  return `${names[0]?.family ?? ""} et al.`;
}

/* --- The bibliography, in its order with its labels --- */

export interface Formatted {
  /** In list order. */
  entries: { entry: BibEntry; label: string; runs: Run[] }[];
  /** Key -> how a citation shows it ("1", or "Knuth, 1984a"'s year "1984a"). */
  byKey: Map<string, { entry: BibEntry; number: number; year: string }>;
}

/**
 * The reference list for the cited keys (in citation order; unknown
 * keys skipped), with each entry's number (numeric) or disambiguated
 * year (author-date: 2020a, 2020b).
 */
export function formatBibliography(
  all: BibEntry[],
  cited: string[],
  style: CitationStyle,
): Formatted {
  const byId = new Map(all.map((e) => [e.key, e]));
  const order = [...new Set(cited)]
    .map((k) => byId.get(k))
    .filter((e): e is BibEntry => !!e);
  const sortKey = (e: BibEntry): string =>
    `${citedNames(e, "&").toLowerCase()}\u0000${year(e)}\u0000${(e.fields.title ?? "").toLowerCase()}`;
  const list =
    style === "numeric"
      ? order
      : [...order].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  // Same names, same year: 2020a, 2020b, in list order.
  const years = new Map<BibEntry, string>();
  const groups = new Map<string, BibEntry[]>();
  for (const e of list) {
    const g = `${citedNames(e, "&")}\u0000${year(e)}`;
    groups.set(g, [...(groups.get(g) ?? []), e]);
  }
  for (const g of groups.values()) {
    g.forEach((e, i) =>
      years.set(
        e,
        g.length > 1 ? `${year(e)}${String.fromCharCode(97 + i)}` : year(e),
      ),
    );
  }
  const byKey = new Map<
    string,
    { entry: BibEntry; number: number; year: string }
  >();
  const entries = list.map((entry, i) => {
    byKey.set(entry.key, {
      entry,
      number: i + 1,
      year: years.get(entry) ?? year(entry),
    });
    return {
      entry,
      label: style === "numeric" ? `[${String(i + 1)}]` : "",
      runs:
        style === "numeric"
          ? ieee(entry)
          : apa(entry, years.get(entry) ?? year(entry)),
    };
  });
  return { entries, byKey };
}

/** Every key a cluster list names, in reading order. */
export function citedKeys(clusters: Cluster[]): string[] {
  return clusters.flatMap((c) => c.items.map((i) => i.key));
}

/* --- In the text --- */

/**
 * How a cluster reads in the text. Unknown keys show as "key?" and are
 * reported in `missing`.
 */
export function formatCitation(
  cluster: Cluster,
  f: Formatted,
  style: CitationStyle,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const parts = cluster.items.map((it) => {
    const hit = f.byKey.get(it.key);
    if (!hit) {
      missing.push(it.key);
      return [it.prefix, `${it.key}?`, it.suffix].filter(Boolean).join(" ");
    }
    if (style === "numeric") {
      const ref = `[${String(hit.number)}${it.suffix ? `, ${locator(it.suffix)}` : ""}]`;
      return cluster.narrative
        ? `${citedNames(hit.entry, "and")} ${ref}`
        : [it.prefix, ref].filter(Boolean).join(" ");
    }
    const loc = it.suffix ? `, ${locator(it.suffix)}` : "";
    if (cluster.narrative)
      return `${citedNames(hit.entry, "and")} (${hit.year}${loc})`;
    const who = it.suppressAuthor ? "" : `${citedNames(hit.entry, "&")}, `;
    return [it.prefix, `${who}${hit.year}${loc}`].filter(Boolean).join(" ");
  });
  if (style === "numeric" || cluster.narrative)
    return { text: parts.join(", "), missing };
  return { text: `(${parts.join("; ")})`, missing };
}

/* --- Author-date (APA 7-like) --- */

function apaNames(names: Name[]): string {
  const list = real(names).map((n) =>
    n.given ? `${n.family}, ${initials(n.given, true)}` : n.family,
  );
  if (others(names)) list.push("et al.");
  if (list.length <= 1) return list[0] ?? "";
  if (others(names)) return list.join(", ");
  return `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1] ?? ""}`;
}

function apaEditors(names: Name[]): string {
  const list = real(names).map((n) =>
    n.given ? `${initials(n.given, true)} ${n.family}` : n.family,
  );
  const joined =
    list.length <= 2
      ? list.join(" & ")
      : `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1] ?? ""}`;
  return `${joined} (${list.length > 1 ? "Eds." : "Ed."})`;
}

function link(e: BibEntry): Run[] {
  if (e.fields.doi) {
    const doi = e.fields.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    return [
      { text: " " },
      { text: `https://doi.org/${doi}`, link: `https://doi.org/${doi}` },
    ];
  }
  if (e.fields.url)
    return [{ text: " " }, { text: e.fields.url, link: e.fields.url }];
  return [];
}

function apa(e: BibEntry, yr: string): Run[] {
  const f = e.fields;
  const who = e.authors.length
    ? apaNames(e.authors)
    : e.editors.length
      ? `${apaNames(e.editors)} (${e.editors.length > 1 ? "Eds." : "Ed."})`
      : "";
  const runs: Run[] = [];
  const title = f.title ?? e.key;
  if (who) runs.push({ text: `${sentence(who)} (${yr}). ` });
  else runs.push({ text: "" });
  const head = (italic: boolean, extra = ""): void => {
    if (!who) {
      runs.push({ text: title, em: italic }, { text: `${extra} (${yr}). ` });
    } else {
      runs.push({ text: title, em: italic });
      runs.push({
        text: extra ? `${extra}. ` : /[.?!]$/.test(title) ? " " : ". ",
      });
    }
  };
  const ed = f.edition
    ? ` (${f.edition.replace(/\s*ed(ition)?\.?$/i, "")} ed.)`
    : "";
  switch (e.type) {
    case "article": {
      head(false);
      if (f.journal) {
        runs.push({ text: f.journal, em: true });
        if (f.volume) runs.push({ text: ", " }, { text: f.volume, em: true });
        if (f.number) runs.push({ text: `(${f.number})` });
        if (f.pages) runs.push({ text: `, ${pages(f.pages)}` });
        runs.push({ text: "." });
      }
      break;
    }
    case "book":
    case "manual": {
      head(true, ed);
      if (f.publisher ?? f.organization)
        runs.push({ text: sentence(f.publisher ?? f.organization ?? "") });
      break;
    }
    case "incollection":
    case "inproceedings":
    case "conference":
    case "inbook": {
      head(false);
      const book = f.booktitle ?? f.title;
      runs.push({ text: "In " });
      if (e.editors.length) runs.push({ text: `${apaEditors(e.editors)}, ` });
      runs.push({ text: book ?? "", em: true });
      runs.push({ text: f.pages ? ` (pp. ${pages(f.pages)}). ` : ". " });
      if (f.publisher) runs.push({ text: sentence(f.publisher) });
      break;
    }
    case "phdthesis":
    case "mastersthesis":
    case "thesis": {
      const kind =
        e.type === "mastersthesis"
          ? "Master's thesis"
          : "Doctoral dissertation";
      head(true, ` [${kind}${f.school ? `, ${f.school}` : ""}]`);
      break;
    }
    case "techreport":
    case "report": {
      head(true, f.number ? ` (Report No. ${f.number})` : "");
      if (f.institution) runs.push({ text: sentence(f.institution) });
      break;
    }
    default: {
      head(true);
      const where = f.howpublished ?? f.publisher ?? f.organization;
      if (where && !/^\\?url/i.test(where))
        runs.push({ text: sentence(where) });
    }
  }
  runs.push(...link(e));
  return runs.filter((r) => r.text !== "");
}

/* --- Numeric (IEEE-like) --- */

function ieeeNames(names: Name[]): string {
  const list = real(names).map((n) =>
    n.given ? `${initials(n.given, true)} ${n.family}` : n.family,
  );
  if (others(names) || list.length > 6) return `${list[0] ?? ""} et al.`;
  if (list.length <= 2) return list.join(" and ");
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1] ?? ""}`;
}

function ieee(e: BibEntry): Run[] {
  const f = e.fields;
  const who = ieeeNames(e.authors.length ? e.authors : e.editors);
  const runs: Run[] = [];
  if (who)
    runs.push({
      text: `${who}${e.authors.length ? "" : e.editors.length > 1 ? ", Eds." : ", Ed."}, `,
    });
  const quoted = (t: string): void => {
    runs.push({ text: `“${t.replace(/[.,]$/, "")},” ` });
  };
  const title = f.title ?? e.key;
  const yr = f.year ?? "n.d.";
  const tail: string[] = [];
  switch (e.type) {
    case "article":
      quoted(title);
      if (f.journal) runs.push({ text: f.journal, em: true });
      if (f.volume) tail.push(`vol. ${f.volume}`);
      if (f.number) tail.push(`no. ${f.number}`);
      if (f.pages) tail.push(`pp. ${pages(f.pages)}`);
      tail.push(yr);
      runs.push({ text: `${f.journal ? ", " : ""}${tail.join(", ")}` });
      break;
    case "book":
    case "manual":
      runs.push({ text: title, em: true });
      if (f.edition)
        runs.push({
          text: `, ${f.edition.replace(/\s*ed(ition)?\.?$/i, "")} ed`,
        });
      runs.push({
        text: `. ${[f.address, f.publisher ?? f.organization].filter(Boolean).join(": ")}${(f.publisher ?? f.organization ?? f.address) ? ", " : ""}${yr}`,
      });
      break;
    case "incollection":
    case "inproceedings":
    case "conference":
    case "inbook":
      quoted(title);
      runs.push({ text: "in " }, { text: f.booktitle ?? "", em: true });
      if (e.editors.length && e.authors.length)
        runs.push({
          text: `, ${ieeeNames(e.editors)}, Ed${e.editors.length > 1 ? "s" : ""}.`,
        });
      tail.push(
        ...[f.address, f.publisher].filter((x): x is string => !!x),
        yr,
      );
      if (f.pages) tail.push(`pp. ${pages(f.pages)}`);
      runs.push({ text: `, ${tail.join(", ")}` });
      break;
    case "phdthesis":
    case "mastersthesis":
    case "thesis":
      quoted(title);
      runs.push({
        text: `${e.type === "mastersthesis" ? "M.S. thesis" : "Ph.D. dissertation"}${f.school ? `, ${f.school}` : ""}, ${yr}`,
      });
      break;
    case "techreport":
    case "report":
      quoted(title);
      runs.push({
        text: `${[f.institution, f.number ? `Rep. ${f.number}` : "", yr].filter(Boolean).join(", ")}`,
      });
      break;
    default:
      quoted(title);
      runs.push({
        text: [
          f.howpublished && !/url/i.test(f.howpublished) ? f.howpublished : "",
          yr,
        ]
          .filter(Boolean)
          .join(", "),
      });
  }
  if (f.doi) {
    const doi = f.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    runs.push(
      { text: ", doi: " },
      { text: doi, link: `https://doi.org/${doi}` },
      { text: "." },
    );
  } else if (f.url) {
    runs.push(
      { text: ". [Online]. Available: " },
      { text: f.url, link: f.url },
    );
  } else {
    runs.push({ text: "." });
  }
  return runs.filter((r) => r.text !== "");
}

/** A formatted entry as plain text (tooltips, tests). */
export function runsText(runs: Run[]): string {
  return runs.map((r) => r.text).join("");
}
