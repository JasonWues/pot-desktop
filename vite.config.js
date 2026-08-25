import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    // Tailwind runs as a Vite plugin rather than through postcss.config.js, so
    // the project needs neither postcss nor @tailwindcss/postcss.
    plugins: [tailwindcss(), react()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    // prevent vite from obscuring rust errors
    clearScreen: false,
    // tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        watch: {
            // cargo writes and locks files under src-tauri/target while it builds.
            // Watching them makes chokidar's fs.watch throw EBUSY on the linked
            // gloss.exe, and that error event terminates the whole dev server.
            ignored: ['**/src-tauri/**'],
        },
    },
    // to make use of `TAURI_DEBUG` and other env variables
    // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        rollupOptions: {
            input: {
                index: resolve(import.meta.dirname, 'index.html'),
                daemon: resolve(import.meta.dirname, 'daemon.html'),
            },
        },
        // Tauri supports es2021. The env var is `TAURI_ENV_PLATFORM` in Tauri 2
        // (`TAURI_PLATFORM` in v1) -- with the old name this test never matched
        // and every build, Windows included, silently used the macOS target.
        target: process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
        // CSS gets its own target, and a modern one: for anything older,
        // lightningcss lowers logical properties (`margin-inline-start`, `inset-
        // inline-start`, logical border radii -- i.e. every `ms-*`, `start-*`,
        // `rounded-s-*` utility) to physical ones guarded by `:lang(ae,ar,...)`
        // lists. Chromium does not support multi argument `:lang()` at all, so
        // WebView2 dropped those rules as invalid: HeroUI's switch lit up but its
        // thumb never moved, because the move is an `ms-5`. This baseline matches
        // the one Tailwind 4 already assumes for its own output.
        cssTarget: ['chrome111', 'safari16.4', 'firefox128'],
        // don't minify for debug builds. `true` is the Oxc minifier, Vite 8's
        // default; the old 'esbuild' value is deprecated and would need esbuild
        // installed as a separate dependency.
        minify: !process.env.TAURI_DEBUG,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
    },
}));
