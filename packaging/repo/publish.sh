#!/usr/bin/env bash
# Build folio's own package repositories (docs/specs/package-repos.md)
# from a release's files, into a static site served at
#   https://tinpotnick.github.io/folio/repo/
#
#   publish.sh <site-dir> <assets-dir> <gpg-fingerprint> <base-url> <tag>
#
# <site-dir> holds the repositories so far (updated in place, so
# Flatpak keeps its history for updates); <assets-dir> holds the
# release's folio.flatpak, .rpm and .deb. Everything is signed with
# the repository key. Runs in CI on Ubuntu (flatpak, ostree,
# createrepo-c, rpm, apt-utils).
set -euo pipefail

SITE=$1
ASSETS=$2
FPR=$3
BASE=${4%/}
TAG=$5
RELEASE="https://github.com/tinpotnick/folio/releases/download/$TAG/"
HERE=$(cd "$(dirname "$0")" && pwd)
APP=io.github.tinpotnick.folio

mkdir -p "$SITE"
cp "$HERE/folio-archive-key.asc" "$SITE/folio-archive-key.asc"
gpg --export "$FPR" > "$SITE/folio-archive-keyring.gpg"
KEY_B64=$(base64 -w0 < "$SITE/folio-archive-keyring.gpg")

# --- Flatpak: an OSTree repository, plus .flatpakrepo / .flatpakref -----
shopt -s nullglob
bundles=("$ASSETS"/*.flatpak)
if ((${#bundles[@]})); then
  repo="$SITE/flatpak"
  [ -f "$repo/config" ] || ostree init --repo="$repo" --mode=archive-z2
  # The repository comes back from the pkg-repo branch, and git keeps no
  # empty directories: OSTree needs these to exist ("Listing refs:
  # opendir(refs/remotes)" failed every publish after the first).
  mkdir -p "$repo"/refs/{heads,remotes,mirrors} "$repo"/{objects,tmp,state,extensions}
  for b in "${bundles[@]}"; do
    flatpak build-import-bundle --gpg-sign="$FPR" "$repo" "$b"
  done
  flatpak build-update-repo --gpg-sign="$FPR" --generate-static-deltas \
    --prune --prune-depth=5 --title="folio" --default-branch=master "$repo"

  # High-DPI icons. The catalogue the step above builds lists the app's
  # @2 icons (scale="2"), but Flatpak copies only the 64x64 and 128x128
  # files into it - so on a 2x display GNOME Software found no icon at
  # all, for the one-click link and in search. Copy them in from the app
  # and re-commit the catalogue branches.
  app_ref=$(ostree refs --repo="$repo" | grep "^app/$APP/" | head -1)
  for branch in $(ostree refs --repo="$repo" | grep -E '^appstream2?/'); do
    tree=$(mktemp -d)
    ostree checkout --repo="$repo" --user-mode --union "$branch" "$tree/c"
    for size in 64x64@2 128x128@2; do
      src="/files/share/app-info/icons/flatpak/$size"
      if ostree ls --repo="$repo" "$app_ref" "$src" >/dev/null 2>&1; then
        mkdir -p "$tree/c/icons/$size"
        ostree checkout --repo="$repo" --user-mode --union \
          --subpath="$src" "$app_ref" "$tree/c/icons/$size"
        mkdir -p "$tree/c/icons/flatpak"
        ln -sfn "../$size" "$tree/c/icons/flatpak/$size"
      fi
    done
    # Owned by root with canonical permissions, as Flatpak commits
    # everything: OSTree checksums include ownership, and a system
    # installation (which writes as root) rejected the CI runner's uid
    # as a "Corrupted file object".
    ostree commit --repo="$repo" --branch="$branch" --tree=dir="$tree/c" \
      --owner-uid=0 --owner-gid=0 --canonical-permissions \
      --gpg-sign="$FPR" --skip-if-unchanged \
      --subject="AppStream with high-DPI icons" >/dev/null
    rm -rf "$tree"
  done
  # The summary again, now that the catalogue branches moved (keeping
  # the catalogue as committed above).
  flatpak build-update-repo --gpg-sign="$FPR" --no-update-appstream \
    --generate-static-deltas --title="folio" --default-branch=master "$repo"

  cat > "$SITE/folio.flatpakrepo" <<EOF
[Flatpak Repo]
Title=folio
Url=$BASE/flatpak/
Homepage=https://github.com/tinpotnick/folio
Comment=folio's own Flatpak repository
Description=Documents with live data inside, beautiful by default, saved as plain Markdown.
Icon=$BASE/icon.png
GPGKey=$KEY_B64
EOF
  cat > "$SITE/$APP.flatpakref" <<EOF
[Flatpak Ref]
Name=$APP
Branch=master
Title=folio
IsRuntime=false
Url=$BASE/flatpak/
SuggestRemoteName=folio
RuntimeRepo=https://dl.flathub.org/repo/flathub.flatpakrepo
Homepage=https://github.com/tinpotnick/folio
Icon=$BASE/icon.png
GPGKey=$KEY_B64
EOF
  # A PNG: GNOME Software shows a .flatpakref's Icon before the
  # repository (and its AppStream icons) is added, and it does not
  # load an SVG there - the link showed no icon.
  cp "$HERE/../../apps/desktop/src-tauri/icons/128x128@2x.png" "$SITE/icon.png"
  rm -f "$SITE/icon.svg"
fi

# --- RPM: a dnf repository (signed packages and signed metadata) --------
# The metadata lists the release's own .rpm (xml:base = the release), so
# each dnf install or upgrade is a download of the release file - how
# folio counts Fedora installs. The repository holds the latest release.
rpms=("$ASSETS"/*.rpm)
if ((${#rpms[@]})); then
  dir="$SITE/rpm"
  rm -rf "$dir" "$ASSETS/signed-rpm"
  mkdir -p "$dir" "$ASSETS/signed-rpm"
  printf '%%_gpg_name %s\n%%__gpg /usr/bin/gpg\n' "$FPR" > "$HOME/.rpmmacros"
  for r in "${rpms[@]}"; do
    cp "$r" "$ASSETS/signed-rpm/"
    # Signed once; a release already carrying folio's signed .rpm keeps it.
    [ -f "$ASSETS/.rpm-signed" ] || rpmsign --addsign "$ASSETS/signed-rpm/$(basename "$r")"
  done
  createrepo_c --baseurl "$RELEASE" --outputdir "$dir" "$ASSETS/signed-rpm"
  gpg --batch --yes --local-user "$FPR" --armor --detach-sign \
    --output "$dir/repodata/repomd.xml.asc" "$dir/repodata/repomd.xml"
  cat > "$SITE/folio.repo" <<EOF
[folio]
name=folio
baseurl=$BASE/rpm
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=$BASE/folio-archive-key.asc
EOF
fi

# --- APT: a Debian/Ubuntu repository ("stable main", signed Release) ---
debs=("$ASSETS"/*.deb)
if ((${#debs[@]})); then
  apt="$SITE/apt"
  mkdir -p "$apt/pool/main" "$apt/dists/stable/main/binary-amd64"
  cp "${debs[@]}" "$apt/pool/main/"
  (
    cd "$apt"
    apt-ftparchive packages pool/main > dists/stable/main/binary-amd64/Packages
    gzip -9 -k -f dists/stable/main/binary-amd64/Packages
    apt-ftparchive \
      -o APT::FTPArchive::Release::Origin=folio \
      -o APT::FTPArchive::Release::Label=folio \
      -o APT::FTPArchive::Release::Suite=stable \
      -o APT::FTPArchive::Release::Codename=stable \
      -o APT::FTPArchive::Release::Architectures=amd64 \
      -o APT::FTPArchive::Release::Components=main \
      release dists/stable > dists/stable/Release
    gpg --batch --yes --local-user "$FPR" --clearsign \
      --output dists/stable/InRelease dists/stable/Release
    gpg --batch --yes --local-user "$FPR" --armor --detach-sign \
      --output dists/stable/Release.gpg dists/stable/Release
  )
  echo "deb [signed-by=/etc/apt/keyrings/folio-archive-keyring.gpg] $BASE/apt stable main" \
    > "$SITE/folio.list"
fi

echo "Published to $SITE:"
find "$SITE" -maxdepth 2 -not -path '*/objects*' | sort | head -40
