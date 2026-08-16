// OCR that keeps the geometry, for translating an image in place.
//
// `system_ocr` returns only the concatenated text, which is all the recognize
// services need. Painting a translation back over the original requires knowing
// where each line sat, so this is a separate command rather than a change to
// that contract.
//
// Windows only for now: `Windows.Media.Ocr` reports a `BoundingRect` per word,
// and none of the other recognize backends pot ships return geometry at all --
// they hand back a finished string.
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
#[cfg(not(target_os = "windows"))]
pub fn system_ocr_layout(_app_handle: tauri::AppHandle, _lang: &str) -> Result<OcrLayout, String> {
    Err("In-place image translation needs per-line OCR geometry, which is only available from the Windows OCR engine so far".to_string())
}
