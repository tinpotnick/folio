# folio's own package repositories

## Status: accepted (2026-10-25)

## Decision

Until folio meets Flathub's requirements (development history; and
its manifest and submission must be written without AI assistance -
see docs.flathub.org "Requirements"), folio runs its own signed
repositories on GitHub Pages, so Linux users install it once and get
updates through their system:

| | Where | Users add |
| --- | --- | --- |
| Flatpak | `/repo/flatpak/` (OSTree, archive-z2) | `folio.flatpakrepo`, or one click on `io.github.tinpotnick.folio.flatpakref` |
| dnf (Fedora, RHEL, openSUSE) | `/repo/rpm/` (createrepo_c) | `folio.repo` |
| apt (Debian, Ubuntu) | `/repo/apt/` (`stable main`, amd64) | `folio-archive-keyring.gpg` + `folio.list` |

All under https://tinpotnick.github.io/folio/repo/.

## Signing

- One repository key (RSA 4096, no passphrase - CI signs unattended):
  fingerprint `6F8266DF93E25A83AD43E40B089C758D9CB4E587`. The public
  key is `packaging/repo/folio-archive-key.asc` (published as
  `folio-archive-key.asc`, and binary as `folio-archive-keyring.gpg`);
  the private key is the `PKG_GPG_PRIVATE_KEY` Actions secret, its
  fingerprint `PKG_GPG_FINGERPRINT`.
- Flatpak: commits and the summary are signed; the .flatpakrepo and
  .flatpakref carry the key. RPM: each package is signed (`gpgcheck`)
  and so is `repomd.xml` (`repo_gpgcheck`). APT: `InRelease` and
  `Release.gpg`.
- Rotating the key: generate a new one, replace both secrets and the
  public key file, republish; users re-import the key (the README's
  commands do).

## How it is built

- `.github/workflows/packages.yml` runs when a release is **published**
  (not on the tag: the draft's installers are attached by then). It
  downloads the release's `.rpm`, `.deb` and `folio.flatpak` - taking
  the Flatpak bundle from the flatpak workflow's run on the tag, and
  attaching it to the release - and runs `packaging/repo/publish.sh`.
- `publish.sh` updates the repositories in place (recreating the
  empty directories OSTree needs, which git does not keep): Flatpak imports the
  bundle and prunes to the last 5 commits (with static deltas); RPM and
  APT add the new package beside the old ones.
- The result is force-pushed as one commit to the `pkg-repo` branch
  (the repositories keep the versions they need; git keeps no history
  of them), then the Pages workflow is dispatched. Pages builds the
  web app and copies `pkg-repo` into `dist/repo/`.
- A pull request touching this runs a dry run from the latest release
  with a throwaway key and keeps the result as an artifact.
- **High-DPI icons:** Flatpak builds the repository's AppStream
  catalogue with the app's `scale="2"` icon entries but copies only the
  64x64 and 128x128 files, so on a 2x display GNOME Software showed no
  icon. `publish.sh` copies the app's `64x64@2` and `128x128@2` icons
  into both catalogue branches, re-signs them, and updates the summary
  with `--no-update-appstream`.
- The `.flatpakref` and `.flatpakrepo` point their `Icon=` at a 256 px
  PNG (`/repo/icon.png`): GNOME Software shows the one-click link's
  app before the repository's AppStream icons are available, and does
  not load an SVG there.
- Republishing a release by hand: Actions → packages → Run workflow,
  with its tag.
