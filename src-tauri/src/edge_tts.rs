// Microsoft Edge's read-aloud voices.
//
// This lives in Rust rather than in a `src/services/tts/*` module like the other
// speech services, because the endpoint is a WebSocket that rejects the handshake
// unless `Origin` and `User-Agent` are set -- and a webview's `WebSocket` cannot
// set either. Without them the server answers 403; with them it upgrades.
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::time::Duration;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

const TRUSTED_CLIENT_TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL: &str = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const VOICES_URL: &str =
    "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list";
const ORIGIN: &str = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";

// Must track the Chromium build the service currently expects: a stale value is
// rejected with 403 even though the token itself is computed correctly, which is
// the failure mode to look for first if this ever stops working.
const CHROMIUM_VERSION: &str = "143.0.3650.75";

const TIMEOUT: Duration = Duration::from_secs(30);

fn user_agent() -> String {
    let major = CHROMIUM_VERSION.split('.').next().unwrap_or("143");
    format!(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) \
         Chrome/{major}.0.0.0 Safari/537.36 Edg/{major}.0.0.0"
    )
}

/// The anti-abuse token the service expects: SHA-256 of the current time in
/// Windows ticks, rounded down to a five minute boundary, concatenated with the
/// client token. The rounding is what lets the server recompute it, and it also
/// means a badly wrong system clock shows up as a 403.
fn sec_ms_gec() -> String {
    let unix = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // 11644473600 is the offset from the Unix epoch to the Windows one.
    let mut seconds = unix + 11_644_473_600;
    seconds -= seconds % 300;
    let mut hasher = Sha256::new();
    hasher.update(format!("{}{TRUSTED_CLIENT_TOKEN}", seconds * 10_000_000));
    format!("{:X}", hasher.finalize())
}

fn timestamp() -> String {
    chrono::Utc::now()
        .format("%a %b %d %Y %H:%M:%S GMT+0000 (Coordinated Universal Time)")
        .to_string()
}

/// SSML is XML, and the text being spoken is arbitrary user input.
fn escape_ssml(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn query(connection_id: &str) -> String {
    format!(
        "TrustedClientToken={TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC={}&Sec-MS-GEC-Version=1-{CHROMIUM_VERSION}&ConnectionId={connection_id}",
        sec_ms_gec()
    )
}

/// Returns the spoken audio as base64 encoded MP3.
///
/// Base64 rather than the raw bytes for the same reason `system_tts` does it: the
/// IPC layer would otherwise serialize the audio as a JSON array of numbers.
#[tauri::command]
pub async fn edge_tts(
    text: String,
    voice: String,
    rate: String,
    pitch: String,
    volume: String,
) -> Result<String, String> {
    tokio::time::timeout(TIMEOUT, synthesize(text, voice, rate, pitch, volume))
        .await
        .map_err(|_| "Edge TTS timed out".to_string())?
}

async fn synthesize(
    text: String,
    voice: String,
    rate: String,
    pitch: String,
    volume: String,
) -> Result<String, String> {
    let connection_id = uuid::Uuid::new_v4().simple().to_string();
    let mut request = format!("{WSS_URL}?{}", query(&connection_id))
        .into_client_request()
        .map_err(|e| format!("Failed to build the Edge TTS request: {e}"))?;
    {
        let headers = request.headers_mut();
        headers.insert(
            "Origin",
            ORIGIN.parse().map_err(|_| "Invalid Origin".to_string())?,
        );
        headers.insert(
            "User-Agent",
            user_agent()
                .parse()
                .map_err(|_| "Invalid User-Agent".to_string())?,
        );
    }

    let (mut socket, _) = tokio_tungstenite::connect_async(request)
        .await
        .map_err(|e| format!("Edge TTS connection failed: {e}"))?;

    socket
        .send(Message::Text(
            format!(
                "X-Timestamp:{}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n\
                 {{\"context\":{{\"synthesis\":{{\"audio\":{{\"metadataoptions\":\
                 {{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"}},\
                 \"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}}}}}",
                timestamp()
            )
            .into(),
        ))
        .await
        .map_err(|e| format!("Failed to send the Edge TTS config: {e}"))?;

    socket
        .send(Message::Text(
            format!(
                "X-RequestId:{connection_id}\r\nContent-Type:application/ssml+xml\r\n\
                 X-Timestamp:{}Z\r\nPath:ssml\r\n\r\n\
                 <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\
                 <voice name='{voice}'><prosody pitch='{pitch}' rate='{rate}' volume='{volume}'>{}\
                 </prosody></voice></speak>",
                timestamp(),
                escape_ssml(&text)
            )
            .into(),
        ))
        .await
        .map_err(|e| format!("Failed to send the Edge TTS request: {e}"))?;

    let mut audio: Vec<u8> = Vec::new();
    while let Some(message) = socket.next().await {
        match message.map_err(|e| format!("Edge TTS stream error: {e}"))? {
            // The turn ends with a text frame; everything before it is preamble.
            Message::Text(frame) => {
                if frame.contains("Path:turn.end") {
                    break;
                }
            }
            // Each audio frame is a two byte big endian header length, that many
            // bytes of headers, then the MP3 slice.
            Message::Binary(frame) => {
                if frame.len() < 2 {
                    continue;
                }
                let header_len = u16::from_be_bytes([frame[0], frame[1]]) as usize;
                if let Some(chunk) = frame.get(2 + header_len..) {
                    audio.extend_from_slice(chunk);
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    if audio.is_empty() {
        return Err("Edge TTS returned no audio".to_string());
    }
    Ok(STANDARD.encode(audio))
}

/// The full voice catalogue, passed through as the service publishes it so the
/// settings page can group by `Locale` and label with `FriendlyName`.
#[tauri::command]
pub async fn edge_tts_voices() -> Result<Value, String> {
    let url = format!(
        "{VOICES_URL}?trustedclienttoken={TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC={}&Sec-MS-GEC-Version=1-{CHROMIUM_VERSION}",
        sec_ms_gec()
    );
    let response = reqwest::Client::new()
        .get(url)
        .header("User-Agent", user_agent())
        .header("Origin", ORIGIN)
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch the Edge TTS voice list: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch the Edge TTS voice list: HTTP {}",
            response.status()
        ));
    }
    response
        .json()
        .await
        .map_err(|e| format!("Failed to parse the Edge TTS voice list: {e}"))
}
