# Save-time conflict detection (external changes to the file)

## Status: proposed (2026-11-20) - spec only, no implementation yet

## Decision

Before overwriting a file the document was loaded from, folio checks
whether the file changed on disk since the last load or save; if it
has, folio merges instead of clobbering. This is the first step
toward collaboration without any comms infrastructure: it covers two
people opening the same `.md` from a synced folder (Google Drive,
Dropbox, OneDrive file stream), a LAN share, or any path the host can
stat and read. Live co-editing (CRDT over a channel) is a separate,
later piece.

## Mechanisms this builds on (all battle-tested)

- **Conditional writes**: HTTP `If-Match`/ETag rejecting stale writes
  with 412 (RFC 9110), as used by WebDAV servers (RFC 4918). Where the
  host source supports a conditional write, use it; synced folders
  cannot enforce it, so folio also detects client-side.
- **Version tokens / content hash**: compare `version`/`md5Checksum`
  (Drive-style APIs) or a SHA-256 of the bytes (git-style) before
  writing. Authoritative, immune to clock skew and timestamp
  granularity on SMB/NFS.
- **stat quick check**: mtime + size first (cheap); hash whenever
  stat differs or is unavailable. Never trust stat alone on network
  shares.
- **Three-way line merge**: diff3 / `git merge-file` semantics on the
  canonical markdown, base = last synced version. Decades of testing
  on text; conflict hunks surface instead of silently picking a side.
- **Locks rejected as the primary mechanism**: WebDAV `LOCK`, SMB
  oplocks and lock files do not propagate through synced folders, so
  they would give false confidence. Detection + merge is the contract.
- **Editor UX precedent**: the "file changed on disk" prompt of VS
  Code / vim `:checktime` - ask, never silently reload or overwrite.

## Contract

- **Source abstraction:** the host file source exposes `stat()` ->
  `{mtimeMs, size, hash?}` and `read()`. Desktop: Tauri fs on the
  opened path (`src/desktop.ts`). Web File System Access:
  `handle.getFile()` gives `lastModified`/`size`; the hash comes from
  reading the handle. Web download-only (no File System Access,
  Firefox/Safari): there is no source to check - behavior unchanged.
- **State kept by folio:** at every load and every successful save,
  record `syncedStat` and `base` = the canonical markdown as of that
  moment (the same canonicalization as prettify-on-save,
  docs/specs/web-files.md).
- **On Save:** re-stat the source.
  - Unchanged (stat equal, or hash equal when computed) -> write as
    today.
  - Changed -> read the new bytes, canonicalize (parse + serialize;
    unparseable new content is treated as plain text), then three-way
    merge base / ours (current document) / theirs (new file).
    - **Clean merge** -> the merged document becomes current, the save
      proceeds, and the flash says "Merged changes from outside, saved
      <name>". A clean merge never blocks the save.
    - **Conflicts** -> a modal (`#save-conflict-modal`) lists each
      conflicting hunk with ours/theirs; the user picks per hunk or
      edits the merged result, then Save completes. Alternatives in
      the same modal: **Overwrite** (explicitly discards the outside
      changes - the only path that loses their data, and it requires
      this deliberate click) and **Cancel** (stays put, nothing
      written).
- **File deleted on disk:** prompt "<name> no longer exists on disk -
  Save as a new file?"; Save-as path, nothing is lost.
- **File unreadable** (permissions, sync conflict copy): fall through
  to the Save-as path with a flash naming the problem.
- **Merge scope:** line-based on canonical markdown. Two-sided edits
  to the same table rows surface as conflict hunks; a semantic
  cell-level table merge is explicitly deferred to the live-editing
  work and is NOT attempted here.
- **Invariant:** a save never overwrites external changes without
  either a clean merge or the explicit Overwrite choice. Unsaved local
  edits are never discarded by this mechanism (the unsaved-changes
  dialog, docs/specs/unsaved-changes.md, still guards replacement).

## Out of scope (deliberately)

- **Watching the file while it is open** (fs.watch / polling, "changed
  on disk" prompt mid-session) is a separate, later spec. It has a hard
  interaction with unsaved local edits - an external change arriving
  while the user is mid-edit needs a merge-or-keep-mine decision that
  must not fire under the caret - so it gets its own design rather than
  riding along here. This spec covers save-time detection only.
- Live co-editing over a channel (CRDT) - see the discussion in
  docs/specs/comments.md; also later.

## Acceptance

- e2e (`tests/e2e/save-conflicts.spec.ts`), driving a real file on
  disk: external edit between load and save with a clean merge (auto
  applied + flash); a conflicting edit (modal, per-hunk choice, save
  completes); Overwrite (theirs gone, ours written); Cancel (file on
  disk untouched); deleted file (save-as prompt); stat-equal fast path
  writes without reading.
- WebKitGTK: `tests/webkitgtk/save-conflicts.js` native case for the
  conflict modal (focus and Esc).
- Golden files unaffected (no format change).
- First-contact eval: `evals/save-conflicts-first-contact.md` - open a
  file, modify it externally, save in folio, resolve the conflict
  using only visible affordances.
