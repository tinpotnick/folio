# In-app help

## Status: accepted (2026-10-18)

## Decision

Help is a folio document, not a separate help system. The host page
ships `demo/help.md` (plain semantic Markdown, offline-renderable per
ADR-0003) and renders it through the same `<folio-doc>` component
(ADR-0006). No new render path, no new dependency (ADR-0007).

## Contract

- Host: a `? Help` toolbar button and a native `<dialog
  id="help-modal">` overlay containing `<folio-doc src="/demo/help.md">`.
- Shortcuts: `?` and `F1` open help when the user is not typing;
  `Esc` closes it (native dialog behavior). The typing guard pierces
  the component's shadow root so editing the document never triggers
  help.
- Help is read-only in intent: it is a separate component instance;
  toolbar actions and edits target the user's document, not help.
- The help content itself stays plain semantic Markdown — it is not
  a channel for styling or behavior (AGENTS.md non-negotiables).

## Acceptance

- `just lint`, `just test`, `just build` green; e2e in
  `tests/e2e/app.spec.ts` ("in-app help") covers open/close, the
  rendered help document, Esc, and the shortcut-with-typing-guard.
- First-contact eval: `evals/in-app-help-first-contact.md`.
