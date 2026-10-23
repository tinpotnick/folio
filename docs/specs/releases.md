# Releases: desktop builds for Windows, macOS and Linux

## Status: accepted (2026-10-22)

## Decision

folio's desktop app is released as installers attached to a GitHub
Release, built by `.github/workflows/release.yml`:

| Platform | Built on | Files |
| --- | --- | --- |
| Windows | windows-latest | `.msi`, `-setup.exe` (NSIS) |
| macOS (Apple silicon + Intel) | macos-latest, `universal-apple-darwin` | `.dmg` |
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

## Identity

- App id: `io.github.tinpotnick.folio` - the reverse-DNS form Flathub
  accepts for a GitHub-hosted project. It names the app's data folder
  (drafts, settings, the last-used folder), so it must not change
  after the first release.
- Icon: `docs/media/icon.svg` (source) → `icon-1024.png` → every
  platform size via `npx tauri icon docs/media/icon-1024.png -o
  apps/desktop/src-tauri/icons` (then remove the android/ios sets).
  The same SVG is the web version's favicon (`public/favicon.svg`).
- Bundle metadata (category, descriptions, publisher, licence) is in
  `tauri.conf.json` → `bundle`.

## Not yet

- **Code signing.** The builds are unsigned: macOS asks the user to
  right-click → Open the first time, and Windows SmartScreen may warn.
  The release notes say so. Signing needs an Apple Developer account
  (about $99/year, plus notarisation in the workflow) and a Windows
  code-signing certificate; worth doing once there are users.
- **Flathub** (the store Fedora, and most other distributions, show in
  their software centres). The plan:
  1. An AppStream metainfo file (`io.github.tinpotnick.folio.metainfo.xml`):
     name, summary, description, screenshots, release notes,
     content rating.
  2. A Flatpak manifest building from source on the GNOME runtime,
     with npm and Cargo dependencies vendored for an offline build
     (`flatpak-node-generator`, `flatpak-cargo-generator`).
  3. A pull request to `flathub/flathub`; after review the app gets
     its own `flathub/io.github.tinpotnick.folio` repository, which
     is updated for each release.
- **Auto-update** (Tauri's updater, signed update manifests).
