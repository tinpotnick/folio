//! folio desktop host — Tauri v2 (ADR-0006: our apps are hosts of the
//! `<folio-doc>` web component). The web UI is the same demo host page;
//! this shell adds native Open/Save so documents are real local files.
//! No engine logic lives here (ADR-0001): the document stays the
//! single source of truth, read and written as plain Markdown text.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod pdf_furniture;

use std::path::{Path, PathBuf};

use tauri::Manager;
use tauri::webview::{PermissionKind, PermissionResponse};
use tauri_plugin_dialog::DialogExt;

/// The result of a successful open: the file's PATH (the host
/// remembers it so the next dialog starts where the user last
/// was, and Save defaults to the same folder) plus its text.
#[derive(serde::Serialize)]
struct OpenedDocument {
    path: String,
    text: String,
}

/// A document-portal FUSE path (the Flatpak's file chooser hands out
/// /run/user/<uid>/doc/<id>/... and /run/flatpak/doc/...): ephemeral,
/// never a good dialog hint.
fn is_portal_path(p: &Path) -> bool {
    let s = p.to_string_lossy();
    (s.starts_with("/run/user/") && s.contains("/doc/")) || s.starts_with("/run/flatpak/doc/")
}

/// The document portal's FUSE mount exposes the file's real host path
/// in a custom attribute (user.document-portal.host-path); read it so
/// dialogs start in the file's ACTUAL folder, not the random portal
/// dir. None on plain paths and on portals that don't set it.
#[cfg(target_os = "linux")]
fn real_host_path(path: &Path) -> Option<PathBuf> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    extern "C" {
        fn getxattr(
            path: *const std::ffi::c_char,
            name: *const std::ffi::c_char,
            value: *mut std::ffi::c_void,
            size: usize,
        ) -> isize;
    }
    let c_path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let c_name = CString::new("user.document-portal.host-path").ok()?;
    // SAFETY: both CStrings outlive the calls; buf stays valid for its
    // length, and n is re-checked before use.
    let n = unsafe { getxattr(c_path.as_ptr(), c_name.as_ptr(), std::ptr::null_mut(), 0) };
    if n <= 0 {
        return None;
    }
    let mut buf = vec![0u8; n as usize + 1];
    let n = unsafe {
        getxattr(
            c_path.as_ptr(),
            c_name.as_ptr(),
            buf.as_mut_ptr().cast(),
            buf.len(),
        )
    };
    if n <= 0 {
        return None;
    }
    buf.truncate(n as usize);
    let s = String::from_utf8_lossy(&buf)
        .trim_end_matches('\0')
        .to_string();
    let p = PathBuf::from(s);
    p.is_absolute().then_some(p)
}

#[cfg(not(target_os = "linux"))]
fn real_host_path(_path: &Path) -> Option<PathBuf> {
    None
}

/// The path to derive a dialog folder from: a portal path resolves to
/// the real host path when it carries one, else it stays as-is.
fn hint_path(path: &str) -> PathBuf {
    let p = PathBuf::from(path);
    real_host_path(&p).unwrap_or(p)
}

/// The folder a dialog starts in, in order: the open document's
/// folder when it came from disk (portal paths resolve to the real
/// folder); otherwise the last folder the user opened from or saved
/// to; otherwise — the true first run — the folder the DEFAULT
/// document was loaded from (`tauri dev` serves `demo/` straight
/// from the checkout, so the boot doc is a real file even though the
/// host loaded it as a web asset). Folders that no longer exist are
/// skipped.
fn folder_hint(current: Option<&str>, last: Option<&str>, demo: Option<&str>) -> Option<PathBuf> {
    if let Some(cur) = current {
        let p = hint_path(cur);
        if let Some(dir) = p.parent() {
            if dir.is_dir() {
                return Some(dir.to_path_buf());
            }
        }
    }
    for candidate in [last, demo] {
        if let Some(dir) = candidate {
            let p = hint_path(dir);
            if p.is_dir() {
                return Some(p);
            }
        }
    }
    None
}

/// The checkout's `demo/` folder, where the default document lives
/// during `tauri dev` (and on any from-source build). Compiled-in
/// via `CARGO_MANIFEST_DIR`, so it is skipped on machines without
/// the checkout; a bundled release embeds the demo in the binary
/// and has no disk folder to offer.
fn dev_demo_dir() -> Option<PathBuf> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../demo");
    dir.is_dir().then(|| dir)
}

/// `last-folder` in the app's config dir: one line, the folder path.
/// Everything here is best-effort — persistence failure just means
/// the next dialog falls back to the platform default.
fn last_dir_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("last-folder"))
}

fn read_last_dir(app: &tauri::AppHandle) -> Option<String> {
    std::fs::read_to_string(last_dir_file(app)?)
        .ok()
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
}

