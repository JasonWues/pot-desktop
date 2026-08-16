use crate::config::{get, set};
use log::{info, warn};
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use serde::Serialize;
use std::sync::OnceLock;

// Every HTTP call the app makes -- the frontend's `utils/http` shim, the updater,
// the WebDAV backup -- ends up in reqwest, and reqwest reads its proxy from these
// variables. Both spellings are listed because hyper-util (reqwest's proxy layer)
// checks the upper-case name first and only then the lower-case one: writing just
// one of them lets an inherited variable of the other spelling win instead.
const HTTP: [&str; 2] = ["HTTP_PROXY", "http_proxy"];
const HTTPS: [&str; 2] = ["HTTPS_PROXY", "https_proxy"];
const ALL: [&str; 2] = ["ALL_PROXY", "all_proxy"];
const NO: [&str; 2] = ["NO_PROXY", "no_proxy"];

fn every_name() -> impl Iterator<Item = &'static str> {
    HTTP.into_iter().chain(HTTPS).chain(ALL).chain(NO)
}

/// The proxy variables this process inherited from whatever launched it, captured
/// before anything here overwrites them.
///
/// This matters on Linux, where the environment *is* the system proxy setting:
/// "follow the system" has to put these back, not clear them. On Windows and macOS
/// they are usually absent and clearing them is what lets reqwest fall through to
/// the registry / network settings.
static INHERITED: OnceLock<Vec<(&'static str, Option<String>)>> = OnceLock::new();

/// Must run before any other function in this module. Called at the top of `main`.
pub fn capture_inherited_env() {
    let _ = INHERITED.set(every_name().map(|k| (k, std::env::var(k).ok())).collect());
}

fn inherited(names: [&str; 2]) -> Option<String> {
    let saved = INHERITED.get()?;
    names.into_iter().find_map(|name| {
        saved
            .iter()
            .find(|(k, _)| *k == name)
            .and_then(|(_, v)| v.clone())
            .filter(|v| !v.is_empty())
    })
}

fn restore_inherited() {
    let Some(saved) = INHERITED.get() else {
        warn!("proxy: inherited environment was never captured, leaving it alone");
        return;
    };
    for (key, value) in saved {
        match value {
            Some(v) => std::env::set_var(key, v),
            None => std::env::remove_var(key),
        }
    }
}

/// Writes both spellings, or removes both when the value is empty -- an empty
/// variable is not the same as an absent one, because hyper-util treats a set but
/// empty value as "nothing configured here" and then fills the gap from the
/// platform settings, which is the opposite of what an empty field means here.
fn set_pair(names: [&str; 2], value: &str) {
    for name in names {
        if value.is_empty() {
            std::env::remove_var(name);
        } else {
            std::env::set_var(name, value);
        }
    }
}

fn string_config(key: &str) -> Option<String> {
    get(key)
        .and_then(|v| v.as_str().map(str::to_string))
        .filter(|s| !s.is_empty())
}

/// `proxy_mode` replaced the older `proxy_enable` boolean.
///
/// The old `false` did not mean "no proxy": with the variables unset, reqwest falls
/// back to the Windows registry or the macOS network settings, so what it actually
/// produced was "follow the system". Migrating it to `system` keeps every existing
/// install behaving exactly as it did; migrating it to `off` would silently take
/// the proxy away from everyone who relied on the fallback.
pub fn migrate_config() {
    if get("proxy_mode").is_some() {
        return;
    }
    let enabled = get("proxy_enable")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let mode = if enabled { "manual" } else { "system" };
    info!("proxy: migrating proxy_enable={enabled} to proxy_mode={mode}");
    set("proxy_mode", mode);
}

/// Builds the manual proxy URL, returning it alongside a copy safe to write to the
/// log -- the real one can carry a password, and the log file is shipped to us
/// whenever someone reports a bug.
///
/// Credentials are percent encoded because hyper-util percent *decodes* the
/// userinfo it parses out of the proxy URL, so a password containing `@`, `:` or
/// `%` would otherwise be split in the wrong place or silently mangled.
fn manual_url(host: &str, port: i64) -> (String, String) {
    let Some(user) = string_config("proxy_username") else {
        let url = format!("http://{host}:{port}");
        return (url.clone(), url);
    };
    // `NON_ALPHANUMERIC` encodes more than strictly required, which is harmless
    // here: everything is decoded again on the way out.
    let encode = |s: &str| utf8_percent_encode(s, NON_ALPHANUMERIC).to_string();
    let password = string_config("proxy_password").unwrap_or_default();
    (
        format!(
            "http://{}:{}@{host}:{port}",
            encode(&user),
            encode(&password)
        ),
        format!("http://{}:***@{host}:{port}", encode(&user)),
    )
}

/// Applies `proxy_mode` to this process's environment. Safe to call repeatedly.
///
/// Called once at startup rather than exposed to the frontend: `useConfig` debounces
/// its writes to the store, so a command invoked the moment the dropdown changes
/// would read the previous value. Changing the proxy has always asked for a restart.
pub fn apply_proxy() -> Result<(), String> {
    // Always start from the inherited state so that switching modes at runtime
    // cannot leave a stale variable from the previous mode behind.
    restore_inherited();

    match string_config("proxy_mode").as_deref().unwrap_or("system") {
        "manual" => {
            let host = string_config("proxy_host").ok_or("proxy host is not configured")?;
            let port = get("proxy_port")
                .and_then(|v| v.as_i64())
                .ok_or("proxy port is not configured")?;
            let (url, logged) = manual_url(&host, port);
            set_pair(HTTP, &url);
            set_pair(HTTPS, &url);
            set_pair(ALL, &url);
            set_pair(NO, &string_config("no_proxy").unwrap_or_default());
            info!("proxy: manual, using {logged}");
        }
        "off" => {
            for name in [HTTP, HTTPS, ALL].into_iter().flatten() {
                std::env::remove_var(name);
            }
            // Clearing the variables is not enough on its own: with nothing set,
            // reqwest still consults the registry / network settings. `*` is
            // hyper-util's one wildcard and it suppresses that lookup as well.
            set_pair(NO, "*");
            info!("proxy: disabled");
        }
        // "system", and anything unrecognised: leave the inherited environment in
        // place and let reqwest resolve the rest from the platform.
        _ => info!("proxy: following the system"),
    }
    Ok(())
}

/// What the platform and the inherited environment say the proxy is.
///
/// Display only -- the value actually used is resolved inside reqwest. This
/// reproduces reqwest's own precedence (environment first, platform settings for
/// whatever the environment left empty) so that what the settings page shows is
/// what the requests will do.
#[derive(Serialize, Default)]
pub struct SystemProxy {
    pub http: Option<String>,
    pub https: Option<String>,
    pub no_proxy: Option<String>,
    /// Set when the platform is configured with a PAC script. reqwest does not
    /// execute PAC, so a proxy reachable only through one will not be used, and
    /// the settings page warns about it rather than reporting "no proxy found".
    pub pac_url: Option<String>,
    pub source: String,
}

#[tauri::command]
pub fn get_system_proxy() -> SystemProxy {
    let mut found = platform_proxy();
    let from_env = [
        (inherited(HTTP), &mut found.http),
        (inherited(HTTPS), &mut found.https),
        (inherited(NO), &mut found.no_proxy),
    ]
    .into_iter()
    .fold(false, |any, (value, slot)| match value {
        Some(v) => {
            *slot = Some(v);
            true
        }
        None => any,
    });
    // ALL_PROXY stands in for either of the two it does not override.
    if let Some(all) = inherited(ALL) {
        found.http.get_or_insert_with(|| all.clone());
        found.https.get_or_insert(all);
    }
    if from_env {
        found.source = "env".to_string();
    }
    found
}

#[cfg(windows)]
fn platform_proxy() -> SystemProxy {
    // Deliberately the same keys, in the same order, as hyper-util's own Windows
    // reader, so the panel cannot disagree with the request that follows.
    let mut found = SystemProxy {
        source: "registry".to_string(),
        ..Default::default()
    };
    let Ok(settings) = windows_registry::CURRENT_USER
        .open(r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
    else {
        return found;
    };

    if let Ok(url) = settings.get_string("AutoConfigURL") {
        if !url.is_empty() {
            found.pac_url = Some(url);
        }
    }
    if settings.get_u32("ProxyEnable").unwrap_or(0) == 0 {
        return found;
    }
    if let Ok(server) = settings.get_string("ProxyServer") {
        if !server.is_empty() {
            found.http = Some(server.clone());
            found.https = Some(server);
        }
    }
    if let Ok(over) = settings.get_string("ProxyOverride") {
        if !over.is_empty() {
            found.no_proxy = Some(
                over.split(';')
                    .map(str::trim)
                    .collect::<Vec<&str>>()
                    .join(",")
                    .replace("*.", ""),
            );
        }
    }
    found
}

#[cfg(target_os = "macos")]
fn platform_proxy() -> SystemProxy {
    let mut found = SystemProxy {
        source: "scutil".to_string(),
        ..Default::default()
    };
    let Ok(output) = std::process::Command::new("scutil").arg("--proxy").output() else {
        return found;
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let field = |name: &str| {
        text.lines().find_map(|line| {
            let (key, value) = line.split_once(':')?;
            (key.trim() == name).then(|| value.trim().to_string())
        })
    };
    let enabled = |name: &str| field(name).as_deref() == Some("1");
    let endpoint = |host: &str, port: &str| match (field(host), field(port)) {
        (Some(h), Some(p)) if !h.is_empty() => Some(format!("{h}:{p}")),
        _ => None,
    };

    if enabled("ProxyAutoConfigEnable") {
        found.pac_url = field("ProxyAutoConfigURLString").filter(|u| !u.is_empty());
    }
    if enabled("HTTPEnable") {
        found.http = endpoint("HTTPProxy", "HTTPPort");
    }
    if enabled("HTTPSEnable") {
        found.https = endpoint("HTTPSProxy", "HTTPSPort");
    }
    // ExceptionsList is not a scalar -- scutil prints it as a nested block of
    // numbered entries, so it has to be collected rather than read like the rest:
    //     ExceptionsList : <array> {
    //       0 : *.local
    //       1 : 169.254/16
    //     }
    let exceptions: Vec<&str> = text
        .lines()
        .skip_while(|line| !line.trim_start().starts_with("ExceptionsList :"))
        .skip(1)
        .take_while(|line| !line.trim().starts_with('}'))
        .filter_map(|line| line.split_once(':').map(|(_, value)| value.trim()))
        .filter(|value| !value.is_empty())
        .collect();
    if !exceptions.is_empty() {
        found.no_proxy = Some(exceptions.join(","));
    }
    found
}

#[cfg(not(any(windows, target_os = "macos")))]
fn platform_proxy() -> SystemProxy {
    // There is no registry to read here: on Linux the environment the app was
    // launched with is the whole of the system setting, and `get_system_proxy`
    // layers that on top of this empty result.
    SystemProxy {
        source: "env".to_string(),
        ..Default::default()
    }
}
