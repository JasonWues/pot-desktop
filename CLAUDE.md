# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Pot is a cross-platform translation + OCR desktop app: a React 18 frontend (Vite, HeroUI v3, Tailwind 4) inside a Tauri 2 shell. Package manager is **pnpm** (Node >= 18, see `.node-version`).

## Commands

```bash
pnpm install            # install JS deps
pnpm tauri dev          # run the app (starts vite on :1420, then cargo)
pnpm tauri build        # build installers for the current platform
pnpm dev                # frontend only — mostly useless, every window calls into Tauri
npx prettier --write .  # format (config in .prettierrc.json: 4 spaces, single quotes, 120 cols)
```

Linux dev also needs (per `.github/actions/build-for-linux/entrypoint.sh` — note the README still lists the Tauri 1 webkit 4.0 packages): `libgtk-3-dev libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev libayatana-appindicator3-dev librsvg2-dev patchelf libxdo-dev libxcb1 libxrandr2 libdbus-1-3`.

There is **no test suite and no lint script** — verification is running the app. Rust side: `cargo check`/`cargo clippy` from `src-tauri/`.

Release packaging happens in `.github/workflows/package.yml` on push to `master`; it rewrites the version in `package.json`, `src-tauri/tauri.conf.json` and `Cargo.toml` from `git describe --tags`, so those version fields are not hand-maintained.

## Architecture

### One bundle, five windows

`index.html` → `src/main.jsx` → `src/App.jsx`. There is a single JS bundle; **which UI renders is chosen by the Tauri window label**, not by the router:

```js
const windowMap = { translate, screenshot, recognize, config, updater };
return <BrowserRouter>{windowMap[appWindow.label]}</BrowserRouter>;
```

Each entry maps to `src/window/<Name>/`. Rust creates those windows (`src-tauri/src/window.rs`: `translate_window`, `recognize_window`, `screenshot_window`, `config_window`, `updater_window`) positioned on the monitor under the mouse. A hidden `daemon` window (`daemon.html`, the second Vite rollup input) exists only so the backend always has a webview to query monitors from.

Entry points into those windows: global hotkeys (`hotkey.rs`), tray menu (`tray.rs`), clipboard monitor (`clipboard.rs`), and a localhost HTTP server on port `server_port` (default 60828, `server.rs`) used by the PopClip/SnipDo extensions in `.scripts/`.

### Config store — the app's shared state

Everything user-facing lives in one JSON store (`config.json` in the app config dir), managed by `tauri-plugin-store` and reachable from both sides:

- Rust: `config.rs` `get(key)` / `set(key, value)`.
- JS: `src/utils/store.js` exports a `LazyStore`; `initStore()` also installs an fs watcher that reloads it and calls `invoke('reload_store')`.
- React: **always use `useConfig(key, default)`** (`src/hooks/useConfig.jsx`). It seeds missing keys with the default, debounces writes back to the store, and emits/listens on a `<key>_changed` Tauri event so every window stays in sync (`.` and `@` in the key become `_` and `:` in the event name).

History and the translation cache live in SQLite, not the store. **Everything that touches sqlite goes through `src/utils/db.js`** — it owns the single shared connection plus the schema and indexes for both tables, so callers can assume they exist. Don't call `Database.load('sqlite:history.db')` directly (the one exception is `invoke_plugin.js`, which hands the raw `Database` class to `.potext` plugins).

The cache key is a hash of the text, languages, service instance **and its config** (`buildCacheKey`), so editing a prompt or endpoint misses the cache rather than replaying a stale result.

### Services (translate / recognize / tts / collection)

`src/services/<type>/<name>/` is the unit of extension, each with three files:

- `info.ts` — `info = { name, icon }` plus a `Language` enum mapping pot's language codes to the provider's.
- `index.jsx` — the actual call, e.g. `translate(text, from, to, { config })`; throws a string on failure.
- `Config.jsx` — the settings form; reads/writes its own config through `useConfig(instanceKey, defaults, { sync: false })` and usually test-calls the service before saving.