/// The folder worth remembering for the next dialog: the file's real
/// host folder when the document portal exposes one; never an
/// ephemeral portal dir.
fn dir_to_remember(file: &Path) -> Option<PathBuf> {
    match real_host_path(file) {
        Some(p) => p.parent().map(|d| d.to_path_buf()),
        None if is_portal_path(file) => None,
        None => file.parent().map(|d| d.to_path_buf()),
    }
}

fn remember_dir(app: &tauri::AppHandle, file: &Path) {
    let Some(dir) = dir_to_remember(file) else {
        return;
    };
    let Some(dest) = last_dir_file(app) else {
        return;
    };
    if let Some(parent) = dest.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&dest, dir.to_string_lossy().as_bytes());
}

/// Commands are `async` so Tauri runs them off the main thread, and
/// the dialog plugin's `blocking_*` builders are used to await the
/// pick. Blocking the main thread instead freezes the whole window
/// (the event loop can neither run the dialog nor repaint).
///
/// `current` is the path of the document the host has open: the
/// dialog starts in its folder, or — when no file is open from
/// disk — in the folder of the last file opened or saved.
#[tauri::command]
async fn open_document(
    app: tauri::AppHandle,
    current: Option<String>,
) -> Result<OpenedDocument, String> {
    let hint = folder_hint(
        current.as_deref(),
        read_last_dir(&app).as_deref(),
        dev_demo_dir().as_deref().and_then(|d| d.to_str()),
    );
    let mut dialog = app.dialog().file().add_filter("folio document", &["md"]);
    if let Some(dir) = hint {
        dialog = dialog.set_directory(dir);
    }
    let picked = dialog.blocking_pick_file();
    let path = picked
        .ok_or("cancelled")?
        .into_path()
        .map_err(|e| e.to_string())?;
    remember_dir(&app, &path);
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(OpenedDocument {
        path: path.to_string_lossy().into_owned(),
        text,
    })
}

