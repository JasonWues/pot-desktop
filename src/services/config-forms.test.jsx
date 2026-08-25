// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';

// Every service settings form is now built out of the same shared parts, so a
// mistake in one of them -- a field name that does not match the service's
// config, an i18n key that does not exist -- is a mistake nothing else would
// catch until a user opened that one dialog. There are 43 of them; this renders
// all 43.

// The config store, in memory. Mocked at Gloss's own boundary rather than through
// `mockIPC` on `plugin:store|*`: what is under test is `useConfig` and the
// forms, not the plugin's wire protocol, and the protocol is the part most
// likely to change out from under a test.
const stored = vi.hoisted(() => new Map());
vi.mock('../utils/store', () => ({
    store: {
        get: async (key) => stored.get(key),
        set: async (key, value) => void stored.set(key, value),
        has: async (key) => stored.has(key),
        delete: async (key) => void stored.delete(key),
        save: async () => {},
        reload: async () => {},
    },
    initStore: async () => {},
}));

// Reached during a pull, which no test triggers, but the constructor runs in an
// effect and would otherwise try to talk to a real Ollama host.
vi.mock('ollama/browser', () => ({
    Ollama: class {
        async list() {
            return { models: [] };
        }
        async pull() {
            return [];
        }
    },
}));

const { mockIPC, clearMocks } = await import('@tauri-apps/api/mocks');

await import('../i18n');
const translateServices = await import('./translate');
const recognizeServices = await import('./recognize');
const ttsServices = await import('./tts');
const collectionServices = await import('./collection');

const allServices = [
    ['translate', translateServices],
    ['recognize', recognizeServices],
    ['tts', ttsServices],
    ['collection', collectionServices],
]
    .flatMap(([type, barrel]) =>
        Object.entries(barrel).map(([name, service]) => ({ label: type + '/' + name, name, Config: service?.Config }))
    )
    .filter((entry) => typeof entry.Config === 'function');

beforeEach(() => {
    stored.clear();
    mockIPC((cmd) => {
        // The two TTS forms list the voices the platform offers as soon as they
        // mount, and both then filter what comes back.
        if (cmd === 'system_tts_voices' || cmd === 'edge_tts_voices') {
            return [];
        }
        return null;
    });
});

afterEach(async () => {
    // Unmount first, and let the microtask queue drain before the mocks go.
    // `useConfig` tears its listener down through a promise
    // (`unlisten.then((f) => f())`), and that callback reaches for a global
    // `clearMocks` removes -- so clearing first turns every unmount into an
    // unhandled rejection.
    cleanup();
    await Promise.resolve();
    clearMocks();
    vi.restoreAllMocks();
});

it('finds every service', () => {
    // A guard on the loop below: if a barrel stopped exporting, the suite would
    // otherwise pass by testing nothing.
    expect(allServices.length).toBe(43);
});

describe.each(allServices)('$label settings form', ({ name, Config }) => {
    it('renders its fields and a save button', async () => {
        const { container } = render(
            <Config
                instanceKey={name}
                updateServiceList={() => {}}
                onClose={() => {}}
            />
        );

        // The form paints nothing until `useConfig` has resolved, so this is a
        // find rather than a get.
        expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();

        // i18next returns the key itself when it has no string for it, so a
        // mistyped key renders as `services.translate.baidu.appid` on screen
        // rather than failing. This is what makes that visible.
        //
        // No `\b` in front: the key is concatenated straight onto the previous
        // label in `textContent`, so there is no word boundary to anchor to.
        // Two dotted segments after the namespace is what keeps it from firing
        // on ordinary prose.
        expect(container.textContent).not.toMatch(/(services|config|common)\.[a-z_0-9]+\.[a-z_0-9]+/i);
    });
});
