//! Page furniture on exported PDFs (ADR-0027, spec: docs/specs/print.md):
//! the running header and "Page n of N", stamped onto the PDF WebKitGTK
//! writes - its print engine ignores CSS page-margin boxes, which is how
//! a browser's print gets them. Placed to match the print stylesheet's
//! `@page` margin boxes: header top-left from page 2, numbers bottom-right.

use lopdf::{dictionary, Dictionary, Document, Object, ObjectId, Stream};
use std::path::Path;

/// What to put on the pages of one print SECTION (spec:
/// docs/specs/print.md, "Page sections"): the web resolves the
/// document's `::: page` blocks into one of these per section, and the
/// export prints each section separately so its furniture can be
/// stamped at absolute page offsets before merging.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SectionFurniture {
    /// The running header (top left), from page 2 of the DOCUMENT on.
    #[serde(default)]
    pub header: Option<String>,
    /// The running footer (bottom left).
    #[serde(default)]
    pub footer: Option<String>,
    /// "Page n of N", bottom right.
    #[serde(default = "default_true")]
    pub numbers: bool,
    /// The section's paper size key ("a4", "16:9", ...).
    #[serde(default = "default_page_size")]
    pub page_size: String,
    /// The section's orientation: "portrait" | "landscape".
    #[serde(default = "default_portrait")]
    pub orientation: String,
}

/// The furniture of one absolute page of the merged export.
#[derive(Debug, Clone)]
pub struct PageFurniture {
    pub header: Option<String>,
    pub footer: Option<String>,
    pub numbers: bool,
}

fn default_page_size() -> String {
    "a4".to_string()
}

fn default_true() -> bool {
    true
}

fn default_portrait() -> String {
    "portrait".to_string()
}

/// Merge section PDFs into one file, in order (lopdf: renumber each
/// source's objects out of the way, copy them over, re-parent its
/// pages onto the merged Pages node).
pub fn merge(paths: &[std::path::PathBuf], out: &Path) -> Result<(), String> {
    let mut document = Document::with_version("1.5");
    let pages_id = document.new_object_id();
    let mut max_id = document.max_id + 1;
    let mut kids: Vec<Object> = Vec::new();
    for p in paths {
        let mut doc = Document::load(p).map_err(|e| e.to_string())?;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;
        let page_ids: Vec<ObjectId> = doc.get_pages().into_values().collect();
        for (id, obj) in std::mem::take(&mut doc.objects) {
            document.objects.insert(id, obj);
        }
        for pid in page_ids {
            if let Ok(dict) = document.get_dictionary_mut(pid) {
                let _ = dict.set("Parent", pages_id);
            }
            kids.push(Object::Reference(pid));
        }
    }
    let count = kids.len();
    document.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => kids,
            "Count" => count as i64,
        }),
    );
    let catalog = document.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    document.trailer.set("Root", catalog);
    document.save(out).map_err(|e| e.to_string())?;
    Ok(())
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

/// A text Helvetica can spell (WinAnsi), or None - an unspellable
/// title is left off rather than printed as "???".
fn spellable(s: &str) -> Option<&str> {
    let t = s.trim();
    if t.is_empty() || !t.chars().all(|c| win_ansi(c) != b'?' || c == '?') {
        None
    } else {
        Some(t)
    }
}

