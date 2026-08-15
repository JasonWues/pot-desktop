// Offline text-to-speech through whatever the OS already ships:
// Windows.Media.SpeechSynthesis on Windows, `say` on macOS, `espeak-ng`/`espeak`
// on Linux.
//
// Every backend is made to produce a WAV, which is handed to the frontend as
// base64. The frontend contract for a tts service is "return the bytes of an
// audio file" (see `useVoice`), and base64 keeps the IPC payload roughly the
// size of the audio instead of the 4-6x blowup of a JSON number array.

#[derive(serde::Serialize)]
pub struct TtsVoice {
    pub name: String,
    pub language: String,
}

// `rate` is a multiplier around the platform default, so the same config value
// means the same thing on all three platforms. Windows takes the multiplier
// directly, the unix backends want words per minute.
#[cfg(not(target_os = "windows"))]
fn wpm_from_rate(rate: f64) -> i64 {
    const DEFAULT_WORDS_PER_MINUTE: f64 = 175.0;
    (DEFAULT_WORDS_PER_MINUTE * rate).round().clamp(50.0, 500.0) as i64
}

// Both unix backends read the text from a file rather than argv: the text is
// user supplied and may start with `-`, which every one of these binaries would
// otherwise parse as a flag.
#[cfg(not(target_os = "windows"))]
fn write_temp_input(app_handle: &tauri::AppHandle, text: &str) -> Result<std::path::PathBuf, String> {
    let mut dir = dirs::cache_dir().ok_or("Get Cache Dir Failed")?;
    dir.push(&app_handle.config().identifier);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("pot_tts_input.txt");
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(path)
}

#[cfg(not(target_os = "windows"))]
fn temp_output_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let mut dir = dirs::cache_dir().ok_or("Get Cache Dir Failed")?;
    dir.push(&app_handle.config().identifier);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("pot_tts_output.wav"))
}

#[cfg(not(target_os = "windows"))]
fn read_and_encode(path: &std::path::Path) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    if bytes.is_empty() {
        return Err("The speech synthesizer produced no audio".to_string());
    }
    Ok(STANDARD.encode(bytes))
}

#[tauri::command(async)]
#[cfg(target_os = "windows")]
pub fn system_tts(
    _app_handle: tauri::AppHandle,
    text: String,
    voice: String,
    rate: f64,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use windows::core::HSTRING;
    use windows::Media::SpeechSynthesis::SpeechSynthesizer;
    use windows::Storage::Streams::DataReader;

    let synth = SpeechSynthesizer::new().map_err(|e| e.to_string())?;

    if !voice.is_empty() {
        let all = SpeechSynthesizer::AllVoices().map_err(|e| e.to_string())?;
        for i in 0..all.Size().map_err(|e| e.to_string())? {
            let v = all.GetAt(i).map_err(|e| e.to_string())?;
            if v.DisplayName().map_err(|e| e.to_string())?.to_string_lossy() == voice {
                synth.SetVoice(&v).map_err(|e| e.to_string())?;
                break;
            }
        }
    }

    // SpeakingRate is already a multiplier of the voice's natural rate.
    if let Ok(options) = synth.Options() {
        let _ = options.SetSpeakingRate(rate.clamp(0.5, 6.0));
    }

    let stream = synth
        .SynthesizeTextToStreamAsync(&HSTRING::from(text))
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;

    let size = stream.Size().map_err(|e| e.to_string())? as u32;
    let input = stream.GetInputStreamAt(0).map_err(|e| e.to_string())?;
    let reader = DataReader::CreateDataReader(&input).map_err(|e| e.to_string())?;
    reader
        .LoadAsync(size)
        .map_err(|e| e.to_string())?
        .join()
        .map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; size as usize];
    reader.ReadBytes(&mut buf).map_err(|e| e.to_string())?;

    if buf.is_empty() {
        return Err("The speech synthesizer produced no audio".to_string());
    }
    Ok(STANDARD.encode(buf))
}