/// Save any text file the document exports (an STL model, ...): a
/// native save dialog filtered to `extension`, starting in the last
/// used folder.
#[tauri::command]
async fn save_text_file(
    app: tauri::AppHandle,
    text: String,
    suggested: String,
    filter_name: String,
    extension: String,
) -> Result<String, String> {
    let mut dialog = app
        .dialog()
        .file()
        .add_filter(&filter_name, &[extension.as_str()])
        .set_file_name(&suggested);
    if let Some(dir) = read_last_dir(&app) {
        dialog = dialog.set_directory(dir);
    }
    let path = dialog
        .blocking_save_file()
        .ok_or("cancelled")?
        .into_path()
        .map_err(|e| e.to_string())?;
    remember_dir(&app, &path);
    std::fs::write(&path, &text).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// The largest download an import takes (a web import is a snapshot
/// of a dataset, not a file transfer).
const FETCH_MAX_BYTES: usize = 20 * 1024 * 1024;

/// What a web address returned, for "Import data › From the web"
/// (ADR-0029, docs/specs/data-import.md).
#[derive(serde::Serialize)]
struct Fetched {
    text: String,
    content_type: String,
    /// The address after redirects.
    url: String,
}

/// Whether an address may be fetched: plain web addresses only.
fn is_fetchable(url: &str) -> bool {
    reqwest::Url::parse(url)
        .map(|u| matches!(u.scheme(), "http" | "https") && u.host_str().is_some())
        .unwrap_or(false)
}

/// Fetch a public web address for an import. The webview cannot: the
/// publishers of open data (the Bank of England, ONS, FRED) send no
/// CORS headers, so a page's own fetch is refused. GET only, no
/// cookies, 30 s, 20 MB; the answer is text (CSV or JSON).
#[tauri::command]
async fn fetch_url(url: String) -> Result<Fetched, String> {
    if !is_fetchable(&url) {
        return Err("Only web addresses (http:// or https://) can be imported".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        // Who is asking, with a contact address - the convention for
        // automated clients (FRED's edge refuses a bare product name).
        .user_agent(concat!(
            "folio/",
            env!("CARGO_PKG_VERSION"),
            " (+https://github.com/tinpotnick/folio)"
        ))
        .build()
        .map_err(|e| e.to_string())?;
    let mut resp = client.get(&url).send().await.map_err(|e| {
        if e.is_timeout() {
            "The site did not answer within 30 seconds".to_string()
        } else if e.is_connect() {
            "Could not reach the site - check the address and your connection".to_string()
        } else {
            e.to_string()
        }
    })?;
    let status = resp.status();
    if !status.is_success() {
        return Err(format!(
            "The site answered {} {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or("")
        ));
    }
    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let final_url = resp.url().to_string();
    let mut body: Vec<u8> = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        if body.len() + chunk.len() > FETCH_MAX_BYTES {
            return Err("That download is over 20 MB - too large to import".into());
        }
        body.extend_from_slice(&chunk);
    }
    Ok(Fetched {
        text: String::from_utf8_lossy(&body).into_owned(),
        content_type,
        url: final_url,
    })
}

/// `suggested` defaults the file name (the open document's own when
/// it has one), and the dialog starts in its folder — or the last
/// used folder when the document is in-memory only.
#[tauri::command]
async fn save_document(
    app: tauri::AppHandle,
    text: String,
    suggested: String,
    current: Option<String>,
) -> Result<String, String> {
    let mut dialog = app.dialog().file().add_filter("folio document", &["md"]);
    if !suggested.is_empty() {
        let default = Path::new(&suggested);
        if let Some(name) = default.file_name().and_then(|n| n.to_str()) {
            dialog = dialog.set_file_name(name);
        }
    }
    let hint = folder_hint(
        current.as_deref(),
        read_last_dir(&app).as_deref(),
        dev_demo_dir().as_deref().and_then(|d| d.to_str()),
    );
    if let Some(dir) = hint {
        dialog = dialog.set_directory(dir);
    }
    let path = dialog
        .blocking_save_file()
        .ok_or("cancelled")?
        .into_path()
        .map_err(|e| e.to_string())?;
    write_back(&path, &text)?;
    remember_dir(&app, &path);
    Ok(path.to_string_lossy().into_owned())
}

/// Write the document's text verbatim - the Save path once the app
/// knows the file (no dialog; `save_document` above is Save As).
fn write_back(path: &Path, text: &str) -> Result<(), String> {
    std::fs::write(path, text).map_err(|e| e.to_string())
}

/// mtime/size of a file, for the save-time conflict check (spec:
/// docs/specs/save-conflicts.md). None when the file is gone.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FileStat {
    mtime_ms: u64,
    size: u64,
}

/// Save-time conflict check: the open file's stat, so the page can
/// tell an external change (another editor, a synced folder) from
/// its own last write.
#[tauri::command]
async fn stat_document(path: String) -> Result<Option<FileStat>, String> {
    let meta = match std::fs::metadata(Path::new(&path)) {
        Ok(m) => m,
        Err(_) => return Ok(None),
    };
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(Some(FileStat {
        mtime_ms,
        size: meta.len(),
    }))
}

/// Read the open file's current text - the "theirs" of a save-time
/// merge when the file changed on disk since the last load/save.
#[tauri::command]
async fn read_document(path: String) -> Result<String, String> {
    std::fs::read_to_string(Path::new(&path)).map_err(|e| e.to_string())
}

/// Save with no dialog: write straight back to the open document's
/// path. The folder is remembered as the next dialog's hint.
#[tauri::command]
async fn write_document(app: tauri::AppHandle, path: String, text: String) -> Result<(), String> {
    let p = Path::new(&path);
    write_back(p, &text)?;
    remember_dir(&app, p);
    Ok(())
}

/// "Open .md files with folio by default" (command palette; spec:
/// docs/specs/desktop-tauri-host.md, "Open with folio"). What making
/// folio the default takes is per-platform: Linux writes the default
/// with xdg-mime (through `flatpak-spawn --host` inside the Flatpak,
/// whose sandbox cannot write the host's mimeapps.list); macOS asks
/// LaunchServices; Windows reserves default apps for the user in
/// Settings, so there we open Settings and say so. Ok carries the
/// message to flash.
#[tauri::command]
fn set_default_md_handler() -> Result<String, String> {
    set_default_md_handler_impl()
}

/// The desktop entry ids folio is installed under: the Flatpak's
/// reverse-DNS id, the deb/rpm/AppImage product name.
#[cfg(target_os = "linux")]
const DESKTOP_IDS: [&str; 2] = ["io.github.tinpotnick.folio.desktop", "folio.desktop"];

/// The XDG applications dirs, in lookup order, plus the Flatpak's own
/// prefix (where its desktop entry lives inside the sandbox).
#[cfg(target_os = "linux")]
fn applications_dirs(
    xdg_data_home: Option<String>,
    home: Option<String>,
    xdg_data_dirs: Option<String>,
) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = xdg_data_home
        .map(PathBuf::from)
        .into_iter()
        .chain(home.map(|h| PathBuf::from(h).join(".local/share")))
        .collect();
    if let Some(xdg) = xdg_data_dirs {
        dirs.extend(xdg.split(':').filter(|d| !d.is_empty()).map(PathBuf::from));
    }
    dirs.push(PathBuf::from("/app/share"));
    dirs
}

#[cfg(target_os = "linux")]
fn set_default_md_handler_impl() -> Result<String, String> {
    let dirs = applications_dirs(
        std::env::var("XDG_DATA_HOME").ok(),
        std::env::var("HOME").ok(),
        std::env::var("XDG_DATA_DIRS").ok(),
    );
    // The installed entry first; if none is integrated yet, still
    // write the preference for the product-name id.
    let desktop = DESKTOP_IDS
        .iter()
        .find(|id| dirs.iter().any(|d| d.join("applications").join(id).is_file()))
        .unwrap_or(&DESKTOP_IDS[1]);
    let flatpak = Path::new("/.flatpak-info").exists();
    let mut cmd = if flatpak {
        let mut c = std::process::Command::new("flatpak-spawn");
        c.arg("--host").arg("xdg-mime");
        c
    } else {
        std::process::Command::new("xdg-mime")
    };
    let status = cmd
        .args(["default", desktop, "text/markdown", "text/x-markdown"])
        .status();
    match status {
        Ok(s) if s.success() => Ok(format!(
            ".md and .markdown files will open with folio ({desktop})"
        )),
        Ok(s) => Err(format!("xdg-mime exited {s}")),
        Err(e) => Err(format!("could not run xdg-mime: {e}")),
    }
}

