//! folio desktop host — Tauri v2 (ADR-0006: our apps are hosts of the
//! `<folio-doc>` web component). The web UI is the same demo host page;
//! this shell adds native Open/Save so documents are real local files.
//! No engine logic lives here (ADR-0001): the document stays the
//! single source of truth, read and written as plain Markdown text.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn open_document(app: tauri::AppHandle) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("folio document", &["md"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    let picked = rx.recv().map_err(|_| "dialog closed".to_string())?;
    let path = match picked {
        Some(p) => p,
        None => return Err("cancelled".into()),
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_document(app: tauri::AppHandle, text: String, suggested: String) -> Result<String, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    let mut dialog = app.dialog().file().add_filter("folio document", &["md"]);
    if !suggested.is_empty() {
        let default = std::path::Path::new(&suggested);
        if let Some(name) = default.file_name().and_then(|n| n.to_str()) {
            dialog = dialog.set_file_name(name);
        }
    }
    dialog.save_file(move |path| {
        let _ = tx.send(path);
    });
    let picked = rx.recv().map_err(|_| "dialog closed".to_string())?;
    let path = match picked {
        Some(p) => p,
        None => return Err("cancelled".into()),
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
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