#[tauri::command(async)]
#[cfg(target_os = "macos")]
pub fn system_tts(
    app_handle: tauri::AppHandle,
    text: String,
    voice: String,
    rate: f64,
) -> Result<String, String> {
    let input_path = write_temp_input(&app_handle, &text)?;
    let output_path = temp_output_path(&app_handle)?;

    let mut cmd = std::process::Command::new("say");
    cmd.arg("-f")
        .arg(&input_path)
        .arg("-o")
        .arg(&output_path)
        .arg("--file-format=WAVE")
        .arg("--data-format=LEI16@22050")
        .arg("-r")
        .arg(wpm_from_rate(rate).to_string());
    if !voice.is_empty() {
        cmd.arg("-v").arg(&voice);
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    read_and_encode(&output_path)
}

#[tauri::command(async)]
#[cfg(target_os = "linux")]
pub fn system_tts(
    app_handle: tauri::AppHandle,
    text: String,
    voice: String,
    rate: f64,
) -> Result<String, String> {
    let input_path = write_temp_input(&app_handle, &text)?;
    let output_path = temp_output_path(&app_handle)?;

    let mut last_error = String::new();
    for binary in ["espeak-ng", "espeak"] {
        let mut cmd = std::process::Command::new(binary);
        cmd.arg("-f")
            .arg(&input_path)
            .arg("-w")
            .arg(&output_path)
            .arg("-s")
            .arg(wpm_from_rate(rate).to_string());
        if !voice.is_empty() {
            cmd.arg("-v").arg(&voice);
        }

        match cmd.output() {
            Ok(output) => {
                if output.status.success() {
                    return read_and_encode(&output_path);
                }
                last_error = String::from_utf8_lossy(&output.stderr).trim().to_string();
            }
            Err(e) => {
                // os error 2 is "not found"; try the next binary before giving up.
                if e.to_string().contains("os error 2") {
                    last_error = "espeak-ng not installed!\nPlease try install espeak-ng".to_string();
                    continue;
                }
                last_error = e.to_string();
            }
        }
    }
    Err(last_error)
}

#[tauri::command(async)]
#[cfg(target_os = "windows")]
pub fn system_tts_voices() -> Result<Vec<TtsVoice>, String> {
    use windows::Media::SpeechSynthesis::SpeechSynthesizer;

    let all = SpeechSynthesizer::AllVoices().map_err(|e| e.to_string())?;
    let mut voices = Vec::new();
    for i in 0..all.Size().map_err(|e| e.to_string())? {
        let v = all.GetAt(i).map_err(|e| e.to_string())?;
        voices.push(TtsVoice {
            name: v
                .DisplayName()
                .map_err(|e| e.to_string())?
                .to_string_lossy(),
            language: v.Language().map_err(|e| e.to_string())?.to_string_lossy(),
        });
    }
    Ok(voices)
}

#[tauri::command(async)]
#[cfg(target_os = "macos")]
pub fn system_tts_voices() -> Result<Vec<TtsVoice>, String> {
    // `say -v '?'` prints "<name padded>  <locale>  # <example sentence>".
    // The example may itself contain spaces and '#', so cut at the first '#'
    // and take the last whitespace separated token of the remainder as locale.
    let output = std::process::Command::new("say")
        .arg("-v")
        .arg("?")
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut voices = Vec::new();
    for line in stdout.lines() {
        let head = line.split('#').next().unwrap_or("").trim();
        if head.is_empty() {
            continue;
        }
        match head.rsplit_once(char::is_whitespace) {
            Some((name, language)) => voices.push(TtsVoice {
                name: name.trim().to_string(),
                language: language.trim().to_string(),
            }),
            None => continue,
        }
    }
    Ok(voices)
}

#[tauri::command(async)]
#[cfg(target_os = "linux")]
pub fn system_tts_voices() -> Result<Vec<TtsVoice>, String> {
    // `espeak-ng --voices` prints a header row and then
    // "Pty Language Age/Gender VoiceName File Other Languages".
    let mut last_error = String::new();
    for binary in ["espeak-ng", "espeak"] {
        let output = match std::process::Command::new(binary).arg("--voices").output() {
            Ok(v) => v,
            Err(e) => {
                last_error = if e.to_string().contains("os error 2") {
                    "espeak-ng not installed!\nPlease try install espeak-ng".to_string()
                } else {
                    e.to_string()
                };
                continue;
            }
        };
        if !output.status.success() {
            last_error = String::from_utf8_lossy(&output.stderr).trim().to_string();
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut voices = Vec::new();
        for line in stdout.lines().skip(1) {
            let fields: Vec<&str> = line.split_whitespace().collect();
            if fields.len() < 4 {
                continue;
            }
            voices.push(TtsVoice {
                name: fields[3].to_string(),
                language: fields[1].to_string(),
            });
        }
        return Ok(voices);
    }
    Err(last_error)
}
