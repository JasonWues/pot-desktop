// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';

// `useConfig` reads the store once and installs one `<key>_changed` listener per
// key, shared by every mounted call site. That sharing is the thing under test:
// it is invisible from any single component, and there are 108 call sites --
// `TargetArea` alone is rendered once per configured service and calls the hook
// nine times, for keys that are window-global rather than per-service.

const stored = vi.hoisted(() => new Map<string, unknown>());
const storeCalls = vi.hoisted(() => ({ get: 0, set: 0, save: 0 }));
vi.mock('../utils/store', () => ({
    store: {
        get: async (key: string) => {
            storeCalls.get += 1;
            return stored.get(key);
        },
        set: async (key: string, value: unknown) => {
            storeCalls.set += 1;
            stored.set(key, value);
        },
        has: async (key: string) => stored.has(key),
        delete: async (key: string) => void stored.delete(key),
        save: async () => {
            storeCalls.save += 1;
        },
        reload: async () => {},
    },
    initStore: async () => {},
}));

// The event layer, recorded rather than mocked through IPC: what matters here is
// how many listeners the hook installs and that they are torn down, not the wire
// format underneath.
const listeners = vi.hoisted(() => new Map<string, Set<(e: { payload: unknown }) => void>>());
const listenCalls = vi.hoisted(() => ({ count: 0, unlisten: 0 }));
vi.mock('@tauri-apps/api/event', () => ({
    listen: async (event: string, handler: (e: { payload: unknown }) => void) => {
        listenCalls.count += 1;
        let set = listeners.get(event);
        if (!set) {
            set = new Set();
            listeners.set(event, set);
        }
        set.add(handler);
        return () => {
            listenCalls.unlisten += 1;
            set!.delete(handler);
        };
    },
    emit: async () => {},
}));

const { useConfig, deleteKey } = await import('./useConfig');

function emitChange(event: string, payload: unknown) {
    for (const handler of listeners.get(event) ?? []) {
        handler({ payload });
    }
}

/** Renders one subscriber to `key` and prints whatever it is holding. */
function Reader({ configKey, testId, fallback }: { configKey: string; testId: string; fallback: string }) {
    const [value] = useConfig(configKey, fallback);
    return <span data-testid={testId}>{String(value)}</span>;
}

/** Waits for the hook's initial read, which resolves over a few microtasks. */
async function settle() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

beforeEach(() => {
    stored.clear();
    listeners.clear();
    storeCalls.get = 0;
    storeCalls.set = 0;
    storeCalls.save = 0;
    listenCalls.count = 0;
    listenCalls.unlisten = 0;
});

afterEach(cleanup);

describe('useConfig sharing', () => {
    it('reads the store once and listens once no matter how many components ask', async () => {
        stored.set('auto_copy', 'source');

        render(
            <>
                <Reader configKey='auto_copy' testId='a' fallback='disable' />
                <Reader configKey='auto_copy' testId='b' fallback='disable' />
                <Reader configKey='auto_copy' testId='c' fallback='disable' />
            </>
        );
        await settle();

        expect(screen.getByTestId('a')).toHaveTextContent('source');
        expect(screen.getByTestId('c')).toHaveTextContent('source');
        // The whole point: three subscribers, one read and one listener.
        expect(storeCalls.get).toBe(1);
        expect(listenCalls.count).toBe(1);
    });

    it('still installs one listener per distinct key', async () => {
        render(
            <>
                <Reader configKey='key_one' testId='a' fallback='1' />
                <Reader configKey='key_two' testId='b' fallback='2' />
            </>
        );
        await settle();

        expect(listenCalls.count).toBe(2);
        expect(screen.getByTestId('a')).toHaveTextContent('1');
        expect(screen.getByTestId('b')).toHaveTextContent('2');
    });

    it('fans one change out to every subscriber', async () => {
        stored.set('auto_copy', 'source');
        render(
            <>
                <Reader configKey='auto_copy' testId='a' fallback='disable' />
                <Reader configKey='auto_copy' testId='b' fallback='disable' />
            </>
        );
        await settle();

        await act(async () => {
            emitChange('auto_copy_changed', 'target');
        });

        expect(screen.getByTestId('a')).toHaveTextContent('target');
        expect(screen.getByTestId('b')).toHaveTextContent('target');
    });

    it('seeds a missing key with the default exactly once', async () => {
        render(
            <>
                <Reader configKey='fresh' testId='a' fallback='seeded' />
                <Reader configKey='fresh' testId='b' fallback='seeded' />
            </>
        );
        await settle();

        expect(screen.getByTestId('a')).toHaveTextContent('seeded');
        expect(stored.get('fresh')).toBe('seeded');
        // One write, not one per call site.
        expect(storeCalls.set).toBe(1);
    });

    it('drops the listener only when the last subscriber unmounts', async () => {
        stored.set('auto_copy', 'source');
        const { rerender, unmount } = render(
            <>
                <Reader configKey='auto_copy' testId='a' fallback='disable' />
                <Reader configKey='auto_copy' testId='b' fallback='disable' />
            </>
        );
        await settle();
        expect(listenCalls.unlisten).toBe(0);

        // One of the two goes away: the shared listener has to stay.
        rerender(<Reader configKey='auto_copy' testId='a' fallback='disable' />);
        await settle();
        expect(listenCalls.unlisten).toBe(0);

        unmount();
        await settle();
        expect(listenCalls.unlisten).toBe(1);
    });

    it('re-reads after every subscriber has gone, rather than serving a stale value', async () => {
        stored.set('auto_copy', 'source');
        const first = render(<Reader configKey='auto_copy' testId='a' fallback='disable' />);
        await settle();
        expect(storeCalls.get).toBe(1);

        first.unmount();
        await settle();

        // The value changed while nothing was mounted -- an external edit, or
        // another window writing it.
        stored.set('auto_copy', 'target');
        render(<Reader configKey='auto_copy' testId='b' fallback='disable' />);
        await settle();

        expect(storeCalls.get).toBe(2);
        expect(screen.getByTestId('b')).toHaveTextContent('target');
    });

    it('forgets the cached value when the key is deleted', async () => {
        stored.set('doomed', 'here');
        const mounted = render(<Reader configKey='doomed' testId='a' fallback='fallback' />);
        await settle();
        expect(screen.getByTestId('a')).toHaveTextContent('here');

        await deleteKey('doomed');
        mounted.unmount();
        await settle();

        // A later mount must not be handed the value of a key that is gone.
        render(<Reader configKey='doomed' testId='b' fallback='fallback' />);
        await settle();
        expect(screen.getByTestId('b')).toHaveTextContent('fallback');
    });
});
