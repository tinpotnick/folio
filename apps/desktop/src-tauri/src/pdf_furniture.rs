//! Page furniture on exported PDFs (ADR-0027, spec: docs/specs/print.md):
//! the running header and "Page n of N", stamped onto the PDF WebKitGTK
//! writes - its print engine ignores CSS page-margin boxes, which is how
//! a browser's print gets them. Placed to match the print stylesheet's
//! `@page` margin boxes: header top-left from page 2, numbers bottom-right.

use lopdf::{dictionary, Dictionary, Document, Object, ObjectId, Stream};
use std::path::Path;

/// What to put on each page.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct Furniture {
    /// The running header (the document's title), from page 2 on.
    pub header: Option<String>,
    /// "Page n of N", bottom right.
    pub numbers: bool,
}

const FONT_NAME: &[u8] = b"FolioFurniture";
const SIZE: f32 = 8.5;
/// mm to PDF points.
const MM: f32 = 72.0 / 25.4;

/// Helvetica's advance widths (per 1000 em) for the characters page
/// numbers use, to right-align them; anything else counts as 556.
fn width(c: char) -> f32 {
    match c {
        ' ' => 278.0,
        'P' => 667.0,
        'f' | 't' => 278.0,
        'i' | 'l' => 222.0,
        _ => 556.0, // digits, a, e, g, o and most lower case
    }
}

fn text_width(s: &str) -> f32 {
    s.chars().map(width).sum::<f32>() * SIZE / 1000.0
}

/// A character's WinAnsi (Windows-1252) byte: Latin-1, plus the
/// typography titles use (dashes, curly quotes, ellipsis, euro).
fn win_ansi(c: char) -> u8 {
    match c {
        '\u{2013}' => 0x96,
        '\u{2014}' => 0x97,
        '\u{2018}' => 0x91,
        '\u{2019}' => 0x92,
        '\u{201C}' => 0x93,
        '\u{201D}' => 0x94,
        '\u{2026}' => 0x85,
        '\u{2022}' => 0x95,
        '\u{20AC}' => 0x80,
        c if (c as u32) < 0x80 || (0xA0..0x100).contains(&(c as u32)) => c as u32 as u8,
        _ => b'?',
    }
}

/// A PDF literal string in WinAnsi: characters outside it become '?',
/// and ( ) \ are escaped.
fn pdf_string(s: &str) -> Vec<u8> {
    let mut out = b"(".to_vec();
    for c in s.chars() {
        let b = win_ansi(c);
        if matches!(b, b'(' | b')' | b'\\') {
            out.push(b'\\');
        }
        out.push(b);
    }
    out.push(b')');
    out
}

fn media_box(doc: &Document, page: ObjectId) -> (f32, f32) {
    let mut id = Some(page);
    while let Some(cur) = id {
        let Ok(dict) = doc.get_dictionary(cur) else {
            break;
        };
        if let Ok(Object::Array(b)) = dict.get(b"MediaBox") {
            let n: Vec<f32> = b
                .iter()
                .filter_map(|o| {
                    o.as_float()
                        .ok()
                        .or_else(|| o.as_i64().ok().map(|i| i as f32))
                })
                .collect();
            if n.len() == 4 {
                return (n[2] - n[0], n[3] - n[1]);
            }
        }
        id = dict.get(b"Parent").and_then(Object::as_reference).ok();
    }
    (595.0, 842.0) // A4
}

/// The page's own resource dictionary, made writable: an inherited one
/// is copied onto the page first.
fn page_resources_mut(doc: &mut Document, page: ObjectId) -> Result<&mut Dictionary, String> {
    let page_dict = doc.get_dictionary(page).map_err(|e| e.to_string())?;
    match page_dict.get(b"Resources") {
        Ok(Object::Reference(rid)) => {
            let rid = *rid;
            return doc.get_dictionary_mut(rid).map_err(|e| e.to_string());
        }
        Ok(Object::Dictionary(_)) => {}
        _ => {
            // Inherited: copy the nearest ancestor's onto the page.
            let (_, ids) = doc.get_page_resources(page).map_err(|e| e.to_string())?;
            let inherited = ids
                .first()
                .and_then(|id| doc.get_dictionary(*id).ok())
                .cloned()
                .unwrap_or_default();
            doc.get_dictionary_mut(page)
                .map_err(|e| e.to_string())?
                .set("Resources", Object::Dictionary(inherited));
        }
    }
    doc.get_dictionary_mut(page)
        .map_err(|e| e.to_string())?
        .get_mut(b"Resources")
        .and_then(Object::as_dict_mut)
        .map_err(|e| e.to_string())
}

/// Add folio's font to a page's resources (a referenced /Font dictionary
/// is resolved and extended in place).
fn add_font(doc: &mut Document, page: ObjectId, font: ObjectId) -> Result<(), String> {
    let fonts_ref = page_resources_mut(doc, page)?
        .get(b"Font")
        .ok()
        .and_then(|o| o.as_reference().ok());
    if let Some(fid) = fonts_ref {
        doc.get_dictionary_mut(fid)
            .map_err(|e| e.to_string())?
            .set(FONT_NAME, Object::Reference(font));
        return Ok(());
    }
    let res = page_resources_mut(doc, page)?;
    if res.get(b"Font").and_then(Object::as_dict).is_err() {
        res.set("Font", Object::Dictionary(Dictionary::new()));
    }
    res.get_mut(b"Font")
        .and_then(Object::as_dict_mut)
        .map_err(|e| e.to_string())?
        .set(FONT_NAME, Object::Reference(font));
    Ok(())
}