Register a new service by adding it to the barrel `src/services/<type>/index.jsx` **and** adding `services.<type>.<name>.*` strings to `src/i18n/locales/en_US.json` (other locales come from Weblate — only edit `en_US.json` and `zh_CN.json` by hand).

Users can configure **multiple instances of the same service**. The key is `name@randomId` (`src/utils/service_instance.ts`: `createServiceInstanceKey`, `getServiceName`, `whetherPluginService`); that key is both the config-store key and the list entry. Keys starting with `plugin` are third-party `.potext` plugins installed into `$APPCONFIG/plugins/<type>/<name>/`, loaded at call time by `invoke_plugin()` (`src/utils/invoke_plugin.js`), which `eval`s the plugin's `main.js` and hands it a `utils` object. `config.rs::check_service_available` prunes configured services whose builtin/plugin backing has disappeared.

### The Tauri 1 compatibility layer (important)

This branch migrated from Tauri 1.8 to Tauri 2 (`d44c7bb`). Two shims deliberately preserve the v1 surface, because ~37 service files _and every third-party plugin_ are written against it — **don't "modernize" call sites into raw v2 APIs**:

- `src/utils/http.js` — exports `fetch`/`Body`/`ResponseType` with the v1 shape (`res.ok`/`res.status`/`res.data`, `Body.json|text|form`, `query`, `responseType`) on top of `@tauri-apps/plugin-http`.
- `src/utils/env.js` — remaps v2's `linux|macos|windows` back to `Linux|Darwin|Windows_NT`, which the UI, `public/logo/*.svg` and plugins expect.

Other v2 consequences worth knowing: core APIs are now 15 separate plugins (see `Cargo.toml` / `package.json`); every frontend capability must be allow-listed in `src-tauri/capabilities/default.json` (a missing permission fails at runtime, e.g. `data-tauri-drag-region` needs `core:window:allow-start-dragging`); the store returns `undefined` (not `null`) for missing keys.

### Custom CSS must be wrapped in a layer

Tailwind 4 emits its utilities inside `@layer utilities`, and **unlayered CSS beats every cascade layer regardless of specificity**. Any plain rule in `src/style.css` or a component `style.css` therefore silently overrides the utility classes it collides with — this is not a specificity problem and adding classes will not fix it. Put app CSS in `@layer base` (resets) or `@layer components` (component classes), which is where `* { margin: 0 }` and `.config-item` now live. Under Tailwind 3 the same code was fine, because v3 emitted unlayered utilities that simply outranked `*` on specificity.

Two consequences of that, both load-bearing:

- **Inside `@layer components` nothing but source order separates your rule from HeroUI's.** `@heroui/styles` puts every `.button` / `.input` / `.modal__*` rule in that same layer, so a class of yours at the same specificity wins only if it is emitted later. That is why window stylesheets are `@import`ed from `src/style.css` **after** `@import '@heroui/styles'` (`src/window/Translate/style.css`) rather than from the window's own `index.jsx` — App.jsx imports the window components above its `import './style.css'`, so from there they would land first and lose every tie. When overriding a HeroUI component, also prefer its own custom properties over the declarations they feed: `.button` paints `background-color: var(--button-bg)` and hovers to `var(--button-bg-hover)`, so setting `background` alone leaves the hover state pointing at the accent.
- **For `!important` declarations the layer order reverses, and unlayered is the weakest.** `src/style.css` ends with an unlayered `html { border-radius: 10px !important }` for the frameless windows; anything that has to beat it (a theme squaring the window off, say) can do so from `@layer base` with a plain `!important` and no specificity race.

### Themes

HeroUI v3 is CSS-first: there is no `tailwind.config.cjs` and no HeroUI plugin any more. A theme is four things:

1. `src/themes/<name>.css` — a `@layer base { [data-theme='<name>'] { … } }` block of token values, modelled on `light.css` (which documents how the old v2 scale maps onto v3's names).
2. an `@import` for it in `src/style.css`.
3. an entry in `colorThemes` (`src/utils/theme.js`), which keeps the Settings dropdown and the `next-themes` provider in sync — next-themes only strips the themes it was told about, so a name missing from that list gets written onto `<html>` and never removed.
4. a `config.general.theme.<name>` string in `en_US.json`/`zh_CN.json`, plus an icon in the `themeIcon` map in `src/window/Config/pages/General/index.jsx` (it falls back to the monitor glyph, so a missing entry is silent).

A dark theme also has to be added to the `@custom-variant dark` list at the top of `src/style.css`, or every `dark:` utility — the app's own handful plus the many HeroUI's components carry — resolves to its light value under it.

Because every surface in the app is painted with v3 tokens (`bg-surface`, `text-muted`, `border-border`, `text-accent`), a colours-only theme needs no component changes at all. Two tokens are worth knowing about beyond the palette:

- `--radius` is the root of Tailwind's whole radius scale here — `@heroui/styles` defines `--radius-xs … --radius-4xl` as multiples of it — so a single `--radius: 0rem` squares off every component in the app, including the `rounded-3xl` baked into `.button`.
- `--border` / `--border-secondary` are the hairline and the strong rule. The translate window's layout is built entirely on that pair (`src/window/Translate/style.css`), which is what lets the same markup read correctly under every theme.

A theme that wants to restyle utility **classes** rather than just retint the tokens behind them needs its own cascade layer after `utilities` (`@layer theme, base, components, utilities, <name>;`, declared in `src/window/Config/style.css` — see the comment there for why that file owns the statement). Nothing in `components` can outrank a utility. Two traps that path has hit before: `backdrop-filter` establishes a containing block for `position: fixed` descendants, so it must not go on the `bg-background` shells that hold the `data-tauri-drag-region` strips; and lightningcss merges a property with its own prefixed forms, so hand-writing `-webkit-backdrop-filter` makes it emit _only_ the legacy property, which Chrome 151/WebView2 no longer supports.

Anything reading a theme colour from JS should pass the var through as a string (`'var(--surface)'`) rather than branching on the theme name — it resolves against whatever `data-theme` is on `<html>` at paint time, so it stays correct for themes added later and needs no re-render on a theme switch. Note that v3's tokens are **complete colour values**, where v2's `--heroui-*` were bare HSL triplets meant to be wrapped: `hsl(var(--heroui-content1))` is now an invalid colour that silently falls back, and translucency is `color-mix(in oklab, var(--x) N%, transparent)` rather than `hsl(var(--x) / 0.N)`.

### Rust module map (`src-tauri/src/`)

`main.rs` wires plugins, the global `APP: OnceCell<AppHandle>`, and the `invoke_handler` list — a new `#[tauri::command]` must be added there _and_ usually needs a capability entry. `cmd.rs` misc commands (screenshot cropping, proxy, plugin install, fonts). `system_ocr.rs` per-OS native OCR (Windows.Media.Ocr / macOS Vision / Linux tesseract binary). `tts.rs` per-OS offline speech (Windows.Media.SpeechSynthesis / macOS `say` / Linux `espeak-ng`), returning base64 WAV because the IPC layer would otherwise serialize the audio as a JSON number array. `lang_detect.rs` offline detection via `lingua`. `backup.rs` WebDAV/Aliyun/local config backup. `updater.rs` + `updater_window`.

Windows are created hidden and shown once React mounts, so **anything that throws before `root.render` leaves an invisible window**. `main.jsx` therefore never lets init failures escape and mirrors the webview console into the Rust log (`attachConsole`) — check the log dir (tray → View Log) when a window fails to appear.

## Conventions

- Frontend is JSX with plain JS; `.ts` files are used only for data tables (`language.ts`, `info.ts`, `service_instance.ts`). No type-checking step runs.
- Import order in existing files is roughly longest-line-first; Prettier does not enforce it, so just match the surrounding file.
- User-visible strings go through `react-i18next` (`t('...')`), keyed under `translation` in each locale file.
