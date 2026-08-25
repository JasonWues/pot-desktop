// OCR that keeps the geometry, for translating an image in place.
//
// `system_ocr` returns only the concatenated text, which is all the recognize
// services need. Painting a translation back over the original requires knowing
// where each line sat, so this is a separate command rather than a change to
// that contract.
//
// Windows and Linux: `Windows.Media.Ocr` reports a `BoundingRect` per word, and
// tesseract's `tsv` output has the same information in columns. macOS is the gap
// -- Vision does report a `boundingBox`, but Gloss reaches it through the
// prebuilt `resources/ocr-*-apple-darwin` binary, whose contract is a finished
// string and whose source is not in this repository.
use serde::Serialize;

#[derive(Serialize)]
pub struct OcrLine {
    pub text: String,
    // Pixel coordinates in the source image, origin top left.
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Serialize)]
pub struct OcrLayout {
    /// The source image's own pixel size, so the frontend can map these boxes
    /// onto however large it happens to be displaying the image.
    pub image_width: u32,
    pub image_height: u32,
    pub lines: Vec<OcrLine>,
}

#[tauri::command(async)]
#[cfg(target_os = "windows")]
pub fn system_ocr_layout(app_handle: tauri::AppHandle, lang: &str) -> Result<OcrLayout, String> {
    use dirs::cache_dir;

    let mut path = cache_dir().ok_or("Get Cache Dir Failed")?;
    path.push(&app_handle.config().identifier);
    path.push("pot_screenshot_cut.png");
    recognize_layout(&path.to_string_lossy().replace("\\\\?\\", ""), lang)
}

/// Split out from the command so it can be exercised against an arbitrary file.
#[cfg(target_os = "windows")]
pub fn recognize_layout(path: &str, lang: &str) -> Result<OcrLayout, String> {
    use windows::core::HSTRING;
    use windows::Globalization::Language;
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::{FileAccessMode, StorageFile};

    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path))
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;
    let stream = file
        .OpenAsync(FileAccessMode::Read)
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;
    let decoder = BitmapDecoder::CreateWithIdAsync(
        BitmapDecoder::PngDecoderId().map_err(|e| e.to_string())?,
        &stream,
    )
    .map_err(|e| e.to_string())?
    .join()
    .map_err(|e| e.to_string())?;
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;

    let image_width = bitmap.PixelWidth().map_err(|e| e.to_string())? as u32;
    let image_height = bitmap.PixelHeight().map_err(|e| e.to_string())? as u32;

    let engine = match lang {
        "auto" => OcrEngine::TryCreateFromUserProfileLanguages(),
        _ => match Language::CreateLanguage(&HSTRING::from(lang)) {
            Ok(language) => OcrEngine::TryCreateFromLanguage(&language),
            Err(_) => return Err("Language Error".to_string()),
        },
    };
    let engine = engine.map_err(|e| {
        if e.to_string().contains("0x00000000") {
            "Language package not installed!\n\nSee: https://learn.microsoft.com/zh-cn/windows/powertoys/text-extractor#supported-languages".to_string()
        } else {
            e.to_string()
        }
    })?;

    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;

    let mut lines = Vec::new();
    for line in result.Lines().map_err(|e| e.to_string())? {
        let text = line
            .Text()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .trim()
            .to_string();
        if text.is_empty() {
            continue;
        }
        // `OcrLine` carries no rectangle of its own, so the line's box is the
        // union of its words'.
        let (mut left, mut top) = (f32::MAX, f32::MAX);
        let (mut right, mut bottom) = (f32::MIN, f32::MIN);
        let mut any = false;
        for word in line.Words().map_err(|e| e.to_string())? {
            let rect = word.BoundingRect().map_err(|e| e.to_string())?;
            left = left.min(rect.X);
            top = top.min(rect.Y);
            right = right.max(rect.X + rect.Width);
            bottom = bottom.max(rect.Y + rect.Height);
            any = true;
        }
        if !any {
            continue;
        }
        lines.push(OcrLine {
            text,
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        });
    }

    Ok(OcrLayout {
        image_width,
        image_height,
        lines,
    })
}

