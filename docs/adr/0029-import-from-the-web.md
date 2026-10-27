# ADR-0029: Importing data from the web - a snapshot, fetched by the desktop app

Date: 2026-10-27

Status: accepted

## Context

Personal finance, research and reporting documents use public data:
interest rates, inflation, house prices, share indices. A spreadsheet's
answer (GOOGLEFINANCE) re-fetches on every open, from data the
spreadsheet vendor licenses. That breaks ADR-0005: a folio document
must render offline and say the same thing next year. It also hides
where the numbers came from.

Two practical facts shaped the design (both checked 2026-10-27):

- The open-data publishers - Bank of England, ONS's CSV, HM Land
  Registry, FRED - send no CORS headers, so a web page cannot read
  their data with `fetch`. Some sources do (ONS's JSON, OECD, ECB,
  Eurostat).
- Market prices (FTSE 100 levels, tracker funds) are licensed data:
  free sources are personal-use only, and redistribution is
  forbidden. Open, shareable data is mostly macroeconomic
  (docs/research/open-data-licences.md).

## Decision

- **A web import is a snapshot plus metadata**, like a file import:
  the rows go into the document; `import:` records the address,
  `retrieved:` the date, `cite:` the bibliography key of a generated
  BibTeX `@misc` entry (publisher, title, URL, `urldate`, licence). The
  data is cited in the document's style like any source. Nothing
  re-fetches by itself; a later Refresh command may, when asked.
- **The desktop app fetches** through a Rust command (`fetch_url`):
  http/https only, GET, no cookies, 30 s, 20 MB, an honest user agent
  with a contact address. It uses the `reqwest` that Tauri already
  links, with its `native-tls` feature: the system's TLS (OpenSSL on
  Linux, the platform's own on macOS and Windows), so no new crate
  family and the system's certificate store. (`reqwest` 0.13: Apache
  2.0 / MIT; `native-tls`, `hyper-tls`, `openssl`: Apache 2.0 / MIT.)
  Cargo.lock gains `native-tls`, `hyper-tls`, `tokio-native-tls`,
  `openssl`/`openssl-sys` and their small dependencies; the Flatpak's
  cargo sources are regenerated, and the GNOME runtime provides
  OpenSSL.
- **The web version** tries the page's own fetch (it works where the
  publisher allows CORS). When refused, it says so and offers the
  honest route: open the address, download the file, choose it - the
  address is still recorded as the source. No fetch proxy: folio has
  no server, and a public proxy would see every user's requests.
- **Licences are shown before import**: known publishers carry the
  licence their terms state (OGL v3, CC BY 4.0) and any notice;
  anything else reads "Licence unknown - check the publisher's terms
  before sharing". folio does not judge the user's use; it makes the
  terms visible where the decision is made.

## Consequences

- Documents keep working offline, and their data is cited with its
  retrieval date - the reproducibility a re-fetching spreadsheet
  lacks.
- In a browser, importing from most open-data sites is two steps
  (download, choose). The desktop app is one.
- Known sources (decided 2026-10-27): the Open data tab lists only
  publishers that need no key and whose terms let a document holding
  their data be shared with credit - Bank of England, ONS, OECD, HM
  Land Registry, ECB, Eurostat, and FRED with its per-series notice.
  Keyed market-data providers (Alpha Vantage, Twelve Data, ...) are
  out for now: they would need a key store, and their terms forbid
  sharing. Data under such terms - a price history downloaded by the
  user - comes in From a file, marked "personal use only": recorded in
  the source (`licence: "personal-use"`), shown on the table and its
  charts, noted in the reference, and recalled on Print and Export.
  folio makes the terms visible; the user, who agreed to them,
  decides.
