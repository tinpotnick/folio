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
| dnf (Fedora, RHEL, openSUSE) | `/repo/rpm/` metadata (createrepo_c); packages from the release | `folio.repo` |
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
- Before anything is published, the workflow adds the new repository to
  a **system** Flatpak installation and pulls its catalogue - what GNOME
  Software does for most users.
- A pull request touching this runs a dry run from the latest release
  with a throwaway key and keeps the result as an artifact.
- **High-DPI icons:** Flatpak builds the repository's AppStream
  catalogue with the app's `scale="2"` icon entries but copies only the
  64x64 and 128x128 files, so on a 2x display GNOME Software showed no
  icon. `publish.sh` copies the app's `64x64@2` and `128x128@2` icons
  into both catalogue branches (committed root-owned with canonical
  permissions, as Flatpak commits everything - OSTree checksums include
  ownership, and a system installation rejected the CI runner's uid),
  re-signs them, and updates the summary
  with `--no-update-appstream`.
- The `.flatpakref` and `.flatpakrepo` point their `Icon=` at a 256 px
  PNG (`/repo/icon.png`): GNOME Software shows the one-click link's
  app before the repository's AppStream icons are available, and does
  not load an SVG there.
- Republishing a release by hand: Actions → packages → Run workflow,
  with its tag.

## Counting downloads (2026-10-26)

GitHub Pages keeps no logs, so installs from folio's repositories are
invisible - except Fedora's, by design:

- **dnf installs count.** The dnf metadata lists the release's own
  `.rpm` (`createrepo_c --baseurl https://github.com/tinpotnick/folio/releases/download/<tag>/`),
  so every `dnf install` / `upgrade` is a download of the release file.
  The repository therefore holds the latest release only.
- For that, the release carries the **signed** `.rpm`: the packages
  workflow signs it once and replaces the release's unsigned copy,
  labelled "<name> (signed)". A later publish of the same tag finds the
  label and reuses that file (signing again would change its bytes and
  its checksum).
- **The workflow does not count itself:** it takes the `.rpm`, `.deb`
  and Flatpak bundle from the tag's build artifacts (the release
  workflow keeps them on tags too), falling back to the release only
  when those have expired.
- Not counted: Flatpak and apt installs from the repositories (their
  formats cannot point at files elsewhere). Flathub, later, publishes
  install statistics. folio itself never reports home.
- `just stats` (`scripts/stats.sh`): release downloads per file, 14-day
  traffic and referrers, stars.
