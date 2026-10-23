# ADR-0026: MIT licence; the Strudel player becomes an add-on

Date: 2026-10-22

Status: accepted (supersedes the licence section of ADR-0014)

## Context

folio is released under the MIT licence. Every bundled dependency is
permissive or weak-copyleft (MPL, EPL) except Strudel
(`@strudel/web` and its packages), which is AGPL-3.0-or-later.
ADR-0014 accepted that for an unpublished project and said to revisit
it at first distribution. A build that bundles Strudel is, as a
whole, an AGPL work - "MIT" would need an asterisk on every download
and on the hosted web version.

## Decision

- folio is **MIT** (`LICENSE`); third-party licences are listed in
  `THIRD_PARTY_NOTICES.md`.
- **Builds do not contain Strudel.** `@strudel/web` is a dev
  dependency only (tests, and the hash check).
- The **Strudel player is an add-on**: the first Play of a strudel
  block shows what it is (AGPL-3.0, its size) and offers **Install
  and play** / **Not now**. On consent, folio downloads release
  1.3.0's two files from jsDelivr, checks each against a SHA-256
  pinned in `src/audio/strudel-addon.ts` (code that is about to run
  must be exactly the release agreed to), and keeps them in
  IndexedDB, so playback works offline from then on. The kept module
  loads from a blob URL, its clock worker re-pointed at the kept
  copy.
- Everything else about strudel blocks is unchanged: they render,
  edit and round-trip without the add-on; only playing needs it.
- **Music without the add-on** is ABC sheet music (ADR-0023: abcjs,
  MIT, folio's own synth), which becomes the music folio leads with.

## Consequences

- The first Strudel play needs a connection, once. Upgrading Strudel
  means a new version, new hashes, and the pin test updated.
- No maintained, permissively licensed equivalent of Strudel exists
  (Glicol and Gibber are MIT but unmaintained; Tone.js and Elementary
  are libraries, not languages), so the add-on route keeps the
  feature without the licence cost.
