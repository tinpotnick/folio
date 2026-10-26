# Releases: desktop builds for Windows, macOS and Linux

## Status: accepted (2026-10-22)

## Decision

folio's desktop app is released as installers attached to a GitHub
Release, built by `.github/workflows/release.yml`:

| Platform | Built on | Files |
| --- | --- | --- |
| Windows | windows-latest | `.msi`, `-setup.exe` (NSIS) |
| macOS (Apple silicon + Intel) | macos-latest, `universal-apple-darwin` | `.dmg` |
| Linux (store) | Flathub's build image | Flatpak (`io.github.tinpotnick.folio`), built from source, offline; the `folio.flatpak` bundle is attached to each release |
| Linux | ubuntu-22.04 (the oldest supported, so the AppImage runs widely) | `.rpm` (Fedora, openSUSE), `.deb` (Ubuntu, Debian), `.AppImage` |

## How to release

1. Set the version in `package.json`, `apps/desktop/src-tauri/tauri.conf.json`
   and `apps/desktop/src-tauri/Cargo.toml` (they must agree).
2. Tag and push: `git tag v0.1.0 && git push origin v0.1.0`.
3. The workflow builds all three platforms and attaches the installers
   to a **draft** release named "folio v0.1.0". Check it, edit the
   notes, then **Publish**.

A pull request that touches the desktop app or the workflow builds
every platform as a check; the installers are kept as workflow
artifacts for 14 days, with no release.

## Package repositories

Publishing a release also adds it to folio's own signed Flatpak, dnf
and apt repositories on GitHub Pages: docs/specs/package-repos.md.

## Identity

- App id: `io.github.tinpotnick.folio` - the reverse-DNS form Flathub
  accepts for a GitHub-hosted project. It names the app's data folder
  (drafts, settings, the last-used folder), so it must not change
  after the first release.
- Icon (2026-10-26): Markdown's `#` whose second upright rises like a
  bar in a chart, on a paper tile (`#f4efe4`), in ink (`#1d1c1a`) and
  folio's vermilion (`#ef5b33`). `docs/media/icon.svg` is the mark;
  `icon-small.svg` is its 16-32 px cut (heavier strokes, fuller tile),
  used for the favicon (`public/favicon.svg`) and `32x32.png`. Every
  platform size: `npx tauri icon docs/media/icon-1024.png -o
  apps/desktop/src-tauri/icons` (remove the android/ios sets), then
  32x32.png from `icon-small-1024.png`.
- Wordmark: the mark beside "folio" in EB Garamond italic (600) - the
  toolbar (`#btn-home`), the README header
  (`docs/media/wordmark-{light,dark}.png`) and the social card
  (`docs/media/social.png`).
- Bundle metadata (category, descriptions, publisher, licence) is in
  `tauri.conf.json` → `bundle`.

## Not yet

- **Code signing.** The builds are unsigned: macOS asks the user to
  right-click → Open the first time, and Windows SmartScreen may warn.
  The release notes say so. Signing needs an Apple Developer account
  (about $99/year, plus notarisation in the workflow) and a Windows
  code-signing certificate; worth doing once there are users.
- **Flathub**: the Flatpak is built (packaging/flatpak/, CI
  `.github/workflows/flatpak.yml`); submitting it is a pull request
  to `flathub/flathub` once a release contains the packaging - the
  steps are in `packaging/flatpak/README.md`.
- **Auto-update** (Tauri's updater, signed update manifests).