#[tauri::command(async)]
#[cfg(target_os = "linux")]
pub fn system_ocr_layout(app_handle: tauri::AppHandle, lang: &str) -> Result<OcrLayout, String> {
    use dirs::cache_dir;

    let mut path = cache_dir().ok_or("Get Cache Dir Failed")?;
    path.push(&app_handle.config().identifier);
    path.push("pot_screenshot_cut.png");
    recognize_layout(&path.to_string_lossy(), lang)
}

/// Split out from the command so it can be exercised against an arbitrary file.
///
/// The same `tesseract` binary `system_ocr` already shells out to, asked for a
/// different output config. `stdout tsv` prints one row per recognised box
/// instead of the finished text, so no new dependency and no second OCR pass is
/// involved -- the language codes are the ones in `linuxLangMap`, exactly as for
/// the text-only path.
#[cfg(target_os = "linux")]
pub fn recognize_layout(path: &str, lang: &str) -> Result<OcrLayout, String> {
    let mut command = std::process::Command::new("tesseract");
    command.arg(path).arg("stdout").arg("tsv");
    // Not `["", ""]` the way `system_ocr` spells it: an empty argument is still
    // an argument, and tesseract reads the first one it does not recognise as a
    // second input file.
    if lang != "auto" {
        command.arg("-l").arg(lang);
    }

    let output = command.output().map_err(|e| {
        if e.to_string().contains("os error 2") {
            "Tesseract not installed!".to_string()
        } else {
            e.to_string()
        }
    })?;

    if !output.status.success() {
        let content = String::from_utf8(output.stderr).unwrap_or_default();
        // Same two messages as `system_ocr`, since it is the same failure and
        // the user has to install the same package to fix it.
        if content.contains("data") {
            if lang == "auto" {
                return Err(
                    "Language data not installed!\nPlease try install tesseract-ocr-eng".to_string(),
                );
            }
            return Err(format!(
                "Language data not installed!\nPlease try install tesseract-ocr-{lang}"
            ));
        }
        return Err(content);
    }

    // The TSV says nothing about the page it measured, and the boxes are
    // meaningless to the frontend without it. Read it from the PNG header --
    // `image_dimensions` stops there rather than decoding the pixels.
    let (image_width, image_height) = image::image_dimensions(path).map_err(|e| e.to_string())?;

    Ok(OcrLayout {
        image_width,
        image_height,
        lines: parse_tesseract_tsv(&String::from_utf8_lossy(&output.stdout)),
    })
}

/// Fold tesseract's word rows back into lines.
///
/// The columns are fixed: `level page_num block_num par_num line_num word_num
/// left top width height conf text`. Only `level` 5 is a word and only a word
/// carries text; the shallower levels repeat the same regions as empty rows, so
/// taking anything but 5 would count every box two or three times over.
///
/// Grouping by `(page, block, par, line)` and unioning the boxes matches what
/// the Windows path does with `line.Words()`, and for the same reason: a line's
/// own rectangle is tesseract's idea of the type area, which is looser than the
/// ink the frontend wants to paint over.
///
/// Kept out of the `linux` gate so it compiles and is tested everywhere; the
/// `test` arm is what puts it in a `cargo test` build on any host.
#[cfg(any(target_os = "linux", test))]
fn parse_tesseract_tsv(tsv: &str) -> Vec<OcrLine> {
    use std::collections::BTreeMap;

    struct Line {
        left: f32,
        top: f32,
        right: f32,
        bottom: f32,
        words: Vec<String>,
    }

    // Ordered by the key, which is reading order. The frontend re-sorts by
    // geometry anyway, but an ordered map costs nothing and makes the output
    // stable enough to assert on.
    let mut lines: BTreeMap<(u32, u32, u32, u32), Line> = BTreeMap::new();

    for row in tsv.lines() {
        let cols: Vec<&str> = row.split('\t').collect();
        // Also skips the header, whose `level` column is the word "level".
        if cols.len() < 12 || cols[0] != "5" {
            continue;
        }
        let text = cols[11].trim();
        if text.is_empty() {
            continue;
        }
        // -1 marks a box tesseract found but read nothing in. Anything it did
        // read is kept whatever the confidence: a threshold here would silently
        // punch holes in the overlay, and the Windows path applies none either.
        if cols[10].parse::<f32>().unwrap_or(-1.0) < 0.0 {
            continue;
        }

        let num = |i: usize| cols[i].parse::<u32>().ok();
        let (Some(page), Some(block), Some(par), Some(line)) = (num(1), num(2), num(3), num(4))
        else {
            continue;
        };
        let (Some(left), Some(top), Some(width), Some(height)) = (num(6), num(7), num(8), num(9))
        else {
            continue;
        };
        let (left, top) = (left as f32, top as f32);
        let (right, bottom) = (left + width as f32, top + height as f32);

        lines
            .entry((page, block, par, line))
            .and_modify(|acc| {
                acc.left = acc.left.min(left);
                acc.top = acc.top.min(top);
                acc.right = acc.right.max(right);
                acc.bottom = acc.bottom.max(bottom);
                acc.words.push(text.to_string());
            })
            .or_insert_with(|| Line {
                left,
                top,
                right,
                bottom,
                words: vec![text.to_string()],
            });
    }

    lines
        .into_values()
        .map(|acc| OcrLine {
            // Joined with spaces even for CJK, which is what the Windows engine
            // hands back too; `normalizeText` in the overlay strips them for the
            // languages where they are not word boundaries.
            text: acc.words.join(" "),
            x: acc.left,
            y: acc.top,
            width: acc.right - acc.left,
            height: acc.bottom - acc.top,
        })
        .collect()
}