#[cfg(target_os = "macos")]
fn set_default_md_handler_impl() -> Result<String, String> {
    // LaunchServices' C API, declared here so no new crate is needed
    // (ADR-0007): CFStringCreateWithCString + LSSetDefaultRoleHandlerForContentType.
    // LaunchServices is a sub-framework of the CoreServices umbrella,
    // so the link is CoreServices (a top-level LaunchServices.framework
    // does not exist and the link fails).
    type CFStringRef = *const std::ffi::c_void;
    #[link(name = "CoreFoundation", kind = "framework")]
    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn CFStringCreateWithCString(
            alloc: *const std::ffi::c_void,
            c_str: *const std::ffi::c_char,
            encoding: u32,
        ) -> CFStringRef;
        fn CFRelease(cf: *const std::ffi::c_void);
        fn LSSetDefaultRoleHandlerForContentType(
            content_type: CFStringRef,
            role: u32,
            bundle_id: CFStringRef,
        ) -> i32;
    }
    const KCF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;
    const LS_HANDLER_ROLE_ALL: u32 = 0xFFFF_FFFF;
    let bundle_id = "io.github.tinpotnick.folio";
    let mut failed = None;
    for uti in ["public.markdown", "net.daringfireball.markdown"] {
        // Safe: the C strings outlive the CFStrings, which are
        // released before the loop iteration ends.
        unsafe {
            let c_uti = std::ffi::CString::new(uti).unwrap();
            let c_bundle = std::ffi::CString::new(bundle_id).unwrap();
            let uti_ref =
                CFStringCreateWithCString(std::ptr::null(), c_uti.as_ptr(), KCF_STRING_ENCODING_UTF8);
            let bundle_ref = CFStringCreateWithCString(
                std::ptr::null(),
                c_bundle.as_ptr(),
                KCF_STRING_ENCODING_UTF8,
            );
            let status = LSSetDefaultRoleHandlerForContentType(uti_ref, LS_HANDLER_ROLE_ALL, bundle_ref);
            CFRelease(uti_ref);
            CFRelease(bundle_ref);
            if status != 0 {
                failed = Some(format!("{uti}: LaunchServices error {status}"));
            }
        }
    }
    match failed {
        None => Ok(".md files will open with folio".into()),
        Some(e) => Err(format!("could not set the default app: {e}")),
    }
}

