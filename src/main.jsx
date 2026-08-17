import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { attachConsole, error as logError } from '@tauri-apps/plugin-log';
import ReactDOM from 'react-dom/client';
import React from 'react';

import { colorThemes } from './utils/theme';
import { initStore } from './utils/store';
import { initEnv } from './utils/env';
import App from './App';

// Windows are created hidden and only shown once React mounts, so anything that
// throws before `root.render` leaves an invisible window and no trace of why.
// Mirror the webview console into the Rust log so those failures are findable.
attachConsole();
window.addEventListener('error', (e) => {
    logError(`Uncaught error: ${e.message} (${e.filename}:${e.lineno}:${e.colno})`);
});
window.addEventListener('unhandledrejection', (e) => {
    logError(`Unhandled rejection: ${e.reason?.stack ?? e.reason}`);
});

if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

async function bootstrap() {
    // Neither init step is worth blocking the UI on: a broken config store or a
    // missing os value degrades the window, an unmounted React tree hides it.
    try {
        await initStore();
    } catch (e) {
        logError(`initStore failed: ${e}`);
    }
    try {
        await initEnv();
    } catch (e) {
        logError(`initEnv failed: ${e}`);
    }
    const rootElement = document.getElementById('root');
    const root = ReactDOM.createRoot(rootElement);
    // No provider wrapping the tree: v3 dropped `HeroUIProvider`, and the pieces
    // it used to carry are opt-in (`I18nProvider`, `RouterProvider`,
    // `ToastProvider`) rather than required. Nothing here needs them yet.
    //
    // `attribute='data-theme'`, not 'class': v3 selects a theme with a
    // `data-theme` attribute on the root element rather than a class name.
    root.render(
        <NextThemesProvider
            attribute='data-theme'
            themes={colorThemes}
        >
            <App />
        </NextThemesProvider>
    );
}

bootstrap();
