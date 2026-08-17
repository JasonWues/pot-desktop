use crate::config::{get, set};
use crate::window::*;
use crate::APP;
use log::{error, info, warn};
use std::panic::AssertUnwindSafe;
use std::thread;
use tauri_plugin_notification::NotificationExt;
use tiny_http::{Request, Response, Server};

pub fn start_server() {
    let port = match get("server_port") {
        Some(v) => v.as_i64().unwrap(),
        None => {
            set("server_port", 60828);
            60828
        }
    };
    thread::spawn(move || {
        let server = match Server::http(format!("127.0.0.1:{port}")) {
            Ok(v) => v,
            Err(e) => {
                let _ = APP
                    .get()
                    .unwrap()
                    .notification()
                    .builder()
                    .title("Server start failed")
                    .body("Please Change Server Port and restart the application")
                    .show();
                warn!("Server start failed: {}", e);
                return;
            }
        };
        for request in server.incoming_requests() {
            // A panic in a handler used to unwind out of this loop, which drops
            // the `Server` and closes the listener with it: one bad request and
            // the port was gone for the rest of the session, with the PopClip and
            // SnipDo extensions in `.scripts/` silently doing nothing from then
            // on. Isolating each request keeps the failure to that request.
            //
            // `AssertUnwindSafe` because `Request` is not `UnwindSafe`. Nothing is
            // observed after a panic here -- the request is dropped, and tiny_http
            // answers a dropped request with a 500 -- so there is no half-updated
            // state for the next iteration to see.
            let url = request.url().to_string();
            if std::panic::catch_unwind(AssertUnwindSafe(|| http_handle(request))).is_err() {
                error!("Handler for {url} panicked; server still listening");
            }
        }
    });
}

fn http_handle(request: Request) {
    info!("Handle {} request", request.url());
    match request.url() {
        "/" => handle_translate(request),
        "/config" => handle_config(request),
        "/translate" => handle_translate(request),
        "/selection_translate" => handle_selection_translate(request),
        "/input_translate" => handle_input_translate(request),
        "/ocr_recognize" => handle_ocr_recognize(request),
        "/ocr_translate" => handle_ocr_translate(request),
        "/ocr_recognize?screenshot=false" => handle_ocr_recognize(request),
        "/ocr_translate?screenshot=false" => handle_ocr_translate(request),
        "/ocr_recognize?screenshot=true" => handle_ocr_recognize(request),
        "/ocr_translate?screenshot=true" => handle_ocr_translate(request),
        _ => {
            // Answered rather than dropped. A dropped request still gets a
            // response -- tiny_http sends 500 -- so an unknown path used to look
            // to the caller exactly like the server falling over.
            warn!("Unknown request url: {}", request.url());
            respond(request, 404, "unknown path");
        }
    }
}

fn handle_config(request: Request) {
    config_window();
    response_ok(request);
}

fn handle_translate(mut request: Request) {
    let mut body = Vec::new();
    if let Err(e) = request.as_reader().read_to_end(&mut body) {
        warn!("Failed to read request body: {e}");
        respond(request, 400, "could not read request body");
        return;
    }
    // Lossy, where this used to be `read_to_string().unwrap()`. The body is text
    // someone wants translated, and a single stray byte -- a selection that
    // clipped a multi-byte character in half, say -- used to panic the handler
    // and, before the catch above, take the whole server down with it.
    let content = String::from_utf8_lossy(&body).into_owned();
    text_translate(content);
    response_ok(request);
}

fn handle_selection_translate(request: Request) {
    selection_translate();
    response_ok(request);
}

fn handle_input_translate(request: Request) {
    input_translate();
    response_ok(request);
}

fn handle_ocr_recognize(request: Request) {
    if request.url().ends_with("false") {
        recognize_window();
    } else {
        ocr_recognize();
    }
    response_ok(request);
}

fn handle_ocr_translate(request: Request) {
    if request.url().ends_with("false") {
        image_translate();
    } else {
        ocr_translate();
    }
    response_ok(request);
}

fn response_ok(request: Request) {
    respond(request, 200, "ok");
}

// Not `unwrap`: writing the response fails whenever the caller has already hung
// up, which is entirely its prerogative and not worth a panic.
fn respond(request: Request, status: u16, body: &str) {
    let response = Response::from_string(body).with_status_code(status);
    if let Err(e) = request.respond(response) {
        warn!("Failed to send response: {e}");
    }
}
