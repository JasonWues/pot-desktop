import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { BrowserRouter } from 'react-router-dom';
import React, { Suspense, lazy, useEffect } from 'react';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppConfig } from './hooks/useAppConfig';
import AppToaster from './components/AppToaster';
import { store } from './utils/store';
import './style.css';
import './i18n';

const appWindow = getCurrentWebviewWindow();

// One bundle serves five windows, and which UI renders is chosen by the Tauri
// window label. Statically importing all five put all five in the initial chunk:
// the updater window -- a dialog that says a new version exists -- was loading
// the Translate window, the Recognize window and the screenshot overlay before
// it could paint.
//
// `lazy` is what lets Rollup give each window its own chunk. It is safe here
// because the windows are created hidden and each one calls `appWindow.show()`
// from its own effect, so "not mounted yet" already meant "not visible yet" --
// this only makes that window slightly longer. The fallback is `null` for the
// same reason: nothing should paint before the window's own component decides to
// show itself.
const windowMap = {
    translate: lazy(() => import('./window/Translate')),
    screenshot: lazy(() => import('./window/Screenshot')),
    recognize: lazy(() => import('./window/Recognize')),
    config: lazy(() => import('./window/Config')),
    updater: lazy(() => import('./window/Updater')),
};

export default function App() {
    // Theme, language, typeface -- and the keys the app takes off the webview.
    // Both read the config store through `useConfig`, so every window applies
    // the same values and follows a change in any of them.
    useAppConfig();
    useKeyboardShortcuts();

    useEffect(() => {
        store.reload();
    }, []);

    const CurrentWindow = windowMap[appWindow.label];

    // One toaster per window, above the window's own component. Each page and
    // several of the modals used to mount their own, and a `<Toaster>` draws
    // every toast sharing its id -- so a page with a modal open drew each one
    // twice.
    //
    // The toaster stays outside `Suspense`: it is tiny, it is shared by every
    // window, and a toast raised during the window's own load still has
    // somewhere to go.
    return (
        <BrowserRouter>
            <Suspense fallback={null}>{CurrentWindow ? <CurrentWindow /> : null}</Suspense>
            <AppToaster />
        </BrowserRouter>
    );
}
