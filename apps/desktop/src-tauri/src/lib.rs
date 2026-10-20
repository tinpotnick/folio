//! folio desktop host — Tauri v2 (ADR-0006: our apps are hosts of the
//! `<folio-doc>` web component). The web UI is the same demo host page;
//! this shell adds native Open/Save so documents are real local files.
//! No engine logic lives here (ADR-0001): the document stays the
//! single source of truth, read and written as plain Markdown text.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_dialog::DialogExt;

/// The result of a successful open: the file's PATH (the host
/// remembers it so the next dialog starts where the user last
/// was, and Save defaults to the same folder) plus its text.
#[derive(serde::Serialize)]
struct OpenedDocument {
    path: String,
    text: String,
}

/// Commands are `async` so Tauri runs them off the main thread, and
/// the dialog plugin's `blocking_*` builders are used to await the
/// pick. Blocking the main thread instead freezes the whole window
/// (the event loop can neither run the dialog nor repaint).
///
/// `current` is the path of the document the host has open: the
/// dialog starts in ITS folder, not the home folder.
#[tauri::command]
async fn open_document(
    app: tauri::AppHandle,
    current: Option<String>,
) -> Result<OpenedDocument, String> {
    let mut dialog = app.dialog().file().add_filter("folio document", &["md"]);
    if let Some(cur) = current.as_deref() {
        if let Some(dir) = std::path::Path::new(cur).parent() {
            dialog = dialog.set_directory(dir);
        }
    }
    let picked = dialog.blocking_pick_file();
    let path = picked
        .ok_or("cancelled")?
        .into_path()
        .map_err(|e| e.to_string())?;
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(OpenedDocument {
        path: path.to_string_lossy().into_owned(),
        text,
    })
}

#[tauri::command]
async fn save_document(
    app: tauri::AppHandle,
    text: String,
    suggested: String,
    current: Option<String>,
) -> Result<String, String> {
    let mut dialog = app.dialog().file().add_filter("folio document", &["md"]);
    if !suggested.is_empty() {
        let default = std::path::Path::new(&suggested);
        if let Some(name) = default.file_name().and_then(|n| n.to_str()) {
            dialog = dialog.set_file_name(name);
        }
    }
    // Save joins the current document's folder too: the dialog
    // lands where the user is already working.
    if let Some(cur) = current.as_deref() {
        if let Some(dir) = std::path::Path::new(cur).parent() {
            dialog = dialog.set_directory(dir);
        }
    }
    let path = dialog
        .blocking_save_file()
        .ok_or("cancelled")?
        .into_path()
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, &text).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_document, save_document])
        .run(tauri::generate_context!())
        .expect("error while running folio desktop");
}
