import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { currentMonitor } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { info } from '@tauri-apps/plugin-log';
import { useEffect, useRef } from 'react';

import { store } from '../utils/store';

const appWindow = getCurrentWebviewWindow();

// Close the window once it loses focus.
//
// Not immediately: on Windows, starting to drag a window fires blur and then
// focus right back, so closing on the blur itself would make the window
// impossible to move. The close is queued instead, and focus or move cancels
// it.
//
// `enabled` is the whole switch. The Translate and Recognize windows both turn
// it off while the window is pinned and while their `*_close_on_blur` setting
// says so; each used to do that by unsubscribing a module-scope listener from
// inside a click handler, which meant the listener's lifetime was tracked in a
// module variable that also had to be handed back and forth with the pin
// button.
export function useCloseOnBlur({ enabled, delay = 100 }) {
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;

        const cancel = (reason) => {
            if (timeoutRef.current) {
                info(`${reason}: cancel close`);
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };

        const unlisteners = [
            listen('tauri://blur', () => {
                cancel('blur');
                info('Blur');
                timeoutRef.current = setTimeout(async () => {
                    info('Confirm Blur');
                    await appWindow.close();
                }, delay);
            }),
            listen('tauri://focus', () => cancel('focus')),
            listen('tauri://move', () => cancel('move')),
        ];

        return () => {
            cancel('unmount');
            unlisteners.forEach((unlisten) => unlisten.then((f) => f()));
        };
    }, [enabled, delay]);
}

// Write the window's own geometry back to the config store so the next open can
// restore it. Rust reads these keys when it creates the window
// (`src-tauri/src/window.rs`), which is why they are set through `store`
// directly rather than through `useConfig` -- nothing in the UI reads them back.
export function usePersistWindowGeometry({ position = false, size = false, keyPrefix = appWindow.label } = {}) {
    useEffect(() => {
        if (!position) return;
        let timeout = null;
        const unlisten = listen('tauri://move', async () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const monitor = await currentMonitor();
                const logical = (await appWindow.outerPosition()).toLogical(monitor.scaleFactor);
                await store.set(`${keyPrefix}_window_position_x`, parseInt(logical.x));
                await store.set(`${keyPrefix}_window_position_y`, parseInt(logical.y));
                await store.save();
            }, 100);
        });
        return () => {
            if (timeout) clearTimeout(timeout);
            unlisten.then((f) => f());
        };
    }, [position, keyPrefix]);

    useEffect(() => {
        if (!size) return;
        let timeout = null;
        const unlisten = listen('tauri://resize', async () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const monitor = await currentMonitor();
                const logical = (await appWindow.outerSize()).toLogical(monitor.scaleFactor);
                await store.set(`${keyPrefix}_window_height`, parseInt(logical.height));
                await store.set(`${keyPrefix}_window_width`, parseInt(logical.width));
                await store.save();
            }, 100);
        });
        return () => {
            if (timeout) clearTimeout(timeout);
            unlisten.then((f) => f());
        };
    }, [size, keyPrefix]);
}
