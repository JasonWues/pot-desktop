import { webcrypto } from 'node:crypto';

// jsdom ships no WebCrypto, and the app leans on it in three places: the
// ChatGLM service signs its JWT with `crypto.subtle`, and both the Yandex
// service and `lang_detect` call `crypto.randomUUID`. Node has the same API, so
// the polyfill is a re-export rather than a stub -- a test that signs something
// gets a real signature.
if (globalThis.crypto === undefined) {
    globalThis.crypto = webcrypto;
}
if (typeof window !== 'undefined' && window.crypto?.subtle === undefined) {
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
}

// jsdom implements no Web Audio either, and `useVoice` constructs an
// AudioContext at module scope -- so merely importing the hooks barrel, which
// every window and the service config form do, throws without this. A stub is
// enough: nothing under test plays anything.
if (typeof window !== 'undefined' && window.AudioContext === undefined) {
    window.AudioContext = class {
        createBufferSource() {
            return { connect() {}, start() {}, stop() {}, buffer: null };
        }
        decodeAudioData() {
            return Promise.resolve(null);
        }
        get destination() {
            return {};
        }
    };
}

// `mockIPC` intercepts `invoke`, but the event API also reaches for this global
// when a listener is torn down, and mocking does not install it. Without it
// every unmounted `useConfig` rejects on cleanup.
if (typeof window !== 'undefined') {
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
}

// Only for the files that asked for a DOM; the matchers assert about elements
// and have nothing to attach to otherwise.
if (typeof window !== 'undefined') {
    await import('@testing-library/jest-dom/vitest');
}
