use crate::window::text_translate;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;

pub struct ClipboardMonitorEnableWrapper(pub Mutex<String>);

const POLL_INTERVAL: Duration = Duration::from_millis(500);

// At most one monitor at a time. The tray toggle starts one whenever it switches
// the setting on, but a task only stops when it next polls the flag, up to one
// interval later -- so switching off and straight back on left the old task
// running and spawned a second alongside it, and every copy was then translated
// twice over.
//
// Both the check below and the exit inside the loop happen while the enable
// flag's mutex is held. That is what orders them: a task that has already read
// "off" and is on its way out cannot be mistaken here for one that will keep
// running, and a task that reads the flag after the toggle wrote "on" sees the
// new value and stays.
static MONITOR_RUNNING: AtomicBool = AtomicBool::new(false);

pub fn start_clipboard_monitor(app_handle: tauri::AppHandle) {
    {
        let state = app_handle.state::<ClipboardMonitorEnableWrapper>();
        let _enabled = state.0.lock().unwrap();
        if MONITOR_RUNNING.swap(true, Ordering::SeqCst) {
            return;
        }
    }
    tauri::async_runtime::spawn(async move {
        let mut pre_text = "".to_string();
        loop {
            {
                let state = app_handle.state::<ClipboardMonitorEnableWrapper>();
                let enabled = state.0.lock().unwrap();
                if !enabled.contains("true") {
                    MONITOR_RUNNING.store(false, Ordering::SeqCst);
                    break;
                }
            }
            // Reading the clipboard outside the lock: it is the slow part of the
            // loop and the toggle should not have to wait behind it.
            if let Ok(v) = app_handle.clipboard().read_text() {
                if v != pre_text {
                    text_translate(v.clone());
                    pre_text = v;
                }
            }
            // `tokio::time::sleep`, not `std::thread::sleep`: this runs on the
            // async runtime, where blocking parks one of its worker threads for
            // the whole interval instead of yielding it.
            tokio::time::sleep(POLL_INTERVAL).await;
        }
    });
}
