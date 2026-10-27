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

/// The folder a dialog starts in, in order: the open document's
/// folder when it came from disk; otherwise the last folder the
/// user opened from or saved to; otherwise — the true first run —
/// the folder the DEFAULT document was loaded from (`tauri dev`
/// serves `demo/` straight from the checkout, so the boot doc is
/// a real file even though the host loaded it as a web asset).
/// Folders that no longer exist are skipped.
fn folder_hint(current: Option<&str>, last: Option<&str>, demo: Option<&str>) -> Option<PathBuf> {
    if let Some(cur) = current {
        if let Some(dir) = Path::new(cur).parent() {
            if dir.is_dir() {
                return Some(dir.to_path_buf());
            }
        }
    }
    for candidate in [last, demo] {
        if let Some(dir) = candidate {
            if Path::new(dir).is_dir() {
                return Some(PathBuf::from(dir));
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

fn remember_dir(app: &tauri::AppHandle, file: &Path) {
    let Some(dir) = file.parent() else {
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
    remember_dir(&app, &path);
    std::fs::write(&path, &text).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
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
/// stylesheet (A4, 18 x 16 mm margins, as `@page` says) - no print
/// dialog, the same pages Print makes.
#[tauri::command]
async fn export_pdf(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    suggested: String,
    furniture: Option<pdf_furniture::Furniture>,
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
    print_to_pdf(&window, &path).await?;
    // The running header and page numbers: WebKitGTK ignores the print
    // stylesheet's page-margin boxes, so they are stamped on after.
    if let Some(f) = furniture {
        pdf_furniture::stamp(&path, &f)?;
    }
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(target_os = "linux")]
async fn print_to_pdf(window: &tauri::WebviewWindow, path: &Path) -> Result<(), String> {
    use webkit2gtk::PrintOperationExt;
    let uri = gtk::glib::filename_to_uri(path, None).map_err(|e| e.to_string())?;
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
            page.set_paper_size(&gtk::PaperSize::new(Some("iso_a4")));
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
#[cfg(not(target_os = "linux"))]
async fn print_to_pdf(_window: &tauri::WebviewWindow, _path: &Path) -> Result<(), String> {
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
            save_text_file,
            open_external,
            export_pdf,
            launch_document
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
    use super::{folder_hint, is_external_url, launch_file_from_args};

    /// Stamp a real WebKitGTK PDF: `FOLIO_PDF_SAMPLE=/path/to.pdf cargo test
    /// stamps_a_sample -- --ignored`, then read it with pdftotext.
    #[test]
    #[ignore]
    fn stamps_a_sample() {
        let path = std::env::var("FOLIO_PDF_SAMPLE").expect("FOLIO_PDF_SAMPLE");
        super::pdf_furniture::stamp(
            std::path::Path::new(&path),
            &super::pdf_furniture::Furniture {
                header: Some("Q3 Sales Review — £ test".into()),
                numbers: true,
            },
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
    use std::path::PathBuf;

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
            folder_hint(None, Some(last.to_str().unwrap()), Some(demo.to_str().unwrap())),
            Some(last)
        );
    }

    #[test]
    fn first_run_uses_the_default_documents_folder() {
        let demo = tempd("boot");
        assert_eq!(folder_hint(None, None, Some(demo.to_str().unwrap())), Some(demo));
    }

    #[test]
    fn missing_folders_get_no_hint() {
        assert_eq!(folder_hint(None, Some("/definitely/not/here"), Some("/gone/too")), None);
        let gone = tempd("gone");
        std::fs::remove_dir_all(&gone).unwrap();
        let doc = gone.join("doc.md");
        assert_eq!(folder_hint(Some(doc.to_str().unwrap()), None, None), None);
    }
}