#[cfg(target_os = "windows")]
fn set_default_md_handler_impl() -> Result<String, String> {
    // Windows 8+ protects the default handler (the UserChoice hash):
    // only the user can set it, in Settings > Default apps.
    std::process::Command::new("explorer")
        .arg("ms-settings:defaultapps")
        .spawn()
        .map_err(|e| format!("could not open Settings: {e}"))?;
    Ok("Windows lets you choose default apps in Settings - opened it there; pick folio for .md".into())
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn set_default_md_handler_impl() -> Result<String, String> {
    Err("unsupported platform".into())
}

/// Web addresses a document may hand to the system: the web and
/// e-mail, nothing that runs or reads anything locally (`file:`,
/// `javascript:`, custom app schemes).
fn is_external_url(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    ["http://", "https://", "mailto:"]
        .iter()
        .any(|p| lower.starts_with(p) && lower.len() > p.len())
}

/// Open a link in the user's own browser (or mail app): the app's
/// webview never navigates away from the document (ADR-0024).
/// Open the presenter view (docs/specs/slides.md) as a second app
/// window running the same front-end with `?presenter=1`. The two
/// windows sync over a BroadcastChannel (mirrored through
/// localStorage, which WebKitGTK delivers reliably across webviews).
#[tauri::command]
async fn open_presenter_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
    if let Some(existing) = app.get_webview_window("presenter") {
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return Ok(());
    }
    let main = app.get_webview_window("main").ok_or("no main window")?;
    let url = main.url().map_err(|e| e.to_string())?;
    // Bundled app (tauri://localhost / http://tauri.localhost):
    // address the asset path - NO query string, it is unreliable in
    // the App variant; the front-end detects this window by its label
    // "presenter" instead. Dev server: reuse its URL as-is.
    let is_app_protocol = matches!(url.scheme(), "tauri" | "app")
        || url.host_str() == Some("tauri.localhost");
    let target = if is_app_protocol {
        let path = url.path().trim_start_matches('/');
        let path = if path.is_empty() { "index.html" } else { path };
        WebviewUrl::App(path.into())
    } else {
        WebviewUrl::External(url)
    };
    WebviewWindowBuilder::new(&app, "presenter", target)
        .title("folio — presenter view")
        .inner_size(960.0, 720.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    if !is_external_url(&url) {
        return Err(format!("not a web address: {url}"));
    }
    app.opener()
        .open_url(url.trim(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Export the document as a PDF (ADR-0025): a save dialog, then the
/// webview prints itself straight to that file with the print
/// stylesheet (the document's `page.size`, 18 x 16 mm margins, as
/// `@page` says; the section payload carries the size) - no print
/// dialog, the same pages Print makes.
///
/// With more than one print section (spec: docs/specs/print.md, "Page
/// sections") the document is printed once per section - the webview
/// is told which section to show via `window.__folioPrintSection` -
/// each run gets its own paper size/orientation, and the section PDFs
/// are merged in document order and stamped with per-page furniture at
/// absolute page offsets (page numbers never restart at a section).
#[tauri::command]
async fn export_pdf(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    suggested: String,
    sections: Vec<pdf_furniture::SectionFurniture>,
) -> Result<String, String> {
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("PDF document", &["pdf"])
        .set_file_name(&suggested);
    if let Some(dir) = read_last_dir(&app) {
        dialog = dialog.set_directory(dir);
    }
    let path = dialog
        .blocking_save_file()
        .ok_or("cancelled")?
        .into_path()
        .map_err(|e| e.to_string())?;
    remember_dir(&app, &path);
    if sections.len() <= 1 {
        let s = sections.into_iter().next();
        let page_size = s.as_ref().map(|x| x.page_size.clone());
        let orientation = s.as_ref().map(|x| x.orientation.clone());
        print_to_pdf(&window, &path, page_size.as_deref(), orientation.as_deref()).await?;
        // The running header/footer and page numbers: WebKitGTK ignores
        // the print stylesheet's page-margin boxes, so they are stamped
        // on after.
        if let Some(s) = s {
            let count = lopdf::Document::load(&path)
                .map_err(|e| e.to_string())?
                .get_pages()
                .len();
            let pages = vec![
                pdf_furniture::PageFurniture {
                    header: s.header.clone(),
                    footer: s.footer.clone(),
                    numbers: s.numbers,
                };
                count
            ];
            pdf_furniture::stamp_pages(&path, &pages)?;
        }
        return Ok(path.to_string_lossy().into_owned());
    }
    // Per-section export: print each section alone, then merge + stamp.
    let tmp = std::env::temp_dir().join(format!("folio-export-{}", std::process::id()));
    std::fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    let mut temps: Vec<std::path::PathBuf> = Vec::new();
    let mut counts: Vec<usize> = Vec::new();
    for (i, s) in sections.iter().enumerate() {
        window
            .eval(&format!(
                "window.__folioPrintSection && window.__folioPrintSection({i})"
            ))
            .map_err(|e| e.to_string())?;
        // Let the print-media filter reach the webview before printing.
        std::thread::sleep(std::time::Duration::from_millis(300));
        let t = tmp.join(format!("sec-{i}.pdf"));
        print_to_pdf(&window, &t, Some(&s.page_size), Some(&s.orientation)).await?;
        let d = lopdf::Document::load(&t).map_err(|e| e.to_string())?;
        counts.push(d.get_pages().len());
        temps.push(t);
    }
    let _ = window.eval("window.__folioPrintSection && window.__folioPrintSection(null)");
    pdf_furniture::merge(&temps, &path)?;
    let mut pages: Vec<pdf_furniture::PageFurniture> = Vec::new();
    for (s, c) in sections.iter().zip(&counts) {
        for _ in 0..*c {
            pages.push(pdf_furniture::PageFurniture {
                header: s.header.clone(),
                footer: s.footer.clone(),
                numbers: s.numbers,
            });
        }
    }
    pdf_furniture::stamp_pages(&path, &pages)?;
    std::fs::remove_dir_all(&tmp).ok();
    Ok(path.to_string_lossy().into_owned())
}

/// The paper for a `page.size` key + orientation (spec:
/// docs/specs/print.md, "Page sections"). Named paper for the
/// portrait paper sizes (as before); everything else is a custom size
/// with the final dimensions baked in, so orientation never depends
/// on the engine swapping them.
#[cfg(target_os = "linux")]
fn paper_for(size: &str, orientation: &str) -> gtk::PaperSize {
    let landscape = orientation == "landscape";
    match (size, landscape) {
        ("a5", false) => gtk::PaperSize::new(Some("iso_a5")),
        ("letter", false) => gtk::PaperSize::new(Some("na_letter")),
        ("a4", false) => gtk::PaperSize::new(Some("iso_a4")),
        ("a4", true) => gtk::PaperSize::new_custom(
            "folio-a4-landscape",
            "A4 landscape",
            297.0,
            210.0,
            gtk::Unit::Mm,
        ),
        ("a5", true) => gtk::PaperSize::new_custom(
            "folio-a5-landscape",
            "A5 landscape",
            210.0,
            148.0,
            gtk::Unit::Mm,
        ),
        ("letter", true) => gtk::PaperSize::new_custom(
            "folio-letter-landscape",
            "US Letter landscape",
            11.0 * 25.4,
            8.5 * 25.4,
            gtk::Unit::Mm,
        ),
        ("16:9", _) => gtk::PaperSize::new_custom(
            if landscape { "folio-16x9" } else { "folio-16x9-portrait" },
            "Slide 16:9",
            if landscape { 16.0 * 25.4 } else { 9.0 * 25.4 },
            if landscape { 9.0 * 25.4 } else { 16.0 * 25.4 },
            gtk::Unit::Mm,
        ),
        ("4:3", _) => gtk::PaperSize::new_custom(
            if landscape { "folio-4x3" } else { "folio-4x3-portrait" },
            "Slide 4:3",
            if landscape { (32.0 / 3.0) * 25.4 } else { 8.0 * 25.4 },
            if landscape { 8.0 * 25.4 } else { (32.0 / 3.0) * 25.4 },
            gtk::Unit::Mm,
        ),
        _ => gtk::PaperSize::new(Some("iso_a4")),
    }
}

#[cfg(target_os = "linux")]
async fn print_to_pdf(
    window: &tauri::WebviewWindow,
    path: &Path,
    page_size: Option<&str>,
    orientation: Option<&str>,
) -> Result<(), String> {
    use webkit2gtk::PrintOperationExt;
    let uri = gtk::glib::filename_to_uri(path, None).map_err(|e| e.to_string())?;
    // The webview closure is 'static: own the page-size key.
    let page_size = page_size.map(str::to_string);
    let orientation = orientation.map(str::to_string);
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    window
        .with_webview(move |wv| {
            let op = webkit2gtk::PrintOperation::new(&wv.inner());
            let settings = gtk::PrintSettings::new();
            settings.set_printer("Print to File");
            settings.set("output-file-format", Some("pdf"));
            settings.set("output-uri", Some(uri.as_str()));
            op.set_print_settings(&settings);
            let page = gtk::PageSetup::new();
            // The document's `page.size` key + `page.orientation`
            // (docs/specs/slides.md, docs/specs/print.md); A4 portrait
            // is the default for a raw Markdown file.
            let paper = paper_for(
                page_size.as_deref().unwrap_or("a4"),
                orientation.as_deref().unwrap_or("portrait"),
            );
            page.set_paper_size(&paper);
            page.set_top_margin(18.0, gtk::Unit::Mm);
            page.set_bottom_margin(18.0, gtk::Unit::Mm);
            page.set_left_margin(16.0, gtk::Unit::Mm);
            page.set_right_margin(16.0, gtk::Unit::Mm);
            op.set_page_setup(&page);
            let done = tx.clone();
            op.connect_finished(move |_| {
                let _ = done.send(Ok(()));
            });
            op.connect_failed(move |_, err| {
                let _ = tx.send(Err(err.to_string()));
            });
            op.print();
        })
        .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(std::time::Duration::from_secs(120))
            .unwrap_or_else(|_| Err("timed out writing the PDF".into()))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Not built yet off Linux: the page falls back to the print dialog.
// Elsewhere the page prints through the system dialog. Same arguments
// as the Linux one: the slideshow's page size was added there only, and
// macOS and Windows stopped compiling.
#[cfg(not(target_os = "linux"))]
async fn print_to_pdf(
    _window: &tauri::WebviewWindow,
    _path: &Path,
    _page_size: Option<&str>,
    _orientation: Option<&str>,
) -> Result<(), String> {
    Err("unsupported".into())
}

/// The document the app was asked to open at launch ("Open with
/// folio", double-clicking a .md file, `folio notes.md`): the first
/// argument that is not an option. Taken once by the page.
struct LaunchFile(std::sync::Mutex<Option<String>>);

fn launch_file_from_args(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .map(|a| a.strip_prefix("file://").unwrap_or(a).to_string())
}

/// The launch document, read and handed to the page once (it then
/// belongs to the open document: Save writes back to it).
#[tauri::command]
fn launch_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, LaunchFile>,
) -> Option<OpenedDocument> {
    let path = state.0.lock().ok()?.take()?;
    let text = std::fs::read_to_string(&path).ok()?;
    let path = PathBuf::from(path);
    remember_dir(&app, &path);
    Some(OpenedDocument {
        path: path.to_string_lossy().into_owned(),
        text,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    tauri::Builder::default()
        .manage(LaunchFile(std::sync::Mutex::new(launch_file_from_args(
            &args,
        ))))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Recording (spec: docs/specs/audio-embeds.md) is a
        // first-class feature: the record button IS the consent
        // gesture. Without a handler WebKitGTK silently DENIES
        // every getUserMedia request - "permission denied".
        .on_permission_request(|_webview, kind| match kind {
            PermissionKind::Microphone => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .invoke_handler(tauri::generate_handler![
            open_document,
            save_document,
            write_document,
            stat_document,
            read_document,
            save_text_file,
            open_external,
            open_presenter_window,
            export_pdf,
            launch_document,
            fetch_url,
            set_default_md_handler
        ])
        .build(tauri::generate_context!())
        .expect("error while building folio desktop")
        .run(|_app, _event| {
            // macOS opens files by event, not argument: hand the page
            // the file (it opens it after the unsaved-changes check).
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                use tauri::{Emitter, Manager};
                if let Some(path) = urls.iter().find_map(|u| u.to_file_path().ok()) {
                    let path = path.to_string_lossy().into_owned();
                    if let Ok(mut slot) = _app.state::<LaunchFile>().0.lock() {
                        *slot = Some(path.clone());
                    }
                    let _ = _app.emit("folio-open-file", path);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::{
        dir_to_remember, folder_hint, is_external_url, is_portal_path, launch_file_from_args,
        write_back,
    };

    #[cfg(target_os = "linux")]
    #[test]
    fn applications_dirs_are_in_lookup_order_with_the_flatpak_prefix_last() {
        let dirs = super::applications_dirs(
            Some("/xdg-home".into()),
            Some("/home/n".into()),
            Some("/usr/local/share:/usr/share".into()),
        );
        assert_eq!(
            dirs,
            vec![
                std::path::PathBuf::from("/xdg-home"),
                std::path::PathBuf::from("/home/n/.local/share"),
                std::path::PathBuf::from("/usr/local/share"),
                std::path::PathBuf::from("/usr/share"),
                std::path::PathBuf::from("/app/share"),
            ]
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn applications_dirs_skip_empty_xdg_data_dirs_entries() {
        let dirs = super::applications_dirs(None, None, Some("/usr/share::/opt/share".into()));
        assert_eq!(
            dirs,
            vec![
                std::path::PathBuf::from("/usr/share"),
                std::path::PathBuf::from("/opt/share"),
                std::path::PathBuf::from("/app/share"),
            ]
        );
    }

    /// Stamp a real WebKitGTK PDF: `FOLIO_PDF_SAMPLE=/path/to.pdf cargo test
    /// stamps_a_sample -- --ignored`, then read it with pdftotext.
    #[test]
    #[ignore]
    fn stamps_a_sample() {
        let path = std::env::var("FOLIO_PDF_SAMPLE").expect("FOLIO_PDF_SAMPLE");
        let count = lopdf::Document::load(std::path::Path::new(&path))
            .unwrap()
            .get_pages()
            .len();
        super::pdf_furniture::stamp_pages(
            std::path::Path::new(&path),
            &vec![
                super::pdf_furniture::PageFurniture {
                    header: Some("Q3 Sales Review — £ test".into()),
                    footer: None,
                    numbers: true,
                };
                count
            ],
        )
        .unwrap();
    }

    #[test]
    fn the_launch_file_is_the_first_plain_argument() {
        let a = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert_eq!(launch_file_from_args(&a(&["folio"])), None);
        assert_eq!(
            launch_file_from_args(&a(&["folio", "/home/n/notes.md"])),
            Some("/home/n/notes.md".into())
        );
        assert_eq!(
            launch_file_from_args(&a(&["folio", "--flag", "file:///tmp/a.md"])),
            Some("/tmp/a.md".into())
        );
    }

    /// Live: fetches real open-data publishers (run by hand:
    /// `cargo test fetches_live_publishers -- --ignored --nocapture`).
    #[test]
    #[ignore]
    fn fetches_live_publishers() {
        for url in [
            "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp?csv.x=yes&Datefrom=01/Jan/2024&Dateto=now&SeriesCodes=IUMABEDR&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N",
            "https://www.ons.gov.uk/generator?format=csv&uri=/economy/inflationandpriceindices/timeseries/d7bt/mm23",
            "https://fred.stlouisfed.org/graph/fredgraph.csv?id=SPASTT01GBM661N",
        ] {
            let got = tauri::async_runtime::block_on(super::fetch_url(url.into()))
                .unwrap_or_else(|e| panic!("{url}: {e}"));
            println!("{} bytes, {}: {:?}", got.text.len(), got.content_type, &got.text[..60.min(got.text.len())]);
            assert!(got.text.len() > 100);
        }
    }

    #[test]
    fn only_web_addresses_are_fetched() {
        assert!(super::is_fetchable(
            "https://www.ons.gov.uk/generator?format=csv"
        ));
        assert!(super::is_fetchable("http://example.com/a.csv"));
        assert!(!super::is_fetchable("file:///etc/passwd"));
        assert!(!super::is_fetchable("ftp://example.com/a.csv"));
        assert!(!super::is_fetchable("javascript:alert(1)"));
        assert!(!super::is_fetchable("not a url"));
    }

    #[test]
    fn only_web_and_mail_addresses_open_externally() {
        assert!(is_external_url("https://graphviz.org"));
        assert!(is_external_url("http://example.com/x"));
        assert!(is_external_url("HTTPS://Example.com"));
        assert!(is_external_url("mailto:a@b.c"));
        assert!(!is_external_url("file:///etc/passwd"));
        assert!(!is_external_url("javascript:alert(1)"));
        assert!(!is_external_url("https://"));
        assert!(!is_external_url("folio://x"));
        assert!(!is_external_url("/demo/examples/poem.md"));
    }
    use std::path::{Path, PathBuf};

    fn tempd(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("folio-hint-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn open_docs_folder_wins_over_fallbacks() {
        let docs = tempd("docs");
        let doc = docs.join("doc.md");
        std::fs::write(&doc, b"").unwrap();
        let last = tempd("last");
        let demo = tempd("demo");
        assert_eq!(
            folder_hint(
                Some(doc.to_str().unwrap()),
                Some(last.to_str().unwrap()),
                Some(demo.to_str().unwrap())
            ),
            Some(docs)
        );
    }

    #[test]
    fn in_memory_doc_uses_last_used_folder() {
        let last = tempd("only");
        let demo = tempd("demo");
        assert_eq!(
            folder_hint(
                None,
                Some(last.to_str().unwrap()),
                Some(demo.to_str().unwrap())
            ),
            Some(last)
        );
    }

    #[test]
    fn first_run_uses_the_default_documents_folder() {
        let demo = tempd("boot");
        assert_eq!(
            folder_hint(None, None, Some(demo.to_str().unwrap())),
            Some(demo)
        );
    }

    #[test]
    fn write_back_saves_the_text_verbatim() {
        // "Save" with a known path writes the file as-is, no dialog
        let d = tempd("write");
        let f = d.join("doc.md");
        write_back(&f, "# Hi\n\ntext\n").unwrap();
        assert_eq!(std::fs::read_to_string(&f).unwrap(), "# Hi\n\ntext\n");
        // overwrites in place (a second Save replaces the first)
        write_back(&f, "# Bye\n").unwrap();
        assert_eq!(std::fs::read_to_string(&f).unwrap(), "# Bye\n");
        // a vanished parent folder is an error, not a panic
        assert!(write_back(&d.join("nope").join("doc.md"), "x").is_err());
    }

    #[test]
    fn missing_folders_get_no_hint() {
        assert_eq!(
            folder_hint(None, Some("/definitely/not/here"), Some("/gone/too")),
            None
        );
        let gone = tempd("gone");
        std::fs::remove_dir_all(&gone).unwrap();
        let doc = gone.join("doc.md");
        assert_eq!(folder_hint(Some(doc.to_str().unwrap()), None, None), None);
    }

    #[cfg(target_os = "linux")]
    fn set_host_path_xattr(file: &Path, real: &Path) {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;
        extern "C" {
            fn setxattr(
                path: *const std::ffi::c_char,
                name: *const std::ffi::c_char,
                value: *const std::ffi::c_void,
                size: usize,
                flags: i32,
            ) -> i32;
        }
        let c_path = CString::new(file.as_os_str().as_bytes()).unwrap();
        let c_name = CString::new("user.document-portal.host-path").unwrap();
        let val = real.as_os_str().as_bytes();
        let rc = unsafe {
            setxattr(
                c_path.as_ptr(),
                c_name.as_ptr(),
                val.as_ptr().cast(),
                val.len(),
                0,
            )
        };
        assert_eq!(rc, 0, "setxattr failed (user xattrs on this fs?)");
    }

    #[test]
    #[cfg(target_os = "linux")]
    fn portal_path_resolves_to_the_real_host_folder() {
        // Stands in for /run/user/<uid>/doc/<id>/notes.md: a file whose
        // host-path attribute names the real file.
        let portal_dir = tempd("portal");
        let portal_file = portal_dir.join("notes.md");
        std::fs::write(&portal_file, b"").unwrap();
        let real_dir = tempd("real");
        let real_file = real_dir.join("notes.md");
        set_host_path_xattr(&portal_file, &real_file);

        assert_eq!(
            folder_hint(Some(portal_file.to_str().unwrap()), None, None),
            Some(real_dir.clone())
        );
        assert_eq!(dir_to_remember(&portal_file), Some(real_dir));
    }

    #[test]
    fn portal_path_without_the_attribute_is_never_remembered() {
        // A literal portal path (need not exist: the checks are pure).
        let portal_file = Path::new("/run/user/1000/doc/abc123/notes.md");
        assert!(is_portal_path(portal_file));
        assert_eq!(dir_to_remember(portal_file), None);
        // A plain path is remembered as-is.
        let plain_dir = tempd("plain");
        let plain_file = plain_dir.join("notes.md");
        std::fs::write(&plain_file, b"").unwrap();
        assert!(!is_portal_path(&plain_file));
        assert_eq!(dir_to_remember(&plain_file), Some(plain_dir));
    }
}
