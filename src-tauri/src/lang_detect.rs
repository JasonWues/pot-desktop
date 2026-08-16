use std::sync::OnceLock;
use whatlang::{Detector, Lang};

// Only the languages pot can actually return. Without an allowlist whatlang
// weighs all 69 of its languages, and short strings drift into neighbours the
// app has no code for -- English routinely comes back as Slovak or Catalan.
const SUPPORTED: [Lang; 19] = [
    Lang::Cmn,
    Lang::Jpn,
    Lang::Eng,
    Lang::Kor,
    Lang::Fra,
    Lang::Spa,
    Lang::Deu,
    Lang::Rus,
    Lang::Ita,
    Lang::Por,
    Lang::Tur,
    Lang::Ara,
    Lang::Vie,
    Lang::Tha,
    Lang::Ind,
    Lang::Hin,
    Lang::Nob,
    Lang::Pes,
    Lang::Ukr,
];

static DETECTOR: OnceLock<Detector> = OnceLock::new();

fn detector() -> &'static Detector {
    DETECTOR.get_or_init(|| Detector::with_allowlist(SUPPORTED.to_vec()))
}

/// Builds the detector ahead of the first translation. It used to be rebuilt on
/// every single call, which is why this exists at all; now it is one allocation.
pub fn init_lang_detect() {
    let _ = detector().detect_lang("Hello Language");
}

/// Mongolian is written in Cyrillic and whatlang has no model for it, so on the
/// letters alone it lands on Russian or Ukrainian. Ө and Ү (with their lowercase
/// forms) are the giveaway: among the Cyrillic languages pot supports -- Russian,
/// Ukrainian and Mongolian -- only Mongolian uses them.
fn is_mongolian(text: &str) -> bool {
    text.chars()
        .any(|c| matches!(c, 'Ө' | 'ө' | 'Ү' | 'ү'))
}

#[tauri::command]
pub fn lang_detect(text: &str) -> Result<&'static str, ()> {
    if is_mongolian(text) {
        return Ok("mn_cy");
    }
    let Some(lang) = detector().detect_lang(text) else {
        return Ok("en");
    };
    Ok(match lang {
        Lang::Cmn => "zh_cn",
        Lang::Jpn => "ja",
        Lang::Eng => "en",
        Lang::Kor => "ko",
        Lang::Fra => "fr",
        Lang::Spa => "es",
        Lang::Deu => "de",
        Lang::Rus => "ru",
        Lang::Ita => "it",
        Lang::Por => "pt_pt",
        Lang::Tur => "tr",
        Lang::Ara => "ar",
        Lang::Vie => "vi",
        Lang::Tha => "th",
        // whatlang has no separate Malay model. Indonesian and Malay are close
        // enough that it answers Ind for both, so Malay text now detects as `id`.
        Lang::Ind => "id",
        Lang::Hin => "hi",
        // Likewise no Nynorsk model; both Norwegian forms come back as Bokmal.
        Lang::Nob => "nb_no",
        Lang::Pes => "fa",
        Lang::Ukr => "uk",
        // Unreachable while the allowlist above holds, but the enum has 69
        // variants and the match has to be total.
        _ => "en",
    })
}
