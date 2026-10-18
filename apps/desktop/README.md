# folio desktop (Tauri host)

ADR-0006: our apps are hosts of the `<folio-doc>` web component. This
is the desktop host: a Tauri v2 shell around the same web UI, plus
native Open/Save file commands (Rust side, `src-tauri/src/lib.rs`).

## Prerequisites (Linux)

    # Debian/Ubuntu
    sudo apt install libwebkit2gtk-4.1-dev build-essential \
      libxdo-dev libssl-dev libayatana-appindicator3-dev \
      librsvg2-dev pkg-config

    # Fedora
    sudo dnf install webkit2gtk4.1-devel gcc gcc-c++ \
      libxdo-devel openssl-devel libappindicator-gtk3-devel \
      librsvg2-devel pkgconf-pkg-config

macOS/Windows need only Xcode / Visual Studio (the webview is in-OS).

## Run / build

    npm install
    npm run dev:desktop    # opens the folio window with dev tools
    npm run build:desktop  # bundles into apps/desktop/src-tauri/target

## Notes

- The web demo page is the same artifact used in the browser; the
  Open/Save buttons only appear when running under Tauri
  (`__TAURI_INTERNALS__` detection in `src/desktop.ts`).
- On plain web the page degrades to the Download .md affordance.
