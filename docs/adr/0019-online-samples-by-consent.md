# ADR-0019: Online sample banks, by consent

Date: 2026-10-21

Status: accepted (an explicit exception to ADR-0005 and ADR-0016)

## Context

folio's documents render fully offline (ADR-0005), and its Strudel
blocks play from bundled sounds only (ADR-0014, ADR-0016). But many
strudel.cc examples load their own sample banks from the internet,
such as "Amensister": `samples('github:tidalcycles/dirt-samples')`.
folio silently passed those calls through: online, they downloaded
without a word; offline, the sounds failed silently. Blocking them
outright would leave much of the Strudel ecosystem half-silent.

## Decision

A pattern MAY download its own sample banks, but only after the
user confirms, with a warning:

- Before evaluating, folio finds the pattern's internet sources:
  `samples(...)` string arguments starting `github:`, `http(s)://`
  or `shabda:`, ignoring comments (`src/audio/online-samples.ts`).
- If any are not yet allowed, Play shows a warning row in the
  block's header. It names the sources, says the pattern needs a
  connection and contacts an outside server, and offers **Download
  and play** or **Play without them**.
- Consent is per source, for the session (until the app or page
  reloads); it is never stored in the document.
- **Play without them** evaluates with `samples()` as a no-op:
  nothing is fetched, and the rest of the pattern plays.
- An allowed download that FAILS (offline, server down) is reported
  in the header, and the rest still plays.

## Consequences

- Rendering stays offline: this concerns only pressing Play on a
  pattern that asks for internet sounds, and only after consent.
- folio itself still loads no sample banks (ADR-0016 stands).
- Documents can carry strudel.cc examples as written (the shipped
  "Amensister" example does).