/// Stamp the furniture onto every page of the PDF at `path`, in place.
pub fn stamp(path: &Path, f: &Furniture) -> Result<(), String> {
    // A title Helvetica cannot spell (another script) is left off
    // rather than printed as "???".
    let header = f
        .header
        .as_deref()
        .map(str::trim)
        .filter(|h| !h.is_empty() && h.chars().all(|c| win_ansi(c) != b'?' || c == '?'));
    if header.is_none() && !f.numbers {
        return Ok(());
    }
    let mut doc = Document::load(path).map_err(|e| e.to_string())?;
    let font = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let pages = doc.get_pages();
    let total = pages.len();
    for (n, page) in pages {
        let (w, h) = media_box(&doc, page);
        let mut ops: Vec<u8> = b"Q q 0.42 g BT\n".to_vec();
        let font_op = format!("/{} {SIZE} Tf\n", String::from_utf8_lossy(FONT_NAME));
        ops.extend_from_slice(font_op.as_bytes());
        if let Some(title) = header.filter(|_| n > 1) {
            let line = format!("1 0 0 1 {:.2} {:.2} Tm ", 16.0 * MM, h - 11.0 * MM);
            ops.extend_from_slice(line.as_bytes());
            ops.extend_from_slice(&pdf_string(title));
            ops.extend_from_slice(b" Tj\n");
        }
        if f.numbers {
            let label = format!("Page {n} of {total}");
            let x = w - 16.0 * MM - text_width(&label);
            let line = format!("1 0 0 1 {:.2} {:.2} Tm ", x, 9.0 * MM);
            ops.extend_from_slice(line.as_bytes());
            ops.extend_from_slice(&pdf_string(&label));
            ops.extend_from_slice(b" Tj\n");
        }
        ops.extend_from_slice(b"ET Q\n");
        add_font(&mut doc, page, font)?;
        // Wrap what the page already draws in q ... Q, so no state it
        // leaves behind (a transform, a colour) moves the furniture.
        let opening = doc.add_object(Stream::new(Dictionary::new(), b"q\n".to_vec()));
        let page_dict = doc.get_dictionary_mut(page).map_err(|e| e.to_string())?;
        let mut contents = match page_dict.get(b"Contents") {
            Ok(Object::Reference(id)) => vec![Object::Reference(*id)],
            Ok(Object::Array(a)) => a.clone(),
            _ => vec![],
        };
        contents.insert(0, Object::Reference(opening));
        page_dict.set("Contents", contents);
        // `ops` starts with Q (closing the wrap) then opens its own q.
        doc.add_page_contents(page, ops)
            .map_err(|e| e.to_string())?;
    }
    doc.save(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strings_are_escaped_and_latin1() {
        assert_eq!(pdf_string("a(b)\\"), b"(a\\(b\\)\\\\)".to_vec());
        assert_eq!(pdf_string("£5 → x"), b"(\xa35 ? x)".to_vec());
        assert_eq!(
            pdf_string("Q3 — “Sales”…"),
            b"(Q3 \x97 \x93Sales\x94\x85)".to_vec()
        );
    }

    #[test]
    fn numbers_right_align_by_helvetica_widths() {
        // "Page 1 of 1": P a g e _ 1 _ o f _ 1
        let expected =
            (667.0 + 556.0 * 3.0 + 278.0 + 556.0 + 278.0 + 556.0 + 278.0 + 278.0 + 556.0) * SIZE
                / 1000.0;
        assert!((text_width("Page 1 of 1") - expected).abs() < 0.01);
    }

    /// A two-page A4 PDF, its pages inheriting their resources.
    fn two_pages(path: &Path) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let mut kids = vec![];
        for _ in 0..2 {
            let content = doc.add_object(Stream::new(dictionary! {}, b"0 0 m".to_vec()));
            kids.push(Object::Reference(doc.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "Contents" => content,
            })));
        }
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => kids,
                "Count" => 2,
                "Resources" => dictionary! {},
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            }),
        );
        let catalog = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
        doc.trailer.set("Root", catalog);
        doc.save(path).unwrap();
    }

    fn page_text(path: &Path) -> Vec<String> {
        let doc = Document::load(path).unwrap();
        doc.get_pages()
            .values()
            .map(|p| String::from_utf8_lossy(&doc.get_page_content(*p)).into_owned())
            .collect()
    }

    #[test]
    fn stamps_numbers_on_every_page_and_the_header_from_page_two() {
        let path = std::env::temp_dir().join("folio-furniture-a.pdf");
        two_pages(&path);
        let f = Furniture { header: Some("Q3 Review".into()), numbers: true };
        stamp(&path, &f).unwrap();
        let pages = page_text(&path);
        assert!(pages[0].contains("(Page 1 of 2)") && !pages[0].contains("Q3 Review"));
        assert!(pages[1].contains("(Page 2 of 2)") && pages[1].contains("(Q3 Review)"));
        // The page's own drawing is wrapped, so it cannot move the stamp.
        assert!(pages[1].starts_with("q\n"));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn a_title_helvetica_cannot_spell_is_left_off() {
        let path = std::env::temp_dir().join("folio-furniture-b.pdf");
        two_pages(&path);
        let f = Furniture { header: Some("季度报告".into()), numbers: true };
        stamp(&path, &f).unwrap();
        let pages = page_text(&path);
        assert!(pages[1].contains("(Page 2 of 2)") && !pages[1].contains("?"));
        std::fs::remove_file(&path).ok();
    }
}
