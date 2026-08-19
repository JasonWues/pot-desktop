import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';

import { useConfig } from './useConfig';

const appWindow = getCurrentWebviewWindow();

// The browser keys a webview offers that the app has no use for: find, print,
// reload, view-source and the rest all do something confusing inside a window
// that is not a browser tab. Editing and undo are kept.
const ALLOWED_CTRL_KEYS = ['c', 'v', 'x', 'a', 'z', 'y'];

export function useKeyboardShortcuts() {
    const [devMode] = useConfig('dev_mode', false);

    useEffect(() => {
        const handleKeyDown = async (e) => {
            if (e.ctrlKey && !ALLOWED_CTRL_KEYS.includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            if (e.key === 'F12' && devMode) {
                await invoke('open_devtools');
            }
            // F1-F12, not every key that starts with an F.
            if (e.key.startsWith('F') && e.key.length > 1) {
                e.preventDefault();
            }
            if (e.key === 'Escape') {
                await appWindow.close();
            }
        };

        // Removed on cleanup. The old code registered a fresh listener from
        // inside the effect and never took one off, so every change to dev_mode
        // left another one attached and Escape closed the window once per copy.
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [devMode]);
}
