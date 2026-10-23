# folio as a Flatpak

`io.github.tinpotnick.folio.yml` builds folio from source, offline,
on the GNOME 51 runtime, with the npm packages and Rust crates listed
in `node-sources.json` and `cargo-sources.json`.

## Build and run it locally

One-time: the builder and the SDKs (user installs, no sudo).

```bash
flatpak install --user flathub org.flatpak.Builder org.gnome.Sdk//51 \
  org.gnome.Platform//51 \
  org.freedesktop.Sdk.Extension.rust-stable//26.08 \
  org.freedesktop.Sdk.Extension.node24//26.08
```

Then, from the repository root:

```bash
flatpak run org.flatpak.Builder --user --install --force-clean \
  --state-dir=packaging/flatpak/.flatpak-builder \
  packaging/flatpak/build packaging/flatpak/io.github.tinpotnick.folio.yml
flatpak run io.github.tinpotnick.folio
```

CI builds the same thing on every change to the desktop app or this
folder (`.github/workflows/flatpak.yml`) and keeps a `folio.flatpak`
bundle as an artifact.

## When the lockfiles change

Regenerate the offline source lists with
[flatpak-builder-tools](https://github.com/flatpak/flatpak-builder-tools):

```bash
python3 flatpak-builder-tools/cargo/flatpak-cargo-generator.py \
  apps/desktop/src-tauri/Cargo.lock -o packaging/flatpak/cargo-sources.json
flatpak-node-generator npm package-lock.json \
  -o packaging/flatpak/node-sources.json
```

## Lint (what Flathub checks)

```bash
flatpak run --command=flatpak-builder-lint org.flatpak.Builder \
  manifest packaging/flatpak/io.github.tinpotnick.folio.yml
flatpak run --command=flatpak-builder-lint org.flatpak.Builder \
  appstream packaging/linux/io.github.tinpotnick.folio.metainfo.xml
```

## Submitting to Flathub

1. Release a version that contains this folder (v0.1.0 predates it, so
   the first Flathub version is the next tag).
2. Fork https://github.com/flathub/flathub and branch from
   `new-pr`.
3. Add `io.github.tinpotnick.folio.yml` - this manifest with its local
   `type: dir` source replaced by the release:

   ```yaml
   - type: git
     url: https://github.com/tinpotnick/folio.git
     tag: v0.1.1
     commit: <the tag's full commit hash>
   ```

   - plus `node-sources.json` and `cargo-sources.json` beside it.
4. Open the pull request against `new-pr`. Flathub's bot builds it;
   reviewers comment there. Once merged, Flathub creates
   `flathub/io.github.tinpotnick.folio`, and each later release is a
   pull request there updating the tag and commit (and the source
   lists).
5. Verify the app id: Flathub checks `io.github.tinpotnick` against
   the GitHub account - follow the verification link in the Flathub
   developer portal.

## Sandbox

- Display (Wayland, X11 fallback), GPU, sound (play and record).
- Network: only for the Strudel player add-on and online sample banks,
  both by the user's consent.
- Files: through the desktop's file-chooser portal only (the
  `flatpak` Cargo feature switches the dialogs to it), so no
  filesystem permission is requested.
