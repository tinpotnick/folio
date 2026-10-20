//! folio desktop host — Tauri v2 (ADR-0006: our apps are hosts of the
//! `<folio-doc>` web component). The web UI is the same demo host page;
//! this shell adds native Open/Save so documents are real local files.
//! No engine logic lives here (ADR-0001): the document stays the
//! single source of truth, read and written as plain Markdown text.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Recording (spec: docs/specs/audio-embeds.md) is a
        // first-class feature: the record button IS the consent
        // gesture. Without a handler WebKitGTK silently DENIES
        // every getUserMedia request - "permission denied".
        .on_permission_request(|_webview, kind| match kind {
            PermissionKind::Microphone => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .invoke_handler(tauri::generate_handler![open_document, save_document])
        .run(tauri::generate_context!())
        .expect("error while running folio desktop");
}

#[cfg(test)]
mod tests {
    use super::folder_hint;
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
