# ADR-0014: Strudel for musical code blocks

Date: 2026-11-14

Status: accepted

## Context

Folio's code blocks (``` fences, spec: docs/specs/code-blocks.md) are
inert text. Documents have no way to carry rhythm, and the inspector
contract (docs/specs/figure-inspectors.md) has no audio figure.
[Strudel](https://strudel.cc) is an open source live-coding language
(TidalCycles lineage) that runs in the browser via Web Audio.

ADR-0007 requires a dependency note for every new dependency, and
explicitly flags AGPL as a known license risk. `@strudel/web` is
**AGPL-3.0-or-later**.

## Decision

Add `@strudel/web` (AGPL-3.0-or-later, actively maintained by the
Strudel core team on codeberg, the reference browser bundle for the
language) as a runtime dependency:

- **License:** AGPL-3.0-or-later. This is a deliberate, flagged
  exception to ADR-0007's AGPL caution, accepted because (a) folio
  is MIT but not yet distributing a compiled combined work on a
  network-hosted basis - the AGPL network-copyleft triggers on
  distribution of a combined work, and the folio component embeds
  the library; (b) the AGPL section applies to the player feature,
  not to user documents, which are plain Markdown. If folio is
  later distributed or hosted as a combined work, the distribution
  terms must be revisited: the combined work would fall under
  AGPL's section 13 obligations for that bundle. Revisit at first
  non-OSS distribution, or replace with a permissively licensed
  pattern engine.
- **Why not existing deps:** no existing dependency makes sound.
  Mermaid, KaTeX and Jexl cover diagrams, math, and table formulas;
  audio live coding is out of their scope, and writing a Tidal-
  class pattern language from scratch is unmaintainable.
- **Offline rendering (ADR-0005):** bundled, never fetched. Loaded
  via dynamic import only when a document actually contains a
  strudel block - documents without one pay nothing, matching the
  Mermaid (ADR-0010) and KaTeX (ADR-0011) pattern.
- **Engine stays UI-free (ADR-0001):** a strudel block is the
  existing fenced code block with `lang: "strudel"` - no model
  change, no parser change, no golden-file impact. All playback
  lives in the component.

## Consequences

- ```strudel fences round-trip losslessly like any fence.
- Strudel blocks render as code blocks whose code header (the ONE
  inspector contract) carries a player: play / stop / error line.
  The source edits in place like any code block (amended by
  ADR-0015's code header; originally a source textarea).
- Playback requires a user gesture (autoplay policy); the play
  button is that gesture. Default sample banks are NOT fetched -
  the player runs on synthesized sound only, keeping documents
  offline-clean.
- The AGPL status of any combined distribution is tracked in this
  ADR and must be settled before the first binary/hosted release
  that bundles it.
