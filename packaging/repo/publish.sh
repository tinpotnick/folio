#!/usr/bin/env bash
# Build folio's own package repositories (docs/specs/package-repos.md)
# from a release's files, into a static site served at
#   https://tinpotnick.github.io/folio/repo/
#
#   publish.sh <site-dir> <assets-dir> <gpg-fingerprint> <base-url>
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
rpms=("$ASSETS"/*.rpm)
if ((${#rpms[@]})); then
  dir="$SITE/rpm"
  mkdir -p "$dir"
  printf '%%_gpg_name %s\n%%__gpg /usr/bin/gpg\n' "$FPR" > "$HOME/.rpmmacros"
  for r in "${rpms[@]}"; do
    cp "$r" "$dir/"
    rpmsign --addsign "$dir/$(basename "$r")"
  done
  createrepo_c --update "$dir"
  rm -f "$dir/repodata/repomd.xml.asc"
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