#[tauri::command(async)]
#[cfg(not(any(target_os = "windows", target_os = "linux")))]
pub fn system_ocr_layout(_app_handle: tauri::AppHandle, _lang: &str) -> Result<OcrLayout, String> {
    Err("In-place image translation needs per-line OCR geometry, which Gloss can only get from the Windows OCR engine and from tesseract on Linux so far".to_string())
}

#[cfg(test)]
mod tests {
    use super::parse_tesseract_tsv;

    const HEADER: &str =
        "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

    #[test]
    fn folds_words_into_lines_and_unions_their_boxes() {
        let tsv = format!(
            "{HEADER}\n\
             1\t1\t0\t0\t0\t0\t0\t0\t400\t200\t-1\t\n\
             5\t1\t1\t1\t1\t1\t10\t20\t30\t12\t96\tHello\n\
             5\t1\t1\t1\t1\t2\t50\t18\t40\t16\t95\tworld\n\
             5\t1\t1\t1\t2\t1\t10\t40\t60\t14\t93\tsecond\n"
        );
        let lines = parse_tesseract_tsv(&tsv);

        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].text, "Hello world");
        assert_eq!((lines[0].x, lines[0].y), (10.0, 18.0));
        // The union, not either word: 50 + 40 - 10 wide, and (18 + 16) - 18 tall
        // -- `world` sits higher and runs lower than `Hello` does.
        assert_eq!((lines[0].width, lines[0].height), (80.0, 16.0));
        assert_eq!(lines[1].text, "second");
    }

    #[test]
    fn drops_the_header_the_structural_rows_and_the_empty_boxes() {
        let tsv = format!(
            "{HEADER}\n\
             2\t1\t1\t0\t0\t0\t10\t20\t80\t18\t-1\t\n\
             4\t1\t1\t1\t1\t0\t10\t20\t80\t18\t-1\t\n\
             5\t1\t1\t1\t1\t1\t10\t20\t30\t12\t-1\t \n\
             5\t1\t1\t1\t1\t2\t10\t20\t30\t12\t0\tkept\n"
        );
        let lines = parse_tesseract_tsv(&tsv);

        // A conf of 0 is still something tesseract read; -1 with blank text is not.
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "kept");
    }

    #[test]
    fn keeps_lines_apart_across_blocks_that_share_a_line_number() {
        let tsv = format!(
            "{HEADER}\n\
             5\t1\t1\t1\t1\t1\t10\t20\t30\t12\t90\tleft\n\
             5\t1\t2\t1\t1\t1\t200\t20\t30\t12\t90\tright\n"
        );
        let lines = parse_tesseract_tsv(&tsv);

        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].text, "left");
        assert_eq!(lines[1].text, "right");
    }
}
