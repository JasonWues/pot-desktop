import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { BrowserRouter } from 'react-router-dom';
import React, { useEffect } from 'react';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppConfig } from './hooks/useAppConfig';
import AppToaster from './components/AppToaster';
import Screenshot from './window/Screenshot';
import Translate from './window/Translate';
import Recognize from './window/Recognize';
import Updater from './window/Updater';
import { store } from './utils/store';
import Config from './window/Config';
import './style.css';
import './i18n';

const appWindow = getCurrentWebviewWindow();

const windowMap = {
    translate: <Translate />,
    screenshot: <Screenshot />,
    recognize: <Recognize />,
    config: <Config />,
    updater: <Updater />,
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

    // One toaster per window, above the window's own component. Each page and
    // several of the modals used to mount their own, and a `<Toaster>` draws
    // every toast sharing its id -- so a page with a modal open drew each one
    // twice.
    return (
        <BrowserRouter>
            {windowMap[appWindow.label]}
            <AppToaster />
        </BrowserRouter>
    );
}
