# ADR-0025: Export as PDF

Date: 2026-10-22

Status: accepted

## Context

folio printed to PDF through the print dialog ("Save as PDF"). Users
look for **Export**, and a print dialog is the platform's, differs
on every system, and is not where people expect to make a file. The
desktop app can do better: its webview can print itself straight to
a file with the same print stylesheet.

## Decision

- An **Export ▾** menu in the toolbar's File group, PDF first;
  further formats (HTML, Word) can join the same menu later.
- **Desktop, Linux**: a Rust command `export_pdf` opens a save dialog,
  then runs a WebKitGTK `PrintOperation` to the "Print to File"
  printer with `output-uri` set: no print dialog, A4, the `@page`
  margins. It names `webkit2gtk` 2.0 and `gtk` 0.18 as direct,
  Linux-only dependencies - the same crates (and versions) Tauri
  already links, so the build gains nothing new.
- **Desktop, macOS / Windows**: not built yet (WKWebView `createPDF`,
  WebView2 `PrintToPdf` are the routes); they fall back to the print
  dialog.
- **Web**: the print dialog, with a hint to choose "Save as PDF". A
  JavaScript PDF writer would trade the browser's own typography and
  vector charts for a worse imitation.

## Consequences

- One rendering path for paper and PDF: the print stylesheet. What
  Print shows is what Export writes.
