use crate::APP;
use dirs::cache_dir;
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::ImageEncoder;
use log::{info, warn};
use std::path::PathBuf;
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::Instant;
use xcap::Monitor;

// The capture is kicked off the moment the hotkey fires and runs while the
// overlay window and its webview are still starting up, because the two used to
// be strictly serial: ~0.9s of webview cold start followed by ~0.9s of capturing
// and encoding. The `screenshot` command below is what the webview calls once it
// is ready, and it only waits for this thread to finish.
static PENDING_CAPTURE: Mutex<Option<JoinHandle<Result<(), String>>>> = Mutex::new(None);

fn screenshot_path() -> Result<PathBuf, String> {
    let handle = APP.get().ok_or("App handle not initialized")?;
    let mut path = cache_dir().ok_or("Get Cache Dir Failed")?;
    path.push(&handle.config().identifier);
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    path.push("pot_screenshot.png");
    Ok(path)
}

fn capture_to_cache() -> Result<(), String> {
    let path = screenshot_path()?;

    // Picking the monitor from the cursor is what the frontend used to do by
    // handing us `currentMonitor().position`, except that it can only do so after
    // its window exists — which is exactly the wait this whole thing avoids.
    let tauri::PhysicalPosition { x, y } = crate::window::get_mouse_position();
    let monitor = Monitor::from_point(x, y).map_err(|e| e.to_string())?;
    info!(
        "Screenshot monitor {} for cursor at {}, {}",
        monitor.name().unwrap_or_default(),
        x,
        y
    );

    let capture_start = Instant::now();
    let image = monitor.capture_image().map_err(|e| e.to_string())?;
    let captured = capture_start.elapsed();

    // `Sub` plus fast deflate is what the screenshots crate did. Uncompressed was
    // measured as a wash: it saves ~240ms of encoding but the 33MB file costs
    // ~200ms more to hand to the webview through the asset protocol.
    let encode_start = Instant::now();
    let (width, height) = (image.width(), image.height());
    let mut buffer = Vec::new();
    PngEncoder::new_with_quality(&mut buffer, CompressionType::Fast, FilterType::Sub)
        .write_image(
            image.as_raw(),
            width,
            height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;
    std::fs::write(path, buffer).map_err(|e| e.to_string())?;
    info!(
        "Screenshot {}x{} captured in {:?}, encoded and written in {:?}",
        width,
        height,
        captured,
        encode_start.elapsed()
    );
    Ok(())
}

// Start capturing in the background. Called before the overlay window is built.
pub fn start_capture() {
    let mut pending = PENDING_CAPTURE.lock().unwrap();
    // A capture already in flight would be for an overlay that never opened;
    // joining it here keeps at most one capture thread alive at a time.
    if let Some(previous) = pending.take() {
        let _ = previous.join();
    }
    *pending = Some(std::thread::spawn(capture_to_cache));
}

// Wait for the capture started at hotkey time. Falls back to capturing inline so
// that opening the overlay through any other path still produces an image.
#[tauri::command(async)]
pub fn screenshot() -> Result<(), String> {
    let pending = PENDING_CAPTURE.lock().unwrap().take();
    match pending {
        Some(handle) => handle
            .join()
            .unwrap_or_else(|_| Err("Capture panicked".to_string())),
        None => {
            warn!("No capture in flight, capturing now");
            capture_to_cache()
        }
    }
}