/// Stamp per-page furniture onto the PDF at `path`, in place. `pages`
/// is one entry per absolute page of the merged document: the header
/// is suppressed on the document's first page only (it carries the
/// title), footers go bottom left, numbers bottom right as absolute
/// "Page n of N" (spec: docs/specs/print.md, "Page sections").
pub fn stamp_pages(path: &Path, pages: &[PageFurniture]) -> Result<(), String> {
    if pages
        .iter()
        .all(|p| p.header.is_none() && p.footer.is_none() && !p.numbers)
    {
        return Ok(());
    }
    let mut doc = Document::load(path).map_err(|e| e.to_string())?;
    let font = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
        "Encoding" => "WinAnsiEncoding",
    });
    let page_ids: Vec<ObjectId> = doc.get_pages().into_values().collect();
    let total = page_ids.len();
    if pages.len() != total {
        return Err(format!(
            "furniture for {} pages but the PDF has {total}",
            pages.len()
        ));
    }
    for (i, page) in page_ids.iter().enumerate() {
        let f = &pages[i];
        let abs = i + 1;
        let (w, h) = media_box(&doc, *page);
        let mut ops: Vec<u8> = b"Q q 0.42 g BT\n".to_vec();
        let font_op = format!("/{} {SIZE} Tf\n", String::from_utf8_lossy(FONT_NAME));
        ops.extend_from_slice(font_op.as_bytes());
        if let Some(title) = f.header.as_deref().and_then(spellable).filter(|_| abs > 1) {
            let line = format!("1 0 0 1 {:.2} {:.2} Tm ", 16.0 * MM, h - 11.0 * MM);
            ops.extend_from_slice(line.as_bytes());
            ops.extend_from_slice(&pdf_string(title));
            ops.extend_from_slice(b" Tj\n");
        }
        if let Some(foot) = f.footer.as_deref().and_then(spellable) {
            let line = format!("1 0 0 1 {:.2} {:.2} Tm ", 16.0 * MM, 9.0 * MM);
            ops.extend_from_slice(line.as_bytes());
            ops.extend_from_slice(&pdf_string(foot));
            ops.extend_from_slice(b" Tj\n");
        }
        if f.numbers {
            let label = format!("Page {abs} of {total}");
            let x = w - 16.0 * MM - text_width(&label);
            let line = format!("1 0 0 1 {:.2} {:.2} Tm ", x, 9.0 * MM);
            ops.extend_from_slice(line.as_bytes());
            ops.extend_from_slice(&pdf_string(&label));
            ops.extend_from_slice(b" Tj\n");
        }
        ops.extend_from_slice(b"ET Q\n");
        add_font(&mut doc, *page, font)?;
        // Wrap what the page already draws in q ... Q, so no state it
        // leaves behind (a transform, a colour) moves the furniture.
        let opening = doc.add_object(Stream::new(Dictionary::new(), b"q\n".to_vec()));
        let page_dict = doc.get_dictionary_mut(*page).map_err(|e| e.to_string())?;
        let mut contents = match page_dict.get(b"Contents") {
            Ok(Object::Reference(id)) => vec![Object::Reference(*id)],
            Ok(Object::Array(a)) => a.clone(),
            _ => vec![],
        };
        contents.insert(0, Object::Reference(opening));
        page_dict.set("Contents", contents);
        // `ops` starts with Q (closing the wrap) then opens its own q.
        doc.add_page_contents(*page, ops)
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
        let pages = vec![
            PageFurniture {
                header: Some("Q3 Review".into()),
                footer: None,
                numbers: true,
            },
            PageFurniture {
                header: Some("Q3 Review".into()),
                footer: None,
                numbers: true,
            },
        ];
        stamp_pages(&path, &pages).unwrap();
        let out = page_text(&path);
        assert!(out[0].contains("(Page 1 of 2)") && !out[0].contains("Q3 Review"));
        assert!(out[1].contains("(Page 2 of 2)") && out[1].contains("(Q3 Review)"));
        // The page's own drawing is wrapped, so it cannot move the stamp.
        assert!(out[1].starts_with("q\n"));
        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn a_title_helvetica_cannot_spell_is_left_off() {
        let path = std::env::temp_dir().join("folio-furniture-b.pdf");
        two_pages(&path);
        let pages = vec![
            PageFurniture {
                header: Some("季度报告".into()),
                footer: None,
                numbers: true,
            },
            PageFurniture {
                header: Some("季度报告".into()),
                footer: None,
                numbers: true,
            },
        ];
        stamp_pages(&path, &pages).unwrap();
        let out = page_text(&path);
        assert!(out[1].contains("(Page 2 of 2)") && !out[1].contains("?"));
        std::fs::remove_file(&path).ok();
    }

    /// Sections (spec: docs/specs/print.md, "Page sections"): per-page
    /// furniture, footer bottom left, and ABSOLUTE numbering across
    /// the merged document - a section break never restarts the count.
    #[test]
    fn stamps_per_section_pages_with_absolute_numbers_and_footer() {
        let path = std::env::temp_dir().join("folio-furniture-c.pdf");
        // A three-page merged export: section 0 = pages 1-2, section 1 = page 3.
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let mut kids = vec![];
        for _ in 0..3 {
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
                "Count" => 3,
                "Resources" => dictionary! {},
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            }),
        );
        let catalog = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
        doc.trailer.set("Root", catalog);
        doc.save(&path).unwrap();

        let pages = vec![
            PageFurniture { header: Some("Doc title".into()), footer: Some("Draft".into()), numbers: true },
            PageFurniture { header: Some("Doc title".into()), footer: Some("Draft".into()), numbers: true },
            PageFurniture { header: Some("Part Two".into()), footer: None, numbers: true },
        ];
        stamp_pages(&path, &pages).unwrap();
        let out = page_text(&path);
        // Page 1: no header (carries the title), footer + numbers.
        assert!(!out[0].contains("(Doc title)") && out[0].contains("(Draft)") && out[0].contains("(Page 1 of 3)"));
        // Page 3: the new section's header, no footer, absolute number.
        assert!(out[2].contains("(Part Two)") && !out[2].contains("(Draft)") && out[2].contains("(Page 3 of 3)"));
        std::fs::remove_file(&path).ok();
    }

    /// The export merges the per-section PDFs in document order.
    #[test]
    fn merges_section_pdfs_in_order() {
        let dir = std::env::temp_dir();
        let a = dir.join("folio-merge-a.pdf");
        let b = dir.join("folio-merge-b.pdf");
        let out = dir.join("folio-merge-out.pdf");
        two_pages(&a);
        two_pages(&b);
        merge(&[a.clone(), b.clone()], &out).unwrap();
        let doc = Document::load(&out).unwrap();
        assert_eq!(doc.get_pages().len(), 4);
        std::fs::remove_file(&a).ok();
        std::fs::remove_file(&b).ok();
        std::fs::remove_file(&out).ok();
    }
}
